import { useCallback, useEffect, useState } from 'react'
import { useTurnstile, withTurnstile } from '../turnstile.js'

function profileHref(id) {
  return `/echipa/${id}`
}

const NEXT = {
  draft: 'deschisa',
  deschisa: 'jurizare',
  jurizare: 'inchisa',
  inchisa: 'arhiva',
}

const NEXT_LABEL = {
  deschisa: 'deschide înscrierile',
  jurizare: 'închide înscrierile, treci la jurizare',
  inchisa: 'închide ediția',
  arhiva: 'arhivează ediția',
}

const PREV = {
  deschisa: 'draft',
  jurizare: 'deschisa',
  inchisa: 'jurizare',
  arhiva: 'inchisa',
}

const PREV_LABEL = {
  draft: 'înapoi la pregătire',
  deschisa: 'redeschide înscrierile',
  jurizare: 'înapoi la jurizare',
  inchisa: 'anulează arhivarea',
}

const STATUSES = ['draft', 'deschisa', 'jurizare', 'inchisa', 'arhiva']

const STATUS_LABEL = {
  draft: 'în pregătire',
  deschisa: 'deschisă',
  jurizare: 'în jurizare',
  inchisa: 'închisă',
  arhiva: 'arhivă',
}

const INVITE_LABEL = {
  active: 'activ',
  used: 'folosit',
  revoked: 'revocat',
  expired: 'expirat',
  invalidated: 'invalidat',
}

const CONTENT_LABEL = {
  draft: 'ciornă',
  trimis: 'trimis',
}

const SECTIONS = [
  { id: 'editie', label: 'ediție' },
  { id: 'echipe', label: 'echipe' },
  { id: 'juriu', label: 'juriu' },
  { id: 'anunturi', label: 'anunțuri' },
  { id: 'albume', label: 'albume' },
  { id: 'resurse', label: 'resurse' },
  { id: 'jurnal', label: 'jurnal' },
]

function readSection() {
  const id = window.location.hash.replace(/^#/, '')
  return SECTIONS.some((item) => item.id === id) ? id : 'editie'
}

function formatWhen(iso) {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('ro-RO', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Bucharest',
  }).format(date)
}

function editionLine(edition) {
  if (!edition) return 'Nu există o ediție curentă.'
  const bits = [edition.year_label, STATUS_LABEL[edition.status] || edition.status]
  if (edition.status === 'deschisa' && new Date(edition.registration_deadline) < new Date()) {
    bits.push('termenul de înscriere a trecut')
  }
  return bits.join(' · ')
}

function toLocalInput(iso) {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function toIso(value) {
  const date = new Date(value)
  if (!value || Number.isNaN(date.getTime())) throw new Error('Completează toate termenele.')
  return date.toISOString()
}

async function api(path, { method = 'GET', body } = {}) {
  const response = await fetch(path, {
    method,
    credentials: 'include',
    headers: {
      'x-session': 'admin',
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const text = await response.text()
  const data = text ? JSON.parse(text) : null
  if (!response.ok) {
    const error = new Error(data?.detail || response.statusText)
    error.status = response.status
    throw error
  }
  return data
}

export default function Admin() {
  const [token, setToken] = useState(false)
  const [checked, setChecked] = useState(false)
  const [ready, setReady] = useState(false)
  const [email, setEmail] = useState('presedinte@cnutoons.com')
  const [password, setPassword] = useState('')
  const loginCheck = useTurnstile('login')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [edition, setEdition] = useState(null)
  const [draft, setDraft] = useState(null)
  const [categories, setCategories] = useState([])
  const [invites, setInvites] = useState([])
  const [freshCodes, setFreshCodes] = useState([])
  const [inviteCount, setInviteCount] = useState(1)
  const [jury, setJury] = useState([])
  const [teams, setTeams] = useState([])
  const [alerts, setAlerts] = useState([])
  const [events, setEvents] = useState([])
  const [editions, setEditions] = useState([])
  const [albums, setAlbums] = useState([])
  const [albumTitle, setAlbumTitle] = useState('')
  const [albumHref, setAlbumHref] = useState('')
  const [slides, setSlides] = useState([])
  const [slideTitle, setSlideTitle] = useState('')
  const [slideHref, setSlideHref] = useState('')
  const [bulletins, setBulletins] = useState([])
  const [bulletinTitle, setBulletinTitle] = useState('')
  const [bulletinBody, setBulletinBody] = useState('')
  const [section, setSection] = useState(readSection)
  const [newEdition, setNewEdition] = useState({
    year_label: '',
    theme: '',
    registration_deadline: '',
    submission_deadline: '',
    judging_deadline: '',
    archived: true,
  })

  const load = useCallback(async (activeToken) => {
    const editionRequest = api('/api/admin/edition', { token: activeToken }).catch((err) => {
      if (err.status === 404) return null
      throw err
    })
    const [editionData, editionList, albumList, bulletinList, slideList, inviteData, juryData, teamData, alertData, auditData] = await Promise.all([
      editionRequest,
      api('/api/admin/editions', { token: activeToken }),
      api('/api/admin/albums', { token: activeToken }),
      api('/api/admin/bulletins', { token: activeToken }),
      api('/api/admin/slides', { token: activeToken }),
      api('/api/admin/invite-codes', { token: activeToken }),
      api('/api/admin/jury', { token: activeToken }),
      api('/api/admin/teams', { token: activeToken }),
      api('/api/admin/alerts', { token: activeToken }),
      api('/api/admin/audit', { token: activeToken }),
    ])
    setEdition(editionData)
    setDraft(editionData ? {
      theme: editionData.theme,
      registration_deadline: toLocalInput(editionData.registration_deadline),
      submission_deadline: toLocalInput(editionData.submission_deadline),
      judging_deadline: toLocalInput(editionData.judging_deadline),
    } : null)
    setCategories(editionData ? editionData.categories.map((item) => ({ ...item })) : [])
    setInvites(inviteData.codes)
    setJury(juryData.accounts)
    setTeams(teamData.teams)
    setAlerts(alertData.alerts)
    setEvents(auditData.events)
    setEditions(editionList.editions)
    setAlbums(albumList.albums)
    setBulletins(bulletinList.bulletins)
    setSlides(slideList.slides)
  }, [])

  useEffect(() => {
    let cancelled = false
    if (!token) {
      if (checked) return undefined
      api('/api/auth/me')
        .then((data) => {
          if (cancelled) return
          if (data.account.role === 'admin') setToken(true)
          else setChecked(true)
        })
        .catch((err) => {
          if (cancelled) return
          if (err.status !== 401 && err.status !== 403) setError(err.message)
          setChecked(true)
        })
      return () => {
        cancelled = true
      }
    }
    api('/api/auth/me')
      .then(async (data) => {
        if (cancelled) return
        if (data.account.role !== 'admin') {
          setToken(false)
          setChecked(true)
          setError('Contul nu este de președinte.')
          return
        }
        try {
          await load()
        } catch (err) {
          if (!cancelled) setError(err.message)
        }
      })
      .catch((err) => {
        if (cancelled) return
        if (err.status === 401 || err.status === 403) {
          setToken(false)
          setChecked(true)
        }
        setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [token, checked, load])

  const run = async (action) => {
    setError('')
    setNotice('')
    try {
      await action()
    } catch (err) {
      setError(err.message)
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
    }
  }

  const login = (event) => {
    event.preventDefault()
    run(async () => {
      const data = await withTurnstile(loginCheck, (turnstile_token) => api('/api/auth/login', {
        method: 'POST',
        body: { email, password, turnstile_token },
      }))
      if (data.account.role !== 'admin') {
        await fetch('/api/auth/logout', {
          method: 'POST',
          credentials: 'include',
          headers: { 'x-session': 'team' },
        }).catch(() => {})
        throw new Error('Contul nu este de președinte.')
      }
      setToken(true)
    })
  }

  const logout = () => {
    setToken(false)
    setChecked(true)
    setEdition(null)
    api('/api/auth/logout', { method: 'POST' }).catch(() => {})
  }

  useEffect(() => {
    const sync = () => {
      setSection(readSection())
      setNotice('')
      setError('')
    }
    window.addEventListener('popstate', sync)
    return () => window.removeEventListener('popstate', sync)
  }, [])

  const openSection = (id) => {
    if (id === section) return
    const nextHash = `#${id}`
    window.history.pushState(null, '', `${window.location.pathname}${window.location.search}${nextHash}`)
    setSection(id)
    setNotice('')
    setError('')
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
  }

  const onTabKey = (event, index) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight' && event.key !== 'Home' && event.key !== 'End') return
    event.preventDefault()
    const last = SECTIONS.length - 1
    const nextIndex = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? last
        : event.key === 'ArrowRight'
          ? (index + 1) % SECTIONS.length
          : (index - 1 + SECTIONS.length) % SECTIONS.length
    openSection(SECTIONS[nextIndex].id)
    document.getElementById(`admin-tab-${SECTIONS[nextIndex].id}`)?.focus()
  }

  if (!token && !checked) return null
  if (!token) {
    return (
      <main className="page admin-page">
        <header className="hero">
          <h1>admin</h1>
          <p className="lede">Contul de președinte.</p>
        </header>
        <form className="form" onSubmit={login}>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <label className="field">
            <span>email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
          </label>
          <label className="field">
            <span>parolă</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </label>
          <div className="turnstile-group">
            <div ref={loginCheck.containerRef} className="turnstile" />
          </div>
          <button type="submit" className="text-btn">intră</button>
        </form>
      </main>
    )
  }

  if (!ready) {
    return (
      <main className="page admin-page">
        <header className="hero">
          <h1>admin</h1>
          <p className="lede">Se încarcă contul…</p>
        </header>
      </main>
    )
  }

  const next = edition ? NEXT[edition.status] : null

  return (
    <main className="page admin-page">
      <header className="hero">
        <h1>admin</h1>
        <div className="admin-head">
          <p className="lede">{editionLine(edition)}</p>
          <button type="button" className="text-btn" onClick={logout}>ieși</button>
        </div>
        <nav className="admin-nav" role="tablist" aria-label="secțiuni">
          {SECTIONS.map((item, index) => (
            <button
              key={item.id}
              id={`admin-tab-${item.id}`}
              type="button"
              role="tab"
              className="text-btn"
              aria-selected={section === item.id}
              aria-controls="admin-panel"
              tabIndex={section === item.id ? 0 : -1}
              onClick={() => openSection(item.id)}
              onKeyDown={(event) => onTabKey(event, index)}
            >
              {item.label}
              {item.id === 'jurnal' && alerts.length > 0 ? <span className="admin-count">{alerts.length}</span> : null}
            </button>
          ))}
        </nav>
      </header>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {notice ? <p role="status">{notice}</p> : null}
      <div id="admin-panel" role="tabpanel" aria-labelledby={`admin-tab-${section}`}>

      {section === 'anunturi' ? (
      <section>
        <h2>anunțuri</h2>
        <p className="admin-note">
          Mesajele apar pe pagina platformei, la /platforma, în ordinea publicării, cele mai noi primele.
        </p>
        <form
          className="form"
          onSubmit={(event) => {
            event.preventDefault()
            run(async () => {
              await api('/api/admin/bulletins', {
                method: 'POST',
                token,
                body: { title: bulletinTitle, body: bulletinBody },
              })
              setBulletinTitle('')
              setBulletinBody('')
              setNotice('Anunțul a fost publicat.')
              await load(token)
            })
          }}
        >
          <label className="field">
            <span>titlu</span>
            <input value={bulletinTitle} onChange={(e) => setBulletinTitle(e.target.value)} placeholder="termen de trimitere" />
          </label>
          <label className="field">
            <span>mesaj</span>
            <textarea value={bulletinBody} onChange={(e) => setBulletinBody(e.target.value)} rows={5} placeholder="Textul anunțului." />
          </label>
          <button type="submit" className="text-btn">publică anunțul</button>
        </form>
        <div className="admin-scroll">
        <table className="admin-table">
          <thead>
            <tr><th scope="col">titlu</th><th scope="col">publicat</th><th scope="col"><span className="admin-sr">acțiuni</span></th></tr>
          </thead>
          <tbody>
            {bulletins.map((item) => (
              <tr key={item.id}>
                <td>{item.title}</td>
                <td>{formatWhen(item.created_at)}</td>
                <td>
                  <button
                    type="button"
                    className="text-btn"
                    onClick={() => run(async () => {
                      if (!window.confirm(`Ștergi anunțul ${item.title}?`)) return
                      await api(`/api/admin/bulletins/${item.id}`, { method: 'DELETE', token })
                      setNotice('Anunțul a fost șters.')
                      await load(token)
                    })}
                  >
                    șterge
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </section>
      ) : null}

      {section === 'albume' ? (
      <section>
        <h2>albume</h2>
        <p className="admin-note">
          Link public de Google Photos. Albumul apare pe pagina de evenimente, împreună cu cele deja existente.
        </p>
        <form
          className="form"
          onSubmit={(event) => {
            event.preventDefault()
            run(async () => {
              await api('/api/admin/albums', {
                method: 'POST',
                token,
                body: { title: albumTitle, href: albumHref },
              })
              setAlbumTitle('')
              setAlbumHref('')
              setNotice('Albumul a fost adăugat.')
              await load(token)
            })
          }}
        >
          <label className="field">
            <span>titlu</span>
            <input value={albumTitle} onChange={(e) => setAlbumTitle(e.target.value)} placeholder="2026 · conferința de deschidere" />
          </label>
          <label className="field">
            <span>link album</span>
            <input value={albumHref} onChange={(e) => setAlbumHref(e.target.value)} placeholder="https://photos.app.goo.gl/..." />
          </label>
          <button type="submit" className="text-btn">adaugă albumul</button>
        </form>
        <div className="admin-scroll">
        <table className="admin-table">
          <thead>
            <tr><th scope="col">titlu</th><th scope="col">fotografii</th><th scope="col"><span className="admin-sr">acțiuni</span></th></tr>
          </thead>
          <tbody>
            {albums.map((item) => (
              <tr key={item.id}>
                <td>{item.title}</td>
                <td>{item.photos.length}</td>
                <td>
                  <button
                    type="button"
                    className="text-btn"
                    onClick={() => run(async () => {
                      if (!window.confirm(`Ștergi albumul ${item.title}?`)) return
                      await api(`/api/admin/albums/${item.id}`, { method: 'DELETE', token })
                      setNotice('Albumul a fost șters.')
                      await load(token)
                    })}
                  >
                    șterge
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </section>
      ) : null}

      {section === 'resurse' ? (
      <section>
        <h2>resurse</h2>
        <p className="admin-note">
          Link de Google Slides sau fișier public Google Drive. Prezentarea apare pe /resurse, după materialele deja publicate.
        </p>
        <form
          className="form"
          onSubmit={(event) => {
            event.preventDefault()
            run(async () => {
              await api('/api/admin/slides', {
                method: 'POST',
                token,
                body: { title: slideTitle, href: slideHref },
              })
              setSlideTitle('')
              setSlideHref('')
              setNotice('Prezentarea a fost adăugată.')
              await load(token)
            })
          }}
        >
          <label className="field">
            <span>titlu</span>
            <input value={slideTitle} onChange={(e) => setSlideTitle(e.target.value)} placeholder="Cum desenezi un cadru" />
          </label>
          <label className="field">
            <span>link</span>
            <input value={slideHref} onChange={(e) => setSlideHref(e.target.value)} placeholder="https://docs.google.com/presentation/d/..." />
          </label>
          <button type="submit" className="text-btn">adaugă prezentarea</button>
        </form>
        <div className="admin-scroll">
        <table className="admin-table">
          <thead>
            <tr><th scope="col">titlu</th><th scope="col">adăugată</th><th scope="col"><span className="admin-sr">acțiuni</span></th></tr>
          </thead>
          <tbody>
            {slides.map((item) => (
              <tr key={item.id}>
                <td>{item.title}</td>
                <td>{formatWhen(item.created_at)}</td>
                <td>
                  <button
                    type="button"
                    className="text-btn"
                    onClick={() => run(async () => {
                      if (!window.confirm(`Ștergi prezentarea ${item.title}?`)) return
                      await api(`/api/admin/slides/${item.id}`, { method: 'DELETE', token })
                      setNotice('Prezentarea a fost ștearsă.')
                      await load(token)
                    })}
                  >
                    șterge
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </section>
      ) : null}

      {section === 'editie' ? <>
      {edition && draft ? <>
      <section>
        <h2>ediția curentă</h2>
        <ol className="admin-steps">
          {STATUSES.map((status) => (
            <li key={status} aria-current={edition.status === status ? 'step' : undefined}>
              {STATUS_LABEL[status]}
            </li>
          ))}
        </ol>
        <p className="admin-note">Înscrierile merg doar când ediția este deschisă și termenul nu a trecut. Câte un pas înainte sau înapoi.</p>
        <div className="admin-actions">
          {PREV[edition.status] ? (
            <button
              type="button"
              className="text-btn"
              onClick={() => run(async () => {
                const data = await api('/api/admin/edition/transition', {
                  method: 'POST',
                  token,
                  body: { status: PREV[edition.status], edition_id: edition.id },
                })
                setNotice(`Statut: ${STATUS_LABEL[data.status] || data.status}`)
                await load(token)
              })}
            >
              {PREV_LABEL[PREV[edition.status]]}
            </button>
          ) : null}
          {next ? (
            <button
              type="button"
              className="text-btn"
              onClick={() => run(async () => {
                const data = await api('/api/admin/edition/transition', {
                  method: 'POST',
                  token,
                  body: { status: next },
                })
                setNotice(`Statut: ${STATUS_LABEL[data.status] || data.status}`)
                await load(token)
              })}
            >
              {NEXT_LABEL[next]}
            </button>
          ) : null}
        </div>
        <form
          className="form"
          onSubmit={(event) => {
            event.preventDefault()
            run(async () => {
              await api('/api/admin/edition', {
                method: 'PATCH',
                token,
                body: {
                  theme: draft.theme,
                  registration_deadline: toIso(draft.registration_deadline),
                  submission_deadline: toIso(draft.submission_deadline),
                  judging_deadline: toIso(draft.judging_deadline),
                },
              })
              setNotice('Ediția a fost salvată.')
              await load(token)
            })
          }}
        >
          <label className="field">
            <span>temă</span>
            <input value={draft.theme} onChange={(e) => setDraft({ ...draft, theme: e.target.value })} />
          </label>
          <label className="field">
            <span>termen înscriere</span>
            <input type="datetime-local" value={draft.registration_deadline} onChange={(e) => setDraft({ ...draft, registration_deadline: e.target.value })} />
          </label>
          <label className="field">
            <span>termen predare</span>
            <input type="datetime-local" value={draft.submission_deadline} onChange={(e) => setDraft({ ...draft, submission_deadline: e.target.value })} />
          </label>
          <label className="field">
            <span>termen jurizare</span>
            <input type="datetime-local" value={draft.judging_deadline} onChange={(e) => setDraft({ ...draft, judging_deadline: e.target.value })} />
          </label>
          <button type="submit" className="text-btn">salvează termenele</button>
        </form>
      </section>

      <section>
        <h2>categorii</h2>
        <p className="admin-note">Litere mici, cifre, underscore. Se pot schimba doar în pregătire sau deschisă.</p>
        <div className="admin-scroll">
        <table className="admin-table">
          <thead>
            <tr>
              <th scope="col">secțiune</th>
              <th scope="col">subsecțiune</th>
              <th scope="col">activă</th>
              <th scope="col"><span className="admin-sr">acțiuni</span></th>
            </tr>
          </thead>
          <tbody>
            {categories.map((item, index) => (
              <tr key={item.id || index}>
                <td>
                  <input
                    className="admin-input"
                    aria-label={`secțiune ${index + 1}`}
                    value={item.section}
                    onChange={(e) => {
                      const nextRows = [...categories]
                      nextRows[index] = { ...item, section: e.target.value }
                      setCategories(nextRows)
                    }}
                  />
                </td>
                <td>
                  <input
                    className="admin-input"
                    aria-label={`subsecțiune ${index + 1}`}
                    value={item.subsection}
                    onChange={(e) => {
                      const nextRows = [...categories]
                      nextRows[index] = { ...item, subsection: e.target.value }
                      setCategories(nextRows)
                    }}
                  />
                </td>
                <td>
                  <label className="admin-check">
                    <input
                      type="checkbox"
                      checked={item.active}
                      aria-label={`categoria ${index + 1} activă`}
                      onChange={(e) => {
                        const nextRows = [...categories]
                        nextRows[index] = { ...item, active: e.target.checked }
                        setCategories(nextRows)
                      }}
                    />
                  </label>
                </td>
                <td>
                  <button type="button" className="text-btn" onClick={() => setCategories(categories.filter((_, i) => i !== index))}>șterge</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        <div className="actions">
          <button type="button" className="text-btn" onClick={() => setCategories([...categories, { section: '', subsection: '', active: true }])}>adaugă</button>
          <button
            type="button"
            className="text-btn"
            onClick={() => run(async () => {
              await api('/api/admin/edition/categories', {
                method: 'PUT',
                token,
                body: {
                  categories: categories.map((item) => ({
                    section: item.section,
                    subsection: item.subsection,
                    active: item.active,
                  })),
                },
              })
              setNotice('Categoriile au fost salvate.')
              await load(token)
            })}
          >
            salvează categoriile
          </button>
        </div>
      </section>
      </> : null}

      <section>
        <h2>ediții</h2>
        <div className="admin-scroll">
        <table className="admin-table">
          <thead>
            <tr><th scope="col">an</th><th scope="col">temă</th><th scope="col">statut</th><th scope="col"><span className="admin-sr">acțiuni</span></th></tr>
          </thead>
          <tbody>
            {editions.map((item) => (
              <tr key={item.id}>
                <td>{item.year_label}</td>
                <td>{item.theme}</td>
                <td>{STATUS_LABEL[item.status] || item.status}</td>
                <td>
                  <div className="admin-actions">
                  {PREV[item.status] ? (
                    <button
                      type="button"
                      className="text-btn"
                      onClick={() => run(async () => {
                        await api('/api/admin/edition/transition', {
                          method: 'POST',
                          token,
                          body: { status: PREV[item.status], edition_id: item.id },
                        })
                        setNotice(`Statut: ${STATUS_LABEL[PREV[item.status]] || PREV[item.status]}`)
                        await load(token)
                      })}
                    >
                      {PREV_LABEL[PREV[item.status]]}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="text-btn"
                    onClick={() => run(async () => {
                      if (!window.confirm(`Ștergi ediția ${item.year_label}?`)) return
                      await api(`/api/admin/editions/${item.id}`, { method: 'DELETE', token })
                      setNotice('Ediția a fost ștearsă.')
                      await load(token)
                    })}
                  >
                    șterge
                  </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </section>
      <section>
        <h2>ediție nouă</h2>
        <p className="admin-note">
          O ediție trecută se salvează direct și apare pe pagina de ediții.
          O ediție nouă pornește ca draft și se poate crea doar după ce ediția curentă este arhivată.
        </p>
        <form
          className="form"
          onSubmit={(event) => {
            event.preventDefault()
            run(async () => {
              await api('/api/admin/edition', {
                method: 'POST',
                token,
                body: {
                  year_label: newEdition.year_label,
                  theme: newEdition.theme,
                  registration_deadline: toIso(newEdition.registration_deadline),
                  submission_deadline: toIso(newEdition.submission_deadline),
                  judging_deadline: toIso(newEdition.judging_deadline),
                  archived: newEdition.archived,
                },
              })
              setNotice(newEdition.archived ? 'Ediția trecută a fost salvată.' : 'Ediția nouă a fost creată.')
              await load(token)
            })
          }}
        >
          <label className="field">
            <span>an</span>
            <input value={newEdition.year_label} onChange={(e) => setNewEdition({ ...newEdition, year_label: e.target.value })} placeholder="2026-2027" />
          </label>
          <label className="field">
            <span>temă</span>
            <input value={newEdition.theme} onChange={(e) => setNewEdition({ ...newEdition, theme: e.target.value })} />
          </label>
          <label className="field">
            <span>termen înscriere</span>
            <input type="datetime-local" value={newEdition.registration_deadline} onChange={(e) => setNewEdition({ ...newEdition, registration_deadline: e.target.value })} />
          </label>
          <label className="field">
            <span>termen predare</span>
            <input type="datetime-local" value={newEdition.submission_deadline} onChange={(e) => setNewEdition({ ...newEdition, submission_deadline: e.target.value })} />
          </label>
          <label className="field">
            <span>termen jurizare</span>
            <input type="datetime-local" value={newEdition.judging_deadline} onChange={(e) => setNewEdition({ ...newEdition, judging_deadline: e.target.value })} />
          </label>
          <label className="admin-check">
            <input
              type="checkbox"
              checked={newEdition.archived}
              onChange={(e) => setNewEdition({ ...newEdition, archived: e.target.checked })}
            />
            ediție trecută
          </label>
          <button type="submit" className="text-btn">salvează ediția</button>
        </form>
      </section>
      </> : null}

      {section === 'juriu' ? <>
      <section>
        <h2>coduri</h2>
        <form
          className="form"
          onSubmit={(event) => {
            event.preventDefault()
            run(async () => {
              const data = await api('/api/admin/invite-codes', {
                method: 'POST',
                token,
                body: { count: Number(inviteCount), role: 'jury' },
              })
              setFreshCodes(data.codes)
              setNotice('Codurile de mai jos sunt singura copie în clar.')
              await load(token)
            })
          }}
        >
          <label className="field">
            <span>câte coduri</span>
            <input type="number" min="1" max="50" value={inviteCount} onChange={(e) => setInviteCount(e.target.value)} />
          </label>
          <button type="submit" className="text-btn">generează</button>
        </form>
        {freshCodes.length ? (
          <pre className="admin-codes">{freshCodes.map((item) => item.code).join('\n')}</pre>
        ) : null}
        <div className="admin-scroll">
        <table className="admin-table">
          <thead>
            <tr><th scope="col">cod</th><th scope="col">statut</th><th scope="col">folosit de</th><th scope="col"><span className="admin-sr">acțiuni</span></th></tr>
          </thead>
          <tbody>
            {invites.map((item) => (
              <tr key={item.id}>
                <td>{item.masked}</td>
                <td>{INVITE_LABEL[item.status] || item.status}</td>
                <td>{item.used_by_email || ''}</td>
                <td>
                  {item.status === 'active' || item.status === 'expired' ? (
                    <button
                      type="button"
                      className="text-btn"
                      onClick={() => run(async () => {
                        await api(`/api/admin/invite-codes/${item.id}/revoke`, { method: 'POST', token })
                        await load(token)
                      })}
                    >
                      revocă
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </section>

      <section>
        <h2>membri</h2>
        <div className="admin-scroll">
        <table className="admin-table">
          <thead>
            <tr><th scope="col">nume</th><th scope="col">email</th><th scope="col">activ</th><th scope="col">arhivă</th><th scope="col"><span className="admin-sr">acțiuni</span></th></tr>
          </thead>
          <tbody>
            {jury.map((item) => (
              <tr key={item.id}>
                <td>{item.full_name}</td>
                <td>{item.email}</td>
                <td>{item.is_active ? 'da' : 'nu'}</td>
                <td>{item.archived ? 'da' : 'nu'}</td>
                <td>
                  {item.is_active ? (
                    <button
                      type="button"
                      className="text-btn"
                      onClick={() => run(async () => {
                        await api(`/api/admin/jury/${item.id}/deactivate`, { method: 'POST', token })
                        await load(token)
                      })}
                    >
                      dezactivează
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </section>
      </> : null}

      {section === 'echipe' ? (
      <section>
        <h2>echipe</h2>
        <div className="admin-scroll">
        <table className="admin-table">
          <thead>
            <tr><th scope="col">nr</th><th scope="col">ediție</th><th scope="col">titlu</th><th scope="col">școală</th><th scope="col">email</th><th scope="col">statut</th><th scope="col"><span className="admin-sr">acțiuni</span></th></tr>
          </thead>
          <tbody>
            {teams.map((item) => (
              <tr key={item.registration_id}>
                <td>{item.nr_crt}</td>
                <td>{item.year_label}</td>
                <td>{item.title}</td>
                <td>{item.school}</td>
                <td>{item.account_email}</td>
                <td>{CONTENT_LABEL[item.content_status] || item.content_status}</td>
                <td>
                  <div className="admin-actions">
                  <a className="text-btn" href={profileHref(item.registration_id)}>profil</a>
                  <button
                    type="button"
                    className="text-btn"
                    onClick={() => run(async () => {
                      const title = window.prompt('Titlu nou', item.title || '')
                      if (!title) return
                      const reason = window.prompt('Motiv')
                      if (!reason) return
                      await api(`/api/admin/teams/${item.registration_id}/rename`, {
                        method: 'POST',
                        token,
                        body: { title, reason },
                      })
                      await load(token)
                    })}
                  >
                    redenumește
                  </button>
                  <button
                    type="button"
                    className="text-btn"
                    onClick={() => run(async () => {
                      const response = await fetch(`/api/admin/teams/${item.registration_id}/anexa1`, {
                        credentials: 'include',
                        headers: { 'x-session': 'admin' },
                      })
                      if (!response.ok) {
                        const data = await response.json().catch(() => null)
                        throw new Error(data?.detail || 'Anexa nu a putut fi descărcată.')
                      }
                      const blob = await response.blob()
                      const url = URL.createObjectURL(blob)
                      const link = document.createElement('a')
                      link.href = url
                      link.download = 'anexa1.docx'
                      link.click()
                      URL.revokeObjectURL(url)
                    })}
                  >
                    anexa
                  </button>
                  {item.chosen_version_id ? (
                    <button
                      type="button"
                      className="text-btn"
                      onClick={() => run(async () => {
                        const response = await fetch(`/api/admin/submissions/${item.chosen_version_id}/file`, {
                          credentials: 'include',
                          headers: { 'x-session': 'admin' },
                        })
                        if (!response.ok) {
                          const data = await response.json().catch(() => null)
                          throw new Error(data?.detail || 'PDF-ul nu a putut fi descărcat.')
                        }
                        const blob = await response.blob()
                        const url = URL.createObjectURL(blob)
                        const link = document.createElement('a')
                        link.href = url
                        link.download = 'lucrare.pdf'
                        link.click()
                        URL.revokeObjectURL(url)
                      })}
                    >
                      pdf
                    </button>
                  ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </section>
      ) : null}

      {section === 'jurnal' ? <>
      <section>
        <h2>alerte</h2>
        <div className="admin-scroll">
        <table className="admin-table">
          <thead>
            <tr><th scope="col">când</th><th scope="col">mesaj</th></tr>
          </thead>
          <tbody>
            {alerts.map((item) => (
              <tr key={item.id}>
                <td>{formatWhen(item.created_at)}</td>
                <td>{item.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </section>

      <section>
        <h2>audit</h2>
        <div className="admin-scroll">
        <table className="admin-table">
          <thead>
            <tr><th scope="col">când</th><th scope="col">acțiune</th><th scope="col">motiv</th></tr>
          </thead>
          <tbody>
            {events.map((item) => (
              <tr key={item.id}>
                <td>{formatWhen(item.created_at)}</td>
                <td>{item.action}</td>
                <td>{item.reason || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </section>
      </> : null}
      </div>
    </main>
  )
}
