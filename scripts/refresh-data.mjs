#!/usr/bin/env node
//
// refresh-data.mjs — keep the hero roster in sync with the live game.
//
// Counter Watch's data was hand-seeded and goes stale every time Blizzard ships
// a hero or a balance patch. This script checks the bundled roster against the
// OverFast API (https://overfast-api.tekrop.fr), a community mirror of Blizzard's
// own hero data, and tells you exactly what drifted.
//
//   npm run refresh-data            # dry run — report only, touches nothing
//   npm run refresh-data -- --write # apply the safe, additive changes below
//
// What --write does (additive + non-destructive; it never edits your curated
// matchups, scores, or tuned attributes):
//   1. Appends any brand-new hero to heroes.json as a NEW placeholder you refine.
//   2. Backfills `subrole` (Blizzard hero archetype) where missing.
//   3. Fills portrait-sources.json with the API's portrait URLs so
//      `npm run fetch-portraits` can pull art for heroes that lack it.
//   4. Stamps _meta.roster_size / last_updated / last_checked.
//
// What it CANNOT do automatically: tier lists, win rates and the "S-tier"-style
// flavour in hero/counter notes. No free API exposes reliable competitive meta,
// so the script only flags how stale that data is — refresh it by hand (or wire
// a stats source into the META section below). See README "Keeping data fresh".

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');
const HEROES_FILE = resolve(PROJECT_ROOT, 'src/data/heroes.json');
const META_FILE = resolve(PROJECT_ROOT, 'src/data/meta.json');
const PORTRAITS_FILE = resolve(PROJECT_ROOT, 'scripts/portrait-sources.json');

const API_URL = 'https://overfast-api.tekrop.fr/heroes';
const ROLE_MAP = { tank: 'tank', damage: 'dps', support: 'support' };
const ROLE_ORDER = ['tank', 'dps', 'support'];
const STALE_AFTER_DAYS = 14; // ~one patch / season cadence

const WRITE = process.argv.includes('--write');
const TODAY = new Date().toISOString().slice(0, 10);

// ---- faithful JSON formatting (round-trips heroes.json byte-for-byte) --------
// Matches the hand-authored style: one compact, space-padded object per line,
// a blank line between role groups. Re-serializing is therefore idempotent.

function fmtValue(v) {
  if (Array.isArray(v)) return '[' + v.map(fmtValue).join(', ') + ']';
  return JSON.stringify(v);
}
function fmtHero(h) {
  const body = Object.entries(h)
    .map(([k, v]) => JSON.stringify(k) + ': ' + fmtValue(v))
    .join(', ');
  return '    { ' + body + ' }';
}
function serializeHeroesFile(meta, heroes) {
  const head = JSON.stringify({ _meta: meta }, null, 2).replace(/\n}\s*$/, '');
  const groups = ROLE_ORDER.map((role) =>
    heroes.filter((h) => h.role === role).map(fmtHero).join(',\n'),
  ).filter(Boolean);
  return head + ',\n  "heroes": [\n' + groups.join(',\n\n') + '\n  ]\n}\n';
}

// canonical key order for heroes the script creates from scratch
function placeholderHero(api) {
  return {
    id: api.key,
    name: api.name,
    role: ROLE_MAP[api.role],
    subrole: api.subrole || '',
    damage_type: 'mixed',
    range: 'mid',
    mobility: 'medium',
    tags: [],
    portrait_file: `${api.key}.png`,
    new_hero: true,
    notes: `Auto-added from OverFast API on ${TODAY}. Kit unverified — refine attributes in heroes.json and add matchups in counters.json.`,
  };
}

function daysSince(dateStr) {
  const then = Date.parse(dateStr);
  if (Number.isNaN(then)) return null;
  return Math.floor((Date.now() - then) / 86_400_000);
}

async function main() {
  const heroesDoc = JSON.parse(await readFile(HEROES_FILE, 'utf-8'));
  const heroes = heroesDoc.heroes;
  const byId = new Map(heroes.map((h) => [h.id, h]));

  console.log(`Counter Watch data refresh — ${WRITE ? 'WRITE' : 'dry run (use --write to apply)'}`);
  console.log(`Local roster: ${heroes.length} heroes, last_updated ${heroesDoc._meta.last_updated}\n`);

  let api;
  try {
    const res = await fetch(API_URL, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    api = await res.json();
  } catch (err) {
    console.error(`Could not reach OverFast API (${err.message}).`);
    console.error('Roster check skipped — you are offline or the API is down. No files changed.');
    process.exit(1);
  }

  const apiById = new Map(api.map((a) => [a.key, a]));
  console.log(`Live API roster: ${api.length} heroes\n`);

  // ---- diff -----------------------------------------------------------------
  const added = api.filter((a) => !byId.has(a.key));
  const removed = heroes.filter((h) => !apiById.has(h.id));
  const roleChanges = [];
  const subroleFills = [];
  for (const h of heroes) {
    const a = apiById.get(h.id);
    if (!a) continue;
    if (ROLE_MAP[a.role] !== h.role) roleChanges.push({ id: h.id, was: h.role, now: ROLE_MAP[a.role] });
    if (a.subrole && a.subrole !== h.subrole) subroleFills.push({ id: h.id, was: h.subrole || '(none)', now: a.subrole });
  }

  // ---- roster report --------------------------------------------------------
  if (added.length) {
    console.log(`NEW heroes in game, missing from app (${added.length}):`);
    for (const a of added) console.log(`  + ${a.key} (${ROLE_MAP[a.role]}/${a.subrole || '?'})`);
  } else {
    console.log('Roster: in sync — no new heroes.');
  }
  if (removed.length) {
    console.log(`\nIn app but NOT in live API (renamed/removed? — left untouched):`);
    for (const h of removed) console.log(`  - ${h.id}`);
  }
  if (roleChanges.length) {
    console.log(`\nRole changes (review manually — not auto-applied):`);
    for (const c of roleChanges) console.log(`  ~ ${c.id}: ${c.was} -> ${c.now}`);
  }
  if (subroleFills.length) {
    console.log(`\nSubrole updates (${subroleFills.length})${WRITE ? ' — applying' : ' — run --write to apply'}:`);
    for (const s of subroleFills) console.log(`  ~ ${s.id}: ${s.was} -> ${s.now}`);
  }

  // ---- competitive win-rate stats (powers the Tier Rankings) ----------------
  // Pull official Blizzard competitive win/pick rates (via OverFast) into
  // meta.json. Hero tiers derive from these unless manually overridden.
  console.log('\n— Competitive meta (src/data/meta.json) —');
  let metaDoc = null;
  try {
    metaDoc = JSON.parse(await readFile(META_FILE, 'utf-8'));
  } catch {
    console.log('  meta.json missing or unreadable — skip.');
  }
  if (metaDoc) {
    const m = metaDoc._meta || {};
    console.log(`  Snapshot: ${m.season || '?'} — stats_updated ${m.stats_updated || 'never'}`);
    const age = daysSince(m.stats_updated);
    if (age !== null && age > STALE_AFTER_DAYS) {
      console.log(`  Win-rate stats are ${age} days old (> ${STALE_AFTER_DAYS}) — refreshing recommended.`);
    }
    const statsUrl = m.stats_url;
    let stats = null;
    if (statsUrl) {
      try {
        const res = await fetch(statsUrl, { headers: { Accept: 'application/json' } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const arr = await res.json();
        stats = {};
        for (const s of arr) stats[s.hero] = { winrate: s.winrate, pickrate: s.pickrate };
        console.log(`  Fetched win/pick rates for ${Object.keys(stats).length} heroes.`);
      } catch (err) {
        console.log(`  Could not fetch win-rate stats (${err.message}) — leaving meta.json stats unchanged.`);
      }
    }
    if (stats) {
      // tier distribution preview from the freshly fetched numbers
      const th = m.tier_thresholds || {};
      const tierOf = (w) =>
        w >= th.S ? 'S' : w >= th.A ? 'A' : w >= th.B ? 'B' : w >= th.C ? 'C' : w >= th.D ? 'D' : 'E';
      const dist = { S: 0, A: 0, B: 0, C: 0, D: 0, E: 0 };
      for (const v of Object.values(stats)) dist[tierOf(v.winrate)]++;
      console.log(`  Win-rate tier spread: ${Object.entries(dist).map(([t, n]) => t + ':' + n).join('  ')}`);
      if (WRITE) {
        metaDoc.stats = stats;
        metaDoc._meta.stats_updated = TODAY;
        await writeFile(META_FILE, JSON.stringify(metaDoc, null, 2) + '\n');
        console.log('  Wrote src/data/meta.json (stats + stats_updated).');
      } else {
        console.log('  (run --write to save these into meta.json)');
      }
    }
    console.log('  Tip: tiers derive from win rate; keep manual nuance in meta.json "overrides".');
  }

  if (!WRITE) {
    const changes = added.length + subroleFills.length;
    console.log(`\nDry run complete. ${changes} additive change(s) available — re-run with --write to apply.`);
    return;
  }

  // ---- apply (additive only) ------------------------------------------------
  let touched = false;

  for (const s of subroleFills) {
    byId.get(s.id).subrole = s.now; // fill/refresh Blizzard archetype only
    touched = true;
  }

  const appended = added.map(placeholderHero);
  if (appended.length) {
    heroes.push(...appended);
    touched = true;
  }

  if (touched) {
    heroesDoc._meta.roster_size = heroes.length;
    heroesDoc._meta.last_updated = TODAY;
    heroesDoc._meta.last_checked = new Date().toISOString();
    await writeFile(HEROES_FILE, serializeHeroesFile(heroesDoc._meta, heroes));
    console.log(`\nWrote src/data/heroes.json (${heroes.length} heroes).`);
    if (appended.length) {
      console.log('Added placeholders — refine their attributes and matchups:');
      for (const h of appended) console.log(`  ${h.id}`);
    }
  } else {
    console.log('\nheroes.json already up to date — nothing to write.');
  }

  // ---- portrait URLs from the API ------------------------------------------
  try {
    const pdoc = JSON.parse(await readFile(PORTRAITS_FILE, 'utf-8'));
    pdoc._overrides = pdoc._overrides || {};
    let filled = 0;
    for (const a of api) {
      if (!pdoc._overrides[a.key] && a.portrait) {
        pdoc._overrides[a.key] = a.portrait;
        filled++;
      }
    }
    if (filled) {
      await writeFile(PORTRAITS_FILE, JSON.stringify(pdoc, null, 2) + '\n');
      console.log(`\nFilled ${filled} portrait URL(s) in scripts/portrait-sources.json.`);
      console.log('Run `npm run fetch-portraits` to download them.');
    }
  } catch (err) {
    console.error(`\nSkipped portrait URLs (${err.message}).`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
