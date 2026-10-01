-- ===== Coding judge foundation =====
alter table public.questions
  add column if not exists code_language text not null default 'python',
  add column if not exists test_cases jsonb not null default '[]'::jsonb;

update public.questions
set test_cases = case title
  when 'Sum of Evens' then '[
    {"input":"1 2 3 4 5 6","expected_output":"12"},
    {"input":"0 -2 7 9","expected_output":"-2"}
  ]'::jsonb
  when 'Balanced Brackets' then '[
    {"input":"()[]{}","expected_output":"YES"},
    {"input":"([)]","expected_output":"NO"}
  ]'::jsonb
  when 'Shortest Path in Grid' then '[
    {"input":"3 3\nS..\n.#.\n..E","expected_output":"4"},
    {"input":"2 2\nS#\n#E","expected_output":"-1"}
  ]'::jsonb
  else test_cases
end
where type = 'coding';

create table public.coding_submissions (
  id uuid primary key default gen_random_uuid(),
  contest_id uuid not null references public.contests(id) on delete cascade,
  user_id uuid not null,
  question_id uuid not null references public.questions(id) on delete restrict,
  source_code text not null,
  language_id int not null,
  status text not null,
  passed_tests int not null default 0,
  total_tests int not null default 0,
  score numeric(5,2) not null default 0,
  stdout text,
  stderr text,
  created_at timestamptz not null default now()
);
grant select on public.coding_submissions to authenticated;
grant all on public.coding_submissions to service_role;
alter table public.coding_submissions enable row level security;
create policy "own coding submissions readable" on public.coding_submissions for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

create index coding_submissions_attempt_idx
  on public.coding_submissions (contest_id, user_id, question_id, created_at desc);

-- Include the latest coding score for each question in the final contest score.
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

  select (
    coalesce(sum(case
      when q.type = 'mcq' and (_answers ->> q.id::text) ~ '^[0-9]+$'
        and (_answers ->> q.id::text)::int = q.correct_option then q.marks
      else 0 end), 0)
    + coalesce((
      select sum(latest.score)
      from (
        select distinct on (cs.question_id) cs.score
        from public.coding_submissions cs
        where cs.contest_id = _contest_id and cs.user_id = auth.uid()
        order by cs.question_id, cs.created_at desc
      ) latest
    ), 0)
  )::numeric(5,2)
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
