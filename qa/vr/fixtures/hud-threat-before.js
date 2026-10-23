function hudFrame(dt, inp) {
  const phone = !!inp.easySwing, near = !driving ? carInReach() : null;
  const throwable = combat.fighting > 0 && !!combat.throwTarget(throwFrom());
  const key = (k, m, t) => "<b>" + (phone ? t : inp.kind === "pad" ? k : m) + "</b>";
  let prompt = "";
  // in a fight, the dodge and the finisher come before a car in reach
  if (driving) prompt = phone ? "" : key("B", "R", "") + "GET OUT";
  else if (combat.threat(heroFight())) prompt = phone ? "" : key("A", "SPACE", "") + "DODGE"; // (a phone shows its DODGE button)
  else if (combat.focus >= 1 && combat.inReach(heroFight()) && !phone) prompt = key("RB", "F", "") + "FINISH";
  else if (near) prompt = phone ? "" : key("B", "R", "") + (near.traffic ? "STEAL" : "GET IN");
  else if (takedownAim()) prompt = key("RT", "CLICK", "TAP") + "TAKEDOWN";
  else if (throwable && !phone) prompt = key("D-PAD UP", "G", "") + "THROW";
  else if (combat.inReach(heroFight()) && fightHints < 3) prompt = key("RT", "CLICK", "TAP") + "PUNCH";
  const fight = combat.hits > 0 || combat.focus > 0 || combat.fighting > 0;
  actHud.update(dt, { on: G.state === "play" || G.state === "paused", hp: combat.hp, max: FIGHT.hp, energy: energy < 0.999 || sprinting ? energy : -1, prompt, phone, nearCar: !!near, driving, shout: shoutFrame(dt),
    goal: goalFrame(phone),
    combo: combat.hits, focus: fight ? combat.focus : -1, warn: warnFrame(),
    wall: !!P.wall,
    air: G.state === "play" && !P.onGround && !P.wall && !driving && P.ropes[0].state !== "attached" && P.ropes[1].state !== "attached",
    throwable });
}
