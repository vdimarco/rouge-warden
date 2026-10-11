// Two brief spoken move hints. The full instructions remain in the live region;
// speech is optional, and these calls never build a queue over the game's sounds.
import { Sound } from "./audio.js";

const KEY = "fish.voiceHints";
const WORDS = { nibble: "Nibble. Hold steady.", hook: "Set the hook!" };
const GAP = { nibble: 6000, hook: 2000 };

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
      hint.lang = "en-US";
      hint.rate = 1.08;
      hint.volume = 0.85;
      speech.speak(hint);
      last[kind] = t;
      return true;
    } catch (e) { return false; }
  }

  return { get enabled() { return enabled; }, available, setEnabled, say, stop };
}

export const VoiceCues = createVoiceCues();
