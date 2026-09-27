"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/form";
import { simulateFakePayment } from "@/app/actions/fake-payment";

export function FakeCheckout({ paymentId, disabled }: { paymentId: string; disabled: boolean }) {
  const t = useTranslations("payment");
  const router = useRouter();
  const [pending, start] = useTransition();
  const go = (o: "succeeded" | "failed" | "pending") =>
    start(async () => {
      await simulateFakePayment(paymentId, o);
      router.push(`/paiement/retour?payment=${paymentId}`);
    });
  return (
    <div className="mt-6 grid gap-2">
      <Button disabled={pending || disabled} onClick={() => go("succeeded")}>
        {t("fakeSuccess")}
      </Button>
      <Button variant="secondary" disabled={pending || disabled} onClick={() => go("failed")}>
        {t("fakeFailure")}
      </Button>
      <Button variant="ghost" disabled={pending || disabled} onClick={() => go("pending")}>
        {t("fakePending")}
      </Button>
    </div>
  );
}
