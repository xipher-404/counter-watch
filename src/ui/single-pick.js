import { el, heroPortrait, clearChildren } from './components.js';
import { heroesByRole, ROLES } from '../engine/data.js';
import { openCountersFor } from './counters-modal.js';

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
          onClick: () => openCountersFor(hero.id),
        }),
      );
    }
    group.appendChild(grid);
    enemyGrids.appendChild(group);
  }
  view.appendChild(enemyGrids);
  root.appendChild(view);
}
