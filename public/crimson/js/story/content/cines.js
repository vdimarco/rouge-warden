// js/story/content/cines.js : the story's cut scenes as CineDefs (types.js), played by MISSIONS' cine.js.
//
// Points (shot from/to/look, fx pos, place and moveTo args):
//   {x, y, z}               a world point; y is above the ground there (0 on the ground)
//   {place, x, y, z}        offset from a place id (world axes), y above the ground at the place
//   {who, x, y, z}          offset in an actor's frame (x right, y up, z forward); who is a cast name of this
//                           cine, a CAST id, 'hero', 'pick' (the player's friend), 'van' or 'crew'
//   {bridge: true, y}       the bridge: the arena's silhouette in an arena cine, Midgley deck elsewhere
// Actor cues: play {clip, loop, speed, at}; moveTo {to: point, speed}; face {to: point}; pose {name, k};
//   prop {name, on, bone}; show {replace, at: point, yaw}; hide; glow {k}; drain {k, dur}; place {at, yaw}.
// cast: {name: castId | {id, at, yaw, props, variant, costume}}. A cast id that is the hero's body uses the
//   hero's actor. 'pick' spawns the player's friend (a crew id picked at run time).
// Lines are subtitles on the cine's clock (block:false); cards are UI cards; looks tween S.look.
// film: plays through S.film; the other tracks run anyway, so the engine flash and kneel under it are the
//   fallback when the film cannot play (no codec, 404, not buffered in 1.5 s).
// end: applied when the cine ends or is skipped (hold skip 0.8 s): actor poses and places, hero, van, look.
// Framing rules (design 2.2): the held people are framed wide and from outside, never as a spectacle.

const P = (place, x = 0, y = 0, z = 0) => ({ place, x, y, z });
const W = (who, x = 0, y = 0, z = 0) => ({ who, x, y, z });
const shot = (at, dur, from, to, look, fov = 50, o = {}) => ({ at, dur, from, to, look, fov, ease: 'inOut', ...o });
const line = (at, id) => ({ at, who: '', line: id, block: false });
const card = (at, kind, title, sub, kanji) => ({ at, kind, title, ...(sub ? { sub } : {}), ...(kanji ? { kanji } : {}) });
const act = (at, who, d, args) => (args === undefined ? { at, who, do: d } : { at, who, do: d, args });

// the five under the abutment (I0 to I5): where each friend stands at the wash, and Gabe beside them
const UNDER = {
  tanktop: { id: 'tanktop', at: P('wash', -2.2, 0, 1.2), yaw: 1.1 }, fifty: { id: 'fifty', at: P('wash', -1.2, 0, 2.0), yaw: 1.4 },
  shades: { id: 'shades', at: P('wash', -0.4, 0, 0.6), yaw: 1.7 }, newbalance: { id: 'newbalance', at: P('wash', -2.6, 0, -0.4), yaw: 1.2 },
  redjersey: { id: 'redjersey', at: P('wash', -1.5, 0, -1.0), yaw: 1.5 }, gabe: { id: 'gabe', at: P('wash', 1.4, 0, 0.8), yaw: -1.6 },
};
const underShots = (dur) => [
  shot(0, dur * 0.4, P('wash', -7, 1.1, 5), P('wash', -6, 1.3, 3.5), P('wash', 0, 1.4, 0.5), 44),
  shot(dur * 0.4, dur * 0.3, W('gabe', 0.7, 1.7, 2.6), W('gabe', 0.5, 1.65, 2.2), W('gabe', 0, 1.62, 0), 34),
  shot(dur * 0.7, dur * 0.3, P('wash', 3.5, 1.5, -4), P('wash', 3.2, 1.6, -3.4), P('wash', -1.4, 1.4, 0.8), 40),
];
// an interlude: the time card, the five and Gabe under the bridge, a flashlight above, the lines
function interlude(id, time, lines, extra = {}) {
  const dur = Math.max(10, 3 + lines.length * 3.2 + 1.5);
  return {
    id, look: 'NIGHT', dur, cast: UNDER,
    cards: [card(0, 'time', `SUNDAY · ${time}`, 'UNDER MIDGLEY BRIDGE')],
    shots: underShots(dur),
    actors: [act(0, 'gabe', 'pose', { name: 'crouch', k: 1 }), act(0, 'fifty', 'pose', { name: 'crouch', k: 1 }), act(dur - 1, 'gabe', 'pose', { name: 'talk', k: 0.5 })],
    lines: lines.map((l, i) => line(2.5 + i * 3.2, l)),
    fx: [{ at: 1.5, kind: 'flashlight', pos: { bridge: true, y: 1 } }],
    sfx: [{ at: 0.4, name: 'crickets' }],
    end: { look: 'NIGHT' },
    ...extra,
  };
}
// a chapter intro: an establishing crane over the start place, then down to the hero
function introCine(id, place, look, o = {}) {
  return {
    id, look, dur: o.dur || 7,
    shots: [
      shot(0, 4, P(place, o.dx ?? -40, 26, o.dz ?? 40), P(place, (o.dx ?? -40) * 0.6, 14, (o.dz ?? 40) * 0.6), P(place, 0, 2, 0), 55),
      shot(4, (o.dur || 7) - 4, W('hero', 1.2, 2.0, -4.5), W('hero', 0.9, 1.8, -3.6), W('hero', 0, 1.5, 2), 50),
    ],
    lines: (o.lines || []).map((l, i) => line(1 + i * 3, l)),
    ...(o.extra || {}),
  };
}

export const CINES = {
  /* ---------------- C0 The Bear Yields (the arena) ---------------- */
  c0: {
    id: 'c0', arena: true, look: 'ARENA', dur: 28,
    cast: { pick: { id: 'pick', costume: true } },
    film: { at: 1.2, src: 'clips/yield' }, // H2: the bear sinks into ink smoke; the engine flash and kneel below are the fallback
    shots: [
      shot(0, 1.2, W('gabe', 3.6, 2.4, 5.2), W('gabe', 3.0, 2.0, 4.4), W('gabe', 0, 1.3, 0), 46, { ease: 'out' }),
      shot(1.2, 5, W('ronin', 1.3, 1.9, -3.6), W('ronin', 0.9, 1.7, -2.8), W('gabe', 0, 0.9, 0), 42),
      shot(6.2, 1.8, W('gabe', 0.9, 1.1, 1.8), W('gabe', 0.6, 1.05, 1.5), W('gabe', 0, 1.0, 0), 32),
      shot(8, 2.5, W('ronin', 0.55, 1.05, 0.95), W('ronin', 0.45, 0.95, 0.8), W('ronin', 0.3, 0.85, 0.55), 28),
      shot(10.5, 4.5, W('gabe', -0.9, 1.35, 2.0), W('gabe', -0.8, 1.4, 1.8), W('ronin', 0, 1.62, 0), 36),
      shot(15, 2.5, W('pick', 0.8, 1.6, -1.6), W('pick', 0.7, 1.6, -1.4), W('gabe', 0, 1.0, 0), 38),
      shot(17.5, 4, W('gabe', 0.6, 1.2, -2.2), W('gabe', 0.3, 1.0, -2.6), { bridge: true, y: 4 }, 48, { shake: 0.15 }),
      shot(21.5, 3.5, W('gabe', 2.4, 0.9, 1.4), W('gabe', 2.2, 0.8, 1.2), W('gabe', 0, 0.8, 0), 44),
      shot(25, 3, W('gabe', 4, 3, 4), W('gabe', 5, 5, 5), { bridge: true, y: 10 }, 50),
    ],
    actors: [
      act(0, 'bear', 'play', { clip: 'bear:dead', at: 0.9, speed: 0 }), // bear form: 'dead' held at 0.9 s
      act(0, 'gabe', 'play', { clip: 'gabe:hit', speed: 0.35 }), // human form: from 'hit' into the kneel
      act(1.2, 'bear', 'hide'),
      act(1.2, 'gabe', 'show'),
      act(1.25, 'gabe', 'pose', { name: 'kneel', k: 1 }),
      act(1.4, 'gabe', 'drain', { k: 1, dur: 2 }), // the neon drains from Gabe over 2 s (B10)
      act(7.8, 'ronin', 'prop', { name: 'foamKatanaBent', on: true, bone: 'RightHand' }), // the katana is foam, and bent
      act(12.0, 'pick', 'show', { replace: 'ronin' }), // D3: the ronin's face is the pick's; his kasa is off, slung on his back (the arena ronin wears only a headband, so no second hat goes on it)
      act(12.4, 'pick', 'face', { to: W('gabe') }),
      act(14.6, 'gabe', 'pose', { name: 'talk', k: 0.6 }),
      act(19.2, 'gabe', 'pose', { name: 'crouch', k: 1 }),
      act(19.6, 'pick', 'pose', { name: 'crouch', k: 1 }),
    ],
    lines: [line(9.6, 'c0.swing'), line(12.8, 'c0.gabe'), line(15.2, 'c0.buddy'), line(19.4, 'c0.down'), line(22.2, 'c0.voice')],
    fx: [
      { at: 1.2, kind: 'flash' }, { at: 1.3, kind: 'ink', pos: W('gabe', 0, 0.5, 0) },
      { at: 17.5, kind: 'headlights', pos: { bridge: true, y: 1 } },
    ],
    sfx: [{ at: 1.2, name: 'yield' }, { at: 17.4, name: 'engine' }, { at: 22.1, name: 'doorClose' }],
    cards: [card(25, 'time', 'SUNDAY · 3:12 AM', 'UNDER MIDGLEY BRIDGE')],
    end: { actors: { gabe: { pose: 'crouch' } }, look: 'NIGHT' },
  },

  /* ---------------- I0 Under the Bridge ---------------- */
  i0: {
    id: 'i0', look: 'NIGHT', dur: 34, cast: UNDER,
    cards: [card(0, 'time', 'SUNDAY · 3:12 AM', 'UNDER MIDGLEY BRIDGE'), card(29, 'title', 'HOW DID WE GET HERE', 'THURSDAY. THREE DAYS EARLIER.', '回想')],
    shots: [
      shot(0, 5, P('wash', -9, 0.8, 7), P('wash', -7.5, 1.0, 5.5), { bridge: true, y: 0 }, 50),
      shot(5, 6, W('gabe', 0.7, 1.7, 2.6), W('gabe', 0.5, 1.65, 2.1), W('gabe', 0, 1.62, 0), 34),
      shot(11, 8, P('wash', 3.8, 1.5, -4.2), P('wash', 3.2, 1.5, -3.6), P('wash', -1.4, 1.3, 0.8), 42),
      shot(19, 5, W('tanktop', 0.6, 1.7, 2.2), W('tanktop', 0.5, 1.7, 2.0), W('tanktop', 0, 1.65, 0), 34),
      shot(24, 5, W('pick', 0.4, 1.7, 1.8), W('pick', 0.3, 1.68, 1.4), W('pick', 0, 1.64, 0), 30),
      shot(29, 5, P('wash', -6, 1.2, 6), P('wash', -12, 6, 12), { bridge: true, y: 6 }, 50),
    ],
    actors: [
      act(0, 'gabe', 'pose', { name: 'crouch', k: 1 }), act(0, 'tanktop', 'pose', { name: 'crouch', k: 1 }), act(0, 'fifty', 'pose', { name: 'crouch', k: 1 }),
      act(3, 'gabe', 'pose', { name: 'talk', k: 0.6 }), act(6, 'fifty', 'pose', { name: 'talk', k: 0.5 }), act(19, 'tanktop', 'pose', { name: 'handsOpen', k: 1 }),
    ],
    lines: [line(3, 'i0.cost'), line(6.2, 'i0.what'), line(8.8, 'i0.first'), line(10.6, 'i0.why'), line(14.2, 'i0.three'), line(16.6, 'i0.ronin'), line(19.2, 'i0.dark'), line(24.4, 'i0.vo')],
    fx: [{ at: 1, kind: 'flashlight', pos: { bridge: true, y: 1 } }],
    looks: [{ at: 31, set: 'MEMORY', dur: 2.5 }],
    sfx: [{ at: 0.2, name: 'crickets' }],
    end: { look: 'MEMORY' },
  },

  /* ---------------- I1-I5 Under the Bridge ---------------- */
  i1: interlude('i1', '3:14 AM', ['i1.fleet', 'i1.keep']),
  i2: interlude('i2', '3:18 AM', ['i2.delete', 'i2.post']),
  i3: interlude('i3', '3:22 AM', ['i3.foam', 'i3.ring', 'i3.back']),
  i4: interlude('i4', '3:26 AM', ['i4.box', 'i4.what'], {
    actors: [act(0, 'gabe', 'pose', { name: 'crouch', k: 1 }), act(0, 'fifty', 'pose', { name: 'crouch', k: 1 }), act(2, 'fifty', 'pose', { name: 'knocked', k: 0 })],
    fx: [{ at: 1.2, kind: 'flashlight', pos: P('wash', -1.2, 0.2, 2.9) }], // it stops a metre from Fifty-One's hand
  }),
  i5: interlude('i5', '3:30 AM', ['i5.leave', 'i5.back', 'i5.sorry', 'i5.foam', 'i5.longer'], { sfx: [{ at: 0.5, name: 'engine' }], looks: [] }),

  /* ---------------- chapter intros ---------------- */
  f1_intro: introCine('f1_intro', 'canyon_fleet', 'MEMORY', { dx: -30, dz: 50 }),
  f2_intro: introCine('f2_intro', 'blush_depot', 'MEMORY', { dx: 30, dz: 30 }),
  f3_intro: introCine('f3_intro', 'aframe', 'MEMORY_NIGHT', { dx: -20, dz: 25, extra: { actors: [act(0, 'crew', 'prop', { name: 'kasa', on: true })] } }),
  f4_intro: introCine('f4_intro', 'f4_van_creek', 'HANGOVER', { dx: 18, dz: -14, dur: 8 }),
  f5_intro: introCine('f5_intro', 'bar_lot', 'MEMORY', { dx: 25, dz: 20 }),
  p1_intro: introCine('p1_intro', 'midgley_lot', 'NIGHT', { dx: -30, dz: 30 }),
  p2_intro: introCine('p2_intro', 'diner', 'DAY', { dx: 30, dz: 30 }),
  p3_intro: introCine('p3_intro', 'sunline_plaza', 'DAY', { dx: 30, dz: 35 }),
  p4_intro: introCine('p4_intro', 'p3_watch', 'DAY', { dx: -25, dz: 30 }),
  p5_intro: introCine('p5_intro', 'hart_ridge', 'DUSK', { dx: -40, dz: 20 }),
  p6_intro: introCine('p6_intro', 'aframe', 'NIGHT', { dx: -22, dz: 18 }),
  p7_intro: introCine('p7_intro', 'cathedral', 'DAY', { dx: -60, dz: -60 }),
  p8_intro: introCine('p8_intro', 'gas', 'DAY', { dx: 30, dz: 30 }),
  p9_intro: introCine('p9_intro', 'diner', 'NIGHT', { dx: -30, dz: 25 }),
  p10_intro: introCine('p10_intro', 'hart_ranch', 'NIGHT', { dx: -50, dz: -60 }),
  p11_intro: introCine('p11_intro', 'p11_yard', 'DEEP_INK', { dx: 20, dz: 20 }),
  p12_intro: introCine('p12_intro', 'p10_gate', 'NIGHT', { dx: -25, dz: 20 }),
  e1_intro: introCine('e1_intro', 'wedding', 'DAY', { dx: -40, dz: 30, dur: 8 }),

  /* ---------------- F3: the shove, the first vortex sight, the lights ---------------- */
  f3_shove: {
    id: 'f3_shove', look: 'INTERIOR', dur: 17,
    cast: { rattler: { id: 'rattler', at: { x: -896, y: -300, z: 897 }, yaw: 3.1 }, fifty: { id: 'fifty', at: { x: -898, y: -300, z: 899.5 }, yaw: 0.2 } },
    shots: [
      shot(0, 4, W('rattler', 1.8, 1.6, 2.6), W('rattler', 1.4, 1.6, 2.2), W('rattler', 0, 1.2, 0), 40),
      shot(4, 3.5, W('fifty', -1.2, 1.7, 2.0), W('fifty', -1.0, 1.7, 1.8), W('rattler', 0, 1.6, 0), 36),
      shot(7.5, 2, W('fifty', 0.4, 0.3, 1.4), W('fifty', 0.6, 0.25, 2.4), W('fifty', 0.4, 0.05, 2.8), 40),
      shot(9.5, 4.5, W('rattler', -2.2, 1.8, 3.2), W('rattler', -2.6, 2.0, 3.6), W('rattler', 0, 1.2, 0), 44),
      shot(14, 3, W('hero', 1.5, 1.8, -3), W('hero', 1.2, 1.7, -2.5), W('rattler', 0, 1.5, 0), 48),
    ],
    actors: [
      act(0, 'rattler', 'play', { clip: 'idle' }), act(5, 'rattler', 'play', { clip: 'gabe:punches' }),
      act(5.4, 'fifty', 'pose', { name: 'knocked', k: 1 }), act(7.2, 'fifty', 'pose', { name: 'knocked', k: 0 }),
      act(7.5, 'fifty', 'prop', { name: 'ringBox', on: false }),
      act(11, 'rattler', 'prop', { name: 'ringBox', on: true, bone: 'LeftHand' }), // the crimson box moves into his hand
    ],
    lines: [line(0.8, 'f3.cheat'), line(3.6, 'f3.samurai'), line(5.6, 'f3.ronin'), line(7.6, 'f3.ring'), line(14.2, 'f3.get')],
    looks: [{ at: 9.5, set: 'VORTEX', dur: 1.2 }], // the first vortex sight: ink, neon stripes, one crimson box
    sfx: [{ at: 5.3, name: 'bump' }],
    end: { look: 'VORTEX', actors: { fifty: { pose: 'idle' } } },
  },
  f3_lights: {
    id: 'f3_lights', look: 'INTERIOR', dur: 10,
    cast: { rattler: { id: 'rattler', at: { x: -897, y: -300, z: 898 }, yaw: 2.6 }, newbalance: { id: 'newbalance', at: { x: -902, y: -300, z: 901 }, yaw: 0.4 } },
    shots: [
      shot(0, 3, W('hero', 2.5, 2.4, -3), W('hero', 2.2, 2.2, -2.6), W('hero', 0, 1, 2), 52, { shake: 0.1 }),
      shot(3, 4, { x: -899.5, y: 0.5, z: 899.6 }, { x: -899.4, y: 0.35, z: 899.4 }, { x: -899.5, y: 0.02, z: 899.8 }, 34),
      shot(7, 3, W('newbalance', 0.6, 1.7, 1.6), W('newbalance', 0.5, 1.7, 1.4), W('newbalance', 0, 1.6, 0), 34),
    ],
    actors: [act(3.6, 'newbalance', 'pose', { name: 'crouch', k: 1 }), act(3.8, 'rattler', 'pose', { name: 'crouch', k: 1 }), act(5.2, 'newbalance', 'pose', { name: 'crouch', k: 0 }), act(5.3, 'rattler', 'pose', { name: 'crouch', k: 0 })],
    looks: [{ at: 0, set: 'DEEP_INK', dur: 0.3 }, { at: 8.5, set: 'MEMORY_NIGHT', dur: 1.5 }],
    lines: [line(7.2, 'f3.fob')],
    sfx: [{ at: 0.1, name: 'bump' }],
    end: { look: 'MEMORY_NIGHT' },
  },

  /* ---------------- F5: YOU KNOW THE REST ---------------- */
  f5_rest: {
    id: 'f5_rest', look: 'MEMORY_NIGHT', dur: 16,
    cast: { gabe: { id: 'gabe', at: P('f5_trail', 3, 0, -6), yaw: 2.6, props: ['flashlight'] }, pick: { id: 'pick', costume: true, at: P('f5_trail', 0, 0, 0), yaw: -0.5 } },
    shots: [
      shot(0, 4, W('pick', 0.8, 1.7, -2.4), W('pick', 0.6, 1.7, -1.8), W('gabe', 0, 1.6, 0), 42),
      shot(4, 3, W('gabe', -0.6, 1.7, 2.2), W('gabe', -0.5, 1.7, 1.9), W('gabe', 0, 1.62, 0), 32),
      shot(7, 3, W('pick', 0.4, 1.65, 1.8), W('pick', 0.3, 1.64, 1.5), W('pick', 0, 1.62, 0), 30),
      // the arena standoff framing: behind the ronin, Gabe ahead with the pipe (4 s)
      shot(12, 4, W('pick', 0, 3, -5), W('pick', 0, 2.8, -4.4), W('gabe', 0, 1.6, 0), 52),
    ],
    actors: [act(0, 'gabe', 'glow', { k: 1 }), act(1, 'pick', 'moveTo', { to: W('gabe', 0, 0, 5), speed: 1.2 }), act(10.5, 'pick', 'prop', { name: 'foamKatana', on: true, bone: 'RightHand' }), act(11, 'gabe', 'prop', { name: 'pvcPipe', on: true, bone: 'RightHand' })],
    lines: [line(1.2, 'f5.drive'), line(4.4, 'f5.bear'), line(7.4, 'f5.iam')],
    cards: [card(10.2, 'title', 'YOU KNOW THE REST.')],
    fx: [{ at: 0, kind: 'headlights', pos: P('f5_trail', 4, 1, -9) }],
    end: { look: 'NIGHT' },
  },

  /* ---------------- P1: the evidence wall (it shows the player's F5 photo) ---------------- */
  p1_wall: {
    id: 'p1_wall', look: 'INTERIOR', dur: 27,
    cast: { gabe: { id: 'gabe', at: { x: -870.8, y: -300, z: 899.8 }, yaw: Math.PI } },
    shots: [
      shot(0, 5, { x: -870.2, y: 1.6, z: 901.2 }, { x: -870.3, y: 1.55, z: 900.4 }, { x: -870.4, y: 1.45, z: 899.3 }, 44), // the wall: the F5 photo beside Gabe's photo of their van
      shot(5, 6, W('gabe', 0.7, 1.7, 2.2), W('gabe', 0.5, 1.68, 1.9), W('gabe', 0, 1.64, 0), 32),
      shot(11, 8, W('gabe', -0.8, 1.6, 2.4), W('gabe', -0.6, 1.62, 2.0), W('gabe', 0, 1.6, 0), 30),
      shot(19, 8, { x: -869.6, y: 1.4, z: 901 }, { x: -869.9, y: 1.5, z: 900.6 }, W('gabe', 0, 1.5, 0), 40),
    ],
    actors: [act(5, 'gabe', 'pose', { name: 'talk', k: 0.6 }), act(19, 'gabe', 'pose', { name: 'handsOpen', k: 1 })],
    lines: [line(1.2, 'p1.wall'), line(5.4, 'p1.neon'), line(10.6, 'p1.why1'), line(14.2, 'p1.why2'), line(19.6, 'p1.card')],
    end: { look: 'INTERIOR', actors: { gabe: { pose: 'idle' } } },
  },

  /* ---------------- P9: the van door (framed wide, gentle) ---------------- */
  p9_door: {
    id: 'p9_door', look: 'NIGHT', dur: 20,
    cast: { tanktop: { id: 'tanktop', at: P('p9_bridge_block', 3.5, 0, -8), yaw: 0.2 }, dana: { id: 'civA', at: P('p9_bridge_block', 4.6, 0, -6.6), yaw: 3.3 } },
    shots: [
      // wide, from across the deck: the van, Tank Top, the open door; no close-ups of the people inside
      shot(0, 8, P('p9_bridge_block', -9, 2.2, -2), P('p9_bridge_block', -8, 2.1, -3), P('p9_bridge_block', 4, 1.2, -7), 38),
      shot(8, 6, W('tanktop', -2.5, 1.5, -2.6), W('tanktop', -2.4, 1.45, -2.4), W('tanktop', 0.4, 1.1, 1.2), 42),
      shot(14, 6, P('p9_bridge_block', -12, 3, 2), P('p9_bridge_block', -13, 3.4, 3), P('p9_bridge_block', 4, 1.2, -7), 42),
    ],
    actors: [
      act(0.5, 'tanktop', 'moveTo', { to: W('dana', 0, 0, 1.6), speed: 0.9 }),
      act(3.5, 'tanktop', 'pose', { name: 'kneelOpen', k: 1 }), // he kneels, hands open
      act(9, 'dana', 'pose', { name: 'talk', k: 0.4 }),
    ],
    lines: [line(4.2, 'p9.hey'), line(9.2, 'p9.dana1'), line(12.8, 'p9.dana2')],
    sfx: [{ at: 1.2, name: 'doorSlide' }],
    end: { actors: { tanktop: { pose: 'idle' } }, look: 'NIGHT' },
  },

  /* ---------------- P10: the bunkhouse (framed from outside) ---------------- */
  p10_bunk: {
    id: 'p10_bunk', look: 'DEEP_INK', dur: 16,
    cast: { tanktop: { id: 'tanktop', at: { x: 812, z: -776 }, yaw: Math.PI } },
    shots: [
      shot(0, 7, { x: 824, y: 2.4, z: -768 }, { x: 822, y: 2.2, z: -770 }, { x: 812, y: 1.5, z: -781 }, 40),
      shot(7, 9, { x: 800, y: 3, z: -766 }, { x: 801, y: 3.2, z: -764 }, { x: 812, y: 1.4, z: -781 }, 44),
    ],
    actors: [act(0.5, 'tanktop', 'moveTo', { to: { x: 812, z: -779.5 }, speed: 0.8 }), act(4, 'tanktop', 'pose', { name: 'handsOpen', k: 1 }), act(12, 'tanktop', 'pose', { name: 'kneelOpen', k: 1 })],
    lines: [line(4.6, 'p10.gentle'), line(9, 'p10.safe')],
    sfx: [{ at: 3.6, name: 'doorOpen' }],
    end: { actors: { tanktop: { pose: 'idle' } }, look: 'DEEP_INK' },
  },

  /* ---------------- P11: the crew finisher (glyphs 力 命 影 风 速 熊) ---------------- */
  p11_finisher: {
    id: 'p11_finisher', look: 'VORTEX', dur: 5,
    cast: { tanktop: 'tanktop', fifty: 'fifty', shades: 'shades', newbalance: 'newbalance', redjersey: 'redjersey', gabe: 'gabe' },
    shots: ['tanktop', 'fifty', 'shades', 'newbalance', 'redjersey', 'gabe'].map((w, i) => shot(0.2 + i * 0.5, 0.5, W(w, 0.9, 1.5, 1.8), W(w, 0.6, 1.45, 1.4), W(w, 0, 1.3, 0), 30, { ease: 'out' }))
      .concat([shot(3.2, 1.8, W('hero', 3, 2.5, -4), W('hero', 4, 3.4, -5.5), W('hero', 0, 1, 3), 52)]),
    actors: [act(0.2, 'tanktop', 'play', { clip: 'ronin:heavy' }), act(0.7, 'fifty', 'play', { clip: 'ronin:combo' }), act(1.2, 'shades', 'play', { clip: 'ronin:parry' }),
      act(1.7, 'newbalance', 'play', { clip: 'ronin:roll' }), act(2.2, 'redjersey', 'play', { clip: 'ronin:combo' }), act(2.7, 'gabe', 'play', { clip: 'gabe:call' })],
    cards: ['力', '命', '影', '风', '速', '熊'].map((k, i) => card(0.2 + i * 0.5, 'title', '', '', k)),
    fx: [{ at: 3.2, kind: 'ink', pos: W('hero', 0, 0.5, 2) }],
    sfx: [{ at: 2.7, name: 'roar' }],
    end: { look: 'DEEP_INK' },
  },

  /* ---------------- P12: sunrise over the bridge, the ring ---------------- */
  p12_sunrise: {
    id: 'p12_sunrise', look: 'DAWN', dur: 40,
    cast: {
      gabe: { id: 'gabe', at: P('p12_lot', 2, 0, 1), yaw: -2.4 }, vance: { id: 'vance', at: P('p12_lot', 4, 0, -1), yaw: -2.0 },
      fifty: { id: 'fifty', at: P('p12_lot', 0.5, 0, 2.5), yaw: 0.9 }, dana: { id: 'civA', at: P('p12_lot', 14, 0, -9), yaw: 2.2 },
    },
    shots: [
      shot(0, 8, P('p12_lot', -30, 16, 20), P('p12_lot', -24, 12, 14), { bridge: true, y: 4 }, 52), // the sun comes up behind the bridge
      shot(8, 6, P('p12_lot', -18, 3, 10), P('p12_lot', -17, 3, 9), P('p12_lot', 14, 1.2, -9), 36), // Dana meets the four, from far away
      shot(14, 8, W('vance', -0.9, 1.7, 2.2), W('vance', -0.7, 1.7, 2.0), W('gabe', 0, 1.6, 0), 34),
      shot(22, 8, W('gabe', 0.8, 1.7, 2.4), W('gabe', 0.6, 1.7, 2.1), W('vance', 0, 1.6, 0), 34),
      shot(30, 10, W('fifty', 1.2, 1.5, 2.2), W('fifty', 1.5, 2.2, 3.4), W('gabe', 0, 1.3, 0), 38),
    ],
    actors: [
      act(30.4, 'fifty', 'prop', { name: 'ringBox', on: true, bone: 'RightHand' }), act(33, 'fifty', 'prop', { name: 'ringBox', on: false }),
      act(33, 'gabe', 'prop', { name: 'ringBox', on: true, bone: 'RightHand' }), act(14, 'vance', 'pose', { name: 'talk', k: 0.5 }),
    ],
    lines: [line(14.4, 'p12.told'), line(17.6, 'p12.in'), line(20.4, 'p12.wait'), line(22.6, 'p12.thank'), line(26.4, 'p12.month'), line(28.6, 'p12.wedding'),
      line(31, 'p12.ring'), line(34, 'p12.lose'), line(36.6, 'p12.find')],
    looks: [{ at: 0, set: 'DAWN', dur: 6 }],
    end: { look: 'DAY', actors: { gabe: { pose: 'idle' } } },
  },

  /* ---------------- E1: the wedding ---------------- */
  e1_wedding: {
    id: 'e1_wedding', look: 'DAY', dur: 22,
    cast: {
      gabe: { id: 'gabe', at: P('wedding', 1.2, 0, 0), yaw: 3.4 }, christian: { id: 'christian', at: P('wedding', 2.6, 0, 0.4), yaw: 3.4, props: ['kasa'] },
      ryu: { id: 'ryu', at: P('wedding', 3.8, 0, 0.8), yaw: 3.4, props: ['kasa'] }, vance: { id: 'vance', at: P('wedding', -2, 0, 9), yaw: 0.3, props: ['sunglasses'] },
      bride: { id: 'civB', variant: 2, at: P('wedding', -0.6, 0, -1.2), yaw: 0.3 }, // seen only from behind
    },
    shots: [
      shot(0, 7, P('wedding', -12.8, 5, -16.7), P('wedding', -9.5, 3.4, -12.4), P('wedding', 0, 1.5, 0), 48), // Red Rock Crossing at golden hour; the bride from behind (clear of the cottonwoods: the old path flew through their crowns)
      shot(7, 5, W('vance', 0.8, 1.6, 2.0), W('vance', 0.6, 1.6, 1.8), W('vance', 0, 1.6, 0), 30), // Vance, back row, sunglasses
      shot(12, 5, W('gabe', 0.7, 1.7, 2.1), W('gabe', 0.5, 1.7, 1.8), W('gabe', 0, 1.62, 0), 32),
      shot(17, 5, W('gabe', 1.0, 1.6, 2.4), W('gabe', 0.85, 1.55, 2.15), W('gabe', 0.1, 1.42, 0.1), 38), // the ring: his face and his hands in one frame
    ],
    actors: [act(17, 'gabe', 'prop', { name: 'ringBox', on: true, bone: 'RightHand' }), act(19.5, 'gabe', 'pose', { name: 'handsOpen', k: 1 })],
    lines: [line(12.4, 'e1.alone'), line(17.4, 'e1.ringOn')],
    end: { look: 'DAY', actors: { gabe: { pose: 'idle' } } },
  },
};
// keep the ids on the defs in step with their keys
for (const [k, c] of Object.entries(CINES)) c.id = k;
