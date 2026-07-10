/**
 * api.js — JWT-aware fetch wrapper for all AlgoTalent pages.
 * All API calls go through this module.
 */
(function () {
  'use strict';

  const TOKEN_KEY = 'algotalent_token';
  const USER_KEY = 'algotalent_user';

  // ── Token helpers ────────────────────────────────────
  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function setToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
  }

  function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  function getUser() {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY));
    } catch (_) {
      return null;
    }
  }

  function setUser(user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  function isLoggedIn() {
    return !!getToken();
  }

  function isAdmin() {
    var user = getUser();
    return user && user.role === 'admin';
  }

  // ── Fetch wrapper ─────────────────────────────────────
  async function apiFetch(url, options) {
    options = options || {};
    var headers = options.headers || {};
    var token = getToken();
    if (token) {
      headers['Authorization'] = 'Bearer ' + token;
    }
    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    }

    var resp = await fetch(url, {
      method: options.method || 'GET',
      headers: headers,
      body: options.body,
    });

    if (resp.status === 401) {
      clearToken();
      window.location.href = '/login.html';
      throw new Error('Session expired');
    }

    return resp;
  }

  // ── Convenience methods ───────────────────────────────
  async function apiGet(url) {
    var resp = await apiFetch(url);
    if (!resp.ok) throw new Error('API Error: ' + resp.status);
    return resp.json();
  }

  async function apiPost(url, data) {
    var resp = await apiFetch(url, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (!resp.ok) {
      var err = await resp.json().catch(function () { return {}; });
      throw new Error(err.detail || 'API Error: ' + resp.status);
    }
    return resp.json();
  }

  async function apiPatch(url, data) {
    var resp = await apiFetch(url, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    if (!resp.ok) {
      var err = await resp.json().catch(function () { return {}; });
      throw new Error(err.detail || 'API Error: ' + resp.status);
    }
    return resp.json();
  }

  async function apiDelete(url) {
    var resp = await apiFetch(url, { method: 'DELETE' });
    if (!resp.ok) {
      var err = await resp.json().catch(function () { return {}; });
      throw new Error(err.detail || 'API Error: ' + resp.status);
    }
    return resp.json();
  }

  // ── Login / Logout ────────────────────────────────────
  async function login(username, password) {
    var formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);

    var resp = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
    });

    if (!resp.ok) {
      var err = await resp.json().catch(function () { return {}; });
      throw new Error(err.detail || 'Login failed');
    }

    var data = await resp.json();
    setToken(data.access_token);

    // Fetch user profile
    var userResp = await apiFetch('/api/users/me');
    if (userResp.ok) {
      var user = await userResp.json();
      setUser(user);
    }

    return data;
  }

  function logout() {
    clearToken();
    window.location.href = '/login.html';
  }

  // ── Export ────────────────────────────────────────────
  window.API = {
    get: apiGet,
    post: apiPost,
    patch: apiPatch,
    delete: apiDelete,
    fetch: apiFetch,
    login: login,
    logout: logout,
    isLoggedIn: isLoggedIn,
    isAdmin: isAdmin,
    getUser: getUser,
    getToken: getToken,
  };
})();
