// ============================================================
// WAR OF NATIONS — real-world maps (Europe, World) built from Natural Earth borders
// ============================================================
'use strict';

const REAL_MAPS = {
  europe: { name: 'Europe', lon0: -25, lon1: 60, lat0: 33, lat1: 71, proj: 'equi', kx: Math.cos(52 * Math.PI / 180) },
  world: { name: 'The World', lon0: -180, lon1: 180, lat0: -57, lat1: 80, proj: 'miller' },
};
const isRealMap = t => !!REAL_MAPS[t];
const REAL_SKIP = new Set(['Antarctica', 'Fr. S. Antarctic Lands', 'Heard I. and McDonald Is.', 'S. Geo. and the Is.', 'Br. Indian Ocean Ter.', 'Siachen Glacier', 'Ashmore and Cartier Is.', 'Indian Ocean Ter.']);
const REAL_RENAME = {
  'United States of America': 'United States', 'Dem. Rep. Congo': 'DR Congo', 'Bosnia and Herz.': 'Bosnia', 'Central African Rep.': 'Central Africa', 'S. Sudan': 'South Sudan',
  'Eq. Guinea': 'Equatorial Guinea', 'Dominican Rep.': 'Dominican Republic', 'W. Sahara': 'Western Sahara', 'Solomon Is.': 'Solomon Islands', 'Falkland Is.': 'Falklands',
  'N. Cyprus': 'North Cyprus', 'Macedonia': 'North Macedonia', 'eSwatini': 'Eswatini', 'Faeroe Is.': 'Faroe Islands', 'Antigua and Barb.': 'Antigua', 'St. Vin. and Gren.': 'St Vincent',
  'Marshall Is.': 'Marshall Islands', 'N. Mariana Is.': 'Mariana Islands', 'Cayman Is.': 'Cayman Islands', 'Turks and Caicos Is.': 'Turks and Caicos', 'Pitcairn Is.': 'Pitcairn', 'Cook Is.': 'Cook Islands',
  'U.S. Virgin Is.': 'US Virgin Islands', 'British Virgin Is.': 'British Virgin Islands', 'Wallis and Futuna Is.': 'Wallis and Futuna', 'Fr. Polynesia': 'French Polynesia', 'St. Pierre and Miquelon': 'St Pierre', 'St. Kitts and Nevis': 'St Kitts',
};
const DEMONYM = {
  France: 'French', Germany: 'German', 'United Kingdom': 'British', Spain: 'Spanish', Portugal: 'Portuguese', Italy: 'Italian', Poland: 'Polish', Netherlands: 'Dutch', Belgium: 'Belgian',
  Switzerland: 'Swiss', Sweden: 'Swedish', Norway: 'Norwegian', Finland: 'Finnish', Denmark: 'Danish', Ireland: 'Irish', Greece: 'Greek', Turkey: 'Turkish', China: 'Chinese', Japan: 'Japanese',
  'United States': 'American', Canada: 'Canadian', Mexico: 'Mexican', Brazil: 'Brazilian', Argentina: 'Argentine', Egypt: 'Egyptian', Iran: 'Persian', Iraq: 'Iraqi', India: 'Indian', Pakistan: 'Pakistani',
  Hungary: 'Hungarian', Czechia: 'Czech', Slovakia: 'Slovak', Ukraine: 'Ukrainian', Belarus: 'Belarusian', Serbia: 'Serbian', Croatia: 'Croatian', Romania: 'Romanian', Bulgaria: 'Bulgarian', Iceland: 'Icelandic',
  Kazakhstan: 'Kazakh', 'Saudi Arabia': 'Arabian', Thailand: 'Thai', Vietnam: 'Vietnamese', Philippines: 'Filipino', Israel: 'Israeli', Morocco: 'Moroccan', Algeria: 'Algerian', Libya: 'Libyan', Tunisia: 'Tunisian',
  'South Africa': 'South African', Nigeria: 'Nigerian', Ethiopia: 'Ethiopian', Mongolia: 'Mongolian', Afghanistan: 'Afghan', Russia: 'Russian', Austria: 'Austrian', Lithuania: 'Lithuanian', Latvia: 'Latvian', Estonia: 'Estonian',
  Slovenia: 'Slovene', Albania: 'Albanian', 'North Macedonia': 'Macedonian', Montenegro: 'Montenegrin', Bosnia: 'Bosnian', Moldova: 'Moldovan', Georgia: 'Georgian', Armenia: 'Armenian', Azerbaijan: 'Azerbaijani',
  Syria: 'Syrian', Lebanon: 'Lebanese', Jordan: 'Jordanian', Cyprus: 'Cypriot', Luxembourg: 'Luxembourgish', 'South Korea': 'Korean', 'North Korea': 'Korean', Indonesia: 'Indonesian', Australia: 'Australian',
  Chile: 'Chilean', Peru: 'Peruvian', Colombia: 'Colombian', Venezuela: 'Venezuelan', Cuba: 'Cuban', Uzbekistan: 'Uzbek', Turkmenistan: 'Turkmen', Myanmar: 'Burmese', 'New Zealand': 'New Zealander', Kosovo: 'Kosovar',
};
const REAL_CAPITALS = {
  France: [2.35, 48.86], Germany: [13.4, 52.52], 'United Kingdom': [-0.13, 51.5], Spain: [-3.7, 40.42], Portugal: [-9.14, 38.72], Italy: [12.5, 41.9], Poland: [21.01, 52.23], Netherlands: [4.9, 52.37],
  Belgium: [4.35, 50.85], Switzerland: [7.45, 46.95], Austria: [16.37, 48.21], Czechia: [14.42, 50.08], Slovakia: [17.11, 48.15], Hungary: [19.04, 47.5], Romania: [26.1, 44.43], Bulgaria: [23.32, 42.7],
  Serbia: [20.46, 44.79], Croatia: [15.98, 45.81], Bosnia: [18.41, 43.86], Slovenia: [14.5, 46.05], Greece: [23.73, 37.98], Turkey: [32.85, 39.93], Sweden: [18.07, 59.33], Norway: [10.75, 59.91],
  Finland: [24.94, 60.17], Denmark: [12.57, 55.68], Ireland: [-6.26, 53.35], Iceland: [-21.9, 64.15], Estonia: [24.75, 59.44], Latvia: [24.1, 56.95], Lithuania: [25.28, 54.69], Belarus: [27.56, 53.9],
  Ukraine: [30.52, 50.45], Moldova: [28.86, 47.01], Russia: [37.62, 55.75], Albania: [19.82, 41.33], 'North Macedonia': [21.43, 42.0], Montenegro: [19.26, 42.44], Kosovo: [21.17, 42.67], Georgia: [44.8, 41.72],
  Armenia: [44.51, 40.18], Azerbaijan: [49.87, 40.41], Kazakhstan: [71.45, 51.17], Iran: [51.39, 35.69], Iraq: [44.37, 33.31], Syria: [36.29, 33.51], Lebanon: [35.5, 33.89], Jordan: [35.93, 31.95],
  Israel: [35.21, 31.77], 'Saudi Arabia': [46.72, 24.69], Egypt: [31.24, 30.04], Libya: [13.19, 32.89], Tunisia: [10.18, 36.81], Algeria: [3.06, 36.75], Morocco: [-6.84, 34.02], Cyprus: [33.38, 35.17],
  Luxembourg: [6.13, 49.61], 'United States': [-77.04, 38.9], Canada: [-75.7, 45.42], Mexico: [-99.13, 19.43], Brazil: [-47.88, -15.79], Argentina: [-58.38, -34.6], Chile: [-70.67, -33.45], Peru: [-77.04, -12.05],
  Colombia: [-74.07, 4.71], Venezuela: [-66.9, 10.48], China: [116.4, 39.9], Japan: [139.69, 35.69], India: [77.21, 28.61], Pakistan: [73.05, 33.68], 'South Korea': [126.98, 37.57], 'North Korea': [125.75, 39.03],
  Mongolia: [106.92, 47.92], Afghanistan: [69.16, 34.53], Thailand: [100.5, 13.76], Vietnam: [105.83, 21.03], Indonesia: [106.85, -6.21], Philippines: [120.98, 14.6], Australia: [149.13, -35.28], 'New Zealand': [174.78, -41.29],
  'South Africa': [28.19, -25.75], Nigeria: [7.49, 9.06], Ethiopia: [38.75, 9.03], Kenya: [36.82, -1.29], 'DR Congo': [15.27, -4.44], Uzbekistan: [69.24, 41.3], Turkmenistan: [58.38, 37.95], Myanmar: [96.13, 19.75],
};
const CAPITAL_NAMES = {
  France: 'Paris', Germany: 'Berlin', 'United Kingdom': 'London', Spain: 'Madrid', Portugal: 'Lisbon', Italy: 'Rome', Poland: 'Warsaw', Netherlands: 'Amsterdam', Belgium: 'Brussels', Switzerland: 'Bern',
  Austria: 'Vienna', Czechia: 'Prague', Slovakia: 'Bratislava', Hungary: 'Budapest', Romania: 'Bucharest', Bulgaria: 'Sofia', Serbia: 'Belgrade', Croatia: 'Zagreb', Bosnia: 'Sarajevo', Slovenia: 'Ljubljana',
  Greece: 'Athens', Turkey: 'Ankara', Sweden: 'Stockholm', Norway: 'Oslo', Finland: 'Helsinki', Denmark: 'Copenhagen', Ireland: 'Dublin', Iceland: 'Reykjavik', Estonia: 'Tallinn', Latvia: 'Riga',
  Lithuania: 'Vilnius', Belarus: 'Minsk', Ukraine: 'Kyiv', Moldova: 'Chisinau', Russia: 'Moscow', Albania: 'Tirana', 'North Macedonia': 'Skopje', Montenegro: 'Podgorica', Kosovo: 'Pristina', Georgia: 'Tbilisi',
  Armenia: 'Yerevan', Azerbaijan: 'Baku', Kazakhstan: 'Astana', Iran: 'Tehran', Iraq: 'Baghdad', Syria: 'Damascus', Lebanon: 'Beirut', Jordan: 'Amman', Israel: 'Jerusalem', 'Saudi Arabia': 'Riyadh',
  Egypt: 'Cairo', Libya: 'Tripoli', Tunisia: 'Tunis', Algeria: 'Algiers', Morocco: 'Rabat', Cyprus: 'Nicosia', Luxembourg: 'Luxembourg', 'United States': 'Washington', Canada: 'Ottawa', Mexico: 'Mexico City',
  Brazil: 'Brasília', Argentina: 'Buenos Aires', Chile: 'Santiago', Peru: 'Lima', Colombia: 'Bogotá', Venezuela: 'Caracas', China: 'Beijing', Japan: 'Tokyo', India: 'New Delhi', Pakistan: 'Islamabad',
  'South Korea': 'Seoul', 'North Korea': 'Pyongyang', Mongolia: 'Ulaanbaatar', Afghanistan: 'Kabul', Thailand: 'Bangkok', Vietnam: 'Hanoi', Indonesia: 'Jakarta', Philippines: 'Manila', Australia: 'Canberra',
  'New Zealand': 'Wellington', 'South Africa': 'Pretoria', Nigeria: 'Abuja', Ethiopia: 'Addis Ababa', Kenya: 'Nairobi', 'DR Congo': 'Kinshasa', Uzbekistan: 'Tashkent', Turkmenistan: 'Ashgabat', Myanmar: 'Naypyidaw',
};
const REAL_COLORS = {
  France: [56, 88, 168], Germany: [92, 92, 92], 'United Kingdom': [186, 66, 66], Italy: [66, 138, 82], Russia: [122, 34, 42], Spain: [196, 166, 58], Portugal: [44, 112, 64], Poland: [188, 92, 120],
  'United States': [62, 98, 160], China: [196, 172, 82], Japan: [222, 214, 196], Turkey: [150, 180, 118], Sweden: [70, 120, 186], Norway: [150, 70, 70], Finland: [210, 222, 236], Austria: [214, 214, 214],
  Hungary: [160, 120, 80], Romania: [196, 186, 68], Netherlands: [226, 128, 48], Belgium: [212, 188, 48], Switzerland: [196, 56, 56], Greece: [96, 150, 204], Ukraine: [96, 132, 196], Canada: [176, 56, 56],
  India: [228, 150, 70], Brazil: [64, 150, 80], Iran: [96, 148, 108], Egypt: [210, 196, 120], Mexico: [96, 132, 68], Australia: [70, 104, 160], Denmark: [178, 74, 84], Czechia: [70, 108, 176],
};
const FLAG_SPECS = {
  France: ['vtri', '#0055a4', '#ffffff', '#ef4135'], Italy: ['vtri', '#009246', '#ffffff', '#ce2b37'], Ireland: ['vtri', '#169b62', '#ffffff', '#ff883e'], Belgium: ['vtri', '#1a1a1a', '#fdda24', '#ef3340'],
  Romania: ['vtri', '#002b7f', '#fcd116', '#ce1126'], Mexico: ['vtri', '#006847', '#ffffff', '#ce1126'], Nigeria: ['vtri', '#008751', '#ffffff', '#008751'], Canada: ['vtri', '#d52b1e', '#ffffff', '#d52b1e'],
  Germany: ['htri', '#1a1a1a', '#dd0000', '#ffce00'], Russia: ['htri', '#ffffff', '#0039a6', '#d52b1e'], Netherlands: ['htri', '#ae1c28', '#ffffff', '#21468b'], Austria: ['htri', '#ed2939', '#ffffff', '#ed2939'],
  Hungary: ['htri', '#ce2939', '#ffffff', '#477050'], Bulgaria: ['htri', '#ffffff', '#00966e', '#d62612'], Lithuania: ['htri', '#fdb913', '#006a44', '#c1272d'], Estonia: ['htri', '#0072ce', '#1a1a1a', '#ffffff'],
  Latvia: ['htri', '#9e3039', '#ffffff', '#9e3039'], Luxembourg: ['htri', '#ed2939', '#ffffff', '#00a1de'], Spain: ['htri', '#aa151b', '#f1bf00', '#aa151b'], Egypt: ['htri', '#ce1126', '#ffffff', '#1a1a1a'],
  Iraq: ['htri', '#ce1126', '#ffffff', '#1a1a1a'], Syria: ['htri', '#ce1126', '#ffffff', '#1a1a1a'], Iran: ['htri', '#239f40', '#ffffff', '#da0000'], Armenia: ['htri', '#d90012', '#0033a0', '#f2a800'],
  India: ['htri', '#ff9933', '#ffffff', '#138808', 'circle', '#000080', 0.22], Argentina: ['htri', '#74acdf', '#ffffff', '#74acdf', 'sun', '#f6b40e', 0.3],
  Poland: ['hbi', '#ffffff', '#dc143c'], Ukraine: ['hbi', '#0057b7', '#ffd700'], Indonesia: ['hbi', '#ff0000', '#ffffff'], Czechia: ['hbi', '#ffffff', '#d7141a'],
  Sweden: ['nordic', '#006aa7', '#fecc00', '#fecc00'], Denmark: ['nordic', '#c60c30', '#ffffff', '#ffffff'], Norway: ['nordic', '#ba0c2f', '#ffffff', '#00205b'], Finland: ['nordic', '#ffffff', '#002f6c', '#002f6c'],
  Iceland: ['nordic', '#02529c', '#ffffff', '#dc1e35'], Switzerland: ['solid', '#d52b1e', '', '', 'cross', '#ffffff', 0.5], Japan: ['solid', '#ffffff', '', '', 'circle', '#bc002d', 0.55],
  China: ['solid', '#de2910', '', '', 'star', '#ffde00', 0.32, 0.2, 0.28], Vietnam: ['solid', '#da251d', '', '', 'star', '#ffff00', 0.5], Turkey: ['solid', '#e30a17', '', '', 'crescent', '#ffffff', 0.5, 0.42],
  Tunisia: ['solid', '#e70013', '', '', 'crescent', '#ffffff', 0.45], Morocco: ['solid', '#c1272d', '', '', 'star', '#006233', 0.45], 'Saudi Arabia': ['solid', '#006c35', '', '', 'sword', '#ffffff', 0.5],
  'United States': ['canton', '#b22234', '#3c3b6e', '#ffffff'], 'United Kingdom': ['saltire', '#012169', '#ffffff', '', 'cross', '#c8102e', 0.95], Greece: ['canton', '#0d5eaf', '#0d5eaf', '#ffffff'],
  Portugal: ['vbi', '#006600', '#ff0000', '', 'shield', '#ffcc00', 0.38, 0.4], Brazil: ['solid', '#009c3b', '', '', 'circle', '#002776', 0.5], 'South Korea': ['solid', '#ffffff', '', '', 'circle', '#cd2e3a', 0.45],
  Australia: ['canton', '#012169', '#012169', '#012169', 'star', '#ffffff', 0.25, 0.75, 0.6], Algeria: ['vbi', '#006233', '#ffffff', '', 'crescent', '#d21034', 0.45], Serbia: ['htri', '#c6363c', '#0c4076', '#ffffff'],
  Croatia: ['htri', '#ff0000', '#ffffff', '#171796'], Slovakia: ['htri', '#ffffff', '#0b4ea2', '#ee1c25'], Slovenia: ['htri', '#ffffff', '#005da4', '#ed1c24'], Belarus: ['hbi', '#c8313e', '#4aa657'],
};
const REAL_PERSONALITY = {
  Germany: 'industrial', Russia: 'expansionist', 'United States': 'industrial', 'United Kingdom': 'merchant', France: 'defensive', Italy: 'expansionist', Japan: 'militarist', China: 'expansionist',
  Switzerland: 'neutral', Sweden: 'neutral', Ireland: 'neutral', Portugal: 'merchant', Netherlands: 'merchant', Turkey: 'expansionist', Spain: 'defensive', Poland: 'defensive', Belgium: 'neutral',
};

// ---------- TopoJSON ----------
function topoFeatures(topo, objName) {
  const T = topo.transform;
  const arcs = topo.arcs.map(a => { let x = 0, y = 0; return a.map(p => { x += p[0]; y += p[1]; return [x * T.scale[0] + T.translate[0], y * T.scale[1] + T.translate[1]]; }); });
  const arcPts = i => i >= 0 ? arcs[i] : arcs[~i].slice().reverse();
  const ring = idx => { const pts = []; idx.forEach((i, k) => { const a = arcPts(i); for (let j = k ? 1 : 0; j < a.length; j++) pts.push(a[j]); }); return pts; };
  return topo.objects[objName].geometries.map(g => {
    const polys = g.type === 'Polygon' ? [g.arcs.map(ring)] : g.type === 'MultiPolygon' ? g.arcs.map(p => p.map(ring)) : [];
    return { name: g.properties && g.properties.name, id: g.id, polys };
  });
}
// Rings that cross the antimeridian (Russia, Fiji) are unwrapped into continuous longitudes,
// then the overhanging part is duplicated on the other side of the map
function unwrapRing(r) {
  let off = 0;
  const u = [[r[0][0], r[0][1]]];
  for (let i = 1; i < r.length; i++) {
    const d = r[i][0] - r[i - 1][0];
    if (d > 180) off -= 360; else if (d < -180) off += 360;
    u.push([r[i][0] + off, r[i][1]]);
  }
  return u;
}
function wrapPolys(rawPolys) {
  const polys = [];
  for (const poly of rawPolys) {
    const u = poly.map(unwrapRing);
    polys.push(u);
    let lo = 1e9, hi = -1e9;
    for (const r of u) for (const p of r) { if (p[0] < lo) lo = p[0]; if (p[0] > hi) hi = p[0]; }
    if (hi > 180) polys.push(u.map(r => r.map(p => [p[0] - 360, p[1]])));
    if (lo < -180) polys.push(u.map(r => r.map(p => [p[0] + 360, p[1]])));
  }
  return polys;
}
let _realFeats = null;
function realFeatures() {
  if (_realFeats) return _realFeats;
  _realFeats = topoFeatures(WORLD_TOPO, 'countries').filter(f => f.name && !REAL_SKIP.has(f.name)).map(f => {
    const name = REAL_RENAME[f.name] || f.name;
    return { name, code: (typeof ISO_NUM !== 'undefined' && ISO_NUM[f.id]) || isoForName(name), polys: wrapPolys(f.polys) };
  });
  return _realFeats;
}
// ---------- historical borders ----------
// Border years offered for real maps; 'auto' follows the starting era
const HIST_YEARS = [1200, 1530, 1815, 1880, 1938, 1994];
const ERA_HIST_YEAR = [1200, 1530, 1815, 1938, 1994, null];
const UNCLAIMED_RC = 1000;
const HIST_ALIAS = {
  'United Kingdom of Great Britain and Ireland': 'United Kingdom', 'UK': 'United Kingdom', 'United States of America': 'United States', 'USA': 'United States',
  'Byelarus': 'Belarus', 'Korea, Republic of': 'South Korea', 'Zaire': 'DR Congo', 'Burgandy': 'Burgundy', 'Britany': 'Brittany', 'Austria Hungary': 'Austria-Hungary',
  'Imperial Japan': 'Empire of Japan', 'Sweden–Norway': 'Sweden-Norway',
};
function histName(n) {
  n = HIST_ALIAS[n] || n;
  const m = n.match(/^(.*)\s\(([^)]+)\)$/);
  if (m) { const inner = HIST_ALIAS[m[2]] || m[2]; if (/claim/i.test(inner)) return null; if (inner.length > 2 && !/Warring|Fujiwara/.test(inner)) return inner; }
  return n;
}
const _histCache = {};
function histFeatures(year) {
  if (_histCache[year]) return _histCache[year];
  const by = new Map();
  for (const e0 of HIST_MAPS[year] || []) {
    const e = Array.isArray(e0) ? e0 : e0.value;
    const name = histName(e[0]);
    if (!name) continue;
    const rings = e[1].map(r => { const flat = Array.isArray(r) ? r : r.value; const pts = []; for (let i = 0; i < flat.length; i += 2) pts.push([flat[i], flat[i + 1]]); return pts; });
    if (!by.has(name)) by.set(name, []);
    for (const r of rings) by.get(name).push([r]);
  }
  _histCache[year] = [...by].map(([name, polys]) => ({ name, code: isoForName(name), polys: wrapPolys(polys) }));
  return _histCache[year];
}
function isoForName(n) {
  if (typeof ISO_NAME === 'undefined') return null;
  return ISO_NAME[n] || ISO_NAME[REAL_RENAME[n]] || ISO_NAME[n.replace(/^(Kingdom|Empire|Republic) of /, '')] || null;
}
// ---------- projections, fitted into the cell grid ----------
// Europe: equirectangular scaled at 50°N (keeps the north from ballooning); World: Miller cylindrical
const D2R = Math.PI / 180;
const PROJ_Y = {
  equi: { f: lat => lat * D2R, i: y => y / D2R },
  miller: { f: lat => 1.25 * Math.log(Math.tan(Math.PI / 4 + 0.4 * clamp(lat, -85, 85) * D2R)), i: y => (2.5 * Math.atan(Math.exp(y / 1.25)) - 0.625 * Math.PI) / D2R },
};
function makeProj(f) {
  const Y = PROJ_Y[f.proj], kx = f.kx || 1;
  const x0 = f.lon0 * D2R * kx, x1 = f.lon1 * D2R * kx, y0 = Y.f(f.lat0), y1 = Y.f(f.lat1);
  const s = Math.min(MW / (x1 - x0), MH / (y1 - y0));
  const ox = (MW - (x1 - x0) * s) / 2, oy = (MH - (y1 - y0) * s) / 2;
  return {
    s,
    fwd: (lon, lat) => [ox + (lon * D2R * kx - x0) * s, oy + (y1 - Y.f(lat)) * s],
    inv: (x, y) => [((x - ox) / s + x0) / kx / D2R, Y.i(y1 - (y - oy) / s)],
  };
}
// ---------- rasterize country polygons onto cells ----------
// histYear: null for today's borders, or one of HIST_YEARS. Land outside every historical state is unclaimed.
function rasterizeReal(type, histYear) {
  const P = makeProj(REAL_MAPS[type]);
  const modern = realFeatures();
  const rc = rasterFeatures(modern, P, 'evenodd');
  if (!histYear) return { rc, names: modern.map(f => f.name), codes: modern.map(f => f.code), proj: P, type };
  const hist = histFeatures(histYear);
  const hrc = rasterFeatures(hist, P, 'nonzero');
  for (let k = 0; k < rc.length; k++) if (rc[k] >= 0) rc[k] = hrc[k] >= 0 ? hrc[k] : UNCLAIMED_RC;
  return { rc, names: hist.map(f => f.name), codes: hist.map(f => f.code), proj: P, type, hist: histYear };
}
function rasterFeatures(feats, P, rule) {
  const cv = document.createElement('canvas'); cv.width = MW; cv.height = MH;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  const rc = new Int16Array(MW * MH).fill(-1);
  feats.forEach((ft, i) => {
    let minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
    const pp = ft.polys.map(poly => poly.map(r => r.map(([lo, la]) => { const p = P.fwd(lo, la); if (p[0] < minx) minx = p[0]; if (p[0] > maxx) maxx = p[0]; if (p[1] < miny) miny = p[1]; if (p[1] > maxy) maxy = p[1]; return p; })));
    minx = Math.max(0, Math.floor(minx)); miny = Math.max(0, Math.floor(miny)); maxx = Math.min(MW - 1, Math.ceil(maxx)); maxy = Math.min(MH - 1, Math.ceil(maxy));
    if (maxx < minx || maxy < miny) return;
    const w = maxx - minx + 1, h = maxy - miny + 1;
    ctx.clearRect(minx, miny, w, h); ctx.fillStyle = '#fff'; ctx.beginPath();
    for (const poly of pp) for (const r of poly) { r.forEach((p, j) => j ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); }
    ctx.fill(rule);
    const d = ctx.getImageData(minx, miny, w, h).data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] >= 128) rc[(miny + y) * MW + minx + x] = i;
    ctx.clearRect(minx, miny, w, h);
  });
  return rc;
}

// ---------- physical geography (approximate) ----------
// mountain ranges: [polyline lon/lat, width (deg), height]
const RANGES = [
  [[[5.5, 44], [7, 45.8], [10, 46.5], [13, 47], [15.5, 47.3]], 1.1, 0.55], [[[-1.8, 43], [1, 42.7], [3, 42.4]], 0.7, 0.4],
  [[[17.5, 48.8], [21, 49.3], [24, 48], [26, 46.5], [25, 45.5], [22.5, 45.2]], 0.9, 0.3], [[[37.5, 44.5], [42, 43.3], [46, 42], [49, 40.8]], 0.9, 0.55],
  [[[59, 51], [59.5, 55], [59.5, 60], [60, 65], [63, 68]], 1.1, 0.25], [[[6, 59], [8, 61.5], [12, 63.5], [15, 66.5], [19, 68.5]], 1.4, 0.32],
  [[[8.5, 44.3], [11.5, 43.5], [13.5, 42.2], [15.5, 40.5], [16.2, 38.8]], 0.7, 0.28], [[[14.5, 45.5], [17.5, 43.5], [20, 42], [21.5, 41], [22, 39.5]], 0.9, 0.28],
  [[[-9, 30.5], [-5, 32.5], [0, 34], [5, 35.5], [9, 35.8]], 1.1, 0.38], [[[30, 37], [36, 37.5], [42, 38], [46, 35], [52, 30], [57, 27.5]], 1.4, 0.38],
  [[[73, 35], [78, 32], [84, 28.5], [88, 27.8], [94, 28.5], [97, 28]], 1.8, 0.75], [[[80, 34], [90, 33], [98, 33]], 4, 0.5],
  [[[70, 39], [76, 41], [82, 42.5], [88, 43.5]], 1.5, 0.45], [[[52, 36], [60, 36], [68, 35.5], [71, 36]], 1.4, 0.38],
  [[[-77, 8], [-78, 0], [-76, -10], [-70, -17], [-68, -24], [-70, -33], [-71.5, -42], [-73, -50]], 1.8, 0.65],
  [[[-150, 62], [-135, 58], [-125, 53], [-117, 48], [-110, 43], [-106, 38], [-106, 33]], 3, 0.45], [[[-84, 34], [-80, 37], [-77, 40], [-73, 43], [-69, 46]], 1.4, 0.22],
  [[[-108, 30], [-104, 24], [-100, 19], [-96, 17]], 1.4, 0.32], [[[38, 14], [39, 9], [38, 6]], 2.6, 0.38], [[[36, 0], [35, -5], [34, -10]], 1.8, 0.26],
  [[[29, -25], [29.5, -29], [27, -32]], 1, 0.26], [[[145, -15], [147, -20], [150, -27], [150, -33], [147, -37]], 1.4, 0.22],
  [[[131, 32], [136, 35.5], [140, 38], [141, 42]], 0.9, 0.28], [[[86, 50], [92, 51], [100, 51]], 1.8, 0.32], [[[-4.5, 57], [-5, 58.3]], 0.8, 0.2],
];
// deserts and forests: [lon, lat, rx, ry] ellipses in degrees
const DESERTS = [[10, 23, 22, 7], [47, 23, 10, 6], [40, 32, 5, 3], [57, 32, 6, 4], [71, 27, 4, 3], [61, 41, 7, 4], [83, 39, 6, 2.5], [105, 42, 10, 4], [130, -25, 17, 8], [21, -23, 6, 5], [15, -23, 2, 6], [-70, -23, 2, 6], [-114, 35, 6, 6], [-69, -45, 4, 5], [-5, 39.5, 3, 2]];
const FORESTS = [[-62, -5, 14, 9], [22, 0, 12, 6], [105, 12, 10, 10], [115, -2, 15, 6], [100, 60, 40, 8], [-95, 55, 35, 7], [35, 61, 25, 5], [20, 52, 14, 5], [-82, 38, 8, 7], [10, 49, 6, 3]];
const RIVERS = [
  [[8.2, 48], [10, 48.5], [13.5, 48.6], [16.4, 48.2], [19, 47.8], [19, 45.5], [22.5, 44.6], [25, 43.7], [28, 44.2], [29.7, 45.2]],
  [[9.5, 46.8], [9.5, 47.5], [7.6, 47.6], [8.2, 49], [7.6, 50.4], [6.8, 51.3], [5.5, 51.9], [4.2, 51.9]],
  [[15.5, 50.5], [14.2, 50.8], [12.5, 51.7], [11.6, 52.9], [10, 53.5], [8.8, 53.9]], [[19, 49.6], [20, 50.1], [21.2, 51.5], [21, 52.2], [19, 53], [18.9, 54.4]],
  [[4, 44.9], [4, 46.4], [3, 47.2], [1.9, 47.9], [0.7, 47.4], [-1.5, 47.2], [-2.2, 47.3]], [[4.7, 47.8], [3.5, 48.4], [2.4, 48.8], [1.2, 49.3], [0.2, 49.4]],
  [[8, 46.5], [6.2, 46.2], [4.8, 45.7], [4.8, 44.5], [4.6, 43.5]], [[7, 44.7], [7.7, 45.1], [9.5, 45.1], [11.5, 45], [12.4, 44.95]], [[-4, 43], [-2, 42.4], [-1, 41.6], [0.5, 41], [0.9, 40.7]],
  [[33, 55.8], [31, 54.6], [30.3, 52], [30.6, 50.4], [33, 49], [35, 47.8], [33.5, 46.7], [32, 46.5]], [[38.3, 53.7], [39.3, 51.5], [42, 49.5], [41.5, 48], [39.5, 47.2]],
  [[33, 57], [38, 57.6], [42, 57], [44, 56.3], [48.5, 55.8], [49.2, 53.2], [46, 51.5], [45, 48.5], [47.8, 46.4]], [[-1.9, 51.7], [-0.1, 51.5], [0.9, 51.5]],
  [[33, 0.5], [32.5, 9.5], [32.5, 15.6], [33.9, 18], [31.5, 21], [32.9, 24.1], [31.2, 30], [31, 31.5]], [[-10, 10], [-6, 13.5], [-3, 16.5], [0, 16], [3.5, 12], [5.5, 8], [6.3, 4.5]],
  [[27, -8], [25.5, 0.5], [22, 1.5], [18, -2], [15.3, -4.3], [12.3, -6]], [[23, -12], [25.5, -17.5], [29, -16], [33, -16], [35.5, -18.5]],
  [[39, 39], [40, 36.3], [42, 35], [44.4, 33.3], [47, 31], [48.5, 29.9]], [[79, 32.5], [75, 35], [72, 33], [71, 29], [68.4, 25.5], [67.5, 24]],
  [[79, 30.9], [80.4, 26.5], [83, 25.3], [87, 25.3], [88.5, 23], [90.5, 22]], [[92, 33.5], [99, 28], [104, 28.8], [107, 29.6], [111, 30.7], [114.3, 30.6], [117, 31], [121.5, 31.4]],
  [[96.5, 35], [103.8, 36], [106, 39], [110, 40.3], [111, 37], [114, 35], [118.5, 37.7]], [[94, 33], [99, 22], [102, 18], [105, 15.5], [105.9, 11.5], [106.5, 9.7]],
  [[117, 49.5], [122, 53.3], [127.5, 50], [132, 48], [135, 48.5], [137, 51], [140.5, 53]], [[86, 52], [82.9, 55], [78, 59], [69, 61], [66, 66], [66.5, 69]],
  [[92, 52], [93, 56], [92, 62], [87.5, 66], [86, 71]], [[106, 54], [108, 58], [118, 60.5], [128, 62.5], [127, 70], [127, 73]],
  [[-95, 47.2], [-93.3, 45], [-91.2, 43], [-90.2, 38.6], [-89.6, 36.5], [-91, 33], [-91.2, 30.5], [-89.4, 29]], [[-111.5, 45.9], [-108, 47.7], [-101, 47], [-100.3, 44.4], [-96.4, 42.5], [-94.6, 39.1], [-90.2, 38.8]],
  [[-79, 43.5], [-75.5, 45], [-71.2, 46.8], [-66, 49.5]], [[-106, 40], [-109.5, 38.5], [-111.5, 36.8], [-114, 36], [-114.6, 32.7]],
  [[-75, -5], [-70, -4], [-65, -3.5], [-60, -3.2], [-55, -2.2], [-50, -0.5]], [[-47, -19], [-52, -22.5], [-55, -25], [-58.5, -27.5], [-60.7, -32.9], [-58.5, -34]],
  [[-64, 3], [-67.5, 6], [-65, 7.8], [-62, 8.5], [-60.5, 8.5]], [[148, -36.5], [144, -35.8], [141, -34], [139.5, -35.5]],
];
function segDistDeg(lon, lat, a, b) {
  const k = Math.cos(lat * Math.PI / 180);
  const ax = a[0] * k, ay = a[1], bx = b[0] * k, by = b[1], px = lon * k;
  const vx = bx - ax, vy = by - ay, L2 = vx * vx + vy * vy || 1;
  const t = clamp(((px - ax) * vx + (lat - ay) * vy) / L2, 0, 1);
  return Math.hypot(px - (ax + vx * t), lat - (ay + vy * t));
}
// Fill elevation / moisture / temperature for a real map
function realFields(R, seed, elev, moist, temp) {
  const P = R.proj, N = MW * MH;
  const rngBox = RANGES.map(([pts, w, h]) => { let a = 1e9, b = -1e9, c = 1e9, d = -1e9; for (const [lo, la] of pts) { a = Math.min(a, lo); b = Math.max(b, lo); c = Math.min(c, la); d = Math.max(d, la); } return [a - w * 3, b + w * 3, c - w * 3, d + w * 3]; });
  const ell = (lon, lat, E) => { const dx = (lon - E[0]) / E[2], dy = (lat - E[1]) / E[3]; return Math.exp(-(dx * dx + dy * dy) * 1.6); };
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const k = y * MW + x;
    const [lon, lat] = P.inv(x + 0.5, y + 0.5);
    if (R.rc[k] < 0) { temp[k] = 0; continue; }
    let mtn = 0;
    for (let i = 0; i < RANGES.length; i++) {
      const bb = rngBox[i];
      if (lon < bb[0] || lon > bb[1] || lat < bb[2] || lat > bb[3]) continue;
      const [pts, w, h] = RANGES[i];
      let dmin = 1e9; for (let j = 1; j < pts.length; j++) dmin = Math.min(dmin, segDistDeg(lon, lat, pts[j - 1], pts[j]));
      mtn = Math.max(mtn, h * Math.exp(-(dmin / w) * (dmin / w)) * (0.75 + 0.5 * vnoise(x / 6, y / 6, seed + 11)));
    }
    elev[k] = Math.max(0.01, 0.04 + (fbm(x / 80, y / 80, seed, 4) - 0.45) * 0.16 + mtn * 0.75);
    let m = fbm(x / 110, y / 110, seed + 99, 4) * 0.55 + 0.22 + 0.25 * Math.exp(-(lat / 12) * (lat / 12));
    for (const D of DESERTS) m -= 0.75 * ell(lon, lat, D);
    for (const F of FORESTS) m += 0.35 * ell(lon, lat, F);
    moist[k] = clamp(m, 0, 1);
    temp[k] = 1.05 - Math.abs(lat) / 62 - mtn * 0.9;
  }
  // ocean depth grows with distance from land
  const dist = new Int16Array(N).fill(-1), q = new Int32Array(N);
  let qh = 0, qt = 0;
  for (let k = 0; k < N; k++) if (R.rc[k] >= 0) { dist[k] = 0; q[qt++] = k; }
  while (qh < qt) {
    const k = q[qh++], x = k % MW, d = dist[k];
    if (d > 30) continue;
    const nb = [x > 0 ? k - 1 : -1, x < MW - 1 ? k + 1 : -1, k - MW, k + MW];
    for (const kk of nb) if (kk >= 0 && kk < N && dist[kk] < 0) { dist[kk] = d + 1; q[qt++] = kk; }
  }
  for (let k = 0; k < N; k++) if (R.rc[k] < 0) elev[k] = -0.03 - Math.min(30, dist[k] < 0 ? 30 : dist[k]) * 0.014;
}
function realRivers(R) {
  const out = [];
  for (const r of RIVERS) {
    const pts = [];
    for (let i = 1; i < r.length; i++) for (let s = 0; s < 6; s++) { const t = s / 6; pts.push(R.proj.fwd(lerp(r[i - 1][0], r[i][0], t), lerp(r[i - 1][1], r[i][1], t))); }
    pts.push(R.proj.fwd(r[r.length - 1][0], r[r.length - 1][1]));
    if (pts.some(([x, y]) => x >= 0 && y >= 0 && x < MW && y < MH)) out.push(pts);
  }
  return out;
}
// ---------- historical states: period flags, demonyms, capitals ----------
// [pattern, color1, color2, color3, emblem, emblemColor, size, x, y]
const HIST_FLAGS = {
  'Byzantine Empire': ['solid', '#8b1a1a', '', '', 'cross', '#e6c45a', 0.55], 'Holy Roman Empire': ['solid', '#f2c230', '', '', 'eagle', '#161616', 0.6],
  'Kingdom of France': ['solid', '#1f3f9a', '', '', 'fleur', '#e6c45a', 0.55], 'Angevin Empire': ['solid', '#b3121f', '', '', 'lion', '#e6c45a', 0.6],
  'England and Ireland': ['cross', '#ffffff', '#c8102e', ''], 'Kingdom of England': ['cross', '#ffffff', '#c8102e', ''], Scotland: ['saltire', '#005eb8', '#ffffff', ''],
  'Ottoman Empire': ['solid', '#e30a17', '', '', 'crescent', '#ffffff', 0.5, 0.45], 'Mongol Empire': ['solid', '#2e5fa3', '', '', 'sun', '#e6c45a', 0.45],
  'Song Empire': ['solid', '#b3121f', '', '', 'circle', '#f2c230', 0.35], 'Ming Chinese Empire': ['solid', '#c8102e', '', '', 'sun', '#f2c230', 0.42],
  'Manchu Empire': ['solid', '#f2c230', '', '', 'circle', '#c8102e', 0.22, 0.2, 0.25], 'Russian Empire': ['htri', '#161616', '#f2c230', '#ffffff'],
  'Tsardom of Muscovy': ['solid', '#f2c230', '', '', 'eagle', '#161616', 0.6], 'Principality of Novgorod': ['solid', '#b3121f', '', '', 'shield', '#e6c45a', 0.45],
  USSR: ['solid', '#cc0000', '', '', 'hammer', '#f2c230', 0.3, 0.2, 0.25], Prussia: ['solid', '#ffffff', '', '', 'eagle', '#161616', 0.6],
  'Austrian Empire': ['hbi', '#161616', '#f2c230', ''], 'Austria-Hungary': ['hbi', '#161616', '#f2c230', '', 'shield', '#c8102e', 0.3],
  'Kingdom of Sardinia': ['vtri', '#009246', '#ffffff', '#ce2b37', 'shield', '#c8102e', 0.3], 'Kingdom of the Two Sicilies': ['solid', '#ffffff', '', '', 'shield', '#1f3f9a', 0.45],
  Naples: ['solid', '#ffffff', '', '', 'shield', '#1f3f9a', 0.45], 'Papal States': ['vbi', '#f2c230', '#ffffff', ''], Venice: ['solid', '#b3121f', '', '', 'lion', '#e6c45a', 0.6],
  'Poland-Lithuania': ['solid', '#c8102e', '', '', 'eagle', '#ffffff', 0.6], 'Denmark-Norway': ['nordic', '#c60c30', '#ffffff', '#ffffff'],
  'Sweden-Norway': ['nordic', '#006aa7', '#fecc00', '#fecc00'], Persia: ['htri', '#239f40', '#ffffff', '#da0000', 'lion', '#e6c45a', 0.3],
  'Safavid Empire': ['solid', '#239f40', '', '', 'sun', '#f2c230', 0.45], 'Inca Empire': ['solid', '#f2c230', '', '', 'sun', '#c8102e', 0.5],
  'Fatimid Caliphate': ['solid', '#ffffff', '', '', 'crescent', '#1b7a3a', 0.5], 'Almohad Caliphate': ['solid', '#c8102e', '', '', 'shield', '#ffffff', 0.4],
  Germany: ['htri', '#161616', '#ffffff', '#dd0000'], 'German Empire': ['htri', '#161616', '#ffffff', '#dd0000'], Yugoslavia: ['htri', '#0c4076', '#ffffff', '#c6363c'],
  Siam: ['solid', '#c8102e', '', '', 'circle', '#ffffff', 0.4], 'Rattanakosin Kingdom': ['solid', '#c8102e', '', '', 'circle', '#ffffff', 0.4],
  Ayutthaya: ['solid', '#c8102e', '', '', 'circle', '#ffffff', 0.4], 'Kingdom of Brazil': ['solid', '#009c3b', '', '', 'circle', '#f2c230', 0.5],
  'Chinese warlords': ['five', '#c8102e', '#f2c230', '#2e5fa3'], 'Union of South Africa': ['htri', '#e8752a', '#ffffff', '#1f3f9a'],
  'Viceroyalty of New Spain': ['saltire', '#ffffff', '#c8102e', ''], Spain: ['saltire', '#ffffff', '#c8102e', ''], Castilla: ['quarter', '#c8102e', '#ffffff', '', 'tower', '#e6c45a', 0.25],
  Portugal: ['solid', '#ffffff', '', '', 'shield', '#1f3f9a', 0.45], 'Kingdom of Portugal': ['solid', '#ffffff', '', '', 'shield', '#1f3f9a', 0.45],
  'British East India Company': ['stripes', '#c8102e', '#ffffff', '#012169'], Hungary: ['htri', '#ce2939', '#ffffff', '#477050'],
};
// these use their period flag only for border years before the given year (afterwards the real modern flag)
const HIST_FLAG_UNTIL = { Spain: 1938, Portugal: 1938, Hungary: 1938, Germany: 1994 };
const HIST_DEMONYM = {
  'Holy Roman Empire': 'Imperial', 'Byzantine Empire': 'Byzantine', 'Ottoman Empire': 'Ottoman', 'Russian Empire': 'Russian', 'Mongol Empire': 'Mongol', 'Austrian Empire': 'Austrian',
  'Austria-Hungary': 'Austro-Hungarian', USSR: 'Soviet', Prussia: 'Prussian', 'Song Empire': 'Song', 'Ming Chinese Empire': 'Ming', 'Manchu Empire': 'Qing', 'Empire of Japan': 'Japanese',
  Persia: 'Persian', 'Safavid Empire': 'Safavid', 'Inca Empire': 'Inca', 'Fatimid Caliphate': 'Fatimid', 'Almohad Caliphate': 'Almohad', 'Angevin Empire': 'Angevin', 'England and Ireland': 'English',
  Scotland: 'Scottish', 'Poland-Lithuania': 'Polish', 'Denmark-Norway': 'Danish', 'Sweden-Norway': 'Swedish', 'Tsardom of Muscovy': 'Muscovite', Yugoslavia: 'Yugoslav', Czechoslovakia: 'Czechoslovak',
  'Papal States': 'Papal', Venice: 'Venetian', 'Kingdom of France': 'French', 'British Raj': 'Indian', 'Kingdom of the Two Sicilies': 'Sicilian', 'Kingdom of Sardinia': 'Sardinian', Siam: 'Siamese',
  'Principality of Novgorod': 'Novgorodian', 'Chinese warlords': 'Chinese', 'Union of South Africa': 'South African', 'Kingdom of Brazil': 'Brazilian', 'Viceroyalty of New Spain': 'New Spanish',
};
Object.assign(REAL_CAPITALS, {
  'Holy Roman Empire': [11.08, 49.45], 'Byzantine Empire': [28.98, 41.01], 'Ottoman Empire': [28.98, 41.01], 'Russian Empire': [30.3, 59.94], USSR: [37.62, 55.75], 'Tsardom of Muscovy': [37.62, 55.75],
  'Austrian Empire': [16.37, 48.21], 'Austria-Hungary': [16.37, 48.21], Prussia: [13.4, 52.52], 'Kingdom of France': [2.35, 48.86], 'Angevin Empire': [-0.13, 51.5], 'England and Ireland': [-0.13, 51.5],
  'Mongol Empire': [102.8, 47.2], 'Song Empire': [120.15, 30.27], 'Ming Chinese Empire': [116.4, 39.9], 'Manchu Empire': [116.4, 39.9], 'Empire of Japan': [139.69, 35.69], 'Imperial Japan (Fujiwara)': [135.77, 35.01],
  'Japan (Warring States)': [135.77, 35.01], Persia: [51.39, 35.69], 'Safavid Empire': [46.29, 38.08], 'Inca Empire': [-71.97, -13.53], 'British Raj': [77.2, 28.6], 'Fatimid Caliphate': [31.24, 30.04],
  'Almohad Caliphate': [-7.99, 31.63], 'Poland-Lithuania': [19.94, 50.06], 'Denmark-Norway': [12.57, 55.68], 'Sweden-Norway': [18.07, 59.33], 'Kingdom of the Two Sicilies': [14.25, 40.85], Naples: [14.25, 40.85],
  'Kingdom of Sardinia': [7.69, 45.07], 'Papal States': [12.5, 41.9], Yugoslavia: [20.46, 44.79], Czechoslovakia: [14.42, 50.08], Siam: [100.5, 13.76], 'Rattanakosin Kingdom': [100.5, 13.76], Ayutthaya: [100.57, 14.35],
  'Principality of Novgorod': [31.27, 58.52], 'Kingdom of Brazil': [-43.2, -22.9], 'Chinese warlords': [118.8, 32.06], 'Union of South Africa': [28.19, -25.75], 'Viceroyalty of New Spain': [-99.13, 19.43],
});
Object.assign(CAPITAL_NAMES, {
  'Holy Roman Empire': 'Nuremberg', 'Byzantine Empire': 'Constantinople', 'Ottoman Empire': 'Constantinople', 'Russian Empire': 'St Petersburg', USSR: 'Moscow', 'Tsardom of Muscovy': 'Moscow', 'Austrian Empire': 'Vienna',
  'Austria-Hungary': 'Vienna', Prussia: 'Berlin', 'Kingdom of France': 'Paris', 'Angevin Empire': 'London', 'England and Ireland': 'London', 'Mongol Empire': 'Karakorum', 'Song Empire': 'Lin\'an', 'Ming Chinese Empire': 'Beijing',
  'Manchu Empire': 'Beijing', 'Empire of Japan': 'Tokyo', 'Imperial Japan (Fujiwara)': 'Heian-kyō', 'Japan (Warring States)': 'Kyoto', Persia: 'Tehran', 'Safavid Empire': 'Tabriz', 'Inca Empire': 'Cusco', 'British Raj': 'Delhi',
  'Fatimid Caliphate': 'Cairo', 'Almohad Caliphate': 'Marrakesh', 'Poland-Lithuania': 'Kraków', 'Denmark-Norway': 'Copenhagen', 'Sweden-Norway': 'Stockholm', 'Kingdom of the Two Sicilies': 'Naples', Naples: 'Naples',
  'Kingdom of Sardinia': 'Turin', 'Papal States': 'Rome', Yugoslavia: 'Belgrade', Czechoslovakia: 'Prague', Siam: 'Bangkok', 'Rattanakosin Kingdom': 'Bangkok', Ayutthaya: 'Ayutthaya', 'Principality of Novgorod': 'Novgorod',
  'Kingdom of Brazil': 'Rio de Janeiro', 'Chinese warlords': 'Nanjing', 'Union of South Africa': 'Pretoria', 'Viceroyalty of New Spain': 'Mexico City',
});
function specToFlag(F, col) {
  return { pat: F[0], c: [F[1] || rgbToHex(col), F[2] || F[1], F[3] || F[1]], emb: F[4] || 'none', ec: F[5] || '#ffffff', es: F[6] || 0.4, ex: F[7] == null ? 0.5 : F[7], ey: F[8] == null ? 0.5 : F[8], layer: null };
}
function realFlag(name, code, col, histYear) {
  const H = HIST_FLAGS[name];
  if (H && histYear && !(HIST_FLAG_UNTIL[name] && histYear >= HIST_FLAG_UNTIL[name])) return specToFlag(H, col);
  if (code && typeof FLAG_SVG !== 'undefined' && FLAG_SVG[code]) return { svg: code, pat: 'solid', c: [rgbToHex(col), '#ffffff', '#111111'], emb: 'none', ec: '#ffffff', es: 0.4, ex: 0.5, ey: 0.5, layer: null };
  if (H) return specToFlag(H, col);
  const F = FLAG_SPECS[name];
  return F ? specToFlag(F, col) : null;
}
// Country metadata for a real nation (modern or historical)
function realCountryMeta(name, code, rng, histYear) {
  const base = name.replace(/^(Kingdom|Empire|Principality|Duchy|Republic|Sultanate|Emirate) of /, '');
  const generic = name.match(/^(\S+)\s(Empire|Caliphate|Khanates?|Khaganate|Kingdom|Emirates?|Sultanate|Confederacy|Dynasty)$/);
  const adj = HIST_DEMONYM[name] || DEMONYM[name] || DEMONYM[base] || (generic ? generic[1] : /ia$|a$/.test(base) ? base + 'n' : /stan$/.test(base) ? base.slice(0, -4) + 'i' : base);
  const col = REAL_COLORS[name] || REAL_COLORS[base] || hsl2rgb((Math.abs(strHashW(name)) % 360), 0.32 + (Math.abs(strHashW(name + 'x')) % 30) / 100, 0.42 + (Math.abs(strHashW(name + 'y')) % 20) / 100);
  return { name, adj, culture: adj, color: col, flag: realFlag(name, code, col, histYear), personality: REAL_PERSONALITY[name] || REAL_PERSONALITY[base] || pick(rng, Object.keys(PERSONALITIES)), capital: REAL_CAPITALS[name] || REAL_CAPITALS[base] };
}
function strHashW(s) { let h = 0; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0; return h; }
