#!/usr/bin/env bash
# Descarga el motor OCR a vendor/tesseract/ para que la app funcione
# sin depender de ningún CDN externo. Opcional: si esta carpeta no existe,
# la app carga Tesseract.js desde jsDelivr y lo guarda en caché.
#
# Uso:  bash tools/vendor-ocr.sh

set -euo pipefail
cd "$(dirname "$0")/.."

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "Descargando tesseract.js…"
npm --prefix "$TMP" install --silent --no-audit --no-fund \
  tesseract.js@5.1.1 @tesseract.js-data/spa@1.0.0 2>/dev/null \
  || npm --prefix "$TMP" install --silent --no-audit --no-fund tesseract.js@5.1.1 @tesseract.js-data/spa

mkdir -p vendor/tesseract/lang
cp "$TMP"/node_modules/tesseract.js/dist/tesseract.min.js vendor/tesseract/
cp "$TMP"/node_modules/tesseract.js/dist/worker.min.js vendor/tesseract/
cp "$TMP"/node_modules/tesseract.js-core/*.js "$TMP"/node_modules/tesseract.js-core/*.wasm vendor/tesseract/
cp "$TMP"/node_modules/@tesseract.js-data/spa/4.0.0/spa.traineddata.gz vendor/tesseract/lang/

echo "Listo. Motor OCR disponible en vendor/tesseract/ ($(du -sh vendor/tesseract | cut -f1))."
echo "Quita vendor/ del .gitignore si quieres desplegarlo con la app."
