import './styles.css';
import { renderSinglePick } from './ui/single-pick.js';
import { renderTeamPick } from './ui/team-pick.js';
import { renderAdmin } from './ui/admin.js';
import { renderTierRankings } from './ui/tier-rankings.js';
import { renderHome } from './ui/home.js';
import { refreshPortraitCache } from './engine/portraits.js';

// Counters mode has its own sub-tabs; tiers and home are standalone views.
const COUNTER_TABS = { single: renderSinglePick, team: renderTeamPick, admin: renderAdmin };
const VIEWS = ['home', 'single', 'team', 'admin', 'tiers'];

const root = document.getElementById('app');
const tabsNav = document.querySelector('.tabs');
const tabButtons = document.querySelectorAll('.tab');
const brand = document.querySelector('.brand');

function setMode(mode) {
  document.body.dataset.mode = mode; // 'home' | 'counters' | 'tiers'
  if (tabsNav) tabsNav.hidden = mode !== 'counters';
}

async function show(view) {
  await refreshPortraitCache();

  if (view === 'home') {
    setMode('home');
    renderHome(root, { onCounters: () => show('single'), onTiers: () => show('tiers') });
    history.replaceState(null, '', '#home');
    return;
  }

  if (view === 'tiers') {
    setMode('tiers');
    await renderTierRankings(root);
    history.replaceState(null, '', '#tiers');
    return;
  }

  // counters sub-tabs
  setMode('counters');
  for (const b of tabButtons) {
    const active = b.dataset.tab === view;
    b.classList.toggle('active', active);
    b.setAttribute('aria-selected', active);
  }
  await COUNTER_TABS[view](root);
  history.replaceState(null, '', `#${view}`);
}

for (const b of tabButtons) b.addEventListener('click', () => show(b.dataset.tab));
if (brand) brand.addEventListener('click', () => show('home'));

const hash = location.hash.replace('#', '');
show(VIEWS.includes(hash) ? hash : 'home');
