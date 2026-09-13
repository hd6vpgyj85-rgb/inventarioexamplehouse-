const CDN = 'https://cdn.jsdelivr.net/npm';
const LOCAL = 'vendor/tesseract';

const REMOTE = {
  script: `${CDN}/tesseract.js@5.1.1/dist/tesseract.min.js`,
  workerPath: `${CDN}/tesseract.js@5.1.1/dist/worker.min.js`,
  corePath: `${CDN}/tesseract.js-core@5.1.0`,
  langPath: `${CDN}/@tesseract.js-data/spa@4.0.0/4.0.0`
};

const VENDORED = {
  script: `${LOCAL}/tesseract.min.js`,
  workerPath: `${LOCAL}/worker.min.js`,
  corePath: LOCAL,
  langPath: `${LOCAL}/lang`
};

let engine = null;
let loading = null;

function injectScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => (window.Tesseract ? resolve(window.Tesseract) : reject(new Error('sin Tesseract')));
    s.onerror = () => reject(new Error('no se pudo cargar ' + src));
    document.head.appendChild(s);
  });
}

async function loadEngine() {
  if (engine) return engine;
  if (loading) return loading;
  loading = (async () => {
    if (window.Tesseract) {
      engine = { lib: window.Tesseract, paths: REMOTE };
      return engine;
    }
    try {
      const lib = await injectScript(VENDORED.script);
      engine = { lib, paths: VENDORED };
    } catch {
      try {
        const lib = await injectScript(REMOTE.script);
        engine = { lib, paths: REMOTE };
      } catch {
        loading = null;
        throw new Error('No se pudo cargar el motor OCR. Conéctate a internet una vez para descargarlo.');
      }
    }
    return engine;
  })();
  return loading;
}

export async function preprocess(file, maxSide = 1600) {
  const bitmap = await createImageBitmap(file).catch(async () => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
    URL.revokeObjectURL(url);
    return img;
  });

  const w = bitmap.width || bitmap.naturalWidth;
  const h = bitmap.height || bitmap.naturalHeight;
  const scale = Math.min(1, maxSide / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  let sum = 0;
  for (let i = 0; i < d.length; i += 4) {
    const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    d[i] = d[i + 1] = d[i + 2] = g;
    sum += g;
  }
  const mean = sum / (d.length / 4);
  const contrast = 1.45;
  for (let i = 0; i < d.length; i += 4) {
    const v = Math.max(0, Math.min(255, (d[i] - mean) * contrast + mean * 0.95 + 12));
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

export async function recognize(file, onProgress) {
  const { lib, paths } = await loadEngine();
  onProgress?.({ status: 'Preparando imagen', progress: 0.05 });
  const canvas = await preprocess(file);
  onProgress?.({ status: 'Leyendo recibo', progress: 0.1 });

  const worker = await lib.createWorker('spa', 1, {
    workerPath: paths.workerPath,
    corePath: paths.corePath,
    langPath: paths.langPath,
    gzip: true,
    logger: (m) => {
      if (m.status === 'recognizing text') onProgress?.({ status: 'Leyendo recibo', progress: 0.15 + m.progress * 0.8 });
      else if (m.status && /load|download|initial/i.test(m.status)) onProgress?.({ status: 'Preparando motor OCR', progress: 0.1 });
    },
    errorHandler: () => {}
  });

  try {
    await worker.setParameters({ tessedit_pageseg_mode: '6', preserve_interword_spaces: '1' });
    const { data } = await worker.recognize(canvas);
    onProgress?.({ status: 'Listo', progress: 1 });
    return data.text || '';
  } finally {
    await worker.terminate().catch(() => {});
  }
}

