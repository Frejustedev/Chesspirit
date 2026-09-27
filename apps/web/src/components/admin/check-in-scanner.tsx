"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import jsQR from "jsqr";
import { checkInAction } from "@/app/actions/admin";
import { Button, Checkbox, Field, Input } from "@/components/ui/form";
import { IconCamera } from "@/components/icons";

type Entry =
  | { name: string; already: boolean; payment: string; status: string; at: string }
  | { error: string; at: string };

/** Pointage par QR code : caméra (BarcodeDetector natif, sinon jsQR) ou saisie du code. */
export function CheckInScanner() {
  const t = useTranslations("admin");
  const te = useTranslations("errors");
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [scanning, setScanning] = useState(false);
  const [code, setCode] = useState("");
  const [markPaid, setMarkPaid] = useState(true);
  const [log, setLog] = useState<Entry[]>([]);
  const last = useRef<{ code: string; at: number }>({ code: "", at: 0 });
  const markPaidRef = useRef(markPaid);
  useEffect(() => {
    markPaidRef.current = markPaid;
  }, [markPaid]);

  async function submit(value: string) {
    const v = value.trim();
    if (!v) return;
    const now = Date.now();
    if (last.current.code === v && now - last.current.at < 4000) return; // évite les doubles lectures
    last.current = { code: v, at: now };
    const r = await checkInAction(v, markPaidRef.current);
    const at = new Date().toLocaleTimeString();
    setLog((l) =>
      [
        r.ok ? { ...r.data!, at } : { error: te.has(r.error) ? te(r.error) : r.error, at },
        ...l,
      ].slice(0, 30),
    );
    if ("vibrate" in navigator) navigator.vibrate(r.ok ? 80 : [60, 60, 60]);
  }

  useEffect(() => {
    if (!scanning) return;
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    const Detector = (
      globalThis as unknown as {
        BarcodeDetector?: new (o: { formats: string[] }) => {
          detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]>;
        };
      }
    ).BarcodeDetector;
    const detector = Detector ? new Detector({ formats: ["qr_code"] }) : null;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
      } catch {
        setScanning(false);
        return;
      }
      const v = video.current!;
      v.srcObject = stream;
      await v.play();
      const tick = async () => {
        if (stopped) return;
        if (v.readyState >= 2) {
          let value: string | null = null;
          if (detector) {
            const found = await detector.detect(v).catch(() => []);
            value = found[0]?.rawValue ?? null;
          } else {
            const c = canvas.current!;
            c.width = v.videoWidth;
            c.height = v.videoHeight;
            const ctx = c.getContext("2d", { willReadFrequently: true })!;
            ctx.drawImage(v, 0, 0);
            value =
              jsQR(ctx.getImageData(0, 0, c.width, c.height).data, c.width, c.height)?.data ?? null;
          }
          if (value) await submit(value);
        }
        raf = requestAnimationFrame(tick);
      };
      tick();
    })();
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((tr) => tr.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- démarre/arrête la caméra uniquement
  }, [scanning]);

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div>
        <div className="relative aspect-square overflow-hidden rounded-lg bg-ink">
          <video
            ref={video}
            className="size-full object-cover"
            muted
            playsInline
            aria-label={t("camera")}
          />
          <canvas ref={canvas} className="hidden" />
          {!scanning ? (
            <div className="absolute inset-0 grid place-items-center">
              <Button type="button" onClick={() => setScanning(true)}>
                <IconCamera className="size-5" /> {t("startCamera")}
              </Button>
            </div>
          ) : (
            <div className="pointer-events-none absolute inset-[18%] rounded-lg border-2 border-gold" />
          )}
        </div>
        {scanning ? (
          <Button
            type="button"
            variant="secondary"
            className="mt-3"
            onClick={() => setScanning(false)}
          >
            {t("stopCamera")}
          </Button>
        ) : null}
        <form
          className="mt-6 flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            submit(code);
            setCode("");
          }}
        >
          <div className="flex-1">
            <Field id="ticket" label={t("ticketCode")}>
              <Input
                id="ticket"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                autoComplete="off"
                className="font-mono uppercase"
              />
            </Field>
          </div>
          <Button type="submit">{t("checkIn")}</Button>
        </form>
        <Checkbox
          id="mark-paid"
          checked={markPaid}
          onChange={(e) => setMarkPaid(e.target.checked)}
          label={t("markPaidOnCheckIn")}
        />
      </div>
      <div>
        <h2 className="font-display text-2xl font-semibold">{t("checkInLog")}</h2>
        <ul className="mt-3 space-y-2" aria-live="polite">
          {log.map((e, i) =>
            "error" in e ? (
              <li
                key={i}
                className="rounded-md bg-bordeaux-soft px-3 py-2 text-sm font-semibold text-bordeaux"
              >
                {e.at} — {e.error}
              </li>
            ) : (
              <li
                key={i}
                className={`rounded-md px-3 py-2 text-sm ${e.already ? "bg-gold-soft/60" : "bg-success/15"}`}
              >
                <strong>{e.name}</strong> — {e.already ? t("alreadyChecked") : t("checkedIn")} ·{" "}
                {t(`pay.${e.payment}`)}
                {e.status !== "confirmed" ? ` · ${t(`reg.${e.status}`)}` : ""}
                <span className="float-right text-stone">{e.at}</span>
              </li>
            ),
          )}
        </ul>
      </div>
    </div>
  );
}
