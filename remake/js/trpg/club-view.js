import { el } from "../core/util.js";
import { displayName, portraitUrl, portraitTop } from "./presentation.js";
import { recruitmentStatus, joinTrpgClub } from "./campaign.js";

/** A face-to-face invitation, shared by actual visits and the disposable demo. */
export function mountTrpgRecruitment(host, { getState, personId, catalog, characters, manifest, club,
  save = () => {}, signal } = {}) {
  const owner = getState(), person = catalog.participants.find(p => p.id === personId);
  const stamp = owner && `${owner.chapter}:${owner.day}:${owner.slot}`;
  const previousFocus = document.activeElement;
  let root, observer, disposed = false, step = -1, resolve;
  const finished = new Promise(r => { resolve = r; });
  const current = () => !disposed && getState() === owner
    && `${owner.chapter}:${owner.day}:${owner.slot}` === stamp;
  const close = (joined = false) => {
    if (disposed) return;
    disposed = true; observer?.disconnect(); root?.remove();
    signal?.removeEventListener("abort", cancel); window.removeEventListener("pagehide", cancel);
    window.removeEventListener("keydown", keyboard);
    if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    resolve({ joined, cancelled: !joined });
  };
  const cancel = () => close();
  const keyboard = event => {
    if (event.key === "Escape") { event.preventDefault(); cancel(); }
    if (event.key === "Tab") {
      const buttons = [...root.querySelectorAll("button")];
      const index = buttons.indexOf(document.activeElement);
      event.preventDefault(); buttons[(index + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length]?.focus();
    }
  };
  if (signal?.aborted || !recruitmentStatus(owner, person, catalog).ok) { close(); return { finished, destroy: cancel }; }
  const name = displayName(characters, personId), lines = club.branches[personId];
  const button = (text, test, action) => el("button.trpg-button", { type: "button", text, dataset: { test }, onclick: () => {
    if (!current()) { cancel(); return; }
    action();
  } });
  root = el("section.trpg-club-dialog", { role: "dialog", "aria-modal": "true", "aria-label": name + "を部活に誘う" });
  function render() {
    const line = step < 0 ? (club.branches["invite_" + personId] || club.branches.invite)[0].text : lines[step].text;
    const content = el("div.trpg-club-dialog-card", [
      el("span.trpg-kicker", { text: catalog.club.name + " / 仲間に声をかける" }),
      el("h2", { text: step < 0 ? name + "を部活に誘う？" : name }),
      el("div.trpg-club-conversation", [
        el("div.trpg-club-portrait", el("img", { src: portraitUrl(manifest, personId), alt: name,
          style: { top: portraitTop(manifest, personId, 300, 4), transform: "translateX(-" + manifest.portraits[personId].ax * 100 + "%)" } })),
        el("div", [el("small", { text: step < 0 ? "はじめ" : name }),
          el("p", { text: line, dataset: { test: "trpg-recruit-line" } })]),
      ]),
    ]);
    const actions = el("div.trpg-club-actions");
    if (step < 0) actions.append(button("部活に誘う", "trpg-recruit-invite", () => { step = 0; render(); }),
      button("今日は誘わない", "trpg-recruit-later", cancel));
    else actions.append(button(step < lines.length - 1 ? "話を聞く" : "また店で会おう", "trpg-recruit-next", () => {
      if (step < lines.length - 1) { step++; render(); return; }
      if (joinTrpgClub(owner, catalog, personId)) { save(); close(true); } else close();
    }));
    content.append(actions); root.replaceChildren(content);
    actions.querySelector("button")?.focus({ preventScroll: true });
  }
  host.append(root); render();
  observer = new MutationObserver(() => { if (!root.isConnected) cancel(); });
  observer.observe(host, { childList: true });
  signal?.addEventListener("abort", cancel, { once: true }); window.addEventListener("pagehide", cancel, { once: true });
  window.addEventListener("keydown", keyboard);
  return { finished, destroy: cancel };
}
