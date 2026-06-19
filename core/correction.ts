import type { AnalyzeError } from "./types";

export const applyCorrections = (originalText: string, errors: AnalyzeError[]) => {
  let corrected = originalText;
  const ordered = [...errors].sort((a, b) => b.span.start - a.span.start);

  for (const error of ordered) {
    corrected =
      corrected.slice(0, error.span.start) +
      error.correction +
      corrected.slice(error.span.end);
  }

  return corrected;
};
