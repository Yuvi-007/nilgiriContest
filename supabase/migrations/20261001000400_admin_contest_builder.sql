-- ===== Admin contest builder RPCs =====
create or replace function public.admin_create_draft_contest(
  _title text,
  _description text,
  _start_time timestamptz,
  _end_time timestamptz,
  _duration_minutes int,
  _is_practice boolean default false
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  contest_id uuid;
  actor text;
begin
  if auth.uid() is null or not public.has_role(auth.uid(), 'admin') then
    raise exception 'Admin access required';
  end if;
  insert into public.contests (title, description, start_time, end_time, duration_minutes, is_draft, is_practice)
    values (_title, _description, _start_time, _end_time, _duration_minutes, true, _is_practice)
    returning id into contest_id;
  select login_id into actor from public.profiles where id = auth.uid();
  insert into public.audit_log (actor_login_id, action, details)
    values (actor, 'contest_created', jsonb_build_object('contest_id', contest_id));
  return contest_id;
end $$;
revoke all on function public.admin_create_draft_contest(text, text, timestamptz, timestamptz, int, boolean) from public, anon;
grant execute on function public.admin_create_draft_contest(text, text, timestamptz, timestamptz, int, boolean) to authenticated;

create or replace function public.admin_set_contest_questions(
  _contest_id uuid,
  _question_ids uuid[]
)
returns int
language plpgsql security definer set search_path = public as $$
declare
  actor text;
  question_count int;
begin
  if auth.uid() is null or not public.has_role(auth.uid(), 'admin') then
    raise exception 'Admin access required';
  end if;
  if not exists (select 1 from public.contests where id = _contest_id and is_draft = true) then
    raise exception 'Only draft contests can be edited';
  end if;
  select count(*) into question_count from unnest(_question_ids);
  if question_count <> 8 then raise exception 'Select exactly 8 questions'; end if;
  if exists (select 1 from unnest(_question_ids) qid where not exists (select 1 from public.questions q where q.id = qid)) then
    raise exception 'One or more questions do not exist';
  end if;
  delete from public.contest_questions where contest_id = _contest_id;
  insert into public.contest_questions (contest_id, question_id, position)
    select _contest_id, qid, ordinal::int
    from unnest(_question_ids) with ordinality as selected(qid, ordinal);
  select login_id into actor from public.profiles where id = auth.uid();
  insert into public.audit_log (actor_login_id, action, details)
    values (actor, 'contest_questions_updated', jsonb_build_object('contest_id', _contest_id, 'question_count', question_count));
  return question_count;
end $$;
revoke all on function public.admin_set_contest_questions(uuid, uuid[]) from public, anon;
grant execute on function public.admin_set_contest_questions(uuid, uuid[]) to authenticated;

create or replace function public.admin_publish_contest(_contest_id uuid)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  actor text;
begin
  if auth.uid() is null or not public.has_role(auth.uid(), 'admin') then
    raise exception 'Admin access required';
  end if;
  update public.contests set is_draft = false where id = _contest_id and is_draft = true;
  if not found then raise exception 'Only draft contests can be published'; end if;
  select login_id into actor from public.profiles where id = auth.uid();
  insert into public.audit_log (actor_login_id, action, details)
    values (actor, 'contest_published', jsonb_build_object('contest_id', _contest_id));
  return true;
end $$;
revoke all on function public.admin_publish_contest(uuid) from public, anon;
grant execute on function public.admin_publish_contest(uuid) to authenticated;

create or replace function public.admin_clone_contest(_source_id uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  cloned_id uuid;
  actor text;
begin
  if auth.uid() is null or not public.has_role(auth.uid(), 'admin') then
    raise exception 'Admin access required';
  end if;
  insert into public.contests (title, description, start_time, end_time, duration_minutes, is_draft, is_practice, show_solutions_after_close)
    select title || ' (Copy)', description, start_time, end_time, duration_minutes, true, is_practice, show_solutions_after_close
    from public.contests where id = _source_id
    returning id into cloned_id;
  if cloned_id is null then raise exception 'Contest not found'; end if;
  insert into public.contest_questions (contest_id, question_id, position)
    select cloned_id, question_id, position from public.contest_questions where contest_id = _source_id order by position;
  select login_id into actor from public.profiles where id = auth.uid();
  insert into public.audit_log (actor_login_id, action, details)
    values (actor, 'contest_cloned', jsonb_build_object('source_id', _source_id, 'contest_id', cloned_id));
  return cloned_id;
end $$;
revoke all on function public.admin_clone_contest(uuid) from public, anon;
grant execute on function public.admin_clone_contest(uuid) to authenticated;
