import { state, stats } from '../store.js';
import { esc, num, greeting, status, svg, money, fmtDateShort } from '../util.js';
import { emptyState } from '../ui.js';

export function renderHome({ go, openProduct, openScan }) {
  const s = stats();
  const attention = state.products
    .filter((p) => status(p) !== 'green')
    .sort((a, b) => (status(a) === 'red' ? -1 : 1) - (status(b) === 'red' ? -1 : 1))
    .slice(0, 5);
  const pending = state.shopping.filter((i) => !i.comprado);
  const lastPurchase = state.purchases[0];

  const html = `
    <p class="greeting">${greeting()}</p>
    <h1 class="large-title">Tu inventario</h1>

    ${s.total === 0 ? emptyState({
      icon: svg.box,
      title: 'Empieza tu despensa',
      text: 'Escanea un recibo o agrega productos a mano para llevar el control de lo que tienes en casa.',
      actionLabel: 'Escanear recibo',
      actionId: 'emptyScan'
    }) : `
      <div class="stat-grid" style="margin-top:16px">
        <div class="stat"><div class="stat-num">${s.total}</div><div class="stat-label">Productos</div></div>
        <div class="stat is-yellow"><div class="stat-num">${s.low}</div><div class="stat-label">Poco</div></div>
        <div class="stat is-red"><div class="stat-num">${s.out}</div><div class="stat-label">Agotados</div></div>
      </div>

      <button class="btn btn-primary" style="margin-top:20px" id="homeScan">${svg.camera.replace('<svg', '<svg class="icon"')} Escanear recibo</button>

      ${attention.length ? `
        <div class="section-title">Necesitan atención <button data-go="inventory">Ver todo</button></div>
        <div class="list">
          ${attention.map((p) => `
            <div class="row tappable" data-product="${p.id}">
              <span class="dot ${status(p)}"></span>
              <div class="row-main">
                <div class="row-title">${esc(p.nombre)}</div>
                ${p.marca ? `<div class="row-sub">${esc(p.marca)}</div>` : ''}
              </div>
              <span class="row-value">${status(p) === 'red' ? 'Agotado' : num(p.cantidad) + ' ' + esc(p.unidad)}</span>
              <span class="chevron">${svg.chevron}</span>
            </div>`).join('')}
        </div>` : `
        <div class="section-title">Estado</div>
        <div class="card card-pad" style="display:flex;gap:12px;align-items:center">
          <span class="dot green"></span>
          <div><div style="font-weight:500">Todo en orden</div><div class="tiny muted">Ningún producto bajo o agotado.</div></div>
        </div>`}

      <div class="section-title">Próximo mandado</div>
      <button class="row tappable list" data-go="shopping" style="width:100%">
        <span style="color:var(--blue)">${svg.cart.replace('<svg', '<svg class="icon"')}</span>
        <div class="row-main">
          <div class="row-title">Lista del mandado</div>
          <div class="row-sub">${pending.length ? pending.length + ' producto' + (pending.length > 1 ? 's' : '') + ' por comprar' : 'Sin pendientes'}</div>
        </div>
        <span class="chevron">${svg.chevron}</span>
      </button>

      ${lastPurchase ? `
        <div class="section-title">Última compra</div>
        <button class="row tappable list" data-go="more" style="width:100%">
          <span class="muted">${svg.clock.replace('<svg', '<svg class="icon"')}</span>
          <div class="row-main">
            <div class="row-title">${esc(lastPurchase.tienda || 'Compra')}</div>
            <div class="row-sub">${fmtDateShort(lastPurchase.fecha)} · ${lastPurchase.items.length} producto${lastPurchase.items.length > 1 ? 's' : ''}</div>
          </div>
          <span class="row-value">${money(lastPurchase.total)}</span>
          <span class="chevron">${svg.chevron}</span>
        </button>` : ''}
    `}
  `;

  return {
    html,
    mount(root) {
      root.querySelector('#homeScan')?.addEventListener('click', openScan);
      root.querySelector('#emptyScan')?.addEventListener('click', openScan);
      root.querySelectorAll('[data-go]').forEach((el) => el.addEventListener('click', () => go(el.dataset.go)));
      root.querySelectorAll('[data-product]').forEach((el) => el.addEventListener('click', () => openProduct(el.dataset.product)));
    }
  };
}
