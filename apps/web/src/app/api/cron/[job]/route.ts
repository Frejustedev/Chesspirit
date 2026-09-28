import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { JOBS, runJob, type JobName } from "@/lib/jobs";

export const maxDuration = 300;

/** Tâches planifiées (Vercel Cron ou tout planificateur) : jeton « Authorization: Bearer CRON_SECRET ». */
export async function GET(req: Request, { params }: { params: Promise<{ job: string }> }) {
  const { job } = await params;
  const secret = process.env.CRON_SECRET ?? "";
  const got = (req.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  const ok =
    secret.length >= 16 &&
    got.length === secret.length &&
    timingSafeEqual(Buffer.from(got), Buffer.from(secret));
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(JOBS as readonly string[]).includes(job))
    return NextResponse.json({ error: "unknown_job" }, { status: 404 });
  const r = await runJob(job as JobName);
  return NextResponse.json(r, { status: r.ok ? 200 : 500 });
}
