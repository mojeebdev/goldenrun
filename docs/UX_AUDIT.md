# UX and bug audit — 2026-10-29

Done before the onboarding rework. Method:
- Every public page on production (goldenrun.fun) screenshotted at iPhone 12 size (390×844, touch).
- An axe-core accessibility run (WCAG 2 A/AA plus best practice) on the same pages.
- A read-through of the home, play, join, modes and run-flow code.
- The owner's own feedback after playing on an iPhone 12.

## Owner feedback (verbatim intent)
- The hero needs **two calls to action**: practise now, or create a player. Visitors shouldn't have to scroll to find how to join.
- The how-to tips and the mode list belong in **onboarding**, not as static sections of the page.
- Choosing how to practise should be easier, and joining should feel smooth rather than awkward.

## Findings

| # | Area | Finding | Severity |
|---|------|---------|----------|
| 1 | Home | The header overflows at 390 px. "Leaderboards" is cut off and **Sign in is pushed off-screen**, so a returning player on a phone can't see how to sign in from the home page. | Bug · high |
| 2 | Home | There's only one call to action (Play now). Joining appears nowhere on the home page; it's only reachable through Cup → Create player. | UX · high |
| 3 | Home | The Drag / Bend / Strike tips sit as static cards below the fold. Players read them (if at all) before they've touched the ball, and they're never shown again where they matter: in the game. | UX · medium |
| 4 | Home, Modes | The Golden Cup blurb still says "**with a 90-second target**". That's out of date since the run clock fix (now 4 minutes). | Bug · medium |
| 5 | Home | The mode list repeats the /modes page in full, so the home page is about 2.2 phone screens long, and the Practice card duplicates the hero button. | UX · low |
| 6 | Practice | The keeper level and shooting spot are hidden in the gear-icon Settings sheet, alongside graphics and motion. First-time players never discover them. | UX · high |
| 7 | Practice | There's no first-run guidance beyond one hint pill. Nothing explains curl or strike height until after a missed first shot. | UX · medium |
| 8 | Join | Everything is on one form, and the passkey explanation is a dense paragraph. There's no sense of steps or progress. | UX · medium |
| 9 | Join | After saving recovery codes, the only button is "Enter the Golden Cup". That sends a brand-new player straight to their **one ranked weekly entry**, the worst place to learn the game. | UX · high |
| 10 | Navigation | On phones, PageShell hides Cup and Leaderboards (`hidden sm:inline`). Apart from the footer, the only ways around are Sign in and Play. | UX · high |
| 11 | 2008 | Guests see a dimmed "Kick off" button that does nothing when tapped. It looks broken. | Bug · medium |
| 12 | 2008 | A "Refresh progress" button sits at the bottom of the page. Progress already refreshes after each run, so the button is noise. | UX · low |
| 13 | A11y | The `/2008` and `/road-to-1000` progress bars have no accessible name (axe `aria-progressbar-name`, serious). | A11y · serious |
| 14 | A11y | `/2008` puts `aria-label` on six plain `div`s, where screen readers ignore it (axe `aria-prohibited-attr`, serious). | A11y · serious |
| 15 | A11y | On the home page and in the game HUD, content sits outside any landmark (axe `region`, moderate). | A11y · moderate |
| 16 | Practice | Sound defaults to off with no hint that it exists. That's deliberate (no autoplay), but onboarding should offer it once. | UX · low |

Checked and fine:
- `/u/:handle` share meta in production: the right title, plus a fallback for unknown players.
- No console errors on any page.
- `/modes`, `/join`, `/login`, `/cup`, `/leaderboard`, `/rules` and `/about` pass axe with no violations.

## Plan (this change)
1. **Home:** a full-screen hero with two buttons. Guests get **Play now** (practice) and **Create free player**; signed-in players get **Continue** (their next step) and **Practice**. A compact header that fits 360 px. The static tips and mode list are removed; the tips move into onboarding and the modes stay on `/modes`. A one-line disclaimer remains.
2. **Practice onboarding** (`/play`):
   - First visit: three short steps (Drag, Bend, Strike), each with a small animated diagram.
   - Then a **setup card**: keeper (Rookie / Professional / Legendary, each with one line on what it means), spot (all spots in a rotation, or one fixed spot) and sound.
   - Return visits go straight to the setup card with the last choices picked; one tap kicks off.
   - Tapping the keeper line in the HUD reopens the card mid-session.
   - "How to shoot" stays one tap away.
3. **Join onboarding:**
   - Three steps with a progress indicator: 1 Nickname & country → 2 Passkey (plain-language card) → 3 Recovery codes.
   - Then **"You're in — where to start"**, recommending 2008 Matchday 1, with Road to 1,000 and the Cup (marked "one ranked try per week") as the other choices.
4. **Phone navigation:** a bottom tab bar (Home, Play, Modes, Cup, Me) on content pages. The header keeps the wordmark and the Play button.
5. **Modes hub:** each mode shows the player's own status (chapter goals, career goals, this week's cup entry) and the next action.
6. **Bug and a11y fixes:** items 4, 11, 12, 13, 14 and 15.

## Milestone 4 close-out (tracked in ROADMAP)
- **UX onboarding polish:** this change.
- **Accessibility tests:** an axe run on every page, with violations fixed.
- **Cheap-device and slow-network test:** an emulated 4× CPU throttle on a slow 4G profile, timing how long until the first shot is possible.
- **Asset and licence check:** fonts are OFL (Fontsource); sound is synthesised in code; all art is drawn in code or SVG in this repo; there are no third-party logos.
- **Dashboard deployment notes:** owner-facing steps in DEPLOYMENT.md.
- **Analytics:** Cloudflare Web Analytics is cookieless, but turning it on is an owner dashboard action, and the privacy page currently says "no analytics service". It's left off and documented as an owner decision.
