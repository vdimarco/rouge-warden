// js/story/content/m_prologue.js : the cold open (C0 in the arena, I0 under the bridge), and the small step
// builders every m_*.js file shares. A MissionDef is plain data (types.js): spawns, steps, fail rules,
// onPass. Every step type and param is in STEP_PARAMS; place ids come from world/places.js.
//
// Step params this content uses beyond their names in STEP_PARAMS (for the MISSIONS engine):
// - photo: subject is a spawn id, a cast id, a place id, or 'crew' / 'any'; kind 'face' | 'place' | 'any' |
//   'timer' (prop the phone, a 10 s timer, run into the frame); store names a flag that gets the photo id;
//   slot fills an evidence slot; window is the seconds the subject stays in view; match a place whose
//   reference the photo must match (6 m, 12 degrees).
// - stealth.guards and interact.watchers: spawn ids, or {spawn, flashlight}. to: a place or {x, z}.
// - chase.goal: 'disable' (hits or a PIT stop the target), 'stop' (follow the protected target until it
//   stops; E4: any contact above maxContact m/s fails), 'takedown' (a foe on foot: catch and down him).
// - fight.until: 'half' (the boss reaches 50 %: F3's Rattler) or 'finisher' (the boss falls; the mission
//   plays its finisher cine next and ties him). fight.pickups: [{weapon, uses, pos}].
// - defend.protect: {place | pos, hp, label}. escort.cover: points; escort.followers: spawn ids, or 'seats'
//   for the people in the van's seats (a drive escort).
// - collect.items: [{id, pos | place, label, line?, subject?, slot?}]; with photo:true each item is a photo.
// - set.seats: [{seat, who}] (who: a cast id or 'civ'); set.spawn / set.despawn: spawn ids.
// - STEP_COMMON fail: 'skip' makes a timeLimit (or a missed optional photo) skip the step, not fail it.
// - qa: the autopilot hint; budget (on a MissionDef): stepped seconds story.mjs allows.

// ---------- shared step builders ----------
export const talk = (...lines) => ({ type: 'talk', lines });
export const subs = (...lines) => ({ type: 'talk', lines, block: false });
export const cine = (id) => ({ type: 'cine', id });
export const intro = (cineId) => (cineId ? { type: 'script', fn: 'intro', args: { cine: cineId } } : { type: 'script', fn: 'intro' });
export const script = (fn, args, extra) => ({ type: 'script', fn, ...(args ? { args } : {}), ...(extra || {}) });
export const enter = (vehicle = 'van', o = {}) => ({ type: 'enter', vehicle, objective: o.objective || 'Get in the van.', ...o });
export const exit = (objective = 'Stop and get out.') => ({ type: 'exit', objective });
export const drive = (to, objective, o = {}) => ({ type: 'drive', to, objective, r: 12, ...o });
export const go = (to, objective, o = {}) => ({ type: 'goto', to, objective, ...o });

// ---------- C0 The Bear Yields ----------
export const c0 = {
  id: 'c0', chapter: 'c0', title: 'The Bear Yields', cast: ['gabe', 'bear', 'ronin'], budget: 45,
  steps: [cine('c0')],
};

// ---------- I0 Under the Bridge ----------
export const i0 = {
  id: 'i0', chapter: 'i0', title: 'Under the Bridge', cast: ['gabe', 'tanktop', 'fifty', 'shades', 'newbalance', 'redjersey'], budget: 50,
  steps: [cine('i0')],
};

export const MISSIONS = { c0, i0 };
