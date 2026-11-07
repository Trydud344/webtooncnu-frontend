// Verificare rulabila a routerului: node scripts/check-routing.mjs
import assert from 'node:assert/strict'
import { parseRoute, canonicalFor, profilePath } from '../src/router.js'

const eq = (actual, expected, msg) => assert.deepEqual(actual, expected, msg)

eq(parseRoute('/'), { view: 'acasa', section: null, canonical: '/acasa' }, 'root -> acasa')
eq(parseRoute('/acasa'), { view: 'acasa', section: null, canonical: '/acasa' }, 'acasa stabil')
eq(parseRoute('/evenimente'), { view: 'evenimente', section: null, canonical: '/evenimente' }, 'evenimente')
eq(parseRoute('/evenimente/'), { view: 'evenimente', section: null, canonical: '/evenimente' }, 'trailing slash normalizat')
eq(parseRoute('/bogus'), { view: 'acasa', section: null, canonical: '/acasa' }, 'necunoscut -> acasa')
eq(parseRoute('/echipa'), { view: 'acasa', section: null, canonical: '/acasa' }, 'echipa fara id -> acasa')
eq(parseRoute('/echipa/acasa'), { view: 'acasa', section: null, canonical: '/acasa' }, 'prefix lipit nu e ruta')
eq(parseRoute('/echipa/evenimente'), { view: 'acasa', section: null, canonical: '/acasa' }, 'echipa/evenimente -> acasa')
eq(parseRoute('/webtooncnu-frontend/acasa'), { view: 'acasa', section: null, canonical: '/acasa' }, 'subpath vechi -> acasa')

eq(canonicalFor('evenimente'), '/evenimente', 'evenimente')
eq(canonicalFor('login'), '/login', 'login')
eq(canonicalFor('acasa'), '/acasa', 'acasa')
eq(canonicalFor('platforma', 'galerie'), '/platforma/galerie', 'galerie')
eq(canonicalFor('platforma', 'noutati'), '/platforma', 'noutati sta pe /platforma')
eq(canonicalFor('platforma'), '/platforma', 'platforma fara sectiune')

const profileId = '11111111-1111-4111-8111-111111111111'
eq(parseRoute(`/echipa/${profileId}`), {
  view: 'echipa',
  section: null,
  profileId,
  canonical: `/echipa/${profileId}`,
}, 'profil public')
eq(parseRoute(`/echipa/${profileId}/`), {
  view: 'echipa',
  section: null,
  profileId,
  canonical: `/echipa/${profileId}`,
}, 'profil public, fara trailing slash')
eq(parseRoute(`/echipa/${profileId}/extra`), { view: 'acasa', section: null, canonical: '/acasa' }, 'profil cu coada -> acasa')
eq(parseRoute('/platforma/echipa'), {
  view: 'platforma',
  section: 'echipa',
  canonical: '/platforma/echipa',
}, 'echipa mea ramane in platforma')
eq(parseRoute('/platforma/galerie'), {
  view: 'platforma',
  section: 'galerie',
  canonical: '/platforma/galerie',
}, 'galerie')
eq(parseRoute('/platforma/noutati'), {
  view: 'platforma',
  section: 'noutati',
  canonical: '/platforma',
}, 'noutati se normalizeaza')
eq(canonicalFor('evenimente'), '/evenimente', 'plecare de pe profil')
eq(profilePath(profileId), `/echipa/${profileId}`, 'link public de profil')

console.log('routing checks ok')
