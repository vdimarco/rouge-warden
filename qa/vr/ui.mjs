// Checks the interface under IWER (an emulated Meta Quest 3) and on a flat screen: the wrist HUD (it shows when the wrist turns
// toward the head and hides otherwise), the menu from the wrist button and from B and Y, the laser selecting buttons, blocking()
// stopping plunger fire, every option changing its setting and persisting after a reload, the fade, subtitles that follow lazily
// and are never head-locked, toasts, the stance question, the credits, the map and travel, hand mode with a poke, and the flat
// screen's DOM HUD and Esc menu.
// Run from the repo root: NODE_PATH=/opt/node22/lib/node_modules node qa/vr/ui.mjs   (SHOTS=<dir> saves pictures)
import {
  checker, watchdog, newPage, open, close, state, events, waitState, enterXR, freeze, frames, run, controller, hand, head, inputMode,
  lookQuat, axisQuat, mulQuat, shot,
} from "./lib.mjs";

const { check, done } = checker("ui");
watchdog(75 * 60 * 1000, "ui");
const near = (a, b, e = 1e-3) => Math.abs(a - b) <= e;
const step = (page, secs, dt = 1 / 30) => page.evaluate(([n, dt]) => { G.test.step(dt, n); return G.test.ui(); }, [Math.max(1, Math.round(secs / dt)), dt]);
const uiInfo = (page) => page.evaluate(() => G.test.ui());
const sub = (a, b) => [a.x - b.x, a.y - b.y, a.z - b.z];
const unit = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };
const btnOf = (u, id) => u.buttons.find((b) => b.id === id);
// The quaternion that turns +y (the top of a controller) to dir.
function upTo(dir) {
  const d = unit(dir), ax = [d[2], 0, -d[0]], l = Math.hypot(...ax);
  if (l < 1e-6) return d[1] > 0 ? [0, 0, 0, 1] : [1, 0, 0, 0];
  return axisQuat(ax, Math.acos(Math.max(-1, Math.min(1, d[1]))));
}
// Points the right controller at a point (tracking space) from a fixed spot and waits for the frames to take it.
async function aimRight(page, at, from = [0.25, 1.35, -0.3]) {
  await controller(page, "right", { pos: from, quat: lookQuat(sub(at, { x: from[0], y: from[1], z: from[2] })) });
  await frames(page, 2);
}
// One trigger pull: down, a frame, up, a frame.
async function pull(page, side = "right") {
  await controller(page, side, { trigger: 1 });
  await frames(page, 1);
  await controller(page, side, { trigger: 0 });
  await frames(page, 2);
}
const newEvents = async (page, since) => (await events(page)).filter((e) => e.frame > since);
const px = async (page, pts) => { const p = page.evaluate((q) => G.test.sample(q), pts); await frames(page, 2); return p; };

/* ================= VR with controllers ================= */
try {
  const page = await newPage({ width: 480, height: 270, clock: true });
  await open(page, "?emulate&skipintro");
  await enterXR(page, "vr");
  await waitState(page, { state: "play" }, 90000);
  await freeze(page);
  await frames(page, 2);
  const S = await page.evaluate(() => ({ ...G.city.start, ring: G.city.goldRing }));

  /* ---- the wrist HUD ---- */
  const LP = [-0.2, 1.3, -0.35], HEAD = { x: 0, y: 1.6, z: 0 };
  await controller(page, "left", { pos: LP, quat: axisQuat([1, 0, 0], Math.PI) }); // the top faces the floor
  await frames(page, 14);
  let u = await uiInfo(page);
  check(!u.hud.visible && u.hud.world === null, "the wrist HUD is hidden while the wrist faces away", u.hud);
  await controller(page, "left", { pos: LP, quat: upTo(sub(HEAD, { x: LP[0], y: LP[1], z: LP[2] })) }); // the top faces the head
  await frames(page, 14);
  u = await uiInfo(page);
  const hudPos = u.hud.local;
  check(u.hud.visible && hudPos && Math.hypot(hudPos.x - LP[0], hudPos.y - LP[1], hudPos.z - LP[2]) < 0.25, "the wrist HUD shows over the left wrist when the wrist turns toward the head", { hud: u.hud, wrist: LP });
  // The compass arrow and its ink outline stay inside the ring. The ring's inner edge is 45 px of a 512 px card that is 0.2 m wide.
  const cmp = await page.evaluate(() => {
    const m = G.scene.getObjectByName("ui:hud"), a = m && m.children.find((c) => c.userData && c.userData.ink), ink = a && a.userData.ink;
    const reach = (mesh, k) => { const q = mesh.geometry.attributes.position; let r = 0; for (let i = 0; i < q.count; i++) r = Math.max(r, Math.hypot(q.getX(i), q.getY(i))); return r * k; };
    return a ? { fill: reach(a, a.scale.x), ink: reach(ink, a.scale.x * ink.scale.x), inner: (45 * 0.2) / 512 } : null;
  });
  check(cmp && cmp.ink <= cmp.inner && cmp.fill >= cmp.inner * 0.6, "the compass arrow and its ink outline fit inside the ring, and the arrow is still big enough to read", cmp);
  const hs = await page.evaluate(() => ({ visible: G.ui.hudVisible, shown: G.ui.hudShown }));
  check(hs.visible === true && hs.shown > 0.05, "ui.hudVisible and ui.hudShown say the HUD is up (the tutorial reads them)", hs);
  check(["hud:menu"].every((id) => btnOf(u, id)) && !btnOf(u, "hud:left"), "the HUD has the round Menu button, and no turn arrows with controllers", u.buttons.map((b) => b.id));
  // for the picture: look down at the wrist, the way you do to read it
  await head(page, { quat: axisQuat([1, 0, 0], -0.55) });
  await frames(page, 6);
  await shot(page, "ui-hud");
  await head(page, { quat: [0, 0, 0, 1] });
  await frames(page, 3);
  await controller(page, "left", { pos: LP, quat: axisQuat([1, 0, 0], Math.PI) });
  await frames(page, 14);
  u = await uiInfo(page);
  check(!u.hud.visible, "the wrist HUD hides again when the wrist turns away", u.hud);

  /* ---- the wrist button opens the menu; blocking() stops plunger fire ---- */
  await controller(page, "left", { pos: LP, quat: upTo(sub(HEAD, { x: LP[0], y: LP[1], z: LP[2] })) });
  await frames(page, 8);
  u = await uiInfo(page);
  const menuBtn = btnOf(u, "hud:menu");
  await aimRight(page, menuBtn.local);
  u = await uiInfo(page);
  const blk = await page.evaluate(() => [G.ui.blocking(0), G.ui.blocking(1)]);
  check(u.hud.hover === "hud:menu" && blk[1] === true && blk[0] === false, "the other hand's aim ray lights the Menu button and blocking(1) is true", { hover: u.hud.hover, blocking: blk });
  const f0 = (await state(page)).frame;
  await controller(page, "right", { trigger: 1 });
  await frames(page, 1);
  const mid = await state(page);
  await controller(page, "right", { trigger: 0 });
  await frames(page, 3);
  const evA = await newEvents(page, f0);
  const st1 = await state(page);
  check(!evA.some((e) => e.type === "fire" || e.type === "dry") && mid.state === "play", "a trigger pull on the HUD fires no plunger", evA.map((e) => e.type));
  check(st1.paused && st1.state === "paused", "the wrist Menu button opens the pause menu (menuDown)", st1.state);
  await controller(page, "left", { pos: LP, quat: axisQuat([1, 0, 0], Math.PI) });
  // B and Y: close then open the menu with each
  await controller(page, "right", { buttons: { "b-button": 1 } });
  await frames(page, 1);
  const pB = await state(page);
  await controller(page, "right", { buttons: { "b-button": 0 } });
  await frames(page, 2);
  await controller(page, "left", { buttons: { "y-button": 1 } });
  await frames(page, 1);
  const pY = await state(page);
  await controller(page, "left", { buttons: { "y-button": 0 } });
  await frames(page, 2);
  check(!pB.paused && pY.paused, "B closes the menu and Y opens it again", { B: pB.state, Y: pY.state });

  /* ---- the laser selects buttons ---- */
  u = await uiInfo(page);
  check(u.paused && u.panel === "pause" && ["resume", "map", "comfort", "sound", "music", "reset", "exit"].every((id) => btnOf(u, id)) && !btnOf(u, "scan"), "the pause menu has Resume, Map, Comfort, Sound, Music, Reset progress and Exit (no room scan in VR)", u.buttons.map((b) => b.id));
  const lbl = u.buttons.find((b) => b.id === "reset");
  check(lbl && /reset progress/i.test(lbl.label), "the reset button says Reset progress (privacy.html refers to it)", lbl);
  await aimRight(page, btnOf(u, "comfort").local);
  u = await uiInfo(page);
  check(u.laser.visible && u.laser.side === 1, "the laser shows from the right hand while a panel is open", u.laser);
  await shot(page, "ui-pause");
  await pull(page);
  u = await uiInfo(page);
  check(u.panel === "comfort", "pulling the trigger on Comfort opens the comfort page", u.panel);
  const ids = u.buttons.map((b) => b.id);
  check(["preset:comfortable", "vignette:high", "turn:30", "turn:smooth", "aim:high", "hand:left", "hold:toggle", "hz:90", "seated:on", "calibrate", "back"].every((i) => ids.includes(i)) && !ids.includes("look:room"), "the comfort page has every option (no vignette look in VR)", ids);
  await shot(page, "ui-comfort");
  await aimRight(page, btnOf(u, "vignette:high").local);
  await pull(page);
  check((await page.evaluate(() => G.settings.vignette)) === "high", "the laser picks Vignette: High", await page.evaluate(() => G.settings.vignette));
  u = await uiInfo(page);
  await aimRight(page, btnOf(u, "back").local);
  await pull(page);
  u = await uiInfo(page);
  await aimRight(page, btnOf(u, "resume").local);
  const bk = await page.evaluate(() => G.ui.blocking(1));
  await pull(page);
  const rs = await state(page);
  check(u.panel === "pause" && bk === true && !rs.paused && rs.state === "play", "Back returns to the pause page and Resume plays on", { panel: u.panel, state: rs.state });
  const bk2 = await page.evaluate(() => [G.ui.blocking(0), G.ui.blocking(1)]);
  check(bk2[0] === false && bk2[1] === false, "blocking() is false again once the panel is closed", bk2);

  /* ---- blocking: a pull at a building fires, a pull at the HUD does not ---- */
  await page.evaluate((S) => G.test.teleport(S.x, S.y, S.z), S);
  await frames(page, 3);
  const cpos = [0.25, 1.35, -0.3];
  const cw = await page.evaluate((c) => G.test.toWorld(c[0], c[1], c[2]), cpos);
  const rd = sub(S.ring, cw), rl = Math.hypot(...rd);
  const target = { x: S.ring.x + (rd[0] / rl) * 0.5, y: S.ring.y + (rd[1] / rl) * 0.5, z: S.ring.z + (rd[2] / rl) * 0.5 };
  const tl = await page.evaluate((t) => G.test.toLocal(t.x, t.y, t.z), target);
  await controller(page, "left", { pos: LP, quat: upTo(sub(HEAD, { x: LP[0], y: LP[1], z: LP[2] })) });
  await frames(page, 8);
  u = await uiInfo(page);
  await aimRight(page, btnOf(u, "hud:menu").local, cpos);
  const f1 = (await state(page)).frame;
  await controller(page, "right", { trigger: 1 });
  await frames(page, 12);
  const noFire = (await newEvents(page, f1)).filter((e) => e.type === "fire" || e.type === "dry" || e.type === "attach");
  await controller(page, "right", { trigger: 0 });
  await frames(page, 3);
  await page.evaluate(() => { if (G.ui.paused) G.ui.closePause(); });
  await frames(page, 2);
  await controller(page, "left", { pos: LP, quat: axisQuat([1, 0, 0], Math.PI) });
  await controller(page, "right", { pos: cpos, quat: lookQuat(sub(tl, { x: cpos[0], y: cpos[1], z: cpos[2] })) });
  await frames(page, 4);
  const f2 = (await state(page)).frame;
  await controller(page, "right", { trigger: 1 });
  for (let i = 0; i < 40 && (await state(page)).ropes[1].state !== "attached"; i++) await frames(page, 1);
  const fired = (await newEvents(page, f2)).filter((e) => e.type === "fire");
  check(noFire.length === 0 && fired.length === 1, "blocking(): a pull while the ray is on the HUD fires nothing, a pull at the building fires", { onHud: noFire.map((e) => e.type), onBuilding: fired.length });
  await controller(page, "right", { trigger: 0 });
  await frames(page, 3);
  await page.evaluate((S) => G.test.teleport(S.x, S.y, S.z), S);
  await frames(page, 3);

  /* ---- the fade ---- */
  const at0 = await px(page, { c: [0.5, 0.5] });
  await page.evaluate(() => { G.ui.fade(1, 0.2, "black"); });
  await frames(page, 20);
  const f = await uiInfo(page);
  const at1 = await px(page, { c: [0.5, 0.5], e: [0.1, 0.1] });
  check(f.fade.value === 1 && f.fade.visible && at1.c[0] < 40 && at1.c[1] < 40 && at1.c[2] < 40 && at1.e[0] < 40, "ui.fade(1, 0.2, \"black\") covers the whole view with black", { fade: f.fade, c: at1.c, e: at1.e, before: at0.c });
  await page.evaluate(() => { G.ui.fade(1, 0, "fog"); });
  await frames(page, 2);
  const at2 = await px(page, { c: [0.5, 0.5] });
  check(Math.abs(at2.c[0] - 232) < 10 && Math.abs(at2.c[1] - 160) < 10 && Math.abs(at2.c[2] - 112) < 10, "the look \"fog\" fades to the fog colour", at2.c);
  await page.evaluate(() => { G.ui.fade(1, 0, "room"); });
  await frames(page, 2);
  const f3 = await uiInfo(page);
  check(f3.fade.look === "black", "in VR the look \"room\" falls back to black", f3.fade);
  const pr = await page.evaluate(() => { const p = G.ui.fade(0, 0.1, "black"); return p instanceof Promise; });
  await frames(page, 10);
  const at3 = await px(page, { c: [0.5, 0.5] });
  check(pr && (await uiInfo(page)).fade.value === 0 && at3.c[0] + at3.c[1] + at3.c[2] > 60, "fade(0) returns a promise and clears the view", at3.c);

  /* ---- subtitles: 1.4 m ahead, 12 degrees below eye level, never head-locked ---- */
  await page.evaluate(() => G.ui.say("Look at this line.", 60));
  await frames(page, 12);
  u = await uiInfo(page);
  const hd = await page.evaluate(() => G.test.state().head);
  const sp0 = u.subtitle.world;
  const dxz = Math.hypot(sp0.x - hd.x, sp0.z - hd.z), dy = hd.y - sp0.y, dist = Math.hypot(dxz, dy), drop = (Math.asin(dy / dist) * 180) / Math.PI;
  check(u.subtitle.active && u.subtitle.text === "Look at this line." && near(dist, 1.4, 0.03) && near(drop, 12, 1), "a subtitle floats 1.4 m ahead and 12 degrees below eye level", { dist, drop, sp0 });
  await shot(page, "ui-subtitle");
  // turn the head 15 degrees: the text stays where it was in the room
  await head(page, { quat: axisQuat([0, 1, 0], 0.26) });
  await frames(page, 6);
  u = await uiInfo(page);
  const sp1 = u.subtitle.world;
  check(Math.hypot(sp1.x - sp0.x, sp1.y - sp0.y, sp1.z - sp0.z) < 0.02, "turning the head 15 degrees does not drag the subtitle along (never head-locked)", { before: sp0, after: sp1 });
  // walk half a metre: the text keeps its distance and height
  await head(page, { pos: [0.5, 1.6, 0] });
  await frames(page, 6);
  u = await uiInfo(page);
  const hd2 = await page.evaluate(() => G.test.state().head), sp2 = u.subtitle.world;
  check(near(Math.hypot(sp2.x - hd2.x, sp2.z - hd2.z), Math.hypot(sp0.x - hd.x, sp0.z - hd.z), 0.03), "the text keeps its distance when you move", { d0: dxz, d2: Math.hypot(sp2.x - hd2.x, sp2.z - hd2.z) });
  // look well away: it catches up, lazily
  await head(page, { pos: [0, 1.6, 0], quat: axisQuat([0, 1, 0], 1.2) });
  await frames(page, 6);
  const early = (await uiInfo(page)).subtitle;
  await frames(page, 90);
  const late = (await uiInfo(page)).subtitle;
  check(Math.abs(late.yaw - early.yaw) > 0.3, "when you look well away the subtitle follows, slowly", { early: early.yaw, late: late.yaw });
  await head(page, { quat: [0, 0, 0, 1] });
  await frames(page, 4);
  await page.evaluate(() => G.ui.say("", 0));

  /* ---- sayLine picks the words by input kind, toasts ---- */
  const lines = await page.evaluate(() => { const r = []; for (const k of ["controller", "hand", "mouse"]) { G.ui.sayLine("intro", 2, k); r.push(G.test.ui().subtitle.text); } return r; });
  check(lines[0] === "Shoot the crack. Hold the trigger." && lines[1] === "Pinch at the crack. Keep pinching." && lines[2] === "Aim at the crack. Hold the left mouse button.", "sayLine(group, i, kind) uses LINES, LINES_HANDS and LINES_DESKTOP", lines);
  await page.evaluate(() => { G.ui.toast("5 Loonies"); });
  await frames(page, 4);
  u = await uiInfo(page);
  check(u.toast.text === "5 Loonies" && u.toast.active, "a toast shows", u.toast);
  // The four unlock toasts run to two lines in the Bangers lettering. The caption box, with its ink border and its drop shadow, has to
  // sit inside the panel's canvas: the top and the bottom row of the centre column stay clear.
  await page.evaluate(() => G.test.hold(true));
  await step(page, 3);
  const fits = [];
  for (const text of ["Loonie bank 30. Your ropes have a gold stripe.", "Loonie bank 60. Your plunger cups are gold.", "Loonie bank 100. You have the Golden Plunger.", "Loonie bank 140. Every flush has fireworks.", "5 Loonies"]) {
    await page.evaluate((t) => G.ui.toast(t), text);
    await step(page, 0.5);
    fits.push({ text, ...(await page.evaluate(() => {
      // read a copy: a readback on the panel's own canvas makes Chrome warn about willReadFrequently
      const cv = G.scene.getObjectByName("ui:toast").material.map.image, cp = document.createElement("canvas");
      cp.width = cv.width; cp.height = cv.height;
      const cx = cp.getContext("2d", { willReadFrequently: true });
      cx.drawImage(cv, 0, 0);
      const col = cx.getImageData(Math.floor(cv.width / 2), 0, 1, cv.height).data;
      let first = -1, last = -1;
      for (let y = 0; y < cv.height; y++) if (col[y * 4 + 3] > 8) { if (first < 0) first = y; last = y; }
      return { h: cv.height, first, last };
    })) });
    await step(page, 2.6);
  }
  await page.evaluate(() => G.test.hold(false));
  check(fits.every((f) => f.first > 0 && f.last < f.h - 1), "a toast's caption box, border and shadow fit inside its canvas (the two-line unlock toasts too)", fits);

  /* ---- the credits ---- */
  await page.evaluate(() => G.ui.showCredits());
  await frames(page, 3);
  u = await uiInfo(page);
  check(u.panel === "credits" && btnOf(u, "credits:arcade") && /back to the arcade/i.test(btnOf(u, "credits:arcade").label) && btnOf(u, "credits:keep"), "the credits panel has the crew and \"Back to the arcade\"", u.buttons.map((b) => b.label));
  await shot(page, "ui-credits");
  await page.evaluate(() => G.test.uiPress("credits:keep"));
  await frames(page, 2);
  check((await uiInfo(page)).panel === null, "Keep swinging closes the credits", (await uiInfo(page)).panel);

  /* ---- the map in VR ---- */
  await page.evaluate(() => { G.test.teleport(-300, 0, 100); });
  await frames(page, 3);
  await page.evaluate(() => G.ui.openMap());
  await frames(page, 4);
  u = await uiInfo(page);
  const wv = await page.evaluate(() => ({ view: G.view.root.visible, game: G.game.root.visible, state: G.test.state().state, clear: G.renderer.getClearColor(new (G.camera.position.constructor)()).getHex ? 0 : 0 }));
  check(u.map.open && u.paused && !wv.view && !wv.game && wv.state === "paused" && u.map.pins > 10, "the map hides the world and stands the city on a plinth", { map: u.map, wv });
  const pinStart = btnOf(u, "pin:start");
  check(!!pinStart, "the start roof is a pin you can pick", u.buttons.map((b) => b.id));
  await frames(page, 2);
  await shot(page, "ui-map");
  // the beam snaps to a pin within 3 cm and lets go beyond
  const off = (d) => [pinStart.local.x + d, pinStart.local.y, pinStart.local.z];
  await aimRight(page, { x: off(0.02)[0], y: off(0)[1], z: off(0)[2] }, [0.1, 1.2, -0.3]);
  const hv1 = (await uiInfo(page)).map.hover;
  await aimRight(page, { x: off(0.08)[0], y: off(0)[1], z: off(0)[2] }, [0.1, 1.2, -0.3]);
  const hv2 = (await uiInfo(page)).map.hover;
  check(hv1 >= 0 && hv2 === -1, "the laser snaps to a pin within 3 cm and not at 8 cm", { at2cm: hv1, at8cm: hv2 });
  await aimRight(page, pinStart.local, [0.1, 1.2, -0.3]);
  await pull(page);
  await run(page, 700);
  await frames(page, 30);
  const tv = await state(page);
  check(tv.state === "play" && Math.hypot(tv.pos.x - S.x, tv.pos.z - S.z) < 0.5 && near(tv.pos.y, S.y, 0.05), "pulling the trigger on a pin travels there", { state: tv.state, pos: tv.pos });
  check((await page.evaluate(() => G.view.root.visible)), "the city is back after the trip");

  /* ---- hand mode: the palm-up wrist shows the HUD, the other index tip pokes Menu ---- */
  await inputMode(page, "hand");
  await frames(page, 4);
  await hand(page, "left", { pos: [-0.2, 1.3, -0.35], quat: mulQuat(axisQuat([1, 0, 0], 1.1), axisQuat([0, 0, 1], Math.PI)) });
  await frames(page, 8);
  u = await uiInfo(page);
  const lp = (await page.evaluate(() => G.test.input())).hands[0];
  check(lp.palmUp && u.hud.visible, "in hand mode the HUD shows when the palm faces the head", { palmUp: lp.palmUp, hud: u.hud });
  check(btnOf(u, "hud:left") && btnOf(u, "hud:right") && btnOf(u, "hud:menu"), "hand mode adds the turn arrows to the HUD", u.buttons.map((b) => b.id));
  await shot(page, "ui-hud-hands");
  // the tip's offset from the hand's own origin (the pose stays the same), so the tip can be placed exactly
  const menuH = btnOf(u, "hud:menu").local, nrm = unit(sub(HEAD, menuH)), P0 = [0.25, 1.3, -0.3];
  await hand(page, "right", { pos: P0, pose: "point" });
  await frames(page, 3);
  const tip0 = (await page.evaluate(() => G.test.input())).hands[1].joints;
  const off0 = [tip0[36] - P0[0], tip0[37] - P0[1], tip0[38] - P0[2]];
  const at = (k) => [menuH.x + nrm[0] * k - off0[0], menuH.y + nrm[1] * k - off0[1], menuH.z + nrm[2] * k - off0[2]];
  await hand(page, "right", { pos: at(0.07), pose: "point" });
  await frames(page, 4);
  const before = await state(page);
  await hand(page, "right", { pos: at(-0.005), pose: "point" });
  await frames(page, 4);
  const after = await state(page);
  check(!before.paused && after.paused, "poking Menu with the other index finger opens the pause menu", { before: before.state, after: after.state });
  await hand(page, "right", { pos: [0.25, 1.3, -0.3], pose: "default" });
  await hand(page, "left", { quat: [0, 0, 0, 1] });
  await inputMode(page, "controller");
  await frames(page, 4);
  await page.evaluate(() => { if (G.ui.paused) G.ui.closePause(); });
  await frames(page, 2);

  /* ---- every option changes its setting, and they persist after a reload ---- */
  await page.evaluate(() => G.ui.openPause());
  await frames(page, 2);
  const O = [
    ["preset:comfortable", (s) => s.preset === "comfortable" && s.vignette === "high" && s.turn === "snap" && s.aim === "high"],
    ["preset:intense", (s) => s.preset === "intense" && s.turn === "smooth" && s.vignette === "off"],
    ["preset:moderate", (s) => s.preset === "moderate" && s.vignette === "med"],
    ["vignette:off", (s) => s.vignette === "off"], ["vignette:low", (s) => s.vignette === "low"], ["vignette:med", (s) => s.vignette === "med"], ["vignette:high", (s) => s.vignette === "high"],
    ["look:black", (s) => s.vignetteLook === "black"], ["look:room", (s) => s.vignetteLook === "room"],
    ["turn:30", (s) => s.turn === "snap" && s.snap === 30], ["turn:45", (s) => s.turn === "snap" && s.snap === 45], ["turn:90", (s) => s.turn === "snap" && s.snap === 90], ["turn:smooth", (s) => s.turn === "smooth"],
    ["aim:low", (s) => s.aim === "low"], ["aim:med", (s) => s.aim === "med"], ["aim:high", (s) => s.aim === "high"],
    ["hand:left", (s) => s.hand === "left"], ["hand:right", (s) => s.hand === "right"],
    ["hold:toggle", (s) => s.hold === "toggle"], ["hold:hold", (s) => s.hold === "hold"],
    ["hz:90", (s) => s.hz === 90], ["hz:72", (s) => s.hz === 72],
    ["seated:on", (s) => s.seated === true && s.height > 0], ["seated:off", (s) => s.seated === false],
    ["calibrate", (s) => s.height > 1.3],
  ];
  const bad = [];
  for (const [id, ok] of O) {
    await page.evaluate((i) => G.test.uiPress(i), id);
    const s = await page.evaluate(() => ({ ...G.settings }));
    if (!ok(s)) bad.push([id, JSON.stringify(s)]);
  }
  check(bad.length === 0, "every option in the comfort page changes its setting (" + O.length + " checked)", bad);
  const caps = await page.evaluate(() => { G.test.uiPress("preset:comfortable"); const a = { cap: G.P.speedCap, fall: G.P.fallCap }; G.test.uiPress("preset:intense"); const b = { cap: G.P.speedCap, fall: G.P.fallCap }; G.test.uiPress("preset:moderate"); return [a, b, { cap: G.P.speedCap }]; });
  check(caps[0].cap === 20 && caps[0].fall === 14 && caps[1].cap === 35 && caps[2].cap === 26, "a preset also sets the body's speed caps", caps);
  const hz = await page.evaluate(() => { G.test.uiPress("hz:90"); return G.xr.requestedFrameRate; });
  check(hz === 90, "the 90 Hz option asks the session for 90 Hz", hz);
  const snd = await page.evaluate(() => { const a = G.audio.isOn, m = G.audio.musicOn; G.test.uiPress("sound"); const a2 = G.audio.isOn; G.test.uiPress("music"); const m2 = G.audio.musicOn; return { a, a2, m, m2, ss: G.settings.sound, sm: G.settings.music }; });
  check(snd.a !== snd.a2 && snd.m !== snd.m2 && snd.sm === snd.m2, "Sound toggles the sound and Music toggles the music (and saves it)", snd);
  // the final, non-default values
  for (const id of ["preset:comfortable", "vignette:low", "look:black", "turn:30", "aim:high", "hand:left", "hold:toggle", "hz:90"]) await page.evaluate((i) => G.test.uiPress(i), id);
  const want = await page.evaluate(() => JSON.parse(JSON.stringify(G.settings)));
  await page.evaluate(() => G.test.uiPress("resume"));
  await frames(page, 2);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("plungerd.vr.v1")).settings);
  check(saved.preset === "comfortable" && saved.vignette === "low" && saved.vignetteLook === "black" && saved.snap === 30 && saved.aim === "high" && saved.hand === "left" && saved.hold === "toggle" && saved.hz === 90, "the options are written to the save at once", saved);
  await page.clock.resume().catch(() => {});
  await page.reload();
  await page.waitForFunction(() => window.G && window.G.ready, null, { timeout: 180000, polling: 100 });
  const re = await page.evaluate(() => ({ ...G.settings }));
  check(re.preset === want.preset && re.vignette === "low" && re.vignetteLook === "black" && re.turn === "snap" && re.snap === 30 && re.aim === "high" && re.hand === "left" && re.hold === "toggle" && re.hz === 90 && re.music === want.music, "the options persist after a reload", { want, got: re });
  check(page.errors.length === 0, "no page errors in the VR run", page.errors);
  await page.context().close();
} catch (e) { check(false, "the VR run threw", e.stack || String(e)); }

/* ================= the stance question ================= */
try {
  const page = await newPage({ width: 320, height: 180, clock: true });
  await page.addInitScript(() => {});
  await open(page, "?emulate");
  await head(page, { pos: [0, 1.1, 0] });
  await enterXR(page, "vr");
  await freeze(page);
  await frames(page, 3);
  await page.evaluate(() => G.test.hold(true));
  await step(page, 0.4);
  let u = await uiInfo(page);
  check(u.panel === "stance" && u.stance.on && u.stance.pre === "seated" && btnOf(u, "stance:seated"), "askStance preselects Seated for a head at 1.1 m", u.stance);
  await shot(page, "ui-stance");
  await step(page, 6.5);
  await step(page, 0.4);
  u = await uiInfo(page);
  const set = await page.evaluate(() => ({ seated: G.settings.seated, height: G.settings.height, off: G.comfort.seatedOffset, chest: G.P.chest, stance: G.settings.stance, phase: G.test.portal().phase }));
  check(u.panel === null && set.seated === true && near(set.height, 1.1, 0.02) && near(set.off, 0.55, 0.03) && set.stance === "seated", "after 6 s it continues by itself: seated, the height calibrated, the view raised", set);
  check(set.phase !== "prep", "the opening goes on after the answer", set.phase);
  await page.context().close();

  const page2 = await newPage({ width: 320, height: 180, clock: true });
  await open(page2, "?emulate");
  await enterXR(page2, "vr");
  await freeze(page2);
  await frames(page2, 3);
  await page2.evaluate(() => G.test.hold(true));
  await step(page2, 0.4);
  u = await uiInfo(page2);
  check(u.stance.pre === "standing", "a head at 1.6 m preselects Standing", u.stance);
  await page2.evaluate(() => G.test.uiPress("stance:seated"));
  await step(page2, 0.2);
  const s2 = await page2.evaluate(() => ({ seated: G.settings.seated, off: G.comfort.seatedOffset }));
  check(s2.seated === true && s2.off < 0.1, "picking Seated with a tall head is honoured (the offset follows the real height)", s2);
  await page2.context().close();
} catch (e) { check(false, "the stance run threw", e.stack || String(e)); }

/* ================= flat screen: the DOM HUD and the Esc menu ================= */
try {
  const page = await newPage({ width: 640, height: 360 });
  await open(page, "?skipintro");
  await enterXR(page, "desktop");
  await waitState(page, { mode: "desktop", state: "play" }, 180000);
  await page.evaluate(() => { G.test.hold(true); G.test.step(1 / 60, 4); });
  const dom = await page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const hud = q("#fsHud");
    return { hud: !!hud, shown: hud && getComputedStyle(hud).display !== "none", cross: !!q(".fs-cross"), loon: q("[data-k=loon]") && q("[data-k=loon]").textContent, clog: q("[data-k=clog]") && q("[data-k=clog]").textContent, timer: q("[data-k=trialBox]") && q("[data-k=trialBox]").hidden, hearts: q("[data-k=heartBox]") && q("[data-k=heartBox]").hidden };
  });
  check(dom.hud && dom.shown && dom.cross && dom.loon === "0" && dom.clog === "0" && dom.timer && dom.hearts, "the flat screen has a DOM HUD: crosshair, Loonies, clogs (the timer and hearts wait)", dom);
  // The hero's colour map is uploaded as the model loads (renderer.initTexture) and stays uploaded. A second hero in a scene that nobody
  // draws shows what the load itself leaves on the GPU; then one draw must not upload the map again.
  const hm = await page.evaluate(async () => {
    const T = await import("three"), { createHero } = await import("./js/hero.js");
    const sc = new T.Scene(), h = createHero(sc, G.renderer), R = G.renderer;
    for (let i = 0; i < 1200 && h.model === "loading"; i++) await new Promise((r) => setTimeout(r, 50));
    const map = h.meshes.body && h.meshes.body.material.map;
    const gpu = () => { const q = map && R.properties.get(map); return q && q.__webglTexture ? q.__webglTexture : null; };
    const h0 = gpu(), n0 = R.info.memory.textures;
    h.setVisible(true);
    R.render(sc, G.camera);
    // the skinned mesh adds its bone texture on the first draw, so the texture count is not a test: the map's own GL texture is
    return { model: h.model, map: !!map, size: map && map.image ? map.image.width : 0, uploaded: !!h0, same: !!h0 && gpu() === h0, newTextures: R.info.memory.textures - n0 };
  });
  check(hm.model === "glb" && hm.map && hm.uploaded && hm.same, "the hero's colour map is on the GPU as soon as the model loads, and the first draw does not upload it again", hm);
  await page.evaluate(() => { G.test.clearClog(0); G.test.step(1 / 60, 3); });
  const clog = await page.evaluate(() => document.querySelector("[data-k=clog]").textContent);
  check(clog === "1", "the HUD counts a flushed clog", clog);
  // (the first flush ends the training, which cheers with its own toast first: toasts take turns, so wait for this one)
  await page.evaluate(() => { G.ui.say("Aim high.", 30); G.ui.toast("+5"); G.test.step(1 / 60, 30); for (let i = 0; i < 900 && document.querySelector("[data-k=toast]").textContent !== "+5"; i++) G.test.step(1 / 60, 1); G.test.step(1 / 60, 5); });
  const subd = await page.evaluate(() => ({ sub: document.querySelector("[data-k=sub]").textContent, on: document.querySelector("[data-k=sub]").classList.contains("on"), toast: document.querySelector("[data-k=toast]").textContent }));
  check(subd.sub === "Aim high." && subd.on && subd.toast === "+5", "subtitles and toasts show in the page", subd);
  await shot(page, "ui-desktop-hud");
  // sayLine reads the words for the input kind: the mouse the desktop lines, a gamepad the pad lines, a phone the phone lines, hands their own
  const kinds = await page.evaluate(async () => {
    const C = await import("./js/config.js");
    const say = (k) => G.ui.sayLine("tutorial", 3, k);
    return { mouse: say("mouse"), pad: say("pad"), touch: say("touch"), hand: say("hand"), controller: say("controller"), want: C.LINES_DESKTOP.tutorial[3], wantPad: C.LINES_PAD && C.LINES_PAD.tutorial[3], wantTouch: C.LINES_PHONE && C.LINES_PHONE.tutorial[3], wantHand: C.LINES_HANDS.tutorial[3], wantController: C.LINES.tutorial[3] };
  });
  check(kinds.mouse === kinds.want && kinds.pad === kinds.wantPad && kinds.pad !== kinds.want && kinds.touch === kinds.wantTouch && kinds.hand === kinds.wantHand && kinds.controller === kinds.wantController, "sayLine picks the lines by input kind: the mouse reads the desktop lines, a pad the pad lines, touch the touch lines", kinds);
  // config.js has the phone lines and the pad lines: the same keys, order and counts as the desktop lines (with the wall group), other
  // words, and no em dashes. The phone lines name no mouse, key, trigger, pinch or grip. The pad lines name no Shift, F, mouse button, RT or A.
  const tables = await page.evaluate(async () => {
    const C = await import("./js/config.js"), D = C.LINES_DESKTOP, keys = Object.keys(D);
    const look = (T, bad) => !T ? null : {
      keys: Object.keys(T).join() === keys.join(),
      counts: keys.every((k) => Array.isArray(T[k]) && T[k].length === D[k].length),
      own: ["intro", "tutorial"].every((k) => T[k].some((l, i) => l !== D[k][i])),
      wall: Array.isArray(T.wall) && T.wall.length === 1 && T.wall[0].length > 10,
      badWords: [].concat(...Object.values(T)).filter((l) => bad.test(l)),
      dash: [].concat(...Object.values(T)).filter((l) => /[–—]/.test(l)),
    };
    return {
      touch: look(C.LINES_PHONE, /mouse|shift|press f|\bkey\b|trigger|pinch|grip/i),
      pad: look(C.LINES_PAD, /shift|press f\b|mouse|\bRT\b|\bLT\b|press a\b|\bR2\b|\bL2\b/i),
      desk: look(D, /^$/), lineKeys: keys,
    };
  });
  const T = tables.touch, Pd = tables.pad;
  check(T && T.keys && T.counts && T.own && T.wall && T.badWords.length === 0 && T.dash.length === 0, "config.js has LINES_PHONE: the keys and order of LINES_DESKTOP (with wall), its own words for the phone, no mouse or em dash", T);
  check(Pd && Pd.keys && Pd.counts && Pd.own && Pd.wall && Pd.badWords.length === 0 && Pd.dash.length === 0 && tables.desk.dash.length === 0 && tables.lineKeys.includes("wall"), "config.js has LINES_PAD: the same keys, counts and wall group, its own words (right trigger, bumpers, sticks), no Shift, F or em dash", Pd);
  // Esc opens the menu (the game's own key), and the menu has the options
  await page.keyboard.press("Escape");
  await page.evaluate(() => G.test.step(1 / 60, 2));
  let dm = await page.evaluate(() => ({ state: G.test.state().state, open: document.querySelector("#fsMenu").open, ids: [...document.querySelectorAll("#fsMenu button[data-id]")].map((b) => b.dataset.id), info: G.test.ui() }));
  check(dm.state === "paused" && dm.open && ["resume", "map", "comfort", "sound", "music", "reset", "exit"].every((i) => dm.ids.includes(i)) && dm.info.dom, "Esc opens the pause menu on the flat screen", dm);
  await shot(page, "ui-desktop-menu");
  await page.click("#fsMenu button[data-id=comfort]");
  dm = await page.evaluate(() => ({ ids: [...document.querySelectorAll("#fsMenu button[data-id]")].map((b) => b.dataset.id), panel: G.test.ui().panel }));
  dm.text = await page.evaluate(() => document.querySelector("#fsMenu").textContent);
  check(dm.panel === "comfort" && dm.ids.includes("aim:high") && dm.ids.includes("preset:intense") && !dm.ids.includes("vignette:high"), "Comfort shows the options that make sense on a flat screen (aim assist, the headset preset)", dm);
  check(/Rope trigger/.test(dm.text) && /Release cue/.test(dm.text) && ["hold:hold", "hold:toggle", "cue:on", "cue:off"].every((i) => dm.ids.includes(i)), "the flat Comfort page shows the Rope trigger and Release cue rows", dm.ids);
  await page.click("#fsMenu button[data-id='cue:off']");
  await page.click("#fsMenu button[data-id='hold:toggle']");
  const rows = await page.evaluate(() => ({ cue: G.settings.cue, hold: G.settings.hold, savedCue: JSON.parse(localStorage.getItem("plungerd.vr.v1")).settings.cue, pressed: document.querySelector("#fsMenu button[data-id='cue:off']").getAttribute("aria-pressed") }));
  check(rows.cue === false && rows.hold === "toggle" && rows.savedCue === false && rows.pressed === "true", "the Release cue and Rope trigger rows change their settings and save them", rows);
  await page.click("#fsMenu button[data-id='cue:on']");
  await page.click("#fsMenu button[data-id='hold:hold']");
  await page.click("#fsMenu button[data-id='aim:low']");
  const aim = await page.evaluate(() => ({ aim: G.settings.aim, saved: JSON.parse(localStorage.getItem("plungerd.vr.v1")).settings.aim, pressed: document.querySelector("#fsMenu button[data-id='aim:low']").getAttribute("aria-pressed") }));
  // flat play borrows the desktop preset for the session: the save keeps the headset's own fields (medium aim assist)
  check(aim.aim === "low" && aim.saved === "med" && aim.pressed === "true", "a DOM option changes the setting and shows it picked; the save keeps the headset's own comfort fields", aim);
  await page.click("#fsMenu button[data-id=back]");
  await page.click("#fsMenu button[data-id=sound]");
  const sdm = await page.evaluate(() => ({ on: G.audio.isOn, label: document.querySelector("#fsMenu button[data-id=sound]").textContent }));
  check(/SOUND: (ON|OFF)/.test(sdm.label) && (sdm.on ? /ON/ : /OFF/).test(sdm.label), "the Sound button toggles and reads its state", sdm);
  await page.keyboard.press("Escape");
  await page.evaluate(() => G.test.step(1 / 60, 3));
  dm = await page.evaluate(() => ({ state: G.test.state().state, open: document.querySelector("#fsMenu").open }));
  check(dm.state === "play" && !dm.open, "Esc again closes it and play goes on", dm);
  // a click beside the buttons of the pause menu goes back to play, like a click on the city; a click on a button does not
  await page.keyboard.press("Escape");
  await page.evaluate(() => G.test.step(1 / 60, 2));
  const pad = await page.evaluate(() => { const r = document.querySelector("#fsMenu").getBoundingClientRect(); return { x: r.left + 6, y: r.top + 6 }; });
  await page.mouse.click(pad.x, pad.y);
  await page.evaluate(() => G.test.step(1 / 60, 3));
  dm = await page.evaluate(() => ({ state: G.test.state().state, open: document.querySelector("#fsMenu").open }));
  check(dm.state === "play" && !dm.open, "a click beside the buttons of the pause menu goes back to play", dm);
  // the map on a flat screen: pins, a list, travel
  await page.evaluate(() => { G.test.teleport(-300, 0, 100); G.ui.openMap(); G.test.step(1 / 60, 6); });
  const mp = await page.evaluate(() => ({ info: G.test.ui(), list: [...document.querySelectorAll("#fsMap button[data-id]")].map((b) => b.dataset.id), hidden: document.querySelector("#fsMap").hidden }));
  check(mp.info.map.open && !mp.hidden && mp.list.includes("pin:start") && mp.info.map.pins > 10, "the flat-screen map lists the places you can travel to", { list: mp.list, pins: mp.info.map.pins });
  await page.evaluate(() => G.test.step(1 / 60, 2));
  await shot(page, "ui-desktop-map");
  await page.click("#fsMap button[data-id='pin:start']");
  // the fade and the trip finish through promises: each one needs a turn of the event loop between steps
  for (let i = 0; i < 12; i++) await page.evaluate(() => G.test.step(1 / 30, 8));
  const tv = await page.evaluate(() => ({ st: G.test.state(), S: G.city.start }));
  check(tv.st.state === "play" && Math.hypot(tv.st.pos.x - tv.S.x, tv.st.pos.z - tv.S.z) < 0.5, "a click on a place travels there", { state: tv.st.state, pos: tv.st.pos });
  // Reset progress asks first
  await page.evaluate(() => { G.ui.openPause(); G.test.step(1 / 60, 2); });
  await page.click("#fsMenu button[data-id=reset]");
  const cf = await page.evaluate(() => ({ panel: G.test.ui().panel, ids: [...document.querySelectorAll("#fsMenu button[data-id]")].map((b) => b.dataset.id) }));
  check(cf.panel === "confirm" && cf.ids.includes("resetYes") && cf.ids.includes("resetNo"), "Reset progress asks to confirm", cf);
  await page.click("#fsMenu button[data-id=resetNo]");
  const back = await page.evaluate(() => G.test.ui().panel);
  check(back === "pause", "Cancel goes back to the menu", back);
  // Exit leaves flat play
  await page.click("#fsMenu button[data-id=exit]");
  await page.evaluate(() => G.test.step(1 / 60, 2));
  const ex = await page.evaluate(() => ({ mode: G.mode, title: !document.querySelector("#title").hidden, menu: document.querySelector("#fsMenu").open }));
  check(ex.mode === "title" && ex.title && !ex.menu, "Exit leaves flat play and shows the title", ex);
  const shown = await page.evaluate(() => getComputedStyle(document.querySelector("#fsHud")).display);
  check(shown === "none", "the DOM HUD is gone on the title", shown);
  check(page.errors.length === 0, "no page errors on the flat screen", page.errors);
  await page.context().close();
} catch (e) { check(false, "the flat-screen run threw", e.stack || String(e)); }

await close().catch(() => {});
done();
