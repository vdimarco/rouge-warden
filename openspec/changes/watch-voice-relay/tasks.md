# Tasks

- [x] Check what the Sense 2 allows: no third-party apps, Alexa built in, voice replies on Android only.
- [x] Read Amazon's request checks for web-service skills and the Hermes webhook signature code.
- [x] Add the Alexa endpoint, the relay module, the skill model, the Hermes route and the test sender.
- [x] Test request checks, forged chains, the allowlist, intents and Hermes answers against a stand-in Hermes.
- [x] Send relay requests to a real Hermes gateway built from source with `voice/hermes-route.yaml`.
- [x] Validate this change with the OpenSpec CLI.
- [ ] Deploy to production, make the Alexa skill and set the Vercel variables (owner's accounts).
- [ ] Speak a command on the Sense 2 and read the Telegram answer on the watch.
- [ ] Archive this change after the watch test.

Checks run: `node qa/alexa/relay.test.mjs` passed (12 tests). Removing each certificate check, the signature check, the timestamp limit, the skill check, the allowlist or the request ID made it fail. A real Hermes gateway (Python 3.14, current `main`) with the route file answered 202 to a relayed Alexa request, 401 to a wrong secret, 404 to an unknown route, and `duplicate` to a repeated request ID. No Alexa device, watch or Telegram delivery was tested here.
