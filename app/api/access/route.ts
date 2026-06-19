import { NextResponse } from "next/server";
import {
  ACCESS_COOKIE_NAME,
  createAccessToken,
  isAccessControlEnabled,
  isValidAccessCode,
  isValidAccessToken,
} from "@/core/access";
import { checkRateLimit, getClientKey } from "@/core/rate-limit";

const ACCESS_WINDOW_MS = 10 * 60 * 1000;
const ACCESS_MAX_ATTEMPTS = 10;
const ACCESS_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export async function GET(request: Request) {
  const cookie = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${ACCESS_COOKIE_NAME}=`))
    ?.split("=")[1];

  return NextResponse.json({
    enabled: isAccessControlEnabled(),
    authenticated: isValidAccessToken(cookie),
  });
}

export async function POST(request: Request) {
  const limited = checkRateLimit(
    "access",
    getClientKey(request),
    ACCESS_MAX_ATTEMPTS,
    ACCESS_WINDOW_MS
  );

  if (!limited.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Wait a moment and try again." },
      {
        status: 429,
        headers: { "Retry-After": String(limited.retryAfterSeconds) },
      }
    );
  }

  if (!isAccessControlEnabled()) {
    return NextResponse.json({ authenticated: true });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const accessCode =
    body && typeof body === "object"
      ? (body as { access_code?: unknown }).access_code
      : undefined;

  if (!isValidAccessCode(accessCode)) {
    return NextResponse.json({ error: "Incorrect access code." }, { status: 401 });
  }

  const response = NextResponse.json({ authenticated: true });
  response.cookies.set({
    name: ACCESS_COOKIE_NAME,
    value: createAccessToken(),
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ACCESS_COOKIE_MAX_AGE,
  });

  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ authenticated: false });
  response.cookies.set({
    name: ACCESS_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  return response;
}
