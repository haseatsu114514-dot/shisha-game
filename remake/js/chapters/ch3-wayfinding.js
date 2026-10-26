// 既存の読了地点から表示を作る。章進行・地理・行動枠・保存データを増やさない。
import { el } from "../core/util.js";

const sceneSummary = scene => scene && typeof scene.id === "string"
  && typeof scene.location === "string" && typeof scene.label === "string"
  && Number.isInteger(scene.day) && [0, 1].includes(scene.slot)
  ? { id: scene.id, location: scene.location, label: scene.label, day: scene.day, slot: scene.slot }
  : null;

/** 読取専用。未読の将来の行先を列挙せず、現在の一場面と直前の既読だけを返す。 */
export function chapterThreeWayfinding(value, scenes) {
  const progress = value?.flags?._ch3_intro;
  if (value?.chapter !== 3 || !Array.isArray(scenes) || !progress
    || !Number.isInteger(progress.stage) || progress.stage < 0 || progress.stage >= scenes.length) return null;
  const target = sceneSummary(scenes[progress.stage]);
  if (!target) return null;
  return {
    target,
    previous: progress.stage > 0 ? sceneSummary(scenes[progress.stage - 1]) : null,
  };
}

/** 表示中のscene IDに一致するときだけ添える。地図は閲覧だけで行程を進めない。 */
export function createChapterThreeWayfinding(value, scenes, sceneId) {
  const model = chapterThreeWayfinding(value, scenes);
  if (!model || model.target.id !== sceneId) return null;
  const node = (title, scene, next = false) => el(`div.ch3-wayfinding-stop${next ? ".next" : ""}`, [
    el("small", { text: title }),
    el("strong", { text: scene.location }),
    el("span", { text: `DAY ${scene.day}・${scene.slot ? "夜" : "昼"} ／ ${scene.label}` }),
  ]);
  const mapButton = el("button.btn.ch3-wayfinding-map", {
    type: "button", text: "東京の地図", dataset: { test: "ch3-map-open" },
    onclick: async () => {
      if (mapButton.disabled) return;
      mapButton.disabled = true;
      try {
        const { openChapterThreeMap } = await import("./ch3-map.js");
        if (mapButton.isConnected) await openChapterThreeMap(value, scenes, { sceneId, allowGym: false });
      } finally {
        mapButton.disabled = false;
        if (mapButton.isConnected) mapButton.focus({ preventScroll: true });
      }
    },
  });
  return el("aside.ch3-wayfinding", { "aria-label": "東京の行程", dataset: { test: "ch3-wayfinding" } }, [
    el("div.ch3-wayfinding-heading", [el("p.ch3-wayfinding-title", { text: "東京の行程" }), mapButton]),
    el("div.ch3-wayfinding-stops", [
      model.previous ? node("直前に読んだ場面", model.previous) : null,
      node("これから読む場面", model.target, true),
    ].filter(Boolean)),
  ]);
}
