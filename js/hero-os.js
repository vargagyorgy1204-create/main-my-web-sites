/* hero-os.js — the panels of the hero's "mini OS" (js/hero-window.js loads this file on the FIRST dock open; nothing here runs before that).
   window.HeroOS.open(name, api) fills the glass panel (api.host) with one of: music (a generated ambient pad, Web Audio only, no audio files), palette (a generated HSL palette, click = copy HEX),
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

  /* ================================================================ music: generated ambient pad */
  var A = { ctx: null, master: null, an: null, oscs: [], lfo: null, playing: false, vol: 0.3, step: 0, chordTimer: 0, offTimer: 0, raf: 0, bars: null, btn: null, data: null };
  var CHORDS = [[110.0, 164.81, 261.63, 392.0], [87.31, 174.61, 261.63, 329.63], [130.81, 196.0, 246.94, 329.63], [98.0, 196.0, 293.66, 329.63]];     /* Am7, Fmaj7, Cmaj7, G6/9 */
  function ensureAudio() {
    if (A.ctx) return true;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    var c = A.ctx = new AC();
    A.master = c.createGain(); A.master.gain.value = 0;
    A.an = c.createAnalyser(); A.an.fftSize = 64; A.an.smoothingTimeConstant = 0.8; A.data = new Uint8Array(A.an.frequencyBinCount);
    var lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 760; lp.Q.value = 0.6;
    A.lfo = c.createOscillator(); A.lfo.frequency.value = 0.07; var lg = c.createGain(); lg.gain.value = 260; A.lfo.connect(lg); lg.connect(lp.frequency); A.lfo.start();
    CHORDS[0].forEach(function (f, i) {                              /* 4 voices x 2 detuned oscillators */
      [-6, 6].forEach(function (d) {
        var o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = d;
        var g = c.createGain(); g.gain.value = 0.055; o.connect(g); g.connect(lp); o.start(); o._v = i; A.oscs.push(o);
      });
    });
    var dry = c.createGain(); dry.gain.value = 0.75; lp.connect(dry); dry.connect(A.master);
    var dl = c.createDelay(1); dl.delayTime.value = 0.41; var fb = c.createGain(); fb.gain.value = 0.42; var dlp = c.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 1800;
    var wet = c.createGain(); wet.gain.value = 0.5;
    lp.connect(dl); dl.connect(dlp); dlp.connect(fb); fb.connect(dl); dlp.connect(wet); wet.connect(A.master);     /* soft feedback delay = a cheap reverb tail */
    A.master.connect(A.an); A.an.connect(c.destination);
    return true;
  }
  function chord() {                                                /* a gentle progression, one chord per ~8s (glides) */
    var ch = CHORDS[A.step % CHORDS.length]; A.step++;
    var t = A.ctx.currentTime;
    A.oscs.forEach(function (o) { o.frequency.setTargetAtTime(ch[o._v], t, 1.2); });
  }
  function setPlay(on) {
    if (on === A.playing) return;
    if (on) {
      if (!ensureAudio()) return;
      clearTimeout(A.offTimer);
      A.ctx.resume();
      A.playing = true;
      A.master.gain.cancelScheduledValues(A.ctx.currentTime); A.master.gain.setTargetAtTime(A.vol * 0.5, A.ctx.currentTime, 0.27);    /* ~0.8s fade in */
      chord(); A.chordTimer = setInterval(chord, 8000);
    } else {
      A.playing = false;
      clearInterval(A.chordTimer);
      if (A.ctx) { A.master.gain.cancelScheduledValues(A.ctx.currentTime); A.master.gain.setTargetAtTime(0, A.ctx.currentTime, 0.27); A.offTimer = setTimeout(function () { if (!A.playing && A.ctx.state === 'running') A.ctx.suspend(); }, 1000); }
    }
    playUI(); eqLoop();
  }
  function playUI() {
    if (!A.btn) return;
    A.btn.setAttribute('aria-label', A.playing ? 'Szünet' : 'Lejátszás'); A.btn.setAttribute('aria-pressed', A.playing ? 'true' : 'false');
    A.btn.innerHTML = '<i data-lucide="' + (A.playing ? 'pause' : 'play') + '"></i>'; icons();
  }
  function eqLoop() {
    cancelAnimationFrame(A.raf); A.raf = 0;
    if (!A.bars || cur !== 'music') return;
    var tick = function () {
      A.raf = 0;
      if (cur !== 'music' || !A.bars) return;
      var v = [0.12, 0.12, 0.12, 0.12, 0.12];
      if (A.ctx && A.playing) { A.an.getByteFrequencyData(A.data); for (var i = 0; i < 5; i++) { var s = 0, n = 0; for (var k = 1 + i * 2; k < 3 + i * 2; k++) { s += A.data[k]; n++; } v[i] = Math.max(0.12, Math.min(1, (s / n / 255) * 1.7)); } }
      for (var j = 0; j < 5; j++) A.bars[j].style.transform = 'scaleY(' + v[j].toFixed(3) + ')';
      if (A.playing || A.bars[0].dataset.settle !== '1') A.raf = requestAnimationFrame(tick);
      A.bars[0].dataset.settle = A.playing ? '0' : '1';
    };
    A.raf = requestAnimationFrame(tick);
  }
  function stopMusic() { if (A.playing) setPlay(false); }
  if ('IntersectionObserver' in window && hero) new IntersectionObserver(function (es) { if (!es[es.length - 1].isIntersecting) stopMusic(); }).observe(hero);
  document.addEventListener('visibilitychange', function () { if (document.hidden) stopMusic(); });

  function buildMusic() {
    var b = el('div', 'hw__pb');
    var row = el('div', 'hw__row');
    var btn = el('button', 'hw__play'); btn.type = 'button'; A.btn = btn;
    var info = el('div', 'hw__tr', '<strong>VarBro Focus</strong><span>Nyugodt ambient · generált</span>');
    row.appendChild(btn); row.appendChild(info);
    var bars = el('div', 'hw__eq'); bars.setAttribute('aria-hidden', 'true'); A.bars = [];
    for (var i = 0; i < 5; i++) { var bar = el('i'); bars.appendChild(bar); A.bars.push(bar); }
    var vol = el('label', 'hw__vol', '<span>Hangerő</span>');
    var rng = el('input'); rng.type = 'range'; rng.min = 0; rng.max = 100; rng.value = Math.round(A.vol * 100); rng.setAttribute('aria-label', 'Hangerő');
    rng.addEventListener('input', function () { A.vol = rng.value / 100; if (A.ctx && A.playing) A.master.gain.setTargetAtTime(A.vol * 0.5, A.ctx.currentTime, 0.1); });
    vol.appendChild(rng);
    btn.addEventListener('click', function () { setPlay(!A.playing); });
    b.appendChild(row); b.appendChild(bars); b.appendChild(vol);
    playUI();
    return { el: b, focus: btn };
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
      var head = el('div', 'hw__ph', '<span class="hw__pt">' + BUILD[name][0] + '</span>');
      var x = el('button', 'hw__px', '<i data-lucide="x"></i>'); x.type = 'button'; x.setAttribute('aria-label', 'Panel bezárása');
      x.addEventListener('click', function () { api.close(); });
      head.appendChild(x);
      host.innerHTML = ''; host.appendChild(head); host.appendChild(built[name].el);
      host.setAttribute('aria-label', BUILD[name][0]);
      icons();
      if (name === 'music') { playUI(); eqLoop(); }
      var f = built[name].focus; if (f && f.focus) setTimeout(function () { try { f.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }, 60);
    },
    closed: function (name) { if (name === 'music') { cur = null; cancelAnimationFrame(A.raf); } else cur = null; },
    audio: function () { return { playing: A.playing, state: A.ctx && A.ctx.state, vol: A.vol, bars: A.bars && A.bars.map(function (b) { return b.style.transform; }) }; }
  };
})();
