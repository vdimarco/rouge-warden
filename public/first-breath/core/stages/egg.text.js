// First Breath: stage 2, The Egg (`egg`), its strings (design.md 2, 5.2; v1 15.4). Plain, short and gentle: the egg
// guards its shell, a glow bounces off its arc, sperm bounce and drift off, "Only one may enter", "Let yours in". No
// pronoun names the carer; no string says one sperm wins or beats the others, and none says "brick" or "break" (the
// design's words for the play). core/text.js registers this table through core/stages/index.js. "egg.now" leads the
// stage card, and is the first caption when there is no card (practice or goto). The Almost card's line after a
// knock-out is the shared "almost.ko" (core/text.js).
export const TEXT = Object.freeze({
  "egg.now": "Now you are the egg.",
  "egg.you": "0.1 mm",
  "egg.opens": "It opens.",

  // prompts (the live gesture). The desktop forms (".keys", "Keys") name keys; ".one" is the one-button form.
  "egg.guard": "Drag to guard your shell.",
  "egg.guardKeys": "Turn with the arrow keys, or point with the mouse.",
  "egg.guard.one": "Hold to guard your shell.",
  "egg.seal": "Tap to seal your shell.",
  "egg.seal.keys": "Press Space to seal your shell.",

  // sub-goals: shown, then done by you or by itself
  "egg.guardGoal": "Bounce the glow off your arc. Guard your shell.",
  "egg.guardDone": "You guarded your shell.",
  "egg.guardAuto": "Your shell held on.",
  "egg.chargeGoal": "Tap with a second finger to seal. It clears the sparks.",
  "egg.chargeGoal.keys": "Press Space to seal. It clears the sparks.",
  "egg.chargeDone": "The sparks turn to gold.",
  "egg.chargeAuto": "Kept seals shine at the end.",
  "egg.letIn": "Only one may enter. Let yours in.",
  "egg.letInDone": "It is in.",
  "egg.letInAuto": "It slips in anyway.",
  "egg.sealGoal": "Tap to seal your shell.",
  "egg.sealGoal.keys": "Press Space to seal your shell.",
  "egg.sealDone": "Your shell seals.",
  "egg.sealAuto": "Your shell seals itself.",

  // lines
  "egg.swarm": "A swarm comes.",
  "egg.swarmOff": "The swarm drifts off.",
  "egg.rest": "Your shell needs a rest.",

  // the score breakdown on the run result
  "egg.part.hits": "Sperm bounced away",
  "egg.part.shell": "Shell kept whole",
  "egg.part.chain": "Best chain",
  "egg.part.rush": "Letting yours in",
  "egg.part.pick": "A clean pick and seals kept",
});
