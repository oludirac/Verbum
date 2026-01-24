# Verbum — Core Context

This file exists to keep all AI-assisted development aligned with the long-term product vision, not just the current task.

Any code, prompts, or architecture decisions should be consistent with this document.

---

## 1. What Verbum is

Verbum is a **Spanish writing accuracy engine**.

It is not a writing assistant.
It is not a style improver.
It is not a prose coach.
It is not a creativity tool.

Verbum treats Spanish grammar as a **set of testable systems**.

The product goal is to:
- detect grammatical and constructional errors
- map them to explicit rule systems
- explain them using a controlled rule bank
- generate drills only from the learner’s real errors
- track which grammatical systems a learner is failing and improving over time

Verbum is closer to a **compiler + diagnostics + training loop** than to Grammarly.

---

## 2. Core product philosophy

- Grammar is not “feedback.” It is **diagnostics.**
- Corrections are not rewriting. They are **minimal repairs.**
- Learning does not come from tips. It comes from **error-driven practice.**
- The rule bank is the product. The app is the interface.
- Anything that cannot be tied to a grammatical system does not belong.

---

## Learner-first design

All surfaces are learner-facing by default.

No rule codes, internal categories, or system jargon in primary UI.

Users see corrections, meaning, and actions — not diagnostics internals.

Developer metadata is hidden behind secondary ‘Details’ layers.

Practice always requires user action before answers are revealed.

If a UI decision helps developers but harms learner clarity, it is wrong.

---

## 3. Hard constraints (non-negotiable)

- Grammar only. No style, tone, elegance, or prose coaching.
- All corrections must be **minimal edits**.
- Every correction must reference a **rule_id** from the rule bank.
- Explanations must come **only** from the rule bank.
- If no rule exists, the system must output **“unmapped”**.
- Drills are generated **only** from observed user errors.
- The API output must always conform to the strict JSON schema.

If a feature violates any of the above, it does not ship.

---

## 4. What the system must eventually be able to answer

For each user:

- Which grammatical systems are failing?
- Which errors are fossilized?
- Which are improving?
- Which drills reduce which errors?
- Which constructions are persistently non-native?

All future features must serve this.

---

## 5. Long-term system vision

Verbum is building a **versioned learner-error ontology for Spanish writing**.

This includes:

- atomic grammar rules
- dialect-scoped constructions
- verb frame / valency lexicon
- common transfer patterns
- constructional misuse patterns
- drill templates per rule
- measurable recurrence and mastery signals

Naturalness is defined as:
→ conformity to native grammatical construction usage  
not style, beauty, or rhetoric.

---

## 6. Architecture intent

The system is explicitly layered:

1. Detection layer (LLM-assisted)
2. Validation layer (schema, rule whitelist, span checks)
3. Rule bank (frozen, versioned, authoritative)
4. Correction layer (minimal edits only)
5. Drill generator (rule-templated, error-driven)
6. Persistence layer (errors, recurrences, outcomes)

LLMs detect.
The system decides.
The rule bank explains.
The drills train.

No layer is allowed to collapse into another.

---

## 7. V0 execution philosophy

V0 is not about coverage.

V0 exists to prove:
- the writing → diagnostics → practice loop works
- learners understand the feedback
- drills change subsequent writing

Everything else is postponed.

Naturalness indices, dialect systems, dashboards, corpora, spaced repetition engines, and large ontologies are phase-2 concerns.

---

## 8. Anti-goals (what we are explicitly not building)

- A Spanish Grammarly
- A rewriting assistant
- A style coach
- A vocabulary improver
- A tone optimizer
- A fluency “beautifier”
- A generic language app

If the system starts producing “better ways to say this,” something is wrong.

---

## 9. Success definition

Verbum is succeeding when:

- users resubmit writing
- the same error types decrease
- drills map clearly to improvements
- unmapped phenomena accumulate into new rules
- the rule bank becomes more valuable than the UI

---

## 10. Build mindset for AI assistants

AI is a junior implementer.

It must:
- follow contracts
- respect schemas
- stay inside scope
- ask when uncertain
- never invent linguistic authority

Any time AI output drifts toward style, creativity, or rewriting, it must be corrected or reverted.

This file overrides all other instructions.

