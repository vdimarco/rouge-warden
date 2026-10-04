// The touch cast rail: a thin rail beside the finger while it holds the line. The bead is the rod: drag it down past LOAD
// (the second mark is full power), then flick up and let go in the green band. The marks come from touchDy() in cast.js,
// the mapping the cast itself uses, so the bead crosses LOAD in the frame the rod loads. The CSS is in index.html (#castRail)
import { CAST, TOUCH, touchDy } from "./cast.js";

// the green band: the release angles that grade sweet (a raw launch pitch between LOW_PITCH and HIGH_PITCH)
const SWEET = [CAST.LOW_PITCH + CAST.PITCH_OFFSET, CAST.HIGH_PITCH + CAST.PITCH_OFFSET];
// the rod angles at the two ends of the rail, how far beside the finger it stands, and the room its words need (px)
const TOP = 40, BOTTOM = 140, GAP = 46, WORDS = 84;

// The lowest edge the rail must stay below, in #game px: the HUD, and the lines of the prompt that stand beside the rail
// (x0..x1). #prompt is centred with translateX(-50%), which offsetLeft leaves out
function ceiling(game, x0, x1) {
  let y = 0;
  const hud = game.querySelector("#hud"), pr = game.querySelector("#prompt");
  if (hud && !hud.hidden) y = hud.offsetTop + hud.offsetHeight;
  if (pr && !pr.hidden) {
    const left = pr.offsetLeft - pr.offsetWidth / 2;
    for (const n of pr.children) {
      const l = left + n.offsetLeft;
      if (n.offsetHeight && l < x1 && l + n.offsetWidth > x0) y = Math.max(y, pr.offsetTop + n.offsetTop + n.offsetHeight);
    }
  }
  return y;
}

export function createCastRail(game) {
  const el = document.createElement("div");
  el.id = "castRail"; el.hidden = true;
  el.setAttribute("aria-hidden", "true");
  el.innerHTML = "<i class='track'></i><i class='band'></i><i class='mark press'></i><i class='mark load'></i><i class='mark full'></i><b class='bead'></b><span class='t-load'>LOAD</span><span class='t-go'>LET GO</span>";
  game.append(el);
  const $ = (s) => el.querySelector(s);
  const P = { band: $(".band"), press: $(".press"), load: $(".load"), full: $(".full"), bead: $(".bead"), tLoad: $(".t-load"), tGo: $(".t-go") };
  // top, len: the rail's ends in px from the press point (a press high up cuts the top short)
  let key = "", beadY = null, tone = "", clash = false, top = 0, len = 0;
  return {
    el,
    // s: { x, y0 (the press point), theta (the rod now), span (touchSpan), fit } in #game px; null hides the rail.
    // fit: a hold cast (the mouse button, Space), where the clock moves the rod and not the finger: the rail may stand lower
    // or higher than the press point, so all of it shows
    update(s) {
      if (!s) { if (!el.hidden) { el.hidden = true; key = ""; beadY = null; } return; }
      const h = s.span, W = game.clientWidth, dy = (th) => Math.round(touchDy(th, h));
      // beside the finger, on the side with room for the rail and its words
      const x = Math.round(s.x + GAP + WORDS > W ? s.x - GAP : s.x + GAP), flip = x < s.x;
      let y0 = Math.round(s.y0);
      const k = x + ":" + y0 + ":" + h + ":" + !!s.fit;
      if (k !== key) {
        key = k;
        // under the HUD and the prompt, and on the screen: a rail that would run past either is cut short there
        const sky = ceiling(game, flip ? x - 12 - WORDS : x - 12, flip ? x + 12 : x + 12 + WORDS);
        if (s.fit) y0 = Math.max(Math.min(y0, game.clientHeight - 6 - dy(BOTTOM)), sky + 6 - dy(TOP));
        top = Math.max(dy(TOP), sky + 6 - y0);
        len = Math.min(dy(BOTTOM), game.clientHeight - 6 - y0) - top;
        Object.assign(el.style, { left: x + "px", top: y0 + top + "px", height: Math.max(0, len) + "px" });
        el.classList.toggle("flip", flip);
        // a mark or a word off the cut rail hides
        const at = (n, th) => { const v = dy(th) - top; n.hidden = v < 0 || v > len; n.style.top = v + "px"; };
        at(P.press, TOUCH.REST); at(P.load, CAST.LOAD_THETA); at(P.full, CAST.IDEAL_RELEASE + CAST.BACK_FULL); at(P.tLoad, CAST.LOAD_THETA);
        // the green band, as much of it as is on the rail; its words go in the middle of that
        const b0 = Math.max(0, dy(SWEET[0]) - top), b1 = Math.min(len, dy(SWEET[1]) - top);
        P.band.hidden = b1 - b0 < 6; P.tGo.hidden = b1 - b0 < 16;
        Object.assign(P.band.style, { top: b0 + "px", height: Math.max(0, b1 - b0) + "px" });
        P.tGo.style.top = (b0 + b1) / 2 + "px";
        // a rail with too little room left to read hides. The animated guide gives way to the rail (guide.js place)
        clash = len < 40;
      }
      const by = Math.max(0, Math.min(len, dy(s.theta) - top));
      if (by !== beadY) { beadY = by; P.bead.style.top = by + "px"; }
      const t = s.theta >= CAST.LOAD_THETA ? "loaded" : s.theta >= SWEET[0] && s.theta <= SWEET[1] ? "go" : "";
      if (t !== tone) { if (tone) el.classList.remove(tone); if (t) el.classList.add(t); tone = t; }
      el.hidden = clash;
    },
  };
}
