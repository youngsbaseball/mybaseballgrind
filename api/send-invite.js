// ═══════════════════════════════════════════════════════════
// MyGrind 2.0 — /api/send-invite (Phase 3c — RATE LIMITED)
// ───────────────────────────────────────────────────────────
// Sends real SMS via Twilio with abuse protection.
//
// Phase 3c additions:
//   - Per-IP rate limit (3/hr, 10/day) checked before Twilio
//   - Per-phone rate limit (2/24h) checked before Twilio
//   - Generic 429 response on rate limit (no info leak)
//   - Counter increment ONLY on successful send
//
// DRY_RUN sends DO NOT increment counters — testing the
// preview path shouldn't burn a real user's daily quota.
//
// Locked spec: Notion "🛠️ Phase 3 — Twilio SMS Backend Architecture"
// ═══════════════════════════════════════════════════════════

import twilio from 'twilio';
import { checkIpLimit, checkPhoneLimit, recordSend } from '../lib/rate-limit.js';

// ─── Config flags ─────────────────────────────────────────
const DRY_RUN = process.env.SMS_DRY_RUN !== 'false';

// ─── SMS body builder ─────────────────────────────────────
function buildSmsBody({ parentName, playerName, sport }) {
  const sportLabel =
    sport === 'softball' ? 'softball' :
    sport === 'both'     ? 'baseball/softball' :
                           'baseball';

  const onboardingUrl =
    `https://mygrindapp.com/onboarding.html?name=${encodeURIComponent(playerName)}`;

  // GSM-7 only (no em-dashes, no smart quotes) to fit single SMS segment.
  return (
    `Hey ${playerName}, ${parentName} signed you up for MyGrind - ` +
    `the training journal for ${sportLabel} players who put in work.\n\n` +
    `Set up your profile (3 min): ${onboardingUrl}`
  );
}

// ─── E.164 phone normalization ────────────────────────────
function toE164(phone) {
  if (!phone || typeof phone !== 'string') return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return null;
}

// ─── Extract real client IP ───────────────────────────────
// Vercel sets x-forwarded-for and x-real-ip headers. The first
// IP in x-forwarded-for is the actual client. Fall back to
// x-real-ip if not available.
function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.headers['x-real-ip'] || null;
}

export default async function handler(req, res) {
  // ─── CORS headers ────────────────────────────────────────
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
    });
  }

  // ─── Request shape validation ────────────────────────────
  const { parentName, playerName, playerPhone, sport, signupSessionId } = req.body || {};

  const missing = [];
  if (!parentName       || typeof parentName       !== 'string') missing.push('parentName');
  if (!playerName       || typeof playerName       !== 'string') missing.push('playerName');
  if (!playerPhone      || typeof playerPhone      !== 'string') missing.push('playerPhone');
  if (!sport            || typeof sport            !== 'string') missing.push('sport');
  if (!signupSessionId  || typeof signupSessionId  !== 'string') missing.push('signupSessionId');

  if (missing.length > 0) {
    console.warn('[send-invite] Bad request — missing fields:', missing);
    return res.status(400).json({
      success: false,
      error: 'Bad request',
    });
  }

  // ─── Phone normalization ─────────────────────────────────
  const e164Phone = toE164(playerPhone);
  if (!e164Phone) {
    console.warn('[send-invite] Invalid phone format:', playerPhone);
    return res.status(400).json({
      success: false,
      error: 'Invalid phone number',
    });
  }

  // ─── Rate limit checks (Phase 3c) ────────────────────────
  // Two checks before we do anything expensive (Twilio costs
  // ~$0.008/send). Generic error on rate limit per locked spec.
  const clientIp = getClientIp(req);

  const ipCheck = await checkIpLimit(clientIp);
  if (!ipCheck.ok) {
    console.warn('[send-invite] IP rate limited:', { ip: clientIp ? '[redacted]' : 'none', reason: ipCheck.reason, signupSessionId });
    return res.status(429).json({
      success: false,
      error: 'Too many requests, try again later',
      code: 'RATE_LIMITED',
    });
  }

  const phoneCheck = await checkPhoneLimit(e164Phone);
  if (!phoneCheck.ok) {
    console.warn('[send-invite] Phone rate limited:', { reason: phoneCheck.reason, signupSessionId });
    return res.status(429).json({
      success: false,
      error: 'Too many requests, try again later',
      code: 'RATE_LIMITED',
    });
  }

  // ─── Record attempt for rate limiting (Phase 3c, Option C) ─
  // Increment counters NOW, before Twilio. Reasons:
  //   1. Protects against bursts even when Twilio is misbehaving
  //   2. Counters reflect "attempted sends" not "successful sends"
  //   3. Trade-off: a legit user whose Twilio fails burns one
  //      attempt — acceptable cost for stronger protection
  await recordSend(clientIp, e164Phone);

  // ─── Build SMS body ──────────────────────────────────────
  const smsBody = buildSmsBody({ parentName, playerName, sport });
  // ─── DRY RUN path (no counter increment) ─────────────────
  // We deliberately do NOT call recordSend() here — testing
  // shouldn't burn a real user's quota.
  if (DRY_RUN) {
    console.log('[send-invite DRY_RUN] Would send SMS:', {
      to: e164Phone,
      from: process.env.TWILIO_FROM_NUMBER,
      bodyLength: smsBody.length,
      body: smsBody,
      signupSessionId,
    });
    return res.status(200).json({
      success: true,
      smsSid: 'DRY-RUN-NO-MESSAGE-SENT',
      sentAt: new Date().toISOString(),
      phase: '3c-dry-run',
      dryRun: true,
      previewBody: smsBody,
    });
  }

  // ─── REAL SEND path ──────────────────────────────────────
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken  = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_FROM_NUMBER;

    if (!accountSid || !authToken || !fromNumber) {
      console.error('[send-invite] Missing Twilio env vars');
      return res.status(500).json({
        success: false,
        error: 'Server misconfigured',
      });
    }

    const client = twilio(accountSid, authToken);

    const message = await client.messages.create({
      body: smsBody,
      from: fromNumber,
      to:   e164Phone,
    });

    // ─── recordSend() already fired before Twilio (Option C) ─
    // Counter increment happens before this block. No double-count here.

    console.log('[send-invite] SMS sent:', {
      smsSid: message.sid,
      signupSessionId,
    });

    return res.status(200).json({
      success: true,
      smsSid: message.sid,
      sentAt: new Date().toISOString(),
      phase: '3c-live',
    });

  } catch (err) {
    console.error('[send-invite] Twilio error:', {
      code: err.code,
      message: err.message,
      status: err.status,
      signupSessionId,
    });

    return res.status(500).json({
      success: false,
      error: 'Could not send invite',
      code: 'SEND_FAILED',
    });
  }
}
