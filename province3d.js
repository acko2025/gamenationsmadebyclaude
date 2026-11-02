// ============================================================
// WAR OF NATIONS — 3D province view: terrain, construction, life, battles
// ============================================================
'use strict';

const P3 = {
  active: false, mode: 'province', renderer: null, scene: null, camera: null, prov: null,
  cam: { tx: 0, tz: 0, dist: 120, yaw: 0.7, pitch: 0.75 }, tool: { kind: 'select', type: null }, ghostRot: 0, snap: true,
  meshes: new Map(), segMeshes: new Map(), sig: new Map(), tod: 0.35, particles: null, selected: null, hover: null,
};
const COL = { stone: 0x9a948a, darkstone: 0x6f6a62, wood: 0x8b6a45, darkwood: 0x5e4630, plaster: 0xe0d6bf, thatch: 0xa8874a, tile: 0xa1452f, slate: 0x4b5560, brick: 0x9a4a35, concrete: 0xb9b7ae, steel: 0x7d858c, glass: 0x6fa3c4, gold: 0xd4a640, dark: 0x34342f, white: 0xeeeeea, red: 0xb03a2e, green: 0x4f7a3a, sand: 0xd8c08a };

// ---------- shared geometry & materials ----------
let GEO = null;
const MATS = new Map();
function mat(color, opts) {
  const key = color + (opts ? JSON.stringify(opts) : '');
  if (!MATS.has(key)) MATS.set(key, new THREE.MeshLambertMaterial(Object.assign({ color }, opts || {})));
  return MATS.get(key);
}
function initGeo() {
  if (GEO) return;
  const T = THREE;
  const box = new T.BoxGeometry(1, 1, 1); box.translate(0, 0.5, 0);
  const pyr = new T.ConeGeometry(0.7071, 1, 4); pyr.rotateY(Math.PI / 4); pyr.translate(0, 0.5, 0);
  const cyl = new T.CylinderGeometry(0.5, 0.5, 1, 10); cyl.translate(0, 0.5, 0);
  const cone = new T.ConeGeometry(0.5, 1, 10); cone.translate(0, 0.5, 0);
  const sph = new T.SphereGeometry(0.5, 12, 8); sph.translate(0, 0.5, 0);
  const dome = new T.SphereGeometry(0.5, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2);
  const tower = new T.CylinderGeometry(0.33, 0.5, 1, 14, 1, true); tower.translate(0, 0.5, 0);
  const half = new T.CylinderGeometry(0.5, 0.5, 1, 14, 1, false, -Math.PI / 2, Math.PI); half.rotateX(-Math.PI / 2);
  const torus = new T.TorusGeometry(0.4, 0.1, 8, 24); torus.rotateX(Math.PI / 2);
  // gable roof prism: footprint 1x1, ridge along z at height 1
  const g = new T.BufferGeometry();
  const v = [-.5, 0, -.5, .5, 0, -.5, 0, 1, -.5, .5, 0, .5, -.5, 0, .5, 0, 1, .5,
    -.5, 0, -.5, 0, 1, -.5, 0, 1, .5, -.5, 0, -.5, 0, 1, .5, -.5, 0, .5,
    .5, 0, -.5, .5, 0, .5, 0, 1, .5, .5, 0, -.5, 0, 1, .5, 0, 1, -.5];
  g.setAttribute('position', new T.Float32BufferAttribute(v, 3)); g.computeVertexNormals();
  GEO = { b: box, r: pyr, c: cyl, k: cone, s: sph, d: dome, t: tower, h: half, o: torus, p: g, ico: new T.IcosahedronGeometry(1, 0), dode: new T.DodecahedronGeometry(1, 0) };
}
// part = [shape, sx, sy, sz, x, y, z, color, rotY]
function partsToGroup(parts, matOverride) {
  const grp = new THREE.Group();
  for (const pt of parts) {
    const [sh, sx, sy, sz, x, y, z, color, ry] = pt;
    const m = new THREE.Mesh(GEO[sh], matOverride || mat(color));
    if (sh === 'h') m.scale.set(sx, sy * 2, sz); else m.scale.set(sx, sy, sz);
    m.position.set(x, y, z); if (ry) m.rotation.y = ry;
    if (pt.rz) m.rotation.z = pt.rz;
    m.castShadow = true; m.receiveShadow = true;
    if (pt.spin) { m.userData.spin = pt.spin; m.userData.axis = pt.axis || 'y'; }
    grp.add(m);
  }
  return grp;
}
const S = (arr, spin, axis, rz) => { arr.spin = spin; arr.axis = axis; arr.rz = rz; return arr; };

// ---------- building recipes ----------
function house(x, z, w, d, h, wall, roof, ry) {
  return [['b', w, h, d, x, 0, z, wall, ry], ['p', w + 0.4, h * 0.7, d + 0.3, x, h, z, roof, ry]];
}
function recipe(t, lvl, era, rnd, p) {
  const roofC = era === 0 ? COL.thatch : era <= 2 ? COL.tile : COL.slate;
  const P = [];
  const add = a => { for (const x of a) P.push(x); };
  switch (t) {
    case 'cottage': for (let i = 0; i < 3 + lvl; i++) { const a = i * 2.1 + rnd() * 0.6, r = 1.6 + (i % 2) * 1.6; add(house(Math.cos(a) * r, Math.sin(a) * r, 2.2, 2.8, 1.8, rnd() < 0.5 ? COL.plaster : 0xcbb894, roofC, a)); } break;
    case 'farm': {
      const season = dateOf(G.day).m, crop = season <= 1 || season === 11 ? 0x7d6a4c : season <= 4 ? 0x86b35a : season <= 7 ? 0x5f9a3c : 0xcfae4c;
      for (let i = 0; i < 6; i++) P.push(['b', 12, 0.25 + (i % 2) * 0.1, 1.8, 0, 0, -5 + i * 2, i % 2 ? crop : 0x6e5a3e]);
      add(house(-7.5, 4, 3, 4, 2.6, COL.red, COL.darkwood, Math.PI / 2));
      if (lvl > 1) add(house(-7.5, -2, 2.4, 3, 2.2, COL.wood, roofC));
      if (lvl > 2) P.push(['c', 1.6, 4.5, 1.6, -7.5, 0, -6, COL.steel]);
      break;
    }
    case 'market': for (let i = 0; i < 4 + lvl; i++) { const a = i / (4 + lvl) * Math.PI * 2; const cx = Math.cos(a) * 2.6, cz = Math.sin(a) * 2.6; P.push(['b', 1.6, 1.1, 1.2, cx, 0, cz, COL.wood, a]); P.push(['r', 2.2, 0.8, 1.8, cx, 1.1, cz, [0xb03a2e, 0x2e6fb0, 0xd4a640, 0x3a8a4a][i % 4], a]); } P.push(['c', 0.8, 1, 0.8, 0, 0, 0, COL.stone]); break;
    case 'blacksmith': add(house(0, 0, 3.6, 3.2, 2.4, COL.stone, roofC)); P.push(['b', 0.8, 4.2, 0.8, 1.2, 0, 1, COL.darkstone]); break;
    case 'barracks': add(house(0, 0, 8, 3.4, 2.8, era >= 2 ? COL.brick : COL.wood, roofC)); P.push(['c', 0.15, 7, 0.15, 4.6, 0, 2.4, COL.dark], ['b', 1.6, 1, 0.05, 5.4, 6, 2.4, COL.red]); if (lvl > 1) add(house(0, -4, 6, 2.6, 2.4, COL.wood, roofC)); break;
    case 'watchtower': P.push(['b', 2, 7 + lvl, 2, 0, 0, 0, COL.wood], ['b', 2.8, 0.4, 2.8, 0, 7 + lvl, 0, COL.darkwood], ['r', 3, 1.8, 3, 0, 8.6 + lvl, 0, roofC]); break;
    case 'stables': add(house(0, 0, 8, 3, 2.2, COL.wood, roofC)); for (let i = 0; i < 4; i++) P.push(['b', 0.15, 1, 0.15, -4 + i * 2.6, 0, 3.5, COL.darkwood]); P.push(['b', 8, 0.12, 0.12, 0, 0.8, 3.5, COL.darkwood]); break;
    case 'windmill': P.push(['t', 2.6, 6, 2.6, 0, 0, 0, COL.plaster], ['k', 2.4, 1.6, 2.4, 0, 6, 0, roofC]);
      for (let k = 0; k < 4; k++) P.push(S(['b', 0.35, 4.6, 0.7, 0, 6.4, 1.5, COL.wood], 1.1, 'z', k * Math.PI / 2)); break;
    case 'mine': P.push(['dode', 1, 1, 1, 0, 0, 0, COL.darkstone]); P.length = 0;
      P.push(['b', 6, 3, 5, 0, 0, -1, COL.darkstone], ['b', 2, 2, 0.3, 0, 0, 1.6, COL.dark], ['b', 2.6, 0.3, 0.5, 0, 2, 1.6, COL.wood], ['b', 0.6, 0.15, 6, 0, 0, 4.5, COL.steel]);
      add(house(3.6, 3, 2, 2, 1.6, COL.wood, roofC)); if (era >= 2) P.push(['b', 1, 7, 1, -2.4, 0, 0, COL.steel], ['c', 2.4, 0.3, 2.4, -2.4, 7, 0, COL.dark]); break;
    case 'lumbercamp': add(house(0, 0, 3, 2.6, 2, COL.wood, roofC)); for (let i = 0; i < 4; i++) P.push(['b', 4, 0.6, 0.6, 3.5, i * 0.55, -2 + (i % 2) * 0.6, COL.darkwood]); break;
    case 'townhall': add(house(0, 0, 6, 5, 4, era >= 2 ? COL.brick : COL.stone, roofC)); P.push(['b', 2, 8, 2, 0, 0, -2.6, COL.stone], ['r', 2.4, 2.4, 2.4, 0, 8, -2.6, roofC]); break;
    case 'harbor': for (let i = 0; i < 2 + lvl; i++) P.push(['b', 1.6, 0.4, 10, -3 + i * 3, 0.4, 7, COL.darkwood]); P.push(['b', 1, 1, 1, 0, -2, 7, COL.darkwood]); add(house(0, -2, 6, 4, 3, COL.wood, roofC)); P.push(['b', 1.4, 0.8, 4, -3, 0.2, 10, COL.wood]); break;
    case 'bridge': P.push(['b', 3.6, 0.6, 18, 0, 1.6, 0, era >= 2 ? COL.steel : COL.stone]); for (let i = -1; i <= 1; i++) P.push(['b', 2.6, 4, 1.2, 0, -2.2, i * 6, COL.stone]); P.push(['b', 0.2, 0.8, 18, 1.7, 2.2, 0, COL.darkwood], ['b', 0.2, 0.8, 18, -1.7, 2.2, 0, COL.darkwood]); break;
    case 'castle': {
      const R = 7 + lvl * 0.6;
      for (let i = 0; i < 4; i++) { const x = (i % 2 ? 1 : -1) * R, z = (i < 2 ? 1 : -1) * R; P.push(['c', 3.2, 8, 3.2, x, 0, z, COL.stone], ['k', 3.8, 3, 3.8, x, 8, z, COL.slate]); }
      P.push(['b', 2 * R, 5, 1.2, 0, 0, R, COL.stone], ['b', 2 * R, 5, 1.2, 0, 0, -R, COL.stone], ['b', 1.2, 5, 2 * R, R, 0, 0, COL.stone], ['b', 1.2, 5, 2 * R, -R, 0, 0, COL.stone]);
      P.push(['b', 5, 11 + lvl, 5, 0, 0, 0, COL.stone], ['b', 5.6, 0.8, 5.6, 0, 11 + lvl, 0, COL.darkstone], ['b', 3, 6, 2, 0, 0, R + 0.6, COL.darkstone], ['b', 1.6, 3, 0.3, 0, 0, R + 1.7, COL.dark]);
      P.push(['c', 0.15, 4, 0.15, 0, 12 + lvl, 0, COL.dark], ['b', 2, 1.2, 0.05, 1, 14.5 + lvl, 0, COL.red]);
      break;
    }
    case 'cathedral': P.push(['b', 5, 7, 13, 0, 0, 0, COL.stone], ['p', 5.4, 3.5, 13.4, 0, 7, 0, COL.slate], ['b', 11, 6, 4, 0, 0, 1, COL.stone], ['p', 11.2, 3, 4.3, 0, 6, 1, COL.slate, Math.PI / 2], ['b', 3.4, 15, 3.4, 0, 0, -7.5, COL.stone], ['k', 3.6, 7, 3.6, 0, 15, -7.5, COL.slate]); break;
    case 'palace': P.push(['b', 16, 7, 8, 0, 0, 0, COL.plaster], ['b', 4, 9, 9, -8, 0, 0, COL.plaster], ['b', 4, 9, 9, 8, 0, 0, COL.plaster], ['d', 6, 6, 6, 0, 7, 0, COL.gold], ['p', 16.4, 2.4, 8.4, 0, 7, 0, COL.slate, Math.PI / 2]); for (let i = 0; i < 6; i++) P.push(['c', 0.7, 6, 0.7, -5 + i * 2, 0, 4.4, COL.white]); break;
    case 'library': add(house(0, 0, 7, 4, 3.4, COL.stone, roofC)); P.push(['b', 2, 7, 2, 3.6, 0, -1, COL.stone], ['r', 2.4, 2, 2.4, 3.6, 7, -1, roofC]); break;
    case 'fortress': { for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; P.push(['b', 7, 3.6, 7, Math.cos(a) * 10, 0, Math.sin(a) * 10, COL.darkstone, a + Math.PI / 4]); P.push(['b', 12, 3.2, 2, Math.cos(a + 0.63) * 7.5, 0, Math.sin(a + 0.63) * 7.5, COL.stone, -(a + 0.63) + Math.PI / 2]); } add(house(0, 0, 6, 6, 3, COL.stone, COL.slate)); P.push(['c', 0.15, 6, 0.15, 0, 4, 0, COL.dark], ['b', 2, 1.2, 0.05, 1, 8.4, 0, COL.red]); break; }
    case 'university': P.push(['b', 12, 6, 6, 0, 0, 0, COL.plaster], ['d', 5, 5, 5, 0, 6, 0, COL.slate]); for (let i = 0; i < 6; i++) P.push(['c', 0.6, 5.6, 0.6, -5 + i * 2, 0, 3.4, COL.white]); add(house(-8, -2, 4, 6, 4, COL.brick, roofC)); break;
    case 'factory': P.push(['b', 12, 5, 8, 0, 0, 0, COL.brick]); for (let i = 0; i < 4; i++) P.push(['p', 3, 1.6, 8.2, -4.5 + i * 3, 5, 0, COL.slate]); P.push(['c', 1.2, 12, 1.2, 5, 0, -3, COL.brick], ['c', 1.2, 10, 1.2, 3, 0, -3, COL.brick]); if (lvl > 1) P.push(['b', 6, 4, 5, -9, 0, 1, COL.brick]); break;
    case 'steelmill': P.push(['b', 14, 7, 9, 0, 0, 0, COL.dark], ['c', 3.4, 12, 3.4, 7, 0, 3, COL.steel], ['c', 3.4, 12, 3.4, 7, 0, -3, COL.steel], ['c', 1.4, 18, 1.4, -5, 0, -3, COL.brick], ['c', 1.4, 16, 1.4, -2, 0, -3, COL.brick]); break;
    case 'armsfactory': P.push(['b', 16, 6, 9, 0, 0, 0, 0x6c7068]); for (let i = 0; i < 5; i++) P.push(['p', 3.2, 1.6, 9.2, -6.4 + i * 3.2, 6, 0, COL.slate]); P.push(['c', 1.2, 13, 1.2, 6, 0, -3.5, COL.brick], ['b', 3, 3, 0.3, 0, 0, 4.6, COL.dark]); break;
    case 'railstation': P.push(['b', 12, 0.8, 4, 0, 0, 2, COL.concrete], ['b', 10, 0.2, 4, 0, 4, 2, COL.steel]); for (let i = 0; i < 4; i++) P.push(['c', 0.3, 4, 0.3, -4.5 + i * 3, 0.8, 3.6, COL.steel]); add(house(0, -2.5, 9, 4, 4, COL.brick, COL.slate)); P.push(['b', 2, 7, 2, 4.5, 0, -2.5, COL.brick], ['r', 2.4, 2, 2.4, 4.5, 7, -2.5, COL.slate]); break;
    case 'plantation': for (let i = 0; i < 6; i++) P.push(['b', 12, 0.8, 1, 0, 0, -5 + i * 2, 0x3f7a35]); add(house(-8, 3, 3, 4, 2.6, COL.plaster, roofC)); break;
    case 'apartments': { const h = 10 + lvl * 4; P.push(['b', 7, h, 5, 0, 0, 0, COL.concrete]); for (let y = 2; y < h - 1; y += 2.2) P.push(['b', 7.1, 0.9, 5.1, 0, y, 0, 0x6d7d88]); P.push(['b', 7.2, 0.4, 5.2, 0, h, 0, COL.dark]); break; }
    case 'tankfactory': P.push(['h', 12, 6, 18, 0, 0, 0, COL.steel], ['b', 6, 8, 6, 9, 0, -4, 0x6c7068], ['c', 1.2, 14, 1.2, 10, 0, -6, COL.brick], ['b', 3, 1, 1.8, -4, 0, 11, 0x4d5a3a], ['b', 1.6, 0.7, 1.4, -4, 1, 11, 0x4d5a3a], ['c', 0.25, 2, 0.25, -4, 1.4, 12.6, COL.dark]); break;
    case 'refinery': for (let i = 0; i < 4; i++) P.push(['c', 3.4, 3.4, 3.4, -6 + (i % 2) * 4.4, 0, -4 + Math.floor(i / 2) * 4.4, COL.white]); P.push(['c', 1.6, 14, 1.6, 5, 0, 0, COL.steel], ['c', 0.6, 18, 0.6, 7.5, 0, 4, COL.steel], ['b', 6, 3, 4, 3, 0, -5, COL.concrete]); break;
    case 'powerplant': P.push(['t', 7, 14, 7, -4, 0, 0, COL.concrete], ['t', 7, 14, 7, 4.5, 0, 0, COL.concrete], ['b', 7, 6, 5, 0, 0, -7, COL.brick], ['c', 1.4, 18, 1.4, 3, 0, -8, COL.brick]); break;
    case 'airbase': P.push(['b', 34, 0.2, 5, 0, 0, 0, 0x555552], ['b', 34, 0.21, 0.3, 0, 0, 0, COL.white], ['h', 8, 5, 10, -8, 0, -9, COL.steel], ['b', 2.6, 8, 2.6, 8, 0, -7, COL.concrete], ['b', 3.4, 2, 3.4, 8, 8, -7, COL.glass]);
      P.push(['b', 1, 0.8, 4, 4, 0.4, -12, COL.slate], ['b', 5, 0.15, 1.2, 4, 0.9, -12.2, COL.slate]); break;
    case 'researchcenter': P.push(['b', 10, 6, 7, 0, 0, 0, COL.white], ['b', 10.2, 2, 7.2, 0, 2, 0, COL.glass], ['c', 0.5, 4, 0.5, 4, 6, 2, COL.steel], ['d', 3, 1.5, 3, 4, 10, 2, COL.white]); break;
    case 'shipyard': P.push(['b', 6, 0.5, 18, 0, 0.5, 8, COL.concrete], ['b', 3, 2.6, 12, 0, 0.2, 9, COL.slate], ['b', 1, 14, 1, 4, 0, 4, 0xd49b2a], ['b', 9, 0.8, 0.8, 1, 14, 4, 0xd49b2a], ['b', 8, 5, 8, -4, 0, -4, COL.steel]); break;
    case 'militarybase': for (let i = 0; i < 3; i++) add(house(-5 + i * 5, -4, 3.6, 6, 2.6, 0x7a7e6a, COL.slate)); P.push(['b', 18, 0.15, 6, 0, 0, 4, 0x777770], ['c', 0.15, 8, 0.15, 7, 0, 7, COL.dark], ['b', 2, 1.2, 0.05, 8, 6.6, 7, COL.red], ['b', 3, 1, 1.8, -4, 0, 4, 0x4d5a3a], ['b', 1.6, 0.7, 1.4, -4, 1, 4, 0x4d5a3a]); break;
    case 'govbuilding': P.push(['b', 13, 7, 8, 0, 0, 0, COL.white], ['d', 6, 6, 6, 0, 7, 0, 0x8fa8a0], ['p', 13.4, 2.4, 3, 0, 7, 3.6, COL.white, Math.PI / 2]); for (let i = 0; i < 8; i++) P.push(['c', 0.7, 6.6, 0.7, -5.6 + i * 1.6, 0, 4.4, COL.white]); break;
    case 'skyscraper': { const h = 26 + lvl * 10; P.push(['b', 8, h, 8, 0, 0, 0, COL.glass], ['b', 8.2, 1, 8.2, 0, h * 0.33, 0, COL.concrete], ['b', 8.2, 1, 8.2, 0, h * 0.66, 0, COL.concrete], ['b', 5, 3, 5, 0, h, 0, COL.concrete], ['c', 0.3, 8, 0.3, 0, h + 3, 0, COL.steel]); break; }
    case 'radar': P.push(['b', 1.6, 7, 1.6, 0, 0, 0, COL.steel], S(['b', 5, 2.6, 0.3, 0, 7.4, 0, COL.white], 1), ['b', 4, 2.4, 3, 3, 0, 2, COL.concrete]); break;
    case 'missiledef': for (let i = 0; i < 3; i++) P.push(['b', 2, 1.4, 5, -4 + i * 4, 0, 0, 0x5d6650], ['c', 0.7, 5, 0.7, -4 + i * 4, 1.4, 0.8, COL.white]); P.push(['d', 4, 4, 4, 4, 0, -5, COL.white]); break;
    case 'airport': P.push(['b', 36, 0.2, 6, 0, 0, 3, 0x555552], ['b', 36, 0.21, 0.3, 0, 0, 3, COL.white], ['b', 16, 5, 6, 0, 0, -8, COL.glass], ['h', 16, 2, 6.4, 0, 5, -8, COL.white], ['b', 2.6, 12, 2.6, 12, 0, -9, COL.concrete], ['b', 3.4, 2, 3.4, 12, 12, -9, COL.glass]); break;
    case 'fusion': P.push(['d', 12, 12, 12, 0, 0, 0, COL.white], ['o', 18, 18, 18, 0, 1, 0, 0x5fd4e8], ['b', 6, 4, 4, 8, 0, 6, COL.concrete]); break;
    case 'arcology': for (let i = 0; i < 6; i++) { const s = 16 - i * 2.4; P.push(['b', s, 6, s, 0, i * 6, 0, i % 2 ? COL.glass : COL.white]); } P.push(['c', 0.5, 10, 0.5, 0, 36, 0, COL.steel]); break;
  }
  return P;
}
function buildingObject(b, p, era) {
  const rnd = mulberry32(b.id * 97 + 3);
  const B = BUILDINGS[b.t];
  let grp;
  if (b.prog >= 1 && b.hp < 25) {
    // rubble
    const parts = [];
    for (let i = 0; i < 8; i++) parts.push(['b', 1 + rnd() * 2.5, 0.4 + rnd() * 1.2, 1 + rnd() * 2.5, (rnd() - 0.5) * B.r * 1.4, 0, (rnd() - 0.5) * B.r * 1.4, rnd() < 0.5 ? COL.darkstone : 0x3d3a35, rnd() * 3]);
    grp = partsToGroup(parts);
  } else {
    const parts = recipe(b.t, b.lvl, era, rnd, p);
    const damaged = b.hp < 60;
    grp = partsToGroup(parts, null);
    if (damaged) grp.traverse(m => { if (m.isMesh) m.material = mat(new THREE.Color(m.material.color).multiplyScalar(0.55).getHex()); });
    if (b.lvl >= 2 && b.t !== 'cottage' && b.t !== 'farm') grp.scale.setScalar(1 + (b.lvl - 1) * 0.12);
    if (b.lvl >= 3 && !['skyscraper', 'apartments', 'castle'].includes(b.t)) {
      const f = partsToGroup([['c', 0.12, 5, 0.12, B.r * 0.6, 0, B.r * 0.6, COL.dark], ['b', 1.4, 0.9, 0.05, B.r * 0.6 + 0.7, 4, B.r * 0.6, rgbHex(C(p.owner) ? C(p.owner).color : [180, 40, 40])]]);
      grp.add(f);
    }
    if (b.prog < 1) grp.scale.y *= 0.12 + 0.88 * b.prog;
  }
  // foundation so buildings sit cleanly on slopes
  const fnd = new THREE.Mesh(GEO.b, mat(b.t === 'farm' || b.t === 'plantation' ? 0x6e5a3e : 0x7a7466));
  const fr = B.r * (b.t === 'farm' || b.t === 'plantation' ? 1.85 : 1.25);
  fnd.scale.set(fr, 4, fr); fnd.position.y = -3.8; fnd.receiveShadow = true;
  const wrap = new THREE.Group();
  wrap.add(fnd); wrap.add(grp);
  if (b.prog < 1 || b.upg != null || b.rep != null) {
    const h = b.prog < 1 ? Math.max(3, 8 * b.prog + 2) : 8;
    const sc = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(B.r * 1.5, h, B.r * 1.5, 2, 3, 2)), new THREE.LineBasicMaterial({ color: 0xc89b55 }));
    sc.position.y = h / 2; wrap.add(sc);
    const crane = partsToGroup([['b', 0.4, h + 4, 0.4, B.r * 0.8, 0, -B.r * 0.8, 0xd49b2a], S(['b', B.r * 1.6, 0.3, 0.3, B.r * 0.8, h + 4, -B.r * 0.8, 0xd49b2a], 0.3)]);
    wrap.add(crane);
  }
  wrap.position.set(b.x, provHeight(p, b.x, b.z), b.z);
  wrap.rotation.y = b.r || 0;
  wrap.userData.bid = b.id;
  return wrap;
}
const rgbHex = c => (c[0] << 16) | (c[1] << 8) | c[2];

// ---------- line structures ----------
function segmentObject(g, p, era) {
  const S0 = SEGMENTS[g.t], grp = new THREE.Group();
  const L = segLen(g), dx = (g.x2 - g.x1) / L, dz = (g.z2 - g.z1) / L, ang = Math.atan2(dx, dz);
  const step = g.t === 'road' || g.t === 'rail' ? 3 : 2;
  const n = Math.max(1, Math.ceil(L / step));
  const built = g.prog >= 1 ? 1 : g.prog;
  const color = g.t === 'road' ? (era >= 3 ? 0x4e4e4c : era >= 2 ? 0x7d7468 : 0x8a7a5c) : S0.color;
  for (let i = 0; i < n; i++) {
    const t0 = i / n, t1 = (i + 1) / n;
    if (t1 > built + 0.001) break;
    if (g.hp < 100 && (g.t === 'wall' || g.t === 'palisade') && hash2(g.id, i, 7) > g.hp / 100) continue;
    const x0 = g.x1 + (g.x2 - g.x1) * t0, z0 = g.z1 + (g.z2 - g.z1) * t0, x1 = g.x1 + (g.x2 - g.x1) * t1, z1 = g.z1 + (g.z2 - g.z1) * t1;
    const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
    const h0 = Math.max(0.3, provHeight(p, x0, z0)), h1 = Math.max(0.3, provHeight(p, x1, z1)), hm = Math.max(0.3, provHeight(p, mx, mz));
    const seg = L / n;
    const pitch = Math.atan2(h1 - h0, seg);
    const put = (geo, sx, sy, sz, col, yoff, xoff) => {
      const m = new THREE.Mesh(geo, mat(col));
      m.scale.set(sx, sy, sz);
      m.position.set(mx + (xoff || 0) * dz, Math.min(h0, h1, hm) + (yoff || 0), mz - (xoff || 0) * dx);
      m.rotation.order = 'YXZ'; m.rotation.y = ang; m.rotation.x = -pitch;
      m.castShadow = g.t === 'wall' || g.t === 'palisade'; m.receiveShadow = true;
      grp.add(m); return m;
    };
    if (g.t === 'road') put(GEO.b, S0.width, 0.35, seg + 0.4, color, -0.1);
    else if (g.t === 'rail') { put(GEO.b, 3, 0.4, seg + 0.3, 0x6b655c, -0.1); put(GEO.b, 2.4, 0.16, 0.5, COL.darkwood, 0.3); put(GEO.b, 0.15, 0.2, seg + 0.3, COL.steel, 0.4, 0.6); put(GEO.b, 0.15, 0.2, seg + 0.3, COL.steel, 0.4, -0.6); }
    else if (g.t === 'wall') { put(GEO.b, S0.width, 4.2, seg + 0.05, color, -0.5); if (i % 2 === 0) put(GEO.b, S0.width + 0.2, 0.8, 0.8, color, 3.7); }
    else if (g.t === 'palisade') { for (let k = 0; k < 3; k++) { const m = put(GEO.c, 0.5, 3.4, 0.5, color, -0.3); m.position.x += dx * (k - 1) * seg / 3; m.position.z += dz * (k - 1) * seg / 3; m.rotation.set(0, 0, 0); const tip = put(GEO.k, 0.5, 0.6, 0.5, color, 3.1); tip.position.x = m.position.x; tip.position.z = m.position.z; tip.rotation.set(0, 0, 0); } }
  }
  if (g.t === 'wall' && built >= 1) for (const [x, z] of [[g.x1, g.z1], [g.x2, g.z2]]) {
    const t = new THREE.Mesh(GEO.c, mat(color)); t.scale.set(3.4, 6.5, 3.4); t.position.set(x, provHeight(p, x, z) - 0.5, z); t.castShadow = true; grp.add(t);
    const r = new THREE.Mesh(GEO.k, mat(COL.slate)); r.scale.set(4, 2.4, 4); r.position.set(x, provHeight(p, x, z) + 6, z); grp.add(r);
  }
  grp.userData.sid = g.id;
  return grp;
}

// ---------- scene construction ----------
function p3Init(container) {
  if (P3.renderer) return;
  initGeo();
  const r = new THREE.WebGLRenderer({ antialias: true });
  r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(r.domElement);
  r.domElement.className = 'p3canvas';
  P3.renderer = r; P3.container = container;
  P3.camera = new THREE.PerspectiveCamera(50, 1, 0.5, 2000);
  p3BindInput(r.domElement);
}
function p3Resize() {
  if (!P3.renderer) return;
  const w = P3.container.clientWidth, h = P3.container.clientHeight;
  P3.size = w + 'x' + h;
  P3.renderer.setSize(w, h); P3.camera.aspect = w / Math.max(1, h); P3.camera.updateProjectionMatrix();
}
function terrainColor(p, x, z, h, slope, winter) {
  const t = p.terrain;
  let c;
  if (h < 0.9 && (p.coastal || p.river)) c = [0.84, 0.76, 0.55];
  else if (t === 'desert') { const n = vnoise(x / 9, z / 9, p.seed); c = [0.86 - n * 0.08, 0.74 - n * 0.08, 0.5 - n * 0.06]; if (slope > 3) c = [0.68, 0.55, 0.4]; }
  else {
    const g = t === 'forest' ? [0.24, 0.42, 0.2] : t === 'tundra' ? [0.55, 0.6, 0.5] : t === 'hills' ? [0.46, 0.55, 0.3] : t === 'mountain' ? [0.42, 0.5, 0.3] : [0.42, 0.6, 0.27];
    const n = vnoise(x / 12, z / 12, p.seed + 1) * 0.12;
    c = [g[0] + n * 0.5, g[1] + n, g[2] + n * 0.3];
    if (slope > 2.6) { const k = smoothstep(2.6, 5, slope); c = [lerp(c[0], 0.5, k), lerp(c[1], 0.47, k), lerp(c[2], 0.42, k)]; }
    if (t === 'mountain' && h > 38) { const k = smoothstep(38, 52, h); c = [lerp(c[0], 0.95, k), lerp(c[1], 0.96, k), lerp(c[2], 0.98, k)]; }
  }
  if (p.fallout > G.day) c = [c[0] * 0.55 + 0.1, c[1] * 0.5 + 0.1, c[2] * 0.45 + 0.08]; // scorched, ash-grey land
  if (winter && t !== 'desert' && h > 0.6) { const k = t === 'tundra' || t === 'mountain' ? 0.6 : 0.28; c = [lerp(c[0], 0.93, k), lerp(c[1], 0.95, k), lerp(c[2], 0.97, k)]; }
  return c;
}
function p3BuildScene(p) {
  const T = THREE;
  const scene = new T.Scene();
  P3.scene = scene; P3.prov = p; P3.meshes.clear(); P3.segMeshes.clear(); P3.sig.clear();
  const q = G.settings.quality;
  scene.fog = new T.Fog(0x9cc6e0, 220, 520);
  P3.hemi = new T.HemisphereLight(0xdfeeff, 0x4a4030, 0.65); scene.add(P3.hemi);
  const sun = new T.DirectionalLight(0xfff2d8, 0.9);
  sun.castShadow = q !== 'low';
  sun.shadow.mapSize.set(q === 'high' ? 2048 : 1024, q === 'high' ? 2048 : 1024);
  Object.assign(sun.shadow.camera, { left: -130, right: 130, top: 130, bottom: -130, near: 10, far: 500 });
  scene.add(sun); scene.add(sun.target); P3.sun = sun;
  // terrain
  const N = q === 'low' ? 90 : 130;
  const geo = new T.PlaneGeometry(260, 260, N, N); geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position, cols = new Float32Array(pos.count * 3);
  const winter = isWinter();
  let hasWater = false;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), h = provHeight(p, x, z);
    pos.setY(i, h); if (h < 0) hasWater = true;
    const c = terrainColor(p, x, z, h, provSlope(p, x, z), winter);
    cols[i * 3] = c[0]; cols[i * 3 + 1] = c[1]; cols[i * 3 + 2] = c[2];
  }
  geo.setAttribute('color', new T.BufferAttribute(cols, 3)); geo.computeVertexNormals();
  const terrain = new T.Mesh(geo, new T.MeshLambertMaterial({ vertexColors: true }));
  terrain.receiveShadow = true; scene.add(terrain); P3.terrain = terrain;
  if (hasWater) {
    const w = new T.Mesh(new T.PlaneGeometry(600, 600), new T.MeshPhongMaterial({ color: 0x2c6a86, transparent: true, opacity: 0.82, shininess: 90, specular: 0x88aacc }));
    w.rotation.x = -Math.PI / 2; w.position.y = 0.05; scene.add(w); P3.water = w;
  } else P3.water = null;
  // trees and rocks (instanced)
  P3.trees = null; p3Trees();
  const rocksN = { mountain: 120, desert: 50, hills: 60, tundra: 40 }[p.terrain] || 15;
  const rm = new T.InstancedMesh(GEO.dode, mat(0x8a857c), rocksN), dm = new T.Object3D(), rr = mulberry32(p.seed + 77);
  for (let i = 0; i < rocksN; i++) { const x = (rr() - 0.5) * 220, z = (rr() - 0.5) * 220, s = 0.5 + rr() * (p.terrain === 'mountain' ? 3 : 1.4); dm.position.set(x, provHeight(p, x, z) - s * 0.3, z); dm.scale.set(s, s * 0.7, s); dm.rotation.set(rr(), rr() * 6, rr()); dm.updateMatrix(); rm.setMatrixAt(i, dm.matrix); }
  rm.castShadow = true; scene.add(rm);
  // structures
  P3.structRoot = new T.Group(); scene.add(P3.structRoot);
  p3SyncStructures(true);
  // particles: smoke, weather
  p3InitParticles();
  // ambient life
  p3InitLife();
  // ghost for placement
  P3.ghost = null;
  const tc = p.town || findTownCenter(p);
  P3.cam.tx = tc.x; P3.cam.tz = tc.z; P3.cam.dist = 120; P3.cam.pitch = 0.78;
}
function p3Trees() {
  const p = P3.prov, T = THREE, scene = P3.scene;
  if (P3.trees) { for (const m of P3.trees) { scene.remove(m); } }
  const qmul = { low: 0.4, medium: 1, high: 1.6 }[G.settings.quality];
  const dens = { forest: 1400, grassland: 220, hills: 350, mountain: 320, tundra: 160, desert: 50 }[p.terrain] * qmul;
  const conifer = p.terrain === 'mountain' || p.terrain === 'tundra' || (p.terrain === 'forest' && p.cy < MH * 0.35);
  const desert = p.terrain === 'desert';
  const rr = mulberry32(p.seed + 5);
  const pts = [];
  const blockers = p.buildings.map(b => [b.x, b.z, BUILDINGS[b.t].r * (b.t === 'farm' || b.t === 'plantation' ? 1.6 : 1.2) + 2]);
  const segs = p.segs;
  for (let i = 0; i < dens * 1.5 && pts.length < dens; i++) {
    let x = (rr() - 0.5) * 250, z = (rr() - 0.5) * 250;
    if (p.terrain !== 'forest' && rr() < 0.6) { const cx = (vnoise(i * 0.1, 3, p.seed) - 0.5) * 200, cz = (vnoise(i * 0.1, 9, p.seed) - 0.5) * 200; x = cx + (rr() - 0.5) * 40; z = cz + (rr() - 0.5) * 40; }
    const h = provHeight(p, x, z);
    if (h < 0.8 || (p.terrain === 'mountain' && h > 40) || provSlope(p, x, z) > 5) continue;
    if (p.terrain === 'forest' && vnoise(x / 30, z / 30, p.seed + 2) < 0.3) continue;
    let ok = true;
    for (const [bx, bz, br] of blockers) if (Math.abs(x - bx) < br && Math.abs(z - bz) < br) { ok = false; break; }
    if (ok) for (const g of segs) { const d = distToSeg(x, z, g); if (d < 3.5) { ok = false; break; } }
    if (ok) pts.push([x, h, z, 0.7 + rr() * 0.8, rr()]);
  }
  const n = pts.length, d = new T.Object3D();
  const trunk = new T.InstancedMesh(GEO.c, mat(0x5a4330), n);
  const fol = new T.InstancedMesh(desert ? GEO.c : conifer ? GEO.k : GEO.ico, mat(desert ? 0x5f8a4a : conifer ? 0x2e4f2c : 0x3f6a32), n);
  pts.forEach(([x, h, z, s, r], i) => {
    d.rotation.set(0, r * 6, 0);
    d.position.set(x, h - 0.2, z); d.scale.set(0.4 * s, (desert ? 0.5 : 2.2) * s, 0.4 * s); d.updateMatrix(); trunk.setMatrixAt(i, d.matrix);
    if (desert) { d.position.set(x, h, z); d.scale.set(0.8 * s, 3 * s, 0.8 * s); }
    else if (conifer) { d.position.set(x, h + 1.2 * s, z); d.scale.set(3 * s, 6 * s, 3 * s); }
    else { d.position.set(x, h + 3.4 * s, z); d.scale.set(2.2 * s, 2 * s, 2.2 * s); }
    d.updateMatrix(); fol.setMatrixAt(i, d.matrix);
    if (fol.setColorAt && !desert) { const v = 0.85 + r * 0.3; fol.setColorAt(i, new T.Color(v, v, v)); }
  });
  trunk.castShadow = fol.castShadow = G.settings.quality !== 'low';
  scene.add(trunk); scene.add(fol); P3.trees = [trunk, fol];
}
function distToSeg(x, z, g) {
  const vx = g.x2 - g.x1, vz = g.z2 - g.z1, L2 = vx * vx + vz * vz || 1;
  const t = clamp(((x - g.x1) * vx + (z - g.z1) * vz) / L2, 0, 1);
  return Math.hypot(x - (g.x1 + vx * t), z - (g.z1 + vz * t));
}
function bSig(b) { return `${b.t}|${b.lvl}|${b.prog >= 1 ? 'd' : Math.floor(b.prog * 6)}|${b.hp < 25 ? 'r' : b.hp < 60 ? 'x' : 'o'}|${b.upg != null}|${b.rep != null}`; }
function gSig(g) { return `${g.prog >= 1 ? 'd' : Math.floor(g.prog * 8)}|${Math.floor(g.hp / 10)}`; }
// Diff the province data against the scene and rebuild only what changed
function p3SyncStructures(force) {
  const p = P3.prov, era = C(p.owner) ? C(p.owner).era : G.era;
  let treesDirty = false;
  const seen = new Set();
  for (const b of p.buildings) {
    seen.add(b.id);
    const sig = bSig(b);
    if (!force && P3.sig.get(b.id) === sig) continue;
    const old = P3.meshes.get(b.id);
    if (old) P3.structRoot.remove(old); else treesDirty = true;
    const o = buildingObject(b, p, era);
    P3.structRoot.add(o); P3.meshes.set(b.id, o); P3.sig.set(b.id, sig);
  }
  for (const g of p.segs) {
    seen.add(g.id);
    const sig = gSig(g);
    if (!force && P3.sig.get(g.id) === sig) continue;
    const old = P3.segMeshes.get(g.id);
    if (old) P3.structRoot.remove(old); else treesDirty = true;
    const o = segmentObject(g, p, era);
    P3.structRoot.add(o); P3.segMeshes.set(g.id, o); P3.sig.set(g.id, sig);
  }
  for (const [id, m] of [...P3.meshes, ...P3.segMeshes]) if (!seen.has(id)) { P3.structRoot.remove(m); P3.meshes.delete(id); P3.segMeshes.delete(id); P3.sig.delete(id); treesDirty = true; }
  if (treesDirty && !force) p3Trees();
}

// ---------- particles (smoke, fire, rain/snow) ----------
function p3InitParticles() {
  const T = THREE, N = 700;
  const g = new T.BufferGeometry();
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('color', new T.BufferAttribute(col, 3));
  const m = new T.PointsMaterial({ size: 2.2, vertexColors: true, transparent: true, opacity: 0.6, depthWrite: false });
  const pts = new T.Points(g, m); pts.frustumCulled = false; P3.scene.add(pts);
  P3.particles = { pts, pos, col, n: N, life: new Float32Array(N), vel: new Float32Array(N * 3), next: 0 };
  for (let i = 0; i < N; i++) pos[i * 3 + 1] = -999;
  // rain as short streaks, snow as drifting flakes
  const W = 1400, rg = new T.BufferGeometry(), rp = new Float32Array(W * 6), sg = new T.BufferGeometry(), spos = new Float32Array(W * 3);
  for (let i = 0; i < W; i++) {
    const x = (Math.random() - 0.5) * 240, y = Math.random() * 90, z = (Math.random() - 0.5) * 240;
    rp.set([x, y, z, x + 0.2, y + 1.6, z], i * 6); spos.set([x, y, z], i * 3);
  }
  rg.setAttribute('position', new T.BufferAttribute(rp, 3)); sg.setAttribute('position', new T.BufferAttribute(spos, 3));
  P3.rain = new T.LineSegments(rg, new T.LineBasicMaterial({ color: 0x9fb4c8, transparent: true, opacity: 0.45 }));
  P3.snowPts = new T.Points(sg, new T.PointsMaterial({ size: 0.35, color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false }));
  P3.rain.frustumCulled = P3.snowPts.frustumCulled = false;
  P3.scene.add(P3.rain); P3.scene.add(P3.snowPts);
}
function emit(x, y, z, vx, vy, vz, r, g, b, life) {
  const P = P3.particles, i = P.next; P.next = (P.next + 1) % P.n;
  P.pos[i * 3] = x; P.pos[i * 3 + 1] = y; P.pos[i * 3 + 2] = z;
  P.vel[i * 3] = vx; P.vel[i * 3 + 1] = vy; P.vel[i * 3 + 2] = vz;
  P.col[i * 3] = r; P.col[i * 3 + 1] = g; P.col[i * 3 + 2] = b; P.life[i] = life;
}
function p3Particles(dt) {
  const P = P3.particles, p = P3.prov;
  if (!P) return;
  // emitters
  for (const b of p.buildings) {
    const B = BUILDINGS[b.t];
    const burning = b.hp < 50 && b.prog >= 1;
    if ((B.smoke && b.prog >= 1 && b.hp >= 25) || burning) {
      if (Math.random() < dt * (burning ? 6 : 3)) {
        const h = provHeight(p, b.x, b.z) + (burning ? 2 : 10 + b.lvl * 2);
        const g = burning ? 0.25 : b.t === 'powerplant' ? 0.85 : 0.45;
        emit(b.x + (Math.random() - 0.5) * B.r, h, b.z + (Math.random() - 0.5) * B.r, 0.6 + Math.random(), 2 + Math.random() * 2, 0.3, g, g, g * 1.02, 5);
        if (burning && Math.random() < 0.5) emit(b.x, h, b.z, 0, 3, 0, 1, 0.5, 0.15, 0.8);
      }
    }
  }
  for (let i = 0; i < P.n; i++) {
    if (P.life[i] <= 0) continue;
    P.life[i] -= dt;
    if (P.life[i] <= 0) { P.pos[i * 3 + 1] = -999; continue; }
    P.pos[i * 3] += P.vel[i * 3] * dt; P.pos[i * 3 + 1] += P.vel[i * 3 + 1] * dt; P.pos[i * 3 + 2] += P.vel[i * 3 + 2] * dt;
    P.vel[i * 3 + 1] -= (P.vel[i * 3 + 1] < -20 ? 0 : P.col[i * 3] > 0.9 && P.col[i * 3 + 1] > 0.7 ? 9 : 0) * dt;
  }
  P.pts.geometry.attributes.position.needsUpdate = true; P.pts.geometry.attributes.color.needsUpdate = true;
  // weather
  const w = weatherAt(p);
  P3.rain.visible = w === 'rain' || w === 'storm';
  P3.snowPts.visible = w === 'snow';
  if (P3.rain.visible) {
    const a = P3.rain.geometry.attributes.position.array, sp = (w === 'storm' ? 80 : 55) * dt;
    for (let i = 0; i < a.length; i += 6) { let y = a[i + 1] - sp; if (y < 0) y += 90; a[i + 1] = y; a[i + 4] = y + 1.6; }
    P3.rain.geometry.attributes.position.needsUpdate = true;
  }
  if (P3.snowPts.visible) {
    const a = P3.snowPts.geometry.attributes.position.array;
    for (let i = 0; i < a.length; i += 3) { let y = a[i + 1] - 5 * dt; if (y < 0) y += 90; a[i + 1] = y; a[i] += Math.sin(y + i) * dt; }
    P3.snowPts.geometry.attributes.position.needsUpdate = true;
  }
}

// ---------- ambient life: birds, animals, villagers ----------
function p3InitLife() {
  const T = THREE, p = P3.prov;
  P3.life = [];
  const rr = mulberry32(p.seed + 9);
  for (let i = 0; i < 7; i++) {
    const b = partsToGroup([['b', 1.6, 0.08, 0.5, -0.7, 0, 0, 0x222222, 0.4], ['b', 1.6, 0.08, 0.5, 0.7, 0, 0, 0x222222, -0.4]]);
    b.userData = { kind: 'bird', r: 30 + rr() * 50, a: rr() * 6, s: 0.15 + rr() * 0.2, h: 35 + rr() * 20, cx: (rr() - 0.5) * 60, cz: (rr() - 0.5) * 60 };
    P3.scene.add(b); P3.life.push(b);
  }
  if (p.terrain !== 'desert' && p.terrain !== 'mountain') for (let i = 0; i < 10; i++) {
    const sheep = p.terrain === 'grassland' || p.terrain === 'hills';
    const a = partsToGroup([['b', 1.4, 0.9, 0.8, 0, 0.5, 0, sheep ? 0xeeeae0 : 0x7a5a3a], ['b', 0.5, 0.5, 0.5, 0.8, 1, 0, sheep ? 0x333333 : 0x6a4a2a]]);
    let x = (rr() - 0.5) * 160, z = (rr() - 0.5) * 160;
    a.userData = { kind: 'animal', x, z, tx: x, tz: z, wait: rr() * 5 };
    P3.scene.add(a); P3.life.push(a);
  }
  const npeople = Math.min(30, Math.round(p.buildings.length * 1.5));
  for (let i = 0; i < npeople; i++) {
    const v = partsToGroup([['c', 0.6, 1.3, 0.6, 0, 0, 0, pick(rr, [0x7a3b2e, 0x3b4e7a, 0x6a6a3a, 0x5a4a3a, 0x8a7a5a])], ['s', 0.5, 0.5, 0.5, 0, 1.3, 0, 0xe0b890]]);
    v.userData = { kind: 'person', x: 0, z: 0, tx: 0, tz: 0, wait: 0 };
    const b = p.buildings.length ? pick(rr, p.buildings) : { x: 0, z: 0 };
    v.userData.x = b.x; v.userData.z = b.z;
    P3.scene.add(v); P3.life.push(v);
  }
}
function p3Life(dt) {
  const p = P3.prov;
  for (const o of P3.life) {
    const u = o.userData;
    if (u.kind === 'bird') { u.a += u.s * dt; o.position.set(u.cx + Math.cos(u.a) * u.r, u.h + Math.sin(u.a * 3) * 2, u.cz + Math.sin(u.a) * u.r); o.rotation.y = -u.a; o.children[0].rotation.z = Math.sin(Date.now() / 120 + u.r) * 0.5; o.children[1].rotation.z = -o.children[0].rotation.z; continue; }
    if (u.wait > 0) { u.wait -= dt; }
    else {
      const dx = u.tx - u.x, dz = u.tz - u.z, d = Math.hypot(dx, dz);
      const sp = u.kind === 'person' ? 3 : 1.2;
      if (d < 0.5) {
        u.wait = u.kind === 'person' ? 1 + Math.random() * 4 : 3 + Math.random() * 8;
        if (u.kind === 'person' && p.buildings.length) { const b = pick(Math.random, p.buildings); u.tx = b.x + (Math.random() - 0.5) * 4; u.tz = b.z + (Math.random() - 0.5) * 4; }
        else { u.tx = clamp(u.x + (Math.random() - 0.5) * 30, -95, 95); u.tz = clamp(u.z + (Math.random() - 0.5) * 30, -95, 95); }
        if (provHeight(p, u.tx, u.tz) < 0.6) { u.tx = u.x; u.tz = u.z; }
      } else { u.x += dx / d * sp * dt; u.z += dz / d * sp * dt; o.rotation.y = Math.atan2(dx, dz) - Math.PI / 2; }
    }
    o.position.set(u.x, Math.max(0.3, provHeight(p, u.x, u.z)), u.z);
  }
}

// ---------- day / night ----------
function p3Sky(dt) {
  P3.tod = (P3.tod + dt / 240) % 1;
  const a = P3.tod * Math.PI * 2 - Math.PI / 2;
  const el = Math.sin(a), day = smoothstep(-0.15, 0.25, el);
  const cx = P3.cam.tx, cz = P3.cam.tz;
  P3.sun.position.set(cx + Math.cos(a) * 200, Math.max(20, el * 260), cz + 80);
  P3.sun.target.position.set(cx, 0, cz);
  P3.sun.intensity = 0.15 + day * 0.85;
  P3.hemi.intensity = 0.3 + day * 0.45;
  const dawn = Math.max(0, 1 - Math.abs(el) * 4) * (el > -0.2 ? 1 : 0);
  const night = new THREE.Color(0x0d1426), dayC = new THREE.Color(0x9cc6e0), dusk = new THREE.Color(0xe3946a);
  const sky = night.clone().lerp(dayC, day).lerp(dusk, dawn * 0.5);
  P3.scene.background = sky; P3.scene.fog.color = sky;
  P3.sun.color.setHex(dawn > 0.3 ? 0xffc890 : 0xfff2d8);
}

// ---------- camera & input ----------
function p3Camera() {
  const c = P3.cam;
  c.pitch = clamp(c.pitch, 0.22, 1.45); c.dist = clamp(c.dist, 20, 320);
  c.tx = clamp(c.tx, -110, 110); c.tz = clamp(c.tz, -110, 110);
  const th = Math.max(0, provHeight(P3.prov, c.tx, c.tz));
  P3.camera.position.set(c.tx + Math.sin(c.yaw) * Math.cos(c.pitch) * c.dist, th + Math.sin(c.pitch) * c.dist, c.tz + Math.cos(c.yaw) * Math.cos(c.pitch) * c.dist);
  P3.camera.lookAt(c.tx, th, c.tz);
}
// Ray-march the analytic height field: cheaper and exact compared to mesh raycasts
function p3Ground(clientX, clientY) {
  const r = P3.renderer.domElement.getBoundingClientRect();
  const v = new THREE.Vector3(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1, 0.5).unproject(P3.camera);
  const o = P3.camera.position.clone(), d = v.sub(o).normalize();
  let t = 0, prev = 0;
  for (let i = 0; i < 600; i++) {
    t += 1.2;
    const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t;
    if (y < Math.max(0, provHeight(P3.prov, x, z))) {
      let lo = prev, hi = t;
      for (let k = 0; k < 12; k++) { const m = (lo + hi) / 2, X = o.x + d.x * m, Y = o.y + d.y * m, Z = o.z + d.z * m; if (Y < Math.max(0, provHeight(P3.prov, X, Z))) hi = m; else lo = m; }
      return { x: o.x + d.x * hi, z: o.z + d.z * hi };
    }
    prev = t;
  }
  return null;
}
function p3Pick(clientX, clientY) {
  const r = P3.renderer.domElement.getBoundingClientRect();
  const ray = new THREE.Raycaster();
  ray.setFromCamera(new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1), P3.camera);
  const hits = ray.intersectObjects(P3.structRoot.children, true);
  for (const h of hits) { let o = h.object; while (o && o.userData.bid == null && o.userData.sid == null) o = o.parent; if (o) return o.userData.bid != null ? { kind: 'b', id: o.userData.bid } : { kind: 's', id: o.userData.sid }; }
  return null;
}
function snapPos(pt) { if (!P3.snap) return pt; return { x: Math.round(pt.x / 2) * 2, z: Math.round(pt.z / 2) * 2 }; }
function p3BindInput(el) {
  let drag = null;
  // Touch: two fingers pinch to zoom, twist to rotate, slide up/down together to tilt
  const touches = new Map();
  let pinch = null;
  const pinchInfo = () => { const [a, b] = [...touches.values()]; return { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, ang: Math.atan2(b.y - a.y, b.x - a.x), my: (a.y + b.y) / 2 }; };
  const endTouch = e => { if (touches.delete(e.pointerId) && touches.size < 2) pinch = null; };
  el.addEventListener('pointercancel', e => { endTouch(e); drag = null; });
  el.addEventListener('pointerdown', e => {
    if (!P3.active) return;
    if (e.pointerType === 'touch') {
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.size >= 2) { try { el.setPointerCapture(e.pointerId); } catch (err) { /* pointer already gone */ } drag = null; pinch = pinchInfo(); return; }
    }
  }, true);
  el.addEventListener('pointermove', e => {
    if (!touches.has(e.pointerId)) return;
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (!pinch || touches.size < 2) return;
    const n = pinchInfo();
    let da = n.ang - pinch.ang; if (da > Math.PI) da -= 2 * Math.PI; if (da < -Math.PI) da += 2 * Math.PI;
    P3.cam.dist *= pinch.d / n.d; P3.cam.yaw -= da; P3.cam.pitch += (n.my - pinch.my) * 0.005;
    pinch = n; e.stopImmediatePropagation();
  }, true);
  el.addEventListener('pointerup', e => { const was = !!pinch; endTouch(e); if (was) { drag = null; e.stopImmediatePropagation(); } }, true);
  el.addEventListener('contextmenu', e => e.preventDefault());
  el.addEventListener('pointerdown', e => {
    if (!P3.active || pinch) return;
    el.setPointerCapture(e.pointerId);
    const g = p3Ground(e.clientX, e.clientY);
    if (e.button === 2) { drag = { kind: 'orbit', x: e.clientX, y: e.clientY }; return; }
    if (e.button === 1) { drag = { kind: 'pan', x: e.clientX, y: e.clientY }; return; }
    if (P3.mode === 'battle') { drag = { kind: 'pan', x: e.clientX, y: e.clientY }; return; }
    const tool = P3.tool;
    if (tool.kind === 'seg' && g) { const s = snapPos(g); drag = { kind: 'seg', x1: s.x, z1: s.z, x: e.clientX, y: e.clientY }; return; }
    if (tool.kind === 'build' && g) { const s = snapPos(g); UIHooks.p3Place(tool.type, s.x, s.z, P3.ghostRot); return; }
    if (tool.kind === 'demolish') { const hit = p3Pick(e.clientX, e.clientY); if (hit) UIHooks.p3Demolish(hit); return; }
    const hit = p3Pick(e.clientX, e.clientY);
    if (hit && hit.kind === 'b') { P3.selected = hit.id; UIHooks.p3Select(hit.id); }
    else { P3.selected = null; UIHooks.p3Select(null); }
    drag = { kind: 'pan', x: e.clientX, y: e.clientY };
  });
  el.addEventListener('pointermove', e => {
    if (!P3.active) return;
    P3.mouse = { x: e.clientX, y: e.clientY };
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (drag.kind === 'orbit') { P3.cam.yaw -= dx * 0.006; P3.cam.pitch += dy * 0.005; drag.x = e.clientX; drag.y = e.clientY; }
    else if (drag.kind === 'pan') {
      const k = P3.cam.dist * 0.0022, c = Math.cos(P3.cam.yaw), s = Math.sin(P3.cam.yaw);
      P3.cam.tx -= (dx * c + dy * s) * k; P3.cam.tz -= (-dx * s + dy * c) * k; drag.x = e.clientX; drag.y = e.clientY;
    }
  });
  el.addEventListener('pointerup', e => {
    if (!P3.active || !drag) { drag = null; return; }
    if (drag.kind === 'seg') {
      const g = p3Ground(e.clientX, e.clientY);
      if (g) { const s = snapPos(g); UIHooks.p3Segment(P3.tool.type, drag.x1, drag.z1, s.x, s.z); }
    }
    drag = null;
  });
  el.addEventListener('wheel', e => { if (!P3.active) return; e.preventDefault(); P3.cam.dist *= Math.exp(e.deltaY * 0.0012); }, { passive: false });
  P3.dragRef = () => drag;
}
function p3Keys(dt, keys) {
  const sp = P3.cam.dist * 0.9 * dt, c = Math.cos(P3.cam.yaw), s = Math.sin(P3.cam.yaw);
  let fx = 0, fz = 0;
  if (keys.has('w') || keys.has('arrowup')) fz -= 1; if (keys.has('s') || keys.has('arrowdown')) fz += 1;
  if (keys.has('a') || keys.has('arrowleft')) fx -= 1; if (keys.has('d') || keys.has('arrowright')) fx += 1;
  P3.cam.tx += (fx * c + fz * s) * sp; P3.cam.tz += (-fx * s + fz * c) * sp;
}

// ---------- ghost previews ----------
function p3UpdateGhost() {
  const tool = P3.tool, p = P3.prov;
  const drag = P3.dragRef && P3.dragRef();
  if (P3.ghost) { P3.scene.remove(P3.ghost); P3.ghost = null; }
  if (!P3.mouse || P3.mode !== 'province') return;
  const g = p3Ground(P3.mouse.x, P3.mouse.y);
  if (!g) return;
  const s = snapPos(g);
  const c = C(G.player);
  if (tool.kind === 'build') {
    const err = canPlaceAt(p, tool.type, s.x, s.z) || (p.controller !== G.player ? 'Not your province' : null) || (!canAfford(c, scaledCost(c, BUILDINGS[tool.type].cost)) ? 'Cannot afford' : null);
    const gm = new THREE.MeshBasicMaterial({ color: err ? 0xd04a3a : 0x6fd07a, transparent: true, opacity: 0.45, depthWrite: false });
    const grp = partsToGroup(recipe(tool.type, 1, c.era, mulberry32(1), p), gm);
    const ring = new THREE.Mesh(new THREE.RingGeometry(BUILDINGS[tool.type].r - 0.3, BUILDINGS[tool.type].r, 32), gm); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.4; grp.add(ring);
    grp.position.set(s.x, provHeight(p, s.x, s.z), s.z); grp.rotation.y = P3.ghostRot;
    P3.ghost = grp; P3.ghostErr = err; P3.scene.add(grp);
  } else if (tool.kind === 'seg' && drag && drag.kind === 'seg') {
    const L = Math.hypot(s.x - drag.x1, s.z - drag.z1);
    if (L < 1) return;
    const gm = new THREE.MeshBasicMaterial({ color: 0x6fd07a, transparent: true, opacity: 0.55, depthWrite: false });
    const m = new THREE.Mesh(GEO.b, gm);
    m.scale.set(SEGMENTS[tool.type].width, tool.type === 'wall' ? 4 : tool.type === 'palisade' ? 3 : 0.5, L);
    const mx = (s.x + drag.x1) / 2, mz = (s.z + drag.z1) / 2;
    m.position.set(mx, provHeight(p, mx, mz), mz); m.rotation.y = Math.atan2(s.x - drag.x1, s.z - drag.z1);
    P3.ghost = m; P3.ghostLen = L; P3.scene.add(m);
  }
}

// ---------- enter / exit / frame ----------
function p3Enter(provId, mode) {
  P3.mode = mode || 'province';
  const p = G.provs[provId];
  p3BuildScene(p);
  P3.active = true; P3.selected = null; P3.tool = { kind: 'select', type: null };
  P3.army = null; P3.armyT = 0;
  p3SpawnArmies();
  p3Resize();
  P3.intro = 1; // camera swoop-in from high above
}
function p3Exit() {
  P3.active = false;
  if (P3.scene) P3.scene.traverse(o => { if (o.geometry && !Object.values(GEO).includes(o.geometry)) o.geometry.dispose(); });
  P3.scene = null; P3.battle = null; P3.army = null;
}
function p3Frame(dt, keys) {
  if (!P3.active) return;
  if (P3.size !== P3.container.clientWidth + 'x' + P3.container.clientHeight) p3Resize();
  if (P3.intro > 0) { P3.intro = Math.max(0, P3.intro - dt * 0.8); }
  p3Keys(dt, keys);
  // structures change as the simulation runs (construction, damage, upgrades)
  P3.syncT = (P3.syncT || 0) - dt;
  if (P3.syncT <= 0) { P3.syncT = 0.4; p3SyncStructures(false); }
  for (const m of P3.meshes.values()) m.traverse(o => { const s = o.userData.spin; if (s) { if (o.userData.axis === 'z') o.rotation.z += s * dt; else o.rotation.y += s * dt; } });
  p3Sky(dt); p3Particles(dt); p3Life(dt);
  armyFrame(dt);
  p3UpdateGhost();
  const saveDist = P3.cam.dist, savePitch = P3.cam.pitch;
  if (P3.intro > 0) { const k = P3.intro * P3.intro; P3.cam.dist = lerp(saveDist, 320, k); P3.cam.pitch = lerp(savePitch, 1.4, k); }
  p3Camera();
  P3.cam.dist = saveDist; P3.cam.pitch = savePitch;
  // simple LOD: hide small detail when far away
  const far = P3.cam.dist > 230;
  for (const o of P3.life) if (o.userData.kind !== 'bird') o.visible = !far;
  P3.renderer.render(P3.scene, P3.camera);
}

// ============================================================
// Troops in the province: garrisons, assaults and sieges, mirrored from the strategic simulation.
// Shown whenever a province is entered; "Watch battle" uses the same scene with a battle HUD.
// ============================================================
function armySides(p) {
  const att = G.divs.filter(d => (d.state === 'battle' || d.state === 'siege') && d.attacking === p.id);
  const def = G.divs.filter(d => d.prov === p.id && d.state !== 'training' && (!att.length || att.some(a => atWar(a.owner, d.owner))));
  return { att, def };
}
const armySig = (att, def) => att.map(d => d.id).sort().join(',') + '|' + def.map(d => d.id).sort().join(',');
function sumStr(divs) { let s = 0; for (const d of divs) s += d.str * d.bats.length; return s; }
function p3ClearArmies() {
  if (!P3.army) return;
  for (const u of P3.army.units) P3.scene.remove(u);
  for (const f of P3.army.fx) P3.scene.remove(f.mesh);
  P3.army = null;
}
function p3SpawnArmies() {
  const p = P3.prov;
  p3ClearArmies();
  const { att, def } = armySides(p);
  if (!att.length && !def.length) return;
  const tc = p.town || findTownCenter(p);
  let ax = 1, az = 0.3;
  if (att.length) { const from = G.provs[att[0].prov]; ax = from.cx - p.cx; az = from.cy - p.cy; }
  const l = Math.hypot(ax, az) || 1; ax /= l; az /= l;
  const era = Math.max(0, ...[...att, ...def].map(d => C(d.owner).era));
  const A = { units: [], fx: [], era, ax, az, tc, sig: armySig(att, def), start: { a: sumStr(att), d: sumStr(def) }, divStart: new Map(), divCount: new Map(), hasAtt: att.length > 0, live: att.length > 0, targets: [] };
  P3.army = A;
  // fortifications the besiegers aim at when no defenders remain
  for (const b of p.buildings) if (BUILDINGS[b.t].eff.fort && b.prog >= 1) A.targets.push({ x: b.x, z: b.z });
  for (const g of p.segs) if ((g.t === 'wall' || g.t === 'palisade') && g.prog >= 1) A.targets.push({ x: (g.x1 + g.x2) / 2, z: (g.z1 + g.z2) / 2 });
  if (!A.targets.length) A.targets.push({ x: tc.x, z: tc.z });
  const px = -az, pz = ax; // perpendicular to the attack axis
  const place = (d, di, side, i, cat) => {
    if (side === 'a') {
      const depth = cat === 'art' ? 24 : cat === 'cav' || cat === 'arm' ? 7 : 0, row = Math.floor(i / 8), col = i % 8;
      const along = 72 + depth + row * 3, lat = ((di % 4) - 1.5) * 26 + (col - 3.5) * 2.8;
      return [tc.x + ax * along + px * lat, tc.z + az * along + pz * lat];
    }
    if (A.hasAtt) {
      const depth = cat === 'art' ? -14 : 0, row = Math.floor(i / 8), col = i % 8;
      const along = 12 + depth - row * 2.6, lat = ((di % 4) - 1.5) * 24 + (col - 3.5) * 2.6;
      return [tc.x + ax * along + px * lat, tc.z + az * along + pz * lat];
    }
    // garrison drawn up on parade beside the town, one block per division
    const bx = tc.x + 16 + (di % 3) * 16, bz = tc.z - 14 + Math.floor(di / 3) * 16;
    return [bx + (i % 6) * 1.8, bz + Math.floor(i / 6) * 1.8];
  };
  const mk = (divs, side) => divs.forEach((d, di) => {
    A.divStart.set(d.id, Math.max(0.05, d.str));
    const col = rgbHex(C(d.owner).color);
    let i = 0;
    for (const bat of d.bats) {
      const cat = BATTALIONS[bat].cat;
      const n = cat === 'inf' ? 7 : cat === 'cav' ? 4 : cat === 'arm' ? 3 : 2;
      for (let j = 0; j < Math.max(1, Math.round(n * d.str)); j++) {
        if (A.units.length > 420) return;
        const u = makeUnit(cat, bat, col, era, side);
        let [x, z] = place(d, di, side, i++, cat);
        x = clamp(x, -95, 95); z = clamp(z, -95, 95);
        if (provHeight(p, x, z) < 0.3) { x = lerp(x, tc.x, 0.6); z = lerp(z, tc.z, 0.6); }
        u.position.set(x, Math.max(0.2, provHeight(p, x, z)), z);
        u.rotation.y = Math.atan2(side === 'a' ? -ax : ax, side === 'a' ? -az : az);
        u.userData = { side, cat, bat, div: d.id, x, z, alive: true, rout: 0, cd: Math.random() * 2, dead: 0, speed: cat === 'cav' ? 7 : cat === 'arm' ? 5 : 3, hold: side === 'd' || cat === 'art' };
        P3.scene.add(u); A.units.push(u);
        A.divCount.set(d.id, (A.divCount.get(d.id) || 0) + 1);
      }
    }
  });
  mk(att, 'a'); mk(def, 'd');
}
function makeUnit(cat, bat, col, era, side) {
  const parts = [];
  if (cat === 'arm') { parts.push(['b', 2.6, 1, 4, 0, 0, 0, era >= 4 ? 0x5b6048 : 0x4d5a3a], ['b', 1.8, 0.8, 1.8, 0, 1, -0.2, col], ['c', 0.25, 0.25, 3, 0, 1.3, 1.6, COL.dark]); }
  else if (bat === 'siege') parts.push(['b', 2, 0.6, 3, 0, 0, 0, COL.wood], ['b', 0.3, 4, 0.3, 0, 0.6, 0, COL.darkwood]);
  else if (cat === 'art') parts.push(['b', 1.6, 0.8, 1.6, 0, 0, 0, era >= 3 ? 0x4d5a3a : COL.darkwood], ['c', 0.35, 0.35, 2.6, 0, 0.8, 1.2, COL.dark]);
  else if (cat === 'cav') parts.push(['b', 0.7, 1.1, 2, 0, 0, 0, 0x6a4a2a], ['b', 0.5, 1.1, 0.5, 0, 1.1, 0, col], ['s', 0.4, 0.4, 0.4, 0, 2.1, 0, 0xe0b890]);
  else { parts.push(['b', 0.6, 1.2, 0.4, 0, 0, 0, col], ['s', 0.4, 0.4, 0.4, 0, 1.2, 0, 0xe0b890]); if (era === 0) parts.push(['c', 0.08, 2.4, 0.08, 0.35, 0, 0, COL.darkwood]); else parts.push(['b', 0.08, 0.08, 1.1, 0.3, 0.9, 0.35, COL.dark]); }
  // every few infantry or cavalry carry a banner in their nation's colour so armies read from afar
  const banner = (cat === 'inf' || cat === 'cav') && Math.random() < 0.16;
  if (banner) parts.push(['c', 0.08, 3.6, 0.08, -0.35, 0, 0, COL.darkwood], ['b', 0.06, 0.8, 1.2, -0.35, 2.7, 0.6, col]);
  const g = partsToGroup(parts);
  g.traverse(o => { if (o.isMesh) o.castShadow = false; });
  if (cat === 'arm' && g.children[2]) { g.children[2].rotation.x = Math.PI / 2; g.children[2].position.set(0, 1.4, 0.5); }
  if (cat === 'art' && g.children[1] && bat !== 'siege') { g.children[1].rotation.x = Math.PI / 2.6; g.children[1].position.set(0, 0.9, 0); }
  g.scale.setScalar(1.5);
  return g;
}
// Twice a second: pick up new arrivals, and make casualties and retreats match the simulation
function armySync() {
  const p = P3.prov, A = P3.army;
  const { att, def } = armySides(p);
  const sig = armySig(att, def);
  if (!A) { if (att.length || def.length) p3SpawnArmies(); return; }
  if (sig !== A.sig && [...att, ...def].some(d => !A.divStart.has(d.id))) { p3SpawnArmies(); return; }
  A.live = att.length > 0 && (def.length > 0 || att.some(d => d.state === 'siege'));
  const alive = new Map();
  for (const u of A.units) if (u.userData.alive && !u.userData.rout) { const k = u.userData.div; if (!alive.has(k)) alive.set(k, []); alive.get(k).push(u); }
  for (const [divId, us] of alive) {
    const d = G.divs.find(x => x.id === divId);
    const here = d && (d.prov === p.id || ((d.state === 'battle' || d.state === 'siege') && d.attacking === p.id));
    if (!d) { for (const u of us) u.userData.alive = false; continue; } // destroyed
    if (!here) { for (const u of us) u.userData.rout = 0.01; continue; } // retreated or moved on
    const want = Math.max(1, Math.round(A.divCount.get(divId) * d.str / A.divStart.get(divId)));
    while (us.length > want) us.splice(Math.floor(Math.random() * us.length), 1)[0].userData.alive = false;
  }
  if (P3.mode === 'battle' && P3.battle && !G.battles.includes(P3.battle.b) && !P3.battle.over) { P3.battle.over = true; UIHooks.battleViewOver(P3.battle.b); }
}
function armyFrame(dt) {
  P3.armyT = (P3.armyT || 0) - dt;
  if (P3.armyT <= 0) { P3.armyT = 0.5; armySync(); }
  const A = P3.army; if (!A) return;
  const p = P3.prov;
  const foes = { a: [], d: [] };
  for (const u of A.units) if (u.userData.alive && !u.userData.rout) foes[u.userData.side === 'a' ? 'd' : 'a'].push(u);
  const range = A.era === 0 ? 3 : A.era === 1 ? 20 : 34;
  for (const u of A.units) {
    const d = u.userData;
    if (!d.alive) {
      if (d.dead < 1) { d.dead += dt * 1.5; u.rotation.z = d.dead * Math.PI / 2; u.position.y -= dt * 0.4; }
      else if (d.dead < 3) { d.dead += dt * 0.3; u.position.y -= dt * 0.3; } else u.visible = false;
      continue;
    }
    if (d.rout) { // falling back out of the province
      d.rout += dt;
      const s = d.side === 'a' ? 1 : -1;
      d.x += A.ax * s * d.speed * 1.4 * dt; d.z += A.az * s * d.speed * 1.4 * dt;
      u.position.set(d.x, Math.max(0.2, provHeight(p, d.x, d.z)), d.z);
      if (d.rout > 4 || Math.abs(d.x) > 100 || Math.abs(d.z) > 100) u.visible = false;
      continue;
    }
    if (!A.live) { u.position.y = Math.max(0.2, provHeight(p, d.x, d.z)) + (d.cat === 'inf' ? Math.abs(Math.sin(performance.now() / 900 + d.x)) * 0.05 : 0); continue; }
    const enemies = foes[d.side];
    let tx, tz, tgtPos = null;
    if (enemies.length) {
      if (!d.tgt || !d.tgt.userData.alive || d.tgt.userData.rout) d.tgt = enemies[Math.floor(Math.random() * enemies.length)];
      tx = d.tgt.userData.x; tz = d.tgt.userData.z; tgtPos = d.tgt.position;
    } else if (d.side === 'a') { // siege: aim at the fortifications
      if (!d.wall) d.wall = A.targets[Math.floor(Math.random() * A.targets.length)];
      tx = d.wall.x; tz = d.wall.z;
    } else continue;
    const dx = tx - d.x, dz = tz - d.z, dist = Math.hypot(dx, dz) || 1;
    const myRange = !enemies.length ? Math.max(range, 22) * (d.cat === 'art' ? 2 : 1) : d.cat === 'art' ? range * 2.5 : (A.era === 0 && (d.bat === 'archers' || d.bat === 'crossbowmen')) ? 26 : range;
    if (dist > myRange * 0.9 && !(d.hold && dist < myRange * 3)) { d.x += dx / dist * d.speed * dt; d.z += dz / dist * d.speed * dt; }
    d.x = clamp(d.x, -100, 100); d.z = clamp(d.z, -100, 100);
    u.position.set(d.x, Math.max(0.2, provHeight(p, d.x, d.z)), d.z);
    u.rotation.y = Math.atan2(dx, dz);
    d.cd -= dt;
    if (dist < myRange && d.cd <= 0) {
      d.cd = d.cat === 'art' ? 3 + Math.random() * 2 : 0.8 + Math.random() * 1.6;
      const to = tgtPos ? tgtPos : new THREE.Vector3(tx + (Math.random() - 0.5) * 6, Math.max(0.5, provHeight(p, tx, tz)) + 2, tz + (Math.random() - 0.5) * 6);
      shotFx(u.position, to, enemies.length ? d.cat : 'art', A.era);
    }
  }
  for (const f of [...A.fx]) {
    f.life -= dt;
    if (f.kind === 'boom') { const k = 1 - f.life / f.max; f.mesh.scale.setScalar(1 + k * 6); f.mesh.material.opacity = Math.max(0, f.life / f.max); }
    else if (f.kind === 'arrow') { const k = 1 - f.life / f.max; f.mesh.position.lerpVectors(f.a, f.b, k); f.mesh.position.y += Math.sin(k * Math.PI) * f.arc; }
    else f.mesh.material.opacity = Math.max(0, f.life / f.max);
    if (f.life <= 0) { P3.scene.remove(f.mesh); A.fx.splice(A.fx.indexOf(f), 1); }
  }
}
function p3EnterBattle(b) {
  p3Enter(b.prov, 'battle');
  const A = P3.army;
  P3.battle = { b, start: A ? A.start : { a: 1, d: 1 }, over: false };
  if (A) { P3.cam.tx = A.tc.x + A.ax * 40; P3.cam.tz = A.tc.z + A.az * 40; P3.cam.yaw = Math.atan2(-A.az, A.ax) + 0.4; }
  P3.cam.dist = 110; P3.cam.pitch = 0.6;
}
function shotFx(a, b, cat, era) {
  const A = P3.army;
  if (!A || A.fx.length > 160) return;
  const from = a.clone(); from.y += 1.3; const to = b.clone(); to.y += 0.8;
  if (cat === 'art') {
    const m = new THREE.Mesh(GEO.s, new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 1 }));
    m.position.copy(to).add(new THREE.Vector3((Math.random() - 0.5) * 6, 0, (Math.random() - 0.5) * 6)); m.scale.setScalar(1.5);
    P3.scene.add(m); A.fx.push({ kind: 'boom', mesh: m, life: 0.9, max: 0.9 });
    for (let i = 0; i < 4; i++) emit(m.position.x, m.position.y + 1, m.position.z, (Math.random() - 0.5) * 4, 3 + Math.random() * 3, (Math.random() - 0.5) * 4, 0.35, 0.33, 0.3, 3);
    return;
  }
  if (era === 0) {
    const m = new THREE.Mesh(GEO.b, mat(0x3a2a1a)); m.scale.set(0.08, 0.08, 1.2);
    m.position.copy(from); m.lookAt(to); P3.scene.add(m);
    A.fx.push({ kind: 'arrow', mesh: m, life: 0.9, max: 0.9, a: from, b: to, arc: from.distanceTo(to) * 0.25 });
    return;
  }
  const g = new THREE.BufferGeometry().setFromPoints([from, to]);
  const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: era >= 3 ? 0xffe28a : 0xdddddd, transparent: true, opacity: 0.9 }));
  P3.scene.add(l); A.fx.push({ kind: 'tracer', mesh: l, life: 0.12, max: 0.12 });
  if (Math.random() < 0.3) emit(from.x, from.y, from.z, 0, 1, 0, 0.8, 0.8, 0.8, 0.8);
}
