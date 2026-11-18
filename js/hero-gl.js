/* hero-gl.js — the hero background: a slow, living brand gradient (blue #5b5bf0 -> violet #9b3fd8 -> pink #C026A3 on #0f0b1c) flowing like liquid under frosted glass.
   One full-screen plane, a small simplex-noise fragment shader (WebGL 1), rendered at reduced resolution and capped at ~30fps. The blobs drift toward the pointer within a small
   radius (real mouse only). Starts after window.load (the headline paints first); pauses off-screen and in a hidden tab.
   Fallback (no WebGL / low-power / save-data): the CSS blobs (.hero-css, class .is-css). Reduced motion: the static CSS gradient only. */
(function () {
  'use strict';

  var hero = document.getElementById('hero');
  var bg = hero && hero.querySelector('.hero-bg');
  var canvas = bg && bg.querySelector('.hero-gl');
  if (!canvas) return;

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return;                                           /* static gradient (the CSS background) */

  var conn = navigator.connection || {};
  var lowPower = (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2) || (navigator.deviceMemory && navigator.deviceMemory <= 2) || conn.saveData;

  function fallback() { bg.classList.add('is-css'); }
  if (lowPower) { fallback(); return; }

  var VERT = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  var FRAG = [
    'precision mediump float;',
    'uniform vec2 uR;uniform float uT;uniform vec2 uM;uniform vec2 uP;uniform float uA;',
    'vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}',
    'vec2 mod289(vec2 x){return x-floor(x*(1./289.))*289.;}',
    'vec3 permute(vec3 x){return mod289(((x*34.)+1.)*x);}',
    'float snoise(vec2 v){',
    ' const vec4 C=vec4(.211324865405187,.366025403784439,-.577350269189626,.024390243902439);',
    ' vec2 i=floor(v+dot(v,C.yy));vec2 x0=v-i+dot(i,C.xx);',
    ' vec2 i1=(x0.x>x0.y)?vec2(1.,0.):vec2(0.,1.);',
    ' vec4 x12=x0.xyxy+C.xxzz;x12.xy-=i1;i=mod289(i);',
    ' vec3 p=permute(permute(i.y+vec3(0.,i1.y,1.))+i.x+vec3(0.,i1.x,1.));',
    ' vec3 m=max(.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.);m=m*m;m=m*m;',
    ' vec3 x=2.*fract(p*C.www)-1.;vec3 h=abs(x)-.5;vec3 ox=floor(x+.5);vec3 a0=x-ox;',
    ' m*=1.79284291400159-.85373472095314*(a0*a0+h*h);',
    ' vec3 g;g.x=a0.x*x0.x+h.x*x0.y;g.yz=a0.yz*x12.xz+h.yz*x12.yw;return 130.*dot(m,g);}',
    'void main(){',
    ' vec2 uv=gl_FragCoord.xy/uR;float asp=uR.x/uR.y;vec2 q=(uv-.5)*vec2(asp,1.);',
    ' float t=uT*.06;',
    ' vec2 w=vec2(snoise(q*1.1+vec2(t,t*.7)),snoise(q*1.1+vec2(-t*.8,t+5.2)));',
    ' vec2 pq=q+w*.34;',
    ' vec2 m=(uM-.5)*vec2(asp,1.);vec2 pp=(uP-.5)*vec2(asp,1.);',
    ' vec2 c1=vec2(-.55,.2)+vec2(sin(t*1.7),cos(t*1.3))*.28;',
    ' vec2 c2=vec2(.55,.12)+vec2(cos(t*1.5),sin(t*1.9))*.3;',
    ' vec2 c3=vec2(.05,-.5)+vec2(sin(t*1.1+2.),cos(t*1.6))*.3;',
    ' float reach=.25*max(asp,1.);',
    ' float w1=pow(1./(length(m-c1)+.15),4.),w2=pow(1./(length(m-c2)+.15),4.),w3=pow(1./(length(m-c3)+.15),4.);float ws=w1+w2+w3;',
    ' vec2 d1=m-c1;vec2 d2=m-c2;vec2 d3=m-c3;',
    ' c1+=d1*min(1.,reach/max(length(d1),.0001))*(w1/ws)*uA;',
    ' c2+=d2*min(1.,reach/max(length(d2),.0001))*(w2/ws)*uA;',
    ' c3+=d3*min(1.,reach/max(length(d3),.0001))*(w3/ws)*uA;',
    ' float b1=smoothstep(.95,0.,length(pq-c1));',
    ' float b2=smoothstep(.95,0.,length(pq-c2));',
    ' float b3=smoothstep(.95,0.,length(pq-c3));',
    ' vec3 base=vec3(.059,.043,.11);',
    ' vec3 blue=vec3(.357,.357,.941);vec3 vio=vec3(.608,.247,.847);vec3 pink=vec3(.753,.149,.639);',
    ' vec3 col=base+blue*b1*.5+vio*b2*.46+pink*b3*.44;',
    ' float lift=smoothstep(.3*max(asp,1.),0.,length(q-pp))*uA;col=col*(1.+.15*lift)+vec3(.05,.02,.08)*lift;',
    ' float n=snoise(pq*2.4+t*2.)*.5+.5;col+=(n-.5)*.05;',
    ' col*=1.-.35*length(uv-.5);',
    ' gl_FragColor=vec4(col,1.);}'
  ].join('\n');

  var gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' }) || canvas.getContext('experimental-webgl');
  if (!gl) { fallback(); return; }

  function shader(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
  }
  var vs = shader(gl.VERTEX_SHADER, VERT), fs = shader(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) { fallback(); return; }
  var prog = gl.createProgram();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { fallback(); return; }
  gl.useProgram(prog);
  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);   /* one oversized triangle covers the screen */
  var loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  var uR = gl.getUniformLocation(prog, 'uR'), uT = gl.getUniformLocation(prog, 'uT'), uM = gl.getUniformLocation(prog, 'uM'), uP = gl.getUniformLocation(prog, 'uP'), uA = gl.getUniformLocation(prog, 'uA');

  var scale = window.innerWidth < 900 ? 0.3 : 0.45;             /* reduced resolution: the gradient is soft, the browser scales it up */
  function resize() {
    var w = Math.max(2, Math.round(canvas.clientWidth * scale)), h = Math.max(2, Math.round(canvas.clientHeight * scale));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); }
  }

  /* pointer reaction (real mouse only, html.has-cursor): the nearest blob follows the pointer with ~1.2s lag (within ~25% of the viewport) and the light lifts around it (~30vw, +15%).
     It eases back to the idle drift when the mouse leaves the hero or stops for 3s. */
  var root = document.documentElement;
  var mx = 0.5, my = 0.5, px = 0.5, py = 0.5, tx = 0.5, ty = 0.5, act = 0, actT = 0, idleT = 0;
  hero.addEventListener('pointermove', function (e) {
    if (e.pointerType !== 'mouse' || !root.classList.contains('has-cursor')) return;
    var r = hero.getBoundingClientRect();
    tx = (e.clientX - r.left) / r.width; ty = 1 - (e.clientY - r.top) / r.height;
    if (actT === 0) { mx = px = tx; my = py = ty; }                  /* first contact: start under the pointer, only the pull fades in */
    actT = 1;
    clearTimeout(idleT); idleT = setTimeout(function () { actT = 0; }, 3000);
  }, { passive: true });
  hero.addEventListener('pointerleave', function () { clearTimeout(idleT); actT = 0; });

  var visible = true, raf = 0, last = 0, t0 = performance.now(), started = false;
  function frame(now) {
    raf = 0;
    if (!visible || document.hidden) return;
    raf = requestAnimationFrame(frame);
    if (now - last < 33) return;                                /* ~30fps cap */
    last = now;
    var dt = Math.min(0.1, (now - (frame.prev || now)) / 1000 || 0.033); frame.prev = now;
    var k = 1 - Math.exp(-dt / 1.2), kf = 1 - Math.exp(-dt / 0.35);    /* ~1.2s lag for the blob and the activity, ~0.35s for the light lift */
    mx += (tx - mx) * k; my += (ty - my) * k; px += (tx - px) * kf; py += (ty - py) * kf;
    act += (actT - act) * k;
    resize();
    gl.uniform2f(uR, canvas.width, canvas.height);
    gl.uniform1f(uT, (now - t0) / 1000);
    gl.uniform2f(uM, mx, my); gl.uniform2f(uP, px, py); gl.uniform1f(uA, act);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (!started) { started = true; bg.classList.add('is-gl'); }
  }
  function run() { if (!raf && visible && !document.hidden) raf = requestAnimationFrame(frame); }
  if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { visible = es[es.length - 1].isIntersecting; if (visible) run(); }).observe(hero);
  document.addEventListener('visibilitychange', run);
  canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); bg.classList.remove('is-gl'); fallback(); cancelAnimationFrame(raf); });

  /* start after load: the headline is already painted */
  if (document.readyState === 'complete') run(); else window.addEventListener('load', function () { setTimeout(run, 60); });
})();
