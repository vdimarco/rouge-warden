# Watch voice relay

## ADDED Requirements

### Requirement: Only the owner's signed Alexa requests reach Hermes
The relay SHALL forward a command only when Amazon signed the request with a valid `echo-api.amazon.com` certificate chain, the timestamp is within 150 seconds, the skill ID matches `ALEXA_SKILL_ID`, and the Alexa user ID is in `ALEXA_USER_IDS`.

#### Scenario: Request that Amazon did not sign
- WHEN a request has no signature headers, a certificate URL outside `s3.amazonaws.com/echo.api/`, a body changed after signing, a forged or untrusted certificate chain, or a timestamp more than 150 seconds old
- THEN the relay answers HTTP 400
- AND nothing reaches Hermes.

#### Scenario: Request for another skill
- WHEN a signed request names a different skill ID
- THEN the relay answers HTTP 400.

#### Scenario: First use before the allowlist is set
- WHEN the owner speaks a command and `ALEXA_USER_IDS` is empty
- THEN Alexa says that setup is almost done and the Vercel log shows the owner's Alexa user ID
- AND nothing reaches Hermes.

#### Scenario: Another Amazon account
- WHEN a user ID that is not in `ALEXA_USER_IDS` speaks a command
- THEN Alexa says the relay is set up for a different account
- AND nothing reaches Hermes.

### Requirement: Spoken commands arrive whole
The relay SHALL send the full command, with the lead word that Alexa removed from the slot, to the Hermes watch route with a Generic V2 signature.

#### Scenario: Tell an agent
- WHEN the owner holds the watch button and says "ask my hermes to tell codex to run the tests"
- THEN Hermes receives "tell codex to run the tests" as a `watch.voice` event
- AND Alexa says "Sent: tell codex to run the tests".

#### Scenario: Words that carry no meaning
- WHEN the owner says "ask my hermes to send claude open a pull request"
- THEN Hermes receives "claude open a pull request".

### Requirement: Short spoken answers
The relay SHALL answer within Alexa's time limit with one short line, and SHALL keep the session open only when it asks for a command.

#### Scenario: Open the skill with no command
- WHEN the owner says "open my hermes" or asks for help
- THEN Alexa gives an example command and listens for one.

#### Scenario: Hermes cannot take the command
- WHEN Hermes rejects the signature, ignores the event, already has the request, or cannot be reached
- THEN Alexa says which of these happened in one sentence.
