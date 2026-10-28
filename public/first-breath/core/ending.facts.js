// First Breath: the ending (`ending`), its facts (design.md 6.9, 15.1, 15.2). Each source key is in core/sources.js
// and in research/research-biology.md ("First breath, fluid and shunts", "First cry and first minutes",
// "Skin-to-skin", "Apgar score"). The captions show during the ending; end.apgar and end.fluid show only on the run
// result ("What was real"): the ending has no room for end.fluid to show whole (design.md 6.9, 12).
export const FACTS = Object.freeze([
  { id: "end.seconds", stage: "ending", gaDay: 280, text: "It can take a few seconds. That is normal.",
    src: ["NHS week 39"], access: "R", checked: true, where: "result" },
  { id: "end.breath", stage: "ending", gaDay: 280, text: "Babies take a first breath within about 10 seconds.",
    src: ["MedlinePlus 002395"], access: "R", checked: true, where: "caption" },
  { id: "end.fluid", stage: "ending", gaDay: 280, text: "Air fills your lungs. The fluid in your lungs clears.",
    src: ["MedlinePlus 002395"], access: "R", checked: true, where: "result" },
  { id: "end.skin", stage: "ending", gaDay: 280, text: "Skin-to-skin contact helps your breathing and your heart rate.",
    src: ["NHS skin-to-skin"], access: "R", checked: true, where: "caption" },
  { id: "end.voice", stage: "ending", gaDay: 280, text: "In one study, newborns preferred {carer}'s voice to a stranger's.",
    src: ["PMID 7375928"], access: "A", checked: true, where: "caption" },
  { id: "end.apgar", stage: "ending", gaDay: 280,
    text: "One minute after birth, a midwife or doctor checks five things. This is the Apgar score.",
    src: ["MedlinePlus 003402"], access: "R", checked: true, where: "result" },
]);
