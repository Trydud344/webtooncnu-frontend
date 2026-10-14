# Changes

## Properties panel — minimal redesign (platforma)

### What was built
- `src/components/PropertiesPanel.{jsx,css}` — the panel and its chrome, out of
  `PlatformaCanvas.jsx`: collapse morph, top-centered selection counter, page
  strip, bottom pager (arrows at the edges, page name centered between them).
  `PropertySlider` is exported from here, so panel controls live with the panel.
- `src/components/FontPicker.{jsx,css}` — font search + virtualized list, out of
  the canvas. `src/fonts.js` holds the catalog, the stacks and the loader.
- Pages are one concern each: `colors`, `image`, `text`, `font`, `appearance`.
  The pager label names the page, so nothing inside the page repeats it.
- Counter and pager float over the pages on a gradient scrim, and the page
  content is masked with the same fade, so properties dissolve before they reach
  the text instead of colliding with it.
- Fade + paging need no JS: scroll-snap slides the pages, and one scroll handler
  updates the pager only when the page index actually changes.
- The collapse morph is a CSS width/height/border-radius transition. The GSAP
  timeline, its refs and its kill effects are gone; `prefers-reduced-motion`
  turns the transitions off.
- The panel and its collapsed button carry the add button's `box-shadow` lift.
- `src/index.css` — new `--surface` token (`#2a1415`), already the navbar and add
  button color, now also the panel surface.

### Deliberate removals (per feedback)
- No `Properties` heading, no section headings, no `Applies to N widgets.`, no
  `Mixed — pick a color…` sentence: the hex value and `Mixed` stay, the teaching
  copy does not.
- No boxes or pills: selects are underline fields, B/I/U and every icon button are
  bare glyphs at `currentColor`, pressed state is accent color only.
- No top-center selection pill: `N elements selected` is the panel counter, and
  the shift-click hint sentence is gone (AGENTS rule 2).
- No `@property` fade animation and no `.is-at-end` scroll bookkeeping.

### Known DESIGN.md deviations
- Pre-existing, untouched: pill navbar (`.nb-bar`, `.nb-highlight`, `.nb-bg`),
  pill `login-btn`, `.btn` variants, extra accent colors.
- Accepted: the panel is a filled, 22px-rounded surface carrying the same lift as
  the add button, and its collapsed form is the round button that opens it.

## Platforma viewport gate — 16:10 requirement dropped

- `incompatibilityFor` no longer reads `window.screen`. The old rule rejected any
  display whose physical aspect ratio was more than 0.08 off 16:10, which ruled
  out every 16:9 monitor even when the window itself was fine.
- The stage already scales to the box it is given, so the gate now only checks two
  things: not a phone, and at least 640 × 420 (below that the canvas, the panel and
  the add button stop fitting together). Everything else gets the grid fitted to
  the window, whatever its shape.
- Gone with it: `screenWidth`/`screenHeight` in `viewportInfo`, the `resolution`
  branch, and its two sentences.

## Canvas polish (platforma)

- The add button's `+` and the widget delete `×` are SVG paths, so they centre by
  geometry rather than by whatever the platform's font does with a `+`/`×`
  character. The nudges they needed before (`padding: 0 0 4px` on the button,
  `translateY(-1px)` on the glyph) were tuned on one font and drifted on others.
- Dropping a dragged widget no longer fires the radial drop flash: the state, its
  ref and the `drop-flash` keyframes are gone.
- The selection ring and the drag lift fade over 650ms
  (`cubic-bezier(0.33, 0, 0.15, 1)`) instead of 140ms. `.is-dragging` keeps
  `transition: none`, so the lift still tracks the pointer, and reduced motion
  snaps both.
- Known hitch, not addressed: the first time a text widget is selected, mounting
  the font page fetches and parses the 0.5 MB Fontsource catalog (~1.1s long task)
  even if the panel is closed. Lazy-mounting the picker would fix it.

### Text widget editor

- `src/components/TextWidgetEditor.jsx` — the widget's textarea is grown to its
  content (`scrollHeight`) instead of keeping the intrinsic `rows="2"` height, so
  text wraps and fills the widget instead of living in an ~11px scroll box at the
  top. `max-height: 100%` caps it at the widget, so only text that genuinely does
  not fit scrolls.
- It re-measures after every render (text, font, size), on wrapper resize
  (`ResizeObserver`, which also catches live drags) and on `document.fonts`
  `loadingdone` (a swapped web font changes every line break). The wrapper is
  sized by the widget rather than by the text, so the height write cannot feed
  back into the observer.
- `vertical-align` still works: the wrapper positions the measured box, verified
  centred/slack-balanced for middle, bottom and top.
- The canvas renders `<TextWidgetEditor … />` instead of the inline wrapper +
  textarea.
- Font size is a plain number field with a `font size` label instead of a dropdown
  of 8/10/12/…/32. Empty means `auto` (the widget-size-driven CSS variable), a
  mixed selection shows a `mixed` placeholder, and arrow keys still step it. The
  number spinners are hidden — they render as a light box on the transparent field.
- Panel fields share one `.properties-field` underline class (was
  `.properties-select`), used by the dropdowns, the search box and the number field.
- The font list's `N fonts` counter is gone.

### Photo widget empty state, and the widget delete button

- With no image, the paste action is the whole widget, so it is centred in it as a
  pill (`.photo-widget-paste`) instead of being one of two corner buttons; the
  corner row — with its `Ratio` button that has nothing to act on — only renders
  once there is an image. The `Paste an image or image link` hint went with it,
  since the button says the same thing.
- The pill is centred with `inset: 0; margin: auto`, not `top/left: 50%`: an
  absolutely positioned box with `left: 50%` gets half the widget as its
  shrink-to-fit budget and the label ellipsised at `Paste i…`. It keeps the
  constant on-screen size of the widget's other controls via `--widget-ui-scale`.
- `.widget-delete-button` lost its circle: no border, no `border-radius`, no
  background — a bare SVG `×` at `currentColor`, hover changes colour only, and
  the 22px box stays as the hit area. This is the deviation from AGENTS rule 1
  being undone rather than extended: the pill above was an explicit request.
- Worth knowing: the `×` is white on whatever the widget shows. Over a bright
  photo it relies on the image's own contrast.

## evenimente page (proof of concept)

### What was built
- `src/pages/Evenimente.jsx` — evenimente tab: accordion event switcher on top,
  per-album masonry photo grids below. Hover a panel filters to that event's grid;
  clicking the open panel shows all events again. The grid fades out on every
  switch and fades back in after 280ms of no further hovering — rapid moves
  keep it faded out instead of flickering.
- `src/pages/albumPhotos.js` — baked-in photo data (auto-generated, do not edit).
- `scripts/fetch-photos.sh` — scrapes public Google Photos share pages into
  `albumPhotos.js`. Usage: `sh scripts/fetch-photos.sh ["titlu|link" ...]`
  (no args = built-in 5 albums). Currently: 5 albums, 230 photos at `=w1200`.
  Recipe: mobile UA + http1.1 (desktop UA hits a JS interstitial bot-wall).
- `src/components/AccordionGallery.{jsx,css}` — React Bits component, JS + CSS
  variant. One addition vs upstream: `onSelect` prop (fires on panel change,
  skipped on mount). Panels carry no links; `trigger="hover"`; themed via props
  (`accentColor`/`textColor` `#f4f0f0`, `overlayColor` `#000000`).
- `src/App.jsx` — nav routes to `evenimente`; unbuilt tabs
  (editii, galerie, resurse, contact) show an "în lucru → cnutoons.com" placeholder.
  `evenimente` skips the global `view-enter` page fade so the grid never fades
  on load (only on album switches).
- `src/index.css` — masonry via CSS `columns` (no JS); `border-radius: 16px` on
  photos only; `section.flush` (padding kept, divider removed); `.grid-fade`
  (opacity transition for album switching, instant under reduced-motion).

### Deliberate removals (per feedback)
- No reset button under the accordion (click open panel to show all).
- No grid section headings; no panel links (full albums reachable via masonry
  photos and the "albumul complet în google photos" footer links).

### Known DESIGN.md deviations
- Pre-existing, untouched: pill navbar (`.nb-bar`, `.nb-highlight`, `.nb-bg`),
  pill `login-btn`, `.btn` variants, extra accent colors.
- Accepted for this page: rounded photos; accordion shadows/gradient overlays.

### Limits of the scraper
- Link-shared ("anyone with the link") albums only; no private albums (needs OAuth).
- Photos only — videos skipped. Very large albums (1000+) may paginate.
- Depends on Google's share-page markup; if it breaks, fix the `/pw/` regex.

### Future (not built)
- Album links move to a database, manageable through an admin portal;
  `albumPhotos.js` is throwaway seed data (also noted in `Evenimente.jsx`).
