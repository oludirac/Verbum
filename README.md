# Verbum

Verbum is a personal Spanish grammar repair tool.

Live private instance: https://verbum-lake.vercel.app/

I use it to check Spanish writing, diagnose grammar problems, drill the exact patterns that failed, and rewrite the text in the same session. It is deliberately narrow: grammar first, minimal corrections, rule-backed explanations.

It is not a Spanish course, a prose-polishing assistant, a style coach, or a progress app.

## Loop

Verbum is built around one working loop:

1. Write Spanish.
2. Diagnose rule-backed grammar and curated usage issues.
3. Explain the issue from the rule bank.
4. Drill the pattern that actually failed.
5. Rewrite the text.
6. Compare the rewrite with the previous attempt in the current session.

There is no database in V0. Measurement is only an in-session comparison between the current rewrite and the previous diagnosis.

## What It Checks

Included:

- agreement
- morphology
- syntax
- verb systems
- mood and tense
- prepositions
- verb frames
- construction choice
- curated false cognates and collocations when they are explicitly in the rule bank

Excluded from V0:

- prose improvement
- tone
- style
- elegance
- general vocabulary enrichment
- generic tutoring
- long-term progress tracking

Prose and naturalness may become a separate mode later. They should not blur the grammar engine.

## Architecture

The model proposes candidate diagnostics. The server decides what survives.

1. Detection layer: LLM candidate errors using structured output.
2. Validation layer: schema, rule whitelist, span checks, minimal-edit checks.
3. Rule bank: versioned grammar and usage rules.
4. Correction layer: server-applied minimal edits.
5. Drill generator: templates from validated errors only.
6. Session comparison: current rewrite vs previous diagnosis, kept in browser state.

Main folders:

- `/app` - Next.js App Router UI and API route
- `/core` - analyzer, validation, scoring, drills, rule loading
- `/rules` - rule bank
- `/prompts` - model prompt
- `/product` - product notes and contracts
- `/tests` - deterministic unit tests and optional live golden tests

## Local Setup

Copy the env template:

```bash
cp .env.example .env.local
```

Set:

```bash
OPENAI_API_KEY=
VERBUM_MODEL=gpt-4.1-mini
VERBUM_ACCESS_CODE=
```

`VERBUM_ACCESS_CODE` is optional locally. When set, Verbum shows a simple
private access screen and protects `/api/analyze` with an HTTP-only cookie.

Run:

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Tests

Default tests do not call OpenAI:

```bash
npm test
```

Useful checks:

```bash
npm run lint
npm run build
```

Optional live model golden tests require the dev server and an API key:

```bash
npm run dev
npm run test:live
```

## Current Limits

- Rule coverage is intentionally small.
- The grammar score is a rough diagnostic density score, not a fluency score.
- The app does not persist history.
- Access control is a single shared passcode, not accounts or user management.
- API rate limiting is in-memory and best-effort; it is enough for a personal
  V0, not a public multi-user service.
- Unmapped issues are kept separate so the rule bank can grow without overcorrecting.
- Corrections are intentionally minimal and may feel less fluent than a full rewrite.

## Deploy Notes

For Vercel, set:

```bash
OPENAI_API_KEY=
VERBUM_MODEL=gpt-4.1-mini
VERBUM_ACCESS_CODE=
```

The access code prevents casual visitors from using the server-side OpenAI key.
