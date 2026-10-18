// First Breath: the stage index (design.md 16.1, 16.4). The 8 stages in run order, by static import, and the
// ending. It also hands each stage's FACTS and TEXT tables (stage order, then the ending's) to core/facts.js and
// core/text.js, so those two gather every table without a stage ever importing them. Pure.
//
// Contract choices (16.1 names only STAGES): the extra exports are ENDING (core/ending.js, the stage-shaped ending),
// FACT_TABLES and TEXT_TABLES (the tables, in that order), TUNES ({ id: TUNE }, for tests and tuning tools) and
// byId(id) (a stage module or the ending by id, else null). Stage files never import this file.
import * as swim from "./swim.js";
import * as egg from "./egg.js";
import * as split from "./split.js";
import * as root from "./root.js";
import * as grow from "./grow.js";
import * as answer from "./answer.js";
import * as turn from "./turn.js";
import * as birth from "./birth.js";
import * as ending from "../ending.js";

import { FACTS as swimFacts } from "./swim.facts.js";
import { FACTS as eggFacts } from "./egg.facts.js";
import { FACTS as splitFacts } from "./split.facts.js";
import { FACTS as rootFacts } from "./root.facts.js";
import { FACTS as growFacts } from "./grow.facts.js";
import { FACTS as answerFacts } from "./answer.facts.js";
import { FACTS as turnFacts } from "./turn.facts.js";
import { FACTS as birthFacts } from "./birth.facts.js";
import { FACTS as endingFacts } from "../ending.facts.js";

import { TEXT as swimText } from "./swim.text.js";
import { TEXT as eggText } from "./egg.text.js";
import { TEXT as splitText } from "./split.text.js";
import { TEXT as rootText } from "./root.text.js";
import { TEXT as growText } from "./grow.text.js";
import { TEXT as answerText } from "./answer.text.js";
import { TEXT as turnText } from "./turn.text.js";
import { TEXT as birthText } from "./birth.text.js";
import { TEXT as endingText } from "../ending.text.js";

import { TUNE as swimTune } from "./swim.tune.js";
import { TUNE as eggTune } from "./egg.tune.js";
import { TUNE as splitTune } from "./split.tune.js";
import { TUNE as rootTune } from "./root.tune.js";
import { TUNE as growTune } from "./grow.tune.js";
import { TUNE as answerTune } from "./answer.tune.js";
import { TUNE as turnTune } from "./turn.tune.js";
import { TUNE as birthTune } from "./birth.tune.js";
import { TUNE as endingTune } from "../ending.tune.js";

export const STAGES = Object.freeze([swim, egg, split, root, grow, answer, turn, birth]);
export const ENDING = ending;

export const FACT_TABLES = Object.freeze([swimFacts, eggFacts, splitFacts, rootFacts, growFacts, answerFacts, turnFacts,
  birthFacts, endingFacts]);
export const TEXT_TABLES = Object.freeze([swimText, eggText, splitText, rootText, growText, answerText, turnText,
  birthText, endingText]);
export const TUNES = Object.freeze({ swim: swimTune, egg: eggTune, split: splitTune, root: rootTune, grow: growTune,
  answer: answerTune, turn: turnTune, birth: birthTune, ending: endingTune });

export function byId(id) {
  if (id === ENDING.meta.id) return ENDING;
  return STAGES.find((m) => m.meta.id === id) || null;
}
