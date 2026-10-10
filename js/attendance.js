/* Módulo de control de asistencia — versión 4.
 * Cualquier usuario (o administrador) puede elegir CUALQUIER proyecto guardado, ver y filtrar su
 * asistencia, exportarla a Excel y habilitar/inhabilitar el escaneo de sus QR.
 * Los QR siguen funcionando indefinidamente mientras el proyecto exista y el escaneo esté habilitado.
 */
(function (global) {
  'use strict';

  var API = global.API;
  var ctx = null, data = null, timer = null, busy = false, projects = [], currentId = '';
  var $ = function (s) { return document.querySelector(s); };

  function serviceUrl() { return API.serviceUrl(); }

  function setStatus(msg, isErr) {
    var el = $('#attStatus');
    if (el) { el.textContent = msg; el.className = 'att-status' + (isErr ? ' err' : ''); }
  }
  function renderScan(enabled) {
    var pill = $('#scanPill'), btn = $('#btnScanToggle');
    if (enabled == null) { pill.className = 'scan-pill'; pill.textContent = 'Sin datos'; btn.disabled = true; btn.textContent = 'Habilitar escaneo'; btn.className = 'btn'; return; }
    pill.className = 'scan-pill ' + (enabled ? 'on' : 'off');
    pill.textContent = enabled ? '● Escaneo HABILITADO' : '● Escaneo INHABILITADO';
    btn.disabled = false;
    btn.dataset.enabled = enabled ? '1' : '0';
    btn.textContent = enabled ? '⏸ Inhabilitar escaneo' : '▶ Habilitar escaneo';
    btn.className = 'btn ' + (enabled ? 'btn-danger' : 'btn-primary');
  }
  function clearView(msg) {
    data = null;
    $('#attTable').innerHTML = msg ? '<p class="att-empty">' + msg + '</p>' : '';
    $('#attStats').innerHTML = '';
    renderScan(null);
  }

  /* Lista de proyectos para el selector */
  function loadProjects(selectId) {
    return API.call('listProjects').then(function (r) {
      projects = r.projects || [];
      var sel = $('#attProject');
      sel.innerHTML = projects.length
        ? projects.map(function (p) { return '<option value="' + ctx.esc(p.id) + '">' + ctx.esc(p.name) + ' · ' + p.participants + ' part. · ' + p.records + ' asist.</option>'; }).join('')
        : '<option value="">— No hay proyectos guardados —</option>';
      var want = selectId && projects.some(function (p) { return p.id === selectId; }) ? selectId : (projects[0] ? projects[0].id : '');
      sel.value = want;
      currentId = want;
      return want;
    });
  }

  function load() {
    if (busy) return Promise.resolve();
    if (!currentId) { clearView('No hay proyectos guardados. Guarda un proyecto (💾 Guardar) para que sus carnets registren asistencia.'); setStatus(''); return Promise.resolve(); }
    busy = true;
    var id = currentId;
    setStatus('Consultando…');
    return API.call('attendance', { id: id }, 90000).then(function (r) {
      if (id !== currentId) return; // el usuario cambió de proyecto mientras cargaba
      data = r;
      var p = r.project;
      $('#attEvent').innerHTML = 'Proyecto: <strong>' + ctx.esc(p.name) + '</strong> · código <code>' + ctx.esc(p.id) + '</code> · creado por ' + ctx.esc(p.createdBy);
      renderScan(r.scanEnabled);
      fillFilters();
      renderTable();
      setStatus('Actualizado ' + new Date().toLocaleTimeString('es-CO') + ' · hora del servidor ' + r.serverTime);
    }).catch(function (err) {
      if (err.code === 'NOTFOUND') { clearView('Este proyecto fue eliminado.'); loadProjects('').then(load); }
      else { renderScan(null); }
      setStatus(err.message, true);
    }).then(function () { busy = false; });
  }

  /* ---------- Filtros y tablas ---------- */
  function fmtDate(iso) { var p = String(iso).split('-'); return ctx.esc(p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : iso); }
  function norm(s) { return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }

  function participants() {
    if (!data) return [];
    var map = {};
    data.participants.forEach(function (p) { map[p.id] = { id: p.id, name: p.name, role: p.role }; });
    // Si alguien registró y luego se sacó de la lista, igual aparece
    data.records.forEach(function (r) { if (!map[r.id]) map[r.id] = { id: r.id, name: r.name, role: r.role }; });
    return Object.keys(map).map(function (k) { return map[k]; }).sort(function (a, b) { return a.name.localeCompare(b.name, 'es'); });
  }
  function allDates() {
    var s = {};
    (data ? data.records : []).forEach(function (r) { s[r.date] = true; });
    return Object.keys(s).sort();
  }
  function fillFilters() {
    var keep = { p: $('#attPerson').value, d: $('#attDate').value, r: $('#attRole').value };
    var ps = participants(), ds = allDates(), roles = {};
    ps.forEach(function (p) { if (p.role) roles[p.role] = true; });
    $('#attPerson').innerHTML = '<option value="">Todos los participantes</option>' + ps.map(function (p) {
      return '<option value="' + ctx.esc(p.id) + '">' + ctx.esc(p.name) + '</option>';
    }).join('');
    $('#attDate').innerHTML = '<option value="">Todos los días</option>' + ds.map(function (d) { return '<option value="' + ctx.esc(d) + '">' + fmtDate(d) + '</option>'; }).join('');
    $('#attRole').innerHTML = '<option value="">Todos los rangos</option>' + Object.keys(roles).sort().map(function (r) { return '<option>' + ctx.esc(r) + '</option>'; }).join('');
    ['p', 'd', 'r'].forEach(function (k) {
      var sel = $({ p: '#attPerson', d: '#attDate', r: '#attRole' }[k]);
      if (Array.prototype.some.call(sel.options, function (o) { return o.value === keep[k]; })) sel.value = keep[k];
    });
  }
  function filtered() {
    var q = norm($('#attSearch').value.trim()), pid = $('#attPerson').value, day = $('#attDate').value, role = $('#attRole').value;
    var ps = participants().filter(function (p) {
      return (!pid || p.id === pid) && (!role || p.role === role) && (!q || norm(p.name).indexOf(q) >= 0 || norm(p.id).indexOf(q) >= 0);
    });
    var ids = {}; ps.forEach(function (p) { ids[p.id] = true; });
    var days = day ? [day] : allDates();
    var recs = (data ? data.records : []).filter(function (r) { return ids[r.id] && (!day || r.date === day); })
      .sort(function (a, b) { return a.ts < b.ts ? 1 : -1; });
    var byPD = {};
    recs.forEach(function (r) { var k = r.id + '|' + r.date; if (!byPD[k] || r.time < byPD[k]) byPD[k] = r.time; });
    return { ps: ps, days: days, recs: recs, byPD: byPD, allDays: allDates() };
  }

  function renderTable() {
    if (!data) return;
    var act = $('#attTabs .tab.active'), f = filtered(), view = act ? act.dataset.v : 'resumen';
    var total = participants().length, nd = f.allDays.length;
    var today = data.serverTime.slice(0, 10);
    var todayCount = {}; data.records.forEach(function (r) { if (r.date === today) todayCount[r.id] = true; });
    var sumDays = 0; participants().forEach(function (p) { f.allDays.forEach(function (d) { if (data.records.some(function (r) { return r.id === p.id && r.date === d; })) sumDays++; }); });
    var avg = total && nd ? Math.round(sumDays / (total * nd) * 100) : 0;
    $('#attStats').innerHTML =
      stat(total, 'Participantes registrados') + stat(Object.keys(todayCount).length, 'Asistieron hoy') +
      stat(nd, 'Días con asistencia') + stat(avg + ' %', 'Asistencia promedio');

    var html;
    if (view === 'resumen') {
      if (!f.ps.length) { $('#attTable').innerHTML = empty(); return; }
      html = '<table class="att-table"><thead><tr><th>#</th><th>Participante</th><th>Rango</th>' +
        f.days.map(function (d) { return '<th class="c">' + fmtDate(d) + '</th>'; }).join('') + '<th class="c">Días</th></tr></thead><tbody>';
      f.ps.forEach(function (p, i) {
        var n = 0;
        var cells = f.days.map(function (d) {
          var t = f.byPD[p.id + '|' + d];
          if (t) n++;
          return '<td class="c">' + (t ? '<span class="yes" title="' + t + '">✔ ' + t.slice(0, 5) + '</span>' : '<span class="no">—</span>') + '</td>';
        }).join('');
        html += '<tr><td>' + (i + 1) + '</td><td><strong>' + ctx.esc(p.name) + '</strong><br><small>ID ' + ctx.esc(p.id) + '</small></td><td>' + ctx.esc(p.role || '—') +
          '</td>' + cells + '<td class="c"><b>' + n + '</b>' + (f.days.length ? ' / ' + f.days.length : '') + '</td></tr>';
      });
      html += '</tbody></table>';
    } else {
      if (!f.recs.length) { $('#attTable').innerHTML = empty(); return; }
      html = '<table class="att-table"><thead><tr><th>Fecha</th><th>Hora</th><th>Participante</th><th>Rango</th><th>ID</th></tr></thead><tbody>' +
        f.recs.map(function (r) {
          return '<tr><td>' + fmtDate(r.date) + '</td><td>' + ctx.esc(r.time) + '</td><td>' + ctx.esc(r.name) + '</td><td>' + ctx.esc(r.role || '—') + '</td><td><small>' + ctx.esc(r.id) + '</small></td></tr>';
        }).join('') + '</tbody></table>';
    }
    $('#attTable').innerHTML = html;
  }
  function stat(v, l) { return '<div class="att-stat"><b>' + v + '</b><span>' + l + '</span></div>'; }
  function empty() { return '<p class="att-empty">No hay datos con los filtros seleccionados.</p>'; }

  /* ---------- Exportar a Excel ---------- */
  function exportExcel() {
    if (!data) { ctx.toast('Primero consulta la asistencia.', 'warn'); return; }
    if (!global.XLSX) { ctx.toast('No se pudo cargar el generador de Excel.', 'err'); return; }
    var f = filtered(), ev = { name: data.project.name, id: data.project.id };
    var resumen = f.ps.map(function (p, i) {
      var row = { '#': i + 1, 'Participante': p.name, 'Rango': p.role || '', 'ID carnet': p.id }, n = 0;
      f.days.forEach(function (d) { var t = f.byPD[p.id + '|' + d]; if (t) n++; row[fmtDate(d)] = t ? 'Asistió ' + t : 'No asistió'; });
      row['Días asistidos'] = n;
      row['% asistencia'] = f.days.length ? Math.round(n / f.days.length * 100) + ' %' : '';
      return row;
    });
    var detalle = f.recs.slice().reverse().map(function (r) {
      return { 'Fecha': fmtDate(r.date), 'Hora': r.time, 'Participante': r.name, 'Rango': r.role || '', 'ID carnet': r.id, 'Origen': r.source || 'QR' };
    });
    var filtros = [];
    if ($('#attPerson').value) filtros.push('Participante: ' + $('#attPerson').selectedOptions[0].text);
    if ($('#attDate').value) filtros.push('Día: ' + fmtDate($('#attDate').value));
    if ($('#attRole').value) filtros.push('Rango: ' + $('#attRole').value);
    if ($('#attSearch').value.trim()) filtros.push('Búsqueda: ' + $('#attSearch').value.trim());
    var info = [
      ['Reporte de asistencia'], [], ['Proyecto', ev.name], ['Código del proyecto', ev.id], ['Creado por', data.project.createdBy],
      ['Generado', new Date().toLocaleString('es-CO')], ['Filtros', filtros.join(' · ') || 'Ninguno'],
      ['Participantes en el reporte', f.ps.length], ['Registros en el reporte', f.recs.length], [],
      ['SENA · Centro de Automatización Industrial · Regional Caldas'], ['Instructor: Jorge Walter Salazar A.']
    ];
    var wb = XLSX.utils.book_new();
    var ws1 = XLSX.utils.json_to_sheet(resumen.length ? resumen : [{ 'Sin datos': '' }]);
    ws1['!cols'] = [{ wch: 4 }, { wch: 36 }, { wch: 14 }, { wch: 13 }].concat(f.days.map(function () { return { wch: 17 }; }), [{ wch: 14 }, { wch: 13 }]);
    var ws2 = XLSX.utils.json_to_sheet(detalle.length ? detalle : [{ 'Sin datos': '' }]);
    ws2['!cols'] = [{ wch: 12 }, { wch: 10 }, { wch: 36 }, { wch: 14 }, { wch: 13 }, { wch: 8 }];
    var ws3 = XLSX.utils.aoa_to_sheet(info);
    ws3['!cols'] = [{ wch: 28 }, { wch: 60 }];
    XLSX.utils.book_append_sheet(wb, ws1, 'Resumen');
    XLSX.utils.book_append_sheet(wb, ws2, 'Registros');
    XLSX.utils.book_append_sheet(wb, ws3, 'Información');
    var stamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, 'asistencia_' + ctx.slug(ev.name) + '_' + stamp + '.xlsx');
  }

  /* ---------- Abrir / eventos ---------- */
  function open(projectId) {
    clearView('');
    $('#attEvent').textContent = '';
    $('#attModal').hidden = false;
    setStatus('Cargando proyectos…');
    loadProjects(projectId || (ctx.currentProjectId() || '')).then(load).catch(function (e) { setStatus(e.message, true); });
    clearInterval(timer);
    timer = setInterval(function () {
      if ($('#attModal').hidden) { clearInterval(timer); return; }
      if ($('#attAuto').checked && !document.hidden && currentId) load();
    }, 20000);
  }

  function init(context) {
    ctx = context;
    $('#attProject').addEventListener('change', function (e) {
      currentId = e.target.value;
      ['#attPerson', '#attDate', '#attRole'].forEach(function (s) { $(s).value = ''; });
      $('#attSearch').value = '';
      clearView('');
      load();
    });
    $('#btnAttRefresh').addEventListener('click', function () { loadProjects(currentId).then(load).catch(function (e) { setStatus(e.message, true); }); });
    $('#btnAttExcel').addEventListener('click', exportExcel);
    $('#btnAttOpenProject').addEventListener('click', function () { if (currentId) { $('#attModal').hidden = true; ctx.loadProject(currentId); } });
    $('#btnScanToggle').addEventListener('click', function () {
      var b = $('#btnScanToggle'), next = b.dataset.enabled !== '1', id = currentId;
      b.disabled = true;
      API.call('setScan', { id: id, enabled: next }).then(function (r) {
        if (id === currentId) renderScan(r.scanEnabled);
        ctx.toast(r.scanEnabled ? 'Escaneo habilitado: los QR de este proyecto ya registran asistencia.' : 'Escaneo inhabilitado: los QR de este proyecto no registrarán asistencia.', r.scanEnabled ? 'ok' : 'warn', 4000);
        ctx.onScanChanged(id, r.scanEnabled);
      }).catch(function (err) { ctx.toast(err.message, 'err', 5000); b.disabled = false; });
    });
    $('#attSearch').addEventListener('input', renderTable);
    ['#attPerson', '#attDate', '#attRole'].forEach(function (s) { $(s).addEventListener('change', renderTable); });
    $('#attTabs').addEventListener('click', function (e) {
      var t = e.target.closest('.tab'); if (!t) return;
      Array.prototype.forEach.call(document.querySelectorAll('#attTabs .tab'), function (x) { x.classList.toggle('active', x === t); });
      renderTable();
    });
  }

  global.AttendanceModule = { init: init, open: open, serviceUrl: serviceUrl };
})(window);
