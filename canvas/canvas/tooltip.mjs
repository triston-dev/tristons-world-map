// Rich hover card for map pins: one absolutely-positioned HTML element appended to the
// document body, shown/hidden from PinObject pointer events. HTML rather than PIXI text so
// FontAwesome icons, images, and CSS theming all just work.

import { PIN_TYPES } from "../config.mjs";

let el = null;

function ensureElement() {
  if (el) return el;
  el = document.createElement("div");
  el.classList.add("twm-tooltip");
  el.setAttribute("aria-hidden", "true");
  document.body.appendChild(el);
  return el;
}

/**
 * @param {object} pin              pin flag data (already visibility-filtered by the caller)
 * @param {number} clientX/clientY  cursor position in client coords
 */
export function showPinTooltip(pin, clientX, clientY) {
  const tip = ensureElement();
  const type = PIN_TYPES[pin.type] ?? PIN_TYPES.location;
  const name = foundry.utils.escapeHTML(pin.name || game.i18n.localize("TWM.Pins.Unnamed"));
  const blurb = foundry.utils.escapeHTML(pin.blurb ?? "");
  const typeLabel = game.i18n.localize(type.labelKey);

  const parts = [
    pin.img ? `<img class="twm-tooltip-img" src="${foundry.utils.escapeHTML(pin.img)}" alt="">` : "",
    `<div class="twm-tooltip-text">`,
    `<h4><i class="${type.icon}"></i> ${name}</h4>`,
    `<span class="twm-tooltip-type">${typeLabel}</span>`,
    blurb ? `<p>${blurb}</p>` : "",
    pin.discoveredOn !== null && pin.discoveredOn !== undefined
      ? `<span class="twm-tooltip-discovered">${game.i18n.format("TWM.Pins.DiscoveredOn", { day: pin.discoveredOn })}</span>`
      : "",
    `</div>`
  ];
  tip.innerHTML = parts.join("");

  tip.style.left = `${Math.round(clientX + 14)}px`;
  tip.style.top = `${Math.round(clientY + 14)}px`;
  tip.classList.add("active");

  // Keep the card on-screen if it would overflow the right/bottom edge.
  requestAnimationFrame(() => {
    const rect = tip.getBoundingClientRect();
    if (rect.right > window.innerWidth) tip.style.left = `${Math.round(clientX - rect.width - 8)}px`;
    if (rect.bottom > window.innerHeight) tip.style.top = `${Math.round(clientY - rect.height - 8)}px`;
  });
}

export function hidePinTooltip() {
  if (!el) return;
  el.classList.remove("active");
  el.innerHTML = "";
}
