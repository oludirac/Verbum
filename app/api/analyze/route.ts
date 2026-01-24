import fs from "fs";
import path from "path";
import OpenAI from "openai";
import { NextResponse } from "next/server";

type AnalyzeRequestBody = {
  text: string;
};

type AnalyzeError = {
  span: { start: number; end: number; text: string };
  category: string;
  rule_id: string;
  severity: number;
  correction: string;
  confidence: number;
};

type ModelAnalyzeError = {
  span: { text: string };
  category: string;
  rule_id: string;
  severity: number;
  correction: string;
  confidence: number;
};

type CategoryStats = {
  category: string;
  subcategory: string;
  count: number;
};

type AnalyzeResponse = {
  grammar_score: number;
  errors: AnalyzeError[];
  corrected_text: string;
  unmapped: unknown[];
  drills: unknown[];
  category_stats?: CategoryStats[];
};

type ModelAnalyzeResponse = {
  errors: ModelAnalyzeError[];
  corrected_text: string;
  unmapped: unknown[];
  drills: unknown[];
};

type DrillTemplate = {
  type: string;
  prompt: string;
  answer: string;
  options?: string[];
};

type RuleBankEntry = {
  rule_id: string;
  category?: string;
  subcategory?: string;
  rule_type?: string;
  title?: string;
  explanation_es?: string;
  examples?: Array<{ bad: string; good: string }>;
  drill_templates?: DrillTemplate[];
};

type GeneratedDrill = {
  rule_id: string;
  type: string;
  prompt: string;
  answer: string;
  options?: string[];
};

const RULES_PATH = path.join(process.cwd(), "rules", "rule_bank_v0.json");
const RULES_RAW = fs.readFileSync(RULES_PATH, "utf8");
const RULES_CACHE = JSON.parse(RULES_RAW) as RuleBankEntry[];
const ALLOWED_RULE_IDS = new Set(RULES_CACHE.map((rule) => rule.rule_id));
const RULES_MAP = new Map(RULES_CACHE.map((rule) => [rule.rule_id, rule]));
const PROMPT_RULES_LIST = RULES_CACHE.map((rule) => ({
  rule_id: rule.rule_id,
  title: rule.title,
  rule_type: rule.rule_type,
  explanation: rule.explanation_es,
  examples: rule.examples,
}));
const PROMPT_PATH = path.join(process.cwd(), "prompts", "detect_errors_v0.txt");
const BASE_PROMPT = fs.readFileSync(PROMPT_PATH, "utf8");

const isValidAnalyzeResponse = (data: unknown): data is AnalyzeResponse => {
  if (!data || typeof data !== "object") {
    return false;
  }
  const candidate = data as AnalyzeResponse;
  if (
    typeof candidate.grammar_score !== "number" ||
    typeof candidate.corrected_text !== "string" ||
    !Array.isArray(candidate.errors) ||
    !Array.isArray(candidate.unmapped) ||
    !Array.isArray(candidate.drills)
  ) {
    return false;
  }

  return candidate.errors.every((error) => {
    if (!error || typeof error !== "object") {
      return false;
    }
    return (
      typeof error.category === "string" &&
      typeof error.rule_id === "string" &&
      typeof error.severity === "number" &&
      typeof error.correction === "string" &&
      typeof error.confidence === "number" &&
      typeof error.span === "object" &&
      error.span !== null &&
      typeof error.span.start === "number" &&
      typeof error.span.end === "number" &&
      typeof error.span.text === "string"
    );
  });
};

const isValidModelResponse = (data: unknown): data is ModelAnalyzeResponse => {
  if (!data || typeof data !== "object") {
    return false;
  }
  const candidate = data as ModelAnalyzeResponse;
  if (
    typeof candidate.corrected_text !== "string" ||
    !Array.isArray(candidate.errors) ||
    !Array.isArray(candidate.unmapped) ||
    !Array.isArray(candidate.drills)
  ) {
    return false;
  }

  return candidate.errors.every((error) => {
    if (!error || typeof error !== "object") {
      return false;
    }
    return (
      typeof error.category === "string" &&
      typeof error.rule_id === "string" &&
      typeof error.severity === "number" &&
      typeof error.correction === "string" &&
      typeof error.confidence === "number" &&
      typeof error.span === "object" &&
      error.span !== null &&
      typeof error.span.text === "string"
    );
  });
};

const extractResponseText = (response: unknown) => {
  if (!response || typeof response !== "object") {
    return null;
  }
  const candidate = response as { output_text?: string; output?: unknown[] };
  if (typeof candidate.output_text === "string") {
    return candidate.output_text;
  }
  if (Array.isArray(candidate.output)) {
    for (const item of candidate.output) {
      if (!item || typeof item !== "object") {
        continue;
      }
      const outputItem = item as { content?: Array<{ text?: string }> };
      const text = outputItem.content?.find((entry) => entry.text)?.text;
      if (text) {
        return text;
      }
    }
  }
  return null;
};

const sanitizeModelJson = (text: string) => {
  let cleaned = text.replace(/^\uFEFF/, "");
  cleaned = cleaned.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
  cleaned = cleaned.trim();

  if (cleaned.startsWith("```")) {
    const lines = cleaned.split("\n");
    const firstFenceIndex = lines.findIndex((line) => line.startsWith("```"));
    if (firstFenceIndex >= 0) {
      lines.shift();
      const lastFenceIndex = lines
        .slice()
        .reverse()
        .findIndex((line) => line.startsWith("```"));
      if (lastFenceIndex >= 0) {
        lines.splice(lines.length - 1 - lastFenceIndex, 1);
      }
      cleaned = lines.join("\n").trim();
    }
  }

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace >= 0 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1).trim();
  }

  return cleaned;
};

const parseOrNull = (rawText: string) => {
  try {
    return JSON.parse(sanitizeModelJson(rawText));
  } catch {
    return null;
  }
};

const buildFallbackResponse = (sourceText: string): AnalyzeResponse => ({
  grammar_score: 0,
  errors: [],
  corrected_text: sourceText,
  unmapped: [{ reason: "model_output_invalid" }],
  drills: [],
});

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

const normalizeResponse = (
  parsed: AnalyzeResponse,
  originalText: string,
  allowedRuleIds: Set<string>
) => {
  const unmapped = Array.isArray(parsed.unmapped)
    ? [...parsed.unmapped]
    : [];
  const candidateErrors: AnalyzeError[] = [];

  for (const error of parsed.errors) {
    if (!error || typeof error !== "object") {
      unmapped.push({ reason: "invalid_error_shape" });
      continue;
    }

    if (!allowedRuleIds.has(error.rule_id)) {
      unmapped.push({
        span: error.span,
        text: error.span?.text,
        correction: error.correction,
        reason: "unknown_rule_id",
      });
      continue;
    }

    candidateErrors.push(error);
  }

  const validatedErrors: AnalyzeError[] = [];
  for (const error of candidateErrors) {
    const { span } = error;
    const clampedSeverity = clampSeverity(error.severity);
    const startValid = Number.isInteger(span.start);
    const endValid = Number.isInteger(span.end);
    const withinBounds =
      span.start >= 0 &&
      span.end <= originalText.length &&
      span.start < span.end;
    const matchesText =
      originalText.slice(span.start, span.end) === span.text;

    if (!startValid || !endValid || !withinBounds || !matchesText) {
      unmapped.push({
        span,
        text: span.text,
        correction: error.correction,
        reason: "invalid_span",
      });
      continue;
    }

    const originalSpanLength = span.end - span.start;
    const correctionLength = error.correction.length;
    const excessiveLength =
      originalSpanLength > 0 && correctionLength > originalSpanLength * 2;
    const clauseCount = countClauseDelimiters(error.correction);
    const tooManyClauses = clauseCount > 1;

    if (excessiveLength || tooManyClauses) {
      unmapped.push({
        span,
        text: span.text,
        correction: error.correction,
        reason: "non_minimal_edit",
      });
      continue;
    }

    validatedErrors.push({ ...error, severity: clampedSeverity });
  }

  const sorted = [...validatedErrors].sort(
    (a, b) => a.span.start - b.span.start
  );
  const nonOverlapping: AnalyzeError[] = [];

  for (const error of sorted) {
    const last = nonOverlapping[nonOverlapping.length - 1];
    if (!last) {
      nonOverlapping.push(error);
      continue;
    }

    const overlaps = error.span.start < last.span.end;
    if (!overlaps) {
      nonOverlapping.push(error);
      continue;
    }

    const keepCurrent = error.severity > last.severity;
    if (keepCurrent) {
      const removed = nonOverlapping.pop();
      if (removed) {
        unmapped.push({
          span: removed.span,
          text: removed.span.text,
          correction: removed.correction,
          reason: "overlap_lower_severity",
        });
      }
      nonOverlapping.push(error);
    } else {
      unmapped.push({
        span: error.span,
        text: error.span.text,
        correction: error.correction,
        reason: "overlap_lower_severity",
      });
    }
  }

  return {
    ...parsed,
    errors: nonOverlapping,
    unmapped,
  };
};

const computeSpans = (
  parsed: ModelAnalyzeResponse,
  originalText: string
): AnalyzeResponse => {
  const unmapped = Array.isArray(parsed.unmapped)
    ? [...parsed.unmapped]
    : [];
  const computedErrors: AnalyzeError[] = [];
  
  // Track used positions to handle duplicate text occurrences
  const usedPositions: Array<{ start: number; end: number }> = [];
  
  const isPositionUsed = (start: number, end: number) => {
    return usedPositions.some(
      (pos) => start < pos.end && end > pos.start
    );
  };
  
  const findNextAvailableMatch = (spanText: string, searchStart: number = 0): number => {
    let index = originalText.indexOf(spanText, searchStart);
    while (index >= 0) {
      const end = index + spanText.length;
      if (!isPositionUsed(index, end)) {
        return index;
      }
      // Try to find another occurrence
      index = originalText.indexOf(spanText, index + 1);
    }
    return -1;
  };

  for (const error of parsed.errors) {
    const spanText = error.span?.text;
    if (!spanText || typeof spanText !== "string") {
      unmapped.push({ reason: "missing_span_text" });
      continue;
    }

    const matchIndex = findNextAvailableMatch(spanText);
    if (matchIndex < 0) {
      unmapped.push({
        text: spanText,
        correction: error.correction,
        reason: "span_text_not_found",
      });
      continue;
    }

    const start = matchIndex;
    const end = matchIndex + spanText.length;
    usedPositions.push({ start, end });
    
    computedErrors.push({
      ...error,
      span: {
        start,
        end,
        text: spanText,
      },
    });
  }

  return {
    grammar_score: 0,
    errors: computedErrors,
    corrected_text: parsed.corrected_text,
    unmapped,
    drills: parsed.drills,
  };
};

const computeGrammarScore = (
  errors: AnalyzeError[],
  originalText: string
) => {
  const wordCount = originalText.trim().length
    ? originalText.trim().split(/\s+/).length
    : 0;
  const errorPoints = errors.reduce(
    (sum, error) => sum + clampSeverity(error.severity),
    0
  );
  const density = errorPoints / Math.max(wordCount, 1);
  const raw = Math.max(0, 1 - density * 5);
  const score = Math.round(raw * 10) / 10;
  return { score, wordCount, errorPoints };
};

const generateDrillsFromErrors = (errors: AnalyzeError[]): GeneratedDrill[] => {
  const drills: GeneratedDrill[] = [];
  const usedTemplates = new Set<string>();

  for (const error of errors) {
    const rule = RULES_MAP.get(error.rule_id);
    if (!rule || !rule.drill_templates || rule.drill_templates.length === 0) {
      continue;
    }

    // Pick the first unused template for this rule, or the first one if all used
    const template = rule.drill_templates.find(
      (t) => !usedTemplates.has(`${error.rule_id}-${t.type}-${t.prompt}`)
    ) || rule.drill_templates[0];

    const templateKey = `${error.rule_id}-${template.type}-${template.prompt}`;
    usedTemplates.add(templateKey);

    // Substitute placeholders with actual error data
    let prompt = template.prompt;
    let answer = template.answer;

    // Replace {{bad}} with the user's actual error text
    if (prompt.includes("{{bad}}")) {
      prompt = prompt.replace("{{bad}}", error.span.text);
    }
    // Replace {{good}} with the correction
    if (answer.includes("{{good}}")) {
      answer = answer.replace("{{good}}", error.correction);
    }
    if (prompt.includes("{{good}}")) {
      prompt = prompt.replace("{{good}}", error.correction);
    }

    const drill: GeneratedDrill = {
      rule_id: error.rule_id,
      type: template.type,
      prompt,
      answer,
    };

    if (template.options) {
      drill.options = template.options;
    }

    drills.push(drill);
  }

  // Limit to max 5 drills to not overwhelm the user
  return drills.slice(0, 5);
};

const computeCategoryStats = (errors: AnalyzeError[]): CategoryStats[] => {
  const statsMap = new Map<string, CategoryStats>();

  for (const error of errors) {
    const rule = RULES_MAP.get(error.rule_id);
    const category = rule?.category || "OTHER";
    const subcategory = rule?.subcategory || "unknown";
    const key = `${category}:${subcategory}`;

    const existing = statsMap.get(key);
    if (existing) {
      existing.count++;
    } else {
      statsMap.set(key, { category, subcategory, count: 1 });
    }
  }

  // Sort by count descending
  return Array.from(statsMap.values()).sort((a, b) => b.count - a.count);
};

// ============================================
// Rate Limiting (in-memory, resets on cold start)
// ============================================
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10; // 10 requests per minute per IP

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

const getRateLimitKey = (request: Request): string => {
  // Try to get IP from various headers (Vercel, Cloudflare, etc.)
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const cfIp = request.headers.get("cf-connecting-ip");
  return forwarded?.split(",")[0]?.trim() || realIp || cfIp || "unknown";
};

const checkRateLimit = (ip: string): { allowed: boolean; remaining: number } => {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1 };
  }

  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, remaining: 0 };
  }

  entry.count++;
  return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - entry.count };
};

// ============================================
// Input Validation
// ============================================
const MIN_TEXT_LENGTH = 10;
const MAX_TEXT_LENGTH = 2000;

const validateInput = (text: string): { valid: boolean; error?: string } => {
  const trimmed = text.trim();
  
  if (!trimmed) {
    return { valid: false, error: "Text cannot be empty." };
  }
  
  if (trimmed.length < MIN_TEXT_LENGTH) {
    return { valid: false, error: `Text must be at least ${MIN_TEXT_LENGTH} characters.` };
  }
  
  if (text.length > MAX_TEXT_LENGTH) {
    return { valid: false, error: `Text cannot exceed ${MAX_TEXT_LENGTH} characters.` };
  }
  
  return { valid: true };
};

// ============================================
// API Handler
// ============================================
export async function POST(request: Request) {
  // Rate limiting
  const clientIp = getRateLimitKey(request);
  const rateLimit = checkRateLimit(clientIp);
  
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment and try again." },
      { 
        status: 429,
        headers: { "Retry-After": "60" }
      }
    );
  }

  let body: AnalyzeRequestBody | null = null;

  try {
    body = (await request.json()) as AnalyzeRequestBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  if (!body || typeof body.text !== "string") {
    return NextResponse.json(
      { error: "Invalid request: text must be a string." },
      { status: 400 }
    );
  }

  // Input validation
  const validation = validateInput(body.text);
  if (!validation.valid) {
    return NextResponse.json(
      { error: validation.error },
      { status: 400 }
    );
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "Server misconfiguration." },
      { status: 500 }
    );
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const ruleList = JSON.stringify(PROMPT_RULES_LIST, null, 2);
  const prompt = BASE_PROMPT.replace("{{RULE_LIST}}", ruleList).replace(
    "{{USER_TEXT}}",
    body.text
  );

  if (process.env.NODE_ENV !== "production") {
    console.info("[analyze] prompt_preview:", prompt.slice(0, 3000));
  }

  const buildResponseRequest = () => {
    const base = {
      model: "gpt-4o",
      input: [{ role: "user", content: prompt }],
      temperature: 0,
      max_output_tokens: 2500,
    };
    return base;
  };

  const createResponse = (body: unknown) =>
    client.responses.create(body as any);

  try {
    const requestStart = Date.now();
    const openAiStart = Date.now();
    const response = await createResponse(buildResponseRequest());
    const outputText = extractResponseText(response);
    const openAiDuration = Date.now() - openAiStart;
    if (!outputText) {
      const totalDuration = Date.now() - requestStart;
      console.info("[analyze] timings", {
        openai_ms: openAiDuration,
        parse_ms: 0,
        firewall_ms: 0,
        total_ms: totalDuration,
      });
      return NextResponse.json(buildFallbackResponse(body.text));
    }

    // Debug: log raw model output
    if (process.env.NODE_ENV !== "production") {
      console.info("[analyze] raw_model_output:", outputText);
    }

    const parseStart = Date.now();
    const parsed = parseOrNull(outputText);
    const parseDuration = Date.now() - parseStart;
    if (!parsed) {
      console.warn("[analyze] parse_failed - raw output:", outputText);
      const totalDuration = Date.now() - requestStart;
      console.info("[analyze] timings", {
        openai_ms: openAiDuration,
        parse_ms: parseDuration,
        firewall_ms: 0,
        total_ms: totalDuration,
      });
      return NextResponse.json(buildFallbackResponse(body.text));
    }

    if (!isValidModelResponse(parsed)) {
      console.warn("[analyze] invalid_model_response - parsed:", JSON.stringify(parsed, null, 2));
      const totalDuration = Date.now() - requestStart;
      console.info("[analyze] timings", {
        openai_ms: openAiDuration,
        parse_ms: parseDuration,
        firewall_ms: 0,
        total_ms: totalDuration,
      });
      return NextResponse.json(buildFallbackResponse(body.text));
    }

    if (process.env.NODE_ENV !== "production") {
      console.info(
        `[analyze] parsedErrors=${parsed.errors.length} parsedUnmapped=${parsed.unmapped.length}`
      );
    }

    const withComputedSpans = computeSpans(parsed, body.text);
    const firewallStart = Date.now();
    const normalized = normalizeResponse(
      withComputedSpans,
      body.text,
      ALLOWED_RULE_IDS
    );
    const firewallDuration = Date.now() - firewallStart;

    if (!isValidAnalyzeResponse(normalized)) {
      console.warn("[analyze] final_validation_failed - normalized:", JSON.stringify(normalized, null, 2));
      const totalDuration = Date.now() - requestStart;
      console.info("[analyze] timings", {
        openai_ms: openAiDuration,
        parse_ms: parseDuration,
        firewall_ms: firewallDuration,
        total_ms: totalDuration,
      });
      return NextResponse.json(buildFallbackResponse(body.text));
    }

    const { score, wordCount, errorPoints } = computeGrammarScore(
      normalized.errors,
      body.text
    );

    // Generate drills server-side from rule templates
    const serverDrills = generateDrillsFromErrors(normalized.errors);

    // Compute category statistics for analytics
    const categoryStats = computeCategoryStats(normalized.errors);

    const finalResponse: AnalyzeResponse = {
      ...normalized,
      grammar_score: score,
      drills: serverDrills,
      category_stats: categoryStats,
    };

    const totalDuration = Date.now() - requestStart;
    const categoryBreakdown = categoryStats.map((s) => `${s.category}.${s.subcategory}:${s.count}`).join(", ");
    console.info(
      `[analyze] score=${score} errors=${normalized.errors.length} drills=${serverDrills.length} words=${wordCount} points=${errorPoints} categories=[${categoryBreakdown}]`
    );
    console.info("[analyze] timings", {
      openai_ms: openAiDuration,
      parse_ms: parseDuration,
      firewall_ms: firewallDuration,
      total_ms: totalDuration,
    });

    return NextResponse.json(finalResponse);
  } catch (error) {
    console.error("[analyze] failed:", error);
    return NextResponse.json(
      { error: "Analysis failed." },
      { status: 500 }
    );
  }
}
