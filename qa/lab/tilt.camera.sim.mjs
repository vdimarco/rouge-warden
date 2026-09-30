// Camera contract checks, with no browser: node qa/lab/tilt.camera.sim.mjs
// Covers full-world travel, fast shots, short landscape screens, rotation, and map framing.
import assert from 'node:assert/strict';
import { createAdventure } from '../../public/lab/tilt/adventure.js';
import { createCamera, updateCamera, worldToScreen, screenToWorld } from '../../public/lab/tilt/camera.js';

const sizes = [[320, 568], [390, 844], [844, 390], [1280, 360], [1280, 800], [1366, 768], [768, 1024]];
let checks = 0;
const check = (ok, message) => { checks++; assert.ok(ok, message); };
const inside = (point, camera, margin = 0) => point.x >= margin - 1e-7 && point.x <= camera.width - margin + 1e-7 &&
  point.y >= camera.top + margin - 1e-7 && point.y <= camera.height - camera.bottom - margin + 1e-7;

for (const [width, height] of sizes) {
  const run = createAdventure(7), camera = createCamera(width, height);
  for (const sector of run.sectors) {
    run.sectorIndex = sector.id;
    for (const dx of [-500, 0, 500]) for (const dy of [100, 500, 1050]) {
      // Large position changes model a fast shot or a gate crossing after a slow frame.
      for (const [vx, vy] of [[-7000, -6000], [0, 0], [7000, 6000]]) {
        Object.assign(run.world.ball, { x: sector.x + dx, y: sector.y + dy, vx, vy });
        updateCamera(camera, run, 1 / 60);
        const point = worldToScreen(camera, run.world.ball.x, run.world.ball.y);
        check(inside(point, camera, 35), `Ball stays clear of HUD and controls: ${width}x${height}, sector ${sector.id}, (${dx}, ${dy}), velocity (${vx}, ${vy})`);
        const back = screenToWorld(camera, point.x, point.y);
        check(Math.abs(back.x - run.world.ball.x) < 1e-7 && Math.abs(back.y - run.world.ball.y) < 1e-7,
          `World/screen conversion is reversible at ${width}x${height}`);
      }
    }
    // Dock framing must include both full flippers, including their lower resting tips.
    for (const offset of [-50, 0, 60]) {
      Object.assign(run.world.ball, { x: sector.station.x, y: sector.station.y + offset, vx: 0, vy: -1500 });
      updateCamera(camera, run, 1 / 60, { reducedMotion: true });
      for (const flipper of run.world.flippers.filter(f => f.sector === sector.id)) {
        for (const angle of [flipper.rest, flipper.up]) {
          for (const [x, y] of [[flipper.px, flipper.py], [flipper.px + Math.cos(angle) * flipper.len, flipper.py + Math.sin(angle) * flipper.len]]) {
            check(inside(worldToScreen(camera, x, y), camera, 8),
              `Full flipper remains visible near the dock: ${width}x${height}, sector ${sector.id}, ball offset ${offset}`);
          }
        }
      }
    }
  }
  updateCamera(camera, run, 1 / 60, { overview: true });
  for (const x of [0, run.table.W]) for (const y of [0, run.table.H]) {
    check(inside(worldToScreen(camera, x, y), camera), `Map includes the full world at ${width}x${height}`);
  }
  [camera.width, camera.height] = [height, width];
  updateCamera(camera, run, 1 / 60);
  check(inside(worldToScreen(camera, run.world.ball.x, run.world.ball.y), camera, 35), `Rotation preserves ball visibility after ${width}x${height}`);
}

// Ordinary movement is eased; reduced-motion movement remains directly readable.
const run = createAdventure(), camera = createCamera(1280, 800);
Object.assign(run.world.ball, { x: 1800, y: 1400, vx: 0, vy: 0 });
updateCamera(camera, run);
run.world.ball.x += 120;
const initialX = camera.x;
updateCamera(camera, run, 1 / 60);
check(camera.x > initialX && camera.x < run.world.ball.x, 'The follow camera eases a normal shot');
for (let frame = 0; frame < 120; frame++) updateCamera(camera, run, 1 / 60);
check(Math.abs(camera.x - run.world.ball.x) < 0.01, 'The follow camera settles on a stopped ball');
run.world.ball.x += 120;
updateCamera(camera, run, 1 / 60, { reducedMotion: true });
check(Math.abs(camera.x - run.world.ball.x) < 0.01, 'Reduced motion removes camera drift');

console.log(`tilt.camera.sim: ${checks} checks passed across ${sizes.length} screen sizes`);
