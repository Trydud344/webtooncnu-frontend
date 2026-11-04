// Verificare rulabila a routerului: node scripts/check-routing.mjs
import assert from 'node:assert/strict'
import { parseRoute, canonicalFor, profilePath } from '../src/router.js'

const eq = (actual, expected, msg) => assert.deepEqual(actual, expected, msg)

// Subpath Pages
eq(parseRoute('/webtooncnu-frontend/'), { view: 'acasa', section: null, canonical: '/webtooncnu-frontend/acasa' }, 'root Pages -> acasa')
eq(parseRoute('/webtooncnu-frontend/acasa'), { view: 'acasa', section: null, canonical: '/webtooncnu-frontend/acasa' }, 'acasa stabil')
eq(parseRoute('/webtooncnu-frontend/evenimente'), { view: 'evenimente', section: null, canonical: '/webtooncnu-frontend/evenimente' }, 'evenimente')
eq(parseRoute('/webtooncnu-frontend/evenimente/'), { view: 'evenimente', section: null, canonical: '/webtooncnu-frontend/evenimente' }, 'trailing slash normalizat')
eq(parseRoute('/webtooncnu-frontend/bogus'), { view: 'acasa', section: null, canonical: '/webtooncnu-frontend/acasa' }, 'necunoscut -> acasa, prefix pastrat')

// Dev (radacina domeniului)
eq(parseRoute('/'), { view: 'acasa', section: null, canonical: '/acasa' }, 'root dev -> acasa')
eq(parseRoute('/evenimente'), { view: 'evenimente', section: null, canonical: '/evenimente' }, 'evenimente dev')

// Navigare: prefixul curent se pastreaza
eq(canonicalFor('evenimente', '/webtooncnu-frontend/acasa'), '/webtooncnu-frontend/evenimente', 'click pastreaza prefixul')
eq(canonicalFor('login', '/webtooncnu-frontend/'), '/webtooncnu-frontend/login', 'login sub prefix')
eq(canonicalFor('acasa', '/evenimente'), '/acasa', 'dev')

const profileId = '11111111-1111-4111-8111-111111111111'
eq(parseRoute(`/webtooncnu-frontend/echipa/${profileId}`), {
  view: 'echipa',
  section: null,
  profileId,
  canonical: `/webtooncnu-frontend/echipa/${profileId}`,
}, 'profil public sub prefix')
eq(parseRoute(`/echipa/${profileId}/`), {
  view: 'echipa',
  section: null,
  profileId,
  canonical: `/echipa/${profileId}`,
}, 'profil public dev, fara trailing slash')
eq(parseRoute('/webtooncnu-frontend/platforma/echipa'), {
  view: 'platforma',
  section: 'echipa',
  canonical: '/webtooncnu-frontend/platforma/echipa',
}, 'echipa mea ramane in platforma')
eq(canonicalFor('evenimente', `/webtooncnu-frontend/echipa/${profileId}`), '/webtooncnu-frontend/evenimente', 'plecare de pe profil pastreaza prefixul')
eq(profilePath(profileId, '/webtooncnu-frontend/platforma/noutati'), `/webtooncnu-frontend/echipa/${profileId}`, 'echipa mea foloseste linkul public')
eq(profilePath(profileId, '/platforma'), `/echipa/${profileId}`, 'echipa mea in dev')

console.log('routing checks ok')
