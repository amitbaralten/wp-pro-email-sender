"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock, Mail, Globe } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        if (!res.ok || data.error) {
          setError(data.error || "Invalid credentials.");
        } else {
          router.push("/");
          router.refresh();
        }
      } catch {
        setError("Sign in failed. Please try again.");
      }
    });
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 text-slate-100">
      <div className="w-full max-w-md space-y-8 rounded-2xl border border-slate-800 bg-slate-900/90 p-8 shadow-2xl backdrop-blur-xl">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-wppro-600 to-blue-500 text-white shadow-lg shadow-wppro-600/30">
            <Globe className="h-7 w-7" />
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-white">WP Pro Outreach Engine</h1>
          <p className="mt-1.5 text-sm text-slate-400">Sign in to access your WP Pro email dashboard</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                Email Address
              </label>
              <div className="relative mt-1.5 rounded-lg shadow-sm">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Mail className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="email"
                  name="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="admin@wppro.au"
                  className="block w-full rounded-lg border border-slate-700 bg-slate-950/80 pl-10 pr-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-wppro-500 focus:outline-none focus:ring-1 focus:ring-wppro-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                Password
              </label>
              <div className="relative mt-1.5 rounded-lg shadow-sm">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Lock className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="password"
                  name="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••••••"
                  className="block w-full rounded-lg border border-slate-700 bg-slate-950/80 pl-10 pr-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-wppro-500 focus:outline-none focus:ring-1 focus:ring-wppro-500"
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-red-900/50 bg-red-950/40 p-3 text-xs text-red-400">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-lg bg-gradient-to-r from-wppro-600 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:from-wppro-500 hover:to-blue-500 disabled:opacity-50"
          >
            {isPending ? "Signing in..." : "Sign In to Dashboard"}
          </button>
        </form>

        <div className="text-center">
          <a
            href="https://wppro.au/"
            target="_blank"
            rel="noreferrer"
            className="text-xs text-slate-500 hover:text-slate-400"
          >
            WP Pro | wppro.au
          </a>
        </div>
      </div>
    </div>
  );
}
