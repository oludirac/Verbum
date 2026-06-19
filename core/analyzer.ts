import { applyCorrections } from "./correction";
import { generateDrillsFromErrors } from "./drills";
import { detectWithModel } from "./model";
import { allowedRuleIds } from "./rules";
import { computeGrammarScore, computeCategoryStats, compareRewrite } from "./scoring";
import { computeSpans } from "./span";
import { validateErrors } from "./validation";
import type { AnalyzeOptions, AnalyzeRequestBody, AnalyzeResponse } from "./types";

export const MIN_TEXT_LENGTH = 10;
export const MAX_TEXT_LENGTH = 2000;

export const validateAnalyzeInput = (body: unknown): AnalyzeRequestBody => {
  if (!body || typeof body !== "object") {
    throw new Error("Invalid request body.");
  }

  const candidate = body as {
    text?: unknown;
    previous_errors?: unknown;
    previous_grammar_score?: unknown;
  };

  if (typeof candidate.text !== "string") {
    throw new Error("Text must be a string.");
  }

  const text = candidate.text;
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("Text cannot be empty.");
  }
  if (trimmed.length < MIN_TEXT_LENGTH) {
    throw new Error(`Text must be at least ${MIN_TEXT_LENGTH} characters.`);
  }
  if (text.length > MAX_TEXT_LENGTH) {
    throw new Error(`Text cannot exceed ${MAX_TEXT_LENGTH} characters.`);
  }

  const previous_grammar_score =
    typeof candidate.previous_grammar_score === "number"
      ? candidate.previous_grammar_score
      : undefined;

  if (candidate.previous_errors === undefined) {
    return { text, previous_grammar_score };
  }

  if (!Array.isArray(candidate.previous_errors)) {
    throw new Error("previous_errors must be an array.");
  }

  const previous_errors = candidate.previous_errors.map((item) => {
    if (!item || typeof item !== "object") {
      throw new Error("previous_errors contains an invalid item.");
    }

    const error = item as Record<string, unknown>;
    if (
      typeof error.rule_id !== "string" ||
      typeof error.span_text !== "string" ||
      typeof error.correction !== "string"
    ) {
      throw new Error("previous_errors contains an invalid item.");
    }

    return {
      rule_id: error.rule_id,
      span_text: error.span_text,
      correction: error.correction,
    };
  });

  return { text, previous_errors, previous_grammar_score };
};

const fallbackResponse = (
  text: string,
  reason: string,
  previousErrors = undefined as AnalyzeRequestBody["previous_errors"],
  previousGrammarScore = undefined as AnalyzeRequestBody["previous_grammar_score"]
): AnalyzeResponse => {
  const grammarScore = computeGrammarScore(text, []);
  return {
    errors: [],
    corrected_text: text,
    unmapped: [{ reason }],
    drills: [],
    category_stats: [],
    grammar_score: grammarScore,
    analysis_status: "degraded",
    comparison: compareRewrite(previousErrors, [], previousGrammarScore, grammarScore),
  };
};

export const analyzeText = async (
  request: AnalyzeRequestBody,
  options: AnalyzeOptions
): Promise<AnalyzeResponse> => {
  let modelResponse;
  const startedAt = Date.now();

  try {
    modelResponse = await detectWithModel(options.apiKey, request.text, options.model);
  } catch (error) {
    console.warn("[verbum] model detection failed", {
      model: options.model,
      message: error instanceof Error ? error.message : String(error),
      duration_ms: Date.now() - startedAt,
    });
    return fallbackResponse(
      request.text,
      "model_output_invalid",
      request.previous_errors,
      request.previous_grammar_score
    );
  }

  const withSpans = computeSpans(modelResponse, request.text);
  const validated = validateErrors(withSpans.errors, request.text, allowedRuleIds);
  const errors = validated.errors;
  const grammarScore = computeGrammarScore(request.text, errors);
  const correctedText = applyCorrections(request.text, errors);
  const response = {
    errors,
    corrected_text: correctedText,
    unmapped: [...withSpans.unmapped, ...validated.unmapped],
    drills: generateDrillsFromErrors(errors),
    category_stats: computeCategoryStats(errors),
    grammar_score: grammarScore,
    analysis_status: "ok" as const,
    comparison: compareRewrite(
      request.previous_errors,
      errors,
      request.previous_grammar_score,
      grammarScore
    ),
  };

  console.info("[verbum] analysis complete", {
    model: options.model,
    errors: response.errors.length,
    unmapped: response.unmapped.length,
    drills: response.drills.length,
    score: response.grammar_score,
    duration_ms: Date.now() - startedAt,
  });

  return response;
};
