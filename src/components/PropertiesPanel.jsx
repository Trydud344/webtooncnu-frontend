import { useEffect, useRef, useState } from 'react'
import './PropertiesPanel.css'

const ICONS = {
  toggle: (
    <>
      <path d="M4 7h5m4 0h7M4 17h9m4 0h3" />
      <circle cx="11" cy="7" r="2" />
      <circle cx="15" cy="17" r="2" />
    </>
  ),
  close: <path d="M6 6 18 18M18 6 6 18" />,
  previous: <path d="M20 12H5m6-7-7 7 7 7" />,
  next: <path d="M4 12h15m-6-7 7 7-7 7" />,
  reset: (
    <>
      <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1L3.5 8.4" />
      <path d="M3.5 3.6v4.8h4.8" />
    </>
  ),
}

function Icon({ name }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[name]}
    </svg>
  )
}

// Slider with a live value and an icon-only reset back to the default.
export function PropertySlider({ id, label, value, defaultValue, input, onChange }) {
  return (
    <div className="properties-slider">
      <div className="properties-slider-head">
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id}>{value}</output>
      </div>
      <div className="properties-slider-row">
        <input
          id={id}
          type="range"
          {...input}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <button
          className="properties-icon-button properties-reset"
          type="button"
          disabled={value === defaultValue}
          title={`Reset to ${defaultValue}`}
          aria-label={`Reset ${label.toLowerCase()} to ${defaultValue}`}
          onClick={() => onChange(defaultValue)}
        >
          <Icon name="reset" />
        </button>
      </div>
    </div>
  )
}

/**
 * The canvas properties panel. It owns only its own chrome: the collapse morph,
 * the selection counter, the page strip and its pager. The pages themselves are
 * built by the canvas, which holds the widget state they edit.
 */
export default function PropertiesPanel({ count, pages }) {
  const [open, setOpen] = useState(false)
  const [index, setIndex] = useState(0)
  const stripRef = useRef(null)
  const toggleRef = useRef(null)
  const closeRef = useRef(null)
  const last = pages.length - 1
  // A new selection can swap the whole page set, so start over on the first page.
  const pageIds = pages.map((page) => page.id).join()

  useEffect(() => {
    setIndex(0)
    stripRef.current?.scrollTo({ left: 0, behavior: 'instant' })
  }, [pageIds])

  // Scroll drives the pager; only a page change is worth a re-render.
  const syncIndex = () => {
    const strip = stripRef.current
    if (!strip?.clientWidth) return
    const next = Math.max(0, Math.min(last, Math.round(strip.scrollLeft / strip.clientWidth)))
    setIndex((current) => (current === next ? current : next))
  }

  const stepPage = (delta) => {
    const strip = stripRef.current
    if (!strip) return
    const next = Math.max(0, Math.min(last, index + delta))
    strip.scrollTo({ left: next * strip.clientWidth })
  }

  // The control that was just pressed is hidden by the state change, so a
  // keyboard toggle hands focus to the control that replaces it. Pointer clicks
  // report a non-zero detail and keep the focus where the click put it.
  const toggleOpen = (event) => {
    const next = !open
    setOpen(next)
    if (event.detail !== 0) return
    requestAnimationFrame(() => (next ? closeRef : toggleRef).current?.focus())
  }

  return (
    <div className={`properties-panel${open ? ' is-open' : ''}`}>
      <button
        ref={toggleRef}
        className="properties-toggle"
        type="button"
        aria-label="Open properties"
        aria-expanded={open}
        aria-controls="properties-panel-content"
        onClick={toggleOpen}
      >
        <Icon name="toggle" />
      </button>
      <section
        id="properties-panel-content"
        className="properties-content"
        aria-hidden={!open}
        aria-label="Properties for the selected elements"
      >
        <p className="properties-count" aria-live="polite">
          <strong>{count}</strong> {count === 1 ? 'element' : 'elements'} selected
        </p>
        <button
          ref={closeRef}
          className="properties-icon-button properties-close"
          type="button"
          aria-label="Close properties"
          onClick={toggleOpen}
        >
          <Icon name="close" />
        </button>
        <div className="properties-pages" ref={stripRef} onScroll={syncIndex}>
          {pages.map((page) => (
            <div className="properties-page" key={page.id} aria-label={page.label}>
              {page.content}
            </div>
          ))}
        </div>
        <div className="properties-pager">
          <button
            className="properties-icon-button properties-arrow"
            type="button"
            disabled={index === 0}
            aria-label="Previous page"
            onClick={() => stepPage(-1)}
          >
            <Icon name="previous" />
          </button>
          <span aria-live="polite">{pages[index]?.label}</span>
          <button
            className="properties-icon-button properties-arrow"
            type="button"
            disabled={index === last}
            aria-label="Next page"
            onClick={() => stepPage(1)}
          >
            <Icon name="next" />
          </button>
        </div>
      </section>
    </div>
  )
}
