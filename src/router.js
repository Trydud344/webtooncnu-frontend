// Routing minimal pentru hosting static (GitHub Pages): history API +
// 404.html fallback (vezi workflow-ul deploy-pages.yml). Toate rutele sunt
// un singur segment: /<prefix>/acasa, /<prefix>/evenimente, ...
// Prefixul (gol in dev, /webtooncnu-frontend pe Pages) se pastreaza automat,
// deci nu e hardcodat nicaieri.

export const VIEWS = ['acasa', 'evenimente', 'editii', 'galerie', 'resurse', 'contact', 'login']

function splitPrefix(pathname) {
  const segs = pathname.split('/').filter(Boolean)
  const last = segs[segs.length - 1]
  if (last !== undefined && VIEWS.includes(last)) return { prefix: segs.slice(0, -1), last }
  // segment necunoscut sau radacina: prefixul se pastreaza la adancime 0-1,
  // altfel ultimul segment e considerat gunoi si se inlocuieste
  if (segs.length > 1) return { prefix: segs.slice(0, -1), last }
  return { prefix: segs, last }
}

// -> { view, canonical }; canonical e URL-ul normalizat (fara trailing slash)
export function parseRoute(pathname) {
  const { prefix, last } = splitPrefix(pathname)
  if (last !== undefined && VIEWS.includes(last)) {
    return { view: last, canonical: '/' + [...prefix, last].join('/') }
  }
  return { view: 'acasa', canonical: '/' + [...prefix, 'acasa'].join('/') }
}

export function canonicalFor(view, pathname) {
  const { prefix } = splitPrefix(pathname)
  return '/' + [...prefix, view].join('/')
}
