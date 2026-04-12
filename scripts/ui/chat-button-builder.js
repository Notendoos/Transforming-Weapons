import { TRIGGERS } from "../constants.js";
import { matchesAvailability } from "../engine/formula-engine.js";
import { getRuleForItem } from "../engine/state-engine.js";
import { humanize } from "../utils.js";

export function buildEngineButtonsForItem(item) {
  const rule = getRuleForItem(item);
  if ( !rule ) return [];

  const buttons = Object.entries(rule.actions ?? {})
    .filter(([, action]) => matchesAvailability(item, action.availableWhen))
    .map(([id, action]) => ({
      label: action.label ?? humanize(id),
      attributes: {
        "data-wfe-chat-action": "run-action",
        "data-action-id": id,
        "data-item-uuid": item.uuid
      }
    }));

  const successfulHitTriggers = rule.triggers?.[TRIGGERS.SUCCESSFUL_HIT] ?? [];
  const hasSuccessfulHitTrigger = successfulHitTriggers.some(definition => matchesAvailability(item, {
    forms: definition.fromForms,
    states: definition.fromStates,
    condition: definition.condition
  }));

  if ( hasSuccessfulHitTrigger ) {
    buttons.push({
      label: game.i18n.localize("WFE.Button.ConfirmHit"),
      attributes: {
        "data-wfe-chat-action": "confirm-hit",
        "data-item-uuid": item.uuid
      }
    });
  }

  const timerTriggers = rule.triggers?.[TRIGGERS.WORLD_TIME_UPDATE] ?? [];
  const hasTimerTrigger = timerTriggers.some(definition => matchesAvailability(item, {
    forms: definition.fromForms,
    states: definition.fromStates,
    condition: definition.condition
  }));

  if ( hasTimerTrigger ) {
    buttons.push({
      label: game.i18n.localize("WFE.Button.CheckTimers"),
      attributes: {
        "data-wfe-chat-action": "check-timers",
        "data-item-uuid": item.uuid
      }
    });
  }

  return buttons;
}
