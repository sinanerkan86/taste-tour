# Taste Tour: Idle Restaurant — Game Design Document (GDD)

> Status: Draft v0.2 (2026-11-02). Decisions may change through discussion; this document is updated when they do.

## 1. Overview

- **Genre:** Idle / tycoon, restaurant management
- **Platform:** Android (Google Play), iOS possible later
- **Target market:** Global (priority: US/Europe); languages: English + Turkish from the start
- **Monetization:** Rewarded ads (main revenue) + in-app purchases ("Remove ads", permanent 2x). **No** forced (interstitial) ads at launch.
- **One-liner:** Grow a single restaurant from a street stall into a huge venue, unlock dishes from world cuisines, break bottlenecks, and open franchises in cities around the world.

## 2. Core loop

Customer arrives → sits → orders → chef cooks → waiter serves → customer pays → plate goes to the dish pit
→ money is spent on upgrading sections / hiring staff / unlocking new dishes
→ restaurant grows → prestige (franchise) restarts in a new city with a permanent multiplier.

Early on the player can speed things up by tapping; as staff are hired, everything becomes automated.
A tap on the restaurant earns a tip worth 25% of one customer's bill. At the start that is about a second of income per tap; once customers flow in quickly it becomes negligible, so tapping fades out naturally without a separate rule. (The balance simulation ignores tapping.)

## 3. Restaurant sections

| Section | What it controls | Upgrades |
|---|---|---|
| Entrance / sign | Customers per minute | Billboard, decor, rating (stars) |
| Dining room | Seating capacity | Table count, floors, terrace |
| Kitchen | Cooking speed/capacity | Chef count, chef speed, stove count |
| Waiters | Serving speed | Waiter count, waiter speed |
| Cashier | Payment speed | Cashier, contactless payment |
| Dishwashing | Clean plate supply; service stops if it falls short | Dishwasher staff, dishwashing machine |
| Delivery | Extra income line independent of the dining room | Courier count, scooter speed, delivery capacity |

Sections unlock gradually as the game progresses (e.g. dishwashing and delivery come later).

### Bottleneck mechanic (the heart of the game)

The restaurant's actual throughput = the throughput of the **slowest link** in the chain.
`throughput = min(arrivals, seating, kitchen, waiters, cashier, dishwashing)`

- The player decides "what should I invest in now?" → strategy.
- The bottleneck is visible: growing queue, piling dishes, angry customer faces, plates waiting to be served.
- The UI subtly highlights the bottleneck section (a hint for new players).

How the scene shows it: every section's real rate is scaled by the same factor so that the bottleneck runs at the visible customer rate (at most 1.2 customers/s on screen) and every other section keeps its slack. Customers arrive about 30% faster than the restaurant can serve, so work piles up right in front of the bottleneck:

| Bottleneck | What the player sees |
|---|---|
| Entrance | A calm, half-empty room; staff idle |
| Dining room | Few open tables (closed ones are dimmed), a line at the door, customers turned away |
| Kitchen | Every seat taken, order bubbles turn red and shake |
| Waiters | Finished plates pile up on the pass |
| Cashier | A long line at the register; diners stay seated waiting for it |
| Dishwashing | A growing dirty plate pile, no clean plates, chefs stand idle |

Guidance: tapping the "!" marker switches to the Restaurant tab and flashes that section's row. Status bubbles explain stalls: "zzz" over staff idle for 4+ s, "no plates" or "pass full" over chefs who have orders but cannot cook, a coin over diners waiting for room in the cashier line. A one-time tip in the first session explains the bottleneck and points at the marker.

Staff on screen: chefs and waiters grow by one every 25 section levels (waiters also when they would otherwise have to run), plus one cashier and one dishwasher.

## 4. Menu (world cuisine)

- **Taste tour:** every customer orders one serving of *each* dish on the menu, so the bill per customer is the sum of all dish prices. A new dish always raises income, which keeps the model easy to understand.
- Dishes unlock strictly in order; each dish is leveled separately (price ×level, ×2 at milestones).
- A dish is **mastered** at level 100 and stops leveling. Growth then has to come from the next dish, which prevents one cheap dish from making newer dishes pointless.
- Cooking time is visual only (animation length); it does not affect the economy. The kitchen's capacity is set by its own upgrades.

Unlock order for Istanbul (not final): Döner → Pizza → Taco → Burger → Ramen → Sushi → Paella.
Each next dish is worth ~8× the previous one.

## 5. Restaurant growth (visual stages)

Street stall → small diner → restaurant → two floors → large venue with a terrace.
The scene changes visually at each stage.

## 6. Prestige: Franchise

- Sell the restaurant and start from scratch in a new city; earn permanent **Chef Stars** as a multiplier (+10% income each).
- **When:** the franchise opens once the city's whole menu is unlocked (a clear goal per city). Staying longer still earns more stars, but less and less.
- **Stars** come from the current run only: `stars = floor((run reputation / 1.5e11)^(1/3))`, where reputation is the run's earnings measured in the city's cost scale. An on-pace city gives about 10 stars.
- City order: Istanbul → Rome → Tokyo → New York → Mexico City → Bangkok, then the list starts over with bigger numbers.
- Each city has its own 7-dish world menu that opens with the local specialty, its own color palette (wall, tiles, floor, table cloths) and a framed poster of its landmark on the wall: mosque (Istanbul), Colosseum (Rome), torii gate and mountain (Tokyo), skyline (New York), stepped pyramid (Mexico City), temple spires (Bangkok). City music comes later.
- New cities = ready-made content for future updates.
- **In the game:** the HUD shows the city and the Chef Stars. When the menu is complete a "Franchise" button appears in the HUD with the stars on offer (it keeps counting up while the player stays). Its dialog shows the stars to gain, the income bonus before → after, and that money, sections and dishes start over. Confirming fades to the new city, which greets the player with a banner.

## 7. Economy math

All numbers live in `src/core/economy/config.ts`. Balance is checked with the simulation (`npm run sim`, or `/sim.html` on the dev server for charts).

- **Income/s** = `min(section rates) × bill per customer × (1 + 0.1 × stars)`
- **Section rate** = `baseRate × level × 1.5^milestones`. **Dish price** = `basePrice × level × 2^milestones`. Milestones: 10, 25, 50, 75, 100, 150, 200, …
- **Upgrade cost:** `cost(level) = baseCost × r^(level-1)`. Sections have r = 1.20–1.22 and dishes r = 1.25. Each section has its own curve, so the bottleneck moves around as the restaurant grows (entrance and waiters early, kitchen and seating later).
- **Dish unlock costs** are calibrated so that each new dish arrives just as growth from the previous one starts to stall.
- **Cities:** every dish tier (`DISH_TIERS`) is reused in each city. In the n-th city prices are ×1000ⁿ (bigger numbers feel like progress) and all costs are ×1000ⁿ × (1 + 0.1 × 10n), i.e. also scaled by the star bonus a player is expected to bring. So each city plays like the first one for an on-pace player, and faster for a player who collected more stars.
- **Prestige reward:** see section 6; +10% income per star.
- **Offline earnings:** income/s × time away, capped at 2 hours at first (upgradable later). Applies both when the game was closed and when it was in the background; absences over 1 minute show a "Welcome back" dialog.
- **Saving:** every 10 s, after each purchase and when the game goes to the background. Saves are repaired on load (missing sections/dishes get starting values), so adding content later does not break old saves.
- **Big numbers:** plain JS numbers for now; they reach ~1e308, which covers the whole planned content. Switch to `break_infinity.js` only if later cities exceed that. Display: 1.5K, 3.2M, 7.8B, T, then aa, ab, …

### Simulated pacing (greedy bot, active play, no ads)

The bot franchises once the menu is complete and its stars per hour peak.

| City | Duration | Stars gained | Dishes unlocked at (min) | Income at the end |
|---|---|---|---|---|
| Istanbul | 1h 31m | 10 | 3, 14, 28, 40, 50, 60 | 93.7B/s |
| Rome | 1h 31m | 10 | same | 187T/s |
| Tokyo … Bangkok | 1h 31m each | 10 each | same | ×1000 per city |

If the bot stays 1.5× longer per city it collects 15 stars per city (Istanbul 2h 17m), and the following cities get shorter (1h 49m, 1h 43m, … 1h 36m) with the menu complete at ~45 min: lingering is rewarded but not required.

## 8. Rewarded ad placements

| Ad | Reward |
|---|---|
| Rush | 2x income for 4 hours, stackable (most important) |
| Time skip | Instant 1 hour of earnings |
| Offline earnings | Collect 2x/3x on return |
| Wandering customer / VIP tourist | Randomly appearing customer, big tip for watching an ad |
| Staff discount | Hire the next staff member cheaper by watching an ad |

Implemented (7a): Rush gives 2x income for 4 hours per ad and stacks up to 12 hours; its time keeps running while the player is away, so offline earnings use the boosted rate only for the Rush part. Time skip pays one hour of current income at once and then has a 30 minute cooldown. The welcome-back dialog offers "Collect 2x". Every ad starts from a dialog that shows the reward, and a skipped ad gives nothing. Rush time and the cooldown carry over through a franchise. Numbers live in `ADS` in the economy config.

Implemented (7b): a VIP guest (a food tourist with a sun hat and a star bubble) walks in after 90 s of play and then every 3-6 minutes, and waits near the door for 40 s. Tapping them offers a tip worth 15 minutes of income (Rush does not raise it) for an ad; saying no or ignoring them sends them away. The staff discount placement is left for later.

IAP: Remove ads (grants ad rewards without ads), permanent 2x income, starter packs.

## 9. Visual direction

- A **living restaurant scene** instead of a list screen: walking customers, rushing waiters, steaming stoves, flying coins.
- Warm, saturated colors; palette changes per city (Istanbul: copper, pomegranate red, tile blue, saffron).
- Simple but cute characters; vector-based (crisp at any resolution).
- "Juice": particles, tweens, number pop-ups, light screen shake.
- Initial art is produced by Claude as vector graphics; the user reviews the product and gives feedback, technical direction stays with Claude.

## 10. Tech stack

- TypeScript + Phaser 3 + Vite
- Capacitor → Android (AAB)
- `break_infinity.js` (big numbers)
- `@capacitor-community/admob` (ads)
- Save: Capacitor Preferences (localStorage on web); cloud save later

## 11. Roadmap

1. ~~Concept, name, repo~~
2. ~~Project skeleton (Vite + Phaser + TS), empty scene~~
3. ~~Economy simulation script~~
4. ~~**Prototype:** one restaurant, 2–3 dishes, kitchen + waiters + dining room, staff automation, save/load, offline earnings~~
5. ~~Bottleneck visualization, cashier and dishwashing~~
6. ~~Prestige / franchise to new cities~~
7. ~~Rewarded ads (with test ad unit IDs)~~
8. Android build with Capacitor, test on phone (emulator build, full screen and consent form done; real phone test left)
9. Localization (EN/TR), store assets, Play Store release

## 12. Open questions

- Should delivery be in the first release, or come with an update?
- Final list of dishes and cities
- Music/sound source
