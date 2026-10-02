// The story on a phone (844x390, touch), driven by real touch events sent through the DevTools protocol:
// 1. The left thumb stick moves the hero; a drag on the right turns the camera.
// 2. USE shows only with a prompt; next to the van it reads GET, and a tap on it gets in.
// 3. The drive layer: GAS moves the van, the steer slider turns it, BRAKE stops it, EXIT gets out.
// 4. A free tap is a light attack only with an enemy within 12 m (one at 15 m is left alone); an enemy within
//    20 m brings the combat set, never more than 7 action buttons.
// 5. A pinch zooms the phone camera's viewfinder.
// 6. Hiding the page opens the story menu; a tap on SAVE & QUIT returns to the title with CONTINUE.
// No page errors.
import { open, step, stepUntil, finish, freeRoam } from "./lib.mjs";

const fails = [];
const check = (ok, msg) => { if (ok) console.log("ok   " + msg); else { console.log("FAIL " + msg); fails.push(msg); } };
const W = 844, H = 390;
const { browser, page, errors } = await open({ query: "?chapter=f1&seed=7&nomusic&q=2", width: W, height: H, touch: true });
const cdp = await page.context().newCDPSession(page);
const T = (fn, arg) => page.evaluate(fn, arg);
// fingers: {id: [x, y]}; every call sends the whole set that is down
const down = new Map();
const send = (type) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" || type === "touchCancel" ? [] : [...down].map(([id, [x, y]]) => ({ x, y, id, radiusX: 4, radiusY: 4, force: 1 })) });
const press = async (id, x, y) => { down.set(id, [x, y]); await send("touchStart"); };
const drag = async (id, x, y, n = 5) => { const [x0, y0] = down.get(id); for (let k = 1; k <= n; k++) { down.set(id, [x0 + (x - x0) * k / n, y0 + (y - y0) * k / n]); await send("touchMove"); } };
const liftAll = async () => { down.clear(); await send("touchEnd"); };
const tap = async (x, y) => { await press(99, x, y); await liftAll(); };
const center = (sel) => T((s) => { const r = document.querySelector(s).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, sel);
const buttons = () => T(() => __crimson.story.S.test.ui.touchButtons);

const r = await stepUntil(page, () => __crimson.story && __crimson.story.chapter === "f1" && __crimson.story.mode === "play" && !__crimson.story.S.test.ui.card, { maxSec: 60 });
check(r.ok, "the story reaches f1 on a phone");
check((await freeRoam(page)).ok, "free roam: F1's mission quit, nothing modal");
await step(page, 0.3);
check(await T(() => document.body.classList.contains("touch") && __crimson.story.S.test.ui.visible("stouch")), "the story's touch layer shows");

/* ---------------- 1: the stick and the camera ---------------- */
let p0 = await T(() => __crimson.story.S.hero.pos.toArray());
await press(1, 150, 300);
await drag(1, 150, 240);
await step(page, 1);
let p1 = await T(() => __crimson.story.S.hero.pos.toArray());
await liftAll(); await step(page, 0.1);
const moved = Math.hypot(p1[0] - p0[0], p1[2] - p0[2]);
check(moved > 1.2, `the stick moves the hero (${moved.toFixed(2)} m in 1 s)`);
const d0 = await T(() => { const v = new __crimson.story.S.THREE.Vector3(); __crimson.story.S.camera.getWorldDirection(v); return Math.atan2(v.x, v.z); });
await press(2, 620, 160);
await drag(2, 500, 160, 6);
await step(page, 0.3);
await liftAll(); await step(page, 0.5);
const d1 = await T(() => { const v = new __crimson.story.S.THREE.Vector3(); __crimson.story.S.camera.getWorldDirection(v); return Math.atan2(v.x, v.z); });
const turn = Math.abs(Math.atan2(Math.sin(d1 - d0), Math.cos(d1 - d0)));
check(turn > 0.15, `a drag on the right turns the camera (${turn.toFixed(2)} rad)`);

/* ---------------- 2: USE only with a prompt ---------------- */
// The rental cars now have entry prompts; test empty ground away from the lot.
await T(() => __crimson.story.S.hero.place(-650, 120)); await step(page, 0.1);
let b = await buttons();
check(!b.includes("use"), `no USE without a prompt (${b.join(", ")})`);
await T(() => __crimson.story.S.ui.prompt("OPEN", "use")); await step(page, 0.1);
b = await buttons();
check(b.includes("use"), `a prompt brings USE (${b.join(", ")})`);
await T(() => __crimson.story.S.ui.prompt(null)); await step(page, 0.1);
check(!(await buttons()).includes("use"), "and it goes with the prompt");
// walk up to the van's door: the vehicle offers GET IN, and USE says so
await T(() => { const S = __crimson.story.S, v = S.vehicles.player, d = v.doorPoint("driver"); S.hero.place(d.x, d.z, 0); });
await step(page, 0.3);
const useLbl = await T(() => { const e = document.querySelector("#st_use small"); return !document.getElementById("st_use").classList.contains("hidden") ? e.textContent : null; });
check(useLbl === "GET", `by the van, USE reads GET (${useLbl})`);
const [ux, uy] = await center("#st_use");
await tap(ux, uy);
const e1 = await stepUntil(page, () => { const S = __crimson.story.S; S.ui.advanceAll(); return S.hero.mode === "drive" && S.drive.state === "riding"; }, { maxSec: 4, realMs: 0 });
check(e1.ok, "a tap on USE gets in the van");
await step(page, 0.3); await T(() => __crimson.story.S.ui.advanceAll());

/* ---------------- 3: the drive layer ---------------- */
b = await buttons();
check(await T(() => __crimson.story.S.test.ui.touchSet === "drive") && ["gas", "brake", "drift", "horn"].every((x) => b.includes(x)), `driving shows the drive layer (${b.join(", ")})`);
const yaw0 = await T(() => __crimson.story.S.vehicles.player.yaw);
const [gx, gy] = await center("#st_gas");
await press(3, gx, gy);
await step(page, 2);
let v = await T(() => ({ speed: __crimson.story.S.vehicles.player.speed, yaw: __crimson.story.S.vehicles.player.yaw }));
check(v.speed > 3, `GAS moves the van (${v.speed.toFixed(1)} m/s after 2 s)`);
const yawA = v.yaw;
// the steer slider: a finger on the left drags right
await press(4, 180, 330);
await drag(4, 290, 330, 4);
await step(page, 0.2);
const steer = await T(() => __crimson.story.S.input.axis("steer").x);
await step(page, 1.2);
v = await T(() => ({ speed: __crimson.story.S.vehicles.player.speed, yaw: __crimson.story.S.vehicles.player.yaw }));
const dyaw = Math.abs(Math.atan2(Math.sin(v.yaw - yawA), Math.cos(v.yaw - yawA)));
check(steer > 0.8 && dyaw > 0.1, `the steer slider turns the van (steer ${steer.toFixed(2)}, ${dyaw.toFixed(2)} rad)`);
await liftAll(); await step(page, 0.1);
check(await T(() => __crimson.story.S.input.axis("steer").x === 0), "the slider springs back to the middle");
const [bx, by] = await center("#st_brake");
await press(5, bx, by);
const st = await stepUntil(page, () => Math.abs(__crimson.story.S.vehicles.player.speed) < 0.5, { maxSec: 6, chunk: 0.1, realMs: 0 });
await liftAll(); await step(page, 0.3);
check(st.ok, `BRAKE stops the van (${st.sec.toFixed(1)} s)`);
b = await buttons();
check(b.includes("exit"), `EXIT shows once the van is slow (${b.join(", ")})`);
const [ex, ey] = await center("#st_exit");
await tap(ex, ey);
const out = await stepUntil(page, () => __crimson.story.S.hero.mode === "foot" && __crimson.story.S.drive.state === "foot", { maxSec: 4, realMs: 0 });
check(out.ok, "a tap on EXIT gets out");
check(Math.abs(yaw0 - v.yaw) > 0.05 || dyaw > 0.1, "the van went somewhere on its own wheels");

/* ---------------- 4: taps and the combat set ---------------- */
await step(page, 0.5);
await T(() => {
  const S = __crimson.story.S, p = S.hero.pos, f = S.hero.face, fx = Math.sin(f), fz = Math.cos(f);
  window.__far = S.combat.spawn("driver", { pos: { x: p.x + fx * 15, z: p.z + fz * 15 } });
});
await step(page, 0.2);
b = await buttons();
check(await T(() => __crimson.story.S.test.ui.touchSet === "combat") && b.length <= 7, `an enemy within 20 m brings the combat set (${b.length}: ${b.join(", ")})`);
// the hero consumes 'light' at control order 0, so watch the press just before it
await T(() => { window.__lightT = 0; __crimson.story.S.register("control", () => { if (__crimson.story.S.input.pressed("light")) window.__lightT++; }, -1); });
await tap(560, 150); await step(page, 0.2);
check(!(await T(() => window.__far.downed || window.__lightT > 0)), "a free tap with the nearest enemy 15 m away does not attack");
await T(() => { const S = __crimson.story.S, p = S.hero.pos, f = S.hero.face; window.__near = S.combat.spawn("driver", { pos: { x: p.x + Math.sin(f) * 8, z: p.z + Math.cos(f) * 8 } }); });
await step(page, 0.1);
await tap(560, 150); await step(page, 0.2);
check(await T(() => window.__lightT > 0 || window.__near.downed), "a free tap with an enemy 8 m away is a light attack");
const [cx, cy] = await center("#st_cut");
await step(page, 0.5); await T(() => { window.__lightT = 0; });
await tap(cx, cy); await step(page, 0.1);
check(await T(() => window.__lightT > 0), "CUT is a light attack");
await T(() => __crimson.story.S.combat.clear());
await step(page, 0.2);

/* ---------------- 5: the pinch ---------------- */
await T(() => {
  const S = __crimson.story.S; S.photo.open({ force: true }); S.ui.photoFrame(true, { zoom: 1 }); // (force: the real phone camera waits out the attack just thrown)
  window.__zoom = 0; S.register("camera", (c, r, raw) => { window.__zoom += S.input.axis("zoom").y * (raw || 0); });
});
await step(page, 0.2);
check(await T(() => __crimson.story.S.input.context === "photo" && __crimson.story.S.test.ui.touchSet === "photo"), "the phone camera shows the photo layer");
down.set(6, [440, 200]); down.set(7, [500, 200]); await send("touchStart");
for (let k = 1; k <= 6; k++) { down.set(6, [440 - k * 20, 200]); down.set(7, [500 + k * 20, 200]); await send("touchMove"); await step(page, 1 / 60); }
await liftAll(); await step(page, 0.1);
const zoom = await T(() => window.__zoom);
check(zoom > 0.9, `spreading two fingers zooms in (ln ${zoom.toFixed(2)}, about ${Math.exp(zoom).toFixed(1)}x)`);
await T(() => { const S = __crimson.story.S; S.ui.photoFrame(false); S.photo.close(); });
await step(page, 0.2);

/* ---------------- 6: hiding the page, SAVE & QUIT ---------------- */
await T(() => { Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" }); document.dispatchEvent(new Event("visibilitychange")); delete document.visibilityState; });
await step(page, 0.1);
check(await T(() => __crimson.story.S.ui.menu.isOpen && __crimson.story.mode === "menu"), "hiding the page opens the story menu");
check(await T(() => !__crimson.story.S.test.ui.visible("stouch")), "the touch layer steps aside for the menu");
const [qx, qy] = await center("#sMenu [data-a=quit]");
await tap(qx, qy);
await step(page, 0.3);
const t = await T(() => ({ state: __crimson.game.state, title: !document.getElementById("title").classList.contains("hidden"), cont: !document.getElementById("modeContinue").hidden, sum: document.querySelector("#modeContinue small").textContent }));
check(t.state === "title" && t.title && t.cont, `a tap on SAVE & QUIT returns to the title with CONTINUE (${t.sum})`);

await finish("touch", fails, browser, errors);
