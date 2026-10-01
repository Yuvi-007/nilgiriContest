-- ===== Admin monitor controls =====
drop function if exists public.admin_contest_monitor(uuid);
create or replace function public.admin_contest_monitor(_contest_id uuid)
returns table (
  attempt_id uuid,
  user_id uuid,
  login_id text,
  full_name text,
  status text,
  started_at timestamptz,
  last_seen_at timestamptz,
  violations int,
  submitted_at timestamptz,
  answers_completed int,
  extra_time_sec int,
  deadline timestamptz
)
language sql stable security definer set search_path = public as $$
  select a.id, p.id, p.login_id, p.full_name,
    coalesce(cp.status, case when a.status = 'submitted' then 'submitted' when a.status = 'terminated' then 'terminated' else 'not_started' end),
    a.started_at, cp.last_seen_at, coalesce(cp.violations, a.violations, 0), cp.submitted_at,
    case when a.answers is null then 0 else (select count(*) from jsonb_object_keys(a.answers))::int end,
    coalesce(a.extra_time_sec, 0),
    case when a.started_at is null then null else least(a.started_at + ((c.duration_minutes * 60 + a.extra_time_sec) || ' seconds')::interval, c.end_time) end
  from public.profiles p
  join public.user_roles ur on ur.user_id = p.id and ur.role = 'student'
  cross join public.contests c
  left join public.contest_attempts a on a.contest_id = c.id and a.user_id = p.id
  left join public.contest_presence cp on cp.contest_id = c.id and cp.user_id = p.id
  where c.id = _contest_id and public.has_role(auth.uid(), 'admin')
  order by coalesce(cp.last_seen_at, a.started_at, p.created_at) desc
$$;
revoke all on function public.admin_contest_monitor(uuid) from public, anon;
grant execute on function public.admin_contest_monitor(uuid) to authenticated;

create or replace function public.admin_grant_extra_time(_attempt_id uuid, _minutes int)
returns boolean
language plpgsql security definer set search_path = public as $$
declare actor text;
begin
  if auth.uid() is null or not public.has_role(auth.uid(), 'admin') then raise exception 'Admin access required'; end if;
  if _minutes <= 0 or _minutes > 120 then raise exception 'Extra time must be between 1 and 120 minutes'; end if;
  update public.contest_attempts set extra_time_sec = extra_time_sec + (_minutes * 60), last_seen_at = now() where id = _attempt_id and status = 'in_progress';
  if not found then raise exception 'Attempt is not in progress'; end if;
  select login_id into actor from public.profiles where id = auth.uid();
  insert into public.audit_log (actor_login_id, action, details) values (actor, 'extra_time_granted', jsonb_build_object('attempt_id', _attempt_id, 'minutes', _minutes));
  return true;
end $$;
revoke all on function public.admin_grant_extra_time(uuid, int) from public, anon;
grant execute on function public.admin_grant_extra_time(uuid, int) to authenticated;

create or replace function public.admin_reopen_submission(_attempt_id uuid, _minutes int default 10)
returns boolean
language plpgsql security definer set search_path = public as $$
declare actor text;
begin
  if auth.uid() is null or not public.has_role(auth.uid(), 'admin') then raise exception 'Admin access required'; end if;
  if _minutes <= 0 or _minutes > 120 then raise exception 'Restored time must be between 1 and 120 minutes'; end if;
  update public.contest_attempts set status = 'in_progress', submitted_at = null, extra_time_sec = extra_time_sec + (_minutes * 60), last_seen_at = now() where id = _attempt_id and status in ('submitted', 'terminated');
  if not found then raise exception 'Attempt cannot be reopened'; end if;
  select login_id into actor from public.profiles where id = auth.uid();
  insert into public.audit_log (actor_login_id, action, details) values (actor, 'submission_reopened', jsonb_build_object('attempt_id', _attempt_id, 'minutes', _minutes));
  return true;
end $$;
revoke all on function public.admin_reopen_submission(uuid, int) from public, anon;
grant execute on function public.admin_reopen_submission(uuid, int) to authenticated;

create or replace function public.admin_terminate_attempt(_attempt_id uuid)
returns boolean
language plpgsql security definer set search_path = public as $$
declare actor text; attempt_contest_id uuid; user_id_value uuid;
begin
  if auth.uid() is null or not public.has_role(auth.uid(), 'admin') then raise exception 'Admin access required'; end if;
  update public.contest_attempts set status = 'terminated', submitted_at = now(), last_seen_at = now() where id = _attempt_id and status = 'in_progress' returning contest_id, user_id into attempt_contest_id, user_id_value;
  if not found then raise exception 'Attempt is not in progress'; end if;
  update public.contest_presence cp set status = 'terminated', submitted_at = now(), last_seen_at = now() where cp.contest_id = attempt_contest_id and cp.user_id = user_id_value;
  select login_id into actor from public.profiles where id = auth.uid();
  insert into public.audit_log (actor_login_id, action, details) values (actor, 'attempt_terminated', jsonb_build_object('attempt_id', _attempt_id, 'contest_id', attempt_contest_id, 'user_id', user_id_value));
  return true;
end $$;
revoke all on function public.admin_terminate_attempt(uuid) from public, anon;
grant execute on function public.admin_terminate_attempt(uuid) to authenticated;

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
  if attempt.status <> 'in_progress' then raise exception 'Attempt is not in progress'; end if;
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
