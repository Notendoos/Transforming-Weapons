# Weapon Form Engine

Weapon Form Engine is a Foundry VTT module scaffold for Foundry VTT 12.331 and dnd5e 3.3.1+ that adds a generic rules engine for multi-form and stateful weapons.

## Included in this scaffold

- Built-in presets for `dual-form-weapon` and `transforming-weapon-scaling`
- Persistent item flags for form, state, counters, timers, restrictions, and metadata
- Public API exposed as `game.weaponFormEngine`
- dnd5e profile syncing for weapon damage, range, weapon type, and attack activity bonuses
- Item sheet controls for assigning rules and running actions
- Optional chat controls for common weapon actions

## Install by manifest URL

Once a GitHub release has been published, install the module in Foundry with:

```txt
https://github.com/Notendoos/Transforming-Weapons/releases/latest/download/module.json
```

In Foundry Setup:

1. Open `Add-on Modules`.
2. Click `Install Module`.
3. Paste the manifest URL above.
4. Install and enable `Weapon Form Engine` in your world.

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

## Custom JSON rules

The Weapon Engine tab now includes a `Custom Rule JSON` textarea.

Paste a full rule object there and click `Apply JSON Rule` to store the rule on that item directly, without registering new code in `scripts/presets/`.

The JSON format matches the normal rule structure used by the built-in presets, including:

- `forms`
- `states`
- `actions`
- `triggers`
- `counters`
- `timers`
- `restrictions`
- `passives`

Custom JSON rules can also use richer profile fields such as:

- `damageParts`
- `versatileDamage`
- `actionType`
- `ability`
- `attackFlat`
- `magicalBonus`

A ready-to-paste example for the Shatterstar weapon lives in `examples/shatterstar.json`.

## Release workflow

This repo includes a GitHub Actions release workflow in `.github/workflows/release.yml`.

To publish an installable release:

1. Update `module.json` version and release URLs if needed.
2. Commit and push to `main`.
3. Create and push a tag matching the manifest version with a `v` prefix, for example `v0.1.1`.
4. GitHub Actions will build:
   - `dist/module.json`
   - `dist/weapon-form-engine-v0.1.1.zip`
5. The workflow will attach both files to a GitHub release.

You can also build the release archive locally with:

```bash
python tools/build-release.py
```
