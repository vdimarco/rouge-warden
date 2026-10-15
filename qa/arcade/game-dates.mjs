// Writes public/arcade/game-dates.json from git committer dates.
// Each game's folder is its deployed route under public/ (the cabinet destination).
// added: oldest commit that touches that folder. updated: newest.
// Run from the repo root: node qa/arcade/game-dates.mjs
// Check without writing: node qa/arcade/game-dates.mjs --check
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const outFile = path.join(root, "public/arcade/game-dates.json");

function git(args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

export function readGames() {
  const ctx = {
    window: {},
    location: { pathname: "/fish/" },
    document: {
      readyState: "loading",
      addEventListener() {},
      querySelector() { return null; },
      querySelectorAll() { return []; },
    },
    fetch: async () => ({ ok: true }),
    localStorage: { getItem: () => null, setItem() {} },
    URLSearchParams,
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, "public/arcade/switch.js"), "utf8"), ctx);
  return ctx.window.GameSwitch.GAMES;
}

export function folderFor(game) {
  return "public" + game.url.replace(/\/$/, "");
}

export function historyFor(folder) {
  const updated = git(["log", "-1", "--format=%cI", "--", folder]);
  const oldest = git(["rev-list", "--reverse", "HEAD", "--", folder]).split("\n").filter(Boolean)[0];
  if (!updated || !oldest) throw new Error("No git history for " + folder);
  const added = git(["show", "-s", "--format=%cI", oldest]);
  if (!Number.isFinite(Date.parse(added)) || !Number.isFinite(Date.parse(updated))) throw new Error("Bad timestamp for " + folder);
  if (Date.parse(updated) < Date.parse(added)) throw new Error("Updated before added for " + folder);
  return { added, updated };
}

export function collect(games = readGames()) {
  const out = {};
  for (const game of games) {
    const folder = folderFor(game);
    if (!fs.existsSync(path.join(root, folder))) throw new Error("Missing folder for " + game.id + ": " + folder);
    out[game.id] = { path: folder, ...historyFor(folder) };
  }
  return { version: 1, clock: "committer", games: out };
}

export function datesFile() {
  return JSON.parse(fs.readFileSync(outFile, "utf8"));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const next = collect();
  const text = JSON.stringify(next, null, 2) + "\n";
  if (process.argv.includes("--check")) {
    const current = fs.existsSync(outFile) ? fs.readFileSync(outFile, "utf8") : "";
    if (current !== text) {
      console.error("game-dates.json does not match git history. Run: node qa/arcade/game-dates.mjs");
      process.exit(1);
    }
    console.log("game-dates.json matches git (" + Object.keys(next.games).length + " games)");
  } else {
    fs.writeFileSync(outFile, text);
    console.log("wrote " + path.relative(root, outFile) + " (" + Object.keys(next.games).length + " games)");
  }
}
