import { state, exportData, importData, wipeAll, deletePurchase, setSetting, syncShopping } from '../store.js';
import { esc, money, fmtDate, num, svg } from '../util.js';
import { openSheet, toast, confirmSheet, emptyState } from '../ui.js';

export function renderMore({ rerender }) {
  const purchases = state.purchases;
  const totalGastado = purchases.reduce((a, p) => a + (Number(p.total) || 0), 0);

  const html = `
    <h1 class="large-title">Más</h1>

    <div class="section-title">Historial de compras</div>
    ${purchases.length ? `
      <div class="stat-grid" style="grid-template-columns:1fr 1fr;margin-bottom:12px">
        <div class="stat"><div class="stat-num">${purchases.length}</div><div class="stat-label">Compras</div></div>
        <div class="stat"><div class="stat-num" style="font-size:22px">${money(totalGastado)}</div><div class="stat-label">Total gastado</div></div>
      </div>
      <div class="list">
        ${purchases.slice(0, 20).map((p) => `
          <div class="row tappable" data-purchase="${p.id}">
            <div class="row-main">
              <div class="row-title">${esc(p.tienda || 'Compra sin tienda')}</div>
              <div class="row-sub">${fmtDate(p.fecha)} · ${p.items.length} producto${p.items.length > 1 ? 's' : ''}</div>
            </div>
            <span class="row-value">${money(p.total)}</span>
            <span class="chevron">${svg.chevron}</span>
          </div>`).join('')}
      </div>
      ${purchases.length > 20 ? `<p class="tiny muted" style="text-align:center;margin-top:12px">Mostrando las 20 más recientes</p>` : ''}
    ` : `<div class="card">${emptyState({ icon: svg.clock, title: 'Sin compras', text: 'Escanea un recibo para registrar tu primera compra.' })}</div>`}

    <div class="section-title">Datos</div>
    <div class="list">
      <button class="row tappable" id="moreExport" style="width:100%">
        <span style="color:var(--blue)">${svg.doc.replace('<svg', '<svg class="icon"')}</span>
        <div class="row-main"><div class="row-title">Exportar datos</div><div class="row-sub">Descarga un respaldo en JSON</div></div>
        <span class="chevron">${svg.chevron}</span>
      </button>
      <button class="row tappable" id="moreImport" style="width:100%">
        <span style="color:var(--blue)">${svg.box.replace('<svg', '<svg class="icon"')}</span>
        <div class="row-main"><div class="row-title">Importar datos</div><div class="row-sub">Restaura desde un archivo JSON</div></div>
        <span class="chevron">${svg.chevron}</span>
      </button>
    </div>

    <div class="section-title">Ajustes</div>
    <div class="list">
      <button class="row tappable" id="moreSettings" style="width:100%">
        <span class="muted">${svg.gear.replace('<svg', '<svg class="icon"')}</span>
        <div class="row-main"><div class="row-title">Configuración</div><div class="row-sub">Preferencias y almacenamiento</div></div>
        <span class="chevron">${svg.chevron}</span>
      </button>
    </div>

    <p class="tiny muted" style="text-align:center;margin-top:28px;line-height:1.5">
      Despensa · Todos tus datos se guardan solo en este dispositivo.
    </p>
    <input type="file" accept="application/json,.json" id="importInput" hidden>
  `;

  return {
    html,
    mount(root) {
      root.querySelectorAll('[data-purchase]').forEach((el) => {
        el.addEventListener('click', () => openPurchaseSheet(el.dataset.purchase, rerender));
      });
      root.querySelector('#moreExport').addEventListener('click', doExport);
      const input = root.querySelector('#importInput');
      root.querySelector('#moreImport').addEventListener('click', () => input.click());
      input.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        input.value = '';
        if (!file) return;
        await doImport(file, rerender);
      });
      root.querySelector('#moreSettings').addEventListener('click', () => openSettingsSheet(rerender));
    }
  };
}

export async function doExport() {
  const data = await exportData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `despensa-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  toast('Respaldo descargado');
}

async function doImport(file, rerender) {
  try {
    const text = await file.text();
    const payload = JSON.parse(text);
    const ok = await confirmSheet({
      title: 'Importar datos',
      message: 'Se reemplazarán los datos actuales de este dispositivo con los del archivo. Exporta primero si quieres conservarlos.',
      confirmLabel: 'Importar y reemplazar',
      destructive: true
    });
    if (!ok) return;
    const res = await importData(payload);
    toast(`Importado · ${res.products} productos`);
    rerender();
  } catch (err) {
    toast('Archivo inválido: ' + err.message, 3000);
  }
}

export function openPurchaseSheet(id, rerender) {
  const p = state.purchases.find((x) => x.id === id);
  if (!p) return;
  openSheet({
    title: 'Compra',
    left: { label: 'Cerrar' },
    body: `
      <div style="text-align:center;padding:4px 0 20px">
        <div style="font-size:26px;font-weight:700">${money(p.total)}</div>
        <div class="muted" style="font-size:15px;margin-top:2px">${esc(p.tienda || 'Sin tienda')} · ${fmtDate(p.fecha)}</div>
      </div>
      <div class="section-title" style="margin-top:0">Productos</div>
      <div class="list">
        ${p.items.map((it) => `
          <div class="row">
            <div class="row-main">
              <div class="row-title" style="font-size:16px">${esc(it.nombre)}</div>
              <div class="row-sub">${num(it.cantidad)} ${esc(it.unidad || 'pza')}${it.marca ? ' · ' + esc(it.marca) : ''}</div>
            </div>
            <span class="row-value">${money(it.precio)}</span>
          </div>`).join('')}
      </div>
      <button class="btn btn-danger" style="margin-top:24px" data-delp>Eliminar del historial</button>
      <p class="tiny muted" style="text-align:center;margin-top:10px">Eliminar no modifica las cantidades del inventario.</p>`,
    onMount: (handle) => {
      handle.body.querySelector('[data-delp]').addEventListener('click', async () => {
        const ok = await confirmSheet({ title: 'Eliminar compra', message: 'Se quitará este registro del historial.' });
        if (!ok) return;
        await deletePurchase(id);
        toast('Compra eliminada');
        handle.close();
        rerender();
      });
    }
  });
}

function openSettingsSheet(rerender) {
  const usage = state.products.length + state.purchases.length + state.shopping.length;
  openSheet({
    title: 'Configuración',
    left: { label: 'Cerrar' },
    body: `
      <div class="section-title" style="margin-top:4px">Almacenamiento</div>
      <div class="list">
        <div class="row"><div class="row-main"><div class="row-title" style="font-size:15px">Productos</div></div><span class="row-value">${state.products.length}</span></div>
        <div class="row"><div class="row-main"><div class="row-title" style="font-size:15px">Compras</div></div><span class="row-value">${state.purchases.length}</span></div>
        <div class="row"><div class="row-main"><div class="row-title" style="font-size:15px">Lista del mandado</div></div><span class="row-value">${state.shopping.length}</span></div>
        <div class="row"><div class="row-main"><div class="row-title" style="font-size:15px">Registros totales</div></div><span class="row-value">${usage}</span></div>
      </div>

      <div class="section-title">Privacidad</div>
      <div class="card card-pad tiny muted" style="line-height:1.55">
        Todo se procesa y guarda en tu dispositivo con IndexedDB. El OCR corre localmente con Tesseract.js; las fotos de tus recibos nunca se suben a ningún servidor. La app funciona sin conexión una vez instalada.
      </div>

      <div class="section-title">Mantenimiento</div>
      <div style="display:grid;gap:8px">
        <button class="btn btn-secondary" data-sync>Recalcular lista del mandado</button>
        <button class="btn btn-neutral" data-exp>Exportar respaldo</button>
        <button class="btn btn-danger" data-wipe>Borrar todos los datos</button>
      </div>

      <p class="tiny muted" style="text-align:center;margin-top:24px">Despensa v1.0 · Local-first · $0</p>`,
    onMount: (handle) => {
      handle.body.querySelector('[data-sync]').addEventListener('click', async () => {
        await syncShopping();
        toast('Lista actualizada');
        rerender();
      });
      handle.body.querySelector('[data-exp]').addEventListener('click', doExport);
      handle.body.querySelector('[data-wipe]').addEventListener('click', async () => {
        const ok = await confirmSheet({ title: 'Borrar todo', message: 'Se eliminarán productos, compras y la lista del mandado de este dispositivo. No se puede deshacer.', confirmLabel: 'Borrar todo' });
        if (!ok) return;
        await wipeAll();
        toast('Datos borrados');
        handle.close();
        rerender();
      });
    }
  });
}
