# Watch voice relay

Speak to Hermes from a Fitbit Sense 2. Hold the watch button and say "ask my hermes to tell codex to run the tests". Alexa sends the words to `/api/alexa` in this Vercel project. The endpoint checks the request and sends the words to a webhook route on your Hermes gateway. Hermes does the work and sends its answer to your Telegram chat.

On Android, the Telegram answer shows on the watch. Tap it, then tap the microphone to reply by voice (60 characters at most). An iPhone shows the answer on the watch, but cannot reply from it.

| File | What it does |
| --- | --- |
| `api/alexa.mjs` | The Vercel function that Alexa calls |
| `voice/alexa-relay.mjs` | Checks the Alexa request and sends the words to Hermes |
| `voice/alexa-skill.json` | The Alexa skill model: the name "my hermes" and the phrases it knows |
| `voice/hermes-route.yaml` | The Hermes webhook route that receives the words |
| `voice/hermes-test.mjs` | Sends one signed command to Hermes, with no watch or Alexa |
| `qa/alexa/relay.test.mjs` | The tests: `node qa/alexa/relay.test.mjs` (needs openssl) |

## Set up

You need an Amazon developer account that uses the same Amazon account as Alexa on your watch. You also need a Hermes gateway that already talks to you in Telegram.

### 1. Make a shared secret

1. Run `openssl rand -hex 32`.
2. Keep the result. Hermes and Vercel use the same secret.

### 2. Add the route to Hermes

1. Copy the `webhook` part of `voice/hermes-route.yaml` into `~/.hermes/config.yaml`. Keep your other platforms.
2. Put the secret on the `secret` line.
3. In Telegram, send `/sethome` to Hermes in the chat that must get the answers.
4. Run `hermes gateway restart`.
5. Make port 8644 on the Hermes computer reachable over HTTPS. For example, run `tailscale funnel 8644`, or use a Cloudflare tunnel. A quick Cloudflare tunnel gets a new address each time it starts, so use a named tunnel or Tailscale for a fixed address.
6. Run this test from the repo, with your address and secret:

   ```sh
   HERMES_WEBHOOK_URL=https://your-host/webhooks/watch HERMES_WEBHOOK_SECRET=your-secret node voice/hermes-test.mjs "say hello"
   ```

   The script prints `202` and `Sent: say hello`. Hermes sends a message to your Telegram chat.

### 3. Make the Alexa skill

1. Open the [Alexa developer console](https://developer.amazon.com/alexa/console/ask) and create a skill. Select a custom model and "Provision your own" for the backend. Start from scratch.
2. Open the JSON Editor of the interaction model. Paste all of `voice/alexa-skill.json`. Save, then build the model.
3. Open Endpoint and select HTTPS. For the default region, type `https://warden-alpha-wheat.vercel.app/api/alexa`.
4. For the certificate, select "My development endpoint is a sub-domain of a domain that has a wildcard certificate from a certificate authority". Save.
5. Copy the skill ID. It starts with `amzn1.ask.skill.`
6. Open Test and set skill testing to Development. Do not publish the skill.

### 4. Set the Vercel variables

1. In the Vercel project `warden`, add these variables for Production:

   | Variable | Value |
   | --- | --- |
   | `ALEXA_SKILL_ID` | The skill ID |
   | `HERMES_WEBHOOK_URL` | `https://your-host/webhooks/watch` |
   | `HERMES_WEBHOOK_SECRET` | The secret |

2. Redeploy production. A variable changes only new deployments.
3. Open `https://warden-alpha-wheat.vercel.app/api/alexa`. Make sure that it shows `"skill":true` and `"hermes":true`.

### 5. Add your Alexa user ID

1. Hold the watch button and say "ask my hermes to say hello". Alexa says "Almost ready".
2. In the Vercel logs for `/api/alexa`, find `add this user ID to ALEXA_USER_IDS` and copy the ID after it.
3. Set `ALEXA_USER_IDS` to that ID. To allow more accounts, separate the IDs with commas.
4. Redeploy production.

## Use

Hold the watch button, then say a command:

- "ask my hermes to tell codex to run the tests"
- "ask my hermes what's claude doing"
- "ask my hermes to check the build"
- "ask my hermes to send claude open a pull request"

After "ask my hermes" (or "ask my hermes to"), start with one of these words: tell, ask, have, check, what, what's, how, how's, is, are, did, can, run, fix, send, say, message or relay. Alexa says "Sent:" and the words it heard. Hermes answers in Telegram.

| Alexa says | What to do |
| --- | --- |
| Sent: ... | Nothing. Hermes has the command. |
| Almost ready ... | Do step 5. |
| This relay is set up for a different Amazon account. | Add this account's user ID to `ALEXA_USER_IDS`. |
| Hermes rejected the signature ... | Use the same secret in Vercel and in the Hermes route. |
| Hermes ignored it ... | Make sure that the route's `events` list has `watch.voice`. |
| Hermes has no route at that address. | Make sure that `HERMES_WEBHOOK_URL` ends with `/webhooks/watch`. |
| I couldn't reach Hermes. | Start the gateway or the tunnel. |
| There was a problem with the requested skill's response | The endpoint refused the request. Read the Vercel log lines that start with `alexa:`. |

## Security and limits

- The endpoint checks Amazon's signature, the skill ID and your Alexa user ID before it sends anything to Hermes.
- Only the endpoint and Hermes know the route secret. The route gives watch commands the terminal, so Hermes can start Claude Code or Codex. To allow web tools only, remove the `toolsets` line.
- Alexa mishears names and code words. Do not approve destructive actions by voice.
- Amazon processes everything you say to Alexa.
- Alexa waits 8 seconds at most, so the endpoint does not wait for the answer from Hermes. The answer always goes to Telegram.
- Google removed Google Assistant from Fitbit watches in 2025. If Google also removes Alexa, this relay stops working.
