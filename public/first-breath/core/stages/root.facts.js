// First Breath: stage 4, The Placenta (`root`), its facts (v1 design.md 15.1, 15.2; first-breath-action-genres design.md
// 5.4, 4.10). Each entry: { id, stage, gaDay, gaEnd?, text, src: [keys of core/sources.js], access, checked, where }.
// The texts and sources are the v1 rows, which research/research-biology.md backs (section 4 facts 9 and 11; section 5
// facts 1, 8, 9, 28 and 29; the section 6 rows for weeks 5 to 7). `access` is per fact: R when at least one of its
// sources was read in full, else A (root.glands rests on two abstracts). Labels are made by clock.label / clock.range.
// When each shows (root.js), in priority order: the card before the stage (root.bury); captions root.hcg as the roots
// start, root.glands at your first link, root.heart in the hush; the overlay after it (root.w7). The others are
// "What was real" facts on the result. root.frame (new) names the game framing: its source lines are research 5.3 and
// 5.4 (villi grow, branch and lie in the blood-filled spaces), and the embryology.ch villi page was re-read for it
// ("Numerous 'daughter' villi arise out of the tertiary villi"; some "anchor themselves to the basal plate"), so it
// says the roots branch out and hold on to the lining, not that they dig into it.
const f = (id, gaDay, text, src, access, where, gaEnd) => Object.freeze({
  id, stage: "root", gaDay, ...(gaEnd !== undefined ? { gaEnd } : {}), text, src: Object.freeze(src), access, checked: true, where,
});

export const FACTS = Object.freeze([
  f("root.bury", 20, "You bury yourself in the soft lining of the womb.", ["UNSW Week 2", "PMID 12050279"], "R", "card", 23),
  f("root.hcg", 23, "You start to send a signal called hCG. Pregnancy tests look for it.", ["UNSW Week 2", "CC 22489 hCG"], "R", "caption"),
  f("root.grows", 25, "The placenta grows from you. It has the same genes as you.", ["CC 22337 placenta"], "R", "result"),
  f("root.glands", 28, "At first, glands in the lining feed you. Oxygen is low, and that is normal.", ["PMID 12050279", "PMID 11106583"], "A", "caption"),
  f("root.heart", 36, "Your heart beats for the first time.", ["UNSW heart"], "R", "caption"),
  f("root.tube", 36, "Your heart is a simple tube for now.", ["CC 7247", "UNSW heart"], "R", "result"),
  f("root.size", 36, "About 2 mm long. The NHS compares this to a sesame seed.", ["NHS week 5"], "R", "result"),
  f("root.buds", 42, "About 6 mm long. Small buds appear that will become your arms and legs.", ["NHS week 6"], "R", "result"),
  f("root.w7", 49, "About 10 mm long. Your eyelids start to form.", ["NHS week 7"], "R", "overlay"),
  f("root.frame", 20, "In the game you tunnel and grapple. In life, your roots branch out and hold on to the lining.",
    ["embryology.ch villi", "UNSW Week 2"], "R", "result"),
]);
