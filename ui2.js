// ============================================================
// WAR OF NATIONS — UI screens: menu, setup, creator, flag editor, designers,
// peace conference, map editor, province & battle overlays, boot
// ============================================================
'use strict';

function setPhase(ph) {
  UI.phase = ph;
  document.body.dataset.phase = ph;
  $('#menu').hidden = ph !== 'menu';
  $('#hud').hidden = !['game', 'province', 'battle'].includes(ph);
  $('#pickui').hidden = ph !== 'pick';
  $('#editorui').hidden = ph !== 'editor';
  $('#provui').hidden = ph !== 'province';
  $('#battleui').hidden = ph !== 'battle';
  $('#p3wrap').hidden = !(ph === 'province' || ph === 'battle');
  $('#map').hidden = ph === 'province' || ph === 'battle';
  if (ph !== 'game') closePanel();
}
function fade(fn) {
  const f = $('#fade'); f.classList.add('on');
  setTimeout(() => { fn(); setTimeout(() => f.classList.remove('on'), 60); }, 380);
}
function loading(text, fn) {
  const l = $('#loading'); l.querySelector('span').textContent = text; l.hidden = false;
  setTimeout(() => { try { fn(); } finally { l.hidden = true; } }, 40);
}

// ---------- main menu ----------
const SCENARIOS = [
  { name: 'Europe 1938', era: 3, mapType: 'europe', borders: '1938', n: 0, seed: 1936, text: 'Europe\'s 1938 borders on the eve of a world war: Czechoslovakia, Yugoslavia, the USSR.' },
  { name: 'Europe 1200', era: 0, mapType: 'europe', borders: '1200', n: 0, seed: 1066, text: 'The Holy Roman Empire, the Byzantines and the Angevin Empire. Castles, knights and sieges.' },
  { name: 'Age of Discovery', era: 1, mapType: 'world', borders: '1530', n: 0, seed: 1530, text: 'The world in 1530: the Ottomans, the Ming, the Inca, and New Spain.' },
  { name: 'Congress of Vienna', era: 2, mapType: 'europe', borders: '1815', n: 0, seed: 1815, text: 'Europe redrawn after Napoleon: Prussia, the Austrian Empire and dozens of German states.' },
  { name: 'World War', era: 3, mapType: 'world', borders: '1938', n: 0, seed: 1939, text: 'The whole world in 1938, colonial empires included.' },
  { name: 'Modern World', era: 4, mapType: 'world', borders: 'modern', n: 0, seed: 2025, text: 'Today\'s countries with main battle tanks, jets and missiles.' },
  { name: 'Twelve Crowns', era: 0, mapType: 'continents', n: 12, seed: 1066, text: 'Feudal kingdoms on rival continents. Castles, knights and siege warfare.' },
  { name: 'Age of Sail', era: 1, mapType: 'archipelago', n: 22, seed: 1588, text: 'Gunpowder empires across a scattered archipelago. Harbors and fleets decide everything.' },
  { name: 'Iron & Steam', era: 2, mapType: 'pangaea', n: 18, seed: 1848, text: 'One great landmass, railways, factories and mass armies.' },
  { name: 'The Great War', era: 3, mapType: 'continents', n: 20, seed: 1914, text: 'Tanks, aircraft and industrial war between alliance blocs.' },
  { name: 'Cold Steel', era: 4, mapType: 'continents', n: 16, seed: 1983, text: 'Modern superpowers with main battle tanks and jets.' },
  { name: 'Starfall', era: 5, mapType: 'pangaea', n: 14, seed: 2077, text: 'Fusion reactors, hover tanks and exo-infantry.' },
];
function showMenu() {
  setPhase('menu');
  if (!G.geo) buildWorld({ seed: 4242, mapType: 'europe', nCountries: 18, era: 3, borders: '1938' });
  V.mode = 'political'; V.scale = Math.max(minScale(), 1.1); V.cx = MW / 2; V.cy = MH / 2; V.sel = -1; G.mapDirty = true;
  const hasSave = saveIndex().length > 0;
  $('#menu').innerHTML = `<div class="menu-card">
    <div class="crest">${icon('pp')}</div>
    <h1>War Of Nations</h1><p class="sub">Grand Strategy</p>
    <nav class="mbtns">
      <button class="mbtn" data-act2="newgame">New Game</button>
      <button class="mbtn" data-act2="continue" ${hasSave ? '' : 'disabled'}>Continue Game</button>
      <button class="mbtn" data-act2="create">Create Country</button>
      <button class="mbtn" data-act2="scenarios">Load Scenario</button>
      <button class="mbtn" data-act2="multiplayer">Multiplayer</button>
      <button class="mbtn" data-act2="mapeditor">Map Editor</button>
      <button class="mbtn" data-act2="settings">Settings</button>
      <button class="mbtn" data-act2="exit">Exit</button>
    </nav>
    <p class="fine">From the first village to armored armies. Worlds are generated from a seed.</p></div>`;
}
function setupDialog(mode, preset) {
  const pr = Object.assign({ n: 18 }, preset || { seed: Math.floor(Math.random() * 99999), mapType: 'europe', era: 3 });
  if (!pr.n) pr.n = 18;
  const html = `<div class="form">
    <label>World seed<span class="inrow"><input type="number" id="s-seed" value="${pr.seed}"><button class="btn sm" id="s-rand" type="button">Random</button></span></label>
    <label>World map<select id="s-map"><optgroup label="Real world"><option value="europe">Europe — real countries</option><option value="world">The World — real countries</option></optgroup><optgroup label="Fictional"><option value="continents">Fictional continents</option><option value="pangaea">Pangaea supercontinent</option><option value="archipelago">Archipelago</option></optgroup></select></label>
    <label id="s-nwrap">Nations <output id="s-nout">${pr.n}</output><input type="range" id="s-n" min="6" max="36" value="${pr.n}"></label>
    <label id="s-bwrap">Borders<select id="s-borders"><option value="auto">Historical — matching the starting era</option>${HIST_YEARS.map(y => `<option value="${y}">Historical — ${y}</option>`).join('')}<option value="modern">Today's borders</option></select></label>
    <p class="muted" id="s-realnote" hidden>Every state on a real map is playable and flies its real flag. Land no state claimed in that year is open for colonization.</p>
    <label>Starting era<select id="s-era">${ERAS.map(e => `<option value="${e.id}">${e.name} (${e.year})</option>`).join('')}</select></label>
    <p class="muted">${mode === 'create' ? 'After the world is generated you will design your nation and choose its capital.' : mode === 'editor' ? 'The world opens in the map editor.' : 'After the world is generated, pick a nation to lead.'}</p></div>`;
  const m = modal(mode === 'editor' ? 'New map' : 'New world', html, [
    { label: 'Generate world', fn: () => { const p = { seed: +$('#s-seed').value || 1, mapType: $('#s-map').value, nCountries: +$('#s-n').value, era: +$('#s-era').value, borders: $('#s-borders').value }; loading('Shaping continents…', () => { buildWorld(p); afterGenerate(mode); }); } },
    { label: 'Cancel' }]);
  m.querySelector('#s-map').value = pr.mapType; m.querySelector('#s-era').value = pr.era; m.querySelector('#s-borders').value = pr.borders || 'auto';
  const syncReal = () => { const r = isRealMap(m.querySelector('#s-map').value); m.querySelector('#s-nwrap').hidden = r; m.querySelector('#s-realnote').hidden = !r; m.querySelector('#s-bwrap').hidden = !r; };
  m.querySelector('#s-map').onchange = syncReal; syncReal();
  m.querySelector('#s-rand').onclick = () => { m.querySelector('#s-seed').value = Math.floor(Math.random() * 99999); };
  m.querySelector('#s-n').oninput = e => { m.querySelector('#s-nout').textContent = e.target.value; };
}
function afterGenerate(mode) {
  G.editorMode = false; G.scenarioName = null;
  fitView();
  if (mode === 'editor') return startEditor(false);
  if (mode === 'create') { enterPick('choose'); openCreator(); return; }
  NET.pendingHost = mode === 'host';
  enterPick('choose');
}
function fitView() { V.scale = minScale(); V.cx = MW / 2; V.cy = MH / 2; V.sel = -1; G.mapDirty = true; UI.lastMap = 0; labelsKey = ''; }

// ---------- choose / create nation ----------
function enterPick(kind) {
  UI.pick = { kind, spec: UI.pick && UI.pick.spec };
  setPhase('pick'); V.mode = 'political'; G.paused = true; renderPick();
}
function pickPhaseSelect() { renderPick(); }
function renderPick() {
  const p = G.provs[V.sel];
  const k = UI.pick.kind;
  let html = '';
  if (k === 'capital') {
    html = `<h2>Choose your capital</h2><p>Click any province. ${esc(UI.pick.spec.name)} will form around it with ${UI.pick.spec.size} provinces, taking land from whoever holds it now.</p>`;
    if (p) html += `<div class="card"><b>${esc(p.name)}</b><small>${TERRAINS[p.terrain].name}${p.coastal ? ', coastal' : ''} · ${fmt(p.pop)} people · ${C(p.owner) ? 'held by ' + esc(C(p.owner).name) : 'unclaimed'}</small></div><button class="btn primary" data-act2="found">Found ${esc(UI.pick.spec.name)} here</button>`;
    html += `<button class="btn" data-act2="backcreator">Back to designer</button>`;
  } else if (k === 'mp') {
    // joining a shared game: pick any nation no other player leads
    const c = p ? C(p.owner) : null;
    html = `<h2>Choose your nation</h2><p>Click a country on the map. Nations already led by another player are marked.</p>`;
    if (c && c.alive) {
      const taken = !c.ai && c.netPeer !== NET.myPeer;
      html += `<div class="card pickc">${flagImg(c, 60, 40)}<div><b>${esc(c.name)}</b><small>${c.nProv} provinces · ${fmt(c.agg.pop)} people · ${ERAS[c.era].name}${taken ? '<br><b class="warn">Led by ' + esc(playerName(c)) + '</b>' : ''}</small></div></div>`;
      if (!taken) html += `<button class="btn primary" data-act2="mpclaim" data-id="${c.id}">Play as ${esc(c.name)}</button>`;
    }
    const humans = G.countries.filter(x => x.alive && !x.ai);
    html += `<h4>Players</h4>${humans.map(x => `<div class="mp-p">${flagImg(x, 20, 13)}<span>${esc(x.name)} <small>${esc(playerName(x))}</small></span></div>`).join('')}
      <button class="btn" data-act2="mpleave">Leave game</button>`;
  } else {
    const c = p ? C(p.owner) : null;
    html = `<h2>Choose your nation</h2><p>Click a country on the map, or design your own.</p>`;
    if (c) {
      html += `<div class="card pickc">${flagImg(c, 60, 40)}<div><b>${esc(c.name)}</b><small>${esc(GOVERNMENTS[c.gov].name)} · ${esc(c.ideology)}<br>${c.nProv} provinces · ${fmt(c.agg.pop)} people · ${ERAS[c.era].name}<br>${esc(PERSONALITIES[c.personality].name)} in temperament</small></div></div>
        <button class="btn primary" data-act2="playas" data-id="${c.id}">Play as ${esc(c.name)}</button>`;
    }
    html += `<button class="btn" data-act2="create2">Create a new country</button><button class="btn" data-act2="tomenu">Main menu</button>`;
  }
  $('#pickui').innerHTML = html;
}
function startGame(cid, quiet) {
  G.player = cid;
  const c = C(cid); c.ai = false;
  setPhase('game'); buildHUD();
  UI.selDivs.clear(); V.sel = c.capital;
  const cap = G.provs[c.capital];
  V.cx = cap.cx; V.cy = cap.cy; V.scale = 2.4; G.mapDirty = true; labelsKey = '';
  updateCountryAggregates();
  G.paused = true;
  refreshTop(); renderNotes(); renderBottom();
  if (NET.pendingHost) { NET.pendingHost = false; netHostStart(); }
  if (!quiet) popup(`${c.name}, ${dateStr(G.day)}`, `You lead ${c.name} in the ${ERAS[c.era].name}.\n\n• Double-click a province (or press Enter province) to build villages, farms, roads, walls and castles in 3D.\n• Research new technologies to advance through the eras.\n• Build military factories and assign production lines, then train divisions at Barracks.\n• Select divisions and right-click a province to move or attack.\n• Use Diplomacy to make allies, justify war goals and negotiate peace.\n\nThe game is paused. Press Space or a speed button to start time.`);
  showNextPopup();
}

// ---------- country creator ----------
function openCreator() {
  const sp = UI.pick.spec || {
    name: genName(Math.random, 'country'), color: '#8a3b2e', gov: G.era <= 1 ? 'absolute' : 'republic', ideology: 'Traditionalist', culture: '', language: '', religion: RELIGIONS[0], leader: pick(Math.random, LEADER_FIRST) + ' ' + genName(Math.random),
    size: 6, wealth: 1, tax: 15, conscription: 1, economy: 'civilian', trade: 'free', doctrine: 'balanced', anthem: 'march', attitude: 'neutral', flag: null,
  };
  if (!sp.flag) sp.flag = randomFlag(Math.random, hexToRgb(sp.color));
  UI.pick.spec = sp;
  const fe = flagEditorEl(sp.flag, f => { sp.flag = f; });
  const wrap = document.createElement('div');
  wrap.className = 'creator';
  wrap.innerHTML = `<div class="form cols">
    <label>Country name<input type="text" id="c-name" maxlength="32" value="${esc(sp.name)}"></label>
    <label>Map color<input type="color" id="c-color" value="${sp.color}"></label>
    <label>Government<select id="c-gov">${Object.entries(GOVERNMENTS).map(([k, g]) => `<option value="${k}">${g.name}</option>`).join('')}</select></label>
    <label>Ideology<select id="c-ideo">${IDEOLOGIES.map(i => `<option>${i}</option>`).join('')}</select></label>
    <label>Ruler<input type="text" id="c-leader" maxlength="40" value="${esc(sp.leader)}"></label>
    <label>National culture<input type="text" id="c-cult" maxlength="24" placeholder="e.g. ${esc(adjectiveOf(sp.name))}" value="${esc(sp.culture)}"></label>
    <label>Official language<input type="text" id="c-lang" maxlength="24" placeholder="e.g. ${esc(adjectiveOf(sp.name).replace(/ian$/, 'ic'))}" value="${esc(sp.language)}"></label>
    <label>Religion<select id="c-rel">${RELIGIONS.map(r => `<option>${r}</option>`).join('')}<option>Secular state</option></select></label>
    <label>Starting territory <output id="c-sizeo">${sp.size}</output> provinces<input type="range" id="c-size" min="1" max="18" value="${sp.size}"></label>
    <label>Starting treasury<select id="c-wealth"><option value="0.5">Poor</option><option value="1">Average</option><option value="2">Rich</option></select></label>
    <label>Tax rate <output id="c-taxo">${sp.tax}</output>%<input type="range" id="c-tax" min="5" max="40" value="${sp.tax}"></label>
    <label>Conscription law<select id="c-cons"><option value="0">Volunteers</option><option value="1">Limited</option><option value="2">Extensive</option><option value="3">Total war</option></select></label>
    <label>Economic policy<select id="c-econ"><option value="civilian">Civilian economy</option><option value="partial">Partial mobilization</option><option value="war">War economy</option></select></label>
    <label>Trade policy<select id="c-trade"><option value="free">Free trade</option><option value="export">Export focus</option><option value="closed">Closed economy</option></select></label>
    <label>Military doctrine<select id="c-doc">${Object.entries(DOCTRINES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
    <label>Stance toward neighbours<select id="c-att"><option value="peaceful">Peaceful</option><option value="neutral">Neutral</option><option value="hostile">Hostile</option></select></label>
    <label>Ceremonial music<span class="inrow"><select id="c-anthem"><option value="march">Royal march</option><option value="hymn">Solemn hymn</option><option value="fanfare">Fanfare</option></select><button class="btn sm" type="button" id="c-play">Play</button></span></label>
  </div><div class="fe-wrap"><h4>Flag</h4></div>`;
  wrap.querySelector('.fe-wrap').appendChild(fe.el);
  const sel = (id, v) => { wrap.querySelector(id).value = v; };
  sel('#c-gov', sp.gov); sel('#c-ideo', sp.ideology); sel('#c-rel', sp.religion); sel('#c-wealth', String(sp.wealth)); sel('#c-cons', String(sp.conscription)); sel('#c-econ', sp.economy); sel('#c-trade', sp.trade); sel('#c-doc', sp.doctrine); sel('#c-att', sp.attitude); sel('#c-anthem', sp.anthem);
  wrap.querySelector('#c-size').oninput = e => { wrap.querySelector('#c-sizeo').textContent = e.target.value; };
  wrap.querySelector('#c-tax').oninput = e => { wrap.querySelector('#c-taxo').textContent = e.target.value; };
  wrap.querySelector('#c-play').onclick = () => playAnthem({ style: wrap.querySelector('#c-anthem').value, seed: strHash(wrap.querySelector('#c-name').value) });
  wrap.querySelector('#c-color').oninput = e => { fe.setColor(0, e.target.value); };
  const read = () => {
    const v = id => wrap.querySelector(id).value;
    Object.assign(sp, { name: v('#c-name').trim() || 'New Realm', color: v('#c-color'), gov: v('#c-gov'), ideology: v('#c-ideo'), leader: v('#c-leader'), culture: v('#c-cult').trim(), language: v('#c-lang').trim(), religion: v('#c-rel'), size: +v('#c-size'), wealth: +v('#c-wealth'), tax: +v('#c-tax'), conscription: +v('#c-cons'), economy: v('#c-econ'), trade: v('#c-trade'), doctrine: v('#c-doc'), attitude: v('#c-att'), anthem: v('#c-anthem'), flag: fe.get() });
  };
  modal('Create your country', wrap, [{ label: 'Choose capital on the map', fn: () => { read(); if (anthemStop) playAnthem({}); UI.pick.kind = 'capital'; renderPick(); } }, { label: 'Cancel', fn: () => { UI.pick.kind = 'choose'; renderPick(); } }], { wide: true });
}
function createCustomCountry(sp, capId) {
  const rng = mulberry32(G.seed + G.countries.length * 7);
  const culture = sp.culture || adjectiveOf(sp.name);
  const c = newCountry({ name: sp.name, adj: adjectiveOf(sp.name), color: hexToRgb(sp.color), flag: sp.flag, gov: sp.gov, ideology: sp.ideology, personality: 'defensive', culture, language: sp.language || culture.replace(/ian$/, 'ic'), religion: sp.religion, leader: sp.leader, capital: capId, ai: false, doctrine: sp.doctrine, anthem: { style: sp.anthem, seed: strHash(sp.name) } });
  grantStartTechs(c, G.era);
  // carve out territory around the capital
  const take = [capId], seen = new Set([capId]);
  for (let i = 0; i < take.length && take.length < sp.size; i++) {
    const p = G.provs[take[i]];
    for (const n of p.neighbors.slice().sort(() => rng() - 0.5)) {
      if (take.length >= sp.size) break;
      if (seen.has(n)) continue; seen.add(n);
      const q = G.provs[n];
      if (C(q.owner) && C(q.owner).capital === q.id) continue;
      take.push(n);
    }
  }
  const losers = new Set();
  for (const id of take) {
    const p = G.provs[id];
    if (p.owner >= 0) losers.add(p.owner);
    if (C(p.owner) && C(p.owner).capital === id) C(p.owner).capital = -1;
    for (const d of G.divs.filter(d => d.prov === id)) sendHome(d);
    p.owner = p.controller = c.id; p.culture = culture; p.core = [c.id]; p.religion = sp.religion === 'Secular state' ? p.religion : sp.religion;
    if (!p.buildings.length) { p.pop = Math.max(p.pop, Math.round(15000 * ERAS[G.era].popMul)); p.baseHousing = Math.max(p.baseHousing, p.pop * 1.15); seedSettlement(p, rng, G.era); }
    markDirty(p);
  }
  initCountryEconomy(c, rng);
  c.treasury *= sp.wealth;
  c.laws = { conscription: sp.conscription, economy: sp.economy, trade: sp.trade, tax: sp.tax / 100 };
  const cap = G.provs[capId];
  for (const t of ['townhall', 'barracks', 'market', 'blacksmith']) if (!cap.buildings.some(b => b.t === t) && hasTech(c, BUILDINGS[t].tech)) { const pos = autoPlace(cap, t, rng); if (pos) cap.buildings.push({ id: nid(), t, x: pos.x, z: pos.z, r: pos.r, lvl: 1, prog: 1, hp: 100 }); }
  markDirty(cap);
  for (const l of losers) { const o = C(l); if (o.capital < 0 || G.provs[o.capital].owner !== l) relocateCapital(o); if (!G.provs.some(p => p.owner === l)) killCountry(o); }
  const base = sp.attitude === 'peaceful' ? 25 : sp.attitude === 'hostile' ? -35 : 0;
  updateCountryAggregates();
  for (const o of G.countries) if (o.id !== c.id && o.alive) G.diplo.rel[pairKey(c.id, o.id)] = base + Math.round((rng() - 0.5) * 30) + (losers.has(o.id) ? -30 : 0) + (o.ideology === c.ideology ? 10 : 0);
  initArmy(c, rng);
  labelsKey = '';
  return c;
}

// ---------- flag editor ----------
const FLAG_PATTERNS = { solid: 'Solid', hbi: 'Two bands ─', vbi: 'Two bands │', htri: 'Three bands ─', vtri: 'Three bands │', five: 'Five bands', stripes: 'Stripes', nordic: 'Nordic cross', cross: 'Centred cross', saltire: 'Saltire', quarter: 'Quartered', diag: 'Diagonal', diagband: 'Diagonal band', chevron: 'Chevron', triangle: 'Hoist triangle', border: 'Bordure', canton: 'Canton' };
const FLAG_EMBLEMS = ['star', 'circle', 'crescent', 'moon', 'cross', 'crown', 'sun', 'shield', 'tower', 'eagle', 'bird', 'lion', 'sword', 'fleur', 'hammer', 'anchor', 'tree', 'wheat', 'gear', 'mountain', 'wave'];
// Flag designer: start from a real flag or a pattern, stack several emblems, paint freehand or upload a picture
function flagEditorEl(flag0, onChange) {
  const f = JSON.parse(JSON.stringify(flag0));
  f.extra = f.extra || []; f.er = f.er || 0;
  const el = document.createElement('div'); el.className = 'flagedit';
  const W = 300, H = 200;
  const names = flagCodeNames();
  const realOpts = Object.keys(FLAG_SVG).filter(k => names[k]).sort((a, b) => names[a].localeCompare(names[b]));
  el.innerHTML = `<div class="fe-left"><canvas width="${W * 2}" height="${H * 2}" style="width:${W}px;height:${H}px" class="fe-cv" aria-label="Flag preview — paint on it when the brush is on"></canvas>
      <div class="inrow"><button type="button" class="btn sm fe-brush">Brush: off</button><input type="color" class="fe-bc" value="#ffffff" aria-label="Brush colour"><label>Width <input type="range" class="fe-bw" min="2" max="40" value="8"></label></div>
      <div class="inrow"><label class="btn sm fe-upl">Upload picture<input type="file" accept="image/*" class="fe-file" hidden></label><button type="button" class="btn sm fe-clear">Clear painting</button></div></div>
    <div class="fe-ctl">
      <label>Start from a real flag<select class="fe-real"><option value="">— Design my own —</option>${realOpts.map(k => `<option value="${k}">${esc(names[k])}</option>`).join('')}</select></label>
      <div class="fe-sec"><span class="fe-h">Field</span><div class="seg fe-pats">${Object.entries(FLAG_PATTERNS).map(([k, v]) => `<button type="button" class="chip" data-pat="${k}">${v}</button>`).join('')}</div>
      <div class="inrow"><label>Colours <input type="color" data-ci="0" aria-label="Colour 1"><input type="color" data-ci="1" aria-label="Colour 2"><input type="color" data-ci="2" aria-label="Colour 3"></label></div></div>
      <div class="fe-sec"><span class="fe-h">Emblems</span><div class="seg fe-layers"></div>
      <div class="seg fe-embs"><button type="button" class="chip" data-emb="none">None</button>${FLAG_EMBLEMS.map(k => `<button type="button" class="chip" data-emb="${k}">${k}</button>`).join('')}</div>
      <div class="inrow"><label>Colour <input type="color" class="fe-ec"></label><label>Size <input type="range" class="fe-es" min="5" max="110"></label><label>Turn <input type="range" class="fe-er" min="-180" max="180"></label></div>
      <div class="inrow"><label>Across <input type="range" class="fe-ex" min="2" max="98"></label><label>Down <input type="range" class="fe-ey" min="2" max="98"></label></div></div>
    </div>`;
  const cv = el.querySelector('.fe-cv'), ctx = cv.getContext('2d');
  const layer = document.createElement('canvas'); layer.width = W * 2; layer.height = H * 2;
  const lctx = layer.getContext('2d');
  if (f.layer) { const img = new Image(); img.onload = () => { lctx.drawImage(img, 0, 0, layer.width, layer.height); draw(); }; img.src = f.layer; }
  let brush = false, painting = false, cur = 0;
  // emblem 0 is stored on the flag itself, the rest in f.extra
  const getE = i => i === 0 ? { emb: f.emb, ec: f.ec, es: f.es, ex: f.ex, ey: f.ey, er: f.er } : f.extra[i - 1];
  const setE = (k, v) => { if (cur === 0) f[k] = v; else f.extra[cur - 1][k] = v; };
  const syncEmb = () => {
    const e = getE(cur);
    el.querySelector('.fe-ec').value = e.ec; el.querySelector('.fe-es').value = e.es * 100; el.querySelector('.fe-er').value = e.er || 0;
    el.querySelector('.fe-ex').value = e.ex * 100; el.querySelector('.fe-ey').value = e.ey * 100;
    const n = 1 + f.extra.length;
    el.querySelector('.fe-layers').innerHTML = Array.from({ length: n }, (_, i) => `<button type="button" class="chip ${i === cur ? 'on' : ''}" data-layer="${i}">Emblem ${i + 1}</button>`).join('') +
      (n < 6 ? '<button type="button" class="chip" data-addl>+ Add</button>' : '') + (cur > 0 ? '<button type="button" class="chip" data-dell>Remove</button>' : '');
    el.querySelectorAll('[data-layer]').forEach(b => b.onclick = () => { cur = +b.dataset.layer; syncEmb(); draw(); });
    const add = el.querySelector('[data-addl]'); if (add) add.onclick = () => { f.extra.push({ emb: 'star', ec: '#ffffff', es: 0.2, ex: 0.25 + 0.1 * f.extra.length, ey: 0.3, er: 0 }); cur = f.extra.length; syncEmb(); draw(); };
    const del = el.querySelector('[data-dell]'); if (del) del.onclick = () => { f.extra.splice(cur - 1, 1); cur = 0; syncEmb(); draw(); };
  };
  const draw = () => {
    ctx.clearRect(0, 0, cv.width, cv.height); drawFlag(ctx, Object.assign({}, f, { layer: null }), 0, 0, cv.width, cv.height); ctx.drawImage(layer, 0, 0);
    el.querySelectorAll('[data-pat]').forEach(b => b.classList.toggle('on', !f.svg && b.dataset.pat === f.pat));
    el.querySelectorAll('[data-emb]').forEach(b => b.classList.toggle('on', b.dataset.emb === getE(cur).emb));
    el.querySelector('.fe-pats').classList.toggle('dim', !!f.svg);
    if (onChange) onChange(api.get());
  };
  const real = el.querySelector('.fe-real');
  real.value = f.svg || '';
  real.onchange = () => { f.svg = real.value || undefined; if (f.svg) { const img = svgFlagImage(f.svg); if (!svgReady(f.svg)) img.addEventListener('load', draw, { once: true }); } draw(); };
  if (f.svg && !svgReady(f.svg)) svgFlagImage(f.svg).addEventListener('load', draw, { once: true });
  el.querySelectorAll('[data-ci]').forEach(i => { i.value = f.c[+i.dataset.ci]; i.oninput = () => { f.c[+i.dataset.ci] = i.value; draw(); }; });
  el.querySelectorAll('[data-pat]').forEach(b => b.onclick = () => { f.pat = b.dataset.pat; f.svg = undefined; real.value = ''; draw(); });
  el.querySelectorAll('[data-emb]').forEach(b => b.onclick = () => { setE('emb', b.dataset.emb); draw(); });
  const bind = (cls, key, k) => { el.querySelector(cls).oninput = e => { setE(key, k ? +e.target.value / k : e.target.value); draw(); }; };
  bind('.fe-ec', 'ec'); bind('.fe-es', 'es', 100); bind('.fe-ex', 'ex', 100); bind('.fe-ey', 'ey', 100); bind('.fe-er', 'er', 1);
  el.querySelector('.fe-brush').onclick = e => { brush = !brush; e.target.textContent = 'Brush: ' + (brush ? 'on' : 'off'); e.target.classList.toggle('on', brush); cv.style.cursor = brush ? 'crosshair' : ''; };
  el.querySelector('.fe-clear').onclick = () => { lctx.clearRect(0, 0, layer.width, layer.height); f.layer = null; draw(); };
  el.querySelector('.fe-file').onchange = e => {
    const file = e.target.files[0]; if (!file) return;
    const rd = new FileReader();
    rd.onload = () => {
      const img = new Image();
      img.onload = () => {
        // cover the whole flag, cropping the picture to 3:2
        const s = Math.max(layer.width / img.width, layer.height / img.height), w = img.width * s, h = img.height * s;
        lctx.clearRect(0, 0, layer.width, layer.height); lctx.drawImage(img, (layer.width - w) / 2, (layer.height - h) / 2, w, h);
        f.layer = layer.toDataURL('image/jpeg', 0.85); draw();
      };
      img.src = rd.result;
    };
    rd.readAsDataURL(file);
  };
  const paint = e => { const r = cv.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width * layer.width, y = (e.clientY - r.top) / r.height * layer.height; lctx.fillStyle = el.querySelector('.fe-bc').value; lctx.beginPath(); lctx.arc(x, y, +el.querySelector('.fe-bw').value, 0, 7); lctx.fill(); draw(); };
  cv.onpointerdown = e => { if (!brush) return; painting = true; cv.setPointerCapture(e.pointerId); paint(e); };
  cv.onpointermove = e => { if (painting) paint(e); };
  cv.onpointerup = () => { if (painting) { painting = false; f.layer = layerHasInk() ? layer.toDataURL('image/png') : null; draw(); } };
  const layerHasInk = () => { const d = lctx.getImageData(0, 0, layer.width, layer.height).data; for (let i = 3; i < d.length; i += 64) if (d[i]) return true; return false; };
  const api = { el, get: () => JSON.parse(JSON.stringify(f)), setColor: (i, v) => { f.c[i] = v; el.querySelector(`[data-ci="${i}"]`).value = v; draw(); } };
  syncEmb();
  setTimeout(draw, 0);
  return api;
}
function openFlagEditor(flag, cb) {
  const fe = flagEditorEl(flag);
  modal('Flag editor', fe.el, [{ label: 'Save flag', fn: () => cb(fe.get()) }, { label: 'Cancel' }], { wide: true });
}

// ---------- division designer ----------
function openDivDesigner(tplId) {
  const c = C(G.player);
  const orig = c.templates.find(t => t.id === tplId);
  const st = { name: orig ? orig.name : 'New Division', bats: orig ? [...orig.bats] : [] };
  const avail = Object.keys(BATTALIONS).filter(k => hasTech(c, BATTALIONS[k].tech));
  const body = document.createElement('div'); body.className = 'divdes';
  const render = () => {
    const s = divStats(c, st.bats.length ? st.bats : ['spearmen'], null);
    const has = st.bats.length > 0;
    body.innerHTML = `<label class="full">Template name<input type="text" id="dd-name" maxlength="30" value="${esc(st.name)}"></label>
      <div class="dd-grid">${Array.from({ length: 10 }, (_, i) => { const b = st.bats[i]; return b ? `<button type="button" class="slot full cat-${BATTALIONS[b].cat}" data-rm="${i}" data-tip="Click to remove">${BATTALIONS[b].name}</button>` : '<div class="slot"></div>'; }).join('')}</div>
      <h4>Add battalion</h4><div class="seg">${avail.map(k => `<button type="button" class="chip cat-${BATTALIONS[k].cat}" data-add="${k}">${BATTALIONS[k].name}</button>`).join('')}</div>
      <h4>Division statistics</h4>${has ? `<div class="grid3">${row('Manpower', fmtInt(s.mp))}${row('Organization', s.org.toFixed(0))}${row('Strength (HP)', s.hp.toFixed(0))}${row('Soft attack', s.sa.toFixed(1))}${row('Hard attack', s.ha.toFixed(1))}${row('Defense', s.df.toFixed(1))}${row('Breakthrough', s.brk.toFixed(1))}${row('Armor', s.arm.toFixed(0))}${row('Piercing', s.prc.toFixed(0))}${row('Speed', s.spd.toFixed(1))}${row('Supply use', s.sup.toFixed(2))}${row('Siege power', s.siege.toFixed(1))}${row('Hardness', Math.round(s.hard * 100) + '%')}${row('Training', Math.round(25 + st.bats.length * 2) + ' days')}</div>
      <p class="muted">Equipment: ${Object.entries(s.eq).map(([k, v]) => `${Math.ceil(v)} ${k === 'tank' ? 'tanks' : EQUIP[k].names[c.era].toLowerCase()}`).join(', ')}</p>` : '<p class="muted">Add battalions to see statistics.</p>'}`;
    body.querySelector('#dd-name').oninput = e => { st.name = e.target.value; };
    body.querySelectorAll('[data-add]').forEach(b => b.onclick = () => { if (st.bats.length >= 10) return toast('A division holds at most 10 battalions.'); st.bats.push(b.dataset.add); render(); });
    body.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { st.bats.splice(+b.dataset.rm, 1); render(); });
  };
  render();
  const btns = [{ label: orig ? 'Save template' : 'Create template', fn: () => { if (!st.bats.length) { toast('Add at least one battalion.'); return false; } after(cmd('template', { id: orig ? orig.id : null, mode: orig ? 'save' : 'new', name: st.name, bats: [...st.bats] })); } }];
  if (orig) btns.push({ label: 'Save as new', fn: () => { if (!st.bats.length) return false; after(cmd('template', { mode: 'new', name: st.name + ' II', bats: [...st.bats] })); } });
  if (orig && c.templates.length > 1) btns.push({ label: 'Delete', cls: 'danger', fn: () => after(cmd('template', { id: orig.id, mode: 'delete' })) });
  btns.push({ label: 'Cancel' });
  modal('Division designer', body, btns, { wide: true });
}

// ---------- tank designer ----------
function openTankDesigner() {
  const c = C(G.player);
  const chs = Object.keys(CHASSIS).filter(k => hasTech(c, CHASSIS[k].tech)), guns = Object.keys(GUNS).filter(k => hasTech(c, GUNS[k].tech));
  if (!chs.length) return toast('Research Armored Vehicles first.', 'bad');
  const d = { name: `${c.adj.slice(0, 3).toUpperCase()}-${c.designs.length + 1}`, chassis: chs[chs.length - 1], gun: guns[guns.length - 1], armorLvl: 3, engine: 2, radio: hasTech(c, 't_radio'), sloped: hasTech(c, 't_tanks2') };
  const body = document.createElement('div'); body.className = 'tankdes';
  const render = () => {
    const s = tankStats(d);
    body.innerHTML = `<div class="form cols"><label>Design name<input type="text" id="td-name" value="${esc(d.name)}" maxlength="30"></label>
      <label>Chassis<select id="td-ch">${chs.map(k => `<option value="${k}" ${d.chassis === k ? 'selected' : ''}>${CHASSIS[k].name}</option>`).join('')}</select></label>
      <label>Main gun<select id="td-gun">${guns.map(k => `<option value="${k}" ${d.gun === k ? 'selected' : ''}>${GUNS[k].name}</option>`).join('')}</select></label>
      <label>Armor plating <output>${d.armorLvl}</output><input type="range" id="td-arm" min="1" max="5" value="${d.armorLvl}"></label>
      <label>Engine <output>${['', 'Economy', 'Standard', 'High-output'][d.engine]}</output><input type="range" id="td-eng" min="1" max="3" value="${d.engine}"></label>
      <label class="chk"><input type="checkbox" id="td-radio" ${d.radio ? 'checked' : ''} ${hasTech(c, 't_radio') ? '' : 'disabled'}> Radio ${hasTech(c, 't_radio') ? '' : '(needs Radio)'}</label>
      <label class="chk"><input type="checkbox" id="td-slope" ${d.sloped ? 'checked' : ''} ${hasTech(c, 't_tanks2') ? '' : 'disabled'}> Sloped armor ${hasTech(c, 't_tanks2') ? '' : '(needs Medium Tanks)'}</label></div>
      <div class="tankpic">${tankSVG(d)}</div>
      <div class="grid3">${row('Armor', s.armor)}${row('Speed', s.speed + ' km/h·')}${row('Soft attack', s.sa.toFixed(1))}${row('Hard attack', s.ha.toFixed(1))}${row('Piercing', s.prc)}${row('Breakthrough', s.brk.toFixed(1))}${row('Reliability', Math.round(s.rel * 100) + '%')}${row('Fuel use', s.fuel.toFixed(1))}${row('Production cost', s.cost)}${row('Maintenance', s.maint)}${row('Forest', Math.round(s.terrain.forest * 100) + '%')}${row('Mountains', Math.round(s.terrain.mountain * 100) + '%')}</div>`;
    const on = (id, ev, fn) => body.querySelector(id).addEventListener(ev, fn);
    on('#td-name', 'input', e => { d.name = e.target.value; });
    on('#td-ch', 'change', e => { d.chassis = e.target.value; render(); }); on('#td-gun', 'change', e => { d.gun = e.target.value; render(); });
    on('#td-arm', 'input', e => { d.armorLvl = +e.target.value; render(); }); on('#td-eng', 'input', e => { d.engine = +e.target.value; render(); });
    on('#td-radio', 'change', e => { d.radio = e.target.checked; render(); }); on('#td-slope', 'change', e => { d.sloped = e.target.checked; render(); });
  };
  render();
  modal('Tank designer', body, [{ label: 'Save design & add production line', fn: () => after(cmd('design', { d })) }, { label: 'Cancel' }], { wide: true });
}
function tankSVG(d) {
  const ch = { light: 0.8, medium: 1, heavy: 1.2, mbt: 1.15, hover: 1.1 }[d.chassis], gl = { mg: 14, small: 24, medium: 32, hv: 44, smooth: 50, rail: 60 }[d.gun];
  const hull = 120 * ch, h = 20 + d.armorLvl * 3;
  return `<svg viewBox="0 0 260 110" role="img" aria-label="Tank silhouette"><g fill="#6d7660" stroke="#20241c" stroke-width="2"><rect x="${130 - hull / 2}" y="${70 - h / 2}" width="${hull}" height="${h}" rx="${d.sloped ? 10 : 2}"/><rect x="${118 - 18 * ch}" y="${46 - 6 * ch}" width="${48 * ch}" height="${16 + 4 * ch}" rx="${d.sloped ? 8 : 2}"/><rect x="${118 + 30 * ch}" y="${50}" width="${gl + 20}" height="5"/>${d.chassis === 'hover' ? `<ellipse cx="130" cy="${82 + h / 2}" rx="${hull / 2}" ry="6" fill="#5fd4e8" opacity=".6"/>` : `<rect x="${130 - hull / 2 - 4}" y="${70 + h / 2 - 6}" width="${hull + 8}" height="14" rx="7" fill="#2f322b"/>`}${d.radio ? `<line x1="${120}" y1="${46 - 6 * ch}" x2="${112}" y2="${18}" stroke-width="1.5"/>` : ''}</g></svg>`;
}

// ---------- peace conference ----------
function openPeace(w) {
  const c = C(G.player);
  const side = w.att.includes(c.id) ? 'att' : 'def';
  const enemies = (side === 'att' ? w.def : w.att).filter(x => C(x).alive);
  const score = warScore(w, side);
  const avail = w.capitulated || enemies.every(x => w.cap.includes(x)) ? 200 : Math.max(0, score);
  const sel = { provs: new Set(), puppet: new Set(), rep: new Set(), release: new Set() };
  const body = document.createElement('div'); body.className = 'peace';
  const cost = () => {
    let t = 0;
    for (const id of sel.provs) t += provDemandCost(w, side, G.provs[id]);
    for (const e of sel.puppet) t += 30 + C(e).nProv * 2;
    for (const e of sel.rep) t += 12;
    for (const k of sel.release) t += 15;
    return t;
  };
  const render = () => {
    const t = cost();
    let html = `<div class="row"><span>War score available</span><b class="${avail > 0 ? 'good' : 'bad'}">${avail >= 200 ? 'Total victory' : avail}</b></div><div class="row"><span>Cost of demands</span><b class="${t > avail ? 'bad' : ''}">${t}</b></div>${bar(t / Math.max(1, avail), t > avail ? 'r' : '')}`;
    for (const e of enemies) {
      const E = C(e);
      const ps = G.provs.filter(p => p.owner === e).sort((a, b) => ((b.controller === c.id) - (a.controller === c.id)) || provValue(b) - provValue(a));
      const cults = [...new Set(ps.map(p => p.culture).filter(k => k !== E.culture && k !== 'Unsettled'))];
      html += `<h4>${flagImg(E, 24, 16)} ${esc(E.name)}</h4><div class="seg"><button type="button" class="chip ${sel.puppet.has(e) ? 'on' : ''}" data-pup="${e}">Make subject (${30 + E.nProv * 2})</button><button type="button" class="chip ${sel.rep.has(e) ? 'on' : ''}" data-rep="${e}">War reparations (12)</button>${cults.map(k => `<button type="button" class="chip ${sel.release.has(e + '|' + k) ? 'on' : ''}" data-rel="${e}|${esc(k)}">Release ${esc(k)} (15)</button>`).join('')}</div>
        <div class="plist">${ps.map(p => `<label class="pp ${p.controller === c.id ? 'occ' : ''}"><input type="checkbox" data-prov="${p.id}" ${sel.provs.has(p.id) ? 'checked' : ''}> ${esc(p.name)}${E.capital === p.id ? ' ★' : ''} <small>${provDemandCost(w, side, p)}</small></label>`).join('')}</div>`;
    }
    html += '<p class="muted">Highlighted provinces are occupied by you and cost less. The enemy accepts if your demands do not exceed the war score.</p>';
    body.innerHTML = html;
    body.querySelectorAll('[data-prov]').forEach(i => i.onchange = () => { const id = +i.dataset.prov; i.checked ? sel.provs.add(id) : sel.provs.delete(id); render(); });
    body.querySelectorAll('[data-pup]').forEach(b => b.onclick = () => { const e = +b.dataset.pup; sel.puppet.has(e) ? sel.puppet.delete(e) : sel.puppet.add(e); render(); });
    body.querySelectorAll('[data-rep]').forEach(b => b.onclick = () => { const e = +b.dataset.rep; sel.rep.has(e) ? sel.rep.delete(e) : sel.rep.add(e); render(); });
    body.querySelectorAll('[data-rel]').forEach(b => b.onclick = () => { const k = b.dataset.rel; sel.release.has(k) ? sel.release.delete(k) : sel.release.add(k); render(); });
  };
  render();
  modal('Peace conference — ' + esc(w.name), body, [
    { label: 'Propose peace', fn: () => {
      const t = cost();
      if (t > avail) { toast('The enemy rejects these demands: they exceed your war score.', 'bad'); return false; }
      const terms = { transfers: [...sel.provs].map(id => ({ prov: id, to: c.id })), puppets: [...sel.puppet].map(e => ({ sub: e, over: c.id })), reparations: [...sel.rep].map(e => ({ from: e, to: c.id, amount: Math.max(100, (C(e).income || 5) * 120) })), release: [] };
      for (const k of sel.release) { const [e, cult] = k.split('|'); const ps = G.provs.filter(p => p.owner === +e && p.culture === cult && !sel.provs.has(p.id) && p.id !== C(+e).capital).map(p => p.id); if (ps.length) terms.release.push({ provs: ps, over: c.id }); }
      after(cmd('peace', { war: w.id, terms }));
    } },
    { label: 'White peace', fn: () => { if (score < -10 && !(w.capitulated)) { toast('The enemy is winning and refuses a white peace.', 'bad'); return false; } after(cmd('peace', { war: w.id, white: true })); } },
    { label: 'Continue the war' }], { wide: true });
}

// ---------- game menu / saves / settings ----------
function openGameMenu() {
  if (NET.role) return openMpGameMenu();
  G.paused = true;
  const slots = ['slot1', 'slot2', 'slot3'];
  const idx = saveIndex();
  const info = s => { const x = idx.find(i => i.slot === s); return x ? `${esc(x.country)} · ${esc(x.date)}` : 'empty'; };
  const m = modal('Game menu', `<div class="saves">${slots.map(s => `<div class="row"><span>${s.replace('slot', 'Slot ')} <small>${info(s)}</small></span><span><button class="btn sm" data-save="${s}">Save</button> <button class="btn sm" data-load="${s}" ${idx.find(i => i.slot === s) ? '' : 'disabled'}>Load</button></span></div>`).join('')}
    <div class="row"><span>Autosave <small>${info('autosave')}</small></span><span><button class="btn sm" data-load="autosave" ${idx.find(i => i.slot === 'autosave') ? '' : 'disabled'}>Load</button></span></div></div>
    <div class="btnrow wrap"><button class="btn" id="gm-export">Export save</button><button class="btn" id="gm-import">Import save</button><button class="btn" id="gm-settings">Settings</button><button class="btn" id="gm-cheats">Cheats</button><button class="btn danger" id="gm-quit">Exit to main menu</button></div>`, [{ label: 'Resume' }]);
  m.querySelector('#gm-cheats').onclick = () => { m.close(); openCheats(); };
  m.querySelectorAll('[data-save]').forEach(b => b.onclick = () => { if (saveGame(b.dataset.save, b.dataset.save.replace('slot', 'Slot '))) { toast('Game saved.'); m.close(); } else toast('Saving failed — browser storage is unavailable. Use Export instead.', 'bad'); });
  m.querySelectorAll('[data-load]').forEach(b => b.onclick = () => { m.close(); loadAndStart(b.dataset.load); });
  m.querySelector('#gm-export').onclick = () => { m.close(); exportSave(); };
  m.querySelector('#gm-import').onclick = () => { m.close(); importSave(); };
  m.querySelector('#gm-settings').onclick = () => { m.close(); openSettings(); };
  m.querySelector('#gm-quit').onclick = () => { m.close(); toMenu(); };
}
// ---------- cheats (single-player only) ----------
const CHEATS = {
  money: ['+ Money', c => { c.treasury += 10000 * (1 + c.era); }],
  pp: ['+ 500 political power', c => { c.pp = Math.min(999, c.pp + 500); }],
  manpower: ['+ Manpower', c => { c.manpower += 100000 * (1 + c.era); }],
  resources: ['+ 2,000 of every resource', c => { for (const r of RESOURCES) c.stock[r] = (c.stock[r] || 0) + 2000; }],
  equipment: ['+ Equipment stockpile', c => { Object.assign(c.equip, { arms: (c.equip.arms || 0) + 5000, artillery: (c.equip.artillery || 0) + 600, vehicles: (c.equip.vehicles || 0) + 600, support: (c.equip.support || 0) + 400, aircraft: (c.equip.aircraft || 0) + 200, ships: (c.equip.ships || 0) + 10 }); const d = c.designs[c.designs.length - 1]; if (d) c.equip['tank:' + d.id] = (c.equip['tank:' + d.id] || 0) + 400; }],
  nukes: ['+ 5 nuclear weapons', c => { c.equip.nukes = (c.equip.nukes || 0) + 5; return 'Select an enemy province and press Nuclear strike in the bottom bar.'; }],
  stability: ['Max stability, no war exhaustion', c => { c.stability = 100; c.warEx = 0; }],
  research: ['Finish current research', c => { if (!c.researching) return 'Pick something to research first.'; c.rp = 1e9; }],
  era: ['Unlock the next era', c => { const e = Math.min(5, c.era + 1); for (const T of TECHS) if (T.era <= e && !c.techs.includes(T.id)) c.techs.push(T.id); c.era = countryEra(c); setupTemplates(c); if (c.era >= 3) autoDesign(c); return `Now in the ${ERAS[c.era].name}.`; }],
  build: ['Finish all construction now', c => { for (const p of c._provs) { for (const b of p.buildings) { if (b.prog < 1) b.prog = 1; if (b.upg != null) { b.upg = null; b.lvl = Math.min(3, b.lvl + 1); } if (b.rep != null) { b.rep = null; b.hp = 100; } } for (const g of p.segs) { g.prog = 1; if (g.rep) { g.rep = false; g.hp = 100; } } markDirty(p); } }],
  fast: ['Instant building on/off', () => { G.cheatFast = !G.cheatFast; return G.cheatFast ? 'Construction is now 20× faster.' : 'Construction back to normal.'; }],
  army: ['Spawn a division in the selected province', c => { const p = G.provs[V.sel]; if (!p || p.controller !== c.id) return 'Select a province you control first.'; const d = spawnDivision(c, c.templates[c.templates.length - 1], p.id, 1); return `${d.name} is ready in ${p.name}.`; }],
  army5: ['Spawn 5 divisions in the selected province', c => { const p = G.provs[V.sel]; if (!p || p.controller !== c.id) return 'Select a province you control first.'; for (let i = 0; i < 5; i++) spawnDivision(c, c.templates[c.templates.length - 1], p.id, 1); return `5 divisions are ready in ${p.name}.`; }],
  take: ['Take the selected province', c => { const p = G.provs[V.sel]; if (!p || p.owner === c.id) return 'Select a province you do not own first.'; const old = C(p.owner); for (const d of G.divs.filter(x => x.prov === p.id && x.owner !== c.id)) if (!retreatDivision(d)) G.divs = G.divs.filter(x => x !== d); p.owner = p.controller = c.id; p.core = [...new Set([...(p.core || []), c.id])]; flashProvince(p, c.id); markDirty(p); if (old && old.capital === p.id) relocateCapital(old); if (old && !G.provs.some(q => q.owner === old.id)) killCountry(old); updateCountryAggregates(); }],
  war: ['Start a war with the selected province\'s owner', c => {
    const p = G.provs[V.sel], t = p && p.owner;
    if (t == null || t < 0 || t === c.id || !C(t).alive) return 'Select a province owned by another country first.';
    if (atWar(c.id, t)) return `You are already at war with ${C(t).name}.`;
    // the cheat clears whatever would block the war, and grants a war goal so it costs no stability
    G.diplo.treaties = G.diplo.treaties.filter(x => !((x.a === c.id && x.b === t) || (x.a === t && x.b === c.id)));
    delete G.diplo.truces[pairKey(c.id, t)];
    if (c.overlord === t) c.overlord = -1;
    if (C(t).overlord === c.id) C(t).overlord = -1;
    for (const o of G.orgs || []) if (o.type === 'peace' && o.members.includes(c.id) && o.members.includes(t)) removeFromOrg(o, c.id);
    if (!c.wargoals.includes(t)) c.wargoals.push(t);
    const err = declareWar(c.id, t, 'Casus belli');
    return err || `War declared on ${C(t).name}.`;
  }],
  peace: ['End all your wars (white peace)', c => { for (const w of G.wars.filter(w => w.att.includes(c.id) || w.def.includes(c.id))) makePeace(w, {}); }],
};
function openCheats() {
  if (NET.role) return toast('Cheats are turned off in multiplayer games.');
  if (UI.phase !== 'game' && UI.phase !== 'province') return;
  const body = document.createElement('div');
  body.innerHTML = `<p class="muted">Applies to ${esc(C(G.player).name)}. Hotkey: <b>%</b> (Shift + 5).</p><div class="qb">${Object.entries(CHEATS).map(([k, [label]]) => `<button class="bcard" data-cheat="${k}"><b>${label}</b></button>`).join('')}</div>`;
  body.querySelectorAll('[data-cheat]').forEach(b => b.onclick = () => {
    const msg = CHEATS[b.dataset.cheat][1](C(G.player));
    G.mapDirty = true; UI.lastMap = 0; refreshTop(); renderPanel(true); renderBottom();
    toast(msg || 'Done.');
  });
  modal('Cheats', body, [{ label: 'Close' }], { wide: true });
}
window.addEventListener('keydown', e => { if (e.key === '%' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && !document.querySelector('.modal-back')) openCheats(); });
// In a shared game: saving is the host's job; loading another world would leave the game
function openMpGameMenu() {
  const host = NET.role === 'host';
  const m = modal('Game menu', `<p class="muted">${host ? `You are hosting game <b>${esc((NET.code || '').toUpperCase())}</b>. The world runs in this tab, so keep it open. Saving pauses nobody.` : 'You are playing in a shared game. The host saves the world.'}</p>
    <div class="btnrow wrap">${host ? '<button class="btn" data-mps="slot1">Save to slot 1</button><button class="btn" data-mps="slot2">Save to slot 2</button>' : ''}<button class="btn" id="gm-export">Export a copy</button><button class="btn" id="gm-settings">Settings</button><button class="btn danger" id="gm-leave">${host ? 'End the shared game' : 'Leave the game'}</button></div>`, [{ label: 'Resume' }]);
  m.querySelectorAll('[data-mps]').forEach(b => b.onclick = () => { if (saveGame(b.dataset.mps, b.dataset.mps.replace('slot', 'Slot '))) toast('Game saved.'); else toast('Saving failed — browser storage is unavailable. Use Export instead.', 'bad'); });
  m.querySelector('#gm-export').onclick = () => { m.close(); exportSave(); };
  m.querySelector('#gm-settings').onclick = () => { m.close(); openSettings(); };
  m.querySelector('#gm-leave').onclick = () => { m.close(); netLeave(); toMenu(); };
}
function loadAndStart(slot) {
  loading('Loading…', () => {
    if (!loadGame(slot)) return toast('That save could not be read.', 'bad');
    afterLoad();
  });
}
function afterLoad() {
  labelsKey = ''; fitView();
  if (G.editorMode || G.player < 0 || !C(G.player) || !C(G.player).alive) { G.editorMode = false; for (const c of G.countries) c.ai = true; enterPick('choose'); toast('Choose a nation to play.'); return; }
  // a save from a shared game: other players' nations go back to the AI
  for (const c of G.countries) { c.ai = c.id !== G.player; c.netPeer = null; }
  startGame(G.player, true);
  toast('Loaded ' + dateStr(G.day) + '.');
}
function exportSave() {
  const data = serialize();
  const m = modal('Export save', `<p class="muted">Copy this text and keep it somewhere safe. Paste it into Import to continue later.</p><textarea id="ex-t" rows="8" readonly>${esc(data)}</textarea><p class="muted">${(data.length / 1024).toFixed(0)} KB</p>`, [{ label: 'Copy', fn: () => { const t = $('#ex-t'); navigator.clipboard.writeText(t.value).then(() => toast('Copied.'), () => { t.select(); toast('Select-all done — press Ctrl+C.'); }); return false; } }, { label: 'Close' }]);
  setTimeout(() => m.querySelector('#ex-t').select(), 50);
}
function importSave() {
  modal('Import save', '<p class="muted">Paste exported save text below.</p><textarea id="im-t" rows="8"></textarea>', [{ label: 'Load', fn: () => { try { const txt = $('#im-t').value.trim(); loading('Loading…', () => { deserialize(txt); afterLoad(); }); } catch (e) { toast('That text is not a valid save.', 'bad'); return false; } } }, { label: 'Cancel' }]);
}
function openSettings() {
  const s = G.settings;
  modal('Settings', `<div class="form">
    <label>Graphics quality (province view)<select id="st-q"><option value="low">Low — no shadows, fewer trees</option><option value="medium">Medium</option><option value="high">High — dense forests, sharp shadows</option></select></label>
    <label>Interface scale <output id="st-uo">${Math.round(s.uiScale * 100)}%</output><input type="range" id="st-u" min="80" max="130" step="5" value="${Math.round(s.uiScale * 100)}"></label>
    <label class="chk"><input type="checkbox" id="st-a" ${s.autosave ? 'checked' : ''}> Autosave every new year</label>
    <label class="chk"><input type="checkbox" id="st-p" ${s.pauseOnEvents ? 'checked' : ''}> Pause on important events</label>
    <label class="chk"><input type="checkbox" id="st-g" ${s.growthDefault ? 'checked' : ''}> Settlements grow on their own (new provinces)</label></div>`,
  [{ label: 'Apply', fn: () => { s.quality = $('#st-q').value; s.uiScale = +$('#st-u').value / 100; s.autosave = $('#st-a').checked; s.pauseOnEvents = $('#st-p').checked; s.growthDefault = $('#st-g').checked; applyUiScale(); storageSet('cop_settings', JSON.stringify(s)); toast('Settings saved.'); } }, { label: 'Cancel' }]);
  $('#st-q').value = s.quality;
  $('#st-u').oninput = e => { $('#st-uo').textContent = e.target.value + '%'; };
}
// phones get a smaller kit on top of the player's chosen scale
const PHONE_MQ = matchMedia('(max-width: 760px), (max-height: 520px)');
function applyUiScale() { document.documentElement.style.setProperty('--ui', G.settings.uiScale * (PHONE_MQ.matches ? 0.8 : 1)); }
PHONE_MQ.addEventListener('change', () => applyUiScale());
function openScenarios() {
  const idx = saveIndex();
  const m = modal('Load scenario', `<h4>Historical-style scenarios</h4><div class="scn">${SCENARIOS.map((s, i) => `<button class="scard" data-scn="${i}"><b>${s.name}</b><small>${ERAS[s.era].name} · ${s.n} nations · ${s.mapType}</small><span>${s.text}</span></button>`).join('')}</div>
    <p class="muted">Scenarios on the Europe and World maps use real country borders.</p>
    <h4>Saved games & custom scenarios</h4>${idx.length ? idx.map(x => `<div class="row"><span>${esc(x.label)} <small>${x.editor ? 'Custom scenario' : esc(x.country)} · ${esc(x.date)}</small></span><span><button class="btn sm" data-ld="${esc(x.slot)}">Load</button> <button class="btn sm danger" data-del="${esc(x.slot)}">Delete</button></span></div>`).join('') : '<p class="muted">No saves yet.</p>'}
    <div class="btnrow"><button class="btn" id="sc-imp">Import save text</button></div>`, [{ label: 'Close' }], { wide: true });
  m.querySelectorAll('[data-scn]').forEach(b => b.onclick = () => { const s = SCENARIOS[+b.dataset.scn]; m.close(); setupDialog('play', { seed: s.seed, mapType: s.mapType, n: s.n || 18, era: s.era, borders: s.borders }); });
  m.querySelectorAll('[data-ld]').forEach(b => b.onclick = () => { m.close(); loadAndStart(b.dataset.ld); });
  m.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { storageDel('cop_save_' + b.dataset.del); storageSet('cop_saves', JSON.stringify(saveIndex().filter(x => x.slot !== b.dataset.del))); m.close(); openScenarios(); });
  m.querySelector('#sc-imp').onclick = () => { m.close(); importSave(); };
}
function toMenu() {
  if (NET.role) netLeave();
  if (UI.phase === 'province' || UI.phase === 'battle') p3Exit();
  if (anthemStop) playAnthem({});
  G.paused = true; G.player = -1; G.popups = [];
  document.querySelectorAll('.modal-back').forEach(m => m.remove());
  showMenu();
}

// ---------- map editor ----------
function startEditor(fromGame) {
  if (NET.role) return toast('The map editor is not available during a multiplayer game.');
  G.paused = true;
  UI.editor = { tool: 'select', owner: G.countries.find(c => c.alive) ? G.countries.find(c => c.alive).id : -1, terrain: 'grassland', fromGame: !!fromGame || UI.phase === 'game', relB: -1 };
  setPhase('editor'); V.mode = 'political'; G.mapDirty = true; renderEditor();
}
function renderEditor() {
  const E = UI.editor; if (!E) return;
  const alive = G.countries.filter(c => c.alive);
  const p = G.provs[V.sel];
  const oc = C(E.owner);
  const tool = (k, n) => `<button class="chip ${E.tool === k ? 'on' : ''}" data-act2="etool" data-id="${k}">${n}</button>`;
  let html = `<header><h2>Map Editor</h2><button class="btn sm" data-act2="eexit">${E.fromGame ? 'Back to game' : 'Main menu'}</button></header>
    <div class="seg">${tool('select', 'Select')}${tool('owner', 'Paint ownership')}${tool('terrain', 'Paint terrain')}</div>
    <label>Nation<select id="e-owner" data-ch2="eowner"><option value="-1">— Unclaimed —</option>${alive.map(c => `<option value="${c.id}" ${c.id === E.owner ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
    <label>Terrain brush<select id="e-ter" data-ch2="eterrain">${Object.entries(TERRAINS).map(([k, t]) => `<option value="${k}" ${E.terrain === k ? 'selected' : ''}>${t.name}</option>`).join('')}</select></label>
    <div class="btnrow wrap"><button class="btn sm" data-act2="enew">New nation</button>${oc ? `<button class="btn sm" data-act2="erename">Rename</button><button class="btn sm" data-act2="eflag">Flag</button><button class="btn sm" data-act2="ecolor">Recolor</button><button class="btn sm danger" data-act2="edelete">Delete</button>` : ''}</div>`;
  if (oc) html += `<label>Merge ${esc(oc.name)} into<span class="inrow"><select id="e-merge">${alive.filter(c => c.id !== oc.id).map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select><button class="btn sm" data-act2="emerge">Merge</button></span></label>
    <label>Relations with<span class="inrow"><select id="e-relb" data-ch2="erelb">${alive.filter(c => c.id !== oc.id).map(c => `<option value="${c.id}" ${c.id === E.relB ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></span></label>
    ${E.relB >= 0 && C(E.relB) ? `<input type="range" id="e-rel" min="-100" max="100" value="${Math.round(rel(oc.id, E.relB))}" data-ch2="erel"><div class="row"><span>${Math.round(rel(oc.id, E.relB))}</span><span><label class="chk"><input type="checkbox" data-ch2="eally" ${hasTreaty('alliance', oc.id, E.relB) ? 'checked' : ''}> Alliance</label></span></div>` : ''}
    <label>Starting treasury<input type="number" id="e-tre" value="${Math.round(oc.treasury)}" data-ch2="etreasury"></label>`;
  if (p) {
    html += `<h4>Province: ${esc(p.name)}</h4>
      <label>Name<input type="text" value="${esc(p.name)}" data-ch2="pname" maxlength="30"></label>
      <label>Population<input type="number" value="${p.pop}" data-ch2="ppop"></label>
      <div class="grid3">${Object.keys(p.dep).map(k => `<label>${k}<input type="number" min="0" max="3" value="${p.dep[k]}" data-ch2="pdep" data-k="${k}"></label>`).join('')}</div>
      <div class="btnrow wrap"><button class="btn sm" data-act2="esplit" data-tip="Selected province and its same-owner neighbours become a new nation">Split off new nation</button>${C(p.owner) ? `<button class="btn sm" data-act2="earmy">Add division here</button><button class="btn sm" data-act2="ecapital">Make capital</button>` : ''}</div>`;
  }
  html += `<h4>Scenario</h4><label>Name<input type="text" id="e-sname" value="${esc(G.scenarioName || 'My Scenario')}" maxlength="30"></label>
    <div class="btnrow wrap"><button class="btn primary" data-act2="esave">Save scenario</button><button class="btn" data-act2="eplay">Play this map</button></div>
    <p class="muted">Paint by clicking and dragging on the map. Saved scenarios appear under Load Scenario.</p>`;
  $('#editorui').innerHTML = html;
}
function editorPaint(sx, sy) {
  const E = UI.editor, pid = provAt(sx, sy);
  if (pid < 0) return;
  const p = G.provs[pid];
  if (E.tool === 'owner') {
    if (p.owner === E.owner) return;
    const old = C(p.owner);
    if (old && old.capital === p.id) old.capital = -1;
    p.owner = p.controller = E.owner;
    if (C(E.owner)) { p.culture = C(E.owner).culture; if (!(p.core || []).includes(E.owner)) p.core = [E.owner]; if (C(E.owner).capital < 0) C(E.owner).capital = p.id; if (!p.buildings.length) seedSettlement(p, Math.random, G.era); }
    for (const d of G.divs.filter(d => d.prov === p.id && d.owner !== E.owner)) G.divs = G.divs.filter(x => x !== d);
    if (old && old.capital < 0) { relocateCapital(old); }
    markDirty(p); labelsKey = '';
    clearTimeout(E.t); E.t = setTimeout(() => { for (const c of G.countries) if (c.alive && !G.provs.some(q => q.owner === c.id)) killCountry(c); updateCountryAggregates(); renderEditor(); }, 300);
  } else if (E.tool === 'terrain') {
    if (p.terrain === E.terrain) return;
    p.terrain = E.terrain; p.fert = TERRAINS[p.terrain].fert * (0.7 + p.m * 0.6); markDirty(p);
  }
}
const ACT2 = {
  newgame: () => setupDialog('play'), create: () => setupDialog('create'), mapeditor: () => setupDialog('editor'),
  multiplayer: () => openMultiplayer(),
  mpclaim: el => { if (!NET.myPeer) NET.myPeer = myPeerId(NET.game); NET.send('claim', { cid: +el.dataset.id }); toast('Asking the host…'); },
  mpleave: () => { netLeave(); toMenu(); },
  continue: () => { const idx = saveIndex(); if (idx[0]) loadAndStart(idx[0].slot); },
  scenarios: () => openScenarios(), settings: () => openSettings(),
  exit: () => { $('#menu').innerHTML = `<div class="menu-card"><h1>War Of Nations</h1><p class="sub">The realm awaits your return.</p><nav class="mbtns"><button class="mbtn" data-act2="back">Back to main menu</button></nav></div>`; try { window.close(); } catch (e) { /* not allowed in a frame */ } },
  back: () => showMenu(), tomenu: () => toMenu(),
  playas: el => fade(() => startGame(+el.dataset.id)),
  create2: () => openCreator(),
  backcreator: () => { UI.pick.kind = 'choose'; renderPick(); openCreator(); },
  found: () => { const pid = V.sel; if (pid < 0) return; const c = createCustomCountry(UI.pick.spec, pid); UI.pick = null; fade(() => startGame(c.id)); },
  etool: el => { UI.editor.tool = el.dataset.id; renderEditor(); },
  eexit: () => { const E = UI.editor; UI.editor = null; if (E.fromGame && G.player >= 0 && C(G.player) && C(G.player).alive) { setPhase('game'); buildHUD(); G.mapDirty = true; } else toMenu(); },
  enew: () => { const rng = Math.random; const nm = genName(rng, 'country'); const c = newCountry({ name: nm, adj: adjectiveOf(nm), color: hsl2rgb(rng() * 360, 0.45, 0.5), culture: adjectiveOf(nm), personality: pick(rng, Object.keys(PERSONALITIES)), gov: G.era <= 1 ? 'absolute' : 'republic', leader: pick(rng, LEADER_FIRST) + ' ' + genName(rng), religion: RELIGIONS[0] }); grantStartTechs(c, G.era); initCountryEconomy(c, rng); for (const o of G.countries) if (o.id !== c.id) G.diplo.rel[pairKey(c.id, o.id)] = 0; UI.editor.owner = c.id; UI.editor.tool = 'owner'; toast(`${nm} created. Paint its territory on the map.`); renderEditor(); },
  erename: () => { const c = C(UI.editor.owner); askText('Rename nation', c.name, v => { c.name = v; c.adj = adjectiveOf(v); labelsKey = ''; renderEditor(); }); },
  eflag: () => { const c = C(UI.editor.owner); openFlagEditor(c.flag, f => { c.flag = f; flagUrlCache.clear(); }); },
  ecolor: () => { const c = C(UI.editor.owner); c.color = hsl2rgb(Math.random() * 360, 0.35 + Math.random() * 0.3, 0.45 + Math.random() * 0.15); G.mapDirty = true; UI.lastMap = 0; },
  edelete: () => { const c = C(UI.editor.owner); for (const p of G.provs) if (p.owner === c.id) { p.owner = p.controller = -1; markDirty(p); } killCountry(c); UI.editor.owner = -1; labelsKey = ''; updateCountryAggregates(); renderEditor(); },
  emerge: () => { const a = C(UI.editor.owner), b = C(+$('#e-merge').value); if (!b) return; for (const p of G.provs) if (p.owner === a.id) { p.owner = p.controller = b.id; markDirty(p); } for (const d of G.divs) if (d.owner === a.id) d.owner = b.id; killCountry(a); UI.editor.owner = b.id; labelsKey = ''; updateCountryAggregates(); renderEditor(); },
  esplit: () => { const p = G.provs[V.sel]; if (!p || p.owner < 0) return toast('Select an owned province.'); const ps = [p.id, ...p.neighbors.filter(n => G.provs[n].owner === p.owner && G.provs[n].id !== C(p.owner).capital).slice(0, 3)]; if (C(p.owner).capital === p.id) return toast('Pick a province that is not the capital.'); const c = releaseNation(ps, null, -1); grantStartTechs(c, G.era); initCountryEconomy(c, Math.random); UI.editor.owner = c.id; labelsKey = ''; renderEditor(); },
  earmy: () => { const p = G.provs[V.sel], c = C(p.owner); if (!c.templates.length) setupTemplates(c); spawnDivision(c, c.templates[0], p.id, 1); toast('Division added.'); },
  ecapital: () => { const p = G.provs[V.sel]; C(p.owner).capital = p.id; G.mapDirty = true; toast('Capital moved.'); },
  esave: () => { G.scenarioName = $('#e-sname').value.trim() || 'My Scenario'; G.editorMode = true; const ok = saveGame('scn_' + G.scenarioName.replace(/\W+/g, '_'), G.scenarioName); toast(ok ? 'Scenario saved.' : 'Saving failed — browser storage is unavailable.', ok ? '' : 'bad'); },
  eplay: () => { UI.editor = null; G.editorMode = false; for (const c of G.countries) c.ai = true; updateCountryAggregates(); enterPick('choose'); },
  // province view
  pcat: el => { UI.buildCat = el.dataset.id; renderProvUI(); },
  tool: el => setTool(el.dataset.kind, el.dataset.id),
  snap: () => { P3.snap = !P3.snap; renderProvUI(); },
  rot: el => { P3.ghostRot += (+el.dataset.d) * (P3.snap ? Math.PI / 4 : 0.2); },
  growth: () => { cmd('growth', { p: P3.prov.id }); renderProvUI(); },
  bupg: () => { const b = selB(); if (!b) return; showRes(cmd('upgrade', { p: P3.prov.id, id: b.id })); renderProvUI(); },
  brep: () => { const b = selB(); if (!b) return; showRes(cmd('repair', { p: P3.prov.id, id: b.id })); renderProvUI(); },
  bdem: () => { const b = selB(); if (!b) return; p3DoDemolish({ kind: 'b', id: b.id }); },
  repairall: () => { showRes(cmd('repairall', { p: P3.prov.id })); renderProvUI(); },
};
const selB = () => P3.prov && P3.prov.buildings.find(b => b.id === UI.p3sel);
function CHANGE2(e) { }
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act2]');
  if (!el || el.disabled) return;
  const f = ACT2[el.dataset.act2];
  if (f) { e.preventDefault(); f(el, e); }
});
document.addEventListener('change', e => {
  const el = e.target, k = el.dataset && el.dataset.ch2;
  if (!k || !UI.editor) return;
  const E = UI.editor, p = G.provs[V.sel], oc = C(E.owner);
  if (k === 'eowner') { E.owner = +el.value; if (E.tool === 'select') E.tool = 'owner'; renderEditor(); }
  if (k === 'eterrain') { E.terrain = el.value; E.tool = 'terrain'; renderEditor(); }
  if (k === 'erelb') { E.relB = +el.value; renderEditor(); }
  if (k === 'erel' && oc) { G.diplo.rel[pairKey(oc.id, E.relB)] = +el.value; renderEditor(); }
  if (k === 'eally' && oc) { if (el.checked) addTreaty('alliance', oc.id, E.relB); else removeTreaty('alliance', oc.id, E.relB); }
  if (k === 'etreasury' && oc) oc.treasury = +el.value;
  if (k === 'pname' && p) { p.name = el.value; }
  if (k === 'ppop' && p) { p.pop = Math.max(500, +el.value); p.baseHousing = Math.max(p.baseHousing, p.pop); markDirty(p); }
  if (k === 'pdep' && p) { p.dep[el.dataset.k] = clamp(+el.value, 0, 3); markDirty(p); }
});
document.addEventListener('input', e => { if (e.target.id === 'e-rel') { const E = UI.editor; G.diplo.rel[pairKey(E.owner, E.relB)] = +e.target.value; } });

// ---------- province view UI ----------
function enterProvince(pid) {
  const p = G.provs[pid];
  if (!p) return;
  fade(() => {
    p3Init($('#p3wrap'));
    setPhase('province');
    UI.p3sel = null; V.sel = pid;
    p3Resize();
    p3Enter(pid);
    renderProvUI();
  });
}
function exitProvince() {
  fade(() => { const pid = P3.prov ? P3.prov.id : V.sel; p3Exit(); setPhase('game'); V.sel = pid; G.mapDirty = true; UI.lastMap = 0; renderBottom(); });
}
function setTool(kind, type) {
  P3.tool = { kind, type: type || null };
  if (kind !== 'select') { UI.p3sel = null; P3.selected = null; }
  renderProvUI();
}
function p3PlaceBuilding(t, x, z, r) {
  showRes(cmd('build', { p: P3.prov.id, t, x, z, r })); refreshTop(); renderProvUI();
}
function p3PlaceSegment(t, x1, z1, x2, z2) {
  showRes(cmd('seg', { p: P3.prov.id, t, x1, z1, x2, z2 })); refreshTop();
}
function p3DoDemolish(hit) {
  showRes(cmd('demolish', { p: P3.prov.id, id: hit.id, kind: hit.kind }));
  if (UI.p3sel === hit.id) UI.p3sel = null;
  renderProvUI();
}
function renderProvUI(live) {
  const p = P3.prov; if (!p) return;
  const c = C(G.player), mine = p.owner === G.player && p.controller === G.player;
  const s = provStats(p);
  const side = $('#provui .pside');
  const sideHTML = () => {
    const own = C(p.owner);
    const b = selB();
    let h = `<div class="phead">${own ? flagImg(own, 30, 20) : ''}<div><h3>${esc(p.name)}</h3><small>${own ? esc(own.name) : 'Unclaimed'} · ${TERRAINS[p.terrain].name}${p.coastal ? ', coast' : ''}${p.river ? ', river' : ''} · ${weatherAt(p)}</small></div></div>
      ${provBattleBanner(p)}
      ${!mine ? `<p class="warnbox">${p.controller !== G.player && p.owner === G.player ? 'Occupied by the enemy — construction is disabled.' : 'Foreign territory — you can look, not build.'}</p>` : ''}
      <div class="grid2">${row('Population', fmt(p.pop) + ' <small>/ ' + fmt(s.housing) + '</small>', 'People / housing capacity')}${row('Jobs filled', Math.round(s.empl * 100) + '%', 'Buildings need workers to run at full output')}${row('Food', '+' + s.food.toFixed(1))}${row('Money', '+' + s.money.toFixed(1))}${row('Fortification', s.fort.toFixed(1))}${row('Infrastructure', s.infra.toFixed(1))}${s.milFac ? row('Military industry', s.milFac.toFixed(1)) : ''}${s.civFac ? row('Civilian industry', s.civFac.toFixed(1)) : ''}${s.research ? row('Research', s.research.toFixed(1)) : ''}${s.recruit ? row('Trains troops', 'yes') : ''}${s.iron + s.coal + s.stone + s.wood > 1 ? row('Materials', ['wood', 'stone', 'iron', 'coal', 'oil'].filter(k => s[k] > 0.3).map(k => `${k} ${s[k].toFixed(1)}`).join(', ')) : ''}</div>`;
    if (b) {
      const B = BUILDINGS[b.t];
      const status = b.prog < 1 ? `Under construction ${Math.round(b.prog * 100)}%` : b.upg != null ? `Upgrading ${Math.round(b.upg * 100)}%` : b.rep != null ? `Repairing (${Math.round(b.hp)}%)` : b.hp < 100 ? `<b class=bad>Damaged ${Math.round(b.hp)}%</b>` : 'Operational';
      h += `<div class="card bsel"><b>${B.name} <small>level ${b.lvl}</small></b><small>${status}</small><small>${esc(effText(B))}${B.workers ? ' · needs ' + fmtInt(B.workers * LEVEL_MUL[b.lvl]) + ' workers' : ''}</small>${bar(b.prog < 1 ? b.prog : b.upg != null ? b.upg : b.hp / 100)}
        ${mine ? `<div class="btnrow wrap">${b.lvl < 3 && b.prog >= 1 && b.upg == null ? `<button class="btn sm primary" data-act2="bupg" data-tip="Upgrade: ${costText(upgradeCost(c, b))}">Upgrade to ${b.lvl + 1}</button>` : ''}${b.hp < 100 && b.rep == null ? `<button class="btn sm" data-act2="brep" data-tip="${costText(repairCost(c, b))}">Repair</button>` : ''}<button class="btn sm danger" data-act2="bdem">Demolish</button></div>` : ''}</div>`;
    }
    const dmg = p.buildings.filter(x => x.hp < 100 && x.prog >= 1).length + p.segs.filter(g => g.hp < 100).length;
    const queue = p.buildings.filter(x => x.prog < 1 || x.upg != null || x.rep != null);
    if (queue.length) h += `<h4>Construction</h4>${queue.slice(0, 6).map(x => { const v = x.prog < 1 ? x.prog : x.upg != null ? x.upg : x.hp / 100; return `<div class="bp"><span>${BUILDINGS[x.t].name}</span><i style="--v:${Math.round(v * 100)}%"></i></div>`; }).join('')}`;
    h += `<div class="btnrow wrap">${mine && dmg ? `<button class="btn sm" data-act2="repairall">Repair all damage (${dmg})</button>` : ''}${mine ? `<button class="btn sm ${p.growth ? 'on' : ''}" data-act2="growth" data-tip="Citizens build their own houses when housing runs short">Organic growth: ${p.growth ? 'on' : 'off'}</button>` : ''}</div>
      <button class="btn primary wide" data-act="exitprov">Return to world map</button>`;
    return h;
  };
  if (live && side) { if (!side.matches(':hover')) side.innerHTML = sideHTML(); return; }
  const cats = Object.entries(BUILD_CATS).concat([['lines', 'Walls & roads']]);
  let pal = '';
  if (UI.buildCat === 'lines') {
    pal = Object.entries(SEGMENTS).map(([k, S]) => { const ok = hasTech(c, S.tech); return `<button class="bcard ${P3.tool.type === k ? 'on' : ''} ${ok ? '' : 'lock'}" ${ok && mine ? `data-act2="tool" data-kind="seg" data-id="${k}"` : ''} data-tip="Click and drag in the province to lay ${S.name.toLowerCase()}.<br>Cost per 10 m: ${costText(scaledCost(c, S.cost))}${ok ? '' : '<br>Requires ' + TECH_BY_ID[S.tech].name}"><b>${S.name}</b><small>${ok ? costText(scaledCost(c, S.cost)) + ' / 10 m' : 'Needs ' + TECH_BY_ID[S.tech].name}</small></button>`; }).join('');
  } else {
    pal = Object.entries(BUILDINGS).filter(([, B]) => B.cat === UI.buildCat).map(([k, B]) => {
      const ok = hasTech(c, B.tech), cost = scaledCost(c, B.cost);
      const coastBad = B.coastal && !p.coastal;
      return `<button class="bcard ${P3.tool.type === k ? 'on' : ''} ${ok && !coastBad ? '' : 'lock'} ${ok && !canAfford(c, cost) ? 'dim' : ''}" ${ok && mine && !coastBad ? `data-act2="tool" data-kind="build" data-id="${k}"` : ''} data-tip="<b>${B.name}</b><br>${esc(effText(B))}<br>${costText(cost)} · ${B.days} days${B.workers ? ' · ' + fmtInt(B.workers) + ' workers' : ''}${ok ? '' : '<br>Requires ' + TECH_BY_ID[B.tech].name}${coastBad ? '<br>Coastal provinces only' : ''}"><b>${B.name}</b><small>${ok ? costText(cost) : 'Needs ' + TECH_BY_ID[B.tech].name}</small></button>`;
    }).join('');
  }
  $('#provui').innerHTML = `<div class="ppalette">
      <div class="tabs">${cats.map(([k, n]) => `<button class="tab ${UI.buildCat === k ? 'on' : ''}" data-act2="pcat" data-id="${k}">${n}</button>`).join('')}</div>
      <div class="bgrid">${pal}</div>
      <div class="ptools"><button class="chip ${P3.tool.kind === 'select' ? 'on' : ''}" data-act2="tool" data-kind="select">Select</button><button class="chip ${P3.tool.kind === 'demolish' ? 'on' : ''}" data-act2="tool" data-kind="demolish">Demolish</button><button class="chip ${P3.snap ? 'on' : ''}" data-act2="snap" data-tip="Snap to a 2 m grid and 45° angles (G)">Snap</button><button class="chip" data-act2="rot" data-d="-1" aria-label="Rotate left" data-tip="Rotate (Q)">⟲</button><button class="chip" data-act2="rot" data-d="1" aria-label="Rotate right" data-tip="Rotate (E)">⟳</button></div>
    </div>
    <div class="pside">${sideHTML()}</div>
    <div class="phint">${P3.tool.kind === 'build' ? `Placing ${BUILDINGS[P3.tool.type].name}: click to build · Q/E rotate · Esc to stop` : P3.tool.kind === 'seg' ? `Drag to lay ${SEGMENTS[P3.tool.type].name.toLowerCase()} · Esc to stop` : P3.tool.kind === 'demolish' ? 'Click a structure to demolish it · Esc to stop' : UI.touchTipped ? 'Tap a building to select it · drag to pan · two fingers: pinch to zoom, twist to rotate, slide to tilt' : 'Click a building to select it · drag to pan · right-drag to rotate · wheel to zoom · WASD to move'}</div>`;
}

// Status of the fighting in the province being viewed (troops are drawn in the 3D scene)
function provBattleBanner(p) {
  const { att, def } = armySides(p);
  const b = G.battles.find(x => x.prov === p.id);
  if (!att.length) return def.length ? `<div class="garrison"><b>Garrison</b><small>${def.map(d => esc(d.name)).join(', ')}</small></div>` : '';
  const men = ds => fmt(ds.reduce((s, d) => s + d.st.mp * d.str, 0));
  const aC = C(att[0].owner), dC = def.length ? C(def[0].owner) : C(p.controller);
  const siege = !def.length && p.siege;
  return `<div class="battlebox"><div class="bb-h">${siege ? 'Siege' : 'Battle'} of ${esc(p.name)}${b ? ` <small>day ${b.days}</small>` : ''}</div>
    <div class="bb-row">${flagImg(aC, 24, 16)}<span>${esc(aC.name)} <small>${att.length} div · ${men(att)} men</small></span></div>
    <div class="bb-row">${flagImg(dC, 24, 16)}<span>${esc(dC.name)} <small>${def.length ? def.length + ' div · ' + men(def) + ' men' : 'no field army'}</small></span></div>
    ${siege ? bar(p.siege.prog) + '<small>Walls holding — the besiegers bombard the fortifications</small>' : bar(att.reduce((s, d) => s + d.org, 0) / att.length, 'y')}
    ${G.paused ? '<small class="warn">Time is paused — press Space to let the fighting play out</small>' : ''}
    ${b ? '<div class="btnrow"><button class="btn sm" data-act="resolveprov">Auto-resolve</button></div>' : ''}</div>`;
}
ACT.resolveprov = () => { if (isClient()) return toast('Only the host can auto-resolve battles in multiplayer.'); const b = G.battles.find(x => P3.prov && x.prov === P3.prov.id); if (b) { resolveBattleNow(b); toast(`Battle resolved: ${b.result === 'att' ? C(b.att).name : C(b.def).name} prevailed.`); renderProvUI(); } };
// ---------- battle view UI ----------
function watchBattle(b) {
  fade(() => {
    if (UI.phase === 'province') p3Exit();
    p3Init($('#p3wrap'));
    setPhase('battle');
    p3Resize();
    p3EnterBattle(b);
    if (G.paused) { G.paused = false; G.speed = 1; }
    renderBattleUI();
  });
}
function exitBattle() { fade(() => { p3Exit(); setPhase('game'); G.mapDirty = true; UI.lastMap = 0; }); }
function renderBattleUI() {
  const B = P3.battle; if (!B) return;
  const b = B.b, p = G.provs[b.prov];
  const live = G.battles.includes(b);
  const { attackers, defenders } = live ? battleSides(b) : { attackers: [], defenders: [] };
  const side = (divs, cid, start) => { const c = C(cid); const str = sumStr(divs) / Math.max(0.01, start); return `<div class="bs">${flagImg(c, 36, 24)}<div><b>${esc(c.name)}</b><small>${divs.length} div · ${fmt(divs.reduce((s, d) => s + d.st.mp * d.str, 0))} men</small><div class="mini wide">${bar(live ? str : 0, 'g')}${bar(divs.reduce((s, d) => s + d.org, 0) / Math.max(1, divs.length), 'y')}</div></div></div>`; };
  const s = provStats(p);
  $('#battleui').innerHTML = `<div class="bbar"><div class="bt"><h2>Battle of ${esc(p.name)}</h2><small>Day ${b.days} · ${TERRAINS[p.terrain].name}${p.river ? ', river crossing' : ''} · fort ${s.fort.toFixed(1)} · ${weatherAt(p)}${G.paused ? ' · <b>time paused</b>' : ''}</small></div>
    <div class="bsides">${side(attackers, b.att, B.start.a)}<span class="vs">vs</span>${side(defenders, b.def, B.start.d)}</div>
    ${live ? '' : `<p class="result">${b.result === 'att' ? esc(C(b.att).name) + ' has won the battle.' : esc(C(b.def).name) + ' held the field.'}</p>`}
    <div class="btnrow">${live ? '<button class="btn" data-act="resolve">Auto-resolve</button>' : ''}<button class="btn primary" data-act="exitbattle">Return to map</button></div></div>`;
}

// ---------- boot ----------
function boot() {
  mapCv = $('#map'); mapCtx = mapCv.getContext('2d');
  bmpCv = document.createElement('canvas'); bmpCv.width = MW; bmpCv.height = MH; bmpCtx = bmpCv.getContext('2d');
  bmpData = bmpCtx.createImageData(MW, MH);
  try { Object.assign(G.settings, JSON.parse(storageGet('cop_settings') || '{}')); } catch (e) { /* defaults */ }
  applyUiScale();
  bindMapInput();
  resize();
  window.addEventListener('resize', resize);
  const hot = window.claude && window.claude.hot;
  if (hot && hot.snapshot) hot.snapshot(() => (G.player >= 0 && ['game', 'province', 'battle'].includes(UI.phase)) ? { save: serialize() } : {});
  const start = data => {
    if (data && data.save) { try { deserialize(data.save); startGame(G.player, true); } catch (e) { showMenu(); } }
    else showMenu();
    requestAnimationFrame(frame);
  };
  if (hot && hot.ready) hot.ready(start); else start((hot && hot.data) || {});
  netInit();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
