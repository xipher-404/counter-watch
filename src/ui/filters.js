import { el } from './components.js';
import { ROLES, DAMAGE_TYPES } from '../engine/data.js';

export function filterBar(state, onChange) {
  const bar = el('div', { class: 'filter-bar' });

  const roleGroup = el('div', { class: 'filter-group', 'aria-label': 'Filter by role' });
  roleGroup.appendChild(el('span', { class: 'filter-label' }, 'Role:'));
  roleGroup.appendChild(makeChip('all', 'All', state.role === null, () => { state.role = null; onChange(); }));
  for (const role of ROLES) {
    roleGroup.appendChild(
      makeChip(role, capitalize(role), state.role === role, () => {
        state.role = state.role === role ? null : role;
        onChange();
      }),
    );
  }

  const dmgGroup = el('div', { class: 'filter-group', 'aria-label': 'Filter by damage type' });
  dmgGroup.appendChild(el('span', { class: 'filter-label' }, 'Type:'));
  dmgGroup.appendChild(makeChip('all', 'All', state.damageTypes.length === 0, () => { state.damageTypes = []; onChange(); }));
  for (const dt of DAMAGE_TYPES) {
    const active = state.damageTypes.includes(dt);
    dmgGroup.appendChild(
      makeChip(dt, capitalize(dt), active, () => {
        if (active) state.damageTypes = state.damageTypes.filter((t) => t !== dt);
        else state.damageTypes = [...state.damageTypes, dt];
        onChange();
      }),
    );
  }

  bar.appendChild(roleGroup);
  bar.appendChild(dmgGroup);
  return bar;
}

function makeChip(id, label, active, onClick) {
  return el(
    'button',
    {
      class: `chip${active ? ' active' : ''}`,
      type: 'button',
      dataset: { id },
      onClick,
    },
    label,
  );
}

function capitalize(s) {
  return s.slice(0, 1).toUpperCase() + s.slice(1);
}
