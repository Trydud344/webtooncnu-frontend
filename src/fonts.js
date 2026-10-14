// Font catalog shared by the properties panel and the canvas.
export const FONT_OPTIONS = [
  { value: 'default', label: 'Default', stack: undefined, weights: [], styles: [] },
  { value: 'Inter', label: 'Inter', stack: "'Inter', system-ui, sans-serif", weights: [400, 700], styles: ['normal', 'italic'] },
  { value: 'Playfair Display', label: 'Playfair Display', stack: "'Playfair Display', Georgia, serif", weights: [400, 700], styles: ['normal', 'italic'] },
  { value: 'Space Mono', label: 'Space Mono', stack: "'Space Mono', ui-monospace, monospace", weights: [400, 700], styles: ['normal', 'italic'] },
  { value: 'Caveat', label: 'Caveat', stack: "'Caveat', cursive", weights: [400, 700], styles: ['normal'] },
  { value: 'Silkscreen', label: 'Silkscreen', stack: "'Silkscreen', monospace", weights: [400, 700], styles: ['normal'] },
]

export const FONT_CATEGORY_FALLBACK = {
  'sans-serif': 'sans-serif',
  serif: 'serif',
  display: 'sans-serif',
  handwriting: 'cursive',
  monospace: 'monospace',
}

const POPULAR_FONTS = [
  'Inter', 'Roboto', 'Open Sans', 'Montserrat', 'Poppins', 'Playfair Display',
  'DM Sans', 'Nunito', 'Lato', 'Oswald', 'Raleway', 'Ubuntu', 'Merriweather',
  'Bebas Neue', 'Caveat', 'Space Mono', 'JetBrains Mono', 'Fira Sans', 'Lora', 'PT Sans',
]

let catalogCache = null
let catalogPromise = null

// The catalog loads once per session, so a reopened picker seeds its state from
// the cache instead of showing the loading state again.
export function cachedFontCatalog() {
  return catalogCache
}

export function loadFontCatalog() {
  if (catalogCache) return Promise.resolve(catalogCache)
  if (!catalogPromise) {
    catalogPromise = fetch('https://api.fontsource.org/v1/fonts')
      .then((response) => {
        if (!response.ok) throw new Error('Font list failed')
        return response.json()
      })
      .then((fonts) => {
        const popularRank = new Map(POPULAR_FONTS.map((family, index) => [family, index]))
        catalogCache = fonts
          .filter((font) => font.type !== 'icons' && font.category !== 'icons')
          .map((font) => ({
            family: font.family,
            category: font.category,
            weights: font.weights,
            styles: font.styles,
          }))
          .sort((a, b) => (popularRank.get(a.family) ?? Infinity) - (popularRank.get(b.family) ?? Infinity)
            || a.family.localeCompare(b.family))
        return catalogCache
      })
      .catch((error) => {
        catalogPromise = null
        throw error
      })
  }
  return catalogPromise
}

export function googleFamilyParam(family) {
  return family.split(' ').map(encodeURIComponent).join('+')
}

function fullFontUrl(entry) {
  const weights = entry?.weights?.length ? entry.weights : [400, 700]
  const base = weights.includes(400) ? 400 : weights[0]
  const picked = weights.includes(700) && 700 !== base ? [base, 700] : [base]
  const family = googleFamilyParam(entry?.family || 'Inter')
  if (entry?.styles?.includes('italic')) {
    return `https://fonts.googleapis.com/css2?family=${family}:ital,wght@${picked.map((weight) => `0,${weight};1,${weight}`).join(';')}&display=swap`
  }
  return `https://fonts.googleapis.com/css2?family=${family}:wght@${picked.join(';')}&display=swap`
}

const fullFontsLoaded = new Set()

// Loads the weights and italics a widget actually renders, once per family.
export function ensureFullFont(family) {
  if (!family || family === 'default' || fullFontsLoaded.has(family)) return
  fullFontsLoaded.add(family)
  const entry = (catalogCache || []).find((font) => font.family === family)
    || FONT_OPTIONS.find((option) => option.value === family)
    || { family, weights: [400, 700], styles: [] }
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = fullFontUrl(entry)
  document.head.appendChild(link)
}

export function fontStack(family) {
  if (!family || family === 'default') return undefined
  const preset = FONT_OPTIONS.find((option) => option.value === family)
  if (preset?.stack) return preset.stack
  const entry = (catalogCache || []).find((font) => font.family === family)
  return `'${family}', ${FONT_CATEGORY_FALLBACK[entry?.category] || 'sans-serif'}`
}
