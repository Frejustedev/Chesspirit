import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { formatDate } from "@chesspirit/shared";
import { Link } from "@/i18n/navigation";
import { requireSession, isAdminRole } from "@/lib/auth";
import { myGames, type GameFilters } from "@/lib/data/me";
import { AccountNav, AccountShell } from "@/components/account/account-nav";
import { IconDownload } from "@/components/icons";

export const metadata: Metadata = { robots: { index: false } };

export default async function MyGames({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<GameFilters>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const f = await searchParams;
  const session = await requireSession(locale, "/compte/parties");
  const t = await getTranslations("myGames");
  const games = await myGames(session, f);
  const qs = new URLSearchParams(
    Object.entries(f).filter(([, v]) => v) as [string, string][],
  ).toString();
  const input = "min-h-11 w-full rounded-md border border-line bg-white px-3";
  return (
    <AccountShell
      nav={<AccountNav current="/compte/parties" isAdmin={isAdminRole(session.roles)} />}
      title={t("title")}
    >
      <form className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6" action="/compte/parties">
        <label className="sr-only" htmlFor="opponent">
          {t("opponent")}
        </label>
        <input
          id="opponent"
          name="opponent"
          defaultValue={f.opponent}
          placeholder={t("opponent")}
          className={input}
        />
        <label className="sr-only" htmlFor="color">
          {t("color")}
        </label>
        <select id="color" name="color" defaultValue={f.color ?? ""} className={input}>
          <option value="">{t("anyColor")}</option>
          <option value="w">{t("white")}</option>
          <option value="b">{t("black")}</option>
        </select>
        <label className="sr-only" htmlFor="result">
          {t("result")}
        </label>
        <select id="result" name="result" defaultValue={f.result ?? ""} className={input}>
          <option value="">{t("anyResult")}</option>
          <option value="win">{t("win")}</option>
          <option value="draw">{t("draw")}</option>
          <option value="loss">{t("loss")}</option>
        </select>
        <label className="sr-only" htmlFor="eco">
          ECO
        </label>
        <input id="eco" name="eco" defaultValue={f.eco} placeholder={t("eco")} className={input} />
        <label className="sr-only" htmlFor="from">
          {t("from")}
        </label>
        <input
          id="from"
          name="from"
          type="date"
          defaultValue={f.from}
          className={input}
          aria-label={t("from")}
        />
        <button
          type="submit"
          className="min-h-11 rounded-full bg-ink px-4 font-semibold text-cream"
        >
          {t("filter")}
        </button>
      </form>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-stone">{t("count", { n: games.length })}</p>
        {games.length ? (
          <a
            href={`/api/me/games${qs ? `?${qs}` : ""}`}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-ink/25 px-4 font-semibold hover:bg-cream"
          >
            <IconDownload className="size-5" /> {t("downloadAll")}
          </a>
        ) : null}
      </div>
      <ul className="mt-4 divide-y divide-line border-y border-line">
        {games.map((g) => (
          <li key={g.id}>
            <Link
              href={`/parties/${g.id}`}
              className="grid grid-cols-[2.2rem_1fr_auto] items-center gap-3 py-2.5 hover:bg-cream/50"
            >
              <span
                className={`grid size-8 place-items-center rounded-full text-sm font-bold ${g.score === 1 ? "bg-success/15 text-success" : g.score === 0 ? "bg-danger/10 text-danger" : "bg-cream text-stone"}`}
                aria-label={g.score === 1 ? t("win") : g.score === 0 ? t("loss") : t("draw")}
              >
                {g.score === 1 ? "1" : g.score === 0 ? "0" : "½"}
              </span>
              <span className="min-w-0">
                <span className="block truncate font-medium">
                  <span
                    aria-hidden
                    className={`mr-1.5 inline-block size-2.5 rounded-sm border border-ink align-middle ${g.white ? "bg-paper" : "bg-ink"}`}
                  />
                  {g.opponent}{" "}
                  {g.opponentRating ? (
                    <span className="tabular text-sm text-stone">({g.opponentRating})</span>
                  ) : null}
                </span>
                <span className="block truncate text-sm text-stone">
                  {[
                    g.tournaments?.name,
                    g.round_number ? t("round", { n: g.round_number }) : null,
                    g.eco,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
              <span className="text-sm text-stone">
                {g.played_on ? formatDate(g.played_on, locale, { dateStyle: "short" }) : ""}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </AccountShell>
  );
}
