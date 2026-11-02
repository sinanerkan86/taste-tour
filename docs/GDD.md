# Taste Tour: Idle Restaurant — Game Design Document (GDD)

> Status: Draft v0.1 (2026-11-02). Decisions may change through discussion; this document is updated when they do.

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

## 4. Menu (world cuisine)

Dishes unlock in order. Each dish has a **price** and a **cooking time**; dish upgrades raise the price.
Expensive dish = more income but longer cooking time → another balance decision.

Example unlock order (not final): Döner → Pizza → Taco → Burger → Ramen → Sushi → Paella → …

## 5. Restaurant growth (visual stages)

Street stall → small diner → restaurant → two floors → large venue with a terrace.
The scene changes visually at each stage.

## 6. Prestige: Franchise

- Sell the restaurant and start from scratch in a new city; earn permanent **Chef Stars** as a multiplier.
- City order (example): Istanbul → Rome → Tokyo → New York → Mexico City → Bangkok → …
- Each city has its own decor, color palette, local dishes (and later its own music).
- New cities = ready-made content for future updates.

## 7. Economy math (initial skeleton)

- **Upgrade cost:** `cost(n) = base × r^n`, r ≈ 1.07–1.15 (per section)
- **Income:** linear in level; ×2 jumps at **milestones** (10, 25, 50, 100, …)
- **Prestige reward:** `stars = floor(√(lifetimeEarnings / constant))`; each star gives a permanent % income bonus
- **Target pacing:** first prestige ~1–2 hours; later cycles get progressively longer
- **Big numbers:** `break_infinity.js`; display as 1.5K, 3.2M, 7.8B, T, then aa, ab, …
- **Offline earnings:** computed from timestamps, capped (e.g. 2 hours at first, upgradable)
- Balancing is done with a **simulation script** independent of game code.

## 8. Rewarded ad placements

| Ad | Reward |
|---|---|
| Rush | 2x income for 4 hours, stackable (most important) |
| Time skip | Instant 1 hour of earnings |
| Offline earnings | Collect 2x/3x on return |
| Wandering customer / VIP tourist | Randomly appearing customer, big tip for watching an ad |
| Staff discount | Hire the next staff member cheaper by watching an ad |

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
3. Economy simulation script
4. **Prototype:** one restaurant, 2–3 dishes, kitchen + waiters + dining room, staff automation, save/load, offline earnings
5. Bottleneck visualization, cashier and dishwashing
6. Prestige / second city
7. Rewarded ads (with test ad unit IDs)
8. Android build with Capacitor, test on phone
9. Localization (EN/TR), store assets, Play Store release

## 12. Open questions

- Should delivery be in the first release, or come with an update?
- Final list of dishes and cities
- Music/sound source
