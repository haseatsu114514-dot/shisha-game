// tonari フロア営業の店内（舞台）と、届いた絵の登録。位置はどれも店内の絵（16:9）に対する％。
// 絵の依頼と受け取り方は asset_sources/ui/tonari-floor-20261120/README.md（Issue #3960）。
//
// style "medal"＝客を丸い札で出す（会話用の店内画に重ねる今の形）。
// style "seated"＝客が全員こちら向きに座る専用の店内画。奥から順に「店内 → 客 → 卓の前景 → 卓の上の一台 → 札・吹き出し」と重ねる。
//   seat＝客の絵の下端の中央（卓の奥の縁。膝は卓の前景が隠す）、h＝客の絵の高さ、plate＝卓の番号札、prop＝卓の上の一台の底の中央。
//   sofa・table・door・counter・rug は [左, 上, 幅, 高さ]。絵を頼む時の配置図（dev/tonari-floor-guide.js）と、卓の前景の切り出しに使う。
// 奥の卓の手前の縁（57%）より下に、手前の客の頭（58%）を置く。こうしておくと卓の前景は1枚で済む
// （奥の卓が手前の客に被らない）。奥の客の頭の上には、吹き出しとひとことが上の帯（13%）の下に収まる余白を残す。
const back = (cx, name) => ({ name, seat: [cx, 50], h: 19, plate: [cx - 5, 54.3], prop: [cx + 5.6, 53.4], propH: 15,
  sofa: [cx - 11, 32.5, 22, 18.5], table: [cx - 8, 49, 16, 8] });
const front = (cx, name) => ({ name, seat: [cx, 78], h: 20, plate: [cx - 5.6, 82.8], prop: [cx + 6.4, 81.6], propH: 16.5,
  sofa: [cx - 12, 61, 24, 18], table: [cx - 9, 77, 18, 9] });

export const STAGES = Object.freeze({
  // 採用済みの会話用の店内画（bg_tonari_inside_*）。卓4つ＋カウンターを五つの席として使う。絵の URL は呼び出し側が渡す。
  classic: Object.freeze({
    id: "classic", style: "medal",
    spots: [
      { seat: [20.5, 57], plate: [25.5, 76], name: "窓際の広い卓" },
      { seat: [39.5, 43], plate: [44, 58.5], name: "ソファの卓" },
      { seat: [54, 38], plate: [55.3, 55.5], name: "奥の卓" },
      { seat: [69.5, 38.5], plate: [70.3, 55], name: "奥の小さな卓" },
      { seat: [88.5, 55], plate: [84.5, 49.5], name: "カウンター" },
    ],
    lamps: [[32.9, 17.5, 9], [37.8, 5.6, 7], [37.4, 22.7, 6], [42.5, 13, 9], [40.2, 26.5, 5], [46, 20.5, 5], [49.3, 9.5, 8],
      [52.8, 22, 5], [56.1, 16, 6], [60.2, 23.5, 8], [63.4, 14, 9], [68.8, 10.5, 6], [67.7, 25.3, 5], [72, 21.5, 5]],
  }),
  // フロア専用の店内画。奥の壁ぎわに3席、手前の左右に2席。左の端が入口、右の端がカウンター（作業台と受渡棚）。
  floor: Object.freeze({
    id: "floor", style: "seated",
    art: { day: "../../img/ui/tonari-floor/room-day.webp", night: "../../img/ui/tonari-floor/room-night.webp",
      frontDay: "../../img/ui/tonari-floor/front-day.webp", frontNight: "../../img/ui/tonari-floor/front-night.webp" },
    spots: [back(22, "奥の左の卓"), back(47, "奥のまん中の卓"), back(72, "奥の右の卓"), front(30, "手前の左の卓"), front(66, "手前の右の卓")],
    lamps: [[9, 8, 6], [17, 6, 7], [25, 9, 6], [33, 6, 8], [41, 9, 6], [49, 6, 7], [57, 9, 6], [65, 6, 8], [73, 9, 6], [81, 6, 7]],
    door: [0, 24, 9.5, 60], counter: [86.5, 32, 13.5, 62], rug: [42, 62, 12, 32],
  }),
});

// 届いた絵の登録先。
// - stage: "floor" にすると専用の店内画（STAGES.floor.art の4枚）へ切り替わる。届くまでは "classic"。
// - guests: 客の種類ID → 絵（`{ idle, happy }`。happy は無くてよい）。無い種類はコードの影絵（tonari-floor-art.js）で描く。
//     例: first: { idle: "../../img/ui/tonari-floor/guest-first.webp", happy: "../../img/ui/tonari-floor/guest-first-happy.webp" }
// - props: 卓の上の一台（shisha）など。無ければ置かない。
export const FLOOR_ART = Object.freeze({ stage: "classic", guests: Object.freeze({}), props: Object.freeze({}) });

/** 相対パスの絵を、このファイルから見た URL にする（data: や http(s): はそのまま）。 */
export const artUrl = (src) => (!src ? null : /^(data:|blob:|https?:|\/)/.test(src) ? src : new URL(src, import.meta.url).href);

/** いま使う舞台。検査や配置図では stage を直接渡す。 */
export const currentStage = (stage = null) => stage || STAGES[FLOOR_ART.stage] || STAGES.classic;
