// はじめて盤で灯せる時に、手元の火種をこの数にそろえる（持っている分との差だけ白火を渡す）。
// 2026-11-20 オーナー「最初に8個も貰えるの多すぎる気がするから3個とかにしたい、最初あるのは」（SBD153）: 6つ渡す → 手元が3つになるまで。
// それまでは、最初のレベルアップの2つと合わせて8つになり、♥5が要る授業の手前まで初日に届いていた
export const STARTER_HIDANE = 3;
/** schema27 以前に渡していた数（旧SAVEの会計補正だけに使う。実際に渡した6を累計へ足す） */
export const LEGACY_STARTER_HIDANE = 6;
export const STARTER_FLAG = "_board_starter_given";
