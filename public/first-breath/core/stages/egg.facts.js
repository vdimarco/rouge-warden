// First Breath: stage 2, The Egg (`egg`), its facts (design.md 15.1, 15.2, 6.2). Each entry: { id, stage, gaDay,
// fertilized, text, src: [keys of core/sources.js], access: "R" | "A", checked, where }. The texts and sources are the
// 15.2 table's; every key is in the allow-list (core/sources.js, from research/research-biology.md section 12). When
// a fact has sources of both kinds, `access` is the weaker one (A). In this stage only the facts shown once the nuclei
// touch (egg.pronuclei, egg.place, egg.weeks) are fertilized, so each caption's label matches the HUD ("Week 2"
// until then). core/facts.js gathers this table through core/stages/index.js.
const f = (id, text, src, access, where, fertilized = false) =>
  Object.freeze({ id, stage: "egg", gaDay: 14, fertilized, text, src: Object.freeze(src), access, checked: true, where });

export const FACTS = Object.freeze([
  f("egg.surge", "A surge of a hormone called LH releases the egg.", ["CC 23439 ovulation"], "R", "card"),
  f("egg.fimbriae", "Finger-like ends of the tube move close and catch the egg.", ["CC 24346 fimbriae"], "R", "caption"),
  f("egg.cilia", "The egg cannot swim. Tiny hairs called cilia sweep it into the tube.",
    ["embryology.ch migration", "CC 24346"], "R", "caption"),
  f("egg.zona", "A clear shell called the zona pellucida protects the egg.", ["CC 22889 blastocyst", "TTUHSC"], "R", "caption"),
  f("egg.corona", "A cloud of cells surrounds the egg. Sperm pass through the corona to reach the shell.",
    ["PMID 21412339", "TTUHSC"], "A", "caption"),
  f("egg.choice", "In one study, the fluid around eggs drew some men's sperm more than others.",
    ["PMID 32517615"], "A", "caption"),
  f("egg.signal", "Cells around the egg release a signal. It helps ready sperm find the egg.", ["PMID 21412339"], "A", "caption"),
  f("egg.size", "The egg is about 0.1 mm across, about two sperm lengths.", ["BioNumbers 111184", "PMID 22848657"], "A", "caption"),
  f("egg.day", "The egg can meet a sperm for about a day.", ["CC 23439"], "R", "caption"),
  f("egg.stick", "A sperm passes the corona and sticks to the shell. Then it works its way through.", ["TTUHSC"], "R", "caption"),
  f("egg.fuse", "A sperm protein called Izumo1 meets an egg protein called Juno.", ["PMID 24739963"], "A", "caption"),
  f("egg.wave", "A wave spreads through the egg from where the sperm entered.", ["TTUHSC"], "R", "caption"),
  f("egg.seal", "Tiny granules in the egg release enzymes. These change the shell and harden it.", ["TTUHSC"], "R", "caption"),
  f("egg.block", "Now no other sperm can stick to the shell or get through.", ["TTUHSC", "PMID 24739963"], "A", "caption"),
  f("egg.pronuclei", "The two nuclei touch but stay apart. The two sets join at the first split.",
    ["PMID 33964210"], "A", "caption", true),
  f("egg.place", "This usually happens in the wide outer part of the tube.", ["CC 11585 conception", "PMID 16272225"], "A",
    "caption", true),
  f("egg.weeks", "Midwives and doctors already call this week 2. Weeks count from the first day of the last period.",
    ["NHS week 4", "CC 7247"], "R", "overlay", true),
  f("egg.frame", "In the game you guard your shell. In life, the shell changes only after one sperm joins.",
    ["TTUHSC", "PMID 24739963"], "A", "result"),
]);
