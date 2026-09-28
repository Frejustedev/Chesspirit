"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Mise à jour en direct : abonnement Supabase Realtime aux rondes, appariements et classements
 * du tournoi, avec un rafraîchissement périodique de secours (réseau instable, Realtime indisponible).
 */
export function LiveRefresh({
  tournamentId,
  fallbackSeconds = 30,
}: {
  tournamentId: string;
  fallbackSeconds?: number;
}) {
  const router = useRouter();
  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 400);
    };
    const channel = supabase
      .channel(`tournament-${tournamentId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "pairings",
          filter: `tournament_id=eq.${tournamentId}`,
        },
        refresh,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "rounds",
          filter: `tournament_id=eq.${tournamentId}`,
        },
        refresh,
      )
      .subscribe();
    const poll = setInterval(() => router.refresh(), fallbackSeconds * 1000);
    return () => {
      clearInterval(poll);
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [router, tournamentId, fallbackSeconds]);
  return null;
}
