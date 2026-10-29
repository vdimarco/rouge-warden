// In Full Swing: the screen bits of the city action in flat play. The hero's hearts and the energy gauge (bottom left), a prompt
// line (R GET IN, a punch hint), a red glow at the edges when the hero is hit, and on a phone the CAR button, the DODGE button (while
// a goon winds up), THROW (a goon in throwing range) and GLIDE (held, in the air). The left thumb's move stick (mobile.js) walks and
// drives. main reads the phone buttons from touch: { car, dodge, throw, glide } (car, dodge and throw are edges).
// A speech bubble over a person in the street (a robbed driver's shout) follows a screen point main gives each frame, and so
// does the red warning mark over a goon who winds up. In a fight, a combo count and the focus meter show at the right edge.
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
#actTouch .glide{left:50%;bottom:96px;width:120px;height:64px;margin-left:-60px;border-radius:32px;background:#5ec2e8;font-size:22px}
#actBanner{position:fixed;left:50%;top:31%;z-index:12;pointer-events:none;transform:translate(-50%,0) rotate(-3deg);padding:8px 26px 4px;background:#e8402a;border:4px solid #140a18;box-shadow:6px 6px 0 #140a18;font-family:var(--comic,"Bangers",Impact,"Arial Black",sans-serif);color:#fffdf5;text-align:center;white-space:nowrap;background-image:radial-gradient(rgba(20,10,24,.22) 1.3px,transparent 1.6px);background-size:7px 7px}
#actBanner[hidden]{display:none}
#actBanner b{display:block;font-size:44px;line-height:1;letter-spacing:.04em;text-shadow:3px 3px 0 #140a18}
#actBanner small{display:block;margin-top:2px;font-size:18px;letter-spacing:.06em;color:#ffd84a;text-shadow:2px 2px 0 #140a18}
#actBanner.stamp{background-color:#ffd84a;color:#140a18;transform:translate(-50%,0) rotate(2deg)}
#actBanner.stamp b{color:#140a18;text-shadow:3px 3px 0 #fffdf5}
#actBanner.stamp small{color:#140a18;text-shadow:none}
#actBanner.go{animation:actSlam .28s cubic-bezier(.2,1.6,.4,1) both}
@keyframes actSlam{from{transform:translate(-50%,0) rotate(-3deg) scale(2.4);opacity:0}to{opacity:1}}
@media (max-width:600px){#actBanner{top:24%;padding:6px 16px 3px;max-width:calc(100vw - 32px);box-sizing:border-box}#actBanner b{font-size:36px}#actBanner small{font-size:15px;white-space:normal}}
@media (prefers-reduced-motion:reduce){#actBanner.go{animation:none}}
#actGoal{position:fixed;left:0;top:0;z-index:12;pointer-events:none;transform:translate(-50%,-115%);padding:3px 12px 2px;background:#ffd84a;border:3px solid #140a18;box-shadow:4px 4px 0 #140a18;font-family:var(--comic,"Bangers",Impact,"Arial Black",sans-serif);color:#140a18;text-align:center;white-space:nowrap}
#actGoal[hidden]{display:none}
#actGoal b{display:block;font-size:22px;line-height:1;letter-spacing:.06em}
#actGoal small{display:block;margin-top:1px;font-size:16px;line-height:1;letter-spacing:.04em}
#actGoal small.closing{color:#1f8a3a}
#actGoal small.behind{color:#e8402a}
#actGoal.off{transform:translate(-50%,-50%)}
#actGoal:not(.off):after{content:"";position:absolute;left:50%;bottom:-12px;margin-left:-7px;border:7px solid transparent;border-top:8px solid #140a18}
#actGoal .arr{display:none;margin-top:2px;font-size:18px;line-height:1}
#actGoal.off .arr{display:block}
body.cutscene #actBanner,body.cutscene #actHud,body.cutscene #actPrompt,body.cutscene #actTouch,body.cutscene #actShout,body.cutscene #actWarn,body.cutscene #actFight,body.cutscene #actGoal{visibility:hidden}
`;

// Where the job sticker sits. dir is the goal in camera space (Three.js: +x right, +y up, −z forward).
// ndc is that point after project() ({ x, y, z }; z > 1 is behind the far plane). size is the view in px.
// pad keeps the sticker off the score row, the key strip and the phone buttons: { l, t, r, b } inset from the edges.
// turn is the horizontal angle from the view to the goal, in radians, positive to the right.
// On the goal, the sticker sits on the projected point. Off to the side, or behind you, it sits on the left or right
// edge, the way you have to turn. In front but off the top or bottom, it sits on that edge.
export function placeGoal(dir, ndc, size, pad, turn = 0, out = {}) {
  const w = size.w, h = size.h;
  const L = pad.l, T = pad.t, R = w - pad.r, B = h - pad.b;
  const sx = (ndc.x * 0.5 + 0.5) * w, sy = (0.5 - ndc.y * 0.5) * h;
  const forward = -dir.z;
  const on = forward > 0.4 && ndc.z < 1 && sx >= L && sx <= R && sy >= T && sy <= B;
  if (on) { out.x = sx; out.y = sy; out.off = false; out.angle = 0; return out; }
  const side = Math.abs(turn) > 0.35 || forward <= 0.4;
  const ang = side ? (turn > 0 ? 0 : Math.PI) : (dir.y >= 0 ? -Math.PI / 2 : Math.PI / 2);
  const c = Math.cos(ang), s = Math.sin(ang);
  const cx = (L + R) / 2, cy = (T + B) / 2;
  const rx = Math.max(8, (R - L) / 2), ry = Math.max(8, (B - T) / 2);
  const t = Math.min(rx / Math.max(1e-4, Math.abs(c)), ry / Math.max(1e-4, Math.abs(s)));
  out.x = cx + c * t; out.y = cy + s * t; out.off = true; out.angle = ang;
  return out;
}

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
  const banner = document.createElement("div");
  banner.id = "actBanner"; banner.hidden = true; banner.setAttribute("role", "status");
  banner.innerHTML = "<b></b><small></small>";
  let bannerT = 0;
  const goal = document.createElement("div");
  goal.id = "actGoal"; goal.hidden = true; goal.setAttribute("role", "status");
  goal.innerHTML = "<b></b><small></small><span class=\"arr\">▲</span>";
  const touchEl = document.createElement("div");
  touchEl.id = "actTouch";
  const btn = (k, label) => { const b = document.createElement("button"); b.className = k; b.textContent = label; b.hidden = true; b.type = "button"; touchEl.appendChild(b); return b; };
  const B = { glide: btn("glide", "GLIDE"), throw: btn("throw", "THROW"), dodge: btn("dodge", "DODGE"), car: btn("car", "CAR") };
  document.body.append(hud, fightEl, prompt, shout, warn, goal, hit, banner, touchEl);
  const hearts = hud.querySelector(".hearts"), energy = hud.querySelector(".energy"), bar = energy.querySelector("i");
  const comboEl = fightEl.querySelector(".combo"), focusEl = fightEl.querySelector(".focus"), focusBar = focusEl.querySelector("i");
  const goalName = goal.querySelector("b"), goalSub = goal.querySelector("small"), goalArr = goal.querySelector(".arr");
  const touch = { car: false, dodge: false, throw: false, glide: false };
  for (const k of ["glide"]) {
    const b = B[k];
    const on = (v) => (e) => { e.preventDefault(); touch[k] = v; b.classList.toggle("on", v); };
    b.addEventListener("pointerdown", on(true)); b.addEventListener("pointerup", on(false)); b.addEventListener("pointercancel", on(false)); b.addEventListener("pointerleave", on(false));
  }
  B.car.addEventListener("pointerdown", (e) => { e.preventDefault(); touch.car = true; });
  B.dodge.addEventListener("pointerdown", (e) => { e.preventDefault(); touch.dodge = true; });
  B.throw.addEventListener("pointerdown", (e) => { e.preventDefault(); touch.throw = true; });
  let shown = { hp: -1, max: -1, e: -2, p: "", c: -1, f: -2, g: "" }, hitT = 0;
  const H = {
    touch,
    // s: { on, hp, max, energy (0..1, or < 0 to hide), prompt (html or ""), phone, nearCar, driving, shout: { text, x, y } (px) or null,
    //   combo (blows in a row; shows from 2), focus (0..1, or < 0 to hide), warn: { x, y } (px) or null,
    //   goal: { x, y, off, angle, name, dist, trend } or null (the job sticker) }
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
      if (!s.on) { prompt.hidden = true; goal.hidden = true; shown.g = ""; for (const k in B) B[k].hidden = true; return; }
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
      const gg = s.on && s.goal;
      if (!gg) { goal.hidden = true; shown.g = ""; }
      else {
        const key = gg.off + "|" + gg.name + "|" + gg.dist + "|" + gg.trend;
        if (key !== shown.g) {
          shown.g = key; goal.hidden = false;
          goalName.textContent = gg.name;
          goalSub.textContent = gg.dist + " m" + (gg.trend ? " · " + gg.trend : "");
          goalSub.className = gg.trend === "CLOSING" ? "closing" : gg.trend === "FALLING BEHIND" ? "behind" : "";
          goal.classList.toggle("off", !!gg.off);
        }
        goal.hidden = false;
        goal.style.left = Math.round(gg.x) + "px"; goal.style.top = Math.round(gg.y) + "px";
        goalArr.style.transform = gg.off ? "rotate(" + ((gg.angle + Math.PI / 2) * 180 / Math.PI).toFixed(1) + "deg)" : "";
      }
      B.car.hidden = !(s.phone && (s.nearCar || s.driving));
      B.dodge.hidden = !(s.phone && s.warn);
      if (B.dodge.hidden) touch.dodge = false;
      B.throw.hidden = !(s.phone && s.throwable && !s.warn);
      if (B.throw.hidden) touch.throw = false;
      // GLIDE shows in the air with no rope out (s.air), and stays while a finger holds it
      if (s.phone && s.air) B.glide.hidden = false;
      else if (!touch.glide || !s.phone) { B.glide.hidden = true; touch.glide = false; B.glide.classList.remove("on"); }
      B.car.textContent = s.driving ? "OUT" : "CAR";
      if (hitT > 0) { hitT -= dt; if (hitT <= 0) hit.style.opacity = "0"; }
      if (bannerT > 0 && (bannerT -= dt) <= 0) banner.hidden = true;
    },
    // a comic banner over the middle of the view for time s: the Gauntlet's rounds (red), and a yellow stamp when one is cleared
    banner(title, sub = "", stamp = false, time = 1.6) {
      banner.querySelector("b").textContent = title; banner.querySelector("small").textContent = sub;
      banner.classList.toggle("stamp", !!stamp);
      banner.classList.remove("go"); void banner.offsetWidth; banner.classList.add("go");
      banner.hidden = false; bannerT = time;
    },
    // read and clear the CAR press
    takeCar() { const v = touch.car; touch.car = false; return v; },
    // read and clear the DODGE press (phone)
    takeDodge() { const v = touch.dodge; touch.dodge = false; return v; },
    takeThrow() { const v = touch.throw; touch.throw = false; return v; },
    flash() { hit.style.opacity = "1"; hitT = 0.25; },
    info: () => ({ hidden: hud.hidden, hearts: shown.hp, energy: shown.e, combo: shown.c, focus: shown.f, warn: !warn.hidden, prompt: prompt.hidden ? "" : prompt.textContent, shout: shout.hidden ? "" : shout.textContent, banner: banner.hidden ? "" : banner.textContent, car: !B.car.hidden, dodge: !B.dodge.hidden, throw: !B.throw.hidden, glide: !B.glide.hidden, goal: goal.hidden ? "" : goal.innerText.replace(/\n/g, " "), goalOff: goal.classList.contains("off") }),
  };
  return H;
}
