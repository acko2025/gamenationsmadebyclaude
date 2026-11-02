// ============================================================
// WAR OF NATIONS — UI core: map rendering, HUD, panels, loop, menus
// ============================================================
'use strict';

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtInt = v => Math.round(v).toLocaleString('en-US');
const V = { cx: MW / 2, cy: MH / 2, scale: 1, mode: 'political', sel: -1, hover: -1 };
const UI = { panel: null, selDivs: new Set(), keys: new Set(), lastMap: 0, unitRects: [], phase: 'menu', notesFilter: 'all', diploSel: -1, editor: null, p3sel: null, buildCat: 'housing' };
let mapCv, mapCtx, bmpCv, bmpCtx, bmpData, dpr = 1;

// ---------- icons ----------
const ICONS = {
  coin: '<circle cx="12" cy="12" r="8"/><path d="M12 7v10M9 9.5h4.5a1.75 1.75 0 0 1 0 3.5h-3a1.75 1.75 0 0 0 0 3.5H15"/>',
  pp: '<path d="M4 18h16M6 18l-1-9 4 3 3-6 3 6 4-3-1 9"/>',
  mp: '<circle cx="9" cy="8" r="3"/><circle cx="16" cy="9" r="2.4"/><path d="M3 19c0-3.3 2.7-6 6-6s6 2.7 6 6M14 14c3 0 6 2 6 5"/>',
  pop: '<path d="M4 20V10l8-6 8 6v10M9 20v-6h6v6"/>',
  stab: '<path d="M12 4v16M5 8h14M5 8l-2 6h4zM19 8l-2 6h4zM8 20h8"/>',
  research: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3"/>',
  overview: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  build: '<path d="M14 6l4 4-9 9H5v-4zM12 8l4 4M15 3l6 6"/>',
  military: '<path d="M5 19l14-14M15 5h4v4M9 19l-4-4M19 19L5 5M5 9V5h4M15 19l4-4"/>',
  production: '<path d="M3 21V11l6 4v-4l6 4V5h3v16zM7 18h2M12 18h2"/>',
  diplomacy: '<path d="M3 12l4-4 5 3 5-3 4 4-6 6-3-2-3 2zM7 8l5 5M12 11l4 4"/>',
  economy: '<path d="M4 20h16M6 16v-5M10 16V8M14 16v-3M18 16V5"/>',
  laws: '<path d="M7 3h10v18H7zM10 7h4M10 11h4M10 15h2"/>',
  people: '<circle cx="12" cy="7" r="3"/><path d="M6 21v-3a6 6 0 0 1 12 0v3"/>',
  trade: '<path d="M3 16l3 4h12l3-4zM12 3v13M12 3l6 9H12M12 6l-5 7h5"/>',
  orgs: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="7.5" r="2"/><circle cx="7.5" cy="14.5" r="2"/><circle cx="16.5" cy="14.5" r="2"/><path d="M11 9.3l-2.4 3.4M13 9.3l2.4 3.4M9.6 14.5h4.8"/>',
  editor: '<path d="M4 6l5-2 6 2 5-2v14l-5 2-6-2-5 2zM9 4v14M15 6v14"/>',
  menu: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/>',
  pause: '<path d="M8 5v14M16 5v14"/>', play: '<path d="M7 4l12 8-12 8z"/>',
  food: '<path d="M12 21V9M12 9c-3 0-5-2-5-5 3 0 5 2 5 5zM12 13c3 0 5-2 5-5-3 0-5 2-5 5z"/>',
  war: '<path d="M4 20l7-7M20 20l-7-7M4 4l9 9M20 4l-9 9"/>',
  bell: '<path d="M6 17V11a6 6 0 0 1 12 0v6l2 2H4zM10 21h4"/>',
};
const icon = (n, cls) => `<svg class="ic ${cls || ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICONS[n] || ''}</svg>`;

// ---------- flags ----------
const flagImgCache = new Map();
// Real national flags are SVGs rendered through <img>; until one has loaded the pattern fallback is drawn
const svgFlagImgs = new Map();
let flagLoadGen = 0;
function svgFlagImage(code) {
  let img = svgFlagImgs.get(code);
  if (!img) {
    img = new Image();
    img.onload = () => { flagLoadGen++; flagUrlCache.clear(); G.mapDirty = true; };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(FLAG_SVG[code]);
    svgFlagImgs.set(code, img);
  }
  return img;
}
const svgReady = code => { const i = svgFlagImage(code); return i.complete && i.naturalWidth > 0; };
let _codeNames = null;
function flagCodeNames() {
  if (_codeNames) return _codeNames;
  _codeNames = {};
  for (const n in ISO_NAME) if (!_codeNames[ISO_NAME[n]]) _codeNames[ISO_NAME[n]] = n;
  return _codeNames;
}
function drawFlag(ctx, f, x, y, w, h) {
  if (!f) return;
  const [a, b, c] = f.c;
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  const R = (col, rx, ry, rw, rh) => { ctx.fillStyle = col; ctx.fillRect(x + rx * w, y + ry * h, rw * w + 0.5, rh * h + 0.5); };
  const real = f.svg && typeof FLAG_SVG !== 'undefined' && FLAG_SVG[f.svg] && svgReady(f.svg);
  if (real) ctx.drawImage(svgFlagImage(f.svg), x, y, w, h);
  else switch (f.pat) {
    case 'cross': R(a, 0, 0, 1, 1); R(b, 0.43, 0, 0.14, 1); R(b, 0, 0.4, 1, 0.2); break;
    case 'five': R(a, 0, 0, 1, .2); R(b, 0, .2, 1, .2); R(c, 0, .4, 1, .2); R('#ffffff', 0, .6, 1, .2); R('#161616', 0, .8, 1, .2); break;
    case 'stripes': for (let i = 0; i < 13; i++) R(i % 2 ? b : a, 0, i / 13, 1, 1 / 13 + 0.002); if (c !== a && c !== b) R(c, 0, 0, .4, 7 / 13); break;
    case 'triangle': R(a, 0, 0, 1, .5); R(b, 0, .5, 1, .5); ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w * .42, y + h / 2); ctx.lineTo(x, y + h); ctx.fill(); break;
    case 'diagband': R(a, 0, 0, 1, 1); ctx.strokeStyle = b; ctx.lineWidth = h * 0.3; ctx.beginPath(); ctx.moveTo(x, y + h); ctx.lineTo(x + w, y); ctx.stroke(); ctx.strokeStyle = c; ctx.lineWidth = h * 0.12; ctx.stroke(); break;
    case 'hbi': R(a, 0, 0, 1, .5); R(b, 0, .5, 1, .5); break;
    case 'vbi': R(a, 0, 0, .5, 1); R(b, .5, 0, .5, 1); break;
    case 'htri': R(a, 0, 0, 1, 1 / 3); R(b, 0, 1 / 3, 1, 1 / 3); R(c, 0, 2 / 3, 1, 1 / 3); break;
    case 'vtri': R(a, 0, 0, 1 / 3, 1); R(b, 1 / 3, 0, 1 / 3, 1); R(c, 2 / 3, 0, 1 / 3, 1); break;
    case 'nordic': R(a, 0, 0, 1, 1); R(b, .28, 0, .16, 1); R(b, 0, .4, 1, .2); R(c, .31, 0, .1, 1); R(c, 0, .44, 1, .12); break;
    case 'saltire': R(a, 0, 0, 1, 1); ctx.strokeStyle = b; ctx.lineWidth = h * 0.18; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y + h); ctx.moveTo(x + w, y); ctx.lineTo(x, y + h); ctx.stroke(); break;
    case 'quarter': R(a, 0, 0, .5, .5); R(b, .5, 0, .5, .5); R(b, 0, .5, .5, .5); R(a, .5, .5, .5, .5); break;
    case 'diag': R(a, 0, 0, 1, 1); ctx.fillStyle = b; ctx.beginPath(); ctx.moveTo(x + w, y); ctx.lineTo(x + w, y + h); ctx.lineTo(x, y + h); ctx.fill(); break;
    case 'chevron': R(a, 0, 0, 1, 1); ctx.fillStyle = b; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w * 0.45, y + h / 2); ctx.lineTo(x, y + h); ctx.fill(); break;
    case 'border': R(b, 0, 0, 1, 1); R(a, .08, .12, .84, .76); break;
    case 'canton': R(a, 0, 0, 1, 1); R(b, 0, 0, .45, .5); for (let i = 1; i < 5; i += 2) R(c, .45, i / 5 * 0.5 + .5 - .05, .55, .07); break;
    default: R(a, 0, 0, 1, 1);
  }
  for (const e of flagEmblems(f)) {
    if (!e.emb || e.emb === 'none') continue;
    ctx.save(); ctx.translate(x + e.ex * w, y + e.ey * h); if (e.er) ctx.rotate(e.er * Math.PI / 180);
    drawEmblem(ctx, e.emb, 0, 0, e.es * h, e.ec);
    ctx.restore();
  }
  if (f.layer) {
    let img = flagImgCache.get(f.layer);
    if (!img) { img = new Image(); img.src = f.layer; flagImgCache.set(f.layer, img); img.onload = () => { G.mapDirty = true; }; }
    if (img.complete) ctx.drawImage(img, x, y, w, h);
  }
  ctx.restore();
}
// The main emblem lives on the flag itself; additional emblems are kept in f.extra
function flagEmblems(f) { return [{ emb: f.emb, ec: f.ec, es: f.es, ex: f.ex, ey: f.ey, er: f.er || 0 }, ...(f.extra || [])]; }
function starPath(ctx, cx, cy, r, n, inner) { ctx.beginPath(); for (let i = 0; i < n * 2; i++) { const a = -Math.PI / 2 + i * Math.PI / n, rr = i % 2 ? r * inner : r; ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } ctx.closePath(); }
function drawEmblem(ctx, e, cx, cy, s, col) {
  ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = s * 0.12;
  const r = s / 2;
  switch (e) {
    case 'star': starPath(ctx, cx, cy, r, 5, 0.42); ctx.fill(); break;
    case 'circle': ctx.beginPath(); ctx.arc(cx, cy, r * 0.8, 0, 7); ctx.fill(); break;
    case 'crescent': ctx.beginPath(); ctx.arc(cx, cy, r * 0.8, 0.5, Math.PI * 2 - 0.5); ctx.arc(cx + r * 0.3, cy, r * 0.62, Math.PI * 2 - 0.6, 0.6, true); ctx.fill(); starPath(ctx, cx + r * 0.55, cy, r * 0.25, 5, 0.42); ctx.fill(); break;
    case 'cross': ctx.fillRect(cx - r * 0.18, cy - r, r * 0.36, r * 2); ctx.fillRect(cx - r * 0.7, cy - r * 0.45, r * 1.4, r * 0.36); break;
    case 'crown': ctx.beginPath(); ctx.moveTo(cx - r, cy + r * 0.6); ctx.lineTo(cx - r, cy - r * 0.4); ctx.lineTo(cx - r * 0.5, cy + r * 0.05); ctx.lineTo(cx, cy - r * 0.7); ctx.lineTo(cx + r * 0.5, cy + r * 0.05); ctx.lineTo(cx + r, cy - r * 0.4); ctx.lineTo(cx + r, cy + r * 0.6); ctx.closePath(); ctx.fill(); break;
    case 'sun': ctx.beginPath(); ctx.arc(cx, cy, r * 0.45, 0, 7); ctx.fill(); for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r * 0.6, cy + Math.sin(a) * r * 0.6); ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); ctx.stroke(); } break;
    case 'shield': ctx.beginPath(); ctx.moveTo(cx - r * 0.75, cy - r * 0.8); ctx.lineTo(cx + r * 0.75, cy - r * 0.8); ctx.lineTo(cx + r * 0.75, cy); ctx.quadraticCurveTo(cx + r * 0.7, cy + r * 0.7, cx, cy + r); ctx.quadraticCurveTo(cx - r * 0.7, cy + r * 0.7, cx - r * 0.75, cy); ctx.closePath(); ctx.fill(); break;
    case 'tower': ctx.fillRect(cx - r * 0.5, cy - r * 0.5, r, r * 1.4); for (let i = 0; i < 3; i++) ctx.fillRect(cx - r * 0.6 + i * r * 0.45, cy - r * 0.8, r * 0.3, r * 0.35); break;
    case 'eagle': ctx.beginPath(); ctx.moveTo(cx, cy - r * 0.6); ctx.lineTo(cx + r, cy - r * 0.8); ctx.lineTo(cx + r * 0.6, cy); ctx.lineTo(cx + r * 0.2, cy + r * 0.1); ctx.lineTo(cx + r * 0.3, cy + r); ctx.lineTo(cx, cy + r * 0.6); ctx.lineTo(cx - r * 0.3, cy + r); ctx.lineTo(cx - r * 0.2, cy + r * 0.1); ctx.lineTo(cx - r * 0.6, cy); ctx.lineTo(cx - r, cy - r * 0.8); ctx.closePath(); ctx.fill(); break;
    case 'sword': ctx.fillRect(cx - r * 0.09, cy - r, r * 0.18, r * 1.5); ctx.fillRect(cx - r * 0.45, cy + r * 0.4, r * 0.9, r * 0.14); ctx.fillRect(cx - r * 0.1, cy + r * 0.5, r * 0.2, r * 0.45); break;
    case 'lion': ctx.beginPath(); ctx.arc(cx - r * 0.35, cy - r * 0.35, r * 0.38, 0, 7); ctx.fill(); ctx.beginPath(); ctx.ellipse(cx + r * 0.15, cy + r * 0.15, r * 0.65, r * 0.38, -0.3, 0, 7); ctx.fill(); ctx.fillRect(cx - r * 0.3, cy + r * 0.3, r * 0.15, r * 0.6); ctx.fillRect(cx + r * 0.45, cy + r * 0.2, r * 0.15, r * 0.7); break;
    case 'fleur':
      ctx.beginPath(); ctx.moveTo(cx, cy - r); ctx.quadraticCurveTo(cx + r * 0.38, cy - r * 0.25, cx, cy + r * 0.2); ctx.quadraticCurveTo(cx - r * 0.38, cy - r * 0.25, cx, cy - r); ctx.fill();
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(cx + s * r * 0.45, cy - r * 0.1, r * 0.17, r * 0.42, s * 0.75, 0, 7); ctx.fill(); }
      ctx.fillRect(cx - r * 0.55, cy + r * 0.12, r * 1.1, r * 0.16);
      ctx.beginPath(); ctx.moveTo(cx - r * 0.2, cy + r * 0.28); ctx.lineTo(cx + r * 0.2, cy + r * 0.28); ctx.lineTo(cx, cy + r * 0.9); ctx.fill(); break;
    case 'hammer':
      ctx.lineCap = 'round'; ctx.lineWidth = r * 0.16;
      ctx.beginPath(); ctx.arc(cx + r * 0.05, cy - r * 0.05, r * 0.62, Math.PI * 0.7, Math.PI * 2.05); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - r * 0.45, cy + r * 0.45); ctx.lineTo(cx - r * 0.7, cy + r * 0.75); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - r * 0.6, cy + r * 0.65); ctx.lineTo(cx + r * 0.25, cy - r * 0.2); ctx.stroke();
      ctx.save(); ctx.translate(cx + r * 0.28, cy - r * 0.23); ctx.rotate(-Math.PI / 4); ctx.fillRect(-r * 0.12, -r * 0.35, r * 0.24, r * 0.7); ctx.restore(); break;
    case 'anchor':
      ctx.lineWidth = r * 0.14; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(cx, cy - r * 0.75, r * 0.18, 0, 7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, cy - r * 0.55); ctx.lineTo(cx, cy + r * 0.85); ctx.moveTo(cx - r * 0.4, cy - r * 0.35); ctx.lineTo(cx + r * 0.4, cy - r * 0.35); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy + r * 0.2, r * 0.65, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke(); break;
    case 'tree':
      for (let i = 0; i < 3; i++) { const yy = cy - r * 0.9 + i * r * 0.45; ctx.beginPath(); ctx.moveTo(cx, yy); ctx.lineTo(cx + r * (0.35 + i * 0.2), yy + r * 0.6); ctx.lineTo(cx - r * (0.35 + i * 0.2), yy + r * 0.6); ctx.fill(); }
      ctx.fillRect(cx - r * 0.1, cy + r * 0.5, r * 0.2, r * 0.45); break;
    case 'wheat':
      ctx.lineWidth = r * 0.08; ctx.beginPath(); ctx.moveTo(cx, cy + r); ctx.lineTo(cx, cy - r * 0.9); ctx.stroke();
      for (let i = 0; i < 5; i++) for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(cx + s * r * 0.17, cy - r * 0.75 + i * r * 0.3, r * 0.1, r * 0.2, s * 0.5, 0, 7); ctx.fill(); } break;
    case 'gear':
      for (let i = 0; i < 8; i++) { ctx.save(); ctx.translate(cx, cy); ctx.rotate(i * Math.PI / 4); ctx.fillRect(-r * 0.14, -r * 0.95, r * 0.28, r * 0.4); ctx.restore(); }
      ctx.lineWidth = r * 0.3; ctx.beginPath(); ctx.arc(cx, cy, r * 0.55, 0, 7); ctx.stroke(); break;
    case 'mountain':
      ctx.beginPath(); ctx.moveTo(cx - r, cy + r * 0.6); ctx.lineTo(cx - r * 0.25, cy - r * 0.7); ctx.lineTo(cx + r * 0.15, cy); ctx.lineTo(cx + r * 0.45, cy - r * 0.35); ctx.lineTo(cx + r, cy + r * 0.6); ctx.closePath(); ctx.fill(); break;
    case 'wave':
      ctx.lineWidth = r * 0.14; ctx.lineCap = 'round';
      for (let k = -1; k <= 1; k++) { ctx.beginPath(); for (let i = 0; i <= 20; i++) { const xx = cx - r + i * r / 10, yy = cy + k * r * 0.45 + Math.sin(i / 20 * Math.PI * 3) * r * 0.15; i ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); } ctx.stroke(); } break;
    case 'moon': ctx.beginPath(); ctx.arc(cx, cy, r * 0.8, 0.5, Math.PI * 2 - 0.5); ctx.arc(cx + r * 0.32, cy, r * 0.6, Math.PI * 2 - 0.62, 0.62, true); ctx.fill(); break;
    case 'bird':
      ctx.beginPath(); ctx.moveTo(cx - r, cy - r * 0.2); ctx.quadraticCurveTo(cx - r * 0.4, cy - r * 0.5, cx, cy + r * 0.2); ctx.quadraticCurveTo(cx + r * 0.4, cy - r * 0.5, cx + r, cy - r * 0.2);
      ctx.quadraticCurveTo(cx + r * 0.4, cy - r * 0.15, cx, cy + r * 0.5); ctx.quadraticCurveTo(cx - r * 0.4, cy - r * 0.15, cx - r, cy - r * 0.2); ctx.fill(); break;
  }
}
function flagCanvas(f, w, h, cls) {
  const cv = document.createElement('canvas'); cv.width = w * 2; cv.height = h * 2; cv.className = 'flag ' + (cls || '');
  cv.style.width = w + 'px'; cv.style.height = h + 'px';
  drawFlag(cv.getContext('2d'), f, 0, 0, w * 2, h * 2);
  return cv;
}
function flagHTML(c, w, h) { const cv = flagCanvas(c.flag, w || 24, h || 16); return `<img class="flag" src="${cv.toDataURL()}" width="${w || 24}" height="${h || 16}" alt="">`; }
const flagUrlCache = new Map();
function flagImg(c, w, h) {
  if (!c.flag) c.flag = randomFlag(mulberry32(c.id * 31 + 7), c.color);
  const f = c.flag;
  const key = c.id + ':' + JSON.stringify(Object.assign({}, f, { layer: f.layer ? f.layer.length : 0 })) + ':' + (f.svg ? (svgReady(f.svg) ? 'L' : 'P') : '');
  if (!flagUrlCache.has(key)) flagUrlCache.set(key, flagCanvas(c.flag, 30, 20).toDataURL());
  return `<img class="flag" src="${flagUrlCache.get(key)}" width="${w || 24}" height="${h || 16}" alt="">`;
}

// ---------- anthems ----------
let audioCtx = null, anthemStop = null;
function playAnthem(a) {
  if (anthemStop) { anthemStop(); anthemStop = null; return; }
  try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { toast('Audio is not available here.'); return; }
  const rng = mulberry32((a.seed || 1) * 131);
  const major = [0, 2, 4, 5, 7, 9, 11, 12], minor = [0, 2, 3, 5, 7, 8, 10, 12];
  const scale = a.style === 'hymn' ? minor : major;
  const tempo = a.style === 'march' ? 0.32 : a.style === 'fanfare' ? 0.22 : 0.5;
  const base = a.style === 'hymn' ? 220 : 261.6;
  const t0 = audioCtx.currentTime + 0.05, nodes = [];
  let deg = 0;
  for (let i = 0; i < 24; i++) {
    deg = clamp(deg + Math.round((rng() - 0.5) * 4), 0, 7);
    if (i % 8 === 7) deg = 0;
    const f = base * Math.pow(2, scale[deg] / 12), dur = tempo * (i % 4 === 3 ? 2 : 1);
    const t = t0 + i * tempo * 1.25;
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = a.style === 'fanfare' ? 'square' : 'triangle'; o.frequency.value = f;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(a.style === 'fanfare' ? 0.06 : 0.14, t + 0.03); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(audioCtx.destination); o.start(t); o.stop(t + dur + 0.05); nodes.push(o);
    if (i % 4 === 0) { const b = audioCtx.createOscillator(), bg = audioCtx.createGain(); b.type = 'sine'; b.frequency.value = base / 2 * Math.pow(2, scale[[0, 4, 3, 0][(i / 4) % 4]] / 12); bg.gain.setValueAtTime(0.12, t); bg.gain.exponentialRampToValueAtTime(0.001, t + tempo * 4.5); b.connect(bg).connect(audioCtx.destination); b.start(t); b.stop(t + tempo * 5); nodes.push(b); }
  }
  anthemStop = () => nodes.forEach(n => { try { n.stop(); } catch (e) { /* already stopped */ } });
  setTimeout(() => { anthemStop = null; }, 24 * tempo * 1250 + 800);
}

// ---------- toasts & tooltips ----------
function toast(msg, kind) {
  const t = document.createElement('div'); t.className = 'toast ' + (kind || ''); t.textContent = msg;
  $('#toasts').appendChild(t); setTimeout(() => t.classList.add('out'), 3200); setTimeout(() => t.remove(), 3700);
}
document.addEventListener('mouseover', e => {
  const el = e.target.closest && e.target.closest('[data-tip]');
  const tip = $('#tooltip');
  if (!el) { tip.hidden = true; return; }
  tip.innerHTML = el.getAttribute('data-tip'); tip.hidden = false;
  const r = el.getBoundingClientRect();
  const x = Math.min(window.innerWidth - tip.offsetWidth - 8, Math.max(8, r.left));
  const y = r.bottom + 6 + tip.offsetHeight > window.innerHeight ? r.top - tip.offsetHeight - 6 : r.bottom + 6;
  tip.style.left = x + 'px'; tip.style.top = y + 'px';
});

// ---------- map modes ----------
function ramp(t) {
  t = clamp(t, 0, 1);
  const a = [44, 52, 66], b = [70, 128, 140], c = [238, 214, 132];
  return t < 0.5 ? a.map((v, i) => lerp(v, b[i], t * 2)) : b.map((v, i) => lerp(v, c[i], t * 2 - 1));
}
const lighten = (c, k) => c.map(v => Math.round(lerp(v, 255, k)));
const strHash = s => { let h = 0; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0; return h; };
const MAP_MODES = {
  political: { name: 'Political', shade: 0.55 },
  terrain: { name: 'Terrain', shade: 1.6 },
  population: { name: 'Population', shade: 0.35 },
  economic: { name: 'Economy', shade: 0.35 },
  military: { name: 'Military', shade: 0.35 },
  infrastructure: { name: 'Infrastructure', shade: 0.35 },
  diplomatic: { name: 'Diplomacy', shade: 0.4 },
  religion: { name: 'Religion', shade: 0.4 },
  culture: { name: 'Culture', shade: 0.4 },
  resource: { name: 'Resources', shade: 0.4 },
  supply: { name: 'Supply', shade: 0.35 },
  technology: { name: 'Technology', shade: 0.4 },
  war: { name: 'War fronts', shade: 0.4 },
  orgs: { name: 'Organizations', shade: 0.4 },
};
function modeColor(p) {
  const m = V.mode, pl = G.player;
  const own = C(p.owner), ctl = C(p.controller);
  const unclaimed = [150, 142, 120];
  switch (m) {
    case 'political': {
      if (!own) return unclaimed;
      const oc = lighten(own.color, 0.12);
      if (ctl && p.controller !== p.owner) return [...lighten(ctl.color, 0.12), ...oc];
      return oc;
    }
    case 'terrain': return TERRAINS[p.terrain].color;
    case 'population': return ramp((Math.log10(Math.max(1000, p.pop)) - 3.6 - Math.log10(ERAS[G.era].popMul)) / 2.2);
    case 'economic': { const s = provStats(p); return ramp((s.money + s.civFac * 4 + s.milFac * 3 + s.food * 0.05 + s.iron + s.coal + s.oil + s.steel) / 30); }
    case 'military': { const s = provStats(p); const n = G.divs.filter(d => d.prov === p.id).length; return own ? (s.fort > 0.5 || n ? ramp(0.2 + s.fort * 0.2 + n * 0.12) : lighten(own.color, 0.55).map(v => v * 0.7)) : unclaimed; }
    case 'infrastructure': return ramp(provStats(p).infra / 4);
    case 'diplomatic': {
      if (!own) return unclaimed;
      if (p.owner === pl) return [212, 172, 70];
      if (atWar(pl, p.owner)) return [190, 60, 50];
      if (own.overlord === pl) return [226, 200, 120];
      if (hasTreaty('alliance', pl, p.owner)) return [70, 120, 190];
      if (hasTreaty('defensive', pl, p.owner) || hasTreaty('nap', pl, p.owner)) return [80, 160, 160];
      const r = rel(pl, p.owner) / 100;
      return r >= 0 ? [lerp(150, 90, r), lerp(150, 170, r), lerp(140, 100, r)] : [lerp(150, 170, -r), lerp(150, 90, -r), lerp(140, 80, -r)];
    }
    case 'religion': return [[214, 182, 80], [122, 86, 150], [90, 140, 200], [110, 160, 110]][RELIGIONS.indexOf(p.religion)] || unclaimed;
    case 'culture': { if (p.culture === 'Unsettled') return unclaimed; const h = strHash(p.culture); return hsl2rgb(Math.abs(h) % 360, 0.38, 0.55); }
    case 'resource': {
      const d = p.dep, best = Object.entries(d).sort((a, b) => b[1] - a[1])[0];
      if (!best || best[1] === 0) return [96, 100, 92];
      const cols = { iron: [160, 90, 70], coal: [60, 60, 66], stone: [170, 166, 150], oil: [30, 30, 30], rubber: [80, 160, 80], aluminum: [170, 200, 220] };
      return lighten(cols[best[0]], 0.12 * (3 - best[1]));
    }
    case 'supply': {
      const c = C(pl); if (!c) return unclaimed;
      if (atWar(pl, p.controller)) return [170, 70, 60];
      const sup = c._supply;
      if (sup && sup[p.id]) return ramp(0.3 + provStats(p).supply / 5);
      return p.controller === pl ? [120, 100, 80] : [88, 90, 92];
    }
    case 'technology': return own ? [[110, 96, 70], [140, 110, 70], [96, 120, 140], [90, 140, 110], [120, 150, 190], [190, 150, 220]][own.era] : unclaimed;
    case 'orgs': {
      if (!own) return unclaimed;
      const sel = (G.orgs || []).find(o => o.id === UI.orgSel);
      if (sel) return sel.members.includes(p.owner) ? sel.color : [92, 96, 96];
      const o = (G.orgs || []).find(x => x.members.includes(p.owner));
      return o ? o.color : [92, 96, 96];
    }
    case 'war': {
      if (!own) return unclaimed;
      const inv = G.wars.filter(w => w.att.includes(p.controller) || w.def.includes(p.controller));
      if (!inv.length) return [92, 96, 96];
      const sideCol = x => { const w = G.wars.find(w => w.att.includes(x) || w.def.includes(x)); return w && w.att.includes(x) ? [196, 84, 64] : [70, 110, 170]; };
      const cc = sideCol(p.controller);
      if (p.controller !== p.owner) return [...cc, ...sideCol(p.owner)];
      return cc;
    }
  }
  return unclaimed;
}
function rebuildBitmap() {
  const opts = { sel: V.sel, shadeAmt: MAP_MODES[V.mode].shade, winter: (V.mode === 'terrain' || V.mode === 'political') && isWinter(), warPairs: (a, b) => atWar(a, b) };
  renderMapBitmap(G.geo, bmpData, modeColor, opts);
  bmpCtx.putImageData(bmpData, 0, 0);
  UI.lastMap = performance.now();
  G.mapDirty = false;
}

// ---------- country labels ----------
let labels = [], labelsKey = '';
function computeLabels() {
  const key = G.provs.map(p => p.owner).join(',') + G.countries.map(c => c.name).join('');
  if (key === labelsKey) return;
  labelsKey = key;
  labels = [];
  for (const c of G.countries) {
    if (!c.alive) continue;
    const ps = G.provs.filter(p => p.owner === c.id);
    if (!ps.length) continue;
    // keep the main landmass so names do not float over the sea
    const comp = new Map(); let best = null, bestA = 0;
    for (const p of ps) {
      if (comp.has(p.id)) continue;
      const set = [p]; comp.set(p.id, set); const q = [p];
      while (q.length) { const x = q.pop(); for (const n of x.neighbors) { const y = G.provs[n]; if (y.owner === c.id && !comp.has(n)) { comp.set(n, set); set.push(y); q.push(y); } } }
      const a = set.reduce((s, y) => s + y.area, 0); if (a > bestA) { bestA = a; best = set; }
    }
    let sx = 0, sy = 0, sa = 0;
    for (const p of best) { sx += p.cx * p.area; sy += p.cy * p.area; sa += p.area; }
    const mx = sx / sa, my = sy / sa;
    let cxx = 0, cyy = 0, cxy = 0;
    for (const p of best) { const dx = p.cx - mx, dy = p.cy - my; cxx += dx * dx * p.area; cyy += dy * dy * p.area; cxy += dx * dy * p.area; }
    let ang = 0.5 * Math.atan2(2 * cxy, cxx - cyy);
    if (Math.abs(ang) > 0.9) ang = ang > 0 ? 0.9 : -0.9;
    const ca = Math.cos(ang), sn = Math.sin(ang);
    let lo = 1e9, hi = -1e9, plo = 1e9, phi = -1e9;
    for (const p of best) { const u = (p.cx - mx) * ca + (p.cy - my) * sn, v = -(p.cx - mx) * sn + (p.cy - my) * ca; lo = Math.min(lo, u); hi = Math.max(hi, u); plo = Math.min(plo, v); phi = Math.max(phi, v); }
    const len = hi - lo + 24, thick = phi - plo + 20;
    const name = c.name.toUpperCase();
    const size = clamp(Math.min(len / (name.length * 0.78), thick * 0.55), 5, 64);
    labels.push({ c, x: mx, y: my, ang, size, name, area: bestA });
  }
}

// ---------- map drawing ----------
function w2s(x, y) { const s = V.scale; return [(x - V.cx) * s + mapCv.clientWidth / 2, (y - V.cy) * s + mapCv.clientHeight / 2]; }
function s2w(x, y) { const s = V.scale; return [(x - mapCv.clientWidth / 2) / s + V.cx, (y - mapCv.clientHeight / 2) / s + V.cy]; }
function provAt(sx, sy) { const [x, y] = s2w(sx, sy); const xi = Math.floor(x), yi = Math.floor(y); if (xi < 0 || yi < 0 || xi >= MW || yi >= MH) return -1; return G.geo.cellProv[yi * MW + xi]; }
function drawMap(now) {
  const ctx = mapCtx, W = mapCv.width, H = mapCv.height;
  if (G.mapDirty && now - UI.lastMap > (G.paused ? 60 : G.mapUrgent ? 90 : 450)) { rebuildBitmap(); G.mapUrgent = false; }
  computeLabels();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#132a35'; ctx.fillRect(0, 0, W, H);
  const s = V.scale * dpr;
  ctx.setTransform(s, 0, 0, s, W / 2 - V.cx * s, H / 2 - V.cy * s);
  ctx.imageSmoothingEnabled = V.scale < 2.5;
  ctx.drawImage(bmpCv, 0, 0);
  drawFlashes(ctx, now);
  // rivers
  ctx.strokeStyle = 'rgba(62,112,140,0.95)'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const r of G.geo.rivers) {
    ctx.beginPath(); ctx.moveTo(r[0][0], r[0][1]);
    for (let i = 1; i < r.length; i++) { ctx.lineTo(r[i][0], r[i][1]); }
    ctx.lineWidth = Math.max(0.9, 1.6 / V.scale); ctx.stroke();
  }
  // trade routes
  if (['political', 'economic', 'diplomatic'].includes(V.mode)) {
    ctx.setLineDash([3, 3]); ctx.lineWidth = Math.max(0.6, 1.2 / V.scale);
    const t = (now / 4000) % 1;
    for (const tr of G.diplo.treaties) {
      if (tr.type !== 'trade') continue;
      if (V.mode === 'political' && tr.a !== G.player && tr.b !== G.player) continue;
      const a = G.provs[C(tr.a).capital], b = G.provs[C(tr.b).capital];
      if (!a || !b) continue;
      const mx = (a.cx + b.cx) / 2 + (b.cy - a.cy) * 0.15, my = (a.cy + b.cy) / 2 - (b.cx - a.cx) * 0.15;
      ctx.strokeStyle = (tr.a === G.player || tr.b === G.player) ? 'rgba(240,206,120,0.85)' : 'rgba(230,220,190,0.35)';
      ctx.beginPath(); ctx.moveTo(a.cx, a.cy); ctx.quadraticCurveTo(mx, my, b.cx, b.cy); ctx.stroke();
      const q = (1 - t) * (1 - t), r2 = 2 * (1 - t) * t, u = t * t;
      ctx.fillStyle = '#f2dca0'; ctx.beginPath(); ctx.arc(q * a.cx + r2 * mx + u * b.cx, q * a.cy + r2 * my + u * b.cy, Math.max(1.2, 2.5 / V.scale), 0, 7); ctx.fill();
    }
    ctx.setLineDash([]);
  }
  // country names
  if (['political', 'diplomatic', 'war', 'technology'].includes(V.mode)) {
    for (const L of labels) {
      const px = L.size * V.scale;
      if (px < 7 || px > 160) continue;
      ctx.save(); ctx.translate(L.x, L.y); ctx.rotate(L.ang);
      ctx.font = `${L.size}px 'IM Fell English SC', Georgia, serif`;
      if ('letterSpacing' in ctx) ctx.letterSpacing = (L.size * 0.18) + 'px';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(24,18,10,0.55)'; ctx.fillText(L.name, 0, 0);
      ctx.restore();
    }
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  // settlements and capitals
  const showCities = V.scale > 1.3;
  for (const p of G.provs) {
    if (p.owner < 0) continue;
    const s2 = provStats(p);
    const isCap = C(p.owner).capital === p.id;
    if (!isCap && (!showCities || s2.nb < 4)) continue;
    const [x, y] = w2s(p.cx, p.cy);
    if (x < -20 || y < -20 || x > mapCv.clientWidth + 20 || y > mapCv.clientHeight + 20) continue;
    if (isCap) { ctx.fillStyle = '#f3e3b0'; ctx.strokeStyle = '#2a2014'; ctx.lineWidth = 1.2; starPath(ctx, x, y - 8, 5.5, 5, 0.45); ctx.fill(); ctx.stroke(); }
    else {
      const big = s2.nb > 12, fort = s2.fort >= 2, ind = s2.milFac + s2.civFac > 2;
      ctx.fillStyle = '#efe4c8'; ctx.strokeStyle = '#2a2014'; ctx.lineWidth = 1;
      const sz = big ? 5 : 3.5;
      if (fort) { ctx.fillRect(x - sz, y - sz - 6, sz * 2, sz * 1.6); ctx.strokeRect(x - sz, y - sz - 6, sz * 2, sz * 1.6); ctx.fillRect(x - sz, y - sz - 8, 2, 2); ctx.fillRect(x + sz - 2, y - sz - 8, 2, 2); }
      else { ctx.beginPath(); ctx.arc(x, y - 6, sz * 0.8, 0, 7); ctx.fill(); ctx.stroke(); }
      if (ind) { ctx.fillStyle = '#6a625a'; ctx.fillRect(x + sz, y - 12, 2, 6); }
    }
    if (V.scale > 2.6) { ctx.font = "500 11px 'Barlow Semi Condensed', sans-serif"; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(20,16,10,0.85)'; ctx.fillText(p.name, x, y + 9); }
  }
  // sieges & battles
  for (const p of G.provs) if (p.siege) { const [x, y] = w2s(p.cx, p.cy); drawSiege(ctx, x + 14, y - 14, p.siege.prog); }
  for (const p of G.provs) if (p.fallout > G.day) { const [x, y] = w2s(p.cx, p.cy); drawFallout(ctx, x, y - 4); }
  drawBlasts(ctx, now);
  for (const b of G.battles) { const p = G.provs[b.prov]; const [x, y] = w2s(p.cx, p.cy); drawBattleIcon(ctx, x, y - 22, b); }
  drawUnits(ctx);
  // province label on hover
  if (V.hover >= 0 && UI.phase !== 'menu') {
    const p = G.provs[V.hover];
    const [x, y] = w2s(p.cx, p.cy);
    ctx.font = "600 12px 'Barlow Semi Condensed', sans-serif"; ctx.textAlign = 'center';
    const txt = p.name + (C(p.owner) ? ' · ' + C(p.owner).name : ' · Unclaimed');
    const w = ctx.measureText(txt).width + 12;
    ctx.fillStyle = 'rgba(14,18,20,0.82)'; ctx.fillRect(x - w / 2, y + 12, w, 18);
    ctx.fillStyle = '#ece3cc'; ctx.fillText(txt, x, y + 25);
  }
}
// Captured provinces flash in the new controller's color, then settle into the redrawn map
const maskCache = new Map();
function provMask(p, col) {
  const key = p.id + ':' + col.join(',');
  if (maskCache.has(key)) return maskCache.get(key);
  if (maskCache.size > 150) maskCache.clear();
  const w = p.maxx - p.minx + 1, h = p.maxy - p.miny + 1;
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const cx = cv.getContext('2d'), img = cx.createImageData(w, h), cp = G.geo.cellProv;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (cp[(p.miny + y) * MW + p.minx + x] !== p.id) continue;
    const o = (y * w + x) * 4; img.data[o] = col[0]; img.data[o + 1] = col[1]; img.data[o + 2] = col[2]; img.data[o + 3] = 255;
  }
  cx.putImageData(img, 0, 0);
  maskCache.set(key, cv);
  return cv;
}
function drawFlashes(ctx, now) {
  const fl = G.flashes;
  if (!fl || !fl.length) return;
  for (let i = fl.length - 1; i >= 0; i--) {
    const f = fl[i], age = (now - f.t) / 1100;
    if (age >= 1 || age < 0 || !C(f.to)) { fl.splice(i, 1); continue; }
    const p = G.provs[f.prov], col = lighten(C(f.to).color, 0.25);
    ctx.globalAlpha = 0.9 * (1 - age) * (1 - age);
    ctx.drawImage(provMask(p, col), p.minx, p.miny);
    ctx.globalAlpha = 1 - age;
    ctx.strokeStyle = rgbStr(lighten(C(f.to).color, 0.5)); ctx.lineWidth = Math.max(0.8, 2.2 / V.scale);
    ctx.beginPath(); ctx.arc(p.cx, p.cy, 3 + age * 22, 0, 7); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
// Radiation trefoil over provinces still under fallout
function drawFallout(ctx, x, y) {
  ctx.fillStyle = '#f2d23a'; ctx.strokeStyle = '#1a1a14'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(x, y, 9, 0, 7); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#1a1a14';
  for (let i = 0; i < 3; i++) { const a = -Math.PI / 2 + i * Math.PI * 2 / 3; ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, 7.5, a - 0.5, a + 0.5); ctx.closePath(); ctx.fill(); }
  ctx.fillStyle = '#f2d23a'; ctx.beginPath(); ctx.arc(x, y, 2.6, 0, 7); ctx.fill();
  ctx.fillStyle = '#1a1a14'; ctx.beginPath(); ctx.arc(x, y, 1.6, 0, 7); ctx.fill();
}
// A nuclear blast: white flash, then a fireball and shock ring spreading over a few seconds
function drawBlasts(ctx, now) {
  const bl = G.blasts; if (!bl || !bl.length) return;
  for (let i = bl.length - 1; i >= 0; i--) {
    const b = bl[i], age = (now - b.t) / 3500;
    if (age >= 1 || age < 0) { bl.splice(i, 1); continue; }
    const p = G.provs[b.prov]; const [x, y] = w2s(p.cx, p.cy);
    const R = (12 + age * 70) * Math.max(1, V.scale);
    const g = ctx.createRadialGradient(x, y, 0, x, y, R);
    g.addColorStop(0, `rgba(255,255,240,${0.95 * (1 - age)})`); g.addColorStop(0.35, `rgba(255,190,80,${0.8 * (1 - age)})`); g.addColorStop(1, 'rgba(160,40,10,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R, 0, 7); ctx.fill();
    ctx.strokeStyle = `rgba(255,240,210,${0.7 * (1 - age)})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, R * 1.25, 0, 7); ctx.stroke();
  }
}
function drawSiege(ctx, x, y, prog) {
  ctx.fillStyle = 'rgba(20,16,12,0.85)'; ctx.fillRect(x - 10, y - 9, 20, 18);
  ctx.fillStyle = '#c9b48a'; ctx.fillRect(x - 6, y - 3, 12, 8); ctx.fillRect(x - 6, y - 6, 3, 3); ctx.fillRect(x + 3, y - 6, 3, 3);
  ctx.fillStyle = '#d0573e'; ctx.fillRect(x - 10, y + 9, 20 * prog, 3);
}
function drawBattleIcon(ctx, x, y, b) {
  const r = b.ratio || 1, good = b.att === G.player ? r >= 1 : b.def === G.player ? r < 1 : null;
  ctx.fillStyle = good == null ? 'rgba(40,30,24,0.9)' : good ? 'rgba(46,92,58,0.95)' : 'rgba(128,40,32,0.95)';
  ctx.beginPath(); ctx.arc(x, y, 11, 0, 7); ctx.fill();
  ctx.strokeStyle = '#f2e6c8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 5, y - 5); ctx.lineTo(x + 5, y + 5); ctx.moveTo(x + 5, y - 5); ctx.lineTo(x - 5, y + 5); ctx.stroke();
  UI.unitRects.push({ x: x - 11, y: y - 11, w: 22, h: 22, battle: b.id });
}
function drawUnits(ctx) {
  UI.unitRects = UI.unitRects.filter(r => r.battle);
  const groups = new Map();
  if (UI.phase === 'menu' || UI.phase === 'pick') return;
  // when zoomed out, only show your own armies and those you are fighting
  const far = V.scale < 1.6;
  for (const d of G.divs) {
    if (d.state === 'training' && d.owner !== G.player) continue;
    if (far && d.owner !== G.player && !atWar(G.player, d.owner)) continue;
    // marching divisions get their own counter that glides along the route
    const k = d.state === 'moving' && d.path.length ? 'm' + d.id : d.prov + ':' + d.owner;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(d);
  }
  // movement arrows first
  for (const d of G.divs) {
    if (!d.path.length || d.state === 'training') continue;
    if (d.owner !== G.player && !atWar(G.player, d.owner) && V.scale < 1.6) continue;
    const a = G.provs[d.prov], b = G.provs[d.path[0]];
    const [x1, y1] = w2s(a.cx, a.cy), [x2, y2] = w2s(b.cx, b.cy);
    const atk = d.state === 'battle' || d.state === 'siege' || atWar(d.owner, b.controller);
    ctx.strokeStyle = d.owner === G.player ? (atk ? '#e8a24a' : 'rgba(240,230,200,0.9)') : atk ? 'rgba(210,70,50,0.9)' : 'rgba(30,30,30,0.6)';
    ctx.lineWidth = atk ? 4 : 2;
    const px = x1 + (x2 - x1) * Math.min(1, d.prog), py = y1 + (y2 - y1) * Math.min(1, d.prog);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    const ang = Math.atan2(y2 - y1, x2 - x1);
    ctx.fillStyle = ctx.strokeStyle; ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x2 - Math.cos(ang - 0.45) * 11, y2 - Math.sin(ang - 0.45) * 11); ctx.lineTo(x2 - Math.cos(ang + 0.45) * 11, y2 - Math.sin(ang + 0.45) * 11); ctx.fill();
    ctx.beginPath(); ctx.arc(px, py, 3, 0, 7); ctx.fill();
    if (d.owner === G.player && d.path.length > 1 && UI.selDivs.has(d.id)) {
      ctx.setLineDash([4, 4]); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(240,230,200,0.6)'; ctx.beginPath(); ctx.moveTo(x2, y2);
      for (let i = 1; i < d.path.length; i++) { const q = G.provs[d.path[i]]; const [x, y] = w2s(q.cx, q.cy); ctx.lineTo(x, y); }
      ctx.stroke(); ctx.setLineDash([]);
    }
  }
  const perProv = new Map();
  for (const [k, list] of groups) {
    const p = G.provs[list[0].prov];
    let x, y;
    if (k[0] === 'm') {
      const d = list[0], nxt = G.provs[d.path[0]];
      if (d._vpProv !== d.prov) { d._vpProv = d.prov; d._vp = 0; }
      d._vp = (d._vp || 0) + (Math.min(1, d.prog) - (d._vp || 0)) * 0.12;
      const t = d._vp * d._vp * (3 - 2 * d._vp);
      [x, y] = w2s(lerp(p.cx, nxt.cx, t), lerp(p.cy, nxt.cy, t));
      y += 8;
    } else {
      const idx = perProv.get(p.id) || 0; perProv.set(p.id, idx + 1);
      [x, y] = w2s(p.cx, p.cy);
      x += idx * 20 - 4; y += 8 + idx * 4;
    }
    if (x < -40 || y < -40 || x > mapCv.clientWidth + 40 || y > mapCv.clientHeight + 40) continue;
    const c = C(list[0].owner);
    const sel = list.some(d => UI.selDivs.has(d.id));
    const w = 30, h = 18;
    ctx.fillStyle = 'rgba(12,12,12,0.7)'; ctx.fillRect(x - w / 2 - 1, y - h / 2 - 1, w + 2, h + 8);
    ctx.fillStyle = rgbStr(c.color); ctx.fillRect(x - w / 2, y - h / 2, w, h);
    const train = list.every(d => d.state === 'training');
    if (train) { ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(x - w / 2, y - h / 2, w, h); }
    ctx.strokeStyle = sel ? '#ffd76a' : '#14110c'; ctx.lineWidth = sel ? 2.2 : 1; ctx.strokeRect(x - w / 2, y - h / 2, w, h);
    ctx.fillStyle = '#fff8e6'; ctx.font = "700 11px 'IBM Plex Mono', monospace"; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(train ? '…' + list.length : String(list.length), x, y + 1);
    const str = list.reduce((s, d) => s + d.str, 0) / list.length, org = list.reduce((s, d) => s + d.org, 0) / list.length;
    ctx.fillStyle = '#5fbf6a'; ctx.fillRect(x - w / 2, y + h / 2 + 1, w * str, 2.5);
    ctx.fillStyle = '#e0c24a'; ctx.fillRect(x - w / 2, y + h / 2 + 4, w * org, 2.5);
    ctx.textBaseline = 'alphabetic';
    UI.unitRects.push({ x: x - w / 2, y: y - h / 2, w, h: h + 7, divs: list.map(d => d.id), owner: c.id });
  }
}

// ---------- HUD ----------
function buildHUD() {
  const left = [['overview', 'Country overview'], ['build', 'Construction'], ['military', 'Military'], ['production', 'Production'], ['research', 'Research'], ['diplomacy', 'Diplomacy'], ['orgs', 'Organizations'], ['economy', 'Economy'], ['laws', 'Laws & government'], ['people', 'Population'], ['trade', 'Trade'], ['editor', 'Map editor'], ['menu', 'Game menu']];
  $('#leftbar').innerHTML = left.map(([k, n]) => `<button class="lb" data-act="panel" data-id="${k}" data-tip="${n}" aria-label="${n}">${icon(k)}</button>`).join('');
  $('#modes').innerHTML = Object.entries(MAP_MODES).map(([k, m]) => `<button class="mm ${k === V.mode ? 'on' : ''}" data-act="mapmode" data-id="${k}">${m.name}</button>`).join('');
  $('#speed').innerHTML = `<button class="sp" data-act="pause" data-tip="Pause / resume (Space)" id="btn-pause">${icon('pause')}</button>` + [1, 2, 5, 10].map(s => `<button class="sp" data-act="speed" data-id="${s}" data-tip="Speed ${s}x">${s}x</button>`).join('');
}
const SPEED_DPS = { 1: 1.2, 2: 2.6, 5: 7, 10: 16 };
function refreshTop() {
  const c = C(G.player);
  if (!c) return;
  const net = (c.income || 0) - (c.expense || 0);
  const res = ['food', 'wood', 'stone', 'iron', 'coal', 'steel', 'oil', 'rubber', 'aluminum'].filter(r => c.era >= 2 || !['coal', 'oil', 'rubber', 'aluminum'].includes(r) || c.stock[r] > 0);
  $('#topstats').innerHTML = `
    <div class="tcountry" data-act="panel" data-id="overview">${flagImg(c, 36, 24)}<div><b>${esc(c.name)}</b><small>${esc(GOVERNMENTS[c.gov] ? GOVERNMENTS[c.gov].name : c.gov)} · ${ERAS[c.era].name}</small></div></div>
    <div class="ts" data-tip="Treasury<br>Income ${fmt(c.income || 0)}/day · Expenses ${fmt(c.expense || 0)}/day${c.inflation > 0.01 ? '<br>Inflation ' + (c.inflation * 100).toFixed(1) + '%' : ''}">${icon('coin')}<span class="num ${c.treasury < 0 ? 'bad' : ''}">${fmt(c.treasury)}</span><small class="${net < 0 ? 'bad' : 'good'}">${net >= 0 ? '+' : ''}${fmt(net)}</small></div>
    <div class="ts" data-tip="Political power — spent on diplomacy and laws">${icon('pp')}<span class="num">${Math.floor(c.pp)}</span></div>
    <div class="ts" data-tip="Available manpower (cap ${fmt(c.mpCap || 0)})">${icon('mp')}<span class="num">${fmt(c.manpower)}</span></div>
    <div class="ts" data-tip="Population">${icon('pop')}<span class="num">${fmt(c.agg.pop || 0)}</span></div>
    <div class="ts" data-tip="Stability (target ${Math.round(c.stabTarget || c.stability)}%)${c.warEx > 1 ? '<br>War exhaustion ' + Math.round(c.warEx) + '%' : ''}">${icon('stab')}<span class="num ${c.stability < 30 ? 'bad' : ''}">${Math.round(c.stability)}%</span></div>
    <div class="ts" data-tip="Research points per day${c.researching ? '<br>Researching ' + TECH_BY_ID[c.researching].name : '<br>No active research!'}" data-act="panel" data-id="research">${icon('research')}<span class="num ${c.researching ? '' : 'warn'}">${(c.rpDay || 0).toFixed(1)}</span></div>
    <div class="tres">${res.map(r => { const f = (c.flow || {})[r] || 0; return `<div class="tr" data-tip="${RES_NAMES[r]}: ${fmt(c.stock[r])} in stock, ${f >= 0 ? '+' : ''}${f.toFixed(1)}/day"><i class="rdot r-${r}"></i><span class="num">${fmt(c.stock[r])}</span><small class="${f < -0.05 ? 'bad' : ''}">${f >= 0 ? '+' : ''}${Math.abs(f) >= 10 ? Math.round(f) : f.toFixed(1)}</small></div>`; }).join('')}</div>`;
  $('#date').textContent = dateStr(G.day);
  $('#btn-pause').innerHTML = G.paused ? icon('play') : icon('pause');
  $('#btn-pause').classList.toggle('on', G.paused);
  document.querySelectorAll('#speed [data-act=speed]').forEach(b => b.classList.toggle('on', +b.dataset.id === G.speed));
  $('#pausedTag').hidden = !G.paused;
}

// ---------- notifications ----------
const NOTE_CATS = { all: 'All', war: 'War', build: 'Construction', diplo: 'Diplomacy', event: 'Events' };
function noteCat(t) { return t === 'military' ? 'war' : t === 'research' ? 'event' : t === 'world' ? 'diplo' : t; }
function renderNotes() {
  const f = UI.notesFilter;
  const list = G.notes.filter(n => (!n.inv || n.inv.includes(G.player)) && (f === 'all' || noteCat(n.type) === f)).slice(0, 50);
  $('#notefilters').innerHTML = Object.entries(NOTE_CATS).map(([k, v]) => `<button class="chip ${k === f ? 'on' : ''}" data-act="notefilter" data-id="${k}">${v}</button>`).join('');
  const shortDate = day => { const t = dateOf(day); return `${t.d} ${MONTHS[t.m].slice(0, 3)}<br>${t.y}`; };
  $('#notes').innerHTML = list.map(n => `<div class="note n-${noteCat(n.type)}" ${n.prov >= 0 ? `data-act="gotoprov" data-id="${n.prov}"` : ''}><small>${shortDate(n.day)}</small><span>${esc(n.text)}</span></div>`).join('') || '<p class="muted">Nothing to report.</p>';
  // construction progress summary
  const c = C(G.player);
  if (c) {
    const prog = [];
    for (const p of c._provs || []) for (const b of p.buildings) if (b.prog < 1 || b.upg != null || b.rep != null) prog.push([p, b]);
    $('#buildprog').innerHTML = prog.length ? `<h4>Construction (${prog.length})</h4>` + prog.slice(0, 6).map(([p, b]) => { const v = b.prog < 1 ? b.prog : b.upg != null ? b.upg : b.hp / 100; return `<div class="bp" data-act="gotoprov" data-id="${p.id}"><span>${BUILDINGS[b.t].name}${b.upg != null ? ' ↑' : b.rep != null ? ' (repair)' : ''} <small>${esc(p.name)}</small></span><i style="--v:${Math.round(v * 100)}%"></i></div>`; }).join('') : '';
  }
}
let noteTimer = 0;
window.UIHooks = {
  note(n) { if (UI.phase === 'game') { clearTimeout(noteTimer); noteTimer = setTimeout(renderNotes, 120); if ((!n.inv || n.inv.includes(G.player)) && n.text.includes('declared war')) toast(n.text, 'war'); } },
  popup() { if (UI.phase === 'game' || UI.phase === 'province' || UI.phase === 'battle') showNextPopup(); },
  divRemoved(id) { UI.selDivs.delete(id); },
  battleEnded() { },
  peaceConference(w) { openPeace(w); },
  gameOver() { popup('Your Nation Has Fallen', `${C(G.player).name} has been wiped from the map. History will remember you.`, [{ label: 'Return to main menu', fn: () => toMenu() }], true); },
  p3Place(t, x, z, r) { p3PlaceBuilding(t, x, z, r); },
  p3Segment(t, x1, z1, x2, z2) { p3PlaceSegment(t, x1, z1, x2, z2); },
  p3Demolish(hit) { p3DoDemolish(hit); },
  p3Select(id) { UI.p3sel = id; renderProvUI(); },
  battleViewOver(b) { renderBattleUI(); },
};

// ---------- modals & popups ----------
function modal(title, html, buttons, opts) {
  const root = $('#modals');
  const m = document.createElement('div');
  m.className = 'modal-back';
  m.innerHTML = `<div class="modal ${opts && opts.wide ? 'wide' : ''} ${opts && opts.cls || ''}" role="dialog" aria-modal="true"><header><h2>${title}</h2><button class="x" data-close aria-label="Close">×</button></header><div class="mbody"></div><footer></footer></div>`;
  const body = m.querySelector('.mbody');
  if (typeof html === 'string') body.innerHTML = html; else body.appendChild(html);
  const foot = m.querySelector('footer');
  const close = () => { m.remove(); if (opts && opts.onClose) opts.onClose(); };
  (buttons || [{ label: 'Close' }]).forEach((b, i) => {
    const bt = document.createElement('button'); bt.className = 'btn ' + (b.cls || (i === 0 ? 'primary' : '')); bt.textContent = b.label;
    bt.onclick = () => { const r = b.fn ? b.fn(m) : null; if (r !== false) close(); };
    foot.appendChild(bt);
  });
  if (opts && opts.noClose) m.querySelector('[data-close]').remove(); else m.querySelector('[data-close]').onclick = close;
  root.appendChild(m);
  m.close = close;
  return m;
}
function showNextPopup() {
  if (document.querySelector('.modal-back.popup') || !G.popups.length) return;
  const pp = G.popups.shift();
  const m = modal(esc(pp.title), `<p class="pre">${esc(pp.text)}</p>`, pp.buttons.map(b => ({ label: b.label, fn: () => { if (b.fn) b.fn(); setTimeout(showNextPopup, 50); } })), { noClose: true, cls: 'event' });
  m.classList.add('popup');
}

// ---------- side panels ----------
function openPanel(id) {
  if (id === 'editor') { closePanel(); startEditor(); return; }
  if (id === 'menu') { openGameMenu(); return; }
  UI.panel = UI.panel === id ? null : id;
  document.querySelectorAll('#leftbar .lb').forEach(b => b.classList.toggle('on', b.dataset.id === UI.panel));
  $('#panel').hidden = !UI.panel;
  if (UI.panel) renderPanel(true);
}
function closePanel() { UI.panel = null; $('#panel').hidden = true; document.querySelectorAll('#leftbar .lb').forEach(b => b.classList.remove('on')); }
function renderPanel(force) {
  if (!UI.panel || UI.phase !== 'game') return;
  const el = $('#panel');
  if (!force && el.contains(document.activeElement) && /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return;
  const st = el.querySelector('.pbody') ? el.querySelector('.pbody').scrollTop : 0;
  const fn = PANELS[UI.panel];
  el.innerHTML = `<header><h2>${PANEL_TITLES[UI.panel]}</h2><button class="x" data-act="closepanel" aria-label="Close panel">×</button></header><div class="pbody">${fn ? fn(C(G.player)) : ''}</div>`;
  el.querySelector('.pbody').scrollTop = st;
}
const PANEL_TITLES = { overview: 'Country Overview', build: 'Construction', military: 'Military', production: 'Military Production', research: 'Research', diplomacy: 'Diplomacy', economy: 'Economy', laws: 'Laws & Government', people: 'Population', trade: 'Trade' };
const bar = (v, cls) => `<i class="bar ${cls || ''}" style="--v:${Math.round(clamp(v, 0, 1) * 100)}%"></i>`;
const row = (k, v, tip) => `<div class="row" ${tip ? `data-tip="${tip}"` : ''}><span>${k}</span><b>${v}</b></div>`;

const PANELS = {
  overview(c) {
    const wars = G.wars.filter(w => w.att.includes(c.id) || w.def.includes(c.id));
    return `<div class="ovhead">${flagImg(c, 96, 64)}<div><h3>${esc(c.name)}</h3><p class="muted">${esc(GOVERNMENTS[c.gov].name)} · ${esc(c.ideology)}<br>Ruler: ${esc(c.leader)}</p>
      <div class="btnrow"><button class="btn sm" data-act="editflag">Edit flag</button><button class="btn sm" data-act="renamecountry">Rename</button><button class="btn sm" data-act="anthem">${anthemStop ? 'Stop anthem' : 'Play anthem'}</button></div></div></div>
      <div class="grid2">${row('Era', ERAS[c.era].name)}${row('Capital', esc(G.provs[c.capital] ? G.provs[c.capital].name : '—'))}${row('Provinces', c.nProv)}${row('Population', fmt(c.agg.pop))}${row('Culture', esc(c.culture))}${row('Religion', esc(c.religion))}${row('Personality', 'Player')}${row('Doctrine', esc(DOCTRINES[c.doctrine] || c.doctrine))}${row('Divisions', G.divs.filter(d => d.owner === c.id).length)}${row('Military factories', c.agg.milFac.toFixed(1))}${row('Civilian factories', c.agg.civFac.toFixed(1))}${row('Fortification (sum)', c.agg.fort.toFixed(1))}</div>
      <h4>Wars</h4>${wars.length ? wars.map(w => { const side = w.att.includes(c.id) ? 'att' : 'def'; return `<div class="card"><b>${esc(w.name)}</b><small>${esc(w.reason)} · since ${dateStr(w.start)}</small><div class="row"><span>War score</span><b class="${warScore(w, side) < 0 ? 'bad' : 'good'}">${warScore(w, side)}</b></div></div>`; }).join('') : '<p class="muted">At peace.</p>'}
      <h4>Goal</h4><p class="muted">Grow from your first villages into a great power: build in your provinces, research new eras, field armies and expand by diplomacy or conquest.</p>`;
  },
  build(c) {
    const prog = [];
    for (const p of c._provs) for (const b of p.buildings) if (b.prog < 1 || b.upg != null || b.rep != null) prog.push([p, b]);
    const p = G.provs[V.sel];
    const mine = p && p.owner === c.id && p.controller === c.id;
    const avail = Object.keys(BUILDINGS).filter(t => hasTech(c, BUILDINGS[t].tech));
    const cap = 3 + c.agg.civFac * 0.6 + c.era;
    return `<p class="muted">Enter a province to place buildings freely in 3D, or use quick build to let your architects choose a spot.</p>
      ${row('Construction capacity', `${prog.length} active / ${cap.toFixed(1)} parallel`, 'More civilian factories allow more parallel projects')}
      <h4>Quick build ${mine ? 'in ' + esc(p.name) : ''}</h4>
      ${mine ? `<div class="qb">${avail.map(t => { const B = BUILDINGS[t], cost = scaledCost(c, B.cost); return `<button class="bcard ${canAfford(c, cost) ? '' : 'dim'}" data-act="quickbuild" data-id="${t}" data-tip="${esc(effText(B))}<br>${costText(cost)} · ${B.days} days"><b>${B.name}</b><small>${costText(cost)}</small></button>`; }).join('')}</div>
      <div class="btnrow"><button class="btn primary" data-act="enterprov" data-id="${p.id}">Enter ${esc(p.name)}</button></div>` : '<p class="muted">Select one of your provinces on the map.</p>'}
      <h4>In progress</h4>${prog.length ? prog.map(([q, b]) => { const v = b.prog < 1 ? b.prog : b.upg != null ? b.upg : b.hp / 100; return `<div class="bp" data-act="gotoprov" data-id="${q.id}"><span>${BUILDINGS[b.t].name}${b.upg != null ? ' (upgrade)' : b.rep != null ? ' (repair)' : ''} <small>${esc(q.name)}</small></span><i style="--v:${Math.round(v * 100)}%"></i></div>`; }).join('') : '<p class="muted">No projects.</p>'}
      <h4>Damaged buildings</h4>${(() => { const dmg = []; for (const q of c._provs) for (const b of q.buildings) if (b.hp < 100 && b.rep == null && b.prog >= 1) dmg.push([q, b]); return dmg.length ? dmg.slice(0, 12).map(([q, b]) => `<div class="row"><span>${BUILDINGS[b.t].name} <small>${esc(q.name)} · ${Math.round(b.hp)}%</small></span><button class="btn sm" data-act="repair" data-prov="${q.id}" data-id="${b.id}">Repair ${costText(repairCost(c, b))}</button></div>`).join('') : '<p class="muted">Nothing damaged.</p>'; })()}`;
  },
  military(c) {
    const divs = G.divs.filter(d => d.owner === c.id);
    const p = G.provs[V.sel];
    const site = p && p.owner === c.id && provStats(p).recruit >= 1 ? p : G.provs.find(q => q.owner === c.id && q.controller === c.id && provStats(q).recruit >= 1);
    return `${row('Manpower', fmt(c.manpower))}${row('Training site', site ? esc(site.name) : '<span class="bad">None — build Barracks</span>', 'Select a province with Barracks or a Military Base to train there')}
      <div class="btnrow"><button class="btn" data-act="divdesigner">Division designer</button>${c.era >= 3 ? '<button class="btn" data-act="tankdesigner">Tank designer</button>' : ''}</div>
      <h4>Templates</h4>${c.templates.map(t => { const s = divStats(c, t.bats, null); const err = site ? recruitCheck(c, t, site) : 'No training site'; return `<div class="card"><div class="row"><b>${esc(t.name)}</b><span class="muted">${t.bats.length} battalions</span></div><small>${summarizeBats(t.bats)}</small><div class="stats">⚔ ${s.sa.toFixed(0)}/${s.ha.toFixed(0)} · ⛨ ${s.df.toFixed(0)} · spd ${s.spd.toFixed(1)} · ${fmt(s.mp)} men</div><div class="btnrow"><button class="btn sm ${err ? 'dim' : 'primary'}" data-act="train" data-id="${t.id}" data-site="${site ? site.id : -1}" ${err ? `data-tip="${esc(err)}"` : ''}>Train</button><button class="btn sm" data-act="divdesigner" data-id="${t.id}">Edit</button></div></div>`; }).join('')}
      <h4>Divisions (${divs.length})</h4>
      <div class="btnrow"><button class="btn sm" data-act="selall">Select all</button><button class="btn sm" data-act="autoall">Toggle auto-advance</button></div>
      ${divs.map(d => `<div class="drow ${UI.selDivs.has(d.id) ? 'on' : ''}" data-act="seldiv" data-id="${d.id}"><span>${esc(d.name)} <small>${esc(G.provs[d.prov].name)} · ${d.state}${d.auto ? ' · auto' : ''}${d.supplied ? '' : ' · <b class=bad>no supply</b>'}</small></span><span class="mini">${bar(d.str, 'g')}${bar(d.org, 'y')}</span></div>`).join('') || '<p class="muted">No divisions.</p>'}
      <h4>Doctrine</h4><div class="seg">${Object.entries(DOCTRINES).map(([k, v]) => `<button class="chip ${c.doctrine === k ? 'on' : ''}" data-act="doctrine" data-id="${k}">${v}</button>`).join('')}</div>`;
  },
  production(c) {
    const keys = ['arms', 'artillery', 'support', 'vehicles', 'aircraft', 'ships', 'nukes', ...c.designs.map(d => 'tank:' + d.id)].filter(k => !EQUIP[k] || ((!EQUIP[k].minEra || c.era >= EQUIP[k].minEra) && (!EQUIP[k].tech || hasTech(c, EQUIP[k].tech)) ) || (k === 'nukes' && c.equip.nukes > 0));
    return `${row('Military factories', c.agg.milFac.toFixed(1), 'Blacksmiths, military factories and tank factories')}${row('Unassigned', (c.facFree || 0).toFixed(1))}${row('Efficiency', Math.round((c.indF || 1) * (c.laws.economy === 'war' ? 1.25 : c.laws.economy === 'civilian' ? 0.85 : 1) * 100) + '%', 'Affected by economy law, coal and electricity supply')}
      <h4>Production lines</h4>
      ${c.lines.map((L, i) => `<div class="card"><div class="row"><b>${esc(lineEquipName(c, L.eq))}</b><button class="x sm" data-act="delline" data-id="${i}" aria-label="Remove line">×</button></div><div class="row"><span>Factories</span><span class="stepper"><button data-act="linefac" data-id="${i}" data-d="-1">−</button><b>${L.fac.toFixed(1)}</b><button data-act="linefac" data-id="${i}" data-d="1">+</button></span></div><small>${(L.rate || 0).toFixed(2)} units/day · uses ${Object.entries(lineRes(c, L.eq)).map(([r, v]) => v + ' ' + r).join(', ')} per unit</small></div>`).join('') || '<p class="muted">No production lines. Add one below.</p>'}
      <div class="btnrow wrap">${keys.map(k => `<button class="btn sm" data-act="addline" data-id="${k}">+ ${esc(lineEquipName(c, k))}</button>`).join('')}</div>
      <h4>Stockpile</h4>${keys.map(k => row(esc(lineEquipName(c, k)), fmtInt(c.equip[k] || 0))).join('')}`;
  },
  research(c) {
    const cur = c.researching ? TECH_BY_ID[c.researching] : null;
    let html = `${row('Research per day', (c.rpDay || 0).toFixed(1), 'From universities, libraries, research centers; scaled by education and electricity')}${row('Education', Math.round((c.education || 0) * 100) + '%')}
      ${cur ? `<div class="card"><b>Researching: ${cur.name}</b>${bar(c.rp / techCost(c, cur))}<small>${Math.floor(c.rp)} / ${Math.round(techCost(c, cur))} · about ${Math.ceil((techCost(c, cur) - c.rp) / Math.max(0.1, c.rpDay))} days</small></div>` : '<p class="bad">No active research — pick a technology.</p>'}
      ${c.queue.length ? `<p class="muted">Queue: ${c.queue.map(q => TECH_BY_ID[q].name).join(' → ')} <button class="btn sm" data-act="clearqueue">Clear</button></p>` : ''}
      <div class="ttree">`;
    for (let e = 0; e <= 5; e++) {
      html += `<div class="tera"><h5>${ERAS[e].name}</h5><div class="tcol">`;
      for (const b of BRANCHES) {
        const ts = TECHS.filter(t => t.era === e && t.b === b);
        for (const t of ts) {
          const has = c.techs.includes(t.id), can = canResearch(c, t), on = c.researching === t.id, q = c.queue.includes(t.id);
          const unlocks = [...Object.entries(BUILDINGS).filter(([, B]) => B.tech === t.id).map(([, B]) => B.name), ...Object.values(BATTALIONS).filter(B => B.tech === t.id).map(B => B.name), ...Object.values(CHASSIS).filter(x => x.tech === t.id).map(x => x.name)];
          const bon = Object.entries(t.bonus).map(([k, v]) => `+${v < 1 ? Math.round(v * 100) + '%' : v} ${k}`).join(', ');
          html += `<button class="tech b-${b} ${has ? 'has' : can ? 'can' : 'lock'} ${on ? 'cur' : ''} ${q ? 'q' : ''}" data-act="research" data-id="${t.id}" data-tip="<b>${t.name}</b> · ${b}<br>Cost ${Math.round(techCost(c, t))}${t.req.length ? '<br>Requires ' + t.req.map(r => TECH_BY_ID[r].name).join(', ') : ''}${unlocks.length ? '<br>Unlocks ' + unlocks.join(', ') : ''}${bon ? '<br>' + bon : ''}">${t.name}</button>`;
        }
      }
      html += '</div></div>';
    }
    return html + '</div><p class="muted">Click an available technology to research it; click a locked one to queue it with its prerequisites.</p>';
  },
  diplomacy(c) {
    const others = G.countries.filter(o => o.alive && o.id !== c.id).sort((a, b) => (bordering(c.id, b.id) - bordering(c.id, a.id)) || rel(c.id, b.id) - rel(c.id, a.id));
    const sel = C(UI.diploSel);
    const wars = G.wars.filter(w => w.att.includes(c.id) || w.def.includes(c.id));
    let html = wars.length ? '<h4>Wars</h4>' + wars.map(w => { const side = w.att.includes(c.id) ? 'att' : 'def'; const lead = (side === 'att' ? w.att[0] : w.def[0]) === c.id; return `<div class="card war"><b>${esc(w.name)}</b><small>${w.att.map(x => esc(C(x).name)).join(', ')} vs ${w.def.map(x => esc(C(x).name)).join(', ')}</small><div class="row"><span>War score</span><b class="${warScore(w, side) < 0 ? 'bad' : 'good'}">${warScore(w, side)}</b></div>${lead ? `<button class="btn sm primary" data-act="peace" data-id="${w.id}">Peace conference</button>` : '<small class="muted">Your war leader negotiates the peace.</small>'}</div>`; }).join('') : '';
    if (sel) {
      const r = rel(c.id, sel.id);
      const tr = G.diplo.treaties.filter(t => (t.a === c.id && t.b === sel.id) || (t.b === c.id && t.a === sel.id));
      const war = atWar(c.id, sel.id);
      const truce = G.diplo.truces[pairKey(c.id, sel.id)] > G.day;
      html += `<div class="dsel"><div class="ovhead">${flagImg(sel, 60, 40)}<div><h3>${esc(sel.name)}</h3><small class="muted">${esc(GOVERNMENTS[sel.gov].name)} · ${esc(sel.ideology)} · ${esc(PERSONALITIES[sel.personality] ? PERSONALITIES[sel.personality].name : 'Player')}${sel.overlord >= 0 ? ' · subject of ' + esc(C(sel.overlord).name) : ''}</small></div></div>
        ${row('Relations', `<span class="${r < 0 ? 'bad' : 'good'}">${Math.round(r)}</span>`)}${row('Military strength', `${fmt(strength(sel.id))} <small>(you ${fmt(strength(c.id))})</small>`)}${row('Provinces', sel.nProv)}${row('Era', ERAS[sel.era].name)}
        ${row('Treaties', tr.length ? tr.map(t => `${t.type} <button class="x sm" data-act="dcancel" data-id="${t.type}" aria-label="Cancel ${t.type}">×</button>`).join(' ') : 'none')}
        ${truce ? row('Truce until', dateStr(G.diplo.truces[pairKey(c.id, sel.id)])) : ''}
        ${c.justifying && c.justifying.target === sel.id ? row('Justifying war goal', c.justifying.left + ' days') : ''}${c.wargoals.includes(sel.id) ? row('War goal', '<b class="good">ready</b>') : ''}
        <div class="dacts">${war ? '' : Object.entries(DIPLO_ACTIONS).filter(([k]) => !['cancel', 'annex'].includes(k) || (k === 'annex' && sel.overlord === c.id)).map(([k, a]) => `<button class="btn sm ${k === 'declare' ? 'danger' : ''}" data-act="diplo" data-id="${k}" data-tip="${diploTip(k)}">${a.name}${a.pp ? ` <small>${a.pp} PP</small>` : ''}</button>`).join('')}</div></div>`;
    } else html += '<p class="muted">Select a country below or click one on the map.</p>';
    html += '<h4>Nations</h4>' + others.map(o => `<div class="drow ${o.id === UI.diploSel ? 'on' : ''}" data-act="dsel" data-id="${o.id}">${flagImg(o, 24, 16)}<span>${esc(o.name)} <small>${atWar(c.id, o.id) ? '<b class=bad>at war</b>' : hasTreaty('alliance', c.id, o.id) ? 'ally' : bordering(c.id, o.id) ? 'neighbour' : ''}</small></span><b class="${rel(c.id, o.id) < 0 ? 'bad' : 'good'}">${Math.round(rel(c.id, o.id))}</b></div>`).join('');
    return html;
  },
  economy(c) {
    const f = c.flow || {};
    return `${row('Treasury', fmt(c.treasury))}${row('Income / day', '+' + fmt(c.income || 0))}${row('— of which trade', fmt(c.tradeIncome || 0))}${row('Expenses / day', '−' + fmt(c.expense || 0), 'Army upkeep, factory upkeep and interest on debt')}${row('Inflation', (c.inflation * 100).toFixed(1) + '%', 'Rises while the treasury is negative; raises all costs')}${row('Employment', Math.round((c.employment || 0) * 100) + '%')}${row('Industry efficiency', Math.round((c.indF || 1) * 100) + '%', 'Factories need coal and, from the World War era, electricity')}
      <h4>Tax rate</h4><input type="range" id="taxr" min="5" max="40" value="${Math.round(c.laws.tax * 100)}" data-act="tax"><div class="row"><span>${Math.round(c.laws.tax * 100)}%</span><small class="muted">Higher taxes lower stability</small></div>
      <h4>Resources</h4><table class="tbl"><tr><th>Resource</th><th>Stock</th><th>Per day</th></tr>${RESOURCES.map(r => `<tr><td><i class="rdot r-${r}"></i>${RES_NAMES[r]}</td><td>${fmt(c.stock[r])}</td><td class="${(f[r] || 0) < 0 ? 'bad' : 'good'}">${(f[r] || 0) >= 0 ? '+' : ''}${(f[r] || 0).toFixed(1)}</td></tr>`).join('')}</table>
      <h4>Output</h4>${row('Civilian factories', c.agg.civFac.toFixed(1))}${row('Military factories', c.agg.milFac.toFixed(1))}${row('Research buildings', c.agg.research.toFixed(1))}${row('Ports', c.agg.port.toFixed(1))}
      ${c.foodShortage ? '<p class="bad">Food shortage! Build farms or import food.</p>' : ''}`;
  },
  laws(c) {
    const L = c.laws;
    const opt = (key, val, label, tip) => `<button class="chip ${L[key] === val ? 'on' : ''}" data-act="law" data-k="${key}" data-v="${val}" data-tip="${tip}">${label}</button>`;
    return `<p class="muted">Changing a law costs 50 political power.</p>
      <h4>Conscription</h4><div class="seg">${opt('conscription', 0, 'Volunteers', '1% of population')}${opt('conscription', 1, 'Limited', '2.5%, −2 stability')}${opt('conscription', 2, 'Extensive', '5%, −6 stability')}${opt('conscription', 3, 'Total war', '10%, −15 stability')}</div>
      <h4>Economy</h4><div class="seg">${opt('economy', 'civilian', 'Civilian', 'Construction +10%, military output −15%, +2 stability')}${opt('economy', 'partial', 'Partial mobilization', 'Balanced')}${opt('economy', 'war', 'War economy', 'Military output +25%, construction −10%, −5 stability')}</div>
      <h4>Trade policy</h4><div class="seg">${opt('trade', 'free', 'Free trade', 'Trade income +25%')}${opt('trade', 'export', 'Export focus', 'Balanced')}${opt('trade', 'closed', 'Closed economy', 'No imports or trade income, +3 stability, −5% research')}</div>
      <h4>Government</h4><select id="govsel" data-act="gov">${Object.entries(GOVERNMENTS).map(([k, g]) => `<option value="${k}" ${c.gov === k ? 'selected' : ''}>${g.name}</option>`).join('')}</select><small class="muted">Reforming the government costs 150 political power and 10 stability.</small>
      <div class="grid2">${row('Political power / day', '+' + (0.6 + (GOVERNMENTS[c.gov].pp || 0) + c.agg.pp).toFixed(2))}${row('Stability target', Math.round(c.stabTarget || 0) + '%')}</div>
      <h4>Ideology</h4><select id="idsel" data-act="ideology">${IDEOLOGIES.map(i => `<option ${c.ideology === i ? 'selected' : ''}>${i}</option>`).join('')}</select>`;
  },
  people(c) {
    const ps = [...c._provs].sort((a, b) => b.pop - a.pop);
    const cultures = {};
    for (const p of ps) cultures[p.culture] = (cultures[p.culture] || 0) + p.pop;
    const foreign = Object.keys(cultures).filter(k => k !== c.culture && k !== 'Unsettled');
    return `${row('Population', fmtInt(c.agg.pop))}${row('Housing', fmtInt(ps.reduce((s, p) => s + provStats(p).housing, 0)))}${row('Stability', Math.round(c.stability) + '%')}${row('War exhaustion', Math.round(c.warEx) + '%')}${row('Employment', Math.round((c.employment || 0) * 100) + '%')}${row('Education', Math.round((c.education || 0) * 100) + '%')}${row('Food', c.foodShortage ? '<b class=bad>Shortage</b>' : 'Sufficient')}${row('Consumer goods', Math.round((c.consumerSat == null ? 1 : c.consumerSat) * 100) + '% satisfied')}
      <h4>Cultures</h4>${Object.entries(cultures).map(([k, v]) => row(esc(k), fmt(v))).join('')}
      ${foreign.length ? `<div class="btnrow wrap">${foreign.map(f => `<button class="btn sm" data-act="release" data-id="${esc(f)}" data-tip="Release the ${esc(f)} provinces as your subject state">Release ${esc(f)} subject</button>`).join('')}</div>` : ''}
      <h4>Provinces</h4><table class="tbl"><tr><th>Province</th><th>Pop.</th><th>Housing</th><th>Unrest</th></tr>${ps.slice(0, 40).map(p => `<tr data-act="gotoprov" data-id="${p.id}"><td>${esc(p.name)}</td><td>${fmt(p.pop)}</td><td>${Math.round(p.pop / provStats(p).housing * 100)}%</td><td class="${p.unrest > 40 ? 'bad' : ''}">${Math.round(p.unrest || 0)}</td></tr>`).join('')}</table>`;
  },
  trade(c) {
    const partners = G.diplo.treaties.filter(t => t.type === 'trade' && (t.a === c.id || t.b === c.id)).map(t => C(t.a === c.id ? t.b : t.a));
    return `${row('Trade income / day', fmt(c.tradeIncome || 0))}<label class="chk"><input type="checkbox" id="autoimp" data-act="autoimport" ${c.autoImport ? 'checked' : ''}> Automatically import missing materials (30% markup)</label>
      <h4>World market</h4><table class="tbl"><tr><th>Resource</th><th>Price</th><th>Order / day</th></tr>${RESOURCES.filter(r => r !== 'elec').map(r => `<tr><td><i class="rdot r-${r}"></i>${RES_NAMES[r]}</td><td>${G.prices[r].toFixed(2)}</td><td><span class="stepper"><button data-act="order" data-id="${r}" data-d="-1" aria-label="Sell more">−</button><b class="${(c.orders[r] || 0) < 0 ? 'bad' : (c.orders[r] || 0) > 0 ? 'good' : ''}">${(c.orders[r] || 0) > 0 ? 'Buy ' + c.orders[r] : (c.orders[r] || 0) < 0 ? 'Sell ' + -c.orders[r] : '—'}</b><button data-act="order" data-id="${r}" data-d="1" aria-label="Buy more">+</button></span></td></tr>`).join('')}</table>
      <h4>Trade agreements</h4>${partners.length ? partners.map(o => `<div class="drow" data-act="dsel" data-id="${o.id}">${flagImg(o, 24, 16)}<span>${esc(o.name)}</span></div>`).join('') : '<p class="muted">None. Propose agreements in Diplomacy; harbors increase their value.</p>'}`;
  },
};
const DOCTRINES = { balanced: 'Balanced', mobile: 'Mobile warfare', firepower: 'Superior firepower', defensive: 'Defense in depth', mass: 'Mass assault' };
function diploTip(k) {
  return { improve: '+15 relations', alliance: 'Allies join each other\'s wars', defensive: 'Join only if the other is attacked', nap: 'Promise not to attack each other', access: 'Your troops may pass through their land', trade: 'Both gain money every day; draws a trade route', guarantee: 'You will defend them if attacked', justify: 'Prepare a war goal — declaring war without one costs stability and reputation', declare: 'Start a war. Their allies will join.', demand: 'Demand the province selected on the map; only works if you are far stronger', exchange: 'Swap one of your provinces (pick it on the map first) for one of theirs', federation: 'Peacefully unite with a close, smaller ally', coalition: 'Rally nations who fear this country into defensive pacts with you', support: 'Fund separatists in the selected province of theirs', annex: 'Absorb this subject state' }[k] || '';
}
function effText(B) {
  const n = { housing: 'housing', food: 'food/day', wood: 'wood/day', stone: 'stone/day', iron: 'iron/day', coal: 'coal/day', oil: 'oil/day', steel: 'steel/day', elec: 'electricity', consumer: 'consumer goods', money: 'money/day', research: 'research', pp: 'political power', stab: 'stability', fort: 'fort level', recruit: 'trains troops', cavalry: 'enables cavalry', milFac: 'military factory', tankFac: 'tank production', civFac: 'civilian factory', infra: 'infrastructure', supply: 'supply', port: 'port', air: 'air base', shipyard: 'shipyard', airdef: 'air defence', mine: 'extracts deposits', steelMill: 'iron+coal → steel', refinery: 'extracts oil', plantation: 'grows rubber', manpower: 'manpower', coalUse: 'uses coal', elecUse: 'uses power' };
  return Object.entries(B.eff).map(([k, v]) => (['recruit', 'cavalry', 'mine', 'steelMill', 'refinery', 'plantation', 'port', 'air', 'coalUse', 'elecUse'].includes(k) ? '' : '+' + (v < 1 && v > 0 && k !== 'fort' ? Math.round(v * 100) / 100 : v) + ' ') + n[k]).join(', ');
}
function summarizeBats(bats) { const m = {}; for (const b of bats) m[b] = (m[b] || 0) + 1; return Object.entries(m).map(([k, v]) => `${v}× ${BATTALIONS[k].name}`).join(', '); }

// ---------- bottom bar ----------
function renderBottom() {
  if (UI.phase !== 'game') return;
  const p = G.provs[V.sel];
  const c = C(G.player);
  let html = '';
  if (p) {
    const own = C(p.owner), ctl = C(p.controller), s = provStats(p), st = G.states[p.state];
    const mine = p.owner === G.player && p.controller === G.player;
    const dep = Object.entries(p.dep).filter(([, v]) => v > 0).map(([k, v]) => `${k} ${'●'.repeat(v)}`).join(' · ') || 'none';
    const canColonize = p.owner < 0 && p.neighbors.concat(p.sea).some(n => G.provs[n].owner === G.player);
    html += `<div class="pinfo"><div class="phead">${own ? flagImg(own, 30, 20) : ''}<div><h3>${esc(p.name)} <button class="x sm" data-act="renameprov" aria-label="Rename province" data-tip="Rename province">✎</button></h3><small>${esc(st ? st.name : '')} · ${own ? esc(own.name) : 'Unclaimed land'}${ctl && p.controller !== p.owner ? ' · <b class=bad>occupied by ' + esc(ctl.name) + '</b>' : ''}</small></div></div>
      <div class="pstats"><span data-tip="Terrain">${TERRAINS[p.terrain].name}${p.coastal ? ', coast' : ''}${p.river ? ', river' : ''}</span><span data-tip="Population / housing">${fmt(p.pop)} <small>/ ${fmt(s.housing)}</small></span><span data-tip="Fortification level">Fort ${s.fort.toFixed(1)}</span><span data-tip="Infrastructure">Infra ${s.infra.toFixed(1)}</span><span data-tip="Buildings">${s.nb} buildings</span><span data-tip="Weather">${weatherAt(p)}</span><span data-tip="Deposits">${dep}</span>${p.unrest > 20 ? `<span class="bad" data-tip="Unrest">Unrest ${Math.round(p.unrest)}</span>` : ''}</div>
      <div class="btnrow"><button class="btn primary" data-act="enterprov" data-id="${p.id}">${mine ? 'Enter province' : 'View province'}</button>${canColonize ? `<button class="btn" data-act="colonize" data-id="${p.id}">Colonize (${fmt(colonizeCost(c, p))} ¤)</button>` : ''}${mine ? ['farm', c.era >= 3 && hasTech(c, 't_electric') ? 'apartments' : 'cottage', 'barracks', c.era >= 2 ? 'factory' : 'market'].filter(t => hasTech(c, BUILDINGS[t].tech)).map(t => `<button class="btn sm" data-act="quickbuild" data-id="${t}" data-tip="Quick build: ${BUILDINGS[t].name} (${costText(scaledCost(c, BUILDINGS[t].cost))})">+ ${BUILDINGS[t].name}</button>`).join('') : ''}${own && p.owner !== G.player ? `<button class="btn sm" data-act="dselgo" data-id="${p.owner}">Diplomacy</button>` : ''}${(c.equip.nukes || 0) >= 1 && (atWar(G.player, p.controller) || atWar(G.player, p.owner)) ? `<button class="btn sm danger" data-act="nuke" data-id="${p.id}" data-tip="Destroys this province, damages its neighbours and leaves fallout for two years. Every nation will turn against you.">Nuclear strike (${Math.floor(c.equip.nukes)})</button>` : ''}${p.fallout > G.day ? '<span class="bad" data-tip="Food, money and housing are crippled until the fallout clears">Fallout until ' + dateStr(p.fallout) + '</span>' : ''}</div></div>`;
  } else html += '<div class="pinfo"><p class="muted">Click a province to inspect it. Double-click to enter it. Right-click with divisions selected to move them.</p></div>';
  const sel = [...UI.selDivs].map(id => G.divs.find(d => d.id === id)).filter(Boolean);
  if (sel.length) {
    const inBattle = sel.find(d => d.state === 'battle');
    const auto = sel.every(d => d.auto);
    html += `<div class="army"><h4>${sel.length} division${sel.length > 1 ? 's' : ''} selected</h4><small>${sel.slice(0, 3).map(d => esc(d.name)).join(', ')}${sel.length > 3 ? '…' : ''}</small>
      <div class="mini wide">${bar(sel.reduce((s, d) => s + d.str, 0) / sel.length, 'g')}${bar(sel.reduce((s, d) => s + d.org, 0) / sel.length, 'y')}</div>
      <div class="btnrow wrap"><button class="btn sm ${auto ? 'on' : ''}" data-act="divauto" data-tip="Divisions attack weak neighbouring enemy provinces on their own">${auto ? 'Auto-advance on' : 'Auto-advance'}</button><button class="btn sm" data-act="divstop">Halt</button>${inBattle ? `<button class="btn sm primary" data-act="watch" data-id="${G.battles.find(b => b.prov === inBattle.attacking).id}">Watch battle</button>` : ''}<button class="btn sm danger" data-act="divdisband">Disband</button></div></div>`;
  }
  $('#bottom-left').innerHTML = html;
}
function colonizeCost(c, p) { return Math.round((60 + p.area * 0.15) * (1 + c.era) * (1 + c.inflation)); }

// ---------- actions ----------
const isClient = () => typeof NET !== 'undefined' && NET.role === 'client';
const hostOnly = () => { if (isClient()) { toast('Only the host controls time in multiplayer.'); return true; } return false; };
// After a command: show its result and refresh what it may have changed
const after = r => { showRes(r); renderPanel(true); renderBottom(); refreshTop(); return r; };
const ACT = {
  panel: el => openPanel(el.dataset.id), closepanel: () => closePanel(),
  mapmode: el => { V.mode = el.dataset.id; document.querySelectorAll('#modes .mm').forEach(b => b.classList.toggle('on', b.dataset.id === V.mode)); G.mapDirty = true; UI.lastMap = 0; },
  pause: () => { if (hostOnly()) return; G.paused = !G.paused; refreshTop(); },
  speed: el => { if (hostOnly()) return; G.speed = +el.dataset.id; G.paused = false; refreshTop(); },
  notefilter: el => { UI.notesFilter = el.dataset.id; renderNotes(); },
  gotoprov: el => { const p = G.provs[+el.dataset.id]; if (!p) return; if (UI.phase !== 'game') return; V.cx = p.cx; V.cy = p.cy; V.scale = Math.max(V.scale, 2.2); selectProv(p.id); },
  enterprov: el => enterProvince(+el.dataset.id),
  quickbuild: el => after(cmd('quickbuild', { p: V.sel, t: el.dataset.id })),
  repair: el => after(cmd('repair', { p: +el.dataset.prov, id: +el.dataset.id })),
  colonize: el => after(cmd('colonize', { p: +el.dataset.id })),
  renameprov: () => { const p = G.provs[V.sel]; if (!p) return; askText('Rename province', p.name, v => after(cmd('renameprov', { p: p.id, name: v }))); },
  renamecountry: () => { askText('Rename your country', C(G.player).name, v => { after(cmd('renamecountry', { name: v })); labelsKey = ''; }); },
  editflag: () => openFlagEditor(C(G.player).flag, f => { if (isClient()) f.layer = netFlagLayer(f.layer); after(cmd('flag', { flag: f })); flagUrlCache.clear(); }),
  anthem: () => { playAnthem(C(G.player).anthem); setTimeout(() => renderPanel(true), 60); },
  train: el => after(cmd('train', { tpl: +el.dataset.id, p: +el.dataset.site })),
  divdesigner: el => openDivDesigner(el.dataset.id ? +el.dataset.id : null),
  tankdesigner: () => openTankDesigner(),
  doctrine: el => after(cmd('doctrine', { k: el.dataset.id })),
  seldiv: (el, e) => { const id = +el.dataset.id; if (!e.shiftKey) UI.selDivs.clear(); UI.selDivs.add(id); const d = G.divs.find(x => x.id === id); if (d) { const p = G.provs[d.prov]; V.cx = p.cx; V.cy = p.cy; } renderPanel(true); renderBottom(); },
  selall: () => { UI.selDivs = new Set(G.divs.filter(d => d.owner === G.player && d.state !== 'training').map(d => d.id)); renderPanel(true); renderBottom(); },
  autoall: () => after(cmd('autoall', { on: !G.divs.filter(d => d.owner === G.player).every(d => d.auto) })),
  divauto: () => after(cmd('divauto', { ids: [...UI.selDivs], on: !G.divs.filter(d => UI.selDivs.has(d.id)).every(d => d.auto) })),
  divstop: () => after(cmd('divstop', { ids: [...UI.selDivs] })),
  divdisband: () => { const ids = [...UI.selDivs]; modal('Disband divisions?', `<p>${ids.length} division(s) will be disbanded. Their manpower returns to the pool.</p>`, [{ label: 'Disband', cls: 'danger', fn: () => { after(cmd('disband', { ids })); UI.selDivs.clear(); } }, { label: 'Cancel' }]); },
  watch: el => { const b = G.battles.find(x => x.id === +el.dataset.id); if (b) watchBattle(b); },
  nuke: el => { const p = G.provs[+el.dataset.id]; if (!p) return; modal('Launch a nuclear strike?', `<p>A nuclear weapon will destroy <b>${esc(p.name)}</b>: most of its people die, every building is wrecked, troops there are annihilated and the neighbouring provinces are badly damaged. Fallout ruins the land for two years.</p><p class="bad">Every nation will turn against you, and your own stability will fall.</p>`, [{ label: 'Launch', cls: 'danger', fn: () => after(cmd('nuke', { p: p.id })) }, { label: 'Cancel' }]); },
  addline: el => after(cmd('line', { op: 'add', eq: el.dataset.id })),
  delline: el => after(cmd('line', { op: 'del', i: +el.dataset.id })),
  linefac: el => after(cmd('line', { op: 'fac', i: +el.dataset.id, d: +el.dataset.d })),
  research: el => after(cmd('research', { id: el.dataset.id })),
  clearqueue: () => after(cmd('clearqueue', {})),
  dsel: el => { UI.diploSel = +el.dataset.id; if (UI.panel !== 'diplomacy') openPanel('diplomacy'); else renderPanel(true); },
  dselgo: el => { UI.diploSel = +el.dataset.id; if (UI.panel !== 'diplomacy') openPanel('diplomacy'); else renderPanel(true); },
  diplo: el => doDiplo(el.dataset.id),
  dcancel: el => after(cmd('dcancel', { t: UI.diploSel, type: el.dataset.id })),
  peace: el => { const w = G.wars.find(x => x.id === +el.dataset.id); if (w) openPeace(w); },
  law: el => after(cmd('law', { k: el.dataset.k, v: isNaN(+el.dataset.v) ? el.dataset.v : +el.dataset.v })),
  release: el => { const c = C(G.player), cult = el.dataset.id; const n = c._provs.filter(p => p.culture === cult && p.id !== c.capital).length; if (!n) return; modal('Release subject state', `<p>Release ${n} ${esc(cult)} provinces as a subject state? They will pay you 15% of their income and follow you to war.</p>`, [{ label: 'Release', fn: () => after(cmd('release', { culture: cult })) }, { label: 'Cancel' }]); },
  order: el => after(cmd('order', { r: el.dataset.id, d: +el.dataset.d })),
  exitprov: () => exitProvince(), exitbattle: () => exitBattle(),
  resolve: () => { if (isClient()) return toast('Only the host can auto-resolve battles in multiplayer.'); const b = P3.battle && P3.battle.b; if (b && G.battles.includes(b)) { resolveBattleNow(b); renderBattleUI(); } },
};
function doDiplo(action) {
  const c = C(G.player), t = UI.diploSel;
  const extra = {};
  if (action === 'demand' || action === 'support') { const p = G.provs[V.sel]; if (!p || p.owner !== t) return toast(`Select one of ${C(t).name}'s provinces on the map first.`, 'bad'); extra.prov = p.id; }
  if (action === 'exchange') { const p = G.provs[V.sel]; if (!p || p.owner !== G.player) return toast('Select the province you will give on the map first.', 'bad'); const theirs = G.provs.filter(q => q.owner === t && q.neighbors.some(n => G.provs[n].owner === G.player)).sort((a, b) => provValue(b) - provValue(a))[0] || G.provs.find(q => q.owner === t && q.id !== C(t).capital); if (!theirs) return; extra.give = p.id; extra.take = theirs.id; }
  if (action === 'declare') {
    const goal = c.wargoals.includes(t);
    modal('Declare war on ' + esc(C(t).name) + '?', `<p>${goal ? 'You have a justified war goal.' : '<b class="bad">You have no war goal.</b> Declaring anyway costs 12 stability and harms relations with every nation.'}</p><p>Their allies and guarantors will join: ${G.diplo.treaties.filter(x => (x.type === 'alliance' || x.type === 'defensive') && (x.a === t || x.b === t)).map(x => esc(C(x.a === t ? x.b : x.a).name)).join(', ') || 'none'}.</p>`, [{ label: 'Declare war', cls: 'danger', fn: () => after(cmd('diplo', { t, action, extra })) }, { label: 'Cancel' }]);
    return;
  }
  after(cmd('diplo', { t, action, extra }));
}
function askText(title, val, fn) {
  const m = modal(title, `<input type="text" id="asktext" value="${esc(val)}" maxlength="40">`, [{ label: 'Save', fn: () => { const v = $('#asktext').value.trim(); if (!v) return false; fn(v); } }, { label: 'Cancel' }]);
  setTimeout(() => { const i = $('#asktext'); i.focus(); i.select(); }, 30);
}
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el || el.tagName === 'INPUT' || el.tagName === 'SELECT') return;
  const f = ACT[el.dataset.act] || (window.ACT2 && ACT2[el.dataset.act]);
  if (f) { e.preventDefault(); f(el, e); }
});
document.addEventListener('change', e => {
  const el = e.target;
  if (!el.dataset || !el.dataset.act) return;
  if (el.dataset.act === 'tax') after(cmd('tax', { v: +el.value / 100 }));
  if (el.dataset.act === 'autoimport') cmd('autoimport', { v: el.checked });
  if (el.dataset.act === 'gov') after(cmd('gov', { v: el.value }));
  if (el.dataset.act === 'ideology') after(cmd('ideology', { v: el.value }));
  if (window.CHANGE2) CHANGE2(e);
});

// ---------- map input ----------
function bindMapInput() {
  let drag = null;
  // Touch: two fingers pinch-zoom and pan, long-press acts as right click, double-tap enters a province
  const touches = new Map();
  let pinch = null, holdTimer = 0, lastTap = { t: 0, x: 0, y: 0 }, lastPointer = 'mouse';
  const zoomAt = (x, y, f) => {
    const [wx, wy] = s2w(x, y);
    V.scale = clamp(V.scale * f, minScale(), 14);
    const [nx, ny] = s2w(x, y);
    V.cx += wx - nx; V.cy += wy - ny; clampView();
  };
  const pinchInfo = () => {
    const [a, b] = [...touches.values()], r = mapCv.getBoundingClientRect();
    return { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx: (a.x + b.x) / 2 - r.left, my: (a.y + b.y) / 2 - r.top };
  };
  mapCv.addEventListener('contextmenu', e => e.preventDefault());
  mapCv.addEventListener('pointerdown', e => {
    try { mapCv.setPointerCapture(e.pointerId); } catch (err) { /* pointer already gone */ }
    lastPointer = e.pointerType;
    if (e.pointerType === 'touch') {
      touchTip();
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      clearTimeout(holdTimer);
      if (touches.size === 2) { drag = null; pinch = pinchInfo(); return; }
      if (touches.size > 2) return;
      const ox = e.offsetX, oy = e.offsetY;
      holdTimer = setTimeout(() => { if (drag && !drag.moved && !drag.paint) { drag = null; navigator.vibrate && navigator.vibrate(15); mapRightClick(ox, oy); } }, 480);
    }
    drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, button: e.button, moved: false, touch: e.pointerType === 'touch', paint: UI.phase === 'editor' && e.button === 0 && UI.editor && UI.editor.tool !== 'select' };
    if (drag.paint) editorPaint(e.offsetX, e.offsetY);
  });
  mapCv.addEventListener('pointermove', e => {
    if (touches.has(e.pointerId)) {
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && touches.size === 2) {
        const n = pinchInfo();
        V.cx -= (n.mx - pinch.mx) / V.scale; V.cy -= (n.my - pinch.my) / V.scale;
        zoomAt(n.mx, n.my, n.d / pinch.d);
        pinch = n; return;
      }
    }
    const pid = provAt(e.offsetX, e.offsetY);
    if (pid !== V.hover) { V.hover = pid; }
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (Math.abs(e.clientX - drag.sx) + Math.abs(e.clientY - drag.sy) > (drag.touch ? 10 : 4)) { drag.moved = true; clearTimeout(holdTimer); }
    if (drag.paint) { editorPaint(e.offsetX, e.offsetY); return; }
    if (drag.button === 0 || drag.button === 1) { V.cx -= dx / V.scale; V.cy -= dy / V.scale; clampView(); }
    drag.x = e.clientX; drag.y = e.clientY;
  });
  const endTouch = e => {
    if (!touches.delete(e.pointerId)) return;
    clearTimeout(holdTimer);
    if (touches.size < 2) pinch = null;
  };
  mapCv.addEventListener('pointercancel', e => { endTouch(e); drag = null; });
  mapCv.addEventListener('pointerup', e => {
    const wasPinch = !!pinch;
    endTouch(e);
    if (!drag || wasPinch) { if (wasPinch) drag = null; return; }
    const d = drag; drag = null;
    if (d.moved || d.paint) return;
    if (d.button === 2) return mapRightClick(e.offsetX, e.offsetY);
    if (d.button === 0) {
      if (d.touch) {
        const now = performance.now(), dbl = now - lastTap.t < 320 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 30;
        lastTap = dbl ? { t: 0, x: 0, y: 0 } : { t: now, x: e.clientX, y: e.clientY };
        if (dbl) { const pid = provAt(e.offsetX, e.offsetY); if (pid >= 0 && UI.phase === 'game') return enterProvince(pid); }
      }
      mapLeftClick(e.offsetX, e.offsetY, e.shiftKey);
    }
  });
  mapCv.addEventListener('dblclick', e => {
    if (lastPointer === 'touch') return; // touch double-tap is handled in pointerup
    const pid = provAt(e.offsetX, e.offsetY);
    if (pid >= 0 && UI.phase === 'game') enterProvince(pid);
  });
  mapCv.addEventListener('pointerleave', () => { V.hover = -1; });
  mapCv.addEventListener('wheel', e => {
    e.preventDefault();
    const [wx, wy] = s2w(e.offsetX, e.offsetY);
    V.scale = clamp(V.scale * Math.exp(-e.deltaY * 0.0015), minScale(), 14);
    const [nx, ny] = s2w(e.offsetX, e.offsetY);
    V.cx += wx - nx; V.cy += wy - ny; clampView();
  }, { passive: false });
}
function touchTip() {
  if (UI.touchTipped) return;
  UI.touchTipped = true; document.body.classList.add('touch');
  try { if (localStorage.getItem('won_touchtip')) return; localStorage.setItem('won_touchtip', '1'); } catch (e) { /* storage unavailable */ }
  toast('Touch controls: pinch to zoom · drag to pan · tap to select · long-press to move or attack · double-tap to enter a province');
}
function minScale() { return Math.min(mapCv.clientWidth / MW, mapCv.clientHeight / MH) * 0.9; }
function clampView() { V.cx = clamp(V.cx, 0, MW); V.cy = clamp(V.cy, 0, MH); }
function selectProv(pid) { V.sel = pid; G.mapDirty = true; UI.lastMap = 0; renderBottom(); if (UI.phase === 'editor') renderEditor(); if (UI.phase === 'pick') pickPhaseSelect(pid); if (UI.panel === 'build') renderPanel(true); }
function mapLeftClick(x, y, shift) {
  for (let i = UI.unitRects.length - 1; i >= 0; i--) {
    const r = UI.unitRects[i];
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
      if (r.battle) { const b = G.battles.find(bb => bb.id === r.battle); if (b && UI.phase === 'game') openBattleDialog(b); return; }
      if (r.owner === G.player && UI.phase === 'game') { if (!shift) UI.selDivs.clear(); r.divs.forEach(id => UI.selDivs.add(id)); renderBottom(); if (UI.panel === 'military') renderPanel(true); return; }
    }
  }
  const pid = provAt(x, y);
  if (!shift && UI.phase === 'game') UI.selDivs.clear();
  selectProv(pid);
  if (pid >= 0 && UI.panel === 'diplomacy' && G.provs[pid].owner >= 0 && G.provs[pid].owner !== G.player) { UI.diploSel = G.provs[pid].owner; renderPanel(true); }
}
function mapRightClick(x, y) {
  if (UI.phase !== 'game') return;
  const pid = provAt(x, y);
  if (pid < 0 || !UI.selDivs.size) return;
  showRes(cmd('move', { ids: [...UI.selDivs], p: pid }));
}
function openBattleDialog(b) {
  const p = G.provs[b.prov];
  const { attackers, defenders } = battleSides(b);
  const side = (divs, c) => `<div class="bside">${flagImg(C(c), 30, 20)}<b>${esc(C(c).name)}</b><small>${divs.length} divisions · ${fmt(divs.reduce((s, d) => s + d.st.mp * d.str, 0))} men</small>${bar(divs.reduce((s, d) => s + d.org, 0) / Math.max(1, divs.length), 'y')}</div>`;
  const s = provStats(p);
  modal('Battle of ' + esc(p.name), `<div class="bsides">${side(attackers, b.att)}<span class="vs">vs</span>${side(defenders, b.def)}</div>
    <p class="muted">${TERRAINS[p.terrain].name}${p.river ? ', river crossing' : ''} · fortification ${s.fort.toFixed(1)} · day ${b.days}</p><p>Watch the battle unfold on this province's terrain, or let the simulation resolve it immediately.</p>`,
  [{ label: 'Watch battle', fn: () => watchBattle(b) }, { label: 'Auto-resolve', fn: () => { if (isClient()) return toast('Only the host can auto-resolve battles in multiplayer.'); resolveBattleNow(b); const w = b.result === 'att' ? C(b.att).name : C(b.def).name; toast(`Battle of ${p.name} resolved: ${w} prevailed.`); } }, { label: 'Close' }]);
}

// ---------- loop ----------
let lastT = 0, acc = 0, slowT = 0, panelT = 0;
function frame(t) {
  const dt = Math.min(0.1, (t - lastT) / 1000 || 0.016); lastT = t;
  UI.lastFrame = performance.now();
  // a multiplayer client never simulates: the host's world arrives over the network
  const running = (UI.phase === 'game' || UI.phase === 'province' || UI.phase === 'battle') && !G.paused && !isClient() && !(NET.role === 'host' ? false : document.querySelector('.modal-back.popup'));
  if (running) {
    acc += dt * SPEED_DPS[G.speed];
    let n = 0;
    while (acc >= 1 && n < 3) { dailyTick(); acc -= 1; n++; }
    if (acc > 3) acc = 0;
    if (G.popups.length) showNextPopup();
  }
  if (UI.phase === 'province' || UI.phase === 'battle') p3Frame(dt, UI.keys);
  else if (G.geo) drawMap(t);
  slowT -= dt; panelT -= dt;
  if (slowT <= 0 && UI.phase !== 'menu') {
    slowT = 0.25;
    refreshTop();
    if (UI.phase === 'province') renderProvUI(true);
    if (UI.phase === 'battle') renderBattleUI();
  }
  if (panelT <= 0 && UI.phase === 'game') { panelT = 1; renderPanel(false); renderBottom(); renderNotes(); renderMpBox(); }
  requestAnimationFrame(frame);
}
function resize() {
  dpr = Math.min(2, window.devicePixelRatio || 1);
  mapCv.width = mapCv.clientWidth * dpr; mapCv.height = mapCv.clientHeight * dpr;
  p3Resize();
}
window.addEventListener('keydown', e => {
  if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
  const k = e.key.toLowerCase();
  UI.keys.add(k);
  if (UI.phase === 'menu') return;
  if (k === ' ') { e.preventDefault(); G.paused = !G.paused; refreshTop(); }
  if (['1', '2', '3', '4'].includes(k) && UI.phase !== 'editor') { G.speed = [1, 2, 5, 10][+k - 1]; G.paused = false; refreshTop(); }
  if (k === 'escape') {
    if (document.querySelector('.modal-back:not(.popup)')) { const ms = document.querySelectorAll('.modal-back:not(.popup)'); ms[ms.length - 1].close(); return; }
    if (UI.phase === 'province') { if (P3.tool.kind !== 'select') setTool('select'); else exitProvince(); return; }
    if (UI.phase === 'battle') return exitBattle();
    if (UI.panel) return closePanel();
    UI.selDivs.clear(); renderBottom();
  }
  if (UI.phase === 'province') { if (k === 'q') P3.ghostRot -= P3.snap ? Math.PI / 4 : 0.15; if (k === 'e' || k === 'r') P3.ghostRot += P3.snap ? Math.PI / 4 : 0.15; if (k === 'g') { P3.snap = !P3.snap; renderProvUI(); } }
});
window.addEventListener('keyup', e => UI.keys.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => UI.keys.clear());
