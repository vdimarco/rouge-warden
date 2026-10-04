// Manages the Digital Asset Links entry of Reel It In in public/.well-known/assetlinks.json. No dependencies.
// The app opens the site with no URL bar only if the site lists the SHA-256 fingerprints of the app's signing keys.
// The file is shared by every Android app of the host (In Full Swing has an entry too), so this tool changes one entry
// and leaves every other entry as it is.
//
// Usage: node play/fish/assetlinks.mjs <command> [--file PATH] [--package ID]
//   --upload <SHA-256>   list your upload key (the one build-aab.sh prints). Use it for sideloaded builds.
//   --play <SHA-256>     list the Play app signing key (Play Console, after your first upload). Use it for installs from Google Play.
//   --remove <SHA-256>   take a fingerprint out again (for example an old upload key)
//   --print              show the entry
//   --check [HOST]       ask Google (digitalassetlinks.googleapis.com) what it reads at HOST (default: host in twa-manifest.json)
// Both keys go into one entry. A fingerprint has 32 pairs of hex digits with colons, in capitals: AA:BB:...:FF.
// The tool refuses a placeholder, and a fingerprint that the entry has already. Google rejects the WHOLE file when one
// fingerprint in it is malformed, so the tool also warns about the entries of other apps.
import { readFile, writeFile, rename, stat } from "fs/promises";
import { fileURLToPath } from "url";
import path from "path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_FILE = path.resolve(HERE, "../../public/.well-known/assetlinks.json");
export const RELATION = "delegate_permission/common.handle_all_urls";
export const API = "https://digitalassetlinks.googleapis.com/v1/statements:list";
const FORMAT = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/;

/* ---------------- fingerprints ---------------- */
// Turns what a person pastes into the strict form AA:BB:...:FF, or throws with the reason.
export function normalizeFingerprint(input) {
  const raw = String(input ?? "").trim();
  if (!raw) throw new Error("No fingerprint given.");
  if (/^REPLACE|PLACEHOLDER|YOUR_|SHA256_|<.*>/i.test(raw)) throw new Error("\"" + raw + "\" is a placeholder, not a fingerprint. Copy the real one (build-aab.sh prints it; Play Console shows the Play one).");
  const hex = raw.replace(/[:\s]/g, "").toUpperCase();
  if (!/^[0-9A-F]{64}$/.test(hex)) throw new Error("\"" + raw + "\" is not a SHA-256 fingerprint. It needs 32 pairs of hex digits with colons, like AA:BB:...:FF.");
  const bytes = hex.match(/../g);
  if (new Set(bytes).size < 8) throw new Error("\"" + raw + "\" looks like a made-up value (it has fewer than 8 different bytes). Copy the real fingerprint.");
  return bytes.join(":");
}

/* ---------------- the file ---------------- */
// Writes JSON in the style of the file: 2 spaces, and a list of strings on one line when the line stays short.
// Reading and writing an untouched file gives the same bytes, so other entries stay as they are.
export function format(value, indent = 0, lead = indent * 2) {
  const pad = "  ".repeat(indent), inner = "  ".repeat(indent + 1);
  if (Array.isArray(value)) {
    if (!value.length) return "[]";
    if (value.every((v) => v === null || typeof v !== "object")) {
      const one = "[" + value.map((v) => JSON.stringify(v)).join(", ") + "]";
      if (lead + one.length + 1 <= 100) return one;
    }
    return "[\n" + value.map((v) => inner + format(v, indent + 1)).join(",\n") + "\n" + pad + "]";
  }
  if (value && typeof value === "object") {
    const keys = Object.keys(value);
    if (!keys.length) return "{}";
    return "{\n" + keys.map((k) => inner + JSON.stringify(k) + ": " + format(value[k], indent + 1, inner.length + JSON.stringify(k).length + 2)).join(",\n") + "\n" + pad + "}";
  }
  return JSON.stringify(value);
}

export function parse(text) {
  let links;
  try { links = JSON.parse(text); } catch (e) { throw new Error("assetlinks.json is not valid JSON: " + e.message); }
  if (!Array.isArray(links)) throw new Error("assetlinks.json must be a JSON list of entries.");
  return links;
}

const isApp = (e, pkg) => e && e.target && e.target.namespace === "android_app" && e.target.package_name === pkg;
export const entriesFor = (links, pkg) => links.filter((e) => isApp(e, pkg));
const fingerprintsOf = (e) => (e && e.target && Array.isArray(e.target.sha256_cert_fingerprints) ? e.target.sha256_cert_fingerprints : []);

// Warnings about the whole file. A malformed fingerprint anywhere makes Google reject the whole file.
export function warnings(links) {
  const out = [];
  for (const e of links) {
    const pkg = e && e.target ? e.target.package_name || e.target.site || "?" : "?";
    for (const f of fingerprintsOf(e)) {
      if (FORMAT.test(f)) continue;
      out.push("The entry for " + pkg + " has the fingerprint \"" + f + "\". It is malformed. Google rejects the WHOLE file because of it (ERROR_CODE_MALFORMED_CONTENT), "
        + "so no app of this host can open its site without a URL bar, this app included. The owner of " + pkg + " must replace it with the real SHA-256 fingerprint of that app's signing key.");
    }
    if (e && e.target && e.target.namespace === "android_app" && !fingerprintsOf(e).length) out.push("The entry for " + pkg + " has no fingerprint.");
  }
  return out;
}

// Adds fp to the one entry for pkg. role "upload" puts it first, "play" puts it last. Returns the new list and a message.
// Throws when the change must be refused. Never changes other entries. A malformed fingerprint in the entry of pkg is dropped.
export function addFingerprint(links, pkg, input, role) {
  const fp = normalizeFingerprint(input);
  const found = entriesFor(links, pkg);
  if (found.length > 1) throw new Error("The file has " + found.length + " entries for " + pkg + ". Merge them into one by hand first.");
  const out = links.map((e) => e);
  if (!found.length) {
    out.push({ relation: [RELATION], target: { namespace: "android_app", package_name: pkg, sha256_cert_fingerprints: [fp] } });
    return { links: out, message: "Added an entry for " + pkg + " with the " + role + " fingerprint " + fp + "." };
  }
  const old = found[0], have = fingerprintsOf(old);
  if (have.includes(fp)) throw new Error(fp + " is already in the entry for " + pkg + ". Nothing was written.");
  const kept = have.filter((f) => FORMAT.test(f)), dropped = have.length - kept.length;
  const list = role === "upload" ? [fp, ...kept] : [...kept, fp];
  const relation = Array.isArray(old.relation) && old.relation.includes(RELATION) ? old.relation : [...(Array.isArray(old.relation) ? old.relation : []), RELATION];
  const next = { ...old, relation, target: { ...old.target, sha256_cert_fingerprints: list } };
  out[links.indexOf(old)] = next;
  return { links: out, message: "Added the " + role + " fingerprint " + fp + " to the entry for " + pkg + (dropped ? " (dropped " + dropped + " malformed value" + (dropped > 1 ? "s" : "") + ")" : "") + "." };
}

export function removeFingerprint(links, pkg, input) {
  const fp = normalizeFingerprint(input);
  const found = entriesFor(links, pkg);
  if (found.length !== 1) throw new Error(found.length ? "The file has " + found.length + " entries for " + pkg + ". Merge them into one by hand first." : "The file has no entry for " + pkg + ".");
  const have = fingerprintsOf(found[0]);
  if (!have.includes(fp)) throw new Error(fp + " is not in the entry for " + pkg + ". Nothing was written.");
  const list = have.filter((f) => f !== fp);
  const out = links.map((e) => e);
  const i = links.indexOf(found[0]);
  if (list.length) out[i] = { ...found[0], target: { ...found[0].target, sha256_cert_fingerprints: list } };
  else out.splice(i, 1);
  return { links: out, message: "Removed " + fp + " from the entry for " + pkg + (list.length ? "." : ". The entry had no other fingerprint, so it is gone.") };
}

/* ---------------- Google's answer ---------------- */
// Reads the answer of statements:list for pkg. Returns { ok, lines } so that the caller prints it and sets the exit code.
export function readStatements(answer, pkg) {
  const lines = [];
  let ok = true;
  if (answer && answer.error) {
    lines.push("Google refused the question: " + (answer.error.message || JSON.stringify(answer.error)));
    for (const v of (answer.error.details || []).flatMap((d) => d.fieldViolations || [])) lines.push("  " + v.field + ": " + v.description);
    return { ok: false, lines, fingerprints: [] };
  }
  const codes = (answer && answer.errorCode) || [];
  if (codes.length) {
    ok = false;
    lines.push("Error code: " + codes.join(", "));
    if (answer.debugString) lines.push(...String(answer.debugString).split("\n").map((l) => l.replace(/^\*+ ?| ?\*+$/g, "").trim()).filter((l) => l && !/^ERRORS?$/.test(l)).map((l) => "  " + l));
  }
  const statements = (answer && answer.statements) || [];
  lines.push("Google reads " + statements.length + " statement" + (statements.length === 1 ? "" : "s") + (answer && answer.maxAge ? " (it keeps the answer for about " + Math.round(parseFloat(answer.maxAge)) + " s)" : "") + ".");
  const mine = [];
  for (const s of statements) {
    const app = s.target && s.target.androidApp;
    if (!app) continue;
    const fp = app.certificate && app.certificate.sha256Fingerprint;
    lines.push("  " + app.packageName + "  " + fp + (app.packageName === pkg ? "   <- this app" : ""));
    if (app.packageName === pkg) mine.push(fp);
  }
  if (!mine.length) { ok = false; lines.push("Google lists no fingerprint for " + pkg + "."); }
  return { ok, lines, fingerprints: mine };
}

export async function check(host, pkg, localFingerprints, fetchFn = fetch) {
  const lines = [], get = (url, opt) => fetchFn(url, { signal: AbortSignal.timeout(20000), ...opt });
  let ok = true;
  const url = "https://" + host + "/.well-known/assetlinks.json";
  lines.push("Host: " + host);
  try {
    const r = await get(url, { redirect: "manual" });
    const type = r.headers.get("content-type") || "(none)";
    lines.push("File: " + url + " answers HTTP " + r.status + ", content-type " + type);
    if (r.status !== 200) { ok = false; lines.push("  The file must answer HTTP 200 with no redirect."); }
    if (!/^application\/json\b/i.test(type)) { ok = false; lines.push("  The content type must be application/json (vercel.json sets it)."); }
  } catch (e) {
    ok = false;
    lines.push("Cannot read " + url + ": " + (e.cause && e.cause.code ? e.cause.code : e.message));
  }
  let answer;
  try {
    const r = await get(API + "?source.web.site=" + encodeURIComponent("https://" + host) + "&relation=" + RELATION);
    answer = await r.json();
  } catch (e) {
    lines.push("Cannot ask Google: " + (e.cause && e.cause.code ? e.cause.code : e.message) + ". Behind a proxy, set HTTPS_PROXY and NODE_USE_ENV_PROXY=1.");
    return { ok: false, lines };
  }
  const read = readStatements(answer, pkg);
  lines.push(...read.lines);
  if (!read.ok) ok = false;
  const missing = localFingerprints.filter((f) => !read.fingerprints.includes(f));
  if (read.fingerprints.length && missing.length) { ok = false; lines.push("The local file lists " + missing.join(", ") + ", but Google does not read it yet. Deploy the site and wait a few minutes."); }
  lines.push(ok ? "OK: Google reads the fingerprints of " + pkg + " on " + host + "." : "FAIL: the app would open with a URL bar (or crash) until this is fixed.");
  return { ok, lines };
}

/* ---------------- run ---------------- */
async function readLinks(file) {
  try { await stat(file); } catch { return []; }
  return parse(await readFile(file, "utf8"));
}
async function save(file, links) {
  const tmp = file + ".tmp";
  await writeFile(tmp, format(links) + "\n");
  await rename(tmp, file);
}

async function main(argv) {
  const opt = {}, cmds = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--file" || a === "--package") opt[a.slice(2)] = argv[++i];
    else if (["--upload", "--play", "--remove"].includes(a)) cmds.push([a.slice(2), argv[++i]]);
    else if (a === "--check") cmds.push(["check", argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : undefined]);
    else if (a === "--print") cmds.push(["print"]);
    else if (a === "-h" || a === "--help") { console.log((await readFile(fileURLToPath(import.meta.url), "utf8")).split("\n").slice(1).filter((l, n, all) => all.slice(0, n + 1).every((x) => x.startsWith("//"))).map((l) => l.replace(/^\/\/ ?/, "")).join("\n")); return 0; }
    else throw new Error("Unknown option: " + a + " (try --help)");
  }
  if (cmds.length !== 1) throw new Error("Give exactly one of --upload, --play, --remove, --print, --check (try --help).");
  const twa = JSON.parse(await readFile(path.join(HERE, "twa-manifest.json"), "utf8"));
  const pkg = opt.package || twa.packageId, file = path.resolve(opt.file || DEFAULT_FILE);
  const [cmd, arg] = cmds[0];
  const warn = (links) => { for (const w of warnings(links)) console.error("WARNING: " + w); };

  if (cmd === "print") {
    const links = await readLinks(file);
    const found = entriesFor(links, pkg);
    warn(links);
    if (!found.length) { console.error("No entry for " + pkg + " in " + file + "."); return 1; }
    console.log(format(found.length === 1 ? found[0] : found));
    return 0;
  }
  if (cmd === "check") {
    const links = await readLinks(file);
    const fps = entriesFor(links, pkg).flatMap(fingerprintsOf).filter((f) => FORMAT.test(f));
    warn(links);
    const r = await check(arg || twa.host, pkg, fps);
    console.log(r.lines.join("\n"));
    return r.ok ? 0 : 1;
  }
  if (!arg) throw new Error("--" + cmd + " needs a SHA-256 fingerprint.");
  const links = await readLinks(file);
  const r = cmd === "remove" ? removeFingerprint(links, pkg, arg) : addFingerprint(links, pkg, arg, cmd);
  await save(file, r.links);
  console.log(r.message);
  console.log(path.relative(process.cwd(), file) + " now lists " + (entriesFor(r.links, pkg).flatMap(fingerprintsOf).length) + " fingerprint(s) for " + pkg + ".");
  warn(r.links);
  console.log("Next: deploy the site, then run  node play/fish/assetlinks.mjs --check");
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then((code) => process.exit(code), (e) => { console.error("assetlinks: " + e.message); process.exit(1); });
}
