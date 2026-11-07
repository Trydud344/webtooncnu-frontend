import { useCallback, useRef } from 'react'

const SITEKEY = import.meta.env.VITE_TURNSTILE_SITEKEY || ''
const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

let scriptPromise = null

function whenReady() {
  return new Promise((resolve, reject) => {
    try {
      window.turnstile.ready(resolve)
    } catch {
      if (typeof window.turnstile.render === 'function') resolve()
      else reject(new Error('Verificarea nu poate fi încărcată.'))
    }
  })
}

function loadTurnstile() {
  if (window.turnstile) return whenReady()
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = SCRIPT
      script.async = false
      script.onload = () => {
        if (!window.turnstile) {
          scriptPromise = null
          reject(new Error('Verificarea nu poate fi încărcată.'))
          return
        }
        whenReady().then(resolve, reject)
      }
      script.onerror = () => {
        scriptPromise = null
        reject(new Error('Verificarea nu poate fi încărcată.'))
      }
      document.head.appendChild(script)
    })
  }
  return scriptPromise
}

function fail(message) {
  return Promise.reject(new Error(message))
}

export function useTurnstile(action) {
  const widgetId = useRef(null)
  const elementRef = useRef(null)
  const readyRef = useRef(null)
  const pending = useRef(null)
  const inflight = useRef(null)
  const generation = useRef(0)

  const clearPending = (error) => {
    const waiter = pending.current
    pending.current = null
    waiter?.reject(error)
  }

  const removeWidget = () => {
    if (widgetId.current != null && window.turnstile) {
      window.turnstile.remove(widgetId.current)
    }
    widgetId.current = null
  }

  const containerRef = useCallback((node) => {
    if (elementRef.current === node) return
    const gen = ++generation.current
    clearPending(new Error('Verificarea a fost întreruptă.'))
    removeWidget()
    elementRef.current = node
    readyRef.current = null
    if (!node || !SITEKEY) return
    const ready = loadTurnstile().then(() => {
      if (gen !== generation.current || elementRef.current !== node || !window.turnstile) return
      widgetId.current = window.turnstile.render(node, {
        sitekey: SITEKEY,
        action,
        theme: 'dark',
        appearance: 'interaction-only',
        execution: 'execute',
        callback: (token) => {
          const waiter = pending.current
          pending.current = null
          waiter?.resolve(token)
        },
        'error-callback': () => {
          clearPending(new Error('Verificarea nu a reușit. Încearcă din nou.'))
        },
        'timeout-callback': () => {
          clearPending(new Error('Verificarea a expirat. Încearcă din nou.'))
        },
      })
    })
    readyRef.current = ready
    ready.catch(() => {})
  }, [action])

  const reset = useCallback(() => {
    if (widgetId.current != null && window.turnstile) {
      window.turnstile.reset(widgetId.current)
    }
  }, [])

  const getToken = useCallback(() => {
    if (inflight.current) return inflight.current
    if (!SITEKEY) return fail('Verificarea nu este configurată.')
    const ready = readyRef.current
    if (!ready) return fail('Verificarea nu este gata. Încearcă din nou.')
    const request = ready.then(() => new Promise((resolve, reject) => {
      if (widgetId.current == null || !window.turnstile || elementRef.current == null) {
        reject(new Error('Verificarea nu este gata. Încearcă din nou.'))
        return
      }
      pending.current = { resolve, reject }
      window.turnstile.execute(widgetId.current)
    }))
    inflight.current = request.finally(() => {
      if (inflight.current === request) inflight.current = null
    })
    return inflight.current
  }, [])

  return { containerRef, getToken, reset }
}

export async function withTurnstile(check, run) {
  try {
    const token = await check.getToken()
    return await run(token)
  } finally {
    check.reset()
  }
}
