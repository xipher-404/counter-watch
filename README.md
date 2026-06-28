# Counter Watch

A local Overwatch counter-pick assistant. Pick the enemy hero (or whole team) and get a ranked list of counter heroes across all three roles. Runs in the browser as a PWA, can be packaged into an Android APK via Capacitor.

## What it does

- **Single tab** — tap one enemy hero, see top counters with scores 1–10 and reasons (hitscan vs flying, anti-heal vs Mauga, etc.).
- **Team tab** — fill 5 enemy slots (1 tank, 2 dps, 2 support); recommendations re-rank against the whole composition.
- **Admin tab** — upload portraits for any hero. Uploads persist in IndexedDB and override bundled images.
- Filter by counter role and damage type (hitscan / projectile / beam / melee / mixed).

## Stack

- Vanilla JS + [Vite](https://vitejs.dev/) — no framework
- JSON data files (no database)
- IndexedDB (via `idb`) for user-uploaded portraits
- [`vite-plugin-pwa`](https://vite-pwa-org.netlify.app/) — service worker, install prompt
- [Capacitor](https://capacitorjs.com/) — Android packaging

## Quick start

```bash
npm install
npm run dev
```

Then open the printed URL (default <http://localhost:5173>) in a browser. The dev server binds to all interfaces, so you can also open it from your phone on the same Wi-Fi.

## Add hero portraits

The bundled app ships with no portraits — you populate them. Three options, in order of effort:

1. **In-app upload (easiest)** — open the **Admin** tab, click upload on any hero, pick a file. Saves to IndexedDB; persists across reloads in browser and in the APK.
2. **Drop files into `public/assets/heroes/`** — name them `{hero-id}.png` (IDs are listed in `src/data/heroes.json`, e.g. `reinhardt.png`, `soldier-76.png`, `junker-queen.png`). These are bundled into the build.
3. **Batch download** — edit `scripts/portrait-sources.json` and paste direct image URLs for any hero. Then run:

   ```bash
   npm run fetch-portraits
   ```

   The script writes successful downloads to `public/assets/heroes/` and dumps a checklist of remaining heroes to `scripts/missing-portraits.txt`.

App icons (`public/assets/icon-192.png`, `icon-512.png`) are also up to you to add — without them the PWA install prompt has no icon, but the app still works.

## Build & PWA

```bash
npm run build      # outputs to dist/
npm run preview    # serves dist/ for local check
```

The `dist/` folder is a static site you can serve from any HTTP server (Apache via Laragon, Nginx, `python -m http.server`, etc.).

## Android (APK via Capacitor)

```bash
npx cap add android      # one-time, after first build
npm run cap:sync         # rebuild + sync to android/
npm run cap:open         # open Android Studio to build the APK
```

Requires Android Studio + JDK installed. Capacitor wraps the same web bundle, so anything that works in the browser will work in the APK. (Uploaded portraits stored in IndexedDB persist inside the APK's WebView storage.)

## Data sources

Seed data was pulled from public sources on **April 26, 2026**, then re-verified against the live game on **June 27, 2026**. Each entry in the JSON files records its source and date.

| Data | Source | Last updated |
|---|---|---|
| Hero roster (52) | [OverFast API](https://overfast-api.tekrop.fr) (mirrors Blizzard) + [Dexerto Wiki](https://www.dexerto.com/wikis/overwatch/heroes/) | 2026-06-27 |
| Counter matchups | [esports.gg counters guide](https://esports.gg/news/overwatch/overwatch-2-hero-counters/) | 2026-04-14 (Shion: 2026-06) |
| Tier list (`meta.json`) | [Counterwatch.gg](https://www.counterwatch.gg/stats/overwatch/tier-list) / Mobalytics / PC Gamer consensus | 2026-06-28 (Season 3) |
| New-hero kits | OverFast API hero details + GosuGamers / GameRant / PC Gamer | 2026-06 |

The roster is current through **Shion** (Hero 52, Season 3 "Into the Tiger's Den", 2026-06-16). The 2025–2026 heroes (Domina, Emre, Anran, Mizuki, Jetpack Cat, Sierra, Vendetta, Wuyang, Hazard, Freja) shipped after the seed AI's training cutoff and once carried placeholder attributes — their kits are **now verified** from the API and public reveals. Every hero also records a `subrole` (Blizzard's hero archetype, e.g. *initiator*, *flanker*, *stalwart*).

### Current meta (`src/data/meta.json`)

`meta.json` holds a dated Season 3 tier list (S/A/B/C/D) used to badge heroes in the UI — pick an enemy and you'll see their current standing on the portrait (top-left) and in the counters header. It's a **community-consensus snapshot, not exact ladder stats**: Overwatch patches roughly every two weeks and tier sources openly disagree (the same week, Reinhardt was rated S-tier by win-rate trackers and D-tier by editorial guides). Heroes without an explicit entry default to tier **B** (viable). Refresh it by re-pulling current placements and replacing the file — `npm run refresh-data` flags how stale it is. This is the fastest-drifting data in the app; treat it as a hint, not gospel.

## Keeping data fresh

Run the roster check any time — it compares the bundled roster against the live OverFast API:

```bash
npm run refresh-data            # dry run: report new heroes, role/subrole drift, staleness
npm run refresh-data -- --write # apply the safe, additive changes
```

`--write` is **non-destructive** — it never edits your tuned scores, matchups, or attributes. It only:

1. **Appends brand-new heroes** to `heroes.json` as `new_hero` placeholders for you to refine, and adds their matchups in `counters.json` by hand.
2. **Backfills `subrole`** where missing.
3. **Fills portrait URLs** in `scripts/portrait-sources.json` from the API — then `npm run fetch-portraits` downloads them (this now works without hunting for image links).
4. **Stamps** `_meta.roster_size` / `last_updated` / `last_checked`.

What it can't do automatically is the competitive meta — no free API exposes reliable win rates, so the script just flags how stale `last_updated` is and points you at current tier-list sources. Update those notes by hand (or wire a stats source into the META section of `scripts/refresh-data.mjs`).

## How scoring works

For each (counter, enemy) pair the engine computes:

```
final = clamp(base + Σ(rule modifiers))      // OR  override.score if present
```

- `base = 5` (neutral)
- **Rules** (`src/data/rules.json`) are attribute matchups: e.g. *hitscan vs flying* → +2.5. Multiple rules can stack.
- **Overrides** (`src/data/counters.json`) are explicit per-pair scores from the web sources. When an override exists, it wins outright.

This means even matchups not explicitly listed get a reasonable score from the rules, and you can tune *either* layer:

- Tweak `counters.json` to adjust specific matchups
- Tweak `rules.json` to adjust the systemic logic that affects every hero with that attribute

### Meta-weighted team scoring

In the **Team** tab, a counter's overall score is the average of its scores against each enemy. By default that average is **weighted by each enemy's meta tier** (`meta.json` → `tier_weights`), so the ranking favours heroes that shut down the enemy's strongest picks rather than their weakest:

```
team score = Σ(score_vs_enemy × tier_weight(enemy)) / Σ(tier_weight(enemy))
```

With the default weights (S 1.5 · A 1.2 · B 1.0 · C 0.85 · D 0.7), countering an S-tier carry counts ~2× a D-tier filler. A toggle in the counters modal turns it off (plain average), and each enemy's tier is shown next to its name in the breakdown so you can see what's pulling the ranking. It only affects multi-enemy ranking — a single enemy is unweighted. Set every `tier_weight` to `1.0` to disable it globally.

Tier mapping (used in score badge color):
- ≥ 8.5 → S
- ≥ 7.5 → A
- ≥ 6.5 → B
- ≥ 5.5 → C
- otherwise → D

## File map

```
src/
  main.js                # entry — tab routing
  styles.css             # all styles
  data/
    heroes.json          # 52 heroes + attributes (role, subrole, damage type, tags)
    counters.json        # explicit matchup scores
    rules.json           # attribute-based scoring rules
    meta.json            # current-season tier list (S/A/B/C/D) — drifts every patch
  engine/
    data.js              # data loaders + helpers
    scoring.js           # scoring + ranking
    storage.js           # IndexedDB wrapper
    portraits.js         # portrait URL resolution + cache
  ui/
    components.js        # el(), heroPortrait(), score badges
    filters.js           # role + damage type chips
    single-pick.js       # tab 1
    team-pick.js         # tab 2
    admin.js             # tab 3
scripts/
  refresh-data.mjs       # sync roster vs live OverFast API (npm run refresh-data)
  fetch-portraits.mjs    # batch portrait download from URLs
  portrait-sources.json  # id -> URL map (auto-filled by refresh-data --write)
public/
  assets/                # bundled images go here
    heroes/              # {hero-id}.png portraits
```

## Editing data

The data files are designed to be hand-edited as the META shifts:

- **New hero appears** — run `npm run refresh-data -- --write` to scaffold the entry, then fill in real attributes; matchups derive from rules until you add explicit overrides in `counters.json`.
- **Patch changes a hero** — edit attributes in `heroes.json` (e.g. change `damage_type` if Blizzard reworks them).
- **Pro meta shifts** — adjust scores in `counters.json` overrides.
- **You disagree with a heuristic** — change the modifier in `rules.json`.

After saving, the Vite dev server hot-reloads.
