# DESIGN — WebToonCNU frontend

Principle: only what matters. Text, one background, one divider. No pills, no cards, no shadows, no clutter.

## Tokens

```css
--bg: #6f1a1f;      /* page */
--surface: #2a1415; /* overlay surface: nav, add button, properties panel */
--ink: #f4f0f0;     /* text */
--heading: #fff4f4; /* headings */
--line: rgba(255, 215, 217, 0.25); /* only divider */
```

No other colors. No gradients. No shadows.

## Type

- Display / headings: `Silkscreen, sans-serif`, 700. `h1: clamp(2.5rem, 6vw, 4rem)`, `h2: 1.4rem` lowercase.
- Body: `FreeSans, Helvetica Neue, Arial, sans-serif`, `1rem / 1.6`. Lede: `1.125rem / 1.6, max 60ch`.
- Logo: pixel image, `width: min(100%, 576px)`, `image-rendering: pixelated`. No text-shadow, no styling.

## Layout

- Single column: `.page { max-width: 90ch; margin: 0 auto; padding: 1rem 0.625rem 4rem; }`
- Hero: centered (`text-align: center`) only on landing. Everything else left-aligned.
- Sections: `padding: 1.5rem 0; border-bottom: 1px solid var(--line);` Nothing else separates content.
- Actions row: `display: flex; gap: 1.5rem;` No container, no background.

## Properties panel

`src/components/PropertiesPanel.{jsx,css}`. The one filled surface besides the nav.

- Shape: `--surface` fill, 22px radius, fixed 24px from the left and bottom edges.
  Collapsed it is the round button that opens it.
- Lift: the same `box-shadow` as the add button and the widget menu, in both states.
  Documented exception to the no-shadow rule, like those two.
- Selection counter centered on top, pager (arrows at the edges, page name centered)
  at the bottom. Both float over the pages on a `--surface` → transparent gradient,
  and page content carries the same fade as a `mask-image`, so properties dissolve
  before they reach the text.
- One page per concern; the pager label names it, so page content carries no heading.
- Controls are the plain ones: underline selects, bare icon buttons at `currentColor`,
  pressed state in `--accent`. No boxes, no pills, no filled toggles.
- Page changes are scroll-snap, not JS: one scroll handler updates the pager index.

## Buttons / links — plain text only

One pattern for everything: nav items, actions, login, form submit.

```css
.text-btn {
  background: none; border: 0; padding: 0;
  font: inherit; line-height: 1.5;
  color: var(--ink); cursor: pointer; text-decoration: none;
}
.text-btn:hover { text-decoration: underline; background: none; }
```

Rules:
- No `border-radius`, no `background`, no `box-shadow`, no `padding` that makes a pill/button shape.
- Hover = underline only. Active nav = `font-weight: 700`, nothing else.
- Forbidden: `.btn`, `.btn.solid`, `.btn.ghost`, `.login-btn` pill, `.nb-bar` pill, `.nb-highlight`, `.nb-bg`.

## Nav

- Plain text row, centered: `acasa evenimente editii galerie resurse contact`. No pill container, no background, no blur behind it.
- Sticky top is allowed, styling is not. `log in` is plain text, top-right, same style. Hides on scroll, no animation besides fade.

## Forms

- Underline inputs only:
```css
.field input { background: transparent; border: 0; border-bottom: 1px solid #fff; border-radius: 0; padding: 0.5rem 0.25rem; }
.field input:focus { border-bottom-color: var(--accent); outline: none; }
```
- No boxed inputs, no labels-as-pills, no helper cards.

## Motion

- Page change: `opacity 0 → 1, 0.6s ease`. Nothing else.
- `prefers-reduced-motion: reduce` = no animation.
- GradualBlur top fade is the only scroll effect. No parallax, no GSAP entrances on text.

## Don't

- No pill / `border-radius: 999px|100px`.
- No `box-shadow`.
- No new colors, fonts, or button variants.
- No icons next to text buttons.
