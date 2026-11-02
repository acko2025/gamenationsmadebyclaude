// ============================================================
// WAR OF NATIONS — static game data (data-driven definitions)
// ============================================================
'use strict';

const ERAS = [
  { id: 0, name: 'Age of Kingdoms', key: 't_feudal', year: 1100, popMul: 1 },
  { id: 1, name: 'Age of Empires', key: 't_gunpowder', year: 1550, popMul: 2 },
  { id: 2, name: 'Industrial Age', key: 't_steam', year: 1840, popMul: 4 },
  { id: 3, name: 'World War Era', key: 't_combustion', year: 1936, popMul: 8 },
  { id: 4, name: 'Modern Age', key: 't_computers', year: 1990, popMul: 12 },
  { id: 5, name: 'Future Era', key: 't_fusion', year: 2060, popMul: 15 },
];

const RESOURCES = ['food', 'wood', 'stone', 'iron', 'coal', 'steel', 'oil', 'rubber', 'aluminum', 'elec', 'consumer'];
const RES_NAMES = { food: 'Food', wood: 'Wood', stone: 'Stone', iron: 'Iron', coal: 'Coal', steel: 'Steel', oil: 'Oil', rubber: 'Rubber', aluminum: 'Aluminum', elec: 'Electricity', consumer: 'Consumer goods', money: 'Money' };
const RES_PRICE = { food: 0.6, wood: 0.8, stone: 0.8, iron: 1.5, coal: 1.2, steel: 3, oil: 3, rubber: 2.5, aluminum: 4, elec: 1, consumer: 2 };

const TERRAINS = {
  grassland: { name: 'Grassland', move: 1.0, atk: 1.0, def: 1.0, fert: 1.0, color: [128, 158, 84] },
  forest: { name: 'Forest', move: 1.3, atk: 0.85, def: 1.15, fert: 0.6, color: [62, 104, 58] },
  hills: { name: 'Hills', move: 1.4, atk: 0.8, def: 1.25, fert: 0.7, color: [150, 140, 92] },
  mountain: { name: 'Mountains', move: 2.0, atk: 0.6, def: 1.5, fert: 0.3, color: [130, 118, 104] },
  desert: { name: 'Desert', move: 1.2, atk: 0.95, def: 1.0, fert: 0.25, color: [214, 190, 128] },
  tundra: { name: 'Tundra', move: 1.4, atk: 0.9, def: 1.1, fert: 0.3, color: [176, 186, 180] },
};

const GOVERNMENTS = {
  absolute: { name: 'Absolute monarchy', pp: 0.4, stab: 5, tax: 0.05 },
  constitutional: { name: 'Constitutional monarchy', pp: 0.2, stab: 8, research: 0.05 },
  republic: { name: 'Republic', pp: 0.1, stab: 5, trade: 0.1 },
  democracy: { name: 'Parliamentary democracy', pp: 0, stab: 10, research: 0.1 },
  empire: { name: 'Empire', pp: 0.5, stab: 0, manpower: 0.1 },
  military: { name: 'Military government', pp: 0.3, stab: -5, manpower: 0.2 },
  tribal: { name: 'Tribal confederation', pp: 0.1, stab: 0, manpower: 0.15 },
  citystate: { name: 'City-state', pp: 0.2, stab: 8, trade: 0.2 },
  federation: { name: 'Federation', pp: 0.1, stab: 6, tax: 0.05 },
  socialist: { name: 'Socialist state', pp: 0.3, stab: 2, industry: 0.1 },
  theocracy: { name: 'Theocracy', pp: 0.3, stab: 10, research: -0.05 },
  custom: { name: 'Custom government', pp: 0.2, stab: 4 },
};
const IDEOLOGIES = ['Traditionalist', 'Liberal', 'Nationalist', 'Socialist', 'Autocratic', 'Theocratic'];

const PERSONALITIES = {
  expansionist: { name: 'Expansionist empire', war: 1.6, army: 1.4, build: { military: 1.4, economy: 1 }, research: ['military'] },
  defensive: { name: 'Defensive kingdom', war: 0.4, army: 1.1, build: { defense: 2, economy: 1 }, research: ['infrastructure', 'military'] },
  merchant: { name: 'Merchant republic', war: 0.5, army: 0.7, build: { economy: 1.8, infra: 1.4 }, research: ['industry', 'society'] },
  industrial: { name: 'Industrial superpower', war: 0.9, army: 1.0, build: { economy: 1.6, military: 1.2 }, research: ['industry', 'infrastructure'] },
  neutral: { name: 'Small neutral state', war: 0.1, army: 0.6, build: { civic: 1.5, economy: 1.2 }, research: ['society', 'agriculture'] },
  militarist: { name: 'Militaristic dictatorship', war: 1.4, army: 1.8, build: { military: 2 }, research: ['military'] },
  diplomatic: { name: 'Diplomatic federation', war: 0.3, army: 0.8, build: { civic: 1.3, economy: 1.2 }, research: ['government', 'society'] },
};

// ---------- Buildings ----------
// eff keys: housing food wood stone iron coal oil rubber aluminum steel elec consumer money research pp stab fort
//           recruit cavalry milFac tankFac civFac infra supply port air shipyard airdef mine manpower
const BUILDINGS = {
  // --- Medieval ---
  cottage: { name: 'Cottages', cat: 'housing', tech: null, cost: { money: 15, wood: 10 }, days: 12, r: 3, workers: 0, eff: { housing: 3000 } },
  farm: { name: 'Farm', cat: 'economy', tech: null, cost: { money: 20, wood: 10 }, days: 15, r: 7, workers: 800, eff: { food: 30 } },
  market: { name: 'Market', cat: 'economy', tech: null, cost: { money: 40, wood: 20 }, days: 20, r: 4, workers: 400, eff: { money: 1.2, consumer: 1 } },
  blacksmith: { name: 'Blacksmith', cat: 'military', tech: null, cost: { money: 40, wood: 10, stone: 10 }, days: 20, r: 3, workers: 300, eff: { milFac: 1, steel: 0.6 }, smoke: true },
  barracks: { name: 'Barracks', cat: 'military', tech: null, cost: { money: 60, wood: 30 }, days: 25, r: 5, workers: 200, eff: { recruit: 1, manpower: 0.02 } },
  watchtower: { name: 'Watchtower', cat: 'defense', tech: null, cost: { money: 20, wood: 15 }, days: 10, r: 2, workers: 20, eff: { fort: 0.3 } },
  stables: { name: 'Stables', cat: 'military', tech: null, cost: { money: 40, wood: 25 }, days: 18, r: 5, workers: 150, eff: { cavalry: 1, supply: 0.2 } },
  windmill: { name: 'Windmill', cat: 'economy', tech: null, cost: { money: 25, wood: 20 }, days: 14, r: 3, workers: 100, eff: { food: 14 } },
  mine: { name: 'Mine', cat: 'economy', tech: null, cost: { money: 50, wood: 20 }, days: 25, r: 5, workers: 600, eff: { mine: 1, stone: 2 } },
  lumbercamp: { name: 'Lumber Camp', cat: 'economy', tech: null, cost: { money: 20 }, days: 10, r: 5, workers: 300, eff: { wood: 8 } },
  townhall: { name: 'Town Hall', cat: 'civic', tech: null, cost: { money: 80, stone: 30, wood: 20 }, days: 30, r: 5, workers: 100, eff: { pp: 0.05, stab: 1, money: 0.8 } },
  harbor: { name: 'Harbor', cat: 'infra', tech: null, cost: { money: 70, wood: 40 }, days: 30, r: 7, workers: 400, eff: { port: 1, money: 1.2, shipyard: 0.5, food: 6 }, coastal: true },
  bridge: { name: 'Bridge', cat: 'infra', tech: 't_mason', cost: { money: 30, stone: 30 }, days: 20, r: 4, workers: 0, eff: { infra: 0.5 } },
  castle: { name: 'Castle', cat: 'defense', tech: 't_castle', cost: { money: 220, stone: 150 }, days: 90, r: 10, workers: 200, eff: { fort: 2, housing: 600, stab: 1 } },
  cathedral: { name: 'Cathedral', cat: 'civic', tech: 't_scholastic', cost: { money: 160, stone: 120 }, days: 80, r: 7, workers: 100, eff: { stab: 3, research: 0.3, pp: 0.03 } },
  palace: { name: 'Royal Palace', cat: 'civic', tech: 't_guilds', cost: { money: 300, stone: 200 }, days: 120, r: 9, workers: 300, eff: { pp: 0.25, stab: 4, money: 1.5 }, unique: true },
  library: { name: 'Monastery Library', cat: 'civic', tech: null, cost: { money: 60, stone: 20, wood: 20 }, days: 30, r: 4, workers: 60, eff: { research: 0.3 } },
  // --- Empires ---
  fortress: { name: 'Star Fortress', cat: 'defense', tech: 't_fortress', cost: { money: 380, stone: 260 }, days: 120, r: 12, workers: 300, eff: { fort: 3 } },
  university: { name: 'University', cat: 'civic', tech: 't_university', cost: { money: 180, stone: 80 }, days: 60, r: 6, workers: 200, eff: { research: 1.2 } },
  // --- Industrial ---
  factory: { name: 'Civilian Factory', cat: 'economy', tech: 't_steam', cost: { money: 220, stone: 40, iron: 40 }, days: 70, r: 7, workers: 3000, eff: { civFac: 1, consumer: 4, money: 2, coalUse: 1 }, smoke: true },
  steelmill: { name: 'Steel Mill', cat: 'economy', tech: 't_steam', cost: { money: 240, stone: 60, iron: 30 }, days: 75, r: 8, workers: 2500, eff: { steelMill: 1 }, smoke: true },
  armsfactory: { name: 'Military Factory', cat: 'military', tech: 't_massprod', cost: { money: 260, steel: 40 }, days: 80, r: 8, workers: 3000, eff: { milFac: 3, coalUse: 1 }, smoke: true },
  railstation: { name: 'Railway Station', cat: 'infra', tech: 't_rail', cost: { money: 120, steel: 20 }, days: 40, r: 6, workers: 300, eff: { infra: 1, supply: 1, money: 1 } },
  plantation: { name: 'Plantation', cat: 'economy', tech: 't_steam', cost: { money: 80 }, days: 30, r: 7, workers: 1500, eff: { plantation: 1, food: 6 } },
  // --- World War ---
  apartments: { name: 'Apartment Block', cat: 'housing', tech: 't_electric', cost: { money: 120, steel: 20, stone: 40 }, days: 50, r: 4, workers: 0, eff: { housing: 20000, elecUse: 1 } },
  tankfactory: { name: 'Tank Factory', cat: 'military', tech: 't_tanks1', cost: { money: 380, steel: 80 }, days: 100, r: 9, workers: 4000, eff: { milFac: 3, tankFac: 3, elecUse: 2 }, smoke: true },
  refinery: { name: 'Oil Refinery', cat: 'economy', tech: 't_combustion', cost: { money: 300, steel: 60 }, days: 90, r: 9, workers: 1500, eff: { refinery: 1 }, smoke: true },
  powerplant: { name: 'Power Plant', cat: 'economy', tech: 't_electric', cost: { money: 280, steel: 50 }, days: 80, r: 8, workers: 800, eff: { elec: 20, coalUse: 2 }, smoke: true },
  airbase: { name: 'Air Base', cat: 'military', tech: 't_flight', cost: { money: 260, steel: 40 }, days: 70, r: 14, workers: 600, eff: { air: 1 } },
  researchcenter: { name: 'Research Center', cat: 'civic', tech: 't_research', cost: { money: 300, steel: 30 }, days: 90, r: 6, workers: 800, eff: { research: 3, elecUse: 2 } },
  shipyard: { name: 'Naval Shipyard', cat: 'military', tech: 't_navig', cost: { money: 300, steel: 40, wood: 40 }, days: 90, r: 11, workers: 2500, eff: { port: 1, shipyard: 2 }, coastal: true },
  militarybase: { name: 'Military Base', cat: 'military', tech: 't_combustion', cost: { money: 240, steel: 30 }, days: 60, r: 10, workers: 400, eff: { recruit: 1, manpower: 0.05, supply: 1 } },
  govbuilding: { name: 'Government Building', cat: 'civic', tech: 't_parliament', cost: { money: 260, stone: 120 }, days: 80, r: 6, workers: 800, eff: { pp: 0.2, stab: 3, money: 1.5 } },
  // --- Modern ---
  skyscraper: { name: 'Skyscraper', cat: 'housing', tech: 't_highrise', cost: { money: 400, steel: 120 }, days: 120, r: 5, workers: 4000, eff: { housing: 60000, money: 6, elecUse: 3 } },
  radar: { name: 'Radar Station', cat: 'defense', tech: 't_radar', cost: { money: 200, steel: 30 }, days: 50, r: 4, workers: 100, eff: { airdef: 0.15, fort: 0.4 } },
  missiledef: { name: 'Missile Defense', cat: 'defense', tech: 't_missiles', cost: { money: 450, steel: 90, aluminum: 30 }, days: 100, r: 6, workers: 200, eff: { airdef: 0.3, fort: 1 } },
  airport: { name: 'Airport', cat: 'infra', tech: 't_highrise', cost: { money: 420, steel: 80 }, days: 110, r: 16, workers: 2000, eff: { money: 6, infra: 1, supply: 1 } },
  // --- Future ---
  fusion: { name: 'Fusion Reactor', cat: 'economy', tech: 't_fusion', cost: { money: 900, steel: 150, aluminum: 60 }, days: 160, r: 9, workers: 1500, eff: { elec: 120 } },
  arcology: { name: 'Arcology', cat: 'housing', tech: 't_arcology', cost: { money: 1000, steel: 300 }, days: 200, r: 9, workers: 10000, eff: { housing: 250000, money: 12, research: 3, elecUse: 6 } },
};
const BUILD_CATS = { housing: 'Housing', economy: 'Economy', military: 'Military', defense: 'Defense', infra: 'Infrastructure', civic: 'Civic' };
const LEVEL_MUL = [0, 1, 1.75, 2.5];

// Line structures dragged between two points; cost per 10 units of length
const SEGMENTS = {
  road: { name: 'Road', tech: null, cost: { money: 3, stone: 2 }, days: 6, width: 3, color: 0x8a7a5c },
  palisade: { name: 'Wooden Palisade', tech: null, cost: { money: 2, wood: 6 }, days: 6, width: 1.2, color: 0x6b4a2a },
  wall: { name: 'Stone Wall', tech: 't_castle', cost: { money: 8, stone: 14 }, days: 12, width: 1.8, color: 0x9a948a },
  rail: { name: 'Railway', tech: 't_rail', cost: { money: 10, steel: 4 }, days: 10, width: 2.6, color: 0x4a4440 },
};

// ---------- Technology ----------
const BRANCHES = ['military', 'industry', 'infrastructure', 'society', 'agriculture', 'medicine', 'government'];
const TECHS = [
  // Era 0 — Age of Kingdoms
  { id: 't_feudal', name: 'Feudal Administration', b: 'government', era: 0, req: [], bonus: { pp: 0.1 } },
  { id: 't_agri0', name: 'Three-Field Rotation', b: 'agriculture', era: 0, req: [], bonus: { food: 0.15 } },
  { id: 't_mason', name: 'Stone Masonry', b: 'infrastructure', era: 0, req: [], bonus: { build: 0.1 } },
  { id: 't_castle', name: 'Castle Building', b: 'infrastructure', era: 0, req: ['t_mason'], bonus: {} },
  { id: 't_cross', name: 'Crossbows', b: 'military', era: 0, req: [], bonus: {} },
  { id: 't_chivalry', name: 'Chivalry', b: 'military', era: 0, req: [], bonus: {} },
  { id: 't_siege', name: 'Siege Engineering', b: 'military', era: 0, req: ['t_mason'], bonus: {} },
  { id: 't_guilds', name: 'Merchant Guilds', b: 'industry', era: 0, req: [], bonus: { money: 0.1 } },
  { id: 't_herbal', name: 'Herbal Medicine', b: 'medicine', era: 0, req: [], bonus: { growth: 0.1 } },
  { id: 't_scholastic', name: 'Scholasticism', b: 'society', era: 0, req: [], bonus: { research: 0.1 } },
  // Era 1 — Age of Empires
  { id: 't_gunpowder', name: 'Gunpowder', b: 'military', era: 1, req: ['t_siege'], bonus: {} },
  { id: 't_fortress', name: 'Star Forts', b: 'infrastructure', era: 1, req: ['t_castle', 't_gunpowder'], bonus: {} },
  { id: 't_absolutism', name: 'Absolutism', b: 'government', era: 1, req: ['t_feudal'], bonus: { pp: 0.2 } },
  { id: 't_banking', name: 'Banking', b: 'industry', era: 1, req: ['t_guilds'], bonus: { money: 0.15 } },
  { id: 't_university', name: 'Universities', b: 'society', era: 1, req: ['t_scholastic'], bonus: { research: 0.1 } },
  { id: 't_agri1', name: 'Crop Rotation', b: 'agriculture', era: 1, req: ['t_agri0'], bonus: { food: 0.2 } },
  { id: 't_dragoons', name: 'Dragoons', b: 'military', era: 1, req: ['t_gunpowder'], bonus: {} },
  { id: 't_navig', name: 'Navigation', b: 'infrastructure', era: 1, req: ['t_mason'], bonus: { trade: 0.1 } },
  { id: 't_inoc', name: 'Inoculation', b: 'medicine', era: 1, req: ['t_herbal'], bonus: { growth: 0.15 } },
  // Era 2 — Industrial
  { id: 't_steam', name: 'Steam Power', b: 'industry', era: 2, req: ['t_banking'], bonus: {} },
  { id: 't_rail', name: 'Railways', b: 'infrastructure', era: 2, req: ['t_steam'], bonus: { supply: 0.2 } },
  { id: 't_rifles', name: 'Rifled Firearms', b: 'military', era: 2, req: ['t_gunpowder'], bonus: {} },
  { id: 't_massprod', name: 'Mass Production', b: 'industry', era: 2, req: ['t_steam'], bonus: { production: 0.1 } },
  { id: 't_sanitation', name: 'Sanitation', b: 'medicine', era: 2, req: ['t_inoc'], bonus: { growth: 0.2 } },
  { id: 't_fertilizer', name: 'Fertilizers', b: 'agriculture', era: 2, req: ['t_agri1'], bonus: { food: 0.25 } },
  { id: 't_parliament', name: 'Mass Politics', b: 'government', era: 2, req: ['t_absolutism'], bonus: { stab: 3 } },
  { id: 't_schooling', name: 'Public Schooling', b: 'society', era: 2, req: ['t_university'], bonus: { research: 0.2 } },
  { id: 't_engineers', name: 'Combat Engineering', b: 'military', era: 2, req: ['t_rifles'], bonus: {} },
  // Era 3 — World War
  { id: 't_combustion', name: 'Combustion Engine', b: 'industry', era: 3, req: ['t_massprod'], bonus: {} },
  { id: 't_tanks1', name: 'Armored Vehicles', b: 'military', era: 3, req: ['t_combustion'], bonus: {} },
  { id: 't_tanks2', name: 'Medium Tanks', b: 'military', era: 3, req: ['t_tanks1'], bonus: {} },
  { id: 't_tanks3', name: 'Heavy Tanks', b: 'military', era: 3, req: ['t_tanks2'], bonus: {} },
  { id: 't_flight', name: 'Powered Flight', b: 'military', era: 3, req: ['t_combustion'], bonus: {} },
  { id: 't_electric', name: 'Electrification', b: 'infrastructure', era: 3, req: ['t_rail'], bonus: { production: 0.1 } },
  { id: 't_radio', name: 'Radio', b: 'military', era: 3, req: ['t_electric'], bonus: { org: 0.1 } },
  { id: 't_aa', name: 'Anti-Air Guns', b: 'military', era: 3, req: ['t_flight'], bonus: {} },
  { id: 't_airborne', name: 'Paratroopers', b: 'military', era: 3, req: ['t_flight'], bonus: {} },
  { id: 't_logistics', name: 'Motorized Logistics', b: 'infrastructure', era: 3, req: ['t_combustion'], bonus: { supply: 0.25 } },
  { id: 't_penicillin', name: 'Antibiotics', b: 'medicine', era: 3, req: ['t_sanitation'], bonus: { growth: 0.2 } },
  { id: 't_research', name: 'Research Institutes', b: 'society', era: 3, req: ['t_schooling'], bonus: { research: 0.1 } },
  { id: 't_mechag', name: 'Mechanized Agriculture', b: 'agriculture', era: 3, req: ['t_fertilizer', 't_combustion'], bonus: { food: 0.3 } },
  { id: 't_nukes', name: 'Nuclear Fission', b: 'military', era: 3, req: ['t_research', 't_electric'], bonus: {} },
  // Era 4 — Modern
  { id: 't_computers', name: 'Computing', b: 'society', era: 4, req: ['t_research', 't_electric'], bonus: { research: 0.2 } },
  { id: 't_mbt', name: 'Main Battle Tanks', b: 'military', era: 4, req: ['t_tanks3', 't_computers'], bonus: {} },
  { id: 't_mech', name: 'Mechanized Infantry', b: 'military', era: 4, req: ['t_logistics', 't_computers'], bonus: {} },
  { id: 't_jets', name: 'Jet Engines', b: 'military', era: 4, req: ['t_flight', 't_computers'], bonus: { air: 0.5 } },
  { id: 't_radar', name: 'Radar', b: 'military', era: 4, req: ['t_radio', 't_computers'], bonus: {} },
  { id: 't_missiles', name: 'Guided Missiles', b: 'military', era: 4, req: ['t_radar'], bonus: {} },
  { id: 't_highrise', name: 'High-rise Construction', b: 'infrastructure', era: 4, req: ['t_computers'], bonus: { build: 0.15 } },
  { id: 't_greenrev', name: 'Green Revolution', b: 'agriculture', era: 4, req: ['t_mechag'], bonus: { food: 0.35 } },
  { id: 't_modmed', name: 'Modern Medicine', b: 'medicine', era: 4, req: ['t_penicillin'], bonus: { growth: 0.2 } },
  { id: 't_welfare', name: 'Welfare State', b: 'government', era: 4, req: ['t_parliament', 't_computers'], bonus: { stab: 6 } },
  // Era 5 — Future
  { id: 't_fusion', name: 'Fusion Power', b: 'industry', era: 5, req: ['t_computers', 't_highrise'], bonus: { production: 0.2 } },
  { id: 't_hover', name: 'Hover Armor', b: 'military', era: 5, req: ['t_mbt', 't_fusion'], bonus: {} },
  { id: 't_ai', name: 'Artificial Intelligence', b: 'society', era: 5, req: ['t_fusion'], bonus: { research: 0.4 } },
  { id: 't_arcology', name: 'Arcologies', b: 'infrastructure', era: 5, req: ['t_fusion'], bonus: {} },
  { id: 't_railgun', name: 'Railguns', b: 'military', era: 5, req: ['t_hover'], bonus: {} },
];
const TECH_BY_ID = {};
TECHS.forEach(t => { TECH_BY_ID[t.id] = t; t.cost = [450, 1100, 2100, 3400, 4800, 6700][t.era]; });

// ---------- Equipment ----------
const EQUIP = {
  arms: { names: ['Arms & Armor', 'Muskets & Pikes', 'Rifles', 'Infantry Weapons', 'Modern Small Arms', 'Pulse Rifles'], cost: 0.5, res: e => e < 2 ? { iron: 0.08 } : { steel: 0.08 } },
  artillery: { names: ['Siege Engines', 'Cannons', 'Field Guns', 'Artillery', 'Precision Artillery', 'Rail Artillery'], cost: 3, res: e => e < 2 ? { wood: 0.4, iron: 0.3 } : { steel: 0.5 } },
  vehicles: { names: ['Wagons', 'Wagons', 'Steam Lorries', 'Trucks', 'Armored Carriers', 'Hover Carriers'], cost: 2.5, res: e => e < 3 ? { wood: 0.5 } : { steel: 0.4, rubber: 0.2, oil: 0.2 } },
  support: { names: ['Supply Carts', 'Supply Trains', 'Engineering Gear', 'Support Equipment', 'Electronics', 'Drones'], cost: 2, res: e => e < 2 ? { wood: 0.3 } : { steel: 0.3 } },
  aircraft: { names: ['—', '—', 'Balloons', 'Fighters', 'Jet Fighters', 'Drone Swarms'], cost: 12, minEra: 3, res: () => ({ aluminum: 0.6, steel: 0.4 }) },
  ships: { names: ['Cogs', 'Galleons', 'Ironclads', 'Warships', 'Frigates', 'Cruisers'], cost: 40, res: e => e < 2 ? { wood: 12 } : { steel: 10 } },
  nukes: { names: ['—', '—', '—', 'Atomic Bombs', 'Nuclear Missiles', 'Fusion Warheads'], cost: 400, minEra: 3, tech: 't_nukes', res: () => ({ steel: 30, aluminum: 20 }) },
};

// ---------- Land units (battalions) ----------
// sa soft attack, ha hard attack, df defense, brk breakthrough, hp, org, hard hardness, arm armor, prc piercing,
// spd speed, mp manpower, eq equipment, sup supply use, siege siege power
const BATTALIONS = {
  spearmen: { name: 'Spearmen', cat: 'inf', tech: 't_feudal', era: 0, sa: 3, ha: 0.6, df: 7, brk: 1.5, hp: 12, org: 30, hard: 0, arm: 0, prc: 2, spd: 3, mp: 800, eq: { arms: 60 }, sup: 0.05 },
  archers: { name: 'Archers', cat: 'inf', tech: 't_feudal', era: 0, sa: 5, ha: 0.5, df: 3, brk: 1, hp: 8, org: 25, hard: 0, arm: 0, prc: 2, spd: 3, mp: 600, eq: { arms: 50 }, sup: 0.05 },
  swordsmen: { name: 'Swordsmen', cat: 'inf', tech: 't_feudal', era: 0, sa: 5, ha: 0.8, df: 5, brk: 3, hp: 10, org: 30, hard: 0, arm: 0, prc: 3, spd: 3, mp: 700, eq: { arms: 70 }, sup: 0.05 },
  crossbowmen: { name: 'Crossbowmen', cat: 'inf', tech: 't_cross', era: 0, sa: 6.5, ha: 1.2, df: 3.5, brk: 1, hp: 8, org: 25, hard: 0, arm: 0, prc: 5, spd: 3, mp: 600, eq: { arms: 60 }, sup: 0.05 },
  cavalry: { name: 'Light Cavalry', cat: 'cav', tech: 't_feudal', era: 0, sa: 4, ha: 0.5, df: 3, brk: 4, hp: 8, org: 30, hard: 0, arm: 0, prc: 2, spd: 7, mp: 500, eq: { arms: 50 }, sup: 0.08, needs: 'cavalry' },
  knights: { name: 'Knights', cat: 'cav', tech: 't_chivalry', era: 0, sa: 7, ha: 1.5, df: 3, brk: 7, hp: 8, org: 35, hard: 0.1, arm: 2, prc: 4, spd: 6, mp: 400, eq: { arms: 80 }, sup: 0.1, needs: 'cavalry' },
  royalguard: { name: 'Royal Guard', cat: 'inf', tech: 't_chivalry', era: 0, sa: 6, ha: 1.2, df: 8, brk: 4, hp: 12, org: 50, hard: 0, arm: 1, prc: 4, spd: 3, mp: 500, eq: { arms: 110 }, sup: 0.08 },
  siege: { name: 'Siege Engines', cat: 'art', tech: 't_siege', era: 0, sa: 4, ha: 3, df: 1, brk: 0.5, hp: 4, org: 10, hard: 0, arm: 0, prc: 6, spd: 2, mp: 300, eq: { artillery: 8 }, sup: 0.1, siege: 3 },
  musketeers: { name: 'Musketeers', cat: 'inf', tech: 't_gunpowder', era: 1, sa: 8, ha: 1, df: 9, brk: 2, hp: 14, org: 35, hard: 0, arm: 0, prc: 5, spd: 3, mp: 900, eq: { arms: 90 }, sup: 0.07 },
  cannons: { name: 'Cannons', cat: 'art', tech: 't_gunpowder', era: 1, sa: 10, ha: 3, df: 2, brk: 0.5, hp: 4, org: 10, hard: 0, arm: 0, prc: 10, spd: 2, mp: 400, eq: { artillery: 12 }, sup: 0.12, siege: 4 },
  dragoons: { name: 'Dragoons', cat: 'cav', tech: 't_dragoons', era: 1, sa: 7, ha: 1, df: 5, brk: 5, hp: 10, org: 35, hard: 0, arm: 0, prc: 5, spd: 6, mp: 600, eq: { arms: 80 }, sup: 0.1, needs: 'cavalry' },
  infantry: { name: 'Infantry', cat: 'inf', tech: 't_rifles', era: 2, sa: 10, ha: 2, df: 14, brk: 3, hp: 18, org: 45, hard: 0, arm: 0, prc: 8, spd: 4, mp: 1000, eq: { arms: 100 }, sup: 0.1 },
  fieldart: { name: 'Field Artillery', cat: 'art', tech: 't_rifles', era: 2, sa: 16, ha: 4, df: 3, brk: 1, hp: 4, org: 10, hard: 0, arm: 0, prc: 12, spd: 4, mp: 500, eq: { artillery: 16 }, sup: 0.15, siege: 5 },
  engineers: { name: 'Engineers', cat: 'sup', tech: 't_engineers', era: 2, sa: 3, ha: 1, df: 6, brk: 1, hp: 6, org: 20, hard: 0, arm: 0, prc: 5, spd: 4, mp: 300, eq: { arms: 30, support: 10 }, sup: 0.05, siege: 2, river: true },
  motorized: { name: 'Motorized Infantry', cat: 'inf', tech: 't_combustion', era: 3, sa: 10, ha: 2, df: 14, brk: 3, hp: 18, org: 45, hard: 0.1, arm: 0, prc: 8, spd: 9, mp: 1000, eq: { arms: 100, vehicles: 30 }, sup: 0.2 },
  armor: { name: 'Tank Battalion', cat: 'arm', tech: 't_tanks1', era: 3, sa: 0, ha: 0, df: 0, brk: 0, hp: 3, org: 15, hard: 0.9, arm: 0, prc: 0, spd: 8, mp: 500, eq: { tank: 50 }, sup: 0.4 },
  recon: { name: 'Reconnaissance', cat: 'sup', tech: 't_radio', era: 3, sa: 4, ha: 1, df: 4, brk: 4, hp: 4, org: 30, hard: 0.3, arm: 0, prc: 6, spd: 9, mp: 300, eq: { arms: 20, vehicles: 15 }, sup: 0.05, recon: 0.1 },
  aa: { name: 'Anti-Air', cat: 'sup', tech: 't_aa', era: 3, sa: 3, ha: 6, df: 4, brk: 1, hp: 4, org: 15, hard: 0, arm: 0, prc: 30, spd: 4, mp: 300, eq: { artillery: 16 }, sup: 0.05, airdef: 0.15 },
  airborne: { name: 'Airborne', cat: 'inf', tech: 't_airborne', era: 3, sa: 10, ha: 2, df: 12, brk: 4, hp: 16, org: 60, hard: 0, arm: 0, prc: 8, spd: 4, mp: 1000, eq: { arms: 110 }, sup: 0.1, river: true },
  logistics: { name: 'Logistics', cat: 'sup', tech: 't_logistics', era: 3, sa: 0, ha: 0, df: 2, brk: 0, hp: 2, org: 10, hard: 0, arm: 0, prc: 0, spd: 9, mp: 200, eq: { vehicles: 20 }, sup: -0.3 },
  mech: { name: 'Mechanized Infantry', cat: 'inf', tech: 't_mech', era: 4, sa: 14, ha: 6, df: 20, brk: 6, hp: 20, org: 50, hard: 0.6, arm: 8, prc: 30, spd: 10, mp: 1000, eq: { arms: 100, vehicles: 50 }, sup: 0.3 },
  spart: { name: 'Self-Propelled Artillery', cat: 'art', tech: 't_mech', era: 4, sa: 26, ha: 8, df: 4, brk: 2, hp: 5, org: 10, hard: 0.7, arm: 5, prc: 25, spd: 9, mp: 500, eq: { artillery: 20, vehicles: 10 }, sup: 0.25, siege: 6 },
  exo: { name: 'Exo Infantry', cat: 'inf', tech: 't_ai', era: 5, sa: 22, ha: 10, df: 28, brk: 10, hp: 22, org: 60, hard: 0.7, arm: 30, prc: 60, spd: 11, mp: 800, eq: { arms: 140, support: 20 }, sup: 0.35 },
};

// ---------- Tank designer parts ----------
const CHASSIS = {
  light: { name: 'Light Tank', tech: 't_tanks1', armor: 12, speed: 9, cost: 6, rel: 0.85, fuel: 1, hp: 3 },
  medium: { name: 'Medium Tank', tech: 't_tanks2', armor: 32, speed: 7, cost: 9, rel: 0.8, fuel: 1.4, hp: 4 },
  heavy: { name: 'Heavy Tank', tech: 't_tanks3', armor: 60, speed: 4.5, cost: 14, rel: 0.65, fuel: 2.2, hp: 5 },
  mbt: { name: 'Main Battle Tank', tech: 't_mbt', armor: 95, speed: 9, cost: 18, rel: 0.85, fuel: 2, hp: 6 },
  hover: { name: 'Hover Tank', tech: 't_hover', armor: 130, speed: 12, cost: 24, rel: 0.8, fuel: 1.6, hp: 7 },
};
const GUNS = {
  mg: { name: 'Machine Guns', tech: 't_tanks1', sa: 8, ha: 2, prc: 12, cost: 1 },
  small: { name: '37mm Cannon', tech: 't_tanks1', sa: 5, ha: 9, prc: 35, cost: 2 },
  medium: { name: '75mm Cannon', tech: 't_tanks2', sa: 9, ha: 16, prc: 65, cost: 3 },
  hv: { name: 'High-Velocity 88mm', tech: 't_tanks3', sa: 8, ha: 24, prc: 100, cost: 4 },
  smooth: { name: '120mm Smoothbore', tech: 't_mbt', sa: 12, ha: 32, prc: 150, cost: 5 },
  rail: { name: 'Railgun', tech: 't_railgun', sa: 14, ha: 46, prc: 220, cost: 7 },
};

// ---------- Default division templates per era ----------
const DEFAULT_TEMPLATES = [
  [{ name: 'Feudal Levy', bats: ['spearmen', 'spearmen', 'spearmen', 'spearmen', 'archers', 'archers'] },
   { name: 'Mounted Host', bats: ['cavalry', 'cavalry', 'swordsmen', 'swordsmen', 'archers'] }],
  [{ name: 'Tercio', bats: ['musketeers', 'musketeers', 'musketeers', 'spearmen', 'spearmen', 'cannons'] },
   { name: 'Dragoon Brigade', bats: ['dragoons', 'dragoons', 'dragoons', 'musketeers'] }],
  [{ name: 'Infantry Division', bats: ['infantry', 'infantry', 'infantry', 'infantry', 'infantry', 'infantry', 'fieldart', 'fieldart'] },
   { name: 'Cavalry Division', bats: ['cavalry', 'cavalry', 'cavalry', 'cavalry', 'infantry'] }],
  [{ name: 'Infantry Division', bats: ['infantry', 'infantry', 'infantry', 'infantry', 'infantry', 'infantry', 'infantry', 'fieldart', 'fieldart'] },
   { name: 'Armored Division', bats: ['armor', 'armor', 'armor', 'motorized', 'motorized', 'motorized', 'fieldart'] }],
  [{ name: 'Mechanized Division', bats: ['mech', 'mech', 'mech', 'mech', 'armor', 'armor', 'spart', 'spart'] },
   { name: 'Armored Division', bats: ['armor', 'armor', 'armor', 'armor', 'mech', 'mech', 'spart'] }],
  [{ name: 'Exo Legion', bats: ['exo', 'exo', 'exo', 'exo', 'armor', 'armor', 'armor', 'spart', 'spart'] },
   { name: 'Hover Armor Corps', bats: ['armor', 'armor', 'armor', 'armor', 'exo', 'exo', 'spart'] }],
];

// ---------- Names ----------
const NAME_SYL = {
  a: ['Al', 'Bran', 'Cal', 'Dor', 'Eld', 'Fen', 'Gal', 'Hal', 'Ir', 'Kar', 'Lor', 'Mar', 'Nor', 'Os', 'Pel', 'Rav', 'Sar', 'Tor', 'Val', 'Vel', 'Ys', 'Zan', 'Ash', 'Bel', 'Cor', 'Dra', 'Ost', 'Mor', 'Thal', 'Ves', 'Quen', 'Ruth'],
  b: ['an', 'ar', 'en', 'or', 'ia', 'ea', 'ad', 'um', 'is', 'ov', 'esh', 'ir', 'and', 'ost', 'ev', 'el', 'ur', 'av'],
  c: ['ia', 'land', 'mark', 'heim', 'ora', 'aria', 'stan', 'grad', 'onia', 'ica', 'mere', 'vale', 'reach', 'burg', 'ovia', 'esia'],
};
const PROV_SUFFIX = ['ford', 'ton', 'wick', 'stead', 'burg', 'dale', 'mouth', 'field', 'holm', 'by', 'gard', 'more', 'haven', 'brook', 'crest', 'moor', 'well', 'ridge', 'port', 'march'];
const LEADER_FIRST = ['Aldric', 'Beatrix', 'Casimir', 'Dagny', 'Edmund', 'Freya', 'Godric', 'Helena', 'Ivo', 'Jorund', 'Katarin', 'Leopold', 'Matilda', 'Nikolai', 'Odessa', 'Piotr', 'Rosalind', 'Sigmund', 'Theodora', 'Ulric', 'Viktor', 'Wilhelmina', 'Yara', 'Zoltan'];
const RELIGIONS = ['Solar Faith', 'Old Gods', 'Covenant', 'Way of the Path'];
