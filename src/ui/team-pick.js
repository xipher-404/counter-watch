import { el, heroPortrait, scoreBadge, clearChildren } from './components.js';
import { HEROES_BY_ID, heroesByRole } from '../engine/data.js';
import { rankCountersFor } from '../engine/scoring.js';
import { recommendTeamCompletion } from '../engine/recommend.js';
import { getPortraitURL } from '../engine/portraits.js';
import { detectHeroesFromPhoto, isVisionConfigured } from './photo-input.js';

const SLOTS = [
  { id: 'tank', role: 'tank', label: 'Tank' },
  { id: 'dps1', role: 'dps', label: 'DPS' },
  { id: 'dps2', role: 'dps', label: 'DPS' },
  { id: 'sup1', role: 'support', label: 'Support' },
  { id: 'sup2', role: 'support', label: 'Support' },
];
const ROLE_LABEL = { tank: 'Tank', dps: 'DPS', support: 'Support' };

export async function renderTeamPick(root) {
  clearChildren(root);
  const state = {
    mine: emptyTeam(),
    enemy: emptyTeam(),
    active: null, // { team, slot }
  };

  const view = el('section', { class: 'tab-view team-builder' });
  view.appendChild(el('h2', {}, 'Team Builder'));
  view.appendChild(
    el('p', { class: 'help' },
      'Fill in your team and/or the enemy team. Get the best picks to round out your team and the strongest counters to the enemy.'),
  );

  const teamsWrap = el('div', { class: 'teams-wrap' });
  teamsWrap.appendChild(teamBlock('mine', 'Your team'));
  teamsWrap.appendChild(teamBlock('enemy', 'Enemy team'));
  view.appendChild(teamsWrap);

  const pickerSection = el('div', { class: 'team-picker' });
  view.appendChild(pickerSection);

  const recSection = el('div', { class: 'recommendations' });
  view.appendChild(recSection);

  root.appendChild(view);
  renderRecommendations();

  // ---- teams + slots ----
  function teamBlock(team, title) {
    const block = el('div', { class: `team-block team-${team}` });
    const head = el('div', { class: 'team-head' });
    head.appendChild(el('h3', {}, title));
    head.appendChild(photoButton(team));
    const clear = el('button', { class: 'btn-clear', type: 'button', onClick: () => clearTeam(team) }, 'Clear');
    head.appendChild(clear);
    block.appendChild(head);

    const row = el('div', { class: 'slot-row', dataset: { team } });
    for (const def of SLOTS) {
      row.appendChild(
        el('button', {
          class: `slot slot-${def.role}`,
          type: 'button',
          dataset: { team, slot: def.id, role: def.role },
          onClick: () => activateSlot(team, def.id),
        },
          el('span', { class: 'slot-label' }, def.label),
          el('span', { class: 'slot-content' }, '+'),
        ),
      );
    }
    block.appendChild(row);
    return block;
  }

  function photoButton(team) {
    const input = el('input', { type: 'file', accept: 'image/*', capture: 'environment', class: 'photo-file' });
    input.style.display = 'none';
    input.addEventListener('change', () => {
      if (input.files && input.files[0]) handlePhoto(team, input.files[0]);
      input.value = '';
    });
    const btn = el('button', { class: 'btn-photo', type: 'button', onClick: () => input.click() }, '📷 Add by photo');
    return el('span', { class: 'photo-wrap' }, btn, input);
  }

  function activateSlot(team, slotId) {
    state.active = { team, slot: slotId };
    for (const s of view.querySelectorAll('.slot')) {
      s.classList.toggle('active', s.dataset.team === team && s.dataset.slot === slotId);
    }
    renderPicker();
  }

  async function renderPicker() {
    clearChildren(pickerSection);
    if (!state.active) return;
    const def = SLOTS.find((s) => s.id === state.active.slot);
    const teamLabel = state.active.team === 'mine' ? 'your team' : 'the enemy team';
    pickerSection.appendChild(el('h4', { class: 'picker-title' }, `Pick a ${def.label} for ${teamLabel}`));
    const grid = el('div', { class: 'portrait-grid' });
    const takenHere = new Set(Object.values(state[state.active.team]).filter(Boolean));
    for (const hero of heroesByRole(def.role)) {
      const portrait = await heroPortrait(hero, { size: 'md', onClick: () => selectForSlot(hero.id) });
      if (takenHere.has(hero.id)) portrait.classList.add('picked-elsewhere');
      grid.appendChild(portrait);
    }
    pickerSection.appendChild(grid);
  }

  function selectForSlot(heroId) {
    if (!state.active) return;
    const { team, slot } = state.active;
    // remove this hero if already in another slot of the same team
    for (const sid of Object.keys(state[team])) if (state[team][sid] === heroId) state[team][sid] = null;
    state[team][slot] = heroId;
    refreshSlots();
    renderRecommendations();
    advanceSlot();
  }

  function advanceSlot() {
    const { team } = state.active;
    const order = SLOTS.map((s) => s.id);
    const idx = order.indexOf(state.active.slot);
    for (let i = 1; i <= order.length; i++) {
      const next = order[(idx + i) % order.length];
      if (!state[team][next]) return activateSlot(team, next);
    }
    state.active = null;
    clearChildren(pickerSection);
    for (const s of view.querySelectorAll('.slot')) s.classList.remove('active');
  }

  function clearTeam(team) {
    state[team] = emptyTeam();
    if (state.active && state.active.team === team) { state.active = null; clearChildren(pickerSection); }
    refreshSlots();
    renderRecommendations();
  }

  function refreshSlots() {
    for (const team of ['mine', 'enemy']) {
      for (const def of SLOTS) {
        const btn = view.querySelector(`.slot[data-team="${team}"][data-slot="${def.id}"]`);
        if (!btn) continue;
        const content = btn.querySelector('.slot-content');
        const heroId = state[team][def.id];
        content.textContent = '';
        btn.classList.toggle('filled', !!heroId);
        if (heroId) {
          const hero = HEROES_BY_ID[heroId];
          const img = el('img', { class: 'slot-portrait', alt: hero.name });
          getPortraitURL(hero).then((u) => (img.src = u));
          content.appendChild(img);
        } else {
          content.textContent = '+';
        }
      }
    }
  }

  // ---- recommendations (live) ----
  function teamHeroes(team) {
    return SLOTS.map((s) => state[team][s.id]).filter(Boolean).map((id) => HEROES_BY_ID[id]);
  }

  async function renderRecommendations() {
    clearChildren(recSection);
    const mine = teamHeroes('mine');
    const enemy = teamHeroes('enemy');

    // 1) round out your team
    const complete = el('section', { class: 'rec-block' });
    complete.appendChild(el('h3', { class: 'rec-title' }, 'Round out your team'));
    const rec = recommendTeamCompletion(mine, enemy);
    if (rec.openRoles.length === 0) {
      complete.appendChild(el('p', { class: 'rec-empty' }, mine.length ? 'Your team is full.' : 'Add heroes to your team.'));
    } else {
      const note = enemy.length
        ? 'Best picks for your open slots, weighted to counter the enemy team.'
        : 'Best picks for your open slots by current meta and synergy. Add the enemy team to make these counter-aware.';
      complete.appendChild(el('p', { class: 'rec-note' }, note));
      for (const role of [...new Set(rec.openRoles)]) {
        const group = el('div', { class: 'rec-role-group' });
        group.appendChild(el('h4', { class: `rec-role role-${role}` }, ROLE_LABEL[role]));
        const list = el('div', { class: 'rec-list' });
        const cards = await Promise.all(rec.byRole[role].slice(0, 4).map((item) =>
          recCard(item.hero, item.score, item.reasons.map((r) => r.text))));
        for (const c of cards) list.appendChild(c);
        group.appendChild(list);
        complete.appendChild(group);
      }
    }
    recSection.appendChild(complete);

    // 2) counter the enemy team
    const counter = el('section', { class: 'rec-block' });
    counter.appendChild(el('h3', { class: 'rec-title' }, 'Counter the enemy'));
    if (enemy.length === 0) {
      counter.appendChild(el('p', { class: 'rec-empty' }, 'Add enemy heroes to see counters.'));
    } else {
      const enemyIds = new Set(enemy.map((h) => h.id));
      const ranked = rankCountersFor(enemy).filter((r) => !enemyIds.has(r.hero.id)).slice(0, 8);
      const list = el('div', { class: 'rec-list' });
      const cards = await Promise.all(ranked.map((item) => {
        const reasons = item.perEnemy.flatMap((p) => p.reasons.map((r) => r.text)).filter(Boolean).slice(0, 2);
        return recCard(item.hero, item.score, reasons);
      }));
      for (const c of cards) list.appendChild(c);
      counter.appendChild(list);
    }
    recSection.appendChild(counter);
  }

  // Tapping a recommended hero adds it to your team (the "what do I play" payoff).
  function addToMyTeam(heroId) {
    const hero = HEROES_BY_ID[heroId];
    if (Object.values(state.mine).includes(heroId)) { showPhotoStatus(`${hero.name} is already on your team.`, 'info'); return; }
    const slot = SLOTS.find((s) => s.role === hero.role && !state.mine[s.id]);
    if (!slot) { showPhotoStatus(`Your ${ROLE_LABEL[hero.role]} slots are full.`, 'info'); return; }
    state.mine[slot.id] = heroId;
    refreshSlots();
    renderRecommendations();
  }

  async function recCard(hero, score, reasonTexts) {
    const card = el('div', {
      class: `rec-card role-${hero.role}`,
      title: `Add ${hero.name} to your team`,
      onClick: () => addToMyTeam(hero.id),
    });
    card.appendChild(await heroPortrait(hero, { size: 'sm', clickable: false }));
    const body = el('div', { class: 'rec-card-body' });
    body.appendChild(el('div', { class: 'rec-card-head' }, scoreBadge(score), el('span', { class: 'rec-card-name' }, hero.name)));
    if (reasonTexts && reasonTexts.length) {
      body.appendChild(el('ul', { class: 'rec-reasons' }, ...reasonTexts.slice(0, 2).map((t) => el('li', {}, t))));
    }
    card.appendChild(body);
    return card;
  }

  // ---- photo input ----
  async function handlePhoto(team, file) {
    const teamLabel = team === 'mine' ? 'your team' : 'the enemy team';
    if (!isVisionConfigured()) {
      showPhotoStatus(`Photo recognition isn't connected yet (cloud setup is the next step). For now, tap slots to add ${teamLabel} manually.`, 'info');
      return;
    }
    showPhotoStatus(`Reading ${teamLabel} from photo...`, 'loading');
    try {
      const ids = await detectHeroesFromPhoto(file, team);
      const valid = ids.filter((id) => HEROES_BY_ID[id]);
      if (valid.length === 0) { showPhotoStatus('No heroes recognized in that image. Try a clearer shot or add manually.', 'info'); return; }
      // place detected heroes into open slots of the matching role
      const placed = [];
      for (const id of valid) {
        const role = HEROES_BY_ID[id].role;
        const slot = SLOTS.find((s) => s.role === role && !state[team][s.id] && !Object.values(state[team]).includes(id));
        if (slot) { state[team][slot.id] = id; placed.push(id); }
      }
      refreshSlots();
      renderRecommendations();
      showPhotoStatus(`Added ${placed.length} hero${placed.length === 1 ? '' : 'es'} to ${teamLabel}. Adjust any that are off.`, 'ok');
    } catch (err) {
      showPhotoStatus(`Could not read the photo (${err.message}). Add heroes manually.`, 'error');
    }
  }

  function showPhotoStatus(msg, kind) {
    let bar = view.querySelector('.photo-status');
    if (!bar) { bar = el('div', { class: 'photo-status' }); teamsWrap.after(bar); }
    bar.className = `photo-status status-${kind}`;
    bar.textContent = msg;
  }

  refreshSlots();
}

function emptyTeam() {
  return { tank: null, dps1: null, dps2: null, sup1: null, sup2: null };
}
