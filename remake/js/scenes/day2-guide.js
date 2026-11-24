import { el } from "../core/util.js";
import { modal } from "../core/ui.js";
import { state } from "../core/state.js";
import { TOURNAMENT_DAY } from "../core/rules.js";
import { regulationFor } from "../craft/steps.js";
import { openRuleSheet } from "./rule-sheet.js";

export async function openDay2Guide() {
  const owner = state;
  if (owner?.chapter !== 1) return;
  const topics = [
    ["大会", `DAY${TOURNAMENT_DAY}にC.STATIONと同じビルのイベントホールでSMOKE CROWN CUP。${regulationFor({ mode: "tournament" }).label}。`],
    ["公式アプリ", "会場の案内がMOKUMOKUパッキーに届く。体力を使う自由行動のたびに自動で1回転。遊び方は地図のパッキーをタップ。"],
    ["昼と夜", "昼と夜で1回ずつ動ける。夜に予定がある日は、地図の「！」が目印。"],
    ["配達", "PEPPERMINTにミント、EDENに古いダブルアップルを届け、tonariへ報告。配達で体力や行動枠は使わない。"],
  ];
  const body = el("div.glossary", { dataset: { test: "day2-guide" } }, [
    el("div.gl-body", topics.map(([title, desc]) => el("section.gl-term", [el("b", { text: title }), el("p", { text: desc })]))),
  ]);
  while (state === owner) {
    const choice = await modal({
      title: "DAY2の案内",
      className: "glossary-modal",
      body,
      options: [
        { label: "閉じる", value: null, test: "day2-guide-close" },
        { label: "大会の規則", value: "rules", primary: true, test: "day2-guide-rules" },
      ],
    });
    if (choice !== "rules" || state !== owner) return;
    await openRuleSheet();
  }
}
