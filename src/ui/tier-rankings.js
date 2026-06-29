import { el, heroPortrait, clearChildren } from './components.js';
import {
  HEROES,
  heroesByRole,
  ROLES,
  metaTierFor,
  META,
  META_SUMMARY,
  META_COMMUNITY_LINKS,
  TIER_ORDER,
} from '../engine/data.js';
import { openCountersFor } from './counters-modal.js';

export async function renderTierRankings(root) {
  clearChildren(root);
  const state = { role: null };

  const view = el('section', { class: 'tab-view tier-rankings' });
  view.appendChild(el('h2', {}, 'Tier Rankings'));
  view.appendChild(
    el('p', { class: 'help' },
      `${META.season} · ranked by official competitive win rate` +
      (META.stats_updated ? ` · updated ${META.stats_updated}` : '')),
  );

  // role filter
  const filter = el('div', { class: 'tier-filter' });
  const chips = [];
  const addChip = (id, label, role) => {
    const chip = el('button', {
      class: `chip${state.role === role ? ' active' : ''}`,
      type: 'button',
      dataset: { id },
      onClick: () => {
        state.role = role;
        for (const c of chips) c.classList.toggle('active', c.dataset.id === id);
        renderBands();
      },
    }, label);
    chips.push(chip);
    filter.appendChild(chip);
  };
  addChip('all', 'All', null);
  for (const role of ROLES) addChip(role, capitalize(role), role);
  view.appendChild(filter);

  const bandsWrap = el('div', { class: 'tier-bands' });
  view.appendChild(bandsWrap);
  view.appendChild(buildFooter());
  root.appendChild(view);

  async function renderBands() {
    clearChildren(bandsWrap);
    const pool = state.role ? heroesByRole(state.role) : HEROES;
    const groups = Object.fromEntries(TIER_ORDER.map((t) => [t, []]));
    for (const hero of pool) {
      const meta = metaTierFor(hero.id);
      (groups[meta.tier] || (groups[meta.tier] = [])).push({ hero, meta });
    }
    for (const tier of TIER_ORDER) {
      const items = (groups[tier] || []).sort((a, b) => (b.meta.winrate ?? 0) - (a.meta.winrate ?? 0));
      const band = el('div', { class: 'tier-band' });
      band.appendChild(el('div', { class: `tier-band-label tier-${tier}` }, tier));
      const row = el('div', { class: 'tier-band-heroes' });
      if (items.length === 0) {
        row.appendChild(el('span', { class: 'tier-empty' }, '-'));
      } else {
        const chips = await Promise.all(items.map(({ hero, meta }) => tierHero(hero, meta)));
        for (const c of chips) row.appendChild(c);
      }
      band.appendChild(row);
      bandsWrap.appendChild(band);
    }
  }

  await renderBands();
}

async function tierHero(hero, meta) {
  // reuse the portrait (suppress its own tier badge, the band already says the tier)
  const portrait = await heroPortrait(hero, {
    size: 'sm',
    showMetaBadge: false,
    onClick: () => openCountersFor(hero.id),
  });
  portrait.classList.add('tier-hero');
  if (meta.winrate != null) {
    portrait.appendChild(el('span', { class: 'tier-hero-wr' }, `${meta.winrate}%`));
  }
  if (meta.source === 'override') {
    portrait.classList.add('overridden');
    portrait.appendChild(el('span', { class: 'tier-hero-mark', title: `Manual override: ${meta.note}` }, '✎'));
    portrait.title = `${hero.name}, manual override: ${meta.note}`;
  }
  return portrait;
}

function buildFooter() {
  const f = el('div', { class: 'tier-footer' });
  if (META_SUMMARY) f.appendChild(el('p', { class: 'tier-summary' }, META_SUMMARY));
  f.appendChild(
    el('p', { class: 'tier-legend' },
      'Tiers come from competitive win rate; ✎ marks a manual community/pro override. Tap any hero to see its counters.'),
  );
  if (META_COMMUNITY_LINKS.length) {
    const links = el('p', { class: 'tier-links' }, 'Cross-check the pro/high-elo read: ');
    META_COMMUNITY_LINKS.forEach((link, i) => {
      if (i) links.appendChild(document.createTextNode(' · '));
      links.appendChild(el('a', { href: link.url, target: '_blank', rel: 'noopener' }, link.label));
    });
    f.appendChild(links);
  }
  if (META.stats_source) f.appendChild(el('p', { class: 'tier-source' }, `Source: ${META.stats_source}`));
  return f;
}

function capitalize(s) {
  return s.slice(0, 1).toUpperCase() + s.slice(1);
}
