# Weapon Form Engine

Weapon Form Engine is a Foundry VTT module scaffold for Foundry VTT 12.331 and dnd5e 3.3.1+ that adds a generic rules engine for multi-form and stateful weapons.

## Included in this scaffold

- Built-in presets for `dual-form-weapon` and `transforming-weapon-scaling`
- Persistent item flags for form, state, counters, timers, restrictions, and metadata
- Public API exposed as `game.weaponFormEngine`
- dnd5e profile syncing for weapon damage, range, weapon type, and attack activity bonuses
- Item sheet controls for assigning rules and running actions
- Optional chat controls for common weapon actions

## Install note

Foundry expects the module folder name to match the package id. This package id is `weapon-form-engine`, so the module should live in a folder with that name inside your `Data/modules` directory.

## Quick usage

1. Open a dnd5e weapon item sheet.
2. Assign one of the built-in rules from the Weapon Form Engine panel.
3. Use the generated action buttons to switch forms, transform, restore, confirm hits, or check timers.
4. Use the public API from a macro when needed:

```js
const item = actor.items.getName("Shatterstar");
await game.weaponFormEngine.assignRule(item, "transforming-weapon-scaling");
await game.weaponFormEngine.runAction(item, "transform");
```
