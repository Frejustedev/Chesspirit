import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, type Tables } from "./supabase";

type Ctx = {
  session: Session | null;
  profile: Tables<"profiles"> | null;
  loading: boolean;
  reload: () => Promise<void>;
};
const SessionContext = createContext<Ctx>({
  session: null,
  profile: null,
  loading: true,
  reload: async () => {},
});

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Tables<"profiles"> | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile(s: Session | null) {
    if (!s) return setProfile(null);
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", s.user.id)
      .is("merged_into", null)
      .maybeSingle();
    setProfile(data);
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await loadProfile(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      void loadProfile(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <SessionContext.Provider
      value={{ session, profile, loading, reload: () => loadProfile(session) }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export const useSession = () => useContext(SessionContext);
