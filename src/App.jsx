import { useEffect, useState } from 'react'
import NavBar from '../navbarting/wrappers/NavBar.jsx'
import '../navbarting/nav-bar.css'
import GradualBlur from './components/GradualBlur.jsx'
import Login from './Login.jsx'
import Evenimente from './pages/Evenimente.jsx'

const ITEMS = [
  { label: 'acasa', href: '/acasa' },
  { label: 'evenimente', href: '/evenimente' },
  { label: 'editii', href: '/editii' },
  { label: 'galerie', href: '/galerie' },
  { label: 'resurse', href: '/resurse' },
  { label: 'contact', href: '/contact' },
]

export default function App() {
  // Butonul log in e vizibil doar la varful paginii (scrollY ~ 0).
  // Legat de pozitia de scroll, NU de hover-ul navbarului — ca sa nu intre in loop cu el.
  const [atTop, setAtTop] = useState(true)
  // Vedere curenta: landing, evenimente, login sau placeholder pentru
  // taburile inca nemutate (doar frontend, fara router)
  const [view, setView] = useState('acasa')

  const go = (detail) => {
    const map = { '/acasa': 'acasa', '/evenimente': 'evenimente' }
    if (detail && map[detail.href]) setView(map[detail.href])
    else if (detail && ITEMS.some((i) => i.href === detail.href))
      setView(detail.href.slice(1))
    else setView('acasa')
  }

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [view])

  useEffect(() => {
    const onScroll = () => setAtTop(window.scrollY < 1)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className={view === 'login' ? 'no-nav-highlight' : undefined}>
      <NavBar
        items={ITEMS}
        routing="off"
        active={view === 'login' ? '/login' : `/${view}`}
        onEvent={go}
      />
      <button
        type="button"
        className={
          'login-btn' +
          (!atTop ? ' is-hidden' : '') +
          (view === 'login' ? ' is-active' : '')
        }
        onClick={() => setView(view === 'login' ? 'acasa' : 'login')}
      >
        <span>log in</span>
      </button>
      {/* Blur full-width: target="page" = fixed pe viewport, 100% latime.
          Navbarul sta deasupra (z 500 vs 150) -> neafectat. */}
      <GradualBlur
        target="page"
        position="top"
        height="6rem"
        strength={2}
        divCount={10}
        curve="bezier"
        exponential={true}
        opacity={1}
        zIndex={50}
      />
      {/* evenimente isi gestioneaza propriul fade pe grid; fara fade global la incarcare */}
      <div key={view} className={view === 'evenimente' ? undefined : 'view-enter'}>
      {view === 'login' ? (
        <Login onBack={() => setView('acasa')} />
      ) : view === 'evenimente' ? (
        <Evenimente />
      ) : view !== 'acasa' ? (
      <main className="page">
        <header className="hero">
          <h1>{view}</h1>
          <p className="lede">
            În lucru — materialele sunt încă pe site-ul actual,{' '}
            <a href="https://www.cnutoons.com">cnutoons.com</a>.
          </p>
        </header>
      </main>
      ) : (
      <main className="page">
        <header className="hero hero-centered">
          <h1 className="logo-title"><img src="./logo-v2.png" alt="WEBTOON CNU" /></h1>
          <p className="lede">
            Locul în care tehnologia se întâlnește cu creativitatea.
          </p>
          <p className="lede">
            WebToonCNU este mai mult decât un proiect de benzi desenate — este o călătorie
            în lumea creativității și a liberei exprimări. Invităm artiști de orice nivel
            să construiască împreună o comunitate vibrantă, plină de imaginație.
          </p>
          <p>
            <em>Tema ediției: „Ecaterina Teodoroiu, emblema spiritului național”.</em>
          </p>
          <p>
            <small>
              1 octombrie 2025 – 30 iunie 2026 · termen trimitere lucrări: 1 iunie 2026 ·{' '}
              <a href="mailto:contact@cnutoons.com">contact@cnutoons.com</a>
            </small>
          </p>
          <div className="actions">
            <a className="text-btn" href="#inscriere">înscriere</a>
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
            pornește de la tema ediției și de la o referință autentică — bibliografie,
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
          <p>Două secțiuni de vârstă, fiecare cu trei subsecțiuni:</p>
          <ul>
            <li>
              <strong>liceu / gimnaziu — clasic:</strong> desen digital pe tabletă
              grafică sau desen pe hârtie, scanat.
            </li>
            <li>
              <strong>liceu / gimnaziu — proIA:</strong> desene asistate de inteligența
              artificială, dar produsul final nu poate fi 100% AI.
            </li>
            <li>
              <strong>liceu / gimnaziu — nonIA:</strong> desen cu aplicații pe bază de
              forme și imagini predefinite, fără AI.
            </li>
          </ul>
          <p>
            <small>Echipe de 2–6 elevi, îndrumați de maximum 2 profesori coordonatori,
            chiar și din școli sau discipline diferite.</small>
          </p>
        </section>

        <section>
          <h2>jurizare</h2>
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
            membrii echipei. Regulamentul complet al ediției a IV-a descrie condițiile,
            criteriile și calendarul.
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
          <h2>ediții</h2>
          <p>
            Ediția I, ediția a II-a, ediția a III-a — arhivă pe site-ul actual.
            Ediția a IV-a, 2025–2026, este ediția curentă.
          </p>
          <p>
            <small>
              Platforma nouă va aduna toate materialele pe ediții: lucrări, evenimente,
              resurse, portrete de artiști, galerie.
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
      )}
      </div>
    </div>
  )
}
