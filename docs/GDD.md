# Taste Tour: Idle Restaurant — Game Design Document (GDD)

> Status: Draft v0.3 (2026-11-07). Decisions may change through discussion; this document is updated when they do.

## 1. Overview

- **Genre:** Idle / tycoon, restaurant management
- **Platform:** Android (Google Play), iOS possible later
- **Target market:** Global (priority: US/Europe); languages: English, Turkish, French and Simplified Chinese (the device language by default, changeable in the settings)
- **Monetization:** Rewarded ads (main revenue) + in-app purchases ("Remove ads", permanent 2x). **No** forced (interstitial) ads at launch.
- **One-liner:** Grow a single restaurant from a street stall into a huge venue, unlock dishes from world cuisines, break bottlenecks, and open franchises in cities around the world.

## 2. Core loop

Customer arrives → sits → orders → chef cooks → waiter serves → customer pays → plate goes to the dish pit
→ money is spent on upgrading sections / hiring staff / unlocking new dishes
→ restaurant grows → prestige (franchise) restarts in a new city with a permanent multiplier.

Early on the player can speed things up by tapping; as staff are hired, everything becomes automated.
A tap on the restaurant earns a tip worth 25% of one customer's bill. At the start that is about a second of income per tap; once customers flow in quickly it becomes negligible, so tapping fades out naturally without a separate rule. (The balance simulation ignores tapping.)

The panel has an x1 / x10 / Max toggle: one tap buys that many levels (Max: as many as the money covers). The choice is remembered (player settings are stored apart from the save). The economy is the same; it only cuts the number of taps (the simulation buys about one level every 5 seconds in the first city).

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

- The Menu tab shows every dish of the city from the start with its icon and unlock price; dishes after the next one are faded with a padlock and "unlocks after <previous dish>".

Unlock order for Istanbul: Döner → Lahmacun → Pide → Köfte → Mantı → İskender → Baklava.

Diners show what they ordered: the order bubble over a seated customer carries that dish's icon.
Each next dish is worth ~8× the previous one.

## 5. Restaurant growth (visual stages)

Within each city the restaurant gets cozier with every dish on the menu, so each unlock is also something to see. A new piece pops in with a sparkle:

| Dishes on the menu | New decor |
|---|---|
| 2 | Warm string lights along the top of the wall |
| 3 | Potted plants by the walls |
| 4 | A patterned rug in the city's accent color under the dining room |
| 5 | A chalkboard menu on the wall |
| 6 | Candles flickering on every table |
| 7 | A red carpet and brass posts with velvet ropes at the entrance |

A franchise starts the new city plain again, so the growth is felt in every city.

### Section looks

Each section also gets a new look at levels 25, 50 and 100 (`STYLE_LEVELS`; the first city ends with sections around level 100-150, so a normal run sees all three). A short note announces it and the room scrolls there if it is off screen.

| Section | Lv 25 | Lv 50 | Lv 100 |
|---|---|---|---|
| Waiters (start: polo shirt and waist apron) | White shirt and vest | Bow tie | Black tailcoat |
| Cashier (start: polo shirt and waist apron) | Same steps as the waiters, plus a tip jar | Card terminal | Flowers on the desk |
| Kitchen (start: cooks in plain shirts and aprons, no hats) | Chef jackets and toques, stockpot and cutting board | Red neckerchiefs, copper pans under the hood | Tall toques, heat lamps on the pass, service bell |
| Dining room | Gold-trimmed table cloths with napkins and wine glasses | Velvet chair cushions in the city color | Brass table lamps with warm light |
| Entrance | Chalkboard A-frame sign | Clipped topiary trees by the door | Lantern over the door |
| Dish pit (start: grey shirt) | Light blue shirt, soap and sponge | Blue neckerchief, plate rack on the wall | White jacket, steel splashback |
Later ideas: bigger rooms (second floor, terrace) as their own upgrades.

### Goal bar

A small card under the HUD always names the next goal with a progress bar: the next dish (money / unlock cost), then the first Chef Star (run reputation / star threshold), then "ready to open in <next city>". Tapping it goes where the goal is done: the dish row in the Menu tab, the bottleneck section, or the franchise dialog.

## 6. Prestige: Franchise

- Sell the restaurant and start from scratch in a new city; earn permanent **Chef Stars** as a multiplier (+10% income each).
- **When:** the franchise opens once the city's whole menu is unlocked (a clear goal per city). Staying longer still earns more stars, but less and less.
- **Stars** come from the current run only: `stars = floor((run reputation / 1.5e11)^(1/3))`, where reputation is the run's earnings measured in the city's cost scale. An on-pace city gives about 10 stars.
- 10 cities along a route around the world: Istanbul → Rome → Paris → Cairo → Mumbai → Bangkok → Tokyo → Rio de Janeiro → Mexico City → New York (the big finale), then the list starts over with bigger numbers ("Istanbul II").
- Each city serves only its own cuisine: 7 well-known dishes (nothing too obscure), ordered like a meal from street food to main courses and ending with a signature dessert. No dish appears in two cities (70 dishes in total).

| City | Menu |
|---|---|
| Istanbul | Döner, Lahmacun, Pide, Köfte, Mantı, İskender, Baklava |
| Rome | Bruschetta, Pizza, Carbonara, Lasagna, Risotto, Ossobuco, Tiramisu |
| Paris | Croissant, Crêpe, Croque Monsieur, Quiche, Ratatouille, Coq au Vin, Crème Brûlée |
| Cairo | Falafel, Ful Medames, Koshari, Shawarma, Mahshi, Fattah, Om Ali |
| Mumbai | Samosa, Pav Bhaji, Masala Dosa, Butter Chicken, Tandoori Chicken, Biryani, Gulab Jamun |
| Bangkok | Spring Rolls, Satay, Som Tam, Pad Thai, Tom Yum, Green Curry, Mango Sticky Rice |
| Tokyo | Gyoza, Ramen, Tempura, Tonkatsu, Sukiyaki, Sushi, Mochi |
| Rio de Janeiro | Pão de Queijo, Coxinha, Açaí Bowl, Moqueca, Feijoada, Churrasco, Brigadeiro |
| Mexico City | Tacos, Quesadilla, Guacamole, Tamales, Enchiladas, Mole, Churros |
| New York | Hot Dog, Bagel, Burger, Buffalo Wings, Pastrami Sandwich, Steak, Cheesecake |

- Each city also has its own color palette (wall, tiles, floor, table cloths) and a framed poster of its landmark on the wall: mosque (Istanbul), Colosseum (Rome), Eiffel Tower over rooftops (Paris), pyramids and a palm (Cairo), the arched gateway by the sea (Mumbai), temple spires (Bangkok), torii gate and mountain (Tokyo), Sugarloaf with its cable car (Rio), stepped pyramid (Mexico City), skyline (New York). City music comes later.
- New cities = ready-made content for future updates.
- **World tour map:** tapping the city pill in the HUD opens a scrolling map where a road winds up through a meadow (trees, ponds, drifting clouds) from the first city to the next ones. Each city is a round window with its landmark: finished cities show the stars they gave (stored per city in the save as `cityStars`), the current one glows under a bouncing pin with its menu progress, and the cities ahead wait under a padlock with their first dish floating beside them. Golden footsteps mark the road travelled. After the sixth city the list repeats with "II", "III".
- **Franchise perks** (added 2026-11-07, because cities felt like reskins of each other): after confirming a franchise the player picks one of three perks (the first franchise always offers Manager, Head Start and Famous Chain; later offers are a stable shuffle per city, so reloading does not reroll them). Perks are permanent:

| Perk | Max level | Effect |
|---|---|---|
| Restaurant Manager | 1 | Restaurant section upgrades cost 30% less. (It used to buy levels by itself; playtesting showed that took away the choice between upgrading and saving for a dish, so nothing may spend the player's money automatically.) |
| Head Start | 3 | New restaurants open with every section at level 10 / 25 / 50 |
| Famous Chain | no cap | Income +50% per level |
| Brand Value | 5 | Franchises award +20% stars per level |
| Research Grant | 3 | Kitchen Lab projects run 25% faster per level |
| Second Lab | 1 | Two lab projects at once |

  Tapping the Chef Stars counter lists the star bonus and the perks owned.
- **In the game:** the HUD shows the city and the Chef Stars. When the menu is complete a "Franchise" button appears in the HUD with the stars on offer (it keeps counting up while the player stays). Its dialog shows the stars to gain, the income bonus before → after, and that money, sections and dishes start over. Confirming fades to the new city, which greets the player with a banner.

## 6b. Kitchen Lab

Added 2026-11-07 after playtesting: the game had no reason to come back and little to decide. The Lab is the panel's third tab. The player starts a research project; it runs on real time, also while the game is closed, and when it is done it waits for the player to tap "Collect" (a return hook: the welcome-back dialog names the projects that finished while away). Research is free; the cost is time. One project at a time (two with the Second Lab perk). A red "!" on the Lab tab shows when a project is done or the lab is idle; a one-time tip points at the tab once the second dish is on the menu. Lab levels survive franchises.

| Project | Levels | Per level | Durations |
|---|---|---|---|
| Secret Spices | 10 | Income +25% | 3m, 15m, 45m, 1.5h, 3h, 5h, 8h, 12h, 16h, 24h |
| Local Suppliers | 10 | Upgrade and unlock costs ×0.94 | 5m, 20m, 1h, 2h, 4h, 6h, 9h, 12h, 18h, 24h |
| Night Shift | 6 | Offline earnings counted for 1 more hour (2h → 8h) | 10m, 45m, 2h, 4h, 8h, 12h |
| Tour Guide | 5 | VIP tips +30%, VIPs come 12% sooner | 15m, 1h, 3h, 6h, 12h |
| Event Planner | 4 | Rush +1h per ad, Rush cap +3h | 30m, 2h, 6h, 12h |

The short first levels teach the Lab in the first session; the long ones fill a night or a work day. Numbers live in `RESEARCH` / `LAB` in the economy config. Later idea: a rewarded ad that halves the time left (needs its own ad unit).

## 6c. Reminders (local notifications)

Added 2026-11-07 as the first retention feature. When the game goes to the background it schedules phone reminders; when it comes back they are cancelled (and shown ones cleared). No server: the phone schedules them itself.

- **Research done:** the first running project that finishes ("Night Shift is ready in your Kitchen Lab").
- **Till full:** offline earnings reach their cap (2h, more with Night Shift).
- **Rush over:** Rush time runs out.

- **Daily reward waiting:** at 11:00 local, today if today's reward is still waiting and it is before 11:00, else the next day. It comes on top of the limit below, but not within an hour of another reminder.

Rules against nagging: nothing due in the first 5 minutes; reminders due in quiet hours (22:00-09:00 local) wait until 09:00; reminders less than an hour apart are merged (the earlier wins); at most 2 per absence. Delivery is inexact (no exact-alarm permission), so a reminder can come some minutes late. The permission (Android 13+) is asked once, when the player starts their first research project; Settings has a "Reminders" switch. Logic in `src/core/notifications.ts` (`NOTIFY`), system side in `src/game/notifications.ts`.

Later idea: a "your restaurant misses you" reminder after a day or two away.

## 6d. Daily rewards and daily tasks

Added 2026-11-07 (retention, second step after reminders). A gift button in the bottom left corner of the room (red "!" when something can be collected) opens the Daily Rewards dialog. It also opens on its own once a day for a returning player when a new reward is ready (after the welcome-back dialog; never before the first bottleneck tip is seen). Days are local calendar days.

- **Daily reward streak:** a 7-day cycle; missing a day starts over at day 1, day 8 starts the cycle again. Money rewards are seconds of current income (without Rush), so they are worth the same at every stage and in every city.

| Day | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|---|---|---|---|---|---|---|---|
| Reward | 10 min income | 20 min | Rush 1h | 30 min | 45 min | Rush 2h | 1h income + Rush 2h |

- **Daily tasks:** three a day (easy, medium, hard), picked from the date with a seeded random, so they stay the same all day. Rewards 10 / 15 / 20 min of income; finishing all three opens a chest (30 min of income + Rush 1h). Rush rewards respect the usual Rush cap.

| Task | Easy | Medium | Hard |
|---|---|---|---|
| Upgrade sections (levels bought by the player) | 10 | 25 | 50 |
| Level up dishes | 10 | 25 | 50 |
| Tap the restaurant | 30 | 60 | 100 |
| Run the restaurant (game open) | 5 min | 10 min | 20 min |
| Start a research project (left out once the lab is finished) | 1 | 1 | 1 |
| Serve VIP guests (watch the VIP ad) | 1 | 1 | 2 |

The daily state lives in the economy (`daily`) and moves along with a franchise. Code: `src/core/economy/daily.ts` (`DAILY`), `src/game/ui/DailyModal.ts`.

Next to "Collect", a "Collect 2x" button doubles the day's reward (money and Rush) for a rewarded ad (placement `dailyDouble`).

Later ideas: weekly tasks; a streak-saver.

## 6e. Scene events

Added 2026-11-07 (retention, third step) so a session has surprises and short goals. While the game is open, one event starts 2.5 minutes in and then every 4-6 minutes (never the same kind twice in a row; paused before the first bottleneck tip and while the daily dialog or the world map is open). A card under the goal bar shows the event's title, detail, progress bar and time left. Events are not saved: closing the game ends them. Numbers live in `EVENTS` in the economy config, logic in `src/core/economy/events.ts`.

- **Food critic (60 s):** a critic in a beret with a notepad stands among the tables. The goal is a customer rate a bit above the current one: what spending half the current money plus 30 s of income on the bottleneck would reach, clamped to 1.05x-1.3x of now (no critic when even 1.05x is out of reach). Reaching it in time gives a 5-star review: income x1.5 for 15 minutes (stacks with Rush, runs offline like Rush, does not carry through a franchise). Missing it: the critic shrugs and leaves.
- **Tour bus (25 s):** five tourists with cameras gather by the door. Every tap pays a tip of 1 s of income times the combo; six quick taps raise the combo by one (up to x5), a pause over 1.2 s resets it. If the tips reach at least 20 s of income, the player may watch an ad to get them again (2x, placement `busDouble`).
- **Food festival (3 min):** a random unlocked dish of the city sells at 3x its price; the extra income shows in the HUD.

## 7. Economy math

All numbers live in `src/core/economy/config.ts`. Balance is checked with the simulation (`npm run sim`, or `/sim.html` on the dev server for charts).

- **Income/s** = `min(section rates) × bill per customer × (1 + 0.1 × stars) × (1 + 0.25 × Secret Spices) × (1 + 0.5 × Famous Chain)`
- **Section rate** = `baseRate × level × 1.5^milestones`. **Dish price** = `basePrice × level × 2^milestones`. Milestones: 10, 25, 50, 75, 100, 150, 200, …
- **Upgrade cost:** `cost(level) = baseCost × r^(level-1)`. Sections have r = 1.20–1.22 and dishes r = 1.25. Each section has its own curve, so the bottleneck moves around as the restaurant grows (entrance and waiters early, kitchen and seating later).
- **Dish unlock costs** are calibrated so that each new dish arrives just as growth from the previous one starts to stall.
- **Cities:** every dish tier (`DISH_TIERS`) is reused in each city. In the n-th city prices are ×1000ⁿ (bigger numbers feel like progress) and all costs are ×1000ⁿ × (1 + 0.1 × 10n) × (1 + 0.6n), i.e. also scaled by the star bonus and part of the lab/perk bonus a player is expected to bring. Players get ahead of that scale in the first cities (they feel stronger), then cities settle at about 35-40 minutes. Local Suppliers lowers costs on top.
- **Prestige reward:** see section 6; +10% income per star.
- **Offline earnings:** income/s × time away, capped at 2 hours at first (upgradable later). Applies both when the game was closed and when it was in the background; absences over 1 minute show a "Welcome back" dialog.
- **Saving:** every 10 s, after each purchase and when the game goes to the background. Saves are repaired on load (missing sections/dishes get starting values), so adding content later does not break old saves.
- **Big numbers:** plain JS numbers for now; they reach ~1e308, which covers the whole planned content. Switch to `break_infinity.js` only if later cities exceed that. Display: 1.5K, 3.2M, 7.8B, T, then aa, ab, …

### Simulated pacing (greedy bot, active play, no ads)

The bot franchises once the menu is complete and its stars per hour peak. It keeps the Lab busy (Secret Spices / Local Suppliers, whichever finishes sooner) and picks Famous Chain whenever offered. The Lab runs on real time, so the simulation assumes the player is in the game a quarter of the time (`--lab 4`: 4 real seconds per second of play).

| City | Duration | Stars gained | Lab (Spices/Suppliers) at the end |
|---|---|---|---|
| Istanbul | 57m | 11 | 3/3 |
| Rome | 40m | 10 | 4/4 |
| Paris | 44m | 11 | 5/4 |
| Cairo … Rio | 34-39m | 9-11 | 5-6/4-5 |

Before the Lab and perks every city took 1h 31m (each one a copy of the first). A player who barely leaves the game (`--lab 1`) sees 1h 9m, 52m, 50m, 47m. Prices grow ×1000 per city, so even many tours stay far below the 1e308 limit of plain JS numbers.

## 8. Rewarded ad placements

| Ad | Reward |
|---|---|
| Rush | 2x income for 4 hours, stackable (most important) |
| Time skip | Instant 1 hour of earnings |
| Offline earnings | Collect 2x/3x on return |
| Wandering customer / VIP tourist | Randomly appearing customer, big tip for watching an ad |
| Staff discount | Hire the next staff member cheaper by watching an ad |

Implemented (7a): Rush gives 2x income for 4 hours per ad and stacks up to 12 hours; its time keeps running while the player is away, so offline earnings use the boosted rate only for the Rush part. Time skip ("Extra cash") pays one hour of current income at once and then has a 30 minute cooldown; it is offered from a green "+" at the right end of the money counter, which turns grey while cooling down (tapping it then shows the time left). The welcome-back dialog offers "Collect 2x". Every ad starts from a dialog that shows the reward, and a skipped ad gives nothing. Rush time and the cooldown carry over through a franchise. Numbers live in `ADS` in the economy config.

Implemented (7b): a VIP guest (a food tourist with a sun hat and a star bubble) walks in after 4 minutes of play and then every 8-12 minutes (kept rare so ads never feel pushed), and waits near the door for 40 s. Tapping them offers a tip worth 15 minutes of income (Rush does not raise it) for an ad; saying no or ignoring them sends them away. The staff discount placement is left for later.

Added with the retention features: "Collect 2x" on the daily reward (`dailyDouble`, section 6d) and doubling the tour bus tips (`busDouble`, section 6e). Each placement has its own ad unit in AdMob (`src/game/ads/adUnits.ts`).

IAP: Remove ads (grants ad rewards without ads), permanent 2x income, starter packs.

## 9. Visual direction

- A **living restaurant scene** instead of a list screen: walking customers, waiters, steaming stoves.
- **Calm, not hectic**: the scene shows at most about one customer every two seconds and people walk unhurried; it should feel like a pleasant place to watch, never overwhelming. Big celebrations (banner + confetti) only for big moments; level milestones get a short note. Ads are always the player's choice.
- **Interface style: soft, glossy and lively** (like candy toys): the rounded Fredoka font with white text outlined in dark brown, chunky glossy pill buttons with a light rim and a dark outline, dark translucent counter pills with the icon overlapping their left end, soft gradient cards, and a red and cream striped awning as the HUD. Shared helpers live in `src/game/ui/style.ts`.
- Warm, saturated colors; palette changes per city (Istanbul: copper, pomegranate red, tile blue, saffron).
- Cute characters with soft shading and depth (painted in code into 2x textures, so they stay sharp when zoomed in).
- "Juice": particles, tweens, gentle number pop-ups; no screen shake.
- Upgrade panel rows carry painted round icons: one per section, one per dish (dishes share 14 shapes such as bowl, wrap, slice, with their own colors).
- **Sound** is synthesized with the Web Audio API (no files): soft mallet and bell effects for taps, coins, purchases, new looks, the VIP and ready goals; a relaxed 84 bpm café loop (electric piano, bass, brushes, a vibraphone tune from the second loop). Sound and music switch on and off in the settings (gear in the HUD) and pause in the background.
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
8. ~~Android build with Capacitor, test on phone~~
9. Localization (EN/TR/FR/ZH done), release signing and store assets (done), Play Store release

## 12. Open questions

- Should delivery be in the first release, or come with an update?
- Final list of dishes and cities
- Music/sound: synthesized in code for now (see section 9); real recordings later if needed
