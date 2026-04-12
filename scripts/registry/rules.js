import dualFormWeapon from "../presets/dual-form-weapon.js";
import transformingWeaponScaling from "../presets/transforming-weapon-scaling.js";
import { deepClone, notify } from "../utils.js";

const RULES = new Map();

export function validateRule(rule) {
  const errors = [];

  if ( !rule?.id ) errors.push("Missing rule id.");
  if ( !rule?.label ) errors.push(`Rule ${rule?.id ?? "<unknown>"} is missing a label.`);
  if ( !rule?.defaultForm ) errors.push(`Rule ${rule?.id ?? "<unknown>"} is missing a default form.`);
  if ( !rule?.defaultState ) errors.push(`Rule ${rule?.id ?? "<unknown>"} is missing a default state.`);

  const hasForms = Object.keys(rule?.forms ?? {}).length > 0;
  const hasStates = Object.keys(rule?.states ?? {}).length > 0;
  if ( !hasForms && !hasStates ) errors.push(`Rule ${rule?.id ?? "<unknown>"} must define at least one form or state.`);

  if ( rule?.defaultForm && !rule.forms?.[rule.defaultForm] ) {
    errors.push(`Rule ${rule.id} default form "${rule.defaultForm}" is not defined.`);
  }

  if ( rule?.defaultState && !rule.states?.[rule.defaultState] ) {
    errors.push(`Rule ${rule.id} default state "${rule.defaultState}" is not defined.`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export function registerRule(rule) {
  const validation = validateRule(rule);
  if ( !validation.valid ) {
    notify(validation.errors.join(" "), "error");
    return false;
  }

  RULES.set(rule.id, deepClone(rule));
  return true;
}

export function registerBuiltInRules() {
  RULES.clear();
  registerRule(dualFormWeapon);
  registerRule(transformingWeaponScaling);
}

export function getRule(ruleId) {
  return deepClone(RULES.get(ruleId) ?? null);
}

export function hasRule(ruleId) {
  return RULES.has(ruleId);
}

export function listRules() {
  return Array.from(RULES.values())
    .map(rule => deepClone(rule))
    .sort((left, right) => left.label.localeCompare(right.label, game.i18n.lang));
}

export function listRuleChoices() {
  return listRules().map(rule => ({
    id: rule.id,
    label: rule.label
  }));
}
