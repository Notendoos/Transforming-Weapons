export function registerMidiQolAdapter() {
  if ( !game.modules?.get("midi-qol")?.active ) return;

  Hooks.on("midi-qol.AttackRollComplete", workflow => {
    const item = workflow?.item;
    if ( !item?.flags?.["weapon-form-engine"]?.ruleId ) return;

    const hitTargets = workflow.hitTargets?.size ?? 0;
    if ( hitTargets > 0 ) {
      game.weaponFormEngine?.handleSuccessfulHit?.(item);
    }
  });
}
