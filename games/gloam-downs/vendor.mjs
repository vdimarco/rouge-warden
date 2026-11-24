// Copy Ink Studio's renderer (and only that) into public/lab/gloam-downs/ink/, with its license. The page loads these files:
// two classic scripts that define PixelLook and SplatCodec, and the renderer's ES modules. The baked worlds need nothing else.
// After the copy, one patch: uniform-blocks.mjs goes next to the renderer, and resources.mjs uses it, so that the uniform arrays are
// in uniform blocks and not in the default block (phone GPUs give 256 vectors to each stage). The script stops if the patch does not
// fit the copied resources.mjs (patch-resources.mjs has the patch). Then it checks the rewrite on every program that the copy can make.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { patchResources } from './patch-resources.mjs';
import { rewrite, defaultVectors } from './uniform-blocks.mjs';
import { inkPrograms } from './ink-programs.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = path.dirname(createRequire(import.meta.url).resolve('@shapeshift-labs/ink-studio/package.json'));
const OUT = path.resolve(HERE, '../../public/lab/gloam-downs/ink');
const FILES = [
  ['src/pixel-look.js', 'pixel-look.js'],
  ['src/splat-codec.js', 'splat-codec.js'],
  ...['renderer', 'resources', 'targets', 'pipeline', 'shaders', 'view', 'water-optics'].map(n => [`src/webgl/${n}.mjs`, `webgl/${n}.mjs`]),
  ['LICENSE', 'LICENSE']
];
const commit = JSON.parse(fs.readFileSync(path.join(HERE, 'package-lock.json'), 'utf8')).packages['node_modules/@shapeshift-labs/ink-studio'].resolved.split('#')[1];
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'webgl'), { recursive: true });
let bytes = 0;
for (const [from, to] of FILES) {
  let text = fs.readFileSync(path.join(PKG, from), 'utf8');
  // the classic scripts end with a CommonJS export line for Node; the page has no module object
  if (to.endsWith('.js')) text = text.replace(/\nif \(typeof module[^\n]*\n?$/, '\n');
  if (to === 'webgl/resources.mjs') text = patchResources(text);
  fs.writeFileSync(path.join(OUT, to), text);
  bytes += text.length;
}
fs.copyFileSync(path.join(HERE, 'uniform-blocks.mjs'), path.join(OUT, 'webgl/uniform-blocks.mjs'));
fs.writeFileSync(path.join(OUT, 'README.md'), `# Ink Studio renderer

These files are copied by \`games/gloam-downs/vendor.mjs\` from [Ink Studio](https://github.com/siliconjungle/shapeshift-labs-ink-studio) at commit ${commit}, under its MIT license (\`LICENSE\`). Do not edit them here: change the pinned commit in \`games/gloam-downs/package.json\` and run the script again.

One change is not from Ink Studio. \`webgl/uniform-blocks.mjs\` is a copy of \`games/gloam-downs/uniform-blocks.mjs\`, and the script patches \`webgl/resources.mjs\` to use it. It moves the uniform arrays into uniform blocks, so that each program fits in the 256 uniform vectors that phone GPUs give to each stage. \`games/gloam-downs/patch-resources.mjs\` has the patch. The checks draw only the programs that Gloam Downs uses (no water, sprites or patterned look): see \`games/gloam-downs/README.md\` before you use this copy for more.
`);

console.log(`copied ${FILES.length} files and added uniform-blocks.mjs, ${(bytes / 1024).toFixed(0)} KB, from ${commit}`);

// Check the rewrite on every program that the copy can make, and show what it moves. A change in this list after a new Ink Studio
// commit is a reason to run qa/lab/gloam-downs-uniforms.e2e.mjs. The script stops when an array stays in the default block between
// #if and #endif, or when a stage keeps more than LIMIT vectors there.
const LIMIT = 200;
let bad = 0;
for (const { name, vertex, fragment } of await inkPrograms(OUT)) {
  const r = rewrite(vertex, fragment);
  const counts = [defaultVectors(r.vertex), defaultVectors(r.fragment)];
  const moved = r.blocks.map(b => `${b.name}(${b.members.map(m => m.name).join(' ')})`).join(' ');
  const over = Math.max(...counts) > LIMIT;
  if (over || r.skipped.length) bad++;
  console.log(`${over || r.skipped.length ? 'FAIL' : 'ok  '} ${name}: default block ${counts.join('/')} vectors at most; ${moved || 'no blocks'}` +
    (r.skipped.length ? `; arrays between #if and #endif: ${r.skipped.join(' ')}` : ''));
}
if (bad) throw new Error(`vendor.mjs: the uniform block rewrite does not fit ${bad} programs (see FAIL above)`);
