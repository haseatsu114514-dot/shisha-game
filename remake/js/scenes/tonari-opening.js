// 冒頭だけのカット割り。本文・選択肢・保存・報酬は既存の会話エンジンに任せる。
import { el } from "../core/util.js";
import { DB, bgUrl, makingUrl, sceneBg } from "../core/data.js";
import { timeOfDay } from "../core/state.js";
import { layers, setBg, imageReady } from "../core/ui.js";
import { renderSceneArt } from "../core/scene-art.js";
import { play, hooks } from "../vn/engine.js";

const TONARI = "res://assets/backgrounds/bg_tonari_inside.png";
const SHOTS = new Set(["room", "lamps", "coal", "bowl", "customer", "hose", "depart", "empty"]);

export async function playTonariOpening({ signal, dialogue = DB.dialogues.ch1_opening } = {}) {
  if (signal?.aborted) return { cancelled: true };
  const { url, tint } = sceneBg(TONARI, timeOfDay());
  const urls = {
    coal: bgUrl("bg_tonari_opening_coal"),
    bowl: makingUrl("hajime_craft_pack.png"),
    bench: makingUrl("bench_base.png"),
    customer: bgUrl("bg_tonari_customer_hands"),
    smoke: makingUrl("smoke_thick.png"),
  };
  // 先読みは場面の入口で一度だけ。失敗したカットは店内に戻し、会話を止めない。
  const [, loaded] = await Promise.all([
    setBg(url, { tint }),
    Promise.all(Object.entries(urls).map(async ([key, src]) => [key, await imageReady(src, 15000, { keep: true })])),
  ]);
  if (signal?.aborted) return { cancelled: true };
  const available = Object.fromEntries(loaded);
  const picture = (key, cls) => available[key] ? el(`img.${cls}`, { src: urls[key], alt: "", draggable: false }) : null;
  const room = el("div.to-room");
  renderSceneArt(room, url); // 通常の店内と同じ背景・台・天気差分を使う
  const scene = el("div.tonari-opening.bg-img.show", { "aria-hidden": "true", dataset: { shot: "room", test: "tonari-opening" } }, [
    room,
    el("div.to-workbench", { style: available.bench ? { backgroundImage: `url("${urls.bench}")` } : {} }),
    picture("coal", "to-coal"),
    picture("bowl", "to-bowl"),
    picture("customer", "to-customer"),
    picture("smoke", "to-smoke"),
    el("div.to-departure"),
  ]);
  layers.bg.append(scene);
  const previous = hooks.onLine;
  const onLine = (id, line) => {
    previous?.(id, line);
    if (id !== "ch1_opening") { scene.dataset.shot = "room"; return; }
    if (!SHOTS.has(line.shot)) return;
    const required = { coal: ["coal"], bowl: ["bowl"], customer: ["customer"], hose: ["customer"] }[line.shot] || [];
    scene.dataset.shot = required.every(key => available[key]) ? line.shot : "room";
  };
  hooks.onLine = onLine;
  try {
    return await play(dialogue, { bg: TONARI, signal });
  } finally {
    if (hooks.onLine === onLine) hooks.onLine = previous;
    scene.remove(); // 終了・中断・次の会話へ手元や煙を持ち越さない
  }
}
