// Bakes the Gull Rock wave tile off the main thread (see sea-waves.js).
import { bakeSeaWaves } from "./sea-waves.js";

self.onmessage = (e) => {
  const b = bakeSeaWaves(e.data || {});
  self.postMessage(b, [b.data.buffer]);
};
