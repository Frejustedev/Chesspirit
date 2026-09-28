"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button, Input } from "@/components/ui/form";
import { fakeLinkLichessAction, unlinkLichessAction } from "@/app/actions/online";

export function LichessLink({
  username,
  fake,
  status,
}: {
  username: string | null;
  fake: boolean;
  status?: string;
}) {
  const t = useTranslations("lichessLink");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [u, setU] = useState("");
  const [msg, setMsg] = useState<string | null>(
    status && ["ok", "error", "taken"].includes(status) ? t(`status.${status}`) : null,
  );
  return (
    <section id="lichess" className="rounded-lg border border-line p-5">
      <h2 className="font-display text-2xl font-semibold">{t("title")}</h2>
      <p className="mt-1 text-sm text-stone">{t("help")}</p>
      {username ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="font-mono font-semibold">{username}</span>
          <Button
            variant="secondary"
            disabled={pending}
            onClick={() =>
              start(async () => {
                await unlinkLichessAction();
                router.refresh();
              })
            }
          >
            {t("unlink")}
          </Button>
        </div>
      ) : fake ? (
        <form
          className="mt-3 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await fakeLinkLichessAction(u);
              setMsg(r.ok ? t("status.ok") : t("status.error"));
              router.refresh();
            });
          }}
        >
          <label htmlFor="lichess-user" className="sr-only">
            {t("fakeLabel")}
          </label>
          <Input
            id="lichess-user"
            value={u}
            placeholder={t("fakeLabel")}
            onChange={(e) => setU(e.target.value)}
            className="max-w-xs"
          />
          <Button type="submit" disabled={pending || u.length < 2}>
            {t("fakeLink")}
          </Button>
          <p className="w-full text-xs text-stone">{t("fakeNote")}</p>
        </form>
      ) : (
        // Navigation complète vers la route d'autorisation (redirection vers Lichess).
        <form action="/api/lichess/connect" method="get" className="mt-3">
          <button
            type="submit"
            className="inline-flex min-h-11 items-center rounded-full bg-ink px-5 font-semibold text-cream hover:bg-bordeaux"
          >
            {t("link")}
          </button>
        </form>
      )}
      {msg ? (
        <p role="status" className="mt-3 text-sm font-semibold">
          {msg}
        </p>
      ) : null}
    </section>
  );
}
