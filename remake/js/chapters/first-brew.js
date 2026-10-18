// 最初の提供先は、私服のみんと（まだ名前を知らない「お姉さん」）。
// 名前の開示と既存の接客選択は保ち、注文・実際の配合・感想をつなぐ。
import { DB } from "../core/data.js";
import { state, save } from "../core/state.js";
import { play } from "../vn/engine.js";
import { newSession, openBench } from "../craft/session.js";
import { stepMix } from "../craft/steps.js";
import { layers, retire } from "../core/ui.js";

export const FIRST_BREW_FLAVORS = Object.freeze(["lemon", "orange", "mint"]);
const TONARI = "res://assets/backgrounds/bg_tonari_inside.png";

export function configureFirstBrew(cs) {
  cs.orderFlavorIds = [...FIRST_BREW_FLAVORS];
  cs.orderHint = "注文はサッパリ系。レモン・オレンジ・ミントから選ぶ。単体でも、組み合わせてもいい";
  cs.lessonHelp = { mix: { brief: "サッパリ系の葉を選び、合計12gにする", detail: `スミ「${cs.orderHint}」` } };
  return cs;
}

export function firstBrewResponse(mix = {}) {
  const lemon = Number(mix.lemon) || 0, orange = Number(mix.orange) || 0, mint = Number(mix.mint) || 0;
  if (mint >= lemon + orange) return "mint";
  return lemon >= orange ? mint > 0 ? "lemon_mint" : "lemon" : mint > 0 ? "orange_mint" : "orange";
}

export function rememberFirstBrew(progress, cs, guided = true) {
  progress.firstBrew = { mix: { ...cs.mix }, guided };
  save();
}

export async function firstBrewOrder(progress) {
  if (progress.oneesanDone || progress.firstOrderDone) return true;
  const owner = state, original = DB.dialogues.ch1_tutorial_oneesan;
  const orderAt = original.lines.findIndex(l => l.speaker === "oneesan" && l.text?.startsWith("じゃあ"));
  if (orderAt < 0) throw new Error("First customer order is missing");
  const scene = DB.dialogues.remake_first_brew_order;
  const result = await play({ ...scene, lines: [...original.lines.slice(0, orderAt), ...scene.lines] }, { bg: TONARI });
  if (result?.cancelled || state !== owner) return false;
  progress.firstOrderDone = true;
  save();
  return true;
}

export async function serveFirstBrew(progress) {
  const owner = state;
  // 操作レッスンを省いた人も、好みに応える配合は自分で決める。
  // 旧セーブで練習済み・配合記録なしの場合も、新しい一台を選んでもらう。
  if (!progress.firstBrew) {
    const cs = configureFirstBrew(newSession("tutorial"));
    openBench(cs, { steps: [["mix", "配合"]] });
    await stepMix(cs);
    if (state !== owner) return false;
    rememberFirstBrew(progress, cs, false);
  }
  retire(layers.screen.querySelector(":scope > .bench"));
  if (!progress.firstBrew.guided && !progress.firstBrewFinishRead) {
    const result = await play("remake_first_brew_assisted", { bg: TONARI });
    if (result?.cancelled || state !== owner) return false;
    progress.firstBrewFinishRead = true;
    save();
  }
  const original = DB.dialogues.ch1_tutorial_oneesan;
  const serveAt = original.lines.findIndex(l => l.type === "show_cg" && l.cg_id === "cg_oneesan_first_smoke");
  if (serveAt < 0) throw new Error("First customer serving scene is missing");
  const lines = original.lines.slice(serveAt);
  const reaction = DB.dialogues.remake_first_brew_response.branches[firstBrewResponse(progress.firstBrew.mix)];
  const result = await play({ ...original, lines: [...lines.slice(0, 2), ...reaction, ...lines.slice(2)] }, { bg: TONARI });
  return !result?.cancelled && state === owner;
}
