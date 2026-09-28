// Stub AUDIO (frozen; the look package replaces audio/audio.js, not this file). Every call is silent.
export function init(S) {
  S.audio = {
    sfx() {},
    loop() { return { set() {}, stop() {} }; },
    cue() {},
    wind() {},
  };
}
