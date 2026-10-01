-- ===== Admin question CRUD RPCs =====
create or replace function public.admin_upsert_question(
  _id uuid default null,
  _type public.question_type default 'mcq',
  _title text default '',
  _body text default '',
  _options jsonb default null,
  _correct_option int default null,
  _difficulty public.difficulty default null,
  _code_language text default 'python',
  _test_cases jsonb default '[]'::jsonb
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
    insert into public.questions (type, difficulty, marks, title, body, options, correct_option, code_language, test_cases)
      values (_type, case when _type = 'coding' then _difficulty else null end, derived_marks, trim(_title), _body,
        case when _type = 'mcq' then _options else null end,
        case when _type = 'mcq' then _correct_option else null end,
        case when _type = 'coding' then _code_language else 'python' end,
        case when _type = 'coding' then _test_cases else '[]'::jsonb end)
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
      test_cases = case when _type = 'coding' then _test_cases else '[]'::jsonb end
      where id = _id
      returning id into question_id;
    if question_id is null then raise exception 'Question not found'; end if;
  end if;
  select login_id into actor from public.profiles where id = auth.uid();
  insert into public.audit_log (actor_login_id, action, details)
    values (actor, case when _id is null then 'question_created' else 'question_updated' end, jsonb_build_object('question_id', question_id));
  return question_id;
end $$;
revoke all on function public.admin_upsert_question(uuid, public.question_type, text, text, jsonb, int, public.difficulty, text, jsonb) from public, anon;
grant execute on function public.admin_upsert_question(uuid, public.question_type, text, text, jsonb, int, public.difficulty, text, jsonb) to authenticated;

create or replace function public.admin_delete_question(_question_id uuid)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  actor text;
begin
  if auth.uid() is null or not public.has_role(auth.uid(), 'admin') then raise exception 'Admin access required'; end if;
  if exists (select 1 from public.contest_questions where question_id = _question_id) then
    raise exception 'Remove the question from draft contests before deleting it';
  end if;
  delete from public.questions where id = _question_id;
  if not found then raise exception 'Question not found'; end if;
  select login_id into actor from public.profiles where id = auth.uid();
  insert into public.audit_log (actor_login_id, action, details)
    values (actor, 'question_deleted', jsonb_build_object('question_id', _question_id));
  return true;
end $$;
revoke all on function public.admin_delete_question(uuid) from public, anon;
grant execute on function public.admin_delete_question(uuid) to authenticated;
