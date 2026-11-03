import { useEffect, useState } from 'react'

const TOKEN_KEY = 'wtc_token'

const emptyMember = () => ({ full_name: '', unit_name: '', locality: '', school_class: '' })
const emptyCoordinator = () => ({ full_name: '', email: '', phone: '' })

const UNIT_TYPES = [
  { value: 'scoala', label: 'Școală' },
  { value: 'club', label: 'Club' },
  { value: 'palat', label: 'Palat' },
  { value: 'centru_excelenta', label: 'Centru de Excelență' },
]

function readable(err) {
  if (err && err.message === 'Failed to fetch') {
    return 'API-ul nu răspunde. Pornește backend-ul și reîncarcă pagina.'
  }
  return (err && err.message) || 'Cererea nu a putut fi trimisă.'
}

async function api(path, { method = 'GET', token, body } = {}) {
  const headers = {}
  if (body !== undefined) headers['content-type'] = 'application/json'
  if (token) headers.authorization = `Bearer ${token}`
  const response = await fetch(path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await response.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = null
  }
  if (!response.ok) {
    const detail = data && data.detail
    const message = typeof detail === 'string'
      ? detail
      : 'API-ul nu răspunde. Pornește backend-ul și reîncarcă pagina.'
    const error = new Error(message)
    error.code = data && data.code
    throw error
  }
  return data
}

function filledPeople(rows) {
  return rows.filter((row) => Object.values(row).some((value) => value.trim() !== ''))
}

export default function Inscriere({ onBack }) {
  const [edition, setEdition] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)
  const [members, setMembers] = useState([emptyMember(), emptyMember()])
  const [coordinators, setCoordinators] = useState([emptyCoordinator()])

  useEffect(() => {
    let cancelled = false
    api('/api/edition')
      .then((data) => {
        if (!cancelled) setEdition(data)
      })
      .catch((err) => {
        if (!cancelled) setLoadError(readable(err))
      })
    return () => {
      cancelled = true
    }
  }, [])

  const patchMember = (index, key, value) => {
    setMembers((rows) => rows.map((row, i) => (i === index ? { ...row, [key]: value } : row)))
  }

  const patchCoordinator = (index, key, value) => {
    setCoordinators((rows) => rows.map((row, i) => (i === index ? { ...row, [key]: value } : row)))
  }

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email') || '')
    const password = String(form.get('password') || '')
    const confirm = String(form.get('confirm') || '')
    if (password !== confirm) {
      setError('Parolele nu coincid.')
      return
    }
    const people = filledPeople(members)
    const teachers = filledPeople(coordinators)
    if (people.length < 2 || people.length > 6) {
      setError('Echipa are între 2 și 6 membri.')
      return
    }
    if (teachers.length < 1 || teachers.length > 2) {
      setError('Este nevoie de 1 sau 2 profesori coordonatori.')
      return
    }
    if (!form.get('gdpr') || !form.get('partnership')) {
      setError('Ambele acorduri sunt obligatorii.')
      return
    }

    setBusy(true)
    try {
      let token = sessionStorage.getItem(TOKEN_KEY)
      if (!token) {
        await api('/api/auth/signup', { method: 'POST', body: { email, password } })
        const session = await api('/api/auth/login', { method: 'POST', body: { email, password } })
        token = session.token
        sessionStorage.setItem(TOKEN_KEY, token)
      }
      await api('/api/me/registration', {
        method: 'PUT',
        token,
        body: {
          title: String(form.get('title') || ''),
          category_id: String(form.get('category_id') || ''),
          primary_unit_name: String(form.get('primary_unit_name') || ''),
          primary_locality: String(form.get('primary_locality') || ''),
          primary_county: String(form.get('primary_county') || ''),
          unit_type: String(form.get('unit_type') || ''),
          gdpr_consent: true,
          partnership_ack: true,
        },
      })
      await api('/api/me/registration/people', {
        method: 'PUT',
        token,
        body: { members: people, coordinators: teachers },
      })
      await api('/api/me/registration/submit', { method: 'POST', token })
      setDone(true)
    } catch (err) {
      setError(readable(err))
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <main className="page">
        <header className="hero">
          <h1>cont creat</h1>
          <p className="lede">
            Echipa este înscrisă. Confirmarea ajunge pe emailul contului.
          </p>
        </header>
        <section>
          <button type="button" className="text-btn" onClick={onBack}>
            înapoi
          </button>
        </section>
      </main>
    )
  }

  return (
    <main className="page">
      <header className="hero">
        <h1>creează cont</h1>
        <p className="lede">
          {edition
            ? `Ediția ${edition.year_label}. ${edition.theme}`
            : 'Cont de echipă și înscriere pentru ediția deschisă.'}
        </p>
      </header>

      <section>
        {loadError ? <p className="form-error">{loadError}</p> : null}
        <form className="form wide" onSubmit={submit}>
          <h2>cont</h2>
          <label className="field">
            <span>email</span>
            <input type="email" name="email" required autoComplete="email" placeholder="nume@exemplu.ro" />
          </label>
          <label className="field">
            <span>parolă</span>
            <input type="password" name="password" required minLength={8} autoComplete="new-password" />
          </label>
          <label className="field">
            <span>confirmă parola</span>
            <input type="password" name="confirm" required minLength={8} autoComplete="new-password" />
          </label>

          <h2>webtoon</h2>
          <label className="field">
            <span>titlu</span>
            <input name="title" required minLength={3} maxLength={100} placeholder="Titlul webtoon-ului" />
          </label>
          <label className="field">
            <span>secțiune</span>
            <select name="category_id" required defaultValue="">
              <option value="" disabled>
                alege secțiunea
              </option>
              {(edition?.categories || []).map((category) => (
                <option key={category.id} value={category.id}>
                  {category.section_label} — {category.subsection_label}
                </option>
              ))}
            </select>
          </label>

          <h2>unitatea principală</h2>
          <label className="field">
            <span>nume</span>
            <input name="primary_unit_name" required maxLength={200} />
          </label>
          <label className="field">
            <span>localitate</span>
            <input name="primary_locality" required maxLength={200} />
          </label>
          <label className="field">
            <span>județ</span>
            <input name="primary_county" required maxLength={200} />
          </label>
          <label className="field">
            <span>tip</span>
            <select name="unit_type" required defaultValue="scoala">
              {UNIT_TYPES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <h2>membri</h2>
          <p>
            <small>Între 2 și 6 elevi. Nume, unitate, localitate și clasă.</small>
          </p>
          {members.map((member, index) => (
            <div className="person" key={index}>
              <label className="field">
                <span>nume și prenume</span>
                <input
                  required
                  value={member.full_name}
                  onChange={(event) => patchMember(index, 'full_name', event.target.value)}
                />
              </label>
              <label className="field">
                <span>unitate</span>
                <input
                  required
                  value={member.unit_name}
                  onChange={(event) => patchMember(index, 'unit_name', event.target.value)}
                />
              </label>
              <label className="field">
                <span>localitate</span>
                <input
                  required
                  value={member.locality}
                  onChange={(event) => patchMember(index, 'locality', event.target.value)}
                />
              </label>
              <label className="field">
                <span>clasă</span>
                <input
                  required
                  value={member.school_class}
                  onChange={(event) => patchMember(index, 'school_class', event.target.value)}
                />
              </label>
              {members.length > 2 ? (
                <button
                  type="button"
                  className="text-btn"
                  onClick={() => setMembers((rows) => rows.filter((_, i) => i !== index))}
                >
                  scoate membrul
                </button>
              ) : null}
            </div>
          ))}
          {members.length < 6 ? (
            <button type="button" className="text-btn" onClick={() => setMembers((rows) => [...rows, emptyMember()])}>
              adaugă membru
            </button>
          ) : null}

          <h2>coordonatori</h2>
          <p>
            <small>Unul sau doi profesori.</small>
          </p>
          {coordinators.map((coordinator, index) => (
            <div className="person" key={index}>
              <label className="field">
                <span>nume și prenume</span>
                <input
                  required
                  value={coordinator.full_name}
                  onChange={(event) => patchCoordinator(index, 'full_name', event.target.value)}
                />
              </label>
              <label className="field">
                <span>email</span>
                <input
                  type="email"
                  required
                  value={coordinator.email}
                  onChange={(event) => patchCoordinator(index, 'email', event.target.value)}
                />
              </label>
              <label className="field">
                <span>telefon</span>
                <input
                  required
                  value={coordinator.phone}
                  onChange={(event) => patchCoordinator(index, 'phone', event.target.value)}
                  placeholder="07xxxxxxxx"
                />
              </label>
              {coordinators.length > 1 ? (
                <button
                  type="button"
                  className="text-btn"
                  onClick={() => setCoordinators((rows) => rows.filter((_, i) => i !== index))}
                >
                  scoate coordonatorul
                </button>
              ) : null}
            </div>
          ))}
          {coordinators.length < 2 ? (
            <button
              type="button"
              className="text-btn"
              onClick={() => setCoordinators((rows) => [...rows, emptyCoordinator()])}
            >
              adaugă coordonator
            </button>
          ) : null}

          <label className="check">
            <input type="checkbox" name="gdpr" required />
            <span>Sunt de acord cu prelucrarea datelor pentru înscrierea în concurs.</span>
          </label>
          <label className="check">
            <input type="checkbox" name="partnership" required />
            <span>Confirm că unitatea participă pe baza parteneriatului cu organizatorul.</span>
          </label>

          {error ? <p className="form-error">{error}</p> : null}
          <div className="actions">
            <button type="submit" className="text-btn" disabled={busy || !edition}>
              {busy ? 'se trimite…' : 'creează contul'}
            </button>
            <button type="button" className="text-btn" onClick={onBack}>
              înapoi
            </button>
          </div>
        </form>
      </section>
    </main>
  )
}
