// The touch cast rail: a thin rail beside the finger while it holds the line. The bead is the rod: drag it down past LOAD
// (the second mark is full power), then flick up and let go in the green band. The marks come from touchDy() in cast.js,
// the mapping the cast itself uses, so the bead crosses LOAD in the frame the rod loads. The CSS is in index.html (#castRail)
import { CAST, TOUCH, touchDy } from "./cast.js";

// the green band: the release angles that grade sweet (a raw launch pitch between LOW_PITCH and HIGH_PITCH)
const SWEET = [CAST.LOW_PITCH + CAST.PITCH_OFFSET, CAST.HIGH_PITCH + CAST.PITCH_OFFSET];
// the rod angles at the two ends of the rail, how far beside the finger it stands, and the room its words need (px)
const TOP = 40, BOTTOM = 140, GAP = 46, WORDS = 84;

export function createCastRail(game) {
  const el = document.createElement("div");
  el.id = "castRail"; el.hidden = true;
  el.setAttribute("aria-hidden", "true");
  el.innerHTML = "<i class='track'></i><i class='band'></i><i class='mark press'></i><i class='mark load'></i><i class='mark full'></i><b class='bead'></b><span class='t-load'>LOAD</span><span class='t-go'>LET GO</span>";
  game.append(el);
  const $ = (s) => el.querySelector(s);
  const P = { band: $(".band"), press: $(".press"), load: $(".load"), full: $(".full"), bead: $(".bead"), tLoad: $(".t-load"), tGo: $(".t-go") };
  const guide = () => game.querySelector("#fishGuide");
  let key = "", beadY = null, tone = "", clash = false;
  return {
    el,
    // s: { x, y0 (the press point), theta (the rod now), span (touchSpan) } in #game px; null hides the rail
    update(s) {
      if (!s) { if (!el.hidden) { el.hidden = true; key = ""; beadY = null; } return; }
      const h = s.span, W = game.clientWidth, dy = (th) => Math.round(touchDy(th, h));
      const top = dy(TOP), len = dy(BOTTOM) - top;
      // beside the finger, on the side with room for the rail and its words
      const x = Math.round(s.x + GAP + WORDS > W ? s.x - GAP : s.x + GAP), y = Math.round(s.y0 + top);
      const k = x + ":" + y + ":" + h;
      if (k !== key) {
        key = k;
        Object.assign(el.style, { left: x + "px", top: y + "px", height: len + "px" });
        el.classList.toggle("flip", x < s.x);
        const at = (n, th) => { n.style.top = dy(th) - top + "px"; };
        at(P.band, SWEET[0]); P.band.style.height = dy(SWEET[1]) - dy(SWEET[0]) + "px";
        at(P.press, TOUCH.REST); at(P.load, CAST.LOAD_THETA); at(P.full, CAST.IDEAL_RELEASE + CAST.BACK_FULL);
        at(P.tLoad, CAST.LOAD_THETA); at(P.tGo, (SWEET[0] + SWEET[1]) / 2);
        // the animated guide has the room there: the rail gives way (it moves with each new press)
        const g = guide();
        clash = !!g && !g.hidden && g.offsetLeft < x + 60 && g.offsetLeft + g.offsetWidth > x - 60 && g.offsetTop < y + len && g.offsetTop + g.offsetHeight > y;
      }
      const by = Math.max(0, Math.min(len, dy(s.theta) - top));
      if (by !== beadY) { beadY = by; P.bead.style.top = by + "px"; }
      const t = s.theta >= CAST.LOAD_THETA ? "loaded" : s.theta >= SWEET[0] && s.theta <= SWEET[1] ? "go" : "";
      if (t !== tone) { if (tone) el.classList.remove(tone); if (t) el.classList.add(t); tone = t; }
      el.hidden = clash;
    },
  };
}
