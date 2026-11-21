/* Fixed-grid, palette-aware resolve using coverage and cluster voting.
   No per-frame palette fitting, camera movement or black ink. */
const PixelLook = (() => {
  const weights = [0.30, 0.55, 0.15];
  const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const stipple = Object.freeze({
    cutoff: 0.19,
    stops: Object.freeze([
      [0, '#000000'], [0.14, '#176bfa'], [0.37, '#44c73d'],
      [0.57, '#e85dc9'], [0.77, '#ff8d27'], [1, '#fff1cd']
    ].map(Object.freeze)),
    pattern: 'bayer',
    amount: 1,
    seed: 0,
    preserveDots: true
  });
  const presets = Object.freeze({ stipple });
  const fraction = value => Number.isFinite(value) && value >= 0 && value <= 1;
  const bayerRanks = Float32Array.from(bayer, rank => (rank + 0.5) / bayer.length);
  const bayerRank = (x, y) => bayerRanks[(x & 3) + ((y & 3) << 2)];

  function toneSettings(definition) {
    if (definition === undefined || definition === false) return null;
    const overrides = typeof definition === 'string' ? { preset: definition } : definition;
    if (!overrides || Object.getPrototypeOf(overrides) !== Object.prototype)
      throw new TypeError('Expected a tone preset name or settings object');
    const { preset = 'stipple', ...changes } = overrides;
    if (!Object.hasOwn(presets, preset)) throw new RangeError('Unknown tone preset: ' + preset);
    for (const key of Object.keys(changes)) {
      if (!Object.hasOwn(stipple, key)) throw new TypeError('Unknown tone setting: ' + key);
    }
    const settings = { ...presets[preset], ...changes };
    const { cutoff, stops, pattern, amount, seed, preserveDots } = settings;
    if (!fraction(cutoff) || cutoff === 1) throw new RangeError('Tone cutoff must be in [0, 1)');
    if (!fraction(amount)) throw new RangeError('Tone dither amount must be in [0, 1]');
    if (pattern !== 'bayer' && pattern !== 'blue-noise')
      throw new RangeError('Tone pattern must be bayer or blue-noise');
    if (!Number.isSafeInteger(seed)) throw new RangeError('Tone seed must be a safe integer');
    if (typeof preserveDots !== 'boolean') throw new TypeError('Tone preserveDots must be a boolean');
    if (!Array.isArray(stops) || stops.length < 2 || stops.length > 48 ||
        !Array.from(stops).every((stop, i) => Array.isArray(stop) && stop.length === 2 &&
          fraction(stop[0]) && typeof stop[1] === 'string' && /^#[\da-f]{6}$/i.test(stop[1]) &&
          (i === 0 || stop[0] > stops[i - 1][0])) ||
        stops[0][0] !== 0 || stops[0][1] !== '#000000' || stops.at(-1)[0] !== 1)
      throw new RangeError('Use 2 to 48 increasing [position, #rrggbb] tone stops from [0, "#000000"] to position 1');
    return settings;
  }

  function prepareTone(definition, blueNoise) {
    const settings = toneSettings(definition);
    if (!settings) return null;
    let width = 4, height = 4, thresholds = bayerRanks.slice();
    if (settings.pattern === 'blue-noise') {
      if (typeof blueNoise !== 'function') throw new TypeError('Pass materials.blueNoise to prepare this tone pattern');
      const tile = blueNoise({ seed: settings.seed });
      width = tile.width;
      height = tile.height;
      thresholds = Float32Array.from(tile.ranks, rank => (rank + 0.5) / tile.ranks.length);
    }
    return {
      ...settings, width, height, thresholds,
      palette: settings.stops.map(stop => parseInt(stop[1].slice(1), 16))
    };
  }

  // Coordinates are top-left art pixels. Each band mixes its two adjacent palette entries.
  function toneIndex(tone, r, g, b, x, y) {
    const luma = r * weights[0] + g * weights[1] + b * weights[2];
    if (luma <= tone.cutoff) return 0;
    const value = (luma - tone.cutoff) / (1 - tone.cutoff);
    const stops = tone.stops;
    let low = 0;
    while (low < stops.length - 2 && value > stops[low + 1][0]) low++;
    const share = (value - stops[low][0]) / (stops[low + 1][0] - stops[low][0]);
    const rank = tone.thresholds[((y % tone.height + tone.height) % tone.height) * tone.width + (x % tone.width + tone.width) % tone.width];
    return low + Number(share >= 0.5 + (rank - 0.5) * tone.amount);
  }

  function nearest(c, palette, solid) {
    let best = solid && palette.length > 1 ? 1 : 0, distance = Infinity;
    for (let i = best; i < palette.length; i++) {
      const d = c.reduce((sum, v, k) => sum + (v - palette[i][k]) ** 2 * weights[k], 0);
      if (d < distance) { distance = d; best = i; }
    }
    return best;
  }
  function outputPalettes(base, locals) {
    const packed = base.slice();
    const indices = new Map(packed.map((color, index) => [color, index]));
    const rows = locals.map(palette => palette.map(([r, g, b]) => {
      const color = (Math.round(r * 255) << 16) | (Math.round(g * 255) << 8) | Math.round(b * 255);
      if (!indices.has(color)) {
        indices.set(color, packed.length);
        packed.push(color);
      }
      return indices.get(color);
    }));
    return { packed, rows };
  }

  function ink(body) {
    const shade = body.map(v => v * 0.64), luma = shade.reduce((n, v, k) => n + v * weights[k], 0);
    return shade.map(v => Math.min(1, v * Math.max(1, 0.12 / Math.max(luma, 0.001))));
  }
  function resolve({ color, depth, w, h, palette, grade, interiorColor, dither = 0, local, contour = true, ditherAt }) {
    const width = w / 2, height = h / 2, rgb = new Uint8Array(width * height * 3), use = new Uint32Array(local?.output.packed.length ?? palette.length);
    const mapped = i => grade ? grade.slice(i * 3, i * 3 + 3) : palette[i];
    const at = (x, y) => Math.max(0, Math.min(h - 1, y)) * w + Math.max(0, Math.min(w - 1, x));
    const z = (x, y) => Math.min(...[at(x * 2, y * 2), at(x * 2 + 1, y * 2), at(x * 2, y * 2 + 1), at(x * 2 + 1, y * 2 + 1)].map(i => depth[i]));
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const ids = [at(x * 2, y * 2), at(x * 2 + 1, y * 2), at(x * 2, y * 2 + 1), at(x * 2 + 1, y * 2 + 1)];
      const samples = ids.map(i => [color[i * 3] / 255, color[i * 3 + 1] / 255, color[i * 3 + 2] / 255]);
      const average = [0, 1, 2].map(k => samples.reduce((s, c) => s + c[k], 0) / 4);
      const base = (y * width + x) * 3;
      const native = interiorColor ? [0, 1, 2].map(k => interiorColor[base + k] / 255) : average;
      const rank = ditherAt ? bayerRank(...ditherAt(x, y)) : bayerRank(x, y);
      const noise = interiorColor ? (rank - 0.5) * dither : 0;
      const localId = local?.at[y * width + x];
      if (localId) {
        const id = localId - 1;
        const index = local.output.rows[id][nearest(native, local.palettes[id], false)];
        const tone = local.output.packed[index], q = ((height - 1 - y) * width + x) * 3;
        rgb[q] = tone >> 16;
        rgb[q + 1] = (tone >> 8) & 255;
        rgb[q + 2] = tone & 255;
        use[index]++;
        continue;
      }
      let selected = nearest(native.map(v => Math.max(0, Math.min(1, v + noise))), palette, false);
      let c = Array.from(mapped(selected));
      const votes = new Map(); let best = -1, score = 0, coverage = 0;
      ids.forEach((id, j) => {
        if (depth[id] >= 0.995) return;
        coverage++;
        const label = nearest(samples[j], palette, true), n = (votes.get(label) || 0) + 1;
        votes.set(label, n);
      });
      ids.forEach((id, j) => {
        if (depth[id] >= 0.995) return;
        const label = nearest(samples[j], palette, true), n = votes.get(label);
        if (n > score) { best = label; score = n; }
      });
      if (best >= 0) {
        const outer = coverage < 4 || [z(x - 1, y), z(x + 1, y), z(x, y - 1), z(x, y + 1)].some(d => d >= 0.995);
        if (outer && contour) {
          selected = best;
          const body = mapped(best), tone = ink(Array.from(body)), background = mapped(0), a = coverage / 4;
          c = body.map((v, k) => background[k] * (1 - a) + (v * 0.35 + tone[k] * 0.65) * a);
        }
      }
      use[selected]++;
      const q = ((height - 1 - y) * width + x) * 3;
      c.forEach((v, k) => { rgb[q + k] = Math.round(Math.max(0, Math.min(1, v)) * 255); });
    }
    return { w: width, h: height, rgb, use, ...(local && { palette: local.output.packed }) };
  }
  const glsl = `
int pixelNearest(vec3 c, bool solid) {
  int best = solid && u_n > 1 ? 1 : 0; float bd = 1e9;
  for (int i = 0; i < 48; i++) {
    if (i >= u_n) break; if (solid && i == 0 && u_n > 1) continue;
    vec3 df = c - u_pal[i]; float d = dot(df * df, vec3(0.30, 0.55, 0.15));
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}
vec3 pixelMapped(int i) { return u_grade > 0.5 ? u_out[i] : u_pal[i]; }
ivec2 pixelAt(ivec2 p) { return clamp(p, ivec2(0), textureSize(u_depth, 0) - 1); }
float pixelDepth(ivec2 p) {
  ivec2 q = p * 2; float d = 1.0;
  for (int y = 0; y < 2; y++) for (int x = 0; x < 2; x++) d = min(d, texelFetch(u_depth, pixelAt(q + ivec2(x, y)), 0).r);
  return d;
}
#ifndef PIXEL_NATIVE
vec3 pixelNative(ivec2 p) { return texelFetch(u_crispScene, p, 0).rgb; }
#endif
vec3 pixelResolve(ivec2 p) {
  vec3 samples[4]; int labels[4]; bool solid[4]; float coverage = 0.0;
  for (int i = 0; i < 4; i++) {
    ivec2 q = pixelAt(p * 2 + ivec2(i & 1, i >> 1));
    samples[i] = texelFetch(u_scene, q, 0).rgb;
    solid[i] = texelFetch(u_depth, q, 0).r < 0.995;
    labels[i] = pixelNearest(samples[i], solid[i]); if (solid[i]) coverage += 0.25;
  }
  vec3 native = pixelNative(p);   // (a page may define PIXEL_NATIVE and its own pixelNative, to work on the native picture first: glass, contact shade)
  float noise = ((BAYER[(p.x & 3) + ((p.y & 3) << 2)] + 0.5) / 16.0 - 0.5) * u_dither;
  vec3 c = pixelMapped(pixelNearest(clamp(native + noise, 0.0, 1.0), false)); int best = -1, score = 0;
  for (int i = 0; i < 4; i++) {
    if (!solid[i]) continue; int n = 0;
    for (int j = 0; j < 4; j++) if (solid[j] && labels[j] == labels[i]) n++;
    if (n > score) { best = labels[i]; score = n; }
  }
  if (best >= 0) {
    bool outer = coverage < 1.0 || max(max(pixelDepth(p - ivec2(1, 0)), pixelDepth(p + ivec2(1, 0))),
      max(pixelDepth(p - ivec2(0, 1)), pixelDepth(p + ivec2(0, 1)))) >= 0.995;
    if (outer) {
      vec3 body = pixelMapped(best);
      vec3 tone = body * 0.64; tone = min(vec3(1.0), tone * max(1.0, 0.12 / max(dot(tone, vec3(0.30, 0.55, 0.15)), 0.001)));
      c = mix(pixelMapped(0), mix(body, tone, 0.65), coverage);
    }
  }
  return c;
}`;
  const toneGlsl = `
uniform int u_inkToneCount;
uniform float u_inkToneCutoff;
uniform float u_inkToneAmount;
uniform vec4 u_inkToneStops[48]; // RGB color and stop position
uniform highp sampler2D u_inkToneRanks; // normalized threshold tile

vec3 inkToneResolve(vec3 color, ivec2 pixel) {
  float luma = dot(color, vec3(0.30, 0.55, 0.15));
  if (luma <= u_inkToneCutoff) return u_inkToneStops[0].rgb;
  float value = (luma - u_inkToneCutoff) / (1.0 - u_inkToneCutoff);
  int low = 0;
  for (int i = 1; i < 47; i++) {
    if (i >= u_inkToneCount - 1 || value <= u_inkToneStops[i].a) break;
    low = i;
  }
  vec4 a = u_inkToneStops[low], b = u_inkToneStops[low + 1];
  float share = (value - a.a) / (b.a - a.a);
  float rank = texelFetch(u_inkToneRanks, pixel % textureSize(u_inkToneRanks, 0), 0).r;
  return share >= mix(0.5, rank, u_inkToneAmount) ? b.rgb : a.rgb;
}`;
  return { nearest, ink, resolve, glsl, presets, toneSettings, prepareTone, toneIndex, toneGlsl, bayerRank, outputPalettes };
})();
