// Scripted anglers and one-cast runner for the fight tests: fight.sim.mjs (Loon Lake) and places.sim.mjs (all four places).
// A player sees the game with a short delay, moves the rod at a human speed, and follows one policy:
//   skilled (also "good"): reads every tell. Rod low for jumps and tail walks, rod up for head shakes, reels fast when a fish
//     charges, pumps a fish off the bottom, steers a cover run away from its cover, steers off a rub (rubSide) with the rod up,
//     lets a last run go, rests the arm at 60° while a legend rests, tightens the drag when the spool empties
//   casual: a slower human (reacts in 0.45-0.6 s) who ignores one warning in four
//   flaws: skilled, but with one mistake. nosteer: never steers, and ignores the rub and cover warnings. rodlow: rod low for head shakes. rodhigh: rod up for jumps.
//     slowcrank: reels slowly when a fish charges. nopump: does not pump. lightdrag: never tightens the drag.
//     grinder: keeps cranking while the drag slips. late: hook set 1.5 s late. early: yanks at the first nibble.
//   brute force: greedy (flat out from the first turn), horse (a good retrieve, then flat out), idle (does nothing)
import { LakeSim, rodTip } from "../../public/fish/js/fish.js";
import { rng } from "../../public/fish/js/lake.js";

export const DT = 1 / 60;
export const LIMIT = 400; // s: a cast that has not ended by then counts as a timeout
export const D2R = Math.PI / 180;
export const headingDeg = (x, z) => Math.atan2(x, -z) / D2R;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const FLAWS = new Set(["nosteer", "rodlow", "rodhigh", "slowcrank", "nopump", "lightdrag", "grinder"]);
// the warnings a casual player can miss
const TELLS = ["charge", "sulk", "thrash", "cover", "walk", "turn", "rub", "spool", "lastrun"];

export class Player {
  constructor(policy, r) {
    this.pol = policy; this.r = r;
    this.flaw = FLAWS.has(policy) ? policy : "";
    this.casual = policy === "casual";
    // reads the tells (everyone except the brute force players)
    this.tech = this.casual || this.flaw !== "" || ["good", "skilled", "late", "early"].includes(policy);
    this.t = 0; this.theta = 40; this.target = 40; this.rate = 150; this.steer = 0; this.drag = policy === "lightdrag" ? 0 : 1; // the light setting, and never tightens it
    this.seen = []; this.hist = [];
    this.react = this.casual ? 0.45 + r() * 0.15 : 0.22 + r() * 0.08;
    this.strikeAt = null; this.nibbleAt = null; this.yanked = false; this.didSet = false;
    this.jumpUntil = -1; this.pump = "up"; this.hooked = false;
    this.walking = false; this.charge = false; this.calmUntil = -1; this.lastUntil = -1; this.sulk = false; this.spump = "up";
    this.letGo = false; this.thrash = false; this.coverSteer = 0; this.coverUntil = -1; this.rest = false; this.rubAware = false; this.spoolAware = false;
  }
  // what the player saw about `react` seconds ago
  view() {
    for (let i = this.hist.length - 1; i >= 0; i--) if (this.hist[i].t <= this.t - this.react) return this.hist[i];
    return this.hist[0];
  }
  act(sim, events) {
    const S = sim.state, P = this.pol, flaw = this.flaw, sk = this.tech;
    this.t += DT;
    const f = S.fish;
    this.hist.push({ t: this.t, phase: S.phase, slip: S.slip, slack: S.slack, tfrac: S.tfrac, move: f ? f.move : "", x: f ? f.x : S.lure.x, z: f ? f.z : S.lure.z, rub: S.rub, rubSide: S.rubSide, rubKind: S.rubKind, spoolFrac: S.spoolFrac, beaten: S.beaten });
    if (this.hist.length > 90) this.hist.shift();
    for (const e of events) this.seen.push({ t: this.t, e });
    let crank = 0, hookset = false, lift = false;
    const v = this.view(), vt = this.t - this.react;
    // events the player has noticed by now
    while (this.seen.length && this.seen[0].t <= vt) {
      const { e } = this.seen.shift();
      if (e.type === "strike" && this.strikeAt === null) this.strikeAt = this.t;
      if (e.type === "nibble" && this.nibbleAt === null) this.nibbleAt = this.t;
      if (e.type === "hooked") this.hooked = true;
      if (e.type === "jump") this.jumpUntil = Infinity;
      if (e.type === "walkEnd") { this.walking = false; this.jumpUntil = this.t + 0.3; }
      if (e.type === "splash" && !(sk && this.walking)) this.jumpUntil = this.t + 0.3;
      // a casual player misses one warning in four
      const miss = this.casual && TELLS.includes(e.type) && this.r() < 0.25;
      if (sk && !miss) {
        if (e.type === "walk") this.walking = true;
        if (e.type === "charge") this.charge = true;
        if (e.type === "turn" || e.type === "run" || e.type === "surge") { this.charge = false; this.calmUntil = this.t + 0.6; }
        if (e.type === "lastrun") this.lastUntil = this.t + 2;
        if (e.type === "sulk") { this.sulk = true; this.spump = "up"; }
        if (e.type === "unstuck") this.sulk = false;
        if (e.type === "thrash") this.thrash = true;
        if (e.type === "cover") { this.coverSteer = e.steer; this.coverUntil = this.t + 4; }
        if (e.type === "turned") this.coverUntil = -1;
        if (e.type === "rest") { this.rest = true; this.letGo = false; }
        // a legend's banner can tell you what to do: "Let it go" means stop reeling, rod up, and do not fight it
        if (e.type === "phase") { this.rest = false; this.letGo = /let it go/i.test(e.name || ""); }
        if (e.type === "rub") this.rubAware = true;
        if (e.type === "spool") this.spoolAware = true;
      }
    }
    // a tell is over when the fish (as seen) is doing something else
    if (this.charge && v.move !== "charge" && v.move !== "") this.charge = false;
    if (this.sulk && v.move !== "sulk") this.sulk = false;
    if (this.thrash && v.move !== "thrash") this.thrash = false;
    if (this.rest && v.move !== "hold") this.rest = false;
    if (this.coverUntil > this.t && v.move !== "run" && v.move !== "surge") this.coverUntil = -1;
    if (v.rub < 0.03) this.rubAware = false;
    const fighting = S.phase === "fight" || S.phase === "land";
    const setDelay = P === "late" ? 1.5 : 0.25;
    if (!fighting) {
      // the retrieve: a steady crank with the rod at 40° (slow when a fish follows but the lure is too fast), then the hook set
      this.target = P === "greedy" ? 15 : 40; this.rate = 150;
      crank = S.t < 0.6 ? 0 : P === "greedy" ? 3 : S.tooFast ? 0.4 : 1.1;
      if (P === "early" && this.nibbleAt !== null && !this.yanked && this.t >= this.nibbleAt + 0.15 - this.react) { this.yanked = true; hookset = true; }
      // the strike was noticed `react` s after it came; the hook set lands `setDelay` s after the strike
      if (this.strikeAt !== null && !this.didSet && this.t >= this.strikeAt - this.react + setDelay) {
        this.didSet = true; hookset = true;
        if (P !== "greedy") { this.target = 85; this.rate = 500; }
      }
    } else if (P === "greedy" || P === "horse") {
      // flat out with the rod low; even this player stops cranking to lift a fish at the dock
      crank = 3; this.target = 15; this.rate = 200;
      if (v.phase === "land") { this.target = 82; this.rate = 150; lift = true; crank = 0; }
    } else if (P === "idle") {
      crank = 0; this.target = 60; this.rate = 150;
    } else {
      // good technique: pump and reel, stop cranking while the drag slips, rod low for jumps, steer against runs, lift to land
      const jumping = this.t < this.jumpUntil && flaw !== "rodhigh";
      if (v.phase === "land") {
        this.target = 82; this.rate = 150; lift = true; crank = v.slack ? 0.8 : 0;
      } else if (jumping) {
        this.target = 18; this.rate = 300; crank = v.slack ? 2.4 : 0.8;
      } else if (this.letGo) {
        // "It runs! Let it go. Hold the rod up.": the drag takes the run
        this.target = 75; this.rate = 200; crank = v.slack ? 2.5 : 0;
      } else if (this.lastUntil > this.t) {
        // it sees you and runs: stop reeling, rod up, let the drag take it
        this.target = 72; this.rate = 200; crank = v.slack ? 2.5 : 0;
      } else if (this.calmUntil > this.t) {
        // it turned: stop reeling, rod up, let the drag take the run
        this.target = 70; this.rate = 200; crank = v.slack ? 2.5 : 0;
      } else if (this.thrash) {
        // head shakes: rod up, stop reeling
        if (flaw === "rodlow") { this.target = 22; this.rate = 200; crank = v.slack ? 2 : 1; }
        else { this.target = 75; this.rate = 250; crank = v.slack ? 2.5 : v.tfrac < 0.12 ? 1.2 : 0; }
      } else if (this.charge) {
        // it swims at you: reel fast, rod up
        if (flaw === "slowcrank") { crank = 1; this.target = 50; this.rate = 90; }
        else { crank = v.slack || v.tfrac < 0.12 ? 4 : 1; this.target = 75; this.rate = 200; }
      } else if (this.rest) {
        // a legend rests: rod at a comfortable 60°, just keep the line tight
        this.target = 60; this.rate = 90; crank = v.slack ? 1 : 0.15;
      } else if (this.sulk && flaw !== "nopump") {
        // pump it off the bottom: lift slowly with the line tight, then drop and reel
        if (this.spump === "up") { this.target = 80; this.rate = 60; crank = 0; if (this.theta >= 78) this.spump = "down"; }
        else { this.target = 30; this.rate = 150; crank = 3; if (this.theta <= 32) this.spump = "up"; }
      } else if (this.sulk) {
        this.target = 40; this.rate = 90; crank = 2;
      } else if (v.beaten && v.move !== "surge" && v.tfrac < S.dragFrac * 0.8 && v.slip < 0.15) {
        // the gauge says TIRED and the prompt says "It is tired. Reel steadily.": a steady crank, rod at 60
        this.target = 60; this.rate = 90; crank = 3;
      } else if (v.slip > 0.15 && flaw === "grinder") {
        crank = 2.4; this.target = 72; this.rate = 150; this.pump = "up";
      } else if (v.slip > 0.15) {
        crank = 0; this.target = 72; this.rate = 150; this.pump = "up";
      } else if (v.tfrac < 0.15 && v.move !== "run" && v.move !== "surge") {
        // a light fish that comes easily: rod up and reel it in fast
        this.target = 60; this.rate = 90; crank = 3; this.pump = "up";
      } else if (this.pump === "up") {
        this.target = 80; this.rate = 70; crank = v.slack ? 2.6 : 0.2;
        if (this.theta >= 78 || v.tfrac > S.dragFrac * 0.9) this.pump = "down";
      } else {
        this.target = 30; this.rate = 90; crank = v.slack ? 3 : 2.4;
        if (this.theta <= 32) this.pump = "up";
      }
      // side pressure: swing the rod against a fish that runs sideways; a cover run is turned the way the prompt says
      let want = 0;
      if (this.coverUntil > this.t) want = this.coverSteer;
      else if (this.letGo) want = 0;
      else if (f && (v.move === "run" || v.move === "surge" || v.move === "dive") && this.hist.length > 20) {
        const a = this.hist[this.hist.length - 1], b = this.hist[this.hist.length - 16];
        const dx = a.x - b.x, dz = a.z - b.z, ln = Math.hypot(a.x, a.z) || 1;
        const lat = (dx * (-a.z / ln) + dz * (a.x / ln)) / (a.t - b.t); // + = the fish moves to the angler's right
        want = Math.abs(lat) > 0.3 ? -Math.sign(lat) : a.x < 0 ? 1 : -1;
      }
      // the line rubs on a snag, on the rocks or in the weeds: do what the prompt says. Steer off a stump, a log or the weeds;
      // hold the rod up on the rocks (a high rod lifts the line off them)
      if (v.rub > 0.1 && v.phase === "fight" && flaw !== "nosteer" && (!this.casual || this.rubAware)) {
        want = v.rubSide || want;
        if (v.rubKind === "rocks") { this.target = Math.max(this.target, 72); crank = Math.min(crank, v.slack ? 2 : 0.6); }
      }
      if (flaw === "nosteer") want = 0;
      this.steer += clamp(want - this.steer, -3 * DT, 3 * DT);
      // the spool is emptying: tighten the drag; loosen it again when the line is back
      if (flaw !== "lightdrag") {
        if (this.casual ? this.spoolAware : v.spoolFrac > 0.6 && v.slip > 0.15) this.drag = 2;
        else if (v.spoolFrac < 0.4) { this.drag = 1; this.spoolAware = false; }
      }
    }
    if (P === "greedy" || P === "horse" || P === "idle") this.steer = 0;
    const prev = this.theta;
    this.theta += clamp(this.target - this.theta, -this.rate * DT, this.rate * DT);
    const omega = (this.theta - prev) / DT;
    const aim = f || S.lure;
    const tip = rodTip(this.theta, headingDeg(aim.x, aim.z), this.steer, sim.rod);
    return { crank, tip, theta: this.theta, omega, steer: this.steer, drag: this.drag, hookset, lift };
  }
}

// SPARK=1 with a trace: one character of tension per frame, a line per second, so you can see the fight
let sparkLine = "", sparkMoves = "";
function spark(S, f, ev, t) {
  if (!f) return;
  const bars = " .:-=+*#%@";
  sparkLine += S.slip > 0.2 ? "~" : bars[Math.min(9, Math.floor(S.tfrac * 10))];
  if (ev) sparkMoves += `${t.toFixed(1)}:${ev} `;
  if (sparkLine.length >= 60) {
    console.log(`${(t - 1).toFixed(0).padStart(4)}s |${sparkLine}| ${f.move.padEnd(6)} stam ${f.stamina.toFixed(2)} d ${Math.hypot(f.x, f.z).toFixed(0).padStart(3)} m rub ${S.rub.toFixed(2)} ${sparkMoves}`);
    sparkLine = ""; sparkMoves = "";
  }
}

// One cast: the lure lands at `spot`, a player fishes it until the fish is landed, lost, or LIMIT s pass.
// place: a place from places.js (Loon Lake if left out). Returns what happened.
export function runCast({ place, policy, seed, spot, species = null, hour = 12, ring = null, bite = undefined, kg, trace = false, easy = true }) {
  const r = rng(seed * 7919 + 13);
  const pl = new Player(policy, rng(seed * 104729 + 7));
  const rod = place ? place.stand.rod : undefined;
  const tip = rodTip(40, headingDeg(spot.x, spot.z), 0, rod);
  const o = { place, lure: spot, tip, lineOut: Math.hypot(spot.x - tip.x, tip.y, spot.z - tip.z) * 1.03 + 0.3, hour, ring, rng: r, easy, species, bite };
  if (kg != null) o.kg = kg;
  const sim = new LakeSim(o);
  const out = {
    chosen: !!sim.plan, id: sim.plan ? sim.plan.id : null, kg: sim.plan ? sim.plan.kg : 0, struck: false, hooked: false, nibbled: false, yankedEarly: false,
    fightT: 0, maxT: 0, minT: Infinity, maxLine: 0, maxRub: 0, outcome: "", moves: {}, events: {}, zeroStamT: 0, phases: [], holdT: [], lightT: 0,
    dryT: 0, sunkT: 0, // s the fish is where it cannot be: over land or behind the angler, and below the bed
    noSideT: 0,        // s the rub prompt is up on a log and says no way to steer
  };
  let events = [], holdStart = null;
  for (let t = 0; t < LIMIT; t += DT) {
    const inp = pl.act(sim, events);
    if (inp.hookset && sim.state.phase !== "strike" && out.nibbled && !out.struck) out.yankedEarly = true;
    sim.step(DT, inp);
    events = sim.events.splice(0);
    const S = sim.state, f = S.fish;
    if (trace) {
      const ev = events.map((e) => e.type + (e.name ? "(" + e.name + ")" : "") + (e.kind ? "[" + e.kind + "]" : "")).join(",");
      if (process.env.SPARK) spark(S, f, ev, t);
      else if (ev || Math.abs(t % 0.5) < DT / 2) console.log(`${t.toFixed(2).padStart(7)} ${S.phase.padEnd(8)} θ${inp.theta.toFixed(0).padStart(4)} crank ${inp.crank.toFixed(1)} steer ${inp.steer.toFixed(1).padStart(4)} line ${S.lineOut.toFixed(1).padStart(5)} T ${S.tension.toFixed(1).padStart(5)} slip ${S.slip.toFixed(2)} ${S.slack ? "SLACK" : "     "} rub ${S.rub.toFixed(2)} ` +
        (f ? `fish ${f.move.padEnd(6)} (${f.x.toFixed(1)}, ${f.y.toFixed(1)}, ${f.z.toFixed(1)}) d ${Math.hypot(f.x, f.z).toFixed(1).padStart(5)} v ${f.speed.toFixed(2)} stam ${f.stamina.toFixed(2)} ` : `lure (${S.lure.x.toFixed(1)}, ${S.lure.y.toFixed(1)}, ${S.lure.z.toFixed(1)}) v ${S.lure.speed.toFixed(2)} `) + ev);
    }
    for (const e of events) {
      out.events[e.type] = (out.events[e.type] || 0) + 1;
      if (e.type === "strike") out.struck = true;
      if (e.type === "nibble") out.nibbled = true;
      if (e.type === "hooked") out.hooked = true;
      if (e.type === "phase") out.phases.push(e.n);
      if (["run", "shake", "jump", "dive", "surge", "charge", "sulk", "walk", "thrash", "cover", "lastrun", "rest", "turn"].includes(e.type)) out.moves[e.type] = (out.moves[e.type] || 0) + 1;
    }
    if (S.phase === "fight" || S.phase === "land") {
      out.maxLine = Math.max(out.maxLine, S.lineOut); out.maxRub = Math.max(out.maxRub, S.rub);
      out.maxT = Math.max(out.maxT, S.tension);
      if (S.fightT > 1) out.minT = Math.min(out.minT, S.tension);
      if (f && f.stamina <= 0.01) out.zeroStamT += DT;
      if (S.rub > 0.15 && S.rubKind === "logs" && S.rubSide === 0) out.noSideT += DT;
      if (f && !sim.plan.junk) {
        if (!sim.swim(f.x, f.z)) out.dryT += DT;
        if (-f.y > sim.pl.depth(f.x, f.z) + 0.05) out.sunkT += DT;
      }
      // a legend's rest: how long it lasts, and how long the line is light during it
      if (f && f.move === "hold") {
        if (holdStart === null) holdStart = t;
        if (S.tension < 0.3 * S.dragN) out.lightT += DT;
      } else if (holdStart !== null) { out.holdT.push(t - holdStart); holdStart = null; }
    }
    const ph = S.phase;
    if (ph === "caught" || ph === "lost" || ph === "home") {
      out.outcome = ph === "lost" ? S.reason : ph;
      out.fightT = S.fightT;
      if (holdStart !== null) out.holdT.push(t - holdStart);
      return out;
    }
  }
  out.outcome = "timeout";
  out.fightT = sim.state.fightT;
  return out;
}

// Where to cast for a fish of a place: 12..45 m out within ±70°, in water it likes (eco: its row from fishing.js ecology()).
// A legend (eco null) is cast into its gold ring: at the ring distance, in its zone.
export function spotsFor(place, eco, n, seed, legend = null) {
  const r = rng(seed), out = [];
  const top = eco ? Math.max(...Object.values(eco.zones), 0) : 1;
  for (let i = 0; out.length < n && i < 200000; i++) {
    const [d0, d1] = legend ? legend.ring : [12, 45];
    const d = d0 + r() * (d1 - d0), a = (r() * 2 - 1) * 70 * D2R;
    const x = Math.sin(a) * d, z = -Math.cos(a) * d;
    const zn = place.zone(x, z);
    if (zn === "land" || place.depth(x, z) < 0.6) continue;
    if (legend) { if (legend.zone && zn !== legend.zone) continue; }
    else if (r() * top > (eco.zones[zn] || 0)) continue;
    out.push({ x, z, zn });
  }
  return out;
}

