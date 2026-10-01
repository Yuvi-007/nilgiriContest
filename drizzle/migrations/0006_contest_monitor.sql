-- ===== Contest presence and live monitor =====
create table public.contest_presence (
  contest_id uuid not null references public.contests(id) on delete cascade,
  user_id uuid not null,
  status text not null default 'active',
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  violations int not null default 0,
  submitted_at timestamptz,
  primary key (contest_id, user_id)
);
grant select on public.contest_presence to authenticated;
grant all on public.contest_presence to service_role;
alter table public.contest_presence enable row level security;
create policy "own presence readable" on public.contest_presence for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

create or replace function public.student_contest_heartbeat(
  _contest_id uuid,
  _status text default 'active',
  _violations int default 0
)
returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.has_role(auth.uid(), 'student') then raise exception 'Student access required'; end if;
  if not exists (select 1 from public.contest_attempts where contest_id = _contest_id and user_id = auth.uid()) then raise exception 'Attempt has not started'; end if;
  insert into public.contest_presence (contest_id, user_id, status, started_at, last_seen_at, violations)
    select _contest_id, auth.uid(), _status, a.started_at, now(), greatest(0, _violations)
    from public.contest_attempts a
    where a.contest_id = _contest_id and a.user_id = auth.uid()
  on conflict (contest_id, user_id) do update set
    status = excluded.status,
    last_seen_at = now(),
    violations = greatest(public.contest_presence.violations, excluded.violations),
    submitted_at = case when excluded.status = 'submitted' then now() else public.contest_presence.submitted_at end;
  return true;
end $$;
revoke all on function public.student_contest_heartbeat(uuid, text, int) from public, anon;
grant execute on function public.student_contest_heartbeat(uuid, text, int) to authenticated;

create or replace function public.admin_contest_monitor(_contest_id uuid)
returns table (
  user_id uuid,
  login_id text,
  full_name text,
  status text,
  started_at timestamptz,
  last_seen_at timestamptz,
  violations int,
  submitted_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select cp.user_id, p.login_id, p.full_name, cp.status, cp.started_at, cp.last_seen_at, cp.violations, cp.submitted_at
  from public.contest_presence cp
  join public.profiles p on p.id = cp.user_id
  where cp.contest_id = _contest_id
    and public.has_role(auth.uid(), 'admin')
  order by cp.last_seen_at desc
$$;
revoke all on function public.admin_contest_monitor(uuid) from public, anon;
grant execute on function public.admin_contest_monitor(uuid) to authenticated;

-- Keep the monitor synchronized when an attempt starts or submits.
create or replace function public.start_contest_attempt(_contest_id uuid)
returns timestamptz
language plpgsql security definer set search_path = public as $$
declare
  started timestamptz;
begin
  if auth.uid() is null or not public.has_role(auth.uid(), 'student') then raise exception 'Only students can start attempts'; end if;
  if not exists (select 1 from public.contests where id = _contest_id and is_draft = false and start_time <= now() and end_time > now()) then raise exception 'Contest is not live'; end if;
  insert into public.contest_attempts (contest_id, user_id) values (_contest_id, auth.uid()) on conflict (contest_id, user_id) do nothing;
  select a.started_at into started from public.contest_attempts a where a.contest_id = _contest_id and a.user_id = auth.uid();
  insert into public.contest_presence (contest_id, user_id, status, started_at, last_seen_at)
    values (_contest_id, auth.uid(), 'active', started, now())
    on conflict (contest_id, user_id) do update set status = 'active', last_seen_at = now();
  return started;
end $$;
revoke all on function public.start_contest_attempt(uuid) from public, anon;
grant execute on function public.start_contest_attempt(uuid) to authenticated;

create or replace function public.submit_contest_attempt(
  _contest_id uuid,
  _answers jsonb,
  _violations int default 0
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  attempt public.contest_attempts;
  contest public.contests;
  earned numeric(5,2);
  elapsed int;
begin
  if auth.uid() is null or not public.has_role(auth.uid(), 'student') then raise exception 'Only students can submit attempts'; end if;
  select * into contest from public.contests where id = _contest_id and is_draft = false;
  if contest.id is null then raise exception 'Contest not found'; end if;
  select * into attempt from public.contest_attempts where contest_id = _contest_id and user_id = auth.uid() for update;
  if attempt.contest_id is null then raise exception 'Attempt has not started'; end if;
  if attempt.submitted_at is not null then return jsonb_build_object('score', attempt.score, 'timeTakenSeconds', extract(epoch from (attempt.submitted_at - attempt.started_at))::int); end if;
  if now() > contest.end_time then raise exception 'Contest has closed'; end if;
  select (coalesce(sum(case when q.type = 'mcq' and (_answers ->> q.id::text) ~ '^[0-9]+$' and (_answers ->> q.id::text)::int = q.correct_option then q.marks else 0 end), 0) + coalesce((select sum(latest.score) from (select distinct on (cs.question_id) cs.score from public.coding_submissions cs where cs.contest_id = _contest_id and cs.user_id = auth.uid() order by cs.question_id, cs.created_at desc) latest), 0))::numeric(5,2)
    into earned
    from public.contest_questions cq join public.questions q on q.id = cq.question_id where cq.contest_id = _contest_id;
  elapsed := greatest(0, extract(epoch from (now() - attempt.started_at))::int);
  update public.contest_attempts set answers = _answers, submitted_at = now(), violations = greatest(0, _violations), score = earned where contest_id = _contest_id and user_id = auth.uid();
  insert into public.contest_results (contest_id, user_id, score, time_taken_seconds, submitted_at) values (_contest_id, auth.uid(), earned, elapsed, now()) on conflict (contest_id, user_id) do update set score = excluded.score, time_taken_seconds = excluded.time_taken_seconds, submitted_at = excluded.submitted_at;
  insert into public.contest_presence (contest_id, user_id, status, started_at, last_seen_at, violations, submitted_at) values (_contest_id, auth.uid(), 'submitted', attempt.started_at, now(), greatest(0, _violations), now()) on conflict (contest_id, user_id) do update set status = 'submitted', last_seen_at = now(), violations = greatest(public.contest_presence.violations, excluded.violations), submitted_at = now();
  return jsonb_build_object('score', earned, 'timeTakenSeconds', elapsed);
end $$;
revoke all on function public.submit_contest_attempt(uuid, jsonb, int) from public, anon;
grant execute on function public.submit_contest_attempt(uuid, jsonb, int) to authenticated;
