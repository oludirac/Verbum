# Verbum Core Context

Verbum is a personal Spanish grammar repair tool.

It exists to help me write Spanish, diagnose rule-backed grammar errors, drill those exact patterns, and rewrite in the same session.

It is not a general Spanish course, a prose improver, a style coach, a tone optimizer, or a progress app.

## Product Philosophy

- Grammar is diagnostics.
- Corrections are minimal repairs.
- The rule bank is the authority.
- The model proposes; the system decides.
- Practice comes from observed errors.
- Single-session comparison is enough for V0.

## Hard Constraints

- Grammar first.
- No style, tone, elegance, prose, or vocabulary enrichment in V0.
- Every accepted correction must map to a rule_id.
- If no rule fits, the issue is unmapped.
- Drills are generated only from validated errors.
- No database, auth, streaks, accounts, or long-term progress tracking.

## V0 Loop

1. Write.
2. Diagnose.
3. Explain.
4. Drill.
5. Rewrite.
6. Compare within the current session.

## Future Boundary

Prose/style/naturalness may become a separate mode later. It must not leak into the grammar engine or weaken the no-overcorrection contract.
