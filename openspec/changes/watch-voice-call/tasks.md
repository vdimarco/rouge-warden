# Tasks

- [x] Check what the Sense 2 can do without Alexa: answer calls with its speaker and microphone, no dialer, voice replies on Android only.
- [x] Read Twilio's ConversationRelay messages and signature rules, and the Hermes API server's Responses stream.
- [x] Add the call script, the call server, the shared module, the settings example, the Hermes skill and the setup guide.
- [x] Remove the Alexa relay from this branch.
- [x] Test signatures, call tokens, placing a call, the call session, interrupts, hang-ups and errors against a stand-in Hermes.
- [x] Run a simulated Twilio session through the call server into a real Hermes API server built from source.
- [x] Validate this change with the OpenSpec CLI.
- [ ] Place a real Twilio call to the Sense 2 and talk to Hermes (owner's accounts).
- [ ] Archive this change after the watch test.

Checks run: `node qa/voice/call.test.mjs` passed (11 tests). Removing the signature check, the path check, the token check, its expiry or MAC, single use, the setup-first rule, the interrupt, the call reason or the spoken commentary made it fail. So did stopping Hermes on hang-up. The Twilio signature matches Twilio's documented example and the `twilio` npm library. A real Hermes gateway (Python 3.14.8, current `main`) with its API server and a stand-in model answered a simulated call: the voice instructions and the call reason reached the model, and the answer came back as text tokens for Twilio. No real Twilio call, watch or speech service was tested here.
