import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { Colorful } from '@uiw/react-color'
import FontPicker from '../components/FontPicker'
import PropertiesPanel, { PropertySlider } from '../components/PropertiesPanel'
import TextWidgetEditor from '../components/TextWidgetEditor'
import YouTubeBackgroundAudio, { parseYouTubeId } from '../components/YouTubeBackgroundAudio'
import { ensureFullFont, fontStack } from '../fonts'
import './PlatformaCanvas.css'

const OPTIONS = [
  { kind: 'text', title: 'Text widget', description: 'Add a text block', mark: 'Aa' },
  { kind: 'photo', title: 'Photo widget', description: 'Add a photo', mark: '▧' },
]

const PHOTO_FIT_OPTIONS = [
  { value: 'contain', label: 'Fit', description: 'Zoom to fit: whole image visible' },
  { value: 'cover', label: 'Fill', description: 'Scale to fill: crop to fill the widget' },
  { value: 'fill', label: 'Stretch', description: 'Stretch to the exact widget size' },
  { value: 'none', label: 'Original', description: 'Original size, centered without scaling' },
]

const BG_FIT_OPTIONS = [
  ...PHOTO_FIT_OPTIONS,
  { value: 'tile', label: 'Tile', description: 'Repeat the image edge to edge' },
]

const GRID_PITCH = 6
const GRID_COLUMNS = 64
const GRID_VISIBLE_ROWS = 40
const GRID_VIRTUAL_WIDTH = GRID_COLUMNS * GRID_PITCH
const GRID_VIRTUAL_HEIGHT = GRID_VISIBLE_ROWS * GRID_PITCH
const MIN_WIDGET_WIDTH = 8
const MIN_WIDGET_HEIGHT = 8
// Gutter around every widget, in grid units. Applied as a margin so the grid
// tracks themselves stay `gap: 0` and the col/row pixel math is unchanged.
const DEFAULT_WIDGET_GAP = 2
const DEFAULT_WIDGET_RADIUS = 6
// Ranges for the Appearance sliders.
const WIDGET_GAP_INPUT = { min: 0, max: 6, step: 1 }
const WIDGET_RADIUS_INPUT = { min: 0, max: 20, step: 1 }
// Shared empty set: handing React the same reference back means "nothing is being
// dragged" never causes a re-render of its own.
const NO_IDS = new Set()
// The colour a widget starts with: `--surface`, the same card colour the buttons
// and the panel use. Kept in sync with the CSS fallback in PlatformaCanvas.css.
const DEFAULT_BG_COLOR = '#2a1415'
// Card colour while a photo backdrop is set: the gray the whole UI flips to.
const GRAY_BG_COLOR = '#2b2b2b'
// Page backdrop default: `var(--bg)`, kept in sync with index.css.
const DEFAULT_PAGE_BG_COLOR = '#6f1a1f'
// Tile edge in px, in stage space, when the background photo repeats.
const DEFAULT_BG_TILE_SIZE = 64
// Below this the canvas, the panel and the add button stop fitting together.
const MIN_VIEWPORT_WIDTH = 640
const MIN_VIEWPORT_HEIGHT = 420
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

  return { width, height, isMobile }
}

// Any window with room for the canvas plus the panel and the add button is fair
// game, whatever its shape: the stage is scaled to fit the space it is given.
function incompatibilityFor(viewport) {
  if (viewport.isMobile) return 'mobile'
  if (viewport.width < MIN_VIEWPORT_WIDTH || viewport.height < MIN_VIEWPORT_HEIGHT) return 'small'
  return null
}

function gridDimensionsFor(size) {
  const base = GRID_WIDGET_SIZES[size] || GRID_WIDGET_SIZES.standard
  return {
    columns: Math.min(GRID_COLUMNS, base.columns),
    rows: base.rows,
  }
}

// Widgets are immutable: every update spreads a new object rather than mutating
// one. That lets the size a widget resolves to be cached on the object itself,
// which matters because the placement helpers below ask for it inside their
// inner loops. The result never depends on the viewport or the stage scale.
const widgetSizeCache = new WeakMap()

function widgetDimensions(widget) {
  const cached = widgetSizeCache.get(widget)
  if (cached) return cached

  const size = computeWidgetDimensions(widget)
  widgetSizeCache.set(widget, size)
  return size
}

function computeWidgetDimensions(widget) {
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

// Geometry fields a live resize owns. Live commits merge only these onto the
// current widgets, so an unrelated update landing mid-resize (an image
// finishing loading, say) is never clobbered by a stale session snapshot.
const RESIZE_GEOMETRY_KEYS = ['col', 'row', 'widthScale', 'heightScale', 'horizontalAnchor', 'horizontalAnchorPoint', 'widgetAnchors']

// Live-resize placement: grow the widget to the requested size and push
// overlapping neighbours out of the way instead of clamping around them.
// Returns the next widget list, or null when anything has nowhere to go.
function pushedWidgetsForResize(current, widget, requestedWidth, requestedHeight) {
  const original = current.find((item) => item.id === widget.id)
  if (!original) return null

  const base = gridDimensionsFor(original.size)
  const resized = {
    ...original,
    widthScale: requestedWidth / base.columns,
    heightScale: requestedHeight / base.rows,
  }

  const size = widgetDimensions(resized)
  // A corner grip implies the opposite corner stays put: the left edge is
  // pinned like the top one, whatever the widget's anchor says. Letting the
  // anchor re-seat the widget mid-gesture moved the wrong edge — most
  // visibly shrinking right after touching the canvas edge, when the left
  // edge jumped instead of the grabbed corner following the pointer.
  const maxColumn = Math.max(0, GRID_COLUMNS - size.columns)
  const targetCol = Math.min(original.col, maxColumn)
  const placed = withPositionAnchor(resized, { col: targetCol, row: original.row })

  const rectOf = (col, row, dims) => ({
    left: col, right: col + dims.columns, top: row, bottom: row + dims.rows,
  })
  const overlaps = (first, second) => first.left < second.right
    && first.right > second.left && first.top < second.bottom && first.bottom > second.top
  const placedRect = rectOf(placed.col, placed.row, size)

  const touches = (item) => item.id !== original.id
    && overlaps(placedRect, rectOf(item.col, item.row, widgetDimensions(item)))

  // Push only, never pull: when the grown rect touches nothing, nobody moves
  // but the resized widget — followers stay where a previous push left them
  // instead of sliding back to keep edge contact.
  if (!current.some(touches)) {
    return withWidgetAnchors(current.map((item) => (item.id === original.id ? placed : item)))
  }

  // Every overlapped neighbour is pushed to its nearest free spot, attached
  // or not. Resize only ever pushes, so anchor followers need no special
  // casing — and special-casing them is what wrongly blocked growth when a
  // follower linked only by chain had nowhere anchor-shaped to go.
  const movedById = new Map()
  const obstaclesFor = (excludeId) => [
    placed,
    ...movedById.values(),
    ...current.filter((item) => item.id !== original.id && item.id !== excludeId && !movedById.has(item.id)),
  ]

  const overlapped = current.filter((item) => touches(item))
  for (const other of overlapped) {
    const spot = nearestAvailablePosition(other, obstaclesFor(other.id), other.col, other.row)
    if (!spot) return null
    movedById.set(other.id, withPositionAnchor(other, spot))
  }

  const proposed = current.map((item) => {
    if (item.id === original.id) return placed
    return movedById.get(item.id) || item
  })
  const next = withWidgetAnchors(proposed)

  // Safety net: single-pass placement can still collide in exotic orderings,
  // so verify every pair before accepting the push.
  for (const item of next) {
    if (!fits(item, item.col, item.row, next.filter((other) => other.id !== item.id))) return null
  }
  return next
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

  const maxWidth = GRID_COLUMNS - widget.col
  const minWidth = Math.min(MIN_WIDGET_WIDTH, maxWidth)
  const targetWidth = Math.max(minWidth, Math.min(maxWidth, requestedWidth))
  const minHeight = MIN_WIDGET_HEIGHT
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
  if (widget.horizontalAnchor === 'left') return 0
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
  // Indexed once: the lookup used to scan the widget list on every hop.
  const byId = new Map(widgets.map((widget) => [widget.id, widget]))
  const ids = new Set([widgetId])
  const pending = [widgetId]
  while (pending.length) {
    const current = byId.get(pending.pop())
    for (const anchor of current?.widgetAnchors || []) {
      if (ids.has(anchor.widgetId) || !byId.has(anchor.widgetId)) continue
      ids.add(anchor.widgetId)
      pending.push(anchor.widgetId)
    }
  }
  return ids
}

// A selection is only worth a re-render when its membership actually changed.
function sameIds(first, second) {
  if (first === second) return true
  if (first.size !== second.size) return false
  for (const id of first) {
    if (!second.has(id)) return false
  }
  return true
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
  const [viewport, setViewport] = useState(viewportInfo)
  const [widgets, setWidgets] = useState([])
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [draggingIds, setDraggingIds] = useState(NO_IDS)
  const [marqueeActive, setMarqueeActive] = useState(false)
  const [holdingSize, setHoldingSize] = useState(null)
  const [widgetGap, setWidgetGap] = useState(DEFAULT_WIDGET_GAP)
  const [widgetRadius, setWidgetRadius] = useState(DEFAULT_WIDGET_RADIUS)
  const [pageBackground, setPageBackground] = useState({
    type: 'color',
    color: DEFAULT_PAGE_BG_COLOR,
    imageSrc: null,
    fit: 'cover',
    tileSize: DEFAULT_BG_TILE_SIZE,
  })
  const [pageBgIsPasting, setPageBgIsPasting] = useState(false)
  const [pageBgPasteStatus, setPageBgPasteStatus] = useState('')
  const [pageMusic, setPageMusic] = useState({ url: '', videoId: null, playing: false, volume: 80 })
  const [musicStatus, setMusicStatus] = useState('')

  // Typing never autoplays: the press on Play is the gesture audio needs.
  const handleMusicUrlChange = (value) => {
    const videoId = parseYouTubeId(value)
    setPageMusic((prev) => ({ ...prev, url: value, videoId, playing: false }))
    setMusicStatus(value.trim() && !videoId ? 'Not a YouTube link.' : '')
  }
  const incompatibility = incompatibilityFor(viewport)
  const stageWidth = Math.max(0, Math.min(viewport.width - 48, (viewport.height - 48) * GRID_COLUMNS / GRID_VISIBLE_ROWS))
  const stageHeight = stageWidth * GRID_VISIBLE_ROWS / GRID_COLUMNS
  const stageScale = stageWidth / GRID_VIRTUAL_WIDTH
  const plusRef = useRef(null)
  const optionRefs = useRef([])
  const stageRef = useRef(null)
  const widgetRefs = useRef({})
  const dragRef = useRef(null)
  const selectionDragRef = useRef(null)
  const resizeRef = useRef(null)
  const flipOriginRef = useRef(null)
  const skipFlipIdsRef = useRef(new Set())
  const lastAddedIdRef = useRef(null)
  const nextWidgetIdRef = useRef(1)
  const marqueeRef = useRef(null)
  const marqueeBoxRef = useRef(null)
  const marqueeFrameRef = useRef(null)
  const stageRectRef = useRef(null)
  const widgetRefCallbacks = useRef(new Map())
  // Mirrors the selection for the callbacks that memoized children hold on to, so
  // they act on the selection as it is now instead of the one they were born with.
  const selectionRef = useRef(selectedIds)
  useLayoutEffect(() => {
    selectionRef.current = selectedIds
  }, [selectedIds])

  // The marquee is dragged at pointer rate, so its geometry goes straight to the
  // element: a state update per move re-rendered the canvas and the panel.
  const paintMarquee = useCallback(() => {
    marqueeFrameRef.current = null
    const box = marqueeBoxRef.current
    const element = marqueeRef.current
    if (!box || !element) return
    element.style.left = `${box.left}px`
    element.style.top = `${box.top}px`
    element.style.width = `${box.width}px`
    element.style.height = `${box.height}px`
  }, [])

  const queueMarqueePaint = useCallback(() => {
    if (marqueeFrameRef.current !== null) return
    marqueeFrameRef.current = requestAnimationFrame(paintMarquee)
  }, [paintMarquee])

  const clearMarquee = useCallback(() => {
    marqueeBoxRef.current = null
    if (marqueeFrameRef.current !== null) {
      cancelAnimationFrame(marqueeFrameRef.current)
      marqueeFrameRef.current = null
    }
    setMarqueeActive(false)
  }, [])

  // The marquee mounts on the first move past the threshold; paint it in the same
  // commit, before the browser gets a chance to show an unsized box.
  useLayoutEffect(() => {
    if (marqueeActive) paintMarquee()
  }, [marqueeActive, paintMarquee])

  // One callback per widget id. An inline arrow changes identity on every render,
  // which makes React detach and re-attach every widget ref along with it.
  const widgetRefCallback = (id) => {
    let callback = widgetRefCallbacks.current.get(id)
    if (!callback) {
      callback = (node) => {
        if (node) widgetRefs.current[id] = node
        else delete widgetRefs.current[id]
      }
      widgetRefCallbacks.current.set(id, callback)
    }
    return callback
  }

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
    // Once per frame: resize fires in bursts, and each one re-renders the canvas.
    let frameId = null
    const applyViewport = () => {
      frameId = null
      stageRectRef.current = null
      setViewport(viewportInfo())
    }
    const handleResize = () => {
      if (frameId !== null) return
      frameId = requestAnimationFrame(applyViewport)
    }
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      if (frameId !== null) cancelAnimationFrame(frameId)
    }
  }, [])

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
        clearMarquee()
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

      if (resizeRef.current) cleanupResize(resizeRef.current)

      clearMarquee()
      setSelectedIds((current) => (current.size ? new Set() : current))
      setDraggingIds(NO_IDS)
      setHoldingSize(null)
      setMenuOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [clearMarquee])

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

    const flips = []
    const additions = []

    // Every rect is read before anything is written: measuring one element and
    // then animating the next flushed layout once per widget.
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
          flips.push({ element, from, to })
        }
      } else if (widget.id === addedId) {
        additions.push(element)
      }
    })

    flips.forEach(({ element, from, to }) => {
      gsap.fromTo(element, from, to)
    })
    additions.forEach((element) => {
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
    })
  }, [widgets, stageScale])

  const addWidget = (kind) => {
    const id = `widget-${nextWidgetIdRef.current}`
    nextWidgetIdRef.current += 1
    flipOriginRef.current = captureWidgetRects()
    lastAddedIdRef.current = id
    setWidgets((current) => {
      const widget = { id, kind, size: 'compact', ...(kind === 'photo' ? { photoFit: 'contain' } : null) }
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
    widgetRefCallbacks.current.delete(widgetId)
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
    } else if (!selectionRef.current.has(widget.id)) {
      setSelectedIds(new Set([widget.id]))
    }
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

  const pastePageBackgroundImage = async () => {
    if (pageBgIsPasting) return
    setPageBgIsPasting(true)
    setPageBgPasteStatus('')
    try {
      const imageSrc = await readImageFromClipboard()
      setPageBackground((prev) => ({ ...prev, imageSrc }))
      setPageBgIsPasting(false)
    } catch (error) {
      setPageBgIsPasting(false)
      setPageBgPasteStatus(error?.message || 'Could not read an image from the clipboard.')
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
    // One setter per element for the whole drag: `gsap.set` per pointermove built
    // a fresh tween every time.
    const setters = elements.map((element) => ({
      x: gsap.quickSetter(element, 'x', 'px'),
      y: gsap.quickSetter(element, 'y', 'px'),
    }))
    setHoldingSize(widget.size || 'standard')
    dragRef.current = {
      id: widget.id,
      ids: [...movingIds],
      elements,
      setters,
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
        const base = gridDimensionsFor(original.size)
        const resized = {
          ...original,
          widthScale: requestedWidth / base.columns,
          heightScale: requestedHeight / base.rows,
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

  // One teardown for every resize exit: pointerup, cancel, Escape, or a new
  // press landing while a stale session is still armed. A missed pointerup
  // (released off-canvas) used to leave a zombie session that kept resizing
  // on hover, so the session tracks on window and every exit detaches it.
  const cleanupResize = (resize) => {
    if (!resize) return
    if (resize.frameId !== null) cancelAnimationFrame(resize.frameId)
    window.removeEventListener('pointermove', resize.onMove)
    window.removeEventListener('pointerup', resize.onUp)
    window.removeEventListener('pointercancel', resize.onCancel)
    resizeRef.current = null
    resize.element.classList.remove('is-resizing')
    resize.element.style.removeProperty('width')
    resize.element.style.removeProperty('height')
  }

  const startResize = (event, widget) => {
    if (event.button !== 0) return
    if (resizeRef.current) cleanupResize(resizeRef.current)
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)

    const element = widgetRefs.current[widget.id]
    const rect = element.getBoundingClientRect()
    const size = widgetDimensions(widget)
    const session = {
      id: widget.id,
      pointerId: event.pointerId,
      left: rect.left,
      top: rect.top,
      col: widget.col,
      grabRight: event.clientX - rect.right,
      grabBottom: event.clientY - rect.bottom,
      width: size.columns,
      height: size.rows,
      pointerX: event.clientX,
      pointerY: event.clientY,
      frameId: null,
      element,
      base: widgets,
    }
    // Button-level move/up miss anything outside the button when capture is
    // lost, so the session tracks on window until it ends.
    session.onMove = (moveEvent) => moveResize(moveEvent, widget)
    session.onUp = (upEvent) => finishResize(upEvent, widget)
    session.onCancel = (cancelEvent) => cancelResize(cancelEvent, widget)
    resizeRef.current = session
    window.addEventListener('pointermove', session.onMove)
    window.addEventListener('pointerup', session.onUp)
    window.addEventListener('pointercancel', session.onCancel)
    element.classList.add('is-resizing')
    element.style.width = `${size.columns * GRID_PITCH - 2 * widgetGap}px`
    element.style.height = `${size.rows * GRID_PITCH - 2 * widgetGap}px`
    setHoldingSize(widget.size || 'standard')
  }

  const applyResize = (resize, widget) => {
    const displayPitch = GRID_PITCH * stageScale
    const maxWidth = GRID_COLUMNS - resize.col
    const minWidth = Math.min(MIN_WIDGET_WIDTH, maxWidth)
    const minHeight = MIN_WIDGET_HEIGHT
    const requestedWidth = Math.max(minWidth, Math.min(maxWidth, Math.round((resize.pointerX - resize.grabRight - resize.left) / displayPitch)))
    const requestedHeight = Math.max(
      minHeight,
      Math.min(GRID_VISIBLE_ROWS - widget.row, Math.round((resize.pointerY - resize.grabBottom - resize.top) / displayPitch)),
    )
    if (requestedWidth === resize.width && requestedHeight === resize.height) return

    // Push neighbours aside live; when anything has nowhere to go the
    // request is dropped and the widget holds its current size.
    const pushed = pushedWidgetsForResize(resize.base, widget, requestedWidth, requestedHeight)
    if (!pushed) return
    const next = pushed.find((item) => item.id === widget.id)
    const size = widgetDimensions(next)
    resize.base = pushed
    resize.width = size.columns
    resize.height = size.rows
    resize.left += (next.col - resize.col) * displayPitch
    resize.col = next.col
    resize.element.style.width = `${size.columns * GRID_PITCH - 2 * widgetGap}px`
    resize.element.style.height = `${size.rows * GRID_PITCH - 2 * widgetGap}px`
    const geometryById = new Map(pushed.map((item) => [item.id, item]))
    setWidgets((current) => current.map((item) => {
      const geometry = geometryById.get(item.id)
      if (!geometry) return item
      const merged = { ...item }
      for (const key of RESIZE_GEOMETRY_KEYS) merged[key] = geometry[key]
      return merged
    }))
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
    // The layout is already committed by the live pushes; this only settles
    // a pointer that stopped between grid steps.
    applyResize(resize, widget)
    cleanupResize(resize)
    setHoldingSize(null)
  }

  const cancelResize = (event, widget) => {
    const resize = resizeRef.current
    if (!resize || resize.id !== widget.id || resize.pointerId !== event.pointerId) return
    event.stopPropagation()
    cleanupResize(resize)
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

  // The stage only moves when the window does, so one rect per drag replaces a
  // forced layout on every pointermove.
  const readStageRect = () => {
    const stage = stageRef.current
    if (!stage) return null
    if (!stageRectRef.current) stageRectRef.current = stage.getBoundingClientRect()
    return stageRectRef.current
  }

  const pointOnGrid = (event, rect = readStageRect()) => {
    if (!rect) return { x: 0, y: 0 }
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

    const firstMove = !selectionDrag.moved
    selectionDrag.moved = true
    selectionDrag.currentX = point.x
    selectionDrag.currentY = point.y
    const left = Math.min(selectionDrag.startX, point.x)
    const top = Math.min(selectionDrag.startY, point.y)
    const right = Math.max(selectionDrag.startX, point.x)
    const bottom = Math.max(selectionDrag.startY, point.y)
    marqueeBoxRef.current = { left, top, width: right - left, height: bottom - top }
    // The box mounts on the first move, so that one waits for the commit; the
    // rest of the drag writes to the element between frames.
    if (firstMove) setMarqueeActive(true)
    else queueMarqueePaint()

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
    // Sweeping over the same widgets again is the common case, and a new set
    // would re-render the canvas and the panel for an unchanged selection.
    setSelectedIds((current) => (sameIds(current, nextSelection) ? current : nextSelection))
  }

  const startSelectionDrag = (event) => {
    if (event.button !== 0 || event.target !== event.currentTarget) return
    event.preventDefault()
    stageRectRef.current = null
    const point = pointOnGrid(event)
    const additive = event.shiftKey || event.metaKey || event.ctrlKey
    const baseIds = additive ? new Set(selectionRef.current) : new Set()
    if (!additive) setSelectedIds((current) => (current.size ? new Set() : current))
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
    clearMarquee()
    if (!selectionDrag.moved && !selectionDrag.additive) {
      setSelectedIds((current) => (current.size ? new Set() : current))
    }
  }

  const moveDrag = (event, widget) => {
    const drag = dragRef.current
    if (!drag || drag.id !== widget.id || drag.pointerId !== event.pointerId) return

    const dx = event.clientX - drag.startX
    const dy = event.clientY - drag.startY
    if (!drag.moved && Math.hypot(dx, dy) < 4) return

    if (!drag.moved) {
      drag.moved = true
      // Written once, in the same tick as the class the re-render is about to add,
      // so a dragged widget never slips behind its neighbours for a frame.
      gsap.set(drag.elements, { zIndex: 5 })
      setDraggingIds(new Set(drag.ids))
    }

    const x = dx / stageScale
    const y = dy / stageScale
    drag.setters.forEach((setter) => {
      setter.x(x)
      setter.y(y)
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
    setDraggingIds(NO_IDS)
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
    setDraggingIds(NO_IDS)
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

  // The field's value is the size in px; clearing it means "auto", which is the
  // widget-size-driven size the CSS variable provides.
  const setFontSizeForSelected = (value) => {
    const size = Number(value)
    const fontSize = value.trim() === '' || !Number.isFinite(size) || size <= 0 ? undefined : size
    if (!selectedTextWidgets.length) return
    const ids = new Set(selectedTextWidgets.map((item) => item.id))
    setWidgets((current) => current.map((item) => ids.has(item.id)
      ? { ...item, fontSize }
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

  // Stable so the memoized picker is not re-rendered by every canvas change; it
  // reads the selection through the ref instead of closing over it.
  const handleFontChange = useCallback((value) => {
    ensureFullFont(value)
    setWidgets((current) => {
      const ids = selectionRef.current
      let changed = false
      const next = current.map((item) => {
        if (!ids.has(item.id) || item.kind !== 'text') return item
        changed = true
        return { ...item, font: value === 'default' ? undefined : value }
      })
      return changed ? next : current
    })
  }, [])

  const bgWidgets = selectedWidgets.filter((item) => item.kind === 'text' || item.kind === 'photo')
  const hasPhotoBackground = pageBackground.type === 'photo' && Boolean(pageBackground.imageSrc)
  const defaultWidgetBg = hasPhotoBackground ? GRAY_BG_COLOR : DEFAULT_BG_COLOR
  const activeBgColor = bgWidgets.length
    ? bgWidgets.every((item) => (item.bgColor || defaultWidgetBg) === (bgWidgets[0].bgColor || defaultWidgetBg))
      ? (bgWidgets[0].bgColor || defaultWidgetBg)
      : null
    : null

  const setBgColorForSelected = (value) => {
    if (!bgWidgets.length) return
    const ids = new Set(bgWidgets.map((item) => item.id))
    setWidgets((current) => current.map((item) => ids.has(item.id)
      ? { ...item, bgColor: value === defaultWidgetBg ? undefined : value }
      : item))
  }

  const activeBgType = bgWidgets.length
    ? bgWidgets.every((item) => (item.bgType || 'color') === (bgWidgets[0].bgType || 'color'))
      ? (bgWidgets[0].bgType || 'color')
      : null
    : null

  const setBgTypeForSelected = (value) => {
    if (!bgWidgets.length) return
    const ids = new Set(bgWidgets.map((item) => item.id))
    setWidgets((current) => current.map((item) => ids.has(item.id)
      ? { ...item, bgType: value === 'color' ? undefined : value }
      : item))
  }

  const activeBgFit = bgWidgets.length
    ? bgWidgets.every((item) => (item.bgFit || 'contain') === (bgWidgets[0].bgFit || 'contain'))
      ? (bgWidgets[0].bgFit || 'contain')
      : null
    : null

  const setBgFitForSelected = (value) => {
    if (!bgWidgets.length) return
    const ids = new Set(bgWidgets.map((item) => item.id))
    setWidgets((current) => current.map((item) => ids.has(item.id)
      ? { ...item, bgFit: value }
      : item))
  }

  const activeBgTileSize = bgWidgets.length
    ? bgWidgets.every((item) => (item.bgTileSize || DEFAULT_BG_TILE_SIZE) === (bgWidgets[0].bgTileSize || DEFAULT_BG_TILE_SIZE))
      ? (bgWidgets[0].bgTileSize || DEFAULT_BG_TILE_SIZE)
      : null
    : null

  const setBgTileSizeForSelected = (value) => {
    const size = Number(value)
    const bgTileSize = value.trim() === '' || !Number.isFinite(size) || size <= 0 ? undefined : size
    if (!bgWidgets.length) return
    const ids = new Set(bgWidgets.map((item) => item.id))
    setWidgets((current) => current.map((item) => ids.has(item.id)
      ? { ...item, bgTileSize }
      : item))
  }

  const bgIsPasting = bgWidgets.some((item) => item.bgIsPasting)
  const bgPasteStatus = (bgWidgets.find((item) => item.bgPasteStatus) || {}).bgPasteStatus || ''

  const pasteBackgroundImage = async () => {
    if (!bgWidgets.length || bgWidgets.some((item) => item.bgIsPasting)) return
    const ids = new Set(bgWidgets.map((item) => item.id))
    setWidgets((current) => current.map((item) => ids.has(item.id)
      ? { ...item, bgIsPasting: true, bgPasteStatus: '' }
      : item))
    try {
      const imageSrc = await readImageFromClipboard()
      setWidgets((current) => current.map((item) => ids.has(item.id)
        ? { ...item, bgImageSrc: imageSrc, bgIsPasting: false, bgPasteStatus: '' }
        : item))
    } catch (error) {
      setWidgets((current) => current.map((item) => ids.has(item.id)
        ? {
            ...item,
            bgIsPasting: false,
            bgPasteStatus: error?.message || 'Could not read an image from the clipboard.',
          }
        : item))
    }
  }

  const hasText = selectedTextWidgets.length > 0
  const hasPhoto = selectedPhotoWidgets.length > 0

  // Pages are built conditionally so the pager always matches the current selection.
  // Each page is one concern; the pager label names it, so nothing inside repeats it.
  const pages = []
  if (bgWidgets.length > 0) {
    pages.push({
      id: 'colors',
      label: 'background',
      content: (
        <>
          <div className="properties-styles" role="group" aria-label="Background type">
            <button
              type="button"
              aria-pressed={activeBgType === 'color'}
              onClick={() => setBgTypeForSelected('color')}
            >
              Color
            </button>
            <button
              type="button"
              aria-pressed={activeBgType === 'photo'}
              onClick={() => setBgTypeForSelected('photo')}
            >
              Photo
            </button>
          </div>
          {activeBgType === 'photo' ? (
            <>
              <button
                className="photo-widget-button"
                type="button"
                disabled={bgIsPasting}
                onClick={pasteBackgroundImage}
              >
                {bgIsPasting ? 'Pasting…' : 'Paste image'}
              </button>
              <select
                id="background-fit-select"
                className="properties-field"
                value={activeBgFit || ''}
                aria-label="Background image scaling"
                onChange={(event) => setBgFitForSelected(event.target.value)}
              >
                {activeBgFit === null && (
                  <option value="" disabled>Mixed…</option>
                )}
                {BG_FIT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value} title={option.description}>
                    {option.label}
                  </option>
                ))}
              </select>
              {activeBgFit === 'tile' && (
                <div className="properties-field-group">
                  <label className="properties-label" htmlFor="background-tile-size-input">tile size</label>
                  <input
                    id="background-tile-size-input"
                    className="properties-field"
                    type="number"
                    min="1"
                    step="1"
                    inputMode="numeric"
                    placeholder={activeBgTileSize === null ? 'mixed' : String(DEFAULT_BG_TILE_SIZE)}
                    value={activeBgTileSize === null ? '' : String(activeBgTileSize)}
                    onChange={(event) => setBgTileSizeForSelected(event.target.value)}
                  />
                </div>
              )}
              {bgPasteStatus && (
                <p className="properties-color" role="status">{bgPasteStatus}</p>
              )}
            </>
          ) : (
            <div
              className="properties-colorful"
              role="group"
              aria-label="Background color and opacity"
            >
              <Colorful
                color={activeBgColor || defaultWidgetBg}
                onChange={(color) => setBgColorForSelected(color.hexa)}
                style={{ width: '100%' }}
              />
              <p className="properties-color">
                {activeBgColor === null ? 'Mixed' : activeBgColor.toUpperCase()}
              </p>
            </div>
          )}
        </>
      ),
    })
  }
  if (hasPhoto) {
    pages.push({
      id: 'image',
      label: 'image',
      content: (
        <select
          id="photo-fit-select"
          className="properties-field"
          value={activePhotoFit || ''}
          aria-label="Image scaling"
          onChange={(event) => setPhotoFitForSelected(event.target.value)}
        >
          {activePhotoFit === null && (
            <option value="" disabled>Mixed…</option>
          )}
          {PHOTO_FIT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value} title={option.description}>
              {option.label}
            </option>
          ))}
        </select>
      ),
    })
  }
  if (hasText) {
    pages.push({
      id: 'text',
      label: 'text',
      content: (
        <>
          <select
            id="text-align-select"
            className="properties-field"
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
          <select
            id="text-vertical-align-select"
            className="properties-field"
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
          <div className="properties-styles" role="group" aria-label="Text style">
            <button
              type="button"
              aria-pressed={allBold}
              aria-label="Bold"
              onClick={() => toggleTextStyleForSelected('bold')}
            >
              B
            </button>
            <button
              className="is-italic"
              type="button"
              aria-pressed={allItalic}
              aria-label="Italic"
              onClick={() => toggleTextStyleForSelected('italic')}
            >
              I
            </button>
            <button
              className="is-underline"
              type="button"
              aria-pressed={allUnderline}
              aria-label="Underline"
              onClick={() => toggleTextStyleForSelected('underline')}
            >
              U
            </button>
          </div>
        </>
      ),
    })
    pages.push({
      id: 'font',
      label: 'font',
      content: (
        <>
          <FontPicker value={activeFont || 'default'} onChange={handleFontChange} />
          <div className="properties-field-group">
            <label className="properties-label" htmlFor="text-font-size-input">font size</label>
            <input
              id="text-font-size-input"
              className="properties-field"
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              placeholder={activeFontSize === null ? 'mixed' : 'auto'}
              value={activeFontSize === null || activeFontSize === 'auto' ? '' : String(activeFontSize)}
              onChange={(event) => setFontSizeForSelected(event.target.value)}
            />
          </div>
        </>
      ),
    })
  }

  // Canvas-wide look, so it stays available even with nothing selected.
  pages.push({
    id: 'appearance',
    label: 'appearance',
    content: (
      <>
        <PropertySlider
          id="widget-padding-slider"
          label="Widget padding"
          value={widgetGap}
          defaultValue={DEFAULT_WIDGET_GAP}
          input={WIDGET_GAP_INPUT}
          onChange={setWidgetGap}
        />
        <PropertySlider
          id="widget-radius-slider"
          label="Corner radius"
          value={widgetRadius}
          defaultValue={DEFAULT_WIDGET_RADIUS}
          input={WIDGET_RADIUS_INPUT}
          onChange={setWidgetRadius}
        />
        <div className="properties-styles" role="group" aria-label="Page background type">
          <button
            type="button"
            aria-pressed={pageBackground.type === 'color'}
            onClick={() => setPageBackground((prev) => ({ ...prev, type: 'color' }))}
          >
            Color
          </button>
          <button
            type="button"
            aria-pressed={pageBackground.type === 'photo'}
            onClick={() => setPageBackground((prev) => ({ ...prev, type: 'photo' }))}
          >
            Photo
          </button>
        </div>
        {pageBackground.type === 'photo' ? (
          <>
            <button
              className="photo-widget-button"
              type="button"
              disabled={pageBgIsPasting}
              onClick={pastePageBackgroundImage}
            >
              {pageBgIsPasting ? 'Pasting…' : 'Paste image'}
            </button>
            <select
              id="page-background-fit-select"
              className="properties-field"
              value={pageBackground.fit}
              aria-label="Page background image scaling"
              onChange={(event) => setPageBackground((prev) => ({ ...prev, fit: event.target.value }))}
            >
              {BG_FIT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value} title={option.description}>
                  {option.label}
                </option>
              ))}
            </select>
            {pageBackground.fit === 'tile' && (
              <div className="properties-field-group">
                <label className="properties-label" htmlFor="page-background-tile-size-input">tile size</label>
                <input
                  id="page-background-tile-size-input"
                  className="properties-field"
                  type="number"
                  min="1"
                  step="1"
                  inputMode="numeric"
                  placeholder={String(DEFAULT_BG_TILE_SIZE)}
                  value={pageBackground.tileSize ?? ''}
                  onChange={(event) => {
                    const size = Number(event.target.value)
                    setPageBackground((prev) => ({
                      ...prev,
                      tileSize: event.target.value.trim() === '' || !Number.isFinite(size) || size <= 0
                        ? undefined
                        : size,
                    }))
                  }}
                />
              </div>
            )}
            {pageBgPasteStatus && (
              <p className="properties-color" role="status">{pageBgPasteStatus}</p>
            )}
          </>
        ) : (
          <div
            className="properties-colorful"
            role="group"
            aria-label="Page background color and opacity"
          >
            <Colorful
              color={pageBackground.color}
              onChange={(color) => setPageBackground((prev) => ({ ...prev, color: color.hexa }))}
              style={{ width: '100%' }}
            />
            <p className="properties-color">
              {pageBackground.color.toUpperCase()}
            </p>
          </div>
        )}
        <div className="properties-field-group">
          <label className="properties-label" htmlFor="page-music-link-input">music</label>
          <input
            id="page-music-link-input"
            className="properties-field"
            type="url"
            inputMode="url"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            aria-label="YouTube link"
            placeholder="YouTube link"
            value={pageMusic.url}
            onChange={(event) => handleMusicUrlChange(event.target.value)}
          />
        </div>
        {pageMusic.videoId && (
          <>
            <div className="properties-styles" role="group" aria-label="Background music">
              <button
                type="button"
                aria-pressed={pageMusic.playing}
                onClick={() => setPageMusic((prev) => ({ ...prev, playing: !prev.playing }))}
              >
                {pageMusic.playing ? 'Stop' : 'Play'}
              </button>
            </div>
            <PropertySlider
              id="page-music-volume-slider"
              label="Volume"
              value={pageMusic.volume}
              defaultValue={80}
              input={{ min: 0, max: 100, step: 1 }}
              onChange={(volume) => setPageMusic((prev) => ({ ...prev, volume }))}
            />
          </>
        )}
        {musicStatus && (
          <p className="properties-color" role="status">{musicStatus}</p>
        )}
      </>
    ),
  })

  return (
    <div className={`platforma-canvas${incompatibility ? ' is-incompatible' : ''}${hasPhotoBackground ? ' has-photo-background' : ''}`}>
      {incompatibility ? (
        <div className="platforma-incompatibility" role="alert">
          <h1>
            {incompatibility === 'mobile'
              ? 'This page is not compatible with mobile.'
              : 'This window is too small for the page.'}
          </h1>
          <p>
            {incompatibility === 'mobile'
              ? 'Open Platforma on a desktop display.'
              : `Use a window at least ${MIN_VIEWPORT_WIDTH} × ${MIN_VIEWPORT_HEIGHT} pixels.`}
          </p>
        </div>
      ) : (
        <>
          {pageMusic.videoId && (
            <YouTubeBackgroundAudio
              videoId={pageMusic.videoId}
              playing={pageMusic.playing}
              volume={pageMusic.volume}
              onError={() => {
                setPageMusic((prev) => ({ ...prev, playing: false }))
                setMusicStatus("That video can't play here.")
              }}
              onPlayingChange={(isPlaying) => {
                setPageMusic((prev) => (prev.playing === isPlaying ? prev : { ...prev, playing: isPlaying }))
              }}
            />
          )}
          {pageBackground.type === 'photo' && pageBackground.imageSrc && pageBackground.fit === 'tile' ? (
            <div
              className="platforma-background"
              aria-hidden="true"
              style={{
                backgroundImage: `url("${pageBackground.imageSrc}")`,
                backgroundSize: `${pageBackground.tileSize || DEFAULT_BG_TILE_SIZE}px`,
              }}
            />
          ) : (
            <div
              className="platforma-background"
              aria-hidden="true"
              style={{ backgroundColor: pageBackground.color }}
            >
              {pageBackground.type === 'photo' && pageBackground.imageSrc && (
                <img
                  src={pageBackground.imageSrc}
                  alt=""
                  draggable="false"
                  style={{ objectFit: pageBackground.fit }}
                />
              )}
            </div>
          )}
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
                '--widget-gap': `${widgetGap}px`,
                '--widget-radius': `${widgetRadius}px`,
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
                  height: `${GRID_VIRTUAL_HEIGHT + GRID_PITCH}px`,
                }}
              />
              {marqueeActive && (
                <div
                  ref={marqueeRef}
                  className="selection-marquee"
                  aria-hidden="true"
                />
              )}
              {widgets.map((widget) => {
                const size = widgetDimensions(widget)
                const isSelected = selectedIds.has(widget.id)
                const isDragging = draggingIds.has(widget.id)
                const widgetLabel = `${widget.kind} widget`
                const widgetBackground = widget.bgColor || defaultWidgetBg
                const widgetBackgroundPhoto = widget.bgType === 'photo' && widget.bgImageSrc
                return (
                  <div
                    key={widget.id}
                    ref={widgetRefCallback(widget.id)}
                    className={`canvas-widget${widget.kind === 'photo' ? ' is-photo' : ''}${isSelected ? ' is-selected' : ''}${isDragging ? ' is-dragging' : ''}`}
                    style={{
                      '--widget-ui-scale': 1 / stageScale,
                      '--widget-inset-small': `${5 / stageScale}px`,
                      '--widget-inset-medium': `${7 / stageScale}px`,
                      '--widget-display-width': `${size.columns * GRID_PITCH * stageScale}px`,
                      '--widget-display-height': `${size.rows * GRID_PITCH * stageScale}px`,
                      '--widget-text-inset': `${8 / stageScale}px`,
                      '--text-widget-font-size': `${Math.max(4, Math.min(28, Math.sqrt(size.columns * size.rows) * GRID_PITCH * 0.045))}px`,
                      '--selection-ring-width': `${1.5 / stageScale}px`,
                      ...(widgetBackground ? { backgroundColor: widgetBackground } : null),
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
                    {widgetBackgroundPhoto && (
                      widget.bgFit === 'tile' ? (
                        <div
                          className="widget-background-layer widget-background-tile"
                          aria-hidden="true"
                          style={{
                            backgroundImage: `url("${widget.bgImageSrc}")`,
                            backgroundSize: `${widget.bgTileSize || DEFAULT_BG_TILE_SIZE}px`,
                          }}
                        />
                      ) : (
                        <img
                          className="photo-widget-image widget-background-layer"
                          src={widget.bgImageSrc}
                          alt=""
                          draggable="false"
                          aria-hidden="true"
                          style={{ objectFit: widget.bgFit || 'contain' }}
                        />
                      )
                    )}
                    {widget.kind === 'text' && (
                      <TextWidgetEditor
                        value={widget.text || ''}
                        align={widget.verticalAlign}
                        style={{
                          ...(widget.fontSize ? { fontSize: `${widget.fontSize}px` } : null),
                          textAlign: widget.textAlign || 'left',
                          fontWeight: widget.bold ? 'bold' : undefined,
                          fontStyle: widget.italic ? 'italic' : undefined,
                          textDecoration: widget.underline ? 'underline' : undefined,
                          fontFamily: fontStack(widget.font),
                        }}
                        onPointerDown={(event) => selectWidgetFromContent(event, widget)}
                        onChange={(text) => setWidgets((current) => current.map((item) => item.id === widget.id
                          ? { ...item, text }
                          : item))}
                      />
                    )}
                    {widget.kind === 'photo' && (
                      <div
                        className="photo-widget-content"
                        style={{ backgroundColor: widgetBackgroundPhoto ? 'transparent' : widgetBackground }}
                      >
                        {widget.imageSrc ? (
                          <>
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
                          </>
                        ) : (
                          /* Nothing to paste over yet: the paste action is the whole
                             widget, so it sits in the middle instead of a corner. */
                          <button
                            className="photo-widget-paste"
                            type="button"
                            aria-label="Paste image from clipboard"
                            disabled={widget.isPasting}
                            title="Paste an image file or image link from your clipboard"
                            onPointerDown={(event) => selectWidgetFromContent(event, widget)}
                            onClick={() => pasteImageIntoWidget(widget)}
                          >
                            {widget.isPasting ? 'Pasting…' : 'Paste image'}
                          </button>
                        )}
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
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        aria-hidden="true"
                      >
                        <path d="M5 5 19 19M19 5 5 19" />
                      </svg>
                    </button>
                    <button
                      className="widget-resize-handle"
                      type="button"
                      aria-label="Resize widget"
                      title="Drag to resize · Use arrow keys to resize"
                      onPointerDown={(event) => startResize(event, widget)}
                      onPointerMove={(event) => moveResize(event, widget)}
                      onPointerUp={(event) => finishResize(event, widget)}
                      onPointerCancel={(event) => cancelResize(event, widget)}
                      onKeyDown={(event) => resizeWithKeyboard(event, widget)}
                    >
                      {/* Corner grip: three strokes parallel to the diagonal,
                          brightest where the corner is, tapering away from it. */}
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        aria-hidden="true"
                      >
                        <path d="M21 15 15 21" />
                        <path d="M18.5 10.5 10.5 18.5" strokeOpacity="0.7" />
                        <path d="M16 6 6 16" strokeOpacity="0.42" />
                      </svg>
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

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

      <PropertiesPanel count={selectedIds.size} pages={pages} />

      <button
        className="platforma-add-button"
        type="button"
        aria-label={menuOpen ? 'Close widget menu' : 'Add a widget'}
        aria-expanded={menuOpen}
        aria-controls="widget-menu"
        onClick={() => setMenuOpen((open) => !open)}
      >
        <svg
          ref={plusRef}
          className="platforma-add-glyph"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M12 4v16M4 12h16" />
        </svg>
      </button>
        </>
      )}
    </div>
  )
}
