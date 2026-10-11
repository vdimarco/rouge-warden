import assert from "node:assert/strict";
import { createVoiceCues } from "../../public/fish/js/voice-cues.js";

let time = 0, sound = true, hidden = false;
const calls = [], saved = new Map();
const storage = { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value) };
class Utterance { constructor(text) { this.text = text; } }
const speech = {
  pending: false, speaking: false,
  speak(hint) { calls.push(["speak", hint.text, hint.lang, hint.rate]); this.speaking = true; },
  cancel() { calls.push(["cancel"]); this.speaking = false; this.pending = false; },
};
const voice = createVoiceCues({ speech, Utterance, storage, soundOn: () => sound, hidden: () => hidden, clock: () => time });

assert.equal(voice.available(), true);
assert.equal(voice.enabled, true);
assert.equal(voice.say("nibble"), true);
assert.deepEqual(calls.at(-1), ["speak", "Nibble. Hold steady.", "en-US", 1.08]);
time = 100;
assert.equal(voice.say("nibble"), false, "a second nibble must not queue behind speech");
assert.equal(voice.say("hook"), true, "the hook set interrupts the nibble");
assert.deepEqual(calls.slice(-2).map(c => c[0]), ["cancel", "speak"]);
assert.equal(calls.at(-1)[1], "Set the hook!");
time = 500;
assert.equal(voice.say("hook"), false, "a repeated strike is throttled");

voice.setEnabled(false);
assert.equal(saved.get("fish.voiceHints"), "false");
assert.deepEqual(calls.at(-1), ["cancel"], "switching voice off stops current speech");
time = 8000;
assert.equal(voice.say("nibble"), false);
voice.setEnabled(true);
sound = false;
assert.equal(voice.say("nibble"), false, "the main Sound switch gates voice");
sound = true; hidden = true;
assert.equal(voice.say("nibble"), false, "a hidden page cannot speak");
hidden = false;
assert.equal(voice.say("nibble"), true);

const absent = createVoiceCues({ speech: null, Utterance: null, storage, soundOn: () => true });
assert.equal(absent.available(), false);
assert.equal(absent.say("hook"), false, "unsupported speech is a safe no-op");
console.log("Voice hints: priority, throttle, settings, visibility, and unsupported-platform checks passed.");
