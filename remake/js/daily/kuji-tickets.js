// くじ券（KJ05）: 第5章の限定台くじ（data/kuji.json の limited の箱）を、お金を使わずに1回引ける券。
// 持っている限定の台がもう一度当たった時に1枚もらえる（daily/kuji.js）。第5章の寄り道（出張シーシャの依頼・各地の店めぐり帳など）からも
// grantKujiTickets(1, "理由") で渡せる。周回（NG+）には持ち越さない（core/carry.js）。
// 心得の盤・大会・エンディングの条件には使わない（#2455）。保存は呼び出し側が行う。
import { state } from "../core/state.js";
import { KUJI_TICKET_MAX } from "../core/rules.js";

/** 持っているくじ券の枚数（無い・壊れた値は0。上限より多くは数えない） */
export function kujiTickets(s = state) {
  const n = s?.kujiTickets;
  return Number.isInteger(n) && n > 0 ? Math.min(KUJI_TICKET_MAX, n) : 0;
}

/**
 * くじ券を n 枚渡す。reason は渡した理由の短い名前（"kuji_dupe"・"delivery" など。空は受け付けない）。
 * 上限（KUJI_TICKET_MAX）を超える分は渡さない。戻り値＝実際に増えた枚数（0 なら何も変えていない）。
 */
export function grantKujiTickets(n, reason, s = state) {
  if (!s || !Number.isInteger(n) || n <= 0 || typeof reason !== "string" || !reason) return 0;
  const before = kujiTickets(s);
  s.kujiTickets = Math.min(KUJI_TICKET_MAX, before + n);
  return s.kujiTickets - before;
}

/** くじ券を1枚使う。持っていなければ何もせず false（0枚より下にしない） */
export function spendKujiTicket(s = state) {
  const before = kujiTickets(s);
  if (!s || before <= 0) return false;
  s.kujiTickets = before - 1;
  return true;
}
