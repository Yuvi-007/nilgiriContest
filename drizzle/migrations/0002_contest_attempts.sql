-- ===== Contest attempts =====
-- Question content is exposed through an RPC that omits correct_option.
create table public.contest_attempts (
  contest_id uuid not null references public.contests(id) on delete cascade,
  user_id uuid not null,
  answers jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  violations int not null default 0,
  score numeric(5,2),
  primary key (contest_id, user_id)
);
grant select on public.contest_attempts to authenticated;
grant all on public.contest_attempts to service_role;
alter table public.contest_attempts enable row level security;
create policy "own attempts readable" on public.contest_attempts for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

-- Students can read contest questions without receiving answer keys.
create or replace function public.get_contest_questions(_contest_id uuid)
returns table (
  "position" int,
  id uuid,
  type public.question_type,
  difficulty public.difficulty,
  marks int,
  title text,
  body text,
  options jsonb
)
language sql stable security definer set search_path = public as $$
  select cq.position, q.id, q.type, q.difficulty, q.marks, q.title, q.body, q.options
  from public.contest_questions cq
  join public.questions q on q.id = cq.question_id
  join public.contests c on c.id = cq.contest_id
  where cq.contest_id = _contest_id
    and c.is_draft = false
    and (public.has_role(auth.uid(), 'student') or public.has_role(auth.uid(), 'admin'))
  order by cq.position
$$;
revoke all on function public.get_contest_questions(uuid) from public, anon;
grant execute on function public.get_contest_questions(uuid) to authenticated;

create or replace function public.start_contest_attempt(_contest_id uuid)
returns timestamptz
language plpgsql security definer set search_path = public as $$
declare
  started timestamptz;
begin
  if auth.uid() is null or not public.has_role(auth.uid(), 'student') then
    raise exception 'Only students can start attempts';
  end if;
  if not exists (
    select 1 from public.contests
    where id = _contest_id and is_draft = false and start_time <= now() and end_time > now()
  ) then
    raise exception 'Contest is not live';
  end if;
  insert into public.contest_attempts (contest_id, user_id)
  values (_contest_id, auth.uid())
  on conflict (contest_id, user_id) do nothing;
  select a.started_at into started
  from public.contest_attempts a
  where a.contest_id = _contest_id and a.user_id = auth.uid();
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
  if auth.uid() is null or not public.has_role(auth.uid(), 'student') then
    raise exception 'Only students can submit attempts';
  end if;
  select * into contest from public.contests where id = _contest_id and is_draft = false;
  if contest.id is null then raise exception 'Contest not found'; end if;
  select * into attempt from public.contest_attempts
    where contest_id = _contest_id and user_id = auth.uid() for update;
  if attempt.contest_id is null then raise exception 'Attempt has not started'; end if;
  if attempt.submitted_at is not null then
    return jsonb_build_object('score', attempt.score, 'timeTakenSeconds', extract(epoch from (attempt.submitted_at - attempt.started_at))::int);
  end if;
  if now() > contest.end_time then raise exception 'Contest has closed'; end if;

  select coalesce(sum(case
    when q.type = 'mcq' and (_answers ->> q.id::text) ~ '^[0-9]+$'
      and (_answers ->> q.id::text)::int = q.correct_option then q.marks
    else 0 end), 0)::numeric(5,2)
  into earned
  from public.contest_questions cq
  join public.questions q on q.id = cq.question_id
  where cq.contest_id = _contest_id;

  elapsed := greatest(0, extract(epoch from (now() - attempt.started_at))::int);
  update public.contest_attempts
    set answers = _answers, submitted_at = now(), violations = greatest(0, _violations), score = earned
    where contest_id = _contest_id and user_id = auth.uid();
  insert into public.contest_results (contest_id, user_id, score, time_taken_seconds, submitted_at)
    values (_contest_id, auth.uid(), earned, elapsed, now())
    on conflict (contest_id, user_id) do update set score = excluded.score, time_taken_seconds = excluded.time_taken_seconds, submitted_at = excluded.submitted_at;
  return jsonb_build_object('score', earned, 'timeTakenSeconds', elapsed);
end $$;
revoke all on function public.submit_contest_attempt(uuid, jsonb, int) from public, anon;
grant execute on function public.submit_contest_attempt(uuid, jsonb, int) to authenticated;

create or replace function public.get_contest_attempt(_contest_id uuid)
returns jsonb
language sql stable security definer set search_path = public as $$
  select case when a.contest_id is null then null else jsonb_build_object(
    'answers', a.answers,
    'startedAt', a.started_at,
    'submittedAt', a.submitted_at,
    'violations', a.violations,
    'score', a.score
  ) end
  from public.contest_attempts a
  where a.contest_id = _contest_id and a.user_id = auth.uid()
$$;
revoke all on function public.get_contest_attempt(uuid) from public, anon;
grant execute on function public.get_contest_attempt(uuid) to authenticated;
