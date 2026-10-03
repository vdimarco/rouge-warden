# Watch call

Let the owner talk to Hermes, and through Hermes to Claude Code, Codex and their other agents, on a Fitbit Sense 2 without Alexa. The Sense 2 takes no third-party apps and gives no app the microphone. It can answer phone calls with its own speaker and microphone, so Hermes calls the owner's phone through Twilio and the owner talks on the watch.

Add `voice/`: a script that places the call, a call server that connects Twilio ConversationRelay to the Hermes API server, a Hermes skill so Hermes places the call when asked, and the setup guide. The call server runs next to Hermes, not on Vercel, because it holds a WebSocket for the length of a call.

The owner asked for no Alexa, so the earlier Alexa relay is removed from this branch.

Out of scope: calls that the watch starts by itself (it has no dialer), incoming calls to the Twilio number, and any change to the arcade games.
