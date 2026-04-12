export const MODULE_ID = "weapon-form-engine";
export const MODULE_TITLE = "Weapon Form Engine";
export const API_NAMESPACE = "weaponFormEngine";
export const FLAG_VERSION = 1;
export const SUPPORTED_ITEM_TYPE = "weapon";
export const SUPPORTED_SYSTEM_ID = "dnd5e";
export const TEMPLATE_PATH = `modules/${MODULE_ID}/templates/rule-config.hbs`;

export const TRIGGERS = Object.freeze({
  SUCCESSFUL_HIT: "onSuccessfulHit",
  WORLD_TIME_UPDATE: "onWorldTimeUpdate"
});

export const EFFECTS = Object.freeze({
  TRANSITION_FORM: "transitionForm",
  TRANSITION_FORM_IF: "transitionFormIf",
  TRANSITION_STATE: "transitionState",
  TRANSITION_STATE_IF: "transitionStateIf",
  SET_COUNTER: "setCounter",
  DECREMENT_COUNTER: "decrementCounter",
  INCREMENT_COUNTER: "incrementCounter",
  ROLL_TO_COUNTER: "rollToCounter",
  START_TIMER: "startTimer",
  CLEAR_PATH: "clearPath",
  RESET_COUNTER: "resetCounter",
  POST_CHAT_MESSAGE: "postChatMessage",
  SET_RESTRICTION: "setRestriction"
});

export const PROFILE_KEYS = Object.freeze([
  "label",
  "attackBonus",
  "damageFormula",
  "damageType",
  "range",
  "weaponType",
  "chatFlavor"
]);
