/* privacy-modal.js — the consent link of the Kapcsolat form ("Adatkezelési tájékoztatót") opens the privacy policy in a modal
   over the form instead of leaving the page, so nothing the visitor typed is lost.
   The policy text has ONE source: adatvedelem.html. Its article (.policy-container, without the h1 and the back button) is fetched
   on the first click and cached. Without JS (or if the fetch fails) the link simply navigates to adatvedelem.html as before.
   The consent checkbox is never touched. Footer links keep opening the separate page. */
(function () {
  'use strict';
  var link = document.querySelector('.contact-consent a[href$="adatvedelem.html"]');
  if (!link) return;

  var url = link.getAttribute('href');
  var modal = null, body = null, opener = null, cache = null, hideTimer = 0, loading = null;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function build() {
    modal = document.createElement('div');
    modal.className = 'modal privacy-modal';
    modal.setAttribute('data-lenis-prevent', '');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'privacyModalTitle');
    modal.innerHTML =
      '<div class="privacy-card">' +
        '<div class="privacy-card__head">' +
          '<h2 id="privacyModalTitle">Adatkezelési tájékoztató</h2>' +
          '<button type="button" class="privacy-card__x" aria-label="Bezárás"><i data-lucide="x" class="icon" aria-hidden="true"></i></button>' +
        '</div>' +
        '<div class="privacy-card__body" data-lenis-prevent tabindex="0"><p class="privacy-card__loading">Betöltés…</p></div>' +
        '<div class="privacy-card__foot"><button type="button" class="modal-close-btn privacy-card__close">Bezárás</button></div>' +
      '</div>';
    document.body.appendChild(modal);
    body = modal.querySelector('.privacy-card__body');
    if (window.lucide) window.lucide.createIcons();
    modal.addEventListener('click', function (e) { if (e.target === modal) close(); });
    modal.querySelector('.privacy-card__x').addEventListener('click', close);
    modal.querySelector('.privacy-card__close').addEventListener('click', close);
  }

  /* the policy article of adatvedelem.html: the section cards and the "Hatályos" line, nothing else */
  function load() {
    if (cache) return Promise.resolve(cache);
    if (loading) return loading;
    loading = fetch(url, { credentials: 'same-origin' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.text();
    }).then(function (html) {
      var doc = new DOMParser().parseFromString(html, 'text/html');
      var art = doc.querySelector('.policy-container');
      if (!art) throw new Error('no article');
      var frag = document.createDocumentFragment();
      Array.prototype.forEach.call(art.children, function (n) {
        if (n.tagName === 'H1' || n.classList.contains('policy-actions') || n.tagName === 'SCRIPT') return;
        frag.appendChild(document.importNode(n, true));
      });
      cache = frag;
      return cache;
    });
    loading.catch(function () { loading = null; });
    return loading;
  }

  function focusables() {
    return Array.prototype.filter.call(modal.querySelectorAll('button, a[href], [tabindex="0"]'), function (el) { return !el.disabled && el.offsetParent !== null; });
  }
  function onKey(e) {
    if (!modal || !modal.classList.contains('is-open')) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
    if (e.key !== 'Tab') return;
    var f = focusables();
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1], a = document.activeElement;
    if (!modal.contains(a)) { e.preventDefault(); first.focus(); }
    else if (e.shiftKey && a === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && a === last) { e.preventDefault(); first.focus(); }
  }

  function open(e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;   /* new-tab clicks keep working */
    e.preventDefault();
    opener = link;
    if (!modal) build();
    clearTimeout(hideTimer);
    modal.classList.remove('is-open');
    modal.style.display = 'flex';
    void modal.offsetWidth;
    modal.classList.add('is-open');
    if (window.VB && window.VB.lenis) window.VB.lenis.stop();
    document.documentElement.classList.add('privacy-open');
    modal.querySelector('.privacy-card__x').focus({ preventScroll: true });
    load().then(function (frag) {
      if (body.querySelector('.policy-section')) return;
      body.textContent = '';
      body.appendChild(frag.cloneNode(true));
      body.scrollTop = 0;
    }).catch(function () {
      window.location.href = url;          /* the text could not be loaded: fall back to the page */
    });
  }

  function close() {
    if (!modal || !modal.classList.contains('is-open')) return;
    modal.classList.remove('is-open');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(function () { modal.style.display = 'none'; }, reduce ? 0 : 300);
    document.documentElement.classList.remove('privacy-open');
    if (window.VB && window.VB.lenis) window.VB.lenis.start();
    if (opener) opener.focus({ preventScroll: true });
  }

  link.addEventListener('click', open);
  document.addEventListener('keydown', onKey, true);
})();
