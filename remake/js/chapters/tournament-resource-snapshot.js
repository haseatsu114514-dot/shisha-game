// 第2・3章の資源スナップショット。保存・工程の進行判断は章側に残す。
// JSONによるコピーと、復元時の全キー代入は既存の保存契約を維持する。
const copy = value => JSON.parse(JSON.stringify(value));

export function tournamentResources(value) {
  return copy({ flavorStock: value.flavorStock, stamina: value.stamina,
    equip: value.equip, recipes: value.recipes, stats: value.stats });
}

export function restoreTournamentResources(value, snapshot) {
  for (const [key, data] of Object.entries(copy(snapshot))) value[key] = data;
}
