// Turns recorded match facts into announcer calls, banners, a kill feed and spatial battle sound.
import { HERO_IDENTITIES } from './hero-identities.js';
import { LANE_NAMES } from './objectives.js';
import { insideWarning } from './combat-rules.js';

// Names follow the recorded announcer lines in audio/announcer.
const MULTI = [null, null, 'Double kill', 'Triple kill', 'Mayhem', 'Rampage'];
const STREAK = { 3: 'Killing spree', 4: 'Dominating', 5: 'Mega kill', 6: 'Ownage', 7: 'Massacre', 8: 'Carnage', 9: 'Godlike' };
export const streakName = n => n >= 9 ? 'Godlike' : STREAK[n] || null;
export const multiName = n => n >= 2 ? MULTI[Math.min(5, n)] : null;
export const clipFor = title => title ? title.toLowerCase().replace(/\s+/g, '-') : null;
export const heroColor = unit => HERO_IDENTITIES[unit?.identity]?.color || (unit?.team ? '#ff917c' : '#abf8b2');
const unitName = (s, id) => s.units.find(u => u.id === id)?.name || 'A ward';

// One call per kill. Big calls get a banner and voice; ordinary kills only reach the feed.
export function killCall(entry, s, playerId) {
  const killer = s.units.find(u => u.id === entry.killer), victim = s.units.find(u => u.id === entry.victim);
  const ours = entry.killerTeam === 0, detail = `${killer?.name || 'The wards'} banished ${victim?.name || 'a hero'}`;
  const byPlayer = killer?.id === playerId;
  if (entry.firstBlood) return { title: 'First blood', voice: 'First blood!', clip: 'first-blood', kind: 'first-blood', big: true, ours, detail };
  if (entry.teamWipe) return { title: ours ? 'Wiped them out' : 'Our team has fallen', voice: ours ? 'Team wipe! They are all banished.' : 'Your team has fallen.', kind: 'wipe', big: true, ours, detail };
  const multi = multiName(entry.multi), streak = streakName(entry.streak);
  if (multi) return { title: multi, voice: `${multi}!`, clip: clipFor(multi), kind: 'multi', level: entry.multi, big: true, ours, detail: byPlayer ? 'You' : killer?.name };
  if (entry.shutdown) return { title: 'Shut down', voice: 'Shut down!', kind: 'shutdown', big: true, ours, detail: `${victim?.name}'s ${entry.shutdown}-kill streak ends` };
  if (streak) return { title: streak, voice: `${streak}!`, clip: clipFor(streak), kind: 'streak', level: Math.min(8, entry.streak - 1), big: true, ours, detail: byPlayer ? 'You' : killer?.name };
  if (victim?.id === playerId) return { title: 'You were banished', voice: 'You have been banished.', kind: 'ally-down', big: false, ours, detail };
  if (byPlayer) return { title: 'Enemy banished', voice: 'Enemy banished.', kind: 'enemy-down', big: false, ours, detail };
  return { title: ours ? `${victim?.name} banished` : `${victim?.name} has fallen`, voice: null, kind: ours ? 'enemy-down' : 'ally-down', big: false, ours, detail };
}

export function defendCall(ping) {
  if (ping.structure === 'core') return { title: 'Our rift is under attack', voice: 'Your elder rift is under attack!' };
  const where = `${LANE_NAMES[ping.lane] || ''} ${ping.tier ? 'inner' : 'outer'} ward`.trim();
  return { title: `${where} under attack`, voice: `Your ${where} is under attack.` };
}

const MESSAGE_CALLS = {
  'Enemy ward broken': { voice: 'Enemy ward destroyed.', kind: 'ward-break', banner: true },
  'Our ward has fallen': { voice: 'Our ward has fallen.', kind: 'ward-fall', banner: true },
  'The Wild Hunt awakens': { voice: 'The Wild Hunt awakens.', sound: 'roar', banner: true },
  'The Wild Hunt rides with us': { voice: 'The Wild Hunt rides with us.', kind: 'ward-break', banner: true },
  'Enemy claimed the Wild Hunt': { voice: 'The enemy has claimed the Wild Hunt.', kind: 'ward-fall', banner: true },
  'The woods swallow the town': { voice: 'The woods awaken.', sound: 'realm1' },
  'The town returns': { sound: 'realm0' },
  'Legends never die': { voice: 'Victory.', clip: 'you-win', sound: 'victory' },
  'Lost to the veil': { voice: 'Defeat.', clip: 'you-lose', sound: 'defeat' },
  'A legend returns': { sound: 'respawn' },
  'Through the looking glass': { sound: 'portal' },
  'Spirit feast': { sound: 'coin' },
};

export class Announcer {
  constructor(sound, hud) {
    this.sound = sound;
    this.callout = Object.assign(document.createElement('div'), { id: 'callout', role: 'status' }); this.callout.setAttribute('aria-live', 'assertive');
    this.feed = Object.assign(document.createElement('ol'), { id: 'kill-feed' }); this.feed.setAttribute('aria-label', 'Kill feed');
    hud.append(this.callout, this.feed);
  }
  reset(state) {
    this.state = state; this.kills = 0; this.pings = 0; this.messageKey = ''; this.prev = new Map(); this.voiceAt = -99; this.defendAt = -99;
    this.feed.replaceChildren(); this.callout.className = ''; this.callout.replaceChildren();
    for (const m of state.messages) this.messageKey = `${m.time}:${m.title}`;
  }
  banner(title, detail = '', tone = 'ally', kind = '') {
    const b = document.createElement('b'), small = document.createElement('small'); b.textContent = title; small.textContent = detail;
    this.callout.replaceChildren(b, small); this.callout.className = `show ${tone} ${kind}`;
    clearTimeout(this.calloutTimer); this.calloutTimer = setTimeout(() => { this.callout.className = ''; }, 2900);
  }
  feedEntry(s, entry) {
    const li = document.createElement('li'), killer = s.units.find(u => u.id === entry.killer), victim = s.units.find(u => u.id === entry.victim);
    li.className = entry.killerTeam === 0 ? 'ally' : 'enemy'; li.dataset.time = s.time;
    const name = (unit, fallback) => { const b = document.createElement('b'); b.textContent = unit?.name || fallback; b.style.color = unit?.kind === 'hero' ? heroColor(unit) : ''; return b; };
    const blade = document.createElement('span'); blade.textContent = '⚔'; blade.setAttribute('aria-label', 'banished');
    // Hero portraits sit beside the names, as in the team lineup at the top of the screen.
    const face = unit => { const slug = unit?.kind === 'hero' && HERO_IDENTITIES[unit.identity]?.slug; return slug ? [Object.assign(document.createElement('img'), { src: `./art/portraits/${slug}-bust.webp`, alt: '' })] : []; };
    li.append(...face(killer), name(killer, 'Ward'), blade, ...face(victim), name(victim, 'Hero'));
    if (entry.multi >= 2 || entry.streak >= 3) { const tag = document.createElement('em'); tag.textContent = multiName(entry.multi) || streakName(entry.streak); li.append(tag); }
    this.feed.append(li); while (this.feed.children.length > 4) this.feed.firstChild.remove();
  }
  speak(call, s, priority = 1) {
    if (!call.voice) return;
    // Calls closer than 1.6 s replace one another, so the voice keeps up with the fight.
    this.sound.announce(call.voice, call.kind, { level: call.level || 2, clip: call.clip, priority: s.time - this.voiceAt < 1.6 ? 2 : priority }); this.voiceAt = s.time;
  }
  update(s, { playerId, visible }) {
    if (s !== this.state) this.reset(s);
    const sound = this.sound;
    for (const li of [...this.feed.children]) if (s.time - +li.dataset.time > 9) li.remove();
    // Kills.
    const feed = s.killFeed || [];
    for (const entry of feed.filter(e => e.id > this.kills)) {
      this.kills = entry.id; this.feedEntry(s, entry);
      const call = killCall(entry, s, playerId);
      if (call.big) { this.banner(call.title, call.detail, call.ours ? 'ally' : 'enemy', call.kind); this.speak(call, s, 2); }
      else if (call.voice) { sound.stinger(call.kind); sound.say(call.voice); }
      else sound.stinger(call.kind);
    }
    // Team pings.
    for (const ping of (s.pings || []).filter(p => p.id > this.pings)) {
      this.pings = ping.id;
      if (ping.team !== 0) continue;
      if (ping.type === 'defend' && s.time - this.defendAt > 8) {
        this.defendAt = s.time; const call = defendCall(ping);
        this.banner(call.title, 'Defend it or lose it', 'enemy', 'defend'); sound.alarm(false); setTimeout(() => sound.say(call.voice), 700);
      } else if (ping.type !== 'defend') sound.ping(ping.type, ping.x, ping.y);
    }
    // Match messages.
    const fresh = []; for (let i = s.messages.length - 1; i >= 0; i--) { const m = s.messages[i]; if (`${m.time}:${m.title}` === this.messageKey) break; fresh.unshift(m); }
    if (fresh.length) this.messageKey = `${fresh.at(-1).time}:${fresh.at(-1).title}`;
    for (const m of fresh) {
      if (/^Level \d+/.test(m.title)) { sound.levelUp(); continue; }
      const call = MESSAGE_CALLS[m.title]; if (!call) continue;
      if (call.banner) this.banner(m.title, m.detail, /Enemy claimed|fallen/.test(m.title) ? 'enemy' : 'ally', 'objective');
      if (call.kind) sound.stinger(call.kind);
      if (call.sound === 'roar') sound.roar(); else if (call.sound === 'realm1') sound.realmShift(1); else if (call.sound === 'realm0') sound.realmShift(0); else if (call.sound) sound[call.sound]();
      if (call.clip) sound.line(call.clip, call.voice, .5);
      else if (call.voice) setTimeout(() => sound.say(call.voice), call.sound === 'roar' ? 900 : 300);
    }
    // Spatial battle sound for units other than the player.
    let threat = 0, clash = null;
    const player = s.units.find(u => u.id === playerId);
    for (const u of s.units) {
      const before = this.prev.get(u.id), seen = u.team === 0 || visible?.has(u.id);
      const intent = u.castIntent || u.specialIntent;
      this.prev.set(u.id, { hp: u.hp, hit: u.lastBasicHit, cast: u.castStarted, attack: u.attackStarted, intent: intent?.start, lock: u.lockStart });
      if (!before || u.id === playerId) continue;
      if (before.hp > 0 && u.hp <= 0) { if (u.kind === 'minion') sound.minionPop(u.x, u.y); else if (u.kind === 'hero') sound.death(u.x, u.y, u.team === 0); continue; }
      if (u.hp <= 0 || !seen) continue;
      // Tells: a swell when an enemy or neutral windup starts, beeps when a tower locks on to you.
      if (intent && u.team !== 0 && intent.start !== before.intent) sound.windup(u.x, u.y, { ult: intent.slot === 3, neutral: !!u.specialIntent, aimed: !!player && player.hp > 0 && insideWarning(player, intent.shape, 25), duration: intent.at - intent.start });
      if (u.lockTarget === playerId && u.lockStart !== before.lock && s.time < u.lockAt) sound.lockOn(u.x, u.y);
      if (u.kind === 'hero') {
        if (u.lastBasicHit !== before.hit && sound.throttle(`hit${u.id}`, .06)) sound.worldHit(u.x, u.y, u.lastBasicVariant === 2);
        if (u.castStarted !== before.cast && Number.isFinite(u.castStarted)) sound.worldCast(u.x, u.y, u.castSlot === 3);
        if (u.skirmishUntil > s.time && sound.spatial(u.x, u.y).far) clash ||= u;
        if (u.team !== 0 && player && player.hp > 0 && Math.hypot(u.x - player.x, u.y - player.y) < 900) threat += .45;
      } else if ((u.kind === 'tower' || u.kind === 'core') && u.attackStarted !== before.attack && Number.isFinite(u.attackStarted)) sound.towerShot(u.x, u.y);
    }
    if (clash && sound.throttle('clash', .85)) sound.distantClash(clash.x, clash.y);
    sound.setIntensity(threat + (player?.skirmishUntil > s.time ? .3 : 0));
  }
}
