// Up the Creek: reading the phone as a paddle. Feed it the pose from public/fish/js/motion.js (portrait mode) and it
// calls back with paddle actions, and keeps the lean and the brace up to date.
//
//   side:   tip the phone to a side (the steering tilt, roll) to choose that side. A small tilt keeps the last side.
//   stroke: rock the top edge (the rod angle θ, its rate ω). Which way is a stroke is learned from your first swing
//           (pull = +1 or -1), because grips differ. Power comes from how fast you rock.
//   J:      twist the phone about its long axis (twist) near the end of a stroke.
//   back:   rock the other way, from a phone held still.
//   brace:  tip the phone hard (about 30°) and hold it still.
//   lean:   a gentle tilt leans the canoe.
// Pure logic, no DOM: qa/lab/creek.paddle.test.mjs feeds it made-up and simulated sensor data.

// Thumbs and keys steer: you press on the side you want the bow to turn toward. A forward stroke turns the bow away
// from its own side, so it goes in on the other side, and so does the J after it. A back stroke turns the bow toward
// its own side, so it stays on the side you press. (The phone stays a real paddle: see createPaddle.)
export function steer(type, toward, power = 1) {
  return { type, side: type === "back" ? toward : -toward, power };
}

export const PT = {
  SIDE_MIN: 0.15,        // |roll| that chooses a side
  START: 120,            // deg/s in the pull direction that starts a stroke
  END: 40,               // ...and below which it ends
  CONFIRM: 15,           // degrees of swing before the stroke counts (no twitch strokes)
  MAX_SWING: 70, MAX_MS: 700,
  PURITY: 0.6,           // most of the spin must be the rock itself, not a shake
  POWER_RATE: 250,       // deg/s for a stroke of power 1
  J_RATE: 150, J_AFTER: 250, J_FULL: 400,
  RECOVER: 450,          // ms after a stroke when the swing back is not a back stroke
  BACK_RATE: 150, STILL_SPIN: 50, STILL_MS: 200,
  BRACE_ROLL: 0.85, BRACE_OFF: 0.7, BRACE_SPIN: 60, BRACE_MS: 150,
  LEAN_DEAD: 0.12, LEAN_TAU: 120,
};
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export function createPaddle({ pull = 1, onAction = () => {} } = {}) {
  const st = {
    pull: pull < 0 ? -1 : 1, side: 1, lean: 0, brace: 0,
    phase: "idle", t0: 0, th0: 0, peak: 0, confirmed: false, strokeSide: 1, jDone: false,
    lastEnd: -1e9, jUntil: -1e9, jSide: 1,
    stillStart: 0, lastStillDur: 0, lastStillEnd: -1e9, braceSince: 0, lastT: 0,
  };
  const emit = (a) => { try { onAction(a); } catch (e) { /* the game's problem, not the reader's */ } };

  function feed(p) {
    const t = p.t, dt = st.lastT ? clamp(t - st.lastT, 0, 100) : 16;
    st.lastT = t;
    const roll = p.roll || 0, om = p.omega || 0, spin = Math.max(p.spin || 0, Math.abs(om)), tw = p.twist || 0;
    if (Math.abs(roll) >= PT.SIDE_MIN) st.side = roll > 0 ? 1 : -1;
    // the lean: the tilt past a small dead zone, smoothed
    const dz = Math.abs(roll) <= PT.LEAN_DEAD ? 0 : (roll - Math.sign(roll) * PT.LEAN_DEAD) / (1 - PT.LEAN_DEAD);
    st.lean += (clamp(dz, -1, 1) - st.lean) * (1 - Math.exp(-dt / PT.LEAN_TAU));
    // stillness, and how long the last still spell lasted
    if (spin < PT.STILL_SPIN) { if (!st.stillStart) st.stillStart = t; }
    else if (st.stillStart) { st.lastStillDur = t - st.stillStart; st.lastStillEnd = t; st.stillStart = 0; }
    // the brace: tipped hard and held still
    if (!st.brace) {
      if (Math.abs(roll) >= PT.BRACE_ROLL && spin < PT.BRACE_SPIN && st.phase === "idle") {
        if (!st.braceSince) st.braceSince = t;
        if (t - st.braceSince >= PT.BRACE_MS) { st.brace = roll > 0 ? 1 : -1; emit({ type: "brace", side: st.brace, on: true }); }
      } else st.braceSince = 0;
    } else if (Math.abs(roll) < PT.BRACE_OFF || Math.sign(roll) !== st.brace) {
      emit({ type: "brace", side: st.brace, on: false });
      st.brace = 0; st.braceSince = 0;
    }

    const sw = st.pull * om;   // + in the pull direction
    if (st.phase === "idle") {
      // a J can still come just after a stroke ends
      if (t <= st.jUntil && !st.jDone && Math.abs(tw) >= PT.J_RATE) jStroke(tw);
      if (st.brace) return;
      if (sw >= PT.START && Math.abs(om) >= PT.PURITY * spin) {
        st.phase = "pull"; st.t0 = t; st.th0 = p.theta; st.peak = sw; st.confirmed = false; st.strokeSide = st.side; st.jDone = false;
      } else if (-sw >= PT.BACK_RATE && t - st.lastEnd > PT.RECOVER && st.lastStillDur >= PT.STILL_MS && t - st.lastStillEnd < 250 && Math.abs(om) >= PT.PURITY * spin) {
        st.lastStillDur = 0;
        emit({ type: "back", side: st.side, power: clamp(-sw / PT.POWER_RATE, 0.3, 1.2) });
      }
      return;
    }
    // pulling
    if (sw > st.peak) st.peak = sw;
    const swing = Math.abs(p.theta - st.th0);
    if (!st.confirmed && swing >= PT.CONFIRM) {
      st.confirmed = true;
      emit({ type: "stroke", side: st.strokeSide, power: clamp(st.peak / PT.POWER_RATE, 0.3, 1.4) });
    }
    if (st.confirmed && !st.jDone && (swing >= PT.MAX_SWING / 2 || t - st.t0 >= 150) && Math.abs(tw) >= PT.J_RATE) jStroke(tw);
    if (sw < PT.END || swing > PT.MAX_SWING || t - st.t0 > PT.MAX_MS) {
      st.phase = "idle";
      if (st.confirmed) { st.lastEnd = t; st.jUntil = t + PT.J_AFTER; st.jSide = st.strokeSide; }
    }
  }
  function jStroke(tw) {
    st.jDone = true;
    emit({ type: "j", side: st.phase === "pull" ? st.strokeSide : st.jSide, power: clamp(Math.abs(tw) / PT.J_FULL, 0.3, 1.3) });
  }
  return {
    feed,
    get lean() { return st.lean; },
    get brace() { return st.brace; },
    get side() { return st.side; },
    get pull() { return st.pull; },
    set pull(v) { st.pull = v < 0 ? -1 : 1; },
    get stroking() { return st.phase === "pull"; },
  };
}
