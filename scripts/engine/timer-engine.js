import { checkTimers } from "./trigger-engine.js";
import { collectManagedWeapons } from "../utils.js";

export async function checkAllTimers() {
  const items = collectManagedWeapons();
  const results = [];

  for ( const item of items ) {
    const result = await checkTimers(item);
    if ( result ) results.push(result);
  }

  return results;
}

export function registerTimerHooks() {
  Hooks.on("updateWorldTime", async () => {
    if ( !game.user?.isGM ) return;
    await checkAllTimers();
  });
}
