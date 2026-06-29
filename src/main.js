import './styles.css';
import { renderSinglePick } from './ui/single-pick.js';
import { renderTeamPick } from './ui/team-pick.js';
import { renderAdmin } from './ui/admin.js';
import { renderTierRankings } from './ui/tier-rankings.js';
import { refreshPortraitCache } from './engine/portraits.js';

// Counters mode has its own sub-tabs; tiers is a standalone view.
const COUNTER_TABS = { single: renderSinglePick, team: renderTeamPick, admin: renderAdmin };
const VIEWS = ['single', 'team', 'admin', 'tiers'];
const DEFAULT_VIEW = 'single'; // Counters is the app's landing page.

// Page-orientation copy shown directly below the mode buttons (carried over
// from the retired landing screen).
const PAGE_DESC = {
  counters: 'Pick the enemy hero or team and get ranked counter picks across every role.',
  tiers: 'Every hero, ranked S-Tier to E-Tier, by current performance. Refreshed from official stats.',
};

const root = document.getElementById('app');
const tabsNav = document.querySelector('.tabs');
const tabButtons = document.querySelectorAll('.tab');
const brand = document.querySelector('.brand');
const modeButtons = document.querySelectorAll('.mode');
const pageDesc = document.querySelector('.page-desc');

let lastCounterTab = 'single'; // where the Counters button returns to from Tiers

// Both mode buttons stay visible; the active page's button is highlighted and
// the sub-tabs + page description follow the current mode.
function setMode(mode) {
  document.body.dataset.mode = mode; // 'counters' | 'tiers'
  if (tabsNav) tabsNav.hidden = mode !== 'counters';
  if (pageDesc) pageDesc.textContent = PAGE_DESC[mode] || '';
  for (const b of modeButtons) {
    const active = b.dataset.mode === mode;
    b.classList.toggle('active', active);
    b.setAttribute('aria-selected', active);
  }
}

function normalize(hash) {
  const v = (hash || '').replace('#', '');
  return VIEWS.includes(v) ? v : DEFAULT_VIEW;
}

async function render(view) {
  await refreshPortraitCache();

  if (view === 'tiers') {
    setMode('tiers');
    await renderTierRankings(root);
    return;
  }
  setMode('counters');
  lastCounterTab = view;
  for (const b of tabButtons) {
    const active = b.dataset.tab === view;
    b.classList.toggle('active', active);
    b.setAttribute('aria-selected', active);
  }
  await COUNTER_TABS[view](root);
}

// Navigate and record history so the browser Back button works.
function go(view, { push = true } = {}) {
  if (push) history.pushState({ view }, '', `#${view}`);
  else history.replaceState({ view }, '', `#${view}`);
  render(view);
}

// Back/forward: history already moved, so re-render without pushing again.
window.addEventListener('popstate', (e) => {
  render(normalize(e.state?.view ? `#${e.state.view}` : location.hash));
});

for (const b of tabButtons) b.addEventListener('click', () => go(b.dataset.tab));
for (const b of modeButtons) {
  b.addEventListener('click', () => go(b.dataset.mode === 'tiers' ? 'tiers' : lastCounterTab));
}
if (brand) brand.addEventListener('click', () => go(DEFAULT_VIEW));

go(normalize(location.hash), { push: false });
