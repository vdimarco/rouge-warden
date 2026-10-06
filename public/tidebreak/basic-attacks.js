export const BASIC_ATTACKS = [
  ['Talon rake', 'Wing sweep', 'Moon cleave'],
  ['Quick bite', 'Tail sweep', 'Loch crush'],
  ['Hex spark', 'Ember spiral', 'Witchfire burst'],
  ['Claw swipe', 'Horn thrust', 'Devil rend'],
  ['Tentacle tap','Brine lash','Abyss crush'],
  ['Ice claw','Antler rake','Hunger cleave'],
  ['Spirit spark','Tail flick','Foxfire burst'],
  ['Stone fist','Boulder swing','Granite smash'],
  ['Soul spark','Sorrow lash','Phantom cry'],
  ['Ember peck','Wing flame','Solar flare'],
  ['Thorn dart','Vine whip','Grove spike'],
  ['Venom dart','Serpent lash','Stone shard'],
  ['Chain swing','Anchor hook','Iron crash'],
  ['Red cut','Crimson thrust','Blood reave'],
  ['Wind dart','Gale slice','Squall burst'],
  ['Coral dart','Reef lash','Tidal bloom'],
];
export const ATTACK_TIMINGS = [
  { windup: .12, duration: .46, damage: 1 },
  { windup: .14, duration: .48, damage: .85 },
  { windup: .18, duration: .54, damage: 1.15 },
];

// Cadence and three-hit damage stay unchanged. The contact rhythm carries identity.
const RHYTHMS = [
 [.09,.12,.19], [.16,.2,.28], [.18,.22,.3], [.08,.11,.17],
 [.19,.24,.3], [.13,.17,.25], [.08,.1,.15], [.2,.27,.36],
 [.17,.21,.27], [.14,.18,.25], [.16,.2,.26], [.12,.16,.23],
 [.19,.25,.34], [.07,.1,.16], [.09,.12,.18], [.15,.19,.26],
];
export function attackTiming(e,variant=0,time=0) {
 const base=ATTACK_TIMINGS[variant],cadence=e.rate*(e.frenzy>time?.48:1);
 const windup=Math.min(RHYTHMS[e.hero]?.[variant]||base.windup,Math.max(.04,cadence*.55));
 return {...base,windup,duration:Math.max(windup+.14,Math.min(cadence,windup+.34))};
}
