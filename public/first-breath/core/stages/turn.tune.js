// First Breath: stage 7, Third Trimester (`turn`), its numbers (design.md 6.7, 4.1, 5.1, 5.2). Plain data, deep-frozen.
// Times are stage seconds; angles in degrees here (the stage turns them into radians).

const deep = (o) => {
  for (const v of Object.values(o)) if (v && typeof v === "object") deep(v);
  return Object.freeze(o);
};

export const TUNE = deep({
  motherBpm: 72,          // her rate all stage (P_beat = 0.833 s)
  leadS: 1.0,             // beat 1 is her first beat at or after this (5.1)

  // 1. breathe: 4 breaths of 8 of her beats; press on beat 1, let go on beat 5 (8 targets)
  breaths: 4,
  beatsPerBreath: 8,
  pressBeat: 1,
  releaseBeat: 5,
  ring: {
    r0: 30, r1: 42,       // the breath ring, u: small on beat 1, full on beat 5, small again by beat 8 (by itself)
    showS: 2.0,           // a target's ring shows this long before its time (≥ max(2 beats, 1.2 s), 5.2)
    approachR: 54,        // a press ring starts this wide and closes onto r0 on beat 1
    flashS: 0.5,          // how long a judged grade stays on the ring
  },

  // 2. turn: up to 30 s, then by itself over 3 s
  turn: {
    maxS: 30,             // the limit; the turn by itself starts here
    autoS: 3,             // ... and takes this long
    holdS: 1.2,           // after you reach head-down, the moment lingers this long (the figure settles)
    cycleS: 6.0,          // her slow breath: in-breath, then the out-breath (the roomy moment) at its end
    roomyS: 2.5,          // roomy moment length
    roomyAssistS: 3.5,    // ... with Assist
    roomyDegS: 60,        // turn speed in a roomy moment, × stick x
    outsideDegS: 15,      // ... outside one
    outsideAssistDegS: 25,
    headDownDeg: 20,      // head-down = within this of straight down (180° from head-up)
    fullDeg: 180,         // the score's "degrees turned in roomy moments / 180"
    settleDegS: 120,      // the last few degrees settle by themselves at this rate
    glowRampS: 0.6,       // the wall's glow builds this long before a roomy moment and fades this long after
  },

  // 3. rest: 16 s, not scored; the song is hummed, muffled
  rest: {
    s: 16,
    warmUpS: 1.5,         // holding warms your heart ring fully in this long
    warmDownS: 3.0,       // ... and it cools in this long when you let go
    noteLeadS: 0.6,       // the first hummed note, after the rest starts
    noteGapS: 0.95,       // 16 notes, one every 0.95 s (the last at 14.85 s)
  },

  // 4. outro
  outroS: 3,

  // section 7: Goal 3,000 + Skill (3,000 breaths + 3,000 turn) + Flourish 1,000
  score: { breaths: 3000, turn: 3000, flourish: 1000 },

  // the bot's steering (botSteer below skill 1): a lag into and out of each roomy moment, a softer stick
  bot: { lagS: 0.5, minStick: 0.55 },

  // fact captions, in order, each once gaDay reaches its day and the last caption is this old
  captionGapS: 4.5,
  captions: [
    ["turn.lungs", 203],
    ["turn.focus", 210],
    ["turn.voices", 217],
    ["turn.practice", 220],   // the span fact of weeks 31 to 34, a little after the voices one
    ["turn.curl", 238],
    ["turn.head", 252],       // gaDay reaches 252 only at head-down, or at the 30 s limit
  ],

  // the view, in world u (fit orient; the short axis is span u)
  view: {
    span: 100,
    crMm: [250, 360],     // your length head to bottom, curled, from week 28 to week 40 (about; it only sizes the figure)
    wallR: 47,            // the snug wall
    discDist: 40, discR: 11,
    youBpm: [140, 130],   // your heart over the stage (5.1)
  },
});
