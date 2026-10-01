-- ============================================================
-- Demo data seed: 5 extra students, 2 closed contests with
-- results, and audit log entries for frontend preview.
-- ============================================================
begin;

-- ----------------------------------------------------------
-- 1. Extra students (STU003..STU007)
-- ----------------------------------------------------------
do $$
declare
  u   record;
  uid uuid;
begin
  for u in select * from (values
    ('STU003', 'Priya Sharma',   'Student@nilgiri', true),
    ('STU004', 'Arjun Mehta',    'Student@nilgiri', true),
    ('STU005', 'Kavya Reddy',    'Student@nilgiri', true),
    ('STU006', 'Rohan Verma',    'Student@nilgiri', true),
    ('STU007', 'Sneha Patil',    'Student@nilgiri', true)
  ) as t(login_id, full_name, pw, must_change)
  loop
    if exists (select 1 from auth.users where email = lower(u.login_id) || '@nilgiri.local') then
      continue;
    end if;
    uid := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role,
      email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, recovery_token,
      email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
      lower(u.login_id) || '@nilgiri.local',
      extensions.crypt(u.pw, extensions.gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('login_id', u.login_id),
      now(), now(), '', '', '', ''
    );
    insert into auth.identities (
      id, provider_id, user_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), uid::text, uid,
      jsonb_build_object('sub', uid::text, 'email', lower(u.login_id) || '@nilgiri.local', 'email_verified', true),
      'email', now(), now(), now()
    );
    insert into public.profiles (id, login_id, full_name, must_change_password)
      values (uid, u.login_id, u.full_name, u.must_change);
    insert into public.user_roles (user_id, role) values (uid, 'student');
  end loop;
end $$;

-- ----------------------------------------------------------
-- 2. Contest 1: "Introduction to Algorithms" (closed)
--    Insert as draft first, link questions, then publish
-- ----------------------------------------------------------
do $$
declare
  q  uuid[] := array[]::uuid[];
  qid uuid;
  cid uuid := '11111111-aaaa-4aaa-aaaa-111111111111';
  i   int;
  s1 uuid; s2 uuid; s3 uuid; s4 uuid; s5 uuid; s6 uuid; s7 uuid;
begin
  if exists (select 1 from public.contests where id = cid) then return; end if;

  -- 5 MCQs
  insert into public.questions (type, marks, title, body, options, correct_option) values
    ('mcq',1,'Python dict lookup','Avg-case time complexity of dict key lookup?','["O(n)","O(log n)","O(1)","O(n^2)"]',2) returning id into qid; q := q || qid;
  insert into public.questions (type, marks, title, body, options, correct_option) values
    ('mcq',1,'Stack principle','Which principle does a stack follow?','["FIFO","LIFO","FILO","Random"]',1) returning id into qid; q := q || qid;
  insert into public.questions (type, marks, title, body, options, correct_option) values
    ('mcq',1,'Binary tree height','Height of a complete binary tree with n nodes?','["O(n)","O(log n)","O(n log n)","O(1)"]',1) returning id into qid; q := q || qid;
  insert into public.questions (type, marks, title, body, options, correct_option) values
    ('mcq',1,'Greedy choice','Greedy choice property means picking:','["All subproblems","Locally optimal choice","Backtrack first","Memoization"]',1) returning id into qid; q := q || qid;
  insert into public.questions (type, marks, title, body, options, correct_option) values
    ('mcq',1,'Linked list head delete','Time to delete the head node of a singly linked list?','["O(n)","O(log n)","O(1)","O(n^2)"]',2) returning id into qid; q := q || qid;
  -- 3 coding
  insert into public.questions (type, difficulty, marks, title, body) values
    ('coding','easy',3,'Sum of Array','Given n integers, print their sum.') returning id into qid; q := q || qid;
  insert into public.questions (type, difficulty, marks, title, body) values
    ('coding','medium',5,'Fibonacci Nth Term','Print the Nth Fibonacci number (F(1)=1, F(2)=1).') returning id into qid; q := q || qid;
  insert into public.questions (type, difficulty, marks, title, body) values
    ('coding','hard',7,'Maximum Subarray Sum','Find the maximum subarray sum. Input may include negatives (Kadane algorithm).') returning id into qid; q := q || qid;

  -- Insert as DRAFT first (bypasses publish validation trigger)
  insert into public.contests (id, title, description, start_time, end_time, duration_minutes, is_draft, is_practice, show_solutions_after_close)
    values (cid, 'Introduction to Algorithms',
      'Beginner-friendly contest covering arrays, stacks, queues, and basic coding challenges.',
      now() - interval '10 days', now() - interval '10 days' + interval '90 minutes',
      90, true, false, true);

  for i in 1..8 loop
    insert into public.contest_questions (contest_id, question_id, position) values (cid, q[i], i) on conflict do nothing;
  end loop;

  -- Now publish (trigger will validate and pass since we have correct structure)
  update public.contests set is_draft = false where id = cid;

  -- Results
  select id into s1 from public.profiles where login_id = 'STU001';
  select id into s2 from public.profiles where login_id = 'STU002';
  select id into s3 from public.profiles where login_id = 'STU003';
  select id into s4 from public.profiles where login_id = 'STU004';
  select id into s5 from public.profiles where login_id = 'STU005';
  select id into s6 from public.profiles where login_id = 'STU006';
  select id into s7 from public.profiles where login_id = 'STU007';

  insert into public.contest_results (contest_id, user_id, score, time_taken_seconds, submitted_at) values
    (cid, s1, 17, 2520, now() - interval '10 days' + interval '42 minutes'),
    (cid, s2, 15, 3300, now() - interval '10 days' + interval '55 minutes'),
    (cid, s3, 18, 2280, now() - interval '10 days' + interval '38 minutes'),
    (cid, s4, 14, 4200, now() - interval '10 days' + interval '70 minutes'),
    (cid, s5, 16, 2880, now() - interval '10 days' + interval '48 minutes'),
    (cid, s6, 12, 4800, now() - interval '10 days' + interval '80 minutes'),
    (cid, s7, 19, 2100, now() - interval '10 days' + interval '35 minutes')
  on conflict do nothing;
end $$;

-- ----------------------------------------------------------
-- 3. Contest 2: "Data Structures Sprint" (closed)
-- ----------------------------------------------------------
do $$
declare
  q  uuid[] := array[]::uuid[];
  qid uuid;
  cid uuid := '22222222-bbbb-4bbb-bbbb-222222222222';
  i   int;
  s1 uuid; s2 uuid; s3 uuid; s4 uuid; s5 uuid; s6 uuid; s7 uuid;
begin
  if exists (select 1 from public.contests where id = cid) then return; end if;

  -- 5 MCQs
  insert into public.questions (type, marks, title, body, options, correct_option) values
    ('mcq',1,'BFS data structure','BFS uses which data structure internally?','["Stack","Queue","Heap","Array"]',1) returning id into qid; q := q || qid;
  insert into public.questions (type, marks, title, body, options, correct_option) values
    ('mcq',1,'Dynamic programming','DP is best described as:','["Divide and conquer","Greedy with backtracking","Solving overlapping subproblems","Random sampling"]',2) returning id into qid; q := q || qid;
  insert into public.questions (type, marks, title, body, options, correct_option) values
    ('mcq',1,'Amortized complexity','Amortized O(1) means:','["Always O(1)","O(1) on average over many ops","O(1) worst case","O(1) best case"]',1) returning id into qid; q := q || qid;
  insert into public.questions (type, marks, title, body, options, correct_option) values
    ('mcq',1,'Max-heap property','In a max-heap the parent node is:','["Smaller than children","Equal to children","Greater than or equal to children","None of the above"]',2) returning id into qid; q := q || qid;
  insert into public.questions (type, marks, title, body, options, correct_option) values
    ('mcq',1,'Quick sort worst case','Quick sort worst case occurs when:','["Array is sorted","Pivot is median","Array is random","All elements equal"]',0) returning id into qid; q := q || qid;
  -- 3 coding
  insert into public.questions (type, difficulty, marks, title, body) values
    ('coding','easy',3,'Palindrome Check','Print YES if the given string is a palindrome (ignore case), else NO.') returning id into qid; q := q || qid;
  insert into public.questions (type, difficulty, marks, title, body) values
    ('coding','medium',5,'Balanced Brackets','Given a string of brackets ( ) { } [ ], print YES if balanced, else NO.') returning id into qid; q := q || qid;
  insert into public.questions (type, difficulty, marks, title, body) values
    ('coding','hard',7,'Shortest Path BFS','Given an unweighted graph, find shortest path from source to destination. Print -1 if unreachable.') returning id into qid; q := q || qid;

  insert into public.contests (id, title, description, start_time, end_time, duration_minutes, is_draft, is_practice, show_solutions_after_close)
    values (cid, 'Data Structures Sprint',
      'Test your knowledge of heaps, graphs, dynamic programming, and more in this timed sprint.',
      now() - interval '5 days', now() - interval '5 days' + interval '2 hours',
      120, true, false, true);

  for i in 1..8 loop
    insert into public.contest_questions (contest_id, question_id, position) values (cid, q[i], i) on conflict do nothing;
  end loop;

  update public.contests set is_draft = false where id = cid;

  select id into s1 from public.profiles where login_id = 'STU001';
  select id into s2 from public.profiles where login_id = 'STU002';
  select id into s3 from public.profiles where login_id = 'STU003';
  select id into s4 from public.profiles where login_id = 'STU004';
  select id into s5 from public.profiles where login_id = 'STU005';
  select id into s6 from public.profiles where login_id = 'STU006';
  select id into s7 from public.profiles where login_id = 'STU007';

  insert into public.contest_results (contest_id, user_id, score, time_taken_seconds, submitted_at) values
    (cid, s1, 16, 3000, now() - interval '5 days' + interval '50 minutes'),
    (cid, s2, 13, 4500, now() - interval '5 days' + interval '75 minutes'),
    (cid, s3, 15, 2700, now() - interval '5 days' + interval '45 minutes'),
    (cid, s4, 11, 5400, now() - interval '5 days' + interval '90 minutes'),
    (cid, s5, 18, 2400, now() - interval '5 days' + interval '40 minutes'),
    (cid, s6, 14, 3600, now() - interval '5 days' + interval '60 minutes'),
    (cid, s7, 17, 2200, now() - interval '5 days' + interval '37 minutes')
  on conflict do nothing;
end $$;

-- ----------------------------------------------------------
-- 4. Audit log entries
-- ----------------------------------------------------------
insert into public.audit_log (actor_login_id, action, details, created_at) values
  ('ADMIN',  'contest_published',   '{"title":"Introduction to Algorithms"}',          now() - interval '11 days'),
  ('STU003', 'login_success',       '{"ip":"192.168.1.10"}',                           now() - interval '10 days' - interval '5 minutes'),
  ('STU007', 'login_success',       '{"ip":"192.168.1.14"}',                           now() - interval '10 days' - interval '3 minutes'),
  ('STU001', 'login_success',       '{"ip":"192.168.1.11"}',                           now() - interval '10 days' - interval '2 minutes'),
  ('STU004', 'login_failed',        '{"ip":"192.168.1.13","attempts":1}',              now() - interval '10 days' - interval '1 minute'),
  ('STU004', 'login_success',       '{"ip":"192.168.1.13"}',                           now() - interval '10 days'),
  ('ADMIN',  'extra_time_granted',  '{"student":"STU002","minutes":10}',               now() - interval '10 days' + interval '30 minutes'),
  ('STU005', 'login_locked',        '{"ip":"192.168.1.12","attempts":5}',              now() - interval '10 days' + interval '1 hour'),
  ('ADMIN',  'unlock_student',      '{"login_id":"STU005"}',                           now() - interval '10 days' + interval '65 minutes'),
  ('ADMIN',  'student_created',     '{"login_id":"STU007","full_name":"Sneha Patil"}', now() - interval '7 days'),
  ('ADMIN',  'contest_published',   '{"title":"Data Structures Sprint"}',              now() - interval '6 days'),
  ('STU001', 'login_success',       '{"ip":"192.168.1.11"}',                           now() - interval '5 days' - interval '10 minutes'),
  ('STU005', 'login_success',       '{"ip":"192.168.1.12"}',                           now() - interval '5 days' - interval '8 minutes'),
  ('STU006', 'login_success',       '{"ip":"192.168.1.15"}',                           now() - interval '5 days' - interval '5 minutes'),
  ('ADMIN',  'submission_reopened', '{"student":"STU006","extra_minutes":10}',         now() - interval '5 days' + interval '80 minutes'),
  ('ADMIN',  'password_reset',      '{"login_id":"STU004"}',                          now() - interval '3 days'),
  ('STU002', 'login_success',       '{"ip":"192.168.1.16"}',                          now() - interval '1 day'),
  ('system', 'demo_seed',           '{"note":"Demo data seeded for frontend preview"}', now());

commit;
