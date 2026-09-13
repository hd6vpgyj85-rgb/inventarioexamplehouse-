import { state, adjustQuantity } from '../store.js';
import { esc, num, status, svg, normalize, CATEGORIES, haptic } from '../util.js';
import { emptyState } from '../ui.js';
import { productRow, attachSteppers, attachRows } from '../components.js';

const filters = { q: '', cat: 'all', estado: 'all' };

export function renderInventory({ openProduct, openForm, openScan }) {
  const list = filtered();

  const html = `
    <h1 class="large-title">Inventario</h1>
    <div class="search-wrap">
      ${svg.search}
      <input class="search" id="invSearch" type="search" placeholder="Buscar producto o marca" value="${esc(filters.q)}" autocomplete="off">
    </div>
    <div class="segmented" style="margin-bottom:12px" id="invEstado">
      ${[['all', 'Todos'], ['green', 'Disponible'], ['yellow', 'Poco'], ['red', 'Agotado']]
        .map(([v, l]) => `<button data-estado="${v}" class="${filters.estado === v ? 'active' : ''}">${l}</button>`).join('')}
    </div>
    <div class="chips" id="invCats">
      <button class="chip ${filters.cat === 'all' ? 'active' : ''}" data-cat="all">Todas</button>
      ${categoriesInUse().map((c) => `<button class="chip ${filters.cat === c ? 'active' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('')}
    </div>

    <div id="invList">
      ${list.length ? `<div class="list">${list.map((p) => productRow(p)).join('')}</div>
        <p class="tiny muted" style="text-align:center;margin-top:16px">${list.length} de ${state.products.length} producto${state.products.length > 1 ? 's' : ''}</p>`
      : state.products.length ? emptyState({ icon: svg.search.replace(' class="icon"', ''), title: 'Sin resultados', text: 'Prueba con otro término o cambia los filtros.' })
      : emptyState({ icon: svg.box, title: 'Inventario vacío', text: 'Agrega tu primer producto o escanea un recibo.', actionLabel: 'Agregar producto', actionId: 'invEmptyAdd' })}
    </div>

    <button class="btn btn-secondary" style="margin-top:20px" id="invAdd">Agregar producto</button>
  `;

  return {
    html,
    topbarAction: { label: '+', onClick: () => openForm() },
    mount(root, rerender) {
      const search = root.querySelector('#invSearch');
      search?.addEventListener('input', () => {
        filters.q = search.value;
        refreshList(root, { openProduct });
      });

      root.querySelector('#invEstado')?.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-estado]');
        if (!btn) return;
        filters.estado = btn.dataset.estado;
        root.querySelectorAll('[data-estado]').forEach((b) => b.classList.toggle('active', b === btn));
        refreshList(root, { openProduct });
      });

      root.querySelector('#invCats')?.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-cat]');
        if (!btn) return;
        filters.cat = btn.dataset.cat;
        root.querySelectorAll('[data-cat]').forEach((b) => b.classList.toggle('active', b === btn));
        refreshList(root, { openProduct });
      });

      root.querySelector('#invAdd')?.addEventListener('click', () => openForm());
      root.querySelector('#invEmptyAdd')?.addEventListener('click', () => openForm());
      bindList(root, { openProduct });
    }
  };
}

function categoriesInUse() {
  const used = new Set(state.products.map((p) => p.categoria).filter(Boolean));
  return CATEGORIES.filter((c) => used.has(c)).concat([...used].filter((c) => !CATEGORIES.includes(c)));
}

function filtered() {
  const q = normalize(filters.q);
  return state.products.filter((p) => {
    if (filters.cat !== 'all' && p.categoria !== filters.cat) return false;
    if (filters.estado !== 'all' && status(p) !== filters.estado) return false;
    if (!q) return true;
    return normalize(p.nombre).includes(q) || normalize(p.marca).includes(q) || normalize(p.categoria).includes(q);
  });
}

function refreshList(root, ctx) {
  const list = filtered();
  const container = root.querySelector('#invList');
  container.innerHTML = list.length
    ? `<div class="list">${list.map((p) => productRow(p)).join('')}</div>
       <p class="tiny muted" style="text-align:center;margin-top:16px">${list.length} de ${state.products.length} producto${state.products.length > 1 ? 's' : ''}</p>`
    : emptyState({ icon: svg.search.replace(' class="icon"', ''), title: 'Sin resultados', text: 'Prueba con otro término o cambia los filtros.' });
  bindList(root, ctx);
}

function bindList(root, { openProduct }) {
  const container = root.querySelector('#invList');
  if (!container) return;
  attachRows(container, openProduct);
  attachSteppers(container, async (id, delta) => {
    haptic();
    await adjustQuantity(id, delta);
    const p = state.products.find((x) => x.id === id);
    const rowEl = container.querySelector(`[data-product="${id}"]`);
    if (!p || !rowEl) return;
    rowEl.querySelector('[data-qty]').textContent = num(p.cantidad);
    rowEl.querySelector('.dot').className = 'dot ' + status(p);
    const sub = [p.marca, p.categoria].filter(Boolean).join(' · ');
    rowEl.querySelector('.row-sub').textContent = `${sub ? sub + ' · ' : ''}${status(p) === 'red' ? 'Agotado' : num(p.cantidad) + ' ' + p.unidad}`;
    rowEl.querySelector('[data-step="-1"]').disabled = Number(p.cantidad) <= 0;
    if (filters.estado !== 'all' && status(p) !== filters.estado) refreshList(root, { openProduct });
  });
}
