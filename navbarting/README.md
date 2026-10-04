# navbarting — navbar pill reutilizabil, plug-and-play

Componenta extrage navbarul din acest site (`navbar.js` + `<nav-bar>`) intr-un
pachet independent, modular, care merge pe **orice site**: HTML static, Vite,
Next, Astro, WordPress (via script tag) — fara build obligatoriu, fara dependinte
obligatorii (GSAP e optional).

```
navbarting/
├── nav-bar.js        ← fisierul principal: Web Component <nav-bar> (IIFE, zero deps)
├── nav-bar.css       ← stiluri + teme (optional — JS-ul injecteaza fallback automat)
├── modules/
│   ├── config.js     ← DEFAULTS, PRESETS, parseItems, validateItems (ES module)
│   ├── contrast.js   ← detectie luminanta fundal (ES module, reutilizabil separat)
│   └── animate.js    ← adapter GSAP-or-nativ (ES module, reutilizabil separat)
├── wrappers/
│   └── NavBar.jsx    ← wrapper React (functioneaza cu wouter / react-router)
├── demo.html         ← demo functional, deschide-l direct in browser
├── package.json
└── README.md         ← fisierul acesta
```

---

## 1. Quick start (30 de secunde, orice site)

**a)** Copiaza folderul `navbarting/` langa site-ul tau (sau importa doar cele 2 fisiere).

**b)** In pagina ta:

```html
<!-- in <head> (optional — daca lipseste, JS-ul isi injecteaza stilurile singur) -->
<link rel="stylesheet" href="./navbarting/nav-bar.css">

<!-- unde vrei navbarul (de obicei la inceputul lui <body>) -->
<nav-bar
  items='[{"label":"home","href":"/"},{"label":"music","href":"/music"},{"label":"guestbook","href":"/guestbook"}]'
></nav-bar>

<!-- la finalul lui <body>. GSAP e OPTIONAL — fara el, animatiile merg nativ. -->
<!-- <script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js"></script> -->
<script src="./navbarting/nav-bar.js"></script>
```

Gata. Deschide `demo.html` ca referinta vie.

### Variante de `items`

```html
<!-- 1. JSON (recomandat) -->
<nav-bar items='[{"label":"home","href":"/"},{"label":"music","href":"/music"}]'></nav-bar>

<!-- 2. Copii declarativi (SEO-friendly, merge fara JS la afisarea linkurilor) -->
<nav-bar>
  <a href="/">home</a>
  <a href="/music">music</a>
</nav-bar>

<!-- 3. CSV compact -->
<nav-bar items="home:/, music:/music"></nav-bar>

<!-- 4. Din JS -->
<script>
  NavBar.create(document.body, {
    items: [{ label: 'home', href: '/' }],
    onNavigate: ({ href }) => console.log('go', href),
  });
</script>
```

---

## 2. Atribute (`<nav-bar ...>`)

| Atribut | Valori | Default | Ce face |
|---|---|---|---|
| `items` | JSON / CSV | cele 4 pagini demo | lista de linkuri `{label, href}` |
| `active` | path, ex `/music` | path-ul curent | forteaza itemul activ (altfel se ia din URL) |
| `routing` | `history` \| `hash` \| `off` | `history` | cum navigheaza la click (vezi §4) |
| `minimal-on-scroll` | `true`/`false` | `true` | pila se strange la scroll in jos, revine la scroll in sus |
| `contrast` | `true`/`false` | `true` | in minimal mode, textul devine negru pe fundal luminos, alb pe fundal inchis |
| `magnetic` | `true`/`false` | `true` | highlight-ul urmareste mouse-ul magnetic |
| `theme` / `data-theme` | `light` \| `glass` \| _(lipsa = dark)_ | dark | tema rapida |
| `sticky` / `data-sticky` | `true`/`false` | `true` | `false` = navbar static, nu sticky |
| `scroll-threshold` | numar px | `100` | de la cati px de scroll incepe minimal mode |

Exemple:

```html
<!-- navbar static, fara efecte, pentru footer/docs -->
<nav-bar items="overview:#overview, install:#install" routing="hash" minimal-on-scroll="false" magnetic="false" contrast="false"></nav-bar>

<!-- tema deschisa -->
<nav-bar data-theme="light" items='[{"label":"home","href":"/"}]'></nav-bar>
```

---

## 3. JS API

```js
// Defaulturi globale (se aplica tuturor navbarurilor create dupa)
NavBar.configure({ routing: 'off', theme: 'glass' });
NavBar.defaults; // citire
NavBar.version;  // '1.0.0'

// Creare imperativa (returneaza elementul <nav-bar>)
const el = NavBar.create('#header', {
  items: [{ label: 'home', href: '/' }],
  routing: 'history',
  minimalOnScroll: true,
  contrast: true,
  magnetic: true,
  onNavigate: ({ label, href, index }) => {
    console.log(label, href);
    // return false; // <- opreste navigarea default (tu faci routingul)
  },
});

// Metode pe element
el.setItems([{ label: 'a', href: '/a' }]);
el.setActive('/a');
el.refresh(); // recalculeaza highlight + contrast (dupa font load / resize custom)
el.destroy(); // scoate listenerii (elementul ramane in DOM)

// Evenimente (buble, ascultabile si pe document)
el.addEventListener('nb:navigate', (e) => console.log(e.detail)); // {label, href, index, element}
el.addEventListener('nb:active-change', (e) => console.log(e.detail));
```

---

## 4. Routere (history / hash / off)

- **`history` (default, SPA-uri):** click pe link intern (`/pagina`) → `history.pushState` + `popstate` dispatch.
  Routerele care asculta `popstate` (**wouter**, react-router in modul history) isi dau seama singure.
  Linkurile externe (`https://…`) nu sunt interceptate.
- **`hash`:** pentru site-uri statice / ancore pe pagina (`#/music`, `#install`).
  Lasa browserul sa schimbe hash-ul, doar marcheaza activul.
- **`off`:** nu navigheaza deloc, doar marcheaza activ + emite `nb:navigate`.
  Foloseste-l cand vrei control total (ex: router custom, animatie de tranzitie inainte de navigare):

```js
NavBar.create('#app', {
  routing: 'off',
  items: [...],
  onNavigate: ({ href }) => { myRouter.go(href); },
});
```

### React + wouter (cum e in acest proiect)

```jsx
import NavBar from './navbarting/wrappers/NavBar.jsx';
import { useLocation } from 'wouter';

function Header() {
  const [, navigate] = useLocation();
  return (
    <NavBar
      items={[
        { label: 'home', href: '/' },
        { label: 'camera roll', href: '/camera-roll' },
        { label: 'music', href: '/music' },
      ]}
      onNavigate={({ href }) => navigate(href)}
    />
  );
}
```

> Wrapperul pune `onNavigate` ca **proprietate**, nu ca atribut (functiile nu merg
> in atribute HTML). Daca nu folosesti wrapperul, seteaza `el._onNavigate = fn`.

---

## 5. Teme (CSS variables)

Culorile vin din variabile — suprascrie ce vrei, fara sa atingi JS-ul:

```css
nav-bar {
  --nb-bg: #181818;          /* fundal pila */
  --nb-text: #ffffff;        /* text */
  --nb-highlight: rgba(255,255,255,.12); /* pastila highlight */
  --nb-radius: 100px;
  --nb-top: 24px;            /* distanta de sus (sticky) */
  --nb-font-size: 15px;
  --nb-item-pad: 12px 24px;  /* padding item extins */
  --nb-scale-minimal: 0.92;  /* cat se micsoreaza in minimal mode */
}
```

Teme gata: `data-theme="light"` (pila alba), `data-theme="glass"` (blur
semi-transparent). Dark e defaultul (fara atribut).

Trucul anti-“saritura” la bold (`::after` cu `attr(data-label)`) e pastrat din
original — nu-l sterge, altfel highlight-ul tremura cand se schimba activul.

---

## 6. Modulele (`modules/`) — pentru cine vrea bucati separate

Sunt versiuni ES-module ale logicii din `nav-bar.js`, ca sa le importi individual:

```js
import { DEFAULTS, PRESETS, parseItems } from './navbarting/modules/config.js';
import { isBackgroundBright } from './navbarting/modules/contrast.js';
import { animate, hasGsap } from './navbarting/modules/animate.js';

// ex: presetul docs + validare
const items = parseItems('overview:#overview, api:#api');
console.log(PRESETS.docs);
```

`nav-bar.js` NU importa aceste fisiere (e intentionat standalone, un singur
`<script>`). Modulele sunt sursa de import cand construiesti ceva custom in
jurul navbarului.

---

## 7. Fara GSAP? Fara problema.

- Cu `window.gsap` prezent → animatii GSAP (ca in site-ul original).
- Fara → fallback nativ (tranzitii CSS + `Web Animations`-style). **Nu crapa.**
- `prefers-reduced-motion` e respectat (tranzitiile de bg sunt taiate).

---

## 8. Portare pe alt site — checklist

1. Copiaza folderul `navbarting/`.
2. Pune `<nav-bar items='[...]'>` + `<script src="nav-bar.js">` (si optional CSS-ul).
3. Seteaza `routing`:
   - site static cu pagini reale → `routing="history"` merge, dar poti lasa si comportamentul nativ cu linkuri normale (copii `<a>`);
   - one-pager cu ancore → `routing="hash"`;
   - SPA cu router propriu → `routing="off"` + `onNavigate`.
4. Ajusteaza tema prin variabile sau `data-theme`.
5. Verifica `z-index` (--nb-z, default 100) sa nu intre sub headerul tau.

---

## 9. Troubleshooting

| Simptom | Cauza probabila | Fix |
|---|---|---|
| Nu apare nimic | `items` JSON invalid (ghilimele simple in loc de duble) | verifica JSON-ul cu `JSON.parse` in consola |
| Highlight ramas la stanga | fonturile se incarca tarziu, latimile se schimba | apeleaza `el.refresh()` pe `window load` / `document.fonts.ready` |
| Click nu navigheaza in SPA | routerul nu asculta `popstate` | foloseste `routing="off"` + `onNavigate: ({href}) => router.go(href)` |
| Text invizibil pe poza deschisa | `contrast="false"` | pune `contrast="true"` (default) |
| Doua navbaruri se bat | ID-uri duplicate | versiunea noua nu mai foloseste ID-uri globale (`#highlight`/`#navBg` eliminate) — fiecare instanta e izolata |
| Stiluri suprascrise de site | selectori generici (`.nav-item`) | redenumit in `.nb-*` + variabile `--nb-*`, specificitate minima |

---

## 10. Ce s-a schimbat fata de `navbar.js`-ul original

- ❌ `NAV_ITEMS_CONFIG` hardcodat → ✅ `items` din atribut / copii / JS.
- ❌ crash daca lipseste GSAP → ✅ fallback nativ automat.
- ❌ `#highlight` / `#navBg` (ID-uri globale, o singura instanta) → ✅ clase + referinte per instanta, mai multe navbaruri pe pagina.
- ❌ clase generice `.nav-*` (risc coliziuni) → ✅ `.nb-*` + CSS vars.
- ❌ doar `history.pushState` → ✅ `history` / `hash` / `off` + hook `onNavigate` + evenimente `nb:navigate`.
- ➕ `setItems / setActive / refresh / destroy`, `NavBar.create / configure`, preseturi, teme, wrapper React, demo, docuri.
- ✅ Comportamentele vizuale pastrate 1:1: magnetic highlight, scale la mousedown, minimal-on-scroll cu hover-expand, contrast sampling (imagini `object-fit: cover` + culori de fundal), layout stabilizer `::after`.
