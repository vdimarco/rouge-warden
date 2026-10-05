// One word for each move, and the loss lines: node qa/fish/words.test.mjs
// The fight prompt (main.js), the guide caption (guide.js lesson) and the rod cue (rod-cues.js) read one table, MOVE_WORDS in
// guide.js. This checks the table and the guide in node, and that main.js takes its move subs from the table and no longer
// spells a move its own way. screens.mjs checks the three surfaces side by side in the real game. Exit code 1 on a failure.
import { readFileSync } from "fs";
import { MOVE_WORDS, REEL_PACE, HOLD_WORDS, moveWords, inputOf, lesson, activeLesson } from "../../public/fish/js/guide.js";
import { lossText, JOURNEY, ORDER } from "../../public/fish/js/journey.js";
import "../../public/fish/js/rod-cues.js";

const fails = [];
const check = (ok, msg) => { console.log((ok ? "ok   " : "FAIL ") + msg); if (!ok) fails.push(msg); };
// [motion, touch, input, desk]: a computer is the mouse or the keys, the one the player used last
const INPUTS = [[true, true, "motion"], [false, true, "touch"], [false, false, "keys", "keys"], [false, false, "mouse", "mouse"]];
const plain = (t) => !/—|\b(red|green|amber|yellow)\b/i.test(t);

// the table: every move has touch words, and the words are plain sentences
for (const [kind, w] of Object.entries(MOVE_WORDS)) check(typeof w.touch === "string" && Object.values(w).every((t) => /[.!]$/.test(t) && plain(t)), `${kind}: touch words, and plain sentences (${Object.values(w).join(" / ")})`);
check(Object.values(REEL_PACE).every((t) => /^Reel (a little )?\w+\.$/.test(t)) && REEL_PACE.faster === "Reel a little faster.", "the crank paces: Reel slowly. / Reel fast. / Reel a little faster. / Reel steadily.");
// the reel move with a pace (the prompt gives it with the cue): the guide caption and the rod cue both say it; with none,
// the reel move's own words
check(moveWords("reel", "touch", 0, "fast") === "Reel fast." && lesson("reel", false, true, "slow")[0] === "Reel slowly." && lesson("reel", true, true, "steady")[0] === "Reel steadily." && lesson("reel", false, true)[0] === MOVE_WORDS.reel.touch && moveWords("pump", "touch", 0, "fast") === MOVE_WORDS.pump.touch, "the reel with a pace says the pace (Reel fast.), with none \"Turn the crank to reel.\"");
// the guide caption is the table's words, for each move and input
for (const kind of Object.keys(MOVE_WORDS)) for (const [motion, touch, input, desk] of INPUTS) {
  const cap = lesson(kind, motion, touch, "", false, desk)[0];
  check(inputOf(motion, touch, desk) === input && cap === moveWords(kind, input), `guide: ${kind} (${input}) says "${cap}"`);
}
// a computer: the mouse player hears the mouse's way to set the hook, and the keys player hears the keys for every move
check(moveWords("hook", "mouse") === "Drag the rod up fast!" && moveWords("hook", "keys") === "Press Space!" && moveWords("low", "mouse") === MOVE_WORDS.low.touch, `the hook set on a computer: "${moveWords("hook", "mouse")}" with the mouse, "${moveWords("hook", "keys")}" with the keys`);
const KEYW = ["reel", "pump", "low", "raise", "turn", "land"].map((k) => moveWords(k, "keys"));
check(/\bR\b/.test(KEYW[0]) && /\bW\b/.test(KEYW[1]) && /\bS\b/.test(KEYW[2]) && /\bW\b/.test(KEYW[3]) && /\bA\b.*\bD\b/.test(KEYW[4]) && /\bW\b/.test(KEYW[5]), `the keys player hears the keys: ${KEYW.join(" / ")}`);
// the guide shows the right move for the keys words too
check(activeLesson({ phase: "reel", fishPhase: "fight", cue: { text: "Your rod is too low.", sub: moveWords("raise", "keys"), icon: "pull", tone: "" }, motion: false }) === "raise" && activeLesson({ phase: "reel", fishPhase: "fight", cue: { text: "Pump and reel.", sub: moveWords("pump", "keys"), icon: "pull", tone: "" }, motion: false }) === "pump", "the keys words: the guide shows the rod held up, and the pump");
// the hold cast (Space, or a mouse button held still): the guide caption says the rod cue's words, not the drag
check(INPUTS.slice(1).every(([motion, touch, , desk]) => lesson("back", motion, touch, "", true, desk)[0] === HOLD_WORDS.back && lesson("cast", motion, touch, "", true)[0] === HOLD_WORDS.cast) && HOLD_WORDS.back === "Keep holding" && HOLD_WORDS.cast === "Let go in the green" && lesson("back", false, false)[0] === "Drag down", `the hold cast: the guide says "${HOLD_WORDS.back}", then "${HOLD_WORDS.cast}"; a drag still says "Drag down"`);
// the pump in motion mode: the scenario of the spec
check(moveWords("pump", "motion") === "Tip back as you reel." && lesson("pump", true)[0] === "Tip back as you reel." && lesson("strength", true)[0] === "Tip back as you reel.", "the motion pump (and the reel power that is the same move) is \"Tip back as you reel.\"");
check(moveWords("turn", "motion", 1) === "Tilt the phone right." && moveWords("turn", "touch", -1) === "Drag the rod left." && moveWords("turn", "mouse", 1) === "Drag the rod right." && moveWords("turn", "keys", 1) === "Hold D." && moveWords("turn", "keys", -1) === "Hold A.", "a steer with a side names it");
// a sulk prompt with the pump words picks the pump lesson, in both modes (so the guide and the rod cue say the same)
for (const [motion, , input] of INPUTS.slice(0, 2)) {
  const cue = { text: "It holds on the bottom.", sub: moveWords("pump", input), icon: "pull", tone: "" };
  check(activeLesson({ phase: "reel", fishPhase: "fight", cue, motion, pullAvailable: false }) === "pump", `a fish on the bottom (${input}): the guide shows the pump`);
}
check(activeLesson({ phase: "reel", fishPhase: "fight", cue: { text: "It shakes its head!", sub: moveWords("raise", "motion") + " Keep reeling slowly.", icon: "pull", tone: "hot" }, motion: false }) === "raise", "a head shake: the guide shows the rod held up");

// the fight prompt of main.js takes the move subs from the table, and none of the old spellings of a move is left in it
// (How to play is the help screen's own text)
const src = readFileSync(new URL("../../public/fish/js/main.js", import.meta.url), "utf8");
const main = src.slice(src.indexOf("function fightCue("), src.indexOf("function handleEvent("));
const used = [...main.matchAll(/words\("(\w+)"/g)].map((m) => m[1]);
check(used.length >= 8 && used.every((k) => k in MOVE_WORDS), `the fight prompt asks the table for its move words (${[...new Set(used)].join(", ")})`);
// every prompt that asks for a crank pace gives that pace with the cue, so the rod cue never reads it from the headline
// (it once said "Reel fast." under "Too fast! Reel slower.")
const says = [];
for (let i = main.indexOf("say("); i >= 0; i = main.indexOf("say(", i + 4)) {
  if (/\w/.test(main[i - 1])) continue;
  const args = [], q = { d: 0, str: "", cur: "" };
  for (let j = i + 4; j < main.length; j++) {
    const c = main[j];
    if (q.str) { q.cur += c; if (c === q.str && main[j - 1] !== "\\") q.str = ""; continue; }
    if (c === '"' || c === "'" || c === "`") { q.str = c; q.cur += c; continue; }
    if (c === "(" || c === "[" || c === "{") q.d++;
    if (c === ")" || c === "]" || c === "}") { if (!q.d) { args.push(q.cur.trim()); break; } q.d--; }
    if (c === "," && !q.d) { args.push(q.cur.trim()); q.cur = ""; continue; }
    q.cur += c;
  }
  says.push(args);
}
const PACE = [[/Reel slower|Reel slowly/, "slow"], [/Reel a little faster/, "faster"], [/Reel it in|Reel fast/, "fast"], [/Reel steadily/, "steady"]];
const paced = says.filter((a) => PACE.some(([re]) => re.test(a[0] + " " + (a[1] || ""))));
const wrong = paced.filter((a) => { const want = PACE.find(([re]) => re.test(a[0] + " " + (a[1] || "")))[1]; return a[5] !== JSON.stringify(want); });
check(paced.length >= 6 && !wrong.length, `the prompts that ask for a crank pace give it with the cue (${paced.length} of them${wrong.length ? "; wrong: " + wrong.map((a) => a[0]).join(" | ") : ""})`);
const cues = readFileSync(new URL("../../public/fish/js/rod-cues.js", import.meta.url), "utf8");
check(!/test\(cue\.text\)/.test(cues) && /cue\.pace/.test(cues), "the rod cue takes the pace from the cue, not from the headline's words");
check(/HOLD_WORDS\[kind\]/.test(cues) && !/Keep holding/.test(cues), "the rod cue takes the hold cast's words from the guide's table");
const OLD = ["Tip the phone back toward you as you reel", "Lift the rod slowly. Then reel as you lower it", "Drag the rod pad", "Reel in any slack", "Lower the rod a little", "if the gauge turns red", "Drag the rod up. Then reel as it comes down"];
check(OLD.every((t) => !main.includes(t)), `the fight prompt has none of the old wordings (${OLD.filter((t) => main.includes(t)).join(" | ") || "none left"})`);

// the loss lines: each loss names the move that would have saved the fish
const L = (r, o) => lossText(r, o);
check(L("snap", { cause: "grind" })[1] === "Stop reeling when the drag slips." && L("snap", { cause: "rodlow" })[1] === "Keep the rod up. It bends and saves the line." && L("snap", { cause: "drag" })[1] === "Set the drag lighter with the − button." && L("snap", {})[1] === "Stop reeling when the drag slips.", "a snap: the tip follows the cause");
check(L("thrown", { by: "jump" })[1] === "Lower the rod as soon as it jumps." && L("thrown", { by: "shake" })[1] === "Keep reeling slowly when it shakes its head." && L("thrown", { by: "charge" })[1] === "Reel fast when it swims at you.", "a thrown hook: the tip follows the move");
check(L("weeds", { input: "touch" })[1] === "Drag the rod sideways to steer it." && L("weeds", { input: "motion" })[1] === "Tilt the phone left or right to steer it away.", "the weeds: drag the rod sideways, or tilt the phone");
// the weeds tip names the steer of the input, as the fight does ("Hold A or D." in the fight, "Hold A or D to steer it.")
check(INPUTS.slice(1).every(([, , input]) => L("weeds", { input, turn: moveWords("turn", input) })[1] === moveWords("turn", input).replace(/\.$/, "") + " to steer it.") && L("weeds", { input: "keys", turn: moveWords("turn", "keys") })[1] === "Hold A or D to steer it." && L("weeds", { input: "mouse", turn: moveWords("turn", "mouse") })[1] === "Drag the rod sideways to steer it.", `the weeds: the steer words of the input ("${L("weeds", { input: "keys", turn: moveWords("turn", "keys") })[1]}" for the keys)`);
check(INPUTS.every(([, , input]) => L("spat", { input, hook: moveWords("hook", input) })[1] === moveWords("hook", input).replace(/!$/, "") + " as soon as it strikes."), `a missed strike: the hook-set words of the input ("${L("spat", { hook: moveWords("hook", "keys") })[1]}")`);
for (const id of ORDER) {
  const [h, sub] = L("thrown", { by: "jump", legend: id });
  check(/ got away\.$/.test(h) && sub.startsWith("Lower the rod as soon as it jumps. ") && sub.endsWith("Look for its gold ring again " + JOURNEY[id].when + "."), `${id}: a lost legend has its own line ("${h}" / "${sub}")`);
}
const all = ["snap", "thrown", "spat", "spooked", "weeds", "stump", "logs", "rocks", "spooled"].flatMap((r) => L(r, { legend: "sea" }).concat(L(r, {})));
check(all.every((t) => t && plain(t)), "every loss line is set, with no colour word and no em dash");

console.log(fails.length ? `\n${fails.length} failed` : "\nall passed");
process.exit(fails.length ? 1 : 0);
