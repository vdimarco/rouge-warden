// Small, seeded moving bodies. Their paths and lifecycle use gameplay time only.
import { BALL_R } from './table.js';
export const ASTEROID_WARNING = 1.25;
export function asteroidPose(rock, elapsed = 0) {
  const angle = rock.phase + (rock.pathTime + Math.max(0, elapsed)) * rock.speed;
  return { x: rock.anchorX + Math.sin(angle) * rock.rangeX,
    y: rock.anchorY + Math.sin(angle * .83 + rock.phase) * rock.rangeY,
    vx: Math.cos(angle) * rock.rangeX * rock.speed,
    vy: Math.cos(angle * .83 + rock.phase) * rock.rangeY * rock.speed * .83 };
}
export function prepareAsteroids(table, sectors) {
  for (const rock of table.bumpers.filter(body => body.asteroid)) {
    const sector = sectors[rock.sector];
    const neighbors = [sector.planet, sector.gate, ...table.bumpers.filter(body => body.sector === rock.sector && body !== rock)];
    const gap = Math.min(...neighbors.map(body => Math.hypot(rock.x - (body.anchorX ?? body.x), rock.y - (body.anchorY ?? body.y)) - rock.r - body.r - BALL_R * 2 - 10));
    const range = Math.max(2, Math.min(46, gap / 2.6, (rock.y - sector.y - 370) / 1.4));
    Object.assign(rock, { dynamic: true, active: true, e: .55, kick: 0, anchorX: rock.x, anchorY: rock.y,
      rangeX: range, rangeY: range * .62, phase: rock.id * 1.618 + rock.x * .013,
      speed: .8 + (rock.id % 3) * .16, pathTime: 0, respawnRemaining: 0, warningRemaining: 0 });
    Object.assign(rock, asteroidPose(rock));
  }
}
export function breakAsteroid(rock) {
  if (!rock.active) return false;
  rock.active = false; rock.respawnRemaining = 6.5 + (rock.id % 3) * .75;
  rock.warningRemaining = 0; rock._warningIssued = false;
  return true;
}
export function advanceAsteroids(rocks, sectorId, ball, dt, events) {
  for (const rock of rocks) {
    if (!rock.dynamic || rock.sector !== sectorId) continue;
    rock.pathTime += dt; Object.assign(rock, asteroidPose(rock));
    if (rock.active) continue;
    rock.respawnRemaining = Math.max(0, rock.respawnRemaining - dt);
    if (rock.respawnRemaining <= ASTEROID_WARNING && !rock._warningIssued) {
      rock._warningIssued = true;
      events?.push({ k: 'asteroid-warning', id: rock.id, x: rock.x, y: rock.y, duration: ASTEROID_WARNING });
    }
    rock.warningRemaining = rock._warningIssued ? Math.max(dt, rock.respawnRemaining) : 0;
    if (rock.respawnRemaining <= 0 && Math.hypot(ball.x - rock.x, ball.y - rock.y) > rock.r + BALL_R + 24) {
      rock.active = true; rock.warningRemaining = 0;
    }
  }
}
export function resetAsteroids(rocks, sectorId) {
  for (const rock of rocks) if (rock.dynamic && rock.sector === sectorId) {
    rock.active = true; rock.respawnRemaining = 0; rock.warningRemaining = 0; rock._warningIssued = false;
  }
}
