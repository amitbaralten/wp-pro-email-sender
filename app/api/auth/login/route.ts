import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    const envEmail = process.env.DASHBOARD_EMAIL?.trim();
    const envPassword = process.env.DASHBOARD_PASSWORD?.trim();
    const secret = process.env.AUTH_SECRET?.trim() || "default_auth_secret";

    if (envEmail && envPassword) {
      if (email !== envEmail || password !== envPassword) {
        return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
      }
    }

    const response = NextResponse.json({ success: true });
    response.cookies.set("auth_token", secret, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });

    return response;
  } catch {
    return NextResponse.json({ error: "Authentication failed." }, { status: 500 });
  }
}
