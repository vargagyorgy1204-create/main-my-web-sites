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
  A.session = false; A.lv = [0, 0, 0, 0, 0, 0, 0, 0]; A.avg = [0, 0, 0, 0, 0, 0, 0, 0]; A.peak = 0.5;

  function ensureCtx() {
    if (A.ctx) return true;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    var c = A.ctx = new AC();
    A.master = c.createGain(); A.master.gain.value = 0;
    A.an = c.createAnalyser(); A.an.fftSize = 1024; A.an.smoothingTimeConstant = 0.5; A.data = new Uint8Array(A.an.frequencyBinCount);
    A.an.connect(A.master); A.master.connect(c.destination);
    var bw = c.sampleRate / A.an.fftSize, f1 = Math.min(14000, c.sampleRate * 0.45); A.edges = [];
    for (var i = 0; i <= 8; i++) { var e = Math.max(1, Math.round(40 * Math.pow(f1 / 40, i / 8) / bw)); if (i && e <= A.edges[i - 1]) e = A.edges[i - 1] + 1; A.edges.push(e); }      /* 8 log-spaced bands, 40 Hz -> 14 kHz */
    return true;
  }
  function ensureFile() {
    if (A.audio) return;
    var a = A.audio = new Audio(); a.preload = 'none';
    var src = A.ctx.createMediaElementSource(a); src.connect(A.an);
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
    ui(); vizRun(); fmUpdate();
  }
  function play() {
    if (!ensureCtx()) return;
    clearTimeout(A.offTimer);
    if (!A.running) startTrack();
    A.session = true; A.playing = false; setPlaying(true); fade();
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
    ui(); fmUpdate();
    if (was) { ensureCtx(); startTrack(); A.playing = false; setPlaying(true); fade(); }
  }
  /* the music keeps playing while the page scrolls and while the tab is hidden (only the user stops it); the rAF visualisers rest while the tab is hidden.
     While the hero is out of view a floating music button (bottom-left, under the header logo) gives control from anywhere. */
  function stopFull() {                                             /* stop = pause + back to the start + hide the floating button */
    var was = A.playing; A.session = false;
    if (was) pause();
    clearTimeout(A.offTimer);
    A.offTimer = setTimeout(function () { stopTrack(); if (A.audio) { try { A.audio.currentTime = 0; } catch (e) { /* ignore */ } } if (A.ctx && A.ctx.state === 'running') A.ctx.suspend(); ui(); }, was ? 950 : 0);
    fmUpdate();
  }
  var heroVisible = true, fm = null, banner = null;
  function fmBuild() {
    fm = el('div', 'hw-fm'); fm.setAttribute('role', 'group'); fm.setAttribute('aria-label', 'Zene vezérlők');
    fm.innerHTML = '<div class="hw-fm__btns"><button type="button" data-f="play" aria-label="Szünet"><i data-lucide="pause"></i></button><button type="button" data-f="next" aria-label="Következő szám"><i data-lucide="skip-forward"></i></button><button type="button" data-f="stop" aria-label="Leállítás"><i data-lucide="square"></i></button></div>' +
      '<button type="button" class="hw-fm__eq" aria-label="Zene vezérlők" aria-expanded="false"><span class="hw-fm__bars" aria-hidden="true"><i></i><i></i><i></i><i></i></span></button>';
    fm.addEventListener('click', function (e) {
      var b = e.target.closest('[data-f]');
      if (b) { var f = b.dataset.f; if (f === 'play') { A.playing ? pause() : play(); } else if (f === 'next') go(A.idx + 1); else if (f === 'stop') { stopFull(); fm.classList.remove('is-open'); } return; }
      if (e.target.closest('.hw-fm__eq')) { var o = fm.classList.toggle('is-open'); fm.querySelector('.hw-fm__eq').setAttribute('aria-expanded', o ? 'true' : 'false'); }          /* tap */
    });
    document.addEventListener('pointerdown', function (e) { if (fm && fm.classList.contains('is-open') && !fm.contains(e.target)) { fm.classList.remove('is-open'); fm.querySelector('.hw-fm__eq').setAttribute('aria-expanded', 'false'); } });
    document.body.appendChild(fm); icons();
  }
  function fmPlace() {
    var lg = document.querySelector('.nav__logo'), r = lg ? lg.getBoundingClientRect() : { left: 20, width: 44, top: 20 };
    banner = banner || document.getElementById('cookie-consent-banner');
    var bh = banner && banner.getAttribute('aria-hidden') !== 'true' && banner.getBoundingClientRect().height > 0 ? banner.getBoundingClientRect().height + 16 : 0;        /* above the cookie banner while it is shown */
    fm.style.left = Math.round(r.left + r.width / 2 - 24) + 'px'; fm.style.bottom = (Math.round(r.top) + bh) + 'px';                                                       /* same x-centre as the logo, bottom margin = the header's top margin */
  }
  function fmUpdate() {
    var show = A.session && !heroVisible;
    if (show && !fm) fmBuild();
    if (!fm) return;
    var pb = fm.querySelector('[data-f="play"]'), pl = A.playing;
    if (pb.dataset.s !== (pl ? '1' : '0')) { pb.dataset.s = pl ? '1' : '0'; pb.setAttribute('aria-label', pl ? 'Szünet' : 'Lejátszás'); pb.innerHTML = '<i data-lucide="' + (pl ? 'pause' : 'play') + '"></i>'; icons(); }
    if (show) fmPlace();
    fm.classList.toggle('is-on', show);
    if (!show) fm.classList.remove('is-open');
  }
  if ('IntersectionObserver' in window && hero) new IntersectionObserver(function (es) { heroVisible = es[es.length - 1].isIntersecting; fmUpdate(); }).observe(hero);
  window.addEventListener('resize', function () { fmUpdate(); });

  /* ---- visualisers: real audio (AnalyserNode), 8 log-spaced bands, attack ~0.4 / release ~0.12 per frame, a slight gain + auto-level so quiet tracks still move; rAF only while playing (and the tab is visible) */
  function vizRun() { if (!A.raf && !document.hidden) A.raf = requestAnimationFrame(vizTick); }
  function vizTick() {
    A.raf = 0;
    if (document.hidden) return;
    var lv = A.lv, i, k, live = A.ctx && A.playing;
    if (live) {
      A.an.getByteFrequencyData(A.data);
      var mx = 0, raw = [];
      for (i = 0; i < 8; i++) { var sum = 0, m = 0, n = A.edges[i + 1] - A.edges[i]; for (k = A.edges[i]; k < A.edges[i + 1]; k++) { sum += A.data[k]; if (A.data[k] > m) m = A.data[k]; } var r = (0.55 * m + 0.45 * sum / n) / 255; raw.push(r); if (r > mx) mx = r; }
      A.warm = A.warm || (A.warm0 = (A.warm0 || 0) + 1) > 6;          /* the first frames only learn the average (no start-up burst) */
      A.peak = Math.max(mx, A.peak * 0.996, 0.4);                  /* auto-level: quiet tracks still move, loud ones do not stick at the top */
      for (i = 0; i < 8; i++) {                                     /* level = a body part (relative to the loudest band) + a "punch" part (how far the band jumps above its own slow average): kicks / snares clearly pulse */
        var base = Math.pow(Math.max(0, raw[i] / A.peak - 0.35) / 0.65, 1.8), punch = Math.max(0, raw[i] - A.avg[i]) / (0.2 * A.peak);
        if (!A.warm) A.avg[i] = raw[i]; else A.avg[i] += (raw[i] - A.avg[i]) * 0.03;
        var x = Math.min(1, 0.45 * base + 0.9 * punch); lv[i] += (x - lv[i]) * (x > lv[i] ? 0.4 : 0.12);
      }
    } else { for (i = 0; i < 8; i++) lv[i] += (0 - lv[i]) * 0.12; }
    var rest = true; for (i = 0; i < 8; i++) if (lv[i] > 0.02) rest = false;
    if (A.ui) for (i = 0; i < 8; i++) A.ui.bars[i].style.height = (4 + lv[i] * 28).toFixed(1) + 'px';
    if (!mini) mini = document.querySelector('.hw__mini');
    if (mini) { mini.classList.add('is-live'); var mb = mini.children, g = [(lv[0] + lv[1]) / 2, (lv[3] + lv[4]) / 2, (lv[6] + lv[7]) / 2]; for (i = 0; i < 3; i++) mb[i].style.transform = 'scaleY(' + (0.25 + 0.75 * g[i]).toFixed(3) + ')'; }
    if (fm) { var fb = fm.querySelector('.hw-fm__bars').children, g4 = [(lv[0] + lv[1]) / 2, (lv[2] + lv[3]) / 2, (lv[4] + lv[5]) / 2, (lv[6] + lv[7]) / 2]; for (i = 0; i < 4; i++) fb[i].style.transform = 'scaleY(' + (0.2 + 0.8 * g4[i]).toFixed(3) + ')'; }
    A.frames = (A.frames || 0) + 1;
    if (cur === 'music') ui();
    if (!rest || live) A.raf = requestAnimationFrame(vizTick);
  }
  var mini = null;
  document.addEventListener('visibilitychange', function () { if (!document.hidden) vizRun(); });

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

  /* ================================================================ palette: designer-like generated palettes, an elegant card, "Kipróbálom" applies it to the living window */
  function hex(h, s, l) {
    h = ((h % 360) + 360) % 360; s /= 100; l /= 100;
    var a = s * Math.min(l, 1 - l), f = function (n) { var k = (n + h / 30) % 12, c = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1); var x = Math.round(255 * c).toString(16); return x.length < 2 ? '0' + x : x; };
    return ('#' + f(0) + f(8) + f(4)).toUpperCase();
  }
  function rgbOf(h) { return [parseInt(h.substr(1, 2), 16), parseInt(h.substr(3, 2), 16), parseInt(h.substr(5, 2), 16)]; }
  function lumOf(c) { var f = function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); }
  function contrast(a, b) { var x = lumOf(a), y = lumOf(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
  function satOf(c) { var mx = Math.max(c[0], c[1], c[2]), mn = Math.min(c[0], c[1], c[2]); return mx === 0 ? 0 : (mx - mn) / mx; }
  var DARK = [20, 16, 28], LIGHT = [255, 255, 255];
  function inkFor(bg) { return contrast(bg, LIGHT) >= contrast(bg, DARK) ? LIGHT : DARK; }       /* the text colour with the better contrast */
  function css(c) { return 'rgb(' + Math.round(c[0]) + ' ' + Math.round(c[1]) + ' ' + Math.round(c[2]) + ')'; }
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }

  var NAMES = [
    [345, ['Rózsakvarc', 'Bordó selyem', 'Cseresznyevirág', 'Pirkadati rózsa', 'Vörösbor köd', 'Pipacsmező']],
    [15, ['Őszi fűszer', 'Réz alkony', 'Mézes dió', 'Agyagkemence', 'Terrakotta nyár', 'Fahéjas reggel']],
    [45, ['Homokdűne', 'Aranyóra', 'Borostyán', 'Szalmaszín', 'Vaj és méz', 'Búzamező']],
    [70, ['Erdei moha', 'Zsályalevél', 'Mohazöld csend', 'Olajfaliget', 'Reggeli rét', 'Páfrányerdő']],
    [165, ['Tengermély', 'Jégtó', 'Türkiz öböl', 'Fjord', 'Mélykék hullám', 'Üvegtenger']],
    [200, ['Éjféli kék', 'Viharfelhő', 'Indigó éj', 'Tengeri szél', 'Kék óra', 'Havas alkony']],
    [250, ['Levendulamező', 'Éjféli szilva', 'Ametiszt köd', 'Orgona alkony', 'Szilvaszirup', 'Bársonyos éjszaka']],
    [300, ['Szilvás hajnal', 'Fukszia árnyék', 'Málna és bor', 'Rózsás alkonyat', 'Mályva szél', 'Orchidea csend']]
  ];
  function nameFor(h, last) {
    h = ((h % 360) + 360) % 360;
    var fam = NAMES[0];
    if (h >= 15 && h < 345) for (var i = 1; i < NAMES.length; i++) if (h >= NAMES[i][0]) fam = NAMES[i];
    var n; do { n = fam[1][Math.floor(Math.random() * fam[1].length)]; } while (n === last && fam[1].length > 1);
    return n;
  }
  function genPalette(last) {                                       /* mostly a monochromatic ramp, very light -> very dark, with a slight hue drift; 30%: one muted accent */
    var h = Math.random() * 360, drift = Math.random() * 16 - 8, r = Math.random;
    var L = [90 + r() * 3 - 1.5, 71 + r() * 6 - 3, 50 + r() * 6 - 3, 31 + r() * 6 - 3, 12 + r() * 3 - 1.5];        /* spaced by ~19-21 points of lightness */
    var S = [34 + r() * 12, 44 + r() * 14, 52 + r() * 16, 44 + r() * 12, 34 + r() * 10];
    var cols = L.map(function (l, i) { return hex(h + drift * i, S[i], l); }), accent = -1;
    if (r() < 0.3) {
      accent = 1 + Math.floor(r() * 3);
      var ah = r() < 0.5 ? h + 150 + r() * 60 : h + (r() < 0.5 ? -1 : 1) * (35 + r() * 20);
      cols[accent] = hex(ah, 14 + r() * 14, L[accent]);             /* a sage / warm-grey like accent, same lightness as its slot */
    }
    return { cols: cols, accent: accent, name: nameFor(h, last), hue: h };
  }

  var P = { cur: null, host: null, ui: null, shown: null, applied: false, tw: null };
  var APPLY_DEF = { view: [18, 16, 31], head: [44, 42, 85], h1: [99, 102, 241], h2: [155, 63, 216], c1: [14, 143, 163], c2: [34, 195, 214], card: [27, 25, 48], s1: [155, 63, 216], s2: [192, 38, 163], s3: [34, 195, 214], s4: [99, 102, 241], ink: [255, 255, 255], btn: [192, 38, 163], logo: [99, 102, 241] };
  var apState = {}; Object.keys(APPLY_DEF).forEach(function (k) { apState[k] = APPLY_DEF[k].slice(); });
  function setApplyVars(root) {
    var a = apState, g = function (x, y, d) { return 'linear-gradient(' + d + 'deg, ' + css(x) + ', ' + css(y) + ')'; };
    root.style.setProperty('--ab-view', css(a.view)); root.style.setProperty('--ab-head', css(a.head));
    root.style.setProperty('--ab-hero', g(a.h1, a.h2, 135)); root.style.setProperty('--ab-chart', g(a.c1, a.c2, 160));
    root.style.setProperty('--ab-card', css(a.card)); root.style.setProperty('--ab-ink', 'rgb(' + Math.round(a.ink[0]) + ' ' + Math.round(a.ink[1]) + ' ' + Math.round(a.ink[2]) + ' / 0.85)');
    root.style.setProperty('--ab-soft', 'rgb(' + Math.round(a.ink[0]) + ' ' + Math.round(a.ink[1]) + ' ' + Math.round(a.ink[2]) + ' / 0.25)');
    root.style.setProperty('--ab-btn', css(a.btn)); root.style.setProperty('--ab-logo', css(a.logo));
    var cards = root.querySelectorAll('.ab-card'), st = [a.s1, a.s2, a.s3, a.s4];
    for (var i = 0; i < cards.length; i++) cards[i].style.setProperty('--cc', css(st[i]));
  }
  function clearApplyVars(root) {
    ['--ab-view', '--ab-head', '--ab-hero', '--ab-chart', '--ab-card', '--ab-ink', '--ab-soft', '--ab-btn', '--ab-logo'].forEach(function (k) { root.style.removeProperty(k); });
    var cards = root.querySelectorAll('.ab-card'), st = [APPLY_DEF.s1, APPLY_DEF.s2, APPLY_DEF.s3, APPLY_DEF.s4];
    for (var i = 0; i < cards.length; i++) cards[i].style.setProperty('--cc', css(st[i]));
  }
  function tweenApply(target, root, done) {
    var keys = Object.keys(target);
    if (reduce || !gsap) { keys.forEach(function (k) { apState[k] = target[k].slice(); }); setApplyVars(root); if (done) done(); return; }
    var from = {}; keys.forEach(function (k) { from[k] = apState[k].slice(); });
    var o = { t: 0 }; gsap.killTweensOf(o);
    gsap.to(o, { t: 1, duration: 0.6, ease: 'power2.inOut', onUpdate: function () { keys.forEach(function (k) { apState[k] = mix(from[k], target[k], o.t); }); setApplyVars(root); }, onComplete: function () { if (done) done(); } });
  }
  function applyTargetFor(cols) {                                   /* map the palette (sorted dark -> light) onto the abstract site */
    var rgb = cols.map(rgbOf).sort(function (a, b) { return lumOf(a) - lumOf(b); });
    var acc = rgb.slice().sort(function (a, b) { return satOf(b) - satOf(a); })[0];
    return { view: rgb[0], head: rgb[1], h1: rgb[2], h2: rgb[3], c1: rgb[3], c2: rgb[4], card: rgb[1], s1: rgb[2], s2: rgb[3], s3: rgb[4], s4: acc, ink: rgb[4], btn: acc, logo: rgb[3] };
  }

  function bgAt(cols, fx, fy, w, h) {                               /* the colour of the 150deg gradient (light -> dark) at a point (fractions of the panel box) */
    var th = 150 * Math.PI / 180, dx = Math.sin(th), dy = -Math.cos(th), L = Math.abs(w * dx) + Math.abs(h * dy);
    var t = Math.max(0, Math.min(1, ((fx - 0.5) * w * dx + (fy - 0.5) * h * dy) / L + 0.5));
    var seg = t * (cols.length - 1), i = Math.min(cols.length - 2, Math.floor(seg));
    return mix(cols[i], cols[i + 1], seg - i);
  }
  function buildPalette() {
    var b = el('div', 'hw__pb pl');
    b.innerHTML = '<div class="pl__main"><h3 class="pl__name"></h3><div class="pl__caps"></div></div>' +
      '<div class="pl__side pl__act"><button type="button" class="pl__btn" data-p="new" data-tip="Új paletta" aria-label="Új paletta"><i data-lucide="refresh-cw"></i></button><button type="button" class="pl__btn" data-p="try" data-tip="Kipróbálom" aria-label="Kipróbálom"><i data-lucide="wand-2"></i></button>' +
      '<button type="button" class="pl__btn pl__reset" data-p="reset" data-tip="Visszaállítás" aria-label="Visszaállítás" hidden><i data-lucide="rotate-ccw"></i></button></div><div class="pl__toast" role="status"></div>';
    var caps = b.querySelector('.pl__caps'), cells = [];
    for (var i = 0; i < 5; i++) {
      var c = el('button', 'pl__col', '<span class="pl__cap"><i data-lucide="copy"></i></span><span class="pl__hex"></span>'); c.type = 'button'; caps.appendChild(c); cells.push(c);
    }
    P.ui = { b: b, name: b.querySelector('.pl__name'), cells: cells, toast: b.querySelector('.pl__toast'), reset: b.querySelector('.pl__reset'), tryB: b.querySelector('[data-p="try"]'), act: b.querySelector('.pl__act') };
    P.cur = genPalette('');
    var tt = 0;
    var say = function (m, col) { P.ui.toast.textContent = m; var r = col.getBoundingClientRect(), br = b.getBoundingClientRect(), k = (b.offsetWidth ? br.width / b.offsetWidth : 1) || 1; P.ui.toast.style.left = ((r.left + r.width / 2 - br.left) / k) + 'px'; P.ui.toast.style.top = ((r.top - br.top - 6) / k) + 'px'; P.ui.toast.classList.add('is-on'); clearTimeout(tt); tt = setTimeout(function () { P.ui.toast.classList.remove('is-on'); }, 1200); };
    function fallback(t) { try { var ta = el('textarea'); ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); } catch (e) { /* ignore */ } }
    cells.forEach(function (c) {
      c.addEventListener('click', function () {
        var h = c.dataset.hex, ok = function () { say('Másolva!', c); };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(h).then(ok, function () { fallback(h); ok(); }); else { fallback(h); ok(); }
      });
    });
    b.addEventListener('click', function (e) {
      var t = e.target.closest('[data-p]'); if (!t) return; var a = t.dataset.p;
      if (a === 'new') swap();
      else if (a === 'try') { tweenApply(applyTargetFor(P.cur.cols), host && window.HeroWin ? window.HeroWin.root : document.querySelector('.hw'), null); P.applied = true; P.ui.reset.hidden = false; inks(P.cur); }
      else if (a === 'reset') { var root = window.HeroWin.root; tweenApply(APPLY_DEF, root, function () { clearApplyVars(root); }); P.applied = false; P.ui.reset.hidden = true; }
    });
    function paint(p) {                                              /* static content + the text colours (AA against the gradient behind each text) */
      var U = P.ui, cols = p.cols, rgb = cols.map(rgbOf);
      U.name.textContent = p.name;
      cells.forEach(function (c, i) {
        c.dataset.hex = cols[i]; c.setAttribute('aria-label', 'Szín másolása: ' + cols[i]); c.querySelector('.pl__hex').textContent = cols[i];
        var cap = c.querySelector('.pl__cap'); cap.style.background = cols[i]; cap.style.color = css(inkFor(rgb[i]));
      });
      inks(p);
    }
    function inks(p) {
      var U = P.ui, h = host, rgb = p.cols.map(rgbOf);
      var W = h ? h.offsetWidth || 260 : 260, H = h ? h.offsetHeight || 270 : 270, bb = U.b.getBoundingClientRect(), hb = h ? h.getBoundingClientRect() : bb;
      var frac = function (e) { var r = e.getBoundingClientRect(); return [((r.left + r.width / 2) - hb.left) / Math.max(1, hb.width), ((r.top + r.height / 2) - hb.top) / Math.max(1, hb.height)]; };
      var set = function (e, varName, bgc) { var ink = inkFor(bgc); h.style.setProperty(varName, css(ink)); return ink; };
      if (!h) return;
      var ft = frac(U.name), fh = frac(cells[2].querySelector('.pl__hex')), fa = frac(U.act);
      var bt = bgAt(rgb, ft[0], ft[1], hb.width, hb.height), bh = bgAt(rgb, fh[0], fh[1], hb.width, hb.height), ba = bgAt(rgb, fa[0], fa[1], hb.width, hb.height);
      /* hex labels sit under different capsules: each gets the better ink for its own spot */
      var chip = function (e, inkVar, fillVar) {                    /* the better ink for the spot behind e; on a mid-tone (< 4.8:1 either way) the text gets its own small opaque chip (AA always) */
        var f = frac(e), bg = bgAt(rgb, f[0], f[1], hb.width, hb.height), ink = inkFor(bg), fill = contrast(bg, ink) < 4.8 ? (ink === LIGHT ? DARK : LIGHT) : null;
        e.style.setProperty(inkVar, css(ink)); if (fill) e.style.setProperty(fillVar, css(fill)); else e.style.removeProperty(fillVar);
      };
      cells.forEach(function (c) { chip(c.querySelector('.pl__hex'), '--hex-ink', '--hex-fill'); c.querySelector('.pl__hex').style.setProperty('color', 'var(--hex-ink)'); });
      h.style.setProperty('--pl-t', css(inkFor(bt))); h.style.setProperty('--pl-b', css(inkFor(ba)));
      [].forEach.call(U.b.querySelectorAll('.pl__btn'), function (bn) { chip(bn, '--pl-b', '--pl-bf'); });          /* each button: the ink for its own spot (+ a chip on mid-tones) */
    }
    function bgOf(p) { return 'linear-gradient(150deg, ' + p.cols.map(function (c) { return c; }).join(', ') + ')'; }
    function swap() {
      var np = genPalette(P.cur.name), old = P.cur; P.cur = np;
      if (reduce || !gsap) { paint(np); host.style.background = bgOf(np); return; }
      gsap.to(cells.map(function (c) { return c.firstChild; }), { y: 26, opacity: 0, duration: 0.2, stagger: 0.04, ease: 'power2.in', overwrite: true, onComplete: function () {
        paint(np);
        gsap.fromTo(cells.map(function (c) { return c.firstChild; }), { y: -26, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35, stagger: 0.05, ease: 'back.out(1.6)', overwrite: true, clearProps: 'transform,opacity' });
      } });
      gsap.fromTo(P.ui.name, { opacity: 0 }, { opacity: 1, duration: 0.4, delay: 0.2 });
      var o = { t: 0 }, fr = old.cols.map(rgbOf), to = np.cols.map(rgbOf);
      gsap.to(o, { t: 1, duration: 0.6, ease: 'power2.inOut', onUpdate: function () { host.style.background = 'linear-gradient(150deg, ' + fr.map(function (c, i) { return css(mix(c, to[i], o.t)); }).join(', ') + ')'; }, onComplete: function () { host.style.background = bgOf(np); inks(np); } });
    }
    var obj = { el: b, focus: cells[0], onOpen: function () { host.style.background = bgOf(P.cur); paint(P.cur); P.ui.reset.hidden = !P.applied; } };
    return obj;
  }

  /* ================================================================ mood */
  function buildMood() {
    var T = window.HERO_THEMES || {};
    var b = el('div', 'hw__pb hm'); b.innerHTML = '<h3 class="hm__title">Hangulat</h3><div class="hm__row" role="radiogroup" aria-label="Hangulat"></div>';
    var row = b.querySelector('.hm__row');
    var now = 'night'; try { now = window.sessionStorage.getItem('vb-hero-mood') || 'night'; } catch (e) { /* ignore */ }
    var stars = [[14, 12, 0], [70, 8, 1.2], [38, 26, 2.1], [84, 34, 0.6], [24, 44, 3], [58, 18, 1.8], [90, 14, 2.6]].map(function (s) { return '<i class="hm__star" style="left:' + s[0] + '%;top:' + s[1] + '%;--dl:' + s[2] + 's"></i>'; }).join('');
    var wave = function (c, cls) { return '<svg class="hm__wave ' + cls + '" viewBox="0 0 200 24" preserveAspectRatio="none" aria-hidden="true"><path d="M0 12 Q25 2 50 12 T100 12 T150 12 T200 12 V24 H0Z" fill="' + c + '"/></svg>'; };
    var SCENE = {
      night: '<span class="hm__aur hm__aur--a"></span><span class="hm__aur hm__aur--b"></span>' + stars,
      ocean: wave('rgb(34 211 238 / .35)', 'hm__wave--1') + wave('rgb(20 184 166 / .55)', 'hm__wave--2') + wave('rgb(14 80 130 / .85)', 'hm__wave--3'),
      sunset: '<span class="hm__sun"></span><span class="hm__sea"><i></i><i></i><i></i></span>'
    };
    var items = [];
    ['night', 'ocean', 'sunset'].forEach(function (k) {
      var t = T[k]; if (!t) return;
      var r = el('button', 'hm__card hm__card--' + k, '<span class="hm__scene">' + SCENE[k] + '<span class="hm__chk"><i data-lucide="check"></i></span></span><span class="hm__lb">' + t.label + '</span>');
      r.type = 'button'; r.setAttribute('role', 'radio'); r.dataset.k = k;
      r.addEventListener('click', function () {
        items.forEach(function (x) { x.setAttribute('aria-checked', x === r ? 'true' : 'false'); });
        try { window.sessionStorage.setItem('vb-hero-mood', k); } catch (e) { /* ignore */ }
        document.dispatchEvent(new CustomEvent('hero:theme', { detail: { name: k } }));
      });
      items.push(r); row.appendChild(r);
    });
    items.forEach(function (x) { x.setAttribute('aria-checked', x.dataset.k === now ? 'true' : 'false'); });
    b.classList.toggle('is-still', reduce);
    return { el: b, focus: items.filter(function (x) { return x.getAttribute('aria-checked') === 'true'; })[0] || items[0], onOpen: function () { b.classList.add('is-run'); } };
  }

  /* ================================================================ message */
  function buildMsg() {
    var WA = 'https://wa.me/36307840378', MAILRE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, PH1 = 'Írjon üzenetet…', PH2 = 'E-mail vagy telefonszám';
    var b = el('div', 'hw__pb mc');
    b.innerHTML = '<div class="mc__hd"><img class="mc__av" src="assets/avatar-vg.webp" width="28" height="28" alt="" decoding="async"><div class="mc__who"><p class="mc__nm">Varga György</p><p class="mc__stt"><i class="mc__dot"></i>Általában 24 órán belül válaszol</p></div></div>' +
      '<div class="mc__log" role="log" aria-live="polite"></div>' +
      '<form class="mc__form" novalidate><div class="mc__comp"><textarea name="message" rows="1" placeholder="' + PH1 + '" aria-label="Üzenet"></textarea><button type="submit" class="mc__send" aria-label="Küldés"><i data-lucide="send"></i></button></div>' +
      '<p class="mc__err" id="mc-err" role="alert" hidden></p>' +
      '<input type="text" name="_gotcha" tabindex="-1" autocomplete="off" class="mc__hp" aria-hidden="true">' +
      '<p class="mc__note">A küldéssel elfogadja az <a href="adatvedelem.html" target="_blank" rel="noopener">Adatkezelési tájékoztatót</a>.</p>' +
      '<button type="button" class="mc__new" data-new hidden>Új üzenet</button></form>';
    var log = b.querySelector('.mc__log'), f = b.querySelector('.mc__form'), ta = f.querySelector('textarea'), go = f.querySelector('.mc__send'), comp = f.querySelector('.mc__comp'), note = f.querySelector('.mc__note'), nw = f.querySelector('.mc__new'), hp = f.querySelector('.mc__hp');
    var err = f.querySelector('.mc__err'), ERR_MSG = 'Kérem, írjon néhány szót a projektjéről.', ERR_CONTACT = 'Kérem, adjon meg egy e-mail-címet vagy telefonszámot.';
    function fail(text) {                                          /* the message under the field (and no bubble: the text stays editable) */
      err.textContent = text; err.hidden = !text;
      if (text) { ta.setAttribute('aria-invalid', 'true'); ta.setAttribute('aria-describedby', 'mc-err'); comp.classList.remove('is-shake'); requestAnimationFrame(function () { comp.classList.add('is-shake'); }); ta.focus(); }
      else { ta.removeAttribute('aria-invalid'); ta.removeAttribute('aria-describedby'); }
    }
    var busy = false, stage = 'msg', msgText = '', payload = null;      /* stage: msg -> contact -> done */
    function later(fn, ms) { return setTimeout(fn, reduce ? 0 : ms); }
    function down() { log.scrollTop = log.scrollHeight; }
    function bubble(side, html) { var d = el('div', 'mc__b mc__b--' + side, html); log.appendChild(d); down(); return d; }
    function typing() { var d = el('div', 'mc__b mc__b--l mc__typing', '<i></i><i></i><i></i>'); d.setAttribute('aria-label', 'Gépel…'); log.appendChild(d); down(); return d; }
    function reply(html, after) { lock(true); var t = typing(); later(function () { t.remove(); var d = bubble('l', html); lock(false); if (after) after(d); }, 800); }
    function lock(on) {                                              /* while the bot types: read-only, not disabled. A disabled field drops the focus, which closed the panel for keyboard users */
      busy = on; ta.readOnly = on;
      if (on) go.setAttribute('aria-disabled', 'true'); else { go.removeAttribute('aria-disabled'); ta.disabled = false; go.disabled = false; }
    }
    function grow() { ta.style.blockSize = 'auto'; ta.style.blockSize = Math.min(ta.scrollHeight, 64) + 'px'; }
    function setStage(s) { stage = s; ta.placeholder = s === 'contact' ? PH2 : PH1; ta.setAttribute('aria-label', s === 'contact' ? PH2 : 'Üzenet'); ta.setAttribute('inputmode', s === 'contact' ? 'email' : 'text'); }
    function contactType(v) {
      if (MAILRE.test(v)) return 'email';
      var d = v.replace(/\D/g, '').length;
      if (/^[+(]?\d[\d\s()\-]*$/.test(v) && d >= 8 && d <= 15) return 'phone';
      return '';
    }
    function post(p) {
      var fd = new FormData(); fd.set('message', p.message); fd.set('contact', p.contact); fd.set('contact_type', p.type); fd.set('_gotcha', hp.value); fd.set('page', 'Hero mini OS'); fd.set('_subject', 'Üzenet a hero mini rendszerből');
      return fetch('https://formspree.io/f/xeerdkob', { method: 'POST', body: fd, headers: { Accept: 'application/json' } }).then(function (r) { if (!r.ok) throw new Error('http ' + r.status); });
    }
    function run(p) {
      lock(true); var t = typing();
      post(p).then(function () {
        t.remove(); payload = null; busy = false; setStage('done'); ta.value = ''; grow(); ta.placeholder = 'Üzenet elküldve'; var had = f.contains(document.activeElement); nw.hidden = false; note.hidden = true; if (had) nw.focus(); ta.disabled = true; go.disabled = true;
        var t2 = typing(); later(function () { t2.remove(); bubble('l', 'Köszönöm! Hamarosan jelentkezem. Szép napot! ✓✓'); }, 800);
      }).catch(function () {
        t.remove(); lock(false); payload = p;
        bubble('l', 'Hiba történt, kérem próbálja újra, vagy írjon <a href="' + WA + '" target="_blank" rel="noopener">WhatsAppon</a>.<button type="button" class="mc__retry" data-retry>Újrapróba</button>').classList.add('is-err');
      });
    }
    function send() {
      if (busy || stage === 'done') return;
      var text = ta.value.trim();
      if (stage === 'msg') {
        if (!text) { fail(ERR_MSG); return; }
        fail('');
        msgText = text; bubble('r', '').textContent = text; log.lastChild.classList.add('is-new'); ta.value = ''; grow();
        setStage('contact'); reply('Köszönöm! Hol válaszolhatok Önnek? Kérem, adja meg e-mail-címét vagy telefonszámát.', function () { ta.focus(); });
        return;
      }
      var type = contactType(text);
      if (!type) { fail(ERR_CONTACT); return; }
      fail('');
      bubble('r', '').textContent = text; log.lastChild.classList.add('is-new'); ta.value = ''; grow();
      run({ message: msgText, contact: text, type: type });
    }
    ta.addEventListener('input', function () { grow(); if (!err.hidden) fail(''); });
    ta.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); } });
    f.addEventListener('submit', function (e) { e.preventDefault(); send(); });
    log.addEventListener('click', function (e) {
      var rb = e.target.closest('[data-retry]'); if (!rb || busy || !payload) return;
      rb.remove(); run(payload);
    });
    function intro() { lock(true); var t = typing(); later(function () { t.remove(); bubble('l', 'Üdvözlöm! 👋 Miben segíthetek?').classList.add('mc__b--one'); lock(false); }, 800); }
    nw.addEventListener('click', function () {
      log.innerHTML = ''; fail(''); msgText = ''; payload = null; nw.hidden = true; note.hidden = false; setStage('msg'); lock(false); ta.value = ''; grow(); intro(); ta.focus();
    });
    return { el: b, focus: ta, onOpen: function () {
      grow();
      if (b.dataset.intro) { down(); return; }                         /* the conversation stays while the panel is closed / reopened */
      b.dataset.intro = '1'; intro();
    } };
  }

  if (document.fonts && document.fonts.load) document.fonts.load('600 20px "Cormorant Garamond"');
  var BUILD = { music: ['Zene', buildMusic], palette: ['Paletta', buildPalette], mood: ['Hangulat', buildMood], msg: ['Üzenet', buildMsg] };

  window.HeroOS = {
    open: function (name, api) {
      if (!BUILD[name]) return;
      if (cur === 'music' && name !== 'music') { /* the music keeps playing; only the equalizer loop stops */ }
      cur = name; host = api.host;
      if (!built[name]) { var r = BUILD[name][1](); built[name] = r; }
      var bare = name === 'music' || name === 'palette' || name === 'mood' || name === 'msg';           /* the player / palette card IS the panel: no header, no close button (dock icon, Esc, leaving close it) */
      host.classList.toggle('is-bare', name === 'music'); host.classList.toggle('is-pal', name === 'palette'); host.classList.toggle('is-mood', name === 'mood' || name === 'msg');
      if (name !== 'palette') { host.style.background = ''; }
      host.innerHTML = '';
      if (!bare) host.appendChild(el('div', 'hw__ph', '<span class="hw__pt">' + BUILD[name][0] + '</span>'));
      host.appendChild(built[name].el);
      host.setAttribute('aria-label', BUILD[name][0]);
      icons();
      if (built[name].onOpen) built[name].onOpen();
      if (name === 'music') { ui(); vizRun(); }
      var f = built[name].focus; if (f && f.focus) setTimeout(function () { try { f.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }, 60);
    },
    closed: function (name) { cur = null; if (built.mood) built.mood.el.classList.remove('is-run'); },
    audio: function () { var p = pos(); return { playing: A.playing, state: A.ctx && A.ctx.state, idx: A.idx, track: PLAYLIST[A.idx].title, cur: p.cur, dur: p.dur, muted: A.muted, vol: A.vol, session: A.session, frames: A.frames || 0, bars: A.ui && A.ui.bars.map(function (b) { return b.style.height; }) }; },
    stop: stopFull
  };
})();
