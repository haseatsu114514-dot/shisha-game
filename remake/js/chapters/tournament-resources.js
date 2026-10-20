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
