import { state, saveShoppingItem, deleteShoppingItem, clearBoughtShopping, addManualShoppingItem, syncShopping } from '../store.js';
import { esc, num, svg, haptic } from '../util.js';
import { emptyState, openSheet, toast, confirmSheet } from '../ui.js';

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
      actionLabel: 'Agregar a mano',
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
      root.querySelector('#shopAdd')?.addEventListener('click', () => openAddItem(rerender));
      root.querySelector('#shopEmptyAdd')?.addEventListener('click', () => openAddItem(rerender));
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

function openAddItem(rerender) {
  openSheet({
    title: 'Agregar al mandado',
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
