# Verbum Full Overhaul Plan

Verbum is a personal Spanish grammar diagnostics and repair tool. It is for checking learner writing, understanding grammar errors, drilling the exact patterns that failed, and rewriting in the same session.

It is not a general Spanish course, a writing assistant, a prose-polishing tool, a progress tracker, or a gamified learning app.

## Core Loop

1. Write Spanish.
2. Diagnose only rule-backed grammar and curated usage issues.
3. Explain from the rule bank.
4. Generate drills from the actual errors.
5. Rewrite.
6. Compare first and rewritten attempts in the current session only.

## Implementation Direction

- Keep all persistence in browser/component state. No database, auth, streaks, dashboards, or long-term progress model.
- Keep the model narrow: it proposes candidate diagnostics.
- Keep the server authoritative: it validates rule IDs, spans, minimal edits, and drill generation.
- Keep prose/style/naturalness out of V0. A separate prose mode may be explored later, but it must not weaken the grammar engine.
- Treat the rule bank as the main product surface: rules need learner-facing explanations, minimal-correction policy, examples, boundary cases, and drill templates.

## Current Overhaul Tasks

- Clean local artifacts and env handling.
- Move analyzer logic out of the route into `/core`.
- Add grammar scoring and single-session comparison.
- Use structured model output instead of prompt-only JSON.
- Update the UI around a compact grammar repair workflow.
- Rewrite docs as practical project notes, not portfolio copy.
- Add deterministic tests that do not require a live model.
