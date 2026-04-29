// ═══════════════════════════════════════════════════════════
// MyGrind 2.0 — /api/send-invite (Phase 3a SKELETON)
// ───────────────────────────────────────────────────────────
// This is the SMS invite endpoint that signup.html will call
// after the parent confirms their player's phone number.
//
// ⚠️ Phase 3a state: SKELETON ONLY.
//    - Validates request shape
//    - Returns fake success
//    - Does NOT send real SMS (Phase 3b wires Twilio SDK)
//    - Does NOT rate-limit (Phase 3c adds Vercel KV)
//    - Does NOT pre-check via Twilio Lookup (Phase 3d)
//
// Locked architectural decisions live in the Notion spec
// "🛠️ Phase 3 — Twilio SMS Backend Architecture".
// ═══════════════════════════════════════════════════════════

export default async function handler(req, res) {
  // ─── CORS headers ────────────────────────────────────────
  // Allow signup.html on mygrindapp.com (and the GitHub Pages
  // staging URL) to call this endpoint. Wildcard for now in
  // skeleton; will tighten to specific origins in Phase 3f.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight CORS (browsers send OPTIONS before POST
  // when calling cross-origin)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // ─── Method enforcement ──────────────────────────────────
  // Reject anything that isn't POST. Per the locked phone
  // defenses spec: don't reveal too much in error messages.
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
    });
  }

  // ─── Request shape validation ────────────────────────────
  // Accept JSON body. Vercel parses it automatically when
  // Content-Type is application/json.
  const { parentName, playerName, playerPhone, sport, signupSessionId } = req.body || {};

  // All five fields must be present and non-empty strings.
  // Generic error to client (locked spec — don't tell abusers
  // exactly which field tripped which rule).
  const missing = [];
  if (!parentName       || typeof parentName       !== 'string') missing.push('parentName');
  if (!playerName       || typeof playerName       !== 'string') missing.push('playerName');
  if (!playerPhone      || typeof playerPhone      !== 'string') missing.push('playerPhone');
  if (!sport            || typeof sport            !== 'string') missing.push('sport');
  if (!signupSessionId  || typeof signupSessionId  !== 'string') missing.push('signupSessionId');

  if (missing.length > 0) {
    // Server-side log keeps the detail for debugging; client
    // gets a generic message.
    console.warn('[send-invite] Bad request — missing fields:', missing);
    return res.status(400).json({
      success: false,
      error: 'Bad request',
    });
  }

  // ─── PHASE 3a stops here ────────────────────────────────
  // Phase 3b will: import Twilio SDK, send real SMS,
  // capture smsSid from Twilio response.
  // Phase 3c will: rate-limit checks via Vercel KV.
  // Phase 3d will: Twilio Lookup pre-check.
  //
  // For now, log the would-be-sent and return a stub.
  console.log('[send-invite SKELETON] Would send to:', {
    parentName, playerName, sport, signupSessionId,
    // playerPhone deliberately not logged — even hashed
    // logging waits for the proper logger in Phase 3c
  });

  return res.status(200).json({
    success:   true,
    smsSid:    'SKELETON-NOT-A-REAL-MESSAGE',
    sentAt:    new Date().toISOString(),
    phase:     '3a-skeleton',
  });
}
