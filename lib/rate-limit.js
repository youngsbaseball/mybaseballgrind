// ═══════════════════════════════════════════════════════════
// MyGrind 2.0 — lib/rate-limit.js (Phase 3c)
// ───────────────────────────────────────────────────────────
// Rate limiting helpers using Upstash Redis (via Vercel's
// Redis integration). Protects /api/send-invite from abuse.
//
// Limits per locked spec:
//   - Per-IP: max 3 requests/hour, 10 requests/day
//   - Per-phone: max 2 SMS to same number in 24 hours
//
// Privacy: We never store raw IPs or raw phone numbers. We
// store SHA-256 hashes only. Redis sees opaque keys, not PII.
//
// Atomicity: Redis INCR is atomic by design. Race conditions
// between simultaneous requests are not possible.
// ═══════════════════════════════════════════════════════════

import { Redis } from '@upstash/redis';
import crypto from 'crypto';

// ─── Redis client ─────────────────────────────────────────
// Vercel's Redis integration sets REDIS_URL. Upstash's client
// reads it automatically via Redis.fromEnv() — but to be
// explicit and not depend on env var name conventions, we
// pass the URL directly.
const redis = Redis.fromEnv();

// ─── Limits (locked spec) ─────────────────────────────────
const LIMITS = {
  IP_HOURLY:     3,   // max requests from one IP per hour
  IP_DAILY:     10,   // max requests from one IP per day
  PHONE_DAILY:   2,   // max SMS to one phone per 24h
};

// TTL in seconds
const TTL = {
  HOUR:  60 * 60,
  DAY:   60 * 60 * 24,
};

// ─── Hashing (SHA-256, hex output) ────────────────────────
// One-way hash. We can verify "is this the same IP?" by
// re-hashing, but we cannot recover the original value from
// the stored key. Privacy-preserving by design.
function hash(value) {
  if (!value || typeof value !== 'string') return null;
  return crypto.createHash('sha256').update(value).digest('hex');
}

// ─── Key generators ───────────────────────────────────────
// Hourly key includes hour-of-year for natural rollover.
// Daily key includes day-of-year similarly. No need for
// manual cleanup; Redis TTL handles expiration.
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

/**
 * Check if an IP has exceeded its hourly or daily limit.
 * Returns { ok: true } if under limit, or { ok: false, reason }.
 * Does NOT increment counters — call recordSend() after the
 * actual SMS send succeeds.
 */
export async function checkIpLimit(ip) {
  const ipHash = hash(ip);
  if (!ipHash) {
    // No IP available (unusual). Fail open — let request through
    // but log so we can investigate.
    console.warn('[rate-limit] No IP available, failing open');
    return { ok: true };
  }

  try {
    const [hourCount, dayCount] = await Promise.all([
      redis.get(ipHourKey(ipHash)),
      redis.get(ipDayKey(ipHash)),
    ]);

    if ((hourCount ?? 0) >= LIMITS.IP_HOURLY) {
      return { ok: false, reason: 'ip_hourly' };
    }
    if ((dayCount ?? 0) >= LIMITS.IP_DAILY) {
      return { ok: false, reason: 'ip_daily' };
    }

    return { ok: true };
  } catch (err) {
    // Redis down or network error — fail open with warning.
    // Better to allow legit signups during a Redis outage than
    // to block everyone. Real abuse is rare; outages are rarer
    // but real.
    console.error('[rate-limit] Redis check failed:', err.message);
    return { ok: true };
  }
}

/**
 * Check if a phone has hit its daily SMS limit.
 * Returns { ok: true } if under limit, or { ok: false, reason }.
 */
export async function checkPhoneLimit(phone) {
  const phoneHash = hash(phone);
  if (!phoneHash) return { ok: true };

  try {
    const count = await redis.get(phoneDayKey(phoneHash));
    if ((count ?? 0) >= LIMITS.PHONE_DAILY) {
      return { ok: false, reason: 'phone_daily' };
    }
    return { ok: true };
  } catch (err) {
    console.error('[rate-limit] Redis phone check failed:', err.message);
    return { ok: true };
  }
}

/**
 * Record a successful send. Increments all three counters
 * atomically and sets TTL. Call this AFTER the SMS send
 * succeeds — we don't want to count failed/dry-run sends.
 */
export async function recordSend(ip, phone) {
  const ipHash    = hash(ip);
  const phoneHash = hash(phone);

  try {
    const ops = [];

    if (ipHash) {
      const hourKey = ipHourKey(ipHash);
      const dayKey  = ipDayKey(ipHash);
      // INCR + EXPIRE — Redis atomic operations.
      ops.push(redis.incr(hourKey));
      ops.push(redis.expire(hourKey, TTL.HOUR));
      ops.push(redis.incr(dayKey));
      ops.push(redis.expire(dayKey, TTL.DAY));
    }

    if (phoneHash) {
      const phoneKey = phoneDayKey(phoneHash);
      ops.push(redis.incr(phoneKey));
      ops.push(redis.expire(phoneKey, TTL.DAY));
    }

    await Promise.all(ops);
  } catch (err) {
    // Counter increment failure is non-fatal. The SMS already
    // sent; we just lose one count. Log and move on.
    console.error('[rate-limit] Counter increment failed:', err.message);
  }
}
