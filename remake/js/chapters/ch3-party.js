import { DB, bgUrl } from "../core/data.js";
import { state, save } from "../core/state.js";
import { modal, setBg, showScreen, layers } from "../core/ui.js";
import { gainAffinity } from "../core/stats.js";
import { readDialogues } from "../core/chapter-data.js";
import { play } from "../vn/engine.js";
import { chapterThreePartyGuests, completeChapterThreeParty } from "./ch3-party-progress.js";

/** 取消・未読了・別セーブへのLOADは未開催。呼出元の一夜のcheckpointはここでは進めない。 */
export async function openChapterThreeParty({ signal, isCurrent = () => true } = {}) {
  const owner = state, selected = new Set();
  const current = () => state === owner && !signal?.aborted && isCurrent();
  const name = id => DB.characters[id]?.name || id;
  while (current()) {
    const eligible = chapterThreePartyGuests(owner);
    for (const id of selected) if (!eligible.includes(id)) selected.delete(id);
    if (eligible.length < 2) return false;
    const choice = await modal({ title: "ピザとシーシャの夜", body: `スティーブの店に、東京にいる仲間を2〜3人誘おう。\n選んだ人：${[...selected].map(name).join("、") || "まだいない"}`,
      options: [
        ...eligible.map(id => ({ label: `${selected.has(id) ? "✓ " : ""}${name(id)}`, value: id, test: `ch3-party-guest-${id}` })),
        ...(selected.size >= 2 ? [{ label: "この仲間で開く", value: "start", primary: true, test: "ch3-party-start" }] : []),
        { label: "戻る", value: null, test: "ch3-party-cancel" },
      ] });
    if (!current() || !choice) return false;
    if (choice !== "start") {
      if (selected.has(choice)) selected.delete(choice);
      else if (selected.size < 3 && eligible.includes(choice)) selected.add(choice);
      continue;
    }
    const dialogues = await readDialogues("ch3_growth_party", ["ch3_growth_pizza_party"]);
    if (!current()) return false;
    const source = dialogues.ch3_growth_pizza_party;
    const favorites = [...selected].map(id => DB.characters[id]?.favorite_flavor
      ? `${name(id)}が好きなのは、${DB.characters[id].favorite_flavor}。` : "").filter(Boolean).join("\n");
    const scene = { ...source, lines: source.lines.map(line => ({ ...line,
      text: line.text?.replace("{guests}", [...selected].map(name).join("、")).replace("{favorites}", favorites || "好きな味の話を、次に一緒に吸う日のために覚えておく。") })) };
    await setBg(bgUrl("bg_steve_shop", "night"), { instant: true });
    if (!current()) return false;
    showScreen("none", null); layers.hud.replaceChildren(); layers.hud.classList.remove("show");
    const result = await play(scene, { signal });
    if (!current() || !result || result.cancelled) return false;
    if (!completeChapterThreeParty(owner, [...selected], gainAffinity)) return false;
    save();
    return true;
  }
  return false;
}
