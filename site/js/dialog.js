import { hitProbability } from "./sator.js";

const SATOR_SECTIONS = [
  ["S", "Skill"],
  ["A", "Attacker"],
  ["T", "Target"],
  ["O", "Other"],
  ["R", "Roll"],
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

  const body = doc.createElement("div");
  body.className = "sator-body";

  const sections = [];
  for (const [letter, name] of SATOR_SECTIONS) {
    const row = doc.createElement("div");
    row.className = "sator-section-row";
    const letterBox = doc.createElement("div");
    letterBox.className = "sator-letter";
    letterBox.textContent = letter;
    const content = doc.createElement("div");
    content.className = "sator-content";
    const sectionTitle = doc.createElement("div");
    sectionTitle.className = "sator-section-title";
    sectionTitle.textContent = name;
    content.append(sectionTitle);
    if (letter === "S") {
      const skillValue = doc.createElement("div");
      skillValue.className = "sator-skill-value";
      content.append(skillValue);
    }
    row.append(letterBox, content);
    body.append(row);
    sections.push(row);
  }

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

  dialog.append(head, body, result);
  overlay.append(dialog);

  let currentAttacker = null;
  let currentEntry = null;

  function cannotAttack() {
    if (currentEntry.armorDamage >= currentAttacker.armor && currentEntry.structDamage >= currentAttacker.structure) {
      return "Unit destroyed";
    }
    if (currentEntry.heat === "S") return "Unit is shut down";
    return "";
  }

  function recompute() {
    const reason = cannotAttack();
    if (reason) {
      tnEl.textContent = "\u2014";
      breakdownEl.textContent = reason;
      probEl.textContent = "";
      noteEl.textContent = "";
      return;
    }
    const skill = currentEntry.skill;
    const tn = Math.max(2, skill);
    tnEl.textContent = String(tn);
    tnEl.classList.toggle("impossible", tn > 12);
    breakdownEl.textContent = `${skill} (Skill) = ${tn}`;
    probEl.textContent = `2d6 \u2265 ${tn} \u2192 ${(hitProbability(tn) * 100).toFixed(1)}% chance to hit`;
    noteEl.textContent = "Natural 12 = auto-hit \u00b7 Natural 2 = auto-miss \u00b7 Min TN 2";
  }

  function open() {
    const skillEl = dialog.querySelector(".sator-skill-value");
    skillEl.textContent = String(currentEntry.skill);
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
