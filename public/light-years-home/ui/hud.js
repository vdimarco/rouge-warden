// Light Years Home v3: the DOM HUD (final.md 13.1, 13.4 to 13.6; races §2.9). Every element sits in its core/layout.js
// rectangle and is written only when its value changes. hudStep() is pure: it turns the game state, this frame's
// core events and the talk line into a plain model (what each element shows), so node tests can check the rules:
// one hint at a time for 3 s and at most four in the first minute, toasts within 26 characters, the action chip's
// priority, the speed bars (three at cruise, four at top, five and a glow on boost) and the karaoke caption (bold
// uppercase, the current word orange, a small grey speaker tag). createHud() draws that model.
import { TUNE } from '../core/tune.js';
import { chunk, timings, wordAt } from '../core/captions.js';
import { earthDateText } from '../core/timeline.js';
import { fromRapidity } from '../core/physics.js';
import { factById, missionById, JUMPS } from '../core/world/index.js';
import { milestoneById } from '../core/milestones.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const fin = (v, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const MINUS = '−';
export const TOAST_MAX = 26;      // characters (story §3.3)

// ---------------------------------------------------------------- copy

export const MEDAL_NAME = Object.freeze({ tern: 'TERN', gold: 'GOLD', silver: 'SILVER', bronze: 'BRONZE' });
export const MEDAL_ORDER = Object.freeze(['bronze', 'silver', 'gold', 'tern']);

// Hints per control scheme (final.md 13.5). Each shows once a session.
export const HINTS = Object.freeze({
  steer: { touch: 'DRAG TO STEER', keys: 'A D TO STEER · W FOR GAS', mouse: 'MOVE THE MOUSE TO STEER',
    pad: 'LEFT STICK TO STEER' },
  drift: { touch: 'HOLD A HARD TURN', keys: 'SPACE + STEER TO DRIFT', mouse: 'RIGHT BUTTON TO DRIFT',
    pad: 'B + STEER TO DRIFT' },
  release: { touch: 'LET GO TO BOOST', keys: 'RELEASE SPACE TO BOOST', mouse: 'LET GO TO BOOST',
    pad: 'RELEASE B TO BOOST' },
  boost: { touch: 'FLICK UP TO BOOST', keys: 'SHIFT TO BOOST', mouse: 'SHIFT TO BOOST', pad: 'A TO BOOST' },
  scan: { all: 'HOLD THE NOSE ON A RING' },
  start: { all: 'DRIVE THROUGH TO START' },
  tunnel: { all: 'GRAZE THE KNOTS FOR SPEED' },     // a jump's own tutorial (world/jumps.js) wins
  lowgfx: { all: 'LOW GRAPHICS · CHANGE IN SETTINGS' },
  catch: { touch: 'HOLD GAS TO CATCH IT', keys: 'HOLD W TO CATCH IT', mouse: 'HOLD W TO CATCH IT',
    pad: 'HOLD RT TO CATCH IT' },
  catchBoost: { touch: 'BOOST TO CATCH IT', keys: 'SHIFT TO BOOST · CATCH IT', mouse: 'SHIFT TO BOOST · CATCH IT',
    pad: 'A TO BOOST · CATCH IT' },
});
// Hints that teach the thing in front of you now: they skip the first minute's limit of four.
const URGENT = new Set(['catch', 'catchBoost']);
// A hint is done when its action happens: it leaves the screen and never comes back.
const DONE_BY = Object.freeze({ driftStart: ['drift'], driftBoost: ['release'], driftLost: ['release'],
  boostStart: ['boost', 'catchBoost'], eventStart: ['start'], missionStart: ['start'], scanStart: ['scan'],
  takedown: ['catch', 'catchBoost'] });
export const HINT_S = 3;          // s a hint shows
export const HINTS_FIRST_MIN = 4; // at most this many in the first minute of play

export const CHIP = Object.freeze({
  skip: 'SKIP THIS PART', restart: '↺ RESTART', restartSub: 'TAP · LAST GATE', again: 'AGAIN', retry: '↺ RETRY',
  take: 'TAKE JOB', letgo: 'LET GO', letgoSub: 'HOLD', zoomout: 'ZOOM OUT', cancel: 'JUMPING', cancelSub: 'TAP TO CANCEL',
  jump: 'JUMP → ',
});

export const FAIL_TEXT = Object.freeze({
  time: 'OUT OF TIME', cargo: 'CARGO BROKE', lost: 'LOST IT', sunk: 'IT SANK', caught: 'CAUGHT', far: 'TOO FAR',
  crash: 'CRASHED',
});

export const SPEAKERS = Object.freeze({ kit: 'KIT', dot: 'DOT', ferro: 'FERRO', vela: 'VELA', redshift: 'REDSHIFT',
  red: 'REDSHIFT', magpie: 'MAGPIE', keeper: 'KEEPER' });

// ---------------------------------------------------------------- formatting

// Race clock: '9.87', '42.10', '1:02.3'.
export function fmtTime(s) {
  const v = Math.max(0, fin(s));
  if (v < 60) return v.toFixed(2);
  const m = Math.floor(v / 60);
  return `${m}:${(v - m * 60).toFixed(1).padStart(4, '0')}`;
}

// Medal targets read easily: 'GOLD 45.5'.
export const fmtTarget = (s) => (fin(s) >= 60 ? fmtTime(s) : fin(s).toFixed(1));

// Split deltas carry their sign, so colour is never the only cue: '−0.42' ahead, '+0.42' behind.
export const fmtDelta = (d) => `${fin(d) <= 0 ? MINUS : '+'}${Math.abs(fin(d)).toFixed(2)}`;

// Distances for labels: '1.00 GLY', '737 MLY', '54 MLY', '2.5 MLY', '25,000 LY'.
export function fmtLy(ly) {
  const v = Math.max(0, fin(ly));
  const two = (x) => (x >= 10 ? String(Math.round(x)) : x.toFixed(1).replace(/\.0$/, ''));
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)} GLY`;
  if (v >= 1e6) return `${two(v / 1e6)} MLY`;
  const r = v >= 1000 ? Math.round(v / 100) * 100 : Math.round(v);
  return `${String(r).replace(/\B(?=(\d{3})+(?!\d))/g, ',')} LY`;
}

// β with its nines from rapidity: '0.9962c', '0.99913c'.
export function betaText(eta) {
  const omb = fromRapidity(Math.max(0, fin(eta))).oneMinusBeta;
  const b = 1 - omb;
  const n = b > 0 && omb > 0 ? Math.max(0, Math.floor(-Math.log10(omb) + 1e-9)) : 0;
  const dec = Math.max(4, n + 1);
  return { text: `${(Math.floor(b * 10 ** dec) / 10 ** dec).toFixed(dec)}c`, nines: n };
}

// Five bars: three at cruise, four at top, five on boost (handling §2).
export function speedBars(speed, boosting = false, tune = TUNE) {
  const s = fin(speed), S = tune.SHIP;
  if (boosting || s >= S.S_TOP * S.S_DB_X * 0.97) return 5;
  if (s >= S.S_TOP * 0.95) return 4;
  if (s >= S.S_CRUISE * 0.9) return 3;
  if (s >= 10) return 2;
  return s >= 1.5 ? 1 : 0;
}

// The shortest toast that fits: each candidate in turn, the last one cut.
export function fitToast(...texts) {
  for (const t of texts) if (t && t.length <= TOAST_MAX) return t;
  const last = texts.filter(Boolean).pop() || '';
  return last.slice(0, TOAST_MAX);
}

const upper = (s) => String(s ?? '').toUpperCase();
const stars = (n) => '★'.repeat(clamp(fin(n), 0, 3)) + '☆'.repeat(3 - clamp(fin(n), 0, 3));
const shortName = (id) => upper(String(id || '').split('-')[0]);
const JUMP_MODES = new Set(['runup', 'punch', 'tunnel', 'dropout']);
const SKY_MODES = new Set(['punch', 'tunnel']);

function eventData(zone, id) {
  return (zone?.events || []).find((e) => e && e.id === id) || null;
}

// The next medal you lack and its time: 'GOLD 45.5'.
export function medalTarget(evData, best) {
  if (!evData) return '';
  const have = MEDAL_ORDER.indexOf(best?.medal);
  for (const m of MEDAL_ORDER) {
    if (MEDAL_ORDER.indexOf(m) <= have) continue;
    const time = evData[m];
    if (Number.isFinite(time)) return `${MEDAL_NAME[m]} ${fmtTarget(time)}`;
  }
  return '';
}

// ---------------------------------------------------------------- the pure model

export function createHudState() {
  return {
    t: 0, game: null, mode: null, playT: null,
    toast: null, queue: [],
    info: null,
    hint: null, hintShown: {}, hintTimes: [], hintWait: [],
    retry: null, offer: null,
    drifted: false, boosted: false, dbT: null, tunnelSeen: false,
    line: { id: null, text: '', tm: null, chunks: null, slow: false },
    speedBars: 0, speedT: -1,
  };
}

// Queue a hint by key ('steer', 'drift', ...): shown once a session, after delay s, if the rules allow it within
// wait s.
export function queueHint(st, key, wait = 8, delay = 0) {
  if (!HINTS[key] || st.hintShown[key] || st.hintWait.some((h) => h.key === key)) return;
  st.hintWait.push({ key, at: st.t + delay, until: st.t + delay + wait });
}

// Show a hint now, because it teaches what you are doing this moment (LET GO TO BOOST at the first drift tier): it
// takes the place of the hints in replace that are showing (the drift hint it follows), and skips the queue.
export function hintNow(st, key, replace = []) {
  if (!HINTS[key] || st.hintShown[key]) return;
  if (st.hint && replace.includes(st.hint.key)) st.hint = null;
  st.hintWait = st.hintWait.filter((h) => h.key !== key);
  st.hintWait.unshift({ key, at: st.t, until: st.t + 3, now: true });
}

// A hint whose action has happened is done: off the screen, out of the queue, never shown again this session.
function hintDone(st, key) {
  st.hintShown[key] = true;
  st.hintWait = st.hintWait.filter((h) => h.key !== key);
  if (st.hint?.key === key) st.hint = null;
}

// Held while a white wash is up (the PLAY fold, the punch): toasts, info cards and On Earth cards wait for it.
export const WASH_HOLD = 0.2;
export const WASH_OUTLINE = 0.3;

// A stunt's value as it reads on the HUD, by its kind: { now, goal }, as 'TIER 2' and '★★★ AT TIER 3', '41 U/S' and
// '★★ AT 44 U/S', 'NEARS 3' and '★ AT 5 NEARS', 'PADS 2/4'. goal is '' at three stars or for a kind with no numbers.
export function stuntValue(ev, stunt) {
  const v = fin(stunt?.value, NaN), type = ev?.type;
  if (type === 'line') {
    const n = Array.isArray(ev.pads) ? ev.pads.length : 0;
    const got = clamp(fin(stunt?.next, Number.isFinite(v) ? v : 0), 0, n || 99);
    return { now: n ? `PADS ${got}/${n}` : '', goal: '' };
  }
  if (!Number.isFinite(v)) return { now: '', goal: '' };
  const unit = { drift: (x) => `TIER ${x}`, trap: (x) => `${x} U/S`, sling: (x) => `${x} U/S`,
    oncoming: (x) => `${x} NEARS`, skim: (x) => `${x} S` }[type];
  if (!unit) return { now: '', goal: '' };
  const now = type === 'oncoming' ? `NEARS ${Math.round(v)}` : type === 'skim' ? `${v.toFixed(1)} S` : unit(Math.round(v));
  const th = Array.isArray(ev?.stars) && ev.stars.every((x) => typeof x === 'number') ? ev.stars : null;
  const next = th ? th.findIndex((x) => v < x) : -1;
  return { now, goal: next >= 0 ? `${'★'.repeat(next + 1)} AT ${unit(th[next])}` : '' };
}

function toast(st, text, tone = 'plain', s = 3, now = false) {
  if (!text) return;
  const item = { text: text.slice(0, TOAST_MAX), tone, s };
  if (now) { st.toast = { ...item, until: st.t + s }; return; }   // splits never wait
  st.queue.push(item);
}

function info(st, text, sub = '', s = 3, kind = 'note') {
  st.info = { text, sub, until: st.t + s, kind, s };
}

function onEvent(st, e, view, tune) {
  const g = view.game, zone = view.zone;
  const title = (id) => upper(eventData(zone, id)?.title || '');
  switch (e.type) {
    case 'finish': {
      const t = fin(e.time ?? g?.race?.t ?? g?.eventT);
      const m = MEDAL_NAME[e.medal] || '';
      const head = title(e.id ?? g?.race?.id);
      toast(st, fitToast(m && head && `${head} · ${m} · ${fmtTime(t)}`, m && `${m} · ${fmtTime(t)}`,
        head && `${head} · ${fmtTime(t)}`, `FINISH · ${fmtTime(t)}`), 'medal', 3);
      st.retry = { id: 'again', label: CHIP.again, until: st.t + tune.RACE.RETRY_SHOW };
      break;
    }
    case 'stuntResult': {
      const head = title(e.id ?? g?.stunt?.id);
      toast(st, fitToast(head && `${head} · ${stars(e.stars)}`, stars(e.stars)), e.stars > 0 ? 'medal' : 'plain');
      st.retry = { id: 'retry', label: CHIP.retry, until: st.t + tune.RACE.RETRY_SHOW };
      break;
    }
    case 'split':
      if (Number.isFinite(e.delta)) {
        toast(st, `SPLIT ${fmtDelta(e.delta)}`, e.delta <= 0 ? 'ahead' : 'behind', tune.RACE.SPLIT_SHOW, true);
      }
      break;
    case 'fail':      // the mission data's own toast ('IT GOT AWAY') wins
      toast(st, fitToast(e.toast && upper(e.toast), `${FAIL_TEXT[e.reason] || 'FAILED'} · RETRY`, 'FAILED · RETRY'),
        'fail', 2);
      break;
    case 'missionDone': {
      const m = MEDAL_NAME[e.medal];
      toast(st, fitToast(e.title && m && `${upper(e.title)} · ${m}`, e.title && `${upper(e.title)} · DONE`,
        m ? `JOB DONE · ${m}` : 'JOB DONE'), 'medal', 3);
      break;
    }
    case 'jumpMedal': {
      const m = MEDAL_NAME[e.medal] || 'BRONZE';
      const eta = fin(e.eta ?? e.peakEta ?? g?.jump?.etaPeak, 2);
      toast(st, `${m} · ${betaText(eta).text}`, 'medal', 3);
      break;
    }
    case 'earthCard': {   // { text, ago } or a milestone id
      const m = e.id ? milestoneById(e.id) : null;
      const ago = e.ago || (Number.isFinite(m?.yearsAgo) ? earthDateText(m.yearsAgo, g?.today) : '');
      info(st, upper(e.text || m?.text || 'ON EARTH'), ago ? upper(ago) : 'ON EARTH', 3, 'earth');
      break;
    }
    case 'exitOpen': {
      const to = zone?.exit?.to || e.to;
      toast(st, fitToast(to && `EXIT OPEN · ${shortName(to)}`, 'EXIT OPEN'), 'good', 3);
      break;
    }
    case 'rumour': toast(st, 'NEW RUMOUR · SEE LOG', 'good'); break;
    case 'secret': toast(st, 'SECRET FOUND', 'medal'); break;
    case 'setItem':
      toast(st, fitToast(Number.isFinite(e.n) && Number.isFinite(e.of) && `${upper(e.set || 'FOUND')} ${e.n}/${e.of}`,
        'FOUND ONE'), 'good', 2);
      break;
    case 'setDone': toast(st, 'SET DONE', 'medal'); break;
    case 'lookHome': toast(st, 'POSTCARD · SEE LOG', 'good'); break;
    case 'scan':
    case 'farScan': {
      // The card's number for 3 s in the info box (21 BILLION SUNS); the card's text waits in the log.
      const def = (zone?.scans || []).find((x) => x.id === e.id);
      const fact = factById(e.card || def?.card || e.id);
      const far = (zone?.far || []).find((f) => f.scan === e.id);
      const label = upper(e.label || def?.label || far?.label || fact?.title || '');
      const number = upper(e.number || fact?.number || '');
      info(st, number || label || 'SCANNED', number ? label : '', tune.ZONE.NUMBER_SHOW, 'scan');
      break;
    }
    case 'scaleCard':
      if (zone?.scaleCard) info(st, upper(zone.scaleCard), '', tune.ZONE.SCALE_CARD, 'scale');
      break;
    case 'longHaul': toast(st, 'LONG HAUL', 'plain', 2); break;
    case 'missionOffer':
      st.offer = { id: e.mission ?? e.id, until: st.t + tune.MISSION.TAKE_JOB };
      break;
    case 'missionStart':
      // A job takes over: what was waiting to be taught (DRIVE THROUGH TO START, say) is out of date.
      st.offer = null;
      st.hintWait = st.hintWait.filter((h) => URGENT.has(h.key));
      if (st.hint && !URGENT.has(st.hint.key) && st.hint.key !== 'release') st.hint = null;
      break;
    case 'eventArm': if (!g?.mission) queueHint(st, 'start', 6); break;
    case 'driftStart': st.drifted = true; break;
    case 'driftTier': if (e.tier === 1 || e.tier == null) hintNow(st, 'release', ['drift']); break;
    case 'driftBoost': if (st.dbT === null) st.dbT = st.t; break;
    case 'boostStart': st.boosted = true; break;
    case 'restart': st.toast = null; st.queue.length = 0; break;
    default: break;
  }
  const done = DONE_BY[e.type];
  if (done) for (const key of done) hintDone(st, key);
}

// The core's chip (core/zone.js actionOf gives ids only) with its label and sub from CHIP.
export function labelChip(chip, zone = null) {
  if (!chip || chip.label) return chip || null;
  const out = { ...chip, label: chip.id === 'jump' ? CHIP.jump + shortName(chip.to || zone?.exit?.to)
    : CHIP[chip.id] || upper(chip.id) };
  if (chip.id === 'restart') out.sub = CHIP.restartSub;
  else if (chip.id === 'letgo') out.sub = CHIP.letgoSub;
  else if (chip.id === 'cancel') out.sub = CHIP.cancelSub;
  return out;
}

// What the action chip offers, in final.md 13.4's priority. view.chip (from the core's action slot) wins.
export function chipFor(st, view, tune = TUNE) {
  if (view.chip !== undefined) return labelChip(view.chip, view.zone);
  const g = view.game, zone = view.zone;
  if (!g) return null;
  if (g.mode === 'runup') return { id: 'cancel', label: CHIP.cancel, sub: CHIP.cancelSub };
  if (g.mode !== 'drive' && g.mode !== 'ended') return null;
  if (g.mission?.skipOffered) return { id: 'skip', label: CHIP.skip };
  if (g.race && g.race.state === 'running') {
    return { id: 'restart', label: CHIP.restart, sub: CHIP.restartSub, hold: tune.RACE.RESTART_HOLD };
  }
  if (st.retry && st.t < st.retry.until) return { id: st.retry.id, label: st.retry.label };
  const offer = g.zone?.offer && fin(g.zone.offer.until, Infinity) > g.t ? g.zone.offer
    : st.offer && st.t < st.offer.until ? st.offer : null;
  if (offer && !g.mission) return { id: 'take', label: CHIP.take };
  if (g.ship?.tow) return { id: 'letgo', label: CHIP.letgo, sub: CHIP.letgoSub, hold: 1 };
  if (g.zone?.exitOpen && zone?.exit?.to) return { id: 'jump', label: CHIP.jump + shortName(zone.exit.to) };
  if (g.pocketId) return { id: 'zoomout', label: CHIP.zoomout };
  return null;
}

// The top row: the race clock, a stunt, the mission's objective, the jump's destination, or the zone's name.
function topFor(view, tune) {
  const g = view.game, zone = view.zone;
  if (JUMP_MODES.has(g.mode)) {
    const to = g.jump?.to || zone?.exit?.to;
    const ahead = fin(g.jump?.earth?.ahead ?? g.earth?.aheadLy, NaN);
    return { text: to ? `→ ${shortName(to)}` : 'LIGHT SPEED', count: '',
      sub: Number.isFinite(ahead) ? `EARTH · ${earthDateText(ahead, g.today, { short: true })}` : '', kind: 'jump' };
  }
  const race = g.race;
  if (race && (race.state === 'running' || race.state === 'finished')) {
    const ev = eventData(zone, race.id);
    const n = ev?.gates?.length || 0;
    const parts = [];
    if (n) parts.push(`GATE ${clamp(fin(race.gate), 0, n)}/${n}`);
    if (ev?.laps > 1) parts.push(`LAP ${clamp(fin(race.lap, 1), 1, ev.laps)}/${ev.laps}`);
    const target = medalTarget(ev, g.progress?.events?.[race.id]);
    if (target) parts.push(target);
    const clock = fmtTime(race.result?.time ?? race.t ?? g.eventT);
    return { text: clock, count: '', sub: parts.join(' · '), kind: 'timer' };
  }
  // A stunt shows its value; during a mission it moves to the sub line, so the objective stays in view.
  let stunt = null;
  if (g.stunt) {
    const ev = eventData(zone, g.stunt.id);
    const sv = stuntValue(ev, g.stunt);
    stunt = { text: upper(ev?.title || 'STUNT'), count: sv.now, goal: sv.goal };
  }
  const o = view.objective;
  if (o && o.text) {
    return { text: upper(o.text), count: o.count ? String(o.count) : '',
      sub: stunt ? `${stunt.text} ${stunt.count}`.trim() : '', kind: 'mission' };
  }
  const md = view.missionData || (g.mission?.id ? missionById(g.mission.id) : null);
  if (g.mission && md) {
    const beat = md.beats?.[fin(g.mission.beat)];
    if (beat?.objective) {
      // A counter like 'n/3' fills from the mission's count when the core keeps one.
      const n = fin(g.mission.count ?? g.mission.n, NaN);
      const count = beat.counter && Number.isFinite(n) ? beat.counter.replace('n', String(n)) : '';
      return { text: upper(beat.objective), count, sub: stunt ? `${stunt.text} ${stunt.count}`.trim() : '',
        kind: 'mission' };
    }
  }
  if (stunt) return { text: stunt.text, count: stunt.count, sub: stunt.goal, kind: 'stunt' };
  return { text: upper(zone?.name || ''), count: '', sub: '', kind: 'zone' };
}

function captionFor(st, view) {
  const g = view.game;
  const line = view.line !== undefined ? view.line
    : g?.talk?.cur && typeof g.talk.cur === 'object' && g.talk.cur.text ? g.talk.cur : null;
  if (!line || !line.text) { st.line.id = null; return null; }
  const slow = !!g?.settings?.slowCaptions;
  const id = line.id ?? line.text;
  if (st.line.id !== id || st.line.slow !== slow) {
    const chunks = Array.isArray(line.chunks) && line.chunks.length ? line.chunks : chunk(upper(line.text));
    st.line = { id, text: upper(line.text), chunks, tm: timings(chunks, slow), slow, fresh: true };
  } else {
    st.line.fresh = false;
  }
  const w = wordAt(st.line.tm, fin(line.t));
  const words = String(st.line.chunks[Math.max(0, w.chunk)] || '').split(/\s+/).filter(Boolean);
  return {
    id, speaker: SPEAKERS[String(line.speaker || '').toLowerCase()] || upper(line.speaker || ''),
    chunk: w.chunk, words: words.map((text, i) => ({ text: upper(text), now: !w.done && i === w.word })),
    full: st.line.text, fresh: st.line.fresh,
  };
}

/**
 * One HUD frame. view = { game, zone (zone data of the zone or pocket), layout, events (core events since the last
 * call), line (talk current(): { id, speaker, text, chunks?, t }), input (input.state), source, dt (real s),
 * objective? ({ text, count }), chip? ({ id, label, sub?, hold? } or null, from the core's action slot),
 * missionData? (the running mission's data) }. Returns the model; st keeps the timers.
 */
export function hudStep(st, view, tune = TUNE) {
  const g = view.game;
  const dt = clamp(fin(view.dt, 1 / 60), 0, 0.5);     // up to 0.5 s: the hook's stepped frames follow game time
  st.t += dt;
  if (!g) return { mode: 'none' };
  if (st.game !== g) {                                        // a new game: the session's hints stay shown
    const keep = st.hintShown;
    Object.assign(st, createHudState(), { hintShown: keep, t: st.t, game: g });
  }
  const mode = g.mode;
  if (mode !== st.mode) {
    if (mode === 'drive' && st.playT === null) { st.playT = st.t; queueHint(st, 'steer', 6, 0.5); }
    if (mode === 'tunnel' && !st.tunnelSeen && JUMPS[g.jump?.id]?.tutorial) {
      st.tunnelSeen = true;
      queueHint(st, 'tunnel', 4);
    }
    st.mode = mode;
  }
  for (const e of view.events || []) if (e && e.type) onEvent(st, e, view, tune);

  const top = topFor(view, tune);
  st.topText = top.kind === 'mission' ? top.text : '';

  // Hint triggers that read the state.
  const zone = view.zone;
  if (mode === 'drive' && st.playT !== null) {
    const played = st.t - st.playT;
    if (!st.drifted && !st.hintShown.drift && zone?.bodies) {
      const p = g.ship.pos;
      for (const b of zone.bodies) {
        if (!b?.well || Math.hypot(b.pos[0] - p[0], b.pos[1] - p[1]) >= 60 + fin(b.r)) continue;
        queueHint(st, 'drift', 4);
        break;
      }
    }
    if (!st.boosted && ((st.dbT !== null && st.t - st.dbT > 0.6) || played > 15)) queueHint(st, 'boost', 8);
    if (/\bSCAN\b/.test(view.objective?.text || (st.topText || ''))) queueHint(st, 'scan', 8);
    // Steering is the steer hint's action: once you turn, it goes.
    if (Math.abs(fin(g.ship?.steerS)) > 0.3) hintDone(st, 'steer');
    // A chase on auto-cruise: 4 s within 60 u of the runner without the gas, and it tells you to hold GAS (or to
    // boost, with the bar full).
    const runner = g.mission && (g.actors || []).find((a) => a?.kind === 'runner' && a.state !== 'beaten'
      && a.state !== 'fleeing' && a.state !== 'gone');
    const ship = g.ship;
    if (runner && ship && Math.hypot(runner.pos[0] - ship.pos[0], runner.pos[1] - ship.pos[1]) < 60
      && !(view.input?.gas) && !ship.boosting) {
      st.catchT = fin(st.catchT) + dt;
      if (st.catchT >= 4) hintNow(st, fin(ship.bar) >= 0.95 ? 'catchBoost' : 'catch');
    } else {
      st.catchT = 0;
    }
  }
  if (st.hint && st.t >= st.hint.until) st.hint = null;
  st.hintWait = st.hintWait.filter((h) => st.t < h.until && !st.hintShown[h.key]);
  const shared = (view.layout?.shares || []).some((pair) => pair.includes('hint') && pair.includes('info'));
  if (st.info && st.t >= st.info.until) st.info = null;
  const infoUp = !!st.info || (g.zone?.scaleCardUntil > g.t);
  // One slot for both (landscape): an info box that comes up sends the showing hint back to wait its turn.
  if (shared && infoUp && st.hint) {
    st.hintWait.unshift({ key: st.hint.key, at: st.t, until: st.t + 8 });
    st.hintShown[st.hint.key] = false;
    st.hintTimes.pop();
    st.hint = null;
  }
  const firstMin = st.playT !== null && st.t - st.playT < 60;
  const recent = st.hintTimes.filter((t) => st.playT !== null && t - st.playT < 60).length;
  const held = mode === 'paused' || mode === 'log' || mode === 'title';
  // A hint for this moment (hintNow) or an urgent one goes first and skips the first minute's limit.
  let ready = st.hintWait.findIndex((h) => st.t >= h.at && (h.now || URGENT.has(h.key)));
  const capped = firstMin && recent >= HINTS_FIRST_MIN;
  if (ready < 0 && !capped) ready = st.hintWait.findIndex((h) => st.t >= h.at);
  if (!st.hint && ready >= 0 && !held && !(shared && infoUp)) {
    const h = st.hintWait.splice(ready, 1)[0];
    const src = view.source || 'keys';
    const own = h.key === 'tunnel' ? JUMPS[g.jump?.id]?.tutorial : null;
    const text = own || HINTS[h.key][src] || HINTS[h.key].all || HINTS[h.key].keys;
    st.hint = { key: h.key, text, until: st.t + HINT_S };
    st.hintShown[h.key] = true;
    st.hintTimes.push(st.t);
  }

  // Toasts: one at a time, and none starts under a white wash (the PLAY fold, the punch's flash): it waits.
  const wash = clamp(fin(view.wash), 0, 1);
  if (st.toast && st.t >= st.toast.until) st.toast = null;
  if (!st.toast && st.queue.length && wash < WASH_HOLD) {
    const item = st.queue.shift();
    st.toast = { ...item, until: st.t + item.s };
  }
  // An info card that came up under the wash starts its time when the wash is gone.
  if (st.info && wash >= WASH_HOLD) st.info.until = Math.max(st.info.until, st.t + (st.info.s ?? 3));

  // The info box: a scan's number or an On Earth card, else the scale card while the core says so.
  let infoBox = st.info ? { text: st.info.text, sub: st.info.sub, kind: st.info.kind } : null;
  if (!infoBox && g.zone?.scaleCardUntil > g.t && zone?.scaleCard) {
    infoBox = { text: upper(zone.scaleCard), sub: '', kind: 'scale' };
  }

  // Speed: bars in a zone (written at most 10 times a second), β with its nines at light speed.
  const ship = g.ship || {};
  let speed;
  if (SKY_MODES.has(mode) || (mode === 'dropout' && fin(g.jump?.eta) > 1)) {
    // The punch is LIGHT SPEED: the gauge shows the corridor's entry speed until η takes over.
    const b = betaText(Math.max(fin(g.jump?.eta, 2), mode === 'punch' ? fin(tune.JUMP?.ETA_ENTRY, 2) : 0));
    speed = { bars: 5, glow: true, beta: b.text, nines: b.nines };
  } else {
    if (st.t - st.speedT >= 0.1) { st.speedBars = speedBars(ship.speed, ship.boosting, tune); st.speedT = st.t; }
    speed = { bars: st.speedBars, glow: !!ship.boosting || fin(ship.db?.t) > 0, beta: '', nines: 0 };
  }

  const drift = ship.drift || {};
  const tiers = tune.DRIFT.TIERS;
  const tier = clamp(fin(drift.tier), 0, 3);
  const nextAt = tiers[tier] ?? tiers[2], prevAt = tier > 0 ? tiers[tier - 1] : 0;
  const pips = {
    on: !!drift.on, tier,
    fill: drift.on && tier < 3 ? clamp((fin(drift.charge) - prevAt) / Math.max(1e-6, nextAt - prevAt), 0, 1) : 0,
    chain: fin(ship.chain?.n), mult: fin(ship.chain?.mult, 1),
  };

  const bar = clamp(fin(ship.bar) / Math.max(1e-6, fin(ship.barMax, 1)), 0, 1);
  const inp = view.input || {};
  const touch = view.source === 'touch';
  const driving = mode === 'drive' || mode === 'ended' || mode === 'zoom' || JUMP_MODES.has(mode);
  const chip = chipFor(st, view, tune);
  const hold = chip?.hold ? clamp(fin(inp.actionHeld) / chip.hold, 0, 1) : 0;

  return {
    mode, held, kind: view.layout?.kind || 'desktop', source: view.source || 'keys',
    top, speed, pips, washed: wash >= WASH_OUTLINE,
    // The ship's place on screen ([x, y] CSS px, from the camera), so the drift pips sit over the ship.
    shipAt: Array.isArray(view.shipAt) ? view.shipAt : null,
    caption: mode === 'title' ? null : captionFor(st, view),
    toast: st.toast ? { text: st.toast.text, tone: st.toast.tone } : null,
    info: wash >= WASH_HOLD && infoBox?.kind !== 'scale' ? null : infoBox,
    hint: st.hint ? { key: st.hint.key, text: st.hint.text } : null,
    chip: chip ? { ...chip, hold } : null,
    boost: { bar, segs: tune.BAR.SEGMENTS, on: !!ship.boosting, ready: fin(ship.bar) >= tune.BAR.MIN },
    pedals: { gas: !!inp.gas, brake: !!inp.brake, drift: !!inp.drift, boost: !!inp.boost },
    // GAS does nothing at light speed (the corridor's speed is the rapidity's): it leaves the screen there.
    gasPedal: !SKY_MODES.has(mode),
    stick: touch && inp.stick ? inp.stick : null,
    controls: touch && driving,
    radar: !(mode === 'title' || mode === 'punch' || mode === 'tunnel' || held),
    showTop: mode !== 'title',
  };
}

// ---------------------------------------------------------------- the DOM

// The screen's safe area in CSS px, { t, b, l, r }, from env(safe-area-inset-*); min raises each side (a phone
// emulator reports 0). Pass it to core/layout.js layoutFor.
export function safeArea(min = null) {
  const out = { t: 0, b: 0, l: 0, r: 0 };
  if (typeof document !== 'undefined' && document.body) {
    const p = document.createElement('div');
    p.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;'
      + 'padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) '
      + 'env(safe-area-inset-left,0px)';
    document.body.appendChild(p);
    const cs = getComputedStyle(p);
    out.t = parseFloat(cs.paddingTop) || 0; out.r = parseFloat(cs.paddingRight) || 0;
    out.b = parseFloat(cs.paddingBottom) || 0; out.l = parseFloat(cs.paddingLeft) || 0;
    p.remove();
  }
  if (min) for (const k of ['t', 'b', 'l', 'r']) out[k] = Math.max(out[k], fin(min[k]));
  return out;
}


const SVG = 'http://www.w3.org/2000/svg';
const RECT_NAMES = ['speed', 'mission', 'pause', 'captions', 'toast', 'info', 'radar', 'pips', 'hint', 'chip', 'boost',
  'brake', 'gas'];

function h(tag, cls, parent, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  if (parent) parent.appendChild(e);
  return e;
}

function svg(tag, attrs, parent) {
  const e = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs || {})) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
}

// An arc of the BOOST ring from a0 to a1 (radians, 0 up, clockwise) on a 100 × 100 box.
function arcPath(a0, a1, r = 44) {
  const p = (a) => [50 + r * Math.sin(a), 50 - r * Math.cos(a)];
  const [x0, y0] = p(a0), [x1, y1] = p(a1);
  const big = a1 - a0 > Math.PI ? 1 : 0;
  return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 ${big} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

/**
 * createHud(root, { tune }) → { el, apply(layout), update(view) → model, hint(key), toast(text, tone), dom(),
 * state, reset() }. root is an empty element over the canvases; the HUD fills it. Nothing in the HUD takes pointer
 * events: ui/input.js hit-tests the same rectangles on the game canvas.
 */
export function createHud(root, { tune = TUNE } = {}) {
  const st = createHudState();
  const el = h('div', 'lyh-hud', root);
  el.setAttribute('aria-hidden', 'false');
  const cache = new Map();
  const put = (node, key, value, fn) => {
    const k = node;
    let c = cache.get(k);
    if (!c) { c = {}; cache.set(k, c); }
    if (c[key] === value) return;
    c[key] = value;
    fn(value);
  };
  const text = (node, value) => put(node, 'text', value, (v) => { node.textContent = v; });
  const show = (node, on) => put(node, 'show', !!on, (v) => { node.hidden = !v; });
  const cls = (node, name, on) => put(node, `c:${name}`, !!on, (v) => node.classList.toggle(name, v));
  const data = (node, name, value) => put(node, `d:${name}`, value, (v) => { node.dataset[name] = v; });
  const css = (node, name, value) => put(node, `s:${name}`, value, (v) => node.style.setProperty(name, v));

  // Speed: five bars, the boost bar's segments, β in the jump.
  const speed = h('div', 'h-speed', el);
  speed.dataset.r = 'speed';
  const barsBox = h('div', 'h-bars', speed);
  const bars = Array.from({ length: 5 }, (_, i) => {
    const b = h('i', '', barsBox);
    b.style.setProperty('--i', i);
    return b;
  });
  const beta = h('b', 'h-beta', speed);
  const segBox = h('div', 'h-segs', speed);
  const segs = Array.from({ length: tune.BAR.SEGMENTS }, () => h('i', '', segBox));

  const top = h('div', 'h-top', el);
  top.dataset.r = 'mission';
  const topRow = h('div', 'h-top-row', top);
  const topText = h('b', 'h-main', topRow);
  const topCount = h('span', 'h-count', topRow);
  const topSub = h('small', 'h-sub', top);

  const pause = h('div', 'h-pause', el);
  pause.dataset.r = 'pause';
  const ps = svg('svg', { viewBox: '0 0 20 20', 'aria-hidden': 'true' }, pause);
  svg('rect', { x: 5, y: 4, width: 3.2, height: 12, rx: 0.8 }, ps);
  svg('rect', { x: 11.8, y: 4, width: 3.2, height: 12, rx: 0.8 }, ps);

  const cap = h('div', 'h-cap', el);
  cap.dataset.r = 'captions';
  const capIn = h('p', 'h-cap-in', cap);
  const who = h('span', 'h-who', capIn);
  const words = h('span', 'h-words', capIn);
  const say = h('p', 'sr-only', el);
  say.setAttribute('aria-live', 'polite');

  const toastEl = h('div', 'h-toast', el);
  toastEl.dataset.r = 'toast';
  const toastText = h('b', '', toastEl);

  const infoEl = h('div', 'h-info', el);
  infoEl.dataset.r = 'info';
  const infoText = h('b', '', infoEl);
  const infoSub = h('small', '', infoEl);

  const radar = h('div', 'h-radar', el);
  radar.dataset.r = 'radar';

  const pipsEl = h('div', 'h-pips', el);
  pipsEl.dataset.r = 'pips';
  const pipBox = h('span', 'h-pip-box', pipsEl);
  const pips = [1, 2, 3].map((n) => { const p = h('i', `t${n}`, pipBox); return p; });
  const chain = h('span', 'h-chain', pipsEl);

  const hint = h('div', 'h-hint', el);
  hint.dataset.r = 'hint';
  const hintText = h('b', '', hint);

  const chip = h('div', 'h-chip', el);
  chip.dataset.r = 'chip';
  const chipRing = svg('svg', { class: 'h-ring', preserveAspectRatio: 'none', 'aria-hidden': 'true' }, chip);
  const chipRect = svg('rect', { pathLength: 1, x: 1, y: 1, rx: 12 }, chipRing);
  const chipLabel = h('b', '', chip);
  const chipSub = h('small', '', chip);

  const boost = h('div', 'h-boost', el);
  boost.dataset.r = 'boost';
  const bs = svg('svg', { viewBox: '0 0 100 100', 'aria-hidden': 'true' }, boost);
  const nSeg = tune.BAR.SEGMENTS, gap = 0.16;
  const tracks = [], fills = [];
  for (let i = 0; i < nSeg; i++) {
    const a0 = (i / nSeg) * 2 * Math.PI + gap / 2, a1 = ((i + 1) / nSeg) * 2 * Math.PI - gap / 2;
    tracks.push(svg('path', { d: arcPath(a0, a1), class: 'track' }, bs));
    fills.push(svg('path', { d: arcPath(a0, a1), class: 'fill', pathLength: 1, 'stroke-dasharray': '0 1' }, bs));
  }
  h('b', '', boost, 'BOOST');

  const brake = h('div', 'h-pedal h-brake', el);
  brake.dataset.r = 'brake';
  h('b', '', brake, 'BRAKE');
  h('small', '', brake, 'DRIFT');
  const gas = h('div', 'h-pedal h-gas', el);
  gas.dataset.r = 'gas';
  h('b', '', gas, 'GAS');

  const stick = h('div', 'h-stick', el);
  const knob = h('i', 'h-knob', stick);
  stick.hidden = true;

  const byName = { speed, mission: top, pause, captions: cap, toast: toastEl, info: infoEl, radar, pips: pipsEl, hint,
    chip, boost, brake, gas };
  let layout = null;

  // Place every element in its rectangle. Elements with no rectangle in this layout stay hidden.
  function apply(l) {
    layout = l;
    el.dataset.kind = l.kind;
    el.dataset.scheme = l.scheme || 'none';
    el.dataset.hand = l.hand || 'right';
    for (const name of RECT_NAMES) {
      const node = byName[name], r = l.rects[name];
      node.classList.toggle('no-rect', !r);
      if (!r) continue;
      const s = node.style;
      s.left = `${r[0]}px`; s.top = `${r[1]}px`; s.width = `${r[2]}px`; s.height = `${r[3]}px`;
    }
    const c = l.rects.chip;
    if (c) {
      chipRing.setAttribute('viewBox', `0 0 ${c[2]} ${c[3]}`);
      chipRect.setAttribute('width', c[2] - 2);
      chipRect.setAttribute('height', c[3] - 2);
      chipRect.setAttribute('rx', Math.min(14, (c[3] - 2) / 2));
    }
    const R = tune.INPUT.STICK_FULL;
    stick.style.width = stick.style.height = `${2 * R}px`;
    cache.clear();
  }

  function render(m) {
    data(el, 'mode', m.mode);
    data(el, 'source', m.source);
    cls(el, 'held', m.held);
    cls(el, 'controls', m.controls);
    cls(el, 'jumping', JUMP_MODES.has(m.mode));
    cls(el, 'sky', SKY_MODES.has(m.mode));             // at light speed the hint moves up, off the vanishing point
    cls(el, 'washed', !!m.washed);                     // a dark outline on every word while a white wash is up
    show(el, m.mode !== 'none' && m.mode !== 'title');

    // speed
    for (let i = 0; i < 5; i++) cls(bars[i], 'on', i < m.speed.bars);
    cls(speed, 'glow', m.speed.glow);
    cls(speed, 'beta', !!m.speed.beta);
    text(beta, m.speed.beta);
    const segN = segs.length;
    for (let i = 0; i < segN; i++) {
      const f = clamp(m.boost.bar * segN - i, 0, 1);
      css(segs[i], '--f', f.toFixed(2));
    }

    // top row
    text(topText, m.top.text);
    text(topCount, m.top.count);
    text(topSub, m.top.sub);
    data(top, 'kind', m.top.kind);
    cls(top, 'long', m.top.text.length + m.top.count.length > 19);
    show(topSub, !!m.top.sub);

    // captions, with every line also on the aria-live line
    const c = m.caption;
    show(cap, !!c);
    if (c) {
      text(who, c.speaker);
      const key = `${c.id}|${c.chunk}|${c.words.map((w) => (w.now ? `*${w.text}` : w.text)).join(' ')}`;
      put(words, 'words', key, () => {
        words.textContent = '';
        c.words.forEach((w, i) => {
          if (i) words.appendChild(document.createTextNode(' '));
          const s = h('span', w.now ? 'now' : '', words, w.text);
          s.dataset.i = i;
        });
      });
      if (c.fresh) say.textContent = `${c.speaker}: ${c.full}`;
    }

    show(toastEl, !!m.toast);
    if (m.toast) { text(toastText, m.toast.text); data(toastEl, 'tone', m.toast.tone); }

    show(infoEl, !!m.info);
    if (m.info) {
      // A number keeps its word on one line (1 SHIP, 21 BILLION), and LIGHT-YEARS never breaks at its hyphen. A
      // one-part card with a dot in it (the scale card) breaks at the dot when it must.
      const keep = (t) => String(t || '').replace(/(\d) (?=[A-Z])/g, '$1\u00a0').replace(/-/g, '\u2011');
      const at = m.info.sub ? -1 : m.info.text.indexOf(' · ');
      text(infoText, keep(at < 0 ? m.info.text : m.info.text.slice(0, at)));
      text(infoSub, keep(at < 0 ? m.info.sub : m.info.text.slice(at + 3)));
      show(infoSub, at >= 0 || !!m.info.sub);
      data(infoEl, 'kind', m.info.kind);
      data(infoEl, 'split', at >= 0 ? '1' : '');
    }
    show(radar, m.radar);

    // drift pips and chain, over the ship wherever the camera has it (inside the middle of the screen); the box
    // stays on its layout rectangle and its contents slide
    const p = m.pips;
    cls(pipsEl, 'on', p.on || p.chain > 0);
    const pr = layout?.rects.pips;
    const dx = pr && m.shipAt ? clamp(m.shipAt[0] - (pr[0] + pr[2] / 2), -0.22 * layout.w, 0.22 * layout.w) : 0;
    const slide = dx ? `translateX(${Math.round(dx)}px)` : 'none';
    css(pipBox, 'transform', slide);
    css(chain, 'transform', slide);
    for (let i = 0; i < 3; i++) {
      cls(pips[i], 'lit', p.tier > i);
      css(pips[i], '--f', p.tier === i ? p.fill.toFixed(2) : p.tier > i ? '1' : '0');
    }
    show(pipBox, p.on);
    text(chain, p.chain > 0 ? `×${p.mult} · ${p.chain}` : '');

    show(hint, !!m.hint);
    if (m.hint) { text(hintText, m.hint.text); cls(hint, 'long', m.hint.text.length > 20); }

    show(chip, !!m.chip);
    if (m.chip) {
      text(chipLabel, m.chip.label);
      text(chipSub, m.chip.sub || '');
      show(chipSub, !!m.chip.sub);
      data(chip, 'id', m.chip.id);
      css(chipRect, 'stroke-dasharray', `${m.chip.hold.toFixed(3)} 1`);
      cls(chip, 'holding', m.chip.hold > 0);
    }

    // touch controls
    show(boost, m.controls && !!layout?.rects.boost);
    if (m.controls) {
      for (let i = 0; i < fills.length; i++) {
        const f = clamp(m.boost.bar * fills.length - i, 0, 1);
        put(fills[i], 'f', f.toFixed(2), (v) => fills[i].setAttribute('stroke-dasharray', `${v} 1`));
      }
      cls(boost, 'on', m.boost.on || m.pedals.boost);
      cls(boost, 'empty', !m.boost.ready);
    }
    show(gas, m.controls && !!layout?.rects.gas && m.gasPedal !== false);
    show(brake, m.controls && !!layout?.rects.brake);
    cls(gas, 'on', m.pedals.gas);
    cls(brake, 'on', m.pedals.brake || m.pedals.drift);
    cls(brake, 'drift', m.pedals.drift);

    const sk = m.stick;
    show(stick, !!sk);
    if (sk) {
      const R = tune.INPUT.STICK_FULL;
      const dx = clamp(sk.x - sk.ax, -R, R), dy = clamp(sk.y - sk.ay, -R, R);
      put(stick, 'pos', `${sk.ax}|${sk.ay}`, () => {
        stick.style.transform = `translate(${sk.ax - R}px, ${sk.ay - R}px)`;
      });
      put(knob, 'pos', `${dx}|${dy}`, () => { knob.style.transform = `translate(${dx}px, ${dy}px)`; });
    }
  }

  return {
    el,
    apply,
    update(view) {
      const m = hudStep(st, view, tune);
      if (!layout && view.layout) apply(view.layout);
      else if (view.layout && view.layout !== layout) apply(view.layout);
      render(m);
      return m;
    },
    hint(key) { queueHint(st, key, 8); },
    toast(t, tone = 'plain', s = 3) { toast(st, t, tone, s); },
    // Measured boxes of the HUD's elements (for the hook's layout().dom), only those showing.
    dom() {
      const out = {};
      for (const name of RECT_NAMES) {
        const node = byName[name];
        if (node.hidden || node.classList.contains('no-rect') || el.hidden) continue;
        const b = node.getBoundingClientRect();
        if (b.width > 0 && b.height > 0) out[name] = [b.left, b.top, b.width, b.height].map(Math.round);
      }
      return out;
    },
    get state() { return st; },
    reset() { Object.assign(st, createHudState()); },
  };
}
