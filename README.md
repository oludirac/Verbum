# Verbum

**Verbum is a Spanish writing accuracy engine.**  
It diagnoses grammatical errors, maps them to explicit rule systems, and trains users through error-driven drills.

It is not a writing assistant.  
It is not a style coach.  
It is not a rewriting tool.

Verbum treats Spanish grammar as a **set of testable systems** and learner writing as **data for diagnostics and training.**

---

## Core idea

Verbum helps learners answer:

- What grammatical systems am I failing?
- Which errors are recurring?
- Which drills reduce them?
- Which constructions are non-native and persistent?

The product is built around a closed loop:

**Write → Diagnose → Explain → Drill → Rewrite → Measure**

---

## What Verbum focuses on

Included:
- grammar
- morphology
- syntax
- agreement
- verb systems
- mood and tense
- prepositions
- collocations / verb frames
- construction choice
- orthography (when grammatical)

Explicitly excluded:
- style feedback
- tone coaching
- elegance or prose improvement
- vocabulary enrichment
- creative rewriting

Corrections are always **minimal edits** tied to a **specific grammatical rule.**

---

## Product philosophy

- Grammar is diagnostics, not feedback.  
- Learning comes from error-driven practice, not tips.  
- The rule bank is the product. The app is the interface.  
- Anything that cannot be mapped to a grammatical system does not belong.

Verbum is closer to a **compiler + diagnostics + training loop** than to Grammarly.

---

## Learner-first design

Verbum is built learner-first, not developer-first.

Primary UI must:

hide internal system codes and classifications

present errors as actionable corrections, not diagnostics jargon

emphasize practice and rewriting over inspection

require user effort before revealing answers

Debug and ontology data belong in secondary views, not the main experience.

---

## System architecture (intent)

The system is layered by design:

1. Detection layer (LLM-assisted)  
2. Validation layer (schema, rule whitelist, span checks)  
3. Rule bank (versioned, authoritative)  
4. Correction layer (minimal edits only)  
5. Drill generator (rule-templated, error-driven)  
6. Persistence layer (errors, recurrences, outcomes)

LLMs detect.  
The system decides.  
The rule bank explains.  
The drills train.

No layer is allowed to collapse into another.

---

## Tech stack

### Current (v0 — shipping focus)

- **Framework:** Next.js (App Router, TypeScript)  
- **Styling:** Tailwind CSS  
- **Hosting:** Vercel  
- **AI:** LLM API (detection + drill generation)  
- **State:** in-memory / mock persistence  

There is **no database in v0.**  
V0 exists to validate the learning loop, not data infrastructure.

---

### Planned (after learning loop is proven)

- **Database:** Supabase (PostgreSQL)  
- **Auth:** Supabase Auth  
- **Security:** Row Level Security (RLS)  
- **Persistence:** submissions, errors, recurrence, drills, mastery signals  
- **Optional ORM:** Prisma (only if Supabase client becomes limiting)

Supabase is the intended persistence layer because it provides:
- production-grade Postgres  
- built-in auth  
- strict access control  
- clean Next.js + Vercel integration

Prisma is explicitly optional, not default.

---

## Repository structure

/src/app UI (single writing loop)
/src/app/api API routes
/core validation, rule matching, drill generation
/rules rule bank (versioned)
/prompts LLM prompts (detection, drills)
/product product contracts and vision
/tests golden cases and evals

yaml
Copy code

---

## Source of truth files

- `product/context.md`  
  Long-term product vision, philosophy, and system intent.

- `product/SCOPE.md`  
  What v0 includes and explicitly excludes.

- `product/CONTRACT.md`  
  Non-negotiable system behavior rules.

- `product/JSON_SCHEMA.json`  
  The strict API contract.

All development (human or AI) must stay consistent with these.

---

## V0 goal

V0 exists only to prove one thing:

That the loop  
**writing → grammar diagnostics → error-driven drills → improved rewriting**  
actually changes learner behavior.

Coverage, dashboards, dialect systems, naturalness indices, and large ontologies come later.

---

## Anti-goals

Verbum is explicitly not building:

- a Spanish Grammarly  
- a rewriting assistant  
- a style coach  
- a tone optimizer  
- a generic language app  

If the system starts suggesting “better ways to say this,” something is wrong.

---

## Success definition

Verbum is succeeding when:

- users resubmit writing  
- the same grammatical errors decrease  
- drills map clearly to improvements  
- unmapped phenomena accumulate into new rules  
- the rule bank becomes more valuable than the UI  

---

## Development principles

- Grammar only.  
- Minimal edits only.  
- Every correction must have a rule_id.  
- No rule → unmapped.  
- Drills only from real errors.  
- Schema before prompts.  
- Learning loop before features.

---

## Next milestone

Ship a minimal v0 where a learner can:

1. write Spanish  
2. receive structured grammar diagnostics  
3. practice drills generated from their own errors  
4. rewrite and resubmit  

Nothing else ships before this works.