// Run any Higgsfield API model once and save what it makes (server-side only). Each run is a paid generation.
//
//   npm run gen -- <model> <input> [--out <dir>] [--name <base>] [--wait <minutes>]
//
// <input> is JSON, or @file.json. Under a key that ends in url or urls, a string "@path/to/file.png" is
// uploaded first and replaced by its public URL, so local images, audio and video can feed image_url,
// image_urls, video_url or audio_url.
// Prints each output URL on stdout. With --out it also saves the files as <name>, <name>-2 and so on.
// Example:
//   npm run gen -- kling-video/v3.0/pro/image-to-video '{"prompt":"slow push in","image_url":"@frame.png"}' --out out --name shot1
// Use `npm run models` to list the model ids.

import { readFile, mkdir } from 'node:fs/promises';
import { run, upload, outputs, download, fail, note, done } from './lib.ts';

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  if (i < 0) return undefined;
  const v = args[i + 1];
  if (!v || v.startsWith('--')) fail(`--${name} needs a value.`);
  args.splice(i, 2);
  return v;
};
const outDir = flag('out');
const name = flag('name') ?? 'output';
const wait = Number(flag('wait') ?? 20);
if (!Number.isFinite(wait) || wait <= 0) fail('--wait must be a number of minutes.');
const [model, raw] = args;
if (!model || raw === undefined || args.length > 2) {
  fail('usage: npm run gen -- <model> <input JSON or @file.json> [--out <dir>] [--name <base>] [--wait <minutes>]');
}
if (!/^[a-z0-9][a-z0-9._/-]*$/i.test(model) || model.includes('..')) fail(`"${model}" is not a model id.`);
if (!/^[\w.-]+$/.test(name)) fail('--name may use only letters, digits, dot, dash and underscore.');
// Check the output folder before anything is paid for.
if (outDir) await mkdir(outDir, { recursive: true }).catch(() => fail(`cannot use ${outDir} as the output folder.`));

let input: Record<string, unknown>;
try {
  const text = raw.startsWith('@') ? await readFile(raw.slice(1), 'utf8') : raw;
  input = JSON.parse(text);
} catch {
  fail('the input is not valid JSON (or the @file cannot be read).');
}
if (!input || typeof input !== 'object' || Array.isArray(input)) fail('the input must be a JSON object.');

// Upload every "@path" string under a key that ends in url or urls (image_url, image_urls, video_url...),
// however deep it sits. Other strings, such as a prompt that starts with "@", stay as they are.
async function uploads(value: unknown, key = ''): Promise<unknown> {
  const isUrlKey = /urls?$/i.test(key);
  if (typeof value === 'string' && value.startsWith('@') && isUrlKey) return upload(value.slice(1));
  if (Array.isArray(value)) {
    const out: unknown[] = [];
    for (const v of value) out.push(await uploads(v, key));
    return out;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = await uploads(v, k);
    return out;
  }
  return value;
}
input = (await uploads(input)) as Record<string, unknown>;

const result = await run(model, input, { maxWaitMs: wait * 60_000 });
const files = outputs(result);
if (!files.length) fail(`request ${result.request_id} completed but returned no output URL.`);
// Print every URL first, so a failed download can never hide a paid output.
for (const f of files) console.log(f.url);
let lost = 0;
if (outDir) {
  for (const [i, f] of files.entries()) {
    try {
      note(`saved ${await download(f.url, outDir, i ? `${name}-${i + 1}` : name)} (${f.kind}).`);
    } catch (err) {
      lost++;
      note(`could not save ${f.url} from request ${result.request_id}: ${(err as Error).message}. The URL stays valid for at least 7 days.`);
    }
  }
}
if (lost) fail(`${lost} of ${files.length} files were not saved.`);
done();
