import { DB } from "./data.js";
import { gainCard } from "./ui.js";

// 獲得処理の戻り値だけを通知。描画・LOADから経験値や通知を再生成しない。
export function notifyMastery(gains) {
  for (const gain of gains) {
    if (gain.level <= gain.before) continue;
    gainCard({ kind: "info", badge: "★", top: "熟練度アップ", main: DB.flavorById[gain.id]?.short_name || gain.id,
      sub: `${"★".repeat(gain.before)}${"☆".repeat(5 - gain.before)} → ${"★".repeat(gain.level)}${"☆".repeat(5 - gain.level)}${gain.level === 5 ? " MAX" : ""}` });
  }
}
