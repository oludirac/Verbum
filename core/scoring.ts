import type {
  AnalyzeError,
  CategoryStats,
  PreviousError,
  RewriteComparison,
} from "./types";
import { rulesById } from "./rules";

const countWords = (text: string) => {
  const matches = text.trim().match(/\S+/g);
  return matches ? matches.length : 0;
};

export const computeGrammarScore = (text: string, errors: AnalyzeError[]) => {
  const wordCount = Math.max(1, countWords(text));
  const weightedErrors = errors.reduce(
    (total, error) => total + Math.max(1, Math.min(3, error.severity)),
    0
  );
  const penalty = (weightedErrors / wordCount) * 2.5;
  return Number(Math.max(0, Math.min(1, 1 - penalty)).toFixed(2));
};

export const computeCategoryStats = (errors: AnalyzeError[]): CategoryStats[] => {
  const statsMap = new Map<string, CategoryStats>();

  for (const error of errors) {
    const rule = rulesById.get(error.rule_id);
    const category = rule?.category ?? "OTHER";
    const subcategory = rule?.subcategory ?? "unknown";
    const key = `${category}:${subcategory}`;
    const existing = statsMap.get(key);

    if (existing) {
      existing.count += 1;
    } else {
      statsMap.set(key, { category, subcategory, count: 1 });
    }
  }

  return Array.from(statsMap.values()).sort((a, b) => b.count - a.count);
};

const signatureForPrevious = (error: PreviousError) =>
  `${error.rule_id}:${error.span_text}:${error.correction}`;

const signatureForCurrent = (error: AnalyzeError) =>
  `${error.rule_id}:${error.span.text}:${error.correction}`;

const unique = (values: string[]) => Array.from(new Set(values)).sort();

export const compareRewrite = (
  previousErrors: PreviousError[] | undefined,
  currentErrors: AnalyzeError[],
  previousScore: number | undefined,
  currentScore: number
): RewriteComparison | undefined => {
  if (!previousErrors) {
    return undefined;
  }

  const previousSignatures = new Set(previousErrors.map(signatureForPrevious));
  const currentSignatures = new Set(currentErrors.map(signatureForCurrent));

  const fixedRuleIds = previousErrors
    .filter((error) => !currentSignatures.has(signatureForPrevious(error)))
    .map((error) => error.rule_id);
  const remainingRuleIds = currentErrors
    .filter((error) => previousSignatures.has(signatureForCurrent(error)))
    .map((error) => error.rule_id);
  const newRuleIds = currentErrors
    .filter((error) => !previousSignatures.has(signatureForCurrent(error)))
    .map((error) => error.rule_id);

  return {
    previous_error_count: previousErrors.length,
    current_error_count: currentErrors.length,
    fixed_rule_ids: unique(fixedRuleIds),
    remaining_rule_ids: unique(remainingRuleIds),
    new_rule_ids: unique(newRuleIds),
    score_delta:
      previousScore === undefined
        ? 0
        : Number((currentScore - previousScore).toFixed(2)),
  };
};
