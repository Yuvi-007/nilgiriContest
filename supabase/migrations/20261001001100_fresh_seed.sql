-- ============================================================
-- Initial seed: creates the first accounts and draft contests.
-- Run once against a fresh Supabase project (schema applied via
-- all preceding migrations).
--
-- Credentials:
--   Admin   login: ADMIN       password: Admin@nilgiri
--   Student login: STU001      password: Student@nilgiri  (must change on first login)
--   Student login: STU002      password: Student@nilgiri  (must change on first login)
--
-- Both contests start as drafts. Publish via Admin --> Contests.
-- ============================================================
begin;

-- ----------------------------------------------------------
-- 1. Accounts
-- ----------------------------------------------------------
do $$
declare
  u   record;
  uid uuid;
begin
  for u in select * from (values
    ('ADMIN',  'Nilgiri Admin', 'admin',   'Admin@nilgiri',   false),
    ('STU001', 'Student One',   'student', 'Student@nilgiri', true),
    ('STU002', 'Student Two',   'student', 'Student@nilgiri', true)
  ) as t(login_id, full_name, role, pw, must_change)
  loop
    uid := gen_random_uuid();

    insert into auth.users (
      instance_id, id, aud, role,
      email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, recovery_token,
      email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000',
      uid, 'authenticated', 'authenticated',
      lower(u.login_id) || '@nilgiri.local',
      extensions.crypt(u.pw, extensions.gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('login_id', u.login_id),
      now(), now(), '', '', '', ''
    );

    insert into auth.identities (
      id, provider_id, user_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), uid::text, uid,
      jsonb_build_object(
        'sub',            uid::text,
        'email',          lower(u.login_id) || '@nilgiri.local',
        'email_verified', true
      ),
      'email', now(), now(), now()
    );

    insert into public.profiles (id, login_id, full_name, must_change_password)
      values (uid, u.login_id, u.full_name, u.must_change);

    insert into public.user_roles (user_id, role)
      values (uid, u.role::public.app_role);
  end loop;
end $$;

-- ----------------------------------------------------------
-- 2. Questions + 2 draft contests
--    5 MCQ (1 mark each) + easy(3) + medium(5) + hard(7) = 20 marks
--    is_draft = true so publish-validation trigger is not fired.
-- ----------------------------------------------------------
do $$
declare
  a_q uuid[] := array[]::uuid[];
  b_q uuid[] := array[]::uuid[];
  qid uuid;
  c_a uuid := gen_random_uuid();
  c_b uuid := gen_random_uuid();
  i   int;
begin

  -- Contest A: Algorithm Fundamentals I

  insert into public.questions (type, marks, title, body, options, correct_option) values
    ('mcq',1,'Time complexity of linear search',
     'What is the worst-case time complexity of linear search on an unsorted array of n elements?',
     '["O(1)","O(log n)","O(n)","O(n^2)"]', 2)
    returning id into qid; a_q := a_q || qid;

  insert into public.questions (type, marks, title, body, options, correct_option) values
    ('mcq',1,'Queue vs Stack',
     'Which data structure follows FIFO (First-In-First-Out) order?',
     '["Stack","Queue","Heap","Tree"]', 1)
    returning id into qid; a_q := a_q || qid;

  insert into public.questions (type, marks, title, body, options, correct_option) values
    ('mcq',1,'Python list append',
     'What is the average-case time complexity of list.append() in Python?',
     '["O(n)","O(log n)","O(1)","O(n^2)"]', 2)
    returning id into qid; a_q := a_q || qid;

  insert into public.questions (type, marks, title, body, options, correct_option) values
    ('mcq',1,'Sorting stability',
     'Which sorting algorithm is stable by definition?',
     '["Quick sort","Heap sort","Merge sort","Selection sort"]', 2)
    returning id into qid; a_q := a_q || qid;

  insert into public.questions (type, marks, title, body, options, correct_option) values
    ('mcq',1,'Recursion base case',
     'What happens if a recursive function has no base case?',
     '["Returns 0","Returns None","Infinite recursion / stack overflow","Runs once"]', 2)
    returning id into qid; a_q := a_q || qid;

  insert into public.questions (type, difficulty, marks, title, body) values
    ('coding','easy',3,'Reverse a String',
     'Given a string S, print it in reverse order. Do not use any built-in reverse function.')
    returning id into qid; a_q := a_q || qid;

  insert into public.questions (type, difficulty, marks, title, body) values
    ('coding','medium',5,'Two Sum',
     'Given an array of integers and a target T, find two 0-based indices i and j such that arr[i] + arr[j] = T. Print both indices separated by a space. Exactly one solution exists.')
    returning id into qid; a_q := a_q || qid;

  insert into public.questions (type, difficulty, marks, title, body) values
    ('coding','hard',7,'Longest Increasing Subsequence',
     'Given a sequence of N integers, find the length of the longest strictly increasing subsequence.')
    returning id into qid; a_q := a_q || qid;

  insert into public.contests (
    id, title, description,
    start_time, end_time, duration_minutes,
    is_draft, is_practice, show_solutions_after_close
  ) values (
    c_a,
    'Algorithm Fundamentals I',
    'Core CS concepts: searching, sorting, recursion, and introductory coding challenges.',
    now() + interval '1 day',
    now() + interval '1 day' + interval '90 minutes',
    90, true, false, true
  );

  for i in 1..8 loop
    insert into public.contest_questions (contest_id, question_id, position)
      values (c_a, a_q[i], i);
  end loop;

  -- Contest B: Algorithm Fundamentals II

  insert into public.questions (type, marks, title, body, options, correct_option) values
    ('mcq',1,'Binary search prerequisite',
     'Binary search requires the input array to be:',
     '["Sorted","Unsorted","All positive","All unique"]', 0)
    returning id into qid; b_q := b_q || qid;

  insert into public.questions (type, marks, title, body, options, correct_option) values
    ('mcq',1,'Space complexity of DFS',
     'Space complexity of depth-first search on a graph with V vertices and E edges?',
     '["O(1)","O(V)","O(E)","O(V*E)"]', 1)
    returning id into qid; b_q := b_q || qid;

  insert into public.questions (type, marks, title, body, options, correct_option) values
    ('mcq',1,'Hash collision handling',
     'Which technique resolves hash collisions by chaining in a linked list?',
     '["Open addressing","Separate chaining","Double hashing","Linear probing"]', 1)
    returning id into qid; b_q := b_q || qid;

  insert into public.questions (type, marks, title, body, options, correct_option) values
    ('mcq',1,'BST in-order traversal',
     'In-order traversal of a Binary Search Tree visits nodes in which order?',
     '["Random","Descending","Ascending","Level by level"]', 2)
    returning id into qid; b_q := b_q || qid;

  insert into public.questions (type, marks, title, body, options, correct_option) values
    ('mcq',1,'Big-O of bubble sort',
     'What is the worst-case time complexity of Bubble Sort?',
     '["O(n)","O(n log n)","O(n^2)","O(log n)"]', 2)
    returning id into qid; b_q := b_q || qid;

  insert into public.questions (type, difficulty, marks, title, body) values
    ('coding','easy',3,'Count Vowels',
     'Given a string S, print the count of vowel characters (a, e, i, o, u, case-insensitive).')
    returning id into qid; b_q := b_q || qid;

  insert into public.questions (type, difficulty, marks, title, body) values
    ('coding','medium',5,'Valid Parentheses',
     'Given a string of brackets ( ) { } [ ], print YES if it is valid (every open bracket has a matching close in correct order), else print NO.')
    returning id into qid; b_q := b_q || qid;

  insert into public.questions (type, difficulty, marks, title, body) values
    ('coding','hard',7,'Word Ladder Length',
     'Given two words and a dictionary, find the length of the shortest transformation sequence where each step changes exactly one letter and every intermediate word must be in the dictionary. Print the length (counting both ends) or -1 if no path exists.')
    returning id into qid; b_q := b_q || qid;

  insert into public.contests (
    id, title, description,
    start_time, end_time, duration_minutes,
    is_draft, is_practice, show_solutions_after_close
  ) values (
    c_b,
    'Algorithm Fundamentals II',
    'Graphs, hash maps, trees and intermediate coding challenges to sharpen problem-solving.',
    now() + interval '2 days',
    now() + interval '2 days' + interval '2 hours',
    120, true, false, true
  );

  for i in 1..8 loop
    insert into public.contest_questions (contest_id, question_id, position)
      values (c_b, b_q[i], i);
  end loop;

  insert into public.audit_log (actor_login_id, action, details) values
    ('system', 'seed', '{"note":"Initial seed: 1 admin, 2 students, 2 draft contests"}');

end $$;

commit;
