export const SESSION_COOKIE_NAME = "wp_pro_session";
export const LEGACY_AUTH_COOKIE_NAME = "auth_token";

const SESSION_TTL_SECONDS = 60 * 60 * 12;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export interface AuthConfig {
  email: string;
  password: string;
  secret: string;
}

interface SessionPayload {
  sub: string;
  iat: number;
  exp: number;
  v: 1;
}

export function getRequiredAuthConfig(): AuthConfig {
  const email = process.env.DASHBOARD_EMAIL?.trim();
  const password = process.env.DASHBOARD_PASSWORD?.trim();
  const secret = process.env.AUTH_SECRET?.trim();

  if (!email || !password || !secret) {
    throw new Error(
      "Dashboard authentication is not configured. Set DASHBOARD_EMAIL, DASHBOARD_PASSWORD, and AUTH_SECRET."
    );
  }

  if (secret.length < 32) {
    throw new Error("AUTH_SECRET must be at least 32 characters long.");
  }

  return { email, password, secret };
}

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    maxAge: SESSION_TTL_SECONDS,
    path: "/",
  };
}

function base64UrlEncodeBytes(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlEncodeString(value: string): string {
  return base64UrlEncodeBytes(encoder.encode(value));
}

function base64UrlDecodeToString(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return decoder.decode(bytes);
}

async function sign(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return base64UrlEncodeBytes(new Uint8Array(signature));
}

function constantTimeEqual(a: string, b: string): boolean {
  const maxLength = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;

  for (let i = 0; i < maxLength; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }

  return diff === 0;
}

export async function createSessionToken(email: string, secret: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    sub: email,
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
    v: 1,
  };
  const encodedPayload = base64UrlEncodeString(JSON.stringify(payload));
  const signature = await sign(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

export async function verifySessionToken(token: string | undefined, secret: string): Promise<boolean> {
  if (!token) return false;

  const [encodedPayload, signature, extra] = token.split(".");
  if (!encodedPayload || !signature || extra !== undefined) return false;

  const expectedSignature = await sign(encodedPayload, secret);
  if (!constantTimeEqual(signature, expectedSignature)) return false;

  try {
    const payload = JSON.parse(base64UrlDecodeToString(encodedPayload)) as Partial<SessionPayload>;
    const now = Math.floor(Date.now() / 1000);
    return payload.v === 1 && typeof payload.sub === "string" && typeof payload.exp === "number" && payload.exp > now;
  } catch {
    return false;
  }
}

