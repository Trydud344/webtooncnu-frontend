const AUTH_EVENT = 'wtc-auth'
export const PROFILE_EVENT = 'wtc-profile'
const FLAG = 'wtc_signed_in'
const LEGACY_TOKEN = 'wtc_token'
const LEGACY_ADMIN = 'webtooncnu_admin_token'

function purgeLegacy() {
  localStorage.removeItem(LEGACY_TOKEN)
  sessionStorage.removeItem(LEGACY_TOKEN)
  sessionStorage.removeItem(LEGACY_ADMIN)
}

purgeLegacy()

export function readSignedIn() {
  return localStorage.getItem(FLAG) === '1'
}

export function writeSignedIn(on) {
  purgeLegacy()
  const current = localStorage.getItem(FLAG) === '1'
  if (current === Boolean(on)) return
  if (on) localStorage.setItem(FLAG, '1')
  else localStorage.removeItem(FLAG)
  window.dispatchEvent(new Event(AUTH_EVENT))
}

export function subscribeAuth(onChange) {
  const onStorage = (event) => {
    if (event.key === FLAG) onChange()
  }
  window.addEventListener(AUTH_EVENT, onChange)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(AUTH_EVENT, onChange)
    window.removeEventListener('storage', onStorage)
  }
}

export function notifyProfile() {
  window.dispatchEvent(new Event(PROFILE_EVENT))
}

export function subscribeProfile(onChange) {
  window.addEventListener(PROFILE_EVENT, onChange)
  return () => window.removeEventListener(PROFILE_EVENT, onChange)
}
