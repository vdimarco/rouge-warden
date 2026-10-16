// Neighbour point-win rate against the tuning-note player bots.
// node qa/tennis/ai-balance.test.mjs
// Point 1 is excluded. Seeds start at 1000. Two thousand points per cell.
import { createMatch, createTest } from '../../public/tennis/game.js';

const POINTS = 2000;

const BOTS = {
  average: {
    ai: 'casual',
    sd: 0.030,
    speed: 0.9,
    pos: 0.25,
    earlyFrac: 0.40,
    place: 'half',
    smashZ: null,
    // Recover to the centre, then leave for the landing after this read.
    react: 0.74,
    reactSd: 0.12,
  },
  skilled: {
    ai: 'pro',
    sd: 0.012,
    speed: 1,
    pos: 0.08,
    earlyFrac: 0.20,
    place: 'corner',
    smashZ: 1.2,
    react: 0.45,
    reactSd: 0.08,
  },
};

function mulberry32(seed) {
  let a = seed | 0;
  return function rng() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gauss(rng) {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function playCell(bot, nPoints) {
  const causes = {};
  let nb = 0;
  let counted = 0;
  let rallies = 0;
  let seed = 1000;
  while (counted < nPoints && seed < 1000 + nPoints) {
    const api = createTest(createMatch({ seed, ai: bot.ai }));
    const rng = mulberry32(seed * 997 + 13);
    seed += 1;
    let guard = 0;
    let seen = false;
    let swingAt = null;
    let target = 0;
    let moveAt = 0;
    let shot = 0;
    let kind = 'flat';
    while (counted < nPoints && guard < 60 * 280) {
      guard += 1;
      const st = api.state();
      if (st.phase === 'match') break;
      if (st.phase !== 'rally' || st.point === 1) {
        if (st.point === 1 && st.window) api.swing('flat', 0);
        api.step();
        seen = false;
        swingAt = null;
        continue;
      }
      const inbound = st.ball.vy > 0.05 && st.ball.y > -2 && st.ball.y < 7.6;
      if (inbound && !seen) {
        seen = true;
        const pace = Math.hypot(st.ball.vx, st.ball.vy);
        const grow = 1 + 0.08 * Math.max(0, pace - 10);
        const contactIn = st.contactIn == null ? 0.55 : st.contactIn;
        const win = st.hitWindow || 0.16;
        swingAt = st.time + contactIn + bot.earlyFrac * win + gauss(rng) * bot.sd * grow;
        const react = Math.max(0, bot.react + gauss(rng) * bot.reactSd);
        moveAt = st.time + react;
        const land = st.landing?.x ?? 0;
        target = land + gauss(rng) * bot.pos;
        if (bot.place === 'half') shot = rng() < 0.5 ? (rng() < 0.5 ? -1 : 1) : 0;
        else shot = land >= 0 ? -1 : 1;
        kind = bot.smashZ != null && st.ball.z > bot.smashZ ? 'smash' : 'flat';
      }
      if (st.ball.vy < -0.05) seen = false;
      if (seen && st.time >= moveAt) api.setSteer(target, bot.speed);
      else api.setSteer(0, bot.speed);
      if (swingAt != null && st.time >= swingAt) {
        api.swing(kind, kind === 'smash' ? 0 : shot);
        swingAt = null;
      }
      const next = api.step();
      const point = next.events.find((e) => e.type === 'point');
      if (point && next.point > 1 && next.lastPoint) {
        counted += 1;
        rallies += next.lastPoint.rally;
        const cause = next.lastPoint.cause;
        causes[cause] = (causes[cause] || 0) + 1;
        if (next.lastPoint.winner === 'neighbour') nb += 1;
        seen = false;
        swingAt = null;
      }
    }
  }
  return {
    points: counted,
    nbPct: (100 * nb) / counted,
    rally: rallies / counted,
    causes,
  };
}

function assertBand(name, result, lo, hi) {
  const line = `${name} Neighbour point win ${result.nbPct.toFixed(1)}% over ${result.points} points, rally ${result.rally.toFixed(2)}, ${JSON.stringify(result.causes)}`;
  console.log('  ' + line);
  if (result.points < POINTS) throw new Error(`${name} only played ${result.points} points`);
  if (result.nbPct < lo || result.nbPct > hi) throw new Error(`${line} is outside ${lo} to ${hi}`);
}

const casual = playCell(BOTS.average, POINTS);
const pro = playCell(BOTS.skilled, POINTS);
let failed = false;
try {
  assertBand('casual vs average', casual, 20, 30);
  assertBand('pro vs skilled', pro, 30, 40);
} catch (err) {
  failed = true;
  console.log('  FAIL ' + (err && err.message));
}
if (!failed) console.log('\n2 passed, 0 failed');
process.exitCode = failed ? 1 : 0;
