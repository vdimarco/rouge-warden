// Frostwing match rules: node qa/frostwing/sim.test.mjs
// Each check names the scenario in openspec/changes/add-frostwing/specs/frostwing/spec.md that it covers.
import * as S from "../../public/frostwing/sim.js";

const fails = [];
const check = (ok, msg) => { console.log((ok ? "  ok   " : "  FAIL ") + msg); if (!ok) fails.push(msg); };
const run = (m, sec) => { for (let i = 0; i < sec * 60 && !m.over; i++) S.step(m, 1 / 60); return S.takeEvents(m); };
const quietBots = (m) => { for (const s of m.ships) if (!s.human) { s.alive = false; s.respawn = 1e9; } };

// Rosters: four Lantern pilots, Silas Vane among them, against four Corvids
{
  const m = S.createMatch({ seed: 1, pilot: "silas" });
  check(m.ships.length === 8 && m.ships.filter((s) => s.team === 0).length === 4, "a match has four ships on each team");
  check(m.player && m.player.pilot === "silas" && m.player.team === 0, "the chosen pilot (Silas Vane) flies for Lantern Squadron");
  check(S.PILOTS.silas.name === "Silas Vane" && S.PILOTS.silas.volley === 3, "Silas Vane is a playable veteran whose charged shot is a three-bolt volley");
  check(m.time === 240, "a match lasts four minutes");
}

// Scenario: Downing a rival scores ten
{
  const m = S.createMatch({ seed: 2, pilot: "juno" });
  quietBots(m);
  const me = m.player, foe = m.ships.find((s) => s.team === 1);
  foe.alive = true; foe.respawn = 0; foe.invuln = 0; foe.shield = 5;
  const f = S.forward(me.yaw, me.pitch);
  foe.x = me.x + f.x * 200; foe.y = me.y + f.y * 200; foe.z = me.z + f.z * 200; foe.yaw = me.yaw; foe.speed = me.speed; foe.input.yaw = 0; foe.input.pitch = 0;
  foe.human = true; // hold it still in front of the nose
  me.input.fire = true; me.invuln = 0;
  const ev = run(m, 0.5);
  check(ev.some((e) => e.type === "down" && e.ship === foe.id && e.by === me.id), "lasers down a rival flying straight ahead");
  check(m.score[0] === S.SCORE.kill && me.kills === 1, `Lantern scores ${S.SCORE.kill} for the down (score ${m.score.join("-")})`);
  check(!foe.alive && foe.respawn > 0, "the downed ship waits to respawn");
  run(m, S.RESPAWN + 0.2);
  check(foe.alive && foe.shield === foe.maxShield, "the downed ship comes back with a full shield after the respawn delay");
}

// Scenario: Collecting energy during a shower
{
  const m = S.createMatch({ seed: 3, pilot: "pip" });
  quietBots(m);
  const me = m.player;
  m.wave.t = 0.01;
  run(m, 0.1);
  check(m.wave.on, "a meteor shower starts when its timer runs out");
  m.orbs.push({ kind: "energy", x: me.x, y: me.y, z: me.z, vx: 0, vy: 0, vz: 0, life: 10, value: 1 });
  const before = m.score[0];
  run(m, 0.1);
  check(m.score[0] === before + S.SCORE.orb && m.wave.energy[0] === 1 && me.energy === 1, "flying through an energy orb scores 5 and counts toward the shower");
  m.wave.t = 0.01;
  const ev = run(m, 0.1);
  check(ev.some((e) => e.type === "waveEnd" && e.winner === 0) && m.score[0] === before + S.SCORE.orb + S.SCORE.wave, "the team with more shower energy earns the 25-point bonus");
}

// Scenario: Breaking a meteorite
{
  const m = S.createMatch({ seed: 4, pilot: "brann" });
  quietBots(m);
  const me = m.player, f = S.forward(me.yaw, me.pitch);
  m.meteors.push({ id: 999, x: me.x + f.x * 150, y: me.y, z: me.z + f.z * 150, tx: 0, vx: 0, vy: 0, vz: 0, r: 20, hp: 20, spin: 1, falling: false });
  me.input.fire = true;
  const ev = run(m, 1);
  check(ev.some((e) => e.type === "rockbreak"), "lasers break a meteorite");
  check(m.orbs.length >= 3, `a broken meteorite drops orbs (${m.orbs.length})`);
}

// Scenario: Bomb and repair orbs
{
  const m = S.createMatch({ seed: 5, pilot: "juno" });
  quietBots(m);
  const me = m.player;
  me.shield = 20; me.bombs = 0;
  m.orbs.push({ kind: "repair", x: me.x, y: me.y, z: me.z, vx: 0, vy: 0, vz: 0, life: 10 }, { kind: "bomb", x: me.x, y: me.y, z: me.z, vx: 0, vy: 0, vz: 0, life: 10 });
  run(m, 0.1);
  check(me.shield === 20 + me.maxShield * 0.4 && me.bombs === 1, "a green orb repairs 40% of the shield and a red orb adds a bomb");
}

// Scenario: A barrel roll turns bolts away
{
  const dmgWith = (rolling) => {
    const m = S.createMatch({ seed: 6, pilot: "juno" });
    quietBots(m);
    const me = m.player; me.invuln = 0;
    if (rolling) { me.roll = 0.5; me.rollDir = 1; }
    const before = me.shield;
    m.bolts.push({ kind: "laser", team: 1, owner: 0, x: me.x, y: me.y + 30, z: me.z, vx: 0, vy: -900, vz: 0, life: 1, dmg: 10, target: null });
    S.step(m, 1 / 60); S.step(m, 1 / 60);
    return before - me.shield;
  };
  const plain = dmgWith(false), rolled = dmgWith(true);
  check(plain > 0 && rolled > 0 && rolled <= plain * 0.21, `a bolt that hits during a roll does a fifth of its damage (${rolled.toFixed(2)} of ${plain.toFixed(2)})`);
}

// Scenario: Charged shot locks on and homes
{
  const m = S.createMatch({ seed: 7, pilot: "silas" });
  quietBots(m);
  const me = m.player, foe = m.ships.find((s) => s.team === 1);
  Object.assign(foe, { alive: true, respawn: 0, invuln: 0, human: true });
  const f = S.forward(me.yaw, me.pitch);
  foe.x = me.x + f.x * 300 + 25; foe.y = me.y + 10; foe.z = me.z + f.z * 300; foe.yaw = me.yaw;
  me.input.charge = true;
  let ev = run(m, 1.2);
  check(ev.some((e) => e.type === "lock" && e.target === foe.id) && me.lock === foe, "holding the charge button fills the charge and locks the ship nearest the nose");
  me.input.charge = false;
  ev = run(m, 0.05);
  const shots = m.bolts.filter((b) => b.kind === "charge" && b.owner === me.id);
  check(shots.length === 3 && shots.every((b) => b.target === foe.id), `releasing it fires Silas Vane's three homing bolts at the lock (${shots.length})`);
  ev = run(m, 1.5);
  check(ev.some((e) => e.type === "hit" && e.ship === foe.id && e.kind === "charge"), "the homing bolts hit the locked ship");
}

// Scenario: The storm wall
{
  const m = S.createMatch({ seed: 8, pilot: "juno" });
  quietBots(m);
  const me = m.player; me.x = S.ARENA + 200; me.z = 0; me.yaw = -Math.PI / 2; me.invuln = 0; me.y = 300;
  run(m, 0.5);
  check(Math.hypot(me.x, me.z) < S.ARENA + 200 && me.warn === 1, "a ship past the edge is pushed back and warned");
}

// Scenario: The ground hurts
{
  const m = S.createMatch({ seed: 9, pilot: "juno" });
  quietBots(m);
  const me = m.player; me.invuln = 0; me.pitch = -1.1; me.y = S.groundY(me.x, me.z) + 12;
  const ev = run(m, 0.5);
  check(ev.some((e) => e.type === "scrape" && e.ship === me.id) && me.shield < me.maxShield && me.y >= S.groundY(me.x, me.z), "flying into the snow costs shield and bounces the ship up");
}

// Scenario: The clock ends the match
{
  const m = S.createMatch({ seed: 10, pilot: "juno" });
  m.score = [30, 20]; quietBots(m); m.time = 0.05;
  const ev = run(m, 0.2);
  check(m.over && m.winner === 0 && ev.some((e) => e.type === "end"), "when the clock runs out the higher score wins");
}

// helpers
{
  const lp = S.leadPoint(0, 0, 0, { x: 100, y: 0, z: -500, vx: -50, vy: 0, vz: 0 }, 950);
  const d = Math.hypot(lp.x, lp.y, lp.z) / 950;
  check(Math.abs(d - lp.t) < 0.01, "leadPoint finds a point the bolt reaches when the target does");
  let lo = Infinity, hi = -Infinity;
  for (let x = -S.ARENA; x <= S.ARENA; x += 50) for (let z = -S.ARENA; z <= S.ARENA; z += 50) { if (Math.hypot(x, z) > S.ARENA * 0.8) continue; const y = S.groundY(x, z); lo = Math.min(lo, y); hi = Math.max(hi, y); }
  check(lo > -20 && hi < S.CEILING - 60, `the ground inside the bowl (0.8 of the arena radius) stays between -20 and the ceiling less 60 (${lo.toFixed(0)} to ${hi.toFixed(0)})`);
}

console.log(fails.length ? `\n${fails.length} failed` : "\nall passed");
process.exit(fails.length ? 1 : 0);
