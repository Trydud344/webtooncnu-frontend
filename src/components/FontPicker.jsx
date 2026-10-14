import { useEffect, useMemo, useRef, useState } from 'react'
import {
  FONT_CATEGORY_FALLBACK,
  FONT_OPTIONS,
  cachedFontCatalog,
  googleFamilyParam,
  loadFontCatalog,
} from '../fonts'
import './FontPicker.css'

const CATEGORY_ORDER = ['sans-serif', 'serif', 'display', 'handwriting', 'monospace']
const PREVIEW_BATCH = 120

// Families waiting for a preview stylesheet, most recently seen last.
const previewQueue = []

function previewCategory(font) {
  return FONT_CATEGORY_FALLBACK[font.category] || 'sans-serif'
}

export default function FontPicker({ value, onChange }) {
  const [fonts, setFonts] = useState(cachedFontCatalog)
  const [failed, setFailed] = useState(false)
  const [query, setQuery] = useState('')
  const listRef = useRef(null)

  useEffect(() => {
    if (cachedFontCatalog()) return undefined
    let cancelled = false
    loadFontCatalog()
      .then((list) => { if (!cancelled) setFonts(list) })
      .catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true }
  }, [])

  const groups = useMemo(() => {
    if (!fonts) return []
    const needle = query.trim().toLowerCase()
    const matches = needle
      ? fonts.filter((font) => font.family.toLowerCase().includes(needle))
      : fonts
    return CATEGORY_ORDER
      .map((name) => ({ name, fonts: matches.filter((font) => font.category === name) }))
      .filter((group) => group.fonts.length)
  }, [fonts, query])

  // Only the rows near the viewport get a preview stylesheet, batched into one
  // request so scrolling a 2,000 font list stays cheap.
  useEffect(() => {
    const list = listRef.current
    if (!list || !fonts) return undefined
    const queued = new Set()
    let timer = null
    const flush = () => {
      timer = null
      if (!queued.size) return
      queued.forEach((family) => {
        const index = previewQueue.indexOf(family)
        if (index !== -1) previewQueue.splice(index, 1)
        previewQueue.push(family)
      })
      queued.clear()
      while (previewQueue.length > PREVIEW_BATCH) previewQueue.shift()

      let link = document.getElementById('font-preview-link')
      if (!link) {
        link = document.createElement('link')
        link.id = 'font-preview-link'
        link.rel = 'stylesheet'
        document.head.appendChild(link)
      }
      const chars = new Set('0123456789')
      previewQueue.forEach((family) => family.split('').forEach((char) => chars.add(char)))
      const families = previewQueue.map((family) => `family=${googleFamilyParam(family)}`).join('&')
      link.href = `https://fonts.googleapis.com/css2?${families}&text=${encodeURIComponent([...chars].join(''))}&display=swap`
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return
        const family = entry.target.getAttribute('data-font-family')
        if (family && !previewQueue.includes(family)) queued.add(family)
      })
      if (queued.size && !timer) timer = setTimeout(flush, 300)
    }, { root: list, rootMargin: '120px' })

    list.querySelectorAll('[data-font-family]').forEach((element) => observer.observe(element))
    if (value && value !== 'default' && !previewQueue.includes(value)) {
      queued.add(value)
      timer = setTimeout(flush, 300)
    }
    return () => {
      observer.disconnect()
      if (timer) clearTimeout(timer)
    }
  }, [groups, fonts, value])

  // The catalog request can fail (offline, blocked); the six presets still work.
  if (failed) {
    return (
      <select
        className="properties-field"
        value={value || 'default'}
        aria-label="Font"
        onChange={(event) => onChange(event.target.value)}
      >
        {FONT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    )
  }

  if (!fonts) return <p className="font-picker-status">Loading fonts…</p>

  return (
    <div className="font-picker">
      <input
        className="font-picker-search"
        type="search"
        placeholder="Search fonts"
        aria-label="Search fonts"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <div className="font-picker-list" ref={listRef} role="listbox" aria-label="Fonts">
        <button
          type="button"
          role="option"
          aria-selected={value === 'default'}
          className={`font-picker-option${value === 'default' ? ' is-active' : ''}`}
          onClick={() => onChange('default')}
        >
          Default
        </button>
        {groups.map((group) => (
          <div key={group.name} className="font-picker-group">
            <div className="font-picker-separator" aria-hidden="true">{group.name}</div>
            {group.fonts.map((font) => (
              <button
                key={font.family}
                type="button"
                role="option"
                aria-selected={value === font.family}
                data-font-family={font.family}
                className={`font-picker-option${value === font.family ? ' is-active' : ''}`}
                style={{ fontFamily: `'${font.family}', ${previewCategory(font)}` }}
                onClick={() => onChange(font.family)}
              >
                {font.family}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
