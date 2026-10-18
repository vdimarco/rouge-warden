// First Breath: stage 8, Birth (`birth`), its facts (design.md 15.1, 15.2, 6.8). Each entry: { id, stage, gaDay,
// gaEnd?, fertilized?, text, src: [keys of core/sources.js], access: "R" | "A", checked, where }. The card fact shows
// on the stage card (core/run.js emits it); the stage emits each caption as a fact event { id, where: "caption" }.
// Every text and source is the 15.2 row as written there, checked against research/research-biology.md (labour,
// the mechanism of labour, the skull bones, the due date). No overlay fact: there is no overlay after Birth.
export const FACTS = Object.freeze([
  { id: "birth.card", stage: "birth", gaDay: 280, text: "Most labours start within a week either side of the due date.",
    src: ["NHS week 39"], access: "R", checked: true, where: "card" },
  { id: "birth.fast", stage: "birth", gaDay: 280, text: "Time is sped up. Real waves come minutes apart.",
    src: ["CC 22640"], access: "R", checked: true, where: "caption" },
  { id: "birth.waves", stage: "birth", gaDay: 280, text: "Waves called contractions help you move down.",
    src: ["CC 22640"], access: "R", checked: true, where: "caption" },
  { id: "birth.tuck", stage: "birth", gaDay: 280, text: "You tuck your chin. The smallest part of your head leads.",
    src: ["OB-GYN 101 mechanism", "GLOWM"], access: "R", checked: true, where: "caption" },
  { id: "birth.turn", stage: "birth", gaDay: 280, text: "You turn as you move down, to fit the way out.",
    src: ["GLOWM", "OpenStax 15.2"], access: "R", checked: true, where: "caption" },
  { id: "birth.skull", stage: "birth", gaDay: 280, text: "Your skull bones are soft. Your head can change shape a little.",
    src: ["NHS week 33"], access: "R", checked: true, where: "caption" },
  { id: "birth.overlap", stage: "birth", gaDay: 280, text: "These moves overlap. Each one blends into the next.",
    src: ["PMID 34214716"], access: "A", checked: true, where: "caption" },
].map((f) => Object.freeze({ ...f, src: Object.freeze(f.src) })));
