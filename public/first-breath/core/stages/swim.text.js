// First Breath: stage 1, The Race (`swim`), its strings (v1 design 1.3, 6.1, 15.4; design.md 5.1 of the change
// first-breath-action-genres). Plain, short and gentle: the race words are race, place, bump and rest; no string says
// fastest, winner, win, wins, won, eliminated, "beat the" or "beats the", and none names the carer with a pronoun.
// The prompt, sub-goal and caption ids are the ones swim.js emits; the `part` ids label the score parts on the run
// result; the `tag` and `item` ids are the HUD's tags under the place slot (swim.js `race` events). core/text.js
// registers this table through the stage index.
export const TEXT = Object.freeze({
  // the prompt line (".keys" is its desktop form, which the host shows when keys or a mouse were used last; ".one"
  // is its one-button form)
  "swim.prompt": "Drag to swim.",
  "swim.prompt.keys": "Swim with the arrow keys, or drag with the mouse.",
  "swim.prompt.one": "Hold to swim.",
  "swim.promptDrift": "Tap while you turn to drift.",
  "swim.promptDrift.keys": "Hold Space while you turn to drift.",
  "swim.promptDrift.one": "Hold to swim.",
  "swim.promptItem": "Tap to use it.",
  "swim.promptItem.keys": "Press E or Space to use it.",
  "swim.promptItem.one": "Hold to swim.",
  "swim.meetLine": "Wait here. The egg is coming.",
  "swim.carried": "The waves carry you to the meeting place.",

  // sub-goals: shown, then done by you or settled by themselves
  "swim.goal": "Race to the egg. Get there in the first three.",
  "swim.goalDone": "You are in the first three.",
  "swim.goalNear": "You reach the meeting place.",
  "swim.goalCap": "The waves can carry you there.",
  "swim.warmWay": "Take the warm way.",
  "swim.warmDone": "This is the warm way.",
  "swim.warmAuto": "The waves take the warm way.",
  "swim.restGoal": "Rest on a glow to get ready.",
  "swim.readyDone": "Now you are ready.",
  "swim.readyAuto": "You rest here and get ready.",
  "swim.readyLater": "You get ready on the way.",

  // captions
  "swim.cool": "This way is cool. It leads back.",
  "swim.coolBack": "The warm way is the egg's side.",
  "swim.restNext": "Rest at the next glow.",
  "swim.othersRest": "Some sperm rest here.",
  "swim.closes": "The way closes.",
  "swim.tideYou": "The cool tide reaches you. You rest here.",
  "swim.sfx.move": "~ the cool tide rises",

  // the HUD tags under the place slot
  "swim.tag.racing": "{n} racing",
  "swim.tag.gate": "Gate {n}: first {first}",
  "swim.tag.rolling": "Item…",
  "swim.item.spark": "Spark",
  "swim.item.shield": "Shield",
  "swim.item.rush": "Rush",
  "swim.item.glow": "Warm glow",
  "swim.item.goo": "Goo",

  // score parts (run result)
  "swim.part.place": "Place",
  "swim.part.boosts": "Boosts",
  "swim.part.lane": "The warm lane",
  "swim.part.ready": "Ready on a glow",
  "swim.part.tricks": "Sparks, goo and slingshots",
  "swim.part.first": "First place",
});
