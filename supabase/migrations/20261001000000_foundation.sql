-- ===== Roles =====
create type public.app_role as enum ('admin', 'student');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "own roles readable" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

-- ===== Profiles =====
create table public.profiles (
  id uuid primary key,
  login_id text not null unique,
  full_name text not null,
  must_change_password boolean not null default true,
  created_at timestamptz not null default now()
);
grant select on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "profiles readable by cohort" on public.profiles for select to authenticated using (true);

-- Users can only clear their own mustChangePassword flag via this function
create or replace function public.mark_password_changed()
returns void language sql security definer set search_path = public as $$
  update public.profiles set must_change_password = false where id = auth.uid();
$$;
revoke all on function public.mark_password_changed() from public, anon;
grant execute on function public.mark_password_changed() to authenticated;

-- ===== Login lockout (server-only) =====
create table public.login_attempts (
  login_id text primary key,
  failed_count int not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);
grant all on public.login_attempts to service_role;
alter table public.login_attempts enable row level security;

-- ===== Audit log =====
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_login_id text,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
grant select on public.audit_log to authenticated;
grant all on public.audit_log to service_role;
alter table public.audit_log enable row level security;
create policy "admin reads audit" on public.audit_log for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- ===== Questions =====
create type public.question_type as enum ('mcq', 'coding');
create type public.difficulty as enum ('easy', 'medium', 'hard');

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  type public.question_type not null,
  difficulty public.difficulty,
  marks int not null,
  title text not null,
  body text not null,
  options jsonb,           -- MCQ: array of strings
  correct_option int,      -- MCQ: index into options (admin only in later phases)
  created_at timestamptz not null default now()
);
grant select on public.questions to authenticated;
grant all on public.questions to service_role;
alter table public.questions enable row level security;
create policy "admin reads questions" on public.questions for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- Marks rule: MCQ = 1; coding easy 3 / medium 5 / hard 7
create or replace function public.validate_question_marks()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.type = 'mcq' and new.marks <> 1 then raise exception 'MCQ must be worth 1 mark'; end if;
  if new.type = 'coding' then
    if new.difficulty is null then raise exception 'Coding question needs a difficulty'; end if;
    if (new.difficulty = 'easy' and new.marks <> 3) or (new.difficulty = 'medium' and new.marks <> 5)
       or (new.difficulty = 'hard' and new.marks <> 7) then
      raise exception 'Coding marks must be Easy 3, Medium 5, Hard 7';
    end if;
  end if;
  return new;
end $$;
create trigger trg_question_marks before insert or update on public.questions
  for each row execute function public.validate_question_marks();

-- ===== Contests =====
-- Status (scheduled/live/closed) is derived from start_time/end_time; only draft is stored.
create table public.contests (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  start_time timestamptz not null,
  end_time timestamptz not null,
  duration_minutes int not null default 60,
  is_draft boolean not null default true,
  is_practice boolean not null default false,
  show_solutions_after_close boolean not null default false,
  created_at timestamptz not null default now()
);
grant select on public.contests to authenticated;
grant all on public.contests to service_role;
alter table public.contests enable row level security;
create policy "published contests visible" on public.contests for select to authenticated
  using (is_draft = false or public.has_role(auth.uid(), 'admin'));

create table public.contest_questions (
  contest_id uuid not null references public.contests(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete restrict,
  position int not null,
  primary key (contest_id, question_id)
);
grant select on public.contest_questions to authenticated;
grant all on public.contest_questions to service_role;
alter table public.contest_questions enable row level security;
create policy "admin reads contest questions" on public.contest_questions for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- Publishing validation: exactly 5 MCQ + 3 coding (one each E/M/H) = 20 marks; locked after publish
create or replace function public.validate_contest()
returns trigger language plpgsql set search_path = public as $$
declare total int; mcqs int; codes int; kinds int;
begin
  if new.end_time <= new.start_time then raise exception 'End time must be after start time'; end if;
  if new.duration_minutes <= 0 then raise exception 'Duration must be positive'; end if;
  if tg_op = 'UPDATE' and old.is_draft = false and new.is_draft = true then
    raise exception 'Published contests cannot return to draft; clone instead';
  end if;
  if new.is_draft = false and (tg_op = 'INSERT' or old.is_draft = true) then
    select coalesce(sum(q.marks),0), count(*) filter (where q.type='mcq'),
           count(*) filter (where q.type='coding'), count(distinct q.difficulty) filter (where q.type='coding')
      into total, mcqs, codes, kinds
      from public.contest_questions cq join public.questions q on q.id = cq.question_id
      where cq.contest_id = new.id;
    if total <> 20 or mcqs <> 5 or codes <> 3 or kinds <> 3 then
      raise exception 'Contest must have 5 MCQs + 3 coding (Easy/Medium/Hard) totalling 20 marks (found %)', total;
    end if;
  end if;
  return new;
end $$;
create trigger trg_contest_validate before insert or update on public.contests
  for each row execute function public.validate_contest();

create or replace function public.lock_contest_questions()
returns trigger language plpgsql set search_path = public as $$
declare cid uuid;
begin
  cid := coalesce(new.contest_id, old.contest_id);
  if exists (select 1 from public.contests where id = cid and is_draft = false) then
    raise exception 'Questions are locked once a contest is published';
  end if;
  return coalesce(new, old);
end $$;
create trigger trg_lock_cq before insert or update or delete on public.contest_questions
  for each row execute function public.lock_contest_questions();

-- ===== Results (for leaderboards) =====
create table public.contest_results (
  contest_id uuid not null references public.contests(id) on delete cascade,
  user_id uuid not null,
  score numeric(5,2) not null default 0,
  time_taken_seconds int not null default 0,
  submitted_at timestamptz not null default now(),
  primary key (contest_id, user_id)
);
grant select on public.contest_results to authenticated;
grant all on public.contest_results to service_role;
alter table public.contest_results enable row level security;
-- Own results always; others' only after the contest closes
create policy "results visibility" on public.contest_results for select to authenticated using (
  user_id = auth.uid() or public.has_role(auth.uid(), 'admin')
  or exists (select 1 from public.contests c where c.id = contest_id and c.end_time < now())
);

-- Public: only the next contest start (for the navbar countdown)
create or replace function public.next_contest_start()
returns timestamptz language sql stable security definer set search_path = public as $$
  select min(start_time) from public.contests where is_draft = false and start_time > now()
$$;
grant execute on function public.next_contest_start() to anon, authenticated;

-- (No seed data — accounts and contests are created via the admin UI or migration 20261001001100)