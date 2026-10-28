// First Breath: the captions' clock for an action stage's knock-out (contract.md section 4). A knock-out ends a stage
// early, and v1's pacing rule still holds: every caption fact a stage sends shows whole before it ends. So a stage
// notes what it has said (noteCaptions, after each step) and, once knocked out, rests until that would be read
// (readBy). The model follows ui/captions.js roughly, one at a time: a fact for max(4 s, 1.5 s + 55 ms a letter,
// with room for the longest carer word), a line (a sub-goal) for max(2 s, 1 s + 50 ms a letter). Pure.
//
// Use: in create, st.capBusy = 0 and st.evSeen = 0 (or call noteCaptions once after the first events); after each
// step, noteCaptions(st, FACTS, TEXT) with the stage's own tables (a stage may import its own .facts.js and .text.js);
// on a knock-out, end the stage once st.t >= readBy(st, st.koAt + minS).
export const READ = Object.freeze({ factMinS: 4, factS: 1.5, letterS: 0.055, carerPad: 12, lineMinS: 2, lineS: 1, lineLetterS: 0.05 });

export function noteCaptions(st, facts, text) {
  if (!Number.isFinite(st.capBusy)) st.capBusy = 0;
  if (!Number.isFinite(st.evSeen) || st.events.length < st.evSeen) st.evSeen = 0;      // the host drained the events
  for (let i = st.evSeen; i < st.events.length; i++) {
    const e = st.events[i];
    let s = 0;
    if (e.name === "fact" && e.where === "caption") {
      const f = (facts || []).find((x) => x.id === e.id);
      if (f) s = Math.max(READ.factMinS, READ.factS + READ.letterS * (f.text.length + READ.carerPad));
    } else if (e.name === "subgoal" && e.text && text && text[e.text]) {
      s = Math.max(READ.lineMinS, READ.lineS + READ.lineLetterS * text[e.text].length);
    }
    if (s > 0) st.capBusy = Math.max(st.capBusy, st.t) + s;
  }
  st.evSeen = st.events.length;
}

// When the stage may end: not before `notBefore`, and not before what was said is read (plus a little).
export function readBy(st, notBefore) {
  return Math.max(notBefore, (Number.isFinite(st.capBusy) ? st.capBusy : 0) + 0.3);
}
