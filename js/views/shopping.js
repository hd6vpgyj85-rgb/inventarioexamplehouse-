import { state, saveShoppingItem, deleteShoppingItem, clearBoughtShopping, addManualShoppingItem, toggleShoppingForProduct, findShoppingItemForProduct } from '../store.js';
import { esc, num, svg, haptic, normalize, status } from '../util.js';
import { emptyState, openSheet, toast } from '../ui.js';

export function renderShopping({ rerender }) {
  const pending = state.shopping.filter((i) => !i.comprado);
  const done = state.shopping.filter((i) => i.comprado);

  const itemRow = (i) => `
    <div class="checkrow ${i.comprado ? 'checked' : ''}" data-item="${i.id}">
      <button type="button" class="checkbox" data-toggle aria-label="Marcar comprado">${svg.check}</button>
      <div class="row-main" data-edit>
        <div class="row-title">${esc(i.nombre)}</div>
        <div class="row-sub">${num(i.cantidad)} ${esc(i.unidad || 'pza')}${i.auto ? ' · sugerido' : ''}</div>
      </div>
      <button type="button" class="del" data-del aria-label="Eliminar" style="color:var(--label-4)">${svg.trash}</button>
    </div>`;

  const html = `
    <h1 class="large-title">Mandado</h1>
    <p class="muted tiny" style="margin:0 0 16px">${pending.length ? `${pending.length} producto${pending.length > 1 ? 's' : ''} por comprar` : 'Todo listo por ahora'}</p>

    ${state.shopping.length === 0 ? emptyState({
      icon: svg.cart,
      title: 'Lista vacía',
      text: 'Cuando un producto se agote o baje del mínimo aparecerá aquí automáticamente.',
      actionLabel: 'Agregar producto',
      actionId: 'shopEmptyAdd'
    }) : `
      ${pending.length ? `<div class="list">${pending.map(itemRow).join('')}</div>` : `<div class="card card-pad" style="display:flex;gap:12px;align-items:center"><span class="dot green"></span><div><div style="font-weight:500">Nada pendiente</div><div class="tiny muted">Tu despensa está surtida.</div></div></div>`}

      ${done.length ? `
        <div class="section-title">Comprados <button id="shopClear">Limpiar</button></div>
        <div class="list">${done.map(itemRow).join('')}</div>` : ''}
    `}

    <div class="btn-row" style="margin-top:20px">
      <button class="btn btn-secondary" id="shopAdd">Agregar producto</button>
    </div>
  `;

  return {
    html,
    mount(root) {
      root.querySelector('#shopAdd')?.addEventListener('click', () => openPicker(rerender));
      root.querySelector('#shopEmptyAdd')?.addEventListener('click', () => openPicker(rerender));
      root.querySelector('#shopClear')?.addEventListener('click', async () => {
        await clearBoughtShopping();
        rerender();
      });

      root.querySelectorAll('[data-item]').forEach((el) => {
        const id = el.dataset.item;
        const item = state.shopping.find((i) => i.id === id);
        el.querySelector('[data-toggle]').addEventListener('click', async () => {
          haptic();
          item.comprado = !item.comprado;
          await saveShoppingItem(item);
          rerender();
        });
        el.querySelector('[data-del]').addEventListener('click', async (e) => {
          e.stopPropagation();
          await deleteShoppingItem(id);
          rerender();
        });
        el.querySelector('[data-edit]').addEventListener('click', () => openEditItem(item, rerender));
      });
    }
  };
}

function openPicker(rerender) {
  let q = '';

  const rowHtml = (p) => {
    const added = !!findShoppingItemForProduct(p.id);
    return `
      <div class="checkrow tappable" data-pick="${p.id}">
        <span class="checkbox ${added ? 'is-added' : ''}">${svg.check}</span>
        <div class="row-main">
          <div class="row-title">${esc(p.nombre)}</div>
          <div class="row-sub">${[p.marca, num(p.cantidad) + ' ' + esc(p.unidad)].filter(Boolean).join(' · ')}</div>
        </div>
        <span class="dot ${status(p)}"></span>
      </div>`;
  };

  const bodyHtml = () => {
    if (!state.products.length) {
      return `${emptyState({ icon: svg.box, title: 'Aún no tienes productos', text: 'Agrega productos a tu inventario primero, o escribe uno suelto abajo.' })}
        <button class="btn btn-secondary" id="pickManual">Escribir un producto suelto</button>`;
    }
    const term = normalize(q);
    const filtered = term
      ? state.products.filter((p) => normalize(p.nombre).includes(term) || normalize(p.marca).includes(term))
      : state.products;
    const groups = new Map();
    filtered.forEach((p) => {
      const cat = p.categoria || 'Otros';
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat).push(p);
    });

    return `
      <div class="search-wrap">${svg.search}<input class="search" id="pickSearch" type="search" placeholder="Buscar en tu inventario" value="${esc(q)}"></div>
      ${filtered.length ? [...groups.entries()].map(([cat, items]) => `
        <div class="section-title">${esc(cat)}</div>
        <div class="list">${items.map(rowHtml).join('')}</div>
      `).join('') : `<p class="muted tiny" style="text-align:center;margin-top:20px">Sin resultados</p>`}
      <button class="btn btn-secondary" style="margin-top:20px" id="pickManual">Escribir un producto suelto</button>`;
  };

  return openSheet({
    title: 'Agregar al mandado',
    body: '',
    left: { label: 'Listo', strong: true },
    onMount: (handle) => {
      const render = () => {
        handle.setBody(bodyHtml());
        bind();
      };
      const bind = () => {
        handle.body.querySelector('#pickSearch')?.addEventListener('input', (e) => { q = e.target.value; render(); setTimeout(() => { const el = handle.body.querySelector('#pickSearch'); el?.focus(); el?.setSelectionRange(q.length, q.length); }, 0); });
        handle.body.querySelectorAll('[data-pick]').forEach((row) => {
          row.addEventListener('click', async () => {
            const product = state.products.find((p) => p.id === row.dataset.pick);
            if (!product) return;
            haptic();
            const result = await toggleShoppingForProduct(product);
            row.querySelector('.checkbox').classList.toggle('is-added', !!result);
            rerender();
          });
        });
        handle.body.querySelector('#pickManual')?.addEventListener('click', () => openManualItem(rerender));
      };
      render();
    }
  });
}

function openManualItem(rerender) {
  openSheet({
    title: 'Producto suelto',
    body: `
      <div class="list">
        <div class="field"><label>Producto</label><input id="siName" placeholder="Ej. Servilletas" autocomplete="off"></div>
        <div class="field-grid">
          <div class="field"><label>Cantidad</label><input id="siQty" type="number" inputmode="decimal" step="any" min="0" value="1"></div>
          <div class="field"><label>Unidad</label><input id="siUnit" value="pza"></div>
        </div>
      </div>`,
    left: { label: 'Cancelar' },
    right: {
      label: 'Agregar',
      strong: true,
      onClick: async (handle) => {
        const nombre = handle.body.querySelector('#siName').value.trim();
        if (!nombre) { toast('Escribe un nombre'); return; }
        await addManualShoppingItem({
          nombre,
          cantidad: Number(handle.body.querySelector('#siQty').value) || 1,
          unidad: handle.body.querySelector('#siUnit').value.trim() || 'pza'
        });
        handle.close();
        rerender();
      }
    },
    onMount: (h) => setTimeout(() => h.body.querySelector('#siName')?.focus(), 380)
  });
}

function openEditItem(item, rerender) {
  openSheet({
    title: item.nombre,
    body: `
      <div class="list">
        <div class="field"><label>Producto</label><input id="eiName" value="${esc(item.nombre)}"></div>
        <div class="field-grid">
          <div class="field"><label>Cantidad</label><input id="eiQty" type="number" inputmode="decimal" step="any" min="0" value="${esc(item.cantidad)}"></div>
          <div class="field"><label>Unidad</label><input id="eiUnit" value="${esc(item.unidad || 'pza')}"></div>
        </div>
      </div>
      <button class="btn btn-danger" style="margin-top:20px" id="eiDel">Quitar de la lista</button>`,
    left: { label: 'Cancelar' },
    right: {
      label: 'Guardar',
      strong: true,
      onClick: async (handle) => {
        item.nombre = handle.body.querySelector('#eiName').value.trim() || item.nombre;
        item.cantidad = Number(handle.body.querySelector('#eiQty').value) || 1;
        item.unidad = handle.body.querySelector('#eiUnit').value.trim() || 'pza';
        item.auto = false;
        await saveShoppingItem(item);
        handle.close();
        rerender();
      }
    },
    onMount: (handle) => {
      handle.body.querySelector('#eiDel').addEventListener('click', async () => {
        await deleteShoppingItem(item.id);
        handle.close();
        rerender();
      });
    }
  });
}
