import { WORLDS, REGIONS } from "./worlds.js";
import * as simulation from "./simulation.js";
export { WORLDS, REGIONS };
export const getLandmarks = simulation.getLandmarks;
export const getChallengeView = simulation.getChallengeView;
export const terrainAt = simulation.terrainAt;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x)),
  distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y),
  count = (s, prefix) =>
    Object.keys(s.worlds[s.region].flags).filter(
      (k) => k.startsWith(prefix) && s.worlds[s.region].flags[k] === true,
    ).length;
export function createJourney(seed = 1) {
  const s = {
    version: 1,
    seed: Number(seed) || 1,
    phase: "ready",
    region: "forest",
    x: 35,
    y: 87,
    time: 0,
    hull: 100,
    energy: 100,
    maxEnergy: 100,
    inventory: { scrap: 0, seeds: 0, crystals: 0, bells: 0 },
    tools: {
      lantern: true,
      sonar: false,
      compass: false,
      shield: false,
      efficient: false,
    },
    worlds: Object.fromEntries(
      REGIONS.map((r) => [
        r,
        { restored: 0, stage: 0, flags: {}, visited: r === "forest" },
      ]),
    ),
    unlocked: ["forest"],
    message: "The beacons are silent. Wake the woods, then follow the network.",
    entities: [],
    pulse: 0,
    checkpoint: { region: "forest", x: 35, y: 87 },
    ending: false,
  };
  simulation.ensureSimulation(s);
  entities(s);
  return s;
}
export function start(s) {
  if (s.phase === "ready") s.phase = "playing";
  return s;
}
export function pause(s) {
  if (s.phase === "playing") s.phase = "paused";
  return s;
}
export function resume(s) {
  if (s.phase === "paused" || s.phase === "ready") s.phase = "playing";
  return s;
}
function entities(s) {
  simulation.ensureSimulation(s);
  s.entities = WORLDS[s.region].hazards.map((h) => ({
    ...h,
    x: h.x + Math.sin(s.time * h.speed + s.seed) * h.rx,
    y: h.y + Math.cos(s.time * h.speed + s.seed) * h.ry,
    radius:
      h.radius * (s.region === "moon" ? 1 - s.worlds.moon.stage * 0.16 : 1),
    active:
      !(
        s.challenge &&
        !(s.challenge.type === "coast" && s.challenge.variant === "escort")
      ) &&
      !s.worlds[s.region].restored &&
      !(
        s.pulse > 0 && ["forest", "coast", "fjord", "desert"].includes(s.region)
      ),
  }));
}
export function update(s, input = {}, dt = 0) {
  if (s.phase !== "playing") return s;
  dt = clamp(Number(dt) || 0, 0, 0.25);
  s.time += dt;
  s.pulse = Math.max(0, s.pulse - dt);
  const b = WORLDS[s.region].bounds;
  const focused =
    s.challenge &&
    !(s.challenge.type === "coast" && s.challenge.variant === "escort");
  let dx = focused ? 0 : clamp(Number(input.dx) || 0, -1, 1),
    dy = focused ? 0 : clamp(Number(input.dy) || 0, -1, 1),
    length = Math.max(1, Math.hypot(dx, dy));
  const ground = simulation.terrainAt(s);
  const towing = s.challenge?.escort?.tethered;
  const speed =
    (towing ? 10 : 17) *
    ground.friction *
    (s.region === "moon" ? 0.88 + s.worlds.moon.stage * 0.05 : 1);
  s.x = clamp(
    s.x + ((dx / length) * speed + (focused ? 0 : ground.flowX)) * dt,
    b.minX,
    b.maxX,
  );
  s.y = clamp(
    s.y + ((dy / length) * speed + (focused ? 0 : ground.flowY)) * dt,
    b.minY,
    b.maxY,
  );
  simulation.advanceSimulation(s, input, dt);
  s.energy = Math.max(
    0,
    s.energy - dt * (Math.hypot(dx, dy) > 0.05 ? 0.16 : 0.04),
  );
  entities(s);
  for (const h of s.entities)
    if (h.active && distance(s, h) < h.radius) {
      s.hull = Math.max(0, s.hull - dt * (s.tools.shield ? 7 : 14));
      s.energy = Math.max(0, s.energy - dt * 2);
    }
  if (s.hull <= 0 || s.energy <= 0) {
    s.phase = "lost";
    s.message =
      "The expedition is spent. Recover at your last camp; restored places and collected tools remain.";
  }
  return s;
}
function nearby(s) {
  return simulation
    .getLandmarks(s)
    .map((l) => ({ ...l, d: distance(s, l) }))
    .filter((l) => l.d <= 7)
    .sort((a, b) => a.d - b.d)[0];
}
function choice(id, label, disabled = false) {
  return { id, label, disabled };
}
const done = (s, id) => !!s.worlds[s.region].flags[id];
function cost(s, n, key = "scrap") {
  return s.inventory[key] >= n;
}
function regionCount(s, prefix) {
  return WORLDS[s.region].landmarks.filter(
    (l) => l.id.startsWith(prefix) && done(s, l.id),
  ).length;
}
export function getContext(s) {
  if (s.challenge)
    return {
      title: s.challenge.title,
      text: s.challenge.hint,
      choices: s.challenge.choices,
      toolHint:
        "Complete the operation or set it aside without spending supplies.",
      landmarkId: s.challenge.landmarkId,
      challenge: true,
    };
  return contextFor(s, nearby(s));
}
function contextFor(s, l) {
  if (!l)
    return {
      title: WORLDS[s.region].name,
      text: "Explore the scene. Approach a landmark to discover its choices.",
      choices: [],
      toolHint: toolHint(s),
      landmarkId: null,
    };
  let choices = [],
    text = "";
  const w = s.worlds[s.region];
  if (l.kind === "camp") {
    text =
      "A safe checkpoint. Rest freely, or turn spare salvage into lasting protection.";
    choices = [
      choice("rest", "Rest · refill hull and energy"),
      choice(
        "upgrade",
        "Build shield · 2 scrap, halves hazard damage",
        s.tools.shield || !cost(s, 2),
      ),
    ];
    if (s.inventory.scrap < 2)
      choices.push(
        choice(
          "salvage",
          "Emergency salvage · +1 scrap, spend 15 energy",
          s.energy < 20,
        ),
      );
  } else if (l.id.startsWith("cache")) {
    text = done(s, l.id)
      ? "This cache has already been gathered."
      : "An optional supply cache: salvage now or leave it for a return visit.";
    choices = [
      choice(
        "gather",
        s.region === "forest"
          ? "Gather pack · +2 scrap"
          : "Gather salvage · +3 scrap",
        done(s, l.id),
      ),
    ];
    if (s.region === "forest")
      choices.push(
        choice(
          "tune",
          "Use pack to tune lantern · halve all tool energy, no scrap",
          done(s, l.id) || s.tools.efficient,
        ),
      );
  } else if (s.region === "forest" && l.id.startsWith("grove")) {
    text = done(s, l.id)
      ? "The grove is awake. Its seeds are traveling with you."
      : "Use your lantern here to wake the grove, then gather its seeds.";
    choices = [
      choice(
        "gather",
        "Gather awakened grove · +2 carried seeds",
        done(s, l.id) || !done(s, l.id + "-lit"),
      ),
      choice(
        "nurture",
        "Nurture grove · +1 seed, permanent +10 energy capacity",
        done(s, l.id) || !done(s, l.id + "-lit"),
      ),
    ];
  } else if (s.region === "forest") {
    text =
      "The three groves feed this beacon. Its light opens the road into the city.";
    choices = [
      choice(
        "restore",
        "Restore forest beacon · 1 scrap, needs 3 groves",
        w.restored || regionCount(s, "grove") < 3 || !cost(s, 1),
      ),
    ];
  } else if (s.region === "city" && l.id.startsWith("junction")) {
    text =
      "Repairing both junctions powers the central workshop and relights the tramline.";
    choices = [
      choice(
        "repair",
        "Repair junction · 1 scrap",
        done(s, l.id) || !cost(s, 1),
      ),
    ];
  } else if (s.region === "city") {
    text =
      "Build the sonar from the repaired city network. It will hear through fjord ice.";
    choices = [
      choice(
        "restore",
        "Restore workshop · 1 scrap, needs 2 junctions",
        w.restored || regionCount(s, "junction") < 2 || !cost(s, 1),
      ),
    ];
  } else if (s.region === "coast" && l.id.startsWith("boat")) {
    text = done(s, l.id)
      ? "This crew reached harbor."
      : "Illuminate the stranded crew with your lantern, then guide them home.";
    choices = [
      choice(
        "rescue",
        "Rescue crew · 10 energy, +1 scrap",
        done(s, l.id) || !done(s, l.id + "-lit") || s.energy < 10,
      ),
    ];
  } else if (s.region === "coast") {
    text =
      "Three crews charted the hidden fjord passage. The city sonar is needed to prove a safe route through its ice.";
    choices = [
      choice(
        "restore",
        "Restore harbor lamp · 2 scrap, needs 3 crews + city sonar",
        w.restored ||
          regionCount(s, "boat") < 3 ||
          !cost(s, 2) ||
          !s.tools.sonar,
      ),
    ];
  } else if (s.region === "fjord" && l.id.startsWith("bell")) {
    text = done(s, l.id)
      ? "This bell has been recovered."
      : "Pulse sonar near this place. Its echo reveals a bell beneath the ice.";
    choices = [
      choice(
        "retrieve",
        "Retrieve revealed bell · +1 bell, +1 crystal",
        done(s, l.id) || !done(s, l.id + "-revealed"),
      ),
    ];
  } else if (s.region === "fjord") {
    text =
      "The bells tune the spire. Their resonance melts a passage and calibrates your compass.";
    choices = [
      choice(
        "restore",
        "Tune ice spire · 1 crystal, needs 3 bells",
        w.restored || regionCount(s, "bell") < 3 || !cost(s, 1, "crystals"),
      ),
    ];
  } else if (s.region === "desert" && l.id.startsWith("stone")) {
    text = done(s, l.id)
      ? "The waystone marks a true path."
      : "Use the compass at this stone to separate the real route from its mirage.";
    choices = [
      choice(
        "align",
        "Align waystone · 8 energy, +1 crystal",
        done(s, l.id) || !done(s, l.id + "-charted") || s.energy < 8,
      ),
    ];
  } else if (s.region === "desert") {
    text =
      "Three aligned stones lead water here. One carried seed can grow into an entire oasis.";
    choices = [
      choice(
        "restore",
        "Restore oasis · 2 scrap + 1 seed, needs 3 stones",
        w.restored ||
          regionCount(s, "stone") < 3 ||
          !cost(s, 2) ||
          !cost(s, 1, "seeds"),
      ),
    ];
  } else if (l.id.startsWith("garden")) {
    text = done(s, l.id)
      ? "A garden now holds the crater together."
      : "Plant a seed carried from the forest and root it with a resonant crystal.";
    choices = [
      choice(
        "plant",
        "Plant garden · 1 seed + 1 crystal",
        done(s, l.id) || !cost(s, 1, "seeds") || !cost(s, 1, "crystals"),
      ),
    ];
  } else {
    text =
      "Connect the three gardens to the orbital relay. Its light will complete the world’s network.";
    choices = [
      choice(
        "restore",
        "Restore orbital relay · 2 scrap + 1 crystal, needs 3 gardens",
        w.restored ||
          regionCount(s, "garden") < 3 ||
          !cost(s, 2) ||
          !cost(s, 1, "crystals"),
      ),
    ];
  }
  return {
    title: l.name,
    text,
    choices,
    toolHint: toolHint(s),
    landmarkId: l.id,
  };
}
function toolHint(s) {
  const factor = s.tools.efficient ? 0.5 : 1;
  return s.region === "fjord"
    ? `Sonar · ${8 * factor} energy, reveals nearby bells`
    : s.region === "desert"
      ? `Compass · ${5 * factor} energy, chart a nearby waystone`
      : s.region === "forest" || s.region === "coast"
        ? `Lantern · ${5 * factor} energy, wake a nearby grove or reveal a crew`
        : "Shield protects you automatically once built. Explore landmarks to act.";
}
function mark(s, id) {
  s.worlds[s.region].flags[id] = true;
  s.worlds[s.region].completedAt ??= {};
  s.worlds[s.region].completedAt[id] = s.time;
  refresh(s);
}
function refresh(s) {
  const w = s.worlds[s.region],
    prefix = {
      forest: "grove",
      city: "junction",
      coast: "boat",
      fjord: "bell",
      desert: "stone",
      moon: "garden",
    }[s.region];
  w.stage = regionCount(s, prefix);
  w.restoration = w.restored ? 1 : w.stage / 4;
}
export function useTool(s) {
  if (s.phase !== "playing" || s.challenge) return false;
  let amount = (s.region === "fjord" ? 8 : 5) * (s.tools.efficient ? 0.5 : 1);
  if (s.energy < amount) {
    s.message = "Not enough energy for this tool. Return to a camp and rest.";
    return false;
  }
  if (!["forest", "coast", "fjord", "desert"].includes(s.region)) {
    s.message = toolHint(s);
    return false;
  }
  if (
    (s.region === "fjord" && !s.tools.sonar) ||
    (s.region === "desert" && !s.tools.compass)
  )
    return false;
  s.energy -= amount;
  s.pulse = 2;
  let hits = 0;
  for (const l of simulation.getLandmarks(s)) {
    const r = s.region === "fjord" ? 36 : 10;
    if (distance(s, l) > r) continue;
    const suffix =
      s.region === "fjord" && l.id.startsWith("bell")
        ? "-revealed"
        : s.region === "desert" && l.id.startsWith("stone")
          ? "-charted"
          : (s.region === "forest" && l.id.startsWith("grove")) ||
              (s.region === "coast" && l.id.startsWith("boat"))
            ? "-lit"
            : null;
    if (suffix) {
      s.worlds[s.region].flags[l.id + suffix] = true;
      hits++;
    }
  }
  entities(s);
  s.message = hits
    ? "The tool reveals a new possibility. Approach the landmark to act."
    : "No signal here. Use the tool near a grove, crew, bell or waystone.";
  return hits > 0;
}
export function interact(s, id) {
  if (s.challenge)
    return actionChallenge(
      s,
      id || s.challenge.choices.find((c) => !c.disabled)?.id,
    );
  return performInteraction(s, id);
}
function performInteraction(s, id, committed = false, landmarkId = null) {
  if (s.phase !== "playing") return false;
  const landmark = landmarkId
    ? simulation.getLandmarks(s).find((l) => l.id === landmarkId)
    : nearby(s);
  const context = contextFor(s, landmark),
    c = context.choices.find(
      (c) => c.id === (id || context.choices.find((c) => !c.disabled)?.id),
    );
  if (!c || c.disabled) {
    s.message = context.text;
    return false;
  }
  if (
    !committed &&
    landmark.kind !== "camp" &&
    !landmark.id.startsWith("cache")
  )
    return startChallenge(s, c.id);
  const l = context.landmarkId,
    w = s.worlds[s.region];
  if (c.id === "rest") {
    s.hull = 100;
    s.energy = s.maxEnergy;
    s.checkpoint = { region: s.region, x: s.x, y: s.y };
    s.message = "Rested. Supplies, tools and restored places are unchanged.";
    return true;
  }
  if (c.id === "upgrade") {
    s.inventory.scrap -= 2;
    s.tools.shield = true;
    s.message = "A salvage shield now halves hazard damage across the journey.";
    return true;
  }
  if (c.id === "salvage") {
    s.energy -= 15;
    s.inventory.scrap++;
    s.message =
      "One emergency scrap recovered. Rest if you need to gather another.";
    return true;
  }
  if (c.id === "nurture") {
    s.inventory.seeds++;
    s.maxEnergy += 10;
    s.energy = Math.min(s.maxEnergy, s.energy + 10);
    mark(s, l);
    mark(s, l + "-bloom");
    s.message =
      "The grove blooms permanently. You carry one seed and gain ten energy capacity for every region.";
    return true;
  }
  if (c.id === "tune") {
    s.tools.efficient = true;
    mark(s, l);
    s.message =
      "The courier’s lens halves tool energy across the journey. The pack has no salvage left.";
    return true;
  }
  if (c.id === "gather") {
    if (l.startsWith("grove")) s.inventory.seeds += 2;
    else s.inventory.scrap += s.region === "forest" ? 2 : 3;
    mark(s, l);
    s.message = "Supplies collected. They travel with you.";
    return true;
  }
  if (c.id === "repair") {
    s.inventory.scrap--;
    mark(s, l);
    s.message =
      "A junction wakes. Rainlit windows and the tramline begin to return.";
    return true;
  }
  if (c.id === "rescue") {
    s.energy -= 10;
    s.inventory.scrap++;
    mark(s, l);
    s.message = "The crew reaches harbor and leaves salvage for your journey.";
    return true;
  }
  if (c.id === "retrieve") {
    s.inventory.bells++;
    s.inventory.crystals++;
    mark(s, l);
    s.message =
      "A bell is recovered. Its crystal carries the fjord’s resonance.";
    return true;
  }
  if (c.id === "align") {
    s.energy -= 8;
    s.inventory.crystals++;
    mark(s, l);
    s.message = "The mirage resolves. A waystone marks a true path.";
    return true;
  }
  if (c.id === "plant") {
    s.inventory.seeds--;
    s.inventory.crystals--;
    mark(s, l);
    s.message = "A carried seed takes root. The garden steadies local gravity.";
    return true;
  }
  if (c.id === "restore") {
    const costs = {
      forest: { scrap: 1 },
      city: { scrap: 1 },
      coast: { scrap: 2 },
      fjord: { crystals: 1 },
      desert: { scrap: 2, seeds: 1 },
      moon: { scrap: 2, crystals: 1 },
    }[s.region];
    for (const [k, v] of Object.entries(costs)) s.inventory[k] -= v;
    w.restored = 1;
    mark(s, l);
    const next = REGIONS[REGIONS.indexOf(s.region) + 1];
    const routes =
      s.region === "forest" ? ["city", "coast"] : next ? [next] : [];
    for (const r of routes) if (!s.unlocked.includes(r)) s.unlocked.push(r);
    if (s.region === "city") s.tools.sonar = true;
    if (s.region === "fjord") s.tools.compass = true;
    if (s.region === "desert") s.inventory.seeds += 2;
    s.message = next
      ? s.region === "forest"
        ? "The woods are restored. Choose the city workshops or rescue the coast first; the fjord will need the city sonar."
        : `${WORLDS[s.region].name} is restored. The route to ${WORLDS[next].name} is open.`
      : "All six beacons are connected. The world carries its own light again.";
    entities(s);
    if (s.region === "moon") {
      s.phase = "won";
      s.ending = true;
    }
    return true;
  }
  return false;
}
export function startChallenge(s, choiceId) {
  if (s.phase !== "playing" || s.challenge) return false;
  const landmark = nearby(s),
    context = contextFor(s, landmark);
  const c = context.choices.find(
    (c) => c.id === (choiceId || context.choices.find((c) => !c.disabled)?.id),
  );
  if (
    !landmark ||
    landmark.kind === "camp" ||
    landmark.id.startsWith("cache") ||
    !c ||
    c.disabled
  )
    return false;
  const started = simulation.startChallenge(s, {
    landmarkId: landmark.id,
    choiceId: c.id,
  });
  if (started) entities(s);
  return started;
}
function commitChallenge(s) {
  if (s.challenge?.phase !== "complete") return false;
  const operation = s.challenge;
  s.challenge = null;
  const completed = performInteraction(
    s,
    operation.choiceId,
    true,
    operation.landmarkId,
  );
  if (!completed)
    s.message =
      "Operation prepared, but its supplies ran low. Rest and try again; nothing was spent.";
  entities(s);
  return completed;
}
export function actionChallenge(s, actionId) {
  const accepted = simulation.actionChallenge(s, actionId);
  if (s.challenge?.phase === "complete") return commitChallenge(s);
  return accepted;
}
export function advanceChallenge(s, dt, input = {}) {
  if (s.phase !== "playing") return false;
  simulation.advanceChallenge(s, clamp(Number(dt) || 0, 0, 0.25), input);
  if (s.challenge?.phase === "complete") return commitChallenge(s);
  return false;
}
export function cancelChallenge(s) {
  const cancelled = simulation.cancelChallenge(s);
  if (cancelled) entities(s);
  return cancelled;
}
export function travel(s, region) {
  if (s.phase === "lost" || !WORLDS[region] || !s.unlocked.includes(region))
    return false;
  cancelChallenge(s);
  if (s.phase === "won") s.phase = "playing";
  s.region = region;
  Object.assign(s, WORLDS[region].spawn);
  s.worlds[region].visited = true;
  s.checkpoint = { region, x: s.x, y: s.y };
  s.message = `Arrived at ${WORLDS[region].name}. Shared supplies and damage travel with you.`;
  entities(s);
  return true;
}
export function recover(s) {
  if (s.phase !== "lost") return false;
  cancelChallenge(s);
  s.region = s.checkpoint.region;
  Object.assign(s, {
    x: s.checkpoint.x,
    y: s.checkpoint.y,
    hull: 100,
    energy: s.maxEnergy,
    phase: "ready",
  });
  s.message =
    "Recovered at camp. The network remembers every restored place. Begin when ready.";
  entities(s);
  return true;
}
export function getObjectives(s) {
  const w = s.worlds[s.region],
    prefix = {
      forest: "grove",
      city: "junction",
      coast: "boat",
      fjord: "bell",
      desert: "stone",
      moon: "garden",
    }[s.region],
    names = {
      forest: "Wake three groves; gather seeds or nurture lasting blooms",
      city: "Repair both tram junctions with salvage",
      coast: "Illuminate and rescue three stranded crews",
      fjord: "Reveal and retrieve three bells with sonar",
      desert: "Chart and align three waystones with the compass",
      moon: "Plant three gardens from carried seeds and crystals",
    };
  return [
    {
      id: "explore",
      text: names[s.region],
      done: w.stage >= (s.region === "city" ? 2 : 3),
      progress: w.stage,
      target: s.region === "city" ? 2 : 3,
    },
    {
      id: "restore",
      text: {
        forest:
          "Repair the beacon: 1 scrap. Opens both city and coastal routes.",
        city: "Restore the workshop: 1 scrap after two junctions. Grants sonar.",
        coast: s.tools.sonar
          ? "Restore the harbor lamp: 2 scrap after three rescues. Opens the fjord."
          : "Visit the city workshop for sonar before completing the harbor route.",
        fjord:
          "Tune the spire: 1 crystal after three bells. Grants the desert compass.",
        desert:
          "Water the oasis: 2 scrap + 1 seed after three stones. Opens the lunar gateway.",
        moon: "Connect the relay: 2 scrap + 1 crystal after three planted gardens.",
      }[s.region],
      done: !!w.restored,
    },
    {
      id: "network",
      text: `Network ${REGIONS.filter((r) => s.worlds[r].restored).length} / 6 restored`,
      done: s.ending,
    },
  ];
}
export function serialize(s) {
  return JSON.stringify(s);
}
export function restore(raw) {
  try {
    const saved = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (
      !saved ||
      saved.version !== 1 ||
      !WORLDS[saved.region] ||
      !Array.isArray(saved.unlocked) ||
      !["ready", "playing", "paused", "lost", "won"].includes(saved.phase)
    )
      return null;
    const base = createJourney(saved.seed);
    for (const r of REGIONS) {
      const w = saved.worlds?.[r],
        allowed = new Set(
          WORLDS[r].landmarks.flatMap((l) => [
            l.id,
            l.id + "-lit",
            l.id + "-revealed",
            l.id + "-charted",
            l.id + "-bloom",
          ]),
        );
      if (
        !w ||
        !w.flags ||
        Array.isArray(w.flags) ||
        typeof w.flags !== "object" ||
        Object.entries(w.flags).some(
          ([k, v]) => !allowed.has(k) || typeof v !== "boolean",
        )
      )
        return null;
      base.worlds[r] = {
        restored: w.restored === 1 ? 1 : 0,
        stage: WORLDS[r].landmarks.filter(
          (l) =>
            l.id.startsWith(
              {
                forest: "grove",
                city: "junction",
                coast: "boat",
                fjord: "bell",
                desert: "stone",
                moon: "garden",
              }[r],
            ) && w.flags[l.id],
        ).length,
        flags: { ...w.flags },
        visited: !!w.visited,
        completedAt: Object.fromEntries(
          Object.entries(w.completedAt || {})
            .filter(
              ([id, at]) => allowed.has(id) && Number.isFinite(at) && at >= 0,
            )
            .map(([id, at]) => [
              id,
              Math.min(at, Math.max(0, Number(saved.time) || 0)),
            ]),
        ),
      };
    }
    for (const r of REGIONS) {
      const w = base.worlds[r],
        goal = {
          forest: "beacon",
          city: "station",
          coast: "beacon",
          fjord: "spire",
          desert: "oasis",
          moon: "relay",
        }[r];
      if (w.restored && (w.stage < (r === "city" ? 2 : 3) || !w.flags[goal]))
        return null;
    }
    for (const k of Object.keys(base.inventory)) {
      const v = saved.inventory?.[k];
      if (!Number.isFinite(v) || v < 0 || v > 999) return null;
      base.inventory[k] = v;
    }
    if (saved.tools?.lantern !== true) return null;
    for (const k of Object.keys(base.tools)) base.tools[k] = !!saved.tools?.[k];
    if (
      base.tools.sonar !== !!base.worlds.city.restored ||
      base.tools.compass !== !!base.worlds.fjord.restored
    )
      return null;
    base.region = saved.region;
    const b = WORLDS[base.region].bounds;
    if (
      !Number.isFinite(saved.x) ||
      !Number.isFinite(saved.y) ||
      !Number.isFinite(saved.hull) ||
      !Number.isFinite(saved.energy)
    )
      return null;
    base.x = clamp(saved.x, b.minX, b.maxX);
    base.y = clamp(saved.y, b.minY, b.maxY);
    base.time = clamp(Number(saved.time) || 0, 0, 1e7);
    base.hull = clamp(saved.hull, 0, 100);
    base.maxEnergy =
      100 +
      WORLDS.forest.landmarks.filter(
        (l) =>
          l.id.startsWith("grove") && base.worlds.forest.flags[l.id + "-bloom"],
      ).length *
        10;
    if (saved.maxEnergy !== base.maxEnergy) return null;
    base.energy = clamp(saved.energy, 0, base.maxEnergy);
    base.unlocked = REGIONS.filter(
      (r) =>
        r === "forest" ||
        (["city", "coast"].includes(r) && base.worlds.forest.restored) ||
        (r === "fjord" && base.worlds.coast.restored) ||
        (r === "desert" && base.worlds.fjord.restored) ||
        (r === "moon" && base.worlds.desert.restored),
    );
    if (
      saved.unlocked.length !== base.unlocked.length ||
      saved.unlocked.some((r) => !base.unlocked.includes(r)) ||
      !base.unlocked.includes(base.region)
    )
      return null;
    base.checkpoint = { region: base.region, ...WORLDS[base.region].spawn };
    if (saved.phase === "won" && !REGIONS.every((r) => base.worlds[r].restored))
      return null;
    base.phase =
      saved.phase === "won"
        ? "won"
        : base.hull <= 0 || base.energy <= 0
          ? "lost"
          : "ready";
    base.ending = REGIONS.every((r) => base.worlds[r].restored);
    base.message =
      "Saved journey found. Resume deliberately when ready. In-progress operations can be restarted without spending supplies.";
    base.challenge = null;
    simulation.ensureSimulation(base);
    entities(base);
    return base;
  } catch {
    return null;
  }
}
