// STUB: game (replaced by the game agent)
// A bare game with the exact API of spec §10: no clogs, no Loonies, no King, no tutorial. The progress shape is real.
import * as THREE from "three";
import { GAME } from "./config.js";

export function createGame({ scene, city, save }) {
  const root = new THREE.Group();
  root.name = "game";
  root.visible = false; // hidden until start(), so the portal's stencil never touches it
  scene.add(root);
  const done = new Set(Array.isArray(save && save.clogs) ? save.clogs : []);
  const Gm = {
    root,
    progress: { clogs: done.size, clogsTotal: 12, loonies: 0, looniesTotal: 80, bank: 0, king: "sleeping", hearts: GAME.king.hearts, trial: null, tutorial: -1 },
    start() { root.visible = true; },
    update() {},
    onEvent() {},
    targets: () => city.clogs.map((c) => ({ kind: "clog", id: c.id, x: c.x, y: c.y, z: c.z, done: done.has(c.id) })),
    travelSpots: () => [{ id: "start", name: "The start roof", x: city.start.x, y: city.start.y, z: city.start.z }],
    cancelTrial() {},
    // test hooks (G.test.wakeKing / clearClog)
    wakeKing() { Gm.progress.king = "awake"; },
    clearClog(id) { done.add(id); Gm.progress.clogs = done.size; },
  };
  return Gm;
}
