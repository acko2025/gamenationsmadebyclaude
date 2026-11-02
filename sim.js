// ============================================================
// WAR OF NATIONS — simulation core: state, economy, construction, research,
// production, military movement & combat, wars, diplomacy, events, save/load
// ============================================================
'use strict';

const G = window.G = {
  geo: null, provs: [], countries: [], divs: [], battles: [], wars: [],
  diplo: { rel: {}, treaties: [], truces: {} }, day: 0, startYear: 1100, era: 0, player: -1,
  speed: 1, paused: true, notes: [], popups: [], nextId: 1, prices: Object.assign({}, RES_PRICE),
  weather: [], settings: { quality: 'medium', autosave: true, pauseOnEvents: true, growthDefault: true, uiScale: 1 },
  version: 3,
};
const nid = () => G.nextId++;
const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const FOOD_SEASON = [0.5, 0.5, 0.8, 0.9, 1.0, 1.2, 1.25, 1.3, 1.45, 1.3, 0.9, 0.55];
function dateOf(day) {
  const y = G.startYear + Math.floor(day / 365);
  let d = day % 365, m = 0;
  while (d >= MONTH_DAYS[m]) { d -= MONTH_DAYS[m]; m++; }
  return { y, m, d: d + 1 };
}
const dateStr = day => { const t = dateOf(day); return `${t.d} ${MONTHS[t.m]} ${t.y}`; };
const isWinter = () => { const m = dateOf(G.day).m; return m === 11 || m <= 1; };
const C = id => G.countries[id];
const fmt = v => { const a = Math.abs(v); return a >= 1e9 ? (v / 1e9).toFixed(2) + 'B' : a >= 1e6 ? (v / 1e6).toFixed(2) + 'M' : a >= 1e4 ? (v / 1e3).toFixed(1) + 'K' : a >= 100 ? Math.round(v) + '' : (Math.round(v * 10) / 10) + ''; };

// Several nations can be human-played (multiplayer); everything else is AI
const isHuman = cid => cid >= 0 && !!G.countries[cid] && !G.countries[cid].ai;
// Notes name the human nations they concern (inv); 'world' notes and untagged ones are for everyone
function note(type, text, prov, involved) {
  let inv = null;
  if (involved && type !== 'world') { inv = [...new Set(involved.filter(isHuman))]; if (!inv.length) return; }
  const n = { id: nid(), day: G.day, type, text, prov: prov == null ? -1 : prov, inv };
  G.notes.unshift(n);
  if (G.notes.length > 120) G.notes.length = 120;
  if (window.UIHooks) UIHooks.note(n);
}
const noteFor = (cid, type, text, prov) => isHuman(cid) && note(type, text, prov, [cid]);
const noteAll = (list, type, text, prov) => note(type, text, prov, list);
function popup(title, text, buttons, important) {
  G.popups.push({ title, text, buttons: buttons || [{ label: 'Understood' }] });
  // in a shared game one player's event must not pause everyone
  if (important && G.settings.pauseOnEvents && !(typeof NET !== 'undefined' && NET.role)) G.paused = true;
  if (window.UIHooks) UIHooks.popup();
}
// A popup for one particular human nation: shown here if it is ours, otherwise sent to that player.
// A button with `ui` is a screen the remote player opens on their own side (its fn is not run here).
function popupFor(cid, title, text, buttons, important) {
  if (cid === G.player) return popup(title, text, buttons, important);
  if (!isHuman(cid) || typeof NET === 'undefined' || NET.role !== 'host') return;
  const bs = buttons || [{ label: 'Understood' }];
  const id = nid();
  (G.netPopups = G.netPopups || []).push({ id, to: cid, title, text, labels: bs.map(b => b.label), ui: bs.map(b => b.ui || null) });
  NET.popupFns.set(id, bs.map(b => b.fn));
}

// ------------------------------------------------------------
// Province statistics (cached; invalidated through p.dirty)
// ------------------------------------------------------------
const STAT_KEYS = ['housing', 'food', 'wood', 'stone', 'iron', 'coal', 'oil', 'rubber', 'aluminum', 'steel', 'elec', 'elecUse', 'coalUse', 'consumer', 'money', 'research', 'pp', 'stab', 'fort', 'recruit', 'cavalry', 'milFac', 'tankFac', 'civFac', 'infra', 'supply', 'port', 'air', 'shipyard', 'airdef', 'mine', 'steelMill', 'refinery', 'plantation', 'manpower'];
const SCALED_BY_WORKERS = new Set(['food', 'wood', 'stone', 'iron', 'coal', 'oil', 'rubber', 'aluminum', 'steel', 'elec', 'consumer', 'money', 'research', 'milFac', 'tankFac', 'civFac', 'mine', 'steelMill', 'refinery', 'plantation']);
function segLen(s) { return Math.hypot(s.x2 - s.x1, s.z2 - s.z1); }
function provStats(p) {
  if (p.cache && !p.dirty) return p.cache;
  const s = {};
  for (const k of STAT_KEYS) s[k] = 0;
  let jobs = 0, nb = 0;
  for (const b of p.buildings) {
    if (b.prog < 1) continue;
    const B = BUILDINGS[b.t], m = LEVEL_MUL[b.lvl] * (b.hp >= 25 ? b.hp / 100 : 0);
    jobs += B.workers * LEVEL_MUL[b.lvl]; nb++;
    for (const k in B.eff) s[k] = (s[k] || 0) + B.eff[k] * m;
  }
  let wallF = 0, palF = 0;
  for (const g of p.segs) {
    if (g.prog < 1) continue;
    const L = segLen(g) * g.hp / 100;
    if (g.t === 'road') s.infra += L / 120;
    else if (g.t === 'rail') { s.infra += L / 80; s.supply += L / 90; }
    else if (g.t === 'wall') wallF += L / 110;
    else if (g.t === 'palisade') palF += L / 200;
  }
  s.fort += Math.min(2, wallF) + Math.min(0.8, palF);
  const workforce = p.pop * 0.45;
  s.jobs = jobs; s.workforce = workforce;
  s.empl = jobs > 0 ? Math.min(1, workforce / jobs) : 1;
  s.employment = workforce > 0 ? Math.min(1, jobs / workforce) : 0;
  for (const k of SCALED_BY_WORKERS) s[k] *= s.empl;
  // commerce needs customers: building income is capped by the local population
  s.moneyCap = 0.8 + p.pop / (16000 * ERAS[G.era].popMul);
  s.money = Math.min(s.money, s.moneyCap);
  const d = p.dep;
  s.iron += d.iron * 6 * s.mine; s.coal += d.coal * 6 * s.mine; s.stone += d.stone * 4 * s.mine; s.aluminum += d.aluminum * 3 * s.mine;
  s.oil += (d.oil > 0 ? d.oil * 10 : 1.5) * s.refinery;
  s.rubber += (d.rubber * 5 + 1) * s.plantation;
  if (p.terrain === 'forest') s.wood *= 1.6;
  s.food = s.food * p.fert + p.fert * 10 + (p.coastal ? 2 : 0);
  s.wood += p.terrain === 'forest' ? 3 : 0.8;
  s.stone += p.terrain === 'mountain' || p.terrain === 'hills' ? 1 : 0.2;
  s.housing += p.baseHousing;
  s.infra += 0.5;
  s.supply += 1 + s.infra * 0.6;
  s.fort = Math.min(5, s.fort);
  s.nb = nb;
  // nuclear fallout: farmland poisoned, people leaving, business shut
  if (p.fallout > G.day) { s.food *= 0.3; s.money *= 0.5; s.housing *= 0.6; s.research *= 0.5; }
  s.dev = nb + Math.log10(Math.max(1000, p.pop)) * 2;
  p.cache = s; p.dirty = false;
  return s;
}
function markDirty(p) { p.dirty = true; G.mapDirty = true; G._bord = null; }
// Visual flash on the map when a province changes hands
function flashProvince(p, to) {
  if (to < 0 || typeof performance === 'undefined') return;
  const f = G.flashes || (G.flashes = []);
  f.push({ prov: p.id, to, t: performance.now() });
  if (f.length > 60) f.shift();
  G.mapUrgent = true;
}
function provValue(p) { return 5 + p.pop / (2000 * ERAS[G.era].popMul) + provStats(p).nb * 2 + (C(p.owner) && C(p.owner).capital === p.id ? 30 : 0); }

// ------------------------------------------------------------
// Countries
// ------------------------------------------------------------
function randomFlag(rng, col) {
  const pats = ['solid', 'hbi', 'vbi', 'htri', 'vtri', 'nordic', 'saltire', 'quarter', 'diag', 'chevron', 'border', 'canton'];
  const embs = ['none', 'star', 'circle', 'crescent', 'cross', 'crown', 'sun', 'shield', 'tower', 'eagle', 'sword', 'lion'];
  const pal = ['#b22234', '#ffffff', '#1f3c88', '#f2c230', '#1b7a3a', '#111111', '#7a1f5c', '#e07b20', '#5aa0d8', '#8c1c13', '#e8e1cf'];
  return { pat: pick(rng, pats), c: [rgbToHex(col), pick(rng, pal), pick(rng, pal)], emb: rng() < 0.6 ? pick(rng, embs) : 'none', ec: pick(rng, ['#f2c230', '#ffffff', '#111111', '#b22234']), ex: 0.5, ey: 0.5, es: 0.32, layer: null };
}
function newCountry(o) {
  const c = Object.assign({
    id: G.countries.length, name: 'Country', adj: 'Countrian', color: [150, 150, 150], flag: null, gov: 'absolute', ideology: 'Traditionalist',
    personality: 'defensive', culture: 'Countrian', religion: RELIGIONS[0], leader: 'Unknown', capital: -1, ai: true, alive: true,
    treasury: 300, pp: 50, manpower: 0, stability: 60, warEx: 0, inflation: 0, techs: [], researching: null, rp: 0, queue: [],
    stock: {}, equip: { arms: 0, artillery: 0, vehicles: 0, support: 0, aircraft: 0, ships: 0 }, designs: [], templates: [], lines: [],
    laws: { conscription: 1, economy: 'civilian', trade: 'free', tax: 0.15 }, doctrine: 'balanced', anthem: { style: 'march', seed: 1 },
    orders: {}, autoImport: true, wargoals: [], justifying: null, claims: [], overlord: -1, lastWar: -9999, agg: {}, era: 0,
    flow: {}, income: 0, expense: 0, rpDay: 0, created: G.day,
  }, o);
  for (const r of RESOURCES) if (c.stock[r] == null) c.stock[r] = 0;
  if (!c.flag) c.flag = randomFlag(mulberry32(c.id * 31 + 7), c.color);
  G.countries.push(c);
  return c;
}
function hasTech(c, id) { return !id || c.techs.includes(id); }
function countryEra(c) { let e = 0; for (const E of ERAS) if (c.techs.includes(E.key)) e = Math.max(e, E.id); return e; }
function techBonus(c) {
  const b = { food: 0, money: 0, research: 0, pp: 0, growth: 0, build: 0, production: 0, supply: 0, stab: 0, trade: 0, org: 0, air: 0 };
  for (const t of c.techs) { const T = TECH_BY_ID[t]; if (T) for (const k in T.bonus) b[k] += T.bonus[k]; }
  return b;
}
function canResearch(c, T) { return !c.techs.includes(T.id) && T.req.every(r => c.techs.includes(r)); }
function techCost(c, T) { return T.cost * (1 + Math.max(0, T.era - c.era) * 0.75); }
function grantStartTechs(c, era) {
  // everything from earlier eras, plus this era's key tech and its first-tier military follow-ups
  const firstTier = T => T.req.every(r => TECH_BY_ID[r].era < era || r === ERAS[era].key);
  for (const T of TECHS) if (T.era < era || (T.era === era && (T.id === ERAS[era].key || (T.b === 'military' && era > 0 && firstTier(T))))) if (!c.techs.includes(T.id)) c.techs.push(T.id);
  if (era === 0) for (const id of ['t_feudal', 't_mason']) if (!c.techs.includes(id)) c.techs.push(id);
  // ensure prerequisites are present
  let changed = true;
  while (changed) { changed = false; for (const id of [...c.techs]) for (const r of TECH_BY_ID[id].req) if (!c.techs.includes(r)) { c.techs.push(r); changed = true; } }
  c.era = countryEra(c);
}
function setupTemplates(c) {
  const e = c.era;
  for (const T of DEFAULT_TEMPLATES[e]) {
    if (c.templates.some(t => t.name === T.name)) continue;
    const bats = T.bats.filter(b => hasTech(c, BATTALIONS[b].tech));
    if (bats.length >= 3) c.templates.push({ id: nid(), name: T.name, bats });
  }
  if (!c.templates.length) c.templates.push({ id: nid(), name: 'Levy', bats: ['spearmen', 'spearmen', 'spearmen', 'archers'] });
}
function bestChassis(c) { let best = null; for (const k in CHASSIS) if (hasTech(c, CHASSIS[k].tech)) best = k; return best; }
function bestGun(c) { let best = null; for (const k in GUNS) if (hasTech(c, GUNS[k].tech) && k !== 'mg') best = k; return best; }
function autoDesign(c) {
  const ch = bestChassis(c), gun = bestGun(c);
  if (!ch || !gun) return null;
  if (c.designs.some(d => d.chassis === ch && d.gun === gun)) return null;
  const d = { id: nid(), name: `${c.adj.slice(0, 3).toUpperCase()}-${c.designs.length + 1} ${CHASSIS[ch].name}`, chassis: ch, gun, armorLvl: 3, engine: 2, radio: hasTech(c, 't_radio'), sloped: hasTech(c, 't_tanks2') };
  c.designs.push(d);
  return d;
}
function tankStats(d) {
  const ch = CHASSIS[d.chassis], g = GUNS[d.gun];
  const armor = ch.armor * (0.6 + 0.2 * d.armorLvl) * (d.sloped ? 1.15 : 1);
  const speed = Math.max(2, ch.speed - (d.armorLvl - 3) * 0.6 + (d.engine - 2) * 1.5);
  const rel = clamp(ch.rel - (d.engine - 2) * 0.05 - (d.armorLvl - 3) * 0.03 + (d.radio ? 0.02 : 0), 0.3, 0.98);
  const fuel = ch.fuel + (d.engine - 2) * 0.5 + (d.armorLvl - 3) * 0.15;
  const cost = ch.cost + g.cost + d.armorLvl * 1 + d.engine * 1 + (d.radio ? 1 : 0) + (d.sloped ? 1 : 0);
  const sa = g.sa * 1.6, ha = g.ha * 1.2, prc = g.prc;
  const brk = 10 + armor / 4 + (d.radio ? 4 : 0), df = 4 + armor / 14;
  const terrain = { forest: d.chassis === 'light' ? 0.9 : d.chassis === 'heavy' ? 0.65 : 0.8, mountain: d.chassis === 'heavy' ? 0.5 : 0.65, desert: d.chassis === 'hover' ? 1.1 : 0.95 };
  return { armor: Math.round(armor), speed: Math.round(speed * 10) / 10, rel, fuel, cost, sa, ha, prc, brk, df, hp: ch.hp, terrain, maint: Math.round(cost * (1 - rel) * 10) / 10 };
}
function divStats(c, bats, designId) {
  const s = { sa: 0, ha: 0, df: 0, brk: 0, hp: 0, org: 0, hard: 0, arm: 0, prc: 0, spd: 99, mp: 0, sup: 0, siege: 0, eq: {}, airdef: 0, recon: 0, river: false, tank: null };
  let design = null;
  if (bats.includes('armor')) design = (c.designs.find(d => d.id === designId) || c.designs[c.designs.length - 1]);
  const ts = design ? tankStats(design) : null;
  let maxArm = 0;
  for (const k of bats) {
    let B = BATTALIONS[k];
    if (k === 'armor') {
      const t = ts || { sa: 6, ha: 8, df: 6, brk: 12, armor: 12, prc: 30, speed: 7, hp: 3 };
      B = Object.assign({}, B, { sa: t.sa, ha: t.ha, df: t.df, brk: t.brk, arm: t.armor, prc: t.prc, spd: t.speed, hp: t.hp });
      s.eq['tank'] = (s.eq['tank'] || 0) + 40;
    }
    s.sa += B.sa; s.ha += B.ha; s.df += B.df; s.brk += B.brk; s.hp += B.hp; s.org += B.org; s.hard += B.hard; s.arm += B.arm; maxArm = Math.max(maxArm, B.arm);
    s.prc = Math.max(s.prc, B.prc); s.spd = Math.min(s.spd, B.spd); s.mp += B.mp; s.sup += B.sup; s.siege += B.siege || 0;
    s.airdef += B.airdef || 0; s.recon += B.recon || 0; if (B.river) s.river = true;
    for (const e in B.eq) if (e !== 'tank') s.eq[e] = (s.eq[e] || 0) + B.eq[e];
  }
  const n = Math.max(1, bats.length);
  s.org /= n; s.hard /= n; s.arm = s.arm / n * 0.6 + maxArm * 0.4;
  s.sup = Math.max(0.05, s.sup);
  if (design) s.tank = design.id;
  const doc = c.doctrine;
  if (doc === 'mobile') { s.spd *= 1.1; s.brk *= 1.1; }
  if (doc === 'firepower') { s.sa *= 1.12; s.ha *= 1.05; }
  if (doc === 'defensive') { s.df *= 1.15; }
  if (doc === 'mass') { s.org *= 1.12; s.mp *= 0.9; }
  s.org *= 1 + techBonus(c).org;
  if (s.spd === 99) s.spd = 3;
  return s;
}

// ------------------------------------------------------------
// Diplomacy primitives
// ------------------------------------------------------------
const pairKey = (a, b) => a < b ? a + ',' + b : b + ',' + a;
function rel(a, b) { return a === b ? 100 : (G.diplo.rel[pairKey(a, b)] || 0); }
function relAdd(a, b, v) { if (a === b || a < 0 || b < 0) return; const k = pairKey(a, b); G.diplo.rel[k] = clamp((G.diplo.rel[k] || 0) + v, -100, 100); }
// Treaty lookups go through an index rebuilt whenever the treaty list is replaced or grows/shrinks
function treatyIndex() {
  const T = G.diplo.treaties;
  if (G._tIdxArr !== T || G._tIdxLen !== T.length) {
    G._tIdx = new Set(T.map(t => t.type + '|' + t.a + '|' + t.b));
    G._tIdxArr = T; G._tIdxLen = T.length;
  }
  return G._tIdx;
}
function hasTreaty(type, a, b) {
  const I = treatyIndex();
  return I.has(type + '|' + a + '|' + b) || (type !== 'guarantee' && type !== 'access' && I.has(type + '|' + b + '|' + a));
}
function addTreaty(type, a, b) { if (!hasTreaty(type, a, b)) G.diplo.treaties.push({ type, a, b, since: G.day }); }
function removeTreaty(type, a, b) { G.diplo.treaties = G.diplo.treaties.filter(t => !(t.type === type && ((t.a === a && t.b === b) || (t.a === b && t.b === a)))); }
function allied(a, b) { if (a === b) return true; if (a < 0 || b < 0) return false; const ca = C(a), cb = C(b); if (ca.overlord === b || cb.overlord === a) return true; if (hasTreaty('alliance', a, b)) return true; return sameSideInAnyWar(a, b); }
function sameSideInAnyWar(a, b) { for (const w of G.wars) if ((w.att.includes(a) && w.att.includes(b)) || (w.def.includes(a) && w.def.includes(b))) return true; return false; }
function atWar(a, b) { if (a < 0 || b < 0 || a === b) return false; for (const w of G.wars) if ((w.att.includes(a) && w.def.includes(b)) || (w.def.includes(a) && w.att.includes(b))) return true; return false; }
function inWar(a) { return G.wars.some(w => w.att.includes(a) || w.def.includes(a)); }
function warBetween(a, b) { return G.wars.find(w => (w.att.includes(a) && w.def.includes(b)) || (w.def.includes(a) && w.att.includes(b))); }
function hasAccess(a, b) { return hasTreaty('access', b, a); }
function countryProvs(id) { return G.provs.filter(p => p.owner === id); }
// Military strength is computed once per day for every nation (the AI compares many pairs)
function strengthTable() {
  if (G._strDay === G.day && G._strT) return G._strT;
  const t = new Map();
  for (const c of G.countries) t.set(c.id, (c.agg && c.agg.milFac || 0) * 8 + 1);
  for (const d of G.divs) if (d.state !== 'training') t.set(d.owner, (t.get(d.owner) || 1) + (d.st.sa + d.st.df * 0.5 + d.st.ha) * d.str);
  G._strT = t; G._strDay = G.day; G._sideT = new Map();
  return t;
}
function strength(id) { return strengthTable().get(id) || 1; }
function sideStrength(id) {
  strengthTable();
  if (G._sideT.has(id)) return G._sideT.get(id);
  let s = strength(id);
  for (const t of G.diplo.treaties) if (t.type === 'alliance' && (t.a === id || t.b === id)) s += strength(t.a === id ? t.b : t.a) * 0.7;
  for (const c of G.countries) if (c.alive && c.overlord === id) s += strength(c.id) * 0.7;
  G._sideT.set(id, s);
  return s;
}

// ------------------------------------------------------------
// World setup
// ------------------------------------------------------------
function buildWorld(params) {
  const { seed, mapType, nCountries, era } = params;
  // real maps can use the historical borders of a chosen year ('auto' = the year matching the starting era)
  let histYear = null;
  if (isRealMap(mapType) && params.borders && params.borders !== 'modern') histYear = params.borders === 'auto' ? ERA_HIST_YEAR[era] : +params.borders;
  G.histYear = histYear;
  G.seed = seed; G.mapType = mapType; G.era = era; G.startYear = histYear && Math.abs(histYear - ERAS[era].year) < 160 ? histYear : ERAS[era].year; G.day = 0;
  G.countries = []; G.divs = []; G.battles = []; G.wars = []; G.notes = []; G.popups = []; G.orgs = []; G._coastals = null; G.diplo = { rel: {}, treaties: [], truces: {} };
  G.nextId = 1; G.prices = Object.assign({}, RES_PRICE); G.player = -1;
  G.geo = generateGeometry(seed, mapType, histYear);
  const rng = mulberry32(seed + 1234);
  G.provs = G.geo.provs.map(g => {
    const T = TERRAINS[g.terrain];
    const p = Object.assign(g, {
      name: genName(rng, 'prov'), owner: -1, controller: -1, culture: 'Unsettled', religion: RELIGIONS[Math.min(3, Math.floor(g.cx / MW * 4))],
      fert: T.fert * (0.7 + g.m * 0.6), seed: Math.floor(rng() * 1e6), buildings: [], segs: [], growth: true, unrest: 0, core: [],
      dep: {
        iron: (g.terrain === 'hills' || g.terrain === 'mountain') ? Math.floor(rng() * 3) + 1 : rng() < 0.15 ? 1 : 0,
        coal: rng() < (g.terrain === 'hills' ? 0.5 : 0.18) ? Math.floor(rng() * 3) + 1 : 0,
        stone: (g.terrain === 'mountain' || g.terrain === 'hills') ? 2 : rng() < 0.3 ? 1 : 0,
        oil: rng() < (g.terrain === 'desert' ? 0.5 : 0.08) ? Math.floor(rng() * 3) + 1 : 0,
        rubber: (g.t > 0.55 && g.m > 0.5) ? Math.floor(rng() * 2) + 1 : 0,
        aluminum: rng() < 0.1 ? 1 : 0,
      },
    });
    const base = (8000 + rng() * 22000) * (0.3 + p.fert) * ERAS[era].popMul * (g.area / 420);
    p.pop = Math.round(base);
    p.baseHousing = Math.round(base * 1.15);
    return p;
  });
  // States: clusters of neighbouring provinces
  let sid = 0; const stateOf = new Int32Array(G.provs.length).fill(-1); G.states = [];
  for (const p of G.provs) {
    if (stateOf[p.id] >= 0) continue;
    const st = { id: sid++, name: genName(rng, 'state') + (rng() < 0.5 ? ' Province' : ' March'), provs: [] };
    const q = [p.id]; stateOf[p.id] = st.id;
    while (q.length && st.provs.length < 4) { const x = q.shift(); st.provs.push(x); for (const n of G.provs[x].neighbors) if (stateOf[n] < 0 && st.provs.length + q.length < 4) { stateOf[n] = st.id; q.push(n); } }
    for (const x of q) stateOf[x] = -1;
    G.states.push(st);
  }
  G.provs.forEach(p => { p.state = stateOf[p.id]; if (p.state < 0) { const st = { id: sid++, name: p.name + ' Land', provs: [p.id] }; G.states.push(st); p.state = st.id; } });
  if (G.geo.real) realCountries(rng, era); else {
  // Capitals by farthest-point sampling
  const land = G.provs.filter(p => p.area > 150);
  const caps = [land[Math.floor(rng() * land.length)]];
  while (caps.length < nCountries) {
    let best = null, bd = -1;
    for (const p of land) { let d = 1e9; for (const c of caps) d = Math.min(d, Math.hypot(p.cx - c.cx, p.cy - c.cy)); d *= 0.6 + rng() * 0.8; if (d > bd) { bd = d; best = p; } }
    caps.push(best);
  }
  const usedHues = [];
  caps.forEach((cp, i) => {
    let hue = (i * 137.508 + rng() * 20) % 360;
    const col = hsl2rgb(hue, 0.35 + rng() * 0.3, 0.42 + rng() * 0.18);
    usedHues.push(hue);
    const name = genName(rng, 'country');
    const persKeys = Object.keys(PERSONALITIES);
    const gk = era <= 1 ? pick(rng, ['absolute', 'absolute', 'constitutional', 'empire', 'tribal', 'citystate', 'theocracy', 'republic']) : pick(rng, ['democracy', 'republic', 'constitutional', 'socialist', 'military', 'federation', 'empire', 'absolute']);
    const c = newCountry({ name, adj: adjectiveOf(name), color: col, gov: gk, ideology: pick(rng, IDEOLOGIES), personality: pick(rng, persKeys), culture: adjectiveOf(name), religion: RELIGIONS[Math.min(3, Math.floor(cp.cx / MW * 4))], leader: pick(rng, LEADER_FIRST) + ' ' + genName(rng), capital: cp.id });
    c.expand = 0.7 + rng() * 0.8;
  });
  // Grow countries over the province graph
  const cost = new Float64Array(G.provs.length).fill(Infinity);
  const heap = [];
  const push = (pid, cid, cst) => { heap.push([cst, pid, cid]); let i = heap.length - 1; while (i > 0) { const pa = (i - 1) >> 1; if (heap[pa][0] <= heap[i][0]) break; [heap[pa], heap[i]] = [heap[i], heap[pa]]; i = pa; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  G.countries.forEach(c => { cost[c.capital] = 0; push(c.capital, c.id, 0); });
  const maxCost = mapType === 'archipelago' ? 14 : 22;
  while (heap.length) {
    const [cst, pid, cid] = pop();
    const p = G.provs[pid];
    if (p.owner >= 0 || cst > cost[pid] + 1e-9) continue;
    if (cst > maxCost * C(cid).expand) continue;
    p.owner = p.controller = cid; p.culture = C(cid).culture; p.core = [cid];
    const step = (n, k) => { const q = G.provs[n]; if (q.owner >= 0) return; const nc = cst + k * C(cid).expand * (0.6 + rng() * 0.9); if (nc < cost[n]) { cost[n] = nc; push(n, cid, nc); } };
    for (const n of p.neighbors) step(n, TERRAINS[G.provs[n].terrain].move + (G.provs[n].river ? 0.3 : 0));
    for (const n of p.sea) step(n, 5);
  }
  }
  // Starting economy, settlements and armies
  for (const c of G.countries) {
    grantStartTechs(c, era);
    initCountryEconomy(c, rng);
  }
  for (const p of G.provs) seedSettlement(p, rng, era);
  for (const c of G.countries) { initArmy(c, rng); }
  // Relations
  for (const a of G.countries) for (const b of G.countries) if (a.id < b.id) {
    let r = Math.round((rng() - 0.5) * 50);
    if (a.ideology === b.ideology) r += 15;
    if (a.religion !== b.religion) r -= 10;
    if (bordering(a.id, b.id)) r -= 12;
    G.diplo.rel[pairKey(a.id, b.id)] = r;
  }
  // a few starting alliances, at most two per nation, mostly between neighbours
  const nAll = new Map();
  for (const a of G.countries) for (const b of G.countries) {
    if (a.id >= b.id || rel(a.id, b.id) <= 30 || (nAll.get(a.id) || 0) >= 2 || (nAll.get(b.id) || 0) >= 2) continue;
    if (rng() < (bordering(a.id, b.id) ? 0.35 : 0.05)) { addTreaty('alliance', a.id, b.id); nAll.set(a.id, (nAll.get(a.id) || 0) + 1); nAll.set(b.id, (nAll.get(b.id) || 0) + 1); }
  }
  initWeather();
  updateCountryAggregates();
  seedOrgs(rng);
  G.mapDirty = true;
}
// Border lookups are cached; any ownership change clears the cache through markDirty
function bordering(a, b) {
  if (!G._bord) {
    G._bord = new Map();
    for (const p of G.provs) {
      if (p.owner < 0) continue;
      for (const n of p.neighbors) {
        const o = G.provs[n].owner;
        if (o >= 0 && o !== p.owner) { if (!G._bord.has(p.owner)) G._bord.set(p.owner, new Set()); G._bord.get(p.owner).add(o); }
      }
    }
  }
  const s = G._bord.get(a);
  return !!(s && s.has(b));
}
// Nations of a real map: every province already knows which real country it lies in
function realCountries(rng, era) {
  const R = G.geo.real, by = new Map();
  for (const p of G.provs) { if (p.rc < 0 || p.rc === UNCLAIMED_RC) continue; if (!by.has(p.rc)) by.set(p.rc, []); by.get(p.rc).push(p); }
  const govs = era <= 1 ? ['absolute', 'absolute', 'constitutional', 'empire', 'theocracy'] : era === 2 ? ['constitutional', 'empire', 'republic', 'absolute'] : ['democracy', 'republic', 'constitutional', 'socialist', 'military', 'federation'];
  for (const [rc, ps] of [...by].sort((a, b) => b[1].length - a[1].length)) {
    const meta = realCountryMeta(R.names[rc], R.codes[rc], rng, R.hist);
    const nearest = (x, y) => ps.reduce((best, p) => { const d = Math.hypot(p.cx - x, p.cy - y) - Math.sqrt(p.area) * 0.3; return d < best[0] ? [d, p] : best; }, [1e9, null])[1];
    let cap = null;
    if (meta.capital) { const [x, y] = R.proj.fwd(meta.capital[0], meta.capital[1]); cap = nearest(x, y); }
    if (!cap) { let sx = 0, sy = 0, sa = 0; for (const p of ps) { sx += p.cx * p.area; sy += p.cy * p.area; sa += p.area; } cap = nearest(sx / sa, sy / sa); }
    const c = newCountry({ name: meta.name, adj: meta.adj, color: meta.color, flag: meta.flag, gov: pick(rng, govs), ideology: pick(rng, IDEOLOGIES), personality: meta.personality, culture: meta.culture, religion: cap.religion, leader: pick(rng, LEADER_FIRST) + ' ' + genName(rng), capital: cap.id });
    for (const p of ps) { p.owner = p.controller = c.id; p.culture = c.culture; p.core = [c.id]; }
    if (CAPITAL_NAMES[meta.name]) cap.name = CAPITAL_NAMES[meta.name];
  }
}
function initCountryEconomy(c, rng) {
  const era = c.era, m = [1, 2, 4, 7, 10, 14][era];
  c.treasury = 1000 * m; c.pp = 60;
  Object.assign(c.stock, { food: 200, wood: 150, stone: 150, iron: 60 * m, coal: era >= 2 ? 80 * m : 20, steel: era >= 2 ? 120 * m : 20, oil: era >= 3 ? 150 * m : 0, rubber: era >= 3 ? 60 : 0, aluminum: era >= 3 ? 40 * m : 0 });
  setupTemplates(c);
  if (era >= 3) autoDesign(c);
  c.equip.arms = 900 * (1 + era * 0.5); c.equip.artillery = 60 * (1 + era * 0.3); c.equip.vehicles = era >= 3 ? 120 : 20; c.equip.support = 20; c.equip.ships = 2; c.equip.aircraft = era >= 3 ? 30 : 0;
  if (c.designs.length) c.equip['tank:' + c.designs[0].id] = 80;
  c.laws.tax = 0.15;
}
function seedSettlement(p, rng, era) {
  const c = C(p.owner);
  if (!c) { p.pop = Math.round(p.pop * 0.35); p.baseHousing = Math.round(p.pop * 1.3); return; }
  p.town = findTownCenter(p);
  const isCap = c.capital === p.id;
  const add = (t, n) => { for (let i = 0; i < n; i++) { if (!hasTech(c, BUILDINGS[t].tech)) return; const pos = autoPlace(p, t, rng); if (!pos) return; p.buildings.push({ id: nid(), t, x: pos.x, z: pos.z, r: pos.r, lvl: 1, prog: 1, hp: 100 }); } };
  const tc = p.town;
  // a couple of roads leading out of the settlement
  const nr = isCap ? 4 : 2;
  for (let i = 0; i < nr; i++) {
    const a = rng() * Math.PI * 2, L = 60 + rng() * 30;
    p.segs.push({ id: nid(), t: era >= 2 && i === 0 && isCap ? 'rail' : 'road', x1: tc.x, z1: tc.z, x2: clamp(tc.x + Math.cos(a) * L, -95, 95), z2: clamp(tc.z + Math.sin(a) * L, -95, 95), prog: 1, hp: 100 });
  }
  if (era < 3) add('cottage', 2 + Math.floor(rng() * 3) + (isCap ? 3 : 0)); else add('apartments', 1 + (isCap ? 2 : 0));
  add('farm', 1 + Math.floor(rng() * 2));
  if (p.terrain === 'forest') add('lumbercamp', 1);
  if (p.dep.iron || p.dep.coal) add('mine', 1);
  if (rng() < 0.4) add('windmill', 1);
  if (p.coastal && (isCap || rng() < 0.3)) add('harbor', 1);
  if (isCap) {
    add('townhall', 1); add('barracks', 1); add('market', 1); add('blacksmith', 1);
    if (era >= 1) add('university', 1);
    if (era <= 1) { add('castle', 1); add('stables', 1); }
    if (era >= 2) { add('factory', 2); add('armsfactory', 2); add('steelmill', 1); add('railstation', 1); }
    if (era >= 3) { add('powerplant', 1); add('militarybase', 1); add('refinery', 1); add('tankfactory', 1); }
    if (era >= 4) { add('researchcenter', 1); add('skyscraper', 1); add('airbase', 1); }
    if (era <= 1) {
      const R = 28;
      for (let i = 0; i < 6; i++) { const a1 = i / 6 * Math.PI * 2, a2 = (i + 1) / 6 * Math.PI * 2; if (i === 2) continue; p.segs.push({ id: nid(), t: hasTech(c, 't_castle') ? 'wall' : 'palisade', x1: tc.x + Math.cos(a1) * R, z1: tc.z + Math.sin(a1) * R, x2: tc.x + Math.cos(a2) * R, z2: tc.z + Math.sin(a2) * R, prog: 1, hp: 100 }); }
    }
  } else {
    if (rng() < 0.3) add('market', 1);
    if (era <= 1 && rng() < 0.25) add('watchtower', 1);
    if (era >= 2 && rng() < 0.25) add('factory', 1);
    if (era >= 2 && rng() < 0.2) add('armsfactory', 1);
    if (era <= 1 && rng() < 0.15) add('blacksmith', 1);
  }
  markDirty(p);
}
function initArmy(c, rng) {
  const n = 2 + Math.floor(countryProvs(c.id).length / 6) + (c.personality === 'militarist' ? 2 : 0);
  const provs = countryProvs(c.id);
  if (!provs.length) return;
  c.manpower = Math.round(provs.reduce((s, p) => s + p.pop, 0) * 0.02);
  for (let i = 0; i < n; i++) {
    const tpl = c.templates[i % Math.min(2, c.templates.length)];
    const p = i === 0 ? G.provs[c.capital] : provs[Math.floor(rng() * provs.length)];
    spawnDivision(c, tpl, p.id, 1);
  }
}

// ------------------------------------------------------------
// Construction
// ------------------------------------------------------------
const COST_MUL = 4;
function scaledCost(c, cost, mul) { const o = {}; const inf = 1 + c.inflation; for (const k in cost) o[k] = cost[k] * COST_MUL * (mul || 1) * (k === 'money' ? inf : 1); return o; }
function costMoneyEquivalent(c, cost) {
  let m = cost.money || 0;
  for (const k in cost) if (k !== 'money') { const short = Math.max(0, cost[k] - (c.stock[k] || 0)); m += short * G.prices[k] * 1.3; }
  return m;
}
function canAfford(c, cost) {
  for (const k in cost) if (k !== 'money' && cost[k] > (c.stock[k] || 0) && (!c.autoImport || c.laws.trade === 'closed')) return false;
  return c.treasury >= costMoneyEquivalent(c, cost);
}
function pay(c, cost) {
  c.treasury -= costMoneyEquivalent(c, cost);
  for (const k in cost) if (k !== 'money') c.stock[k] = Math.max(0, (c.stock[k] || 0) - cost[k]);
}
function costText(cost) { return Object.entries(cost).map(([k, v]) => `${Math.ceil(v)} ${k === 'money' ? '¤' : RES_NAMES[k].toLowerCase()}`).join(', '); }
function placeBuilding(c, p, t, x, z, r, free) {
  const B = BUILDINGS[t];
  if (!hasTech(c, B.tech)) return 'Requires ' + TECH_BY_ID[B.tech].name;
  if (p.owner !== c.id || p.controller !== c.id) return 'You do not control this province';
  const err = canPlaceAt(p, t, x, z);
  if (err) return err;
  if (B.unique && G.provs.some(q => q.owner === c.id && q.buildings.some(b => b.t === t))) return 'Only one ' + B.name + ' per nation';
  const cost = scaledCost(c, B.cost);
  if (!free) { if (!canAfford(c, cost)) return 'Not enough funds or materials (' + costText(cost) + ')'; pay(c, cost); }
  const b = { id: nid(), t, x, z, r, lvl: 1, prog: 0, hp: 100, owner: c.id };
  p.buildings.push(b);
  markDirty(p);
  return b;
}
function placeSegment(c, p, t, x1, z1, x2, z2) {
  const S = SEGMENTS[t];
  if (!hasTech(c, S.tech)) return 'Requires ' + TECH_BY_ID[S.tech].name;
  if (p.owner !== c.id || p.controller !== c.id) return 'You do not control this province';
  const L = Math.hypot(x2 - x1, z2 - z1);
  if (L < 3) return 'Too short';
  const cost = scaledCost(c, S.cost, L / 10);
  if (!canAfford(c, cost)) return 'Not enough funds or materials (' + costText(cost) + ')';
  pay(c, cost);
  const g = { id: nid(), t, x1, z1, x2, z2, prog: 0, hp: 100 };
  p.segs.push(g); markDirty(p);
  return g;
}
function upgradeCost(c, b) { return scaledCost(c, BUILDINGS[b.t].cost, 0.8 * b.lvl); }
function repairCost(c, b) { return scaledCost(c, BUILDINGS[b.t].cost, 0.6 * (1 - b.hp / 100)); }
function startUpgrade(c, p, b) {
  if (b.lvl >= 3) return 'Already at maximum level';
  if (b.prog < 1 || b.upg != null || b.rep != null) return 'Busy';
  const cost = upgradeCost(c, b);
  if (!canAfford(c, cost)) return 'Not enough funds (' + costText(cost) + ')';
  pay(c, cost); b.upg = 0; markDirty(p); return null;
}
function startRepair(c, p, b) {
  if (b.hp >= 100 || b.rep != null) return 'Nothing to repair';
  const cost = repairCost(c, b);
  if (!canAfford(c, cost)) return 'Not enough funds (' + costText(cost) + ')';
  pay(c, cost); b.rep = 0; return null;
}
function demolish(p, id) {
  p.buildings = p.buildings.filter(b => b.id !== id);
  p.segs = p.segs.filter(s => s.id !== id);
  markDirty(p);
}
function tickConstruction(c, agg, bonus) {
  let cap = 3 + agg.civFac * 0.6 + c.era;
  const speed = (1 + bonus.build + orgFx(c.id).build) * (c.laws.economy === 'civilian' ? 1.1 : c.laws.economy === 'war' ? 0.9 : 1) * (G.cheatFast ? 20 : 1);
  for (const p of c._provs) {
    if (cap <= 0) break;
    if (p.controller !== c.id) continue;
    for (const b of p.buildings) {
      if (cap <= 0) break;
      const B = BUILDINGS[b.t];
      if (b.prog < 1) {
        b.prog = Math.min(1, b.prog + speed / B.days); cap--;
        if (b.prog >= 1) { markDirty(p); if (!b.organic) noteFor(c.id, 'build', `${B.name} completed in ${p.name}.`, p.id); }
      } else if (b.upg != null) {
        b.upg += speed / (B.days * 0.8); cap--;
        if (b.upg >= 1) { b.upg = null; b.lvl++; markDirty(p); noteFor(c.id, 'build', `${B.name} upgraded to level ${b.lvl} in ${p.name}.`, p.id); }
      } else if (b.rep != null) {
        b.hp = Math.min(100, b.hp + speed * 100 / (B.days * 0.5)); cap--;
        if (b.hp >= 100) { b.rep = null; noteFor(c.id, 'build', `${B.name} repaired in ${p.name}.`, p.id); }
        markDirty(p);
      }
    }
    for (const g of p.segs) {
      if (cap <= 0) break;
      if (g.prog < 1) { g.prog = Math.min(1, g.prog + speed * 10 / (SEGMENTS[g.t].days * Math.max(1, segLen(g) / 10))); cap -= 0.5; if (g.prog >= 1) markDirty(p); }
      else if (g.hp < 100 && g.rep) { g.hp = Math.min(100, g.hp + speed * 8); cap -= 0.5; if (g.hp >= 100) g.rep = false; markDirty(p); }
    }
  }
}

// ------------------------------------------------------------
// Daily economy
// ------------------------------------------------------------
function updateCountryAggregates() {
  for (const c of G.countries) {
    c.agg = {}; for (const k of STAT_KEYS) c.agg[k] = 0;
    c.agg.pop = 0; c.agg.workforce = 0; c.agg.jobs = 0; c._provs = []; c.nProv = 0;
  }
  for (const p of G.provs) {
    if (p.owner >= 0) { const o = C(p.owner); o._provs.push(p); o.nProv++; o.agg.pop += p.pop; }
    if (p.controller < 0) continue;
    const c = C(p.controller), s = provStats(p), f = p.controller === p.owner ? 1 : 0.35;
    for (const k of STAT_KEYS) c.agg[k] += s[k] * (k === 'recruit' && f < 1 ? 0 : f);
    c.agg.workforce += s.workforce * f; c.agg.jobs += s.jobs * f;
  }
}
function tickEconomy(c, bonus) {
  const a = c.agg, gov = GOVERNMENTS[c.gov] || GOVERNMENTS.custom, flow = {};
  for (const r of RESOURCES) flow[r] = 0;
  const pop = a.pop, era = c.era;
  // Energy & coal feed industry
  const coalNeed = a.coalUse * (era >= 2 ? 1 : 0);
  let coalF = 1;
  if (coalNeed > 0) { const have = c.stock.coal + a.coal; coalF = clamp(have / coalNeed, 0.3, 1); flow.coal -= Math.min(have, coalNeed); }
  let elecF = 1;
  if (a.elecUse > 0) elecF = clamp((a.elec + 4) / a.elecUse, 0.5, 1);
  c.indF = coalF * elecF;
  // Raw production
  const season = FOOD_SEASON[dateOf(G.day).m];
  flow.food += a.food * (1 + bonus.food) * season;
  // populations are larger in later eras (popMul); mechanized farming keeps the per-capita need comparable
  const pm = ERAS[G.era].popMul;
  flow.food -= (pop * 0.00042 + c._armyMp * 0.0003) / pm;
  for (const r of ['wood', 'stone', 'iron', 'coal', 'oil', 'rubber', 'aluminum']) flow[r] += a[r];
  flow.steel += a.steel;
  if (a.steelMill > 0) {
    const want = a.steelMill * 2, have = Math.min(c.stock.iron + a.iron, want * 1), coalHave = c.stock.coal + a.coal;
    const k = Math.min(have / 2, coalHave) / a.steelMill || 0;
    const prod = a.steelMill * clamp(k, 0, 1);
    flow.iron -= prod * 2; flow.coal -= prod; flow.steel += prod * 3 * c.indF;
  }
  flow.elec = a.elec - a.elecUse;
  flow.consumer = a.consumer * c.indF - pop * 0.000015;
  // Money
  const taxIncome = pop * c.laws.tax * 0.00011 * (1 + (gov.tax || 0) + bonus.money);
  let trade = 0;
  for (const oid of (G._tradeBy.get(c.id) || [])) {
    const o = C(oid);
    trade += (0.6 + Math.min(pop, o.agg.pop) / (1.5e6 * ERAS[G.era].popMul)) * (1 + Math.min(2, a.port) * 0.4) * (1 + bonus.trade + (gov.trade || 0));
  }
  trade += orgFx(c.id).trade;
  if (c.laws.trade === 'free') trade *= 1.25; else if (c.laws.trade === 'closed') trade = 0;
  const bldIncome = a.money * (1 + bonus.money);
  const upkeep = (c._upkeep || 0) * (1 + era * 0.8);
  const bUpkeep = a.civFac * 0.15 + a.milFac * 0.12 + (a.research) * 0.05;
  let overlordTax = 0;
  if (c.overlord >= 0) overlordTax = (taxIncome + bldIncome) * 0.15;
  const subjectTax = (G._subjInc.get(c.id) || 0) * 0.15;
  c.income = taxIncome + trade + bldIncome + subjectTax;
  c.expense = upkeep + bUpkeep + overlordTax + Math.max(0, -c.treasury) * 0.002;
  c.tradeIncome = trade;
  c.treasury += c.income - c.expense;
  // Manual trade orders and automatic imports
  if (c.laws.trade !== 'closed') {
    for (const r in c.orders) {
      const amt = c.orders[r]; if (!amt) continue;
      if (amt > 0) { const price = G.prices[r] * 1.15 * amt; if (c.treasury > price) { c.treasury -= price; flow[r] += amt; c.expense += price; } }
      else { const sell = Math.min(-amt, Math.max(0, c.stock[r] + flow[r])); flow[r] -= sell; const gain = G.prices[r] * 0.85 * sell; c.treasury += gain; c.income += gain; }
    }
  }
  for (const r of RESOURCES) {
    c.stock[r] = (c.stock[r] || 0) + flow[r];
    if (r === 'elec' || r === 'consumer') { c.stock[r] = Math.max(0, Math.min(c.stock[r], 500)); continue; }
    if (c.stock[r] < 0) {
      if (c.autoImport && c.laws.trade !== 'closed' && r !== 'food' && c.treasury > 0) { const pay = -c.stock[r] * G.prices[r] * 1.3; c.treasury -= pay; c.expense += pay; c.stock[r] = 0; }
      else if (r === 'food' && c.autoImport && c.laws.trade !== 'closed' && c.treasury > 50) { const pay = -c.stock.food * G.prices.food * 1.4; c.treasury -= pay; c.expense += pay; c.stock.food = 0; }
      else c.stock[r] = 0;
    }
  }
  c.foodShortage = c.stock.food <= 0 && flow.food < 0;
  c.consumerSat = clamp(0.5 + (c.stock.consumer > 0 ? 0.5 : 0) + flow.consumer * 0.05, 0, 1);
  c.flow = flow;
  c.inflation = c.treasury < 0 ? Math.min(1, c.inflation + 0.0006) : Math.max(0, c.inflation - 0.0002);
  // Political power and research
  c.pp = Math.min(999, c.pp + 0.6 + (gov.pp || 0) + a.pp + bonus.pp * 0.5);
  c.education = clamp(0.2 + a.research / Math.max(1, c.nProv * 1.2), 0.2, 1);
  // diminishing returns: research buildings beyond the first few add less and less
  const rp = (1.3 + 1.8 * Math.sqrt(a.research) * (1 + bonus.research + (gov.research || 0))) * (1 + orgFx(c.id).research) * (0.6 + 0.6 * c.education) * elecF * (c.laws.trade === 'closed' ? 0.95 : 1);
  c.rpDay = rp;
  if (!c.researching && c.queue.length) c.researching = c.queue.shift();
  if (c.researching) {
    const T = TECH_BY_ID[c.researching];
    if (!T || !canResearch(c, T)) { c.researching = null; c.rp = 0; }
    else {
      c.rp += rp;
      if (c.rp >= techCost(c, T)) {
        c.rp = 0; c.techs.push(T.id); c.researching = null;
        const oldEra = c.era; c.era = countryEra(c);
        noteFor(c.id, 'research', `Research complete: ${T.name}.`);
        if (c.era > oldEra) { setupTemplates(c); if (isHuman(c.id)) popupFor(c.id, 'A New Age', `${c.name} has entered the ${ERAS[c.era].name}. New buildings, units and division templates are available.`, null, true); else note('world', `${c.name} has entered the ${ERAS[c.era].name}.`); }
        if (['t_tanks1', 't_tanks2', 't_tanks3', 't_mbt', 't_hover', 't_railgun'].includes(T.id) && c.ai) autoDesign(c);
      }
    }
  }
  if (c.justifying) {
    c.justifying.left--;
    if (c.justifying.left <= 0) { const t = c.justifying.target; c.wargoals.push(t); c.justifying = null; noteFor(c.id, 'diplo', `War goal against ${C(t).name} is ready.`); }
  }
}
// Military production lines
function lineEquipName(c, key) {
  if (key.startsWith('tank:')) { const d = c.designs.find(x => x.id === +key.slice(5)); return d ? d.name : 'Obsolete design'; }
  return EQUIP[key].names[c.era];
}
function lineUnitCost(c, key) { if (key.startsWith('tank:')) { const d = c.designs.find(x => x.id === +key.slice(5)); return d ? tankStats(d).cost : 10; } return EQUIP[key].cost; }
function lineRes(c, key) {
  if (key.startsWith('tank:')) { const d = c.designs.find(x => x.id === +key.slice(5)); const s = d ? tankStats(d) : { armor: 20, fuel: 1 }; return { steel: 0.6 + s.armor / 40, oil: s.fuel * 0.3, rubber: 0.1 }; }
  return EQUIP[key].res(c.era);
}
function tickProduction(c, bonus) {
  const a = c.agg;
  let totalFac = a.milFac;
  const lawF = c.laws.economy === 'war' ? 1.25 : c.laws.economy === 'civilian' ? 0.85 : 1;
  const eff = (1 + bonus.production + orgFx(c.id).prod) * lawF * (c.indF || 1);
  let assigned = 0;
  for (const L of c.lines) {
    const fac = Math.max(0, Math.min(L.fac, totalFac - assigned));
    assigned += fac;
    if (fac <= 0) { L.rate = 0; continue; }
    let pts = fac * eff;
    if (L.eq.startsWith('tank:')) pts *= 1 + Math.min(1, a.tankFac / Math.max(1, fac));
    if (L.eq === 'ships') pts = Math.min(pts, a.shipyard * 3);
    if (L.eq === 'aircraft' && a.air < 1 && c.era < 3) pts = 0;
    const unitCost = lineUnitCost(c, L.eq), res = lineRes(c, L.eq);
    let units = pts / unitCost;
    for (const r in res) { const need = res[r] * units; if (c.stock[r] < need && !(c.autoImport && c.laws.trade !== 'closed' && c.treasury > 0)) units = Math.min(units, c.stock[r] / res[r]); }
    for (const r in res) {
      const need = res[r] * units;
      if (c.stock[r] >= need) c.stock[r] -= need;
      else { const short = need - c.stock[r]; c.stock[r] = 0; c.treasury -= short * G.prices[r] * 1.3; }
    }
    L.prog = (L.prog || 0) + units;
    L.rate = units;
    const whole = Math.floor(L.prog);
    if (whole > 0) { L.prog -= whole; c.equip[L.eq] = (c.equip[L.eq] || 0) + whole; }
  }
  c.facFree = Math.max(0, totalFac - assigned);
}

// ------------------------------------------------------------
// Monthly: population, stability, manpower, unrest, events
// ------------------------------------------------------------
function tickMonthlyCountry(c, bonus) {
  const gov = GOVERNMENTS[c.gov] || GOVERNMENTS.custom;
  const consRate = [0.01, 0.025, 0.05, 0.1][c.laws.conscription];
  const mpCap = c.agg.pop * consRate * (1 + (gov.manpower || 0)) + c.agg.manpower * 1000;
  const inArmy = c._armyMp || 0;
  c.mpCap = mpCap;
  c.manpower = Math.max(0, c.manpower + Math.max(0, mpCap - inArmy - c.manpower) * 0.12);
  // Stability target
  let t = 50 + (gov.stab || 0) + Math.min(25, c.agg.stab * 1.2) + bonus.stab + orgFx(c.id).stab;
  t += [0, -2, -6, -15][c.laws.conscription];
  t += c.laws.economy === 'civilian' ? 2 : c.laws.economy === 'war' ? -5 : 0;
  t += c.laws.trade === 'closed' ? 3 : 0;
  t -= (c.laws.tax - 0.15) * 60;
  t -= c.warEx * 0.4;
  if (c.foodShortage) t -= 20;
  t -= (1 - (c.consumerSat == null ? 1 : c.consumerSat)) * 10;
  t -= c.inflation * 40;
  if (c.treasury < 0) t -= 8;
  const empl = c.agg.workforce > 0 ? Math.min(1, c.agg.jobs / c.agg.workforce) : 1;
  c.employment = empl;
  if (c.era >= 2) t -= Math.max(0, 0.6 - empl) * 15;
  c.stabTarget = clamp(t, 0, 100);
  c.stability += (c.stabTarget - c.stability) * 0.2;
  // War exhaustion
  if (inWar(c.id)) { const occ = c._provs.filter(p => p.controller !== c.id).length / Math.max(1, c.nProv); c.warEx = Math.min(100, c.warEx + occ * 6 + 0.5); }
  else c.warEx = Math.max(0, c.warEx - 3);
  // Population per province
  for (const p of c._provs) {
    const s = provStats(p);
    let rate = 0.0018 * (1 + bonus.growth);
    rate += c.foodShortage ? -0.006 : 0.001;
    rate += (c.stability - 50) / 50 * 0.0008;
    if (p.controller !== p.owner) rate -= 0.002;
    if (p.pop > s.housing) rate = -0.006 * Math.min(2, p.pop / s.housing - 1) - 0.001;
    const before = p.pop;
    p.pop = Math.max(500, Math.round(p.pop * (1 + rate)));
    // Migration: overflow moves to neighbours with room
    if (p.pop > s.housing * 0.98) {
      let best = null, room = 0;
      for (const n of p.neighbors) { const q = G.provs[n]; if (q.owner !== c.id) continue; const r = provStats(q).housing - q.pop; if (r > room) { room = r; best = q; } }
      if (best) { const mv = Math.round(Math.min(room * 0.3, p.pop * 0.01)); p.pop -= mv; best.pop += mv; }
    }
    if (Math.abs(p.pop - before) > before * 0.003) p.dirty = true;
    // Organic settlement growth
    if (p.growth && p.controller === c.id && p.pop > s.housing * 0.85 && c.stability > 30 && Math.random() < 0.5) {
      const t2 = c.era >= 4 && hasTech(c, 't_highrise') && Math.random() < 0.3 ? 'skyscraper' : c.era >= 3 && hasTech(c, 't_electric') ? 'apartments' : 'cottage';
      const pos = autoPlace(p, t2, Math.random);
      if (pos) { p.buildings.push({ id: nid(), t: t2, x: pos.x, z: pos.z, r: pos.r, lvl: 1, prog: 0, hp: 100, organic: true }); markDirty(p); }
    }
    // Local unrest
    let happy = c.stability + (p.culture !== c.culture ? -18 : 0) + (p.religion !== c.religion ? -6 : 0) + (p.support || 0) * -1;
    p.unrest = clamp((p.unrest || 0) + (happy < 25 ? (25 - happy) * 0.15 : -2), 0, 100);
  }
  // Rebellions and civil wars
  const rebelProv = c._provs.filter(p => p.unrest > 60 && p.id !== c.capital && p.controller === c.id).sort((a, b) => b.unrest - a.unrest)[0];
  if (rebelProv && Math.random() < 0.35) spawnRebellion(c, rebelProv);
  else if (c.stability < 15 && Math.random() < 0.15 && c._provs.length > 3) {
    const cands = c._provs.filter(p => p.id !== c.capital && p.controller === c.id);
    if (cands.length) spawnRebellion(c, pick(Math.random, cands));
  }
  // Natural disasters
  if (Math.random() < 0.035 && c._provs.length) {
    const p = pick(Math.random, c._provs);
    const kinds = [];
    if (p.river) kinds.push('flood'); if (p.terrain === 'mountain' || p.terrain === 'hills') kinds.push('earthquake');
    if (p.terrain === 'desert' || p.terrain === 'grassland') kinds.push('drought'); if (p.terrain === 'forest' || c.era < 2) kinds.push('fire');
    if (c.era < 3) kinds.push('plague');
    const k = kinds.length ? pick(Math.random, kinds) : 'storm';
    disaster(c, p, k);
  }
}
function disaster(c, p, kind) {
  const dmg = (n, amt) => { for (let i = 0; i < n && p.buildings.length; i++) { const b = pick(Math.random, p.buildings); b.hp = Math.max(0, b.hp - amt * (0.5 + Math.random())); } markDirty(p); };
  let text = '';
  if (kind === 'flood') { dmg(3, 35); p.pop = Math.round(p.pop * 0.98); text = `The river has flooded ${p.name}. Buildings were damaged.`; }
  else if (kind === 'earthquake') { dmg(4, 45); p.pop = Math.round(p.pop * 0.97); text = `An earthquake struck ${p.name}.`; }
  else if (kind === 'drought') { c.stock.food *= 0.6; text = `Drought around ${p.name} has ruined part of the harvest.`; }
  else if (kind === 'fire') { dmg(3, 50); text = `A great fire swept through ${p.name}.`; }
  else if (kind === 'plague') { const m = c.techs.includes('t_inoc') ? 0.97 : 0.93; p.pop = Math.round(p.pop * m); for (const n of p.neighbors) if (G.provs[n].owner === c.id) G.provs[n].pop = Math.round(G.provs[n].pop * (m + 0.02)); text = `Plague has broken out in ${p.name}.`; }
  else { dmg(2, 25); text = `A violent storm battered ${p.name}.`; }
  noteFor(c.id, 'event', text, p.id);
}
function spawnRebellion(c, p) {
  const rng = Math.random;
  const take = [p];
  for (const n of p.neighbors) { const q = G.provs[n]; if (q.owner === c.id && q.id !== c.capital && q.controller === c.id && (q.culture === p.culture || q.unrest > 30) && take.length < 4) take.push(q); }
  const isCulture = p.culture !== c.culture && p.culture !== 'Unsettled';
  const name = isCulture ? 'Free ' + p.culture.replace(/ian$/, '') + 'ia' : 'Republic of ' + p.name;
  const col = hsl2rgb(rng() * 360, 0.45, 0.5);
  const r = newCountry({ name, adj: isCulture ? p.culture : p.name + 'ian', color: col, gov: isCulture ? 'tribal' : 'republic', ideology: 'Nationalist', personality: 'defensive', culture: isCulture ? p.culture : c.culture, religion: p.religion, leader: pick(rng, LEADER_FIRST) + ' ' + genName(rng), capital: p.id });
  r.techs = [...c.techs]; r.era = c.era; setupTemplates(r); r.designs = c.designs.map(d => Object.assign({}, d));
  r.treasury = 100 * (1 + c.era); r.manpower = 20000; r.equip.arms = 400; r.equip.artillery = 30;
  for (const q of take) {
    for (const d of G.divs.filter(d => d.prov === q.id && d.owner === c.id)) retreatDivision(d);
    q.owner = q.controller = r.id; q.unrest = 0; q.core = [...new Set([...(q.core || []), r.id])]; markDirty(q);
  }
  for (let i = 0; i < 1 + take.length / 2; i++) spawnDivision(r, r.templates[0], pick(rng, take).id, 0.75);
  for (const o of G.countries) if (o.id !== r.id) G.diplo.rel[pairKey(r.id, o.id)] = o.id === c.id ? -80 : 0;
  updateCountryAggregates();
  declareWar(r.id, c.id, 'Rebellion', true);
  note('world', `Rebellion! ${r.name} has risen against ${c.name} in ${p.name}.`, p.id);
  if (isHuman(c.id)) popupFor(c.id, 'Civil Unrest Erupts', `Rebels have seized ${take.map(q => q.name).join(', ')} and proclaimed ${r.name}. Crush the rebellion or negotiate peace.`, null, true);
}

// ------------------------------------------------------------
// Divisions, movement, supply
// ------------------------------------------------------------
class MinHeap {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  push(k, v) { const a = this.a; a.push([k, v]); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } }
  pop() { const a = this.a, top = a[0], last = a.pop(); if (a.length) { a[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < a.length && a[l][0] < a[m][0]) m = l; if (r < a.length && a[r][0] < a[m][0]) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } } return top; }
}
function ordinal(n) { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }
function spawnDivision(c, tpl, provId, str) {
  const st = divStats(c, tpl.bats, c.designs.length ? c.designs[c.designs.length - 1].id : null);
  c.divCount = (c.divCount || 0) + 1;
  const d = { id: nid(), owner: c.id, name: `${ordinal(c.divCount)} ${tpl.name}`, tpl: tpl.id, bats: [...tpl.bats], st, prov: provId, path: [], prog: 0, str: str == null ? 1 : str, org: 1, exp: 0, state: 'idle', target: null, supplied: true, auto: false, tank: st.tank };
  G.divs.push(d);
  return d;
}
function recruitCheck(c, tpl, p) {
  if (!p || p.owner !== c.id || p.controller !== c.id) return 'You must control the province';
  const s = provStats(p);
  if (s.recruit < 1) return 'Needs Barracks or a Military Base in this province';
  if (tpl.bats.some(b => BATTALIONS[b].needs === 'cavalry') && (c.agg.cavalry || 0) < 1) return 'Cavalry units need Stables somewhere in your realm';
  if (tpl.bats.some(b => !hasTech(c, BATTALIONS[b].tech))) return 'Template uses unresearched units';
  const st = divStats(c, tpl.bats, null);
  if (c.manpower < st.mp) return `Not enough manpower (${fmt(st.mp)} needed)`;
  for (const e in st.eq) {
    if (e === 'tank') { if (!bestTankStock(c, st.eq.tank)) return `Not enough tanks (${st.eq.tank} of one design needed)`; continue; }
    if ((c.equip[e] || 0) < st.eq[e]) return `Not enough ${EQUIP[e].names[c.era].toLowerCase()} (${Math.ceil(st.eq[e])} needed, ${Math.floor(c.equip[e] || 0)} in stock)`;
  }
  return null;
}
function bestTankStock(c, need) { let best = null; for (const d of c.designs) if ((c.equip['tank:' + d.id] || 0) >= need && (!best || d.id > best.id)) best = d; return best; }
function recruit(c, tpl, p) {
  const err = recruitCheck(c, tpl, p);
  if (err) return err;
  const st = divStats(c, tpl.bats, null);
  c.manpower -= st.mp;
  let design = null;
  for (const e in st.eq) {
    if (e === 'tank') { design = bestTankStock(c, st.eq.tank); c.equip['tank:' + design.id] -= st.eq.tank; }
    else c.equip[e] -= st.eq[e];
  }
  const d = spawnDivision(c, tpl, p.id, 1);
  if (design) { d.tank = design.id; d.st = divStats(c, d.bats, design.id); }
  d.state = 'training'; d.train = Math.round(25 + tpl.bats.length * 2);
  return d;
}
function canEnter(cid, p) {
  const o = p.controller;
  if (o === cid) return true;
  if (o < 0) return false;
  const fs = G._fs && G._fs.get(cid);
  if (fs && fs.has(o)) return true;
  return allied(cid, o) || atWar(cid, o) || hasAccess(cid, o);
}
// Ocean voyages: with a port and ships, troops may sail from any coast they hold to any coast within this range
const OCEAN_RANGE = 520;
const coastalIds = () => G._coastals || (G._coastals = G.provs.filter(p => p.coastal).map(p => p.id));
const seaDist = (a, b) => Math.hypot(a.cx - b.cx, a.cy - b.cy);
// openSea: also consider direct voyages across open water (tried only when no shorter route exists)
function findPath(div, targetId, openSea) {
  const start = div.prov, cid = div.owner, c = C(cid);
  if (start === targetId) return [];
  const hasPort = c.agg.port >= 1 && (c.equip.ships || 0) >= 1;
  const prev = new Map([[start, -1]]);
  const dist = new Map([[start, 0]]);
  const heap = new MinHeap();
  heap.push(0, start);
  const enterOk = new Map();
  const okAt = n => { if (!enterOk.has(n)) enterOk.set(n, canEnter(cid, G.provs[n])); return enterOk.get(n); };
  while (heap.size) {
    const [dcur, cur] = heap.pop();
    if (cur === targetId) break;
    if (dcur > dist.get(cur)) continue;
    const P = G.provs[cur];
    const seaOk = hasPort && P.coastal && (P.controller === cid || allied(cid, P.controller));
    const n1 = P.neighbors.length, links = seaOk ? P.neighbors.concat(P.sea) : P.neighbors;
    for (let i = 0; i < links.length; i++) {
      const n = links[i];
      if (!okAt(n)) continue;
      const nd = dcur + (i < n1 ? TERRAINS[G.provs[n].terrain].move : 4);
      if (nd < (dist.has(n) ? dist.get(n) : Infinity)) { dist.set(n, nd); prev.set(n, cur); heap.push(nd, n); }
    }
    if (openSea && seaOk) for (const n of coastalIds()) {
      if (n === cur) continue;
      const Q = G.provs[n], d = seaDist(P, Q);
      if (d > OCEAN_RANGE || !okAt(n)) continue;
      const nd = dcur + 3 + d / 40;
      if (nd < (dist.has(n) ? dist.get(n) : Infinity)) { dist.set(n, nd); prev.set(n, cur); heap.push(nd, n); }
    }
  }
  if (!prev.has(targetId)) return null;
  const path = [];
  for (let x = targetId; x !== start; x = prev.get(x)) path.unshift(x);
  return path;
}
function orderMove(div, targetId) {
  if (div.state === 'training') return 'Still training';
  const path = findPath(div, targetId) || findPath(div, targetId, true);
  if (!path) return 'No route — you need access or a war, and for overseas targets a port with ships';
  if (div.state === 'battle' || div.state === 'siege') { leaveAttack(div); }
  div.path = path; div.prog = 0; div.state = path.length ? 'moving' : 'idle'; div.target = targetId;
  return null;
}
function leaveAttack(div) { div.state = 'idle'; div.attacking = null; div.prog = 0; }
function hostileDivsIn(cid, provId) { return G.divs.filter(d => d.prov === provId && d.state !== 'training' && atWar(cid, d.owner)); }
// For each country, the set of controllers whose land its troops may draw supply through
function friendSets() {
  const S = new Map();
  const add = (a, b) => { let s = S.get(a); if (!s) S.set(a, s = new Set([a])); s.add(b); };
  for (const c of G.countries) if (c.alive) { add(c.id, c.id); if (c.overlord >= 0) { add(c.id, c.overlord); add(c.overlord, c.id); } }
  for (const t of G.diplo.treaties) { if (t.type === 'alliance') { add(t.a, t.b); add(t.b, t.a); } else if (t.type === 'access') add(t.b, t.a); }
  for (const w of G.wars) for (const side of [w.att, w.def]) for (const a of side) for (const b of side) add(a, b);
  return S;
}
function computeSupply() {
  const FS = G._fs = friendSets();
  for (const c of G.countries) {
    if (!c.alive) continue;
    const mine = G.divs.filter(d => d.owner === c.id);
    if (!mine.length) { c._supply = null; continue; }
    let hub = G.provs[c.capital];
    if (!hub || hub.controller !== c.id) hub = c._provs.find(p => p.controller === c.id);
    const set = new Uint8Array(G.provs.length);
    if (!hub) { c._supply = set; continue; }
    const hasPort = c.agg.port >= 1;
    const friends = FS.get(c.id) || new Set([c.id]);
    const q = [hub.id]; set[hub.id] = 1;
    const spread = () => {
      while (q.length) {
        const x = q.pop(), P = G.provs[x];
        const ls = hasPort && P.coastal ? P.neighbors.concat(P.sea) : P.neighbors;
        for (const n of ls) { if (set[n]) continue; if (friends.has(G.provs[n].controller)) { set[n] = 1; q.push(n); } }
      }
    };
    spread();
    // with a port at home, every coast we hold overseas is supplied by sea, and the land behind it
    if (hasPort && coastalIds().some(i => set[i] && G.provs[i].controller === c.id)) {
      for (const i of coastalIds()) if (!set[i] && G.provs[i].controller === c.id) { set[i] = 1; q.push(i); }
      spread();
    }
    c._supply = set;
  }
}
function isSupplied(d) {
  const s = C(d.owner)._supply;
  if (!s) return true;
  if (s[d.prov]) return true;
  return false;
}
function retreatDivision(d) {
  const P = G.provs[d.prov];
  const opts = P.neighbors.map(n => G.provs[n]).filter(q => (q.controller === d.owner || (q.controller >= 0 && allied(d.owner, q.controller))) && !hostileDivsIn(d.owner, q.id).length);
  if (P.controller === d.owner && !hostileDivsIn(d.owner, P.id).length) opts.push(P);
  if (!opts.length) return false;
  opts.sort((a, b) => (provStats(b).fort - provStats(a).fort) || (b.pop - a.pop));
  d.prov = opts[0].id; d.path = []; d.prog = 0; d.state = 'idle'; d.attacking = null;
  return true;
}
function destroyDivision(d, why) {
  G.divs = G.divs.filter(x => x !== d);
  noteFor(d.owner, 'war', `${d.name} was destroyed ${why || ''}.`, d.prov);
  if (window.UIHooks) UIHooks.divRemoved(d.id);
}
function weatherAt(p) { const w = G.weather; if (!w.length) return 'clear'; const gx = Math.min(7, Math.floor(p.cx / MW * 8)), gy = Math.min(4, Math.floor(p.cy / MH * 5)); return w[gy * 8 + gx]; }
function initWeather() { G.weather = []; for (let i = 0; i < 40; i++) G.weather.push('clear'); tickWeather(); }
function tickWeather() {
  const winter = isWinter();
  for (let i = 0; i < 40; i++) {
    const gy = Math.floor(i / 8), cold = gy === 0 || gy === 4;
    const r = Math.random();
    G.weather[i] = r < 0.55 ? 'clear' : r < 0.82 ? (winter && cold ? 'snow' : 'rain') : r < 0.9 && winter ? 'snow' : r < 0.95 ? 'storm' : 'clear';
  }
}
function tickMovement() {
  for (const d of G.divs) {
    if (d.state === 'training') { d.train--; if (d.train <= 0) { d.state = 'idle'; noteFor(d.owner, 'military', `${d.name} has finished training in ${G.provs[d.prov].name}.`, d.prov); } continue; }
    d.supplied = isSupplied(d);
    const P = G.provs[d.prov];
    if (!d.supplied) { d.org = Math.max(0, d.org - 0.03); d.str = Math.max(0, d.str - 0.008); if (d.str < 0.05) { destroyDivision(d, 'after being cut off from supply'); continue; } }
    if (d.state === 'battle' || d.state === 'siege') continue;
    if (!d.path.length) { d.state = 'idle'; d.org = Math.min(1, d.org + (d.supplied ? 0.05 : 0)); continue; }
    const next = G.provs[d.path[0]];
    if (!canEnter(d.owner, next)) { d.path = []; d.state = 'idle'; continue; }
    const sea = !P.neighbors.includes(next.id);
    const w = weatherAt(next), wf = w === 'snow' ? 0.6 : w === 'rain' ? 0.8 : w === 'storm' ? 0.7 : 1;
    const infra = provStats(next).infra;
    // at sea a crossing takes longer the farther it goes (a short hop ~5 days, the Atlantic ~3 weeks)
    let sp = sea ? (w === 'storm' ? 0 : 0.22 * Math.min(1, 50 / seaDist(P, next))) : d.st.spd * 0.085 / (TERRAINS[next.terrain].move * (next.river && !d.st.river ? 1.3 : 1)) * (1 + Math.min(3, infra) * 0.12) * wf;
    if (!d.supplied) sp *= 0.5;
    d.org = Math.min(1, d.org + 0.01);
    d.prog += sp;
    d.state = 'moving';
    if (d.prog < 1) continue;
    d.prog = 1;
    const enemies = hostileDivsIn(d.owner, next.id);
    if (enemies.length) { startBattle(d, next, sea); continue; }
    if (atWar(d.owner, next.controller)) {
      const fort = effectiveFort(next, [d]);
      if (fort >= 2.2 && !d.st.river) { d.state = 'siege'; d.attacking = next.id; next.siege = next.siege && next.siege.by === d.owner ? next.siege : { by: d.owner, prog: 0 }; continue; }
      captureProvince(next, d.owner);
    }
    d.prov = next.id; d.path.shift(); d.prog = 0; d.landing = false;
    if (!d.path.length) d.state = 'idle';
  }
}
function effectiveFort(p, attackers) {
  let siege = 0; for (const d of attackers) siege += d.st.siege * d.str;
  return Math.max(0, provStats(p).fort - siege * 0.1);
}

// ------------------------------------------------------------
// Battles
// ------------------------------------------------------------
function startBattle(d, p, sea) {
  d.state = 'battle'; d.attacking = p.id; d.landing = !!sea;
  let b = G.battles.find(x => x.prov === p.id);
  if (!b) {
    b = { id: nid(), prov: p.id, att: d.owner, def: hostileDivsIn(d.owner, p.id)[0].owner, days: 0, start: G.day, log: [], attLoss: 0, defLoss: 0 };
    G.battles.push(b);
    const involved = [b.att, b.def];
    noteAll(involved, 'war', `Battle of ${p.name} has begun: ${C(b.att).name} attacks ${C(b.def).name}.`, p.id);
  }
}
function battleSides(b) {
  const attackers = G.divs.filter(d => d.state === 'battle' && d.attacking === b.prov);
  const p = G.provs[b.prov];
  const defenders = attackers.length ? G.divs.filter(d => d.prov === b.prov && d.state !== 'training' && attackers.some(a => atWar(a.owner, d.owner))) : [];
  return { attackers, defenders, p };
}
function airSuperiority(a, b) {
  const pa = C(a).equip.aircraft || 0, pb = C(b).equip.aircraft || 0;
  return clamp((pa - pb) / (pa + pb + 40), -1, 1) * 0.22;
}
function combatPower(divs, enemyHard, mods) {
  let off = 0, res = 0, def = 0, arm = 0, prc = 0, n = 0;
  for (const d of divs) {
    const f = d.str * (0.4 + 0.6 * d.org) * (1 + d.exp * 0.25) * (d.supplied ? 1 : 0.6);
    off += (d.st.sa * (1 - enemyHard) + d.st.ha * enemyHard) * f;
    res += d.st.brk * f; def += d.st.df * f;
    arm += d.st.arm; prc = Math.max(prc, d.st.prc); n++;
  }
  return { off: off * mods, res, def, arm: arm / Math.max(1, n), prc };
}
function avgHard(divs) { let h = 0; for (const d of divs) h += d.st.hard; return divs.length ? h / divs.length : 0; }
function tickBattles() { for (const b of [...G.battles]) tickOneBattle(b); }
// Auto-resolve: fight the battle out immediately, day by day
function resolveBattleNow(b) {
  for (let i = 0; i < 200 && G.battles.includes(b); i++) tickOneBattle(b);
  updateCountryAggregates();
}
function tickOneBattle(b) {
  {
    const { attackers, defenders, p } = battleSides(b);
    b.days++;
    if (!attackers.length) { endBattle(b, 'def'); return; }
    if (!defenders.length) { endBattle(b, 'att', attackers); return; }
    const s = provStats(p), T = TERRAINS[p.terrain], aOwner = attackers[0].owner, dOwner = defenders[0].owner;
    const fort = effectiveFort(p, attackers);
    const cA = C(aOwner), cD = C(dOwner);
    let mA = T.atk * (p.river && !attackers.some(d => d.st.river) && !p.buildings.some(x => x.t === 'bridge') ? 0.78 : 1);
    if (s.nb > 14) mA *= 0.85;
    if (attackers.some(d => d.landing)) mA *= 0.55;
    const w = weatherAt(p); if (w !== 'clear') mA *= w === 'snow' ? 0.82 : 0.9;
    const air = airSuperiority(aOwner, dOwner) * (1 - clamp(s.airdef, 0, 0.6));
    mA *= 1 + air + (cA.era - cD.era) * 0.15;
    if (attackers.some(d => d.bats.includes('armor'))) { const tm = p.terrain === 'forest' ? 0.8 : p.terrain === 'mountain' ? 0.65 : p.terrain === 'hills' ? 0.85 : 1; mA *= 0.5 + 0.5 * tm; }
    let mD = (1 - air) * (1 + (cD.era - cA.era) * 0.15);
    const A = combatPower(attackers, avgHard(defenders), mA * (0.85 + Math.random() * 0.3));
    const D = combatPower(defenders, avgHard(attackers), mD * (0.85 + Math.random() * 0.3));
    let resD = D.def * T.def * (1 + 0.18 * fort);
    let resA = A.res;
    // Armor vs piercing
    let aTake = 1, dTake = 1;
    if (D.prc < A.arm) { aTake *= 0.5; A.off *= 1.2; }
    if (A.prc < D.arm) { dTake *= 0.5; D.off *= 1.2; }
    const rA = clamp(A.off / (resD * 0.6 + 1), 0, 3), rD = clamp(D.off / (resA * 0.6 + 1), 0, 3);
    for (const d of defenders) { d.org = Math.max(0, d.org - (0.02 + 0.07 * rA) * dTake); const l = (0.004 + 0.012 * rA) * dTake; d.str = Math.max(0, d.str - l); b.defLoss += l * d.st.mp; C(d.owner).casualties = (C(d.owner).casualties || 0) + l * d.st.mp; d.exp = Math.min(1, d.exp + 0.003); }
    for (const d of attackers) { d.org = Math.max(0, d.org - (0.02 + 0.07 * rD) * aTake * (1 + fort * 0.08)); const l = (0.004 + 0.012 * rD) * aTake; d.str = Math.max(0, d.str - l); b.attLoss += l * d.st.mp; C(d.owner).casualties = (C(d.owner).casualties || 0) + l * d.st.mp; d.exp = Math.min(1, d.exp + 0.003); }
    b.lastA = A.off; b.lastD = D.off; b.ratio = rA / Math.max(0.05, rD);
    // Fighting damages buildings, fortifications first
    let siegeP = 0; for (const d of attackers) siegeP += d.st.siege;
    if (Math.random() < 0.55 && (p.buildings.length || p.segs.length)) {
      const forts = p.buildings.filter(x => x.hp > 0 && BUILDINGS[x.t].eff.fort);
      const walls = p.segs.filter(g => g.hp > 0 && (g.t === 'wall' || g.t === 'palisade'));
      const roll = Math.random();
      if (roll < 0.35 && walls.length) { const g = pick(Math.random, walls); g.hp = Math.max(0, g.hp - (4 + Math.random() * 8) * (1 + siegeP * 0.08)); }
      else if (roll < 0.6 && forts.length) { const x = pick(Math.random, forts); x.hp = Math.max(0, x.hp - (3 + Math.random() * 7) * (1 + siegeP * 0.08)); }
      else if (p.buildings.length) { const x = pick(Math.random, p.buildings); x.hp = Math.max(0, x.hp - (3 + Math.random() * 9)); }
      markDirty(p);
    }
    for (const d of defenders) {
      if (d.str < 0.04) { destroyDivision(d, 'in battle at ' + p.name); continue; }
      if (d.org < 0.08 && !retreatDivision(d)) destroyDivision(d, `while encircled at ${p.name}`);
      else if (d.org < 0.08) noteFor(d.owner, 'war', `${d.name} is retreating from ${p.name}.`, p.id);
    }
    for (const d of attackers) {
      if (d.str < 0.04) { destroyDivision(d, 'in battle at ' + p.name); continue; }
      if (d.org < 0.08) { leaveAttack(d); d.path = []; noteFor(d.owner, 'war', `${d.name}'s attack on ${p.name} has broken down.`, p.id); }
    }
  }
}
function endBattle(b, winner, attackers) {
  G.battles = G.battles.filter(x => x !== b);
  const p = G.provs[b.prov];
  const inv = [b.att, b.def];
  if (winner === 'att') {
    noteAll(inv, 'war', `${C(b.att).name} won the Battle of ${p.name}.`, p.id);
    for (const d of attackers) { d.state = 'moving'; d.attacking = null; }
  } else noteAll(inv, 'war', `${C(b.def).name} held ${p.name}.`, p.id);
  b.result = winner; G.lastBattle = b;
  if (window.UIHooks) UIHooks.battleEnded(b);
}
function tickSieges() {
  for (const p of G.provs) {
    if (!p.siege) continue;
    const by = G.divs.filter(d => d.state === 'siege' && d.attacking === p.id);
    if (!by.length || !atWar(by[0].owner, p.controller)) { p.siege = null; for (const d of by) leaveAttack(d); continue; }
    if (hostileDivsIn(by[0].owner, p.id).length) { for (const d of by) startBattle(d, p, false); p.siege = null; continue; }
    let pow = 0.5; for (const d of by) pow += 0.15 + d.st.siege * 0.12 * d.str;
    const fort = Math.max(1, provStats(p).fort);
    p.siege.prog += pow / (fort * 6);
    if (Math.random() < 0.5) {
      const ws = p.segs.filter(g => g.hp > 0 && (g.t === 'wall' || g.t === 'palisade'));
      const fs = p.buildings.filter(x => x.hp > 0 && BUILDINGS[x.t].eff.fort);
      const tgt = ws.length && Math.random() < 0.5 ? pick(Math.random, ws) : fs.length ? pick(Math.random, fs) : null;
      if (tgt) { tgt.hp = Math.max(0, tgt.hp - 3 - pow * 4); markDirty(p); }
    }
    if (p.siege.prog >= 1) {
      const owner = by[0].owner;
      noteAll([...by.map(d => d.owner), p.owner], 'war', `The siege of ${p.name} is over — the defenders have surrendered.`, p.id);
      captureProvince(p, owner);
      p.siege = null;
      for (const d of by) { d.prov = p.id; d.state = 'idle'; d.attacking = null; d.path = d.path[0] === p.id ? d.path.slice(1) : []; d.prog = 0; if (d.path.length) d.state = 'moving'; }
    }
  }
}
function captureProvince(p, cid) {
  const prevCtrl = p.controller;
  let newCtrl = cid;
  if (p.owner >= 0 && (p.owner === cid || (allied(cid, p.owner) && !atWar(cid, p.owner)))) newCtrl = p.owner;
  p.controller = newCtrl; p.siege = null;
  if (newCtrl !== prevCtrl) flashProvince(p, newCtrl);
  if (newCtrl !== p.owner) {
    for (let i = 0; i < 3 && p.buildings.length; i++) { const b = pick(Math.random, p.buildings); b.hp = Math.max(0, b.hp - 15 - Math.random() * 40); }
    p.pop = Math.round(p.pop * 0.97);
  }
  markDirty(p);
  for (const d of G.divs) if (d.prov === p.id && atWar(d.owner, cid) && d.state !== 'battle') { if (!retreatDivision(d)) destroyDivision(d, 'when ' + p.name + ' fell'); }
  noteAll([prevCtrl, cid], 'war', `${p.name} is now controlled by ${C(newCtrl).name}.`, p.id);
  absorbPockets(p, cid, 0);
  checkCapitulation(prevCtrl);
  if (p.owner >= 0) checkCapitulation(p.owner);
}
// Undefended, unfortified enemy land that is completely surrounded by our side surrenders on its own
function absorbPockets(p, cid, depth) {
  if (depth > 2) return;
  for (const n of p.neighbors) {
    const q = G.provs[n];
    if (!atWar(cid, q.controller) || hostileDivsIn(cid, q.id).length || provStats(q).fort >= 2.2 || q.siege) continue;
    if (!q.neighbors.every(m => { const o = G.provs[m].controller; return o === cid || (o >= 0 && allied(cid, o) && !atWar(cid, o)); })) continue;
    const prev = q.controller;
    q.controller = (q.owner === cid || (q.owner >= 0 && allied(cid, q.owner) && !atWar(cid, q.owner))) ? q.owner : cid;
    flashProvince(q, q.controller); markDirty(q);
    noteAll([prev, cid], 'war', `Cut off, ${q.name} has surrendered to ${C(q.controller).name}.`, q.id);
    absorbPockets(q, cid, depth + 1);
  }
}
function checkCapitulation(cid) {
  if (cid < 0) return;
  const c = C(cid);
  if (!c.alive || !inWar(cid)) return;
  const mine = c._provs && c._provs.length ? c._provs : countryProvs(cid);
  if (!mine.length) return;
  let tot = 0, held = 0;
  for (const p of mine) { const v = provValue(p); tot += v; if (p.controller === cid) held += v; }
  const capLost = G.provs[c.capital] && G.provs[c.capital].controller !== cid;
  if (held / tot < (capLost ? 0.5 : 0.25)) capitulate(c);
}
function capitulate(c) {
  for (const w of G.wars.filter(w => w.att.includes(c.id) || w.def.includes(c.id))) {
    if (w.cap.includes(c.id)) continue;
    w.cap.push(c.id);
    note('world', `${c.name} has capitulated!`, c.capital, null);
    for (const d of G.divs.filter(d => d.owner === c.id)) G.divs = G.divs.filter(x => x !== d);
    const side = w.att.includes(c.id) ? w.att : w.def;
    if (side.every(x => w.cap.includes(x) || !C(x).alive)) concludeWarByCapitulation(w, side === w.att ? 'def' : 'att');
  }
}
function concludeWarByCapitulation(w, winnerSide) {
  const winners = winnerSide === 'att' ? w.att : w.def, losers = winnerSide === 'att' ? w.def : w.att;
  // a human war leader dictates the terms; otherwise the victors annex what they hold
  if (isHuman(winners[0])) {
    w.capitulated = true;
    popupFor(winners[0], 'Victory', 'The enemy has capitulated. Dictate the terms at the peace conference.', [{ label: 'Open peace conference', fn: () => UIHooks.peaceConference(w), ui: ['peace', w.id] }], true);
    for (const h of winners.slice(1)) if (isHuman(h)) popupFor(h, 'Victory', 'The enemy has capitulated. Your war leader will dictate the peace.');
    return;
  }
  for (const h of winners) if (isHuman(h)) popupFor(h, 'Victory', 'The enemy has capitulated and your side has won the war.');
  autoPeace(w, winnerSide);
}
// Victors annex what they occupy (AI-dictated peace)
function autoPeace(w, winnerSide) {
  if (!G.wars.includes(w)) return;
  const winners = winnerSide === 'att' ? w.att : w.def, losers = winnerSide === 'att' ? w.def : w.att;
  const transfers = [];
  for (const p of G.provs) if (losers.includes(p.owner) && winners.includes(p.controller)) transfers.push({ prov: p.id, to: p.controller });
  // the war leader always collects its war goal provinces
  const lostBy = {}; for (const t of transfers) { const o = G.provs[t.prov].owner; lostBy[o] = (lostBy[o] || 0) + 1; }
  makePeace(w, { transfers, reparations: [] });
  for (const h of losers) if (isHuman(h)) popupFor(h, 'Defeat', `${C(winners[0]).name} has imposed peace. You lost ${lostBy[h] || 0} provinces.`, null, true);
}

// ------------------------------------------------------------
// Nuclear weapons
// ------------------------------------------------------------
// Blast strength k: 1 at ground zero, less in the surrounding provinces
function detonate(p, k) {
  p.pop = Math.max(300, Math.round(p.pop * (1 - 0.7 * k)));
  for (const b of p.buildings) b.hp = Math.max(0, b.hp - 100 * k * (0.75 + Math.random() * 0.5));
  for (const g of p.segs) g.hp = Math.max(0, g.hp - 90 * k * (0.75 + Math.random() * 0.5));
  for (const d of G.divs.filter(x => x.prov === p.id || x.attacking === p.id)) {
    d.str *= 1 - 0.85 * k; d.org *= 1 - k;
    if (d.str < 0.05) destroyDivision(d, `by the nuclear blast at ${p.name}`);
  }
  p.unrest = Math.min(100, (p.unrest || 0) + 40 * k);
  markDirty(p);
}
function launchNuke(c, p) {
  if (!p) return 'Select a province to strike.';
  if ((c.equip.nukes || 0) < 1) return 'You have no nuclear weapons. Research Nuclear Fission and build them in Production.';
  const victim = atWar(c.id, p.controller) ? p.controller : atWar(c.id, p.owner) ? p.owner : -1;
  if (victim < 0) return 'You can only strike a country you are at war with.';
  c.equip.nukes -= 1;
  detonate(p, 1);
  for (const n of p.neighbors) detonate(G.provs[n], 0.35);
  p.fallout = G.day + 730;
  // the world recoils: every nation's opinion falls, your own people are shaken, the victim's will to fight breaks
  for (const o of G.countries) if (o.alive && o.id !== c.id) relAdd(o.id, c.id, o.id === victim ? -100 : -40);
  c.stability = Math.max(0, c.stability - 10);
  const v = C(victim); v.warEx = Math.min(100, v.warEx + 25); v.stability = Math.max(0, v.stability - 15);
  (G.blasts = G.blasts || []).push({ prov: p.id, t: typeof performance !== 'undefined' ? performance.now() : 0 });
  G.mapUrgent = true;
  note('world', `NUCLEAR STRIKE: ${c.name} has destroyed ${p.name} in ${v.name} with a nuclear weapon.`, p.id);
  if (isHuman(victim) && victim !== c.id) popupFor(victim, 'Nuclear Attack', `${c.name} has struck ${p.name} with a nuclear weapon. The city lies in ruins, the surrounding provinces are damaged, and fallout will poison the land for two years.`, null, true);
  return null;
}

// ------------------------------------------------------------
// War & peace
// ------------------------------------------------------------
function declareWar(a, b, reason, silent) {
  if (atWar(a, b)) return 'Already at war';
  const ca = C(a), cb = C(b);
  const att = [a], def = [b], neutral = [];
  // Nations bound to both sides (allied with the attacker, but also pledged to the defender) stay out
  // unless they genuinely prefer the defender — a best friend never turns on you over a second treaty.
  const friendsA = militaryOrgPartners(a);
  for (const t of G.diplo.treaties) if (t.type === 'alliance' && (t.a === a || t.b === a)) friendsA.add(t.a === a ? t.b : t.a);
  for (const c of G.countries) { if (c.overlord === a) friendsA.add(c.id); }
  if (ca.overlord >= 0) friendsA.add(ca.overlord);
  const conflicted = x => (friendsA.has(x) || rel(x, a) >= 75) && rel(x, a) >= rel(x, b) && x !== cb.overlord && C(x).overlord !== b;
  const addDef = x => {
    if (def.includes(x) || att.includes(x) || !C(x).alive) return;
    if (conflicted(x)) { if (!neutral.includes(x)) neutral.push(x); return; }
    def.push(x);
  };
  const addAtt = x => { if (!att.includes(x) && !def.includes(x) && C(x).alive) att.push(x); };
  for (const t of G.diplo.treaties) {
    if ((t.type === 'alliance' || t.type === 'defensive') && (t.a === b || t.b === b)) addDef(t.a === b ? t.b : t.a);
    if (t.type === 'guarantee' && t.b === b) addDef(t.a);
  }
  for (const c of G.countries) { if (c.alive && c.overlord === b) addDef(c.id); if (c.alive && c.overlord === a) addAtt(c.id); }
  for (const m of militaryOrgPartners(b)) if (!militaryOrgPartners(a).has(m) || m === b) addDef(m);
  if (cb.overlord >= 0) addDef(cb.overlord);
  for (const t of G.diplo.treaties) if (t.type === 'alliance' && (t.a === a || t.b === a)) {
    const x = t.a === a ? t.b : t.a;
    if (def.includes(x) || neutral.includes(x)) continue;
    if (isHuman(x)) { addAtt(x); continue; }
    if (rel(x, a) > 20 && !hasTreaty('nap', x, b)) addAtt(x);
  }
  // A player who is called in by a defender joins automatically (they are notified)
  for (const t of [...G.diplo.treaties]) {
    for (const x of att) for (const y of def) if (t.a === x && t.b === y || t.a === y && t.b === x) if (['alliance', 'nap', 'access', 'trade', 'defensive'].includes(t.type)) removeTreaty(t.type, x, y);
  }
  for (const x of att) for (const y of def) relAdd(x, y, -60);
  const hadGoal = ca.wargoals.includes(b);
  ca.wargoals = ca.wargoals.filter(x => x !== b);
  if (!hadGoal && reason !== 'Rebellion') {
    ca.stability = Math.max(0, ca.stability - 12);
    for (const c of G.countries) if (c.alive && c.id !== a && !def.includes(c.id)) relAdd(c.id, a, friendsA.has(c.id) ? -3 : -12);
  }
  const w = { id: nid(), name: `${ca.adj} – ${cb.adj} War`, att, def, start: G.day, reason: reason || 'Conquest', cap: [], goal: hadGoal };
  G.wars.push(w);
  ca.lastWar = G.day; cb.lastWar = G.day;
  note('world', `${ca.name} has declared war on ${cb.name}${reason ? ' (' + reason + ')' : ''}.`, cb.capital);
  if (neutral.length) noteAll([a, b], 'diplo', `${neutral.map(x => C(x).name).join(', ')} ${neutral.length > 1 ? 'are' : 'is'} bound to both sides and will stay neutral.`);
  if (!silent) for (const h of [...att, ...def]) {
    if (h === a || !isHuman(h)) continue;
    popupFor(h, 'War!', `${ca.name} has declared war on ${cb.name} over ${reason || 'territorial ambitions'}. ${def.includes(h) ? 'You are on the defending side.' : 'You have joined the attack as their ally.'}\n\nAttackers: ${att.map(x => C(x).name).join(', ')}\nDefenders: ${def.map(x => C(x).name).join(', ')}`, null, true);
  }
  G.mapDirty = true;
  return null;
}
function warScore(w, side) {
  const enemies = side === 'att' ? w.def : w.att, mine = side === 'att' ? w.att : w.def;
  let enemyTot = 0, taken = 0, lost = 0, mineTot = 0;
  for (const p of G.provs) {
    if (enemies.includes(p.owner)) { const v = provValue(p); enemyTot += v; if (mine.includes(p.controller)) taken += v; }
    if (mine.includes(p.owner)) { const v = provValue(p); mineTot += v; if (enemies.includes(p.controller)) lost += v; }
  }
  let s = (taken / Math.max(1, enemyTot) - lost / Math.max(1, mineTot)) * 120;
  if (enemies.every(x => w.cap.includes(x))) s = 100;
  if (mine.every(x => w.cap.includes(x))) s = -100;
  const days = G.day - w.start;
  return clamp(Math.round(s), -100, 100) + (days > 365 ? 0 : 0);
}
function provDemandCost(w, side, p) {
  const enemies = side === 'att' ? w.def : w.att;
  let tot = 0; for (const q of G.provs) if (enemies.includes(q.owner)) tot += provValue(q);
  const base = provValue(p) / Math.max(1, tot) * 100;
  const occupied = (side === 'att' ? w.att : w.def).includes(p.controller);
  return Math.max(1, Math.round(base * (occupied ? 0.8 : 1.6)));
}
function makePeace(w, terms) {
  const involved = [...w.att, ...w.def];
  for (const t of terms.transfers || []) {
    const p = G.provs[t.prov];
    const from = p.owner;
    if (p.controller !== t.to) flashProvince(p, t.to);
    p.owner = t.to; p.controller = t.to; p.siege = null; markDirty(p);
    if (C(from) && C(from).capital === p.id) relocateCapital(C(from));
    for (const d of G.divs) if (d.prov === p.id && d.owner !== t.to && !allied(d.owner, t.to)) sendHome(d);
  }
  for (const r of terms.reparations || []) { const amt = Math.min(C(r.from).treasury > 0 ? C(r.from).treasury * 0.5 : 0, r.amount) + r.amount * 0.5; C(r.from).treasury -= amt; C(r.to).treasury += amt; }
  for (const pp of terms.puppets || []) { C(pp.sub).overlord = pp.over; note('world', `${C(pp.sub).name} has become a subject of ${C(pp.over).name}.`); }
  for (const rl of terms.release || []) releaseNation(rl.provs, rl.name, rl.over);
  G.wars = G.wars.filter(x => x !== w);
  G.battles = G.battles.filter(b => !involved.includes(b.att) || !involved.includes(b.def));
  for (const p of G.provs) if (involved.includes(p.owner) && p.controller !== p.owner && involved.includes(p.controller) && !atWar(p.owner, p.controller)) { p.controller = p.owner; p.siege = null; markDirty(p); }
  for (const d of G.divs) if (involved.includes(d.owner)) {
    if (d.state === 'battle' || d.state === 'siege') leaveAttack(d);
    const P = G.provs[d.prov];
    if (P.controller !== d.owner && !allied(d.owner, P.controller) && !hasAccess(d.owner, P.controller)) sendHome(d);
    d.path = d.path.filter(x => canEnter(d.owner, G.provs[x]));
  }
  for (const a of w.att) for (const b of w.def) { G.diplo.truces[pairKey(a, b)] = G.day + 730; relAdd(a, b, 20); }
  for (const c of G.countries) if (c.alive && !G.provs.some(p => p.owner === c.id)) killCountry(c);
  note('world', `Peace has been signed, ending the ${w.name}.`);
  updateCountryAggregates();
  G.mapDirty = true;
}
function sendHome(d) {
  const c = C(d.owner);
  const home = G.provs[c.capital] && G.provs[c.capital].owner === c.id ? c.capital : (c._provs && c._provs[0] ? c._provs[0].id : null);
  if (home == null) { G.divs = G.divs.filter(x => x !== d); return; }
  d.prov = home; d.path = []; d.state = 'idle'; d.prog = 0; d.attacking = null;
}
function relocateCapital(c) {
  const mine = G.provs.filter(p => p.owner === c.id && p.controller === c.id);
  if (!mine.length) return;
  mine.sort((a, b) => b.pop - a.pop);
  c.capital = mine[0].id;
}
function killCountry(c) {
  c.alive = false;
  G.divs = G.divs.filter(d => d.owner !== c.id);
  G.diplo.treaties = G.diplo.treaties.filter(t => t.a !== c.id && t.b !== c.id);
  for (const w of G.wars) { w.att = w.att.filter(x => x !== c.id); w.def = w.def.filter(x => x !== c.id); }
  G.wars = G.wars.filter(w => w.att.length && w.def.length);
  for (const s of G.countries) if (s.overlord === c.id) s.overlord = -1;
  for (const o of [...(G.orgs || [])]) if (o.members.includes(c.id)) removeFromOrg(o, c.id);
  note('world', `${c.name} has ceased to exist.`);
  if (c.id === G.player && window.UIHooks) UIHooks.gameOver();
}
function releaseNation(provIds, name, over) {
  const first = G.provs[provIds[0]];
  const cult = first.culture;
  const nm = name || ('Free ' + (cult.endsWith('ian') ? cult.slice(0, -3) + 'ia' : first.name));
  const prev = G.countries.find(c => !c.alive && c.culture === cult);
  let c;
  if (prev) { c = prev; c.alive = true; c.capital = first.id; }
  else c = newCountry({ name: nm, adj: cult, color: hsl2rgb(Math.random() * 360, 0.4, 0.5), gov: 'republic', culture: cult, religion: first.religion, personality: 'neutral', capital: first.id, leader: pick(Math.random, LEADER_FIRST) + ' ' + genName(Math.random) });
  const src = C(first.owner);
  c.techs = [...(src ? src.techs : (C(over) || G.countries.find(x => x.alive)).techs)]; c.era = countryEra(c); c.templates = []; setupTemplates(c);
  c.treasury = 150; c.manpower = 10000;
  for (const id of provIds) { const p = G.provs[id]; p.owner = p.controller = c.id; markDirty(p); for (const d of G.divs) if (d.prov === id) sendHome(d); }
  if (over != null && over >= 0) c.overlord = over;
  for (const o of G.countries) if (o.id !== c.id && G.diplo.rel[pairKey(c.id, o.id)] == null) G.diplo.rel[pairKey(c.id, o.id)] = 0;
  if (over != null && over >= 0) relAdd(c.id, over, 60);
  note('world', `${c.name} has been established.`, first.id);
  updateCountryAggregates();
  return c;
}

// ------------------------------------------------------------
// Main daily tick
// ------------------------------------------------------------
function dailyTick() {
  G.day++;
  const date = dateOf(G.day);
  updateCountryAggregates();
  for (const c of G.countries) { c._armyMp = 0; c._upkeep = 0; }
  for (const d of G.divs) { const o = C(d.owner); o._armyMp += d.st.mp * d.str; o._upkeep += 0.08 + d.bats.length * 0.03; }
  // per-day lookups so each nation's economy does not rescan every treaty and subject
  G._tradeBy = new Map(); G._subjInc = new Map();
  for (const t of G.diplo.treaties) if (t.type === 'trade') {
    if (!G._tradeBy.has(t.a)) G._tradeBy.set(t.a, []); if (!G._tradeBy.has(t.b)) G._tradeBy.set(t.b, []);
    G._tradeBy.get(t.a).push(t.b); G._tradeBy.get(t.b).push(t.a);
  }
  for (const s of G.countries) if (s.alive && s.overlord >= 0) G._subjInc.set(s.overlord, (G._subjInc.get(s.overlord) || 0) + (s.income || 0));
  if (G.day % 7 === 0) tickWeather();
  computeOrgFx();
  computeSupply();
  for (const c of G.countries) {
    if (!c.alive) continue;
    if (!c._provs.length) { killCountry(c); continue; }
    const bonus = techBonus(c);
    c._bonus = bonus;
    tickEconomy(c, bonus);
    tickConstruction(c, c.agg, bonus);
    tickProduction(c, bonus);
    if (G.day % 30 === c.id % 30) { tickMonthlyCountry(c, bonus); if (c.ai) { aiMonthly(c); aiOrgs(c); } }
    if (c.ai && G.day % 3 === c.id % 3) aiMilitary(c);
  }
  reinforce();
  if (G.day % 2 === 0) tickPlayerAuto();
  tickMovement();
  tickBattles();
  tickSieges();
  if (G.day % 30 === 0) monthlyWorld();
  if (date.d === 1 && date.m === 0 && G.settings.autosave && G.day > 5) { saveGame('autosave'); }
  G.mapDirty = true;
}
function reinforce() {
  for (const d of G.divs) {
    if (d.state === 'training' || d.state === 'battle' || !d.supplied || d.str >= 1) continue;
    const c = C(d.owner);
    const delta = Math.min(0.02, 1 - d.str);
    const mp = d.st.mp * delta;
    if (c.manpower < mp) continue;
    let ok = true;
    for (const e in d.st.eq) { if (e === 'tank') { const k = 'tank:' + d.tank; if ((c.equip[k] || 0) < d.st.eq.tank * delta) ok = false; } else if ((c.equip[e] || 0) < d.st.eq[e] * delta) ok = false; }
    if (!ok) continue;
    c.manpower -= mp;
    for (const e in d.st.eq) { if (e === 'tank') c.equip['tank:' + d.tank] -= d.st.eq.tank * delta; else c.equip[e] -= d.st.eq[e] * delta; }
    d.str += delta;
  }
}
function monthlyWorld() {
  // market price drift
  for (const r in G.prices) G.prices[r] = clamp(G.prices[r] * (0.97 + Math.random() * 0.06), RES_PRICE[r] * 0.6, RES_PRICE[r] * 2);
  // relations slowly drift toward baseline
  for (const k in G.diplo.rel) G.diplo.rel[k] *= 0.995;
  // support-independence campaigns
  for (const c of G.countries) if (c.alive && c.support) {
    const p = G.provs[c.support.prov];
    if (!p || p.owner === c.id || c.pp < 5) { c.support = null; continue; }
    c.pp -= 5; c.treasury -= 10 * (1 + c.era); p.unrest = Math.min(100, (p.unrest || 0) + 8);
  }
  // AI peace between AIs
  for (const w of [...G.wars]) aiWarEvaluation(w);
  for (const p of G.provs) if (p.fallout && p.fallout <= G.day) { p.fallout = 0; markDirty(p); }
  tickOrgsMonthly();
}

// ------------------------------------------------------------
// Save / Load
// ------------------------------------------------------------
const r1 = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100, r3 = v => Math.round(v * 1000) / 1000;
const PROV_SAVE = ['name', 'state', 'owner', 'controller', 'pop', 'culture', 'religion', 'dep', 'fert', 'seed', 'buildings', 'segs', 'town', 'growth', 'unrest', 'baseHousing', 'terrain', 'siege', 'core', 'support', 'fallout'];
function serialize() {
  const countries = G.countries.map(c => { const o = Object.assign({}, c); delete o._provs; delete o._supply; delete o._bonus; delete o.agg; return o; });
  return JSON.stringify({
    v: G.version, seed: G.seed, mapType: G.mapType, histYear: G.histYear || null, era: G.era, startYear: G.startYear, day: G.day, player: G.player, nextId: G.nextId,
    prices: G.prices, weather: G.weather, states: G.states.map(s => ({ id: s.id, name: s.name, provs: s.provs })),
    provs: G.provs.map(p => {
      const o = {}; for (const k of PROV_SAVE) o[k] = p[k];
      // compact form: buildings and line structures as short arrays
      o.buildings = p.buildings.map(b => [b.id, b.t, r1(b.x), r1(b.z), r2(b.r || 0), b.lvl, r3(b.prog), Math.round(b.hp), b.upg == null ? -1 : r3(b.upg), b.rep == null ? -1 : r3(b.rep), b.organic ? 1 : 0]);
      o.segs = p.segs.map(g => [g.id, g.t, r1(g.x1), r1(g.z1), r1(g.x2), r1(g.z2), r3(g.prog), Math.round(g.hp), g.rep ? 1 : 0]);
      return o;
    }),
    orgs: G.orgs || [], countries, divs: G.divs.map(d => { const o = Object.assign({}, d); delete o.st; delete o._vp; delete o._vpProv; return o; }), battles: G.battles, wars: G.wars, diplo: G.diplo, notes: G.notes.slice(0, 40), settings: G.settings,
    editor: !!G.editorMode, scenarioName: G.scenarioName || null,
  }, (k, v) => typeof v === 'number' && !Number.isInteger(v) ? Math.round(v * 1000) / 1000 : v);
}
function deserialize(json) {
  const s = typeof json === 'string' ? JSON.parse(json) : json;
  G.geo = generateGeometry(s.seed, s.mapType, s.histYear || null);
  G.histYear = s.histYear || null; G._coastals = null;
  G.seed = s.seed; G.mapType = s.mapType; G.era = s.era; G.startYear = s.startYear; G.day = s.day; G.player = s.player; G.nextId = s.nextId;
  G.prices = s.prices; G.weather = s.weather || []; G.states = s.states;
  G.provs = G.geo.provs.map((g, i) => {
    const p = Object.assign(g, s.provs[i], { dirty: true, cache: null });
    p.buildings = p.buildings.map(b => Array.isArray(b) ? { id: b[0], t: b[1], x: b[2], z: b[3], r: b[4], lvl: b[5], prog: b[6], hp: b[7], upg: b[8] < 0 ? null : b[8], rep: b[9] < 0 ? null : b[9], organic: !!b[10] } : b);
    p.segs = p.segs.map(g2 => Array.isArray(g2) ? { id: g2[0], t: g2[1], x1: g2[2], z1: g2[3], x2: g2[4], z2: g2[5], prog: g2[6], hp: g2[7], rep: !!g2[8] } : g2);
    return p;
  });
  G.countries = s.countries.map(c => Object.assign({ agg: {}, _provs: [] }, c));
  G.divs = s.divs; G.battles = s.battles; G.orgs = s.orgs || [];
  for (const d of G.divs) if (!d.st) d.st = divStats(C(d.owner), d.bats, d.tank); G.wars = s.wars; G.diplo = s.diplo; G.notes = s.notes || [];
  Object.assign(G.settings, s.settings || {});
  G.scenarioName = s.scenarioName || null;
  G.popups = [];
  if (!G.weather.length) initWeather();
  updateCountryAggregates();
  G.mapDirty = true;
  return s;
}
function storageGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function storageSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
function storageDel(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }
function saveIndex() { try { return JSON.parse(storageGet('cop_saves') || '[]'); } catch (e) { return []; } }
function saveGame(slot, label) {
  const data = serialize();
  const ok = storageSet('cop_save_' + slot, data);
  if (!ok) { note('event', 'Saving failed: browser storage is unavailable or full. Use Export to copy the save instead.'); return false; }
  const idx = saveIndex().filter(x => x.slot !== slot);
  const c = C(G.player);
  idx.unshift({ slot, label: label || slot, country: c ? c.name : 'Editor', date: dateStr(G.day), real: Date.now(), editor: !!G.editorMode });
  storageSet('cop_saves', JSON.stringify(idx.slice(0, 20)));
  if (slot !== 'autosave') note('event', `Game saved (${label || slot}).`);
  return true;
}
function loadGame(slot) { const d = storageGet('cop_save_' + slot); if (!d) return false; deserialize(d); return true; }
