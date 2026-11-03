// 選ぶ前に、一式の特徴を読む。採点や温度の計算は既存モデルに任せる。
import { el } from "../core/util.js";
import { DB } from "../core/data.js";
import { equipSpecOf, temperatureBands } from "./temperature-model.js";
import { coalWarmth } from "./coals.js";
import { usesFoil } from "./holes_logic.js";

export function equipmentPreview(cs, { candidate = false } = {}) {
  const bowl = equipSpecOf(cs.equip.bowl), hms = equipSpecOf(cs.equip.hms);
  // 配置・混合は後の工程で選ぶ。個別比較と同じく、選んだ炭3個で読む。
  const heat = coalWarmth({ equip: cs.equip, place: "triangle" });
  const width = temperatureBands({ equip: cs.equip }).equipWidth;
  const foil = usesFoil(cs);
  const rows = [
    ["葉を詰める量", `最大${bowl?.capacity || DB.equipById[cs.equip.bowl]?.capacity || 12}g`],
    ["適温の合わせやすさ", `適温幅 ×${width.toFixed(2)}（道具一式の補正）`],
    ["熱の安定", `仕上がり補正 +${hms?.stabilityBonus || 0}`],
    ["炭3個の加熱", `×${heat.power.toFixed(2)}。${heat.power > 1 ? "熱が強く入るので、過熱に気をつけよう" : "穏やかに熱を入れる一式"}`],
    ["熱を入れる吸い", `反応 ×${heat.pullResponse.toFixed(2)}。大きいほど1口で熱が入る`],
    ["アルミの工程", foil ? "あり：アルミを張って、穴を開ける" : "なし：穴あけを飛ばして、通気を選ぶ"],
  ];
  return el("section.equipment-guide.equipment-set-preview", { dataset: { test: "setup-preview" }, "aria-label": "一式の性能プレビュー" }, [
    el("b", { text: candidate ? "この候補で組む一式" : "いま選んでいる一式" }),
    el("small.flavor-guide-caption", { text: ["bowl", "hms", "charcoal"].map(type => DB.equipById[cs.equip[type]]?.name || cs.equip[type]).join(" ／ ") }),
    el("dl.equipment-guide-rows", rows.flatMap(([label, value]) => [el("dt", { text: label }), el("dd", { text: value })])),
    el("small.flavor-guide-caption", { text: "炭は3個での目安。葉の配合や、この後の配置・吸い方でも仕上がりは変わるよ" }),
  ]);
}
