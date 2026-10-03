# Design

The endpoint is `api/alexa.mjs`, a Web-handler Vercel function. The logic lives in `voice/alexa-relay.mjs`, so tests import it without Vercel. It uses only Node built-ins because the repository has no root package.

Amazon's checks for a skill hosted as a web service come first: the certificate URL rules, a certificate for `echo-api.amazon.com`, a chain to a trusted root, the `Signature-256` RSA-SHA256 signature over the raw body, and a timestamp within 150 seconds. Failures get HTTP 400. Amazon's chain ends in cross-signed roots that Node's CA store no longer carries, so the chain walk stops at the first certificate that a store root issued. Each link must be a CA certificate that signed the one below it. A verified chain is cached per URL while its signing certificate is current.

Then the relay checks the skill ID and an allowlist of Alexa user IDs (`ALEXA_SKILL_ID`, `ALEXA_USER_IDS`). An empty allowlist fails closed: the skill says how to finish setup and logs the caller's user ID.

`AMAZON.SearchQuery` needs a carrier phrase and Alexa drops it from the slot. One intent per lead word (tell, ask, what's and others) lets the relay put the word back. `SendIntent` takes words with no meaning of their own (send, say, message, relay) and forwards only the slot.

The relay posts `{event_type: "watch.voice", text, ...}` to `HERMES_WEBHOOK_URL` with Hermes's Generic V2 signature: hex HMAC-SHA256 of `<unix seconds>.<body>` in `X-Webhook-Signature-V2`, with `X-Webhook-Timestamp`. The Alexa request ID goes in `X-Request-ID`, so Hermes drops a retry. Hermes answers 202 at once and runs the agent in the background, so the relay speaks a short confirmation inside Alexa's time limit. The Hermes route delivers the answer to Telegram with `mirror_to_session`, so a reply from the watch has the context. The route grants terminal tools because only the relay holds its secret.
