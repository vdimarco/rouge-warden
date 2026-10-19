// First Breath: stage 4, The Placenta (`root`), its facts (design.md 15.1, 15.2, 6.4). Each entry: { id, stage, gaDay,
// gaEnd?, text, src: [keys of core/sources.js], access, checked, where }. The texts and sources are the 15.2 rows, which
// research/research-biology.md backs (section 4 facts 9 and 11; section 5 facts 1, 8, 9, 28 and 29; the section 6 rows
// for weeks 5 to 7). `access` is per fact: R when at least one of its sources was read in full, else A (root.glands
// rests on two abstracts). Labels are made by clock.label / clock.range; no text starts with "Week" or "Day".
// When each shows (root.js): the card before the stage (root.bury), captions as the clock reaches them (root.hcg
// and root.heart), and the overlay after it (root.w7). The others have no room to show whole in the stage: "result"
// facts, listed in "What was real" (design.md 12).
const f = (id, gaDay, text, src, access, where, gaEnd) => Object.freeze({
  id, stage: "root", gaDay, ...(gaEnd !== undefined ? { gaEnd } : {}), text, src: Object.freeze(src), access, checked: true, where,
});

export const FACTS = Object.freeze([
  f("root.bury", 20, "You bury yourself in the soft lining of the womb.", ["UNSW Week 2", "PMID 12050279"], "R", "card", 23),
  f("root.hcg", 23, "You start to send a signal called hCG. Pregnancy tests look for it.", ["UNSW Week 2", "CC 22489 hCG"], "R", "caption"),
  f("root.grows", 25, "The placenta grows from you. It has the same genes as you.", ["CC 22337 placenta"], "R", "result"),
  f("root.glands", 28, "At first, glands in the lining feed you. Oxygen is low, and that is normal.", ["PMID 12050279", "PMID 11106583"], "A", "result"),
  f("root.heart", 36, "Your heart beats for the first time.", ["UNSW heart"], "R", "caption"),
  f("root.tube", 36, "Your heart is a simple tube for now.", ["CC 7247", "UNSW heart"], "R", "result"),
  f("root.size", 36, "About 2 mm long. The NHS compares this to a sesame seed.", ["NHS week 5"], "R", "result"),
  f("root.buds", 42, "About 6 mm long. Small buds appear that will become your arms and legs.", ["NHS week 6"], "R", "result"),
  f("root.w7", 49, "About 10 mm long. Your eyelids start to form.", ["NHS week 7"], "R", "overlay"),
]);
