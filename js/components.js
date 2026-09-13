import { esc, num, status, statusLabel, svg } from './util.js';

export function productRow(p, { stepper = true } = {}) {
  const st = status(p);
  const sub = [p.marca, p.categoria].filter(Boolean).join(' · ');
  return `
    <div class="row tappable" data-product="${p.id}">
      <span class="dot ${st}"></span>
      <div class="row-main">
        <div class="row-title">${esc(p.nombre)}</div>
        <div class="row-sub">${sub ? esc(sub) + ' · ' : ''}${st === 'red' ? 'Agotado' : num(p.cantidad) + ' ' + esc(p.unidad)}</div>
      </div>
      ${stepper ? quantityStepper(p) : `<span class="row-value">${num(p.cantidad)} ${esc(p.unidad)}</span><span class="chevron">${svg.chevron}</span>`}
    </div>`;
}

export function quantityStepper(p) {
  return `
    <div class="stepper" data-stepper="${p.id}">
      <button type="button" data-step="-1" aria-label="Quitar uno" ${Number(p.cantidad) <= 0 ? 'disabled' : ''}>${svg.minus}</button>
      <span class="qty" data-qty>${num(p.cantidad)}</span>
      <button type="button" data-step="1" aria-label="Agregar uno">${svg.plus}</button>
    </div>`;
}

export function statusPill(p) {
  const st = status(p);
  return `<span class="pill ${st}">${statusLabel(st)}</span>`;
}

export function attachSteppers(container, onChange) {
  container.querySelectorAll('[data-stepper]').forEach((el) => {
    el.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-step]');
      if (!btn) return;
      e.stopPropagation();
      onChange(el.dataset.stepper, Number(btn.dataset.step));
    });
  });
}

export function attachRows(container, onTap) {
  container.querySelectorAll('[data-product]').forEach((el) => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-stepper]')) return;
      onTap(el.dataset.product);
    });
  });
}
