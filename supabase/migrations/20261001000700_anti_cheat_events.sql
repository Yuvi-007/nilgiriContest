-- ===== Anti-cheat event history =====
create table public.contest_violations (
  id uuid primary key default gen_random_uuid(),
  contest_id uuid not null references public.contests(id) on delete cascade,
  user_id uuid not null,
  event_type text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
grant select on public.contest_violations to authenticated;
grant all on public.contest_violations to service_role;
alter table public.contest_violations enable row level security;
create policy "own violations readable" on public.contest_violations for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create index contest_violations_monitor_idx on public.contest_violations (contest_id, created_at desc);

create or replace function public.record_contest_violation(
  _contest_id uuid,
  _event_type text,
  _details jsonb default '{}'::jsonb
)
returns int
language plpgsql security definer set search_path = public as $$
declare
  current_count int;
  actor text;
begin
  if auth.uid() is null or not public.has_role(auth.uid(), 'student') then raise exception 'Student access required'; end if;
  if not exists (select 1 from public.contest_attempts where contest_id = _contest_id and user_id = auth.uid() and submitted_at is null) then raise exception 'Attempt is not active'; end if;
  insert into public.contest_violations (contest_id, user_id, event_type, details)
    values (_contest_id, auth.uid(), left(_event_type, 80), coalesce(_details, '{}'::jsonb));
  update public.contest_presence
    set violations = violations + 1, last_seen_at = now()
    where contest_id = _contest_id and user_id = auth.uid();
  select violations into current_count from public.contest_presence where contest_id = _contest_id and user_id = auth.uid();
  select login_id into actor from public.profiles where id = auth.uid();
  insert into public.audit_log (actor_login_id, action, details)
    values (actor, 'contest_violation', jsonb_build_object('contest_id', _contest_id, 'event_type', _event_type, 'details', coalesce(_details, '{}'::jsonb)));
  return coalesce(current_count, 1);
end $$;
revoke all on function public.record_contest_violation(uuid, text, jsonb) from public, anon;
grant execute on function public.record_contest_violation(uuid, text, jsonb) to authenticated;
