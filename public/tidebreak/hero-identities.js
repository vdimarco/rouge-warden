import { KITS } from './abilities.js';

const profile = (id, name, kit, slug, subtitle, note, tags, filters, color, skills) =>
  Object.freeze({ id, name, kit, slug, subtitle, note, tags: Object.freeze(tags), filters: Object.freeze(filters), color, skills: Object.freeze(skills) });

// Identity controls presentation. The twelve numeric kits retain all combat rules.
export const HERO_IDENTITIES = Object.freeze([
  profile(0, 'Tidewarden', 1, 'tidewarden', 'The Unyielding Deep', 'He stands where the world ends, and the next one begins. The tide obeys, and none escape its call.', ['Tank', 'Initiator', 'Disruptor'], ['Bruiser', 'Initiator'], '#62ddff', ['Tidal Cleave', 'Rising Current', 'Abyssal Grasp', 'Unmovable']),
  profile(1, 'Embersong', 9, 'embersong', 'Voice of the Last Ember', 'Carry living fire into battle. Rise from the last ember.', ['Mage', 'Support', 'Rebirth'], ['Mage', 'Support'], '#ffb365', ['Ember Flight', 'Cinder Chorus', 'Solar Hymn', 'Last Refrain']),
  profile(2, 'Voidcaller', 4, 'voidcaller', 'Beyond the Drowned Stars', 'Seal their escape in shadow. Draw the fight into the void.', ['Mage', 'Controller', 'Disruptor'], ['Mage', 'Initiator'], '#ab80ff', ['Void Veil', 'Dark Latch', 'Abyss Lance', 'Event Horizon']),
  profile(3, 'Stoneheart', 7, 'stoneheart', 'The Mountain Remembers', 'Hold the front line. Break the ground beneath your foes.', ['Tank', 'Initiator', 'Guardian'], ['Bruiser', 'Initiator'], '#c5d4ac', ['Boulder Charge', 'Earthsplitter', 'Mountain Guard', 'Worldbreaker']),
  profile(4, 'Skyreaver', 0, 'skyreaver', 'Hunter Above the Storm', 'Disappear above the battle. Strike from cover.', ['Carry', 'Assassin', 'Scout'], ['Carry'], '#d4e7ff', ['Storm Flight', 'Razor Gale', 'Hunter Mark', 'Storm Eclipse']),
  profile(5, 'Irontide', 7, 'irontide', 'The Living Bulwark', 'Drive through the front line. Shield your allies from the next blow.', ['Tank', 'Initiator', 'Guardian'], ['Bruiser', 'Initiator'], '#a9c5d0', ['Iron Charge', 'Rending Fault', 'Steel Guard', 'Anchorfall']),
  profile(6, 'Moonweaver', 8, 'moonweaver', 'Keeper of Borrowed Souls', 'Silence their spells. Bind a soul to your own.', ['Mage', 'Drain', 'Controller'], ['Mage'], '#d7c8ff', ['Moon Drift', 'Silent Thread', 'Soul Tether', 'Lunar Requiem']),
  profile(7, 'Dredge', 3, 'dredge', 'Hunger Beneath the Harbor', 'Leap into their ranks. Hunt the wounded through the dark.', ['Bruiser', 'Carry', 'Hunter'], ['Bruiser', 'Carry'], '#b8de79', ['Dredge Leap', 'Deep Roar', 'Rending Maw', 'Feeding Frenzy']),
  profile(8, 'Glasshand', 2, 'glasshand', 'The Alchemist of Broken Tides', 'Prepare the trap. Make the battlefield your weapon.', ['Mage', 'Controller', 'Artillery'], ['Mage'], '#e5b270', ['Vault', 'Glass Snare', 'Fire Flask', 'Shatter Ritual']),
  profile(9, 'Salt Priestess', 10, 'salt-priestess', 'Sanctuary of the White Sea', 'Raise a sanctuary. Keep your allies standing.', ['Support', 'Healer', 'Controller'], ['Support'], '#c4e7e8', ['Salt Sentinel', 'Tidal Bind', 'Sea Blessing', 'White Sanctuary']),
  profile(10, 'Riftblade', 6, 'riftblade', 'A Cut Between Worlds', 'Leave a false trail. Return before the enemy can answer.', ['Carry', 'Assassin', 'Trickster'], ['Carry'], '#bca7ff', ['Rift Step', 'Seeking Blades', 'Rift Bind', 'Nine Cuts']),
  profile(11, 'Coral Sage', 10, 'coral-sage', 'Voice of the Living Reef', 'Let the reef hold the ground. Restore your team in its shelter.', ['Support', 'Healer', 'Controller'], ['Support'], '#ffa3ae', ['Reef Sentinel', 'Coral Bind', 'Reef Bloom', 'Living Sanctuary']),
  profile(12, 'Nightcurrent', 11, 'nightcurrent', 'Poison in the Moonlit Sea', 'Poison the approach. Punish enemies who turn to face you.', ['Mage', 'Controller', 'Disruptor'], ['Mage', 'Initiator'], '#9cabe8', ['Dark Cleanse', 'Venom Current', 'Midnight Gaze', 'Petrifying Tide']),
  profile(13, 'The Marrow', 5, 'the-marrow', 'The Winter That Follows', 'Freeze the path behind you. Feed on chilled, wounded prey.', ['Bruiser', 'Carry', 'Hunter'], ['Bruiser', 'Carry'], '#b4cee5', ['Frost Pursuit', 'Cold Snap', 'Marrow Bite', 'Dead Winter']),
  profile(14, 'Bloodwake', 3, 'bloodwake', 'The Red Horizon', 'Open the fight with a leap. Bleed your foes and chase them down.', ['Carry', 'Bruiser', 'Duelist'], ['Carry', 'Bruiser'], '#ff908b', ['Wake Leap', 'War Cry', 'Crimson Cut', 'Blood Frenzy']),
  profile(15, 'Zephyrs', 6, 'zephyrs', 'Where the Wind Returns', 'Slip through the fight. Leave a decoy at your return point.', ['Carry', 'Assassin', 'Trickster'], ['Carry'], '#aeeaff', ['Wind Step', 'Seeking Gusts', 'Gale Bind', 'Nine Winds']),
]);

const baseTags = [
  ['Movement · Cloak', 'Cone · Slow', 'Target · Mark', 'Area · Fear'],
  ['Movement · Heal', 'Pull · Wet', 'Knockback · Combo', 'Area · Heal'],
  ['Movement · Shield', 'Trap · Root', 'Area · Fire', 'Area · Stun'],
  ['Movement · Stun', 'Area · Fear', 'Cone · Bleed', 'Frenzy · Life steal'],
];
const baseCombos = [
  ['Fly into cover before using Death omen.', 'Aim the fan across a group.', 'Your next basic attack consumes the mark.', 'Use Death omen while concealed.'],
  ['Leave a wet trail to prepare Tailbreaker.', 'Pull enemies close, then sweep them away.', 'Wet enemies are stunned as they are knocked back.', 'Keep your allies inside the healing whirlpool.'],
  ['Jump beside a prepared Hex snare.', 'Root a target before firing the mortar.', 'Rooted enemies take 60% extra fire damage.', 'Hold a group inside the expanding shockwaves.'],
  ['Land close enough to use Rending claws.', 'Bleeding enemies flee for longer.', 'Bleed a target, then use Hell shriek.', 'Attack during the frenzy to recover health.'],
];
const baseUpgrades = [
  ['Longer flight and cloak.', 'Stronger damage and a longer slow.', 'Stronger marked hit.', 'Stronger fear pulse.'],
  ['Longer dive and stronger healing.', 'Stronger pull damage.', 'Stronger damage and a longer stun.', 'Stronger whirlpool damage and team healing.'],
  ['Longer hop and stronger shield.', 'Stronger trap damage.', 'Stronger fire damage.', 'Stronger shockwaves.'],
  ['Longer leap and stronger impact.', 'Stronger shriek damage.', 'Stronger slash and bleeding.', 'Longer frenzy and stronger shield.'],
];

const descriptionOverrides = {
  0: [
    'Surge forward, heal and leave a slowing wake that makes enemies wet.',
    'Pull enemies in a cone toward you and make them wet. Follow with Abyssal Grasp.',
    'Sweep forward and knock enemies back. Wet enemies are also stunned.',
    'Create a huge whirlpool that steadily pulls and damages enemies while healing allies.',
  ],
  8: [
    'Vault over obstacles and gain a shield. Land beside your prepared traps.',
    'Plant a hidden root trap ahead. It arms after half a second and catches nearby enemies.',
    'Lob a fire flask to an aimed spot. After a short warning it erupts into lingering fire. Rooted enemies take extra damage.',
    'Strike the ground three times. Each shockwave expands farther, damages enemies and stuns them.',
  ],
  12: ['Remove slows, burns, poison, bleeding and healing wounds. Gain a shield and reduce incoming damage by 35% for three seconds.'],
};

const getProfile = id => {
  if (!Number.isInteger(id) || !HERO_IDENTITIES[id]) throw new RangeError(`Unknown hero identity: ${id}`);
  return HERO_IDENTITIES[id];
};
const renameSkills = (text, identity) => {
  if (!text) return text;
  return KITS[identity.kit].reduce((copy, move, slot) => copy.replace(new RegExp(move.name, 'gi'), identity.skills[slot]).replace(new RegExp(`\\b${move.label}\\b`, 'g'), identity.skills[slot]), text);
};

export function identityFor(entity) {
  const identity = Number.isInteger(entity?.identity) ? HERO_IDENTITIES[entity.identity] : null;
  return identity && identity.kit === entity.hero ? identity : null;
}

export function identitySkill(identityId, slot) {
  const identity = getProfile(identityId);
  if (!Number.isInteger(slot) || slot < 0 || slot > 3) throw new RangeError(`Unknown skill slot: ${slot}`);
  const move = KITS[identity.kit][slot];
  return {
    ...move,
    name: identity.skills[slot],
    label: identity.skills[slot].toUpperCase(),
    description: descriptionOverrides[identity.id]?.[slot] || renameSkills(move.description, identity),
    tags: move.tags || baseTags[identity.kit][slot],
    combo: renameSkills(move.combo || baseCombos[identity.kit][slot], identity),
    upgrade: renameSkills(move.upgrade || baseUpgrades[identity.kit][slot], identity),
  };
}

export const selectionSkill = identitySkill;

export function assignIdentities(state, selectedIdentity) {
  const selected = getProfile(selectedIdentity);
  const controlled = state.units.find(entity => entity.id === state.playerId);
  if (!controlled || controlled.hero !== selected.kit) throw new RangeError('Selected identity does not match the player combat kit.');
  for (const entity of state.units) {
    if (entity.kind !== 'hero') continue;
    const choices = HERO_IDENTITIES.filter(identity => identity.kit === entity.hero);
    const index = ((state.seed + entity.id + entity.team * 7) % choices.length + choices.length) % choices.length;
    const identity = entity.id === state.playerId ? selected : choices[index];
    entity.identity = identity.id;
    entity.name = identity.name;
  }
  return state;
}
