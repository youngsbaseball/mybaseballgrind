// ═══════════════════════════════════════════════════════════
// MyGrind 2.0 — lib/rate-limit.js (Phase 3c, ioredis edition)
// ───────────────────────────────────────────────────────────
// Rate limiting helpers using ioredis (standard Node Redis
// client). Connects to Vercel's Redis Cloud integration via
// the REDIS_URL env var.
//
// Limits per locked spec:
//   - Per-IP: max 3 requests/hour, 10 requests/day
//   - Per-phone: max 2 SMS to same number in 24 hours
//
// Privacy: We never store raw IPs or raw phone numbers. We
// store SHA-256 hashes only. Redis sees opaque keys, not PII.
//
// Fail-open: If Redis is unreachable, we let the request
// through with a warning log. Better to allow legit signups
// during a Redis outage than block everyone.
// ═══════════════════════════════════════════════════════════

import Redis from 'ioredis';
import crypto from 'crypto';

// ─── Redis client ─────────────────────────────────────────
// Singleton pattern — Vercel serverless functions reuse the
// same Node process for warm invocations, so we avoid opening
// a new connection per request.
let redis = null;

function getRedis() {
  if (redis) return redis;

  const url = process.env.REDIS_URL;
  if (!url) {
    console.warn('[rate-limit] REDIS_URL not set');
    return null;
  }

  redis = new Redis(url, {
    // Keep retries low — fail fast and let the rate-limit
    // helpers fail-open rather than holding the request open.
    maxRetriesPerRequest: 1,
    retryStrategy: (times) => (times > 1 ? null : 200),
    // Vercel serverless: connect lazily so module load doesn't
    // hang if Redis is unreachable.
    lazyConnect: false,
    // Optional: short connect timeout
    connectTimeout: 3000,
  });

  redis.on('error', (err) => {
    console.error('[rate-limit] Redis client error:', err.message);
  });

  return redis;
}

// ─── Limits (locked spec) ─────────────────────────────────
const LIMITS = {
  IP_HOURLY:     3,
  IP_DAILY:     10,
  PHONE_DAILY:   2,
};

const TTL = {
  HOUR:  60 * 60,
  DAY:   60 * 60 * 24,
};

// ─── Hashing (SHA-256, hex) ───────────────────────────────
function hash(value) {
  if (!value || typeof value !== 'string') return null;
  return crypto.createHash('sha256').update(value).digest('hex');
}

// ─── Key generators ───────────────────────────────────────
function ipHourKey(ipHash) {
  const hour = Math.floor(Date.now() / (1000 * TTL.HOUR));
  return `rl:ip:hour:${ipHash}:${hour}`;
}

function ipDayKey(ipHash) {
  const day = Math.floor(Date.now() / (1000 * TTL.DAY));
  return `rl:ip:day:${ipHash}:${day}`;
}

function phoneDayKey(phoneHash) {
  const day = Math.floor(Date.now() / (1000 * TTL.DAY));
  return `rl:phone:day:${phoneHash}:${day}`;
}

// ─── Public API ───────────────────────────────────────────

export async function checkIpLimit(ip) {
  const ipHash = hash(ip);
  if (!ipHash) {
    console.warn('[rate-limit] No IP available, failing open');
    return { ok: true };
  }

  const client = getRedis();
  if (!client) return { ok: true };

  try {
    const [hourCount, dayCount] = await Promise.all([
      client.get(ipHourKey(ipHash)),
      client.get(ipDayKey(ipHash)),
    ]);

    if (Number(hourCount ?? 0) >= LIMITS.IP_HOURLY) {
      return { ok: false, reason: 'ip_hourly' };
    }
    if (Number(dayCount ?? 0) >= LIMITS.IP_DAILY) {
      return { ok: false, reason: 'ip_daily' };
    }

    return { ok: true };
  } catch (err) {
    console.error('[rate-limit] Redis IP check failed:', err.message);
    return { ok: true };
  }
}

export async function checkPhoneLimit(phone) {
  const phoneHash = hash(phone);
  if (!phoneHash) return { ok: true };

  const client = getRedis();
  if (!client) return { ok: true };

  try {
    const count = await client.get(phoneDayKey(phoneHash));
    if (Number(count ?? 0) >= LIMITS.PHONE_DAILY) {
      return { ok: false, reason: 'phone_daily' };
    }
    return { ok: true };
  } catch (err) {
    console.error('[rate-limit] Redis phone check failed:', err.message);
    return { ok: true };
  }
}

export async function recordSend(ip, phone) {
  const ipHash    = hash(ip);
  const phoneHash = hash(phone);

  const client = getRedis();
  if (!client) return;

  try {
    // ioredis pipeline batches commands into one round-trip.
    // Each INCR is atomic on the Redis server — concurrent
    // requests can't double-count.
    const pipeline = client.pipeline();

    if (ipHash) {
      const hourKey = ipHourKey(ipHash);
      const dayKey  = ipDayKey(ipHash);
      pipeline.incr(hourKey);
      pipeline.expire(hourKey, TTL.HOUR);
      pipeline.incr(dayKey);
      pipeline.expire(dayKey, TTL.DAY);
    }

    if (phoneHash) {
      const phoneKey = phoneDayKey(phoneHash);
      pipeline.incr(phoneKey);
      pipeline.expire(phoneKey, TTL.DAY);
    }

    await pipeline.exec();
  } catch (err) {
    console.error('[rate-limit] Counter increment failed:', err.message);
  }
}
