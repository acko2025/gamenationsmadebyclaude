// ============================================================
// WAR OF NATIONS — multiplayer over the artifact room
// The host's browser runs the simulation and streams compressed changes once a second.
// Clients run no simulation: they render the replicated world and send commands to the host
// through their presence (which every admitted viewer may set).
// ============================================================
'use strict';

const NET = {
  role: null, room: null, user: null, game: null, available: false, code: null,
  myId: null, myPeer: null, myCountry: -1, names: new Map(),
  // host
  seq: 0, hbCount: 0, lastHostMsg: 0, prevSnap: null, outQ: [], sendChain: Promise.resolve(), popupFns: new Map(), peerSeq: new Map(), peerSync: new Map(), needFull: false, blobId: 0, timers: [],
  // client
  S: null, lastSeq: -1, chunks: new Map(), cmdSeq: 0, cmdLog: [], seenMsg: 0, hostPeer: null, shownPopups: new Set(), syncAsked: 0, progress: 0,
};
const CHUNK = 3500;

// ---------- startup ----------
async function netInit() {
  try {
    if (!window.claude || !window.claude.use) return;
    NET.room = await window.claude.use('room');
    NET.user = await window.claude.use('user');
    NET.available = !!NET.room;
    if (NET.user) { try { NET.myId = await NET.user.id(); } catch (e) { /* anonymous */ } }
    if (NET.room) NET.room.onPeers(() => { if ($('#mp-games')) renderMpGames(); }, () => { NET.available = false; });
  } catch (e) { NET.available = false; }
}
function myPeerId(room) { const me = (room || NET.room).peers().find(p => p.sameTab); return me ? me.peer : null; }
// Player names are resolved from account ids when shown, never stored
async function resolveNames(ids) {
  if (!NET.user || !ids.length) return;
  try { const ps = await NET.user.profiles(ids.filter(Boolean)); for (const id in ps) NET.names.set(id, ps[id].name || 'Player'); } catch (e) { /* names stay generic */ }
}
const playerName = c => (c && c.netBy && NET.names.get(c.netBy)) || 'Player';

// ---------- payload transport: gzip + base64, split into room-sized chunks ----------
function b64(buf) { const u = new Uint8Array(buf); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); }
async function pack(json) {
  if (typeof CompressionStream === 'undefined') return { z: 0, s: json };
  const buf = await new Response(new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();
  return { z: 1, s: b64(buf) };
}
async function unpack(z, s) {
  if (!z) return s;
  const bin = atob(s), u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
}

// ============================================================
// Host
// ============================================================
async function netHostStart() {
  if (!NET.available) return toast('Multiplayer is not available in this view.', 'bad');
  NET.code = Math.random().toString(36).slice(2, 7);
  try { NET.game = await NET.room.join('cop-' + NET.code); } catch (e) { NET.game = null; return toast('Could not open a multiplayer room. Try again in a moment.', 'bad'); }
  NET.role = 'host';
  NET.myPeer = myPeerId(NET.game) || myPeerId();
  const c = C(G.player); c.netBy = NET.myId; c.netPeer = NET.myPeer;
  resolveNames([NET.myId]);
  NET.game.onPeers(onHostPeers);
  NET.timers.push(setInterval(hostTick, 1000), setInterval(pumpOut, 50), setInterval(advertise, 5000));
  advertise();
  toast(`Hosting game ${NET.code.toUpperCase()}. Friends can join from Multiplayer on the main menu.`);
}
function advertise() {
  if (NET.role !== 'host') return;
  const c = C(G.player);
  const humans = G.countries.filter(x => x.alive && !x.ai).length;
  NET.room.presence({ game: { code: NET.code, title: `${c ? c.name : 'World'} · ${isRealMap(G.mapType) ? REAL_MAPS[G.mapType].name : 'Generated world'} · ${dateOf(G.day).y}`, players: humans } }).catch(() => {});
}
function onHostPeers(ch) {
  for (const p of ch.joined) if (!p.isMe) NET.needFull = true;
  for (const p of [...ch.joined, ...ch.updated]) if (!p.sameTab) hostReadPeer(p);
  for (const p of ch.left) {
    const c = G.countries.find(x => x.netPeer === p.peer && x.alive);
    if (c && c.id !== G.player) { c.ai = true; c.netPeer = null; note('world', `${playerName(c)} left; the AI now leads ${c.name}.`); }
    NET.peerSeq.delete(p.peer);
  }
  if (ch.joined.length || ch.left.length) { resolveNames(ch.peers.map(p => p.by)); advertise(); }
}
// Commands arrive in each player's presence as [seq, type, args]; run each new one for that player's nation
function hostReadPeer(p) {
  const mp = p.presence && p.presence.mp;
  if (!mp || typeof mp !== 'object') return;
  if (mp.sync && mp.sync !== NET.peerSync.get(p.peer)) { NET.peerSync.set(p.peer, mp.sync); NET.needFull = true; }
  let last = NET.peerSeq.get(p.peer) || 0;
  const cmds = Array.isArray(mp.cmds) ? mp.cmds.filter(x => Array.isArray(x) && x[0] > last).sort((a, b) => a[0] - b[0]) : [];
  for (const [seq, type, args] of cmds) {
    last = seq;
    try {
      if (type === 'claim') { hostClaim(p, args); continue; }
      const c = G.countries.find(x => x.netPeer === p.peer && x.alive);
      if (!c || !COMMANDS[type]) continue;
      const r = COMMANDS[type](c, args || {});
      G.mapDirty = true;
      if (r && r.msg) c.netMsgs = [...(c.netMsgs || []).slice(-5), { s: seq, m: r.msg, ok: r.ok }];
    } catch (e) { console.warn('command failed', type, e); }
  }
  NET.peerSeq.set(p.peer, last);
}
function hostClaim(p, a) {
  const c = C(a && a.cid);
  if (!c || !c.alive || (!c.ai && c.netPeer !== p.peer)) return;
  for (const o of G.countries) if (o.netPeer === p.peer && o !== c) { o.ai = true; o.netPeer = null; }
  c.ai = false; c.netPeer = p.peer; c.netBy = p.by;
  resolveNames([p.by]);
  note('world', `${playerName(c)} now leads ${c.name}.`);
  advertise();
}
function netSnapshot() {
  const s = JSON.parse(serialize());
  delete s.settings; delete s.editor; delete s.scenarioName;
  const byId = arr => { const o = {}; for (const x of arr) o[x.id] = x; return o; };
  s.divs = byId(s.divs); s.battles = byId(s.battles); s.wars = byId(s.wars);
  s.paused = G.paused; s.speed = G.speed; s.netPopups = G.netPopups || []; s.code = NET.code;
  return s;
}
function diffState(a, b, path, out) {
  if (a === b) return;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null || Array.isArray(a) !== Array.isArray(b)) { out.push([path, b]); return; }
  if (Array.isArray(a)) {
    if (a.length !== b.length) { out.push([path, b]); return; }
    for (let i = 0; i < a.length; i++) diffState(a[i], b[i], path.concat(i), out);
    return;
  }
  for (const k in b) { if (!(k in a)) out.push([path.concat(k), b[k]]); else diffState(a[k], b[k], path.concat(k), out); }
  for (const k in a) if (!(k in b)) out.push([path.concat(k), null, 1]);
}
function hostTick() {
  if (NET.role !== 'host' || !NET.game) return;
  // browsers stop animation frames in background tabs: keep the shared world running from this timer
  if (performance.now() - (UI.lastFrame || 0) > 1500 && !G.paused && ['game', 'province', 'battle'].includes(UI.phase)) {
    NET.bgAcc = (NET.bgAcc || 0) + SPEED_DPS[G.speed];
    while (NET.bgAcc >= 1) { dailyTick(); NET.bgAcc -= 1; }
  }
  if (NET.game.peers().filter(p => !p.isMe).length === 0) { NET.prevSnap = null; return; }
  if (++NET.hbCount % 3 === 0) NET.game.emit('hb', { seq: NET.seq }).catch(() => {}); // heartbeat: tells clients the host is still here
  if (NET.outQ.length > 150) { NET.outQ = []; NET.needFull = true; } // fell behind: start over with a full state
  const snap = netSnapshot();
  if (NET.needFull || !NET.prevSnap) { NET.needFull = false; sendBlob('f', snap); }
  else {
    const patches = [];
    diffState(NET.prevSnap, snap, [], patches);
    if (patches.length > 6000) sendBlob('f', snap); else if (patches.length) sendBlob('d', patches);
  }
  NET.prevSnap = snap;
}
function sendBlob(kind, obj) {
  const seq = ++NET.seq, base = kind === 'd' ? seq - 1 : null, id = ++NET.blobId;
  const json = JSON.stringify(obj);
  NET.sendChain = NET.sendChain.then(async () => {
    const { z, s } = await pack(json);
    const n = Math.max(1, Math.ceil(s.length / CHUNK));
    for (let i = 0; i < n; i++) NET.outQ.push({ k: kind, id, i, n, seq, base, z, d: s.slice(i * CHUNK, (i + 1) * CHUNK) });
  }).catch(() => {});
}
// About 20 messages a second; when timers are throttled (background tab) send the backlog's share in one go
function pumpOut() {
  const now = performance.now(), due = Math.min(20, Math.max(1, Math.floor((now - (NET.lastPump || now)) / 50)));
  NET.lastPump = now;
  for (let i = 0; i < due && NET.game && NET.outQ.length; i++) NET.game.emit('st', NET.outQ.shift()).catch(() => {});
}

// ============================================================
// Client
// ============================================================
async function netJoin(code) {
  if (!NET.available) return toast('Multiplayer is not available in this view.', 'bad');
  code = String(code || '').trim().toLowerCase();
  if (!/^[a-z0-9]{3,12}$/.test(code)) return toast('That game code is not valid.', 'bad');
  try { NET.game = await NET.room.join('cop-' + code); } catch (e) { return toast('Could not join that game.', 'bad'); }
  NET.role = 'client'; NET.code = code; NET.lastSeq = -1; NET.goneShown = false; NET.S = null; NET.cmdLog = []; NET.cmdSeq = 0; NET.myCountry = -1; NET.shownPopups = new Set(); NET.seenMsg = 0;
  NET.myPeer = myPeerId(NET.game) || myPeerId();
  NET.game.on('st', onState);
  NET.game.on('hb', m => { if (!m.sameTab) { NET.lastHostMsg = Date.now(); NET.hostPeer = m.peer; } });
  NET.game.onPeers(onClientPeers);
  NET.lastHostMsg = Date.now();
  // no word from the host for 15 s (closed tab, lost connection): the shared game is over
  NET.timers.push(setInterval(() => { if (NET.role === 'client' && Date.now() - NET.lastHostMsg > (NET.S ? 15000 : 45000)) hostGone(); }, 2000));
  setPresence({ sync: Date.now() });
  document.querySelectorAll('.modal-back').forEach(m => m.remove());
  showJoining();
}
function setPresence(extra) {
  const mp = Object.assign({ cmds: NET.cmdLog }, extra || {});
  while (JSON.stringify(mp).length > 3600 && NET.cmdLog.length > 1) { NET.cmdLog.shift(); mp.cmds = NET.cmdLog; }
  NET.game.presence({ mp }).catch(() => {});
}
NET.send = (type, args) => {
  NET.cmdLog.push([++NET.cmdSeq, type, args]);
  if (NET.cmdLog.length > 12) NET.cmdLog.shift();
  setPresence({ sync: NET.syncAsked || null });
};
function requestSync() {
  if (Date.now() - NET.syncAsked < 3000) return;
  NET.syncAsked = Date.now();
  setPresence({ sync: NET.syncAsked });
}
function onState(msg) {
  if (msg.sameTab) return;
  const d = msg.data;
  if (!d || typeof d !== 'object' || typeof d.d !== 'string') return;
  NET.hostPeer = msg.peer; NET.lastHostMsg = Date.now();
  let e = NET.chunks.get(d.id);
  if (!e) { e = { n: d.n, parts: [], got: 0, k: d.k, seq: d.seq, base: d.base, z: d.z, t: Date.now() }; NET.chunks.set(d.id, e); }
  if (e.parts[d.i] == null) { e.parts[d.i] = d.d; e.got++; }
  if (d.k === 'f' && !NET.S) { NET.progress = e.got / e.n; updateJoining(); }
  for (const [id, x] of NET.chunks) if (Date.now() - x.t > 30000) NET.chunks.delete(id);
  if (e.got < e.n) return;
  NET.chunks.delete(d.id);
  unpack(e.z, e.parts.join('')).then(json => handleBlob(e.k, JSON.parse(json), e.seq, e.base)).catch(err => { console.warn('bad state', err); requestSync(); });
}
function handleBlob(kind, obj, seq, base) {
  if (kind === 'f') { applyFull(obj); NET.lastSeq = seq; return; }
  if (!NET.S || base !== NET.lastSeq) { if (seq > NET.lastSeq) requestSync(); return; }
  applyDelta(obj); NET.lastSeq = seq;
}
const fromNet = S => Object.assign({}, S, { divs: Object.values(S.divs), battles: Object.values(S.battles), wars: Object.values(S.wars) });
function applyFull(S) {
  const first = !NET.S || !G.geo || G.seed !== S.seed || G.mapType !== S.mapType || (G.histYear || null) !== (S.histYear || null);
  NET.S = S;
  if (first) deserialize(fromNet(S));
  else lightApply(null);
  afterNetApply(first);
}
function applyDelta(patches) {
  const S = NET.S, dirty = { provs: new Set(), countries: new Set(), all: false };
  for (const [path, val, del] of patches) {
    if (!path.length) { NET.S = val; dirty.all = true; continue; }
    let o = S;
    for (let i = 0; i < path.length - 1; i++) { if (o[path[i]] == null) o[path[i]] = typeof path[i + 1] === 'number' ? [] : {}; o = o[path[i]]; }
    const k = path[path.length - 1];
    if (del) delete o[k]; else o[k] = val;
    if (path[0] === 'provs') { if (path.length > 1) dirty.provs.add(path[1]); else dirty.all = true; }
    if (path[0] === 'countries') { if (path.length > 1) dirty.countries.add(path[1]); else dirty.all = true; }
  }
  lightApply(dirty.all ? null : dirty);
  afterNetApply(false);
}
function decodeProv(p) {
  p.buildings = (p.buildings || []).map(b => Array.isArray(b) ? { id: b[0], t: b[1], x: b[2], z: b[3], r: b[4], lvl: b[5], prog: b[6], hp: b[7], upg: b[8] < 0 ? null : b[8], rep: b[9] < 0 ? null : b[9], organic: !!b[10] } : Object.assign({}, b));
  p.segs = (p.segs || []).map(g => Array.isArray(g) ? { id: g[0], t: g[1], x1: g[2], z1: g[3], x2: g[4], z2: g[5], prog: g[6], hp: g[7], rep: !!g[8] } : Object.assign({}, g));
}
// Copy replicated state into the live game objects (only what changed, when known)
function lightApply(dirty) {
  const S = NET.S;
  const provIdx = dirty ? dirty.provs : S.provs.keys();
  for (const i of provIdx) {
    const sp = S.provs[i], p = G.provs[i];
    if (!sp || !p) continue;
    if (dirty && (sp.fallout || 0) > (p.fallout || 0)) (G.blasts = G.blasts || []).push({ prov: p.id, t: performance.now() }); // a nuke just fell here
    for (const k of PROV_SAVE) p[k] = sp[k];
    decodeProv(p); p.dirty = true; p.cache = null;
  }
  const ctryIdx = dirty ? dirty.countries : S.countries.keys();
  for (const i of ctryIdx) { if (S.countries[i]) G.countries[i] = Object.assign(G.countries[i] || { agg: {}, _provs: [] }, S.countries[i]); }
  const old = new Map(G.divs.map(d => [d.id, d]));
  G.divs = Object.values(S.divs).map(sd => {
    const ex = old.get(sd.id), d = ex ? Object.assign(ex, sd) : Object.assign({}, sd);
    const key = d.owner + ':' + d.bats.join(',') + ':' + d.tank;
    if (!d.st || d._k !== key) { d.st = divStats(C(d.owner), d.bats, d.tank); d._k = key; }
    return d;
  });
  G.battles = Object.values(S.battles); G.wars = Object.values(S.wars);
  G.diplo = S.diplo; G.orgs = S.orgs || []; G.notes = S.notes || []; G.day = S.day; G.prices = S.prices; G.weather = S.weather || G.weather;
  G.nextId = S.nextId; G.netPopups = S.netPopups || [];
  G._bord = null; G.mapDirty = true;
}
function afterNetApply(first) {
  const S = NET.S;
  G.paused = S.paused; G.speed = S.speed;
  updateCountryAggregates();
  computeSupply();
  // which nation is ours
  const mine = G.countries.find(c => c.alive && c.netPeer === NET.myPeer && !c.ai);
  if (mine && NET.myCountry !== mine.id) {
    NET.myCountry = mine.id;
    if (UI.phase === 'pick' || UI.phase === 'menu') { G.player = mine.id; fade(() => startGame(mine.id, true)); }
  }
  if (NET.myCountry >= 0 && C(NET.myCountry) && !C(NET.myCountry).alive && UI.phase === 'game') {
    popup('Your Nation Has Fallen', `${C(NET.myCountry).name} has been wiped from the map. You can pick another nation still on the map.`, [{ label: 'Choose a nation', fn: () => { NET.myCountry = -1; enterPick('mp'); } }]);
  }
  G.player = NET.myCountry;
  if (first) { $('#loading').hidden = true; fitView(); enterPick('mp'); resolveNames(G.countries.filter(c => c.netBy).map(c => c.netBy)); }
  if (UI.phase === 'pick') renderPick();
  // results of our own commands, reported back by the host
  const c = C(NET.myCountry);
  if (c && c.netMsgs) for (const m of c.netMsgs) if (m.s > NET.seenMsg) { NET.seenMsg = m.s; toast(m.m, m.ok ? '' : 'bad'); }
  // popups the host addressed to us
  for (const P of G.netPopups) if (P.to === NET.myCountry && !NET.shownPopups.has(P.id)) { NET.shownPopups.add(P.id); showNetPopup(P); }
  if (G.popups.length) showNextPopup();
}
function showNetPopup(P) {
  const m = modal(esc(P.title), `<p class="pre">${esc(P.text)}</p>`, P.labels.map((label, idx) => ({
    label, fn: () => {
      const ui = P.ui[idx];
      if (ui && ui[0] === 'peace') { const w = G.wars.find(x => x.id === ui[1]); if (w) setTimeout(() => openPeace(w), 50); }
      cmd('popup', { id: P.id, idx });
    },
  })), { noClose: true, cls: 'event' });
  m.classList.add('popup');
}
function onClientPeers(ch) {
  if (NET.hostPeer && ch.left.some(p => p.peer === NET.hostPeer)) hostGone();
  resolveNames(ch.peers.map(p => p.by));
}
function hostGone() {
  if (NET.role !== 'client' || NET.goneShown) return;
  NET.goneShown = true;
  for (const t of NET.timers) clearInterval(t);
  NET.timers = [];
  const S = NET.S;
  popup('The host has left', 'The game\'s host closed their page, so the shared game has ended. You can keep playing this world on your own from here.', [
    { label: 'Continue offline', fn: () => netGoOffline() },
    { label: 'Main menu', fn: () => { netLeave(); toMenu(); } }], true);
  if (!S) { netLeave(); toMenu(); }
}
function netGoOffline() {
  const me = NET.myCountry;
  netLeave();
  for (const c of G.countries) if (c.id !== me) c.ai = true;
  G.player = me; G.paused = true;
  toast('Playing offline. Press Space to resume time.');
}
function netLeave() {
  if (NET.game) NET.game.leave().catch(() => {});
  for (const t of NET.timers) clearInterval(t);
  NET.timers = []; NET.game = null; NET.outQ = []; NET.prevSnap = null; NET.S = null; NET.role = null; NET.code = null;
  if (NET.room) NET.room.presence({ game: null }).catch(() => {});
}
// Custom painted/uploaded flag pictures are too large to send to the host; the rest of the flag is kept
function netFlagLayer(layer) { if (layer) toast('Painted or uploaded pictures on flags stay on your screen only in multiplayer.'); return null; }

// ============================================================
// Screens
// ============================================================
function openMultiplayer() {
  const body = document.createElement('div');
  body.className = 'mp';
  if (!NET.available) {
    body.innerHTML = `<p>Multiplayer works when this page is open inside claude.ai and you are signed in.</p>
      <p class="muted">Each player needs their own access: share the game with their claude.ai account (or your organization). People who open a public link can play alone but cannot join shared games.</p>`;
    modal('Multiplayer', body, [{ label: 'Close' }]);
    return;
  }
  body.innerHTML = `<p class="muted">Host a game and your friends join from this screen. The host's browser runs the world, so keep that tab open. Each player needs their own access to this game on claude.ai; a public link alone cannot join.</p>
    <h4>Open games</h4><div id="mp-games"></div>
    <h4>Join by code</h4><div class="inrow"><input type="text" id="mp-code" maxlength="12" placeholder="e.g. 7k2qp" style="max-width:160px"><button class="btn" id="mp-join">Join</button></div>`;
  const m = modal('Multiplayer', body, [{ label: 'Host a new game', fn: () => { setupDialog('host'); } }, { label: 'Close' }], { wide: true });
  m.querySelector('#mp-join').onclick = () => { netJoin(m.querySelector('#mp-code').value); };
  renderMpGames();
}
function renderMpGames() {
  const el = $('#mp-games'); if (!el || !NET.room) return;
  const games = NET.room.peers().filter(p => !p.sameTab && p.presence && p.presence.game && p.presence.game.code);
  el.innerHTML = games.length ? games.map(p => { const g = p.presence.game; return `<div class="drow"><span>${esc(String(g.title || 'Game').slice(0, 80))} <small>${+g.players || 1} player${(+g.players || 1) > 1 ? 's' : ''} · code ${esc(String(g.code).toUpperCase().slice(0, 12))}</small></span><button class="btn sm primary" data-mpjoin="${esc(String(g.code).slice(0, 12))}">Join</button></div>`; }).join('') : '<p class="muted">No open games right now. Host one, or ask a friend to.</p>';
  el.querySelectorAll('[data-mpjoin]').forEach(b => b.onclick = () => netJoin(b.dataset.mpjoin));
}
function showJoining() { const l = $('#loading'); l.hidden = false; NET.progress = 0; updateJoining(); }
function updateJoining() { const l = $('#loading'); if (!l.hidden) l.querySelector('span').textContent = NET.progress > 0 ? `Receiving the world… ${Math.round(NET.progress * 100)}%` : 'Joining… waiting for the host'; }
// In-game list of who is playing
function renderMpBox() {
  const el = $('#mpbox'); if (!el) return;
  if (!NET.role) { el.hidden = true; return; }
  el.hidden = false;
  const humans = G.countries.filter(c => c.alive && !c.ai);
  el.innerHTML = `<div class="mp-h">Multiplayer <small>code ${esc((NET.code || '').toUpperCase())}${NET.role === 'host' ? ' · you host' : ''}</small></div>` +
    humans.map(c => `<div class="mp-p">${flagImg(c, 20, 13)}<span>${esc(c.name)} <small>${esc(playerName(c))}${c.id === G.player ? ' (you)' : ''}</small></span></div>`).join('');
}
