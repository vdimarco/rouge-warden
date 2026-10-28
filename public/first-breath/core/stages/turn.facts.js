// First Breath: stage 7, Third Trimester (`turn`), its facts (design.md 15.1, 15.2, 4.10, 5.7). Each entry: { id, stage,
// gaDay, gaEnd?, text, src: [keys of core/sources.js], access: "R" | "A", checked, where }. core/facts.js gathers it
// through core/stages/index.js. The card fact shows on the stage card and the overlay fact on the stage-end overlay
// (core/run.js shows both); the stage emits each caption fact as `fact { id, where: "caption" }` at a calm point once
// gaDay reaches it: turn.antibody as the first darts fly, turn.lungs, turn.focus, turn.months and turn.practice in the
// 1 s calms at each wave start (12, 24, 36 and 48 s), turn.head at head-down, turn.curl in the rest. turn.voices and
// turn.frame have no room among them (pacing.test.mjs): they are "What was real" facts on the result.
//
// The new facts (design.md 4.10) were checked against their sources on 2026-10-19: research-biology.md 5.14 and 5.15,
// the Cleveland Clinic placenta page ("As you get closer to delivery, the placenta passes antibodies ... to the fetus";
// "This immunity sticks with your baby for several months after birth") and the abstract of PMID 22235228 (IgG is the
// only antibody class that significantly crosses the placenta; its transfer depends on gestational age; it protects the
// infant).
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
    id: "turn.antibody", stage: "turn", gaDay: 196,
    text: "Antibodies from {carer} cross the placenta to you. Most pass near the end.",
    src: ["CC 22337", "PMID 22235228"], access: "R", checked: true, where: "caption",
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
    id: "turn.months", stage: "turn", gaDay: 217,
    text: "This protection lasts for several months after you are born.",
    src: ["CC 22337"], access: "R", checked: true, where: "caption",
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
    id: "turn.voices", stage: "turn", gaDay: 217,
    text: "You start to know voices from outside.",
    src: ["NHS week 31"], access: "R", checked: true, where: "result",
  },
  {
    id: "turn.frame", stage: "turn", gaDay: 196,
    text: "In the game antibodies fly at germs. In life, antibodies travel quietly in your blood.",
    src: ["PMID 22235228"], access: "A", checked: true, where: "result",
  },
  {
    id: "turn.voice", stage: "turn", gaDay: 266,
    text: "Near birth, your heart beats faster when you hear {carer}'s voice.",
    src: ["PMID 12741744"], access: "A", checked: true, where: "overlay",
  },
].map((f) => Object.freeze({ ...f, src: Object.freeze(f.src) })));
