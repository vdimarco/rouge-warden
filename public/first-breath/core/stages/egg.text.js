// First Breath: stage 2, The Egg (`egg`), its strings (design.md 1.3, 2, 6.2, 15.4). Plain, short and gentle: the egg
// guards its shell, sperm bounce and drift off, "Only one may enter", "Let it in". No pronoun names the carer, and no
// string says one sperm wins or beats the others. core/text.js registers this table through core/stages/index.js.
// "egg.now" leads the stage card, and is the first caption when there is no card (practice or goto).
export const TEXT = Object.freeze({
  "egg.now": "Now you are the egg.",
  "egg.you": "0.1 mm",

  // prompts (the live gesture)
  "egg.tap": "Tap with the heartbeat.",
  "egg.guard": "Drag to guard your shell.",
  "egg.guardKeys": "Turn with the arrow keys, or point with the mouse.",
  "egg.seal": "Seal your shell. Hold, then let go.",

  // sub-goals: shown, then done by you or by itself
  "egg.openGoal": "Three good taps open the follicle.",
  "egg.openDone": "It opens.",
  "egg.openAuto": "It opens anyway.",
  "egg.guardGoal": "Guard your shell. Only one may enter.",
  "egg.guardDone": "You guarded your shell.",
  "egg.guardAuto": "Only your sperm comes in.",
  "egg.letIn": "Let it in.",
  "egg.letInDone": "It is in.",
  "egg.letInAuto": "It slips in anyway.",
  "egg.sealGoal": "Let go on the glowing beat.",
  "egg.sealDone": "Your shell seals.",
  "egg.sealAuto": "Your shell seals itself.",

  // the score breakdown on the run result
  "egg.part.open": "Opening taps",
  "egg.part.guard": "Guarding your shell",
  "egg.part.clean": "Letting your sperm in",
  "egg.part.seal": "The seal",
});
