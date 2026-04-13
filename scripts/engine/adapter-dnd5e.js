import { MODULE_ID, SUPPORTED_SYSTEM_ID, TRIGGERS } from "../constants.js";
import { resolveProfile } from "./formula-engine.js";
import { ensureBaseSystemSnapshot, getRuleForItem } from "./state-engine.js";
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
  if ( !state ) return item;
  if ( !getRuleForItem(item) ) return item;

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

function getMessageFlagValue(message, paths) {
  for ( const path of paths ) {
    const value = foundry.utils.getProperty(message, path);
    if ( value !== undefined && value !== null ) return value;
  }
  return null;
}

function getMessageRollType(message) {
  return getMessageFlagValue(message, [
    "flags.dnd5e.roll.type",
    "flags.dnd5e.rollType",
    "flags.dnd5e.context.roll.type"
  ]);
}

function toHitEvidence(value) {
  if ( value === undefined || value === null ) return null;
  if ( typeof value === "boolean" ) return value;
  if ( typeof value === "number" ) return value > 0;
  if ( Array.isArray(value) ) return value.length > 0;
  if ( typeof value === "string" ) return value.trim().length > 0;
  return null;
}

function hasHitEvidence(message) {
  const evidencePaths = [
    "flags.dnd5e.roll.hitTargets",
    "flags.dnd5e.roll.hitTargetUuids",
    "flags.dnd5e.roll.hits",
    "flags.dnd5e.roll.isHit",
    "flags.dnd5e.targets",
    "flags.dnd5e.targetUuids"
  ];

  let sawEvidence = false;
  for ( const path of evidencePaths ) {
    const value = foundry.utils.getProperty(message, path);
    const resolved = toHitEvidence(value);
    if ( resolved === null ) continue;
    sawEvidence = true;
    if ( !resolved ) return false;
    if ( resolved ) return true;
  }

  if ( !sawEvidence ) return null;
  return false;
}

function getActorFromMessage(message) {
  const actorId = message?.speaker?.actor ?? null;
  if ( !actorId ) return null;
  return game.actors?.get(actorId) ?? null;
}

async function resolveItemFromMessage(message) {
  const itemUuid = getMessageFlagValue(message, [
    "flags.dnd5e.itemUuid",
    "flags.dnd5e.roll.itemUuid",
    "flags.dnd5e.item.uuid"
  ]);

  if ( itemUuid ) {
    const item = await fromUuid(itemUuid);
    if ( item instanceof Item ) return item;
  }

  const itemId = getMessageFlagValue(message, [
    "flags.dnd5e.itemId",
    "flags.dnd5e.roll.itemId",
    "flags.dnd5e.item.id",
    "flags.dnd5e.itemData._id"
  ]);
  if ( !itemId ) return null;

  const actor = getActorFromMessage(message);
  if ( actor?.items?.get(itemId) ) return actor.items.get(itemId);
  return game.items?.get(itemId) ?? null;
}

async function autoConfirmHitFromChatMessage(message) {
  if ( game.modules?.get("midi-qol")?.active ) return;
  if ( !game.user || message?.user?.id !== game.user.id ) return;

  const rollType = String(getMessageRollType(message) ?? "").toLowerCase();
  if ( !rollType.includes("damage") ) return;

  const hitEvidence = hasHitEvidence(message);
  if ( hitEvidence === false ) return;

  const item = await resolveItemFromMessage(message);
  if ( !(item instanceof Item) ) return;
  if ( !canManageItem(item) ) return;

  const rule = getRuleForItem(item);
  if ( !rule?.triggers?.[TRIGGERS.SUCCESSFUL_HIT]?.length ) return;

  await game.weaponFormEngine?.handleSuccessfulHit?.(item);
}

export function registerDnd5eAdapter() {
  if ( game.system?.id !== SUPPORTED_SYSTEM_ID ) {
    notify(game.i18n.localize("WFE.Error.UnsupportedSystem"), "warn");
    return;
  }

  if ( game[`${MODULE_ID}Dnd5eAutoConfirmReady`] ) return;
  game[`${MODULE_ID}Dnd5eAutoConfirmReady`] = true;

  Hooks.on("createChatMessage", message => {
    void autoConfirmHitFromChatMessage(message);
  });
}
