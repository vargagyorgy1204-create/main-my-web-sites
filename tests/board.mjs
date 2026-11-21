// Visual review board: `node tests/board.mjs` -> board/index.html
//   rows = sections of index.html, columns = the standard viewports; every cell is a viewport screenshot with the section top aligned
//   to the viewport top (pinned sections at the given step). Thumbnails share one height, click = full size. The header shows the
//   commit hash + date. Cells whose pixels changed by more than 2% against the PREVIOUS board run are outlined and listed.
// Run it ONLY when the owner asks for the "board" (see CLAUDE.md). The board/ folder is git-ignored (not deployed).
// Env: PW_MODULE / PW_CHROMIUM as in tests/smoke.mjs. Options: --viewports=1440x900,390x844  --sections=hero,why-1
//      --page-only  rebuild board/index.html from the screenshots already in board/img (no browser run)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';

const require = createRequire(import.meta.url);
let chromium;
{
  const tries = [];
  if (process.env.PW_MODULE) tries.push(() => require(process.env.PW_MODULE));
  tries.push(() => require('playwright'), () => require('playwright-core'));
  tries.push(() => require(path.join(execSync('npm root -g').toString().trim(), 'playwright')));
  for (const t of tries) { try { ({ chromium } = t()); break; } catch { /* next */ } }
  if (!chromium && !process.argv.includes('--page-only')) { console.error('Playwright not found. `npm i -D playwright` (or set PW_MODULE=/path/to/playwright).'); process.exit(2); }
}

const ROOT = path.resolve(path.join(path.dirname(fileURLToPath(import.meta.url)), '..'));
const OUT = path.join(ROOT, 'board');
const IMG = path.join(OUT, 'img'), PREV = path.join(OUT, 'prev');
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webm': 'video/webm', '.mp4': 'video/mp4', '.xml': 'application/xml', '.txt': 'text/plain' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || p.startsWith('/board') || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;
const sleep = ms => new Promise(r => setTimeout(r, ms));

const PAGE_ONLY = process.argv.includes('--page-only');
const ARG = k => (process.argv.find(a => a.startsWith(`--${k}=`)) || '').slice(k.length + 3).split(',').filter(Boolean);
const ALL_VPS = ['360x800', '390x844', '768x1024', '1280x720', '1366x768', '1440x900', '1518x670', '1536x864', '1920x1080'];
const VPS = (ARG('viewports').length ? ARG('viewports') : ALL_VPS).map(s => { const [w, h] = s.split('x').map(Number); return { w, h, key: s }; });
const SECTIONS = [
  ['hero', 'Hero'], ['about-1', 'Rólam · chapter 1'], ['about-4', 'Rólam · chapter 4'], ['skills', 'Készségek'],
  ['why-1', 'Értékek · step 1'], ['why-6', 'Értékek · step 6'], ['steps', 'Együttműködés'], ['services', 'Szolgáltatások'],
  ['portfolio', 'Portfólió'], ['contact', 'Kapcsolat'], ['footer', 'Footer'],
].filter(([id]) => !ARG('sections').length || ARG('sections').includes(id));

const launchOpts = { headless: true };
if (process.env.PW_CHROMIUM) launchOpts.executablePath = process.env.PW_CHROMIUM;
else if (fs.existsSync('/opt/pw-browsers/chromium')) launchOpts.executablePath = '/opt/pw-browsers/chromium';
const browser = PAGE_ONLY ? null : await chromium.launch(launchOpts);

// previous run -> board/prev (one generation) so the new run can be diffed against it
fs.mkdirSync(OUT, { recursive: true });
if (!PAGE_ONLY && fs.existsSync(IMG) && fs.readdirSync(IMG).length) { fs.rmSync(PREV, { recursive: true, force: true }); fs.renameSync(IMG, PREV); }
fs.mkdirSync(IMG, { recursive: true });
if (!PAGE_ONLY && fs.existsSync(PREV) && ARG('viewports').length + ARG('sections').length) {          // partial run: keep the other cells
  for (const f of fs.readdirSync(PREV)) if (!fs.existsSync(path.join(IMG, f))) fs.copyFileSync(path.join(PREV, f), path.join(IMG, f));
}

const scrollTo = (p, y) => p.evaluate(yy => { if (window.VB && VB.lenis) VB.lenis.scrollTo(yy, { immediate: true }); else scrollTo(0, yy); }, y);
const frames = (p, n = 4) => p.evaluate(k => new Promise(r => { const f = () => (--k <= 0 ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
const topOf = (p, sel) => p.evaluate(s => { const e = document.querySelector(s); return e ? e.getBoundingClientRect().top + scrollY : 0; }, sel);

async function shoot(vp) {
  const phone = vp.w < 500;
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, ...(phone ? { hasTouch: true, isMobile: true } : {}) });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/index.html`, { waitUntil: 'load' });
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) { /* ignore */ } const b = document.querySelector('.cookie-banner'); if (b) b.style.display = 'none'; return document.fonts.ready; });
  await p.waitForFunction(() => !window.VB || !VB.hasST || window.ScrollTrigger.getAll().length > 0, null, { timeout: 5000 }).catch(() => {});
  await frames(p, 6); await sleep(900);
  const settle = async () => { await frames(p, 8); await sleep(1500); };
  for (const [id] of SECTIONS) {
    const [sec, step] = id.split('-');
    if (sec === 'hero') await scrollTo(p, 0);
    else if (sec === 'about') {
      const top = await topOf(p, '#about'), sh = await p.evaluate(() => document.getElementById('about').offsetHeight);
      const s = step === '1' ? (vp.w >= 900 ? 0.2 : 0.05) : (vp.w >= 900 ? 0.85 : 0.95);
      await scrollTo(p, vp.w >= 900 ? top + (sh - vp.h) * s : top + (sh - vp.h * 0.6) * s);
    } else if (sec === 'why') {
      const top = await topOf(p, '#why'); const pinned = await p.evaluate(() => document.getElementById('why').classList.contains('is-pinned'));
      const k = step === '1' ? 0 : 5;
      if (pinned) await scrollTo(p, top + k * vp.h * 0.7 + 4);
      else { await scrollTo(p, top); if (k) await p.evaluate(() => document.querySelectorAll('.why-panel')[5].querySelector('.why-panel__tab').click()); }
    } else if (sec === 'steps') {
      const pinned = await p.evaluate(() => { const s = document.getElementById('steps'); return getComputedStyle(s.querySelector('.steps-pin') || s).position === 'sticky'; });
      await scrollTo(p, (await topOf(p, '#steps')) + (pinned ? 40 : 0));
    } else if (sec === 'footer') await scrollTo(p, await topOf(p, 'footer'));
    else await scrollTo(p, await topOf(p, '#' + sec));
    await settle();
    await p.mouse.move(vp.w - 3, vp.h - 3);
    await p.screenshot({ path: path.join(IMG, `${id}_${vp.key}.png`) });
  }
  await ctx.close();
}

// run the viewports 3 at a time
if (!PAGE_ONLY) {
  const queue = VPS.slice();
  await Promise.all(Array.from({ length: Math.min(3, queue.length) }, async () => { while (queue.length) await shoot(queue.shift()); }));
}

// ---------------------------------------------------------------- diff against the previous run (in a browser canvas: no extra packages)
const dpage = PAGE_ONLY ? null : await browser.newPage();
async function pctDiff(a, b) {
  return dpage.evaluate(async ([x, y]) => {
    const load = async b64 => { const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode(); return im; };
    const A = await load(x), B = await load(y);
    if (A.width !== B.width || A.height !== B.height) return 100;
    const g = im => { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const t = c.getContext('2d'); t.drawImage(im, 0, 0); return t.getImageData(0, 0, im.width, im.height).data; };
    const da = g(A), db = g(B); let n = 0;
    for (let i = 0; i < da.length; i += 4) if (Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]) > 48) n++;
    return +(100 * n / (da.length / 4)).toFixed(2);
  }, [a.toString('base64'), b.toString('base64')]);
}
let changes = {};
if (PAGE_ONLY) { try { changes = JSON.parse(fs.readFileSync(path.join(OUT, 'changes.json'), 'utf8')); } catch { /* none */ } }
else if (fs.existsSync(PREV)) {
  for (const [id] of SECTIONS) for (const vp of VPS) {
    const f = `${id}_${vp.key}.png`, a = path.join(PREV, f), b = path.join(IMG, f);
    if (fs.existsSync(a) && fs.existsSync(b)) { const d = await pctDiff(fs.readFileSync(a), fs.readFileSync(b)); if (d > 0) changes[f] = d; }
  }
}
if (browser) await browser.close();
server.close();

// ---------------------------------------------------------------- the board page
const sh = c => { try { return execSync(c, { cwd: ROOT }).toString().trim(); } catch { return ''; } };
const hash = sh('git rev-parse --short HEAD'), date = sh('git log -1 --format=%cd --date=iso'), dirty = sh('git status --porcelain').split('\n').filter(l => l && !l.includes('board/')).length;
const label = k => SECTIONS.find(s => s[0] === k)?.[1] || k;
const rows = ALL_VPS.filter(k => fs.readdirSync(IMG).some(f => f.endsWith(`_${k}.png`)));
const secs = [...new Set(fs.readdirSync(IMG).map(f => f.replace(/_\d+x\d+\.png$/, '')))].sort((a, b) => ['hero', 'about-1', 'about-4', 'skills', 'why-1', 'why-6', 'steps', 'services', 'portfolio', 'contact', 'footer'].indexOf(a) - ['hero', 'about-1', 'about-4', 'skills', 'why-1', 'why-6', 'steps', 'services', 'portfolio', 'contact', 'footer'].indexOf(b));
const changed = Object.entries(changes).filter(([, d]) => d > 2);
const groupOf = k => { const w = +k.split('x')[0]; return w < 500 ? 'phones' : w < 1000 ? 'tablet' : w < 1400 ? 'laptops' : 'desktop'; };
const th = k => { const [w, h] = k.split('x'); return `<th data-w="${w}" data-h="${h}" data-g="${groupOf(k)}">${k}</th>`; };
const html = `<!doctype html><html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>VarBro review board</title>
<style>
  :root { color-scheme: dark; --bg: #11131c; --bar: #0b0d14; --fg: #e8e9f1; --mut: #8d92a8; --line: #2a2e42; --thumb: 170px; }
  * { box-sizing: border-box; }
  html, body { height: 100%; margin: 0; }
  body { display: grid; grid-template-rows: auto minmax(0, 1fr); height: 100vh; height: 100dvh; background: var(--bg); color: var(--fg); font: 13px/1.4 system-ui, sans-serif; overflow: hidden; }
  header { display: flex; gap: 10px 22px; flex-wrap: wrap; align-items: center; padding: 10px 18px; background: var(--bar); border-bottom: 1px solid var(--line); }
  header b { font-size: 15px; } header span { color: var(--mut); }
  .tools { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-left: auto; }
  button, .chip { font: inherit; color: var(--fg); background: #1b1f31; border: 1px solid #3a3f5c; border-radius: 6px; padding: 5px 11px; cursor: pointer; }
  button:hover, .chip:hover { background: #262b44; }
  .chip.off { opacity: .45; text-decoration: line-through; }
  input[type=range] { width: 150px; accent-color: #8a8fff; }
  label { color: var(--mut); display: flex; gap: 6px; align-items: center; }
  /* the grid is its own scroll container: both scrollbars sit at the edges of the window, always visible */
  .grid { overflow: auto; min-height: 0; height: calc(100vh - var(--bar-h, 96px)); height: calc(100dvh - var(--bar-h, 96px)); outline: none; }
  .grid::-webkit-scrollbar { width: 14px; height: 14px; }
  .grid::-webkit-scrollbar-track { background: #1b1e2d; }
  .grid::-webkit-scrollbar-thumb { background: #7c83ff; border-radius: 8px; border: 3px solid #1b1e2d; }
  .grid::-webkit-scrollbar-thumb:hover { background: #a3a8ff; }
  .grid::-webkit-scrollbar-corner { background: #1b1e2d; }
  @supports not selector(::-webkit-scrollbar) { .grid { scrollbar-width: auto; scrollbar-color: #7c83ff #1b1e2d; } }
  table { border-collapse: separate; border-spacing: 8px; }
  thead th { position: sticky; top: 0; z-index: 3; background: var(--bg); color: var(--mut); font-weight: 600; text-align: left; white-space: nowrap; padding: 8px 2px 6px; box-shadow: 0 1px 0 var(--line); cursor: ew-resize; }
  tbody th.sec { position: sticky; left: 0; z-index: 2; background: var(--bg); color: var(--fg); padding: 4px 14px 0 4px; text-align: left; vertical-align: top; white-space: nowrap; box-shadow: 1px 0 0 var(--line); }
  thead th.corner { left: 0; z-index: 5; cursor: default; }
  td { vertical-align: top; }
  a.cell { position: relative; display: block; border: 1px solid var(--line); border-radius: 6px; overflow: hidden; line-height: 0; }
  a.cell.changed { outline: 2px solid #ff5470; }
  a.cell img { height: var(--thumb); width: auto; display: block; }
  a.cell em { position: absolute; right: 4px; top: 4px; font: 600 11px/1 system-ui; padding: 3px 5px; border-radius: 4px; background: #ff5470; color: #fff; }
  .hide-phones [data-g=phones], .hide-tablet [data-g=tablet], .hide-laptops [data-g=laptops], .hide-desktop [data-g=desktop] { display: none; }
  .hint { color: var(--mut); font-size: 12px; }
</style></head><body>
<header id="bar"><b>VarBro review board</b><span>commit <b>${hash || '—'}</b>${dirty ? ' + uncommitted changes' : ''}</span><span>${date}</span><span>generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')}</span>
<span>${changed.length ? `${changed.length} cell(s) changed &gt; 2% vs the previous run (red)` : 'no cell changed &gt; 2% vs the previous run'}</span>
<div class="tools">
  <button id="fit" title="all visible viewport columns fit the window width">Fit all</button><button id="normal" title="170px thumbnails">Normal</button>
  <label>size <input id="size" type="range" min="50" max="520" step="1" value="170"><span id="sizev">170</span>px</label>
  <span id="chips"><button class="chip" data-g="phones">phones</button> <button class="chip" data-g="tablet">tablet</button> <button class="chip" data-g="laptops">laptops</button> <button class="chip" data-g="desktop">desktop</button></span>
  <span class="hint">wheel over the top row or Shift+wheel or ←/→ = scroll sideways</span>
</div></header>
<div class="grid" id="grid" tabindex="0"><table id="tbl"><thead><tr><th class="corner"></th>${rows.map(th).join('')}</tr></thead><tbody>
${secs.map(s => `<tr><th class="sec">${label(s)}</th>${rows.map(k => { const f = `${s}_${k}.png`; if (!fs.existsSync(path.join(IMG, f))) return `<td data-g="${groupOf(k)}"></td>`; const d = changes[f]; return `<td data-g="${groupOf(k)}"><a class="cell${d > 2 ? ' changed' : ''}" href="img/${f}" target="_blank"><img loading="lazy" src="img/${f}" alt="${f}">${d > 2 ? `<em>${d}%</em>` : ''}</a></td>`; }).join('')}</tr>`).join('\n')}
</tbody></table></div>
<script>
(function () {
  var grid = document.getElementById('grid'), bar = document.getElementById('bar'), tbl = document.getElementById('tbl');
  var size = document.getElementById('size'), sizev = document.getElementById('sizev');
  var KEY = 'varbro-board', st = { h: 170, hidden: [] };
  try { var s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s) st = { h: +s.h || 170, hidden: s.hidden || [] }; } catch (e) { /* storage blocked */ }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* ignore */ } }
  function barH() { document.documentElement.style.setProperty('--bar-h', bar.offsetHeight + 'px'); }
  function setH(h) { st.h = Math.max(50, Math.min(520, Math.round(h))); document.documentElement.style.setProperty('--thumb', st.h + 'px'); size.value = st.h; sizev.textContent = st.h; save(); }
  function applyHidden() {
    ['phones', 'tablet', 'laptops', 'desktop'].forEach(function (g) { tbl.classList.toggle('hide-' + g, st.hidden.indexOf(g) > -1); });
    Array.prototype.forEach.call(document.querySelectorAll('.chip'), function (b) { b.classList.toggle('off', st.hidden.indexOf(b.dataset.g) > -1); });
  }
  function fit() {                                   /* thumbnail height so that every visible column fits the width of the grid (measured, 4 passes) */
    var ths = Array.prototype.filter.call(document.querySelectorAll('thead th[data-w]'), function (t) { return t.offsetParent !== null; });
    if (!ths.length) return;
    var asp = ths.reduce(function (a, t) { return a + (+t.dataset.w) / (+t.dataset.h); }, 0);
    for (var k = 0; k < 4; k++) {
      var cells = Array.prototype.filter.call(document.querySelector('tbody tr').querySelectorAll('a.cell'), function (a) { return a.offsetParent !== null; });
      var imgW = cells.reduce(function (s, a) { return s + a.offsetWidth; }, 0);
      var fixed = tbl.offsetWidth - imgW;             /* first column, borders and spacing */
      var borders = 2 * cells.length;
      setH(Math.floor((grid.offsetWidth - 15 - fixed - 2 - cells.length) / asp - borders / asp));   /* 15px: room for the vertical scrollbar, whether or not it is shown yet */
    }
  }
  barH(); window.addEventListener('resize', barH);
  setH(st.h); applyHidden();
  document.getElementById('fit').onclick = fit;
  document.getElementById('normal').onclick = function () { setH(170); };
  size.oninput = function () { setH(+size.value); };
  Array.prototype.forEach.call(document.querySelectorAll('.chip'), function (b) {
    b.onclick = function () { var i = st.hidden.indexOf(b.dataset.g); if (i > -1) st.hidden.splice(i, 1); else st.hidden.push(b.dataset.g); applyHidden(); save(); };
  });
  /* the normal mouse wheel over the top row scrolls sideways; Shift+wheel does it anywhere */
  grid.addEventListener('wheel', function (e) {
    var overHead = e.target.closest && e.target.closest('thead');
    if (overHead || e.shiftKey) { e.preventDefault(); grid.scrollLeft += (Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX); }
  }, { passive: false });
  window.addEventListener('keydown', function (e) {
    if (e.target && /^(INPUT|BUTTON)$/.test(e.target.tagName) && e.target.type !== 'button') return;
    if (e.key === 'ArrowRight') { grid.scrollLeft += 260; e.preventDefault(); }
    else if (e.key === 'ArrowLeft') { grid.scrollLeft -= 260; e.preventDefault(); }
    else if (e.key === 'ArrowDown' && document.activeElement !== grid) { grid.scrollTop += 160; e.preventDefault(); }
    else if (e.key === 'ArrowUp' && document.activeElement !== grid) { grid.scrollTop -= 160; e.preventDefault(); }
  });
  grid.focus({ preventScroll: true });
})();
</script></body></html>`;
fs.writeFileSync(path.join(OUT, 'index.html'), html);
if (!PAGE_ONLY) fs.writeFileSync(path.join(OUT, 'changes.json'), JSON.stringify(changes, null, 1));

console.log(`\nBoard: ${path.join(OUT, 'index.html')}`);
console.log(`Cells: ${secs.length} sections x ${rows.length} viewports`);
if (fs.existsSync(PREV)) {
  console.log(changed.length ? `Changed > 2% vs the previous run (${changed.length}):` : 'No cell changed > 2% vs the previous run.');
  for (const [f, d] of changed) console.log(`  ${f.replace('.png', '').padEnd(28)} ${d}%`);
  const small = Object.entries(changes).filter(([, d]) => d <= 2);
  if (small.length) console.log(`Changed <= 2%: ${small.map(([f, d]) => `${f.replace('.png', '')} ${d}%`).join(', ')}`);
} else console.log('First run: nothing to compare with yet.');
