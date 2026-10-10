/* Escarapelas SENA — lógica de la aplicación (panel de control, vista previa, impresión). */
(function () {
  'use strict';

  /* Anti-clickjacking: GitHub Pages no permite cabeceras X-Frame-Options, así que se bloquea por código */
  if (window.top !== window.self) {
    document.documentElement.innerHTML = '<body style="font-family:sans-serif;padding:2rem">Por seguridad, esta aplicación no puede mostrarse dentro de otra página. <a href="' + location.href.replace(/"/g, '') + '" target="_top">Abrir directamente</a>.</body>';
    throw new Error('Bloqueado dentro de un marco');
  }
  var B = window.Badge;
  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

  /* ---------- Constantes ---------- */
  // Sugerencias: se muestran como placeholder, NUNCA como texto predeterminado.
  var PH = {
    h1: 'Centro de Automatización Industrial',
    h2: 'Regional Caldas',
    t1: 'Bootcamp',
    t2: 'de Ciberseguridad',
    t3: 'Aquí se escribirá una pequeña frase motivadora del evento',
    name: 'Nombre completo del aprendiz',
    role: 'Aprendiz · Participante · Instructor · Coordinador',
    roleShort: 'Aprendiz',
    fecha: 'Fecha: 13 al 17 de octubre de 2026',
    lugar: 'Lugar: Centro de Automatización Industrial, Manizales'
  };

  var FIELDS = [
    { key: 'h1', panel: 'inst', label: 'Texto superior (institución)' },
    { key: 'h2', panel: 'inst', label: 'Texto secundario (letra pequeña)' },
    { key: 't1', panel: 'event', label: 'Título · línea 1 (texto mediano)' },
    { key: 't2', panel: 'event', label: 'Título · línea 2 (texto principal)' },
    { key: 't3', panel: 'event', label: 'Frase motivadora', multiline: true },
    { key: 'name', panel: 'people', label: 'Formato del nombre del participante', styleOnly: true },
    { key: 'role', panel: 'people', label: 'Rango general (se aplica a quien no tenga uno propio)', list: 'rolesList' },
    { key: 'fecha', panel: 'card', label: 'Fecha(s) del evento (sale en el carnet)' },
    { key: 'lugar', panel: 'card', label: 'Lugar del evento (sale en el carnet)' }
  ];

  // Papel en mm. 4 escarapelas por hoja en cuadrícula 2 × 2.
  var PAPERS = {
    carta: { w: 215.9, h: 279.4, name: 'Carta' },
    legal: { w: 215.9, h: 355.6, name: 'Legal' },
    oficio: { w: 216, h: 330, name: 'Oficio' }
  };
  var MIN_MARGIN = 4; // mm: zona que casi ninguna impresora puede imprimir
  var MAX_W = +((PAPERS.carta.w - 3 * MIN_MARGIN) / 2).toFixed(1); // 101.9 mm
  var MAX_H = +((PAPERS.carta.h - 3 * MIN_MARGIN) / 2).toFixed(1); // 133.7 mm
  var MAX_PEOPLE = 500;

  var QUICK = ['#39A900', '#E53935', '#FB8C00', '#FDD835', '#43A047', '#00ACC1', '#1E88E5', '#5E35B1', '#EC407A', '#6D4C41', '#546E7A', '#111827'];

  /* Identificadores aleatorios criptográficamente seguros.
   * id: identifica al participante; token: secreto que va en su QR y evita que alguien
   * registre asistencia de otro solo adivinando o cambiando el id en la URL. */
  function rid(n) {
    var abc = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789', out = '', arr = new Uint8Array(n);
    if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(arr);
    else for (var i = 0; i < n; i++) arr[i] = Math.floor(Math.random() * 256);
    for (var j = 0; j < n; j++) out += abc[arr[j] % abc.length];
    return out;
  }
  function newPerson(name, role) { return { id: rid(10), token: rid(20), name: name || '', role: role || '' }; }

  function defaultDesign() {
    var base = '#1E88E5';
    return {
      texts: { h1: '', h2: '', t1: '', t2: '', t3: '', role: '', fecha: '', lugar: '' },
      styles: {
        h1: { font: 'Montserrat', size: 10, bold: true, upper: true, italic: false },
        h2: { font: 'Montserrat', size: 7, bold: false, upper: true, italic: false },
        t1: { font: 'Orbitron', size: 12, bold: false, upper: true, italic: false },
        t2: { font: 'Montserrat', size: 20, bold: true, upper: true, italic: false },
        t3: { font: 'Poppins', size: 9, bold: false, upper: false, italic: true },
        name: { font: 'Poppins', size: 16, bold: true, upper: false, italic: false },
        role: { font: 'Montserrat', size: 11, bold: true, upper: true, italic: false },
        fecha: { font: 'Montserrat', size: 6, bold: false, upper: false, italic: false },
        lugar: { font: 'Montserrat', size: 6, bold: false, upper: false, italic: false }
      },
      eventId: rid(8),
      logo: null, logoPos: 'center', logoSize: 22,
      logo2: null, logo2Pos: 'center', logo2Size: 12, cardLogo2Pos: 'left', cardLogo2Size: 6,
      bg: null, overlay: 70,
      foot: [null, null, null], footSize: 16, footScale: [100, 100, 100],
      baseColor: base, scheme: 'analoga', palette: B.makePalette(base, 'analoga'),
      theme: 'oscuro', pattern: 'circuitos', slot: true,
      size: { w: 100, h: 130 }
    };
  }

  /* ---------- Estado ---------- */
  var C = window.Carnet;
  /* meta: proyecto del servidor abierto ({id, name, updatedAt}) o null si es nuevo.
   * savedSig: “huella” del contenido la última vez que se guardó o cargó; si cambia, hay cambios sin guardar. */
  var state = { user: null, design: defaultDesign(), people: [newPerson()], current: 0, view: 'badge', meta: null, savedSig: '', saving: false };
  var excelData = null;

  function storeKey(kind) { return 'escSena.v4.' + kind + '.' + (state.user ? state.user.username.toLowerCase() : 'anon'); }

  /* Huella barata del contenido: las imágenes se resumen (longitud + final) para no serializar MB en cada tecla */
  function signature() {
    var rep = function (k, v) { return typeof v === 'string' && v.length > 200 && v.indexOf('data:') === 0 ? 'img:' + v.length + ':' + v.slice(-40) : v; };
    return JSON.stringify(state.design, rep) + '|' + JSON.stringify(state.people);
  }
  function isDirty() { return signature() !== state.savedSig; }
  function markSaved() { state.savedSig = signature(); renderProjectBar(); scheduleSave(); }

  /* Borrador local: si se cierra el navegador sin guardar, el trabajo no se pierde */
  var saveTimer = null, saveWarned = false;
  function persistDraft() {
    try {
      localStorage.setItem(storeKey('design'), JSON.stringify(state.design));
      localStorage.setItem(storeKey('people'), JSON.stringify(state.people));
      localStorage.setItem(storeKey('meta'), JSON.stringify({ meta: state.meta, savedSig: state.savedSig }));
      saveWarned = false;
    } catch (e) {
      if (!saveWarned) { toast('El borrador local no cabe en el navegador (imágenes pesadas). Guarda el proyecto en el servidor con 💾 Guardar.', 'warn', 6000); saveWarned = true; }
    }
  }
  function scheduleSave() { clearTimeout(saveTimer); saveTimer = setTimeout(persistDraft, 400); }

  function mergeDesign(saved) {
    var d = defaultDesign();
    if (!saved || typeof saved !== 'object') return d;
    Object.keys(d.texts).forEach(function (k) { if (typeof (saved.texts || {})[k] === 'string') d.texts[k] = saved.texts[k].slice(0, 300); });
    Object.keys(d.styles).forEach(function (k) {
      var s = (saved.styles || {})[k];
      if (!s) return;
      if (B.FONTS.some(function (f) { return f.name === s.font; })) d.styles[k].font = s.font;
      if (typeof s.size === 'number' && s.size >= 5 && s.size <= 96) d.styles[k].size = s.size;
      ['bold', 'upper', 'italic'].forEach(function (p) { if (typeof s[p] === 'boolean') d.styles[k][p] = s[p]; });
    });
    if (B.isImg(saved.logo)) d.logo = saved.logo;
    if (B.isImg(saved.logo2)) d.logo2 = saved.logo2;
    if (['left', 'center', 'right'].indexOf(saved.logo2Pos) >= 0) d.logo2Pos = saved.logo2Pos;
    if (['left', 'center', 'right'].indexOf(saved.cardLogo2Pos) >= 0) d.cardLogo2Pos = saved.cardLogo2Pos;
    if (saved.logo2Size >= 6 && saved.logo2Size <= 40) d.logo2Size = +saved.logo2Size;
    if (saved.cardLogo2Size >= 3 && saved.cardLogo2Size <= 14) d.cardLogo2Size = +saved.cardLogo2Size;
    if (Array.isArray(saved.footScale)) d.footScale = [0, 1, 2].map(function (i) { var v = +saved.footScale[i]; return v >= 20 && v <= 100 ? v : 100; });
    if (B.isImg(saved.bg)) d.bg = saved.bg;
    if (Array.isArray(saved.foot)) d.foot = [0, 1, 2].map(function (i) { return B.isImg(saved.foot[i]) ? saved.foot[i] : null; });
    if (['left', 'center', 'right'].indexOf(saved.logoPos) >= 0) d.logoPos = saved.logoPos;
    if (saved.logoSize >= 10 && saved.logoSize <= 40) d.logoSize = saved.logoSize;
    if (saved.footSize >= 8 && saved.footSize <= 30) d.footSize = saved.footSize;
    if (saved.overlay >= 0 && saved.overlay <= 100) d.overlay = saved.overlay;
    if (/^#[0-9a-f]{6}$/i.test(saved.baseColor)) d.baseColor = saved.baseColor;
    if (B.SCHEMES.some(function (s) { return s.id === saved.scheme; })) d.scheme = saved.scheme;
    d.palette = B.makePalette(d.baseColor, d.scheme);
    if (saved.palette) Object.keys(d.palette).forEach(function (k) { if (/^#[0-9a-f]{6}$/i.test(saved.palette[k])) d.palette[k] = saved.palette[k]; });
    if (saved.theme === 'claro' || saved.theme === 'oscuro') d.theme = saved.theme;
    if (['circuitos', 'puntos', 'hexagonos', 'ondas', 'ninguno'].indexOf(saved.pattern) >= 0) d.pattern = saved.pattern;
    if (typeof saved.slot === 'boolean') d.slot = saved.slot;
    if (/^[A-Za-z0-9]{6,24}$/.test(saved.eventId || '')) d.eventId = saved.eventId;
    if (saved.size && saved.size.w >= 50 && saved.size.w <= MAX_W && saved.size.h >= 70 && saved.size.h <= MAX_H) d.size = { w: +saved.size.w, h: +saved.size.h };
    return d;
  }
  function sanitizePeople(list) {
    if (!Array.isArray(list)) return [newPerson()];
    var out = list.slice(0, MAX_PEOPLE).map(function (p) {
      var x = newPerson(String((p && p.name) || '').slice(0, 120), String((p && p.role) || '').slice(0, 40));
      if (p && /^[A-Za-z0-9]{6,24}$/.test(p.id || '') && /^[A-Za-z0-9]{8,40}$/.test(p.token || '')) { x.id = p.id; x.token = p.token; }
      return x;
    });
    var seen = {};
    out.forEach(function (x) { if (seen[x.id]) { x.id = rid(10); x.token = rid(20); } seen[x.id] = true; });
    return out.length ? out : [newPerson()];
  }
  function loadUserData() {
    var d = null, p = null, m = null;
    try { d = JSON.parse(localStorage.getItem(storeKey('design')) || 'null'); } catch (e) { d = null; }
    try { p = JSON.parse(localStorage.getItem(storeKey('people')) || 'null'); } catch (e) { p = null; }
    try { m = JSON.parse(localStorage.getItem(storeKey('meta')) || 'null'); } catch (e) { m = null; }
    if (!d) {
      // Primera vez en v4: recupera el diseño que el usuario tenía en la versión 3 (borrador local)
      var legacy = 'escSena.%s.' + (state.user ? state.user.username.toLowerCase() : 'anon');
      try { d = JSON.parse(localStorage.getItem(legacy.replace('%s', 'design')) || 'null'); } catch (e) { d = null; }
      try { p = JSON.parse(localStorage.getItem(legacy.replace('%s', 'people')) || 'null'); } catch (e) { p = null; }
      if (d) m = null;
    }
    state.design = mergeDesign(d);
    state.people = sanitizePeople(p);
    state.meta = m && m.meta && /^[A-Za-z0-9]{6,24}$/.test(m.meta.id || '') && m.meta.id === state.design.eventId ? m.meta : null;
    state.savedSig = m && typeof m.savedSig === 'string' ? m.savedSig : (d ? '' : signature());
    state.current = 0;
  }

  /* ---------- Barra de proyecto ---------- */
  function renderProjectBar() {
    var dirty = isDirty();
    $('#projName').textContent = state.meta ? state.meta.name : 'Nuevo proyecto (sin guardar)';
    var st = $('#projState');
    if (state.saving) { st.textContent = 'Guardando…'; st.className = 'proj-state'; }
    else if (!state.meta) { st.textContent = 'Aún no está en el servidor: los QR no registran asistencia hasta guardarlo'; st.className = 'proj-state dirty'; }
    else if (dirty) { st.textContent = '● Cambios sin guardar'; st.className = 'proj-state dirty'; }
    else { st.textContent = '✓ Guardado · ' + (state.meta.updatedAt || ''); st.className = 'proj-state saved'; }
    $('#btnSave').disabled = state.saving;
    renderEventInfo();
  }

  /* ---------- Utilidades de UI ---------- */
  function toast(msg, type, ms) {
    var t = document.createElement('div');
    t.className = 'toast ' + (type || '');
    t.textContent = msg;
    $('#toasts').appendChild(t);
    setTimeout(function () { t.remove(); }, ms || 3200);
  }
  function openModal(id) { $(id).hidden = false; }
  function closeModal(el) {
    var m = el.closest ? el.closest('.modal') : el;
    if (m && !m.dataset.forced) m.hidden = true;
  }
  function download(filename, blobOrUrl) {
    var a = document.createElement('a');
    var url = typeof blobOrUrl === 'string' ? blobOrUrl : URL.createObjectURL(blobOrUrl);
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    if (typeof blobOrUrl !== 'string') setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }
  function slug(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 50) || 'sin_nombre';
  }
  function properCase(s) {
    var minor = ['de', 'del', 'la', 'las', 'los', 'y', 'e', 'da', 'van', 'von'];
    return String(s).toLocaleLowerCase('es').replace(/\s+/g, ' ').trim().split(' ').map(function (w, i) {
      if (i > 0 && minor.indexOf(w) >= 0) return w;
      return w.charAt(0).toLocaleUpperCase('es') + w.slice(1);
    }).join(' ');
  }
  function cleanName(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }

  /* ---------- Lectura y compresión de imágenes ----------
   * Por qué se reescalan: se guardan en el navegador (≈5 MB de cupo) y una foto de celular
   * pesa 3–8 MB. A 300 ppp una escarapela de 10 cm necesita ~1200 px: más es peso inútil. */
  function readImage(file, maxSide, keepAlpha) {
    return new Promise(function (resolve, reject) {
      if (!file || !/^image\//.test(file.type)) { reject(new Error('El archivo seleccionado no es una imagen.')); return; }
      if (file.size > 25 * 1024 * 1024) { reject(new Error('La imagen supera 25 MB.')); return; }
      var fr = new FileReader();
      fr.onerror = function () { reject(new Error('No se pudo leer el archivo.')); };
      fr.onload = function () {
        var img = new Image();
        img.onerror = function () { reject(new Error('No se pudo abrir la imagen.')); };
        img.onload = function () {
          var w = img.naturalWidth || maxSide, h = img.naturalHeight || maxSide;
          var k = Math.min(1, maxSide / Math.max(w, h));
          var c = document.createElement('canvas');
          c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
          var ctx = c.getContext('2d');
          if (!keepAlpha) { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height); }
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, c.width, c.height);
          resolve(keepAlpha ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.86));
        };
        img.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  }

  /* =========================================================
     LOGIN / SESIÓN (en el servidor)
     ========================================================= */
  function renderServerState() {
    var url = API.serviceUrl(), st = $('#serverState');
    $('#serverUrl').value = url;
    $('#serverUrl').disabled = $('#btnServerSave').disabled = API.fixedByConfig();
    if (!url) { st.textContent = '· sin configurar'; st.className = 'err'; $('#serverCfg').open = true; }
    else { st.textContent = API.fixedByConfig() ? '· configurado en config.js' : '· configurado'; st.className = 'ok'; }
  }
  function showLogin(msg) {
    $('#appView').hidden = true;
    $('#loginView').hidden = false;
    $('#loginPass').value = '';
    $('#loginError').textContent = msg || '';
    $$('.modal').forEach(function (m) { delete m.dataset.forced; m.hidden = true; });
    renderServerState();
    setTimeout(function () { $('#loginUser').focus(); }, 50);
  }
  function showApp() {
    $('#loginView').hidden = true;
    $('#appView').hidden = false;
    var isAdmin = state.user.role === 'admin';
    $('#userBadge').innerHTML = B.esc(state.user.username) + ' · <b>' + (isAdmin ? 'Administrador' : 'Usuario') + '</b>';
    $('#btnUsers').hidden = !isAdmin;
    $('#btnAppBg').hidden = !isAdmin;
    loadUserData();
    syncAllControls();
    renderPeople();
    renderProjectBar();
    renderPreview();
    if (state.user.mustChange) openPassModal(true);
  }

  $('#loginForm').addEventListener('submit', function (e) {
    e.preventDefault();
    if (!API.serviceUrl()) { $('#loginError').textContent = 'Primero configura la URL del servidor (⚙ Servidor).'; $('#serverCfg').open = true; return; }
    var btn = $('#btnLogin');
    btn.disabled = true; btn.textContent = 'Verificando…';
    Auth.login($('#loginUser').value, $('#loginPass').value).then(function (user) {
      $('#loginError').textContent = '';
      state.user = user;
      showApp();
    }).catch(function (err) {
      $('#loginError').textContent = err.message;
      $('#loginPass').select();
    }).then(function () { btn.disabled = false; btn.textContent = 'Ingresar'; });
  });
  $('#btnServerSave').addEventListener('click', function () {
    var url = $('#serverUrl').value.trim(), b = $('#btnServerSave');
    try { API.setServiceUrl(url); } catch (err) { $('#loginError').textContent = err.message; return; }
    b.disabled = true;
    API.ping(url).then(function (r) {
      $('#loginError').textContent = '';
      toast('Servidor conectado (versión ' + r.version + ').', 'ok');
      $('#serverCfg').open = false;
      loadAppBg();
    }).catch(function (err) { $('#loginError').textContent = err.message; })
      .then(function () { b.disabled = false; renderServerState(); });
  });
  function logout(msg) {
    clearTimeout(saveTimer);
    if (state.user) persistDraft();
    Auth.logout();
    state.user = null;
    showLogin(msg);
  }
  $('#btnLogout').addEventListener('click', function () {
    if (isDirty() && state.user && !confirm('Hay cambios sin guardar en el servidor. Quedarán solo como borrador en este navegador. ¿Salir de todas formas?')) return;
    logout();
  });
  API.onAuthLost = function (msg) { if (state.user) logout(msg + ' Tu trabajo quedó guardado como borrador en este navegador.'); };

  /* ---------- Cambio de contraseña ---------- */
  function openPassModal(forced) {
    var m = $('#passModal');
    if (forced) {
      m.dataset.forced = '1';
      $('#passTitle').textContent = 'Cambia tu contraseña inicial';
      $('#passMsg').textContent = 'Por seguridad debes reemplazar la contraseña asignada antes de continuar.';
      $('#passClose').hidden = true;
    } else {
      delete m.dataset.forced;
      $('#passTitle').textContent = 'Cambiar contraseña';
      $('#passMsg').textContent = '';
      $('#passClose').hidden = false;
    }
    $('#passForm').reset();
    $('#pwError').textContent = '';
    openModal('#passModal');
    setTimeout(function () { $('#pwOld').focus(); }, 50);
  }
  $('#btnChangePass').addEventListener('click', function () { openPassModal(false); });
  $('#passForm').addEventListener('submit', function (e) {
    e.preventDefault();
    if ($('#pwNew').value !== $('#pwNew2').value) { $('#pwError').textContent = 'Las contraseñas nuevas no coinciden.'; return; }
    var btn = $('#passForm button[type=submit]');
    btn.disabled = true;
    Auth.changeOwnPassword($('#pwOld').value, $('#pwNew').value).then(function (u) {
      state.user = u;
      var m = $('#passModal'); delete m.dataset.forced; m.hidden = true;
      toast('Contraseña actualizada.', 'ok');
    }).catch(function (err) { $('#pwError').textContent = err.message; }).then(function () { btn.disabled = false; });
  });

  /* ---------- Gestión de usuarios (solo administradores; el servidor lo verifica) ---------- */
  function renderUsers(list) {
    var me = state.user;
    $('#usersBody').innerHTML = list.map(function (u) {
      var self = me && u.username.toLowerCase() === me.username.toLowerCase();
      return '<tr data-u="' + B.esc(u.username) + '"><td><strong>' + B.esc(u.username) + '</strong>' + (self ? ' <span class="tag">tú</span>' : '') +
        (u.mustChange ? ' <span class="tag">clave temporal</span>' : '') + '</td>' +
        '<td><select data-act="role"' + (self ? ' disabled' : '') + '><option value="user"' + (u.role === 'user' ? ' selected' : '') + '>Usuario</option><option value="admin"' + (u.role === 'admin' ? ' selected' : '') + '>Administrador</option></select></td>' +
        '<td>' + B.esc(String(u.created || '—').slice(0, 10)) + (u.createdBy ? '<br><small>por ' + B.esc(u.createdBy) + '</small>' : '') + '</td>' +
        '<td><button class="btn btn-sm btn-ghost" data-act="pass">Asignar clave</button>' +
        (self ? '' : '<button class="btn btn-sm btn-ghost danger" data-act="del">Eliminar</button>') + '</td></tr>';
    }).join('');
  }
  function usersOp(promise, okMsg) {
    return promise.then(function (list) { renderUsers(list); if (okMsg) toast(okMsg, 'ok'); return list; })
      .catch(function (err) { toast(err.message, 'err', 5000); return Auth.list().then(renderUsers).catch(function () { }); });
  }
  $('#btnUsers').addEventListener('click', function () {
    $('#nuError').textContent = '';
    $('#usersBody').innerHTML = '<tr><td colspan="4">Cargando…</td></tr>';
    openModal('#usersModal');
    usersOp(Auth.list());
  });
  $('#newUserForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var btn = $('#newUserForm button'); btn.disabled = true;
    Auth.create($('#nuName').value, $('#nuPass').value, $('#nuRole').value).then(function (list) {
      renderUsers(list);
      toast('Usuario creado. Deberá cambiar la clave en su primer ingreso.', 'ok');
      $('#newUserForm').reset(); $('#nuError').textContent = '';
    }).catch(function (err) { $('#nuError').textContent = err.message; }).then(function () { btn.disabled = false; });
  });
  $('#usersBody').addEventListener('change', function (e) {
    if (e.target.dataset.act !== 'role') return;
    usersOp(Auth.setRole(e.target.closest('tr').dataset.u, e.target.value), 'Rol actualizado.');
  });
  $('#usersBody').addEventListener('click', function (e) {
    var act = e.target.dataset && e.target.dataset.act;
    if (!act || act === 'role') return;
    var u = e.target.closest('tr').dataset.u;
    if (act === 'pass') {
      ask({ title: 'Asignar contraseña', message: 'Nueva contraseña temporal para “' + u + '”. Deberá cambiarla al ingresar.', input: true, password: true, placeholder: 'Mínimo 8, con letras y números', minLength: 8, maxLength: 100, confirmText: 'Asignar' })
        .then(function (p) { if (p) usersOp(Auth.setPassword(u, p), 'Contraseña asignada. El usuario deberá cambiarla al ingresar.'); });
    } else if (act === 'del') {
      ask({ title: 'Eliminar usuario', message: '¿Eliminar definitivamente al usuario “' + u + '”? Sus proyectos se conservan.', confirmText: 'Eliminar', danger: true })
        .then(function (ok) { if (ok) usersOp(Auth.remove(u), 'Usuario eliminado.'); });
    }
  });

  /* ---------- Fondo del panel (1 o 2 imágenes, guardado en el servidor para todos) ---------- */
  var APPBG_CACHE = 'escSena.appBg.cache.v4';
  var appBg = { imgs: [null, null], dim: 30 }, appBgTimer = null;
  function setAppBg(d) {
    if (d && Array.isArray(d.imgs)) appBg = { imgs: [0, 1].map(function (i) { return B.isImg(d.imgs[i]) ? d.imgs[i] : null; }), dim: d.dim >= 0 && d.dim <= 80 ? +d.dim : 30 };
  }
  function loadAppBg() {
    try { setAppBg(JSON.parse(localStorage.getItem(APPBG_CACHE) || 'null')); } catch (e) { /* nada */ }
    applyAppBg();
    if (!API.serviceUrl()) return;
    API.get({ a: 'settings' }).then(function (r) {
      if (!r || !r.ok) return;
      setAppBg((r.settings || {}).appBg || { imgs: [null, null], dim: 30 });
      try { localStorage.setItem(APPBG_CACHE, JSON.stringify(appBg)); } catch (e) { /* sin espacio: solo se pierde la caché */ }
      applyAppBg();
    }).catch(function () { /* sin conexión: se usa la caché */ });
  }
  var bgSaveTimer = null;
  function saveAppBg() {
    clearTimeout(bgSaveTimer);
    bgSaveTimer = setTimeout(function () {
      API.call('saveSettings', { settings: { appBg: appBg } }, 90000).then(function () {
        try { localStorage.setItem(APPBG_CACHE, JSON.stringify(appBg)); } catch (e) { /* nada */ }
        toast('Fondo del panel guardado para todos los usuarios.', 'ok', 2200);
      }).catch(function (err) { toast(err.message, 'err', 5000); });
    }, 600);
  }
  function applyAppBg() {
    var imgs = appBg.imgs.filter(Boolean);
    clearInterval(appBgTimer);
    var L0 = $('#bgL0'), L1 = $('#bgL1');
    L0.style.backgroundImage = imgs[0] ? 'url("' + imgs[0] + '")' : 'none';
    L1.style.backgroundImage = imgs[1] ? 'url("' + imgs[1] + '")' : 'none';
    L0.classList.toggle('show', !!imgs[0]); L1.classList.remove('show');
    document.body.classList.toggle('has-appbg', imgs.length > 0);
    $('#bgScrim').style.setProperty('--dim', String(appBg.dim / 100));
    if (imgs.length === 2) {
      var on = 0;
      appBgTimer = setInterval(function () { on = 1 - on; L0.classList.toggle('show', on === 0); L1.classList.toggle('show', on === 1); }, 8000);
    }
    [0, 1].forEach(function (i) {
      var t = $('#thumb-appbg' + i);
      if (t) t.innerHTML = appBg.imgs[i] ? '<img src="' + appBg.imgs[i] + '" alt="">' : '<span>Vacío</span>';
    });
    $('#appBgDim').value = appBg.dim; $('#appBgDimOut').textContent = appBg.dim + ' %';
  }
  $('#btnAppBg').addEventListener('click', function () { applyAppBg(); openModal('#appBgModal'); });
  $$('[data-appbg]').forEach(function (inp) {
    inp.addEventListener('change', function () {
      var i = +inp.dataset.appbg, f = inp.files[0]; inp.value = '';
      if (!f) return;
      readImage(f, 1920, false).then(function (url) { appBg.imgs[i] = url; applyAppBg(); saveAppBg(); })
        .catch(function (err) { toast(err.message, 'err'); });
    });
  });
  $$('[data-appbg-clear]').forEach(function (b) {
    b.addEventListener('click', function () { appBg.imgs[+b.dataset.appbgClear] = null; applyAppBg(); saveAppBg(); });
  });
  $('#appBgDim').addEventListener('input', function (e) { appBg.dim = +e.target.value; applyAppBg(); saveAppBg(); });

  /* ---------- Diálogo propio (reemplaza prompt/confirm del navegador) ----------
   * ask({title, message, input, password, value, placeholder, minLength, maxLength,
   *      requireText, confirmText, danger, noCancel}) → Promise<string|true|null> */
  var askResolve = null;
  function ask(o) {
    if (askResolve) askResolve(null);
    return new Promise(function (resolve) {
      askResolve = resolve;
      $('#askTitle').textContent = o.title || 'Confirmar';
      $('#askMsg').textContent = o.message || '';
      var needInput = !!(o.input || o.requireText);
      $('#askLabel').hidden = !needInput;
      $('#askLabelText').textContent = o.requireText ? 'Para confirmar, escribe ' + o.requireText : '';
      var inp = $('#askInput');
      inp.type = o.password ? 'password' : 'text';
      inp.value = o.requireText ? '' : (o.value || '');
      inp.placeholder = o.requireText || o.placeholder || '';
      inp.maxLength = o.maxLength || 200;
      $('#askError').textContent = '';
      $('#askOk').textContent = o.confirmText || 'Aceptar';
      $('#askOk').className = 'btn ' + (o.danger ? 'btn-danger' : 'btn-primary');
      $('#askCancel').hidden = !!o.noCancel;
      $('#askModal').dataset.forced = '1';
      $('#askModal').dataset.opts = JSON.stringify({ input: !!o.input, requireText: o.requireText || '', minLength: o.minLength || 0 });
      $('#askModal').hidden = false;
      setTimeout(function () { if (needInput) { inp.focus(); inp.select(); } else $('#askOk').focus(); }, 30);
    });
  }
  function closeAsk(val) {
    $('#askModal').hidden = true;
    var r = askResolve; askResolve = null;
    if (r) r(val);
  }
  $('#askForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var o = JSON.parse($('#askModal').dataset.opts || '{}'), v = $('#askInput').value.replace(/\s+/g, ' ').trim();
    if (o.requireText) {
      if (v !== o.requireText) { $('#askError').textContent = 'Escribe exactamente ' + o.requireText + ' para confirmar.'; return; }
      return closeAsk(true);
    }
    if (o.input) {
      if (v.length < (o.minLength || 1)) { $('#askError').textContent = 'Debe tener al menos ' + (o.minLength || 1) + ' caracteres.'; return; }
      return closeAsk($('#askInput').type === 'password' ? $('#askInput').value : v);
    }
    closeAsk(true);
  });
  $('#askCancel').addEventListener('click', function () { closeAsk(null); });

  /* ---------- Modales: cerrar ---------- */
  document.addEventListener('click', function (e) {
    if (e.target.matches('[data-close]')) closeModal(e.target);
    else if (e.target.classList && e.target.classList.contains('modal')) closeModal(e.target);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (!$('#askModal').hidden) { if (!$('#askCancel').hidden) closeAsk(null); return; }
    var open = $$('.modal').filter(function (m) { return !m.hidden; }).pop();
    if (open) closeModal(open);
  });

  /* =========================================================
     CONTROLES DEL DISEÑO
     ========================================================= */
  function sizeOptions() { return B.SIZES.map(function (s) { return '<option value="' + s + '">' + s + ' pt</option>'; }).join(''); }
  function fontOptions() {
    return B.FONTS.map(function (f) { return '<option value="' + f.name + '" style="font-family:' + B.fontStack(f.name).replace(/'/g, '&quot;') + '">' + f.name + '</option>'; }).join('');
  }

  function buildFieldControls() {
    FIELDS.forEach(function (f) {
      var wrap = document.createElement('div');
      wrap.className = 'field';
      var input = '';
      if (!f.styleOnly) {
        var common = ' id="txt-' + f.key + '" data-text="' + f.key + '" placeholder="' + B.esc(PH[f.key]) + '" maxlength="' + (f.multiline ? 180 : 80) + '"';
        input = f.multiline ? '<textarea rows="2"' + common + '></textarea>' : '<input type="text"' + common + (f.list ? ' list="' + f.list + '"' : '') + '>';
      }
      wrap.innerHTML = '<label class="field-label" for="txt-' + f.key + '">' + f.label + '</label>' +
        '<div class="field-row">' + input +
        '<div class="font-ctrls" data-style="' + f.key + '">' +
        '<select data-prop="font" aria-label="Tipo de letra">' + fontOptions() + '</select>' +
        '<select data-prop="size" aria-label="Tamaño">' + sizeOptions() + '</select>' +
        '<button type="button" class="toggle" data-prop="bold" title="Negrita" aria-pressed="false">B</button>' +
        '<button type="button" class="toggle" data-prop="italic" title="Cursiva" aria-pressed="false"><i>I</i></button>' +
        '<button type="button" class="toggle" data-prop="upper" title="MAYÚSCULAS" aria-pressed="false">AA</button>' +
        '</div></div>';
      $('#fields-' + f.panel).appendChild(wrap);
    });

    $$('[data-text]').forEach(function (el) {
      el.addEventListener('input', function () { state.design.texts[el.dataset.text] = el.value; changed(); });
    });
    $$('.font-ctrls').forEach(function (box) {
      var key = box.dataset.style;
      box.addEventListener('change', function (e) {
        var p = e.target.dataset.prop;
        if (p === 'font') state.design.styles[key].font = e.target.value;
        if (p === 'size') state.design.styles[key].size = +e.target.value;
        changed();
      });
      box.addEventListener('click', function (e) {
        var b = e.target.closest('.toggle');
        if (!b) return;
        var p = b.dataset.prop;
        state.design.styles[key][p] = !state.design.styles[key][p];
        b.setAttribute('aria-pressed', String(state.design.styles[key][p]));
        changed();
      });
    });
  }

  function setSegmented(id, value) {
    $$('#' + id + ' button').forEach(function (b) { b.classList.toggle('active', b.dataset.v === value); });
  }

  function syncAllControls() {
    var d = state.design;
    FIELDS.forEach(function (f) {
      var t = $('#txt-' + f.key);
      if (t) t.value = d.texts[f.key] || '';
      var box = $('.font-ctrls[data-style="' + f.key + '"]');
      var st = d.styles[f.key];
      $('[data-prop=font]', box).value = st.font;
      var sizeSel = $('[data-prop=size]', box);
      if (!$$('option', sizeSel).some(function (o) { return +o.value === st.size; })) {
        var o = document.createElement('option'); o.value = st.size; o.textContent = st.size + ' pt'; sizeSel.appendChild(o);
      }
      sizeSel.value = String(st.size);
      ['bold', 'italic', 'upper'].forEach(function (p) { $('[data-prop=' + p + ']', box).setAttribute('aria-pressed', String(!!st[p])); });
    });
    setSegmented('logoPos', d.logoPos);
    setSegmented('logo2Pos', d.logo2Pos);
    setSegmented('cardLogo2Pos', d.cardLogo2Pos);
    $('#logo2Size').value = d.logo2Size; $('#logo2SizeOut').textContent = fmt(d.logo2Size) + ' mm';
    $('#cardLogo2Size').value = d.cardLogo2Size; $('#cardLogo2SizeOut').textContent = fmt(d.cardLogo2Size) + ' mm';
    [0, 1, 2].forEach(function (i) { $('[data-footscale="' + i + '"]').value = d.footScale[i]; $('#footScaleOut' + i).textContent = d.footScale[i] + ' %'; });
    setSegmented('theme', d.theme);
    $('#logoSize').value = d.logoSize; $('#logoSizeOut').textContent = d.logoSize + ' mm';
    $('#footSize').value = d.footSize; $('#footSizeOut').textContent = d.footSize + ' mm';
    $('#overlay').value = d.overlay; $('#overlayOut').textContent = d.overlay + ' %';
    $('#pattern').value = d.pattern;
    $('#slot').checked = d.slot;
    $('#baseColor').value = d.baseColor.toLowerCase();
    $('#baseColorHex').value = d.baseColor.toUpperCase();
    renderPalettes();
    ['logo', 'logo2', 'bg', 'foot0', 'foot1', 'foot2'].forEach(renderThumb);
    syncSize();
    $('#count').value = state.people.length;
    updateSheetsInfo();
    renderEventInfo();
  }

  function eventInfo() {
    var t = state.design.texts;
    return { id: state.design.eventId, name: cleanName((t.t1 || '') + ' ' + (t.t2 || '')) || 'Evento sin nombre', defaultRole: cleanName(t.role) };
  }
  function renderEventInfo() {
    $('#eventCode').textContent = state.design.eventId;
    var el = $('#serviceState');
    if (!el) return;
    if (!API.serviceUrl()) el.innerHTML = '⚠️ Falta configurar el servidor. Sin él no se pueden generar carnets con QR.';
    else if (!state.meta) el.innerHTML = '⚠️ Guarda el proyecto (💾 Guardar) para que los QR registren asistencia.';
    else if (isDirty()) el.innerHTML = '⚠️ Hay cambios sin guardar: los participantes nuevos no registrarán asistencia hasta guardar.';
    else el.innerHTML = '✅ Proyecto guardado: los QR de sus carnets registran asistencia mientras el escaneo esté habilitado.';
  }

  /* ---------- Paletas ---------- */
  var ROLE_NAMES = { primary: 'Principal', secondary: 'Secundario', accent: 'Acento', dark: 'Oscuro', light: 'Claro' };
  function renderPalettes() {
    var d = state.design;
    $('#palettes').innerHTML = B.SCHEMES.map(function (s) {
      var p = B.makePalette(d.baseColor, s.id);
      return '<button type="button" class="palette' + (s.id === d.scheme ? ' active' : '') + '" data-scheme="' + s.id + '">' +
        '<span class="palette-name">' + s.name + '</span><span class="swatches">' +
        ['dark', 'primary', 'secondary', 'accent', 'light'].map(function (k) { return '<span style="background:' + p[k] + '" title="' + ROLE_NAMES[k] + ' ' + p[k] + '"></span>'; }).join('') +
        '</span></button>';
    }).join('');
    $('#paletteEdit').innerHTML = ['primary', 'secondary', 'accent', 'dark', 'light'].map(function (k) {
      return '<label><input type="color" data-role="' + k + '" value="' + d.palette[k].toLowerCase() + '">' + ROLE_NAMES[k] + '</label>';
    }).join('');
  }
  function setBaseColor(hex, scheme) {
    if (!/^#[0-9a-f]{6}$/i.test(hex)) return;
    var d = state.design;
    d.baseColor = hex.toUpperCase();
    if (scheme) d.scheme = scheme;
    d.palette = B.makePalette(d.baseColor, d.scheme);
    $('#baseColor').value = d.baseColor.toLowerCase();
    $('#baseColorHex').value = d.baseColor;
    renderPalettes();
    changed();
  }

  /* ---------- Miniaturas de imágenes ---------- */
  function imgValue(key) { var d = state.design; return key.indexOf('foot') === 0 ? d.foot[+key.slice(4)] : d[key]; }
  function setImg(key, val) { var d = state.design; if (key.indexOf('foot') === 0) d.foot[+key.slice(4)] = val; else d[key] = val; }
  function renderThumb(key) {
    var v = imgValue(key), t = $('#thumb-' + key);
    if (!t) return;
    t.innerHTML = B.isImg(v) ? '<img src="' + v + '" alt="">' : '<span>' + (key === 'logo' ? 'Sin logo' : key === 'logo2' ? 'Aquí se agrega el logo SENA' : key === 'bg' ? 'Sin fondo' : 'Vacío') + '</span>';
  }

  /* ---------- Tamaño (exacto) ---------- */
  function syncSize() {
    var d = state.design, admin = state.user && state.user.role === 'admin';
    $('#sizeW').value = d.size.w; $('#sizeH').value = d.size.h;
    $('#sizeW').max = MAX_W; $('#sizeH').max = MAX_H;
    $('#sizeW').disabled = $('#sizeH').disabled = $('#btnApplySize').disabled = !admin;
    $('#sizeInfo').innerHTML = 'Tamaño fijo actual: <strong>' + fmt(d.size.w / 10) + ' × ' + fmt(d.size.h / 10) + ' cm</strong>. Se imprime exactamente a esta medida. ' +
      'Máximo para 4 por hoja carta: ' + fmt(MAX_W / 10) + ' × ' + fmt(MAX_H / 10) + ' cm.';
    $('#sizeLockNote').textContent = admin ? '' : 'Solo un administrador puede cambiar las dimensiones.';
  }
  function fmt(n) { return (Math.round(n * 100) / 100).toString().replace('.', ','); }

  /* ---------- Vista previa ---------- */
  var rafId = 0;
  function changed() { scheduleSave(); cancelAnimationFrame(rafId); rafId = requestAnimationFrame(function () { renderPreview(); renderProjectBar(); }); }

  function currentPerson() {
    state.current = Math.max(0, Math.min(state.current, state.people.length - 1));
    return state.people[state.current] || newPerson();
  }
  function renderPreview() {
    var stage = $('#previewStage'), scaler = $('#previewScaler');
    if (!stage || $('#appView').hidden) return;
    var d = state.design;
    var isCard = state.view === 'card';
    var badge = isCard ? C.build(d, currentPerson(), { mode: 'edit', serviceUrl: API.serviceUrl(), placeholders: PH }) : B.build(d, currentPerson(), 'edit', PH);
    var mmW = isCard ? C.W : d.size.w, mmH = isCard ? C.H : d.size.h;
    var wpx = mmW * B.PX_PER_MM, hpx = mmH * B.PX_PER_MM;
    var availW = Math.max(120, stage.clientWidth - 36), availH = Math.max(160, stage.clientHeight - 36);
    var k = Math.min(availW / wpx, availH / hpx, 2.2);
    scaler.style.width = (wpx * k) + 'px';
    scaler.style.height = (hpx * k) + 'px';
    badge.style.transform = 'scale(' + k + ')';
    scaler.innerHTML = '';
    scaler.appendChild(badge);
    if (isCard) C.fit(badge); else B.fit(badge);
    $('#badgeIndex').textContent = (state.current + 1) + ' / ' + state.people.length;
    $('#previewMeta').textContent = (isCard ? 'Carnet · ' : 'Escarapela · ') + 'tamaño real: ' + fmt(mmW / 10) + ' × ' + fmt(mmH / 10) + ' cm · vista al ' + Math.round(k * 100) + ' %';
    $$('.person').forEach(function (row, i) { row.classList.toggle('current', i === state.current); });
  }
  window.addEventListener('resize', function () { cancelAnimationFrame(rafId); rafId = requestAnimationFrame(renderPreview); });

  /* =========================================================
     PARTICIPANTES
     ========================================================= */
  function renderPeople() {
    var list = $('#peopleList');
    list.innerHTML = state.people.map(function (p, i) {
      return '<div class="person" data-i="' + i + '">' +
        '<span class="num">' + (i + 1) + '</span>' +
        '<input type="text" data-f="name" maxlength="120" placeholder="' + PH.name + '" value="' + B.esc(p.name) + '" aria-label="Nombre ' + (i + 1) + '">' +
        '<input type="text" data-f="role" maxlength="40" list="rolesList" placeholder="Rango (general)" value="' + B.esc(p.role) + '" aria-label="Rango ' + (i + 1) + '">' +
        '<button type="button" class="eye" title="Ver en la vista previa">👁</button></div>';
    }).join('');
    $('#count').value = state.people.length;
    updateSheetsInfo();
  }
  function updateSheetsInfo() {
    var n = state.people.length, filled = state.people.filter(function (p) { return cleanName(p.name); }).length;
    $('#sheetsInfo').textContent = filled + ' con nombre · ' + Math.ceil(Math.max(filled, 1) / 4) + ' hoja(s) al imprimir';
    if (n !== +$('#count').value) $('#count').value = n;
  }
  $('#peopleList').addEventListener('input', function (e) {
    var row = e.target.closest('.person'); if (!row) return;
    var i = +row.dataset.i;
    state.people[i][e.target.dataset.f] = e.target.value;
    state.current = i;
    updateSheetsInfo();
    changed();
  });
  $('#peopleList').addEventListener('focusin', function (e) {
    var row = e.target.closest('.person'); if (!row) return;
    var i = +row.dataset.i;
    if (i !== state.current) { state.current = i; changed(); }
  });
  $('#peopleList').addEventListener('click', function (e) {
    if (!e.target.classList.contains('eye')) return;
    state.current = +e.target.closest('.person').dataset.i; changed();
  });

  function setCount(n) {
    n = Math.max(1, Math.min(MAX_PEOPLE, Math.floor(+n || 1)));
    var cur = state.people.length;
    if (n < cur) {
      var lost = state.people.slice(n).filter(function (p) { return cleanName(p.name); }).length;
      if (lost && !confirm('Se eliminarán ' + lost + ' nombre(s) de las últimas filas. ¿Continuar?')) { $('#count').value = cur; return; }
      state.people = state.people.slice(0, n);
    } else {
      while (state.people.length < n) state.people.push(newPerson());
    }
    renderPeople(); changed();
  }
  $('#count').addEventListener('change', function () { setCount($('#count').value); });
  $('#countMinus').addEventListener('click', function () { setCount(state.people.length - 1); });
  $('#countPlus').addEventListener('click', function () { setCount(state.people.length + 1); });

  function loadNames(names, roles, sourceLabel) {
    names = names.map(cleanName).filter(Boolean).slice(0, MAX_PEOPLE);
    if (!names.length) { toast('No se encontraron nombres para cargar.', 'err'); return false; }
    var filled = state.people.filter(function (p) { return cleanName(p.name); }).length;
    if (filled && !confirm('Ya hay ' + filled + ' nombre(s) cargado(s). ¿Reemplazarlos por los ' + names.length + ' nuevos?')) return false;
    var before = state.people.length;
    // Si un nombre ya existía se conserva su id/QR: así un carnet ya impreso sigue siendo válido
    var prev = {};
    state.people.forEach(function (p) { var k = cleanName(p.name).toLowerCase(); if (k && !prev[k]) prev[k] = p; });
    state.people = names.map(function (n, i) {
      var x = newPerson(n, cleanName((roles && roles[i]) || '')), old = prev[n.toLowerCase()];
      if (old) { x.id = old.id; x.token = old.token; delete prev[n.toLowerCase()]; }
      return x;
    });
    state.current = 0;
    renderPeople(); changed();
    var msg = names.length + ' participante(s) cargado(s)' + (sourceLabel ? ' desde ' + sourceLabel : '') + '.';
    if (before > 1 && before !== names.length) msg += ' La cantidad se ajustó de ' + before + ' a ' + names.length + '.';
    toast(msg, 'ok', 4500);
    switchTab('tab-one');
    return true;
  }
  $('#btnBulk').addEventListener('click', function () {
    var raw = $('#bulkNames').value;
    if (loadNames(raw.split(/[,;\n\r\t]+/), null, 'la lista')) $('#bulkNames').value = '';
  });
  $('#btnProperCase').addEventListener('click', function () {
    state.people.forEach(function (p) { if (p.name) p.name = properCase(p.name); });
    renderPeople(); changed();
  });
  $('#btnClearPeople').addEventListener('click', function () {
    if (!confirm('¿Vaciar todos los nombres? La cantidad de escarapelas se mantiene.')) return;
    state.people.forEach(function (p) { p.name = ''; p.role = ''; });
    renderPeople(); changed();
  });

  function switchTab(id) {
    $$('.tab[data-tab]').forEach(function (t) { t.classList.toggle('active', t.dataset.tab === id); });
    $$('.tab-panel').forEach(function (p) { p.hidden = p.id !== id; });
  }
  $$('.tab[data-tab]').forEach(function (t) { t.addEventListener('click', function () { switchTab(t.dataset.tab); }); });

  /* ---------- Importar desde Excel / CSV ----------
   * Se usa SheetJS. Se detectan automáticamente las columnas por su título,
   * pero el usuario puede corregir la selección antes de importar. */
  function colLetter(i) { var s = ''; i++; while (i > 0) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }
  function norm(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim(); }
  function looksLikeHeader(row) {
    return row.some(function (c) { return /nombre|apellido|aprendiz|participante|rol|cargo|documento|identificacion|correo/.test(norm(c)); });
  }

  function handleExcelFile(file) {
    if (!file) return;
    if (!window.XLSX) { toast('No se pudo cargar el lector de Excel (js/vendor/xlsx.full.min.js).', 'err', 5000); return; }
    if (file.size > 15 * 1024 * 1024) { toast('El archivo supera 15 MB.', 'err'); return; }
    var isCsv = /\.csv$/i.test(file.name) || file.type === 'text/csv';
    var p = isCsv ? file.text().then(function (t) { return XLSX.read(t, { type: 'string' }); })
      : file.arrayBuffer().then(function (buf) { return XLSX.read(buf, { type: 'array' }); });
    p.then(function (wb) {
      excelData = { wb: wb, name: file.name };
      $('#xlSheet').innerHTML = wb.SheetNames.map(function (n, i) { return '<option value="' + i + '">' + B.esc(n) + '</option>'; }).join('');
      prepareSheet(true);
      $('#excelMap').hidden = false;
    }).catch(function () { toast('No se pudo leer el archivo. Verifica que sea un Excel o CSV válido.', 'err', 5000); });
  }

  function sheetRows() {
    var ws = excelData.wb.Sheets[excelData.wb.SheetNames[+$('#xlSheet').value || 0]];
    var rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: false, raw: false });
    return rows.filter(function (r) { return r.some(function (c) { return String(c).trim(); }); });
  }

  function prepareSheet(autoHeader) {
    var rows = sheetRows();
    if (!rows.length) { toast('La hoja seleccionada está vacía.', 'warn'); }
    var width = rows.reduce(function (m, r) { return Math.max(m, r.length); }, 0);
    if (autoHeader) $('#xlHeader').value = rows.length && looksLikeHeader(rows[0]) ? '1' : '0';
    var hasHeader = $('#xlHeader').value === '1';
    var head = hasHeader && rows[0] ? rows[0] : [];
    var labels = [];
    for (var i = 0; i < width; i++) labels.push('Columna ' + colLetter(i) + (head[i] ? ' · ' + String(head[i]).slice(0, 30) : ''));
    var opts = function (none) {
      return (none ? '<option value="-1">— Ninguna —</option>' : '') + labels.map(function (l, i) { return '<option value="' + i + '">' + B.esc(l) + '</option>'; }).join('');
    };
    $('#xlName').innerHTML = opts(false);
    $('#xlLast').innerHTML = opts(true);
    $('#xlLast2').innerHTML = opts(true);
    $('#xlRole').innerHTML = opts(true);

    // Detección automática
    var guess = { name: -1, last: -1, last2: -1, role: -1 };
    if (hasHeader) {
      head.forEach(function (h, i) {
        var n = norm(h);
        if (guess.name < 0 && /(nombre(s)? (completo|y apellidos))|^(aprendiz|participante|nombre completo)$/.test(n)) guess.name = i;
      });
      head.forEach(function (h, i) {
        var n = norm(h);
        if (guess.name < 0 && /nombre/.test(n) && !/usuario|programa|ficha|evento|empresa/.test(n)) guess.name = i;
        if (/apellido/.test(n)) { if (guess.last < 0) guess.last = i; else if (guess.last2 < 0) guess.last2 = i; }
        if (guess.role < 0 && /^(rol|cargo|perfil|tipo de participante|rango)/.test(n)) guess.role = i;
      });
      if (/completo|y apellidos/.test(norm(head[guess.name]))) { guess.last = -1; guess.last2 = -1; }
    }
    if (guess.name < 0) {
      // Sin títulos: columnas con más texto "tipo nombre" (descarta números de documento y siglas CC/TI)
      var data = rows.slice(hasHeader ? 1 : 0, 60);
      var scores = [];
      for (var c = 0; c < width; c++) {
        var good = 0, len = 0;
        data.forEach(function (r) {
          var v = String(r[c] || '').trim();
          if (/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' .-]{4,}$/.test(v)) { good++; len += v.length; }
        });
        scores.push({ c: c, s: good, avg: good ? len / good : 0 });
      }
      var textCols = scores.filter(function (x) { return x.s >= Math.max(1, data.length * 0.6) && x.avg > 3; }).map(function (x) { return x.c; });
      guess.name = textCols.length ? textCols[0] : 0;
      if (textCols.length > 1 && textCols[1] === guess.name + 1) guess.last = textCols[1];
      if (textCols.length > 2 && textCols[2] === guess.name + 2) guess.last2 = textCols[2];
    }
    $('#xlName').value = String(Math.max(0, guess.name));
    $('#xlLast').value = String(guess.last);
    $('#xlLast2').value = String(guess.last2);
    $('#xlRole').value = String(guess.role);
    renderExcelPreview();
  }

  function excelPeople() {
    var rows = sheetRows();
    if ($('#xlHeader').value === '1') rows = rows.slice(1);
    var ci = +$('#xlName').value, li = +$('#xlLast').value, l2 = +$('#xlLast2').value, ri = +$('#xlRole').value;
    var out = [];
    rows.forEach(function (r) {
      var parts = [r[ci], li >= 0 ? r[li] : '', l2 >= 0 ? r[l2] : ''].map(cleanName).filter(Boolean);
      var name = parts.join(' ');
      if (name) out.push({ name: name, role: ri >= 0 ? cleanName(r[ri]) : '' });
    });
    return out;
  }
  function renderExcelPreview() {
    var ppl = excelPeople();
    $('#xlPreview').innerHTML = '<table><thead><tr><th>#</th><th>Nombre en la escarapela (' + ppl.length + ' en total)</th><th>Rango</th></tr></thead><tbody>' +
      ppl.slice(0, 8).map(function (p, i) { return '<tr><td>' + (i + 1) + '</td><td>' + B.esc(p.name) + '</td><td>' + B.esc(p.role || '—') + '</td></tr>'; }).join('') +
      (ppl.length > 8 ? '<tr><td></td><td colspan="2">… y ' + (ppl.length - 8) + ' más</td></tr>' : '') + '</tbody></table>';
  }
  $('#excelFile').addEventListener('change', function (e) { handleExcelFile(e.target.files[0]); e.target.value = ''; });
  $('#xlSheet').addEventListener('change', function () { prepareSheet(true); });
  $('#xlHeader').addEventListener('change', function () { prepareSheet(false); });
  ['#xlName', '#xlLast', '#xlLast2', '#xlRole'].forEach(function (s) { $(s).addEventListener('change', renderExcelPreview); });
  $('#xlCancel').addEventListener('click', function () { excelData = null; $('#excelMap').hidden = true; });
  $('#xlImport').addEventListener('click', function () {
    var ppl = excelPeople();
    if (ppl.length > MAX_PEOPLE) toast('Se importarán solo los primeros ' + MAX_PEOPLE + ' participantes.', 'warn');
    var useProper = ppl.length && ppl.every(function (p) { return p.name === p.name.toUpperCase(); }) &&
      confirm('Los nombres están en MAYÚSCULAS. ¿Convertirlos a formato Nombre Propio (Ana María Pérez)?');
    var ok = loadNames(ppl.map(function (p) { return useProper ? properCase(p.name) : p.name; }), ppl.map(function (p) { return p.role; }), excelData ? '“' + excelData.name + '”' : 'Excel');
    if (ok) { excelData = null; $('#excelMap').hidden = true; }
  });
  var drop = $('#excelDrop');
  ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
  ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
  drop.addEventListener('drop', function (e) { handleExcelFile(e.dataTransfer.files[0]); });

  /* =========================================================
     EVENTOS DE CONTROLES
     ========================================================= */
  function bindControls() {
    $('#logoPos').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      state.design.logoPos = b.dataset.v; setSegmented('logoPos', b.dataset.v); changed();
    });
    $('#theme').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      state.design.theme = b.dataset.v; setSegmented('theme', b.dataset.v); changed();
    });
    var showBadge = function () { if (state.view !== 'badge') { state.view = 'badge'; setSegmented('previewView', 'badge'); } };
    $('#logo2Pos').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      state.design.logo2Pos = b.dataset.v; setSegmented('logo2Pos', b.dataset.v); showBadge(); changed();
    });
    $('#cardLogo2Pos').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      state.design.cardLogo2Pos = b.dataset.v; setSegmented('cardLogo2Pos', b.dataset.v);
      if (state.view !== 'card') { state.view = 'card'; setSegmented('previewView', 'card'); }
      changed();
    });
    $('#logo2Size').addEventListener('input', function (e) { state.design.logo2Size = +e.target.value; $('#logo2SizeOut').textContent = fmt(+e.target.value) + ' mm'; showBadge(); changed(); });
    $('#cardLogo2Size').addEventListener('input', function (e) {
      state.design.cardLogo2Size = +e.target.value; $('#cardLogo2SizeOut').textContent = fmt(+e.target.value) + ' mm';
      if (state.view !== 'card') { state.view = 'card'; setSegmented('previewView', 'card'); }
      changed();
    });
    $$('[data-footscale]').forEach(function (inp) {
      inp.addEventListener('input', function () {
        var i = +inp.dataset.footscale;
        state.design.footScale[i] = +inp.value; $('#footScaleOut' + i).textContent = inp.value + ' %'; showBadge(); changed();
      });
    });
    $('#logoSize').addEventListener('input', function (e) { state.design.logoSize = +e.target.value; $('#logoSizeOut').textContent = e.target.value + ' mm'; changed(); });
    $('#footSize').addEventListener('input', function (e) { state.design.footSize = +e.target.value; $('#footSizeOut').textContent = e.target.value + ' mm'; changed(); });
    $('#overlay').addEventListener('input', function (e) { state.design.overlay = +e.target.value; $('#overlayOut').textContent = e.target.value + ' %'; changed(); });
    $('#pattern').addEventListener('change', function (e) { state.design.pattern = e.target.value; changed(); });
    $('#slot').addEventListener('change', function (e) { state.design.slot = e.target.checked; changed(); });

    $('#baseColor').addEventListener('input', function (e) { setBaseColor(e.target.value); });
    $('#baseColorHex').addEventListener('change', function (e) {
      var v = e.target.value.trim(); if (v[0] !== '#') v = '#' + v;
      if (/^#[0-9a-f]{6}$/i.test(v)) setBaseColor(v); else { toast('Escribe un color válido, ej. #FDD835', 'warn'); e.target.value = state.design.baseColor; }
    });
    $('#quickColors').innerHTML = QUICK.map(function (c) { return '<button type="button" style="background:' + c + '" data-c="' + c + '" title="' + c + '"></button>'; }).join('');
    $('#quickColors').addEventListener('click', function (e) { if (e.target.dataset.c) setBaseColor(e.target.dataset.c); });
    $('#btnRandomColor').addEventListener('click', function () {
      var hex = B.hslToHex(Math.random() * 360, 60 + Math.random() * 30, 42 + Math.random() * 14);
      var sc = B.SCHEMES[Math.floor(Math.random() * B.SCHEMES.length)].id;
      setBaseColor(hex, sc);
    });
    $('#palettes').addEventListener('click', function (e) {
      var b = e.target.closest('.palette'); if (!b) return;
      state.design.scheme = b.dataset.scheme;
      state.design.palette = B.makePalette(state.design.baseColor, b.dataset.scheme);
      renderPalettes(); changed();
    });
    $('#paletteEdit').addEventListener('input', function (e) {
      if (!e.target.dataset.role) return;
      state.design.palette[e.target.dataset.role] = e.target.value.toUpperCase(); changed();
    });

    // Imágenes
    $$('[data-upload]').forEach(function (inp) {
      inp.addEventListener('change', function () {
        var key = inp.dataset.upload, f = inp.files[0]; inp.value = '';
        if (!f) return;
        var cfg = key === 'bg' ? [1800, false] : (key === 'logo' || key === 'logo2') ? [900, true] : [700, true];
        readImage(f, cfg[0], cfg[1]).then(function (url) {
          setImg(key, url); renderThumb(key); changed();
          toast('Imagen cargada.', 'ok', 1800);
        }).catch(function (err) { toast(err.message, 'err'); });
      });
    });
    $$('[data-clear]').forEach(function (b) {
      b.addEventListener('click', function () { setImg(b.dataset.clear, null); renderThumb(b.dataset.clear); changed(); });
    });

    // Tamaño
    $('#btnApplySize').addEventListener('click', function () {
      var w = +$('#sizeW').value, h = +$('#sizeH').value;
      if (!(w >= 50 && w <= MAX_W) || !(h >= 70 && h <= MAX_H)) {
        toast('Medidas fuera de rango. Ancho 50–' + MAX_W + ' mm y alto 70–' + MAX_H + ' mm para que quepan 4 por hoja.', 'err', 5500);
        syncSize(); return;
      }
      state.design.size = { w: Math.round(w * 10) / 10, h: Math.round(h * 10) / 10 };
      syncSize(); changed();
      toast('Tamaño aplicado: ' + fmt(w / 10) + ' × ' + fmt(h / 10) + ' cm.', 'ok');
    });

    // Navegación de la vista previa
    $('#prevBadge').addEventListener('click', function () { state.current = (state.current - 1 + state.people.length) % state.people.length; changed(); });
    $('#nextBadge').addEventListener('click', function () { state.current = (state.current + 1) % state.people.length; changed(); });

    // Plantillas
    $('#btnExport').addEventListener('click', function () {
      var data = { type: 'escSena.template', version: 1, exported: new Date().toISOString(), design: state.design };
      if ($('#exportPeople').checked) data.people = state.people;
      var name = slug((state.design.texts.t1 || '') + ' ' + (state.design.texts.t2 || '')) || 'evento';
      download('plantilla_' + name + '.json', new Blob([JSON.stringify(data)], { type: 'application/json' }));
    });
    $('#importFile').addEventListener('change', function (e) {
      var f = e.target.files[0]; e.target.value = '';
      if (!f) return;
      f.text().then(function (txt) {
        var data = JSON.parse(txt);
        if (!data || data.type !== 'escSena.template' || !data.design) throw new Error('El archivo no es una plantilla de escarapelas.');
        state.design = mergeDesign(data.design);
        if (Array.isArray(data.people) && data.people.length) state.people = sanitizePeople(data.people);
        // Una plantilla importada es un proyecto NUEVO: códigos y QR nuevos para no chocar con el original
        regenerateIds();
        state.meta = null;
        state.current = 0;
        syncAllControls(); renderPeople(); changed();
        toast('Plantilla importada como proyecto nuevo. Pulsa 💾 Guardar para ponerle nombre.', 'ok', 5000);
      }).catch(function (err) { toast(err.message || 'Archivo no válido.', 'err'); });
    });
    $('#btnReset').addEventListener('click', function () {
      if (!confirm('¿Reiniciar el diseño? Se borran textos, colores e imágenes de este proyecto (los participantes y sus QR se conservan).')) return;
      var keepSize = state.design.size, keepId = state.design.eventId;
      state.design = defaultDesign(); state.design.size = keepSize; state.design.eventId = keepId;
      syncAllControls(); changed();
    });

    $('#previewView').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      state.view = b.dataset.v; setSegmented('previewView', b.dataset.v); changed();
    });
    $('#btnOpenAtt').addEventListener('click', function () { AttendanceModule.open(state.meta ? state.meta.id : ''); });
    $('#btnAttendance').addEventListener('click', function () { AttendanceModule.open(state.meta ? state.meta.id : ''); });
    $('#btnSave').addEventListener('click', function () { ProjectsModule.save(); });
    $('#btnSaveAs').addEventListener('click', function () { ProjectsModule.saveAs(); });
    $('#btnProjects').addEventListener('click', function () { ProjectsModule.open(); });
    $('#btnNewProject').addEventListener('click', function () { ProjectsModule.newProject(); });
    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S') && !$('#appView').hidden) { e.preventDefault(); ProjectsModule.save(); }
    });
    window.addEventListener('beforeunload', function (e) {
      if (state.user && isDirty()) { persistDraft(); e.preventDefault(); e.returnValue = ''; }
    });
    $('#printMode').addEventListener('change', renderPrint);
    $('#btnPrint').addEventListener('click', openPrint);
    $('#paper').addEventListener('change', renderPrint);
    $('#cutGuides').addEventListener('change', renderPrint);
    $('#printEmpty').addEventListener('change', renderPrint);
    $('#btnDoPrint').addEventListener('click', doPrint);
    $('#btnPng').addEventListener('click', exportPng);
    $('#btnZip').addEventListener('click', exportZip);
  }

  /* =========================================================
     IMPRESIÓN
     - Solo escarapelas: 4 por hoja (2 × 2), tamaño exacto.
     - Solo carnets: los que quepan (carta 8, oficio 10, legal 12).
     - Escarapela + carnet: cada persona con su carnet debajo (2 personas por hoja).
     ========================================================= */
  var PAIR_GAP = 4; // mm entre escarapela y carnet de la misma persona

  function printablePeople() {
    var includeEmpty = $('#printEmpty').checked;
    return state.people.filter(function (p) { return includeEmpty || cleanName(p.name); });
  }
  function pieceSize(mode) {
    var bw = state.design.size.w, bh = state.design.size.h;
    if (mode === 'badges') return { w: bw, h: bh };
    if (mode === 'cards') return { w: C.W, h: C.H };
    return { w: Math.max(bw, C.W), h: bh + PAIR_GAP + C.H };
  }
  /* Cuadrícula centrada: el espacio sobrante se reparte por igual (margen = separación),
   * así todo queda simétrico y las guías de corte coinciden. */
  function layout(paperKey, mode) {
    var P = PAPERS[paperKey], it = pieceSize(mode);
    var cols = Math.floor((P.w - MIN_MARGIN) / (it.w + MIN_MARGIN));
    var rows = Math.floor((P.h - MIN_MARGIN) / (it.h + MIN_MARGIN));
    if (mode === 'badges') { if (cols < 2 || rows < 2) return null; cols = 2; rows = 2; }
    if (cols < 1 || rows < 1) return null;
    var gx = (P.w - cols * it.w) / (cols + 1), gy = (P.h - rows * it.h) / (rows + 1), slots = [];
    for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) slots.push({ x: gx + c * (it.w + gx), y: gy + r * (it.h + gy) });
    return { P: P, w: it.w, h: it.h, slots: slots };
  }
  function place(sheet, node, x, y, w, h, cut) {
    if (cut) {
      var g = document.createElement('div');
      g.className = 'cut';
      g.style.left = (x - 0.3) + 'mm'; g.style.top = (y - 0.3) + 'mm';
      g.style.width = (w + 0.6) + 'mm'; g.style.height = (h + 0.6) + 'mm';
      sheet.appendChild(g);
    }
    var pos = document.createElement('div');
    pos.className = 'slot-pos';
    pos.style.left = x + 'mm'; pos.style.top = y + 'mm';
    pos.appendChild(node);
    sheet.appendChild(pos);
  }
  function cardFor(p) { return C.build(state.design, p, { mode: 'final', serviceUrl: API.serviceUrl(), placeholders: PH }); }

  function buildSheets(paperKey, mode) {
    var L = layout(paperKey, mode);
    if (!L) return { error: mode === 'badges' ? 'La escarapela no cabe 4 veces en este papel. Reduce el tamaño.' : 'Las piezas no caben en este papel.' };
    if (mode !== 'badges' && !API.serviceUrl()) {
      return { error: 'Para imprimir carnets primero configura el servidor. Sin él, los QR no registrarían asistencia.' };
    }
    var people = printablePeople(), cut = $('#cutGuides').checked, per = L.slots.length, d = state.design, sheets = [];
    for (var i = 0; i < people.length; i += per) {
      var sheet = document.createElement('div');
      sheet.className = 'sheet';
      sheet.style.width = L.P.w + 'mm';
      sheet.style.height = (L.P.h - 0.5) + 'mm'; // -0,5 mm evita que el navegador agregue una hoja en blanco por redondeo
      people.slice(i, i + per).forEach(function (p, j) {
        var s = L.slots[j];
        if (mode === 'badges') place(sheet, B.build(d, p, 'final', PH), s.x, s.y, d.size.w, d.size.h, cut);
        else if (mode === 'cards') place(sheet, cardFor(p), s.x, s.y, C.W, C.H, cut);
        else {
          place(sheet, B.build(d, p, 'final', PH), s.x + (L.w - d.size.w) / 2, s.y, d.size.w, d.size.h, cut);
          place(sheet, cardFor(p), s.x + (L.w - C.W) / 2, s.y + d.size.h + PAIR_GAP, C.W, C.H, cut);
        }
      });
      sheets.push(sheet);
    }
    return { sheets: sheets, L: L, count: people.length, per: per };
  }

  function openPrint() {
    var filled = state.people.filter(function (p) { return cleanName(p.name); }).length;
    if (!filled && !$('#printEmpty').checked) {
      toast('No hay nombres cargados. Marca “Incluir escarapelas sin nombre” para imprimirlas en blanco.', 'warn', 5000);
      $('#printEmpty').checked = true;
    }
    openModal('#printModal');
    (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(renderPrint);
  }

  function renderPrint() {
    var box = $('#printPreview'), mode = $('#printMode').value;
    box.innerHTML = '';
    var r = buildSheets($('#paper').value, mode);
    var fail = function (msg) { box.innerHTML = '<p class="print-msg">' + B.esc(msg) + '</p>'; $('#printSummary').textContent = ''; $('#btnDoPrint').disabled = true; };
    if (r.error) return fail(r.error);
    if (!r.sheets.length) return fail('No hay participantes para imprimir.');
    $('#btnDoPrint').disabled = false;
    var pw = r.L.P.w * B.PX_PER_MM, ph = r.L.P.h * B.PX_PER_MM;
    var scale = Math.min(1, 520 / pw);
    r.sheets.forEach(function (sheet, i) {
      var frame = document.createElement('div');
      frame.className = 'sheet-frame';
      var holder = document.createElement('div');
      holder.className = 'sheet-holder';
      holder.style.width = (pw * scale) + 'px'; holder.style.height = (ph * scale) + 'px';
      sheet.style.transform = 'scale(' + scale + ')';
      holder.appendChild(sheet);
      var lab = document.createElement('div');
      lab.className = 'sheet-label';
      lab.textContent = 'Hoja ' + (i + 1) + ' de ' + r.sheets.length;
      frame.appendChild(holder); frame.appendChild(lab);
      box.appendChild(frame);
    });
    $$('.badge', box).forEach(B.fit);
    $$('.idcard', box).forEach(C.fit);
    var what = mode === 'badges' ? 'escarapela(s)' : mode === 'cards' ? 'carnet(s)' : 'persona(s) con escarapela + carnet';
    var size = mode === 'cards' ? fmt(C.W / 10) + ' × ' + fmt(C.H / 10) + ' cm' : fmt(state.design.size.w / 10) + ' × ' + fmt(state.design.size.h / 10) + ' cm';
    $('#printSummary').textContent = r.count + ' ' + what + ' · ' + r.sheets.length + ' hoja(s) ' + r.L.P.name + ' · ' + r.per + ' por hoja · ' + size;
  }

  function sendToPrinter() {
    var sheets = $$('#printPreview .sheet');
    if (!sheets.length) return;
    var P = PAPERS[$('#paper').value];
    $('#pageStyle').textContent = '@page { size: ' + P.w + 'mm ' + P.h + 'mm; margin: 0; }';
    var root = $('#printRoot');
    root.innerHTML = '';
    sheets.forEach(function (s) { var c = s.cloneNode(true); c.style.transform = 'none'; root.appendChild(c); });
    var imgs = $$('img', root);
    Promise.all(imgs.map(function (im) { return im.decode ? im.decode().catch(function () { }) : Promise.resolve(); })).then(function () {
      setTimeout(function () { window.print(); }, 60);
    });
  }
  /* Antes de imprimir carnets el proyecto debe estar guardado: así cada QR impreso ya es válido en el servidor */
  function doPrint() {
    var mode = $('#printMode').value, btn = $('#btnDoPrint');
    if (mode === 'badges') return sendToPrinter();
    btn.disabled = true; btn.textContent = 'Verificando…';
    ProjectsModule.ensureSaved().then(function (ok) {
      if (ok) { renderPrint(); sendToPrinter(); }
      else toast('Impresión cancelada: guarda el proyecto para que los QR funcionen.', 'warn', 4500);
    }).then(function () { btn.disabled = false; btn.textContent = '🖨 Imprimir'; });
  }
  window.addEventListener('afterprint', function () { $('#printRoot').innerHTML = ''; });

  /* =========================================================
     FORMATO DIGITAL: PNG a 300 ppp y ZIP (escarapelas o carnets, según la vista previa)
     ========================================================= */
  function renderPng(person, kind) {
    var host = $('#offscreen');
    var node = kind === 'card' ? cardFor(person) : B.build(state.design, person, 'final', PH);
    host.innerHTML = '';
    host.appendChild(node);
    if (kind === 'card') C.fit(node); else B.fit(node);
    return html2canvas(node, { scale: 300 / 96, backgroundColor: '#ffffff', logging: false, useCORS: true })
      .then(function (canvas) { host.innerHTML = ''; return canvas; });
  }
  function ready(kind) {
    if (!window.html2canvas) { toast('No se pudo cargar el generador de imágenes (js/vendor).', 'err'); return null; }
    if (kind === 'card' && !API.serviceUrl()) { toast('Configura el servidor para generar carnets con QR.', 'warn', 5000); return null; }
    if (kind === 'card' && (!state.meta || isDirty())) toast('Recuerda guardar el proyecto: los QR solo funcionan con el proyecto guardado.', 'warn', 5000);
    return document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  }
  function exportPng() {
    var kind = state.view, r = ready(kind); if (!r) return;
    var p = currentPerson();
    $('#btnPng').disabled = true;
    r.then(function () { return renderPng(p, kind); }).then(function (canvas) {
      download((kind === 'card' ? 'carnet_' : 'escarapela_') + String(state.current + 1).padStart(2, '0') + '_' + slug(p.name) + '.png', canvas.toDataURL('image/png'));
    }).catch(function () { toast('No se pudo generar la imagen.', 'err'); }).then(function () { $('#btnPng').disabled = false; });
  }
  function exportZip() {
    var kind = state.view, r = ready(kind); if (!r) return;
    if (!window.JSZip) { toast('No se pudo cargar el compresor ZIP (js/vendor).', 'err'); return; }
    var people = state.people.filter(function (p) { return cleanName(p.name); });
    if (!people.length) { toast('No hay nombres cargados.', 'warn'); return; }
    var zip = new JSZip(), btn = $('#btnZip'), i = 0, label = kind === 'card' ? 'carnets' : 'escarapelas';
    btn.disabled = true;
    var step = function () {
      if (i >= people.length) {
        btn.textContent = 'Comprimiendo…';
        return zip.generateAsync({ type: 'blob' }).then(function (blob) {
          download(label + '_' + slug(state.design.texts.t2 || state.design.texts.t1 || 'evento') + '.zip', blob);
          toast(people.length + ' ' + label + ' exportados en PNG (300 ppp).', 'ok');
        });
      }
      btn.textContent = 'Generando ' + (i + 1) + '/' + people.length + '…';
      var p = people[i];
      return renderPng(p, kind).then(function (canvas) {
        var data = canvas.toDataURL('image/png').split(',')[1];
        zip.file(String(i + 1).padStart(3, '0') + '_' + slug(p.name) + '.png', data, { base64: true });
        i++;
        return step();
      });
    };
    r.then(step).catch(function () { toast('Ocurrió un error al generar las imágenes.', 'err'); })
      .then(function () { btn.disabled = false; btn.textContent = '⬇ Todas (ZIP)'; });
  }

  /* =========================================================
     INICIO
     ========================================================= */
  /* Códigos nuevos (proyecto y QR de cada persona): para “Guardar como” y plantillas importadas */
  function regenerateIds() {
    state.design.eventId = rid(8);
    state.people.forEach(function (p) { p.id = rid(10); p.token = rid(20); });
  }
  function applyProject(data, meta) {
    var d = data && data.design ? mergeDesign(data.design) : defaultDesign();
    d.eventId = meta.id; // el código del proyecto manda: es el que llevan los QR impresos
    state.design = d;
    state.people = sanitizePeople(data && data.people && data.people.length ? data.people : null);
    state.meta = { id: meta.id, name: meta.name, updatedAt: meta.updatedAt };
    state.current = 0;
    syncAllControls(); renderPeople();
    markSaved(); changed();
    if (data && !data.design) toast('Este proyecto viene de la versión 3 y no tenía diseño guardado: se cargaron sus participantes con el diseño básico. Ajusta el diseño y guarda.', 'warn', 7000);
  }
  function blankProject() {
    var keepSize = state.design.size;
    state.design = defaultDesign(); state.design.size = keepSize;
    state.people = [newPerson()];
    state.meta = null; state.current = 0;
    syncAllControls(); renderPeople();
    markSaved(); changed();
  }

  function init() {
    B.loadFonts();
    loadAppBg();
    buildFieldControls();
    bindControls();
    var isAdmin = function () { return !!(state.user && state.user.role === 'admin'); };
    AttendanceModule.init({
      isAdmin: isAdmin, toast: toast, esc: B.esc, slug: slug,
      currentProjectId: function () { return state.meta ? state.meta.id : ''; },
      loadProject: function (id) { ProjectsModule.load(id); },
      onScanChanged: function () { }
    });
    ProjectsModule.init({
      isAdmin: isAdmin, toast: toast, esc: B.esc, download: download, ask: ask,
      username: function () { return state.user ? state.user.username : ''; },
      getDraft: function () { return { design: state.design, people: state.people }; },
      getMeta: function () { return state.meta; },
      setMeta: function (m) { state.meta = m; renderProjectBar(); scheduleSave(); },
      isDirty: isDirty,
      setDirty: function (v) { if (!v) markSaved(); },
      setSaving: function (v) { state.saving = v; renderProjectBar(); },
      regenerateIds: function () { regenerateIds(); renderEventInfo(); changed(); },
      apply: applyProject,
      newProject: blankProject,
      openAttendance: function (id) { AttendanceModule.open(id); },
      onProjectDeleted: function (id) {
        if (state.meta && (id === '*' || state.meta.id === id)) {
          state.meta = null; state.savedSig = ''; renderProjectBar(); scheduleSave();
          toast('El proyecto que tenías abierto fue eliminado. Tu trabajo sigue en pantalla como proyecto nuevo sin guardar.', 'warn', 6000);
        }
      },
      onRestored: function () { blankProject(); persistDraft(); logout('Restauración completa. Ingresa con un usuario del backup.'); }
    });
    if (document.fonts) document.fonts.addEventListener('loadingdone', function () { changed(); });
    var u = Auth.current();
    if (u && API.serviceUrl()) {
      state.user = u; showApp();
      // Confirma con el servidor que la sesión sigue viva (si expiró, onAuthLost vuelve al ingreso)
      Auth.refresh().then(function (fresh) {
        state.user = fresh;
        $('#userBadge').innerHTML = B.esc(fresh.username) + ' · <b>' + (fresh.role === 'admin' ? 'Administrador' : 'Usuario') + '</b>';
        $('#btnUsers').hidden = $('#btnAppBg').hidden = fresh.role !== 'admin';
        syncSize();
        if (fresh.mustChange) openPassModal(true);
      }).catch(function () { });
    } else showLogin();
  }
  init();
})();
