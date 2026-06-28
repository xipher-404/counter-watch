import { HEROES, HEROES_BY_ID, COUNTER_OVERRIDES, RULES, RULES_META, metaTierFor, metaWeightFor } from './data.js';

const BASE_SCORE = RULES_META.base_score ?? 5;

function attrMatches(hero, condition) {
  if (!condition) return true;
  for (const [key, value] of Object.entries(condition)) {
    if (key === 'tags_any') {
      const heroTags = hero.tags || [];
      if (!value.some((t) => heroTags.includes(t))) return false;
    } else if (Array.isArray(value)) {
      if (!value.includes(hero[key])) return false;
    } else {
      if (hero[key] !== value) return false;
    }
  }
  return true;
}

export function scoreCounterVsEnemy(counter, enemy) {
  const override = COUNTER_OVERRIDES[enemy.id]?.[counter.id];
  if (override) {
    return {
      score: clamp(override.score),
      reasons: [{ text: override.reason || 'Listed counter', source: override.source, kind: 'override' }],
      hasOverride: true,
    };
  }
  let score = BASE_SCORE;
  const reasons = [];
  for (const rule of RULES) {
    if (attrMatches(counter, rule.if_counter) && attrMatches(enemy, rule.if_enemy)) {
      score += rule.modifier;
      reasons.push({ text: rule.reason, source: 'rule:' + rule.id, kind: 'rule', modifier: rule.modifier });
    }
  }
  return { score: clamp(score), reasons, hasOverride: false };
}

export function rankCountersFor(enemyOrEnemies, options = {}) {
  const enemies = Array.isArray(enemyOrEnemies) ? enemyOrEnemies : [enemyOrEnemies];
  if (enemies.length === 0) return [];
  const filterRole = options.role || null;
  const filterDamageTypes = options.damageTypes || null;
  // Weight each enemy's contribution by its meta tier so countering the enemy's
  // strongest picks ranks higher. Only matters with >1 enemy (uniform otherwise).
  const weightByMeta = options.weightByMeta !== false && enemies.length > 1;
  const candidates = HEROES.filter((h) => {
    if (filterRole && h.role !== filterRole) return false;
    if (filterDamageTypes && filterDamageTypes.length > 0 && !filterDamageTypes.includes(h.damage_type)) return false;
    return true;
  });
  const scored = candidates.map((counter) => {
    const perEnemy = enemies.map((enemy) => {
      const meta = metaTierFor(enemy.id);
      return {
        enemyId: enemy.id,
        enemyTier: meta.tier,
        enemyTierExplicit: meta.explicit,
        weight: metaWeightFor(enemy.id),
        ...scoreCounterVsEnemy(counter, enemy),
      };
    });
    let totalScore;
    if (weightByMeta) {
      const wsum = perEnemy.reduce((s, r) => s + r.weight, 0);
      totalScore = perEnemy.reduce((s, r) => s + r.score * r.weight, 0) / wsum;
    } else {
      totalScore = perEnemy.reduce((s, r) => s + r.score, 0) / enemies.length;
    }
    return {
      hero: counter,
      score: round1(totalScore),
      perEnemy,
      weighted: weightByMeta,
    };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored;
}

function clamp(n) {
  return Math.max(1, Math.min(10, n));
}
function round1(n) {
  return Math.round(n * 10) / 10;
}

export function scoreToTier(score) {
  if (score >= 8.5) return 'S';
  if (score >= 7.5) return 'A';
  if (score >= 6.5) return 'B';
  if (score >= 5.5) return 'C';
  return 'D';
}

export function lookupHero(id) {
  return HEROES_BY_ID[id] || null;
}
