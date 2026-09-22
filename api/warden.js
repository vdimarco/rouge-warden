// Forwards the Warden's questions to Jev through Vercel AI Gateway.
// Auth uses this project's Vercel OIDC token, so no API key lives in the code.
const GATEWAY = "https://ai-gateway.vercel.sh/typesafe/v1/systemone";
const MODEL = process.env.JEV_MODEL || "typesafe-ai/jev";

const safeKey = (v, i, used) => {
  let k = String(v).toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 32);
  if (!k || /^[0-9]/.test(k) || used.has(k)) k = "option_" + i;
  used.add(k);
  return k;
};

module.exports = async (req, res) => {
  if (req.method !== "POST") { res.status(405).json({ error: "POST only" }); return; }
  const origin = req.headers.origin || "";
  if (origin && !/^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin)) { res.status(403).json({ error: "origin not allowed" }); return; }
  const token = req.headers["x-vercel-oidc-token"] || process.env.VERCEL_OIDC_TOKEN || process.env.AI_GATEWAY_API_KEY;
  if (!token) { res.status(503).json({ error: "no gateway credential" }); return; }
  let body = req.body;
  try { if (typeof body === "string") body = JSON.parse(body); } catch (e) { res.status(400).json({ error: "bad json" }); return; }
  const { state, questions } = body || {};
  if (!state || !Array.isArray(questions) || !questions.length || questions.length > 40 || JSON.stringify(body).length > 120000) { res.status(400).json({ error: "bad request" }); return; }
  const qmap = {}, keymaps = {};
  for (const q of questions) {
    if (!q || typeof q.id !== "string" || !/^[a-z0-9_]{1,40}$/.test(q.id) || !Array.isArray(q.options) || q.options.length < 2 || q.options.length > 60) { res.status(400).json({ error: "bad question" }); return; }
    const used = new Set(), criteria = {}, map = {};
    q.options.forEach((o, i) => { const k = safeKey(o.value, i, used); map[k] = o.value; criteria[k] = String(o.desc || o.label || o.value).slice(0, 400); });
    keymaps[q.id] = map;
    qmap[q.id] = { type: "choice", instructions: String(q.prompt || "Choose one.").slice(0, 1500), criteria };
  }
  const t0 = Date.now();
  let r, text;
  try {
    r = await fetch(GATEWAY, { method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: JSON.stringify({ model: MODEL, state, questions: qmap }) });
    text = await r.text();
  } catch (e) { res.status(502).json({ error: "gateway unreachable" }); return; }
  if (!r.ok) { res.status(502).json({ error: "jev " + r.status, detail: text.slice(0, 400) }); return; }
  let data;
  try { data = JSON.parse(text); } catch (e) { res.status(502).json({ error: "bad jev response" }); return; }
  const answers = {};
  for (const id in keymaps) {
    const a = data.answers && data.answers[id];
    if (!a || !a.probabilities) continue;
    answers[id] = {
      top: keymaps[id][a.choice],
      confidence: a.confidence,
      probs: Object.entries(a.probabilities).map(([k, p]) => ({ value: keymaps[id][k], p })).filter((x) => x.value !== undefined),
    };
  }
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ answers, model: data.model, usage: data.usage, ms: Date.now() - t0 });
};
