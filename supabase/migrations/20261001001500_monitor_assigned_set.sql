-- ===== Add assigned_set to admin_contest_monitor =====
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
  deadline timestamptz,
  assigned_set text
)
language sql stable security definer set search_path = public as $$
  select a.id, p.id, p.login_id, p.full_name,
    coalesce(cp.status, case when a.status = 'submitted' then 'submitted' when a.status = 'terminated' then 'terminated' else 'not_started' end),
    a.started_at, cp.last_seen_at, coalesce(cp.violations, a.violations, 0), cp.submitted_at,
    case when a.answers is null then 0 else (select count(*) from jsonb_object_keys(a.answers))::int end,
    coalesce(a.extra_time_sec, 0),
    case when a.started_at is null then null else least(a.started_at + ((c.duration_minutes * 60 + a.extra_time_sec) || ' seconds')::interval, c.end_time) end,
    coalesce(a.assigned_set, '—')
  from public.profiles p
  join public.user_roles ur on ur.user_id = p.id and ur.role = 'student'
  cross join public.contests c
  left join public.contest_attempts a on a.contest_id = c.id and a.user_id = p.id
  left join public.contest_presence cp on cp.contest_id = c.id and cp.user_id = p.id
  where c.id = _contest_id and public.has_role(auth.uid(), 'admin')
  order by coalesce(cp.last_seen_at, a.started_at, p.created_at) desc;
$$;

revoke all on function public.admin_contest_monitor(uuid) from public, anon;
grant execute on function public.admin_contest_monitor(uuid) to authenticated;
