import fs from "fs";
import path from "path";
import OpenAI from "openai";
import type { ResponseCreateParamsNonStreaming } from "openai/resources/responses/responses";
import { isModelAnalyzeResponse } from "./guards";
import { rulesForPrompt } from "./rules";
import { modelAnalyzeJsonSchema } from "./schema";
import type { ModelAnalyzeResponse } from "./types";

const PROMPT_PATH = path.join(process.cwd(), "prompts", "detect_errors_v0.txt");
const BASE_PROMPT = fs.readFileSync(PROMPT_PATH, "utf8");

const DEFAULT_MODEL = "gpt-4.1-mini";

const buildPrompt = (text: string) =>
  BASE_PROMPT.replace("{{RULE_LIST}}", JSON.stringify(rulesForPrompt, null, 2)).replace(
    "{{USER_TEXT}}",
    text
  );

export const buildModelRequest = (
  text: string,
  model = DEFAULT_MODEL
): ResponseCreateParamsNonStreaming => ({
  model: model as ResponseCreateParamsNonStreaming["model"],
  instructions:
    "You are Verbum's detection layer. Propose Spanish grammar diagnostics only. Do not rewrite for style, prose, tone, elegance, or vocabulary preference.",
  input: buildPrompt(text),
  temperature: 0,
  max_output_tokens: 1400,
  store: false,
  text: {
    format: {
      type: "json_schema",
      name: "verbum_candidate_diagnostics",
      strict: true,
      schema: modelAnalyzeJsonSchema,
    },
  },
});

const parseOutput = (outputText: string): unknown => {
  try {
    return JSON.parse(outputText);
  } catch {
    return null;
  }
};

export const detectWithModel = async (
  apiKey: string,
  text: string,
  model = DEFAULT_MODEL
): Promise<ModelAnalyzeResponse> => {
  const client = new OpenAI({ apiKey });
  const response = await client.responses.create(buildModelRequest(text, model));
  const parsed = parseOutput(response.output_text ?? "");

  if (!isModelAnalyzeResponse(parsed)) {
    throw new Error("model_output_invalid");
  }

  return parsed;
};
