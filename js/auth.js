/* Autenticación y gestión de usuarios (100 % en el navegador).
 *
 * Decisiones de diseño:
 * - Las contraseñas NUNCA se guardan en claro: se guarda sal aleatoria + hash SHA-256
 *   iterado (estiramiento de clave) para encarecer ataques de fuerza bruta.
 * - La sesión vive en sessionStorage: se cierra sola al cerrar la pestaña.
 * - Bloqueo temporal tras 5 intentos fallidos.
 * - IMPORTANTE: al ser una app estática (GitHub Pages), los usuarios existen solo en el
 *   navegador donde se crearon. Para llevarlos a otro equipo: Exportar / Importar usuarios.
 */
(function (global) {
  'use strict';

  var USERS_KEY = 'escSena.users.v1';
  var SESSION_KEY = 'escSena.session.v1';
  var LOCK_KEY = 'escSena.lock.v1';
  var ITERATIONS = 4000;
  var DEFAULT_ADMIN = { username: 'Walter', password: '123456' };

  function safeGet(storage, key) { try { return storage.getItem(key); } catch (e) { return null; } }
  function safeSet(storage, key, val) { try { storage.setItem(key, val); return true; } catch (e) { return false; } }
  function safeDel(storage, key) { try { storage.removeItem(key); } catch (e) { /* nada */ } }

  function randomSalt() {
    var arr = new Uint8Array(16);
    if (global.crypto && global.crypto.getRandomValues) global.crypto.getRandomValues(arr);
    else for (var i = 0; i < 16; i++) arr[i] = Math.floor(Math.random() * 256);
    return Array.prototype.map.call(arr, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  }

  function hashPassword(password, salt) {
    var h = salt + ':' + password;
    for (var i = 0; i < ITERATIONS; i++) h = global.sha256(h + salt);
    return h;
  }

  // Comparación en tiempo constante (evita filtrar información por tiempos)
  function safeEqual(a, b) {
    if (a.length !== b.length) return false;
    var r = 0;
    for (var i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return r === 0;
  }

  function loadUsers() {
    var raw = safeGet(localStorage, USERS_KEY);
    var users = [];
    if (raw) { try { users = JSON.parse(raw) || []; } catch (e) { users = []; } }
    if (!Array.isArray(users)) users = [];
    if (!users.some(function (u) { return u.role === 'admin'; })) {
      // Semilla: administrador inicial Walter / 123456 (debe cambiarla al entrar)
      var salt = randomSalt();
      users.push({
        username: DEFAULT_ADMIN.username,
        role: 'admin',
        salt: salt,
        hash: hashPassword(DEFAULT_ADMIN.password, salt),
        mustChange: true,
        created: new Date().toISOString()
      });
      saveUsers(users);
    }
    return users;
  }

  function saveUsers(users) { return safeSet(localStorage, USERS_KEY, JSON.stringify(users)); }

  function findUser(users, username) {
    var n = String(username || '').trim().toLowerCase();
    for (var i = 0; i < users.length; i++) if (users[i].username.toLowerCase() === n) return users[i];
    return null;
  }

  function validUsername(name) { return /^[A-Za-zÁÉÍÓÚÑáéíóúñ0-9._-]{3,30}$/.test(name); }

  var Auth = {
    lockInfo: function () {
      var raw = safeGet(localStorage, LOCK_KEY);
      var info = { fails: 0, until: 0 };
      if (raw) { try { info = JSON.parse(raw); } catch (e) { /* nada */ } }
      return info;
    },

    login: function (username, password) {
      var lock = this.lockInfo();
      var now = Date.now();
      if (lock.until && now < lock.until) {
        return { ok: false, error: 'Demasiados intentos. Espera ' + Math.ceil((lock.until - now) / 1000) + ' s.' };
      }
      var users = loadUsers();
      var u = findUser(users, username);
      var ok = u && safeEqual(hashPassword(password, u.salt), u.hash);
      if (!ok) {
        lock.fails = (lock.fails || 0) + 1;
        if (lock.fails >= 5) { lock.until = now + 30000; lock.fails = 0; }
        safeSet(localStorage, LOCK_KEY, JSON.stringify(lock));
        return { ok: false, error: 'Usuario o contraseña incorrectos.' };
      }
      safeDel(localStorage, LOCK_KEY);
      safeSet(sessionStorage, SESSION_KEY, JSON.stringify({ username: u.username, at: now }));
      return { ok: true, user: this.publicUser(u) };
    },

    logout: function () { safeDel(sessionStorage, SESSION_KEY); },

    current: function () {
      var raw = safeGet(sessionStorage, SESSION_KEY);
      if (!raw) return null;
      try {
        var s = JSON.parse(raw);
        var u = findUser(loadUsers(), s.username);
        return u ? this.publicUser(u) : null; // si lo borraron, la sesión deja de valer
      } catch (e) { return null; }
    },

    publicUser: function (u) {
      return { username: u.username, role: u.role, mustChange: !!u.mustChange, created: u.created };
    },

    list: function () { return loadUsers().map(this.publicUser); },

    requireAdmin: function () {
      var c = this.current();
      if (!c || c.role !== 'admin') throw new Error('Solo un administrador puede hacer esto.');
      return c;
    },

    create: function (username, password, role) {
      this.requireAdmin();
      username = String(username || '').trim();
      if (!validUsername(username)) throw new Error('Usuario inválido: 3 a 30 caracteres (letras, números, punto, guion).');
      if (String(password).length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres.');
      var users = loadUsers();
      if (findUser(users, username)) throw new Error('Ya existe un usuario con ese nombre.');
      var salt = randomSalt();
      users.push({
        username: username, role: role === 'admin' ? 'admin' : 'user', salt: salt,
        hash: hashPassword(password, salt), mustChange: true, created: new Date().toISOString()
      });
      if (!saveUsers(users)) throw new Error('No se pudo guardar (almacenamiento del navegador lleno o bloqueado).');
    },

    setPassword: function (username, password) {
      this.requireAdmin();
      if (String(password).length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres.');
      var users = loadUsers();
      var u = findUser(users, username);
      if (!u) throw new Error('Usuario no encontrado.');
      u.salt = randomSalt();
      u.hash = hashPassword(password, u.salt);
      u.mustChange = true;
      saveUsers(users);
    },

    setRole: function (username, role) {
      var me = this.requireAdmin();
      var users = loadUsers();
      var u = findUser(users, username);
      if (!u) throw new Error('Usuario no encontrado.');
      if (role !== 'admin') {
        var admins = users.filter(function (x) { return x.role === 'admin'; });
        if (u.role === 'admin' && admins.length <= 1) throw new Error('Debe quedar al menos un administrador.');
        if (u.username === me.username) throw new Error('No puedes quitarte tu propio rol de administrador.');
      }
      u.role = role === 'admin' ? 'admin' : 'user';
      saveUsers(users);
    },

    remove: function (username) {
      var me = this.requireAdmin();
      var users = loadUsers();
      var u = findUser(users, username);
      if (!u) throw new Error('Usuario no encontrado.');
      if (u.username === me.username) throw new Error('No puedes eliminar tu propio usuario.');
      if (u.role === 'admin' && users.filter(function (x) { return x.role === 'admin'; }).length <= 1) {
        throw new Error('Debe quedar al menos un administrador.');
      }
      saveUsers(users.filter(function (x) { return x !== u; }));
    },

    changeOwnPassword: function (oldPass, newPass) {
      var c = this.current();
      if (!c) throw new Error('Sesión expirada.');
      var users = loadUsers();
      var u = findUser(users, c.username);
      if (!safeEqual(hashPassword(oldPass, u.salt), u.hash)) throw new Error('La contraseña actual no es correcta.');
      if (String(newPass).length < 6) throw new Error('La nueva contraseña debe tener al menos 6 caracteres.');
      if (newPass === oldPass) throw new Error('La nueva contraseña debe ser diferente a la actual.');
      if (newPass === DEFAULT_ADMIN.password) throw new Error('No uses la contraseña inicial.');
      u.salt = randomSalt();
      u.hash = hashPassword(newPass, u.salt);
      u.mustChange = false;
      saveUsers(users);
    },

    exportUsers: function () {
      this.requireAdmin();
      return JSON.stringify({ type: 'escSena.users', version: 1, users: loadUsers() }, null, 2);
    },

    importUsers: function (json) {
      this.requireAdmin();
      var data = JSON.parse(json);
      if (!data || data.type !== 'escSena.users' || !Array.isArray(data.users)) throw new Error('Archivo de usuarios no válido.');
      var users = loadUsers();
      var added = 0;
      data.users.forEach(function (x) {
        if (!x || !validUsername(x.username) || !/^[0-9a-f]{64}$/.test(x.hash) || !/^[0-9a-f]{32}$/.test(x.salt)) return;
        if (findUser(users, x.username)) return; // no sobrescribe usuarios existentes
        users.push({ username: x.username, role: x.role === 'admin' ? 'admin' : 'user', salt: x.salt, hash: x.hash, mustChange: !!x.mustChange, created: x.created || new Date().toISOString() });
        added++;
      });
      saveUsers(users);
      return added;
    }
  };

  global.Auth = Auth;
})(window);
