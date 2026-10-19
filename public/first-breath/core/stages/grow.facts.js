// First Breath: stage 5, First Trimester (`grow`), its facts (design.md 15.1, 15.2). Each text and source is the 15.2
// row, unchanged; every key is in core/sources.js, and every row is in research/research-biology.md (6, 4, 5).
// The card shows grow.w7 and grow.tri (core/run.js), the stage emits the captions on the clock (each at the gaDay
// its label names: a phrase's start, or 3 s into it), and the stage-end overlay shows grow.w13. grow.w11kick,
// grow.flow and grow.never have no room to show whole in the stage: "result" facts, listed in "What was real"
// (design.md 12). core/facts.js gathers this table through core/stages/index.js.
const F = (id, gaDay, text, src, access, where) => Object.freeze({
  id, stage: "grow", gaDay, text, src: Object.freeze(src), access, checked: true, where,
});

export const FACTS = Object.freeze([
  F("grow.w7", 49, "Your brain grows faster than your body.", ["NHS week 7"], "R", "card"),
  F("grow.tri", 49, "First trimester: up to about week 13.", ["CC 9699 first trimester", "NHS week 4"], "R", "card"),
  F("grow.w8", 56, "About 16 mm, a raspberry, the NHS says. Your head uncurls.", ["NHS week 8"], "R", "caption"),
  F("grow.arms", 56, "Your arms grow faster than your legs.", ["NHS week 8"], "R", "caption"),
  F("grow.peak", 63, "Your heart now beats about 170 times a minute.", ["NHS week 28"], "R", "caption"),
  F("grow.fetus", 70, "From about now you are called a fetus. Sources differ, from week 8 to week 10.",
    ["NHS week 8", "MedlinePlus 002398", "UNSW Carnegie table"], "R", "caption"),
  F("grow.w11", 77, "You open and close your fists.", ["CC 7247"], "R", "caption"),
  F("grow.w11kick", 77, "You kick, but {carer} cannot feel it yet.", ["NHS week 11"], "R", "result"),
  F("grow.w12", 84, "About 5.4 cm, a plum, the NHS says. Your bones start to harden.", ["NHS week 12"], "R", "caption"),
  F("grow.flow", 84, "Near week 12, more of {carer}'s blood flows into the placenta.", ["PMID 11106583", "PMID 12050279"], "A", "result"),
  F("grow.never", 84, "Your blood and {carer}'s blood never touch.", ["embryology.ch villi", "CC 22337"], "R", "result"),
  F("grow.w13", 91, "Some babies start to suck a thumb.", ["NHS week 13"], "R", "overlay"),
]);
