"use client";

import { Link } from "@/i18n/navigation";
import { IconBag } from "@/components/icons";
import { useCart } from "@/lib/shop/cart";

export function CartLink({ label }: { label: string }) {
  const { count } = useCart();
  return (
    <Link
      href="/boutique/panier"
      className="relative grid size-11 place-items-center rounded-full text-ink/80 hover:bg-cream hover:text-bordeaux"
      aria-label={count ? `${label} (${count})` : label}
    >
      <IconBag className="size-[22px]" />
      {count ? (
        <span className="tabular absolute right-0.5 top-0.5 grid min-w-5 place-items-center rounded-full bg-bordeaux px-1 text-[0.7rem] font-bold leading-5 text-cream">
          {count}
        </span>
      ) : null}
    </Link>
  );
}
