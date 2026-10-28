#!/usr/bin/env node
// One command for the Pixel Watch relay. Generates a token on first run, prints a pairing
// link and a QR code, serves /pair, and advertises _wristagent._tcp on the LAN.
//   cd voice && npx wrist-relay
import { createCallServer } from "./call-server.mjs";
import { advertise } from "./mdns.mjs";
import { deepLink, ensureToken, lanIPv4, pairPageUrl, qrText } from "./pair.mjs";
import { loadEnv } from "./watch-call.mjs";

if (process.argv.includes("--help")) {
  console.log("Usage: npx wrist-relay");
  console.log("Starts the watch relay, makes a token if you do not have one, and prints a pairing link.");
  process.exit(0);
}

const env = loadEnv();
const port = Number(env.CALL_PORT || 8650);
const token = ensureToken(env);
const publicUrl = String(env.CALL_PUBLIC_URL || "").replace(/\/+$/, "");
const https = publicUrl.startsWith("https://") ? publicUrl : "";
const lanIp = lanIPv4();
const lanUrl = lanIp ? `http://${lanIp}:${port}` : "";
const relayUrl = https || lanUrl;
if (!relayUrl) {
  console.error("No LAN address and no https CALL_PUBLIC_URL. Join Wi-Fi, or set CALL_PUBLIC_URL in voice/.env.");
  process.exit(1);
}

const link = deepLink(relayUrl, token);
const page = pairPageUrl(relayUrl, relayUrl, token);
console.log("Wrist relay");
console.log("Open this on the phone. It redirects into the app:");
console.log(page);
console.log("Or scan this pairing link:");
console.log(link);
console.log(await qrText(link));
if (lanUrl && https) console.log(`On this Wi-Fi the phone can also connect to ${lanUrl}`);
if (!env.HERMES_API_KEY) console.log("HERMES_API_KEY is empty. Pairing works. Turns will fail until it is set.");

const server = createCallServer({ env });
const ad = lanIp ? advertise({ ip: lanIp, port, url: lanUrl || relayUrl, token }) : null;
const shutdown = () => {
  ad?.stop();
  server.close();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
server.listen(port, "0.0.0.0", () => {
  console.log(`Listening on port ${port}. Leave this running.`);
});
