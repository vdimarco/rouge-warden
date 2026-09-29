// STUB: portal (replaced by the ui agent)
// A bare opening with the exact API of spec §10: on its first frame it places the rig so you face the Needle from
// the start roof (placeRig), and it finishes on the next frame. No crack, no room, no stencil.
export function createPortal({ city, placeRig }) {
  const doneFns = [];
  let skip = false;
  const wall = { label: "", local: null, normal: null }, crack = { world: null, local: null };
  const finish = () => { Pt.active = false; Pt.phase = "done"; for (const f of doneFns) f(); };
  const Pt = {
    active: false, phase: "idle",
    begin() { Pt.active = true; Pt.phase = "place"; skip = false; },
    update(dt, time, frame, input) {
      if (!Pt.active) return;
      if (Pt.phase === "place") {
        // the head's yaw in tracking space: yawOf(d) with d straight ahead of the head
        const q = input.head.local.quat;
        const fx = -2 * (q.x * q.z + q.w * q.y), fz = -(1 - 2 * (q.x * q.x + q.y * q.y));
        const S = city.start;
        placeRig(S.yaw - Math.atan2(-fx, -fz), S.x, S.y, S.z);
        Pt.phase = "reveal";
        if (skip) finish();
        return;
      }
      finish();
    },
    onEvent() {},
    onDone: (fn) => doneFns.push(fn),
    skip() { skip = true; },
    info: () => ({ phase: Pt.phase, wall, crack }),
  };
  return Pt;
}
