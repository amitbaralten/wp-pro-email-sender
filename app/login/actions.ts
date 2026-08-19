"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export type LoginState = { error: string | null } | null;

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = (formData.get("email") as string | null)?.trim();
  const password = (formData.get("password") as string | null)?.trim();

  const envEmail = process.env.DASHBOARD_EMAIL?.trim();
  const envPassword = process.env.DASHBOARD_PASSWORD?.trim();
  const secret = process.env.AUTH_SECRET?.trim() || "default_auth_secret";

  if (envEmail && envPassword) {
    if (email !== envEmail || password !== envPassword) {
      return { error: "Invalid email or password." };
    }
  }

  const cookieStore = await cookies();
  cookieStore.set("auth_token", secret, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });

  redirect("/");
}
