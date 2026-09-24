(() => {
  const contact = document.querySelector('#contact');
  const toggle = contact?.querySelector('.form-mode-toggle');
  if (contact && toggle) {
    const buttons = [...toggle.querySelectorAll('[data-form-mode]')];
    buttons.forEach(button => button.addEventListener('click', () => {
      const plain = button.dataset.formMode === 'plain';
      contact.classList.toggle('form-mode-plain', plain);
      buttons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    }));
  }

  const rows = [...document.querySelectorAll('#process-list .process-row')];
  const mobile = matchMedia('(max-width: 700px)');
  if (rows.length && 'IntersectionObserver' in window) {
    const sync = () => rows.forEach(row => {
      if (mobile.matches && row.dataset.manual !== 'true') {
        row.open = true;
        row.dataset.mobileOpened = 'true';
      } else if (!mobile.matches && row.dataset.mobileOpened === 'true') {
        row.open = false;
        delete row.dataset.mobileOpened;
      }
    });
    sync();
    mobile.addEventListener('change', sync);
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('mobile-visual-in-view');
        observer.unobserve(entry.target);
      }
    }), { rootMargin: '0px 0px -10% 0px', threshold: 0.08 });
    rows.forEach(row => observer.observe(row.querySelector('.process-visual')));
  }

  // Sticky case cards keep their viewport position after the user scrolls past them.
  // Native fragment navigation then mistakes that pinned position for the card's start.
  const stack = document.querySelector('#case-stack');
  const cards = stack ? [...stack.querySelectorAll(':scope > .case-card')] : [];
  const cardIds = new Set(cards.map(card => card.id));
  const caseIdFromHash = () => {
    try { return decodeURIComponent(location.hash.slice(1)); }
    catch { return ''; }
  };
  const scrollToCase = (id, behavior = 'smooth') => {
    const index = cards.findIndex(card => card.id === id);
    if (index < 0) return;
    const stackTop = stack.getBoundingClientRect().top + scrollY;
    const precedingHeight = cards.slice(0, index).reduce((total, card) =>
      total + card.offsetHeight + Number.parseFloat(getComputedStyle(card).marginBottom || '0'), 0);
    const pinnedTop = Number.parseFloat(getComputedStyle(cards[index]).top) || 0;
    window.scrollTo({ top: Math.max(0, stackTop + precedingHeight - pinnedTop), behavior });
  };
  if (cards.length) {
    document.querySelectorAll('a[href^="#case-"]').forEach(link => {
      const id = link.getAttribute('href').slice(1);
      if (!cardIds.has(id)) return;
      link.addEventListener('click', event => {
        event.preventDefault();
        history.pushState(null, '', `#${id}`);
        scrollToCase(id, matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth');
      });
    });
    const restoreCaseHash = () => {
      const id = caseIdFromHash();
      if (cardIds.has(id)) requestAnimationFrame(() => requestAnimationFrame(() => scrollToCase(id, 'instant')));
    };
    if (document.readyState === 'complete') restoreCaseHash();
    else addEventListener('load', restoreCaseHash, { once: true });
    addEventListener('hashchange', restoreCaseHash);
  }
})();
