// Canvas adapter for the original ppc.spritesheet format. No game dependencies.
import { CREATURES } from './catalog.js';
const ROOT = new URL('./assets/', import.meta.url);
const known = new Set(CREATURES.map(c => c.id));
export function direction8(facing) {
  return ((Math.round(-facing / (Math.PI / 4)) % 8) + 8) % 8;
}
export function clipFrame(meta, state, facing, elapsed) {
  const direction = direction8(facing), clips = meta.clips;
  const clip = clips.find(c => c.state === state && c.direction === direction)
    || clips.find(c => c.state === 'idle' && c.direction === direction) || clips[0];
  if (!clip?.frames.length) return null;
  const length = clip.frames.reduce((n, f) => n + f.durationMs, 0);
  let ms = Math.max(0, elapsed * 1000);
  ms = clip.loop ? ms % length : Math.min(ms, length - .001);
  for (const frame of clip.frames) { if (ms < frame.durationMs) return frame; ms -= frame.durationMs; }
  return clip.frames.at(-1);
}
export class CreatureBank {
  constructor({ fetcher = globalThis.fetch, imageLoader, limit = 8 } = {}) {
    this.fetcher = fetcher; this.limit = limit; this.cache = new Map(); this.errors = new Map(); this.failed = 0;
    this.imageLoader = imageLoader || (src => new Promise((resolve, reject) => {
      const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error(`Creature page unavailable: ${src}`)); image.src = src;
    }));
  }
  load(id) {
    if (!known.has(id)) return Promise.resolve(null);
    const entry = this.cache.get(id);
    if (entry) { this.cache.delete(id); this.cache.set(id, entry); return entry.promise; }
    if (this.errors.has(id)) return Promise.resolve(null);
    const item = { ready: null, promise: null };
    item.promise = (async () => {
      const response = await this.fetcher(new URL(id + '.json', ROOT));
      if (!response.ok) throw new Error(`Creature metadata unavailable: ${id} (${response.status})`);
      const meta = await response.json();
      if (meta.format !== 'ppc.spritesheet' || meta.formatVersion !== 1 || !meta.clips?.length || meta.frameWidth <= 0 || meta.frameHeight <= 0) throw new Error(`Invalid creature export: ${id}`);
      const pages = await Promise.all(meta.pages.map(p => this.imageLoader(new URL(p.file, ROOT).href)));
      item.ready = { meta, pages }; return item.ready;
    })().catch(error => { this.errors.set(id, error.message); this.failed++; return null; });
    this.cache.set(id, item);
    return item.promise;
  }
  retain(ids) {
    const active = new Set(ids);
    // Evict complete inactive sheets only. In-flight requests stay deduplicated.
    for (const [id, item] of this.cache) if (this.cache.size > this.limit && !active.has(id) && item.ready) this.cache.delete(id);
  }
  draw(ctx, id, { x, y, height, facing = 0, state = 'idle', elapsed = 0, alpha = 1 }) {
    const asset = this.cache.get(id)?.ready;
    if (!asset) { this.load(id); return null; }
    const { meta, pages } = asset, frame = clipFrame(meta, state, facing, elapsed);
    if (!frame || !pages[frame.page]) return null;
    const scale = height / meta.frameHeight, box = { x: x - meta.originX * scale, y: y - meta.originY * scale, w: meta.frameWidth * scale, h: height };
    ctx.save(); ctx.globalAlpha = alpha; ctx.imageSmoothingEnabled = false;
    ctx.drawImage(pages[frame.page], frame.x, frame.y, meta.frameWidth, meta.frameHeight, box.x, box.y, box.w, box.h); ctx.restore();
    return box;
  }
  stats() { return { loaded: [...this.cache.values()].filter(a => a.ready).length, failed: this.failed, errors: Object.fromEntries(this.errors) }; }
}
