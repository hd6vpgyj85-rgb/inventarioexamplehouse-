import { openSheet, toast, confirmSheet } from '../ui.js';
import { esc, num, svg, todayISO, money, haptic, UNITS } from '../util.js';
import { recognize } from '../ocr.js';
import { parseReceipt } from '../parser.js';
import { applyPurchase, findProductByName, state } from '../store.js';

export function openScanSheet(onDone) {
  const body = `
    <div id="scanStage">
      <div class="empty" style="padding-top:12px">
        <div class="empty-icon" style="width:72px;height:72px;background:var(--blue-dim);color:var(--blue)">${svg.camera}</div>
        <h3>Escanear recibo</h3>
        <p>El texto se lee en tu dispositivo. Ninguna foto sale de tu teléfono.</p>
      </div>
      <div style="display:grid;gap:10px">
        <button class="btn btn-primary" data-camera>Tomar foto</button>
        <button class="btn btn-secondary" data-gallery>Elegir de la galería</button>
        <button class="btn btn-neutral" data-manual>Capturar a mano</button>
      </div>
      <p class="tiny muted" style="text-align:center;margin-top:20px;line-height:1.5">Consejo: recibo plano, buena luz y toda la lista dentro del encuadre.</p>
      <input type="file" accept="image/*" capture="environment" data-input-camera hidden>
      <input type="file" accept="image/*" data-input-gallery hidden>
    </div>`;

  return openSheet({
    title: 'Escanear',
    body,
    left: { label: 'Cerrar' },
    onMount: (handle) => {
      const stage = handle.body.querySelector('#scanStage');
      const inputCam = stage.querySelector('[data-input-camera]');
      const inputGal = stage.querySelector('[data-input-gallery]');

      stage.querySelector('[data-camera]').addEventListener('click', () => inputCam.click());
      stage.querySelector('[data-gallery]').addEventListener('click', () => inputGal.click());
      stage.querySelector('[data-manual]').addEventListener('click', () => {
        handle.close();
        openReviewSheet({ tienda: '', fecha: todayISO(), total: null, items: [{ nombre: '', cantidad: 1, precio: null, unidad: 'pza' }] }, onDone);
      });

      const handleFile = async (file) => {
        if (!file) return;
        await runOcr(file, handle, onDone);
      };
      inputCam.addEventListener('change', (e) => handleFile(e.target.files?.[0]));
      inputGal.addEventListener('change', (e) => handleFile(e.target.files?.[0]));
    }
  });
}

async function runOcr(file, handle, onDone) {
  const url = URL.createObjectURL(file);
  handle.setTitle('Procesando');
  handle.setBody(`
    <img src="${url}" class="photo-preview" alt="Recibo" style="margin-bottom:20px">
    <div style="text-align:center;margin-bottom:14px">
      <div style="font-size:15px;font-weight:600" data-status>Preparando imagen</div>
      <div class="tiny muted" style="margin-top:2px">Procesando localmente</div>
    </div>
    <div class="progress-track"><div class="progress-bar" data-bar style="width:4%"></div></div>
  `);

  const statusEl = handle.body.querySelector('[data-status]');
  const bar = handle.body.querySelector('[data-bar]');

  try {
    const text = await recognize(file, ({ status, progress }) => {
      if (statusEl) statusEl.textContent = status;
      if (bar) bar.style.width = Math.round(Math.max(4, progress * 100)) + '%';
    });
    URL.revokeObjectURL(url);
    const parsed = parseReceipt(text);
    handle.close();

    if (!parsed.items.length) {
      openReviewSheet({ ...parsed, fecha: parsed.fecha || todayISO(), items: [{ nombre: '', cantidad: 1, precio: null, unidad: 'pza' }] }, onDone, true);
      return;
    }
    openReviewSheet({ ...parsed, fecha: parsed.fecha || todayISO() }, onDone);
  } catch (err) {
    URL.revokeObjectURL(url);
    handle.setTitle('Error');
    handle.setBody(`
      <div class="banner red" style="margin-bottom:20px">${svg.alert}<div>${esc(err.message || 'No se pudo procesar la imagen')}</div></div>
      <div style="display:grid;gap:10px">
        <button class="btn btn-secondary" data-retry>Intentar otra foto</button>
        <button class="btn btn-neutral" data-manual2>Capturar a mano</button>
      </div>`);
    handle.body.querySelector('[data-retry]').addEventListener('click', () => { handle.close(); setTimeout(() => openScanSheet(onDone), 360); });
    handle.body.querySelector('[data-manual2]').addEventListener('click', () => {
      handle.close();
      setTimeout(() => openReviewSheet({ tienda: '', fecha: todayISO(), total: null, items: [{ nombre: '', cantidad: 1, precio: null, unidad: 'pza' }] }, onDone), 360);
    });
  }
}

export function openReviewSheet(parsed, onDone, noResults = false) {
  const items = parsed.items.map((it, i) => ({ ...it, key: 'i' + i }));
  let counter = items.length;
  const meta = { tienda: parsed.tienda || '', fecha: parsed.fecha || todayISO(), total: parsed.total ?? null };

  const itemHtml = (it) => {
    const match = it.nombre ? findProductByName(it.nombre, it.marca) : null;
    return `
      <div class="receipt-item" data-key="${it.key}">
        <div style="flex:1;min-width:0">
          <input data-f="nombre" value="${esc(it.nombre)}" placeholder="Producto" style="font-weight:500">
          <div class="tiny muted" data-match style="display:flex;align-items:center;gap:6px;margin-top:2px">
            ${match ? `<span>Existe · ${num(match.cantidad)} ${esc(match.unidad)} → ${num((Number(match.cantidad) || 0) + (Number(it.cantidad) || 0))}</span>` : '<span class="new-badge">NUEVO</span>'}
          </div>
        </div>
        <input class="num" data-f="cantidad" type="number" inputmode="decimal" step="any" min="0" value="${esc(it.cantidad)}" aria-label="Cantidad">
        <input class="num" data-f="precio" type="number" inputmode="decimal" step="0.01" min="0" value="${it.precio ?? ''}" placeholder="$" aria-label="Precio">
        <button type="button" class="del" data-del aria-label="Quitar">${svg.trash}</button>
      </div>`;
  };

  const bodyHtml = () => `
    ${noResults ? `<div class="banner yellow" style="margin-bottom:16px">${svg.alert}<div>No se detectaron productos automáticamente. Captúralos a mano.</div></div>` : ''}
    <div class="list" style="margin-bottom:20px">
      <div class="field-grid">
        <div class="field"><label>Tienda</label><input data-meta="tienda" value="${esc(meta.tienda)}" placeholder="Opcional"></div>
        <div class="field"><label>Fecha</label><input data-meta="fecha" type="date" value="${esc(meta.fecha)}"></div>
      </div>
      <div class="field"><label>Total del ticket</label><input data-meta="total" type="number" inputmode="decimal" step="0.01" min="0" value="${meta.total ?? ''}" placeholder="Se calcula solo"></div>
    </div>
    <div class="section-title">Productos <span class="muted" data-count>${items.length}</span></div>
    <div class="card card-pad" style="padding-top:4px;padding-bottom:4px" id="reviewItems">
      ${items.map(itemHtml).join('')}
    </div>
    <button class="btn btn-secondary btn-sm" style="margin-top:12px" data-add>+ Agregar producto</button>
    <div class="tiny muted" style="margin-top:20px;text-align:center">Las cantidades se suman a tu inventario actual.</div>`;

  return openSheet({
    title: 'Revisar compra',
    body: '',
    left: { label: 'Cancelar' },
    right: {
      label: 'Agregar',
      strong: true,
      onClick: async (handle) => {
        sync(handle);
        const valid = items.filter((it) => it.nombre.trim());
        if (!valid.length) { toast('Agrega al menos un producto'); return; }
        handle.setRightDisabled(true);
        try {
          await applyPurchase({
            fecha: meta.fecha || todayISO(),
            tienda: meta.tienda.trim(),
            total: meta.total,
            items: valid.map((it) => ({ nombre: it.nombre.trim(), marca: it.marca || '', cantidad: Number(it.cantidad) || 1, precio: it.precio, unidad: it.unidad || 'pza' }))
          });
          haptic(12);
          toast(`Inventario actualizado · ${valid.length} producto${valid.length > 1 ? 's' : ''}`);
          handle.close();
          onDone?.();
        } catch (err) {
          handle.setRightDisabled(false);
          toast('No se pudo guardar: ' + err.message);
        }
      }
    },
    onMount: (handle) => {
      const render = () => {
        handle.setBody(bodyHtml());
        bind(handle);
      };

      const bind = (h) => {
        h.body.querySelectorAll('[data-meta]').forEach((input) => {
          input.addEventListener('input', () => {
            const k = input.dataset.meta;
            meta[k] = k === 'total' ? (input.value === '' ? null : Number(input.value)) : input.value;
          });
        });
        h.body.querySelectorAll('[data-key]').forEach((rowEl) => {
          const key = rowEl.dataset.key;
          const item = items.find((i) => i.key === key);
          const matchEl = rowEl.querySelector('[data-match]');
          const refreshMatch = () => {
            if (!matchEl) return;
            const match = item.nombre.trim() ? findProductByName(item.nombre, item.marca) : null;
            matchEl.innerHTML = match
              ? `<span>Existe · ${num(match.cantidad)} ${esc(match.unidad)} → ${num((Number(match.cantidad) || 0) + (Number(item.cantidad) || 0))}</span>`
              : '<span class="new-badge">NUEVO</span>';
          };
          rowEl.querySelectorAll('[data-f]').forEach((input) => {
            input.addEventListener('input', () => {
              const f = input.dataset.f;
              if (f === 'precio') item.precio = input.value === '' ? null : Number(input.value);
              else if (f === 'cantidad') item.cantidad = input.value === '' ? 1 : Number(input.value);
              else item[f] = input.value;
              if (f !== 'precio') refreshMatch();
            });
          });
          rowEl.querySelector('[data-del]').addEventListener('click', () => {
            const idx = items.findIndex((i) => i.key === key);
            items.splice(idx, 1);
            render();
          });
        });
        h.body.querySelector('[data-add]').addEventListener('click', () => {
          sync(h);
          items.push({ key: 'i' + counter++, nombre: '', cantidad: 1, precio: null, unidad: 'pza' });
          render();
          const inputs = h.body.querySelectorAll('[data-f="nombre"]');
          inputs[inputs.length - 1]?.focus();
        });
      };

      const sync = (h) => {
        h.body.querySelectorAll('[data-key]').forEach((rowEl) => {
          const item = items.find((i) => i.key === rowEl.dataset.key);
          if (!item) return;
          rowEl.querySelectorAll('[data-f]').forEach((input) => {
            const f = input.dataset.f;
            if (f === 'precio') item.precio = input.value === '' ? null : Number(input.value);
            else if (f === 'cantidad') item.cantidad = input.value === '' ? 1 : Number(input.value);
            else item[f] = input.value;
          });
        });
      };

      handle.sync = sync;
      render();
    }
  });

  function sync(handle) { handle.sync?.(handle); }
}
