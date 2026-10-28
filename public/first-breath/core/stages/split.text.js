// First Breath: stage 3, The Embryo: first cells (`split`), its strings (design.md 1.3, 2, 5.3, 15.4). Plain, short and
// tender; no carer pronouns, no banned words. core/text.js registers it through core/stages/index.js. Fact texts live
// in split.facts.js. The Almost card's line after a knock-out is the shared "almost.ko" (core/text.js).
export const TEXT = Object.freeze({
  // the prompt line (".keys" is the desktop form, ".one" the one-button form)
  "split.prompt.move": "Drag to move. Tap to dash.",
  "split.prompt.move.keys": "WASD to move. Space to dash.",
  "split.prompt.move.one": "Hold to move. You dash by yourself.",
  "split.prompt.gift": "Swim into a gift.",
  "split.prompt.gift.one": "Hold. You swim to a gift.",
  "split.prompt.knot": "Pop the Knot. Dash past its spores.",
  "split.prompt.split": "Your cells split.",
  "split.prompt.pack": "Your cells pack tight.",
  "split.prompt.carried": "The tube carries you on.",
  "split.prompt.hatch": "You slip out of your shell.",
  "split.prompt.outro": "You drift toward the soft lining.",

  // sub-goals: shown, then done by you or settled by itself (5.4)
  "split.sub.rooms": "Clear the germs in each room.",
  "split.sub.roomsDone": "Your rooms are clear.",
  "split.sub.roomsAuto": "The tube carries you on.",
  "split.sub.gift": "Swim into a gift.",
  "split.sub.giftDone": "Your cells take the gift.",
  "split.sub.giftAuto": "It picks itself.",
  "split.sub.knot": "Pop the Knot.",
  "split.sub.knotDone": "The Knot pops.",
  "split.sub.knotAuto": "The tube carries you past.",
  "split.sub.hatch": "Your shell opens.",
  "split.sub.hatched": "You hatch.",
  "split.sub.rest": "Your cells need a rest.",

  // number pops (DOM tags) and the gift bubbles' tags
  "split.pop.clear": "Clear!",
  "split.gift.quick": "Quick",
  "split.gift.spread": "Spread",
  "split.gift.bounce": "Bounce",
  "split.gift.sticky": "Sticky",
  "split.gift.shell": "Shell",
  "split.gift.dash": "Dash",
  "split.gift.orbit": "Orbit",
  "split.gift.chain": "Chain",
  "split.gift.magnet": "Magnet",

  // score parts on the run result
  "split.part.popped": "Germs popped",
  "split.part.rooms": "Rooms cleared",
  "split.part.pips": "Pips kept",
  "split.part.knot": "The Knot, quickly",

  // sound captions (section 12), for the sfx ids this stage emits
  "split.sfx.pling": "♪ a glassy pling",
  "split.sfx.sparkle": "♪ a soft sparkle",
  "split.sfx.tone": "♪ a soft rising tone",
  "split.sfx.slip": "♪ a soft crack",
});
