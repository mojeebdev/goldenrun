# Milestone 3 Prompt — Campaign Modes, Progression and Launch Preparation

**Prerequisite:** Milestones 1 and 2 must be verified. Read [master prompt](00_MASTER_PROMPT.md), [product brief](../docs/PRODUCT_BRIEF.md), [UX storyboard](../docs/UX_STORYBOARD.md), and [roadmap](../docs/ROADMAP.md).  
**Scope:** Finish core modes and player journey. Separate the deploy-ready work from any actual production actions.

## Mission

Turn the proven arcade shooter and secure competition engine into a memorable football fan experience with the emotional arc of **2008 → 1,000** and social invitations that bring players back.

## A. 2008 story mode

- Build *2008: The Beginning* with an original, premium presentation and short intro.
- Sequence challenges of increasing difficulty: precision shots, curved free kicks, distance, pressure and keeper reactions.
- Award the **2008 badge** after **42 verified story-mode goals** according to persisted eligibility rules.
- Do not recreate specific licensed footage, kits, faces, logos or commentary.
- Provide chapter progress and a reason to continue after every few goals.
- Implement server verification rather than trusting local goal count for rewards.

## B. Road to 1,000

- Dedicated career progress view, progress bar and persistent total based on accepted ledger events.
- Milestones **42, 100, 250, 500, 750, 1,000** with original badges/celebrations and increasing gameplay complexity.
- One valid accepted goal = one lifetime goal. No conversion from bonus points or repeated shot submissions.
- The first player to reach 1,000 appears initially as **provisional**, then receives permanent **Founding Golden Fan** after explicit audit. Define ordering based on server-accepted events, not client's claimed timestamps.
- Ensure the game remains fun after the inaugural crown has been awarded: weekly cup, badges and career goals persist.
- Permanent archived historical awards and accurate Hall of Fame.

## C. Public profiles and leaderboard polish

- `/u/:handle` shows nickname, opted-in country, accepted career goals, badges and current/archived Golden Cup results.
- `/leaderboard` supports Weekly Global, Weekly Country, Lifetime Goals and Hall of Fame.
- Make rank ties explicit and consistent with published rules; avoid fabricated player count or "live" metrics.
- Include self-service privacy settings, report controls, deletion request details and honest session/account recovery UX.

## D. Social experiences

- Create original score/achievement share cards with a stable URL, Open Graph metadata, clip-less social preview (Cloudflare-native rendering techniques where feasible).
- Deep link challenge invites to the same reproducible course in a **practice** mode; new users can take a shot immediately without first registering.
- "Beat my score" CTAs from a completed match, with clear link back to `goldenrun.fun`.
- Country boards are based on optional self-selected country. Publish methodology for countries with unequal player populations.
- Do not auto-post to a social account or require an external platform OAuth connection.

## E. Finish design and performance

- Review cinematic presentation: original stadiums, gold/black/green visual coherence, dynamic ball/net/keeper feedback and a clear hierarchy.
- Polished small-phone portrait and landscape experience plus desktop/keyboard accessibility.
- Mute, reduced motion, volume, reduced graphics and robust loading/error states.
- Prevent asset bloat; lazy load original artwork/audio and test on slow mobile data.
- Optional historical real-goal tracker **only** if a reliable attributable and maintained source can be displayed with a current timestamp; otherwise leave it out.
- Make mobile WebAuthn UX, match interruption and duplicate/expired submission errors friendly and accurate.

## F. Launch preparation, not launch execution

- Add Terms, Privacy, eligibility/competition rules, reporting/deletion, original-art rights inventory and non-affiliation notice.
- Document tournament window, exact scoring, first-1,000 awarding, dispute review and the fact that there is **no official athlete award**.
- Load-test scoring/leaderboard paths, verify D1 cost and caching behavior, test defensive abuse controls and recovery.
- Validate Cloudflare preview build. Provide an exact owner checklist for GitHub integration, D1 provisioning/migrations, Worker assets/API routes, Turnstile settings, Cron Trigger, DNS/custom domain and SSL.
- Produce deployment rollback instructions and clearly identify production D1 backup/migration precautions.
- Do **not** deploy, connect DNS, migrate a remote database, spend money or register the domain unless the owner separately requests it.

## Acceptance gate

A newcomer can open the site, take a shot, understand the 2008 story, claim an account, play Road to 1,000, compete in a standardized cup, view honest rankings and share a challenge. The build remains Cloudflare-only and no false official association is implied.

**Stop after Milestone 3.** Report tested features, outstanding real-device QA, legal review and every manual owner action required before release.
