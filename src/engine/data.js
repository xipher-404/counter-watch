import heroesData from '../data/heroes.json';
import countersData from '../data/counters.json';
import rulesData from '../data/rules.json';
import metaData from '../data/meta.json';

export const HEROES = heroesData.heroes;
export const HEROES_META = heroesData._meta;
export const HEROES_BY_ID = Object.fromEntries(HEROES.map((h) => [h.id, h]));

export const COUNTER_OVERRIDES = countersData.overrides;
export const COUNTERS_META = countersData._meta;

export const RULES = rulesData.rules;
export const RULES_META = rulesData._meta;

// Current competitive meta snapshot. Hybrid: a hero's tier is derived from its
// official win rate (stats) unless a manual override is set. Fast-drifting;
// refreshed separately from the stable roster/kit data via `npm run refresh-data`.
export const META = metaData._meta;
export const META_SUMMARY = metaData.summary;
export const META_OVERRIDES = metaData.overrides || {};
export const META_STATS = metaData.stats || {};
export const META_COMMUNITY_LINKS = metaData._meta.community_links || [];
export const TIER_ORDER = metaData._meta.tier_order || ['S', 'A', 'B', 'C', 'D', 'E'];
const DEFAULT_TIER = metaData._meta.default_tier || 'B';
const THRESHOLDS = metaData._meta.tier_thresholds || {};
const TIER_WEIGHTS = metaData._meta.tier_weights || {};

function deriveTier(winrate) {
  if (winrate == null) return null;
  if (winrate >= THRESHOLDS.S) return 'S';
  if (winrate >= THRESHOLDS.A) return 'A';
  if (winrate >= THRESHOLDS.B) return 'B';
  if (winrate >= THRESHOLDS.C) return 'C';
  if (winrate >= THRESHOLDS.D) return 'D';
  return 'E';
}

// Resolve a hero's current-meta tier. source: 'override' (manual) | 'winrate'
// (derived from official stats) | 'default' (no data). winrate/pickrate exposed
// for display. `explicit` = has a real tier (override or win-rate), not a fallback.
export function metaTierFor(id) {
  const override = META_OVERRIDES[id];
  const stat = META_STATS[id];
  const winrate = stat?.winrate ?? null;
  const pickrate = stat?.pickrate ?? null;
  if (override?.tier) {
    return { tier: override.tier, note: override.note || '', source: 'override', explicit: true, winrate, pickrate };
  }
  const derived = deriveTier(winrate);
  if (derived) {
    return { tier: derived, note: '', source: 'winrate', explicit: true, winrate, pickrate };
  }
  return { tier: DEFAULT_TIER, note: '', source: 'default', explicit: false, winrate, pickrate };
}

// Weight a hero carries when it's the *enemy* being countered: countering a
// stronger pick matters more than a weak one. 1.0 = neutral.
export function metaWeightFor(id) {
  return TIER_WEIGHTS[metaTierFor(id).tier] ?? 1.0;
}

export const ROLES = ['tank', 'dps', 'support'];
export const DAMAGE_TYPES = ['hitscan', 'projectile', 'beam', 'melee', 'mixed'];

export function heroesByRole(role) {
  return HEROES.filter((h) => h.role === role);
}
