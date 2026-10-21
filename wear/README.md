# Hermes on a Pixel Watch 3

The watch records what you say and speaks the reply. A companion Android phone turns the audio into text and sends it to the relay in `voice/`. The relay picks an agent (Hermes, Pi, or any OpenAI-compatible endpoint), adds shared memory, and streams the answer back. The Fitbit call path is unchanged.

Speech on the phone uses Vosk (`vosk-model-small-en-us-0.15`). The model is downloaded by the phone app. It is not inside the APK. Whisper.cpp was not used, because the Vosk library already includes the native code for the phone ABIs.

## Set up

1. On the computer that runs Hermes:

```sh
npm ci --prefix voice
cd voice && npx wrist-relay
```

The first run makes a token. The terminal prints a pairing link and a QR code. Leave it running. The link looks like `https://your-relay/pair?u=...&k=...` and redirects to `wristagent://pair?u=<relay url>&k=<token>`.

2. On the phone, tap that link, scan the QR code, or tap Connect when the phone finds the relay on the same Wi-Fi. The phone sends the relay to the watch. Tap Download speech model once.

3. Open the watch. Until the phone has paired, it says "Open phone app to connect". Then hold Talk and speak.

The phone's Advanced section still has URL and token fields. The watch has no setup fields.

To put the relay on Cloudflare instead, run `node voice/worker/deploy.mjs`. That generates a token and runs `npx wrangler deploy`, then prints the same kind of link. Hermes must be a public HTTPS address for that deploy (`HERMES_API_URL` and `HERMES_API_KEY` as Worker secrets). Pi and the JSONL memory file stay on `npx wrist-relay`.

The pairing link is the relay token. Anyone with it can talk to the relay. On the same Wi-Fi the relay also answers mDNS as `_wristagent._tcp`, and the phone asks you to tap Connect before it saves that relay.

## Install

Build both debug APKs from `wear/` (the phone module lives in `mobile/`):

```sh
cd wear && ./gradlew :wear-app:assembleDebug :phone-app:assembleDebug
```

The files are `wear/app/build/outputs/apk/debug/hermes-watch-debug.apk` and `mobile/build/outputs/apk/debug/hermes-phone-debug.apk`. GitHub Actions uploads the same two artifacts from the "Hermes watch and phone" workflow.

On the watch and the phone:

1. Settings, System, About. Tap the build number until developer options turn on.
2. Settings, Developer options. Turn on Wireless debugging.
3. Pair from a computer:

```sh
adb pair PHONE_IP:PAIR_PORT
adb connect PHONE_IP:DEBUG_PORT
adb connect WATCH_IP:DEBUG_PORT
adb -s PHONE_SERIAL install mobile/build/outputs/apk/debug/hermes-phone-debug.apk
adb -s WATCH_SERIAL install wear/app/build/outputs/apk/debug/hermes-watch-debug.apk
```

`adb devices -l` shows the serials after you connect. Wear OS asks you to allow debugging.

Open Hermes on the phone once and tap "Download speech model". Until that finishes, the watch uses its own speech recognizer.

## Relay

`npx wrist-relay` is the relay. It listens on `CALL_PORT` (8650) on every interface, so a phone on the same Wi-Fi can reach it, and Tailscale Funnel can still publish `CALL_PUBLIC_URL`. Copy `voice/.env.example` to `voice/.env` and set `HERMES_API_KEY`. Set `CALL_PUBLIC_URL` when the phone is not on that Wi-Fi.

The phone stores the token with EncryptedSharedPreferences and pushes `url`, `token`, and `agent` to the watch on `/hermes/config`. An https relay URL is the usual one. `http://` is accepted for localhost and private LAN addresses (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16). The relay checks `Authorization: Bearer`.

`node voice/relay-key.mjs new pixel-watch` prints another `wristagent://pair` link. `node voice/relay-key.mjs revoke pixel-watch` rejects that token on the next request. No restart. `node voice/call-server.mjs` is the Fitbit call server and stays on 127.0.0.1.

## Agents

The phone and the watch talk only to the relay. The adapter interface is `voice/adapters.md`.

- Hermes is `POST /v1/responses` on `HERMES_API_URL`, conversation `watch-call`.
- Pi is the `pi` CLI from pi-mono. The warm path is `pi --mode rpc --no-session`. Text comes from `message_update` / `text_delta` and the turn ends at `agent_settled`. `PI_MODE=json` uses one-shot JSON mode. `PI_BIN`, `PI_PROVIDER`, and `PI_MODEL` are the CLI flags from the Pi docs. If `pi` is not on PATH, that turn returns an error. CI does not install Pi. It uses a fake process.
- OpenAI is any compatible base URL in `OPENAI_BASE_URL`. `OPENAI_API=responses` (the default) or `chat` for `/v1/chat/completions`.

On the watch, tap the agent name to cycle Hermes, Pi, and OpenAI. You can also say "ask pi ...", "ask claude ...", "ask hermes ...", or "ask gpt ...". "ask claude" and "ask gpt" select the OpenAI adapter. The prefix is not sent to the model.

## Memory

Every turn reads `voice/memory/facts.jsonl` and, when a fact shares words with the utterance, adds those facts to the instructions. After the turn, and after a food entry, the relay appends a fact. Set `MEMORY_PATH` to a different `.jsonl` file with the same line shape (`at`, `kind`, `day`, `text`) to point at another file. This build does not open some other product's database. See `voice/adapters.md`.

## Speed

Audio moves in chunks over the Wear channel. The phone sends partial transcripts while you hold the button, and starts the agent when you let go. The relay streams SSE, or a WebSocket on `/relay/v1/stream` that the phone keeps open. The watch speaks each finished sentence as it arrives.

The relay logs `relay: first-delta <ms> agent=<id>`. The watch logs `ttfa <ms>` from release to the first text-to-speech call (logcat tag `HermesWatch`). The phone logs `phone: stt` and `phone: first-token` (tag `HermesPhone`). The target is under 1.5 seconds from release to the first spoken word. A local stub on this repo's test host answered in well under that. A watch on a wrist was not timed here.

## Food

Tap "Log food", or add the "Log food" tile, then hold the button and say the meal. The agent confirms in one sentence and adds a `FOOD:` line. The relay stores that line in `voice/food-log.jsonl` and the watch lists today. `GET /relay/v1/food?day=YYYY-MM-DD` reads it. The watch does not speak the JSON.

## If the phone is not there

Hold the button. If the phone does not answer within about 2.5 seconds, the watch recognizes speech itself and posts the transcript to the relay. A new press stops speech and cancels the turn.

## Tests

```sh
npm test --prefix voice
cd wear && ./gradlew :protocol:test
```
