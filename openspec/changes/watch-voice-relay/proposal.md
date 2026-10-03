# Watch voice relay

Let the owner send spoken commands from a Fitbit Sense 2 to their Hermes agent, and through Hermes to Claude Code, Codex and their other agents. The Sense 2 takes no third-party apps and gives no app the microphone. Alexa is the voice feature built into the watch, so a private Alexa skill carries the words.

Add an Alexa endpoint to this Vercel project at `/api/alexa`. It accepts only requests that Amazon signed for the owner's skill and account. It posts the words to a Hermes webhook route, and Hermes answers in the owner's Telegram chat. On Android the Telegram reply shows on the watch and the owner can answer it by voice.

Out of scope: the phone-call route, spoken answers from Hermes inside Alexa's 8-second window, and any change to the arcade games.
