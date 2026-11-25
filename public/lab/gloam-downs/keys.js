// Gloam Downs: the lasting keys and the hidden ground (gloam-downs-growth design.md "Keys and hidden ground"). Crow step (from the
// Rookchief of The Crow Wall) gives a second jump in the air; Bell drop (from the Bellwether of The Bell Knoll) lets a plunge that
// falls 2 m or more crack a sealed stone. Each place has ledges that only the second jump reaches and sealed stones, and each holds a
// cache that opens once a run. The spots come from qa/lab/gloam-downs-ledges.mjs, which plays the controller from each spot's `from`
// with the inputs kept here (`way`) and keeps only the spots the key opens and nothing else does. No DOM.
// The second jump sets the body's vy; play.js integrates it as it does a jump, so the controller does not change.
import { LAMP_KEYS, LAMP_KEY_IDS, PRIZES } from './growth.js';
import { emit } from './bus.js';

export const keyOf = id => LAMP_KEYS.find(k => k.id === id) || null;
export const hasKey = (rs, id) => (rs?.keys || []).includes(id);
// the rules: a cache's touch (m) and rise, the glim of a glim cache before the Ember factor, the reach of a stone round the landing
export const KEY_RULES = { touch: 1.0, rise: 1.3, stone: 1.3 };

/* the spots of each place: { id, kind: 'ledge' | 'stone', at: [x, y, z] (the cache), from: [x, y, z] (where the way starts), way: the
   inputs the scan played from there, prize, n (glim) }. Written by qa/lab/gloam-downs-ledges.mjs --write; check with it after a rebake */
export const SPOTS = {"gaol":[{"id":"gaol-ledge1","kind":"ledge","at":[7,9.38,25],"from":[7,7.49,26.2],"way":{"run":0.3,"hold":0.5,"leapAt":0.2},"prize":"glim","n":25},{"id":"gaol-ledge2","kind":"ledge","at":[6.5,7.32,-17],"from":[6.5,5.09,-15.2],"way":{"run":0.3,"hold":0.5,"leapAt":0.2},"prize":"spark","n":30},{"id":"gaol-stone3","kind":"stone","at":[-2.3,4.21,-27],"from":[-3,7.98,-27],"way":{"run":0,"hold":0.4,"leapAt":9,"plungeAt":0.28},"prize":"glim","n":35}],"ramparts":[{"id":"ramparts-ledge1","kind":"ledge","at":[-3,4.77,23],"from":[-3,2.81,24.8],"way":{"run":0,"hold":0.5,"leapAt":0.2},"prize":"pattern","n":25},{"id":"ramparts-ledge2","kind":"ledge","at":[-22,1.78,-28],"from":[-22,0.04,-26.2],"way":{"run":0.3,"hold":0.5,"leapAt":0.2},"prize":"glim","n":30},{"id":"ramparts-stone3","kind":"stone","at":[-10.5,1.77,-19.3],"from":[-10.5,4.13,-20],"way":{"run":0,"hold":0.4,"leapAt":9,"plungeAt":0.28},"prize":"flask","n":35}],"fen":[{"id":"fen-ledge1","kind":"ledge","at":[13.5,1.67,-3.5],"from":[15.16,-0.33,-4.19],"way":{"run":0,"hold":0.5,"leapAt":0.2},"prize":"ability","n":25},{"id":"fen-ledge2","kind":"ledge","at":[-16,1.7,4.5],"from":[-16,-0.5,5.7],"way":{"run":0.3,"hold":0.5,"leapAt":0.2},"prize":"glim","n":30},{"id":"fen-stone3","kind":"stone","at":[-3.8,-0.5,-3.5],"from":[-4.5,0.49,-3.5],"way":{"run":0,"hold":0.4,"leapAt":9,"plungeAt":0.28},"prize":"spark","n":35}],"bells":[{"id":"bells-ledge1","kind":"ledge","at":[4.5,5,0.5],"from":[3.39,3.88,0.04],"way":{"run":0,"hold":0.5,"leapAt":0.2},"prize":"glim","n":25},{"id":"bells-ledge2","kind":"ledge","at":[-5,3.03,6.5],"from":[-5,0.58,5.3],"way":{"run":0.3,"hold":0.5,"leapAt":0.2},"prize":"pattern","n":30},{"id":"bells-stone3","kind":"stone","at":[-3.5,0.63,18.8],"from":[-3.5,1.39,19.5],"way":{"run":0,"hold":0.4,"leapAt":9,"plungeAt":0.28},"prize":"spark","n":35}],"barrows":[{"id":"barrows-ledge1","kind":"ledge","at":[-16.5,4.85,16],"from":[-15.65,2.52,15.15],"way":{"run":0,"hold":0.5,"leapAt":0.2},"prize":"flask","n":25},{"id":"barrows-stone2","kind":"stone","at":[2.49,1.15,18.51],"from":[2,1.93,19],"way":{"run":0,"hold":0.4,"leapAt":9,"plungeAt":0.28},"prize":"glim","n":30}]};

/* the second jump, pure, so the scan and the tests play the same rule: in the air, from 0.1 s after the take-off or the fall, on a fresh
   press of Jump, once until the feet land. st: { used, was } kept by the caller. -> true when it jumped */
export function leap(s, st, jump, K = keyOf('leap')) {
  if (s.ground) st.used = false;
  const press = !!jump && !st.was;
  st.was = !!jump;
  if (s.ground || st.used || !press || s.airTime < K.after) return false;
  s.vy = K.v;
  st.used = true;
  s.events?.push('jump');
  return true;
}

/* makeKeys(R) -> { step(act, ev), eliteOut(place, ev), view() }. makeRunner (run.js) calls it when the page or the bot passes
   `keys: makeKeys`. prize(R, kind, at, ev) is the run's own (run.js gives the rules for each prize) */
export function makeKeys(R) {
  const rs = R.rs, K = { st: { used: false, was: false } };
  const spots = () => SPOTS[rs.run?.place] || [];
  K.step = (act, ev) => {
    const run = rs.run;
    if (!run || R.dead) return ev;
    const s = R.fighter.body.s, f = R.fighter.f;
    // Crow step: only out of no move (a cut in the air or a plunge keeps its own fall)
    if (hasKey(rs, 'leap') && !f.move) leap(s, K.st, act.jump);
    else { if (s.ground) K.st.used = false; K.st.was = !!act.jump; }
    for (const sp of spots()) {
      if ((run.caches || []).includes(sp.id)) continue;
      const d = Math.hypot(s.x - sp.at[0], s.z - sp.at[2]), dy = Math.abs(s.y - sp.at[1]);
      if (sp.kind === 'ledge' && d <= KEY_RULES.touch && dy <= KEY_RULES.rise && s.ground) open(sp, ev);
    }
    // Bell drop: a plunge that fell 2 m or more lands on a sealed stone and cracks it open
    for (const e of ev) {
      if (e.type !== 'cue' || e.cue !== 'land' || !(e.fallen >= keyOf('drop').fall) || !hasKey(rs, 'drop')) continue;
      for (const sp of spots()) if (sp.kind === 'stone' && !(run.caches || []).includes(sp.id) && Math.hypot(s.x - sp.at[0], s.z - sp.at[2]) <= KEY_RULES.stone && Math.abs(s.y - sp.at[1]) <= 1) open(sp, ev);
    }
    return ev;
  };
  function open(sp, ev) {
    const run = rs.run;
    (run.caches ||= []).push(sp.id);
    if (run.entry) run.entry.caches = run.caches.slice();
    const what = R.prize ? R.prize(sp.prize, sp.at, ev, sp) : null;
    ev.push({ type: 'cache', spot: sp.id, kind: sp.kind, prize: sp.prize, what }, { type: 'store' });
    ev.push({ type: 'cue', cue: sp.kind === 'stone' ? 'cracks' : 'wisp', cache: sp.id });
    emit('cache-open', { spot: sp.id, prize: sp.prize, kind: sp.kind });
  }
  // a fixed elite's first fall in any run gives its key, saved at once
  K.eliteOut = (place, ev) => {
    const k = LAMP_KEYS.find(x => x.from === place);
    if (!k || hasKey(rs, k.id)) return null;
    rs.keys = [...new Set([...(rs.keys || []), k.id])].filter(id => LAMP_KEY_IDS.includes(id));
    R.notes.push(`A key: <b>${k.name}</b>. ${k.text[0].toUpperCase()}${k.text.slice(1)}.`);
    ev.push({ type: 'key', id: k.id }, { type: 'store' });
    emit('key-found', { id: k.id });
    return k.id;
  };
  K.view = () => ({ keys: (rs.keys || []).slice(), caches: (rs.run?.caches || []).slice() });
  return K;
}
// what the fight draws: each spot of the place not yet opened this run, and whether its key is held
export const groundSpots = R => {
  const rs = R?.rs, run = rs?.run;
  if (!run) return [];
  return (SPOTS[run.place] || []).filter(sp => !(run.caches || []).includes(sp.id)).map(sp => ({ ...sp, open: hasKey(rs, sp.kind === 'ledge' ? 'leap' : 'drop') }));
};
// the pause panel's line: the keys held
export const keysLine = rs => {
  const held = LAMP_KEYS.filter(k => hasKey(rs, k.id));
  return held.length ? `Keys: ${held.map(k => k.name).join(' · ')}` : 'Keys: none yet. Two elites hold them.';
};
export { PRIZES };
