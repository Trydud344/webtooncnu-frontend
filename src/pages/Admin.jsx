import { useCallback, useEffect, useState } from 'react'

const TOKEN_KEY = 'webtooncnu_admin_token'

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

async function api(path, { method = 'GET', body, token } = {}) {
  const response = await fetch(path, {
    method,
    headers: {
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
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
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_KEY) || '')
  const [ready, setReady] = useState(false)
  const [email, setEmail] = useState('presedinte@cnutoons.com')
  const [password, setPassword] = useState('')
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
  const [bulletins, setBulletins] = useState([])
  const [bulletinTitle, setBulletinTitle] = useState('')
  const [bulletinBody, setBulletinBody] = useState('')
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
    const [editionData, editionList, albumList, bulletinList, inviteData, juryData, teamData, alertData, auditData] = await Promise.all([
      editionRequest,
      api('/api/admin/editions', { token: activeToken }),
      api('/api/admin/albums', { token: activeToken }),
      api('/api/admin/bulletins', { token: activeToken }),
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
  }, [])

  useEffect(() => {
    if (!token) {
      setReady(false)
      return
    }
    let cancelled = false
    api('/api/auth/me', { token })
      .then(async (data) => {
        if (cancelled) return
        if (data.account.role !== 'admin') {
          sessionStorage.removeItem(TOKEN_KEY)
          setToken('')
          setError('Contul nu este de președinte.')
          return
        }
        try {
          await load(token)
        } catch (err) {
          if (!cancelled) setError(err.message)
        }
      })
      .catch((err) => {
        if (cancelled) return
        if (err.status === 401 || err.status === 403) {
          sessionStorage.removeItem(TOKEN_KEY)
          setToken('')
        }
        setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [token, load])

  const run = async (action) => {
    setError('')
    setNotice('')
    try {
      await action()
    } catch (err) {
      setError(err.message)
    }
  }

  const login = (event) => {
    event.preventDefault()
    run(async () => {
      const data = await api('/api/auth/login', { method: 'POST', body: { email, password } })
      if (data.account.role !== 'admin') throw new Error('Contul nu este de președinte.')
      sessionStorage.setItem(TOKEN_KEY, data.token)
      setToken(data.token)
    })
  }

  const logout = () => {
    const current = token
    sessionStorage.removeItem(TOKEN_KEY)
    setToken('')
    setEdition(null)
    api('/api/auth/logout', { method: 'POST', token: current }).catch(() => {})
  }

  if (!token) {
    return (
      <main className="page">
        <header className="hero">
          <h1>admin</h1>
          <p className="lede">Contul de președinte.</p>
        </header>
        <form className="form" onSubmit={login}>
          {error ? <p className="form-error">{error}</p> : null}
          <label className="field">
            <span>email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
          </label>
          <label className="field">
            <span>parolă</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </label>
          <button type="submit" className="text-btn">intră</button>
        </form>
      </main>
    )
  }

  if (!ready) {
    return (
      <main className="page">
        <header className="hero">
          <h1>admin</h1>
          <p className="lede">Se încarcă contul…</p>
        </header>
      </main>
    )
  }

  const registrationsOpen = edition?.status === 'deschisa' && new Date(edition.registration_deadline) >= new Date()
  const next = edition ? NEXT[edition.status] : null

  return (
    <main className="page">
      <header className="hero">
        <h1>admin</h1>
        <p className="lede">
          {edition
            ? `${edition.year_label} · ${edition.status}${registrationsOpen ? ' · înscrierile sunt deschise' : ' · înscrierile sunt închise'}`
            : 'Nu există o ediție curentă. Poți adăuga una mai jos.'}
        </p>
        <button type="button" className="text-btn" onClick={logout}>ieși</button>
      </header>
      {error ? <p className="form-error">{error}</p> : null}
      {notice ? <p>{notice}</p> : null}

      <section>
        <h2>anunțuri platformă</h2>
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
        <table className="admin-table">
          <thead>
            <tr><th>titlu</th><th>publicat</th><th></th></tr>
          </thead>
          <tbody>
            {bulletins.map((item) => (
              <tr key={item.id}>
                <td>{item.title}</td>
                <td>{item.created_at ? new Date(item.created_at).toLocaleString('ro-RO') : ''}</td>
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
      </section>

      <section>
        <h2>albume evenimente</h2>
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
        <table className="admin-table">
          <thead>
            <tr><th>titlu</th><th>fotografii</th><th></th></tr>
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
      </section>

      {edition && draft ? <>
      <section>
        <h2>ediția curentă</h2>
        <p className="admin-note">
          Înscrierile merg doar când statutul este <code>deschisa</code> și termenul de înscriere nu a trecut.
          Pașii sunt draft → deschisa → jurizare → inchisa → arhiva și pot fi făcuți și înapoi, câte unul.
        </p>
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
              setNotice(`Statut: ${data.status}`)
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
              setNotice(`Statut: ${data.status}`)
              await load(token)
            })}
          >
            {NEXT_LABEL[next]}
          </button>
        ) : <p>Ediția este arhivată.</p>}
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
        <p className="admin-note">Secțiune și subsecțiune: litere mici, cifre, underscore. Se pot schimba doar în draft sau deschisa.</p>
        {categories.map((item, index) => (
          <div className="admin-row" key={item.id || index}>
            <input
              value={item.section}
              onChange={(e) => {
                const nextRows = [...categories]
                nextRows[index] = { ...item, section: e.target.value }
                setCategories(nextRows)
              }}
              placeholder="sectiune"
            />
            <input
              value={item.subsection}
              onChange={(e) => {
                const nextRows = [...categories]
                nextRows[index] = { ...item, subsection: e.target.value }
                setCategories(nextRows)
              }}
              placeholder="subsectiune"
            />
            <label>
              <input
                type="checkbox"
                checked={item.active}
                onChange={(e) => {
                  const nextRows = [...categories]
                  nextRows[index] = { ...item, active: e.target.checked }
                  setCategories(nextRows)
                }}
              />{' '}
              activă
            </label>
            <button type="button" className="text-btn" onClick={() => setCategories(categories.filter((_, i) => i !== index))}>șterge</button>
          </div>
        ))}
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
        <h2>ediții salvate</h2>
        <table className="admin-table">
          <thead>
            <tr><th>an</th><th>temă</th><th>statut</th><th></th></tr>
          </thead>
          <tbody>
            {editions.map((item) => (
              <tr key={item.id}>
                <td>{item.year_label}</td>
                <td>{item.theme}</td>
                <td>{item.status}</td>
                <td>
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
                        setNotice(`Statut: ${PREV[item.status]}`)
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
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
          <label>
            <input
              type="checkbox"
              checked={newEdition.archived}
              onChange={(e) => setNewEdition({ ...newEdition, archived: e.target.checked })}
            />{' '}
            ediție trecută
          </label>
          <button type="submit" className="text-btn">salvează ediția</button>
        </form>
      </section>

      <section>
        <h2>coduri juriu</h2>
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
          <pre>{freshCodes.map((item) => item.code).join('\n')}</pre>
        ) : null}
        <table className="admin-table">
          <thead>
            <tr><th>cod</th><th>statut</th><th>folosit de</th><th></th></tr>
          </thead>
          <tbody>
            {invites.map((item) => (
              <tr key={item.id}>
                <td>{item.masked}</td>
                <td>{item.status}</td>
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
      </section>

      <section>
        <h2>juriu</h2>
        <table className="admin-table">
          <thead>
            <tr><th>nume</th><th>email</th><th>activ</th><th></th></tr>
          </thead>
          <tbody>
            {jury.map((item) => (
              <tr key={item.id}>
                <td>{item.full_name}</td>
                <td>{item.email}</td>
                <td>{item.is_active ? 'da' : 'nu'}</td>
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
      </section>

      <section>
        <h2>echipe</h2>
        <table className="admin-table">
          <thead>
            <tr><th>nr</th><th>titlu</th><th>școală</th><th>email</th><th>statut</th><th></th></tr>
          </thead>
          <tbody>
            {teams.map((item) => (
              <tr key={item.registration_id}>
                <td>{item.nr_crt}</td>
                <td>{item.title}</td>
                <td>{item.school}</td>
                <td>{item.account_email}</td>
                <td>{item.content_status}</td>
                <td>
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
                        headers: { authorization: `Bearer ${token}` },
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
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2>alerte</h2>
        <ul>
          {alerts.map((item) => (
            <li key={item.id}>{item.created_at} — {item.message}</li>
          ))}
        </ul>
      </section>

      <section>
        <h2>audit</h2>
        <ul>
          {events.map((item) => (
            <li key={item.id}>{item.created_at} — {item.action}{item.reason ? ` (${item.reason})` : ''}</li>
          ))}
        </ul>
      </section>
    </main>
  )
}
