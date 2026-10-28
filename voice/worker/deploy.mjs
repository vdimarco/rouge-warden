#!/usr/bin/env node
// Generates a token on first run, runs `npx wrangler deploy`, and prints the pairing link.
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { deepLink, pairPageUrl, qrText } from "../pair.mjs";

const dir = fileURLToPath(new URL(".", import.meta.url));
const tokenFile = fileURLToPath(new URL("./.token", import.meta.url));
let token = existsSync(tokenFile) ? readFileSync(tokenFile, "utf8").trim() : "";
if (token.length < 16) {
  token = randomBytes(32).toString("base64url");
  writeFileSync(tokenFile, token + "\n", { mode: 0o600 });
  console.log("Generated a relay token.");
}

console.log("Running npx wrangler secret put WATCH_RELAY_KEY");
const secret = spawnSync("npx", ["wrangler", "secret", "put", "WATCH_RELAY_KEY"], {
  cwd: dir,
  input: token + "\n",
  encoding: "utf8",
});
process.stdout.write(secret.stdout || "");
process.stderr.write(secret.stderr || "");
if (secret.status !== 0) process.exit(secret.status || 1);

console.log("Running npx wrangler deploy");
const deploy = spawnSync("npx", ["wrangler", "deploy"], { cwd: dir, encoding: "utf8" });
process.stdout.write(deploy.stdout || "");
process.stderr.write(deploy.stderr || "");
if (deploy.status !== 0) process.exit(deploy.status || 1);

const blob = `${deploy.stdout || ""}\n${deploy.stderr || ""}`;
const match = blob.match(/https:\/\/[a-z0-9.-]+\.workers\.dev/i);
const pageBase = match ? match[0] : "https://wrist-relay.workers.dev";
const page = pairPageUrl(pageBase, pageBase, token);
const link = deepLink(pageBase, token);
console.log("Open this on the phone. It redirects into the app:");
console.log(page);
console.log(link);
console.log(await qrText(link));
if (!match) console.log("The workers.dev host was not in the deploy output. Use the URL wrangler printed as the relay.");
