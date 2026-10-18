// First Breath: every shown fact, gathered from the stages (design.md 15.1, 16.2). A fact is { id, stage, gaDay,
// gaEnd?, fertilized?, text, src: [keys of SOURCES], access: "R" | "A", checked, where }. Facts store gaDay, never a
// label: label(fact) makes it with clock.label (or clock.range for a span), and screens print it in front of the
// text. Only checked facts with access R or A are ever shown. Pure.
//
// Each stage's FACTS arrive from core/stages/<id>.facts.js through core/stages/index.js, which does not exist yet
// in wave 0, so FACTS is empty for now and this file imports nothing from core/stages/.
// WIRE: when core/stages/index.js lands, import its list of FACTS tables (stage order, then the ending's) and pass it
// to gather() below. Stage and ending files must not import this file (it would be an import cycle).
//
// Contract choices: gather(tables) (an extra export) flattens the tables in order, keeps the first fact of each id
// and freezes each one; byId() gives null for an unknown id; a fact's fertilized defaults to gaDay > 14 (15.1);
// shown(settings) lists the checked R and A facts in order as copies with `label`, the text filled for the carer
// word, and `links` ([{ name, url }] from SOURCES; unknown keys are skipped there and caught by facts.test.mjs).
import { label as clockLabel, range } from "./clock.js";
import { SOURCES } from "./sources.js";
import { fill } from "./text.js";

export function gather(tables) {
  const out = [], seen = new Set();
  for (const table of tables || []) {
    for (const f of table || []) {
      if (!f || typeof f.id !== "string" || seen.has(f.id)) continue;
      seen.add(f.id);
      out.push(Object.freeze({ ...f, src: Object.freeze([...(f.src || [])]) }));
    }
  }
  return Object.freeze(out);
}

// Each stage's FACTS table (see WIRE above).
const STAGE_TABLES = [];

export const FACTS = gather(STAGE_TABLES);
const BY_ID = new Map(FACTS.map((f) => [f.id, f]));

export function byId(id) {
  return BY_ID.get(id) || null;
}

// "Week 2", "Day 22 after fertilization (week 5)" or a span such as "Weeks 31 to 34".
export function label(fact) {
  if (Number.isFinite(fact.gaEnd) && fact.gaEnd !== fact.gaDay) return range(fact.gaDay, fact.gaEnd);
  const fertilized = typeof fact.fertilized === "boolean" ? fact.fertilized : fact.gaDay > 14;
  return clockLabel(fact.gaDay, { fertilized });
}

export function shown(settings = {}) {
  return FACTS.filter((f) => f.checked === true && (f.access === "R" || f.access === "A")).map((f) => ({
    ...f,
    label: label(f),
    text: fill(f.text, {}, settings),
    links: f.src.map((k) => SOURCES[k]).filter(Boolean),
  }));
}
