"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

export function useSupabaseSession() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    try {
      const supabase = createClient();
      void supabase.auth.getSession().then(({ data: { session } }) => {
        if (mounted) {
          setUser(session?.user ?? null);
          setLoading(false);
        }
      });
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        if (mounted) setUser(session?.user ?? null);
      });
      return () => {
        mounted = false;
        subscription.unsubscribe();
      };
    } catch {
      if (mounted) {
        setUser(null);
        setLoading(false);
      }
      return () => { mounted = false; };
    }
  }, []);

  return { user, loading, session: user ? { user: { id: user.id, email: user.email ?? "", name: (user.user_metadata?.name as string) ?? user.email ?? "" } } : null };
}
