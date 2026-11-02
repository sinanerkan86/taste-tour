# Taste Tour: Idle Restaurant

Idle / tycoon restaurant game for Android. Goal: publish on Google Play and earn passive income via rewarded ads + IAP.
Full design: [docs/GDD.md](docs/GDD.md). Keep the GDD up to date when design decisions change.

## Hard rules

- **Talk to the user in Turkish.**
- **No Turkish anywhere in the code**: identifiers, comments, log messages, file names, and string literals are all English. The only exception is the Turkish translation file(s) used for in-game localization (e.g. `locales/tr.json`).
- **Commits carry no AI attribution**: no `Co-Authored-By` trailer, no "Generated with Claude" line, no mention of Claude/AI in commit messages or PR bodies. Commits read as if the user wrote them. Commit messages are in English.
- Commit only when the user asks. Every commit goes directly on `main` and is pushed immediately (no feature branches or PRs).

## User and way of working

- The user has been a software developer since 2011 but has **no game development experience**: briefly explain game-dev concepts (game loop, scenes, delta time, tweens, etc.) in software-engineering terms.
- **Game design, economy math, and visual/technical direction are Claude's responsibility.** The user reviews the result and gives feedback on look and feel.
- Work step by step; each step should end with something that runs and can be shown in the browser.
- The game must be original: use genre mechanics, do not copy a specific existing game.

## Decisions made

- Name: **Taste Tour: Idle Restaurant** (repo: `sinanerkan86/taste-tour`, private)
- Theme: grow a single restaurant + world-cuisine menu; prestige = franchise in another city
- Core mechanic: **bottleneck** between restaurant sections (the slowest link sets income)
- Market: global first; English + Turkish localization from the start
- Monetization: rewarded ads + IAP only; no forced interstitials at launch
- Visuals: living restaurant scene, warm colors, vector style, lots of "juice"

## Tech stack

- TypeScript + Phaser 3 + Vite; Android packaging via Capacitor (`android/` folder is generated later with `npx cap add android`)
- Big numbers: plain JS numbers for now (enough up to ~1e308); `break_infinity.js` only if later content needs it
- Ads: `@capacitor-community/admob` (test ad unit IDs only during development)
- Economy balance is tuned with a simulation script separate from game code
- Game logic (economy/simulation) lives in pure TypeScript modules independent of Phaser, so it is easy to test and simulate

## Status

- `npm run dev`: game at `/`, balance report at `/sim.html`. `npm run sim`: balance tables in the terminal. `npm test`: unit tests (vitest) for `src/core`.
- Economy model and tuned numbers are in `src/core/economy` (see GDD section 7). Phaser code is in `src/game` (logical resolution 1080x1920).
- Roadmap item 4 (playable prototype) is done:
  - [x] 4a. Economy wired into the game: HUD (money, income/s), upgrade panel with Restaurant/Menu tabs, bottleneck marker, passive income. EN/TR strings in `src/i18n`. Dev shortcut: `/?money=1e6`.
  - [x] 4b. Living restaurant scene (`src/game/view`): customers arrive at the economy's rate (shown up to 1.2/s), sit, order, get served by waiters, pay at the cashier; staff counts follow the economy; a red marker floats over the bottleneck section. Real queues per section come with roadmap item 5. Dev: `window.game` exposes the Phaser game; the Browser pane must be visible or the game loop does not run.
  - [x] 4c. Tap tip (`tap()` in core, 25% of a bill) and juice in `src/game/fx.ts`: sparkles, coins flying to the HUD, banners + confetti + light shake on milestones, new dishes and mastered dishes.
  - [x] 4d. Save/load (`src/core/save.ts` format + repair, `src/game/persistence.ts` async key-value store, localStorage for now) and offline earnings with a welcome-back dialog. Dev: `/?reset=1` starts a fresh game.
- Roadmap item 5 (bottleneck visualization, cashier and dishwashing) is done:
  - [x] 5a. Scene becomes a pipeline: each section works at its own (scaled) capacity, so work piles up in front of the real bottleneck. Symptoms: door queue / customers turned away (seating), long waits (kitchen), plates piling on the pass (waiters), cashier line (cashier), dirty plate pile and no clean plates (dishwashing). Cashier and dishwasher staff on screen; open seats grow with the dining room level.
  - [x] 5b. Bottleneck guidance: tapping the "!" marker jumps to that section's row in the panel; status bubbles (zzz for idle staff, "no plates" / "pass full" over blocked chefs, a coin over diners waiting to pay); a first-time hint explaining the bottleneck (seen hints are stored in the save as `seenHints`).
- Roadmap item 6 (prestige / franchise to new cities) is done:
  - [x] 6a. Core: cities (`CITIES` in config, each with its own 7-dish menu on shared `DISH_TIERS`), city price/cost scaling, franchise rules (`canFranchise`, `prestige` moves to the next city), stars from run reputation (cube root), save fields `city` and `runReputation`, sim reports per city. EN/TR names for all cities and dishes.
  - [x] 6b. Franchise flow in the game: stars and city name in the HUD, a Franchise button that appears when the menu is complete, a dialog showing stars to gain, the bonus and the next city, then a fresh restaurant in the new city.
  - [x] 6c. City look: each city has its own palette (wall, tiles, floor, table cloths, door mat) and a framed landmark poster on the wall (`src/game/view/themes.ts`). Dev: `/?city=3` shows another city's look and prices.
- Roadmap item 7 (rewarded ads) is split into sub-steps:
  - [x] 7a. Rush (2x income for 4h, stacks up to 12h), time skip (1h of earnings at once, 30 min cooldown) and 2x offline collect. Ad buttons on the room floor, an offer dialog before each ad (`src/game/ui/AdOfferModal.ts`). Ads go through `AdService` (`src/game/ads`); in the browser `TestAdService` shows a fake 3 s ad that can be skipped (no reward). Rush time and cooldown keep running offline (`passTime`).
  - [ ] 7b. Wandering VIP customer (random, big tip for an ad) and the AdMob adapter for `AdService` (test ad unit IDs).
