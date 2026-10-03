# Watch call

## ADDED Requirements

### Requirement: Hermes can ring the owner's watch
Running `node voice/call.mjs "<reason>"` SHALL ask Twilio to call `OWNER_PHONE_NUMBER` from the Twilio number, and SHALL connect the answered call to the call server.

#### Scenario: Owner asks for a call
- WHEN the owner tells Hermes "call me"
- THEN Hermes runs the call script and the Sense 2 rings
- AND after the owner answers, the watch says "Hermes here. What do you need?"

#### Scenario: Agent needs the owner
- WHEN a script runs `node voice/call.mjs "Codex is waiting for your answer."`
- THEN the watch rings and says "Hermes here. Codex is waiting for your answer."
- AND Hermes receives that reason with the owner's first sentence.

### Requirement: Only calls this system placed reach Hermes
The call server SHALL accept a WebSocket only with a valid Twilio signature for its `/relay` address, and SHALL accept a session only with an unexpired call token that it has not seen before.

#### Scenario: Forged or replayed connection
- WHEN a client connects without Twilio's signature, with a signature for another address or scheme, without a call token, with a forged or expired token, or with a token that was already used
- THEN the connection is refused or the session ends at once
- AND nothing reaches Hermes.

### Requirement: Spoken conversation with Hermes
The call server SHALL send each sentence the owner speaks to the Hermes API server in one named conversation, and SHALL stream Hermes's answer and progress notes back for Twilio to speak.

#### Scenario: Ask about an agent
- WHEN the owner says "What is Codex doing?" on the watch
- THEN Hermes receives the sentence with the voice instructions
- AND the watch speaks Hermes's answer as it arrives.

#### Scenario: Speak over Hermes
- WHEN the owner starts to speak while Hermes answers
- THEN the watch stops speaking that answer and Hermes stops that turn.

#### Scenario: Slow or missing Hermes
- WHEN Hermes says nothing for 6 seconds
- THEN the watch says "Working on it."
- WHEN the Hermes API server cannot be reached
- THEN the watch says "I couldn't reach Hermes. Try again in a moment."

#### Scenario: Hang up during a step
- WHEN the owner hangs up while Hermes works
- THEN Hermes finishes the step and keeps the result in the conversation for the next call.
