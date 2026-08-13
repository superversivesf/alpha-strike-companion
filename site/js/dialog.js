import { hitProbability, attackerMoveMod, targetMoveMod, targetUsesTmm } from "./sator.js";

const STEPS = [
  ["S", "Skill", "Skill — the pilot's skill rating (0–6). Lower is better; changes the unit's Point Value."],
  ["A", "Attacker", "Attacker — modifiers from the attacking unit's own situation, such as its movement."],
  ["T", "Target", "Target — the target's movement modifier (TMM), terrain, and other target factors."],
  ["O", "Other", "Other — additional situational modifiers such as indirect fire, darkness, or special abilities."],
  ["R", "Roll", "Roll — the final target number: roll 2d6 equal to or above it to hit."],
];

const TARGET_MODES = [
  ["ground", "Ground / No Movement"],
  ["standstill", "Standstill / Min Move / Hull-Down"],
  ["jump", "Jumping Movement"],
  ["submersible", "Submersible Movement"],
  ["immobile", "Immobile"],
  ["dropped", "Dropped by Airborne Unit"],
];

const ATK_MOVES = [
  ["standstill", "Standstill"],
  ["ground", "Ground"],
  ["jump", "Jump"],
];

const JET_MIN = -3;
const JET_MAX = 2;

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

  const progress = doc.createElement("nav");
  progress.className = "sator-progress";
  progress.setAttribute("aria-label", "Calculator steps");
  const pills = [];
  for (const [letter, name] of STEPS) {
    const pill = doc.createElement("button");
    pill.type = "button";
    pill.className = "sator-pill";
    pill.dataset.step = letter;
    pill.textContent = letter;
    pill.setAttribute("aria-label", `${name} step`);
    pill.setAttribute("aria-current", "false");
    progress.append(pill);
    pills.push(pill);
  }

  const body = doc.createElement("div");
  body.className = "sator-body";

  let tnEl = null;
  let breakdownEl = null;
  let probEl = null;
  let noteEl = null;

  const panels = {};
  for (const [letter, name, desc] of STEPS) {
    const panel = doc.createElement("section");
    panel.className = "sator-panel";
    panel.dataset.step = letter;
    panel.hidden = true;
    const panelTitle = doc.createElement("div");
    panelTitle.className = "sator-panel-title";
    const letterBox = doc.createElement("span");
    letterBox.className = "sator-letter tip";
    letterBox.textContent = letter;
    letterBox.setAttribute("data-tip", desc);
    const nameEl = doc.createElement("span");
    nameEl.textContent = name;
    panelTitle.append(letterBox, nameEl);
    panel.append(panelTitle);

    if (letter === "S") {
      const skillValue = doc.createElement("div");
      skillValue.className = "sator-skill-value";
      panel.append(skillValue);
    }
    if (letter === "A") {
      const atkMove = doc.createElement("div");
      atkMove.className = "sator-btn-grid";
      for (const [value, label] of ATK_MOVES) {
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
      panel.append(atkMove);
    }
    if (letter === "T") {
      const tgtMode = doc.createElement("div");
      tgtMode.className = "sator-btn-grid";
      for (const [value, label] of TARGET_MODES) {
        const l = doc.createElement("label");
        const r = doc.createElement("input");
        r.type = "radio";
        r.name = "sator-target-mode";
        r.value = value;
        if (value === "ground") r.checked = true;
        const s = doc.createElement("span");
        s.textContent = label;
        l.append(r, s);
        tgtMode.append(l);
      }
      const tmmGroup = doc.createElement("div");
      tmmGroup.className = "sator-btn-grid sator-tmm-group";
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
      const jetsRow = doc.createElement("div");
      jetsRow.className = "sator-jets";
      const jetsLabel = doc.createElement("label");
      jetsLabel.textContent = "JMPS/JMPW/SUBS/SUBW #";
      jetsLabel.setAttribute("for", "sator-jets");
      const jetsStepper = doc.createElement("div");
      jetsStepper.className = "sator-stepper";
      const jetsDec = doc.createElement("button");
      jetsDec.type = "button";
      jetsDec.className = "sator-stepper-btn";
      jetsDec.setAttribute("aria-label", "Decrease jet modifier");
      jetsDec.textContent = "\u2212";
      const jetsInput = doc.createElement("input");
      jetsInput.id = "sator-jets";
      jetsInput.className = "sator-number";
      jetsInput.type = "number";
      jetsInput.step = "1";
      jetsInput.min = String(JET_MIN);
      jetsInput.max = String(JET_MAX);
      jetsInput.value = "0";
      const jetsInc = doc.createElement("button");
      jetsInc.type = "button";
      jetsInc.className = "sator-stepper-btn";
      jetsInc.setAttribute("aria-label", "Increase jet modifier");
      jetsInc.textContent = "+";
      jetsStepper.append(jetsDec, jetsInput, jetsInc);
      jetsRow.append(jetsLabel, jetsStepper);
      panel.append(tgtMode, tmmGroup, jetsRow);
    }
    if (letter === "O") {
      const otherNote = doc.createElement("div");
      otherNote.className = "sator-empty-note";
      otherNote.textContent = "Coming soon — range, terrain, and situational modifiers.";
      panel.append(otherNote);
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
      panel.append(tnEl, breakdownEl, probEl, noteEl);
    }
    body.append(panel);
    panels[letter] = panel;
  }

  const footer = doc.createElement("div");
  footer.className = "sator-footer";
  const backBtn = doc.createElement("button");
  backBtn.type = "button";
  backBtn.className = "sator-nav-btn";
  backBtn.id = "sator-back";
  backBtn.textContent = "\u2190";
  backBtn.setAttribute("aria-label", "Previous step");
  const runLabel = doc.createElement("div");
  runLabel.className = "sator-run-label";
  runLabel.textContent = "RUNNING TN";
  const runTn = doc.createElement("div");
  runTn.id = "sator-run-tn";
  runTn.className = "sator-run-tn";
  const nextBtn = doc.createElement("button");
  nextBtn.type = "button";
  nextBtn.className = "sator-nav-btn sator-nav-next";
  nextBtn.id = "sator-next";
  nextBtn.textContent = "\u2192";
  nextBtn.setAttribute("aria-label", "Next step");
  footer.append(backBtn, runLabel, runTn, nextBtn);

  dialog.append(head, progress, body, footer);
  overlay.append(dialog);

  let currentAttacker = null;
  let currentEntry = null;
  let stepIndex = 0;

  function cannotAttack() {
    if (currentEntry.armorDamage >= currentAttacker.armor && currentEntry.structDamage >= currentAttacker.structure) {
      return "Unit destroyed";
    }
    if (currentEntry.heat === "S") return "Unit is shut down";
    return "";
  }

  function readValues() {
    const atkMove = dialog.querySelector('input[name="sator-atk-move"]:checked')?.value ?? "ground";
    const tgtMode = dialog.querySelector('input[name="sator-target-mode"]:checked')?.value ?? "ground";
    const tmm = Number(dialog.querySelector('input[name="sator-tmm"]:checked')?.value ?? "0") || 0;
    const jets = Number(dialog.querySelector("#sator-jets")?.value ?? "0") || 0;
    return { atkMove, tgtMode, tmm, jets };
  }

  function compute() {
    const reason = cannotAttack();
    if (reason) {
      return { tn: null, breakdown: reason, probability: 0, impossible: false };
    }
    const { atkMove, tgtMode, tmm, jets } = readValues();
    const skill = currentEntry.skill;
    const move = attackerMoveMod(atkMove);
    const tgt = targetMoveMod(tgtMode, tmm, jets);
    const tn = Math.max(2, skill + move + tgt);
    const parts = [`${skill} (Skill)`];
    if (move !== 0) parts.push(`${move > 0 ? "+" : ""}${move} (Move)`);
    if (tgt !== 0) parts.push(`${tgt > 0 ? "+" : ""}${tgt} (Target)`);
    parts.push(`= ${tn}`);
    return { tn, breakdown: parts.join(" "), probability: hitProbability(tn), impossible: tn > 12 };
  }

  function renderResult() {
    const r = compute();
    if (r.tn === null) {
      tnEl.textContent = "\u2014";
      breakdownEl.textContent = r.breakdown;
      probEl.textContent = "";
      noteEl.textContent = "";
      runTn.textContent = "\u2014";
      return;
    }
    tnEl.textContent = String(r.tn);
    tnEl.classList.toggle("impossible", r.impossible);
    breakdownEl.textContent = r.breakdown;
    probEl.textContent = `2d6 \u2265 ${r.tn} \u2192 ${(r.probability * 100).toFixed(1)}% chance to hit`;
    noteEl.textContent = r.impossible
      ? "Only a natural 12 can hit"
      : "Natural 12 = auto-hit \u00b7 Natural 2 = auto-miss \u00b7 Min TN 2";
    runTn.textContent = String(r.tn);
  }

  function showStep(i) {
    stepIndex = Math.max(0, Math.min(STEPS.length - 1, i));
    for (const [letter] of STEPS) {
      panels[letter].hidden = letter !== STEPS[stepIndex][0];
      const pill = pills.find(p => p.dataset.step === letter);
      const idx = indexOfStep(letter);
      pill.classList.toggle("active", idx === stepIndex);
      pill.classList.toggle("done", idx < stepIndex);
      pill.setAttribute("aria-current", idx === stepIndex ? "step" : "false");
    }
    backBtn.disabled = stepIndex === 0;
    nextBtn.textContent = stepIndex === STEPS.length - 1 ? "\u2713" : "\u2192";
    nextBtn.setAttribute("aria-label", stepIndex === STEPS.length - 1 ? "Finish" : "Next step");
    renderResult();
    const focusTarget = panels[STEPS[stepIndex][0]].querySelector("input, button, .sator-skill-value");
    if (focusTarget && typeof focusTarget.focus === "function") focusTarget.focus();
  }

  function indexOfStep(letter) {
    return STEPS.findIndex(([l]) => l === letter);
  }

  function applyRevealState() {
    const mode = dialog.querySelector('input[name="sator-target-mode"]:checked')?.value ?? "ground";
    const tmmGroup = dialog.querySelector(".sator-tmm-group");
    const jetsRow = dialog.querySelector(".sator-jets");
    if (tmmGroup) tmmGroup.hidden = !targetUsesTmm(mode);
    if (jetsRow) jetsRow.hidden = !(mode === "jump" || mode === "submersible");
  }

  function open() {
    const skillEl = panels.S.querySelector(".sator-skill-value");
    skillEl.textContent = String(currentEntry.skill);
    const tmm0 = dialog.querySelector('input[name="sator-tmm"][value="0"]');
    if (tmm0) tmm0.checked = true;
    const jetsInput = dialog.querySelector("#sator-jets");
    if (jetsInput) jetsInput.value = "0";
    for (const pill of pills) pill.classList.remove("done");
    applyRevealState();
    showStep(0);
    overlay.hidden = false;
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

  backBtn.addEventListener("click", () => showStep(stepIndex - 1));
  nextBtn.addEventListener("click", () => {
    if (stepIndex < STEPS.length - 1) showStep(stepIndex + 1);
    else closeNow();
  });
  for (const pill of pills) {
    pill.addEventListener("click", () => showStep(indexOfStep(pill.dataset.step)));
  }

  dialog.addEventListener("input", renderResult);
  dialog.addEventListener("change", renderResult);

  const jetsStepper = dialog.querySelector(".sator-stepper");
  if (jetsStepper) {
    const jetsInput = jetsStepper.querySelector("#sator-jets");
    const dec = jetsStepper.querySelector(".sator-stepper-btn[aria-label=\"Decrease jet modifier\"]");
    const inc = jetsStepper.querySelector(".sator-stepper-btn[aria-label=\"Increase jet modifier\"]");
    const step = delta => {
      const next = Math.max(JET_MIN, Math.min(JET_MAX, (Number(jetsInput.value) || 0) + delta));
      jetsInput.value = String(next);
      renderResult();
    };
    dec.addEventListener("click", () => step(-1));
    inc.addEventListener("click", () => step(1));
  }

  const tgtModeGroup = dialog.querySelector('input[name="sator-target-mode"]');
  if (tgtModeGroup) {
    dialog.querySelector(".sator-panel[data-step=\"T\"]").addEventListener("change", e => {
      if (e.target.name === "sator-target-mode") {
        const mode = e.target.value;
        const tmmGroup = dialog.querySelector(".sator-tmm-group");
        const jetsRow = dialog.querySelector(".sator-jets");
        tmmGroup.hidden = !targetUsesTmm(mode);
        jetsRow.hidden = !(mode === "jump" || mode === "submersible");
      }
    });
  }

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
