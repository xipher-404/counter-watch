import { getPortraitURL, placeholderInitials } from '../engine/portraits.js';
import { scoreToTier } from '../engine/scoring.js';
import { metaTierFor } from '../engine/data.js';

export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') node.className = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k.startsWith('on')) node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') node.innerHTML = v;
    else if (v !== false && v != null) node.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}

export async function heroPortrait(hero, { size = 'md', clickable = true, onClick = null } = {}) {
  const wrap = el('button', {
    class: `portrait portrait-${size} role-${hero.role}${clickable ? '' : ' static'}`,
    dataset: { heroId: hero.id, role: hero.role },
    type: 'button',
    title: hero.name,
    'aria-label': hero.name,
    onClick: onClick || (() => {}),
  });
  wrap.disabled = !clickable;
  const img = el('img', { alt: hero.name, loading: 'lazy' });
  const fallback = el('span', { class: 'portrait-fallback' }, placeholderInitials(hero));
  wrap.appendChild(img);
  wrap.appendChild(fallback);
  wrap.appendChild(el('span', { class: 'portrait-name' }, hero.name));
  if (hero.new_hero) wrap.appendChild(el('span', { class: 'portrait-new', title: 'Newer hero — kit data may be limited' }, 'NEW'));

  const meta = metaTierFor(hero.id);
  if (meta.explicit && ['S', 'A', 'D'].includes(meta.tier)) {
    wrap.appendChild(
      el('span', {
        class: `portrait-tier tier-${meta.tier}`,
        title: `Current meta: ${meta.tier}-tier${meta.note ? ' — ' + meta.note : ''}`,
      }, meta.tier),
    );
  }

  getPortraitURL(hero).then((url) => {
    img.src = url;
    img.onerror = () => {
      img.style.display = 'none';
      fallback.style.display = 'flex';
    };
    img.onload = () => {
      fallback.style.display = 'none';
    };
  });

  return wrap;
}

export function scoreBadge(score) {
  const tier = scoreToTier(score);
  return el('span', { class: `score-badge tier-${tier}`, title: `Score ${score} (Tier ${tier})` }, `${score}`);
}

export function reasonsList(reasons) {
  if (!reasons || reasons.length === 0) return el('span', { class: 'reason-empty' }, '—');
  return el(
    'ul',
    { class: 'reasons' },
    ...reasons.slice(0, 3).map((r) =>
      el(
        'li',
        { class: `reason reason-${r.kind}` },
        r.text,
        r.modifier ? el('span', { class: 'reason-mod' }, ` ${r.modifier > 0 ? '+' : ''}${r.modifier}`) : null,
      ),
    ),
  );
}

export function clearChildren(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}
