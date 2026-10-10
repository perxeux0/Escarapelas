/* Módulo de proyectos — versión 4.
 * Un proyecto = diseño completo (escarapela + carnet) + participantes, guardado con nombre en el servidor.
 * Cualquier usuario puede listar, cargar y guardar. Solo administradores: eliminar, borrar todo,
 * backup y restauración (el servidor lo vuelve a verificar en cada petición).
 */
(function (global) {
  'use strict';

  var API = global.API;
  var ctx = null, list = [], busy = false;
  var $ = function (s) { return document.querySelector(s); };
  var BACKUP_TYPE = 'escSena.backup';
  var ROW_CHUNK = 2000;

  function fmtDate(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})/.exec(String(s || ''));
    return m ? m[3] + '/' + m[2] + '/' + m[1] + ' ' + m[4] + ':' + m[5] : ctx.esc(s || '—');
  }
  function setStatus(msg, kind) {
    var el = $('#projStatus');
    el.textContent = msg || '';
    el.className = 'att-status' + (kind === 'err' ? ' err' : kind === 'ok' ? ' ok' : '');
  }
  function progress(pct, label) {
    var bar = $('#projProgress');
    if (pct == null) { bar.hidden = true; return; }
    bar.hidden = false;
    $('#projProgressFill').style.width = Math.max(0, Math.min(100, pct)) + '%';
    $('#projProgressLabel').textContent = label || '';
  }
  function lock(on) {
    busy = on;
    var m = $('#projModal');
    if (on) m.dataset.forced = '1'; else delete m.dataset.forced;
    Array.prototype.forEach.call(document.querySelectorAll('#projModal button, #projModal input, #projModal label.btn'), function (b) {
      if (b.dataset.close === undefined) b.classList.toggle('is-busy', on);
      if (b.tagName === 'BUTTON' || b.tagName === 'INPUT') b.disabled = on && b.dataset.close === undefined;
    });
  }

  /* ---------- Lista ---------- */
  function refresh() {
    setStatus('Cargando proyectos…');
    return API.call('listProjects').then(function (r) {
      list = r.projects || [];
      render();
      setStatus(list.length + ' proyecto(s) · actualizado ' + new Date().toLocaleTimeString('es-CO'));
      return list;
    }).catch(function (e) { setStatus(e.message, 'err'); throw e; });
  }
  function norm(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }

  function render() {
    var q = norm($('#projSearch').value.trim()), admin = ctx.isAdmin(), cur = ctx.getMeta();
    var rows = list.filter(function (p) { return !q || norm(p.name).indexOf(q) >= 0 || norm(p.createdBy).indexOf(q) >= 0 || norm(p.id).indexOf(q) >= 0; });
    $('#projAdmin').hidden = !admin;
    if (!rows.length) {
      $('#projList').innerHTML = '<p class="att-empty">' + (list.length ? 'Ningún proyecto coincide con la búsqueda.' : 'Aún no hay proyectos guardados. Diseña tus escarapelas y pulsa 💾 Guardar.') + '</p>';
      return;
    }
    $('#projList').innerHTML = '<table class="att-table proj-table"><thead><tr><th>Proyecto</th><th>Creado</th><th>Última modificación</th><th class="c">Participantes</th><th class="c">Asistencia</th><th class="c">Escaneo</th><th></th></tr></thead><tbody>' +
      rows.map(function (p) {
        var isCur = cur && cur.id === p.id;
        return '<tr data-id="' + ctx.esc(p.id) + '"' + (isCur ? ' class="is-current"' : '') + '>' +
          '<td><strong>' + ctx.esc(p.name) + '</strong>' + (isCur ? ' <span class="tag ok">abierto</span>' : '') + (p.hasDesign ? '' : ' <span class="tag">sin diseño (v3)</span>') +
          '<br><small>Código ' + ctx.esc(p.id) + '</small></td>' +
          '<td>' + ctx.esc(p.createdBy) + '<br><small>' + fmtDate(p.createdAt) + '</small></td>' +
          '<td>' + ctx.esc(p.updatedBy) + '<br><small>' + fmtDate(p.updatedAt) + '</small></td>' +
          '<td class="c">' + p.participants + '</td>' +
          '<td class="c">' + p.records + ' reg.<br><small>' + p.days + ' día(s)</small></td>' +
          '<td class="c"><span class="scan-dot ' + (p.scanEnabled ? 'on' : 'off') + '">' + (p.scanEnabled ? 'Habilitado' : 'Cerrado') + '</span></td>' +
          '<td class="actions"><button class="btn btn-sm btn-primary" data-act="load">Cargar</button>' +
          '<button class="btn btn-sm" data-act="att">📋 Asistencia</button>' +
          (admin ? '<button class="btn btn-sm btn-ghost danger" data-act="del" title="Eliminar proyecto, carnets y asistencia">🗑</button>' : '') + '</td></tr>';
      }).join('') + '</tbody></table>';
  }

  /* ---------- Cargar / nuevo ---------- */
  function confirmDiscard() {
    if (!ctx.isDirty()) return Promise.resolve(true);
    return ctx.ask({ title: 'Cambios sin guardar', message: 'El proyecto actual tiene cambios sin guardar. Si continúas, se perderán.', confirmText: 'Descartar cambios', danger: true });
  }
  function load(id) {
    return confirmDiscard().then(function (ok) {
      if (!ok) return null;
      setStatus('Cargando proyecto…');
      return API.call('getProject', { id: id }, 90000).then(function (r) {
        ctx.apply(r.data, r.project);
        ctx.toast('Proyecto “' + r.project.name + '” cargado.', 'ok');
        setStatus('');
        close();
        return r.project;
      });
    }).catch(function (e) { setStatus(e.message, 'err'); ctx.toast(e.message, 'err', 5000); if (e.code === 'NOTFOUND') refresh(); });
  }
  function newProject() {
    return confirmDiscard().then(function (ok) {
      if (!ok) return;
      ctx.newProject();
      close();
      ctx.toast('Nuevo proyecto en blanco. Al terminar, pulsa 💾 Guardar y ponle un nombre.', 'ok', 4500);
    });
  }

  /* ---------- Guardar ---------- */
  function suggestName() {
    var t = ctx.getDraft().design.texts || {};
    var base = String(((t.t1 || '') + ' ' + (t.t2 || '')).replace(/\s+/g, ' ')).trim();
    var d = new Date();
    return (base ? base + ' ' : 'Evento ') + d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  function askName(title, value, message) {
    return ctx.ask({ title: title, message: message || 'Escribe un nombre que identifique el proyecto (ej. “Bootcamp Ciberseguridad – Octubre 2026”). Todos los usuarios lo verán en la lista.', input: true, value: value, placeholder: 'Nombre del proyecto', confirmText: 'Guardar', minLength: 3, maxLength: 80 });
  }
  function send(payload) {
    ctx.setSaving(true);
    return API.call('saveProject', payload, 120000).then(function (r) {
      ctx.setMeta({ id: r.project.id, name: r.project.name, updatedAt: r.project.updatedAt });
      ctx.setDirty(false);
      ctx.toast('Proyecto “' + r.project.name + '” guardado (' + r.project.participants + ' participante(s)). Los QR de sus carnets ya registran asistencia.', 'ok', 4500);
      return r.project;
    }).then(function (p) { ctx.setSaving(false); return p; }, function (e) { ctx.setSaving(false); throw e; });
  }
  function payloadFor(name, extra) {
    var d = ctx.getDraft();
    var p = { project: { id: d.design.eventId, name: name, design: d.design, people: d.people } };
    Object.keys(extra || {}).forEach(function (k) { p[k] = extra[k]; });
    return p;
  }
  function saveNew(name, keepIds) {
    if (!keepIds) ctx.regenerateIds();
    return send(payloadFor(name, { isNew: true })).catch(function (e) {
      if (e.code === 'DUPLICATE' && /código/.test(e.message)) { ctx.regenerateIds(); return send(payloadFor(name, { isNew: true })); }
      if (e.code === 'DUPLICATE') {
        return askName('Ese nombre ya existe', name + ' (2)', e.message).then(function (n) { return n ? saveNew(n, true) : null; });
      }
      throw e;
    });
  }

  /* Guardar: si el proyecto ya existe lo actualiza; si es nuevo, pide el nombre */
  function save() {
    var meta = ctx.getMeta();
    if (!meta) {
      return askName('Guardar proyecto', suggestName()).then(function (n) { return n ? saveNew(n, true) : null; }).catch(fail);
    }
    return send(payloadFor(meta.name, { baseUpdatedAt: meta.updatedAt })).catch(function (e) {
      if (e.data && e.data.conflict) {
        return ctx.ask({ title: 'Otro usuario modificó este proyecto', message: e.message + ' Si guardas, reemplazarás sus cambios con los tuyos. También puedes usar “Guardar como” para conservar ambos.', confirmText: 'Reemplazar con mis cambios', danger: true })
          .then(function (ok) { return ok ? send(payloadFor(meta.name, { baseUpdatedAt: meta.updatedAt, force: true })) : null; });
      }
      if (e.code === 'NOTFOUND') {
        return ctx.ask({ title: 'El proyecto fue eliminado', message: 'Un administrador eliminó “' + meta.name + '” mientras lo editabas. ¿Guardarlo de nuevo como proyecto nuevo? Los carnets ya impresos volverán a funcionar.', confirmText: 'Guardar de nuevo' })
          .then(function (ok) { if (!ok) return null; ctx.setMeta(null); return askName('Guardar proyecto', meta.name).then(function (n) { return n ? saveNew(n, true) : null; }); });
      }
      throw e;
    }).catch(fail);
  }
  /* Guardar como: copia independiente con un nombre nuevo y QR nuevos */
  function saveAs() {
    var meta = ctx.getMeta();
    var msg = meta
      ? 'Se creará una COPIA independiente de “' + meta.name + '” con códigos QR nuevos. Los carnets ya impresos seguirán perteneciendo al proyecto original.'
      : null;
    return askName('Guardar como', meta ? meta.name + ' (copia)' : suggestName(), msg)
      .then(function (n) { return n ? saveNew(n, !meta) : null; }).catch(fail);
  }
  /* Antes de imprimir carnets: el proyecto debe estar guardado para que los QR sean válidos */
  function ensureSaved() {
    if (ctx.getMeta() && !ctx.isDirty()) return Promise.resolve(true);
    var meta = ctx.getMeta();
    return ctx.ask({
      title: meta ? 'Guardar cambios antes de imprimir' : 'Guarda el proyecto antes de imprimir',
      message: meta ? 'Hay cambios sin guardar. Se guardarán para que todos los QR impresos queden registrados.' : 'Los QR de los carnets solo registran asistencia cuando el proyecto está guardado en el servidor.',
      confirmText: meta ? 'Guardar e imprimir' : 'Guardar proyecto'
    }).then(function (ok) { return ok ? save().then(function (p) { return !!p; }) : false; });
  }
  function fail(e) { if (e) ctx.toast(e.message, 'err', 6000); return null; }

  /* ---------- Eliminar (admin) ---------- */
  function del(id) {
    var p = list.filter(function (x) { return x.id === id; })[0];
    if (!p) return;
    ctx.ask({
      title: 'Eliminar proyecto', danger: true, confirmText: 'Eliminar definitivamente',
      message: 'Se eliminará “' + p.name + '” con su diseño de escarapelas y carnets, sus ' + p.participants + ' participante(s) y sus ' + p.records + ' registro(s) de asistencia. Los QR de sus carnets dejarán de funcionar. Esta acción no se puede deshacer (haz un backup antes si lo necesitas).',
      requireText: 'ELIMINAR'
    }).then(function (ok) {
      if (!ok) return;
      setStatus('Eliminando…');
      return API.call('deleteProject', { id: id }, 120000).then(function (r) {
        ctx.toast('Proyecto eliminado: ' + r.deleted.project + ' (' + r.deleted.participants + ' participantes, ' + r.deleted.records + ' asistencias).', 'ok', 5000);
        ctx.onProjectDeleted(id);
        return refresh();
      });
    }).catch(function (e) { setStatus(e.message, 'err'); ctx.toast(e.message, 'err', 5000); });
  }
  function deleteAll() {
    ctx.ask({
      title: 'Borrar TODOS los proyectos', danger: true, confirmText: 'Borrar todo',
      message: 'Se eliminarán TODOS los proyectos, escarapelas, carnets, participantes y registros de asistencia de la base de datos. Los usuarios y el fondo del panel se conservan. Esta acción no se puede deshacer: se recomienda descargar un backup antes.',
      requireText: 'BORRAR TODO'
    }).then(function (ok) {
      if (!ok) return;
      lock(true); setStatus('Borrando toda la información…');
      return API.call('deleteAll', { confirm: 'BORRAR TODO' }, 300000).then(function (r) {
        ctx.onProjectDeleted('*');
        ctx.toast('Se borraron ' + r.deletedProjects + ' proyecto(s) y ' + r.deletedRecords + ' registro(s) de asistencia.', 'ok', 5000);
      }).then(function () { lock(false); return refresh(); }, function (e) { lock(false); throw e; });
    }).catch(function (e) { setStatus(e.message, 'err'); ctx.toast(e.message, 'err', 5000); });
  }

  /* ---------- Backup ---------- */
  function sha256Hex(text) {
    if (!(global.crypto && global.crypto.subtle && global.TextEncoder)) return Promise.resolve('');
    return global.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)).then(function (buf) {
      return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
    }).catch(function () { return ''; });
  }
  function body(b) { var c = {}; Object.keys(b).forEach(function (k) { if (k !== 'checksum') c[k] = b[k]; }); return JSON.stringify(c); }

  function backup() {
    lock(true); progress(2, 'Leyendo usuarios, asistencia y lista de proyectos…'); setStatus('Generando backup…');
    var meta, projects = [];
    API.call('backupMeta', {}, 180000).then(function (m) {
      meta = m;
      var rows = m.projectRows || [], i = 0;
      var next = function () {
        if (i >= rows.length) return Promise.resolve();
        var row = rows[i];
        progress(5 + Math.round(85 * i / Math.max(1, rows.length)), 'Proyecto ' + (i + 1) + ' de ' + rows.length + ': ' + row[1]);
        return API.call('backupProject', { id: row[0] }, 120000).then(function (r) { projects.push({ row: r.row, data: r.data }); i++; return next(); });
      };
      return next();
    }).then(function () {
      progress(93, 'Verificando integridad…');
      var b = {
        type: BACKUP_TYPE, format: 1, appVersion: meta.version, createdAt: meta.createdAt, createdBy: meta.createdBy,
        counts: { users: meta.users.length, projects: projects.length, participants: meta.participants.length, attendance: meta.attendance.length },
        users: meta.users, settings: meta.settings, projects: projects, participants: meta.participants, attendance: meta.attendance
      };
      var check = validate(b);
      if (check) throw new Error('El backup generado no pasó la verificación: ' + check);
      return sha256Hex(body(b)).then(function (h) { b.checksum = h; return b; });
    }).then(function (b) {
      var stamp = b.createdAt.replace(/[^0-9]/g, '').slice(0, 12);
      var txt = JSON.stringify(b);
      ctx.download('backup_escarapelas_' + stamp.slice(0, 8) + '_' + stamp.slice(8) + '.json', new Blob([txt], { type: 'application/json' }));
      progress(100, 'Backup listo');
      var c = b.counts;
      setStatus('Backup descargado: ' + c.projects + ' proyecto(s), ' + c.participants + ' participante(s), ' + c.attendance + ' asistencia(s), ' + c.users + ' usuario(s) · ' + (txt.length / 1048576).toFixed(2) + ' MB', 'ok');
      ctx.toast('Backup completo descargado. Guárdalo en un lugar seguro (contiene los usuarios con sus contraseñas cifradas).', 'ok', 6000);
    }).catch(function (e) { setStatus(e.message, 'err'); ctx.toast(e.message, 'err', 6000); })
      .then(function () { lock(false); setTimeout(function () { progress(null); }, 2500); });
  }

  /* Verifica que el archivo esté completo y sea coherente antes de tocar nada en el servidor */
  function validate(b) {
    if (!b || b.type !== BACKUP_TYPE) return 'el archivo no es un backup de Escarapelas SENA.';
    if (b.format !== 1) return 'formato de backup no compatible.';
    var arrs = ['users', 'projects', 'participants', 'attendance'];
    for (var i = 0; i < arrs.length; i++) if (!Array.isArray(b[arrs[i]])) return 'falta la sección “' + arrs[i] + '”.';
    var c = b.counts || {};
    for (i = 0; i < arrs.length; i++) if (+c[arrs[i]] !== b[arrs[i]].length) return 'la sección “' + arrs[i] + '” está incompleta (' + b[arrs[i]].length + ' de ' + c[arrs[i]] + ').';
    if (!b.users.some(function (u) { return Array.isArray(u) && u[1] === 'admin'; })) return 'no contiene ningún administrador.';
    var ids = {};
    for (i = 0; i < b.projects.length; i++) {
      var p = b.projects[i];
      if (!p || !Array.isArray(p.row) || !/^[A-Za-z0-9]{6,24}$/.test(String(p.row[0]))) return 'proyecto ' + (i + 1) + ' inválido.';
      if (ids[p.row[0]]) return 'proyecto repetido (' + p.row[0] + ').';
      ids[p.row[0]] = true;
      if (p.data !== null && typeof p.data !== 'object') return 'diseño del proyecto “' + p.row[1] + '” dañado.';
      if (p.row[6] && !p.data) return 'falta el diseño del proyecto “' + p.row[1] + '”.';
    }
    if (b.participants.some(function (r) { return !Array.isArray(r) || r.length < 7; })) return 'filas de participantes dañadas.';
    if (b.attendance.some(function (r) { return !Array.isArray(r) || r.length < 9; })) return 'filas de asistencia dañadas.';
    return '';
  }

  function restore(file) {
    if (!file) return;
    setStatus('Leyendo backup…');
    file.text().then(function (txt) {
      var b;
      try { b = JSON.parse(txt); } catch (e) { throw new Error('El archivo no es un JSON válido o está dañado.'); }
      var check = validate(b);
      if (check) throw new Error('Backup no válido: ' + check);
      return (b.checksum ? sha256Hex(body(b)) : Promise.resolve('')).then(function (h) {
        if (b.checksum && h && h !== b.checksum) throw new Error('Backup no válido: el archivo fue modificado o está dañado (la suma de verificación no coincide).');
        return b;
      });
    }).then(function (b) {
      var c = b.counts, me = ctx.username();
      var inBackup = b.users.some(function (u) { return String(u[0]).toLowerCase() === String(me).toLowerCase(); });
      return ctx.ask({
        title: 'Restaurar backup', danger: true, confirmText: 'Borrar todo y restaurar',
        message: 'Backup del ' + fmtDate(b.createdAt) + ' (creado por ' + b.createdBy + '): ' + c.projects + ' proyecto(s), ' + c.participants + ' participante(s), ' + c.attendance + ' asistencia(s) y ' + c.users + ' usuario(s). ' +
          'Primero se BORRARÁ toda la información actual del servidor (proyectos, carnets, asistencia y usuarios) y luego se cargará el backup completo. ' +
          (inBackup ? 'Al terminar deberás ingresar de nuevo.' : '⚠️ Tu usuario “' + me + '” no existe en el backup: al terminar ingresa con un usuario que sí esté en él.'),
        requireText: 'RESTAURAR'
      }).then(function (ok) { return ok ? b : null; });
    }).then(function (b) {
      if (!b) { setStatus(''); return; }
      lock(true);
      var total = b.projects.length + Math.ceil(b.participants.length / ROW_CHUNK) + Math.ceil(b.attendance.length / ROW_CHUNK) + 2, done = 0;
      var tick = function (label) { done++; progress(Math.round(100 * done / total), label); };
      progress(1, 'Limpiando la información actual…');
      return API.call('restoreBegin', { confirm: 'RESTAURAR' }, 300000).then(function () {
        tick('Información anterior eliminada');
        var i = 0;
        var nextProject = function () {
          if (i >= b.projects.length) return Promise.resolve();
          var p = b.projects[i];
          return API.call('restoreProject', { row: p.row, data: p.data }, 180000).then(function () { i++; tick('Proyecto ' + i + ' de ' + b.projects.length + ': ' + p.row[1]); return nextProject(); });
        };
        var rows = function (sheet, all, label) {
          var k = 0;
          var next = function () {
            if (k >= all.length) return Promise.resolve();
            var chunk = all.slice(k, k + ROW_CHUNK);
            return API.call('restoreRows', { sheet: sheet, rows: chunk }, 180000).then(function () { k += chunk.length; tick(label + ' ' + k + ' de ' + all.length); return next(); });
          };
          return next();
        };
        return nextProject()
          .then(function () { return rows('participants', b.participants, 'Participantes'); })
          .then(function () { return rows('attendance', b.attendance, 'Asistencias'); })
          .then(function () { return API.call('restoreFinish', { users: b.users, settings: b.settings || null, expected: b.counts }, 180000); });
      }).then(function (r) {
        tick('Verificación final');
        var withDesign = b.projects.filter(function (p) { return p.row[6]; }).length;
        var c = r.counts;
        var summary = c.projects + ' proyecto(s), ' + c.participants + ' participante(s), ' + c.attendance + ' asistencia(s), ' + c.users + ' usuario(s)';
        if (!r.match || r.projectsWithDesign !== withDesign) {
          throw new Error('La restauración terminó pero los totales no coinciden con el backup (servidor: ' + summary + '). Repite la restauración con el mismo archivo.');
        }
        lock(false);
        setStatus('✅ Restauración completa y verificada: ' + summary + '.', 'ok');
        return ctx.ask({ title: 'Restauración completa', message: 'Se restauró y verificó todo el backup: ' + summary + '. Ahora debes ingresar de nuevo.', confirmText: 'Ir al ingreso', noCancel: true })
          .then(function () { close(); ctx.onRestored(); });
      });
    }).catch(function (e) {
      lock(false);
      setStatus(e.message, 'err');
      ctx.toast(e.message, 'err', 8000);
    }).then(function () { setTimeout(function () { progress(null); }, 3000); });
  }

  /* ---------- Modal ---------- */
  function open() {
    $('#projModal').hidden = false;
    $('#projSearch').value = '';
    progress(null);
    refresh().catch(function () { /* ya se mostró */ });
  }
  function close() { if (!busy) $('#projModal').hidden = true; }

  function init(context) {
    ctx = context;
    $('#projSearch').addEventListener('input', render);
    $('#btnProjRefresh').addEventListener('click', function () { refresh().catch(function () { }); });
    $('#btnProjNew').addEventListener('click', newProject);
    $('#btnBackup').addEventListener('click', backup);
    $('#restoreFile').addEventListener('change', function (e) { var f = e.target.files[0]; e.target.value = ''; restore(f); });
    $('#btnDeleteAll').addEventListener('click', deleteAll);
    $('#projList').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-act]'); if (!b || busy) return;
      var id = b.closest('tr').dataset.id;
      if (b.dataset.act === 'load') load(id);
      else if (b.dataset.act === 'att') { close(); ctx.openAttendance(id); }
      else if (b.dataset.act === 'del') del(id);
    });
  }

  global.ProjectsModule = {
    init: init, open: open, load: load, save: save, saveAs: saveAs, newProject: newProject, ensureSaved: ensureSaved,
    list: function () { return API.call('listProjects').then(function (r) { list = r.projects || []; return list; }); },
    isBusy: function () { return busy; }, validateBackup: validate
  };
})(window);
