// 商品・地図等の検査では、店頭の応対だけをプレイヤーと同じ送り操作で読む。
// 接客そのものの専用回帰は suite の readShopGreeting: false で自分で操作する。
// 検査の途中で章の仕組み（chapters/ch1.js の setupHooks など）が hooks.onEnter を差し替えても、
// 店頭の応対に入ったことを取りこぼさない（差し替えた関数を内側に入れて包み直す）。
export async function installShopGreetingReader(page) {
  await page.evaluate(async () => {
    const { hooks, tapAdvance } = await import("./js/vn/engine.js");
    let reading = false;
    let current = hooks.onEnter || null;
    const wrappers = new Map(), inners = new WeakMap();
    const wrapperOf = (fn) => {
      if (!wrappers.has(fn)) {
        const wrapper = (id, scene) => {
          reading = /^ch1_shop_(?:rio_|clerk$)/.test(id);
          return fn?.(id, scene);
        };
        wrappers.set(fn, wrapper);
        inners.set(wrapper, fn);
      }
      return wrappers.get(fn);
    };
    // 読み出した値を後で戻す書き方（prev = hooks.onEnter; …; hooks.onEnter = prev）でも、元の関数へ戻る
    Object.defineProperty(hooks, "onEnter", {
      configurable: true, enumerable: true,
      get: () => wrapperOf(current),
      set: (fn) => { current = inners.has(fn) ? inners.get(fn) : fn || null; },
    });
    setInterval(() => {
      if (!reading || !document.body.classList.contains("vn-open")) return;
      // 設定・バックログの裏を送らない。紹介カットイン中の送りは本番のreadyガードに任せる。
      if (document.querySelector("#modal.show, .vn-log.show")) return;
      tapAdvance();
    }, 40);
  });
}
