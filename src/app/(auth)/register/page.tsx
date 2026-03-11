"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
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
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
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
            Create Account
          </h1>
          <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
            Join your team to start interviewing PM personas
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
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full rounded-xl border px-4 py-3 text-sm transition-all"
              style={{
                background: "var(--card)",
                borderColor: "var(--card-border)",
                color: "var(--foreground)",
              }}
              placeholder="Your name"
            />
          </div>

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
              minLength={6}
              className="w-full rounded-xl border px-4 py-3 text-sm transition-all"
              style={{
                background: "var(--card)",
                borderColor: "var(--card-border)",
                color: "var(--foreground)",
              }}
              placeholder="At least 6 characters"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl py-3 text-sm font-medium text-white transition-all hover:opacity-90 disabled:opacity-50"
            style={{ background: "var(--accent)" }}
          >
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm" style={{ color: "var(--muted)" }}>
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium transition-colors hover:opacity-80"
            style={{ color: "var(--accent)" }}
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
