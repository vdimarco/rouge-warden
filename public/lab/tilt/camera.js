// A y-up chase camera. The play area leaves room for the fixed HUD and controls.
export const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const mix = (a, b, t) => a + (b - a) * t;

export function createCamera(width = 1000, height = 700) {
  return { x: 600, y: 600, scale: 1, width, height, top: 75, bottom: 85, initialized: false, overview: false };
}

export function updateCamera(camera, run, dt = 1 / 60, options = {}) {
  const { width, height } = camera;
  camera.top = Math.min(80, height * 0.17);
  camera.bottom = Math.min(92, height * 0.2);
  const playHeight = Math.max(100, height - camera.top - camera.bottom);
  const room = run.sectors?.[run.sectorIndex || 0];
  const ball = run.world?.ball || { x: 600, y: 300, vx: 0, vy: 0 };
  const bounds = { width: run.table?.W || 3600, height: run.table?.H || 2800 };
  const overview = Boolean(options.overview);
  const speed = Math.hypot(ball.vx || 0, ball.vy || 0);
  const landscape = width > height;
  let worldWidth = landscape ? 1460 : 770;
  worldWidth += clamp(speed / 4000, 0, 1) * (landscape ? 340 : 115);
  let targetX = ball.x + clamp((ball.vx || 0) * 0.105, -160, 160);
  let targetY = ball.y + clamp((ball.vy || 0) * 0.105, -200, 200);
  const station = room?.station;
  // Keep the flippers in view when a returning ball approaches its station.
  if (station && ball.y - station.y < 380 && Math.abs(ball.x - station.x) < 420 && run.phase !== 'flight') {
    const proximity = clamp(1 - Math.max(0, ball.y - station.y) / 380, 0, 1);
    targetX = mix(targetX, station.x, proximity * 0.6);
    targetY = mix(targetY, station.y + (landscape ? 145 : 220), proximity * 0.75);
    worldWidth -= proximity * (landscape ? 150 : 70);
  }
  if (run.phase === 'flight') worldWidth = landscape ? 1900 : 1020;
  let targetScale = Math.min(width / worldWidth, playHeight / 470);
  if (station && ball.y - station.y < 380 && Math.abs(ball.x - station.x) < 420 && run.phase !== 'flight') {
    const nearFlippers = (run.world?.flippers || []).filter(f => f.sector === (room.id ?? run.sectorIndex));
    const lowerY = Math.min(station.y - 135, ...nearFlippers.map(f => f.py - f.len * 0.5 - f.r2)) - 25;
    const upperY = Math.max(station.y + 325, ball.y + 110);
    targetScale = Math.min(targetScale, playHeight / (upperY - lowerY));
    targetY = (lowerY + upperY) / 2;
  }
  // Show the first route and its gravity body before the player launches.
  if (run.phase === 'ready' && room && Math.hypot(ball.x - station.x, ball.y - station.y) < 80 && !options.charge) {
    targetScale = Math.min(width / (landscape ? 1450 : 1160), playHeight / (room.h + 80));
    targetX = room.x;
    targetY = room.y + room.h / 2;
  }
  if (overview) {
    targetScale = Math.min(width / (bounds.width + 180), playHeight / (bounds.height + 150));
    targetX = bounds.width / 2;
    targetY = bounds.height / 2;
  }
  const fresh = !camera.initialized || camera.world !== run.world;
  if (fresh || options.reducedMotion || overview !== camera.overview) {
    camera.x = targetX;
    camera.y = targetY;
    camera.scale = targetScale;
  } else {
    const elapsed = clamp(dt, 0, 0.1);
    camera.x = mix(camera.x, targetX, 1 - Math.exp(-elapsed * 7.5));
    camera.y = mix(camera.y, targetY, 1 - Math.exp(-elapsed * 7.5));
    camera.scale = mix(camera.scale, targetScale, 1 - Math.exp(-elapsed * 3.5));
  }
  if (!overview && station && ball.y - station.y < 380 && Math.abs(ball.x - station.x) < 420 && run.phase !== 'flight') {
    // Zoom out at once if a returning ball and the flippers need more room.
    camera.scale = Math.min(camera.scale, targetScale);
  }
  const halfW = width / camera.scale / 2;
  const halfH = playHeight / camera.scale / 2;
  // A hard inner bound is separate from smoothing so high speed cannot lose the ball.
  if (!overview) {
    const safeW = Math.max(50, halfW - 72 / camera.scale);
    const safeH = Math.max(40, halfH - 48 / camera.scale);
    camera.x = clamp(camera.x, ball.x - safeW, ball.x + safeW);
    camera.y = clamp(camera.y, ball.y - safeH, ball.y + safeH);
    camera.x = halfW * 2 >= bounds.width ? bounds.width / 2 : clamp(camera.x, halfW - 65, bounds.width - halfW + 65);
    camera.y = halfH * 2 >= bounds.height ? bounds.height / 2 : clamp(camera.y, halfH - 75, bounds.height - halfH + 75);
    // At the outer world edge, keeping the ball clear of the HUD takes priority.
    camera.x = clamp(camera.x, ball.x - safeW, ball.x + safeW);
    camera.y = clamp(camera.y, ball.y - safeH, ball.y + safeH);
  }
  if (!overview && station && ball.y - station.y < 380 && Math.abs(ball.x - station.x) < 420 && run.phase !== 'flight') {
    const stationFlippers = (run.world?.flippers || []).filter(f => f.sector === (room.id ?? run.sectorIndex));
    for (const f of stationFlippers) {
      for (const angle of [f.rest, f.up]) {
        const x = f.px + Math.cos(angle) * f.len, y = f.py + Math.sin(angle) * f.len;
        const mx = halfW - (f.r1 + 8 / camera.scale), my = halfH - (f.r1 + 8 / camera.scale);
        camera.x = clamp(camera.x, x - mx, x + mx);
        camera.y = clamp(camera.y, y - my, y + my);
      }
    }
  }
  camera.centerY = camera.top + playHeight / 2;
  camera.view = { left: camera.x - halfW, right: camera.x + halfW, bottom: camera.y - halfH, top: camera.y + halfH };
  camera.initialized = true;
  camera.overview = overview;
  camera.world = run.world;
  return camera;
}

export function worldToScreen(camera, x, y) {
  return { x: camera.width / 2 + (x - camera.x) * camera.scale, y: camera.centerY - (y - camera.y) * camera.scale };
}

export function screenToWorld(camera, x, y) {
  return { x: camera.x + (x - camera.width / 2) / camera.scale, y: camera.y - (y - camera.centerY) / camera.scale };
}
