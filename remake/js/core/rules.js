// 進行とHUDで共有するルール。大会前の日常はDAY1〜13、大会はDAY14。
export const TOURNAMENT_DAY = 14;
export const MAX_MONEY = 999_999;
export const RIO_AWAY_DAY = 2; // day % 7 === 2 は凛想が出張で不在
// 第5章の限定台くじ（KJ05・data/kuji.json の limited の箱）と、その箱だけで当たる台。
// 周回（NG+）へ持ち越さず、箱を引き切っても心得の盤の火種を付けない（#2455: くじを本編・全盤コンプの条件にしない）。
// 分類テスト（remake/test/kuji_limited.mjs）が data 側と一致するか照合する。
export const KUJI_LIMITED_GRADES = ["g20000"];
export const KUJI_ONLY_EQUIPMENT = ["stand_custom_melty", "stand_custom_tosu", "stand_custom_engraved"];
export const KUJI_TICKET_MAX = 99; // くじ券（限定台くじを1回ずつ引ける券）を持てる上限
