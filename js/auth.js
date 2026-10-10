/* Autenticación y usuarios — versión 4 (en el servidor).
 *
 * Por qué cambió: en v3 los usuarios vivían en cada navegador, así que un proyecto creado en un
 * computador no podía verse desde otro y la regla “solo el administrador borra” la controlaba el
 * propio navegador. Ahora el servidor verifica la contraseña, emite una sesión de 6 horas y revisa
 * el rol en CADA petición: un usuario normal no puede borrar aunque manipule la página.
 */
(function (global) {
  'use strict';
  var API = global.API;

  function users(r) { return r.users || []; }

  global.Auth = {
    login: function (username, password) {
      return API.call('login', { username: String(username || '').trim(), password: String(password || '') }, 45000)
        .then(function (r) { API.setSession(r.token, r.user); return r.user; });
    },
    logout: function () {
      var had = !!API.token();
      var p = had ? API.call('logout', {}, 10000).catch(function () { /* la sesión igual expira sola */ }) : Promise.resolve();
      API.clearSession();
      return p;
    },
    current: function () { return API.token() ? API.user() : null; },
    refresh: function () { return API.call('me', {}, 30000).then(function (r) { API.setSession(null, r.user); return r.user; }); },
    changeOwnPassword: function (oldPassword, newPassword) {
      return API.call('changePassword', { oldPassword: oldPassword, newPassword: newPassword }, 45000)
        .then(function (r) { API.setSession(r.token || null, r.user); return r.user; });
    },
    list: function () { return API.call('listUsers').then(users); },
    create: function (username, password, role) { return API.call('createUser', { username: username, password: password, role: role }, 45000).then(users); },
    setPassword: function (username, password) { return API.call('setUserPassword', { username: username, password: password }, 45000).then(users); },
    setRole: function (username, role) { return API.call('setUserRole', { username: username, role: role }).then(users); },
    remove: function (username) { return API.call('deleteUser', { username: username }).then(users); }
  };
})(window);
