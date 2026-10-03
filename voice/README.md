# Watch call

Talk to Hermes, and through Hermes to Claude Code, Codex and your other agents, on a Fitbit Sense 2. The watch cannot run your own apps, but it can answer phone calls with its speaker and microphone. So Hermes calls your phone through Twilio, you answer on the watch, and you talk.

1. `node voice/call.mjs "why"` asks Twilio to ring your phone. Hermes can run it when you ask for a call, and an agent can run it when it needs you.
2. You answer on the watch. Twilio turns your speech into text and opens a WebSocket to the call server.
3. The call server sends the text to the Hermes API server and streams the answer back. Twilio speaks it through the watch.

| File | What it does |
| --- | --- |
| `voice/call.mjs` | Rings your phone |
| `voice/call-server.mjs` | Connects the call to Hermes. Runs on the computer that runs Hermes |
| `voice/watch-call.mjs` | Shared code: settings, Twilio signatures, call tokens, the Hermes stream |
| `voice/.env.example` | The settings. Copy it to `voice/.env` |
| `voice/hermes-skill/watch-call/` | A Hermes skill, so Hermes calls you when you ask |
| `qa/voice/call.test.mjs` | The tests: `node qa/voice/call.test.mjs` |

## Set up

You need a Twilio account with a phone number that can make calls, and a Hermes gateway on a computer that stays on.

### 1. Answer calls on the watch

1. In the Google Health app, set up calls for the Sense 2. The phone pairs with the watch a second time, for calls.
2. Call your phone from another phone. Answer on the watch to make sure that you hear the caller.

### 2. Turn on the Hermes API server

1. Run `openssl rand -hex 32` and keep the result.
2. Add these lines to `~/.hermes/.env`:

   ```sh
   API_SERVER_ENABLED=true
   API_SERVER_KEY=the-result-from-step-1
   ```

3. Run `hermes gateway restart`. Hermes refuses a key shorter than 16 characters.

### 3. Start the call server

Do these steps on the computer that runs Hermes.

1. Run `npm ci --prefix voice`.
2. Copy `voice/.env.example` to `voice/.env` and fill it in. `HERMES_API_KEY` is the key from step 2.
3. Give the call server a public HTTPS address. With Tailscale, run `tailscale funnel --bg 8650`. Put the address it shows in `CALL_PUBLIC_URL`.
4. Run `node voice/call-server.mjs`. Keep it running, for example as a service.

### 4. Test a call

1. Run `node voice/call.mjs "This is a test call."`.
2. The watch rings within a few seconds. Answer it.
3. Say "What are my agents doing?". Hermes answers through the watch.

If the call does not connect, read the call server's output. Lines start with `call:`. A Twilio trial account calls only numbers that you verified in Twilio.

### 5. Let Hermes call you

1. Copy `voice/hermes-skill/watch-call` to `~/.hermes/skills/watch-call`.
2. If the repository is not in `~/rouge-warden`, change the path in the skill's `SKILL.md`.
3. Tell Hermes "call me" in Telegram. On Android, you can say it from the watch: reply by voice to any Hermes message.

To have an agent call you when it waits for you, run a line like this next to it:

```sh
herdr agent wait codex --until blocked && node voice/call.mjs "Codex is waiting for your answer."
```

## Use

- Save the Twilio number as a contact named Hermes. Then the watch shows who is calling.
- Talk normally. To stop a long answer, start to speak. Hermes stops and listens.
- Hang up when you are done. If Hermes is in the middle of a step, it finishes. Ask about the result on the next call.
- Every call continues one Hermes conversation, `watch-call`. To start a new one, change `HERMES_CONVERSATION`.

## Security and limits

- The call server accepts a WebSocket only with Twilio's signature for its address, and a session only with a one-time token from `call.mjs`. A token expires 10 minutes after the call is placed.
- `call.mjs` calls only `OWNER_PHONE_NUMBER`.
- The Hermes API server stays on 127.0.0.1. Only the call server's port is public.
- Anyone who answers your phone can talk to Hermes, with all of its tools.
- Twilio charges for each minute of a call, and for the speech service.
- People near you hear Hermes through the watch speaker.
