// STUB: hands (replaced by the swing agent)
// Bare hands with the exact API of spec §8: a small box at each grip pose; the muzzle tip is 0.1 m ahead of the grip.
import * as THREE from "three";
import { COLORS } from "./config.js";

export function createHands(rig, scene) {
  const boxes = [0, 1].map(() => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.14), new THREE.MeshBasicMaterial({ color: COLORS.cup, fog: false }));
    m.visible = false;
    scene.add(m);
    return m;
  });
  const tips = [new THREE.Vector3(), new THREE.Vector3()];
  const F = new THREE.Vector3();
  let visible = true;
  const H = {
    visible: true,
    update(input) {
      for (let i = 0; i < 2; i++) {
        const h = input.hands[i], b = boxes[i];
        b.position.copy(h.gripPos);
        b.quaternion.copy(h.gripQuat);
        b.visible = visible && h.connected && input.mode === "xr";
        F.set(0, 0, -0.1).applyQuaternion(h.gripQuat);
        tips[i].copy(h.gripPos).add(F);
      }
    },
    tip: (side) => tips[side === "right" || side === 1 ? 1 : 0],
    setHearts() {}, glow() {}, setStyle() {},
    setVisible(v) { visible = H.visible = !!v; if (!visible) for (const b of boxes) b.visible = false; },
  };
  return H;
}
