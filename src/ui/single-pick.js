import { el, heroPortrait, scoreBadge, reasonsList, clearChildren } from './components.js';
import { filterBar } from './filters.js';
import { HEROES, HEROES_BY_ID, heroesByRole, ROLES, metaTierFor } from '../engine/data.js';
import { rankCountersFor } from '../engine/scoring.js';
import { openModal } from './modal.js';

export async function renderSinglePick(root) {
  clearChildren(root);

  const view = el('section', { class: 'tab-view single-pick' });
  view.appendChild(el('h2', {}, 'Enemy Hero'));
  view.appendChild(el('p', { class: 'help' }, 'Tap an enemy hero to see ranked counter picks.'));

  const enemyGrids = el('div', { class: 'enemy-grids' });
  for (const role of ROLES) {
    const heroesInRole = heroesByRole(role);
    const group = el('div', { class: `role-grid role-${role}` });
    group.appendChild(el('h3', { class: 'role-heading' }, role.toUpperCase()));
    const grid = el('div', { class: 'portrait-grid' });
    for (const hero of heroesInRole) {
      grid.appendChild(
        await heroPortrait(hero, {
          size: 'md',
          onClick: () => showCountersFor(hero.id),
        }),
      );
    }
    group.appendChild(grid);
    enemyGrids.appendChild(group);
  }
  view.appendChild(enemyGrids);
  root.appendChild(view);

  function showCountersFor(enemyId) {
    const enemy = HEROES_BY_ID[enemyId];
    const state = { role: null, damageTypes: [] };

    const body = el('div', { class: 'modal-results' });

    const handle = openModal({
      title: `Counters vs ${enemy.name}`,
      subtitle: roleSubtitle(enemy),
      body,
    });

    function refresh() {
      clearChildren(body);
      body.appendChild(filterBar(state, refresh));
      const ranked = rankCountersFor(enemy, { role: state.role, damageTypes: state.damageTypes });
      const top = ranked.filter((r) => r.hero.id !== enemy.id).slice(0, 24);
      const list = el('div', { class: 'counter-list' });
      Promise.all(top.map((item) => buildCounterCard(item, [enemy]))).then((cards) => {
        for (const c of cards) list.appendChild(c);
      });
      if (top.length === 0) list.appendChild(el('p', { class: 'empty' }, 'No heroes match the current filters.'));
      body.appendChild(list);
    }

    refresh();
    return handle;
  }
}

function roleSubtitle(hero) {
  const bits = [hero.role.toUpperCase()];
  if (hero.damage_type) bits.push(hero.damage_type);
  if (hero.range) bits.push(hero.range + ' range');
  if (hero.mobility) bits.push(hero.mobility + ' mobility');
  const meta = metaTierFor(hero.id);
  if (meta.explicit) bits.push(`meta ${meta.tier}-tier`);
  return bits.join(' · ');
}

async function buildCounterCard(item, enemies) {
  const card = el('div', { class: `counter-card role-${item.hero.role}` });
  card.appendChild(await heroPortrait(item.hero, { size: 'sm', clickable: false }));
  const meta = el('div', { class: 'counter-meta' });
  meta.appendChild(
    el('div', { class: 'counter-header' }, scoreBadge(item.score), el('span', { class: 'counter-name' }, item.hero.name)),
  );
  const reasons = item.perEnemy.flatMap((p) => p.reasons);
  meta.appendChild(reasonsList(reasons));
  card.appendChild(meta);
  return card;
}
