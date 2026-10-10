/* Comunicación con el servidor (Google Apps Script).
 * Por qué POST con Content-Type text/plain: así el navegador no hace la petición previa
 * CORS (preflight) que Apps Script no admite; la respuesta igual es legible desde GitHub Pages. */
(function (global) {
  'use strict';

  var URL_RE = /^https:\/\/script\.google\.com\/(macros|a\/macros\/[A-Za-z0-9.-]+)\/s\/[A-Za-z0-9_-]{20,}\/exec$/;
  var LS_URL = 'escSena.serviceUrl';
  var SS_TOKEN = 'escSena.token.v4';
  var SS_USER = 'escSena.user.v4';

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* nada */ } }
  function ssGet(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function ssSet(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* nada */ } }
  function ssDel(k) { try { sessionStorage.removeItem(k); } catch (e) { /* nada */ } }

  var API = {
    URL_RE: URL_RE,
    onAuthLost: null,

    /* La URL de config.js tiene prioridad; si no hay, la guardada en este navegador */
    serviceUrl: function () {
      var c = String(((global.APP_CONFIG || {}).serviceUrl) || '').trim();
      if (URL_RE.test(c)) return c;
      var l = String(lsGet(LS_URL) || '').trim();
      return URL_RE.test(l) ? l : '';
    },
    fixedByConfig: function () { return URL_RE.test(String(((global.APP_CONFIG || {}).serviceUrl) || '').trim()); },
    setServiceUrl: function (u) {
      u = String(u || '').trim();
      if (!URL_RE.test(u)) throw new Error('La URL debe ser la de la Aplicación web de Apps Script (termina en /exec).');
      lsSet(LS_URL, u);
    },

    token: function () { return ssGet(SS_TOKEN) || ''; },
    user: function () { try { return JSON.parse(ssGet(SS_USER) || 'null'); } catch (e) { return null; } },
    setSession: function (token, user) { if (token) ssSet(SS_TOKEN, token); if (user) ssSet(SS_USER, JSON.stringify(user)); },
    clearSession: function () { ssDel(SS_TOKEN); ssDel(SS_USER); },

    request: function (url, opts, timeoutMs) {
      var ctrl = global.AbortController ? new AbortController() : null;
      var t = setTimeout(function () { if (ctrl) ctrl.abort(); }, timeoutMs || 60000);
      opts = opts || {};
      if (ctrl) opts.signal = ctrl.signal;
      return fetch(url, opts).then(function (r) {
        clearTimeout(t);
        if (!r.ok) throw new Error('El servidor respondió ' + r.status + '. Revisa la implementación de Apps Script.');
        return r.json().catch(function () { throw new Error('Respuesta inesperada del servidor. ¿La implementación tiene acceso “Cualquier usuario” y está actualizada a la versión 4?'); });
      }, function (err) {
        clearTimeout(t);
        throw new Error(err && err.name === 'AbortError' ? 'El servidor tardó demasiado en responder. Intenta de nuevo.' : 'No se pudo conectar con el servidor. Verifica tu internet y la URL del servicio.');
      });
    },

    /* Llamada autenticada. Si la sesión expiró, avisa a la app para volver al ingreso. */
    call: function (action, payload, timeoutMs) {
      var url = API.serviceUrl();
      if (!url) return Promise.reject(new Error('Falta configurar la URL del servidor.'));
      var body = { action: action, token: API.token() };
      Object.keys(payload || {}).forEach(function (k) { body[k] = payload[k]; });
      return API.request(url, { method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) }, timeoutMs)
        .then(function (j) {
          if (j && j.ok) return j;
          var e = new Error((j && j.error) || 'Error desconocido del servidor.');
          e.code = (j && j.code) || 'ERROR';
          e.data = j || {};
          if (e.code === 'AUTH' && typeof API.onAuthLost === 'function') API.onAuthLost(e.message);
          throw e;
        });
    },

    get: function (params, url) {
      url = url || API.serviceUrl();
      if (!url) return Promise.reject(new Error('Falta configurar la URL del servidor.'));
      var q = Object.keys(params).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); }).join('&');
      return API.request(url + (url.indexOf('?') >= 0 ? '&' : '?') + q, { method: 'GET', redirect: 'follow' }, 30000);
    },

    ping: function (url) {
      return API.get({ a: 'ping' }, url).then(function (j) {
        if (!j || !j.ok || j.servicio !== 'escarapelas-sena') throw new Error('La URL responde, pero no es el servidor v4 de Escarapelas. Actualiza el Code.gs y crea una nueva versión de la implementación.');
        return j;
      });
    }
  };

  global.API = API;
})(window);
