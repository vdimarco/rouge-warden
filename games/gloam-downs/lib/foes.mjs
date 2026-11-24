// Gloam Downs: the four foes of the combat run, and the light carried after the fall, sculpted in the lamplighter's style (round
// solids, a few ramp steps, lit eyes) and baked by lib/figures.mjs into worlds/foes.bin.gz and worlds/foes.json.gz. Each foe faces
// +z with its feet at its own origin; +x is its left. A foe reads by its outline alone: the Snuffer is a hunched hood with a long
// pole, the Pitchrook a tall thin crow with a beak and a ragged cape, the Mirelight a small floating flame with tails, the Ironback a
// great cracked bell on legs with heavy arms. Fire shows only in eyes and tells; the dark parts snap to each place's own darks.
import { MAT, FIRE, lerp, ease, acts, clip, tag, ring, lane, axisAlong } from './figures.mjs';

export const TARGETS = { S: 3300, P: 3700, M: 1300, I: 4600, L: 60 };
const TAU = Math.PI * 2;
const ringNames = ['ring1', 'ring2', 'ring3', 'ring4', 'ring5', 'ring6'];
const ringBones = ringNames.map(name => ({ name, parent: 'ground', pivot: [0, 0, 0], hidden: true }));
const sh = (sx, sy, sz) => ({ sx, sy, sz });
// a ragged hem: n thin strips round a ring of radius r at height y, hanging and splayed a little
function tatters(S, at, mat, { n, r, y, len, w, splay = 0.25, bone = 'body', res = 0.03, z0 = 0, seed = 1 }) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + seed * 0.37, l = len * (0.7 + 0.3 * Math.abs(Math.sin(i * 2.3 + seed))), s = Math.sin(a), c = Math.cos(a);
    const down = [s * splay, -1, c * splay], ax = axisAlong(down), mid = at(s * (r + splay * l * 0.5), y - l * 0.5, z0 + c * (r + splay * l * 0.5));
    // the strip faces out: its thin side (z of the frame) along the way out
    S.box(mid, [w, l * 0.5, 0.012], mat, tag(bone, { res, rd: 0.008, ax: [ax[0], ax[1], ax[2]] }));
  }
}
const tube = (S, pts, r0, r1, mat, bone, res = 0.03) => S.tube(pts, r0, r1, mat, tag(bone, { res }));
const add = (a, b, s = 1) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];

/* ---------------- the Snuffer ----------------
   Hunched, 1.4 m, in soot rags, with ember eyes under a tall hood. It holds a 1.8 m iron snuffer pole up in its right hand; the cup
   hangs from the top on a short neck, with a hook spur, and is where the tell glows. */
const S_GRIP = [-0.24, 0.74, 0.3], S_DIR = (() => { const d = [0.04, 0.9, 0.42], l = Math.hypot(...d); return d.map(v => v / l); })();
const S_TIP = add(S_GRIP, S_DIR, 1.25), S_BUTT = add(S_GRIP, S_DIR, -0.55), S_CUP = add(S_TIP, [0, -0.16, 0.16]);
const snuffer = {
  apart: ['tell'], code: 'S', name: 'snuffer', title: 'Snuffer', height: 1.4, radius: 0.4, shadow: 0.42, res: 1.32,
  bones: [
    { name: 'body', pivot: [0, 0.1, 0] },
    { name: 'head', parent: 'body', pivot: [0, 0.94, 0.1] },
    { name: 'legL', parent: 'body', pivot: [0.11, 0.3, 0] },
    { name: 'legR', parent: 'body', pivot: [-0.11, 0.3, 0] },
    { name: 'armL', parent: 'body', pivot: [0.26, 0.9, 0.04] },
    { name: 'armR', parent: 'body', pivot: [-0.26, 0.9, 0.04] },
    { name: 'shadow', parent: 'ground', pivot: [0, 40, 0] },
    { name: 'tell', parent: 'armR', pivot: S_CUP, hidden: true }
  ],
  sculpt(S, at, o) {
    const { soot, rag, iron, ink, eye, hot } = MAT;
    // a hunched sack of rags: the belly, the hump of the shoulders, a skirt with a torn hem, a rope belt
    S.ball(at(0, 0.64, -0.03), [0.28, 0.33, 0.25], soot, tag('body', { res: 0.045 }));
    S.ball(at(0, 0.88, -0.13), [0.29, 0.19, 0.23], soot, tag('body', { res: 0.045 }));
    S.ball(at(0, 0.36, 0.0), [0.31, 0.22, 0.27], rag, tag('body', { res: 0.045 }));
    tatters(S, at, rag, { n: 11, r: 0.25, y: 0.24, len: 0.2, w: 0.05, splay: 0.3 });
    S.torus(at(0, 0.5, 0.0), 0.27, 0.025, rag, tag('body', { res: 0.03 }));
    S.box(at(0.2, 0.46, 0.14), [0.06, 0.08, 0.05], rag, tag('body', { res: 0.03, rd: 0.03 })); // a pouch at the belt
    // a deep hood bent forward, its tip flopped back; a black face with two ember eyes. One sculptor makes one surface of its solids, so
    // the hood's front (z 0.24) stays behind the face's (0.30) and the eyes' (0.31), or it swallows them
    S.ball(at(0, 1.0, 0.06), [0.2, 0.19, 0.18], soot, tag('head', { res: 0.04 }));
    tube(S, [at(0, 1.1, 0.0), at(0, 1.32, -0.07), at(0.04, 1.52, -0.2)], 0.12, 0.012, soot, 'head', 0.035);
    S.ball(at(0, 0.97, 0.25), [0.12, 0.11, 0.05], ink, tag('head', { res: 0.025 }));
    for (const s of [-1, 1]) S.ball(at(0.045 * s, 0.99, 0.29), 0.024, eye, tag('head', { res: 0.015 }));
    // short wrapped legs under the skirt
    for (const s of [-1, 1]) {
      const b = s > 0 ? 'legL' : 'legR';
      tube(S, [at(0.11 * s, 0.3, 0), at(0.12 * s, 0.08, 0.04)], 0.05, 0.045, soot, b, 0.035);
      S.ball(at(0.12 * s, 0.06, 0.06), [0.075, 0.055, 0.11], rag, tag(b, { res: 0.035 }));
    }
    // the free left arm, thin, with a hooked iron claw
    tube(S, [at(0.26, 0.9, 0.04), at(0.35, 0.7, 0.16), at(0.3, 0.52, 0.3)], 0.06, 0.042, soot, 'armL', 0.035);
    S.ball(at(0.3, 0.5, 0.32), 0.05, soot, tag('armL', { res: 0.025 }));
    for (const d of [-1, 0, 1]) tube(S, [at(0.3 + d * 0.03, 0.48, 0.35), at(0.3 + d * 0.04, 0.42, 0.42), at(0.3 + d * 0.04, 0.38, 0.4)], 0.012, 0.005, iron, 'armL', 0.012);
    // the right arm and the pole: an iron rod, a ferrule at the grip, a neck to the cup, the cup (mouth down) and the hook spur
    tube(S, [at(-0.26, 0.9, 0.04), at(-0.31, 0.78, 0.18), at(...S_GRIP)], 0.062, 0.048, soot, 'armR', 0.035);
    S.ball(at(...S_GRIP), 0.055, soot, tag('armR', { res: 0.025 }));
    tube(S, [at(...S_BUTT), at(...S_TIP)], 0.024, 0.02, iron, 'armR', 0.025);
    S.torus(at(...add(S_GRIP, S_DIR, 0.12)), 0.03, 0.012, iron, tag('armR', { res: 0.012, ax: axisAlong(S_DIR) }));
    tube(S, [at(...S_TIP), at(...add(S_TIP, [0, 0.05, 0.08])), at(...add(S_CUP, [0, 0.09, 0]))], 0.018, 0.016, iron, 'armR', 0.018);
    S.lathe(at(...add(S_CUP, [0, -0.08, 0])), 0.18, [0.1, 0.03], iron, tag('armR', { res: 0.022 }));
    tube(S, [at(...S_TIP), at(...add(S_TIP, [0, 0.12, -0.02])), at(...add(S_TIP, [0, 0.2, -0.12]))], 0.02, 0.007, iron, 'armR', 0.016);
    // the tell: fire over the cup and out of its mouth, grown from nothing over a wind-up
    S.lathe(at(...add(S_CUP, [0, -0.1, 0])), 0.22, [0.13, 0.05], { r: [FIRE[2], FIRE[3]], em: true }, tag('tell', { res: 0.03 }));
    S.ball(at(...add(S_CUP, [0, -0.12, 0])), [0.08, 0.05, 0.08], hot, tag('tell', { res: 0.025 }));
    tube(S, [at(...add(S_TIP, S_DIR, -0.35)), at(...S_TIP)], 0.032, 0.03, { r: [FIRE[2]], em: true }, 'tell', 0.03); // the rod's end goes red
  },
  clips: {
    rest: clip(2.4, [0, 0.25, 0.5, 0.75, 1], u => ({
      body: { sy: 1 + 0.025 * Math.sin(u * TAU), sx: 1 - 0.012 * Math.sin(u * TAU), sz: 1 - 0.012 * Math.sin(u * TAU) },
      head: { ry: 0.18 * Math.sin(u * TAU), rx: 0.05 * Math.sin(u * TAU * 2) },
      armR: { rx: 0.05 * Math.sin(u * TAU + 1) }, armL: { rx: 0.08 * Math.sin(u * TAU + 2) }
    }), true),
    walk: clip(0.75, [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1], u => {
      const a = u * TAU, sw = Math.sin(a);
      return {
        body: { ty: 0.05 * Math.abs(sw), rz: 0.06 * sw, rx: 0.1 },
        legL: { rx: -0.6 * sw }, legR: { rx: 0.6 * sw },
        armL: { rx: 0.35 * sw }, armR: { rx: -0.12 * sw + 0.05 },
        head: { rx: 0.06 * Math.sin(a * 2) }
      };
    }, true),
    // the hook: the pole swings back over the shoulder while the body leans back 15° and the cup glows; then down and forward
    'hook.windup': clip(0.55, [0, 0.2, 0.45, 0.75, 1], u => {
      const e = ease(u), b = acts('windup', u * 0.55, 1.4);
      return {
        body: { rx: lerp(0, -0.26, e) + b.rx * 0.5, ...sh(b.sx, b.sy, b.sz) },
        head: { rx: 0.15 * e }, armR: { rx: -1.3 * e, ry: 0.25 * e }, armL: { rx: -0.5 * e, rz: 0.3 * e },
        tell: { s: Math.min(1, u * 1.15) }
      };
    }),
    'hook.attack': clip(0.15, [0, 0.35, 0.7, 1], u => {
      const e = ease(Math.min(1, u * 1.4)), b = acts('attack', 0.1 + u * 0.25, 1.4);
      return {
        body: { rx: lerp(-0.26, 0.5, e), ...sh(b.sx, b.sy, b.sz), ty: b.ty },
        head: { rx: lerp(0.15, -0.1, e) }, armR: { rx: lerp(-1.3, 1.65, e), ry: lerp(0.25, 0, e) }, armL: { rx: lerp(-0.5, 0.4, e), rz: 0.3 },
        tell: { s: 1 }
      };
    }),
    // it stands open: the cup on the ground, the body bent, the fire going out
    'hook.recover': clip(0.7, [0, 0.25, 0.6, 1], u => {
      const e = ease(Math.max(0, (u - 0.35) / 0.65));
      return {
        body: { rx: lerp(0.5, 0, e), sy: lerp(0.94, 1, e) }, head: { rx: lerp(-0.1, 0, e) },
        armR: { rx: lerp(1.65, 0, e) }, armL: { rx: lerp(0.4, 0, e), rz: lerp(0.3, 0, e) },
        tell: { s: Math.max(0, 1 - u * 3.5) }
      };
    }),
    hurt: clip(0.4, [0, 0.15, 0.35, 0.6, 1], u => {
      const b = acts('hurt', u, 1.4);
      return { body: { rx: -b.rx * 1.6, ...sh(b.sx, b.sy, b.sz), tz: b.tz * 0.5 }, head: { rx: -0.3 * Math.sin(u * Math.PI) }, armR: { rx: -0.3 * Math.sin(u * Math.PI) } };
    }),
    // knocked down: on its back for most of 0.6 s, then up again
    down: clip(0.6, [0, 0.2, 0.7, 1], u => {
      const d = u < 0.2 ? ease(u / 0.2) : u > 0.7 ? 1 - ease((u - 0.7) / 0.3) : 1;
      return { body: { rx: -1.15 * d, ty: -0.32 * d }, head: { rx: -0.4 * d }, armR: { rx: -0.9 * d }, armL: { rx: -1.2 * d }, legL: { rx: -0.7 * d }, legR: { rx: -0.4 * d } };
    }),
    // up out of the ground, hunched and turning, arms first
    rise: clip(0.9, [0, 0.3, 0.6, 0.85, 1], u => {
      const e = ease(u);
      return { body: { ty: lerp(-1.5, 0, e), rx: lerp(0.5, 0, e), ry: 0.4 * (1 - e) }, armR: { rx: lerp(-1.2, 0, e) }, armL: { rx: lerp(-1.6, 0, e) }, head: { rx: lerp(0.4, 0, e) } };
    })
  }
};

/* ---------------- the Pitchrook ----------------
   Tall and thin, 1.7 m, on bird's legs, in a ragged feather cape with feathers up at the shoulders, a beaked mask of old bone. Its
   right hand holds a coal (dull until the lob, when the tell glows round it); its left a pot of pitch with an ember in it. */
const P_COAL = [-0.26, 0.86, 0.27];
const pitchrook = {
  apart: ['tell'], code: 'P', name: 'pitchrook', title: 'Pitchrook', height: 1.7, radius: 0.4, shadow: 0.38, res: 1.34,
  bones: [
    { name: 'body', pivot: [0, 0.1, 0] },
    { name: 'head', parent: 'body', pivot: [0, 1.4, 0.02] },
    { name: 'legL', parent: 'body', pivot: [0.1, 0.86, 0] },
    { name: 'legR', parent: 'body', pivot: [-0.1, 0.86, 0] },
    { name: 'armL', parent: 'body', pivot: [0.2, 1.3, 0] },
    { name: 'armR', parent: 'body', pivot: [-0.2, 1.3, 0] },
    { name: 'shadow', parent: 'ground', pivot: [0, 40, 0] },
    { name: 'tell', parent: 'coal', pivot: P_COAL, hidden: true },
    { name: 'coal', parent: 'armR', pivot: P_COAL },
    ...ringBones
  ],
  sculpt(S, at, o) {
    const { feather, bone, iron, ink, eye, ember, tell, hot, soot, rag } = MAT;
    // bird's legs: thin, the knee forward, three toes
    for (const s of [-1, 1]) {
      const b = s > 0 ? 'legL' : 'legR';
      tube(S, [at(0.1 * s, 0.86, 0), at(0.12 * s, 0.46, 0.07), at(0.11 * s, 0.07, -0.03)], 0.042, 0.03, feather, b, 0.03);
      for (const d of [-0.5, 0, 0.5]) tube(S, [at(0.11 * s, 0.05, -0.02), at(0.11 * s + d * 0.08, 0.02, 0.1)], 0.018, 0.008, iron, b, 0.015);
    }
    // a narrow body, the cape round it from the shoulders to the knees, its hem torn into feathers, feathers up at the shoulders
    S.ball(at(0, 1.08, 0.01), [0.16, 0.27, 0.13], feather, tag('body', { res: 0.04 }));
    S.lathe(at(0, 0.6, -0.06), 0.76, t => 0.34 - 0.19 * t, feather, tag('body', { res: 0.045 }));
    tatters(S, at, feather, { n: 14, r: 0.3, y: 0.62, len: 0.3, w: 0.05, splay: 0.45, z0: -0.06, seed: 3 });
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
      const d = [s * (0.35 + i * 0.25), 1, -0.15 - i * 0.1], ax = axisAlong(d);
      S.box(at(0.22 * s + d[0] * 0.1, 1.39 + 0.12, -0.03 + d[2] * 0.08), [0.035, 0.17 - i * 0.03, 0.012], feather, tag('body', { res: 0.025, rd: 0.008, ax }));
    }
    S.box(at(0, 0.9, 0.12), [0.1, 0.04, 0.03], rag, tag('body', { res: 0.025, rd: 0.02 })); // a strap across the chest
    // the head: a small round head, a mask of old bone with a long beak, two ember eyes, a crest of three feathers
    S.ball(at(0, 1.52, 0.0), [0.11, 0.12, 0.12], feather, tag('head', { res: 0.035 }));
    S.ball(at(0, 1.5, 0.07), [0.095, 0.095, 0.075], bone, tag('head', { res: 0.025 }));
    tube(S, [at(0, 1.5, 0.12), at(0, 1.45, 0.33), at(0, 1.34, 0.55)], 0.06, 0.008, bone, 'head', 0.022);
    S.ball(at(0, 1.47, 0.1), [0.08, 0.03, 0.05], ink, tag('head', { res: 0.015 }));
    for (const s of [-1, 1]) S.ball(at(0.045 * s, 1.53, 0.14), 0.02, eye, tag('head', { res: 0.012 }));
    for (const s of [-1, 0, 1]) { const d = [s * 0.25, 1, -0.7], ax = axisAlong(d); S.box(at(s * 0.03, 1.66, -0.08), [0.025, 0.1, 0.01], feather, tag('head', { res: 0.02, rd: 0.008, ax })); }
    // the coal arm
    tube(S, [at(-0.2, 1.3, 0), at(-0.28, 1.08, 0.08), at(-0.26, 0.9, 0.2)], 0.04, 0.034, feather, 'armR', 0.03);
    S.ball(at(-0.26, 0.88, 0.22), 0.04, feather, tag('armR', { res: 0.02 }));
    // the coal: black, with a few dull embers in it
    S.ball(at(...P_COAL), 0.06, soot, tag('coal', { res: 0.02 }));
    for (let i = 0; i < 5; i++) { const a = i * 2.4; S.ball(at(P_COAL[0] + Math.cos(a) * 0.045, P_COAL[1] + 0.02 * Math.sin(i * 1.7), P_COAL[2] + Math.sin(a) * 0.045), 0.016, ember, tag('coal', { res: 0.012 })); }
    // the tell: the coal flares
    S.ball(at(...P_COAL), 0.115, tell, tag('tell', { res: 0.025 }));
    S.ball(at(P_COAL[0], P_COAL[1] + 0.02, P_COAL[2] + 0.02), 0.07, hot, tag('tell', { res: 0.02 }));
    // the pot arm, and the pot of pitch on its handle, an ember on top of the pitch
    tube(S, [at(0.2, 1.3, 0), at(0.27, 1.05, 0.04), at(0.26, 0.86, 0.1)], 0.04, 0.034, feather, 'armL', 0.03);
    S.ball(at(0.26, 0.84, 0.11), 0.04, feather, tag('armL', { res: 0.02 }));
    S.torus(at(0.27, 0.73, 0.12), 0.08, 0.01, iron, tag('armL', { res: 0.012, ax: [[1, 0, 0], [0, 0, 1], [0, -1, 0]] }));
    S.lathe(at(0.27, 0.56, 0.12), 0.15, t => 0.06 + 0.04 * Math.sin(Math.PI * Math.min(1, t * 1.15)), iron, tag('armL', { res: 0.022 }));
    S.ball(at(0.27, 0.71, 0.12), [0.06, 0.012, 0.06], ember, tag('armL', { res: 0.015 }));
  },
  lay: (B, o) => ring(B, o, 1.4, ringNames),
  clips: {
    rest: clip(2.6, [0, 0.25, 0.5, 0.75, 1], u => ({
      body: { sy: 1 + 0.02 * Math.sin(u * TAU) }, head: { ry: 0.3 * Math.sin(u * TAU), rz: 0.08 * Math.sin(u * TAU * 2) },
      armR: { rx: 0.06 * Math.sin(u * TAU) }, armL: { rz: 0.05 * Math.sin(u * TAU + 1) }
    }), true),
    walk: clip(0.9, [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1], u => {
      const a = u * TAU, sw = Math.sin(a);
      return { body: { ty: 0.04 * Math.abs(sw), rz: 0.04 * sw }, legL: { rx: -0.45 * sw }, legR: { rx: 0.45 * sw }, armL: { rx: 0.2 * sw }, armR: { rx: -0.2 * sw }, head: { rx: 0.08 * Math.sin(a * 2), ry: 0.1 * sw } };
    }, true),
    // the lob: the coal arm rises behind the head and the coal flares; then the arm whips over and the coal goes (the page flies it)
    'lob.windup': clip(0.8, [0, 0.25, 0.5, 0.75, 1], u => {
      const e = ease(u), b = acts('windup', u * 0.55, 1.7);
      return { body: { rx: -0.18 * e + b.rx * 0.4, rz: 0.08 * e, ...sh(b.sx, b.sy, b.sz) }, armR: { rx: -0.45 * e, rz: -2.5 * e }, armL: { rx: 0.3 * e, rz: 0.25 * e }, head: { rx: -0.12 * e, ry: -0.25 * e }, tell: { s: Math.min(1, u * 1.1) } };
    }),
    'lob.attack': clip(0.15, [0, 0.4, 0.7, 1], u => {
      const e = ease(Math.min(1, u * 1.5)), b = acts('attack', 0.1 + u * 0.25, 1.7);
      const gone = u >= 0.4;
      return { body: { rx: lerp(-0.18, 0.3, e), rz: lerp(0.08, 0, e), ...sh(b.sx, b.sy, b.sz) }, armR: { rx: lerp(-0.45, -1.4, e), rz: lerp(-2.5, -0.2, e) }, armL: { rx: 0.3, rz: 0.25 }, head: { rx: lerp(-0.12, 0.1, e), ry: lerp(-0.25, 0, e) }, coal: { s: gone ? 0 : 1 }, tell: { s: gone ? 0 : 1 } };
    }),
    'lob.recover': clip(0.4, [0, 0.5, 0.85, 1], u => {
      const e = ease(u);
      return { body: { rx: lerp(0.3, 0, e) }, armR: { rx: lerp(-1.4, 0, e), rz: lerp(-0.2, 0, e) }, armL: { rx: lerp(0.3, 0, e), rz: lerp(0.25, 0, e) }, head: { rx: lerp(0.1, 0, e) }, coal: { s: u < 0.85 ? 0 : 1 } };
    }),
    hurt: clip(0.4, [0, 0.15, 0.35, 0.6, 1], u => {
      const b = acts('hurt', u, 1.7);
      return { body: { rx: -b.rx * 1.6, ...sh(b.sx, b.sy, b.sz) }, head: { rx: -0.35 * Math.sin(u * Math.PI) }, armL: { rz: 0.4 * Math.sin(u * Math.PI) }, armR: { rz: -0.4 * Math.sin(u * Math.PI) } };
    }),
    down: clip(0.6, [0, 0.2, 0.7, 1], u => {
      const d = u < 0.2 ? ease(u / 0.2) : u > 0.7 ? 1 - ease((u - 0.7) / 0.3) : 1;
      return { body: { rx: -1.2 * d, ty: -0.45 * d }, head: { rx: -0.3 * d }, armR: { rz: -0.8 * d }, armL: { rz: 0.8 * d }, legL: { rx: -0.9 * d }, legR: { rx: -0.6 * d } };
    }),
    rise: clip(0.9, [0, 0.3, 0.6, 0.85, 1], u => {
      const e = ease(u);
      return { body: { ty: lerp(-1.8, 0, e), rx: lerp(0.4, 0, e) }, armR: { rx: lerp(-2.2, 0, e) }, armL: { rx: lerp(-2.0, 0, e) }, head: { rx: lerp(0.5, 0, e) } };
    })
  }
};

/* ---------------- the Mirelight ----------------
   A pale flame the size of a head, 1.3 m up, with a fire-red heart and three soot tails. Its tell is the core: it blazes in a soot
   rim as the flame swells to 1.6 times its size. */
const M_C = [0, 1.3, 0];
const mirelight = {
  apart: ['core'], code: 'M', name: 'mirelight', title: 'Mirelight', height: 1.6, radius: 0.35, shadow: 0.24, res: 1.4,
  bones: [
    { name: 'body', pivot: M_C },
    { name: 'core', parent: 'body', pivot: [0, 1.28, 0.06], hidden: true },
    { name: 'tails', parent: 'body', pivot: [0, 1.18, 0] },
    { name: 'shadow', parent: 'ground', pivot: [0, 40, 0] },
    ...ringBones
  ],
  sculpt(S, at, o) {
    const { wisp, wispPale, wispDim, soot, hot, ink } = MAT;
    S.ball(at(0, 1.28, 0), [0.15, 0.14, 0.15], wispPale, tag('body', { res: 0.03 }));
    tube(S, [at(0, 1.33, -0.01), at(0, 1.47, -0.03), at(0.02, 1.62, -0.08)], 0.12, 0.012, wisp, 'body', 0.028);
    for (const s of [-1, 1]) tube(S, [at(0.07 * s, 1.36, 0), at(0.12 * s, 1.47, -0.03)], 0.04, 0.008, wispDim, 'body', 0.02);
    // the red heart in a soot rim (red mixed with the pale flame is a tan), standing just out of the flame's front; no face (two dark
    // eyes over it read as a cartoon face, softer than the house look)
    S.ball(at(0, 1.25, 0.13), [0.075, 0.07, 0.03], ink, tag('body', { res: 0.02 }));
    S.ball(at(0, 1.25, 0.13), [0.055, 0.05, 0.04], { r: [FIRE[2]], em: true }, tag('body', { res: 0.015 }));
    // the core: blazing, over the red heart, in a soot rim so that its edge meets dark and not the pale flame (the two mixed are a
    // tan that no palette keeps as fire); the rim lies behind the core, or the one surface of the sculptor swallows it
    S.ball(at(0, 1.27, 0.07), [0.135, 0.135, 0.04], ink, tag('core', { res: 0.034 }));
    // its edge in slot 34 and its heart in 35: the contact shade darkens a round glow's edge, and 34 darkened turns dark, not tan
    S.ball(at(0, 1.27, 0.09), 0.1, { r: [FIRE[2]], em: true }, tag('core', { res: 0.026 }));
    S.ball(at(0, 1.27, 0.15), 0.06, hot, tag('core', { res: 0.024 }));
    // three soot tails curling down and back
    for (const s of [-1, 0, 1])
      tube(S, [at(0.05 * s, 1.17, 0), at(0.11 * s, 1.0, -0.06 - 0.04 * Math.abs(s)), at(0.15 * s, 0.84, -0.18), at(0.1 * s + 0.03, 0.7, -0.3 + 0.12 * (s === 0))], 0.045, 0.006, soot, 'tails', 0.022);
  },
  lay: (B, o) => ring(B, o, 2.2, ringNames, { gap: 0.5 }),
  clips: {
    rest: clip(1.8, [0, 0.25, 0.5, 0.75, 1], u => ({
      body: { ty: 0.07 * Math.sin(u * TAU), sy: 1 + 0.06 * Math.sin(u * TAU * 2), sx: 1 - 0.03 * Math.sin(u * TAU * 2), sz: 1 - 0.03 * Math.sin(u * TAU * 2) },
      tails: { rx: 0.15 * Math.sin(u * TAU + 1), rz: 0.1 * Math.sin(u * TAU) }
    }), true),
    walk: clip(0.8, [0, 0.25, 0.5, 0.75, 1], u => ({
      body: { ty: 0.05 * Math.sin(u * TAU), rx: 0.25 }, tails: { rx: -0.45 + 0.15 * Math.sin(u * TAU), rz: 0.15 * Math.sin(u * TAU) }
    }), true),
    // the pulse: it swells to 1.6 times its size and the core blazes; then it snaps and the ring fires
    'pulse.windup': clip(0.7, [0, 0.3, 0.6, 0.85, 1], u => {
      const e = ease(u);
      return { body: { s: lerp(1, 1.6, e), ty: 0.04 * Math.sin(u * TAU * 3) }, core: { s: Math.min(1, u * 1.1) }, tails: { rx: lerp(0, 0.6, e), s: lerp(1, 1.2, e) } };
    }),
    'pulse.attack': clip(0.15, [0, 0.35, 0.7, 1], u => ({
      body: { s: lerp(1.6, 0.85, ease(Math.min(1, u * 2))) }, core: { s: lerp(1.3, 0, u) }, tails: { rx: lerp(0.6, -0.3, u) }
    })),
    // it drifts back, dimmer, and gathers itself
    'pulse.recover': clip(0.6, [0, 0.5, 1], u => ({ body: { s: lerp(0.85, 1, ease(u)), rx: -0.3 * (1 - u) }, tails: { rx: lerp(-0.3, 0, u) } })),
    hurt: clip(0.4, [0, 0.2, 0.5, 1], u => ({ body: { s: 1 - 0.25 * Math.sin(u * Math.PI), tz: -0.15 * Math.sin(u * Math.PI) }, tails: { rx: 0.5 * Math.sin(u * Math.PI) } })),
    down: clip(0.6, [0, 0.3, 0.7, 1], u => ({ body: { ty: -0.5 * Math.sin(u * Math.PI), rz: 1.2 * Math.sin(u * Math.PI) }, tails: { rx: 0.8 * Math.sin(u * Math.PI) } })),
    // it gathers out of the ground: small and low first
    rise: clip(0.9, [0, 0.4, 0.8, 1], u => ({ body: { ty: lerp(-1.2, 0, ease(u)), s: lerp(0.25, 1, ease(u)) }, tails: { s: lerp(0.4, 1, u) } }))
  }
};

/* ---------------- the Ironback ----------------
   Broad, 1.9 m: a great cracked bronze bell worn as a shell, leaning forward, a small head under its lip, thick arms to the ground.
   Fire shows in the crack; the tell is the crack blazing. */
const bellR = t => (0.37 + 0.29 * Math.pow(1 - t, 4.5)) * (t > 0.8 ? Math.sqrt(Math.max(0, 1 - ((t - 0.8) / 0.2) ** 2)) : 1);
const I_TILT = 0.34, I_BASE = [0, 0.6, -0.2], I_H = 1.24;
// a point on the bell at height share t, angle a from the front (+z), pushed out by out: the lathe stands on I_BASE, its axis tilted
// forward by I_TILT, so its local y runs along (0, cos, sin) and its local z along (0, -sin, cos)
const bellPoint = (t, a, out = 0) => {
  const r = bellR(t) + out, y = t * I_H, x = Math.sin(a) * r, z = Math.cos(a) * r, c = Math.cos(I_TILT), s = Math.sin(I_TILT);
  return [I_BASE[0] + x, I_BASE[1] + y * c - z * s, I_BASE[2] + y * s + z * c];
};
const bellAxis = t => bellPoint(t, 0, -bellR(t));
const CRACK = [[0.02, 0.32], [0.14, 0.24], [0.27, 0.36], [0.4, 0.22], [0.52, 0.33], [0.63, 0.2]];
const ironback = {
  apart: ['tell'], code: 'I', name: 'ironback', title: 'Ironback', height: 1.9, radius: 0.7, shadow: 0.72, res: 1.6,
  bones: [
    { name: 'body', pivot: [0, 0.1, 0] },
    { name: 'head', parent: 'body', pivot: [0, 0.9, 0.38] },
    { name: 'legL', parent: 'body', pivot: [0.24, 0.62, 0] },
    { name: 'legR', parent: 'body', pivot: [-0.24, 0.62, 0] },
    { name: 'armL', parent: 'body', pivot: [0.5, 1.02, 0.06] },
    { name: 'armR', parent: 'body', pivot: [-0.5, 1.02, 0.06] },
    { name: 'shadow', parent: 'ground', pivot: [0, 40, 0] },
    { name: 'tell', parent: 'body', pivot: bellPoint(0.3, 0.28, 0.02), hidden: true },
    ...[1, 2, 3, 4, 5].map(i => ({ name: `lane${i}`, parent: 'ground', pivot: [0, 0, (i - 1) * 1.4], hidden: true })),
    ...ringBones
  ],
  sculpt(S, at, o) {
    const { bronze, feather, soot, iron, ink, eye, ember, white } = MAT;
    const tilt = [[1, 0, 0], [0, Math.cos(I_TILT), Math.sin(I_TILT)], [0, -Math.sin(I_TILT), Math.cos(I_TILT)]];
    // the body under the bell, the bell, its lip, the loop it once hung from
    S.ball(at(0, 0.72, 0.04), [0.38, 0.3, 0.32], soot, tag('body', { res: 0.05 }));
    S.lathe(at(...I_BASE), I_H, bellR, bronze, tag('body', { res: 0.05, ax: tilt }));
    S.torus(at(...bellAxis(0.015)), 0.655, 0.05, bronze, tag('body', { res: 0.04, ax: tilt }));
    const top = bellAxis(1);
    S.torus(at(top[0], top[1] + 0.07, top[2] - 0.02), 0.1, 0.035, bronze, tag('body', { res: 0.025, ax: [[1, 0, 0], [0, 0, 1], [0, -1, 0]] }));
    // the crack up the front, black, with a dull ember deep in it; the tell blazes along it
    const pts = CRACK.map(([t, a]) => at(...bellPoint(t, a, 0.005)));
    S.tube(pts, 0.03, 0.02, ink, tag('body', { res: 0.018 }));
    S.tube(CRACK.map(([t, a]) => at(...bellPoint(t, a, 0.02))), 0.013, 0.01, ember, tag('body', { res: 0.012 }));
    // the blaze: slot 34 along the crack's edges, 35 down its middle, standing out of it (one sculptor, one surface)
    S.tube(CRACK.map(([t, a]) => at(...bellPoint(t, a, 0.03))), 0.05, 0.035, { r: [FIRE[2]], em: true }, tag('tell', { res: 0.025 }));
    S.tube(CRACK.map(([t, a]) => at(...bellPoint(t, a, 0.06))), 0.03, 0.022, white, tag('tell', { res: 0.034 }));
    // a small head low under the lip, two ember eyes
    S.ball(at(0, 0.94, 0.47), [0.13, 0.11, 0.13], feather, tag('head', { res: 0.03 }));
    S.ball(at(0, 0.88, 0.55), [0.09, 0.05, 0.06], ink, tag('head', { res: 0.02 }));
    for (const s of [-1, 1]) S.ball(at(0.05 * s, 0.97, 0.58), 0.022, eye, tag('head', { res: 0.014 }));
    // thick arms from under the lip, fists on the ground, iron cuffs
    for (const s of [-1, 1]) {
      const b = s > 0 ? 'armL' : 'armR';
      S.ball(at(0.5 * s, 1.0, 0.06), 0.17, feather, tag(b, { res: 0.04 }));
      tube(S, [at(0.5 * s, 1.0, 0.06), at(0.64 * s, 0.62, 0.18), at(0.6 * s, 0.3, 0.3)], 0.16, 0.125, feather, b, 0.042);
      S.ball(at(0.59 * s, 0.2, 0.34), [0.17, 0.14, 0.17], feather, tag(b, { res: 0.035 }));
      S.torus(at(0.61 * s, 0.38, 0.27), 0.135, 0.032, iron, tag(b, { res: 0.022, ax: axisAlong([0.04 * s, 0.32, -0.12]) }));
    }
    // short thick legs
    for (const s of [-1, 1]) {
      const b = s > 0 ? 'legL' : 'legR';
      tube(S, [at(0.24 * s, 0.62, 0), at(0.28 * s, 0.32, 0.04), at(0.3 * s, 0.1, 0.06)], 0.14, 0.12, feather, b, 0.04);
      S.ball(at(0.3 * s, 0.07, 0.12), [0.15, 0.08, 0.2], feather, tag(b, { res: 0.035 }));
    }
  },
  lay: (B, o) => ({ ...lane(B, o, 1.6, 1.4, ['lane1', 'lane2', 'lane3', 'lane4', 'lane5']), ...ring(B, o, 3.0, ringNames, { gap: 0.55 }) }),
  clips: {
    rest: clip(3, [0, 0.25, 0.5, 0.75, 1], u => ({
      body: { sy: 1 + 0.015 * Math.sin(u * TAU), rx: 0.02 * Math.sin(u * TAU) }, head: { ry: 0.12 * Math.sin(u * TAU) },
      armL: { rx: 0.04 * Math.sin(u * TAU) }, armR: { rx: 0.04 * Math.sin(u * TAU + 0.6) }
    }), true),
    walk: clip(1.1, [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1], u => {
      const a = u * TAU, sw = Math.sin(a);
      return { body: { rz: 0.09 * sw, ty: 0.04 * Math.abs(sw) }, legL: { rx: -0.45 * sw }, legR: { rx: 0.45 * sw }, armL: { rx: 0.3 * sw }, armR: { rx: -0.3 * sw }, head: { rz: -0.06 * sw } };
    }, true),
    // the charge: two scrapes of a fist with the head low, the crack blazing; then the run itself (a loop), and the recovery
    'charge.windup': clip(0.9, [0, 0.15, 0.3, 0.45, 0.6, 0.75, 1], u => {
      const e = ease(Math.min(1, u * 2)), scrape = Math.sin(Math.min(1, u / 0.75) * TAU * 2);
      return { body: { rx: 0.34 * e }, head: { rx: 0.3 * e }, armR: { rx: 0.15 + 0.55 * scrape * (u < 0.75 ? 1 : 0) - 0.4 * (u >= 0.75 ? ease((u - 0.75) / 0.25) : 0) }, armL: { rx: -0.3 * e }, legR: { rx: -0.25 * Math.max(0, scrape) }, tell: { s: Math.min(1, u * 1.1) } };
    }),
    'charge.attack': clip(0.36, [0, 0.25, 0.5, 0.75, 1], u => {
      const sw = Math.sin(u * TAU);
      return { body: { rx: 0.45, ty: 0.06 * Math.abs(sw) }, head: { rx: 0.25 }, legL: { rx: -0.8 * sw }, legR: { rx: 0.8 * sw }, armL: { rx: -0.6 }, armR: { rx: -0.6 }, tell: { s: 1 } };
    }, true),
    'charge.recover': clip(1.4, [0, 0.3, 0.7, 1], u => {
      const e = ease(u);
      return { body: { rx: lerp(0.45, 0, e), sy: lerp(0.95, 1, e) }, head: { rx: lerp(0.25, 0, e) }, armL: { rx: lerp(-0.6, 0, e) }, armR: { rx: lerp(-0.6, 0, e) }, tell: { s: Math.max(0, 1 - u * 3) } };
    }),
    // the slam: it rears up with both arms over the bell; then down
    'slam.windup': clip(0.75, [0, 0.3, 0.6, 0.85, 1], u => {
      const e = ease(u), b = acts('windup', u * 0.55, 1.9);
      return { body: { rx: -0.42 * e, ty: 0.12 * e, ...sh(b.sx, b.sy, b.sz) }, armL: { rx: -2.7 * e, rz: -0.3 * e }, armR: { rx: -2.7 * e, rz: 0.3 * e }, head: { rx: -0.2 * e }, tell: { s: Math.min(1, u * 1.1) } };
    }),
    'slam.attack': clip(0.12, [0, 0.5, 1], u => {
      const e = ease(Math.min(1, u * 1.6));
      return { body: { rx: lerp(-0.42, 0.35, e), ty: lerp(0.12, -0.05, e), sy: lerp(1, 0.86, e), sx: lerp(1, 1.08, e), sz: lerp(1, 1.08, e) }, armL: { rx: lerp(-2.7, 0.35, e), rz: lerp(-0.3, 0, e) }, armR: { rx: lerp(-2.7, 0.35, e), rz: lerp(0.3, 0, e) }, head: { rx: lerp(-0.2, 0.2, e) }, tell: { s: 1 } };
    }),
    'slam.recover': clip(1.1, [0, 0.3, 0.7, 1], u => {
      const e = ease(u);
      return { body: { rx: lerp(0.35, 0, e), ty: lerp(-0.05, 0, e), sy: lerp(0.86, 1, e), sx: lerp(1.08, 1, e), sz: lerp(1.08, 1, e) }, armL: { rx: lerp(0.35, 0, e) }, armR: { rx: lerp(0.35, 0, e) }, head: { rx: lerp(0.2, 0, e) }, tell: { s: Math.max(0, 1 - u * 3) } };
    }),
    // stunned against a wall: rocked back, the head lolling, the bell ringing in a slow wobble
    stun: clip(2.0, [0, 0.1, 0.25, 0.4, 0.55, 0.7, 0.85, 1], u => {
      const w = Math.sin(u * TAU * 3) * (1 - u * 0.5);
      return { body: { rx: -0.25 * (1 - ease(Math.max(0, (u - 0.8) / 0.2))), rz: 0.12 * w }, head: { rz: 0.35 * Math.sin(u * TAU * 1.5), rx: 0.25 }, armL: { rz: 0.3 * Math.max(0, w) }, armR: { rz: -0.3 * Math.max(0, -w) } };
    }),
    rise: clip(0.9, [0, 0.3, 0.6, 0.85, 1], u => {
      const e = ease(u);
      return { body: { ty: lerp(-2.0, 0, e), rx: lerp(0.5, 0, e) }, armL: { rx: lerp(-1.4, 0, e) }, armR: { rx: lerp(-1.4, 0, e) }, head: { rx: lerp(0.5, 0, e) } };
    })
  }
};

/* ---------------- the light carried after the fall ----------------
   About 60 pale splats on one bone, in wisp slots 38 and 39, so a reload after the boss's fall can show the light at the lantern
   without the boss files. The page sets the bone where the lantern is (pool.place). */
const light = {
  code: 'L', name: 'light', title: 'carried light', height: 0.3, radius: 0.15, res: 1.6,
  bones: [{ name: 'light', pivot: [0, 0.5, 0] }],
  sculpt(S, at) {
    S.ball(at(0, 0.5, 0), 0.075, MAT.wispPale, tag('light', { res: 0.028 }));
    S.ball(at(0, 0.585, 0), 0.04, MAT.wispDim, tag('light', { res: 0.025 }));
  },
  clips: { rest: clip(1, [0, 0.5, 1], u => ({ light: { s: 1 + 0.08 * Math.sin(u * TAU), ty: 0.03 * Math.sin(u * TAU) } }), true) }
};

export const FIGURES = [snuffer, pitchrook, mirelight, ironback, light];

/* ---------------- pictures: node bake.mjs foes --preview --out DIR ----------------
   A sheet of each foe in its poses, and each foe standing in The Sunken Gaol at the phone art size (147x317, from 12.75 m) and the
   desktop art size (320x180, from 8.5 m). */
export async function previews({ built, json, worlds, places, out, sheet, lineup, readFigureFiles }) {
  const P = (code, list) => list.map(([clipName, t, extra]) => ({ clip: clipName, t, ...extra }));
  const poses = {
    S: P('S', [['rest', 0], ['walk', 0.2], ['hook.windup', 0.54], ['hook.attack', 0.1], ['hook.recover', 0.1], ['down', 0.3], ['rise', 0.45]]),
    P: P('P', [['rest', 0], ['walk', 0.2], ['lob.windup', 0.79], ['lob.attack', 0.05], ['lob.recover', 0.2], ['hurt', 0.12], ['rise', 0.45]]),
    M: P('M', [['rest', 0], ['walk', 0.2], ['pulse.windup', 0.69], ['pulse.attack', 0.05], ['hurt', 0.15], ['rise', 0.45]]),
    I: P('I', [['rest', 0], ['walk', 0.3], ['charge.windup', 0.89], ['charge.attack', 0.1], ['slam.windup', 0.74], ['slam.attack', 0.1], ['stun', 0.5]])
  };
  const gaol = JSON.parse((await import('node:fs')).readFileSync(`${places}/gaol.json`, 'utf8')).pal;
  for (const code of ['S', 'P', 'M', 'I']) sheet(built, json, { file: `${out}/sheet-${code}.png`, codes: [code], poses, pal: gaol, yaw: 0.45 });
  const src = readFigureFiles('foes', worlds);
  const fig = (code, o = {}) => ({ code, src, ...o });
  const four = [fig('S'), fig('P'), fig('M'), fig('I')];
  // in the Gaol's yard by the cells, the lamplighter facing the keep (a point where both cameras see clear)
  const from = [1, 6, Math.PI];
  // a phone sees only about 2 m to each side of the lamplighter, so the row is closer together and farther off there
  for (const [name, w, h, dist, pitch, spread, ahead] of [['desktop', 320, 180, 8.5, 0.32, 1.8, 4.5], ['phone', 147, 317, 12.75, 0.34, 1.15, 5.5]]) {
    await lineup({ place: 'gaol', worlds: places, file: `${out}/gaol-${name}.png`, figures: four, w, h, dist, pitch, spread, ahead, from });
    // the tells at the end of each wind-up, with the Pitchrook's ring and the Ironback's slam ring
    await lineup({
      place: 'gaol', worlds: places, file: `${out}/gaol-${name}-tells.png`, w, h, dist, pitch, spread, ahead, from,
      figures: [fig('S', { clip: 'hook.windup', t: 0.54 }), fig('P', { clip: 'lob.windup', t: 0.79, markers: ringNames.map(n => ({ name: n, dz: -2.5 })) }),
        fig('M', { clip: 'pulse.windup', t: 0.69 }), fig('I', { clip: 'slam.windup', t: 0.74, markers: ringNames.map(n => ({ name: n })) })]
    });
  }
  // each foe alone, a close look at the desktop size
  for (const code of ['S', 'P', 'M', 'I']) await lineup({ place: 'gaol', worlds: places, file: `${out}/gaol-close-${code}.png`, figures: [fig(code)], w: 320, h: 180, dist: 4.5, pitch: 0.15, ahead: 3.5, from, close: 0.9, yawOff: 0.5 });
}
