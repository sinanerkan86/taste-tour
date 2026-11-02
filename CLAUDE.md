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
- Economy model and tuned numbers are in `src/core/economy` (see GDD section 7). Phaser code is in `src/game` (placeholder scene for now).
- Next step is roadmap item 4 in the GDD (playable prototype).
