import { useEffect, useState } from 'react'

const STATUS = {
  draft: 'în pregătire',
  deschisa: 'deschisă',
  jurizare: 'în jurizare',
  inchisa: 'închisă',
  arhiva: 'arhivă',
}

function formatWhen(iso) {
  return new Intl.DateTimeFormat('ro-RO', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Europe/Bucharest',
  }).format(new Date(iso))
}

function registrationState(edition) {
  if (edition.status === 'deschisa' && new Date(edition.registration_deadline) >= new Date()) {
    return 'Înscrierile sunt deschise.'
  }
  if (edition.status === 'deschisa') return 'Termenul de înscriere a trecut.'
  if (edition.status === 'jurizare') return 'Înscrierile s-au închis. Ediția este în jurizare.'
  if (edition.status === 'inchisa' || edition.status === 'arhiva') return 'Ediția nu mai primește înscrieri.'
  return 'Înscrierile nu sunt încă deschise.'
}

function categoriesOf(edition) {
  const grouped = new Map()
  for (const category of edition.categories || []) {
    const list = grouped.get(category.section_label) || []
    list.push(category.subsection_label)
    grouped.set(category.section_label, list)
  }
  return grouped
}

export default function Editii({ onSignup }) {
  const [editions, setEditions] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    fetch('/api/editions')
      .then(async (response) => {
        const data = await response.json().catch(() => null)
        if (!response.ok) throw new Error(data?.detail || 'Edițiile nu au putut fi încărcate.')
        return data
      })
      .then((data) => {
        if (!cancelled) setEditions(data.editions || [])
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <main className="page">
      <header className="hero">
        <h1>ediții</h1>
        <p className="lede">Ediția curentă și edițiile trecute, cu temă, termene și categorii.</p>
      </header>

      {error ? <p className="form-error">{error}</p> : null}
      {editions === null && !error ? <p>Se încarcă edițiile…</p> : null}
      {editions && editions.length === 0 ? <p>Nu există încă o ediție publicată.</p> : null}

      {editions?.map((edition) => {
        const grouped = categoriesOf(edition)
        const open = edition.status === 'deschisa' && new Date(edition.registration_deadline) >= new Date()
        return (
          <section key={edition.id}>
            <h2>{edition.year_label}</h2>
            <p><em>{edition.theme}</em></p>
            <p>{registrationState(edition)}</p>
            <dl className="edition-facts">
              <dt>statut</dt>
              <dd>{STATUS[edition.status] || edition.status}</dd>
              <dt>termen înscriere</dt>
              <dd>{formatWhen(edition.registration_deadline)}</dd>
              <dt>termen predare lucrări</dt>
              <dd>{formatWhen(edition.submission_deadline)}</dd>
              <dt>termen jurizare</dt>
              <dd>{formatWhen(edition.judging_deadline)}</dd>
            </dl>
            <h3>categorii</h3>
            {grouped.size === 0 ? <p>Nu sunt categorii active.</p> : (
              <ul>
                {[...grouped.entries()].map(([section, subsections]) => (
                  <li key={section}>{section}: {subsections.join(', ')}</li>
                ))}
              </ul>
            )}
            {open ? (
              <p>
                <button type="button" className="text-btn" onClick={onSignup}>înscriere</button>
              </p>
            ) : null}
          </section>
        )
      })}
    </main>
  )
}
