import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { gsap } from 'gsap'
import { notifyProfile, readToken, subscribeAuth, writeToken } from '../session.js'

function inkFor(color) {
  if (!color || color.length < 7) return '#f4f0f0'
  const red = Number.parseInt(color.slice(1, 3), 16)
  const green = Number.parseInt(color.slice(3, 5), 16)
  const blue = Number.parseInt(color.slice(5, 7), 16)
  if ([red, green, blue].some((channel) => Number.isNaN(channel))) return '#f4f0f0'
  const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255
  return luminance > 0.62 ? '#1a1a1a' : '#f4f0f0'
}

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

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function fadeDuration() {
  return prefersReducedMotion() ? 0 : 0.4
}

function fillViewport(el) {
  gsap.set(el, {
    position: 'fixed',
    left: 0,
    top: 0,
    x: 0,
    y: 0,
    scaleX: 1,
    scaleY: 1,
    width: window.innerWidth,
    height: window.innerHeight,
    zIndex: 700,
    margin: 0,
  })
}

function fillSlot(el, slot) {
  const rect = slot.getBoundingClientRect()
  gsap.set(el, {
    position: 'fixed',
    left: rect.left,
    top: rect.top,
    x: 0,
    y: 0,
    scaleX: 1,
    scaleY: 1,
    width: rect.width,
    height: rect.height,
    zIndex: 2,
    margin: 0,
  })
}

export default function Echipa() {
  const [token, setToken] = useState(readToken)
  const [profile, setProfile] = useState(null)
  const [avatarUrl, setAvatarUrl] = useState('')
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [canvasUrl, setCanvasUrl] = useState('')
  const [file, setFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [open, setOpen] = useState(false)
  const [settled, setSettled] = useState(false)
  const [phase, setPhase] = useState('loading')
  const [frameReady, setFrameReady] = useState(false)
  const [introduced, setIntroduced] = useState(false)
  const slotRef = useRef(null)
  const frameRef = useRef(null)
  const closeRef = useRef(null)
  const tweenRef = useRef(null)
  const openRef = useRef(false)
  const revealRef = useRef(false)
  const loadedFrame = useRef('')

  useEffect(() => {
    const color = profile?.page_background || ''
    if (!color) return undefined
    const previousHtml = document.documentElement.style.backgroundColor
    const previousBody = document.body.style.backgroundColor
    document.documentElement.style.backgroundColor = color
    document.body.style.backgroundColor = color
    return () => {
      document.documentElement.style.backgroundColor = previousHtml
      document.body.style.backgroundColor = previousBody
    }
  }, [profile?.page_background])

  useEffect(() => {
    setToken(readToken())
    return subscribeAuth(() => setToken(readToken()))
  }, [])

  useEffect(() => {
    if (!token) return undefined
    let cancelled = false
    fetch('/api/me/profile', { headers: { authorization: `Bearer ${token}` } })
      .then(readJson)
      .then((data) => {
        if (cancelled) return
        setProfile(data)
        if (!data.has_avatar) setPhase('ready')
      })
      .catch((err) => {
        if (cancelled) return
        if (err.status === 401 || err.status === 403) writeToken('')
        setError(err.message)
        setPhase('ready')
      })
    return () => {
      cancelled = true
    }
  }, [token])

  useEffect(() => {
    if (!token || !profile?.has_avatar) {
      setAvatarUrl('')
      return undefined
    }
    let cancelled = false
    let objectUrl = ''
    fetch('/api/me/profile/avatar', { headers: { authorization: `Bearer ${token}` } })
      .then((response) => {
        if (!response.ok) throw new Error('Poza nu poate fi încărcată.')
        return response.blob()
      })
      .then((blob) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setAvatarUrl(objectUrl)
      })
      .catch(() => {
        if (!cancelled) setAvatarUrl('')
      })
      .finally(() => {
        if (!cancelled) setPhase('ready')
      })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [token, profile])

  useEffect(() => () => tweenRef.current?.kill(), [])

  useEffect(() => {
    const url = profile?.embed_url || ''
    if (!url) return undefined
    if (loadedFrame.current === url) {
      setFrameReady(true)
      return undefined
    }
    setFrameReady(false)
    const timer = window.setTimeout(() => setFrameReady(true), 12000)
    return () => window.clearTimeout(timer)
  }, [profile?.embed_url])

  useEffect(() => {
    if (phase !== 'loading' && (!profile?.embed_url || frameReady)) setIntroduced(true)
  }, [phase, profile?.embed_url, frameReady])

  useLayoutEffect(() => {
    const slot = slotRef.current
    const el = frameRef.current
    if (!slot || !el || open) return undefined
    const place = () => {
      if (openRef.current) return
      fillSlot(el, slot)
      if (!revealRef.current) gsap.set(el, { autoAlpha: 1 })
    }
    place()
    const observer = new ResizeObserver(place)
    observer.observe(slot)
    window.addEventListener('resize', place)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', place)
    }
  }, [open, editing, profile?.embed_url, phase])

  useLayoutEffect(() => {
    if (!settled || !closeRef.current) return undefined
    const tween = gsap.fromTo(closeRef.current, { autoAlpha: 0 }, {
      autoAlpha: 1,
      duration: prefersReducedMotion() ? 0 : 0.35,
      ease: 'power1.out',
    })
    return () => tween.kill()
  }, [settled])

  useEffect(() => {
    if (!open) return undefined
    const onKey = (event) => {
      if (event.key === 'Escape') closePreview()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const openPreview = () => {
    const el = frameRef.current
    if (!el || openRef.current) return
    openRef.current = true
    setOpen(true)
    tweenRef.current?.kill()
    tweenRef.current = gsap.to(el, {
      autoAlpha: 0,
      duration: fadeDuration(),
      ease: 'power1.inOut',
      overwrite: 'auto',
      onComplete: () => {
        fillViewport(el)
        tweenRef.current = gsap.to(el, {
          autoAlpha: 1,
          duration: fadeDuration(),
          ease: 'power1.inOut',
          overwrite: 'auto',
          onComplete: () => setSettled(true),
        })
      },
    })
  }

  const closePreview = () => {
    const el = frameRef.current
    const slot = slotRef.current
    if (!el || !slot || !openRef.current) return
    setSettled(false)
    tweenRef.current?.kill()
    tweenRef.current = gsap.to(el, {
      autoAlpha: 0,
      duration: fadeDuration(),
      ease: 'power1.inOut',
      overwrite: 'auto',
      onComplete: () => {
        fillSlot(el, slot)
        openRef.current = false
        revealRef.current = true
        setOpen(false)
        tweenRef.current = gsap.to(el, {
          autoAlpha: 1,
          duration: fadeDuration(),
          ease: 'power1.inOut',
          overwrite: 'auto',
          onComplete: () => {
            revealRef.current = false
          },
        })
      },
    })
  }

  const openEdit = () => {
    setName(profile?.title || '')
    setCanvasUrl(profile?.embed_url || '')
    setFile(null)
    setError('')
    setEditing(true)
  }

  const save = (event) => {
    event.preventDefault()
    const body = new FormData()
    body.append('title', name)
    body.append('canvas_url', canvasUrl)
    if (file) body.append('avatar', file)
    setSaving(true)
    setError('')
    fetch('/api/me/profile', {
      method: 'PUT',
      headers: { authorization: `Bearer ${token}` },
      body,
    })
      .then(readJson)
      .then((data) => {
        setProfile(data)
        setEditing(false)
        notifyProfile()
      })
      .catch((err) => setError(err.message))
      .finally(() => setSaving(false))
  }

  if (!token) {
    return (
      <main className="page">
        <section className="board">
          <p>Intră în contul echipei ca să vezi pagina.</p>
        </section>
      </main>
    )
  }

  const background = profile?.page_background || ''
  const displayName = profile?.title || 'Numele echipei vine aici'
  const showSkeleton = phase === 'loading' || (!introduced && Boolean(profile?.embed_url) && !frameReady)
  const markFrameReady = () => {
    loadedFrame.current = profile?.embed_url || ''
    setFrameReady(true)
  }

  return (
    <main
      className="team-page"
      aria-busy={showSkeleton || undefined}
      style={background ? { color: inkFor(background) } : undefined}
    >
      {showSkeleton ? <p className="team-loading-status">Se încarcă echipa.</p> : null}
      <div className="team-wrap" aria-hidden={showSkeleton || undefined}>
        <header className="team-head">
          {showSkeleton ? (
            <>
              <span className="skeleton skeleton-avatar" />
              <span className="skeleton skeleton-name" />
              <span className="skeleton skeleton-edit" />
            </>
          ) : (
            <>
              {avatarUrl ? (
                <img className="team-avatar" src={avatarUrl} alt="" />
              ) : (
                <span className="team-avatar" aria-hidden="true" />
              )}
              <h1 className="team-name">{displayName}</h1>
              <button type="button" className="team-edit" onClick={openEdit}>Editare Profil</button>
            </>
          )}
        </header>
        {showSkeleton || !error ? null : <p className="form-error">{error}</p>}
        {!showSkeleton && editing ? (
          <form className="form team-form" onSubmit={save}>
            <label className="field">
              <span>numele echipei</span>
              <input value={name} onChange={(event) => setName(event.target.value)} required />
            </label>
            <label className="field">
              <span>poză de profil</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => setFile(event.target.files?.[0] || null)}
              />
            </label>
            <label className="field">
              <span>link canvas</span>
              <input
                value={canvasUrl}
                onChange={(event) => setCanvasUrl(event.target.value)}
                placeholder="https://platforma.ivascu.xyz/e/..."
              />
            </label>
            <button type="submit" className="team-edit" disabled={saving}>
              {saving ? 'se salvează…' : 'salvează'}
            </button>
          </form>
        ) : null}
        {profile?.embed_url ? (
          <div className={frameReady ? 'team-frame-slot' : 'team-frame-slot skeleton'} ref={slotRef} />
        ) : showSkeleton ? (
          <div className="skeleton skeleton-frame" />
        ) : (
          <div className="team-frame" />
        )}
      </div>
      {profile?.embed_url
        ? createPortal(
          <>
            <div className="team-frame-shell" ref={frameRef}>
              <iframe
                className={frameReady ? 'team-frame' : 'team-frame is-pending'}
                src={profile.embed_url}
                title="Platforma"
                allow="encrypted-media"
                aria-hidden={frameReady ? undefined : true}
                onLoad={markFrameReady}
              />
              {open || showSkeleton || !frameReady ? null : (
                <button type="button" className="team-frame-open" onClick={openPreview} aria-label="Mărește canvasul" />
              )}
            </div>
            {settled ? (
              <button type="button" className="team-frame-close" ref={closeRef} onClick={closePreview}>închide</button>
            ) : null}
          </>,
          document.body,
        )
        : null}
    </main>
  )
}
