"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSupabaseSession } from "@/lib/supabase/session";
import { createClient } from "@/lib/supabase/client";
import { useState, useEffect } from "react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: "◻️" },
  { href: "/personas", label: "Personas", icon: "👥" },
  { href: "/interviews", label: "Interviews", icon: "🎙️" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { session, loading } = useSupabaseSession();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  useEffect(() => {
    if (loading) return;
    if (!session?.user) router.replace("/login");
  }, [loading, session?.user, router]);

  if (loading || !session?.user) {
    return (
      <div className="flex h-dvh items-center justify-center" style={{ background: "var(--background)" }}>
        <p style={{ color: "var(--muted)" }}>Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex h-dvh overflow-hidden" style={{ background: "var(--background)" }}>
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r transition-transform duration-200 md:static md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{
          background: "var(--sidebar-bg)",
          borderColor: "var(--card-border)",
        }}
      >
        <div className="flex h-14 items-center gap-2.5 border-b px-5" style={{ borderColor: "var(--card-border)" }}>
          <span className="text-xl">🎙️</span>
          <span className="text-sm font-semibold tracking-tight" style={{ color: "var(--foreground)" }}>
            PM Interviews
          </span>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-3">
          <div className="space-y-0.5">
            {navItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
                  style={{
                    background: isActive ? "var(--sidebar-active)" : "transparent",
                    color: isActive ? "var(--foreground)" : "var(--muted)",
                  }}
                >
                  <span className="text-base">{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="border-t p-3" style={{ borderColor: "var(--card-border)" }}>
          <div className="flex items-center justify-between rounded-lg px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium" style={{ color: "var(--foreground)" }}>
                {session?.user?.name || "User"}
              </p>
              <p className="truncate text-xs" style={{ color: "var(--muted)" }}>
                {session?.user?.email}
              </p>
            </div>
            <button
              onClick={handleSignOut}
              className="ml-2 shrink-0 rounded-lg p-1.5 text-xs transition-colors hover:opacity-70"
              style={{ color: "var(--muted)" }}
              title="Sign out"
            >
              ↗️
            </button>
          </div>
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header
          className="flex h-14 items-center border-b px-4 md:hidden"
          style={{
            background: "var(--card)",
            borderColor: "var(--card-border)",
          }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-2 transition-colors hover:opacity-70"
            style={{ color: "var(--foreground)" }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
          <span className="ml-3 text-sm font-semibold" style={{ color: "var(--foreground)" }}>
            PM Interviews
          </span>
        </header>

        <main className="flex-1 overflow-y-auto min-h-0">
          {children}
        </main>
      </div>
    </div>
  );
}
