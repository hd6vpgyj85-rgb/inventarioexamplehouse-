import { db } from './db.js';
import { uid, todayISO, status, normalize } from './util.js';

const listeners = new Set();
export const state = { products: [], purchases: [], shopping: [], settings: {} };

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function emit() { listeners.forEach((fn) => fn(state)); }

export async function loadAll() {
  const [products, purchases, shopping, settings] = await Promise.all([
    db.getAll('products'), db.getAll('purchases'), db.getAll('shopping'), db.getAll('settings')
  ]);
  state.products = products.sort(byName);
  state.purchases = purchases.sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
  state.shopping = shopping;
  state.settings = Object.fromEntries(settings.map((s) => [s.key, s.value]));
  emit();
}

const byName = (a, b) => normalize(a.nombre).localeCompare(normalize(b.nombre));

export function newProduct(data = {}) {
  return {
    id: uid(),
    nombre: '',
    marca: '',
    categoria: 'Despensa',
    cantidad: 0,
    unidad: 'pza',
    cantidadMinima: 1,
    precioUltimaCompra: null,
    precioPromedio: null,
    fechaUltimaCompra: null,
    tienda: '',
    notas: '',
    historialCompras: [],
    creado: new Date().toISOString(),
    ...data
  };
}

export async function saveProduct(product) {
  const p = { ...product };
  p.cantidad = Math.max(0, Number(p.cantidad) || 0);
  p.cantidadMinima = Math.max(0, Number(p.cantidadMinima) || 0);
  await db.put('products', p);
  const i = state.products.findIndex((x) => x.id === p.id);
  if (i > -1) state.products[i] = p; else state.products.push(p);
  state.products.sort(byName);
  await syncShopping();
  emit();
  return p;
}

export async function deleteProduct(id) {
  await db.del('products', id);
  state.products = state.products.filter((p) => p.id !== id);
  const items = state.shopping.filter((s) => s.productId === id);
  await Promise.all(items.map((s) => db.del('shopping', s.id)));
  state.shopping = state.shopping.filter((s) => s.productId !== id);
  emit();
}

export async function setQuantity(id, qty) {
  const p = state.products.find((x) => x.id === id);
  if (!p) return;
  p.cantidad = Math.max(0, Number(qty.toFixed ? qty.toFixed(2) : qty) || 0);
  await db.put('products', p);
  await syncShopping();
  emit();
}

export const adjustQuantity = (id, delta) => {
  const p = state.products.find((x) => x.id === id);
  if (!p) return;
  return setQuantity(id, (Number(p.cantidad) || 0) + delta);
};

export function findProductByName(nombre, marca = '') {
  const n = normalize(nombre);
  if (!n) return null;
  const m = normalize(marca);
  return state.products.find((p) => {
    const pn = normalize(p.nombre);
    if (pn === n) return !m || !normalize(p.marca) || normalize(p.marca) === m;
    return false;
  }) || state.products.find((p) => {
    const pn = normalize(p.nombre);
    return pn.length > 3 && n.length > 3 && (pn.includes(n) || n.includes(pn));
  }) || null;
}

export async function applyPurchase({ fecha, tienda, total, items, notas = '' }) {
  const purchaseId = uid();
  const savedItems = [];

  for (const item of items) {
    const qty = Number(item.cantidad) || 1;
    const price = item.precio === '' || item.precio === null || item.precio === undefined ? null : Number(item.precio);
    let product = item.productId ? state.products.find((p) => p.id === item.productId) : findProductByName(item.nombre, item.marca);

    if (!product) {
      product = newProduct({
        nombre: item.nombre.trim(),
        marca: item.marca || '',
        categoria: item.categoria || 'Despensa',
        unidad: item.unidad || 'pza',
        cantidadMinima: item.cantidadMinima ?? 1,
        cantidad: 0
      });
    }

    product.cantidad = (Number(product.cantidad) || 0) + qty;
    if (price !== null && Number.isFinite(price)) {
      const unitPrice = qty > 0 ? price / qty : price;
      product.precioUltimaCompra = Number(unitPrice.toFixed(2));
      const prev = Array.isArray(product.historialCompras) ? product.historialCompras.filter((h) => Number.isFinite(Number(h.precioUnitario))) : [];
      const sum = prev.reduce((a, h) => a + Number(h.precioUnitario), 0) + unitPrice;
      product.precioPromedio = Number((sum / (prev.length + 1)).toFixed(2));
    }
    product.fechaUltimaCompra = fecha;
    if (tienda) product.tienda = tienda;
    product.historialCompras = [
      ...(product.historialCompras || []),
      { purchaseId, fecha, tienda, cantidad: qty, precio: price, precioUnitario: price !== null && qty > 0 ? Number((price / qty).toFixed(2)) : null }
    ];

    await db.put('products', product);
    const i = state.products.findIndex((x) => x.id === product.id);
    if (i > -1) state.products[i] = product; else state.products.push(product);
    savedItems.push({ productId: product.id, nombre: product.nombre, marca: product.marca, cantidad: qty, precio: price, unidad: product.unidad });
  }

  const computedTotal = total !== null && total !== undefined && total !== '' && Number.isFinite(Number(total))
    ? Number(total)
    : savedItems.reduce((a, it) => a + (Number(it.precio) || 0), 0);

  const purchase = { id: purchaseId, fecha, tienda: tienda || '', total: Number(computedTotal.toFixed(2)), items: savedItems, notas, creado: new Date().toISOString() };
  await db.put('purchases', purchase);
  state.purchases.unshift(purchase);
  state.products.sort(byName);

  await markBoughtFromPurchase(savedItems.map((i) => i.productId));
  await syncShopping();
  emit();
  return purchase;
}

async function markBoughtFromPurchase(productIds) {
  const toRemove = state.shopping.filter((s) => s.productId && productIds.includes(s.productId));
  await Promise.all(toRemove.map((s) => db.del('shopping', s.id)));
  state.shopping = state.shopping.filter((s) => !toRemove.includes(s));
}

export async function deletePurchase(id) {
  await db.del('purchases', id);
  state.purchases = state.purchases.filter((p) => p.id !== id);
  emit();
}

/* ---------- Lista del mandado ---------- */

export const recommendedQty = (p) => {
  const min = Math.max(1, Number(p.cantidadMinima) || 1);
  const have = Number(p.cantidad) || 0;
  return Math.max(1, Math.ceil(min * 2 - have));
};

export async function syncShopping() {
  const needed = state.products.filter((p) => status(p) !== 'green');
  const changes = [];

  for (const p of needed) {
    const existing = state.shopping.find((s) => s.productId === p.id);
    if (!existing) {
      const item = { id: uid(), productId: p.id, nombre: p.nombre, marca: p.marca, unidad: p.unidad, cantidad: recommendedQty(p), comprado: false, auto: true, creado: new Date().toISOString() };
      state.shopping.push(item);
      changes.push(item);
    }
  }

  const stale = state.shopping.filter((s) => {
    if (!s.auto || s.comprado) return false;
    const p = state.products.find((x) => x.id === s.productId);
    return !p || status(p) === 'green';
  });
  await Promise.all(stale.map((s) => db.del('shopping', s.id)));
  state.shopping = state.shopping.filter((s) => !stale.includes(s));
  if (changes.length) await db.bulkPut('shopping', changes);
}

export async function saveShoppingItem(item) {
  await db.put('shopping', item);
  const i = state.shopping.findIndex((s) => s.id === item.id);
  if (i > -1) state.shopping[i] = item; else state.shopping.push(item);
  emit();
}

export async function deleteShoppingItem(id) {
  await db.del('shopping', id);
  state.shopping = state.shopping.filter((s) => s.id !== id);
  emit();
}

export async function clearBoughtShopping() {
  const bought = state.shopping.filter((s) => s.comprado);
  await Promise.all(bought.map((s) => db.del('shopping', s.id)));
  state.shopping = state.shopping.filter((s) => !s.comprado);
  emit();
}

export async function addManualShoppingItem({ nombre, cantidad = 1, unidad = 'pza' }) {
  const item = { id: uid(), productId: null, nombre, marca: '', unidad, cantidad: Number(cantidad) || 1, comprado: false, auto: false, creado: new Date().toISOString() };
  await saveShoppingItem(item);
  return item;
}

/* ---------- Configuración ---------- */

export async function setSetting(key, value) {
  await db.put('settings', { key, value });
  state.settings[key] = value;
  emit();
}

/* ---------- Import / export ---------- */

export async function exportData() {
  return {
    app: 'despensa',
    version: 1,
    exportado: new Date().toISOString(),
    products: state.products,
    purchases: state.purchases,
    shopping: state.shopping,
    settings: Object.entries(state.settings).map(([key, value]) => ({ key, value }))
  };
}

export async function importData(payload, { replace = true } = {}) {
  if (!payload || typeof payload !== 'object') throw new Error('Archivo inválido');
  const products = Array.isArray(payload.products) ? payload.products : [];
  const purchases = Array.isArray(payload.purchases) ? payload.purchases : [];
  const shopping = Array.isArray(payload.shopping) ? payload.shopping : [];
  const settings = Array.isArray(payload.settings) ? payload.settings : [];
  if (!products.length && !purchases.length) throw new Error('El archivo no contiene datos de Despensa');

  if (replace) {
    await Promise.all([db.clear('products'), db.clear('purchases'), db.clear('shopping'), db.clear('settings')]);
  }
  await Promise.all([
    db.bulkPut('products', products.map((p) => newProduct(p))),
    db.bulkPut('purchases', purchases),
    db.bulkPut('shopping', shopping),
    db.bulkPut('settings', settings)
  ]);
  await loadAll();
  await syncShopping();
  emit();
  return { products: products.length, purchases: purchases.length };
}

export async function wipeAll() {
  await Promise.all([db.clear('products'), db.clear('purchases'), db.clear('shopping')]);
  state.products = []; state.purchases = []; state.shopping = [];
  emit();
}

export const stats = () => {
  const total = state.products.length;
  const low = state.products.filter((p) => status(p) === 'yellow').length;
  const out = state.products.filter((p) => status(p) === 'red').length;
  return { total, low, out, ok: total - low - out, pending: state.shopping.filter((s) => !s.comprado).length };
};

export const defaultDate = todayISO;
