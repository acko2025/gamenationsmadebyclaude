// ============================================================
// WAR OF NATIONS — player commands
// Every action that changes the world is a named command run for one nation.
// Offline (or as host) it runs here at once; a multiplayer client sends it to the host.
// ============================================================
'use strict';

const R = (ok, msg) => ({ ok, msg });
const own = (c, p) => p && p.owner === c.id && p.controller === c.id;
const ownDivs = (c, ids) => G.divs.filter(d => d.owner === c.id && ids.includes(d.id));
const findWar = id => G.wars.find(w => w.id === id);
const findOrg = id => (G.orgs || []).find(o => o.id === id);

const COMMANDS = {
  // ---- building ----
  build(c, a) { const r = placeBuilding(c, G.provs[a.p], a.t, a.x, a.z, a.r); return typeof r === 'string' ? R(false, r) : R(true, `${BUILDINGS[a.t].name}: construction started (${BUILDINGS[a.t].days} days).`); },
  seg(c, a) { const r = placeSegment(c, G.provs[a.p], a.t, clamp(a.x1, -96, 96), clamp(a.z1, -96, 96), clamp(a.x2, -96, 96), clamp(a.z2, -96, 96)); return typeof r === 'string' ? R(false, r) : R(true, `${SEGMENTS[a.t].name} laid (${Math.round(segLen(r))} m).`); },
  demolish(c, a) {
    const p = G.provs[a.p];
    if (!own(c, p)) return R(false, 'You do not control this province.');
    const b = a.kind === 'b' ? p.buildings.find(x => x.id === a.id) : p.segs.find(x => x.id === a.id);
    if (!b) return null;
    if (a.kind === 'b') c.treasury += (BUILDINGS[b.t].cost.money || 0) * COST_MUL * 0.25 * (b.hp / 100);
    demolish(p, a.id);
    return R(true, a.kind === 'b' ? `${BUILDINGS[b.t].name} demolished.` : `${SEGMENTS[b.t].name} removed.`);
  },
  upgrade(c, a) { const p = G.provs[a.p], b = p && p.buildings.find(x => x.id === a.id); if (!b || !own(c, p)) return null; const e = startUpgrade(c, p, b); return R(!e, e || 'Upgrade started.'); },
  repair(c, a) { const p = G.provs[a.p], b = p && p.buildings.find(x => x.id === a.id); if (!b || p.owner !== c.id) return null; const e = startRepair(c, p, b); return R(!e, e || 'Repairs started.'); },
  repairall(c, a) {
    const p = G.provs[a.p]; if (!own(c, p)) return null;
    let n = 0;
    for (const b of p.buildings) if (b.hp < 100 && b.rep == null && b.prog >= 1 && !startRepair(c, p, b)) n++;
    for (const g of p.segs) if (g.hp < 100 && !g.rep) { const cost = scaledCost(c, SEGMENTS[g.t].cost, segLen(g) / 10 * 0.5 * (1 - g.hp / 100)); if (canAfford(c, cost)) { pay(c, cost); g.rep = true; n++; } }
    return R(n > 0, n ? `Repairing ${n} structures.` : 'Nothing could be repaired (or not enough money).');
  },
  growth(c, a) { const p = G.provs[a.p]; if (!own(c, p)) return null; p.growth = !p.growth; return null; },
  quickbuild(c, a) {
    const p = G.provs[a.p];
    if (!p || p.owner !== c.id) return R(false, 'Select one of your provinces first.');
    const pos = autoPlace(p, a.t, Math.random);
    if (!pos) return R(false, `No room for a ${BUILDINGS[a.t].name} here. Enter the province to place it by hand.`);
    const r = placeBuilding(c, p, a.t, pos.x, pos.z, pos.r);
    return typeof r === 'string' ? R(false, r) : R(true, `${BUILDINGS[a.t].name} planned in ${p.name}.`);
  },
  colonize(c, a) {
    const p = G.provs[a.p];
    if (!p || p.owner >= 0 || !p.neighbors.concat(p.sea).some(n => G.provs[n].owner === c.id)) return R(false, 'You can only settle unclaimed land next to your own.');
    const cost = colonizeCost(c, p);
    if (c.treasury < cost) return R(false, 'Not enough money.');
    c.treasury -= cost; p.owner = p.controller = c.id; p.culture = c.culture; p.core = [c.id]; p.town = findTownCenter(p);
    const pos = autoPlace(p, 'cottage', Math.random);
    if (pos) p.buildings.push({ id: nid(), t: 'cottage', x: pos.x, z: pos.z, r: pos.r, lvl: 1, prog: 0, hp: 100 });
    markDirty(p); updateCountryAggregates();
    return R(true, `${p.name} has been settled.`);
  },
  renameprov(c, a) { const p = G.provs[a.p]; if (!p || p.owner !== c.id) return R(false, 'You can only rename your own provinces.'); p.name = String(a.name).slice(0, 40); return null; },
  renamecountry(c, a) { c.name = String(a.name).slice(0, 40); c.adj = adjectiveOf(c.name); return null; },
  flag(c, a) { c.flag = a.flag; return R(true, 'Flag updated.'); },
  // ---- military ----
  move(c, a) {
    let err = null, ok = 0;
    for (const d of ownDivs(c, a.ids)) { const e = orderMove(d, a.p); if (e) err = e; else ok++; }
    return err && !ok ? R(false, err) : ok ? R(true, `${ok} division${ok > 1 ? 's' : ''} ordered to ${G.provs[a.p].name}.`) : null;
  },
  divauto(c, a) { ownDivs(c, a.ids).forEach(d => { d.auto = a.on; }); return null; },
  divstop(c, a) { ownDivs(c, a.ids).forEach(d => { if (d.state === 'battle' || d.state === 'siege') leaveAttack(d); d.path = []; if (d.state !== 'training') d.state = 'idle'; d.auto = false; }); return null; },
  disband(c, a) { const ds = ownDivs(c, a.ids); for (const d of ds) c.manpower += d.st.mp * d.str * 0.8; G.divs = G.divs.filter(d => !ds.includes(d)); return R(true, `${ds.length} division(s) disbanded.`); },
  autoall(c, a) { G.divs.filter(d => d.owner === c.id).forEach(d => { d.auto = a.on; }); return R(true, a.on ? 'All divisions will advance on their own.' : 'Auto-advance off.'); },
  nuke(c, a) { const p = G.provs[a.p], e = launchNuke(c, p); return e ? R(false, e) : R(true, `${p.name} has been destroyed.`); },
  train(c, a) {
    const t = c.templates.find(x => x.id === a.tpl), p = G.provs[a.p];
    if (!t || !p) return R(false, 'Build Barracks first, then select that province.');
    const r = recruit(c, t, p);
    return typeof r === 'string' ? R(false, r) : R(true, `${r.name} is training in ${p.name} (${r.train} days).`);
  },
  template(c, a) {
    const bats = (a.bats || []).filter(b => BATTALIONS[b] && hasTech(c, BATTALIONS[b].tech)).slice(0, 10);
    const orig = c.templates.find(t => t.id === a.id);
    if (a.mode === 'delete') { if (orig && c.templates.length > 1) c.templates = c.templates.filter(t => t !== orig); return null; }
    if (!bats.length) return R(false, 'Add at least one battalion.');
    if (orig && a.mode === 'save') { orig.name = a.name; orig.bats = bats; }
    else c.templates.push({ id: nid(), name: a.name || 'Division', bats });
    return R(true, 'Template saved.');
  },
  design(c, a) {
    const d = a.d;
    if (!CHASSIS[d.chassis] || !GUNS[d.gun] || !hasTech(c, CHASSIS[d.chassis].tech) || !hasTech(c, GUNS[d.gun].tech)) return R(false, 'That design uses unresearched parts.');
    const nd = { id: nid(), name: String(d.name).slice(0, 30), chassis: d.chassis, gun: d.gun, armorLvl: clamp(d.armorLvl, 1, 5), engine: clamp(d.engine, 1, 3), radio: !!d.radio && hasTech(c, 't_radio'), sloped: !!d.sloped && hasTech(c, 't_tanks2') };
    c.designs.push(nd); c.lines.push({ eq: 'tank:' + nd.id, fac: 0, prog: 0 });
    return R(true, `${nd.name} approved. Assign factories in Production.`);
  },
  doctrine(c, a) {
    if (c.doctrine === a.k || !DOCTRINES[a.k]) return null;
    if (c.pp < 50) return R(false, 'Needs 50 political power.');
    c.pp -= 50; c.doctrine = a.k;
    for (const d of G.divs) if (d.owner === c.id) d.st = divStats(c, d.bats, d.tank);
    return null;
  },
  line(c, a) {
    if (a.op === 'add') c.lines.push({ eq: a.eq, fac: Math.min(1, c.facFree || 0) || 0, prog: 0 });
    else if (a.op === 'del') c.lines.splice(a.i, 1);
    else if (a.op === 'fac' && c.lines[a.i]) { const L = c.lines[a.i]; L.fac = Math.max(0, Math.round((L.fac + a.d * (c.agg.milFac >= 10 ? 1 : 0.5)) * 10) / 10); }
    return null;
  },
  // ---- research & government ----
  research(c, a) {
    const T = TECH_BY_ID[a.id];
    if (!T || c.techs.includes(T.id)) return null;
    if (canResearch(c, T)) { if (c.researching && c.researching !== T.id) c.rp *= 0.5; c.researching = T.id; c.queue = c.queue.filter(x => x !== T.id); return null; }
    const add = [];
    const walk = id => { const t = TECH_BY_ID[id]; for (const r of t.req) if (!c.techs.includes(r)) walk(r); if (!add.includes(id) && !c.techs.includes(id)) add.push(id); };
    walk(T.id);
    for (const x of add) if (!c.queue.includes(x) && x !== c.researching) c.queue.push(x);
    if (!c.researching) c.researching = c.queue.shift();
    return R(true, `Queued ${add.length} technologies.`);
  },
  clearqueue(c) { c.queue = []; return null; },
  law(c, a) {
    if (!['conscription', 'economy', 'trade'].includes(a.k) || c.laws[a.k] === a.v) return null;
    if (c.pp < 50) return R(false, 'Needs 50 political power.');
    c.pp -= 50; c.laws[a.k] = a.v; return R(true, 'Law changed.');
  },
  tax(c, a) { c.laws.tax = clamp(a.v, 0.05, 0.4); return null; },
  autoimport(c, a) { c.autoImport = !!a.v; return null; },
  gov(c, a) {
    if (!GOVERNMENTS[a.v] || c.gov === a.v) return null;
    if (c.pp < 150) return R(false, 'Needs 150 political power.');
    c.pp -= 150; c.stability -= 10; c.gov = a.v; return R(true, 'Government reformed: ' + GOVERNMENTS[c.gov].name);
  },
  ideology(c, a) { if (IDEOLOGIES.includes(a.v)) c.ideology = a.v; return R(true, 'Ideology changed.'); },
  order(c, a) { if (!RES_PRICE[a.r]) return null; const step = ['food', 'wood', 'stone'].includes(a.r) ? 5 : 2; c.orders[a.r] = (c.orders[a.r] || 0) + Math.sign(a.d) * step; return null; },
  release(c, a) {
    const ps = c._provs.filter(p => p.culture === a.culture && p.id !== c.capital).map(p => p.id);
    if (!ps.length) return null;
    releaseNation(ps, null, c.id); return R(true, 'Subject state released.');
  },
  // ---- diplomacy ----
  diplo(c, a) {
    if (!C(a.t) || !C(a.t).alive) return null;
    if (!C(a.t).ai && ['alliance', 'defensive', 'nap', 'access', 'trade', 'federation', 'exchange'].includes(a.action)) return proposeToHuman(c, a);
    const r = diploAction(c.id, a.t, a.action, a.extra || {});
    G.mapDirty = true;
    return R(r.ok, r.msg);
  },
  dcancel(c, a) { const r = diploAction(c.id, a.t, 'cancel', { type: a.type }); G.mapDirty = true; return R(r.ok, r.msg); },
  peace(c, a) {
    const w = findWar(a.war);
    if (!w) return R(false, 'That war is over.');
    const side = w.att.includes(c.id) ? 'att' : w.def.includes(c.id) ? 'def' : null;
    if (!side || (side === 'att' ? w.att[0] : w.def[0]) !== c.id) return R(false, 'Only the war leader can negotiate.');
    const enemies = (side === 'att' ? w.def : w.att).filter(x => C(x).alive);
    const score = warScore(w, side);
    const total = w.capitulated || enemies.every(x => w.cap.includes(x));
    const enemyLeader = side === 'att' ? w.def[0] : w.att[0];
    if (a.white) {
      if (score < -10 && !total) return R(false, 'The enemy is winning and refuses a white peace.');
      if (isHuman(enemyLeader) && !total) return offerPeaceToHuman(c, w, enemyLeader, {}, 'a white peace');
      makePeace(w, {}); return R(true, 'White peace signed.');
    }
    const t = a.terms || {};
    let cost = 0;
    for (const x of t.transfers || []) { const p = G.provs[x.prov]; if (!p || !enemies.includes(p.owner)) return R(false, 'Invalid demands.'); x.to = c.id; cost += provDemandCost(w, side, p); }
    for (const x of t.puppets || []) { if (!enemies.includes(x.sub)) return R(false, 'Invalid demands.'); x.over = c.id; cost += 30 + C(x.sub).nProv * 2; }
    for (const x of t.reparations || []) { if (!enemies.includes(x.from)) return R(false, 'Invalid demands.'); x.to = c.id; x.amount = Math.max(100, (C(x.from).income || 5) * 120); cost += 12; }
    for (const x of t.release || []) { x.over = c.id; x.provs = (x.provs || []).filter(id => G.provs[id] && enemies.includes(G.provs[id].owner)); cost += 15; }
    const avail = total ? 200 : Math.max(0, score);
    if (cost > avail) return R(false, 'The enemy rejects these demands: they exceed your war score.');
    if (isHuman(enemyLeader) && !total) return offerPeaceToHuman(c, w, enemyLeader, t, `these terms (${t.transfers ? t.transfers.length : 0} provinces)`);
    makePeace(w, t); return R(true, 'Peace treaty signed.');
  },
  // ---- organizations ----
  orgfound(c, a) {
    if (c.pp < ORG_FOUND_PP) return R(false, `Needs ${ORG_FOUND_PP} political power.`);
    if (orgsOf(c.id).length >= ORG_MAX_MEMBERSHIPS) return R(false, `You can belong to at most ${ORG_MAX_MEMBERSHIPS} organizations.`);
    if (!ORG_TYPES[a.spec.type] || !String(a.spec.name || '').trim()) return R(false, 'Give the organization a name.');
    c.pp -= ORG_FOUND_PP;
    const o = foundOrg(c.id, { name: String(a.spec.name).slice(0, 40), type: a.spec.type, color: a.spec.color, desc: String(a.spec.desc || '').slice(0, 300), flag: a.spec.flag });
    return Object.assign(R(true, `${o.name} founded. Invite members from the Organizations tab.`), { org: o.id });
  },
  orgedit(c, a) { const o = findOrg(a.org); if (!o || o.founder !== c.id) return null; Object.assign(o, { name: String(a.spec.name).slice(0, 40), color: hexToRgb(a.spec.color), desc: String(a.spec.desc || '').slice(0, 300), flag: a.spec.flag }); return R(true, 'Organization updated.'); },
  orginvite(c, a) { const o = findOrg(a.org); if (!o || !o.members.includes(c.id) || !C(a.t)) return null; const r = orgInvite(o, c.id, a.t); return R(r.ok, r.msg); },
  orgapply(c, a) {
    const o = findOrg(a.org); if (!o) return null;
    if (orgsOf(c.id).length >= ORG_MAX_MEMBERSHIPS) return R(false, `You can belong to at most ${ORG_MAX_MEMBERSHIPS} organizations.`);
    if (isHuman(o.founder)) { popupFor(o.founder, 'Membership request', `${c.name} asks to join the ${o.name}.`, [{ label: 'Admit', fn: () => { if (!o.members.includes(c.id)) o.members.push(c.id); noteFor(c.id, 'diplo', `You joined the ${o.name}.`); } }, { label: 'Refuse', fn: () => noteFor(c.id, 'diplo', `Your request to join the ${o.name} was refused.`) }]); return R(true, 'Request sent to the founder.'); }
    const r = orgApply(o, c.id); return R(r.ok, r.msg);
  },
  orgleave(c, a) { const o = findOrg(a.org); if (!o) return null; removeFromOrg(o, c.id); return R(true, `You left the ${o.name}.`); },
  orgkick(c, a) { const o = findOrg(a.org); if (!o || o.founder !== c.id) return null; removeFromOrg(o, a.m); relAdd(c.id, a.m, -20); return R(true, `${C(a.m).name} was expelled.`); },
  orgdissolve(c, a) { const o = findOrg(a.org); if (!o || o.founder !== c.id) return null; dissolveOrg(o); return null; },
  // ---- answers to popups sent to a remote player ----
  popup(c, a) {
    const P = (G.netPopups || []).find(x => x.id === a.id && x.to === c.id);
    if (!P) return null;
    G.netPopups = G.netPopups.filter(x => x !== P);
    const fns = NET.popupFns.get(a.id) || [];
    NET.popupFns.delete(a.id);
    if (!P.ui[a.idx] && fns[a.idx]) fns[a.idx]();
    return null;
  },
};
// Treaties between two human players need the other player's consent
function proposeToHuman(c, a) {
  const t = C(a.t), A = DIPLO_ACTIONS[a.action];
  if (c.pp < A.pp) return R(false, `Needs ${A.pp} political power.`);
  if (hasTreaty(a.action, c.id, a.t)) return R(false, 'Treaty already exists.');
  c.pp -= A.pp;
  popupFor(a.t, A.name.replace(/^(Propose|Request) /, '') + ' proposal', `${c.name} proposes: ${A.name.toLowerCase()}.`, [
    { label: 'Accept', fn: () => {
      if (a.action === 'access') G.diplo.treaties.push({ type: 'access', a: a.t, b: c.id, since: G.day });
      else if (a.action === 'federation') { for (const p of G.provs) if (p.owner === a.t) { p.owner = p.controller = c.id; markDirty(p); } for (const d of G.divs) if (d.owner === a.t) d.owner = c.id; killCountry(t); updateCountryAggregates(); }
      else if (a.action === 'exchange') { const pg = G.provs[a.extra.give], pt = G.provs[a.extra.take]; if (pg.owner === c.id && pt.owner === a.t) { pg.owner = pg.controller = a.t; pt.owner = pt.controller = c.id; markDirty(pg); markDirty(pt); updateCountryAggregates(); } }
      else addTreaty(a.action, c.id, a.t);
      relAdd(c.id, a.t, 10); noteAll([c.id, a.t], 'diplo', `${c.name} and ${t.name}: ${A.name.replace(/^(Propose|Request) /, '').toLowerCase()} agreed.`);
    } },
    { label: 'Decline', fn: () => noteFor(c.id, 'diplo', `${t.name} declined: ${A.name.toLowerCase()}.`) }]);
  return R(true, `Proposal sent to ${t.name}.`);
}
function offerPeaceToHuman(c, w, to, terms, what) {
  popupFor(to, 'Peace proposal', `${c.name} offers to end the ${w.name} with ${what}.`, [
    { label: 'Accept peace', fn: () => { if (G.wars.includes(w)) makePeace(w, terms); } },
    { label: 'Fight on', fn: () => noteFor(c.id, 'diplo', `${C(to).name} rejected your peace proposal.`) }], true);
  return R(true, `Peace proposal sent to ${C(to).name}.`);
}

// Run a command for the local player. Returns the result offline/as host; {pending:true} as a client.
function cmd(type, args) {
  if (typeof NET !== 'undefined' && NET.role === 'client') { NET.send(type, args || {}); return { pending: true }; }
  const c = C(G.player);
  if (!c || !COMMANDS[type]) return null;
  const r = COMMANDS[type](c, args || {});
  G.mapDirty = true;
  return r;
}
// Show a command's result (nothing for a client's pending command; the host's answer arrives later)
function showRes(r) { if (r && !r.pending && r.msg) toast(r.msg, r.ok ? '' : 'bad'); return r; }
