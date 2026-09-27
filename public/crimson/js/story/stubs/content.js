// Stub CONTENT (frozen; the content package replaces content/content.js, not this file).
// Enough story to play end to end on the stubs: c0 'THE BEAR YIELDS' in the arena, i0 under the bridge
// (the world swap), f1 (get in the van and drive it to the A-frame), and e1 with the credits.
import { CREW_IDS } from '../types.js';

const CHAPTERS = {
  c0: { id: 'c0', n: 1, title: 'The Bear Yields', kanji: '熊', act: 0, pov: 'pick', when: { day: 'sun', time: '3:02' }, look: 'ARENA', arena: true, missions: ['c0'] },
  i0: { id: 'i0', n: 2, title: 'Under the Bridge', kanji: '橋', act: 0, pov: 'pick', when: { day: 'sun', time: '3:12' }, look: 'NIGHT', start: 'wash', missions: ['i0'] },
  f1: { id: 'f1', n: 3, title: 'Ten Seats', kanji: '十', act: 1, pov: 3, when: { day: 'thu', time: '14:10' }, look: 'MEMORY', start: 'f1_hero', missions: ['f1'] },
  e1: { id: 'e1', n: 20, title: 'The First', kanji: '完', act: 4, pov: 'pick', when: { day: 'sat', time: '18:10' }, look: 'DAY', start: 'e1_meadow', missions: ['e1'] },
};
const MISSIONS = {
  c0: { id: 'c0', chapter: 'c0', steps: [{ type: 'cine', id: 'c0' }] },
  i0: { id: 'i0', chapter: 'i0', spawns: [{ id: 'gabe', cast: 'gabe', place: 'wash' }], steps: [{ type: 'cine', id: 'i0' }] },
  f1: {
    id: 'f1', chapter: 'f1', fail: { vanWrecked: true },
    spawns: [{ id: 'van', kind: 'van', place: 'f1_van', player: true }],
    steps: [
      { type: 'card', kind: 'chapter', title: 'TEN SEATS', sub: 'THURSDAY · 2:10 PM', kanji: '十', dur: 2.5 },
      { type: 'enter', vehicle: 'van', objective: 'Get in the van.', cp: true },
      { type: 'talk', lines: ['f1.seats', 'f1.whale'] },
      { type: 'drive', to: 'aframe', r: 14, objective: 'Drive to the A-frame.' },
      { type: 'exit', objective: 'Stop and get out.' },
    ],
    onPass: { save: true },
  },
  e1: {
    id: 'e1', chapter: 'e1',
    steps: [
      { type: 'card', kind: 'time', title: 'ONE MONTH LATER. THE FIRST.', dur: 2.5 },
      { type: 'script', fn: 'credits' },
    ],
  },
};
const LINES = {
  'f1.seats': { who: 'fifty', text: 'Fifteen-passenger van. We took the back seats out. It seats ten.' },
  'f1.whale': { who: 'tanktop', text: "It's a whale." },
};
const CINES = {
  c0: { id: 'c0', arena: true, look: 'ARENA', dur: 1.5, cards: [{ at: 0, kind: 'title', title: 'THE BEAR YIELDS', kanji: '熊' }] },
  i0: { id: 'i0', look: 'NIGHT', dur: 1.5, cards: [{ at: 0, kind: 'time', title: 'SUNDAY · 3:12 AM', sub: 'UNDER MIDGLEY BRIDGE' }] },
};
const CREDITS = {
  result: { kanji: '完', title: 'THE BEST MAN' },
  blocks: [
    '<h3>THE CREW</h3><p class="line"><b>Tank Top · Fifty-One · Shades · New Balance · Red Jersey</b></p><p class="line"><span>AND</span><b>Gabe, the best man</b></p>',
    '<p class="line"><span>SET IN</span><b>Sedona, Arizona</b><small>The places are real. The people and businesses are invented.</small></p>',
    '<h3>IF YOU SEE SIGNS OF TRAFFICKING</h3><p class="line"><b>Do not step in yourself.</b><small>Call 1-888-373-7888. Text HELP to 233733. Outside the US, call your local police.</small></p>',
  ],
  note: 'No bears were harmed. Gabe is fine. Gabe is the best man.',
  againLabel: '▶ KEEP PLAYING',
};
const SCRIPTS = {
  // the credits roll on story time; KEEP PLAYING goes on to free roam, ARCADE leaves the page
  *credits(m) {
    const S = m.S, C = S.content.CREDITS;
    let again = false;
    S.mode = 'credits';
    const roll = S.ctx.rollCredits({ crew: S.ctx.CREW, pick: S.ctx.crewPick, touch: document.body.classList.contains('touch'), result: C.result, blocks: C.blocks, note: C.note, againLabel: C.againLabel, now: () => S.time * 1000, onAgain: () => { again = true; } });
    S.test.credits = roll;
    try {
      while (!again) {
        if (S.input.pressed('skip') || S.input.pressed('use') || S.input.pressed('pause')) { if (roll.atEnd) again = true; else roll.skip(); }
        yield null;
      }
    } finally { roll.stop(); S.test.credits = null; S.mode = 'play'; }
  },
};

export function init(S) {
  S.content = {
    CHAPTERS, MISSIONS, LINES, CINES, SCRIPTS, CREDITS,
    line(id, vars = {}) {
      const L = LINES[id]; if (!L) return String(id);
      const pick = S.ctx.CREW[S.ctx.crewPick] || { name: '' };
      return String(typeof L === 'string' ? L : L.text).replace(/\{PICK\}/g, vars.PICK || pick.name);
    },
    crew: CREW_IDS,
  };
}
