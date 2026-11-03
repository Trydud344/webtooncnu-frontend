export const TOKEN_KEY = 'wtc_token'

const AUTH_EVENT = 'wtc-auth'
export const PROFILE_EVENT = 'wtc-profile'

// localStorage, not sessionStorage: the same sign-in has to reach every
// open tab, including /acasa and /evenimente, which are often already open.
function storedToken() {
  return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || ''
}

const legacyToken = sessionStorage.getItem(TOKEN_KEY)
if (legacyToken && !localStorage.getItem(TOKEN_KEY)) {
  localStorage.setItem(TOKEN_KEY, legacyToken)
}
if (legacyToken) sessionStorage.removeItem(TOKEN_KEY)

export function readToken() {
  return storedToken()
}

export function writeToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
  sessionStorage.removeItem(TOKEN_KEY)
  window.dispatchEvent(new Event(AUTH_EVENT))
}

export function subscribeAuth(onChange) {
  const onStorage = (event) => {
    if (event.key === TOKEN_KEY) onChange()
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
