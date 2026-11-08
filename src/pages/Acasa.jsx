import { useEffect, useState } from 'react'

const SUBSECTION_NOTE = {
  clasic: 'desen digital pe tabletă grafică sau desen pe hârtie, scanat',
  pro_ia: 'desene asistate de inteligența artificială, dar produsul final nu poate fi 100% AI',
  non_ia: 'desen cu aplicații pe bază de forme și imagini predefinite, fără AI',
}

function formatDay(iso) {
  return new Intl.DateTimeFormat('ro-RO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Bucharest',
  }).format(new Date(iso))
}

function registrationOpen(edition) {
  return edition.status === 'deschisa' && new Date(edition.registration_deadline) >= new Date()
}

function registrationState(edition) {
  if (registrationOpen(edition)) return 'Înscrierile sunt deschise.'
  if (edition.status === 'deschisa') return 'Termenul de înscriere a trecut.'
  if (edition.status === 'jurizare') return 'Înscrierile s-au închis. Ediția este în jurizare.'
  if (edition.status === 'inchisa' || edition.status === 'arhiva') return 'Ediția nu mai primește înscrieri.'
  return 'Înscrierile nu sunt încă deschise.'
}

function groupedSections(categories) {
  const groups = []
  const index = new Map()
  for (const category of categories || []) {
    let group = index.get(category.section)
    if (!group) {
      group = { key: category.section, label: category.section_label, items: [] }
      index.set(category.section, group)
      groups.push(group)
    }
    group.items.push(category)
  }
  return groups
}

export default function Acasa({ onSignup }) {
  const [edition, setEdition] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    fetch('/api/edition')
      .then(async (response) => {
        const data = await response.json().catch(() => null)
        if (!response.ok) throw new Error(data?.detail || 'Ediția nu a putut fi încărcată.')
        return data
      })
      .then((data) => {
        if (!cancelled) setEdition(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const sections = groupedSections(edition?.categories)
  const open = edition ? registrationOpen(edition) : false

  return (
    <main className="page">
      <header className="hero hero-centered">
        <h1 className="logo-title"><img src={`${import.meta.env.BASE_URL}logo-v2.png`} alt="WEBTOON CNU" /></h1>
        <p className="lede">
          Locul în care tehnologia se întâlnește cu creativitatea.
        </p>
        <p className="lede">
          WebToonCNU este mai mult decât un proiect de benzi desenate — este o călătorie
          în lumea creativității și a liberei exprimări. Invităm artiști de orice nivel
          să construiască împreună o comunitate vibrantă, plină de imaginație.
        </p>
        {edition ? (
          <>
            <p>
              <em>Tema ediției {edition.year_label}: „{edition.theme}”.</em>
            </p>
            <p>{registrationState(edition)}</p>
            <p>
              <small>
                înscriere: {formatDay(edition.registration_deadline)}
                {' · '}
                lucrări: {formatDay(edition.submission_deadline)}
                {' · '}
                jurizare: {formatDay(edition.judging_deadline)}
                {' · '}
                <a href="mailto:contact@cnutoons.com">contact@cnutoons.com</a>
              </small>
            </p>
          </>
        ) : error ? (
          <p className="form-error">{error}</p>
        ) : (
          <p>Se încarcă ediția…</p>
        )}
        <div className="actions">
          {open ? (
            <button type="button" className="text-btn" onClick={onSignup}>înscriere</button>
          ) : null}
          <a className="text-btn" href="#regulament">regulament</a>
          <a className="text-btn" href="#parteneriat">parteneriat</a>
        </div>
      </header>

      <section>
        <h2>despre</h2>
        <p>
          WebToonCNU oferă un mediu virtual prietenos și deschis, unde participanții își
          exprimă imaginația și creează benzi desenate captivante. Prin acest proiect
          încurajăm creativitatea, promovăm gândirea critică și celebrăm diversitatea
          artistică.
        </p>
        <p>
          Concursul este organizat de Centrul Județean de Excelență Vrancea împreună cu
          Colegiul Național „Unirea”, Focșani. Haideți să creăm împreună și să aducem la
          viață povești care vor rămâne în inimile noastre.
        </p>
        <p>
          <small>stil · creativitate · simplitate · sentimente · natură · concurență</small>
        </p>
      </section>

      <section>
        <h2>ce creezi</h2>
        <p>Fiecare echipă realizează două lucruri:</p>
        <p>
          <strong>1. un webtoon.</strong> Titlul webtoon-ului este numele echipei.
          Se publică pe webtoons.com, la 800 × 1280 px, cu un scurt sinopsis la început.
          Episodul 1 în română, episodul 2 tradus în engleză sau franceză. Scenariul
          pornește de la tema ediției
          {edition?.theme ? ` („${edition.theme}”)` : ''} și de la o referință autentică — bibliografie,
          reportaj, articol, memorii, mărturie contemporană, film — citată la final.
        </p>
        <p>
          <strong>2. un film de prezentare, de maximum 2 minute.</strong> Conține
          prezentarea tuturor membrilor prin fotografie și avatar, rolurile fiecăruia
          și coperta webtoon-ului.
        </p>
      </section>

      <section>
        <h2>secțiuni</h2>
        {edition && sections.length === 0 ? <p>Nu sunt secțiuni active.</p> : null}
        {!edition && !error ? <p>Se încarcă secțiunile…</p> : null}
        {sections.length > 0 ? (
          <ul>
            {sections.map((section) => (
              <li key={section.key}>
                <strong>{section.label}</strong>
                <ul>
                  {section.items.map((item) => (
                    <li key={item.id}>
                      {item.subsection_label}
                      {SUBSECTION_NOTE[item.subsection] ? ` — ${SUBSECTION_NOTE[item.subsection]}` : ''}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        ) : null}
        <p>
          <small>Echipe de 2–6 elevi, îndrumați de maximum 2 profesori coordonatori,
          chiar și din școli sau discipline diferite.</small>
        </p>
      </section>

      <section>
        <h2>jurizare</h2>
        {edition ? <p>Termen: {formatDay(edition.judging_deadline)}.</p> : null}
        <p>400 de puncte, în patru părți egale:</p>
        <ul>
          <li>100 — calitatea scenariului</li>
          <li>100 — aspectul grafic</li>
          <li>100 — calitatea traducerii în engleză / franceză</li>
          <li>100 — calitatea filmului de prezentare</li>
        </ul>
      </section>

      <section id="inscriere">
        <h2>participare</h2>
        <p id="regulament">
          Înscrierea se face prin formularul oficial, cu anexa 1 completată pentru toți
          membrii echipei.
          {edition
            ? ` Regulamentul ediției ${edition.year_label} descrie condițiile, criteriile și calendarul.`
            : ' Regulamentul ediției curente descrie condițiile, criteriile și calendarul.'}
        </p>
        <p id="parteneriat">
          Participarea școlilor se face pe bază de parteneriat semnat cu Centrul
          Județean de Excelență Vrancea, după modelul publicat pe site. Toți
          participanții primesc adeverințe, iar câștigătorii — diplome.
        </p>
        <p>
          <small>
            înscriere · regulament · parteneriat — linkurile oficiale rămân cele de pe
            site-ul actual, până la mutarea completă pe platforma nouă.
          </small>
        </p>
      </section>

      <section>
        <h2>contact</h2>
        <p>
          <a href="mailto:contact@cnutoons.com">contact@cnutoons.com</a>
          <br />
          <small>WebToonCNU · cnutoons.com · youtube</small>
        </p>
      </section>
    </main>
  )
}
