import { HEROES, ROLES, metaTierFor } from './data.js';
import { scoreCounterVsEnemy } from './scoring.js';

// Standard 5v5 composition. Used to figure out which slots are still open.
export const STANDARD_COMP = { tank: 1, dps: 2, support: 2 };

// Map a meta tier to a 0-10 desirability score (current performance).
const TIER_VALUE = { S: 10, A: 8.5, B: 7, C: 5.5, D: 4, E: 2.5 };
function tierValue(id) {
  return TIER_VALUE[metaTierFor(id).tier] ?? 6;
}

// Which role slots remain open in a team, e.g. ['dps', 'support'].
export function openRoles(team) {
  const counts = { tank: 0, dps: 0, support: 0 };
  for (const h of team) counts[h.role]++;
  const open = [];
  for (const role of ROLES) {
    const need = (STANDARD_COMP[role] || 0) - counts[role];
    for (let i = 0; i < need; i++) open.push(role);
  }
  return open;
}

function teamTagSet(team) {
  const tags = new Set();
  for (const h of team) for (const t of h.tags || []) tags.add(t);
  return tags;
}

// Crude synergy proxy: how many of a candidate's tags the team already shares
// (rewards thematic consistency, e.g. dive-with-dive, shield-with-shield). 0-3.
function synergyScore(candidate, teamTags) {
  if (teamTags.size === 0) return 0;
  let shared = 0;
  for (const t of candidate.tags || []) if (teamTags.has(t)) shared++;
  return Math.min(shared, 3);
}

// Average counter score of a candidate against the enemy team (1-10), or null.
function counterScore(candidate, enemyTeam) {
  if (!enemyTeam || enemyTeam.length === 0) return null;
  const sum = enemyTeam.reduce((acc, e) => acc + scoreCounterVsEnemy(candidate, e).score, 0);
  return sum / enemyTeam.length;
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

// Recommend heroes to round out `myTeam`, optionally biased to counter `enemyTeam`.
// Returns { openRoles, byRole: { role: [{hero, score, reasons, ...}] } }.
export function recommendTeamCompletion(myTeam, enemyTeam = []) {
  const taken = new Set([...myTeam, ...enemyTeam].map((h) => h.id));
  const teamTags = teamTagSet(myTeam);
  const roles = openRoles(myTeam);
  const byRole = {};

  for (const role of [...new Set(roles)]) {
    const candidates = HEROES.filter((h) => h.role === role && !taken.has(h.id));
    const scored = candidates.map((c) => {
      const meta = tierValue(c.id);
      const syn = synergyScore(c, teamTags);
      const syn10 = (syn / 3) * 10;
      const cs = counterScore(c, enemyTeam);

      const tier = metaTierFor(c.id);
      const reasons = [{ kind: 'meta', text: `${tier.tier}-tier${tier.winrate != null ? ` · ${tier.winrate}% win` : ''}` }];

      let total;
      if (cs != null) {
        total = 0.45 * meta + 0.35 * cs + 0.2 * syn10;
        if (cs >= 6.5) reasons.push({ kind: 'counter', text: 'Strong into the enemy team' });
      } else {
        total = 0.7 * meta + 0.3 * syn10;
      }
      if (syn >= 2) reasons.push({ kind: 'synergy', text: "Fits your team's style" });

      return { hero: c, score: round1(total), reasons, meta, synergy: syn, counter: cs };
    });
    scored.sort((a, b) => b.score - a.score);
    byRole[role] = scored;
  }

  return { openRoles: roles, byRole };
}
