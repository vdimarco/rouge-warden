// Play metrics for Primordia (design section 8.4). Wraps one Game run and reports JSON.
//
// Library:   import { Metrics, runBot } from "./metrics.mjs"
//            const m = new Metrics(game, meta); each frame: m.frame(() => game.update(1 / 60, input)); m.report()
// One run:   node qa/primordia/metrics.mjs [seconds=160] [seed=7] [policy=ref] [--portrait] [--no-assist] [--snap 160]
// Acceptance table (spawns bot runs in parallel processes):
//            node qa/primordia/metrics.mjs --accept [--seeds 7,11,23] [--short 160] [--long 320] [--jobs 4]
//                                          [--orients landscape,portrait] [--out file.json] [--json] [--no-perf]
//            After the pool, two 160 s ref runs (landscape, portrait) are made one at a time for the frame-time
//            row; --no-perf skips them and judges frame time on the parallel runs instead.
//
// The Metrics class only observes. It reads game state and events after each update, and wraps three
// Game methods on the instance (glory, endDash, bossGate) to see whether a Glory Bite lands inside the
// dash that staggered the hunter (or collapsed the Leviathan), and three more (devour, creditEgg,
// addGrowth) to learn which meal or kill each growth point came from. The wrappers call the originals
// with the same arguments and return their results; they never change what the game does.
//
// Sizes (growth design section 10): `epoch` is the size index, so every per-size record is keyed to
// game.epoch. A size's seconds are real play seconds (frames that start in the play state, hit-stop
// included), from the size's start to the frame its grow sequence starts. The grow sequence and the
// cards are not play: they add nothing to a size's time, steering, uncontested or engaged clocks.
import { pathToFileURL, fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { Game, TUNE, SPECIES, SP } from "../../public/primordia/core.js";

export const DT = 1 / 60;
const PROMPT_MERGE = 0.25; // prompts closer than this count as one decision
const ENGAGE = 60;         // "a hunter is within 60 cells"
const CONTEST = 25;        // tissue closer than this means steering is contested
const HUSK_WINDOW = 5;     // seconds after play resumes in which eating a converted Orbium counts
const HUSK_STEPS = 100;    // dish steps after the zoom at which converted Orbium survival is read
// growth-point sources; the hunter share of growth counts kills of named hunter bodies
const GP_SRC = ["prey", "remains", "golden", "husk", "egg", "swarm", "brood", "lancer", "heavy", "other"];
const HUNTER_SRC = ["swarm", "brood", "lancer", "heavy"];
const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
export const roman = (n) => ROMAN[n] || String(n);

const r1 = (x) => (Number.isFinite(x) ? Math.round(x * 10) / 10 : x);
const r2 = (x) => (Number.isFinite(x) ? Math.round(x * 100) / 100 : x);
const r3 = (x) => (Number.isFinite(x) ? Math.round(x * 1000) / 1000 : x);
function stat(a) {
  if (!a.length) return { n: 0 };
  const s = [...a].sort((x, y) => x - y), q = (f) => s[Math.min(s.length - 1, Math.floor(f * s.length))];
  return { n: a.length, mean: r2(a.reduce((x, y) => x + y, 0) / a.length), med: r2(q(0.5)), p90: r2(q(0.9)), max: r2(s[s.length - 1]) };
}

export class Metrics {
  constructor(g, meta = {}) {
    this.g = g;
    this.meta = meta;
    this.frameNo = 0; this.steps = 0;
    this.ms = []; this.msSum = 0;
    this.alive = 0; this.lastTime = g.time;
    this.minLight = Infinity; this.minLightAt = 0;
    this.died = null;
    this.burstTime = 0; this.readyTime = 0; this.fullTime = 0;
    this.engaged = 0; this.prompts = []; this.lastPrompt = -Infinity; this.promptKinds = {};
    this.ready2 = false;
    this.uncontested = 0; this.uncontestedStrict = 0;
    this.sizes = {};
    // growth: real play clock, growth points by source, damage by bar quarter, zooms, ripe waits,
    // Leviathan fights, converted Orbium, and arcs seen per size
    this.realT = 0; this.growFrames = 0; this.mutateFrames = 0; this.prevState = g.state;
    this.gp = Object.fromEntries(GP_SRC.map((k) => [k, 0])); this.gpOverflow = 0; this.gpSrc = null;
    this.dmgQ = [0, 0, 0, 0, 0]; this.secQ = [0, 0, 0, 0, 0];
    this.zooms = []; this.ripeAt = null; this.ripeAfterBoss = false; this.fights = []; this.fight = null;
    this.huskWatch = null; this.eatenPrey = new WeakSet(); this.zoomMs = { begin: [], finish: [], cards: [] };
    this.arcSpawns = {};
    this.sizeRec(g.epoch).start = 0;
    this.kills = { glory: 0, bleed: 0, rupture: 0, burst: 0, gulp: 0 };
    this.killsBySpecies = {};
    this.self = 0; this.selfInPurge = 0; this.merges = 0;
    this.eggsPopped = 0; this.eggsHatched = 0; this.debris = 0; this.brood = 0;
    this.bursts = []; this.openBurst = null;
    this.tides = 0; this.tidesAfterAttack = 0; this.purgeOnsets = 0; this.blooms = 0; this.wasPurge = false;
    this.lungeAt = new Map(); this.cutAt = new Map(); this.mawAt = new Map(); this.selfLog = []; this.tideLog = []; this.tideCauses = {};
    this.counts = {};
    this.prey = 0; this.remainsSpawned = 0; this.remainsEaten = 0; this.golden = 0; this.husksEaten = 0;
    // the body caps, plus at most 2 common Heptapteryx (the Leviathan is not counted)
    this.caps = { ...g.caps(), hepta: TUNE.grow?.heptaCap ?? 2 };
    this.capV = { frames: 0, episodes: 0, first: [], max: { gliders: 0, swarm: 0, eggs: 0, bodies: 0, hepta: 0 }, by: {} };
    this.capVc = { frames: 0, episodes: 0, first: [], max: { gliders: 0, swarm: 0, eggs: 0, bodies: 0, hepta: 0 }, by: {} };
    this.capWas = false; this.capWasC = false;
    this.sameDash = []; this.sameDashBoss = []; this.dashEndFrame = -1; this.collapseDash = new Map();
    this.waveClears = []; this.waveSpawns = [];
    this.bossSeen = new Map(); this.bossKills = []; this.bossFades = 0;
    // lunge reach: where the player was when each lane locked
    this.locks = 0; this.lockInLane = 0; this.lockNd = [];
    // observe Glory Bites that land in the same dash that staggered the hunter (design 2.3, test 12), and
    // Leviathan bites in the same dash that collapsed it (the 2.5 s collapse is the boss's stagger)
    const glory = g.glory.bind(g), endDash = g.endDash.bind(g), bossGate = g.bossGate.bind(g);
    const inDash = () => g.player.dashT > 0 || this.dashEndFrame === this.frameNo;
    g.endDash = (...a) => { this.dashEndFrame = this.frameNo; return endDash(...a); };
    g.bossGate = (e) => {
      const was = e.state, dashing = g.player.dashT > 0 || !!g.player.dashEnded || this.dashEndFrame === this.frameNo;
      const r = bossGate(e);
      if (e.state === "collapse" && was !== "collapse") this.collapseDash.set(e.id, dashing ? g.player.dashId : -1);
      return r;
    };
    g.glory = (e) => {
      const P = g.player;
      if (g.hunters.includes(e) && P.dashId > 0 && inDash()) {
        if (!e.boss && e.staggerDash === P.dashId) this.sameDash.push({ t: r2(g.time), id: e.id, name: e.name || (e.brood ? "Brood" : "?"), dashId: P.dashId, finalFrame: P.dashT <= 0 });
        if (e.boss && this.collapseDash.get(e.id) === P.dashId) this.sameDashBoss.push({ t: r2(g.time), id: e.id, collapsedFor: r2(g.time - e.stateAt), dashId: P.dashId, finalFrame: P.dashT <= 0 });
      }
      return glory(e);
    };
    // which meal or kill each growth point came from (a stack, since a kill can set off more kills)
    const devour = g.devour.bind(g), creditEgg = g.creditEgg.bind(g), addGrowth = g.addGrowth.bind(g);
    const withSrc = (src, fn) => { const was = this.gpSrc; this.gpSrc = src; try { return fn(); } finally { this.gpSrc = was; } };
    g.devour = (e, kind, opts) => {
      if (kind === "prey") this.eatenPrey.add(e);
      return withSrc(this.gpSource(e, kind), () => devour(e, kind, opts));
    };
    g.creditEgg = (e, src) => withSrc("egg", () => creditEgg(e, src));
    g.addGrowth = (n, x, y) => {
      const before = g.growth, full = before >= g.bar(), on = n > 0 && g.mode === "play" && !g.growHold && g.state === "play";
      const r = addGrowth(n, x, y);
      const gained = g.growth - before;
      if (on && full) this.gpOverflow += n;
      if (gained > 0) {
        const k = this.gpSrc || "other";
        this.gp[k] += gained;
        const E = this.sizeRec(g.epoch);
        E.gp[k] = (E.gp[k] || 0) + gained;
      }
      return r;
    };
  }

  gpSource(e, kind) {
    if (kind === "prey") return e.golden ? "golden" : e.converted ? "husk" : e.remains ? "remains" : "prey";
    if (e.boss) return "other";
    if (e.species === SP.DISC) return "swarm";
    if (e.brood) return "brood";
    if (e.species === SP.PARA || e.species === SP.PENTA) return "lancer";
    if (e.species === SP.HEXA || e.species === SP.HEPTA) return "heavy";
    return "other";
  }

  sizeRec(n) {
    return (this.sizes[n] ??= {
      sec: 0, play: 0, start: null, end: null, done: false, hunger: 0, contact: 0, lunge: 0, uncontested: 0, engaged: 0, prompts: 0, burst: 0,
      lungeHits: 0, windups: 0, gp: {}, ripeAt: null, apexAt: null, fight: 0,
    });
  }

  prompt(kind) {
    const t = this.g.time;
    this.promptKinds[kind] = (this.promptKinds[kind] || 0) + 1;
    if (t - this.lastPrompt < PROMPT_MERGE) return;
    this.lastPrompt = t;
    // prompts are placed on the "engaged clock", which only runs while a hunter is within 60 cells
    if (this.isEngaged()) { this.prompts.push(this.engaged); this.sizeRec(this.g.epoch).prompts++; }
  }

  isEngaged() {
    const g = this.g;
    // outgrown bodies are food, not a fight
    return g.player.alive && g.hunters.some((e) => !e.egg && e.nd <= ENGAGE && !(g.edible && g.edible(e)));
  }

  // run one update through fn (so its wall time is measured alone) and account for what it did
  frame(fn) {
    const g = this.g, P = g.player;
    const loss0 = { ...g.stats.loss }, epoch = g.epoch, hits0 = g.stats.lungeHits, windups0 = g.stats.lunges;
    // play resumed after the cards (the runner picks a card between frames)
    const st0 = g.state, playing = st0 === "play";
    if (playing && this.prevState !== "play" && this.prevState !== "over") this.onResume();
    // the bar quarter this frame's damage counts against (4: the bar is full)
    const q = g.growth >= g.bar() ? 4 : Math.min(3, Math.floor((4 * g.growth) / g.bar()));
    const t0 = performance.now();
    fn();
    const ms = performance.now() - t0;
    this.frameNo++;
    this.ms.push(ms); this.msSum += ms;
    const dtg = g.time - this.lastTime;
    this.lastTime = g.time;
    const E = this.sizeRec(epoch);
    // the grow sequence and the cards are not play time
    if (playing) { E.sec += dtg; E.play += DT; this.realT += DT; }
    else if (st0 === "grow") this.growFrames++;
    else if (st0 === "mutate") this.mutateFrames++;
    E.hunger += g.stats.loss.hunger - loss0.hunger;
    const dCL = g.stats.loss.contact - loss0.contact + g.stats.loss.lunge - loss0.lunge;
    E.contact += g.stats.loss.contact - loss0.contact;
    E.lunge += g.stats.loss.lunge - loss0.lunge;
    E.lungeHits += g.stats.lungeHits - hits0;
    E.windups += g.stats.lunges - windups0;
    if (playing && g.mode === "play") { this.dmgQ[q] += dCL; this.secQ[q] += DT; }
    const W = g.world;
    for (const ev of g.events) this.onEvent(ev, ms);
    this.prevState = g.state;
    for (const e of g.hunters) if (e.boss) this.bossSeen.set("last", { id: e.id, phase: e.phase, state: e.state, mass: Math.round(e.mass) });
    if (W.purge.B && !this.wasPurge) this.purgeOnsets++;
    this.wasPurge = W.purge.B;
    this.checkCaps();
    if (!P.alive || g.state === "over") { if (!this.died) this.died = { t: r1(g.time), epoch: g.epoch, size: g.epoch, real: r1(this.realT) }; return; }
    if (g.state !== "play") return;
    this.alive += dtg;
    const lf = P.light / P.maxLight;
    if (lf < this.minLight) { this.minLight = lf; this.minLightAt = g.time; }
    if (g.burstT > 0) {
      this.burstTime += dtg; E.burst += dtg;
      // the hunt-phase maw drains whatever tissue it sits in
      const reach = g.mawRadius() * 1.1;
      for (const e of g.hunters) if (e.nd <= reach) this.mawAt.set(e.id, g.time);
    }
    if (g.ready) this.readyTime += dtg;
    if (P.charges >= g.maxCharges()) this.fullTime += dtg;
    const engaged = this.isEngaged();
    if (engaged) { this.engaged += dtg; E.engaged += dtg; }
    // Burst ready with 2+ hunters inside the 20-cell ring: a prompt when it starts being true
    const ring = g.ready && g.burstT <= 0 && g.hunters.filter((e) => !e.egg && e.nd <= TUNE.burst.catch && !(g.edible && g.edible(e))).length >= 2;
    if (ring && !this.ready2) this.prompt("burstRing");
    this.ready2 = ring;
    // uncontested steering: nothing but prey to think about (the diagnosis definition): no hunter tissue
    // (eggs included) within 25 cells, no Burst active or ready, no golden prey. "strict" also counts
    // Stasis and live Remains as contested.
    // outgrown bodies (gold ring) are food and never sting: they do not contest steering
    let minNd = Infinity;
    for (const e of g.hunters) if (e.nd < minNd && !(g.edible && g.edible(e))) minNd = e.nd;
    const golden = g.prey.some((p) => p.golden);
    const free = minNd >= CONTEST && g.burstT <= 0 && !g.ready && !golden;
    if (free) { this.uncontested += dtg; E.uncontested += dtg; }
    if (free && g.stasisT <= 0 && !g.prey.some((p) => p.remains)) this.uncontestedStrict += dtg;
  }

  onEvent(ev, ms = 0) {
    const g = this.g, W = g.world;
    this.counts[ev.type] = (this.counts[ev.type] || 0) + 1;
    switch (ev.type) {
      case "step":
        this.steps++;
        if (this.huskWatch && !this.huskWatch.done && this.steps - this.huskWatch.step0 >= HUSK_STEPS) this.readHusks();
        break;
      // growth: the bar fills, the dish waits for a clean moment, grows, and play resumes after the cards
      case "ripe": if (this.ripeAt === null) { this.ripeAt = this.realT; this.ripeAfterBoss = !!g.afterBoss; } { const E = this.sizeRec(g.epoch); E.ripeAt ??= r1(this.realT - E.start); } break;
      case "apex": {
        this.fight = { size: g.epoch, apexAt: this.realT, spawnAt: null, endAt: null, how: null };
        this.fights.push(this.fight);
        this.sizeRec(g.epoch).apexAt = r1(this.realT - this.sizeRec(g.epoch).start);
        break;
      }
      case "spawn":
        if (ev.kind === "hunter") {
          if (ev.boss && this.fight && this.fight.spawnAt === null) this.fight.spawnAt = this.realT;
          if (!ev.boss && ev.role !== "egg" && ev.role !== "swarm") (this.arcSpawns[g.epoch] ??= {})[ev.name] = (this.arcSpawns[g.epoch][ev.name] || 0) + 1;
        }
        break;
      case "growStart": this.onGrowStart(); break;
      case "zoomBegin": this.zoomMs.begin.push(ms); if (this.zooms.length) this.zooms[this.zooms.length - 1].sources = ev.converted; break;
      case "zoomFinish": {
        this.zoomMs.finish.push(ms);
        const z = this.zooms[this.zooms.length - 1];
        if (z) {
          z.placed = (ev.at || []).filter((a) => !a.golden).length; z.golden = (ev.at || []).filter((a) => a.golden).length;
          z.from = (ev.at || []).filter((a) => !a.golden).map((a) => a.from);
          z.hunters = z.from.filter((f) => f !== "Remains").length;
        }
        // the converted Orbium the tracker now holds: how many still live (or were eaten) 100 steps on
        const husks = g.prey.filter((p) => p.converted);
        this.huskWatch = { z, step0: this.steps, list: husks, done: false };
        if (z) z.husks = { n: husks.length, alive: null, eaten: null };
        break;
      }
      case "epochEnd": this.zoomMs.cards.push(ms); break;
      // no cards to offer: the next size started in the same frame
      case "epochStart": if (g.state === "play" && this.prevState !== "mutate") this.onResume(); break;
      case "windup":
        if (g.dist(ev.x, ev.y, g.player.x, g.player.y) <= 40) this.prompt("windup");
        break;
      case "stagger": this.prompt("stagger"); break;
      case "bossPhase": case "collapse": this.prompt(ev.type); break;
      case "remains": this.remainsSpawned++; this.prompt("remains"); break;
      case "crack": this.prompt("crack"); break;
      case "lunge": this.lungeAt.set(ev.id, g.time); break;
      case "lock": {
        // could this lunge reach the player if the player stood still? (inside the locked lane rectangle)
        const e = g.hunters.find((h) => h.id === ev.id), P = g.player;
        if (!e || !e.lane || !P.alive) break;
        this.locks++;
        this.lockNd.push(e.nd);
        if (g.inLane(e, P.x, P.y)) this.lockInLane++;
        break;
      }
      case "tissueHit": this.cutAt.set(ev.id, g.time); break;
      case "tide": this.onTide(); break;
      case "bloom": this.blooms++; break;
      case "fade":
        if (ev.boss) { this.bossFades++; if (this.fight && this.fight.endAt === null) { this.fight.endAt = this.realT; this.fight.how = "fade"; } }
        break;
      case "selfDeath":
        this.self++;
        this.selfLog.push({ t: g.time, id: ev.id });
        if (W.purge.B || W.toxin.B > 0.05) this.selfInPurge++;
        break;
      case "rupture":
        if (ev.fused) { this.self++; this.merges++; this.selfLog.push({ t: g.time, id: ev.id }); if (W.purge.B || W.toxin.B > 0.05) this.selfInPurge++; }
        break;
      case "devour":
        if (ev.kind === "prey") {
          this.prey++;
          if (ev.remains) this.remainsEaten++;
          if (ev.golden) this.golden++;
          if (ev.converted) {
            this.husksEaten++;
            const z = this.zooms[this.zooms.length - 1];
            if (z && z.resumeAt !== null && z.huskAt === null) z.huskAt = r2(this.realT - z.resumeAt);
          }
        } else if (ev.species !== undefined || ev.name === "Brood") {
          if (ev.boss && this.fight && this.fight.endAt === null) { this.fight.endAt = this.realT; this.fight.how = ev.how; }
          const how = ev.how in this.kills ? ev.how : "burst";
          this.kills[how]++;
          if (ev.boss) { const b = this.bossSeen.get("last"); this.bossKills.push({ t: r1(g.time), how: ev.how, phase: b?.phase, state: b?.state }); }
          const k = ev.boss ? "Leviathan" : ev.name || "Brood";
          (this.killsBySpecies[k] ??= {})[how] = (this.killsBySpecies[k][how] || 0) + 1;
          if (this.openBurst) this.openBurst.kills++;
        }
        break;
      case "pop": this.eggsPopped++; break;
      case "hatch": this.eggsHatched++; break;
      case "dissolve": this.debris++; break;
      case "brood": this.brood++; break;
      case "burst":
        this.openBurst = { t: r1(g.time), caught: ev.caught, points: ev.points, kills: 0 };
        this.bursts.push(this.openBurst);
        break;
      case "burstEnd": this.openBurst = null; break;
      case "wave": this.waveSpawns.push({ t: r1(g.time), size: g.epoch, wave: ev.wave, units: ev.units }); break;
      case "waveClear": this.waveClears.push({ t: r1(g.time), size: g.epoch, wave: ev.wave }); break;
    }
  }

  // the bar filled earlier; now the dish grows and the size ends
  onGrowStart() {
    const g = this.g, E = this.sizeRec(g.epoch);
    E.end = r1(this.realT); E.done = true;
    const red = g.hunters.filter((e) => g.isNamed(e) && !e.egg).length;
    this.zooms.push({
      size: g.epoch + 1, at: r1(this.realT), t: r1(g.time),
      ripeWait: this.ripeAt === null ? null : r2(this.realT - this.ripeAt), afterBoss: this.ripeAfterBoss,
      herald: !!g.heraldSent, red, sources: null, placed: null, hunters: null, golden: null, from: [],
      resumeAt: null, huskAt: null, husks: null,
    });
    this.ripeAt = null; this.ripeAfterBoss = false;
  }

  // the first play frame after the cards
  onResume() {
    const z = this.zooms[this.zooms.length - 1];
    if (z && z.resumeAt === null) z.resumeAt = this.realT;
    this.sizeRec(this.g.epoch).start ??= this.realT;
  }

  readHusks() {
    const H = this.huskWatch, live = new Set(this.g.prey);
    H.done = true;
    if (!H.z) return;
    H.z.husks.alive = H.list.filter((p) => live.has(p)).length;
    H.z.husks.eaten = H.list.filter((p) => !live.has(p) && this.eatenPrey.has(p)).length;
  }

  // A tide: hunter matter passed its limit. It counts as started by a player attack or a lunge when the
  // swollen body, or a named hunter that vanished into something in the 5 s before, lunged, was torn
  // (dash cut, proc, Burst blast) or sat in the Burst maw shortly before.
  onTide() {
    const g = this.g, now = g.time;
    this.tides++;
    let big = null, ratio = 0;
    for (const e of g.hunters) { const r = e.mass / g.baseMass(e); if (r > ratio) { ratio = r; big = e; } }
    const culprits = [];
    if (big) culprits.push({ id: big.id, t: now });
    for (const s of this.selfLog) if (now - s.t < 5) culprits.push(s);
    // causes, most specific first: the Burst maw chewing on the body, a lunge, a cut or proc (tissueHit)
    const causes = new Set();
    const recent = (map, c, win) => { const t = map.get(c.id); return t !== undefined && now - t < 10 && c.t - t < win; };
    for (const c of culprits) {
      if (recent(this.mawAt, c, 6)) causes.add("burstMaw");
      if (recent(this.lungeAt, c, 3)) causes.add("lunge");
      if (recent(this.cutAt, c, 3)) causes.add("cut");
    }
    if (this.selfLog.some((s2) => now - s2.t < 5)) causes.add("merge");
    const cause = [...causes].join("+") || "none";
    this.tideCauses[cause] = (this.tideCauses[cause] || 0) + 1;
    if (causes.has("lunge") || causes.has("cut") || causes.has("burstMaw")) this.tidesAfterAttack++;
    if (this.tideLog.length < 6) this.tideLog.push({
      t: Math.round(now * 100) / 100, cause, massB: Math.round(g.world.massB), limitB: Math.round(g.world.limit.B),
      swollen: big ? { id: big.id, name: big.boss ? "Leviathan" : big.name || (big.brood ? "Brood" : "untagged"), mass: Math.round(big.mass), x: Math.round(ratio * 10) / 10 } : null,
      vanishedBefore: this.selfLog.filter((s) => now - s.t < 5).map((s) => s.id),
    });
  }

  // the same body counts as capRoom() in core.js: tracked hunters plus pending spawns. A second view also
  // counts stamped bodies that tracking has not matched yet (claims), which capRoom() does not see.
  checkCaps() {
    const g = this.g, c = this.caps;
    let gliders = 0, swarm = 0, eggs = 0, hepta = 0;
    const list = [];
    // common Heptapteryx (not the Leviathan) also have their own cap of 2
    const add = (role, label, isHepta) => { if (role === "egg") eggs++; else { gliders++; if (role === "swarm") swarm++; } if (isHepta) hepta++; list.push(label); };
    const T = (o) => !!o && o.species === SP.HEPTA && !o.boss;
    for (const e of g.hunters) add(e.egg ? "egg" : e.species === SP.DISC ? "swarm" : "glider", e.boss ? "Leviathan" : e.name || (e.brood ? "Brood" : `debris${Math.round(e.mass)}`), T(e));
    for (const p of g.pending) if (p.kind === "hunter") add(SPECIES[p.species].role === "egg" ? "egg" : SPECIES[p.species].role === "swarm" ? "swarm" : "glider", `pending:${p.boss ? "Leviathan" : p.name}`, T(p));
    const n1 = { gliders, swarm, eggs, bodies: gliders + eggs, hepta };
    for (const cl of g.claims) if (cl.kind === "hunter") { const role = SPECIES[cl.tags.species]?.role; add(role === "egg" ? "egg" : role === "swarm" ? "swarm" : "glider", `stamped:${cl.tags.boss ? "Leviathan" : cl.tags.name}`, T(cl.tags)); }
    const n2 = { gliders, swarm, eggs, bodies: gliders + eggs, hepta };
    const over = (n) => Object.keys(n).filter((k) => n[k] > c[k]);
    const note = (V, n, bad, was) => {
      for (const k of Object.keys(n)) V.max[k] = Math.max(V.max[k], n[k]);
      if (!bad.length) return false;
      V.frames++;
      for (const k of bad) V.by[k] = (V.by[k] || 0) + 1;
      if (!was) { V.episodes++; if (V.first.length < 6) V.first.push({ t: r2(g.time), over: bad, ...n, bodies: list.slice() }); }
      return true;
    };
    this.capWas = note(this.capV, n1, over(n1), this.capWas);
    this.capWasC = note(this.capVc, n2, over(n2), this.capWasC);
  }

  report() {
    const g = this.g, P = g.player, S = g.stats, T = Math.max(1e-9, this.alive);
    const L = S.loss, lossTotal = L.hunger + L.contact + L.lunge;
    const named = this.kills.glory + this.kills.bleed + this.kills.rupture + this.kills.burst + this.kills.gulp + this.self;
    // decision gaps on the engaged clock; the stretch after the last prompt counts as an open gap
    const ps = this.prompts, gaps = [];
    for (let i = 1; i < ps.length; i++) gaps.push(ps[i] - ps[i - 1]);
    if (ps.length) gaps.push(this.engaged - ps[ps.length - 1]); else if (this.engaged > 0) gaps.push(this.engaged);
    const perSize = {};
    let worst = 0, worstSize = null;
    for (const [k, E] of Object.entries(this.sizes)) {
      if (E.sec < 1) continue;
      const un = E.uncontested / E.sec;
      // only full sizes (grown out of, or 35 s of play) count toward the worst-size figure
      if ((E.done || E.play >= 35) && un > worst) { worst = un; worstSize = +k; }
      const fight = this.fights.filter((f) => f.size === +k && f.endAt !== null).reduce((a, f) => a + (f.endAt - f.apexAt), 0);
      const gp = Object.fromEntries(Object.entries(E.gp).filter(([, v]) => v > 0));
      const gained = Object.values(gp).reduce((a, b) => a + b, 0);
      perSize[k] = {
        play: r1(E.play), sec: r1(E.sec), done: E.done, start: r1(E.start), end: E.end, ripeAt: E.ripeAt, apexAt: E.apexAt, fight: r1(fight),
        hunger: r1(E.hunger), contact: r1(E.contact), lunge: r1(E.lunge), contactLunge: r1(E.contact + E.lunge),
        contactLungePerMin: r1(((E.contact + E.lunge) * 60) / Math.max(1, E.play)),
        lungeHits: E.lungeHits, windups: E.windups, uncontested: r3(un), engagedSec: r1(E.engaged), prompts: E.prompts,
        meanGap: E.prompts ? r2(E.engaged / E.prompts) : null, burstShare: r3(E.burst / E.sec),
        gp, gained, hunterShare: gained ? r3(HUNTER_SRC.reduce((a, x) => a + (gp[x] || 0), 0) / gained) : null,
      };
    }
    // growth
    const gpTotal = GP_SRC.reduce((a, k) => a + this.gp[k], 0), gpHunt = HUNTER_SRC.reduce((a, k) => a + this.gp[k], 0);
    const zs = this.zooms.filter((z) => z.placed !== null);
    const growth = {
      size: g.epoch, growth: g.growth, bar: g.bar(), zooms: this.zooms.length,
      gp: { ...this.gp, total: gpTotal, hunters: gpHunt, overflow: this.gpOverflow }, hunterShare: gpTotal ? r3(gpHunt / gpTotal) : null,
      gpPerMin: r1((gpTotal * 60) / Math.max(1, this.realT)),
      converted: stat(zs.map((z) => z.placed)), convertedAtLeast1: zs.length ? r3(zs.filter((z) => z.placed >= 1).length / zs.length) : null,
      ripeWait: stat(this.zooms.filter((z) => z.ripeWait !== null).map((z) => z.ripeWait)),
      ripeWaitNoBoss: stat(this.zooms.filter((z) => z.ripeWait !== null && !z.afterBoss).map((z) => z.ripeWait)),
      huskIn5: { zooms: zs.filter((z) => z.placed >= 1 && z.resumeAt !== null).length, ate: zs.filter((z) => z.placed >= 1 && z.huskAt !== null && z.huskAt <= HUSK_WINDOW).length },
      huskLife: { n: zs.reduce((a, z) => a + (z.husks && z.husks.alive !== null ? z.husks.n : 0), 0), alive: zs.reduce((a, z) => a + (z.husks?.alive ?? 0), 0), eaten: zs.reduce((a, z) => a + (z.husks?.eaten ?? 0), 0) },
      husksEaten: this.husksEaten,
      // contact plus lunge damage by bar quarter (index 4: bar full, waiting to grow or fighting the Leviathan)
      dmgByQuarter: this.dmgQ.map(r1), secByQuarter: this.secQ.map(r1), dmgPerMinByQuarter: this.dmgQ.map((d, i) => r1((d * 60) / Math.max(1, this.secQ[i]))),
      fights: this.fights.map((f) => ({ size: f.size, sec: f.endAt === null ? null : r1(f.endAt - f.apexAt), open: f.endAt === null ? r1(this.realT - f.apexAt) : null, warn: f.spawnAt === null ? null : r1(f.spawnAt - f.apexAt), how: f.how })),
      zoomLog: this.zooms.map((z) => ({ ...z, resumeAt: z.resumeAt === null ? null : r1(z.resumeAt) })),
      zoomMs: { begin: stat(this.zoomMs.begin), finish: stat(this.zoomMs.finish), cards: stat(this.zoomMs.cards) },
      arcSpawns: this.arcSpawns,
      frames: { grow: this.growFrames, mutate: this.mutateFrames }, realPlay: r1(this.realT),
    };
    const ms = this.ms.length ? [...this.ms].sort((a, b) => a - b) : [0];
    const mins = T / 60;
    // a deep copy: a snapshot taken mid-run must not change as the run goes on (it used to share
    // bossKills, caps.first, tides.log and other live arrays with this object)
    return structuredClone({
      ...this.meta,
      dish: [g.w, g.h], compact: g.compact,
      t: r1(g.time), alive: r1(this.alive), survived: P.alive, died: this.died, epoch: g.epoch, size: g.epoch, score: g.score,
      light: { min: r3(this.minLight), minAt: r1(this.minLightAt), final: r1(P.light), max: P.maxLight },
      loss: { hunger: r1(L.hunger), contact: r1(L.contact), lunge: r1(L.lunge), total: r1(lossTotal), stingLungeShare: r3(lossTotal ? (L.contact + L.lunge) / lossTotal : 0) },
      removals: {
        ...this.kills, self: this.self, selfInPurge: this.selfInPurge, named, selfShare: r3(named ? this.self / named : 0),
        eggsPopped: this.eggsPopped, eggsHatched: this.eggsHatched, broodSpawned: this.brood, debrisDissolved: this.debris, bySpecies: this.killsBySpecies,
      },
      burst: { count: this.bursts.length, uptime: r3(this.burstTime / T), readyShare: r3(this.readyTime / T), caught: this.bursts.map((b) => b.caught), killsDuring: this.bursts.map((b) => b.kills), points: this.bursts.reduce((a, b) => a + b.points, 0) },
      stasis: { count: S.stasis, perMin: r2(S.stasis / mins) },
      parries: S.parries, grazes: S.grazes, lunges: S.lunges, lungeHits: S.lungeHits, glory: S.glory,
      staggers: this.counts.stagger || 0, cancels: this.counts.cancel || 0,
      // windups (S.lunges counts windups), lane locks, and how many locked lanes held the player at lock
      // time: a lunge whose lane does not cover a standing player can only hit one who swims into it
      lungeReach: { windups: S.lunges, locks: this.locks, cancels: this.counts.cancel || 0, lunges: this.counts.lunge || 0, playerInLaneAtLock: this.locks ? r3(this.lockInLane / this.locks) : null, ndAtLock: stat(this.lockNd), hits: S.lungeHits, grazes: S.grazes },
      decisions: { engagedSec: r1(this.engaged), prompts: ps.length, meanGap: ps.length ? r2(this.engaged / ps.length) : null, gaps: stat(gaps), byKind: this.promptKinds },
      uncontested: { overall: r3(this.uncontested / T), strict: r3(this.uncontestedStrict / T), worst: r3(worst), worstSize },
      perSize, growth,
      tides: { count: this.tides, afterLungeOrCut: this.tidesAfterAttack, causes: this.tideCauses, purgeOnsets: this.purgeOnsets, merges: this.merges, blooms: this.blooms, log: this.tideLog },
      caps: { limit: this.caps, violations: this.capV.frames, episodes: this.capV.episodes, by: this.capV.by, max: this.capV.max, first: this.capV.first,
        withStamped: { violations: this.capVc.frames, episodes: this.capVc.episodes, by: this.capVc.by, max: this.capVc.max, first: this.capVc.first.slice(0, 3) } },
      perf: { msPerFrame: r2(this.msSum / Math.max(1, this.ms.length)), p95: r2(ms[Math.floor(ms.length * 0.95)]), max: r2(ms[ms.length - 1]), msPerStep: r2(this.msSum / Math.max(1, this.steps)), frames: this.frameNo, steps: this.steps },
      dash: { uses: S.dashes, perMin: r1(S.dashes / mins), fullShare: r3(this.fullTime / T) },
      food: { prey: this.prey, remainsSpawned: this.remainsSpawned, remainsEaten: this.remainsEaten, golden: this.golden, converted: this.husksEaten, gulps: S.gulps || 0 },
      waves: { cleared: S.waves, spawned: this.waveSpawns.length, clears: this.waveClears.slice(0, 12) },
      // finalFrame: bitten in the frame whose movement finished the dash (its last cut segment), after the cut
      sameDashGlory: { n: this.sameDash.length, finalFrame: this.sameDash.filter((x) => x.finalFrame).length, of: S.glory, first: this.sameDash.slice(0, 3), boss: this.sameDashBoss.length, bossFirst: this.sameDashBoss.slice(0, 3) },
      leviathan: { kills: this.bossKills, fadedAway: this.bossFades },
    });
  }
}

// One full bot run with optional snapshots (reports taken at given game times). Deterministic.
export function runBot({ seconds = 160, seed = 7, policy = "ref", portrait = false, assist = portrait, react = 0.15, snaps = [], onEvents = null, policyFactory } = {}) {
  const [w, h] = portrait ? [128, 256] : [256, 128];
  const g = new Game(w, h, seed, { touch: portrait });
  g.reset("play");
  const make = policyFactory || botFactory;
  if (!make) throw new Error("runBot needs bot.mjs (call loadBot() first or pass policyFactory)");
  const bot = make(policy, g, { seed, assist, react });
  const m = new Metrics(g, { policy, seed, orient: portrait ? "portrait" : "landscape", assist: !!assist, react: policy === "ref" || policy === "asap" ? react : null });
  const out = { snaps: {} };
  const want = [...snaps].sort((a, b) => a - b);
  // the bot must keep its hands off during the grow sequence and the cards (it picks a card in mutate)
  let nonPlayInputs = 0, stuck = 0;
  const pressed = (inp) => !!(inp && (inp.mx || inp.my || inp.dash || inp.burst));
  while (g.time < seconds && g.state !== "over") {
    if (g.state === "mutate") g.choose(bot.card());
    const st = g.state, input = bot.input();
    if (st !== "play" && pressed(input)) nonPlayInputs++;
    const t0 = g.time;
    m.frame(() => g.update(DT, input));
    if (onEvents) onEvents(g, g.events);
    g.events.length = 0;
    // game time stands still in the grow sequence and the cards; a long stall means a stuck run
    stuck = g.time === t0 ? stuck + 1 : 0;
    if (stuck > 600) { out.stuck = { state: g.state, t: g.time, growT: g.growT }; break; }
    while (want.length && g.time >= want[0]) out.snaps[want.shift()] = m.report();
  }
  // a run that ended early still answers its snapshots with the final state
  for (const s of want) out.snaps[s] = m.report();
  out.final = m.report();
  out.final.nonPlayInputs = nonPlayInputs;
  if (out.stuck) out.final.stuck = out.stuck;
  if (bot.state?.stats) out.final.bot = bot.state.stats;
  return out;
}

let botFactory = null;
export async function loadBot() {
  if (!botFactory) ({ makePolicy: botFactory } = await import("./bot.mjs"));
  return botFactory;
}

// ---------------------------------------------------------------- acceptance table (design 8.4)
function runChild(args) {
  const bot = fileURLToPath(new URL("./bot.mjs", import.meta.url));
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, [bot, ...args.map(String), "--json"], { stdio: ["ignore", "pipe", "inherit"] });
    let s = "";
    p.stdout.on("data", (d) => (s += d));
    p.on("close", (code) => {
      if (code !== 0) return reject(new Error(`bot ${args.join(" ")} exited ${code}`));
      try { resolve(JSON.parse(s.trim().split("\n").pop())); } catch (e) { reject(e); }
    });
  });
}

async function pool(tasks, jobs, onDone) {
  const out = new Array(tasks.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(jobs, tasks.length) }, async () => {
    while (next < tasks.length) { const i = next++; out[i] = await tasks[i](); onDone?.(i, out[i]); }
  }));
  return out;
}

export async function acceptance({ seeds = [7, 11, 23], orients = ["landscape", "portrait"], short = 160, long = 320, jobs = 4, extra = [], perf = true, log = console.error } = {}) {
  const specs = [];
  for (const orient of orients) for (const seed of seeds) {
    const o = [...(orient === "portrait" ? ["--portrait"] : []), ...extra];
    specs.push({ policy: "ref", seed, orient, args: [long, seed, "ref", ...o, "--snap", short] });
    specs.push({ policy: "asap", seed, orient, args: [short, seed, "asap", ...o] });
    specs.push({ policy: "blind", seed, orient, args: [short, seed, "blind", ...o] });
    specs.push({ policy: "idle", seed, orient, args: [60, seed, "idle", ...o] });
  }
  // longest first so the pool stays busy
  specs.sort((a, b) => b.args[0] - a.args[0]);
  const t0 = Date.now();
  const res = await pool(specs.map((s) => () => runChild(s.args)), jobs, (i, r) => log(`done ${specs[i].policy} ${specs[i].seed} ${specs[i].orient} (${((Date.now() - t0) / 1000).toFixed(0)} s)`));
  const runs = specs.map((s, i) => ({ ...s, res: res[i] }));
  // frame time is judged on runs made one at a time: parallel runs share the CPU and read slow
  const perfRuns = [];
  if (perf) for (const orient of orients) {
    const args = [short, seeds[0], "ref", ...(orient === "portrait" ? ["--portrait"] : []), ...extra];
    perfRuns.push({ policy: "ref", seed: seeds[0], orient, args, res: await runChild(args) });
    log(`done timing run ref ${seeds[0]} ${orient} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  }
  return { runs, perfRuns, table: evaluate(runs, { seeds, orients, short, long, perfRuns }), wallSec: Math.round((Date.now() - t0) / 1000), jobs };
}

export function evaluate(runs, { seeds, orients, short, long, perfRuns = [] }) {
  const pick = (policy, seed, orient) => runs.find((r) => r.policy === policy && r.seed === seed && r.orient === orient)?.res;
  const cases = [];
  for (const orient of orients) for (const seed of seeds) cases.push({ seed, orient, tag: `${seed}${orient[0]}` });
  const pct = (x) => (x == null || !Number.isFinite(x) ? "-" : `${(100 * x).toFixed(1)}%`);
  const R = roman;
  const rows = [];
  const row = (metric, target, items, extra) => {
    const k = items.filter((i) => i.ok).length;
    rows.push({ metric, target, verdict: target === "info" ? "info" : k === items.length ? "met" : `missed (${k} of ${items.length} met)`, values: items.map((i) => `${i.tag}: ${i.v}`).join(", "), ...(extra || {}) });
  };
  // a row judged once on numbers pooled over every case, with each case's own numbers listed after
  const pooled = (metric, target, ok, v, items, verdict) => rows.push({ metric, target, verdict: verdict || (target === "info" ? "info" : ok ? "met" : "missed"), values: `${v}; ${items.map((i) => `${i.tag}: ${i.v}`).join(", ")}` });
  const ref160 = (c) => pick("ref", c.seed, c.orient)?.snaps?.[short];
  const refLong = (c) => pick("ref", c.seed, c.orient)?.final;
  // a ref metric judged at both lengths: "value at short / value at long"
  const both = (c, get, ok, fmt = (x) => x) => {
    const a = get(ref160(c)), b = get(refLong(c));
    return { tag: c.tag, ok: ok(a) && ok(b), v: `${fmt(a)} / ${fmt(b)}` };
  };
  const L = `${short} / ${long} s`;
  const P = ["ref", "asap", "blind", "idle"];

  // ---- growth (growth design section 10) ----
  row(`Ref seconds per size (${long} s; Size III without its Leviathan fight)`, "I 30-50 s; II-IV 35-60 s", cases.map((c) => {
    const pe = refLong(c).perSize, parts = [], oks = [];
    for (const n of [1, 2, 3, 4]) {
      const E = pe[n];
      if (!E || !E.done) { parts.push(`${R(n)} ${E ? `${E.play}+ unfinished` : "not reached"}`); oks.push(false); continue; }
      const sec = n === 3 ? E.play - E.fight : E.play, [lo, hi] = n === 1 ? [30, 50] : [35, 60];
      oks.push(sec >= lo && sec <= hi);
      parts.push(`${R(n)} ${r1(sec)}${n === 3 ? ` (+${E.fight} fight)` : ""}`);
    }
    const later = Object.keys(pe).filter((k) => +k >= 5).map((k) => `${R(+k)} ${pe[k].play}${pe[k].done ? "" : "+"}`);
    return { tag: c.tag, ok: oks.every(Boolean), v: [...parts, ...later].join(" / ") };
  }));
  row(`Leviathan fight, bar full to gone (ref, ${long} s)`, "35 s or less", cases.map((c) => {
    const f = refLong(c).growth.fights;
    if (!f.length) return { tag: c.tag, ok: false, v: "no Leviathan" };
    const ok = f.every((x) => (x.sec !== null ? x.sec <= 35 : x.open <= 35));
    return { tag: c.tag, ok, v: f.map((x) => `${R(x.size)} ${x.sec === null ? `open ${x.open}s at run end` : `${x.sec}s ${x.how}`}`).join(", ") };
  }));
  row(`Blind bot never reaches Size II (${short} s)`, "stays in Size I", cases.map((c) => {
    const r = pick("blind", c.seed, c.orient).final;
    return { tag: c.tag, ok: r.growth.zooms === 0, v: `${r.died ? `died ${r.died.t}s` : `alive ${r.t}s`} in Size ${R(r.size)}, bar ${r.growth.growth}/${r.growth.bar}` };
  }));
  row(`Blind bot dies, before Size IV (${short} s)`, "dies", cases.map((c) => { const r = pick("blind", c.seed, c.orient).final; const ok = !!r.died && r.died.size < 4; return { tag: c.tag, ok, v: r.died ? `died ${r.died.t}s Size ${R(r.died.size)}` : `alive ${r.t}s Size ${R(r.size)}` }; }));
  row("Idle bot", "dies within 40 s", cases.map((c) => { const r = pick("idle", c.seed, c.orient); const ok = !!r.final.died && r.final.died.t <= 40; return { tag: c.tag, ok, v: r.final.died ? `${r.final.died.t}s` : "alive" }; }));
  {
    const per = cases.map((c) => ({ tag: c.tag, zs: refLong(c).growth.zoomLog.filter((z) => z.placed !== null) }));
    const all = per.flatMap((p) => p.zs.map((z) => z.placed)), st = stat(all), at1 = all.length ? all.filter((x) => x >= 1).length / all.length : 0;
    const hs = per.flatMap((p) => p.zs.map((z) => z.hunters)), sh = stat(hs), h1 = hs.length ? hs.filter((x) => x >= 1).length / hs.length : 0;
    pooled(`Converted Orbium per zoom (ref, ${long} s, all cases pooled; old hunters and fresh Remains, not golden prey)`, "median 2 or more; at least 1 in 90% of zooms", all.length > 0 && st.med >= 2 && at1 >= 0.9,
      `${all.length} zooms, median ${st.med ?? "-"}, at least 1 in ${pct(at1)}; old hunters only: median ${sh.med ?? "-"}, at least 1 in ${pct(h1)}`,
      per.map((p) => ({ tag: p.tag, v: p.zs.map((z) => (z.hunters < z.placed ? `${z.placed}(${z.hunters})` : z.placed)).join(" ") || "none" })));
    const waits = per.map((p) => ({ tag: p.tag, w: refLong(cases.find((c) => c.tag === p.tag)).growth.zoomLog.filter((z) => z.ripeWait !== null) }));
    const wall = waits.flatMap((p) => p.w.map((z) => z.ripeWait)), ws = stat(wall), wn = stat(waits.flatMap((p) => p.w.filter((z) => !z.afterBoss).map((z) => z.ripeWait)));
    pooled(`Ripe wait, bar full to the dish growing (ref, ${long} s, pooled; L marks a wait after a Leviathan)`, "median 1.5 s or less; 90th percentile 3.5 s or less", wall.length > 0 && ws.med <= 1.5 && ws.p90 <= 3.5,
      `${ws.n} waits, median ${ws.med ?? "-"} s, p90 ${ws.p90 ?? "-"} s, max ${ws.max ?? "-"} s (without the Leviathan: median ${wn.med ?? "-"}, p90 ${wn.p90 ?? "-"})`,
      waits.map((p) => ({ tag: p.tag, v: p.w.map((z) => `${z.ripeWait}${z.afterBoss ? "L" : ""}${z.herald ? "h" : ""}`).join(" ") || "none" })));
    const lives = per.map((p) => p.zs.filter((z) => z.husks && z.husks.alive !== null));
    const n = lives.flat().reduce((a, z) => a + z.husks.n, 0), ok = lives.flat().reduce((a, z) => a + z.husks.alive + z.husks.eaten, 0);
    pooled(`Converted Orbium alive or eaten ${HUSK_STEPS} dish steps after the zoom (ref, ${long} s, pooled)`, "85% or more", n > 0 && ok / n >= 0.85,
      `${ok} of ${n} (${pct(n ? ok / n : null)})`, per.map((p, i) => ({ tag: p.tag, v: lives[i].map((z) => `${z.husks.alive}+${z.husks.eaten}/${z.husks.n}`).join(" ") || "none" })));
  }
  row(`Ref eats a converted Orbium within ${HUSK_WINDOW} s of resuming (${long} s)`, "in at least half the zooms", cases.map((c) => {
    const G = refLong(c).growth, h = G.huskIn5;
    const firsts = G.zoomLog.filter((z) => z.placed >= 1).map((z) => (z.huskAt === null ? "-" : z.huskAt));
    return { tag: c.tag, ok: h.zooms > 0 && h.ate >= h.zooms / 2, v: `${h.ate} of ${h.zooms} (first bite after ${firsts.join(" ")} s)` };
  }));
  {
    const per = cases.map((c) => ({ tag: c.tag, G: refLong(c).growth }));
    const sum = [0, 1, 2, 3, 4].map((i) => per.reduce((a, p) => a + p.G.dmgByQuarter[i], 0)), sec = [0, 1, 2, 3, 4].map((i) => per.reduce((a, p) => a + p.G.secByQuarter[i], 0));
    const perMin = sum.map((d, i) => r1((d * 60) / Math.max(1, sec[i])));
    // a few stray stings cannot decide this: under 20 light in the first and last quarters together, it is not judged
    const thin = sum[0] + sum[3] < 20;
    pooled(`Contact plus lunge damage by GROW bar quarter (ref, ${long} s, pooled)`, "last quarter at most 2x the first (else hitShare 0.5)", sum[3] <= 2 * sum[0],
      `Q1-Q4 ${sum.slice(0, 4).map(r1).join("/")} light (full bar ${r1(sum[4])}), last/first ${sum[0] ? r2(sum[3] / sum[0]) : "-"}; per minute ${perMin.slice(0, 4).join("/")} (full ${perMin[4]})`,
      per.map((p) => ({ tag: p.tag, v: `${p.G.dmgByQuarter.slice(0, 4).join("/")} (full ${p.G.dmgByQuarter[4]})` })),
      thin ? `not judged: ${r1(sum[0] + sum[3])} light in Q1 and Q4 together (under 20)` : null);
  }
  row(`Hunter share of growth (ref, ${long} s)`, "55-75%", cases.map((c) => { const G = refLong(c).growth; return { tag: c.tag, ok: G.hunterShare >= 0.55 && G.hunterShare <= 0.75, v: `${pct(G.hunterShare)} of ${G.gp.total} GP, ${G.gpPerMin}/min` }; }));
  row(`Growth points by source (ref, ${long} s)`, "info", cases.map((c) => { const g = refLong(c).growth.gp; return { tag: c.tag, ok: true, v: GP_SRC.filter((k) => g[k]).map((k) => `${k} ${g[k]}`).join(" ") + (g.overflow ? `; overflow ${g.overflow}` : "") }; }));
  row("Bot input during the grow sequence and the cards (all policies)", "0", cases.map((c) => {
    const rs = P.map((p) => pick(p, c.seed, c.orient).final), n = rs.reduce((a, r) => a + (r.nonPlayInputs || 0), 0), z = rs.reduce((a, r) => a + r.growth.zooms, 0), stuck = rs.filter((r) => r.stuck);
    return { tag: c.tag, ok: n === 0 && !stuck.length, v: `${n} frames over ${z} zooms${stuck.length ? `; stuck ${JSON.stringify(stuck.map((r) => r.stuck))}` : ""}` };
  }));
  row(`Outgrown arcs never come back red in Sizes II-IV (ref ${long} s + asap ${short} s)`, "0 spawns", cases.map((c) => {
    const banned = { 2: ["Paraptera"], 3: ["Paraptera", "Pentapteryx"], 4: ["Paraptera", "Pentapteryx", "Hexapteryx"] };
    const letter = { Paraptera: "P", Pentapteryx: "Q", Hexapteryx: "H", Heptapteryx: "T" }, bad = [], seen = [];
    for (const r of [refLong(c), pick("asap", c.seed, c.orient).final]) for (const [n, names] of Object.entries(banned)) {
      const sp = r.growth.arcSpawns[n] || {};
      for (const nm of names) if (sp[nm]) bad.push(`${nm} x${sp[nm]} in ${R(+n)}`);
    }
    const A = refLong(c).growth.arcSpawns;
    for (const n of [2, 3, 4]) if (A[n]) seen.push(`${R(n)} ${Object.entries(A[n]).map(([k, v]) => `${letter[k] || k}${v}`).join("")}`);
    return { tag: c.tag, ok: bad.length === 0, v: bad.length ? bad.join(", ") : `ref arcs ${seen.join(" ") || "none"}` };
  }));
  row(`Sizes reached (ref ${short} / ${long} s, asap ${short} s)`, "info", cases.map((c) => ({ tag: c.tag, ok: true, v: `${R(ref160(c).size)} / ${R(refLong(c).size)}, asap ${R(pick("asap", c.seed, c.orient).final.size)}` })));

  // ---- the combat rows, rekeyed to sizes ----
  row(`Ref bot survives (${L})`, "alive at the end", cases.map((c) => both(c, (r) => r, (r) => r.survived, (r) => (r.survived ? "alive" : `died ${r.died.t}s`))));
  row(`Ref minimum light (${L})`, "30-50%", cases.map((c) => both(c, (r) => r.light.min, (x) => x >= 0.3 && x <= 0.5, pct)));
  row(`Stings plus lunges, share of ref light loss (${L})`, "30-50%", cases.map((c) => both(c, (r) => r.loss.stingLungeShare, (x) => x >= 0.3 && x <= 0.5, pct)));
  row(`Named hunter deaths without the player (ref, ${L})`, "under 15% (hard fail 30%)", cases.map((c) => both(c, (r) => r.removals, (x) => x.selfShare < 0.15, (x) => `${pct(x.selfShare)} (${x.self}/${x.named})`)));
  row(`Costly decision gap within 60 cells (ref, ${L})`, "3 s or less", cases.map((c) => both(c, (r) => r.decisions.meanGap, (x) => x != null && x <= 3, (x) => `${x}s`)));
  row(`Burst uptime (ref, ${L})`, "12% or less", cases.map((c) => both(c, (r) => r.burst.uptime, (x) => x <= 0.12, pct)));
  row(`Burst uptime (asap, ${short} s)`, "12% or less", cases.map((c) => { const r = pick("asap", c.seed, c.orient).final; return { tag: c.tag, ok: r.burst.uptime <= 0.12, v: pct(r.burst.uptime) }; }));
  for (const orient of orients) {
    const items = seeds.map((seed) => { const a = pick("asap", seed, orient).final, r = pick("ref", seed, orient).snaps[short]; return { tag: `${seed}${orient[0]}`, ok: r.score > a.score, v: `ref ${r.score} vs asap ${a.score}` }; });
    const wins = items.filter((i) => i.ok).length;
    rows.push({ metric: `asap vs ref score (${orient}, ${short} s)`, target: "ref wins on 2 of 3 seeds", verdict: wins >= 2 ? "met" : "missed", values: items.map((i) => `${i.tag}: ${i.v}`).join(", ") });
  }
  row(`Stasis per minute (ref, ${L})`, "3-8", cases.map((c) => both(c, (r) => r.stasis.perMin, (x) => x >= 3 && x <= 8)));
  row(`Red tides started by lunges or player attacks (ref, ${long} s)`, "0", cases.map((c) => { const r = refLong(c); return { tag: c.tag, ok: r.tides.afterLungeOrCut === 0, v: `${r.tides.afterLungeOrCut} of ${r.tides.count}${r.tides.count ? ` ${JSON.stringify(r.tides.causes).replace(/"/g, "")}` : ""}` }; }));
  row("Cap violations, 2 Heptapteryx included (all policies)", "0", cases.map((c) => {
    const rs = P.map((p) => pick(p, c.seed, c.orient).final);
    const n = rs.reduce((a, r) => a + r.caps.episodes, 0), f = rs.reduce((a, r) => a + r.caps.violations, 0), h = Math.max(...rs.map((r) => r.caps.max.hepta || 0));
    return { tag: c.tag, ok: n === 0, v: `${n} episodes, ${f} frames (most Heptapteryx ${h})` };
  }));
  row(`Dash uses (ref, first ${short} s)`, "20 or more", cases.map((c) => { const r = ref160(c); return { tag: c.tag, ok: r.dash.uses >= 20, v: r.dash.uses }; }));
  row(`All dash charges full (ref, ${L})`, "under 60% of the time", cases.map((c) => both(c, (r) => r.dash.fullShare, (x) => x < 0.6, pct)));
  row(`Contact plus lunge damage per minute by size (ref, ${long} s)`, "rises from Size I to IV", cases.map((c) => {
    const pe = refLong(c).perSize, keys = Object.keys(pe).map(Number).sort((a, b) => a - b);
    const full = [1, 2, 3, 4].every((k) => pe[k] && pe[k].done);
    const ys = [1, 2, 3, 4].map((k) => pe[k]?.contactLungePerMin ?? 0), ym = ys.reduce((a, b) => a + b, 0) / 4;
    const slope = ys.reduce((a, y, i) => a + (i + 1 - 2.5) * (y - ym), 0) / 5;
    return { tag: c.tag, ok: full && ys[3] > ys[0] && slope > 0, v: `${keys.map((k) => pe[k].contactLungePerMin).join("/")} per min, raw ${keys.map((k) => pe[k].contactLunge).join("/")} (slope I-IV ${r2(slope)}/size)${full ? "" : " (Sizes I-IV not all finished)"}` };
  }));
  row(`Blind score vs ref score (${short} s)`, "under 50%", cases.map((c) => { const b = pick("blind", c.seed, c.orient).final, r = ref160(c); return { tag: c.tag, ok: b.score < 0.5 * r.score, v: `${pct(r.score ? b.score / r.score : null)}` }; }));
  row(`Uncontested steering, worst full size (ref, ${long} s; grow and card time excluded)`, "under 35%", cases.map((c) => { const r = refLong(c); return { tag: c.tag, ok: r.uncontested.worst < 0.35, v: `${pct(r.uncontested.worst)} Size ${R(r.uncontested.worstSize)} (${Object.values(r.perSize).map((e) => Math.round(100 * e.uncontested)).join("/")})` }; }));
  if (perfRuns.length) row(`ms per frame, Node, one run at a time (ref seed ${perfRuns[0].seed}, ${short} s)`, "3.5 or less", perfRuns.map((p) => { const r = p.res.final; return { tag: `${p.seed}${p.orient[0]}`, ok: r.perf.msPerFrame <= 3.5, v: `${r.perf.msPerFrame} (p95 ${r.perf.p95}, max ${r.perf.max})` }; }));
  else row(`ms per frame, Node (ref, ${short} s; parallel runs, so slower than alone)`, "3.5 or less", cases.map((c) => { const r = ref160(c); return { tag: c.tag, ok: r.perf.msPerFrame <= 3.5, v: `${r.perf.msPerFrame} (p95 ${r.perf.p95})` }; }));
  {
    const src = perfRuns.length ? perfRuns.map((p) => ({ tag: `${p.seed}${p.orient[0]}`, Z: p.res.final.growth.zoomMs })) : cases.map((c) => ({ tag: c.tag, Z: refLong(c).growth.zoomMs }));
    row(`Grow sequence frames, ms in Node (${perfRuns.length ? `one run at a time, ${short} s` : `ref ${long} s, parallel runs`})`, "median of each phase 20 or less", src.map(({ tag, Z }) => ({
      tag, ok: Z.begin.n > 0 && Z.begin.med <= 20 && Z.finish.med <= 20,
      v: Z.begin.n ? `shrink med ${Z.begin.med} max ${Z.begin.max}, refill med ${Z.finish.med} max ${Z.finish.max}, cards med ${Z.cards.med} (${Z.begin.n} zooms)` : "no zoom",
    })));
  }
  // rule checks the bot runs exercise (design 2.3 and 3.5), reported next to the 8.4 targets
  row(`Glory Bites inside the dash that staggered the hunter (rule 2.3; ref ${long} s + asap ${short} s)`, "0", cases.map((c) => {
    const rs = [refLong(c), pick("asap", c.seed, c.orient).final], n = rs.reduce((a, r) => a + r.sameDashGlory.n, 0), of = rs.reduce((a, r) => a + r.sameDashGlory.of, 0);
    const fin = rs.reduce((a, r) => a + (r.sameDashGlory.finalFrame || 0), 0);
    return { tag: c.tag, ok: n === 0, v: `${n} of ${of}${n ? ` (${fin} in the dash's final frame)` : ""}` };
  }));
  row("Leviathan dies only to a Glory Bite in its collapse, never in the collapsing dash (rule 3.5; ref + asap)", "every kill", cases.map((c) => {
    const rs = [refLong(c), pick("asap", c.seed, c.orient).final];
    const kills = rs.flatMap((r) => r.leviathan.kills), same = rs.reduce((a, r) => a + (r.sameDashGlory.boss || 0), 0);
    const bad = kills.filter((k) => k.how !== "glory").length + same;
    return { tag: c.tag, ok: bad === 0, v: kills.length ? `${kills.map((k) => `${k.how}@ph${k.phase}`).join(" ")}${same ? ` (${same} bitten in the collapsing dash)` : ""}` : "no kill" };
  }));
  row(`Locked lanes that hold the player at lock (ref, ${long} s; diagnostic)`, "info", cases.map((c) => { const r = refLong(c).lungeReach; return { tag: c.tag, ok: true, v: `${pct(r.playerInLaneAtLock)} of ${r.locks} locks, nd at lock med ${r.ndAtLock.med}; ${r.cancels} cancels of ${r.windups} windups; ${r.hits} hits, ${r.grazes} grazes` }; }));
  return rows;
}

export function tableMarkdown(rows) {
  const out = ["| Metric | Target | Result | Values |", "|---|---|---|---|"];
  for (const r of rows) out.push(`| ${r.metric} | ${r.target} | ${r.verdict} | ${r.values} |`);
  return out.join("\n");
}

// ---------------------------------------------------------------- CLI
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const args = process.argv.slice(2);
  const flags = new Set(args.filter((a) => a.startsWith("--")));
  const val = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
  const valued = new Set(["--snap", "--seeds", "--short", "--long", "--jobs", "--orients", "--out", "--react"]);
  if (flags.has("--accept")) {
    const res = await acceptance({
      seeds: (val("--seeds") || "7,11,23").split(",").map(Number),
      orients: (val("--orients") || "landscape,portrait").split(","),
      short: +(val("--short") || 160), long: +(val("--long") || 320), jobs: +(val("--jobs") || 4),
      extra: [...(val("--react") !== undefined ? ["--react", val("--react")] : []), ...(flags.has("--no-assist") ? ["--no-assist"] : [])],
      perf: !flags.has("--no-perf"),
    });
    if (val("--out")) writeFileSync(val("--out"), JSON.stringify(res, null, 1));
    if (flags.has("--json")) console.log(JSON.stringify(res));
    else console.log(`${tableMarkdown(res.table)}\n\n${res.runs.length} runs, ${res.jobs} jobs, ${res.wallSec} s wall`);
  } else {
    const pos = args.filter((a, i) => !a.startsWith("--") && !valued.has(args[i - 1]));
    await loadBot();
    const portrait = flags.has("--portrait");
    const res = runBot({
      seconds: +(pos[0] || 160), seed: +(pos[1] || 7), policy: pos[2] || "ref", portrait, assist: portrait && !flags.has("--no-assist"),
      react: val("--react") !== undefined ? +val("--react") : 0.15,
      snaps: (val("--snap") || "").split(",").filter(Boolean).map(Number),
    });
    console.log(JSON.stringify(res, null, 1));
  }
}
