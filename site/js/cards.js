import { createEntry, HEAT_LEVELS, CRIT_SLOTS } from "./state.js";

function track(label, action, total, damage) {
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
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "card-remove";
  remove.dataset.action = "remove";
  remove.setAttribute("aria-label", "Remove unit");
  remove.textContent = "\u2715";
  head.append(title, variant, pv, remove);

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

  const stats = document.createElement("div");
  stats.className = "card-stats";
  const row1 = document.createElement("div");
  row1.textContent = `SZ ${unit.size}  TMM ${unit.tmm}  MV ${unit.move}`;
  const row2 = document.createElement("div");
  row2.textContent = `Role: ${unit.role}`;
  const row3 = document.createElement("div");
  row3.textContent = `S ${unit.damage.s}  M ${unit.damage.m}  L ${unit.damage.l}`;
  const row4 = document.createElement("div");
  row4.textContent = `OV ${unit.overheat}`;
  stats.append(row1, row2, row3, row4);

  const tracks = document.createElement("div");
  tracks.className = "card-tracks";
  tracks.append(
    track("ARMOR", "armor", unit.armor, entry.armorDamage),
    track("STRUCTURE", "struct", unit.structure, entry.structDamage),
  );

  const heat = document.createElement("div");
  heat.className = "card-heat";
  const heatLabel = document.createElement("div");
  heatLabel.className = "track-label";
  heatLabel.textContent = "HEAT";
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
    abilities.append(chip);
  }

  card.append(head, art, stats, tracks, heat, crits, abilities);
  return card;
}
