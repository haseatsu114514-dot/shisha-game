// 商品・地図等の検査では、店頭の応対だけをプレイヤーと同じ送り操作で読む。
// 接客そのものの専用回帰は suite の readShopGreeting: false で自分で操作する。
export async function installShopGreetingReader(page) {
  await page.evaluate(async () => {
    const { hooks, tapAdvance } = await import("./js/vn/engine.js");
    let reading = false;
    // 章の開始（ch1.js の setupHooks 等）や各検査は hooks.onEnter を後から差し替える。
    // 差し替えた関数もそのまま呼びつつ包み直し、店頭の応対に入ったことを見失わない。
    const wrap = (handler) => {
      if (handler?.shopGreetingReader) return handler;
      const wrapped = (id, scene) => {
        reading = /^ch1_shop_(?:rio_|clerk$)/.test(id);
        return handler?.(id, scene);
      };
      wrapped.shopGreetingReader = true;
      return wrapped;
    };
    let onEnter = wrap(hooks.onEnter);
    Object.defineProperty(hooks, "onEnter", {
      configurable: true, enumerable: true,
      get: () => onEnter,
      set: (handler) => { onEnter = wrap(handler); },
    });
    setInterval(() => {
      if (!reading || !document.body.classList.contains("vn-open")) return;
      // 設定・バックログの裏を送らない。紹介カットイン中の送りは本番のreadyガードに任せる。
      if (document.querySelector("#modal.show, .vn-log.show")) return;
      tapAdvance();
    }, 40);
  });
}
