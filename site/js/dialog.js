import { attackerToHit } from "./sator.js";

const DARKNESS_DEFAULT_LABEL = "Darkness +1";
const DARKNESS_NEGATED_LABEL = "Darkness (negated by SRCH)";

const TERRAIN_OPTIONS = [
  ["none", "None"],
  ["light-woods", "Light Woods +1"],
  ["heavy-woods", "Heavy Woods +2"],
  ["partial-cover", "Partial Cover +1"],
  ["water", "Water +1"],
  ["light-smoke", "Light Smoke +1"],
  ["heavy-smoke", "Heavy Smoke +2"],
];

function buildDialog(doc) {
  const overlay = doc.createElement("div");
  overlay.className = "sator-overlay";
  overlay.hidden = true;
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-labelledby", "sator-title");

  const dialog = doc.createElement("div");
  dialog.className = "sator-dialog";

  const title = doc.createElement("h2");
  title.id = "sator-title";
  title.textContent = "To-Hit Calculator";
  const close = doc.createElement("button");
  close.type = "button";
  close.className = "sator-close";
  close.setAttribute("aria-label", "Close to-hit calculator");
  close.textContent = "\u2715";
  const head = doc.createElement("div");
  head.className = "sator-head";
  head.append(title, close);

  const attacker = doc.createElement("fieldset");
  attacker.className = "sator-section sator-attacker";
  const atkLegend = doc.createElement("legend");
  atkLegend.textContent = "Attacker";
  const atkName = doc.createElement("div");
  atkName.className = "sator-unit-name";
  const atkSkill = doc.createElement("div");
  atkSkill.className = "sator-row";
  const atkSkillLabel = doc.createElement("label");
  atkSkillLabel.textContent = "Skill";
  const atkSkillValue = doc.createElement("span");
  atkSkillValue.className = "sator-skill-value";
  atkSkill.append(atkSkillLabel, atkSkillValue);
  const atkFc = doc.createElement("div");
  atkFc.className = "sator-badge sator-fc-badge";
  const atkCrew = doc.createElement("div");
  atkCrew.className = "sator-badge sator-crew-badge";
  const atkMove = doc.createElement("div");
  atkMove.className = "sator-row";
  const atkMoveLabel = doc.createElement("label");
  atkMoveLabel.textContent = "Movement";
  const atkMoveGroup = doc.createElement("div");
  atkMoveGroup.className = "sator-radio-group";
  for (const [value, label] of [["stationary", "Stationary"], ["walk", "Walk"], ["run", "Run +1"], ["jump", "Jump +1"]]) {
    const l = doc.createElement("label");
    const r = doc.createElement("input");
    r.type = "radio";
    r.name = "sator-atk-move";
    r.value = value;
    if (value === "walk") r.checked = true;
    const s = doc.createElement("span");
    s.textContent = label;
    l.append(r, s);
    atkMoveGroup.append(l);
  }
  atkMove.append(atkMoveLabel, atkMoveGroup);
  attacker.append(atkLegend, atkName, atkSkill, atkFc, atkCrew, atkMove);

  const target = doc.createElement("fieldset");
  target.className = "sator-section sator-target";
  const tgtLegend = doc.createElement("legend");
  tgtLegend.textContent = "Target";
  const tgtMove = doc.createElement("div");
  tgtMove.className = "sator-row";
  const tgtMoveLabel = doc.createElement("label");
  tgtMoveLabel.textContent = "Movement & TMM";
  const tgtMoveGroup = doc.createElement("div");
  tgtMoveGroup.className = "sator-radio-group";
  for (const [value, label] of [["immobile", "Immobile \u2013 TMM 0"], ["stationary", "Stationary \u2013 TMM 0"], ["moved", "Moved"], ["jump", "Jump"]]) {
    const l = doc.createElement("label");
    const r = doc.createElement("input");
    r.type = "radio";
    r.name = "sator-target-move";
    r.value = value;
    if (value === "moved") r.checked = true;
    const s = doc.createElement("span");
    s.textContent = label;
    l.append(r, s);
    tgtMoveGroup.append(l);
  }
  tgtMove.append(tgtMoveLabel, tgtMoveGroup);
  const tmmRow = doc.createElement("div");
  tmmRow.className = "sator-row sator-tmm-row";
  const tmmLabel = doc.createElement("label");
  tmmLabel.textContent = "TMM";
  const tmmGroup = doc.createElement("div");
  tmmGroup.className = "sator-radio-group";
  for (let i = 0; i <= 5; i++) {
    const l = doc.createElement("label");
    const r = doc.createElement("input");
    r.type = "radio";
    r.name = "sator-tmm";
    r.value = String(i);
    if (i === 0) r.checked = true;
    const s = doc.createElement("span");
    s.textContent = String(i);
    l.append(r, s);
    tmmGroup.append(l);
  }
  tmmRow.append(tmmLabel, tmmGroup);
  const terrainRow = doc.createElement("div");
  terrainRow.className = "sator-row";
  const terrainLabel = doc.createElement("label");
  terrainLabel.textContent = "Terrain";
  terrainLabel.setAttribute("for", "sator-terrain");
  const terrainSel = doc.createElement("select");
  terrainSel.id = "sator-terrain";
  terrainSel.className = "sator-select";
  for (const [value, label] of TERRAIN_OPTIONS) {
    const opt = doc.createElement("option");
    opt.value = value;
    opt.textContent = label;
    terrainSel.append(opt);
  }
  terrainRow.append(terrainLabel, terrainSel);
  target.append(tgtLegend, tgtMove, tmmRow, terrainRow);

  const range = doc.createElement("fieldset");
  range.className = "sator-section sator-range";
  const rangeLegend = doc.createElement("legend");
  rangeLegend.textContent = "Range";
  const rangeGroup = doc.createElement("div");
  rangeGroup.className = "sator-radio-group";
  for (const [value, label] of [["S", "Short"], ["M", "Medium +2"], ["L", "Long +4"]]) {
    const l = doc.createElement("label");
    const r = doc.createElement("input");
    r.type = "radio";
    r.name = "sator-range";
    r.value = value;
    if (value === "S") r.checked = true;
    const s = doc.createElement("span");
    s.textContent = label;
    l.append(r, s);
    rangeGroup.append(l);
  }
  range.append(rangeLegend, rangeGroup);

  const other = doc.createElement("fieldset");
  other.className = "sator-section sator-other";
  const otherLegend = doc.createElement("legend");
  otherLegend.textContent = "Other";
  const chips = doc.createElement("div");
  chips.className = "sator-chips";
  for (const [id, label] of [["sator-if", "Indirect Fire +1"], ["sator-rear", "Rear Weapons +1"], ["sator-darkness", DARKNESS_DEFAULT_LABEL]]) {
    const l = doc.createElement("label");
    const c = doc.createElement("input");
    c.type = "checkbox";
    c.id = id;
    c.className = "sator-other-chk";
    l.append(c, label);
    chips.append(l);
  }
  const otherNum = doc.createElement("div");
  otherNum.className = "sator-row";
  const otherLabel = doc.createElement("label");
  otherLabel.textContent = "Other";
  otherLabel.setAttribute("for", "sator-other");
  const otherInput = doc.createElement("input");
  otherInput.id = "sator-other";
  otherInput.className = "sator-number";
  otherInput.type = "number";
  otherInput.step = "1";
  otherInput.min = "-10";
  otherInput.max = "10";
  otherInput.value = "0";
  otherNum.append(otherLabel, otherInput);
  other.append(otherLegend, chips, otherNum);

  const result = doc.createElement("div");
  result.className = "sator-result";
  const tnEl = doc.createElement("div");
  tnEl.id = "sator-tn";
  tnEl.className = "sator-tn";
  const breakdownEl = doc.createElement("div");
  breakdownEl.id = "sator-breakdown";
  breakdownEl.className = "sator-breakdown";
  const probEl = doc.createElement("div");
  probEl.id = "sator-prob";
  probEl.className = "sator-prob";
  const noteEl = doc.createElement("div");
  noteEl.id = "sator-note";
  noteEl.className = "sator-note";
  result.append(tnEl, breakdownEl, probEl, noteEl);

  dialog.append(head, attacker, target, range, other, result);
  overlay.append(dialog);

  let currentAttacker = null;
  let currentEntry = null;
  let hasSrch = false;

  function readInputs() {
    const q = s => dialog.querySelector(s);
    const atkMove = dialog.querySelector('input[name="sator-atk-move"]:checked');
    const tgtMove = dialog.querySelector('input[name="sator-target-move"]:checked');
    const rangeBand = dialog.querySelector('input[name="sator-range"]:checked');
    const extra = [];
    if (q("#sator-if").checked) extra.push(1);
    if (q("#sator-rear").checked) extra.push(1);
    if (q("#sator-darkness").checked && !hasSrch) extra.push(1);
    extra.push(Number(q("#sator-other").value) || 0);
    const atkEntry = { ...currentEntry, movement: atkMove ? atkMove.value : "walk" };
    return {
      attacker: currentAttacker,
      attackerEntry: atkEntry,
      target: currentAttacker,
      targetEntry: { ...atkEntry, movement: undefined },
      targetMovement: tgtMove ? tgtMove.value : "walk",
      rangeBand: rangeBand ? rangeBand.value : "S",
      terrain: q("#sator-terrain").value,
      otherModifiers: extra,
      targetTmmOverride: q('input[name="sator-tmm"]:checked')?.value ?? "0",
    };
  }

  function recompute() {
    const r = attackerToHit(readInputs());
    if (r.cannotAttack) {
      tnEl.textContent = "\u2014";
      breakdownEl.textContent = r.reason;
      probEl.textContent = "";
      noteEl.textContent = "";
      return;
    }
    tnEl.textContent = String(r.tn);
    tnEl.classList.toggle("impossible", r.tn > 12);
    breakdownEl.textContent = r.breakdown.length
      ? r.breakdown.map(b => `${b.value > 0 ? "+" : ""}${b.value} ${b.label}`).join(" ") + ` = ${r.tn}`
      : `TN ${r.tn}`;
    probEl.textContent = `2d6 \u2265 ${r.tn} \u2192 ${(r.probability * 100).toFixed(1)}% chance to hit`;
    noteEl.textContent = r.tn > 12
      ? "Only a natural 12 can hit"
      : "Natural 12 = auto-hit \u00b7 Natural 2 = auto-miss \u00b7 Min TN 2";
  }

  dialog.addEventListener("input", recompute);
  dialog.addEventListener("change", recompute);

  function open() {
    const skillEl = dialog.querySelector(".sator-skill-value");
    skillEl.textContent = String(currentEntry.skill);
    const fc = currentEntry.crits?.fireControl ?? 0;
    const crew = currentEntry.crits?.crew ?? 0;
    dialog.querySelector(".sator-fc-badge").textContent = fc ? `Fire Control +${fc * 2}` : "";
    dialog.querySelector(".sator-crew-badge").textContent = crew ? `Crew +${crew * 2}` : "";
    dialog.querySelector(".sator-unit-name").textContent =
      `${currentAttacker.class} ${currentAttacker.variant}`;
    const tmm0 = dialog.querySelector('input[name="sator-tmm"][value="0"]');
    if (tmm0) tmm0.checked = true;
    dialog.querySelector("#sator-other").value = "0";
    for (const c of dialog.querySelectorAll(".sator-other-chk")) c.checked = false;
    hasSrch = (currentAttacker.abilities || []).includes("SRCH");
    const darkness = dialog.querySelector("#sator-darkness");
    const darknessLabel = darkness.closest("label");
    if (hasSrch) {
      darkness.disabled = true;
      darkness.checked = false;
      darknessLabel.classList.add("negated");
      darknessLabel.lastChild.textContent = DARKNESS_NEGATED_LABEL;
    } else {
      darkness.disabled = false;
      darknessLabel.classList.remove("negated");
      darknessLabel.lastChild.textContent = DARKNESS_DEFAULT_LABEL;
    }
    const m = dialog.querySelector('input[name="sator-atk-move"][value="walk"]');
    if (m) m.checked = true;
    const tm = dialog.querySelector('input[name="sator-target-move"][value="moved"]');
    if (tm) tm.checked = true;
    const r = dialog.querySelector('input[name="sator-range"][value="S"]');
    if (r) r.checked = true;
    dialog.querySelector("#sator-terrain").value = "none";
    tmmRow.hidden = false;
    for (const r of dialog.querySelectorAll('input[name="sator-tmm"]')) r.disabled = false;
    recompute();
    overlay.hidden = false;
    const first = dialog.querySelector("input, select, button:not(.sator-close)");
    if (first) first.focus();
  }

  overlay.__open = (attacker, attackerEntry) => {
    currentAttacker = attacker;
    currentEntry = attackerEntry;
    open();
  };

  const escHandler = e => {
    if (e.key === "Escape" && !overlay.hidden) closeNow();
  };
  overlay.__escHandler = escHandler;

  function closeNow() {
    overlay.hidden = true;
    doc.removeEventListener("keydown", overlay.__escHandler);
    overlay.__returnFocus?.focus?.();
  }

  close.addEventListener("click", closeNow);
  overlay.addEventListener("click", e => {
    if (e.target === overlay) closeNow();
  });

  const tgtMoveGroupEl = tgtMoveGroup;
  tgtMoveGroupEl.addEventListener("change", e => {
    if (e.target.name === "sator-target-move") {
      const noTmm = e.target.value === "stationary" || e.target.value === "immobile";
      tmmRow.hidden = noTmm;
      if (noTmm) {
        const tmm0 = dialog.querySelector('input[name="sator-tmm"][value="0"]');
        if (tmm0) tmm0.checked = true;
      }
    }
  });
  return overlay;
}

export function ensureSatorDialog(doc) {
  if (doc.__asSatorDialog) return doc.__asSatorDialog;
  const overlay = buildDialog(doc);
  doc.body.appendChild(overlay);
  doc.__asSatorDialog = overlay;
  return overlay;
}

export function openSatorDialog({ doc, attacker, attackerEntry }) {
  const overlay = ensureSatorDialog(doc);
  overlay.__returnFocus = doc.activeElement;
  overlay.__open(attacker, attackerEntry);
  doc.addEventListener("keydown", overlay.__escHandler);
}

export function closeSatorDialog(doc) {
  const overlay = doc.__asSatorDialog;
  if (!overlay || overlay.hidden) return;
  overlay.hidden = true;
  doc.removeEventListener("keydown", overlay.__escHandler);
  overlay.__returnFocus?.focus?.();
}
