// 商品・地図等の検査では、店頭の応対だけをプレイヤーと同じ送り操作で読む。
// 接客そのものの専用回帰は suite の readShopGreeting: false で自分で操作する。
export async function installShopGreetingReader(page) {
  await page.evaluate(async () => {
    const { hooks, tapAdvance } = await import("./js/vn/engine.js");
    let reading = false;
    // 多くの検査は準備の途中で chapters/ch1.js の setupHooks() を呼び、hooks.onEnter を差し替える。
    // 差し替えられても応対の判定が外れないよう、読み出すたびに「今の onEnter」を包んで返す
    // （前の値を取り出して呼ぶ連結も、そのまま前の値へ届く）。
    let assigned = hooks.onEnter;
    Object.defineProperty(hooks, "onEnter", {
      configurable: true, enumerable: true,
      get() {
        const inner = assigned;
        return (id, scene) => {
          // 分岐に入る時も呼ばれる。台本の入口（ch1_shop_…）でだけ判定を切り替える
          if (/^ch1_/.test(id)) reading = /^ch1_shop_(?:rio_|clerk$)/.test(id);
          return inner?.(id, scene);
        };
      },
      set(fn) { assigned = fn; },
    });
    setInterval(() => {
      if (!reading || !document.body.classList.contains("vn-open")) return;
      // 設定・バックログの裏を送らない。紹介カットイン中の送りは本番のreadyガードに任せる。
      if (document.querySelector("#modal.show, .vn-log.show")) return;
      tapAdvance();
    }, 40);
  });
}
