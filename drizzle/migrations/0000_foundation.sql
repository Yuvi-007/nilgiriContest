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

-- ===== Seed: users =====
do $$
declare
  u record;
  uid uuid;
begin
  for u in select * from (values
    ('ADMIN001','Nilgiri Admin','admin','Admin@123', false),
    ('STU001','Aarav Sharma','student','Student@123', false),
    ('STU002','Diya Nair','student','Student@123', true),
    ('STU003','Kabir Menon','student','Student@123', true),
    ('STU004','Ananya Iyer','student','Student@123', true),
    ('STU005','Rohan Das','student','Student@123', true),
    ('STU006','Meera Pillai','student','Student@123', true),
    ('STU007','Arjun Reddy','student','Student@123', true),
    ('STU008','Isha Kapoor','student','Student@123', true)
  ) as t(login_id, full_name, role, pw, must_change)
  loop
    uid := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change)
    values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
      lower(u.login_id) || '@nilgiri.local', extensions.crypt(u.pw, extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('login_id', u.login_id),
      now(), now(), '', '', '', '');
    insert into auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), uid::text, uid,
      jsonb_build_object('sub', uid::text, 'email', lower(u.login_id) || '@nilgiri.local', 'email_verified', true),
      'email', now(), now(), now());
    insert into public.profiles (id, login_id, full_name, must_change_password) values (uid, u.login_id, u.full_name, u.must_change);
    insert into public.user_roles (user_id, role) values (uid, u.role::public.app_role);
  end loop;
end $$;

-- ===== Seed: questions, contests, results =====
do $$
declare
  q uuid[] := array[]::uuid[];
  qid uuid;
  c_closed uuid := gen_random_uuid();
  c_live uuid := gen_random_uuid();
  c_next uuid := gen_random_uuid();
  i int;
begin
  insert into public.questions (type, marks, title, body, options, correct_option) values
    ('mcq',1,'Big-O of binary search','What is the worst-case time complexity of binary search on a sorted array?','["O(n)","O(log n)","O(n log n)","O(1)"]',1) returning id into qid; q := q || qid;
  insert into public.questions (type, marks, title, body, options, correct_option) values
    ('mcq',1,'Stack behaviour','Which data structure follows Last-In-First-Out order?','["Queue","Heap","Stack","Graph"]',2) returning id into qid; q := q || qid;
  insert into public.questions (type, marks, title, body, options, correct_option) values
    ('mcq',1,'Python slicing','What does `"nilgiri"[::-1]` evaluate to?','["irigl in","irigin","nilgiri","irigliN"]',1) returning id into qid; q := q || qid;
  insert into public.questions (type, marks, title, body, options, correct_option) values
    ('mcq',1,'Hash map lookups','Average-case lookup time in a hash map is:','["O(1)","O(log n)","O(n)","O(n^2)"]',0) returning id into qid; q := q || qid;
  insert into public.questions (type, marks, title, body, options, correct_option) values
    ('mcq',1,'Binary tree height','Maximum nodes in a binary tree of height 3 (root at height 0)?','["7","8","15","16"]',2) returning id into qid; q := q || qid;
  insert into public.questions (type, difficulty, marks, title, body) values
    ('coding','easy',3,'Sum of Evens','Given `n` integers, print the sum of all even numbers.') returning id into qid; q := q || qid;
  insert into public.questions (type, difficulty, marks, title, body) values
    ('coding','medium',5,'Balanced Brackets','Given a string of `()[]{}`, print `YES` if it is balanced, else `NO`.') returning id into qid; q := q || qid;
  insert into public.questions (type, difficulty, marks, title, body) values
    ('coding','hard',7,'Shortest Path in Grid','Given an `R x C` grid with walls `#`, print the length of the shortest path from `S` to `E`, or `-1`.') returning id into qid; q := q || qid;

  insert into public.contests (id, title, description, start_time, end_time, is_draft) values
    (c_closed, 'Daily Contest #1', 'Warm-up round: arrays, stacks and graphs.', now() - interval '2 days', now() - interval '2 days' + interval '3 hours', true),
    (c_live, 'Daily Contest #2', 'Open window — start any time, 60 minutes once you begin.', now() - interval '1 hour', now() + interval '14 days', true),
    (c_next, 'Daily Contest #3', 'Next scheduled round.', now() + interval '1 day', now() + interval '1 day' + interval '3 hours', true);

  for i in 1..8 loop
    insert into public.contest_questions (contest_id, question_id, position) values
      (c_closed, q[i], i), (c_live, q[i], i), (c_next, q[i], i);
  end loop;
  update public.contests set is_draft = false where id in (c_closed, c_live, c_next);

  insert into public.contest_results (contest_id, user_id, score, time_taken_seconds, submitted_at)
  select c_closed, p.id, s.score, s.secs, now() - interval '2 days' + (s.secs || ' seconds')::interval
  from public.profiles p join (values
    ('STU001',18.5,2710),('STU002',17,2400),('STU003',17,3120),('STU004',15.2,3300),
    ('STU005',12,2900),('STU006',11.6,3550),('STU007',9,1980),('STU008',6,3600)
  ) as s(login_id, score, secs) on s.login_id = p.login_id;

  insert into public.audit_log (actor_login_id, action, details) values
    ('system','seed','{"note":"Demo data created"}');
end $$;