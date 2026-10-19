// First Breath: the run sequencer (design.md 3.2, 5.1, 7, 16.8). It owns the screens (title, the stages, the
// stage-end overlay, the Almost card, the stage cards, the ending and the result), the time base between core and
// stage seconds, her one continuous beat clock, one-button mode (16.4), seeds, Try again and Go on, practice, the
// run time and the run summary. main.js drives it one fixed step at a time and drains run.events. Pure.
//
// Contract choices (16.8 gives the shape; these fill the gaps):
// - createRun({ seed, settings, save, start, stageOpts }). seed is the run seed (stage seed = fnv1a(seed + ":" + id)
//   >>> 0). settings is read live (assist when a stage starts, oneButton every step), so the host may change it or
//   replace run.settings. save is the parsed save; practice reads its carryIn. start is "new" (the title) or
//   { practice: id, carry? }: id is a stage id, a stage number 1..8 or "ending"; it starts at once with no card, from
//   start.carry, else save.carryIn[id], else DEFAULT_CARRY; after its overlay (none after birth and the ending) the
//   run shows the result, and its scores go only to that stage's best (stageEnd events; no runEnd). stageOpts is
//   merged into every stage's create opts (a test hook: the wave-0 stubs read stubS, their length in seconds).
// - Time. run.t is core seconds since createRun, advanced DT by each unpaused step (the title included), so it stays
//   in step with main.js's core clock. A step covers [run.t, run.t + DT). Inside a stage, state.t = run.t −
//   run.stageStart. After the Almost card, Go on resumes the stage with run.stageStart moved on by the card's time,
//   so that rule still holds. run.ms (milliseconds) counts the stage, overlay, Almost card and card steps from Play
//   to the end of stage 8, never pause, the title, the ending or the result.
// - Her beat clock. Inside a stage (and the ending), her beats are state.beats.mother + run.stageStart. Everywhere
//   else the run lays its own beats with ±3% jitter (stream(seed, "her")): from the stage's next beat at the stage's
//   last rate, gliding linearly to the next stage's meta.motherBpm over the first 1.0 s of the card (the shortest a
//   card lasts), so a skipped card never jumps. On the title it runs at 72 bpm from t = 0. The next stage gets
//   motherPhase = (the run's next beat at or after its start) − its start. The run lays its own beats only in step()
//   and only 0.5 s ahead (under one period at 92 bpm, so at most one laid beat is ever handed over); beats() past
//   that projects without jitter and stores nothing. Go on's carry keeps the run's clock (the stage's own beats
//   stopped at the cap). Her silence in the ending's first 1.5 s comes from the ending's own beats.
// - A finished stage is frozen (no more steps); the overlay and the Almost card show its last frame, the card shows
//   the next stage's first frame (a preview state, made again with the real motherPhase when the card goes). Off the
//   stage, view() swaps the rings for one ring on her run-clock beat.
// - Attempts. An attempt closes when it reaches its overlay (or the ending), or at the Almost card on Try again; a
//   Try again from pause (or mid-stage) recreates the stage at once and does not count the unfinished attempt. Try
//   again from pause on the stage-end overlay or the card plays the stage that just ended again (its attempt is
//   already closed), and in the ending plays the ending again. A closed attempt's score is kept when it beats the
//   kept one (a tie keeps the earlier); the carry is always the latest closed attempt's. sparks = the number of kept
//   Glowing grades, written into the carry. Marks
//   ({ assist, oneButton }) are the kept attempt's: assist as the stage started, oneButton if it was on in any step.
// - The Almost card's data takes the stage's metrics.almost (a string id) as `line`: an action stage's knock-out
//   says why there ("You need a rest. Try again, or go on."); a race says its place instead.
// - finish() ends the current stage with its result so far (goalMet stays the stage's own for a stage that can fail,
//   else true with the full Goal), for the test hook; jump(moment) calls the stage's jump. Both are extras.
// - Events (run.events, drained by the host): every stage event, with t in core seconds and `stage` (its id) added;
//   and the run's own (RUN_EVENTS): screen { screen, data }, stageStart { id, index, attempt, seed, motherPhase,
//   carry, practice }, carryIn { id, carry } (at Play for swim and at each card, never in practice), crossfade
//   { seconds } (at each card), stageEnd { id, index, attempt, result, kept, marks, practice } and runEnd { summary }.
//   The run also emits fact { id, where } for the card and overlay facts it shows. A stage event's `at` (a sound's
//   time) goes on in core seconds too. A fact event whose fact is unknown or not shown (checked: false, or access
//   not R or A, 15.1) is dropped, and card and overlay facts are picked only from the shown ones.
// - The ending gets opts.runMs: the run time so far (run.ms, which stops when the ending starts), or 0 in practice,
//   where the ending then leaves out its run time line.
// - summary() → { total, ms, stages: [{ id, score: { goal, skill, flourish, total }, grade, parts, goalMet,
//   attempts, marks }], marks, sparks, facts, done, practice }; done is true once a full run reaches its result. In
//   practice, total is the stage's own total, with no Glowing bonus.
// - One-button mode in an action stage (meta.action): the button's presses are dropped and botSteer's dash, while the
//   button is held, is the press (contract.md).
// - Timing offset and Resume (5.2): every stage gets opts.lag = max(0, settings.offsetMs) / 1000 (at most 0.15 s)
//   when it starts (a press made on time reaches the page that late, so its misses wait that long). act("resume")
//   sets the lag again from the settings (track.js relag), then calls the stage's resume(state), when it has one,
//   which makes its targets of the next 1.2 s free.
import { DT, label } from "./clock.js";
import { stream } from "./rng.js";
import { fnv1a } from "../../lab/kit/rng.js";
import { DEFAULT_CARRY, mergeCarry } from "./carry.js";
import { clampScore, grade as gradeOf, runTotal, PARTS } from "./score.js";
import { makeIntents, shiftIntents } from "./intent.js";
import { emptyDraw } from "./draw.js";
import { FACTS, byId, isShown as showable } from "./facts.js";
import { STAGES, ENDING } from "./stages/index.js";
import { lagOf, relag } from "./lib/track.js";

export const TIMERS = Object.freeze({ overlayS: 2.5, cardSkipS: 1.0, cardS: 3.5, crossfadeS: 0.8, glideS: 1.0, endingSkipS: 29 });
export const RUN_EVENTS = Object.freeze(["screen", "stageStart", "carryIn", "crossfade", "stageEnd", "runEnd"]);

const HER_JITTER = 0.03;
const LAY_AHEAD_S = 0.5;
const KEEP_S = 4;
const ENDING_INDEX = STAGES.length;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const goodBpm = (b) => Number.isFinite(b) && b >= 30 && b <= 240;

export function stageSeed(runSeed, id) {
  return fnv1a(String(runSeed) + ":" + id) >>> 0;
}

// Her beats between stages: laid ahead in step() only, with seeded jitter; a glide over the card.
function herClock(seed) {
  const r = stream(seed, "her");
  let laid = [0], rate = 72, glide = null;
  const rateAt = (b) => (glide ? glide.from + (glide.to - glide.from) * clamp01((b - glide.t0) / glide.len) : rate);
  const lastOf = () => laid[laid.length - 1];
  return {
    reset(first, bpm) { laid = [first]; rate = goodBpm(bpm) ? bpm : rate; glide = null; },
    glideTo(bpm, t0, len) { if (goodBpm(bpm)) glide = { from: rate, to: bpm, t0, len }; },
    lay(until) {
      while (lastOf() < until) {
        const b = lastOf();
        laid.push(b + (60 / rateAt(b)) * (1 + HER_JITTER * (2 * r() - 1)));
      }
    },
    trim(before) { while (laid.length > 2 && laid[1] < before) laid.shift(); },
    // the first beat at or after t (lays as far as it needs: call it only from step() or act())
    next(t) {
      this.lay(t);
      for (const b of laid) if (b >= t) return b;
      return lastOf();
    },
    // laid beats in [t0, t1), then a plain projection past the last laid one
    between(t0, t1) {
      const out = [];
      for (const b of laid) if (b >= t0 && b < t1) out.push(b);
      let b = lastOf();
      for (let k = 0; k < 64; k++) {
        b += 60 / rateAt(b);
        if (b >= t1) break;
        if (b >= t0) out.push(b);
      }
      return out;
    },
    phase(t) {
      let prev = null, next = null;
      for (const b of laid) { if (b <= t) prev = b; else { next = b; break; } }
      if (prev === null) return 0;
      if (next === null) next = prev + 60 / rateAt(prev);
      while (next <= t) { prev = next; next += 60 / rateAt(next); }
      return clamp01((t - prev) / (next - prev));
    },
  };
}

// A stage id, a stage number 1..8 or "ending" → an index into STAGES (ENDING_INDEX for the ending), else −1.
function indexOf(id) {
  if (id === ENDING.meta.id) return ENDING_INDEX;
  if (Number.isInteger(id) && id >= 1 && id <= STAGES.length) return id - 1;
  return STAGES.findIndex((m) => m.meta.id === id);
}
const modAt = (i) => (i === ENDING_INDEX ? ENDING : STAGES[i]);

export function createRun({ seed = 1, settings = {}, save = null, start = "new", stageOpts = null } = {}) {
  const runSeed = Number.isFinite(Number(seed)) ? Number(seed) >>> 0 : 1;
  const practiceIndex = start && typeof start === "object" ? indexOf(start.practice) : -1;
  const practice = practiceIndex >= 0 ? modAt(practiceIndex).meta.id : null;

  const events = [];
  const her = herClock(runSeed);
  her.reset(0, STAGES[0].meta.motherBpm);

  let screen = "title", paused = false, t = 0, msS = 0, done = false;
  let mod = null, st = null, idx = -1, ss = 0;
  let clock = "run";                       // whose beats are hers now: "stage" or "run"
  let rOne = null, lastIntents = null, lastOne = null;
  let attempt = null;                      // { id, n, marks, wentOn }
  let overlay = null, card = null, almost = null;
  let gaDay = STAGES[0].meta.ga.start;
  let carry = mergeCarry(DEFAULT_CARRY, null);
  const carryIns = {}, kept = {}, tries = {};
  const facts = [], factSeen = new Set();

  const push = (name, data) => { events.push({ ...data, name, t }); };
  const show = (name, data = null) => { screen = name; push("screen", { screen: name, data }); };
  const noteFact = (id) => { if (id && !factSeen.has(id)) { factSeen.add(id); facts.push(id); } };
  // Only checked facts with access R or A are ever shown (15.1): a `checked: false` fact never reaches a screen.
  const factsFor = (id, where) => FACTS.filter((f) => f.stage === id && f.where === where && showable(f)).map((f) => f.id);
  const glowing = () => Object.values(kept).filter((e) => e.grade === "Glowing").length;
  // the input's lag from the timing offset, read when a stage starts (as Assist is): its misses wait that long
  const lagNow = () => lagOf(run.settings ? Number(run.settings.offsetMs) : 0);

  // Stage events go on to the host in core seconds.
  function drain() {
    if (!st || !Array.isArray(st.events)) return;
    for (const ev of st.events) {
      const out = { ...ev, t: (Number.isFinite(ev.t) ? ev.t : st.t) + ss, stage: mod.meta.id };
      if (Number.isFinite(ev.at)) out.at = ev.at + ss;                   // a sound's time, also in core seconds
      if (ev.name === "fact") {
        const f = byId(ev.id);
        if (!showable(f)) continue;                                       // an unknown or unchecked fact is dropped
        noteFact(ev.id);
      }
      events.push(out);
    }
    st.events.length = 0;
  }

  // The run's clock takes over from the stage's at its next beat, at its last rate.
  function toRunClock() {
    if (clock === "stage" && st && st.beats) {
      const tr = t - ss;
      const b0 = typeof st.beats.next === "function" ? st.beats.next("mother", tr) : NaN;
      const bpm = typeof st.beats.bpm === "function" ? st.beats.bpm("mother", tr) : NaN;
      her.reset(Number.isFinite(b0) && b0 >= tr ? ss + b0 : her.next(t), bpm);
    }
    clock = "run";
  }

  function begin(i) {
    const m = modAt(i), id = m.meta.id;
    toRunClock();
    const motherPhase = Math.max(0, her.next(t) - t);
    if (!carryIns[id]) carryIns[id] = mergeCarry(carry, { sparks: glowing() });
    tries[id] = (tries[id] || 0) + 1;
    const sd = stageSeed(runSeed, id);
    const assist = !!(run.settings && run.settings.assist), oneButton = !!(run.settings && run.settings.oneButton);
    mod = m; idx = i; ss = t;
    const extra = i === ENDING_INDEX ? { runMs: practice ? 0 : Math.round(msS * 1000) } : {};
    st = m.create(sd, mergeCarry(carryIns[id], null), { ...(stageOpts || {}), ...extra, assist, oneButton, lag: lagNow(), motherPhase });
    clock = "stage";
    rOne = stream(sd, "oneButton");
    rOne.mem = {};
    attempt = { id, n: tries[id], marks: { assist, oneButton }, wentOn: false };
    overlay = card = almost = null;
    gaDay = st.gaDay;
    push("stageStart", { id, index: i, attempt: tries[id], seed: sd, motherPhase, carry: mergeCarry(carryIns[id], null), practice });
    show(i === ENDING_INDEX ? "ending" : "stage", { id, index: i });
    drain();
  }

  // Keep the attempt's score if it is better, and its carry in any case.
  function close(res) {
    if (!mod.meta.scored) return;
    const id = mod.meta.id;
    const score = clampScore(res && res.score ? res.score : {});
    const entry = {
      id, index: idx, score, grade: gradeOf(score.total, !!(res && res.goalMet)), parts: (res && res.parts) || [],
      goalMet: !!(res && res.goalMet), metrics: (res && res.metrics) || {}, marks: { ...attempt.marks }, attempt: attempt.n,
    };
    const old = kept[id];
    if (!old || score.total > old.score.total) kept[id] = entry;
    carry = mergeCarry(carryIns[id], res && res.carryOut);
    carry.sparks = glowing();
    push("stageEnd", { id, index: idx, attempt: attempt.n, result: res, kept: { score: { ...kept[id].score }, grade: kept[id].grade },
      marks: { ...attempt.marks }, practice });
  }

  function toResult() {
    toRunClock();
    overlay = card = almost = null;
    if (!practice) done = true;
    const sum = run.summary();
    if (!practice) push("runEnd", { summary: sum });
    show("result", sum);
  }

  function startOverlay(res) {
    const id = mod.meta.id;
    const total = res && res.score ? clampScore(res.score).total : 0;
    const fact = factsFor(id, "overlay")[0] || null;
    if (fact) { noteFact(fact); push("fact", { id: fact, where: "overlay", stage: id }); }
    overlay = { t0: t, linger: false };
    show("overlay", { id, index: idx, grade: gradeOf(total, !!(res && res.goalMet)), total, goalMet: !!(res && res.goalMet), fact });
  }

  function startCard(j) {
    const m = modAt(j), id = m.meta.id;
    carryIns[id] = mergeCarry(carry, { sparks: glowing() });
    push("carryIn", { id, carry: mergeCarry(carryIns[id], null) });
    const preview = m.create(stageSeed(runSeed, id), mergeCarry(carryIns[id], null), { ...(stageOpts || {}),
      assist: !!(run.settings && run.settings.assist), oneButton: !!(run.settings && run.settings.oneButton), lag: lagNow(),
      motherPhase: 0 });
    her.glideTo(m.meta.motherBpm, t, TIMERS.glideS);
    const cardFacts = factsFor(id, "card");
    for (const f of cardFacts) { noteFact(f); push("fact", { id: f, where: "card", stage: id }); }
    card = { t0: t, j, preview: { mod: m, st: preview } };
    overlay = null;
    push("crossfade", { seconds: TIMERS.crossfadeS });
    show("card", { id, index: j, n: j + 1, name: m.meta.name, verb: m.meta.verb,
      label: label(m.meta.ga.start, { fertilized: m.meta.fertilized }), facts: cardFacts });
  }

  function endOverlay() {
    if (practice || idx + 1 >= STAGES.length) toResult();
    else startCard(idx + 1);
  }

  function endCard() {
    const j = card.j;
    card = null;
    begin(j);
  }

  // The stage reports done (or was finished): the Almost card, the overlay, the ending or the result.
  function stageDone(res) {
    toRunClock();
    gaDay = st.gaDay;
    if (mod === ENDING) { toResult(); return; }
    if (mod.meta.canFail && !res.goalMet && !attempt.wentOn) {
      almost = { res };
      const mt = res.metrics || {};
      show("almost", { id: mod.meta.id, place: mt.place ?? null, of: mt.of ?? null, capped: !!mt.capped, line: mt.almost || null });
      return;
    }
    close(res);
    if (idx === STAGES.length - 1) { if (practice) toResult(); else begin(ENDING_INDEX); return; }
    startOverlay(res);
  }

  function forced() {
    const res = mod.result(st) || {};
    if (!mod.meta.scored) return { ...res, done: true, goalMet: true };
    const goalMet = mod.meta.canFail ? !!res.goalMet : true;
    const base = res.score || {};
    const score = clampScore({ ...base, goal: goalMet ? PARTS.goal : base.goal || 0 });
    return { ...res, done: true, goalMet, score };
  }

  function timers() {
    if (screen === "overlay" && overlay && !overlay.linger && t - overlay.t0 >= TIMERS.overlayS - 1e-9) endOverlay();
    else if (screen === "card" && card && t - card.t0 >= TIMERS.cardS - 1e-9) endCard();
  }

  // One ring on her run-clock beat, for the screens between stages.
  function herRing(d) {
    const span = d.camera && d.camera.span > 0 ? d.camera.span : 100;
    const a = d.anchor || { x: 0, y: 0 };
    return { ...d, rings: [{ id: "mother", kind: "mother", x: a.x, y: a.y, r: span * 0.12, progress: her.phase(t) }] };
  }

  const run = {
    settings: settings || {},

    get screen() { return screen; },
    get paused() { return paused; },
    get t() { return t; },
    get ms() { return Math.round(msS * 1000); },
    get seed() { return runSeed; },
    get practice() { return practice; },
    get stageStart() { return ss; },
    get stageId() { return mod ? mod.meta.id : null; },
    get stageIndex() { return idx; },
    get mod() { return mod; },
    get state() { return st; },
    get events() { return events; },
    get gaDay() { return screen === "stage" || screen === "ending" ? st.gaDay : gaDay; },
    get carry() { return mergeCarry(carry, null); },
    get done() { return done; },
    get lastIntents() { return lastIntents; },
    get lastOneButton() { return lastOne; },

    step(intents) {
      if (paused) return;
      const live = (screen === "stage" || screen === "ending") && st;
      const counting = screen === "stage" || screen === "overlay" || screen === "almost" || screen === "card";
      if (live) {
        const local = shiftIntents(makeIntents(intents), ss);
        if (run.settings && run.settings.oneButton) {
          const a = mod.botSteer(st, 1, rOne) || {};
          const s = a.steer && Number.isFinite(a.steer.x) && Number.isFinite(a.steer.y) ? a.steer : { x: 0, y: 0 };
          const m = Math.hypot(s.x, s.y), k = m > 1 ? 1 / m : 1;
          local.steer = local.touching ? { x: s.x * k, y: s.y * k } : { x: 0, y: 0 };
          local.dir = makeIntents({ dir: a.dir }).dir;
          local.turn = 0;
          local.aim = null;
          // an action stage (meta.action): the button's own presses are no dash; while it is held the bot dashes
          if (mod.meta.action) local.presses = a.dash && local.touching ? [{ t: st.t, raw: st.t }] : [];
          lastOne = a;
          attempt.marks.oneButton = true;
        } else lastOne = null;
        lastIntents = local;
        mod.step(st, local);
        drain();
      }
      t += DT;
      if (counting && mod !== ENDING) msS += DT;
      if (live && mod.result(st).done) stageDone(mod.result(st));
      timers();
      if (clock === "run") { her.lay(t + LAY_AHEAD_S); her.trim(t - KEEP_S); }
    },

    act(name) {
      switch (name) {
        case "play":
          if (screen !== "title") return false;
          push("carryIn", { id: STAGES[0].meta.id, carry: mergeCarry(carry, null) });
          begin(0);
          return true;
        case "retry":
          if (screen === "almost") { close(almost.res); begin(idx); paused = false; return true; }
          if (screen === "stage") { begin(idx); paused = false; return true; }
          // the stage-end overlay and the next stage's card: the stage that just ended (the HUD's stage), whose
          // attempt is already closed; the ending: the ending again
          if (screen === "overlay" || screen === "card" || screen === "ending") { begin(idx); paused = false; return true; }
          return false;
        case "goOn": {
          if (screen !== "almost") return false;
          const res = almost.res;
          almost = null;
          attempt.wentOn = true;
          // the stage plays on: stage 1's carried finish, or an action stage's meta.goOn moment after a knock-out
          // (design.md 4.4: it plays out by itself and ends with its goal unmet; wentOn closes it with no grade word)
          const mt = res.metrics || {};
          const goOnId = mt.capped ? "carried" : mt.ko && typeof mod.meta.goOn === "string" ? mod.meta.goOn : null;
          if (goOnId && typeof mod.jump === "function" && mod.jump(st, goOnId) !== false) {
            ss = t - st.t;                 // the stage resumes: its time base moves on by the card's time
            screen = "stage";
            push("screen", { screen, data: { id: mod.meta.id, index: idx, carried: true } });
            drain();
            if (mod.result(st).done) stageDone(mod.result(st));
          } else {
            close(res);
            startOverlay(res);
          }
          return true;
        }
        case "linger":
          if (screen !== "overlay") return false;
          overlay.linger = true;
          return true;
        case "next":
        case "skip":
          if (screen === "overlay") { endOverlay(); return true; }
          if (screen === "card" && t - card.t0 >= TIMERS.cardSkipS - 1e-9) { endCard(); return true; }
          if (name === "skip" && screen === "ending" && st.t >= TIMERS.endingSkipS - 1e-9) { toResult(); return true; }
          return false;
        case "pause":
          if (screen === "title" || screen === "result" || paused) return false;
          paused = true;
          return true;
        case "resume":
          if (!paused) return false;
          paused = false;
          if ((screen === "stage" || screen === "ending") && st) {
            relag(st, lagNow());           // a timing offset changed in Settings while paused takes effect now
            // Fair resume (5.2): the stage's targets of the next 1.2 s are free (its resume(state), when it has one)
            if (typeof mod.resume === "function") { mod.resume(st); drain(); }
          }
          return true;
        default:
          return false;
      }
    },

    // Her beat times (core s) in [t0, t1): the stage's inside a stage, else the run's own. heart "you" gives yours
    // inside a stage (none between stages).
    beats(t0, t1, heart = "mother") {
      if (clock === "stage" && st && st.beats) {
        if (heart === "you" && !st.beats.you) return [];
        return st.beats.between(heart === "you" ? "you" : "mother", t0 - ss, t1 - ss).map((b) => b + ss);
      }
      return heart === "you" ? [] : her.between(t0, t1);
    },

    view() {
      if ((screen === "stage" || screen === "ending") && st) return mod.view(st);
      if ((screen === "overlay" || screen === "almost") && st) return herRing(mod.view(st));
      if (screen === "card" && card) return herRing(card.preview.mod.view(card.preview.st));
      if (screen === "result" && st) return herRing(mod.view(st));
      return herRing(emptyDraw(STAGES[0].meta.id));
    },

    // The current stage's result (null on the title).
    result() {
      return st ? mod.result(st) : null;
    },

    jump(moment) {
      if (!st || !(screen === "stage" || screen === "ending")) return false;
      const ok = mod.jump(st, moment);
      drain();
      if (mod.result(st).done) stageDone(mod.result(st));
      return ok !== false;
    },

    finish() {
      if (!st || !(screen === "stage" || screen === "ending")) return false;
      stageDone(forced());
      return true;
    },

    summary() {
      const stages = STAGES.map((m) => kept[m.meta.id]).filter(Boolean).map((e) => ({
        id: e.id, score: { ...e.score }, grade: e.grade, parts: e.parts, goalMet: e.goalMet, attempts: tries[e.id] || 0,
        marks: { ...e.marks },
      }));
      const marks = { assist: stages.some((s) => s.marks.assist), oneButton: stages.some((s) => s.marks.oneButton) };
      // practice plays one stage: its total is that stage's, with no Glowing bonus (the bonus is the run's, 7)
      const total = practice ? stages.reduce((a, s) => a + s.score.total, 0) : runTotal(stages);
      return { total, ms: run.ms, stages, marks, sparks: glowing(), facts: facts.slice(), done, practice };
    },
  };

  if (practice) {
    carryIns[practice] = mergeCarry(DEFAULT_CARRY, start.carry || (save && save.carryIn && save.carryIn[practice]) || null);
    begin(practiceIndex);
  } else {
    push("screen", { screen: "title", data: null });
  }
  return run;
}
