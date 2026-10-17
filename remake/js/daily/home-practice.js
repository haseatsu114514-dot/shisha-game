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

export const HOME_PRACTICE_STAMINA = { full: -12, drill: -10 };

/** 何を練習するか（"full" か工程ID）。やめたら null */
export function chooseHomePractice() {
  return new Promise((resolve) => {
    setBg(bgUrl("bg_home", timeOfDay()), { fast: true });
    const pick = (value) => { retire(root); resolve(value); };
    const opt = (title, desc, value, test) => el("button.big-choice", { dataset: { test }, onclick: () => { SE.select(); pick(value); } },
      [el("b", { text: title }), el("small", { text: desc })]);
    const best = (id) => "★".repeat(Math.max(0, state.best?.[id] ?? 0)) || "なし";
    const root = showScreen("home", el("div.sub-menu", [
      el("h2.sub-title", { text: "家で練習" }),
      el("p.sub-lead", { text: "（特に練習したいところ、あるかな）" }),
      el("div.sub-choices.grid", [
        opt("一台を通して", "配合から提供・2回の調整まで（体力を少し使う）", "full", "home-practice-full"),
        ...Object.entries(DRILLS).map(([id, d]) => opt(d.label, `${d.desc}（自己ベスト ${best(id)}）`, id, `drill-${id}`)),
      ]),
      el("button.btn.ghost.small.sub-back", { text: "← マップに戻る", dataset: { test: "home-practice-back" }, onclick: () => { SE.cancel(); pick(null); } }),
    ]));
  });
}

/** 家で練習する（1行動）。staminaGuard は calendar の体力確認。やめたら used: false */
export async function runHomePractice({ staminaGuard }) {
  const pick = await chooseHomePractice();
  if (!pick) return { used: false, exerted: false };
  const cost = pick === "full" ? HOME_PRACTICE_STAMINA.full : HOME_PRACTICE_STAMINA.drill;
  if (!(await staminaGuard(cost))) return { used: false, exerted: false };
  addStamina(cost);
  state.flags._home_tonight = state.slot >= 1; // 夜に家で練習したら、そのまま家で一日を終える（帰宅の場面は出さない）
  if (pick === "full") {
    await runFullPractice({ venue: "home" });
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
