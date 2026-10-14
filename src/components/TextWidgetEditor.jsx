import { useLayoutEffect, useRef } from 'react'

/**
 * Text widget editor. The wrapper is the widget-sized box that positions its one
 * child vertically; the textarea itself is grown to fit its content, so text
 * wraps and fills the widget instead of sitting in a two-row box that scrolls.
 * CSS caps it at the widget (`max-height: 100%`), and only text that genuinely
 * does not fit starts to scroll.
 *
 * Styling lives in PlatformaCanvas.css with the rest of the widget vocabulary.
 */
export default function TextWidgetEditor({ value, style, align, onChange, onPointerDown }) {
  const bodyRef = useRef(null)
  const editorRef = useRef(null)

  const fit = () => {
    const editor = editorRef.current
    if (!editor) return
    editor.style.height = 'auto'
    editor.style.height = `${editor.scrollHeight}px`
  }

  // Text, font or size changes re-render; measure again right after each one.
  useLayoutEffect(fit)

  useLayoutEffect(() => {
    const body = bodyRef.current
    // The wrapper is sized by the widget, never by the text, so watching it picks
    // up live resizes without the height write feeding back into the observer.
    const observer = new ResizeObserver(fit)
    observer.observe(body)
    // A web font swaps in after the render that asked for it and changes every
    // line break, so re-measure when fonts finish loading.
    document.fonts?.addEventListener('loadingdone', fit)
    return () => {
      observer.disconnect()
      document.fonts?.removeEventListener('loadingdone', fit)
    }
  }, [])

  return (
    <div
      ref={bodyRef}
      className="text-widget-body"
      style={{
        justifyContent: align === 'middle' ? 'center' : align === 'bottom' ? 'flex-end' : 'flex-start',
      }}
    >
      <textarea
        ref={editorRef}
        className="text-widget-editor"
        aria-label="Text widget content"
        placeholder="Write something…"
        rows={1}
        spellCheck="true"
        value={value}
        style={style}
        onPointerDown={onPointerDown}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}
