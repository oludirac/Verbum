# Verbum Error Taxonomy

A structured classification system for Spanish grammar errors.

---

## Purpose

1. **Analytics** — Track which error categories are most frequent/persistent
2. **Drill targeting** — Generate drills focused on weak categories
3. **Progress tracking** — Show learner improvement by category over time
4. **Rule organization** — Group related rules for easier maintenance

---

## Proposed Category Hierarchy

```
ERROR_CATEGORY
├── AGREEMENT          (concordancia)
│   ├── gender         → AGR_GENDER_001
│   └── number         → AGR_NUMBER_001
│
├── VERB_SYSTEM        (sistema verbal)
│   ├── ser_estar      → SER_ESTAR_001
│   ├── tense          → TENSE_PRET_IMP_001
│   ├── mood           → SUBJ_TRIG_001, SUBJ_TRIG_002, SUBJ_TRIG_003
│   └── construction   → VERB_GUSTAR_001, VERB_HAY_ESTAR_001, VERB_SABER_CONOCER_001
│
├── PRONOUN            (pronombres)
│   ├── clitic_order   → CLITIC_ORDER_001
│   ├── object         → PRON_LO_LE_001
│   └── reflexive      → PRON_REFLEX_001, PRON_REFLEX_002
│
├── PREPOSITION        (preposiciones)
│   ├── por_para       → POR_PARA_001
│   ├── a_personal     → PREP_A_001
│   ├── direction      → PREP_EN_A_001
│   └── verb_frame     → LEX_FRAME_*
│
├── LEXICAL_GENDER     (género léxico)
│   └── exceptions     → LEX_GENDER_PROBLEMA_001, LEX_GENDER_TEMA_001, etc.
│
└── OTHER              (otros)
    └── unmapped       → errors without matching rules
```

---

## Category Definitions

### AGREEMENT
Errors in grammatical agreement (concordancia) between elements.
- **gender**: Article/adjective doesn't match noun gender
- **number**: Subject/verb or noun/adjective number mismatch

### VERB_SYSTEM
Errors in verb selection, tense, or mood.
- **ser_estar**: Wrong copula choice
- **tense**: Preterite/imperfect confusion
- **mood**: Indicative used where subjunctive required
- **construction**: Gustar-type verbs, hay/estar, saber/conocer

### PRONOUN
Errors with pronouns.
- **clitic_order**: Wrong order of object pronouns
- **object**: Lo/la vs le confusion
- **reflexive**: Missing or incorrect reflexive pronoun

### PREPOSITION
Errors with prepositions.
- **por_para**: Por/para confusion
- **a_personal**: Missing "a" before human direct objects
- **direction**: Wrong preposition for movement
- **verb_frame**: Wrong preposition for specific verb (depender de, pensar en)

### LEXICAL_GENDER
Nouns with unexpected grammatical gender.
- **exceptions**: problema, tema, sistema, mapa, día, mano, etc.

---

## Implementation

### Option A: Add category to rule bank (Recommended)

Each rule gets a `category` and `subcategory` field:

```json
{
  "rule_id": "AGR_GENDER_001",
  "category": "AGREEMENT",
  "subcategory": "gender",
  ...
}
```

### Option B: Derive from rule_id prefix

Use naming convention to extract category:
- `AGR_*` → AGREEMENT
- `SER_ESTAR_*` → VERB_SYSTEM.ser_estar
- `SUBJ_*` → VERB_SYSTEM.mood
- `PREP_*` → PREPOSITION
- `LEX_GENDER_*` → LEXICAL_GENDER
- `LEX_FRAME_*` → PREPOSITION.verb_frame
- `PRON_*` → PRONOUN
- `VERB_*` → VERB_SYSTEM.construction
- `TENSE_*` → VERB_SYSTEM.tense

---

## Analytics Use Cases

### Per-Session
- "You made 3 AGREEMENT errors and 2 VERB_SYSTEM errors"
- "Your most frequent error type: PREPOSITION.verb_frame"

### Over Time (requires persistence)
- "AGREEMENT errors down 40% over last 5 sessions"
- "VERB_SYSTEM.mood errors persist — try focused drills"

### Drill Targeting
- "You struggle with PREPOSITION — here are 5 targeted drills"
- Weight drill selection toward weak categories

---

## Implementation Status ✓

All steps completed:

1. ✓ Added `category` and `subcategory` fields to all 30 rules in rule_bank_v0.json
2. ✓ Created `computeCategoryStats()` function in route.ts
3. ✓ API response now includes `category_stats` array
4. ✓ UI shows error breakdown by category (pill badges)

### API Response Format

```json
{
  "grammar_score": 0.6,
  "errors": [...],
  "category_stats": [
    { "category": "AGREEMENT", "subcategory": "gender", "count": 2 },
    { "category": "VERB_SYSTEM", "subcategory": "ser_estar", "count": 1 }
  ]
}
```
