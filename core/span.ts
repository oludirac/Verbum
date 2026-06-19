import type {
  AnalyzeError,
  ModelAnalyzeResponse,
  UnmappedIssue,
} from "./types";

const overlapsUsedPosition = (
  usedPositions: Array<{ start: number; end: number }>,
  start: number,
  end: number
) => usedPositions.some((position) => start < position.end && end > position.start);

const findNextAvailableMatch = (
  originalText: string,
  spanText: string,
  usedPositions: Array<{ start: number; end: number }>
) => {
  let index = originalText.indexOf(spanText);

  while (index >= 0) {
    const end = index + spanText.length;
    if (!overlapsUsedPosition(usedPositions, index, end)) {
      return index;
    }
    index = originalText.indexOf(spanText, index + 1);
  }

  return -1;
};

export const computeSpans = (
  parsed: ModelAnalyzeResponse,
  originalText: string
): { errors: AnalyzeError[]; unmapped: UnmappedIssue[] } => {
  const usedPositions: Array<{ start: number; end: number }> = [];
  const errors: AnalyzeError[] = [];
  const unmapped: UnmappedIssue[] = parsed.unmapped.map((issue) => ({
    text: issue.span_text,
    reason: issue.reason,
    suggestion: issue.suggestion,
  }));

  for (const error of parsed.errors) {
    const spanText = error.span.text;
    if (!spanText.trim()) {
      unmapped.push({ reason: "missing_span_text" });
      continue;
    }

    const start = findNextAvailableMatch(originalText, spanText, usedPositions);
    if (start < 0) {
      unmapped.push({
        text: spanText,
        correction: error.correction,
        reason: "span_text_not_found",
        rule_id: error.rule_id,
      });
      continue;
    }

    const end = start + spanText.length;
    usedPositions.push({ start, end });
    errors.push({
      ...error,
      span: { start, end, text: spanText },
    });
  }

  return { errors, unmapped };
};
