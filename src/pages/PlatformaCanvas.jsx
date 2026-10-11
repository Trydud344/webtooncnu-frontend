import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { gsap } from 'gsap'
import './PlatformaCanvas.css'

const OPTIONS = [
  { kind: 'text', title: 'Text widget', description: 'Add a text block', mark: 'Aa' },
  { kind: 'photo', title: 'Photo widget', description: 'Add a photo', mark: '▧' },
  { kind: 'horizontal-spacer', title: 'Horizontal space', description: 'Span the full grid width', mark: '↔' },
  { kind: 'vertical-spacer', title: 'Vertical space', description: 'Span one viewer height', mark: '↕' },
]

const PHOTO_FIT_OPTIONS = [
  { value: 'contain', label: 'Fit', description: 'Zoom to fit: whole image visible' },
  { value: 'cover', label: 'Fill', description: 'Scale to fill: crop to fill the widget' },
  { value: 'fill', label: 'Stretch', description: 'Stretch to the exact widget size' },
  { value: 'none', label: 'Original', description: 'Original size, centered without scaling' },
]
const FONT_OPTIONS = [
  { value: 'default', label: 'Default', stack: undefined, weights: [], styles: [] },
  { value: 'Inter', label: 'Inter', stack: "'Inter', system-ui, sans-serif", weights: [400, 700], styles: ['normal', 'italic'] },
  { value: 'Playfair Display', label: 'Playfair Display', stack: "'Playfair Display', Georgia, serif", weights: [400, 700], styles: ['normal', 'italic'] },
  { value: 'Space Mono', label: 'Space Mono', stack: "'Space Mono', ui-monospace, monospace", weights: [400, 700], styles: ['normal', 'italic'] },
  { value: 'Caveat', label: 'Caveat', stack: "'Caveat', cursive", weights: [400, 700], styles: ['normal'] },
  { value: 'Silkscreen', label: 'Silkscreen', stack: "'Silkscreen', monospace", weights: [400, 700], styles: ['normal'] },
]
const FONT_CATEGORY_FALLBACK = {
  'sans-serif': 'sans-serif',
  serif: 'serif',
  display: 'sans-serif',
  handwriting: 'cursive',
  monospace: 'monospace',
}
const POPULAR_FONTS = [
  'Inter', 'Roboto', 'Open Sans', 'Montserrat', 'Poppins', 'Playfair Display',
  'DM Sans', 'Nunito', 'Lato', 'Oswald', 'Raleway', 'Ubuntu', 'Merriweather',
  'Bebas Neue', 'Caveat', 'Space Mono', 'JetBrains Mono', 'Fira Sans', 'Lora', 'PT Sans',
]
const FONT_PRELOAD_BATCH = 120

let fontCatalogCache = null
let fontCatalogPromise = null

function loadFontCatalog() {
  if (fontCatalogCache) return Promise.resolve(fontCatalogCache)
  if (!fontCatalogPromise) {
    fontCatalogPromise = fetch('https://api.fontsource.org/v1/fonts')
      .then((response) => {
        if (!response.ok) throw new Error('Font list failed')
        return response.json()
      })
      .then((fonts) => {
        const popularRank = new Map(POPULAR_FONTS.map((family, index) => [family, index]))
        fontCatalogCache = fonts
          .filter((font) => font.type !== 'icons' && font.category !== 'icons')
          .map((font) => ({
            family: font.family,
            category: font.category,
            weights: font.weights,
            styles: font.styles,
          }))
          .sort((a, b) => (popularRank.get(a.family) ?? Infinity) - (popularRank.get(b.family) ?? Infinity)
            || a.family.localeCompare(b.family))
        return fontCatalogCache
      })
      .catch((error) => {
        fontCatalogPromise = null
        throw error
      })
  }
  return fontCatalogPromise
}

function googleFamilyParam(family) {
  return family.split(' ').map(encodeURIComponent).join('+')
}

function fullFontUrl(entry) {
  const weights = entry?.weights?.length ? entry.weights : [400, 700]
  const base = weights.includes(400) ? 400 : weights[0]
  const picked = weights.includes(700) && 700 !== base ? [base, 700] : [base]
  const family = googleFamilyParam(entry?.family || 'Inter')
  if (entry?.styles?.includes('italic')) {
    return `https://fonts.googleapis.com/css2?family=${family}:ital,wght@${picked.map((weight) => `0,${weight};1,${weight}`).join(';')}&display=swap`
  }
  return `https://fonts.googleapis.com/css2?family=${family}:wght@${picked.join(';')}&display=swap`
}

const fullFontsLoaded = new Set()
const previewQueue = []

function ensureFullFont(family) {
  if (!family || family === 'default' || fullFontsLoaded.has(family)) return
  fullFontsLoaded.add(family)
  const entry = (fontCatalogCache || []).find((font) => font.family === family)
    || FONT_OPTIONS.find((option) => option.value === family)
    || { family, weights: [400, 700], styles: [] }
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = fullFontUrl(entry)
  document.head.appendChild(link)
}

function fontStack(family) {
  if (!family || family === 'default') return undefined
  const preset = FONT_OPTIONS.find((option) => option.value === family)
  if (preset?.stack) return preset.stack
  const entry = (fontCatalogCache || []).find((font) => font.family === family)
  return `'${family}', ${FONT_CATEGORY_FALLBACK[entry?.category] || 'sans-serif'}`
}

function FontPicker({ value, onChange }) {
  const [fonts, setFonts] = useState(() => fontCatalogCache)
  const [failed, setFailed] = useState(false)
  const [query, setQuery] = useState('')
  const listRef = useRef(null)

  useEffect(() => {
    if (fontCatalogCache) return
    let cancelled = false
    loadFontCatalog()
      .then((list) => { if (!cancelled) setFonts(list) })
      .catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true }
  }, [])

  const filtered = useMemo(() => {
    if (!fonts) return []
    const needle = query.trim().toLowerCase()
    return fonts.filter((font) => !needle || font.family.toLowerCase().includes(needle))
  }, [fonts, query])
  const groups = useMemo(() => {
    const order = ['sans-serif', 'serif', 'display', 'handwriting', 'monospace', 'other']
    return order
      .map((name) => ({ name, fonts: filtered.filter((font) => font.category === name) }))
      .filter((group) => group.fonts.length)
  }, [filtered])

  useEffect(() => {
    const list = listRef.current
    if (!list || !fonts) return
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
      while (previewQueue.length > FONT_PRELOAD_BATCH) previewQueue.shift()
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
      if (!timer) timer = setTimeout(flush, 300)
    }
    return () => {
      observer.disconnect()
      if (timer) clearTimeout(timer)
    }
  }, [filtered, fonts, value])

  if (failed) {
    return (
      <select
        className="properties-photo-fit-select"
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

  if (!fonts) return <p>Loading fonts…</p>

  return (
    <div className="font-picker">
      <input
        className="font-picker-search"
        type="search"
        placeholder="Search 2,000+ fonts…"
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
            <div className="font-picker-separator" aria-hidden="true">
              {group.name[0].toUpperCase() + group.name.slice(1)}
            </div>
            {group.fonts.map((font) => (
              <button
                key={font.family}
                type="button"
                role="option"
                aria-selected={value === font.family}
                data-font-family={font.family}
                className={`font-picker-option${value === font.family ? ' is-active' : ''}`}
                style={{ fontFamily: `'${font.family}', ${FONT_CATEGORY_FALLBACK[font.category] || 'sans-serif'}` }}
                onClick={() => onChange(font.family)}
              >
                {font.family}
              </button>
            ))}
          </div>
        ))}
      </div>
      <p className="font-picker-hint">{filtered.length} fonts · previews load as you scroll</p>
    </div>
  )
}
const GRID_PITCH = 6
const GRID_COLUMNS = 64
const GRID_VISIBLE_ROWS = 40
const GRID_VIRTUAL_WIDTH = GRID_COLUMNS * GRID_PITCH
const GRID_VIRTUAL_HEIGHT = GRID_VISIBLE_ROWS * GRID_PITCH
const MIN_WIDGET_WIDTH = 8
const MIN_WIDGET_HEIGHT = 8
const SPACER_THICKNESS = 16
const GRID_WIDGET_SIZES = {
  compact: { columns: 16, rows: 12 },
  standard: { columns: 20, rows: 16 },
  wide: { columns: 28, rows: 16 },
  feature: { columns: 32, rows: 20 },
}

function viewportInfo() {
  const width = window.innerWidth
  const height = window.innerHeight
  const userAgent = navigator.userAgent || ''
  const isMobile = /Android|iPhone|iPod|iPad|Mobile/i.test(userAgent)
    || (navigator.maxTouchPoints > 1 && Math.min(width, height) < 760)

  return {
    width,
    height,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    isMobile,
  }
}

function incompatibilityFor(viewport) {
  if (viewport.isMobile) return 'mobile'
  if (viewport.width < 1024 || viewport.height < 640) return 'small'

  const screenRatio = viewport.screenWidth / viewport.screenHeight
  if (Math.abs(screenRatio - 16 / 10) > 0.08) return 'resolution'
  return null
}

function gridDimensionsFor(size) {
  const base = GRID_WIDGET_SIZES[size] || GRID_WIDGET_SIZES.standard
  return {
    columns: Math.min(GRID_COLUMNS, base.columns),
    rows: base.rows,
  }
}

function widgetDimensions(widget) {
  if (widget.kind === 'horizontal-spacer') {
    return {
      columns: GRID_COLUMNS,
      rows: Math.max(1, Math.round(widget.spacerRows || SPACER_THICKNESS)),
    }
  }

  if (widget.kind === 'vertical-spacer') {
    return {
      columns: Math.max(1, Math.round(widget.spacerColumns || SPACER_THICKNESS)),
      rows: GRID_VISIBLE_ROWS,
    }
  }

  const base = gridDimensionsFor(widget.size)
  return {
    columns: Math.min(GRID_COLUMNS, Math.max(MIN_WIDGET_WIDTH, Math.round(base.columns * (widget.widthScale || 1)))),
    rows: Math.max(1, Math.round(base.rows * (widget.heightScale || 1))),
  }
}

function closestAspectRatioSize(widget, aspectRatio, placed) {
  const current = widgetDimensions(widget)
  const currentArea = current.columns * current.rows
  const maxWidth = Math.max(MIN_WIDGET_WIDTH, GRID_COLUMNS - widget.col)
  const minWidth = Math.min(MIN_WIDGET_WIDTH, maxWidth)
  let bestSize = current
  let bestScore = Number.POSITIVE_INFINITY

  for (let width = minWidth; width <= maxWidth; width += 1) {
    let maxHeight = Math.min(
      GRID_VISIBLE_ROWS - widget.row,
      Math.max(current.rows * 2, Math.ceil(current.columns / aspectRatio) * 2),
    )
    let blocked = false

    for (const other of placed) {
      const otherSize = widgetDimensions(other)
      const overlapsX = widget.col < other.col + otherSize.columns && widget.col + width > other.col
      if (!overlapsX) continue

      if (other.row <= widget.row && other.row + otherSize.rows > widget.row) {
        blocked = true
        break
      }
      if (other.row > widget.row) maxHeight = Math.min(maxHeight, other.row - widget.row)
    }
    if (blocked || maxHeight < MIN_WIDGET_HEIGHT) continue

    const minHeight = MIN_WIDGET_HEIGHT
    const idealHeight = width / aspectRatio
    const areaHeight = currentArea / width
    const candidateHeights = new Set([
      Math.floor(idealHeight), Math.round(idealHeight), Math.ceil(idealHeight),
      Math.floor(areaHeight), Math.round(areaHeight), Math.ceil(areaHeight),
      minHeight, maxHeight,
    ])

    for (const height of candidateHeights) {
      if (height < minHeight || height > maxHeight) continue
      const ratioError = Math.abs(Math.log((width / height) / aspectRatio))
      const areaError = Math.abs(Math.log((width * height) / currentArea))
      const score = ratioError * 3 + areaError
      if (score < bestScore) {
        bestScore = score
        bestSize = { columns: width, rows: height }
      }
    }
  }

  return bestSize
}

function clipboardImageSource(value) {
  const source = value.trim().replace(/^<|>$/g, '')
  if (source.startsWith('data:image/')) return source
  try {
    const url = new URL(source)
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null
  } catch {
    return null
  }
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error || new Error('Could not read the image from the clipboard.'))
    reader.readAsDataURL(blob)
  })
}

async function readImageFromClipboard() {
  let clipboardItems = []
  if (navigator.clipboard?.read) {
    try {
      clipboardItems = await navigator.clipboard.read()
    } catch {
      // Some browsers allow reading plain text while blocking rich clipboard data.
    }
  }

  for (const item of clipboardItems) {
    const imageType = item.types.find((type) => type.startsWith('image/'))
    if (imageType) return blobToDataUrl(await item.getType(imageType))
  }

  for (const item of clipboardItems) {
    if (item.types.includes('text/html')) {
      const html = await (await item.getType('text/html')).text()
      const document = new DOMParser().parseFromString(html, 'text/html')
      const imageSource = clipboardImageSource(document.querySelector('img')?.getAttribute('src') || '')
      if (imageSource) return imageSource
    }
    if (item.types.includes('text/plain')) {
      const imageSource = clipboardImageSource(await (await item.getType('text/plain')).text())
      if (imageSource) return imageSource
    }
  }

  if (navigator.clipboard?.readText) {
    const imageSource = clipboardImageSource(await navigator.clipboard.readText())
    if (imageSource) return imageSource
  }
  throw new Error('No image or image link found in the clipboard.')
}

function closestValidResize(widget, requestedWidth, requestedHeight, placed) {
  const currentSize = widgetDimensions(widget)
  const occupied = placed.map((other) => {
    const size = widgetDimensions(other)
    return {
      left: other.col,
      right: other.col + size.columns,
      top: other.row,
      bottom: other.row + size.rows,
    }
  })

  if (widget.kind === 'vertical-spacer') {
    const maxWidth = GRID_COLUMNS - widget.col
    const minWidth = Math.min(1, maxWidth)
    const targetWidth = Math.max(minWidth, Math.min(maxWidth, requestedWidth))
    let bestSize = currentSize
    let bestDistance = Number.POSITIVE_INFINITY

    for (let width = minWidth; width <= targetWidth; width += 1) {
      const right = widget.col + width
      const overlaps = occupied.some((other) => {
        const overlapsX = widget.col < other.right && right > other.left
        const overlapsY = widget.row < other.bottom && widget.row + currentSize.rows > other.top
        return overlapsX && overlapsY
      })
      if (overlaps) continue

      const distance = (targetWidth - width) ** 2
      if (distance < bestDistance) {
        bestDistance = distance
        bestSize = { columns: width, rows: currentSize.rows }
      }
    }

    return bestSize
  }

  const maxWidth = widget.kind === 'horizontal-spacer'
    ? GRID_COLUMNS
    : GRID_COLUMNS - widget.col
  const minWidth = widget.kind === 'horizontal-spacer'
    ? GRID_COLUMNS
    : Math.min(MIN_WIDGET_WIDTH, maxWidth)
  const targetWidth = widget.kind === 'horizontal-spacer'
    ? GRID_COLUMNS
    : Math.max(minWidth, Math.min(maxWidth, requestedWidth))
  const minHeight = widget.kind === 'horizontal-spacer' ? 1 : MIN_WIDGET_HEIGHT
  const targetHeight = Math.max(minHeight, Math.min(GRID_VISIBLE_ROWS - widget.row, requestedHeight))
  let bestSize = currentSize
  let bestDistance = Number.POSITIVE_INFINITY
  for (let width = minWidth; width <= targetWidth; width += 1) {
    const right = widget.col + width
    let maxHeight = Math.min(targetHeight, GRID_VISIBLE_ROWS - widget.row)

    for (const other of occupied) {
      const overlapsX = widget.col < other.right && right > other.left
      if (!overlapsX) continue

      if (other.top <= widget.row && other.bottom > widget.row) {
        maxHeight = 0
        break
      }
      if (other.top > widget.row) maxHeight = Math.min(maxHeight, other.top - widget.row)
    }

    const height = maxHeight
    if (height < minHeight) continue
    const widthDelta = targetWidth - width
    const heightDelta = targetHeight - height
    const distance = widthDelta * widthDelta + heightDelta * heightDelta
    if (distance < bestDistance) {
      bestDistance = distance
      bestSize = { columns: width, rows: height }
    }
  }

  return bestSize
}

function fits(widget, col, row, placed) {
  const { columns: width, rows: height } = widgetDimensions(widget)
  if (col < 0 || row < 0 || col + width > GRID_COLUMNS || row + height > GRID_VISIBLE_ROWS) return false

  return placed.every((other) => {
    const otherSize = widgetDimensions(other)
    const overlapsX = col < other.col + otherSize.columns && col + width > other.col
    const overlapsY = row < other.row + otherSize.rows && row + height > other.row
    return !overlapsX || !overlapsY
  })
}

function firstAvailablePosition(widget, placed) {
  const { columns: width, rows: height } = widgetDimensions(widget)
  for (let row = 0; row <= GRID_VISIBLE_ROWS - height; row += 1) {
    for (let col = 0; col <= GRID_COLUMNS - width; col += 1) {
      if (fits(widget, col, row, placed)) return { col, row }
    }
  }
  return null
}

function nearestAvailablePosition(widget, placed, targetCol, targetRow) {
  const { columns: width, rows: height } = widgetDimensions(widget)
  const maxCol = GRID_COLUMNS - width
  const lastOccupiedRow = placed.reduce((lastRow, item) => {
    return Math.max(lastRow, item.row + widgetDimensions(item).rows)
  }, 0)
  const lastSearchRow = Math.min(GRID_VISIBLE_ROWS - height, Math.max(0, Math.ceil(targetRow), lastOccupiedRow) + 1)
  let closestPosition = null
  let closestDistance = Number.POSITIVE_INFINITY

  for (let row = 0; row <= lastSearchRow; row += 1) {
    for (let col = 0; col <= maxCol; col += 1) {
      if (!fits(widget, col, row, placed)) continue

      const dx = col - targetCol
      const dy = row - targetRow
      const distance = dx * dx + dy * dy
      if (distance < closestDistance) {
        closestDistance = distance
        closestPosition = { col, row }
      }
    }
  }

  return closestPosition || firstAvailablePosition(widget, placed)
}

function nearestGroupTranslation(group, placed, requestedColDelta, requestedRowDelta) {
  const bounds = group.reduce((result, widget) => {
    const size = widgetDimensions(widget)
    return {
      minColDelta: Math.max(result.minColDelta, -widget.col),
      maxColDelta: Math.min(result.maxColDelta, GRID_COLUMNS - widget.col - size.columns),
      minRowDelta: Math.max(result.minRowDelta, -widget.row),
      maxRowDelta: Math.min(result.maxRowDelta, GRID_VISIBLE_ROWS - widget.row - size.rows),
    }
  }, {
    minColDelta: Number.NEGATIVE_INFINITY,
    maxColDelta: Number.POSITIVE_INFINITY,
    minRowDelta: Number.NEGATIVE_INFINITY,
    maxRowDelta: Number.POSITIVE_INFINITY,
  })
  let bestDelta = { col: 0, row: 0 }
  let bestDistance = Number.POSITIVE_INFINITY

  for (let colDelta = bounds.minColDelta; colDelta <= bounds.maxColDelta; colDelta += 1) {
    for (let rowDelta = bounds.minRowDelta; rowDelta <= bounds.maxRowDelta; rowDelta += 1) {
      const fitsWithoutOverlap = group.every((widget) => fits(
        widget,
        widget.col + colDelta,
        widget.row + rowDelta,
        placed,
      ))
      if (!fitsWithoutOverlap) continue

      const distance = (colDelta - requestedColDelta) ** 2 + (rowDelta - requestedRowDelta) ** 2
      if (distance < bestDistance) {
        bestDistance = distance
        bestDelta = { col: colDelta, row: rowDelta }
      }
    }
  }

  return bestDelta
}

function horizontalAnchorForPosition(col, width) {
  if (col <= 0) return { horizontalAnchor: 'left', horizontalAnchorPoint: 0 }
  if (col + width >= GRID_COLUMNS) return { horizontalAnchor: 'right', horizontalAnchorPoint: 1 }
  return {
    horizontalAnchor: 'relative',
    horizontalAnchorPoint: (col + width / 2) / GRID_COLUMNS,
  }
}

function columnFromHorizontalAnchor(widget, width) {
  const maxColumn = Math.max(0, GRID_COLUMNS - width)
  if (widget.kind === 'horizontal-spacer' || widget.horizontalAnchor === 'left') return 0
  if (widget.horizontalAnchor === 'right') return maxColumn
  if (widget.horizontalAnchor === 'relative' && Number.isFinite(widget.horizontalAnchorPoint)) {
    return Math.max(0, Math.min(maxColumn, Math.round(widget.horizontalAnchorPoint * GRID_COLUMNS - width / 2)))
  }
  return Math.max(0, Math.min(maxColumn, widget.col || 0))
}

function withPositionAnchor(widget, position) {
  const positioned = { ...widget, ...position }
  const size = widgetDimensions(positioned)
  return {
    ...positioned,
    ...horizontalAnchorForPosition(position.col, size.columns),
  }
}

function edgeOffset(edge, size, axis) {
  if (axis === 'x') return edge === 'right' ? size.columns : 0
  return edge === 'bottom' ? size.rows : 0
}

function withWidgetAnchors(widgets) {
  const anchorsById = new Map(widgets.map((widget) => [widget.id, []]))

  for (let firstIndex = 0; firstIndex < widgets.length; firstIndex += 1) {
    const first = widgets[firstIndex]
    const firstSize = widgetDimensions(first)
    const firstRight = first.col + firstSize.columns
    const firstBottom = first.row + firstSize.rows
    for (let secondIndex = firstIndex + 1; secondIndex < widgets.length; secondIndex += 1) {
      const second = widgets[secondIndex]
      const secondSize = widgetDimensions(second)
      const secondRight = second.col + secondSize.columns
      const secondBottom = second.row + secondSize.rows
      const verticalOverlap = first.row < secondBottom && firstBottom > second.row
      const horizontalOverlap = first.col < secondRight && firstRight > second.col
      const xEdgesTouch = firstRight === second.col || secondRight === first.col
      const yEdgesTouch = firstBottom === second.row || secondBottom === first.row
      let firstAnchor = null
      let secondAnchor = null

      if (xEdgesTouch && verticalOverlap) {
        const firstEdge = firstRight === second.col ? 'right' : 'left'
        const secondEdge = firstRight === second.col ? 'left' : 'right'
        firstAnchor = { x: { edge: firstEdge, otherEdge: secondEdge } }
        secondAnchor = { x: { edge: secondEdge, otherEdge: firstEdge } }
      } else if (yEdgesTouch && horizontalOverlap) {
        const firstEdge = firstBottom === second.row ? 'bottom' : 'top'
        const secondEdge = firstBottom === second.row ? 'top' : 'bottom'
        firstAnchor = { y: { edge: firstEdge, otherEdge: secondEdge } }
        secondAnchor = { y: { edge: secondEdge, otherEdge: firstEdge } }
      } else if (xEdgesTouch && yEdgesTouch) {
        const firstXEdge = firstRight === second.col ? 'right' : 'left'
        const secondXEdge = firstRight === second.col ? 'left' : 'right'
        const firstYEdge = firstBottom === second.row ? 'bottom' : 'top'
        const secondYEdge = firstBottom === second.row ? 'top' : 'bottom'
        firstAnchor = {
          x: { edge: firstXEdge, otherEdge: secondXEdge },
          y: { edge: firstYEdge, otherEdge: secondYEdge },
        }
        secondAnchor = {
          x: { edge: secondXEdge, otherEdge: firstXEdge },
          y: { edge: secondYEdge, otherEdge: firstYEdge },
        }
      }

      if (firstAnchor && secondAnchor) {
        anchorsById.get(first.id).push({
          widgetId: second.id,
          ...firstAnchor,
        })
        anchorsById.get(second.id).push({
          widgetId: first.id,
          ...secondAnchor,
        })
      }
    }
  }

  return widgets.map((widget) => ({ ...widget, widgetAnchors: anchorsById.get(widget.id) }))
}

function connectedWidgetIds(widgetId, widgets) {
  const availableIds = new Set(widgets.map((widget) => widget.id))
  const ids = new Set([widgetId])
  const pending = [widgetId]
  while (pending.length) {
    const current = widgets.find((widget) => widget.id === pending.pop())
    for (const anchor of current?.widgetAnchors || []) {
      if (!availableIds.has(anchor.widgetId) || ids.has(anchor.widgetId)) continue
      ids.add(anchor.widgetId)
      pending.push(anchor.widgetId)
    }
  }
  return ids
}

function moveAnchoredGroup(widgets, rootId) {
  const groupIds = connectedWidgetIds(rootId, widgets)
  if (groupIds.size < 2) return widgets

  const root = widgets.find((widget) => widget.id === rootId)
  const outside = widgets.filter((widget) => !groupIds.has(widget.id))
  if (!fits(root, root.col, root.row, outside)) return null

  const positioned = new Map([[rootId, root]])
  const placed = [...outside, root]
  const pending = [root]

  while (pending.length) {
    const source = pending.shift()
    const sourceSize = widgetDimensions(source)
    for (const anchor of source.widgetAnchors || []) {
      if (!groupIds.has(anchor.widgetId)) continue
      const target = widgets.find((widget) => widget.id === anchor.widgetId)
      const targetPosition = { col: target.col, row: target.row }
      const targetSize = widgetDimensions(target)
      if (anchor.x) {
        targetPosition.col = source.col
          + edgeOffset(anchor.x.edge, sourceSize, 'x')
          - edgeOffset(anchor.x.otherEdge, targetSize, 'x')
      }
      if (anchor.y) {
        targetPosition.row = source.row
          + edgeOffset(anchor.y.edge, sourceSize, 'y')
          - edgeOffset(anchor.y.otherEdge, targetSize, 'y')
      }
      const position = targetPosition

      if (positioned.has(target.id)) {
        const current = positioned.get(target.id)
        if (current.col !== position.col || current.row !== position.row) return null
        continue
      }
      if (!fits(target, position.col, position.row, placed)) {
        return null
      }

      const anchored = withPositionAnchor(target, position)
      positioned.set(target.id, anchored)
      placed.push(anchored)
      pending.push(anchored)
    }
  }

  if (positioned.size !== groupIds.size) return null
  return widgets.map((widget) => positioned.get(widget.id) || widget)
}

export default function PlatformaCanvas() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [propertiesOpen, setPropertiesOpen] = useState(false)
  const [viewport, setViewport] = useState(viewportInfo)
  const [widgets, setWidgets] = useState([])
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [draggingIds, setDraggingIds] = useState([])
  const [selectionBox, setSelectionBox] = useState(null)
  const [holdingSize, setHoldingSize] = useState(null)
  const [dropFlash, setDropFlash] = useState(null)
  const incompatibility = incompatibilityFor(viewport)
  const stageWidth = Math.max(0, Math.min(viewport.width - 48, (viewport.height - 48) * GRID_COLUMNS / GRID_VISIBLE_ROWS))
  const stageHeight = stageWidth * GRID_VISIBLE_ROWS / GRID_COLUMNS
  const stageScale = stageWidth / GRID_VIRTUAL_WIDTH
  const plusRef = useRef(null)
  const propertiesMorphRef = useRef(null)
  const propertiesGlyphRef = useRef(null)
  const propertiesContentRef = useRef(null)
  const propertiesCloseRef = useRef(null)
  const propertiesTimelineRef = useRef(null)
  const propertiesOpenRef = useRef(false)
  const optionRefs = useRef([])
  const stageRef = useRef(null)
  const widgetRefs = useRef({})
  const dragRef = useRef(null)
  const dropFlashKeyRef = useRef(0)
  const selectionDragRef = useRef(null)
  const resizeRef = useRef(null)
  const flipOriginRef = useRef(null)
  const skipFlipIdsRef = useRef(new Set())
  const lastAddedIdRef = useRef(null)
  const nextWidgetIdRef = useRef(1)
  const captureWidgetRects = () => {
    const rects = {}
    Object.entries(widgetRefs.current).forEach(([id, element]) => {
      if (!element) return
      const rect = element.getBoundingClientRect()
      rects[id] = {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      }
    })
    return rects
  }

  useEffect(() => {
    const handleResize = () => setViewport(viewportInfo())
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => () => propertiesTimelineRef.current?.kill(), [])

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key !== 'Escape') return

      const selectionDrag = selectionDragRef.current
      if (selectionDrag) {
        const grid = stageRef.current?.querySelector('.masonry-grid')
        try {
          if (grid?.hasPointerCapture(selectionDrag.pointerId)) {
            grid.releasePointerCapture(selectionDrag.pointerId)
          }
        } catch {
          // The pointer may already have been released by the browser.
        }
        selectionDragRef.current = null
      }

      const drag = dragRef.current
      if (drag) {
        drag.elements.forEach((element) => gsap.set(element, { clearProps: 'transform,zIndex' }))
        const element = widgetRefs.current[drag.id]
        try {
          if (element?.hasPointerCapture(drag.pointerId)) element.releasePointerCapture(drag.pointerId)
        } catch {
          // The pointer may already have been released by the browser.
        }
        dragRef.current = null
      }

      const resize = resizeRef.current
      if (resize) {
        if (resize.frameId !== null) cancelAnimationFrame(resize.frameId)
        resize.element.classList.remove('is-resizing')
        resize.element.style.removeProperty('width')
        resize.element.style.removeProperty('height')
        resizeRef.current = null
      }

      setSelectionBox(null)
      setSelectedIds(new Set())
      setDraggingIds([])
      setHoldingSize(null)
      setMenuOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    const items = optionRefs.current.filter(Boolean)
    const timeline = gsap.timeline()

    if (menuOpen) {
      timeline
        .to(plusRef.current, {
          rotation: 45,
          duration: 0.32,
          ease: 'back.out(1.7)',
        })
        .fromTo(
          items,
          { autoAlpha: 0, y: 18, scale: 0.9 },
          {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            duration: 0.38,
            ease: 'back.out(1.6)',
            stagger: { each: 0.07, from: 'end' },
          },
          0,
        )
    } else {
      timeline
        .to(plusRef.current, {
          rotation: 0,
          duration: 0.24,
          ease: 'power2.out',
        })
        .to(
          items,
          {
            autoAlpha: 0,
            y: 10,
            scale: 0.94,
            duration: 0.18,
            ease: 'power2.in',
            stagger: { each: 0.035, from: 'start' },
          },
          0,
        )
    }

    return () => timeline.kill()
  }, [menuOpen])

  useLayoutEffect(() => {
    const origins = flipOriginRef.current
    const addedId = lastAddedIdRef.current
    const skipFlipIds = skipFlipIdsRef.current
    flipOriginRef.current = null
    lastAddedIdRef.current = null
    skipFlipIdsRef.current = new Set()

    widgets.forEach((widget) => {
      const element = widgetRefs.current[widget.id]
      if (!element) return

      const origin = origins && origins[widget.id]
      if (origin && !skipFlipIds.has(widget.id)) {
        const rect = element.getBoundingClientRect()
        const dx = (origin.left - rect.left) / stageScale
        const dy = (origin.top - rect.top) / stageScale
        const sizeChanged = Math.abs(origin.width - rect.width) > 1 || Math.abs(origin.height - rect.height) > 1
        if (Math.abs(dx) > 1 || Math.abs(dy) > 1 || sizeChanged) {
          const from = { x: dx, y: dy }
          const to = {
            x: 0,
            y: 0,
            duration: 0.42,
            ease: 'power3.out',
            clearProps: 'transform',
          }
          if (Math.abs(origin.width - rect.width) > 1) {
            from.width = origin.width / stageScale
            to.width = rect.width / stageScale
            to.clearProps += ',width'
          }
          if (Math.abs(origin.height - rect.height) > 1) {
            from.height = origin.height / stageScale
            to.height = rect.height / stageScale
            to.clearProps += ',height'
          }
          gsap.fromTo(
            element,
            from,
            to,
          )
        }
      } else if (widget.id === addedId) {
        gsap.fromTo(
          element,
          { autoAlpha: 0, scale: 0.92, y: 22 },
          {
            autoAlpha: 1,
            scale: 1,
            y: 0,
            duration: 0.42,
            ease: 'back.out(1.3)',
            clearProps: 'transform,opacity,visibility',
          },
        )
      }
    })
  }, [widgets, stageScale])

  const addWidget = (kind) => {
    const id = `widget-${nextWidgetIdRef.current}`
    const isSpacer = kind === 'horizontal-spacer' || kind === 'vertical-spacer'
    const size = isSpacer ? undefined : 'compact'
    nextWidgetIdRef.current += 1
    flipOriginRef.current = captureWidgetRects()
    lastAddedIdRef.current = id
    setWidgets((current) => {
      const widget = { id, kind, size, ...(kind === 'photo' ? { photoFit: 'contain' } : null) }
      const position = firstAvailablePosition(widget, current)
      if (!position) {
        flipOriginRef.current = null
        lastAddedIdRef.current = null
        return current
      }
      const nextWidgets = [
        ...current,
        withPositionAnchor(widget, position),
      ]
      return withWidgetAnchors(nextWidgets)
    })
    setMenuOpen(false)
  }

  const deleteWidget = (widgetId) => {
    setSelectedIds((current) => {
      if (!current.has(widgetId)) return current
      const next = new Set(current)
      next.delete(widgetId)
      return next
    })
    setWidgets((current) => withWidgetAnchors(
      current.filter((item) => item.id !== widgetId),
    ))
  }

  const toggleWidgetSelection = (widgetId) => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(widgetId)) next.delete(widgetId)
      else next.add(widgetId)
      return next
    })
  }

  const selectWidgetFromContent = (event, widget) => {
    event.stopPropagation()
    if (event.shiftKey || event.metaKey || event.ctrlKey) {
      toggleWidgetSelection(widget.id)
    } else if (!selectedIds.has(widget.id)) {
      setSelectedIds(new Set([widget.id]))
    }
  }

  const toggleProperties = (event) => {
    const isOpening = !propertiesOpenRef.current
    const openedByKeyboard = isOpening && event?.detail === 0
    propertiesOpenRef.current = isOpening
    setPropertiesOpen(isOpening)

    propertiesTimelineRef.current?.kill()
    const morph = propertiesMorphRef.current
    const glyph = propertiesGlyphRef.current
    const content = propertiesContentRef.current
    if (!morph || !glyph || !content) return

    const width = isOpening ? Math.min(320, window.innerWidth - 48) : 60
    const height = isOpening ? Math.min(520, window.innerHeight - 48) : 60
    const duration = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0.01 : 0.48
    if (isOpening) {
      gsap.set(content, { autoAlpha: 0, y: 10 })
    }
    const timeline = gsap.timeline({
      onComplete: () => {
        if (!isOpening) {
          gsap.set(morph, { clearProps: 'width,height,borderRadius' })
          morph.focus()
        } else if (openedByKeyboard) {
          propertiesCloseRef.current?.focus()
        }
      },
    })
    timeline.to(morph, {
      width,
      height,
      borderRadius: isOpening ? 20 : 30,
      duration,
      ease: 'power3.inOut',
    }, 0)
    timeline.to(glyph, {
      autoAlpha: isOpening ? 0 : 1,
      scale: isOpening ? 0.8 : 1,
      duration: duration * 0.35,
      ease: 'power2.out',
    }, isOpening ? duration * 0.12 : duration * 0.55)
    timeline.to(content, {
      autoAlpha: isOpening ? 1 : 0,
      y: isOpening ? 0 : 10,
      duration: duration === 0.01 ? 0.01 : isOpening ? 0.18 : 0.16,
      ease: isOpening ? 'power2.out' : 'power2.in',
    }, isOpening ? duration : 0)
    propertiesTimelineRef.current = timeline
  }

  const pasteImageIntoWidget = async (widget) => {
    setWidgets((current) => current.map((item) => item.id === widget.id
      ? { ...item, isPasting: true, pasteStatus: '' }
      : item))
    try {
      const imageSrc = await readImageFromClipboard()
      setWidgets((current) => current.map((item) => item.id === widget.id
        ? { ...item, imageSrc, imageAspect: null, isPasting: false, pasteStatus: 'Loading image…' }
        : item))
    } catch (error) {
      setWidgets((current) => current.map((item) => item.id === widget.id
        ? {
            ...item,
            isPasting: false,
            pasteStatus: error?.message || 'Could not read an image from the clipboard.',
          }
        : item))
    }
  }

  const fitImageAspect = (widget) => {
    if (!widget.imageAspect) return
    const connectedIds = connectedWidgetIds(widget.id, widgets)
    const others = widgets.filter((item) => item.id !== widget.id && !connectedIds.has(item.id))
    const currentSize = widgetDimensions(widget)
    const size = closestAspectRatioSize(
      widget,
      widget.imageAspect,
      others,
    )
    if (size.columns !== currentSize.columns || size.rows !== currentSize.rows) {
      commitWidgetResize(widget, size.columns, size.rows)
    }
  }

  const startDrag = (event, widget) => {
    if (event.button !== 0) return
    if (event.target.closest('button')) return

    if (event.shiftKey || event.metaKey || event.ctrlKey) {
      event.preventDefault()
      toggleWidgetSelection(widget.id)
      return
    }

    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    const selected = selectedIds.has(widget.id)
      ? new Set(selectedIds)
      : new Set([widget.id])
    if (!selectedIds.has(widget.id)) setSelectedIds(selected)

    const movingIds = new Set([...selected].filter((id) => widgets.some((item) => item.id === id)))
    const elements = [...movingIds]
      .map((id) => widgetRefs.current[id])
      .filter(Boolean)
    elements.forEach((element) => {
      gsap.killTweensOf(element, 'filter')
      element.style.removeProperty('filter')
    })
    setHoldingSize(widget.size || 'standard')
    dragRef.current = {
      id: widget.id,
      ids: [...movingIds],
      elements,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    }
  }

  const commitWidgetResize = (widget, width, height, shouldAnimate = true) => {
    const hasWidgetAttachments = connectedWidgetIds(widget.id, widgets).size > 1
    flipOriginRef.current = shouldAnimate || hasWidgetAttachments ? captureWidgetRects() : null
    skipFlipIdsRef.current = !shouldAnimate && hasWidgetAttachments
      ? new Set([widget.id])
      : new Set()
    setWidgets((current) => {
      const original = current.find((item) => item.id === widget.id)
      if (!original) return current

      const connectedIds = connectedWidgetIds(widget.id, current)
      const resizeAt = (requestedWidth, requestedHeight, obstacles) => {
        let resized = original
        if (original.kind === 'horizontal-spacer') {
          resized = { ...original, spacerRows: requestedHeight }
        } else if (original.kind === 'vertical-spacer') {
          resized = { ...original, spacerColumns: requestedWidth }
        } else {
          const base = gridDimensionsFor(original.size)
          resized = {
            ...original,
            widthScale: requestedWidth / base.columns,
            heightScale: requestedHeight / base.rows,
          }
        }

        const size = widgetDimensions(resized)
        const currentSize = widgetDimensions(original)
        const anchor = original.horizontalAnchor
          ? {
              horizontalAnchor: original.horizontalAnchor,
              horizontalAnchorPoint: original.horizontalAnchorPoint,
            }
          : horizontalAnchorForPosition(original.col, currentSize.columns)
        const targetCol = columnFromHorizontalAnchor({ ...resized, ...anchor }, size.columns)
        const position = fits(resized, targetCol, original.row, obstacles)
          ? { col: targetCol, row: original.row }
          : nearestAvailablePosition(resized, obstacles, targetCol, original.row)
        return {
          ...resized,
          ...position,
          ...anchor,
        }
      }

      const connectedObstacles = current.filter((item) => item.id !== widget.id && !connectedIds.has(item.id))
      const resizedWidget = resizeAt(width, height, connectedObstacles)
      const proposed = current.map((item) => item.id === widget.id ? resizedWidget : item)
      const attached = moveAnchoredGroup(proposed, widget.id)
      if (attached) return withWidgetAnchors(attached)

      const allOthers = current.filter((item) => item.id !== widget.id)
      const safeSize = closestValidResize(
        original,
        width,
        height,
        allOthers,
      )
      const safeWidget = resizeAt(safeSize.columns, safeSize.rows, allOthers)
      return withWidgetAnchors(current.map((item) => item.id === widget.id ? safeWidget : item))
    })
  }

  const startResize = (event, widget) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)

    const element = widgetRefs.current[widget.id]
    const rect = element.getBoundingClientRect()
    const size = widgetDimensions(widget)
    const connectedIds = connectedWidgetIds(widget.id, widgets)
    resizeRef.current = {
      id: widget.id,
      pointerId: event.pointerId,
      left: rect.left,
      top: rect.top,
      grabRight: event.clientX - rect.right,
      grabBottom: event.clientY - rect.bottom,
      width: size.columns,
      height: size.rows,
      moved: false,
      pointerX: event.clientX,
      pointerY: event.clientY,
      frameId: null,
      element,
      others: widgets.filter((item) => item.id !== widget.id && !connectedIds.has(item.id)),
    }
    element.classList.add('is-resizing')
    element.style.width = `${size.columns * GRID_PITCH}px`
    element.style.height = `${size.rows * GRID_PITCH}px`
    setHoldingSize(widget.size || 'standard')
  }

  const applyResize = (resize, widget) => {
    const displayPitch = GRID_PITCH * stageScale
    const requestedWidth = Math.round((resize.pointerX - resize.grabRight - resize.left) / displayPitch)
    const requestedHeight = Math.round((resize.pointerY - resize.grabBottom - resize.top) / displayPitch)
    const size = closestValidResize(
      widget,
      requestedWidth,
      requestedHeight,
      resize.others,
    )
    if (size.columns === resize.width && size.rows === resize.height) return

    resize.width = size.columns
    resize.height = size.rows
    resize.moved = true
    resize.element.style.width = `${size.columns * GRID_PITCH}px`
    resize.element.style.height = `${size.rows * GRID_PITCH}px`
  }

  const moveResize = (event, widget) => {
    const resize = resizeRef.current
    if (!resize || resize.id !== widget.id || resize.pointerId !== event.pointerId) return

    resize.pointerX = event.clientX
    resize.pointerY = event.clientY
    if (resize.frameId !== null) return

    resize.frameId = requestAnimationFrame(() => {
      if (resizeRef.current !== resize) return
      resize.frameId = null
      applyResize(resize, widget)
    })
  }

  const finishResize = (event, widget) => {
    const resize = resizeRef.current
    if (!resize || resize.id !== widget.id || resize.pointerId !== event.pointerId) return
    event.stopPropagation()
    if (resize.frameId !== null) cancelAnimationFrame(resize.frameId)
    resize.frameId = null
    applyResize(resize, widget)
    resizeRef.current = null
    if (resize.moved) commitWidgetResize(widget, resize.width, resize.height, false)
    resize.element.classList.remove('is-resizing')
    resize.element.style.removeProperty('width')
    resize.element.style.removeProperty('height')
    setHoldingSize(null)
  }

  const cancelResize = (event, widget) => {
    const resize = resizeRef.current
    if (!resize || resize.id !== widget.id || resize.pointerId !== event.pointerId) return
    event.stopPropagation()
    if (resize.frameId !== null) cancelAnimationFrame(resize.frameId)
    resizeRef.current = null
    resize.element.classList.remove('is-resizing')
    resize.element.style.removeProperty('width')
    resize.element.style.removeProperty('height')
    setHoldingSize(null)
  }

  const resizeWithKeyboard = (event, widget) => {
    const changes = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    }
    const change = changes[event.key]
    if (!change) return
    if (widget.kind === 'horizontal-spacer' && change[0] !== 0) return
    if (widget.kind === 'vertical-spacer' && change[1] !== 0) return
    event.preventDefault()

    const current = widgetDimensions(widget)
    const connectedIds = connectedWidgetIds(widget.id, widgets)
    const others = widgets.filter((item) => item.id !== widget.id && !connectedIds.has(item.id))
    const size = closestValidResize(
      widget,
      current.columns + change[0],
      current.rows + change[1],
      others,
    )
    if (size.columns !== current.columns || size.rows !== current.rows) {
      commitWidgetResize(widget, size.columns, size.rows)
    }
  }

  const pointOnGrid = (event) => {
    const stage = stageRef.current
    if (!stage) return { x: 0, y: 0 }
    const rect = stage.getBoundingClientRect()
    return {
      x: Math.max(0, Math.min(GRID_VIRTUAL_WIDTH, (event.clientX - rect.left) / stageScale)),
      y: Math.max(0, Math.min(GRID_VIRTUAL_HEIGHT, (event.clientY - rect.top) / stageScale)),
    }
  }

  const updateSelectionDrag = (event) => {
    const selectionDrag = selectionDragRef.current
    if (!selectionDrag || selectionDrag.pointerId !== event.pointerId) return
    const point = pointOnGrid(event)
    if (!selectionDrag.moved && Math.hypot(point.x - selectionDrag.startX, point.y - selectionDrag.startY) < 4) return

    selectionDrag.moved = true
    selectionDrag.currentX = point.x
    selectionDrag.currentY = point.y
    const left = Math.min(selectionDrag.startX, point.x)
    const top = Math.min(selectionDrag.startY, point.y)
    const right = Math.max(selectionDrag.startX, point.x)
    const bottom = Math.max(selectionDrag.startY, point.y)
    setSelectionBox({ left, top, width: right - left, height: bottom - top })

    const nextSelection = new Set(selectionDrag.baseIds)
    widgets.forEach((item) => {
      const size = widgetDimensions(item)
      const itemLeft = item.col * GRID_PITCH
      const itemTop = item.row * GRID_PITCH
      const itemRight = itemLeft + size.columns * GRID_PITCH
      const itemBottom = itemTop + size.rows * GRID_PITCH
      const intersects = left <= itemRight && right >= itemLeft
        && top <= itemBottom && bottom >= itemTop
      if (intersects) nextSelection.add(item.id)
    })
    setSelectedIds(nextSelection)
  }

  const startSelectionDrag = (event) => {
    if (event.button !== 0 || event.target !== event.currentTarget) return
    event.preventDefault()
    const point = pointOnGrid(event)
    const additive = event.shiftKey || event.metaKey || event.ctrlKey
    const baseIds = additive ? new Set(selectedIds) : new Set()
    if (!additive) setSelectedIds(new Set())
    event.currentTarget.setPointerCapture(event.pointerId)
    selectionDragRef.current = {
      pointerId: event.pointerId,
      startX: point.x,
      startY: point.y,
      currentX: point.x,
      currentY: point.y,
      baseIds,
      additive,
      moved: false,
    }
  }

  const finishSelectionDrag = (event) => {
    const selectionDrag = selectionDragRef.current
    if (!selectionDrag || selectionDrag.pointerId !== event.pointerId) return
    updateSelectionDrag(event)
    selectionDragRef.current = null
    setSelectionBox(null)
    if (!selectionDrag.moved && !selectionDrag.additive) setSelectedIds(new Set())
  }

  const moveDrag = (event, widget) => {
    const drag = dragRef.current
    if (!drag || drag.id !== widget.id || drag.pointerId !== event.pointerId) return

    const dx = event.clientX - drag.startX
    const dy = event.clientY - drag.startY
    if (!drag.moved && Math.hypot(dx, dy) < 4) return

    if (!drag.moved) {
      drag.moved = true
      setDraggingIds(drag.ids)
    }

    drag.elements.forEach((element) => {
      gsap.set(element, { x: dx / stageScale, y: dy / stageScale, zIndex: 5 })
    })
  }

  const finishDrag = (event, widget) => {
    const drag = dragRef.current
    if (!drag || drag.id !== widget.id || drag.pointerId !== event.pointerId) return
    dragRef.current = null
    setHoldingSize(null)

    if (!drag.moved) return

    const dx = (event.clientX - drag.startX) / stageScale
    const dy = (event.clientY - drag.startY) / stageScale
    drag.elements.forEach((element) => {
      gsap.set(element, { x: dx, y: dy, zIndex: 5 })
    })
    flipOriginRef.current = captureWidgetRects()
    drag.elements.forEach((element) => gsap.set(element, { clearProps: 'transform,zIndex' }))
    if (!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      const point = pointOnGrid(event)
      const size = widgetDimensions(widget)
      dropFlashKeyRef.current += 1
      setDropFlash({
        key: dropFlashKeyRef.current,
        x: point.x,
        y: point.y,
        width: size.columns * GRID_PITCH,
        height: size.rows * GRID_PITCH,
      })
    }

    const displayPitch = GRID_PITCH * stageScale
    const targetColDelta = Math.round((event.clientX - drag.startX) / displayPitch)
    const targetRowDelta = Math.round((event.clientY - drag.startY) / displayPitch)
    const movingIds = new Set(drag.ids)

    setWidgets((current) => {
      const moving = current.filter((item) => movingIds.has(item.id))
      if (!moving.length) return current
      const others = current.filter((item) => !movingIds.has(item.id))
      const delta = nearestGroupTranslation(
        moving,
        others,
        targetColDelta,
        targetRowDelta,
      )
      const movedById = new Map(moving.map((item) => [
        item.id,
        withPositionAnchor(item, { col: item.col + delta.col, row: item.row + delta.row }),
      ]))
      const positioned = current.map((item) => movedById.get(item.id) || item)
      return withWidgetAnchors(positioned)
    })
    setDraggingIds([])
  }

  const cancelDrag = (event, widget) => {
    const drag = dragRef.current
    if (!drag || drag.id !== widget.id || drag.pointerId !== event.pointerId) return
    setHoldingSize(null)

    if (drag.moved) {
      finishDrag(event, widget)
      return
    }

    dragRef.current = null
    setDraggingIds([])
  }

  const selectedWidgets = widgets.filter((item) => selectedIds.has(item.id))
  const selectedPhotoWidgets = selectedWidgets.filter((item) => item.kind === 'photo')
  const activePhotoFit = selectedPhotoWidgets.length
    ? selectedPhotoWidgets.every((item) => (item.photoFit || 'contain') === (selectedPhotoWidgets[0].photoFit || 'contain'))
      ? (selectedPhotoWidgets[0].photoFit || 'contain')
      : null
    : null

  const setPhotoFitForSelected = (value) => {
    if (!selectedPhotoWidgets.length) return
    const ids = new Set(selectedPhotoWidgets.map((item) => item.id))
    setWidgets((current) => current.map((item) => ids.has(item.id)
      ? { ...item, photoFit: value }
      : item))
  }

  const selectedTextWidgets = selectedWidgets.filter((item) => item.kind === 'text')
  const activeFontSize = selectedTextWidgets.length
    ? selectedTextWidgets.every((item) => (item.fontSize || 'auto') === (selectedTextWidgets[0].fontSize || 'auto'))
      ? (selectedTextWidgets[0].fontSize || 'auto')
      : null
    : null
  const activeTextAlign = selectedTextWidgets.length
    ? selectedTextWidgets.every((item) => (item.textAlign || 'left') === (selectedTextWidgets[0].textAlign || 'left'))
      ? (selectedTextWidgets[0].textAlign || 'left')
      : null
    : null

  const setFontSizeForSelected = (value) => {
    if (!selectedTextWidgets.length) return
    const ids = new Set(selectedTextWidgets.map((item) => item.id))
    setWidgets((current) => current.map((item) => ids.has(item.id)
      ? { ...item, fontSize: value === 'auto' ? undefined : Number(value) }
      : item))
  }

  const setTextAlignForSelected = (value) => {
    if (!selectedTextWidgets.length) return
    const ids = new Set(selectedTextWidgets.map((item) => item.id))
    setWidgets((current) => current.map((item) => ids.has(item.id)
      ? { ...item, textAlign: value }
      : item))
  }

  const activeVerticalAlign = selectedTextWidgets.length
    ? selectedTextWidgets.every((item) => (item.verticalAlign || 'top') === (selectedTextWidgets[0].verticalAlign || 'top'))
      ? (selectedTextWidgets[0].verticalAlign || 'top')
      : null
    : null

  const setVerticalAlignForSelected = (value) => {
    if (!selectedTextWidgets.length) return
    const ids = new Set(selectedTextWidgets.map((item) => item.id))
    setWidgets((current) => current.map((item) => ids.has(item.id)
      ? { ...item, verticalAlign: value }
      : item))
  }

  const allBold = selectedTextWidgets.length > 0 && selectedTextWidgets.every((item) => item.bold)
  const allItalic = selectedTextWidgets.length > 0 && selectedTextWidgets.every((item) => item.italic)
  const allUnderline = selectedTextWidgets.length > 0 && selectedTextWidgets.every((item) => item.underline)

  const toggleTextStyleForSelected = (field) => {
    if (!selectedTextWidgets.length) return
    const ids = new Set(selectedTextWidgets.map((item) => item.id))
    const enable = !selectedTextWidgets.every((item) => item[field])
    setWidgets((current) => current.map((item) => ids.has(item.id)
      ? { ...item, [field]: enable || undefined }
      : item))
  }

  const activeFont = selectedTextWidgets.length
    ? selectedTextWidgets.every((item) => (item.font || 'default') === (selectedTextWidgets[0].font || 'default'))
      ? (selectedTextWidgets[0].font || 'default')
      : null
    : null

  const setFontForSelected = (value) => {
    if (!selectedTextWidgets.length) return
    const ids = new Set(selectedTextWidgets.map((item) => item.id))
    setWidgets((current) => current.map((item) => ids.has(item.id)
      ? { ...item, font: value === 'default' ? undefined : value }
      : item))
  }

  const handleFontChange = (value) => {
    ensureFullFont(value)
    setFontForSelected(value)
  }

  return (
    <div className={`platforma-canvas${incompatibility ? ' is-incompatible' : ''}`}>
      {incompatibility ? (
        <div className="platforma-incompatibility" role="alert">
          <h1>
            {incompatibility === 'mobile'
              ? 'This page is not compatible with mobile.'
              : incompatibility === 'small'
                ? 'This window is too small for the page.'
                : 'This page is not compatible with your screen resolution.'}
          </h1>
          <p>
            {incompatibility === 'mobile'
              ? 'Open Platforma on a desktop display.'
              : incompatibility === 'small'
                ? 'Use a desktop window at least 1024 × 640 pixels.'
                : 'Platforma requires a display close to a 16:10 aspect ratio.'}
          </p>
        </div>
      ) : (
        <>
          <div
            ref={stageRef}
            className="platforma-stage"
            style={{ width: `${stageWidth}px`, height: `${stageHeight}px` }}
          >
            <div
              className="masonry-grid"
              style={{
                '--grid-columns': GRID_COLUMNS,
                '--snap-pitch': `${GRID_PITCH}px`,
                '--snap-dot-offset': `${-GRID_PITCH / 2}px`,
                '--snap-dot-radius': `${1.8 / stageScale}px`,
                '--snap-dot-cutoff': `${2 / stageScale}px`,
                width: `${GRID_VIRTUAL_WIDTH}px`,
                minHeight: `${GRID_VIRTUAL_HEIGHT}px`,
                transform: `scale(${stageScale})`,
              }}
              aria-label="Widget canvas"
              onPointerDown={startSelectionDrag}
              onPointerMove={updateSelectionDrag}
              onPointerUp={finishSelectionDrag}
              onPointerCancel={finishSelectionDrag}
            >
              <div
                className={`snap-dot-grid${holdingSize ? ' is-visible' : ''}`}
                aria-hidden="true"
                style={{
                  width: `${(GRID_COLUMNS + 1) * GRID_PITCH}px`,
                  height: `${GRID_VIRTUAL_HEIGHT}px`,
                }}
              />
              {dropFlash && (
                <div
                  key={dropFlash.key}
                  className="drop-flash"
                  aria-hidden="true"
                  style={{
                    left: `${dropFlash.x - dropFlash.width / 2}px`,
                    top: `${dropFlash.y - dropFlash.height / 2}px`,
                    width: `${dropFlash.width}px`,
                    height: `${dropFlash.height}px`,
                  }}
                  onAnimationEnd={() => setDropFlash((current) => (current?.key === dropFlash.key ? null : current))}
                />
              )}
              {selectionBox && (
                <div
                  className="selection-marquee"
                  aria-hidden="true"
                  style={{
                    left: `${selectionBox.left}px`,
                    top: `${selectionBox.top}px`,
                    width: `${selectionBox.width}px`,
                    height: `${selectionBox.height}px`,
                  }}
                />
              )}
              {widgets.map((widget) => {
                const size = widgetDimensions(widget)
                const horizontalSpacer = widget.kind === 'horizontal-spacer'
                const verticalSpacer = widget.kind === 'vertical-spacer'
                const isSpacer = horizontalSpacer || verticalSpacer
                const isSelected = selectedIds.has(widget.id)
                const isDragging = draggingIds.includes(widget.id)
                const widgetLabel = horizontalSpacer
                  ? 'Horizontal spacer'
                  : verticalSpacer
                    ? 'Vertical spacer'
                    : `${widget.kind} widget`
                return (
                  <div
                    key={widget.id}
                    ref={(node) => {
                      if (node) widgetRefs.current[widget.id] = node
                      else delete widgetRefs.current[widget.id]
                    }}
                    className={`canvas-widget${widget.kind === 'photo' ? ' is-photo' : ''}${isSpacer ? ` is-spacer is-${widget.kind}` : ''}${isSelected ? ' is-selected' : ''}${isDragging ? ' is-dragging' : ''}`}
                    style={{
                      '--widget-ui-scale': 1 / stageScale,
                      '--widget-inset-small': `${5 / stageScale}px`,
                      '--widget-inset-medium': `${7 / stageScale}px`,
                      '--widget-display-width': `${size.columns * GRID_PITCH * stageScale}px`,
                      '--widget-display-height': `${size.rows * GRID_PITCH * stageScale}px`,
                      '--widget-text-inset': `${8 / stageScale}px`,
                      '--text-widget-font-size': `${Math.max(4, Math.min(28, Math.sqrt(size.columns * size.rows) * GRID_PITCH * 0.045))}px`,
                      '--selection-ring-width': `${1.5 / stageScale}px`,
                      gridColumn: `${widget.col + 1} / span ${size.columns}`,
                      gridRow: `${widget.row + 1} / span ${size.rows}`,
                    }}
                    role="group"
                    aria-label={`${widgetLabel}${isSelected ? ', selected' : ''}. Drag to reposition.`}
                    tabIndex={0}
                    onPointerDown={(event) => startDrag(event, widget)}
                    onPointerMove={(event) => moveDrag(event, widget)}
                    onPointerUp={(event) => finishDrag(event, widget)}
                    onPointerCancel={(event) => cancelDrag(event, widget)}
                  >
                    {isSpacer && (
                      <span className="widget-spacer-label" aria-hidden="true">{widgetLabel}</span>
                    )}
                    {widget.kind === 'text' && (
                      <div
                        className="text-widget-body"
                        style={{
                          justifyContent: widget.verticalAlign === 'middle'
                            ? 'center'
                            : widget.verticalAlign === 'bottom'
                              ? 'flex-end'
                              : 'flex-start',
                        }}
                      >
                      <textarea
                        className="text-widget-editor"
                        aria-label="Text widget content"
                        placeholder="Write something…"
                        value={widget.text || ''}
                        spellCheck="true"
                        style={{
                          ...(widget.fontSize ? { fontSize: `${widget.fontSize}px` } : null),
                          textAlign: widget.textAlign || 'left',
                          fontWeight: widget.bold ? 'bold' : undefined,
                          fontStyle: widget.italic ? 'italic' : undefined,
                          textDecoration: widget.underline ? 'underline' : undefined,
                          fontFamily: fontStack(widget.font),
                        }}
                        onPointerDown={(event) => selectWidgetFromContent(event, widget)}
                        onChange={(event) => {
                          const text = event.target.value
                          setWidgets((current) => current.map((item) => item.id === widget.id
                            ? { ...item, text }
                            : item))
                        }}
                      />
                      </div>
                    )}
                    {widget.kind === 'photo' && (
                      <div className="photo-widget-content">
                        {widget.imageSrc ? (
                          <img
                            className="photo-widget-image"
                            src={widget.imageSrc}
                            alt=""
                            draggable="false"
                            style={{ objectFit: widget.photoFit || 'contain' }}
                            onLoad={(event) => {
                              const { naturalWidth, naturalHeight } = event.currentTarget
                              if (!naturalWidth || !naturalHeight) return
                              setWidgets((current) => current.map((item) => item.id === widget.id
                                && item.imageSrc === widget.imageSrc
                                ? { ...item, imageAspect: naturalWidth / naturalHeight, pasteStatus: '' }
                                : item))
                            }}
                            onError={() => {
                              setWidgets((current) => current.map((item) => item.id === widget.id
                                && item.imageSrc === widget.imageSrc
                                ? { ...item, imageAspect: null, pasteStatus: 'This image could not be loaded.' }
                                : item))
                            }}
                          />
                        ) : (
                          <span className="photo-widget-empty">Paste an image or image link</span>
                        )}
                        <div className="photo-widget-controls" onPointerDown={(event) => selectWidgetFromContent(event, widget)}>
                          <button
                            className="photo-widget-button"
                            type="button"
                            aria-label="Paste image from clipboard"
                            disabled={widget.isPasting}
                            title="Paste an image file or image link from your clipboard"
                            onClick={() => pasteImageIntoWidget(widget)}
                          >
                            {widget.isPasting ? 'Pasting…' : 'Paste image'}
                          </button>
                          <button
                            className="photo-widget-button"
                            type="button"
                            aria-label="Resize widget to match image aspect ratio"
                            disabled={!widget.imageAspect || widget.isPasting}
                            title="Resize this widget to the closest grid shape for the image, near its current size"
                            onClick={() => fitImageAspect(widget)}
                          >
                            Ratio
                          </button>
                        </div>
                        {widget.pasteStatus && (
                          <span className="photo-widget-status" role="status" aria-live="polite">
                            {widget.pasteStatus}
                          </span>
                        )}
                      </div>
                    )}
                    <button
                      className="widget-delete-button"
                      type="button"
                      aria-label={`Delete ${widgetLabel.toLowerCase()}`}
                      title={`Delete ${widgetLabel.toLowerCase()}`}
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={() => deleteWidget(widget.id)}
                    >
                      <span aria-hidden="true">×</span>
                    </button>
                    <button
                      className="widget-resize-handle"
                      type="button"
                      aria-label={horizontalSpacer
                        ? 'Resize horizontal spacer thickness'
                        : verticalSpacer
                          ? 'Resize vertical spacer thickness'
                          : 'Resize widget'}
                      title={horizontalSpacer
                        ? 'Drag vertically to adjust spacing · Use up and down arrows'
                        : verticalSpacer
                          ? 'Drag horizontally to adjust spacing · Use left and right arrows'
                          : 'Drag to resize · Use arrow keys to resize'}
                      onPointerDown={(event) => startResize(event, widget)}
                      onPointerMove={(event) => moveResize(event, widget)}
                      onPointerUp={(event) => finishResize(event, widget)}
                      onPointerCancel={(event) => cancelResize(event, widget)}
                      onKeyDown={(event) => resizeWithKeyboard(event, widget)}
                    />
                  </div>
                )
              })}
            </div>
          </div>

          {selectedIds.size > 0 && (
            <div className="selection-status" role="status" aria-live="polite">
              <strong>{selectedIds.size} selected</strong>
              <span>Shift-click to toggle · drag empty canvas to select · drag a selected widget to move the group · Esc clears</span>
            </div>
          )}

      <div
        id="widget-menu"
        className="widget-menu"
        role="group"
        aria-label="Choose a widget"
        aria-hidden={!menuOpen}
      >
        {OPTIONS.map((option, index) => (
          <button
            className="widget-option"
            type="button"
            key={option.kind}
            ref={(node) => { optionRefs.current[index] = node }}
            tabIndex={menuOpen ? 0 : -1}
            onClick={() => addWidget(option.kind)}
          >
            <span className="widget-option-mark" aria-hidden="true">{option.mark}</span>
            <span className="widget-option-copy">
              <strong>{option.title}</strong>
              <small>{option.description}</small>
            </span>
          </button>
        ))}
      </div>

      <div className="properties-panel-shell">
        <button
          ref={propertiesMorphRef}
          className="properties-panel-morph"
          type="button"
          aria-label={propertiesOpen ? 'Properties panel' : 'Open properties'}
          aria-expanded={propertiesOpen}
          aria-controls="properties-panel-content"
          title={propertiesOpen ? 'Properties panel' : 'Open properties'}
          onClick={toggleProperties}
        >
          <svg ref={propertiesGlyphRef} className="platforma-properties-glyph" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 7h5m4 0h7M4 17h9m4 0h3" />
            <circle cx="11" cy="7" r="2" />
            <circle cx="15" cy="17" r="2" />
          </svg>
        </button>
        <section
          ref={propertiesContentRef}
          id="properties-panel-content"
          className="properties-panel-content"
          aria-hidden={!propertiesOpen}
          aria-label="Properties for selected elements"
        >
          <div className="properties-panel-scroll">
          <header className="properties-panel-header">
            <div>
              <h2>Properties</h2>
              <p>For selected elements</p>
            </div>
            <button
              ref={propertiesCloseRef}
              className="properties-panel-close"
              type="button"
              aria-label="Close properties panel"
              onClick={toggleProperties}
            >
              <span aria-hidden="true">×</span>
            </button>
          </header>
          <div className="properties-selection-count" aria-live="polite">
            <strong>{selectedIds.size}</strong>
            <span>{selectedIds.size === 1 ? 'element selected' : 'elements selected'}</span>
          </div>
          {selectedPhotoWidgets.length > 0 && (
            <div className="properties-section">
              <h3>Image scaling</h3>
              {selectedPhotoWidgets.length > 1 && (
                <p>{`Applies to ${selectedPhotoWidgets.length} photo widgets.`}</p>
              )}
              <select
                id="photo-fit-select"
                className="properties-photo-fit-select"
                value={activePhotoFit || ''}
                aria-label="Image scaling"
                onChange={(event) => setPhotoFitForSelected(event.target.value)}
              >
                {activePhotoFit === null && (
                  <option value="" disabled>Mixed…</option>
                )}
                {PHOTO_FIT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value} title={option.description}>
                    {option.label} — {option.description}
                  </option>
                ))}
              </select>
            </div>
          )}
          {selectedTextWidgets.length > 0 && (
            <div className="properties-section">
              <h3>Text</h3>
              {selectedTextWidgets.length > 1 && (
                <p>{`Applies to ${selectedTextWidgets.length} text widgets.`}</p>
              )}
              <select
                id="text-font-size-select"
                className="properties-photo-fit-select"
                value={activeFontSize === null ? '' : String(activeFontSize)}
                aria-label="Font size"
                onChange={(event) => setFontSizeForSelected(event.target.value)}
              >
                {activeFontSize === null && (
                  <option value="" disabled>Mixed…</option>
                )}
                <option value="auto">Auto — fits the widget size</option>
                {[8, 10, 12, 14, 16, 20, 24, 32].map((fontSize) => (
                  <option key={fontSize} value={String(fontSize)}>{fontSize}px</option>
                ))}
              </select>
              <select
                id="text-align-select"
                className="properties-photo-fit-select"
                value={activeTextAlign || ''}
                aria-label="Text alignment"
                onChange={(event) => setTextAlignForSelected(event.target.value)}
              >
                {activeTextAlign === null && (
                  <option value="" disabled>Mixed…</option>
                )}
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </select>
              <FontPicker value={activeFont || 'default'} onChange={handleFontChange} />
              <select
                id="text-vertical-align-select"                className="properties-photo-fit-select"
                value={activeVerticalAlign || ''}
                aria-label="Vertical alignment"
                onChange={(event) => setVerticalAlignForSelected(event.target.value)}
              >
                {activeVerticalAlign === null && (
                  <option value="" disabled>Mixed…</option>
                )}
                <option value="top">Top</option>
                <option value="middle">Middle</option>
                <option value="bottom">Bottom</option>
              </select>
              <div className="properties-style-row" role="group" aria-label="Text style">
                <button
                  className="properties-style-toggle"
                  type="button"
                  aria-pressed={allBold}
                  aria-label="Bold"
                  title="Bold"
                  onClick={() => toggleTextStyleForSelected('bold')}
                >
                  B
                </button>
                <button
                  className="properties-style-toggle is-italic"
                  type="button"
                  aria-pressed={allItalic}
                  aria-label="Italic"
                  title="Italic"
                  onClick={() => toggleTextStyleForSelected('italic')}
                >
                  I
                </button>
                <button
                  className="properties-style-toggle is-underline"
                  type="button"
                  aria-pressed={allUnderline}
                  aria-label="Underline"
                  title="Underline"
                  onClick={() => toggleTextStyleForSelected('underline')}
                >
                  U
                </button>
              </div>
            </div>
          )}
          {selectedPhotoWidgets.length === 0 && selectedTextWidgets.length === 0 && (
            <p className="properties-panel-placeholder">
              {selectedWidgets.length > 0
                ? 'Select a photo or text widget to change its properties.'
                : 'Property controls will appear here.'}
            </p>
          )}
          </div>
        </section>
      </div>

      <button
        className="platforma-add-button"
        type="button"
        aria-label={menuOpen ? 'Close widget menu' : 'Add a widget'}
        aria-expanded={menuOpen}
        aria-controls="widget-menu"
        onClick={() => setMenuOpen((open) => !open)}
      >
        <span ref={plusRef} className="platforma-add-glyph" aria-hidden="true">+</span>
      </button>
        </>
      )}
    </div>
  )
}
