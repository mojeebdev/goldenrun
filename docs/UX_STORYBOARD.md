# Golden Run — UX Storyboard & Art Direction

## Creative north star

A cinematic, premium **arcade sports game** with a human-scale learning curve. Not a banking dashboard or a generic marketing site wrapped around a canvas.

**Visual:** midnight black, trophy gold, stadium green; carefully controlled touches of deep red nod to the 2008 theme without copying club marks. **Atmosphere:** floodlights, clean silhouettes, rich grass, dynamic goal net, responsive keeper and stylized crowds. **Typography:** expressive condensed display heading + excellent readable interface text. **Audio:** original crowd beds, ball impact and short goal sting, all optional.

All game identity/visuals original; use licensed assets only after documenting the grant.

## Mobile-first player journey

### 1. Landing (`/`)
- Identity: **THE GOLDEN RUN**; subhead **2008 → 1,000**.
- Primary above-the-fold CTA: **PLAY NOW**, with stadium and ball as the dominant visual.
- Secondary, unobtrusive: leaderboard and game modes.
- Lightweight first load: immediately render static hero while game assets stream.
- No account-wall or auto-playing sound.
- Public goal counter based on a sourced historical tally only if maintained accurately, with attribution and date; otherwise omit.

### 2. First shot (`/play`)
- Immediate playable practice scene, not an account form.
- Hint shown briefly: **Drag to aim. Release to shoot.** Pointer gesture/keyboard mapping clear.
- Camera behind ball; goal and keeper always readable.
- Contextual feedback: power arc, aim marker, spin indicator.
- Input during flight locked; show outcome then next ball promptly.

### 3. First goal
- Ball and goal animation, net contact, impact/crowd response.
- Small readable overlay: **GOAL!** + visible skill bonus; don't obscure play for long.
- Prompt after a few successful shots rather than after first attempt:
  **Keep your goals. Create your player profile.**
- A user can dismiss and continue practice.

### 4. Mode selection (`/modes`)
- **2008: The Beginning** — narrative and 42-goal completion.
- **Road to 1,000** — career counter and milestones.
- **Golden Cup** — 12 standardized shots / 90-second target and week closing time.
- Each card specifies account requirements and whether the run is ranked.

### 5. Profile claim (`/join`)
- Ask for public nickname, optional country, consent to rules, then prompt passkey registration.
- Simple explanation of passkey portability and recovery options. Use Cloudflare Worker + D1 only.
- Never promise that anonymous guest progress was safely synced before confirmation.
- Error and recovery states: name taken, WebAuthn unsupported, canceled biometric prompt, lost device.

### 6. Player profile (`/u/:username`)
- Career goals / 1,000 progress, earned badges, verified cup rank and country (if opted in).
- Shareable public profile with minimal data exposure; private controls and report account affordance.
- Distinguish unofficial community awards from any official football honors.

### 7. Golden Cup (`/cup`)
- Clear rules before starting: standardized 12 shots, 90-second target, one ranked entry, server-verification.
- Countdown and scenario indicator unobtrusive during play.
- End-of-run: provisional score, verification state, final published score, ranked position.
- Network failure UX: unsent run clearly marked; never imply points were stored if not confirmed.

### 8. Leaderboards (`/leaderboard`)
- Tabs: Weekly Global, Weekly Country, Career Goals, Hall of Fame.
- Selected period, rule version, reset timezone (UTC) and last refreshed timestamp visible.
- Localized country flags, but country is user-selected rather than guessed from IP.
- Handle ties honestly and avoid invented live numbers.

### 9. Share (`/challenge/:id` later)
- Social card: username, week, score, rank, stadium motif, call to action.
- Deep-link opens practice of identical scenarios; ranked entry follows published contest rules.
- Canonical URLs and share previews generated without third-party image infrastructure.

## Full-screen play composition

**Desktop:** playfield dominates viewport, with a small score/timer strip and optional mute/settings. Side or bottom menu appears only outside shot.  
**Mobile portrait:** safe-area aware; goal framed in upper section, ball and gesture zone in lower section; keep HUD out of shot trajectory.  
**Mobile landscape:** expanded pitch; thumb-friendly interactive area.  
**Small devices:** dial down crowd animation and fine geometry before reducing ball/keeper responsiveness.

## Animation language

- **Idle:** barely breathing crowd movement, flag/shadow motion and keeper ready stance.
- **Aim:** gradual arc preview, target confirmation and constrained power/spin feel.
- **Flight:** readable ball travel, brief camera follow if it does not obscure the goal.
- **Goal:** quick impact, net ripple, tasteful gold celebration, skip/reduced-motion options.
- **Save/miss:** keeper recovery or ball impact feedback; avoid shame or frustrating delay.

## UX quality bars

- A new player should understand the gesture in one try.
- One shot from landing is the primary funnel; eliminate navigation distractions.
- No hidden login between play and the first goal.
- Clear distinction between unranked practice and verified competitive play.
- Controls fully usable on keyboard and pointer; sound never required to understand outcomes.
- Use original visual assets optimized for web performance; no intrusive interstitials.
