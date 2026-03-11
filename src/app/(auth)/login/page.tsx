"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError("Invalid email or password");
        setLoading(false);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center px-4" style={{ background: "var(--background)" }}>
      <div className="w-full max-w-sm animate-fade-in">
        <div className="mb-8 text-center">
          <div className="mb-4 text-5xl">🎙️</div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: "var(--foreground)" }}>
            PM Interviews
          </h1>
          <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
            Sign in to start interviewing
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div
              className="rounded-xl px-4 py-3 text-sm"
              style={{ background: "#ff3b3014", color: "var(--danger)" }}
            >
              {error}
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-medium" style={{ color: "var(--foreground)" }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-xl border px-4 py-3 text-sm transition-all"
              style={{
                background: "var(--card)",
                borderColor: "var(--card-border)",
                color: "var(--foreground)",
              }}
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium" style={{ color: "var(--foreground)" }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-xl border px-4 py-3 text-sm transition-all"
              style={{
                background: "var(--card)",
                borderColor: "var(--card-border)",
                color: "var(--foreground)",
              }}
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl py-3 text-sm font-medium text-white transition-all hover:opacity-90 disabled:opacity-50"
            style={{ background: "var(--accent)" }}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm" style={{ color: "var(--muted)" }}>
          Don&apos;t have an account?{" "}
          <Link
            href="/register"
            className="font-medium transition-colors hover:opacity-80"
            style={{ color: "var(--accent)" }}
          >
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
