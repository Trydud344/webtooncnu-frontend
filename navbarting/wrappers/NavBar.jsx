/** Wrapper React peste <nav-bar>. Atributele se seteaza imperativ (custom elements). */
import { useEffect, useRef } from 'react';
import '../nav-bar.js';

export default function NavBar({
  items,
  active,
  routing = 'history',
  theme,
  sticky = true,
  minimalOnScroll = true,
  contrast = true,
  magnetic = true,
  scrollThreshold = 100,
  onNavigate,
  onEvent,
}) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    for (const [k, v] of [
      ['routing', routing],
      ['minimal-on-scroll', String(minimalOnScroll)],
      ['contrast', String(contrast)],
      ['magnetic', String(magnetic)],
      ['sticky', String(sticky)],
      ['scroll-threshold', String(scrollThreshold)],
      ['data-sticky', sticky ? 'true' : 'false'],
    ]) el.setAttribute(k, v);
    if (theme) el.setAttribute('data-theme', theme);
    else el.removeAttribute('data-theme');
    if (items !== undefined) {
      if (typeof el.setItems === 'function') el.setItems(items);
      else {
        el._items = items;
        el.setAttribute('items', JSON.stringify(items));
      }
    }
    if (active !== undefined) {
      if (typeof el.setActive === 'function') el.setActive(active);
      else el.setAttribute('active', active);
    }
    el._onNavigate = onNavigate || null;
    if (el._nb) el._nb.opts.onNavigate = onNavigate || null;
  }, [routing, minimalOnScroll, contrast, magnetic, sticky, scrollThreshold, theme, items, active, onNavigate]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !onEvent) return;
    const fn = (e) => onEvent(e.detail, e);
    el.addEventListener('nb:navigate', fn);
    return () => el.removeEventListener('nb:navigate', fn);
  }, [onEvent]);

  return <nav-bar ref={ref} />;
}
