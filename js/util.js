export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9));

export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const money = (n) => {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—';
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 }).format(Number(n));
};

export const num = (n) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return '0';
  return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/\.?0+$/, '');
};

export const todayISO = () => new Date().toISOString().slice(0, 10);

export const fmtDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso.length <= 10 ? iso + 'T12:00:00' : iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
};

export const fmtDateShort = (iso) => {
  if (!iso) return '';
  const d = new Date(iso.length <= 10 ? iso + 'T12:00:00' : iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' }).format(d);
};

export const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
};

export const status = (p) => {
  const q = Number(p.cantidad) || 0;
  const min = Number(p.cantidadMinima) || 0;
  if (q <= 0) return 'red';
  if (q <= min) return 'yellow';
  return 'green';
};

export const statusLabel = (s) => ({ green: 'Disponible', yellow: 'Poco', red: 'Agotado' }[s]);

export const debounce = (fn, ms = 220) => {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
};

export const normalize = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

export const haptic = (ms = 8) => { try { navigator.vibrate?.(ms); } catch { /* no-op */ } };

export const UNITS = ['pza', 'kg', 'g', 'L', 'ml', 'paq', 'caja', 'bolsa', 'lata', 'botella'];

export const CATEGORIES = ['Despensa', 'Lácteos', 'Carnes', 'Frutas y verduras', 'Bebidas', 'Limpieza', 'Higiene', 'Congelados', 'Mascotas', 'Otros'];

export const svg = {
  chevron: '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  minus: '<svg viewBox="0 0 24 24"><path d="M5 12h14"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M4 12.5l5 5L20 6.5"/></svg>',
  search: '<svg viewBox="0 0 24 24" class="icon"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-3.6-3.6"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M5 7h14M10 7V5h4v2M6.5 7l.8 12a1 1 0 001 .9h7.4a1 1 0 001-.9l.8-12"/></svg>',
  box: '<svg viewBox="0 0 24 24"><path d="M4 8l8-4 8 4v8l-8 4-8-4z"/><path d="M4 8l8 4 8-4M12 12v8"/></svg>',
  cart: '<svg viewBox="0 0 24 24"><path d="M5 7h14l-1.2 11.1a1 1 0 01-1 .9H7.2a1 1 0 01-1-.9zM9 7V5.5a3 3 0 016 0V7"/></svg>',
  camera: '<svg viewBox="0 0 24 24"><path d="M4 8.5h3l1.5-2h7L17 8.5h3a1 1 0 011 1v8a1 1 0 01-1 1H4a1 1 0 01-1-1v-8a1 1 0 011-1z"/><circle cx="12" cy="13.5" r="3.2"/></svg>',
  clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
  alert: '<svg viewBox="0 0 24 24"><path d="M12 8.5v4.5M12 16.2v.3"/><path d="M10.3 4.6L3 17.5a1.4 1.4 0 001.2 2.1h15.6a1.4 1.4 0 001.2-2.1L13.7 4.6a1.9 1.9 0 00-3.4 0z"/></svg>',
  image: '<svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M4 17l4.5-4.5 3 3 3-3L20 17"/></svg>',
  doc: '<svg viewBox="0 0 24 24"><path d="M7 3.5h7l4 4v13H7z"/><path d="M14 3.5v4h4"/></svg>',
  gear: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 14a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-2.7 1.1 2 2 0 11-4 0 1.6 1.6 0 00-2.7-1.1l-.1.1a2 2 0 11-2.8-2.8l.1-.1A1.6 1.6 0 004 14a2 2 0 110-4 1.6 1.6 0 001.1-2.7l-.1-.1a2 2 0 112.8-2.8l.1.1A1.6 1.6 0 0010.6 4a2 2 0 114 0 1.6 1.6 0 002.7 1.1l.1-.1a2 2 0 112.8 2.8l-.1.1A1.6 1.6 0 0020 10a2 2 0 110 4z"/></svg>'
};
