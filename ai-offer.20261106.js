/* Functional enquiry context only: no storage, analytics or network requests. */
(function (root) {
  'use strict';
  const doc = root.document;
  const labels = {
    en: { custom: 'Your business workflow', 'invoice-review': 'Invoice review', 'inquiry-routing': 'Inquiry routing', 'order-processing': 'Order processing', 'property-maintenance': 'Maintenance requests' },
    ru: { custom: 'Ваш рабочий процесс', 'invoice-review': 'Проверка счетов', 'inquiry-routing': 'Разбор входящих заявок', 'order-processing': 'Обработка заказов', 'property-maintenance': 'Заявки на обслуживание' }
  };
  const articlePaths = {
    ru: new Set(['/ai-proverka-schetov-postavshchikov/', '/ai-dispetcherskaya-upravlyayushchey-kompanii/', '/ai-proverka-schetov-perevozchikov/', '/ai-kommercheskie-predlozheniya/', '/ai-obrashcheniya-gostey-otelya/']),
    en: new Set(['/ai-inquiry-routing/', '/ai-order-processing/', '/ai-maintenance-triage/', '/ai-crm-integration/', '/ai-invoice-exception-handling/', '/ai-freight-invoice-checks/', '/ai-workflow-pilot/', '/ai-proposal-drafting/', '/ai-automation-maintenance/', '/ai-hotel-guest-requests/'])
  };
  function contextFromURL(value, language) {
    let url;
    try { url = new URL(value, 'https://bornli.com'); } catch { return { service: 'app', workflow: '', article: '', workflow_label: '' }; }
    const service = url.searchParams.get('service') === 'ai' ? 'ai' : 'app';
    const key = url.searchParams.get('workflow');
    const workflow = service === 'ai' ? (Object.hasOwn(labels.en, key) ? key : 'custom') : '';
    const article = service === 'ai' && articlePaths[language === 'ru' ? 'ru' : 'en'].has(url.searchParams.get('article')) ? url.searchParams.get('article') : '';
    return { service, workflow, article, workflow_label: workflow ? labels[language === 'ru' ? 'ru' : 'en'][workflow] : '' };
  }
  if (typeof module === 'object' && module.exports) module.exports = { contextFromURL, labels };
  if (!doc) return;
  const form = doc.querySelector('#brief-form');
  if (!form) return;
  const language = doc.documentElement.lang?.toLowerCase().startsWith('ru') ? 'ru' : 'en';
  const ru = language === 'ru';
  let context = contextFromURL(root.location.href, language);
  let previousAIContext = context.service === 'ai' ? { ...context } : contextFromURL('https://bornli.com/?service=ai&workflow=custom', language);
  const contact = doc.querySelector('#contact');
  const saved = new Map();
  const textNodes = ['#contact-title','[data-offer-contact-description]','.contact-invite-label','.contact-top','[data-offer-form-title]','[data-offer-form-help]','[data-offer-idea-label]','.lead-recipient>div>span','.lead-incoming>p','.contact-form-guide .contact-guide-mobile','[data-offer-contact-cta-label]','[data-offer-guide-button]'];
  for (const selector of textNodes) {
    const element = contact?.querySelector(selector);
    if (element) saved.set(selector, { element, html: element.innerHTML });
  }
  const placeholder = form.elements.idea?.getAttribute('placeholder') || '';
  const pilot = contact?.querySelector('.ai-contact-pilot');
  const note = form.querySelector('.ai-context-note');
  const choices = [...form.querySelectorAll('[data-offer-choice]')];
  // In-contact navigation continues the active enquiry. Only an explicit service
  // switch or an app-acquisition CTA outside this section changes that choice.
  contact?.querySelectorAll('a[data-offer-service]').forEach(link => link.removeAttribute('data-offer-service'));
  function setText(selector, value) { const entry = saved.get(selector); if (entry) entry.element.textContent = value; }
  function refresh() {
    const ai = context.service === 'ai';
    doc.body.dataset.offerService = context.service;
    form.dataset.offerService = context.service;
    choices.forEach(button => { button.setAttribute('aria-pressed', String(button.dataset.offerChoice === context.service)); button.disabled = form.getAttribute('aria-busy') === 'true'; });
    for (const [selector, entry] of saved) {
      // The existing sender owns form headings and help in app/call mode.
      if (!ai && !selector.startsWith('[data-offer-form-')) entry.element.innerHTML = entry.html;
    }
    form.elements.service_type.value = context.service;
    form.elements.workflow.value = context.workflow;
    form.elements.source_article.value = context.article;
    if (note) {
      note.hidden = !ai;
      note.querySelector('strong').textContent = context.workflow_label;
      note.querySelector('span').textContent = ru ? 'Тема уже передана. Добавьте детали, если удобно.' : 'This topic is included. Add details if you like.';
    }
    if (pilot) pilot.hidden = !ai;
    contact?.querySelectorAll('[data-offer-app-only]').forEach(el => { el.hidden = ai; });
    if (!ai) {
      if (form.elements.idea) form.elements.idea.placeholder = placeholder;
      return;
    }
    setText('#contact-title', ru ? 'Разберём ваш процесс.' : 'Let’s scope your workflow.');
    setText('[data-offer-contact-description]', ru ? 'Расскажите, что команда делает вручную и в каких системах работает. Начнём в переписке: уточним задачу, точки проверки человеком и границы первого пилота.' : 'Tell us what your team handles manually and which systems it uses. We’ll start over email to clarify the workflow, human checks and scope of a first pilot.');
    setText('.contact-invite-label', 'AI / ' + (ru ? 'АВТОМАТИЗАЦИЯ ПРОЦЕССОВ' : 'WORKFLOW AUTOMATION'));
    setText('.contact-top', ru ? 'ОДИН ПРОЦЕСС · ПОНЯТНЫЙ ПИЛОТ · КОНТРОЛЬ ЧЕЛОВЕКА' : 'ONE WORKFLOW · A DEFINED PILOT · HUMAN REVIEW');
    setText('[data-offer-contact-cta-label]', ru ? 'Разобрать мой процесс' : 'Scope this workflow');
    setText('[data-offer-guide-button]', ru ? 'Кнопка «Разобрать мой процесс»' : 'Choose “Scope this workflow”');
    setText('[data-offer-idea-label]', ru ? 'Что сейчас делаете вручную?' : 'What does your team do manually?');
    setText('.lead-recipient>div>span', ru ? 'Начнём с вашего процесса' : 'Start with your workflow');
    setText('.lead-incoming>p', ru ? 'Привет! Я Фёдор. Разберём вашу задачу и определим первый пилот.' : 'Tell us about the workflow you want to improve.');
    setText('.contact-form-guide .contact-guide-mobile', ru ? 'Опишите процесс — определим первый шаг ↓' : 'Describe your workflow below.');
    if (form.elements.idea) form.elements.idea.placeholder = ru ? 'Например: переносим счета из почты в 1С, затем проверяем суммы вручную.' : 'For example: we copy requests from email into our CRM and assign them by hand.';
    const call = form.elements.inquiry_type?.value === 'call';
    setText('[data-offer-form-title]', call ? 'Schedule a workflow call' : (ru ? 'Разобрать мой процесс' : 'Scope this workflow'));
    setText('[data-offer-form-help]', ru ? 'Имя и контакт. Описание задачи — по желанию.' : (call ? 'We’ll agree on a time by email. No call is booked yet.' : 'Email first. Name, email and inquiry consent are required.'));
    if (form.getAttribute('aria-busy') !== 'true') {
      const label = form.querySelector('.lead-submit-label');
      if (label) label.textContent = call ? 'Request a workflow call' : (ru ? 'Разобрать мой процесс' : 'Scope this workflow');
    }
    const help = form.querySelector('#lead-contact-help');
    if (help) help.textContent = ru ? 'Ответим здесь, чтобы обсудить процесс.' : (call ? 'For scheduling your workflow call.' : 'For questions and a proposed pilot scope.');
  }
  function choose(service, workflow, article) {
    if (form.getAttribute('aria-busy') === 'true') return;
    if (context.service === 'ai') previousAIContext = { ...context };
    const nextWorkflow = workflow || previousAIContext.workflow || 'custom';
    const nextArticle = article !== undefined ? article : (nextWorkflow === previousAIContext.workflow ? previousAIContext.article : '');
    context = contextFromURL('https://bornli.com/?service=' + encodeURIComponent(service) + '&workflow=' + encodeURIComponent(nextWorkflow) + '&article=' + encodeURIComponent(nextArticle), language);
    if (context.service === 'ai') previousAIContext = { ...context };
    if (service === 'ai' && form.elements.project_package) {
      form.elements.project_package.value = '';
      const selected = form.querySelector('.estimate-selected'); if (selected) selected.hidden = true;
    }
    refresh();
  }
  choices.forEach(button => button.addEventListener('click', () => {
    choose(button.dataset.offerChoice);
    form.dispatchEvent(new CustomEvent('bornli:offerchange', { detail: { ...context } }));
    queueMicrotask(refresh);
  }));
  doc.addEventListener('click', event => {
    const link = event.target.closest?.('a[data-ai-workflow], a[data-offer-service], a[data-project-package], a[data-offer-contact-cta]');
    if (!link || form.getAttribute('aria-busy') === 'true') return;
    if (link.closest('#contact') && !link.hasAttribute('data-ai-workflow')) {
      queueMicrotask(refresh);
      return;
    }
    if (link.hasAttribute('data-ai-workflow')) {
      event.preventDefault();
      choose('ai', link.dataset.aiWorkflow || 'custom');
      form.dispatchEvent(new CustomEvent('bornli:offerchange', { detail: { ...context } }));
      form.scrollIntoView({ behavior: 'instant', block: 'start' });
      const heading = form.querySelector('.lead-fields > h3'); heading?.focus({ preventScroll: true });
    } else {
      choose('app');
      form.dispatchEvent(new CustomEvent('bornli:offerchange', { detail: { ...context } }));
    }
    queueMicrotask(refresh);
  }, true);
  form.addEventListener('change', () => queueMicrotask(refresh));
  // Keep the chosen task after a retry, successful reset, or sending another request.
  form.addEventListener('reset', () => queueMicrotask(refresh));
  root.BORNLIOfferContext = { getContext: () => ({ ...context }), refresh };
  refresh();
})(typeof window !== 'undefined' ? window : globalThis);
