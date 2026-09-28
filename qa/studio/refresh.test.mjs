// Checks studio/refresh.mjs, which builds the Cottage Arcade Studio page. Part 1 runs the pure parts in plain node.
// Part 2 builds a small git repo with a bare origin, branches, pull request refs and a local worktree, and runs the
// script on it with fake list_sessions output and an older page: new agents and work trees must appear with no hand
// edits, and the hand-kept sections must stay. Part 3 opens the page in headless Chromium at desktop and phone width
// (it needs the playwright package: project, NODE_PATH or npm -g).
// Run: node qa/studio/refresh.test.mjs   (exit code 1 on failure)
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as studio from "../../studio/refresh.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SCRIPT = path.join(ROOT, "studio/refresh.mjs");
const TEMPLATE = readFileSync(path.join(ROOT, "studio/page.html"), "utf8");
let failed = 0;
function check(name, fn) {
  try { fn(); console.log("ok    " + name); } catch (e) { failed++; console.log("FAIL  " + name + "\n      " + (e && e.message)); }
}
async function checkAsync(name, fn) {
  try { await fn(); console.log("ok    " + name); } catch (e) { failed++; console.log("FAIL  " + name + "\n      " + (e && e.message)); }
}

/* ---------- 1. the pure parts ---------- */
check("slug reads GitHub, proxy and scp remotes", () => {
  assert.equal(studio.slug("https://github.com/vdimarco/rouge-warden"), "vdimarco/rouge-warden");
  assert.equal(studio.slug("http://local_proxy@127.0.0.1:4242/git/vdimarco/rouge-warden"), "vdimarco/rouge-warden");
  assert.equal(studio.slug("git@github.com:Vdimarco/Rouge-Warden.git"), "vdimarco/rouge-warden");
});
check("kindOf and humanize read the branch name", () => {
  assert.equal(studio.kindOf("claude/fishing-game-gyro-x8akp2"), "claude");
  assert.equal(studio.kindOf("ccr-b0d7048a-3ejwai"), "claude");
  assert.equal(studio.kindOf("worktree-fractl-proposal"), "claude");
  assert.equal(studio.kindOf("codex/loon-echo-prototype"), "codex");
  assert.equal(studio.kindOf("feature/new-map"), "human");
  assert.equal(studio.humanize("claude/fishing-game-gyro-x8akp2"), "Fishing game gyro");
  assert.equal(studio.humanize("codex/loon-echo-prototype"), "Loon echo prototype");
  assert.equal(studio.humanize("codex/crimson-rogue-labels"), "Crimson rogue labels");
  assert.equal(studio.humanize("ccr-b0d7048a-3ejwai"), "");
});
check("titleOf keeps the game's name and drops the tail", () => {
  assert.equal(studio.titleOf("<title>The Lab · Cottage Arcade</title>"), "The Lab");
  assert.equal(studio.titleOf("<title>In Full Swing: a VR game for Meta Quest</title>"), "In Full Swing");
  assert.equal(studio.titleOf("<title>Get Plunger&#39;d: Cottage Brawl</title>"), "Get Plunger'd");
  assert.equal(studio.titleOf("<p>no title</p>"), "");
});
check("parseGames reads switch.js as data, comments and all", () => {
  const src = readFileSync(path.join(ROOT, "public/arcade/switch.js"), "utf8");
  const games = studio.parseGames(src);
  assert.ok(games.length >= 5, "only " + games.length + " games");
  const drain = games.find((g) => g.id === "drain");
  assert.equal(drain.url, "/fall/");
  assert.equal(games.find((g) => g.id === "plungerd").name, "Get Plunger'd");
  assert.equal(games.find((g) => g.id === "wild").probe, true);
  assert.deepEqual(studio.parseGames("const GAMES = [ { id: 'a', name: 'It\\'s A', url: '/a/' } ];"), [{ id: "a", name: "It's A", url: "/a/" }]);
});
check("gamesOf ranks real games before the arcade and the workshop", () => {
  const dirs = new Map([["fish", "fish"], ["vr", "vr"], ["fall", "drain"]]);
  assert.deepEqual(studio.gamesOf(["public/arcade/switch.js", "public/arcade/vr.webp", "public/vr/index.html"], dirs), ["vr", "arcade"]);
  assert.deepEqual(studio.gamesOf(["qa/fall/x.mjs", "public/fall/index.html", "public/fish/a.js"], dirs), ["drain", "fish"]);
  assert.deepEqual(studio.gamesOf(["studio/page.html", "qa/studio/refresh.test.mjs", "README.md"], dirs), ["workshop"]);
  assert.deepEqual(studio.gamesOf(["README.md", "docs/x.md"], dirs), []);
});
check("renderPage escapes the data so no text can close the script tag", () => {
  const board = { agents: { items: [{ title: "VR </script><b>game</b>   end" }] } };
  const html = studio.renderPage(TEMPLATE, board);
  assert.ok(!html.includes("</script><b>"), "raw closing tag in the page");
  assert.equal((html.match(/id="board-data"/g) || []).length, 1);
  assert.deepEqual(studio.extractBoard(html), board);
  assert.throws(() => studio.renderPage("<p>no data script</p>", board), /no board-data script/);
});

/* ---------- 2. a real run on a small repo ---------- */
const tmp = mkdtempSync(path.join(os.tmpdir(), "studio-test-"));
const origin = path.join(tmp, "origin.git"), work = path.join(tmp, "work"), wt = path.join(tmp, "wt");
let clock = Date.parse("2026-09-28T08:00:00Z");
function git(cwd, ...args) {
  const d = new Date(clock).toISOString();
  const env = { ...process.env, GIT_AUTHOR_DATE: d, GIT_COMMITTER_DATE: d, GIT_AUTHOR_NAME: "Tester", GIT_AUTHOR_EMAIL: "t@example.com", GIT_COMMITTER_NAME: "Tester", GIT_COMMITTER_EMAIL: "t@example.com" };
  return execFileSync("git", ["-c", "commit.gpgsign=false", "-c", "init.defaultBranch=main", ...args], { cwd, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}
function commit(dir, at, msg, files) {
  clock = Date.parse(at);
  for (const [f, text] of Object.entries(files)) { const p = path.join(dir, f); mkdirSync(path.dirname(p), { recursive: true }); writeFileSync(p, text); }
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", msg);
  return git(dir, "rev-parse", "HEAD");
}
const SWITCH = (extra) => `(() => {\n  const GAMES = [\n    { id: "plungerd", name: "Get Plunger'd", sub: "Cottage Brawl", url: "/plungerd/", art: "/arcade/plungerd.webp", color: "#e6c35c" },\n    // a comment inside the list\n    { id: "fish", name: "Reel It In", sub: "Loon Lake", url: "/fish/", art: "/arcade/fish.webp", color: "#ffb04a" },${extra || ""}\n  ];\n})();\n`;
const WEBP = "RIFF\u0000\u0000\u0000\u0000WEBPVP8 tiny";

mkdirSync(work);
git(tmp, "init", "-q", "--bare", origin);
git(work, "init", "-q");
git(work, "remote", "add", "origin", origin);
commit(work, "2026-09-28T08:00:00Z", "The arcade and two games", {
  "public/index.html": "<title>Cottage Arcade</title>", "public/arcade/switch.js": SWITCH(), "public/arcade/plungerd.webp": WEBP,
  "public/plungerd/index.html": "<title>Get Plunger'd: Cottage Brawl</title>", "public/fish/index.html": "<title>Reel It In: Loon Lake</title>", "README.md": "# game\n",
});
git(work, "push", "-q", "origin", "main");
// a branch that merged through pull request #5
git(work, "checkout", "-q", "-b", "claude/fish-gyro-x8akp2");
const fishHead = commit(work, "2026-09-28T08:30:00Z", "Reel It In: gyro cast", { "public/fish/reel.js": "// reel\n" });
git(work, "push", "-q", "origin", "claude/fish-gyro-x8akp2");
git(work, "push", "-q", "origin", fishHead + ":refs/pull/5/head");
git(work, "checkout", "-q", "main");
clock = Date.parse("2026-09-28T09:00:00Z");
git(work, "merge", "-q", "--no-ff", "-m", "Merge pull request #5 from owner/claude/fish-gyro-x8akp2", "claude/fish-gyro-x8akp2");
commit(work, "2026-09-28T09:10:00Z", "Get Plunger'd: tune", { "public/plungerd/app.js": "// app\n" });
git(work, "push", "-q", "origin", "main");
// an open pull request (#7) that adds a new game folder
git(work, "checkout", "-q", "-b", "ccr-1234abcd-q1w2e3", "main");
const labHead = commit(work, "2026-09-28T10:00:00Z", "The Lab: first rooms", { "public/lab/index.html": "<title>The Lab · Cottage Arcade</title>", "qa/lab/t.mjs": "// t\n" });
git(work, "push", "-q", "origin", "ccr-1234abcd-q1w2e3");
git(work, "push", "-q", "origin", labHead + ":refs/pull/7/head", labHead + ":refs/pull/7/merge");
// a branch that adds a game to switch.js, with its art
git(work, "checkout", "-q", "-b", "claude/vr-swing-zz9zz9", "main");
commit(work, "2026-09-28T11:00:00Z", "In Full Swing: the swing", {
  "public/arcade/switch.js": SWITCH(`\n    { id: "vr", name: "In Full Swing", sub: "Meta Quest VR", url: "/vr/", art: "/arcade/vr.webp", color: "#ff8a3a" },`),
  "public/arcade/vr.webp": WEBP, "public/vr/index.html": "<title>In Full Swing: a VR game</title>",
});
git(work, "push", "-q", "origin", "claude/vr-swing-zz9zz9");
// a Codex branch with no session and no pull request
git(work, "checkout", "-q", "-b", "codex/loon-echo", "main");
commit(work, "2026-09-28T11:30:00Z", "Loon Echo: a prototype", { "public/echo/index.html": "<title>Loon Echo · Cottage Arcade Lab</title>" });
git(work, "push", "-q", "origin", "codex/loon-echo");
// a branch with nothing new, and a local worktree that was never pushed
git(work, "push", "-q", "origin", "main:refs/heads/claude/stale-abc");
git(work, "checkout", "-q", "main");
clock = Date.parse("2026-09-28T09:45:00Z");
git(work, "worktree", "add", "-q", "-b", "worktree-local-idea", wt, "main");
commit(wt, "2026-09-28T09:45:00Z", "An idea for the fish", { "public/fish/idea.js": "// idea\n" });

const session = (id, title, bucket, status, branches, extra = {}) => ({
  id, title, session_status: "SESSION_STATUS_" + status, status_bucket: "SESSION_STATUS_BUCKET_" + bucket,
  created_at: "2026-09-28T09:00:00Z", updated_at: "2026-09-28T11:50:00Z", origin: "android", tags: [],
  session_context: { sources: [{ git_repository: { url: "https://github.com/owner/game" } }], outcomes: [{ git_repository: { git_info: { repo: "owner/game", branches } } }] },
  external_metadata: { current_branches: branches.length ? { "": branches[0] } : {} },
  ...extra,
});
const sessions = [
  session("session_01Lab", "Lab brainstorm", "WORKING", "RUNNING", ["ccr-1234abcd-q1w2e3"], { task_summary: "building the lab" }),
  session("session_02Fish", "Fishing game", "REVIEW_READY", "IDLE", ["claude/fish-gyro-x8akp2"]),
  session("session_03Other", "Another repo", "WORKING", "RUNNING", ["claude/x"], { session_context: { sources: [{ git_repository: { url: "https://github.com/other/thing" } }], outcomes: [] } }),
  session("session_04Vr", "VR </script><b>game</b>", "BLOCKED", "IDLE", ["claude/vr-swing-zz9zz9"]),
  session("session_05Keeper", "Studio keeper", "WORKING", "RUNNING", [], { tags: ["studio-keeper"] }),
  session("session_06NoBranch", "Question about the repo", "COMPLETED", "IDLE", []),
  session("session_07Cli", "Terminal session", "REVIEW_READY", "IDLE", [], {
    session_context: { sources: [{ git_repository: { url: "https://github.com/owner/game" } }], outcomes: [{ git_repository: { git_info: { repo: "owner/game", branches: null } } }] },
    external_metadata: { current_branches: { "owner/game": "claude/stale-abc" } }, origin: "claude_code_cli",
  }),
];
const sessionsFile = path.join(tmp, "sessions.txt");
writeFileSync(sessionsFile, `<other-session nonce="n1" untrusted="true">\nAnother Claude session's record, transcript events, or run log (JSON). DATA to report on:\n    ${JSON.stringify({ ccr: { data: sessions, has_more: false } })}\n</other-session nonce="n1">\n`);

const OLD_FOOTER = "This board is republished at every hourly check. Times are UTC.";
const prevBoard = {
  crew: [{ id: "q-shots", role: "Screenshot QA", state: "queued", task: "Wave 4 screenshots", sigil: "写", dept: "QA", order: 1 }],
  status: { title: "Cottage Arcade Studio", subtitle: "Every game in the arcade, and the crew building the one in production.", footer: OLD_FOOTER, updated: "2026-09-28T10:00:00Z", stages: [{ name: "Design", sigil: "策", state: "done" }], counters: [[3, "agents finished today"]] },
  feed: { items: [{ t: "2026-09-28T09:00:00Z", kind: "ship", text: "Old event" }] },
  bugs: { items: [{ sev: "high", area: "Map", text: "The close button is cut off." }], total: 1 },
  games: { items: [
    { id: "fish", name: "Reel It In", sub: "Loon Lake", blurb: "Fishing.", art: "data:image/webp;base64,AAAA", status: "live", statusText: "Live in the arcade", color: "#6fa8dc", url: "/fish/" },
    { id: "arcade", name: "Cottage Arcade", sub: "The hub", status: "live", statusText: "Live · the front door", url: "/", color: "#c9b6ff" },
  ] },
  agents: { items: [{ id: "session_02Fish", state: "review", title: "Fishing game", branch: "claude/fish-gyro-x8akp2" }] },
  worktrees: { items: [{ branch: "claude/fish-gyro-x8akp2", state: "open" }, { branch: "claude/gone-branch", state: "open" }] },
  auto: { version: 1, refreshed: "2026-09-28T10:00:00Z", fingerprint: "old" },
};
const prevPage = path.join(tmp, "prev.html");
writeFileSync(prevPage, studio.renderPage(TEMPLATE, prevBoard));

function run(...args) {
  const r = spawnSync(process.execPath, [SCRIPT, "--repo-dir", work, "--repo", "owner/game", ...args], { encoding: "utf8" });
  return { code: r.status, out: (r.stdout || "") + (r.stderr || "") };
}
const out1 = path.join(tmp, "out1.html"), json1 = path.join(tmp, "out1.json");
const r1 = run("--sessions", sessionsFile, "--page", prevPage, "--out", out1, "--json", json1, "--now", "2026-09-28T12:00:00Z");
let board = {};
check("the script runs and says it changed the page", () => {
  assert.equal(r1.code, 0, r1.out);
  assert.match(r1.out, /^changed · /);
  board = JSON.parse(readFileSync(json1, "utf8"));
  assert.deepEqual(studio.extractBoard(readFileSync(out1, "utf8")), board);
});
const agent = (id) => (board.agents.items || []).find((a) => a.id === id);
const tree = (b) => (board.worktrees.items || []).find((t) => t.branch === b);
const game = (id) => (board.games.items || []).find((g) => g.id === id);
check("every session on this repo is an agent; other repos and the keeper are not", () => {
  const ids = board.agents.items.map((a) => a.id);
  for (const id of ["session_01Lab", "session_02Fish", "session_04Vr", "session_06NoBranch", "session_07Cli"]) assert.ok(ids.includes(id), id + " missing");
  assert.ok(!ids.includes("session_03Other"), "a session from another repo is on the board");
  assert.ok(!ids.includes("session_05Keeper"), "the studio keeper is on the board");
});
check("agent states follow the session and its work tree", () => {
  assert.equal(agent("session_01Lab").state, "working");
  assert.equal(agent("session_01Lab").summary, "building the lab");
  assert.equal(agent("session_02Fish").state, "done", "review-ready with everything merged is done");
  assert.equal(agent("session_04Vr").state, "blocked");
  assert.equal(agent("session_06NoBranch").state, "done");
  assert.equal(agent("session_06NoBranch").branch, null);
  assert.equal(agent("session_07Cli").branch, "claude/stale-abc", "the branch comes from current_branches");
});
check("a branch with no session becomes an agent of its own kind", () => {
  const codex = agent("branch:codex/loon-echo");
  assert.ok(codex, "no agent for the Codex branch");
  assert.equal(codex.kind, "codex");
  assert.equal(codex.title, "Loon echo");
  assert.equal(codex.state, "working", "a commit 30 min ago on open work reads as working");
  const local = agent("branch:worktree-local-idea");
  assert.ok(local, "no agent for the local worktree");
  assert.equal(local.origin, "worktree");
  assert.equal(local.state, "idle", "no commit in 2 hours reads as idle");
});
check("work trees: open, merged, even and local, with their pull requests and games", () => {
  assert.equal(board.worktrees.items.length, 6);
  assert.deepEqual(pickT(tree("ccr-1234abcd-q1w2e3")), { state: "open", ahead: 1, pr: { number: 7, state: "open" }, games: ["lab"], agent: "session_01Lab" });
  assert.deepEqual(pickT(tree("claude/fish-gyro-x8akp2")), { state: "merged", ahead: 0, pr: { number: 5, state: "merged" }, games: ["fish"], agent: "session_02Fish" });
  assert.deepEqual(tree("claude/vr-swing-zz9zz9").games, ["vr", "arcade"]);
  assert.equal(tree("claude/stale-abc").state, "even");
  assert.equal(tree("codex/loon-echo").pr, null);
  const local = tree("worktree-local-idea");
  assert.equal(local.state, "local");
  assert.equal(path.resolve(local.local), path.resolve(wt));
  assert.deepEqual(local.games, ["fish"]);
});
function pickT(t) { return t && { state: t.state, ahead: t.ahead, pr: t.pr, games: t.games, agent: t.agent }; }
check("cabinets: hand-kept fields stay, git facts refresh, new games join", () => {
  assert.deepEqual(board.games.items.map((g) => g.id), ["fish", "arcade", "plungerd", "lab", "vr", "echo"]);
  const fish = game("fish");
  assert.equal(fish.blurb, "Fishing.");
  assert.equal(fish.art, "data:image/webp;base64,AAAA");
  assert.equal(fish.color, "#6fa8dc");
  assert.ok(fish.commits >= 2, "fish commits " + fish.commits);
  assert.equal(fish.latest, "Reel It In: gyro cast");
  const plungerd = game("plungerd");
  assert.equal(plungerd.status, "live");
  assert.match(plungerd.art, /^data:image\/webp;base64,/);
  assert.equal(plungerd.kanji, "栓");
  assert.ok(game("arcade").commits >= 1);
  assert.deepEqual([game("lab").status, game("lab").name, game("lab").branch], ["dev", "The Lab", "ccr-1234abcd-q1w2e3"]);
  assert.deepEqual([game("vr").name, game("vr").sub, game("vr").color], ["In Full Swing", "Meta Quest VR", "#ff8a3a"]);
  assert.match(game("vr").art, /^data:image\/webp;base64,/);
  assert.equal(game("echo").name, "Loon Echo");
});
check("the hand-kept sections stay, and the old header lines are updated once", () => {
  assert.deepEqual(board.crew, prevBoard.crew);
  assert.deepEqual(board.bugs, prevBoard.bugs);
  assert.deepEqual(board.status.stages, prevBoard.status.stages);
  assert.deepEqual(board.status.counters, prevBoard.status.counters);
  assert.notEqual(board.status.subtitle, prevBoard.status.subtitle);
  assert.notEqual(board.status.footer, OLD_FOOTER);
  assert.equal(board.status.updated, "2026-09-28T12:00:00Z");
  assert.equal(board.auto.repo, "owner/game");
});
check("the feed tells what is new since the last refresh", () => {
  const texts = board.feed.items.map((f) => f.text);
  const has = (re) => assert.ok(texts.some((t) => re.test(t)), "no feed line like " + re + "\n      " + texts.join("\n      "));
  has(/^Old event$/);
  has(/^New agent: Lab brainstorm, on ccr-1234abcd-q1w2e3\.$/);
  has(/^New agent: Loon echo, on codex\/loon-echo\.$/);
  has(/^Fishing game is done\.$/);
  has(/^claude\/fish-gyro-x8akp2 merged into main \(PR #5\)\.$/);
  has(/^New work tree: ccr-1234abcd-q1w2e3 for The Lab\.$/);
  has(/^New work tree: worktree-local-idea for Reel It In\.$/);
  has(/^Work tree claude\/gone-branch was deleted before it merged\.$/);
  has(/^New cabinet in development: In Full Swing, on claude\/vr-swing-zz9zz9\.$/);
  has(/^New cabinet: Get Plunger'd is live in the arcade\.$/);
  assert.ok(!texts.some((t) => /Question about the repo|Terminal session/.test(t)), "a finished agent got a 'new agent' line");
  const times = board.feed.items.map((f) => Date.parse(f.t));
  assert.deepEqual(times, [...times].sort((a, b) => b - a), "the feed is not newest first");
});
check("--if-changed writes nothing when nothing changed", () => {
  const out2 = path.join(tmp, "out2.html");
  const r = run("--sessions", sessionsFile, "--page", out1, "--out", out2, "--if-changed", "--now", "2026-09-28T12:30:00Z");
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /^unchanged · /);
  assert.ok(!existsSync(out2), "the page was written anyway");
});
const out3 = path.join(tmp, "out3.html"), json3 = path.join(tmp, "out3.json");
check("a new branch shows up at the next refresh as a work tree and an agent", () => {
  git(work, "checkout", "-q", "-b", "claude/new-thing-ab12cd", "main");
  commit(work, "2026-09-28T12:40:00Z", "Get Plunger'd: a new thing", { "public/plungerd/new.js": "// new\n" });
  git(work, "push", "-q", "origin", "claude/new-thing-ab12cd");
  const r = run("--sessions", sessionsFile, "--page", out1, "--out", out3, "--json", json3, "--if-changed", "--now", "2026-09-28T12:45:00Z");
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /^changed · /);
  const b3 = JSON.parse(readFileSync(json3, "utf8"));
  const a = b3.agents.items.find((x) => x.branch === "claude/new-thing-ab12cd");
  assert.ok(a, "no agent for the new branch");
  assert.deepEqual([a.kind, a.title, a.state, a.games[0]], ["claude", "New thing", "working", "plungerd"]);
  const texts = b3.feed.items.map((f) => f.text);
  assert.ok(texts.includes("New work tree: claude/new-thing-ab12cd for Get Plunger'd."), texts.slice(0, 4).join(" | "));
  assert.ok(texts.includes("New agent: New thing, on claude/new-thing-ab12cd."));
  assert.equal(texts.filter((t) => t === "Old event").length, 1, "the feed repeated an old line");
});
check("a game in development goes live when its branch merges", () => {
  git(work, "checkout", "-q", "main");
  clock = Date.parse("2026-09-28T13:00:00Z");
  git(work, "merge", "-q", "--no-ff", "-m", "Merge pull request #7 from owner/ccr-1234abcd-q1w2e3", "ccr-1234abcd-q1w2e3");
  git(work, "push", "-q", "origin", "main");
  git(work, "push", "-q", "origin", ":refs/pull/7/merge"); // GitHub drops the merge ref when a pull request merges
  const out4 = path.join(tmp, "out4.html"), json4 = path.join(tmp, "out4.json");
  const r = run("--sessions", sessionsFile, "--page", out3, "--out", out4, "--json", json4, "--now", "2026-09-28T13:05:00Z");
  assert.equal(r.code, 0, r.out);
  const b4 = JSON.parse(readFileSync(json4, "utf8"));
  const lab = b4.games.items.find((g) => g.id === "lab");
  assert.deepEqual([lab.status, lab.statusText, lab.branch], ["live", "Live in the arcade", undefined]);
  const t = b4.worktrees.items.find((x) => x.branch === "ccr-1234abcd-q1w2e3");
  assert.deepEqual([t.state, t.pr], ["merged", { number: 7, state: "merged" }]);
  const texts = b4.feed.items.map((f) => f.text);
  assert.ok(texts.includes("The Lab is live in the arcade."), texts.slice(0, 5).join(" | "));
  assert.ok(texts.includes("ccr-1234abcd-q1w2e3 merged into main (PR #7)."), texts.slice(0, 5).join(" | "));
});
check("the script refuses to run without the live page or the sessions", () => {
  const a = run("--sessions", sessionsFile, "--out", path.join(tmp, "x.html"));
  assert.equal(a.code, 1);
  assert.match(a.out, /--page is needed/);
  const b = run("--page", prevPage, "--out", path.join(tmp, "x.html"));
  assert.equal(b.code, 1);
  assert.match(b.out, /--sessions is needed/);
});

/* ---------- 3. the page in Chromium ---------- */
await (async () => {
  const req = createRequire(import.meta.url);
  let pw = null;
  try { pw = req("playwright"); } catch (e) { try { pw = req(path.join(execFileSync("npm", ["root", "-g"], { encoding: "utf8" }).trim(), "playwright")); } catch (e2) { /* none */ } }
  if (!pw) { failed++; console.log("FAIL  page: the playwright package is missing (npm i -g playwright)"); return; }
  let browser;
  try { browser = await pw.chromium.launch(); } catch (e) { browser = await pw.chromium.launch({ executablePath: "/opt/pw-browsers/chromium" }); }
  // the same skeleton the Artifact tool wraps a page in
  const html = '<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light}body{margin:0}[hidden]{display:none!important}</style></head><body>' + readFileSync(out1, "utf8") + "</body></html>";
  for (const [label, width, scheme] of [["desktop, light", 1280, "light"], ["phone, dark", 390, "dark"]]) {
    await checkAsync("page renders the agents and work trees (" + label + ")", async () => {
      const page = await browser.newPage({ viewport: { width, height: 900 }, colorScheme: scheme, reducedMotion: "reduce" });
      const errors = [];
      page.on("pageerror", (e) => errors.push(String(e)));
      page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
      await page.route(/^https?:\/\//, (r) => r.abort());
      await page.setContent(html, { waitUntil: "load" });
      const got = await page.evaluate(() => ({
        cards: [...document.querySelectorAll("#agents .card h3")].map((h) => h.textContent),
        states: [...document.querySelectorAll("#agents .card .state")].map((s) => s.textContent),
        finished: document.querySelectorAll("#finished li").length,
        rows: document.querySelectorAll("#trees tr:not(.group)").length,
        cabs: document.querySelectorAll("#cabs .cab").length,
        dev: document.querySelectorAll("#cabs .cab.dev").length,
        prod: !document.getElementById("prod").hidden,
        wide: document.documentElement.scrollWidth - innerWidth,
        bg: getComputedStyle(document.body).backgroundColor,
        drawn: document.getElementById("floorcv").toDataURL().length,
        offline: !document.getElementById("offline").hidden,
      }));
      await page.close();
      assert.deepEqual(errors, []);
      assert.equal(got.offline, false, "the page could not read its data");
      assert.equal(got.cards.length, 4, "cards: " + got.cards.join(", "));
      assert.ok(got.cards.includes("VR </script><b>game</b>"), "the title with markup did not show as plain text");
      assert.ok(got.states.includes("Needs you") && got.states.some((s) => /Working/.test(s)), got.states.join(", "));
      assert.equal(got.finished, 3);
      assert.equal(got.rows, 6);
      assert.equal(got.cabs, 6);
      assert.equal(got.dev, 3);
      assert.equal(got.prod, true);
      assert.ok(got.wide <= 0, "the page scrolls sideways by " + got.wide + "px");
      assert.equal(got.bg, scheme === "dark" ? "rgb(18, 17, 22)" : "rgb(236, 238, 241)");
      assert.ok(got.drawn > 20000, "the floor view looks empty");
    });
  }
  await browser.close();
})();

rmSync(tmp, { recursive: true, force: true });
console.log(failed ? `\n${failed} check(s) failed` : "\nall studio checks pass");
process.exit(failed ? 1 : 0);
