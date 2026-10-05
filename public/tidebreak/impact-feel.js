// Presentation of impacts. The sim never pauses. Hitstop only freezes the drawn pose of the
// units in the hit for a short time, and shake moves the camera. Both renderers read
// hitstop, frozen, freezeAt, shake and edge from one ImpactFeel instance.
// Weight 1: heavy third strike, ambush, opening hit. 2: ultimate. 3: hero kill.
export const IMPACT_FEEL = { 1: { hitstop: .06, shake: 4 }, 2: { hitstop: .08, shake: 6 }, 3: { hitstop: .09, shake: 8 } };
export const HITSTOP_GAP = .3, LOW_HEALTH = .3;
export const feelFor = weight => IMPACT_FEEL[Math.max(1, Math.min(3, weight | 0))];
export class ImpactFeel {
  constructor() { this.reset(null); }
  reset(s) { this.state = s; this.seen = s?.nextImpact || 0; this.clock = 0; this.hitstop = 0; this.shake = 0; this.frozen = new Set(); this.freezeAt = 0; this.nextStop = 0; this.hurt = 0; this.edge = 0; this.hp = null; this.deaths = null; }
  // Call once per rendered frame with the real frame time. Returns new impacts and the
  // share of health the player lost since the last frame, for sound.
  update(s, playerId, frameDt, { reducedMotion = false } = {}) {
    if (s !== this.state) this.reset(s);
    this.clock += frameDt; this.hitstop = Math.max(0, this.hitstop - frameDt); this.shake *= Math.exp(-frameDt * 11); if (this.shake < .2) this.shake = 0;
    const out = { impacts: [], hurt: 0 };
    for (const i of s.impacts || []) {
      if (i.id <= this.seen) continue; this.seen = i.id;
      if (i.source !== playerId && i.target !== playerId) continue;
      out.impacts.push(i); if (reducedMotion) continue;
      const f = feelFor(i.weight); this.shake = Math.max(this.shake, f.shake);
      if (this.clock >= this.nextStop || this.hitstop > 0 && f.hitstop > this.hitstop) { this.hitstop = f.hitstop; this.frozen = new Set([i.source, i.target]); this.freezeAt = i.time; this.nextStop = this.clock + HITSTOP_GAP; }
    }
    const p = s.units.find(u => u.id === playerId);
    if (p) {
      if (this.hp !== null && p.deaths === this.deaths && p.hp < this.hp) out.hurt = (this.hp - p.hp) / p.maxHp;
      this.hp = p.hp; this.deaths = p.deaths;
      this.hurt = Math.max(this.hurt * Math.exp(-frameDt * 5), Math.min(1, out.hurt * 6));
      const low = p.hp > 0 && p.hp < p.maxHp * LOW_HEALTH ? .22 + .12 * Math.sin(this.clock * 7) : 0;
      this.edge = Math.min(1, Math.max(this.hurt, low));
    }
    return out;
  }
  // The time a renderer uses for a unit's pose: frozen at the impact during hitstop.
  poseTime(e, time) { return this.hitstop > 0 && this.frozen.has(e.id) ? Math.min(time, this.freezeAt) : time; }
}
