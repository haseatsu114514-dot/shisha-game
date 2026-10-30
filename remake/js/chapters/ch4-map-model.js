// ドバイの自由行動の行き先は保存済みの進行を読むだけ。読了・所在・日付をここで更新しない。
import { CH4_PLACE_BG, CH4_TOURNAMENT_DAY, CH4_EVE_DAY, chapterFourProgress,
  chapterFourSecondAvailable, chapterFourSheikhRevealed } from "./ch4-progress.js";

const place = (id, label, x, y) => Object.freeze({ id, label, x, y });

// 座標は地図画像に対する百分率。仮置き（Q10 の安全側: 看板名・店員名は出さない）。
export const DUBAI_MAP_PLACES = Object.freeze({
  souq: place("souq", "スーク", 22, 58),
  festa: place("festa", "FESTA", 48, 34),
  center_cafe: place("center_cafe", "中心地のカフェ", 70, 52),
  alley_cafe: place("alley_cafe", "路地裏のカフェ", 30, 78),
  inn: place("inn", "宿", 12, 24),
  venue: place("venue", "大会会場", 86, 20),
});

const SCENE = Object.freeze({
  souq: "ch4_dubai_souq", souqRevisit: "ch4_dubai_souq_revisit", first: "ch4_stranger_first",
  festa: "ch4_festa", festaRevisit: "ch4_festa_revisit",
  cafe: "ch4_dubai_cafe", cafeRevisit: "ch4_dubai_cafe_revisit",
  second: "ch4_stranger_second", alleyQuiet: "ch4_alley_cafe_quiet", toolCare: "ch4_inn_tool_care",
});

/**
 * 自由行動で今行ける行き先と、そこで起きる場面（scenes を先頭から順に再生）。
 * 第4章の自由行動でないとき（プロローグ・前夜・大会以降・別章）は null。
 * 秘匿中（_ch4_sheikh_revealed が false）は、ラベル・説明に固有名を出さない。
 */
export function chapterFourMapModel(value) {
  if (value?.chapter !== 4) return null;
  const progress = chapterFourProgress(value);
  if (progress.part !== "free") return null;
  const { read, day } = progress;
  const unread = ids => ids.filter(id => read[id] !== true);
  // purpose は「なぜ今そこへ行くか」。秘匿中は固有名を出さない。unreadCount は未読の場面数（宿は含めない）。
  const destination = (id, scenes, description, visited, extra = {}) => ({
    ...DUBAI_MAP_PLACES[id], scenes, description, visited, background: CH4_PLACE_BG[id], kind: "visit",
    unreadCount: scenes.filter(sceneId => read[sceneId] !== true).length, ...extra,
  });
  const destinations = [
    // 初回はスークの場面と最初の出会いを続けて再生。途中で保存が分かれても未読分だけ再生する。
    destination("souq", read[SCENE.souq] === true && read[SCENE.first] === true ? [SCENE.souqRevisit]
      : unread([SCENE.souq, SCENE.first]), "スパイスの匂いが立つ市場。", read[SCENE.souq] === true,
      { purpose: read[SCENE.first] === true ? "もう一度歩いて、香りと人の流れを確かめる。" : "まず街の空気を知る。初めての市場を歩く。" }),
    destination("festa", [read[SCENE.festa] === true ? SCENE.festaRevisit : SCENE.festa],
      "手拍子と炭の匂いのする店。", read[SCENE.festa] === true,
      { purpose: read[SCENE.festa] === true ? "もう一度寄って、この街の吸い方を見る。" : "炭と手拍子の店で、この街の吸い方を見る。" }),
    destination("center_cafe", [read[SCENE.cafe] === true ? SCENE.cafeRevisit : SCENE.cafe],
      "街の中心にある、立派なカフェ。", read[SCENE.cafe] === true,
      { purpose: read[SCENE.cafe] === true ? "もう一度席に着いて、店ごとの違いを見比べる。" : "一番高い店のサービスを体感しに行く。" }),
  ];
  // 路地裏は stranger_first を読み、second の解放条件を満たすまで行き先自体を出さない（DRAFT §4 の仮置き側）。
  if (read[SCENE.second] === true) {
    destinations.push(destination("alley_cafe", [SCENE.alleyQuiet], "路地の奥の小さなカフェ。", true,
      { purpose: "再訪できるようになった。静かな店で、もう一度ゆっくり話を聞く。" }));
  } else if (chapterFourSecondAvailable(value)) {
    destinations.push(destination("alley_cafe", [SCENE.second], "路地の奥の小さなカフェ。", false,
      { purpose: "約束した店。初めて訪ねる。" }));
  }
  // 宿は「その日を終える」唯一の行動。DAY2以降で未読なら道具の手入れを先に再生する。
  destinations.push(destination("inn", day >= 2 ? unread([SCENE.toolCare]) : [],
    day === CH4_EVE_DAY ? "部屋へ戻り、夜に備える。" : "部屋へ戻り、この日を終える。", false,
    { purpose: "場所を回っても日は進まない。ここで日が進む。", kind: "end_day", label: day === CH4_EVE_DAY ? "宿へ戻る（前夜へ）" : "宿へ戻って、この日を終える" }));
  // 路地裏が出る前の予告。秘匿中は固有名を出さない。
  const hint = read[SCENE.first] === true && read[SCENE.second] !== true && !chapterFourSecondAvailable(value)
    ? "路地の奥の店が気になる。もう少し日が経ってから訪ねよう。" : "";
  const daysLeft = Math.max(0, CH4_TOURNAMENT_DAY - day);
  // 夕景への切替は日の境界でのみ起きる（宿で終えて前夜日に入る時）。日中の訪問では切り替わらない。
  const mode = day >= CH4_EVE_DAY ? "dusk" : "day";
  return {
    day, tournamentDay: CH4_TOURNAMENT_DAY, daysLeft, mode,
    background: mode === "dusk" ? CH4_PLACE_BG.mapDusk : CH4_PLACE_BG.map,
    destinations, hint,
    // 大会会場は当日まで選べない。一覧には出さず、日数だけ示す。
    venue: { ...DUBAI_MAP_PLACES.venue, selectable: false, text: `大会は${CH4_TOURNAMENT_DAY}日目。あと${daysLeft}日。` },
    revealed: chapterFourSheikhRevealed(value),
    guide: "ここからは、行き先を自分で選んで歩く。各場所の下に「なぜ行くか」を出す。",
    note: `大会は${CH4_TOURNAMENT_DAY}日目。あと${daysLeft}日。場所を回っても日は進まない。宿でその日を終えると翌日になる。`,
  };
}
