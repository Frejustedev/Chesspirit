"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Chess } from "chess.js";
import { Link } from "@/i18n/navigation";
import { Button, Field, Select } from "@/components/ui/form";
import { readScoresheetAction, saveScoresheetGameAction } from "@/app/actions/ocr";

type Pairing = { id: string; label: string };

/** Premier coup illégal d'une suite en notation algébrique (null si tout est jouable). */
function firstIllegal(text: string): { index: number; san: string } | null {
  const tokens = text
    .replace(/\{[^}]*\}/g, " ")
    .split(/\s+/)
    .map((x) => x.replace(/^\d+\.(\.\.)?/, ""))
    .filter((x) => x && !/^(1-0|0-1|1\/2-1\/2|\*)$/.test(x));
  const c = new Chess();
  for (let i = 0; i < tokens.length; i++) {
    try {
      c.move(tokens[i]!);
    } catch {
      return { index: i + 1, san: tokens[i]! };
    }
  }
  return null;
}

export function ScoresheetPanel({
  tournamentId,
  pairings,
}: {
  tournamentId: string;
  pairings: Pairing[];
}) {
  const t = useTranslations("scoresheet");
  const [pairing, setPairing] = useState(pairings[0]?.id ?? "");
  const [moves, setMoves] = useState("");
  const [simulated, setSimulated] = useState(false);
  const [msg, setMsg] = useState<{ text: string; error: boolean } | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const illegal = useMemo(() => (moves.trim() ? firstIllegal(moves) : null), [moves]);
  const err = (code: string) =>
    t.has(`errors.${code}`) ? t(`errors.${code}`) : t("errors.generic");
  // Après un enregistrement, la liste se vide peut-être : on garde la confirmation affichée.
  if (!pairings.length && !saved) return <p className="text-stone">{t("noPairings")}</p>;
  return (
    <div className="space-y-6">
      <p className="text-sm text-stone">{t("help")}</p>
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          fd.set("tournamentId", tournamentId);
          start(async () => {
            const r = await readScoresheetAction(fd);
            if (!r.ok) return setMsg({ text: err(r.error), error: true });
            setMoves(r.data!.moves);
            setSimulated(r.data!.simulated);
            setSaved(null);
            setMsg(null);
          });
        }}
      >
        <Field id="ss-pairing" label={t("pairing")}>
          <Select id="ss-pairing" value={pairing} onChange={(e) => setPairing(e.target.value)}>
            {pairings.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="ss-photo" label={t("photo")} hint={t("photoHint")}>
          <input
            id="ss-photo"
            name="photo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            required
            className="mt-1 block w-full text-sm"
          />
        </Field>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={busy}>
            {t("read")}
          </Button>
        </div>
      </form>
      {simulated ? (
        <p className="rounded-md border border-gold bg-gold/10 p-3 text-sm font-semibold">
          {t("simulated")}
        </p>
      ) : null}
      <div>
        <label htmlFor="ss-moves" className="block text-sm font-semibold">
          {t("moves")}
        </label>
        <textarea
          id="ss-moves"
          rows={6}
          value={moves}
          onChange={(e) => setMoves(e.target.value)}
          aria-describedby="ss-check"
          className="mt-1 w-full rounded-md border border-line bg-field p-3 font-mono text-sm"
        />
        <p
          id="ss-check"
          className={`mt-1 text-sm font-semibold ${illegal ? "text-accent" : "text-success"}`}
          aria-live="polite"
        >
          {moves.trim()
            ? illegal
              ? t("illegalAt", { n: illegal.index, san: illegal.san })
              : t("allLegal")
            : ""}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          disabled={busy || !moves.trim() || !!illegal || !pairing}
          onClick={() =>
            start(async () => {
              const r = await saveScoresheetGameAction({ pairingId: pairing, moves });
              if (!r.ok) return setMsg({ text: err(r.error), error: true });
              setSaved(r.data!.gameId);
              setMsg({ text: t("saved"), error: false });
            })
          }
        >
          {t("save")}
        </Button>
        {msg ? (
          <span
            role={msg.error ? "alert" : "status"}
            className={`text-sm font-semibold ${msg.error ? "text-accent" : "text-success"}`}
          >
            {msg.text}
          </span>
        ) : null}
        {saved ? (
          <Link href={`/parties/${saved}`} className="text-sm font-semibold text-accent underline">
            {t("viewGame")}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
