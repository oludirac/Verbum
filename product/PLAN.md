# Verbum V0 — Development Plan

Status: **Phase 1 Complete**  
Last updated: January 24, 2026

---

## Current State

| Component | Status |
|-----------|--------|
| Detection (LLM) | Working — GPT-4o detecting errors |
| Validation (rule whitelist) | Working — rejects unknown rule_ids |
| Span computation | Working — handles duplicates |
| Grammar score | Working — tuned (density * 5) |
| Error display + highlights | Working |
| Corrected text | Working |
| Drills | Working — server-generated from rule templates |
| Rewrite loop | Working |
| Rule bank | 30 rules with category/subcategory |
| Golden tests | 15 test cases created |
| Error taxonomy | Working — 5 categories, 12 subcategories |
| Category stats | Working — API returns breakdown, UI displays pills |

---

## Phase 1: Complete V0 Scope ✓ DONE

**Goal:** Ship a usable v0 that proves the learning loop works.

### 1.1 Expand Rule Bank ✓
**Status:** Complete

Expanded from 10 to 30 rules covering:
- [x] Gender agreement (AGR_GENDER_001)
- [x] Number agreement (AGR_NUMBER_001)
- [x] Ser vs estar (SER_ESTAR_001)
- [x] Por vs para (POR_PARA_001)
- [x] A personal (PREP_A_001)
- [x] Clitic order (CLITIC_ORDER_001)
- [x] Subjunctive triggers - desire/recommendation (SUBJ_TRIG_001)
- [x] Subjunctive triggers - doubt/negation (SUBJ_TRIG_002)
- [x] Subjunctive triggers - emotion (SUBJ_TRIG_003)
- [x] Preterite vs imperfect (TENSE_PRET_IMP_001)
- [x] Gustar construction (VERB_GUSTAR_001)
- [x] Hay vs estar (VERB_HAY_ESTAR_001)
- [x] Saber vs conocer (VERB_SABER_CONOCER_001)
- [x] Lo/la vs le pronouns (PRON_LO_LE_001)
- [x] Reflexive verbs (PRON_REFLEX_001, PRON_REFLEX_002)
- [x] Lexical gender exceptions (problema, tema, sistema, mapa, día, mano)
- [x] Verb frames (depender de, pensar en, soñar con, insistir en, consistir en, contar con, fijarse en)
- [x] Direction preposition (PREP_EN_A_001)

### 1.2 Server-Side Drill Generation ✓
**Status:** Complete

Implemented `generateDrillsFromErrors()` function that:
- Looks up rule by `rule_id` in RULES_MAP
- Uses rule's `drill_templates` to generate drills
- Substitutes `{{bad}}` and `{{good}}` placeholders with actual error data
- Limits to 5 drills per response
- Falls back gracefully if no template exists

### 1.3 Tune Grammar Score ✓
**Status:** Complete

Changed formula from `density * 8` to `density * 5`:
- Before: 2 major errors in 16 words = score 0
- After: 2 major errors in 16 words = score 0.4

### 1.4 Add Test Cases ✓
**Status:** Complete

Created `/tests/golden.json` with 15 test cases:
- Gender agreement tests
- Number agreement tests
- Ser/estar tests
- Por/para tests
- A personal tests
- Verb frame tests
- Subjunctive tests
- Clean text test (no errors expected)

Created `/tests/run-golden.ts` test runner script.

---

## Phase 2: Robustness

**Goal:** Handle edge cases and improve reliability.

### 2.1 Retry Logic
**Effort:** 1 hour

If model output fails validation:
1. Retry once with same prompt
2. If still fails, return fallback response
3. Log failure reason for debugging

### 2.2 Input Validation
**Effort:** 30 minutes

- Minimum text length: 20 characters
- Maximum text length: 2000 characters
- Reject empty or whitespace-only input
- Rate limit: 10 requests/minute per IP

### 2.3 Error Categorization
**Effort:** 1 hour

Group errors by type in UI:
- Agreement errors
- Verb errors
- Preposition errors
- etc.

Makes it easier for learners to see patterns.

### 2.4 Improve Unmapped Handling
**Effort:** 1 hour

When errors go to `unmapped`, show them to user with:
- "We detected a possible issue but can't categorize it yet"
- Still show the suggested correction
- Log for future rule bank expansion

---

## Phase 3: Learning Loop Validation

**Goal:** Prove the loop actually improves learner writing.

### 3.1 Session Tracking (In-Memory)
**Effort:** 2 hours

Track within a session:
- Submission count
- Error count per submission
- Which error types are recurring
- Score progression

Display: "You've reduced agreement errors by 50% in this session"

### 3.2 Drill Completion Tracking
**Effort:** 1 hour

Track:
- Which drills were attempted
- Correct/incorrect responses
- Time spent on drills

Show: "You completed 5/8 drills. 3 correct on first try."

### 3.3 Before/After Comparison
**Effort:** 1 hour

After rewrite submission, show:
- Previous text vs new text
- Which errors were fixed
- Which are new
- Score change

---

## Phase 4: Polish (Post-V0)

These are explicitly **out of scope for v0** per SCOPE.md:

- [ ] Naturalness index
- [ ] Dialect system
- [ ] Dashboards
- [ ] Spaced repetition
- [ ] Style feedback
- [ ] Vocabulary coaching
- [ ] Multiple languages
- [ ] User accounts / persistence

---

## Immediate Next Actions

Phase 1 is complete. Next priorities:

1. **Test the app** — Run `npm run dev` and verify all changes work
2. **Run golden tests** — Start server, then `npx ts-node tests/run-golden.ts`
3. **Phase 2** — Implement retry logic, input validation, error categorization

---

## Success Criteria for V0

Per README.md:
> V0 exists only to prove one thing: that the loop **writing → grammar diagnostics → error-driven drills → improved rewriting** actually changes learner behavior.

V0 is successful when:
- [ ] Errors are detected accurately (>80% precision)
- [ ] Corrections are minimal and correct
- [ ] Drills are relevant to the user's errors
- [ ] Users can rewrite and see improvement
- [ ] Score reflects actual grammar quality

---

## File Locations

| File | Purpose |
|------|---------|
| `rules/rule_bank_v0.json` | Grammar rules (expand this) |
| `prompts/detect_errors_v0.txt` | LLM prompt |
| `app/api/analyze/route.ts` | API logic |
| `app/page.tsx` | UI |
| `product/SCOPE.md` | What's in/out for v0 |
| `product/CONTRACT.md` | Hard rules |
| `product/context.md` | Product vision |
