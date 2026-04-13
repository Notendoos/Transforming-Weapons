import { TEMPLATE_PATH, TRIGGERS } from "../constants.js";
import { resolveProfile } from "../engine/formula-engine.js";
import { getRestrictions } from "../engine/restriction-engine.js";
import { getAvailableActions, hasMatchingTrigger } from "../engine/trigger-engine.js";
import { getCustomRuleSource, getRuleForItem, isEngineEnabled } from "../engine/state-engine.js";
import { listRuleChoices } from "../registry/rules.js";
import { getBuiltinButtonLabels } from "./button-labels.js";
import {
  canManageItem,
  formatTimerValue,
  getEngineState,
  humanize,
  isWeaponItem,
  toPairs
} from "../utils.js";

const TAB_ID = "weapon-form-engine";
const RENDER_TOKEN_KEY = "_weaponFormEngineRenderToken";
const LAST_ACTIVE_TAB_KEY = "_weaponFormEngineLastActiveTab";
const FORCED_ACTIVE_TAB_KEY = "_weaponFormEngineForcedActiveTab";

function serializeRule(rule) {
  return rule ? JSON.stringify(rule, null, 2) : "";
}

function inferProfileRange(item) {
  const range = item.system?.range ?? {};
  const isRanged = String(item.system?.actionType ?? "").startsWith("r")
    || String(item.system?.type?.value ?? "").endsWith("R")
    || Number(range.long ?? 0) > 0;

  if ( isRanged ) {
    return {
      mode: "ranged",
      value: Number(range.value ?? 20),
      long: Number(range.long ?? 60),
      units: range.units ?? "ft"
    };
  }

  return {
    mode: "melee",
    reach: Number(range.value ?? 5),
    units: range.units ?? "ft"
  };
}

function buildStarterRuleTemplate(item) {
  const damageParts = item.system?.damage?.parts ?? [];
  const firstDamage = damageParts[0] ?? [];
  const attackBonus = item.system?.attack?.bonus;

  return {
    id: item.name?.toLowerCase?.().replaceAll(/[^a-z0-9]+/g, "-")?.replace(/^-+|-+$/g, "") || "custom-weapon",
    label: item.name || "Custom Weapon",
    defaultForm: "base",
    defaultState: "active",
    forms: {
      base: {
        label: "Base Form",
        actionType: item.system?.actionType ?? "mwak",
        ability: item.system?.ability ?? "",
        attackBonus: attackBonus === undefined || attackBonus === null || attackBonus === "" ? 0 : attackBonus,
        attackFlat: Boolean(item.system?.attack?.flat ?? false),
        damageFormula: String(firstDamage[0] ?? "1d6 + @mod"),
        damageType: String(firstDamage[1] ?? "bludgeoning"),
        versatileDamage: String(item.system?.damage?.versatile ?? ""),
        weaponType: item.system?.type?.value ?? "simpleM",
        range: inferProfileRange(item),
        magicalBonus: Number(item.system?.magicalBonus ?? 0),
        chatFlavor: String(item.system?.chatFlavor ?? "")
      }
    },
    states: {
      active: {
        label: "Active"
      }
    },
    counters: {
      resource: {
        current: 0,
        max: 0
      }
    },
    timers: {
      startedAt: null,
      endsAt: null
    },
    restrictions: {},
    passives: {},
    actions: {
      transform: {
        label: "Transform",
        buttonLabel: "Transform",
        availableWhen: {
          form: "base",
          state: "active"
        },
        effects: []
      }
    },
    triggers: {
      onSuccessfulHit: [],
      onWorldTimeUpdate: []
    },
    ui: {
      summary: "Edit this JSON to define forms, states, counters, actions, and triggers for this weapon.",
      buttonLabels: {
        assignRule: "Assign Rule",
        applyJsonRule: "Apply JSON Rule",
        loadStarterRule: "Load Starter JSON",
        loadManagedRule: "Copy Current Rule",
        initialize: "Reset",
        confirmHit: "Confirm Hit",
        checkTimers: "Check Timers"
      }
    }
  };
}

function buildSheetContext(item) {
  const state = getEngineState(item);
  const engineEnabled = isEngineEnabled(item);
  const rule = getRuleForItem(item);
  const profile = resolveProfile(item);
  const restrictions = getRestrictions(item);
  const actions = getAvailableActions(item);
  const hasCustomRule = Boolean(state?.metadata?.customRule);
  const starterRuleSource = serializeRule(buildStarterRuleTemplate(item));
  const managedRuleSource = serializeRule(rule);
  const buttonLabels = getBuiltinButtonLabels(rule);

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
    engineEnabled,
    isManaged: Boolean(rule),
    hasCustomRule,
    customRuleLabel: hasCustomRule ? (rule?.label ?? state?.metadata?.label ?? item.name) : "",
    customRuleSource: getCustomRuleSource(item) || starterRuleSource,
    starterRuleSource,
    managedRuleSource,
    buttonLabels,
    ruleChoices,
    summary: rule?.ui?.summary ?? "",
    currentForm: profile?.formLabel ?? humanize(state?.form),
    currentState: profile?.stateLabel ?? humanize(state?.state),
    attackBonus: profile?.attackBonus ?? null,
    damageSummary: profile?.damageSummary ?? [profile?.damageFormula, profile?.damageType].filter(Boolean).join(" "),
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

function findNavigation(root) {
  return root.querySelector(".sheet-navigation.tabs[data-group='primary']")
    ?? root.querySelector(".tabs[data-group='primary']");
}

function findBody(root) {
  return root.querySelector(".sheet-body")
    ?? root.querySelector("form")
    ?? root;
}

function findFallbackTarget(root) {
  return root.querySelector(".tab[data-tab='details']")
    ?? root.querySelector(".tab.details")
    ?? findBody(root);
}

function getActivePrimaryTabFromDom(root) {
  return findNavigation(root)?.querySelector(".active[data-tab]")?.dataset.tab
    ?? findBody(root)?.querySelector(".tab.active[data-tab]")?.dataset.tab
    ?? null;
}

function getPrimaryTabsController(app) {
  return app?._tabs?.find?.(tabs => tabs.group === "primary");
}

function setActivePrimaryTab(app, tabId, { forceNext=false }={}) {
  if ( !tabId ) return;

  app[LAST_ACTIVE_TAB_KEY] = tabId;
  if ( forceNext ) app[FORCED_ACTIVE_TAB_KEY] = tabId;

  const primaryTabs = getPrimaryTabsController(app);
  if ( primaryTabs ) primaryTabs.active = tabId;

  const primaryTabConfig = app?.options?.tabs?.find?.(tabs => tabs.group === "primary");
  if ( primaryTabConfig ) primaryTabConfig.initial = tabId;
}

function syncActivePrimaryTab(root, tabId) {
  if ( !tabId ) return;

  findNavigation(root)?.querySelectorAll("[data-tab]").forEach(tab => {
    tab.classList.toggle("active", tab.dataset.tab === tabId);
  });

  findBody(root)?.querySelectorAll(".tab[data-tab]").forEach(tab => {
    tab.classList.toggle("active", tab.dataset.tab === tabId);
  });
}

function trackPrimaryTabNavigation(app, root) {
  findNavigation(root)?.querySelectorAll("[data-tab]").forEach(tab => {
    if ( tab.dataset.wfeTracked === "true" ) return;
    tab.dataset.wfeTracked = "true";
    tab.addEventListener("click", () => setActivePrimaryTab(app, tab.dataset.tab));
  });
}

function rebindSheetTabs(app, root) {
  const primaryTabs = getPrimaryTabsController(app);
  const activeTab = app?.[FORCED_ACTIVE_TAB_KEY]
    ?? app?.[LAST_ACTIVE_TAB_KEY]
    ?? getActivePrimaryTabFromDom(root)
    ?? primaryTabs?.active
    ?? null;
  if ( activeTab && primaryTabs ) primaryTabs.active = activeTab;
  if ( primaryTabs?.bind ) primaryTabs.bind(root);
  syncActivePrimaryTab(root, activeTab);
  trackPrimaryTabNavigation(app, root);
  if ( activeTab ) app[LAST_ACTIVE_TAB_KEY] = activeTab;
  app[FORCED_ACTIVE_TAB_KEY] = null;
}

async function injectPanel(app, item, html) {
  const root = html?.jquery ? html[0] : html;
  if ( !root || !isWeaponItem(item) ) return;

  try {
    const renderToken = Symbol("weapon-form-engine-render");
    app[RENDER_TOKEN_KEY] = renderToken;
    const rendered = await renderTemplate(TEMPLATE_PATH, buildSheetContext(item));
    if ( app[RENDER_TOKEN_KEY] !== renderToken ) return;

    root.querySelectorAll(".wfe-panel").forEach(panel => panel.remove());
    root.querySelectorAll(".wfe-nav").forEach(panel => panel.remove());
    root.querySelectorAll(".wfe-tab").forEach(panel => panel.remove());

    const navigation = findNavigation(root);
    const body = findBody(root);

    if ( navigation && body ) {
      const navItem = document.createElement("a");
      navItem.className = "item wfe-nav";
      navItem.dataset.group = "primary";
      navItem.dataset.tab = TAB_ID;
      navItem.textContent = game.i18n.localize("WFE.Sheet.Tab");
      navigation.appendChild(navItem);

      const tab = document.createElement("div");
      tab.className = "tab flexcol wfe-tab";
      tab.dataset.group = "primary";
      tab.dataset.tab = TAB_ID;
      tab.innerHTML = rendered;
      body.appendChild(tab);
      rebindSheetTabs(app, root);
      activateListeners(tab, item.uuid, app);
      return;
    }

    const target = findFallbackTarget(root);
    const wrapper = document.createElement("section");
    wrapper.className = "wfe-panel";
    wrapper.innerHTML = rendered;
    target.appendChild(wrapper);
    activateListeners(wrapper, item.uuid, app);
  } catch (error) {
    console.error("Weapon Form Engine failed to inject item sheet UI.", {
      item: item?.name,
      templatePath: TEMPLATE_PATH,
      error
    });
  }
}

function activateListeners(root, itemUuid, app) {
  root.querySelector(".wfe-enabled-toggle")?.addEventListener("change", async event => {
    const enabled = Boolean(event.currentTarget?.checked);
    setActivePrimaryTab(app, TAB_ID, { forceNext: true });
    const item = await fromUuid(itemUuid);
    await game.weaponFormEngine?.setEnabled(item, enabled);
  });

  root.querySelector(".wfe-assign-rule")?.addEventListener("click", async event => {
    event.preventDefault();
    const select = root.querySelector(".wfe-rule-select");
    if ( !select?.value ) return;
    setActivePrimaryTab(app, TAB_ID, { forceNext: true });
    const item = await fromUuid(itemUuid);
    await game.weaponFormEngine?.assignRule(item, select.value);
  });

  root.querySelector(".wfe-assign-json-rule")?.addEventListener("click", async event => {
    event.preventDefault();
    const input = root.querySelector(".wfe-json-input");
    if ( !input?.value?.trim() ) return;
    setActivePrimaryTab(app, TAB_ID, { forceNext: true });
    const item = await fromUuid(itemUuid);
    await game.weaponFormEngine?.assignCustomRule(item, input.value);
  });

  root.querySelector(".wfe-load-starter-rule")?.addEventListener("click", event => {
    event.preventDefault();
    const input = root.querySelector(".wfe-json-input");
    const source = root.querySelector(".wfe-json-starter-source");
    if ( input && source?.value ) input.value = source.value;
  });

  root.querySelector(".wfe-load-managed-rule")?.addEventListener("click", event => {
    event.preventDefault();
    const input = root.querySelector(".wfe-json-input");
    const source = root.querySelector(".wfe-json-managed-source");
    if ( input && source?.value ) input.value = source.value;
  });

  root.querySelector(".wfe-initialize-rule")?.addEventListener("click", async event => {
    event.preventDefault();
    setActivePrimaryTab(app, TAB_ID, { forceNext: true });
    const item = await fromUuid(itemUuid);
    await game.weaponFormEngine?.initialize(item);
  });

  root.querySelectorAll("[data-wfe-action-id]").forEach(button => {
    button.addEventListener("click", async event => {
      event.preventDefault();
      setActivePrimaryTab(app, TAB_ID, { forceNext: true });
      const item = await fromUuid(itemUuid);
      await game.weaponFormEngine?.runAction(item, button.dataset.wfeActionId);
    });
  });

  root.querySelector(".wfe-confirm-hit")?.addEventListener("click", async event => {
    event.preventDefault();
    setActivePrimaryTab(app, TAB_ID, { forceNext: true });
    const item = await fromUuid(itemUuid);
    await game.weaponFormEngine?.handleSuccessfulHit(item);
  });

  root.querySelector(".wfe-check-timers")?.addEventListener("click", async event => {
    event.preventDefault();
    setActivePrimaryTab(app, TAB_ID, { forceNext: true });
    const item = await fromUuid(itemUuid);
    await game.weaponFormEngine?.checkTimers(item);
  });
}

async function onRenderItemSheet(app, html) {
  const item = app?.item ?? app?.object ?? app?.document;
  if ( !isWeaponItem(item) ) return;
  await injectPanel(app, item, html);
}

export function registerItemSheetIntegration() {
  Hooks.on("renderItemSheet", onRenderItemSheet);
  Hooks.on("renderItemSheet5e", onRenderItemSheet);
}
