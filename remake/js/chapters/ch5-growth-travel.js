// 第5章・日程未定の間だけの再渡航。対面の交流と相談、実行動の時計を持つ。
import { state, save, markMet } from "../core/state.js";
import { DB, bgUrl, displayName } from "../core/data.js";
import { el } from "../core/util.js";
import { on } from "../core/bus.js";
import { layers, showScreen, setBg, modal } from "../core/ui.js";
import { paidAction, addMoney, addStamina, staminaAfter, gainAffinity, affinityLevel } from "../core/stats.js";
import { presentNight, consultLessons, readyLessons } from "../core/growth.js";
import { reflectAt, canReflect } from "../daily/reflection.js";
import { play } from "../vn/engine.js";
import { readDialogues } from "../core/chapter-data.js";
import { TRAVEL, TEACHERS, tripState, travelAllowed, planTripAction, commitTripAction, completeTripNight } from "./ch5-growth-travel-state.js";

let loading = null, active = null;
const teacherBg = who => bgUrl(who === "da_silva" ? "bg_tournament_stage" : "bg_cafe_day");
async function loadScenes() {
  loading ||= readDialogues("ch5_growth_visits", [
    ...TEACHERS.flatMap(who => Array.from({ length: TRAVEL.topics + 1 }, (_, i) => `ch5_growth_${who}_${i}`)),
    "ch5_growth_rest_local", "ch5_growth_rest_dubai",
  ]).then(scenes => { Object.assign(DB.dialogues, scenes); }).catch(error => { loading = null; throw error; });
  return loading;
}

export async function runChapterFiveTravel({ isCurrent = () => true, menuButton = () => null } = {}) {
  if (!travelAllowed(state)) return false;
  if (active?.owner === state) return active.done;
  const session = { owner: state, controller: new AbortController(), resolveChoice: null, dismissConfirm: null };
  active = session;
  const live = () => active === session && state === session.owner && isCurrent() && !session.controller.signal.aborted;
  const cancel = () => {
    session.controller.abort();
    if (session.dismissConfirm?.isConnected) session.dismissConfirm.click();
    session.resolveChoice?.(null);
  };
  const off = on("hud", () => { if (state !== session.owner) cancel(); });
  window.addEventListener("pagehide", cancel, { once: true });
  const night = async () => {
    if (!tripState(state).pendingNight) return true;
    await presentNight();
    if (!live()) return false;
    addStamina(TRAVEL.sleep, { sleep: true });
    if (!live() || !completeTripNight(state)) return false;
    save();
    return true;
  };
  const choose = async () => {
    const r = tripState(state);
    await setBg(bgUrl(r.region === "dubai" ? "bg_dubai_map" : "bg_tonari_inside"), { instant: true });
    if (!live()) return null;
    return new Promise(resolve => {
      let selected = false, frame = null;
      const pick = value => { if (!selected) {
        selected = true;
        frame?.querySelectorAll(".ch2-contest-actions button").forEach(button => { button.disabled = true; });
        session.resolveChoice = null; resolve(value);
      } };
      session.resolveChoice = pick;
      const option = (label, value, test, enabled = true) => el("button.btn", {
        text: label, disabled: !enabled, dataset: { test }, onclick: () => pick(value),
      });
      const actions = [];
      if (r.region === "local") {
        actions.push(option(`ドバイへ出発（往復${TRAVEL.roundTrip.toLocaleString()}円・片道1日）`, "fly", "travel-fly", !!planTripAction(state, "fly")));
        actions.push(option("tonariでシフトに入る（1行動）", "shift", "travel-shift", !!planTripAction(state, "shift")));
        actions.push(option("自由行動へ戻る", "back", "travel-back"));
      } else {
        for (const who of TEACHERS) {
          if (who === "sheikh" && !state.flags._ch4_sheikh_revealed) continue;
          const name = displayName(who, state);
          const cost = state.stamina - staminaAfter(-TRAVEL.strain);
          actions.push(option(`${name}に会う（${TRAVEL.visit.toLocaleString()}円・体力${cost}・1行動／♥${affinityLevel(who)}）`, `visit:${who}`, `travel-visit-${who}`, !!planTripAction(state, "visit", who)));
          if (readyLessons(who).length) actions.push(option(`${name}に会って相談する（時間は進まない）`, `lesson:${who}`, `travel-lesson-${who}`));
        }
        if (canReflect()) actions.push(option("水辺で内省する（時間は進まない）", "reflect", "travel-reflect"));
        actions.push(option("日本へ帰る（帰路支払済み・1日）", "return", "travel-return"));
      }
      actions.push(option(`${r.region === "local" ? "家" : "宿"}で休む（体力回復・1行動）`, "rest", "travel-rest"));
      layers.hud.replaceChildren(); layers.hud.classList.remove("show");
      frame = el("main.ch2-contest", { dataset: { test: "ch5-travel" } }, [
        el("header.ch2-contest-header", [el("h1", { text: r.region === "dubai" ? "ドバイで過ごす" : "再び会いに行く" }), menuButton()]),
        el("p.ch2-contest-description", { text: `${state.day}日目・${state.slot === 0 ? "昼" : "夜"}／所持金 ${state.money.toLocaleString()}円／体力 ${state.stamina}` }),
        el("p.ch2-contest-note", { text: "博士との日程はまだ決まっていない。交流は1日2行動。話を最後まで聞いてから、その行動が決まる。" }),
        el("div.ch2-contest-actions", actions),
      ]);
      showScreen("ch5-travel", frame);
    });
  };
  const run = async () => {
    await loadScenes();
    const returning = tripState(state).pendingNight && tripState(state).region === "local";
    if (!live() || !await night()) return false;
    // 帰国の夜の途中から再開した場合も、夜を終えてから地元の自由行動へ戻す。
    if (returning) return true;
    while (live() && travelAllowed(state)) {
      const choice = await choose();
      if (!live() || !choice || choice === "back") return false;
      if (choice === "reflect") { await reflectAt("dubai_waterside"); continue; }
      if (choice.startsWith("lesson:")) {
        const who = choice.slice(7);
        await setBg(teacherBg(who), { instant: true });
        if (live()) await consultLessons(who, { bg: teacherBg(who), signal: session.controller.signal });
        continue;
      }
      const [kind, who] = choice.split(":");
      const plan = planTripAction(state, kind, who);
      if (!plan) continue;
      if (kind === "fly" || kind === "return") {
        const confirmation = modal({ title: kind === "fly" ? "ドバイへ行く" : "日本へ帰る", body: kind === "fly"
          ? `往復${TRAVEL.roundTrip.toLocaleString()}円を先払いし、1日かけて移動します。帰りに追加料金はかかりません。`
          : "1日かけて日本へ戻ります。帰路の料金は支払済みです。", options: [
          { label: "移動する", value: true, primary: true, test: "travel-confirm" }, { label: "戻る", value: false, test: "travel-cancel" },
        ] });
        session.dismissConfirm = layers.modal.querySelector('[data-test="travel-cancel"]');
        const yes = await confirmation;
        session.dismissConfirm = null;
        if (!yes || !live()) continue;
      }
      const settled = await paidAction(async () => {
        if (kind === "visit") {
          await setBg(teacherBg(who), { instant: true });
          if (!live()) return false;
          const result = await play(plan.scene, { bg: teacherBg(who), growthScene: true, signal: session.controller.signal });
          if (!live() || !result || result.cancelled) return false;
        } else if (kind === "rest") {
          const result = await play(`ch5_growth_rest_${tripState(state).region}`, { signal: session.controller.signal });
          if (!live() || !result || result.cancelled) return false;
        } else if (kind === "shift") {
          const tonari = await import("../daily/tonari.js");
          if (!live()) return false;
          const done = await tonari.doBaito();
          if (!live() || !done) return false;
        }
        if (!live() || !commitTripAction(state, plan)) return false;
        if (plan.cost) addMoney(-plan.cost);
        if (!live()) return false;
        if (plan.strain) addStamina(-plan.strain);
        if (!live()) return false;
        if (kind === "rest") addStamina(TRAVEL.rest);
        if (!live()) return false;
        if (kind === "visit") { markMet(who); gainAffinity(who, plan.affinity); }
        return true;
      }, { consumed: done => done, exp: kind === "visit" ? { key: who, person: who, place: `dubai:${who}` }
        : kind === "shift" ? { key: "tonari_shift", place: "tonari_shift" } : null });
      if (!live() || !settled.value) continue;
      save();
      if (kind === "visit") await consultLessons(who, { bg: teacherBg(who), signal: session.controller.signal });
      if (!live() || !await night()) return false;
      if (kind === "return") return true;
    }
    return false;
  };
  session.done = run().finally(() => {
    off(); window.removeEventListener("pagehide", cancel); session.controller.abort();
    if (active === session) active = null;
  });
  return session.done;
}
