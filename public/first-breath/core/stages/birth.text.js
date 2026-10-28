// First Breath: stage 8, Birth (`birth`), its strings (the runner of first-breath-action-genres, design.md 5.8; v1 15.4
// for the words). Plain, short and tender; no pronoun for the one who carries you, no banned word, one idea per
// sentence. core/text.js registers them through core/stages/index.js. Prompt and sub-goal text ids are these keys; fact
// captions use the ids in birth.facts.js. A ".keys" line is the desktop form (main.js shows it when keys were used
// last); a ".one" line is the one-button form, where the run steers and tucks while the button is held.
export const TEXT = Object.freeze({
  // prompts (the HUD prompt line)
  "birth.ride": "Ride the waves.",
  "birth.prompt.move": "Drag to change lanes. Tap to tuck.",
  "birth.prompt.move.keys": "Left and right arrows change lanes. Space tucks.",
  "birth.prompt.move.one": "Hold to ride the waves. You tuck by yourself.",
  "birth.again": "Rest. Another wave will come.",
  "birth.go": "Into the light.",

  // the gates of the birth moves: the prompt line and its sub-goal, then the line when you pass it
  "birth.gate.tuck": "Tuck through the gate.",
  "birth.gate.tuck.keys": "Press Space to tuck through the gate.",
  "birth.gate.turn": "Turn: steer into the gold arrow.",
  "birth.gate.turn.one": "Turn: hold, and you steer in.",
  "birth.gate.lift": "Lift: tuck through the middle.",
  "birth.gate.lift.keys": "Lift: press Space in the middle lane.",
  "birth.gate.back": "Turn back: steer into the gold arrow.",
  "birth.gate.back.one": "Turn back: hold, and you steer in.",
  "birth.tucked": "Chin tucked.",
  "birth.turned": "You turned to fit.",
  "birth.lifted": "Head lifted.",
  "birth.turnedBack": "You turned back.",
  "birth.anyway": "The wave moves you on anyway.",

  // word tags over the play area (ui/pops.js)
  "birth.pop.flow": "Flow",
  "birth.pop.tight": "Nice tuck",

  // sound captions, once each (main.js finds "birth.sfx.<id>" for an sfx "birth.<id>")
  "birth.sfx.tuck": "~ you tuck",
  "birth.sfx.bump": "~ a soft bump",
  "birth.sfx.bubble": "· a calm bubble",

  // score parts on the run result (the score is never shown at the end of this stage)
  "birth.part.folds": "Folds passed",
  "birth.part.gates": "Gates",
  "birth.part.bubbles": "Calm bubbles",
  "birth.part.flow": "Flow",
});
