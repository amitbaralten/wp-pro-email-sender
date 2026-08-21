"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  LEGACY_AUTH_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  createSessionToken,
  getRequiredAuthConfig,
  getSessionCookieOptions,
} from "@/lib/auth";

export type LoginState = { error: string | null } | null;

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = (formData.get("email") as string | null)?.trim();
  const password = (formData.get("password") as string | null)?.trim();

  const auth = getRequiredAuthConfig();

  if (email !== auth.email || password !== auth.password) {
    return { error: "Invalid email or password." };
  }

  const token = await createSessionToken(auth.email, auth.secret);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, getSessionCookieOptions());
  cookieStore.set(LEGACY_AUTH_COOKIE_NAME, "", {
    httpOnly: true,
    expires: new Date(0),
    path: "/",
  });

  redirect("/");
}
