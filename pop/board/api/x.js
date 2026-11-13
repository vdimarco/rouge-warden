// Vercel proxy so the board can read the X flow's JSON feed without CORS.
// GET /api/x?u=https://example/feed.json
export default async function handler(req, res) {
  res.setHeader("access-control-allow-origin", "*");
  const raw = req.query?.u || "";
  if (!raw) return res.status(200).json({ source: "pop-x", events: [], missing: true });
  let url;
  try { url = new URL(raw); } catch { return res.status(400).json({ error: "bad url" }); }
  if (url.protocol !== "https:") return res.status(400).json({ error: "https only" });
  const r = await fetch(url, { headers: { accept: "application/json" } });
  const text = await r.text();
  res.status(r.ok ? 200 : 502).setHeader("content-type", "application/json").send(text.slice(0, 1_000_000));
}
