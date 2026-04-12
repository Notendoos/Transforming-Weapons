import { API_NAMESPACE, MODULE_ID, TEMPLATE_PATH } from "./constants.js";
import { createApi } from "./api.js";
import { registerDnd5eAdapter } from "./engine/adapter-dnd5e.js";
import { registerMidiQolAdapter } from "./engine/adapter-midiqol.js";
import { registerTimerHooks } from "./engine/timer-engine.js";
import { registerBuiltInRules } from "./registry/rules.js";
import { registerChatControls } from "./ui/chat-controls.js";
import { registerItemSheetIntegration } from "./ui/item-sheet.js";

Hooks.once("init", async () => {
  registerBuiltInRules();

  try {
    await loadTemplates([TEMPLATE_PATH]);
  } catch (error) {
    console.error("Weapon Form Engine failed to preload templates.", { TEMPLATE_PATH, error });
  }
});

Hooks.once("setup", () => {
  const api = createApi();
  game[API_NAMESPACE] = api;
  const module = game.modules.get(MODULE_ID);
  if ( module ) module.api = api;
});

Hooks.once("ready", () => {
  registerDnd5eAdapter();
  registerMidiQolAdapter();
  registerTimerHooks();
  registerItemSheetIntegration();
  registerChatControls();
});
