const STORES = [
  ['walmart', 'Walmart'], ['bodega aurrera', 'Bodega Aurrera'], ['aurrera', 'Bodega Aurrera'],
  ['soriana', 'Soriana'], ['chedraui', 'Chedraui'], ['la comer', 'La Comer'], ['fresko', 'Fresko'],
  ['city market', 'City Market'], ['costco', 'Costco'], ['sam', "Sam's Club"], ['heb', 'HEB'],
  ['oxxo', 'OXXO'], ['7 eleven', '7-Eleven'], ['superama', 'Superama'], ['mercado', 'Mercado'],
  ['calimax', 'Calimax'], ['smart', 'Smart & Final'], ['casa ley', 'Casa Ley'], ['ley', 'Casa Ley'],
  ['merco', 'Merco'], ['alsuper', 'Alsuper'], ['farmacia', 'Farmacia']
];

const NOISE = /^(sub\s*total|subtotal|total|iva|i\.v\.a|tax|efectivo|cambio|change\s*due|tarjeta|credito|débito|debito|debit\s*tend|eft\s*debit|propina|gracias|thank\s*you|caja|cajero|caj\b|folio|ticket|rfc|tel|telefono|teléfono|suc\b|sucursal|direccion|dirección|fecha|hora|art[ií]culos|items\s*sold|piezas|no\.|num|factura|cliente|www|http|aut\b|terminal|referencia|ref\s*#|network\s*id|appr\s*code|account\s*#|importe|descuento|ahorro|puntos|monedero|visa|master|autorizacion|autorización|cp\b|s\.a\.|sa de cv|c\.p\.|reduced to clear|^was\b|pay from|total purchase|change due|manager|store#|st#|op#|te#|tr#)/i;

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

// Líneas que solo aportan cantidad/precio a la línea de producto anterior
// (peso por kg/lb, o promociones tipo "6 AT 1 FOR 0.33").
const CONT_WEIGHT = /^(\d+(?:[.,]\d+)?)\s*(lb|kg|g|oz)\b.*@/i;
const CONT_MULTIBUY = /^(\d{1,3})\s+(?:at|for|por|x)\b/i;
const isContinuation = (line) => CONT_WEIGHT.test(line) || CONT_MULTIBUY.test(line);

const PRICE_RE = /(?:\$\s*)?(\d{1,5}(?:[.,]\d{3})*[.,]\d{2,3})\s*[A-Z]?\s*$/;

// Busca un precio al final de la línea. El OCR de tickets térmicos suele pegar
// el código de impuesto ("O", "T", "X"...) justo después del precio y leerlo
// como un dígito de más ("2.310", "3.341"); como en un ticket nunca hay
// fracciones de centavo, un tercer decimal siempre es ese código mal leído.
function matchPrice(line) {
  const m = line.match(PRICE_RE);
  if (!m) return null;
  let numStr = m[1];
  if (/[.,]\d{3}$/.test(numStr)) numStr = numStr.slice(0, -1);
  const value = toNumber(numStr);
  return value === null ? null : { value, index: m.index };
}

function extractPrice(line) {
  return matchPrice(line)?.value ?? null;
}

// Limpia restos que deja el OCR entre el nombre del producto y el precio:
// códigos de barras/SKU largos, una letra suelta de código de impuesto
// ("F"/"T"/"X"/"O") y puntuación sobrante (—, +, *, comillas...). Se repite
// hasta que ya no cambia porque suelen venir encimados.
function stripTrailingNoise(line) {
  let prev;
  do {
    prev = line;
    line = line.replace(/\b\d{6,}[A-Z]{0,3}\b/g, ' ');
    line = line.replace(/[”“"'’.,:*+\-—]+$/, '');
    line = line.replace(/\s+\b[A-Z]\b$/, '');
    line = clean(line);
  } while (line !== prev);
  return line;
}

function parseLine(raw) {
  let line = clean(raw);
  if (line.length < 3) return null;
  if (line.includes('%')) return null;
  if (NOISE.test(line)) return null;
  if (!/[a-záéíóúñ]{3,}/i.test(line)) return null;

  let precio = null;
  const priceMatch = matchPrice(line);
  if (priceMatch) {
    precio = priceMatch.value;
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
  line = stripTrailingNoise(line);

  if (line.length < 3) return null;
  if (!/[a-záéíóúñ]{3,}/i.test(line)) return null;
  if (precio !== null && precio > 20000) return null;

  const nombre = line.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  return { nombre, cantidad, precio, unidad };
}

export function parseReceipt(text) {
  const allLines = String(text || '').split('\n');
  const tienda = detectStore(text);

  // Todo lo que sigue al SUBTOTAL/TOTAL es pago/propina/folio: nunca productos.
  // Se prioriza "subtotal" porque el OCR de tickets térmicos pierde la palabra
  // "total" con más frecuencia (queda pegada a los dígitos del importe).
  const subtotalIdx = allLines.findIndex((l) => /sub\s*total/i.test(l));
  const totalIdx = allLines.findIndex((l) => /total/i.test(l) && !/sub\s*total/i.test(l));
  const cutoff = subtotalIdx > -1 ? subtotalIdx : totalIdx;
  const lines = cutoff > -1 ? allLines.slice(0, cutoff) : allLines;

  const raw = [];
  for (const line of lines) {
    const clean_ = clean(line);
    if (isContinuation(clean_) && raw.length && raw[raw.length - 1].precio === null) {
      const last = raw[raw.length - 1];
      const price = extractPrice(clean_);
      if (price !== null) last.precio = price;
      const multi = clean_.match(CONT_MULTIBUY);
      if (multi) {
        const v = parseInt(multi[1], 10);
        if (v > 0 && v <= 99) last.cantidad = v;
      }
      continue;
    }
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

  // Clave de comparación tolerante a ruido del OCR: solo letras, sin acentos ni
  // restos de código de barras, para agrupar líneas del mismo producto que el
  // OCR leyó con pequeñas variaciones (ej. "Ruck Sack —" vs "Ruck Sack +").
  const mergeKey = (nombre) => nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/g, '');

  const merged = [];
  for (const it of items) {
    it.nombre = it.nombre.replace(/\b(\d+(?:[.,]\d+)?)\s?(l|ml|kg|g|pz|pzs)\b/gi, (m, n, u) => n + (u.toLowerCase() === 'l' ? 'L' : u.toLowerCase()));
    const key = mergeKey(it.nombre);
    const same = merged.find((m) => {
      if (m.precio !== it.precio) return false;
      if (m.nombre.toLowerCase() === it.nombre.toLowerCase()) return true;
      const mkey = mergeKey(m.nombre);
      return key.length >= 4 && mkey.length >= 4 && (mkey === key || mkey.startsWith(key) || key.startsWith(mkey));
    });
    if (same) {
      same.cantidad += it.cantidad;
      if (it.nombre.length < same.nombre.length) same.nombre = it.nombre;
    } else merged.push(it);
  }

  return {
    tienda,
    fecha: detectDate(text),
    total: detectTotal(text),
    items: merged.slice(0, 60)
  };
}

export { toNumber };
