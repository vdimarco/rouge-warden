// Make a texture tile: crossfade each edge band with the opposite edge, in place (no dependencies).
//
// Pixel k from an edge is mixed with pixel k from the opposite edge by w = 0.5 * (1 - k / band)^2, so the two
// outermost rows (and columns) end up equal and the blend fades out over `band` pixels. Top and bottom go first,
// then left and right. This is the step River Rush used for its ground, surface and bark tiles.
// It joins the edges but cannot remove a feature that repeats; strong patterns such as brick courses can show
// a doubled band near the edge, so check a 2 by 2 preview before using a swatch.

export function seamless(pixels: Uint8Array, width: number, height: number, channels: number, band = 48): Uint8Array {
  if (pixels.length !== width * height * channels) throw new Error('seamless: the pixel count does not match the size.');
  if (!(band >= 1 && band * 2 <= Math.min(width, height))) throw new Error('seamless: the band must fit twice across the image.');
  for (const axis of [0, 1]) {
    const run = axis ? height : width;
    const span = axis ? width : height;
    for (let p = 0; p < run; p++) for (let k = 0; k < band; k++) {
      // axis 0 pairs row k with row span-1-k at column p; axis 1 pairs column k with column span-1-k at row p.
      const a = ((axis ? p : k) * width + (axis ? k : p)) * channels;
      const b = ((axis ? p : span - 1 - k) * width + (axis ? span - 1 - k : p)) * channels;
      const w = 0.5 * (1 - k / band) ** 2;
      for (let c = 0; c < channels; c++) {
        const x = pixels[a + c], y = pixels[b + c];
        pixels[a + c] = Math.round(x * (1 - w) + y * w);
        pixels[b + c] = Math.round(y * (1 - w) + x * w);
      }
    }
  }
  return pixels;
}

// Make a crop tile from the image around it. `pixels` holds the crop plus `band` pixels of the surrounding image
// on every side; the result is the inner (width - 2 band) by (height - 2 band) tile. Pixel k inside an edge mixes
// with pixel k past the opposite edge by the same w as above, so the tile continues into itself across each seam
// and an exact repeat comes out unchanged. Top and bottom go first, across the full width, then left and right.
export function wrapTile(pixels: Uint8Array, width: number, height: number, channels: number, band: number): Uint8Array {
  if (pixels.length !== width * height * channels) throw new Error('wrapTile: the pixel count does not match the size.');
  if (!(band >= 1 && band * 4 <= Math.min(width, height))) throw new Error('wrapTile: the band must fit twice across the tile.');
  const mix = (a: number, b: number, w: number) => {
    for (let c = 0; c < channels; c++) pixels[a + c] = Math.round(pixels[a + c] * (1 - w) + pixels[b + c] * w);
  };
  const weight = (k: number) => 0.5 * (1 - k / band) ** 2;
  for (let k = 0; k < band; k++) {
    const w = weight(k);
    for (let x = 0; x < width; x++) {
      const at = (y: number) => (y * width + x) * channels;
      mix(at(band + k), at(height - band + k), w); // top edge, with what follows the bottom edge
      mix(at(height - band - 1 - k), at(band - 1 - k), w); // bottom edge, with what comes before the top edge
    }
  }
  for (let k = 0; k < band; k++) {
    const w = weight(k);
    for (let y = band; y < height - band; y++) {
      const at = (x: number) => (y * width + x) * channels;
      mix(at(band + k), at(width - band + k), w);
      mix(at(width - band - 1 - k), at(band - 1 - k), w);
    }
  }
  const inner = width - 2 * band, tile = new Uint8Array(inner * (height - 2 * band) * channels);
  for (let y = 0; y < height - 2 * band; y++) {
    const from = ((y + band) * width + band) * channels;
    tile.set(pixels.subarray(from, from + inner * channels), y * inner * channels);
  }
  return tile;
}
