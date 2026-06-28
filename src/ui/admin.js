import { el, clearChildren } from './components.js';
import { HEROES, HEROES_META, COUNTERS_META } from '../engine/data.js';
import { savePortrait, deletePortrait, listSavedPortraits } from '../engine/storage.js';
import { getPortraitURL, invalidatePortrait, markPortraitSaved, refreshPortraitCache, placeholderInitials } from '../engine/portraits.js';

export async function renderAdmin(root) {
  clearChildren(root);
  await refreshPortraitCache();
  const savedKeys = new Set(await listSavedPortraits());

  const view = el('section', { class: 'tab-view admin' });

  view.appendChild(el('h2', {}, 'Admin / Portraits'));
  view.appendChild(
    el(
      'div',
      { class: 'admin-meta' },
      el('p', {}, `Roster source: ${HEROES_META.source} (last updated ${HEROES_META.last_updated}).`),
      el('p', {}, `Counter data source: ${COUNTERS_META.source} (published ${COUNTERS_META.source_published}).`),
      el('p', { class: 'help' }, 'Upload a portrait for any hero. Uploaded images persist in your browser/app storage and override the bundled image. Recommended: square PNG/WebP, ≥256×256.'),
    ),
  );

  const grid = el('div', { class: 'admin-grid' });
  for (const hero of HEROES) {
    const tile = el('div', { class: `admin-tile role-${hero.role}` });
    const wrapper = el('div', { class: 'admin-portrait-wrapper' });
    const img = el('img', { class: 'admin-portrait-img', alt: hero.name });
    const fallback = el('span', { class: 'portrait-fallback' }, placeholderInitials(hero));
    wrapper.appendChild(img);
    wrapper.appendChild(fallback);
    tile.appendChild(wrapper);

    tile.appendChild(el('div', { class: 'admin-name' }, hero.name));
    tile.appendChild(el('div', { class: 'admin-role' }, `${hero.role}${hero.new_hero ? ' • NEW' : ''}`));

    const status = el('div', { class: 'admin-status' });
    function setStatus(text, kind = '') {
      status.textContent = text;
      status.className = `admin-status ${kind}`;
    }
    if (savedKeys.has(hero.id)) setStatus('User upload', 'ok');
    else setStatus('Bundled / placeholder', 'muted');
    tile.appendChild(status);

    const fileInput = el('input', {
      type: 'file',
      accept: 'image/png,image/webp,image/jpeg',
      onChange: async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
          await savePortrait(hero.id, file);
          markPortraitSaved(hero.id);
          savedKeys.add(hero.id);
          const url = await getPortraitURL(hero);
          img.src = url;
          img.style.display = '';
          fallback.style.display = 'none';
          setStatus('User upload saved', 'ok');
        } catch (err) {
          setStatus('Save failed: ' + err.message, 'error');
        }
        e.target.value = '';
      },
    });
    fileInput.classList.add('admin-file');

    const replaceBtn = el(
      'button',
      { class: 'btn-secondary', type: 'button', onClick: () => fileInput.click() },
      savedKeys.has(hero.id) ? 'Replace' : 'Upload',
    );

    const removeBtn = el(
      'button',
      {
        class: 'btn-tertiary',
        type: 'button',
        onClick: async () => {
          await deletePortrait(hero.id);
          invalidatePortrait(hero.id);
          savedKeys.delete(hero.id);
          const url = await getPortraitURL(hero);
          img.src = url;
          setStatus('Bundled / placeholder', 'muted');
        },
      },
      'Remove',
    );

    const actions = el('div', { class: 'admin-actions' }, replaceBtn, fileInput, removeBtn);
    tile.appendChild(actions);

    img.onerror = () => {
      img.style.display = 'none';
      fallback.style.display = 'flex';
    };
    img.onload = () => {
      fallback.style.display = 'none';
    };
    getPortraitURL(hero).then((url) => (img.src = url));

    grid.appendChild(tile);
  }
  view.appendChild(grid);
  root.appendChild(view);
}
