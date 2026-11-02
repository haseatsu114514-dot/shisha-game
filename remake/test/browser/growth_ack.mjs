// 遊びの検査では、プレイヤーと同じく成長のお知らせを閉じて先へ進む（心得の盤は通常プレイの既定・SBD97）。
// - 寝る前のフル演出の LEVEL UP は OK を押す（初回・節目・2つ以上上がった夜だけ出る。短い帯は自動で消える）
// - 大会前夜に火種が残っていると開く盤（内省）は「閉じる」で閉じる（灯さない）
// 成長そのものを確かめる検査（growth_levelup.mjs など）は suite の acknowledgeGrowth: false で自分で操作する。
export async function installGrowthAcknowledger(page) {
  await page.addInitScript(() => {
    if (window.top !== window) return;
    // ボタンは演出の後に押せるようになるので、出ている間は少しずつ押し直す（押せる前の押下は何も起きない）
    setInterval(() => {
      document.querySelector('.levelup-backdrop [data-test="levelup-ok"]')?.click();
      if (document.querySelector("#modal.show")) return;
      document.querySelector('[data-test="growth-board"][data-mode="light"] [data-test="board-decide"]')?.click();
    }, 250);
  });
}
