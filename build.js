#!/usr/bin/env node
// Generates the profile's animated SVGs into assets/. Run: node build.js
// The scenery is drawn here; the characters and HUD pieces are the games' own sprites (sprites/).
// Fonts and sprites are embedded so GitHub's <img> renders them.
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'assets');
const png = (file) => 'data:image/png;base64,' + fs.readFileSync(path.join(__dirname, 'sprites', file)).toString('base64');
const font = (file) => fs.readFileSync(path.join(__dirname, 'fonts', file)).toString('base64');

// Palette: the game's map screen, black with pale tints (see hollownest-calculator/css/tokens.css).
const C = {
  bg: '#06080d', bg2: '#0c1424', bone: '#f0f2f8', ink2: '#a7b0c6', dim: '#5d6880',
  accent: '#9ec6ea', line: '#6d8cb6', mask: '#ecece8', cloak: '#3a4256', cloakDark: '#232a39',
  far: '#0f192b', near: '#0a111d', lamp: '#d8ebfb',
};

const FONTS = `
@font-face{font-family:Cinzel;font-weight:400 900;src:url(data:font/woff2;base64,${font('cinzel.woff2')}) format('woff2')}
@font-face{font-family:Spectral;font-style:italic;font-weight:300;src:url(data:font/woff2;base64,${font('spectral-300-italic.woff2')}) format('woff2')}
@font-face{font-family:Spectral;font-weight:400;src:url(data:font/woff2;base64,${font('spectral-400.woff2')}) format('woff2')}`;

const BASE_CSS = `
.cz{font-family:Cinzel,'Trajan Pro',Georgia,serif}
.sp{font-family:Spectral,Georgia,serif}
@media (prefers-reduced-motion:reduce){*{animation:none!important}}`;

// Deterministic randomness so rebuilding doesn't churn the diff.
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const between = (a, b) => a + (b - a) * rnd();
const f = (n) => Math.round(n * 10) / 10;

const svg = (w, h, title, css, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${title}">
<title>${title}</title>
<style>${FONTS}${BASE_CSS}${css}</style>
<defs>
  <clipPath id="card"><rect width="${w}" height="${h}" rx="14"/></clipPath>
  <linearGradient id="cardbg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.bg}"/><stop offset="1" stop-color="#0a1120"/></linearGradient>
</defs>
<g clip-path="url(#card)">
<rect width="${w}" height="${h}" fill="url(#cardbg)"/>
${body}
</g>
<rect x=".75" y=".75" width="${w - 1.5}" height="${h - 1.5}" rx="13.5" fill="none" stroke="#1b2638" stroke-width="1.5"/>
</svg>
`;

// The game's menu fleur: a rule that thins out from a central curl.
const fleur = (cx, cy, half, cls = '') => `
<g class="fleur ${cls}" transform="translate(${cx},${cy})" fill="none" stroke="${C.bone}" stroke-linecap="round">
  <path class="rule" pathLength="1" stroke-width="1.4" d="M-18,0 L-${half},0 M18,0 L${half},0"/>
  <path stroke-width="1.6" d="M0,-9 C-6,-9 -10,-4 -10,0 C-10,5 -5,7 -2,4 C0,2 -2,-1 -4,0"/>
  <path stroke-width="1.6" d="M0,-9 C6,-9 10,-4 10,0 C10,5 5,7 2,4 C0,2 2,-1 4,0"/>
  <path fill="${C.bone}" stroke="none" d="M0,3 L3,8 L0,13 L-3,8 Z"/>
  <circle fill="${C.bone}" stroke="none" cx="-${half}" cy="0" r="2"/>
  <circle fill="${C.bone}" stroke="none" cx="${half}" cy="0" r="2"/>
</g>`;

// The Knight's sprites: 104 × 140 cells, feet 8px above the cell's bottom, facing right.
const CELL_W = 104, CELL_H = 140, FEET = 132;
const knightImg = (file, h, cls = '') => {
  const k = h / CELL_H, w = f(CELL_W * k);
  return `<image class="${cls}" href="${png(file)}" x="${f(-w / 2)}" y="${f(-FEET * k)}" width="${w}" height="${f(h)}"/>`;
};
// A HUD mask: the game's own health pip.
const maskPip = (x, y, cls = '') => `
<g transform="translate(${x},${y})"><image class="${cls}" href="${png('mask.png')}" x="-10.5" y="-15" width="21" height="30"/></g>`;

// Hornet's sprites (Silksong's own, from hollownest-calculator's tools/extract-hornet.py): strips of
// n cells, cw × ch, her feet at `feet` px from the top; she faces left.
const HORNET = {
  idle: { file: 'hornet-idle.png', n: 6, fps: 5, cw: 65, ch: 76, feet: 74 },
  run: { file: 'hornet-run.png', n: 10, fps: 15, cw: 57, ch: 70, feet: 68 },
  sit: { file: 'hornet-sit.png', n: 4, fps: 12, cw: 75, ch: 78, feet: 71 },
};
const KNIGHT = {
  run: { file: 'run.png', n: 6, fps: 10, cw: 104, ch: 140, feet: 132 },
};
// A window one cell wide over a strip: stepped through its frames, or held on one (`frame`).
let stripCss = '';
const strip = (m, k, { frame = null, cls = '' } = {}) => {
  const w = f(m.cw * k), h = f(m.ch * k);
  const x0 = frame === null ? 0 : frame * m.cw;
  let anim = '';
  if (frame === null) {
    const name = 'f' + m.file.replace(/\W/g, '');
    if (!stripCss.includes(name + '{')) stripCss += `\n.${name}{animation:${name} ${f(m.n / m.fps)}s steps(${m.n}) infinite}\n@keyframes ${name}{to{transform:translateX(-${m.cw * m.n}px)}}`;
    anim = name;
  }
  return `<svg class="${cls}" x="${f(-w / 2)}" y="${f(-m.feet * k)}" width="${w}" height="${h}" viewBox="${x0} 0 ${m.cw} ${m.ch}" overflow="hidden"><image class="${anim}" href="${png(m.file)}" width="${m.cw * m.n}" height="${m.ch}"/></svg>`;
};
const mirror = (inner) => `<g transform="scale(-1,1)">${inner}</g>`;

// Pharloom's palette (pharloom-calculator/css/tokens.css): rust-black, bone, silk, and embers.
const P = {
  bg: '#0f0604', bg2: '#2a0f09', far: '#1f0c08', near: '#150705', bone: '#f1ebdc', ember: '#ff9a4a',
  window: '#e9a25a', gold: '#c9a45c', line: '#a69d93',
};

// ── Header: Hallownest and Pharloom side by side, the Knight and Hornet facing each other. ──
function header() {
  const W = 1280, H = 440, GROUND = 392;
  seed = 11;
  stripCss = '';
  const towers = (x0, x1, color, minH, maxH, wins, winColor, dome) => {
    let out = '', x = x0;
    while (x < x1) {
      const w = between(22, 58), h = between(minH, maxH), top = H - h;
      if (dome && rnd() < 0.6) {
        // Pharloom's bell towers: a shaft, an onion dome and a needle on top.
        const r = w / 2;
        out += `<path fill="${color}" d="M${f(x)},${H} L${f(x)},${f(top)} C${f(x - r * 0.3)},${f(top - r * 1.1)} ${f(x + r)},${f(top - r * 1.5)} ${f(x + r)},${f(top - r * 2)} C${f(x + r)},${f(top - r * 1.5)} ${f(x + w + r * 0.3)},${f(top - r * 1.1)} ${f(x + w)},${f(top)} L${f(x + w)},${H} Z"/>`;
        out += `<rect fill="${color}" x="${f(x + r - 1)}" y="${f(top - r * 2 - 26)}" width="2" height="28"/>`;
      } else {
        const cap = between(18, 46);
        out += `<path fill="${color}" d="M${f(x)},${H} L${f(x)},${f(top)} L${f(x + w / 2)},${f(top - cap)} L${f(x + w)},${f(top)} L${f(x + w)},${H} Z"/>`;
        if (rnd() < 0.5) out += `<rect fill="${color}" x="${f(x + w / 2 - 1.5)}" y="${f(top - cap - 22)}" width="3" height="24"/>`;
      }
      for (let k = 0; k < wins; k++) {
        if (rnd() < 0.55) continue;
        const wx = x + between(5, w - 9), wy = top + between(12, h - 30);
        out += `<rect class="win" style="animation-delay:-${f(between(0, 6))}s" fill="${winColor}" x="${f(wx)}" y="${f(wy)}" width="3.5" height="6" rx="1.5"/>`;
      }
      x += w + between(4, 30);
    }
    return out;
  };

  // Hallownest: rain over the City of Tears.
  let rain = '';
  for (let i = 0; i < 70; i++) {
    const x = between(0, 860), len = between(10, 26), dur = between(0.7, 1.3);
    rain += `<line class="drop" style="animation-duration:${f(dur)}s;animation-delay:-${f(between(0, 2))}s" x1="${f(x)}" y1="-30" x2="${f(x - len * 0.25)}" y2="${f(-30 + len)}"/>`;
  }
  let motes = '';
  for (let i = 0; i < 16; i++) {
    motes += `<circle class="mote" style="animation-duration:${f(between(5, 10))}s;animation-delay:-${f(between(0, 10))}s" cx="${f(between(60, 620))}" cy="${f(between(300, 430))}" r="${f(between(0.8, 2.2))}"/>`;
  }

  // Pharloom: silk threads hanging from above, embers rising.
  let threads = '';
  for (let i = 0; i < 16; i++) {
    const x = between(700, 1270), len = between(60, 260), bend = between(-14, 14);
    threads += `<g class="thread" style="animation-duration:${f(between(4, 7))}s;animation-delay:-${f(between(0, 6))}s;transform-origin:${f(x)}px 0px">
  <path fill="none" stroke="${P.bone}" stroke-opacity="${f(between(0.12, 0.35))}" stroke-width="${f(between(0.6, 1.4))}" d="M${f(x)},-4 Q${f(x + bend)},${f(len / 2)} ${f(x)},${f(len)}"/>
</g>`;
  }
  let embers = '';
  for (let i = 0; i < 26; i++) {
    embers += `<rect class="ember" style="animation-duration:${f(between(6, 12))}s;animation-delay:-${f(between(0, 12))}s" fill="${P.ember}" x="${f(between(660, 1270))}" y="${f(between(250, 440))}" width="${f(between(1.4, 2.6))}" height="${f(between(3, 6))}" rx="1"/>`;
  }

  let grass = '';
  for (let x = 0; x < W; x += between(5, 11)) {
    const h = between(5, 14), lean = between(-4, 4);
    grass += `<path class="blade" style="animation-delay:-${f(between(0, 3))}s" stroke="${x < 640 ? '#1d2a3f' : '#3a1a10'}" d="M${f(x)},${GROUND} Q${f(x + lean / 2)},${f(GROUND - h / 2)} ${f(x + lean)},${f(GROUND - h)}"/>`;
  }

  const kPips = [0, 1, 2, 3, 4].map((i) => maskPip(132 + i * 30, 56, `pip p${i + 1}`)).join('');
  const hPips = [0, 1, 2, 3, 4].map((i) => `<g transform="translate(${1000 - i * 30},56)"><image class="pip p${i + 1}" href="${png('hornet-mask.png')}" x="-10.5" y="-15" width="21" height="30"/></g>`).join('');

  const hornet = strip(HORNET.idle, 1.95);
  const css = `
.drop{stroke:${C.accent};stroke-width:1;opacity:.22;animation:fall 1s linear infinite}
@keyframes fall{from{transform:translate(0,0)}to{transform:translate(-110px,480px)}}
.win{opacity:.55;animation:flicker 6s steps(1) infinite}
@keyframes flicker{0%,100%{opacity:.55}47%{opacity:.15}49%{opacity:.6}83%{opacity:.25}85%{opacity:.55}}
.mote{fill:${C.bone};animation:rise 8s ease-in infinite}
@keyframes rise{0%{transform:translateY(0);opacity:0}15%{opacity:.85}100%{transform:translateY(-190px);opacity:0}}
.ember{animation:drift 9s linear infinite}
@keyframes drift{0%{transform:translate(0,0);opacity:0}20%{opacity:.8}100%{transform:translate(-40px,-260px);opacity:0}}
.thread{animation:swing 5s ease-in-out infinite alternate}
@keyframes swing{from{transform:rotate(-1.6deg)}to{transform:rotate(1.6deg)}}
.blade{stroke-width:2;fill:none;stroke-linecap:round;transform-box:fill-box;transform-origin:bottom;animation:sway 3s ease-in-out infinite alternate}
@keyframes sway{from{transform:skewX(-6deg)}to{transform:skewX(6deg)}}
.idle{transform-box:fill-box;transform-origin:50% 95%;animation:breathe 2.6s ease-in-out infinite}
@keyframes breathe{50%{transform:scale(1.02,.98)}}
.halo{animation:glow 4s ease-in-out infinite}
@keyframes glow{50%{opacity:.6}}
.title{animation:enter 1.8s cubic-bezier(.2,.7,.2,1) both}
@keyframes enter{from{opacity:0;letter-spacing:.32em}}
.sub{animation:fade 1.6s .9s ease-out both}
.tag{animation:fade 1.6s 1.4s ease-out both}
@keyframes fade{from{opacity:0;transform:translateY(6px)}}
.fleur .rule{stroke-dasharray:1;animation:draw 1.6s .5s ease-out both}
@keyframes draw{from{stroke-dashoffset:1}}
.soul{animation:wave 3.2s linear infinite}
@keyframes wave{to{transform:translateX(-60px)}}
.spool{animation:silk 3s ease-in-out infinite alternate}
@keyframes silk{to{opacity:.75}}
.pip{transform-box:fill-box;transform-origin:center;animation:pop .5s ease-out both}
.pip.p1{animation-delay:1.0s}.pip.p2{animation-delay:1.15s}.pip.p3{animation-delay:1.3s}.pip.p4{animation-delay:1.45s}.pip.p5{animation-delay:1.6s}
@keyframes pop{from{opacity:0;transform:scale(0)}}` + stripCss;

  const body = `
<defs>
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.bg}"/><stop offset="1" stop-color="${C.bg2}"/></linearGradient>
  <linearGradient id="psky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P.bg}"/><stop offset="1" stop-color="${P.bg2}"/></linearGradient>
  <linearGradient id="split" x1="0" x2="1"><stop offset=".43" stop-color="#fff" stop-opacity="0"/><stop offset=".57" stop-color="#fff"/></linearGradient>
  <mask id="pharloom"><rect width="${W}" height="${H}" fill="url(#split)"/></mask>
  <radialGradient id="lampglow"><stop offset="0" stop-color="${C.lamp}" stop-opacity=".55"/><stop offset=".35" stop-color="${C.accent}" stop-opacity=".16"/><stop offset="1" stop-color="${C.accent}" stop-opacity="0"/></radialGradient>
  <radialGradient id="mist" cx=".25" cy="1" r=".6"><stop offset="0" stop-color="${C.line}" stop-opacity=".22"/><stop offset="1" stop-color="${C.line}" stop-opacity="0"/></radialGradient>
  <radialGradient id="pmist" cx=".75" cy="1" r=".6"><stop offset="0" stop-color="#b8502a" stop-opacity=".22"/><stop offset="1" stop-color="#b8502a" stop-opacity="0"/></radialGradient>
  <radialGradient id="shade" cx=".5" cy=".42" r=".5"><stop offset="0" stop-color="#05060a" stop-opacity=".85"/><stop offset=".6" stop-color="#05060a" stop-opacity=".45"/><stop offset="1" stop-color="#05060a" stop-opacity="0"/></radialGradient>
  <filter id="softglow" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <clipPath id="vessel"><circle cx="70" cy="58" r="30"/></clipPath>
</defs>

<!-- Hallownest -->
<rect width="${W}" height="${H}" fill="url(#sky)"/>
<rect width="${W}" height="${H}" fill="url(#mist)"/>
<g opacity=".9">${towers(-20, 900, C.far, 190, 360, 6, C.accent, false)}</g>
<g>${towers(-20, 900, C.near, 80, 210, 3, C.accent, false)}</g>
<g>${rain}</g>
<circle class="halo" cx="168" cy="250" r="130" fill="url(#lampglow)"/>
<path fill="#121b2b" stroke="#2a3a52" stroke-width="1.2" d="M150,${GROUND} L148,262 C148,246 162,240 172,246 L172,252 C164,248 156,251 156,262 L157,${GROUND} Z"/>
<path fill="#121b2b" stroke="#2a3a52" stroke-width="1.2" d="M143,${GROUND} L164,${GROUND} L160,${GROUND - 10} L147,${GROUND - 10} Z"/>
<circle cx="168" cy="250" r="9" fill="${C.lamp}" filter="url(#softglow)"/>
<g>${motes}</g>

<!-- Pharloom, blended in from the right -->
<g mask="url(#pharloom)">
  <rect width="${W}" height="${H}" fill="url(#psky)"/>
  <rect width="${W}" height="${H}" fill="url(#pmist)"/>
  <g opacity=".95">${towers(380, W + 40, P.far, 190, 360, 6, P.window, true)}</g>
  <g>${towers(380, W + 40, P.near, 80, 210, 3, P.window, true)}</g>
  <g>${threads}</g>
  <g>${embers}</g>
</g>

<!-- the title's backdrop, ground and the two of them -->
<rect width="${W}" height="${H}" fill="url(#shade)"/>
<path fill="#06070b" d="M0,${GROUND} C300,${GROUND - 4} 980,${GROUND - 4} ${W},${GROUND} L${W},${H} L0,${H} Z"/>
<g>${grass}</g>
<g transform="translate(318,${GROUND})">${knightImg('idle.png', 140, 'idle')}</g>
<g transform="translate(968,${GROUND})">${hornet}</g>

<!-- HUDs: the Knight's soul and masks, Hornet's masks and silk spool -->
<g transform="translate(14,-8)">
  <circle cx="70" cy="58" r="34" fill="#0b1019" stroke="#2a3247" stroke-width="3"/>
  <g clip-path="url(#vessel)"><path class="soul" fill="#ECECEC" d="M30,62 q15,-6 30,0 t30,0 t30,0 t30,0 t30,0 L180,102 L30,102 Z"/></g>
  <circle cx="70" cy="58" r="31" fill="none" stroke="#ECECEC" stroke-opacity=".5" stroke-width="1.5"/>
  ${kPips}
</g>
<g transform="translate(14,-8)">
  ${hPips}
  <image class="spool" href="${png('spool.png')}" x="1036" y="38" width="190" height="59"/>
</g>

<!-- title -->
<text class="cz title" x="${W / 2}" y="168" text-anchor="middle" font-size="76" font-weight="600" letter-spacing="9" fill="${C.bone}" filter="url(#softglow)">BETORZDEV</text>
${fleur(W / 2, 200, 300)}
<text class="sp sub" x="${W / 2}" y="250" text-anchor="middle" font-size="27" font-style="italic" font-weight="300" fill="${C.ink2}">Web developer, building companion tools for Hallownest and Pharloom</text>
<text class="cz tag" x="${W / 2}" y="290" text-anchor="middle" font-size="14" letter-spacing="4.5" fill="${C.ink2}">VANILLA JS · NO FRAMEWORKS · NO BUILD STEP</text>`;

  return svg(W, H, 'betorzdev: web developer, building companion tools for Hallownest and Pharloom', css, body);
}

// ── Section title: the game's menu heading between two fleurs. ──
const GLINT_CSS = `
.glint{animation:glint 5s ease-in-out infinite}
@keyframes glint{0%,60%{transform:translateX(-560px);opacity:0}65%{opacity:1}100%{transform:translateX(560px);opacity:0}}`;

const heading = (text, W) => `
<defs>
  <linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="${C.bone}" stop-opacity="0"/><stop offset=".5" stop-color="${C.bone}"/><stop offset="1" stop-color="${C.bone}" stop-opacity="0"/></linearGradient>
  <linearGradient id="hfade" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".25" stop-color="#fff"/><stop offset=".75" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
  <mask id="hm"><rect width="${W}" height="100" fill="url(#hfade)"/></mask>
</defs>
<text class="cz" x="${W / 2}" y="54" text-anchor="middle" font-size="30" font-weight="500" letter-spacing="7" fill="${C.bone}">${text}</text>
<g mask="url(#hm)">
  ${fleur(W / 2, 76, 470)}
  <rect class="glint" x="${W / 2 - 40}" y="74" width="80" height="4" fill="url(#g)"/>
</g>`;

function titleCard(text, file) {
  const W = 1280, H = 112;
  fs.writeFileSync(path.join(OUT, file), svg(W, H, text, GLINT_CSS, heading(text, W)));
}

// ── About: the heading over a few lines of prose. ──
function about(lines, file) {
  const W = 1280, H = 130 + lines.length * 40 + 30;
  const text = lines.map((l, i) => `<text class="sp ln" style="animation-delay:${f(0.3 + i * 0.25)}s" x="${W / 2}" y="${150 + i * 40}" text-anchor="middle" font-size="23" fill="${l.dim ? C.ink2 : C.bone}"${l.italic ? ' font-style="italic" font-weight="300"' : ''}>${l.t}</text>`).join('\n');
  const css = GLINT_CSS + `
.ln{animation:fade 1.2s ease-out both}
@keyframes fade{from{opacity:0;transform:translateY(6px)}}
.hl{fill:${C.accent}}`;
  fs.writeFileSync(path.join(OUT, file), svg(W, H, lines.map((l) => l.t.replace(/<[^>]+>/g, '')).join(' '), css, heading('THE KNIGHT', W) + text));
}

// ── The stack as equipped charms, with notch costs that fill all 11 notches. ──
function charms() {
  const W = 1280, H = 410, Y = 110;
  const list = [
    { name: 'JavaScript', cost: 3, glyph: `<text class="cz" y="11" text-anchor="middle" font-size="32" font-weight="700">JS</text>` },
    { name: 'HTML', cost: 1, glyph: `<text class="sp" y="10" text-anchor="middle" font-size="32">&lt;/&gt;</text>` },
    { name: 'CSS', cost: 2, glyph: `<text class="sp" y="10" text-anchor="middle" font-size="34">{ }</text>` },
    { name: 'Node.js', cost: 2, glyph: `<path fill="none" stroke-width="3" d="M0,-20 L17,-10 L17,10 L0,20 L-17,10 L-17,-10 Z"/><text class="cz" y="7" text-anchor="middle" font-size="18" font-weight="700" stroke="none">N</text>` },
    { name: 'Python', cost: 1, glyph: `<text class="cz" y="10" text-anchor="middle" font-size="30" font-weight="700">Py</text>` },
    { name: 'Cloudflare', cost: 1, glyph: `<path stroke="none" d="M-21,11 C-27,11 -27,1 -20,0 C-20,-8 -11,-11 -6,-6 C-3,-15 12,-15 13,-4 C22,-5 24,11 15,11 Z"/>` },
    { name: 'Git', cost: 1, glyph: `<g fill="none" stroke-width="3"><path d="M-8,-16 L-8,16 M-8,4 C-8,-4 8,-4 8,-10"/></g><circle cx="-8" cy="-16" r="4.5" stroke="none"/><circle cx="-8" cy="16" r="4.5" stroke="none"/><circle cx="8" cy="-12" r="4.5" stroke="none"/>` },
  ];
  const step = 160, x0 = W / 2 - (step * (list.length - 1)) / 2;
  const total = list.reduce((s, c) => s + c.cost, 0);

  const css = GLINT_CSS + `
.halo{opacity:.0;animation:charmglow 7s ease-in-out infinite}
@keyframes charmglow{0%,100%{opacity:.05}12%{opacity:.75}30%{opacity:.05}}
.charm{animation:equip .6s cubic-bezier(.3,1.6,.5,1) both}
@keyframes equip{from{opacity:0;transform:translateY(-14px)}}
.notch{animation:fill .4s ease-out both}
@keyframes fill{from{opacity:.15}}`;

  let items = '';
  list.forEach((c, i) => {
    const x = x0 + i * step, y = Y + 170, d = f(i * 0.12);
    let dots = '';
    for (let k = 0; k < c.cost; k++) dots += `<use href="#notch" transform="translate(${f((k - (c.cost - 1) / 2) * 15 - 6.5)},-80.5) scale(.72)"/>`;
    items += `
<g transform="translate(${x},${y})">
  <circle class="halo" style="animation-delay:${f(i * 1)}s" r="70" fill="url(#halo)"/>
  <g class="charm" style="animation-delay:${d}s">
    ${dots}
    <circle r="46" fill="url(#disc)" stroke="${C.line}" stroke-width="2"/>
    <circle r="39" fill="none" stroke="${C.line}" stroke-opacity=".4" stroke-width="1"/>
    <g fill="${C.bone}" stroke="${C.bone}">${c.glyph}</g>
    <text class="cz" y="78" text-anchor="middle" font-size="15" letter-spacing="1.5" fill="${C.ink2}">${c.name}</text>
  </g>
</g>`;
  });

  let notches = '';
  for (let k = 0; k < total; k++) notches += `<use class="notch" style="animation-delay:${f(0.9 + k * 0.08)}s" href="#notch" x="${f(k * 22 - 9)}" y="-9"/>`;

  const body = `
<defs>
  <image id="notch" href="${png('notch-ui.png')}" width="18" height="18"/>
  <radialGradient id="disc" cx=".4" cy=".35"><stop offset="0" stop-color="#1c2840"/><stop offset="1" stop-color="#0a0f19"/></radialGradient>
  <radialGradient id="halo"><stop offset="0" stop-color="${C.accent}" stop-opacity=".45"/><stop offset=".6" stop-color="${C.accent}" stop-opacity=".1"/><stop offset="1" stop-color="${C.accent}" stop-opacity="0"/></radialGradient>
</defs>
${heading('CHARMS EQUIPPED', W)}
<g transform="translate(${W / 2 - 220},${Y + 28})">
  <text class="cz" x="0" y="6" font-size="14" letter-spacing="3" fill="${C.ink2}">NOTCHES</text>
  <g transform="translate(120,0)">${notches}</g>
</g>
${items}`;
  fs.writeFileSync(path.join(OUT, 'stack.svg'), svg(W, H, `Stack: ${list.map((c) => c.name).join(', ')}`, css, body));
}

// ── Footer: the Knight and Hornet come in from each side, rest together at a bench, and go. ──
function footer() {
  const W = 1280, H = 200, G = 165, BX = 640, T = 20, KK = 92 / CELL_H, HK = 1.4;
  const KX = BX - 30, HX = BX + 34;
  stripCss = '';
  const kRun = strip(KNIGHT.run, KK), hRun = strip(HORNET.run, HK);
  const css = `
.sat{transform-box:fill-box;transform-origin:50% 95%;animation:breathe 2.6s ease-in-out infinite}
@keyframes breathe{50%{transform:scale(1.02,.98)}}
.k-in{animation:k-in ${T}s linear infinite}
@keyframes k-in{0%{transform:translateX(-80px);opacity:1}30%{transform:translateX(${KX}px);opacity:1}30.1%,100%{transform:translateX(${KX}px);opacity:0}}
.k-sit{animation:k-sit ${T}s linear infinite}
@keyframes k-sit{0%,30%{opacity:0}30.1%,76%{opacity:1}76.1%,100%{opacity:0}}
.k-out{animation:k-out ${T}s linear infinite}
@keyframes k-out{0%,76%{opacity:0;transform:translateX(${KX}px)}76.1%{opacity:1;transform:translateX(${KX}px)}100%{opacity:1;transform:translateX(-80px)}}
.h-in{animation:h-in ${T}s linear infinite}
@keyframes h-in{0%,6%{transform:translateX(${W + 80}px);opacity:1}34%{transform:translateX(${HX}px);opacity:1}34.1%,100%{transform:translateX(${HX}px);opacity:0}}
.h-sit{animation:h-sit ${T}s linear infinite}
@keyframes h-sit{0%,34%{opacity:0}34.1%,78%{opacity:1}78.1%,100%{opacity:0}}
.h-out{animation:h-out ${T}s linear infinite}
@keyframes h-out{0%,78%{opacity:0;transform:translateX(${HX}px)}78.1%{opacity:1;transform:translateX(${HX}px)}100%{opacity:1;transform:translateX(${W + 80}px)}}
.rest{animation:rest ${T}s ease-in-out infinite}
@keyframes rest{0%,34%{opacity:0}42%,70%{opacity:1}77%,100%{opacity:0}}
.thanks{animation:thanks ${T}s ease-in-out infinite}
@keyframes thanks{0%,38%{opacity:0;transform:translateY(6px)}46%,70%{opacity:1;transform:translateY(0)}76%,100%{opacity:0;transform:translateY(-4px)}}` + stripCss;

  seed = 3;
  let grass = '';
  for (let x = 0; x < W; x += between(6, 14)) {
    const h = between(4, 12);
    grass += `<path stroke="${x < BX ? '#1d2a3f' : '#3a1a10'}" d="M${f(x)},${G} l${f(between(-3, 3))},-${f(h)}"/>`;
  }

  // Dirtmouth's bench (hollownest-calculator/assets/benches/town-bench.png): 183 × 89, seat at y 47.
  const BW = 150, BK = BW / 183, SEAT = G - f(89 * BK) + f(47 * BK);
  const bench = `<image href="${png('bench.png')}" x="${BX - BW / 2}" y="${f(G - 89 * BK)}" width="${BW}" height="${f(89 * BK)}"/>`;

  const body = `
<defs>
  <radialGradient id="rest"><stop offset="0" stop-color="${C.lamp}" stop-opacity=".35"/><stop offset="1" stop-color="${C.accent}" stop-opacity="0"/></radialGradient>
  <linearGradient id="warm" x1="0" x2="1"><stop offset=".45" stop-color="${P.bg2}" stop-opacity="0"/><stop offset="1" stop-color="${P.bg2}" stop-opacity=".9"/></linearGradient>
  <linearGradient id="edge" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".1" stop-color="#fff"/><stop offset=".9" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
  <mask id="m"><rect width="${W}" height="${H}" fill="url(#edge)"/></mask>
</defs>
<rect width="${W}" height="${H}" fill="url(#warm)"/>
<g mask="url(#m)">
  <ellipse class="rest" cx="${BX}" cy="${G - 40}" rx="200" ry="95" fill="url(#rest)"/>
  <path d="M0,${G} L${W},${G}" stroke="#1b2638" stroke-width="2"/>
  <g stroke-width="2" stroke-linecap="round">${grass}</g>
  ${bench}
  <g class="k-in"><g transform="translate(0,${G})">${kRun}</g></g>
  <g class="k-sit"><g transform="translate(${KX},${SEAT + 8})">${knightImg('sit.png', 92, 'sat')}</g></g>
  <g class="k-out"><g transform="translate(0,${G})">${mirror(kRun)}</g></g>
  <g class="h-in"><g transform="translate(0,${G})">${hRun}</g></g>
  <g class="h-sit"><g transform="translate(${HX},${SEAT + 7})"><g class="sat">${strip(HORNET.sit, HK, { frame: 3 })}</g></g></g>
  <g class="h-out"><g transform="translate(0,${G})">${mirror(hRun)}</g></g>
</g>
<text class="cz thanks" x="${W / 2}" y="${G + 24}" text-anchor="middle" font-size="13" letter-spacing="5" fill="${C.ink2}">THANKS FOR VISITING · REST A WHILE</text>`;
  fs.writeFileSync(path.join(OUT, 'footer.svg'), svg(W, H, 'The Knight and Hornet come in from each side, rest together at a bench, and go', css, body));
}

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'header.svg'), header());
about([
  { t: 'I build for the web by hand: plain HTML, CSS and JavaScript, with no frameworks and no build step.' },
  { t: 'Lately that means two companion sites, for <tspan class="hl">Hollow Knight</tspan> and <tspan class="hl">Silksong</tspan>, that read your save file,' },
  { t: 'follow your game live and show how every charm, Tool and Crest changes the Knight and Hornet.' },
  { t: 'Both in English and Spanish. I care about getting the numbers right, and the details close to the games.', dim: true, italic: true },
], 'about.svg');
titleCard('FEATURED WORK', 'title-work.svg');
charms();
footer();
for (const f of fs.readdirSync(OUT)) console.log(f, (fs.statSync(path.join(OUT, f)).size / 1024).toFixed(0) + ' KB');
