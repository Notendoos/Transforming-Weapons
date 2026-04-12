import { FLAG_VERSION, MODULE_ID, MODULE_TITLE, SUPPORTED_ITEM_TYPE } from "./constants.js";

export function deepClone(data) {
  return foundry.utils.deepClone(data ?? {});
}

export function getProperty(object, path) {
  return foundry.utils.getProperty(object, path);
}

export function setProperty(object, path, value) {
  return foundry.utils.setProperty(object, path, value);
}

export function mergeObject(original, other, options={}) {
  return foundry.utils.mergeObject(original, other, { inplace: false, recursive: true, ...options });
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

export function humanize(value) {
  if ( !value ) return "";
  return String(value)
    .replaceAll(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replaceAll(/[_-]+/g, " ")
    .trim()
    .replaceAll(/\s+/g, " ")
    .replace(/\b\w/g, character => character.toUpperCase());
}

export function localize(key, fallback) {
  const localized = game.i18n.localize(key);
  return localized === key ? (fallback ?? key) : localized;
}

export function notify(message, type="warn", error) {
  const text = `${MODULE_TITLE}: ${message}`;
  ui.notifications?.[type]?.(text);
  if ( error ) {
    console.error(text, error);
    return;
  }
  if ( type === "error" ) console.error(text);
  else console.warn(text);
}

export function logError(message, error) {
  notify(message, "error", error);
}

export async function coerceItem(itemOrUuid) {
  if ( !itemOrUuid ) return null;
  if ( typeof itemOrUuid === "string" ) {
    const resolved = await fromUuid(itemOrUuid);
    return resolved instanceof Item ? resolved : null;
  }
  return itemOrUuid instanceof Item ? itemOrUuid : null;
}

export function isWeaponItem(item) {
  return item instanceof Item && (item.type === SUPPORTED_ITEM_TYPE);
}

export function ensureWeaponItem(item) {
  if ( isWeaponItem(item) ) return true;
  notify(localize("WFE.Error.UnsupportedItem", "Only dnd5e weapon items can use Weapon Form Engine."), "error");
  return false;
}

export function canManageItem(item) {
  if ( !item ) return false;
  if ( game.user?.isGM ) return true;
  return item.isOwner;
}

export function getEngineState(item) {
  return deepClone(getProperty(item, `flags.${MODULE_ID}`) ?? null);
}

export function hasManagedRule(item) {
  return Boolean(getEngineState(item)?.ruleId);
}

export function createDefaultMetadata(item, rule) {
  return {
    label: rule.label,
    initialized: true,
    managedItemType: item.type,
    baseName: item.name,
    baseSystem: null,
    updatedAt: Date.now()
  };
}

export function createBaseState(item, rule) {
  return {
    ruleId: rule.id,
    version: FLAG_VERSION,
    form: rule.defaultForm,
    state: rule.defaultState,
    counters: deepClone(rule.counters ?? {}),
    timers: deepClone(rule.timers ?? {}),
    restrictions: {},
    metadata: createDefaultMetadata(item, rule)
  };
}

export function updateTimestamp(state) {
  state.version = FLAG_VERSION;
  state.metadata ??= {};
  state.metadata.initialized = true;
  state.metadata.updatedAt = Date.now();
}

export function getWorldTime() {
  return Number(game.time?.worldTime ?? 0);
}

export function formatDuration(seconds) {
  const value = Math.max(0, Math.round(Number(seconds ?? 0)));
  if ( value >= 3600 ) {
    const hours = Math.floor(value / 3600);
    const minutes = Math.floor((value % 3600) / 60);
    return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  if ( value >= 60 ) {
    const minutes = Math.floor(value / 60);
    const remainder = value % 60;
    return remainder ? `${minutes}m ${remainder}s` : `${minutes}m`;
  }
  return `${value}s`;
}

export function formatTimerValue(value) {
  if ( value === null || value === undefined || value === "" ) return localize("WFE.Value.None", "None");
  if ( typeof value !== "number" ) return String(value);
  const remaining = value - getWorldTime();
  const suffix = remaining > 0 ? ` (${localize("WFE.Label.In", "in")} ${formatDuration(remaining)})` : "";
  return `${Math.round(value)}${suffix}`;
}

export function toPairs(object) {
  return Object.entries(object ?? {});
}

export function getSpeaker(item) {
  return ChatMessage.getSpeaker({
    actor: item.actor ?? null,
    token: item.actor?.getActiveTokens?.()[0]?.document ?? null,
    alias: item.actor?.name ?? item.name
  });
}

export function collectManagedWeapons() {
  const results = new Map();

  for ( const item of game.items ?? [] ) {
    if ( isWeaponItem(item) && hasManagedRule(item) ) results.set(item.uuid, item);
  }

  for ( const actor of game.actors ?? [] ) {
    for ( const item of actor.items ?? [] ) {
      if ( isWeaponItem(item) && hasManagedRule(item) ) results.set(item.uuid, item);
    }
  }

  return Array.from(results.values());
}

export function pathTail(path) {
  return String(path ?? "").split(".").at(-1) ?? "";
}
