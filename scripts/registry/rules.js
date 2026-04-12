import dualFormWeapon from "../presets/dual-form-weapon.js";
import transformingWeaponScaling from "../presets/transforming-weapon-scaling.js";
import { deepClone, humanize, notify, slugify } from "../utils.js";

const RULES = new Map();

export function prepareRule(rule, defaults={}) {
  const prepared = deepClone(rule ?? {});

  prepared.id = String(prepared.id ?? defaults.id ?? slugify(prepared.label ?? defaults.label ?? "custom-rule")).trim();
  if ( !prepared.id ) prepared.id = "custom-rule";

  prepared.label = String(prepared.label ?? defaults.label ?? humanize(prepared.id)).trim() || humanize(prepared.id);
  prepared.forms ??= {};
  prepared.states ??= {};

  if ( !Object.keys(prepared.states).length ) {
    prepared.states.active = { label: "Active" };
  }

  if ( !prepared.defaultForm ) {
    const firstForm = Object.keys(prepared.forms).at(0);
    if ( firstForm ) prepared.defaultForm = firstForm;
  }

  if ( !prepared.defaultState ) {
    const firstState = Object.keys(prepared.states).at(0);
    if ( firstState ) prepared.defaultState = firstState;
  }

  prepared.profile ??= {};
  prepared.counters ??= {};
  prepared.timers ??= {};
  prepared.restrictions ??= {};
  prepared.passives ??= {};
  prepared.actions ??= {};
  prepared.triggers ??= {};
  prepared.ui ??= {};

  return prepared;
}

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
  const prepared = prepareRule(rule);
  const validation = validateRule(prepared);
  if ( !validation.valid ) {
    notify(validation.errors.join(" "), "error");
    return false;
  }

  RULES.set(prepared.id, deepClone(prepared));
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
