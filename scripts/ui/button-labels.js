import { getRuleForItem } from "../engine/state-engine.js";
import { humanize } from "../utils.js";

function resolveBuiltinButtonLabel(rule, labelId, fallback) {
  const customLabel = rule?.ui?.buttonLabels?.[labelId];
  return String(customLabel ?? fallback ?? "").trim() || fallback;
}

export function getBuiltinButtonLabels(rule) {
  return {
    assignRule: resolveBuiltinButtonLabel(rule, "assignRule", game.i18n.localize("WFE.Button.AssignRule")),
    applyJsonRule: resolveBuiltinButtonLabel(rule, "applyJsonRule", game.i18n.localize("WFE.Button.ApplyJsonRule")),
    loadStarterRule: resolveBuiltinButtonLabel(rule, "loadStarterRule", game.i18n.localize("WFE.Button.LoadStarterRule")),
    loadManagedRule: resolveBuiltinButtonLabel(rule, "loadManagedRule", game.i18n.localize("WFE.Button.LoadManagedRule")),
    initialize: resolveBuiltinButtonLabel(rule, "initialize", game.i18n.localize("WFE.Button.Initialize")),
    confirmHit: resolveBuiltinButtonLabel(rule, "confirmHit", game.i18n.localize("WFE.Button.ConfirmHit")),
    checkTimers: resolveBuiltinButtonLabel(rule, "checkTimers", game.i18n.localize("WFE.Button.CheckTimers"))
  };
}

export function getBuiltinButtonLabelsForItem(item) {
  return getBuiltinButtonLabels(getRuleForItem(item));
}

export function resolveActionButtonLabel(action, actionId) {
  return String(action?.buttonLabel ?? action?.label ?? humanize(actionId)).trim() || humanize(actionId);
}
