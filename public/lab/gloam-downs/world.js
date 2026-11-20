// Load a baked place: <id>.json (settings and points), <id>.bin.gz (Ink Studio's SplatCodec rows, gzipped) and <id>.walk.bin.gz (the
// walk map, play.js makeWalk reads it). The files are gzipped on disk; a server may or may not say so, so the bytes are checked and unzipped here when they still
// start with the gzip mark. SplatCodec is the global that ink/splat-codec.js defines (a top-level const, so it is not on globalThis).
const GZ = b => b.length > 2 && b[0] === 0x1f && b[1] === 0x8b;
async function unzip(bytes) {
  if (!GZ(bytes)) return bytes;
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
// fetch with progress: onBytes(received, total) as the body arrives
async function fetchBytes(url, onBytes) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  const total = +r.headers.get('content-length') || 0;
  if (!r.body || !onBytes) return new Uint8Array(await r.arrayBuffer());
  const reader = r.body.getReader(), parts = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
    got += value.length;
    onBytes(got, total);
  }
  const out = new Uint8Array(got);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

export async function loadPlace(base, id, onProgress = () => {}) {
  const meta = await (await fetch(`${base}${id}.json`)).json();
  if (meta.format !== 'gloam-downs/1') throw new Error(`${id}.json is not a Gloam Downs world`);
  let a = 0, b = 0;
  const report = () => onProgress(Math.min(0.95, (a * 0.9 + b * 0.1)));
  const [rows, walkBytes] = await Promise.all([
    fetchBytes(`${base}${id}.bin.gz`, (got, total) => { a = total ? got / total : Math.min(0.9, got / 1.4e6); report(); }),
    fetchBytes(`${base}${id}.walk.bin.gz`, (got, total) => { b = total ? got / total : 0.5; report(); })
  ]);
  const [rowsRaw, walkRaw] = await Promise.all([unzip(rows), unzip(walkBytes)]);
  /* global SplatCodec */
  const { data, count } = SplatCodec.decode(rowsRaw, { maxRows: 1_000_000 });
  if (count !== meta.count) throw new Error(`${id}: ${count} splats, expected ${meta.count}`);
  // the walk map: Int16 layers one after the other, as many as the JSON names (T and G, and U in a map baked with the gap's underside)
  const walk = new Int16Array(walkRaw.buffer, walkRaw.byteOffset, walkRaw.byteLength >> 1);
  const layers = meta.walk.layers?.length ?? 2;
  if (walk.length !== meta.walk.nx * meta.walk.nz * layers) throw new Error(`${id}: the walk map does not hold the ${layers} layers its settings name`);
  onProgress(1);
  // the world object the renderer draws: the splat data, its palette and look, and (each frame) the bones
  const world = {
    data, count, pal: meta.pal, cam: meta.cam, radius: meta.radius, fog: meta.fog, dither: meta.dither, outline: meta.outline, ao: meta.ao,
    seed: meta.seed, moving: Int32Array.from(meta.moving), back: Int32Array.from(meta.back)
  };
  return { meta, world, walk };
}

/* The combat run's figures: which is 'foes' (foes.bin.gz and foes.json.gz: the four foe types, the light carried after the fall, and
   each place's pool) or 'boss' (the Barrow Reeve and its grave candles). Returns { json, data, count }; pool.js readFigures() makes
   the JSON ready to pose. */
export async function loadFigures(base, which, onProgress = () => {}) {
  const [rows, js] = await Promise.all([
    fetchBytes(`${base}${which}.bin.gz`, (got, total) => onProgress(total ? Math.min(0.95, got / total) : 0.5)),
    fetchBytes(`${base}${which}.json.gz`)
  ]);
  const [rowsRaw, jsRaw] = await Promise.all([unzip(rows), unzip(js)]);
  const json = JSON.parse(new TextDecoder().decode(jsRaw));
  if (!/^gloam-downs-(foes|boss)\/1$/.test(json.format)) throw new Error(`${which}.json.gz is not a Gloam Downs figure file`);
  const { data, count } = SplatCodec.decode(rowsRaw, { maxRows: 100_000 });
  if (count !== json.count) throw new Error(`${which}: ${count} splats, expected ${json.count}`);
  onProgress(1);
  return { json, data, count };
}
