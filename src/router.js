// Routing minimal pentru hosting static (GitHub Pages): history API +
// 404.html fallback (vezi workflow-ul deploy-pages.yml). Toate rutele sunt
// un singur segment: /<prefix>/acasa, /<prefix>/evenimente, ...
// Prefixul (gol in dev, /webtooncnu-frontend pe Pages) se pastreaza automat,
// deci nu e hardcodat nicaieri.

export const VIEWS = ['acasa', 'evenimente', 'editii', 'galerie', 'resurse', 'contact', 'platforma', 'login', 'inscriere', 'admin']

// Navbarul platformei. noutati sta pe /platforma, ca sa ramana endpointul existent.
export const PLATFORM_ITEMS = [
  { label: 'noutati', href: '/platforma', section: 'noutati' },
  { label: 'galerie', href: '/platforma/galerie', section: 'galerie' },
  { label: 'echipa mea', href: '/platforma/echipa', section: 'echipa' },
]

const PLATFORM_SECTIONS = new Set(PLATFORM_ITEMS.map((item) => item.section))
const PROFILE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function teamProfileRoute(segs) {
  const at = segs.indexOf('echipa')
  if (at === -1) return null
  const id = segs[at + 1]
  if (!id || !PROFILE_ID.test(id) || segs.length !== at + 2) return null
  const prefix = segs.slice(0, at)
  return {
    view: 'echipa',
    section: null,
    profileId: id,
    canonical: '/' + [...prefix, 'echipa', id].join('/'),
  }
}

function splitPrefix(pathname) {
  const segs = pathname.split('/').filter(Boolean)
  const platformAt = segs.indexOf('platforma')
  if (platformAt !== -1) return { prefix: segs.slice(0, platformAt), last: 'platforma' }
  const teamAt = segs.indexOf('echipa')
  const teamId = segs[teamAt + 1]
  if (teamAt !== -1 && teamId && PROFILE_ID.test(teamId) && segs.length === teamAt + 2) {
    return { prefix: segs.slice(0, teamAt), last: 'echipa' }
  }
  const last = segs[segs.length - 1]
  if (last !== undefined && VIEWS.includes(last)) return { prefix: segs.slice(0, -1), last }
  // segment necunoscut sau radacina: prefixul se pastreaza la adancime 0-1,
  // altfel ultimul segment e considerat gunoi si se inlocuieste
  if (segs.length > 1) return { prefix: segs.slice(0, -1), last }
  return { prefix: segs, last }
}

function platformRoute(segs) {
  const at = segs.indexOf('platforma')
  const prefix = segs.slice(0, at)
  const section = segs[at + 1]
  const known = section && PLATFORM_SECTIONS.has(section) ? section : 'noutati'
  const tail = known === 'noutati' ? ['platforma'] : ['platforma', known]
  return {
    view: 'platforma',
    section: known,
    canonical: '/' + [...prefix, ...tail].join('/'),
  }
}

// -> { view, section, canonical }; canonical e URL-ul normalizat (fara trailing slash)
export function parseRoute(pathname) {
  const segs = pathname.split('/').filter(Boolean)
  const team = teamProfileRoute(segs)
  if (team) return team
  if (segs.includes('platforma')) return platformRoute(segs)
  const { prefix, last } = splitPrefix(pathname)
  if (last !== undefined && VIEWS.includes(last)) {
    return { view: last, section: null, canonical: '/' + [...prefix, last].join('/') }
  }
  return { view: 'acasa', section: null, canonical: '/' + [...prefix, 'acasa'].join('/') }
}

export function profilePath(id, pathname) {
  const { prefix } = splitPrefix(pathname || '/')
  return '/' + [...prefix, 'echipa', id].join('/')
}

export function canonicalFor(view, pathname, section) {
  const { prefix } = splitPrefix(pathname)
  if (view === 'platforma') {
    const known = section && PLATFORM_SECTIONS.has(section) ? section : 'noutati'
    const tail = known === 'noutati' ? ['platforma'] : ['platforma', known]
    return '/' + [...prefix, ...tail].join('/')
  }
  return '/' + [...prefix, view].join('/')
}
