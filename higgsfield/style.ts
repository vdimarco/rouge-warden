// Game style files (no API calls). styles/<name>.json holds the style text and the reference images that every
// art request for one game should carry, so a new asset starts in that game's look without restating it.
//
//   { "game": "...", "about": "where this look is recorded", "prompt": "style text", "references": ["public/..."] }
//
// Reference paths are relative to the repository root. applyStyle() adds the style text after the request's own
// prompt and the references after its own image_urls, as "@path" strings that gen.ts uploads.

import { readFile, readdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export type Style = { name: string; game: string; about: string; prompt: string; references: string[] };

const STYLES = new URL('./styles/', import.meta.url);
const ROOT = new URL('../', import.meta.url);
const IMAGE = /\.(jpe?g|png|webp|gif)$/i;

export async function styleNames(dir = STYLES): Promise<string[]> {
  const files = await readdir(dir).catch(() => []);
  return files.filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).sort();
}

export const referencePath = (ref: string): string => fileURLToPath(new URL(ref, ROOT));

// Read and check one style, including that every reference image exists, so a bad style fails before anything is paid.
export async function loadStyle(name: string, dir = STYLES): Promise<Style> {
  if (!/^[a-z0-9-]+$/.test(name)) throw new Error(`"${name}" is not a style name.`);
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(await readFile(new URL(`${name}.json`, dir), 'utf8'));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`there is no style "${name}". Styles: ${(await styleNames(dir)).join(', ') || 'none'}.`);
    }
    throw new Error(`styles/${name}.json is not valid JSON.`);
  }
  const { game, about, prompt, references } = raw;
  if (typeof game !== 'string' || !game.trim()) throw new Error(`styles/${name}.json needs a "game".`);
  if (typeof about !== 'string' || !about.trim()) throw new Error(`styles/${name}.json needs an "about" that says where the look is recorded.`);
  if (typeof prompt !== 'string' || !prompt.trim()) throw new Error(`styles/${name}.json needs a "prompt".`);
  if (!Array.isArray(references) || !references.length) throw new Error(`styles/${name}.json needs at least one reference image.`);
  for (const ref of references) {
    if (typeof ref !== 'string' || ref.startsWith('/') || ref.split('/').includes('..') || !IMAGE.test(ref)) {
      throw new Error(`styles/${name}.json: "${ref}" must be a JPEG, PNG, WebP or GIF path inside the repository.`);
    }
    const file = await stat(referencePath(ref)).catch(() => null);
    if (!file?.isFile()) throw new Error(`styles/${name}.json: ${ref} does not exist.`);
  }
  return { name, game, about, prompt: prompt.trim(), references };
}

// Return a new input with the style applied; the given input is not changed.
export function applyStyle(input: Record<string, unknown>, style: Style): Record<string, unknown> {
  const { prompt, image_urls: own = [] } = input;
  if (typeof prompt !== 'string' || !prompt.trim()) throw new Error('--style needs a "prompt" in the input.');
  if (!Array.isArray(own)) throw new Error('--style adds reference images to "image_urls", which must be a list.');
  return {
    ...input,
    prompt: `${prompt.trim()}\n\nStyle: ${style.prompt}`,
    image_urls: [...own, ...style.references.map((ref) => `@${referencePath(ref)}`)],
  };
}
