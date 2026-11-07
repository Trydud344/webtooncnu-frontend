import { useEffect, useRef, useState } from 'react'
import { readSignedIn, subscribeAuth, subscribeProfile, writeSignedIn } from './session.js'

async function readJson(response) {
  const text = await response.text()
  const data = text ? JSON.parse(text) : null
  if (!response.ok) {
    const error = new Error(data?.detail || 'Cererea nu a putut fi trimisă.')
    error.status = response.status
    throw error
  }
  return data
}

export default function AccountButton({ atTop, active, onLogin, onPlatform }) {
  const [signedIn, setSignedIn] = useState(readSignedIn)
  const [avatarUrl, setAvatarUrl] = useState('')
  const [open, setOpen] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const rootRef = useRef(null)

  useEffect(() => {
    setSignedIn(readSignedIn())
    return subscribeAuth(() => setSignedIn(readSignedIn()))
  }, [])

  useEffect(() => {
    if (!signedIn) {
      setAvatarUrl('')
      setOpen(false)
      return undefined
    }
    let cancelled = false
    let generation = 0
    let objectUrl = ''
    const show = (next) => {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
      objectUrl = next
      setAvatarUrl(next)
    }
    const load = () => {
      const current = ++generation
      fetch('/api/me/profile', { credentials: 'include' })
        .then(readJson)
        .then((profile) => {
          if (cancelled || current !== generation) return null
          if (!profile.has_avatar) return null
          return fetch('/api/me/profile/avatar', { credentials: 'include' })
        })
        .then((response) => {
          if (cancelled || current !== generation) return null
          if (!response) return null
          if (!response.ok) throw new Error('Poza nu poate fi încărcată.')
          return response.blob()
        })
        .then((blob) => {
          if (cancelled || current !== generation) return
          show(blob ? URL.createObjectURL(blob) : '')
        })
        .catch((err) => {
          if (cancelled || current !== generation) return
          if (err.status === 401) writeSignedIn(false)
          show('')
        })
    }
    load()
    const stop = subscribeProfile(load)
    return () => {
      cancelled = true
      generation += 1
      stop()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [signedIn])

  useEffect(() => {
    if (!atTop) setOpen(false)
  }, [atTop])

  useEffect(() => {
    if (!open) return undefined
    const onPointer = (event) => {
      if (rootRef.current?.contains(event.target)) return
      setOpen(false)
    }
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const logout = () => {
    setLeaving(true)
    fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
      .catch(() => {})
      .finally(() => {
        writeSignedIn(false)
        setLeaving(false)
        setOpen(false)
      })
  }

  return (
    <div className={atTop ? 'account-slot' : 'account-slot is-hidden'} ref={rootRef}>
      {signedIn ? (
        <>
          <button
            type="button"
            className="account-btn"
            aria-label="Cont"
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            {avatarUrl ? <img src={avatarUrl} alt="" /> : <span className="account-fallback" aria-hidden="true" />}
          </button>
          {open ? (
            <div className="account-menu" role="menu">
              {onPlatform ? (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpen(false)
                    onPlatform()
                  }}
                >
                  Platforma Concurs
                </button>
              ) : null}
              <button type="button" role="menuitem" onClick={logout} disabled={leaving}>
                Log out
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <button
          type="button"
          className={'login-btn' + (active ? ' is-active' : '')}
          onClick={onLogin}
        >
          <span>log in</span>
        </button>
      )}
    </div>
  )
}
