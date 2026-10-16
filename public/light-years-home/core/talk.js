// Light Years Home v3: the radio queue (final.md 2.7, 12; story §2.1). Lines are captions that play while you drive.
// Rules: at most one line every TALK.GAP s (start to start; the pre-roll does not count); nothing starts within
// TALK.QUIET s after a gate, a hit or a takedown, nor while a race clock runs; mission lines beat Dot, who beats
// Redshift; a line that waits more than TALK.DROP s is dropped to the log; the action control skips a line, which
// goes to the log too. Redshift reacts at most once every TALK.REDSHIFT_GAP s. The opening's lines (OPENING) play on
// their own timetable from the PLAY tap.
import { lineById, OPENING, REACTIONS } from './world/lines/ch1.js';
import { chunk, timings } from './captions.js';
import { H, zoneOf } from './game.js';
import { missionById } from './world/missions/ch1.js';

const HOLD = 1.0;            // s a line stays up after its last word
const MISSION_WAIT = 16;     // s a mission line may wait before it goes to the log
const PRI_MISSION = 1;
const QUIET_TYPES = new Set(['gate', 'gateMiss', 'crash', 'bigCrash', 'takedown']);

/** createTalk() → the talk state (final.md 5.1, plus lastStartT and once). */
export function createTalk() {
  return { cur: null, queue: [], lastEndT: -99, lastStartT: -99, quietUntil: 0, redshiftT: -99, log: [], once: {},
    heard: {} };
}

function ensure(game) {
  const k = game.talk || (game.talk = createTalk());
  if (k.lastStartT === undefined) k.lastStartT = -99;
  if (!k.once) k.once = {};
  if (!k.heard) k.heard = {};
  if (!Array.isArray(k.queue)) k.queue = [];
  if (!Array.isArray(k.log)) k.log = [];
  return k;
}

// Fill {n} and {short} from vars.
function fill(text, vars) {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (m, key) => (vars[key] !== undefined ? String(vars[key]) : m));
}

/** lineText(id, vars) → the line's text with its template filled, or null. */
export function lineText(id, vars = null) {
  const l = lineById(id);
  return l ? fill(l.text, vars) : null;
}

/** lineSeconds(text, slow) → how long a line stays up: its karaoke timing plus a short hold. */
export function lineSeconds(text, slow = false, hold = HOLD) {
  return timings(chunk(String(text).toUpperCase()), slow).total + hold;
}

const toLog = (k, id) => { if (k.log[k.log.length - 1] !== id) k.log.push(id); };

/**
 * say(game, lineId, opts) → true when queued. opts: at (earliest game.t to start), mission (a mission or people line:
 * priority 1, no Redshift gap), pri (override), vars ({ n, short } for templates), preroll (does not count toward
 * the gap and ignores the arrival wait), quiet (only when nothing else is playing: never waits), once ('zone' or
 * 'game' with a key), log (straight to the log, never shown). Lines with log: true in the data go to the log.
 */
export function say(game, lineId, opts = {}) {
  const k = ensure(game);
  const line = lineById(lineId);
  if (!line) return false;
  const key = opts.once ? (opts.once === 'zone' ? `${game.zoneId}:${lineId}` : lineId) : null;
  if (key && k.once[key]) return false;
  if (line.log || opts.log) { if (key) k.once[key] = true; toLog(k, lineId); return true; }
  if (k.cur?.id === lineId) return false;
  const dup = k.queue.find((q) => q.id === lineId);
  if (dup) {
    // The jump asks for a line already waiting (Dot's "checked twice" ends WHICH WAY HOME's scans too): it plays as
    // the jump's.
    if (opts.jump && !dup.jump) { dup.jump = true; return true; }
    return false;
  }
  const mission = !!opts.mission;
  const pri = opts.pri ?? (mission ? PRI_MISSION : line.pri);
  if (line.speaker === 'REDSHIFT' && !mission && game.t - k.redshiftT < game.tune.TALK.REDSHIFT_GAP) return false;
  if (opts.quiet && (k.cur || k.queue.length || game.t - k.lastStartT < game.tune.TALK.GAP)) return false;
  if (key) k.once[key] = true;
  const at = Number.isFinite(opts.at) ? opts.at : game.t;
  k.queue.push({ id: lineId, pri, at, q: game.t, vars: opts.vars ? { ...opts.vars } : null, preroll: !!opts.preroll,
    quiet: !!opts.quiet, mission, jump: !!opts.jump, story: !!opts.story, zone: game.zoneId });
  if (line.speaker === 'REDSHIFT' && !mission) k.redshiftT = game.t;
  return true;
}

/** skipLine(game, ev): the action control skips the current line; it goes to the log. */
export function skipLine(game, ev = null) {
  const k = ensure(game);
  if (!k.cur) return false;
  if (ev) ev.push('lineSkip', { id: k.cur.id });
  toLog(k, k.cur.id);
  k.heard[k.cur.id] = game.t;
  k.cur = null;
  k.lastEndT = game.t;
  return true;
}

/** quiet(game, seconds): no line starts for this long. */
export function quiet(game, seconds) {
  const k = ensure(game);
  k.quietUntil = Math.max(k.quietUntil, game.t + seconds);
}

/** current(game) → { id, speaker, text, chunks, t } (t: seconds into the line) or null. */
export function current(game) {
  const c = game?.talk?.cur;
  if (!c) return null;
  return { id: c.id, speaker: c.speaker, text: c.text, chunks: c.chunks, t: game.t - c.t0 };
}

/** dropQueued(game, ids, ev): send queued lines (all when ids is null) to the log. */
export function dropQueued(game, ids = null, ev = null) {
  const k = ensure(game);
  for (let i = k.queue.length - 1; i >= 0; i--) {
    const q = k.queue[i];
    if (ids && !ids.includes(q.id)) continue;
    k.queue.splice(i, 1);
    toLog(k, q.id);
    if (ev) ev.push('lineDrop', { id: q.id });
  }
}

// ---------------------------------------------------------------- the opening

/**
 * The opening (12.1): from the PLAY tap (game.story.playAt), each OPENING line is queued at its time; the toLog lines
 * go straight to the log. It runs only in a fresh game in the opening's zone. endOpening sends what is left to the log
 * (WHICH WAY HOME's chase starts).
 */
function stepOpening(game) {
  const st = game.story;
  if (st.openingI === undefined) st.openingI = 0;
  const lines = OPENING.lines;
  if (st.openingI >= lines.length) return;
  if (game.zoneId !== OPENING.zone || game.progress?.missions?.['which-way-home']) { st.openingI = lines.length; return; }
  const k = ensure(game);
  if (st.openingI === 0 && !st.openingLogged) {
    st.openingLogged = true;
    for (const id of OPENING.toLog) toLog(k, id);
  }
  while (st.openingI < lines.length) {
    const o = lines[st.openingI];
    const at = st.playAt + o.at;
    if (game.t < at) break;
    say(game, o.line, { at, preroll: !!o.preroll, mission: true });           // the premise is story: it beats scan lines
    st.openingI++;
  }
}

export function endOpening(game, ev = null) {
  const st = game.story;
  const lines = OPENING.lines;
  if ((st.openingI ?? 0) >= lines.length && !ensure(game).queue.some((q) => isOpening(q.id))) return;
  const left = lines.slice(st.openingI ?? 0).map((o) => o.line);
  const k = ensure(game);
  for (const id of left) toLog(k, id);
  st.openingI = lines.length;
  dropQueued(game, lines.map((o) => o.line), ev);
}
const isOpening = (id) => OPENING.lines.some((o) => o.line === id);

/**
 * nextStoryAt(game) → game.t of the next story moment that will want the radio: the opening's next line, or a story
 * mission of this zone that starts by itself (after PLAY or after the arrival). Infinity when none is due.
 */
export function nextStoryAt(game) {
  const st = game.story;
  let at = Infinity;
  const playAt = st.playAt ?? 0;
  const i = st.openingI ?? 0;
  if (game.zoneId === OPENING.zone && i < OPENING.lines.length) at = playAt + OPENING.lines[i].at;
  if (!game.mission) {
    for (const id of zoneOf(game)?.missions || []) {
      const m = missionById(id);
      const a = m?.start?.auto;
      if (!a || game.progress?.missions?.[id]?.done || m.zone !== game.zoneId) continue;
      for (const s of [a.afterPlay, a.orAfterPlay]) {
        if (Number.isFinite(s) && playAt + s > game.t - 0.5) at = Math.min(at, playAt + s);
      }
      if (Number.isFinite(a.afterArrival)) at = Math.min(at, game.arrivalT + a.afterArrival);
    }
  }
  return at;
}

// ---------------------------------------------------------------- the step

const RUNNING = new Set(['running', 'armed', 'restart']);
const LIVE = new Set(['drive', 'ended', 'zoom', 'runup', 'punch', 'tunnel', 'dropout']);
const JUMP_MODES = new Set(['runup', 'punch', 'tunnel', 'dropout']);
const HOLD_MODES = new Set(['punch', 'tunnel', 'dropout']);

/**
 * stepTalk(game, dt, ev): game.js's talk slot. Reads this step's events for quiet times and reactions, ends the
 * current line, drops stale ones and starts the next.
 */
export function stepTalk(game, dt, ev) {
  const k = ensure(game);
  const T = game.tune.TALK;
  const t = game.t;
  const st = game.story;
  if (st.playAt == null && game.mode !== 'title') st.playAt = t - H;

  // This step's events: quiet times and reactions.
  if (ev && ev.list) {
    let i = ev.n - 1;
    while (i >= 0 && ev.list[i] && ev.list[i].t === t) i--;
    for (let j = i + 1; j < ev.n; j++) react(game, k, ev.list[j], T);
  }

  if (game.mode !== 'title') stepOpening(game);

  // The jump's lines (Dot's, at most three a jump; jump.js queues them in game.jump.say) are taken from the front in
  // the run-up, punch, tunnel and drop-out. After the arrival (game.jump is null) any still waiting go to the log.
  const J = game.jump;
  if (J && Array.isArray(J.say) && JUMP_MODES.has(game.mode)) {
    while (J.say.length) say(game, J.say.shift(), { pri: 2, jump: true });
  } else if (!J && k.queue.some((q) => q.jump)) {
    for (let j = k.queue.length - 1; j >= 0; j--) {
      const q = k.queue[j];
      if (!q.jump) continue;
      k.queue.splice(j, 1);
      toLog(k, q.id);
      k.heard[q.id] = t;
      if (ev) ev.push('lineDrop', { id: q.id });
    }
  }

  // The current line ends.
  if (k.cur && t >= k.cur.t0 + k.cur.dur) {
    if (ev) ev.push('lineEnd', { id: k.cur.id });
    k.heard[k.cur.id] = t;
    k.cur = null;
    k.lastEndT = t;
  }

  // Stale lines are dropped: a lower line after TALK.DROP s, a mission line after MISSION_WAIT s, a quiet line at once.
  // Through the punch, the tunnel and the drop-out only the jump's lines play; the others wait, not ageing, for the
  // arrival.
  const inJump = HOLD_MODES.has(game.mode);
  for (let j = k.queue.length - 1; j >= 0; j--) {
    const q = k.queue[j];
    if (inJump && !q.jump && !q.quiet) { q.q = t; if (q.at < t) q.at = t; continue; }
    const waited = t - Math.max(q.at, q.q);
    if (waited > (q.pri <= PRI_MISSION ? MISSION_WAIT : T.DROP) || (q.quiet && waited > 0.5)) {
      k.queue.splice(j, 1);
      toLog(k, q.id);
      k.heard[q.id] = t;
      if (ev) ev.push('lineDrop', { id: q.id });
    }
  }

  if (k.cur || !k.queue.length || !LIVE.has(game.mode)) return;
  if (t < k.quietUntil) return;
  if (game.race && RUNNING.has(game.race.state)) return;
  // Pick: due, then lowest pri, then the oldest. A lower line waits when a story moment (the opening's next line, a
  // mission that starts by itself) is due within the gap, so it never pushes the story back.
  const story = nextStoryAt(game);
  let best = -1;
  for (let j = 0; j < k.queue.length; j++) {
    const q = k.queue[j];
    if (q.at > t + 1e-9) continue;
    if (inJump && !q.jump) continue;
    if (q.pri > PRI_MISSION && story - t < T.GAP && story > t - 0.5) continue;
    if (!q.preroll && t < game.arrivalT + T.ARRIVE_WAIT && game.arrivalT > 0) continue;
    if (!q.preroll && t - k.lastStartT < T.GAP - 1e-9) continue;
    if (best < 0 || q.pri < k.queue[best].pri || (q.pri === k.queue[best].pri && q.at < k.queue[best].at)) best = j;
  }
  if (best < 0) return;
  const q = k.queue.splice(best, 1)[0];
  const line = lineById(q.id);
  const text = fill(line.text, q.vars);
  const slow = !!game.settings?.slowCaptions;
  k.cur = { id: q.id, speaker: line.speaker, text, pri: q.pri, t0: t, dur: lineSeconds(text, slow, q.preroll ? 0.2 : HOLD),
    chunks: chunk(text.toUpperCase()), preroll: q.preroll };
  if (!q.preroll) k.lastStartT = t;
  if (ev) ev.push('line', { id: q.id, speaker: line.speaker, text, pri: q.pri });
}

// Quiet times and the reactions (12.3): the edge line, Redshift's takedown and first gold.
function react(game, k, e, T) {
  const type = e.type;
  if (QUIET_TYPES.has(type) || (type === 'scrape' && !e.pebble)) {
    k.quietUntil = Math.max(k.quietUntil, game.t + T.QUIET);
  }
  if (type === 'arrive') {
    // A new place: what the last one was waiting to say goes to the log. The jump's lines stay, and so do story
    // beats queued for this place (a story line about the zone you just left never plays in the next one).
    for (let j = k.queue.length - 1; j >= 0; j--) {
      const q = k.queue[j];
      if (q.jump || (q.story && (!q.zone || q.zone === e.zone || e.pocket))) continue;
      k.queue.splice(j, 1);
      toLog(k, q.id);
      k.heard[q.id] = game.t;
    }
  } else if (type === 'edgeTurn') {
    const r = REACTIONS.edgeTurn;
    say(game, r.line, { once: r.once });
  } else if (type === 'takedown') {
    const r = REACTIONS.takedown;
    if (!r.zone || r.zone === game.zoneId) say(game, r.line, { once: r.once, at: game.t + T.QUIET });
  } else if (type === 'finish' && (e.medal === 'gold' || e.medal === 'tern') && e.firstGold) {
    const r = REACTIONS.firstGold;
    say(game, r.line, { vars: { short: e.short || '' }, at: game.t + T.QUIET });
  }
}
