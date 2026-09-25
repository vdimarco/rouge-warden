// Get Plunger'd: Breath of the Lake. An open-world adventure around the cottage.
import * as THREE from "three";
import { World, TOWERS, BOSSES, ISLAND, SIZE } from "./world.js";
import * as M from "./models.js";
import * as GLB from "./glb.js";
import { Fishing } from "./fishing.js";
import { Player, WEAPONS, PERKS } from "./player.js";
import { Foe, Boss, Hazards, FX, spawnPlan } from "./foes.js";
import { UI } from "./ui.js";
import * as A from "./audio.js";
import { rng, clamp, lerp, smooth } from "./noise.js";
import { Painter, QUALITY } from "./post.js";

THREE.ColorManagement.enabled = false;
const $ = (s) => document.querySelector(s);
const SAVE_KEY = "plungerd.wild.v1";
const DAY = 600;
const low = matchMedia("(pointer: coarse)").matches || Math.min(innerWidth, innerHeight) < 600 || (navigator.hardwareConcurrency || 8) <= 4;
const touchUI = matchMedia("(pointer: coarse)").matches;

/* ---------------- renderer and scene ---------------- */
// Graphics quality: saved from the pause menu, or a guess from the device.
const GFX_KEY = "plungerd.wild.gfx";
let gfx = (() => { try { const v = localStorage.getItem(GFX_KEY); if (QUALITY[v]) return v; } catch (e) { /* storage off */ } return low ? "low" : "high"; })();
let Q = QUALITY[gfx];
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
// dynamic resolution: the render scale drops when frames are slow and climbs back when there is room
let resScale = 1;
const applyRatio = () => renderer.setPixelRatio(Math.max(0.5, Math.min(devicePixelRatio, Q.ratio) * resScale));
applyRatio();
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
$("#game").appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.3, 5000);
scene.fog = new THREE.Fog(0xcfeaff, 140, 1150);
const hemi = new THREE.HemisphereLight(0xdff0ff, 0x6a7a4a, 1.1);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2d8, 1.6);
sun.castShadow = true;
sun.shadow.mapSize.set(Q.shadow, Q.shadow);
Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 1, far: 600 });
sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.04;
scene.add(sun, sun.target);
const painter = new Painter(renderer, Q);
const draw = () => painter.render(scene, camera, G.look);
// If the graphics card resets, save and reload rather than show a frozen or black screen.
renderer.domElement.addEventListener("webglcontextlost", (e) => { e.preventDefault(); G.contextLost = true; try { G.writeSave && G.writeSave(); } catch (err) { /* keep going */ } const l = $("#loading"); if (l) { l.hidden = false; l.textContent = "Repainting…"; } });
renderer.domElement.addEventListener("webglcontextrestored", () => location.reload());
addEventListener("resize", () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });

/* ---------------- the game state ---------------- */
const G = {
  scene, camera, renderer, time: 0, foeTime: 1, slowmo: 0, hitstop: 0, shakeT: 0, paused: false, cutscene: false, started: false,
  cam: { yaw: 0, pitch: 0.28, dist: 8, target: new THREE.Vector3(), pos: new THREE.Vector3(), idle: 0 },
  foes: [], bosses: [], npcs: [], items: [], loonies: [], abilities: {}, inv: { weapons: [{ id: "plunger", dur: Infinity }], cur: 0, food: { apple: 0, shroom: 0, berry: 0, syrup: 0, fish: 0, stew: 0 } },
  sfx: A.sfx, pad: false, clock: 0.3, night: false,
};
window.G = G;
G.painter = painter;
// hooks for the QA scripts in qa/wild
G.test = { get step() { return step; }, get camera() { return updateCamera; }, get inBox() { return inBox; } };
G.shake = (t) => { G.shakeT = Math.max(G.shakeT, t); };
G.groundAt = (x, z, y) => {
  let h = G.world.height(x, z);
  for (const b of G.world.boxes) {
    if (b.top <= h || b.top > y + 0.8) continue;
    const c = Math.cos(b.rot), s = Math.sin(b.rot);
    const lx = (x - b.x) * c - (z - b.z) * s, lz = (x - b.x) * s + (z - b.z) * c;
    if (Math.abs(lx) <= b.hw && Math.abs(lz) <= b.hd) h = b.top;
  }
  return h;
};

function blankSave(friend = 0) {
  return { v: 1, friend, maxHp: friend === 1 ? 16 : 12, staminaMax: friend === 3 ? 125 : 100, orbs: 0, prayers: 0, towers: [], shrines: [], seen: [], loonies: [], bosses: [], coolers: {}, weapons: [{ id: "plunger", dur: null }], cur: 0, food: { apple: 2, shroom: 0, berry: 0, syrup: 0, fish: 0, stew: 0 }, pos: null, clock: 0.3, day: 1, check: null, played: 0, deaths: 0, kills: 0, done: false, intro: false };
}
// A save from an older build, or one that got damaged, is repaired field by field instead of crashing the game.
function loadSave() {
  let s;
  try { s = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { return null; }
  if (!s || typeof s !== "object" || s.v !== 1) return null;
  const d = blankSave(Number.isInteger(s.friend) && s.friend >= 0 && s.friend < 5 ? s.friend : 0);
  const num = (v, lo, hi, def) => (Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : def);
  const arr = (v, ok) => (Array.isArray(v) ? [...new Set(v.filter(ok))] : []);
  const out = { ...d };
  out.intro = !!s.intro; out.done = !!s.done;
  out.maxHp = num(s.maxHp, 12, 80, d.maxHp); out.staminaMax = num(s.staminaMax, 100, 400, d.staminaMax);
  out.orbs = num(s.orbs, 0, 12, 0); out.prayers = num(s.prayers, 0, 3, 0);
  out.day = num(s.day, 1, 1e6, 1); out.clock = num(s.clock, 0, 0.9999, 0.3);
  out.played = num(s.played, 0, 1e9, 0); out.deaths = num(s.deaths, 0, 1e9, 0); out.kills = num(s.kills, 0, 1e9, 0);
  out.towers = arr(s.towers, (t) => TOWERS.some((x) => x.id === t));
  out.bosses = arr(s.bosses, (b) => BOSSES.some((x) => x.id === b));
  out.shrines = arr(s.shrines, (i) => Number.isInteger(i) && i >= 0 && i < 12);
  out.seen = arr(s.seen, (i) => Number.isInteger(i) && i >= 0 && i < 12);
  out.loonies = arr(s.loonies, (i) => Number.isInteger(i) && i >= 0 && i < 40);
  out.coolers = s.coolers && typeof s.coolers === "object" ? s.coolers : {};
  const W = Array.isArray(s.weapons) ? s.weapons.filter((w) => w && WEAPONS[w.id] && w.id !== "plunger").slice(0, 4).map((w) => ({ id: w.id, dur: num(w.dur, 1, WEAPONS[w.id].dur, WEAPONS[w.id].dur) })) : [];
  out.weapons = [{ id: "plunger", dur: null }, ...W];
  out.cur = num(s.cur | 0, 0, out.weapons.length - 1, 0);
  out.food = {}; for (const k of Object.keys(d.food)) out.food[k] = num(s.food && s.food[k], 0, 999, 0);
  out.pos = Array.isArray(s.pos) && s.pos.length === 3 && s.pos.every(Number.isFinite) && Math.abs(s.pos[0]) < 770 && Math.abs(s.pos[2]) < 770 ? s.pos : null;
  out.check = Array.isArray(s.check) && s.check.length === 2 && s.check.every(Number.isFinite) ? s.check : null;
  return out;
}
G.writeSave = () => {
  if (!G.started) return;
  const S = G.save, P = G.player;
  S.weapons = G.inv.weapons.map((w) => ({ id: w.id, dur: w.dur === Infinity ? null : w.dur }));
  S.cur = G.inv.cur; S.food = { ...G.inv.food };
  S.maxHp = P.maxHp; S.staminaMax = P.staminaMax; S.clock = G.clock;
  if (P.state === "ground" && !P.dead) S.pos = [P.x, P.y, P.z];
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* storage off */ }
};

/* ---------------- boot: build the world behind a loading card ---------------- */
// painted textures made with Higgsfield; any that fail to load fall back to plain colours
function loadTextures() {
  const L = new THREE.TextureLoader(), out = {};
  const one = (k, f) => Promise.race([L.loadAsync("tex/" + f), new Promise((r) => setTimeout(r, 30000))])
    .then((t) => { if (!t) return; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = low ? 2 : 8; out[k] = t; })
    .catch(() => {});
  return Promise.all([one("grass", "grass.jpg"), one("dirt", "dirt.jpg"), one("rock", "rock.jpg"), one("sand", "sand.jpg"), one("backdrop", "backdrop.jpg")]).then(() => out);
}
setTimeout(async () => {
  const lt = $("#loadText");
  const [tex] = await Promise.all([loadTextures(), GLB.loadModels(M.gradientMap(), (d, n) => { if (lt) lt.textContent = "Painting the valley… " + Math.round((d / n) * 100) + "%"; })]);
  G.world = new World(scene, { low, quality: Q, tex });
  G.fx = new FX(G);
  G.fishing = new Fishing(G);
  G.hazards = new Hazards(G);
  G.ui = new UI(G);
  G.save = loadSave() || blankSave();
  G.ui.paintMap();
  buildItems();
  $("#loading").hidden = true;
  titleScreen();
  requestAnimationFrame(loop);
}, 30);

/* ---------------- title ---------------- */
let pick = 0;
function titleScreen() {
  const saved = loadSave();
  pick = saved ? saved.friend : 0;
  const box = $("#crew"); box.innerHTML = "";
  PERKS.forEach((p, i) => {
    const b = document.createElement("button"); b.type = "button";
    b.innerHTML = `<img src="art/crew${i + 1}.webp" alt=""><b>${p.name}</b><small>${p.perk}</small>`;
    b.setAttribute("aria-pressed", String(i === pick));
    b.onclick = () => { pick = i; A.init(); A.sfx("ui"); box.querySelectorAll("button").forEach((x, k) => x.setAttribute("aria-pressed", String(k === i))); };
    box.appendChild(b);
  });
  $("#contBtn").hidden = !saved || !saved.intro;
  $("#contBtn").onclick = () => { A.init(); const s = loadSave(); start(s); };
  $("#newBtn").onclick = async () => {
    A.init();
    const s = loadSave();
    if (s && s.intro) { G.ui.hide("title"); const ok = await G.ui.choose("New game", "This erases your saved game. Start over?", ["Start over", "Cancel"]); if (ok !== 0) { G.ui.show("title"); return; } }
    start(blankSave(pick));
  };
  $("#helpBtn").onclick = () => { G.ui.show("help"); };
  G.ui.show("title");
}

function start(save) {
  // a double click on New game or Continue must not start two games
  if (G.starting || G.started) return;
  G.starting = true;
  G.save = save;
  if (save.friend !== pick && !save.intro) save.friend = pick;
  G.ui.hide("title");
  G.player = new Player(G, save.friend);
  const P = G.player;
  P.maxHp = save.maxHp; P.hp = save.maxHp; P.staminaMax = save.staminaMax; P.stamina = P.staminaMax;
  G.inv.weapons = save.weapons.map((w) => ({ id: w.id, dur: w.dur == null ? Infinity : w.dur }));
  G.inv.cur = Math.min(save.cur, G.inv.weapons.length - 1);
  G.inv.food = { apple: 0, shroom: 0, berry: 0, syrup: 0, fish: 0, stew: 0, ...save.food };
  P.setWeapon(G.inv.weapons[G.inv.cur].id);
  G.clock = save.clock;
  for (const id of save.bosses) grant(id, true);
  buildNPCs();
  buildFoes();
  G.bosses = BOSSES.map((b) => new Boss(G, b));
  for (const b of G.bosses) if (save.bosses.includes(b.id)) { b.alive = false; b.rig.root.visible = false; }
  if (save.done) cleanLake(true);
  G.world.shrines.forEach((s) => { if (save.shrines.includes(s.id)) s.obj.userData.glow.color.set(0xffa040); });
  G.world.towers.forEach((t) => { if (save.towers.includes(t.id)) t.obj.userData.light(); });
  const c = G.world.cottage;
  if (save.pos) P.place(save.pos[0], save.pos[2], save.pos[1]); else P.place(c.x + 2, c.z - 20);
  P.yaw = Math.PI;
  G.cam.yaw = 0; G.cam.target.set(P.x, P.y + 1.7, P.z);
  G.started = true;
  $("#hud").hidden = false; $("#pauseBtn").hidden = false;
  if (touchUI) $("#touch").hidden = false;
  G.ui.renderMap();
  if (!save.intro) intro(); else G.ui.banner(G.world.regionAt(P.x, P.z), "Day " + save.day);
  G.region = G.world.regionAt(P.x, P.z);
}

async function intro() {
  const P = G.player, c = G.world.cottage;
  G.cutscene = true;
  const other = [0, 1, 2, 3, 4].find((i) => i !== G.save.friend);
  G.ui.banner("Open your eyes…", "", 3);
  await wait(2.2);
  await G.ui.say([["The Cottage", "Open your eyes…"], ["The Cottage", "…It's the long weekend."]]);
  await G.ui.say([
    [PERKS[other].name, "Finally! You slept through the whole mess."],
    [PERKS[other].name, "The Porcelain King clogged the lake. See that swirl over the island? That's him."],
    [PERKS[other].name, "Gabe, Christian and Ryu rowed out to plunge it. They came back with glowing red eyes."],
    [PERKS[other].name, "Now Gabe's up on the mountain, Christian's in the pines, and Ryu's out in the meadows. Nobody can get near them."],
    [PERKS[other].name, "Climb the lookout tower up the hill first. Walk right into it and grab on. Light the beacon at the top, and you can map everything you see from up there."],
  ]);
  G.cutscene = false;
  G.save.intro = true;
  G.save.check = [c.x - 4, c.z - 18];
  G.ui.banner("Cottage Point", "Day 1");
  G.writeSave();
}
const wait = (s) => new Promise((r) => setTimeout(r, s * 1000));

/* ---------------- the crew at the cottage ---------------- */
const TIPS = [
  "Out of breath? Stand still on solid ground. Your wheel fills right back up.",
  "Coolers at the critter camps have paddles and hockey sticks. They hit harder than a plunger, but they break.",
  "Jump, then press jump again in the air. The umbrella opens. A campfire under you pushes you up.",
  "Cook at a fire. Three things in the pot make a stew. Fish count too. Look for rings on the water and press E to cast.",
  "Roll the moment something swings at you. Time slows down. Get your licks in.",
];
function buildNPCs() {
  const c = G.world.cottage;
  const spots = [[c.x - 3, c.z - 7.5, Math.PI], [c.x - 12, c.z - 11, 2.4], [c.x + 3, G.world.shoreZ + 2, Math.PI], [c.x - 14, c.z - 18, 0.9], [c.x + 10, c.z - 12, -2.4]];
  let k = 0;
  for (let i = 0; i < 5; i++) {
    if (i === G.save.friend) continue;
    const [x, z, yaw] = spots[k++];
    const rig = M.person(M.LOOKS[i]);
    const y = G.groundAt(x, z, 999);
    rig.root.position.set(x, y, z); rig.root.rotation.y = yaw;
    scene.add(rig.root);
    G.world.addCircle(x, z, 0.5, "npc");
    G.npcs.push({ i, name: PERKS[i].name, rig, x, z, y, yaw0: yaw, tip: TIPS[i] });
  }
}
function npcLine(n) {
  const S = G.save;
  if (S.done) return "You flushed him! Lake's clear. Meet us on the dock later.";
  if (!S.towers.includes("south")) return "The lookout tower's up the hill, west of here. Light the beacon on top and you can map the whole point.";
  if (S.bosses.length < 3) return `The swirl is still up there. ${3 - S.bosses.length} of our buddies still have red eyes.`;
  return "Everyone's back but the lake's still clogged. Take the kayak from the dock out to the island. Bring stew.";
}

/* ---------------- critters ---------------- */
function buildFoes() {
  G.plan = spawnPlan(G.world);
  for (const p of G.plan) p.foe = G.spawnFoe(p.type, p.x, p.z, p.home);
}
G.spawnFoe = (type, x, z, home) => { const f = new Foe(G, type, x, z, home); G.foes.push(f); return f; };
function respawnCritters() {
  const P = G.player;
  for (const p of G.plan) {
    if (p.foe && p.foe.alive) continue;
    if (Math.hypot(p.x - P.x, p.z - P.z) < 90) continue;
    if (p.foe) { scene.remove(p.foe.rig.root); G.foes.splice(G.foes.indexOf(p.foe), 1); }
    p.foe = G.spawnFoe(p.type, p.x, p.z, p.home);
  }
  G.items.forEach((it) => { if (it.taken) { it.taken = false; it.obj.visible = true; } });
}
G.onKill = (f) => { G.save.kills++; if (G.trial) { const t = G.trial; if (t.foes.every((x) => !x.alive)) trialCleared(); } };

/* ---------------- items and secrets ---------------- */
function buildItems() {
  const w = G.world, r = rng(321);
  const blocked = (x, z, r) => { let hit = false; w.near(x, z, (c) => { if (Math.hypot(c.x - x, c.z - z) < c.r + r) hit = true; }); return hit; };
  const add = (id, x, z) => { const y = w.height(x, z); if (y < 1.5 || blocked(x, z, 0.6)) return; const o = M.food(id); o.position.set(x, y, z); scene.add(o); G.items.push({ id, x, z, y, obj: o, taken: false }); };
  w.appleSpots.slice(0, 70).forEach(([x, z]) => add("apple", x, z));
  for (let k = 0; k < 400 && G.items.length < 190; k++) {
    const x = (r() - 0.5) * 1300, z = (r() - 0.5) * 1300, h = w.height(x, z);
    if (h < 3 || h > 90 || w.normal(x, z, new THREE.Vector3()).y < 0.85) continue;
    const id = x < -250 ? (r() < 0.6 ? "shroom" : "syrup") : z < -250 ? "berry" : r() < 0.5 ? "berry" : "shroom";
    add(id, x, z);
  }
  // Loonies: most hide under odd little rocks with flowers on top; the rest float somewhere hard to reach
  const spots = [];
  for (let k = 0; k < 2000 && spots.length < 20; k++) {
    const x = (r() - 0.5) * 1320, z = (r() - 0.5) * 1320, h = w.height(x, z);
    if (h < 3 || h > 100 || !w.clearOf(x, z, 4) || w.normal(x, z, new THREE.Vector3()).y < 0.82) continue;
    if (spots.some(([a, b]) => Math.hypot(a - x, b - z) < 110)) continue;
    spots.push([x, z]);
  }
  spots.forEach(([x, z]) => { const o = M.secretRock(); o.position.set(x, w.height(x, z), z); o.rotation.y = r() * 6; scene.add(o); w.addCircle(x, z, 0.9, "secret"); G.loonies.push({ kind: "rock", x, z, y: o.position.y, obj: o }); });
  const floats = [];
  for (const t of w.towers) floats.push([t.x + 3, t.y + 1.2, t.z + 3]);
  const c = w.cottage; floats.push([c.x, w.cabinTop + 1.1, c.z]);
  floats.push([ISLAND.x, ISLAND.top + 35.2, w.castleZ - 10]);
  let peak = [0, -1, 0]; for (let k = 0; k < 3000; k++) { const x = -300 + r() * 500, z = -700 + r() * 250, h = w.height(x, z); if (h > peak[1]) peak = [x, h, z]; }
  floats.push([peak[0], peak[1] + 1.4, peak[2]]);
  for (const [x, z] of [[-620, -520], [640, -600], [0, 640]]) floats.push([x, w.height(x, z) + 1.4, z]);
  floats.push([w.cottage.x, 1.8, (w.shoreZ + ISLAND.z + ISLAND.r) / 2]);
  floats.slice(0, 10).forEach(([x, y, z]) => { const o = M.loonieMesh(); o.position.set(x, y, z); scene.add(o); G.loonies.push({ kind: "float", x, z, y, obj: o }); });
}
G.dropFood = (id, x, z) => {
  // never drop food into the lake
  if (G.groundAt(x, z, 999) < 0.5) { const P = G.player; x = P.x; z = P.z; } const y = G.groundAt(x, z, 999); const o = M.food(id); o.position.set(x, y, z); scene.add(o); G.items.push({ id, x, z, y, obj: o, taken: false, drop: true }); };
G.foodCount = () => { const f = G.inv.food; return { total: f.apple + f.shroom + f.berry + f.syrup + (f.fish || 0), stew: f.stew }; };
const HEAL = { apple: 2, berry: 2, shroom: 3, fish: 4, syrup: 8 };
const FOOD_NAME = { apple: "Apple", berry: "Blueberries", shroom: "Toadstool", syrup: "Maple Syrup", fish: "Fish", stew: "Cottage Stew" };
G.eat = () => {
  const P = G.player, f = G.inv.food;
  if (!G.started || P.dead) return;
  if (P.hp >= P.maxHp) { G.ui.toast("You're full"); return; }
  const miss = P.maxHp - P.hp;
  // eat the smallest thing that fills you; stew if you need a lot
  let pick = null;
  if (miss >= 8 && f.stew) pick = "stew";
  if (!pick) for (const id of ["apple", "berry", "shroom", "fish", "syrup"].sort((a, b) => Math.abs(HEAL[a] - miss) - Math.abs(HEAL[b] - miss))) if (f[id] > 0) { pick = id; break; }
  if (!pick && f.stew) pick = "stew";
  if (!pick) { G.ui.toast("No food. Find apples, berries, or toadstools."); return; }
  f[pick]--;
  if (pick === "stew") { P.hp = P.maxHp; P.bonusHp = Math.min(8, P.bonusHp + 4); } else P.heal(HEAL[pick]);
  A.sfx("eat"); G.ui.toast("Ate " + FOOD_NAME[pick]);
};
function cook() {
  const f = G.inv.food;
  let n = 0;
  while (G.foodCount().total >= 2) {
    let used = 0;
    for (const id of ["syrup", "fish", "shroom", "berry", "apple"]) while (f[id] > 0 && used < 3) { f[id]--; used++; }
    f.stew++; n++;
  }
  A.sfx("cook");
  G.ui.toast("Cooked " + n + " Cottage Stew" + (n > 1 ? "s" : ""));
  G.writeSave();
}

/* ---------------- weapons ---------------- */
G.cycleWeapon = (d) => {
  const W = G.inv.weapons; if (W.length < 2) return;
  G.inv.cur = (G.inv.cur + d + W.length) % W.length;
  G.player.setWeapon(W[G.inv.cur].id); A.sfx("ui");
};
function giveWeapon(id) {
  const W = G.inv.weapons;
  if (W.length >= 5) { let worst = 1; for (let k = 2; k < W.length; k++) if (WEAPONS[W[k].id].dmg < WEAPONS[W[worst].id].dmg) worst = k; G.ui.toast("Pouch full. Dropped your " + WEAPONS[W[worst].id].name); W.splice(worst, 1); }
  W.push({ id, dur: WEAPONS[id].dur });
  G.inv.cur = W.length - 1; G.player.setWeapon(id);
}
G.autoAim = (P, dir) => {
  let best = null, bd = 5.5;
  for (const f of targets()) {
    const dx = f.x - P.x, dz = f.z - P.z, d = Math.hypot(dx, dz) - (f.T ? f.T.r : 1);
    if (d > bd) continue;
    if (dir.mag > 0.3 && (dx * dir.x + dz * dir.z) / (d + 0.01) < 0.2) continue;
    bd = d; best = f;
  }
  return best;
};
function targets() {
  const out = G.foes.filter((f) => f.alive);
  for (const b of G.bosses) { if (b.alive && b.active) out.push(b); for (const c of b.clones) if (c.alive) out.push(c); }
  return out;
}
G.meleeHit = (P, spin) => {
  const W = P.weapon, slot = G.inv.weapons[G.inv.cur];
  let hits = 0;
  for (const f of targets()) {
    const dx = f.x - P.x, dz = f.z - P.z, d = Math.hypot(dx, dz), r = f.T ? f.T.r : 1;
    if (d > W.reach * (spin ? 1.2 : 1) + r) continue;
    if (Math.abs((f.pos ? f.pos.y : P.y) - P.y) > (f.T && f.T.h ? f.T.h + 1 : 3)) continue;
    if (!spin) { let a = Math.atan2(dx, dz) - P.yaw; a = Math.atan2(Math.sin(a), Math.cos(a)); if (Math.abs(a) > W.arc / 2 + 0.35 && d > r + 0.8) continue; }
    const crit = G.slowmo > 0 || Math.random() < P.crit;
    const dmg = W.dmg * P.dmgMult * (crit ? 2 : 1) * (spin ? 1.8 : 1);
    f.hurt(dmg, P.x, P.z, W.knock, W.stun);
    G.fx.puff(f.x, (f.pos ? f.pos.y : P.y) + 1.2, f.z, crit ? 0xffd84a : 0xffffff, crit ? 10 : 5);
    hits++;
  }
  if (hits) {
    A.sfx(G.slowmo > 0 ? "crit" : "hit"); G.hitstop = 0.06; G.shake(0.12);
    if (slot.dur !== Infinity) { slot.dur -= 1; if (slot.dur <= 0) { A.sfx("break"); G.ui.toast("Your " + W.name + " broke!"); G.inv.weapons.splice(G.inv.cur, 1); G.inv.cur = 0; P.setWeapon("plunger"); } }
  }
};
G.perfectDodge = () => {
  if (G.slowmo > 0) return;
  G.slowmo = 2; A.sfx("slowmo"); G.ui.toast("Flurry! Hit back!");
};

/* ---------------- the big moments ---------------- */
G.reachedTowerTop = () => {};
function activateTower(t) {
  const S = G.save;
  if (S.towers.includes(t.id)) return;
  S.towers.push(t.id); S.check = [t.x + 6, t.z + 6];
  t.obj.userData.light();
  A.sfx("tower"); G.shake(0.3);
  G.fx.puff(t.x, t.y + 2, t.z, 0xffb04a, 30);
  G.ui.renderMap();
  G.ui.banner(t.name, "From up here you can see for miles. You sketch it all into your map.", 4.5);
  // after a moment to watch the beacon catch, the map opens and the clouds part around this lookout
  setTimeout(() => { if (G.started && !G.ui.modal && !G.player.dead) { exitLock(); G.paused = true; G.ui.mapReveal(t); } }, 1400);
  G.writeSave();
  const talk = (lines) => { const go = () => (G.ui.modal ? setTimeout(go, 500) : G.ui.say(lines)); setTimeout(go, 1800); };
  if (t.id === "south") talk([["The Cottage", "See that? Every beacon you light, you can map the land around it. And you can travel back to any lit beacon from the map."], ["The Cottage", "Outhouses glow blue. Step in and win the trial for a Golden Orb. Four orbs buy a new heart at the loon statue."], ["The Cottage", "Jump off and open the umbrella. You'll float a long way."]]);
}
let trialFoes = [["raccoon", "raccoon", "raccoon"], ["raccoon", "goose", "goose", "raccoon"], ["raccoon", "raccoon", "bear"], ["bear", "raccoon", "raccoon", "goose"], ["bear", "bear"], ["moose"], ["raccoon", "raccoon", "raccoon", "raccoon", "bear"], ["moose", "raccoon", "raccoon"], ["bear", "bear", "raccoon"], ["moose", "bear"], ["moose", "goose", "goose", "goose"], ["moose", "moose"]];
function startTrial(s) {
  const list = trialFoes[s.id];
  G.trial = { s, foes: [] };
  list.forEach((type, k) => { const a = s.rot + (k / list.length) * 6.28 + 1, x = s.x + Math.sin(a) * 11, z = s.z + Math.cos(a) * 11; const f = G.spawnFoe(type, x, z, { x: s.x, z: s.z }); f.alert(); G.fx.puff(x, f.pos.y + 1, z, 0x5ad8ff, 14); G.trial.foes.push(f); });
  A.sfx("trial"); G.ui.banner(s.name, "Trial of the Outhouse");
}
function trialCleared() {
  const s = G.trial.s; G.trial = null;
  G.save.shrines.push(s.id); G.save.orbs++; G.save.check = [s.x + Math.sin(s.rot) * 4, s.z + Math.cos(s.rot) * 4];
  s.obj.userData.glow.color.set(0xffa040);
  A.sfx("shrine"); G.ui.banner("Trial cleared", "You got a Golden Orb");
  G.writeSave();
  if (G.save.orbs === 4) setTimeout(() => G.ui.toast("Four orbs! Pray at the loon statue by the cottage."), 3500);
}
async function pray() {
  const P = G.player;
  const c = await G.ui.choose("The Loon Statue", "Offer four Golden Orbs. What do you want?", ["A new heart", "More stamina", "Not yet"]);
  if (c !== 0 && c !== 1) return;
  if (G.save.orbs < 4) return;
  G.save.orbs -= 4; G.save.prayers++;
  if (c === 0) { P.maxHp += 4; P.hp = P.maxHp; G.ui.toast("One more heart!"); } else { P.staminaMax += 20; P.stamina = P.staminaMax; G.ui.toast("Your stamina wheel grew!"); }
  A.sfx("shrine"); G.writeSave();
}
function openCooler(camp) {
  const S = G.save, lid = camp.cooler.userData.lid;
  S.coolers[camp.i] = S.day;
  lid.rotation.x = -1.8;
  const pool = ["paddle", "stick", "rod", "pan", "paddle", "stick", "rod", "pan", "golden", "stick"];
  const id = S.day > 1 && Math.random() < 0.5 ? pool[(Math.random() * 8) | 0] : pool[camp.i];
  giveWeapon(id);
  const extra = ["apple", "berry", "shroom", "syrup"][camp.i % 4];
  G.inv.food[extra] += 2;
  A.sfx("open"); G.ui.toast("Got a " + WEAPONS[id].name + " and 2 " + FOOD_NAME[extra]);
  G.writeSave();
}
function liftRock(l, idx) {
  G.save.loonies.push(idx);
  const o = l.obj;
  G.fx.puff(l.x, l.y + 1, l.z, 0xc8b89a, 12);
  o.children[0].visible = false;
  const chip = M.critter("raccoon"); chip.root.scale.setScalar(0.45); chip.root.position.set(l.x, l.y, l.z); chip.root.traverse((m) => { if (m.isMesh && m.material.color && !m.userData.outline) { m.material = m.material.clone(); m.material.color.offsetHSL(0.06, 0.4, 0.1); } });
  scene.add(chip.root);
  setTimeout(() => { scene.remove(chip.root); o.visible = false; }, 2200);
  foundLoonie();
}
function foundLoonie() {
  A.sfx("loonie");
  const n = G.save.loonies.length;
  G.ui.toast(["Chip-chip! You found me!", "Hee hee! A Loonie for you!", "Aw, nuts. You found me."][n % 3] + "  (" + n + "/" + G.loonies.length + ")", 3);
  G.writeSave();
}

// bosses
G.bossIntro = (b) => {
  A.sfx("boss"); A.setMood("boss");
  G.ui.banner(b.def.name, b.def.title, 3);
  G.ui.boss(b.def.name, 1);
  G.activeBoss = b;
  G.say(b, b.S.lines[0]);
};
G.bossLeft = (b) => { if (G.activeBoss === b) { G.activeBoss = null; G.ui.boss(null); } };
G.say = (who, text) => { G.ui.toast("“" + text + "”", 2.4); };
const FREED = {
  gabe: ["Gabe", ["Ugh… my head. Was I yelling at bears again?", "That toilet got in my head. Thanks for knocking it out.", "Take my Grit. It'll block three hits for you. It comes back after a minute."]],
  christian: ["Christian", ["Whoa. Did I just throw a whole deck at you?", "The King made me see clones everywhere. Wild.", "Here's a real trick. Press R and the wind lifts you sky high. Open your umbrella up there."]],
  ryu: ["Ryu", ["…My turn to say sorry.", "That sludge made me fast, and angry. Now I'm just fast.", "Take my Fury. Press F and lightning hits everything around you."]],
};
G.bossDown = async (b) => {
  G.ui.boss(null); G.activeBoss = null; A.setMood("day");
  G.slowmo = 1.5; A.sfx("victory"); G.shake(0.8);
  G.hazards.clear();
  for (const f of G.foes) if (f.boss === b && f.alive) f.die();
  b.clones.forEach((c) => c.hurt());
  G.fx.puff(b.x, b.pos.y + 3, b.z, 0x7a3a9a, 30);
  G.save.bosses.push(b.id); G.save.check = [b.center.x, b.center.z];
  if (b.id === "king") { await wait(2.5); ending(); return; }
  G.ui.banner(b.def.name, "Freed from the sludge", 3.5);
  await wait(2.5);
  b.rig.root.visible = false;
  const [name, lines] = FREED[b.id];
  await G.ui.say(lines.map((l) => [name, l]));
  grant(b.id);
  const P = G.player; P.maxHp += 4; P.hp = P.maxHp;
  G.ui.toast("You got a Heart Container and " + { gabe: "Gabe's Grit", christian: "Mystic Updraft", ryu: "Ryu's Fury" }[b.id]);
  G.writeSave();
  if (G.save.bosses.length === 3) setTimeout(() => G.ui.say([["The Cottage", "All three are free. The King is alone now."], ["The Cottage", "Take the kayak from the cottage dock to Clog Island. End this."]]), 3000);
};
function grant(id, quiet) {
  if (id === "gabe") G.abilities.grit = { charges: 3, cd: 0 };
  if (id === "christian") G.abilities.lift = { cd: 0 };
  if (id === "ryu") G.abilities.fury = { cd: 0 };
  void quiet;
}
function cleanLake(quiet) {
  const w = G.world;
  w.swirl.visible = false;
  for (const s of w.sludge) s.m.visible = false;
  w.castle.traverse((o) => { if (o.isMesh && o.material.emissive && o.material.color.getHex() === 0x5a2a6a) o.visible = false; });
  if (!quiet) A.sfx("victory");
}
async function ending() {
  const S = G.save;
  S.done = true;
  cleanLake();
  G.writeSave();
  const mins = Math.round(S.played / 60);
  await G.ui.say([["The Porcelain King", "No… NO… I was the throne… of the whole lake…"], ["The Cottage", "The swirl is gone. The lake is clear. Listen. The loons are back."], ["The Cottage", "Thank you. Now go sit on the dock. You earned it."]]);
  await G.ui.choose("Loon Lake is clear", `You flushed the Porcelain King in ${mins} minutes, with ${S.deaths} naps, ${S.loonies.length} of ${G.loonies.length} Loonies, and ${S.shrines.length} of 12 outhouse trials. Keep exploring: there are still secrets out there.`, ["Keep playing"]);
}

G.die = async () => {
  const P = G.player;
  if (P.dead) return;
  // close any open talk or menu first, so the game over card can never be stuck behind it
  G.ui.closeAll();
  P.dead = true; G.save.deaths++;
  A.sfx("die"); A.setMood("day");
  G.ui.boss(null); G.activeBoss = null;
  await wait(1.4);
  await G.ui.choose("You passed out", "The crew carried you back. You keep everything you found.", ["Get up"]);
  for (const b of G.bosses) if (b.alive && b.active) b.reset();
  if (G.trial) { G.trial.foes.forEach((f) => f.alive && f.die()); G.trial = null; }
  G.hazards.clear();
  const c = G.save.check || [G.world.cottage.x - 4, G.world.cottage.z - 18];
  P.dead = false; P.hp = P.maxHp; P.bonusHp = 0; P.stamina = P.staminaMax; P.exhausted = false; P.invuln = 2;
  P.place(c[0], c[1]);
  G.resume();
};
G.drown = () => {
  const P = G.player;
  A.sfx("splash");
  P.exhausted = false; P.stamina = P.staminaMax;
  const at = P.lastSafe.clone();
  P.hp -= 4; G.ui.flash();
  if (P.hp <= 0) { P.hp = 0; G.die(); return; }
  P.place(at.x, at.z); P.invuln = 1.5;
  G.ui.toast("You swam too far");
};

/* ---------------- travel, map, pause ---------------- */
G.travel = (m) => {
  const P = G.player;
  let x = m.x, z = m.z;
  if (m.kind === "tower") { x += 7; z += 7; } else if (m.kind === "shrine") { x += Math.sin(m.shrine.rot) * 4; z += Math.cos(m.shrine.rot) * 4; } else if (m.kind === "home") { x -= 4; z -= 18; }
  G.fx.puff(P.x, P.y + 1, P.z, 0x5ad8ff, 20);
  P.place(x, z);
  G.cam.target.set(P.x, P.y + 1.7, P.z);
  G.fx.puff(P.x, P.y + 1, P.z, 0x5ad8ff, 20);
  A.sfx("lift");
  for (const b of G.bosses) if (b.active) b.reset();
};
G.openMap = () => { if (!G.started || G.ui.modal) return; exitLock(); G.paused = true; G.ui.openMap(); };
function openPause() {
  if (!G.started || G.ui.modal) return;
  exitLock();
  G.paused = true;
  const S = G.save;
  $("#pstats").textContent = `${PERKS[S.friend].name} · Day ${S.day} · Towers ${S.towers.length}/4 · Trials ${S.shrines.length}/12 · Loonies ${S.loonies.length}/${G.loonies.length} · Blights ${Math.min(3, S.bosses.filter((b) => b !== "king").length)}/3`;
  $("#soundBtn").textContent = "Sound: " + (A.isOn() ? "on" : "off");
  $("#gfxBtn").textContent = "Graphics: " + GFX_NAMES[gfx];
  G.ui.open("pause");
}
G.resume = () => { G.paused = false; };
$("#resumeBtn").onclick = () => G.ui.close("pause");
$("#pmapBtn").onclick = () => { G.ui.hide("pause"); G.ui.modal = null; G.ui.openMap(); };
$("#phelpBtn").onclick = () => { G.ui.hide("pause"); G.ui.modal = null; G.ui.open("help"); };
$("#soundBtn").onclick = () => { $("#soundBtn").textContent = "Sound: " + (A.toggle() ? "on" : "off"); };
const GFX_NAMES = { high: "High", medium: "Medium", low: "Low" };
$("#gfxBtn").onclick = () => { const order = ["high", "medium", "low"]; G.setGraphics(order[(order.indexOf(gfx) + 1) % 3]); $("#gfxBtn").textContent = "Graphics: " + GFX_NAMES[gfx]; };
$("#pauseBtn").onclick = () => openPause();

/* ---------------- goals and clock ---------------- */
G.goal = () => {
  const S = G.save;
  if (!S.towers.includes("south")) return "Light the beacon on the lookout tower<small>at Cottage Point, up the hill. From the top you can map the land.</small>";
  const left = 3 - S.bosses.filter((b) => b !== "king").length;
  if (left > 0) return `Free your friends from the sludge<small>${left} left: ${BOSSES.filter((b) => b.id !== "king" && !S.bosses.includes(b.id)).map((b) => b.name.split(",")[0].split(" the")[0]).join(", ")}</small>`;
  if (!S.done) return "Flush the Porcelain King<small>Paddle the kayak to Clog Island</small>";
  return `Find every Loonie<small>${S.loonies.length} of ${G.loonies.length}</small>`;
};
G.clockText = () => {
  const m = Math.floor(G.clock * 24 * 60), h = Math.floor(m / 60), mm = String(m % 60).padStart(2, "0");
  return (G.night ? "🌙 " : "☀️ ") + ((h + 11) % 12 + 1) + ":" + mm + (h < 12 ? " AM" : " PM");
};

/* ---------------- day and night ---------------- */
const C = (h) => new THREE.Color(h);
const SKY = {
  day: { top: C(0x3a82d6), hor: C(0xd6ecf6), sun: C(0xfff0d0), hemi: C(0xd2e6ff), gnd: C(0x7a8a50), si: 1.65, hi: 1.05 },
  dusk: { top: C(0x5c6cbc), hor: C(0xffc49a), sun: C(0xffa868), hemi: C(0xffd6b8), gnd: C(0x5a4a3a), si: 1.15, hi: 0.9 },
  night: { top: C(0x0a1230), hor: C(0x24345a), sun: C(0x8aa0ff), hemi: C(0x5a70b0), gnd: C(0x1a2030), si: 0.35, hi: 0.55 },
};
const tmpC = new THREE.Color();
function mixSky(a, b, t, key) { return tmpC.copy(a[key]).lerp(b[key], t).clone(); }
function lighting() {
  const t = G.clock, a = (t - 0.25) * Math.PI * 2;
  const sd = new THREE.Vector3(Math.cos(a), Math.sin(a), 0.35).normalize();
  const elev = sd.y;
  let A1, B1, k;
  if (elev > 0.25) { A1 = SKY.day; B1 = SKY.day; k = 0; }
  else if (elev > -0.05) { A1 = SKY.dusk; B1 = SKY.day; k = (elev + 0.05) / 0.3; }
  else if (elev > -0.3) { A1 = SKY.night; B1 = SKY.dusk; k = (elev + 0.3) / 0.25; }
  else { A1 = SKY.night; B1 = SKY.night; k = 0; }
  const top = mixSky(A1, B1, k, "top"), hor = mixSky(A1, B1, k, "hor");
  const w = G.world;
  w.skyU.uTop.value.copy(top); w.skyU.uHorizon.value.copy(hor);
  const lightDir = elev > -0.08 ? sd : sd.clone().negate();
  w.skyU.uSun.value.copy(sd);
  w.skyU.uSunCol.value.copy(mixSky(A1, B1, k, "sun"));
  const night = smooth(-0.05, -0.3, elev);
  w.skyU.uNight.value = night;
  if (w.backU) { w.backU.uTint.value.copy(hor).lerp(top, 0.18); w.backU.uNight.value = night; w.backU.uLight.value = 0.45 + 0.55 * (1 - night); }
  G.night = night > 0.5;
  // distant hills fade into a soft blue haze, like a painted backdrop
  scene.fog.color.copy(hor).lerp(top, 0.18);
  sun.color.copy(mixSky(A1, B1, k, "sun"));
  sun.intensity = lerp(A1.si, B1.si, k);
  hemi.color.copy(mixSky(A1, B1, k, "hemi")); hemi.groundColor.copy(mixSky(A1, B1, k, "gnd"));
  hemi.intensity = lerp(A1.hi, B1.hi, k);
  const L = 0.35 + 0.65 * (1 - night) * (0.75 + 0.25 * smooth(-0.05, 0.4, elev));
  const sunCol = mixSky(A1, B1, k, "sun");
  for (const U of [w.waterU, w.grassU]) { U.uFog.value.copy(scene.fog.color); U.uFogNear.value = scene.fog.near; U.uFogFar.value = scene.fog.far; U.uLight.value = L; U.uSunCol.value.copy(sunCol); }
  w.grassU.uSunDir.value.copy(lightDir);
  w.waterU.uSky.value.copy(top).lerp(hor, 0.35); w.waterU.uHorizon.value.copy(hor); w.waterU.uSun.value.copy(sd);
  w.flowerMat.color.setScalar(L);
  // clouds catch the light: white by day, peach and pink at sunset, grey-blue at night
  const dusk = 1 - Math.abs(smooth(-0.1, 0.35, elev) * 2 - 1);
  const cloudCol = tmpC.set(0xffffff).lerp(sunCol, 0.35 + dusk * 0.4).multiplyScalar(0.38 + 0.62 * L);
  for (const c of w.clouds) c.material.color.copy(cloudCol);
  // the colour far hills fade into: a deeper blue than the fog, like the painted distances in an animated film
  G.look = { time: G.time, night, sunDir: sd, sunCol, haze: hor.clone().lerp(top, 0.42) };
  w.cabin.userData.windows.emissiveIntensity = night * 1.2;
  if (w.cabin.userData.lamp) w.cabin.userData.lamp.intensity = night * 40;
  const P = G.player, cx = P ? P.x : w.cottage.x, cz = P ? P.z : w.cottage.z;
  sun.position.set(cx + lightDir.x * 200, (P ? P.y : 10) + Math.max(0.2, lightDir.y) * 200, cz + lightDir.z * 200);
  sun.target.position.set(cx, P ? P.y : 10, cz);
}
// fireflies at night
const fireflies = (() => {
  const n = 90, g = new THREE.BufferGeometry(), p = new Float32Array(n * 3);
  for (let k = 0; k < n; k++) p.set([(Math.random() - 0.5) * 60, Math.random() * 4 + 0.5, (Math.random() - 0.5) * 60], k * 3);
  g.setAttribute("position", new THREE.BufferAttribute(p, 3));
  const m = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xfff08a, size: 0.35, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  m.frustumCulled = false;
  scene.add(m);
  return m;
})();

/* ---------------- input ---------------- */
const keys = new Set(), pressed = new Set();
const inp = G.inp = { move: { x: 0, y: 0 }, sprint: false, jump: false, attack: false, attackHeld: false, roll: false, interact: false };
addEventListener("keydown", (e) => {
  if (e.repeat) return;
  const k = e.code;
  keys.add(k); pressed.add(k);
  A.init();
  if (["Space", "Tab", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(k)) e.preventDefault();
  if (G.ui && G.ui.modal === "dialog" && ["KeyE", "Space", "Enter", "KeyJ"].includes(k)) { G.ui.advance(); pressed.clear(); return; }
  if (G.ui && G.ui.modal && k === "Escape") { const m = G.ui.modal; if (["map", "help", "pause"].includes(m)) G.ui.close(m); return; }
  if (!G.started) return;
  if (k === "Escape" || k === "KeyP") openPause();
  if (k === "KeyM") { if (G.ui.modal === "map") G.ui.close("map"); else G.openMap(); }
});
addEventListener("keyup", (e) => keys.delete(e.code));
let mouseDX = 0, mouseDY = 0, locked = false, mouseAtk = false;
const cv = renderer.domElement;
function exitLock() { if (document.pointerLockElement) document.exitPointerLock(); }
cv.addEventListener("mousedown", (e) => {
  A.init();
  if (!G.started || G.ui.modal || touchUI) return;
  if (!locked) { cv.requestPointerLock?.(); return; }
  if (e.button === 0) { pressed.add("Mouse0"); mouseAtk = true; }
  if (e.button === 2) pressed.add("Mouse2");
});
addEventListener("mouseup", (e) => { if (e.button === 0) mouseAtk = false; });
cv.addEventListener("contextmenu", (e) => e.preventDefault());
document.addEventListener("pointerlockchange", () => {
  const was = locked; locked = document.pointerLockElement === cv;
  if (was && !locked && G.started && !G.ui.modal) openPause();
});
addEventListener("mousemove", (e) => { if (locked) { mouseDX += e.movementX; mouseDY += e.movementY; } });
addEventListener("wheel", (e) => { if (G.started && !G.ui.modal) G.cam.dist = clamp(G.cam.dist + Math.sign(e.deltaY) * 0.8, 3.5, 16); }, { passive: true });

// touch: left thumb is a stick, right thumb turns the camera, buttons do the rest
const touch = { stick: null, look: null, held: new Set() };
if (touchUI) {
  const stickEl = $("#stick");
  addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "touch" || !G.started || G.ui.modal) return;
    if (e.target.closest("button, canvas#mini")) return;
    if (e.clientX < innerWidth * 0.45 && !touch.stick) { touch.stick = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: 0, y: 0 }; stickEl.hidden = false; stickEl.style.left = e.clientX + "px"; stickEl.style.top = e.clientY + "px"; }
    else if (!touch.look) touch.look = { id: e.pointerId, x: e.clientX, y: e.clientY };
  });
  addEventListener("pointermove", (e) => {
    if (touch.stick && e.pointerId === touch.stick.id) {
      let dx = e.clientX - touch.stick.x0, dy = e.clientY - touch.stick.y0; const d = Math.hypot(dx, dy), m = 55;
      if (d > m) { dx *= m / d; dy *= m / d; }
      touch.stick.x = dx / m; touch.stick.y = -dy / m;
      stickEl.firstElementChild.style.transform = `translate(${dx}px, ${dy}px)`;
    }
    if (touch.look && e.pointerId === touch.look.id) { mouseDX += (e.clientX - touch.look.x) * 1.6; mouseDY += (e.clientY - touch.look.y) * 1.6; touch.look.x = e.clientX; touch.look.y = e.clientY; G.cam.idle = 0; }
  });
  const end = (e) => {
    if (touch.stick && e.pointerId === touch.stick.id) { touch.stick = null; stickEl.hidden = true; stickEl.firstElementChild.style.transform = ""; }
    if (touch.look && e.pointerId === touch.look.id) touch.look = null;
  };
  addEventListener("pointerup", end); addEventListener("pointercancel", end);
  document.querySelectorAll("[data-b]").forEach((b) => {
    const name = b.dataset.b;
    b.addEventListener("pointerdown", (e) => { e.preventDefault(); e.stopPropagation(); A.init(); b.classList.add("on"); touch.held.add(name); pressed.add("T_" + name); });
    const up = () => { b.classList.remove("on"); touch.held.delete(name); };
    b.addEventListener("pointerup", up); b.addEventListener("pointercancel", up); b.addEventListener("pointerleave", up);
  });
}
// game pads
const padPrev = [];
function pollPad() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  const p = pads && [...pads].find((x) => x && x.connected);
  if (!p) return null;
  const b = (i) => p.buttons[i] && p.buttons[i].pressed;
  const edge = (i) => b(i) && !padPrev[i];
  const out = { lx: dz(p.axes[0]), ly: dz(p.axes[1]), rx: dz(p.axes[2]), ry: dz(p.axes[3]), jump: edge(0), sprint: b(1), attack: edge(2), attackHeld: b(2), interact: edge(3), roll: edge(4), eat: edge(5), lift: edge(6), fury: edge(7), map: edge(8), pause: edge(9), prev: edge(14), next: edge(15) };
  p.buttons.forEach((x, i) => (padPrev[i] = x.pressed));
  if (Object.values(out).some((v) => v === true || (typeof v === "number" && v !== 0))) G.pad = true;
  return out;
}
const dz = (v) => (Math.abs(v || 0) < 0.15 ? 0 : v);

function readInput() {
  const pad = pollPad();
  let mx = (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0), my = (keys.has("KeyW") ? 1 : 0) - (keys.has("KeyS") ? 1 : 0);
  if (touch.stick) { mx = touch.stick.x; my = touch.stick.y; }
  if (pad && (pad.lx || pad.ly)) { mx = pad.lx; my = -pad.ly; }
  const l = Math.hypot(mx, my); if (l > 1) { mx /= l; my /= l; }
  inp.move.x = mx; inp.move.y = my;
  const P = (k) => pressed.has(k);
  inp.sprint = keys.has("ShiftLeft") || keys.has("ShiftRight") || (touch.stick && Math.hypot(touch.stick.x, touch.stick.y) > 0.96) || (pad && pad.sprint);
  inp.jump = P("Space") || P("T_jump") || (pad && pad.jump);
  inp.attack = P("KeyJ") || P("Mouse0") || P("T_attack") || (pad && pad.attack);
  inp.attackHeld = keys.has("KeyJ") || mouseAtk || touch.held.has("attack") || (pad && pad.attackHeld);
  inp.roll = P("KeyK") || P("Mouse2") || P("T_roll") || (pad && pad.roll);
  inp.interact = P("KeyE") || P("T_interact") || (pad && pad.interact);
  inp.eat = P("KeyH") || P("T_eat") || (pad && pad.eat);
  inp.lift = P("KeyR") || P("T_lift") || (pad && pad.lift);
  inp.fury = P("KeyF") || P("T_fury") || (pad && pad.fury);
  inp.map = P("T_map") || (pad && pad.map);
  inp.pause = pad && pad.pause;
  inp.next = P("KeyQ") || P("Tab") || (pad && pad.next);
  inp.prev = pad && pad.prev;
  inp.slot = ["Digit1", "Digit2", "Digit3", "Digit4", "Digit5"].findIndex((k) => P(k));
  let cx = mouseDX * 0.0028, cy = mouseDY * 0.0022;
  if (keys.has("ArrowLeft")) cx -= 0.035; if (keys.has("ArrowRight")) cx += 0.035;
  if (keys.has("ArrowUp")) cy -= 0.025; if (keys.has("ArrowDown")) cy += 0.025;
  if (pad) { cx += pad.rx * 0.05; cy += pad.ry * 0.035; }
  inp.look = { x: cx, y: cy };
  mouseDX = mouseDY = 0;
  pressed.clear();
}

/* ---------------- interact ---------------- */
function nearest() {
  const P = G.player, w = G.world, S = G.save;
  const opts = [];
  const d2 = (x, z) => Math.hypot(P.x - x, P.z - z);
  for (const n of G.npcs) if (d2(n.x, n.z) < 3) opts.push({ d: d2(n.x, n.z), label: "Talk to " + n.name, go: () => { G.ui.say([[n.name, npcLine(n)], [n.name, n.tip]]); } });
  for (const t of w.towers) if (!S.towers.includes(t.id) && d2(t.x, t.z) < 3.8 && P.y > t.y - 1) opts.push({ d: 0, label: "Light the beacon", go: () => activateTower(t) });
  for (const s of w.shrines) {
    const fx = s.x + Math.sin(s.rot) * 1.8, fz = s.z + Math.cos(s.rot) * 1.8;
    if (d2(fx, fz) < 2.6 && !S.shrines.includes(s.id) && !G.trial) opts.push({ d: d2(fx, fz), label: "Start the trial", go: () => startTrial(s) });
  }
  for (const c of w.camps) { const x = c.cooler.position.x, z = c.cooler.position.z; if (d2(x, z) < 2.4 && (S.coolers[c.i] == null || S.coolers[c.i] < S.day)) opts.push({ d: d2(x, z), label: "Open the cooler", go: () => openCooler(c) }); }
  G.loonies.forEach((l, i) => { if (l.kind === "rock" && !S.loonies.includes(i) && d2(l.x, l.z) < 2.4) opts.push({ d: d2(l.x, l.z), label: "Lift the rock", go: () => liftRock(l, i) }); });
  for (const f of w.fires) if (d2(f.x, f.z) < 3.5 && G.foodCount().total >= 2) opts.push({ d: d2(f.x, f.z), label: "Cook", go: cook });
  if (d2(w.statue.x, w.statue.z) < 4 && S.orbs >= 4) opts.push({ d: 0, label: "Pray", go: pray });
  // the kayak: get in from the dock, the shore, or the water; get out wherever there is dry land
  const K = w.kayak;
  if (K && P.state === "kayak") { const spot = P.landingSpot(); if (spot) opts.push({ d: 0.5, label: "Get out", go: () => P.leaveKayak(spot) }); }
  else if (K && !K.rider && (P.state === "ground" || P.state === "swim") && d2(K.x, K.z) < 3.4) opts.push({ d: d2(K.x, K.z), label: "Get in the kayak", go: () => P.boardKayak() });
  // fishing: rings on the water close enough to cast at
  const spot = G.fishing && G.fishing.spotNear();
  if (spot) opts.push({ d: 5, label: "Fish", go: () => G.fishing.start(spot) });
  opts.sort((a, b) => a.d - b.d);
  return opts[0];
}

/* ---------------- camera ---------------- */
const tv = new THREE.Vector3();
function updateCamera(dt) {
  const P = G.player, c = G.cam;
  c.yaw -= inp.look.x; c.pitch = clamp(c.pitch + inp.look.y, -0.5, 1.25);
  if (inp.look.x || inp.look.y) c.idle = 0; else c.idle += dt;
  // swing behind the hero when you are moving and not steering the camera (phones and pads)
  const sp = Math.hypot(P.vel.x, P.vel.z);
  if ((touchUI || G.pad) && c.idle > 1.2 && sp > 2 && P.state !== "climb") { const want = P.yaw + Math.PI; let d = Math.atan2(Math.sin(want - c.yaw), Math.cos(want - c.yaw)); c.yaw += d * Math.min(1, dt * 0.8); }
  const tgt = tv.set(P.x, P.y + (P.state === "swim" ? 1.0 : P.state === "kayak" ? 1.25 : 1.7), P.z);
  if (c.snap) { c.target.copy(tgt); c.cur = undefined; c.dcol = undefined; c.lift = 0; c.snap = false; }
  c.target.x = lerp(c.target.x, tgt.x, 1 - Math.exp(-dt * 14));
  c.target.z = lerp(c.target.z, tgt.z, 1 - Math.exp(-dt * 14));
  c.target.y = lerp(c.target.y, tgt.y, 1 - Math.exp(-dt * 7));
  c.target.y = Math.max(c.target.y, G.world.height(c.target.x, c.target.z) + 0.5, P.y + 0.5);
  const want = c.dist * (P.state === "glide" ? 1.3 : G.activeBoss ? 1.35 : 1);
  c.cur = lerp(c.cur || want, want, 1 - Math.exp(-dt * 3));
  // How far the camera can sit along a direction before a hill or a building is in the way.
  // Ground right next to where the camera ends up is not a blocker: the camera just rises above it.
  const N = 30, MIN = 2.3;
  const free = (pitch, maxd) => {
    const cp = Math.cos(pitch), dx = Math.sin(c.yaw) * cp, dy = Math.sin(pitch), dz = Math.cos(c.yaw) * cp;
    for (let k = 1; k <= N; k++) {
      const s = (k / N) * maxd, px = c.target.x + dx * s, py = c.target.y + dy * s, pz = c.target.z + dz * s;
      if (inBox(px, py, pz) || (s < maxd * 0.8 && G.world.height(px, pz) + 0.45 > py)) return Math.max(0, s - maxd / N - 0.3);
    }
    return maxd;
  };
  // too close? look for a higher angle over the shoulder instead of moving into the hero
  let wantLift = 0;
  if (free(c.pitch, c.cur) < MIN) {
    wantLift = 1.35 - c.pitch;
    for (let a = 0.15; c.pitch + a <= 1.35; a += 0.15) if (free(c.pitch + a, c.cur) >= MIN) { wantLift = a; break; }
  }
  c.lift = lerp(c.lift || 0, wantLift, 1 - Math.exp(-dt * (wantLift > (c.lift || 0) ? 7 : 1.6)));
  const pitch = Math.min(1.4, c.pitch + c.lift);
  const dHit = free(pitch, c.cur);
  // move in fast when something blocks the view, and ease back out slowly, so the view never jitters
  const prev = Number.isFinite(c.dcol) ? c.dcol : dHit;
  c.dcol = dHit < prev ? dHit : lerp(prev, dHit, 1 - Math.exp(-dt * 2.2));
  // never past the first thing in the way; if that is very close, the hero hides instead of the view going inside a wall
  const d = Math.min(c.dcol, dHit);
  const cp = Math.cos(pitch);
  c.pos.set(c.target.x + Math.sin(c.yaw) * cp * d, c.target.y + Math.sin(pitch) * d, c.target.z + Math.cos(c.yaw) * cp * d);
  // never show the inside of the hero
  P.rig.root.userData.camHide = d < 1.5;
  c.pos.y = Math.max(c.pos.y, G.world.height(c.pos.x, c.pos.z) + 0.6, 0.5);
  camera.position.copy(c.pos);
  if (G.shakeT > 0) { G.shakeT -= dt; const s = G.shakeT * 0.6; camera.position.x += (Math.random() - 0.5) * s; camera.position.y += (Math.random() - 0.5) * s; }
  camera.lookAt(c.target);
}
function inBox(x, y, z) {
  for (const b of G.world.boxes) {
    if (y < b.y0 || y > b.top + 0.3) continue;
    const c = Math.cos(b.rot), s = Math.sin(b.rot), lx = (x - b.x) * c - (z - b.z) * s, lz = (x - b.x) * s + (z - b.z) * c;
    if (Math.abs(lx) < b.hw + 0.3 && Math.abs(lz) < b.hd + 0.3) return true;
  }
  return false;
}
let titleT = 0;
function titleCamera(dt) {
  titleT += dt * 0.04;
  const c = G.world.cottage;
  camera.position.set(c.x + Math.sin(titleT) * 40 + 20, c.z > 0 ? 22 : 22, c.z + Math.cos(titleT) * 20 + 10);
  camera.lookAt(ISLAND.x, 18, ISLAND.z);
}

/* ---------------- the loop ---------------- */
// dynamic resolution: watch the frame time and trade sharpness for smoothness when needed
let ftAvg = 16, ftLast = 0, ftHold = 0;
function frameTime(now) {
  const ft = now - (ftLast || now); ftLast = now;
  if (ft <= 0 || ft > 250 || document.hidden) return;
  ftAvg += (ft - ftAvg) * 0.05;
  if ((ftHold -= ft) > 0) return;
  if (ftAvg > 26 && resScale > 0.55) { resScale = Math.max(0.55, resScale * 0.88); applyRatio(); ftHold = 1500; }
  else if (ftAvg < 14 && resScale < 1) { resScale = Math.min(1, resScale * 1.08); applyRatio(); ftHold = 2500; }
}
G.setGraphics = (name) => {
  if (!QUALITY[name]) return;
  gfx = name; Q = QUALITY[name]; resScale = 1;
  try { localStorage.setItem(GFX_KEY, name); } catch (e) { /* storage off */ }
  applyRatio();
  painter.setQuality(Q);
  sun.shadow.mapSize.set(Q.shadow, Q.shadow); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
  G.world.quality = Q; G.world.buildGrass(Q);
};
G.graphics = () => gfx;
let last = performance.now(), saveT = 0, regionT = 0, skeeterT = 0, cam0 = false;
function loop(now) {
  requestAnimationFrame(loop);
  let dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (G.contextLost) return; // nothing can draw until the page reloads
  G.frame = (G.frame || 0) + 1;
  if (!G.world) return;
  G.time += dt;
  frameTime(now);
  if (!G.started) { titleCamera(dt); lighting(); G.world.update(dt, G.time, camera, camera.position); draw(); return; }
  readInput();
  const P = G.player;
  if (inp.pause && !G.ui.modal) openPause();
  if (inp.map) G.openMap();
  if (G.ui.modal === "dialog" && (inp.interact || inp.jump || inp.attack)) G.ui.advance();
  G.ui.tick(dt);
  const running = !G.paused && !G.ui.modal;
  if (running) step(dt);
  if (!cam0 || running || G.ui.modal === "dialog") { updateCamera(running ? dt : 0.0001); cam0 = true; }
  lighting();
  G.world.update(dt, G.time, camera, P);
  fireflies.position.set(P.x, G.world.height(P.x, P.z), P.z);
  fireflies.material.opacity = G.night ? 0.9 : 0;
  fireflies.rotation.y = G.time * 0.02;
  G.ui.hud();
  G.ui.minimap();
  A.music(G.time);
  draw();
}

function step(dt) {
  const P = G.player, S = G.save;
  S.played += dt;
  // time of day
  const before = G.clock;
  G.clock = (G.clock + dt / DAY) % 1;
  if (before < 0.25 && G.clock >= 0.25) { S.day++; G.ui.banner("Day " + S.day, G.world.regionAt(P.x, P.z)); }
  if (before > G.clock) { respawnCritters(); if (G.started) G.ui.toast("The sludge moon rises. The critters are back."); }
  // slow time after a perfect roll, and a tiny pause on each hit
  if (G.slowmo > 0) { G.slowmo -= dt; G.foeTime = 0.25; } else G.foeTime = 1;
  G.ui.slow(G.slowmo > 0);
  if (G.hitstop > 0) { G.hitstop -= dt; return; }
  if (inp.eat) G.eat();
  if (inp.next) G.cycleWeapon(1);
  if (inp.prev) G.cycleWeapon(-1);
  if (inp.slot >= 0 && inp.slot < G.inv.weapons.length) { G.inv.cur = inp.slot; P.setWeapon(G.inv.weapons[inp.slot].id); }
  abilities(dt);
  // interact before the hero moves, so E does not also swing
  const fishing = G.fishing.active;
  const opt = !fishing && !P.dead && !G.ui.modal && P.state !== "climb" && P.state !== "glide" ? nearest() : null;
  G.ui.prompt(opt && opt.label);
  if (opt && inp.interact) { opt.go(); inp.interact = false; }
  if (fishing) { G.fishing.update(dt, inp); inp.attack = inp.interact = false; }
  P.update(dt, inp);
  kayakStep(dt);
  for (const f of G.world.fishSpots) f.rest = Math.max(0, f.rest - dt);
  const fdt = dt * G.foeTime;
  for (const f of G.foes) {
    const d = Math.hypot(f.x - P.x, f.z - P.z);
    f.rig.root.visible = d < 240 && !f.gone;
    if (d < 170 || f.state !== "idle") f.update(fdt);
  }
  for (let i = G.foes.length - 1; i >= 0; i--) if (G.foes[i].gone && !G.plan.some((p) => p.foe === G.foes[i])) { scene.remove(G.foes[i].rig.root); G.foes.splice(i, 1); }
  for (const b of G.bosses) if (b.alive || b.rig.root.visible) b.update(dt);
  if (G.activeBoss) G.ui.boss(G.activeBoss.def.name, G.activeBoss.hp / G.activeBoss.maxHp);
  G.hazards.update(dt);
  G.fx.update(dt);
  // music follows the danger
  const fighting = G.foes.some((f) => f.alive && (f.state === "chase" || f.state === "windup" || f.state === "strike") && Math.hypot(f.x - P.x, f.z - P.z) < 40);
  A.setMood(G.activeBoss ? "boss" : fighting ? "fight" : G.night ? "night" : "day");
  // pickups
  for (const it of G.items) {
    if (it.taken) continue;
    const d = Math.hypot(it.x - P.x, it.z - P.z);
    it.obj.visible = d < 160;
    if (d > 160) continue;
    it.obj.rotation.y += dt;
    if (d < 1.6 && Math.abs(it.y - P.y) < 2.5) {
      it.taken = true; it.obj.visible = false;
      if (it.id === "heart") { P.heal(4); A.sfx("eat"); G.ui.toast("+1 heart"); }
      else { G.inv.food[it.id]++; A.sfx("pickup"); G.ui.toast("+1 " + FOOD_NAME[it.id]); }
      if (it.drop) { scene.remove(it.obj); G.items.splice(G.items.indexOf(it), 1); break; }
    }
  }
  G.loonies.forEach((l, i) => {
    if (l.kind !== "float" || S.loonies.includes(i)) { if (l.kind === "float") l.obj.visible = false; return; }
    l.obj.rotation.y += dt * 2; l.obj.position.y = l.y + Math.sin(G.time * 2 + i) * 0.2;
    if (Math.hypot(l.x - P.x, l.z - P.z) < 1.6 && Math.abs(l.y - P.y - 0.8) < 2.2) { S.loonies.push(i); l.obj.visible = false; G.fx.puff(l.x, l.y, l.z, 0xffd84a, 14); foundLoonie(); }
  });
  // sludge burns
  if (!S.done) for (const s of G.world.sludge) if (Math.hypot(s.x - P.x, s.z - P.z) < s.r * 0.9 && P.state === "ground" && P.invuln <= 0) P.hurt(1, s.x, s.z, 5);
  // outhouses, found as you get close
  for (const s of G.world.shrines) {
    if (!S.seen.includes(s.id) && Math.hypot(s.x - P.x, s.z - P.z) < 70) { S.seen.push(s.id); G.ui.toast("Found the " + s.name); }
    s.obj.userData.ring.rotation.z += dt; s.obj.userData.ring.position.y = 5 + Math.sin(G.time * 2 + s.id) * 0.3;
  }
  if (G.trial && Math.hypot(G.trial.s.x - P.x, G.trial.s.z - P.z) > 70) { G.trial.foes.forEach((f) => { if (f.alive) { f.alive = false; f.gone = true; f.rig.root.visible = false; } }); G.trial = null; G.ui.toast("You left the trial"); }
  // the crew watches you
  for (const n of G.npcs) {
    const d = Math.hypot(n.x - P.x, n.z - P.z);
    const want = d < 8 ? Math.atan2(P.x - n.x, P.z - n.z) : n.yaw0;
    n.rig.root.rotation.y += Math.atan2(Math.sin(want - n.rig.root.rotation.y), Math.cos(want - n.rig.root.rotation.y)) * Math.min(1, dt * 4);
    n.rig.body.position.y = Math.sin(G.time * 2 + n.i) * 0.02;
    n.rig.arms[0].rotation.z = -0.18 + Math.sin(G.time * 1.3 + n.i) * 0.05;
    if (n.rig.apply) n.rig.apply(dt, 8);
  }
  G.world.statueObj.userData.orb.visible = S.orbs >= 4;
  // skeeters come out at night near the water
  skeeterT -= dt;
  if (G.night && skeeterT <= 0) {
    skeeterT = 6;
    const n = G.foes.filter((f) => f.type === "skeeter" && f.alive).length;
    const a = Math.random() * 6.28, x = P.x + Math.cos(a) * 25, z = P.z + Math.sin(a) * 25, h = G.world.height(x, z);
    if (n < 5 && h > 0.5 && h < 10) G.spawnFoe("skeeter", x, z);
  }
  if (!G.night) for (const f of G.foes) if (f.type === "skeeter" && f.alive && Math.hypot(f.x - P.x, f.z - P.z) > 30) { f.alive = false; f.gone = true; }
  // region names, like a new page in the story
  regionT -= dt;
  if (regionT <= 0) {
    regionT = 0.6;
    const r = G.world.regionAt(P.x, P.z);
    if (r !== G.region) { G.regionNext = G.regionNext === r ? r : r; G.regionCount = (G.regionNext === r ? (G.regionCount || 0) + 1 : 0); if (G.regionCount >= 3) { G.region = r; G.ui.banner(r, ""); G.regionCount = 0; } }
    else G.regionCount = 0;
  }
  saveT += dt;
  if (saveT > 10 && !G.activeBoss && !G.trial && !P.dead) { saveT = 0; G.writeSave(); }
}

// the kayak floats where you left it; it drifts home to the cottage dock once you are far away
function kayakStep(dt) {
  const K = G.world.kayak, P = G.player;
  if (!K) return;
  if (!K.rider && Math.hypot(K.x - P.x, K.z - P.z) > 150 && (K.x !== K.home.x || K.z !== K.home.z)) { K.x = K.home.x; K.z = K.home.z; K.yaw = K.home.yaw; }
  const o = K.obj;
  o.position.set(K.x, K.rider ? P.y : Math.sin(G.time * 1.5) * 0.05, K.z);
  o.rotation.y = K.yaw;
  o.rotation.z = K.rider ? -(P.turnLean || 0) * 0.04 + Math.sin(G.time * 1.3) * 0.02 : Math.sin(G.time * 1.1) * 0.03;
  o.rotation.x = K.rider ? -Math.min(0.06, Math.abs(P.kSpeed || 0) * 0.006) : 0;
  // a little wake behind the stern
  if (K.rider && Math.abs(P.kSpeed || 0) > 2 && Math.random() < dt * 8) G.fx.puff(K.x - Math.sin(K.yaw) * 2.3, 0.05, K.z - Math.cos(K.yaw) * 2.3, 0xffffff, 2);
  void dt;
}

function abilities(dt) {
  const Ab = G.abilities, P = G.player;
  if (Ab.grit) { if (Ab.grit.charges === 0) { Ab.grit.cd -= dt; if (Ab.grit.cd <= 0) { Ab.grit.charges = 3; Ab.grit.cd = 0; } } }
  if (Ab.lift) { Ab.lift.cd = Math.max(0, Ab.lift.cd - dt); if (inp.lift && Ab.lift.cd <= 0 && !P.dead && P.state !== "climb" && P.state !== "kayak" && !P.fishing) { Ab.lift.cd = 25; P.vel.y = 27; P.state = "air"; P.airT = 0.2; P.rig.glider.visible = false; A.sfx("lift"); G.fx.puff(P.x, P.y + 0.5, P.z, 0xdff4ff, 24); } }
  if (Ab.fury) {
    Ab.fury.cd = Math.max(0, Ab.fury.cd - dt);
    if (inp.fury && Ab.fury.cd <= 0 && !P.dead) {
      Ab.fury.cd = 40; A.sfx("fury"); G.shake(0.6);
      G.hazards.ring(P.x, P.z, { dmg: 0, max: 10, speed: 30, color: 0x9ae8ff });
      G.hazards.rings[G.hazards.rings.length - 1].hit = true;
      for (const f of targets()) if (Math.hypot(f.x - P.x, f.z - P.z) < 10) {
        f.hurt(22, P.x, P.z, 8, true);
        const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.3, 40, 5), new THREE.MeshBasicMaterial({ color: 0xdff8ff }));
        bolt.position.set(f.x, (f.pos ? f.pos.y : P.y) + 20, f.z); scene.add(bolt); setTimeout(() => scene.remove(bolt), 250);
      }
    }
  }
}
