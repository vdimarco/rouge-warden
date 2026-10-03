# Design

`voice/call.mjs` posts to Twilio's Calls API with inline TwiML, so no TwiML webhook is needed. The TwiML connects the answered call to `<ConversationRelay url="wss://<CALL_PUBLIC_URL host>/relay">` and passes two parameters: a one-time call token and the reason for the call. The greeting is "Hermes here." plus the reason. The script calls only `OWNER_PHONE_NUMBER`.

Twilio handles speech to text and text to speech. `voice/call-server.mjs` handles text only. It accepts a WebSocket upgrade on `/relay` only with a valid `X-Twilio-Signature`: base64 HMAC-SHA1 with the auth token over the `wss://` URL from the TwiML. It also tries that URL with a trailing slash, as Twilio's docs advise for WebSockets. The setup message must then carry a call token: `<expiry>.<nonce>.<HMAC-SHA256>`, keyed with the auth token, valid for 10 minutes and accepted once. Any message before a valid setup ends the session.

Each final prompt goes to the Hermes API server `POST /v1/responses` with `stream: true`, `store: true`, the named conversation `HERMES_CONVERSATION` (default `watch-call`), and voice instructions that Hermes layers on its own system prompt. The first prompt of a call carries the call reason. The server forwards `response.output_text.delta` text and Hermes's commentary items (`phase: "commentary"`) as text tokens, then a final token with `last: true`. If Hermes is silent for 6 seconds, Twilio says "Working on it." An `interrupt` from Twilio aborts the Hermes request, which stops that turn. A hang-up does not abort it: Hermes finishes and stores the result in the conversation.

The call server binds 127.0.0.1 and is reached through an HTTPS tunnel. The Hermes API server stays on 127.0.0.1. The only dependency is `ws`, for the WebSocket server.
