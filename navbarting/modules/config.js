/**
 * navbarting / modules/config.js
 * Defaulturi + validatoare importabile separat.
 * Folosire:
 *   import { DEFAULTS, PRESETS, parseItems, validateItems } from './modules/config.js';
 */

export const DEFAULTS = {
  items: [
    { label: 'home', href: '/' },
    { label: 'camera roll', href: '/camera-roll' },
    { label: 'music', href: '/music' },
    { label: 'guestbook', href: '/guestbook' },
  ],
  routing: 'history', // 'history' | 'hash' | 'off'
  minimalOnScroll: true,
  contrast: true,
  magnetic: true,
  sticky: true,
  theme: null,
  scrollThreshold: 100,
  highlightWidth: 64,
  onNavigate: null,
};

/** Preseturi gata de folosit cu NavBar.configure() sau NavBar.create(). */
export const PRESETS = {
  minimal: { magnetic: false, contrast: false, minimalOnScroll: false },
  static: { minimalOnScroll: false, sticky: false },
  docs: {
    items: [
      { label: 'overview', href: '#overview' },
      { label: 'install', href: '#install' },
      { label: 'usage', href: '#usage' },
      { label: 'api', href: '#api' },
    ],
    routing: 'hash',
    minimalOnScroll: false,
  },
  portfolio: {
    items: [
      { label: 'home', href: '/' },
      { label: 'work', href: '/work' },
      { label: 'about', href: '/about' },
      { label: 'contact', href: '/contact' },
    ],
    routing: 'history',
  },
};

export function validateItems(items) {
  if (!Array.isArray(items)) throw new TypeError('[navbarting] items trebuie sa fie un array.');
  return items.map((it, i) => {
    if (typeof it === 'string') return { label: it, href: '#' };
    if (!it || typeof it.label !== 'string') {
      throw new TypeError(`[navbarting] items[${i}].label lipseste sau nu e string.`);
    }
    const href = typeof it.href === 'string' && it.href ? it.href : '#';
    if (/^\s*javascript:/i.test(href)) throw new Error(`[navbarting] items[${i}].href nesigur (javascript:).`);
    return { label: it.label, href, icon: it.icon, exact: it.exact };
  });
}

/**
 * Accepta: array | JSON string | CSV "home:/, music:/music" | null (defaulturi).
 */
export function parseItems(raw, fallback = DEFAULTS.items) {
  if (raw == null) return validateItems(fallback);
  if (Array.isArray(raw)) return validateItems(raw);
  if (typeof raw === 'string') {
    const s = raw.trim();
    if (!s) return validateItems(fallback);
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return validateItems(parsed);
    } catch { /* nu e JSON, incearca CSV */ }
    const csv = s.split(',').map((x) => x.trim()).filter(Boolean).map((x) => {
      const idx = x.indexOf(':');
      return idx === -1 ? { label: x, href: '#' } : { label: x.slice(0, idx).trim(), href: x.slice(idx + 1).trim() };
    });
    return validateItems(csv.length ? csv : fallback);
  }
  throw new TypeError('[navbarting] items: format nesuportat.');
}

export function mergeOptions(base = {}, over = {}) {
  return { ...DEFAULTS, ...base, ...over };
}
