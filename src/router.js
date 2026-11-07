// Rute la radacina domeniului: /acasa, /evenimente, /platforma/galerie, /echipa/<uuid>.

export const VIEWS = ['acasa', 'evenimente', 'editii', 'galerie', 'resurse', 'contact', 'platforma', 'login', 'inscriere', 'admin']

// Navbarul platformei. noutati sta pe /platforma, ca sa ramana endpointul existent.
export const PLATFORM_ITEMS = [
  { label: 'noutati', href: '/platforma', section: 'noutati' },
  { label: 'galerie', href: '/platforma/galerie', section: 'galerie' },
  { label: 'echipa mea', href: '/platforma/echipa', section: 'echipa' },
]

const PLATFORM_SECTIONS = new Set(PLATFORM_ITEMS.map((item) => item.section))
const PROFILE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function segments(pathname) {
  return String(pathname || '/').split('/').filter(Boolean)
}

function platformCanonical(section) {
  const known = section && PLATFORM_SECTIONS.has(section) ? section : 'noutati'
  return known === 'noutati' ? '/platforma' : `/platforma/${known}`
}

// -> { view, section, profileId?, canonical }; canonical e URL-ul normalizat
export function parseRoute(pathname) {
  const segs = segments(pathname)
  if (segs[0] === 'echipa' && segs.length === 2 && PROFILE_ID.test(segs[1])) {
    return {
      view: 'echipa',
      section: null,
      profileId: segs[1],
      canonical: `/echipa/${segs[1]}`,
    }
  }
  if (segs[0] === 'platforma' && segs.length <= 2) {
    const section = segs[1] && PLATFORM_SECTIONS.has(segs[1]) ? segs[1] : 'noutati'
    return { view: 'platforma', section, canonical: platformCanonical(section) }
  }
  if (segs.length === 1 && VIEWS.includes(segs[0])) {
    return { view: segs[0], section: null, canonical: `/${segs[0]}` }
  }
  return { view: 'acasa', section: null, canonical: '/acasa' }
}

export function profilePath(id) {
  return `/echipa/${id}`
}

export function canonicalFor(view, section) {
  if (view === 'platforma') return platformCanonical(section)
  if (VIEWS.includes(view)) return `/${view}`
  return '/acasa'
}
