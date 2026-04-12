import { getRuleForItem } from "./state-engine.js";
import { matchesAvailability } from "./formula-engine.js";
import { getEngineState, humanize } from "../utils.js";

function normalizeRestriction(id, restriction, source) {
  return {
    id,
    label: restriction.label ?? humanize(id),
    when: restriction.when ?? null,
    effect: restriction.effect ?? {},
    source
  };
}

export function getRestrictions(item) {
  const rule = getRuleForItem(item);
  const state = getEngineState(item);
  if ( !rule || !state ) return [];

  const restrictions = [];

  for ( const [id, restriction] of Object.entries(rule.restrictions ?? {}) ) {
    if ( matchesAvailability(item, restriction.when) ) {
      restrictions.push(normalizeRestriction(id, restriction, "rule"));
    }
  }

  for ( const [id, restriction] of Object.entries(state.restrictions ?? {}) ) {
    if ( !restriction ) continue;
    if ( restriction.active === false ) continue;
    restrictions.push(normalizeRestriction(id, restriction, "state"));
  }

  return restrictions;
}
