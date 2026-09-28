// STUB: comfort (replaced by the swing agent)
// Bare comfort with the exact API of spec §8: 45° snap turns and no vignette, no reality fade, no safety bubble.
import { COMFORT } from "./config.js";

export function createComfort(camera, rig, settings) {
  let armed = true;
  const C = {
    settings, seatedOffset: 0,
    update() {},
    // stick x past 0.7 snaps once; it must come back under 0.3 before the next snap. Right is a negative yaw.
    turn(input) {
      const x = input.turn || 0;
      if (Math.abs(x) < COMFORT.snapOff) armed = true;
      if (armed && Math.abs(x) > COMFORT.snapOn) { armed = false; return (-Math.sign(x) * 45 * Math.PI) / 180; }
      return 0;
    },
    // copies a preset's look and feel into settings; "desktop" is a mode, not a choice, so it is never saved as the preset
    applyPreset(name) {
      const p = COMFORT.presets[name];
      if (!p) return;
      settings.vignette = p.vignette; settings.turn = p.turn; settings.snap = p.snap; settings.aim = p.aim;
      if (name !== "desktop") settings.preset = name;
    },
    calibrate(headLocalY) { C.seatedOffset = settings.seated ? Math.max(0, COMFORT.standingHead - headLocalY) : 0; },
    reality() {},
    bubble() {},
    realityInfo: () => ({ planes: 0, meshes: 0, maxFade: 0 }),
  };
  return C;
}
