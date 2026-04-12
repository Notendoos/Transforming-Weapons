import { MODULE_ID } from "../constants.js";
import { buildEngineButtonsForItem } from "./chat-button-builder.js";
import { canManageItem, escapeHtml, formatDuration, getSpeaker, getWorldTime, localize } from "../utils.js";

function buttonHtml(button) {
  const attributes = Object.entries(button.attributes ?? {})
    .map(([key, value]) => `${key}="${escapeHtml(value)}"`)
    .join(" ");

  return `<button type="button" class="wfe-chat-button" ${attributes}>${escapeHtml(button.label)}</button>`;
}

function buildInlineControlsHtml(item) {
  const buttons = buildEngineButtonsForItem(item);
  if ( !buttons.length ) return "";

  return `
    <section class="wfe-item-card-controls">
      <header class="wfe-item-card-controls__header">${escapeHtml(localize("WFE.ChatControls.Title", "Weapon Actions"))}</header>
      <div class="wfe-item-card-controls__buttons">${buttons.map(buttonHtml).join("")}</div>
    </section>
  `;
}

function resolveActorForMessage(message, itemCard) {
  const tokenId = itemCard?.dataset?.tokenId ?? message.speaker?.token;
  if ( tokenId && globalThis.canvas?.tokens ) {
    const token = globalThis.canvas.tokens.get(tokenId);
    if ( token?.actor ) return token.actor;
  }

  const actorId = itemCard?.dataset?.actorId ?? message.speaker?.actor;
  if ( actorId ) return game.actors?.get(actorId) ?? null;
  return null;
}

function findItemDatasetRoot(root) {
  return root?.querySelector?.("[data-item-uuid]")
    ?? root?.querySelector?.("[data-item-id]")
    ?? root?.querySelector?.(".item-card")
    ?? root;
}

async function resolveItemForMessage(message, html) {
  const itemUuid = message.getFlag(MODULE_ID, "itemUuid");
  if ( itemUuid ) {
    const flaggedItem = await fromUuid(itemUuid);
    if ( flaggedItem instanceof Item ) return flaggedItem;
  }

  const root = html?.jquery ? html[0] : html;
  const datasetRoot = findItemDatasetRoot(root);
  const datasetItemUuid = datasetRoot?.dataset?.itemUuid
    ?? datasetRoot?.querySelector?.("[data-item-uuid]")?.dataset?.itemUuid
    ?? null;

  if ( datasetItemUuid ) {
    const embeddedItem = await fromUuid(datasetItemUuid);
    if ( embeddedItem instanceof Item ) return embeddedItem;
  }

  const itemId = datasetRoot?.dataset?.itemId
    ?? datasetRoot?.querySelector?.("[data-item-id]")?.dataset?.itemId
    ?? message.getFlag("dnd5e", "itemId")
    ?? foundry.utils.getProperty(message, "flags.dnd5e.item.id")
    ?? foundry.utils.getProperty(message, "flags.dnd5e.itemData._id");
  if ( !itemId ) return null;

  const actor = resolveActorForMessage(message, datasetRoot);
  if ( actor?.items?.get(itemId) ) return actor.items.get(itemId);
  return game.items?.get(itemId) ?? null;
}

async function injectItemCardControls(message, html) {
  const root = html?.jquery ? html[0] : html;
  if ( !root ) return;

  root.querySelectorAll(".wfe-item-card-controls").forEach(node => node.remove());

  const item = await resolveItemForMessage(message, root);
  if ( !(item instanceof Item) ) return;
  if ( !canManageItem(item) ) return;

  const inlineControls = buildInlineControlsHtml(item);
  if ( !inlineControls ) return;

  const itemCard = root.querySelector(".item-card");
  if ( !itemCard ) return;

  const cardButtons = itemCard.querySelector(".card-buttons");
  if ( cardButtons ) {
    cardButtons.insertAdjacentHTML("afterend", inlineControls);
    return;
  }

  itemCard.insertAdjacentHTML("beforeend", inlineControls);
}

export async function postEngineChatCard(item, { title, lines=[], buttons=[] }={}) {
  const content = `
    <section class="wfe-chat-card">
      <header class="wfe-chat-card__header">${escapeHtml(title ?? item.name)}</header>
      ${lines.length ? `<ul class="wfe-chat-card__lines">${lines.map(line => `<li>${escapeHtml(line)}</li>`).join("")}</ul>` : ""}
      ${buttons.length ? `<div class="wfe-chat-card__buttons">${buttons.map(buttonHtml).join("")}</div>` : ""}
    </section>
  `;

  await ChatMessage.create({
    content,
    speaker: getSpeaker(item),
    flags: {
      [MODULE_ID]: {
        itemUuid: item.uuid,
        createdAt: getWorldTime()
      }
    }
  });
}

async function onDocumentClick(event) {
  const button = event.target.closest("button[data-wfe-chat-action]");
  if ( !button ) return;

  event.preventDefault();

  const itemUuid = button.dataset.itemUuid;
  if ( !itemUuid ) return;
  const item = await fromUuid(itemUuid);
  if ( !item ) return;

  switch ( button.dataset.wfeChatAction ) {
    case "run-action":
      await game.weaponFormEngine?.runAction(item, button.dataset.actionId);
      break;
    case "confirm-hit":
      await game.weaponFormEngine?.handleSuccessfulHit(item);
      break;
    case "check-timers":
      await game.weaponFormEngine?.checkTimers(item);
      break;
  }
}

export function registerChatControls() {
  if ( document.body.dataset.weaponFormEngineChatControlsReady ) return;
  document.body.dataset.weaponFormEngineChatControlsReady = "true";
  document.addEventListener("click", onDocumentClick);
  Hooks.on("renderChatMessage", (message, html) => {
    void injectItemCardControls(message, html);
  });
}

export function buildTimerLine(label, endsAt) {
  const remaining = Math.max(0, Number(endsAt ?? 0) - getWorldTime());
  return `${label}: ${localize("WFE.Label.In", "in")} ${formatDuration(remaining)}`;
}
