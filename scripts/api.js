import { syncManagedItem } from "./engine/adapter-dnd5e.js";
import { switchForm } from "./engine/form-engine.js";
import { resolveProfile } from "./engine/formula-engine.js";
import { getRestrictions } from "./engine/restriction-engine.js";
import {
  adjustCounter,
  assignRule,
  assignCustomRule,
  getCounter,
  getCustomRuleSource,
  getForm,
  getRuleForItem,
  getState,
  initialize,
  setCounter,
  setForm,
  setState
} from "./engine/state-engine.js";
import { checkAllTimers } from "./engine/timer-engine.js";
import { checkTimers, handleSuccessfulHit, runAction } from "./engine/trigger-engine.js";
import { coerceItem } from "./utils.js";

async function syncAfter(resultingItemPromise) {
  const item = await resultingItemPromise;
  if ( item ) await syncManagedItem(item);
  return item;
}

export function createApi() {
  return {
    assignRule: async (item, ruleId) => syncAfter(assignRule(item, ruleId)),
    assignCustomRule: async (item, ruleInput) => syncAfter(assignCustomRule(item, ruleInput)),
    initialize: async item => syncAfter(initialize(item)),
    getForm,
    setForm: async (item, form) => syncAfter(setForm(item, form)),
    getState,
    setState: async (item, state) => syncAfter(setState(item, state)),
    switchForm,
    getCounter,
    setCounter: async (item, counterId, value) => syncAfter(setCounter(item, counterId, value)),
    adjustCounter: async (item, counterId, delta) => syncAfter(adjustCounter(item, counterId, delta)),
    resolveProfile,
    runAction,
    handleSuccessfulHit,
    checkTimers,
    checkAllTimers,
    getRestrictions,
    getPassives: item => Object.entries(getRuleForItem(item)?.passives ?? {}).map(([id, passive]) => ({
      id,
      ...passive
    })),
    getRule: item => getRuleForItem(item),
    getCustomRuleSource,
    coerceItem
  };
}
