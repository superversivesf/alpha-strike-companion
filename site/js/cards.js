import { createEntry, HEAT_LEVELS, CRIT_SLOTS } from "./state.js";

const STAT_TIPS = {
  SZ: "Size — the unit's size class (1–4)",
  TMM: "Target Movement Modifier — bonus to hit this unit when it moves",
  MV: "Movement — inches per turn (j = jump, g = ground, a = air)",
  Role: "Tactical role of the unit",
  S: "Damage at short range",
  M: "Damage at medium range",
  L: "Damage at long range",
  OV: "Overheat — extra damage dealt when heat is 2 or higher",
};

const ABILITY_TIPS = {
  ENE: "Energy weapons — no ammo required",
  AC: "Autocannon — ballistic weapon",
  IF: "Indirect fire — can fire over obstacles with a spotter",
  LRM: "Long-range missiles",
  SRM: "Short-range missiles",
  REAR: "Rear-mounted weapons — can fire into the rear arc",
  FLK: "Flak — bonus damage vs aerospace units",
  HT: "Heat — extra damage vs infantry",
  JMP: "Jump jets — can jump over terrain",
  BOMB: "Bombing — aerospace bombing capability",
  FUEL: "Fuel — fuel capacity in turns",
  LAM: "Land-Air Mech — converts between mech and fighter modes",
  SRC: "Special rules card — see the unit's special rules",
  C3: "C3 computer — shares targeting data",
  ECM: "Electronic countermeasures — disrupts enemy targeting",
  AMS: "Anti-missile system — shoots down incoming missiles",
  TUR: "Turret — can rotate to fire in any arc",
  MEL: "Melee — physical attack capability",
  STL: "Stealth — harder to hit at range",
  TAG: "Target acquisition gear — designates targets for guided weapons",
  NARC: "Narc beacon — homing beacon for missiles",
  PRB: "Probe — detects hidden units",
  RCN: "Recon — recon bonus",
  MHQ: "Mobile HQ — command unit",
  CP: "Command point — provides command bonuses",
  AT: "Anti-tank — bonus vs vehicles",
  CK: "Cargo — carries cargo",
  LG: "Landing gear — can land",
  SOA: "Squad — infantry squad",
  TSM: "Triple-strength myomer — extra melee damage when hot",
  VRTOL: "VTOL — vertical takeoff and landing",
  WAT: "Water — amphibious",
  WIG: "WIGE — ground effect vehicle",
  OVL: "Overload — extra damage at the cost of heat",
  RHS: "Reinforced structure — extra structure",
  SLG: "Slug — ballistic slug",
  XMEC: "Xenomech — alien mech",
  SRCH: "Searchlight — illuminates targets",
  RFA: "Rear fire arc — rear weapons",
};

function abilityTip(code) {
  const key = code.replace(/[^A-Za-z]/g, "").slice(0, 3);
  return ABILITY_TIPS[key] || "Special ability — see Alpha Strike rules";
}

function statRow(label, value) {
  const row = document.createElement("div");
  row.className = "stat-row";
  const lab = document.createElement("b");
  lab.textContent = label;
  lab.title = STAT_TIPS[label] || "";
  const val = document.createElement("span");
  val.textContent = value;
  row.append(lab, val);
  return row;
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
  if (tip) labelEl.title = tip;
  const pipsEl = document.createElement("div");
  pipsEl.className = "pips";
  pipsEl.append(...pips);
  wrap.append(labelEl, pipsEl);
  return wrap;
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
  const variant = document.createElement("span");
  variant.className = "card-variant";
  variant.textContent = unit.variant;
  const pv = document.createElement("span");
  pv.className = "card-pv";
  pv.textContent = `PV ${unit.pv}`;
  pv.title = "Point Value — Alpha Strike cost of the unit";
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

  const stats = document.createElement("div");
  stats.className = "card-stats";
  stats.append(
    statRow("SZ", unit.size),
    statRow("TMM", unit.tmm),
    statRow("MV", unit.move),
    statRow("Role", unit.role),
    statRow("S", unit.damage.s),
    statRow("M", unit.damage.m),
    statRow("L", unit.damage.l),
    statRow("OV", unit.overheat),
  );

  const tracks = document.createElement("div");
  tracks.className = "card-tracks";
  tracks.append(
    track("ARMOR", "armor", unit.armor, entry.armorDamage, "Armor points — click pips to mark damage"),
    track("STRUCTURE", "struct", unit.structure, entry.structDamage, "Structure points — click pips to mark damage"),
  );

  const heat = document.createElement("div");
  heat.className = "card-heat";
  const heatLabel = document.createElement("div");
  heatLabel.className = "track-label";
  heatLabel.textContent = "HEAT";
  heatLabel.title = "Heat level — click 1, 2, 3, or S (shutdown); click again to reset";
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

  const crits = document.createElement("div");
  crits.className = "card-crits";
  const critLabel = document.createElement("div");
  critLabel.className = "track-label";
  critLabel.textContent = "CRITS";
  critLabel.title = "Critical hit slots — click to mark critical hits";
  const critGrid = document.createElement("div");
  critGrid.className = "crit-grid";
  for (let i = 0; i < CRIT_SLOTS; i++) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "crit-slot";
    btn.dataset.crit = String(i);
    btn.setAttribute("aria-label", `Crit slot ${i + 1}`);
    if (entry.crits[i]) btn.classList.add("filled");
    critGrid.append(btn);
  }
  crits.append(critLabel, critGrid);

  const abilities = document.createElement("footer");
  abilities.className = "card-abilities";
  for (const ability of unit.abilities || []) {
    const chip = document.createElement("span");
    chip.className = "ability";
    chip.textContent = ability;
    chip.title = abilityTip(ability);
    abilities.append(chip);
  }

  details.append(stats, tracks, heat, crits, abilities);

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
  card.append(head, body);
  return card;
}
