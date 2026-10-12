import { WORLDS, REGIONS } from "./worlds.js";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const hash = (text, seed = 1) =>
  [...text].reduce(
    (n, ch) => Math.imul(n ^ ch.charCodeAt(0), 16777619) >>> 0,
    seed >>> 0,
  );
const directions = [
  "north",
  "north-east",
  "east",
  "south-east",
  "south",
  "south-west",
  "west",
  "north-west",
];
const axisDirections = ["north", "east", "south", "west"];
const moonActions = ["water", "root", "light"];
const kindNames = {
  forest: "Catch light for the rescue beacon",
  city: "Reconnect the circuit",
  coast: "Bring the crew home",
  fjord: "Listen beneath the ice",
  desert: "Read the wind and stone",
  moon: "Cultivate the orbital garden",
};

export function ensureSimulation(s) {
  if (!s.simulation || s.simulation.version !== 1) {
    s.simulation = { version: 1, actors: {}, calm: 0 };
  }
  for (const region of REGIONS) {
    s.worlds[region].completedAt ??= {};
    s.simulation.actors[region] ??= {};
  }
  if (s.challenge === undefined) s.challenge = null;
  for (const l of WORLDS.coast.landmarks.filter((l) =>
    l.id.startsWith("boat"),
  )) {
    s.simulation.actors.coast[l.id] ??= {
      id: l.id,
      kind: "crew",
      x: l.x,
      y: l.y,
      mode: "drifting",
    };
  }
  for (const [id, actor] of Object.entries(s.simulation.actors.coast))
    if (s.worlds.coast.flags[id]) {
      actor.mode = "safe";
      actor.x = 43 + ["boat-a", "boat-b", "boat-c"].indexOf(id) * 3;
      actor.y = 92;
    }
  s.actors = Object.values(s.simulation.actors[s.region] || {});
  describeEnvironment(s);
  return s.simulation;
}

function describeEnvironment(s) {
  const w = s.worlds[s.region];
  const phase = (s.time % 48) / 48;
  const wave = (Math.sin(s.time / 8 + s.seed * 0.21) + 1) / 2;
  const relief = w.restored ? 0.2 : 1 - w.stage * 0.13;
  const wind = Math.sin(s.time / 11 + s.seed * 0.17) * relief;
  const calm = s.simulation.calm > 0 || s.pulse > 0;
  const tide = s.region === "coast" || s.region === "fjord" ? wave : 0;
  const weather = {
    forest: wave > 0.64 ? "mist" : "firefly dusk",
    city: wave > 0.58 ? "rain" : "drizzle",
    coast: wave > 0.62 ? "rising tide" : "ebb tide",
    fjord: wave > 0.64 ? "ice drift" : "aurora calm",
    desert: wave > 0.6 ? "sand gusts" : "clear wind",
    moon: wave > 0.62 ? "meteor drift" : "earthshine",
  }[s.region];
  const current =
    s.region === "coast"
      ? { x: calm ? 0 : wind * 1.8, y: calm ? 0 : (tide - 0.5) * 1.2 }
      : s.region === "fjord"
        ? { x: calm ? 0 : wind * 0.85, y: 0 }
        : s.region === "desert"
          ? {
              x: calm ? 0 : wind * 1.65,
              y: calm ? 0 : Math.cos(s.time / 13) * 0.4,
            }
          : s.region === "moon"
            ? {
                x: Math.sin(s.time / 9) * 0.6 * relief,
                y: Math.cos(s.time / 8) * 0.45 * relief,
              }
            : { x: 0, y: 0 };
  s.environment = {
    wind,
    tide,
    storm: wave * relief,
    season: s.time / 60,
    gravity: s.region === "moon" ? 0.72 + w.stage * 0.09 : 1,
    current,
    weather,
    weatherPhase: phase,
    calm,
  };
  const terrain = [];
  const patch = (
    id,
    kind,
    x,
    y,
    radius,
    friction,
    flowX = 0,
    flowY = 0,
    active = true,
  ) => terrain.push({ id, kind, x, y, radius, friction, flowX, flowY, active });
  if (s.region === "forest") {
    patch("fern-bed", "ferns", 76, 70, 14, w.stage ? 0.92 : 0.66);
    patch("wet-hollow", "mud", 130, 84, 13, w.restored ? 1 : 0.76);
    patch(
      "living-path",
      "trail",
      106,
      62,
      13,
      w.stage ? 1.13 : 1,
      0,
      0,
      w.stage > 0,
    );
  } else if (s.region === "city") {
    patch("rain-pool", "puddle", 74, 78, 12, 0.75 - wave * 0.12);
    patch("tram-crossing", "road", 116, 77, 15, 1.08);
    patch("power-runnel", "puddle", 164, 86, 11, w.restored ? 0.95 : 0.78);
  } else if (s.region === "coast") {
    patch("reef-shoal", "shoal", 103, 81, 12, 0.67);
    patch("harbor-channel", "channel", 56, 88, 15, w.stage ? 1.08 : 0.92);
    patch(
      "tidal-road",
      "current",
      149,
      79,
      20,
      0.95,
      current.x * 0.6,
      current.y * 0.6,
    );
  } else if (s.region === "fjord") {
    patch("west-ice", "ice", 70, 77, 13, w.stage >= 1 ? 0.96 : 0.62);
    patch("east-ice", "ice", 125, 83, 14, w.stage >= 2 ? 0.96 : 0.62);
    patch("thawed-channel", "channel", 101, 91, 13, w.stage >= 3 ? 1.1 : 0.88);
  } else if (s.region === "desert") {
    patch("dune-ridge", "dune", 86, 75, 14, 0.69, current.x * 0.25);
    patch("mirage-basin", "sand", 149, 85, 16, w.stage >= 2 ? 0.93 : 0.77);
    patch("oasis-soil", "oasis", 121, 83, 13, 1.15, 0, 0, !!w.restored);
  } else {
    patch("western-drift", "crater", 72, 77, 13, 0.79);
    patch(
      "orbit-ridge",
      "gravity",
      133,
      80,
      17,
      0.92 + w.stage * 0.07,
      current.x,
      current.y,
    );
    for (const l of WORLDS.moon.landmarks.filter(
      (l) => l.id.startsWith("garden") && w.flags[l.id],
    ))
      patch(l.id + "-roots", "garden", l.x, l.y, 12, 1.12);
  }
  s.terrain = terrain;
  s.paths = [
    {
      id: `${s.region}-restoration-path`,
      opened: w.stage > 0,
      growth: w.restored ? 1 : w.stage / 3,
      points: WORLDS[s.region].landmarks
        .filter((l) => l.kind === "camp" || !l.id.startsWith("cache"))
        .map((l) => ({ x: l.x, y: l.y })),
    },
  ];
}

export function terrainAt(s, x = s.x, y = s.y) {
  ensureSimulation(s);
  const patches = s.terrain.filter(
    (p) => p.active && Math.hypot(x - p.x, y - p.y) < p.radius,
  );
  return {
    friction: clamp(
      patches.reduce((speed, p) => speed * p.friction, 1),
      0.5,
      1.3,
    ),
    flowX: s.environment.current.x + patches.reduce((n, p) => n + p.flowX, 0),
    flowY: s.environment.current.y + patches.reduce((n, p) => n + p.flowY, 0),
    kinds: patches.map((p) => p.kind),
  };
}

export function getLandmarks(s) {
  ensureSimulation(s);
  return WORLDS[s.region].landmarks.map((l) => {
    const actor = s.simulation.actors[s.region][l.id];
    return actor ? { ...l, x: actor.x, y: actor.y, moving: true } : l;
  });
}

export function advanceSimulation(s, input, dt) {
  ensureSimulation(s);
  if (s.phase !== "playing") return;
  s.simulation.calm = Math.max(0, s.simulation.calm - dt);
  describeEnvironment(s);
  const crew = s.simulation.actors.coast;
  if (s.region === "coast")
    for (const l of WORLDS.coast.landmarks.filter((l) =>
      l.id.startsWith("boat"),
    )) {
      const actor = crew[l.id];
      if (s.worlds.coast.flags[l.id]) {
        actor.mode = "safe";
        actor.x = 43 + ["boat-a", "boat-b", "boat-c"].indexOf(l.id) * 3;
        actor.y = 92;
      } else if (
        s.challenge?.type === "coast" &&
        s.challenge.escort?.actorId === l.id &&
        s.challenge.escort.tethered
      ) {
        actor.mode = "tethered";
        const dx = s.x - actor.x,
          dy = s.y - actor.y,
          gap = Math.hypot(dx, dy);
        if (gap > 3) {
          const move = Math.min(gap - 3, 13 * dt);
          actor.x += (dx / gap) * move;
          actor.y += (dy / gap) * move;
        }
        const reef = WORLDS.coast.hazards[0],
          reefDistance = distance(actor, reef);
        if (reefDistance < reef.radius + 1 && reefDistance > 0.1) {
          actor.x =
            reef.x + ((actor.x - reef.x) / reefDistance) * (reef.radius + 1);
          actor.y =
            reef.y + ((actor.y - reef.y) / reefDistance) * (reef.radius + 1);
        }
      } else {
        actor.mode = "drifting";
        actor.x = l.x + Math.sin(s.time * 0.18 + (hash(l.id, s.seed) % 11)) * 4;
        actor.y = clamp(
          l.y + Math.cos(s.time * 0.21 + (hash(l.id, s.seed) % 9)) * 1.5,
          65,
          96,
        );
      }
    }
  s.actors = Object.values(s.simulation.actors[s.region] || {});
  advanceChallenge(s, dt, input);
}

function options(c) {
  const option = (id, label, extra = {}) => ({ id, label, ...extra });
  if (c.type === "forest")
    c.choices = [
      option("sweep-lantern", "Sweep lantern · catch a nearby firefly", {
        key: "Space",
        disabled: c.sweepCooldown > 0,
      }),
      option("deliver", "Deliver fireflies to this grove", {
        key: "E",
        disabled: c.carried < c.needed || c.deliveryDistance > 7,
      }),
    ];
  if (c.type === "city")
    c.choices = [
      option("next-cell", "Select next conductor", { key: "D" }),
      option("rotate-cell", "Rotate conductor", { key: "A" }),
      option("energize", "Test the circuit", { key: "Space" }),
    ];
  if (c.type === "coast")
    c.choices =
      c.variant === "escort"
        ? [
            option("attach", "Attach tow line", {
              key: "E",
              disabled: c.mode !== "waiting" || c.escort.playerDistance > 7,
            }),
            option("signal", "Signal calm passage", { key: "Space" }),
            option("release", "Release crew in harbor", {
              key: "E",
              disabled: c.mode === "waiting",
            }),
          ]
        : ["amber", "blue", "white"].map((color, i) =>
            option("signal-" + color, `Send ${color} signal`, {
              key: String(i + 1),
            }),
          );
  if (c.type === "fjord")
    c.choices = [
      option("channel-low", "Low channel", {
        key: "1",
        selected: c.channel === "low",
      }),
      option("channel-mid", "Middle channel", {
        key: "2",
        selected: c.channel === "mid",
      }),
      option("channel-high", "High channel", {
        key: "3",
        selected: c.channel === "high",
      }),
      option("ping", "Send pulse", { key: "E" }),
      option("listen", "Steady the returning echo", {
        key: "L",
        disabled: c.mode !== "returning",
      }),
      option("catch", "Catch the echo", { key: "Space" }),
    ];
  if (c.type === "desert")
    c.choices = [
      option("bearing-left", "Turn bearing left", { key: "A" }),
      option("bearing-right", "Turn bearing right", { key: "D" }),
      option("read-wind", "Read wind correction", { key: "E" }),
      option("anchor", "Set this bearing", { key: "Space" }),
    ];
  if (c.type === "moon")
    c.choices = moonActions.map((action, i) =>
      option(
        "cultivate-" + action,
        action === "water"
          ? "Give water"
          : action === "root"
            ? "Anchor roots"
            : "Offer light",
        { key: String(i + 1) },
      ),
    );
  if (
    !(c.type === "coast" && c.variant === "escort") &&
    !(c.type === "forest" && c.variant === "catch")
  )
    c.progress =
      c.type === "city"
        ? c.cells.filter((cell) => cell.rotation === cell.target).length / 3
        : c.step / c.steps;
  c.value =
    c.type === "forest"
      ? c.progress
      : c.type === "desert"
        ? c.angle / 7
        : c.type === "fjord"
          ? c.value
          : c.progress;
  c.target =
    c.type === "forest"
      ? 1
      : c.type === "desert"
        ? c.targets[c.step] / 7
        : c.type === "fjord"
          ? 0.5
          : 1;
}

function describeChallenge(s) {
  const c = s.challenge;
  if (!c) return;
  if (c.phase === "complete") {
    c.hint = "Operation complete. The place begins to change.";
    c.progress = 1;
    return;
  }
  if (c.type === "forest") {
    c.deliveryDistance = distance(s, c.anchor);
    c.progress = (c.carried / c.needed) * 0.85;
    c.hint =
      c.carried < c.needed
        ? `Catch ${c.needed - c.carried} more firefl${c.needed - c.carried === 1 ? "y" : "ies"} with your lantern (${c.carried}/${c.needed} carried). Move near the yellow lights and sweep. Carry them back to this grove to power the rescue beacon.`
        : c.deliveryDistance > 7
          ? "Three fireflies caught. Carry them back to the glowing grove marker, then deliver them to power the rescue beacon."
          : "You brought three fireflies home. Deliver them to this grove to light the rescue path.";
  }
  if (c.type === "city")
    c.hint = `Conductor ${c.selected + 1}/3 faces ${axisDirections[c.cells[c.selected].rotation]}; the marked socket faces ${axisDirections[c.cells[c.selected].target]}. Rotate each conductor to its socket, then test the whole circuit.`;
  if (c.type === "coast") {
    if (c.variant === "escort") {
      const actor = s.simulation.actors.coast[c.escort.actorId];
      c.escort.distance = distance(actor, c.escort.dock);
      c.escort.playerDistance = distance(s, actor);
      c.hint =
        c.mode === "waiting" && c.escort.playerDistance > 7
          ? "Approach the drifting crew before attaching a tow line. The crew remains here and no supplies are spent."
          : c.mode === "waiting"
            ? "Attach a line to the drifting crew. Then lead it around the reef to the western harbor."
            : c.escort.distance <= 9
              ? "The crew is in calm harbor water. Release the tow line to complete the rescue."
              : "Tow the crew to the golden western harbor (42, 89). Move slowly around the reef; signal to calm the current.";
      c.progress =
        c.mode === "waiting"
          ? 0
          : 0.2 +
            0.6 * (1 - clamp(c.escort.distance / c.escort.startDistance, 0, 1));
    } else
      c.hint = `Harbor lamp asks for ${c.pattern[c.step]} light (${c.step + 1}/3). Match the signal to reconnect the beacon.`;
  }
  if (c.type === "fjord")
    c.hint =
      c.mode === "silent"
        ? `Echo ${c.step + 1}/3 answers the ${c.pattern[c.step]} channel. Choose that channel, then send a pulse.`
        : c.mode === "returning"
          ? "Catch the returning echo inside the broad highlighted band. Steady echo holds it in the band if you prefer deliberate controls."
          : "Listen again and choose the matching channel.";
  if (c.type === "desert")
    c.hint = `Stone ${c.step + 1}/3 points ${directions[c.baseTargets[c.step]]}; sampled wind bends it ${c.windCorrection > 0 ? "one step clockwise" : "one step anticlockwise"}. True bearing: ${c.read ? directions[c.targets[c.step]] : "read the wind or work it out"}. Your compass: ${directions[c.angle]}.`;
  if (c.type === "moon")
    c.hint = `Growth ${c.step + 1}/3: ${c.pattern[c.step] === "water" ? "The dry seed needs water" : c.pattern[c.step] === "root" ? "The drifting shoot needs anchored roots" : "The rooted plant needs light"}. Follow the plant’s needs; a wrong input simply lets you retry.`;
  options(c);
  s.message = c.hint;
}

export function startChallenge(s, descriptor) {
  ensureSimulation(s);
  if (s.phase !== "playing" || s.challenge) return false;
  const l = getLandmarks(s).find((l) => l.id === descriptor.landmarkId);
  if (!l || distance(s, l) > 7) return false;
  const h = hash(s.region + ":" + l.id, s.seed);
  const c = {
    id: `${s.region}:${l.id}`,
    type: s.region,
    variant:
      s.region === "forest" && l.id.startsWith("grove")
        ? "catch"
        : l.id.startsWith("boat")
          ? "escort"
          : "operation",
    region: s.region,
    landmarkId: l.id,
    choiceId: descriptor.choiceId,
    title:
      s.region === "coast" && !l.id.startsWith("boat")
        ? "Reconnect the harbor lamp"
        : kindNames[s.region],
    phase: "active",
    step: 0,
    steps: 3,
    progress: 0,
    elapsed: 0,
    value: 0,
    angle: 0,
    target: 0,
    choices: [],
    anchor: { x: l.x, y: l.y },
    targets: [],
    pattern: [],
    mode: "active",
  };
  if (c.type === "forest") {
    c.carried = 0;
    c.needed = 3;
    c.sweepCooldown = 0;
    const bounds = WORLDS.forest.bounds;
    c.fireflies = [0, 1, 2].map((i) => {
      const angle = ((h % 17) / 17 + i / 3) * Math.PI * 2;
      const radius = 10 + i * 3;
      const baseX = clamp(
        l.x + Math.cos(angle) * radius,
        bounds.minX + 4,
        bounds.maxX - 4,
      );
      const baseY = clamp(
        l.y + Math.sin(angle) * radius,
        bounds.minY + 3,
        bounds.maxY - 3,
      );
      return {
        id: `firefly-${i}`,
        x: baseX,
        y: baseY,
        baseX,
        baseY,
        phase: i * 2 + (h % 7),
        caught: false,
      };
    });
    s.worlds.forest.flags[l.id + "-lit"] = true;
  }
  if (c.type === "city") {
    c.selected = 0;
    c.cells = [0, 1, 2].map((i) => ({
      rotation: 0,
      target: 1 + ((h + i) % 3),
      connected: false,
    }));
  }
  if (c.type === "coast") {
    if (c.variant === "escort") {
      c.mode = "waiting";
      const actor = s.simulation.actors.coast[l.id];
      c.escort = {
        actorId: l.id,
        dock: { x: 42, y: 89 },
        tethered: false,
        startDistance: distance(actor, { x: 42, y: 89 }),
        distance: distance(actor, { x: 42, y: 89 }),
      };
    } else
      c.pattern = ["amber", "blue", "white"].map(
        (_, i) => ["amber", "blue", "white"][(h + i) % 3],
      );
  }
  if (c.type === "fjord") {
    c.mode = "silent";
    c.channel = "low";
    c.pattern = [0, 1, 2].map((i) => ["low", "mid", "high"][(h + i) % 3]);
    c.window = [0.3, 0.7];
    c.locked = false;
  }
  if (c.type === "desert") {
    c.windCorrection = s.environment.wind >= 0 ? 1 : -1;
    c.baseTargets = [0, 1, 2].map((i) => (h + i * 3) % 8);
    c.targets = c.baseTargets.map((a) => (a + c.windCorrection + 8) % 8);
    c.read = false;
  }
  if (c.type === "moon") {
    c.pattern = [0, 1, 2].map((i) => moonActions[(h + i) % 3]);
  }
  s.challenge = c;
  describeChallenge(s);
  return true;
}

export function advanceChallenge(s, dt, input = {}) {
  const c = s.challenge;
  if (!c || c.phase !== "active" || s.phase !== "playing") return false;
  c.elapsed += dt;
  if (c.type === "forest" && c.variant === "catch") {
    c.sweepCooldown = Math.max(0, c.sweepCooldown - dt);
    c.sweepFlash = Math.max(0, (c.sweepFlash || 0) - dt);
    const bounds = WORLDS.forest.bounds;
    for (const [i, fly] of c.fireflies.entries()) {
      fly.x = fly.caught
        ? s.x + (i - 1) * 1.5
        : clamp(
            fly.baseX + Math.sin(s.time * 0.8 + fly.phase) * 2.8,
            bounds.minX + 1,
            bounds.maxX - 1,
          );
      fly.y = fly.caught
        ? s.y - 2.5
        : clamp(
            fly.baseY + Math.cos(s.time * 0.63 + fly.phase) * 1.7,
            bounds.minY + 1,
            bounds.maxY - 1,
          );
    }
  }
  if (c.type === "fjord" && c.mode === "returning" && !c.locked) {
    c.echoTime += dt;
    c.value = clamp(c.echoTime / 4, 0, 1);
    if (c.echoTime > 4) {
      c.mode = "silent";
      c.value = 0;
      c.feedback =
        "The echo passed. Send another pulse; retries cost no resources.";
    }
  }
  describeChallenge(s);
  return c.phase === "complete";
}

export function actionChallenge(s, action) {
  const c = s.challenge;
  if (!c || c.phase !== "active" || s.phase !== "playing") return false;
  const id = typeof action === "string" ? action : action?.id || action?.type;
  if (
    id === "attach" &&
    c.type === "coast" &&
    c.variant === "escort" &&
    c.mode === "waiting" &&
    distance(s, s.simulation.actors.coast[c.escort.actorId]) > 7
  ) {
    c.feedback =
      "Approach the crew before attaching the tow line. You must be within seven cells; no supplies were spent.";
    describeChallenge(s);
    return false;
  }
  if (
    id === "deliver" &&
    c.type === "forest" &&
    c.variant === "catch" &&
    (c.carried < c.needed || distance(s, c.anchor) > 7)
  ) {
    c.feedback =
      c.carried < c.needed
        ? "Catch three fireflies before delivering them. Your current catch stays with you."
        : "Return to the glowing grove marker before delivering your catch.";
    describeChallenge(s);
    return false;
  }
  const entry = c.choices.find((choice) => choice.id === id);
  if (!entry || entry.disabled) return false;
  let success = false;
  let failure = "";
  if (c.type === "forest") {
    if (id === "sweep-lantern") {
      c.sweepCooldown = 0.35;
      c.sweepFlash = 0.22;
      const fly = c.fireflies
        .filter((f) => !f.caught && distance(s, f) <= 8)
        .sort((a, b) => distance(s, a) - distance(s, b))[0];
      if (fly) {
        fly.caught = true;
        c.carried++;
        c.step = c.carried;
        success = true;
      } else
        failure =
          "Your lantern found no firefly nearby. Move closer to a yellow light and sweep again; no supplies were spent.";
    }
    if (id === "deliver") {
      if (c.carried >= c.needed && distance(s, c.anchor) <= 7) {
        c.phase = "complete";
        success = true;
      } else
        failure =
          c.carried < c.needed
            ? "Catch three fireflies before delivering them. Your current catch stays with you."
            : "Return to the glowing grove marker before delivering your catch.";
    }
  } else if (c.type === "city") {
    if (id === "next-cell") c.selected = (c.selected + 1) % 3;
    if (id === "rotate-cell")
      c.cells[c.selected].rotation = (c.cells[c.selected].rotation + 1) % 4;
    for (const cell of c.cells) cell.connected = cell.rotation === cell.target;
    if (id === "energize") {
      if (c.cells.every((cell) => cell.connected)) {
        c.step = 3;
        success = true;
      } else
        failure = `${c.cells.filter((cell) => cell.connected).length}/3 conductors connect. Select an unmatched conductor and rotate it to the marked socket.`;
    }
  } else if (c.type === "coast") {
    if (c.variant === "escort") {
      if (id === "attach") {
        c.escort.tethered = true;
        c.mode = "escorting";
        c.step = 1;
        success = true;
      }
      if (id === "signal") {
        s.simulation.calm = 3;
        success = true;
      }
      const actor = s.simulation.actors.coast[c.escort.actorId];
      if (
        id === "release" &&
        c.escort.tethered &&
        distance(actor, c.escort.dock) <= 9 &&
        distance(s, c.escort.dock) <= 10
      ) {
        c.step = 3;
        success = true;
      } else if (id === "release")
        failure =
          "Keep towing until both you and the crew reach the western harbor. The line stays attached; no supplies were spent.";
    } else if (id === "signal-" + c.pattern[c.step]) {
      c.step++;
      success = true;
    } else
      failure = `The harbor lamp asks for ${c.pattern[c.step]} light. Match that signal; retry is free.`;
  } else if (c.type === "fjord") {
    if (id.startsWith("channel-")) c.channel = id.slice(8);
    if (id === "ping") {
      c.mode = "returning";
      c.echoChannel = c.channel;
      c.echoTime = 0;
      c.value = 0;
      c.locked = false;
    }
    if (id === "listen") {
      c.locked = true;
      c.echoTime = 2;
      c.value = 0.5;
    }
    if (id === "catch") {
      if (
        c.mode === "returning" &&
        c.echoChannel === c.pattern[c.step] &&
        c.value >= c.window[0] &&
        c.value <= c.window[1]
      ) {
        c.step++;
        success = true;
      } else
        failure =
          c.echoChannel !== c.pattern[c.step]
            ? `This bell answers the ${c.pattern[c.step]} channel. Choose it and send another pulse.`
            : "The echo was outside the highlighted return band. Send another pulse, then use Steady echo or wait for the band.";
      c.mode = "silent";
      c.locked = false;
      c.value = 0;
    }
  } else if (c.type === "desert") {
    if (id === "bearing-left") c.angle = (c.angle + 7) % 8;
    if (id === "bearing-right") c.angle = (c.angle + 1) % 8;
    if (id === "read-wind") c.read = true;
    if (id === "anchor") {
      if (c.angle === c.targets[c.step]) {
        c.step++;
        c.read = false;
        success = true;
      } else
        failure =
          "That bearing does not compensate for the wind. Read the wind correction, turn the compass and try again; retry is free.";
    }
  } else if (c.type === "moon") {
    if (id === "cultivate-" + c.pattern[c.step]) {
      c.step++;
      success = true;
    } else
      failure = `The plant needs ${c.pattern[c.step]} before it can grow. Choose that action; your seeds and crystals remain unspent.`;
  }
  if (c.step >= c.steps && c.variant !== "catch") c.phase = "complete";
  describeChallenge(s);
  c.feedback =
    failure ||
    (c.phase === "complete"
      ? "Operation complete. Supplies committed once; the landscape begins to change."
      : success
        ? "That step is complete. Read the next clue."
        : "Control adjusted. Read the highlighted target before committing.");
  return (
    success ||
    [
      "turn-left",
      "turn-right",
      "next-cell",
      "rotate-cell",
      "bearing-left",
      "bearing-right",
      "read-wind",
      "ping",
      "listen",
    ].includes(id) ||
    id.startsWith("channel-")
  );
}

export function cancelChallenge(s) {
  if (!s.challenge) return false;
  const c = s.challenge;
  if (c.type === "coast" && c.escort)
    s.simulation.actors.coast[c.escort.actorId].mode = "drifting";
  s.challenge = null;
  s.message =
    "Operation set aside. No supplies spent; return whenever you are ready.";
  return true;
}

export function isSpatialChallenge(s) {
  const c = s.challenge;
  return (
    !!c &&
    ((c.type === "forest" && c.variant === "catch") ||
      (c.type === "coast" && c.variant === "escort"))
  );
}

export function getChallengeView(s) {
  const c = s.challenge;
  if (!c) return null;
  return {
    ...c,
    kind: c.type,
    instruction: c.hint,
    status: c.phase,
    meter: {
      value: c.value,
      target: c.target,
      tolerance: c.type === "fjord" ? 0.2 : 0.05,
      min: 0,
      max: 1,
      label:
        c.type === "fjord"
          ? "Returning echo"
          : c.type === "forest"
            ? "Fireflies carried"
            : c.type === "desert"
              ? "Compass bearing"
              : "Operation progress",
    },
  };
}
