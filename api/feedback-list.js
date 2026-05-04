// ═══════════════════════════════════════════════════════════
// Phase 7b V1 — Lists feedback request/response records for a
// player (by phone) or parent (by email). Drives the "New from
// Coach" card on softball.html and the "This Week's Coaching"
// card on signup.html Screen 8.
//
// Security note for V1: anyone who knows the player's phone or
// the parent's email can list their feedback. That is acceptable
// for V1 because (a) phone/email are personal info already in
// each user's localStorage, (b) the data shown is only their
// own coach interactions, and (c) the secret token gate still
// protects writes. V2 (full coach app) will replace this with
// Firebase auth-scoped reads.
// ═══════════════════════════════════════════════════════════

import { listForPlayer, listForParent } from '../lib/feedback-store.js';

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

  const playerPhone = (req.query.player || '').toString();
  const parentEmail = (req.query.parent || '').toString();
  const days        = Math.max(1, Math.min(90, parseInt(req.query.days || '30', 10) || 30));

  if (!playerPhone && !parentEmail) {
    return res.status(400).json({ ok: false, error: 'missing_filter', items: [] });
  }

  const sinceTs = Date.now() - (days * 24 * 60 * 60 * 1000);

  const result = playerPhone
    ? await listForPlayer(playerPhone, { sinceTs })
    : await listForParent(parentEmail, { sinceTs });

  if (!result.ok) return res.status(500).json(result);
  return res.status(200).json({ ok: true, items: result.items });
}
