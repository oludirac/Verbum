# Verbum V0 Plan

Status: overhaul in progress.

The current target is a personal grammar repair loop:

**Write -> Diagnose -> Explain -> Drill -> Rewrite -> Compare**

## Done In This Overhaul

- Repo hygiene reset.
- Analyzer logic moved into `/core`.
- API response includes grammar score.
- Rewrite comparison is single-session only.
- Drills come from validated errors only.
- Docs no longer frame the project as a database-backed learning platform.

## Current Priorities

1. Keep validation strict.
2. Improve rule-bank quality.
3. Add more deterministic tests.
4. Expand Spanish rule coverage only when the boundaries are clear.
5. Keep prose/style as a separate future mode, not part of V0.

## Non-Goals

- Database.
- Auth.
- Dashboards.
- Gamified progress.
- Generic tutoring.
- Style rewriting.
