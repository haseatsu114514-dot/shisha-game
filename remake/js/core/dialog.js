// すべての既存モーダルを同じフォーカス境界で扱う。選択のない必須場面を勝手に完了させない。
export function watchDialogs(host) {
  let opener = null, shown = false;
  const targets = () => [...host.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), [tabindex="0"]')]
    .filter(n => !n.closest('[hidden]') && n.getClientRects().length && getComputedStyle(n).visibility !== "hidden");
  const update = () => {
    const open = host.classList.contains("show");
    if (open && !shown) { opener = document.activeElement; host.setAttribute("role", "dialog"); host.setAttribute("aria-modal", "true"); }
    if (open) {
      host.setAttribute("aria-label", host.querySelector("h3, .lime-title, .lime-name")?.textContent || "メニュー");
      if (!host.contains(document.activeElement)) (targets()[0] || host).focus({ preventScroll: true });
    } else if (shown) {
      host.removeAttribute("aria-modal"); host.removeAttribute("role");
      if (opener?.isConnected) opener.focus({ preventScroll: true });
      opener = null;
    }
    shown = open;
    document.body.classList.toggle("has-dialog", open);
  };
  host.tabIndex = -1;
  new MutationObserver(update).observe(host, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
  document.addEventListener("keydown", e => {
    if (!host.classList.contains("show")) {
      if (e.key === "Escape" && !document.body.classList.contains("vn-open")) {
        const back = document.querySelector('#screen .sub-back, #screen [data-test="shop-back"], #screen [data-test="shop-entry-back"]');
        if (back && back.getClientRects().length) { e.preventDefault(); back.click(); }
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault(); e.stopImmediatePropagation();
      host.querySelector('[data-dialog-close="true"], [data-test="phone-close"]')?.click();
    } else if (e.key === "Tab") {
      const all = targets(), at = all.indexOf(document.activeElement);
      if (!all.length) { e.preventDefault(); host.focus(); }
      else if (e.shiftKey && at <= 0 || !e.shiftKey && (at < 0 || at === all.length - 1)) {
        e.preventDefault(); all[e.shiftKey ? all.length - 1 : 0].focus();
      }
    }
  }, true);
}
