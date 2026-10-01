-- ===== Multi-Set Shuffling & Question Image Support Migration =====

-- 1. Storage bucket for question images and diagrams
insert into storage.buckets (id, name, public)
values ('question-assets', 'question-assets', true)
on conflict (id) do nothing;

create policy "Public Asset View" on storage.objects
for select using (bucket_id = 'question-assets');

create policy "Admin Asset Upload" on storage.objects
for insert to authenticated with check (
  bucket_id = 'question-assets' and public.has_role(auth.uid(), 'admin')
);

create policy "Admin Asset Delete" on storage.objects
for delete to authenticated using (
  bucket_id = 'question-assets' and public.has_role(auth.uid(), 'admin')
);

-- 2. Add image_url to questions table
alter table public.questions
  add column if not exists image_url text default null;

-- 3. Add set_code to contest_questions table & update primary key
alter table public.contest_questions
  add column if not exists set_code text not null default 'A';

alter table public.contest_questions drop constraint if exists contest_questions_pkey;
alter table public.contest_questions add primary key (contest_id, question_id, set_code);

-- 4. Add assigned_set to contest_attempts table
alter table public.contest_attempts
  add column if not exists assigned_set text not null default 'A';

-- 5. Update admin_upsert_question to handle image_url
drop function if exists public.admin_upsert_question(uuid, public.question_type, text, text, jsonb, int, public.difficulty, text, jsonb);
drop function if exists public.admin_upsert_question(uuid, public.question_type, text, text, jsonb, int, public.difficulty, text, jsonb, text);

create or replace function public.admin_upsert_question(
  _id uuid default null,
  _type public.question_type default 'mcq',
  _title text default '',
  _body text default '',
  _options jsonb default null,
  _correct_option int default null,
  _difficulty public.difficulty default null,
  _code_language text default 'python',
  _test_cases jsonb default '[]'::jsonb,
  _image_url text default null
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  question_id uuid;
  actor text;
  derived_marks int;
begin
  if auth.uid() is null or not public.has_role(auth.uid(), 'admin') then
    raise exception 'Admin access required';
  end if;
  if length(trim(_title)) = 0 or length(trim(_body)) = 0 then
    raise exception 'Title and body are required';
  end if;
  if _type = 'mcq' then
    if _options is null or jsonb_array_length(_options) < 2 then raise exception 'MCQ needs at least two options'; end if;
    if _correct_option is null or _correct_option < 0 or _correct_option >= jsonb_array_length(_options) then raise exception 'Correct option is invalid'; end if;
    derived_marks := 1;
  else
    if _difficulty is null then raise exception 'Coding question needs a difficulty'; end if;
    derived_marks := case _difficulty when 'easy' then 3 when 'medium' then 5 when 'hard' then 7 end;
  end if;
  if _id is not null and exists (
    select 1 from public.contest_questions cq join public.contests c on c.id = cq.contest_id
    where cq.question_id = _id and c.is_draft = false
  ) then raise exception 'Questions in published contests are locked'; end if;

  if _id is null then
    insert into public.questions (type, difficulty, marks, title, body, options, correct_option, code_language, test_cases, image_url)
      values (_type, case when _type = 'coding' then _difficulty else null end, derived_marks, trim(_title), _body,
        case when _type = 'mcq' then _options else null end,
        case when _type = 'mcq' then _correct_option else null end,
        case when _type = 'coding' then _code_language else 'python' end,
        case when _type = 'coding' then _test_cases else '[]'::jsonb end,
        _image_url)
      returning id into question_id;
  else
    update public.questions set
      type = _type,
      difficulty = case when _type = 'coding' then _difficulty else null end,
      marks = derived_marks,
      title = trim(_title),
      body = _body,
      options = case when _type = 'mcq' then _options else null end,
      correct_option = case when _type = 'mcq' then _correct_option else null end,
      code_language = case when _type = 'coding' then _code_language else 'python' end,
      test_cases = case when _type = 'coding' then _test_cases else '[]'::jsonb end,
      image_url = _image_url
      where id = _id
      returning id into question_id;
    if question_id is null then raise exception 'Question not found'; end if;
  end if;

  select login_id into actor from public.profiles where id = auth.uid();
  insert into public.audit_log (actor_login_id, action, details)
    values (actor, case when _id is null then 'question_created' else 'question_updated' end,
            jsonb_build_object('question_id', question_id, 'type', _type, 'marks', derived_marks, 'has_image', _image_url is not null));
  return question_id;
end $$;

revoke all on function public.admin_upsert_question(uuid, public.question_type, text, text, jsonb, int, public.difficulty, text, jsonb, text) from public, anon;
grant execute on function public.admin_upsert_question(uuid, public.question_type, text, text, jsonb, int, public.difficulty, text, jsonb, text) to authenticated;

-- 6. RPC: admin_set_contest_questions supporting sets (e.g. 'A', 'B', 'C')
drop function if exists public.admin_set_contest_questions(uuid, uuid[]);
drop function if exists public.admin_set_contest_questions(uuid, uuid[], text);

create or replace function public.admin_set_contest_questions(
  _contest_id uuid,
  _question_ids uuid[],
  _set_code text default 'A'
)
returns int
language plpgsql security definer set search_path = public as $$
declare
  actor text;
  question_count int;
  valid_set text;
begin
  if auth.uid() is null or not public.has_role(auth.uid(), 'admin') then
    raise exception 'Admin access required';
  end if;
  if not exists (select 1 from public.contests where id = _contest_id and is_draft = true) then
    raise exception 'Only draft contests can be edited';
  end if;
  valid_set := upper(coalesce(trim(_set_code), 'A'));
  if valid_set not in ('A', 'B', 'C') then
    raise exception 'Set code must be A, B, or C';
  end if;

  select count(*) into question_count from unnest(_question_ids);
  if question_count <> 8 then raise exception 'Select exactly 8 questions for Set %', valid_set; end if;
  if exists (select 1 from unnest(_question_ids) qid where not exists (select 1 from public.questions q where q.id = qid)) then
    raise exception 'One or more questions do not exist';
  end if;

  delete from public.contest_questions where contest_id = _contest_id and set_code = valid_set;
  insert into public.contest_questions (contest_id, question_id, position, set_code)
    select _contest_id, qid, ordinal::int, valid_set
    from unnest(_question_ids) with ordinality as selected(qid, ordinal);

  select login_id into actor from public.profiles where id = auth.uid();
  insert into public.audit_log (actor_login_id, action, details)
    values (actor, 'contest_questions_updated', jsonb_build_object('contest_id', _contest_id, 'set_code', valid_set, 'question_count', question_count));
  return question_count;
end $$;

revoke all on function public.admin_set_contest_questions(uuid, uuid[], text) from public, anon;
grant execute on function public.admin_set_contest_questions(uuid, uuid[], text) to authenticated;

-- 7. RPC: admin_auto_generate_sets (auto-shuffles Set A into Sets B and C)
create or replace function public.admin_auto_generate_sets(_contest_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  a_count int;
  actor text;
begin
  if auth.uid() is null or not public.has_role(auth.uid(), 'admin') then
    raise exception 'Admin access required';
  end if;
  if not exists (select 1 from public.contests where id = _contest_id and is_draft = true) then
    raise exception 'Only draft contests can be edited';
  end if;

  select count(*) into a_count from public.contest_questions where contest_id = _contest_id and set_code = 'A';
  if a_count <> 8 then
    raise exception 'Please configure Set A with all 8 questions first before auto-generating Sets B & C';
  end if;

  -- Clear any existing B and C sets
  delete from public.contest_questions where contest_id = _contest_id and set_code in ('B', 'C');

  -- Generate Set B: Shuffle MCQs (positions 1-5) and shuffle Coding (positions 6-8)
  insert into public.contest_questions (contest_id, question_id, position, set_code)
    select _contest_id, cq.question_id, row_number() over (order by random())::int as position, 'B'
    from public.contest_questions cq
    join public.questions q on q.id = cq.question_id
    where cq.contest_id = _contest_id and cq.set_code = 'A' and q.type = 'mcq';

  insert into public.contest_questions (contest_id, question_id, position, set_code)
    select _contest_id, cq.question_id, 5 + row_number() over (order by random())::int as position, 'B'
    from public.contest_questions cq
    join public.questions q on q.id = cq.question_id
    where cq.contest_id = _contest_id and cq.set_code = 'A' and q.type = 'coding';

  -- Generate Set C: Different shuffle
  insert into public.contest_questions (contest_id, question_id, position, set_code)
    select _contest_id, cq.question_id, row_number() over (order by random())::int as position, 'C'
    from public.contest_questions cq
    join public.questions q on q.id = cq.question_id
    where cq.contest_id = _contest_id and cq.set_code = 'A' and q.type = 'mcq';

  insert into public.contest_questions (contest_id, question_id, position, set_code)
    select _contest_id, cq.question_id, 5 + row_number() over (order by random())::int as position, 'C'
    from public.contest_questions cq
    join public.questions q on q.id = cq.question_id
    where cq.contest_id = _contest_id and cq.set_code = 'A' and q.type = 'coding';

  select login_id into actor from public.profiles where id = auth.uid();
  insert into public.audit_log (actor_login_id, action, details)
    values (actor, 'contest_sets_auto_generated', jsonb_build_object('contest_id', _contest_id));

  return jsonb_build_object('success', true, 'message', 'Sets B and C generated with shuffled permutations.');
end $$;

revoke all on function public.admin_auto_generate_sets(uuid) from public, anon;
grant execute on function public.admin_auto_generate_sets(uuid) to authenticated;

-- 8. RPC: admin_get_contest_questions to inspect all sets of a contest
create or replace function public.admin_get_contest_questions(_contest_id uuid)
returns table (
  set_code text,
  "position" int,
  question_id uuid,
  title text,
  type public.question_type,
  difficulty public.difficulty,
  marks int,
  image_url text
)
language sql security definer set search_path = public as $$
  select cq.set_code, cq.position, q.id, q.title, q.type, q.difficulty, q.marks, q.image_url
  from public.contest_questions cq
  join public.questions q on q.id = cq.question_id
  where cq.contest_id = _contest_id
  order by cq.set_code, cq.position;
$$;

revoke all on function public.admin_get_contest_questions(uuid) from public, anon;
grant execute on function public.admin_get_contest_questions(uuid) to authenticated;

-- 9. Update validate_contest to validate every configured set (A, B, C)
create or replace function public.validate_contest()
returns trigger language plpgsql set search_path = public as $$
declare
  s text;
  total int; mcqs int; codes int; kinds int;
begin
  if new.end_time <= new.start_time then raise exception 'End time must be after start time'; end if;
  if new.duration_minutes <= 0 then raise exception 'Duration must be positive'; end if;
  if tg_op = 'UPDATE' and old.is_draft = false and new.is_draft = true then
    raise exception 'Published contests cannot return to draft; clone instead';
  end if;
  if new.is_draft = false and (tg_op = 'INSERT' or old.is_draft = true) then
    if not exists (select 1 from public.contest_questions where contest_id = new.id and set_code = 'A') then
      raise exception 'Contest must have Set A configured before publishing';
    end if;

    for s in select distinct set_code from public.contest_questions where contest_id = new.id loop
      select coalesce(sum(q.marks),0), count(*) filter (where q.type='mcq'),
             count(*) filter (where q.type='coding'), count(distinct q.difficulty) filter (where q.type='coding')
        into total, mcqs, codes, kinds
        from public.contest_questions cq join public.questions q on q.id = cq.question_id
        where cq.contest_id = new.id and cq.set_code = s;
      if total <> 20 or mcqs <> 5 or codes <> 3 or kinds <> 3 then
        raise exception 'Set % must have 5 MCQs + 3 coding (Easy/Medium/Hard) totalling 20 marks (found % marks in Set %)', s, total, s;
      end if;
    end loop;
  end if;
  return new;
end $$;

-- 10. Update start_contest_attempt_v2 to assign student to a set (A, B, or C)
create or replace function public.start_contest_attempt_v2(_contest_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  attempt public.contest_attempts;
  contest public.contests;
  deadline timestamptz;
  available_sets text[];
  chosen_set text;
begin
  if auth.uid() is null or not public.has_role(auth.uid(), 'student') then raise exception 'Only students can start attempts'; end if;
  select * into contest from public.contests where id = _contest_id and is_draft = false;
  if contest.id is null or contest.start_time > now() or contest.end_time <= now() then raise exception 'Contest is not live'; end if;

  select array_agg(distinct set_code order by set_code) into available_sets
  from public.contest_questions where contest_id = _contest_id;

  if available_sets is null or array_length(available_sets, 1) = 0 then
    available_sets := array['A'];
  end if;

  -- Deterministically & fairly distribute students among available sets
  chosen_set := available_sets[1 + (abs(hashtext(auth.uid()::text || _contest_id::text)) % array_length(available_sets, 1))];

  insert into public.contest_attempts (contest_id, user_id, assigned_set)
    values (_contest_id, auth.uid(), chosen_set)
    on conflict (contest_id, user_id) do nothing;

  select * into attempt from public.contest_attempts where contest_id = _contest_id and user_id = auth.uid() for update;
  if attempt.status = 'submitted' then raise exception 'Attempt already submitted'; end if;

  update public.contest_attempts set last_seen_at = now() where id = attempt.id;
  deadline := least(attempt.started_at + ((contest.duration_minutes * 60 + attempt.extra_time_sec) || ' seconds')::interval, contest.end_time);

  return jsonb_build_object(
    'attemptId', attempt.id,
    'assignedSet', coalesce(attempt.assigned_set, chosen_set),
    'startedAt', attempt.started_at,
    'deadline', deadline,
    'answers', attempt.answers,
    'violations', attempt.violation_events
  );
end $$;

revoke all on function public.start_contest_attempt_v2(uuid) from public, anon;
grant execute on function public.start_contest_attempt_v2(uuid) to authenticated;

-- 11. Update get_contest_questions to deliver the student's assigned set + include image_url
drop function if exists public.get_contest_questions(uuid);

create or replace function public.get_contest_questions(_contest_id uuid)
returns table (
  "position" int,
  id uuid,
  type public.question_type,
  difficulty public.difficulty,
  marks int,
  title text,
  body text,
  options jsonb,
  image_url text,
  set_code text
)
language plpgsql stable security definer set search_path = public as $$
declare
  is_admin boolean;
  contest_rec public.contests;
  attempt_rec public.contest_attempts;
  target_set text;
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

  if is_admin then
    return query
      select cq.position, q.id, q.type, q.difficulty, q.marks, q.title, q.body, q.options, q.image_url, cq.set_code
      from public.contest_questions cq
      join public.questions q on q.id = cq.question_id
      where cq.contest_id = _contest_id
      order by cq.set_code, cq.position;
    return;
  end if;

  select * into attempt_rec from public.contest_attempts
  where contest_id = _contest_id and user_id = auth.uid();

  target_set := coalesce(attempt_rec.assigned_set, 'A');

  if now() >= contest_rec.end_time then
    return query
      select cq.position, q.id, q.type, q.difficulty, q.marks, q.title, q.body, q.options, q.image_url, cq.set_code
      from public.contest_questions cq
      join public.questions q on q.id = cq.question_id
      where cq.contest_id = _contest_id and cq.set_code = target_set
      order by cq.position;
    return;
  end if;

  if attempt_rec.status = 'submitted' or attempt_rec.submitted_at is not null then
    raise exception 'Attempt already submitted; questions are locked until contest closes.';
  end if;

  if attempt_rec.id is null or attempt_rec.status <> 'in_progress' then
    raise exception 'You must enter the contest through the lobby to access questions.';
  end if;

  return query
    select cq.position, q.id, q.type, q.difficulty, q.marks, q.title, q.body, q.options, q.image_url, cq.set_code
    from public.contest_questions cq
    join public.questions q on q.id = cq.question_id
    where cq.contest_id = _contest_id and cq.set_code = target_set
    order by cq.position;
end $$;

revoke all on function public.get_contest_questions(uuid) from public, anon;
grant execute on function public.get_contest_questions(uuid) to authenticated;

-- 12. Update submit_contest_attempt to evaluate score based on the student's assigned set
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
  student_set text;
begin
  if auth.uid() is null or not public.has_role(auth.uid(), 'student') then raise exception 'Only students can submit attempts'; end if;
  select * into contest from public.contests where id = _contest_id and is_draft = false;
  if contest.id is null then raise exception 'Contest not found'; end if;

  select * into attempt from public.contest_attempts where contest_id = _contest_id and user_id = auth.uid() for update;
  if attempt.id is null then raise exception 'Attempt has not started'; end if;
  if attempt.status = 'submitted' then return jsonb_build_object('score', attempt.score, 'timeTakenSeconds', extract(epoch from (attempt.submitted_at - attempt.started_at))::int); end if;

  deadline := least(attempt.started_at + ((contest.duration_minutes * 60 + attempt.extra_time_sec) || ' seconds')::interval, contest.end_time);
  if now() > deadline + interval '5 seconds' then raise exception 'SUBMISSION_TOO_LATE'; end if;

  student_set := coalesce(attempt.assigned_set, 'A');

  select (coalesce(sum(case when q.type = 'mcq' and (_answers ->> q.id::text) ~ '^[0-9]+$' and (_answers ->> q.id::text)::int = q.correct_option then q.marks else 0 end), 0) + coalesce((select sum(latest.score) from (select distinct on (cs.question_id) cs.score from public.coding_submissions cs where cs.contest_id = _contest_id and cs.user_id = auth.uid() order by cs.question_id, cs.created_at desc) latest), 0))::numeric(5,2) into earned
    from public.contest_questions cq
    join public.questions q on q.id = cq.question_id
    where cq.contest_id = _contest_id and cq.set_code = student_set;

  elapsed := greatest(0, extract(epoch from (now() - attempt.started_at))::int);
  update public.contest_attempts set answers = coalesce(_answers, '{}'::jsonb), submitted_at = now(), status = 'submitted', last_seen_at = now(), violations = greatest(0, _violations), score = earned where id = attempt.id;
  insert into public.contest_results (contest_id, user_id, score, time_taken_seconds, submitted_at) values (_contest_id, auth.uid(), earned, elapsed, now()) on conflict (contest_id, user_id) do update set score = excluded.score, time_taken_seconds = excluded.time_taken_seconds, submitted_at = excluded.submitted_at;
  insert into public.contest_presence (contest_id, user_id, status, started_at, last_seen_at, violations, submitted_at) values (_contest_id, auth.uid(), 'submitted', attempt.started_at, now(), greatest(0, _violations), now()) on conflict (contest_id, user_id) do update set status = 'submitted', last_seen_at = now(), violations = greatest(public.contest_presence.violations, excluded.violations), submitted_at = now();
  return jsonb_build_object('score', earned, 'timeTakenSeconds', elapsed, 'deadline', deadline, 'assignedSet', student_set);
end $$;

revoke all on function public.submit_contest_attempt(uuid, jsonb, int) from public, anon;
grant execute on function public.submit_contest_attempt(uuid, jsonb, int) to authenticated;
