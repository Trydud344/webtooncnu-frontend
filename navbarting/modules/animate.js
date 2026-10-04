/**
 * navbarting / modules/animate.js
 * Adapter de animatie: foloseste GSAP daca exista, altfel Web Animations / CSS.
 * Aceeasi logica e integrata in nav-bar.js; modulul e pentru cei care vor
 * sa animeze custom in jurul navbarului cu acelasi motor.
 *
 * Folosire:
 *   import { animate, hasGsap } from './modules/animate.js';
 *   animate.to(el, { left: 120, width: 80, duration: 0.35 });
 */

export function hasGsap() {
  return typeof window !== 'undefined' && !!window.gsap;
}

function px(v) {
  return typeof v === 'number' ? `${v}px` : v;
}

export const animate = {
  set(el, props = {}) {
    if (hasGsap()) { window.gsap.set(el, props); return; }
    if (props.left !== undefined) el.style.left = px(props.left);
    if (props.width !== undefined) el.style.width = px(props.width);
    if (props.scale !== undefined) el.style.transform = `scale(${props.scale})`;
    if (props.opacity !== undefined) el.style.opacity = props.opacity;
    if (props.color !== undefined) el.style.color = props.color;
    if (props.padding !== undefined) el.style.padding = props.padding;
  },

  to(el, vars = {}) {
    if (hasGsap()) { window.gsap.to(el, { ...vars }); return; }
    const { duration = 0.3, delay = 0, ...props } = vars;
    const parts = [];
    if (props.left !== undefined || props.width !== undefined) parts.push('left .3s ease, width .3s ease');
    if (props.scale !== undefined) parts.push('transform .3s ease');
    if (props.opacity !== undefined) parts.push('opacity .3s ease');
    if (props.color !== undefined) parts.push('color .25s ease');
    if (props.padding !== undefined) parts.push('padding .3s ease');
    setTimeout(() => {
      if (!el.isConnected) return;
      if (parts.length) {
        el.style.transition = parts.join(', ');
        setTimeout(() => { if (el.isConnected) el.style.transition = ''; }, duration * 1000 + 60);
      }
      animate.set(el, props);
    }, delay * 1000);
  },

  clamp(min, max) {
    if (hasGsap() && window.gsap.utils?.clamp) return window.gsap.utils.clamp(min, max);
    return (v) => Math.min(max, Math.max(min, v));
  },
};
