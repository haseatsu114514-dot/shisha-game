// 第1章の大会開始資源。旧保存の変換は core/state.js の migrate に集約する。
export function captureEntryResources(value) {
  if (value.chapter !== 1 || value.phase !== "tournament") return;
  if (!value.tournament.entryResources) {
    value.tournament.entryResources = {
      version: 1, flavorStock: { ...value.flavorStock },
      stamina: value.stamina, source: "entry",
    };
    value.tournament.stockSnap = { ...value.flavorStock };
  }
}

export function restoreEntryResources(value) {
  if (value.chapter !== 1 || value.phase !== "tournament") return;
  const entry = value.tournament.entryResources;
  if (entry?.version === 1 && Number.isFinite(entry.stamina) && entry.flavorStock) {
    value.flavorStock = { ...entry.flavorStock };
    value.stamina = entry.stamina;
  } else if (value.tournament.stockSnap) {
    // 開始体力が確認できない保存でも、従来の在庫復元は保つ。体力は推測しない。
    value.flavorStock = { ...value.tournament.stockSnap };
  }
  // restDay.illnessHealth や金銭・日付・能力・交流・報酬・再戦補助には触れない。
}

/**
 * #590 救済を選んだ挑戦だけ、開始資源を戻した直後に現在の最大体力まで回復する（全章共通）。
 * 開始時点の保存（entry）は書き換えない。救済なし・取消は戻した値のまま。何度呼んでも同じ値。
 */
export function applyAssistRecovery(value, assisted, maximum) {
  if (assisted !== true || !Number.isFinite(maximum) || maximum <= 0) return false;
  value.stamina = maximum;
  return true;
}
