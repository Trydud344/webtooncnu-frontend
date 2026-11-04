import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { gsap } from 'gsap'
import { notifyProfile, readToken, subscribeAuth, writeToken } from '../session.js'

const ADMIN_TOKEN_KEY = 'webtooncnu_admin_token'
const UNIT_LABELS = {
  scoala: 'Școală',
  club: 'Club',
  palat: 'Palat',
  centru_excelenta: 'Centru de Excelență',
}

function authHeaders(token) {
  return token ? { authorization: `Bearer ${token}` } : {}
}

function detailLine(label, value) {
  if (value === null || value === undefined || value === '') return null
  return (
    <p>
      <span>{label}</span> {value}
    </p>
  )
}

function AccountDossier({ account }) {
  const registration = account.registration || {}
  const members = registration.members || []
  const coordinators = registration.coordinators || []
  const section = [registration.section_label, registration.subsection_label].filter(Boolean).join(' · ')
  return (
    <section className="team-dossier">
      {detailLine('email', account.email)}
      {detailLine('nume', account.full_name)}
      {detailLine('instituție', account.institution)}
      {detailLine('secțiune', section)}
      {detailLine('școală', registration.primary_unit_name)}
      {detailLine('localitate', registration.primary_locality)}
      {detailLine('județ', registration.primary_county)}
      {detailLine('unitate', UNIT_LABELS[registration.unit_type] || registration.unit_type)}
      {detailLine('statut', registration.content_status)}
      {detailLine('GDPR', registration.gdpr_consent ? 'da' : 'nu')}
      {detailLine('parteneriat', registration.partnership_ack ? 'da' : 'nu')}
      {members.length ? <h2>membri</h2> : null}
      {members.map((member) => (
        <p key={member.id}>{[member.full_name, member.unit_name, member.school_class].filter(Boolean).join(' · ')}</p>
      ))}
      {coordinators.length ? <h2>coordonatori</h2> : null}
      {coordinators.map((coordinator) => (
        <p key={coordinator.id}>{[coordinator.full_name, coordinator.email, coordinator.phone].filter(Boolean).join(' · ')}</p>
      ))}
    </section>
  )
}

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

export default function Echipa({ profileId = '' }) {
  const shared = Boolean(profileId)
  const [token, setToken] = useState(readToken)
  const [access, setAccess] = useState(shared ? 'loading' : 'owner')
  const [visibilitySaving, setVisibilitySaving] = useState(false)
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
  const pageRef = useRef(null)

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
    if (shared) return undefined
    setToken(readToken())
    return subscribeAuth(() => setToken(readToken()))
  }, [shared])

  useEffect(() => {
    if (shared || !token) return undefined
    let cancelled = false
    fetch('/api/me/profile', { headers: authHeaders(token) })
      .then(readJson)
      .then((data) => {
        if (cancelled) return
        setProfile(data)
        if (!data.has_avatar) setPhase('ready')
      })
      .catch((err) => {
        if (cancelled) return
        if (err.status === 401) writeToken('')
        setError(err.message)
        setPhase('ready')
      })
    return () => {
      cancelled = true
    }
  }, [token, shared])

  useEffect(() => {
    if (!shared) return undefined
    let cancelled = false
    const teamToken = readToken()
    const adminToken = sessionStorage.getItem(ADMIN_TOKEN_KEY) || ''
    const attempts = []
    if (adminToken) attempts.push(adminToken)
    if (teamToken && teamToken !== adminToken) attempts.push(teamToken)
    attempts.push('')
    const load = async () => {
      for (const candidate of attempts) {
        try {
          const data = await readJson(
            await fetch(`/api/profiles/${profileId}`, { headers: authHeaders(candidate) }),
          )
          if (cancelled) return
          let view = data
          if (teamToken) {
            try {
              const mine = await readJson(
                await fetch('/api/me/profile', { headers: authHeaders(teamToken) }),
              )
              if (mine?.id === profileId) view = { ...data, ...mine }
            } catch {
              view = data
            }
          }
          if (cancelled) return
          setToken(view.id === profileId && teamToken ? teamToken : candidate)
          setProfile(view)
          setAccess('ok')
          if (!view.has_avatar) setPhase('ready')
          return
        } catch {
          // A missing profile answers like a private one.
        }
      }
      if (cancelled) return
      setProfile(null)
      setAccess('private')
      setPhase('ready')
    }
    load()
    return () => {
      cancelled = true
    }
  }, [shared, profileId])

  useEffect(() => {
    if (!profile?.has_avatar || (!shared && !token)) {
      setAvatarUrl('')
      return undefined
    }
    let cancelled = false
    let objectUrl = ''
    const avatarPath = shared ? `/api/profiles/${profileId}/avatar` : '/api/me/profile/avatar'
    fetch(avatarPath, { headers: authHeaders(token) })
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
  }, [token, profile, shared, profileId])

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
    const page = pageRef.current
    page?.addEventListener('scroll', place, { passive: true })
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', place)
      page?.removeEventListener('scroll', place)
    }
  }, [open, editing, profile?.embed_url, profile?.account, phase])

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

  const toggleVisibility = () => {
    if (!token || !profile || visibilitySaving) return
    setVisibilitySaving(true)
    setError('')
    fetch('/api/me/profile/visibility', {
      method: 'PATCH',
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      body: JSON.stringify({ public: !profile.public }),
    })
      .then(readJson)
      .then(setProfile)
      .catch((err) => setError(err.message))
      .finally(() => setVisibilitySaving(false))
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

  if (!shared && !token) {
    return (
      <main className="page">
        <section className="board">
          <p>Intră în contul echipei ca să vezi pagina.</p>
        </section>
      </main>
    )
  }

  if (shared && access === 'private') {
    return (
      <main className="page">
        <section className="board">
          <p>Această pagină este privată.</p>
        </section>
      </main>
    )
  }

  const mine = !shared || profile?.id === profileId

  const background = profile?.page_background || ''
  const displayName = profile?.title || 'Numele echipei vine aici'
  const showSkeleton = phase === 'loading' || (!introduced && Boolean(profile?.embed_url) && !frameReady)
  const markFrameReady = () => {
    loadedFrame.current = profile?.embed_url || ''
    setFrameReady(true)
  }

  return (
    <main
      ref={pageRef}
      className={['team-page', profile?.account ? 'has-account' : ''].filter(Boolean).join(' ')}
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
              {mine ? (
                <div className="team-actions">
                  <button type="button" className="team-edit" onClick={toggleVisibility} disabled={visibilitySaving}>
                    {profile?.public ? 'public' : 'privat'}
                  </button>
                  <button type="button" className="team-edit" onClick={openEdit}>Editare Profil</button>
                </div>
              ) : null}
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
        {profile?.account ? <AccountDossier account={profile.account} /> : null}
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
