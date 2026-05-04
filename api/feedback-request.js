// ═══════════════════════════════════════════════════════════
// Phase 7b V1 — Player submits a feedback request to a coach.
// Stores it in Redis, then sends an SMS magic link to the coach.
// SMS falls back to the email path automatically when Twilio is
// in DRY_RUN mode (TFV not yet approved) — magic link still gets
// generated and persisted, so the player's outbox stays accurate.
// ═══════════════════════════════════════════════════════════

import twilio from 'twilio';
import { createRequest } from '../lib/feedback-store.js';

const ALLOWED_ORIGINS = new Set([
  'https://www.mygrindapp.com',
  'https://mygrindapp.com',
]);

const DRY_RUN = process.env.SMS_DRY_RUN !== 'false';
const APP_BASE = 'https://www.mygrindapp.com';

function setCors(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function buildCoachSms({ playerName, focus, situation, note, link }) {
  // Keep under 320 chars so it stays as a single GSM-7 segment
  const trimmedNote = note.length > 80 ? note.slice(0, 80) + '…' : note;
  return (
    'MyGrind: ' + playerName + ' has a question (' + focus + ' / ' + situation + ').\n\n' +
    '"' + trimmedNote + '"\n\n' +
    'Tap to respond: ' + link
  );
}

async function sendSmsViaTwilio(toPhone, body) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken  = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;

  if (DRY_RUN) {
    console.log('[feedback-request DRY_RUN] Would SMS coach:', { to: toPhone, body });
    return { ok: true, dryRun: true };
  }
  if (!accountSid || !authToken || !fromNumber) {
    console.error('[feedback-request] Missing Twilio env vars');
    return { ok: false, error: 'twilio_unconfigured' };
  }
  try {
    const client = twilio(accountSid, authToken);
    const msg = await client.messages.create({ body, from: fromNumber, to: toPhone });
    return { ok: true, sid: msg.sid };
  } catch (e) {
    console.error('[feedback-request] Twilio send failed:', e.message);
    return { ok: false, error: 'twilio_send_failed' };
  }
}

function toE164(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length === 10) return '+1' + digits;
  if (digits.length === 11 && digits.startsWith('1')) return '+' + digits;
  return null;
}

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')    return res.status(405).json({ ok: false, error: 'method_not_allowed' });

  const body = req.body || {};
  const { playerName, playerPhone, parentName, parentEmail,
          coachName, coachEmail, coachPhone,
          focus, situation, note, sport } = body;

  if (!playerName || !coachName || !focus || !situation || !note) {
    return res.status(400).json({ ok: false, error: 'missing_fields' });
  }
  if (!coachEmail && !coachPhone) {
    return res.status(400).json({ ok: false, error: 'coach_contact_required' });
  }

  const created = await createRequest({
    playerName, playerPhone, parentName, parentEmail,
    coachName, coachEmail, coachPhone,
    focus, situation, note: String(note).slice(0, 280), sport
  });
  if (!created.ok) return res.status(500).json(created);

  const link = APP_BASE + '/coach-reply.html?req=' + created.id + '&t=' + created.token;
  const smsBody = buildCoachSms({ playerName, focus, situation, note, link });

  // SMS first if we have a coach phone
  let notifySent = false;
  let notifyChannel = 'none';
  const coachE164 = toE164(coachPhone);
  if (coachE164) {
    const sms = await sendSmsViaTwilio(coachE164, smsBody);
    if (sms.ok) { notifySent = true; notifyChannel = 'sms' + (sms.dryRun ? '-dryrun' : ''); }
  }

  // No fallback delivery in V1 server-side — if no SMS, the player's app
  // shows them the magic link to share manually with the coach. Email
  // fanout for V1.5 will plug in here without changing the API surface.

  return res.status(200).json({
    ok: true,
    id: created.id,
    link,
    notify: { sent: notifySent, channel: notifyChannel }
  });
}
