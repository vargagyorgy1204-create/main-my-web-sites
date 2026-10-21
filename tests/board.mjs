// Visual review board: `node tests/board.mjs` -> board/index.html
//   rows = sections of index.html, columns = the standard viewports; every cell is a viewport screenshot with the section top aligned
//   to the viewport top (pinned sections at the given step). Thumbnails share one height, click = full size. The header shows the
//   commit hash + date. Cells whose pixels changed by more than 2% against the PREVIOUS board run are outlined and listed.
// Run it ONLY when the owner asks for the "board" (see CLAUDE.md). The board/ folder is git-ignored (not deployed).
// Env: PW_MODULE / PW_CHROMIUM as in tests/smoke.mjs. Options: --viewports=1440x900,390x844  --sections=hero,why-1
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
  if (!chromium) { console.error('Playwright not found. `npm i -D playwright` (or set PW_MODULE=/path/to/playwright).'); process.exit(2); }
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
const browser = await chromium.launch(launchOpts);

// previous run -> board/prev (one generation) so the new run can be diffed against it
fs.mkdirSync(OUT, { recursive: true });
if (fs.existsSync(IMG) && fs.readdirSync(IMG).length) { fs.rmSync(PREV, { recursive: true, force: true }); fs.renameSync(IMG, PREV); }
fs.mkdirSync(IMG, { recursive: true });
if (fs.existsSync(PREV) && ARG('viewports').length + ARG('sections').length) {          // partial run: keep the other cells
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
{
  const queue = VPS.slice();
  await Promise.all(Array.from({ length: Math.min(3, queue.length) }, async () => { while (queue.length) await shoot(queue.shift()); }));
}

// ---------------------------------------------------------------- diff against the previous run (in a browser canvas: no extra packages)
const dpage = await browser.newPage();
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
const changes = {};
if (fs.existsSync(PREV)) {
  for (const [id] of SECTIONS) for (const vp of VPS) {
    const f = `${id}_${vp.key}.png`, a = path.join(PREV, f), b = path.join(IMG, f);
    if (fs.existsSync(a) && fs.existsSync(b)) { const d = await pctDiff(fs.readFileSync(a), fs.readFileSync(b)); if (d > 0) changes[f] = d; }
  }
}
await browser.close(); server.close();

// ---------------------------------------------------------------- the board page
const sh = c => { try { return execSync(c, { cwd: ROOT }).toString().trim(); } catch { return ''; } };
const hash = sh('git rev-parse --short HEAD'), date = sh('git log -1 --format=%cd --date=iso'), dirty = sh('git status --porcelain').split('\n').filter(l => l && !l.includes('board/')).length;
const label = k => SECTIONS.find(s => s[0] === k)?.[1] || k;
const rows = ALL_VPS.filter(k => fs.readdirSync(IMG).some(f => f.endsWith(`_${k}.png`)));
const secs = [...new Set(fs.readdirSync(IMG).map(f => f.replace(/_\d+x\d+\.png$/, '')))].sort((a, b) => ['hero', 'about-1', 'about-4', 'skills', 'why-1', 'why-6', 'steps', 'services', 'portfolio', 'contact', 'footer'].indexOf(a) - ['hero', 'about-1', 'about-4', 'skills', 'why-1', 'why-6', 'steps', 'services', 'portfolio', 'contact', 'footer'].indexOf(b));
const changed = Object.entries(changes).filter(([, d]) => d > 2);
const html = `<!doctype html><html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>VarBro review board</title>
<style>
  :root { color-scheme: dark; --bg: #11131c; --fg: #e8e9f1; --mut: #8d92a8; --line: #2a2e42; }
  body { margin: 0; background: var(--bg); color: var(--fg); font: 13px/1.4 system-ui, sans-serif; }
  header { position: sticky; top: 0; z-index: 5; padding: 12px 20px; background: #0b0d14; border-bottom: 1px solid var(--line); display: flex; gap: 24px; flex-wrap: wrap; align-items: baseline; }
  header b { font-size: 15px; } header span { color: var(--mut); }
  .scroll { overflow: auto; padding: 16px 20px 60px; }
  table { border-collapse: separate; border-spacing: 8px; }
  th { color: var(--mut); font-weight: 500; text-align: left; white-space: nowrap; padding: 0 0 4px; position: sticky; top: 0; background: var(--bg); }
  th.sec { position: sticky; left: 0; z-index: 2; background: var(--bg); padding-right: 12px; color: var(--fg); vertical-align: top; }
  td { vertical-align: top; }
  a.cell { position: relative; display: block; border: 1px solid var(--line); border-radius: 6px; overflow: hidden; line-height: 0; }
  a.cell.changed { outline: 2px solid #ff5470; }
  a.cell img { height: 170px; width: auto; display: block; }
  a.cell em { position: absolute; right: 4px; top: 4px; font: 600 11px/1 system-ui; padding: 3px 5px; border-radius: 4px; background: #ff5470; color: #fff; }
  p.note { margin: 0; color: var(--mut); }
</style></head><body>
<header><b>VarBro review board</b><span>commit <b>${hash || '—'}</b>${dirty ? ' + uncommitted changes' : ''}</span><span>${date}</span><span>generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')}</span>
<span>${changed.length ? `${changed.length} cell(s) changed &gt; 2% vs the previous run (red)` : 'no cell changed &gt; 2% vs the previous run'}</span></header>
<div class="scroll"><table><tr><th></th>${rows.map(k => `<th>${k}</th>`).join('')}</tr>
${secs.map(s => `<tr><th class="sec">${label(s)}</th>${rows.map(k => { const f = `${s}_${k}.png`; if (!fs.existsSync(path.join(IMG, f))) return '<td></td>'; const d = changes[f]; return `<td><a class="cell${d > 2 ? ' changed' : ''}" href="img/${f}" target="_blank"><img loading="lazy" src="img/${f}" alt="${f}">${d > 2 ? `<em>${d}%</em>` : ''}</a></td>`; }).join('')}</tr>`).join('\n')}
</table></div></body></html>`;
fs.writeFileSync(path.join(OUT, 'index.html'), html);
fs.writeFileSync(path.join(OUT, 'changes.json'), JSON.stringify(changes, null, 1));

console.log(`\nBoard: ${path.join(OUT, 'index.html')}`);
console.log(`Cells: ${secs.length} sections x ${rows.length} viewports`);
if (fs.existsSync(PREV)) {
  console.log(changed.length ? `Changed > 2% vs the previous run (${changed.length}):` : 'No cell changed > 2% vs the previous run.');
  for (const [f, d] of changed) console.log(`  ${f.replace('.png', '').padEnd(28)} ${d}%`);
  const small = Object.entries(changes).filter(([, d]) => d <= 2);
  if (small.length) console.log(`Changed <= 2%: ${small.map(([f, d]) => `${f.replace('.png', '')} ${d}%`).join(', ')}`);
} else console.log('First run: nothing to compare with yet.');
