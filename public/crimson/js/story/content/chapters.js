// js/story/content/chapters.js : the chapters in CHAPTER_ORDER (types.js), as ChapterDefs.
// n is the number the title's CONTINUE shows ("CHAPTER 3 · TEN SEATS"); an interlude under the bridge
// keeps the number of the flashback before it. pov is a crew index (the flashback's narrator) or 'pick'.
// act: 0 the cold open, 1 the flashbacks, 2-4 the present (acts I-III), 5 the epilogue. drain is Gabe's
// neon drain for the chapter (B10): 0 keeps his neon (flashbacks at night), 1 drains it (the present).
// crew: who of the five is with the hero on foot (followers) in this chapter; content/scripts.js walks them.
// cine: the cold open and the interludes name their cine; the chapter's one mission plays it as its only
// step, so the engine does not play it again. Extra fields (sub, stamp, crew) are read by content scripts.
import { CHAPTER_ORDER } from '../types.js';

// crew indices: 0 Tank Top, 1 Fifty-One, 2 Shades, 3 New Balance, 4 Red Jersey
const C = (id, n, title, kanji, act, pov, day, time, look, o = {}) => ({ id, n, title, kanji, act, pov, when: { day, time }, look, missions: [id], ...o });

export const CHAPTERS = {
  c0: C('c0', 1, 'The Bear Yields', '熊', 0, 'pick', 'sun', '3:02', 'ARENA', { cine: 'c0', arena: true, drain: 0, sub: 'SUNDAY · 3:02 AM' }),
  i0: C('i0', 2, 'Under the Bridge', '橋', 0, 'pick', 'sun', '3:12', 'NIGHT', { cine: 'i0', start: 'wash', drain: 1, sub: 'SUNDAY · 3:12 AM' }),
  f1: C('f1', 3, 'Ten Seats', '十', 1, 3, 'thu', '14:10', 'MEMORY', { start: 'f1_hero', drain: 1, sub: 'THURSDAY · 2:10 PM', stamp: '▶ THU 2:10 PM', crew: ['fifty', 'tanktop', 'shades', 'redjersey'] }),
  i1: C('i1', 3, 'Under the Bridge', '橋', 1, 'pick', 'sun', '3:14', 'NIGHT', { cine: 'i1', start: 'wash', drain: 1 }),
  f2: C('f2', 4, 'The Jeep Tour', '車', 1, 4, 'fri', '9:30', 'MEMORY', { start: 'f2_jeep', drain: 1, sub: 'FRIDAY · 9:30 AM', stamp: '▶ FRI 9:30 AM', crew: ['fifty', 'shades'] }),
  i2: C('i2', 4, 'Under the Bridge', '橋', 1, 'pick', 'sun', '3:18', 'NIGHT', { cine: 'i2', start: 'wash', drain: 1 }),
  f3: C('f3', 5, 'Ronin Night Out', '侍', 1, 0, 'fri', '22:40', 'MEMORY_NIGHT', { start: 'aframe', drain: 1, sub: 'FRIDAY · 10:40 PM', stamp: '▶ FRI 10:40 PM', crew: ['fifty', 'shades', 'newbalance', 'redjersey'] }),
  i3: C('i3', 5, 'Under the Bridge', '橋', 1, 'pick', 'sun', '3:22', 'NIGHT', { cine: 'i3', start: 'wash', drain: 1 }),
  f4: C('f4', 6, 'The Morning After', '酔', 1, 1, 'sat', '8:15', 'HANGOVER', { start: 'creek_bridge', drain: 1, sub: 'SATURDAY · 8:15 AM', stamp: '▶ SAT 8:15 AM', crew: ['tanktop', 'shades', 'newbalance'] }),
  i4: C('i4', 6, 'Under the Bridge', '橋', 1, 'pick', 'sun', '3:26', 'NIGHT', { cine: 'i4', start: 'wash', drain: 1 }),
  f5: C('f5', 7, 'Ronin Night', '夜', 1, 2, 'sat', '16:30', 'MEMORY', { start: 'bar_lot', drain: 0, sub: 'SATURDAY · 4:30 PM', stamp: '▶ SAT 4:30 PM', crew: ['tanktop', 'fifty', 'newbalance', 'redjersey'] }),
  i5: C('i5', 7, 'Under the Bridge', '橋', 1, 'pick', 'sun', '3:30', 'NIGHT', { cine: 'i5', start: 'wash', drain: 1 }),
  p1: C('p1', 8, 'Dawn Patrol', '暁', 2, 'pick', 'sun', '5:40', 'NIGHT', { start: 'midgley_lot', drain: 1, sub: 'SUNDAY · 5:40 AM' }),
  p2: C('p2', 9, 'Pie and Photos', '法', 2, 'pick', 'sun', '11:00', 'DAY', { start: 'airstream', drain: 1, sub: 'SUNDAY · 11:00 AM', crew: ['fifty', 'shades'] }),
  p3: C('p3', 10, 'Sunline', '顔', 2, 'pick', 'sun', '14:00', 'DAY', { start: 'p3_watch', drain: 1, sub: 'SUNDAY · 2:00 PM' }),
  p4: C('p4', 11, 'Tail the Black SUV', '尾', 2, 'pick', 'sun', '14:30', 'DAY', { start: 'p3_watch', drain: 1, sub: 'SUNDAY · 2:30 PM' }),
  p5: C('p5', 12, 'The Long Lens', '望', 3, 'pick', 'sun', '18:30', 'DUSK', { start: 'p4_turnout', drain: 1, sub: 'SUNDAY · 6:30 PM' }),
  p6: C('p6', 13, 'Rattler', '蛇', 3, 'pick', 'sun', '23:00', 'NIGHT', { start: 'aframe', drain: 1, sub: 'SUNDAY · 11:00 PM' }),
  p7: C('p7', 14, 'Vortex Monday', '渦', 3, 'pick', 'mon', '6:00', 'DAY', { start: 'red_rock_crossing', drain: 1, sub: 'MONDAY · 6:00 AM', crew: ['fifty', 'tanktop', 'shades', 'newbalance', 'redjersey'] }),
  p8: C('p8', 15, 'Plant the Phone', '電', 3, 'pick', 'mon', '16:00', 'DAY', { start: 'motel', drain: 1, sub: 'MONDAY · 4:00 PM' }),
  p9: C('p9', 16, 'The Convoy', '追', 4, 'pick', 'mon', '22:30', 'NIGHT', { start: 'diner', drain: 1, sub: 'MONDAY · 10:30 PM' }),
  p10: C('p10', 17, 'The Hart Ranch', '牧', 4, 'pick', 'tue', '1:10', 'NIGHT', { start: 'hart_ridge', drain: 1, sub: 'TUESDAY · 1:10 AM' }),
  p11: C('p11', 18, 'The Scorpion', '蠍', 4, 'pick', 'tue', '2:00', 'DEEP_INK', { start: 'p11_yard', drain: 1, sub: 'TUESDAY · 2:00 AM' }),
  p12: C('p12', 19, 'Ten Seats', '十', 4, 'pick', 'tue', '5:10', 'NIGHT', { start: 'p10_gate', drain: 1, sub: 'TUESDAY · 5:10 AM' }),
  e1: C('e1', 20, 'The First', '完', 5, 'pick', 'wed', '18:10', 'DAY', { start: 'e1_meadow', drain: 1, sub: 'ONE MONTH LATER · 6:10 PM', crew: ['fifty', 'tanktop', 'shades', 'newbalance', 'redjersey'] }),
};
// the chapter p10 runs two missions: the ranch (stealth, the generator, Boone), then the rescue. The six
// people spawn only in the second, after the guards are tied (D4).
CHAPTERS.p10.missions = ['p10', 'p10_rescue'];

// every chapter in order, and nothing else
for (const id of Object.keys(CHAPTERS)) if (!CHAPTER_ORDER.includes(id)) throw new Error(`chapters.js: ${id} is not in CHAPTER_ORDER`);
