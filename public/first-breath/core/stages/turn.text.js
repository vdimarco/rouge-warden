// First Breath: stage 7, Third Trimester (`turn`), its strings (design.md 1.3, 2, 5.7, 15.4). { stringId: "text" }, with
// {carer} and {Carer}. core/text.js registers it through core/stages/index.js. Plain, short and tender; no pronoun for
// the carer, none of the banned words. The `.keys` lines are the desktop forms of the prompts, and `.one` the
// one-button form, for the host to pick. The Almost card's line after a knock-out is the shared "almost.ko".
export const TEXT = Object.freeze({
  // prompts, one per phase
  "turn.prompt.move": "Drag to move. Tap to kick.",
  "turn.prompt.move.keys": "WASD to move. Space to kick.",
  "turn.prompt.move.one": "Hold to move. You kick by yourself.",
  "turn.prompt.gift": "Swim into a gift.",
  "turn.prompt.gift.keys": "Use the arrows to swim into a gift.",
  "turn.prompt.gift.one": "Hold. You swim to a gift.",
  "turn.turn": "Drag down to turn head-down.",
  "turn.turn.keys": "Hold S or the down arrow to turn head-down.",
  "turn.turn.one": "Hold to turn head-down.",
  // the rest is a hold, so it needs a fresh touch (5.3): a thumb kept down from the turn does not count
  "turn.rest": "Rest. Touch and hold if you like.",
  "turn.rest.keys": "Rest. Hold Space if you like.",
  "turn.outro": "Week 40. You are ready.",

  // sub-goals: shown, then done by you or settled by itself
  "turn.sub.grow": "Gather sparkles to grow.",
  "turn.sub.growDone": "You grow stronger.",
  "turn.sub.growAuto": "{Carer}'s antibodies keep you safe.",
  "turn.sub.big": "Pop the Big Germ.",
  "turn.sub.bigDone": "The Big Germ pops.",
  "turn.sub.rest": "You need a rest.",

  // caption lines
  "turn.snug": "It gets snug in here.",
  "turn.clear": "{Carer}'s antibodies clear every germ.",
  "turn.auto": "You turn now.",

  // the gift bubbles' tags (DOM)
  "turn.gift.darts": "Darts",
  "turn.gift.ring": "Ring",
  "turn.gift.clump": "Clump",
  "turn.gift.beat": "Beat",
  "turn.gift.snug": "Snug",
  "turn.gift.kick": "Kick",
  "turn.gift.grow": "Grow",
  "turn.pop.level": "Grow!",

  // score parts (the run result)
  "turn.part.popped": "Germs popped",
  "turn.part.levels": "Levels",
  "turn.part.pips": "Pips kept",
  "turn.part.turn": "Turned by yourself",
  "turn.part.big": "The Big Germ, in time",

  // sound captions (section 12), for the sfx ids this stage emits
  "turn.sfx.sparkle": "♪ a soft sparkle",
  "turn.sfx.headDown": "~ you turn slowly",
});
