// Makes, lists, and revokes bearer tokens for the Pixel Watch relay.
//   node voice/relay-key.mjs new [id]
//   node voice/relay-key.mjs revoke <id>
//   node voice/relay-key.mjs list
// The token is printed once, on create. voice/relay-keys.json is gitignored.
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadEnv } from "./watch-call.mjs";

const file = process.env.WATCH_RELAY_KEYS
  ? process.env.WATCH_RELAY_KEYS
  : fileURLToPath(new URL("./relay-keys.json", import.meta.url));

function read() {
  if (!existsSync(file)) return { keys: [] };
  return JSON.parse(readFileSync(file, "utf8"));
}

function write(db) {
  writeFileSync(file, JSON.stringify(db, null, 2) + "\n");
}

const cmd = process.argv[2];
if (cmd === "new") {
  const id = process.argv[3] || "watch";
  const token = randomBytes(32).toString("base64url");
  const db = read();
  db.keys.push({ id, token, revoked: false, created: new Date().toISOString() });
  write(db);
  const env = loadEnv();
  const url = String(env.CALL_PUBLIC_URL || "https://your-computer.your-tailnet.ts.net").replace(/\/+$/, "");
  const qr = `hermes://relay?url=${encodeURIComponent(url)}&token=${encodeURIComponent(token)}`;
  console.log(`id=${id}`);
  console.log(`url=${url}`);
  console.log(`token=${token}`);
  console.log(`qr=${qr}`);
  console.log("Put that qr string in a QR code and scan it in the phone app, or pass url and token to adb. See wear/README.md.");
} else if (cmd === "revoke") {
  const id = process.argv[3];
  if (!id) {
    console.error("Usage: node voice/relay-key.mjs revoke <id>");
    process.exit(1);
  }
  const db = read();
  let count = 0;
  for (const key of db.keys) {
    if (key.id === id && key.revoked !== true) {
      key.revoked = true;
      count += 1;
    }
  }
  write(db);
  console.log(count ? `Revoked ${count} key for ${id}.` : `No active key named ${id}.`);
} else if (cmd === "list") {
  const db = read();
  if (!db.keys.length) console.log("No keys.");
  for (const key of db.keys) console.log(`${key.revoked ? "revoked" : "active"}\t${key.id}`);
} else {
  console.error("Usage: node voice/relay-key.mjs new [id] | revoke <id> | list");
  process.exit(1);
}
