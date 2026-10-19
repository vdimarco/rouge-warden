// First Breath: stage 7, Third Trimester (`turn`), its strings (design.md 1.3, 2, 6.7, 15.4). { stringId: "text" }, with
// {carer} and {Carer}. core/text.js registers it through core/stages/index.js. Plain, short and tender; no pronoun for
// the carer. The `.keys` lines are the desktop forms of the prompts, and `.one` the one-button form, for the host to
// pick.
export const TEXT = Object.freeze({
  // prompts, one per moment
  "turn.breathe": "Hold. Let go.",
  "turn.breathe.keys": "Hold Space. Let go.",
  "turn.turn": "Drag to turn. Turn when it is roomy.",
  "turn.turn.keys": "Hold an arrow to turn. Turn when it is roomy.",
  "turn.turn.one": "Hold to turn. Turn when it is roomy.",
  // the rest is a hold, so it needs a fresh touch (5.3): a thumb kept down from the turn does not count
  "turn.rest": "Rest. Touch and hold if you like.",
  "turn.rest.keys": "Rest. Hold Space if you like.",
  "turn.outro": "You are ready.",

  // sub-goals: shown, then done by you or by itself
  "turn.goal.breaths": "Four practice breaths. Hold as the ring grows.",
  "turn.goal.breathsDone": "Your practice breaths kept the rhythm.",
  "turn.goal.breathsAuto": "The ring kept the rhythm for you.",
  "turn.goal.turn": "Turn head-down.",
  "turn.goal.turnDone": "Head-down. You turned by yourself.",
  "turn.goal.turnAuto": "You turn now.",

  // captions
  "turn.roomy": "It is roomy now.",
  "turn.hum": "Your song, hummed soft and low.",

  // score parts (the run result)
  "turn.part.breaths": "Practice breaths",
  "turn.part.turn": "Turning when roomy",
  "turn.part.flourish": "Turned by yourself",
});
