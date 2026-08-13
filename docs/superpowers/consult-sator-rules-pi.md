# SATOR To-Hit Calculator — Alpha Strike Commander's Edition Rules Research Report

## 1. Base Formula

**Target Number (TN) = Skill + Attacker Movement Modifier + Target Movement Modifier + Terrain Modifier + Range Modifier + Other Modifiers**

- Roll **2d6**; hit if result **≥ TN**.
- **Natural 12** = automatic hit (even if TN would be impossible).
- **Natural 2** = automatic miss (even if TN is 2 or less).
- **Minimum TN = 2**. Modifiers can never reduce TN below 2.

---

## 2. Attacker Modifiers

### 2.1 Attacker Movement Mode (the #1 user input)
| Mode | Modifier | Notes |
|------|----------|-------|
| Stationary (0" moved) | 0 | Unit did not move or moved 0" |
| Walked | 0 | Used Walk MP or less |
| Ran | **+1** | Used Run MP |
| Jumped | **+1** | Used Jump MP (see JMPS/JMPW for TMM) |

> **Note:** In AS:CE, Jump is +1 (not +2). JMPS/JMPW affect the *Target's* TMM when jumping, not the attacker's modifier.

### 2.2 Unit-Type Attacker Modifiers
| Unit Type | Modifier | Notes |
|-----------|----------|-------|
| BattleMech | 0 | — |
| ProtoMech | 0 | — |
| Vehicle (Combat) | 0 | — |
| IndustrialMech | **+1** | Negated by **AFC** (Advanced Fire Control) |
| Support Vehicle (with BFC) | **+1** | Basic Fire Control penalty |
| Infantry / Battle Armor | 0 | — |
| Aerospace / Airship | 0 | Uses aerospace combat rules (usually different) |

> The app has unit type in `unit.type` and abilities in `unit.abilities` (AFC, BFC).

### 2.3 Heat Effects on Attacker
**Heat does NOT apply a direct to-hit modifier in Alpha Strike CE.** The heat track is for:
- TSM activation at heat 1+
- End-phase damage at heat 3+
- Shutdown (immobile, TMM −4) at heat S

The attacker’s heat level does **not** modify the to-hit TN. The calculator does not need to factor attacker heat into SATOR.

### 2.4 Critical Hits on Attacker (affecting its own attacks)
| Crit Type | Effect on Attacker's To-Hit | Source |
|-----------|----------------------------|--------|
| **Fire Control** | **+2** per hit (cumulative) | Entry `crits.fireControl` |
| **Crew** (aerospace) | **+2** per hit (cumulative) | Entry `crits.crew` |
| **MP Hit** | Halve Move & TMM (round down), min 2" / TMM 0 | Entry `crits.mp` |
| **Weapons Hit** | Damage −1 (min 0) | Entry `crits.weapons` |
| **Engine Hit** (Vehicle) | Halve Move, TMM, and damage | Entry `crits.engine` |
| **Engine Hit** ('Mech) | +1 heat in End Phase if fired | Entry `crits.engine` |

> The calculator should auto-add +2 per Fire Control hit to the attacker's TN.
> The calculator should auto-add +2 per Crew hit for aerospace attackers.

---

## 3. Target Modifiers

### 3.1 Base Target Movement Modifier (TMM)
- Use **`unit.tmm`** from the target's card.
- **Immobilized units have TMM 0** regardless of card value.
- **Shutdown units (heat S) have TMM −4** (usually reducing TMM to 0).

### 3.2 Target Movement Mode (user selection)
The target's movement mode affects whether its TMM applies:
- If target **Stationary**: TMM = 0 (even if card says higher).
- If target **Walked/Ran**: Full TMM from card.
- If target **Jumped**: Full TMM from card, but may be modified by JMPS/JMPW.

> **Exception:** Some special abilities (LMAS, MAS) only apply if the target was stationary.

### 3.3 Terrain Modifiers (target terrain — user selection)
| Terrain | Modifier | Notes |
|---------|----------|-------|
| Light Woods | **+1** | — |
| Heavy Woods | **+2** | — |
| Partial Cover | **+1** | Only if LOS is through cover |
| Water (Depth 1"+) | **+1** | Only if attacker is not naval, amphibious, UMU, etc. |
| Light Smoke | **+1** | — |
| Heavy Smoke | **+2** | — |
| Building / Rubble | Varies | Usually +1 for light, +2 for heavy (if used) |

> These stack with TMM and range.

### 3.4 Special Abilities Affecting Target's Defense (Attacker TN)
| Ability | Modifier | Condition |
|---------|----------|-----------|
| **STL** (Stealth) | +1 Short/Med, +2 Long | Vs non-infantry. Vs BA: +1 S/M, +2 L |
| **LMAS** (Light Mimetic Armor) | **+2** | Only if target was stationary |
| **MAS** (Mimetic Armor) | **+3** | Only if target was stationary |
| **JMPS** (Jump Jets, Strong) | Add # to TMM | When target jumped |
| **JMPW** (Jump Jets, Weak) | Subtract # from TMM | When target jumped (min 0) |
| **LG** (Large) | No direct TN modifier | Occupies 2" diameter; not a to-hit mod |

> The app has `unit.abilities` array. The calculator should parse these and auto-apply modifiers based on user-selected target movement mode.

### 3.5 Critical Hits on Target (affecting its TMM)
| Crit Type | Effect on Target TMM | Source |
|-----------|---------------------|--------|
| **MP Hit** | Halve TMM (round down), min 0 | Target entry `crits.mp` |
| **Engine Hit** (Vehicle) | Halve TMM (round down) | Target entry `crits.engine` |

> The calculator should read the target's crit state and auto-adjust TMM.

### 3.6 Shutdown / Immobile
| Condition | TMM | Notes |
|-----------|-----|-------|
| Immobile (0" move, MP crit to 0) | **0** | Overrides card TMM |
| Shutdown (heat S) | **−4** | Applied to card TMM (usually results in 0) |

---

## 4. Range Modifiers

| Range Band | Distance | Modifier |
|------------|----------|----------|
| **Short** | 0–6" | **0** |
| **Medium** | 7–12" | **+2** |
| **Long** | 13–24" | **+4** |

- Minimum range: units without minimum range weapons can fire at 0" (base contact).
- Some special abilities override range (e.g., OVL for overheat at Long).
- Range is **not** pulled from unit data; user must select or input distance.

---

## 5. Other Modifiers

### 5.1 Attack-Type Modifiers
| Situation | Modifier | Notes |
|-----------|----------|-------|
| **Indirect Fire (IF)** | **+1** | Requires spotter with LOS; uses IF damage value |
| **Rear-Firing Weapons (REAR)** | **+1** | Attacking outside front arc with rear weapons; reduces forward damage |
| **Darkness / Night** | **+1 to +2** | SRCH ability ignores this |
| **Flak (FLK)** | Special | On miss by ≤2 vs airborne, deals FLK damage at that range |
| **Physical Attack** | Varies | Melee/DFA use different mods (not covered by standard SATOR) |

### 5.2 Network / Spotting Modifiers
| Situation | Modifier | Notes |
|-----------|----------|-------|
| **C3 Network** | Indirect only | C3 units share targeting data; does not directly reduce TN |
| **TAG / LTAG** | 0 | Designates target for guided/artillery munitions |
| **Narc / iNarc** | 0 | Missile homing beacon; affects damage, not TN |

### 5.3 Overheating (OV)
- Overheating adds heat but **does not modify to-hit TN**.
- It adds OV damage to the attack (if OV > 0 and user chooses to overheat).
- Some units have OVL (Overheat Long) allowing OV at Long range.

---

## 6. What the Calculator MUST Get Right

1. **Natural 12 always hits** — even if TN is 13+.
2. **Natural 2 always misses** — even if TN is 2.
3. **Minimum TN is 2** — cap the final TN at 2 (don't let it go below).
4. **Attacker and Target are distinct units** — the calculator needs both an attacker and a target selection.
5. **TMM is per-target, not per-attacker** — use the target's `unit.tmm` and movement mode.
6. **Movement mode must be asked for both attacker and target** — the app tracks damage/heat/crits but not "how far did this unit move this turn."
7. **Fire Control crits on the attacker add +2 each** — this is easy to miss.
8. **MP/Engine crits on the target reduce TMM** — halve and round down.
9. **Shutdown (heat S) on target gives TMM −4** — the app tracks heat per entry.
10. **Stealth (STL) modifiers depend on range band** — +1 at S/M, +2 at L (vs non-infantry).
11. **Mimetic armors (LMAS/MAS) only apply if target didn't move** — must check target movement mode.
12. **Immobilized = TMM 0** — regardless of card, crits, or jump status.

---

## 7. Unit Data Available for Prepopulation

### From `unit` object (card data):
| Field | Use in Calculator |
|-------|-------------------|
| `unit.id` | Identity |
| `unit.type` | Unit type (BM, IM, AF, etc.) — for unit-type modifiers |
| `unit.tmm` | Base Target Movement Modifier |
| `unit.move` | Movement string (e.g., `10"j`) — helps show Walk/Run/Jump options |
| `unit.damage.s` / `.m` / `.l` | Damage values (for context, not SATOR) |
| `unit.overheat` | OV value (for context) |
| `unit.abilities` | Array of special abilities (STL, LMAS, MAS, JMPS, JMPW, AFC, BFC, REAR, etc.) |
| `unit.armor` / `unit.structure` | For structural status (destroyed?) |
| `unit.skill` | Default skill if entry not yet set |

### From `entry` object (game state):
| Field | Use in Calculator |
|-------|-------------------|
| `entry.skill` | Attacker's current skill rating (0–6) |
| `entry.skillSet` | Whether skill has been explicitly set |
| `entry.heat` | Heat level (0, 1, 2, 3, "S") — S means shutdown |
| `entry.crits.fireControl` | # of fire control hits (+2 each to attacker TN) |
| `entry.crits.crew` | # of crew hits (+2 each to attacker TN, aerospace) |
| `entry.crits.mp` | MP hits (halve attacker's Move/TMM if self; halve target TMM if target) |
| `entry.crits.weapons` | Weapons hits (damage −1, context only) |
| `entry.crits.engine` | Engine hits (vehicle: halve Move/TMM/damage; 'Mech: +1 heat) |
| `entry.armorDamage` / `entry.structDamage` | Determine if unit is destroyed |

> **Note:** The app tracks heat and crits per-entry. The calculator dialog needs to let the user pick **two entries** (attacker and target) and read both states. Movement mode (Walk/Run/Jump/Stationary) is **NOT** tracked in state — it must be selected per-attack.

---

## 8. Recommended Calculator UI Fields

### Attacker Section (prepopulate from selected entry):
- **Unit name** (display only)
- **Skill** → `entry.skill`
- **Movement mode** → user selects: Stationary / Walk / Run / Jump
- **Crit: Fire Control** → `entry.crits.fireControl` (auto-add +2 per box)
- **Crit: Crew** → `entry.crits.crew` (aerospace only; auto-add +2 per box)
- **Unit type modifier** → derived from `unit.type` + `unit.abilities` (AFC negates IM penalty)

### Target Section (prepopulate from selected entry):
- **Unit name** (display only)
- **Base TMM** → `unit.tmm`
- **Movement mode** → user selects: Stationary / Walk / Run / Jump
- **Crit: MP** → `entry.crits.mp` (halve TMM, round down)
- **Crit: Engine** → `entry.crits.engine` (vehicle: halve TMM)
- **Heat** → `entry.heat` (if "S", TMM −4)
- **Special abilities** → parse `unit.abilities` for STL, LMAS, MAS, JMPS, JMPW
- **Terrain** → user selects: None / Light Woods / Heavy Woods / Partial Cover / Water / Smoke

### Attack Section:
- **Range** → user selects: Short (0) / Medium (+2) / Long (+4)
- **Special attack** → user selects: Normal / Indirect Fire (+1) / Rear Weapons (+1)

### Result:
- **Computed TN** = Skill + AttackerMove + TargetTMM + Terrain + Range + FireControlCrew + UnitType + Special
- **Minimum TN: 2**
- **Hit probability** (2d6 distribution): show % chance to hit
- **Dice roll input** (optional): user enters 2d6 result, app says Hit/Miss/Crit

---

## 9. Edge Cases & Reminders

- **Two Fire Control hits = +4 TN** (cumulative).
- **Target with JMPS2 that jumps → TMM +2** (adds to base TMM).
- **Target with JMPW1 that jumps → TMM −1** (min 0).
- **STL at Long range = +2** (not +1). At Short/Medium = +1.
- **LMAS/MAS are IGNORED if target moved** — the app must check target movement mode before applying.
- **If target is destroyed** (`armorDamage >= armor && structDamage >= struct`), it cannot be targeted.
- **Infantry TMM** — some infantry have TMM 0 even when moving; the app should still use `unit.tmm`.
- **Minimum Range** — some weapons have minimum ranges (not tracked per-weapon in AS); a companion app typically does not enforce this unless it tracks individual weapon loadouts.

---

*Report compiled from Alpha Strike Commander's Edition rules knowledge. Some values (e.g., exact Jump modifier, specific terrain modifiers) should be cross-checked against the latest AS:CE errata or rulebook PDF if available.*
