import { EFFECTS, TRIGGERS } from "../constants.js";
import { syncManagedItem } from "./adapter-dnd5e.js";
import { evaluateCondition, evaluateRollFormula, matchesAvailability, resolveProfile } from "./formula-engine.js";
import { getRestrictions } from "./restriction-engine.js";
import {
  clearEnginePath,
  getCounter,
  getRuleForItem,
  resetCounterPath,
  setCounter,
  setForm,
  setRestrictionState,
  setState,
  updateEnginePath
} from "./state-engine.js";
import { buildTimerLine, postEngineChatCard } from "../ui/chat-controls.js";
import {
  coerceItem,
  getEngineState,
  humanize,
  notify,
  pathTail
} from "../utils.js";

function getCounterIdFromPath(path) {
  return String(path ?? "").split(".").at(-2) ?? pathTail(path);
}

function summarizeCounter(counterId, counter) {
  if ( !counter ) return `${humanize(counterId)} updated.`;
  const max = Number(counter.max ?? 0);
  if ( max > 0 ) return `${humanize(counterId)}: ${counter.current}/${counter.max}`;
  return `${humanize(counterId)}: ${counter.current}`;
}

function buildChatButtons(item) {
  const buttons = getAvailableActions(item).map(action => ({
    label: action.label,
    attributes: {
      "data-wfe-chat-action": "run-action",
      "data-action-id": action.id,
      "data-item-uuid": item.uuid
    }
  }));

  if ( hasMatchingTrigger(item, TRIGGERS.SUCCESSFUL_HIT) ) {
    buttons.push({
      label: game.i18n.localize("WFE.Button.ConfirmHit"),
      attributes: {
        "data-wfe-chat-action": "confirm-hit",
        "data-item-uuid": item.uuid
      }
    });
  }

  if ( hasMatchingTrigger(item, TRIGGERS.WORLD_TIME_UPDATE) ) {
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

function createWorkflowContext(item) {
  return {
    item,
    lines: [],
    results: {}
  };
}

async function applyEffect(item, effect, workflow) {
  switch ( effect.type ) {
    case EFFECTS.TRANSITION_FORM:
      await setForm(item, effect.to);
      workflow.lines.push(game.i18n.format("WFE.Message.FormChanged", { form: humanize(effect.to) }));
      return;

    case EFFECTS.TRANSITION_FORM_IF:
      if ( evaluateCondition(item, effect.condition) ) {
        await setForm(item, effect.to);
        workflow.lines.push(game.i18n.format("WFE.Message.FormChanged", { form: humanize(effect.to) }));
      }
      return;

    case EFFECTS.TRANSITION_STATE:
      await setState(item, effect.to);
      workflow.lines.push(game.i18n.format("WFE.Message.StateChanged", { state: humanize(effect.to) }));
      return;

    case EFFECTS.TRANSITION_STATE_IF:
      if ( evaluateCondition(item, effect.condition) ) {
        await setState(item, effect.to);
        workflow.lines.push(game.i18n.format("WFE.Message.StateChanged", { state: humanize(effect.to) }));
      }
      return;

    case EFFECTS.SET_COUNTER: {
      await setCounter(item, effect.counterId, effect.value);
      const counter = getCounter(item, effect.counterId);
      workflow.lines.push(summarizeCounter(effect.counterId, counter));
      return;
    }

    case EFFECTS.DECREMENT_COUNTER: {
      const path = effect.path ?? `counters.${effect.counterId}.current`;
      const current = Number(foundry.utils.getProperty(getEngineState(item), path) ?? 0);
      const amount = Number(effect.amount ?? 1);
      await updateEnginePath(item, path, Math.max(0, current - amount));
      const counter = getCounter(item, getCounterIdFromPath(path));
      workflow.lines.push(summarizeCounter(getCounterIdFromPath(path), counter));
      return;
    }

    case EFFECTS.INCREMENT_COUNTER: {
      const path = effect.path ?? `counters.${effect.counterId}.current`;
      const current = Number(foundry.utils.getProperty(getEngineState(item), path) ?? 0);
      const amount = Number(effect.amount ?? 1);
      const counterId = getCounterIdFromPath(path);
      const counter = getCounter(item, counterId) ?? {};
      const max = Number.isFinite(counter.max) ? counter.max : null;
      const value = max === null ? current + amount : Math.min(current + amount, max);
      await updateEnginePath(item, path, value);
      workflow.lines.push(summarizeCounter(counterId, getCounter(item, counterId)));
      return;
    }

    case EFFECTS.ROLL_TO_COUNTER: {
      const result = await evaluateRollFormula(item, effect.formula);
      const target = String(effect.target ?? "");
      await updateEnginePath(item, `${target}.current`, result.total);
      await updateEnginePath(item, `${target}.max`, result.total);
      const counterId = pathTail(target);
      workflow.results.lastRoll = result;
      workflow.lines.push(game.i18n.format("WFE.Message.CounterRolled", {
        counter: humanize(counterId),
        total: result.total
      }));
      return;
    }

    case EFFECTS.START_TIMER: {
      const now = Number(game.time?.worldTime ?? 0);
      const endsAt = now + Number(effect.durationSeconds ?? 0);
      await updateEnginePath(item, effect.startedAt ?? "timers.startedAt", now);
      await updateEnginePath(item, effect.endsAt ?? "timers.restoreAt", endsAt);
      workflow.lines.push(buildTimerLine(humanize(pathTail(effect.endsAt ?? "timers.restoreAt")), endsAt));
      return;
    }

    case EFFECTS.CLEAR_PATH:
      await clearEnginePath(item, effect.path);
      return;

    case EFFECTS.RESET_COUNTER:
      await resetCounterPath(item, effect.path);
      workflow.lines.push(game.i18n.format("WFE.Message.CounterReset", {
        counter: humanize(pathTail(effect.path))
      }));
      return;

    case EFFECTS.POST_CHAT_MESSAGE:
      if ( effect.message ) workflow.lines.push(effect.message);
      return;

    case EFFECTS.SET_RESTRICTION:
      await setRestrictionState(item, effect.restrictionId ?? pathTail(effect.path ?? ""), effect.value ?? { active: true });
      workflow.lines.push(game.i18n.localize("WFE.Message.RestrictionUpdated"));
      return;
  }
}

function getActionDefinition(item, actionId) {
  return getRuleForItem(item)?.actions?.[actionId] ?? null;
}

function getTriggerDefinitions(item, triggerId) {
  return getRuleForItem(item)?.triggers?.[triggerId] ?? [];
}

export function getAvailableActions(item) {
  const rule = getRuleForItem(item);
  if ( !rule ) return [];

  return Object.entries(rule.actions ?? {})
    .filter(([, action]) => matchesAvailability(item, action.availableWhen))
    .map(([id, action]) => ({
      id,
      label: action.label ?? humanize(id)
    }));
}

export function hasMatchingTrigger(item, triggerId) {
  const definitions = getTriggerDefinitions(item, triggerId);
  return definitions.some(definition => matchesAvailability(item, {
    forms: definition.fromForms,
    states: definition.fromStates,
    condition: definition.condition
  }));
}

async function finalizeWorkflow(item, workflow, title) {
  await syncManagedItem(item);
  const profile = resolveProfile(item);
  const restrictions = getRestrictions(item);

  if ( profile ) {
    workflow.lines.push(game.i18n.format("WFE.Message.CurrentProfile", {
      form: profile.formLabel,
      state: profile.stateLabel
    }));
  }

  if ( restrictions.length ) {
    workflow.lines.push(...restrictions.map(restriction => restriction.label));
  }

  const uniqueLines = Array.from(new Set(workflow.lines.filter(Boolean)));
  if ( uniqueLines.length ) {
    await postEngineChatCard(item, {
      title,
      lines: uniqueLines,
      buttons: buildChatButtons(item)
    });
  }

  return {
    item,
    profile,
    lines: uniqueLines
  };
}

export async function runAction(itemOrUuid, actionId) {
  const item = await coerceItem(itemOrUuid);
  if ( !item ) return null;

  const action = getActionDefinition(item, actionId);
  if ( !action ) {
    notify(game.i18n.format("WFE.Error.ActionMissing", { actionId }), "error");
    return null;
  }

  if ( !matchesAvailability(item, action.availableWhen) ) {
    notify(game.i18n.localize("WFE.Error.ActionUnavailable"), "warn");
    return null;
  }

  const workflow = createWorkflowContext(item);
  for ( const effect of action.effects ?? [] ) {
    await applyEffect(item, effect, workflow);
  }

  return finalizeWorkflow(item, workflow, action.label ?? humanize(actionId));
}

async function runTrigger(item, triggerId, title) {
  const definitions = getTriggerDefinitions(item, triggerId);
  if ( !definitions.length ) return null;

  const workflow = createWorkflowContext(item);
  let matched = false;

  for ( const definition of definitions ) {
    const available = matchesAvailability(item, {
      forms: definition.fromForms,
      states: definition.fromStates,
      condition: definition.condition
    });

    if ( !available ) continue;
    matched = true;
    for ( const effect of definition.effects ?? [] ) {
      await applyEffect(item, effect, workflow);
    }
  }

  if ( !matched ) return null;
  return finalizeWorkflow(item, workflow, title);
}

export async function handleSuccessfulHit(itemOrUuid) {
  const item = await coerceItem(itemOrUuid);
  if ( !item ) return null;
  return runTrigger(item, TRIGGERS.SUCCESSFUL_HIT, game.i18n.localize("WFE.Button.ConfirmHit"));
}

export async function checkTimers(itemOrUuid) {
  const item = await coerceItem(itemOrUuid);
  if ( !item ) return null;
  return runTrigger(item, TRIGGERS.WORLD_TIME_UPDATE, game.i18n.localize("WFE.Button.CheckTimers"));
}
