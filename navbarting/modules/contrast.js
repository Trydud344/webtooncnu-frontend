/**
 * navbarting / modules/contrast.js
 * Sampling de luminanta din spatele navbarului (imagini + culori de fundal).
 * E aceeasi logica integrata in nav-bar.js, expusa aici pentru refolosire.
 *
 * Folosire:
 *   import { isBackgroundBright, sampleLuminanceAtPoint } from './modules/contrast.js';
 *   const bright = isBackgroundBright(navBarElement);
 */

const IMAGE_SAMPLE_SIZE = 64;
const LUMINANCE_BRIGHT_THRESHOLD = 0.6;
const RGBA_RE = /rgba?\((\d+)\s*,?\s*(\d+)\s*,?\s*(\d+)(?:\s*,?\s*([\d.]+))?\)/;

const cache = new WeakMap();

export function relativeLuminance(r, g, b) {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function canvasFor(img) {
  if (cache.has(img)) return cache.get(img);
  const canvas = document.createElement('canvas');
  canvas.width = IMAGE_SAMPLE_SIZE;
  canvas.height = IMAGE_SAMPLE_SIZE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, IMAGE_SAMPLE_SIZE, IMAGE_SAMPLE_SIZE);
  const entry = { ctx, size: IMAGE_SAMPLE_SIZE };
  cache.set(img, entry);
  return entry;
}

function toImageCoords(img, x, y) {
  const rect = img.getBoundingClientRect();
  const fit = getComputedStyle(img).objectFit || 'fill';
  if (fit !== 'cover' || !img.naturalWidth) {
    return { nx: (x - rect.left) / rect.width, ny: (y - rect.top) / rect.height };
  }
  const elAsp = rect.width / rect.height;
  const imAsp = img.naturalWidth / img.naturalHeight;
  let rw, rh, ox, oy;
  if (imAsp > elAsp) { rh = rect.height; rw = rect.height * imAsp; ox = (rect.width - rw) / 2; oy = 0; }
  else { rw = rect.width; rh = rect.width / imAsp; ox = 0; oy = (rect.height - rh) / 2; }
  return { nx: (x - rect.left - ox) / rw, ny: (y - rect.top - oy) / rh };
}

export function sampleImageLuminance(img, x, y) {
  if (!img.complete || !img.naturalWidth) return null;
  const { nx, ny } = toImageCoords(img, x, y);
  const cx = Math.max(0, Math.min(1, nx));
  const cy = Math.max(0, Math.min(1, ny));
  try {
    const { ctx, size } = canvasFor(img);
    const d = ctx.getImageData(Math.round(cx * (size - 1)), Math.round(cy * (size - 1)), 1, 1).data;
    return relativeLuminance(d[0], d[1], d[2]);
  } catch {
    return null; // canvas tainted (CORS) sau altceva — nu crapa
  }
}

function parseRGBA(str) {
  const m = str.match(RGBA_RE);
  if (!m) return null;
  return { r: +m[1], g: +m[2], b: +m[3], a: m[4] ? +m[4] : 1 };
}

/**
 * Merge in jos prin elementele de la punctul (x, y) si returneaza
 * luminanta primei suprafete opace (imagine sau background-color).
 * Ignora chiar navbarul (selectorul dat) ca sa nu-si masoare propriul bg.
 */
export function sampleLuminanceAtPoint(x, y, ignoreSelector = 'nav-bar') {
  const els = document.elementsFromPoint(x, y);
  for (const el of els) {
    if (el.tagName === 'BODY' || el.tagName === 'HTML') continue;
    if (ignoreSelector && el.closest?.(ignoreSelector)) continue;
    if (el.tagName === 'IMG') {
      const lum = sampleImageLuminance(el, x, y);
      if (lum !== null) return lum;
      continue;
    }
    const rgba = parseRGBA(getComputedStyle(el).backgroundColor);
    if (rgba && rgba.a > 0.1) return relativeLuminance(rgba.r, rgba.g, rgba.b);
  }
  return null;
}

/**
 * True daca fundalul din spatele `barElement` e luminos (=> textul trebuie negru).
 * Ascunde temporar bara ca elementsFromPoint sa vada ce e dedesubt.
 */
export function isBackgroundBright(barElement, { samples = [0.15, 0.3, 0.5, 0.7, 0.85], threshold = LUMINANCE_BRIGHT_THRESHOLD } = {}) {
  const rect = barElement.getBoundingClientRect();
  const y = rect.top + rect.height / 2;
  const prev = barElement.style.visibility;
  barElement.style.visibility = 'hidden';
  let total = 0, count = 0;
  for (const ratio of samples) {
    const lum = sampleLuminanceAtPoint(rect.left + rect.width * ratio, y);
    if (lum !== null) { total += lum; count++; }
  }
  barElement.style.visibility = prev;
  if (!count) return false;
  return total / count > threshold;
}

/** Invalideaza cache-ul de canvas pentru o imagine (dupa load). */
export function bustImageCache(img) {
  cache.delete(img);
}
