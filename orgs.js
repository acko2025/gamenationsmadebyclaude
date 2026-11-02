// ============================================================
// WAR OF NATIONS — international organizations: pacts, leagues, unions
// ============================================================
'use strict';

const ORG_TYPES = {
  military: { name: 'Military pact', emb: 'sword', desc: 'Members come to each other\'s defense when one of them is attacked.' },
  trade: { name: 'Trade organization', emb: 'circle', desc: 'A common market: every member earns trade income from every other member.' },
  religious: { name: 'Religious union', emb: 'sun', desc: 'Members gain +3 stability. Nations of the founder\'s faith join more readily.' },
  economic: { name: 'Economic union', emb: 'tower', desc: 'Members build 8% faster and their factories produce 5% more.' },
  science: { name: 'Scientific council', emb: 'star', desc: 'Members gain +3% research for each member (up to +20%).' },
  peace: { name: 'Non-aggression treaty', emb: 'shield', desc: 'Members may not declare war on one another. Relations between members improve.' },
  custom: { name: 'Custom organization', emb: 'crown', desc: 'A league of your own design. Members gain +1 stability and grow closer each month.' },
};
const ORG_FOUND_PP = 75, ORG_INVITE_PP = 15, ORG_MAX_MEMBERSHIPS = 4, ORG_MAX_MEMBERS = 16;

function orgsOf(cid) { return (G.orgs || []).filter(o => o.members.includes(cid)); }
function sharePeaceOrg(a, b) { return (G.orgs || []).some(o => o.type === 'peace' && o.members.includes(a) && o.members.includes(b)); }
function militaryOrgPartners(cid) {
  const s = new Set();
  for (const o of G.orgs || []) if (o.type === 'military' && o.members.includes(cid)) o.members.forEach(m => m !== cid && s.add(m));
  return s;
}
// Per-country bonuses from all organizations, recomputed once per day
function computeOrgFx() {
  const F = new Map();
  const get = id => { let f = F.get(id); if (!f) F.set(id, f = { trade: 0, stab: 0, build: 0, prod: 0, research: 0 }); return f; };
  for (const o of G.orgs || []) {
    const n = o.members.length;
    for (const m of o.members) {
      const f = get(m);
      if (o.type === 'trade') f.trade += Math.min(6, 0.5 * (n - 1));
      else if (o.type === 'religious') f.stab += 3;
      else if (o.type === 'economic') { f.build += 0.08; f.prod += 0.05; }
      else if (o.type === 'science') f.research += Math.min(0.2, 0.03 * n);
      else if (o.type === 'custom') f.stab += 1;
    }
  }
  G._ofx = F;
}
const NO_FX = { trade: 0, stab: 0, build: 0, prod: 0, research: 0 };
function orgFx(cid) { return (G._ofx && G._ofx.get(cid)) || NO_FX; }

function orgDefaultFlag(type, color, rng) {
  const f = randomFlag(rng || Math.random, color);
  f.emb = ORG_TYPES[type].emb; f.ec = '#f2e6c8'; f.es = 0.42; f.ex = 0.5; f.ey = 0.5;
  if (f.pat === 'saltire' || f.pat === 'nordic') f.pat = 'border';
  return f;
}
function foundOrg(cid, spec) {
  const color = Array.isArray(spec.color) ? spec.color : hexToRgb(spec.color || '#3a6ea5');
  const o = { id: nid(), name: spec.name, type: spec.type, desc: spec.desc || '', color, flag: spec.flag || orgDefaultFlag(spec.type, color), founder: cid, members: [cid], founded: G.day };
  G.orgs.push(o);
  note('world', `${C(cid).name} founded the ${o.name}.`, C(cid).capital);
  return o;
}
function removeFromOrg(o, cid) {
  o.members = o.members.filter(m => m !== cid);
  if (!o.members.length) { G.orgs = G.orgs.filter(x => x !== o); note('world', `The ${o.name} has been dissolved.`); return; }
  if (o.founder === cid) o.founder = o.members[0];
}
function dissolveOrg(o) { G.orgs = G.orgs.filter(x => x !== o); note('world', `The ${o.name} has been dissolved.`); }
// How much nation t wants to be in organization o (positive = yes)
function orgOpinion(t, o) {
  const ct = C(t), f = C(o.founder);
  if (!ct || !ct.alive || o.members.includes(t)) return [-999, ''];
  if (o.members.some(m => atWar(t, m))) return [-999, 'We are at war with one of your members.'];
  let s = o.members.reduce((a, m) => a + rel(t, m), 0) / o.members.length - 10;
  if (orgsOf(t).length >= ORG_MAX_MEMBERSHIPS - 1) s -= 40;
  if (ct.ideology === f.ideology) s += 10;
  let why = '';
  switch (o.type) {
    case 'military': {
      const threatened = G.countries.some(x => x.alive && !o.members.includes(x.id) && x.id !== t && bordering(t, x.id) && rel(t, x.id) < 0 && sideStrength(x.id) > sideStrength(t) * 1.2);
      s += threatened ? 25 : -5;
      if (o.members.some(m => inWar(m))) { s -= 15; why = 'We will not be dragged into your wars.'; }
      break;
    }
    case 'trade': s += ct.personality === 'merchant' ? 25 : 12; if (ct.laws.trade === 'closed') { s -= 100; why = 'Our economy is closed to foreign trade.'; } break;
    case 'religious': if (ct.religion === f.religion) s += 30; else { s -= 60; why = 'We do not share your faith.'; } break;
    case 'economic': s += 6; break;
    case 'science': s += 15; break;
    case 'peace': s += 18; break;
    default: break;
  }
  if (!why) why = s > 0 ? 'We are honoured to join.' : 'We see no reason to join.';
  return [s, why];
}
function orgInvite(o, from, target) {
  const c = C(from), t = C(target);
  if (o.members.includes(target)) return { ok: false, msg: 'Already a member.' };
  if (o.members.length >= ORG_MAX_MEMBERS) return { ok: false, msg: 'The organization is full.' };
  if (c.pp < ORG_INVITE_PP && !c.ai) return { ok: false, msg: `Needs ${ORG_INVITE_PP} political power.` };
  if (!c.ai) c.pp -= ORG_INVITE_PP;
  if (!t.ai) {
    popupFor(target, 'Invitation: ' + o.name, `${c.name} invites you to join the ${o.name} (${ORG_TYPES[o.type].name}).\n\n${ORG_TYPES[o.type].desc}\n\nMembers: ${o.members.map(m => C(m).name).join(', ')}`, [
      { label: 'Join', fn: () => { if (!o.members.includes(target)) { o.members.push(target); note('diplo', `You joined the ${o.name}.`); } } },
      { label: 'Decline', fn: () => relAdd(from, target, -3) }]);
    return { ok: true, msg: 'Invitation sent.' };
  }
  const [s, why] = orgOpinion(target, o);
  if (s <= 0) { relAdd(from, target, -2); return { ok: false, msg: `${t.name} declined. "${why}"` }; }
  o.members.push(target);
  relAdd(from, target, 8);
  note('diplo', `${t.name} joined the ${o.name}.`, t.capital, [from, target, ...o.members]);
  return { ok: true, msg: `${t.name} joined. "${why}"` };
}
function orgApply(o, cid) {
  const f = C(o.founder), c = C(cid);
  if (o.members.length >= ORG_MAX_MEMBERS) return { ok: false, msg: 'The organization is full.' };
  if (!f.ai) { o.members.push(cid); return { ok: true, msg: 'Joined.' }; }
  let s = rel(o.founder, cid) - 5 + (o.type === 'religious' ? (c.religion === f.religion ? 30 : -60) : 0) - (o.members.some(m => atWar(m, cid)) ? 200 : 0);
  if (s <= 0) return { ok: false, msg: `${f.name} rejected your application.` };
  o.members.push(cid);
  note('diplo', `${c.name} joined the ${o.name}.`, c.capital, [cid, ...o.members]);
  return { ok: true, msg: `You joined the ${o.name}.` };
}
function orgName(type, c, rng) {
  const cap = G.provs[c.capital] ? G.provs[c.capital].name : c.name;
  const opts = {
    military: [`${c.adj} Defense Pact`, `Pact of ${cap}`, `${c.adj} Military Alliance`],
    trade: [`${c.adj} Trade League`, `${cap} Merchant Compact`, `${c.adj} Free Trade Area`],
    religious: [`Holy League of the ${c.religion}`, `Council of ${cap}`, `${c.religion} Fellowship`],
    economic: [`${c.adj} Economic Union`, `${cap} Customs Union`],
    science: [`Academy of ${cap}`, `${c.adj} Science Council`],
    peace: [`Treaty of ${cap}`, `Accord of ${cap}`],
    custom: [`Concord of ${cap}`, `${c.adj} Commonwealth`],
  }[type];
  return pick(rng, opts);
}
// AI: found organizations and recruit members
function aiOrgs(c) {
  if (!c.alive || !c.ai) return;
  const rng = Math.random;
  const mine = orgsOf(c.id);
  if (mine.length < 2 && c.pp > 120 && rng() < 0.04 && !G.orgs.some(o => o.founder === c.id)) {
    const byPers = { merchant: 'trade', diplomatic: pick(rng, ['peace', 'custom']), industrial: 'economic', neutral: 'science', expansionist: 'military', militarist: 'military', defensive: pick(rng, ['military', 'peace']) };
    const type = c.gov === 'theocracy' ? 'religious' : byPers[c.personality] || 'custom';
    c.pp -= ORG_FOUND_PP;
    foundOrg(c.id, { name: orgName(type, c, rng), type, color: hsl2rgb(rng() * 360, 0.45, 0.42), flag: null });
  }
  for (const o of G.orgs) {
    if (o.founder !== c.id || o.members.length >= 10 || rng() > 0.5) continue;
    const cands = G.countries.filter(x => x.alive && !o.members.includes(x.id) && (bordering(c.id, x.id) || rel(c.id, x.id) > 30));
    let best = null, bs = 0;
    for (const x of cands) { const s = x.ai ? orgOpinion(x.id, o)[0] : rel(c.id, x.id) - 40; if (s > bs) { bs = s; best = x; } }
    if (best) orgInvite(o, c.id, best.id);
  }
  // leave organizations that no longer suit us
  for (const o of mine) if (o.founder !== c.id && orgOpinion(c.id, Object.assign({}, o, { members: o.members.filter(m => m !== c.id) }))[0] < -40 && rng() < 0.2) removeFromOrg(o, c.id);
}
function tickOrgsMonthly() {
  for (const o of G.orgs || []) {
    o.members = o.members.filter(m => C(m) && C(m).alive);
    const k = o.type === 'peace' || o.type === 'religious' || o.type === 'custom' ? 2 : 1;
    for (const a of o.members) for (const b of o.members) if (a < b) relAdd(a, b, k);
  }
  G.orgs = (G.orgs || []).filter(o => o.members.length);
}
// A few organizations exist from the start so the world feels established
function seedOrgs(rng) {
  G.orgs = [];
  const alive = G.countries.filter(c => c.alive).sort((a, b) => b.nProv - a.nProv);
  const n = Math.min(4, Math.floor(alive.length / 8) + 1);
  for (let i = 0; i < n && alive.length; i++) {
    const c = alive[Math.floor(rng() * Math.min(12, alive.length))];
    if (G.orgs.some(o => o.founder === c.id)) continue;
    const type = pick(rng, ['trade', 'military', 'religious', 'science', 'trade', 'economic']);
    const o = { id: nid(), name: orgName(type, c, rng), type, desc: '', color: hsl2rgb(rng() * 360, 0.45, 0.42), founder: c.id, members: [c.id], founded: 0 };
    o.flag = orgDefaultFlag(type, o.color, rng);
    G.orgs.push(o);
    for (const x of alive) if (x.id !== c.id && o.members.length < 6 && (bordering(c.id, x.id) || rel(c.id, x.id) > 25) && (type !== 'religious' || x.religion === c.religion) && rng() < 0.5) o.members.push(x.id);
  }
}

// ------------------------------------------------------------
// Organizations tab
// ------------------------------------------------------------
UI.orgSel = -1;
PANEL_TITLES.orgs = 'Organizations';
PANELS.orgs = function (c) {
  const mine = orgsOf(c.id), all = G.orgs || [];
  const sel = all.find(o => o.id === UI.orgSel);
  const orgFlag = (o, w, h) => { const cv = flagCanvas(o.flag, w, h); return `<img class="flag" src="${cv.toDataURL()}" width="${w}" height="${h}" alt="">`; };
  let html = `<p class="muted">Found pacts, leagues and unions with other nations. Each type has real effects for its members.</p>
    <div class="btnrow"><button class="btn primary" data-act="orgnew">Found an organization <small>${ORG_FOUND_PP} PP</small></button></div>`;
  if (sel) {
    const isMember = sel.members.includes(c.id), isFounder = sel.founder === c.id;
    const others = G.countries.filter(x => x.alive && !sel.members.includes(x.id)).sort((a, b) => rel(c.id, b.id) - rel(c.id, a.id));
    html += `<div class="dsel org"><div class="ovhead">${orgFlag(sel, 84, 56)}<div><h3>${esc(sel.name)}</h3><small class="muted">${ORG_TYPES[sel.type].name} · founded ${dateStr(sel.founded)} by ${esc(C(sel.founder).name)}</small></div></div>
      <p>${esc(ORG_TYPES[sel.type].desc)}</p>${sel.desc ? `<p class="muted pre">${esc(sel.desc)}</p>` : ''}
      <h4>Members (${sel.members.length})</h4>${sel.members.map(m => `<div class="drow" data-act="dsel" data-id="${m}">${flagImg(C(m), 24, 16)}<span>${esc(C(m).name)}${m === sel.founder ? ' <small>founder</small>' : ''}</span>${isFounder && m !== c.id ? `<button class="x sm" data-act="orgkick" data-id="${m}" aria-label="Expel ${esc(C(m).name)}" data-tip="Expel">×</button>` : ''}</div>`).join('')}
      <div class="btnrow wrap">
        ${isMember ? `<span class="inrow"><select id="org-inv">${others.map(x => `<option value="${x.id}">${esc(x.name)} (${Math.round(rel(c.id, x.id))})</option>`).join('')}</select><button class="btn sm primary" data-act="orginvite">Invite <small>${ORG_INVITE_PP} PP</small></button></span>` : `<button class="btn sm primary" data-act="orgapply">Request to join</button>`}
        ${isFounder ? '<button class="btn sm" data-act="orgedit">Edit name & flag</button><button class="btn sm danger" data-act="orgdissolve">Dissolve</button>' : ''}
        ${isMember && !isFounder ? '<button class="btn sm danger" data-act="orgleave">Leave</button>' : ''}
        ${isMember && isFounder && sel.members.length > 1 ? '<button class="btn sm danger" data-act="orgleave">Leave (hand over leadership)</button>' : ''}
        <button class="btn sm" data-act="orgmap">Show on map</button>
      </div></div>`;
  }
  html += `<h4>Your memberships</h4>` + (mine.length ? mine.map(o => orgRow(o, orgFlag)).join('') : '<p class="muted">None yet.</p>');
  html += `<h4>All organizations (${all.length})</h4>` + (all.length ? all.map(o => orgRow(o, orgFlag)).join('') : '<p class="muted">The world has no organizations yet.</p>');
  const fx = orgFx(c.id);
  const fxs = [fx.trade ? `+${fx.trade.toFixed(1)} trade income/day` : '', fx.stab ? `+${fx.stab} stability` : '', fx.build ? `+${Math.round(fx.build * 100)}% construction` : '', fx.prod ? `+${Math.round(fx.prod * 100)}% factory output` : '', fx.research ? `+${Math.round(fx.research * 100)}% research` : ''].filter(Boolean);
  if (fxs.length) html += `<h4>Your bonuses</h4><p>${fxs.join(' · ')}</p>`;
  return html;
};
function orgRow(o, orgFlag) {
  return `<div class="drow ${o.id === UI.orgSel ? 'on' : ''}" data-act="orgsel" data-id="${o.id}">${orgFlag(o, 30, 20)}<span>${esc(o.name)} <small>${ORG_TYPES[o.type].name} · ${o.members.length} members</small></span><span class="orgflags">${o.members.slice(0, 5).map(m => flagImg(C(m), 18, 12)).join('')}</span></div>`;
}
function openOrgEditor(existing) {
  const c = C(G.player);
  const st = existing ? { name: existing.name, type: existing.type, color: rgbToHex(existing.color), desc: existing.desc, flag: existing.flag } : { name: `${c.adj} Trade League`, type: 'trade', color: '#3a6ea5', desc: '', flag: null };
  if (!st.flag) st.flag = orgDefaultFlag(st.type, hexToRgb(st.color));
  const wrap = document.createElement('div'); wrap.className = 'creator';
  wrap.innerHTML = `<div class="form cols">
    <label>Name<input type="text" id="og-name" maxlength="40" value="${esc(st.name)}"></label>
    <label>Type<select id="og-type" ${existing ? 'disabled' : ''}>${Object.entries(ORG_TYPES).map(([k, t]) => `<option value="${k}" ${k === st.type ? 'selected' : ''}>${t.name}</option>`).join('')}</select></label>
    <label>Map color<input type="color" id="og-color" value="${st.color}"></label></div>
    <p class="muted" id="og-desc-type">${ORG_TYPES[st.type].desc}</p>
    <label>Charter (optional)<textarea id="og-desc" rows="2" maxlength="300" placeholder="What this organization stands for">${esc(st.desc)}</textarea></label>
    <div class="fe-wrap"><h4>Flag</h4></div>`;
  let fe = flagEditorEl(st.flag);
  wrap.querySelector('.fe-wrap').appendChild(fe.el);
  wrap.querySelector('#og-color').oninput = e => fe.setColor(0, e.target.value);
  wrap.querySelector('#og-type').onchange = e => {
    const t = e.target.value;
    wrap.querySelector('#og-desc-type').textContent = ORG_TYPES[t].desc;
    const nm = wrap.querySelector('#og-name');
    if (!existing && Object.keys(ORG_TYPES).some(k => nm.value === orgName(k, c, () => 0))) nm.value = orgName(t, c, () => 0);
    const f = fe.get(); f.emb = ORG_TYPES[t].emb;
    const nfe = flagEditorEl(f); fe.el.replaceWith(nfe.el); fe = nfe;
  };
  modal(existing ? 'Edit organization' : 'Found an organization', wrap, [{
    label: existing ? 'Save' : `Found it (${ORG_FOUND_PP} PP)`, fn: () => {
      const name = wrap.querySelector('#og-name').value.trim();
      if (!name) { toast('Give the organization a name.', 'bad'); return false; }
      const spec = { name, type: wrap.querySelector('#og-type').value, color: wrap.querySelector('#og-color').value, desc: wrap.querySelector('#og-desc').value.trim(), flag: fe.get() };
      if (isClient()) spec.flag.layer = netFlagLayer(spec.flag.layer);
      if (existing) showRes(cmd('orgedit', { org: existing.id, spec }));
      else {
        if (c.pp < ORG_FOUND_PP) { toast(`Needs ${ORG_FOUND_PP} political power.`, 'bad'); return false; }
        const r = showRes(cmd('orgfound', { spec }));
        if (r && r.org) UI.orgSel = r.org;
      }
      G.mapDirty = true; renderPanel(true);
    },
  }, { label: 'Cancel' }], { wide: true });
}
Object.assign(ACT, {
  orgnew: () => openOrgEditor(null),
  orgsel: el => { UI.orgSel = +el.dataset.id; renderPanel(true); if (V.mode === 'orgs') { G.mapDirty = true; UI.lastMap = 0; } },
  orgedit: () => { const o = G.orgs.find(x => x.id === UI.orgSel); if (o) openOrgEditor(o); },
  orginvite: () => { const t = +$('#org-inv').value; if (isNaN(t)) return; after(cmd('orginvite', { org: UI.orgSel, t })); },
  orgapply: () => after(cmd('orgapply', { org: UI.orgSel })),
  orgleave: () => after(cmd('orgleave', { org: UI.orgSel })),
  orgkick: el => after(cmd('orgkick', { org: UI.orgSel, m: +el.dataset.id })),
  orgdissolve: () => { const o = G.orgs.find(x => x.id === UI.orgSel); if (!o) return; modal('Dissolve ' + esc(o.name) + '?', '<p>All members lose its benefits. This cannot be undone.</p>', [{ label: 'Dissolve', cls: 'danger', fn: () => { after(cmd('orgdissolve', { org: o.id })); UI.orgSel = -1; } }, { label: 'Cancel' }]); },
  orgmap: () => { V.mode = 'orgs'; document.querySelectorAll('#modes .mm').forEach(b => b.classList.toggle('on', b.dataset.id === 'orgs')); G.mapDirty = true; UI.lastMap = 0; },
});
