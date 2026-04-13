import { TRIGGERS } from "../constants.js";
import { matchesAvailability } from "../engine/formula-engine.js";
import { getRuleForItem } from "../engine/state-engine.js";
import { getBuiltinButtonLabels, resolveActionButtonLabel } from "./button-labels.js";

export function buildEngineButtonsForItem(item) {
  const rule = getRuleForItem(item);
  if ( !rule ) return [];
  const buttonLabels = getBuiltinButtonLabels(rule);

  const buttons = Object.entries(rule.actions ?? {})
    .filter(([, action]) => matchesAvailability(item, action.availableWhen))
    .map(([id, action]) => ({
      label: resolveActionButtonLabel(item, action, id),
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
      label: buttonLabels.confirmHit,
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
      label: buttonLabels.checkTimers,
      attributes: {
        "data-wfe-chat-action": "check-timers",
        "data-item-uuid": item.uuid
      }
    });
  }

  return buttons;
}
