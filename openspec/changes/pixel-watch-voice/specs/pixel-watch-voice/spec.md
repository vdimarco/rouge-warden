# Pixel Watch voice

## ADDED Requirements

### Requirement: The watch captures speech and the phone recognizes it
The watch SHALL record 16 kHz mono PCM16 while the talk control is held and SHALL stream those bytes to a paired Android phone. The phone SHALL transcribe them on device and SHALL send partial text while audio is still arriving. Releasing the control SHALL start the agent with the final transcript.

#### Scenario: Phone is paired
- WHEN the owner holds the talk control and speaks
- THEN the watch shows partial text from the phone
- AND after release the phone sends the final transcript to the relay

#### Scenario: Phone has no speech model
- WHEN the phone has not downloaded its speech model
- THEN the watch uses its own recognizer and sends that transcript to the relay

#### Scenario: Phone is unreachable
- WHEN the phone does not answer while the owner is holding the control
- THEN the watch uses its own recognizer and posts the transcript to the relay

### Requirement: One relay routes to a chosen agent
The phone and the watch SHALL send turns to one relay. The relay SHALL stream text from the Hermes adapter, the Pi CLI adapter, or an OpenAI-compatible adapter. The agent SHALL be the request field, the watch setting, or an "ask <name>" prefix. Hermes SHALL keep the conversation id `watch-call`.

#### Scenario: Default agent is Hermes
- WHEN a turn names no agent and the watch setting is Hermes
- THEN the relay posts the watch voice instructions to Hermes `/v1/responses` with conversation `watch-call` and streams the answer

#### Scenario: The owner names an agent
- WHEN the owner says "ask pi to check the build"
- THEN the relay sends "check the build" to the Pi adapter
- AND the spoken reply is streamed back

#### Scenario: OpenAI-compatible endpoint
- WHEN the watch setting is OpenAI and `OPENAI_BASE_URL` is set
- THEN the relay streams from that endpoint's responses or chat-completions API

#### Scenario: Pi is not installed
- WHEN the Pi adapter is selected and the `pi` binary cannot be started
- THEN the relay returns an error and writes no food entry

### Requirement: Agents share one memory
On each turn the relay SHALL add relevant facts from the shared memory store to the instructions, and SHALL append a fact after a finished turn and after a food entry. The default store SHALL be a JSONL file under `voice/memory/`. `MEMORY_PATH` SHALL select a different file.

#### Scenario: A later turn overlaps an earlier fact
- WHEN a fact about the migration is stored and the next turn asks about the migration
- THEN the agent instructions include that fact

#### Scenario: An unrelated meal does not pull the fact
- WHEN the stored fact is about a migration and the turn is a meal note about oatmeal
- THEN the food instructions stay the meal instructions with no extra fact

### Requirement: Replies stream and speech starts on a sentence
The relay SHALL stream deltas as the agent produces them. The watch SHALL speak each finished sentence as it arrives and SHALL speak any remainder when the turn ends. The relay SHALL log the time until the first delta.

#### Scenario: Two sentences arrive in pieces
- WHEN the agent streams "Hello there. Next line."
- THEN the watch speaks "Hello there." before the turn ends
- AND then speaks "Next line."

#### Scenario: A new press interrupts
- WHEN the owner presses talk while a reply is speaking
- THEN speech stops and the in-flight agent turn is cancelled

### Requirement: Food notes are logged
A food turn SHALL ask the agent for a short confirmation and a final FOOD line. The relay SHALL store the items and SHALL list that day over the food endpoint. The spoken reply SHALL not include the FOOD line.

#### Scenario: A meal note
- WHEN the owner logs oatmeal and coffee at 8:10
- THEN the food log gains one entry for that day with those items
- AND the watch can show the entry
- AND the watch does not speak the JSON line

### Requirement: Pairing does not ask for a pasted key
The phone SHALL accept `wristagent://pair?u=<relay url>&k=<token>`, a QR code of that link, and an https page that redirects to it. Saving that setup SHALL push the relay address, token, and agent to the watch. The default phone screen SHALL hide URL and token fields under Advanced. A relay on the same Wi-Fi SHALL be offered as one Connect tap. The watch SHALL show "Open phone app to connect" until a config arrives, and SHALL have no key fields.

#### Scenario: The owner taps the pairing link
- WHEN the phone opens `wristagent://pair` with a relay URL and a token
- THEN the phone stores them and sends them to the watch

#### Scenario: The owner opens the https fallback
- WHEN a browser opens the relay `/pair` page with the relay URL and token
- THEN the page redirects to `wristagent://pair` with those values

#### Scenario: The owner confirms a relay on the same Wi-Fi
- WHEN the phone finds a `_wristagent._tcp` relay and the owner taps Connect
- THEN the phone stores that relay and sends it to the watch

#### Scenario: The watch is not paired
- WHEN the watch has no relay config
- THEN it shows "Open phone app to connect"

### Requirement: The relay can start with one command
`npx wrist-relay` SHALL create a token when none exists, print a pairing link and a QR code, serve the `/pair` page, and advertise `_wristagent._tcp` on the local network. `node voice/worker/deploy.mjs` SHALL run `wrangler deploy` and print a pairing link for the deployed worker.

#### Scenario: First run
- WHEN the owner starts the relay and no token exists
- THEN a token is created and the process prints a `wristagent://pair` link

#### Scenario: The LAN token stays on the LAN
- WHEN a client that is not on a private address requests `/pair/lan`
- THEN the relay does not return the token

### Requirement: The relay is authenticated
The relay SHALL reject a request whose bearer token is missing, wrong, or revoked, and SHALL rate-limit accepted turns.

#### Scenario: Revoked key
- WHEN a key is marked revoked in the keys file
- THEN the next request with that token is unauthorized and does not call an agent
