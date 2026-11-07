import { useEffect, useState } from 'react'
import './Resurse.css'

// Prezentările PowerPoint de pe https://www.cnutoons.com/resurse, în aceeași ordine.
const DECKS = [
  { id: '1trebeS02UIUGAUVYAbcEh-tiZNPQE1Vc', title: '8 IA in WebTOOn' },
  { id: '1Kyz4jwJvQqoVN_crWBpQPxfn0IwVhfzM', title: 'Daria' },
  { id: '1L7O_tAGn4vrefBHSVpJ95_962zfh-GIQ', title: 'Laura film' },
  { id: '1NFDNZgjV9Bykovw44SQeUVBLZSufG5UQ', title: 'Roxana' },
  { id: '15YR3nEfEvlHpTLY8EsNQOVQtunb8ln3z', title: 'Elina film' },
  { id: '1NwCcAhl--1mEe2_3MTVsvWggOtZ0Z1s1', title: 'Beige and Brown Vintage History of Literature Workshop Presentation' },
  { id: '1dLTWARbarul6ISp4d3IKtDAJc3BwyNRR', title: '4 Benzile desenate concurente la ediția a II-a' },
  { id: '1K_VJVP4paXOyryoB5nyCm90C7tJJK_vC', title: '6 Ciprian Porumbescu' },
]

function embedSrc(url) {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:') return ''
    const slides = parsed.hostname === 'docs.google.com' && parsed.pathname.startsWith('/presentation/d/')
    const drive = parsed.hostname === 'drive.google.com' && parsed.pathname.startsWith('/file/d/')
    return slides || drive ? parsed.toString() : ''
  } catch {
    return ''
  }
}

export default function Resurse() {
  const [added, setAdded] = useState([])

  useEffect(() => {
    let cancelled = false
    fetch('/api/slides')
      .then((response) => (response.ok ? response.json() : { slides: [] }))
      .then((data) => {
        if (!cancelled) setAdded(Array.isArray(data.slides) ? data.slides : [])
      })
      .catch(() => {
        if (!cancelled) setAdded([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  const decks = [
    ...DECKS.map((deck) => ({
      key: deck.id,
      title: deck.title,
      src: `https://drive.google.com/file/d/${deck.id}/preview`,
    })),
    ...added.flatMap((slide) => {
      const src = embedSrc(slide.embed_url)
      return src ? [{ key: slide.id, title: slide.title, src }] : []
    }),
  ]

  return (
    <main className="page resources-page">
      <header className="resources-head">
        <h1>resurse</h1>
        <p className="lede">Informațiile necesare participării la concurs.</p>
      </header>
      <div className="resources-list">
        {decks.map((deck, index) => (
          <article key={deck.key} className="resources-item">
            <h2>{deck.title}</h2>
            <div className="resources-frame">
              <iframe
                title={deck.title}
                src={deck.src}
                allow="fullscreen"
                loading={index === 0 ? 'eager' : 'lazy'}
              />
            </div>
          </article>
        ))}
      </div>
    </main>
  )
}
