/* Motor de diseño: color, tipografías y construcción de cada escarapela.
 * Todo se mide en milímetros (mm) y puntos tipográficos (pt): son unidades físicas,
 * por eso lo que se ve en la vista previa es exactamente lo que sale impreso. */
(function (global) {
  'use strict';

  var PX_PER_MM = 96 / 25.4;

  /* ---------- Tipografías (Google Fonts) ----------
   * Cada familia se carga en su propio <link>: si una falla, las demás siguen funcionando. */
  var FONTS = [
    { name: 'Montserrat', q: 'Montserrat:wght@400;600;700;800', cat: 'sans-serif' },
    { name: 'Poppins', q: 'Poppins:ital,wght@0,400;0,600;0,700;0,800;1,400', cat: 'sans-serif' },
    { name: 'Orbitron', q: 'Orbitron:wght@400;600;700;800', cat: 'sans-serif' },
    { name: 'Exo 2', q: 'Exo+2:wght@400;600;700;800', cat: 'sans-serif' },
    { name: 'Rajdhani', q: 'Rajdhani:wght@400;600;700', cat: 'sans-serif' },
    { name: 'Audiowide', q: 'Audiowide', cat: 'sans-serif' },
    { name: 'Russo One', q: 'Russo+One', cat: 'sans-serif' },
    { name: 'Oswald', q: 'Oswald:wght@400;600;700', cat: 'sans-serif' },
    { name: 'Bebas Neue', q: 'Bebas+Neue', cat: 'sans-serif' },
    { name: 'Anton', q: 'Anton', cat: 'sans-serif' },
    { name: 'Barlow Condensed', q: 'Barlow+Condensed:wght@400;600;700', cat: 'sans-serif' },
    { name: 'Raleway', q: 'Raleway:wght@400;600;700;800', cat: 'sans-serif' },
    { name: 'Roboto', q: 'Roboto:wght@400;700', cat: 'sans-serif' },
    { name: 'Lato', q: 'Lato:wght@400;700', cat: 'sans-serif' },
    { name: 'Nunito', q: 'Nunito:wght@400;700;800', cat: 'sans-serif' },
    { name: 'Righteous', q: 'Righteous', cat: 'sans-serif' },
    { name: 'Playfair Display', q: 'Playfair+Display:wght@400;700', cat: 'serif' },
    { name: 'Merriweather', q: 'Merriweather:wght@400;700', cat: 'serif' },
    { name: 'Dancing Script', q: 'Dancing+Script:wght@400;700', cat: 'cursive' },
    { name: 'Pacifico', q: 'Pacifico', cat: 'cursive' }
  ];
  var SIZES = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 20, 22, 24, 26, 28, 30, 32, 36, 40, 44, 48, 54, 60, 72];

  function loadFonts() {
    FONTS.forEach(function (f) {
      var l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = 'https://fonts.googleapis.com/css2?family=' + f.q + '&display=swap';
      document.head.appendChild(l);
    });
  }
  function fontStack(name) {
    var f = FONTS.filter(function (x) { return x.name === name; })[0];
    return "'" + name + "', " + (f ? f.cat : 'sans-serif');
  }

  /* ---------- Utilidades de color ---------- */
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function normHue(h) { return ((h % 360) + 360) % 360; }

  function hexToRgb(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
    if (!m) return null;
    var n = parseInt(m[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(function (v) { return ('0' + Math.round(clamp(v, 0, 255)).toString(16)).slice(-2); }).join('');
  }
  function hexToHsl(hex) {
    var c = hexToRgb(hex) || { r: 57, g: 169, b: 0 };
    var r = c.r / 255, g = c.g / 255, b = c.b / 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var h = 0, s = 0, l = (max + min) / 2;
    if (max !== min) {
      var d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
    }
    return { h: h, s: s * 100, l: l * 100 };
  }
  function hslToHex(h, s, l) {
    h = normHue(h); s = clamp(s, 0, 100) / 100; l = clamp(l, 0, 100) / 100;
    var c = (1 - Math.abs(2 * l - 1)) * s;
    var x = c * (1 - Math.abs((h / 60) % 2 - 1));
    var m = l - c / 2, r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; } else if (h < 120) { r = x; g = c; } else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; } else if (h < 300) { r = x; b = c; } else { r = c; b = x; }
    return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
  }
  function luminance(hex) {
    var c = hexToRgb(hex) || { r: 0, g: 0, b: 0 };
    var a = [c.r, c.g, c.b].map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
  }
  function contrast(a, b) {
    var l1 = luminance(a), l2 = luminance(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  }
  // Texto legible (blanco o casi negro) sobre un color dado — criterio WCAG
  function readableOn(bg) { return contrast(bg, '#ffffff') >= contrast(bg, '#141414') ? '#ffffff' : '#141414'; }
  // Si el color no contrasta lo suficiente con el fondo, se usa la alternativa segura
  function ensure(color, bg, fallback, min) { return contrast(color, bg) >= (min || 3) ? color : fallback; }
  function mix(a, b, t) {
    var x = hexToRgb(a), y = hexToRgb(b);
    return rgbToHex(x.r + (y.r - x.r) * t, x.g + (y.g - x.g) * t, x.b + (y.b - x.b) * t);
  }
  function rgba(hex, a) { var c = hexToRgb(hex) || { r: 0, g: 0, b: 0 }; return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + a + ')'; }

  /* ---------- Paletas armónicas a partir de un color ----------
   * Rueda cromática: monocromática, análoga, complementaria, triádica, complementaria dividida.
   * Cada paleta produce 5 roles: principal, secundario, acento, oscuro, claro. */
  var SCHEMES = [
    { id: 'monocromatica', name: 'Monocromática', hues: [0, 0, 0] },
    { id: 'analoga', name: 'Análoga', hues: [0, 32, -32] },
    { id: 'complementaria', name: 'Complementaria', hues: [0, 0, 180] },
    { id: 'triadica', name: 'Triádica', hues: [0, 120, 240] },
    { id: 'dividida', name: 'Compl. dividida', hues: [0, 150, 210] }
  ];

  function makePalette(baseHex, schemeId) {
    var scheme = SCHEMES.filter(function (s) { return s.id === schemeId; })[0] || SCHEMES[1];
    var b = hexToHsl(baseHex);
    var h = b.h, s = b.s < 8 ? b.s : Math.max(b.s, 45); // grises se respetan como grises
    var mono = scheme.id === 'monocromatica';
    var primary = hslToHex(h, s, clamp(b.l, 34, 56));
    var secondary = hslToHex(h + scheme.hues[1], s * 0.92, mono ? 26 : (scheme.id === 'complementaria' ? 30 : 44));
    var accent = hslToHex(h + scheme.hues[2], Math.min(100, s + 12), mono ? 72 : 60);
    var dark = hslToHex(h, Math.min(s, 65), 11);
    var light = hslToHex(h, Math.min(s, 45), 96);
    return { primary: primary, secondary: secondary, accent: accent, dark: dark, light: light };
  }

  /* Variables de color del diseño según tema (oscuro/claro), con control de contraste */
  function themeVars(p, theme) {
    var v = {};
    if (theme === 'claro') {
      v.bg1 = p.light;
      v.bg2 = mix(p.light, p.primary, 0.22);
      var bgMid = mix(v.bg1, v.bg2, 0.5);
      v.head = ensure(p.dark, bgMid, '#141414', 4.5);
      v.title1 = ensure(p.primary, bgMid, p.dark, 3);
      v.title2 = ensure(p.secondary, bgMid, p.dark, 4.5);
      v.title3 = ensure(mix(p.dark, p.primary, 0.35), bgMid, '#222222', 4.5);
      v.pattern = rgba(p.primary, 0.16);
      v.wave = rgba(p.primary, 0.9);
      v.wave2 = rgba(p.accent, 0.55);
    } else {
      v.bg1 = p.dark;
      v.bg2 = mix(p.dark, p.primary, 0.75);
      var mid = mix(v.bg1, v.bg2, 0.5);
      v.head = ensure(p.light, mid, '#ffffff', 4.5);
      v.title1 = ensure(p.accent, mid, '#ffffff', 3);
      v.title2 = '#ffffff';
      v.title3 = ensure(mix(p.light, p.accent, 0.35), mid, '#ffffff', 4.5);
      v.pattern = rgba(p.accent, 0.22);
      v.wave = rgba(p.secondary, 0.85);
      v.wave2 = rgba(p.accent, 0.45);
    }
    v.boxBg = '#ffffff';
    v.boxBorder = p.accent;
    v.boxText = ensure(p.dark, '#ffffff', '#141414', 7);
    v.chipBg = theme === 'claro' ? p.primary : p.accent;
    v.chipText = readableOn(v.chipBg);
    v.accent = p.accent;
    v.primary = p.primary;
    return v;
  }

  /* ---------- Patrones decorativos (SVG embebido, escala con la escarapela) ---------- */
  function svgUrl(svg) { return 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")'; }
  function patternCss(kind, color) {
    var c = color;
    switch (kind) {
      case 'circuitos':
        return svgUrl('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80" fill="none" stroke="' + c + '" stroke-width="1.2">' +
          '<path d="M0 20h22l8 8h20M80 20H62l-6-6V0M40 80V58l8-8h32M0 60h14l8-8V36"/>' +
          '<circle cx="50" cy="28" r="2.4" fill="' + c + '"/><circle cx="56" cy="14" r="2.4"/><circle cx="40" cy="58" r="2.4" fill="' + c + '"/><circle cx="22" cy="36" r="2.4"/></svg>');
      case 'puntos':
        return svgUrl('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><circle cx="8" cy="8" r="1.3" fill="' + c + '"/></svg>');
      case 'hexagonos':
        return svgUrl('<svg xmlns="http://www.w3.org/2000/svg" width="42" height="72.75" viewBox="0 0 42 72.75" fill="none" stroke="' + c + '" stroke-width="1.1">' +
          '<path d="M21 0l21 12.12v24.25L21 48.5 0 36.37V12.12zM21 48.5v24.25"/></svg>');
      case 'ondas':
        return svgUrl('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="30" viewBox="0 0 120 30" fill="none" stroke="' + c + '" stroke-width="1.2">' +
          '<path d="M0 15c20-14 40-14 60 0s40 14 60 0"/></svg>');
      default:
        return 'none';
    }
  }

  /* ---------- Construcción ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }
  function isImg(src) { return typeof src === 'string' && /^data:image\/(png|jpeg|jpg|gif|webp|svg\+xml);base64,/i.test(src); }

  function styleOf(st) {
    return 'font-family:' + fontStack(st.font) + ';font-size:' + st.size + 'pt;font-weight:' + (st.bold ? 700 : 400) +
      ';text-transform:' + (st.upper ? 'uppercase' : 'none') + ';font-style:' + (st.italic ? 'italic' : 'normal') + ';';
  }

  /* Texto de un campo: valor real, o la sugerencia en gris (solo en modo edición) */
  function textEl(cls, value, placeholder, st, mode) {
    var v = String(value || '').trim();
    if (!v && mode !== 'edit') return '';
    var ghost = !v;
    return '<div class="' + cls + (ghost ? ' ghost' : '') + '" data-base="' + st.size + '" style="' + styleOf(st) + '">' +
      esc(ghost ? placeholder : v) + '</div>';
  }

  /**
   * Crea el nodo de una escarapela.
   * @param {object} d  diseño (state.design)
   * @param {object} person {name, role}
   * @param {'edit'|'final'} mode  'edit' muestra sugerencias en gris; 'final' es lo que se imprime
   */
  function build(d, person, mode, placeholders) {
    var ph = placeholders || {};
    var v = themeVars(d.palette, d.theme);
    var el = document.createElement('div');
    el.className = 'badge theme-' + d.theme + (d.slot ? ' has-slot' : '');
    el.style.width = d.size.w + 'mm';
    el.style.height = d.size.h + 'mm';
    var vars = {
      '--bg1': v.bg1, '--bg2': v.bg2, '--head': v.head, '--t1': v.title1, '--t2': v.title2, '--t3': v.title3,
      '--box-bg': v.boxBg, '--box-border': v.boxBorder, '--box-text': v.boxText, '--chip-bg': v.chipBg,
      '--chip-text': v.chipText, '--accent': v.accent, '--primary': v.primary, '--wave': v.wave, '--wave2': v.wave2,
      '--overlay': String(d.bg ? d.overlay / 100 : 1), '--foot-h': d.footSize + 'mm', '--logo-h': d.logoSize + 'mm', '--name-h': (d.size.h * 0.16).toFixed(2) + 'mm'
    };
    Object.keys(vars).forEach(function (k) { el.style.setProperty(k, vars[k]); });

    var S = d.styles, T = d.texts;
    var name = String((person && person.name) || '').trim();
    var role = String((person && person.role) || '').trim() || String(T.role || '').trim();
    var feet = d.foot || [];
    var hasFoot = feet.some(isImg);

    var html = '';
    html += isImg(d.bg) ? '<div class="b-bg" style="background-image:url(\'' + d.bg + '\')"></div>' : '';
    html += '<div class="b-tint"></div>';
    var PSIZE = { circuitos: '26mm auto', puntos: '4mm 4mm', hexagonos: '10mm auto', ondas: '22mm auto' };
    html += d.pattern !== 'ninguno' ? '<div class="b-pattern" style="background-size:' + (PSIZE[d.pattern] || 'auto') + ';background-image:' + patternCss(d.pattern, v.pattern).replace(/"/g, '&quot;') + '"></div>' : '';
    var waveSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 30" preserveAspectRatio="none">' +
      '<path d="M0 12 C 25 2, 55 24, 100 8 L100 30 L0 30 Z" fill="' + v.wave2 + '"/>' +
      '<path d="M0 18 C 30 8, 60 30, 100 14 L100 30 L0 30 Z" fill="' + v.wave + '"/></svg>';
    html += '<div class="b-wave" style="background-image:' + svgUrl(waveSvg).replace(/"/g, '&quot;') + '"></div>';
    html += '<div class="b-topbar"></div>';
    html += d.slot ? '<div class="b-slot"></div>' : '';

    html += '<div class="b-content">';
    html += '<header class="b-head">' +
      textEl('b-h1', T.h1, ph.h1, S.h1, mode) + textEl('b-h2', T.h2, ph.h2, S.h2, mode) + '</header>';

    if (isImg(d.logo)) {
      html += '<div class="b-logo pos-' + d.logoPos + '"><img src="' + d.logo + '" alt=""></div>';
    } else if (mode === 'edit') {
      html += '<div class="b-logo pos-' + d.logoPos + '"><div class="b-logo-ph">LOGO</div></div>';
    }

    html += '<section class="b-title">' +
      textEl('b-t1', T.t1, ph.t1, S.t1, mode) +
      textEl('b-t2', T.t2, ph.t2, S.t2, mode) +
      '<div class="b-rule"></div>' +
      textEl('b-t3', T.t3, ph.t3, S.t3, mode) + '</section>';

    var nameHtml = name ? esc(name) : (mode === 'edit' ? esc(ph.name) : '');
    html += '<div class="b-namebox"><div class="b-name' + (!name && mode === 'edit' ? ' ghost' : '') + '" data-base="' + S.name.size + '" style="' + styleOf(S.name) + '">' + nameHtml + '</div></div>';

    if (role || mode === 'edit') {
      html += '<div class="b-role-wrap"><div class="b-role' + (!role ? ' ghost' : '') + '" data-base="' + S.role.size + '" style="' + styleOf(S.role) + '">' +
        esc(role || ph.roleShort || 'Aprendiz') + '</div></div>';
    }

    if (hasFoot || mode === 'edit') {
      html += '<footer class="b-foot">';
      for (var i = 0; i < 3; i++) {
        html += '<div class="b-foot-cell">' + (isImg(feet[i]) ? '<img src="' + feet[i] + '" alt="">' : '') + '</div>';
      }
      html += '</footer>';
    }
    html += '</div>';
    el.innerHTML = html;
    return el;
  }

  /* Auto-ajuste: si un nombre largo o un título no caben, se reduce la letra
   * hasta que quepan (nunca se recorta ni se sale de la escarapela). */
  function setSize(node, pt) { node.style.fontSize = pt + 'pt'; }
  function fit(badge) {
    if (!badge || !badge.isConnected) return;
    // 1) Nombre: debe caber en su recuadro (máx. 2 líneas por altura del recuadro)
    var box = badge.querySelector('.b-namebox');
    var nm = badge.querySelector('.b-name');
    if (box && nm) {
      var size = parseFloat(nm.getAttribute('data-base')) || 16;
      setSize(nm, size);
      var guard = 0;
      while ((nm.scrollHeight > box.clientHeight - 2 || nm.scrollWidth > box.clientWidth) && size > 6 && guard++ < 80) {
        size -= 0.5; setSize(nm, size);
      }
    }
    // 2) Bloque de título: reduce proporcionalmente las 3 líneas si no caben
    var title = badge.querySelector('.b-title');
    if (title) {
      var lines = title.querySelectorAll('[data-base]');
      var k = 1; guard = 0;
      Array.prototype.forEach.call(lines, function (n) { setSize(n, parseFloat(n.getAttribute('data-base'))); });
      while (title.scrollHeight > title.clientHeight + 1 && k > 0.35 && guard++ < 60) {
        k -= 0.04;
        Array.prototype.forEach.call(lines, function (n) { setSize(n, Math.max(5, +(parseFloat(n.getAttribute('data-base')) * k).toFixed(2))); });
      }
      // Palabras muy largas en una sola línea (ej. "CIBERSEGURIDAD" a 40 pt)
      Array.prototype.forEach.call(lines, function (n) {
        var s = parseFloat(n.style.fontSize), g = 0;
        while (n.scrollWidth > n.clientWidth + 1 && s > 5 && g++ < 60) { s -= 0.5; setSize(n, s); }
      });
    }
    // 3) Encabezado y rol: que no desborden a lo ancho
    Array.prototype.forEach.call(badge.querySelectorAll('.b-h1, .b-h2, .b-role'), function (n) {
      var s = parseFloat(n.getAttribute('data-base')), g = 0;
      setSize(n, s);
      while (n.scrollWidth > n.clientWidth + 1 && s > 5 && g++ < 60) { s -= 0.5; setSize(n, s); }
    });
  }

  global.Badge = {
    PX_PER_MM: PX_PER_MM, FONTS: FONTS, SIZES: SIZES, SCHEMES: SCHEMES,
    loadFonts: loadFonts, fontStack: fontStack, makePalette: makePalette, themeVars: themeVars,
    hexToHsl: hexToHsl, hslToHex: hslToHex, readableOn: readableOn, contrast: contrast,
    build: build, fit: fit, esc: esc, isImg: isImg
  };
})(window);
