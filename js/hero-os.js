/* hero-os.js — the panels of the hero's "mini OS" (js/hero-window.js loads this file on the FIRST dock open; nothing here runs before that).
   window.HeroOS.open(name, api) fills the glass panel (api.host) with one of: music (a playlist player for the mp3 files in assets/audio/), palette (a generated HSL palette, click = copy HEX),
   mood (re-colours the hero shader + window glow, kept for this session), msg (a tiny contact form to the site's Formspree endpoint).
   The AudioContext is created on the first play click only. Music fades in/out (0.8s), starts only on click (default volume 30%) and stops when the hero leaves the viewport or the tab is hidden. */
(function () {
  'use strict';

  var gsap = (window.VB || {}).gsap;
  var hero = document.getElementById('hero');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var built = {};                                                   /* name -> {el, title} */
  var cur = null, host = null;

  function icons() { if (window.lucide && lucide.createIcons) { try { lucide.createIcons(); } catch (e) { /* ignore */ } } }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

  /* ================================================================ music player (ported from the demo site: #musicCard / .player, js/cards.js)
     PLAYLIST: adding a track = adding one entry { title, artist, src } (mp3 files in assets/audio/, not preloaded: a file is fetched on its first play).
     One AudioContext (created on the first play click): MediaElementSource -> master gain (volume / mute / 0.8s fades) -> AnalyserNode (equaliser) -> output. */
  var PLAYLIST = [
    { title: 'Lo-fi Coding Mix', artist: 'prettyjohn1 · Pixabay', src: 'assets/audio/lofi.mp3' },
    { title: 'Chillhop Jazz Coffee Shop', artist: 'Alex Morgan · Pixabay', src: 'assets/audio/alex-morgan-chillhop-jazz-coffee-shop-552792.mp3' },
    { title: 'Lofi Cocktail Bar', artist: 'Alex Morgan · Pixabay', src: 'assets/audio/alex-morgan-lofi-cocktail-bar-568153.mp3' },
    { title: 'Cruce De Sentimientos', artist: 'Exventry · Pixabay', src: 'assets/audio/exventry-cruce-de-sentimientos-612102.mp3' },
    { title: 'Lofi Beats', artist: 'The Mountain · Pixabay', src: 'assets/audio/the_mountain-lofi-beats-567433.mp3' },
    { title: 'Beautiful Lofi', artist: 'Zephiramusic · Pixabay', src: 'assets/audio/zephiramusic-beautiful-lofi-603162.mp3' },
    { title: 'Blues Lofi', artist: 'Zephiramusic · Pixabay', src: 'assets/audio/zephiramusic-blues-lofi-602637.mp3' },
    { title: 'Lofi House', artist: 'Zephiramusic · Pixabay', src: 'assets/audio/zephiramusic-lofi-house-611107.mp3' }
  ];
  var A = { ctx: null, master: null, an: null, data: null, idx: 0, playing: false, running: false, muted: false, vol: 0.3, audio: null, offTimer: 0, raf: 0, ui: null, err: false };
  var BUCKETS = [[0, 2], [2, 4], [4, 6], [6, 9], [9, 13], [13, 18], [18, 24], [24, 32]];

  function ensureCtx() {
    if (A.ctx) return true;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    var c = A.ctx = new AC();
    A.master = c.createGain(); A.master.gain.value = 0;
    A.an = c.createAnalyser(); A.an.fftSize = 64; A.an.smoothingTimeConstant = 0.75; A.data = new Uint8Array(A.an.frequencyBinCount);
    A.master.connect(A.an); A.an.connect(c.destination);
    return true;
  }
  function ensureFile() {
    if (A.audio) return;
    var a = A.audio = new Audio(); a.preload = 'none';
    var src = A.ctx.createMediaElementSource(a); src.connect(A.master);
    a.addEventListener('ended', function () { go(A.idx + 1, true); });
    a.addEventListener('error', function () { A.err = true; setPlaying(false); A.running = false; });
    a.addEventListener('loadedmetadata', function () { A.err = false; });
  }
  function level() { return A.muted ? 0 : A.vol; }
  function fade() { if (A.ctx) { A.master.gain.cancelScheduledValues(A.ctx.currentTime); A.master.gain.setTargetAtTime(A.playing ? level() : 0, A.ctx.currentTime, 0.27); } }   /* ~0.8s */
  function startTrack() {
    var t = PLAYLIST[A.idx]; A.err = false;
    A.ctx.resume(); ensureFile();
    if (A.audio.getAttribute('data-src') !== t.src) { A.audio.setAttribute('data-src', t.src); A.audio.src = t.src; }     /* the mp3 is fetched on its first play only */
    var p = A.audio.play(); if (p && p.catch) p.catch(function () { A.err = true; setPlaying(false); A.running = false; });
    A.running = true;
  }
  function stopTrack() { if (!A.running) return; if (A.audio) A.audio.pause(); A.running = false; }
  function setPlaying(on) {
    if (on === A.playing) return;
    A.playing = on;
    document.dispatchEvent(new CustomEvent('hero:music', { detail: { playing: on } }));
    ui(); loop(); npUpdate();
  }
  function play() {
    if (!ensureCtx()) return;
    clearTimeout(A.offTimer);
    if (!A.running) startTrack();
    A.playing = false; setPlaying(true); fade();
  }
  function pause() {
    if (!A.playing) return;
    setPlaying(false); fade();
    clearTimeout(A.offTimer);
    A.offTimer = setTimeout(function () { if (!A.playing) { stopTrack(); if (A.ctx && A.ctx.state === 'running') A.ctx.suspend(); } }, 950);
  }
  function go(i, auto) {                                            /* switch track (keeps playing if it was playing) */
    var was = A.playing || auto;
    clearTimeout(A.offTimer);
    stopTrack();
    A.idx = ((i % PLAYLIST.length) + PLAYLIST.length) % PLAYLIST.length; A.err = false;
    ui(); npUpdate();
    if (was) { ensureCtx(); startTrack(); A.playing = false; setPlaying(true); fade(); }
  }
  /* the music keeps playing while the page scrolls (only the user, or a hidden tab, stops it; no automatic resume); off-screen hero -> a tiny "now playing" pill (bottom-left) */
  function stopMusic() { if (A.playing) pause(); }
  document.addEventListener('visibilitychange', function () { if (document.hidden) stopMusic(); });
  var heroVisible = true, np = null, banner = null;
  function npBuild() {
    np = el('div', 'hw-np'); np.setAttribute('role', 'region'); np.setAttribute('aria-label', 'Most szól');
    np.innerHTML = '<span class="hw-np__eq" aria-hidden="true"><i></i><i></i><i></i></span><span class="hw-np__t"></span><button type="button" class="hw-np__b" aria-label="Szünet"><i data-lucide="pause"></i></button>';
    np.querySelector('.hw-np__b').addEventListener('click', function () { pause(); });
    document.body.appendChild(np); icons();
  }
  function npUpdate() {
    var show = A.playing && !heroVisible;
    if (show && !np) npBuild();
    if (!np) return;
    np.querySelector('.hw-np__t').textContent = PLAYLIST[A.idx].title;
    if (show) {
      banner = banner || document.getElementById('cookie-consent-banner');
      var bh = banner && banner.getAttribute('aria-hidden') !== 'true' && banner.getBoundingClientRect().height > 0 ? banner.getBoundingClientRect().height + 16 : 0;      /* above the cookie banner while it is shown */
      np.style.bottom = (16 + bh) + 'px';
    }
    np.classList.toggle('is-on', show);
  }
  if ('IntersectionObserver' in window && hero) new IntersectionObserver(function (es) { heroVisible = es[es.length - 1].isIntersecting; npUpdate(); }).observe(hero);
  window.addEventListener('resize', function () { npUpdate(); });

  function fmt(s) { if (!isFinite(s) || s < 0) s = 0; var m = Math.floor(s / 60), r = Math.floor(s % 60); return m + ':' + (r < 10 ? '0' : '') + r; }
  function pos() {                                                  /* {cur, dur} of the current track */
    var t = PLAYLIST[A.idx], ok = A.audio && A.audio.getAttribute('data-src') === t.src;
    return { cur: ok ? A.audio.currentTime : 0, dur: ok && isFinite(A.audio.duration) ? A.audio.duration : 0 };
  }
  function ui() {
    var U = A.ui; if (!U) return;
    var t = PLAYLIST[A.idx], p = pos();
    U.title.textContent = A.err ? 'Nem tölthető be' : t.title; U.artist.textContent = A.err ? 'Kérjük, próbálja újra' : t.artist;
    U.play.setAttribute('aria-pressed', A.playing ? 'true' : 'false'); U.play.setAttribute('aria-label', A.playing ? 'Szünet' : 'Lejátszás');
    U.mute.setAttribute('aria-pressed', A.muted ? 'true' : 'false');
    var seekable = p.dur > 0;
    U.bar.setAttribute('aria-disabled', seekable ? 'false' : 'true');
    var f = seekable ? Math.min(100, p.cur / p.dur * 100) : 0;
    U.fill.style.width = f + '%'; U.handle.style.insetInlineStart = f + '%'; U.handle.style.visibility = seekable ? '' : 'hidden';
    U.bar.setAttribute('aria-valuenow', String(Math.round(f)));
    U.el.textContent = fmt(p.cur); U.rem.textContent = p.dur ? '-' + fmt(p.dur - p.cur) : '0:00';
  }
  function loop() {
    cancelAnimationFrame(A.raf); A.raf = 0;
    if (!A.ui || cur !== 'music') return;
    var rest = 0;
    var tick = function () {
      A.raf = 0;
      if (cur !== 'music' || !A.ui) return;
      ui();
      var bars = A.ui.bars;
      if (A.ctx && A.playing) {
        A.an.getByteFrequencyData(A.data);
        for (var i = 0; i < 8; i++) { var s = 0, n = 0; for (var k = BUCKETS[i][0]; k < BUCKETS[i][1]; k++) { s += A.data[k]; n++; } bars[i].style.height = Math.max(4, Math.min(32, (s / n / 255) * 1.5 * 32)) + 'px'; }
        rest = 0;
      } else if (rest++ < 20) { for (var j = 0; j < 8; j++) bars[j].style.height = '4px'; }
      if (A.playing || rest < 20) A.raf = requestAnimationFrame(tick);
    };
    A.raf = requestAnimationFrame(tick);
  }
  function seekTo(frac) {
    var t = PLAYLIST[A.idx], p = pos();
    if (!A.audio || !(p.dur > 0)) return;
    A.audio.currentTime = Math.max(0, Math.min(p.dur, frac * p.dur)); ui();
  }

  function buildMusic() {
    var b = el('div', 'hw__pb mp');
    b.innerHTML =
      '<div class="mp__top"><div class="mp__art" aria-hidden="true"><i data-lucide="music-2"></i></div>' +
      '<div class="mp__meta"><p class="mp__title"></p><p class="mp__artist"></p></div>' +
      '<div class="mp__eq" aria-hidden="true">' + new Array(9).join('<span class="mp__eqb"></span>') + '</div></div>' +
      '<div class="mp__prog"><span class="mp__time mp__el">0:00</span>' +
        '<div class="mp__bar" role="slider" tabindex="0" aria-label="Lejátszási pozíció" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" aria-disabled="true"><div class="mp__fill"></div><div class="mp__handle"></div></div>' +
      '<span class="mp__time mp__rem">0:00</span></div>' +
      '<div class="mp__ctl">' +
        '<button type="button" class="mp__btn mp__skip" data-a="prev" aria-label="Előző szám"><i data-lucide="skip-back"></i></button>' +
        '<button type="button" class="mp__btn mp__play" data-a="play" aria-label="Lejátszás" aria-pressed="false"><i data-lucide="play" class="mp__ic-play"></i><i data-lucide="pause" class="mp__ic-pause"></i></button>' +
        '<button type="button" class="mp__btn mp__skip" data-a="next" aria-label="Következő szám"><i data-lucide="skip-forward"></i></button>' +
        '<button type="button" class="mp__btn mp__skip mp__mute" data-a="mute" aria-label="Némítás" aria-pressed="false"><i data-lucide="volume-2" class="mp__ic-on"></i><i data-lucide="volume-x" class="mp__ic-off"></i></button>' +
      '</div>';
    var q = function (s) { return b.querySelector(s); };
    var bar = q('.mp__bar');
    A.ui = { el: q('.mp__el'), rem: q('.mp__rem'), title: q('.mp__title'), artist: q('.mp__artist'), bar: bar, fill: q('.mp__fill'), handle: q('.mp__handle'), play: q('.mp__play'), mute: q('.mp__mute'), bars: [].slice.call(b.querySelectorAll('.mp__eqb')) };
    b.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-a]'); if (!btn) return;
      var a = btn.dataset.a;
      if (a === 'play') { A.playing ? pause() : play(); }
      else if (a === 'prev') go(A.idx - 1); else if (a === 'next') go(A.idx + 1);
      else if (a === 'mute') { A.muted = !A.muted; fade(); ui(); }
    });
    var dragging = false, frac = function (e) { var r = bar.getBoundingClientRect(); return (e.clientX - r.left) / r.width; };
    bar.addEventListener('pointerdown', function (e) { if (bar.getAttribute('aria-disabled') === 'true') return; dragging = true; bar.setPointerCapture(e.pointerId); seekTo(frac(e)); });
    bar.addEventListener('pointermove', function (e) { if (dragging) seekTo(frac(e)); });
    bar.addEventListener('pointerup', function () { dragging = false; }); bar.addEventListener('pointercancel', function () { dragging = false; });
    bar.addEventListener('keydown', function (e) {
      if (bar.getAttribute('aria-disabled') === 'true') return;
      var p = pos(), d = { ArrowLeft: -5, ArrowRight: 5 }[e.key];
      if (d) { e.preventDefault(); seekTo((p.cur + d) / p.dur); } else if (e.key === 'Home') { e.preventDefault(); seekTo(0); } else if (e.key === 'End') { e.preventDefault(); seekTo(1); }
    });
    ui();
    return { el: b, focus: q('.mp__play') };
  }

  /* ================================================================ palette */
  function hex(h, s, l) {
    h = ((h % 360) + 360) % 360; s /= 100; l /= 100;
    var a = s * Math.min(l, 1 - l), f = function (n) { var k = (n + h / 30) % 12, c = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1); var x = Math.round(255 * c).toString(16); return x.length < 2 ? '0' + x : x; };
    return ('#' + f(0) + f(8) + f(4)).toUpperCase();
  }
  function genPalette() {                                           /* harmonious: analogous or triadic from a random base hue */
    var h = Math.random() * 360, tri = Math.random() < 0.5, S = 62 + Math.random() * 16;
    var H = tri ? [h, h + 120, h + 240, h + 60, h + 180] : [h - 40, h - 20, h, h + 20, h + 40];
    var L = tri ? [46, 58, 52, 70, 80] : [34, 46, 56, 68, 80];
    return H.map(function (x, i) { return hex(x, S, L[i]); });
  }
  function buildPalette() {
    var b = el('div', 'hw__pb');
    var sw = el('div', 'hw__sw'), cells = [];
    var toast = el('div', 'hw__toast'); toast.setAttribute('role', 'status');
    var cols = genPalette();
    var paint = function (c) { cells.forEach(function (x, i) { x.style.background = c[i]; x.dataset.hex = c[i]; x.setAttribute('aria-label', 'Szín másolása: ' + c[i]); x.firstChild.textContent = c[i]; }); };
    for (var i = 0; i < 5; i++) { var c = el('button', 'hw__c', '<span></span>'); c.type = 'button'; cells.push(c); sw.appendChild(c); }
    paint(cols);
    var tt = 0;
    var say = function (m) { toast.textContent = m; toast.classList.add('is-on'); clearTimeout(tt); tt = setTimeout(function () { toast.classList.remove('is-on'); }, 1200); };
    cells.forEach(function (c) {
      c.addEventListener('click', function () {
        var h = c.dataset.hex, ok = function () { say('Másolva!'); };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(h).then(ok, function () { fallback(h); ok(); }); else { fallback(h); ok(); }
      });
    });
    function fallback(t) { try { var ta = el('textarea'); ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); } catch (e) { /* ignore */ } }
    var nb = el('button', 'hw__btn', '<i data-lucide="refresh-cw"></i><span>Új paletta</span>'); nb.type = 'button';
    nb.addEventListener('click', function () {
      var n = genPalette();
      if (reduce || !gsap) { paint(n); return; }
      gsap.to(cells, { scaleY: 0.15, rotationX: 70, duration: 0.15, stagger: 0.04, ease: 'power2.in', onComplete: function () { paint(n); gsap.to(cells, { scaleY: 1, rotationX: 0, duration: 0.3, stagger: 0.04, ease: 'back.out(2)', clearProps: 'transform' }); } });
    });
    b.appendChild(sw); b.appendChild(nb); b.appendChild(toast);
    return { el: b, focus: cells[0] };
  }

  /* ================================================================ mood */
  function buildMood() {
    var T = window.HERO_THEMES || {};
    var b = el('div', 'hw__pb hw__mood'); b.setAttribute('role', 'radiogroup'); b.setAttribute('aria-label', 'Hangulat');
    var now = 'night'; try { now = window.sessionStorage.getItem('vb-hero-mood') || 'night'; } catch (e) { /* ignore */ }
    var items = [];
    ['night', 'ocean', 'sunset'].forEach(function (k) {
      var t = T[k]; if (!t) return;
      var r = el('button', 'hw__opt', '<span class="hw__dots3">' + t.sw.map(function (c) { return '<i style="background:' + c + '"></i>'; }).join('') + '</span><span class="hw__ol">' + t.label + '</span>');
      r.type = 'button'; r.setAttribute('role', 'radio'); r.dataset.k = k;
      r.addEventListener('click', function () {
        items.forEach(function (x) { x.setAttribute('aria-checked', x === r ? 'true' : 'false'); });
        try { window.sessionStorage.setItem('vb-hero-mood', k); } catch (e) { /* ignore */ }
        document.dispatchEvent(new CustomEvent('hero:theme', { detail: { name: k } }));
      });
      items.push(r); b.appendChild(r);
    });
    items.forEach(function (x) { x.setAttribute('aria-checked', x.dataset.k === now ? 'true' : 'false'); });
    return { el: b, focus: items[0] };
  }

  /* ================================================================ message */
  function buildMsg() {
    var b = el('div', 'hw__pb');
    var f = el('form', 'hw__form');
    f.setAttribute('novalidate', '');
    f.innerHTML = '<textarea name="message" rows="3" required placeholder="Írjon pár sort…" aria-label="Üzenet"></textarea>' +
      '<input type="email" name="email" placeholder="E-mail (válaszhoz)" aria-label="E-mail (válaszhoz)" autocomplete="email">' +
      '<input type="text" name="_gotcha" tabindex="-1" autocomplete="off" class="hw__hp" aria-hidden="true">' +
      '<input type="hidden" name="_subject" value="Üzenet a hero mini rendszerből">' +
      '<button type="submit" class="hw__btn hw__btn--go"><i data-lucide="send"></i><span>Küldés</span></button>' +
      '<p class="hw__note">Az üzenet elküldésével elfogadja az <a href="adatvedelem.html" target="_blank" rel="noopener">Adatkezelési tájékoztatót</a>.</p>' +
      '<p class="hw__st" role="status"></p>';
    var st = f.querySelector('.hw__st'), go = f.querySelector('.hw__btn--go'), ta = f.querySelector('textarea');
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!ta.value.trim()) { st.textContent = 'Kérjük, írjon néhány sort.'; st.className = 'hw__st is-err'; ta.focus(); return; }
      st.textContent = ''; st.className = 'hw__st';
      var fd = new FormData(f), els = [].slice.call(f.elements);
      els.forEach(function (x) { x.disabled = true; }); go.querySelector('span').textContent = 'Küldés…';
      var fail = function () { els.forEach(function (x) { x.disabled = false; }); go.querySelector('span').textContent = 'Küldés'; st.textContent = 'Nem sikerült elküldeni. Kérjük, próbálja újra később.'; st.className = 'hw__st is-err'; };
      fetch('https://formspree.io/f/xeerdkob', { method: 'POST', body: fd, headers: { Accept: 'application/json' } }).then(function (r) {
        if (!r.ok) throw new Error('http ' + r.status);
        f.reset(); els.forEach(function (x) { x.disabled = false; }); go.querySelector('span').textContent = 'Küldés';
        b.classList.add('is-done'); b.innerHTML = '<div class="hw__ok" role="status"><i data-lucide="check"></i><p>Köszönöm! Hamarosan válaszolok.</p></div>'; icons();
      }).catch(fail);
    });
    b.appendChild(f);
    return { el: b, focus: ta };
  }

  var BUILD = { music: ['Zene', buildMusic], palette: ['Paletta', buildPalette], mood: ['Hangulat', buildMood], msg: ['Üzenet', buildMsg] };

  window.HeroOS = {
    open: function (name, api) {
      if (!BUILD[name]) return;
      if (cur === 'music' && name !== 'music') { /* the music keeps playing; only the equalizer loop stops */ }
      cur = name; host = api.host;
      if (!built[name]) { var r = BUILD[name][1](); built[name] = r; }
      var bare = name === 'music';
      host.classList.toggle('is-bare', bare);
      var head = el('div', 'hw__ph', bare ? '' : '<span class="hw__pt">' + BUILD[name][0] + '</span>');
      var x = el('button', 'hw__px', '<i data-lucide="x"></i>'); x.type = 'button'; x.setAttribute('aria-label', 'Panel bezárása');
      x.addEventListener('click', function () { api.close(); });
      host.innerHTML = '';
      if (bare) { x.classList.add('hw__px--float'); host.appendChild(built[name].el); host.appendChild(x); } else { head.appendChild(x); host.appendChild(head); host.appendChild(built[name].el); }
      host.setAttribute('aria-label', BUILD[name][0]);
      icons();
      if (name === 'music') { ui(); loop(); }
      var f = built[name].focus; if (f && f.focus) setTimeout(function () { try { f.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }, 60);
    },
    closed: function (name) { cur = null; cancelAnimationFrame(A.raf); },
    audio: function () { var p = pos(); return { playing: A.playing, state: A.ctx && A.ctx.state, idx: A.idx, track: PLAYLIST[A.idx].title, cur: p.cur, dur: p.dur, muted: A.muted, vol: A.vol, bars: A.ui && A.ui.bars.map(function (b) { return b.style.height; }) }; }
  };
})();
