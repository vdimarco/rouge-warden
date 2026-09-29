// A comfortable backward tilt adds reel power. Calibrate from the player's grip,
// ignore small hand movements, and ease both ends of the stroke.
export class PullStrength {
  constructor() { this.reset(); }
  reset() { this.base = null; this.value = 0; this.session = null; }
  step(dt, { theta, enabled, active, crank, tension = 0, session }) {
    if (!enabled || !Number.isFinite(theta) || this.session !== session) {
      this.reset(); this.session = session;
    }
    if (!enabled || !Number.isFinite(theta)) return 0;
    dt = Math.max(0, Math.min(Number.isFinite(dt) ? dt : 0, 0.05));
    if (this.base === null) this.base = theta;
    // Lowering the rod establishes a new rest angle. Holding it back never
    // makes the power fade, and a small wrist movement reaches full strength.
    if (theta < this.base) this.base += (theta - this.base) * (1 - Math.exp(-dt * 8));
    if (crank <= 0.05) this.base += (theta - this.base) * (1 - Math.exp(-dt * 3));
    const x = Math.max(0, Math.min(1, (theta - this.base - 4) / 28));
    const target = active && crank > 0.05 ? x * x * (3 - 2 * x) : 0;
    this.value += (target - this.value) * (1 - Math.exp(-dt * (target > this.value ? 10 : 14)));
    // Release the added load smoothly near the line's limit.
    const relief = 1 - Math.max(0, Math.min(1, (tension - 0.65) / 0.2));
    return active && crank > 0.05 ? this.value * relief : 0;
  }
}
