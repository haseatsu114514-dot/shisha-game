// 場所への移動を覆ったところで、その店の採用ロゴを短く見せる。
// 地図へ寄る移動（transition-moves.js の zoom・bareLogo）では、白い札に載せず光の中にそのまま出し、ふくらんで消えながら店内へ抜ける。
import { el, sleep } from "./util.js";
import { move } from "./transition-kit.js";
import { hasStoreLogo, storeLogo } from "./store-logos.js";
import { SE } from "./audio.js";

export function withStoreArrival(host, curtain, opts, { fast = false, reduced = false } = {}) {
  if (opts?.anonymous || !hasStoreLogo(opts?.spotId)) return curtain; // 名前を伏せた行き先ではロゴで明かさない
  const bare = !!curtain.bareLogo && !fast && !reduced;
  let node = null, shownAt = 0, released = false;
  const covered = curtain.covered.then(() => {
    node = el(bare ? "div.store-arrival.bare" : "div.store-arrival", {
      "aria-hidden": "true", dataset: { test: "store-arrival", store: opts.spotId },
    }, [el("div.store-arrival-card", [
      storeLogo(opts.spotId, { width: 360, height: 208 }),
    ])]);
    host.append(node);
    if (!fast) SE.door?.(); // 店のロゴが出るのに合わせて扉の音（早送り中は鳴らさない）
    shownAt = performance.now();
    if (bare) move(node, [{ opacity: 0, transform: "scale(.92)" }, { opacity: 1, transform: "none" }], 220, { easing: "ease-out" });
    else if (!fast && !reduced) move(node, [{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }], 160, { easing: "ease-out" });
  });
  // 煙のにじみ（transitions.js smokeCurtain）と地図へ寄る移動は、前の背景を受け取る dissolve() も中継する
  return { covered, ...(curtain.dissolve ? { dissolve: (nodes) => curtain.dissolve(nodes) } : {}), async release() {
    if (released) return;
    released = true;
    try {
      await covered;
      await sleep(Math.max(0, (fast ? 80 : 650) - (performance.now() - shownAt)));
      if (bare) {
        // ロゴがふくらんで消えるのと同時に、光が引いて店内が見えはじめる
        await Promise.all([move(node, [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "scale(1.18)" }], 300, { easing: "ease-in" }), curtain.release()]);
        return;
      }
      if (!fast && !reduced) await move(node, [{ opacity: 1 }, { opacity: 0 }], 130, { easing: "ease-in" });
      node.remove();
      await curtain.release();
    } finally { node?.remove(); }
  } };
}
