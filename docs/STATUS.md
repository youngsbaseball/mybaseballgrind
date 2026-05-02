# 📊 My Grind — Current Status

*Last updated: 2026-05-02. Update this file at the end of every coding session.*

---

## 🌐 The App

- **Live URL**: https://youngsbaseball.github.io/mybaseballgrind/
- **Repo**: https://github.com/youngsbaseball/mybaseballgrind
- **Hosted on**: GitHub Pages (free)
- **Domain (parked, not connected)**: mygrindbaseball.com
- **Cloud backend**: Firebase (`my-grind-b8486`) — Spark plan (free)
- **Tech**: Single-file HTML PWA (~600KB), localStorage + Firestore for sync
- **Active beta users**: ~7

## 🛠️ Tech Decisions

- **One file**: everything is in `index.html` (~10K lines). Easy to deploy, hard to navigate. Keep it for now — refactor only if it becomes blocking.
- **No build step**: edits land directly. Pro: zero infra. Con: no linting, no tests automatically.
- **Service worker cache version**: bump it (`ybg-mygrind-vN`) every time you ship a meaningful update so users get fresh content.

---

## ✅ Features Shipped

### Core (working)
- [x] Daily Journal — log games, practices, reflections
- [x] Game stats with auto-calculated AVG / OBP / SLG / ERA
- [x] Practice rep counter (swings, ground balls, throws, pitches)
- [x] My Stats season totals (auto-populated from journal)
- [x] Goals tracker (3 measurable goals)
- [x] 12-month Training Calendar with weekly prescriptions
- [x] Academics (5 core subjects + custom classes)
- [x] Profile (positions, height, weight, photo, sport)
- [x] Team panel (coaches/players)
- [x] Streak tracking + milestone celebrations
- [x] Daily inspirational quote on Dashboard
- [x] Coach/Parent comment logging on entries
- [x] Instructor Session log (private instruction tracking)
- [x] Instructor as standalone entry type (focused form)
- [x] Daily affirmation banner (60 affirmations, rotates by day-of-year)
- [x] PWA install prompt + offline support
- [x] Backup & Restore (download/upload JSON file)

### Cloud Sync (working)
- [x] Sign in with Google (Firebase Auth)
- [x] Manual "Save to Cloud" / "Restore from Cloud" buttons
- [x] Cross-device data recovery
- [x] Per-user privacy via Firestore rules

### Sport Theming (working)
- [x] Sport picker on trial signup (Baseball / Softball)
- [x] Auto-applies softball theme on signup
- [x] Deep DOM swap: ⚾↔🥎 + Baseball↔Softball everywhere
- [x] Pink color palette for softball mode
- [x] 20 softball-specific quotes (Jennie Finch, Cat Osterman, etc.)
- [x] Universal "NO GRADES · NO GAME" banner (works for both sports)

### Trial / Subscription (working)
- [x] 7-day free trial (auto-starts on signup)
- [x] Email-based access
- [x] Stripe integration
- [x] Team Coach plan ($29.99/yr) and Team Sponsor plan ($300/yr) options

### Tabs (in order)
1. ⚾ Dashboard
2. 📓 Daily Journal
3. 📊 My Stats
4. 🏆 Goals
5. 📚 Academics
6. 📅 Training Calendar
7. 👥 Team
8. 👤 My Profile
9. 📲 Share
10. ⚙️ Settings

---

## 🐛 Known Issues / Followups

*Add discovered bugs to docs/ROADMAP.md. This list is for STABLE issues we've decided to defer.*

- ⚠️ The 3 safety fixes from earlier sessions got ROLLED BACK during a debugging episode and need to be re-added carefully:
  1. Silent data wipe prevention in `saveState()` catch block (currently still wipes entries on quota error)
  2. Backup reminder nudge (auto-prompts users to back up after 3+ entries with no backup)
  3. Disable broken GameChanger screenshot button (currently calls a broken Anthropic API path)
- ⚠️ "Hover" issue on Daily Journal top dropdown reported — needs clarification (no specifics yet)
- ⚠️ Softball image showing where a baseball should — needs screenshot to identify

---

## 📈 Metrics to Track (when you're ready)

- Number of active users (Firebase Auth dashboard)
- Number of daily journal entries created (Firestore queries)
- Cloud-backup adoption % (users with `data.ybg_state` populated)
- Trial → paid conversion rate (Stripe dashboard)

No analytics service is wired up yet. Add Plausible or Posthog when you have time.
