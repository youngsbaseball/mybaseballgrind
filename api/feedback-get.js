// ═══════════════════════════════════════════════════════════
// Phase 7b V1 — Coach-reply page calls this to load a request.
// Token is required; without it the request is unreadable.
// Returns the record with the secret token stripped (the page
// already has the token in the URL — no need to echo it).
// ═══════════════════════════════════════════════════════════

import { getRequest } from '../lib/feedback-store.js';

const ALLOWED_ORIGINS = new Set([
  'https://www.mygrindapp.com',
  'https://mygrindapp.com',
]);

function setCors(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET')     return res.status(405).json({ ok: false, error: 'method_not_allowed' });

  const id    = (req.query.req || '').toString();
  const token = (req.query.t   || '').toString();
  if (!id || !token) return res.status(400).json({ ok: false, error: 'missing_id_or_token' });

  const result = await getRequest(id, token);
  if (!result.ok) {
    const status = result.error === 'not_found' ? 404
                 : result.error === 'bad_token' ? 403
                 : 500;
    return res.status(status).json(result);
  }

  // Strip the token from the response — the client already has it
  const safe = { ...result.record };
  delete safe.token;
  return res.status(200).json({ ok: true, record: safe });
}
