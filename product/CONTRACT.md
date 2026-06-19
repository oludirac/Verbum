# Verbum Contract

Verbum is a grammar repair tool, not a writing assistant.

Hard rules:

- Grammar first.
- No style, tone, elegance, or prose advice in V0.
- Corrections must be minimal edits.
- Every accepted correction must reference a rule_id from `/rules`.
- Explanations come from the rule bank.
- If no rule exists, return an unmapped issue instead of forcing a category.
- Drills are generated only from validated user errors.
- The server is authoritative; the model only proposes candidates.
- No persistence, accounts, streaks, or long-term progress mechanics in V0.

If a feature encourages generic rewriting, it does not belong in the grammar engine.
