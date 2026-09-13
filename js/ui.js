import { esc } from './util.js';

const sheetRoot = () => document.getElementById('sheetRoot');
const stack = [];

export function toast(msg, ms = 2000) {
  const root = document.getElementById('toastRoot');
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  root.appendChild(el);
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 240);
  }, ms);
}

export function openSheet({ title, body, left, right, footer, onMount, onClose, dismissible = true }) {
  const root = sheetRoot();
  const backdrop = document.createElement('div');
  backdrop.className = 'backdrop';
  const sheet = document.createElement('div');
  sheet.className = 'sheet';
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');

  sheet.innerHTML = `
    <div class="sheet-handle"><span></span></div>
    <div class="sheet-header">
      <div class="left">${left ? `<button type="button" data-sheet-left>${esc(left.label)}</button>` : ''}</div>
      <h2>${esc(title || '')}</h2>
      <div class="right">${right ? `<button type="button" class="${right.strong ? 'strong' : ''}" data-sheet-right ${right.disabled ? 'disabled' : ''}>${esc(right.label)}</button>` : ''}</div>
    </div>
    <div class="sheet-body">${body || ''}</div>
    ${footer ? `<div class="sheet-footer">${footer}</div>` : ''}
  `;

  root.append(backdrop, sheet);
  document.body.style.overflow = 'hidden';

  const handle = {
    el: sheet,
    body: sheet.querySelector('.sheet-body'),
    close: () => close(),
    setRightDisabled: (v) => {
      const b = sheet.querySelector('[data-sheet-right]');
      if (b) b.disabled = !!v;
    },
    setBody: (html) => { sheet.querySelector('.sheet-body').innerHTML = html; },
    setTitle: (t) => { sheet.querySelector('h2').textContent = t; }
  };

  let closed = false;
  function close(result) {
    if (closed) return;
    closed = true;
    sheet.classList.remove('show');
    backdrop.classList.remove('show');
    const idx = stack.indexOf(handle);
    if (idx > -1) stack.splice(idx, 1);
    setTimeout(() => {
      sheet.remove();
      backdrop.remove();
      if (!stack.length) document.body.style.overflow = '';
      onClose?.(result);
    }, 340);
  }

  if (dismissible) backdrop.addEventListener('click', () => close());
  sheet.querySelector('[data-sheet-left]')?.addEventListener('click', () => {
    if (left.onClick) left.onClick(handle);
    else close();
  });
  sheet.querySelector('[data-sheet-right]')?.addEventListener('click', () => right.onClick?.(handle));

  // Drag to dismiss
  if (dismissible) {
    const grip = sheet.querySelector('.sheet-handle');
    let startY = 0, delta = 0, dragging = false;
    const start = (y) => { startY = y; dragging = true; sheet.style.transition = 'none'; };
    const move = (y) => {
      if (!dragging) return;
      delta = Math.max(0, y - startY);
      sheet.style.transform = `translateY(${delta}px)`;
    };
    const end = () => {
      if (!dragging) return;
      dragging = false;
      sheet.style.transition = '';
      sheet.style.transform = '';
      if (delta > 90) close();
      delta = 0;
    };
    grip.addEventListener('touchstart', (e) => start(e.touches[0].clientY), { passive: true });
    grip.addEventListener('touchmove', (e) => move(e.touches[0].clientY), { passive: true });
    grip.addEventListener('touchend', end);
  }

  requestAnimationFrame(() => {
    backdrop.classList.add('show');
    sheet.classList.add('show');
  });

  stack.push(handle);
  onMount?.(handle);
  return handle;
}

export function actionSheet(options, { title } = {}) {
  return new Promise((resolve) => {
    const root = sheetRoot();
    const backdrop = document.createElement('div');
    backdrop.className = 'backdrop';
    const sheet = document.createElement('div');
    sheet.className = 'sheet action-sheet';
    sheet.style.background = 'transparent';
    sheet.style.boxShadow = 'none';
    sheet.innerHTML = `
      <div class="action-group" style="backdrop-filter:blur(20px)">
        ${title ? `<div style="padding:14px;font-size:13px;color:var(--label-3);text-align:center;background:var(--fill-2)">${esc(title)}</div>` : ''}
        ${options.map((o, i) => `<button type="button" data-i="${i}" class="${o.destructive ? 'destructive' : ''}">${esc(o.label)}</button>`).join('')}
      </div>
      <div class="action-group"><button type="button" class="cancel" data-cancel>Cancelar</button></div>
    `;
    root.append(backdrop, sheet);
    document.body.style.overflow = 'hidden';

    const close = (val) => {
      sheet.classList.remove('show');
      backdrop.classList.remove('show');
      setTimeout(() => {
        sheet.remove();
        backdrop.remove();
        if (!stack.length) document.body.style.overflow = '';
        resolve(val);
      }, 320);
    };
    backdrop.addEventListener('click', () => close(null));
    sheet.querySelector('[data-cancel]').addEventListener('click', () => close(null));
    sheet.querySelectorAll('[data-i]').forEach((b) => b.addEventListener('click', () => close(options[Number(b.dataset.i)].value)));
    requestAnimationFrame(() => {
      backdrop.classList.add('show');
      sheet.classList.add('show');
    });
  });
}

export function confirmSheet({ title, message, confirmLabel = 'Eliminar', destructive = true }) {
  return new Promise((resolve) => {
    let resolved = false;
    openSheet({
      title,
      body: `<p class="muted" style="font-size:15px;line-height:1.45;margin:0 0 4px">${esc(message)}</p>`,
      footer: `
        <div style="display:grid;gap:8px">
          <button class="btn ${destructive ? 'btn-danger' : 'btn-primary'}" data-ok>${esc(confirmLabel)}</button>
          <button class="btn btn-neutral" data-cancel>Cancelar</button>
        </div>`,
      onMount: (handle) => {
        handle.el.querySelector('[data-ok]').addEventListener('click', () => { resolved = true; resolve(true); handle.close(); });
        handle.el.querySelector('[data-cancel]').addEventListener('click', () => handle.close());
      },
      onClose: () => { if (!resolved) resolve(false); }
    });
  });
}

export function emptyState({ icon, title, text, actionLabel, actionId }) {
  return `
    <div class="empty">
      <div class="empty-icon">${icon}</div>
      <h3>${esc(title)}</h3>
      <p>${esc(text)}</p>
      ${actionLabel ? `<button class="btn btn-secondary" style="max-width:260px;margin:0 auto" id="${actionId}">${esc(actionLabel)}</button>` : ''}
    </div>`;
}

export function loadingState(text = 'Cargando…') {
  return `<div class="empty"><div class="spinner lg" style="margin-bottom:16px"></div><p>${esc(text)}</p></div>`;
}
