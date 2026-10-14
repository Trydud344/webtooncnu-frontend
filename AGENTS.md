# AGENTS — WebToonCNU frontend

Design law for this repo. It extends `DESIGN.md`; where they overlap, both apply.
Violating a rule here is a bug, not a style preference.

## 1. No chrome around buttons

A button is its content. Nothing else.

- No circle, ring, pill, or border-radius wrapping an icon.
- No border, no background, no box-shadow on icon buttons.
- Icon button = bare SVG at `currentColor`. Hover may change color only.
- Keep the hit area (size the button, not the icon) and keep `:focus-visible`.
  Those are invisible until needed, so they are not chrome.
- `aria-label` is required on icon-only controls. Screen-reader text is not visible
  text and does not violate rule 2.

```css
/* yes */
.reset { border: 0; background: none; color: inherit; }
/* no */
.reset { border: 1px solid …; border-radius: 50%; background: …; }
```

## 2. No text that carries no value

Delete every string that restates the interface.

- No subtitles under headings. Heading `Properties` must not say `For selected elements`.
- No hint sentences about what already happened, no `Select X to…` instructions,
  no `Applies to 3 widgets.`, no empty-state copy explaining the obvious.
- No labels repeating a control's own visible value.
- Values that are genuinely live state (a number next to a slider, a selection count)
  are data, not copy. Keep those.
- If a string exists to teach the user, the control is wrong. Fix the control.

## 3. Minimal by default

- Prefer deleting to adding. Any addition must justify the element it removes.
- One control per need. No decorative separator, container, or wrapper.
- Reuse existing tokens and patterns from `DESIGN.md`. No new colors or fonts.
- Ask before introducing a new visual idiom.

## 4. Self-evident, never explained

The user must not be taught by text. They should operate the software correctly on
first sight because the interaction is obvious.

- Affordances come from form and behavior, not captions.
- Standard controls stay standard: sliders look like sliders, disabled looks
  disabled, hover shows what is clickable.
- If something needs a sentence to be usable, redesign it instead of describing it.

## Checklist before finishing UI work

1. Any circle, border, or fill on a button? Remove it.
2. Any text the user could have guessed? Remove it.
3. Could any element be deleted with no loss? Delete it.
4. Would a first-time user succeed without reading anything? If not, change the UI.
