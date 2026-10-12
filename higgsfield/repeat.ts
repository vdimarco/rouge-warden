// Find the square crop of a texture whose edges continue into the same place in its pattern (no dependencies),
// so that the crop tiles after only a light crossfade.
//
// For a size P and an offset o along one axis, the crop [o, o + P) wraps cleanly when the lines around its end
// match the lines around its start. The cost compares line o + j with line o + P + j for j from -band to
// band - 1, which are the lines seamless.ts blends at that seam. It is the mean absolute difference of grey
// levels (0 to 255). A band that only covered a plain stripe, such as a mortar line, would match at any size;
// a band on both sides of the seam reaches into the pattern beside it.
// One size serves both axes, so the crop stays square and the pattern is not stretched. Each axis takes its own
// best offset, and the size with the lowest mean of the two costs wins. Ties keep the smaller size.

export type Repeat = { size: number; x: number; y: number; cost: number };

// The best offset and its cost for every size from min to max along one axis.
function axisCosts(gray: Uint8Array, width: number, height: number, axis: 'x' | 'y', band: number, min: number, max: number) {
  const lines = axis === 'y' ? height : width;
  const across = axis === 'y' ? width : height;
  const at = axis === 'y' ? (line: number, i: number) => line * width + i : (line: number, i: number) => i * width + line;
  const diff = new Float64Array(lines);
  const offset = new Int32Array(max + 1), cost = new Float64Array(max + 1).fill(Infinity);
  for (let size = min; size <= max; size++) {
    // diff[line]: how far a line differs from the line `size` further on, summed across the image.
    for (let line = 0; line + size < lines; line++) {
      let sum = 0;
      for (let i = 0; i < across; i++) sum += Math.abs(gray[at(line, i)] - gray[at(line + size, i)]);
      diff[line] = sum;
    }
    // Slide a window of 2 * band lines centred on each possible start.
    let window = 0;
    for (let line = 0; line < 2 * band; line++) window += diff[line];
    for (let o = band; o + size + band <= lines; o++) {
      if (o > band) window += diff[o + band - 1] - diff[o - band - 1];
      const c = window / (2 * band * across);
      if (c < cost[size]) { cost[size] = c; offset[size] = o; }
    }
  }
  return { offset, cost };
}

export function findRepeat(gray: Uint8Array, width: number, height: number, band: number, min: number, max: number): Repeat {
  if (gray.length !== width * height) throw new Error('findRepeat: the pixel count does not match the size.');
  if (!(band >= 1 && min >= 1 && min <= max && max + 2 * band <= Math.min(width, height))) {
    throw new Error('findRepeat: the crop sizes and the band must fit inside the image.');
  }
  const ys = axisCosts(gray, width, height, 'y', band, min, max);
  const xs = axisCosts(gray, width, height, 'x', band, min, max);
  let best: Repeat = { size: 0, x: 0, y: 0, cost: Infinity };
  for (let size = min; size <= max; size++) {
    const cost = (xs.cost[size] + ys.cost[size]) / 2;
    if (cost < best.cost) best = { size, x: xs.offset[size], y: ys.offset[size], cost };
  }
  return best;
}
