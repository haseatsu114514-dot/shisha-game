// 東京の路地の地下のクラブ「SEAM」（第3章の夜の自由時間・DJS10/DJS12）。店主は針間ヨル（characters.json の yoru）。
// 初めて入る夜だけ出会いの場面（ch3_club_first → 登場カットイン → ch3_club_first_after）、初めてAランク以上を出した夜だけヨルとの会話（ch3_club_a_talk）を流す。
// ミニゲームなので時間・お金・体力・好感度は変えない（#2113）。記録（state.dj）と既読フラグだけを保存する。
// 入口は chapters/ch3.js の freeTimeChoices（djNightChoices）と openTokyoMap（action.dj → visitDjClub）。
import { state, save, config } from "../core/state.js";
import { el } from "../core/util.js";
import { DB, bgUrl } from "../core/data.js";
import { layers, showScreen, setBg, toast } from "../core/ui.js";
import { playBgm, stopBgm, currentBgm } from "../core/audio.js";
import { venueHost } from "../core/venue-host.js";
import { readDialogues } from "../core/chapter-data.js";
import { play } from "../vn/engine.js";
import { playIntro } from "../vn/intro.js";
import { CLUB_MET_FLAG, DJ_SETS, djRecords, djSetOpen, recordDjResult, runDjSet } from "../minigames/dj.js";

export { DJ_NIGHT, DJ_NIGHT_FIRST, djNightChoices, clubKnown } from "../minigames/dj.js";
export const CLUB_A_TALK_FLAG = "_club_yoru_a_talk";
const DIALOGUE_IDS = ["ch3_club_first", "ch3_club_first_after", "ch3_club_a_talk", "venue_yoru_greet", "venue_yoru_return",
  "venue_yoru_set_S", "venue_yoru_set_A", "venue_yoru_set_B", "venue_yoru_set_C"];
// 背景（Issue #2199）: 初回の階段の上は入口、名乗った後に階段を下りると店内（台詞の bg 行）、メニューとAの会話は店内。
const ENTRANCE = () => bgUrl("bg_club_seam_entrance", "night");
const INSIDE = () => bgUrl("bg_club_seam", "night");
let active = false;
let dialogueTask = null;

export function loadClubDialogues() {
  if (!dialogueTask) dialogueTask = readDialogues("ch3_club", DIALOGUE_IDS).then(dialogues => {
    for (const id of DIALOGUE_IDS) DB.dialogues[id] = dialogues[id];
    return dialogues;
  }).catch(error => { dialogueTask = null; throw error; });
  return dialogueTask;
}

const firstLine = (dialogues, id) => dialogues[id]?.lines?.[0]?.text || "";
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
  let dialogues = null;
  // VN は正常に読み終えた時だけ既読にする。中断は同じ夜の地図へ戻る。
  const read = async id => {
    showScreen("none", null);
    layers.hud.replaceChildren(); layers.hud.classList.remove("show");
    const result = await play(dialogues[id], { signal: controller.signal });
    return current() && !!result && !result.cancelled;
  };
  const done = flag => { owner.flags[flag] = true; save(); return true; };
  // 初回: ヨルが名乗るまで（名前は「？？？」）→ 登場カットイン（面識もここで付く。斧投げBarのマキと同じ）→ 続き。
  const meet = async () => {
    if (!await read("ch3_club_first")) return false;
    await playIntro("yoru");
    if (!current() || !await read("ch3_club_first_after")) return false;
    return done(CLUB_MET_FLAG);
  };
  try {
    dialogues = await loadClubDialogues();
    if (!current()) return false;
    const first = owner.flags[CLUB_MET_FLAG] !== true;
    await setBg(first ? ENTRANCE() : INSIDE(), { fast: true });
    if (!current()) return false;
    if (first && !await meet()) return false;
    while (current()) {
      const records = djRecords(owner), played = Object.values(records.sets).some(item => item.plays > 0);
      const host = el("div.sub-menu.dj-club-menu", { dataset: { test: "dj-club-menu" } });
      const pick = await new Promise(resolve => {
        controller.signal.addEventListener("abort", () => resolve(null), { once: true });
        host.append(el("h2.sub-title", { text: "クラブSEAM" }),
          venueHost("yoru", firstLine(dialogues, played ? "venue_yoru_return" : "venue_yoru_greet"), DB),
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
      const { results } = await runDjSet({ host: document.getElementById("stage") || layers.screen, set: pick, signal: controller.signal,
        muted: !!config.mute, volume: config.bgmVolume,
        onResult: result => {
          if (!current()) return;
          const saved = recordDjResult(owner, result);
          if (!saved) return;
          save();
          if (saved.newBest) toast(`${DJ_SETS[result.set - 1].name} 自己ベスト ${result.rank}・${result.total}点`, { kind: "good" });
        } });
      if (!current()) break;
      if (bgmBefore) playBgm(bgmBefore);
      const last = results.at(-1);
      if (last) toast(`針間ヨル「${firstLine(dialogues, `venue_yoru_set_${last.rank}`)}」`);
      if (results.some(item => item.rank === "A" || item.rank === "S") && owner.flags[CLUB_A_TALK_FLAG] !== true) {
        await setBg(INSIDE(), { fast: true });
        if (!current() || !await read("ch3_club_a_talk")) break;
        done(CLUB_A_TALK_FLAG);
      }
    }
    return false;
  } finally {
    signal?.removeEventListener("abort", cancel);
    window.removeEventListener("pagehide", cancel);
    controller.abort(); active = false;
    if (bgmBefore && state === owner && currentBgm() !== bgmBefore) playBgm(bgmBefore);
  }
}
