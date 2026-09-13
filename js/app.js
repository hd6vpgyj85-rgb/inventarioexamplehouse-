import { loadAll, syncShopping, subscribe } from './store.js';
import { renderHome } from './views/home.js';
import { renderInventory } from './views/inventory.js';
import { renderShopping } from './views/shopping.js';
import { renderMore } from './views/more.js';
import { openProductSheet, openProductForm } from './sheets/product.js';
import { openScanSheet } from './sheets/scan.js';
import { loadingState, toast } from './ui.js';

const viewEl = document.getElementById('view');
const topbar = document.getElementById('topbar');
const topbarTitle = document.getElementById('topbarTitle');
const topbarAction = document.getElementById('topbarAction');
const tabbar = document.getElementById('tabbar');

const TITLES = { home: 'Inicio', inventory: 'Inventario', shopping: 'Mandado', more: 'Más' };
let current = 'home';

const ctx = {
  go: (route) => navigate(route),
  rerender: () => render(),
  openProduct: (id) => openProductSheet(id),
  openForm: (p) => openProductForm(p, () => render()),
  openScan: () => openScanSheet(() => render())
};

function viewFor(route) {
  if (route === 'inventory') return renderInventory(ctx);
  if (route === 'shopping') return renderShopping(ctx);
  if (route === 'more') return renderMore(ctx);
  return renderHome(ctx);
}

function render() {
  const view = viewFor(current);
  viewEl.innerHTML = view.html;
  viewEl.classList.remove('view-enter');
  void viewEl.offsetWidth;
  viewEl.classList.add('view-enter');
  view.mount?.(viewEl, render);

  topbarTitle.textContent = TITLES[current];
  if (view.topbarAction) {
    topbarAction.hidden = false;
    topbarAction.textContent = view.topbarAction.label;
    topbarAction.style.fontSize = '26px';
    topbarAction.style.lineHeight = '1';
    topbarAction.onclick = view.topbarAction.onClick;
  } else {
    topbarAction.hidden = true;
    topbarAction.onclick = null;
  }

  tabbar.querySelectorAll('[data-route]').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.route === current)));
}

function navigate(route) {
  if (!TITLES[route]) route = 'home';
  current = route;
  if (location.hash.slice(1) !== route) location.hash = route;
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  render();
}

tabbar.addEventListener('click', (e) => {
  const scan = e.target.closest('[data-action="scan"]');
  if (scan) { ctx.openScan(); return; }
  const tab = e.target.closest('[data-route]');
  if (tab) navigate(tab.dataset.route);
});

window.addEventListener('hashchange', () => {
  const route = location.hash.slice(1);
  if (route && route !== current) navigate(route);
});

window.addEventListener('scroll', () => {
  topbar.classList.toggle('scrolled', window.scrollY > 4);
}, { passive: true });

subscribe(() => {});

async function init() {
  viewEl.innerHTML = loadingState('Cargando tu despensa…');
  try {
    await loadAll();
    await syncShopping();
  } catch (err) {
    viewEl.innerHTML = `<div class="empty"><div class="empty-icon">!</div><h3>No se pudo abrir la base de datos</h3><p>${err.message}. Si estás en navegación privada, IndexedDB puede estar bloqueado.</p></div>`;
    return;
  }
  const route = location.hash.slice(1);
  current = TITLES[route] ? route : 'home';
  render();
}

init();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
});
window.installApp = async () => {
  if (!deferredPrompt) { toast('Usa el menú del navegador para instalar'); return; }
  deferredPrompt.prompt();
  deferredPrompt = null;
};
