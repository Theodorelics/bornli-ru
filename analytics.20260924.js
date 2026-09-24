(() => {
  'use strict';

  const counterId = 113016876;
  const storageKey = 'bornli_analytics_consent_v1';
  const panel = document.getElementById('analytics-consent');
  const settings = document.getElementById('analytics-settings');
  const accept = document.getElementById('analytics-accept');
  const decline = document.getElementById('analytics-decline');
  if (!panel || !settings || !accept || !decline) return;

  let choice = null;
  try { choice = localStorage.getItem(storageKey); } catch (_) {}

  function loadMetrica() {
    if (typeof window.ym === 'function') return;
    window.ym = window.ym || function () {
      (window.ym.a = window.ym.a || []).push(arguments);
    };
    window.ym.l = Date.now();
    const tag = document.createElement('script');
    tag.async = true;
    tag.src = `https://mc.yandex.ru/metrika/tag.js?id=${counterId}`;
    document.head.appendChild(tag);
    window.ym(counterId, 'init', {
      clickmap: true,
      trackLinks: true,
      accurateTrackBounce: true,
      webvisor: false
    });
  }

  function showPanel() {
    panel.hidden = false;
    settings.setAttribute('aria-expanded', 'true');
  }

  function hidePanel() {
    panel.hidden = true;
    settings.setAttribute('aria-expanded', 'false');
  }

  function setChoice(value) {
    const wasAccepted = choice === 'yes';
    choice = value;
    try { localStorage.setItem(storageKey, value); } catch (_) {}
    hidePanel();
    if (value === 'yes') loadMetrica();
    else if (wasAccepted) location.reload();
  }

  accept.addEventListener('click', () => setChoice('yes'));
  decline.addEventListener('click', () => setChoice('no'));
  settings.addEventListener('click', () => {
    if (panel.hidden) showPanel();
    else hidePanel();
  });
  window.addEventListener('bornli:lead-confirmed', () => {
    if (choice === 'yes' && typeof window.ym === 'function') {
      window.ym(counterId, 'reachGoal', 'lead_submitted');
    }
  });

  if (choice === 'yes') loadMetrica();
  else if (choice !== 'no') showPanel();
})();
