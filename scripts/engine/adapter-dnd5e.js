import { SUPPORTED_SYSTEM_ID } from "../constants.js";
import { resolveProfile } from "./formula-engine.js";
import { ensureBaseSystemSnapshot } from "./state-engine.js";
import { canManageItem, coerceItem, deepClone, getEngineState, notify } from "../utils.js";

function cloneRange(item) {
  return deepClone(item.system?.range ?? {});
}

function cloneDamageParts(item) {
  return deepClone(item.system?.damage?.parts ?? []);
}

export function captureBaseSystemSnapshot(item) {
  return {
    weaponType: item.system?.type?.value ?? null,
    actionType: item.system?.actionType ?? null,
    ability: item.system?.ability ?? null,
    attackBonus: item.system?.attack?.bonus ?? "",
    attackFlat: item.system?.attack?.flat ?? false,
    magicalBonus: item.system?.magicalBonus ?? 0,
    damageParts: cloneDamageParts(item),
    versatileDamage: item.system?.damage?.versatile ?? "",
    range: cloneRange(item),
    chatFlavor: item.system?.chatFlavor ?? ""
  };
}

function buildDamageParts(formula, damageType, fallbackParts) {
  const parts = deepClone(fallbackParts ?? []);
  const first = [String(formula ?? ""), String(damageType ?? parts?.[0]?.[1] ?? "")];
  if ( parts.length ) parts[0] = first;
  else parts.push(first);
  return parts;
}

function normalizeDamageParts(parts, fallbackParts) {
  const normalized = deepClone(parts ?? [])
    .map(part => {
      if ( Array.isArray(part) ) return [String(part[0] ?? ""), String(part[1] ?? "")];
      if ( part && typeof part === "object" ) return [String(part.formula ?? part[0] ?? ""), String(part.type ?? part[1] ?? "")];
      return [String(part ?? ""), ""];
    })
    .filter(part => part[0] || part[1]);

  return normalized.length ? normalized : deepClone(fallbackParts ?? []);
}

function resolveRange(profileRange, fallbackRange) {
  if ( !profileRange ) return deepClone(fallbackRange ?? {});
  if ( typeof profileRange === "string" ) {
    if ( profileRange === "ranged" ) {
      return {
        value: fallbackRange?.value ?? 60,
        long: fallbackRange?.long ?? 240,
        units: fallbackRange?.units ?? "ft"
      };
    }

    return {
      value: fallbackRange?.value ?? 5,
      long: null,
      units: fallbackRange?.units ?? "ft"
    };
  }

  return {
    value: profileRange.mode === "ranged" ? (profileRange.value ?? fallbackRange?.value ?? 60) : (profileRange.reach ?? fallbackRange?.value ?? 5),
    long: profileRange.mode === "ranged" ? (profileRange.long ?? fallbackRange?.long ?? null) : null,
    units: profileRange.units ?? fallbackRange?.units ?? "ft"
  };
}

function resolveActionType(profile, baseSnapshot) {
  if ( profile.range?.mode ) return profile.range.mode;
  if ( profile.range === "ranged" ) return "ranged";
  if ( profile.range === "melee" ) return "melee";
  if ( profile.weaponType?.endsWith("R") ) return "ranged";
  if ( profile.weaponType?.endsWith("M") ) return "melee";
  return String(baseSnapshot?.actionType ?? "").startsWith("r") ? "ranged" : "melee";
}

function buildSystemUpdates(item, profile, state) {
  const baseSnapshot = state.metadata?.baseSystem ?? captureBaseSystemSnapshot(item);
  const updates = {};

  if ( profile.weaponType ?? baseSnapshot.weaponType ) {
    updates["system.type.value"] = profile.weaponType ?? baseSnapshot.weaponType;
  }

  const actionMode = resolveActionType(profile, baseSnapshot);
  updates["system.actionType"] = profile.actionType ?? (actionMode === "ranged" ? "rwak" : "mwak");
  updates["system.attack.bonus"] = String(profile.attackBonus ?? baseSnapshot.attackBonus ?? "");
  updates["system.attack.flat"] = Boolean(profile.attackFlat ?? baseSnapshot.attackFlat ?? false);
  updates["system.magicalBonus"] = Number(profile.magicalBonus ?? baseSnapshot.magicalBonus ?? 0);
  updates["system.chatFlavor"] = profile.chatFlavor ?? baseSnapshot.chatFlavor ?? "";

  updates["system.damage.parts"] = Array.isArray(profile.damageParts) && profile.damageParts.length
    ? normalizeDamageParts(profile.damageParts, baseSnapshot.damageParts)
    : buildDamageParts(
      profile.damageFormula ?? baseSnapshot.damageParts?.[0]?.[0] ?? "",
      profile.damageType ?? baseSnapshot.damageParts?.[0]?.[1] ?? "",
      baseSnapshot.damageParts
    );
  updates["system.damage.versatile"] = profile.versatileDamage ?? baseSnapshot.versatileDamage ?? "";

  updates["system.range"] = resolveRange(profile.range, baseSnapshot.range);
  updates["system.ability"] = profile.ability ?? baseSnapshot.ability ?? "";

  if ( !state.metadata?.baseSystem ) {
    updates["flags.weapon-form-engine.metadata.baseSystem"] = baseSnapshot;
  }

  return updates;
}

export async function syncManagedItem(itemOrUuid) {
  const item = await coerceItem(itemOrUuid);
  if ( !item ) return null;
  if ( game.system?.id !== SUPPORTED_SYSTEM_ID ) return item;
  if ( !canManageItem(item) ) return item;

  const state = getEngineState(item);
  if ( !state?.ruleId ) return item;

  const profile = resolveProfile(item);
  if ( !profile ) return item;

  try {
    if ( !state.metadata?.baseSystem ) {
      await ensureBaseSystemSnapshot(item, captureBaseSystemSnapshot(item));
    }

    const refreshedState = getEngineState(item);
    const updates = buildSystemUpdates(item, profile, refreshedState);
    await item.update(updates);
    return item;
  } catch (error) {
    notify(game.i18n.localize("WFE.Error.ProfileSyncFailed"), "error");
    console.error("Weapon Form Engine dnd5e profile sync failed", error);
    return item;
  }
}

export function registerDnd5eAdapter() {
  if ( game.system?.id !== SUPPORTED_SYSTEM_ID ) {
    notify(game.i18n.localize("WFE.Error.UnsupportedSystem"), "warn");
  }
}
