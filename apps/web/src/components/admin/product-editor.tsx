"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button, Checkbox, Field, Input, Select } from "@/components/ui/form";
import { saveProductAction } from "@/app/actions/shop";
import { ART_KEYS, ProductArt } from "@/components/shop/product-art";

type I18n = { fr: string; en: string };
export type ProductDraft = {
  id?: string;
  slug: string;
  categoryId: string | null;
  kind: "physical" | "gift_card";
  name: I18n;
  description: I18n;
  priceXof: number;
  compareAtXof: number | null;
  art: string;
  imageUrl: string;
  isActive: boolean;
  isFeatured: boolean;
  isPreorder: boolean;
  preorderDate: string | null;
  variants: {
    id?: string;
    name: I18n;
    sku: string | null;
    priceXof: number | null;
    stock: number;
    isActive: boolean;
  }[];
};

const slugify = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

export function ProductEditor({
  draft,
  categories,
}: {
  draft: ProductDraft;
  categories: { id: string; name: string }[];
}) {
  const t = useTranslations("adminShop");
  const router = useRouter();
  const [p, setP] = useState(draft);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const num = (v: string) => (v === "" ? null : Math.max(0, Math.round(Number(v))));
  const setVariant = (i: number, patch: Partial<ProductDraft["variants"][number]>) =>
    setP({ ...p, variants: p.variants.map((v, j) => (j === i ? { ...v, ...patch } : v)) });
  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        setMsg(null);
        start(async () => {
          const r = await saveProductAction({
            ...p,
            slug: p.slug || slugify(p.name.fr),
            preorderDate: p.preorderDate || null,
          });
          if (!r.ok) {
            setMsg(t.has(`errors.${r.error}`) ? t(`errors.${r.error}`) : t("errors.invalid"));
            return;
          }
          setMsg(t("saved"));
          if (!p.id) router.replace(`/admin/boutique/produits/${r.data!.id}`);
          else router.refresh();
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="name-fr" label={`${t("name")} (FR)`}>
          <Input
            id="name-fr"
            required
            value={p.name.fr}
            onChange={(e) =>
              setP({
                ...p,
                name: { ...p.name, fr: e.target.value },
                slug: p.id ? p.slug : slugify(e.target.value),
              })
            }
          />
        </Field>
        <Field id="name-en" label={`${t("name")} (EN)`}>
          <Input
            id="name-en"
            value={p.name.en}
            onChange={(e) => setP({ ...p, name: { ...p.name, en: e.target.value } })}
          />
        </Field>
        <Field id="slug" label={t("slug")}>
          <Input
            id="slug"
            value={p.slug}
            onChange={(e) => setP({ ...p, slug: slugify(e.target.value) })}
          />
        </Field>
        <Field id="cat" label={t("category")}>
          <Select
            id="cat"
            value={p.categoryId ?? ""}
            onChange={(e) => setP({ ...p, categoryId: e.target.value || null })}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="kind" label={t("productKind")}>
          <Select
            id="kind"
            value={p.kind}
            onChange={(e) => setP({ ...p, kind: e.target.value as ProductDraft["kind"] })}
          >
            <option value="physical">{t("kinds.physical")}</option>
            <option value="gift_card">{t("kinds.gift_card")}</option>
          </Select>
        </Field>
        <Field id="price" label={t("price")}>
          <Input
            id="price"
            type="number"
            min={0}
            required
            value={p.priceXof}
            onChange={(e) => setP({ ...p, priceXof: num(e.target.value) ?? 0 })}
          />
        </Field>
        <Field id="compare" label={t("compareAt")} optional={t("optional")}>
          <Input
            id="compare"
            type="number"
            min={0}
            value={p.compareAtXof ?? ""}
            onChange={(e) => setP({ ...p, compareAtXof: num(e.target.value) })}
          />
        </Field>
        <Field id="image" label={t("imageUrl")} optional={t("optional")} hint={t("imageHint")}>
          <Input
            id="image"
            value={p.imageUrl}
            onChange={(e) => setP({ ...p, imageUrl: e.target.value })}
          />
        </Field>
      </div>
      <fieldset>
        <legend className="text-sm font-semibold">{t("art")}</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {ART_KEYS.map((a) => (
            <label
              key={a}
              className="w-16 cursor-pointer overflow-hidden rounded border-2 border-transparent has-[:checked]:border-bordeaux"
            >
              <input
                type="radio"
                name="art"
                value={a}
                checked={p.art === a}
                onChange={() => setP({ ...p, art: a })}
                className="sr-only"
              />
              <ProductArt art={a} alt={a} className="w-full" />
            </label>
          ))}
        </div>
      </fieldset>
      {(["fr", "en"] as const).map((l) => (
        <div key={l}>
          <label htmlFor={`desc-${l}`} className="block text-sm font-semibold">
            {t("description")} ({l.toUpperCase()})
          </label>
          <textarea
            id={`desc-${l}`}
            rows={4}
            maxLength={4000}
            value={p.description[l]}
            onChange={(e) => setP({ ...p, description: { ...p.description, [l]: e.target.value } })}
            className="mt-1 w-full rounded-md border border-line bg-white p-3"
          />
        </div>
      ))}
      <div className="flex flex-wrap gap-x-6">
        <Checkbox
          id="active"
          checked={p.isActive}
          onChange={(e) => setP({ ...p, isActive: e.target.checked })}
          label={t("isActive")}
        />
        <Checkbox
          id="featured"
          checked={p.isFeatured}
          onChange={(e) => setP({ ...p, isFeatured: e.target.checked })}
          label={t("isFeatured")}
        />
        <Checkbox
          id="preorder"
          checked={p.isPreorder}
          onChange={(e) => setP({ ...p, isPreorder: e.target.checked })}
          label={t("isPreorder")}
        />
      </div>
      {p.isPreorder ? (
        <Field id="pre-date" label={t("preorderDate")} optional={t("optional")}>
          <Input
            id="pre-date"
            type="date"
            value={p.preorderDate ?? ""}
            onChange={(e) => setP({ ...p, preorderDate: e.target.value || null })}
          />
        </Field>
      ) : null}
      <fieldset className="space-y-3">
        <legend className="font-display text-2xl font-semibold">{t("variants")}</legend>
        {p.variants.map((v, i) => (
          <div
            key={v.id ?? i}
            className="grid gap-3 rounded-md border border-line p-3 sm:grid-cols-6"
          >
            <div className="sm:col-span-2">
              <Field id={`v-fr-${i}`} label={`${t("variantName")} (FR)`}>
                <Input
                  id={`v-fr-${i}`}
                  value={v.name.fr}
                  onChange={(e) => setVariant(i, { name: { ...v.name, fr: e.target.value } })}
                />
              </Field>
            </div>
            <Field id={`v-en-${i}`} label="EN">
              <Input
                id={`v-en-${i}`}
                value={v.name.en}
                onChange={(e) => setVariant(i, { name: { ...v.name, en: e.target.value } })}
              />
            </Field>
            <Field id={`v-price-${i}`} label={t("variantPrice")}>
              <Input
                id={`v-price-${i}`}
                type="number"
                min={0}
                value={v.priceXof ?? ""}
                placeholder={String(p.priceXof)}
                onChange={(e) => setVariant(i, { priceXof: num(e.target.value) })}
              />
            </Field>
            <Field id={`v-stock-${i}`} label={t("stockLabel")}>
              <Input
                id={`v-stock-${i}`}
                type="number"
                min={0}
                value={v.stock}
                onChange={(e) => setVariant(i, { stock: num(e.target.value) ?? 0 })}
              />
            </Field>
            <Field id={`v-sku-${i}`} label="SKU">
              <Input
                id={`v-sku-${i}`}
                value={v.sku ?? ""}
                onChange={(e) => setVariant(i, { sku: e.target.value || null })}
              />
            </Field>
            <div className="sm:col-span-6">
              <Checkbox
                id={`v-active-${i}`}
                checked={v.isActive}
                onChange={(e) => setVariant(i, { isActive: e.target.checked })}
                label={t("isActive")}
              />
            </div>
          </div>
        ))}
        <button
          type="button"
          className="min-h-11 rounded-full border border-ink/25 px-4 font-semibold hover:bg-cream"
          onClick={() =>
            setP({
              ...p,
              variants: [
                ...p.variants,
                { name: { fr: "", en: "" }, sku: null, priceXof: null, stock: 0, isActive: true },
              ],
            })
          }
        >
          {t("addVariant")}
        </button>
      </fieldset>
      <div className="flex items-center gap-4">
        <Button type="submit" disabled={pending}>
          {t("save")}
        </Button>
        {msg ? (
          <p role="status" className="font-semibold">
            {msg}
          </p>
        ) : null}
      </div>
    </form>
  );
}
