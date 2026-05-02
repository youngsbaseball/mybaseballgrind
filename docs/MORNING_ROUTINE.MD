
Good morning. I'm continuing work on My Grind (the baseball/softball journal app).

Please do these steps in order before suggesting any code changes:

1. Pull latest main: git fetch origin main && git reset --hard origin/main
2. Read docs/STATUS.md to see what's currently shipped and known issues
3. Read docs/ROADMAP.md to see what we planned to work on next
4. Check the last 5 commits with `git log --oneline -5` to confirm what was shipped most recently
5. Tell me the top 1–2 priorities you'd recommend for today's session
6. Wait for me to pick before writing any code

Context for today: [REPLACE WITH WHAT'S ON YOUR MIND — e.g., "I have 30 min before practice", "got beta feedback that X is broken", or "want to focus on marketing"]
```

**Tip:** Save that prompt as a note on your phone or as a TextExpander snippet so you never have to retype it.

---

## 🗓️ Daily 10-Minute Routine

Do these 4 things every morning before deciding what to work on:

### 1. Check the live app (2 min)
Open https://youngsbaseball.github.io/mybaseballgrind/ in incognito.
- Does it load?
- Is the new content from yesterday there?
- Any console errors? (F12 → Console)

### 2. Check Firebase (1 min)
https://console.firebase.google.com/project/my-grind-b8486/firestore/data
- Are new users showing up in `/users/`?
- Any error spikes?

### 3. Check messages from beta users (3 min)
- Email inbox: any bug reports, feature requests, complaints?
- Note them in `docs/ROADMAP.md` under "User Feedback"

### 4. Pick ONE focus for today (4 min)
Look at `docs/ROADMAP.md` and pick ONE item from the "This Week" section. Just one. Discipline beats ambition.

Write it at the top of your notepad: **"Today I'm shipping: ____"**

---

## 🚫 What NOT to do in the morning

- Don't open Twitter / Instagram
- Don't read industry news
- Don't "just check" your stats more than once
- Don't start 3 tasks at once

Mornings are for **shipping**. Reading and reacting comes after lunch.

---

## 📋 End-of-Session Checklist

Before you close the laptop:

- [ ] All commits pushed to `main`
- [ ] App still loads (test the live URL)
- [ ] If you shipped something user-facing, jot it in `docs/STATUS.md` under "Recently Shipped"
- [ ] If you discovered a bug, add it to `docs/ROADMAP.md` under "Bugs"
- [ ] Decide what tomorrow's focus will be — write it down

---

## 🎯 Weekly Review (Sundays, 20 min)

- Open `docs/ROADMAP.md`. What got shipped this week? Move it to STATUS.md under "Shipped This Week".
- Anything you didn't ship that's still important? Keep it. Drop everything else.
- Read 3 of the last week's beta-user messages. What pattern do you see?
- Plan next week's focus: 1 "big rock" + 2 small ones.
