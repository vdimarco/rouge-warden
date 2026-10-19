// First Breath: stage 6, Second Trimester (`answer`), its facts (design.md 15.1, 15.2). Each text and source is the
// 15.2 row; every key is in core/sources.js. The card shows answer.card and answer.tri (core/run.js), the stage emits
// the captions on the clock (each at the gaDay its label names; answer.feel at week 16, the start of the span it
// names, in the quiet beat moment), and the stage-end overlay shows answer.eyes. answer.outside and answer.hic have no
// room in the stage to show whole: they are "result" facts, listed in "What was real" (design.md 6.6, 12).
// core/facts.js gathers this table through core/stages/index.js.
const F = (id, gaDay, text, src, access, where) => Object.freeze({
  id, stage: "answer", gaDay, text, src: Object.freeze(src), access, checked: true, where,
});

export const FACTS = Object.freeze([
  F("answer.card", 98, "About 8.5 cm, a kiwi fruit, the NHS says.", ["NHS week 14"], "R", "card"),
  F("answer.tri", 98, "Second trimester: about weeks 14 to 27.", ["CC 9699", "NHS week 28"], "R", "card"),
  F("answer.hear", 105, "You start to hear {carer}'s heartbeat.", ["NHS week 15"], "R", "caption"),
  F("answer.respond", 133, "In one study, the first response to sound was to a low tone.", ["PMID 7979483"], "A", "caption"),
  F("answer.w20", 140, "About 25.6 cm, a banana, the NHS says. From now, length is head to heel.", ["NHS week 20"], "R", "caption"),
  F("answer.feel", 112, "{Carer} may first feel you move between about week 16 and week 24.", ["CC 22829", "NHS week 17"], "R", "caption"),
  F("answer.outside", 147, "By week 21, you can hear voices outside the womb.", ["NHS week 21"], "R", "result"),
  F("answer.low", 154, "Low sounds reach you first. High sounds come later.", ["PMID 7979483"], "A", "caption"),
  F("answer.hic", 161, "You can get hiccups by about week 19.", ["CC 7247"], "R", "result"),
  F("answer.jump", 175, "A loud noise can make you jump.", ["NHS week 25"], "R", "caption"),
  F("answer.eyes", 182, "Your eyes open for the first time.", ["NHS week 26"], "R", "overlay"),
]);
