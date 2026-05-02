// ═══════════════════════════════════════════════════════════
// MyGrind 2.0 — lib/lookup.js (Phase 3d)
// ───────────────────────────────────────────────────────────
// Twilio Lookup v2 pre-check. Verifies a phone number is valid
// and reachable (mobile or personal line) BEFORE we increment
// rate-limit counters or attempt an SMS send.
//
// Why: parents fat-finger numbers, type their own landline by
// mistake, or paste in a Google Voice number. Catching these
// up front avoids wasting our rate-limit budget AND a paid
// SMS send on a number that can't receive texts anyway.
//
// Cost: Twilio Lookup with line_type_intelligence is ~$0.005
// per call. Bounded by upstream rate limits (3/hr per IP,
// 2/24h per phone), so cost ceiling is roughly $0.04/day
// per active IP.
//
// Fail-open: any Twilio Lookup error (network, bad creds,
// quota) returns ok:true so a Twilio outage doesn't take
// down signups. Better to attempt the send than block.
//
// Override: SKIP_LOOKUP=true bypasses lookup entirely (useful
// for local dev where you don't want to burn lookup credits).
// ═══════════════════════════════════════════════════════════

import twilio from 'twilio';

// Reuse a single Twilio client across warm invocations to avoid
// reconnecting per request — same pattern as the rate-limit Redis
// singleton.
let twilioClient = null;

function getTwilioClient() {
  if (twilioClient) return twilioClient;
  const sid   = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;
  twilioClient = twilio(sid, token);
  return twilioClient;
}

// Line types Twilio considers safe to text (mobile-style).
// Anything else (landline, voip, tollFree, premium, etc.) gets
// a user-facing rejection so the parent can correct the number.
const ALLOWED_TYPES = new Set(['mobile', 'personal']);

/**
 * Verify a phone number with Twilio Lookup v2.
 * @param {string} phoneE164 - Phone in E.164 (+15551234567)
 * @returns {Promise<{ok: boolean, type?: string, reason?: string, message?: string, skipped?: string}>}
 */
export async function lookupPhone(phoneE164) {
  // Dev / test override
  if (process.env.SKIP_LOOKUP === 'true') {
    return { ok: true, skipped: 'env_skip' };
  }

  const client = getTwilioClient();
  if (!client) {
    // No creds configured — fail-open and let the send path surface
    // the misconfig if it tries to send. Lookup not blocking signups.
    console.warn('[lookup] No Twilio creds — skipping lookup, failing open');
    return { ok: true, skipped: 'no_creds' };
  }

  try {
    const result = await client.lookups.v2
      .phoneNumbers(phoneE164)
      .fetch({ fields: 'line_type_intelligence' });

    if (result.valid === false) {
      return {
        ok: false,
        reason: 'invalid_number',
        message: "That phone number doesn't look right. Please double-check and try again.",
      };
    }

    const type = result.lineTypeIntelligence && result.lineTypeIntelligence.type;

    // If Twilio couldn't determine the line type, allow through —
    // we'd rather attempt the send than reject a valid mobile.
    if (!type) return { ok: true, type: 'unknown' };

    if (ALLOWED_TYPES.has(type)) return { ok: true, type };

    if (type === 'landline') {
      return {
        ok: false,
        reason: 'landline',
        message: "That looks like a landline — we can only text mobile numbers. Please use your player's mobile number.",
      };
    }

    if (type === 'fixedVoip' || type === 'nonFixedVoip') {
      return {
        ok: false,
        reason: 'voip',
        message: "That looks like a VoIP number (Google Voice, app-based line). We need a real mobile number so the invite text actually reaches your player.",
      };
    }

    if (type === 'tollFree' || type === 'premium' || type === 'sharedCost' || type === 'uan') {
      return {
        ok: false,
        reason: 'unsupported_type',
        message: "That number type isn't supported for player invites. Please use a standard mobile number.",
      };
    }

    // Any other type Twilio adds in the future — be permissive,
    // log it so we notice, but allow the send through.
    console.warn('[lookup] Unrecognized line type, allowing:', type);
    return { ok: true, type };

  } catch (err) {
    // Lookup itself failed — fail-open with a warning so a Twilio
    // outage doesn't kill signups. The send path will hit the same
    // outage and return its own error if needed.
    console.warn('[lookup] Twilio Lookup failed (fail-open):', err.message, err.code || '');
    return { ok: true, skipped: 'lookup_error' };
  }
}
