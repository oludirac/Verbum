import type { AnalyzeError, UnmappedIssue } from "./types";

const countClauseDelimiters = (value: string) => {
  const matches = value.match(/[.;]/g);
  return matches ? matches.length : 0;
};

const clampSeverity = (value: number) => {
  if (value >= 3) {
    return 3;
  }
  if (value <= 1) {
    return 1;
  }
  return 2;
};

export const validateErrors = (
  errors: AnalyzeError[],
  originalText: string,
  allowedRuleIds: Set<string>
): { errors: AnalyzeError[]; unmapped: UnmappedIssue[] } => {
  const unmapped: UnmappedIssue[] = [];
  const candidateErrors: AnalyzeError[] = [];

  for (const error of errors) {
    if (!allowedRuleIds.has(error.rule_id)) {
      unmapped.push({
        span: error.span,
        text: error.span.text,
        correction: error.correction,
        reason: "unknown_rule_id",
        rule_id: error.rule_id,
      });
      continue;
    }

    candidateErrors.push(error);
  }

  const validatedErrors: AnalyzeError[] = [];
  for (const error of candidateErrors) {
    const { span } = error;
    const withinBounds =
      Number.isInteger(span.start) &&
      Number.isInteger(span.end) &&
      span.start >= 0 &&
      span.end <= originalText.length &&
      span.start < span.end;
    const matchesText = originalText.slice(span.start, span.end) === span.text;

    if (!withinBounds || !matchesText) {
      unmapped.push({
        span,
        text: span.text,
        correction: error.correction,
        reason: "invalid_span",
        rule_id: error.rule_id,
      });
      continue;
    }

    const originalSpanLength = span.end - span.start;
    const correctionLength = error.correction.length;
    const excessiveLength =
      originalSpanLength > 0 && correctionLength > originalSpanLength * 2.5;
    const tooManyClauses = countClauseDelimiters(error.correction) > 1;

    if (excessiveLength || tooManyClauses) {
      unmapped.push({
        span,
        text: span.text,
        correction: error.correction,
        reason: "non_minimal_edit",
        rule_id: error.rule_id,
      });
      continue;
    }

    validatedErrors.push({
      ...error,
      severity: clampSeverity(error.severity),
      confidence: Math.max(0, Math.min(1, error.confidence)),
    });
  }

  const sorted = [...validatedErrors].sort((a, b) => a.span.start - b.span.start);
  const nonOverlapping: AnalyzeError[] = [];

  for (const error of sorted) {
    const last = nonOverlapping[nonOverlapping.length - 1];
    if (!last || error.span.start >= last.span.end) {
      nonOverlapping.push(error);
      continue;
    }

    const keepCurrent = error.severity > last.severity;
    const rejected = keepCurrent ? nonOverlapping.pop() : error;

    if (rejected) {
      unmapped.push({
        span: rejected.span,
        text: rejected.span.text,
        correction: rejected.correction,
        reason: "overlapping_error",
        rule_id: rejected.rule_id,
      });
    }

    if (keepCurrent) {
      nonOverlapping.push(error);
    }
  }

  return { errors: nonOverlapping, unmapped };
};
