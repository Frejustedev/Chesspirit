// Passerelle locale compatible Supabase (remplace Kong en développement sans Docker).
// /rest/v1 → PostgREST, /auth/v1 → GoTrue, /storage/v1 → stockage sur disque (minimal),
// /hooks/send-sms et /hooks/send-email → écrit les codes dans .local/logs/otp.log (aucun envoi réel).
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const PORT = Number(process.env.GATEWAY_PORT ?? 54321);
const REST = Number(process.env.REST_PORT ?? 54330);
const AUTH = Number(process.env.AUTH_PORT ?? 54329);
const LOCAL = process.env.LOCAL_DIR ?? path.resolve(".local");
const STORAGE_DIR = path.join(LOCAL, "storage");
const OTP_LOG = path.join(LOCAL, "logs", "otp.log");
const SIGN_SECRET = "chesspirit-local-storage";

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers":
    "authorization, x-client-info, apikey, content-type, prefer, range, accept-profile, content-profile, x-upsert, x-supabase-api-version",
  "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "access-control-expose-headers": "content-range, content-location",
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function proxy(req, res, port, stripPrefix) {
  const target = req.url.slice(stripPrefix.length) || "/";
  const headers = { ...req.headers, host: `127.0.0.1:${port}` };
  const p = http.request(
    { host: "127.0.0.1", port, path: target, method: req.method, headers },
    (r) => {
      res.writeHead(r.statusCode ?? 502, { ...r.headers, ...cors });
      r.pipe(res);
    },
  );
  p.on("error", (e) => {
    res.writeHead(502, { "content-type": "application/json", ...cors });
    res.end(JSON.stringify({ message: `service indisponible: ${e.message}` }));
  });
  req.pipe(p);
}

function logOtp(line) {
  fs.mkdirSync(path.dirname(OTP_LOG), { recursive: true });
  fs.appendFileSync(OTP_LOG, `${new Date().toISOString()} ${line}\n`);
  console.log(`[otp] ${line}`);
}

const sign = (p, exp) =>
  crypto.createHmac("sha256", SIGN_SECRET).update(`${p}:${exp}`).digest("hex");

async function storage(req, res, url) {
  const m = url.pathname.match(
    /^\/storage\/v1\/object\/(?:(public|sign|authenticated)\/)?([^/]+)\/(.+)$/,
  );
  if (!m) {
    res.writeHead(404, cors);
    return res.end();
  }
  const [, mode, bucket, key] = m;
  const file = path.join(STORAGE_DIR, bucket, decodeURIComponent(key));
  if (!file.startsWith(STORAGE_DIR)) {
    res.writeHead(400, cors);
    return res.end();
  }
  if (req.method === "POST" && mode === "sign") {
    const body = JSON.parse((await readBody(req)).toString() || "{}");
    const exp = Math.floor(Date.now() / 1000) + Number(body.expiresIn ?? 60);
    const rel = `${bucket}/${key}`;
    res.writeHead(200, { "content-type": "application/json", ...cors });
    return res.end(
      JSON.stringify({ signedURL: `/object/sign/${rel}?token=${sign(rel, exp)}.${exp}` }),
    );
  }
  if (req.method === "POST" || req.method === "PUT") {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, await readBody(req));
    fs.writeFileSync(
      `${file}.meta`,
      JSON.stringify({ type: req.headers["content-type"] ?? "application/octet-stream" }),
    );
    res.writeHead(200, { "content-type": "application/json", ...cors });
    return res.end(JSON.stringify({ Key: `${bucket}/${key}` }));
  }
  if (req.method === "DELETE") {
    fs.rmSync(file, { force: true });
    res.writeHead(200, cors);
    return res.end("{}");
  }
  if (req.method === "GET") {
    if (mode === "sign") {
      const [tok, exp] = (url.searchParams.get("token") ?? "").split(".");
      if (
        !exp ||
        Number(exp) < Date.now() / 1000 ||
        tok !== sign(`${bucket}/${key}`, Number(exp))
      ) {
        res.writeHead(403, cors);
        return res.end("lien expiré");
      }
    }
    if (!fs.existsSync(file)) {
      res.writeHead(404, cors);
      return res.end();
    }
    const meta = fs.existsSync(`${file}.meta`)
      ? JSON.parse(fs.readFileSync(`${file}.meta`, "utf8"))
      : {};
    res.writeHead(200, { "content-type": meta.type ?? "application/octet-stream", ...cors });
    return fs.createReadStream(file).pipe(res);
  }
  res.writeHead(405, cors);
  res.end();
}

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    if (req.method === "OPTIONS") {
      res.writeHead(204, cors);
      return res.end();
    }
    if (url.pathname === "/health") {
      res.writeHead(200, { "content-type": "text/plain" });
      return res.end("ok");
    }
    if (url.pathname.startsWith("/rest/v1")) return proxy(req, res, REST, "/rest/v1");
    if (url.pathname.startsWith("/auth/v1")) return proxy(req, res, AUTH, "/auth/v1");
    if (url.pathname.startsWith("/storage/v1")) return storage(req, res, url);
    if (url.pathname === "/hooks/send-sms" || url.pathname === "/hooks/send-email") {
      const body = JSON.parse((await readBody(req)).toString() || "{}");
      if (url.pathname.endsWith("sms")) logOtp(`sms ${body.user?.phone} ${body.sms?.otp}`);
      else
        logOtp(
          `email ${body.user?.email} ${body.email_data?.token} ${body.email_data?.email_action_type}`,
        );
      res.writeHead(200, { "content-type": "application/json" });
      return res.end("{}");
    }
    res.writeHead(404, cors);
    res.end();
  })
  .listen(PORT, "0.0.0.0", () => console.log(`passerelle locale sur :${PORT}`));
