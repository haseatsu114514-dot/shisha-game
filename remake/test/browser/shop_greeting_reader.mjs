// 商品・地図等の検査では、店頭の応対だけをプレイヤーと同じ送り操作で読む。
// 接客そのものの専用回帰は suite の readShopGreeting: false で自分で操作する。
// 流れている台本は engine の playingDialogueId で見る。以前は hooks.onEnter に相乗りしていたが、
// 第1章の setupHooks()（検査の準備で多くが呼ぶ）が hooks.onEnter を置き換えるため、応対が送られず店で止まっていた。
export async function installShopGreetingReader(page) {
  await page.evaluate(async () => {
    const { playingDialogueId, tapAdvance } = await import("./js/vn/engine.js");
    setInterval(() => {
      if (!/^ch1_shop_(?:rio_|clerk$)/.test(playingDialogueId() || "") || !document.body.classList.contains("vn-open")) return;
      // 設定・バックログの裏を送らない。紹介カットイン中の送りは本番のreadyガードに任せる。
      if (document.querySelector("#modal.show, .vn-log.show")) return;
      tapAdvance();
    }, 40);
  });
}
