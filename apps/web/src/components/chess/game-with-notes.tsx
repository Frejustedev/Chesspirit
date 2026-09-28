"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { GameViewer } from "./game-viewer";
import { Button } from "@/components/ui/form";

type Note = { id: string; ply: number; comment: string };

/** Lecteur + annotations personnelles (visibles uniquement par le joueur ou son parent). */
export function GameWithNotes({
  gameId,
  pgn,
  profileId,
}: {
  gameId: string;
  pgn: string;
  profileId: string | null;
}) {
  const t = useTranslations("notes");
  const [ply, setPly] = useState(0);
  const [san, setSan] = useState<string | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const onPly = useCallback((p: number, s: string | null) => {
    setPly(p);
    setSan(s);
  }, []);

  useEffect(() => {
    if (!profileId) return;
    createClient()
      .from("game_annotations")
      .select("id, ply, comment")
      .eq("game_id", gameId)
      .order("ply")
      .then(({ data }) => setNotes(data ?? []));
  }, [gameId, profileId]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!profileId || !text.trim()) return;
    setBusy(true);
    const { data } = await createClient()
      .from("game_annotations")
      .insert({ game_id: gameId, profile_id: profileId, ply, comment: text.trim().slice(0, 2000) })
      .select("id, ply, comment")
      .single();
    if (data) setNotes([...notes, data].sort((a, b) => a.ply - b.ply));
    setText("");
    setBusy(false);
  }

  async function remove(id: string) {
    await createClient().from("game_annotations").delete().eq("id", id);
    setNotes(notes.filter((n) => n.id !== id));
  }

  const panel = profileId ? (
    <section className="mt-6" aria-labelledby="notes-title">
      <h2 id="notes-title" className="font-display text-xl font-semibold">
        {t("title")}
      </h2>
      <p className="text-sm text-stone">{t("private")}</p>
      <ul className="mt-2 space-y-1">
        {notes.map((n) => (
          <li
            key={n.id}
            className={`flex items-start gap-2 rounded px-2 py-1 text-sm ${n.ply === ply ? "bg-gold-soft/50" : ""}`}
          >
            <span className="tabular shrink-0 font-semibold text-gold-deep">
              {n.ply
                ? t("ply", { n: Math.ceil(n.ply / 2), side: n.ply % 2 ? "" : "…" })
                : t("start")}
            </span>
            <span className="flex-1">{n.comment}</span>
            <button
              type="button"
              onClick={() => remove(n.id)}
              className="text-xs text-stone hover:text-bordeaux"
              aria-label={t("delete")}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={add} className="mt-2 flex gap-2">
        <label htmlFor="note" className="sr-only">
          {t("add")}
        </label>
        <input
          id="note"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={2000}
          placeholder={san ? t("placeholderMove", { san }) : t("placeholder")}
          className="min-h-11 min-w-0 flex-1 rounded-md border border-line bg-white px-3"
        />
        <Button type="submit" disabled={busy || !text.trim()} className="min-h-11 px-4 text-sm">
          {t("add")}
        </Button>
      </form>
    </section>
  ) : null;

  return <GameViewer pgn={pgn} onPlyChange={onPly} analysis={panel} />;
}
