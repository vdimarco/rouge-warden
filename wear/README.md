# Hermes on a Pixel Watch 3

The watch records what you say and speaks the reply. A companion Android phone turns the audio into text and sends it to the relay in `voice/`. The relay picks an agent (Hermes, Pi, or any OpenAI-compatible endpoint), adds shared memory, and streams the answer back. The Fitbit call path is unchanged.

Speech on the phone uses Vosk (`vosk-model-small-en-us-0.15`). The model is downloaded by the phone app. It is not inside the APK. Whisper.cpp was not used, because the Vosk library already includes the native code for the phone ABIs.

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

The relay is part of the call server, on the same port Tailscale Funnel already publishes.

1. `npm ci --prefix voice`
2. Copy `voice/.env.example` to `voice/.env`. Set `HERMES_API_KEY` and `CALL_PUBLIC_URL`.
3. `node voice/relay-key.mjs new pixel-watch`
4. The command prints a token once, and a line `qr=hermes://relay?url=...&token=...`. Put that URL in a QR code.
5. `node voice/call-server.mjs`

On the phone, scan the QR, or type the https URL and the token and tap Save key. The phone sends them to the watch over the Wearable data layer. You can also set them with adb. The token is stored with EncryptedSharedPreferences. It is not in the APK.

```sh
adb -s WATCH_SERIAL shell am broadcast -a com.rouge.hermes.SET_RELAY \
  -n com.rouge.hermes.watch/com.rouge.hermes.relay.RelayKeyReceiver \
  --es url https://your-computer.your-tailnet.ts.net --es token YOUR_TOKEN
adb -s PHONE_SERIAL shell am broadcast -a com.rouge.hermes.SET_RELAY \
  -n com.rouge.hermes.phone/com.rouge.hermes.relay.RelayKeyReceiver \
  --es url https://your-computer.your-tailnet.ts.net --es token YOUR_TOKEN
```

Revoke a key with `node voice/relay-key.mjs revoke pixel-watch`. The next request fails. No restart.

The URL has to be `https://`, or `http://127.0.0.1` for a local test. The relay checks `Authorization: Bearer`.

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
