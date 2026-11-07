import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import './ContestCalendar.css'

const MONTHS = [
  'ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie',
  'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie',
]

const WEEKDAYS = ['lu', 'ma', 'mi', 'jo', 'vi', 'sâ', 'du']

const KINDS = [
  ['registration_deadline', 'înscriere', 'termen de înscriere'],
  ['submission_deadline', 'predare', 'termen de predare'],
  ['judging_deadline', 'rezultate', 'rezultate'],
]

function civilBucharest(value) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Bucharest',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(date)
  const read = (type) => Number(parts.find((part) => part.type === type)?.value)
  return { year: read('year'), month: read('month'), day: read('day') }
}

function dayKey(civil) {
  return `${civil.year}-${civil.month}-${civil.day}`
}

const WEEKS = 6
const DAY_CELLS = WEEKS * 7

function monthCells(year, month) {
  const first = new Date(Date.UTC(year, month - 1, 1, 12))
  const offset = (first.getUTCDay() + 6) % 7
  const count = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const cells = Array.from({ length: offset }, () => null)
  for (let day = 1; day <= count; day += 1) cells.push(day)
  while (cells.length < DAY_CELLS) cells.push(null)
  return cells
}

function clockTime(iso) {
  return new Intl.DateTimeFormat('ro-RO', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Bucharest',
  }).format(new Date(iso))
}

function calendarDaysBetween(from, to) {
  const start = Date.UTC(from.year, from.month - 1, from.day)
  const end = Date.UTC(to.year, to.month - 1, to.day)
  return Math.round((end - start) / 86400000)
}

function zilePhrase(days) {
  if (days === 1) return '1 zi'
  const tail = days % 100
  const de = days >= 20 && (tail === 0 || tail >= 20)
  return `${days}${de ? ' de' : ''} zile`
}

function nextStage(edition, today) {
  if (!edition || !today) return null
  let best = null
  for (const [field, label] of KINDS) {
    const civil = civilBucharest(edition[field])
    if (!civil) continue
    const days = calendarDaysBetween(today, civil)
    if (days < 0) continue
    if (!best || days < best.days) best = { days, label }
  }
  return best
}

function todayLine(label) {
  if (label === 'rezultate') return 'astăzi sunt rezultatele'
  if (label === 'predare') return 'astăzi este predarea'
  return 'astăzi este înscrierea'
}

function shiftCursor(cursor, delta) {
  const next = new Date(Date.UTC(cursor.year, cursor.month - 1 + delta, 1))
  return { year: next.getUTCFullYear(), month: next.getUTCMonth() + 1 }
}

const PANELS = [-2, -1, 0, 1, 2]

const ACTIONS = [
  {
    title: 'Încarcă lucrarea',
    text: 'Platforme acceptate: PDF, Canva',
    id: 'lucrare',
  },
  {
    title: 'Criterii jurizare',
    text: 'Citește cum poți să îți maximizezi punctajul',
  },
  {
    title: 'Resurse și tutoriale',
    text: 'Învață cum poți să…',
    id: 'resurse',
  },
]

function MonthGrid({ cursor, today, marks }) {
  const monthName = MONTHS[cursor.month - 1]
  const cells = monthCells(cursor.year, cursor.month)
  return (
    <div className="contest-cal__grid" role="group" aria-label={`${monthName} ${cursor.year}`}>
      {WEEKDAYS.map((name) => (
        <div key={name} className="contest-cal__head" aria-hidden="true">{name}</div>
      ))}
      {cells.map((day, index) => {
        if (!day) {
          return <div key={`empty-${index}`} className="contest-cal__cell is-empty" aria-hidden="true" />
        }
        const civil = { year: cursor.year, month: cursor.month, day }
        const events = marks.get(dayKey(civil)) || []
        const isToday = today.year === civil.year && today.month === civil.month && today.day === civil.day
        const tags = [
          isToday ? 'azi' : null,
          ...events.map((event) => event.label),
        ].filter(Boolean)
        const spoken = [
          `${day} ${monthName} ${cursor.year}`,
          isToday ? 'azi' : null,
          ...events.map((event) => `${event.full}, ${event.time}`),
        ].filter(Boolean).join(', ')
        return (
          <div
            key={day}
            className={['contest-cal__cell', isToday ? 'is-today' : '', events.length ? 'is-mark' : ''].filter(Boolean).join(' ')}
            aria-current={isToday ? 'date' : undefined}
            aria-label={tags.length ? spoken : undefined}
          >
            <span className="contest-cal__num">{day}</span>
            {tags.length ? (
              <span className="contest-cal__tags">
                {tags.map((tag) => <span key={tag} className="contest-cal__tag">{tag}</span>)}
              </span>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

function Chevron({ dir }) {
  const d = dir === 'prev' ? 'M14 5 L6 12 L14 19' : 'M6 5 L14 12 L6 19'
  return (
    <svg width="22" height="24" viewBox="0 0 20 24" aria-hidden="true">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function ContestCalendar({ onOpenResources, onOpenWork }) {
  const today = useMemo(() => civilBucharest(new Date()), [])
  const [cursor, setCursor] = useState(() => ({ year: today.year, month: today.month }))
  const [edition, setEdition] = useState(null)
  const viewportRef = useRef(null)
  const skipScroll = useRef(false)
  const settling = useRef(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/edition')
      .then(async (response) => {
        const data = await response.json().catch(() => null)
        if (!response.ok) return null
        return data
      })
      .then((data) => {
        if (!cancelled) setEdition(data)
      })
      .catch(() => {
        if (!cancelled) setEdition(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const marks = useMemo(() => {
    const byDay = new Map()
    if (!edition) return byDay
    for (const [field, label, full] of KINDS) {
      const civil = civilBucharest(edition[field])
      if (!civil) continue
      const key = dayKey(civil)
      const list = byDay.get(key) || []
      list.push({ label, full, time: clockTime(edition[field]) })
      byDay.set(key, list)
    }
    return byDay
  }, [edition])

  const nudge = (delta) => {
    const el = viewportRef.current
    if (!el || settling.current) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollTo({
      left: el.clientWidth * (2 + delta),
      behavior: reduce ? 'auto' : 'smooth',
    })
  }

  useLayoutEffect(() => {
    const el = viewportRef.current
    if (!el) return
    skipScroll.current = settling.current
    el.scrollLeft = el.clientWidth * 2
    settling.current = false
  }, [cursor.year, cursor.month])

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return undefined
    let timer = 0

    const commit = () => {
      if (skipScroll.current) {
        skipScroll.current = false
        return
      }
      if (settling.current) return
      const width = el.clientWidth
      if (!width) return
      const page = Math.round(el.scrollLeft / width)
      const delta = page - 2
      if (delta === 0) return
      settling.current = true
      setCursor((current) => shiftCursor(current, delta))
    }

    const onScroll = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(commit, 80)
    }

    el.addEventListener('scroll', onScroll, { passive: true })
    el.addEventListener('scrollend', commit)
    return () => {
      el.removeEventListener('scroll', onScroll)
      el.removeEventListener('scrollend', commit)
      window.clearTimeout(timer)
    }
  }, [])

  const monthName = MONTHS[cursor.month - 1]
  const upcoming = nextStage(edition, today)

  return (
    <div className="contest-cal">
      <div className="contest-cal__frame">
        <div className="contest-cal__viewport" ref={viewportRef}>
          <div className="contest-cal__track">
            {PANELS.map((offset) => (
              <div key={offset} className="contest-cal__sheet" aria-hidden={offset !== 0 || undefined}>
                <MonthGrid cursor={shiftCursor(cursor, offset)} today={today} marks={marks} />
              </div>
            ))}
          </div>
        </div>
        <button type="button" className="contest-cal__nav contest-cal__nav--prev" aria-label="luna anterioară" onClick={() => nudge(-1)}>
          <Chevron dir="prev" />
        </button>
        <button type="button" className="contest-cal__nav contest-cal__nav--next" aria-label="luna următoare" onClick={() => nudge(1)}>
          <Chevron dir="next" />
        </button>
      </div>
      <p className="contest-cal__month" aria-live="polite">
        {monthName}
        <span className="contest-cal__year">{cursor.year}</span>
      </p>
      {upcoming ? (
        <p className="contest-cal__until">
          {upcoming.days === 0 ? todayLine(upcoming.label) : (
            <>
              <span className="contest-cal__until-count">{zilePhrase(upcoming.days)}</span>
              {` până la ${upcoming.label}`}
            </>
          )}
        </p>
      ) : null}
      <div className="contest-cal__actions">
        {ACTIONS.map((action) => (
          <button
            key={action.title}
            type="button"
            className="contest-cal__action"
            onClick={action.id === 'resurse' ? onOpenResources : action.id === 'lucrare' ? onOpenWork : undefined}
          >
            <span className="contest-cal__action-title">{action.title}</span>
            <span className="contest-cal__action-text">{action.text}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
