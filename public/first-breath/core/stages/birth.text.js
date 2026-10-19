// First Breath: stage 8, Birth (`birth`), its strings (design.md 6.8, 1.3, 15.4). Plain, short and tender; no
// pronoun for the one who carries you, no banned word, one idea per sentence. core/text.js registers them through
// core/stages/index.js. Prompt and sub-goal text ids are these keys; fact captions use the ids in birth.facts.js.
export const TEXT = Object.freeze({
  // prompts (the HUD prompt line); each ".keys" line is the desktop form, which the host shows when keys or a mouse
  // were used last (an arrow held is a drag and hold; Space alone is a plain hold); ".one" is the one-button form,
  // where any key or touch is the button and the run picks the move
  "birth.ride": "Ride the waves.",
  "birth.hold": "Hold through the wave.",
  "birth.hold.keys": "Hold Space through the wave.",
  "birth.tuck.do": "Tuck: drag down and hold.",
  "birth.tuck.do.keys": "Tuck: hold the down arrow.",
  "birth.tuck.do.one": "Tuck: hold through the wave.",
  "birth.turn.do": "Turn: drag sideways and hold.",
  "birth.turn.do.keys": "Turn: hold the left or right arrow.",
  "birth.turn.do.one": "Turn: hold through the wave.",
  "birth.lift.do": "Lift: drag up and hold.",
  "birth.lift.do.keys": "Lift: hold the up arrow.",
  "birth.lift.do.one": "Lift: hold through the wave.",
  "birth.back.do": "Turn back: drag the other way and hold.",
  "birth.back.do.keys": "Turn back: hold the arrow the other way.",
  "birth.back.do.one": "Turn back: hold through the wave.",
  "birth.rest": "Rest.",
  "birth.again": "Rest. Another wave will come.",

  // sub-goals confirmed (by you, or by themselves: the wave moves you on either way)
  "birth.rode": "You rode the wave.",
  "birth.tucked": "Chin tucked.",
  "birth.turned": "You turned to fit.",
  "birth.lifted": "Head lifted.",
  "birth.turnedBack": "You turned back.",
  "birth.anyway": "The wave moves you on anyway.",

  // score parts on the run result (the score is never shown at the end of this stage)
  "birth.part.overlap": "Holding the waves",
  "birth.part.moves": "Moves",
  "birth.part.rests": "Rests",
});
