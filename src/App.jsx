import { useEffect, useMemo, useState } from 'react'
import NavBar from '../navbarting/wrappers/NavBar.jsx'
import '../navbarting/nav-bar.css'
import GradualBlur from './components/GradualBlur.jsx'
import Login from './Login.jsx'
import Inscriere from './pages/Inscriere.jsx'
import Admin from './pages/Admin.jsx'
import Platforma from './pages/Platforma.jsx'
import Echipa from './pages/Echipa.jsx'
import Evenimente from './pages/Evenimente.jsx'
import Editii from './pages/Editii.jsx'
import Acasa from './pages/Acasa.jsx'
import Resurse from './pages/Resurse.jsx'
import AccountButton from './AccountButton.jsx'
import RepairPanel from './components/RepairPanel.jsx'
import { notifyProfile, readSignedIn, subscribeAuth, subscribeProfile, writeSignedIn } from './session.js'
import { VIEWS, PLATFORM_ITEMS, parseRoute, canonicalFor, profilePath } from './router.js'

const ITEMS = VIEWS.filter((v) => v !== 'login' && v !== 'inscriere' && v !== 'admin' && v !== 'platforma').map((v) => ({ label: v, href: `/${v}` }))
const LANDING = new Set(ITEMS.map((item) => item.label))
const RETURN_KEY = 'wtc_return'

export default function App() {
  // Butonul log in e vizibil doar la varful paginii (scrollY ~ 0).
  // Legat de pozitia de scroll, NU de hover-ul navbarului — ca sa nu intre in loop cu el.
  const [atTop, setAtTop] = useState(true)
  // Vedere curenta: sincronizata cu URL-ul (history API, hosting static).
  // Navbarul e routing="off" (doar emite), URL-ul e construit aici.
  const [route, setRoute] = useState(() => parseRoute(window.location.pathname))
  const [ownProfileId, setOwnProfileId] = useState('')
  const [missing, setMissing] = useState([])
  const [archived, setArchived] = useState(false)
  const [repairing, setRepairing] = useState(false)
  const [holdPlatformNav, setHoldPlatformNav] = useState(false)
  const view = route.view
  const section = route.section
  const onOwnProfile = view === 'echipa' && Boolean(ownProfileId) && route.profileId === ownProfileId
  const platformItems = useMemo(() => PLATFORM_ITEMS.map((item) => (
    item.section === 'echipa' && ownProfileId
      ? { ...item, href: profilePath(ownProfileId) }
      : item
  )), [ownProfileId])

  const openProfile = (id) => {
    const url = profilePath(id)
    const next = parseRoute(url)
    setRoute(next)
    if (window.location.pathname !== next.canonical) window.history.pushState(null, '', next.canonical)
  }

  const navigate = (next, nextSection) => {
    const url = canonicalFor(next, nextSection)
    setRoute(parseRoute(url))
    if (window.location.pathname !== url) window.history.pushState(null, '', url)
  }

  const go = (detail) => {
    const href = detail && detail.href
    if (!href) {
      navigate('acasa')
      return
    }
    if (href === '/platforma/echipa') {
      if (ownProfileId) {
        openProfile(ownProfileId)
        return
      }
      if (!readSignedIn()) {
        openLogin()
        return
      }
      fetch('/api/me/profile', { credentials: 'include' })
        .then((response) => (response.ok ? response.json() : null))
        .then((data) => {
          if (!data?.id) {
            writeSignedIn(false)
            openLogin()
            return
          }
          setOwnProfileId(data.id)
          openProfile(data.id)
        })
        .catch(() => {})
      return
    }
    const next = parseRoute(href)
    if (next.view === 'echipa' && next.profileId) {
      setRoute(next)
      if (window.location.pathname !== next.canonical) window.history.pushState(null, '', next.canonical)
      return
    }
    navigate(next.view, next.section)
  }

  // La incarcare: o cale necunoscuta sau cu trailing slash devine ruta canonica.
  // Back/forward din browser resincronizeaza vederea.
  useEffect(() => {
    const { canonical } = parseRoute(window.location.pathname)
    if (window.location.pathname !== canonical) window.history.replaceState(null, '', canonical)
    const onPop = () => setRoute(parseRoute(window.location.pathname))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  useEffect(() => {
    const load = () => {
      fetch('/api/auth/me', { credentials: 'include' })
        .then((response) => (response.ok ? response.json() : null))
        .then((data) => {
          const role = data?.account?.role
          const site = role === 'team' || role === 'jury'
          writeSignedIn(site)
          const locked = site && Boolean(data?.account?.archived)
          setArchived(locked)
          if (!site || locked) setRepairing(false)
          if (!site) {
            setOwnProfileId('')
            setMissing([])
          }
        })
        .catch(() => {
          writeSignedIn(false)
          setArchived(false)
        })
      if (!readSignedIn()) return
      fetch('/api/me/profile', { credentials: 'include' })
        .then((response) => (response.ok ? response.json() : null))
        .then((data) => {
          setOwnProfileId(data?.id || '')
          setMissing(Array.isArray(data?.missing) ? data.missing : [])
        })
        .catch(() => {
          setOwnProfileId('')
          setMissing([])
        })
    }
    load()
    const stopAuth = subscribeAuth(load)
    const stopProfile = subscribeProfile(load)
    return () => {
      stopAuth()
      stopProfile()
    }
  }, [])

  useEffect(() => {
    if (view !== 'platforma' || section !== 'echipa' || !ownProfileId) return
    const url = profilePath(ownProfileId)
    const next = parseRoute(url)
    setRoute(next)
    if (window.location.pathname !== next.canonical) window.history.replaceState(null, '', next.canonical)
  }, [view, section, ownProfileId])

  useEffect(() => {
    if (view !== 'login') setHoldPlatformNav(false)
  }, [view])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [view])

  useEffect(() => {
    document.title = 'WebToonCNU — Concurs interjudetean de benzi desenate'
  }, [view])

  useEffect(() => {
    const onScroll = () => setAtTop(window.scrollY < 1)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const onPlatform = view === 'platforma' || onOwnProfile || view === 'resurse'
  const platformNav = onPlatform || (view === 'login' && holdPlatformNav)
  const openLogin = () => {
    setHoldPlatformNav(onPlatform)
    navigate('login')
  }
  const showGap = onPlatform && missing.length > 0 && !archived
  const showArchive = archived

  return (
    <div className={['', view === 'login' ? 'no-nav-highlight' : '', (view === 'platforma' && section === 'echipa') || view === 'echipa' ? 'team-shell' : '', showGap || showArchive ? 'has-gap' : ''].filter(Boolean).join(' ') || undefined}>
      <NavBar
        items={platformNav ? platformItems : ITEMS}
        routing="off"
        active={
          view === 'login'
            ? '/login'
            : platformNav
              ? (view === 'resurse'
                ? '/resurse'
                : (platformItems.find((item) => item.section === (onOwnProfile ? 'echipa' : section))?.href || '/platforma'))
              : `/${view}`
        }
        onEvent={go}
      />
      <AccountButton
        atTop={atTop}
        active={view === 'login'}
        onLogin={() => {
          if (view === 'echipa') sessionStorage.setItem(RETURN_KEY, window.location.pathname)
          else sessionStorage.removeItem(RETURN_KEY)
          if (view === 'login') {
            setHoldPlatformNav(false)
            navigate('acasa')
            return
          }
          openLogin()
        }}
        onPlatform={!platformNav && LANDING.has(view) ? () => navigate('platforma') : undefined}
      />
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
      {showArchive ? (
        <p className="platform-gap">
          <span>Acest cont a fost arhivat deoarece ediția la care s-a înscris s-a încheiat. Creează un cont nou pentru a participa la ediția curentă.</span>
          <button type="button" className="team-edit" onClick={() => navigate('inscriere')}>înscriere</button>
        </p>
      ) : null}
      {showGap ? (
        <p className="platform-gap">
          <span>!!! Lipsesc date obligatorii. Echipa nu va intra în faza de jurizare. !!!</span>
          <button type="button" className="team-edit" onClick={() => setRepairing(true)}>repara acum</button>
        </p>
      ) : null}
      {repairing && !archived ? (
        <RepairPanel
          onClose={() => setRepairing(false)}
          onSaved={(nextMissing) => {
            setMissing(nextMissing)
            notifyProfile()
            if (!nextMissing.length) setRepairing(false)
          }}
        />
      ) : null}
      <div key={view === 'echipa' ? `echipa-${route.profileId}` : view === 'platforma' ? `platforma-${section}` : view} className="view-enter">
      {view === 'admin' ? (
        <Admin />
      ) : view === 'echipa' ? (
        <Echipa profileId={route.profileId} />
      ) : view === 'platforma' && section === 'echipa' ? (
        <Echipa />
      ) : view === 'platforma' && section === 'noutati' ? (
        <Platforma
          onOpenResources={() => navigate('resurse')}
          onOpenWork={() => {
            const land = (id) => {
              openProfile(id)
              window.location.hash = 'lucrare'
            }
            if (!readSignedIn()) {
              openLogin()
              return
            }
            if (ownProfileId) {
              land(ownProfileId)
              return
            }
            fetch('/api/me/profile', { credentials: 'include' })
              .then((response) => (response.ok ? response.json() : null))
              .then((data) => {
                if (!data?.id) {
                  writeSignedIn(false)
                  openLogin()
                  return
                }
                setOwnProfileId(data.id)
                land(data.id)
              })
              .catch(() => openLogin())
          }}
        />
      ) : view === 'platforma' ? (
        <main className="page">
          <section className="board" aria-label="galerie" />
        </main>
      ) : view === 'login' ? (
        <Login
          onBack={() => navigate('acasa')}
          onSignup={() => navigate('inscriere')}
          onEnter={(account) => {
            const back = sessionStorage.getItem(RETURN_KEY)
            sessionStorage.removeItem(RETURN_KEY)
            if (account?.role === 'jury') {
              if (back) {
                window.history.pushState(null, '', back)
                setRoute(parseRoute(back))
                return
              }
              navigate('acasa')
              return
            }
            fetch('/api/me/profile', { credentials: 'include' })
              .then((response) => (response.ok ? response.json() : null))
              .then((data) => {
                if (!data?.id) {
                  navigate('platforma')
                  return
                }
                setOwnProfileId(data.id)
                openProfile(data.id)
              })
              .catch(() => navigate('platforma'))
          }}
        />
      ) : view === 'inscriere' ? (
        <Inscriere onBack={() => navigate('acasa')} />
      ) : view === 'evenimente' ? (
        <Evenimente />
      ) : view === 'editii' ? (
        <Editii onSignup={() => navigate('inscriere')} />
      ) : view === 'resurse' ? (
        <Resurse />
      ) : view === 'contact' ? (
      <main className="page">
        <header className="hero">
          <h1>contact</h1>
          <p className="lede">
            <a href="mailto:webtooncnu@gmail.com">webtooncnu@gmail.com</a>
          </p>
        </header>
      </main>
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
        <Acasa onSignup={() => navigate('inscriere')} />
      )}
      </div>
    </div>
  )
}
