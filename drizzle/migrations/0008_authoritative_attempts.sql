-- ===== Authoritative attempt state, autosave, and deadline enforcement =====
alter table public.contest_attempts
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists status text not null default 'in_progress',
  add column if not exists last_seen_at timestamptz not null default now(),
  add column if not exists extra_time_sec int not null default 0,
  add column if not exists violation_events jsonb not null default '[]'::jsonb;
alter table public.contest_attempts alter column id set not null;
create unique index if not exists contest_attempts_id_uidx on public.contest_attempts(id);

create or replace function public.start_contest_attempt_v2(_contest_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  attempt public.contest_attempts;
  contest public.contests;
  deadline timestamptz;
begin
  if auth.uid() is null or not public.has_role(auth.uid(), 'student') then raise exception 'Only students can start attempts'; end if;
  select * into contest from public.contests where id = _contest_id and is_draft = false;
  if contest.id is null or contest.start_time > now() or contest.end_time <= now() then raise exception 'Contest is not live'; end if;
  insert into public.contest_attempts (contest_id, user_id) values (_contest_id, auth.uid()) on conflict (contest_id, user_id) do nothing;
  select * into attempt from public.contest_attempts where contest_id = _contest_id and user_id = auth.uid() for update;
  if attempt.status = 'submitted' then raise exception 'Attempt already submitted'; end if;
  update public.contest_attempts set last_seen_at = now() where id = attempt.id;
  deadline := least(attempt.started_at + ((contest.duration_minutes * 60 + attempt.extra_time_sec) || ' seconds')::interval, contest.end_time);
  return jsonb_build_object('attemptId', attempt.id, 'startedAt', attempt.started_at, 'deadline', deadline, 'answers', attempt.answers, 'violations', attempt.violation_events);
end $$;
revoke all on function public.start_contest_attempt_v2(uuid) from public, anon;
grant execute on function public.start_contest_attempt_v2(uuid) to authenticated;

create or replace function public.save_attempt_answers(
  _attempt_id uuid,
  _answers jsonb,
  _violations jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  attempt public.contest_attempts;
  contest public.contests;
  deadline timestamptz;
begin
  if auth.uid() is null or not public.has_role(auth.uid(), 'student') then raise exception 'Student access required'; end if;
  select * into attempt from public.contest_attempts where id = _attempt_id and user_id = auth.uid() for update;
  if attempt.id is null or attempt.status <> 'in_progress' then raise exception 'Attempt is not in progress'; end if;
  select * into contest from public.contests where id = attempt.contest_id and is_draft = false;
  deadline := least(attempt.started_at + ((contest.duration_minutes * 60 + attempt.extra_time_sec) || ' seconds')::interval, contest.end_time);
  if now() > deadline + interval '5 seconds' then raise exception 'SUBMISSION_TOO_LATE'; end if;
  update public.contest_attempts set answers = coalesce(_answers, '{}'::jsonb), violation_events = coalesce(_violations, '[]'::jsonb), last_seen_at = now() where id = _attempt_id;
  return jsonb_build_object('savedAt', now(), 'deadline', deadline, 'answers', coalesce(_answers, '{}'::jsonb));
end $$;
revoke all on function public.save_attempt_answers(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.save_attempt_answers(uuid, jsonb, jsonb) to authenticated;

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
  deadline timestamptz;
begin
  if auth.uid() is null or not public.has_role(auth.uid(), 'student') then raise exception 'Only students can submit attempts'; end if;
  select * into contest from public.contests where id = _contest_id and is_draft = false;
  if contest.id is null then raise exception 'Contest not found'; end if;
  select * into attempt from public.contest_attempts where contest_id = _contest_id and user_id = auth.uid() for update;
  if attempt.id is null then raise exception 'Attempt has not started'; end if;
  if attempt.status = 'submitted' then return jsonb_build_object('score', attempt.score, 'timeTakenSeconds', extract(epoch from (attempt.submitted_at - attempt.started_at))::int); end if;
  deadline := least(attempt.started_at + ((contest.duration_minutes * 60 + attempt.extra_time_sec) || ' seconds')::interval, contest.end_time);
  if now() > deadline + interval '5 seconds' then raise exception 'SUBMISSION_TOO_LATE'; end if;
  select (coalesce(sum(case when q.type = 'mcq' and (_answers ->> q.id::text) ~ '^[0-9]+$' and (_answers ->> q.id::text)::int = q.correct_option then q.marks else 0 end), 0) + coalesce((select sum(latest.score) from (select distinct on (cs.question_id) cs.score from public.coding_submissions cs where cs.contest_id = _contest_id and cs.user_id = auth.uid() order by cs.question_id, cs.created_at desc) latest), 0))::numeric(5,2) into earned
    from public.contest_questions cq join public.questions q on q.id = cq.question_id where cq.contest_id = _contest_id;
  elapsed := greatest(0, extract(epoch from (now() - attempt.started_at))::int);
  update public.contest_attempts set answers = coalesce(_answers, '{}'::jsonb), submitted_at = now(), status = 'submitted', last_seen_at = now(), violations = greatest(0, _violations), score = earned where id = attempt.id;
  insert into public.contest_results (contest_id, user_id, score, time_taken_seconds, submitted_at) values (_contest_id, auth.uid(), earned, elapsed, now()) on conflict (contest_id, user_id) do update set score = excluded.score, time_taken_seconds = excluded.time_taken_seconds, submitted_at = excluded.submitted_at;
  insert into public.contest_presence (contest_id, user_id, status, started_at, last_seen_at, violations, submitted_at) values (_contest_id, auth.uid(), 'submitted', attempt.started_at, now(), greatest(0, _violations), now()) on conflict (contest_id, user_id) do update set status = 'submitted', last_seen_at = now(), violations = greatest(public.contest_presence.violations, excluded.violations), submitted_at = now();
  return jsonb_build_object('score', earned, 'timeTakenSeconds', elapsed, 'deadline', deadline);
end $$;
revoke all on function public.submit_contest_attempt(uuid, jsonb, int) from public, anon;
grant execute on function public.submit_contest_attempt(uuid, jsonb, int) to authenticated;
