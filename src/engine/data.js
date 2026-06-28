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

// Current competitive meta snapshot (tier list). Fast-drifting; refreshed
// separately from the stable roster/kit data. Heroes without an explicit
// entry fall back to default_tier.
export const META = metaData._meta;
export const META_SUMMARY = metaData.summary;
export const META_TIERS = metaData.tiers;
const DEFAULT_TIER = metaData._meta.default_tier || 'B';
const TIER_WEIGHTS = metaData._meta.tier_weights || {};

export function metaTierFor(id) {
  const entry = META_TIERS[id];
  return { tier: entry?.tier || DEFAULT_TIER, note: entry?.note || '', explicit: !!entry };
}

// Weight a hero carries when it's the *enemy* being countered: countering a
// meta-defining S/A pick matters more than countering a weak filler. 1.0 = neutral.
export function metaWeightFor(id) {
  return TIER_WEIGHTS[metaTierFor(id).tier] ?? 1.0;
}

export const ROLES = ['tank', 'dps', 'support'];
export const DAMAGE_TYPES = ['hitscan', 'projectile', 'beam', 'melee', 'mixed'];

export function heroesByRole(role) {
  return HEROES.filter((h) => h.role === role);
}
