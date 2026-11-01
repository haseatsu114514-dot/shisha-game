// 東京の地図は保存済みの行程を読むだけ。読了・所在・行動枠をここで更新しない。
const place = (id, label, x, y) => Object.freeze({ id, label, x, y });

// 座標は地図画像に対する百分率。実在の東京駅は地区の高架駅と区別する。
export const TOKYO_MAP_PLACES = Object.freeze({
  arrival: place("arrival", "東京駅から", 6, 11),
  mukai: place("mukai", "mukai", 29.6, 62.7),
  street: place("street", "街の道", 35, 51),
  shop: place("shop", "訪ねた店", 15, 51),
  enmaku: place("enmaku", "煙幕", 45.3, 49.7),
  steve: place("steve", "Smoke & Glory", 23.3, 36.1),
  volk: place("volk", "鉄の煙", 55.9, 40.4),
  gym: place("gym", "CHOI-ZAP", 34.9, 75.9),
  park: place("park", "公園", 69, 62),
  shrine: place("shrine", "路地裏の神社", 54, 70), // 心得の盤の内省（SPEC 2.8・#1788）。火種がある時だけ出る
});

export const TOKYO_MAP_LANDMARKS = Object.freeze([
  place("park", "公園", 69, 62),
  place("zoo", "動物園", 76, 46.8),
  place("pond", "池", 84.8, 74.4),
  place("livehouse", "ライブハウス", 39.2, 38.8),
  place("tower", "給水塔", 40.7, 29.5),
  place("station", "高架駅", 37.8, 18.1),
]);

const scenePlace = scene => {
  if (!scene || typeof scene.id !== "string") return null;
  if (scene.id === "ch3_opening") return "arrival";
  if (scene.id === "ch3_naru_work") return null; // 地方の別会場。東京に置かない。
  if (scene.location === "mukai") return "mukai";
  if (["ch3_individuality_doubt", "ch3_naru_contact_before_tournament", "ch3_tournament_eve"].includes(scene.id)) return "street";
  if (scene.id === "ch3_tokyo_shop_gap") return "shop";
  if (["ch3_kuze_first", "ch3_kuze_advice"].includes(scene.id)) return "enmaku";
  if (scene.id === "ch3_steve_low_heat") return "steve";
  if (scene.id === "ch3_volk_first") return "volk";
  return null;
};

/**
 * callerの新旧行程をそのまま使う。stageより先の店・人物・台本名は返さない。
 * actions は自由時間に地図から選べる行き先（#1655）。{ id, place, label, reasonText, ok, why, consumes }。
 * 公園など行程に出ない場所も、行き先があればその間だけ地点として出す。
 */
export function chapterThreeMapModel(value, scenes, { sceneId, allowGym = false, freeTime = false, actions = [] } = {}) {
  const stage = value?.flags?._ch3_intro?.stage;
  if (value?.chapter !== 3 || !Array.isArray(scenes) || !Number.isInteger(stage)
    || stage < 0 || stage > scenes.length) return null;
  const target = scenes[stage];
  if (sceneId !== undefined && target?.id !== sceneId) return null;
  const currentPlace = freeTime ? null : scenePlace(target);
  const reached = new Map();
  for (const scene of scenes.slice(0, stage)) {
    const id = scenePlace(scene);
    if (id) reached.set(id, { ...TOKYO_MAP_PLACES[id], visited: true, current: false });
  }
  if (currentPlace) reached.set(currentPlace, {
    ...TOKYO_MAP_PLACES[currentPlace], visited: reached.has(currentPlace), current: true,
  });
  const choices = Array.isArray(actions) ? actions.filter(action => TOKYO_MAP_PLACES[action?.place]) : [];
  for (const action of choices) {
    if (!reached.has(action.place) && action.place !== "gym") {
      reached.set(action.place, { ...TOKYO_MAP_PLACES[action.place], visited: false, current: false });
    }
  }
  const actionsAt = id => choices.filter(action => action.place === id).map(action => ({ ...action }));
  const member = value.flags._gym_member === true;
  const mode = (value.slot === 1 || value.slot !== 0 && target?.slot === 1) ? "night" : "day";
  return {
    mode, background: `bg_tokyo_map_${mode}`,
    pins: [...reached.values(), { ...TOKYO_MAP_PLACES.gym, visited: false, current: false, gym: true }]
      .map(pin => ({ ...pin, actions: actionsAt(pin.id) })),
    landmarks: TOKYO_MAP_LANDMARKS.filter(item => !reached.has(item.id)).map(item => ({ ...item })),
    member, canTrain: allowGym === true && member, freeTime: freeTime === true,
    note: freeTime ? choices.length ? "自由時間です。内省と作業台の試作は予定を進めません。それ以外の行き先は一回の自由時間を使います。"
      : "自由時間です。これまでに訪ねた場所を地図で確かめられます。"
      : target?.id === "ch3_naru_work"
      ? "別会場の場面です。地図では東京で訪ねた場所を確かめられます。"
      : "今の場面と、これまでに訪ねた場所を確かめられます。",
  };
}
