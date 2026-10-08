// 背景の読み込みを覆う、夜の藍・琥珀・煙のモーショングラフィックス。
import { el, sleep, nextFrame } from "./util.js";

let serial = 0;
const STYLES = ["diagonal", "smoke", "iris"];

export function createSceneCurtain(host, { fast = false } = {}) {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ms = fast || reduced ? 45 : 260;
  const variant = STYLES[serial++ % STYLES.length];
  const node = el(`div.scene-curtain.${variant}`, { "aria-hidden": "true", style: { "--st-ms": `${ms}ms` }, dataset: { transition: variant } }, [
    el("div.st-field"),
    el("div.st-lines", [el("b"), el("b"), el("b")]),
    el("div.st-orbit", [el("b"), el("b")]),
    el("div.st-sign", [el("span", { text: "水煙前線" }), el("small", { text: "SUIEN ZENSEN" })]),
  ]);
  const blockKey = (e) => {
    if (["Enter", " "].includes(e.key)) { e.preventDefault(); e.stopImmediatePropagation(); }
  };
  window.addEventListener("keydown", blockKey, true);
  host.append(node);
  const covered = (async () => { await nextFrame(); node.classList.add("cover"); await sleep(ms); })();
  let released = false;
  return { covered, async release() {
    if (released) return;
    released = true;
    await covered;
    // 次の背景・画面・台詞を幕の内側で描いてから開く。
    await nextFrame(); await nextFrame();
    node.classList.add("reveal");
    await sleep(ms + 30);
    node.remove();
    window.removeEventListener("keydown", blockKey, true);
  } };
}
