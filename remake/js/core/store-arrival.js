// 場所への移動を覆ったところで、その店の採用ロゴを短く見せる。
import { el, sleep } from "./util.js";
import { move } from "./transition-kit.js";
import { hasStoreLogo, storeLogo } from "./store-logos.js";

export function withStoreArrival(host, curtain, opts, { fast = false, reduced = false } = {}) {
  if (!hasStoreLogo(opts?.spotId)) return curtain;
  let node = null, shownAt = 0, released = false;
  const covered = curtain.covered.then(() => {
    node = el("div.store-arrival", {
      "aria-hidden": "true", dataset: { test: "store-arrival", store: opts.spotId },
    }, [el("div.store-arrival-card", [
      storeLogo(opts.spotId, { width: 360, height: 208 }),
    ])]);
    host.append(node);
    shownAt = performance.now();
    if (!fast && !reduced) move(node, [{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }], 160, { easing: "ease-out" });
  });
  return { covered, async release() {
    if (released) return;
    released = true;
    try {
      await covered;
      await sleep(Math.max(0, (fast ? 80 : 650) - (performance.now() - shownAt)));
      if (!fast && !reduced) await move(node, [{ opacity: 1 }, { opacity: 0 }], 130, { easing: "ease-in" });
      node.remove();
      await curtain.release();
    } finally { node?.remove(); }
  } };
}
