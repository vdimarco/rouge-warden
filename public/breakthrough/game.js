(() => {
const YEARS = [2026, 2032, 2038, 2044, 2050, 2056, 2062, 2068, 2074, 2080, 2090, 2100];
const TECHS = [
{id:"geothermal",name:"Advanced Geothermal",cat:"Energy",desc:"AI-guided drilling opens clean firm power almost anywhere.",cost:{capital:2,research:1,industry:1},fx:{emissions:-8,energy:-5,prosperity:2}},
{id:"solar",name:"Perovskite Solar",cat:"Energy",desc:"Ultra-light tandem cells make solar cheaper and faster to deploy.",cost:{capital:2,research:1},fx:{emissions:-7,energy:-6,prosperity:2}},
{id:"storage",name:"Iron-Air Storage",cat:"Energy",desc:"Cheap multi-day batteries smooth renewable power.",cost:{capital:2,research:2},fx:{emissions:-6,energy:-5,prosperity:1}},
{id:"hvdc",name:"Continental HVDC",cat:"Infrastructure",desc:"Move clean power across huge distances with low losses.",cost:{capital:2,political:1,industry:2},fx:{emissions:-5,energy:-4,prosperity:2}},
{id:"gridai",name:"AI Grid Orchestration",cat:"Infrastructure",desc:"Balance millions of producers, batteries, and flexible loads.",cost:{research:2,trust:1},fx:{emissions:-4,energy:-4,prosperity:2}},
{id:"nuclear",name:"Factory Nuclear",cat:"Energy",desc:"Standardized reactors cut build time and construction risk.",cost:{capital:3,political:1,industry:2},fx:{emissions:-8,energy:-3,prosperity:1}},
{id:"fusion",name:"Fusion Pilot Fleet",cat:"Moonshot",desc:"A costly shot at abundant high-density power.",cost:{capital:4,research:3,industry:1},fx:{emissions:-9,energy:-4,prosperity:2},risk:.28},
{id:"heatpump",name:"Universal Heat Pumps",cat:"Buildings",desc:"Electrify heating at global scale.",cost:{capital:1,political:1,industry:2},fx:{emissions:-5,energy:-2,prosperity:1}},
{id:"ev",name:"Battery Mobility",cat:"Transport",desc:"Electric cars, buses, and freight spread through falling costs.",cost:{capital:2,industry:2},fx:{emissions:-6,energy:-1,prosperity:2}},
{id:"steel",name:"Hydrogen Steel",cat:"Industry",desc:"Replace coal-based steelmaking with clean hydrogen routes.",cost:{capital:2,research:1,industry:2},fx:{emissions:-6,energy:1,prosperity:1}},
{id:"cement",name:"Carbon-Negative Cement",cat:"Industry",desc:"New binders lock away CO₂ while replacing clinker.",cost:{capital:1,research:2,industry:2},fx:{emissions:-5,ecology:1}},
{id:"dac",name:"Direct Air Capture",cat:"Carbon",desc:"Pull carbon directly from ambient air.",cost:{capital:3,research:2,industry:1},fx:{emissions:-7,energy:3}},
{id:"mineral",name:"Carbon Mineralization",cat:"Carbon",desc:"Lock captured CO₂ into stable rock.",cost:{capital:2,research:1,industry:1},fx:{emissions:-5,ecology:1}},
{id:"methane",name:"Methane Suppression",cat:"Agriculture",desc:"Sensors, feed additives, and leak control rapidly cut methane.",cost:{capital:1,research:1,political:1},fx:{emissions:-7,prosperity:1}},
{id:"ferment",name:"Precision Fermentation",cat:"Food",desc:"Make proteins with microbes and spare land and methane.",cost:{capital:2,research:2,trust:1},fx:{emissions:-5,ecology:5,prosperity:1}},
{id:"forest",name:"Forest Restoration",cat:"Nature",desc:"Large-scale restoration expands carbon sinks and habitat.",cost:{capital:1,political:2},fx:{emissions:-4,ecology:7,prosperity:1}},
{id:"agri",name:"Regenerative Agriculture",cat:"Food",desc:"Improve soil carbon, resilience, and fertilizer efficiency.",cost:{capital:1,political:1},fx:{emissions:-3,ecology:5,prosperity:1}},
{id:"robotics",name:"Autonomous Construction",cat:"Industry",desc:"Robotics compress the time needed to build infrastructure.",cost:{capital:2,research:2},fx:{prosperity:4,industry:2}},
{id:"materials",name:"Materials Discovery AI",cat:"Science",desc:"Accelerate batteries, catalysts, cement, and grid materials.",cost:{research:3,trust:1},fx:{prosperity:3,research:2}},
{id:"recycle",name:"Closed-Loop Materials",cat:"Industry",desc:"High-value recycling reduces mining pressure and bottlenecks.",cost:{capital:1,industry:2,political:1},fx:{ecology:4,prosperity:2,energy:-1}}
];
const EVENTS = [
{name:"Copper crunch",text:"Grid expansion collides with a global copper shortage.",fx:{industry:-2,energy:2}},
{name:"Megadrought",text:"A major food-producing region enters a multi-year drought.",fx:{trust:-1,prosperity:-3,ecology:-2}},
{name:"AI productivity boom",text:"Automation raises output and research throughput.",fx:{prosperity:4,research:2}},
{name:"Energy shock",text:"Fuel prices spike after a geopolitical disruption.",fx:{capital:-1,energy:5,trust:-1}},
{name:"Wildfire summer",text:"Smoke blankets major cities and public concern surges.",fx:{trust:1,ecology:-3,political:1}},
{name:"Mineral embargo",text:"Critical mineral exports are suddenly restricted.",fx:{industry:-2,capital:-1}},
{name:"Climate migration",text:"Large migration flows strain housing and political capacity.",fx:{political:-2,trust:-1}},
{name:"Fusion headline",text:"A lab announces a major fusion milestone.",fx:{research:2,trust:1}},
{name:"Methane super-emitter",text:"Satellites expose massive leaks and force action.",fx:{political:1,emissions:2}},
{name:"Crop breakthrough",text:"Heat-tolerant crops improve food resilience.",fx:{prosperity:2,ecology:1}},
{name:"Financial squeeze",text:"Higher borrowing costs make infrastructure harder to finance.",fx:{capital:-2}},
{name:"Civic climate pact",text:"Cities and industry coordinate around a common transition plan.",fx:{political:2,trust:2}}
];
const SYNERGIES = [
{need:["solar","storage","gridai","hvdc"],name:"PLANETARY GRID",fx:{emissions:-12,energy:-8,prosperity:4}},
{need:["dac","mineral","geothermal"],name:"CARBON MINING",fx:{emissions:-10,ecology:3}},
{need:["robotics","nuclear"],name:"REACTOR SHIPYARDS",fx:{emissions:-7,energy:-4,industry:2}},
{need:["ferment","agri","forest"],name:"LAND DIVIDEND",fx:{emissions:-6,ecology:10,prosperity:3}},
{need:["materials","storage"],name:"POST-LITHIUM STORAGE",fx:{energy:-5,prosperity:3}},
{need:["steel","cement","robotics"],name:"CLEAN INDUSTRIAL BASE",fx:{emissions:-8,prosperity:4,industry:2}},
{need:["methane","ferment"],name:"METHANE COLLAPSE",fx:{emissions:-8,ecology:3}},
{need:["heatpump","ev","gridai"],name:"ELECTRIC EVERYWHERE",fx:{emissions:-9,energy:-3,prosperity:3}}
];
const PRIME = new Set(["PLANETARY GRID", "CARBON MINING", "LAND DIVIDEND", "ELECTRIC EVERYWHERE"]);
const REVEAL_COPY = {
  "PLANETARY GRID": "Solar, storage, orchestration, and long-distance lines lock together. Clean power can now move the way weather does.",
  "CARBON MINING": "Capture, mineralized rock, and geothermal heat turn carbon from a waste stream into a managed flow.",
  "LAND DIVIDEND": "Fermentation, soil, and forests give land back to living systems. The surplus shows up as habitat, food, and a quieter atmosphere.",
  "ELECTRIC EVERYWHERE": "Heat, mobility, and the grid pull in the same direction. Combustion stops being the default machine.",
  "REACTOR SHIPYARDS": "Robotics and standardized nuclear plants start to reproduce. Firm power becomes a construction program.",
  "POST-LITHIUM STORAGE": "New materials and storage meet. Multi-day energy no longer depends on one strained mineral.",
  "CLEAN INDUSTRIAL BASE": "Steel, cement, and autonomous building form a base that can construct the transition without repeating the old fire.",
  "METHANE COLLAPSE": "Leak control and new proteins cut the fastest warming gas from both ends."
};
const REVEAL_WHO = {
  "PLANETARY GRID": "grid",
  "CARBON MINING": "materials",
  "LAND DIVIDEND": "ecologist",
  "ELECTRIC EVERYWHERE": "systems",
  "REACTOR SHIPYARDS": "industrial",
  "POST-LITHIUM STORAGE": "materials",
  "CLEAN INDUSTRIAL BASE": "industrial",
  "METHANE COLLAPSE": "ecologist"
};
const REVEAL_LINE = {
  "PLANETARY GRID": "This is the architecture. Distance just became a detail.",
  "CARBON MINING": "We can put the carbon down and keep it there.",
  "LAND DIVIDEND": "The land is paying us back. Do not spend it twice.",
  "ELECTRIC EVERYWHERE": "One machine, many uses. The century gets simpler.",
  "REACTOR SHIPYARDS": "If we can build one on schedule, we can build ten.",
  "POST-LITHIUM STORAGE": "The battery problem just changed materials.",
  "CLEAN INDUSTRIAL BASE": "Now the transition can build itself.",
  "METHANE COLLAPSE": "The fastest warming lever just got shorter."
};
const TRADE = {
  geothermal: "Firm clean power. It spends capital and industrial focus up front.",
  solar: "Fast, cheap electrons. Quiet nights still need storage beside it.",
  storage: "Makes variable power usable. A research-heavy bet that compounds.",
  hvdc: "Distance stops taxing clean power. Politics and industry have to agree.",
  gridai: "Coordination is the resource. Trust is part of the cost.",
  nuclear: "Dense firm power, slow to love and expensive to start.",
  fusion: "A real moonshot. Sometimes it only spends the decade.",
  heatpump: "Buildings leave combustion. The grid has to be ready to carry them.",
  ev: "Roads electrify as costs fall. Industry has to build the machines.",
  steel: "Heavy industry changes its fire. Energy demand can rise before it falls.",
  cement: "A stubborn emission becomes a material. The gain is slow and structural.",
  dac: "Carbon leaves the air if energy and capital keep showing up.",
  mineral: "Storage in stone. Smaller, surer, and dependent on capture upstream.",
  methane: "A fast climate lever hidden in farms, fuel, and leaks.",
  ferment: "Protein without the pasture. It asks people to trust the food.",
  forest: "Time, land, and politics returned as habitat and shade.",
  agri: "Soil does quiet work. The yield is resilience more than spectacle.",
  robotics: "Everything else gets built faster. It does not choose what to build.",
  materials: "The lab shortens the wait for better batteries, binders, and catalysts.",
  recycle: "Less mining, fewer bottlenecks, a cleaner industrial loop."
};
const PEOPLE = {
  materials: { name: "Materials Scientist", bg: "#e7d3b4", cloth: "#8d5a42", skin: "#e0b08a", hair: "#3a2a24", hairPath: "M22 44c2-20 12-28 18-28s16 8 18 26c-4-8-10-12-18-12s-14 4-18 14z" },
  systems: { name: "Systems Scientist", bg: "#d5e4df", cloth: "#3e6d72", skin: "#efc7a4", hair: "#2c2420", hairPath: "M24 48c0-22 8-32 16-32s16 10 16 32c-6-8-10-10-16-10s-10 2-16 10z", glasses: true },
  grid: { name: "Grid Architect", bg: "#efe2c4", cloth: "#c4893a", skin: "#d9a47c", hair: "#4a3428", hairPath: "M26 40c0-16 6-24 14-24s14 8 14 24c-2-4-8-8-14-8s-12 4-14 8z" },
  political: { name: "Political Organizer", bg: "#e4ead8", cloth: "#3f6248", skin: "#c98b62", hair: "#241c18", hairPath: "M20 50c2-24 10-34 20-34s18 10 20 32c-8-12-14-14-20-14s-14 4-20 16z" },
  industrial: { name: "Industrialist", bg: "#efe6d4", cloth: "#6e6256", skin: "#e6c2a0", hair: "#6a5a4a", hairPath: "M24 42c1-14 8-22 16-22s15 8 16 22c-4-6-10-8-16-8s-12 2-16 8z" },
  ecologist: { name: "Ecologist", bg: "#d7e6d4", cloth: "#5d7a48", skin: "#e8c4a4", hair: "#5a3828", hairPath: "M18 52c4-26 12-36 22-36s18 10 22 34c-8-14-16-16-22-16s-16 4-22 18z" },
  wildcard: { name: "Wild Card Inventor", bg: "#f3e2b8", cloth: "#d2a04a", skin: "#efc8a6", hair: "#2a2420", hairPath: "M22 46c-2-18 8-30 18-30 8 0 14 6 18 18 2 8-2 10-6 6-6-8-10-12-14-10-6 2-8 10-10 14-4 2-8-2-6 2z" }
};
const ADVICE = {
  materials: ["Every durable system starts as a material that can be made twice.", "If it cannot be manufactured, it is still a rumor.", "Watch the feedstock. The climate is won in supply chains."],
  systems: ["The pieces only count once they share a schedule.", "A breakthrough that cannot connect is a prototype.", "Look for the loop, not the hero project."],
  grid: ["Power is a landscape problem now.", "Firm, flexible, or far away. Pick which constraint you are buying down.", "Build the wires before you promise the watts."],
  political: ["None of this deploys in a vacuum.", "Capacity is political before it is technical.", "A pact you can keep beats a target you announce."],
  industrial: ["Show me the factory, not the rendering.", "The transition is a construction program with a climate attached.", "Bottlenecks are where the century actually turns."],
  ecologist: ["The living world is infrastructure. Treat it that way.", "Carbon in a forest is only safe if the forest is.", "Recovery has a texture. You should be able to see it."],
  wildcard: ["The lab is for ideas the roadmap is too polite to hold.", "Useful surprises still have a bill.", "Invent the thing the next decade will pretend was obvious."]
};
const CAT_SCI = { Energy: "grid", Infrastructure: "grid", Moonshot: "wildcard", Buildings: "systems", Transport: "systems", Industry: "industrial", Carbon: "materials", Agriculture: "ecologist", Food: "ecologist", Nature: "ecologist", Science: "materials" };
const EVENT_SCI = {
  "Copper crunch": ["industrial", "Grid dreams are now a mining question. Sequence the build."],
  "Megadrought": ["ecologist", "The food map just shrank. Land choices get sharper."],
  "AI productivity boom": ["systems", "Throughput jumped. Spend it on the physical world."],
  "Energy shock": ["grid", "Price just did what policy would not. Firm power matters."],
  "Wildfire summer": ["ecologist", "The sky is making the argument. Restoration is not optional."],
  "Mineral embargo": ["industrial", "A border closed. Design for the materials you can actually get."],
  "Climate migration": ["political", "Housing and trust are now climate hardware."],
  "Fusion headline": ["wildcard", "A headline is not a fleet. It does open the room."],
  "Methane super-emitter": ["ecologist", "The fast gas is visible. Cut it while the picture is fresh."],
  "Crop breakthrough": ["ecologist", "Heat-tolerant food buys time. It does not refill a river."],
  "Financial squeeze": ["political", "Money got tighter. Pick the project that still pencils."],
  "Civic climate pact": ["political", "Cities moved together. Use the window before it closes."]
};
const END_COPY = {
  "The Age of Abundance": "The century closed in surplus. Clean power became ordinary, the land recovered its color, and the 2100 path stayed inside a livable band. People inherited a future larger than the emergency they were born into.",
  "The Regeneration Century": "The heat did not vanish, but the living world came back first. Forests, soils, and water gained ground faster than the old models allowed, and the century is remembered for what grew.",
  "The Managed Transition": "No miracle arrived. A long sequence of infrastructure, policy, and restraint bent the curve enough to keep the worst futures at bay. The transition was administered, imperfect, and real.",
  "The Hot Growth Era": "Prosperity ran ahead of the climate. Cities glittered, output climbed, and the sky kept the bill. The era was rich, busy, and hotter than the people who built it had hoped.",
  "The Long Emergency": "The century stayed in a defensive crouch. Gains were local, losses were cumulative, and the work of staying safe never became the work of arriving somewhere better.",
  "The Fractured Century": "Capacity and trust came apart. Technical options existed, but the politics to use them did not hold. The century split into places that coped and places that absorbed the heat alone."
};
const END_SLUG = {
  "The Age of Abundance": "abundance",
  "The Regeneration Century": "regeneration",
  "The Managed Transition": "managed",
  "The Hot Growth Era": "hot",
  "The Long Emergency": "emergency",
  "The Fractured Century": "fractured"
};

let state, rng, log = [];
let offers = [];
let finished = false;
let revealQueue = [];
const $ = (id) => document.getElementById(id);
const fast = new URLSearchParams(location.search).get("fast") === "1";
if (fast) document.documentElement.classList.add("fast");

function seedRng(seed) { let t = seed >>> 0; return () => { t += 0x6D2B79F5; let r = Math.imul(t ^ t >>> 15, 1 | t); r ^= r + Math.imul(r ^ r >>> 7, 61 | r); return ((r ^ r >>> 14) >>> 0) / 4294967296; }; }
function urlParam(name) { return new URLSearchParams(location.search).get(name); }
function integerSeed(raw) {
  if (typeof raw === "number" && Number.isSafeInteger(raw)) return raw;
  if (typeof raw !== "string" || !/^-?\d+$/.test(raw)) return null;
  const n = Number(raw);
  return Number.isSafeInteger(n) ? n : null;
}
function clockSeed() { return (Date.now() % 2147483647) | 0; }
function syncSeedNote(bad) {
  const note = $("seedNote");
  if (!note) return;
  if (bad == null) { const raw = urlParam("seed"); bad = raw != null && integerSeed(raw) == null; }
  note.textContent = bad ? "Bad seed, using random" : "";
  note.classList.toggle("hidden", !bad);
}
function newState(explicit) {
  const fromCall = integerSeed(explicit);
  const rawParam = urlParam("seed");
  const fromUrl = rawParam == null ? null : integerSeed(rawParam);
  const seed = fromCall != null ? fromCall : (fromUrl != null ? fromUrl : clockSeed());
  const bad = fromCall == null && rawParam != null && fromUrl == null;
  rng = seedRng(seed);
  log = [];
  offers = [];
  finished = false;
  revealQueue = [];
  state = { seed, turn: 0, capital: 8, research: 7, political: 6, trust: 6, industry: 6, emissions: 100, energy: 100, prosperity: 55, ecology: 55, warming: 2.8, owned: [], synergies: [], event: null };
  syncSeedNote(bad);
}
function clamp(n, min = 0, max = 100) { return Math.max(min, Math.min(max, n)); }
function applyFx(fx = {}) { for (const [k, v] of Object.entries(fx)) { if (["capital", "research", "political", "trust", "industry"].includes(k)) state[k] = Math.max(0, state[k] + v); else state[k] = clamp(state[k] + v); } state.warming = +(1.35 + (state.emissions / 100) * 1.55).toFixed(2); }
function pay(cost = {}) { for (const [k, v] of Object.entries(cost)) if (state[k] < v) return false; for (const [k, v] of Object.entries(cost)) state[k] -= v; return true; }
function affordable(t) { return Object.entries(t.cost || {}).every(([k, v]) => state[k] >= v); }
function pickTechs() { const pool = TECHS.filter((t) => !state.owned.includes(t.id)).sort(() => rng() - 0.5); const a = pool.filter(affordable).slice(0, 3); for (const t of pool) { if (a.length >= 3) break; if (!a.includes(t)) a.push(t); } return a.slice(0, 3); }
function copyState() { return JSON.parse(JSON.stringify({ seed: state.seed, turn: state.turn, year: YEARS[state.turn] || 2100, capital: state.capital, research: state.research, political: state.political, trust: state.trust, industry: state.industry, emissions: state.emissions, energy: state.energy, prosperity: state.prosperity, ecology: state.ecology, warming: state.warming, owned: state.owned, synergies: state.synergies, event: state.event })); }

function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
function worldLook() {
  const emis = clamp(state.emissions / 110, 0, 1.2);
  const warm = clamp((state.warming - 1.35) / 1.55, 0, 1.2);
  const dry = clamp(1 - state.ecology / 100, 0, 1);
  const stress = clamp(emis * 0.4 + warm * 0.38 + dry * 0.22, 0, 1);
  let id = "thriving";
  let name = "Thriving";
  if (stress >= 0.74) { id = "damaged"; name = "Damaged"; }
  else if (stress >= 0.52) { id = "strained"; name = "Strained"; }
  else if (stress >= 0.3) { id = "transitioning"; name = "Transitioning"; }
  const has = (k) => state.owned.includes(k);
  const syn = (n) => state.synergies.includes(n);
  const clean = ["geothermal", "solar", "storage", "hvdc", "gridai", "nuclear", "fusion", "heatpump", "ev"].filter(has).length;
  const land = ["forest", "agri", "ferment", "methane"].filter(has).length;
  return {
    stress, eco: clamp(state.ecology / 100, 0, 1), prosper: clamp(state.prosperity / 100, 0, 1),
    label: name, id,
    wind: Math.min(6, Math.round(clean * 0.8) + (syn("PLANETARY GRID") ? 2 : 0)),
    solar: clamp((has("solar") ? 0.55 : 0) + clean * 0.08 + (syn("PLANETARY GRID") ? 0.3 : 0), 0, 1),
    lines: clamp((has("hvdc") ? 0.7 : 0) + (has("gridai") ? 0.3 : 0) + (syn("PLANETARY GRID") ? 0.4 : 0), 0, 1),
    geo: clamp((has("geothermal") ? 0.75 : 0) + (syn("CARBON MINING") ? 0.35 : 0), 0, 1),
    transit: clamp((has("ev") ? 0.45 : 0) + (has("heatpump") ? 0.25 : 0) + (syn("ELECTRIC EVERYWHERE") ? 0.45 : 0), 0, 1),
    fields: clamp(0.2 + land * 0.18 + (syn("LAND DIVIDEND") ? 0.35 : 0) + (state.ecology - 40) / 180, 0, 1),
    lights: clamp(0.25 + clean * 0.08 + (1 - stress) * 0.15 + stress * 0.25, 0, 1),
    nuclear: has("nuclear") || has("fusion") || syn("REACTOR SHIPYARDS") ? 1 : 0
  };
}
function portrait(id, suffix) {
  const p = PEOPLE[id] || PEOPLE.systems;
  const clip = "p-" + id + "-" + suffix;
  const glasses = p.glasses ? `<circle cx="33" cy="46" r="5" fill="none" stroke="#243028" stroke-width="1.3"/><circle cx="47" cy="46" r="5" fill="none" stroke="#243028" stroke-width="1.3"/><path d="M38 46h4" stroke="#243028" stroke-width="1.2"/>` : "";
  return `<svg class="portraitSvg" viewBox="0 0 80 80" role="img" aria-label="${esc(p.name)}"><defs><clipPath id="${clip}"><circle cx="40" cy="40" r="38"/></clipPath></defs><g clip-path="url(#${clip})"><rect width="80" height="80" fill="${p.bg}"/><ellipse cx="40" cy="86" rx="34" ry="28" fill="${p.cloth}"/><ellipse cx="40" cy="46" rx="16" ry="18" fill="${p.skin}"/><path d="${p.hairPath}" fill="${p.hair}"/>${glasses}<path d="M33 48 q2 1 4 0" stroke="#3c2a22" fill="none" stroke-width="1.2" stroke-linecap="round"/><path d="M44 48 q2 1 4 0" stroke="#3c2a22" fill="none" stroke-width="1.2" stroke-linecap="round"/><path d="M36 56 q4 3 8 0" stroke="#8a4e3c" fill="none" stroke-width="1.15" stroke-linecap="round"/></g><circle cx="40" cy="40" r="37.2" fill="none" stroke="rgba(48,40,28,.28)" stroke-width="1.5"/></svg>`;
}
function headerArt(cat) {
  const skies = { Energy: "#d7ebdf", Infrastructure: "#d5e3dc", Moonshot: "#efe3c4", Buildings: "#e7efe4", Transport: "#dceadf", Industry: "#efe4d2", Carbon: "#e6e2d4", Agriculture: "#e5edd4", Food: "#e7f0dc", Nature: "#d4eadc", Science: "#efe6d4" };
  const sky = skies[cat] || "#e7eee4";
  const ground = `<path d="M0 64 C48 40 78 74 120 50 C168 28 196 72 250 46 C286 30 304 58 320 44 L320 90 L0 90 Z" fill="#7d9a72"/><path d="M0 76 C60 64 100 88 160 72 C220 58 260 84 320 70 L320 90 L0 90 Z" fill="#3f6a48"/>`;
  const motif = {
    Energy: `<g fill="#e7b454"><rect x="28" y="58" width="34" height="7" transform="skewX(-16)"/><rect x="48" y="66" width="34" height="7" transform="skewX(-16)"/></g><rect x="70" y="62" width="22" height="7" transform="skewX(-16)" fill="#4f8888"/>`,
    Infrastructure: `<path d="M40 78 L52 48 L64 78 M46 66 H58 M120 78 L132 44 L144 78 M126 62 H138" stroke="#f4efe4" stroke-width="2" fill="none"/><path d="M64 50 Q96 62 120 46" stroke="#f4efe4" stroke-width="1.4" fill="none"/>`,
    Moonshot: `<circle cx="70" cy="48" r="18" fill="none" stroke="#e7b454" stroke-width="3"/><circle cx="70" cy="48" r="4" fill="#f4efe4"/>`,
    Buildings: `<rect x="36" y="48" width="22" height="28" fill="#f3ead8"/><rect x="62" y="40" width="18" height="36" fill="#e6d7bc"/><rect x="84" y="54" width="16" height="22" fill="#f7f1e4"/>`,
    Transport: `<path d="M24 74 H140" stroke="#6a543c" stroke-width="3"/><rect x="70" y="58" width="42" height="16" rx="4" fill="#f3ead8"/><rect x="76" y="62" width="8" height="6" fill="#f0c56a"/>`,
    Industry: `<rect x="40" y="50" width="28" height="26" fill="#efe2cc"/><rect x="48" y="38" width="8" height="14" fill="#c4b49a"/><circle cx="92" cy="62" r="12" fill="#d7c4a4"/>`,
    Carbon: `<ellipse cx="78" cy="66" rx="28" ry="10" fill="#8d9a8a"/><circle cx="70" cy="58" r="8" fill="#d9d4c4"/><circle cx="86" cy="60" r="6" fill="#c4b8a4"/>`,
    Agriculture: `<ellipse cx="48" cy="70" rx="22" ry="8" fill="#c6b15a"/><ellipse cx="90" cy="74" rx="26" ry="8" fill="#6f9a55"/><ellipse cx="70" cy="66" rx="16" ry="6" fill="#d7c56a"/>`,
    Food: `<ellipse cx="60" cy="70" rx="26" ry="8" fill="#7ea15a"/><rect x="78" y="46" width="14" height="22" rx="6" fill="#f3ead8"/><rect x="98" y="50" width="12" height="18" rx="6" fill="#e7d7b8"/>`,
    Nature: `<ellipse cx="46" cy="62" rx="14" ry="18" fill="#2f6a43"/><ellipse cx="68" cy="66" rx="16" ry="16" fill="#4e8154"/><ellipse cx="88" cy="60" rx="12" ry="16" fill="#6d9a5c"/><path d="M20 78 H120" stroke="#5f9c96" stroke-width="4"/>`,
    Science: `<rect x="46" y="44" width="18" height="28" fill="#f4efe4"/><rect x="70" y="52" width="14" height="20" fill="#e7d3b0"/><circle cx="102" cy="58" r="10" fill="#d2a04a"/>`
  };
  return `<svg class="cardArtSvg" viewBox="0 0 320 90" aria-hidden="true" preserveAspectRatio="xMidYMid slice"><rect width="320" height="90" fill="${sky}"/><circle cx="246" cy="26" r="14" fill="#f0c56a"/>${ground}${motif[cat] || motif.Energy}</svg>`;
}
function pillClass(k, v) {
  const lowerBetter = k === "emissions" || k === "energy";
  const good = lowerBetter ? v < 0 : v > 0;
  return good ? "good" : "bad";
}
function effectsHtml(fx) {
  return Object.entries(fx).map(([k, v]) => `<span class="pill ${pillClass(k, v)}">${esc(k)} ${v > 0 ? "+" : "−"}${Math.abs(v)}</span>`).join("");
}
function costHtml(cost) {
  return Object.entries(cost).map(([k, v]) => `<span class="chip">${esc(k)} ${v}</span>`).join("");
}
function paintWorld(look) {
  const world = $("world");
  if (!world) return;
  world.dataset.state = look.id;
  const label = $("worldState");
  if (label) label.textContent = look.label;
  if (window.BreakthroughScene) BreakthroughScene.setWorld(look);
}
function renderHud() {
  $("year").textContent = YEARS[state.turn] || 2100;
  $("turnLabel").textContent = "Turn " + (state.turn + 1) + " of 12";
  ["capital", "research", "political", "trust", "industry", "emissions", "energy", "prosperity", "ecology"].forEach((k) => { $(k).textContent = Math.round(state[k]); });
  $("warming").textContent = "+" + state.warming.toFixed(2) + "°C";
  const seedEl = $("runSeed");
  if (seedEl) seedEl.textContent = "Seed " + state.seed;
  paintWorld(worldLook());
}
function renderAdvisor() {
  const box = $("advisor");
  if (!box) return;
  let id = "systems";
  let line = ADVICE.systems[state.turn % ADVICE.systems.length];
  if (state.event && EVENT_SCI[state.event.name]) {
    id = EVENT_SCI[state.event.name][0];
    line = EVENT_SCI[state.event.name][1];
  } else if (offers[0]) {
    id = CAT_SCI[offers[0].cat] || "systems";
    const lines = ADVICE[id];
    line = lines[state.turn % lines.length];
  }
  $("advisorPortrait").innerHTML = portrait(id, "turn");
  $("advisorName").textContent = PEOPLE[id].name;
  $("advisorLine").textContent = line;
}
function renderCards() {
  const cards = $("cards");
  cards.innerHTML = "";
  offers = pickTechs();
  offers.forEach((t) => {
    const el = document.createElement("article");
    el.className = "card" + (affordable(t) ? "" : " is-short");
    el.dataset.id = t.id;
    el.dataset.cat = t.cat;
    const can = affordable(t);
    el.innerHTML = `<div class="cardArt">${headerArt(t.cat)}</div><div class="cardBody"><span class="tag">${esc(t.cat)}</span><h3>${esc(t.name)}</h3><p>${esc(t.desc)}</p><p class="tradeoff">${esc(TRADE[t.id] || "")}</p><div class="effects">${effectsHtml(t.fx)}</div><div class="cost">${costHtml(t.cost)}${can ? "" : `<span class="shortNote">Short the cost. You cannot take this yet.</span>`}</div></div>`;
    if (!can) el.title = "You cannot afford this yet";
    el.onclick = () => chooseOffered(t.id);
    cards.appendChild(el);
  });
  const banner = $("eventBanner");
  if (state.event) {
    banner.classList.remove("hidden");
    banner.innerHTML = "<b>" + esc(state.event.name) + "</b>" + esc(state.event.text);
  } else banner.classList.add("hidden");
}
function render(opts) {
  renderHud();
  if (!opts || !opts.keepOffers) {
    renderCards();
    renderAdvisor();
  }
}
function hideReveal() {
  revealQueue = [];
  const root = $("reveal");
  if (!root) return;
  root.classList.add("hidden");
  root.setAttribute("aria-hidden", "true");
}
function paintReveal(s) {
  const root = $("reveal");
  const prime = PRIME.has(s.name);
  root.classList.remove("hidden");
  root.classList.toggle("is-prime", prime);
  root.setAttribute("aria-hidden", "false");
  $("revealKicker").textContent = prime ? "Meta-breakthrough" : "System breakthrough";
  $("revealTitle").textContent = s.name;
  $("revealCopy").textContent = REVEAL_COPY[s.name] || "Your technologies combined into something larger than any single project.";
  const who = REVEAL_WHO[s.name] || "systems";
  $("revealPortrait").innerHTML = portrait(who, "reveal");
  $("revealWho").textContent = PEOPLE[who].name;
  $("revealLine").textContent = REVEAL_LINE[s.name] || ADVICE[who][0];
  $("world").classList.add("is-bloom");
  setTimeout(() => { const w = $("world"); if (w) w.classList.remove("is-bloom"); }, 1400);
  if (window.BreakthroughScene) BreakthroughScene.pulse();
  const btn = $("revealDismiss");
  if (btn && !fast) btn.focus();
}
function showReveal(s) {
  revealQueue.push(s);
  if (revealQueue.length === 1) paintReveal(s);
}
function dismissReveal() {
  revealQueue.shift();
  if (revealQueue.length) paintReveal(revealQueue[0]);
  else hideReveal();
}
function chooseOffered(id) { const t = offers.find((x) => x.id === id); if (t) chooseTech(t); }
function chooseTech(t) {
  if (!affordable(t) || !pay(t.cost)) return;
  const failed = t.risk && rng() < t.risk;
  if (failed) {
    applyFx({ trust: -1, research: -1 });
    log.push({ year: YEARS[state.turn], title: t.name + " failed", text: "The moonshot consumed resources without reaching deployment." });
  } else {
    state.owned.push(t.id);
    applyFx(t.fx);
    log.push({ year: YEARS[state.turn], title: t.name, text: t.desc });
    checkSynergy();
  }
  advance();
}
function checkSynergy() {
  for (const s of SYNERGIES) {
    if (!state.synergies.includes(s.name) && s.need.every((id) => state.owned.includes(id))) {
      state.synergies.push(s.name);
      applyFx(s.fx);
      log.push({ year: YEARS[state.turn], title: s.name, text: REVEAL_COPY[s.name] || "A technology combination became a civilization-scale system." });
      showReveal(s);
    }
  }
}
function advance() {
  if (state.event) applyFx(state.event.fx);
  state.turn++;
  if (state.turn >= 12) { finish(); return; }
  applyFx({ prosperity: 1, emissions: 2, ecology: -1 });
  state.capital += 2;
  state.research += 2;
  state.political += 1;
  state.industry += 1;
  state.event = rng() < 0.72 ? EVENTS[Math.floor(rng() * EVENTS.length)] : null;
  if (state.event) log.push({ year: YEARS[state.turn], title: state.event.name, text: state.event.text });
  render();
}
function ideaLab() {
  const bases = [["Living Flow Battery", "Engineered microbes maintain organic electrolytes for long-duration storage.", { research: 2, capital: 1 }, { emissions: -4, energy: -5, prosperity: 1 }], ["Atmospheric Methane Enzymes", "Bio-designed catalysts accelerate methane breakdown around industrial sources.", { research: 2, trust: 1 }, { emissions: -7, ecology: 2 }], ["Self-Healing Grid Materials", "Advanced conductors repair microfractures and reduce transmission failures.", { research: 2, industry: 1 }, { energy: -4, prosperity: 3 }], ["Autonomous Reforestation Swarms", "Robotic nurseries restore degraded ecosystems at continental scale.", { capital: 2, research: 1 }, { ecology: 8, emissions: -4 }], ["Solar Cement Kilns", "High-temperature solar heat replaces fossil combustion in cement production.", { capital: 2, industry: 1 }, { emissions: -5, energy: -1 }]];
  const picks = bases.sort(() => rng() - 0.5).slice(0, 3);
  $("modalBody").innerHTML = `<div class="advisor modalAdvisor">${portrait("wildcard", "lab")}<div><b>Wild Card Inventor</b><p>The lab is open. These are not on any roadmap.</p></div></div><p class="eyebrow">IDEA LAB</p><h2>What should humanity invent?</h2><p>These moonshots are shaped by the current run.</p>` + picks.map((x, i) => `<button class="ideaChoice" data-i="${i}"><b>${esc(x[0])}</b><span>${esc(x[1])}</span><small>${esc(Object.entries(x[2]).map(([k, v]) => v + " " + k).join(" · "))}</small></button>`).join("");
  [...document.querySelectorAll(".ideaChoice")].forEach((b, i) => b.onclick = () => {
    const x = picks[i];
    if (pay(x[2])) {
      applyFx(x[3]);
      state.synergies.push(x[0]);
      log.push({ year: YEARS[state.turn], title: x[0], text: x[1] });
      $("modal").close();
      advance();
    }
  });
  openModal();
}
function showTimeline() {
  $("modalBody").innerHTML = `<p class="eyebrow">TIMELINE</p><h2>Your alternate history</h2><div class="timelineList">` + (log.length ? log.map((x) => `<div class="timelineItem"><b>${esc(x.year)} · ${esc(x.title)}</b><div>${esc(x.text)}</div></div>`).join("") : "<p>No major events yet.</p>") + `</div>`;
  openModal();
}
function ending() {
  if (state.warming <= 1.65 && state.prosperity >= 60 && state.ecology >= 60) return "The Age of Abundance";
  if (state.warming <= 1.9 && state.ecology >= 65) return "The Regeneration Century";
  if (state.warming <= 2.0) return "The Managed Transition";
  if (state.prosperity >= 70) return "The Hot Growth Era";
  if (state.trust < 3 || state.political < 2) return "The Fractured Century";
  return "The Long Emergency";
}
function finish() {
  finished = true;
  if ($("modal").open) $("modal").close();
  if (fast) hideReveal();
  $("gameScreen").classList.add("hidden");
  const screen = $("endScreen");
  screen.classList.remove("hidden");
  const name = ending();
  const slug = END_SLUG[name] || "emergency";
  screen.dataset.ending = slug;
  $("endingTitle").textContent = name;
  $("endingCopy").textContent = END_COPY[name] || "";
  const look = worldLook();
  const endWorld = $("endWorld");
  if (endWorld) endWorld.textContent = look.label + " world";
  const warm = $("endWarm");
  if (warm) warm.textContent = "+" + state.warming.toFixed(2) + "°C";
  $("endStats").innerHTML = [["2100 warming", "+" + state.warming.toFixed(2) + "°C"], ["Emissions", Math.round(state.emissions)], ["Energy cost", Math.round(state.energy)], ["Prosperity", Math.round(state.prosperity)], ["Ecology", Math.round(state.ecology)], ["Trust", Math.round(state.trust)], ["Technologies", state.owned.length], ["Seed", state.seed]].map((x) => `<div><span>${esc(x[0])}</span><b>${esc(x[1])}</b></div>`).join("");
  const major = state.synergies.filter(Boolean);
  const names = state.owned.map((id) => TECHS.find((t) => t.id === id)?.name).filter(Boolean);
  const majorBox = $("majorList");
  if (majorBox) majorBox.innerHTML = major.length ? major.map((n) => `<span class="major">${esc(n)}</span>`).join("") : "<span>No civilization-scale breakthrough</span>";
  $("breakthroughList").innerHTML = names.length ? names.map((n) => `<span>${esc(n)}</span>`).join("") : "<span>No deployed technology</span>";
  const rail = $("yearRail");
  if (rail) {
    const hit = new Set(log.map((e) => e.year));
    rail.innerHTML = YEARS.map((y) => `<span class="${hit.has(y) ? "hit" : ""}">${y}</span>`).join("");
  }
  const history = $("endTimeline");
  if (history) history.innerHTML = log.map((x) => `<li><span class="hy">${esc(x.year)}</span><b>${esc(x.title)}</b><p>${esc(x.text)}</p></li>`).join("");
  if (window.BreakthroughScene) {
    BreakthroughScene.resize();
    BreakthroughScene.showEnd(look, name);
  }
}
function openModal() {
  const m = $("modal");
  if (fast) { m.style.transition = "none"; m.style.animation = "none"; }
  if (!m.open) m.showModal();
}
function start(seed) {
  hideReveal();
  newState(seed);
  $("titleScreen").classList.add("hidden");
  $("endScreen").classList.add("hidden");
  $("gameScreen").classList.remove("hidden");
  state.event = EVENTS[Math.floor(rng() * EVENTS.length)];
  if (window.BreakthroughScene) BreakthroughScene.resize();
  render();
}
function preview(patch) {
  if (!state || !patch) return null;
  const keys = ["emissions", "energy", "prosperity", "ecology", "capital", "research", "political", "trust", "industry"];
  for (const k of keys) if (patch[k] != null) state[k] = patch[k];
  if (patch.owned) state.owned = patch.owned.slice();
  if (patch.synergies) state.synergies = patch.synergies.slice();
  state.warming = +(1.35 + (state.emissions / 100) * 1.55).toFixed(2);
  render({ keepOffers: true });
  return copyState();
}
window.__test = Object.freeze({
  state() { return state ? copyState() : null; },
  log() { return log.map((entry) => ({ year: entry.year, title: entry.title, text: entry.text })); },
  offers() { return offers.map((t) => t.id); },
  choose(id) { chooseOffered(id); },
  start(seed) { start(seed); },
  ending() { return finished ? ending() : null; },
  look() { return state ? worldLook() : null; },
  preview(patch) { return preview(patch); },
  showEnding(patch) {
    if (!state) return null;
    if (patch) {
      preview(patch);
      if (patch.log) log = patch.log.map((e) => ({ year: e.year, title: e.title, text: e.text }));
    }
    state.turn = 12;
    finish();
    return ending();
  },
  reveal(name) {
    const s = SYNERGIES.find((x) => x.name === name);
    if (!s) return false;
    showReveal(s);
    return true;
  }
});
syncSeedNote();
$("startBtn").onclick = () => start();
$("againBtn").onclick = () => start();
$("ideaBtn").onclick = ideaLab;
$("timelineBtn").onclick = showTimeline;
$("modalClose").onclick = () => $("modal").close();
const reveal = $("reveal");
if (reveal) reveal.addEventListener("click", (e) => {
  if (e.target.closest(".revealStage") && e.target.id !== "revealDismiss") return;
  dismissReveal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && reveal && !reveal.classList.contains("hidden")) {
    dismissReveal();
  }
});
let sound = true;
$("soundBtn").onclick = () => { sound = !sound; $("soundBtn").textContent = sound ? "♪" : "×"; };
if (window.BreakthroughScene) BreakthroughScene.mount();
})();
