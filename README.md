# Nilgiri Contest Hub

Build a complete, production-quality web application called nilgiriContest: a secure daily contest platform for a closed cohort of 90 students and 1 admin.

Work strictly in phases. Start with Phase 1: Foundation.

Phase 1 requirements:
1. Design tokens & theme:
- Dark, glassy, blue-accent design system:
  - bg #0a0606, bg2 #110808, bg3 #180d0d
  - card rgba(255,255,255,.04), border rgba(255,255,255,.08)
  - text #fce8e8, muted #a68e94
  - primary #1e5eff (glow rgba(30,94,255,.3)), violet #5b8cff, cyan #22c9f5, gold #f59e0b, green #10b981, orange #f97316
- Fonts: Inter (300 to 900) for UI, JetBrains Mono for code and data.
- Support "calm mode" for Arena and Lobby (solid dark card backgrounds, no blur, aurora, or distracting animations).

2. Navigation & Layout:
- Fixed blurred dark navbar with bottom border: logo "nilgiriContest", Features, Rules, Leaderboard links, "next contest in hh:mm:ss" countdown chip, and role-aware auth controls.
- Navbar hides in the arena, replaced by a slim contest status bar.

3. Authentication & Roles:
- Exactly 1 admin and up to 90 student accounts. Closed cohort: NO public signup and NO self-service forgot-password email flow.
- Login screen: Student/Admin ID + password, show/hide password, lockout after 5 failed attempts for 15 minutes, generic error messages.
- Forced password change on first login (`mustChangePassword`).
- Role-based route guards for Student (/dashboard, /contests, /contest/:id/lobby, /contest/:id/arena, /contest/:id/result, /contest/:id/review, /leaderboard, /profile) and Admin (/admin, /admin/students, /admin/questions, /admin/contests, /admin/audit).

4. Time & Data models:
- Store all timestamps in UTC; display everywhere in Asia/Kolkata (IST).
- Seed demo data: 1 admin, demo students, sample questions (5 MCQ + 3 coding), 1 closed contest with leaderboard, and 1 live/upcoming contest.
- Contest status (scheduled/live/closed) is derived from startTime and endTime; only `draft` is a stored state.
- 20 marks total per contest: 5 MCQs (1 mark each) + 3 coding problems (Easy 3, Medium 5, Hard 7).

5. Public entry points:
- Homepage hero matching the dark glassy aesthetic, login page, rules page, and not-found route.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/d835162b-82ba-4cbe-b915-64c4f6b1d080).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
