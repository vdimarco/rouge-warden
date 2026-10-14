// Light Years Home v3: the engine bus (final.md 14.2, handling §7.4). Two saws ±7 cents and a sine an octave down at
// 55 Hz × (1 + 1.2·s / S_TOP), through a low-pass that opens from 400 to 3,200 Hz with speed and a little more while
// you accelerate: the engine strains on the gas and sighs on the brake. Wind is noise band-passed round 1.5 kHz at
// 0.3·(s / S_TOP)². The drift hiss is noise high-passed at 3 kHz, as loud as the slip (full at 45°), brighter with
// each spark tier and panned to the side the sparks fly. A boost sweep climbs from 400 to 2,400 Hz while the boost
// lasts; a skim hisses, a draft hums. In the jump the engine climbs with η, the wind becomes the rush of light, and a
// whine warns of a hit in the corridor and cuts the moment your line is clear. Built once at start, then only steered;
// a quiet layer is unplugged so it costs nothing.

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const DEG = Math.PI / 180;
const TUNNEL = new Set(['punch', 'tunnel', 'dropout']);
const DRIFT_HISS = [3000, 3600, 4800, 6400];   // Hz by spark tier: red, white, blue heat up the hiss
const WHINE_LEAD = 1.0;                         // s: the whine starts this long before a hit

export function createEngine(mix) {
  let E = null;
  const S = { last: -1, acc: 0, boostAt: -1, cutUntil: 0 };   // numbers on one object: no boxing per frame
  let wasBoost = false, whine = false;
  const engine = { update, cutWhine, get built() { return !!E; }, get load() { return S.acc; } };
  mix.engine = engine;

  mix.onStart(() => {
    const bus = mix.bus.engine;
    // the motor
    const lp = mix.filter('lowpass', 400, 1.6);
    const body = mix.gain(0, bus);
    lp.connect(body);
    const parts = [['sawtooth', -7, 0.28], ['sawtooth', 7, 0.28], ['sine', 0, 0.35]].map(([type, cents, level]) => {
      const o = mix.osc(type, 110);
      o.detune.value = cents;
      o.connect(mix.gain(level, lp));
      return o;
    });
    // a slow wobble on the pitch, so it rumbles and never sits dead still
    const lfo = mix.osc('sine', 5.3), lfoG = mix.gain(6);
    lfo.connect(lfoG);
    for (const o of parts) lfoG.connect(o.detune);
    // noise layers from the shared source
    const layer = (type, f, q, pan = false) => {
      const flt = mix.filter(type, f, q), g = mix.gain(0);
      const p = pan ? mix.panner(0) : null;
      mix.noise.connect(flt);
      flt.connect(g);
      if (p) g.connect(p);
      return { flt, g, p, out: p || g, idle: 0 };
    };
    const wind = layer('bandpass', 1500, 0.8);
    const drift = layer('highpass', 3000, 0.7, true);
    const boost = layer('bandpass', 400, 2.5);
    const skim = layer('bandpass', 3200, 2.5);
    const draft = layer('lowpass', 500, 0.7);
    const rumble = layer('lowpass', 260, 0.7);
    // the corridor's proximity whine
    const wo = mix.osc('triangle', 620), wg = mix.gain(0), wp = mix.panner(0);
    wo.connect(wg);
    if (wp) wg.connect(wp);
    const t = mix.now();
    for (const o of [...parts, lfo, wo]) o.start(t);
    E = { bus, lp, body, parts, wind, drift, boost, skim, draft, rumble, whine: { o: wo, g: wg, p: wp, out: wp || wg,
      idle: 0 } };
  });

  // Steer a layer's level; plug it in while it sounds, unplug it 0.4 s after it went quiet.
  function level(L, v, tau, now) {
    if (v > 0.001) L.idle = now;
    mix.plug(L.out, E.bus, v > 0.001 || now - L.idle < 0.4);
    mix.steer(L.g.gain, v, tau);
  }

  // Cut the whine at once (a hit in the corridor).
  function cutWhine() {
    if (!E || !mix.live()) return;
    const now = mix.now();
    S.cutUntil = now + 0.3;
    E.whine.g.gain.cancelScheduledValues(now);
    E.whine.g.gain.setTargetAtTime(0, now, 0.01);
    mix.unsteer(E.whine.g.gain);
    whine = false;
  }

  function update(view, dt) {
    if (!E || !mix.live()) return;
    const game = view?.game;
    const ship = game?.ship;
    if (!ship) return;
    const now = mix.now();
    const mode = game.mode;
    const T = game.tune?.SHIP || {};
    const top = T.S_TOP ?? 30, boostS = T.S_BOOST ?? 42;
    const ts = game.timeScale ?? 1;
    const evs = view.events;
    if (evs) {
      const list = Array.isArray(evs) ? evs : evs.list, n = Array.isArray(evs) ? evs.length : evs.n;
      for (let i = 0; i < n; i++) if (list[i]?.type === 'jHit') cutWhine();
    }
    if (ts === 0) return;                               // hit-stop: everything holds

    const tunnel = TUNNEL.has(mode);
    const jump = game.jump;
    const eta = Number.isFinite(jump?.eta) ? jump.eta : 2;
    let s = Number.isFinite(ship.speed) ? ship.speed : 0;
    if (tunnel) s = boostS * (1 + 0.25 * clamp(eta - 2, 0, 2));
    // load: how hard the ship accelerates (smoothed), or the gas and brake when main.js passes the input
    const d = clamp(dt || 1 / 60, 1e-3, 0.1);
    const a = S.last < 0 || tunnel ? 0 : (s - S.last) / d;
    S.last = s;
    S.acc += (clamp(a / 12, -1, 1) - S.acc) * clamp(d / 0.15, 0, 1);
    let load = S.acc;
    const inp = view.input;
    if (inp) {
      if (inp.gas > 0 && s < top) load = Math.max(load, 0.6 * inp.gas);
      if (inp.brake > 0) load = Math.min(load, -inp.brake);
    }
    const slow = ts < 1 ? 0.55 + 0.45 * ts : 1;          // slow motion sags the motor
    const sx = clamp(s / top, 0, 1.6);

    // the motor
    const f = 55 * (1 + 1.2 * sx) * slow;
    for (const o of E.parts) mix.steer(o.frequency, o.type === 'sine' ? f / 2 : f, 0.05);
    const fc = clamp((400 + 2800 * sx ** 1.1) * (1 + 0.35 * Math.max(0, load)) * (1 - 0.25 * Math.max(0, -load)), 300,
      4200);
    mix.steer(E.lp.frequency, fc, 0.05);
    const loud = (0.18 + 0.2 * Math.min(1.4, sx) + 0.1 * Math.max(0, load) - 0.08 * Math.max(0, -load)
      + (ship.boosting ? 0.06 : 0)) * (mode === 'ended' ? 0.6 : mode === 'runup' ? 0.8 : 1);
    mix.steer(E.body.gain, loud, 0.08);

    // wind, or the rush of light in the jump
    if (tunnel) {
      mix.steer(E.wind.flt.frequency, 600 + 500 * clamp(eta - 2, 0, 3), 0.1);
      level(E.wind, 0.3, 0.2, now);
      level(E.rumble, 0.22, 0.2, now);
    } else {
      mix.steer(E.wind.flt.frequency, 1100 + 900 * Math.min(1.6, sx), 0.1);
      level(E.wind, 0.3 * sx * sx * 0.75, 0.1, now);
      level(E.rumble, inp?.brake > 0 ? 0.14 * inp.brake : Math.max(0, -load) * 0.1, 0.08, now);
    }

    // the drift hiss: louder with the slip, brighter with the tier, on the side the sparks fly
    const slipDeg = Math.abs(ship.slip || 0) / DEG;
    const dr = ship.drift || {};
    const sliding = tunnel ? !!jump?.slide : !!dr.on;
    let hiss = 0;
    if (sliding) hiss = clamp(slipDeg / 45, 0.25, 1) * 0.32;
    else if (!tunnel && slipDeg > 10 && s > 12) hiss = clamp((slipDeg - 10) / 35, 0, 1) * 0.1;
    const tier = clamp((tunnel ? jump?.tier : dr.tier) | 0, 0, 3);
    mix.steer(E.drift.flt.frequency, DRIFT_HISS[tier], 0.05);
    if (E.drift.p) mix.steer(E.drift.p.pan, -clamp(dr.dir || 0, -1, 1) * 0.35, 0.1);
    level(E.drift, hiss, hiss > 0 ? 0.03 : 0.06, now);

    // the boost sweep, 400 to 2,400 Hz over 1.2 s, while any boost lasts
    const boosting = !!ship.boosting || (ship.db?.t ?? 0) > 0 || (ship.burstT ?? 0) > 0;
    if (boosting && !wasBoost) S.boostAt = now;
    wasBoost = boosting;
    if (boosting) mix.steer(E.boost.flt.frequency, 400 * 6 ** clamp((now - S.boostAt) / 1.2, 0, 1), 0.03);
    level(E.boost, boosting && !tunnel ? (ship.boosting ? 0.22 : 0.16) : 0, boosting ? 0.03 : 0.15, now);

    // skim and draft
    level(E.skim, !tunnel && ship.skim?.on ? 0.12 + 0.002 * s : 0, 0.05, now);
    level(E.draft, !tunnel && ship.draft?.on ? 0.2 : 0, 0.08, now);

    // the corridor's whine: on while your line would hit within WHINE_LEAD, rising as it nears, panned to the way out
    const danger = tunnel && Number.isFinite(jump?.danger) ? jump.danger : 0;
    const w = E.whine;
    if (danger > 0 && danger <= WHINE_LEAD && now > S.cutUntil) {
      const k = 1 - danger / WHINE_LEAD;
      if (!whine) { whine = true; mix.count('whine'); }
      mix.steer(w.o.frequency, 620 + 560 * k, 0.02);
      if (w.p) mix.steer(w.p.pan, clamp((jump.dangerSide || 0) * 0.6, -1, 1), 0.03);
      level(w, 0.08 + 0.07 * k, 0.02, now);
    } else {
      if (whine) { whine = false; mix.steer(w.o.frequency, 360, 0.025); }
      level(w, 0, 0.012, now);
    }
  }

  return engine;
}
