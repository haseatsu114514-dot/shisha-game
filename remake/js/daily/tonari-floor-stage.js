// tonari フロア営業の店内（舞台）と、届いた絵の登録。位置はどれも店内の絵（16:9）に対する％。
// 絵の依頼と受け取り方は asset_sources/ui/tonari-floor-20261120/README.md（Issue #3960）。
//
// style "medal"＝客を丸い札で出す（会話用の店内画に重ねる今の形）。seat＝札の中心、plate＝卓の番号札。
// style "seated"＝専用の店内画に、座った客を重ねる。席の形はオーナー指定（2026-11-20）:
//     席 席 席      奥の3席はソファがこちら向き（卓は手前）
//     席    席      手前の2席は内向き（左のソファは右向き、右のソファは左向き。卓は内側）
//   奥から順に「店内 → 客 → 前景（奥の卓・手前のソファの肘掛け）→ 卓の上の一台と煙 → 番号札 → 卓のマーカー」と重ねる。
//   row＝席の向き（"back" こちら向き／"side" 内向き）、flip＝客の絵を左右反転する（絵は右前向きで届く）、
//   box＝客が入る範囲 [左, 上, 幅, 高さ]（下端が足元。奥の席は卓が膝から下を隠す）、
//   bubble＝卓のマーカーの下端の中央、fx＝手応えの出る所、plate＝卓の番号札、prop＝卓の上の一台の底の中央（propH＝高さ）、
//   sofa・table・cover（客より手前に重ねる所）・door・counter・rug は [左, 上, 幅, 高さ]。配置図（test/tonari_floor_guide.mjs）と前景の切り出しに使う。
const MIRROR = 94; // 手前の2席は、店の中心（横47%）で左右対称
const back = (cx, name) => ({ name, row: "back", flip: false,
  box: [cx - 8.5, 31, 17, 23.5], bubble: [cx, 30.2], fx: [cx, 51], plate: [cx + 5, 54.3], prop: [cx - 5.6, 53.4], propH: 15,
  sofa: [cx - 11, 32.5, 22, 18.5], table: [cx - 8, 49, 16, 8], cover: [cx - 8, 49, 16, 8] });
const side = (name, flip) => {
  const m = (x, w = 0) => (flip ? MIRROR - x - w : x); // 右の席は左の席を鏡写しにする
  return { name, row: "side", flip,
    box: [m(14.5, 12), 57, 12, 28.5], bubble: [m(33), 69.5], fx: [m(33), 76], plate: [m(36.5), 80.6], prop: [m(30.5), 79.5], propH: 17,
    sofa: [m(10.5, 12), 59, 12, 27], table: [m(27, 12), 72, 12, 11], cover: [m(10.5, 12.5), 80.5, 12.5, 6] };
};

export const STAGES = Object.freeze({
  // 採用済みの会話用の店内画（bg_tonari_inside_*）。卓4つ＋カウンターを五つの席として使う。絵の URL は呼び出し側が渡す。
  classic: Object.freeze({
    id: "classic", style: "medal",
    spots: [
      { seat: [20.5, 57], plate: [25.5, 76], name: "窓際の広い卓" },
      { seat: [39.5, 43], plate: [44, 58.5], name: "ソファの卓" },
      { seat: [54, 38], plate: [55.3, 55.5], name: "奥の卓" },
      { seat: [69.5, 38.5], plate: [70.3, 55], name: "奥の小さな卓" },
      { seat: [83, 63], plate: [92.5, 53.5], name: "カウンター" }, // 右上の作業台の札に、吹き出しが隠れない高さ
    ],
    lamps: [[32.9, 17.5, 9], [37.8, 5.6, 7], [37.4, 22.7, 6], [42.5, 13, 9], [40.2, 26.5, 5], [46, 20.5, 5], [49.3, 9.5, 8],
      [52.8, 22, 5], [56.1, 16, 6], [60.2, 23.5, 8], [63.4, 14, 9], [68.8, 10.5, 6], [67.7, 25.3, 5], [72, 21.5, 5]],
  }),
  // フロア専用の店内画。左の端が入口、右の端がカウンター（作業台と受渡棚）。
  floor: Object.freeze({
    id: "floor", style: "seated",
    art: { day: "../../img/ui/tonari-floor/room-day.webp", night: "../../img/ui/tonari-floor/room-night.webp",
      frontDay: "../../img/ui/tonari-floor/front-day.webp", frontNight: "../../img/ui/tonari-floor/front-night.webp" },
    spots: [back(24, "奥の左の卓"), back(47, "奥のまん中の卓"), back(70, "奥の右の卓"), side("手前の左の卓", false), side("手前の右の卓", true)],
    lamps: [[9, 8, 6], [17, 6, 7], [25, 9, 6], [33, 6, 8], [41, 9, 6], [49, 6, 7], [57, 9, 6], [65, 6, 8], [73, 9, 6], [81, 6, 7]],
    door: [0, 24, 9.5, 60], counter: [86.5, 32, 13.5, 62], rug: [40, 62, 14, 32],
  }),
});

// 届いた絵の登録先。
// - stage: "floor" にすると専用の店内画（STAGES.floor.art の4枚）へ切り替わる。届くまでは "classic"。
// - guests: 客ひとりの絵（`{ idle, happy }`。happy は無くてよい）。1人の客は種類ID、二人組は「種類ID-a」「種類ID-b」。
//     無い人はコードの影絵（tonari-floor-art.js）で描く。
//     例: first: { idle: "../../img/ui/tonari-floor/guest-first.webp" }, "train-a": { idle: "…/guest-train-a.webp" }
// - props: 卓の上の一台（shisha）など。無ければ置かない。
export const FLOOR_ART = Object.freeze({ stage: "classic", guests: Object.freeze({}), props: Object.freeze({}) });

/** 相対パスの絵を、このファイルから見た URL にする（data: や http(s): はそのまま）。 */
export const artUrl = (src) => (!src ? null : /^(data:|blob:|https?:|\/)/.test(src) ? src : new URL(src, import.meta.url).href);

/** いま使う舞台。検査や配置図では stage を直接渡す。 */
export const currentStage = (stage = null) => stage || STAGES[FLOOR_ART.stage] || STAGES.classic;

/** 卓の中心（キーボードで卓を移る時の位置）。 */
export const spotCenter = (spot) => spot.seat || [spot.box[0] + spot.box[2] / 2, spot.box[1] + spot.box[3] / 2];

/** 客ひとりずつの絵のID（1人は種類ID、二人組は -a・-b）。 */
export const personIds = (guest) => (guest.party > 1 ? ["a", "b"].slice(0, guest.party).map((s) => `${guest.kind}-${s}`) : [guest.kind]);
