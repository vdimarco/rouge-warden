// First Breath: stage 6, Second Trimester (`answer`), its strings (design.md 1.3, 2, 15.4). Plain, short and tender;
// {carer} and {Carer} are the carer word, never a pronoun. core/text.js registers this table through
// core/stages/index.js. Fact texts live in answer.facts.js; these are the prompts, sub-goals, captions and parts.
export const TEXT = Object.freeze({
  // the prompt line, one per moment (".keys" is the desktop form)
  "answer.prompt.hear": "Listen.",
  "answer.prompt.beat": "Tap with {carer}'s heartbeat.",
  "answer.prompt.beat.keys": "Press Space with {carer}'s heartbeat.",
  "answer.prompt.phrases": "Listen. Then answer.",
  "answer.prompt.phrases.keys": "Listen. Then answer with Space.",
  "answer.prompt.eyes": "Rest and listen.",
  "answer.prompt.outro": "You see warm light.",

  // sub-goals: shown, then done by you or settled by itself (5.4)
  "answer.sub.beat": "Tap with {carer}'s heartbeat.",
  "answer.sub.beat.keys": "Press Space with {carer}'s heartbeat.",
  "answer.sub.beatDone": "You found the beat.",
  "answer.sub.beatAuto": "The heartbeat goes on with you.",
  "answer.sub.answer": "Answer each tune {carer} hums.",
  "answer.sub.answerDone": "{Carer} feels your answers.",
  "answer.sub.answerAuto": "{Carer} hums on for you.",

  // captions
  "answer.feels": "{Carer} feels you.",
  "answer.cap.hum1": "♪ {carer} hums, left: 1 note",
  "answer.cap.hum2": "♪ {carer} hums, left: 2 notes",
  "answer.cap.hum3": "♪ {carer} hums, left: 3 notes",
  "answer.cap.hum4": "♪ {carer} hums, left: 4 notes",
  "answer.cap.eyes": "Your eyes open. The light grows.",

  // the run result's parts
  "answer.part.beat": "Heartbeat taps",
  "answer.part.answer": "Answers",
  "answer.part.flourish": "Tunes all in time",
});
