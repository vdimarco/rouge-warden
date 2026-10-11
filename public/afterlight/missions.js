import { WORLDS, REGIONS } from "./worlds.js";
import { getLandmarks } from "./simulation.js";
export const RESCUE_PURPOSE =
  "Repair six beacons and bring three stranded crews home.";
const roles = {
  forest:
    "Fireflies power the first rescue beacon. Carry its seeds to the food gardens.",
  city: "Repair the workshop to build sonar for the rescue route.",
  coast:
    "Tow all three stranded crews around the reef and into the western harbor.",
  fjord:
    "Recover three bells. Their crystals power your navigation tools and gardens.",
  desert:
    "Find fresh water and reopen the supply route to the orbital greenhouse.",
  moon: "Grow emergency food, then activate the relay to complete the rescue network.",
};
const nodeNames = {
  forest: "grove",
  city: "junction",
  coast: "boat",
  fjord: "bell",
  desert: "stone",
  moon: "garden",
};
const actions = {
  forest: "Catch fireflies at",
  city: "Repair",
  coast: "Rescue",
  fjord: "Recover",
  desert: "Chart",
  moon: "Plant",
};
const goals = {
  forest: "beacon",
  city: "station",
  coast: "beacon",
  fjord: "spire",
  desert: "oasis",
  moon: "relay",
};
export function getMission(s) {
  const world = WORLDS[s.region],
    flags = s.worlds[s.region].flags;
  const rescued = ["boat-a", "boat-b", "boat-c"].filter(
    (id) => s.worlds.coast.flags[id],
  ).length;
  const connected = REGIONS.filter((r) => s.worlds[r].restored).length;
  const landmarks = getLandmarks(s);
  const task = (id, label, reason) => {
    const point = landmarks.find((l) => l.id === id);
    return {
      id,
      label,
      reason,
      target: point ? { ...point, region: s.region } : null,
      done: !!flags[id],
    };
  };
  if (s.challenge?.variant === "catch") {
    const c = s.challenge,
      fly = c.fireflies
        .filter((f) => !f.caught)
        .sort(
          (a, b) =>
            Math.hypot(a.x - s.x, a.y - s.y) - Math.hypot(b.x - s.x, b.y - s.y),
        )[0];
    const delivering = c.carried >= c.needed;
    return {
      heading: delivering
        ? "Bring the fireflies back"
        : "Catch the glowing fireflies",
      summary: delivering
        ? "Return to the marked grove and deliver your catch to light the rescue path."
        : "Move close to a firefly, then sweep your lantern with Space. Catch three; the grove needs their light.",
      rescued,
      connected,
      steps: [
        {
          id: delivering ? c.landmarkId : "firefly",
          label: delivering
            ? "Deliver to the grove"
            : `Catch fireflies · ${c.carried}/${c.needed}`,
          reason: "Walk or tap to move. Shift dodges; Space catches.",
          done: false,
          target: {
            ...(delivering ? c.anchor : fly || c.anchor),
            id: delivering ? c.landmarkId : "firefly",
            region: s.region,
          },
        },
      ],
    };
  }
  if (s.challenge?.variant === "escort") {
    const towing = s.challenge.escort.tethered;
    return {
      heading: towing ? "Bring this crew home" : "Attach the rescue towline",
      summary: towing
        ? "Stay ahead of the towline, steer around the reef, then release the crew at the western dock."
        : "Move close to the stranded crew and attach the towline with E. Then lead them to the western harbor.",
      rescued,
      connected,
      steps: [
        task(
          towing ? "camp" : s.challenge.landmarkId,
          towing ? "Tow to the harbor" : "Attach to this crew",
          towing
            ? "Signal with Space to calm currents. Release with E at the dock."
            : "Approach the crew and press E to attach the towline.",
        ),
      ],
    };
  }
  if (connected === 6)
    return {
      heading: "Rescue route restored",
      summary: `All six beacons are connected. ${rescued}/3 crews reached harbor. Explore what you rebuilt or start a new rescue.`,
      rescued,
      connected,
      steps: [],
    };
  if (s.worlds[s.region].restored) {
    const next = REGIONS.find(
      (r) => s.unlocked.includes(r) && !s.worlds[r].restored,
    );
    return {
      heading: "Choose the next rescue stop",
      summary: roles[s.region],
      rescued,
      connected,
      steps: next
        ? [
            {
              id: "travel-" + next,
              label: "Travel to " + WORLDS[next].name,
              reason: roles[next],
              done: false,
              target: { region: next, id: "camp", ...WORLDS[next].spawn },
            },
          ]
        : [],
    };
  }
  const steps = [];
  if (s.region === "forest" && !flags.cache)
    steps.push(
      task(
        "cache",
        "Collect the courier pack",
        "Its salvage repairs the forest beacon.",
      ),
    );
  if (s.region === "city")
    for (const id of ["cache-a", "cache-b"])
      if (!flags[id])
        steps.push(
          task(
            id,
            "Collect workshop supplies",
            "Salvage repairs the power line and sonar workshop.",
          ),
        );
  if (s.region === "desert" && !flags.cache)
    steps.push(
      task(
        "cache",
        "Collect the caravan supplies",
        "Salvage rebuilds the water pump.",
      ),
    );
  for (const l of world.landmarks.filter((l) =>
    l.id.startsWith(nodeNames[s.region]),
  ))
    if (!flags[l.id])
      steps.push(task(l.id, actions[s.region] + " " + l.name, roles[s.region]));
  if (!steps.length && s.region === "coast" && !s.tools.sonar)
    steps.push({
      id: "travel-city",
      label: "Build sonar in the city",
      reason: "The harbor needs sonar to chart the icy rescue passage.",
      done: false,
      target: { region: "city", id: "camp", ...WORLDS.city.spawn },
    });
  if (!steps.length) {
    const scrapNeeded = {
      forest: 1,
      city: 1,
      coast: 2,
      fjord: 0,
      desert: 2,
      moon: 2,
    }[s.region];
    if (s.inventory.scrap < scrapNeeded)
      steps.push(
        task(
          "camp",
          "Gather spare salvage at camp",
          "Rest for free, then collect emergency salvage.",
        ),
      );
    else
      steps.push(
        task(
          goals[s.region],
          s.region === "moon"
            ? "Send the final rescue signal"
            : "Activate " +
                world.landmarks.find((l) => l.id === goals[s.region]).name,
          "Your local work is ready. Activate it to unlock the next route or tool.",
        ),
      );
  }
  return {
    heading: "Your next task",
    summary: roles[s.region],
    rescued,
    connected,
    steps,
  };
}
