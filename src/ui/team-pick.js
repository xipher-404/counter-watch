import { el, heroPortrait, scoreBadge, clearChildren } from './components.js';
import { filterBar } from './filters.js';
import { HEROES_BY_ID, heroesByRole } from '../engine/data.js';
import { metaTierFor } from '../engine/data.js';
import { rankCountersFor } from '../engine/scoring.js';
import { getPortraitURL } from '../engine/portraits.js';
import { openModal } from './modal.js';

const SLOT_DEFINITIONS = [
  { id: 'tank-1', role: 'tank', label: 'Tank' },
  { id: 'dps-1', role: 'dps', label: 'DPS 1' },
  { id: 'dps-2', role: 'dps', label: 'DPS 2' },
  { id: 'support-1', role: 'support', label: 'Support 1' },
  { id: 'support-2', role: 'support', label: 'Support 2' },
];

export async function renderTeamPick(root) {
  clearChildren(root);
  const state = {
    slots: Object.fromEntries(SLOT_DEFINITIONS.map((s) => [s.id, null])),
    activeSlot: 'tank-1',
  };

  const view = el('section', { class: 'tab-view team-pick' });

  view.appendChild(el('h2', {}, 'Enemy Team'));
  view.appendChild(el('p', { class: 'help' }, 'Fill the enemy team. Tap a slot to choose, then tap a hero. The Counters button shows ranked recommendations.'));

  const slotsRow = el('div', { class: 'slot-row' });
  for (const def of SLOT_DEFINITIONS) {
    const slotBtn = el(
      'button',
      {
        class: `slot slot-${def.role}`,
        type: 'button',
        dataset: { slot: def.id, role: def.role },
        onClick: () => activateSlot(def.id),
      },
      el('span', { class: 'slot-label' }, def.label),
      el('span', { class: 'slot-content' }, '+'),
    );
    slotsRow.appendChild(slotBtn);
  }
  view.appendChild(slotsRow);

  const teamActions = el('div', { class: 'team-actions' });
  const clearBtn = el('button', { class: 'btn-secondary', type: 'button', onClick: clearTeam }, 'Clear team');
  teamActions.appendChild(clearBtn);
  view.appendChild(teamActions);

  const pickerSection = el('div', { class: 'team-picker' });
  view.appendChild(pickerSection);

  root.appendChild(view);

  const fab = el(
    'button',
    {
      class: 'counters-fab',
      type: 'button',
      onClick: openCountersModal,
    },
    el('span', { class: 'fab-icon' }, '⚔'),
    el('span', { class: 'fab-label' }, 'Counters'),
    el('span', { class: 'fab-count' }, '0'),
  );
  fab.disabled = true;
  document.body.appendChild(fab);
  view.dataset.cleanupFab = 'true';

  const cleanup = new MutationObserver(() => {
    if (!document.body.contains(view)) {
      fab.remove();
      cleanup.disconnect();
    }
  });
  cleanup.observe(root, { childList: true });

  function activateSlot(slotId) {
    state.activeSlot = slotId;
    for (const s of view.querySelectorAll('.slot')) s.classList.toggle('active', s.dataset.slot === slotId);
    renderPicker();
  }

  async function renderPicker() {
    clearChildren(pickerSection);
    const def = SLOT_DEFINITIONS.find((s) => s.id === state.activeSlot);
    if (!def) return;
    pickerSection.appendChild(el('h3', {}, `Select ${def.label}`));
    const grid = el('div', { class: 'portrait-grid' });
    for (const hero of heroesByRole(def.role)) {
      const isPicked = Object.values(state.slots).includes(hero.id);
      const portrait = await heroPortrait(hero, {
        size: 'md',
        onClick: () => selectForSlot(hero.id),
      });
      if (isPicked) portrait.classList.add('picked-elsewhere');
      grid.appendChild(portrait);
    }
    pickerSection.appendChild(grid);
  }

  function selectForSlot(heroId) {
    for (const sid of Object.keys(state.slots)) {
      if (state.slots[sid] === heroId) state.slots[sid] = null;
    }
    state.slots[state.activeSlot] = heroId;
    refreshSlotsUI();
    refreshFab();
    advanceSlot();
  }

  function advanceSlot() {
    const order = SLOT_DEFINITIONS.map((s) => s.id);
    const idx = order.indexOf(state.activeSlot);
    for (let i = 1; i <= order.length; i++) {
      const next = order[(idx + i) % order.length];
      if (!state.slots[next]) {
        activateSlot(next);
        return;
      }
    }
    renderPicker();
  }

  function clearTeam() {
    for (const k of Object.keys(state.slots)) state.slots[k] = null;
    refreshSlotsUI();
    refreshFab();
    activateSlot('tank-1');
  }

  function refreshSlotsUI() {
    for (const def of SLOT_DEFINITIONS) {
      const btn = view.querySelector(`.slot[data-slot="${def.id}"]`);
      const content = btn.querySelector('.slot-content');
      const heroId = state.slots[def.id];
      content.textContent = '';
      if (heroId) {
        const hero = HEROES_BY_ID[heroId];
        const img = el('img', { class: 'slot-portrait', alt: hero.name });
        img.dataset.heroId = hero.id;
        getPortraitURL(hero).then((u) => (img.src = u));
        content.appendChild(img);
      } else {
        content.textContent = '+';
      }
    }
  }

  function refreshFab() {
    const count = Object.values(state.slots).filter(Boolean).length;
    fab.querySelector('.fab-count').textContent = String(count);
    fab.disabled = count === 0;
    fab.classList.toggle('ready', count > 0);
  }

  function openCountersModal() {
    const enemyIds = Object.values(state.slots).filter(Boolean);
    if (enemyIds.length === 0) return;
    const enemies = enemyIds.map((id) => HEROES_BY_ID[id]);

    const filterState = { role: null, damageTypes: [] };
    const opts = { weightByMeta: true };
    const body = el('div', { class: 'modal-results' });

    openModal({
      title: 'Best counters',
      subtitle: `vs ${enemies.length} enemy hero${enemies.length === 1 ? '' : 'es'}`,
      body,
    });

    function metaWeightToggle() {
      if (enemies.length < 2) return null; // weighting is a no-op for a single enemy
      const checkbox = el('input', { type: 'checkbox', id: 'weight-meta' });
      checkbox.checked = opts.weightByMeta;
      checkbox.addEventListener('change', () => {
        opts.weightByMeta = checkbox.checked;
        refresh();
      });
      return el(
        'label',
        { class: 'weight-toggle', for: 'weight-meta' },
        checkbox,
        el('span', {}, 'Prioritize the enemy’s meta threats'),
        el('span', { class: 'weight-hint' }, 'weights each score by the enemy’s S/A/B/C/D tier'),
      );
    }

    function refresh() {
      clearChildren(body);
      const toggle = metaWeightToggle();
      if (toggle) body.appendChild(toggle);
      body.appendChild(filterBar(filterState, refresh));
      const ranked = rankCountersFor(enemies, { role: filterState.role, damageTypes: filterState.damageTypes, weightByMeta: opts.weightByMeta });
      const enemySet = new Set(enemyIds);
      const top = ranked.filter((r) => !enemySet.has(r.hero.id)).slice(0, 24);
      const list = el('div', { class: 'counter-list' });
      Promise.all(
        top.map(async (item) => {
          const card = el('div', { class: `counter-card role-${item.hero.role}` });
          card.appendChild(await heroPortrait(item.hero, { size: 'sm', clickable: false }));
          const meta = el('div', { class: 'counter-meta' });
          meta.appendChild(
            el('div', { class: 'counter-header' }, scoreBadge(item.score), el('span', { class: 'counter-name' }, item.hero.name)),
          );
          const breakdown = el('ul', { class: 'team-breakdown' });
          for (const per of item.perEnemy) {
            const enemyHero = HEROES_BY_ID[per.enemyId];
            const tierChip = per.enemyTierExplicit
              ? el('span', { class: `tier-chip tier-${per.enemyTier}`, title: `Enemy meta tier: ${per.enemyTier}` }, per.enemyTier)
              : null;
            breakdown.appendChild(
              el(
                'li',
                { class: 'team-breakdown-item' },
                el('span', { class: 'team-vs' }, `vs ${enemyHero.name}`),
                tierChip,
                scoreBadge(per.score),
              ),
            );
          }
          meta.appendChild(breakdown);
          card.appendChild(meta);
          return card;
        }),
      ).then((cards) => {
        for (const c of cards) list.appendChild(c);
      });
      if (top.length === 0) list.appendChild(el('p', { class: 'empty' }, 'No heroes match the current filters.'));
      body.appendChild(list);
    }

    refresh();
  }

  activateSlot('tank-1');
  refreshSlotsUI();
  refreshFab();
}
