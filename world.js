// ============================================================
// WAR OF NATIONS — RNG, noise, world generation, province terrain, map bitmap
// ============================================================
'use strict';

const MW = 1200, MH = 760, SITE_S = 22;

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function hash2(x, y, s) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 982451653)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967296;
}
function vnoise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, s, oct) {
  let sum = 0, amp = 0.5, f = 1, norm = 0;
  for (let i = 0; i < (oct || 5); i++) { sum += amp * vnoise(x * f, y * f, s + i * 17); norm += amp; amp *= 0.5; f *= 2; }
  return sum / norm;
}
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function hsl2rgb(h, s, l) {
  const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}
const rgbStr = (c, a) => a == null ? `rgb(${c[0]},${c[1]},${c[2]})` : `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const hexToRgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const rgbToHex = c => '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');

function genName(rng, kind) {
  const a = pick(rng, NAME_SYL.a), b = rng() < 0.6 ? pick(rng, NAME_SYL.b) : '';
  if (kind === 'country') return a + b + pick(rng, NAME_SYL.c);
  if (kind === 'prov') return a + b + pick(rng, PROV_SUFFIX);
  return a + b;
}
function adjectiveOf(name) {
  const n = name.replace(/(ia|land|mark|heim|ora|aria|stan|grad|onia|ica|mere|vale|reach|burg|ovia|esia)$/i, '');
  return (n.length > 2 ? n : name) + 'ian';
}

// ------------------------------------------------------------
// World generation
// ------------------------------------------------------------
// The geometry (cells, provinces, adjacency) is fully deterministic from (seed, mapType),
// so save files only store the dynamic state on top of it.
function generateGeometry(seed, mapType, histYear) {
  const rng = mulberry32(seed * 7919 + 13);
  const N = MW * MH;
  const elev = new Float32Array(N), moist = new Float32Array(N), temp = new Float32Array(N);
  const real = isRealMap(mapType) ? rasterizeReal(mapType, histYear || null) : null;
  if (real) realFields(real, seed, elev, moist, temp);
  const blobs = [];
  if (!real) {
  const nb = mapType === 'pangaea' ? 4 : mapType === 'archipelago' ? 16 : 7;
  for (let i = 0; i < nb; i++) {
    let x, y, r;
    if (mapType === 'pangaea') { x = MW * (0.5 + (rng() - 0.5) * 0.35); y = MH * (0.5 + (rng() - 0.5) * 0.35); r = 260 + rng() * 140; }
    else if (mapType === 'archipelago') { x = MW * (0.08 + rng() * 0.84); y = MH * (0.1 + rng() * 0.8); r = 70 + rng() * 70; }
    else { x = MW * (0.1 + rng() * 0.8); y = MH * (0.12 + rng() * 0.76); r = 150 + rng() * 150; }
    blobs.push({ x, y, r });
  }
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const n = fbm(x / 170, y / 170, seed, 5);
    let m = 0;
    for (const b of blobs) { const dx = (x - b.x) / b.r, dy = (y - b.y) / b.r; m = Math.max(m, 1 - Math.sqrt(dx * dx + dy * dy)); }
    const edge = Math.min(x, y, MW - x, MH - y) / 60;
    let e = n * 0.9 + m * 0.75 - 0.72 - Math.max(0, 1 - edge) * 0.5;
    elev[y * MW + x] = e;
    moist[y * MW + x] = fbm(x / 150, y / 150, seed + 99, 4);
    temp[y * MW + x] = 1 - Math.abs(y / MH - 0.55) * 2.1 - e * 0.5;
  }
  }
  // Sites on a jittered grid; nearest-site with domain warping gives organic borders
  const gw = Math.ceil(MW / SITE_S), gh = Math.ceil(MH / SITE_S);
  const sx = new Float32Array(gw * gh), sy = new Float32Array(gw * gh);
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
    sx[j * gw + i] = (i + 0.15 + rng() * 0.7) * SITE_S; sy[j * gw + i] = (j + 0.15 + rng() * 0.7) * SITE_S;
  }
  const cellSite = new Int32Array(N).fill(-1);
  const siteCount = new Int32Array(gw * gh);
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const k = y * MW + x;
    if (elev[k] <= 0) continue;
    const wx = x + (vnoise(x / 13, y / 13, seed + 3) - 0.5) * 16, wy = y + (vnoise(x / 13, y / 13, seed + 4) - 0.5) * 16;
    const gi = Math.floor(wx / SITE_S), gj = Math.floor(wy / SITE_S);
    let best = -1, bd = 1e9;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const ii = gi + di, jj = gj + dj;
      if (ii < 0 || jj < 0 || ii >= gw || jj >= gh) continue;
      const s = jj * gw + ii, ddx = sx[s] - wx, ddy = sy[s] - wy, d = ddx * ddx + ddy * ddy;
      if (d < bd) { bd = d; best = s; }
    }
    cellSite[k] = best; siteCount[best]++;
  }
  let np = 0;
  const cellProv = new Int32Array(N).fill(-1), provRc = [];
  if (real) {
    // Real maps: a province is the part of a site's cell inside one country, so provinces never cross borders
    const rc = real.rc, keyOf = new Int32Array(N).fill(-1), keyCount = new Map(), keyProv = new Map();
    for (let k = 0; k < N; k++) if (cellSite[k] >= 0) { const key = cellSite[k] * 1024 + rc[k]; keyOf[k] = key; keyCount.set(key, (keyCount.get(key) || 0) + 1); }
    for (const [key, n] of keyCount) if (n >= 30) { keyProv.set(key, np); provRc[np++] = key % 1024; }
    for (let k = 0; k < N; k++) if (keyOf[k] >= 0 && keyProv.has(keyOf[k])) cellProv[k] = keyProv.get(keyOf[k]);
    for (let pass = 0; pass < 40; pass++) {
      let changed = 0;
      for (let y = 1; y < MH - 1; y++) for (let x = 1; x < MW - 1; x++) {
        const k = y * MW + x;
        if (keyOf[k] < 0 || cellProv[k] >= 0) continue;
        for (const kk of [k - 1, k + 1, k - MW, k + MW]) if (cellProv[kk] >= 0 && rc[kk] === rc[k]) { cellProv[k] = cellProv[kk]; changed++; break; }
      }
      if (!changed) break;
    }
    // islands and microstates keep their own small provinces
    for (let k = 0; k < N; k++) if (keyOf[k] >= 0 && cellProv[k] < 0) {
      if (!keyProv.has(keyOf[k])) { keyProv.set(keyOf[k], np); provRc[np++] = rc[k]; }
      cellProv[k] = keyProv.get(keyOf[k]);
    }
  } else {
  const siteProv = new Int32Array(gw * gh).fill(-1);
  for (let s = 0; s < gw * gh; s++) if (siteCount[s] >= 40) siteProv[s] = np++;
  for (let k = 0; k < N; k++) if (cellSite[k] >= 0) cellProv[k] = siteProv[cellSite[k]];
  for (let pass = 0; pass < 40; pass++) {
    let changed = 0;
    for (let y = 1; y < MH - 1; y++) for (let x = 1; x < MW - 1; x++) {
      const k = y * MW + x;
      if (cellSite[k] < 0 || cellProv[k] >= 0) continue;
      const nbp = cellProv[k - 1] >= 0 ? cellProv[k - 1] : cellProv[k + 1] >= 0 ? cellProv[k + 1] : cellProv[k - MW] >= 0 ? cellProv[k - MW] : cellProv[k + MW];
      if (nbp >= 0) { cellProv[k] = nbp; changed++; }
    }
    if (!changed) break;
  }
  // Leftover islets: their own province if big enough, otherwise sea
  const extra = {};
  for (let k = 0; k < N; k++) if (cellSite[k] >= 0 && cellProv[k] < 0) {
    const s = cellSite[k];
    if (siteCount[s] >= 10) { if (extra[s] == null) extra[s] = np++; cellProv[k] = extra[s]; }
    else { elev[k] = -0.02; cellSite[k] = -1; }
  }
  }
  // Province stats
  const P = [];
  for (let i = 0; i < np; i++) P.push({ id: i, rc: real ? provRc[i] : -1, area: 0, sx: 0, sy: 0, e: 0, m: 0, t: 0, nb: new Set(), coast: 0, wx: 0, wy: 0, minx: 1e9, miny: 1e9, maxx: 0, maxy: 0 });
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const k = y * MW + x, p = cellProv[k];
    if (p < 0) continue;
    const q = P[p];
    q.area++; q.sx += x; q.sy += y; q.e += elev[k]; q.m += moist[k];
    q.t += temp[k];
    if (x < q.minx) q.minx = x; if (x > q.maxx) q.maxx = x; if (y < q.miny) q.miny = y; if (y > q.maxy) q.maxy = y;
    const nbs = [k + 1, k + MW, k - 1, k - MW];
    for (let d = 0; d < 4; d++) {
      const kk = nbs[d];
      if (kk < 0 || kk >= N) continue;
      const pp = cellProv[kk];
      if (pp < 0) { q.coast++; q.wx += kk % MW; q.wy += (kk / MW) | 0; }
      else if (pp !== p && d < 2) { q.nb.add(pp); P[pp].nb.add(p); }
    }
  }
  for (const q of P) {
    q.cx = q.sx / q.area; q.cy = q.sy / q.area; q.e /= q.area; q.m /= q.area; q.t /= q.area;
    q.coastal = q.coast > 6;
    if (q.coastal) { const dx = q.wx / q.coast - q.cx, dy = q.wy / q.coast - q.cy, l = Math.hypot(dx, dy) || 1; q.cdx = dx / l; q.cdy = dy / l; }
    else { q.cdx = 1; q.cdy = 0; }
    q.neighbors = [...q.nb]; delete q.nb;
    // Ensure label point lies inside the province (centroid may fall outside on crescents)
    const ck = Math.round(q.cy) * MW + Math.round(q.cx);
    if (cellProv[ck] !== q.id) {
      let best = 1e9;
      for (let y = q.miny; y <= q.maxy; y++) for (let x = q.minx; x <= q.maxx; x++) {
        if (cellProv[y * MW + x] !== q.id) continue;
        const d = (x - q.cx) ** 2 + (y - q.cy) ** 2;
        if (d < best) { best = d; q.lx = x; q.ly = y; }
      }
      q.cx = q.lx; q.cy = q.ly;
    }
  }
  // Terrain by quantiles so every world has a mix of biomes
  const byE = [...P].sort((a, b) => b.e - a.e);
  byE.forEach((q, i) => { const f = i / P.length; q.terrain = f < 0.09 ? 'mountain' : f < 0.22 ? 'hills' : null; });
  const byT = [...P].sort((a, b) => a.t - b.t);
  byT.forEach((q, i) => { if (!q.terrain && i / P.length < 0.09) q.terrain = 'tundra'; });
  const warm = P.filter(q => !q.terrain).sort((a, b) => a.m - b.m);
  warm.forEach((q, i) => { const f = i / warm.length; q.terrain = (f < 0.17 && q.t > 0.35) ? 'desert' : f > 0.68 ? 'forest' : 'grassland'; });
  // Rivers flow downhill from highlands to the sea
  const rivers = real ? realRivers(real) : [];
  const highs = real ? [] : P.filter(q => q.terrain === 'mountain' || q.terrain === 'hills');
  for (let r = 0; r < 26 && highs.length; r++) {
    const src = highs[Math.floor(rng() * highs.length)];
    let x = src.cx, y = src.cy, pts = [[x, y]], dir = rng() * Math.PI * 2, ok = false;
    for (let step = 0; step < 220; step++) {
      let bestE = 1e9, bx = 0, by = 0, bd = dir;
      for (let a = -2; a <= 2; a++) {
        const ang = dir + a * 0.45, nx = x + Math.cos(ang) * 4, ny = y + Math.sin(ang) * 4;
        if (nx < 1 || ny < 1 || nx >= MW - 1 || ny >= MH - 1) continue;
        const e = elev[Math.round(ny) * MW + Math.round(nx)] + (rng() - 0.5) * 0.02 + Math.abs(a) * 0.004;
        if (e < bestE) { bestE = e; bx = nx; by = ny; bd = ang; }
      }
      if (bestE === 1e9) break;
      x = bx; y = by; dir = bd; pts.push([x, y]);
      if (bestE <= 0) { ok = true; break; }
    }
    if (ok && pts.length > 12) rivers.push(pts);
  }
  for (const pts of rivers) for (const [x, y] of pts) {
    if (x < 0 || y < 0 || x >= MW - 1 || y >= MH - 1) continue;
    const p = cellProv[Math.round(y) * MW + Math.round(x)];
    if (p >= 0 && !P[p].river) { P[p].river = true; P[p].riverAng = rng() * Math.PI; }
  }
  // Sea links between nearby coastal provinces (naval transport / invasions)
  const coastals = P.filter(q => q.coastal);
  for (const q of coastals) {
    q.sea = q.sea || [];
    const cands = coastals.filter(o => o !== q && !q.neighbors.includes(o.id)).map(o => [o, Math.hypot(o.cx - q.cx, o.cy - q.cy)]).filter(a => a[1] < 120).sort((a, b) => a[1] - b[1]).slice(0, 3);
    for (const [o] of cands) { if (!q.sea.includes(o.id)) q.sea.push(o.id); o.sea = o.sea || []; if (!o.sea.includes(q.id)) o.sea.push(q.id); }
  }
  for (const q of P) q.sea = q.sea || [];
  // Precomputed relief shading and borders
  const shade = new Float32Array(N), border = new Uint8Array(N);
  for (let y = 1; y < MH - 1; y++) for (let x = 1; x < MW - 1; x++) {
    const k = y * MW + x;
    shade[k] = clamp(1 + (elev[k - MW - 1] - elev[k + MW + 1]) * 9, 0.7, 1.25);
    const p = cellProv[k];
    if (p >= 0 && (cellProv[k + 1] !== p || cellProv[k - 1] !== p || cellProv[k + MW] !== p || cellProv[k - MW] !== p)) border[k] = 1;
  }
  return { seed, mapType, elev, moist, cellProv, shade, border, provs: P, rivers, real: real ? { names: real.names, codes: real.codes, proj: real.proj, hist: real.hist || null } : null };
}

// ------------------------------------------------------------
// Province 3D terrain height — shared by the 3D view and AI auto-placement
// ------------------------------------------------------------
function provHeight(p, x, z) {
  const s = p.seed, t = p.terrain;
  const n = fbm((x + 500) / 70, (z + 500) / 70, s, 4);
  const n2 = fbm((x + 900) / 26, (z + 900) / 26, s + 5, 3);
  let h;
  if (t === 'grassland') h = 2.2 + (n - 0.5) * 14 + (n2 - 0.5) * 2;
  else if (t === 'forest') h = 2.6 + (n - 0.5) * 16 + (n2 - 0.5) * 3;
  else if (t === 'hills') h = 4 + (n - 0.5) * 34 + (n2 - 0.5) * 4;
  else if (t === 'tundra') h = 2.4 + (n - 0.5) * 14 + (n2 - 0.5) * 3;
  else if (t === 'desert') h = Math.max(0.6, 2.4 + (n - 0.5) * 10 + Math.sin(x * 0.11 + n * 7) * 1.8 * n2);
  else {
    const r = Math.sqrt(x * x + z * z);
    const rid = 1 - Math.abs(fbm((x + 300) / 46, (z + 300) / 46, s + 9, 4) * 2 - 1);
    h = 3 + (n - 0.5) * 6 + smoothstep(22, 80, r) * (rid * rid * 80 + n * 22);
  }
  if (p.coastal) { const d = x * p.cdx + z * p.cdy; h -= Math.max(0, d - 38) * 0.32; }
  if (p.river) {
    const a = p.riverAng, u = x * Math.cos(a) + z * Math.sin(a), v = -x * Math.sin(a) + z * Math.cos(a);
    const c = 34 + Math.sin(u / 38 + (s % 10)) * 12, dv = v - c, g = Math.exp(-(dv * dv) / 60);
    h = h * (1 - g) - 2.2 * g;
  }
  const edge = Math.max(Math.abs(x), Math.abs(z));
  if (edge > 100) h += (edge - 100) * 0.4;
  return h;
}
function provSlope(p, x, z) {
  return Math.max(Math.abs(provHeight(p, x + 2, z) - provHeight(p, x - 2, z)), Math.abs(provHeight(p, x, z + 2) - provHeight(p, x, z - 2)));
}
function findTownCenter(p) {
  for (let r = 0; r < 70; r += 4) for (let a = 0; a < 8; a++) {
    const x = Math.cos(a * Math.PI / 4) * r, z = Math.sin(a * Math.PI / 4) * r;
    const h = provHeight(p, x, z);
    if (h > 1 && provSlope(p, x, z) < 2.5) return { x, z };
  }
  return { x: 0, z: 0 };
}
// Check whether a footprint can go at (x,z): land, gentle, inside, not overlapping
function canPlaceAt(p, type, x, z, ignoreId) {
  const B = BUILDINGS[type], r = B.r;
  if (Math.abs(x) > 96 - r || Math.abs(z) > 96 - r) return 'Outside the province';
  const h = provHeight(p, x, z);
  if (h < 0.5) return 'Cannot build on water';
  if (B.coastal) {
    let near = false;
    for (let a = 0; a < 8 && !near; a++) if (provHeight(p, x + Math.cos(a * 0.785) * (r + 6), z + Math.sin(a * 0.785) * (r + 6)) < 0) near = true;
    if (!near) return 'Must be built at the shoreline';
  } else if (provSlope(p, x, z) > Math.max(3, r * 0.6)) return 'Ground too steep';
  for (const b of p.buildings) {
    if (b.id === ignoreId) continue;
    if (Math.hypot(b.x - x, b.z - z) < BUILDINGS[b.t].r + r + 0.5) return 'Overlaps another building';
  }
  return null;
}
function autoPlace(p, type, rng) {
  const tc = p.town || (p.town = findTownCenter(p));
  const B = BUILDINGS[type];
  if (B.coastal) {
    for (let d = 20; d < 100; d += 3) for (let o = -30; o <= 30; o += 10) {
      const x = tc.x + p.cdx * d - p.cdy * o, z = tc.z + p.cdy * d + p.cdx * o;
      if (!canPlaceAt(p, type, x, z)) return { x, z, r: Math.atan2(p.cdx, p.cdy) };
    }
    return null;
  }
  const big = B.r > 7;
  for (let i = 0; i < 70; i++) {
    const ang = rng() * Math.PI * 2, rad = (big ? 18 : 6) + i * 1.3 + rng() * 8;
    const x = tc.x + Math.cos(ang) * rad, z = tc.z + Math.sin(ang) * rad;
    if (!canPlaceAt(p, type, x, z)) return { x, z, r: Math.round(Math.atan2(tc.x - x, tc.z - z) / (Math.PI / 4)) * (Math.PI / 4) };
  }
  return null;
}

// ------------------------------------------------------------
// Map bitmap
// ------------------------------------------------------------
function renderMapBitmap(geo, imgData, colorOf, opts) {
  const d = imgData.data, cp = geo.cellProv, el = geo.elev, sh = geo.shade, bo = geo.border;
  const provs = G.provs, sel = opts.sel, shadeAmt = opts.shadeAmt, winter = opts.winter;
  const pc = new Array(provs.length), ctrl = new Int32Array(provs.length);
  for (let i = 0; i < provs.length; i++) { pc[i] = colorOf(provs[i]); ctrl[i] = provs[i].controller; }
  const warAt = opts.warPairs;
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const k = y * MW + x, o = k * 4, p = cp[k];
    if (p < 0) {
      const e = el[k];
      const t = clamp(-e * 2.2, 0, 1);
      d[o] = lerp(58, 22, t); d[o + 1] = lerp(92, 44, t); d[o + 2] = lerp(110, 68, t); d[o + 3] = 255;
      continue;
    }
    let c = pc[p];
    if (c.length === 6) c = (((x + y) >> 2) & 1) ? c : [c[3], c[4], c[5]];
    let s = 1 + (sh[k] - 1) * shadeAmt;
    let r = c[0] * s, g = c[1] * s, b = c[2] * s;
    if (winter && (y < MH * 0.28 || el[k] > 0.33)) { const w = y < MH * 0.18 || el[k] > 0.4 ? 0.55 : 0.3; r = lerp(r, 236, w); g = lerp(g, 240, w); b = lerp(b, 246, w); }
    if (p === sel) { r = r * 0.7 + 255 * 0.3; g = g * 0.7 + 245 * 0.3; b = b * 0.7 + 200 * 0.3; }
    if (bo[k]) {
      let other = -1;
      const nbs = [k + 1, k - 1, k + MW, k - MW];
      for (const kk of nbs) { const pp = cp[kk]; if (pp >= 0 && pp !== p) { other = pp; break; } }
      if (other >= 0 && ctrl[other] !== ctrl[p]) {
        if (warAt && warAt(ctrl[p], ctrl[other])) { r = 205; g = 40; b = 30; }
        else { r *= 0.3; g *= 0.3; b *= 0.3; }
      } else if (other >= 0) { r *= 0.78; g *= 0.78; b *= 0.78; }
      else { r *= 0.55; g *= 0.55; b *= 0.6; }
      if (p === sel || other === sel) { r = 255; g = 236; b = 150; }
    }
    d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = 255;
  }
}
