// Temporary, preview-only asset workshop. No API credentials leave this function.
// The fixed idempotency keys bound this session to three generation intents,
// including across cold starts. Remove this route after the comparison is saved.
const { createHash, timingSafeEqual } = require('node:crypto');
const session = require('../higgsfield/style-session.json');
const recipes = require('../higgsfield/monster-toon-assets.json');
const API = 'https://api.higgsfield.ai';
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  if (process.env.VERCEL_ENV !== 'preview' || Date.now() >= Date.parse(session.expiresAt)) {
    return res.status(410).json({ error: 'session_closed' });
  }
  const auth = req.headers.authorization;
  if (typeof auth !== 'string' || !/^Bearer [a-f0-9]{64}$/.test(auth)
    || !timingSafeEqual(createHash('sha256').update(auth.slice(7)).digest(), Buffer.from(session.tokenSha256, 'hex'))) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ error: 'method_not_allowed' });
  const key = process.env.HIGGSFIELD_API_KEY?.trim() || '';
  const secret = process.env.HIGGSFIELD_API_SECRET?.trim() || '';
  const credential = process.env.HF_CREDENTIALS?.trim()
    || (key.includes(':') ? key : key && secret ? `${key}:${secret}` : '');
  if (!/^[\x21-\x39\x3b-\x7e]+:[\x21-\x39\x3b-\x7e]+$/.test(credential)) {
    return res.status(503).json({ error: 'credential_not_configured', keyPresent: Boolean(key), secretPresent: Boolean(secret), legacyPresent: Boolean(process.env.HF_CREDENTIALS?.trim()) });
  }
  let path, body, idempotency;
  if (req.method === 'GET') {
    if (req.query.action === 'config') return res.status(200).json({ configured: true, model: recipes.model, expiresAt: session.expiresAt });
    if (req.query.action === 'models') path = '/models?page=1&size=100';
    else if (req.query.action === 'status' && typeof req.query.id === 'string' && UUID.test(req.query.id)) path = `/requests/${req.query.id}/status`;
    else return res.status(400).json({ error: 'invalid_action' });
  } else {
    let input = req.body;
    try { if (typeof input === 'string') input = JSON.parse(input); } catch { return res.status(400).json({ error: 'invalid_json' }); }
    if (!input || Object.keys(input).length !== 1 || typeof input.style !== 'string' || !Object.hasOwn(recipes.styles, input.style)) {
      return res.status(400).json({ error: 'invalid_style' });
    }
    path = `/${recipes.model}`;
    body = { ...recipes.parameters, prompt: `${recipes.common}\n\n${recipes.styles[input.style]}` };
    idempotency = session.idempotency[input.style];
  }
  try {
    const upstream = await fetch(API + path, {
      method: body ? 'POST' : 'GET', redirect: 'error',
      headers: { Authorization: `Key ${credential}`, 'Content-Type': 'application/json', ...(idempotency ? { 'Idempotency-Key': idempotency } : {}) },
      body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(25000),
    });
    if (!upstream.ok) {
      // Never return or log upstream text: it can echo credentials or request headers.
      return res.status(502).json({ error: 'higgsfield_rejected', upstreamStatus: upstream.status });
    }
    const data = await upstream.json();
    if (path.startsWith('/models?')) return res.status(200).json({ models: (data.items || []).map(m => ({ slug: m.slug, title: m.title, operation_type: m.operation_type })), total: data.total });
    const images = Array.isArray(data.images) ? data.images.flatMap(img => {
      try { const u = new URL(img.url); return u.protocol === 'https:' && !u.username && !u.password ? [{ url: u.href }] : []; } catch { return []; }
    }) : [];
    return res.status(200).json({ request_id: data.request_id, status: data.status, images });
  } catch {
    return res.status(502).json({ error: body ? 'submission_unconfirmed_reuse_same_style' : 'higgsfield_unreachable' });
  }
};
