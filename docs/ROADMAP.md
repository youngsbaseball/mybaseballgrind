# 🛣️ My Grind — Roadmap

*Re-prioritize this file at the start of every week. Move shipped items to the bottom and into STATUS.md.*

---

## 🔥 This Week (pick 1 per session)

### P0 — Polish leftover from the audit
1. **Fix duplicate `escapeHtml()` in `signup.html`** — defined at lines 3264 + 3417. Consolidate to one definition. ~5 min.
2. **Fix the SMS preview URL in `signup.html`** — `buildSmsForPlayer()` (line ~3344) hardcodes `mygrind.app/start/abc123`. Should use `mygrindapp.com/onboarding.html?name=...` so the preview matches what Twilio will actually send when Phase 3b unblocks. ~10 min.
<!-- Phase 6 placeholder buttons fixed 2026-05-02 — Share + Settings now open real modals. -->

### P1 — Real-user walks (per CLAUDE.md verification protocol)
4. **Walk every screen of `signup.html` on phone width** — confirm progress dots, validation, back-nav, and SMS preview all behave end-to-end after recent edits.
5. **Walk every screen of `onboarding.html` on phone width** — verify the CSS-corruption fix from 2026-05-02 actually restored sticky progress bar + min-height layout. Especially S0 → S05 (PIN) → S1 → S14 path.
6. **Investigate "hover" issue** — user reported can't hover at top of something on Daily Journal. Need screenshot. Then fix. ~15 min.
7. **Investigate "softball image where baseball should be"** — need screenshot. ~15 min.
8. **Title fallback for Instructor entries** — currently saves as "Entry" if title is hidden. Should auto-fill from instructor name + focus. ~10 min.

---

## 📅 Next 2 Weeks

### P2 — Phase 5 (Stripe wiring on signup)
The signup flow's `selectPlan()`, `onSkipTrialClicked()`, and Screen 8 "Pay & Continue" hooks all currently `alert()` instead of launching Stripe checkout. Replace with real `buy.stripe.com` URLs (already used in `softball.html`). Highest revenue-unlock lever.

### P3 — Phase 5 (Stripe wiring on signup)
The signup flow's `selectPlan()`, `onSkipTrialClicked()`, and Screen 8 "Pay & Continue" hooks all currently `alert()` instead of launching Stripe checkout. Replace with real `buy.stripe.com` URLs (already used in `softball.html`).

<!-- P4 — Phase 6 SHIPPED 2026-05-02. See "Recently Shipped" below. -->

### P4 — Phase 5 follow-up: full account-edit Settings
Once Phase 5 wires Stripe + backend account management, upgrade the Settings modal from read-only to support inline email/phone updates and a billing-portal link. Currently the modal points users at coach@mygrindapp.com for changes.

### P5 — Phase 7 (Player dashboard)
`onboarding.html` S14 currently shows a holding-screen overlay. Phase 7 is the real player dashboard — likely a stripped-down `softball.html` for the kid side or a new `player-dashboard.html`.

### P6 — Real-time Cloud Sync (Phase B v3)
Third attempt at auto-sync. The first two attempts caused full UI breakage in `softball.html`. **Do this only after P1 done AND with a clear test plan.** Key lesson: don't add a full-screen overlay that can become unclickable. Use a non-blocking pattern.

### P7 — Discoverability ("Why isn't anyone using this?")
If beta users aren't logging entries daily:
- First-run tour (3 quick screens explaining the app)
- Simpler dashboard for new users ("start here" card)
- Clearer call-to-action on the trial signup

---

## 🌅 Future / Maybe

- Push notifications (real lock-screen pushes — requires Firebase Cloud Functions, $25/mo)
- Multi-player accounts (one parent buys, multiple kids use)
- Coach dashboard — see all players' progress in one view
- Photo/video attachments (currently disabled, needs cloud storage)
- GameChanger import via backend proxy (Option 1 currently disabled — Anthropic API blocked by browser CORS, needs server-side endpoint)
- MaxPreps integration (waiting on API access)
- Affirmation push notifications via SMS (Twilio integration)
- Internationalization (Spanish version for the Latino baseball community)

---

## 🐛 Bugs / User Feedback

*When a beta user reports something, jot it here with date and source.*

- (none new yet — start logging when reports come in)

---

## ✅ Recently Shipped (last 7 days)

*Move shipped items here from "This Week" so you have a record of progress.*

### 2026-05-02
- ✅ **Phase 6 — Real Share + Settings modals on signup dashboard** — replaced the two `alert('coming in Phase 6')` placeholders on Screen 8 with proper modals reusing the existing `.phone-confirm-overlay` shell. Share modal has a copy-link button (Clipboard API + execCommand fallback), a Web Share API "Share…" button shown only on supporting browsers, and a pre-written share caption. Settings modal shows read-only account summary (name, email, phone, plan, players) populated from `state.parent` + `state.preferredPlan` + `state.playerCount`, plus a `mailto:coach@mygrindapp.com` link for change requests until Phase 5 wires backend editing.
- ✅ **Phase 3d — Twilio Lookup pre-check** — new `lib/lookup.js` module + integration in `api/send-invite.js`. Calls Twilio Lookup v2 with `line_type_intelligence` between E.164 normalization and rate-limit checks. Rejects invalid numbers, landlines, and VoIP with friendly user-facing messages before burning rate-limit budget or paid SMS sends. Fail-open on Lookup outage. `SKIP_LOOKUP=true` env override for dev. Cost ~$0.005/lookup, bounded by upstream rate limits.
- ✅ **Pre-launch waitlist landing page** at `mygrindapp.com` — brand-styled `index.html` with Mailchimp form (audience `73280b4c02e9bc56c7e633892`, tag `2216797`). Replaced the old redirect shell that bounced visitors to signup.html.
- ✅ **Mailchimp JSONP integration** — replaced optimistic iframe submit with real `subscribe/post-json` call so users see actual success/error messages instead of silent failures.
- ✅ **Mobile sizing fixes for landing** — compact email input (34px tall), narrower form card on portrait, landscape media query, vertical centering with `safe center`, iOS Safari rotation-zoom fix via `maximum-scale=1`.
- ✅ **Disabled Mailchimp reCAPTCHA on the form** so JSONP path doesn't bounce real users into a challenge that can't render.
- ✅ **Critical CSS corruption fix in `onboarding.html`** — `.screen`, `.screen.on`, `.screen-body`, `.prog-wrap` rules had nested braces and orphan property remnants from a prior find/replace incident. Restored intended layout.
- ✅ **`saveState()` data-wipe killed** in `softball.html` — the catch block was silently writing `entries: []` on quota errors. Now leaves previous save intact and surfaces a one-time alert pointing to backup.
- ✅ **GameChanger Option 1 disabled** — the screenshot reader called Anthropic API directly from the browser (CORS-blocked, no key). Replaced with "Coming Soon" notice pointing to Option 2 (manual entry).
- ✅ **Backup & Restore feature re-shipped** in `softball.html` Settings tab — JSON download/upload of all `ybg_*` keys (auth/session keys denylisted). Includes "last backup: X days ago" display.
- ✅ **Backup nudge re-shipped** — non-blocking gold banner appears on app load when user has 3+ entries AND no backup in 7+ days. Dismissable for the session.
- ✅ **Brand system doc** at `docs/BRAND_SYSTEM.md` documenting design tokens for future MyGrind web surfaces.
- ✅ **`media/` folder** added for launch graphics + social assets.
- ✅ **STATUS.md + ROADMAP.md rewritten** to reflect current architecture (signup/onboarding/softball/landing) instead of the old single-file index.html state.

### Earlier (rolled into this list when I clean up)
- ✅ Tab reorder (daily-use features up front)
- ✅ Instructor Session log in Daily Journal
- ✅ Daily affirmation banner (60 affirmations rotating)
- ✅ Instructor as entry type (focused form when selected)
- ✅ Universal "NO GRADES · NO GAME" banner (sport-neutral)
- ✅ Pink palette for softball mode
- ✅ 20 softball-specific quotes
- ✅ Custom academic classes
- ✅ Cloud backup (manual Save to Cloud)
- ✅ Sport selector on trial signup
