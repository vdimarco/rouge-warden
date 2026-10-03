#!/usr/bin/env node
// Builds the Cottage Arcade Studio page from what is true right now. Every Claude Code session on this repo is an
// agent, every branch and local git worktree is a work tree, and every game in public/arcade/switch.js (plus a new
// game folder on an open branch) is a cabinet. So a new agent or work tree shows up at the next refresh, and nobody
// has to add it by hand. The production crew, the stages, the feed and the bug board are kept by hand on the live
// page: this script reads them from it and keeps them.
//
// Run (the studio keeper does this every hour; see "The studio board" in README.md):
//   node studio/refresh.mjs --page <live page.html> --sessions <list_sessions output> --out <page.html> --if-changed
// --page      the live page, as the Artifact tool's read saved it. The hand-kept sections come from it.
// --sessions  the Claude Code Remote list_sessions result: as the tool saved it, or a JSON array of sessions.
// --out       the page to publish. With --if-changed nothing is written when no agent, work tree or cabinet
//             changed, and the first word printed is "unchanged".
// Other flags: --prs <GitHub pull request list as JSON>, --repo-dir <dir>, --remote origin, --base main,
//   --repo owner/name, --no-fetch, --now <ISO time>, --json <file> (also write the board data), --template <file>,
//   --fresh (start without --page), --no-sessions (agents from branches only).
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));

// the stamp for each place on the floor; a new game gets 新 until it has its own here or on the page
export const KANJI = { plungerd: "栓", drain: "落", crimson: "紅", wild: "湖", fish: "釣", arcade: "筐", workshop: "工", vr: "振", lab: "験", echo: "響" };
// which kind of agent made a branch, from its name
const KINDS = [
  [/^(claude\/|ccr-|worktree-)/, "claude"],
  [/^codex\//, "codex"],
  [/^cursor\//, "cursor"],
  [/^copilot\//, "copilot"],
  [/^devin\//, "devin"],
  [/^(jules|google-labs-jules)\//, "jules"],
];
// files of the arcade itself (the front door), and of the tools that are no game at all
const HUB = /^(public\/(index\.html|chip\.js|favicon\.ico|og\.jpg|arcade\/|icons\/)|api\/)/;
const HUB_PATHS = ["public/index.html", "public/arcade", "public/chip.js", "public/icons", "public/favicon.ico", "public/og.jpg", "api"];
const WORKSHOP = /^(studio\/|qa\/studio\/|higgsfield\/)/;
const BUCKETS = { WORKING: "working", BLOCKED: "blocked", REVIEW_READY: "review", COMPLETED: "done", FAILED: "failed" };
const KEEPER_TAG = "studio-keeper";
const FEED_KEEP = 60;
const ART_MAX = 48 * 1024;
const ART_TYPES = { webp: "image/webp", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif" };
// the first automatic run rewrites these hand-written lines, which described the old hand-kept board
const OLD_SUBTITLE = "Every game in the arcade, and the crew building the one in production.";
const NEW_SUBTITLE = "Every agent, work tree and cabinet in the arcade, and the crew on the game in production.";
const NEW_FOOTER = "Agents, work trees and cabinets refresh every hour from the Claude Code sessions and the git branches of this repo. The production crew, the stages and the bug board are kept by the production lead. Times are UTC.";

export const iso = (d) => {
  const t = d instanceof Date ? d : new Date(d);
  return isNaN(t) ? null : t.toISOString().replace(/\.\d{3}Z$/, "Z");
};
const lines = (s) => (s ? s.split("\n").filter(Boolean) : []);

export function kindOf(branch) {
  for (const [re, k] of KINDS) if (re.test(branch)) return k;
  return "human";
}

// "vdimarco/rouge-warden" from a GitHub URL, a proxy URL, an scp-style remote or a plain slug
export function slug(u) {
  const s = String(u || "").trim().replace(/\.git$/, "").replace(/\/+$/, "");
  const m = s.match(/([^/:@]+)\/([^/:@]+)$/);
  return (m ? m[1] + "/" + m[2] : s).toLowerCase();
}

// "Loon echo prototype" from "codex/loon-echo-prototype"; drops the random tail of a session branch
export function humanize(branch) {
  if (!branch) return "";
  let s = String(branch).replace(/^(claude|codex|cursor|copilot|devin|jules|google-labs-jules)\//, "").replace(/^(ccr|worktree)-/, "");
  s = s.replace(/-(?=[a-z0-9]{6}$)(?=.*\d)[a-z0-9]{6}$/, "");
  if (/^[0-9a-f]{8}$/.test(s)) return "";
  s = s.replace(/[-_/]+/g, " ").trim();
  return s ? s[0].toUpperCase() + s.slice(1) : "";
}

// the name in a game page's <title>, without the "· Cottage Arcade" or ": a VR game" tail
export function titleOf(html) {
  const m = String(html || "").match(/<title>([^<]*)<\/title>/i);
  if (!m) return "";
  const t = m[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").trim();
  return t.split(/\s+[·|–—-]\s+|:\s+/)[0].trim();
}

// the GAMES list in public/arcade/switch.js, read as data (the file is never run)
export function parseGames(src) {
  const text = String(src || "");
  const i = text.indexOf("const GAMES");
  if (i < 0) return [];
  const start = text.indexOf("[", i), end = text.indexOf("];", start);
  if (start < 0 || end < 0) return [];
  const out = [];
  for (const m of text.slice(start + 1, end).matchAll(/\{([^{}]*)\}/g)) {
    const o = {};
    for (const f of m[1].matchAll(/(\w+)\s*:\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|true|false|-?\d+(?:\.\d+)?)/g)) {
      const raw = f[2];
      if (raw[0] === '"') o[f[1]] = JSON.parse(raw);
      else if (raw[0] === "'") o[f[1]] = JSON.parse('"' + raw.slice(1, -1).replace(/\\'/g, "'").replace(/"/g, '\\"') + '"');
      else o[f[1]] = raw === "true" ? true : raw === "false" ? false : Number(raw);
    }
    if (o.id && o.name) out.push(o);
  }
  return out;
}

// a light colour from a name, for a new game that has none yet (the floor prints dark text on it)
export function hueColor(id) {
  const h = parseInt(createHash("sha1").update(String(id)).digest("hex").slice(0, 4), 16) % 360;
  const l = 0.66, s = 0.55, a = s * Math.min(l, 1 - l);
  const f = (n) => { const k = (n + h / 30) % 12; return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))).toString(16).padStart(2, "0"); };
  return "#" + f(0) + f(8) + f(4);
}

export function gameDir(g) {
  const m = String((g && g.url) || "").match(/^\/([^/]+)\/?$/);
  return m ? m[1] : null;
}

/* ---------------- inputs ---------------- */

export function parseArgs(argv) {
  const a = { remote: "origin", base: "main", fetch: true };
  const flags = { "--no-fetch": "noFetch", "--if-changed": "ifChanged", "--fresh": "fresh", "--no-sessions": "noSessions" };
  const values = { "--page": "page", "--sessions": "sessions", "--out": "out", "--prs": "prs", "--repo-dir": "repoDir", "--remote": "remote", "--base": "base", "--repo": "repo", "--now": "now", "--json": "json", "--template": "template" };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (flags[k]) a[flags[k]] = true;
    else if (values[k]) {
      if (argv[i + 1] === undefined) throw new Error(k + " needs a value");
      a[values[k]] = argv[++i];
    } else throw new Error("unknown flag " + k);
  }
  if (a.noFetch) a.fetch = false;
  return a;
}

// JSON from a tool result: plain, or inside the <other-session> note the harness wraps session records in
export function parseJsonLoose(text) {
  const t = String(text);
  const tries = [["{", "}"], ["[", "]"]].map(([o, c]) => [t.indexOf(o), t.lastIndexOf(c)]).filter(([i, j]) => i >= 0 && j > i).sort((x, y) => x[0] - y[0]);
  for (const [i, j] of tries) {
    try { return JSON.parse(t.slice(i, j + 1)); } catch { /* try the next shape */ }
  }
  throw new Error("no JSON found in the sessions file");
}

// the sessions on this repo, in one shape, from list_sessions output or from a short hand-written list
export function readSessions(text, repo) {
  const raw = parseJsonLoose(text);
  const list = Array.isArray(raw) ? raw : (raw.ccr && raw.ccr.data) || raw.data || raw.sessions || [];
  const want = slug(repo);
  const out = [];
  for (const s of list) {
    if (!s || typeof s !== "object" || typeof s.id !== "string") continue;
    const ctx = s.session_context || {}, em = s.external_metadata || {};
    const repos = new Set(), branches = new Set();
    const sources = (ctx.sources || []).map((x) => x.git_repository && x.git_repository.url).filter(Boolean).map(slug);
    sources.forEach((r) => repos.add(r));
    for (const o of ctx.outcomes || []) {
      const gi = o.git_repository && o.git_repository.git_info;
      if (!gi) continue;
      const r = gi.repo ? slug(gi.repo) : sources[0];
      if (r) repos.add(r);
      if (r === want) for (const b of gi.branches || []) branches.add(b);
    }
    for (const [r, b] of Object.entries(em.current_branches || {})) {
      const rr = r ? slug(r) : sources[0];
      if (rr) repos.add(rr);
      if (rr === want && b) branches.add(b);
    }
    // the short form: { id, title, repo, branch, bucket, status, created, updated, origin, summary, tags }
    if (s.repo) repos.add(slug(s.repo));
    if (!s.repo || slug(s.repo) === want) for (const b of [].concat(s.branch || [], s.branches || [])) branches.add(b);
    if (!repos.has(want)) continue;
    // the studio keeper refreshes this board; it is no agent of the studio
    const tags = Array.isArray(s.tags) ? s.tags : [];
    if (tags.includes(KEEPER_TAG) || /^studio keeper\b/i.test(String(s.title || "").trim())) continue;
    const bucket = String(s.status_bucket || s.bucket || "").replace(/^SESSION_STATUS_BUCKET_/, "").toUpperCase();
    const status = String(s.session_status || s.status || "").replace(/^SESSION_STATUS_/, "").toLowerCase();
    out.push({
      id: s.id,
      title: String(s.title || "").trim(),
      status,
      bucket: BUCKETS[bucket] || (Object.values(BUCKETS).includes(bucket.toLowerCase()) ? bucket.toLowerCase() : status === "running" ? "working" : ""),
      created: iso(s.created_at || s.created) || null,
      updated: iso(s.updated_at || s.updated) || null,
      branches: [...branches].filter((b) => b && b !== "main"),
      origin: String(s.origin || "").trim(),
      summary: String(s.task_summary || em.task_summary || s.summary || "").trim(),
    });
  }
  return out;
}

// pull requests from the GitHub list_pull_requests result: the newest one for each branch
export function readPrs(text) {
  const raw = parseJsonLoose(text);
  const list = Array.isArray(raw) ? raw : raw.items || raw.pull_requests || raw.data || [];
  const byBranch = new Map();
  for (const p of list) {
    const ref = p && p.head && p.head.ref;
    if (!ref || typeof p.number !== "number") continue;
    const state = p.merged_at || p.merged ? "merged" : String(p.state || "").toLowerCase() === "open" ? "open" : "closed";
    const cur = byBranch.get(ref);
    if (!cur || p.number > cur.number) byBranch.set(ref, { number: p.number, state, draft: !!p.draft, title: String(p.title || "") });
  }
  return byBranch;
}

export function extractBoard(html) {
  const m = String(html).match(/<script type="application\/json" id="board-data">([\s\S]*?)<\/script>/);
  return m ? JSON.parse(m[1]) : null;
}

// the page with the board data inside; "<" is escaped so no text in the data can close the script tag
export function renderPage(template, board) {
  const json = JSON.stringify(board).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
  const re = /(<script type="application\/json" id="board-data">)[\s\S]*?(<\/script>)/;
  if (!re.test(template)) throw new Error("the page template has no board-data script");
  return template.replace(re, (_, open, close) => open + json + close);
}

/* ---------------- git ---------------- */

function gitIn(cwd) {
  const run = (args, { allowFail = false, buffer = false } = {}) => {
    try {
      const out = execFileSync("git", args, { cwd, maxBuffer: 256 << 20, stdio: ["ignore", "pipe", "pipe"], encoding: buffer ? "buffer" : "utf8" });
      return buffer ? out : out.replace(/\s+$/, "");
    } catch (e) {
      if (allowFail) return null;
      throw new Error("git " + args.join(" ") + " failed: " + String((e.stderr && e.stderr.toString()) || e.message).trim());
    }
  };
  return run;
}

// Reads every branch, local worktree, pull request ref and game folder. The branch list comes from the remote, so
// run it in a clone that can fetch. `games` is the cabinet list already on the page (for games switch.js lacks).
export function collectGit({ cwd, remote = "origin", base = "main", fetch = true, games = [] }) {
  const git = gitIn(cwd);
  const R = remote, B = remote + "/" + base;
  if (fetch) {
    if (git(["rev-parse", "--is-shallow-repository"]) === "true") git(["fetch", "--quiet", "--unshallow", R], { allowFail: true });
    git(["fetch", "--quiet", "--prune", R, "+refs/heads/*:refs/remotes/" + R + "/*"]);
  }
  const url = git(["remote", "get-url", R], { allowFail: true }) || "";
  const baseHead = git(["rev-parse", B]);

  // pull requests: refs/pull/N/head is the tip, and refs/pull/N/merge stays only while the PR is open
  const prOf = new Map(), prOpen = new Set();
  for (const line of lines(git(["ls-remote", R, "refs/pull/*"], { allowFail: true }))) {
    const m = line.match(/^([0-9a-f]{40})\s+refs\/pull\/(\d+)\/(head|merge)$/);
    if (!m) continue;
    if (m[3] === "merge") prOpen.add(+m[2]);
    else if (!prOf.has(m[1]) || +m[2] > prOf.get(m[1])) prOf.set(m[1], +m[2]);
  }
  // merged pull requests, from the "Merge pull request #N from owner/branch" commits on the base branch
  const merged = new Map();
  for (const line of lines(git(["log", B, "--first-parent", "--merges", "-n", "600", "--format=%H%x09%cI%x09%s"]))) {
    const [sha, date, subject] = line.split("\t");
    const m = subject && subject.match(/^Merge pull request #(\d+) from [^/\s]+\/(\S+)/);
    if (!m) continue;
    if (!merged.has(m[2])) merged.set(m[2], []);
    merged.get(m[2]).push({ number: +m[1], sha, date: iso(date) });
  }
  const mergedNumbers = new Set([...merged.values()].flat().map((x) => x.number));
  const filesOfMerge = (sha) => lines(git(["diff", "--name-only", sha + "^1", sha], { allowFail: true }));

  function tree(name, ref, sha) {
    const [behind, ahead] = git(["rev-list", "--left-right", "--count", B + "..." + ref]).split(/\s+/).map(Number);
    const [date, author, subject] = (git(["log", "-1", "--format=%cI%x09%an%x09%s", ref]) || "").split("\t");
    let files = [], since = null, first = null;
    if (ahead > 0) {
      const mb = git(["merge-base", B, ref], { allowFail: true });
      if (mb) {
        files = lines(git(["diff", "--name-only", mb, ref]));
        const dates = lines(git(["log", "--format=%cI", mb + ".." + ref]));
        since = iso(dates[dates.length - 1]);
        first = mb;
      }
    }
    const merges = (merged.get(name) || []).slice(0, 3).map((x) => ({ ...x, files: filesOfMerge(x.sha) }));
    let pr = null;
    const n = prOf.get(sha);
    if (n != null) pr = { number: n, state: prOpen.has(n) ? "open" : mergedNumbers.has(n) ? "merged" : ahead > 0 ? "open" : "merged" };
    else if (merges.length) pr = { number: merges[0].number, state: "merged" };
    return { name, ref, sha, head: sha.slice(0, 7), date: iso(date), author: author || "", subject: subject || "", ahead, behind, since, files, merges, pr, mergeBase: first };
  }

  const branches = [];
  const refs = lines(git(["for-each-ref", "--format=%(refname:strip=3)%09%(objectname)", "refs/remotes/" + R + "/"]));
  for (const line of refs) {
    const [name, sha] = line.split("\t");
    if (!name || name === "HEAD" || name === base) continue;
    branches.push(tree(name, R + "/" + name, sha));
  }
  // local worktrees: the first one listed is this checkout itself
  const blocks = (git(["worktree", "list", "--porcelain"], { allowFail: true }) || "").split(/\n\s*\n/).slice(1);
  for (const b of blocks) {
    const wt = Object.fromEntries(lines(b).map((l) => [l.split(" ")[0], l.slice(l.indexOf(" ") + 1)]));
    if (!wt.worktree || !wt.HEAD || "bare" in wt) continue;
    const name = wt.branch ? wt.branch.replace(/^refs\/heads\//, "") : "detached " + wt.HEAD.slice(0, 7);
    const onRemote = branches.find((x) => x.name === name);
    if (onRemote) {
      onRemote.local = wt.worktree;
      onRemote.unpushed = Number(git(["rev-list", "--count", onRemote.ref + ".." + wt.HEAD], { allowFail: true }) || 0);
    } else branches.push({ ...tree(name, wt.HEAD, wt.HEAD), local: wt.worktree, localOnly: true });
  }

  // cabinets on the base branch, with their commit history
  // the count takes merge commits too (as the hand-kept board did); "latest" is the newest commit that is no merge
  const stats = (range, paths) => {
    const out = lines(git(["log", range, "--format=%h%x09%cI%x09%s", "--", ...paths], { allowFail: true }));
    if (!out.length) return null;
    const own = git(["log", range, "-1", "--no-merges", "--format=%h%x09%cI%x09%s", "--", ...paths], { allowFail: true });
    const [h, d, s] = (own || out[0]).split("\t"), first = out[out.length - 1].split("\t");
    return { commits: out.length, since: first[1].slice(0, 10), last: out[0].split("\t")[1].slice(0, 10), lastCommit: h, latest: s };
  };
  const pathsOf = (g) => {
    if (g.id === "arcade" || g.url === "/") return HUB_PATHS;
    const dir = gameDir(g);
    return dir ? ["public/" + dir, "qa/" + dir] : [];
  };
  const art = (ref, file) => {
    const p = String(file || "").replace(/^\//, "");
    const type = ART_TYPES[(p.split(".").pop() || "").toLowerCase()];
    if (!p || !type) return "";
    const size = Number(git(["cat-file", "-s", ref + ":public/" + p], { allowFail: true }) || 0);
    if (!size || size > ART_MAX) return "";
    const buf = git(["show", ref + ":public/" + p], { allowFail: true, buffer: true });
    return buf ? "data:" + type + ";base64," + buf.toString("base64") : "";
  };
  const baseGames = parseGames(git(["show", B + ":public/arcade/switch.js"], { allowFail: true }));
  const live = [];
  const seen = new Set();
  const onBase = (dir) => !!dir && git(["cat-file", "-e", B + ":public/" + dir + "/index.html"], { allowFail: true }) !== null;
  for (const g of [...baseGames, ...games]) {
    if (!g || !g.id || seen.has(g.id)) continue;
    // a game in development is live once its folder is on the base branch, with or without a switch.js entry
    if (g.status === "dev" && !onBase(gameDir(g))) continue;
    seen.add(g.id);
    const paths = pathsOf(g);
    live.push({ ...g, fromSwitch: baseGames.includes(g), artData: art(B, g.art), ...(paths.length ? stats(B, paths) : null) });
  }

  // games in development: a switch.js entry or a new public/<dir>/index.html on a branch that is ahead of the base
  const dev = new Map();
  const knownDirs = new Set(live.map(gameDir).filter(Boolean));
  for (const b of branches) {
    if (!(b.ahead > 0) || !b.mergeBase) continue;
    const found = [];
    for (const g of parseGames(git(["show", b.ref + ":public/arcade/switch.js"], { allowFail: true }))) {
      if (!seen.has(g.id) && gameDir(g)) found.push({ ...g, artData: art(b.ref, g.art) });
    }
    const dirs = new Set(b.files.map((f) => (f.match(/^public\/([^/]+)\/index\.html$/) || [])[1]).filter(Boolean));
    for (const dir of dirs) {
      if (knownDirs.has(dir) || found.some((g) => gameDir(g) === dir)) continue;
      if (git(["cat-file", "-e", B + ":public/" + dir], { allowFail: true }) !== null) continue;
      const name = titleOf(git(["show", b.ref + ":public/" + dir + "/index.html"], { allowFail: true })) || humanize(dir);
      found.push({ id: dir, name, sub: "", url: "/" + dir + "/", color: hueColor(dir), artData: "" });
    }
    for (const g of found) {
      const dir = gameDir(g);
      const s = stats(b.mergeBase + ".." + b.ref, ["public/" + dir, "qa/" + dir]);
      if (!s) continue;
      const cur = dev.get(g.id);
      if (cur && cur.last >= s.last && cur.lastCommit) { cur.branches.push(b.name); continue; }
      dev.set(g.id, { ...g, ...s, branch: b.name, branches: [b.name, ...(cur ? cur.branches : [])] });
    }
  }
  return { url, base, baseHead, branches, merged, games: live, dev: [...dev.values()] };
}

/* ---------------- the board ---------------- */

// which games a list of changed files belongs to: the most-touched game first; the arcade and the workshop lead
// only when nothing else was touched
export function gamesOf(files, dirToId) {
  const count = new Map();
  for (const f of files || []) {
    let id = null;
    if (WORKSHOP.test(f)) id = "workshop";
    else if (HUB.test(f)) id = "arcade";
    else {
      const m = f.match(/^(?:public|qa)\/([^/]+)\//);
      if (m) id = dirToId.get(m[1]) || null;
    }
    if (id) count.set(id, (count.get(id) || 0) + 1);
  }
  const rank = ([id, n]) => (id === "arcade" || id === "workshop" ? 0 : 1e6) + n;
  return [...count.entries()].sort((a, b) => rank(b) - rank(a)).map((e) => e[0]);
}

const pick = (o, keys) => Object.fromEntries(keys.filter((k) => o[k] !== undefined).map((k) => [k, o[k]]));

export function buildBoard({ prev = {}, sessions = null, git, now, repo, prs = null }) {
  const board = JSON.parse(JSON.stringify(prev || {}));
  const nowIso = iso(now);
  const nowMs = Date.parse(nowIso);
  const prevAuto = prev && prev.auto;

  /* cabinets: the page's list in its order, then new live games, then games in development */
  const prevGames = ((prev.games && prev.games.items) || []).filter((g) => g && g.id);
  const liveById = new Map(git.games.map((g) => [g.id, g]));
  const devById = new Map(git.dev.map((g) => [g.id, g]));
  const computed = (g) => pick(g, ["commits", "since", "last", "lastCommit", "latest"]);
  const games = [];
  for (const p of prevGames) {
    const l = liveById.get(p.id), d = devById.get(p.id);
    if (l) {
      const g = { ...p, ...computed(l) };
      if (p.status === "dev") { g.status = "live"; g.statusText = "Live in the arcade"; delete g.branch; delete g.branches; }
      if (!g.art && l.artData) g.art = l.artData;
      games.push(g);
    } else if (d) {
      games.push({ ...p, ...computed(d), status: "dev", branch: d.branch, branches: d.branches, statusText: p.statusText || "In development" });
    } else if (p.status !== "dev") games.push(p);
  }
  const have = new Set(games.map((g) => g.id));
  const fresh = (g, status) => ({
    id: g.id, name: g.name, sub: g.sub || "", color: g.color || hueColor(g.id), status,
    statusText: status === "dev" ? "In development" : "Live in the arcade", url: g.url, art: g.artData || "", auto: true,
    ...computed(g), ...(status === "dev" ? { branch: g.branch, branches: g.branches } : {}),
  });
  for (const g of git.games) if (!have.has(g.id) && g.fromSwitch) { games.push(fresh(g, "live")); have.add(g.id); }
  for (const g of [...git.dev].sort((a, b) => String(b.last).localeCompare(String(a.last)))) if (!have.has(g.id)) { games.push(fresh(g, "dev")); have.add(g.id); }
  for (const g of games) if (!g.kanji) g.kanji = KANJI[g.id] || "新";
  const dirToId = new Map();
  for (const g of games) { const d = gameDir(g); if (d) dirToId.set(d, g.id); }

  /* work trees */
  const trees = git.branches.map((b) => {
    const pr = (prs && prs.get(b.name)) || b.pr || null;
    const open = b.ahead > 0;
    const files = open ? b.files : b.merges.flatMap((m) => m.files);
    return {
      branch: b.name, kind: kindOf(b.name),
      state: b.localOnly ? "local" : pr && pr.state === "merged" && !(b.unpushed > 0) ? "merged" : open ? "open" : b.merges.length || (pr && pr.state === "merged") ? "merged" : "even",
      ahead: b.ahead, behind: b.behind, head: b.head, date: b.date, subject: b.subject, author: b.author, since: b.since,
      games: gamesOf(files, dirToId), pr: pr ? pick(pr, ["number", "state", "draft"]) : null,
      mergedAt: b.merges.length ? b.merges[0].date : null, local: b.local || null, unpushed: b.unpushed || 0,
      agent: null, title: pr && pr.title ? pr.title : "",
    };
  });
  const treeOf = new Map(trees.map((t) => [t.branch, t]));
  const openWork = (t) => !!t && (t.state === "open" || t.state === "local" || t.unpushed > 0);
  const openPr = (t) => !!(t && t.pr && t.pr.state === "open");

  /* agents: every session on this repo, then every work tree no session owns */
  const agents = [];
  for (const s of sessions || []) {
    const t = s.branches.map((b) => treeOf.get(b)).find(Boolean) || null;
    const branch = t ? t.branch : s.branches[0] || null;
    let state = s.status === "archived" ? "done" : s.bucket || "done";
    if (state === "done") state = openPr(t) ? "review" : openWork(t) ? "idle" : "done";
    else if (state === "review") state = openWork(t) || openPr(t) ? "review" : "done";
    agents.push({
      id: s.id, kind: "claude", title: s.title || humanize(branch) || "Claude session", state,
      summary: s.summary || "", origin: s.origin || "", since: s.created, active: s.updated || s.created,
      branch, games: t ? t.games : [], pr: t ? t.pr : null, session: true,
    });
    if (t && !t.agent) t.agent = s.id;
  }
  for (const t of trees) {
    if (t.agent || agents.some((a) => a.branch === t.branch)) continue;
    const recent = nowMs - Date.parse(t.date || 0) < 2 * 3600e3;
    const state = openPr(t) ? "review" : openWork(t) ? (recent ? "working" : "idle") : "done";
    t.agent = "branch:" + t.branch;
    agents.push({
      id: t.agent, kind: t.kind, title: t.title || humanize(t.branch) || t.branch, state, summary: "",
      origin: t.local ? "worktree" : "", since: t.since || t.date, active: t.date, branch: t.branch,
      games: t.games, pr: t.pr, session: false, author: t.author,
    });
  }
  for (const t of trees) delete t.title;

  /* the feed: what changed since the last refresh */
  const gameName = (id) => (games.find((g) => g.id === id) || {}).name || (id === "workshop" ? "the studio workshop" : id);
  const events = [];
  const since = (t) => { const ms = Date.parse(t || 0); const floor = Date.parse((prevAuto && prevAuto.refreshed) || 0); return ms > floor && ms <= nowMs ? iso(ms) : nowIso; };
  const active = agents.filter((a) => a.state !== "done");
  if (!prevAuto) {
    events.push({ t: nowIso, kind: "note", text: `The studio now adds new agents and work trees by itself: ${active.length} ${active.length === 1 ? "agent" : "agents"} on the floor, ${trees.filter(openWork).length} open work trees.` });
  } else {
    const pa = new Map(((prev.agents && prev.agents.items) || []).map((a) => [a.id, a]));
    for (const a of agents) {
      const p = pa.get(a.id);
      const pr = a.pr && a.pr.state === "open" ? ` (PR #${a.pr.number})` : "";
      if (!p) {
        if (a.state !== "done") events.push({ t: since(a.since), kind: "agent", text: `New agent: ${a.title}${a.branch ? ", on " + a.branch : ""}.` });
        continue;
      }
      if (p.state === a.state) continue;
      const text = { review: `${a.title} is ready for review${pr}.`, blocked: `${a.title} needs you.`, done: `${a.title} is done.`, failed: `${a.title} stopped with an error.`, working: `${a.title} is back at work.` }[a.state];
      if (text) events.push({ t: nowIso, kind: a.state === "done" ? "ship" : "note", text });
    }
    const pt = new Map(((prev.worktrees && prev.worktrees.items) || []).map((t) => [t.branch, t]));
    for (const t of trees) {
      const p = pt.get(t.branch);
      const game = t.games[0] ? ` for ${gameName(t.games[0])}` : "";
      if (!p) {
        if (t.state === "open" || t.state === "local") events.push({ t: since(t.since || t.date), kind: "tree", text: `New work tree: ${t.branch}${game}.` });
      } else if (p.state !== "merged" && t.state === "merged") {
        events.push({ t: t.mergedAt && Date.parse(t.mergedAt) <= nowMs ? t.mergedAt : nowIso, kind: "ship", text: `${t.branch} merged into main${t.pr ? ` (PR #${t.pr.number})` : ""}.` });
      }
    }
    // a local worktree belongs to the machine that ran the last refresh, so its absence here says nothing
    for (const p of pt.values()) {
      if (treeOf.has(p.branch) || p.state === "merged" || p.state === "even" || p.state === "local") continue;
      const m = (git.merged.get(p.branch) || [])[0];
      events.push(m ? { t: m.date && Date.parse(m.date) <= nowMs ? m.date : nowIso, kind: "ship", text: `${p.branch} merged into main (PR #${m.number}).` } : { t: nowIso, kind: "note", text: `Work tree ${p.branch} was deleted before it merged.` });
    }
    const pg = new Map(prevGames.map((g) => [g.id, g]));
    for (const g of games) {
      const p = pg.get(g.id);
      if (!p && g.status === "dev") events.push({ t: nowIso, kind: "tree", text: `New cabinet in development: ${g.name}, on ${g.branch}.` });
      else if (!p) events.push({ t: nowIso, kind: "ship", text: `New cabinet: ${g.name} is live in the arcade.` });
      else if (p.status === "dev" && g.status !== "dev") events.push({ t: nowIso, kind: "ship", text: `${g.name} is live in the arcade.` });
    }
  }

  /* the fingerprint covers what the refresh owns; the hand-kept parts are not in it */
  const fingerprint = createHash("sha1").update(JSON.stringify({
    a: agents.map((a) => [a.id, a.state, a.title, a.summary, a.branch, a.games, a.pr]),
    t: trees.map((t) => [t.branch, t.state, t.head, t.ahead, t.behind, t.pr, t.games, t.local, t.unpushed]),
    g: games.map((g) => [g.id, g.status, g.name, g.commits, g.lastCommit, g.branch]),
  })).digest("hex").slice(0, 16);
  const changed = !prevAuto || prevAuto.fingerprint !== fingerprint;

  board.games = { ...(prev.games || {}), items: games };
  board.agents = { items: agents };
  board.worktrees = { items: trees };
  const feed = [...events, ...((prev.feed && prev.feed.items) || [])];
  feed.sort((a, b) => (Date.parse(b.t) || 0) - (Date.parse(a.t) || 0));
  board.feed = { ...(prev.feed || {}), items: feed.slice(0, FEED_KEEP) };
  board.status = { ...(prev.status || {}) };
  if (changed || !board.status.updated) board.status.updated = nowIso;
  if (!board.status.title) board.status.title = "Cottage Arcade Studio";
  if (!board.status.subtitle || board.status.subtitle === OLD_SUBTITLE) board.status.subtitle = NEW_SUBTITLE;
  if (!board.status.footer || /^This board is republished at every hourly check/.test(board.status.footer)) board.status.footer = NEW_FOOTER;
  board.auto = { version: 1, repo: slug(repo), base: git.base, refreshed: changed ? nowIso : (prevAuto && prevAuto.refreshed) || nowIso, fingerprint };

  const count = (s) => agents.filter((a) => a.state === s).length;
  const counts = {
    agents: agents.length, working: count("working"), review: count("review"), blocked: count("blocked"),
    trees: trees.length, open: trees.filter(openWork).length, live: games.filter((g) => g.status !== "dev").length,
    dev: games.filter((g) => g.status === "dev").length, events: events.length,
  };
  return { board, changed, fingerprint, counts };
}

/* ---------------- main ---------------- */

function main() {
  const a = parseArgs(process.argv.slice(2));
  if (!a.page && !a.fresh) throw new Error("--page is needed: the live page holds the hand-kept sections. Pass --fresh to start without it.");
  if (!a.sessions && !a.noSessions) throw new Error("--sessions is needed: the list_sessions result names the agents. Pass --no-sessions to use branches only.");
  const cwd = path.resolve(a.repoDir || process.cwd());
  const prev = a.page ? extractBoard(readFileSync(a.page, "utf8")) : {};
  if (!prev) throw new Error("no board-data script in " + a.page);
  const template = readFileSync(a.template || path.join(HERE, "page.html"), "utf8");
  const git = collectGit({ cwd, remote: a.remote, base: a.base, fetch: a.fetch, games: (prev.games && prev.games.items) || [] });
  const repo = a.repo || slug(git.url);
  const sessions = a.sessions ? readSessions(readFileSync(a.sessions, "utf8"), repo) : null;
  const prs = a.prs ? readPrs(readFileSync(a.prs, "utf8")) : null;
  const now = a.now ? new Date(a.now) : new Date();
  if (isNaN(now)) throw new Error("--now is not a date: " + a.now);
  const { board, changed, counts } = buildBoard({ prev, sessions, git, now, repo, prs });
  const c = counts;
  const line = `${c.agents} agents (${c.working} working, ${c.review} ready for review, ${c.blocked} need you) · ${c.trees} work trees (${c.open} open) · ${c.live} cabinets live, ${c.dev} in development · ${c.events} feed events`;
  if (a.ifChanged && !changed) { console.log("unchanged · " + line); return; }
  const out = path.resolve(a.out || path.join(HERE, "dist", "index.html"));
  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, renderPage(template, board));
  if (a.json) writeFileSync(a.json, JSON.stringify(board, null, 2));
  console.log((changed ? "changed" : "unchanged") + " · " + line + " → " + out);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (e) { console.error("studio refresh: " + e.message); process.exit(1); }
}
