// Checks every mod: the copies are current, the marketplace and each plugin validate, each mod's
// tests pass, and each mod type-checks.
//   node mods/check.mjs [--only=announcer,creel] [--skip=validate,test,tsc]
// It needs the claude CLI on the PATH. The type check needs the engine's declarations: it takes
// CLAUDE_CODE_TYPES (the path of claude-code.d.ts) when set, else the copy Claude Code lays in a
// loaded mod's .claude-plugin/types/, else it says it skipped. It needs tsc on the PATH too.
// The exit code is 1 when a check fails.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MODS = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name) => { const a = args.find((x) => x.startsWith(`--${name}=`)); return a ? a.split("=")[1].split(",") : null; };
const ONLY = opt("only"), SKIP = opt("skip") || [];

const mods = fs.readdirSync(MODS)
  .filter((name) => fs.existsSync(path.join(MODS, name, ".claude-plugin", "plugin.json")))
  .filter((name) => !ONLY || ONLY.includes(name))
  .sort();

const fails = [];
function run(label, cmd, argv, options = {}) {
  const out = spawnSync(cmd, argv, { encoding: "utf8", ...options });
  const ok = out.status === 0;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${label}`);
  if (!ok) {
    fails.push(label);
    const text = `${out.stdout || ""}${out.stderr || ""}${out.error ? String(out.error) : ""}`.trim();
    console.log(text.split("\n").map((line) => `       ${line}`).join("\n"));
  }
  return ok;
}

console.log("== copies");
run("node mods/sync.mjs --check", process.execPath, [path.join(MODS, "sync.mjs"), "--check"]);

// every game in the switcher has a cabinet in the cabinet spinner
console.log("\n== cabinets");
{
  const switcher = fs.readFileSync(path.join(MODS, "..", "public", "arcade", "switch.js"), "utf8");
  const games = [...switcher.matchAll(/\{\s*id:\s*"([\w-]+)"/g)].map((m) => m[1]);
  const { CABINETS } = await import(path.join(MODS, "cabinet-spinner", "hooks", "cabinets.ts"));
  const missing = games.filter((id) => !CABINETS.some((c) => c.id === id));
  const ok = games.length > 0 && missing.length === 0;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${games.length} games in public/arcade/switch.js have a cabinet${missing.length ? `; missing: ${missing.join(", ")}` : ""}`);
  if (!ok) fails.push("cabinets");
}

if (!SKIP.includes("validate")) {
  console.log("\n== validate");
  run("marketplace", "claude", ["plugin", "validate", MODS]);
  for (const mod of mods) run(mod, "claude", ["plugin", "validate", path.join(MODS, mod)]);
}

if (!SKIP.includes("test")) {
  console.log("\n== tests");
  for (const mod of mods) run(mod, "claude", ["plugin", "test", path.join(MODS, mod)], { timeout: 300000 });
}

function typesFile() {
  if (process.env.CLAUDE_CODE_TYPES && fs.existsSync(process.env.CLAUDE_CODE_TYPES)) return process.env.CLAUDE_CODE_TYPES;
  for (const mod of fs.readdirSync(MODS)) {
    const laid = path.join(MODS, mod, ".claude-plugin", "types", "claude-code", "index.d.ts");
    if (fs.existsSync(laid)) return laid;
  }
  return null;
}

if (!SKIP.includes("tsc")) {
  console.log("\n== types");
  const types = typesFile();
  const tsc = spawnSync("tsc", ["--version"], { encoding: "utf8" });
  if (!types) console.log("  skip no declarations: set CLAUDE_CODE_TYPES to the path of claude-code.d.ts, or load a mod once");
  else if (tsc.status !== 0) console.log("  skip no tsc on the PATH");
  else {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mods-tsc-"));
    for (const mod of mods) {
      const root = path.join(MODS, mod);
      const config = {
        compilerOptions: {
          target: "es2023", lib: ["es2023"], types: [], module: "esnext", moduleResolution: "bundler",
          strict: true, noUncheckedIndexedAccess: true, noEmit: true, skipLibCheck: true,
          jsx: "react", jsxFactory: "h", jsxFragmentFactory: "Fragment",
          allowJs: true, checkJs: false, allowImportingTsExtensions: true,
        },
        files: [types],
        include: ["hooks", "types", "tests"].map((sub) => path.join(root, sub)),
      };
      const file = path.join(dir, `${mod}.json`);
      fs.writeFileSync(file, JSON.stringify(config, null, 2));
      run(mod, "tsc", ["-p", file]);
    }
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

console.log(fails.length ? `\n${fails.length} failed: ${fails.join(", ")}` : `\nall checks passed for ${mods.length} mod${mods.length === 1 ? "" : "s"}`);
process.exit(fails.length ? 1 : 0);
