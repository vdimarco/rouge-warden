// First Breath: stage 5, First Trimester (`grow`), its strings (design.md 1.3, 2, 15.4). Plain, short and tender;
// {carer} and {Carer} are the carer word, never a pronoun. core/text.js registers this table through
// core/stages/index.js. Fact texts live in grow.facts.js; these are the prompts, sub-goals, captions and parts.
export const TEXT = Object.freeze({
  // the prompt line: one per kind of moment (".keys" is the desktop form, ".one" the one-button form)
  "grow.prompt.tap": "Tap when the light reaches your heart.",
  "grow.prompt.tap.keys": "Press Space when the light reaches your heart.",
  "grow.prompt.drag": "Drag to stretch.",
  "grow.prompt.drag.keys": "Stretch with the arrow keys, or drag with the mouse.",
  "grow.prompt.drag.one": "Hold to stretch.",

  // sub-goals: shown, then done by you or settled by itself (5.4). The move lines name no gesture: the prompt line
  // above them says how (drag, the arrow keys, or hold in one-button mode).
  "grow.sub.heart": "Tap with your heart.",
  "grow.sub.heart.keys": "Press Space with your heart.",
  "grow.sub.heartDone": "Your taps kept time with your heart.",
  "grow.sub.heartAuto": "Your heart keeps its own time.",
  "grow.sub.move8": "Move toward the glow to uncurl.",
  "grow.sub.move9": "Move toward the glow to stretch an arm.",
  "grow.sub.move10": "Move toward the glow. You startle.",
  "grow.sub.move11": "Move toward the glow to kick.",
  "grow.sub.move12": "Move toward the glow to kick again.",
  "grow.sub.move13": "Move toward the glow. Your thumb finds your mouth.",
  "grow.sub.done8": "You uncurl.",
  "grow.sub.done9": "You stretch an arm.",
  "grow.sub.done10": "You startle, then settle.",
  "grow.sub.done11": "You kick.",
  "grow.sub.done12": "You kick again.",
  "grow.sub.done13": "Your thumb finds your mouth.",
  "grow.sub.auto": "Your body makes the move by itself.",

  // the run result's parts
  "grow.part.heart": "Taps with your heart",
  "grow.part.moves": "Moves you made",
  "grow.part.streak": "Longest run in time",
});
