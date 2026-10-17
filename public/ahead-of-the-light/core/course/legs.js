// Ahead of the Light: the route and its leg types as data (final.md 11.1, 11.2, 11.3, 11.9), the lane kinds' edits and
// the lane conditions. Orion's opener and build are its skins of easy-knots and hub-hop (young-stars, betelgeuse); the
// neighbours' are the Pleiades and Sirius. gen.js reads this; later pieces plug in by id, and a pool entry whose piece
// is not written yet is skipped (a section whose whole pool is missing falls back to a common piece). Pure.
//
// A section is [role, beats, pool, opts]: beats is a number or 'rest' (it takes what the others leave); pool is a
// list of piece ids, or [id, weight] (a leg's own piece has weight 2), or 'lane' (the lane's signature). A section
// whose pool has no written piece falls back to FALLBACK[role] (so legs 3 to 8 build before their pieces exist). opts:
// { count } pieces in the section, { density } for density-aware pieces, { well } for a swarm with a small well.

export const ROUTE = Object.freeze(['web', 'coma', 'virgo', 'local', 'milkyway', 'orion', 'neighbours', 'earth']);

// The piece a section falls back to while none of its pool is written.
export const FALLBACK = Object.freeze({ opener: 'easy-knots', build: 'easy-knots', signature: 'easy-knots',
  breather: 'breather', open: 'open-road', crescendo: 'swarm', moon: 'breather', void: 'swarm', gate: 'gate-plain' });

// The common pieces legs 3 to 7 also draw their opener and build from, in the leg's skin (11.9).
export const COMMON_FLOW = Object.freeze(['easy-knots', 'sheets', 'highway', 'hub-hop', 'web-junction']);

const deep = (o) => {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const k of Object.keys(o)) deep(o[k]);
  }
  return o;
};
const flow = (own) => [...own, ...COMMON_FLOW.filter((id) => !own.some((o) => (Array.isArray(o) ? o[0] : o) === id))];

// A lane: id (the chart's and the URL's handle), kind, and its signature: piece (one, or a list to choose one from)
// or seq (several in order). x: the leg's length multiplier; drop: sections the lane removes; sig: 'rest' when the
// signature takes the slack.
const lane = (id, kind, sig, extra = {}) => ({ id, kind, piece: sig, ...extra });

// key: the index into CHAPTER_KEYS (0 D minor, 1 F major, 2 A major, 3 D major).
export const LEG_TYPES = deep({
  web: {
    name: 'THE WEB', gate: 'gate-coma', beats: 96, key: 0, act: 1, cap: 8, mass: 1.0, fuel: 1, patch: false,
    field: { regulars: 3, drifters: 3, boss: null }, passes: 80, skin: 'web',
    sections: [['launch', 6], ['opener', 16, ['web-first-knots', ['web-strands', 2], 'easy-knots']],
      ['build', 16, ['first-well', ['web-junction', 2], 'highway', 'sheets'], { count: 2 }],
      ['signature', 16, 'lane'], ['breather', 6, ['breather']], ['crescendo', 'rest', ['swarm'], { density: 0.8 }],
      ['gate', 14, ['gate-coma']]],
    lanes: { 'THE FILAMENT': lane('filament', 'fixed', ['web-node', 'web-rail-plan']) },
  },
  coma: {
    name: 'COMA', gate: 'gate-virgo', beats: 120, key: 0, act: 1, cap: 7, mass: 0.94, fuel: 3, patch: true,
    field: { regulars: 3, drifters: 3, boss: null }, passes: 115, skin: 'coma',
    sections: [['launch', 6], ['opener', 14, [['coma-outskirts', 2], 'easy-knots', 'sheets']],
      ['build', 16, ['hub-hop', 'sheets', 'highway']], ['signature', 16, 'lane'], ['breather', 6, ['breather']],
      ['open', 14, ['rumble', 'open-road']], ['crescendo', 'rest', ['swarm'], { density: 1.0 }],
      ['gate', 14, ['gate-virgo']]],
    lanes: { "COMA'S HEART": lane('comas-heart', 'risk', 'coma-jellyfish'),
      'THE GREAT WALL': lane('great-wall', 'family', 'great-wall') },
  },
  virgo: {
    name: 'VIRGO', gate: 'gate-local', beats: 128, key: 1, act: 1, cap: 6, mass: 0.88, fuel: 3, patch: true,
    field: { regulars: 3, drifters: 0, boss: 'whale' }, passes: 105, skin: 'virgo',
    sections: [['launch', 6], ['opener', 14, flow([['hub-hop', 2]])], ['build', 16, flow([['virgo-crowd', 2]])],
      ['signature', 24, 'lane'], ['breather', 4, ['breather']], ['open', 20, ['whale-road']],
      ['crescendo', 'rest', ['swarm'], { density: 1.05, well: 1 }], ['gate', 14, ['gate-local']]],
    lanes: { M87: lane('m87', 'risk', 'm87-jet'), "MARKARIAN'S CHAIN": lane('markarian', 'family', 'markarian') },
  },
  local: {
    name: 'THE LOCAL GROUP', gate: 'gate-milky-way', beats: 136, key: 1, act: 2, cap: 5, mass: 0.83, fuel: 3,
    patch: true, field: { regulars: 3, drifters: 2, boss: null }, passes: 110, skin: 'local',
    sections: [['launch', 6], ['opener', 14, flow([['sheet-void', 2]])], ['build', 16, flow([['hub-hop', 2]])],
      ['signature', 24, 'lane'], ['breather', 4, ['breather']], ['open', 16, ['rumble', 'open-road']],
      ['crescendo', 'rest', ['swarm'], { density: 1.1 }], ['gate', 14, ['gate-milky-way']]],
    lanes: { 'THE LOCAL VOID': lane('local-void', 'void', 'local-void', { x: 0.6 }),
      ANDROMEDA: lane('andromeda', 'risk', 'andromeda'), TRIANGULUM: lane('triangulum', 'family', 'local-stream') },
  },
  milkyway: {
    name: 'THE MILKY WAY', gate: 'gate-orion-arm', beats: 144, key: 2, act: 2, cap: 5, mass: 0.78, fuel: 3,
    patch: true, field: { regulars: 3, drifters: 2, boss: null }, passes: 125, skin: 'milkyway',
    sections: [['launch', 6], ['opener', 14, flow([['disc-entry', 2]])],
      ['build', 16, flow([['sheets', 2], ['hub-hop', 2]])], ['signature', 20, 'lane'], ['breather', 4, ['breather']],
      ['open', 14, ['dust-road']], ['crescendo', 'rest', ['swarm'], { density: 1.15 }],
      ['crescendo', 10, ['arm-funnel'], { density: 1.15 }], ['gate', 14, ['gate-orion-arm']]],
    lanes: { 'THE GALACTIC CENTRE': lane('galactic-centre', 'risk', 'crowded-centre'),
      'THE OUTER DISC': lane('outer-disc', 'family', 'spiral-arms') },
  },
  orion: {
    name: 'ORION', gate: 'gate-bubble', beats: 152, key: 2, act: 2, cap: 5, mass: 0.73, fuel: 3, patch: true,
    field: { regulars: 3, drifters: 0, boss: 'mako' }, passes: 135, skin: 'orion',
    sections: [['launch', 6], ['opener', 14, flow([['young-stars', 2]])], ['build', 16, flow([['betelgeuse', 2]])],
      ['signature', 28, 'lane'], ['breather', 4, ['breather']], ['open', 14, ['open-road']],
      ['crescendo', 'rest', ['mako-field'], { density: 1.15 }], ['gate', 14, ['gate-bubble']]],
    lanes: { 'THE ORION NEBULA': lane('orion-nebula', 'risk', null, { seq: ['nursery', 'trapezium'] }),
      "ORION'S BELT": lane('orions-belt', 'family', 'belt-run') },
  },
  neighbours: {
    name: "THE SUN'S NEIGHBOURS", gate: 'gate-sun', beats: 160, key: 3, act: 3, cap: 4.5, mass: 0.69, fuel: 3,
    patch: true, field: { regulars: 3, drifters: 2, boss: null }, passes: 140, skin: 'neighbours',
    sections: [['launch', 6], ['opener', 16, flow([['pleiades', 2]])], ['build', 16, flow([['sirius', 2]])],
      ['signature', 20, 'lane'], ['breather', 4, ['breather']], ['open', 14, ['open-road']],
      ['crescendo', 'rest', ['swarm'], { density: 1.2 }], ['crescendo', 10, ['oort-comets'], { density: 1.2 }],
      ['gate', 24, ['gate-sun']]],
    lanes: { 'ALDEBARAN AND THE HYADES': lane('hyades', 'risk', 'hyades'),
      'ALPHA CENTAURI': lane('alpha-centauri', 'family', 'alpha-cen') },
  },
  // Earth runs in the order of the planets and is fixed (no pools of three). R9 does not apply: its breather comes
  // before the signature.
  earth: {
    name: 'EARTH', gate: 'landing', beats: 128, key: 3, act: 3, cap: 4.5, mass: 0.65, fuel: 3, patch: true,
    field: { regulars: 3, drifters: 0, boss: 'manta' }, passes: 100, skin: 'earth', fixedRoute: true,
    sections: [['launch', 6], ['opener', 14, ['kuiper']], ['build', 16, ['saturn']], ['breather', 6, ['breather']],
      ['signature', 18, 'lane'], ['crescendo', 'rest', ['asteroids'], { density: 1.1 }],
      ['open', 14, ['inner']], ['moon', 12, ['moon']], ['gate', 12, ['landing']]],
    lanes: { JUPITER: lane('jupiter', 'long', 'jupiter'),
      'THE ASTEROID BELT': lane('asteroid-belt', 'short', 'belt-dense', { x: 0.75, drop: ['open', 'crescendo'],
        sig: 'rest' }) },
  },
});

// What a lane kind does to its leg (11.3). gen.js applies these.
export const LANE_KINDS = deep({
  fixed: { name: 'FIXED' },
  risk: { name: 'RISK', beats: 16, density: 1.25 },        // RISK_BEATS and RISK_DENSITY in tune.js win
  family: { name: 'FAMILY' },
  void: { name: 'VOID' },
  long: { name: 'THE LONG WAY' },
  short: { name: 'THE SHORT WAY' },
});

// A FAMILY lane's edit by family: the build piece it forces, or (RIVAL) more open road and drifters.
export const FAMILY_EDITS = deep({
  SKIM: { piece: 'highway' },
  WELL: { piece: 'hub-hop' },
  SHIP: { piece: 'fuel-run', fuel: 2, patch: true },
  RIVAL: { open: 6, drifters: 2 },
});

// Lane conditions (11.3), rolled by makeChart onto one lane of each leg from leg 3 (never the VOID). Each is a mod on
// the built leg made of kinds and rules that already exist; gen.js applies it before validating. rules: what the
// leg tells handle.js and survival.js (multipliers on the tuning table's values).
export const CONDITIONS = deep({
  dust: { id: 'dust', name: 'DUST', edit: 'dust over the signature and the second half of the crescendo',
    rules: { dustPush: 1.5 } },
  flares: { id: 'flares', name: 'FLARES', edit: 'a third of the swarm knots pulse (half 2 to 5°, period 2 beats)',
    fuel: 3, pulse: { every: 3, half0: 2, half1: 5, period: 2 } },
  rich: { id: 'rich', name: 'RICH', edit: 'fuel slots × 2 and the patch always spawns; density × 1.15',
    fuelX: 2, density: 1.15, rules: { patchAlways: true } },
  headwind: { id: 'headwind', name: 'HEADWIND', edit: 'drag × 1.5; skims × 1.5; a WIDE release loses nothing',
    rules: { dragX: 1.5, skimX: 1.5, wideFree: true } },
  tides: { id: 'tides', name: 'TIDES', edit: 'one extra hub-hop in the build; red zones span 100°, pay × 1.5',
    piece: 'hub-hop', rules: { redSpan: 100, redX: 1.5 } },
});

// The leg's lane, by name or id (case-insensitive), merged with what the chart adds (fam, cond). Without a lane (or
// with one this leg does not have): the leg's first lane that keeps its length (FIXED, FAMILY or the long way), so a
// bare buildLeg({ type }) is the leg as 11.1 measures it.
export function laneOf(type, lane = null) {
  const def = LEG_TYPES[type];
  if (!def) return null;
  const names = Object.keys(def.lanes);
  const plain = names.find((n) => ['fixed', 'family', 'long'].includes(def.lanes[n].kind)) || names[0];
  let name = plain, extra = {};
  if (lane) {
    const want = typeof lane === 'string' ? lane : lane.name || lane.id || '';
    const key = String(want).toLowerCase();
    const id = typeof lane === 'object' && lane.id ? String(lane.id).toLowerCase() : null;
    const hit = names.find((n) => n.toLowerCase() === key || def.lanes[n].id === key || (id && def.lanes[n].id === id));
    if (hit) name = hit;
    if (typeof lane === 'object') extra = lane;
  }
  const L = def.lanes[name];
  return { ...L, name, fam: extra.fam || null, cond: extra.cond || null };
}
