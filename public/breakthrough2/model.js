// BREAKTHROUGH climate model. No DOM. Seeded, replay-stable.
// Warming is a stock with a one-pole lag. A longer step closes more of the gap.

export const YEARS = [2026, 2032, 2038, 2044, 2050, 2056, 2062, 2068, 2074, 2080, 2090, 2100];
export const TURN_COUNT = 12;
export const TAU = 46;

export const PARAMS = {
  eventChance: 0.7,
  income: { capital: 1.7, research: 1.15, industry: 0.75, political: 0.85 },
  politicalEnergyDrag: 0.03,
  politicalTrustDrag: 0.45,
  energySurchargeAt: 72,
  trustSurchargeAt: 42,
  policyTrustFull: 50,
  prosBase: 0.05,
  prosEnergy: 0.115,
  prosHeat: 0.55,
  prosHeatAt: 2.0,
  growthEmissions: 0.095,
  growthFloor: 44,
  richLeak: 0.12,
  richLeakAt: 72,
  industryLeak: 0.18,
  industryLeakAt: 7,
  decPerCard: 0.1,
  decCap: 0.7,
  ecoDrift: 0.58,
  ecoHeat: 1.05,
  ecoHeatAt: 1.75,
  trustHeat: 0.45,
  trustHeatAt: 2.05,
  trustPoor: 0.3,
  trustPoorAt: 40,
  trustHeal: 0.12,
  eqBase: 0.66,
  eqPerEmission: 0.026,
  eqPerEcology: 0.009,
};

export const IDEA_CLAMP = {
  emissions: [-8, 3],
  energy: [-6, 6],
  prosperity: [-4, 4],
  ecology: [-4, 6],
  trust: [-1, 1],
  capital: [-3, 3],
  research: [-2, 2],
  political: [-2, 2],
  industry: [-2, 2],
  warming: [0, 0],
};

const BOUNDS = {
  emissions: [0, 125],
  energy: [0, 100],
  prosperity: [0, 100],
  ecology: [0, 100],
  trust: [0, 100],
  capital: [0, 80],
  research: [0, 80],
  political: [0, 80],
  industry: [0, 40],
  warming: [0, 6],
};

export const METER_KEYS = ["emissions", "energy", "prosperity", "ecology", "trust"];
export const RESOURCE_KEYS = ["capital", "research", "political", "industry"];

export function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

export function spanYears(turnIndex) {
  if (turnIndex >= 0 && turnIndex < YEARS.length - 1) return YEARS[turnIndex + 1] - YEARS[turnIndex];
  return 6;
}

export function lagAlpha(years) {
  return 1 - Math.exp(-years / TAU);
}

export function stepWarming(warming, eq, years) {
  if (years <= 0) return warming;
  return warming + (eq - warming) * lagAlpha(years);
}

export function equilibrium(emissions, ecology, sinkAdd = 0) {
  const raw = PARAMS.eqBase + emissions * PARAMS.eqPerEmission;
  const extra = typeof sinkAdd === "number" && Number.isFinite(sinkAdd) ? sinkAdd : 0;
  const sink = (ecology - 50) * PARAMS.eqPerEcology + extra;
  return clamp(round2(raw - sink), 0.4, 5);
}

export function projectWarming(warming, emissions, ecology, year, sinkAdd = 0) {
  const eq = equilibrium(emissions, ecology, sinkAdd);
  const left = Math.max(0, 2100 - year);
  return round2(stepWarming(warming, eq, left));
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function clampEffect(effect) {
  const out = {};
  for (const [key, value] of Object.entries(effect || {})) {
    const range = IDEA_CLAMP[key];
    if (!range || typeof value !== "number" || !Number.isFinite(value)) continue;
    out[key] = clamp(value, range[0], range[1]);
  }
  return out;
}

export function policyScale(trust) {
  if (trust >= PARAMS.policyTrustFull) return 1;
  const t = clamp(trust, 0, PARAMS.policyTrustFull) / PARAMS.policyTrustFull;
  return round2(0.52 + 0.48 * t);
}

function tagCount(owned, cardsById, tag) {
  let n = 0;
  for (const id of owned) {
    const card = cardsById.get(id);
    if (card && card.tags.includes(tag)) n += 1;
  }
  return n;
}

export const CARDS = [
  { id: "geothermal", name: "Deep Geothermal", lane: "Energy", tags: ["clean", "decouple"],
    cost: { capital: 3, research: 1 }, effect: { emissions: -5, energy: -5, ecology: 1 },
    text: "Hot rock, steady watts, a small scar on the land." },
  { id: "solar", name: "Perovskite Roofs", lane: "Energy", tags: ["clean", "decouple"],
    cost: { capital: 2, industry: 1 }, effect: { emissions: -5, energy: -6 },
    text: "Film on the roofs. Noon power gets cheap." },
  { id: "storage", name: "Iron-Air Banks", lane: "Energy", tags: ["clean"],
    cost: { capital: 2, research: 1 }, effect: { emissions: -2, energy: -5 },
    text: "Store the wind in iron and air. Heavy, local, cheap." },
  { id: "hvdc", name: "Continental Links", lane: "Energy", tags: ["clean", "decouple"],
    cost: { capital: 3, political: 1 }, effect: { emissions: -2, energy: -4, prosperity: 1 },
    text: "Move spare sun across a border." },
  { id: "nuclear", name: "Factory Reactors", lane: "Energy", tags: ["clean", "decouple"],
    cost: { capital: 3, political: 2, industry: 1 }, effect: { emissions: -5, energy: -3, trust: -5 },
    text: "Small reactors, fast build. The politics are not small." },
  { id: "wind", name: "Offshore Belts", lane: "Energy", tags: ["clean"],
    cost: { capital: 2, political: 1 }, effect: { emissions: -3, energy: -4, ecology: -2 },
    text: "Wind in rows at sea. Fish and birds pay a little." },
  { id: "heatpump", name: "Heat Pump Law", lane: "Industry", tags: ["policy", "decouple"],
    cost: { political: 2, trust: 1 }, effect: { emissions: -3, energy: -1 },
    text: "Boilers retire on a date. Homes need a hand." },
  { id: "ev", name: "Street Current", lane: "Industry", tags: ["decouple"],
    cost: { capital: 2, industry: 1 }, effect: { emissions: -3, energy: 2, prosperity: 2 },
    text: "Buses and vans leave oil. The grid feels it." },
  { id: "steel", name: "Hydrogen Mills", lane: "Industry", tags: ["decouple", "industry"],
    cost: { capital: 3, research: 1, industry: 1 }, effect: { emissions: -4, energy: 4 },
    text: "Steel without coal. The furnaces drink power." },
  { id: "cement", name: "Cool Kilns", lane: "Industry", tags: ["decouple", "industry"],
    cost: { capital: 2, research: 2 }, effect: { emissions: -3, ecology: 1, energy: 2 },
    text: "Cement that does not need a blast of fire." },
  { id: "dac", name: "Air Capture Yards", lane: "Industry", tags: ["industry"],
    cost: { capital: 4, research: 2, industry: 1 }, effect: { emissions: -5, energy: 6, ecology: 1 },
    text: "Fans pull carbon from the sky and burn a lot of power." },
  { id: "forest", name: "Forest Return", lane: "Land", tags: ["land"],
    cost: { capital: 1, political: 1 }, effect: { emissions: -1, ecology: 8, prosperity: 1 },
    text: "Trees are slow and the bill is small." },
  { id: "agri", name: "Living Soil", lane: "Land", tags: ["land"],
    cost: { capital: 1, research: 1 }, effect: { emissions: -1, ecology: 6, prosperity: 1 },
    text: "Fields that hold rain and carbon." },
  { id: "ferment", name: "Precision Protein", lane: "Land", tags: ["land", "decouple"],
    cost: { research: 2, capital: 1, trust: 1 }, effect: { emissions: -2, ecology: 5 },
    text: "Food from vats. Pastures can rest." },
  { id: "methane", name: "Methane Leash", lane: "Land", tags: ["policy", "land"],
    cost: { political: 1, research: 1 }, effect: { emissions: -4, ecology: 1 },
    text: "Plug the leaks. A fast cut, if the rules hold." },
  { id: "gridai", name: "Grid Conductor", lane: "Materials", tags: ["clean", "decouple"],
    cost: { research: 2, trust: 2 }, effect: { emissions: -1, energy: -4 },
    text: "Software wastes less power. People want the switch." },
  { id: "materials", name: "Matter Studio", lane: "Materials", tags: [],
    cost: { research: 3, capital: 1 }, effect: { energy: -2, prosperity: 3, research: 1, emissions: 1 },
    text: "New alloys. Little climate cut on their own." },
  { id: "recycle", name: "Closed Loops", lane: "Materials", tags: ["decouple", "industry"],
    cost: { capital: 2, industry: 1 }, effect: { emissions: -1, ecology: 4, energy: -2, prosperity: 1 },
    text: "Mine the dumps. Fewer pits, less waste heat." },
  { id: "robotics", name: "Build Crews", lane: "Materials", tags: ["industry"],
    cost: { capital: 2, research: 1, industry: 1 }, effect: { prosperity: 5, industry: 2, emissions: 3 },
    text: "Cities go up fast. More stuff, more exhaust." },
  { id: "mineral", name: "Rock Bind", lane: "Materials", tags: [],
    cost: { capital: 2, research: 1 }, effect: { emissions: -2, ecology: 2, energy: 2 },
    text: "Lock carbon in stone. The crushers need power." },
];

export const SYNERGIES = [
  { id: "grid", name: "Planetary Grid", parts: ["solar", "storage", "hvdc", "gridai"],
    effect: { emissions: -3, energy: -4, prosperity: 3 },
    text: "Sun, storage, wires, and a conductor." },
  { id: "reactors", name: "Quiet Reactors", parts: ["nuclear", "hvdc"],
    effect: { emissions: -2, energy: -2, trust: 2 },
    text: "Firm power with somewhere to send it." },
  { id: "carbon", name: "Carbon Craft", parts: ["dac", "mineral", "geothermal"],
    effect: { emissions: -3, ecology: 2 },
    text: "Capture, bind, and clean heat for the fans." },
  { id: "land", name: "Land Dividend", parts: ["forest", "agri", "ferment"],
    effect: { emissions: -2, ecology: 6, prosperity: 2 },
    text: "Forests, soil, and new food. The land pays you back." },
  { id: "mills", name: "Clean Mills", parts: ["steel", "cement", "recycle"],
    effect: { emissions: -2, prosperity: 2, energy: -3 },
    text: "Industry that loops. The power hunger eases." },
  { id: "electric", name: "Electric Life", parts: ["heatpump", "ev", "gridai"],
    effect: { emissions: -2, energy: -2, prosperity: 2 },
    text: "Heat, travel, and a smarter grid." },
  { id: "quietmethane", name: "Quiet Methane", parts: ["methane", "ferment"],
    effect: { emissions: -2, ecology: 2 },
    text: "Leaks plugged and herds thinned." },
  { id: "lithium", name: "Post-Lithium", parts: ["materials", "storage"],
    effect: { energy: -3, prosperity: 2 },
    text: "Storage that is not a mining boom." },
  { id: "build", name: "Clean Build", parts: ["robotics", "solar", "cement"],
    effect: { emissions: -1, prosperity: 2, industry: 1 },
    text: "Fast construction on a clean slab." },
];

export const IDEAS = [
  { id: "flow", name: "Flow Battery Ink", cost: { research: 2, capital: 1 },
    effect: { energy: -5, emissions: -3, prosperity: 1 },
    text: "Print a battery. It soaks up spare noon." },
  { id: "enzymes", name: "Methane Enzymes", cost: { research: 2, trust: 4 },
    effect: { emissions: -9, ecology: 2 },
    text: "Microbes eat leaks. People flinch at a release." },
  { id: "cables", name: "Healing Cables", cost: { research: 1, industry: 1 },
    effect: { energy: -4, prosperity: 2 },
    text: "Lines that mend. Fewer blackout weeks." },
  { id: "drones", name: "Seed Drones", cost: { capital: 2, research: 1 },
    effect: { ecology: 6, emissions: -2 },
    text: "Swarms replant the bare hills." },
  { id: "kilns", name: "Solar Kilns", cost: { capital: 2, industry: 1 },
    effect: { emissions: -4, energy: -2 },
    text: "Daylight fires the kilns. Night they sleep." },
  { id: "assembly", name: "Trust Assembly", cost: { political: 1 },
    effect: { trust: 5, prosperity: 1, emissions: 1 },
    text: "A public vote on the next build. Slower, steadier." },
  { id: "kelp", name: "Kelp Grids", cost: { capital: 1, political: 1 },
    effect: { ecology: 5, emissions: -3, energy: 1 },
    text: "Farms in the shallows. Boats burn fuel to tend them." },
  { id: "nightlaw", name: "Night Storage Law", cost: { political: 2, trust: 2 },
    effect: { energy: -4, emissions: -3 },
    text: "Store power or pay. A rule, not a gadget." },
];

// Technology pathways. Progress is clamped to PATH_NEED. One step per turn.
// RACE weights are a game index for one 6 year step, not terawatt-hours.
export const PATH_NEED = 3;

export const RACE = {
  demandBase: 0.62,
  demandPros: 0.01,
  cleanPer: 0.28,
  serveBase: 0.58,
  policyRetire: 0.1,
  politRetire: 0.03,
  politRetireAt: 3,
  energyRetire: 0.005,
  energyRetireAt: 58,
  winCut: 0.2,
  winCap: 0.24,
  retireCut: 0.1,
  retireCap: 0.14,
  unlockCut: 0.5,
  unlockCap: 0.45,
  energyEase: 0.1,
  energyCap: 0.18,
  hardAviation: 0.7,
  hardShipping: 0.65,
  removalEm: 0.55,
  removalSink: 0.04,
  heavyLeak: 0.06,
  stepCap: 1.35,
};

const RACE_ELECTRIFY = { ev: 0.3, heatpump: 0.14, steel: 0.22 };
const RACE_EFFICIENCY = { heatpump: 0.2, ev: 0.1, cement: 0.16, recycle: 0.16, steel: 0.12 };

export const PATHWAYS = [
  { key: "aviation", name: "Aviation fuels", stall: 0.3, cost: { research: 2, capital: 1 },
    text: "New fuels for planes. Cuts a hard-to-abate slice of emissions.",
    tip: "One step a turn. The cut is real and limited. It does not zero aviation.",
    line: "Aviation fuels reach scale. Hard-to-abate emissions step down." },
  { key: "shipping", name: "Shipping fuels", stall: 0.25, cost: { capital: 2, industry: 1 },
    text: "Cleaner fuel for ships. Cuts the hard-to-abate slice from freight.",
    tip: "One step a turn. The cut is real and limited. It does not zero shipping.",
    line: "Shipping fuels reach scale. Freight emissions step down." },
  { key: "heavy", name: "Heavy industry", stall: 0.25, cost: { capital: 2, industry: 1, research: 1 },
    text: "Cuts carbon from steel, cement, and chemical stacks.",
    tip: "One step a turn. Process change is slow. The stack cut stays bounded.",
    line: "Heavy industry reaches scale. Industrial stacks ease." },
  { key: "storage", name: "Long-duration storage", stall: 0.2, cost: { research: 2, capital: 1 },
    text: "Holds clean power across days, so less of it is wasted.",
    tip: "Full clean-power gain needs grids at pilot too. Until then, extra supply is curtailed.",
    line: "Long-duration storage reaches scale. More clean power can be kept." },
  { key: "grids", name: "Grids", stall: 0.2, cost: { capital: 2, political: 1 },
    text: "Moves spare clean power to where demand actually is.",
    tip: "Full clean-power gain needs long-duration storage at pilot too.",
    line: "Grids reach scale. Less clean power is curtailed." },
  { key: "removal", name: "Carbon removal", stall: 0.3, cost: { capital: 2, research: 1 },
    text: "Pulls carbon back out and gives the land sink more room.",
    tip: "One step a turn. Removal is slow and costly. It does not replace cutting emissions.",
    line: "Carbon removal reaches scale. Removal and the land sink both rise." },
];

export const BREAKTHROUGH_EFFECT = {
  aviation: { emissions: -4 },
  shipping: { emissions: -3 },
  heavy: { emissions: -3 },
  storage: { energy: -2 },
  grids: { energy: -2, prosperity: 1 },
  removal: { emissions: -2, ecology: 3 },
};

const STALL_WORDS = { 0.2: "1 in 5", 0.25: "1 in 4", 0.3: "3 in 10" };

export function stallText(rate) {
  const phrase = STALL_WORDS[rate] || `${Math.round(rate * 100)} in 100`;
  return `${phrase} tries stall. You still pay.`;
}

export function emptyPathways() {
  const out = {};
  for (const spec of PATHWAYS) out[spec.key] = 0;
  return out;
}

export function pathStrength(progress) {
  const p = typeof progress === "number" && Number.isFinite(progress) ? progress : 0;
  if (p >= PATH_NEED) return 1;
  if (p >= 2) return 0.7;
  if (p >= 1) return 0.35;
  return 0;
}

export function pathStage(progress) {
  const p = typeof progress === "number" && Number.isFinite(progress) ? progress : 0;
  if (p >= PATH_NEED) return "breakthrough";
  if (p >= 2) return "scale";
  if (p >= 1) return "pilot";
  return "ready";
}

export function stagePips(progress) {
  const p = typeof progress === "number" && Number.isFinite(progress) ? Math.max(0, progress) : 0;
  return [0, 1, 2].map((i) => {
    if (p > i) return "done";
    if (p === i && p < PATH_NEED) return "active";
    return "wait";
  });
}

function reefEffect(state) {
  if (state.warming >= 1.75) return { ecology: -4, trust: -1, prosperity: -1 };
  return { ecology: 1 };
}

function dryEffect(state) {
  const hot = state.warming >= 1.85;
  return {
    ecology: hot ? -5 : -3,
    prosperity: hot ? -4 : -2,
    trust: -1,
  };
}

export const EVENTS = [
  { id: "dry", name: "Dry Season", auto: true, effect: dryEffect,
    text: "Rivers thin. Cities ration a month of water." },
  { id: "spike", name: "Price Spike",
    text: "Power bills jump. Kitchens go dark at the edges.",
    options: [
      { id: "spike:aid", name: "Subsidize power", cost: { capital: 2 }, effect: { energy: -3, trust: 1 },
        text: "The treasury covers the bill." },
      { id: "spike:bite", name: "Let prices bite", effect: { prosperity: -4, trust: -2, energy: 2 },
        text: "Households absorb it. Anger sticks." },
    ] },
  { id: "march", name: "Square March",
    text: "A crowd wants the next plant voted, not announced.",
    options: [
      { id: "march:hear", name: "Hear them", cost: { political: 1 }, effect: { trust: 4 },
        text: "You give the square a real say." },
      { id: "march:clear", name: "Clear the square", effect: { trust: -6, political: 1 },
        text: "The plan stays. The trust does not." },
    ] },
  { id: "copper", name: "Copper Pinch", auto: true, effect: { energy: 3, industry: -1 },
    text: "Wire gets scarce. New lines wait on the dock." },
  { id: "blowout", name: "Well Blowout", auto: true, effect: { emissions: 5, trust: -2, ecology: -2 },
    text: "A super-emitter lets go. The plume is on every screen." },
  { id: "export", name: "Export Rush", auto: true, effect: { prosperity: 5, emissions: 4 },
    text: "Factories hum for foreign orders. The stacks hum too." },
  { id: "border", name: "Border Pressure",
    text: "Heat inland pushes families toward your cities.",
    options: [
      { id: "border:open", name: "Welcome them", cost: { political: 1 }, effect: { trust: 3, prosperity: -2 },
        text: "Room is made. Budgets stretch." },
      { id: "border:shut", name: "Close the ports", effect: { trust: -6, prosperity: 1 },
        text: "The books look finer. The story does not." },
    ] },
  { id: "harvest", name: "Kind Harvest", auto: true, effect: { ecology: 3, prosperity: 2 },
    text: "Rain landed on time. Silos and soil both recover." },
  { id: "storm", name: "Storm Year", auto: true, effect: { prosperity: -4, capital: -1, ecology: -2 },
    text: "Three coasts take a beating. Rebuilds start in the mud." },
  { id: "lobby", name: "Smoke Deal",
    text: "Old plants offer cash to stay open another decade.",
    options: [
      { id: "lobby:take", name: "Take the money", effect: { capital: 3, trust: -6, emissions: 4 },
        text: "The treasury swells. So does the smoke." },
      { id: "lobby:refuse", name: "Refuse", cost: { political: 1 }, effect: { trust: 2 },
        text: "You send them out. Allies grumble." },
    ] },
  { id: "reef", name: "Reef Report", auto: true, effect: reefEffect,
    text: "Divers come back with a count of what is left." },
  { id: "glut", name: "Panel Glut", auto: true, effect: { energy: -4, prosperity: 1, emissions: -1 },
    text: "Panels pile up at the docks. Noon power gets cheaper." },
  { id: "blackout", name: "Three Dark Nights",
    text: "The grid fails on the hottest week of the year.",
    options: [
      { id: "blackout:coal", name: "Coal sprint", effect: { energy: -3, emissions: 4, trust: -1 },
        text: "Old stacks come back. Lights return, smoke too." },
      { id: "blackout:share", name: "Share the shortage", effect: { prosperity: -3, trust: 2, emissions: -1 },
        text: "You ration. Tempers hold, barely." },
    ] },
];

export const ENDINGS = [
  { id: "fractured", name: "Fractured World",
    blurb: "Trust ran out while heat and food stress pressed on strains that were already there. The plans were real, and people would not stand together for them." },
  { id: "emergency", name: "Long Emergency",
    blurb: "Heat, thin harvests, and worn infrastructure arrived together. The surplus did not cover the damage. Those stresses were serious. They were not a script." },
  { id: "abundance", name: "Abundance",
    blurb: "Clean power, a living landscape, and enough to share. The race turned. It took most of the century, and nothing in the early years guaranteed it." },
  { id: "regeneration", name: "Regeneration Century",
    blurb: "The land led. Forests, soil, and coasts did the slow work beside cuts in the stacks. The century bent because those pieces held together." },
  { id: "managed", name: "Managed Transition",
    blurb: "The worst of the risk was headed off. Not a garden, and not a wreck. A world that held because the cuts, the wires, and the trust kept pace." },
  { id: "hotgrowth", name: "Hot Growth Era",
    blurb: "Markets ran ahead of the heat stock. People were richer, and the risk was higher. That bill was not written in advance." },
];

const ENDING_IDS = ENDINGS.map((e) => e.id);

export function endingName(id) {
  const found = ENDINGS.find((e) => e.id === id);
  return found ? found.name : "Unwritten";
}

export function judge(state) {
  // Priority is fixed. Hot Growth is only the remainder, so it cannot swallow a sharper ending.
  if (state.trust <= 28 || state.political < 2) return "fractured";
  if (state.warming >= 2.08 && state.prosperity <= 44) return "emergency";
  if (
    state.warming <= 2.02 &&
    state.prosperity >= 58 &&
    state.ecology >= 55 &&
    state.energy <= 58 &&
    state.emissions <= 62 &&
    state.trust >= 34
  ) return "abundance";
  if (state.ecology >= 66 && state.warming <= 2.2 && state.prosperity >= 42 && state.trust >= 32) {
    return "regeneration";
  }
  if (
    state.warming <= 2.10 &&
    state.prosperity >= 40 &&
    state.trust >= 33 &&
    state.ecology >= 42 &&
    state.emissions <= 72
  ) return "managed";
  if (state.warming <= 2.0 && state.prosperity < 50) return "managed";
  return "hotgrowth";
}

const cardsById = new Map(CARDS.map((card) => [card.id, card]));
const ideasById = new Map(IDEAS.map((idea) => [idea.id, idea]));
const eventsById = new Map(EVENTS.map((event) => [event.id, event]));
const pathwaysById = new Map(PATHWAYS.map((spec) => [spec.key, spec]));

export function openingMeters() {
  return {
    capital: 7,
    research: 5,
    political: 4,
    industry: 4,
    trust: 52,
    emissions: 76,
    energy: 71,
    prosperity: 46,
    ecology: 49,
    warming: 1.4,
  };
}

function blankState() {
  return openingMeters();
}

function snapshot(state) {
  const out = {};
  for (const key of Object.keys(BOUNDS)) out[key] = state[key];
  out.warming = state.warming;
  return out;
}

function writeMeter(state, key, value) {
  const range = BOUNDS[key];
  if (!range) return;
  state[key] = round2(clamp(value, range[0], range[1]));
}

function addMeters(state, effect) {
  for (const [key, value] of Object.entries(effect || {})) {
    if (!(key in BOUNDS) || typeof value !== "number" || !Number.isFinite(value) || value === 0) continue;
    writeMeter(state, key, state[key] + value);
  }
}

function resolveEffect(effect, state) {
  const raw = typeof effect === "function" ? effect(state) : effect;
  const out = {};
  for (const [key, value] of Object.entries(raw || {})) {
    if (typeof value === "number" && value !== 0) out[key] = value;
  }
  return out;
}

function canAfford(cost, state) {
  for (const [key, value] of Object.entries(cost || {})) {
    if ((state[key] || 0) + 1e-9 < value) return false;
  }
  return true;
}

function pay(state, cost) {
  for (const [key, value] of Object.entries(cost || {})) writeMeter(state, key, state[key] - value);
}

function pricedCost(card, state) {
  const cost = { ...(card.cost || {}) };
  const policy = card.tags && card.tags.includes("policy");
  if (policy && state.trust < PARAMS.trustSurchargeAt) cost.political = (cost.political || 0) + 1;
  if (state.energy > PARAMS.energySurchargeAt) cost.political = (cost.political || 0) + 1;
  return cost;
}

function scaledEffect(card, state) {
  const effect = { ...(card.effect || {}) };
  if (card.tags && card.tags.includes("policy")) {
    const scale = policyScale(state.trust);
    for (const key of METER_KEYS) {
      if (typeof effect[key] === "number") effect[key] = round2(effect[key] * scale);
    }
  }
  return effect;
}

function take(list, n, rng) {
  const pool = list.slice();
  const out = [];
  for (let i = 0; i < n && pool.length; i += 1) {
    const j = Math.floor(rng() * pool.length);
    out.push(pool.splice(j, 1)[0]);
  }
  return out;
}

function shuffle(list, rng) {
  const arr = list.slice();
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const swap = arr[i];
    arr[i] = arr[j];
    arr[j] = swap;
  }
  return arr;
}

export function synergyProgress(cardId, ownedIds, firedIds) {
  const owned = new Set(ownedIds);
  const fired = new Set(firedIds);
  let completes = 0;
  let advances = 0;
  const names = [];
  for (const syn of SYNERGIES) {
    if (fired.has(syn.id) || !syn.parts.includes(cardId)) continue;
    const have = syn.parts.filter((part) => owned.has(part) || part === cardId).length;
    if (have === syn.parts.length) {
      completes += 1;
      names.push(syn.name);
    } else if (have >= syn.parts.length - 1) advances += 1;
  }
  return { completes, advances, names, value: completes * 4 + advances * 1.6 };
}

export function pathwayVector(state) {
  const out = emptyPathways();
  const src = state && state.pathways;
  if (!src) return out;
  for (const key of Object.keys(out)) {
    const value = src[key];
    if (typeof value === "number" && Number.isFinite(value)) out[key] = clamp(value, 0, PATH_NEED);
  }
  return out;
}

function pathStageIndex(progress) {
  const p = typeof progress === "number" && Number.isFinite(progress) ? progress : 0;
  if (p >= PATH_NEED) return 3;
  if (p >= 2) return 2;
  if (p >= 1) return 1;
  return 0;
}

export function serveFactor(pathways) {
  const src = pathways || emptyPathways();
  const storage = pathStageIndex(src.storage);
  const grids = pathStageIndex(src.grids);
  let serve = RACE.serveBase;
  // Pilot complete on both tracks is the gate. One track alone does not raise the cap.
  if (storage >= 2 && grids >= 2) {
    serve += 0.12 * Math.min(storage, grids) + 0.03 * (storage + grids);
  }
  return clamp(round2(serve), RACE.serveBase, 1);
}

function removalSink(pathways) {
  return round2(pathStrength((pathways || emptyPathways()).removal) * RACE.removalSink);
}

export function energyRace(state, owned, years, pathways) {
  const paths = pathways || emptyPathways();
  const serve = serveFactor(paths);
  if (!(years > 0)) {
    return {
      demand: 0, clean: 0, cleanBase: 0, efficiency: 0, met: 0, retire: 0, fossil: 0,
      curtailed: 0, serve, winning: false, fossilDown: false, years: 0,
      summary: "No step left in the race.",
      fossilLabel: "Fossil generation flat",
    };
  }
  const y = years / 6;
  const ownedSet = new Set(owned || []);
  let electrify = 0;
  for (const [id, weight] of Object.entries(RACE_ELECTRIFY)) {
    if (ownedSet.has(id)) electrify += weight;
  }
  let efficiencyRaw = 0;
  for (const [id, weight] of Object.entries(RACE_EFFICIENCY)) {
    if (ownedSet.has(id)) efficiencyRaw += weight;
  }
  const cleanN = tagCount(owned || [], cardsById, "clean");
  const policyN = tagCount(owned || [], cardsById, "policy");
  const demand = (RACE.demandBase + Math.max(0, state.prosperity - PARAMS.growthFloor) * RACE.demandPros + electrify) * y;
  const efficiency = efficiencyRaw * y;
  const potential = cleanN * RACE.cleanPer * y;
  const cleanBase = potential * RACE.serveBase;
  const clean = potential * serve;
  const met = clean + efficiency;
  const regulation = clamp((state.political - RACE.politRetireAt) * RACE.politRetire, 0, 0.22);
  const economics = state.energy < RACE.energyRetireAt
    ? clamp((RACE.energyRetireAt - state.energy) * RACE.energyRetire, 0, 0.28)
    : 0;
  const retire = (policyN * RACE.policyRetire + regulation + economics) * y;
  const fossil = round2(demand - met - retire);
  const demandOut = round2(demand);
  const metOut = round2(met);
  const fossilDown = fossil < -0.02;
  const winning = metOut + 1e-9 >= demandOut && fossilDown;
  let summary;
  if (winning) summary = "Clean additions plus efficiency exceed demand, and fossil generation is falling.";
  else if (metOut + 1e-9 >= demandOut) summary = "Clean additions plus efficiency cover new demand. Fossil plants are not leaving fast enough.";
  else summary = "Demand growth is ahead of clean additions plus efficiency.";
  return {
    demand: demandOut,
    clean: round2(clean),
    cleanBase: round2(cleanBase),
    efficiency: round2(efficiency),
    met: metOut,
    retire: round2(retire),
    fossil,
    curtailed: round2(Math.max(0, potential - clean)),
    serve,
    winning,
    fossilDown,
    years,
    summary,
    fossilLabel: fossilDown ? "Fossil generation down" : fossil > 0.02 ? "Fossil generation up" : "Fossil generation flat",
  };
}

function raceEffect(race, pathways) {
  const paths = pathways || emptyPathways();
  const y = race.years > 0 ? race.years / 6 : 0;
  let cut = 0;
  if (race.met > race.demand) cut += Math.min(RACE.winCap, (race.met - race.demand) * RACE.winCut);
  if (race.fossil < 0) cut += Math.min(RACE.retireCap, -race.fossil * RACE.retireCut);
  const unlocked = Math.max(0, race.clean - race.cleanBase);
  cut += Math.min(RACE.unlockCap, unlocked * RACE.unlockCut);
  cut += pathStrength(paths.aviation) * RACE.hardAviation * y;
  cut += pathStrength(paths.shipping) * RACE.hardShipping * y;
  cut += pathStrength(paths.removal) * RACE.removalEm * y;
  cut = Math.min(RACE.stepCap, cut);
  let energy = 0;
  if (race.met > race.demand) energy = -Math.min(RACE.energyCap, (race.met - race.demand) * RACE.energyEase);
  return {
    emissions: cut ? round2(-cut) : 0,
    energy: energy ? round2(energy) : 0,
    sinkAdd: removalSink(paths),
  };
}

function worldStep(state, owned, years, pathways) {
  const y = years / 6;
  const paths = pathwayVector({ pathways });
  const clean = tagCount(owned, cardsById, "clean");
  const dec = Math.min(PARAMS.decCap, tagCount(owned, cardsById, "decouple") * PARAMS.decPerCard);
  const leak = PARAMS.industryLeak - pathStrength(paths.heavy) * RACE.heavyLeak;
  const notes = [];

  let pol = PARAMS.income.political;
  if (state.energy > 58) pol -= (state.energy - 58) * PARAMS.politicalEnergyDrag;
  if (state.trust < 36) pol -= PARAMS.politicalTrustDrag;
  pol = Math.max(0, pol);
  writeMeter(state, "capital", state.capital + PARAMS.income.capital * y);
  writeMeter(state, "research", state.research + PARAMS.income.research * y);
  writeMeter(state, "industry", state.industry + PARAMS.income.industry * y);
  writeMeter(state, "political", state.political + pol * y);

  const beforePros = state.prosperity;
  let dPros = PARAMS.prosBase * y;
  const energyPros = (58 - state.energy) * PARAMS.prosEnergy * y;
  dPros += energyPros;
  let heatPros = 0;
  if (state.warming > PARAMS.prosHeatAt) {
    const drag = (state.warming - PARAMS.prosHeatAt) * PARAMS.prosHeat * y;
    heatPros = -drag;
    dPros -= drag;
  }
  writeMeter(state, "prosperity", state.prosperity + dPros);
  if (state.energy > 60 && state.prosperity < beforePros - 0.3) notes.push("Costly energy drags prosperity.");
  if (state.energy < 42 && state.prosperity > beforePros + 0.3) notes.push("Cheap power lifts prosperity.");

  const beforeEm = state.emissions;
  let dEm = Math.max(0, state.prosperity - PARAMS.growthFloor) * PARAMS.growthEmissions * (1 - dec) * y;
  const growthPush = dEm;
  let richPush = 0;
  if (state.prosperity > PARAMS.richLeakAt) {
    richPush = (state.prosperity - PARAMS.richLeakAt) * PARAMS.richLeak * (1 - dec) * y;
    dEm += richPush;
  }
  let industryPush = 0;
  if (state.industry > PARAMS.industryLeakAt) {
    industryPush = (state.industry - PARAMS.industryLeakAt) * leak * (1 - dec) * y;
    dEm += industryPush;
  }
  let fullEm = Math.max(0, state.prosperity - PARAMS.growthFloor) * PARAMS.growthEmissions * y;
  if (state.prosperity > PARAMS.richLeakAt) {
    fullEm += (state.prosperity - PARAMS.richLeakAt) * PARAMS.richLeak * y;
  }
  if (state.industry > PARAMS.industryLeakAt) {
    fullEm += (state.industry - PARAMS.industryLeakAt) * PARAMS.industryLeak * y;
  }
  writeMeter(state, "emissions", state.emissions + dEm);
  const race = energyRace(state, owned, years, paths);
  const nudge = raceEffect(race, paths);
  if (nudge.emissions) writeMeter(state, "emissions", state.emissions + nudge.emissions);
  if (nudge.energy) writeMeter(state, "energy", state.energy + nudge.energy);
  if (state.emissions > beforeEm + 0.3 && dec < 0.45) notes.push("Growth pushes emissions up.");

  let dEco = -PARAMS.ecoDrift * y;
  let heatEco = 0;
  if (state.warming > PARAMS.ecoHeatAt) {
    const drag = (state.warming - PARAMS.ecoHeatAt) * PARAMS.ecoHeat * y;
    heatEco = -drag;
    dEco -= drag;
  }
  const ecoBefore = state.ecology;
  writeMeter(state, "ecology", state.ecology + dEco);

  let dTrust = 0.2;
  let heatTrust = 0;
  let poorTrust = 0;
  let healTrust = 0;
  if (state.warming > PARAMS.trustHeatAt) {
    const drag = (state.warming - PARAMS.trustHeatAt) * PARAMS.trustHeat * y;
    heatTrust = -drag;
    dTrust -= drag;
  }
  if (state.prosperity < PARAMS.trustPoorAt) {
    poorTrust = -PARAMS.trustPoor * y;
    dTrust -= PARAMS.trustPoor * y;
  }
  if (state.energy < 44 && state.prosperity > 56 && state.warming < 1.9) {
    healTrust = PARAMS.trustHeal * y;
    dTrust += healTrust;
  }
  writeMeter(state, "trust", state.trust + dTrust);

  const sinkAdd = nudge.sinkAdd;
  const eq = equilibrium(state.emissions, state.ecology, sinkAdd);
  const warmed = round2(clamp(stepWarming(state.warming, eq, years), 0, 6));
  if (state.ecology < 42 && warmed > state.warming + 0.01) notes.push("A thin landscape stores less carbon.");
  else if (state.ecology > 68 && eq < equilibrium(state.emissions, ecoBefore, sinkAdd)) notes.push("Healthy land slows the heat.");
  const landSink = (state.ecology - 50) * PARAMS.eqPerEcology + sinkAdd;
  state.warming = warmed;
  return {
    notes: notes.slice(0, 2),
    decoupling: round2(dec),
    clean,
    flows: {
      energyPros: round2(energyPros),
      heatPros: round2(heatPros),
      growthPush: round2(growthPush),
      richPush: round2(richPush),
      industryPush: round2(industryPush),
      added: round2(fullEm),
      avoided: round2(fullEm - dEm),
      heatEco: round2(heatEco),
      heatTrust: round2(heatTrust),
      poorTrust: round2(poorTrust),
      healTrust: round2(healTrust),
      landSink: round2(landSink),
      decoupling: round2(dec),
      raceNudge: nudge.emissions,
      sinkAdd,
      race,
    },
  };
}

export function advanceWorld(state, owned, years, pathways) {
  return worldStep(state, owned, years, pathways);
}

function derived(state, year, pathways) {
  const sinkAdd = removalSink(pathways);
  const eq = equilibrium(state.emissions, state.ecology, sinkAdd);
  return {
    equilibrium: eq,
    projected: projectWarming(state.warming, state.emissions, state.ecology, year, sinkAdd),
  };
}

export function createRun(seed) {
  const rng = mulberry32(seed);
  const state = blankState();
  const owned = [];
  const fired = [];
  const pathways = emptyPathways();
  const log = [];
  const eventQueue = shuffle(EVENTS.map((event) => event.id), rng);
  let turnIndex = 0;
  let phase = "act";
  let ending = null;
  let hand = [];
  let ideaOffer = [];
  let labLock = 0;
  let pending = null;
  let autoEvent = null;
  let peak = state.warming;

  function rememberPeak() {
    if (state.warming > peak) peak = state.warming;
  }

  function beginTurn() {
    autoEvent = null;
    pending = null;
    const years = spanYears(turnIndex);
    const year = YEARS[turnIndex];
    if (turnIndex >= labLock && ideaOffer.length === 0) {
      ideaOffer = take(IDEAS.map((idea) => idea.id), 2, rng);
    }
    const roll = rng();
    const chance = turnIndex === 0 ? 1 : PARAMS.eventChance;
    if (roll < chance && eventQueue.length) {
      const event = eventsById.get(eventQueue.shift());
      if (event.auto) {
        const effect = resolveEffect(event.effect, state);
        addMeters(state, effect);
        rememberPeak();
        autoEvent = { id: event.id, name: event.name, text: event.text, choiceId: null, effect };
      } else {
        pending = event;
      }
    }
    const remaining = CARDS.map((card) => card.id).filter((id) => !owned.includes(id));
    hand = take(remaining, 3, rng);
    phase = pending ? "event" : "act";
    return { years, year };
  }

  function publicOffers() {
    const year = phase === "end" ? 2100 : YEARS[Math.min(turnIndex, YEARS.length - 1)];
    const cards = hand.map((id) => {
      const card = cardsById.get(id);
      const cost = pricedCost(card, state);
      const effect = scaledEffect(card, state);
      const progress = synergyProgress(id, owned, fired);
      return {
        id: card.id,
        name: card.name,
        lane: card.lane,
        kind: "card",
        text: card.text,
        tags: card.tags.slice(),
        cost,
        effect,
        scale: card.tags.includes("policy") ? policyScale(state.trust) : 1,
        affordable: canAfford(cost, state),
        synergy: progress,
      };
    });
    const ready = turnIndex >= labLock;
    const ideas = ready ? ideaOffer.map((id) => {
      const idea = ideasById.get(id);
      const effect = clampEffect(idea.effect);
      return {
        id: idea.id,
        name: idea.name,
        kind: "idea",
        text: idea.text,
        cost: { ...idea.cost },
        effect,
        raw: { ...idea.effect },
        affordable: canAfford(idea.cost, state),
        available: true,
      };
    }) : [];
    let event = null;
    if (pending) {
      event = {
        id: pending.id,
        name: pending.name,
        text: pending.text,
        options: pending.options.map((option) => ({
          id: option.id,
          name: option.name,
          text: option.text,
          cost: { ...(option.cost || {}) },
          effect: resolveEffect(option.effect, state),
          affordable: canAfford(option.cost, state),
        })),
      };
    } else if (autoEvent) {
      event = {
        id: autoEvent.id,
        name: autoEvent.name,
        text: autoEvent.text,
        options: null,
        effect: autoEvent.effect,
      };
    }
    return {
      year,
      turn: Math.min(turnIndex + 1, TURN_COUNT),
      span: phase === "end" ? 0 : spanYears(turnIndex),
      cards,
      ideas,
      lab: { ready, turnsLeft: Math.max(0, labLock - turnIndex) },
      event,
      canPass: phase === "act",
      pathways: PATHWAYS.map((spec) => {
        const progress = pathways[spec.key];
        const done = progress >= PATH_NEED;
        return {
          id: `path:${spec.key}`,
          key: spec.key,
          name: spec.name,
          text: spec.text,
          tip: spec.tip,
          stallText: stallText(spec.stall),
          cost: { ...spec.cost },
          progress,
          need: PATH_NEED,
          stage: pathStage(progress),
          pips: stagePips(progress),
          done,
          strength: pathStrength(progress),
          affordable: !done && phase === "act" && canAfford(spec.cost, state),
        };
      }),
    };
  }

  function finishIfNeeded() {
    if (turnIndex < TURN_COUNT) return false;
    phase = "end";
    hand = [];
    pending = null;
    ending = judge(state);
    if (!ENDING_IDS.includes(ending)) ending = "hotgrowth";
    return true;
  }

  function chooseAction(id) {
    if (phase === "end") return { ok: false, reason: "ended" };
    if (pending) {
      const option = pending.options.find((item) => item.id === id);
      if (!option) {
        if (ideasById.has(id) && turnIndex < labLock) return { ok: false, reason: "cooldown" };
        return { ok: false, reason: "event" };
      }
      if (!canAfford(option.cost, state)) return { ok: false, reason: "afford" };
      pay(state, option.cost);
      const effect = resolveEffect(option.effect, state);
      addMeters(state, effect);
      rememberPeak();
      autoEvent = {
        id: pending.id,
        name: pending.name,
        text: pending.text,
        choiceId: option.id,
        effect,
      };
      pending = null;
      phase = "act";
      return { ok: true, resolved: "event" };
    }
    if (typeof id === "string" && id.startsWith("path:")) {
      const key = id.slice(5);
      const spec = pathwaysById.get(key);
      if (!spec) return { ok: false, reason: "unknown" };
      if (pathways[key] >= PATH_NEED) return { ok: false, reason: "done" };
      if (!canAfford(spec.cost, state)) return { ok: false, reason: "afford" };
      return commitPick({ id, name: spec.name, kind: "path", key });
    }
    if (id === "pass") return commitPick({ id: "pass", name: "Hold steady", kind: "pass" });
    if (ideasById.has(id)) {
      if (turnIndex < labLock) return { ok: false, reason: "cooldown" };
      if (!ideaOffer.includes(id)) return { ok: false, reason: "unoffered" };
      const idea = ideasById.get(id);
      if (!canAfford(idea.cost, state)) return { ok: false, reason: "afford" };
      return commitPick({ id: idea.id, name: idea.name, kind: "idea" });
    }
    if (!cardsById.has(id)) return { ok: false, reason: "unknown" };
    if (!hand.includes(id)) return { ok: false, reason: "unoffered" };
    const card = cardsById.get(id);
    if (!canAfford(pricedCost(card, state), state)) return { ok: false, reason: "afford" };
    return commitPick({ id: card.id, name: card.name, kind: "card" });
  }

  function commitPick(pick) {
    const year = YEARS[turnIndex];
    const span = spanYears(turnIndex);
    const before = snapshot(state);
    const notes = [];
    const sparked = [];
    let pathLog = null;
    if (pick.kind === "card") {
      const card = cardsById.get(pick.id);
      const cost = pricedCost(card, state);
      pay(state, cost);
      addMeters(state, scaledEffect(card, state));
      owned.push(card.id);
      for (const syn of SYNERGIES) {
        if (fired.includes(syn.id)) continue;
        if (!syn.parts.every((part) => owned.includes(part))) continue;
        fired.push(syn.id);
        addMeters(state, syn.effect);
        sparked.push(syn.name);
        notes.push(syn.name + " locks in.");
      }
    } else if (pick.kind === "idea") {
      const idea = ideasById.get(pick.id);
      pay(state, idea.cost);
      const applied = clampEffect(idea.effect);
      addMeters(state, applied);
      ideaOffer = [];
      labLock = turnIndex + 3;
    } else if (pick.kind === "path") {
      const spec = pathwaysById.get(pick.key);
      pay(state, spec.cost);
      const stalled = rng() < spec.stall;
      let breakthrough = false;
      if (!stalled) {
        pathways[pick.key] = Math.min(PATH_NEED, pathways[pick.key] + 1);
        const now = pathways[pick.key];
        if (now >= PATH_NEED) {
          breakthrough = true;
          addMeters(state, BREAKTHROUGH_EFFECT[pick.key]);
          notes.push(spec.line);
        } else if (now === 1) notes.push(`${spec.name} enters pilot.`);
        else if (now === 2) notes.push(`${spec.name} enters scale.`);
        else notes.push(`${spec.name} advances.`);
      } else notes.push(`${spec.name} stalls. The cost is spent.`);
      pathLog = {
        id: pick.id,
        key: pick.key,
        stalled,
        progress: pathways[pick.key],
        breakthrough,
        line: spec.line,
      };
    } else {
      notes.push("You hold steady.");
    }
    const step = worldStep(state, owned, span, pathways);
    rememberPeak();
    const afterYear = Math.min(2100, year + span);
      const view = derived(state, afterYear, pathways);
    log.push({
      turn: turnIndex + 1,
      year,
      span,
      event: autoEvent ? {
        id: autoEvent.id,
        name: autoEvent.name,
        choiceId: autoEvent.choiceId,
        effect: autoEvent.effect,
      } : null,
      pick: { id: pick.id, name: pick.name, kind: pick.kind },
      pathway: pathLog,
      synergies: sparked.slice(),
      before,
      after: snapshot(state),
      projected: view.projected,
      equilibrium: view.equilibrium,
      notes: notes.concat(step.notes).slice(0, 3),
    });
    turnIndex += 1;
    if (!finishIfNeeded()) beginTurn();
    const breakthrough = pathLog && pathLog.breakthrough
      ? { id: pathLog.id, key: pathLog.key, name: pick.name, line: pathLog.line }
      : null;
    return { ok: true, breakthrough };
  }

  function tweak(partial) {
    for (const [key, value] of Object.entries(partial || {})) {
      if (key in BOUNDS && typeof value === "number" && Number.isFinite(value)) writeMeter(state, key, value);
    }
    rememberPeak();
    return publicState();
  }

  function publicState() {
    const year = phase === "end" ? 2100 : YEARS[Math.min(turnIndex, YEARS.length - 1)];
    const view = derived(state, year, pathways);
    return {
      seed,
      phase,
      turn: phase === "end" ? TURN_COUNT : turnIndex + 1,
      turnIndex: phase === "end" ? TURN_COUNT : turnIndex,
      year,
      span: phase === "end" ? 0 : spanYears(Math.min(turnIndex, TURN_COUNT - 1)),
      capital: state.capital,
      research: state.research,
      political: state.political,
      industry: state.industry,
      emissions: state.emissions,
      energy: state.energy,
      prosperity: state.prosperity,
      ecology: state.ecology,
      trust: state.trust,
      warming: state.warming,
      peak,
      equilibrium: view.equilibrium,
      projected: view.projected,
      owned: owned.slice(),
      synergies: fired.slice(),
      pathways: { ...pathways },
      lab: { ready: turnIndex >= labLock && phase !== "end", turnsLeft: Math.max(0, labLock - turnIndex) },
      ending,
      endingName: ending ? endingName(ending) : null,
    };
  }

  beginTurn();

  return {
    choose: chooseAction,
    offers: publicOffers,
    state: publicState,
    log: () => log.map((entry) => JSON.parse(JSON.stringify(entry))),
    ending: () => ending,
    tweak,
  };
}

export const OUTLOOK_POLICIES = ["hold", "cut", "grow", "restore", "power", "trust", "alpha"];
export const TIP_LEVEL = PARAMS.prosHeatAt;

const POINT_KEYS = ["warming", "emissions", "energy", "prosperity", "ecology", "trust"];

function shadowState(state) {
  const out = openingMeters();
  for (const key of Object.keys(out)) {
    if (typeof state[key] === "number" && Number.isFinite(state[key])) out[key] = state[key];
  }
  return out;
}

function meterPoint(i, year, src) {
  const out = { i, year };
  for (const key of POINT_KEYS) out[key] = src[key];
  return out;
}

function metersDiffer(a, b) {
  return POINT_KEYS.some((key) => a[key] !== b[key]);
}

function historyPoints(state, log) {
  const open = openingMeters();
  const points = [];
  if (!log.length) {
    if (metersDiffer(state, open)) points.push(meterPoint(0, YEARS[0], open));
    const nowI = points.length ? 0.4 : 0;
    points.push(meterPoint(nowI, state.year, state));
    return points;
  }
  if (metersDiffer(open, log[0].before)) points.push(meterPoint(0, YEARS[0], open));
  const decisionI = points.length ? 0.4 : 0;
  points.push(meterPoint(decisionI, log[0].year, log[0].before));
  for (const entry of log) {
    points.push(meterPoint(entry.turn, Math.min(2100, entry.year + entry.span), entry.after));
  }
  const last = log[log.length - 1];
  if (state.phase !== "end" && metersDiffer(state, last.after)) {
    points.push(meterPoint(state.turnIndex + 0.4, state.year, state));
  }
  return points;
}

function policyScore(card, state, policy) {
  const fx = scaledEffect(card, state);
  if (policy === "cut") return -(fx.emissions || 0);
  if (policy === "grow") return (fx.prosperity || 0) * 2 + (fx.emissions || 0);
  if (policy === "restore") return fx.ecology || 0;
  if (policy === "power") return -(fx.energy || 0);
  if (policy === "trust") return fx.trust || 0;
  return 0;
}

function choosePolicyCard(state, owned, policy) {
  const options = [];
  for (const card of CARDS) {
    if (owned.includes(card.id)) continue;
    if (!canAfford(pricedCost(card, state), state)) continue;
    options.push(card);
  }
  if (!options.length) return null;
  if (policy === "alpha") {
    options.sort((a, b) => a.id.localeCompare(b.id));
    return options[0];
  }
  let best = options[0];
  let bestScore = policyScore(best, state, policy);
  for (let i = 1; i < options.length; i += 1) {
    const card = options[i];
    const score = policyScore(card, state, policy);
    if (score > bestScore + 1e-9 || (Math.abs(score - bestScore) <= 1e-9 && card.id < best.id)) {
      best = card;
      bestScore = score;
    }
  }
  return best;
}

function applyProjectedCard(state, owned, fired, card) {
  const cost = pricedCost(card, state);
  if (!canAfford(cost, state)) return false;
  pay(state, cost);
  addMeters(state, scaledEffect(card, state));
  owned.push(card.id);
  for (const syn of SYNERGIES) {
    if (fired.includes(syn.id)) continue;
    if (!syn.parts.every((part) => owned.includes(part))) continue;
    fired.push(syn.id);
    addMeters(state, syn.effect);
  }
  return true;
}

export function simulatePolicy(state, policy) {
  const turnIndex = state.phase === "end" ? TURN_COUNT : state.turnIndex;
  const sim = shadowState(state);
  const owned = (state.owned || []).slice();
  const fired = (state.synergies || []).slice();
  const pathways = pathwayVector(state);
  const points = [];
  if (turnIndex >= TURN_COUNT) {
    return { points, ending: state.ending || judge(sim), final: sim };
  }
  for (let t = turnIndex; t < TURN_COUNT; t += 1) {
    if (policy !== "hold") {
      const card = choosePolicyCard(sim, owned, policy);
      if (card) applyProjectedCard(sim, owned, fired, card);
    }
    const years = spanYears(t);
    worldStep(sim, owned, years, pathways);
    const startYear = YEARS[t] || 2100;
    points.push(meterPoint(t + 1, Math.min(2100, startYear + years), sim));
  }
  return { points, ending: judge(sim), final: sim };
}

function findCrossing(series, level) {
  for (let i = 0; i < series.length; i += 1) {
    if (series[i].warming + 1e-9 < level) continue;
    if (i === 0) return { year: series[0].year, i: series[0].i };
    const prev = series[i - 1];
    const cur = series[i];
    const span = cur.warming - prev.warming;
    const u = span === 0 ? 1 : (level - prev.warming) / span;
    const uu = Math.max(0, Math.min(1, u));
    return {
      year: Math.round(prev.year + (cur.year - prev.year) * uu),
      i: prev.i + (cur.i - prev.i) * uu,
    };
  }
  return null;
}

function meterDeltas(state, log) {
  const from = log && log.length ? log[log.length - 1].before : openingMeters();
  const out = {};
  for (const key of POINT_KEYS) out[key] = round2(state[key] - from[key]);
  return out;
}

function emptyFlows() {
  return {
    energyPros: 0,
    heatPros: 0,
    growthPush: 0,
    richPush: 0,
    industryPush: 0,
    added: 0,
    avoided: 0,
    heatEco: 0,
    heatTrust: 0,
    poorTrust: 0,
    healTrust: 0,
    landSink: 0,
    decoupling: 0,
    raceNudge: 0,
    sinkAdd: 0,
    race: null,
  };
}

function stepReadout(state, owned, years, pathways) {
  const paths = pathways || pathwayVector(state);
  if (!(years > 0)) {
    const dec = Math.min(PARAMS.decCap, tagCount(owned, cardsById, "decouple") * PARAMS.decPerCard);
    const flows = emptyFlows();
    flows.sinkAdd = removalSink(paths);
    flows.landSink = round2((state.ecology - 50) * PARAMS.eqPerEcology + flows.sinkAdd);
    flows.decoupling = round2(dec);
    flows.race = energyRace(state, owned, 0, paths);
    return { before: shadowState(state), after: shadowState(state), flows, net: 0 };
  }
  const before = shadowState(state);
  const after = shadowState(state);
  const step = worldStep(after, owned, years, paths);
  return {
    before,
    after,
    flows: step.flows,
    net: round2(after.emissions - before.emissions),
  };
}

function pressureRows(flows) {
  const rows = [
    { id: "energy-prosperity", from: "Energy", to: "Prosperity", value: flows.energyPros },
    { id: "heat-prosperity", from: "Heat", to: "Prosperity", value: flows.heatPros },
    { id: "prosperity-emissions", from: "Prosperity", to: "Emissions", value: round2(flows.growthPush + flows.richPush) },
    { id: "industry-emissions", from: "Industry", to: "Emissions", value: flows.industryPush },
    { id: "land-heat", from: "Land", to: "Heat", value: round2(-flows.landSink) },
    { id: "heat-ecology", from: "Heat", to: "Ecology", value: flows.heatEco },
    { id: "heat-trust", from: "Heat", to: "Trust", value: flows.heatTrust },
    { id: "prosperity-trust", from: "Prosperity", to: "Trust", value: round2(flows.poorTrust + flows.healTrust) },
  ];
  return rows
    .filter((row) => Math.abs(row.value) >= 0.05)
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value) || a.id.localeCompare(b.id))
    .slice(0, 6);
}

export function readIndicators(state, log) {
  const history = historyPoints(state, log || []);
  const owned = state.owned || [];
  const pathways = pathwayVector(state);
  const years = state.phase === "end" ? 0 : (state.span || spanYears(state.turnIndex || 0));
  const paths = {};
  for (const policy of OUTLOOK_POLICIES) paths[policy] = simulatePolicy(state, policy);
  const hold = paths.hold.points;
  const forward = hold.map((point, index) => {
    let lo = point.warming;
    let hi = point.warming;
    for (const policy of OUTLOOK_POLICIES) {
      const sample = paths[policy].points[index];
      if (!sample) continue;
      if (sample.warming < lo) lo = sample.warming;
      if (sample.warming > hi) hi = sample.warming;
    }
    return {
      i: point.i,
      year: point.year,
      warming: point.warming,
      lo,
      hi,
      emissions: point.emissions,
      energy: point.energy,
      prosperity: point.prosperity,
      ecology: point.ecology,
      trust: point.trust,
    };
  });
  const series = history.concat(hold);
  const hit = findCrossing(series, TIP_LEVEL);
  const realized = history[history.length - 1];
  const already = !!(realized && realized.warming + 1e-9 >= TIP_LEVEL);
  const tip = {
    level: TIP_LEVEL,
    crossed: !!hit,
    already,
    year: hit ? hit.year : null,
    i: hit ? hit.i : null,
  };
  const counts = Object.fromEntries(ENDINGS.map((ending) => [ending.id, 0]));
  if (state.phase === "end" && state.ending) {
    counts[state.ending] = OUTLOOK_POLICIES.length;
  } else {
    for (const policy of OUTLOOK_POLICIES) {
      const id = paths[policy].ending;
      if (id in counts) counts[id] += 1;
    }
  }
  const outlook = ENDINGS.map((ending) => ({
    id: ending.id,
    name: ending.name,
    n: counts[ending.id],
    share: counts[ending.id] / OUTLOOK_POLICIES.length,
  }));
  const step = stepReadout(state, owned, years, pathways);
  const eq = equilibrium(state.emissions, state.ecology, removalSink(pathways));
  const alpha = years > 0 ? lagAlpha(years) : 0;
  const gap = eq - state.warming;
  const headingId = state.phase === "end" && state.ending ? state.ending : paths.hold.ending;
  return {
    history,
    forward,
    heading: { id: headingId, name: endingName(headingId) },
    tip,
    deltas: meterDeltas(state, log || []),
    stock: {
      warming: state.warming,
      target: eq,
      gap: round2(gap),
      alpha: round2(alpha),
      closes: round2(gap * alpha),
      years,
    },
    ledger: {
      added: step.flows.added,
      avoided: step.flows.avoided,
      net: step.net,
      sink: step.flows.landSink,
      decoupling: step.flows.decoupling,
    },
    pressures: years > 0 ? pressureRows(step.flows) : [],
    outlook,
    outlookTotal: OUTLOOK_POLICIES.length,
    quiet: true,
    race: step.flows.race,
    pathways,
  };
}

export function playChoices(seed, chooser) {
  const run = createRun(seed);
  const actions = [];
  let guard = 0;
  while (run.state().phase !== "end") {
    const offers = run.offers();
    const id = chooser(offers, run.state());
    const result = run.choose(id);
    actions.push({ id, result: result.ok ? "ok" : result.reason });
    guard += 1;
    if (!result.ok) {
      const fallback = offers.event ? null : "pass";
      if (fallback) run.choose(fallback);
      else break;
    }
    if (guard > 80) break;
  }
  return { ending: run.ending(), state: run.state(), log: run.log(), actions };
}
