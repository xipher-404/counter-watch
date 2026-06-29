import { el, clearChildren } from './components.js';

// Landing screen: choose between the two top-level modes.
export function renderHome(root, { onCounters, onTiers }) {
  clearChildren(root);
  const view = el('section', { class: 'tab-view home' });

  view.appendChild(el('h2', { class: 'home-title' }, 'Counter Watch'));
  view.appendChild(el('p', { class: 'home-sub' }, 'Overwatch counter-pick assistant'));

  const cards = el('div', { class: 'home-cards' });
  cards.appendChild(
    homeCard('🎯', 'Counters', 'Pick the enemy hero or team and get ranked counter picks across every role.', onCounters),
  );
  cards.appendChild(
    homeCard('📊', 'Tier Rankings', 'Every hero ranked S-E by current competitive performance, refreshed from official stats.', onTiers),
  );
  view.appendChild(cards);

  root.appendChild(view);
}

function homeCard(icon, title, desc, onClick) {
  return el(
    'button',
    { class: 'home-card', type: 'button', onClick },
    el('span', { class: 'home-card-icon' }, icon),
    el('span', { class: 'home-card-title' }, title),
    el('span', { class: 'home-card-desc' }, desc),
  );
}
