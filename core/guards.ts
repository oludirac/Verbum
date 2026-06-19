import type { ModelAnalyzeResponse } from "./types";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const isModelAnalyzeResponse = (
  value: unknown
): value is ModelAnalyzeResponse => {
  if (!isRecord(value)) {
    return false;
  }

  if (
    !Array.isArray(value.errors) ||
    !Array.isArray(value.unmapped) ||
    typeof value.corrected_text !== "string"
  ) {
    return false;
  }

  const errorsValid = value.errors.every((error) => {
    if (!isRecord(error) || !isRecord(error.span)) {
      return false;
    }

    return (
      typeof error.span.text === "string" &&
      typeof error.category === "string" &&
      typeof error.rule_id === "string" &&
      typeof error.severity === "number" &&
      typeof error.correction === "string" &&
      typeof error.confidence === "number"
    );
  });

  const unmappedValid = value.unmapped.every((issue) => {
    if (!isRecord(issue)) {
      return false;
    }

    return (
      typeof issue.span_text === "string" &&
      typeof issue.reason === "string" &&
      typeof issue.suggestion === "string"
    );
  });

  return errorsValid && unmappedValid;
};
