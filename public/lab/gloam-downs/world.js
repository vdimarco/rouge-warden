// Load a baked place: <id>.json (settings and points), <id>.bin.gz (Ink Studio's SplatCodec rows, gzipped) and <id>.walk.bin.gz (the
// walk map). The files are gzipped on disk; a server may or may not say so, so the bytes are checked and unzipped here when they still
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
  const walk = new Int16Array(walkRaw.buffer, walkRaw.byteOffset, walkRaw.byteLength >> 1);
  onProgress(1);
  // the world object the renderer draws: the splat data, its palette and look, and (each frame) the bones
  const world = {
    data, count, pal: meta.pal, cam: meta.cam, radius: meta.radius, fog: meta.fog, dither: meta.dither, outline: meta.outline, ao: meta.ao,
    seed: meta.seed, moving: Int32Array.from(meta.moving), back: Int32Array.from(meta.back)
  };
  return { meta, world, walk };
}
