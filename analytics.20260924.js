(function (root) {
  'use strict';
  const counterId = 113016876;
  const storageKey = 'bornli_analytics_consent_v1';
  const attributionKey = 'bornli_ru_attribution_v1';
  const attributionTTL = 30 * 86400000;
  const fields = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
    'campaign_id', 'adgroup_id', 'ad_id', 'phrase_id', 'match_type', 'network', 'device',
    'region_id', 'position', 'position_type', 'yclid', 'msclkid'];
  const allowedEvents = new Set(['lead_form_start', 'lead_submit_attempt', 'lead_submit_error',
    'lead_submitted', 'contact_phone_click']);

  function pickAttribution(search) {
    const params = new URLSearchParams(search || '');
    const result = {};
    fields.forEach(key => {
      const value = String(params.get(key) || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 200);
      if (!value || /\{[^}]+\}/.test(value)) return; // Unexpanded ad macros are not attribution.
      if (key === 'yclid' && !/^\d{1,30}$/.test(value)) return;
      if (key === 'msclkid' && !/^[a-f0-9]{32}$/i.test(value)) return;
      result[key] = value;
    });
    return result;
  }
  if (typeof module === 'object' && module.exports) module.exports = {pickAttribution};
  if (!root.document) return;
  const doc = root.document;
  const isTest = new URLSearchParams(root.location.search).get('qa') === '1' ||
    ['localhost', '127.0.0.1'].includes(root.location.hostname);
  const read = key => { try { return root.localStorage.getItem(key); } catch { return null; } };
  const write = (key, value) => { try { root.localStorage.setItem(key, value); } catch {} };
  const remove = key => { try { root.localStorage.removeItem(key); } catch {} };
  let choice = read(storageKey);
  if (!['yes', 'no'].includes(choice)) choice = null;
  let saved;
  try { saved = choice === 'yes' ? JSON.parse(read(attributionKey)) : null; } catch {}
  const current = pickAttribution(root.location.search);
  const hasCampaign = Object.keys(current).length > 0;
  let previousCampaign = saved && Date.now() - saved.at >= 0 && Date.now() - saved.at < attributionTTL
    ? {at: saved.at, value: pickAttribution(new URLSearchParams(saved.value).toString())} : null;
  let referrerHost = '';
  try {
    const referrer = new URL(doc.referrer);
    if (referrer.hostname !== root.location.hostname) referrerHost = referrer.hostname.slice(0, 200);
  } catch {}
  // Never combine fields from different clicks. Historical attribution requires consent.
  function getAttribution() {
    const campaign = hasCampaign ? current : choice === 'yes' && !referrerHost ? previousCampaign?.value || {} : {};
    return {...campaign,
      source_type: Object.keys(campaign).length ? 'campaign' : referrerHost ? 'referral' : 'direct_or_unknown',
      attribution_scope: hasCampaign || referrerHost || !Object.keys(campaign).length ? 'current_visit' : 'last_campaign_30d',
      landing_path: root.location.pathname.slice(0, 200),
      ...(referrerHost ? {referrer_host: referrerHost} : {})};
  }
  function rememberAttribution() {
    if (choice !== 'yes' || isTest) return;
    if (hasCampaign) write(attributionKey, JSON.stringify({at: Date.now(), value: current}));
    else if (referrerHost) { previousCampaign = null; remove(attributionKey); }
  }
  const panel = doc.getElementById('analytics-consent');
  const settings = doc.getElementById('analytics-settings');
  let loaded = false;
  function loadMetrica() {
    if (choice !== 'yes' || isTest || loaded) return;
    loaded = true;
    if (typeof root.ym !== 'function') {
      root.ym = function () { (root.ym.a = root.ym.a || []).push(arguments); };
      root.ym.l = Date.now();
      const tag = doc.createElement('script');
      tag.async = true;
      tag.src = `https://mc.yandex.ru/metrika/tag.js?id=${counterId}`;
      doc.head.appendChild(tag);
    }
    root.ym(counterId, 'init', {clickmap: true, trackLinks: true, accurateTrackBounce: true, webvisor: false});
  }
  function emit(event, properties = {}) {
    if (choice !== 'yes' || !allowedEvents.has(event)) return false;
    // No field contents, contacts, lead IDs or click IDs in analytics events.
    const safe = {site: 'bornli_ru'};
    if (['validation', 'timeout', 'http', 'unconfirmed', 'network'].includes(properties.error_type)) safe.error_type = properties.error_type;
    if (isTest) { root.console?.info('[BORNLI QA] ' + event + ' ' + JSON.stringify(safe)); return true; }
    try { loadMetrica(); root.ym(counterId, 'reachGoal', event, safe); return true; } catch { return false; }
  }
  function showPanel() { if (panel) panel.hidden = false; settings?.setAttribute('aria-expanded', 'true'); }
  function hidePanel() { if (panel) panel.hidden = true; settings?.setAttribute('aria-expanded', 'false'); }
  function setChoice(value) {
    const wasAccepted = choice === 'yes';
    choice = value === 'yes' ? 'yes' : 'no';
    write(storageKey, choice); hidePanel();
    if (choice === 'yes') { rememberAttribution(); loadMetrica(); }
    else { previousCampaign = null; remove(attributionKey); if (wasAccepted && !isTest) root.location.reload(); }
  }
  doc.getElementById('analytics-accept')?.addEventListener('click', () => setChoice('yes'));
  doc.getElementById('analytics-decline')?.addEventListener('click', () => setChoice('no'));
  settings?.addEventListener('click', () => panel?.hidden ? showPanel() : hidePanel());
  root.addEventListener('bornli:lead-confirmed', () => emit('lead_submitted'));

  let started = false, invalidBatch = false;
  doc.addEventListener('input', event => {
    if (started || !event.target.closest?.('#brief-form') || !['name', 'contact', 'idea'].includes(event.target.name) || !event.target.value.trim()) return;
    started = emit('lead_form_start');
  });
  doc.addEventListener('invalid', event => {
    if (invalidBatch || !event.target.closest?.('#brief-form')) return;
    invalidBatch = true; emit('lead_submit_error', {error_type: 'validation'});
    root.setTimeout(() => { invalidBatch = false; }, 0);
  }, true);
  doc.addEventListener('click', event => {
    if (event.target.closest?.('.lead-another')) started = false;
    const link = event.target.closest?.('a[href]');
    if (link?.href.startsWith('tel:')) emit('contact_phone_click');
    // Telegram / WhatsApp use the existing native messenger goals in this counter.
  });
  root.BORNLIAnalytics = {emit, isTest, getAttribution, getConsent: () => choice === 'yes', counterId};
  rememberAttribution();
  if (choice === 'yes') loadMetrica();
  else if (choice !== 'no') showPanel();
})(typeof window !== 'undefined' ? window : globalThis);
