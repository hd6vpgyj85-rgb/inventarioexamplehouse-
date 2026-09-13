# Despensa — Inventario doméstico

PWA local-first para controlar el inventario del hogar. Escanea recibos con OCR en el dispositivo, actualiza cantidades automáticamente y arma la lista del mandado.

## Características

- **Inventario** con estado por color: verde disponible, amarillo poco, rojo agotado.
- **Escaneo de recibos** con OCR local (Tesseract.js). Extrae productos, cantidades, precios, tienda y fecha.
- **Revisión antes de confirmar**: corrige cualquier dato; si el producto ya existe se suman las cantidades.
- **Lista del mandado** generada automáticamente con lo agotado o bajo del mínimo.
- **Historial de compras** con detalle por ticket.
- **Exportar / importar** todo en JSON.
- **PWA instalable** y funcional sin conexión.

## Privacidad

Todo se guarda en IndexedDB dentro del dispositivo. Las fotos de los recibos se procesan localmente y nunca se suben a ningún servidor. Sin APIs de pago, sin backend, sin cuentas.

## Stack

JavaScript moderno (ES modules), CSS con variables, IndexedDB, Tesseract.js (CDN, cacheado por el service worker). Sin build step ni dependencias que instalar.

## Uso local

```bash
python3 -m http.server 8000
# abrir http://localhost:8000
```

Debe servirse por HTTP(S), no con `file://`, para que funcionen los módulos y el service worker.

## Despliegue en Cloudflare Pages

1. Conecta el repositorio en Cloudflare Pages.
2. Framework preset: **None**. Build command: vacío. Output directory: `/` (raíz).
3. Deploy.

Funciona igual en GitHub Pages, Netlify o cualquier hosting estático.

## Estructura

```
index.html              shell, tab bar, contenedores
css/styles.css          sistema visual (Apple Sheet UI)
js/app.js               router y arranque
js/db.js                wrapper de IndexedDB
js/store.js             estado y lógica de negocio
js/ui.js                bottom sheets, action sheets, toasts
js/components.js        filas de producto, steppers
js/parser.js            interpretación del texto del recibo
js/ocr.js               Tesseract.js + preprocesado de imagen
js/views/               inicio, inventario, mandado, más
js/sheets/              detalle/formulario de producto, escaneo y revisión
sw.js                   service worker (offline)
manifest.webmanifest    metadatos PWA
```

## Instalación en el teléfono

- **iPhone**: Safari → Compartir → Añadir a pantalla de inicio.
- **Android**: Chrome → menú → Instalar aplicación.

El motor OCR (~12 MB) se descarga la primera vez que escaneas un recibo y queda en caché para los siguientes.
