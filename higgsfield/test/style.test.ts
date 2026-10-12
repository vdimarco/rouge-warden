import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { styleNames, loadStyle, applyStyle, referencePath, type Style } from '../style.ts';

const run = promisify(execFile);
const here = new URL('..', import.meta.url);
const sample: Style = { name: 'sample', game: 'Sample', about: 'test', prompt: 'ink lines, flat colour', references: ['public/a.webp', 'public/b.png'] };

test('every style file loads and its reference images exist', async () => {
  const names = await styleNames();
  assert.ok(names.length > 0, 'no style files in styles/');
  for (const name of names) {
    const style = await loadStyle(name);
    assert.equal(style.name, name);
  }
});

test('a style adds its text after the prompt and its images after the request images', () => {
  const input = { prompt: '  a mossy brick wall ', image_urls: ['@mine.png'], resolution: '1k' };
  const styled = applyStyle(input, sample);
  assert.equal(styled.prompt, 'a mossy brick wall\n\nStyle: ink lines, flat colour');
  assert.deepEqual(styled.image_urls, ['@mine.png', `@${referencePath('public/a.webp')}`, `@${referencePath('public/b.png')}`]);
  assert.equal(styled.resolution, '1k');
  assert.deepEqual(input.image_urls, ['@mine.png'], 'the given input must not change');
});

test('a style needs a prompt and a list of image_urls', () => {
  assert.throws(() => applyStyle({ image_urls: [] }, sample), /needs a "prompt"/);
  assert.throws(() => applyStyle({ prompt: 'x', image_urls: '@one.png' }, sample), /must be a list/);
});

test('a style with a missing reference image or no about fails to load', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'styles-'));
  try {
    const base = { game: 'Test', about: 'test', prompt: 'ink', references: ['public/no-such-image.webp'] };
    await writeFile(join(dir, 'missing.json'), JSON.stringify(base));
    await writeFile(join(dir, 'unsourced.json'), JSON.stringify({ ...base, about: '' }));
    const url = pathToFileURL(`${dir}/`);
    await assert.rejects(loadStyle('missing', url), /public\/no-such-image\.webp does not exist/);
    await assert.rejects(loadStyle('unsourced', url), /needs an "about"/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('an unknown style names the styles there are', async () => {
  await assert.rejects(loadStyle('no-such-game'), /there is no style "no-such-game"\. Styles: /);
  await assert.rejects(loadStyle('../lib'), /not a style name/);
});

test('gen --dry-run prints the styled input and sends nothing', async () => {
  const [name] = await styleNames();
  const style = await loadStyle(name);
  const { stdout, stderr } = await run(process.execPath, ['gen.ts', 'some/model', '{"prompt":"a lantern"}', '--style', name, '--dry-run'], { cwd: here });
  const sent = JSON.parse(stdout);
  assert.equal(sent.prompt, `a lantern\n\nStyle: ${style.prompt}`);
  assert.deepEqual(sent.image_urls, style.references.map((ref) => `@${referencePath(ref)}`));
  assert.match(stderr, /dry run: nothing was uploaded or sent/);
});

test('gen fails on an unknown style before anything is sent', async () => {
  await assert.rejects(run(process.execPath, ['gen.ts', 'some/model', '{"prompt":"a lantern"}', '--style', 'no-such-game', '--dry-run'], { cwd: here }),
    /there is no style "no-such-game"/);
});
