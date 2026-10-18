// 日常画面だけを端末の実寸へ配置する。制作・会話の論理解像度はそのまま。
export function initDailyLayout() {
  const media = matchMedia("(max-width: 1000px), (max-height: 600px)");
  const update = () => {
    const active = media.matches && !document.body.classList.contains("game-ds") && !document.body.classList.contains("vn-open")
      && ["map", "tonari", "home", "shop-entry", "shop"].includes(document.body.dataset.screen);
    if (document.body.classList.contains("daily-responsive") !== active) document.body.classList.toggle("daily-responsive", active);
  };
  new MutationObserver(update).observe(document.body, { attributes: true, attributeFilter: ["data-screen", "class"] });
  media.addEventListener("change", update);
  update();
}
