// In Full Swing: the screen bits of the city action in flat play. The hero's hearts and the energy gauge (bottom left), a prompt
// line (R GET IN, a punch hint), a red glow at the edges when the hero is hit, and on a phone the CAR button, the DODGE button (while
// a goon winds up), THROW (a goon in throwing range), GLIDE (held, in the air), the move stick (sx, sy) and the driving pad (left, right, GAS, BRAKE). main
// reads the phone buttons from touch: { car, dodge, throw, glide, left, right, gas, brake } (car, dodge and throw are edges).
// A speech bubble over a person in the street (a robbed driver's shout) follows a screen point main gives each frame, and so
// does the red warning mark over a goon who winds up. In a fight, a combo count and the focus meter show at the right edge.
import { PHONE } from "./config.js";
const STICK = PHONE.stick;
const CSS = `
#actHud{position:fixed;left:14px;bottom:14px;z-index:12;pointer-events:none;font-family:var(--comic,"Bangers",Impact,"Arial Black",sans-serif);color:#140a18}
#actHud[hidden]{display:none}
#actHud .hearts{display:flex;gap:3px;font-size:26px;line-height:1;color:#e8402a;text-shadow:2px 2px 0 #140a18,-1px -1px 0 #140a18,1px -1px 0 #140a18,-1px 1px 0 #140a18}
#actHud .hearts .off{color:#5a4a5e}
#actHud .energy{margin-top:6px;width:150px;height:14px;border:3px solid #140a18;background:#fffdf5;box-shadow:3px 3px 0 #140a18;overflow:hidden}
#actHud .energy i{display:block;height:100%;width:100%;background:#ffd84a;transform-origin:left center;transition:background .2s}
#actHud .energy.low i{background:#e8402a}
#actHud .energy[hidden]{display:none}
#actPrompt{position:fixed;left:50%;bottom:16%;transform:translateX(-50%);z-index:12;pointer-events:none;padding:6px 16px 3px;background:#ffd84a;border:3px solid #140a18;box-shadow:4px 4px 0 #140a18;font-family:var(--comic,"Bangers",Impact,sans-serif);font-size:24px;letter-spacing:.05em;color:#140a18;white-space:nowrap}
#actPrompt[hidden]{display:none}
#actPrompt b{display:inline-block;min-width:1.2em;margin-right:8px;padding:0 6px;background:#fffdf5;border:2px solid #140a18;text-align:center}
#actShout{position:fixed;left:0;top:0;z-index:12;pointer-events:none;padding:4px 12px 1px;background:#fffdf5;border:3px solid #140a18;border-radius:14px;box-shadow:3px 3px 0 #140a18;font-family:var(--comic,"Bangers",Impact,sans-serif);font-size:26px;letter-spacing:.04em;color:#e8402a;white-space:nowrap;transform:translate(-50%,-100%)}
#actShout:after{content:"";position:absolute;left:40%;bottom:-12px;border:6px solid transparent;border-top:8px solid #140a18}
#actShout[hidden]{display:none}
#actFight{position:fixed;right:16px;top:170px;z-index:12;pointer-events:none;display:flex;flex-direction:column;align-items:flex-end;font-family:var(--comic,"Bangers",Impact,"Arial Black",sans-serif)}
#actFight[hidden]{display:none}
@media (max-width:600px){#actFight{top:260px}}
#actFight .combo{font-size:30px;line-height:1;color:#ffd84a;text-shadow:2px 2px 0 #140a18,-1px -1px 0 #140a18,1px -1px 0 #140a18,-1px 1px 0 #140a18}
#actFight .combo[hidden],#actFight .focus[hidden]{display:none}
#actFight .focus{margin-top:6px;width:120px;height:10px;border:3px solid #140a18;background:#fffdf5;box-shadow:3px 3px 0 #140a18;overflow:hidden}
#actFight .focus i{display:block;height:100%;width:100%;background:#5ec2e8;transform-origin:left center}
#actFight .focus.full i{background:#e8402a;animation:actFull .5s ease-in-out infinite alternate}
@keyframes actFull{to{background:#ffd84a}}
#actWarn{position:fixed;left:0;top:0;z-index:12;pointer-events:none;width:34px;height:34px;margin:-17px 0 0 -17px;border:3px solid #140a18;border-radius:50%;background:#e8402a;box-shadow:3px 3px 0 #140a18;color:#fffdf5;font-family:var(--comic,"Bangers",Impact,sans-serif);font-size:26px;line-height:34px;text-align:center;animation:actWarn .25s ease-in-out infinite alternate}
#actWarn[hidden]{display:none}
@keyframes actWarn{to{transform:scale(1.25)}}
@media (prefers-reduced-motion:reduce){#actWarn,#actFight .focus.full i{animation:none}}
#actHit{position:fixed;inset:0;z-index:11;pointer-events:none;opacity:0;box-shadow:inset 0 0 120px 30px rgba(232,40,30,.85);transition:opacity .35s}
#actTouch{position:fixed;inset:0;z-index:13;pointer-events:none}
#actTouch button{pointer-events:auto;position:absolute;width:74px;height:74px;border:4px solid #140a18;border-radius:50%;background:#fffdf5;box-shadow:4px 4px 0 #140a18;font-family:var(--comic,"Bangers",Impact,sans-serif);font-size:20px;color:#140a18;touch-action:none;user-select:none;-webkit-user-select:none}
#actTouch button[hidden]{display:none}
#actTouch button.on{background:#ffd84a}
#actTouch .car{right:18px;top:42%;background:#5ec2e8}
#actTouch .dodge{right:18px;top:calc(42% + 88px);width:96px;height:96px;background:#e8402a;color:#fffdf5;font-size:22px}
#actTouch .throw{right:18px;top:calc(42% - 88px);background:#ffd84a;font-size:18px}
#actTouch .stick{position:absolute;left:18px;bottom:140px;width:120px;height:120px;border:4px solid #140a18;border-radius:50%;background:rgba(255,253,245,.35);box-shadow:4px 4px 0 #140a18;pointer-events:auto;touch-action:none}
#actTouch .stick[hidden]{display:none}
#actTouch .stick i{position:absolute;left:50%;top:50%;width:52px;height:52px;margin:-26px 0 0 -26px;border:4px solid #140a18;border-radius:50%;background:#ffd84a;pointer-events:none}
#actTouch .glide{left:50%;bottom:96px;width:120px;height:64px;margin-left:-60px;border-radius:32px;background:#5ec2e8;font-size:22px}
#actTouch .left{left:18px;bottom:22px}#actTouch .right{left:104px;bottom:22px}
#actTouch .gas{right:18px;bottom:22px;background:#7fdc5a}#actTouch .brake{right:104px;bottom:22px;background:#e8806a}
body.cutscene #actHud,body.cutscene #actPrompt,body.cutscene #actTouch,body.cutscene #actShout,body.cutscene #actWarn,body.cutscene #actFight{visibility:hidden}
`;

export function createActionHud() {
  const style = document.createElement("style");
  style.textContent = CSS;
  document.head.appendChild(style);
  const hud = document.createElement("div");
  hud.id = "actHud"; hud.hidden = true;
  hud.innerHTML = '<div class="hearts"></div><div class="energy" hidden><i></i></div>';
  const fightEl = document.createElement("div");
  fightEl.id = "actFight"; fightEl.hidden = true;
  fightEl.innerHTML = '<div class="combo" hidden></div><div class="focus" hidden><i></i></div>';
  const prompt = document.createElement("div");
  prompt.id = "actPrompt"; prompt.hidden = true;
  const shout = document.createElement("div");
  shout.id = "actShout"; shout.hidden = true;
  const hit = document.createElement("div");
  hit.id = "actHit";
  const warn = document.createElement("div");
  warn.id = "actWarn"; warn.hidden = true; warn.textContent = "!";
  const touchEl = document.createElement("div");
  touchEl.id = "actTouch";
  const btn = (k, label) => { const b = document.createElement("button"); b.className = k; b.textContent = label; b.hidden = true; b.type = "button"; touchEl.appendChild(b); return b; };
  const B = { glide: btn("glide", "GLIDE"), throw: btn("throw", "THROW"), dodge: btn("dodge", "DODGE"), car: btn("car", "CAR"), left: btn("left", "◀"), right: btn("right", "▶"), gas: btn("gas", "GAS"), brake: btn("brake", "BRAKE") };
  document.body.append(hud, fightEl, prompt, shout, warn, hit, touchEl);
  const hearts = hud.querySelector(".hearts"), energy = hud.querySelector(".energy"), bar = energy.querySelector("i");
  const comboEl = fightEl.querySelector(".combo"), focusEl = fightEl.querySelector(".focus"), focusBar = focusEl.querySelector("i");
  const touch = { sx: 0, sy: 0, stick: false, car: false, dodge: false, throw: false, glide: false, left: false, right: false, gas: false, brake: false };
  for (const k of ["left", "right", "gas", "brake", "glide"]) {
    const b = B[k];
    const on = (v) => (e) => { e.preventDefault(); touch[k] = v; b.classList.toggle("on", v); };
    b.addEventListener("pointerdown", on(true)); b.addEventListener("pointerup", on(false)); b.addEventListener("pointercancel", on(false)); b.addEventListener("pointerleave", on(false));
  }
  B.car.addEventListener("pointerdown", (e) => { e.preventDefault(); touch.car = true; });
  // the move stick: a finger down on it and dragged sets touch.sx, touch.sy (-1..1, y up); up anywhere lets it go back
  const stick = document.createElement("div"); stick.className = "stick"; stick.hidden = true; stick.innerHTML = "<i></i>";
  touchEl.appendChild(stick);
  const knob = stick.firstChild;
  let stickId = null;
  const stickMove = (e) => {
    const b = stick.getBoundingClientRect(), R = STICK.r;
    let x = (e.clientX - (b.left + b.width / 2)) / R, y = -(e.clientY - (b.top + b.height / 2)) / R;
    const l = Math.hypot(x, y);
    if (l > 1) { x /= l; y /= l; }
    knob.style.transform = "translate(" + Math.round(x * R) + "px," + Math.round(-y * R) + "px)";
    const k = l < STICK.dead ? 0 : 1;
    touch.sx = x * k; touch.sy = y * k;
  };
  const stickEnd = (e) => { if (e.pointerId !== stickId) return; stickId = null; touch.stick = false; touch.sx = touch.sy = 0; knob.style.transform = ""; };
  stick.addEventListener("pointerdown", (e) => { e.preventDefault(); stickId = e.pointerId; touch.stick = true; try { stick.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } stickMove(e); });
  stick.addEventListener("pointermove", (e) => { if (e.pointerId === stickId) stickMove(e); });
  for (const t of ["pointerup", "pointercancel", "lostpointercapture"]) stick.addEventListener(t, stickEnd);
  B.dodge.addEventListener("pointerdown", (e) => { e.preventDefault(); touch.dodge = true; });
  B.throw.addEventListener("pointerdown", (e) => { e.preventDefault(); touch.throw = true; });
  let shown = { hp: -1, max: -1, e: -2, p: "", c: -1, f: -2 }, hitT = 0;
  const H = {
    touch,
    // s: { on, hp, max, energy (0..1, or < 0 to hide), prompt (html or ""), phone, nearCar, driving, shout: { text, x, y } (px) or null,
    //   combo (blows in a row; shows from 2), focus (0..1, or < 0 to hide), warn: { x, y } (px) or null }
    update(dt, s) {
      hud.hidden = !s.on;
      const sh = s.on && s.shout;
      if (!sh) shout.hidden = true;
      else {
        if (shout.textContent !== sh.text) shout.textContent = sh.text;
        shout.hidden = false; shout.style.left = Math.round(sh.x) + "px"; shout.style.top = Math.round(sh.y) + "px";
      }
      const wn = s.on && s.warn;
      warn.hidden = !wn;
      if (wn) { warn.style.left = Math.round(wn.x) + "px"; warn.style.top = Math.round(wn.y) + "px"; }
      fightEl.hidden = !s.on;
      if (!s.on) { prompt.hidden = true; for (const k in B) B[k].hidden = true; return; }
      const c = s.combo >= 2 ? s.combo : 0;
      if (c !== shown.c) { shown.c = c; comboEl.hidden = !c; comboEl.textContent = c ? c + " HITS" : ""; }
      const f = s.focus == null || s.focus < 0 ? -1 : Math.round(s.focus * 50) / 50;
      if (f !== shown.f) {
        shown.f = f; focusEl.hidden = f < 0;
        if (f >= 0) { focusBar.style.transform = "scaleX(" + f + ")"; focusEl.classList.toggle("full", f >= 1); }
      }
      const hp = Math.ceil(s.hp - 1e-6);
      if (hp !== shown.hp || s.max !== shown.max) {
        shown.hp = hp; shown.max = s.max;
        hearts.textContent = "";
        for (let i = 0; i < s.max; i++) { const h = document.createElement("span"); h.textContent = "♥"; if (i >= hp) h.className = "off"; hearts.appendChild(h); }
      }
      const e = s.energy < 0 ? -1 : Math.round(s.energy * 50) / 50;
      if (e !== shown.e) {
        shown.e = e;
        energy.hidden = e < 0;
        if (e >= 0) { bar.style.transform = "scaleX(" + e + ")"; energy.classList.toggle("low", e < 0.25); }
      }
      if (s.prompt !== shown.p) { shown.p = s.prompt; prompt.hidden = !s.prompt; prompt.innerHTML = s.prompt || ""; }
      B.car.hidden = !(s.phone && (s.nearCar || s.driving));
      stick.hidden = !(s.phone && !s.driving && !s.wall); // (on a wall the climb pad takes its place)
      if (stick.hidden && touch.stick) { stickId = null; touch.stick = false; touch.sx = touch.sy = 0; knob.style.transform = ""; }
      B.dodge.hidden = !(s.phone && s.warn);
      if (B.dodge.hidden) touch.dodge = false;
      B.throw.hidden = !(s.phone && s.throwable && !s.warn);
      if (B.throw.hidden) touch.throw = false;
      // GLIDE shows in the air with no rope out (s.air), and stays while a finger holds it
      if (s.phone && s.air) B.glide.hidden = false;
      else if (!touch.glide || !s.phone) { B.glide.hidden = true; touch.glide = false; B.glide.classList.remove("on"); }
      B.car.textContent = s.driving ? "OUT" : "CAR";
      for (const k of ["left", "right", "gas", "brake"]) { B[k].hidden = !(s.phone && s.driving); if (B[k].hidden && touch[k]) { touch[k] = false; B[k].classList.remove("on"); } }
      if (hitT > 0) { hitT -= dt; if (hitT <= 0) hit.style.opacity = "0"; }
    },
    // read and clear the CAR press
    takeCar() { const v = touch.car; touch.car = false; return v; },
    // read and clear the DODGE press (phone)
    takeDodge() { const v = touch.dodge; touch.dodge = false; return v; },
    takeThrow() { const v = touch.throw; touch.throw = false; return v; },
    flash() { hit.style.opacity = "1"; hitT = 0.25; },
    info: () => ({ hidden: hud.hidden, hearts: shown.hp, energy: shown.e, combo: shown.c, focus: shown.f, warn: !warn.hidden, prompt: prompt.hidden ? "" : prompt.textContent, shout: shout.hidden ? "" : shout.textContent, car: !B.car.hidden, stick: !stick.hidden, dodge: !B.dodge.hidden, throw: !B.throw.hidden, glide: !B.glide.hidden, drive: !B.gas.hidden }),
  };
  return H;
}
