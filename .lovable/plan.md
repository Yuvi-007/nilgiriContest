# Phase 2: Complete Homepage Landing Page

## Goal
Replace the current simple homepage with a production-ready, data-backed contest landing page that keeps nilgiriContest’s dark glass and blue-accent identity while making motion optional and every section mobile-safe.

## What will be built

1. **Immersive hero**
   - Add the “Cohort Daily Contests” live badge, staged word reveal, flowing gradient phrase, aurora, and lightweight floating particles.
   - Build a responsive interactive mock-question panel with language/topic chips, live countdown, selectable answers, and pointer-driven 3D tilt.
   - Route the primary action to the active contest lobby for signed-in students when available, otherwise login; keep Rules as the secondary action.

2. **Live homepage data**
   - Add one narrow public read function in a database migration that returns only safe aggregates plus the latest closed contest’s ranked preview.
   - Calculate active students, closed non-practice contests held, total submissions, and average score from real records—never hardcoded values.
   - Add typed homepage data loading and clear zero/empty states without exposing private account fields or draft contests.

3. **Stats and leaderboard**
   - Add an intersection-observer `useCountUp` hook for one-time number animation.
   - Render the latest closed contest’s top three with gold, silver, and bronze treatments, actual scores, completion durations, and IST contest timing.
   - Link the full leaderboard through the existing protected leaderboard flow.

4. **Marquee and feature grid**
   - Add the infinite language/topic band with duplicated content for seamless looping and hover pause.
   - Rebuild the six feature cards with restrained glass, inset highlights, iconography, and responsive layout.

5. **Closing section and footer**
   - Add a centered radial-blue closing prompt with the same session-aware contest action.
   - Add a compact footer with the runtime year, Rules and Leaderboard links, and an in-page service-status target.

6. **Motion, accessibility, and responsive behavior**
   - Add a reusable reduced-motion hook and CSS fallbacks that stop word reveals, gradient flow, aurora, particles, marquee, shimmer, count-up, and tilt.
   - Preserve keyboard focus, semantic headings/tables, sufficient contrast, touch-safe controls, and layouts from phone to wide desktop.

7. **Verification**
   - Validate the public data response and empty-state behavior.
   - Check the complete homepage at desktop and mobile sizes, including answer selection, hover tilt, CTA destinations, reduced-motion rendering, and live data.
   - Confirm the preview reports no build, runtime, console, or network errors and ensure route metadata remains complete.

## Technical details
- The public database function will use a fixed search path, explicit execution grants, aggregate-only output, and deterministic ranking by score, time, then submission time.
- Homepage data will use the existing query layer and TanStack Query rather than page-load seeding or client-side access to protected tables.
- New visual values will be semantic tokens in the global theme; homepage JSX will use those tokens and the existing Button component.
- The implementation will remain dependency-light: React, CSS transforms, IntersectionObserver, and the existing icon set are sufficient.
