# Weapon Form Engine

## Current Implementation Specification

### Version 0.1.0

## 1. Status

This document reflects the **current implemented scaffold** in this repository, not the broader long-term design target from the earlier draft.

The module currently provides:

* a Foundry VTT module scaffold
* a rule registry with two built-in presets
* item flag state management for form/state/counters/timers
* a public API on `game.weaponFormEngine`
* dnd5e item-sheet integration
* chat-card controls for actions and timer checks
* dnd5e 3.3.1 weapon data synchronization
* optional Midi-QOL successful-hit integration

The current implementation is usable as a prototype and foundation, but it is not yet a fully complete rules platform.

---

## 2. Supported Environment

The module currently targets:

* Foundry Virtual Tabletop `12.331`
* dnd5e system `3.3.1` or later

This is reflected in [module.json](./module.json).

The current implementation is scoped to:

* `Item` documents of type `weapon`
* the `dnd5e` system only

---

## 3. Package Structure

The implemented package structure is:

```txt
weapon-form-engine/
  module.json
  README.md
  scripts/
    main.js
    constants.js
    utils.js
    api.js
    registry/
      rules.js
    engine/
      state-engine.js
      form-engine.js
      formula-engine.js
      restriction-engine.js
      trigger-engine.js
      timer-engine.js
      adapter-dnd5e.js
      adapter-midiqol.js
    presets/
      dual-form-weapon.js
      transforming-weapon-scaling.js
    ui/
      item-sheet.js
      chat-controls.js
  templates/
    rule-config.hbs
  styles/
    module.css
  lang/
    en.json
```

---

## 4. Core Concepts

### 4.1 Managed Weapon

A managed weapon is a `dnd5e` weapon item with module flags under `flags.weapon-form-engine`.

### 4.2 Rule Profile

A rule profile is a JavaScript object registered in the in-memory rule registry.

The current build includes two built-in presets:

* `dual-form-weapon`
* `transforming-weapon-scaling`

### 4.3 Form and State

Each managed weapon tracks:

* one active `form`
* one active `state`

These are persisted on the item document in module flags.

### 4.4 Counters

Counters are mutable numeric objects stored in module flags, typically with:

* `current`
* `max`

### 4.5 Timers

Timers are stored as numeric world-time values in module flags.

### 4.6 Restrictions

Restrictions are currently **displayed and resolved as advisory data**.

They are not generally enforced by the engine against core dnd5e usage or equipment changes.

---

## 5. Data Model

The current item flag shape is:

```json
{
  "flags": {
    "weapon-form-engine": {
      "ruleId": "dual-form-weapon",
      "version": 1,
      "form": "hammer",
      "state": "active",
      "counters": {},
      "timers": {},
      "restrictions": {},
      "metadata": {
        "label": "Dual-Form Weapon",
        "initialized": true,
        "managedItemType": "weapon",
        "baseName": "Weapon Name",
        "baseSystem": null,
        "updatedAt": 0
      }
    }
  }
}
```

### 5.1 Metadata Snapshot

When a managed weapon is synchronized to dnd5e item data for the first time, the engine stores a `metadata.baseSystem` snapshot.

This snapshot currently captures:

* `weaponType`
* `actionType`
* `ability`
* `attackBonus`
* `attackFlat`
* `magicalBonus`
* `damageParts`
* `versatileDamage`
* `range`
* `chatFlavor`

This is used as the base fallback when applying form-derived updates.

---

## 6. Rule Definition Format

The current rule format is declarative and code-defined.

### 6.1 Required Fields

Each registered rule must define:

* `id`
* `label`
* `defaultForm`
* `defaultState`
* at least one form or state collection

### 6.2 Common Fields in Current Use

The current implementation supports these rule sections:

* `forms`
* `states`
* `actions`
* `triggers`
* `counters`
* `timers`
* `restrictions`
* `passives`
* `ui`

### 6.3 Profile Fields Currently Resolved

Profile resolution currently merges only these profile keys:

* `label`
* `attackBonus`
* `damageFormula`
* `damageType`
* `range`
* `weaponType`
* `chatFlavor`

This means the engine does **not** currently resolve arbitrary custom profile fields during rule evaluation.

### 6.4 Profile Merge Order

The current profile resolver merges in this order:

1. `rule.profile`
2. active `form`
3. active `state`
4. `form.states[currentState]`

Only fields in the supported profile-key allowlist are included.

---

## 7. Implemented Effect Types

The current engine defines these built-in effect types:

* `transitionForm`
* `transitionFormIf`
* `transitionState`
* `transitionStateIf`
* `setCounter`
* `decrementCounter`
* `incrementCounter`
* `rollToCounter`
* `startTimer`
* `clearPath`
* `resetCounter`
* `postChatMessage`
* `setRestriction`

These are executed by `scripts/engine/trigger-engine.js`.

---

## 8. Implemented Trigger Types

The current engine supports these trigger ids:

* `onSuccessfulHit`
* `onWorldTimeUpdate`

### 8.1 Successful Hit

The core engine does not currently infer a successful hit from base dnd5e alone.

Successful-hit processing is currently driven by:

* the public API via `handleSuccessfulHit(item)`
* item-sheet button: `Confirm Hit`
* chat-card button: `Confirm Hit`
* optional Midi-QOL hook when the module is active

### 8.2 World Time Update

Timer processing is driven by:

* the public API via `checkTimers(item)` and `checkAllTimers()`
* item-sheet button: `Check Timers`
* chat-card button: `Check Timers`
* the `updateWorldTime` hook, currently GM-driven

---

## 9. Formula and Condition Context

The formula engine builds a roll/evaluation context from:

* `item.actor.getRollData()`
* `item.getRollData()`
* `rule` state from module flags
* `world.time`

This enables expressions such as:

* `@mod`
* `@details.level`
* `@rule.counters.resource.current`
* `@world.time`

Conditions are currently evaluated with:

* `Roll.replaceFormulaData(...)`
* `Roll.safeEval(...)` when available
* `foundry.utils.safeEval(...)` as fallback

---

## 10. Built-In Presets

### 10.1 `dual-form-weapon`

This preset currently models:

* `hammer` form
* `cannon` form
* `active` state
* actions:
  * `switchToHammer`
  * `switchToCannon`
* advisory restriction:
  * switching forms costs a bonus action

The profile differences currently include:

* attack bonus
* damage formula
* damage type
* range mode
* dnd5e weapon type

### 10.2 `transforming-weapon-scaling`

This preset currently models:

* forms:
  * `assembled`
  * `fragmented`
  * `stick`
* states:
  * `active`
  * `restoring`
* counter:
  * `resource`
* timers:
  * `startedAt`
  * `restoreAt`
* actions:
  * `transform`
  * `restore`
* triggers:
  * consume one resource on confirmed hit while fragmented
  * move to `stick` when resource reaches `0`
  * restore to `assembled` and `active` when timer completes
* advisory restriction:
  * switching away from stick costs a bonus action
* passives:
  * undead glow
  * fiend glow

---

## 11. dnd5e Synchronization

The current dnd5e adapter updates the weapon item directly after state changes.

### 11.1 Updated dnd5e Fields

The adapter currently writes:

* `system.type.value`
* `system.actionType`
* `system.attack.bonus`
* `system.attack.flat`
* `system.chatFlavor`
* `system.damage.parts`
* `system.damage.versatile`
* `system.range`
* `system.ability`

### 11.2 Damage Handling

The current adapter only rewrites the **first** entry in `system.damage.parts`.

It does not currently perform advanced merging of multiple damage parts or alternate mode-specific arrays.

### 11.3 Range Handling

The current adapter maps profile range data into the older dnd5e 3.3 range model:

* ranged profiles set `range.value` and optional `range.long`
* melee profiles currently map into `range.value` with no separate reach field handling in the item update

This is a practical compatibility adaptation, not a perfect representation of all melee reach semantics.

---

## 12. Public API

The module currently exposes:

```js
game.weaponFormEngine = {
  assignRule(item, ruleId),
  initialize(item),
  getForm(item),
  setForm(item, form),
  getState(item),
  setState(item, state),
  switchForm(item, form),
  getCounter(item, counterId),
  setCounter(item, counterId, value),
  adjustCounter(item, counterId, delta),
  resolveProfile(item),
  runAction(item, actionId),
  handleSuccessfulHit(item),
  checkTimers(item),
  checkAllTimers(),
  getRestrictions(item),
  getPassives(item),
  getRule(item),
  coerceItem(itemOrUuid)
};
```

### 12.1 Behavior Notes

Current API behavior:

* mutating methods are asynchronous
* `assignRule()` and `initialize()` also trigger dnd5e synchronization
* profile/state changes made through API wrappers also trigger dnd5e synchronization
* read methods return current rule/flag-derived data only

---

## 13. UI

### 13.1 Item Sheet

The current UI injects a compact panel into the existing dnd5e item sheet through the `renderItemSheet` hook.

The panel currently shows:

* rule selection
* current form
* current state
* attack bonus
* range label
* damage label
* counters
* timers
* restrictions
* passives
* available action buttons
* `Confirm Hit` button when relevant
* `Check Timers` button when relevant

The module does **not** currently add a dedicated sheet tab.

### 13.2 Chat Cards

The current engine posts custom chat cards for action and trigger results.

These cards can include:

* summary lines
* action buttons
* confirm-hit button
* timer-check button

---

## 14. Permissions

### 14.1 Current Intent

The intended behavior is:

* GMs can manage any weapon
* item owners can manage owned weapons

### 14.2 Current Implementation Reality

The current implementation enforces permission checks in some places, but not everywhere.

What is currently true:

* `assignRule()` checks ownership/GM permission
* item-sheet controls are disabled for users who do not pass `canManageItem(item)`
* dnd5e synchronization avoids applying updates when the caller cannot manage the item

What is **not yet fully enforced**:

* all lower-level mutating engine methods do not consistently gate themselves with permission checks
* chat-card button execution currently relies on the called API path rather than a separate permission enforcement layer

This should be treated as an implementation gap.

---

## 15. Error Handling

The current engine generally fails safely by:

* returning `null` for invalid or unavailable item/rule operations
* showing concise notifications through `ui.notifications`
* logging console errors for formula and synchronization failures

Covered failure cases currently include:

* missing rule id
* invalid form
* invalid state
* unsupported item type
* unavailable action
* profile-sync failure

---

## 16. Current Limitations

The current scaffold does **not** yet implement all features from the earlier draft.

Notable current limitations:

* no no-code rule builder
* no persistent user-authored rule storage UI
* no migration framework beyond the stored `version` field
* no generic system support beyond dnd5e
* no core dnd5e hit-confirmation hook without user interaction
* restrictions are advisory, not enforced against equipment switching or action economy
* passives are display-only metadata
* profile resolution only supports a fixed allowlist of fields
* rule validation is minimal and structural
* item-sheet integration is injected UI, not a custom application or tab

---

## 17. Acceptance Criteria for the Current Build

The current repository satisfies these practical prototype criteria:

1. A dnd5e weapon can be assigned a built-in rule profile.
2. The weapon persists form/state/counter/timer data in item flags.
3. The current weapon profile resolves from rule + form + state.
4. The built-in dual-form weapon can switch between two forms.
5. The transforming weapon can roll a resource pool during transform.
6. Confirmed hits can consume resource through manual/API/Midi-QOL flows.
7. Resource depletion can move the weapon to a fallback form.
8. Timed restoration can return the weapon to its base form and active state.
9. The item sheet displays form, state, counters, timers, restrictions, passives, and actions.
10. The module exposes a callable public API on `game.weaponFormEngine`.

---

## 18. Recommended Next Steps

The next implementation steps that would bring the code closer to the earlier full draft are:

* add consistent permission checks to all mutating paths
* add migration handlers for future flag schema changes
* broaden profile resolution beyond the current allowlist
* add stronger rule validation
* add core dnd5e automation hooks where possible
* enforce restrictions beyond UI display
* support external/custom rule registration workflows more explicitly
* improve dnd5e synchronization for richer damage/range/property changes

This document should now be treated as the source of truth for the **current codebase state**.
