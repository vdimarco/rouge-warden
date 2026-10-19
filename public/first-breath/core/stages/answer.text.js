// First Breath: stage 6, Second Trimester (`answer`), its strings (archive design.md 1.3, 2, 15.4; design.md 5.6).
// Plain, short and tender; {carer} and {Carer} are the carer word, never a pronoun. core/text.js registers this table
// through core/stages/index.js. Fact texts live in answer.facts.js; these are the prompts, sub-goals, captions, the
// word pops and the parts.
export const TEXT = Object.freeze({
  // the prompt line, one per moment (".keys" is the desktop form; ".one" is one-button mode, where the run picks the
  // lane and any key or touch kicks)
  "answer.prompt.hear": "Listen.",
  "answer.prompt.beat": "Tap with {carer}'s heartbeat.",
  "answer.prompt.beat.keys": "Press Space with {carer}'s heartbeat.",
  "answer.prompt.phrases": "Listen. Then tap each note's lane.",
  "answer.prompt.phrases.keys": "Listen. Then answer with the arrows or Space.",
  "answer.prompt.phrases.one": "Listen. Then press as each note lands.",
  "answer.prompt.song": "Sing along. Tap each note's lane.",
  "answer.prompt.song.keys": "Sing along with the arrows or Space.",
  "answer.prompt.song.one": "Sing along. Press as each note lands.",
  "answer.prompt.eyes": "Rest and listen.",
  "answer.prompt.outro": "You see warm light.",

  // sub-goals: shown, then done by you or settled by itself (v1 5.4)
  "answer.sub.beat": "Tap with {carer}'s heartbeat.",
  "answer.sub.beat.keys": "Press Space with {carer}'s heartbeat.",
  "answer.sub.beatDone": "You found the beat.",
  "answer.sub.beatAuto": "The heartbeat goes on with you.",
  "answer.sub.answer": "Answer each tune {carer} hums.",
  "answer.sub.answerDone": "{Carer} feels your answers.",
  "answer.sub.answerAuto": "{Carer} hums on for you.",

  // captions: each call names its lanes, so the tune reads with the sound off
  "answer.feels": "{Carer} feels you.",
  "answer.cap.hum.M": "♪ {carer} hums: middle",
  "answer.cap.hum.LR": "♪ {carer} hums: left, right",
  "answer.cap.hum.LMR": "♪ {carer} hums: left, middle, right",
  "answer.cap.hum.RLM": "♪ {carer} hums: right, left, middle",
  "answer.cap.hum.RMLM": "♪ {carer} hums: right, middle, left, middle",
  "answer.cap.fever": "♪ {Carer} sings along with you.",
  "answer.sfx.boom": "~ a loud sound outside",

  // the word pops over your ring (ui/pops.js)
  "answer.pop.in": "Perfect",
  "answer.pop.close": "Good",
  "answer.pop.miss": "Miss",
  "answer.pop.fever": "Singing together",

  // the run result's parts
  "answer.part.beat": "Heartbeat kicks",
  "answer.part.answer": "Answers",
  "answer.part.song": "Sing-along",
  "answer.part.flourish": "Longest perfect run",
});
