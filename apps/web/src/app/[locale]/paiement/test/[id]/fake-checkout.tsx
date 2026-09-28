"use client";

import { useSyncExternalStore, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/form";
import { simulateFakePayment } from "@/app/actions/fake-payment";

export function FakeCheckout({ paymentId, disabled }: { paymentId: string; disabled: boolean }) {
  const t = useTranslations("payment");
  const router = useRouter();
  const [pending, start] = useTransition();
  // Boutons actifs seulement une fois la page interactive : un clic avant l'hydratation serait perdu.
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const off = !hydrated || pending || disabled;
  const go = (o: "succeeded" | "failed" | "pending") =>
    start(async () => {
      await simulateFakePayment(paymentId, o);
      router.push(`/paiement/retour?payment=${paymentId}`);
    });
  return (
    <div className="mt-6 grid gap-2">
      <Button disabled={off} onClick={() => go("succeeded")}>
        {t("fakeSuccess")}
      </Button>
      <Button variant="secondary" disabled={off} onClick={() => go("failed")}>
        {t("fakeFailure")}
      </Button>
      <Button variant="ghost" disabled={off} onClick={() => go("pending")}>
        {t("fakePending")}
      </Button>
    </div>
  );
}
