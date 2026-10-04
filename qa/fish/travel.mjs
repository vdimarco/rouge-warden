// Travel between the places, in the real game on a phone (plan section 6, WP5):
//   1. a fresh save: no NEW badge on Places, and the locked cards show the goal
//   2. Places -> Stump Bay: the travel card, the arrival card, its Start goes to the water, and the title reads "STUMP BAY";
//      the low quality budget is met at every place
//   3. back to Loon Lake: the geometry and texture counts come back to within 5% (no leak)
//   4. the arrival card shows only once
//   5. a place that does not load: "did not load", and Loon Lake is back
// Run: cd public && python3 -m http.server 8765 &   then   node qa/fish/travel.mjs     (FISH_URL for another address)
// It needs world.setPlace and world.info().mem from world.js (WP3). Where the world has none (a worktree before the merge)
// the test puts a stand-in in its place: the screens and the flow are checked, and the budget and the leak checks are
// SKIPPED (they say so). Run against the merged tree, nothing is skipped.
import { open, until, sleep } from "./lib.mjs";

const fails = [], skipped = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); console.log((ok ? "ok   " : "FAIL ") + msg); return ok; };
const skip = (msg) => { skipped.push(msg); console.log("SKIP " + msg); };

/* ---------- 1. a fresh save ---------- */
{
  const { browser, page, errors } = await open({ query: "?debug" });
  try {
    check((await page.textContent("#tkick")) === "GET PLUNGER'D · LOON LAKE", "the title kicker reads LOON LAKE");
    check((await page.title()) === "Reel It In", "the page title is Reel It In");
    check(await page.evaluate(() => document.querySelector("#placesNew").hidden), "a fresh save has no NEW badge on Places");
    check((await page.textContent("#tbest")) === "Land a fish of 3.5 kg or more here to open Stump Bay.", "the title says how to open Stump Bay (" + JSON.stringify(await page.textContent("#tbest")) + ")");
    await page.click("#placesBtn");
    await page.waitForSelector("#places:not([hidden])");
    const cards = await page.evaluate(() => [...document.querySelectorAll("#plist .pcard")].map((c) => ({ id: c.dataset.place, state: c.dataset.state, text: c.innerText.replace(/\s+/g, " "), buttons: [...c.querySelectorAll("button")].map((b) => b.textContent + (b.disabled ? " (off)" : "")) })));
    check(cards.length === 4 && cards.map((c) => c.id).join() === "loon,stumps,river,sea", "four cards, in trail order");
    check(cards.map((c) => c.state).join() === "here,next,locked,locked", "Loon Lake is here, Stump Bay is the next lock, the others are locked (" + cards.map((c) => c.state).join() + ")");
    check(/To open: land a fish of 3\.5 kg or more at Loon Lake\./.test(cards[1].text) && /Your best there: none yet\./.test(cards[1].text), "the next locked card shows the goal and your best (" + cards[1].text + ")");
    check(/Open Stump Bay first\./.test(cards[2].text) && /Open Cedar River first\./.test(cards[3].text), "the later locked cards say which place to open first");
    check(cards[1].buttons.length === 0 && cards[2].buttons.length === 0 && cards[3].buttons.length === 0, "locked cards have no button");
    check(/Line: 10 lb line/.test(cards[0].text) && /Top fish: Muskellunge/.test(cards[0].text) && /0 of 13 found/.test(cards[0].text) && /Legend: not seen/.test(cards[0].text) && cards[0].buttons.join() === "You are here (off)", "the open card shows the line, the top fish, the count, the legend and 'You are here' (" + cards[0].text + ")");
    check(/Easy/.test(cards[0].text) && /Medium/.test(cards[1].text) && /Hard/.test(cards[2].text) && /Very hard/.test(cards[3].text), "the four levels: Easy, Medium, Hard, Very hard");
    check((await page.textContent("#pfoot")) === "Legends landed: 0 of 4", "the footer counts the legends");
    const fit = await page.evaluate(() => { const c = document.querySelector("#places .card").getBoundingClientRect(); return { top: c.top, bottom: c.bottom, h: innerHeight }; });
    check(fit.top >= 0 && fit.bottom <= fit.h, "the Places card fits a 390x844 phone (" + Math.round(fit.top) + " to " + Math.round(fit.bottom) + " of " + fit.h + ")");
    await sleep(350);
    await page.click("#places [data-close]");
    check(await page.isVisible("#title"), "Close goes back to the title");
  } catch (e) { check(false, "exception in part 1: " + (e && e.stack)); }
  check(errors.length === 0, "part 1: no page errors" + (errors.length ? ":\n" + errors.join("\n") : ""));
  await browser.close();
}

/* ---------- 2 to 5. ?open: every place is open, nothing is saved ---------- */
{
  const { browser, page, errors } = await open({ query: "?open&debug" });
  try {
    const real = await page.evaluate(() => typeof FISH.world.setPlace === "function");
    if (!real) {
      console.log("NOTE this world has no setPlace yet: a stand-in stands in (the budget and leak checks are skipped)");
      await page.evaluate(() => { FISH.world.setPlace = async () => ({ ms: 0 }); });
    }
    const info = () => page.evaluate(() => JSON.parse(JSON.stringify(FISH.world.info())));
    const settle = async () => { await sleep(600); await until(page, () => FISH.world.info().calls > 0, null, 30000); await sleep(400); };
    const kicker = () => page.textContent("#tkick");
    // Places, then "Fish here" on a card. Returns how long the travel card was up
    // (the double-tap guard ignores a click in the first 300 ms of a screen that a tap just opened: wait before each click)
    // The page itself times the travel card (a watcher on its hidden flag): a slow frame in a busy test box cannot make the
    // test miss a card that is up for only 1.2 s
    const watch = () => page.evaluate(() => {
      const el = document.querySelector("#travel");
      window.__trip = { shown: 0, gone: 0 };
      window.__tripObs && window.__tripObs.disconnect();
      window.__tripObs = new MutationObserver(() => {
        if (!el.hidden && !__trip.shown) __trip.shown = performance.now();
        if (el.hidden && __trip.shown && !__trip.gone) __trip.gone = performance.now();
      });
      window.__tripObs.observe(el, { attributes: true, attributeFilter: ["hidden"] });
    });
    const go = async (id) => {
      await sleep(350);
      await page.click("#placesBtn");
      await page.waitForSelector("#places:not([hidden])");
      await sleep(350);
      await watch();
      await page.click(`.pcard[data-place="${id}"] button`);
      await page.waitForFunction(() => window.__trip.gone > 0, null, { timeout: 60000, polling: 100 });
      const secs = await page.evaluate(() => (__trip.gone - __trip.shown) / 1000);
      const seen = await page.evaluate(() => !document.querySelector("#arrive").hidden);
      return { secs, arrival: seen };
    };
    const NAME = { stumps: "STUMP BAY", river: "CEDAR RIVER", sea: "GULL ROCK", loon: "LOON LAKE" };
    // Start on the arrival card goes to the water: free fishing at the new place (the first time after Use touch, as the
    // test has not picked motion or touch). Returns what it started; then back to the title, where the checks go on
    const start = async () => {
      await sleep(350);
      await page.click("#aStart");
      await page.waitForFunction(() => FISH.G.phase === "cast" || !document.querySelector("#setup").hidden, null, { timeout: 30000, polling: 50 });
      if (await page.isVisible("#setup")) { await sleep(350); await page.click("#useTouch"); }
      await page.waitForFunction(() => FISH.G.phase === "cast", null, { timeout: 30000, polling: 50 });
      const at = await page.evaluate(() => ({ phase: FISH.G.phase, mode: FISH.G.mode, place: FISH.place.id, hud: !document.querySelector("#hud").hidden }));
      await page.evaluate(() => FISH.toTitle());
      await page.waitForSelector("#title:not([hidden])");
      return at;
    };

    check(await page.evaluate(() => document.querySelector("#placesNew").hidden), "?open shows no NEW badge (nothing was earned)");
    const base = await info();
    console.log("     Loon Lake: " + JSON.stringify(base));
    if (real) check(base.mem && base.mem.geometries > 0 && base.mem.textures > 0, "world.info() reports mem { geometries, textures } (" + JSON.stringify(base.mem) + ")");

    // 2. Places -> Stump Bay
    await page.click("#placesBtn");
    await page.waitForSelector("#places:not([hidden])");
    const states = await page.evaluate(() => [...document.querySelectorAll("#plist .pcard")].map((c) => c.dataset.state).join());
    check(states === "here,open,open,open", "?open opens every card (" + states + ")");
    await sleep(350);
    await page.click("#places [data-close]");
    const t = await go("stumps");
    check(t.secs >= 1.15 && t.arrival, `Places -> Stump Bay: the travel card (up ${t.secs.toFixed(2)} s; the code keeps it 1.2 s) gives way to the arrival card`);
    const ar = await page.evaluate(() => ({ kick: document.querySelector("#akick").textContent, name: document.querySelector("#aname").textContent, blurb: document.querySelector("#ablurb").textContent, gear: document.querySelector("#agear").textContent, tip: document.querySelector("#atip").textContent, tipHidden: document.querySelector("#atip").hidden, go: document.querySelector("#aStart").textContent }));
    check(ar.kick === "NEW PLACE · MEDIUM" && ar.name === "Stump Bay" && /^Dead trees stand in the water/.test(ar.blurb) && ar.gear === "New gear: a heavy rod and 20 lb braid." && ar.tip === "Fish run for the stumps. Steer them out." && ar.go === "Start", "the arrival card: what kind of place, name, blurb, new gear, tip, Start (" + JSON.stringify(ar) + ")");
    const st = await start();
    check(st.phase === "cast" && st.mode === "free" && st.place === "stumps" && st.hud, "Start goes to the water: free fishing at Stump Bay (" + JSON.stringify(st) + ")");
    check((await kicker()) === "GET PLUNGER'D · STUMP BAY", "back at the title, the kicker reads STUMP BAY (" + (await kicker()) + ")");
    check(await page.evaluate(async () => (await import("/fish/js/lake.js")).currentPlace().id === "stumps" && FISH.place.id === "stumps"), "the map and the game are at Stump Bay");
    check(await page.evaluate(() => FISH.save.place === "loon"), "?open does not save the place");
    await settle();
    const budget = async (label) => {
      const i = await info();
      if (real) check(i.calls <= 22 && i.tris <= 76000, `${label}: the low budget is met (${i.calls} calls, ${i.tris} triangles: 22 and 76000 at most)`);
      else skip(`${label}: the low budget (${i.calls} calls, ${i.tris} triangles; this world has no places yet)`);
      return i;
    };
    await budget("Stump Bay");

    // the other two places, then home
    const TIP = { river: "The current runs left, toward the logjam. Cast to the right.", sea: "Some fish dive for the rocks at your feet. Hold the rod up. A giant tuna can empty your spool." };
    for (const id of ["river", "sea"]) {
      const r = await go(id);
      check(r.arrival, `${NAME[id]}: the first visit shows the arrival card`);
      // the tip says only what happens: the river runs left, to the logjam; at the wall some fish dive for the rocks
      const tip = await page.textContent("#atip");
      check(tip === TIP[id], `${NAME[id]}: the arrival tip (${tip})`);
      const s2 = await start();
      check(s2.phase === "cast" && s2.mode === "free" && s2.place === id, `${NAME[id]}: Start goes to the water (${JSON.stringify(s2)})`);
      check((await kicker()) === "GET PLUNGER'D · " + NAME[id], `the title kicker reads ${NAME[id]}`);
      await settle();
      await budget(NAME[id]);
    }
    const back = await go("loon");
    check(!back.arrival, "Loon Lake never shows an arrival card");
    await page.waitForSelector("#title:not([hidden])");
    check((await kicker()) === "GET PLUNGER'D · LOON LAKE", "the title kicker is LOON LAKE again");
    await settle();

    // 3. no leak: loon -> stumps -> river -> sea -> loon
    const after = await info();
    if (real) {
      const g = after.mem.geometries / base.mem.geometries, x = after.mem.textures / base.mem.textures;
      check(g <= 1.05 && x <= 1.05, `back at Loon Lake, geometries and textures are within 5% of the first visit (geometries ${base.mem.geometries} -> ${after.mem.geometries}, textures ${base.mem.textures} -> ${after.mem.textures})`);
    } else skip("the leak check (the memory of the first Loon Lake against the last)");

    // 4. the arrival card shows only once
    const again = await go("stumps");
    check(!again.arrival && (await page.isVisible("#title")), "the second visit to Stump Bay shows no arrival card, only the title");
    check((await kicker()) === "GET PLUNGER'D · STUMP BAY", "and the title reads STUMP BAY");
    check(await page.evaluate(() => FISH.save.seen["at.stumps"] === 1 && FISH.save.seen["at.river"] === 1 && !FISH.save.seen["at.loon"]), "the save remembers where the player has been");

    // the travel card stays up for at least 1.2 s, even when the world is quick (the stand-in and Loon Lake's rebuild are)
    const quick = await go("loon");
    check(quick.secs >= 1.15 && !quick.arrival, `the travel card stays up for 1.2 s, even when the world is quick (${quick.secs.toFixed(2)} s, to ${await page.textContent("#travelTxt")})`);

    // 5. a place that does not load
    const err = errors.length;
    await page.evaluate(() => { window.__keep = FISH.world.setPlace; FISH.world.setPlace = async () => { throw new Error("no such place (a test)"); }; });
    await sleep(350);
    await page.click("#placesBtn");
    await page.waitForSelector("#places:not([hidden])");
    await sleep(350);
    await page.click('.pcard[data-place="river"] button');
    await page.waitForSelector("#travel", { state: "hidden", timeout: 60000 });
    await page.waitForSelector("#title:not([hidden])");
    const toast = await page.evaluate(() => document.querySelector("#toast").textContent);
    check(toast === "Cedar River did not load. Back to Loon Lake.", "a place that fails to load says so (" + toast + ")");
    check(await page.evaluate(async () => FISH.place.id === "loon" && (await import("/fish/js/lake.js")).currentPlace().id === "loon"), "and Loon Lake is back, in the game and in the map");
    check((await kicker()) === "GET PLUNGER'D · LOON LAKE", "the title reads LOON LAKE");
    // the failure was logged on purpose: take it out of the error list
    errors.splice(err, errors.length - err);
    await page.evaluate(() => { FISH.world.setPlace = window.__keep; });

    // the way the tests and the merge use it: FISH.setPlace(id) is a Promise, and only opens open places
    const api = await page.evaluate(async () => {
      const ok = await FISH.setPlace("river"), at = FISH.place.id;
      const no = await FISH.setPlace("nowhere");
      const back = await FISH.setPlace("loon");
      return { ok, at, no, back, now: FISH.place.id, places: Object.keys(FISH.PLACES).join(), journey: Object.keys(FISH.JOURNEY).join() };
    });
    check(api.ok === true && api.at === "river" && api.no === false && api.back === true && api.now === "loon" && api.places === "loon,stumps,river,sea" && api.journey === "loon,stumps,river,sea", "FISH.setPlace(id) is a Promise; FISH.place, FISH.PLACES and FISH.JOURNEY are there (" + JSON.stringify(api) + ")");
    if (real) {
      const ms = await page.evaluate(async () => { const out = {}; for (const id of ["stumps", "river", "sea", "loon"]) { const t = performance.now(); await FISH.setPlace(id); out[id] = Math.round(performance.now() - t); } return out; });
      console.log("     setPlace time in ms (this machine, SwiftShader): " + JSON.stringify(ms));
    }
  } catch (e) { check(false, "exception in part 2: " + (e && e.stack)); }
  check(errors.length === 0, "part 2: no page errors" + (errors.length ? ":\n" + errors.join("\n") : ""));
  await browser.close();
}

if (skipped.length) console.log("\n" + skipped.length + " check(s) skipped: " + skipped.map((s) => s.split(" (")[0]).join("; "));
console.log(fails.length ? "\n" + fails.length + " failed" : "\nall passed");
process.exit(fails.length ? 1 : 0);

