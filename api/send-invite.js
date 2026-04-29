// ═══════════════════════════════════════════════════════════
// MyGrind 2.0 — /api/send-invite (Phase 3b — TWILIO WIRED)
// ───────────────────────────────────────────────────────────
// Sends real SMS via Twilio. Per Coach Young April 28 evening
// decision: starts in DRY_RUN=true mode. Set DRY_RUN=false (or
// set env var SMS_DRY_RUN=false) when ready to send real SMS.
//
// ⚠️ Phase 3b state:
//    - Twilio SDK wired
//    - DRY RUN mode active by default (logs the SMS, does NOT send)
//    - Real SMS send path also exists, gated by env var
//    - No rate limiting yet (Phase 3c)
//    - No Twilio Lookup pre-check yet (Phase 3d)
//
// Locked spec: Notion "🛠️ Phase 3 — Twilio SMS Backend Architecture"
// ═══════════════════════════════════════════════════════════

import twilio from 'twilio';

// ─── Config flags ─────────────────────────────────────────
// DRY_RUN: when true, the endpoint builds and logs the SMS
// body but does NOT actually call Twilio. Used for safe
// verification of copy + request handling before paying for
// real sends.
//
// Set Vercel env var SMS_DRY_RUN=false to flip to real sends.
// Default is DRY RUN if env var is not set or is anything
// other than the literal string "false".
const DRY_RUN = process.env.SMS_DRY_RUN !== 'false';

// ─── SMS body builder ─────────────────────────────────────
// MYGRIND voice (per Decision #10 evolution — Coach Young
// absent from product surface). Sport-aware language.
function buildSmsBody({ parentName, playerName, sport }) {
  // Sport label that fits the SMS sentence naturally
  const sportLabel =
    sport === 'softball' ? 'softball' :
    sport === 'both'     ? 'baseball/softball' :
                           'baseball';

  const onboardingUrl =
    `https://mygrindapp.com/onboarding.html?name=${encodeURIComponent(playerName)}`;

  return (
    `Hey ${playerName}, ${parentName} just signed you up for MyGrind ` +
    `— the training journal for ${sportLabel} players who put in the work.\n\n` +
    `Tap to set up your profile (3 min): ${onboardingUrl}\n\n` +
    `— MyGrind`
  );
}

// ─── E.164 phone normalization ────────────────────────────
// Twilio requires E.164 format (+15551234567). Parents type
// formatted numbers like "(555) 123-4567" — we normalize.
function toE164(phone) {
  if (!phone || typeof phone !== 'string') return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return null; // anything else is invalid for US
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

  // ─── Build SMS body ──────────────────────────────────────
  const smsBody = buildSmsBody({ parentName, playerName, sport });

  // ─── DRY RUN path ────────────────────────────────────────
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
      phase: '3b-dry-run',
      dryRun: true,
      previewBody: smsBody,
    });
  }

  // ─── REAL SEND path (only when SMS_DRY_RUN=false) ───────
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

    console.log('[send-invite] SMS sent:', {
      smsSid: message.sid,
      to: e164Phone,
      signupSessionId,
    });

    return res.status(200).json({
      success: true,
      smsSid: message.sid,
      sentAt: new Date().toISOString(),
      phase: '3b-live',
    });

  } catch (err) {
    // Twilio errors have a `code` and `message` field
    console.error('[send-invite] Twilio error:', {
      code: err.code,
      message: err.message,
      status: err.status,
      signupSessionId,
    });

    // Generic error to client (locked spec — don't reveal which defense triggered)
    return res.status(500).json({
      success: false,
      error: 'Could not send invite',
      code: 'SEND_FAILED',
    });
  }
}
