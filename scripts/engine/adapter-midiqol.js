import { TRIGGERS } from "../constants.js";
import { getRuleForItem } from "./state-engine.js";

export function registerMidiQolAdapter() {
  if ( !game.modules?.get("midi-qol")?.active ) return;

  Hooks.on("midi-qol.AttackRollComplete", workflow => {
    const item = workflow?.item;
    const rule = getRuleForItem(item);
    if ( !rule?.triggers?.[TRIGGERS.SUCCESSFUL_HIT]?.length ) return;

    const hitTargets = workflow.hitTargets?.size ?? 0;
    if ( hitTargets > 0 ) {
      game.weaponFormEngine?.handleSuccessfulHit?.(item);
    }
  });
}
