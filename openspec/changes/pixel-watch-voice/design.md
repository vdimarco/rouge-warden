# Design

## Watch and phone

The watch app (`wear/`, `com.rouge.hermes.watch`, minSdk 30, standalone) records 16 kHz mono PCM16 in a microphone foreground service and streams those bytes to the phone with the Wearable ChannelClient on `/hermes/audio`. Control messages use the MessageClient (`/hermes/watch` from the watch, `/hermes/phone` from the phone). A tile, a complication, and the launcher all open the same hold-to-talk screen. Food mode is a second tile and an on-screen chip.

The phone app (`mobile/`, `com.rouge.hermes.phone`) runs Vosk (`com.alphacephei:vosk-android:0.3.75`) with the small English model downloaded from https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip. Whisper.cpp was not used: the Vosk AAR already ships JNI for the ABIs we build, so the phone APK does not need an NDK. SpeechRecognizer cannot take PCM from the watch, so the fallback is the watch's own recognizer (offline first). If the phone is unreachable, the watch posts the transcript to the relay itself.

Source for the speech model: Vosk small English, Alpha Cephei, the URL above.

## One relay, three agents

The phone and the watch talk only to the relay. `POST /relay/v1/responses` streams `text/event-stream`. A warm WebSocket on `/relay/v1/stream` (bearer token, not the Twilio signature) carries the same turn. Twilio's upgrade stays on `/relay` and is unchanged.

`voice/agents.mjs` defines the adapter. An adapter streams text deltas in and text deltas out:

- `hermes` posts the existing Hermes body to `/v1/responses` and reads `response.output_text.delta`.
- `pi` spawns the Pi coding-agent CLI. The warm path is `pi --mode rpc --no-session` (JSONL on stdin and stdout). A prompt is `{"id","type":"prompt","message"}`. A successful prompt response only means the prompt was accepted. Text comes from `message_update` records whose `assistantMessageEvent.type` is `text_delta`. The turn ends at `agent_settled`. One-shot `pi --mode json --no-session` is the fallback when RPC is not kept warm. Source: https://pi.dev/docs/latest/rpc and https://pi.dev/docs/latest/json. The `pi` binary is not an npm dependency and is not required in CI. Tests pass a fake spawn.
- `openai` posts to an OpenAI-compatible base URL, either `/v1/responses` or `/v1/chat/completions`, chosen with `OPENAI_API`.

The agent is the `agent` field on the request, or `WATCH_AGENT`, or a prefix in the utterance (`ask hermes`, `ask pi`, `ask claude`, `ask openai`, `ask gpt`). The watch has a setting that cycles the three ids. The conversation id stays `watch-call` for Hermes. Other adapters receive that id in the instructions because a generic endpoint may not accept Hermes's `conversation` field.

## Memory

`voice/memory.mjs` is the store. `recall(query)` returns the few facts whose words overlap the query. `remember(fact)` appends one JSON object per line. The default file is `voice/memory/facts.jsonl`. `MEMORY_PATH` can point at another JSONL file so a later change can use an existing store. The relay adds recalled facts to the instructions and appends a fact after a finished turn and after a food entry. No tool protocol is invented for Pi. A later adapter can wrap the same two methods.

## Speed

Audio chunks move as they are captured. Vosk partials go to the watch while the button is down. The agent request starts when the utterance ends. The relay streams SSE or WebSocket deltas. The watch speaks on sentence boundaries (a period, question mark, or exclamation followed by whitespace), and flushes the rest when the turn ends. Connections: the phone keeps a WebSocket to the relay when it can, and OkHttp keeps the HTTP pool. The relay logs `first-delta` milliseconds. The watch logs `ttfa` from button release to the first `TextToSpeech.speak` call. The target is under 1.5 seconds to first audio. CI measures the relay hop against a local stub and does not claim a wrist measurement.

## Food

Food mode uses the same agents. The instructions ask for a spoken confirmation and a final `FOOD:` JSON line. The relay strips that line into `voice/food-log.jsonl` and serves `GET /relay/v1/food`. The watch lists today's entries. Clients do not speak the JSON line.

## Auth

Bearer token from `WATCH_RELAY_KEY` or `voice/relay-keys.json`. Revoke by setting `revoked: true` (read on every request). Rate limit applies to accepted turns, not to food reads or rejected bodies. The key is stored in EncryptedSharedPreferences, entered with a QR code or adb, never compiled in.
