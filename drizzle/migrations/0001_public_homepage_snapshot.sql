CREATE OR REPLACE FUNCTION public.get_homepage_snapshot()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH latest_closed AS (
    SELECT c.id, c.title, c.start_time, c.end_time
    FROM public.contests c
    WHERE c.is_draft = false
      AND c.is_practice = false
      AND c.end_time < now()
    ORDER BY c.end_time DESC
    LIMIT 1
  ),
  ranked AS (
    SELECT
      p.full_name AS name,
      cr.score,
      cr.time_taken_seconds,
      cr.submitted_at,
      row_number() OVER (
        ORDER BY cr.score DESC, cr.time_taken_seconds ASC, cr.submitted_at ASC
      ) AS rank
    FROM public.contest_results cr
    JOIN latest_closed lc ON lc.id = cr.contest_id
    JOIN public.profiles p ON p.id = cr.user_id
    JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role = 'student'
  ),
  active_contest AS (
    SELECT c.id, c.title
    FROM public.contests c
    WHERE c.is_draft = false
      AND c.start_time <= now()
      AND c.end_time > now()
    ORDER BY c.end_time ASC
    LIMIT 1
  )
  SELECT jsonb_build_object(
    'activeStudents', (
      SELECT count(*)
      FROM public.user_roles ur
      WHERE ur.role = 'student'
    ),
    'contestsHeld', (
      SELECT count(*)
      FROM public.contests c
      WHERE c.is_draft = false
        AND c.is_practice = false
        AND c.end_time < now()
    ),
    'totalSubmissions', (
      SELECT count(*)
      FROM public.contest_results cr
      JOIN public.contests c ON c.id = cr.contest_id
      WHERE c.is_draft = false AND c.is_practice = false
    ),
    'averageScore', (
      SELECT round(avg(cr.score), 1)
      FROM public.contest_results cr
      JOIN public.contests c ON c.id = cr.contest_id
      WHERE c.is_draft = false AND c.is_practice = false
    ),
    'activeContest', (
      SELECT jsonb_build_object('id', ac.id, 'title', ac.title)
      FROM active_contest ac
    ),
    'latestContest', (
      SELECT jsonb_build_object(
        'id', lc.id,
        'title', lc.title,
        'startTime', lc.start_time,
        'endTime', lc.end_time,
        'leaders', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'rank', r.rank,
            'name', r.name,
            'score', r.score,
            'timeTakenSeconds', r.time_taken_seconds,
            'submittedAt', r.submitted_at
          ) ORDER BY r.rank)
          FROM ranked r
          WHERE r.rank <= 3
        ), '[]'::jsonb)
      )
      FROM latest_closed lc
    )
  );
$$;

REVOKE ALL ON FUNCTION public.get_homepage_snapshot() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_homepage_snapshot() TO anon, authenticated, service_role;
COMMENT ON FUNCTION public.get_homepage_snapshot() IS 'Public aggregate-only homepage metrics and the latest closed contest podium.';