import assert from 'node:assert/strict';
import { createMatch, player, step, trainSkill, HEROES } from '../../public/tidebreak/sim.js';
import { KITS, cooldownFor, rankGate } from '../../public/tidebreak/abilities.js';
import { manaCost } from '../../public/tidebreak/combat-rules.js';
import { HERO_IDENTITIES, identityFor, identitySkill, assignIdentities } from '../../public/tidebreak/hero-identities.js';
import { spellbookHTML } from '../../public/tidebreak/spellbook.js';
import { loadArt, Renderer } from '../../public/tidebreak/illustrated-render.js';

assert.deepEqual(HERO_IDENTITIES.map(h => h.name), ['Tidewarden', 'Embersong', 'Voidcaller', 'Stoneheart', 'Skyreaver', 'Irontide', 'Moonweaver', 'Dredge', 'Glasshand', 'Salt Priestess', 'Riftblade', 'Coral Sage', 'Nightcurrent', 'The Marrow', 'Bloodwake', 'Zephyrs']);
assert.deepEqual(HERO_IDENTITIES.map(h => h.kit), [1, 9, 4, 7, 0, 12, 8, 3, 2, 10, 6, 15, 11, 5, 13, 14]);
assert.equal(new Set(HERO_IDENTITIES.map(h => h.slug)).size, 16);
assert.equal(new Set(HERO_IDENTITIES.map(h => h.kit)).size, HEROES.length);

const combatState = state => JSON.stringify(state, (key, value) => ['identity', 'name', 'random'].includes(key) ? undefined : value);
for (const identity of HERO_IDENTITIES) {
  const baseline = createMatch(identity.kit, 73);
  const state = createMatch(identity.kit, 73);
  assert.equal(assignIdentities(state, identity.id), state);
  const p = player(state);
  assert.equal(p.hero, identity.kit);
  assert.equal(identityFor(p), identity);
  assert.equal(p.name, identity.name);
  for (const entity of state.units.filter(e => e.kind === 'hero')) {
    assert.equal(identityFor(entity)?.kit, entity.hero, 'bot appearance follows its combat kit');
  }
  const repeat = assignIdentities(createMatch(identity.kit, 73), identity.id);
  assert.deepEqual(state.units.filter(e => e.kind === 'hero').map(e => e.identity), repeat.units.filter(e => e.kind === 'hero').map(e => e.identity), 'identity assignment is deterministic');
  assert.equal(combatState(state), combatState(baseline), 'assigning appearance leaves all combat data unchanged');
  assert.equal(state.random(), baseline.random(), 'identity assignment does not consume combat randomness');
  assert.equal(trainSkill(p, 0), true);
  assert.equal(trainSkill(player(baseline), 0), true);
  for (let slot = 0; slot < 4; slot++) {
    const move = identitySkill(identity.id, slot);
    assert.equal(move.name, identity.skills[slot]);
    assert.equal(move.cooldown, KITS[identity.kit][slot].cooldown);
    assert.equal(move.icon, KITS[identity.kit][slot].icon);
    assert.ok(move.description && move.tags && move.combo && move.upgrade);
    assert.equal(cooldownFor(p, slot), cooldownFor(player(baseline), slot));
    assert.equal(manaCost(p, slot), manaCost(player(baseline), slot));
    const html = spellbookHTML(p, slot);
    assert.ok(html.includes(`${identity.name} ·`));
    assert.ok(html.includes(`./art/portraits/${identity.slug}-bust.webp`));
    assert.ok(html.includes(`aria-label="Inspect ${move.name}"`));
    assert.ok(html.includes(`<h3>${move.name}</h3>`));
    assert.ok(html.includes(move.description));
    if (slot === 3) assert.ok(html.includes(`Unlocks at level ${rankGate(3, 0)}`));
  }
  assert.ok(spellbookHTML(p, 1).includes(`Learn ${identity.skills[1]} · 1 point`) === false, 'a spent point cannot train another move');
  p.skillPoints = 1;
  assert.ok(spellbookHTML(p, 1).includes(`Learn ${identity.skills[1]} · 1 point`));
  p.skillPoints = 0;
  for (let frame = 0; frame < 160; frame++) {
    const input = { x: frame < 40 ? .7 : 0, y: -.3, attack: true, cast: frame === 50 ? 0 : undefined };
    step(state, input, .05);
    step(baseline, input, .05);
  }
  assert.equal(combatState(state), combatState(baseline), 'display identity preserves movement, casts, damage and bot simulation');
}

assert.equal(identityFor({ hero: 1 }), null);
assert.equal(identityFor({ hero: 0, identity: 0 }), null);
assert.equal(identityFor({ hero: 1, identity: '0' }), null);
assert.throws(() => identitySkill(16, 0), RangeError);
assert.throws(() => identitySkill(0, 4), RangeError);
assert.throws(() => assignIdentities(createMatch(0), 0), RangeError);
assert.match(identitySkill(0, 1).description, /Pull enemies/);
assert.match(identitySkill(0, 2).description, /knock enemies back.*Wet enemies are also stunned/);
assert.match(identitySkill(10, 0).description, /Tap Rift Step again/);

// Optional identity art (the full-length portraits rendered from the 3D models) must not block play when a file fails to load.
const requests = [];
const OriginalImage = globalThis.Image;
globalThis.Image = class {
  width = 120;
  height = 240;
  set src(value) {
    requests.push(value);
    queueMicrotask(() => value.includes('/portraits/') ? this.onerror() : this.onload());
  }
};
let art;
try { art = await loadArt(); }
finally { if (OriginalImage) globalThis.Image = OriginalImage; else delete globalThis.Image; }
assert.equal(requests.filter(path => /\/portraits\/[a-z-]+-full\.webp$/.test(path)).length, 16);
for (const identity of HERO_IDENTITIES) assert.equal(art[`reference-${identity.slug}`], null);
assert.ok(art['nessie-front'] && art['nessie-back'] && art['nessie-attack-back-0']);

// Check the renderer's selected sprite and preserved pose without a browser canvas.
const state = assignIdentities(createMatch(1), 0), p = player(state);
p.attackStarted = 0;
p.attackDuration = .5;
p.attackWindup = .15;
const rendered = [];
const renderer = Object.create(Renderer.prototype);
renderer.art = art;
renderer.ctx = new Proxy({}, { get: () => () => {} });
renderer.scale = 1;
renderer.lastPoses = [];
renderer.project = (x, y) => ({ x, y });
renderer.ring = () => {};
renderer.drawAsset = name => { rendered.push(name); return null; };
renderer.drawUnit(state, p, 0);
assert.match(rendered.at(-1), /^nessie-attack-/);
renderer.art['reference-tidewarden'] = { width: 120, height: 240 };
renderer.drawUnit(state, p, 0);
assert.equal(rendered.at(-1), 'reference-tidewarden');
assert.match(renderer.lastPoses.at(-1).asset, /^nessie-attack-/);
assert.equal(renderer.lastPoses.at(-1).renderAsset, 'reference-tidewarden');
assert.equal(renderer.lastPoses.at(-1).stage, 0);

console.log('PASS: sixteen hero identities, deterministic bot assignment, truthful skill details, spellbook training, unchanged combat simulation, optional art fallback and preserved attack poses.');
