// tonari（バイト先）: 客として一服／シフトに入る（接客→シフト後にスミさん・自主練）。
import { el, pick } from "../core/util.js";
import { DB, bgUrl } from "../core/data.js";
import { showScreen, setBg, toast, retire } from "../core/ui.js";
import { state, timeOfDay } from "../core/state.js";
import { addMoney, addStamina, applyStats, star } from "../core/stats.js";
import { SE, playBgm } from "../core/audio.js";
import { play } from "../vn/engine.js";
import { visitChar, storyCount, VISIT_SEQ } from "./spots.js";
import { runDrill, DRILLS } from "../craft/session.js";

const TONARI_BG = "res://assets/backgrounds/bg_tonari_inside.png";

/** tonari に入ったときのサブメニュー。戻るなら null */
export function tonariMenu() {
  return new Promise((resolve) => {
    setBg(bgUrl(TONARI_BG, timeOfDay()));
    playBgm("tonari");
    const tsumugiKnown = !!state.met.tsumugi;
    const pickIt = (value) => { retire(root); resolve(value); };
    const opt = (title, desc, value, test) =>
      el("button.big-choice", { dataset: { test }, onclick: () => { SE.select(); pickIt(value); } }, [
        el("b", { text: title }), el("small", { text: desc }),
      ]);
    const root = showScreen("tonari", el("div.sub-menu", [
      el("h2.sub-title", { text: "tonari" }),
      el("p.sub-lead", { text: "カウンターの奥で、スミさんが炭を切っている。今日はどうする？" }),
      el("div.sub-choices", [
        opt("お客さんとして一服", tsumugiKnown ? "客席でゆっくり。常連席にはつむぎがいる" : "客席でゆっくり。常連席にはいつもの子がいる", "customer", "tonari-customer"),
        opt("シフトに入る（バイト）", "接客で稼ぐ。上がったあとはスミさんと話すか、裏で自主練もできる", "baito", "tonari-baito"),
      ]),
      el("button.btn.ghost.small.sub-back", { text: "← マップに戻る", dataset: { test: "sub-back" }, onclick: () => { SE.cancel(); pickIt(null); } }),
    ]));
  });
}

export async function tonariCustomer() {
  addStamina(-10);
  await visitChar("tsumugi");
}

// ---------------------------------------------------------------- バイト

const CHARM_BONUS = [0, 500, 1200, 2000, 3000]; // 魅力★で指名・リピートが増える

export async function doBaito() {
  addStamina(-24);
  playBgm("tonari");
  state.baitoCount = (state.baitoCount || 0) + 1;
  await play("remake_baito_start", { bg: TONARI_BG });
  const n = state.baitoCount;
  // 正体を伏せた客が一度だけ混ざる（後の章・大会当日で回収される伏線）
  if (n === 2 && !state.flags._ev_rei_cameo) {
    state.flags._ev_rei_cameo = true;
    await play("ch1_rei_cameo", { bg: TONARI_BG });
  } else if (n >= 3 && state.day >= 4 && !state.flags._ev_reviewer_cameo) {
    state.flags._ev_reviewer_cameo = true;
    await play("ch1_reviewer_cameo", { bg: TONARI_BG });
  } else if (n >= 4 && state.day >= 6 && !state.flags._ev_maezono_cameo) {
    state.flags._ev_maezono_cameo = true;
    await play("ch1_maezono_cameo", { bg: TONARI_BG });
  } else {
    await customerEvent();
  }
  const bonus = CHARM_BONUS[star("charm") - 1];
  const pay = 8000 + bonus;
  await play("remake_baito_end", { bg: TONARI_BG });
  addMoney(pay);
  if (bonus) toast(`常連さんの指名が増えてきた。売上ボーナス +${bonus.toLocaleString()}円`, { kind: "good" });
  await afterShift();
}

/** baito_events.json の接客イベントを会話に変換して再生 */
async function customerEvent() {
  const used = (state.usedBaito = state.usedBaito || []);
  const pool = DB.baito.filter((e) => !used.includes(e.id));
  const ev = pick(pool.length ? pool : DB.baito);
  used.push(ev.id);
  state.notes[ev.id] = (state.notes[ev.id] || 0) + 1;
  const narr = (t) => String(t || "").split("\n").filter(Boolean).map((text) => ({ speaker: "", face: "", text }));
  const branches = {};
  const choices = (ev.choices || []).map((c, i) => {
    // 選んだ対応の売上ボーナス（店から）もここで乗せる。チップ文化は無い（CLAUDE.md）
    branches[`c${i}`] = [...narr(c.result), { type: "apply", stats: c.stats || {}, money: c.money_bonus || 0 }];
    return { text: c.text, next: `c${i}` };
  });
  const dlg = {
    dialogue_id: `baito_${ev.id}`,
    lines: [...narr(ev.text), ...(choices.length ? [{ type: "choice", id: "baito", choices }] : [])],
    branches,
  };
  await play(dlg, { bg: TONARI_BG });
}

/** シフト後: スミさんと話す（固有会話）／裏で自主練（ドリル）／そのまま上がる */
function afterShiftMenu() {
  return new Promise((resolve) => {
    const sumiNew = storyCount("sumi") < VISIT_SEQ.sumi.length;
    const opt = (title, desc, value, test) =>
      el("button.big-choice", { dataset: { test }, onclick: () => { SE.select(); retire(root); resolve(value); } }, [el("b", { text: title }), el("small", { text: desc })]);
    const root = showScreen("tonari", el("div.sub-menu", [
      el("h2.sub-title", { text: "シフト上がり" }),
      el("p.sub-lead", { text: "閉店作業のあと、まだ少しだけ時間がある。" }),
      el("div.sub-choices", [
        opt("スミさんと話す", sumiNew ? "今日は何か教えてもらえそうだ" : "閉店後の一台を分けてもらう", "sumi", "after-sumi"),
        opt("裏の作業台で自主練", "工程をひとつ選んで反復する（体力を少し使う）", "drill", "after-drill"),
        opt("まっすぐ上がる", "今日はここまで", "none", "after-none"),
      ]),
    ]));
  });
}

async function afterShift() {
  const pickAfter = await afterShiftMenu();
  if (pickAfter === "sumi") {
    await visitChar("sumi");
  } else if (pickAfter === "drill") {
    const kind = await chooseDrill();
    addStamina(-8);
    const tier = await runDrill(kind);
    const d = DRILLS[kind];
    applyStats({ [d.stats[0]]: [1, 3, 4][tier], [d.stats[1]]: [0, 2, 3][tier] });
    const prev = state.best[kind] ?? -1;
    if (tier > prev) {
      state.best[kind] = tier;
      if (tier > 0) toast(`自己ベスト更新！ ${"★".repeat(tier)} この手応えは本番に乗る`, { kind: "good" });
    }
  }
}

function chooseDrill() {
  return new Promise((resolve) => {
    const root = showScreen("tonari", el("div.sub-menu", [
      el("h2.sub-title", { text: "自主練" }),
      el("p.sub-lead", { text: "どの工程を反復する？ 自己ベストは本番のスコアに少し乗る。" }),
      el("div.sub-choices.grid", Object.entries(DRILLS).map(([id, d]) =>
        el("button.big-choice", { dataset: { test: `drill-${id}` }, onclick: () => { SE.select(); retire(root); resolve(id); } }, [
          el("b", { text: d.label }),
          el("small", { text: `${d.desc}（自己ベスト ${"★".repeat(Math.max(0, state.best[id] ?? 0)) || "なし"}）` }),
        ])
      )),
    ]));
  });
}
