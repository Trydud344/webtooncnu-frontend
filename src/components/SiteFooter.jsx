import './SiteFooter.css'

const COLUMNS = [
  {
    title: 'concurs',
    links: [
      { label: 'acasă', href: '/acasa' },
      { label: 'evenimente', href: '/evenimente' },
      { label: 'ediții', href: '/editii' },
      { label: 'galerie', href: '/galerie' },
      { label: 'resurse', href: '/resurse' },
    ],
  },
  {
    title: 'participare',
    links: [
      { label: 'înscriere', href: '/inscriere' },
      { label: 'regulament', href: '/acasa#regulament' },
      { label: 'parteneriat', href: '/acasa#parteneriat' },
      { label: 'log in', href: '/login' },
    ],
  },
  {
    title: 'platforma',
    links: [
      { label: 'anunțuri', href: '/platforma' },
      { label: 'galerie', href: '/platforma/galerie' },
      { label: 'echipa mea', href: '/platforma/echipa' },
    ],
  },
  {
    title: 'contact',
    links: [
      { label: 'contact', href: '/contact' },
      { label: 'contact@cnutoons.com', href: 'mailto:contact@cnutoons.com' },
      { label: 'cnutoons.com', href: 'https://www.cnutoons.com' },
    ],
  },
]

function PixelSparkMark() {
  return (
    <svg
      className="site-footer__mark"
      viewBox="0 0 11 11"
      width="14"
      height="14"
      aria-hidden="true"
      shapeRendering="crispEdges"
    >
      <rect x="5" y="0" width="1" height="11" fill="currentColor" />
      <rect x="0" y="5" width="11" height="1" fill="currentColor" />
      <rect x="4" y="3" width="3" height="5" fill="currentColor" />
      <rect x="3" y="4" width="5" height="3" fill="currentColor" />
    </svg>
  )
}

function PixelGitHubMark() {
  return (
    <svg
      className="site-footer__gh"
      viewBox="0 0 14 14"
      width="13"
      height="13"
      aria-hidden="true"
      shapeRendering="crispEdges"
    >
      <rect x="3" y="0" width="2" height="1" fill="currentColor" />
      <rect x="9" y="0" width="2" height="1" fill="currentColor" />
      <rect x="3" y="1" width="8" height="1" fill="currentColor" />
      <rect x="2" y="2" width="10" height="1" fill="currentColor" />
      <rect x="1" y="3" width="12" height="3" fill="currentColor" />
      <rect x="2" y="6" width="10" height="1" fill="currentColor" />
      <rect x="3" y="7" width="8" height="1" fill="currentColor" />
      <rect x="0" y="8" width="1" height="1" fill="currentColor" />
      <rect x="4" y="8" width="6" height="1" fill="currentColor" />
      <rect x="1" y="9" width="1" height="1" fill="currentColor" />
      <rect x="4" y="9" width="6" height="1" fill="currentColor" />
      <rect x="2" y="10" width="8" height="1" fill="currentColor" />
      <rect x="4" y="11" width="6" height="1" fill="currentColor" />
      <rect x="4" y="12" width="2" height="2" fill="currentColor" />
      <rect x="8" y="12" width="2" height="2" fill="currentColor" />
    </svg>
  )
}

function PixelArrowMark() {
  return (
    <svg
      className="site-footer__arrow"
      viewBox="0 0 6 6"
      width="8"
      height="8"
      aria-hidden="true"
      shapeRendering="crispEdges"
    >
      <rect x="2" y="0" width="4" height="1" fill="currentColor" />
      <rect x="5" y="1" width="1" height="3" fill="currentColor" />
      <rect x="4" y="1" width="1" height="1" fill="currentColor" />
      <rect x="3" y="2" width="1" height="1" fill="currentColor" />
      <rect x="2" y="3" width="1" height="1" fill="currentColor" />
      <rect x="1" y="4" width="1" height="1" fill="currentColor" />
      <rect x="0" y="5" width="1" height="1" fill="currentColor" />
    </svg>
  )
}

function isExternal(href) {
  return href.startsWith('http://') || href.startsWith('https://') || href.startsWith('mailto:')
}

export default function SiteFooter({ activeHref, onNavigate }) {
  const year = new Date().getFullYear()

  const handleLinkClick = (event, href) => {
    if (isExternal(href)) return
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
    event.preventDefault()
    onNavigate(href)
  }

  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div className="site-footer__brand">
          <a
            className="site-footer__brand-link"
            href="/acasa"
            onClick={(event) => handleLinkClick(event, '/acasa')}
          >
            <PixelSparkMark />
            <span className="site-footer__wordmark">WEBTOON CNU</span>
          </a>
          <p className="site-footer__copy">© {year} WebToonCNU</p>
        </div>

        <div className="site-footer__meta">
          <a
            className="site-footer__credit"
            href="https://github.com/Trydud344"
            target="_blank"
            rel="noopener noreferrer"
          >
            <PixelGitHubMark />
            <span className="site-footer__credit-text">
              Built by <span className="site-footer__credit-name">Ivascu</span>
            </span>
            <PixelArrowMark />
          </a>
        </div>

        <div className="site-footer__sep" aria-hidden="true" />

        <nav className="site-footer__nav" aria-label="navigare subsol">
          {COLUMNS.map((column) => (
            <div key={column.title} className="site-footer__col">
              <h2 className="site-footer__heading">{column.title}</h2>
              <ul className="site-footer__list">
                {column.links.map((item) => {
                  const externalWeb = item.href.startsWith('https://') || item.href.startsWith('http://')
                  const current = !isExternal(item.href) && activeHref === item.href
                  return (
                    <li key={`${column.title}-${item.href}`}>
                      <a
                        className={'site-footer__link' + (current ? ' is-active' : '')}
                        href={item.href}
                        target={externalWeb ? '_blank' : undefined}
                        rel={externalWeb ? 'noopener noreferrer' : undefined}
                        aria-current={current ? 'page' : undefined}
                        onClick={(event) => handleLinkClick(event, item.href)}
                      >
                        {item.label}
                      </a>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>
      </div>
    </footer>
  )
}
