// Two brief spoken move hints. The full instructions remain in the live region;
// speech is optional, and these calls never build a queue over the game's sounds.
import { Sound } from "./audio.js";

const KEY = "fish.voiceHints";
const WORDS = { nibble: "A nibble. Hold steady.", hook: "Set the hook!" };
const GAP = { nibble: 6000, hook: 2000 };
const BRITISH = /^en[-_]GB$/i;
const ENGLISH = /^en(?:[-_]|$)/i;
const NARRATOR_NAMES = /\b(?:daniel|oliver|arthur|george|ryan|brian)\b/i;

// Voices may arrive after page load. Read the current list for each cue so the
// first one still plays and later ones can use a newly available British voice.
// Another English voice is used when the device has no British one.
function englishVoice(speech) {
  let voices;
  try { voices = speech.getVoices?.(); } catch (e) { return null; }
  if (!Array.isArray(voices)) return null;
  const score = (voice) => {
    const name = voice.name || "";
    return (NARRATOR_NAMES.test(name) ? 6 : 0)
      + (voice.localService ? 2 : 0)
      + (/\bmale\b/i.test(name) ? 2 : 0)
      + (/\b(?:natural|enhanced|premium)\b/i.test(name) ? 1 : 0);
  };
  const english = voices.filter((voice) => ENGLISH.test(voice?.lang || ""));
  const british = english.filter((voice) => BRITISH.test(voice.lang));
  return (british.length ? british : english).sort((a, b) => score(b) - score(a))[0] || null;
}

function readEnabled(store) {
  try { return store?.getItem(KEY) !== "false"; } catch (e) { return true; }
}
function localStore() { try { return globalThis.localStorage; } catch (e) { return null; } }

export function createVoiceCues({
  speech = globalThis.speechSynthesis,
  Utterance = globalThis.SpeechSynthesisUtterance,
  storage = localStore(),
  soundOn = () => Sound.isOn(),
  clock = () => performance.now(),
  hidden = () => !!globalThis.document?.hidden,
} = {}) {
  let enabled = readEnabled(storage);
  const last = { nibble: -Infinity, hook: -Infinity };
  const available = () => !!speech && typeof speech.speak === "function" && typeof Utterance === "function";
  const stop = () => { try { speech?.cancel?.(); } catch (e) { /* speech may disappear on app pause */ } };

  function setEnabled(value) {
    enabled = !!value;
    try { storage?.setItem(KEY, String(enabled)); } catch (e) { /* private storage */ }
    if (!enabled) stop();
  }

  function say(kind) {
    if (!WORDS[kind] || !available()) return false;
    if (!enabled || !soundOn() || hidden()) { stop(); return false; }
    const t = clock();
    if (t - last[kind] < GAP[kind]) return false;
    // A hook set takes priority. A nibble never queues behind another phrase.
    if (kind === "nibble" && (speech.pending || speech.speaking)) return false;
    if (kind === "hook") stop();
    try {
      const hint = new Utterance(WORDS[kind]);
      const voice = englishVoice(speech);
      hint.lang = voice?.lang?.replace("_", "-") || "en-GB";
      if (voice) hint.voice = voice;
      hint.rate = kind === "hook" ? 1 : 0.9;
      hint.pitch = 0.9;
      hint.volume = 0.85;
      speech.speak(hint);
      last[kind] = t;
      return true;
    } catch (e) { return false; }
  }

  return { get enabled() { return enabled; }, available, setEnabled, say, stop };
}

export const VoiceCues = createVoiceCues();
