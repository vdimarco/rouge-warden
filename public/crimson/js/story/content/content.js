// js/story/content/content.js : the CONTENT package. init(S) registers S.content = { CHAPTERS, MISSIONS,
// LINES, CINES, SCRIPTS, CREDITS, line(id, vars) }: the whole story of design 2.5 (with AMENDMENTS E1-E10)
// as data that MISSIONS runs. The data lives in chapters.js, m_*.js (one MissionDef per chapter, plus the
// side content), lines.js, cines.js, scripts.js and credits.js.
// init fills only S.content and S.test.credits (B13); the crew on foot and the scripts' clean-up wire to
// the bus here, and start nothing until a session runs.
import { CREW_IDS, CHAPTER_ORDER } from '../types.js';
import { CHAPTERS } from './chapters.js';
import { LINES, UI_TEXT } from './lines.js';
import { CINES } from './cines.js';
import { SCRIPTS, createRuntime, isAuto, rt } from './scripts.js';
import { CREDITS } from './credits.js';
import { MISSIONS as PROLOGUE } from './m_prologue.js';
import { MISSIONS as FLASH } from './m_flash.js';
import { MISSIONS as ACT1 } from './m_act1.js';
import { MISSIONS as ACT2 } from './m_act2.js';
import { MISSIONS as ACT3 } from './m_act3.js';
import { MISSIONS as EPILOGUE, SIDE } from './m_epilogue.js';

export const MISSIONS = { ...PROLOGUE, ...FLASH, ...ACT1, ...ACT2, ...ACT3, ...EPILOGUE };
// the acts, for QA shards and the missions log: the chapters of each
export const ACTS = Object.freeze({
  prologue: ['c0', 'i0', 'f1', 'i1', 'f2', 'i2', 'f3', 'i3', 'f4', 'i4', 'f5', 'i5'],
  act1: ['p1', 'p2', 'p3', 'p4'], act2: ['p5', 'p6', 'p7', 'p8'], act3: ['p9', 'p10', 'p11', 'p12', 'e1'],
});

// A line's text for the player: the pick's own variant when it has one, {PICK} as the pick's name, and
// {name} from vars. An unknown id comes back as itself (so a missing line shows, and text.mjs catches it).
export function lineText(id, vars = {}, pick = 0, crew = []) {
  const L = LINES[id];
  if (L == null) return String(id);
  const pickId = CREW_IDS[pick] || '';
  let t = typeof L === 'string' ? L : (L.byPick && L.byPick[pickId]) || L.text;
  const name = vars.PICK || (crew[pick] ? crew[pick].name : '');
  t = String(t).replace(/\{PICK\}/g, name);
  return t.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? String(vars[k]) : m));
}

export function init(S) {
  S.test.credits = null; // the credits handle while they roll (QA)
  S.content = {
    CHAPTERS, MISSIONS, LINES, CINES, SCRIPTS, CREDITS,
    line: (id, vars = {}) => lineText(id, vars, S.ctx.crewPick, S.ctx.CREW || []),
    // extras: the acts, the side jobs, the plain UI texts (the title note, the hotline, the closing note)
    ACTS, SIDE, UI_TEXT, crew: CREW_IDS, order: CHAPTER_ORDER,
    isAuto: () => isAuto(S),
  };
  createRuntime(S);
  S.test.content = {
    get acts() { return ACTS; },
    // the chapter's missions and their step count (QA)
    info: (ch) => (CHAPTERS[ch] ? CHAPTERS[ch].missions.map((id) => ({ id, steps: MISSIONS[id].steps.length, budget: MISSIONS[id].budget || 0 })) : null),
    get crew() { const K = rt(S); return K ? K.crew.map((a) => a.crewId) : []; },
    // the actors content scripts spawned for the running mission (friends at a spot, seated passengers)
    get owned() { const K = rt(S); return K ? [...K.owned].map((a) => ({ id: a.id, x: a.root.position.x, y: a.root.position.y, z: a.root.position.z, visible: a.visible })) : []; },
  };
}
