// 家で練習（#638 オーナー依頼「店であったシーシャ作りのパート練習は家にしたい。トナリでやれること増えすぎたので。
// 特に練習したいとこある？みたいな感じで」）。地図の家で「家で練習する」を選ぶと、通しの一台か工程ひとつを選ぶ。1行動。
import { el } from "../core/util.js";
import { bgUrl } from "../core/data.js";
import { state, timeOfDay } from "../core/state.js";
import { addStamina } from "../core/stats.js";
import { modal, setBg, showScreen, retire } from "../core/ui.js";
import { SE } from "../core/audio.js";
import { runDrill, DRILLS } from "../craft/session.js";
import { runFullPractice } from "../craft/practice.js";
import { homeRig } from "./home-rig.js";
import { flavorStock, addFlavorStock, ownedFlavorIds } from "./shop.js";

export const HOME_PRACTICE_STAMINA = { full: -12, drill: -10 };
/** 一台を通すのに要る自分の葉（配合の最低量と同じ） */
export const HOME_PRACTICE_GRAMS = 12;

/** 自宅練習は寝る前（夜・slot 1以上）限定 */
export const isHomePracticeTime = (s = state) => (s?.slot ?? 0) >= 1;

/** 一台を通せるだけの葉があるか（家の練習は自分の葉を使う・#638） */
export const homeLeavesEnough = () => ownedFlavorIds().reduce((sum, id) => sum + flavorStock(id), 0) >= HOME_PRACTICE_GRAMS;

/**
 * 一台を作り終えたときだけ、配合に使った葉を減らす（#638 オーナー決定「葉を消費する」）。
 * 途中で閉じた・再読込した・LOADした一台はここまで来ないので減らない。
 * 保存は呼び出し側の行動の終わり（calendar の afterAction）で、体力と同時に一度だけ。
 */
export function consumeHomePracticeLeaves(mix) {
  for (const [id, g] of Object.entries(mix || {})) if (g > 0) addFlavorStock(id, -g);
}

/** 何を練習するか（"full" か工程ID）。やめたら null */
export function chooseHomePractice() {
  if (!isHomePracticeTime()) return Promise.resolve(null);
  return new Promise((resolve) => {
    setBg(bgUrl("bg_home", timeOfDay()), { fast: true });
    const pick = (value) => { retire(root); resolve(value); };
    const opt = (title, desc, value, test, disabled = false) => el("button.big-choice", { disabled: disabled || null, dataset: { test }, onclick: () => { SE.select(); pick(value); } },
      [el("b", { text: title }), el("small", { text: desc })]);
    const leaves = homeLeavesEnough();
    const best = (id) => "★".repeat(Math.max(0, state.best?.[id] ?? 0)) || "なし";
    const root = showScreen("home", el("div.sub-menu", [
      el("h2.sub-title", { text: "家で練習" }),
      el("p.sub-lead", { text: "（特に練習したいところ、あるかな）" }),
      el("div.sub-choices.grid", [
        opt("一台を通して", leaves ? "配合から提供・2回の調整まで（自分の葉と体力を少し使う）" : `自分の葉が${HOME_PRACTICE_GRAMS}gないので作れない`, "full", "home-practice-full", !leaves),
        ...Object.entries(DRILLS).map(([id, d]) => opt(d.label, `${d.desc}（自己ベスト ${best(id)}）`, id, `drill-${id}`)),
      ]),
      el("button.btn.ghost.small.sub-back", { text: "← マップに戻る", dataset: { test: "home-practice-back" }, onclick: () => { SE.cancel(); pick(null); } }),
    ]));
  });
}

/** 家で練習する（1行動）。staminaGuard は calendar の体力確認。やめたら used: false */
export async function runHomePractice({ staminaGuard }) {
  if (!isHomePracticeTime()) return { used: false, exerted: false };
  if (!homeRig()) return { used: false, exerted: false };
  const pick = await chooseHomePractice();
  if (!pick) return { used: false, exerted: false };
  const cost = pick === "full" ? HOME_PRACTICE_STAMINA.full : HOME_PRACTICE_STAMINA.drill;
  if (!(await staminaGuard(cost))) return { used: false, exerted: false };
  addStamina(cost);
  state.flags._home_tonight = state.slot >= 1; // 夜に家で練習したら、そのまま家で一日を終える（帰宅の場面は出さない）
  if (pick === "full") {
    const cs = await runFullPractice({ venue: "home" });
    consumeHomePracticeLeaves(cs.ownLeavesUsed); // 課題の支給分は大会と同じく減らさない
    return { used: true, exerted: true };
  }
  let again;
  do {
    const tier = await runDrill(pick, { venue: "home" });
    state.best[pick] = Math.max(state.best[pick] ?? -1, tier);
    again = await modal({ title: "もう一回練習しますか？",
      body: "同じ工程を繰り返せます。能力値は増えません。",
      options: [
        { label: "もう一回練習する", value: true, test: "drill-again" },
        { label: "練習を終える", value: false, primary: true, test: "drill-finish" },
      ] });
  } while (again);
  return { used: true, exerted: true };
}
