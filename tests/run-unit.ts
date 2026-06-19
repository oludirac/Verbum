import assert from "node:assert/strict";
import {
  createAccessToken,
  isAccessControlEnabled,
  isValidAccessCode,
  isValidAccessToken,
} from "../core/access";
import { applyCorrections } from "../core/correction";
import { generateDrillsFromErrors } from "../core/drills";
import { checkRateLimit } from "../core/rate-limit";
import { rules, allowedRuleIds } from "../core/rules";
import { computeGrammarScore, compareRewrite } from "../core/scoring";
import { computeSpans } from "../core/span";
import { validateErrors } from "../core/validation";
import type { AnalyzeError, ModelAnalyzeResponse } from "../core/types";

const makeModelResponse = (): ModelAnalyzeResponse => ({
  errors: [
    {
      span: { text: "La coche" },
      category: "agreement",
      rule_id: "AGR_GENDER_001",
      severity: 2,
      correction: "El coche",
      confidence: 0.95,
    },
    {
      span: { text: "La coche" },
      category: "agreement",
      rule_id: "AGR_GENDER_001",
      severity: 2,
      correction: "El coche",
      confidence: 0.95,
    },
  ],
  corrected_text: "El coche y El coche.",
  unmapped: [],
});

const run = () => {
  assert.ok(rules.length >= 30, "rule bank should load");
  assert.ok(allowedRuleIds.has("AGR_GENDER_001"), "known rule should be allowed");
  assert.ok(
    rules.every((rule) => rule.learner_explanation !== undefined),
    "rules should expose learner explanations"
  );

  const duplicateText = "La coche y La coche.";
  const withSpans = computeSpans(makeModelResponse(), duplicateText);
  assert.equal(withSpans.errors.length, 2, "duplicate spans should both map");
  assert.equal(withSpans.errors[0].span.start, 0);
  assert.equal(withSpans.errors[1].span.start, 11);

  const unknownRule = validateErrors(
    [
      {
        ...withSpans.errors[0],
        rule_id: "UNKNOWN_RULE",
      },
    ],
    duplicateText,
    allowedRuleIds
  );
  assert.equal(unknownRule.errors.length, 0);
  assert.equal(unknownRule.unmapped[0].reason, "unknown_rule_id");

  const invalidSpan = validateErrors(
    [
      {
        ...withSpans.errors[0],
        span: { start: 0, end: 3, text: "Nope" },
      },
    ],
    duplicateText,
    allowedRuleIds
  );
  assert.equal(invalidSpan.errors.length, 0);
  assert.equal(invalidSpan.unmapped[0].reason, "invalid_span");

  const nonMinimal = validateErrors(
    [
      {
        ...withSpans.errors[0],
        correction:
          "El coche completamente nuevo está en la calle; además quiero explicar otra cosa.",
      },
    ],
    duplicateText,
    allowedRuleIds
  );
  assert.equal(nonMinimal.errors.length, 0);
  assert.equal(nonMinimal.unmapped[0].reason, "non_minimal_edit");

  const validated = validateErrors(withSpans.errors, duplicateText, allowedRuleIds);
  assert.equal(validated.errors.length, 2);
  assert.equal(applyCorrections(duplicateText, validated.errors), "El coche y El coche.");

  const drills = generateDrillsFromErrors(validated.errors);
  assert.ok(drills.length > 0, "validated errors should generate drills");
  assert.ok(
    drills.every((drill) => drill.rule_id === "AGR_GENDER_001"),
    "drills should come from validated rule IDs"
  );

  const score = computeGrammarScore("La coche es roja.", validated.errors);
  assert.ok(score >= 0 && score <= 1, "score should be clamped");

  const comparison = compareRewrite(
    [
      {
        rule_id: "AGR_GENDER_001",
        span_text: "La coche",
        correction: "El coche",
      },
    ],
    [] as AnalyzeError[],
    0.5,
    1
  );
  assert.equal(comparison?.fixed_rule_ids[0], "AGR_GENDER_001");
  assert.equal(comparison?.score_delta, 0.5);

  const originalAccessCode = process.env.VERBUM_ACCESS_CODE;
  const originalAccessSecret = process.env.VERBUM_ACCESS_SECRET;
  process.env.VERBUM_ACCESS_CODE = "test-code";
  process.env.VERBUM_ACCESS_SECRET = "test-secret";
  assert.equal(isAccessControlEnabled(), true);
  assert.equal(isValidAccessCode("test-code"), true);
  assert.equal(isValidAccessCode("wrong"), false);
  assert.equal(isValidAccessToken(createAccessToken()), true);
  assert.equal(isValidAccessToken("bad-token"), false);
  if (originalAccessCode === undefined) {
    delete process.env.VERBUM_ACCESS_CODE;
  } else {
    process.env.VERBUM_ACCESS_CODE = originalAccessCode;
  }
  if (originalAccessSecret === undefined) {
    delete process.env.VERBUM_ACCESS_SECRET;
  } else {
    process.env.VERBUM_ACCESS_SECRET = originalAccessSecret;
  }

  const rateKey = `unit-${Date.now()}`;
  assert.equal(checkRateLimit("unit", rateKey, 2, 60_000).allowed, true);
  assert.equal(checkRateLimit("unit", rateKey, 2, 60_000).allowed, true);
  assert.equal(checkRateLimit("unit", rateKey, 2, 60_000).allowed, false);

  console.log("Unit tests passed.");
};

run();
