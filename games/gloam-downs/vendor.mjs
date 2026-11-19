// Copy Ink Studio's renderer (and only that) into public/lab/gloam-downs/ink/, with its license. The page loads these nine files:
// two classic scripts that define PixelLook and SplatCodec, and the renderer's ES modules. The baked worlds need nothing else.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

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
  fs.writeFileSync(path.join(OUT, to), text);
  bytes += text.length;
}
fs.writeFileSync(path.join(OUT, 'README.md'), `# Ink Studio renderer

These files are copied by \`games/gloam-downs/vendor.mjs\` from [Ink Studio](https://github.com/siliconjungle/shapeshift-labs-ink-studio) at commit ${commit}, under its MIT license (\`LICENSE\`). Do not edit them here: change the pinned commit in \`games/gloam-downs/package.json\` and run the script again.
`);
console.log(`copied ${FILES.length} files, ${(bytes / 1024).toFixed(0)} KB, from ${commit}`);
