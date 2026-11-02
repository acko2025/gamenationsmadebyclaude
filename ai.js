// ============================================================
// WAR OF NATIONS — diplomacy actions and AI nations
// ============================================================
'use strict';

const DIPLO_ACTIONS = {
  improve: { name: 'Improve relations', pp: 25 },
  alliance: { name: 'Propose alliance', pp: 40 },
  defensive: { name: 'Defensive pact', pp: 30 },
  nap: { name: 'Non-aggression pact', pp: 20 },
  access: { name: 'Request military access', pp: 15 },
  trade: { name: 'Trade agreement', pp: 15 },
  guarantee: { name: 'Guarantee independence', pp: 25 },
  justify: { name: 'Justify war goal', pp: 50 },
  declare: { name: 'Declare war', pp: 0 },
  demand: { name: 'Demand province', pp: 30 },
  exchange: { name: 'Exchange territory', pp: 20 },
  federation: { name: 'Form federation', pp: 100 },
  coalition: { name: 'Form coalition against', pp: 60 },
  support: { name: 'Support independence', pp: 20 },
  annex: { name: 'Annex subject', pp: 120 },
  cancel: { name: 'Cancel treaty', pp: 0 },
};

function threatOf(c, other) { return sideStrength(other) / sideStrength(c.id); }
function aiOpinion(t, a, action, extra) {
  // t = AI evaluating, a = proposer. Returns [score, reason]
  const ct = C(t), ca = C(a);
  const r = rel(t, a);
  const same = ct.ideology === ca.ideology ? 15 : 0;
  const theirEnemies = G.wars.filter(w => w.att.includes(a) || w.def.includes(a));
  let s = 0, why = '';
  if (action === 'alliance' || action === 'defensive') {
    s = r - (action === 'alliance' ? 45 : 30) + same;
    const nA = G.diplo.treaties.filter(x => x.type === 'alliance' && (x.a === t || x.b === t)).length;
    s -= nA * 8;
    if (action === 'alliance' && theirEnemies.length) s -= 20;
    for (const o of G.countries) if (o.alive && o.id !== t && o.id !== a && rel(t, o.id) < -30 && rel(a, o.id) < -30) s += 15;
    why = s > 0 ? 'Our interests align.' : r < 40 ? 'We do not trust you enough.' : 'An alliance would drag us into your conflicts.';
  } else if (action === 'nap') {
    s = r + 15 + (threatOf(ct, a) > 1 ? 20 : -5) - (ct.personality === 'expansionist' ? 20 : 0);
    why = s > 0 ? 'Peace on our border suits us.' : 'We prefer to keep our options open.';
  } else if (action === 'access') {
    s = r - 20 + (theirEnemies.some(w => (w.att.includes(a) ? w.def : w.att).some(e => rel(t, e) < -20)) ? 25 : 0);
    why = s > 0 ? 'Your troops may pass.' : 'Foreign troops are not welcome here.';
  } else if (action === 'trade') {
    s = r + 10 + (ct.personality === 'merchant' ? 25 : 0) - (ct.laws.trade === 'closed' ? 100 : 0);
    why = s > 0 ? 'Trade benefits both our peoples.' : 'We see no profit in it.';
  } else if (action === 'demand') {
    const ratio = sideStrength(a) / sideStrength(t);
    s = (ratio - 2.5) * 30 + r * 0.3;
    why = s > 0 ? 'We yield before your strength.' : 'Come and take it, if you can.';
  } else if (action === 'exchange') {
    const give = provValue(G.provs[extra.give]), take = provValue(G.provs[extra.take]);
    s = (give / take - 1.1) * 60 + r * 0.3;
    why = s > 0 ? 'A fair exchange.' : 'That trade is not in our favour.';
  } else if (action === 'federation') {
    s = r - 80 + (hasTreaty('alliance', t, a) ? 20 : -40) + same + (ct.agg.pop < ca.agg.pop * 0.6 ? 15 : -30) + (threatOf(ct, a) > 1.5 ? 10 : 0);
    why = s > 0 ? 'Together we are stronger. We accept the union.' : 'We will not surrender our sovereignty.';
  } else if (action === 'peace') {
    s = extra.score - extra.cost;
    why = s >= 0 ? 'We accept these terms.' : 'Your demands exceed what you have won.';
  }
  return [s, why];
}

function diploAction(a, t, action, extra) {
  const ca = C(a), ct = t >= 0 ? C(t) : null, A = DIPLO_ACTIONS[action];
  extra = extra || {};
  if (A && ca.pp < A.pp) return { ok: false, msg: `Needs ${A.pp} political power.` };
  const isAI = ct && ct.ai;
  const accept = () => { if (!isAI) return [true, '']; const [s, why] = aiOpinion(t, a, action, extra); return [s > 0, why]; };
  if (ct && atWar(a, t) && !['cancel'].includes(action)) return { ok: false, msg: 'You are at war.' };
  switch (action) {
    case 'improve': ca.pp -= A.pp; relAdd(a, t, 15); return { ok: true, msg: `Relations with ${ct.name} improved.` };
    case 'alliance': case 'defensive': case 'nap': case 'access': case 'trade': {
      if (hasTreaty(action, a, t)) return { ok: false, msg: 'Treaty already exists.' };
      const [ok, why] = accept();
      ca.pp -= A.pp;
      if (!ok) { relAdd(a, t, -3); return { ok: false, msg: `${ct.name} declined. "${why}"` }; }
      if (action === 'access') G.diplo.treaties.push({ type: 'access', a: t, b: a, since: G.day }); else addTreaty(action, a, t);
      relAdd(a, t, 10);
      note('diplo', `${ca.name} and ${ct.name} signed: ${A.name.replace(/^(Propose|Request) /, '')}.`, ct.capital, [a, t]);
      return { ok: true, msg: `${ct.name} accepted. "${why}"` };
    }
    case 'guarantee': ca.pp -= A.pp; G.diplo.treaties.push({ type: 'guarantee', a, b: t, since: G.day }); relAdd(a, t, 15); return { ok: true, msg: `You now guarantee the independence of ${ct.name}.` };
    case 'justify':
      if (ca.justifying) return { ok: false, msg: 'Already justifying a war goal.' };
      if (ca.wargoals.includes(t)) return { ok: false, msg: 'War goal already exists.' };
      if (allied(a, t)) return { ok: false, msg: 'Cannot justify against an ally.' };
      ca.pp -= A.pp; ca.justifying = { target: t, left: 30 + Math.round(ct.nProv * 1.5) }; relAdd(a, t, -15);
      noteFor(t, 'diplo', `${ca.name} is justifying a war goal against us!`, ca.capital);
      return { ok: true, msg: `Justifying a war goal against ${ct.name} (${ca.justifying.left} days).` };
    case 'declare': {
      if (G.diplo.truces[pairKey(a, t)] > G.day) return { ok: false, msg: `A truce is in force until ${dateStr(G.diplo.truces[pairKey(a, t)])}.` };
      if (allied(a, t)) return { ok: false, msg: 'Cancel the alliance first.' };
      if (sharePeaceOrg(a, t)) { const o = G.orgs.find(x => x.type === 'peace' && x.members.includes(a) && x.members.includes(t)); return { ok: false, msg: `You are both bound by the ${o.name}. Leave it first (Organizations tab).` }; }
      if (hasTreaty('nap', a, t)) { removeTreaty('nap', a, t); ca.stability -= 10; for (const c of G.countries) relAdd(c.id, a, -8); }
      const err = declareWar(a, t, extra.reason || (ca.wargoals.includes(t) ? 'Justified claims' : 'Unjustified aggression'));
      return err ? { ok: false, msg: err } : { ok: true, msg: `War declared on ${ct.name}.` };
    }
    case 'demand': {
      const p = G.provs[extra.prov];
      if (!p || p.owner !== t) return { ok: false, msg: 'Select one of their provinces.' };
      ca.pp -= A.pp;
      const [ok, why] = accept();
      if (!ok) { relAdd(a, t, -20); return { ok: false, msg: `${ct.name} refused. "${why}"` }; }
      p.owner = p.controller = a; markDirty(p); relAdd(a, t, -30); updateCountryAggregates();
      note('diplo', `${ct.name} ceded ${p.name} to ${ca.name}.`, p.id, [a, t]);
      return { ok: true, msg: `${ct.name} ceded ${p.name}. "${why}"` };
    }
    case 'exchange': {
      const pg = G.provs[extra.give], pt = G.provs[extra.take];
      if (!pg || !pt || pg.owner !== a || pt.owner !== t || pg.id === ca.capital) return { ok: false, msg: 'Pick one of your provinces (not the capital) and one of theirs.' };
      ca.pp -= A.pp;
      const [ok, why] = accept();
      if (!ok) return { ok: false, msg: `${ct.name} declined. "${why}"` };
      pg.owner = pg.controller = t; pt.owner = pt.controller = a; markDirty(pg); markDirty(pt);
      for (const d of G.divs) if ((d.prov === pg.id && d.owner === a) || (d.prov === pt.id && d.owner === t)) sendHome(d);
      updateCountryAggregates();
      return { ok: true, msg: `Exchanged ${pg.name} for ${pt.name}.` };
    }
    case 'federation': {
      ca.pp -= A.pp;
      const [ok, why] = accept();
      if (!ok) { relAdd(a, t, -5); return { ok: false, msg: `${ct.name} refused. "${why}"` }; }
      for (const p of G.provs) if (p.owner === t) { p.owner = p.controller = a; markDirty(p); }
      for (const d of G.divs) if (d.owner === t) d.owner = a;
      ca.treasury += Math.max(0, ct.treasury); for (const k in ct.equip) ca.equip[k] = (ca.equip[k] || 0) + (ct.equip[k] || 0);
      if (ca.gov !== 'empire') ca.gov = 'federation';
      killCountry(ct); updateCountryAggregates();
      note('world', `${ct.name} has joined ${ca.name} in a federation.`, ca.capital);
      return { ok: true, msg: `${ct.name} has joined your federation. "${why}"` };
    }
    case 'coalition': {
      ca.pp -= A.pp;
      const joined = [];
      for (const o of G.countries) {
        if (!o.alive || o.id === a || o.id === t || atWar(o.id, a)) continue;
        if (rel(o.id, t) < -5 && rel(o.id, a) > 0 && strength(t) > strength(o.id) * 0.8) { addTreaty('defensive', a, o.id); relAdd(o.id, t, -10); joined.push(o.name); }
      }
      relAdd(a, t, -25);
      return joined.length ? { ok: true, msg: `Coalition formed against ${ct.name}: ${joined.join(', ')} signed defensive pacts with you.` } : { ok: false, msg: `No nation was willing to join a coalition against ${ct.name}.` };
    }
    case 'support': {
      const p = G.provs[extra.prov];
      if (!p || p.owner !== t) return { ok: false, msg: 'Select one of their provinces first.' };
      ca.pp -= A.pp; ca.support = { prov: p.id }; relAdd(a, t, -15);
      return { ok: true, msg: `Funding separatists in ${p.name} (5 PP and money per month).` };
    }
    case 'annex': {
      if (ct.overlord !== a) return { ok: false, msg: 'Only subjects can be annexed.' };
      ca.pp -= A.pp;
      for (const p of G.provs) if (p.owner === t) { p.owner = p.controller = a; markDirty(p); }
      for (const d of G.divs) if (d.owner === t) d.owner = a;
      killCountry(ct); updateCountryAggregates();
      return { ok: true, msg: `${ct.name} has been annexed.` };
    }
    case 'cancel': {
      const tt = extra.type;
      removeTreaty(tt, a, t); G.diplo.treaties = G.diplo.treaties.filter(x => !(x.type === tt && ((x.a === a && x.b === t) || (x.a === t && x.b === a))));
      relAdd(a, t, -10);
      return { ok: true, msg: 'Treaty cancelled.' };
    }
  }
  return { ok: false, msg: 'Unknown action' };
}

// ------------------------------------------------------------
// AI: monthly strategic decisions
// ------------------------------------------------------------
const OBSOLETE = { cottage: 'apartments', blacksmith: 'armsfactory', castle: 'fortress', barracks: 'militarybase', library: 'university', watchtower: 'radar', windmill: 'factory' };
function aiMonthly(c) {
  if (!c.alive) return;
  const pers = PERSONALITIES[c.personality] || PERSONALITIES.defensive;
  // Research
  if (!c.researching && !c.queue.length) {
    const avail = TECHS.filter(T => canResearch(c, T));
    if (avail.length) {
      avail.sort((x, y) => aiTechScore(c, y, pers) - aiTechScore(c, x, pers));
      c.researching = avail[0].id;
    }
  }
  // Laws
  const war = inWar(c.id);
  if (war && c.laws.economy === 'civilian' && c.pp > 60) { c.laws.economy = 'partial'; c.pp -= 50; }
  else if (war && c.laws.economy === 'partial' && c.pp > 80 && c.stability > 50) { c.laws.economy = 'war'; c.pp -= 50; }
  else if (!war && c.laws.economy === 'war' && c.pp > 60) { c.laws.economy = 'partial'; c.pp -= 50; }
  if (c.manpower < 3000 * (1 + c.era) && c.laws.conscription < 2 && c.pp > 60 && c.stability > 45) { c.laws.conscription++; c.pp -= 50; }
  if (c.treasury < 0 && c.laws.tax < 0.3) c.laws.tax = Math.round((c.laws.tax + 0.05) * 100) / 100;
  else if (c.treasury > 2000 * (1 + c.era) && c.laws.tax > 0.1) c.laws.tax = Math.round((c.laws.tax - 0.05) * 100) / 100;
  if (c.era >= 3) autoDesign(c);
  setupTemplates(c);
  // surplus treasury buys arms abroad so it turns into military strength
  const reserve = 3000 * (1 + c.era);
  if (c.treasury > reserve * 2) {
    const spend = (c.treasury - reserve) * 0.25;
    c.treasury -= spend;
    c.equip.arms += spend * 0.45 / (EQUIP.arms.cost * 3);
    c.equip.artillery += spend * 0.3 / (EQUIP.artillery.cost * 3);
    c.equip.vehicles += spend * 0.25 / (EQUIP.vehicles.cost * 3);
  }
  aiBuild(c, pers);
  aiProduction(c);
  aiNuke(c, pers);
  aiRecruit(c, pers);
  aiDiplomacy(c, pers);
}
// A nation that is losing badly may use the bomb as a last resort, on the enemy's largest army near its border
function aiNuke(c, pers) {
  if ((c.equip.nukes || 0) < 1 || !inWar(c.id)) return;
  const losing = G.wars.some(w => (w.att.includes(c.id) || w.def.includes(c.id)) && warScore(w, w.att.includes(c.id) ? 'att' : 'def') <= -30);
  if (!losing || Math.random() > 0.15 * pers.war) return;
  const en = enemiesOf(c.id);
  let best = null, bs = 0;
  for (const p of G.provs) {
    if (!en.has(p.controller) || p.fallout > G.day) continue;
    const hostile = G.divs.filter(d => d.prov === p.id && en.has(d.owner)).length;
    const near = p.neighbors.some(n => G.provs[n].owner === c.id);
    const s = hostile * 2 + (near ? 2 : 0) + (C(p.controller).capital === p.id ? 1 : 0);
    if (s > bs) { bs = s; best = p; }
  }
  if (best && bs >= 4) launchNuke(c, best);
}
function aiTechScore(c, T, pers) {
  let s = 100 / T.cost;
  if (pers.research.includes(T.b)) s *= 2.2;
  if (T.id === ERAS[Math.min(5, c.era + 1)].key) s *= 2.5;
  if (T.b === 'military' && inWar(c.id)) s *= 1.6;
  if (T.era > c.era + 1) s *= 0.2;
  return s + Math.random() * 0.3;
}
function aiBuild(c, pers) {
  const active = c._provs.reduce((n, p) => n + p.buildings.filter(b => b.prog < 1).length, 0);
  const cap = 2 + c.agg.civFac * 0.4 + c.era + Math.min(8, c.treasury / (1200 * (1 + c.era)));
  if (active >= cap) return;
  const rng = Math.random;
  const avail = Object.keys(BUILDINGS).filter(t => hasTech(c, BUILDINGS[t].tech) && !(OBSOLETE[t] && hasTech(c, BUILDINGS[OBSOLETE[t]].tech)));
  const own = c._provs.filter(p => p.controller === c.id);
  if (!own.length) return;
  const wants = [];
  const W = (t, w, provFilter) => { if (avail.includes(t)) wants.push([t, w * (pers.build[BUILDINGS[t].cat] || 1) * (0.7 + rng() * 0.6), provFilter]); };
  const f = c.flow || {};
  if ((f.food || 0) < 2) W('farm', 6, p => p.fert > 0.6);
  const crowded = own.filter(p => p.pop > provStats(p).housing * 0.9);
  if (crowded.length) { W('cottage', 4, p => p.pop > provStats(p).housing * 0.9); W('apartments', 4, p => p.pop > provStats(p).housing * 0.9); W('skyscraper', 2, p => p.pop > provStats(p).housing * 0.9 && p.pop > 400000); }
  if (c.agg.recruit < 1) W('barracks', 10); W('militarybase', c.agg.recruit < 1 ? 10 : 0.3);
  if (c.era >= 2 && c.stock.steel < 50) W('steelmill', 4, p => p.dep.iron || p.dep.coal);
  if (c.stock.iron < 40 || (c.era >= 2 && c.stock.coal < 40)) W('mine', 4, p => (p.dep.iron || p.dep.coal) && !p.buildings.some(b => b.t === 'mine'));
  if (c.era >= 3 && c.stock.oil < 60) W('refinery', 3, p => p.dep.oil > 0);
  if (c.era >= 3 && (c.flow.elec || 0) < 1) W('powerplant', 3);
  if (c.era >= 2 && c.stock.rubber < 30) W('plantation', 1.5, p => p.dep.rubber > 0);
  const roomForTrade = p => provStats(p).money < provStats(p).moneyCap - 1;
  W('market', 1.2, roomForTrade); W('factory', 2); W('lumbercamp', c.stock.wood < 60 ? 3 : 0.3, p => p.terrain === 'forest');
  W('blacksmith', 1.2 * pers.army); W('armsfactory', 2 * pers.army); W('tankfactory', 1.4 * pers.army);
  const lowR = c.agg.research < 0.6 + c.nProv * 0.02;
  W('library', lowR ? 4 : 0.5); W('university', lowR ? 4 : 0.8); W('researchcenter', lowR ? 4 : 1);
  W('townhall', 0.8, p => !p.buildings.some(b => b.t === 'townhall')); W('cathedral', c.stability < 45 ? 3 : 0.5); W('govbuilding', 0.8);
  W('palace', 1, p => p.id === c.capital);
  const border = own.filter(p => p.neighbors.some(n => G.provs[n].owner !== c.id && G.provs[n].owner >= 0));
  if (border.length) { W('castle', 1.2, p => border.includes(p) && provStats(p).fort < 2); W('fortress', 1.2, p => border.includes(p) && provStats(p).fort < 3); W('watchtower', 0.8, p => border.includes(p)); W('radar', 0.5, p => border.includes(p)); }
  W('harbor', 1.5, p => p.coastal && !p.buildings.some(b => b.t === 'harbor'));
  W('shipyard', 0.6, p => p.coastal); W('airbase', c.era >= 3 ? 1 : 0); W('railstation', 1); W('stables', c.agg.cavalry < 1 && c.era <= 2 ? 2 : 0.2);
  W('fusion', 2); W('arcology', 1.5);
  wants.sort((x, y) => y[1] - x[1]);
  let budget = Math.min(5, Math.floor(cap - active));
  for (const [t, , filt] of wants.slice(0, 8)) {
    if (budget <= 0) break;
    const B = BUILDINGS[t];
    const cost = scaledCost(c, B.cost);
    if (costMoneyEquivalent(c, cost) > c.treasury * 0.6) continue;
    let cands = own.filter(p => (!filt || filt(p)) && (!B.coastal || p.coastal));
    if (!cands.length) continue;
    cands.sort((x, y) => (y.pop * (y.id === c.capital ? 2 : 1)) - (x.pop * (x.id === c.capital ? 2 : 1)));
    const p = cands[Math.floor(rng() * Math.min(4, cands.length))];
    const pos = autoPlace(p, t, rng);
    if (!pos) continue;
    const r = placeBuilding(c, p, t, pos.x, pos.z, pos.r);
    if (typeof r === 'object' && B.r >= 5 && p.town && Math.hypot(pos.x - p.town.x, pos.z - p.town.z) > 14 && hasTech(c, null)) {
      const cost2 = scaledCost(c, SEGMENTS.road.cost, Math.hypot(pos.x - p.town.x, pos.z - p.town.z) / 10);
      if (canAfford(c, cost2)) { pay(c, cost2); p.segs.push({ id: nid(), t: c.era >= 2 && rng() < 0.2 && hasTech(c, 't_rail') ? 'rail' : 'road', x1: p.town.x, z1: p.town.z, x2: pos.x, z2: pos.z, prog: 0, hp: 100 }); }
    }
    if (typeof r === 'object') budget--;
  }
  // Repairs
  for (const p of own) for (const b of p.buildings) if (b.hp < 60 && b.rep == null && b.prog >= 1 && c.treasury > 200) { startRepair(c, p, b); return; }
  for (const p of own) for (const g of p.segs) if (g.hp < 60 && !g.rep && c.treasury > 100) { g.rep = true; c.treasury -= 10; }
}
function aiProduction(c) {
  const shares = [['arms', 0.4], ['artillery', 0.2], ['support', 0.05]];
  if (c.era >= 3) { shares.push(['vehicles', 0.1]); const d = c.designs[c.designs.length - 1]; if (d) shares.push(['tank:' + d.id, 0.25]); if (c.agg.air >= 1) shares.push(['aircraft', 0.1]); }
  if (c.agg.port >= 1 && (c.equip.ships || 0) < 6) shares.push(['ships', 0.05]);
  if (hasTech(c, 't_nukes') && (c.equip.nukes || 0) < 3) shares.push(['nukes', 0.04]);
  const tot = shares.reduce((s, x) => s + x[1], 0);
  const fac = c.agg.milFac;
  const old = {}; for (const L of c.lines) old[L.eq] = L.prog || 0;
  c.lines = shares.map(([eq, w]) => ({ eq, fac: Math.max(0, Math.round(fac * w / tot * 10) / 10), prog: old[eq] || 0 })).filter(L => L.fac > 0);
  // avoid hoarding: if plenty of arms, shift to artillery/tanks
  if ((c.equip.arms || 0) > 3000 * (1 + c.era)) c.lines.forEach(L => { if (L.eq === 'arms') L.fac *= 0.3; });
}
function aiRecruit(c, pers) {
  const mine = G.divs.filter(d => d.owner === c.id);
  const war = inWar(c.id);
  // surplus money goes into a larger standing army
  const surplus = Math.min(c.nProv * 0.5, Math.floor(c.treasury / (2500 * (1 + c.era))));
  const desired = Math.round(Math.max(2, c.nProv * 0.4 * pers.army * (war ? 1.5 : 1)) + c.era * 0.5 + surplus);
  if (mine.length >= desired) return;
  const sites = c._provs.filter(p => p.controller === c.id && provStats(p).recruit >= 1);
  if (!sites.length) return;
  const tpls = [...c.templates].reverse();
  for (let k = 0; k < 2; k++) {
    for (const tpl of tpls) {
      const site = sites[Math.floor(Math.random() * sites.length)];
      if (!recruitCheck(c, tpl, site)) { recruit(c, tpl, site); break; }
    }
  }
}
function aiDiplomacy(c, pers) {
  const others = G.countries.filter(o => o.alive && o.id !== c.id);
  const rng = Math.random;
  // Pending war goal → declare
  for (const t of [...c.wargoals]) {
    const ct = C(t);
    if (!ct.alive || allied(c.id, t) || sharePeaceOrg(c.id, t)) { c.wargoals = c.wargoals.filter(x => x !== t); continue; }
    if (!inWar(c.id) && sideStrength(c.id) > sideStrength(t) * 1.15 && !(G.diplo.truces[pairKey(c.id, t)] > G.day)) {
      const claims = G.provs.filter(p => p.owner === t && (p.core || []).includes(c.id)).length;
      const reason = claims ? 'Reclaiming lost provinces' : rel(c.id, t) < -40 ? 'Border dispute' : PERSONALITIES[c.personality].name.includes('empire') ? 'Imperial expansion' : 'Strategic territory';
      if (hasTreaty('nap', c.id, t)) removeTreaty('nap', c.id, t);
      declareWar(c.id, t, reason);
      return;
    }
  }
  // Considering war
  if (!inWar(c.id) && !c.justifying && G.day - c.lastWar > 500 && c.stability > 40 && c.overlord < 0 && rng() < 0.3 * pers.war) {
    const nbs = others.filter(o => bordering(c.id, o.id) && !allied(c.id, o.id) && !sharePeaceOrg(c.id, o.id) && o.overlord !== c.id && rel(c.id, o.id) < 50 && !(G.diplo.truces[pairKey(c.id, o.id)] > G.day));
    let best = null, bs = 0;
    for (const o of nbs) {
      const ratio = sideStrength(c.id) / sideStrength(o.id);
      const claims = G.provs.filter(p => p.owner === o.id && (p.core || []).includes(c.id)).length;
      let s = (ratio - 1.3) * pers.war + (-rel(c.id, o.id) - 10) / 50 + claims * 0.4 - (hasTreaty('nap', c.id, o.id) ? 1 : 0);
      if (!o.ai && G.day < 240) s -= 2; // grace period for human players at game start
      if (s > bs) { bs = s; best = o; }
    }
    if (best && bs > 0.4 && c.pp >= 50) diploAction(c.id, best.id, 'justify');
  }
  // Treaties
  const allies = G.diplo.treaties.filter(t => t.type === 'alliance' && (t.a === c.id || t.b === c.id)).length;
  let trades = G.diplo.treaties.filter(t => t.type === 'trade' && (t.a === c.id || t.b === c.id)).length;
  let naps = G.diplo.treaties.filter(t => t.type === 'nap' && (t.a === c.id || t.b === c.id)).length;
  for (const o of others) {
    if (rng() > 0.15) continue;
    if (atWar(c.id, o.id)) continue;
    const r = rel(c.id, o.id);
    if (o.ai) {
      if (allies < 2 && r > 55 && !hasTreaty('alliance', c.id, o.id) && aiOpinion(o.id, c.id, 'alliance')[0] > 0 && aiOpinion(c.id, o.id, 'alliance')[0] > 0) { addTreaty('alliance', c.id, o.id); note('world', `${c.name} and ${o.name} formed an alliance.`); }
      else if (trades < 4 && r > 10 && !hasTreaty('trade', c.id, o.id) && aiOpinion(o.id, c.id, 'trade')[0] > 0) { addTreaty('trade', c.id, o.id); trades++; }
      else if (naps < 4 && r > -10 && bordering(c.id, o.id) && threatOf(c, o.id) > 1.4 && !hasTreaty('nap', c.id, o.id) && aiOpinion(o.id, c.id, 'nap')[0] > 0) { addTreaty('nap', c.id, o.id); naps++; }
    } else if (!o.ai && !G.editorMode) {
      if (r > 60 && !hasTreaty('alliance', c.id, o.id) && allies < 2 && rng() < 0.2 && aiOpinion(c.id, o.id, 'alliance')[0] > 0) {
        popupFor(o.id, 'Alliance Offer', `${c.name} (${GOVERNMENTS[c.gov].name}, ${c.ideology}) proposes an alliance. Allies are called into each other's wars.`, [
          { label: 'Accept', fn: () => { addTreaty('alliance', c.id, o.id); note('diplo', `Alliance signed with ${c.name}.`); } },
          { label: 'Decline', fn: () => relAdd(c.id, o.id, -10) }]);
      } else if (r > 20 && !hasTreaty('trade', c.id, o.id) && rng() < 0.15) {
        popupFor(o.id, 'Trade Proposal', `${c.name} proposes a trade agreement, opening a trade route between our capitals.`, [
          { label: 'Accept', fn: () => { addTreaty('trade', c.id, o.id); note('diplo', `Trade agreement signed with ${c.name}.`); } },
          { label: 'Decline', fn: () => relAdd(c.id, o.id, -5) }]);
      }
    }
    if (r < -30 && pers.war < 0.6 && c.pp > 80) diploAction(c.id, o.id, 'improve');
  }
  // Defensive nations guarantee small threatened neighbours
  if (c.personality === 'diplomatic' && c.pp > 100 && rng() < 0.1) {
    const small = others.filter(o => o.nProv <= 3 && rel(c.id, o.id) > 30 && !G.diplo.treaties.some(t => t.type === 'guarantee' && t.a === c.id && t.b === o.id));
    if (small.length) diploAction(c.id, small[0].id, 'guarantee');
  }
}

// ------------------------------------------------------------
// AI: military operations
// ------------------------------------------------------------
function enemiesOf(cid) { const s = new Set(); for (const w of G.wars) { if (w.att.includes(cid)) w.def.forEach(x => s.add(x)); if (w.def.includes(cid)) w.att.forEach(x => s.add(x)); } return s; }
function localPower(divs) { let s = 0; for (const d of divs) s += (d.st.sa + d.st.ha + d.st.df * 0.6) * d.str * (0.3 + 0.7 * d.org); return s; }
// Lookups shared by all of one country's divisions during a single AI pass
function militaryContext(c, en) {
  const byProv = new Map();
  for (const x of G.divs) { if (x.state === 'training') continue; let a = byProv.get(x.prov); if (!a) byProv.set(x.prov, a = []); a.push(x); }
  const mineAt = id => (byProv.get(id) || []).filter(x => x.owner === c.id);
  const hostileAt = id => (byProv.get(id) || []).filter(x => en.has(x.owner));
  let front = null;
  const friends = (G._fs && G._fs.get(c.id)) || new Set([c.id]);
  const getFront = () => front || (front = G.provs.filter(q => friends.has(q.controller) && q.neighbors.some(n => en.has(G.provs[n].controller))));
  return { byProv, mineAt, hostileAt, getFront };
}
function aiMilitary(c) {
  const mine = G.divs.filter(d => d.owner === c.id && d.state !== 'training');
  if (!mine.length) return;
  const en = enemiesOf(c.id);
  const ctx = militaryContext(c, en);
  for (const d of mine) aiDivision(d, c, en, ctx);
}
function aiDivision(d, c, en, ctx) {
  if (d.state === 'battle' || d.state === 'siege') return;
  if (d.state === 'moving' && d.path.length && Math.random() < 0.85) return;
  ctx = ctx || militaryContext(c, en);
  const P = G.provs[d.prov];
  if (en.size) {
    if (d.org < 0.45 || d.str < 0.45) return;
    const targets = P.neighbors.map(n => G.provs[n]).filter(q => en.has(q.controller) || ctx.hostileAt(q.id).length);
    if (targets.length) {
      const here = ctx.mineAt(P.id);
      let best = null, bs = -1e9;
      for (const q of targets) {
        const ed = ctx.hostileAt(q.id);
        const ep = localPower(ed) * TERRAINS[q.terrain].def * (1 + provStats(q).fort * 0.15);
        const mp = localPower(here.filter(x => x.state !== 'battle' || x.attacking === q.id));
        let s = mp / (ep + 1) + (q.id === C(q.controller).capital ? 0.6 : 0) + (ed.length ? 0 : 1.2) - provStats(q).fort * 0.15;
        if (G.battles.some(b => b.prov === q.id && b.att === d.owner)) s += 0.5;
        if (s > bs) { bs = s; best = q; }
      }
      if (best && bs > 0.9) { orderMove(d, best.id); return; }
      return; // hold the line
    }
    // March to the front: nearest province bordering an enemy
    const front = ctx.getFront().slice();
    if (!front.length) {
      // Try to reach enemy by sea or through allies
      const targetsFar = G.provs.filter(q => en.has(q.controller) && q.coastal);
      if (targetsFar.length && c.agg.port >= 1 && Math.random() < 0.3) { const t = targetsFar.sort((a, b) => Math.hypot(a.cx - P.cx, a.cy - P.cy) - Math.hypot(b.cx - P.cx, b.cy - P.cy))[0]; orderMove(d, t.id); }
      return;
    }
    let bestF = null, bf = 1e9;
    for (const q of front) { const v = Math.hypot(q.cx - P.cx, q.cy - P.cy) + ctx.mineAt(q.id).length * 40; if (v < bf) { bf = v; bestF = q; } }
    if (bestF.id !== d.prov && !(d.target === bestF.id && d.path.length)) orderMove(d, bestF.id);
    return;
  }
  // Peacetime: garrison borders with rivals, and the capital
  if (d.state === 'moving' || G.day % 30 > 3 || d.auto) return;
  if (!ctx.posts) {
    const own = c._provs.filter(p => p.controller === c.id);
    const borders = own.filter(p => p.neighbors.some(n => { const o = G.provs[n].controller; return o >= 0 && o !== c.id && !allied(c.id, o) && rel(c.id, o) < 10; }));
    ctx.posts = borders.length ? borders : [G.provs[c.capital]];
  }
  const posts = ctx.posts;
  if (!ctx.counts) { ctx.counts = new Map(); for (const x of G.divs) if (x.owner === c.id) ctx.counts.set(x.prov, (ctx.counts.get(x.prov) || 0) + 1); }
  const counts = ctx.counts;
  const curCount = counts.get(d.prov) || 0;
  const target = posts.filter(Boolean).sort((a, b) => (counts.get(a.id) || 0) - (counts.get(b.id) || 0))[0];
  if (target && target.id !== d.prov && (counts.get(target.id) || 0) + 1 < curCount) orderMove(d, target.id);
}
// Player divisions set to "auto-advance" use the AI's tactical brain
function tickPlayerAuto() {
  for (const c of G.countries) {
    if (!c.alive || c.ai) continue;
    const en = enemiesOf(c.id);
    if (!en.size) continue;
    const ctx = militaryContext(c, en);
    for (const d of G.divs) if (d.owner === c.id && d.auto && d.state !== 'training') aiDivision(d, c, en, ctx);
  }
}

// ------------------------------------------------------------
// AI: wars and peace
// ------------------------------------------------------------
function aiWarEvaluation(w) {
  if (!G.wars.includes(w)) return;
  const lA = w.att[0], lD = w.def[0];
  const sA = warScore(w, 'att');
  const days = G.day - w.start;
  const hA = isHuman(lA), hD = isHuman(lD);
  if (!hA && !hD) {
    if (sA >= 45 || (days > 540 && sA >= 20)) autoPeace(w, 'att');
    else if (sA <= -45 || (days > 540 && sA <= -20)) autoPeace(w, 'def');
    else if (days > 900) makePeace(w, {});
    return;
  }
  if (hA && hD) return; // two human leaders settle it themselves at the peace conference
  // one human war leader facing an AI leader: the AI offers or demands terms
  const human = hA ? lA : lD;
  const playerSide = hA ? 'att' : 'def';
  const ps = playerSide === 'att' ? sA : -sA;
  const enemyLeader = playerSide === 'att' ? lD : lA;
  const enemies = playerSide === 'att' ? w.def : w.att;
  if (w.lastOffer && G.day - w.lastOffer < 120) return;
  if (ps >= 40 && C(enemyLeader).alive) {
    w.lastOffer = G.day;
    const terms = { transfers: G.provs.filter(p => enemies.includes(p.owner) && p.controller === human).map(p => ({ prov: p.id, to: human })) };
    popupFor(human, 'Peace Offer', `${C(enemyLeader).name} sues for peace (war score ${ps}). They offer to cede the ${terms.transfers.length} provinces you occupy. You can also open the peace conference from the Diplomacy panel to demand more.`, [
      { label: 'Accept offer', fn: () => { if (G.wars.includes(w)) makePeace(w, terms); } },
      { label: 'Fight on' }], true);
  } else if (ps <= -50) {
    w.lastOffer = G.day;
    const terms = { transfers: G.provs.filter(p => p.owner === human && enemies.includes(p.controller)).map(p => ({ prov: p.id, to: p.controller })) };
    popupFor(human, 'Enemy Demands', `${C(enemyLeader).name} demands that you cede the ${terms.transfers.length} provinces they occupy in exchange for peace (war score ${ps}).`, [
      { label: 'Accept their terms', fn: () => { if (G.wars.includes(w)) makePeace(w, terms); } },
      { label: 'Refuse' }], true);
  }
}
