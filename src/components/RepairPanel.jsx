import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTurnstile, withTurnstile } from '../turnstile.js'

const MEMBERS = 'membrii (2–6)'
const COORDINATORS = 'coordonatorii (1–2)'

const UNIT_TYPES = [
  { value: 'scoala', label: 'Școală' },
  { value: 'club', label: 'Club' },
  { value: 'palat', label: 'Palat' },
  { value: 'centru_excelenta', label: 'Centru de Excelență' },
]

const TEXT_FIELDS = [
  ['titlul', 'title'],
  ['unitatea principală', 'primary_unit_name'],
  ['localitatea', 'primary_locality'],
  ['județul', 'primary_county'],
]

function blankMember() {
  return { full_name: '', unit_name: '', locality: '', school_class: '' }
}

function blankCoordinator() {
  return { full_name: '', email: '', phone: '' }
}

function publicMember(row) {
  return {
    full_name: row.full_name,
    unit_name: row.unit_name,
    locality: row.locality,
    school_class: row.school_class,
  }
}

function publicCoordinator(row) {
  return {
    full_name: row.full_name,
    email: row.email,
    phone: row.phone,
  }
}

function seed(registration) {
  const missing = new Set(registration.missing || [])
  const members = registration.members || []
  const coordinators = registration.coordinators || []
  return {
    title: '',
    category_id: '',
    primary_unit_name: '',
    primary_locality: '',
    primary_county: '',
    unit_type: '',
    gdpr: false,
    partnership: false,
    newMembers: missing.has(MEMBERS) && members.length < 2
      ? Array.from({ length: 2 - members.length }, blankMember)
      : [],
    editMembers: missing.has(MEMBERS) && members.length > 6 ? members.map(publicMember) : null,
    newCoordinators: missing.has(COORDINATORS) && coordinators.length < 1 ? [blankCoordinator()] : [],
    editCoordinators: missing.has(COORDINATORS) && coordinators.length > 2
      ? coordinators.map(publicCoordinator)
      : null,
  }
}

function readable(err) {
  if (err && err.message === 'Failed to fetch') {
    return 'API-ul nu răspunde. Pornește backend-ul și reîncarcă pagina.'
  }
  return (err && err.message) || 'Cererea nu a putut fi trimisă.'
}

async function api(path, { method = 'GET', body } = {}) {
  const headers = {}
  if (body !== undefined) headers['content-type'] = 'application/json'
  const response = await fetch(path, {
    method,
    credentials: 'include',
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
    const error = new Error(typeof detail === 'string' ? detail : 'Cererea nu a putut fi trimisă.')
    error.status = response.status
    throw error
  }
  return data
}

export default function RepairPanel({ onClose, onSaved }) {
  const [registration, setRegistration] = useState(null)
  const [categories, setCategories] = useState([])
  const [draft, setDraft] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const registrationCheck = useTurnstile('registration')
  const peopleCheck = useTurnstile('people')

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    let cancelled = false
    api('/api/me/registration')
      .then(async (data) => {
        if (cancelled) return
        setRegistration(data)
        setDraft(seed(data))
        if ((data.missing || []).includes('secțiunea')) {
          const edition = await api('/api/edition')
          if (!cancelled) setCategories(edition.categories || [])
        }
      })
      .catch((err) => {
        if (!cancelled) setError(readable(err))
      })
    return () => {
      cancelled = true
    }
  }, [])

  const missing = new Set(registration?.missing || [])

  const patchRow = (key, index, field, value) => {
    setDraft((current) => ({
      ...current,
      [key]: current[key].map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    }))
  }

  const save = async (event) => {
    event.preventDefault()
    if (!registration || !draft || busy) return
    setError('')
    setBusy(true)
    let latest = registration
    try {
      const fields = {}
      if (missing.has('titlul')) fields.title = draft.title
      if (missing.has('secțiunea')) fields.category_id = draft.category_id
      if (missing.has('unitatea principală')) fields.primary_unit_name = draft.primary_unit_name
      if (missing.has('localitatea')) fields.primary_locality = draft.primary_locality
      if (missing.has('județul')) fields.primary_county = draft.primary_county
      if (missing.has('tipul unității')) fields.unit_type = draft.unit_type
      if (missing.has('consimțământul GDPR')) fields.gdpr_consent = true
      if (missing.has('adeverința de parteneriat')) fields.partnership_ack = true
      if (Object.keys(fields).length) {
        latest = await withTurnstile(registrationCheck, (turnstile_token) => api('/api/me/registration', {
          method: 'PUT',
          body: { ...fields, turnstile_token },
        }))
      }
      if (missing.has(MEMBERS) || missing.has(COORDINATORS)) {
        const members = draft.editMembers
          ? draft.editMembers
          : [...(registration.members || []).map(publicMember), ...draft.newMembers]
        const coordinators = draft.editCoordinators
          ? draft.editCoordinators
          : [...(registration.coordinators || []).map(publicCoordinator), ...draft.newCoordinators]
        latest = await withTurnstile(peopleCheck, (turnstile_token) => api('/api/me/registration/people', {
          method: 'PUT',
          body: { members, coordinators, turnstile_token },
        }))
      }
      setRegistration(latest)
      setDraft(seed(latest))
      onSaved(latest.missing || [])
    } catch (err) {
      setError(readable(err))
      if (latest !== registration) {
        setRegistration(latest)
        setDraft((current) => ({
          ...seed(latest),
          newMembers: current.newMembers,
          editMembers: current.editMembers,
          newCoordinators: current.newCoordinators,
          editCoordinators: current.editCoordinators,
        }))
        onSaved(latest.missing || [])
      }
    } finally {
      setBusy(false)
    }
  }

  return createPortal(
    <div className="repair-backdrop" onClick={onClose}>
      <form className="repair-panel" onClick={(event) => event.stopPropagation()} onSubmit={save}>
        {TEXT_FIELDS.map(([label, key]) => (
          missing.has(label) ? (
            <label className="field" key={key}>
              <span>{label}</span>
              <input
                value={draft?.[key] || ''}
                onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))}
                required
              />
            </label>
          ) : null
        ))}
        {missing.has('secțiunea') ? (
          <label className="field">
            <span>secțiunea</span>
            <select
              value={draft?.category_id || ''}
              onChange={(event) => setDraft((current) => ({ ...current, category_id: event.target.value }))}
              required
            >
              <option value="" />
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.section_label} — {category.subsection_label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {missing.has('tipul unității') ? (
          <label className="field">
            <span>tipul unității</span>
            <select
              value={draft?.unit_type || ''}
              onChange={(event) => setDraft((current) => ({ ...current, unit_type: event.target.value }))}
              required
            >
              <option value="" />
              {UNIT_TYPES.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </label>
        ) : null}
        {draft?.editMembers ? (
          draft.editMembers.map((member, index) => (
            <div className="repair-person" key={`${member.full_name}-${index}`}>
              <span>{member.full_name}</span>
              {draft.editMembers.length > 6 ? (
                <button
                  type="button"
                  className="team-edit"
                  onClick={() => setDraft((current) => ({
                    ...current,
                    editMembers: current.editMembers.filter((_, i) => i !== index),
                  }))}
                >
                  scoate
                </button>
              ) : null}
            </div>
          ))
        ) : null}
        {(draft?.newMembers || []).map((member, index) => (
          <div className="person" key={`member-${index}`}>
            <label className="field">
              <span>nume</span>
              <input
                value={member.full_name}
                onChange={(event) => patchRow('newMembers', index, 'full_name', event.target.value)}
                required
              />
            </label>
            <label className="field">
              <span>unitate</span>
              <input
                value={member.unit_name}
                onChange={(event) => patchRow('newMembers', index, 'unit_name', event.target.value)}
                required
              />
            </label>
            <label className="field">
              <span>localitate</span>
              <input
                value={member.locality}
                onChange={(event) => patchRow('newMembers', index, 'locality', event.target.value)}
                required
              />
            </label>
            <label className="field">
              <span>clasă</span>
              <input
                value={member.school_class}
                onChange={(event) => patchRow('newMembers', index, 'school_class', event.target.value)}
                required
              />
            </label>
          </div>
        ))}
        {draft?.editCoordinators ? (
          draft.editCoordinators.map((coordinator, index) => (
            <div className="repair-person" key={`${coordinator.email}-${index}`}>
              <span>{coordinator.full_name}</span>
              {draft.editCoordinators.length > 2 ? (
                <button
                  type="button"
                  className="team-edit"
                  onClick={() => setDraft((current) => ({
                    ...current,
                    editCoordinators: current.editCoordinators.filter((_, i) => i !== index),
                  }))}
                >
                  scoate
                </button>
              ) : null}
            </div>
          ))
        ) : null}
        {(draft?.newCoordinators || []).map((coordinator, index) => (
          <div className="person" key={`coordinator-${index}`}>
            <label className="field">
              <span>nume</span>
              <input
                value={coordinator.full_name}
                onChange={(event) => patchRow('newCoordinators', index, 'full_name', event.target.value)}
                required
              />
            </label>
            <label className="field">
              <span>email</span>
              <input
                type="email"
                value={coordinator.email}
                onChange={(event) => patchRow('newCoordinators', index, 'email', event.target.value)}
                required
              />
            </label>
            <label className="field">
              <span>telefon</span>
              <input
                value={coordinator.phone}
                onChange={(event) => patchRow('newCoordinators', index, 'phone', event.target.value)}
                required
              />
            </label>
          </div>
        ))}
        {missing.has('consimțământul GDPR') ? (
          <label className="check">
            <input
              type="checkbox"
              checked={Boolean(draft?.gdpr)}
              onChange={(event) => setDraft((current) => ({ ...current, gdpr: event.target.checked }))}
              required
            />
            <span>consimțământul GDPR</span>
          </label>
        ) : null}
        {missing.has('adeverința de parteneriat') ? (
          <label className="check">
            <input
              type="checkbox"
              checked={Boolean(draft?.partnership)}
              onChange={(event) => setDraft((current) => ({ ...current, partnership: event.target.checked }))}
              required
            />
            <span>adeverința de parteneriat</span>
          </label>
        ) : null}
        {error ? <p className="form-error">{error}</p> : null}
        <div className="turnstile-group">
          <div ref={registrationCheck.containerRef} className="turnstile" />
          <div ref={peopleCheck.containerRef} className="turnstile" />
        </div>
        <button type="submit" className="repair-save" disabled={busy || !draft}>
          {busy ? 'se salvează…' : 'salvează'}
        </button>
      </form>
    </div>,
    document.body,
  )
}
