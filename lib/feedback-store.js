// ═══════════════════════════════════════════════════════════
// MyGrind — lib/feedback-store.js (Phase 7b V1)
// ───────────────────────────────────────────────────────────
// Redis-backed storage for the Coach Feedback loop. No Firebase
// dependency — uses the same REDIS_URL that powers rate-limit.js.
//
// Key shape:
//   feedback:req:<id>          → JSON of the request (player → coach)
//   feedback:resp:<id>         → JSON of the response (coach → player)
//   feedback:player:<phone>    → list of req IDs for this player
//   feedback:parent:<email>    → list of req IDs visible to this parent
//
// Magic link security: each request has a server-generated `token`
// (32 hex chars). The coach-reply.html page must POST that token to
// /api/feedback-respond — server validates token before writing.
// Without the token, anyone with a request ID can read but not respond.
//
// TTL: 90 days on every key. Old feedback auto-expires.
// ═══════════════════════════════════════════════════════════

import Redis from 'ioredis';
import crypto from 'crypto';

const TTL_SECONDS = 90 * 24 * 60 * 60; // 90 days

let redis = null;
function getRedis() {
  if (redis) return redis;
  const url = process.env.REDIS_URL;
  if (!url) {
    console.warn('[feedback-store] REDIS_URL not set');
    return null;
  }
  redis = new Redis(url, { maxRetriesPerRequest: 2, enableReadyCheck: false });
  redis.on('error', (e) => console.error('[feedback-store] redis error:', e.message));
  return redis;
}

function newId() {
  return crypto.randomBytes(8).toString('hex');   // 16 hex chars
}
function newToken() {
  return crypto.randomBytes(16).toString('hex');  // 32 hex chars
}
function normalizePhone(p) {
  return (p || '').replace(/\D/g, '');
}
function normalizeEmail(e) {
  return (e || '').trim().toLowerCase();
}

// ─── CREATE A REQUEST (player → coach) ───────────────────
export async function createRequest({
  playerName, playerPhone, parentName, parentEmail,
  coachName, coachEmail, coachPhone,
  focus, situation, note, sport
}) {
  const r = getRedis();
  if (!r) return { ok: false, error: 'storage_unavailable' };

  const id    = newId();
  const token = newToken();
  const now   = new Date().toISOString();

  const record = {
    id, token,
    type: 'request',
    createdAt: now,
    player: { name: playerName || '', phone: normalizePhone(playerPhone) },
    parent: { name: parentName || '', email: normalizeEmail(parentEmail) },
    coach:  { name: coachName  || '', email: normalizeEmail(coachEmail), phone: normalizePhone(coachPhone) },
    focus, situation, note, sport: sport || 'baseball',
    status: 'pending'
  };

  try {
    const key = 'feedback:req:' + id;
    await r.set(key, JSON.stringify(record), 'EX', TTL_SECONDS);

    // Index by player phone + parent email so dashboards can list them
    if (record.player.phone) {
      await r.zadd('feedback:player:' + record.player.phone, Date.now(), id);
      await r.expire('feedback:player:' + record.player.phone, TTL_SECONDS);
    }
    if (record.parent.email) {
      await r.zadd('feedback:parent:' + record.parent.email, Date.now(), id);
      await r.expire('feedback:parent:' + record.parent.email, TTL_SECONDS);
    }

    return { ok: true, id, token, record };
  } catch (e) {
    console.error('[feedback-store] createRequest error:', e.message);
    return { ok: false, error: 'write_failed' };
  }
}

// ─── READ A REQUEST BY ID + TOKEN (coach reply page) ─────
export async function getRequest(id, token) {
  const r = getRedis();
  if (!r) return { ok: false, error: 'storage_unavailable' };
  if (!id) return { ok: false, error: 'missing_id' };

  try {
    const raw = await r.get('feedback:req:' + id);
    if (!raw) return { ok: false, error: 'not_found' };
    const record = JSON.parse(raw);

    // Token validation only required for write-adjacent reads (the coach
    // reply page passes the token; dashboard reads use the player/parent
    // index which doesn't need the token).
    if (token && record.token !== token) return { ok: false, error: 'bad_token' };

    return { ok: true, record };
  } catch (e) {
    console.error('[feedback-store] getRequest error:', e.message);
    return { ok: false, error: 'read_failed' };
  }
}

// ─── ATTACH A RESPONSE (coach submits via reply page) ────
export async function recordResponse(id, token, { chips, comment, coachDisplayName }) {
  const r = getRedis();
  if (!r) return { ok: false, error: 'storage_unavailable' };

  try {
    const raw = await r.get('feedback:req:' + id);
    if (!raw) return { ok: false, error: 'not_found' };
    const record = JSON.parse(raw);

    if (record.token !== token) return { ok: false, error: 'bad_token' };
    if (record.status === 'responded') return { ok: false, error: 'already_responded' };

    record.status = 'responded';
    record.response = {
      chips: Array.isArray(chips) ? chips.slice(0, 6) : [],
      comment: (comment || '').slice(0, 500),
      coachDisplayName: coachDisplayName || record.coach.name || 'Coach',
      respondedAt: new Date().toISOString()
    };

    await r.set('feedback:req:' + id, JSON.stringify(record), 'EX', TTL_SECONDS);
    return { ok: true, record };
  } catch (e) {
    console.error('[feedback-store] recordResponse error:', e.message);
    return { ok: false, error: 'write_failed' };
  }
}

// ─── LIST RECENT REQUESTS BY PLAYER PHONE ────────────────
export async function listForPlayer(phone, { sinceTs } = {}) {
  const r = getRedis();
  if (!r) return { ok: false, error: 'storage_unavailable', items: [] };
  const norm = normalizePhone(phone);
  if (!norm) return { ok: true, items: [] };
  return listFromIndex(r, 'feedback:player:' + norm, sinceTs);
}

// ─── LIST RECENT REQUESTS BY PARENT EMAIL ────────────────
export async function listForParent(email, { sinceTs } = {}) {
  const r = getRedis();
  if (!r) return { ok: false, error: 'storage_unavailable', items: [] };
  const norm = normalizeEmail(email);
  if (!norm) return { ok: true, items: [] };
  return listFromIndex(r, 'feedback:parent:' + norm, sinceTs);
}

async function listFromIndex(r, indexKey, sinceTs) {
  try {
    const min = sinceTs ? sinceTs : '-inf';
    const ids = await r.zrangebyscore(indexKey, min, '+inf');
    if (!ids.length) return { ok: true, items: [] };
    // Newest first
    ids.reverse();
    const items = [];
    for (const id of ids.slice(0, 50)) {
      const raw = await r.get('feedback:req:' + id);
      if (raw) {
        const rec = JSON.parse(raw);
        // Strip the token before returning to the client — it's a secret
        delete rec.token;
        items.push(rec);
      }
    }
    return { ok: true, items };
  } catch (e) {
    console.error('[feedback-store] listFromIndex error:', e.message);
    return { ok: false, error: 'read_failed', items: [] };
  }
}
