/**
 * ============================================================
 *  SERVICIO DE ASISTENCIA — Escarapelas SENA
 *  Centro de Automatización Industrial · Regional Caldas
 *  Instructor: Jorge Walter Salazar A.
 * ============================================================
 *  Backend gratuito con Google Apps Script + Google Sheets.
 *  - El celular escanea el QR del carnet → abre esta URL → se registra la asistencia.
 *  - El panel (GitHub Pages) consulta, filtra, sincroniza y abre/cierra el escaneo.
 *
 *  INSTALACIÓN (resumen; detalle en README.md):
 *   1. Crea una Hoja de cálculo de Google → Extensiones → Apps Script.
 *   2. Pega este código, CAMBIA la CLAVE_ADMIN de abajo y guarda.
 *   3. Ejecuta la función `instalar` una vez (autoriza los permisos).
 *   4. Implementar → Nueva implementación → Aplicación web
 *        Ejecutar como: Yo   ·   Quién tiene acceso: Cualquier usuario
 *   5. Copia la URL que termina en /exec y pégala en el panel (Asistencia → Configuración).
 * ============================================================
 */

// ⚠️ Cambia esta clave por una larga y secreta (mín. 12 caracteres). Debe ser la misma del panel.
var CLAVE_ADMIN = 'CAMBIA-ESTA-CLAVE';

var TZ = 'America/Bogota';
var VERSION = '1.0';
var HOJA_PART = 'Participantes';
var HOJA_ASIS = 'Asistencia';
var CAB_PART = ['evento_id', 'evento', 'id', 'token', 'nombre', 'rol', 'actualizado'];
var CAB_ASIS = ['fecha_hora', 'fecha', 'hora', 'evento_id', 'evento', 'id', 'nombre', 'rol', 'origen'];

/* ---------- Instalación ---------- */
function instalar() {
  hoja_(HOJA_PART, CAB_PART);
  hoja_(HOJA_ASIS, CAB_ASIS);
  var ok = claveValida_();
  Logger.log(ok ? 'Instalación correcta. Ahora implementa como Aplicación web.'
                : '⚠️ Instalado, pero DEBES cambiar CLAVE_ADMIN (mínimo 12 caracteres) antes de usarlo.');
}

function hoja_(nombre, cabecera) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Este script debe crearse desde una Hoja de cálculo (Extensiones → Apps Script).');
  var sh = ss.getSheetByName(nombre);
  if (!sh) {
    sh = ss.insertSheet(nombre);
    sh.getRange(1, 1, 1, cabecera.length).setValues([cabecera]).setFontWeight('bold').setBackground('#0f172a').setFontColor('#ffffff');
    sh.setFrozenRows(1);
    // Todo como texto: evita que Sheets convierta fechas, códigos o nombres
    sh.getRange(1, 1, sh.getMaxRows(), cabecera.length).setNumberFormat('@');
  }
  return sh;
}

function claveValida_() { return CLAVE_ADMIN && CLAVE_ADMIN !== 'CAMBIA-ESTA-CLAVE' && String(CLAVE_ADMIN).length >= 12; }

/* ---------- Utilidades ---------- */
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
function celda_(s) { s = String(s == null ? '' : s).slice(0, 150); return /^[=+\-@]/.test(s) ? "'" + s : s; }
function ok_(re, s) { return typeof s === 'string' && re.test(s); }
var RE_ID = /^[A-Za-z0-9]{6,24}$/;
var RE_TOKEN = /^[A-Za-z0-9]{8,40}$/;

function iguales_(a, b) {
  a = String(a); b = String(b);
  if (a.length !== b.length) return false;
  var r = 0;
  for (var i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

function escaneoAbierto_(eventId) { return PropertiesService.getScriptProperties().getProperty('scan_' + eventId) === '1'; }

/* ============================================================
   GET: registro desde el QR (celular) y prueba de conexión
   ============================================================ */
function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.a === 'ping') return json_({ ok: true, servicio: 'asistencia-escarapelas', version: VERSION, configurado: claveValida_() });
  if (p.a === 'checkin') return registrar_(p);
  return pagina_('info', 'Servicio de asistencia activo', 'Escanea el código QR de tu carnet para registrar la asistencia.', '');
}

function registrar_(p) {
  if (!ok_(RE_ID, p.e) || !ok_(RE_ID, p.i) || !ok_(RE_TOKEN, p.t)) {
    return pagina_('error', 'Código no válido', 'Este código QR no corresponde a un carnet del evento.', '');
  }
  if (!escaneoAbierto_(p.e)) {
    return pagina_('cerrado', 'Registro cerrado', 'El registro de asistencia no está habilitado en este momento. Consulta con el instructor.', '');
  }
  var lock = LockService.getScriptLock();
  try { lock.waitLock(15000); } catch (err) {
    return pagina_('error', 'Servicio ocupado', 'Hay muchos registros al mismo tiempo. Intenta de nuevo en unos segundos.', '');
  }
  try {
    var shP = hoja_(HOJA_PART, CAB_PART);
    var datos = shP.getDataRange().getDisplayValues();
    var part = null;
    for (var r = 1; r < datos.length; r++) {
      if (datos[r][0] === p.e && datos[r][2] === p.i) { part = datos[r]; break; }
    }
    if (!part || !iguales_(part[3], p.t)) {
      return pagina_('error', 'Carnet no registrado', 'Este carnet no está en la lista del evento. Pide al instructor que sincronice la lista de participantes.', '');
    }
    var nombre = part[4], rol = part[5], evento = part[1];
    var t = ahora_();
    var shA = hoja_(HOJA_ASIS, CAB_ASIS);
    var asis = shA.getDataRange().getDisplayValues();
    var dias = {}, yaHoy = null;
    for (var k = 1; k < asis.length; k++) {
      if (asis[k][3] === p.e && asis[k][5] === p.i) {
        dias[asis[k][1]] = true;
        if (asis[k][1] === t.fecha && !yaHoy) yaHoy = asis[k][2];
      }
    }
    if (yaHoy) {
      return pagina_('repetido', 'Ya estabas registrado hoy', esc_(nombre) + ', tu asistencia de hoy se registró a las <b>' + esc_(yaHoy) + '</b>.',
        evento, Object.keys(dias).length);
    }
    shA.appendRow([t.full, t.fecha, t.hora, p.e, celda_(evento), p.i, celda_(nombre), celda_(rol), 'QR']);
    dias[t.fecha] = true;
    return pagina_('ok', '¡Asistencia registrada!', '<b>' + esc_(nombre) + '</b><br>' + esc_(rol) + '<br><span class="when">' + t.fecha.split('-').reverse().join('/') + ' · ' + t.hora + '</span>',
      evento, Object.keys(dias).length);
  } finally {
    lock.releaseLock();
  }
}

/* Página móvil de resultado del escaneo */
function pagina_(tipo, titulo, mensaje, evento, totalDias) {
  var cfg = {
    ok: ['#16a34a', '✓'], repetido: ['#2563eb', 'ℹ'], cerrado: ['#d97706', '⏸'], error: ['#dc2626', '✕'], info: ['#39a900', '◎']
  }[tipo];
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
   POST: API del panel (requiere CLAVE_ADMIN)
   ============================================================ */
function doPost(e) {
  var body;
  try { body = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) { return json_({ ok: false, error: 'Solicitud inválida.' }); }
  if (!claveValida_()) return json_({ ok: false, error: 'El servicio no está configurado: cambia CLAVE_ADMIN en Apps Script y vuelve a implementar.' });
  if (!iguales_(body.key || '', CLAVE_ADMIN)) { Utilities.sleep(800); return json_({ ok: false, error: 'Clave de administrador incorrecta.' }); }
  if (!ok_(RE_ID, body.eventId)) return json_({ ok: false, error: 'Código de evento inválido.' });
  try {
    switch (body.action) {
      case 'status': return json_(estado_(body.eventId));
      case 'setScan':
        PropertiesService.getScriptProperties().setProperty('scan_' + body.eventId, body.enabled ? '1' : '0');
        return json_(estado_(body.eventId));
      case 'sync': return json_(sincronizar_(body));
      case 'attendance': return json_(consultar_(body.eventId));
      default: return json_({ ok: false, error: 'Acción desconocida.' });
    }
  } catch (err) {
    return json_({ ok: false, error: 'Error del servidor: ' + err.message });
  }
}

function estado_(eventId) {
  var nP = 0, nA = 0;
  hoja_(HOJA_PART, CAB_PART).getDataRange().getDisplayValues().forEach(function (r, i) { if (i && r[0] === eventId) nP++; });
  hoja_(HOJA_ASIS, CAB_ASIS).getDataRange().getDisplayValues().forEach(function (r, i) { if (i && r[3] === eventId) nA++; });
  return { ok: true, scanEnabled: escaneoAbierto_(eventId), participants: nP, records: nA, serverTime: ahora_().full };
}

/* Inserta o actualiza participantes. Nunca borra: los carnets ya impresos siguen siendo válidos. */
function sincronizar_(body) {
  var lista = Array.isArray(body.participants) ? body.participants.slice(0, 2000) : [];
  var evento = String(body.eventName || '').slice(0, 150);
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = hoja_(HOJA_PART, CAB_PART);
    var datos = sh.getDataRange().getDisplayValues();
    var idx = {};
    for (var r = 1; r < datos.length; r++) if (datos[r][0] === body.eventId) idx[datos[r][2]] = r;
    var t = ahora_().full, nuevos = [], act = 0, add = 0;
    lista.forEach(function (p) {
      if (!p || !ok_(RE_ID, p.id) || !ok_(RE_TOKEN, p.token)) return;
      var fila = [body.eventId, celda_(evento), p.id, p.token, celda_(p.name), celda_(p.role), t];
      if (idx[p.id] != null) { datos[idx[p.id]] = fila; act++; }
      else { nuevos.push(fila); add++; }
    });
    if (datos.length > 1 && act) sh.getRange(2, 1, datos.length - 1, CAB_PART.length).setValues(datos.slice(1));
    if (nuevos.length) sh.getRange(sh.getLastRow() + 1, 1, nuevos.length, CAB_PART.length).setNumberFormat('@').setValues(nuevos);
    var res = estado_(body.eventId);
    res.added = add; res.updated = act;
    return res;
  } finally {
    lock.releaseLock();
  }
}

function consultar_(eventId) {
  var participants = [], records = [];
  hoja_(HOJA_PART, CAB_PART).getDataRange().getDisplayValues().forEach(function (r, i) {
    if (i && r[0] === eventId) participants.push({ id: r[2], name: r[4], role: r[5] });
  });
  hoja_(HOJA_ASIS, CAB_ASIS).getDataRange().getDisplayValues().forEach(function (r, i) {
    if (i && r[3] === eventId) records.push({ ts: r[0], date: r[1], time: r[2], id: r[5], name: r[6], role: r[7], source: r[8] });
  });
  var st = estado_(eventId);
  return { ok: true, scanEnabled: st.scanEnabled, participants: participants, records: records, serverTime: st.serverTime };
}
