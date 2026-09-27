// Checks the fair-play rules from docs/botl-fun.md: the King waits for your three friends, a roll costs stamina,
// a critter's bite misses you behind it, at most two critters wind up at once, hits show numbers, a landing roll
// halves fall damage, the updraft never hurts you on the way down, and each boss speaks as the fight turns.
import { open, newGame } from "./lib.mjs";

const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); };
const { browser, page, errors } = await open();
await newGame(page);

const r = await page.evaluate(() => {
  const P = G.player, I = G.inp, out = {};
  const home = G.world.cottage;
  const toast = () => document.querySelector("#toast").textContent;
  const remove = (o) => { o.alive = false; o.gone = true; o.state = "dead"; o.t = 0; o.rig.root.visible = false; };
  // plenty of hearts, so a long test fall does not end the run
  P.maxHp = P.hp = 60;

  // the King turns you away until the three friends are free
  const king = G.bosses.find((b) => b.id === "king");
  P.place(king.center.x + king.def.r - 3, king.center.z); QA.step(6);
  out.kingWaits = !king.active && /three friends/.test(toast());

  // a roll costs stamina
  P.place(home.x - 4, home.z - 18); QA.step(20);
  P.stamina = P.staminaMax; I.roll = true; QA.step(1);
  out.rollCost = Math.round(P.staminaMax - P.stamina);
  QA.step(30);

  // a bite lands in front of the critter and misses behind it
  const f = G.spawnFoe("raccoon", P.x + 1.2, P.z, { x: P.x, z: P.z });
  const bite = (yaw) => { P.hp = P.maxHp; P.invuln = 0; P.roll = 0; P.state = "ground"; f.yaw = yaw; f.state = "strike"; f.t = 0.25; f.hitDone = false; QA.step(2); return P.maxHp - P.hp; };
  out.behind = bite(Math.PI / 2);
  out.front = bite(-Math.PI / 2);
  out.numbers = document.querySelectorAll(".dmgnum.hurt").length;
  remove(f);

  // in a crowd, at most two critters wind up at once
  const crowd = [];
  for (let k = 0; k < 6; k++) crowd.push(G.spawnFoe("raccoon", P.x + Math.cos(k) * 1.5, P.z + Math.sin(k) * 1.5, { x: P.x, z: P.z }));
  let most = 0;
  QA.step(40, () => { P.hp = P.maxHp; most = Math.max(most, crowd.filter((c) => c.alive && (c.state === "windup" || c.state === "strike")).length); });
  out.mostAtOnce = most;
  crowd.forEach(remove);

  // the same long fall with and without a landing roll; the updraft's fall never hurts
  G.foes.filter((o) => o.alive).forEach(remove);
  const drop = (roll, safe) => {
    P.hp = P.maxHp; P.invuln = 0; P.roll = 0; P.rollBuf = 0; P.safeFallT = safe ? 6 : 0;
    const g0 = G.groundAt(P.x, P.z, P.pos.y + 50);
    P.pos.y = g0 + 30; P.state = "air"; P.airT = 1; P.vel.set(0, -35, 0);
    for (let n = 0; n < 200 && P.state === "air"; n++) { if (roll && P.pos.y - g0 < 3) I.roll = true; QA.step(1); }
    QA.step(2);
    return P.maxHp - P.hp;
  };
  out.fall = drop(false, false);
  out.fallRolled = drop(true, false);
  out.fallUpdraft = drop(false, true);

  // a boss says its second line at two thirds and its third at one third
  const gabe = G.bosses.find((b) => b.id === "gabe");
  gabe.active = true; gabe.state = "idle";
  const said = [], say0 = G.say; G.say = (w, t) => said.push(t);
  for (let i = 0; i < 40 && gabe.alive; i++) gabe.hurt(10, gabe.x + 2, gabe.z, 0, false);
  G.say = say0; QA.closeModals();
  out.lines = said.length; out.gabeDown = !gabe.alive;
  return out;
});
console.log(JSON.stringify(r));

check(r.kingWaits, "the King fought before the three friends were free");
check(r.rollCost === 14, "a roll cost " + r.rollCost + " stamina, not 14");
check(r.behind === 0, "a bite from behind did " + r.behind + " damage");
check(r.front > 0, "a bite from the front did no damage");
check(r.numbers > 0, "no red number when the hero was hurt");
check(r.mostAtOnce <= 2, r.mostAtOnce + " critters wound up at once");
check(r.fall > 0 && r.fallRolled > 0 && r.fallRolled <= Math.ceil(r.fall / 2), "a landing roll did not halve the fall: " + r.fall + " vs " + r.fallRolled);
check(r.fallUpdraft === 0, "the updraft's fall did " + r.fallUpdraft + " damage");
check(r.lines === 2 && r.gabeDown, "Gabe said " + r.lines + " lines in the fight");
check(errors.length === 0, "page errors: " + errors.slice(0, 3).join(" | "));

await browser.close();
if (fails.length) { console.log("FAIL\n- " + fails.join("\n- ")); process.exit(1); }
console.log("PASS");
