import { TEMPLATE_PATH, TRIGGERS } from "../constants.js";
import { resolveProfile } from "../engine/formula-engine.js";
import { getRestrictions } from "../engine/restriction-engine.js";
import { getAvailableActions, hasMatchingTrigger } from "../engine/trigger-engine.js";
import { getRuleForItem } from "../engine/state-engine.js";
import { listRuleChoices } from "../registry/rules.js";
import {
  canManageItem,
  formatTimerValue,
  getEngineState,
  humanize,
  isWeaponItem,
  toPairs
} from "../utils.js";

function buildSheetContext(item) {
  const state = getEngineState(item);
  const rule = getRuleForItem(item);
  const profile = resolveProfile(item);
  const restrictions = getRestrictions(item);
  const actions = getAvailableActions(item);

  const counters = toPairs(state?.counters).map(([id, counter]) => ({
    id,
    label: humanize(id),
    value: Number.isFinite(counter?.max) && (counter.max > 0)
      ? `${counter.current ?? 0}/${counter.max}`
      : `${counter?.current ?? 0}`
  }));

  const timers = toPairs(state?.timers).map(([id, value]) => ({
    id,
    label: humanize(id),
    value: formatTimerValue(value)
  }));

  const passives = toPairs(rule?.passives).map(([id, passive]) => ({
    id,
    label: passive.label ?? humanize(id)
  }));

  const ruleChoices = listRuleChoices().map(choice => ({
    ...choice,
    selected: choice.id === state?.ruleId
  }));

  return {
    canManage: canManageItem(item),
    isManaged: Boolean(rule),
    ruleChoices,
    summary: rule?.ui?.summary ?? "",
    currentForm: profile?.formLabel ?? humanize(state?.form),
    currentState: profile?.stateLabel ?? humanize(state?.state),
    attackBonus: profile?.attackBonus ?? null,
    damageFormula: profile?.damageFormula ?? null,
    damageType: profile?.damageType ?? null,
    rangeLabel: profile?.rangeLabel ?? null,
    counters,
    timers,
    restrictions,
    passives,
    actions,
    hasCounters: counters.length > 0,
    hasTimers: timers.length > 0,
    hasRestrictions: restrictions.length > 0,
    hasPassives: passives.length > 0,
    hasActions: actions.length > 0,
    showConfirmHit: rule ? hasMatchingTrigger(item, TRIGGERS.SUCCESSFUL_HIT) : false,
    showTimerCheck: rule ? hasMatchingTrigger(item, TRIGGERS.WORLD_TIME_UPDATE) : false
  };
}

function findTarget(root) {
  return root.querySelector(".tab[data-tab='details']")
    ?? root.querySelector(".tab.details")
    ?? root.querySelector(".sheet-body")
    ?? root.querySelector("form")
    ?? root;
}

async function injectPanel(item, html) {
  const root = html?.jquery ? html[0] : html;
  if ( !root || !isWeaponItem(item) ) return;

  root.querySelectorAll(".wfe-panel").forEach(panel => panel.remove());

  const target = findTarget(root);
  const wrapper = document.createElement("section");
  wrapper.className = "wfe-panel";
  wrapper.innerHTML = await renderTemplate(TEMPLATE_PATH, buildSheetContext(item));
  target.appendChild(wrapper);
  activateListeners(wrapper, item.uuid);
}

function activateListeners(root, itemUuid) {
  root.querySelector(".wfe-assign-rule")?.addEventListener("click", async event => {
    event.preventDefault();
    const select = root.querySelector(".wfe-rule-select");
    if ( !select?.value ) return;
    const item = await fromUuid(itemUuid);
    await game.weaponFormEngine?.assignRule(item, select.value);
  });

  root.querySelector(".wfe-initialize-rule")?.addEventListener("click", async event => {
    event.preventDefault();
    const item = await fromUuid(itemUuid);
    await game.weaponFormEngine?.initialize(item);
  });

  root.querySelectorAll("[data-wfe-action-id]").forEach(button => {
    button.addEventListener("click", async event => {
      event.preventDefault();
      const item = await fromUuid(itemUuid);
      await game.weaponFormEngine?.runAction(item, button.dataset.wfeActionId);
    });
  });

  root.querySelector(".wfe-confirm-hit")?.addEventListener("click", async event => {
    event.preventDefault();
    const item = await fromUuid(itemUuid);
    await game.weaponFormEngine?.handleSuccessfulHit(item);
  });

  root.querySelector(".wfe-check-timers")?.addEventListener("click", async event => {
    event.preventDefault();
    const item = await fromUuid(itemUuid);
    await game.weaponFormEngine?.checkTimers(item);
  });
}

async function onRenderItemSheet(app, html) {
  const item = app?.item ?? app?.object ?? app?.document;
  if ( !isWeaponItem(item) ) return;
  await injectPanel(item, html);
}

export function registerItemSheetIntegration() {
  Hooks.on("renderItemSheet", onRenderItemSheet);
  Hooks.on("renderItemSheet5e", onRenderItemSheet);
}
