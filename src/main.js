import './styles.css';
import { renderSinglePick } from './ui/single-pick.js';
import { renderTeamPick } from './ui/team-pick.js';
import { renderAdmin } from './ui/admin.js';
import { refreshPortraitCache } from './engine/portraits.js';

const TABS = {
  single: renderSinglePick,
  team: renderTeamPick,
  admin: renderAdmin,
};

const root = document.getElementById('app');
const tabButtons = document.querySelectorAll('.tab');

async function show(tab) {
  for (const b of tabButtons) {
    const active = b.dataset.tab === tab;
    b.classList.toggle('active', active);
    b.setAttribute('aria-selected', active);
  }
  await refreshPortraitCache();
  await TABS[tab](root);
  history.replaceState(null, '', `#${tab}`);
}

for (const b of tabButtons) {
  b.addEventListener('click', () => show(b.dataset.tab));
}

const initial = location.hash.replace('#', '') in TABS ? location.hash.replace('#', '') : 'single';
show(initial);
