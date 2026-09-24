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
})();
