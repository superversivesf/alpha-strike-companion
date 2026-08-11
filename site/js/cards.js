import { createEntry, HEAT_LEVELS, critTypesForUnit, critCap, tracksHeat, isAerospaceUnit } from "./state.js";

const STAT_TIPS = {
  SZ: "Size — the unit's weight class: 1 (Light), 2 (Medium), 3 (Heavy), 4 (Assault)",
  TMM: "Target Movement Modifier — added to the Target Number of attacks made against this unit when it uses its standard movement mode",
  MV: "Movement — inches per turn. Suffixes: j = jump, t = tracked, w = wheeled, h = hover, v = VTOL, g = WiGE, n = naval, s = submersible, f = foot (infantry), a = aerospace thrust, m = motorized (infantry), i = airship",
  Role: "Tactical role of the unit (Brawler, Sniper, Scout, Juggernaut, Striker, Skirmisher, etc.)",
  Skill: "Skill Rating — the base Target Number for the unit's attacks. Set once when the unit is deployed; lower is better",
  S: "Damage delivered at Short range (0–6\")",
  M: "Damage delivered at Medium range (7–12\")",
  L: "Damage delivered at Long range (13–24\")",
  OV: "Overheat Value — extra damage you may add to an attack by taking that much heat",
};

const CRIT_TIPS = {
  engine: "Engine Hit — 'Mechs: +1 heat in the End Phase if it fired weapons; a 2nd Engine Hit destroys the unit. Vehicles: halve Move, TMM and damage; a 2nd destroys the unit",
  fireControl: "Fire Control Hit — cumulative +2 Target Number for all subsequent weapon attacks",
  mp: "MP Hit — halves all Move ratings and TMM (round down), minimum 2\" and TMM 0; at 0\" the unit is immobile",
  weapons: "Weapon Hit — all damage values (including special abilities with damage) reduced by 1, minimum 0",
  thruster: "Thruster Hit (aerospace) — loses 1 Thrust; at 0 Thrust the unit crashes and is destroyed. May only occur once",
  fuel: "Fuel Hit (aerospace) — fuel tank hit; the unit crashes and is destroyed",
  crew: "Crew Hit (aerospace) — 1st adds +2 to all attacks and control rolls; a 2nd kills the crew and the unit is destroyed",
};

const CRIT_EFFECTS = {
  engine: "Engine Hit — 'Mechs: +1 heat in the End Phase if it fired weapons; a 2nd Engine Hit destroys the unit. Vehicles: halve Move, TMM and damage; a 2nd destroys the unit",
  fireControl: "Fire Control Hit — cumulative +2 Target Number for all subsequent weapon attacks",
  mp: "MP Hit — halves all Move ratings and TMM (round down), minimum 2\" and TMM 0; at 0\" the unit is immobile",
  weapons: "Weapon Hit — all damage values (including special abilities with damage) reduced by 1, minimum 0",
  thruster: "Thruster Hit (aerospace) — loses 1 Thrust; at 0 Thrust the unit crashes and is destroyed. May only occur once",
  fuel: "Fuel Hit (aerospace) — fuel tank hit; the unit crashes and is destroyed",
  crew: "Crew Hit (aerospace) — 1st adds +2 to all attacks and control rolls; a 2nd kills the crew and the unit is destroyed",
};

const ABILITY_TIPS = {
  AC: "Autocannon — may fire autocannons together as an alternative attack and use alternate AC munitions",
  AFC: "Advanced Fire Control — IndustrialMechs/support vehicles with this do not suffer unit-type TN modifiers",
  AM: "Anti-'Mech — infantry may make a special physical attack against ground units in base contact",
  AMS: "Anti-Missile System — reduces damage by 1 (min 1) from IF/LRM/SRM attacks; front arc only unless in a turret",
  AMP: "Amphibious — non-naval unit can move through water, paying 4\" per inch of water traversed",
  ARM: "Armored Components — ignores the first critical hit chance rolled against it each scenario (then spent)",
  ARS: "Armored Motive Systems — −1 modifier on Motive Systems Damage rolls",
  ATMO: "Atmospheric — operates within an atmosphere; used to denote airships and atmosphere-capable craft",
  BAR: "Barrier Armor Rating — substandard armor; attacks against it always trigger a critical hit check",
  BFC: "Basic Fire Control — adds +1 TN to the unit's attacks (inferior targeting)",
  BH: "Bloodhound Active Probe — enhanced PRB with 26\" range, immune to ECM/LECM (only AECM overwhelms it)",
  BOMB: "Bomb — carries up to # bombs for bombing attacks",
  BRA: "Ballistic-Reinforced Armor — halves damage from AC/FLK/IATM/IF/LRM/SRM attacks",
  C3BSM: "C3 Boosted Master — boosted C3 network master; links up to 3 slaves, unaffected by most ECM",
  C3BSS: "C3 Boosted Slave — boosted C3 network slave, unaffected by most ECM",
  C3I: "C3 Improved — up to 6 units share targeting data with no master; cannot be shut down by losing one member",
  C3M: "C3 Master — links up to 4 units into a targeting network (one must be a C3M)",
  C3S: "C3 Slave — links into a C3 network under a master computer",
  CAR: "Cargo — cargo space required by infantry/battle armor to be transported",
  CASE: "Cellular Ammunition Storage — survives Ammo Hit crits but suffers 1 additional damage",
  CASEII: "Cellular Ammunition Storage II — ignores Ammo Hit critical hits entirely",
  CNARC: "Clan Narc — missile homing beacon launcher",
  CR: "Critical-Resistant — −2 modifier on all critical hit rolls against this unit (1 or less = no crit)",
  CT: "Cargo Transport, Tons — carries # tons of bulk cargo",
  DRO: "Drone — unmanned unit that shuts down inside a hostile ECM field or if its control unit is eliminated",
  ECM: "Electronic Countermeasures — 12\" radius that disrupts enemy C3, probes, Narc and stealth",
  EE: "Elementary Engine — non-fusion engine (ICE); less explosion risk than ammo but more than fusion",
  ENE: "Energy weapons only — has no ammo; ignores Ammo Hit critical hits",
  ENG: "Engineering — can clear woods and rubble paths (see Saw)",
  ES: "Ejection Seat — pilot may abandon the unit; auto-ejects on Ammo Hit without CASE",
  FC: "Fuel Cell Engine — non-fusion engine",
  FLK: "Flak — on a miss by 2 or less vs an airborne unit, deals FLK damage at that range instead",
  FR: "Fire Resistant — unaffected by heat-causing weapons (HT)",
  FUEL: "Fuel — fuel capacity for aerospace/airship operations",
  HT: "Heat — adds heat to the target's heat scale in the End Phase; vs non-heat units it adds damage instead",
  HTC: "Trailer Hitch — can tow other wheeled or tracked units and trailers",
  IATM: "Improved ATM — may fire standard, HE, or ER missiles with special effects",
  IF: "Indirect Fire — can attack targets without LOS, using a friendly spotter; damage in place of the normal attack",
  IT: "Infantry Transport — carries up to # infantry/battle armor units",
  JMPS: "Jump Jets, Strong — adds # to TMM when jumping; +1 DFA damage at 2+",
  JMPW: "Jump Jets, Weak — subtracts # from TMM when jumping; −1 DFA damage at 2+",
  LAM: "Land-Air Mech — converts between 'Mech and aerospace modes",
  LECM: "Light ECM — ECM with a 2\" radius instead of 12\"",
  LG: "Large — occupies a 2\" diameter area; additional movement/combat modifiers",
  LMAS: "Light Mimetic Armor — if stationary, +2 TN to non-physical attacks against it",
  LPRB: "Light Active Probe — PRB with 12\" range; detects hidden units",
  LRM: "Long-Range Missiles — may fire as an alternative attack and use alternate LRM munitions",
  LTAG: "Light Target Acquisition Gear — paints targets for guided weapons at Short range only",
  MAS: "Mimetic Armor — if stationary, +3 TN to non-physical attacks against it",
  MCS: "Magnetic Clamp System — ProtoMechs may ride on a BattleMech (max 2, 1 for UCS)",
  MEC: "Mechanized — battle armor may ride on Omni-capable ground units",
  MEL: "Melee — adds 1 damage on successful Melee-type physical attacks",
  MFB: "Mobile Field Base — provides repair/maintenance bonuses between battles",
  MHQ: "Mobile Headquarters — command coordination bonuses based on rating",
  MSW: "Minesweeper — clears minefields in base contact; can fail and detonate them",
  MTAS: "Magnetic Taser — taser weapon (see taser rules)",
  NOVA: "NOVA Composite EW — combines ECM, PRB and a 3-unit C3i network",
  OMNI: "Omni — may transport a single battle armor unit using mechanized rules",
  ORO: "Off-Road — wheeled support vehicles may move off-paved terrain without penalty",
  OVL: "Overheat Long — may apply OV damage to Long range as well as Short/Medium",
  PAR: "Paratroopers — may dismount from airborne transports like jump infantry",
  PNT: "Point Defense — automatically engages attacking missiles, including Arrow IV and capital missiles",
  PRB: "Active Probe — 18\" range; confers Recon and detects hidden units",
  RCA: "Reactive Armor — halves damage from ART/BOMB/MSL/FLK attacks",
  RCN: "Recon — spotting/initiative bonuses in conjunction with MHQ",
  REAR: "Rear-Firing Weapons — may attack targets outside the normal firing arc with +1 TN; reduces forward damage by the REAR damage",
  REL: "Re-Engineered Lasers — negates reflective armor damage reduction",
  RFA: "Reflective Armor — halves damage from ENE and HT attacks; vulnerable to physical attacks",
  RSD: "Remote Sensor Dispenser — deploys stationary remote sensors",
  SAW: "Saw — may forego its attack to clear an area of woods",
  SEAL: "Environmental Sealing — operates in hostile environments (underwater, vacuum, etc.)",
  SHLD: "BattleMech Shield — provides damage protection from one arc",
  SNARC: "Standard Narc — missile homing beacon launcher",
  SOA: "Space Operations Adaptation — can operate in vacuum but cannot fly in space",
  SPC: "Spacecraft — aerospace craft capable of spaceflight",
  SRCH: "Searchlight — ignores Target Number modifiers for darkness",
  SRM: "Short-Range Missiles — may fire as an alternative attack and use alternate SRM munitions",
  STL: "Stealth — +1 TN at Medium and +2 at Long range vs non-infantry; +1 Short/Medium, +2 Long vs battle armor",
  TAG: "Target Acquisition Gear — designates targets for guided/artillery munitions at Short or Medium range",
  TOR: "Torpedo — underwater weapon; full damage even vs submerged targets",
  TSEMP: "TSEMP — targeted electromagnetic pulse; successful attack stuns the target",
  TSM: "Triple-Strength Myomer — when overheated: +2\" move and +1 physical damage; can deliberately overheat at OV0",
  TUR: "Turret — weapons with a 360-degree field of fire; turret damage values are given per range",
  UMU: "Underwater Maneuvering Units — uses submersible movement rules while submerged",
  VSTOL: "Very-Short Takeoff and Landing — lifts off and lands in less space than regular aerodyne units",
  WAT: "Watchdog — treated as having both LPRB and ECM",
  XMEC: "Extended Mechanized — battle armor may ride on any ground unit type",
};

const TYPE_TIPS = {
  BM: "BattleMech",
  IM: "IndustrialMech",
  PM: "ProtoMech",
  CV: "Combat Vehicle",
  SV: "Support Vehicle",
  AF: "Aerospace Fighter",
  CF: "Conventional Fighter",
  DS: "Spheroid DropShip",
  DA: "Aerodyne DropShip",
  SC: "Small Craft",
  MS: "Mobile Structure",
  CI: "Conventional Infantry",
  BA: "Battle Armor",
  UNK: "Unknown type",
};

const FALLBACK_TIP = "Special ability — see the Alpha Strike Commander's Edition rulebook";

export function abilityTip(code) {
  const base = code.toUpperCase();
  if (ABILITY_TIPS[base]) return ABILITY_TIPS[base];
  const m = base.match(/^([A-Z]+)/);
  if (m && ABILITY_TIPS[m[1]]) return ABILITY_TIPS[m[1]];
  return FALLBACK_TIP;
}

function addTip(el, text) {
  if (!text) return;
  el.classList.add("tip");
  el.dataset.tip = text;
}

function statRow(label, value) {
  const row = document.createElement("div");
  row.className = "stat-row";
  const lab = document.createElement("b");
  lab.textContent = label;
  addTip(lab, STAT_TIPS[label]);
  const val = document.createElement("span");
  val.textContent = value;
  row.append(lab, val);
  return row;
}

function identityRow(items) {
  const row = document.createElement("div");
  row.className = "identity-row";
  for (const item of items) {
    const cell = document.createElement("span");
    cell.className = "identity-cell";
    const lab = document.createElement("b");
    lab.textContent = item.label;
    addTip(lab, item.tip);
    const val = document.createElement("span");
    val.textContent = item.value;
    if (item.tipValue) addTip(val, item.tipValue);
    cell.append(lab, val);
    row.append(cell);
  }
  return row;
}

function skillSetter(entry) {
  const wrap = document.createElement("span");
  wrap.className = "skill-setter";
  if (entry.skillSet) {
    const val = document.createElement("span");
    val.className = "skill-value";
    val.textContent = entry.skill;
    addTip(val, "Skill Rating — set when deployed; cannot be changed during the game");
    wrap.append(val);
    return wrap;
  }
  const select = document.createElement("select");
  select.className = "skill-select";
  select.setAttribute("aria-label", "Set skill rating");
  for (let i = 0; i <= 6; i++) {
    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = String(i);
    if (i === entry.skill) opt.selected = true;
    select.append(opt);
  }
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "skill-set";
  btn.dataset.action = "set-skill";
  btn.textContent = "Set";
  wrap.append(select, btn);
  return wrap;
}

function track(label, action, total, damage, tip) {
  const pips = [];
  for (let i = 0; i < total; i++) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "pip";
    btn.dataset.action = action;
    btn.dataset.index = String(i);
    if (i < damage) btn.classList.add("damaged");
    pips.push(btn);
  }
  const wrap = document.createElement("div");
  wrap.className = "track";
  const labelEl = document.createElement("div");
  labelEl.className = "track-label";
  labelEl.textContent = label;
  addTip(labelEl, tip);
  const pipsEl = document.createElement("div");
  pipsEl.className = "pips";
  pipsEl.append(...pips);
  wrap.append(labelEl, pipsEl);
  return wrap;
}

const CRIT_LABELS = {
  engine: "ENGINE",
  fireControl: "F.CONTROL",
  mp: "MP",
  weapons: "WEAPONS",
  thruster: "THRUSTER",
  fuel: "FUEL",
  crew: "CREW",
};

function critRow(unit, type, count) {
  const cap = critCap(unit, type);
  const row = document.createElement("div");
  row.className = "crit-row";
  const label = document.createElement("span");
  label.className = "crit-label";
  label.textContent = CRIT_LABELS[type];
  addTip(label, `${CRIT_LABELS[type]} — ${CRIT_TIPS[type]}`);
  const boxes = document.createElement("div");
  boxes.className = "crit-boxes";
  for (let i = 0; i < cap; i++) {
    const box = document.createElement("button");
    box.type = "button";
    box.className = "crit-slot";
    box.dataset.crit = type;
    box.dataset.index = String(i);
    box.setAttribute("aria-label", `${CRIT_LABELS[type]} box ${i + 1}`);
    if (i < count) box.classList.add("filled");
    addTip(box, `${CRIT_LABELS[type]} — ${CRIT_TIPS[type]}`);
    boxes.append(box);
  }
  const effect = document.createElement("span");
  effect.className = "crit-effect";
  effect.textContent = CRIT_EFFECTS[type];
  row.append(label, boxes, effect);
  return row;
}

export function renderCard(unit, entry = createEntry(unit)) {
  const card = document.createElement("article");
  card.className = "card";
  card.dataset.unitId = unit.id;

  const head = document.createElement("header");
  head.className = "card-head";
  const title = document.createElement("h3");
  title.className = "card-title";
  title.textContent = unit.class;
  const variant = document.createElement("div");
  variant.className = "card-variant";
  variant.textContent = unit.variant;
  const pv = document.createElement("span");
  pv.className = "card-pv";
  pv.textContent = `PV ${unit.pv}`;
  addTip(pv, "Point Value — the unit's cost when building a force");
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "card-remove";
  remove.dataset.action = "remove";
  remove.setAttribute("aria-label", "Remove unit");
  remove.textContent = "\u2715";
  head.append(title, variant, pv, remove);

  const body = document.createElement("div");
  body.className = "card-body";

  const details = document.createElement("div");
  details.className = "card-details";

  const identity = document.createElement("div");
  identity.className = "card-identity";
  identity.append(
    identityRow([
      { label: "TP", value: unit.type, tip: "Type — unit classification", tipValue: TYPE_TIPS[unit.type] || "Unknown type" },
      { label: "SZ", value: unit.size, tip: STAT_TIPS.SZ },
      { label: "TMM", value: unit.tmm, tip: STAT_TIPS.TMM },
      { label: "MV", value: `${unit.move}"`, tip: STAT_TIPS.MV },
    ]),
    identityRow([
      { label: "Role", value: unit.role, tip: STAT_TIPS.Role },
      { label: "Skill", value: "", tip: STAT_TIPS.Skill },
    ]),
  );
  identity.querySelector(".identity-row:last-child .identity-cell:last-child").append(skillSetter(entry));

  const damage = document.createElement("div");
  damage.className = "card-damage";
  const dmgRow = document.createElement("div");
  dmgRow.className = "damage-row";
  const dmgCells = [
    { label: "S(0)", value: unit.damage.s, tip: "Damage at Short range (0–6\"), no range modifier" },
    { label: "M(+2)", value: unit.damage.m, tip: "Damage at Medium range (7–12\"), +2 Target Number modifier" },
    { label: "L(+4)", value: unit.damage.l, tip: "Damage at Long range (13–24\"), +4 Target Number modifier" },
  ];
  for (const cell of dmgCells) {
    const c = document.createElement("span");
    c.className = "damage-cell";
    const lab = document.createElement("b");
    lab.textContent = cell.label;
    addTip(lab, cell.tip);
    const val = document.createElement("span");
    val.textContent = `: ${cell.value}`;
    c.append(lab, val);
    dmgRow.append(c);
  }
  damage.append(dmgRow);

  const ovHeat = document.createElement("div");
  ovHeat.className = "card-ov-heat";

  const ov = document.createElement("div");
  ov.className = "card-ov";
  const ovRow = document.createElement("div");
  ovRow.className = "damage-row";
  const ovCell = document.createElement("span");
  ovCell.className = "damage-cell";
  const ovLab = document.createElement("b");
  ovLab.textContent = "OV";
  addTip(ovLab, "Overheat Value — extra damage you may add to an attack by taking that much heat");
  const ovVal = document.createElement("span");
  ovVal.textContent = `: ${unit.overheat}`;
  ovCell.append(ovLab, ovVal);
  ovRow.append(ovCell);
  ov.append(ovRow);
  ovHeat.append(ov);

  if (tracksHeat(unit)) {
    const heat = document.createElement("div");
    heat.className = "card-heat";
    const heatLabel = document.createElement("div");
    heatLabel.className = "track-label";
    heatLabel.textContent = "HEAT";
    addTip(heatLabel, "Heat level — 'Mechs and Aerospace Fighters track heat. Each OV point used adds 1 heat; at level 3+ you take damage; reaching S = Shutdown (immobile, TMM −4). Click a level; click again to reset.");
    heat.append(heatLabel);
    for (const level of HEAT_LEVELS) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "heat-btn";
      btn.dataset.heat = String(level);
      btn.textContent = String(level);
      if (entry.heat === level) {
        btn.classList.add("active");
        if (level === "S") btn.classList.add("shutdown");
      }
      heat.append(btn);
    }
    ovHeat.append(heat);
  }

  const tracks = document.createElement("div");
  tracks.className = "card-tracks";
  tracks.append(
    track("ARMOR", "armor", unit.armor, entry.armorDamage, "Armor points — click pips to mark damage. Armor absorbs damage before Structure."),
    track("STRUCTURE", "struct", unit.structure, entry.structDamage, "Structure points — click pips to mark damage. Any hit that damages Structure triggers a critical hit check (as does a natural 12 attack roll)."),
  );

  const special = document.createElement("div");
  special.className = "card-special";
  const specialLabel = document.createElement("div");
  specialLabel.className = "track-label";
  specialLabel.textContent = "Special:";
  addTip(specialLabel, "Special abilities — see the Alpha Strike Commander's Edition rulebook for full descriptions");
  const chips = document.createElement("div");
  chips.className = "card-abilities";
  for (const ability of unit.abilities || []) {
    const chip = document.createElement("span");
    chip.className = "ability";
    chip.textContent = ability;
    addTip(chip, abilityTip(ability));
    chips.append(chip);
  }
  special.append(specialLabel, chips);

  const crits = document.createElement("div");
  crits.className = "card-crits";
  const critLabel = document.createElement("div");
  critLabel.className = "track-label";
  critLabel.textContent = "CRITICAL HITS";
  addTip(critLabel, "Mark critical hits. Any hit that damages Structure — or any attack roll of natural 12 that hits — triggers a critical hit check. Each box is one hit; the number of boxes per type matches the official card (Engine 1, others 4).");
  const critGrid = document.createElement("div");
  critGrid.className = "crit-grid";
  for (const type of critTypesForUnit(unit)) {
    critGrid.append(critRow(unit, type, entry.crits[type] ?? 0));
  }
  crits.append(critLabel, critGrid);

  details.append(identity, damage, ovHeat, tracks, special);

  const art = document.createElement("div");
  art.className = "card-art";
  if (unit.image) {
    const img = document.createElement("img");
    img.src = `data/img/${unit.image}`;
    img.alt = `${unit.class} ${unit.variant}`;
    img.loading = "lazy";
    art.append(img);
  } else {
    const ph = document.createElement("div");
    ph.className = "placeholder";
    ph.textContent = unit.class.slice(0, 2);
    art.append(ph);
  }

  body.append(details, art);
  card.append(head, body, crits);
  return card;
}
