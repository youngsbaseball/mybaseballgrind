# DNS fix runbook — point `mygrindapp.com` at Vercel

## Why this exists

As of 2026-05-01, `mygrindapp.com` is **not** routed to Vercel. The
domain is sitting on a cPanel/LiteSpeed shared host and has a URL
forwarding rule that 301-redirects every request to
`https://youngsbaseball.github.io/mybaseballgrind/signup.html` (the
legacy GitHub Pages site). Two consequences:

1. The Vercel deployment at `mybaseballgrind.vercel.app` — including
   `/api/send-invite` and the new `onboarding.html` flow — is
   unreachable at the brand domain. Real users typing
   `mygrindapp.com` land on the legacy GitHub Pages app.
2. The apex redirect is also malformed: it appends the request path
   to `signup.html` with no separator, producing broken URLs like
   `signup.htmlapi/send-invite`. Even if you wanted users on
   github.io, this rule is broken.

This runbook fixes both.

## Pre-flight checks (do before touching anything)

- [ ] Email at `mygrindapp.com` (e.g. `coach@mygrindapp.com` referenced
      in `softball.html` flagTampered message) — note current MX
      records in cPanel Zone Editor. **Do not touch MX records during
      this fix.**
- [ ] Vercel CLI auth or dashboard access to the `mybaseballgrind`
      project (`vercel.com/dashboard`).
- [ ] cPanel login for the host currently serving `mygrindapp.com`.
- [ ] At least 90 minutes of focused time. Hard stop in CLAUDE.md:
      do not do this while tired or rushed. DNS fat-fingers cause
      multi-hour outages.
- [ ] Confirm SMS_DRY_RUN is still `true` in Vercel env vars before
      starting (changing DNS does not affect this, but stacking
      changes is how mistakes happen).

## Step 1 — Vercel side: claim the domain

1. `vercel.com/dashboard` → `mybaseballgrind` project → **Settings**
   → **Domains**.
2. Add both `mygrindapp.com` (apex) and `www.mygrindapp.com`.
3. Pick `www` as primary, redirect apex → www. Reasoning: apex CNAME
   isn't supported by raw DNS; CNAME for `www` is the most
   forgiving setup across registrars and what Vercel recommends by
   default.
4. Vercel will display the **exact records** to add. Use Vercel's
   values as the source of truth, not the values in this runbook —
   Vercel occasionally rotates IPs.
5. Expected at the time of writing:
   - `www.mygrindapp.com` → CNAME `cname.vercel-dns.com`
   - `mygrindapp.com` (apex) → A `76.76.21.21`
6. Leave the Domains tab open. The verification checkmarks update
   in real time as DNS propagates.

## Step 2 — cPanel side: delete the URL forwarding rule

**This is the change that immediately stops users landing on
github.io. Until Step 3 finishes, the domain is dark.** Only
proceed when you're committed to finishing Steps 2-4 in one sitting.

1. cPanel → **Domains** → **Redirects** (sometimes labeled
   "Forwarders").
2. Find the redirect for `mygrindapp.com` pointing at
   `youngsbaseball.github.io/mybaseballgrind/signup.html`.
3. Delete it. If `www.mygrindapp.com` has a separate redirect entry,
   delete that too.

## Step 3 — cPanel side: point DNS at Vercel

1. cPanel → **Domains** → **Zone Editor** → select `mygrindapp.com`.
2. **`www.mygrindapp.com`:**
   - Delete any existing `A` or `CNAME` for `www`.
   - Add: type `CNAME`, name `www`, value `cname.vercel-dns.com.`
     (trailing dot is fine, often required).
3. **Apex `mygrindapp.com`:**
   - Delete any existing `A` record pointing to the LiteSpeed shared
     host's IP.
   - Add: type `A`, name `@` (or blank — depends on cPanel), value
     `76.76.21.21` (or whatever Vercel shows).
   - Some cPanel installs offer ALIAS/ANAME records — if available,
     use ALIAS to `cname.vercel-dns.com` instead of the A record.
4. **Do not touch MX records.** Confirm yours match what you noted in
   pre-flight.
5. **Do not touch TXT records** unless Vercel asks for one for
   verification (it sometimes does). Existing SPF/DKIM TXT records
   for email are unrelated and must stay.

## Step 4 — wait, then verify

1. DNS propagation is typically 15 minutes to a few hours. Check
   from a non-cached resolver:
   ```
   dig @1.1.1.1 mygrindapp.com +short
   dig @1.1.1.1 www.mygrindapp.com +short
   ```
   You want the apex to resolve to `76.76.21.21` and `www` to
   resolve to a Vercel CNAME chain.
2. Vercel will auto-issue a Let's Encrypt cert once records resolve.
   The Domains tab in Vercel shows green checkmarks when ready.
3. Header check:
   ```
   curl -sI https://mygrindapp.com/api/send-invite -X POST \
     | grep -iE "^(server|location)"
   ```
   - You want `server: Vercel`.
   - You want **no `location:` header** (no redirect).
   - If you see `server: LiteSpeed`, DNS hasn't switched on your
     resolver yet — give it more time.
4. End-to-end check (dry-run, costs no Twilio money — same body
   builder we verified on `mybaseballgrind.vercel.app`):
   ```
   curl -sX POST https://mygrindapp.com/api/send-invite \
     -H "Content-Type: application/json" \
     -d '{"parentName":"Mike","playerName":"Sofia","playerPhone":"5555555557","sport":"softball","signupSessionId":"dns-postcheck"}' \
     | jq .previewBody
   ```
   Expected `previewBody` (the parent-friendly copy from commit
   `2948736`):
   ```
   Hey Sofia, Mike signed you up for MyGrind - the softball journal
   for tracking your stats, games, and growth.

   Set up your profile (3 min): https://mygrindapp.com/onboarding.html?name=Sofia
   ```
   - **Use a fresh fake phone number** (`5555555557` etc.) so you
     don't hit the 2/24h phone rate limit.
   - This call burns 1 of 3 hourly IP slots.

## Rollback

If something breaks and the brand domain has to come back online
fast:

1. cPanel → Zone Editor → restore the prior `A` / `CNAME` values
   (you wrote them down in pre-flight, right?).
2. Re-add the URL forwarding rule pointing at the github.io URL —
   even malformed, it was at least serving *something*.
3. In Vercel → Settings → Domains, remove `mygrindapp.com` /
   `www.mygrindapp.com` so Vercel stops issuing certs against
   non-resolving records.

Rollback is DNS-level so propagation delay applies again. Plan for
DNS to be in flux for up to a few hours after any change.

## Hard stops (from CLAUDE.md)

- Do not do this fix while tired or rushed.
- Do not launch publicly or drive traffic until a real-user end-to-end
  walk works against `mygrindapp.com` (not just the `.vercel.app`
  URL).
- Do not flip `SMS_DRY_RUN` to `false` in the same session as the DNS
  cutover. One change at a time.

## After this runbook succeeds

`mg-config.js` and `softball.html` still contain hardcoded
`youngsbaseball.github.io/mybaseballgrind` URLs (overridden at
runtime by `mg-config.js`). Once DNS is fixed, those references are
no longer load-bearing for routing — but they're still load-bearing
for OG tags, share captions, and one hardcoded "Purchase Your Own
Access" link in `softball.html`. Sweeping those is a separate piece
of work, not part of the DNS fix.
