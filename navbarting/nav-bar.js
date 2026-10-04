/* ─────────────────────────────────────────────────────────────
   navbarting / nav-bar.js — v1.0.0
   Web Component <nav-bar>: pill navbar plug-and-play, zero deps.

   Folosire minima (orice site, fara build):
     <link rel="stylesheet" href="./navbarting/nav-bar.css">
     <nav-bar items='[{"label":"home","href":"/"}]'></nav-bar>
     <script src="./navbarting/nav-bar.js"></script>

   Daca NU incluzi nav-bar.css, componenta isi injecteaza singura
   stilurile (acelasi continut). GSAP e optional: daca exista
   window.gsap e folosit pentru animatii mai fluide, altfel se
   foloseste Web Animations API / style direct — nu crapa niciodata.

   Modulele din ./modules/ (animate.js, contrast.js, config.js) sunt
   versiunile importabile ale acelorasi logici de mai jos, pentru
   cei care vor sa le refoloseasca separat.
   ───────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var VERSION = '1.0.0';
  var STYLE_ID = 'navbarting-styles';
  var TAG = 'nav-bar';

  /* ── 1. Defaults globale (suprascriabile via NavBar.configure) ── */
  var GLOBAL_DEFAULTS = {
    items: [
      { label: 'home', href: '/' },
      { label: 'camera roll', href: '/camera-roll' },
      { label: 'music', href: '/music' },
      { label: 'guestbook', href: '/guestbook' },
    ],
    routing: 'history',       // 'history' | 'hash' | 'off'
    minimalOnScroll: true,    // pila se Strange la scroll in jos
    contrast: true,           // text alb/negru automat in modul minimal
    magnetic: true,           // highlight-ul urmareste mouse-ul
    sticky: true,
    theme: null,              // null | 'light' | 'glass' | 'dark'
    scrollThreshold: 100,
    highlightWidth: 64,
    onNavigate: null,         // fn({label, href, index}) — return false pt. a opri routing-ul default
  };

  /* ── 2. CSS injectat automat (fallback daca nu e link-uit nav-bar.css) ── */
  var FALLBACK_CSS = [
    'nav-bar{--nb-top:24px;--nb-z:100;--nb-side-pad:24px;--nb-bottom-pad:24px;',
    '--nb-bg:#181818;--nb-radius:100px;--nb-bar-pad:6px;',
    '--nb-highlight:rgba(255,255,255,.12);--nb-text:#fff;--nb-font-size:15px;',
    '--nb-item-pad:12px 24px;--nb-item-pad-collapsed:12px 14px;--nb-scale-minimal:.92;',
    'position:sticky;top:var(--nb-top);z-index:var(--nb-z);display:flex;',
    'justify-content:center;padding:0 var(--nb-side-pad) var(--nb-bottom-pad)}',
    'nav-bar[data-sticky="false"]{position:static}',
    '.nb-bar{position:relative;display:flex;align-items:center;padding:6px;',
    'border-radius:100px;will-change:transform;max-width:100%;overflow:hidden}',
    '.nb-bar::after{content:"";position:absolute;inset:0;border:3px solid var(--nb-bg);',
    'border-radius:100px;pointer-events:none;z-index:2;transition:opacity .3s ease}',
    '.nb-bar:has(> .nb-bg.is-minimal)::after{opacity:0}',
    '.nb-bg{position:absolute;inset:0;border-radius:100px;background:var(--nb-bg);',
    'box-shadow:0 4px 20px rgba(0,0,0,.3),0 1px 3px rgba(0,0,0,.2),',
    'inset 0 1px 0 rgba(255,255,255,.05);transition:opacity .3s ease;pointer-events:none}',
    '.nb-bg.is-minimal{opacity:0}',
    '.nb-highlight{position:absolute;top:6px;height:calc(100% - 12px);width:64px;',
    'background:var(--nb-highlight,rgba(255,255,255,.12));border-radius:100px;',
    'pointer-events:none;box-shadow:0 2px 10px rgba(0,0,0,.15);z-index:1;',
    'will-change:transform,left,width,opacity}',
    '.nb-item{position:relative;z-index:2;display:inline-block;padding:var(--nb-item-pad);',
    'color:var(--nb-text,#fff);font-size:var(--nb-font-size,15px);font-weight:500;',
    'cursor:pointer;white-space:nowrap;letter-spacing:-.01em;text-align:center;',
    'text-decoration:none;user-select:none;background:none;border:0;font-family:inherit;line-height:1.2}',
    '.nb-item.active{font-weight:700}',
    '.nb-item::after{content:attr(data-label);display:block;font-weight:700;',
    'visibility:hidden;height:0;overflow:hidden;pointer-events:none}',
    '.nb-item svg{width:18px;height:18px;display:block;color:inherit}',
    '.nb-item:focus-visible{outline:2px solid currentColor;outline-offset:2px;border-radius:100px}',
    'nav-bar[data-theme="light"]{--nb-bg:#f4f4f4;--nb-text:#111;--nb-highlight:rgba(0,0,0,.08)}',
    'nav-bar[data-theme="glass"]{--nb-bg:rgba(24,24,24,.6)}',
    'nav-bar[data-theme="glass"] .nb-bg{backdrop-filter:blur(14px) saturate(1.2);',
    '-webkit-backdrop-filter:blur(14px) saturate(1.2)}',
  ].join('\n');

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    // Daca nav-bar.css e deja link-uit, nu mai injectam duplicat.
    var linked = Array.prototype.some.call(
      document.querySelectorAll('link[rel="stylesheet"]'),
      function (l) { return (l.getAttribute('href') || '').indexOf('nav-bar.css') !== -1; }
    );
    if (linked) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = FALLBACK_CSS;
    document.head.appendChild(style);
  }

  /* ── 3. Animation adapter: GSAP daca exista, altfel nativ ── */
  function hasGsap() {
    return typeof window !== 'undefined' && !!window.gsap;
  }

  var animate = {
    set: function (el, props) {
      if (hasGsap()) { window.gsap.set(el, props); return; }
      if (props.left !== undefined) el.style.left = px(props.left);
      if (props.width !== undefined) el.style.width = px(props.width);
      if (props.scale !== undefined) el.style.transform = 'scale(' + props.scale + ')';
      if (props.opacity !== undefined) el.style.opacity = props.opacity;
      if (props.color !== undefined) el.style.color = props.color;
      if (props.padding !== undefined) el.style.padding = props.padding;
    },
    to: function (el, vars) {
      var opts = vars || {};
      if (hasGsap()) {
        var cfg = {};
        for (var k in opts) {
          if (k === 'duration' || k === 'ease' || k === 'overwrite' || k === 'delay') cfg[k] = opts[k];
          else cfg[k] = opts[k];
        }
        window.gsap.to(el, cfg);
        return;
      }
      // Fallback nativ: tranzitie CSS scurta, apoi set final.
      var duration = (opts.duration !== undefined ? opts.duration : 0.3) * 1000;
      var delay = (opts.delay || 0) * 1000;
      var transitions = [];
      if (opts.left !== undefined || opts.width !== undefined) transitions.push('left .3s ease, width .3s ease');
      if (opts.scale !== undefined) transitions.push('transform .3s ease');
      if (opts.opacity !== undefined) transitions.push('opacity .3s ease');
      if (opts.color !== undefined) transitions.push('color .25s ease');
      if (opts.padding !== undefined) transitions.push('padding .3s ease');
      setTimeout(function () {
        if (!el.isConnected) return;
        if (transitions.length) {
          el.style.transition = transitions.join(', ');
          setTimeout(function () { if (el.isConnected) el.style.transition = ''; }, duration + 60);
        }
        animate.set(el, opts);
      }, delay);
    },
    clamp: function (min, max) {
      if (hasGsap() && window.gsap.utils && window.gsap.utils.clamp) {
        return window.gsap.utils.clamp(min, max);
      }
      return function (v) { return Math.min(max, Math.max(min, v)); };
    },
  };

  function px(v) { return typeof v === 'number' ? v + 'px' : v; }

  /* ── 4. Contrast: sampling de luminanta din spatele navbarului ──
     (aceeasi logica e expusa si ca modul in ./modules/contrast.js) */
  var IMAGE_SAMPLE_SIZE = 64;
  var LUMINANCE_BRIGHT_THRESHOLD = 0.6;
  var imageCanvasCache = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
  var canvasFallback = null;

  function luminance(r, g, b) { return (0.299 * r + 0.587 * g + 0.114 * b) / 255; }

  function getCanvasCtx(img) {
    var size = IMAGE_SAMPLE_SIZE;
    var canvas, ctx;
    if (imageCanvasCache) {
      if (imageCanvasCache.has(img)) return imageCanvasCache.get(img);
      canvas = document.createElement('canvas');
      canvas.width = size; canvas.height = size;
      ctx = canvas.getContext('2d', { willReadFrequently: true });
      try { ctx.drawImage(img, 0, 0, size, size); } catch (e) { return null; }
      var cached = { ctx: ctx, size: size };
      imageCanvasCache.set(img, cached);
      return cached;
    }
    if (!canvasFallback) {
      canvasFallback = document.createElement('canvas');
      canvasFallback.width = size; canvasFallback.height = size;
    }
    ctx = canvasFallback.getContext('2d');
    try { ctx.drawImage(img, 0, 0, size, size); } catch (e) { return null; }
    return { ctx: ctx, size: size };
  }

  function mapToImageCoords(img, x, y) {
    var rect = img.getBoundingClientRect();
    var fit = 'fill';
    try { fit = getComputedStyle(img).objectFit || 'fill'; } catch (e) {}
    if (fit !== 'cover' || !img.naturalWidth) {
      return { nx: (x - rect.left) / rect.width, ny: (y - rect.top) / rect.height };
    }
    var elAsp = rect.width / rect.height;
    var imAsp = img.naturalWidth / img.naturalHeight;
    var rw, rh, ox, oy;
    if (imAsp > elAsp) { rh = rect.height; rw = rect.height * imAsp; ox = (rect.width - rw) / 2; oy = 0; }
    else { rw = rect.width; rh = rect.width / imAsp; ox = 0; oy = (rect.height - rh) / 2; }
    return { nx: (x - rect.left - ox) / rw, ny: (y - rect.top - oy) / rh };
  }

  function sampleImage(img, x, y) {
    if (!img.complete || !img.naturalWidth) return null;
    var p = mapToImageCoords(img, x, y);
    var nx = Math.max(0, Math.min(1, p.nx));
    var ny = Math.max(0, Math.min(1, p.ny));
    try {
      var c = getCanvasCtx(img);
      if (!c) return null;
      var d = c.ctx.getImageData(Math.round(nx * (c.size - 1)), Math.round(ny * (c.size - 1)), 1, 1).data;
      return luminance(d[0], d[1], d[2]);
    } catch (e) { return null; }
  }

  var RGBA_RE = /rgba?\((\d+)\s*,?\s*(\d+)\s*,?\s*(\d+)(?:\s*,?\s*([\d.]+))?\)/;
  function sampleAtPoint(x, y) {
    var els;
    try { els = document.elementsFromPoint(x, y); }
    catch (e) { return null; }
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.tagName === 'BODY' || el.tagName === 'HTML') continue;
      // Ignora chiar navbarul (altfel isi masoara propriul bg)
      if (el.closest && el.closest(TAG)) continue;
      if (el.tagName === 'IMG') {
        var lum = sampleImage(el, x, y);
        if (lum !== null) return lum;
        continue;
      }
      var bg = '';
      try { bg = getComputedStyle(el).backgroundColor; } catch (e) {}
      var m = bg && bg.match(RGBA_RE);
      if (m) {
        var alpha = m[4] ? parseFloat(m[4]) : 1;
        if (alpha > 0.1) return luminance(+m[1], +m[2], +m[3]);
      }
    }
    return null;
  }

  /* ── 5. Helpers config ── */
  function toBool(v, fallback) {
    if (v === null || v === undefined) return fallback;
    if (typeof v === 'boolean') return v;
    var s = String(v).toLowerCase();
    if (s === 'false' || s === '0' || s === 'no' || s === 'off') return false;
    if (s === 'true' || s === '1' || s === 'yes' || s === 'on' || s === '') return true;
    return fallback;
  }

  function parseItemsAttr(raw, fallback) {
    if (!raw) {
      // Suport si pentru copii declarativi: <nav-bar><a href="/">home</a></nav-bar>
      return fallback;
    }
    try {
      var arr = JSON.parse(raw);
      if (Array.isArray(arr)) return arr.filter(function (it) { return it && it.label; });
    } catch (e) { /* fallthrough spre CSV */ }
    // Fallback CSV: "home:/, music:/music"
    return String(raw).split(',').map(function (s) { return s.trim(); }).filter(Boolean)
      .map(function (s) {
        var parts = s.split(':');
        return parts.length > 1
          ? { label: parts[0].trim(), href: parts.slice(1).join(':').trim() }
          : { label: s, href: '#' };
      });
  }

  function currentPath(routing) {
    if (routing === 'hash') {
      return window.location.hash.replace(/^#/, '') || '/';
    }
    try { return window.location.pathname || '/'; }
    catch (e) { return '/'; }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ── 6. Web Component ── */
  var NavBarProto = Object.create(HTMLElement.prototype);

  function readOptionsFromAttrs(el) {
    var g = (typeof window !== 'undefined' && window.NavBar && window.NavBar.defaults) || {};
    function pick(key) {
      var attr = el.getAttribute(key);
      if (attr !== null) return attr;
      if (g[key] !== undefined) return g[key];
      return GLOBAL_DEFAULTS[key];
    }
    var itemsRaw = el.getAttribute('items');
    var items;
    if (itemsRaw) items = parseItemsAttr(itemsRaw, GLOBAL_DEFAULTS.items);
    else if (el._items) items = el._items;
    else if (g.items) items = g.items;
    else items = GLOBAL_DEFAULTS.items;

    return {
      items: items,
      routing: pick('routing'),
      minimalOnScroll: toBool(el.getAttribute('minimal-on-scroll') !== null
        ? el.getAttribute('minimal-on-scroll') : (g.minimalOnScroll !== undefined ? g.minimalOnScroll : GLOBAL_DEFAULTS.minimalOnScroll), true),
      contrast: toBool(el.getAttribute('contrast') !== null
        ? el.getAttribute('contrast') : (g.contrast !== undefined ? g.contrast : GLOBAL_DEFAULTS.contrast), true),
      magnetic: toBool(el.getAttribute('magnetic') !== null
        ? el.getAttribute('magnetic') : (g.magnetic !== undefined ? g.magnetic : GLOBAL_DEFAULTS.magnetic), true),
      sticky: toBool(el.getAttribute('sticky') !== null
        ? el.getAttribute('sticky') : (g.sticky !== undefined ? g.sticky : GLOBAL_DEFAULTS.sticky), true),
      scrollThreshold: parseInt(pick('scroll-threshold') || pick('scrollThreshold') || 100, 10) || 100,
      onNavigate: el._onNavigate || g.onNavigate || null,
    };
  }

  function renderTemplate(el, items, activePath) {
    var html = items.map(function (item, i) {
      var isActive = item.href === activePath || (item.exact === false && activePath.indexOf(item.href) === 0);
      // Escape href separat (permite doar caractere safe-ish, fara javascript:)
      var href = String(item.href || '#');
      if (/^\s*javascript:/i.test(href)) href = '#';
      return '<a class="nb-item' + (isActive ? ' active' : '') + '"' +
        ' data-label="' + escapeHtml(item.label) + '"' +
        ' data-index="' + i + '"' +
        ' data-href="' + escapeHtml(href) + '"' +
        ' href="' + escapeHtml(href) + '"' +
        ' role="link" tabindex="0">' + escapeHtml(item.label) + '</a>';
    }).join('\n');
    el.innerHTML =
      '<div class="nb-bar">' +
      '<div class="nb-bg"></div>' +
      '<div class="nb-highlight"></div>' +
      html +
      '</div>';
  }

  function collectDeclarativeChildren(el) {
    var anchors = el.querySelectorAll('a[href]');
    if (!anchors.length) return null;
    // Daca continutul e deja randat de noi (are .nb-bar), nu-l confunda cu declarativ.
    if (el.querySelector('.nb-bar')) return null;
    return Array.prototype.map.call(anchors, function (a) {
      return { label: (a.textContent || '').trim() || a.getAttribute('href'), href: a.getAttribute('href') };
    });
  }

  var NavBar = {
    version: VERSION,
    defaults: Object.assign({}, GLOBAL_DEFAULTS),

    /** Suprascrie defaulturile globale: NavBar.configure({routing:'off'}) */
    configure: function (opts) {
      Object.assign(NavBar.defaults, opts || {});
      return NavBar.defaults;
    },

    /**
     * Creeaza un navbar din JS, fara HTML declarativ:
     *   NavBar.create('#header', { items: [...], onNavigate: fn })
     */
    create: function (target, options) {
      ensureStyles();
      var host = typeof target === 'string' ? document.querySelector(target) : target;
      if (!host) throw new Error('[navbarting] NavBar.create: target negasit: ' + target);
      var el = document.createElement(TAG);
      options = options || {};
      if (options.items) el._items = options.items;
      if (options.onNavigate) el._onNavigate = options.onNavigate;
      ['routing', 'theme', 'sticky', 'scroll-threshold'].forEach(function (k) {
        if (options[k] !== undefined) el.setAttribute(k, String(options[k]));
      });
      ['minimalOnScroll', 'contrast', 'magnetic', 'sticky'].forEach(function (k) {
        var attr = k.replace(/[A-Z]/g, function (c) { return '-' + c.toLowerCase(); });
        if (options[k] !== undefined) el.setAttribute(attr, String(options[k]));
      });
      if (options.theme) el.setAttribute('data-theme', options.theme);
      if (options.sticky === false) el.setAttribute('data-sticky', 'false');
      host.appendChild(el);
      return el;
    },
  };

  /* Compara shallow doua liste de items (label + href). */
  function sameItems(a, b) {
    if (a === b) return true;
    if (!a || !b || a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) {
      if (a[i].label !== b[i].label) return false;
      if ((a[i].href || '#') !== (b[i].href || '#')) return false;
    }
    return true;
  }

  function snapHighlight(inst) {
    var active = inst.root.querySelector('.nb-item.active');
    if (!active) return;
    var barRect = inst.bar.getBoundingClientRect();
    var itemRect = active.getBoundingClientRect();
    animate.set(inst.highlight, {
      left: itemRect.left - barRect.left,
      width: active.offsetWidth,
    });
  }

  function setTextColor(inst, color) {
    if (color === inst.textColor) return;
    inst.textColor = color;
    inst.items.forEach(function (item) {
      if (hasGsap()) animate.to(item, { color: color, duration: 0.25, overwrite: 'auto' });
      else item.style.color = color;
    });
  }

  function isBackgroundBright(inst) {
    var rect = inst.bar.getBoundingClientRect();
    var y = rect.top + rect.height / 2;
    var ratios = [0.15, 0.3, 0.5, 0.7, 0.85];
    var prevVisibility = inst.bar.style.visibility;
    inst.bar.style.visibility = 'hidden';
    var total = 0, count = 0;
    for (var i = 0; i < ratios.length; i++) {
      var lum = sampleAtPoint(rect.left + rect.width * ratios[i], y);
      if (lum !== null) { total += lum; count++; }
    }
    inst.bar.style.visibility = prevVisibility;
    if (!count) return false;
    return total / count > LUMINANCE_BRIGHT_THRESHOLD;
  }

  function updateContrast(inst) {
    if (!inst.opts.contrast) return;
    if (inst.bg.classList.contains('is-minimal')) {
      var now = (window.performance && performance.now()) || Date.now();
      if (now - inst.lastContrastCheck < 120) return;
      inst.lastContrastCheck = now;
      setTextColor(inst, isBackgroundBright(inst) ? '#000000' : '#ffffff');
    } else {
      // In modul expandat pila e opaca -> textul default din CSS.
      inst.textColor = null;
      inst.items.forEach(function (item) { item.style.color = ''; });
    }
  }

  function layoutAnimate(inst, scale, padding) {
    animate.to(inst.bar, { scale: scale, duration: 0.3 });
    inst.items.forEach(function (item) { animate.to(item, { padding: padding, duration: 0.3 }); });
  }

  /* ── Lifecycle ── */
  function connected(el) {
    ensureStyles();
    if (el._nbMounted) { refresh(el); return; }
    el._nbMounted = true;

    var opts = readOptionsFromAttrs(el);
    var declarative = collectDeclarativeChildren(el);
    if (declarative) opts.items = declarative;

    if (el.getAttribute('data-sticky') === null) {
      el.setAttribute('data-sticky', opts.sticky ? 'true' : 'false');
    }
    var themeAttr = el.getAttribute('theme');
    if (themeAttr && !el.getAttribute('data-theme')) el.setAttribute('data-theme', themeAttr);

    var activeAttr = el.getAttribute('active');
    var activePath = activeAttr || currentPath(opts.routing);

    // Suport iconite: items pot avea `icon` (svg string) — randat inainte de label.
    renderTemplate(el, opts.items, activePath);

    if (opts.items.some(function (it) { return it.icon; })) {
      opts.items.forEach(function (item, i) {
        if (!item.icon) return;
        var node = el.querySelector('.nb-item[data-index="' + i + '"]');
        if (node) node.insertAdjacentHTML('afterbegin', item.icon);
      });
    }

    var inst = {
      root: el,
      opts: opts,
      bar: el.querySelector('.nb-bar'),
      bg: el.querySelector('.nb-bg'),
      highlight: el.querySelector('.nb-highlight'),
      items: Array.prototype.slice.call(el.querySelectorAll('.nb-item')),
      isMinimal: false,
      lastScrollY: window.scrollY || 0,
      textColor: null,
      lastContrastCheck: 0,
      listeners: [],
      highlightWidth: opts.highlightWidth || GLOBAL_DEFAULTS.highlightWidth,
    };
    el._nb = inst;

    // Pozitie initiala highlight
    animate.set(inst.highlight, { left: 12, width: inst.highlightWidth });
    requestAnimationFrame(function () { if (el.isConnected) snapHighlight(inst); });
    window.addEventListener('load', snapHighlight.bind(null, inst));
    window.addEventListener('resize', snapHighlight.bind(null, inst));

    bindMouse(inst);
    bindNavigation(inst);
    bindScroll(inst);
    bindContrastCacheBust();

    requestAnimationFrame(function () { updateContrast(inst); });

    // API publica pe element
    el.setItems = function (items) {
      // Fara rebuild daca items sunt neschimbate: renderTemplate recreeaza
      // highlight-ul nepozitionat (sare pe primul buton) pana la urmatorul snap.
      if (sameItems(items, inst.opts.items)) {
        setActivePath(inst, el.getAttribute('active') || currentPath(inst.opts.routing));
        return el;
      }
      // Rebuild real: scapa de listenerii vechi pe window (cei pe bar mor odata cu DOM-ul).
      inst.listeners = inst.listeners.filter(function (l) {
        if (l.t === window && (l.e === 'popstate' || l.e === 'hashchange')) {
          try { window.removeEventListener(l.e, l.fn, l.o); } catch (e) {}
          return false;
        }
        return true;
      });
      inst.opts.items = items;
      var path = el.getAttribute('active') || currentPath(inst.opts.routing);
      renderTemplate(el, items, path);
      inst.bar = el.querySelector('.nb-bar');
      inst.bg = el.querySelector('.nb-bg');
      inst.highlight = el.querySelector('.nb-highlight');
      inst.items = Array.prototype.slice.call(el.querySelectorAll('.nb-item'));
      bindMouse(inst);
      bindNavigation(inst);
      requestAnimationFrame(function () { snapHighlight(inst); });
      return el;
    };
    el.setActive = function (path) {
      el.setAttribute('active', path);
      setActivePath(inst, path);
      return el;
    };
    el.refresh = function () { snapHighlight(inst); updateContrast(inst); return el; };
    el.destroy = function () {
      inst.listeners.forEach(function (l) { l.t.removeEventListener(l.e, l.fn, l.o); });
      inst.listeners = [];
      el._nbMounted = false;
      return el;
    };
  }

  function on(el, target, evt, fn, opts) {
    target.addEventListener(evt, fn, opts);
    if (el._nb) el._nb.listeners.push({ t: target, e: evt, fn: fn, o: opts });
  }

  function bindMouse(inst) {
    var el = inst.root;
    if (!inst.opts.magnetic) return;
    on(el, inst.bar, 'mousedown', function () {
      animate.to(inst.highlight, { scale: 1.18, duration: 0.12 });
    });
    on(el, inst.bar, 'mouseup', function () {
      animate.to(inst.highlight, { scale: 1, duration: 0.15 });
    });
    on(el, inst.bar, 'mouseleave', function () {
      animate.to(inst.highlight, { scale: 1, duration: 0.15 });
      moveHighlightToActive(inst);
    });
    on(el, inst.bar, 'mousemove', function (ev) { trackHighlight(inst, ev); });
  }

  function closestItem(inst, barRect, cursorX) {
    var best = null, min = Infinity;
    inst.items.forEach(function (item) {
      var r = item.getBoundingClientRect();
      var cx = r.left - barRect.left + r.width / 2;
      var d = Math.abs(cursorX - cx);
      if (d < min) { min = d; best = { centerX: cx, width: item.offsetWidth, dist: d }; }
    });
    return best;
  }

  function trackHighlight(inst, ev) {
    var barRect = inst.bar.getBoundingClientRect();
    var cursorX = ev.clientX - barRect.left;
    var near = closestItem(inst, barRect, cursorX);
    if (!near) return;
    var zone = near.width || 64;
    var t = Math.max(0, Math.min(1, near.dist / zone));
    var pull = Math.sqrt(1 - t);
    var targetW = inst.highlightWidth + (near.width - inst.highlightWidth) * pull;
    var barW = inst.bar.offsetWidth;
    var clampPos = animate.clamp(6, Math.max(6, barW - targetW - 6));
    var free = clampPos(cursorX - targetW / 2);
    var snap = near.centerX - targetW / 2;
    var left = clampPos(free + (snap - free) * pull);
    animate.to(inst.highlight, { left: left, width: targetW, duration: 0.35 });
  }

  function moveHighlightToActive(inst) {
    var active = inst.root.querySelector('.nb-item.active');
    if (!active) return;
    var barRect = inst.bar.getBoundingClientRect();
    var r = active.getBoundingClientRect();
    animate.to(inst.highlight, {
      left: r.left - barRect.left, width: active.offsetWidth, duration: 0.35,
    });
  }

  /* ── Navigatie agnostica de router ── */
  function bindNavigation(inst) {
    var el = inst.root;
    setActivePath(inst, el.getAttribute('active') || currentPath(inst.opts.routing), true);

    on(el, inst.bar, 'click', function (ev) {
      var item = ev.target.closest ? ev.target.closest('.nb-item') : null;
      if (!item) return;
      var href = item.getAttribute('data-href');
      var idx = parseInt(item.getAttribute('data-index'), 10);
      var meta = { label: item.getAttribute('data-label'), href: href, index: idx, element: item };

      // 1. Hook utilizator (poate face integrarea cu wouter/react-router/etc.)
      if (typeof inst.opts.onNavigate === 'function') {
        var r = inst.opts.onNavigate(meta);
        if (r === false) { ev.preventDefault(); return; }
      }

      // 2. Comportament default pe baza de `routing`
      if (inst.opts.routing === 'off') {
        ev.preventDefault();
        setActivePath(inst, href);
        emit(el, 'nb:navigate', meta);
        emit(el, 'nb:active-change', meta);
        return;
      }
      if (inst.opts.routing === 'hash') {
        // Lasa anchor-ul sa schimbe hash-ul; doar marcheaza activ + emite.
        setActivePath(inst, href);
        emit(el, 'nb:navigate', meta);
        return;
      }
      // history (default): SPA navigation + popstate ca sa prinda si wouter & co.
      if (href && href.charAt(0) === '/' && href !== currentPath('history')) {
        ev.preventDefault();
        try { history.pushState(null, '', href); } catch (e) { /* file:// */ }
        setActivePath(inst, href);
        emit(el, 'nb:navigate', meta);
        try { window.dispatchEvent(new PopStateEvent('popstate')); } catch (e) {
          window.dispatchEvent(new Event('popstate'));
        }
      } else if (href && href.charAt(0) !== '/' && href !== '#') {
        // Link extern: lasa browserul sa navigheze normal.
      } else {
        ev.preventDefault();
        setActivePath(inst, href);
        emit(el, 'nb:navigate', meta);
      }
    });

    on(el, inst.bar, 'keydown', function (ev) {
      if (ev.key !== 'Enter' && ev.key !== ' ') return;
      var item = ev.target.closest ? ev.target.closest('.nb-item') : null;
      if (item) { ev.preventDefault(); item.click(); }
    });

    // Back/forward din browser + routere externe -> resincronizeaza activul
    var sync = function () {
      if (el.getAttribute('active')) return; // activ fortat manual
      setActivePath(inst, currentPath(inst.opts.routing), true);
    };
    on(el, window, 'popstate', sync);
    on(el, window, 'hashchange', sync);
  }

  function setActivePath(inst, path, silent) {
    inst.items.forEach(function (item) {
      var href = item.getAttribute('data-href');
      item.classList.toggle('active', href === path);
    });
    if (!silent) moveHighlightToActive(inst);
    else if (inst.root.isConnected) requestAnimationFrame(function () { moveHighlightToActive(inst); });
  }

  function emit(el, name, detail) {
    try { el.dispatchEvent(new CustomEvent(name, { detail: detail, bubbles: true })); }
    catch (e) { /* CustomEvent indisponibil (IE) — ignora */ }
  }

  /* ── Scroll: minimal/expand + hover-expand ── */
  function bindScroll(inst) {
    var el = inst.root;
    if (!inst.opts.minimalOnScroll) return;

    var EXPANDED = ''; // padding default vine din CSS (var --nb-item-pad)
    var COLLAPSED = '12px 14px';

    function toMinimal() {
      if (inst.isMinimal) return;
      inst.isMinimal = true;
      inst.bg.classList.add('is-minimal');
      animate.to(inst.highlight, { opacity: 0, duration: 0.08 });
      animate.to(inst.bar, { scale: 0.92, duration: 0.3 });
      inst.items.forEach(function (item) {
        item.dataset.nbPad = item.style.padding || '';
        animate.to(item, { padding: COLLAPSED, duration: 0.3 });
      });
      updateContrast(inst);
    }
    function toExpanded() {
      if (!inst.isMinimal) return;
      inst.isMinimal = false;
      inst.bg.classList.remove('is-minimal');
      animate.to(inst.bar, { scale: 1, duration: 0.3 });
      inst.items.forEach(function (item) { animate.to(item, { padding: EXPANDED || '12px 24px', duration: 0.3 }); });
      animate.to(inst.highlight, { opacity: 1, duration: 0.6 });
      updateContrast(inst);
    }
    inst._toMinimal = toMinimal;
    inst._toExpanded = toExpanded;

    on(el, window, 'scroll', function () {
      var dir = (window.scrollY || 0) - inst.lastScrollY;
      inst.lastScrollY = window.scrollY || 0;
      if (dir > 0 && window.scrollY > inst.opts.scrollThreshold) toMinimal();
      else if (dir < 0) toExpanded();
      updateContrast(inst);
    }, { passive: true });

    on(el, el, 'mouseenter', function () {
      if (!inst.isMinimal) return;
      inst.bg.classList.remove('is-minimal');
      animate.to(inst.bar, { scale: 1, duration: 0.3 });
      inst.items.forEach(function (item) { animate.to(item, { padding: EXPANDED || '12px 24px', duration: 0.3 }); });
      animate.to(inst.highlight, { opacity: 1, duration: 0.5 });
      setTextColor(inst, '#ffffff');
    });
    on(el, el, 'mouseleave', function () {
      if (!inst.isMinimal) return;
      inst.bg.classList.add('is-minimal');
      animate.to(inst.bar, { scale: 0.92, duration: 0.3 });
      inst.items.forEach(function (item) { animate.to(item, { padding: COLLAPSED, duration: 0.3 }); });
      animate.to(inst.highlight, { opacity: 0, duration: 0.08 });
      inst.lastContrastCheck = 0;
      updateContrast(inst);
    });
  }

  var contrastCacheHooked = false;
  function bindContrastCacheBust() {
    if (contrastCacheHooked) return;
    contrastCacheHooked = true;
    document.addEventListener('load', function (ev) {
      if (ev.target && ev.target.tagName === 'IMG' && imageCanvasCache) {
        try { imageCanvasCache.delete(ev.target); } catch (e) {}
      }
    }, true);
  }

  function refresh(el) {
    if (el._nb) { snapHighlight(el._nb); updateContrast(el._nb); }
  }

  /* ── Definire element ── */
  function define() {
    ensureStyles();
    if (window.customElements && !window.customElements.get(TAG)) {
      class NavBarEl extends HTMLElement {
        connectedCallback() { connected(this); }
        disconnectedCallback() {
          if (this._nb) {
            this._nb.listeners.forEach(function (l) { l.t.removeEventListener(l.e, l.fn, l.o); });
            this._nb.listeners = [];
          }
          this._nbMounted = false;
        }
        attributeChangedCallback(name) {
          if (!this._nbMounted) return;
          if (name === 'items') {
            try {
              var items = parseItemsAttr(this.getAttribute('items'), this._nb.opts.items);
              this.setItems(items);
            } catch (e) {}
          } else if (name === 'active') {
            setActivePath(this._nb, this.getAttribute('active'));
          } else if (name === 'routing') {
            // Wrapperul React seteaza atributele imperativ dupa mount;
            // fara asta, opts.routing ramanea 'history' si click-ul dadea
            // pushState pe href-ul absolut (/acasa -> radacina domeniului).
            this._nb.opts.routing = this.getAttribute('routing') || 'history';
          }
        }
        static get observedAttributes() { return ['items', 'active', 'routing']; }
      }
      window.customElements.define(TAG, NavBarEl);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', define);
  } else {
    define();
  }

  window.NavBar = NavBar;
  window.NavBar.animate = animate;
})();
