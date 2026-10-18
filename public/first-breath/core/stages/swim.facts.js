// First Breath: stage 1, The Race (`swim`), its facts (design.md 6.1, 15.1, 15.2). Every text, gaDay and source is
// the 15.2 row as written; the source keys are in core/sources.js, built from research/research-biology.md section 12
// (sections 2 and 3 of that sheet hold each claim). `access` is the weaker tag of a fact's sources: "A" when any of
// them was read only as an abstract. All are gaDay 14 before fertilization, so each label reads "Week 2". The stage
// emits `fact` events for the captions; core/run.js shows the overlay fact (`swim.wait`) and the run result's
// (`swim.frame`) by their `where`. `swim.race` is left out on purpose (tasks.md 2.4).
const fact = (id, text, src, access, where = "caption") =>
  Object.freeze({ id, stage: "swim", gaDay: 14, fertilized: false, text, src: Object.freeze(src), access, checked: true, where });

export const FACTS = Object.freeze([
  fact("swim.half", "Half of your genes ride in this sperm cell. The other half are in an egg.",
    ["TTUHSC first week", "PMID 33964210"], "A"),
  fact("swim.waves", "In one study, waves carried sperm-sized particles to a tube in about a minute.",
    ["PMID 8671281"], "A"),
  fact("swim.few", "Only a few thousand sperm reach the tubes. One study found about 250 there.",
    ["PMID 16272225", "PMID 8150897"], "A"),
  fact("swim.side", "The waves sent most of the particles toward the tube on the egg's side.",
    ["PMID 8671281"], "A"),
  fact("swim.warm", "Ready sperm swim toward warmer places.", ["PMID 22848657"], "A"),
  fact("swim.flow", "Sperm turn to swim against a gentle flow.", ["PMID 23453951"], "A"),
  fact("swim.walls", "Sperm that meet a wall tend to swim along it.", ["PMID 26183721"], "A"),
  fact("swim.rest", "In many mammals, sperm rest on the tube wall before the egg comes. Human data are less clear.",
    ["PMID 26183721", "PMID 8150897"], "A"),
  fact("swim.ready", "In lab tests, only 2 to 14 in 100 sperm are ready at one time.", ["PMID 7479932"], "A"),
  fact("swim.hyper", "Ready sperm swim harder. It helps a sperm push through to the egg.", ["PMID 16272225"], "A"),
  fact("swim.wait", "Sperm can stay alive in the body for up to five days.", ["CC sperm"], "R", "overlay"),
  fact("swim.frame", "In the game you race. In life, a sperm must be ready at the right time and place.",
    ["PMID 16607290", "PMID 7479932"], "A", "result"),
]);
