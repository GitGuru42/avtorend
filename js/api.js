// js/api.js
// Minimal API client exposed as window.carAPI for FleetManager.
// Production-safe: same-origin in prod, localhost fallback for dev.

(function () {
  'use strict';

  const isLocalhost = (location.hostname === 'localhost' || location.hostname === '127.0.0.1');
  // If frontend runs on Vite (5173) use backend on 8000; otherwise same-origin.
  const API_BASE = (isLocalhost && location.port !== '8000')
    ? 'http://localhost:8000/api'
    : `${location.origin}/api`;

  function buildUrl(path, params = {}) {
    const url = new URL(`${API_BASE}${path}`);
    // cache buster (helps during local dev)
    url.searchParams.set('_t', String(Date.now()));
    Object.entries(params).forEach(([k, v]) => {
      if (v === undefined || v === null || v === '') return;
      url.searchParams.set(k, String(v));
    });
    return url.toString();
  }

  async function getJson(url) {
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`API ${res.status}: ${body || res.statusText}`);
    }
    return res.json();
  }

  window.carAPI = {
    baseUrl: API_BASE,

    async getCars(filters = {}) {
      return getJson(buildUrl('/cars', filters));
    },

    async getCategories() {
      return getJson(buildUrl('/categories'));
    }
  };

  console.log('📡 carAPI ready:', API_BASE);
})();
