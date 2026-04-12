import { MODULE_ID } from "../constants.js";
import { escapeHtml, formatDuration, getSpeaker, getWorldTime, localize } from "../utils.js";

function buttonHtml(button) {
  const attributes = Object.entries(button.attributes ?? {})
    .map(([key, value]) => `${key}="${escapeHtml(value)}"`)
    .join(" ");

  return `<button type="button" class="wfe-chat-button" ${attributes}>${escapeHtml(button.label)}</button>`;
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
}

export function buildTimerLine(label, endsAt) {
  const remaining = Math.max(0, Number(endsAt ?? 0) - getWorldTime());
  return `${label}: ${localize("WFE.Label.In", "in")} ${formatDuration(remaining)}`;
}
