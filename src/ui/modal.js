import { el, clearChildren } from './components.js';

let currentModal = null;
let savedScrollY = 0;

function ensureRoot() {
  let root = document.getElementById('modal-root');
  if (!root) {
    root = el('div', { id: 'modal-root' });
    document.body.appendChild(root);
  }
  return root;
}

export function openModal({ title, subtitle = null, body, onClose = null }) {
  closeModal();

  const backdrop = el('div', { class: 'modal-backdrop' });
  const sheet = el('div', { class: 'modal-sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': title || 'Dialog' });

  const header = el('header', { class: 'modal-header' });
  const titleNode = el('div', { class: 'modal-title-wrap' },
    el('h2', { class: 'modal-title' }, title || ''),
    subtitle ? el('div', { class: 'modal-subtitle' }, subtitle) : null,
  );
  const closeBtn = el('button', {
    class: 'modal-close',
    type: 'button',
    'aria-label': 'Close',
    onClick: () => closeModal(),
  }, '×');
  header.appendChild(titleNode);
  header.appendChild(closeBtn);

  const bodyWrap = el('div', { class: 'modal-body' });
  if (body instanceof Node) bodyWrap.appendChild(body);

  sheet.appendChild(header);
  sheet.appendChild(bodyWrap);
  backdrop.appendChild(sheet);

  const root = ensureRoot();
  root.appendChild(backdrop);

  savedScrollY = window.scrollY;
  document.body.classList.add('modal-open');
  document.body.style.top = `-${savedScrollY}px`;

  requestAnimationFrame(() => backdrop.classList.add('open'));

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeModal();
  });

  history.pushState({ modal: true }, '');
  const popHandler = () => closeModal({ skipHistory: true });
  window.addEventListener('popstate', popHandler);

  const escHandler = (e) => {
    if (e.key === 'Escape') closeModal();
  };
  document.addEventListener('keydown', escHandler);

  currentModal = {
    backdrop,
    bodyWrap,
    onClose,
    popHandler,
    escHandler,
  };

  return {
    close: () => closeModal(),
    setBody(node) {
      clearChildren(bodyWrap);
      if (node instanceof Node) bodyWrap.appendChild(node);
    },
  };
}

export function closeModal({ skipHistory = false } = {}) {
  if (!currentModal) return;
  const { backdrop, popHandler, escHandler, onClose } = currentModal;
  currentModal = null;

  window.removeEventListener('popstate', popHandler);
  document.removeEventListener('keydown', escHandler);

  backdrop.classList.remove('open');
  backdrop.classList.add('closing');

  document.body.classList.remove('modal-open');
  document.body.style.top = '';
  window.scrollTo(0, savedScrollY);

  if (!skipHistory && history.state && history.state.modal) {
    history.back();
  }

  setTimeout(() => {
    backdrop.remove();
    if (typeof onClose === 'function') onClose();
  }, 220);
}

export function isModalOpen() {
  return currentModal !== null;
}
