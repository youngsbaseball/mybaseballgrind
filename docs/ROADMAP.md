# 🛣️ My Grind — Roadmap

*Re-prioritize this file at the start of every week. Move shipped items to STATUS.md.*

---

## 🔥 This Week (pick 1 per session)

### P0 — Stability & Safety (do these FIRST)
1. **Re-add data-wipe safety fix** — `saveState()` catch block. Without this, users hitting localStorage quota silently lose all entries. ~10 min.
2. **Re-add backup nudge** — auto-prompt to back up after 3+ entries / 7+ days. ~15 min.
3. **Disable broken GameChanger screenshot button** — runtime patch via DOM. ~5 min.

### P1 — Polish (after P0)
4. **Investigate "hover" issue** — user reported can't hover at top of something. Need screenshot. Then fix. ~15 min.
5. **Investigate "softball image where baseball should be"** — need screenshot. ~15 min.
6. **Title fallback for Instructor entries** — currently saves as "Entry" if title is hidden. Should auto-fill from instructor name + focus. ~10 min.

---

## 📅 Next 2 Weeks

### P2 — Real-time Cloud Sync (Phase B v3)
Third attempt at auto-sync. The first two attempts caused full UI breakage. **Do this only after P0 + P1 done AND you have a clear test plan.**

Key lesson from past attempts: don't add a full-screen overlay that can become unclickable. Use a non-blocking pattern.

### P3 — Discoverability ("Why isn't anyone using this?")
If beta users aren't logging entries daily, fix the onramp:
- First-run tour (3 quick screens explaining the app)
- Simpler dashboard for new users ("start here" card)
- Clearer call-to-action on the trial signup

### P4 — Marketing Site
The app at `youngsbaseball.github.io/mybaseballgrind` is the APP, but you need a SEPARATE marketing landing page that explains what My Grind is and gets people to try it. Consider:
- A simple one-pager at `mygrindbaseball.com` (your Namecheap domain)
- Hosted free on Netlify or Vercel
- Just a hero, 3 features, testimonials, signup CTA

---

## 🌅 Future / Maybe

- Push notifications (real lock-screen pushes — requires Firebase Cloud Functions, $25/mo)
- Multi-player accounts (one parent buys, multiple kids use)
- Coach dashboard — see all players' progress in one view
- Photo/video attachments (currently disabled, needs cloud storage)
- GameChanger import (currently broken — needs a backend proxy for the API call)
- MaxPreps integration (waiting on API access)
- Affirmation push notifications via SMS (Twilio integration)
- Internationalization (Spanish version for the Latino baseball community)

---

## 🐛 Bugs / User Feedback

*When a beta user reports something, jot it here with date and source.*

- (none yet — start logging when reports come in)

---

## ✅ Recently Shipped (last 7 days)

*Move shipped items here from "This Week" so you have a record of progress.*

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
