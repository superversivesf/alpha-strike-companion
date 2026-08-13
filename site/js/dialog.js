import { hitProbability, attackerMoveMod } from "./sator.js";

const SATOR_SECTIONS = [
  ["S", "Skill", "Skill — the pilot's skill rating (0–6). Lower is better; changes the unit's Point Value."],
  ["A", "Attacker", "Attacker — modifiers from the attacking unit's own situation, such as its movement."],
  ["T", "Target", "Target — the target's movement modifier (TMM), terrain, and other target factors."],
  ["O", "Other", "Other — additional situational modifiers such as indirect fire, darkness, or special abilities."],
  ["R", "Roll", "Roll — the final target number: roll 2d6 equal to or above it to hit."],
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

  let tnEl = null;
  let breakdownEl = null;
  let probEl = null;
  let noteEl = null;

  const sections = [];
  for (const [letter, name, desc] of SATOR_SECTIONS) {
    const row = doc.createElement("div");
    row.className = "sator-section-row";
    const letterBox = doc.createElement("div");
    letterBox.className = "sator-letter tip";
    letterBox.textContent = letter;
    letterBox.setAttribute("data-tip", desc);
    const content = doc.createElement("div");
    content.className = "sator-content";
    if (letter === "S") {
      const skillValue = doc.createElement("div");
      skillValue.className = "sator-skill-value";
      content.append(skillValue);
    }
    if (letter === "A") {
      const atkMove = doc.createElement("div");
      atkMove.className = "sator-radio-group";
      for (const [value, label] of [["standstill", "Standstill"], ["ground", "Ground"], ["jump", "Jump"]]) {
        const l = doc.createElement("label");
        const r = doc.createElement("input");
        r.type = "radio";
        r.name = "sator-atk-move";
        r.value = value;
        if (value === "ground") r.checked = true;
        const s = doc.createElement("span");
        s.textContent = label;
        l.append(r, s);
        atkMove.append(l);
      }
      content.append(atkMove);
    }
    if (letter === "R") {
      tnEl = doc.createElement("div");
      tnEl.id = "sator-tn";
      tnEl.className = "sator-tn";
      breakdownEl = doc.createElement("div");
      breakdownEl.id = "sator-breakdown";
      breakdownEl.className = "sator-breakdown";
      probEl = doc.createElement("div");
      probEl.id = "sator-prob";
      probEl.className = "sator-prob";
      noteEl = doc.createElement("div");
      noteEl.id = "sator-note";
      noteEl.className = "sator-note";
      content.append(tnEl, breakdownEl, probEl, noteEl);
    }
    row.append(letterBox, content);
    body.append(row);
    sections.push(row);
  }

  dialog.append(head, body);
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
    const move = attackerMoveMod(dialog.querySelector('input[name="sator-atk-move"]:checked')?.value ?? "ground");
    const tn = Math.max(2, skill + move);
    tnEl.textContent = String(tn);
    tnEl.classList.toggle("impossible", tn > 12);
    const parts = [`${skill} (Skill)`];
    if (move !== 0) parts.push(`${move > 0 ? "+" : ""}${move} (Move)`);
    parts.push(`= ${tn}`);
    breakdownEl.textContent = parts.join(" ");
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

  dialog.addEventListener("input", recompute);
  dialog.addEventListener("change", recompute);

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
