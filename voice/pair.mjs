// Token file, LAN address, and the terminal QR for `npx wrist-relay`.
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { networkInterfaces } from "node:os";
import { fileURLToPath } from "node:url";
import { deepLink, isPrivateIPv4, isRelayBase, pairPage, pairPageUrl } from "./pair-link.mjs";

export { deepLink, isPrivateIPv4, isRelayBase, pairPage, pairPageUrl };

export function clientIp(req) {
  const raw = String(req.socket?.remoteAddress || "");
  return raw.startsWith("::ffff:") ? raw.slice(7) : raw;
}

export function isPrivateIp(ip) {
  if (ip === "::1") return true;
  return isPrivateIPv4(ip);
}

function rank(ip) {
  if (ip.startsWith("192.168.")) return 3;
  if (ip.startsWith("10.")) return 2;
  return 1;
}

export function lanIPv4() {
  const found = [];
  for (const list of Object.values(networkInterfaces())) {
    for (const net of list || []) {
      const family = net.family;
      if (family !== "IPv4" && family !== 4) continue;
      if (net.internal) continue;
      if (isPrivateIPv4(net.address)) found.push(net.address);
    }
  }
  found.sort((a, b) => rank(b) - rank(a));
  return found[0] || "";
}

export function ensureToken(env = {}, keysFile) {
  const fromEnv = String(env.WATCH_RELAY_KEY || "");
  if (fromEnv.length >= 16) return fromEnv;
  const file = keysFile || fileURLToPath(new URL("./relay-keys.json", import.meta.url));
  let db = { keys: [] };
  if (existsSync(file)) {
    try {
      db = JSON.parse(readFileSync(file, "utf8"));
    } catch {
      db = { keys: [] };
    }
  }
  if (!Array.isArray(db.keys)) db.keys = [];
  const active = db.keys.find((key) => key && key.token && key.revoked !== true && String(key.token).length >= 16);
  if (active) return String(active.token);
  const token = randomBytes(32).toString("base64url");
  db.keys.push({ id: "wrist", token, revoked: false, created: new Date().toISOString() });
  writeFileSync(file, JSON.stringify(db, null, 2) + "\n");
  return token;
}

export async function qrText(value) {
  const mod = await import("qrcode");
  const QRCode = mod.default || mod;
  return QRCode.toString(value, { type: "terminal", small: true, errorCorrectionLevel: "L" });
}
