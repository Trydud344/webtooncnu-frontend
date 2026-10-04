// Verificare rulabila a routerului: node scripts/check-routing.mjs
import assert from 'node:assert/strict'
import { parseRoute, canonicalFor } from '../src/router.js'

const eq = (actual, expected, msg) => assert.deepEqual(actual, expected, msg)

// Subpath Pages
eq(parseRoute('/webtooncnu-frontend/'), { view: 'acasa', canonical: '/webtooncnu-frontend/acasa' }, 'root Pages -> acasa')
eq(parseRoute('/webtooncnu-frontend/acasa'), { view: 'acasa', canonical: '/webtooncnu-frontend/acasa' }, 'acasa stabil')
eq(parseRoute('/webtooncnu-frontend/evenimente'), { view: 'evenimente', canonical: '/webtooncnu-frontend/evenimente' }, 'evenimente')
eq(parseRoute('/webtooncnu-frontend/evenimente/'), { view: 'evenimente', canonical: '/webtooncnu-frontend/evenimente' }, 'trailing slash normalizat')
eq(parseRoute('/webtooncnu-frontend/bogus'), { view: 'acasa', canonical: '/webtooncnu-frontend/acasa' }, 'necunoscut -> acasa, prefix pastrat')

// Dev (radacina domeniului)
eq(parseRoute('/'), { view: 'acasa', canonical: '/acasa' }, 'root dev -> acasa')
eq(parseRoute('/evenimente'), { view: 'evenimente', canonical: '/evenimente' }, 'evenimente dev')

// Navigare: prefixul curent se pastreaza
eq(canonicalFor('evenimente', '/webtooncnu-frontend/acasa'), '/webtooncnu-frontend/evenimente', 'click pastreaza prefixul')
eq(canonicalFor('login', '/webtooncnu-frontend/'), '/webtooncnu-frontend/login', 'login sub prefix')
eq(canonicalFor('acasa', '/evenimente'), '/acasa', 'dev')

console.log('routing checks ok')
