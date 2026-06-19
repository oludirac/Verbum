import { NextResponse } from "next/server";
import { analyzeText, validateAnalyzeInput } from "@/core/analyzer";
import { ACCESS_COOKIE_NAME, isValidAccessToken } from "@/core/access";
import { checkRateLimit, getClientKey } from "@/core/rate-limit";

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 10;

const getAccessCookie = (request: Request) =>
  request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${ACCESS_COOKIE_NAME}=`))
    ?.split("=")[1];

export async function POST(request: Request) {
  if (!isValidAccessToken(getAccessCookie(request))) {
    return NextResponse.json({ error: "Access code required." }, { status: 401 });
  }

  const limited = checkRateLimit(
    "analyze",
    getClientKey(request),
    RATE_LIMIT_MAX_REQUESTS,
    RATE_LIMIT_WINDOW_MS
  );

  if (!limited.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Wait a moment and try again." },
      {
        status: 429,
        headers: { "Retry-After": String(limited.retryAfterSeconds) },
      }
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
