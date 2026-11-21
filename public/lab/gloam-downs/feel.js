// Gloam Downs: how a hit feels, on the game clock. The camera kick (the square of a shake value that falls over time, times smooth
// noise: Squirrel Eiserloh, "Juicing Your Cameras With Math", GDC 2016), the short zoom on a heavy hit, and the grade of the 48
// colours (after K.anim.show's blends in Ink Studio): the hurt tint, the low-health pull with its heartbeat, the white of the boss's
// fall and the fade to ink at death. Every time is in game steps, which go on in hit stop, so an effect lasts the same at any frame
// rate and in ?test. Each effect has its own flag in fx (kick, zoom, grade); with reduced motion there is no kick, no zoom and no
// white, and the low-health tint stays at 15% with no pulse. No DOM.

export const FEEL = {
  tint: 3, zoom: 7, zoomK: 1.05, beat: 55, low: 0.3, pull: 0.25, still: 0.15, fade: 72, fall: 6, kick: 4, decay: 0.6,
  add: { cut1: 0.03, cut2: 0.03, fin: 0.05, plunge: 0.05, hurt: 0.1, slam: 0.25 }, heavy: 20
};
const RED = 0x8a1a12, HURT = 0xb02418;
const mix = (a, b, k) => {
  const ch = s => Math.round(((a >> s) & 255) + (((b >> s) & 255) - ((a >> s) & 255)) * k);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
};
// smooth noise in -1..1: three sines at frequencies that never line up
const noise = (t, s) => (Math.sin(t * 17.3 + s) * 0.5 + Math.sin(t * 29.7 + s * 2.1) * 0.3 + Math.sin(t * 43.1 + s * 3.7) * 0.2);

export function makeFeel({ pal, still = false, fx = {} }) {
  const F = { step: 0, trauma: 0, zoomTo: -1, tintTo: -1, beatAt: -1e9, low: false, fadeAt: -1, fallAt: -1, beats: 0 };
  const on = k => fx[k] !== false;
  // a hit the lamplighter lands: kind is the blade's cut1, cut2, fin or plunge
  F.hit = kind => {
    F.trauma = Math.min(1, F.trauma + (FEEL.add[kind] ?? 0.03));
    if (kind === 'fin' || kind === 'plunge') F.zoomTo = F.step + FEEL.zoom;
  };
  // a hit on the lamplighter
  F.hurt = dmg => {
    F.trauma = Math.min(1, F.trauma + FEEL.add.hurt);
    F.tintTo = F.step + FEEL.tint;
    if (dmg >= FEEL.heavy) F.zoomTo = F.step + FEEL.zoom;
  };
  // a boss slam or a phase change (stage 3): k is 0.2 to 0.3
  F.shock = (k = FEEL.add.slam) => { F.trauma = Math.min(1, F.trauma + k); };
  F.dead = () => { if (F.fadeAt < 0) F.fadeAt = F.step; };
  // the white of the boss's fall: fire slot 37 at up to 50% on slots 1 to 31, never brighter than fire; none with reduced motion
  F.fall = () => { if (!still) F.fallAt = F.step; };
  /* one game step. share is health over the maximum: below 30% the heart beats every 55 steps, at once when it falls under.
     -> the cues of this step */
  F.tick = (share = 1) => {
    F.step++;
    F.trauma = Math.max(0, F.trauma - FEEL.decay / 60);
    const cues = [];
    const low = share > 0 && share < FEEL.low;
    if (low && (!F.low || F.step - F.beatAt >= FEEL.beat)) { F.beatAt = F.step; F.beats++; cues.push('heart'); }
    F.low = low;
    return cues;
  };
  // the camera's offset in metres along its right and up vectors: [x, y, z]
  F.kick = (yaw = 0, pitch = 0.34) => {
    if (still || !on('kick') || F.trauma <= 0) return [0, 0, 0];
    const t = F.step / 60, a = F.trauma * F.trauma * FEEL.kick, kx = noise(t, 1.3) * a, ky = noise(t, 4.1) * a;
    const rx = Math.cos(yaw), rz = -Math.sin(yaw), ux = -Math.sin(pitch) * Math.sin(yaw), uy = Math.cos(pitch), uz = -Math.sin(pitch) * Math.cos(yaw);
    return [rx * kx + ux * ky, uy * ky, rz * kx + uz * ky];
  };
  F.zoom = () => (still || !on('zoom') || F.step >= F.zoomTo ? 1 : FEEL.zoomK);
  // the beat's pull toward dark red, 0..0.25: at once on the beat, then fading (with reduced motion, 0.15 and steady)
  F.pull = () => {
    if (!F.low) return 0;
    if (still) return FEEL.still;
    const u = (F.step - F.beatAt) / FEEL.beat;
    return FEEL.pull * Math.exp(-u * 5);
  };
  // the 48 colours after the grade, or null when nothing changes them. Slots 32 to 47 (fire, wisp, cloak, iron, lamp) never change
  // but in the fade to ink, so fire stays the brightest colour
  F.grade = () => {
    if (!on('grade')) return null;
    const tint = F.step < F.tintTo, pull = F.pull(), fade = F.fadeAt >= 0 ? Math.min(1, (F.step - F.fadeAt) / FEEL.fade) : 0;
    const white = F.fallAt >= 0 && F.step - F.fallAt < FEEL.fall ? 0.5 * (1 - (F.step - F.fallAt) / FEEL.fall) : 0;
    if (!tint && !pull && !fade && !white) return null;
    return pal.map((c, i) => {
      let v = c;
      if (i >= 1 && i <= 31) {
        if (pull) v = mix(v, RED, pull);
        if (tint) v = mix(v, HURT, 0.4);
        if (white) v = mix(v, pal[37], white);
      }
      if (fade) v = mix(v, pal[0], fade);
      return v;
    });
  };
  F.reset = () => { F.trauma = 0; F.zoomTo = F.tintTo = F.fadeAt = F.fallAt = -1; F.low = false; };
  return F;
}
// the grade as the renderer takes it: 64 colours as rgb floats
export function gradeFloats(cols, out = new Float32Array(64 * 3)) {
  cols.forEach((c, i) => { out[i * 3] = ((c >> 16) & 255) / 255; out[i * 3 + 1] = ((c >> 8) & 255) / 255; out[i * 3 + 2] = (c & 255) / 255; });
  return out;
}
