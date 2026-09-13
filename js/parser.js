const STORES = [
  ['walmart', 'Walmart'], ['bodega aurrera', 'Bodega Aurrera'], ['aurrera', 'Bodega Aurrera'],
  ['soriana', 'Soriana'], ['chedraui', 'Chedraui'], ['la comer', 'La Comer'], ['fresko', 'Fresko'],
  ['city market', 'City Market'], ['costco', 'Costco'], ['sam', "Sam's Club"], ['heb', 'HEB'],
  ['oxxo', 'OXXO'], ['7 eleven', '7-Eleven'], ['superama', 'Superama'], ['mercado', 'Mercado'],
  ['calimax', 'Calimax'], ['smart', 'Smart & Final'], ['casa ley', 'Casa Ley'], ['ley', 'Casa Ley'],
  ['merco', 'Merco'], ['alsuper', 'Alsuper'], ['farmacia', 'Farmacia']
];

const NOISE = /^(sub\s*total|subtotal|total|iva|i\.v\.a|efectivo|cambio|tarjeta|credito|débito|debito|propina|gracias|caja|cajero|caj\b|folio|ticket|rfc|tel|telefono|teléfono|suc\b|sucursal|direccion|dirección|fecha|hora|art[ií]culos|piezas|no\.|num|factura|cliente|www|http|aut\b|terminal|referencia|importe|descuento|ahorro|puntos|monedero|visa|master|autorizacion|autorización|cp\b|s\.a\.|sa de cv|c\.p\.)/i;

const clean = (s) => s.replace(/\s+/g, ' ').trim();

const toNumber = (raw) => {
  if (!raw) return null;
  let s = String(raw).replace(/[^\d.,]/g, '');
  if (!s) return null;
  if (s.includes(',') && s.includes('.')) s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  else if (s.includes(',')) s = /,\d{2}$/.test(s) ? s.replace(',', '.') : s.replace(/,/g, '');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
};

function detectStore(text) {
  const lower = text.toLowerCase();
  for (const [needle, name] of STORES) if (lower.includes(needle)) return name;
  return '';
}

function detectDate(text) {
  const patterns = [
    /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/,
    /(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (!m) continue;
    let y, mo, d;
    if (m[1].length === 4) { [, y, mo, d] = m; }
    else { [, d, mo, y] = m; if (y.length === 2) y = '20' + y; }
    const date = new Date(Number(y), Number(mo) - 1, Number(d));
    if (!Number.isNaN(date.getTime()) && date.getFullYear() > 2015 && date.getFullYear() < 2100 && Number(mo) <= 12 && Number(d) <= 31) {
      return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }
  return null;
}

function detectTotal(text) {
  const lines = text.split('\n');
  let total = null;
  for (const line of lines) {
    if (!/total/i.test(line) || /sub\s*total/i.test(line)) continue;
    const m = line.match(/(\d+[.,]\d{2})\s*$/) || line.match(/(\d+[.,]\d{2})/);
    const v = toNumber(m?.[1]);
    if (v !== null) total = v;
  }
  return total;
}

function parseLine(raw) {
  let line = clean(raw);
  if (line.length < 3) return null;
  if (NOISE.test(line)) return null;
  if (!/[a-záéíóúñ]{3,}/i.test(line)) return null;

  let precio = null;
  const priceMatch = line.match(/(?:\$\s*)?(\d{1,5}(?:[.,]\d{3})*[.,]\d{2})\s*[A-Z]?\s*$/);
  if (priceMatch) {
    precio = toNumber(priceMatch[1]);
    line = clean(line.slice(0, priceMatch.index));
  }

  let cantidad = 1;
  const qtyPatterns = [
    /^(\d{1,3})\s*(?:x|X|pz|pzs|pza|pzas|u|und)\s+/,
    /^(\d{1,3})\s+(?=[a-záéíóúñ])/i,
    /\s(?:x|X)\s*(\d{1,3})\s*$/,
    /\s(\d{1,3})\s*(?:x|X)\s*(?:\$?\s*\d+[.,]\d{2})\s*$/
  ];
  for (const re of qtyPatterns) {
    const m = line.match(re);
    if (!m) continue;
    const v = parseInt(m[1], 10);
    if (v > 0 && v <= 99) {
      cantidad = v;
      line = clean(line.replace(re, ' '));
      break;
    }
  }

  const kgMatch = line.match(/(\d+[.,]\d{2,3})\s*(kg|g|lt|l|ml)\b/i);
  let unidad = 'pza';
  if (kgMatch) unidad = kgMatch[2].toLowerCase() === 'lt' ? 'L' : kgMatch[2].toLowerCase();

  line = line.replace(/^[\d\s*#.,:-]+/, '');
  line = line.replace(/\s*\$?\s*\d+[.,]\d{2}\s*$/, '');
  line = clean(line);

  if (line.length < 3) return null;
  if (!/[a-záéíóúñ]{3,}/i.test(line)) return null;
  if (precio !== null && precio > 20000) return null;

  const nombre = line.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  return { nombre, cantidad, precio, unidad };
}

export function parseReceipt(text) {
  const lines = String(text || '').split('\n');
  const tienda = detectStore(text);
  const raw = [];
  for (const line of lines) {
    const item = parseLine(line);
    if (item) raw.push(item);
  }

  const tiendaKey = tienda.toLowerCase().split(' ')[0];
  const firstPriced = raw.findIndex((i) => i.precio !== null);
  const items = raw.filter((it, idx) => {
    if (tiendaKey && it.nombre.toLowerCase().includes(tiendaKey)) return false;
    if (it.precio === null && firstPriced > -1 && idx < firstPriced) return false;
    return true;
  });

  const merged = [];
  for (const it of items) {
    it.nombre = it.nombre.replace(/\b(\d+(?:[.,]\d+)?)\s?(l|ml|kg|g|pz|pzs)\b/gi, (m, n, u) => n + (u.toLowerCase() === 'l' ? 'L' : u.toLowerCase()));
    const same = merged.find((m) => m.nombre.toLowerCase() === it.nombre.toLowerCase() && m.precio === it.precio);
    if (same) same.cantidad += it.cantidad;
    else merged.push(it);
  }

  return {
    tienda,
    fecha: detectDate(text),
    total: detectTotal(text),
    items: merged.slice(0, 60)
  };
}

export { toNumber };
