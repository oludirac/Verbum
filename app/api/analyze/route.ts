import { NextResponse } from "next/server";
import { analyzeText, validateAnalyzeInput } from "@/core/analyzer";

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 10;

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

const getRateLimitKey = (request: Request) => {
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const cfIp = request.headers.get("cf-connecting-ip");
  return forwarded?.split(",")[0]?.trim() || realIp || cfIp || "unknown";
};

const checkRateLimit = (key: string) => {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  entry.count += 1;
  return true;
};

export async function POST(request: Request) {
  if (!checkRateLimit(getRateLimitKey(request))) {
    return NextResponse.json(
      { error: "Too many requests. Wait a moment and try again." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  let analyzeRequest;
  try {
    analyzeRequest = validateAnalyzeInput(body);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid analyze request.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Server misconfiguration." },
      { status: 500 }
    );
  }

  const result = await analyzeText(analyzeRequest, {
    apiKey,
    model: process.env.VERBUM_MODEL,
  });

  return NextResponse.json(result);
}
