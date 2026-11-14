// Turns one X mention into a Pay on Proof job the contract can check.
// "@payonproof make me a logo, 5 NEAR" is a paint job with contrast 450 and a budget of 5.

const OPTIONS = [
  { re: /\blogo\b/, kind: "paint", title: "logo", spec: { contrast_x100: 450 } },
  { re: /\bpalette\b/, kind: "paint", title: "palette", spec: { contrast_x100: 450 } },
  { re: /\bpaint\b/, kind: "paint", title: "paint", spec: { contrast_x100: 450 } },
  { re: /\bcolou?rs?\b/, kind: "paint", title: "paint", spec: { contrast_x100: 450 } },
  { re: /\bcontrast\b/, kind: "paint", title: "paint", spec: { contrast_x100: 450 } },
  { re: /\bmaps?\b/, kind: "map", title: "map" },
  { re: /\bdungeon\b/, kind: "map", title: "map" },
  { re: /\brooms?\b/, kind: "map", title: "map" },
  { re: /\broster\b/, kind: "roster", title: "roster", spec: { lo: 6, hi: 10, size: 3 } },
  { re: /\bcritters?\b/, kind: "roster", title: "roster", spec: { lo: 6, hi: 10, size: 3 } },
  { re: /\bcrew\b/, kind: "roster", title: "roster", spec: { lo: 6, hi: 10, size: 3 } },
  { re: /\btunes?\b/, kind: "tune", title: "tune", spec: { bars: 4, key: "C major" } },
  { re: /\bsongs?\b/, kind: "tune", title: "tune", spec: { bars: 4, key: "C major" } },
  { re: /\bjingles?\b/, kind: "tune", title: "tune", spec: { bars: 4, key: "C major" } },
  { re: /\bmelod(?:y|ies)\b/, kind: "tune", title: "tune", spec: { bars: 4, key: "C major" } },
  { re: /\bmusic\b/, kind: "tune", title: "tune", spec: { bars: 4, key: "C major" } },
];

function mapSpec(body) {
  const n = body.match(/\b(\d+)\s*-?\s*rooms?\b/);
  let rooms = n ? Number(n[1]) : 3;
  if (rooms < 2 || rooms > 12) rooms = 3;
  return { rooms, cols: 4, rows: 3 };
}

export function parseMention(text) {
  const raw = String(text ?? "").trim();
  const handle = raw.match(/@([A-Za-z0-9_]{1,15})\b/);
  if (!handle) throw new Error("mention needs an @handle");
  const body = raw.replace(handle[0], " ").toLowerCase();
  const money = body.match(/(\d+(?:\.\d+)?)\s*near\b/);
  if (!money) throw new Error("mention needs an amount in NEAR");
  const budgetNear = Number(money[1]);
  if (!(budgetNear >= 0.001)) throw new Error("budget is below 0.001 NEAR");
  let best = null;
  for (const opt of OPTIONS) {
    const at = body.search(opt.re);
    if (at >= 0 && (best === null || at < best.at)) best = { ...opt, at };
  }
  if (!best) throw new Error("mention needs a logo, map, roster, or tune");
  const spec = best.kind === "map" ? mapSpec(body) : best.spec;
  return { raw, handle: handle[1], budgetNear, kind: best.kind, title: best.title, spec };
}
