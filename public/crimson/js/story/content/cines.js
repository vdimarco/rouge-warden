// js/story/content/cines.js : the story's cut scenes as CineDefs (types.js), played by MISSIONS' cine.js.
//
// Points (shot from/to/look, fx pos, place and moveTo args):
//   {x, y, z}               a world point; y is above the ground there (0 on the ground)
//   {place, x, y, z}        offset from a place id (world axes), y above the ground at the place
//   {who, x, y, z}          offset in an actor's frame (x right, y up, z forward); who is a cast name of this
//                           cine, a CAST id, 'hero', 'pick' (the player's friend), 'van' or 'crew'
//   {bridge: true, y}       the bridge: the arena's silhouette in an arena cine, Midgley deck elsewhere
// Actor cues: play {clip, loop, speed, at}; moveTo {to: point, speed}; face {to: point}; pose {name, k};
//   prop {name, on, bone}; show {replace, at: point, yaw}; hide; glow {k}; drain {k, dur}; place {at, yaw, face}.
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
// a chapter intro: an establishing crane over the start place, then down to the hero, a three-quarter
// shot from in front (the old one sat behind him, and the crew following him stood in the lens; the lens
// moves clear of a wall or a van he faces, cine.js)
function introCine(id, place, look, o = {}) {
  return {
    id, look, dur: o.dur || 7,
    shots: [
      // (o.over: the start place stands among rock formations a crane flies into, Hart Ridge and the
      // Cathedral: the establishing shot looks out over the hero's shoulder instead)
      o.over ? shot(0, 4, W('hero', 0.9, 2.3, -5), W('hero', 0.6, 2.0, -3.4), W('hero', 0, 0.5, 45), 55)
        : shot(0, 4, P(place, o.dx ?? -40, 26, o.dz ?? 40), P(place, (o.dx ?? -40) * 0.6, 14, (o.dz ?? 40) * 0.6), P(place, 0, 2, 0), 55),
      shot(4, (o.dur || 7) - 4, W('hero', -1.7, 1.75, 3.4), W('hero', -1.3, 1.7, 2.8), W('hero', -0.15, 1.45, 0), 42),
    ],
    lines: (o.lines || []).map((l, i) => line(1 + i * 3, l)),
    ...(o.extra || {}),
  };
}

export const CINES = {
  /* ---------------- C0 The Bear Yields (the arena) ---------------- */
  c0: {
    id: 'c0', arena: true, look: 'ARENA', dur: 16.8,
    cast: { pick: { id: 'pick', costume: true } },
    film: { at: 0.6, src: 'clips/gabe-return-comic' },
    shots: [
      shot(0, 0.6, W('gabe', 3.6, 2.4, 5.2), W('gabe', 3, 2, 4.4), W('gabe', 0, 1.3), 46, { ease: 'out' }),
      shot(0.6, 1.9, W('gabe', 1.2, 1.65, 2.8), W('gabe', 0.8, 1.6, 2.3), W('gabe', 0, 1.5), 38),
      shot(2.5, 1.5, W('ronin', 0.8, 1.3, 1.7), W('ronin', 0.55, 1.2, 1.4), W('ronin', 0, 0.95), 42),
      shot(4, 2.1, W('pick', -1.1, 1.9, 3), W('pick', -0.7, 1.75, 2.6), W('pick', 0, 1.6), 40),
      shot(6.1, 2.8, W('gabe', -1.3, 1.7, 2.8), W('gabe', -0.7, 1.65, 2.4), W('gabe', 0, 1.5), 38),
      shot(8.9, 1.3, W('gabe', 0.6, 1.2, -2.2), W('gabe', 0.3, 1.1, -2.6), { bridge: true, y: 4 }, 48, { shake: 0.08 }),
      shot(10.2, 2, W('gabe', 2.6, 1.9, 3.4), W('gabe', 2, 1.4, 3), W('gabe', 0, 1), 46),
      shot(12.2, 2.4, W('pick', -2.8, 1.6, 3.4), W('pick', -2.4, 1.5, 3), W('gabe', 0, 1), 46),
      shot(14.6, 2.2, W('gabe', 4, 3, 4), W('gabe', 5, 5, 5), { bridge: true, y: 10 }, 50),
    ],
    actors: [
      act(0, 'bear', 'play', { clip: 'bear:dead', at: 0.9, speed: 0 }),
      act(0, 'gabe', 'play', { clip: 'gabe:hit', speed: 0.6 }),
      act(0.6, 'gabe', 'show', { replace: 'bear' }),
      act(0.62, 'ronin', 'place', { at: W('gabe', 0, 0, 2.4), face: 'gabe' }),
      act(0.65, 'gabe', 'pose', { name: 'kneel', k: 1 }),
      act(0.7, 'gabe', 'drain', { k: 1, dur: 1.2 }),
      act(1.1, 'gabe', 'pose', { name: 'kneelOpen', k: 1 }),
      act(2.5, 'ronin', 'prop', { name: 'foamKatanaBent', on: true, bone: 'RightHand' }),
      act(3.9, 'pick', 'show', { replace: 'ronin' }),
      act(4, 'pick', 'face', { to: W('gabe') }),
      act(4.1, 'pick', 'pose', { name: 'handsOpen', k: 1 }),
      act(6.1, 'pick', 'pose', { name: 'idle', k: 1 }),
      act(6.2, 'gabe', 'face', { who: 'pick' }),
      act(9, 'pick', 'face', { to: { bridge: true } }),
      act(10.2, 'gabe', 'pose', { name: 'crouch', k: 1 }),
      act(10.4, 'pick', 'pose', { name: 'crouch', k: 1 }),
    ],
    lines: [line(1.2, 'c0.swing'), line(4.1, 'c0.gabe'), line(6.3, 'c0.buddy'), line(10.2, 'c0.down'), line(12.2, 'c0.voice')],
    fx: [{ at: 0.6, kind: 'flash' }, { at: 0.7, kind: 'ink', pos: W('gabe', 0, 0.5) }, { at: 9, kind: 'headlights', pos: { bridge: true, y: 1 } }],
    sfx: [{ at: 0.6, name: 'yield' }, { at: 8.9, name: 'engine' }, { at: 12.1, name: 'doorClose' }],
    end: { actors: { gabe: { pose: 'crouch' } }, look: 'NIGHT' },
  },

  /* ---------------- I0 Under the Bridge: cut on the speaker, keep reactions moving ---------------- */
  i0: {
    id: 'i0', look: 'NIGHT', dur: 23.5, cast: UNDER,
    cards: [card(0, 'time', 'SUNDAY · 3:12 AM', 'UNDER MIDGLEY BRIDGE'), card(21.3, 'title', 'HOW DID WE GET HERE', 'THURSDAY. THREE DAYS EARLIER.', '回想')],
    shots: [
      shot(0, 1.7, P('wash', -9, 1.2, 7), P('wash', -7, 1.5, 5), P('wash', 0, 1.3, 0.5), 50),
      shot(1.7, 2.3, W('gabe', 0.55, 1.7, 1.65), W('gabe', 0.39, 1.65, 1.38), W('gabe', 0, 1.5), 48),
      shot(4, 1.9, W('fifty', -0.44, 1.7, 1.49), W('fifty', -0.28, 1.7, 1.26), W('fifty', 0, 1.6), 48),
      shot(5.9, 2.6, W('gabe', -0.55, 1.7, 1.59), W('gabe', -0.39, 1.65, 1.38), W('gabe', 0, 1.5), 48),
      shot(8.5, 3.1, P('wash', 4.4, 2.1, -4.5), P('wash', 3.7, 1.9, -3.8), P('wash', -1.2, 1.4, 0.8), 46),
      shot(11.6, 2.1, W('gabe', 0.50, 1.7, 1.54), W('gabe', 0.33, 1.65, 1.32), W('gabe', 0, 1.5), 48),
      shot(13.7, 1.4, W('fifty', 0.39, 1.7, 1.43), W('fifty', 0.28, 1.7, 1.26), W('fifty', 0, 1.6), 48),
      shot(15.1, 3.3, W('tanktop', 0.50, 1.8, 1.65), W('tanktop', 0.33, 1.7, 1.43), W('tanktop', 0, 1.6), 48),
      shot(18.4, 2.9, W('pick', -0.50, 1.8, 1.65), W('pick', -0.33, 1.7, 1.38), W('pick', 0, 1.6), 48),
      shot(21.3, 2.2, P('wash', -6, 2, 6), P('wash', -12, 6, 12), { bridge: true, y: 6 }, 50),
    ],
    actors: [
      act(0, 'gabe', 'pose', { name: 'idle', k: 1 }),
      act(0, 'fifty', 'face', { who: 'gabe' }),
      act(1.7, 'gabe', 'face', { who: 'fifty' }),
      act(4, 'fifty', 'pose', { name: 'handsOpen', k: 1 }),
      act(5.9, 'fifty', 'pose', { name: 'idle', k: 1 }),
      act(7.5, 'gabe', 'face', { who: 'tanktop' }),
      act(11.6, 'gabe', 'face', { who: 'fifty' }),
      act(15.1, 'tanktop', 'pose', { name: 'handsOpen', k: 1 }),
      act(15.1, 'gabe', 'face', { who: 'tanktop' }),
      act(18.4, 'tanktop', 'pose', { name: 'idle', k: 1 }),
      act(18.4, 'pick', 'pose', { name: 'talk', k: 1 }),
    ],
    lines: [line(1.7, 'i0.cost'), line(4, 'i0.what'), line(5.9, 'i0.first'), line(7.5, 'i0.why'), line(11.6, 'i0.three'), line(13.7, 'i0.ronin'), line(15.1, 'i0.dark'), line(18.4, 'i0.vo')],
    fx: [{ at: 0.5, kind: 'flashlight', pos: { bridge: true, y: 1 } }],
    looks: [{ at: 21.3, set: 'MEMORY', dur: 2 }],
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
  p5_intro: introCine('p5_intro', 'hart_ridge', 'DUSK', { over: true }),
  p6_intro: introCine('p6_intro', 'aframe', 'NIGHT', { dx: -22, dz: 18 }),
  p7_intro: introCine('p7_intro', 'cathedral', 'DAY', { over: true }),
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
      shot(7.5, 2, W('fifty', -0.7, 1.6, 1.9), W('fifty', -0.6, 1.6, 1.7), W('fifty', 0, 1.55, 0), 36), // "Hey! My ring!": his face (the old floor insert showed an empty floor, the box is not a prop there)
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
    cast: { rattler: { id: 'rattler', at: { x: -897, y: -300, z: 898 }, yaw: -0.9 }, newbalance: { id: 'newbalance', at: { x: -898.6, y: -300, z: 899.2 }, yaw: 2.2 } }, // (close enough to swap the fob)
    shots: [
      shot(0, 3, W('hero', 2.5, 2.4, -3), W('hero', 2.2, 2.2, -2.6), W('hero', 0, 1, 2), 52, { shake: 0.1 }),
      shot(3, 4, { x: -896.2, y: 0.9, z: 900.7 }, { x: -896.4, y: 0.8, z: 900.4 }, { x: -897.8, y: 0.55, z: 898.6 }, 40), // the two of them crouched in the dark, the fob between them
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
    // (the trail drops 8 m in 6 m below the deck: the two stand along its contour, level with each other, so
    // no shot has the hill between the lens and a face)
    cast: { gabe: { id: 'gabe', at: P('f5_trail', 6.5, 0, 2.2), yaw: -1.9, props: ['flashlight'] }, pick: { id: 'pick', costume: true, at: P('f5_trail', 0, 0, 0), yaw: 1.24 } },
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
    // The Airstream is 9 m long and 2.6 m deep (world/interiors.js): the two of them stand along its length,
    // Gabe by the wall facing the door end, the hero 3.6 m off facing him, so every shot of Gabe is inside
    // the shell (the old marks turned him to the wall and put the lens 2 m outside it)
    cast: { gabe: { id: 'gabe', at: { x: -872.2, y: -300, z: 899.9 }, yaw: Math.PI / 2 } },
    shots: [
      shot(0, 5, { x: -870.0, y: 1.55, z: 900.9 }, { x: -870.2, y: 1.5, z: 900.5 }, { x: -870.4, y: 1.45, z: 899.2 }, 44), // the wall: the F5 photo beside Gabe's photo of their van
      shot(5, 6, W('gabe', 0.35, 1.65, 1.9), W('gabe', 0.3, 1.65, 1.6), W('gabe', 0, 1.62, 0), 34),
      shot(11, 8, W('gabe', -0.45, 1.6, 2.1), W('gabe', -0.35, 1.62, 1.8), W('gabe', 0, 1.6, 0), 32),
      shot(19, 8, { x: -868.9, y: 1.45, z: 900.8 }, { x: -869.2, y: 1.5, z: 900.6 }, W('gabe', 0, 1.5, 0), 42),
    ],
    actors: [act(0, 'hero', 'place', { x: -868.6, y: -300, z: 900.0, yaw: -Math.PI / 2 }), act(5, 'gabe', 'pose', { name: 'talk', k: 0.6 }), act(19, 'gabe', 'pose', { name: 'handsOpen', k: 1 })],
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
    shots: ['tanktop', 'fifty', 'shades', 'newbalance', 'redjersey', 'gabe'].map((w, i) => shot(0.2 + i * 0.5, 0.5, W(w, 0.9, 1.6, 1.9), W(w, 0.6, 1.58, 1.5), W(w, 0, 1.45, 0), 32, { ease: 'out' })) // (head and shoulders: the old aim at 1.3 m cut the heads off)
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
      // the ring changes hands: the two turn to each other and the lens takes them side on, both faces (the old
      // angle had Gabe's back and Fifty-One on the frame's edge)
      shot(30, 10, W('gabe', 2.7, 1.6, 1.0), W('gabe', 2.4, 1.65, 1.1), W('gabe', 0, 1.45, 1.0), 44),
    ],
    actors: [
      act(29.6, 'fifty', 'face', { who: 'gabe' }), act(29.6, 'gabe', 'face', { who: 'fifty' }),
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
