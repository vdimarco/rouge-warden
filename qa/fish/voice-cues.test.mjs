import assert from "node:assert/strict";
import { createVoiceCues } from "../../public/fish/js/voice-cues.js";

let time = 0, sound = true, hidden = false;
const calls = [], saved = new Map();
let voices = [];
const storage = { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value) };
class Utterance { constructor(text) { this.text = text; } }
const speech = {
  pending: false, speaking: false,
  getVoices() { return voices; },
  speak(hint) { calls.push(["speak", hint.text, hint.lang, hint.rate, hint.pitch, hint.voice?.name]); this.speaking = true; },
  cancel() { calls.push(["cancel"]); this.speaking = false; this.pending = false; },
};
const voice = createVoiceCues({ speech, Utterance, storage, soundOn: () => sound, hidden: () => hidden, clock: () => time });

assert.equal(voice.available(), true);
assert.equal(voice.enabled, true);
assert.equal(voice.say("nibble"), true);
assert.deepEqual(calls.at(-1), ["speak", "A nibble. Hold steady.", "en-GB", 0.9, 0.9, undefined],
  "the first cue speaks in a measured British cadence even while voices are loading");
time = 100;
assert.equal(voice.say("nibble"), false, "a second nibble must not queue behind speech");
voices = [
  { name: "Samantha", lang: "en-US", localService: true },
  { name: "Serena", lang: "en-GB", localService: true },
  { name: "Daniel", lang: "en-GB", localService: true },
];
assert.equal(voice.say("hook"), true, "the hook set interrupts the nibble");
assert.deepEqual(calls.slice(-2).map(c => c[0]), ["cancel", "speak"]);
assert.deepEqual(calls.at(-1), ["speak", "Set the hook!", "en-GB", 1, 0.9, "Daniel"],
  "a newly loaded British narrator voice is chosen without delaying the hook command");
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
voices = [{ name: "Oliver", lang: "en_GB", localService: true }];
assert.equal(voice.say("nibble"), true);
assert.equal(calls.at(-1)[5], "Oliver", "voice selection refreshes as device voices change");

const englishFallbackCalls = [];
const englishFallback = createVoiceCues({
  speech: {
    getVoices() { return [
      { name: "Amelie", lang: "fr-FR", localService: true },
      { name: "Alex", lang: "en-US", localService: true },
    ]; },
    speak: hint => englishFallbackCalls.push(hint), cancel() {},
  },
  Utterance, storage, soundOn: () => true, clock: () => 0,
});
assert.equal(englishFallback.say("hook"), true);
assert.equal(englishFallbackCalls[0].voice.name, "Alex", "a non-British English voice beats a non-English voice");
assert.equal(englishFallbackCalls[0].lang, "en-US", "the fallback uses its own language setting");

const fallbackCalls = [];
const fallback = createVoiceCues({
  speech: { getVoices() { throw new Error("voices not ready"); }, speak: hint => fallbackCalls.push(hint), cancel() {} },
  Utterance, storage, soundOn: () => true, clock: () => 0,
});
assert.equal(fallback.say("hook"), true, "an unavailable voice list does not block the cue");
assert.equal(fallbackCalls[0].lang, "en-GB");
assert.equal(fallbackCalls[0].voice, undefined);

const absent = createVoiceCues({ speech: null, Utterance: null, storage, soundOn: () => true });
assert.equal(absent.available(), false);
assert.equal(absent.say("hook"), false, "unsupported speech is a safe no-op");
console.log("Voice hints: British voice selection, measured cues, priority, throttle, settings, visibility, and unsupported-platform checks passed.");
