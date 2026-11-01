// 東京のライブハウスの「DJナイト」（第3章の夜の自由時間・DJS10）。地図の行き先から開く。
// ミニゲームなので時間・お金・体力・好感度は変えない（#2113）。記録だけを state.dj に残して保存する。
// 地図への接続（chapters/ch3.js の freeTimeChoices と openTokyoMap）は、同じファイルを変えている PR #2166 の完了後に足す:
//   freeTimeChoices:  ...djNightChoices(value, window),
//   openTokyoMap:     if (action?.dj) { await visitDjClub({ isCurrent: () => current(owner) }); if (current(owner)) await renderStage(owner); return; }
import { state, save, config } from "../core/state.js";
import { el } from "../core/util.js";
import { layers, showScreen, setBg, toast } from "../core/ui.js";
import { playBgm, stopBgm, currentBgm } from "../core/audio.js";
import { DJ_SETS, djRecords, djSetOpen, recordDjResult, runDjSet } from "../minigames/dj.js";

export { DJ_NIGHT, djNightChoices } from "../minigames/dj.js";
const BACKGROUND = new URL("../../img/ui/dj/bg-purple.webp", import.meta.url).href;
let active = false;

const bestText = (s, id) => {
  const item = djRecords(s).sets[id];
  if (!djSetOpen(s, id)) return `${DJ_SETS[id - 2]?.name || "前のセット"}を回しきると開く`;
  return item.best ? `自己ベスト ${item.best.rank}・${item.best.total}点 · ${item.plays}回` : `${DJ_SETS[id - 1].tracks}曲をつなぐ · まだ記録はありません`;
};

/** 入ってセットを選ぶ。戻ると false を返す（遊んでも行動は進まないので常に false）。 */
export async function visitDjClub({ isCurrent = () => true, signal = null } = {}) {
  if (active || !state || state.chapter !== 3 || signal?.aborted || !isCurrent()) return false;
  active = true;
  const owner = state, controller = new AbortController();
  const current = () => !controller.signal.aborted && state === owner && isCurrent();
  const cancel = () => controller.abort();
  signal?.addEventListener("abort", cancel, { once: true });
  window.addEventListener("pagehide", cancel, { once: true });
  const bgmBefore = currentBgm();
  try {
    await setBg(BACKGROUND, { fast: true });
    while (current()) {
      const host = el("div.sub-menu.dj-club-menu", { dataset: { test: "dj-club-menu" } });
      const pick = await new Promise(resolve => {
        controller.signal.addEventListener("abort", () => resolve(null), { once: true });
        host.append(el("h2.sub-title", { text: "ライブハウス・DJナイト" }),
          el("p.sub-lead", { text: "今夜はオープンデッキ。▶と横フェーダーで曲をつなぐ。時間は進まない。" }),
          el("div.sub-choices", DJ_SETS.map(set => el("button.big-choice", {
            type: "button", disabled: !djSetOpen(owner, set.id), dataset: { test: `dj-set-${set.id}` },
            onclick: () => { if (djSetOpen(owner, set.id)) resolve(set.id); },
          }, [el("b", { text: `${set.name}　${set.label}` }), el("small", { text: bestText(owner, set.id) })]))),
          el("button.btn.ghost.small.sub-back", { type: "button", text: "← 地図に戻る", dataset: { test: "dj-club-back" }, onclick: () => resolve(null) }));
        showScreen("dj-club", host);
      });
      if (!pick || !current()) break;
      host.hidden = true;
      stopBgm(0.4);
      await runDjSet({ host: document.getElementById("stage") || layers.screen, set: pick, signal: controller.signal,
        muted: !!config.mute, volume: config.bgmVolume,
        onResult: result => {
          if (!current()) return;
          const saved = recordDjResult(owner, result);
          if (!saved) return;
          save();
          if (saved.newBest) toast(`${DJ_SETS[result.set - 1].name} 自己ベスト ${result.rank}・${result.total}点`, { kind: "good" });
        } });
      if (bgmBefore && current()) playBgm(bgmBefore);
    }
    return false;
  } finally {
    signal?.removeEventListener("abort", cancel);
    window.removeEventListener("pagehide", cancel);
    controller.abort(); active = false;
    if (bgmBefore && state === owner && currentBgm() !== bgmBefore) playBgm(bgmBefore);
  }
}
