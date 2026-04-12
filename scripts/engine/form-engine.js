import { syncManagedItem } from "./adapter-dnd5e.js";
import { getRestrictions } from "./restriction-engine.js";
import { getRuleForItem, setForm } from "./state-engine.js";
import { coerceItem, humanize, notify } from "../utils.js";

export function getAvailableForms(item) {
  const rule = getRuleForItem(item);
  return Object.entries(rule?.forms ?? {}).map(([id, form]) => ({
    id,
    label: form.label ?? humanize(id)
  }));
}

export async function switchForm(itemOrUuid, form) {
  const item = await coerceItem(itemOrUuid);
  if ( !item ) return null;

  const rule = getRuleForItem(item);
  if ( !rule?.forms?.[form] ) {
    notify(game.i18n.format("WFE.Error.InvalidForm", { form }), "error");
    return null;
  }

  await setForm(item, form);
  await syncManagedItem(item);

  return {
    form,
    restrictions: getRestrictions(item)
  };
}
