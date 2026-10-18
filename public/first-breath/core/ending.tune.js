// First Breath: the ending (`ending`), its numbers (design.md 6.9, 5.1). Every time is in stage seconds from the
// ending's start. The ending is not scored, so nothing here grades anything; the numbers only lay the timeline.
export const TUNE = Object.freeze({
  // 0.0 to 1.5 s: white, then the warm room fades in; the one silence in her heartbeat (5.1)
  whiteS: 1.5,
  motherBpm: 76,              // her heart in the ending, back at 1.5 s
  heartFarGain: 0.25,         // her heart comes back soft and far (−12 dB)
  heartCloseGain: 1,          // ... and close and clear at skin-to-skin

  // the first breath: "Breathe." at 1.5 s, live gesture hold (optional)
  autoAfterS: 3.0,            // with no press, the breath comes by itself 3.0 s after the prompt (4.5 s)
  minHoldS: 0.4,              // an inhale lasts at least this long, also after a quick tap
  maxHoldS: 2.5,              // it lets go by itself after this long
  autoInhaleS: 1.0,           // the inhale of the breath that comes by itself
  breathFactS: 1.0,           // end.breath shows this long after the first cry

  // two more breaths by themselves, a little uneven (seeded), at about 6 to 9 s
  breath2At: 5.9, breath2JitterS: 0.4,
  afterCryS: 0.9,             // the next breath starts at least this long after a cry
  inhaleS: 0.7, inhaleJitterS: 0.2,
  breathGapS: 0.45, breathGapJitterS: 0.35,

  // skin-to-skin at about 9 s (later only after a late first breath), then the rest of the timeline from it
  skinAt: 9.0, skinAfterBreathS: 0.1,
  knowAfterS: 1.5,            // "You know this heartbeat."
  thumbAfterS: 3.0,           // 12 s: "Rest your thumb here."
  skinFactAfterS: 4.5,        // 13.5 s: end.skin
  songAfterS: 7.0,            // 16 s: your song, clear and full band
  noteS: 0.75,                // 16 notes, 12 s (16 to 28 s)
  voiceFactAfterS: 10.0,      // 19 s: end.voice
  restSettleAfterS: 19.0,     // 28 s: the rest sub-goal settles (by itself if no touch)
  timeAfterS: 20.0,           // 29 s: "Your nine months took 9 min 48 s."
  endAfterS: 24.0,            // 33 s: the run result

  capS: 40,

  // the view (world u; the short axis is 100 u, 2 m across)
  span: 100,
  you: { x: 0, y: 0, half: 4.5, r: 7, hue: 0.07 },            // the small oval: one capsule
  big: { half: 20, r: 22, y: -16, fromY: -72, hue: 0.05 },    // the big warm oval at skin-to-skin
  bigRiseS: 2.0,
  light: { r: 46, y: -8, riseS: 2.0 },                         // the circle of cream light
  thumbRing: { x: 0, y: -78, r: 9 },                           // portrait default; the host docks it by layout
  restPulseS: 4.0,                                             // the thumb ring's slow pulse while untouched
  ripple: { life: 2.5, r0: 9, grow: 18 },
  noteRipple: { life: 1.5, r0: 24, grow: 14 },
  sparks: { max: 8, ringR: 11, r: 1.2 },
});
