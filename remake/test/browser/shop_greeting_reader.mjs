// 商品・地図等の検査では、店頭の応対だけをプレイヤーと同じ送り操作で読む。
// 接客そのものの専用回帰は suite の readShopGreeting: false で自分で操作する。
export async function installShopGreetingReader(page) {
  await page.evaluate(async () => {
    const { hooks, tapAdvance } = await import("./js/vn/engine.js");
    const previous = hooks.onEnter;
    let reading = false;
    hooks.onEnter = (id, scene) => {
      reading = /^ch1_shop_(?:rio_|clerk$)/.test(id);
      previous?.(id, scene);
    };
    setInterval(() => {
      if (!reading || !document.body.classList.contains("vn-open")) return;
      // 設定・バックログの裏を送らない。紹介カットイン中の送りは本番のreadyガードに任せる。
      if (document.querySelector("#modal.show, .vn-log.show")) return;
      tapAdvance();
    }, 40);
  });
}
