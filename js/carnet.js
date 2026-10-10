/* Carnet de asistencia con código QR.
 * Tamaño estándar de tarjeta ISO/IEC 7810 ID-1 (CR80): 85,6 × 54 mm, el mismo de una tarjeta bancaria,
 * así cabe en cualquier porta-carnet comercial. */
(function (global) {
  'use strict';

  var B = global.Badge;
  var CARD_W = 85.6, CARD_H = 54;

  /* QR como imagen PNG generada en un canvas (12 px por módulo ≈ 500 px de lado: sobra para 300 ppp a 23 mm).
   * Por qué PNG y no SVG: html2canvas (exportación a PNG) dibuja mal los SVG sin tamaño intrínseco,
   * y un QR deformado no se puede leer. El PNG se ve idéntico en pantalla, impresión y exportación.
   * Se guarda en caché porque el mismo QR se dibuja varias veces (vista previa, impresión). */
  var qrCache = {};
  function qrDataUrl(text) {
    if (qrCache[text]) return qrCache[text];
    var qr = global.qrcode(0, 'M'); // versión automática, corrección de errores M (≈15 %)
    qr.addData(text);
    qr.make();
    var n = qr.getModuleCount(), quiet = 2, px = 12, size = (n + quiet * 2) * px;
    var cv = document.createElement('canvas');
    cv.width = cv.height = size;
    var g = cv.getContext('2d');
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, size, size);
    g.fillStyle = '#000000';
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (qr.isDark(r, c)) g.fillRect((c + quiet) * px, (r + quiet) * px, px, px);
    var url = cv.toDataURL('image/png');
    var keys = Object.keys(qrCache);
    if (keys.length > 600) delete qrCache[keys[0]];
    qrCache[text] = url;
    return url;
  }

  /* URL que abre el celular al escanear: servicio + evento + participante + token secreto */
  function checkinUrl(serviceUrl, eventId, person) {
    if (!serviceUrl || !person || !person.id || !person.token) return '';
    return serviceUrl + (serviceUrl.indexOf('?') >= 0 ? '&' : '?') + 'a=checkin&e=' + eventId + '&i=' + person.id + '&t=' + person.token;
  }

  function styleOf(st, size) {
    return 'font-family:' + B.fontStack(st.font) + ';font-size:' + size + 'pt;font-weight:' + (st.bold ? 700 : 400) +
      ';text-transform:' + (st.upper ? 'uppercase' : 'none') + ';font-style:' + (st.italic ? 'italic' : 'normal') + ';';
  }
  function txt(cls, value, ph, st, size, mode) {
    var v = String(value || '').trim();
    if (!v && mode !== 'edit') return '';
    return '<div class="' + cls + (v ? '' : ' ghost') + '" data-base="' + size + '" style="' + styleOf(st, size) + '">' + B.esc(v || ph) + '</div>';
  }

  /**
   * @param d       diseño
   * @param person  {id, token, name, role}
   * @param opts    {mode:'edit'|'final', serviceUrl, placeholders}
   */
  function build(d, person, opts) {
    opts = opts || {};
    var mode = opts.mode || 'final', ph = opts.placeholders || {};
    var v = B.themeVars(d.palette, d.theme);
    var S = d.styles, T = d.texts;
    var el = document.createElement('div');
    el.className = 'idcard theme-' + d.theme;
    el.style.width = CARD_W + 'mm';
    el.style.height = CARD_H + 'mm';
    var vars = {
      '--bg1': v.bg1, '--bg2': v.bg2, '--head': v.head, '--t1': v.title1, '--t2': v.title2, '--t3': v.title3,
      '--chip-bg': v.chipBg, '--chip-text': v.chipText, '--accent': v.accent, '--primary': v.primary,
      '--overlay': String(d.bg ? d.overlay / 100 : 1)
    };
    Object.keys(vars).forEach(function (k) { el.style.setProperty(k, vars[k]); });

    var name = String((person && person.name) || '').trim();
    var role = String((person && person.role) || '').trim() || String(T.role || '').trim();
    var url = checkinUrl(opts.serviceUrl, d.eventId, person);

    var h = '';
    h += B.isImg(d.bg) ? '<div class="c-bg" style="background-image:url(\'' + d.bg + '\')"></div>' : '';
    h += '<div class="c-tint"></div><div class="c-band"></div>';
    h += '<div class="c-body"><div class="c-left">';
    if (B.isImg(d.logo2)) h += '<div class="c-logo2 pos-' + d.cardLogo2Pos + '" style="height:' + d.cardLogo2Size + 'mm"><img src="' + d.logo2 + '" alt=""></div>';
    else if (mode === 'edit') h += '<div class="c-logo2 pos-' + d.cardLogo2Pos + '" style="height:' + d.cardLogo2Size + 'mm"><div class="c-logo2-ph">Logo SENA</div></div>';
    h += '<div class="c-head">' + (B.isImg(d.logo) ? '<img class="c-logo" src="' + d.logo + '" alt="">' : '') +
      '<div class="c-headtxt">' + txt('c-h1', T.h1, ph.h1, S.h1, 5.6, mode) + txt('c-h2', T.h2, ph.h2, S.h2, 4.6, mode) + '</div></div>';
    h += '<div class="c-event">' + txt('c-t1', T.t1, ph.t1, S.t1, 5.6, mode) + txt('c-t2', T.t2, ph.t2, S.t2, 9.5, mode) + '</div>';
    h += '<div class="c-namewrap"><div class="c-name' + (name ? '' : ' ghost') + '" data-base="11" style="' + styleOf(S.name, 11) + '">' +
      B.esc(name || (mode === 'edit' ? ph.name : '')) + '</div></div>';
    h += (role || mode === 'edit') ? '<div class="c-rolewrap"><span class="c-role' + (role ? '' : ' ghost') + '" data-base="6" style="' + styleOf(S.role, 6) + '">' + B.esc(role || ph.roleShort) + '</span></div>' : '';
    var meta = txt('c-meta', T.fecha, ph.fecha, S.fecha, S.fecha.size, mode) + txt('c-meta', T.lugar, ph.lugar, S.lugar, S.lugar.size, mode);
    h += meta ? '<div class="c-metas">' + meta + '</div>' : '';
    h += '</div><div class="c-right">';
    if (url) h += '<div class="c-qr"><img src="' + qrDataUrl(url) + '" alt="QR de asistencia"></div>';
    else h += '<div class="c-qr c-qr-empty">' + (mode === 'edit' ? 'QR<br><small>Configura el servicio de asistencia</small>' : '') + '</div>';
    h += '<div class="c-code">ID ' + B.esc((person && person.id) || '—') + '</div>';
    h += '<div class="c-hint">Escanea para registrar tu asistencia</div>';
    h += '</div></div>';
    el.innerHTML = h;
    return el;
  }

  function setPt(n, pt) { n.style.fontSize = pt + 'pt'; }
  function shrinkWidth(n) {
    var s = parseFloat(n.getAttribute('data-base')), g = 0;
    setPt(n, s);
    while (n.scrollWidth > n.clientWidth + 1 && s > 3.5 && g++ < 60) { s -= 0.25; setPt(n, s); }
  }
  /* Auto-ajuste del carnet: nombre en máx. su recuadro, textos sin desbordar */
  function fit(card) {
    if (!card || !card.isConnected) return;
    Array.prototype.forEach.call(card.querySelectorAll('.c-h1,.c-h2,.c-t1,.c-meta,.c-role'), shrinkWidth);
    var t2 = card.querySelector('.c-t2');
    if (t2) {
      var s = parseFloat(t2.getAttribute('data-base')), g = 0; setPt(t2, s);
      while ((t2.scrollHeight > t2.clientHeight + 1 || t2.scrollWidth > t2.clientWidth + 1) && s > 4 && g++ < 60) { s -= 0.25; setPt(t2, s); }
    }
    var wrap = card.querySelector('.c-namewrap'), nm = card.querySelector('.c-name');
    if (wrap && nm) {
      var z = parseFloat(nm.getAttribute('data-base')), k = 0; setPt(nm, z);
      while ((nm.scrollHeight > wrap.clientHeight + 1 || nm.scrollWidth > nm.clientWidth + 1) && z > 4.5 && k++ < 80) { z -= 0.25; setPt(nm, z); }
    }
  }

  global.Carnet = { W: CARD_W, H: CARD_H, build: build, fit: fit, qrDataUrl: qrDataUrl, checkinUrl: checkinUrl };
})(window);
