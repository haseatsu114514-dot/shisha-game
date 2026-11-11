// 現行の HUD（日付・時間帯・所持金・体力・LIME・MENU）の表示を読む。読むだけで書き換えない。
const text = (node) => node?.textContent?.trim() || "";

export function readHud() {
  const hud = document.querySelector("#hud .hud");
  if (!hud) return null;
  const slot = hud.querySelector(".dc-slot");
  // 例: 「昼・雨 ── 今日はあと2回動ける」「帰宅」「大会当日」
  const title = slot?.title || text(slot);
  const [phase] = title.split(" ── ");
  const stamina = hud.querySelector(".hud-stamina");
  const lime = hud.querySelector(".hud-lime");
  return {
    area: text(hud.querySelector(".dc-area-full")),
    day: text(hud.querySelector(".dc-day b")),
    finalDay: text(hud.querySelector(".dc-day small")),
    phase: /[☀☂☾]/.test(phase) ? "" : phase,
    night: slot?.dataset.slot === "night",
    moves: /あと(\d+)回/.exec(title)?.[1] || "",
    money: text(hud.querySelector(".dc-row.money b")).replace(/円$/, ""),
    stamina: parseFloat(stamina?.querySelector(".gauge-track b")?.style.width) || 0,
    health: stamina?.dataset.health || "",
    unread: lime?.classList.contains("has") ? text(lime.querySelector(".badge-number")) : "",
    hidane: text(hud.querySelector(".hud-menu .hidane-badge:not([hidden])")),
  };
}

/** 現行のボタン（data-test）を押す。無ければ何もしない。 */
export function pressTest(id) {
  const target = document.querySelector(`[data-test="${id}"]`);
  if (target && !target.disabled) target.click();
  return !!target;
}
