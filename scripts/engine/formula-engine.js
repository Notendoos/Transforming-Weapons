import { PROFILE_KEYS } from "../constants.js";
import { getRuleForItem } from "./state-engine.js";
import { deepClone, getEngineState, getWorldTime, humanize, localize, mergeObject } from "../utils.js";

function safeEval(expression) {
  if ( Roll.safeEval ) return Roll.safeEval(expression);
  return foundry.utils.safeEval(expression);
}

function extractProfileFragment(source) {
  const fragment = {};
  const input = source?.profile ? source.profile : source;
  if ( !input ) return fragment;

  for ( const key of PROFILE_KEYS ) {
    if ( key in input ) fragment[key] = deepClone(input[key]);
  }

  return fragment;
}

export function buildFormulaContext(item, extra={}) {
  const actorData = item.actor?.getRollData?.() ?? {};
  const ruleState = getEngineState(item) ?? {};
  const itemData = item.getRollData?.() ?? {};
  const context = mergeObject(actorData, {
    item: {
      ...itemData,
      name: item.name,
      uuid: item.uuid
    },
    rule: ruleState,
    world: {
      time: getWorldTime()
    }
  });

  return mergeObject(context, extra);
}

function mergeProfile(base, patch) {
  return foundry.utils.mergeObject(base, patch, { inplace: false, recursive: true });
}

function resolveRangeLabel(range) {
  if ( !range ) return localize("WFE.Value.None", "None");
  if ( typeof range === "string" ) return humanize(range);
  if ( range.mode === "ranged" ) {
    const value = range.value ?? 0;
    const long = range.long ? `/${range.long}` : "";
    const units = range.units ?? "ft";
    return `${localize("WFE.Profile.Ranged", "Ranged")} ${value}${long} ${units}`;
  }

  const reach = range.reach ?? 5;
  const units = range.units ?? "ft";
  return `${localize("WFE.Profile.Melee", "Melee")} ${reach} ${units}`;
}

function resolveDamageSummary(profile) {
  if ( Array.isArray(profile?.damageParts) && profile.damageParts.length ) {
    return profile.damageParts
      .map(part => {
        if ( Array.isArray(part) ) return [part[0], part[1]].filter(Boolean).join(" ");
        if ( part && typeof part === "object" ) return [part.formula ?? part[0], part.type ?? part[1]].filter(Boolean).join(" ");
        return String(part ?? "");
      })
      .filter(Boolean)
      .join(", ");
  }

  return [profile?.damageFormula, profile?.damageType].filter(Boolean).join(" ");
}

export function resolveProfile(item) {
  const rule = getRuleForItem(item);
  const state = getEngineState(item);
  if ( !rule || !state ) return null;

  const formDefinition = deepClone(rule.forms?.[state.form] ?? {});
  const stateDefinition = deepClone(rule.states?.[state.state] ?? {});

  let resolved = extractProfileFragment(rule.profile);
  resolved = mergeProfile(resolved, extractProfileFragment(formDefinition));
  resolved = mergeProfile(resolved, extractProfileFragment(stateDefinition));

  const formStateDefinition = deepClone(formDefinition.states?.[state.state] ?? {});
  resolved = mergeProfile(resolved, extractProfileFragment(formStateDefinition));

  resolved.form = state.form;
  resolved.formLabel = formDefinition.label ?? humanize(state.form);
  resolved.state = state.state;
  resolved.stateLabel = stateDefinition.label ?? humanize(state.state);
  resolved.rangeLabel = resolveRangeLabel(resolved.range);
  resolved.damageSummary = resolveDamageSummary(resolved);
  if ( !resolved.damageFormula && Array.isArray(resolved.damageParts) && resolved.damageParts.length ) {
    resolved.damageFormula = String(resolved.damageParts[0]?.[0] ?? "");
    resolved.damageType = String(resolved.damageParts[0]?.[1] ?? "");
  }
  resolved.label = resolved.label ?? resolved.formLabel;

  return resolved;
}

export function evaluateCondition(item, condition, extra={}) {
  if ( !condition ) return true;

  try {
    const resolved = Roll.replaceFormulaData(String(condition), buildFormulaContext(item, extra), { missing: "0" });
    return Boolean(safeEval(resolved));
  } catch (error) {
    console.error("Weapon Form Engine condition evaluation failed", { condition, error });
    return false;
  }
}

function compareValue(current, expected) {
  if ( expected === undefined || expected === null ) return true;
  if ( Array.isArray(expected) ) return expected.includes(current);
  return current === expected;
}

function compareExcluded(current, expected) {
  if ( expected === undefined || expected === null ) return true;
  if ( Array.isArray(expected) ) return !expected.includes(current);
  return current !== expected;
}

export function matchesAvailability(item, availability, extra={}) {
  if ( !availability ) return true;

  const state = getEngineState(item);
  if ( !state ) return false;

  if ( !compareValue(state.form, availability.form) ) return false;
  if ( !compareValue(state.form, availability.forms) ) return false;
  if ( !compareValue(state.state, availability.state) ) return false;
  if ( !compareValue(state.state, availability.states) ) return false;
  if ( !compareExcluded(state.form, availability.notForm) ) return false;
  if ( !compareExcluded(state.form, availability.notForms) ) return false;
  if ( !compareExcluded(state.state, availability.notState) ) return false;
  if ( !compareExcluded(state.state, availability.notStates) ) return false;

  return evaluateCondition(item, availability.condition, extra);
}

export async function evaluateRollFormula(item, formula, extra={}) {
  const roll = await new Roll(String(formula), buildFormulaContext(item, extra)).evaluate({ async: true });
  return {
    roll,
    total: Number(roll.total ?? 0),
    formula: roll.formula
  };
}
