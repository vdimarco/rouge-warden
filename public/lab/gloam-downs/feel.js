// Gloam Downs: how a hit feels, on the game clock. The camera kick (the square of a shake value that falls over time, times smooth
// noise: Squirrel Eiserloh, "Juicing Your Cameras With Math", GDC 2016), the short zoom on a heavy hit, and the grade of the 48
// colours (after K.anim.show's blends in Ink Studio): the hurt tint, the low-health pull with its heartbeat, the pull toward fire at
// the boss's fall and the fade to ink at death; and the letterbox bars and the zoom of the boss intro. Every time is in game steps,
// which go on in hit stop, so an effect lasts the same at any frame rate and in ?test. Each effect has its own flag in fx (kick, zoom,
// grade); with reduced motion there is no kick, no zoom and no pull at the fall, and the low-health tint stays at 15% with no pulse.
// The kick is gentle: a cut adds nothing, only heavy hits do (the finisher, the plunge, a hit taken, a stagger, the boss slam and a
// phase change), and its offset never passes 0.15 m (Jan Willem Nijman, "The art of screenshake", 2013: shake the heavy hits only).
// The Shake switch (fx.kick) turns the kick on under reduced motion too; zoom and grade keep their reduced-motion rules. No DOM.

export const FEEL = {
  tint: 3, zoom: 7, zoomK: 1.05, beat: 55, low: 0.3, pull: 0.25, still: 0.15, fade: 72, fall: 6, kick: 2.4, decay: 0.6, most: 0.15,
  add: { cut1: 0, cut2: 0, fin: 0.17, plunge: 0.18, hurt: 0.1, stagger: 0.08, slam: 0.22, relic: 0, snap: 0.06 }, heavy: 20,
  // the boss intro's zoom, eased in and out over 30 steps, and the letterbox bars' height as a share of the screen
  intro: 1.15, introEase: 30, bars: 0.12
};
/* poise and stagger (after poise in Dark Souls and stance in Elden Ring, cited from memory; gloam-downs-fair-fight "Poise and armor"):
   each hit takes its damage from the poise too, twice over in a wind-up (wind); at 0 the foe staggers for 1.2 s (72 steps): it stops,
   its wind-up ends, its crack glows and it takes 25% more. Poise fills again 3 s after the last hit, and a stagger cannot start again
   within 4 s of its end. The Ironback has 40, an elite 40, the Bellwether (the elite Ironback) 70; the boss has its own (boss.js) */
export const STAGGER = { steps: 72, gap: 240, refill: 180, take: 1.25, poise: { I: 40 }, elite: 40, eliteI: 70, wind: 2 };
export const poiseOf = f => f.poiseMax ?? (f.elite ? (f.type === 'I' ? STAGGER.eliteI : STAGGER.elite) : STAGGER.poise[f.type] ?? 0);
const ease = u => { const k = Math.max(0, Math.min(1, u)); return k * k * (3 - 2 * k); };
const RED = 0x8a1a12, HURT = 0xb02418;
const mix = (a, b, k) => {
  const ch = s => Math.round(((a >> s) & 255) + (((b >> s) & 255) - ((a >> s) & 255)) * k);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
};
// smooth noise in -1..1: three sines at frequencies that never line up
const noise = (t, s) => (Math.sin(t * 17.3 + s) * 0.5 + Math.sin(t * 29.7 + s * 2.1) * 0.3 + Math.sin(t * 43.1 + s * 3.7) * 0.2);

/* makeFeel({ pal, still, fx }): still is reduced motion. fx.kick is the Shake switch: true or false as the player set it, or undefined
   (the default: off under reduced motion, on otherwise). fx.zoom and fx.grade false turn those off */
export function makeFeel({ pal, still = false, fx = {} }) {
  const F = { step: 0, trauma: 0, zoomTo: -1, tintTo: -1, beatAt: -1e9, low: false, fadeAt: -1, fallAt: -1, beats: 0, bar: null, introOn: false, introAt: -1 };
  const on = k => fx[k] !== false;
  // a hit the lamplighter lands: kind is the blade's cut1, cut2, fin or plunge
  F.hit = kind => {
    F.trauma = Math.min(1, F.trauma + (FEEL.add[kind] ?? 0));
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
  // a foe's poise breaks
  F.stagger = () => F.shock(FEEL.add.stagger);
  // a hit cancels a foe's attack, or breaks its poise: a small kick (none with reduced motion, as every kick)
  F.snap = () => F.shock(FEEL.add.snap);
  F.dead = () => { if (F.fadeAt < 0) F.fadeAt = F.step; };
  // the boss's fall: slots 1 to 31 pull toward fire slot 37 by up to 50% for 6 steps, so the picture is never brighter than fire (a
  // white flash would be); none with reduced motion
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
  F.shakes = () => (fx.kick === true || fx.kick === false ? fx.kick : !still);
  F.kick = (yaw = 0, pitch = 0.34) => {
    if (!F.shakes() || F.trauma <= 0) return [0, 0, 0];
    const t = F.step / 60, a = F.trauma * F.trauma * FEEL.kick, kx = noise(t, 1.3) * a, ky = noise(t, 4.1) * a;
    const rx = Math.cos(yaw), rz = -Math.sin(yaw), ux = -Math.sin(pitch) * Math.sin(yaw), uy = Math.cos(pitch), uz = -Math.sin(pitch) * Math.cos(yaw);
    const v = [rx * kx + ux * ky, uy * ky, rz * kx + uz * ky], l = Math.hypot(v[0], v[1], v[2]);
    return l > FEEL.most ? v.map(c => (c * FEEL.most) / l) : v;
  };
  // the boss intro: the zoom eases to 1.15 while it is on, and back to 1 after (none with reduced motion or the zoom turned off)
  F.intro = onNow => { F.introOn = onNow; F.introAt = F.step; };
  const introZoom = () => {
    if (F.introAt < 0) return 1;
    const k = ease((F.step - F.introAt) / FEEL.introEase);
    return 1 + (FEEL.intro - 1) * (F.introOn ? k : 1 - k);
  };
  F.zoom = () => (still || !on('zoom') ? 1 : Math.max(F.step < F.zoomTo ? FEEL.zoomK : 1, introZoom()));
  /* the letterbox bars: from where they are now, eased to each [height, steps] in turn (the intro, the boss's fall, the last beacon).
     They are not motion, so reduced motion keeps them */
  F.barsTo = (...goals) => { F.bar = { from: F.bars(), goals, at: F.step }; };
  F.bars = () => {
    const b = F.bar;
    if (!b) return 0;
    let from = b.from, at = b.at;
    for (const [to, n] of b.goals) {
      const u = (F.step - at) / n;
      if (u < 1) return from + (to - from) * ease(u);
      from = to;
      at += n;
    }
    return from;
  };
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
    const toFire = F.fallAt >= 0 && F.step - F.fallAt < FEEL.fall ? 0.5 * (1 - (F.step - F.fallAt) / FEEL.fall) : 0;
    if (!tint && !pull && !fade && !toFire) return null;
    return pal.map((c, i) => {
      let v = c;
      if (i >= 1 && i <= 31) {
        if (pull) v = mix(v, RED, pull);
        if (tint) v = mix(v, HURT, 0.4);
        if (toFire) v = mix(v, pal[37], toFire);
      }
      if (fade) v = mix(v, pal[0], fade);
      return v;
    });
  };
  F.reset = () => { F.trauma = 0; F.zoomTo = F.tintTo = F.fadeAt = F.fallAt = F.introAt = -1; F.low = false; F.bar = null; F.introOn = false; };
  return F;
}
// the grade as the renderer takes it: 64 colours as rgb floats
export function gradeFloats(cols, out = new Float32Array(64 * 3)) {
  cols.forEach((c, i) => { out[i * 3] = ((c >> 16) & 255) / 255; out[i * 3 + 1] = ((c >> 8) & 255) / 255; out[i * 3 + 2] = (c & 255) / 255; });
  return out;
}
