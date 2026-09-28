// Checks the House Rules link with no browser: node qa/lab/rules.link.mjs
// 500 random layers survive the trip through a link, a busy layer fits in 2,000 characters, a changed code or time
// fails the clear stamp, junk never throws, and the same link always builds the same ground. Exit code 1 on failure.
import { blank, encode, decode, build, stampFor, checkStamp, PAINTS, SIZES, CRITTERS, THEMES, LIMIT, W, H, TOP, M } from "../../public/lab/rules/layer.js";
import { mulberry, fnv1a } from "../../public/lab/kit/rng.js";

const fails = [];
const check = (ok, msg) => { console.log((ok ? "  ok   " : "  FAIL ") + msg); if (!ok) fails.push(msg); };
const section = (s) => console.log("\n" + s);
const R = mulberry(20260928);
const ri = (a, b) => a + Math.floor(R() * (b - a + 1));

// a layer an author could make: strokes wander in small steps, the way a finger moves
function randomLayer(nStrokes = ri(0, 30), nPts = () => ri(1, 20)) {
  const L = blank(ri(0, 2 ** 32 - 1));
  L.theme = ri(0, THEMES.length - 1);
  L.name = ["", "Lava Lamp", "Bob's pit", "Ça coule 🌊"][ri(0, 3)];
  L.drains = [ri(34, W / 2), ri(W / 2, W - 34)];
  for (let k = 0; k < nStrokes; k++) {
    let x = ri(2, W - 3), y = ri(TOP, H - 3);
    const pts = [[x, y]];
    for (let i = 1, n = nPts(); i < n; i++) { x = Math.min(W - 3, Math.max(2, x + ri(-14, 14))); y = Math.min(H - 3, Math.max(TOP, y + ri(-14, 14))); pts.push([x, y]); }
    L.strokes.push({ p: ri(0, PAINTS.length - 1), r: ri(0, SIZES.length - 1), pts });
  }
  for (let k = ri(0, 12); k > 0; k--) L.critters.push({ k: ri(0, CRITTERS.length - 1), x: ri(10, W - 10), y: ri(TOP + 14, H - 20) });
  for (let k = ri(0, 6); k > 0; k--) L.tanks.push({ x: ri(10, W - 10), y: ri(TOP + 10, H - 20) });
  return L;
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

section("The link");
{
  let ok = 0, longest = 0;
  for (let k = 0; k < 500; k++) {
    const L = randomLayer(), code = await encode(L), back = await decode(code);
    if (same(L, back)) ok++;
    longest = Math.max(longest, code.length);
  }
  check(ok === 500, `500 random layers come back the same from their links (${ok}; the longest link was ${longest} characters)`);
  const busy = randomLayer(50, () => 12);
  busy.name = "A busy layer";
  const code = await encode(busy);
  check(code.length <= LIMIT, `a busy layer (50 strokes of 12 points, ${busy.critters.length} critters, ${busy.tanks.length} tanks) fits in ${LIMIT} characters (${code.length})`);
  check(same(await decode(code), busy), "and comes back the same");
  const plain = await encode(blank(5));
  check(plain.length < 40, `an empty layer is a short link (${plain.length} characters: ${plain})`);
}

section("The clear stamp");
{
  const code = await encode(randomLayer(8));
  const st = stampFor(code, 47);
  check(checkStamp(code, st) === 47, `a stamp gives back the time it was made with (${st})`);
  check(checkStamp(code, st.replace(/^47/, "46")) === null, "a changed time fails");
  let caught = 0;
  for (let i = 0; i < code.length; i++) {
    const c = code[i] === "A" ? "B" : "A";
    if (checkStamp(code.slice(0, i) + c + code.slice(i + 1), st) === null) caught++;
  }
  check(caught === code.length, `a change to any one character of the code fails the stamp (${caught} of ${code.length})`);
  check(checkStamp(code, "") === null && checkStamp(code, "47") === null && checkStamp(code, "x-y") === null, "a missing or broken stamp fails");
}

section("Junk links");
{
  let threw = 0, nulls = 0;
  const junk = ["", "A", "AA", "AAAA", "////", "hello world", "%%%", "-_-_", "A".repeat(9000)];
  for (let k = 0; k < 400; k++) { let s = ""; for (let i = ri(0, 60); i > 0; i--) s += "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"[ri(0, 63)]; junk.push(s); }
  // good links cut short, or with one character changed
  for (let k = 0; k < 100; k++) {
    const code = await encode(randomLayer(ri(1, 10)));
    junk.push(code.slice(0, ri(1, code.length - 1)));
    const i = ri(0, code.length - 1);
    junk.push(code.slice(0, i) + (code[i] === "Q" ? "R" : "Q") + code.slice(i + 1));
  }
  for (const s of junk) {
    try { const L = await decode(s); if (L === null) nulls++; else if (!L.strokes.every((st) => st.pts.every(([x, y]) => x >= 0 && x < W && y >= 0 && y < H))) threw++; }
    catch (e) { threw++; }
  }
  check(threw === 0, `${junk.length} junk and damaged links never throw, and never give a point off the map`);
  check(nulls > junk.length * 0.8, `most of them give nothing (${nulls} of ${junk.length}); the rest decode to some other valid layer`);
  let truncated = 0;
  for (let k = 0; k < 100; k++) {
    const L = randomLayer(ri(2, 10)), code = await encode(L);
    const cut = await decode(code.slice(0, code.length - ri(2, 6)));
    if (cut === null || !same(cut, L)) truncated++;
  }
  check(truncated === 100, "a link cut short never passes for the full layer");
}

section("The ground");
{
  const L = randomLayer(20);
  const a = build(L), b = build(L);
  check(fnv1a(a) === fnv1a(b), "the same layer always builds the same ground");
  // pinned: if these change, old links build different ground. Change them only on purpose.
  const pin = { blank: fnv1a(build(blank(7))), sample: fnv1a(build(randomLayerFrom(99))) };
  console.log("  pinned hashes:", JSON.stringify(pin));
  check(pin.blank === 3577254126 && pin.sample === 1406087485, "the ground from old links has not changed");
  const g = build(blank(7));
  check(g[5 * W + 3] === 0 && g[(H - 1) * W + 10] === M.BEDROCK && g[300 * W + 1] === M.BEDROCK, "bedrock frames the layer, and the rows above it stay open for the outhouse");
  check(g[(H - 22) * W + W / 2 - 150] === M.EMPTY && g[(H - 22) * W + W / 2 + 150] === M.EMPTY, "both drains are open");
  check(g[(TOP + 4) * W + W / 2] === M.EMPTY, "the hole under the outhouse goes on into the ground");
  const T = blank(7);
  T.tanks.push({ x: 300, y: 400 });
  T.critters.push({ k: 5, x: 600, y: 500 });
  const t = build(T);
  check(t[396 * W + 300] === M.METAL && t[(500 - 6) * W + 600] === M.EMPTY, "a tank is metal, and a critter gets room to stand");
}
// a fixed layer from its own seed, for the pinned hash
function randomLayerFrom(seed) {
  const r = mulberry(seed);
  const pick = (a, b) => a + Math.floor(r() * (b - a + 1));
  const L = blank(pick(0, 2 ** 31));
  L.theme = pick(0, 3);
  for (let k = 0; k < 12; k++) {
    let x = pick(2, W - 3), y = pick(TOP, H - 3);
    const pts = [[x, y]];
    for (let i = 0; i < 8; i++) { x = Math.min(W - 3, Math.max(2, x + pick(-20, 20))); y = Math.min(H - 3, Math.max(TOP, y + pick(-20, 20))); pts.push([x, y]); }
    L.strokes.push({ p: pick(0, PAINTS.length - 1), r: pick(0, 3), pts });
  }
  return L;
}

console.log(`\nrules.link: ${fails.length ? fails.length + " failed" : "all passed"}`);
process.exit(fails.length ? 1 : 0);
