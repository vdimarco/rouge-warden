// Alexa skill endpoint for the watch voice relay. The checks and the Hermes hand-off live in voice/alexa-relay.mjs.
import { createRelay, relayStatus } from "../voice/alexa-relay.mjs";

const relay = createRelay();

export function POST(request) {
  return relay(request);
}

export function GET() {
  return relayStatus();
}
