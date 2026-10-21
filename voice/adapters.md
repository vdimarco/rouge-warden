# Watch relay adapters

The phone and the watch send every turn to one relay. The relay chooses an agent and a memory store. Neither client knows the upstream URL or key.

## AgentBackend

An adapter is an object with `id` and `stream`. `stream` is an async generator of text deltas. It throws if the turn fails. Aborting `signal` cancels the turn.

```js
stream({ input, instructions, conversation, signal })
```

`input` is the utterance after an `ask <name>` prefix is removed. `instructions` already include voice rules, food rules, and any recalled facts. `conversation` is `watch-call` unless `HERMES_CONVERSATION` overrides it. The client cannot replace either field.

Built-in ids, in `voice/agents.mjs`:

| id | Upstream |
| --- | --- |
| `hermes` | `POST {HERMES_API_URL}/v1/responses` with the Hermes body (`stream`, `store`, conversation id). Deltas are `response.output_text.delta`. Commentary items are spoken too. |
| `pi` | The `pi` CLI from [pi-mono](https://pi.dev/docs/latest/rpc). Warm mode runs `pi --mode rpc --no-session` and writes one JSON object per line. A prompt is `{"id","type":"prompt","message"}`. A success response means the prompt was accepted, not that the answer is finished. Text is `message_update` with `assistantMessageEvent.type` of `text_delta`. The turn stops at `agent_settled`. `PI_MODE=json` uses one-shot `pi --mode json --no-session` instead. `PI_BIN`, `PI_PROVIDER`, and `PI_MODEL` match the CLI flags in the Pi docs. Stdout is protocol only. If `pi` is not on PATH the relay returns 502. |
| `openai` | `POST {OPENAI_BASE_URL}/v1/responses`, or `/v1/chat/completions` when `OPENAI_API=chat`. `OPENAI_API_KEY` and `OPENAI_MODEL` are sent. The conversation id is added to the instructions, because a generic endpoint may not accept Hermes's `conversation` field. |

Add an adapter by giving `createRelay` a `backends` object with the same `stream` shape. The HTTP route and the WebSocket both call it.

Which agent runs:

1. An `ask hermes`, `ask pi`, `ask claude`, `ask openai`, or `ask gpt` prefix on the utterance. `ask claude` and `ask gpt` select `openai`.
2. Else the `agent` field (`hermes`, `pi`, or `openai`) from the watch setting.
3. Else `WATCH_AGENT`, then `hermes`.

## MemoryStore

`voice/memory.mjs` exports `createMemory({ file, now })`:

```js
recall(query, limit)   // facts whose words overlap the query, best first
remember({ text, kind, day })
```

A fact is one JSON line: `at`, `kind` (`talk` or `food`), `day`, `text`. The default path is `voice/memory/facts.jsonl`. Set `MEMORY_PATH` to a `.jsonl` file with that shape to use another file. This does not open a different product's database. To share an existing store, export it as these lines or replace `createMemory` with an object that implements the two methods and pass it as `memory` to `createRelay`.

On each turn the relay calls `recall` and appends a "Facts you already know" section only when something matches. After a finished turn, and after a food entry, it calls `remember`.

## Relay endpoints

Both require `Authorization: Bearer <token>`.

- `POST /relay/v1/responses` with `{ input, mode, day, agent }` streams `text/event-stream` in the Hermes event shape, so the phone parser is the same for every agent. Hermes turns are proxied byte for byte. Other agents are written as `response.output_text.delta` events.
- `GET /relay/v1/food?day=YYYY-MM-DD` returns today's entries. It does not spend the rate limit.
- `GET` upgraded to WebSocket `/relay/v1/stream` stays open. Send `{"type":"turn","id","input","mode","day","agent"}`. The relay sends `{"type":"delta","id","text"}`, then `{"type":"done","id","firstMs"}`. `{"type":"barge","id"}` aborts that turn. This path is not Twilio's `/relay` socket.

The relay logs `relay: first-delta <ms> agent=<id>` when the first words are ready. The target from button release to the first spoken word is under 1.5 seconds. That log is only the relay hop.
