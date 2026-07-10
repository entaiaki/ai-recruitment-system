/**
 * auth.js — Page-level auth guard.
 * Include this on every protected page. Redirects to login if no token.
 */
(function () {
  'use strict';

  // Wait for api.js to load
  if (!window.API) {
    console.warn('auth.js: api.js not loaded yet, deferring check');
    window.addEventListener('DOMContentLoaded', checkAuth);
    return;
  }
  checkAuth();

  function checkAuth() {
    if (!window.API.isLoggedIn()) {
      window.location.href = '/login.html';
    }
  }
})();
