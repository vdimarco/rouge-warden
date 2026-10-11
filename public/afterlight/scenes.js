// Original bas3line/ascii scenes are bundled beside the six standalone games.
// MIT source attribution and license remain with every imported scene.
import * as forest from "../firefly-courier/vendor/misty-forest.js";
import * as city from "../last-train-home/vendor/tokyo-rain.js";
import * as coast from "../last-light/vendor/night-coast.js";
import * as fjord from "../last-light/vendor/aurora-fjord.js";
import * as desert from "../mirage-runner/vendor/desert-night.js";
import * as moon from "../orbital-gardener/vendor/earthrise.js";
const additions = {
  forest: ["#a8bc75", "#dde7ad", "#fff0b9", "#77916d"],
  city: ["#ffdea3", "#76ced0", "#dd829f", "#607185"],
  coast: ["#ffe7a4", "#7a9ea9", "#55696d", "#d09b67"],
  fjord: ["#b7dce4", "#547891", "#71e6b0", "#88d5cf"],
  desert: ["#365d50", "#749777", "#8cbed0", "#d4c18d"],
  moon: ["#72958a", "#abd6ac", "#cee8dc", "#d5c8a2"],
};
const sources = { forest, city, coast, fjord, desert, moon };
export const SCENES = Object.fromEntries(
  Object.entries(sources).map(([id, module]) => [
    id,
    {
      id,
      module,
      cols: 200,
      rows: 100,
      ground: module.meta.ground,
      palette: [...module.meta.palette, ...additions[id]],
      extra: module.meta.palette.length,
      source: module.meta.name,
    },
  ]),
);
export function createScene(region) {
  const s = SCENES[region] || SCENES.forest;
  return {
    descriptor: s,
    frame: s.module.default(),
    color: new Uint8Array(20000),
  };
}
