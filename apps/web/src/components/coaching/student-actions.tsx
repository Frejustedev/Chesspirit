"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Checkbox } from "@/components/ui/form";
import { cancelBookingAction, homeworkDoneAction } from "@/app/actions/coaching";

export function BookingActions({ id }: { id: string }) {
  const t = useTranslations("myLessons");
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className="min-h-11 rounded-full border border-line px-4 text-sm font-semibold hover:border-bordeaux"
      onClick={() =>
        confirm(t("cancelConfirm")) &&
        start(async () => {
          await cancelBookingAction(id);
          router.refresh();
        })
      }
    >
      {t("cancel")}
    </button>
  );
}

export function HomeworkToggle({ id, done, label }: { id: string; done: boolean; label: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Checkbox
      id={`hw-${id}`}
      checked={done}
      disabled={pending}
      onChange={(e) =>
        start(async () => {
          await homeworkDoneAction(id, e.target.checked);
          router.refresh();
        })
      }
      label={<span className={done ? "line-through opacity-70" : ""}>{label}</span>}
    />
  );
}
