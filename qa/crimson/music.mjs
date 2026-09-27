// The two songs, through a stand-in for SoundCloud's player (no network):
// 1. The title plays "Little Green Bag" at the middle level, with its credit; M turns it off and on.
//    FIGHT GABE changes the player to "Promises" and brings it up loud; the pause menu brings it down
//    without changing the song.
// 2. NEW STORY: the fight plays "Promises", the story holds it, and SAVE & QUIT goes back to the
//    title song, which plays again.
// 3. ?titlesong= and ?song= choose other songs; ?nomusic makes no player at all.
// No page errors anywhere.
import { open, step, ticksUntil, stepUntil, finish } from "./lib.mjs";

const TITLE_SONG = "https://soundcloud.com/a-band-apart-uk/little-green-bag-reservoir-dogs";
const SONG = "https://soundcloud.com/skrillex/nero-promises-skrillex";
const fails = [], errs = [];
const check = (ok, msg) => { if (ok) console.log("ok   " + msg); else { console.log("FAIL " + msg); fails.push(msg); } };

// The stand-in keeps a log in window.__sc: the song it holds, its volume, and every play, pause and load.
const FAKE_API = `(() => {
  const log = window.__sc = { sound: '', volume: null, paused: true, calls: [] };
  const names = { 'little-green-bag-reservoir-dogs': ['Little Green Bag (Reservoir Dogs)', 'A Band Apart UK'], 'nero-promises-skrillex': ['Nero - Promises (Skrillex Remix)', 'Skrillex'] };
  function Widget(frame) {
    log.sound = new URL(frame.src).searchParams.get('url');
    const on = {}, emit = (e) => (on[e] || []).forEach((f) => f());
    const w = {
      bind(e, f) { (on[e] = on[e] || []).push(f); if (e === 'ready') setTimeout(() => emit('ready'), 30); },
      play() { log.calls.push(['play', log.sound]); log.paused = false; setTimeout(() => emit('play'), 5); },
      pause() { log.calls.push(['pause', log.sound]); log.paused = true; setTimeout(() => emit('pause'), 5); },
      setVolume(v) { log.volume = v; },
      seekTo() {},
      load(url, o) { log.calls.push(['load', url, !!o.auto_play]); log.sound = url; log.paused = true; emit('pause');
        setTimeout(() => { if (o.callback) o.callback(); if (o.auto_play && log.paused) w.play(); }, 30); },
      getCurrentSound(cb) { const k = Object.keys(names).find((k) => log.sound.includes(k)); cb(k ? { title: names[k][0], user: { username: names[k][1] }, permalink_url: log.sound } : null); },
    };
    return w;
  }
  Widget.Events = { READY: 'ready', PLAY: 'play', PAUSE: 'pause', FINISH: 'finish' };
  window.SC = { Widget };
})();`;
const fakeSoundCloud = (page) => page.route((u) => u.hostname === "w.soundcloud.com", (r) => {
  const u = new URL(r.request().url());
  if (u.pathname.endsWith("/api.js")) return r.fulfill({ body: FAKE_API, contentType: "text/javascript" });
  return r.fulfill({ body: "<!doctype html><title>player</title>", contentType: "text/html" });
});
const sc = (page) => page.evaluate(async () => {
  const { Music } = await import("/crimson/js/music.js");
  const f = document.getElementById("song");
  return { ...window.__sc, frameSong: f ? new URL(f.src).searchParams.get("url") : null, scene: Music.sceneName, playing: Music.playing, enabled: Music.enabled,
    credit: (document.querySelector("#title .songCredit") || {}).textContent || "" };
});
const until = (page, fn, arg) => page.waitForFunction(fn, arg, { timeout: 15000, polling: 50 }).then(() => true, () => false);
const lastPlay = (s) => [...s.calls].reverse().find((c) => c[0] === "play" || c[0] === "pause");

/* ---------------- 1: the title song, M, FIGHT GABE and the pause menu ---------------- */
{
  const { browser, page, errors } = await open({ query: "?seed=7&god", before: fakeSoundCloud });
  let ok = await until(page, () => window.__sc && __sc.volume === 40 && !__sc.paused);
  let s = await sc(page);
  check(s.frameSong === TITLE_SONG, `the player loads the title song (${s.frameSong})`);
  check(ok && s.scene === "title" && s.sound === TITLE_SONG, `the title song plays at the middle level (volume ${s.volume}, scene ${s.scene})`);
  ok = await until(page, () => /Little Green Bag/.test(document.querySelector("#title .songCredit").textContent));
  s = await sc(page);
  check(ok && /A Band Apart UK · Little Green Bag/.test(s.credit), `the title credits the song (${s.credit})`);
  await page.keyboard.press("KeyM");
  ok = await until(page, () => __sc.paused);
  check(ok, "M turns the title song off");
  await page.keyboard.press("KeyM");
  ok = await until(page, () => !__sc.paused && __sc.sound.includes("little-green-bag"));
  check(ok, "M turns it back on");

  await page.evaluate(() => { __crimson.seed(7); __crimson.startGame("fight"); });
  await step(page, 0.1);
  ok = await until(page, (song) => __sc.sound === song && __sc.volume === 80 && !__sc.paused, SONG);
  s = await sc(page);
  const loads = s.calls.filter((c) => c[0] === "load");
  check(ok && s.scene === "fight", `FIGHT GABE plays "Promises" loud (song ${s.sound}, volume ${s.volume})`);
  check(loads.length === 1 && loads[0][1] === SONG && loads[0][2], `the player changes song once, with auto play (${JSON.stringify(loads)})`);
  ok = await until(page, () => /Promises/.test(document.querySelector("#title .songCredit").textContent));
  check(ok, "the credit follows the song");
  await page.keyboard.press("Escape");
  ok = await until(page, () => __sc.volume === 22);
  s = await sc(page);
  check(ok && s.sound === SONG && s.calls.filter((c) => c[0] === "load").length === 1, `the pause menu brings the song down and keeps it (volume ${s.volume})`);
  errs.push(...errors);
  await browser.close();
}

/* ---------------- 2: NEW STORY, the story's hush, and SAVE & QUIT back to the title song ---------------- */
{
  const { browser, page, errors } = await open({ query: "?seed=7&god", before: fakeSoundCloud });
  await until(page, () => window.__sc && !__sc.paused);
  await page.evaluate(() => { __crimson.seed(7); __crimson.startGame("story"); });
  await step(page, 0.1);
  let ok = await until(page, (song) => __sc.sound === song && !__sc.paused, SONG);
  check(ok, "NEW STORY's fight plays \"Promises\"");
  await page.waitForFunction(() => __crimson.storyLoaded, null, { timeout: 120000, polling: 100 });
  await page.evaluate(() => __crimson.win());
  await ticksUntil(page, () => __crimson.game.state === "story", 400);
  ok = await until(page, () => __sc.paused);
  let s = await sc(page);
  check(ok && lastPlay(s)[0] === "pause", `the story holds the song (last call ${JSON.stringify(lastPlay(s))})`);
  const r = await stepUntil(page, () => __crimson.story.chapter === "f1", { maxSec: 30 });
  check(r.ok, `the story reaches f1 (${r.sec} s)`);
  await page.keyboard.press("Escape");
  await step(page, 0.05);
  await page.evaluate(() => __crimson.story.S.test.ui.quit());
  await step(page, 0.05);
  ok = await until(page, (song) => __crimson.game.state === "title" && __sc.sound === song && !__sc.paused && __sc.volume === 40, TITLE_SONG);
  s = await sc(page);
  check(ok && s.scene === "title", `SAVE & QUIT plays the title song again (song ${s.sound}, volume ${s.volume}, state ${await page.evaluate(() => __crimson.game.state)})`);
  ok = await until(page, () => /Little Green Bag/.test(document.querySelector("#title .songCredit").textContent));
  check(ok, "the title credit is back");
  errs.push(...errors);
  await browser.close();
}

/* ---------------- 3: ?titlesong=, ?song= and ?nomusic ---------------- */
{
  const other = "https://soundcloud.com/someone/some-song", fight = "https://soundcloud.com/someone/fight-song";
  const { browser, page, errors } = await open({ query: `?seed=7&god&titlesong=${encodeURIComponent(other)}&song=${encodeURIComponent(fight)}`, before: fakeSoundCloud });
  await until(page, () => window.__sc && __sc.sound);
  let s = await sc(page);
  check(s.frameSong === other, `?titlesong= chooses the title song (${s.frameSong})`);
  await page.evaluate(() => __crimson.startGame("fight"));
  await step(page, 0.1);
  const ok = await until(page, (song) => __sc.sound === song, fight);
  check(ok, "?song= chooses the fight song");
  errs.push(...errors);
  await browser.close();
}
{
  const { browser, page, errors } = await open({ query: "?seed=7&nomusic", before: fakeSoundCloud });
  await page.waitForTimeout(500);
  const s = await sc(page);
  check(!s.enabled && s.frameSong === null && !(await page.evaluate(() => document.body.classList.contains("hasSong"))), "?nomusic makes no player");
  errs.push(...errors);
  await browser.close();
}

await finish("music", fails, null, errs);
