import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const html = read('public/index.html');
const catalog = read('public/arcade/switch.js');
const array = (source, name) => vm.runInNewContext(source.match(new RegExp(`const ${name} = (\\[[\\s\\S]*?\\n\\s*\\]);`))[1]);
const games = array(catalog, 'GAMES');
const groups = array(html, 'GROUPS');
const cabinets = [...html.matchAll(/<article class="cab[^\"]*"[^>]*data-game="([^\"]+)"[^>]*data-url="([^\"]+)"[\s\S]*?<div class="marquee">[\s\S]*?<b>([^<]*)<\/b>[\s\S]*?<\/article>/g)];

assert.equal(new Set(games.map(game => game.id)).size, games.length, 'Catalog ids remain unique');
assert.equal(new Set(cabinets.map(cabinet => cabinet[1])).size, cabinets.length, 'Cabinet ids remain unique');
for (const game of games) {
  const cabinet = cabinets.find(item => item[1] === game.id);
  assert.ok(cabinet, `${game.id} has a cabinet`);
  assert.equal(cabinet[2], game.url, `${game.id} opens its catalog route`);
  assert.equal(cabinet[3].toLowerCase(), game.name.toLowerCase(), `${game.id} retains its title`);
  assert.ok(fs.existsSync(path.join(root, 'public', game.art)), `${game.id} art exists`);
}
const front = games.find(game => game.id === 'ascii-front');
assert.ok(front);
assert.equal(front.name, 'ASCII Front');
assert.equal(front.sub, 'ASCII tank roguelite');
assert.equal(front.url, '/ascii-front/');
assert.equal(front.art, '/ascii-front/key.svg');
assert.equal(groups.find(group => group.id === 'ascii').games.filter(id => id === front.id).length, 1);
assert.equal(groups.flatMap(group => group.games).filter(id => id === front.id).length, 1);
assert.ok(cabinets.find(item => item[1] === front.id)[0].includes('ascii-front/key.svg'));

const page = read('public/ascii-front/index.html');
assert.ok(page.includes('/arcade/switch.js'), 'Deployed game includes the shared switcher');
assert.ok(page.includes('/arcade/quiet.js'), 'Deployed game includes hidden-page audio handling');
for (const [, asset] of page.matchAll(/(?:src|href)="([^\"]+)"/g)) {
  if (asset.startsWith('#') || /^(https?:|data:)/.test(asset)) continue;
  const file = asset.startsWith('/') ? path.join(root, 'public', asset) : path.join(root, 'public/ascii-front', asset);
  assert.ok(fs.existsSync(file), `Deployed asset ${asset} exists`);
}
console.log(`ASCII Front integration passed; ${games.length} catalog/cabinet pairs and art files remain valid.`);
