/**
 * ============================================================
 *  SERVIDOR — Escarapelas y Asistencia SENA · Versión 4
 * ============================================================
 */

var VERSION = '4.1';
var TZ = 'America/Bogota';
var CLAVE_INICIAL = '123456';
var ITERACIONES = 1000;          // estiramiento de clave (SHA-256 iterado)
var SESION_SEG = 21600;          // 6 horas (máximo de CacheService)
var MAX_FALLOS = 5;              // intentos fallidos antes de bloquear
var BLOQUEO_SEG = 300;           // 5 minutos de bloqueo

var H_USR = 'Usuarios', H_PRO = 'Proyectos', H_PART = 'Participantes', H_ASIS = 'Asistencia', H_AUD = 'Auditoria';
var CAB = {
  Usuarios: ['usuario', 'rol', 'sal', 'hash', 'cambiar_clave', 'creado', 'creado_por'],
  Proyectos: ['id', 'nombre', 'creado_por', 'creado', 'actualizado_por', 'actualizado', 'archivo_id', 'escaneo'],
  Participantes: ['evento_id', 'evento', 'id', 'token', 'nombre', 'rol', 'actualizado'],
  Asistencia: ['fecha_hora', 'fecha', 'hora', 'evento_id', 'evento', 'id', 'nombre', 'rol', 'origen'],
  Auditoria: ['fecha_hora', 'usuario', 'accion', 'detalle']
};
// Índices de columnas (base 0)
var U = { usuario: 0, rol: 1, sal: 2, hash: 3, cambiar: 4, creado: 5, por: 6 };
var P = { id: 0, nombre: 1, creadoPor: 2, creado: 3, actPor: 4, act: 5, archivo: 6, escaneo: 7 };

var RE_ID = /^[A-Za-z0-9]{6,24}$/;
var RE_TOKEN = /^[A-Za-z0-9]{8,40}$/;
var RE_USER = /^[A-Za-zÁÉÍÓÚÑáéíóúñ0-9._-]{3,30}$/;
var RE_HEX64 = /^[0-9a-f]{64}$/;
var RE_HEX32 = /^[0-9a-f]{32}$/;
// Imagen embebida segura: solo formatos raster y solo caracteres base64 hasta el final
var RE_IMG = /^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+\/]+={0,2}$/;
function imagenValida_(v) { return typeof v === 'string' && v.length < 15000000 && RE_IMG.test(v); }

/* Registro de auditoría (no se borra con “Borrar todo” ni con la restauración) */
function auditar_(usuario, accion, detalle) {
  try { agregarFilas_(H_AUD, [[ahora_().full, usuario || '—', accion, String(detalle || '').slice(0, 190)]]); } catch (e) { /* nunca bloquea la operación */ }
}

/* Política de contraseñas: mínimo 8 caracteres con letras y números */
function claveSegura_(c) {
  c = String(c || '');
  if (c.length < 8 || !/[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(c) || !/[0-9]/.test(c)) throw err_('La contraseña debe tener al menos 8 caracteres e incluir letras y números.');
  if (c === CLAVE_INICIAL) throw err_('No uses la contraseña inicial.');
}

/* Cierre de sesiones: toda sesión emitida antes de esta marca deja de valer */
function revocar_(usuario) { CacheService.getScriptCache().put('rev_' + String(usuario).toLowerCase(), String(Date.now()), SESION_SEG); }
function revocarTodas_() { CacheService.getScriptCache().put('rev_*', String(Date.now()), SESION_SEG); }
function nuevaSesion_(usuario) {
  var token = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
  CacheService.getScriptCache().put('s_' + token, JSON.stringify({ u: usuario, t: Date.now() }), SESION_SEG);
  return token;
}

/* Limpia las imágenes de un diseño antes de guardarlo: lo que no sea una imagen válida se descarta */
function limpiarDiseno_(d) {
  if (!d || typeof d !== 'object') return null;
  ['logo', 'logo2', 'bg'].forEach(function (k) { if (d[k] != null && !imagenValida_(d[k])) d[k] = null; });
  if (Array.isArray(d.foot)) d.foot = [0, 1, 2].map(function (i) { return imagenValida_(d.foot[i]) ? d.foot[i] : null; });
  return d;
}

/* ============================================================
   INSTALACIÓN Y ESQUEMA
   ============================================================ */
function instalar() {
  var ss = libro_();
  esquema_();
  Logger.log('Base de datos: ' + ss.getUrl());
  Logger.log('Carpeta de proyectos en Drive: ' + carpeta_().getUrl());
  Logger.log('Instalación correcta (versión ' + VERSION + '). Implementa o actualiza la Aplicación web.');
}

/* Libro de Sheets: el vinculado al script o uno creado automáticamente (proyecto suelto). */
var _libro = null;
function libro_() {
  if (_libro) return _libro;
  var activo = null;
  try { activo = SpreadsheetApp.getActiveSpreadsheet(); } catch (e) { activo = null; }
  if (activo) return (_libro = activo);
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('SHEET_ID');
  if (id) {
    try { return (_libro = SpreadsheetApp.openById(id)); }
    catch (e) { throw new Error('No se pudo abrir la hoja de datos (¿la borraste?). Ejecuta “reiniciarBaseDeDatos”.'); }
  }
  _libro = SpreadsheetApp.create('Asistencia Escarapelas SENA');
  props.setProperty('SHEET_ID', _libro.getId());
  return _libro;
}

/* Solo si borraste la hoja de datos: crea una nueva */
function reiniciarBaseDeDatos() {
  PropertiesService.getScriptProperties().deleteProperty('SHEET_ID');
  PropertiesService.getScriptProperties().deleteProperty('MIGRADO_V4');
  _libro = null; _hojas = {};
  instalar();
}

var _hojas = {};
function hoja_(nombre) {
  if (_hojas[nombre]) return _hojas[nombre];
  var ss = libro_();
  var cab = CAB[nombre];
  var sh = ss.getSheetByName(nombre);
  if (!sh) {
    sh = ss.insertSheet(nombre);
    sh.getRange(1, 1, 1, cab.length).setValues([cab]).setFontWeight('bold').setBackground('#0f172a').setFontColor('#ffffff');
    sh.setFrozenRows(1);
    sh.getRange(1, 1, sh.getMaxRows(), cab.length).setNumberFormat('@'); // todo como texto
    var extra = ss.getSheets().filter(function (x) { return !CAB[x.getName()] && x.getLastRow() === 0; });
    if (extra.length && ss.getSheets().length > extra.length) extra.forEach(function (x) { ss.deleteSheet(x); });
  }
  return (_hojas[nombre] = sh);
}

function esquema_() {
  [H_USR, H_PRO, H_PART, H_ASIS].forEach(hoja_);
  usuarioInicial_();
  migrarV3_();
}

/* Crea Walter / 123456 si no existe ningún administrador */
function usuarioInicial_() {
  if (filas_(H_USR).some(function (r) { return r[U.rol] === 'admin'; })) return;
  var sal = sal_();
  agregarFilas_(H_USR, [['Walter', 'admin', sal, hashClave_(CLAVE_INICIAL, sal), 'SI', ahora_().full, 'sistema']]);
}

/* Versión 3 → 4: crea un proyecto por cada evento que ya tenía participantes, conservando su escaneo */
function migrarV3_() {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('MIGRADO_V4') === '1') return;
  var existentes = {};
  filas_(H_PRO).forEach(function (r) { existentes[r[P.id]] = true; });
  var nuevos = {}, orden = [], t = ahora_().full;
  filas_(H_PART).forEach(function (r) {
    if (RE_ID.test(r[0]) && !existentes[r[0]] && !nuevos[r[0]]) { nuevos[r[0]] = r[1] || ('Proyecto ' + r[0]); orden.push(r[0]); }
  });
  agregarFilas_(H_PRO, orden.map(function (id) {
    return [id, nuevos[id] + ' (v3 ' + id + ')', 'migración', t, 'migración', t, '', props.getProperty('scan_' + id) === '1' ? 'SI' : 'NO'];
  }));
  props.setProperty('MIGRADO_V4', '1');
}

/* Carpeta de Drive donde se guarda un archivo JSON por proyecto */
var _carpeta = null;
function carpeta_() {
  if (_carpeta) return _carpeta;
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('FOLDER_ID');
  if (id) { try { _carpeta = DriveApp.getFolderById(id); if (!_carpeta.isTrashed()) return _carpeta; } catch (e) { /* se crea otra */ } }
  _carpeta = DriveApp.createFolder('Escarapelas SENA - Proyectos (no borrar)');
  props.setProperty('FOLDER_ID', _carpeta.getId());
  return _carpeta;
}

/* ============================================================
   UTILIDADES
   ============================================================ */
function ahora_() {
  var d = new Date();
  return {
    full: Utilities.formatDate(d, TZ, 'yyyy-MM-dd HH:mm:ss'),
    fecha: Utilities.formatDate(d, TZ, 'yyyy-MM-dd'),
    hora: Utilities.formatDate(d, TZ, 'HH:mm:ss')
  };
}
function json_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
function esc_(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
// Evita "inyección de fórmulas" en la hoja (textos que empiezan por = + - @)
function celda_(s) { s = String(s == null ? '' : s).slice(0, 200); return /^[=+\-@]/.test(s) ? "'" + s : s; }
function limpio_(s) { return String(s == null ? '' : s); }
function filas_(nombre) {
  var sh = hoja_(nombre);
  var n = sh.getLastRow();
  if (n < 2) return [];
  return sh.getRange(2, 1, n - 1, CAB[nombre].length).getDisplayValues().map(function (r) { return r.map(limpio_); });
}
/* Reemplaza todas las filas de datos de una hoja (para borrados) */
function escribirFilas_(nombre, filas) {
  var sh = hoja_(nombre), cols = CAB[nombre].length, n = sh.getLastRow();
  if (n > 1) sh.getRange(2, 1, n - 1, cols).clearContent();
  if (filas.length) sh.getRange(2, 1, filas.length, cols).setNumberFormat('@').setValues(filas.map(function (r) { return r.map(celda_); }));
}
function agregarFilas_(nombre, filas) {
  if (!filas.length) return;
  var sh = hoja_(nombre), cols = CAB[nombre].length;
  sh.getRange(sh.getLastRow() + 1, 1, filas.length, cols).setNumberFormat('@').setValues(filas.map(function (r) { return r.map(celda_); }));
}
function iguales_(a, b) {
  a = String(a); b = String(b);
  if (a.length !== b.length) return false;
  var r = 0;
  for (var i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
function hex_(bytes) {
  var s = '';
  for (var i = 0; i < bytes.length; i++) s += ('0' + (bytes[i] & 255).toString(16)).slice(-2);
  return s;
}
function sal_() { return Utilities.getUuid().replace(/-/g, '').slice(0, 32); }
function hashClave_(clave, sal) {
  var h = sal + ':' + clave;
  for (var i = 0; i < ITERACIONES; i++) h = hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, h + sal, Utilities.Charset.UTF_8));
  return h;
}
function err_(msg, code) { var e = new Error(msg); e.code = code || 'ERROR'; return e; }
function conBloqueo_(fn) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(25000); } catch (e) { throw err_('El servidor está ocupado. Intenta de nuevo en unos segundos.'); }
  try { return fn(); } finally { lock.releaseLock(); }
}

/* ============================================================
   SESIONES Y USUARIOS
   ============================================================ */
function buscarUsuario_(nombre) {
  var n = String(nombre || '').trim().toLowerCase(), filas = filas_(H_USR);
  for (var i = 0; i < filas.length; i++) if (filas[i][U.usuario].toLowerCase() === n) return { fila: i, r: filas[i], todas: filas };
  return null;
}
function publico_(r) { return { username: r[U.usuario], role: r[U.rol] === 'admin' ? 'admin' : 'user', mustChange: r[U.cambiar] === 'SI', created: r[U.creado], createdBy: r[U.por] }; }

function login_(b) {
  esquema_();
  var cache = CacheService.getScriptCache();
  var claveFallo = 'fallos_' + String(b.username || '').toLowerCase().slice(0, 40);
  var fallos = +(cache.get(claveFallo) || 0);
  if (fallos >= MAX_FALLOS) throw err_('Demasiados intentos fallidos. Espera 5 minutos e intenta de nuevo.');
  var u = buscarUsuario_(b.username);
  if (!u || !iguales_(hashClave_(String(b.password || ''), u.r[U.sal]), u.r[U.hash])) {
    cache.put(claveFallo, String(fallos + 1), BLOQUEO_SEG);
    Utilities.sleep(600);
    throw err_('Usuario o contraseña incorrectos.');
  }
  cache.remove(claveFallo);
  return { ok: true, token: nuevaSesion_(u.r[U.usuario]), user: publico_(u.r), version: VERSION };
}

/* Valida la sesión en cada petición y relee el usuario (si lo borran o cambian su rol, aplica de inmediato) */
function sesion_(token) {
  if (!/^[0-9a-f]{64}$/.test(String(token || ''))) throw err_('Tu sesión no es válida. Ingresa de nuevo.', 'AUTH');
  var cache = CacheService.getScriptCache();
  var raw = cache.get('s_' + token);
  if (!raw) throw err_('Tu sesión expiró. Ingresa de nuevo.', 'AUTH');
  var s; try { s = JSON.parse(raw); } catch (e) { s = null; }
  if (!s || !s.u) { cache.remove('s_' + token); throw err_('Tu sesión no es válida. Ingresa de nuevo.', 'AUTH'); }
  var rev = Math.max(+(cache.get('rev_' + String(s.u).toLowerCase()) || 0), +(cache.get('rev_*') || 0));
  if (rev && s.t < rev) { cache.remove('s_' + token); throw err_('Tu sesión se cerró porque cambió tu contraseña o se restauró la información. Ingresa de nuevo.', 'AUTH'); }
  var u = buscarUsuario_(s.u);
  if (!u) { cache.remove('s_' + token); throw err_('Tu usuario ya no existe.', 'AUTH'); }
  cache.put('s_' + token, JSON.stringify({ u: u.r[U.usuario], t: s.t }), SESION_SEG); // renueva sin cambiar la fecha de emisión
  return publico_(u.r);
}
function soloAdmin_(yo) { if (yo.role !== 'admin') throw err_('Solo un administrador puede hacer esto.', 'FORBIDDEN'); }

function cambiarClave_(yo, b) {
  return conBloqueo_(function () {
    var u = buscarUsuario_(yo.username);
    if (!iguales_(hashClave_(String(b.oldPassword || ''), u.r[U.sal]), u.r[U.hash])) throw err_('La contraseña actual no es correcta.');
    var nueva = String(b.newPassword || '');
    claveSegura_(nueva);
    if (nueva === String(b.oldPassword)) throw err_('La nueva contraseña debe ser diferente a la actual.');
    var sal = sal_();
    hoja_(H_USR).getRange(u.fila + 2, U.sal + 1, 1, 3).setValues([[sal, hashClave_(nueva, sal), 'NO']]);
    revocar_(yo.username);                 // cierra las demás sesiones abiertas con la clave anterior
    Utilities.sleep(2);
    auditar_(yo.username, 'cambiar_clave', 'propia');
    return { ok: true, token: nuevaSesion_(yo.username), user: publico_(buscarUsuario_(yo.username).r) };
  });
}

function listarUsuarios_() { return { ok: true, users: filas_(H_USR).map(publico_) }; }

function crearUsuario_(yo, b) {
  return conBloqueo_(function () {
    var nombre = String(b.username || '').trim();
    if (!RE_USER.test(nombre)) throw err_('Usuario inválido: 3 a 30 caracteres (letras, números, punto, guion).');
    claveSegura_(b.password);
    if (buscarUsuario_(nombre)) throw err_('Ya existe un usuario con ese nombre.');
    var sal = sal_();
    agregarFilas_(H_USR, [[nombre, b.role === 'admin' ? 'admin' : 'user', sal, hashClave_(String(b.password), sal), 'SI', ahora_().full, yo.username]]);
    auditar_(yo.username, 'crear_usuario', nombre + ' (' + (b.role === 'admin' ? 'admin' : 'user') + ')');
    return listarUsuarios_();
  });
}
function asignarClave_(yo, b) {
  return conBloqueo_(function () {
    var u = buscarUsuario_(b.username);
    if (!u) throw err_('Usuario no encontrado.');
    claveSegura_(b.password);
    var sal = sal_();
    hoja_(H_USR).getRange(u.fila + 2, U.sal + 1, 1, 3).setValues([[sal, hashClave_(String(b.password), sal), 'SI']]);
    revocar_(u.r[U.usuario]);
    auditar_(yo.username, 'asignar_clave', u.r[U.usuario]);
    return listarUsuarios_();
  });
}
function cambiarRol_(yo, b) {
  return conBloqueo_(function () {
    var u = buscarUsuario_(b.username);
    if (!u) throw err_('Usuario no encontrado.');
    var rol = b.role === 'admin' ? 'admin' : 'user';
    if (rol !== 'admin') {
      if (u.r[U.usuario] === yo.username) throw err_('No puedes quitarte tu propio rol de administrador.');
      var admins = u.todas.filter(function (r) { return r[U.rol] === 'admin'; }).length;
      if (u.r[U.rol] === 'admin' && admins <= 1) throw err_('Debe quedar al menos un administrador.');
    }
    hoja_(H_USR).getRange(u.fila + 2, U.rol + 1).setValue(rol);
    auditar_(yo.username, 'cambiar_rol', u.r[U.usuario] + ' → ' + rol);
    return listarUsuarios_();
  });
}
function eliminarUsuario_(yo, b) {
  return conBloqueo_(function () {
    var u = buscarUsuario_(b.username);
    if (!u) throw err_('Usuario no encontrado.');
    if (u.r[U.usuario] === yo.username) throw err_('No puedes eliminar tu propio usuario.');
    if (u.r[U.rol] === 'admin' && u.todas.filter(function (r) { return r[U.rol] === 'admin'; }).length <= 1) throw err_('Debe quedar al menos un administrador.');
    hoja_(H_USR).deleteRow(u.fila + 2);
    revocar_(u.r[U.usuario]);
    auditar_(yo.username, 'eliminar_usuario', u.r[U.usuario]);
    return listarUsuarios_();
  });
}

/* ============================================================
   PROYECTOS
   ============================================================ */
function buscarProyecto_(id) {
  var filas = filas_(H_PRO);
  for (var i = 0; i < filas.length; i++) if (filas[i][P.id] === id) return { fila: i, r: filas[i], todas: filas };
  return null;
}
function metaProyecto_(r, conteos) {
  var c = (conteos && conteos[r[P.id]]) || {};
  return {
    id: r[P.id], name: r[P.nombre], createdBy: r[P.creadoPor], createdAt: r[P.creado],
    updatedBy: r[P.actPor], updatedAt: r[P.act], scanEnabled: r[P.escaneo] === 'SI',
    participants: c.p || 0, records: c.a || 0, days: c.d ? Object.keys(c.d).length : 0, hasDesign: !!r[P.archivo]
  };
}
function conteos_() {
  var c = {};
  filas_(H_PART).forEach(function (r) { (c[r[0]] = c[r[0]] || { p: 0, a: 0, d: {} }).p++; });
  filas_(H_ASIS).forEach(function (r) { var x = (c[r[3]] = c[r[3]] || { p: 0, a: 0, d: {} }); x.a++; x.d[r[1]] = true; });
  return c;
}
function listarProyectos_() {
  var c = conteos_();
  var lista = filas_(H_PRO).map(function (r) { return metaProyecto_(r, c); });
  lista.sort(function (a, b) { return a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0; });
  return { ok: true, projects: lista, serverTime: ahora_().full };
}

function leerArchivo_(fileId) {
  if (!fileId) return null;
  try { return JSON.parse(DriveApp.getFileById(fileId).getBlob().getDataAsString('UTF-8')); }
  catch (e) { throw err_('No se pudo leer el archivo del proyecto en Drive (¿se borró de la carpeta?).'); }
}
/* Se crea un archivo nuevo y se envía el anterior a la papelera: así no hay límite de 10 MB de setContent */
function escribirArchivo_(id, nombre, contenido, archivoAnterior) {
  var blob = Utilities.newBlob(contenido, 'application/json', 'proyecto_' + id + '.json');
  var f = carpeta_().createFile(blob);
  f.setDescription(String(nombre).slice(0, 200));
  if (archivoAnterior) { try { DriveApp.getFileById(archivoAnterior).setTrashed(true); } catch (e) { /* ya no existía */ } }
  return f.getId();
}

function obtenerProyecto_(b) {
  if (!RE_ID.test(String(b.id || ''))) throw err_('Proyecto inválido.');
  var p = buscarProyecto_(b.id);
  if (!p) throw err_('El proyecto ya no existe (pudo ser eliminado por un administrador).', 'NOTFOUND');
  var data = leerArchivo_(p.r[P.archivo]);
  if (!data) {
    // Proyecto migrado de v3: reconstruye la lista de participantes desde la hoja
    data = { design: null, people: filas_(H_PART).filter(function (r) { return r[0] === b.id; }).map(function (r) { return { id: r[2], token: r[3], name: r[4], role: r[5] }; }) };
  }
  return { ok: true, project: metaProyecto_(p.r, conteos_()), data: { design: data.design || null, people: Array.isArray(data.people) ? data.people : [] } };
}

/* Inserta/actualiza participantes. Nunca borra: un carnet impreso sigue siendo válido. */
function sincronizarParticipantes_(id, nombreEvento, personas) {
  var todas = filas_(H_PART), idx = {};
  todas.forEach(function (r, i) { if (r[0] === id) idx[r[2]] = i; });
  var t = ahora_().full, nuevos = [], cambio = false;
  (personas || []).slice(0, 2000).forEach(function (p) {
    if (!p || !RE_ID.test(String(p.id || '')) || !RE_TOKEN.test(String(p.token || ''))) return;
    var nombre = String(p.name || '').replace(/\s+/g, ' ').trim();
    if (!nombre) return;
    var fila = [id, String(nombreEvento || '').slice(0, 150), p.id, p.token, nombre.slice(0, 120), String(p.role || '').slice(0, 40), t];
    if (idx[p.id] != null) { todas[idx[p.id]] = fila; cambio = true; } else { idx[p.id] = -1; nuevos.push(fila); }
  });
  if (cambio) escribirFilas_(H_PART, todas);
  agregarFilas_(H_PART, nuevos);
}

/**
 * Guardar proyecto (cualquier usuario).
 * - Nuevo: exige nombre único.
 * - Existente: control de versión optimista (si otro usuario lo guardó después de que lo cargaste,
 *   avisa en lugar de sobrescribir su trabajo, salvo que se confirme).
 */
function guardarProyecto_(yo, b) {
  var pr = b.project || {};
  var id = String(pr.id || '');
  if (!RE_ID.test(id)) throw err_('Código de proyecto inválido.');
  var nombre = String(pr.name || '').replace(/\s+/g, ' ').trim();
  if (nombre.length < 3 || nombre.length > 80) throw err_('El nombre del proyecto debe tener entre 3 y 80 caracteres.');
  var contenido = JSON.stringify({ version: VERSION, id: id, name: nombre, design: limpiarDiseno_(pr.design), people: Array.isArray(pr.people) ? pr.people : [] });
  if (contenido.length > 30 * 1024 * 1024) throw err_('El proyecto es demasiado pesado (más de 30 MB). Usa imágenes más livianas.');
  return conBloqueo_(function () {
    var existente = buscarProyecto_(id);
    var repetido = filas_(H_PRO).some(function (r) { return r[P.id] !== id && r[P.nombre].toLowerCase() === nombre.toLowerCase(); });
    if (repetido) throw err_('Ya existe otro proyecto llamado “' + nombre + '”. Elige otro nombre.', 'DUPLICATE');
    var t = ahora_().full;
    if (existente) {
      if (b.isNew) throw err_('El código de proyecto ya existe. Intenta de nuevo.', 'DUPLICATE');
      if (b.baseUpdatedAt && existente.r[P.act] !== b.baseUpdatedAt && !b.force) {
        return { ok: false, conflict: true, error: 'El proyecto fue modificado por ' + existente.r[P.actPor] + ' el ' + existente.r[P.act] + ' después de que lo cargaste.', updatedBy: existente.r[P.actPor], updatedAt: existente.r[P.act] };
      }
      var archivo = escribirArchivo_(id, nombre, contenido, existente.r[P.archivo]);
      hoja_(H_PRO).getRange(existente.fila + 2, P.nombre + 1, 1, 6).setValues([[celda_(nombre), existente.r[P.creadoPor], existente.r[P.creado], yo.username, t, archivo]]);
    } else {
      if (!b.isNew) throw err_('Este proyecto fue eliminado por un administrador. Usa “Guardar como” para crearlo de nuevo.', 'NOTFOUND');
      var nuevo = escribirArchivo_(id, nombre, contenido, null);
      agregarFilas_(H_PRO, [[id, nombre, yo.username, t, yo.username, t, nuevo, 'NO']]);
    }
    sincronizarParticipantes_(id, nombre, pr.people);
    return { ok: true, project: metaProyecto_(buscarProyecto_(id).r, conteos_()) };
  });
}

function escaneo_(yo, b) {
  return conBloqueo_(function () {
    var p = buscarProyecto_(String(b.id || ''));
    if (!p) throw err_('El proyecto ya no existe.', 'NOTFOUND');
    hoja_(H_PRO).getRange(p.fila + 2, P.escaneo + 1).setValue(b.enabled ? 'SI' : 'NO');
    return { ok: true, scanEnabled: !!b.enabled };
  });
}

function asistencia_(b) {
  var id = String(b.id || '');
  var p = buscarProyecto_(id);
  if (!p) throw err_('El proyecto ya no existe.', 'NOTFOUND');
  var participants = [], records = [];
  filas_(H_PART).forEach(function (r) { if (r[0] === id) participants.push({ id: r[2], name: r[4], role: r[5] }); });
  filas_(H_ASIS).forEach(function (r) { if (r[3] === id) records.push({ ts: r[0], date: r[1], time: r[2], id: r[5], name: r[6], role: r[7], source: r[8] }); });
  return { ok: true, project: metaProyecto_(p.r, conteos_()), scanEnabled: p.r[P.escaneo] === 'SI', participants: participants, records: records, serverTime: ahora_().full };
}

/* Eliminar un proyecto (solo administradores): diseño, participantes y asistencia */
function eliminarProyecto_(yo, b) {
  return conBloqueo_(function () {
    var id = String(b.id || '');
    var p = buscarProyecto_(id);
    if (!p) throw err_('El proyecto ya no existe.', 'NOTFOUND');
    if (p.r[P.archivo]) { try { DriveApp.getFileById(p.r[P.archivo]).setTrashed(true); } catch (e) { /* ya no estaba */ } }
    var asis = filas_(H_ASIS), part = filas_(H_PART);
    var nA = asis.filter(function (r) { return r[3] === id; }).length, nP = part.filter(function (r) { return r[0] === id; }).length;
    if (nA) escribirFilas_(H_ASIS, asis.filter(function (r) { return r[3] !== id; }));
    if (nP) escribirFilas_(H_PART, part.filter(function (r) { return r[0] !== id; }));
    hoja_(H_PRO).deleteRow(p.fila + 2);
    auditar_(yo.username, 'eliminar_proyecto', p.r[P.nombre] + ' [' + id + '] · ' + nP + ' participantes · ' + nA + ' asistencias');
    return { ok: true, deleted: { project: p.r[P.nombre], participants: nP, records: nA } };
  });
}

/* Vacía proyectos, archivos, participantes y asistencia (los usuarios y ajustes se conservan) */
function vaciarDatos_() {
  var it = carpeta_().getFiles();
  while (it.hasNext()) { var f = it.next(); if (f.getName() !== 'ajustes_app.json') f.setTrashed(true); }
  escribirFilas_(H_PRO, []);
  escribirFilas_(H_PART, []);
  escribirFilas_(H_ASIS, []);
}
function borrarTodo_(yo, b) {
  if (b.confirm !== 'BORRAR TODO') throw err_('Confirmación incorrecta.');
  return conBloqueo_(function () {
    var n = filas_(H_PRO).length, a = filas_(H_ASIS).length;
    vaciarDatos_();
    auditar_(yo.username, 'borrar_todo', n + ' proyectos · ' + a + ' asistencias');
    return { ok: true, deletedProjects: n, deletedRecords: a };
  });
}

/* ============================================================
   AJUSTES (fondo del panel) — archivo en Drive
   ============================================================ */
function archivoAjustes_() {
  var it = carpeta_().getFilesByName('ajustes_app.json');
  while (it.hasNext()) { var f = it.next(); if (!f.isTrashed()) return f; }
  return null;
}
function ajustesVacios_() { return { appBg: { imgs: [null, null], dim: 30 } }; }
function leerAjustes_() {
  var f = archivoAjustes_();
  if (!f) return ajustesVacios_();
  try { return JSON.parse(f.getBlob().getDataAsString('UTF-8')); } catch (e) { return ajustesVacios_(); }
}
function guardarAjustes_(ajustes) {
  var bg = (ajustes && ajustes.appBg) || {};
  var limpio = { appBg: {
    imgs: [0, 1].map(function (i) { var v = (bg.imgs || [])[i]; return imagenValida_(v) ? v : null; }),
    dim: Math.max(0, Math.min(80, isNaN(+bg.dim) ? 30 : +bg.dim))
  } };
  var txt = JSON.stringify(limpio);
  if (txt.length > 8 * 1024 * 1024) throw err_('Las imágenes del fondo son demasiado pesadas.');
  var f = archivoAjustes_();
  if (f) f.setTrashed(true);
  carpeta_().createFile(Utilities.newBlob(txt, 'application/json', 'ajustes_app.json'));
  return { ok: true, settings: limpio };
}

/* ============================================================
   BACKUP Y RESTAURACIÓN (por partes, para no superar los límites de Google)
   ============================================================ */
function backupMeta_(yo) {
  auditar_(yo.username, 'backup', 'descarga de backup completo');
  var usuarios = filas_(H_USR), proyectos = filas_(H_PRO), part = filas_(H_PART), asis = filas_(H_ASIS);
  return {
    ok: true, version: VERSION, createdAt: ahora_().full, createdBy: yo.username,
    users: usuarios, projectRows: proyectos, participants: part, attendance: asis, settings: leerAjustes_(),
    counts: { users: usuarios.length, projects: proyectos.length, participants: part.length, attendance: asis.length }
  };
}
function backupProyecto_(b) {
  var p = buscarProyecto_(String(b.id || ''));
  if (!p) throw err_('Proyecto no encontrado durante el backup.', 'NOTFOUND');
  return { ok: true, row: p.r, data: leerArchivo_(p.r[P.archivo]) };
}

function restaurarInicio_(yo, b) {
  if (b.confirm !== 'RESTAURAR') throw err_('Confirmación incorrecta.');
  return conBloqueo_(function () {
    vaciarDatos_();
    auditar_(yo.username, 'restaurar_inicio', 'se vació la información para restaurar un backup');
    PropertiesService.getScriptProperties().setProperty('RESTAURANDO', ahora_().full + ' por ' + yo.username);
    return { ok: true };
  });
}
function restaurarProyecto_(b) {
  var r = b.row;
  if (!Array.isArray(r) || !RE_ID.test(String(r[P.id] || ''))) throw err_('Proyecto del backup inválido.');
  return conBloqueo_(function () {
    if (buscarProyecto_(String(r[P.id]))) throw err_('Proyecto repetido en el backup: ' + r[P.id]);
    var fila = CAB.Proyectos.map(function (_, i) { return String(r[i] == null ? '' : r[i]); });
    if (b.data && typeof b.data === 'object') b.data.design = limpiarDiseno_(b.data.design);
    fila[P.archivo] = b.data ? escribirArchivo_(fila[P.id], fila[P.nombre], JSON.stringify(b.data), null) : '';
    fila[P.escaneo] = fila[P.escaneo] === 'SI' ? 'SI' : 'NO';
    agregarFilas_(H_PRO, [fila]);
    return { ok: true };
  });
}
function restaurarFilas_(b) {
  var hoja = b.sheet === 'participants' ? H_PART : b.sheet === 'attendance' ? H_ASIS : null;
  if (!hoja || !Array.isArray(b.rows)) throw err_('Datos del backup inválidos.');
  var filas = b.rows.map(function (r) {
    if (!Array.isArray(r)) throw err_('Fila inválida en el backup.');
    return CAB[hoja].map(function (_, i) { return String(r[i] == null ? '' : r[i]); });
  });
  return conBloqueo_(function () { agregarFilas_(hoja, filas); return { ok: true, added: filas.length }; });
}
function restaurarFin_(yo, b) {
  var usuarios = b.users;
  if (!Array.isArray(usuarios) || !usuarios.length) throw err_('El backup no trae usuarios.');
  var vistos = {};
  usuarios.forEach(function (r) {
    if (!Array.isArray(r) || !RE_USER.test(String(r[U.usuario])) || !RE_HEX64.test(String(r[U.hash])) || !RE_HEX32.test(String(r[U.sal]))) throw err_('Usuario inválido en el backup.');
    var k = String(r[U.usuario]).toLowerCase();
    if (vistos[k]) throw err_('Usuario repetido en el backup: ' + r[U.usuario]);
    vistos[k] = true;
  });
  if (!usuarios.some(function (r) { return r[U.rol] === 'admin'; })) throw err_('El backup no tiene ningún administrador.');
  return conBloqueo_(function () {
    escribirFilas_(H_USR, usuarios.map(function (r) { return CAB.Usuarios.map(function (_, i) { return String(r[i] == null ? '' : r[i]); }); }));
    guardarAjustes_(b.settings || ajustesVacios_());
    PropertiesService.getScriptProperties().deleteProperty('RESTAURANDO');
    revocarTodas_(); // tras restaurar, todos deben ingresar de nuevo con las credenciales del backup
    var pro = filas_(H_PRO);
    var real = { users: filas_(H_USR).length, projects: pro.length, participants: filas_(H_PART).length, attendance: filas_(H_ASIS).length };
    var esp = b.expected || {};
    var coincide = ['users', 'projects', 'participants', 'attendance'].every(function (k) { return +esp[k] === real[k]; });
    auditar_(yo.username, 'restaurar_fin', JSON.stringify(real) + (coincide ? ' · verificado' : ' · NO coincide'));
    return { ok: true, counts: real, expected: esp, match: coincide, projectsWithDesign: pro.filter(function (r) { return r[P.archivo]; }).length };
  });
}

/* ============================================================
   GET: registro de asistencia desde el QR y datos públicos
   ============================================================ */
function doGet(e) {
  var p = (e && e.parameter) || {};
  try {
    if (p.a === 'ping') return json_({ ok: true, servicio: 'escarapelas-sena', version: VERSION });
    if (p.a === 'settings') return json_({ ok: true, settings: leerAjustes_() });
    if (p.a === 'checkin') return registrar_(p);
  } catch (err) {
    if (p.a === 'checkin') return pagina_('error', 'Error del servidor', esc_(err.message), '');
    return json_({ ok: false, error: err.message });
  }
  return pagina_('info', 'Servicio de asistencia activo', 'Escanea el código QR de tu carnet para registrar la asistencia.', '');
}

function registrar_(p) {
  var NO_VALIDO = ['error', 'Código no válido', 'Este carnet no está registrado o el evento ya no existe. Si el carnet es nuevo, pide al instructor que guarde el proyecto.'];
  if (!RE_ID.test(String(p.e || '')) || !RE_ID.test(String(p.i || '')) || !RE_TOKEN.test(String(p.t || ''))) return pagina_(NO_VALIDO[0], NO_VALIDO[1], NO_VALIDO[2], '');
  // Primero se valida el carnet (id + token secreto). Solo con un carnet válido se informa el
  // nombre del evento o si el registro está cerrado: así nadie puede sondear qué eventos existen.
  var pro = buscarProyecto_(p.e);
  var part = null;
  if (pro) filas_(H_PART).some(function (r) { if (r[0] === p.e && r[2] === p.i) { part = r; return true; } return false; });
  if (!pro || !part || !iguales_(part[3], p.t)) return pagina_(NO_VALIDO[0], NO_VALIDO[1], NO_VALIDO[2], '');
  if (pro.r[P.escaneo] !== 'SI') {
    return pagina_('cerrado', 'Registro cerrado', 'El registro de asistencia no está habilitado en este momento. Consulta con el instructor.', pro.r[P.nombre]);
  }
  var lock = LockService.getScriptLock();
  try { lock.waitLock(15000); } catch (err) {
    return pagina_('error', 'Servicio ocupado', 'Hay muchos registros al mismo tiempo. Intenta de nuevo en unos segundos.', '');
  }
  try {
    var nombre = part[4], rol = part[5], evento = pro.r[P.nombre];
    var t = ahora_(), dias = {}, yaHoy = null;
    filas_(H_ASIS).forEach(function (r) {
      if (r[3] === p.e && r[5] === p.i) { dias[r[1]] = true; if (r[1] === t.fecha && !yaHoy) yaHoy = r[2]; }
    });
    if (yaHoy) {
      return pagina_('repetido', 'Ya estabas registrado hoy', esc_(nombre) + ', tu asistencia de hoy se registró a las <b>' + esc_(yaHoy) + '</b>.', evento, Object.keys(dias).length);
    }
    agregarFilas_(H_ASIS, [[t.full, t.fecha, t.hora, p.e, evento, p.i, nombre, rol, 'QR']]);
    dias[t.fecha] = true;
    return pagina_('ok', '¡Asistencia registrada!', '<b>' + esc_(nombre) + '</b><br>' + esc_(rol) + '<br><span class="when">' + t.fecha.split('-').reverse().join('/') + ' · ' + t.hora + '</span>', evento, Object.keys(dias).length);
  } finally {
    lock.releaseLock();
  }
}

/* Página móvil de resultado del escaneo */
function pagina_(tipo, titulo, mensaje, evento, totalDias) {
  var cfg = { ok: ['#16a34a', '✓'], repetido: ['#2563eb', 'ℹ'], cerrado: ['#d97706', '⏸'], error: ['#dc2626', '✕'], info: ['#39a900', '◎'] }[tipo];
  var html = '<!doctype html><html lang="es"><head><meta charset="utf-8"><title>' + esc_(titulo) + '</title>' +
    '<style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;' +
    'background:linear-gradient(160deg,#0f172a,#1e293b);color:#0f172a;padding:18px}' +
    '.card{background:#fff;border-radius:22px;max-width:420px;width:100%;padding:30px 24px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.4)}' +
    '.ic{width:92px;height:92px;border-radius:50%;margin:0 auto 16px;display:grid;place-items:center;font-size:48px;color:#fff;background:' + cfg[0] + '}' +
    'h1{font-size:22px;margin:0 0 10px}p{font-size:17px;line-height:1.5;margin:0;color:#334155}.when{display:inline-block;margin-top:10px;font-size:15px;color:#64748b}' +
    '.ev{margin-top:18px;padding-top:14px;border-top:1px solid #e2e8f0;font-size:13px;color:#64748b}.days{font-weight:700;color:' + cfg[0] + '}' +
    '.foot{margin-top:14px;font-size:11px;color:#94a3b8}</style></head><body><div class="card">' +
    '<div class="ic">' + cfg[1] + '</div><h1>' + esc_(titulo) + '</h1><p>' + mensaje + '</p>' +
    (evento ? '<div class="ev">' + esc_(evento) + (totalDias ? '<br><span class="days">Días asistidos: ' + totalDias + '</span>' : '') + '</div>' : '') +
    '<div class="foot">SENA · Centro de Automatización Industrial · Regional Caldas</div></div></body></html>';
  return HtmlService.createHtmlOutput(html).setTitle(titulo).addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/* ============================================================
   POST: API del panel
   ============================================================ */
var SOLO_ADMIN = {
  listUsers: 1, createUser: 1, setUserPassword: 1, setUserRole: 1, deleteUser: 1,
  deleteProject: 1, deleteAll: 1, saveSettings: 1,
  backupMeta: 1, backupProject: 1, restoreBegin: 1, restoreProject: 1, restoreRows: 1, restoreFinish: 1
};
var PERMITIDAS_CLAVE_TEMPORAL = { me: 1, logout: 1, changePassword: 1 };

function doPost(e) {
  var b;
  try { b = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) { return json_({ ok: false, error: 'Solicitud inválida.' }); }
  try {
    var accion = String(b.action || '');
    if (accion === 'login') return json_(login_(b));
    var yo = sesion_(b.token);
    if (yo.mustChange && !PERMITIDAS_CLAVE_TEMPORAL[accion]) throw err_('Debes cambiar tu contraseña temporal antes de continuar.', 'MUSTCHANGE');
    if (SOLO_ADMIN[accion]) soloAdmin_(yo);
    switch (accion) {
      case 'me': return json_({ ok: true, user: yo, version: VERSION });
      case 'logout': CacheService.getScriptCache().remove('s_' + b.token); return json_({ ok: true });
      case 'audit': soloAdmin_(yo); return json_({ ok: true, rows: filas_(H_AUD).slice(-500).reverse() });
      case 'changePassword': return json_(cambiarClave_(yo, b));
      case 'listProjects': return json_(listarProyectos_());
      case 'getProject': return json_(obtenerProyecto_(b));
      case 'saveProject': return json_(guardarProyecto_(yo, b));
      case 'setScan': return json_(escaneo_(yo, b));
      case 'attendance': return json_(asistencia_(b));
      case 'listUsers': return json_(listarUsuarios_());
      case 'createUser': return json_(crearUsuario_(yo, b));
      case 'setUserPassword': return json_(asignarClave_(yo, b));
      case 'setUserRole': return json_(cambiarRol_(yo, b));
      case 'deleteUser': return json_(eliminarUsuario_(yo, b));
      case 'deleteProject': return json_(eliminarProyecto_(yo, b));
      case 'deleteAll': return json_(borrarTodo_(yo, b));
      case 'saveSettings': auditar_(yo.username, 'fondo_panel', ''); return json_(guardarAjustes_(b.settings));
      case 'backupMeta': return json_(backupMeta_(yo));
      case 'backupProject': return json_(backupProyecto_(b));
      case 'restoreBegin': return json_(restaurarInicio_(yo, b));
      case 'restoreProject': return json_(restaurarProyecto_(b));
      case 'restoreRows': return json_(restaurarFilas_(b));
      case 'restoreFinish': return json_(restaurarFin_(yo, b));
      default: return json_({ ok: false, error: 'Acción desconocida.' });
    }
  } catch (err) {
    return json_({ ok: false, error: err.message, code: err.code || 'ERROR' });
  }
}
