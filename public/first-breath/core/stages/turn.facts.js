// First Breath: stage 7, Third Trimester (`turn`), its facts (design.md 15.1, 15.2, 6.7). Each entry: { id, stage, gaDay,
// gaEnd?, text, src: [keys of core/sources.js], access: "R" | "A", checked, where }. core/facts.js gathers it through
// core/stages/index.js. The card fact shows on the stage card and the overlay fact on the stage-end overlay (core/run.js
// shows both); the stage emits each caption fact as `fact { id, where: "caption" }` once gaDay reaches it.
//
// Left out: `turn.weight` ("From week 28 to week 40, your weight about triples.", WHO fetal growth charts). design.md
// 15.1 keeps it `checked: false` until the 2017 and 2021 WHO corrections are reviewed, and core/run.js picks card facts
// by stage and `where` alone (it does not read `checked`), so listing it here would show it on the card. It comes back
// here, with `checked: true`, once it is reviewed.
export const FACTS = Object.freeze([
  {
    id: "turn.card", stage: "turn", gaDay: 196,
    text: "Third trimester: about week 28 to birth. About 37.6 cm long.",
    src: ["NHS week 28"], access: "R", checked: true, where: "card",
  },
  {
    id: "turn.lungs", stage: "turn", gaDay: 203,
    text: "Your lungs are full of fluid. Oxygen still comes through the cord.",
    src: ["MedlinePlus 002395"], access: "R", checked: true, where: "caption",
  },
  {
    id: "turn.focus", stage: "turn", gaDay: 210,
    text: "Your eyes can focus.",
    src: ["NHS week 30"], access: "R", checked: true, where: "caption",
  },
  {
    id: "turn.voices", stage: "turn", gaDay: 217,
    text: "You start to know voices from outside.",
    src: ["NHS week 31"], access: "R", checked: true, where: "caption",
  },
  {
    id: "turn.practice", stage: "turn", gaDay: 217, gaEnd: 238,
    text: "You make breathing movements for practice.",
    src: ["MedlinePlus 002398"], access: "R", checked: true, where: "caption",
  },
  {
    id: "turn.curl", stage: "turn", gaDay: 238,
    text: "You curl up with your legs bent to your chest.",
    src: ["NHS week 34"], access: "R", checked: true, where: "caption",
  },
  {
    id: "turn.head", stage: "turn", gaDay: 252,
    text: "Most babies turn head-down by 36 to 37 weeks.",
    src: ["RCOG breech"], access: "R", checked: true, where: "caption",
  },
  {
    id: "turn.voice", stage: "turn", gaDay: 266,
    text: "Near birth, your heart beats faster when you hear {carer}'s voice.",
    src: ["PMID 12741744"], access: "A", checked: true, where: "overlay",
  },
].map((f) => Object.freeze({ ...f, src: Object.freeze(f.src) })));
