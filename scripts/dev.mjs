// `pnpm dev` : démarre la pile locale (sans Docker) puis l'application web.
// Si Docker et la CLI Supabase sont disponibles, `SUPABASE_CLI=1 pnpm dev` utilise `supabase start`.
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const envFile = path.join(root, "apps/web/.env.local");
if (!fs.existsSync(envFile)) {
  // Clés de démonstration publiques de la CLI Supabase : valables uniquement en local.
  fs.writeFileSync(
    envFile,
    [
      "NEXT_PUBLIC_SITE_URL=http://localhost:3000",
      "NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0",
      "SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU",
      "PAYMENT_PROVIDER=fake",
      `FAKE_PAYMENT_SECRET=${crypto.randomBytes(24).toString("hex")}`,
      `CHESS_ENGINE_KEY=${crypto.randomBytes(24).toString("hex")}`,
      "CHESS_ENGINE_URL=http://localhost:8000",
      "",
    ].join("\n"),
  );
  console.log("✓ apps/web/.env.local créé avec les valeurs locales");
}

const useCli = process.env.SUPABASE_CLI === "1";
const stack = useCli
  ? spawnSync("supabase", ["start"], { cwd: root, stdio: "inherit" })
  : spawnSync("bash", [path.join(root, "scripts/local-stack.sh"), "start"], { cwd: root, stdio: "inherit" });
if (stack.status !== 0) process.exit(stack.status ?? 1);

const web = spawn("pnpm", ["--filter", "web", "dev"], { cwd: root, stdio: "inherit" });
web.on("exit", (code) => process.exit(code ?? 0));
