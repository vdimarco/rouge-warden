// First Breath: stage 1, The Race (`swim`), its strings (design.md 1.3, 6.1, 15.4). Plain, short and gentle: the race
// words are race, place, bump and rest; no string says fastest, winner, win, wins, won, "beat the" or "beats the",
// and none names the carer with a pronoun. The prompt, sub-goal and caption ids are the ones swim.js emits; the
// `part` ids label the score parts on the run result. core/text.js registers this table through the stage index.
export const TEXT = Object.freeze({
  // the prompt line
  "swim.prompt": "Drag to swim.",
  "swim.meetLine": "Wait here. The egg is coming.",
  "swim.carried": "The waves carry you to the meeting place.",

  // sub-goals: shown, then done by you or settled by themselves
  "swim.goal": "Race to the meeting place. Get there in the first three.",
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
  "swim.othersRest": "Some sperm rest on the walls.",

  // score parts (run result)
  "swim.part.place": "Place",
  "swim.part.waves": "Riding the waves",
  "swim.part.lane": "The warm lane",
  "swim.part.ready": "Ready on a glow",
  "swim.part.first": "First place",
});
