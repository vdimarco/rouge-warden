// In Full Swing: comic cutscenes on a flat screen. A scene is a list of panels. Each panel is a painted picture (art/cutscene,
// made from the game's own city, King and hero) or a shot of the live city, and it pushes in slowly, inside an inked frame with
// letterbox bars, with a yellow caption box (the narrator), a speech balloon
// pinned to a point in the world, or a big title card. A click, a tap, Space, Enter or Esc skips. The game holds still while
// a scene plays (main keeps G.state at "cutscene"); the city keeps its clock. The words tell why the Porcelain King sits on
// the Needle and what each mission asks. A headset plays no scene: main shows its title as a toast.
import * as THREE from "three";

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const SKIP_AFTER = 0.5; // s before a press can skip (the press that started the scene must not end it)

// The district flavour, by the district names in city.js
const FLAVOUR = {
  Harbourfront: "The gulls have started wearing nose plugs.",
  Financial: "The stocks are down. So is everything else.",
  "Old Town": "The old pipes are groaning.",
  Market: "The fish stalls smell worse than usual.",
  Uptown: "The penthouses are not amused.",
  Warehouse: "Something in the crates is bubbling.",
};

// Each panel: dur (s); shot(ctx) → { from: { pos, at }, to: { pos, at }, fov }; and any of caption, balloon { text, at(ctx), beside },
// title { big, small }, art { src, focus: [x, y], face: [x, y], low }. With its picture loaded a panel shows the picture: it
// fills the frame (cropped around focus, as fractions of the picture), the balloon points at face, and low puts the caption at
// the foot of the frame (over the SKIP button on a screen held upright) so it stays off a head at the top. With no picture it
// shows the live shot. ctx: { city, king (the King's perch), clog (a clog to show), start, hero (the head), district, portrait
// (set by play) }.
const V = (x, y, z) => [x, y, z];
// The King (16 m tall) sits on his perch 9.5 m out from the Needle's middle and faces the start roof: his shots look in along
// that line (u, out from the Needle through the perch; v across it), so the spire stands behind him and not in front.
const KING_H = 16;
// his balloon points at his face from the side, or at the top of his crown from above (a screen held upright)
const kingMouth = (c) => V(c.king.x, c.king.y + (c.portrait ? KING_H + 0.5 : KING_H * 0.8), c.king.z);
function needleShots(c) {
  const N = c.city.needle, k = c.king;
  let ux = k.x - N.x, uz = k.z - N.z;
  const ul = Math.hypot(ux, uz) || 1; ux /= ul; uz /= ul;
  const vx = -uz, vz = ux, at = (h, s = 0) => V(k.x + vx * s, k.y + h, k.z + vz * s), out = (d, s, h) => V(k.x + ux * d + vx * s, k.y + h, k.z + uz * d + vz * s);
  return {
    wide: { from: { pos: V(N.x + 430, 250, N.z + 560), at: V(N.x, 120, N.z) }, to: { pos: V(N.x + 330, 225, N.z + 420), at: V(N.x, 150, N.z) }, fov: 50 },
    // (on a wide screen aimed a little to his side, so he stands left of the middle and his balloon fits beside him; on a screen
    // held upright he stands in the middle, further off and low in the frame, with his balloon over his head)
    king: c.portrait ? { from: { pos: out(48, 4, 6), at: at(13) }, to: { pos: out(38, 3, 7), at: at(13) }, fov: 50 }
      : { from: { pos: out(34, 10, 7), at: at(9, -7) }, to: { pos: out(24, 6, 8), at: at(9.5, -5) }, fov: 50 },
    glow: { from: { pos: out(150, 40, -30), at: at(6) }, to: { pos: out(105, 28, -12), at: at(8) }, fov: 48 },
  };
}
const clogShot = (c) => { const g = c.clog; return { from: { pos: V(g.x + 15, g.y + 11, g.z + 15), at: V(g.x, g.y + 1.5, g.z) }, to: { pos: V(g.x + 9, g.y + 6, g.z + 9), at: V(g.x, g.y + 2, g.z) }, fov: 50 }; };
// the hero on the start roof, from in front and a little low, so the city and the Needle stand behind
const heroShot = (c) => {
  const S = c.start, fx = -Math.sin(S.yaw), fz = -Math.cos(S.yaw), h = c.hero;
  return { from: { pos: V(h.x + fx * 4.6, h.y - 0.6, h.z + fz * 4.6), at: V(h.x, h.y - 0.3, h.z) }, to: { pos: V(h.x + fx * 3.4 + fz * 0.6, h.y - 0.4, h.z + fz * 3.4 - fx * 0.6), at: V(h.x, h.y - 0.2, h.z) }, fov: 45 };
};
const lookOut = (c) => {
  const S = c.start, fx = -Math.sin(S.yaw), fz = -Math.cos(S.yaw), h = c.hero;
  return { from: { pos: V(h.x - fx * 5, h.y + 2.4, h.z - fz * 5), at: V(h.x + fx * 60, h.y + 6, h.z + fz * 60) }, to: { pos: V(h.x - fx * 4, h.y + 2, h.z - fz * 4), at: V(h.x + fx * 60, h.y + 9, h.z + fz * 60) }, fov: 55 };
};

export const SCENES = {
  // the cold open (flat play, first run, before the cottage room): who the Porcelain King is, fast, then Mission 1
  opening: [
    { dur: 3.4, shot: (c) => needleShots(c).wide, art: { src: "city", focus: [0.5, 0.4], low: true }, caption: "Port Loon. Every pipe in the city runs up one tower: the Needle." },
    { dur: 4.2, shot: (c) => needleShots(c).king, art: { src: "king", focus: [0.36, 0.4], face: [0.36, 0.3], low: true }, caption: "Meet the Porcelain King. He was Royce Flushmore, the plumbing baron who tried to buy every drain in town.", balloon: { text: "Every drain is MINE!", at: kingMouth } },
    { dur: 3.6, shot: clogShot, art: { src: "clogs", focus: [0.52, 0.45] }, caption: "The city said no. So he flushed himself, crown and all, and came back up a toilet god." },
    { dur: 3.4, shot: (c) => needleShots(c).glow, art: { src: "king-awake", focus: [0.46, 0.25], face: [0.47, 0.2], low: true }, caption: "Tonight his Sludge Gang is out with a clog bomb. First stop: the Market drain.", balloon: { text: "Flood them all!", beside: true, at: kingMouth } },
    { dur: 2.8, shot: heroShot, art: { src: "hero", focus: [0.33, 0.25], face: [0.33, 0.12], low: true }, caption: "Not on your watch.", balloon: { text: "Plunger up.", at: (c) => V(c.hero.x, c.hero.y + 0.45, c.hero.z) } },
    { dur: 2.6, shot: lookOut, art: { src: "swing", focus: [0.4, 0.4] }, title: { big: "Mission 1", small: "Sludge Run: catch the bomb runner" } },
  ],
  // the Sludge Run is won: on to the clogs
  mission2: [
    { dur: 3.2, shot: (c) => needleShots(c).wide, art: { src: "clogs", focus: [0.52, 0.45] }, title: { big: "Mission 2", small: "Flush the twelve clogs" } },
  ],
  district: [
    { dur: 3.6, shot: clogShot, caption: (c) => c.district.name + ": " + c.district.left + (c.district.left === 1 ? " clog. " : " clogs. ") + (FLAVOUR[c.district.name] || "") },
  ],
  king: [
    { dur: 4.5, shot: (c) => needleShots(c).glow, art: { src: "king-awake", focus: [0.46, 0.25], face: [0.47, 0.2], low: true }, caption: "Twelve clogs flushed. The King is awake.", balloon: { text: "You dare? Come up and get me!", beside: true, at: kingMouth } },
    { dur: 3.4, shot: (c) => needleShots(c).king, title: { big: "Mission 3", small: "Rip off his three pipes, then flush him" } },
  ],
  finale: [
    { dur: 4.5, shot: (c) => needleShots(c).glow, art: { src: "finale", focus: [0.35, 0.4], low: true }, caption: "The King goes down the pipe. Port Loon breathes again." },
    { dur: 3.4, shot: (c) => needleShots(c).wide, title: { big: "All clear", small: "Free roam: trials and Loonies" } },
  ],
};

const CSS = `
#cutscene{position:fixed;inset:0;z-index:40;pointer-events:auto;cursor:pointer;font-family:var(--comic,"Bangers",Impact,"Arial Black",sans-serif);color:#140a18}
#cutscene[hidden]{display:none}
#cutscene .cs-bar{position:absolute;left:0;right:0;height:9vh;background:#140a18;background-image:radial-gradient(circle,rgba(255,138,58,.22) 1.3px,transparent 1.6px);background-size:9px 9px}
#cutscene .cs-bar.t{top:0}#cutscene .cs-bar.b{bottom:0}
#cutscene .cs-frame{position:absolute;left:2.2vw;right:2.2vw;top:calc(9vh + 1.4vh);bottom:calc(9vh + 1.4vh);border:6px solid #140a18;box-shadow:0 0 0 3px #fffdf5,0 0 0 9px #140a18;pointer-events:none}
#cutscene .cs-art{position:absolute;left:calc(2.2vw + 6px);right:calc(2.2vw + 6px);top:calc(9vh + 1.4vh + 6px);bottom:calc(9vh + 1.4vh + 6px);overflow:hidden;background:#140a18;pointer-events:none}
#cutscene .cs-art[hidden]{display:none}
#cutscene.art{background:#140a18;background-image:radial-gradient(circle,rgba(255,138,58,.22) 1.3px,transparent 1.6px);background-size:9px 9px}
#cutscene .cs-art i{position:absolute;inset:0;background-size:cover;background-repeat:no-repeat;will-change:transform}
#cutscene .cs-flash{position:absolute;inset:0;background:#fffdf5;opacity:0;pointer-events:none}
#cutscene .cs-cap{position:absolute;left:calc(2.2vw + 14px);top:calc(9vh + 1.4vh + 14px);max-width:min(560px,62vw);margin:0;padding:10px 16px 6px;background:#ffd84a;border:4px solid #140a18;box-shadow:6px 6px 0 #140a18;font-size:clamp(20px,2.5vw,32px);line-height:1.08;letter-spacing:.04em;text-transform:uppercase;transform:rotate(-1deg)}
#cutscene .cs-bal{position:absolute;left:0;top:0;max-width:min(420px,46vw);margin:0;padding:12px 22px 8px;background:#fffdf5;border:4px solid #140a18;border-radius:28px;font-size:clamp(20px,2.4vw,30px);line-height:1.08;letter-spacing:.04em;text-transform:uppercase;will-change:transform}
#cutscene .cs-bal::after{content:"";position:absolute;left:var(--tail,30%);bottom:-24px;border-width:24px 6px 0 18px;border-style:solid;border-color:#140a18 transparent transparent transparent}
#cutscene .cs-bal[data-side=r]::after{left:-26px;bottom:auto;top:var(--tail-y,50%);border-width:6px 26px 14px 0;border-color:transparent #140a18 transparent transparent}
#cutscene .cs-bal[data-side=l]::after{left:auto;right:-26px;bottom:auto;top:var(--tail-y,50%);border-width:6px 0 14px 26px;border-color:transparent transparent transparent #140a18}
#cutscene .cs-title{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) rotate(-2deg);display:flex;flex-direction:column;align-items:center;padding:18px 40px 12px;background:#ffd84a;border:6px solid #140a18;box-shadow:10px 10px 0 #140a18;text-align:center;text-transform:uppercase}
#cutscene .cs-title b{font-weight:400;font-size:clamp(46px,8vw,110px);line-height:.95;letter-spacing:.06em;color:#e8402a;text-shadow:4px 4px 0 #140a18}
#cutscene .cs-title small{font-size:clamp(20px,2.6vw,34px);letter-spacing:.05em;margin-top:6px}
#cutscene .cs-skip{position:absolute;right:calc(2.2vw + 10px);bottom:calc(9vh + 1.4vh + 10px);padding:6px 14px 3px;background:#fffdf5;border:3px solid #140a18;box-shadow:3px 3px 0 #140a18;font:inherit;font-size:20px;letter-spacing:.06em;color:#140a18;cursor:pointer}
#cutscene .cs-cap[hidden],#cutscene .cs-bal[hidden],#cutscene .cs-title[hidden]{display:none}
body.cutscene .fs-hud,body.cutscene #keyHints,body.cutscene #lockRing,body.cutscene #lockArrow,body.cutscene #lockCue,body.cutscene #phoneControls,body.cutscene #lookHint{visibility:hidden}
@media (max-aspect-ratio:1/1){#cutscene .cs-cap{max-width:calc(100vw - 4.4vw - 28px)}#cutscene .cs-bal{max-width:70vw}}
#cutscene .cs-cap.low{top:auto;bottom:calc(9vh + 1.4vh + 14px)}
@media (max-aspect-ratio:1/1){#cutscene .cs-cap.low{bottom:calc(9vh + 1.4vh + 66px)}}
@media (prefers-reduced-motion:reduce){#cutscene .cs-flash{display:none}}`;

export function createCutscenes({ camera }) {
  const style = document.createElement("style");
  style.id = "cutscene-css"; style.textContent = CSS;
  document.head.appendChild(style);
  const root = document.createElement("div");
  root.id = "cutscene"; root.hidden = true; root.setAttribute("role", "dialog"); root.setAttribute("aria-label", "Cutscene");
  root.innerHTML = '<div class="cs-art" hidden><i></i></div><div class="cs-bar t"></div><div class="cs-bar b"></div><div class="cs-frame"></div><div class="cs-flash"></div>' +
    '<p class="cs-cap" aria-live="polite" hidden></p><p class="cs-bal" hidden></p><div class="cs-title" hidden><b></b><small></small></div>' +
    '<button class="cs-skip" type="button">SKIP ▸</button>';
  document.body.appendChild(root);
  const $ = (s) => root.querySelector(s), cap = $(".cs-cap"), bal = $(".cs-bal"), title = $(".cs-title"), flash = $(".cs-flash"), artBox = $(".cs-art"), artImg = $(".cs-art i");
  // the pictures (art/cutscene/<src>.webp): loaded by preload(); a panel whose picture is not ready when it starts shows the live shot
  const ART = {};
  const BASE = new URL("../art/cutscene/", import.meta.url).href;
  function load(src) {
    if (ART[src]) return ART[src];
    const img = new Image(), a = (ART[src] = { img, ok: false, url: BASE + src + ".webp" });
    img.onload = () => { a.ok = img.naturalWidth > 0; }; img.onerror = () => { a.ok = false; };
    img.decoding = "async"; img.src = a.url;
    return a;
  }
  const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const A = new THREE.Vector3(), B = new THREE.Vector3(), P = new THREE.Vector3();
  const S = { name: "", panels: null, ctx: null, i: -1, t: 0, total: 0, done: null, fov0: 70, shots: [], art: null };

  function show(i) {
    const p = S.panels[i], c = S.ctx;
    S.i = i; S.t = 0;
    S.shot = p.shot(c);
    const cap0 = typeof p.caption === "function" ? p.caption(c) : p.caption;
    cap.hidden = !cap0; cap.textContent = cap0 || "";
    bal.hidden = !p.balloon; bal.textContent = p.balloon ? p.balloon.text : "";
    S.balAt = p.balloon ? p.balloon.at(c) : null; S.balBeside = !!(p.balloon && p.balloon.beside && !c.portrait);
    const a = p.art && ART[p.art.src];
    S.art = a && a.ok ? { ...p.art, img: a.img, url: a.url } : null;
    artBox.hidden = !S.art; root.classList.toggle("art", !!S.art); // (the strips round the frame are inked too: no live city peeks past a picture)
    cap.classList.toggle("low", !!(S.art && S.art.low));
    if (S.art) { artImg.style.backgroundImage = `url("${S.art.url}")`; artImg.style.backgroundPosition = `${S.art.focus[0] * 100}% ${S.art.focus[1] * 100}%`; }
    title.hidden = !p.title;
    if (p.title) { title.querySelector("b").textContent = p.title.big; title.querySelector("small").textContent = p.title.small; }
    // a white flash between panels, like a page turn
    if (i > 0 && !REDUCED && flash.animate) flash.animate([{ opacity: 0.85 }, { opacity: 0 }], { duration: 160, easing: "ease-out" });
  }
  function end(skipped) {
    if (!S.panels) return;
    const done = S.done;
    S.panels = null; S.done = null; S.name = "";
    root.hidden = true; artBox.hidden = true; S.art = null; root.classList.remove("art");
    document.body.classList.remove("cutscene");
    camera.fov = S.fov0; camera.updateProjectionMatrix();
    if (done) done(!!skipped);
  }
  const skip = () => { if (S.panels && S.total >= SKIP_AFTER) end(true); };
  root.addEventListener("pointerdown", (e) => { e.preventDefault(); e.stopPropagation(); skip(); });
  addEventListener("keydown", (e) => {
    if (!S.panels) return;
    if (e.code === "Escape" || e.code === "Space" || e.code === "Enter") { e.preventDefault(); e.stopImmediatePropagation(); skip(); }
  }, true);

  const CS = {
    get playing() { return !!S.panels; },
    // play(name, ctx, done(skipped)): ctx gives the places (see SCENES)
    play(name, ctx, done) {
      const panels = SCENES[name];
      if (!panels || !panels.length) { if (done) done(true); return false; }
      if (S.panels) end(true);
      S.name = name; S.panels = panels; S.ctx = ctx; S.done = done || null; S.total = 0;
      ctx.portrait = camera.aspect < 1; // a screen held upright frames some shots its own way
      S.fov0 = camera.fov;
      root.hidden = false;
      document.body.classList.add("cutscene");
      show(0);
      CS.update(0);
      return true;
    },
    skip,
    // the frame: the camera along the panel's push, the balloon pinned to its point, the next panel when this one is over
    update(dt) {
      if (!S.panels) return;
      S.t += dt; S.total += dt;
      const p = S.panels[S.i];
      if (S.t >= p.dur) { if (S.i + 1 < S.panels.length) show(S.i + 1); else { end(false); return; } }
      const sh = S.shot, k = smooth(S.t / S.panels[S.i].dur);
      A.fromArray(sh.from.pos).lerp(B.fromArray(sh.to.pos), k);
      camera.position.copy(A);
      A.fromArray(sh.from.at).lerp(B.fromArray(sh.to.at), k);
      camera.lookAt(A);
      if (sh.fov && Math.abs(camera.fov - sh.fov) > 0.01) { camera.fov = sh.fov; camera.updateProjectionMatrix(); }
      camera.updateMatrixWorld(true);
      // the picture: it covers the frame, cropped around its focus, and pushes in about the focus (none with reduced motion)
      let face = null;
      if (S.art) {
        const R = artBox.getBoundingClientRect(), iw = S.art.img.naturalWidth, ih = S.art.img.naturalHeight;
        const sc = Math.max(R.width / iw, R.height / ih), dw = iw * sc, dh = ih * sc, [fx, fy] = S.art.focus;
        const ox = (R.width - dw) * fx, oy = (R.height - dh) * fy, Fx = ox + fx * dw, Fy = oy + fy * dh, z = REDUCED ? 1 : 1 + 0.06 * k;
        artImg.style.transformOrigin = `${Fx.toFixed(1)}px ${Fy.toFixed(1)}px`;
        artImg.style.transform = `scale(${z.toFixed(4)})`;
        if (S.art.face) face = [R.left + Fx + (ox + S.art.face[0] * dw - Fx) * z, R.top + Fy + (oy + S.art.face[1] * dh - Fy) * z];
      }
      if ((S.balAt || face) && !bal.hidden) {
        const W = innerWidth, H = innerHeight, bw = bal.offsetWidth || 200, bh = bal.offsetHeight || 60;
        // the balloon sits above its point, its tail pointing down at it, inside the frame
        let px, py;
        if (face) [px, py] = face;
        else { P.fromArray(S.balAt).project(camera); px = (P.x * 0.5 + 0.5) * W; py = (0.5 - P.y * 0.5) * H; }
        let x, y, side = "";
        if (!S.balBeside && py - bh - 30 >= H * 0.11) { // above the point, the tail pointing down at it
          x = clamp(px - bw * 0.3, W * 0.03, W * 0.97 - bw); y = clamp(py - bh - 30, H * 0.11, H * 0.86 - bh);
          bal.style.setProperty("--tail", clamp(((px - x) / bw) * 100 - 6, 8, 80).toFixed(0) + "%");
        } else { // beside it (a big face, or no room above): on the side with more room, the tail pointing at it
          side = px < W / 2 ? "r" : "l";
          const gap = face ? 28 : Math.max(40, W * 0.08); // clear of the speaker's own head (a picture's point is the face itself)
          x = side === "r" ? clamp(px + gap, W * 0.03, W * 0.97 - bw) : clamp(px - gap - bw, W * 0.03, W * 0.97 - bw);
          y = clamp(py - bh * 0.6, H * 0.11, H * 0.86 - bh);
          bal.style.setProperty("--tail-y", clamp(((py - y) / bh) * 100, 20, 80).toFixed(0) + "%");
        }
        if (bal.dataset.side !== side) bal.dataset.side = side;
        bal.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;
      }
    },
    info: () => ({ playing: !!S.panels, name: S.name, panel: S.i, t: S.t, total: S.total, caption: cap.hidden ? "" : cap.textContent, balloon: bal.hidden ? "" : bal.textContent, title: title.hidden ? "" : title.textContent, art: S.art ? S.art.src : "", loaded: Object.keys(ART).filter((k) => ART[k].ok) }),
    // fetch the pictures of every scene (the offline cache has them after the first visit); resolves when all have settled
    preload() {
      const all = [...new Set(Object.values(SCENES).flat().filter((p) => p.art).map((p) => p.art.src))].map(load);
      return Promise.all(all.map((a) => (a.img.complete ? Promise.resolve() : new Promise((r) => { a.img.addEventListener("load", r, { once: true }); a.img.addEventListener("error", r, { once: true }); }))));
    },
  };
  return CS;
}
