import { DB } from "./data.js";
import { flavorFamily, MASTERY_THRESHOLDS } from "./flavor-mastery.js";
import { gainCard } from "./ui.js";
import { flavorPackageArt } from "../daily/shop.js";

// 獲得処理の戻り値だけを通知。描画・LOADから経験値や通知を再生成しない。
export function notifyMastery(gains, mix = {}) {
  for (const gain of gains) {
    if (gain.level <= gain.before) continue;
    // 同系統が入っていたら、今回もっとも多く使った銘柄の箱を見せる。経験値の集計は変えない。
    const used = Object.entries(mix)
      .filter(([id, grams]) => Number.isFinite(grams) && grams > 0 && flavorFamily(id, DB.flavorById) === gain.id)
      .sort((a, b) => b[1] - a[1]);
    const id = used[0]?.[0] || gain.id;
    gainCard({ kind: "info", top: "熟練度アップ", main: DB.flavorById[id]?.short_name || gain.id,
      mastery: { level: gain.level, total: MASTERY_THRESHOLDS.length, packageArt: () => flavorPackageArt(id, 64) } });
  }
}
