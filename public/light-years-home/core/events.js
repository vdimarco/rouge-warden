// Light Years Home v3: the names of every core event (final.md 5.3) and the one reused buffer the core pushes into.
// Each event is { type, t, ...payload }, t being game.t when it happened. Every type maps to a sound and an effect
// (final.md 14.3); the hook counts the sounds that really started.

export const EV_GROUPS = Object.freeze({
  ship: Object.freeze(['near', 'hairline', 'thread', 'skimStart', 'skimEnd', 'draftStart', 'draftEnd', 'driftStart',
    'driftTier', 'driftBoost', 'driftLost', 'boostStart', 'boostEnd', 'scrape', 'crash', 'bigCrash', 'takedown',
    'sling', 'perfectSling', 'edgeTurn', 'planeChange', 'pad', 'padPerfect', 'spark', 'chainUp', 'chainBank',
    'chainLost']),
  zone: Object.freeze(['ringSeen', 'scanStart', 'scan', 'farScan', 'lookHome', 'rumour', 'secret', 'setItem',
    'setDone', 'exitOpen', 'zoomIn', 'zoomOut', 'scaleCard', 'arrive']),
  events: Object.freeze(['eventSeen', 'eventArm', 'eventStart', 'gate', 'gateMiss', 'split', 'lap', 'finish', 'cancel',
    'restart', 'toGate', 'stuntStart', 'stuntResult']),
  missions: Object.freeze(['missionOffer', 'missionStart', 'beat', 'cargoHit', 'cargoBreak', 'hook', 'release', 'fail',
    'retry', 'skipOffer', 'missionDone', 'fix']),
  talk: Object.freeze(['line', 'lineEnd', 'lineDrop', 'lineSkip']),
  jump: Object.freeze(['runupRing', 'runupMiss', 'punch', 'jGraze', 'jHairline', 'jThread', 'jPad', 'jSkim', 'jHit',
    'nine', 'headlight', 'fork', 'setPiece', 'earthCard', 'vista', 'drop', 'longHaul', 'jumpMedal']),
  game: Object.freeze(['mode', 'pause', 'resume', 'chapterEnd']),
});

// EV.near === 'near', and so on for every type. Use EV.x in code so a typo fails at the push.
export const EV = Object.freeze(Object.fromEntries(Object.values(EV_GROUPS).flat().map((name) => [name, name])));
export const EV_LIST = Object.freeze(Object.keys(EV));
const KNOWN = new Set(EV_LIST);
export const isEvent = (type) => KNOWN.has(type);

// The reused buffer. The core sets buf.t before a step; push(type, payload) adds { type, t, ...payload }.
// Readers loop i < buf.n over buf.list. clear() empties it without freeing the list. It grows past cap when a
// caller steps for a long time without clearing, up to MAX, and counts what it had to drop after that.
const MAX = 65536;

export function createEventBuffer(cap = 256) {
  const buf = {
    list: new Array(Math.max(1, cap | 0)).fill(null),
    n: 0,
    t: 0,
    dropped: 0,
    push(type, payload) {
      if (!KNOWN.has(type)) throw new Error(`unknown event type: ${type}`);
      if (buf.n >= buf.list.length) {
        if (buf.list.length >= MAX) { buf.dropped++; return null; }
        buf.list.length = Math.min(MAX, buf.list.length * 2);
      }
      const e = payload ? Object.assign({ type, t: buf.t }, payload) : { type, t: buf.t };
      e.type = type;
      buf.list[buf.n++] = e;
      return e;
    },
    clear() {
      for (let i = 0; i < buf.n; i++) buf.list[i] = null;
      buf.n = 0;
      buf.dropped = 0;
    },
    // The events of one type pushed since the last clear (for tests and the hook).
    count(type) {
      let c = 0;
      for (let i = 0; i < buf.n; i++) if (buf.list[i].type === type) c++;
      return c;
    },
    // A plain array copy of the last n events (for the hook and tests).
    last(n = buf.n) {
      return buf.list.slice(Math.max(0, buf.n - n), buf.n);
    },
  };
  return buf;
}
