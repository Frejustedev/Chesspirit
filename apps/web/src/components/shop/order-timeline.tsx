import { getTranslations } from "next-intl/server";
import { formatDateTime } from "@chesspirit/shared";

const FLOW: Record<string, string[]> = {
  pickup: ["pending_payment", "paid", "preparing", "ready_for_pickup", "delivered"],
  cotonou: ["pending_payment", "paid", "preparing", "shipped", "delivered"],
  subregion: ["pending_payment", "paid", "preparing", "shipped", "delivered"],
  none: ["pending_payment", "paid", "delivered"],
};

/** Frise de suivi d'une commande. */
export async function OrderTimeline({
  delivery,
  status,
  events,
  locale,
}: {
  delivery: string;
  status: string;
  events: { status: string; note: string | null; at: string }[];
  locale: string;
}) {
  const t = await getTranslations("shop");
  if (status === "cancelled" || status === "refunded")
    return (
      <p className="rounded bg-bordeaux-soft px-3 py-2 font-semibold text-bordeaux">
        {t(`status.${status}`)}
      </p>
    );
  const flow = FLOW[delivery] ?? FLOW.cotonou!;
  const idx = flow.indexOf(status);
  return (
    <ol className="space-y-0">
      {flow.map((s, i) => {
        const ev = [...events].reverse().find((e) => e.status === s);
        const done = i <= idx;
        return (
          <li key={s} className="relative flex gap-3 pb-5 last:pb-0">
            {i < flow.length - 1 ? (
              <span
                aria-hidden
                className={`absolute left-[11px] top-6 h-full w-0.5 ${i < idx ? "bg-bordeaux" : "bg-line"}`}
              />
            ) : null}
            <span
              aria-hidden
              className={`relative z-10 mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border-2 text-xs font-bold ${done ? "border-bordeaux bg-bordeaux text-cream" : "border-line bg-paper"}`}
            >
              {done ? "✓" : ""}
            </span>
            <div>
              <p className={done ? "font-semibold" : "text-stone"}>
                {t(`status.${s}`)}
                <span className="sr-only">{done ? ` (${t("stepDone")})` : ""}</span>
              </p>
              {ev ? (
                <p className="text-sm text-stone">
                  {formatDateTime(ev.at, locale)}
                  {ev.note && ev.note !== "expired" ? ` — ${ev.note}` : ""}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
