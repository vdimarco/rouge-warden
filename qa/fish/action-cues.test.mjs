// A cue must show the action the player can take in the current game state.
import assert from "node:assert/strict";
import { selectAction } from "../../public/fish/js/action-cues.js";

const cases = [
  ["hold the line", { phase: "cast", step: "ready", text: "Hold your thumb on the rod.", icon: "thumb" }, "hold", 0],
  ["correct phone orientation", { phase: "cast", step: "ready", text: "Hold the phone upright.", icon: "upright" }, "upright", 0],
  ["cast forward", { phase: "cast", step: "loaded", text: "Flick up and let go!", icon: "flick" }, "cast", 0],
  ["feather a flying lure", { phase: "cast", step: "flight", text: "Your thumb slows the line.", icon: "thumb" }, "feather", 0],
  ["wait through a nibble", { phase: "reel", fishPhase: "retrieve", text: "A fish is nibbling.", sub: "Wait for the strike.", icon: "fish" }, "nibble", 0],
  ["set the hook", { phase: "reel", fishPhase: "strike", text: "SNAP IT UP! Set the hook!", icon: "pull" }, "hook", 0],
  ["let a running fish go", { phase: "reel", fishPhase: "fight", text: "It runs! Let it go.", icon: "pull" }, "stop", 0],
  ["steer right with a key", { phase: "reel", fishPhase: "fight", text: "The line is on a stump!", sub: "Hold D.", icon: "turn" }, "turn", 1],
  ["steer left with a key", { phase: "reel", fishPhase: "fight", text: "The line is on a stump!", sub: "Hold A.", icon: "turn" }, "turn", -1],
  ["tighten drag", { phase: "reel", fishPhase: "fight", text: "The spool is almost empty!", sub: "Tap + to tighten the drag.", icon: "stop" }, "drag", 0],
  ["lower the rod on a jump", { phase: "reel", fishPhase: "fight", text: "It jumped! Lower the rod!", icon: "low" }, "low", 0],
];

for (const [name, cue, kind, side] of cases) {
  assert.deepEqual(selectAction(cue), { kind, side }, name);
  console.log(`ok   ${name}`);
}
