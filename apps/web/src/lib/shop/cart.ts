"use client";

import { useSyncExternalStore } from "react";

/** Panier local (navigateur). Les prix et le stock sont toujours revérifiés par le serveur. */
export type CartLine = { variantId: string; quantity: number; gift?: GiftInfo };
export type GiftInfo = { recipient_name?: string; recipient_contact?: string; message?: string };

const KEY = "chesspirit.cart.v1";
const listeners = new Set<() => void>();
let cache: CartLine[] | null = null;
const EMPTY: CartLine[] = [];

function read(): CartLine[] {
  if (cache) return cache;
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]") as unknown;
    cache = Array.isArray(raw)
      ? (raw as CartLine[])
          .filter((l) => typeof l?.variantId === "string" && Number.isInteger(l.quantity))
          .slice(0, 30)
      : [];
  } catch {
    cache = [];
  }
  return cache;
}

function write(lines: CartLine[]) {
  cache = lines.filter((l) => l.quantity > 0);
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    // stockage indisponible : le panier reste en mémoire pour la session
  }
  listeners.forEach((f) => f());
}

function subscribe(f: () => void) {
  listeners.add(f);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      f();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(f);
    window.removeEventListener("storage", onStorage);
  };
}

export function useCart() {
  const lines = useSyncExternalStore(subscribe, read, () => EMPTY);
  return {
    lines,
    count: lines.reduce((n, l) => n + l.quantity, 0),
    add(variantId: string, quantity = 1, gift?: GiftInfo) {
      const cur = read();
      const found = !gift && cur.find((l) => l.variantId === variantId && !l.gift);
      write(
        found
          ? cur.map((l) =>
              l === found ? { ...l, quantity: Math.min(50, l.quantity + quantity) } : l,
            )
          : [...cur, { variantId, quantity, gift }],
      );
    },
    setQuantity(index: number, quantity: number) {
      write(
        read().map((l, i) =>
          i === index ? { ...l, quantity: Math.max(0, Math.min(50, quantity)) } : l,
        ),
      );
    },
    remove(index: number) {
      write(read().filter((_, i) => i !== index));
    },
    clear() {
      write([]);
    },
  };
}
