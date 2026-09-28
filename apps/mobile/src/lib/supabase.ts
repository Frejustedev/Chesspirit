import "react-native-url-polyfill/auto";
import { AppState } from "react-native";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../../web/src/lib/supabase/types";
import { config } from "./config";
import { secureStorage } from "./storage";

/** Même base que le site, mêmes règles d'accès (RLS) : l'application n'a que la clé publique. */
export const supabase = createClient<Database>(config.supabaseUrl, config.supabaseAnonKey, {
  auth: {
    storage: secureStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Rafraîchissement du jeton seulement quand l'application est au premier plan.
AppState.addEventListener("change", (s) => {
  if (s === "active") supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
