// First Breath: stage 3, The Embryo: first cells (`split`), its facts (design.md 6.3, 15.1, 15.2). Every source key is
// in core/sources.js and in research/research-biology.md section 4 (cleavage, the trip down the tube, hatching).
// The card fact shows on the stage card; the captions as the cells reach each day; the overlay at the stage end.
export const FACTS = Object.freeze([
  { id: "split.two", stage: "split", gaDay: 15, text: "You are 2 cells.",
    src: ["embryology.ch migration"], access: "R", checked: true, where: "card" },
  { id: "split.small", stage: "split", gaDay: 16, text: "You divide, but you do not grow. Your cells get smaller.",
    src: ["UNSW Carnegie table"], access: "R", checked: true, where: "caption" },
  { id: "split.carried", stage: "split", gaDay: 16, text: "Tiny hairs and gentle squeezes of the tube carry you toward the womb.",
    src: ["embryology.ch migration"], access: "R", checked: true, where: "caption" },
  { id: "split.morula", stage: "split", gaDay: 18, text: "You are a ball of 16 to 32 cells.",
    src: ["embryology.ch migration"], access: "R", checked: true, where: "caption" },
  { id: "split.inner", stage: "split", gaDay: 19, text: "Your inner cells become you. Your outer cells help make the placenta.",
    src: ["MedlinePlus 002398", "CC 22889 blastocyst"], access: "R", checked: true, where: "caption" },
  { id: "split.hatch", stage: "split", gaDay: 20, text: "You hatch from your clear shell.",
    src: ["embryology.ch migration"], access: "R", checked: true, where: "overlay" },
].map((f) => Object.freeze({ ...f, src: Object.freeze(f.src) })));
