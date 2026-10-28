// First Breath: stage 5, First Trimester (`grow`), its strings (design.md 1.3, 2, 15.4). Plain, short and tender;
// {carer} and {Carer} are the carer word, never a pronoun. core/text.js registers this table through
// core/stages/index.js. Fact texts live in grow.facts.js; these are the prompts, sub-goals and parts. The Almost card's
// line after a knock-out is the shared "almost.ko" (core/text.js).
export const TEXT = Object.freeze({
  // the prompt line (".keys" is the desktop form, ".one" the one-button form)
  "grow.prompt.move": "Drag to move. Your sparks aim for you.",
  "grow.prompt.move.keys": "Move with WASD or the arrows. Your sparks aim for you.",
  "grow.prompt.move.one": "Hold to move. Your sparks aim for you.",
  "grow.prompt.dash": "Drag to move. Tap to dash.",
  "grow.prompt.dash.keys": "WASD to move. Space to dash.",
  "grow.prompt.dash.one": "Hold to move. You dash by yourself.",
  "grow.prompt.rest": "Rest. Food comes down the cord.",
  "grow.prompt.boss": "Clear the big germ. Dash through its shots.",

  // sub-goals: shown, then done by you or settled by itself (5.4)
  "grow.sub.clear": "Clear the germs that drift in.",
  "grow.sub.clearDone": "You kept the germs away.",
  "grow.sub.clearAuto": "The placenta keeps most germs out.",
  "grow.sub.food": "Gather food to grow.",
  "grow.sub.foodDone": "You grow, and your sparks grow too.",
  "grow.sub.foodAuto": "The cord brings food all the same.",
  "grow.sub.dash": "Dash to slip past the shots.",
  "grow.sub.dashDone": "You slip past.",
  "grow.sub.dashAuto": "Your body slips past by itself.",
  "grow.sub.boss": "Clear the big germ.",
  "grow.sub.bossDone": "The big germ is gone.",
  "grow.sub.bossAuto": "The big germ drifts away.",
  "grow.sub.rest": "You need a rest.",

  // the run result's parts
  "grow.part.clear": "Germs cleared",
  "grow.part.dodge": "Shots dodged",
  "grow.part.combo": "Best chain",
});
