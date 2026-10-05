// Bot teammates talk like players: short lines from pings, kills and objectives.
import { PATHS, distance, closestTrack } from './world.js';
import { HANDLES } from './draft.js';
import { HERO_IDENTITIES } from './hero-identities.js';

// The nearest lane names a place; the lanes curve, so map fractions would mislabel the middle lane.
const LANE_LABELS = ['West', 'Middle', 'East'];
export const laneAt = p => LANE_LABELS[PATHS.map(path => distance(p, path[closestTrack(p, path)])).reduce((best, d, i, all) => d < all[best] ? i : best, 0)];
const pick = (list, n) => list[Math.abs(Math.floor(n)) % list.length];

// Returns [{ unitId, text, all? }] for a new fact. `bots` are allied bot heroes; `player` is the human hero.
export function chatFor(fact, s, { player, bots, handleOf }) {
  const unit = id => s.units.find(u => u.id === id), seed = (fact.id || 0) * 7 + Math.floor(fact.time || 0);
  const nearestBot = point => bots.filter(b => b.hp > 0).sort((a, b) => distance(a, point) - distance(b, point))[0];
  if (fact.kind === 'ping') {
    const source = unit(fact.source), lane = laneAt(fact);
    if (fact.team !== 0) return [];
    if (fact.type === 'onmyway' && source && !source.player) return [{ unitId: source.id, text: fact.call === 'rally' ? pick(['Coming!', 'On it.', 'Right behind you.'], seed) : pick([`On my way ${lane}!`, `Rotating ${lane}, hold on.`, `Coming to help ${lane}.`], seed) }];
    if (fact.type === 'retreat' && source && !source.player) return [{ unitId: source.id, text: pick(['Low, backing off.', 'Need to heal. Back soon.', 'Resetting. Back in a moment.'], seed) }];
    if (fact.type === 'fight' && source && !source.player) {
      const foe = s.units.filter(u => u.kind === 'hero' && u.team === 1 && u.hp > 0).sort((a, b) => distance(a, source) - distance(b, source))[0];
      return [{ unitId: source.id, text: pick([`Fighting ${foe?.name || 'them'} ${lane}!`, `${foe?.name || 'Enemy'} on me, ${lane}!`, `Help ${lane}!`], seed) }];
    }
    if (fact.type === 'defend') { const bot = nearestBot(fact); return bot ? [{ unitId: bot.id, text: pick([`${lane} ward is under attack. I'll go.`, `They're hitting our ${lane} ward!`], seed) }] : []; }
    return [];
  }
  if (fact.kind === 'kill') {
    const killer = unit(fact.killer), victim = unit(fact.victim), lines = [];
    if (fact.killerTeam === 0 && killer && !killer.player && killer.kind === 'hero') lines.push({ unitId: killer.id, text: pick([`Got ${victim?.name}.`, `${victim?.name} down!`, 'Ha, got one.'], seed) });
    else if (killer?.player) { const bot = pick(bots, seed); if (bot) lines.push({ unitId: bot.id, text: fact.multi >= 2 ? pick(['WOW. Carry us!', 'Unreal.', 'Are you even human?'], seed) : pick(['Nice one!', 'Clean.', 'Big play.', 'gj'], seed) }); }
    const foe = killer?.kind === 'hero' ? killer.name : null;
    if (victim && victim.team === 0 && !victim.player && victim.kind === 'hero') lines.push({ unitId: victim.id, text: foe ? pick([`They got me. Careful, ${foe} is ${laneAt(victim)}.`, 'Sorry, got caught.', `${foe} is strong, group up.`], seed) : pick(['Dove too deep. My bad.', 'Their ward got me. Careful.'], seed) });
    if (victim?.player) {
      const bot = pick(bots, seed + 1); if (bot) lines.push({ unitId: bot.id, text: pick([`Hang on, I'll hold ${laneAt(victim)}.`, 'Unlucky. Regroup with me.', foe ? `Watch out for ${foe}.` : 'Stay out of their ward range.'], seed) });
      // Now and then the other shore talks back in all chat.
      if (killer?.team === 1 && seed % 3 === 0) lines.push({ unitId: killer.id, all: true, text: pick(['too slow', 'the tide takes all', 'ez', 'come back for more'], seed) });
    }
    return lines;
  }
  if (fact.kind === 'message') {
    const bot = pick(bots, seed);
    const lines = { 'The Wild Hunt awakens': 'Hunt is up. Group at the ford?', 'Enemy ward broken': 'Ward down! Push on.', 'Our ward has fallen': 'We lost a ward. Careful.', 'Enemy guardian down': 'Guardian down! Hit the rift.', 'Our guardian has fallen': 'They broke a guardian. Back to base!', 'Sudden death': 'Sudden death. All in!', 'The Wild Hunt rides with us': 'The Hunt is ours. Push with it!', 'Enemy claimed the Wild Hunt': 'They have the Hunt. Defend!', 'Legends never die': 'gg wp', 'Lost to the veil': 'gg. Next one is ours.' };
    return bot && lines[fact.title] ? [{ unitId: bot.id, text: lines[fact.title] }] : [];
  }
  if (fact.kind === 'start') return bots.slice(0, 2).map((b, i) => ({ unitId: b.id, text: i ? 'glhf' : pick(['Let’s go! Call if you need me.', 'Ready. Ping and I come.', 'Good luck all.'], seed) }));
  return [];
}

export class TeamChat {
  constructor(sound, hud) {
    this.sound = sound;
    this.el = Object.assign(document.createElement('ol'), { id: 'team-chat' }); this.el.setAttribute('aria-label', 'Team chat'); this.el.setAttribute('aria-live', 'polite');
    hud.append(this.el);
  }
  reset(state, plan) {
    this.state = state; this.kills = 0; this.pings = 0; this.queue = []; this.nextAt = 0; this.messageKey = state.messages.length ? `${state.messages.at(-1).time}:${state.messages.at(-1).title}` : '';
    const heroes = state.units.filter(u => u.kind === 'hero');
    this.handles = new Map(heroes.map((h, i) => [h.id, plan?.handles?.[i] || HANDLES[(i * 5 + state.seed) % HANDLES.length]]));
    this.el.replaceChildren();
    this.push(chatFor({ kind: 'start', time: 0, id: state.seed }, state, this.context(state)), state);
  }
  context(s) { const player = s.units.find(u => u.player); return { player, bots: s.units.filter(u => u.kind === 'hero' && u.team === 0 && !u.player), handleOf: id => this.handles.get(id) }; }
  push(lines, s) { for (const line of lines) this.queue.push({ ...line, at: s.time }); if (this.queue.length > 3) this.queue.splice(0, this.queue.length - 3); }
  show(line, s) {
    const unit = s.units.find(u => u.id === line.unitId); if (!unit) return;
    const li = document.createElement('li'), who = document.createElement('b'), text = document.createElement('span');
    li.className = line.all ? 'all' : 'team'; li.dataset.time = s.time;
    who.textContent = `${line.all ? '[All] ' : ''}${this.handles.get(unit.id) || unit.name} (${unit.name}):`; who.style.color = line.all ? '#ff9f8c' : '';
    text.textContent = ` ${line.text}`;
    // The speaker's portrait leads the line, so a glance shows who is talking.
    const slug = HERO_IDENTITIES[unit.identity]?.slug, words = document.createElement('span');
    words.append(who, text); if (slug) li.append(Object.assign(document.createElement('img'), { src: `./art/portraits/${slug}-bust.webp`, alt: '' })); li.append(words);
    this.el.append(li); while (this.el.children.length > 4) this.el.firstChild.remove();
    this.sound.chat();
  }
  update(s) {
    if (s !== this.state) this.reset(s);
    const ctx = this.context(s);
    for (const entry of (s.killFeed || []).filter(e => e.id > this.kills)) { this.kills = entry.id; this.push(chatFor({ ...entry, kind: 'kill' }, s, ctx), s); }
    for (const ping of (s.pings || []).filter(p => p.id > this.pings)) { this.pings = ping.id; this.push(chatFor({ ...ping, kind: 'ping' }, s, ctx), s); }
    const fresh = []; for (let i = s.messages.length - 1; i >= 0; i--) { const m = s.messages[i]; if (`${m.time}:${m.title}` === this.messageKey) break; fresh.unshift(m); }
    if (fresh.length) this.messageKey = `${fresh.at(-1).time}:${fresh.at(-1).title}`;
    for (const m of fresh) this.push(chatFor({ kind: 'message', title: m.title, time: m.time, id: Math.round(m.time * 10) }, s, ctx), s);
    // Lines arrive one at a time, like people typing; stale lines are dropped.
    this.queue = this.queue.filter(l => s.time - l.at < 6);
    if (this.queue.length && s.time >= this.nextAt) { this.show(this.queue.shift(), s); this.nextAt = s.time + 1.6; }
    for (const li of [...this.el.children]) if (s.time - +li.dataset.time > 10) li.remove();
  }
}
