import { chapterDay } from "../core/chapter-clock.js";
import { el } from "../core/util.js";
import { displayName } from "./presentation.js";
import { savedTrpgRecords, trpgReplayScenes } from "./play-record.js";
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
  const control = (text, test, onclick) => el("button.trpg-button", { type: "button", text, dataset: { test }, onclick });
  const runLabel = record => "第" + record.play + "回 · CH." + record.chapter + " DAY " + record.day + " · " + record.ending;
  const content = [
    el("p", { text: "保存された選択、確定した出目、結末・後日談を再生します。" }),
    ...(entries.length ? entries.map(({ id, title, memory, records, plays, scenario }) =>
      el("section.trpg-shelf-help-item", { dataset: { test: "trpg-shelf-story-" + id } }, [
        el("h3", { text: title }),
        ...records.slice().reverse().map(record => {
          const replay = control(runLabel(record) + " · 再生", "trpg-shelf-run-" + id + "-" + record.play,
            () => start(record, replay));
          return el("p", replay);
        }),
        ...(records.length < plays ? [el("p", { text: "詳しい記録のない回は、結末の概要だけ残っています。" }),
          el("p", { text: date(memory) + " · " + (memory.endingTitle || scenario?.endings?.[memory.ending]?.title || memory.ending)
            + " · " + memory.participants.map(id => displayName(characters, id)).join("・") })] : []),
      ])) : [el("p", { text: "卓を遊び終えると、ここに記録が残ります。" })]),
  ];
  const panel = openShelfPanel(root, { title: "本棚", content, test: "trpg-bookshelf" });

  function start(record, replay) {
    const { scenes, grouped } = trpgReplayScenes(record);
    const progress = el("p", { role: "status", dataset: { test: "trpg-replay-progress" } });
    const screen = el("section.trpg-shelf-help-item", { tabindex: "-1", dataset: { test: "trpg-replay-scene" } });
    let index = 0;
    const list = control("一覧へ戻る", "trpg-replay-list", () => {
      panel.setActions([]);
      panel.body.replaceChildren(...content);
      panel.body.scrollTop = 0;
      replay.focus();
    });
    const back = control("戻る", "trpg-replay-back", () => { if (index > 0) { index--; render(); } });
    const next = control("次へ", "trpg-replay-next", () => { if (index + 1 < scenes.length) { index++; render(); } });
    panel.setActions([list, back, next]);
    panel.body.replaceChildren(
      el("h3", { text: record.title }),
      el("p", { text: runLabel(record) }),
      el("p", { text: "参加者：" + record.participants.join("・") }),
      grouped ? el("p", { text: "この回は選択・判定・結末のまとまりごとに再生します。" }) : "",
      progress, screen,
    );
    render();
    screen.focus({ preventScroll: true });

    function render() {
      const scene = scenes[index];
      progress.textContent = "場面 " + (index + 1) + " / " + scenes.length;
      const details = scene.ending ? [
        ...record.lines.map(([speaker, text]) => el("p.trpg-log-line", [el("strong", { text: speaker }), text])),
        el("h4", { text: record.ending }),
        ...(record.endingLine ? [el("p", { text: record.endingLine })] : []),
      ] : [["選んだこと", scene.choices], ["判定結果", scene.rolls]]
        .filter(([, items]) => items.length)
        .map(([label, items]) => el("section", [
          el("h4", { text: label }),
          el("ul", items.map(text => el("li", { text }))),
        ]));
      screen.replaceChildren(el("h3", { text: scene.title }), ...details);
      panel.body.scrollTop = 0;
      const focused = document.activeElement;
      back.disabled = index === 0;
      next.disabled = index === scenes.length - 1;
      if ((focused === back && back.disabled) || (focused === next && next.disabled)) screen.focus({ preventScroll: true });
    }
  }
}
