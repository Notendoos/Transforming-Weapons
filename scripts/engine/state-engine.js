import { FLAG_VERSION, MODULE_ID } from "../constants.js";
import { getRule, prepareRule, validateRule } from "../registry/rules.js";
import {
  canManageItem,
  coerceItem,
  createBaseState,
  deepClone,
  ensureWeaponItem,
  getEngineState,
  notify,
  setProperty,
  slugify,
  updateTimestamp
} from "../utils.js";

async function persistState(item, state) {
  updateTimestamp(state);
  await item.update({ [`flags.${MODULE_ID}`]: state });
  return item;
}

function buildManagedState(item, rule, extraMetadata={}) {
  const state = createBaseState(item, rule);
  state.version = FLAG_VERSION;
  state.metadata = {
    ...state.metadata,
    enabled: true,
    ...deepClone(extraMetadata)
  };
  return state;
}

function buildCustomRuleDefaults(item, rule={}) {
  return {
    id: slugify(rule.id ?? rule.label ?? item?.name ?? "custom-weapon", "custom-weapon"),
    label: String(rule.label ?? item?.name ?? "Custom Weapon").trim() || "Custom Weapon"
  };
}

function prepareCustomRule(item, ruleInput) {
  if ( typeof ruleInput === "string" ) {
    if ( !ruleInput.trim() ) {
      notify(game.i18n.localize("WFE.Error.EmptyRuleJson"), "warn");
      return null;
    }

    try {
      return prepareCustomRule(item, JSON.parse(ruleInput));
    } catch (error) {
      notify(game.i18n.localize("WFE.Error.InvalidRuleJson"), "error", error);
      return null;
    }
  }

  const rule = prepareRule(ruleInput, buildCustomRuleDefaults(item, ruleInput));
  const validation = validateRule(rule);
  if ( !validation.valid ) {
    notify(validation.errors.join(" "), "error");
    return null;
  }

  return rule;
}

export async function assignRule(itemOrUuid, ruleId) {
  const item = await coerceItem(itemOrUuid);
  if ( !item || !ensureWeaponItem(item) ) return null;
  if ( !canManageItem(item) ) {
    notify(game.i18n.localize("WFE.Error.NoPermission"), "error");
    return null;
  }

  const rule = getRule(ruleId);
  if ( !rule ) {
    notify(game.i18n.format("WFE.Error.RuleMissing", { ruleId }), "error");
    return null;
  }

  const state = buildManagedState(item, rule);
  return persistState(item, state);
}

export async function assignCustomRule(itemOrUuid, ruleInput) {
  const item = await coerceItem(itemOrUuid);
  if ( !item || !ensureWeaponItem(item) ) return null;
  if ( !canManageItem(item) ) {
    notify(game.i18n.localize("WFE.Error.NoPermission"), "error");
    return null;
  }

  const rule = prepareCustomRule(item, ruleInput);
  if ( !rule ) return null;

  const state = buildManagedState(item, rule, {
    customRule: rule,
    customRuleSource: JSON.stringify(rule, null, 2)
  });
  return persistState(item, state);
}

export async function initialize(itemOrUuid) {
  const item = await coerceItem(itemOrUuid);
  if ( !item || !ensureWeaponItem(item) ) return null;

  const current = getEngineState(item);
  const ruleId = current?.ruleId;
  if ( !ruleId ) {
    notify(game.i18n.localize("WFE.Error.InitializeWithoutRule"), "error");
    return null;
  }

  if ( current?.metadata?.customRule ) {
    return assignCustomRule(item, current.metadata.customRuleSource || current.metadata.customRule);
  }

  return assignRule(item, ruleId);
}

export function isEngineEnabled(item) {
  const state = getEngineState(item);
  if ( !state ) return false;
  if ( typeof state.metadata?.enabled === "boolean" ) return state.metadata.enabled;
  return Boolean(state.ruleId || state.metadata?.customRule);
}

export async function setEnabled(itemOrUuid, enabled) {
  const item = await coerceItem(itemOrUuid);
  if ( !item || !ensureWeaponItem(item) ) return null;
  if ( !canManageItem(item) ) {
    notify(game.i18n.localize("WFE.Error.NoPermission"), "error");
    return null;
  }

  const current = getEngineState(item);
  if ( !current ) {
    if ( !enabled ) return item;

    const next = {
      ruleId: null,
      version: FLAG_VERSION,
      form: null,
      state: null,
      counters: {},
      timers: {},
      restrictions: {},
      metadata: {
        label: item.name,
        initialized: false,
        managedItemType: item.type,
        baseName: item.name,
        baseSystem: null,
        customRule: null,
        customRuleSource: "",
        enabled: true,
        updatedAt: Date.now()
      }
    };
    return persistState(item, next);
  }

  const next = deepClone(current);
  next.metadata ??= {};
  next.metadata.enabled = Boolean(enabled);
  return persistState(item, next);
}

export function getRuleForItem(item) {
  if ( !isEngineEnabled(item) ) return null;

  const state = getEngineState(item);
  if ( state?.metadata?.customRule ) {
    return prepareRule(state.metadata.customRule, buildCustomRuleDefaults(item, state.metadata.customRule));
  }

  const ruleId = state?.ruleId;
  return ruleId ? getRule(ruleId) : null;
}

export function getCustomRuleSource(item) {
  const state = getEngineState(item);
  const source = state?.metadata?.customRuleSource;
  if ( source ) return source;

  if ( state?.metadata?.customRule ) {
    return JSON.stringify(prepareRule(state.metadata.customRule, buildCustomRuleDefaults(item, state.metadata.customRule)), null, 2);
  }

  return "";
}

export function getForm(item) {
  return getEngineState(item)?.form ?? null;
}

export function getState(item) {
  return getEngineState(item)?.state ?? null;
}

export async function setForm(itemOrUuid, form) {
  const item = await coerceItem(itemOrUuid);
  if ( !item ) return null;

  const current = getEngineState(item);
  const rule = getRuleForItem(item);
  if ( !current || !rule ) {
    notify(game.i18n.localize("WFE.Error.ItemNotManaged"), "error");
    return null;
  }

  if ( !rule.forms?.[form] ) {
    notify(game.i18n.format("WFE.Error.InvalidForm", { form }), "error");
    return null;
  }

  const next = deepClone(current);
  next.form = form;
  return persistState(item, next);
}

export async function setState(itemOrUuid, stateName) {
  const item = await coerceItem(itemOrUuid);
  if ( !item ) return null;

  const current = getEngineState(item);
  const rule = getRuleForItem(item);
  if ( !current || !rule ) {
    notify(game.i18n.localize("WFE.Error.ItemNotManaged"), "error");
    return null;
  }

  if ( !rule.states?.[stateName] ) {
    notify(game.i18n.format("WFE.Error.InvalidState", { state: stateName }), "error");
    return null;
  }

  const next = deepClone(current);
  next.state = stateName;
  return persistState(item, next);
}

export function getCounter(item, counterId) {
  return deepClone(getEngineState(item)?.counters?.[counterId] ?? null);
}

export async function setCounter(itemOrUuid, counterId, value) {
  const item = await coerceItem(itemOrUuid);
  if ( !item ) return null;

  const current = getEngineState(item);
  if ( !current ) return null;

  const next = deepClone(current);
  next.counters ??= {};
  next.counters[counterId] ??= { current: 0, max: 0 };

  if ( typeof value === "number" ) next.counters[counterId].current = value;
  else next.counters[counterId] = deepClone(value ?? { current: 0, max: 0 });

  return persistState(item, next);
}

export async function adjustCounter(itemOrUuid, counterId, delta) {
  const item = await coerceItem(itemOrUuid);
  if ( !item ) return null;

  const current = getEngineState(item);
  if ( !current ) return null;

  const next = deepClone(current);
  next.counters ??= {};
  const counter = next.counters[counterId] ??= { current: 0, max: 0 };
  const max = Number.isFinite(counter.max) ? counter.max : null;
  const adjusted = Number(counter.current ?? 0) + Number(delta ?? 0);
  counter.current = Math.max(0, max === null ? adjusted : Math.min(adjusted, max));
  return persistState(item, next);
}

export async function updateEnginePath(itemOrUuid, path, value) {
  const item = await coerceItem(itemOrUuid);
  if ( !item ) return null;

  const current = getEngineState(item);
  if ( !current ) return null;

  const next = deepClone(current);
  setProperty(next, path, value);
  return persistState(item, next);
}

export async function clearEnginePath(itemOrUuid, path) {
  return updateEnginePath(itemOrUuid, path, null);
}

export async function resetCounterPath(itemOrUuid, path) {
  const item = await coerceItem(itemOrUuid);
  if ( !item ) return null;

  const current = getEngineState(item);
  const rule = getRuleForItem(item);
  if ( !current || !rule ) return null;

  const next = deepClone(current);
  const counterId = String(path).split(".").at(-1);
  const baseCounter = deepClone(rule.counters?.[counterId] ?? { current: 0, max: 0 });
  setProperty(next, path, baseCounter);
  return persistState(item, next);
}

export async function updateState(itemOrUuid, mutate) {
  const item = await coerceItem(itemOrUuid);
  if ( !item ) return null;

  const current = getEngineState(item);
  if ( !current ) return null;

  const next = deepClone(current);
  await mutate(next, current);
  return persistState(item, next);
}

export function getRestrictionState(item, restrictionId) {
  return deepClone(getEngineState(item)?.restrictions?.[restrictionId] ?? null);
}

export async function setRestrictionState(itemOrUuid, restrictionId, value) {
  const item = await coerceItem(itemOrUuid);
  if ( !item ) return null;

  const current = getEngineState(item);
  if ( !current ) return null;

  const next = deepClone(current);
  next.restrictions ??= {};
  next.restrictions[restrictionId] = deepClone(value);
  return persistState(item, next);
}

export async function ensureBaseSystemSnapshot(itemOrUuid, snapshot) {
  const item = await coerceItem(itemOrUuid);
  if ( !item ) return null;

  const current = getEngineState(item);
  if ( !current ) return null;
  if ( current.metadata?.baseSystem ) return item;

  const next = deepClone(current);
  next.metadata ??= {};
  next.metadata.baseSystem = deepClone(snapshot);
  return persistState(item, next);
}
