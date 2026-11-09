import { useEffect, useId, useRef, useState } from 'react'

export function useNarrow(query = '(max-width: 900px)') {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)

  useEffect(() => {
    const media = window.matchMedia(query)
    const onChange = () => setMatches(media.matches)
    onChange()
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [query])

  return matches
}

function isCurrent(item, active) {
  if (!item.href || !active) return false
  if (item.href === active) return true
  return item.exact === false && active.indexOf(item.href) === 0
}

export default function MobileNav({ items = [], active = '', onEvent }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const toggleRef = useRef(null)
  const menuId = useId()

  useEffect(() => {
    setOpen(false)
  }, [active, items])

  useEffect(() => {
    if (!open) return undefined
    const onPointer = (event) => {
      if (rootRef.current?.contains(event.target)) return
      setOpen(false)
    }
    const onKey = (event) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      toggleRef.current?.focus()
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <nav className="mobile-nav" aria-label="Principal" ref={rootRef}>
      <button
        type="button"
        className="mobile-nav-toggle"
        ref={toggleRef}
        aria-label={open ? 'închide' : 'meniu'}
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          {open ? (
            <path d="M6 6l12 12M18 6L6 18" />
          ) : (
            <path d="M4 7h16M4 12h16M4 17h16" />
          )}
        </svg>
      </button>
      {open ? (
        <ul id={menuId} className="mobile-nav-panel">
          {items.map((item, index) => {
            const current = isCurrent(item, active)
            return (
              <li key={item.href || item.label}>
                <a
                  className={current ? 'mobile-nav-link is-active' : 'mobile-nav-link'}
                  href={item.href || '#'}
                  aria-current={current ? 'page' : undefined}
                  onClick={(event) => {
                    event.preventDefault()
                    setOpen(false)
                    onEvent?.({ label: item.label, href: item.href, index })
                  }}
                >
                  {item.label}
                </a>
              </li>
            )
          })}
        </ul>
      ) : null}
    </nav>
  )
}
