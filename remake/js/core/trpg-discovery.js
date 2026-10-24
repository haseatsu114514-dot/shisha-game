// 店の場所は零から聞いた時に知る。旧版で始めた部活・購入・プレイは残す。
export function knowsTrpgBar(value) {
  return !!value && value.chapter >= 2 && !!(value.flags?._rei_trpg_introduced
    || value.trpg?.club?.founded || value.trpg?.owned?.length
    || Object.keys(value.trpg?.cleared || {}).length);
}
