import { chapterDay } from "../core/chapter-clock.js";
import { el } from "../core/util.js";
import { displayName } from "./presentation.js";
import { savedTrpgRecords } from "./play-record.js";
import { openShelfPanel } from "./shelf-help.js";

export function openTrpgBookshelf(root, state, scenarios, characters) {
  const date = entry => {
    // Older chapter-local dates are kept as written in #3892.
    const flags = entry.day >= (state?.flags?._ch2_day1?.startDay ?? Infinity) ? state.flags : {};
    return "CH." + entry.chapter + " DAY " + chapterDay({ ...entry, flags });
  };
  const entries = Object.entries(state?.trpg?.cleared || {}).flatMap(([id, memory]) => {
    if (!memory || typeof memory.ending !== "string" || !Array.isArray(memory.participants)
      || !Number.isInteger(memory.chapter) || !Number.isInteger(memory.day)) return [];
    const records = savedTrpgRecords(memory);
    const scenario = scenarios.find(story => story.id === id);
    const title = records.at(-1)?.title || scenario?.title || id;
    const plays = Number.isSafeInteger(memory.plays) && memory.plays > 0 ? memory.plays : 1;
    return [{ id, title, memory, records, plays, scenario }];
  });
  const content = entries.length ? entries.map(({ id, title, memory, records, plays, scenario }) =>
    el("section.trpg-shelf-help-item", { dataset: { test: "trpg-shelf-story-" + id } }, [
      el("h3", { text: title }),
      ...records.slice().reverse().map(record => el("details", { dataset: { test: "trpg-shelf-run-" + id + "-" + record.play } }, [
        el("summary", { text: "第" + record.play + "回 · CH." + record.chapter + " DAY " + record.day + " · " + record.ending }),
        el("p", { text: "参加者：" + record.participants.join("・") }),
        ...[["選んだこと", record.choices], ["判定結果", record.rolls]].filter(([, items]) => items.length)
          .map(([label, items]) => el("section", [el("h4", { text: label }), el("ul", items.map(text => el("li", { text })))])),
        ...(record.lines.length || record.endingLine ? [el("section", [
          el("h4", { text: "結末・後日談" }),
          record.endingLine ? el("p", { text: record.endingLine }) : null,
          ...record.lines.map(([speaker, text]) => el("p.trpg-log-line", [el("strong", { text: speaker }), text])),
        ])] : []),
      ])),
      ...(records.length < plays ? [el("p", { text: "詳しい記録のない回は、結末の概要だけ残っています。" }),
        el("p", { text: date(memory) + " · " + (memory.endingTitle || scenario?.endings?.[memory.ending]?.title || memory.ending)
          + " · " + memory.participants.map(id => displayName(characters, id)).join("・") })] : []),
    ])) : [el("p", { text: "卓を遊び終えると、ここに記録が残ります。" })];
  openShelfPanel(root, { title: "本棚", content, test: "trpg-bookshelf" });
}
