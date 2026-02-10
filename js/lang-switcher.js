// js/lang-switcher.js
// Lightweight i18n: loads /locales/{lang}.json and applies translations to elements with data-i18n.
// Stores selected language in localStorage under "lang".

(function () {
  'use strict';

  const STORAGE_KEY = 'lang';
  const DEFAULT_LANG = 'ru';
  let dictionary = null;
  let currentLang = DEFAULT_LANG;

  function get(obj, path) {
    return path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);
  }

  async function loadDictionary(lang) {
    const url = `/locales/${lang}.json?_t=${Date.now()}`;
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) throw new Error(`Failed to load locale ${lang}: ${res.status}`);
    return res.json();
  }

  function applyTranslations() {
    if (!dictionary) return;

    // text nodes
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      const val = get(dictionary, key);
      if (typeof val === 'string') el.textContent = val;
    });

    // placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      const key = el.getAttribute('data-i18n-placeholder');
      const val = get(dictionary, key);
      if (typeof val === 'string') el.setAttribute('placeholder', val);
    });

    // document title
    const titleKeyEl = document.querySelector('title[data-i18n]');
    if (titleKeyEl) {
      const key = titleKeyEl.getAttribute('data-i18n');
      const val = get(dictionary, key);
      if (typeof val === 'string') document.title = val;
    }

    document.documentElement.setAttribute('lang', currentLang);
  }

  function setActiveButton(lang) {
    document.querySelectorAll('.lang-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
    });
  }

  async function setLanguage(lang) {
    currentLang = lang;
    localStorage.setItem(STORAGE_KEY, lang);
    setActiveButton(lang);

    try {
      dictionary = await loadDictionary(lang);
      applyTranslations();
      console.log(`🌐 Language set: ${lang}`);
    } catch (e) {
      console.error('❌ i18n error:', e);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const initial = saved || DEFAULT_LANG;

    document.querySelectorAll('.lang-btn').forEach((btn) => {
      btn.addEventListener('click', () => setLanguage(btn.getAttribute('data-lang') || DEFAULT_LANG));
    });

    setLanguage(initial);
  });
})();
