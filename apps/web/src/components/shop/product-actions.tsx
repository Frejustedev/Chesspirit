"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/form";
import { reviewAction, toggleWishlistAction } from "@/app/actions/shop";

export function WishlistButton({
  productId,
  initial,
  signedIn,
}: {
  productId: string;
  initial: boolean;
  signedIn: boolean;
}) {
  const t = useTranslations("shop");
  const [on, setOn] = useState(initial);
  const [pending, start] = useTransition();
  if (!signedIn)
    return (
      <Link href="/connexion" className="text-sm font-semibold text-accent hover:underline">
        ♡ {t("wishlistSignIn")}
      </Link>
    );
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await toggleWishlistAction(productId);
          if (r.ok) setOn(!!r.data);
        })
      }
      className="inline-flex min-h-11 items-center gap-2 font-semibold text-accent hover:underline"
    >
      <span aria-hidden>{on ? "♥" : "♡"}</span> {on ? t("wishlisted") : t("wishlistAdd")}
    </button>
  );
}

export function ReviewForm({ productId }: { productId: string }) {
  const t = useTranslations("shop");
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="space-y-3 rounded-md border border-line p-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await reviewAction({ productId, rating, body });
          setMsg(r.ok ? t("reviewThanks") : t("reviewError"));
        });
      }}
    >
      <fieldset>
        <legend className="text-sm font-semibold">{t("yourRating")}</legend>
        <div className="mt-1 flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="cursor-pointer text-2xl">
              <input
                type="radio"
                name="rating"
                value={n}
                checked={rating === n}
                onChange={() => setRating(n)}
                className="sr-only"
              />
              <span aria-hidden className={n <= rating ? "text-accent" : "text-line"}>
                ★
              </span>
              <span className="sr-only">{t("stars", { n })}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <label htmlFor="review-body" className="block text-sm font-semibold">
        {t("yourReview")}
      </label>
      <textarea
        id="review-body"
        value={body}
        maxLength={2000}
        rows={3}
        onChange={(e) => setBody(e.target.value)}
        className="w-full rounded-md border border-line bg-field p-3"
      />
      <Button type="submit" disabled={pending}>
        {t("publishReview")}
      </Button>
      {msg ? (
        <p role="status" className="text-sm font-semibold">
          {msg}
        </p>
      ) : null}
    </form>
  );
}
