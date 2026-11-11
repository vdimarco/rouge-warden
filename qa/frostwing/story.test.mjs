// Frostwing's story data and the match options it uses: node qa/frostwing/story.test.mjs
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import * as S from "../../public/frostwing/sim.js";
import { PROLOGUE, OPS, LOG } from "../../public/frostwing/story.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../public/frostwing");
const fails = [];
const check = (ok, msg) => { console.log((ok ? "  ok   " : "  FAIL ") + msg); if (!ok) fails.push(msg); };
const PANS = ["in", "out", "left", "right", "up"];

// every slide: a still that exists, a known speaker, a known pan, a caption a phone can hold
const scenes = [["prologue", PROLOGUE], ...OPS.flatMap((o) => [[o.id + " brief", o.brief], [o.id + " win", o.win]])];
for (const [name, slides] of scenes) {
  const bad = [];
  for (const s of slides) {
    if (!fs.existsSync(path.join(ROOT, "art/story", s.img + ".webp"))) bad.push("no image " + s.img);
    if (s.who && !S.PILOTS[s.who]) bad.push("unknown speaker " + s.who);
    if (s.who && !fs.existsSync(path.join(ROOT, "art", s.who + ".webp"))) bad.push("no portrait for " + s.who);
    if (s.pan && !PANS.includes(s.pan)) bad.push("unknown pan " + s.pan);
    if (!s.text || s.text.length > 240) bad.push(`caption of ${s.text ? s.text.length : 0} characters`);
  }
  check(slides.length > 0 && bad.length === 0, `${name}: ${slides.length} slides, each with a still, a known speaker and a caption of at most 240 characters${bad.length ? " (" + bad.join("; ") + ")" : ""}`);
}

check(OPS.length === 5 && new Set(OPS.map((o) => o.id)).size === 5, "the story has five operations with different ids");
for (const [i, op] of OPS.entries()) {
  const tag = `operation ${i + 1} (${op.id})`;
  const m = S.createMatch({ seed: 3, pilot: op.lantern[0], difficulty: op.difficulty, lantern: op.lantern, corvid: op.corvid, time: op.time, waveEvery: op.waveEvery, boss: op.boss });
  check(m.ships.length === op.lantern.length + op.corvid.length && m.ships.filter((s) => s.team === 0).map((s) => s.pilot).join() === op.lantern.join() && m.player.pilot === op.lantern[0],
    `${tag}: the match fields ${op.lantern.length} Lanterns and ${op.corvid.length} Corvids, and the player flies ${op.lantern[0]}`);
  check(m.time === op.time && m.length === op.time && m.waveEvery === op.waveEvery && !!S.DIFFICULTY[op.difficulty], `${tag}: ${op.time} s on the clock, a shower every ${op.waveEvery} s, rivals at ${op.difficulty}`);
  check(op.lantern.every((p) => S.PILOTS[p].team === 0) && op.corvid.every((p) => S.PILOTS[p].team === 1), `${tag}: each pilot flies for their own side`);
  const inMatch = (p) => m.ships.some((s) => s.pilot === p);
  check(op.radio.length === 2 && op.radio.every(([p]) => inMatch(p)) && inMatch(op.lose[0]), `${tag}: the two opening radio lines and the line after a loss come from pilots in the match`);
  check(["day", "dusk", "night", "storm", "dawn"].includes(op.weather) && op.name && op.place && op.goal, `${tag}: a name, a place, a goal and a known sky (${op.weather})`);
  // the first shower comes 18 s before one full interval, and at least three fall in every operation
  let waves = 0; while (!m.over) { S.step(m, 1 / 60); for (const e of S.takeEvents(m)) if (e.type === "wave") waves++; }
  check(waves >= 3, `${tag}: at least three meteor showers fall (${waves})`);
}
check(!OPS[0].lantern.includes("silas") && OPS.slice(1).every((o) => o.lantern.includes("silas")), "Silas Vane joins in operation 2 and stays");
check(!OPS[0].corvid.includes("vex") && OPS[4].boss === "vex", "Vex Morrow first flies in operation 2 and is the boss of operation 5");

// the boss: 1.8 times the shield and a quarter more gun damage
{
  const plain = S.createMatch({ seed: 1, pilot: "juno" }), boss = S.createMatch({ seed: 1, pilot: "juno", boss: "vex" });
  const a = plain.ships.find((s) => s.pilot === "vex"), b = boss.ships.find((s) => s.pilot === "vex");
  check(Math.abs(b.maxShield - a.maxShield * 1.8) < 1e-9 && b.gun === 1.25 && a.gun === 1 && b.boss && !a.boss, `the boss option gives Vex ${b.maxShield} shield (plain ${a.maxShield}) and 1.25 times the gun damage`);
  b.shield = 1; b.invuln = 0; b.alive = true;
  for (const s of boss.ships) if (s !== b) { s.alive = false; s.respawn = 1e9; }
  b.human = true; b.pitch = -1.1; b.y = S.groundY(b.x, b.z) + 10; // fly it into the snow
  for (let i = 0; i < 600 && b.deaths === 0; i++) S.step(boss, 1 / 60);
  for (let i = 0; i < 60 * (S.RESPAWN + 1); i++) S.step(boss, 1 / 60);
  check(b.deaths === 1 && b.alive && b.shield === b.maxShield && b.maxShield === a.maxShield * 1.8, "a downed boss comes back with the boss shield");
}

// the logbook
check(LOG.length === 16 && LOG.every((e) => e.title && e.text && Number.isInteger(e.need) && e.need >= 0 && e.need <= OPS.length), "the logbook has 16 entries, each opened by 0 to 5 won operations");
check(LOG.filter((e) => e.need === 0).length === 8 && [1, 2, 3, 4, 5].every((n) => LOG.some((e) => e.need === n)), "eight entries are open at the start, and every operation opens at least one more");
check(LOG.every((e, i) => i === 0 || e.need >= LOG[i - 1].need), "logbook entries are listed in the order they open");

// nothing from the game this one is not: no borrowed names in the story text
{
  const text = JSON.stringify([PROLOGUE, OPS, LOG]).toLowerCase();
  const borrowed = ["star fox", "starfox", "mccloud", "arwing", "lylat", "corneria", "andross", "star wolf", "nintendo", "falco", "peppy", "slippy", "venom"].filter((w) => text.includes(w));
  check(borrowed.length === 0, `the story uses only its own names (${borrowed.join(", ") || "none borrowed"})`);
}

console.log(fails.length ? `\n${fails.length} failed` : "\nall passed");
process.exit(fails.length ? 1 : 0);
