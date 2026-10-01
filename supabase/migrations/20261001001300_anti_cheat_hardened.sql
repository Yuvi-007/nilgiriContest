-- ===== Anti-cheat hardening & strict single-attempt enforcement =====

-- 1. Helper RPC for student to authoritatively check their attempt status on lobby / arena
create or replace function public.get_student_attempt_status(_contest_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  attempt public.contest_attempts;
  contest public.contests;
  deadline timestamptz;
begin
  if auth.uid() is null then
    return jsonb_build_object('status', 'unauthenticated');
  end if;

  select * into contest from public.contests where id = _contest_id and is_draft = false;
  if contest.id is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  select * into attempt from public.contest_attempts
  where contest_id = _contest_id and user_id = auth.uid();

  if attempt.user_id is null then
    return jsonb_build_object(
      'status', 'not_started',
      'contest_status', case
        when now() < contest.start_time then 'scheduled'
        when now() < contest.end_time then 'live'
        else 'closed'
      end
    );
  end if;

  deadline := least(
    attempt.started_at + ((contest.duration_minutes * 60 + attempt.extra_time_sec) || ' seconds')::interval,
    contest.end_time
  );

  return jsonb_build_object(
    'status', attempt.status,
    'attempt_id', attempt.id,
    'started_at', attempt.started_at,
    'submitted_at', attempt.submitted_at,
    'deadline', deadline,
    'violations', attempt.violations,
    'score', attempt.score,
    'is_submitted', (attempt.status = 'submitted' or attempt.submitted_at is not null)
  );
end $$;

revoke all on function public.get_student_attempt_status(uuid) from public, anon;
grant execute on function public.get_student_attempt_status(uuid) to authenticated;

-- 2. Enhanced get_contest_questions: prevent leaking questions if attempt already submitted
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
language plpgsql stable security definer set search_path = public as $$
declare
  is_admin boolean;
  contest_rec public.contests;
  attempt_rec public.contest_attempts;
begin
  if auth.uid() is null then
    return;
  end if;

  is_admin := public.has_role(auth.uid(), 'admin');

  select * into contest_rec from public.contests
  where contests.id = _contest_id and (contests.is_draft = false or is_admin);

  if contest_rec.id is null then
    return;
  end if;

  -- Admin can always view questions
  if is_admin then
    return query
      select cq.position, q.id, q.type, q.difficulty, q.marks, q.title, q.body, q.options
      from public.contest_questions cq
      join public.questions q on q.id = cq.question_id
      where cq.contest_id = _contest_id
      order by cq.position;
    return;
  end if;

  -- If contest is closed, questions are accessible
  if now() >= contest_rec.end_time then
    return query
      select cq.position, q.id, q.type, q.difficulty, q.marks, q.title, q.body, q.options
      from public.contest_questions cq
      join public.questions q on q.id = cq.question_id
      where cq.contest_id = _contest_id
      order by cq.position;
    return;
  end if;

  -- If contest is live, student MUST have an active (in_progress) attempt
  select * into attempt_rec from public.contest_attempts
  where contest_id = _contest_id and user_id = auth.uid();

  -- If student already submitted, LOCK questions to prevent sharing/collusion while contest is still live
  if attempt_rec.status = 'submitted' or attempt_rec.submitted_at is not null then
    raise exception 'Attempt already submitted; questions are locked until contest closes.';
  end if;

  -- If student hasn't started or is terminated, do not expose questions
  if attempt_rec.id is null or attempt_rec.status <> 'in_progress' then
    raise exception 'You must enter the contest through the lobby to access questions.';
  end if;

  return query
    select cq.position, q.id, q.type, q.difficulty, q.marks, q.title, q.body, q.options
    from public.contest_questions cq
    join public.questions q on q.id = cq.question_id
    where cq.contest_id = _contest_id
    order by cq.position;
end $$;

revoke all on function public.get_contest_questions(uuid) from public, anon;
grant execute on function public.get_contest_questions(uuid) to authenticated;
