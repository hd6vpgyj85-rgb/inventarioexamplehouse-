import { openSheet, confirmSheet, toast } from '../ui.js';
import { esc, money, num, fmtDate, status, statusLabel, svg, UNITS, CATEGORIES, haptic } from '../util.js';
import { state, saveProduct, deleteProduct, adjustQuantity, newProduct } from '../store.js';

export function openProductSheet(id) {
  const render = (handle) => {
    const p = state.products.find((x) => x.id === id);
    if (!p) { handle.close(); return; }
    const st = status(p);
    const hist = [...(p.historialCompras || [])].reverse().slice(0, 6);

    handle.setBody(`
      <div style="text-align:center;padding:4px 0 20px">
        <div style="font-size:26px;font-weight:700;letter-spacing:-0.02em">${esc(p.nombre)}</div>
        ${p.marca ? `<div class="muted" style="font-size:15px;margin-top:2px">${esc(p.marca)}</div>` : ''}
        <div style="margin-top:12px"><span class="pill ${st}">${statusLabel(st)}</span></div>
      </div>

      <div class="card card-pad" style="display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:20px">
        <div>
          <div style="font-size:28px;font-weight:700;font-variant-numeric:tabular-nums">${num(p.cantidad)} <span style="font-size:16px;font-weight:500;color:var(--label-3)">${esc(p.unidad)}</span></div>
          <div class="tiny muted" style="margin-top:2px">Mínimo ${num(p.cantidadMinima)} ${esc(p.unidad)}</div>
        </div>
        <div class="stepper" data-detail-stepper>
          <button type="button" data-step="-1" ${Number(p.cantidad) <= 0 ? 'disabled' : ''}>${svg.minus}</button>
          <span class="qty">${num(p.cantidad)}</span>
          <button type="button" data-step="1">${svg.plus}</button>
        </div>
      </div>

      <div class="list" style="margin-bottom:20px">
        <div class="row"><div class="row-main"><div class="row-title" style="font-size:15px">Categoría</div></div><span class="row-value">${esc(p.categoria || '—')}</span></div>
        <div class="row"><div class="row-main"><div class="row-title" style="font-size:15px">Último precio</div></div><span class="row-value">${money(p.precioUltimaCompra)}</span></div>
        <div class="row"><div class="row-main"><div class="row-title" style="font-size:15px">Precio promedio</div></div><span class="row-value">${money(p.precioPromedio)}</span></div>
        <div class="row"><div class="row-main"><div class="row-title" style="font-size:15px">Última compra</div></div><span class="row-value">${fmtDate(p.fechaUltimaCompra)}</span></div>
        <div class="row"><div class="row-main"><div class="row-title" style="font-size:15px">Tienda</div></div><span class="row-value">${esc(p.tienda || '—')}</span></div>
      </div>

      ${p.notas ? `<div class="section-title">Notas</div><div class="card card-pad tiny" style="line-height:1.5">${esc(p.notas)}</div>` : ''}

      ${hist.length ? `
        <div class="section-title">Historial de compras</div>
        <div class="list">
          ${hist.map((h) => `
            <div class="row">
              <div class="row-main">
                <div class="row-title" style="font-size:15px">${fmtDate(h.fecha)}</div>
                <div class="row-sub">${esc(h.tienda || 'Sin tienda')} · +${num(h.cantidad)}</div>
              </div>
              <span class="row-value">${money(h.precio)}</span>
            </div>`).join('')}
        </div>` : ''}

      <div style="display:grid;gap:8px;margin-top:24px">
        <button class="btn btn-secondary" data-edit>Editar producto</button>
        <button class="btn btn-danger" data-delete>Eliminar</button>
      </div>
    `);

    handle.body.querySelector('[data-detail-stepper]')?.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-step]');
      if (!btn) return;
      haptic();
      await adjustQuantity(id, Number(btn.dataset.step));
      render(handle);
    });
    handle.body.querySelector('[data-edit]').addEventListener('click', () => openProductForm(p, () => render(handle)));
    handle.body.querySelector('[data-delete]').addEventListener('click', async () => {
      const ok = await confirmSheet({ title: 'Eliminar producto', message: `Se eliminará "${p.nombre}" y su historial. Esta acción no se puede deshacer.` });
      if (!ok) return;
      await deleteProduct(id);
      toast('Producto eliminado');
      handle.close();
    });
  };

  return openSheet({
    title: 'Detalle',
    body: '',
    left: { label: 'Cerrar' },
    onMount: render
  });
}

export function openProductForm(product, onSaved) {
  const isNew = !product;
  const p = product ? { ...product } : newProduct();

  const field = (label, name, value, type = 'text', extra = '') =>
    `<div class="field"><label>${label}</label><input name="${name}" type="${type}" value="${esc(value ?? '')}" ${extra}></div>`;

  const body = `
    <form id="prodForm" autocomplete="off">
      <div class="list" style="margin-bottom:20px">
        ${field('Nombre', 'nombre', p.nombre, 'text', 'required placeholder="Leche entera"')}
        ${field('Marca', 'marca', p.marca, 'text', 'placeholder="Opcional"')}
        <div class="field"><label>Categoría</label>
          <select name="categoria">${CATEGORIES.map((c) => `<option ${c === p.categoria ? 'selected' : ''}>${c}</option>`).join('')}</select>
        </div>
      </div>

      <div class="section-title">Cantidad</div>
      <div class="list" style="margin-bottom:20px">
        <div class="field-grid">
          ${field('Cantidad actual', 'cantidad', p.cantidad, 'number', 'step="any" min="0" inputmode="decimal"')}
          <div class="field"><label>Unidad</label>
            <select name="unidad">${UNITS.map((u) => `<option ${u === p.unidad ? 'selected' : ''}>${u}</option>`).join('')}</select>
          </div>
        </div>
        ${field('Cantidad mínima (alerta)', 'cantidadMinima', p.cantidadMinima, 'number', 'step="any" min="0" inputmode="decimal"')}
      </div>

      <div class="section-title">Compra</div>
      <div class="list" style="margin-bottom:20px">
        ${field('Precio última compra', 'precioUltimaCompra', p.precioUltimaCompra ?? '', 'number', 'step="0.01" min="0" inputmode="decimal" placeholder="0.00"')}
        ${field('Tienda', 'tienda', p.tienda, 'text', 'placeholder="Opcional"')}
        ${field('Fecha última compra', 'fechaUltimaCompra', p.fechaUltimaCompra ?? '', 'date')}
      </div>

      <div class="list">
        <div class="field"><label>Notas</label><textarea name="notas" placeholder="Opcional">${esc(p.notas)}</textarea></div>
      </div>
    </form>`;

  return openSheet({
    title: isNew ? 'Nuevo producto' : 'Editar',
    body,
    left: { label: 'Cancelar' },
    right: {
      label: 'Guardar',
      strong: true,
      onClick: async (handle) => {
        const form = handle.body.querySelector('#prodForm');
        const data = Object.fromEntries(new FormData(form).entries());
        if (!data.nombre.trim()) { toast('Escribe un nombre'); return; }
        const saved = {
          ...p,
          nombre: data.nombre.trim(),
          marca: data.marca.trim(),
          categoria: data.categoria,
          cantidad: Number(data.cantidad) || 0,
          unidad: data.unidad,
          cantidadMinima: Number(data.cantidadMinima) || 0,
          precioUltimaCompra: data.precioUltimaCompra === '' ? p.precioUltimaCompra ?? null : Number(data.precioUltimaCompra),
          tienda: data.tienda.trim(),
          fechaUltimaCompra: data.fechaUltimaCompra || null,
          notas: data.notas.trim()
        };
        if (saved.precioPromedio === null || saved.precioPromedio === undefined) saved.precioPromedio = saved.precioUltimaCompra;
        await saveProduct(saved);
        toast(isNew ? 'Producto agregado' : 'Cambios guardados');
        handle.close();
        onSaved?.(saved);
      }
    },
    onMount: (handle) => {
      setTimeout(() => handle.body.querySelector('input[name="nombre"]')?.focus(), 380);
    }
  });
}
