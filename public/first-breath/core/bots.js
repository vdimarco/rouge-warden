// First Breath: the shared bot (design.md 16.2, 16.11). One timing model for every stage: it presses at each target's
// time plus Gaussian noise, σ = 15 + 135 × (1 − skill) ms, skips a target with chance 0.4 × (1 − skill), and steers
// with the stage's own botSteer at its skill. Skill 0 is idle: no input at all. It also makes the run-level choices
// (Go on at the Almost card). It plays a stage in node with no DOM (16.11) and a whole run through core/run.js. Pure:
// every draw comes from the bot's seeded streams.
//
// Contract choices (16.2 and 16.11 give the model, not every case):
// - intents(mod, state) returns the stage-time intents for the step [state.t, state.t + DT). Its memory (each
//   target's plan, the hold, the botSteer stream with its r.mem) is kept per stage state, so a retry (a new state)
//   starts fresh and the same seed always plays the same way. Its streams are stream(seed, "bot:" + stage id) for the
//   timing and stream(seed, "botSteer:" + stage id) for botSteer's r.
// - Each target is planned once, when it first shows in targets(state, 3): skip = r() < 0.4 (1 − skill), then the
//   time = target.t + gauss(r) × σ. Tap and press targets get a press at that time (a tap lifts 80 ms later); a
//   release target gets a release at it. A skipped tap or press is never pressed; a skipped release comes 0.45 P +
//   0.1 s late, past Off, so it counts as a miss.
// - A release target needs a hold: the bot presses for it once the target is within 1.0 s and the prompt's gesture is
//   hold or dragHold (or, failing that, once it is within 0.5 s). If it is still holding something else then, it lets
//   go first and presses on the next step, so the press is a fresh one (5.3), as for the stage 2 seal.
// - botSteer's { steer, dir, hold } go straight into the intents; hold: true presses (and holds) while no target hold
//   is under way, and hold: false lets that hold go. touching is true while anything is held or the stick is off
//   centre. An action stage's botSteer may add dash: true (core/lib/actionbot.js): a tap (a press, lifted 80 ms
//   later), which the "move" gesture reads as a dash.
// - choose(screen) → "play" on the title, "goOn" at the Almost card, "skip" on a card (the run takes it from 1.0 s),
//   null elsewhere: the overlay and the ending run their own course.
// - Extra exports: SIGMA_MS(skill), SKIP(skill), and playStep(run, bot), one fixed step of a whole run driven by the
//   bot (its choice, then run.step with its intents converted to core seconds).
import { DT } from "./clock.js";
import { stream, gauss } from "./rng.js";
import { makeIntents, shiftIntents } from "./intent.js";

const clamp01 = (v) => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));
export const SIGMA_MS = (skill) => 15 + 135 * (1 - clamp01(skill));
export const SKIP = (skill) => 0.4 * (1 - clamp01(skill));

const HORIZON_S = 3;      // how far ahead the bot looks at targets
const TAP_LIFT_S = 0.08;  // a tap's release follows its press
const HOLD_LEAD_S = 1.0;  // press for a release target this long before it, once its hold prompt shows
const LATE_LEAD_S = 0.5;  // ... or this long before it, whatever the prompt says

const CHOICES = { title: "play", almost: "goOn", card: "skip" };

export function createBot(skill, seed) {
  const s = clamp01(skill);
  const idle = !(s > 0);
  const sigmaS = SIGMA_MS(s) / 1000;
  const skipP = SKIP(s);
  const mems = new WeakMap();

  // The bot's memory for one stage state.
  function memOf(mod, state) {
    let m = mems.get(state);
    if (!m) {
      const id = mod && mod.meta ? mod.meta.id : "stage";
      const rs = stream(seed, "botSteer:" + id);
      rs.mem = {};
      m = { r: stream(seed, "bot:" + id), rs, plans: new Map(), hold: null, lift: null, repress: false };
      mems.set(state, m);
    }
    return m;
  }

  function intents(mod, state) {
    if (idle || !mod || !state) return makeIntents();
    const m = memOf(mod, state);
    const t0 = state.t, t1 = t0 + DT;
    const presses = [], releases = [];
    const press = (t) => presses.push({ t, raw: t });
    const release = (t) => releases.push({ t, raw: t });

    // a fresh press that had to wait a step for its release
    if (m.repress) { press(t0); m.hold = m.repress; m.repress = false; }
    // a tap lifts 80 ms after it went down
    if (m.lift !== null && m.lift < t1) { release(Math.max(m.lift, t0)); m.lift = null; }

    const gesture = (mod.prompt(state) || {}).gesture;
    const list = (mod.targets(state, HORIZON_S) || []).slice().sort((a, b) => a.t - b.t);
    for (const x of list) {
      let plan = m.plans.get(x.id);
      if (!plan) {
        const skip = m.r() < skipP;
        plan = { skip, at: x.t + gauss(m.r) * sigmaS, done: false };
        if (x.kind === "release" && skip) plan.at = x.t + 0.45 * (Number.isFinite(x.P) ? x.P : 0.5) + 0.1;
        m.plans.set(x.id, plan);
      }
      if (plan.done) continue;
      if (x.kind === "tap" || x.kind === "press") {
        if (plan.skip) { plan.done = true; continue; }
        if (plan.at < t1) {
          const at = Math.max(plan.at, t0);
          press(at);
          if (x.kind === "tap") m.lift = at + TAP_LIFT_S;
          else { m.hold = "target"; m.lift = null; }
          plan.done = true;
        }
      } else if (x.kind === "release") {
        const lead = x.t - t0;
        if (m.hold !== "target") {
          const ready = (lead <= HOLD_LEAD_S && (gesture === "hold" || gesture === "dragHold")) || lead <= LATE_LEAD_S;
          if (ready && !m.repress) {
            if (m.hold) { release(t0); m.hold = null; m.repress = "target"; }   // let go first: the press must be fresh
            else { press(t0); m.hold = "target"; m.lift = null; }
          }
          continue;
        }
        if (plan.at < t1) { release(Math.max(plan.at, t0)); m.hold = null; plan.done = true; }
      }
    }

    // the stage's own steering, and its hold when no target hold is under way
    const a = mod.botSteer(state, s, m.rs) || {};
    const steer = a.steer && Number.isFinite(a.steer.x) && Number.isFinite(a.steer.y) ? a.steer : { x: 0, y: 0 };
    if (m.hold !== "target" && !m.repress) {
      if (a.hold && !m.hold) { press(t0); m.hold = "steer"; }
      else if (!a.hold && m.hold === "steer") { release(t0); m.hold = null; }
    }
    // an action stage's dash (core/lib/actionbot.js): a quick tap, as a second finger or Space gives
    if (a.dash && !m.hold && !m.repress && m.lift === null) { press(t0); m.lift = t0 + TAP_LIFT_S; }
    const touching = !!m.hold || !!m.repress || m.lift !== null || Math.hypot(steer.x, steer.y) > 0.01;
    return makeIntents({ steer, touching, presses, releases, dir: a.dir || null });
  }

  function choose(screen) {
    return CHOICES[screen] || null;
  }

  return { skill: s, seed, idle, intents, choose };
}

// One fixed step of a whole run played by the bot: its choice for the screen, then run.step with its intents moved
// from stage seconds to core seconds (16.3). Menus get no input.
export function playStep(run, bot) {
  const c = bot.choose(run.screen);
  if (c) run.act(c);
  const live = (run.screen === "stage" || run.screen === "ending") && run.state && !run.paused;
  run.step(live ? shiftIntents(bot.intents(run.mod, run.state), -run.stageStart) : makeIntents());
}
