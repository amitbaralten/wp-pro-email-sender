import { NextResponse } from "next/server";
import {
  LEGACY_AUTH_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  createSessionToken,
  getRequiredAuthConfig,
  getSessionCookieOptions,
} from "@/lib/auth";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const attempts = new Map<string, { count: number; resetAt: number }>();

function getClientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "local";
}

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const current = attempts.get(key);
  if (!current || current.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }

  current.count += 1;
  return current.count > MAX_ATTEMPTS;
}

function clearAttempts(key: string): void {
  attempts.delete(key);
}

function hasValidOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  return origin === new URL(request.url).origin;
}

export async function POST(request: Request) {
  try {
    if (!hasValidOrigin(request)) {
      return NextResponse.json({ error: "Invalid sign-in origin." }, { status: 403 });
    }

    const clientKey = getClientKey(request);
    if (isRateLimited(clientKey)) {
      return NextResponse.json({ error: "Too many sign-in attempts. Try again later." }, { status: 429 });
    }

    const { email, password } = await request.json();
    const auth = getRequiredAuthConfig();

    if (email !== auth.email || password !== auth.password) {
      return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
    }

    clearAttempts(clientKey);
    const token = await createSessionToken(auth.email, auth.secret);
    const response = NextResponse.json({ success: true });
    response.cookies.set(SESSION_COOKIE_NAME, token, getSessionCookieOptions());
    response.cookies.set(LEGACY_AUTH_COOKIE_NAME, "", {
      httpOnly: true,
      expires: new Date(0),
      path: "/",
    });

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Authentication failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
