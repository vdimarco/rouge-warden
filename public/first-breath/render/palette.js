// First Breath: the colour script (design.md 13.2), as plain data. The renderer, render/rings.js, render/debug.js and
// palette.test.mjs read it; node imports it too, so it holds no DOM and no code beyond two small lookups.
//
// Each stage row lists its tokens by name (hex), then the roles of 13.2: `back` (the lit back sheet and its
// details), `frames` (front → back, the darkest frame first), `bodies`, `cues` (main first) and `tint`. A cue is
// { id, token, kind: "sticker" | "keyline" | "plain", under: [token names it can sit on], dom? (a DOM ring), glow?
// (a paper glow, not a contrast cue) }. `keyline` is the halo colour (ink, cream in the ending).
//
// Contract choices (13.2 gives a table, not a shape):
// - Stage keys are the draw list's `stage` values: the 8 stage ids and "ending". The title draws with "swim".
// - Every hex in the table is a token; shared tokens (SHARED) are not repeated in the rows, except where a row
//   names one as its own cue (stage 1 and 2 `you`, the DOM ring colours), so each cue's `under` list resolves inside
//   its own row.
// - "rivals as stage 1" (stage 2) copies the three rival tokens; "corona (all four)" is the three corona tokens and
//   the path dots; "back frame" is the backmost frame token (the last in `frames`).
// - Paper glows (stage 4 soft spots, stage 5 move glow, stage 6 warm patch and hand glow, stage 7 roomy glow) are
//   tokens with glow: true where they are cues; they take no contrast rule.

export const SHARED = Object.freeze({
  ink: "#1a0610",        // the keyline (halo), every drop shadow, the scrim base
  margin: "#fff0cf",     // a sticker's cream card
  glow: "#fff4e2",       // the paper glow
  you: "#ffc53d",        // the one marigold accent
  youBack: "#ee951c",    // the back of a twisted ribbon
  tag: "#fff0dc",        // DOM label tags and cream buttons
  tagInk: "#3a1029",
  white: "#ffffff",
});

// Shadows are ink at this alpha range.
export const SHADOW_ALPHA = Object.freeze([0.28, 0.42]);

const RIVALS = { rival: "#967088", rivalBack: "#7c5872", rivalRest: "#84607a" };

const row = (r) => Object.freeze({
  ...r,
  tokens: Object.freeze(r.tokens),
  back: Object.freeze(r.back),
  frames: Object.freeze(r.frames),
  bodies: Object.freeze(r.bodies),
  cues: Object.freeze(r.cues.map((c) => Object.freeze({ ...c, under: Object.freeze(c.under || []) }))),
});

export const STAGES = Object.freeze({
  swim: row({
    name: "The Race",
    tokens: {
      floor: "#86355a", floorDot1: "#9b4a6c", floorDot2: "#702b4c", waveBand: "#a3536f",
      wall1: "#36102a", wall2: "#4c1839", wall3: "#64224a",
      warmTube: "#e8834f", lane: "#f6ab48", coolTube: "#4e3a5e", meet: "#f3c9d6",
      ...RIVALS,
      you: "#ffc53d", chevrons: "#fde7c6", tint: "#ff9a8a",
    },
    back: ["floor", "floorDot1", "floorDot2", "waveBand"],
    frames: ["wall1", "wall2", "wall3"],
    sheets: ["warmTube", "lane", "coolTube", "meet"],
    bodies: ["rival", "rivalBack", "rivalRest"],
    cues: [
      { id: "you", token: "you", kind: "sticker",
        under: ["floor", "floorDot1", "floorDot2", "waveBand", "wall1", "wall2", "wall3", "warmTube", "lane", "coolTube"] },
      { id: "chevrons", token: "chevrons", kind: "keyline", under: ["lane", "warmTube"] },
    ],
    tint: "tint",
    keyline: SHARED.ink,
  }),

  egg: row({
    name: "The Egg",
    tokens: {
      board: "#5e1c34", ripples: "#6c2440",
      follicle: "#f4a88a", cilia: "#e8a090",
      corona1: "#f2a07e", corona2: "#f8c3a2", corona3: "#e07f66", pathDots: "#9a4a44",
      cell: "#ffc49c", shell: "#fbe3d0", innerDisc: "#ffd8b8", nucleus: "#f08c6c",
      ...RIVALS,
      arc: "#fff4e2", you: "#ffc53d", cutDashes: "#fff0cf", sealWave: "#ffe9a8", tint: "#ffb08a",
    },
    back: ["board", "ripples"],
    frames: ["follicle", "cilia"],
    sheets: [],
    bodies: ["corona1", "corona2", "corona3", "pathDots", "cell", "shell", "innerDisc", "nucleus", "rival", "rivalBack", "rivalRest"],
    cues: [
      { id: "arc", token: "arc", kind: "keyline",
        under: ["board", "ripples", "corona1", "corona2", "corona3", "pathDots", "rival", "rivalBack", "rivalRest"] },
      { id: "you", token: "you", kind: "sticker", under: ["board", "ripples", "pathDots"] },
      { id: "sealWave", token: "sealWave", kind: "keyline", under: ["shell", "cell"] },
    ],
    tint: "tint",
    keyline: SHARED.ink,
  }),

  split: row({
    name: "The Embryo",
    tokens: {
      back: "#7a2c50",
      frame1: "#3a1030", frame2: "#52183e", frame3: "#6a2448", tubeWalls: "#64224a",
      cells: "#f07860", cellCore: "#fff0dc", shell: "#fbe3d0", hollow: "#ffd8b8",
      approachRing: "#ffc53d", holdRing: "#fff4e2", tint: "#ff9a7a",
    },
    back: ["back"],
    frames: ["frame1", "frame2", "frame3"],
    sheets: ["tubeWalls"],
    bodies: ["cells", "cellCore", "shell", "hollow"],
    cues: [
      { id: "approach", token: "approachRing", kind: "keyline", dom: true, under: ["back", "cells", "shell"] },
      { id: "hold", token: "holdRing", kind: "keyline", dom: true, under: ["back", "cells", "hollow"] },
    ],
    tint: "tint",
    keyline: SHARED.ink,
  }),

  root: row({
    name: "The Placenta",
    tokens: {
      lining: "#7a1e34", deepLining: "#5c1428",
      frame1: "#2e0814", frame2: "#44101e", frame3: "#5a1628", thinLayer: "#ffd8c8",
      tree: "#f4a890", beads: "#fff0dc", you: "#ffb8a0", softSpot: "#fff4e2",
      pools: "#f3eadf", poolRim: "#fff8ee", heartRing: "#fff4e2", tint: "#ff8a6a",
    },
    back: ["lining", "deepLining"],
    frames: ["frame1", "frame2", "frame3"],
    sheets: ["thinLayer"],
    bodies: ["tree", "beads", "you", "softSpot"],
    cues: [
      { id: "pools", token: "pools", kind: "keyline", under: ["lining", "deepLining"] },
      { id: "heart", token: "heartRing", kind: "keyline", dom: true, under: ["lining", "tree"] },
      { id: "softSpot", token: "softSpot", kind: "plain", glow: true, under: [] },
    ],
    tint: "tint",
    keyline: SHARED.ink,
  }),

  grow: row({
    name: "First Trimester",
    tokens: {
      sac: "#d4788a", motes: "#ebb5b2",
      frame1: "#4e1430", frame2: "#8e2c4b", frame3: "#c25470",
      placenta: "#b04058", placenta2: "#c25470", pools: "#d9667c", poolRim: "#ffc8d0",
      cord: "#a8405a", cordBack: "#8a3048", body: "#f39477", head: "#f6a585", limbs: "#e57a62",
      you: "#ffc53d", cordLights: "#ffd25a", moveGlow: "#fff4e2", tint: "#ff8a7a",
    },
    back: ["sac", "motes"],
    frames: ["frame1", "frame2", "frame3"],
    sheets: [],
    bodies: ["placenta", "placenta2", "pools", "cord", "cordBack", "body", "head", "limbs"],
    cues: [
      { id: "heart", token: "you", kind: "sticker", under: ["body", "head", "sac"] },
      { id: "cordLights", token: "cordLights", kind: "plain", under: ["cord", "cordBack"] },
      { id: "poolRim", token: "poolRim", kind: "plain", under: ["placenta"] },
      { id: "moveGlow", token: "moveGlow", kind: "plain", glow: true, under: [] },
    ],
    tint: "tint",
    keyline: SHARED.ink,
  }),

  answer: row({
    name: "Second Trimester",
    tokens: {
      wall: "#c8703c",
      frame1: "#5e2a16", frame2: "#8a3a20", frame3: "#b4542c", fluid: "#e89a5a", dapple: "#f6c890",
      you: "#ffc0a0", warmPatch: "#ffd8b0", handGlow: "#ffd8b0",
      voiceRipples: "#fff0b8", answerGhosts: "#fff4e2", tint: "#ffa860",
    },
    back: ["wall"],
    frames: ["frame1", "frame2", "frame3"],
    sheets: ["fluid", "dapple"],
    bodies: ["you", "warmPatch", "handGlow"],
    cues: [
      { id: "voice", token: "voiceRipples", kind: "keyline", under: ["wall", "fluid", "frame3"] },
      { id: "ghosts", token: "answerGhosts", kind: "keyline", under: ["wall", "fluid", "frame3"] },
    ],
    tint: "tint",
    keyline: SHARED.ink,
    dappleAlphaMax: 0.12,
  }),

  turn: row({
    name: "Third Trimester",
    tokens: {
      back: "#d97a40",
      frame1: "#6e3214", frame2: "#9a4a20", frame3: "#c4602a", snugWalls: "#e8925a", dapple: "#ffd8a0",
      you: "#ffc8a0", breathRing: "#fff4e2", roomyGlow: "#ffe0a0", tint: "#ffb36b",
    },
    back: ["back"],
    frames: ["frame1", "frame2", "frame3"],
    sheets: ["snugWalls", "dapple"],
    bodies: ["you"],
    cues: [
      { id: "breath", token: "breathRing", kind: "keyline", dom: true, under: ["back", "snugWalls", "you", "frame3"] },
      { id: "roomy", token: "roomyGlow", kind: "plain", glow: true, under: [] },
    ],
    tint: "tint",
    keyline: SHARED.ink,
  }),

  birth: row({
    name: "Birth",
    tokens: {
      back: "#6a2a4a",
      flat1: "#2a0818", flat2: "#3e1028", flat3: "#521a38",
      you: "#e8a0b8", opening: "#fff4e2", openingFull: "#ffffff",
      waveRing: "#fff4e2", arrow: "#ffc53d", tint: "#ffffff",
    },
    back: ["back"],
    frames: ["flat1", "flat2", "flat3"],
    sheets: [],
    bodies: ["you", "opening", "openingFull"],
    cues: [
      { id: "wave", token: "waveRing", kind: "keyline", dom: true, under: ["back", "flat1", "flat2", "flat3", "you"] },
      { id: "arrow", token: "arrow", kind: "sticker", under: ["back", "you", "opening", "flat3"] },
    ],
    tint: "tint",
    keyline: SHARED.ink,
  }),

  ending: row({
    name: "First Breath",
    tokens: {
      back: "#ffe8d6", room1: "#ffd2b8", room2: "#fff4ea",
      bigOval: "#ffc9a8", smallOval: "#ffb38a",
      rings: "#7a2e1e", text: "#4a1e10", keyline: "#fff8f0", tint: "#ffffff",
    },
    back: ["back"],
    frames: ["room1", "room2"],
    sheets: [],
    bodies: ["bigOval", "smallOval"],
    cues: [
      { id: "rings", token: "rings", kind: "keyline", under: ["back", "room1", "room2", "bigOval", "smallOval"] },
      { id: "text", token: "text", kind: "keyline", under: ["back", "room1", "room2"] },
    ],
    tint: "tint",
    keyline: "#fff8f0",
  }),
});

// The DOM rings of render/rings.js, each stroked over a keyline 2 px wider (cream in the ending).
export const RINGS = Object.freeze({
  mother: "#ffc53d",     // her ring, solid
  you: "#fff4e2",        // your heart, dashed with a dot
  target: "#fff4e2",     // approach, hold, breath, wave, prompt, rest
  burrow: "#fff0cf",     // dotted for rivals, dashed for your sperm
  keyline: SHARED.ink,
  keylineEnding: "#fff8f0",
  keylineExtraPx: 2,
});

// The DOM UI (style.css holds the same values).
export const UI = Object.freeze({
  tag: SHARED.tag,
  tagInk: SHARED.tagInk,
  play: SHARED.you,
  playInk: SHARED.tagInk,
  scrim: "rgba(26, 6, 16, 0.72)",
  scrimText: "#fff4ea",
  focus: SHARED.you,     // a 3 px ring with a 1 px ink line outside it
  focusLine: SHARED.ink,
});

export const STAGE_KEYS = Object.freeze(Object.keys(STAGES));

// A token's hex in a stage row (or a shared token), else null.
export function hex(stage, name) {
  const r = STAGES[stage];
  if (r && Object.prototype.hasOwnProperty.call(r.tokens, name)) return r.tokens[name];
  return Object.prototype.hasOwnProperty.call(SHARED, name) ? SHARED[name] : null;
}

// The lit back sheet of a stage (the title and an unknown key use stage 1's).
export function backOf(stage) {
  const r = STAGES[stage] || STAGES.swim;
  return r.tokens[r.back[0]];
}

// ---- Renderer roles (render/items.js, render/bake.js): which token each draw-list item takes in each stage, and
// the stage's frames. Data only. A role is a token name of the stage row (or SHARED), a literal hex, or
// { mix: [a, b, t] } (a mixed from a toward b by t). The tokens the 13.2 table does not name (the stage 7 placenta
// disc and cord, the stage 6 and 7 cord, the derived figure pieces of stages 4 and 6 to 8) are mixes of the row's
// own tokens, so they stay inside its colour family; RENDER_TOKENS lists the few literal additions.
//
// splats: rules tried in order; the first that matches a splat sets its role. Fields: hue [lo, hi] (inclusive),
// k ("c" | "s"), m [lo, hi], v [lo, hi], r [lo, hi] (u), token, h (sheet height, px at step 1), group ("figure":
// one union shadow, each piece its own sheet; "cells": the same, each piece with a pale cut edge; "heart": the
// heart sheet; "solo": its own body), core (the pale cut-edge token), sticker (keyline and cream margin), nucleus
// (a disc on top when n > 0), piece (figure pieces: "head" for the first disc, "body" for the first capsule,
// "limb" for the rest).
export const RENDER_TOKENS = Object.freeze({
  turnDisc: "#b04a2c", turnDisc2: "#c25a34",     // stage 7 placenta disc and its lobes (frame3 family, darker)
});

const FIG = (tok, head, limb, h = 4.5) => [
  { hue: [0.025, 0.035], k: "c", group: "figure", piece: "head", token: head, h },
  { hue: [0.025, 0.035], group: "figure", piece: "body", token: tok, h, limbs: limb },
];

export const ROLES = Object.freeze({
  swim: {
    back: "floor",
    course: {
      walls: ["wall3", "wall2", "wall1"],          // inner to outer; drawn in this order, each higher and darker
      depth: [0, 5, 10], height: [4.5, 4.5, 9],
      floorDots: ["floorDot1", "floorDot2"],
      tones: { womb: null, warm: "warmTube", cool: "coolTube" },
    },
    splats: [
      { m: [1.2, 9], token: "you", h: 7.5, group: "solo", sticker: true },
      { token: "rival", h: 4, group: "solo" },
    ],
    tails: { rival: "rival", rivalBack: "rivalBack", you: "you", youBack: "youBack" },
    lane: "lane", chevron: "chevrons", band: "waveBand", meet: "meet",
    ripple: "glow", glow: "glow", warm: "lane", arrow: { token: "chevrons", sticker: false },
    frames: null,
  },
  egg: {
    back: "board", wash: 0.12,
    splats: [
      { hue: [0.015, 0.025], token: "follicle", h: 3, group: "solo", scallops: 16 },
      { hue: [0.045, 0.055], token: "shell", h: 4.5, group: "solo" },
      { hue: [0.065, 0.075], token: "cell", h: 5.5, group: "solo" },
      { hue: [0.075, 0.085], token: "innerDisc", h: 6, group: "solo", nucleus: "nucleus" },
      { hue: [0.025, 0.035], token: "nucleus", h: 6.5, group: "solo" },
      { token: "you", h: 7, group: "solo", sticker: true },
    ],
    dots: ["corona1", "corona2", "corona3"], dotsDim: "pathDots", dotR: [1.3, 0.5],
    tails: { rival: "rival", rivalBack: "rivalBack", you: "you", youBack: "youBack", dashes: "cutDashes" },
    ripple: "glow", rippleBig: "ripples", cilia: "cilia", arc: "arc", arcSmall: "sealWave", glow: "glow",
    // the action layer (render/action.js): the glow and your returned sparks are cream like the arc (marigold stays
    // your gold sperm); the gifts are cream stars
    action: { mine: "arc", up: "cutDashes" },
    frames: null,
  },
  split: {
    back: "back", wash: 0.4,
    course: {
      walls: ["tubeWalls", "frame2"], depth: [0, 7], height: [3.5, 6],
      floorDots: [{ mix: ["back", "frame3", 0.6] }, { mix: ["back", "glow", 0.12] }],
      tones: { womb: null, warm: null, cool: null },
    },
    splats: [
      { hue: [0.015, 0.025], token: "cells", core: "cellCore", h: 4.5, group: "cells" },
      { hue: [0.085, 0.095], token: "hollow", h: 3, group: "solo" },
    ],
    dots: [{ mix: ["back", "glow", 0.4] }], dotR: [1.2, 0.35],
    cilia: { mix: ["tubeWalls", "glow", 0.32] }, arc: "shell", ripple: "glow",
    band: { mix: ["back", "tubeWalls", 0.55] }, glow: "glow",
    // the action layer (render/action.js ACTION_TONES fills the rest): germs in teal and sage (design.md 4.8)
    action: { foe: "#6f9a8e", foe2: "#9fae7e" },
    frames: { shape: "oval", tokens: ["frame3", "frame2", "frame1"], size: 0.64 },
  },
  root: {
    back: "lining", wash: 0.62,
    splats: [
      { hue: [0.035, 0.045], token: "you", h: 5, group: "solo" },
      { hue: [0.055, 0.065], token: "beads", h: 6, group: "solo" },
      ...FIG("you", { mix: ["you", "beads", 0.25] }, { mix: ["you", "tree", 0.5] }),
      { hue: [0.97, 0.99], token: { mix: ["you", "beads", 0.55] }, h: 5.5, group: "heart" },
      { hue: [0.015, 0.025], token: "tree", h: 4, group: "solo" },
      { hue: [0.085, 0.095], token: "beads", h: 6, group: "solo", sticker: true },
      { hue: [0.065, 0.075], token: { mix: ["tree", "beads", 0.4] }, h: 4, group: "solo" },
    ],
    tree: "tree", beads: "beads", pool: "pools", poolOn: { mix: ["pools", "tree", 0.45] }, poolRim: "poolRim",
    lake: { mix: ["tree", "deepLining", 0.35] }, lake2: { mix: ["tree", "beads", 0.2] },
    spot: { mix: ["lining", "thinLayer", 0.22] }, spotOn: { mix: ["lining", "thinLayer", 0.5] },
    ripple: "beads", glow: "softSpot",
    frames: { shape: "oval", scallops: 9, depthK: 1.6, tokens: ["frame3", "frame2", "frame1"], size: 0.68 },
  },
  grow: {
    back: "sac", motes: "motes",
    splats: [
      ...FIG("body", "head", "limbs"),
      { hue: [0.97, 0.99], token: "you", h: 6, group: "heart", sticker: true },
      { hue: [0.015, 0.025], token: "cord", h: 4, group: "solo" },
    ],
    tree: "placenta2", beads: "poolRim", cord: "cord", cordBack: "cordBack", lights: "cordLights",
    lake: "placenta", lake2: "placenta2", pool: { mix: ["placenta2", "sac", 0.25] }, poolOn: "pools", poolRim: "poolRim",
    ripple: "poolRim", glow: "moveGlow", arrow: { token: "glow", sticker: false },
    // the action layer (render/action.js ACTION_TONES fills the rest): the sac's wall in the placenta's colour
    action: { wall: { mix: ["frame3", "sac", 0.35] } },
    frames: { shape: "scallop", scallops: 12, tokens: ["frame3", "frame2", "frame1"], size: 0.62 },
  },
  answer: {
    back: "wall", inner: "fluid",
    splats: [
      ...FIG("you", { mix: ["you", "warmPatch", 0.35] }, { mix: ["you", "frame3", 0.18] }),
      { hue: [0.97, 0.99], token: { mix: ["you", "frame3", 0.35] }, h: 5, group: "heart" },
      { hue: [0.015, 0.025], token: { mix: ["frame3", "you", 0.4] }, h: 4, group: "solo" },
    ],
    tree: { mix: ["you", "warmPatch", 0.5] }, beads: "voiceRipples",
    cord: { mix: ["frame3", "you", 0.4] }, cordBack: { mix: ["frame3", "frame2", 0.4] }, lights: "voiceRipples",
    disc: { mix: ["frame3", "fluid", 0.3] }, ripple: "voiceRipples", ghost: "answerGhosts",
    glow: "warmPatch", hand: "handGlow", slot: "answerGhosts", dapple: "dapple",
    frames: { shape: "scallop", scallops: 9, depthK: 1.5, tokens: ["frame3", "frame2", "frame1"], size: 0.52 },
  },
  turn: {
    back: "back", inner: { mix: ["back", "frame3", 0.4] },     // a deeper ember floor, so you and the germs stand out
    splats: [
      { hue: [-0.001, 0.005], token: "turnDisc", h: 3, group: "solo" },
      { hue: [0.005, 0.015], token: "turnDisc2", h: 3.5, group: "solo" },
      ...FIG("you", { mix: ["you", "dapple", 0.3] }, { mix: ["you", "frame3", 0.2] }),
      { hue: [0.97, 0.99], token: { mix: ["you", "frame3", 0.35] }, h: 5, group: "heart", sticker: true },
      { hue: [0.015, 0.025], token: { mix: ["frame3", "you", 0.4] }, h: 4, group: "solo" },
    ],
    cord: { mix: ["frame3", "you", 0.35] }, cordBack: { mix: ["frame3", "frame2", 0.4] }, lights: "roomyGlow",
    snug: "snugWalls", arc: "breathRing", ripple: "breathRing", glow: "roomyGlow", dapple: "dapple",
    // the action layer (render/action.js): the snug wall closing in, her antibodies as cream paper Ys (design.md 5.7)
    action: { wall: { mix: ["frame3", "snugWalls", 0.45] }, mine: "breathRing" },
    frames: { shape: "oval", tokens: ["frame3", "frame2", "frame1"], size: 0.5 },
  },
  birth: {
    back: "back",
    splats: [
      ...FIG("you", { mix: ["you", "opening", 0.25] }, { mix: ["you", "flat3", 0.2] }),
      { hue: [0.97, 0.99], token: { mix: ["you", "flat3", 0.3] }, h: 5, group: "heart" },
      { hue: [0.015, 0.025], token: { mix: ["flat3", "you", 0.45] }, h: 4, group: "solo" },
    ],
    ripple: "waveRing", glow: "opening", arrow: { token: "arrow", sticker: true },
    frames: { shape: "sides", tokens: ["flat3", "flat2", "flat1"], size: 0.5 },
  },
  ending: {
    back: "back",
    splats: [
      { k: "s", r: [15, 1e9], token: "bigOval", h: 5, group: "solo" },
      { token: "smallOval", h: 6, group: "solo" },
    ],
    dots: ["rings"], dotR: [1.6, 0.4], ripple: "rings", glow: "room2", spot: "smallOval",
    frames: { shape: "room", tokens: ["room1", "room2"], size: 0.5, behind: true },
  },
});

// A role's hex in a stage: a token name, a literal hex or { mix: [a, b, t] } (null when it does not resolve).
export function roleHex(stage, role) {
  if (!role) return null;
  if (typeof role === "string") {
    if (role[0] === "#") return role;
    return hex(stage, role) || (Object.prototype.hasOwnProperty.call(RENDER_TOKENS, role) ? RENDER_TOKENS[role] : null);
  }
  if (role.mix) {
    const [a, b, t] = role.mix;
    const ha = roleHex(stage, a), hb = roleHex(stage, b);
    return ha && hb ? mixHex(ha, hb, t) : ha || hb;
  }
  return null;
}

// a mixed from a toward b by t (sRGB, rounded), as #rrggbb.
export function mixHex(a, b, t) {
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const x = p(a), y = p(b);
  return "#" + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join("");
}
