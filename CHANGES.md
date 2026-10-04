# Changes — evenimente page (proof of concept)

## What was built
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

## Deliberate removals (per feedback)
- No reset button under the accordion (click open panel to show all).
- No grid section headings; no panel links (full albums reachable via masonry
  photos and the "albumul complet în google photos" footer links).

## Known DESIGN.md deviations
- Pre-existing, untouched: pill navbar (`.nb-bar`, `.nb-highlight`, `.nb-bg`),
  pill `login-btn`, `.btn` variants, extra accent colors.
- Accepted for this page: rounded photos; accordion shadows/gradient overlays.

## Limits of the scraper
- Link-shared ("anyone with the link") albums only; no private albums (needs OAuth).
- Photos only — videos skipped. Very large albums (1000+) may paginate.
- Depends on Google's share-page markup; if it breaks, fix the `/pw/` regex.

## Future (not built)
- Album links move to a database, manageable through an admin portal;
  `albumPhotos.js` is throwaway seed data (also noted in `Evenimente.jsx`).
