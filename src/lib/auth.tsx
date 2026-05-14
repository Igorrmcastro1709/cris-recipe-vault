import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

interface AuthState {
  user: User | null;
  session: Session | null;
  isAdmin: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

async function fetchIsAdmin(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) return false;
  return !!data;
}

async function ensureProfile(user: User) {
  await supabase
    .from("profiles")
    .upsert(
      {
        user_id: user.id,
        display_name:
          (user.user_metadata?.full_name as string | undefined) ??
          (user.user_metadata?.name as string | undefined) ??
          user.email?.split("@")[0] ??
          null,
        avatar_url: (user.user_metadata?.avatar_url as string | undefined) ?? null,
      },
      { onConflict: "user_id", ignoreDuplicates: false },
    );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();
  const router = useRouter();

  useEffect(() => {
    // Listener FIRST, then getSession (per Supabase docs)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (newSession?.user) {
        // Defer non-auth Supabase calls to avoid deadlocks inside the callback
        setTimeout(async () => {
          if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
            await ensureProfile(newSession.user);
            // First user becomes admin (no-op if already exists)
            try { await supabase.rpc("claim_admin_if_first"); } catch { /* ignore */ }
          }
          const admin = await fetchIsAdmin(newSession.user.id);
          setIsAdmin(admin);
        }, 0);
      } else {
        setIsAdmin(false);
      }

      // Invalidate every query so user-scoped data refreshes
      router.invalidate();
      queryClient.invalidateQueries();
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) {
        fetchIsAdmin(data.session.user.id).then(setIsAdmin);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, isAdmin, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
