// 見える幅の真ん中に、てつこを映す。本編のカメラは舞台の外を映さないので、端の居場所（ベンチ・寝床）では、てつこが画面の真ん中（x=640）から
// 左右へ寄る。横の画面では全部見えるが、縦は真ん中しか見せないので、そのぶんだけ舞台の箱ごと横へずらす（--shift。tetsuko.css が使う）。
// じゃらしの間（カメラは床の真ん中に固定）と、もようがえの間（全体を見せる）は、ずらさない。値は本編が置く --cam-k・--cam-x と、てつこの --x から出す。
export function followCat(screen) {
  const yard = screen.querySelector(".tt-yard"), cat = screen.querySelector(".tt-cat");
  const aim = () => {
    let shift = 0;
    if (screen.dataset.tool !== "toy" && screen.dataset.panel !== "decor") {
      const k = parseFloat(yard.style.getPropertyValue("--cam-k")), camX = parseFloat(yard.style.getPropertyValue("--cam-x"));
      const x = parseFloat(getComputedStyle(cat).getPropertyValue("--x"));
      if (k > 1 && Number.isFinite(camX) && Number.isFinite(x)) shift = Math.round(640 - (camX + k * x));
    }
    const value = `${shift}px`;
    if (screen.style.getPropertyValue("--shift") !== value) screen.style.setProperty("--shift", value);
  };
  const watch = new MutationObserver(aim);
  watch.observe(yard, { attributes: true, attributeFilter: ["style"] });
  watch.observe(cat, { attributes: true, attributeFilter: ["style", "data-at", "data-inside"] });
  watch.observe(screen, { attributes: true, attributeFilter: ["data-tool", "data-panel"] });
  aim();
  return () => { watch.disconnect(); screen.style.removeProperty("--shift"); };
}
