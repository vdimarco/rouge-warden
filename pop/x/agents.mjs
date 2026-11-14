// Two agents. Ink is careful. Clay is cheap and, on the map, ships a delivery the checker rejects.
// They are scripts, the same kind of agent as Marg and Gravel in pop/agents/seller.mjs.
import { make } from "../lib/make.mjs";

export const INK = { id: "ink", name: "Ink", askNum: 80n, askDen: 100n };
export const CLAY = { id: "clay", name: "Clay", askNum: 55n, askDen: 100n };

export function askOf(agent, budget) {
  return (BigInt(budget) * agent.askNum) / agent.askDen;
}

export function paintWork(seed, faulty) {
  return make("paint", { contrast_x100: 450 }, { seed, faulty });
}

// A 3-room map whose last room does not connect. The checker says "room cut off".
export const BAD_MAP = {
  rooms: [[0, 0], [1, 0], [3, 2]],
  links: [[[0, 0], [1, 0]]],
  entry: [0, 0],
  exit: [1, 0],
};

export function goodMap(seed) {
  return make("map", { rooms: 3, cols: 4, rows: 3 }, { seed, faulty: false });
}
