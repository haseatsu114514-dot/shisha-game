// 縦画面C案「煙の舞台」の試作（2026-11-27・#4134・要望台帳 VPL03〜）。
// 第1章の場面（橙須の地図→入店→会話→返事／tonari の2人会話／シーシャ作り3工程）で、配置と動きを確かめる。
// 方針: その場面で要るものだけを出す。説明は文字より、顔・絵記号・光で伝える（VPL12・VPL13）。
// 絵・立ち絵・台詞は本編の素材を読むだけ。本編の進行・判定・保存は呼ばない。
// 一覧（PC）: index.html?view=gallery　／　1台（スマホ）: index.html?view=play&scene=map|minto|tonari|pack|holes|pull
// 絵は本編が表示に使う WebP 版（remake/img/）を読む（元PNGを直接書くと公開物の軽量化から外れる）。

// テロップの文は本編と同じ組版で、表示する箱の実際の幅と書体で測って2行ずつに分ける（VPL29）
import { paginateForBox } from "../../js/vn/layout.js";

const REMAKE_IMG = new URL("../../img/", import.meta.url).href;
// この試作のために画像生成（gpt-image-2.6-sunburst）で作った絵。原画とプロンプトは asset_sources/ui/portrait-stage-20261127/
const OWN_IMG = new URL("img/", import.meta.url).href;
const NEW = `${REMAKE_IMG}sprites/character_variants/new/`;
const IMG = {
  map: `${REMAKE_IMG}backgrounds/bg_osu_map_day.webp`,
  shop: `${REMAKE_IMG}backgrounds/peppermint.webp`,
  tonari: `${REMAKE_IMG}backgrounds/bg_tonari_inside_day.webp`,
  minto_smile: `${NEW}minto/chr_minto_smile.webp`,
  minto_wink: `${NEW}minto/chr_minto_wink.webp`,
  sumi_normal: `${NEW}sumi/chr_sumi_normal.webp`,
  sumi_smile: `${NEW}sumi/chr_sumi_smile.webp`,
  tsumugi_normal: `${NEW}tsumugi/chr_tsumugi_normal.webp`,
  tsumugi_smile: `${NEW}tsumugi/chr_tsumugi_smile.webp`,
  faceMinto: `${REMAKE_IMG}ui/face_icons/new/face_minto.webp`,
  faceSumi: `${REMAKE_IMG}ui/face_icons/new/face_sumi.webp`,
  faceTsumugi: `${REMAKE_IMG}ui/face_icons/new/face_tsumugi.webp`,
  faceNaru: `${REMAKE_IMG}ui/face_icons/new/face_naru.webp`,
  faceAdam: `${REMAKE_IMG}ui/face_icons/new/face_adam.webp`,
  foil: `${REMAKE_IMG}ui/making/foil_interactive_top.webp`,
  leaf: `${REMAKE_IMG}ui/making/ui_mockup_flavor_leaf.webp`,
  smoke: `${REMAKE_IMG}ui/making/smoke_thick.webp`,
  ciMinto: `${REMAKE_IMG}ui/character_intros/graphic/minto.webp`,
  ciBgMinto: `${REMAKE_IMG}ui/character_intros/graphic/bg_minto.webp`,
  ciSumi: `${REMAKE_IMG}ui/character_intros/graphic/sumi.webp`,
  ciBgSumi: `${REMAKE_IMG}ui/character_intros/graphic/bg_sumi.webp`,
  // 作り直した絵（gpt-image-2.6-sunburst・VPL38）: ボトル・ハガル（空・ふんわり・ノーマル・デンス）・はじめの吸い出し
  bottle: `${OWN_IMG}ui-bottle-pro.webp`, // 本編の大会公式モデルの台のベース（VPL46）
  bowlEmpty: `${OWN_IMG}ui-bowl-empty.webp`,
  bowl_airy: `${OWN_IMG}ui-bowl-airy.webp`,
  bowl_normal: `${OWN_IMG}ui-bowl-normal.webp`,
  bowl_firm: `${OWN_IMG}ui-bowl-firm.webp`,
  pullHajime: `${OWN_IMG}craft-pull-hajime.webp`, // 人物だけ（背景なし）。場所の背景に重ねる（VPL41）
  // 炭焼き（VPL54・VPL55・VPL57）: 本編の電熱コンロ・炭（黒い面・赤）
  stove: `${REMAKE_IMG}ui/making/heat_stove.webp`,
  coalCold: `${REMAKE_IMG}ui/making/heat_flat_cold.webp`,
  coalLit: `${REMAKE_IMG}ui/making/heat_flat_lit.webp`,
  // 炭壺とトングを持ち、コンロの熱の明かりに下から照らされたはじめ（生成・背景なし。会場の背景に重ねる・VPL57）
  coalHajime: `${OWN_IMG}craft-coal-hajime.webp`,
  // 会場の背景（作る場面の背景は会場で替わる・VPL57）: tonari・PEPPERMINT（shop）・大会の会場
  stage: `${REMAKE_IMG}backgrounds/bg_tournament_stage.webp`,
  // 配合のはかり（VPL37）
  scale: `${OWN_IMG}ui-scale.webp`,
  // 葉のパッケージは本編の店の絵（remake/img/shop/heaven10/ の10種・VPL39）
  ...Object.fromEntries(["mint", "double_apple", "blueberry", "strawberry", "pineapple", "lemon", "orange", "grape", "watermelon", "cinnamon"].map((id) => [`pkg_${id}`, `${REMAKE_IMG}shop/heaven10/${id}.webp`])),
  // 器の葉は、写真のような刻み葉（赤寄り・茶色寄り）を器の口に流し込んだ絵（VPL53）。配合ではフレーバーの色の割合で重ねる
  leafRed: `${OWN_IMG}ui-leaf-red.webp`,
  leafBrown: `${OWN_IMG}ui-leaf-brown.webp`,
  ...Object.fromEntries(["partial", "airy", "normal", "firm"].map((k) => [`bowl_${k}_brown`, `${OWN_IMG}ui-bowl-${k}-brown.webp`])),
  bowl_partial: `${OWN_IMG}ui-bowl-partial.webp`,
  // 雑念よけは本編（横画面）の見た目を縦に組み直す（VPL44）: 本編の雑念の場
  mindWorld: `${REMAKE_IMG}ui/making/steam_mind_world.webp`,
  // 制作ランクの絵（本編の D〜SSS・CSL10）
  ...Object.fromEntries(["D", "C", "B", "A", "S", "SS", "SSS"].map((g) => [`rank${g}`, `${REMAKE_IMG}ui/craft-rank/rank-${g}.webp`])),
  ...(globalThis.PORTRAIT_STAGE_ASSETS || {}),
};

// 立ち絵の寸法（remake/data/manifest.json の portraitVariants.new と data/characters.json の spriteScale の写し）
// h=絵の高さに対する人物の高さ、b=足元の余白、ax=横の中心、scale=身長の比
const CAST = {
  minto: { name: "みんと", en: "MINTO", h: 0.9008, b: 0.0492, ax: 0.5, scale: 0.91 },
  sumi: { name: "スミさん", en: "SUMI", h: 0.9, b: 0.05, ax: 0.5004, scale: 1.05 },
  tsumugi: { name: "つむぎ", en: "TSUMUGI", h: 0.7242, b: 0.0217, ax: 0.4926, scale: 0.88 },
};
const ASPECT = 896 / 1200;

// 第1章 DAY5 昼の橙須（座標は remake/js/daily/spots.js と同じ。地図の絵に対する %）
// face=そこに居る人の顔、glyph=人の居ない場所の絵記号、fee=料金、perk=[絵記号, 短い語]
const SPOTS = [
  { id: "tonari", label: "tonari", x: 86, y: 36, face: "faceSumi", who: "スミさん", mark: true, perk: ["work", "バイト"] },
  { id: "naru", label: "KEMURIKUSA", x: 70, y: 24, face: "faceNaru", who: "なる", mark: true, fee: "3,000" },
  { id: "adam", label: "EDEN", x: 46, y: 48, face: "faceAdam", who: "アダム", closed: true },
  { id: "minto", label: "PEPPERMINT", x: 32, y: 59, face: "faceMinto", who: "みんと", mark: true, fee: "3,000" },
  { id: "shop", label: "Dr.fookah", x: 36, y: 30, glyph: "cart", who: "仕入れ", perk: ["clock0", "0"] },
  { id: "kannon", label: "観音堂", x: 18, y: 57, glyph: "board", who: "心得の盤", perk: ["clock0", "0"] },
  { id: "rest", label: "家", x: 89, y: 44, glyph: "bed", who: "休む", perk: ["heart", "＋"] },
];
const DEFAULT_SPOT = 3;
// 左右キー・点・一覧の並び。地図の左から右の順にして、右を押すと画面も右へ動くようにする
const ORDER = SPOTS.map((spot, i) => i).sort((a, b) => SPOTS[a].x - SPOTS[b].x);
const stepSpot = (index, by) => ORDER[(ORDER.indexOf(index) + by + ORDER.length) % ORDER.length];

// 会話の台本（data/dialogue/ch1_minto.json の ch1_minto_first、ch1_tsumugi.json の ch1_tsumugi_research から）
const TALKS = {
  minto: {
    place: ["PEPPERMINT", "繁華街"], bg: "shop", acc: "#8ff0c9",
    steps: [
      { kind: "narr", text: "店に入ると、レトロな内装と、常連客の声に包まれた。" },
      { kind: "inner", text: "（チェキ？ 推し？ ……tonariとは、ずいぶん違うな）" },
      { kind: "say", id: "minto", face: "smile", text: "あらためて♡ はじめくん、初ご来店ありがとっ！" },
      { kind: "say", id: "minto", face: "wink", text: "ご指名ありがとうございますっ♡ 今日はみんとに任せてね？" },
      { kind: "say", id: "minto", face: "smile", text: "はじめくん、どんなシーシャが好き？", choice: ["渋いの派です", "甘いのも、気になってます"] },
      { kind: "say", id: "minto", face: "wink", text: "初めてのお客様には、みんとイチ推しの『フラミンゴ・ピーチ』っ♡ 甘くてカワイイの！" },
    ],
  },
  tonari: {
    place: ["tonari", "バイト先"], bg: "tonari", acc: "#ffc978",
    steps: [
      { kind: "say", id: "tsumugi", face: "normal", text: "イラストのコンテストに出したくて。ここで過ごす時間を、一枚にしたいんです" },
      { kind: "player", text: "この店を選んでくれたんだ。スミさん、いいですよね？" },
      { kind: "say", id: "sumi", face: "normal", text: "構わん。客の顔を載せる時は、本人に聞けよ" },
      { kind: "say", id: "tsumugi", face: "normal", text: "はい。顔は描かずに、手元や座ってるところだけ" },
      { kind: "say", id: "tsumugi", face: "smile", text: "……ここがいいんです。ここが、好きなので" },
      { kind: "say", id: "sumi", face: "smile", text: "店の名前も入ってるな。いい宣伝だ" },
    ],
  },
};
const PACKS = [
  { id: "airy", name: "ふんわり", dens: 1 },
  { id: "normal", name: "ノーマル", dens: 2 },
  { id: "firm", name: "デンスパック", dens: 3, locked: true },
];
// 工程（上の並び）と、スミさんの一言
const STEPS = [["water", "水入れ"], ["mix", "配合"], ["pack", "詰め方"], ["holes", "穴あけ"], ["coal", "炭焼き"], ["steam", "蒸らし"], ["pull", "吸い出し"], ["care", "調整"]];
// この試作で遊べる作る場面（本編と同じ順。炭と調整は省く）
const CRAFT_SCENES = ["water", "mix", "pack", "holes", "coal", "steam", "pull"];
// 温度ゲージを出す場面（VPL61）。穴あけ・炭焼き・雑念よけの間は消し、吸い出しで戻す
const THERMO_ON = new Set(["pack", "pull"]);
const COACH = {
  water: "線のあいだまで注げ",
  coal: "全面が赤くなったら取れ",
  mix: "レモンを2g以上。合わせて12g",
  steam: "雑念は、よけて流せ",
  pack: "詰め方を見比べて決めよう。迷ったらノーマル",
  holes: "目印に重なったら押せ。色が満ちたら離せ",
  pull: "手元を見ているぞ。落ち着いていけ",
};
// 制作ランク（VPL30）。本編のリニューアルと同じく、D から始まり、工程を1つ終えるたびに1段上がる（CRN01・CRN12）。
// この試作では穴あけと吸い出し（提供）を終えた時に上がる。上がった瞬間は舞台の真ん中に大きく出して（下の英語まで読める）、置き場所へ縮めて収める
const GRADES = ["D", "C", "B", "A", "S", "SS", "SSS"];
const RANK_PLACES = {
  d: { name: "工程の終わりに上へどかっと → 右上へ", lead: "工程（穴あけ・吸い出しなど）を終えた時、上の絵の真ん中にどかっと落ちてきて（絵が揺れ、衝撃の輪が広がる）、そのあと右上（工程の並びの右、熱ゲージの上）へ移って札になる。下の細い線が次のランクまでの進み" },
  a: { name: "パッドの裏に透かし", lead: "操作パネルの裏に大きく薄く敷く。工程が進むと、文字が下から明るく満ちていく。上がった瞬間だけ舞台に大きく出て、裏へ沈む" },
  b: { name: "舞台の左上の札", lead: "絵の左上に札で置く（熱ゲージの反対側）。下の細い線が次のランクまでの進み。上がった瞬間は舞台の真ん中に大きく出て、札へ縮む（本編と同じ動き）" },
  c: { name: "工程の段の右端", lead: "上の工程の並びの右端に小さく置く（本編の上の帯と同じ場所）。下の細い線が次のランクまでの進み。上がった瞬間は舞台の真ん中に大きく出て、右上へ縮む" },
};
const HOLE_COUNT = 10;
// 穴あけ: 一瞬押して、その押し具合で深さが決まる（VPL27）。「刺す」を押すと約0.2秒で色が下から上へ満ち、満ちた瞬間に離すのがちょうどいい。
// 満ちる前に離す＝浅い、満ちたまま0.5秒を越える＝深すぎ（少し大きい穴）、0.85秒で刺し抜ける＝大きい。
// 0.5秒・0.85秒は本編（remake/js/craft/holes_logic.js の PRESS）と同じ。浅いの境は本編の0.12秒を、満ちるのが見える0.2秒にしている
const HOLD_FULL = 850;
const FILL_MS = 200;
const GOOD_PRESS = [FILL_MS / HOLD_FULL, 500 / HOLD_FULL];
const pressZone = (fill) => fill <= 0 ? "" : fill < GOOD_PRESS[0] ? "under" : fill < GOOD_PRESS[1] ? "good" : "over";
const holeDepth = (fill) => fill < GOOD_PRESS[0] ? "shallow" : fill < GOOD_PRESS[1] ? "small" : fill < 1 ? "wide" : "large";
// 箔の上の穴の半径（箔の幅を200とした値）。標準は箔の幅の約3%。比は本編の HOLE_SIZES（0.2・1・1.35・1.7）に近づけた
const HOLE_R = { shallow: 1.3, small: 3, wide: 4, large: 5 };
// 熱ゲージ: 本編（remake/js/craft/thermometer.js・temperature-model.js）と同じ色の意味。
// 管は一本のグラデーション（クリーム→黄→適温のミント緑→橙→赤→深紅）。緑が適温の目安、真ん中の虹が合わせやすい範囲、一番上が焦げる帯（炎）
const TEMP_ZONE = [0.42, 0.66];
const TEMP_BEST = [0.5, 0.58];
const TEMP_DANGER = 0.9;
const SCALE_COLORS = [[0, "#fff4d2"], [.13, "#ffedb0"], [.26, "#ffe270"], [.37, "#ffd12a"], [.40, "#f6d559"], [.42, "#67d2a3"],
  [.44, "#4fcf98"], [.54, "#74e0b0"], [.64, "#4fcf98"], [.66, "#79d9a9"], [.71, "#ffb247"], [.76, "#ff8a2a"],
  [.83, "#ff3f17"], [.89, "#eb210d"], [.94, "#b0140a"], [1, "#650609"]];
const SCALE = `linear-gradient(0deg, ${SCALE_COLORS.map(([at, color]) => `${color} ${at * 100}%`).join(", ")})`;
const tempState = (t) => t >= TEMP_BEST[0] && t <= TEMP_BEST[1] ? "best" : t >= TEMP_ZONE[0] && t <= TEMP_ZONE[1] ? "ok" : t >= TEMP_DANGER ? "burn" : "";

// 登場カットイン（縦画面の案）。文言は data/characters.json の intro_cutin、色は remake/data/manifest.json の introArt、
// 好きなフレーバーは remake/js/vn/intro-flavors.js の写し。name は [字, ふりがな] の並び（null は苗字と名前の小さな空き）
const CUTINS = {
  minto: { name: [["みんと"]], title: "PEPPERMINT人気No.1キャスト", line: ["みんとでーす♪", "全員まとめてライバルね？"], flavor: "ミント",
    color: "#36c59c", secondary: "#ffdbeb", shadow: "#042f22", motion: "bounce", art: "ciMinto", bg: "ciBgMinto", backdrop: "shop", acc: "#8ff0c9",
    focus: 0.53, after: { id: "minto", face: "smile", text: "あらためて♡ はじめくん、初ご来店ありがとっ！" }, before: "（チェキ？ 推し？ ……tonariとは、ずいぶん違うな）" },
  sumi: { name: [["炭吉", "すみよし"], null, ["丈一郎", "じょういちろう"]], title: "はじめの師匠", line: ["客が満足したなら、", "それでいい"], flavor: "カルダモン",
    color: "#ad603b", secondary: "#f0c79f", shadow: "#351608", motion: "soft", art: "ciSumi", bg: "ciBgSumi", backdrop: "tonari", acc: "#ffc978",
    focus: 0.5, after: { id: "sumi", face: "normal", text: "構わん。客の顔を載せる時は、本人に聞けよ" }, before: "（スミさん。いつもの、店の奥の定位置だ）" },
};
const CUT_VARIANTS = {
  a: { name: "縦のポスター", lead: "画面いっぱいの一枚絵。上に人物、真ん中に斜めの帯と名前、下に一言。横画面の今の組み方を縦に組み替えたもの" },
  b: { name: "縦書きの名札", lead: "人物を大きく画面いっぱいに置き、右に縦長の帯で名前を縦書き。一言は下の斜めの帯に。アニメの登場紹介のような見せ方" },
  c: { name: "上の舞台だけ", lead: "絵の場所（上）だけが紹介に変わり、テロップとパッドは残る。一言はテロップに出て、Aで次へ。会話の流れを止めない軽い見せ方" },
};
const CUT_HOLD = 3800; // 紹介を見せる長さ（ms）。横画面の今の版とほぼ同じ

// 水入れ（VPL36）。本編 remake/js/craft/water.js の値: 目安 0.44〜0.56、ステムの先 0.30、深すぎ 0.85、注ぐ 0.18/秒・こぼす 0.03/秒。水は空から
const WATER = { low: 0.44, high: 0.56, stem: 0.3, deep: 0.85, pour: 0.18, drain: 0.03 };
const waterZone = (w) => w <= 0 ? "empty" : w < WATER.stem ? "none" : w < WATER.low ? "shallow" : w <= WATER.high ? "ideal" : "deep";
const WATER_SAY = { none: "ステムに届いてないぞ", shallow: "浅いな。吸いが軽くなる", ideal: "いい浸かり具合だ", deep: "深いな。吸いが重くなる" };
// 水入れのボトルは、本編の大会公式モデルの台（img/ui/scene_props/shisha_home_pro.webp）のガラスのベースを切り出して使う（VPL46・img/ui-bottle-pro.webp・464×650）。
// 内側の形と水位: 底（y=570）から上へ。底近くまで入ったステムの先（y=532）が水位0.30になる
const BOTTLE_IN = "M173 150 L177 160 L177 180 L176 190 L175 200 L172 210 L168 220 L163 230 L157 240 L149 250 L141 260 L132 270 L124 280 L115 290 L108 300 L102 310 L97 320 L93 330 L90 340 L88 350 L86 360 L85 370 L85 400 L84 410 L83 420 L82 430 L81 440 L79 450 L76 460 L72 470 L68 480 L62 490 L54 500 L43 510 L30 520 L19 530 L13 540 L10 550 L9 560 L11 570 L452 570 L454 560 L453 550 L450 540 L445 530 L433 520 L419 510 L409 500 L401 490 L395 480 L391 470 L387 460 L384 450 L382 440 L381 430 L380 420 L379 410 L378 400 L378 380 L377 370 L376 360 L375 350 L373 340 L370 330 L366 320 L361 310 L355 300 L348 290 L340 280 L331 270 L322 260 L313 250 L306 240 L299 230 L294 220 L290 210 L288 200 L287 190 L286 180 L286 160 L290 150 Z";
const waterY = (w) => 570 - w * 127;
// 配合（VPL36）。本編 steps.js の stepMix: 葉を1gずつ器へ。器（シリコン）は12g、第1章の課題はレモン2g以上
// 葉のジャンルは店番ゲーム（remake/js/daily/tonari-floor-data.js の WISHES・tonari-floor-art.js の印）と同じ（VPL47）
const GENRES = {
  fruit: { name: "フルーティ", color: "#ff8f6b", icon: '<path d="M12 8.2c-1.7-1.3-4.7-1.1-6.1 1.1-1.6 2.5-.6 6.8 1.7 9.3 1.3 1.5 2.9 1.6 4.4.7 1.5.9 3.1.8 4.4-.7 2.3-2.5 3.3-6.8 1.7-9.3-1.4-2.2-4.4-2.4-6.1-1.1z" fill="currentColor"/><path d="M12 8.2c0-2.2 1-3.9 3.2-4.8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' },
  sweet: { name: "スイート", color: "#f7a8d8", icon: '<circle cx="12" cy="12" r="4.6" fill="currentColor"/><path d="M7.6 12 3 8.2v7.6zM16.4 12 21 8.2v7.6z" fill="currentColor"/>' },
  fresh: { name: "刺激系", color: "#7fd8e8", icon: '<path d="M10.5 3H19l-5.6 7.1H18L4.7 21l4.4-8H4.6z" fill="currentColor"/>' },
  deep: { name: "リラックス", color: "#b9a6ff", icon: '<path d="M19.6 14.9A8.2 8.2 0 1 1 9.1 4.4a6.6 6.6 0 0 0 10.5 10.5z" fill="currentColor"/>' },
};
// 第1章の葉（本編の ID）。ジャンルは店番の表（ダブルアップル＝刺激系＋フルーティ、ミント＝刺激系、レモン＝フルーティ＋刺激系）。
// パッケージの切り出しは本編 remake/js/daily/shop-art.js の box（512×512 の絵）
// 葉の色（leaf）は実物に合わせて、色を付けた果物系＝赤寄り、ミントやシナモン・柑橘＝茶色寄り（VPL50・VPL53）
const MIX = [
  { id: "double_apple", name: "ダブルアップル", genre: "fresh", sub: "fruit", leaf: "red", box: [105, 53, 304, 405] },
  { id: "mint", name: "ミント", genre: "fresh", leaf: "brown", box: [124, 85, 264, 347] },
  { id: "lemon", name: "レモン", genre: "fruit", sub: "fresh", leaf: "brown", need: 2, box: [104, 51, 306, 408] },
  { id: "blueberry", name: "ブルーベリー", genre: "fruit", leaf: "red", box: [104, 51, 305, 407] },
  { id: "strawberry", name: "ストロベリー", genre: "fruit", leaf: "red", box: [104, 51, 305, 407] },
  { id: "grape", name: "グレープ", genre: "fruit", leaf: "red", box: [110, 57, 295, 404] },
  { id: "watermelon", name: "スイカ", genre: "fruit", sub: "fresh", leaf: "red", box: [104, 51, 305, 408] },
  { id: "orange", name: "オレンジ", genre: "fruit", sub: "fresh", leaf: "brown", box: [104, 51, 306, 408] },
  { id: "pineapple", name: "パイナップル", genre: "fruit", leaf: "brown", box: [104, 51, 306, 408] },
  { id: "cinnamon", name: "シナモン", genre: "fresh", sub: "sweet", leaf: "brown", box: [102, 51, 308, 409] },
];
const pkgHtml = (f, h) => {
  const [x, y, w, hh] = f.box, k = h / hh, r = (v) => `${(v * k).toFixed(2)}rem`;
  return `<span class="pkg" style="width:${r(w)};height:${h}rem"><img src="${IMG[`pkg_${f.id}`]}" alt="" style="width:${r(512)};left:${r(-x)};top:${r(-y)}"></span>`;
};
const genreHtml = (id, named = true) => `<i class="genre" style="--g:${GENRES[id].color}"><svg viewBox="0 0 24 24" aria-hidden="true">${GENRES[id].icon}</svg>${named ? `<b>${GENRES[id].name}</b>` : ""}</i>`;
const MIX_CAP = 12;
// 弾幕＝蒸らしの雑念よけ（VPL36）。本編 steam.js の runSteamDodge と steam-patterns.js の calm（第1章）。3分蒸らし＝9秒。
// 弾は4辺からハートを狙い、5つに4つが雑念の言葉。2.8秒ごとに0.75秒の予告（縁が金に光る）のあと波が来る。
// 当たるのはハートの真ん中の芯だけ。当たったあと0.9秒は無敵。点は 100−14×被弾、判子は 0回＝無心、2回まで＝持ちこたえた、それ以上＝雑念まみれ。
// 場は幅390の単位で測る（本編は784×414の横長。縦の場に合わせて弾と移動を少し遅くした）
const DODGE_WORDS = [
  "ちゃんと熱、入ってるかな", "時間が足りないかも", "少し急ぎすぎたかな",
  "失敗したらどうしよう", "うまく作れるかな", "詰め方、これでよかった？", "炭、熾きてたかな",
  "詰めすぎたか？", "灰、落ちないか", "穴、足りてたかな", "温度、大丈夫か",
  "香り、飛んでないか", "手が、汗ばむ", "時間ばかり気になる", "深呼吸、わすれてた",
  "熱、強すぎないかな", "煙、ちゃんと出るかな", "さっきの手順、大丈夫か", "吸い出しで崩したくない",
];
// アタック（本編 steam-slash.js）: 上前方の扇形で言葉の弾を斬る。届く距離80、待ち1.8秒。斬った言葉の数だけ心が落ち着く
const ATTACK = { reach: 92, half: 0.95, cool: 1800, calm: 300 };
// 心の状態（本編 steam-mind.js）: 被弾の衝撃は4秒で引き、被弾の数だけ少し残る。6秒落ち着いていると無心
const MIND_LV = ["clear", "steady", "unsteady", "shaken"];
const MIND_INK = { clear: "#a8e6ff", steady: "#86d6c5", unsteady: "#e4bc77", shaken: "#ef8795" };
const DODGE = { time: 9000, ready: 1200, every: 460, speed: [105, 145], wave: 2800, warn: 750, invuln: 900, bombCool: 8000, bombR: 120, move: 220, slow: 95, core: 4 };
// 炭焼き（VPL54・VPL55）: 本編 remake/js/craft/heat_logic.js の値。炭は3個、取り頃は4.2〜7.4秒の抽選（隣の炭と0.75秒以上ずらす）、
// ジャストの幅は0.5秒（試作はレッスンと同じ×1.5）。p＝経過÷取り頃で判定し、1.75倍で灰になって落ちる。窓が開く0.3秒前に一度だけ瞬く
const HEAT = { count: 3, ready: [4200, 7400], gap: 750, just: 750, drop: 1.75, blink: 300, lead: 900 };
const heatJudge = (p, jw) => p < 0.35 ? ["raw", 15, "MISS"] : p < 0.7 ? ["early", 45, "MISS"] : p < 1 ? ["pre", 78, "GOOD"] : p < 1 + jw ? ["just", 100, "EXCELLENT"] : p < 1.3 + jw ? ["hot", 80, "GOOD"] : ["over", 68, "MISS"];
// コンロの上の炭の中心（コンロの絵 1280×853 に対する割合）。押しやすいよう炭を大きくし、間を広げた（VPL57）
const COAL_AT = [[0.445, 0.27], [0.3, 0.575], [0.59, 0.575]];
// 取った炭の置き場所（はじめの絵 1024×1536 に対する割合）: 左手に持った炭壺の口の中
const POT_SLOTS = [[0.735, 0.8], [0.835, 0.8], [0.785, 0.84]];
// 会場（作る場面の背景）
const VENUES = { tonari: "tonari", shop: "PEPPERMINT", stage: "大会の会場" };

// 本編の心と弾の絵（remake/js/craft/steam-art.js の HEART_ART・BULLET_ART の写し）。心は水色・白い縁、当たるのは真ん中の白い丸だけ
const HEART = typeof Path2D === "function" ? new Path2D("M14 24C9 20 2.5 15.5 2.5 9.5a6 6 0 0 1 11.5-2 6 6 0 0 1 11.5 2C25.5 15.5 19 20 14 24Z") : null;
const BULLET_SVG = {
  orb: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9.5" fill="#b7a4e1" fill-opacity=".2" stroke="#e8dcff" stroke-width="1"/><circle cx="12" cy="12" r="6" fill="#d3c5ee" fill-opacity=".4"/><circle cx="11" cy="10" r="3.5" fill="#fff8e8"/><path d="M6 8a7 7 0 0 1 5-3" fill="none" stroke="#fff" stroke-width="1" stroke-linecap="round"/></svg>',
  coal: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="m12 1 10 7-2 12-11 3L1 13 4 4Z" fill="#53222c" stroke="#ffbe78" stroke-width="1.2"/><path d="m4 4 8 4 10 0-7 7 5 5M12 8l-3 15M1 13l8 2 6 0" fill="none" stroke="#ff915b" stroke-width="1.4"/><path d="m6 6 5 3-2 4-4-1Z" fill="#ffbf73" fill-opacity=".75"/></svg>',
  smoke: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28"><circle cx="14" cy="14" r="12" fill="#8e76be" fill-opacity=".25" stroke="#c8b5e8" stroke-width="1"/><path d="M8 20C1 12 17 3 21 12c4 9-12 13-13 5-1-7 11-9 10-3s-7 7-8 3" fill="none" stroke="#ddd1f9" stroke-width="1.5"/><circle cx="14" cy="14" r="2" fill="#f0e4ff"/></svg>',
};
const BULLET_IMG = typeof Image === "function" ? Object.fromEntries(Object.entries(BULLET_SVG).map(([k, svg]) => { const im = new Image(); im.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`; return [k, im]; })) : {};
// 心の状態（本編 steam-mind.js）: 被弾0＝無心、1＝平静、2＝ざわつく、3以上＝動揺。文字では出さず、奥の時計の色と縁の暗がりで見せる
const MIND = ["#a8e6ff", "#86d6c5", "#e4bc77", "#ef8795"];
// 七つの液晶セグメント（本編 digital-clock.js の形）
const SEG7 = { a: "M6 2h28l4 4-4 4H6L2 6Z", b: "m38 8 4 4v20l-4 4-4-4V12Z", c: "m38 38 4 4v20l-4 4-4-4V42Z", d: "M6 64h28l4 4-4 4H6l-4-4Z", e: "m2 38 4 4v20l-4 4-4-4V42Z", f: "m2 8 4 4v20l-4 4-4-4V12Z", g: "M6 33h28l4 4-4 4H6l-4-4Z" };
const SEG7_ON = ["abcdef", "bc", "abdeg", "abcdg", "bcfg", "acdfg", "acdefg", "abc", "abcdefg", "abcdfg"];
const SEG7_PATH = typeof Path2D === "function" ? Object.fromEntries(Object.entries(SEG7).map(([k, d]) => [k, new Path2D(d)])) : {};

const SCENES = ["map", "minto", "tonari", "water", "mix", "pack", "holes", "coal", "steam", "pull", "cutin"];
const SCENE_LABEL = { map: "地図", minto: "1人", tonari: "2人", water: "水", mix: "配合", pack: "詰め", holes: "穴あけ", coal: "炭焼き", steam: "弾幕", pull: "吸う", cutin: "登場" }; // 1台表示の切り替え
// 一覧（PC）に並べる場面
const GALLERY = [
  { scene: "map", caption: "地図（選んだ店へ画面が動く）" },
  { scene: "map", caption: "地図・行き先の一覧", list: true },
  { scene: "map", caption: "地図・全体を見る", overview: true },
  { scene: "minto", step: 0, caption: "地の文" },
  { scene: "minto", step: 3, caption: "会話（1人）" },
  { scene: "minto", step: 4, choice: true, caption: "返事を選ぶ" },
  { scene: "tonari", step: 2, caption: "会話（2人・スミさんが話す）" },
  { scene: "tonari", step: 3, caption: "会話（2人・つむぎが話す）" },
  { scene: "water", caption: "作る・水入れ", water: 0.5 },
  { scene: "mix", caption: "作る・配合（葉を詰める）", mix: [7, 3, 2] },
  { scene: "pack", caption: "作る・詰め方" },
  { scene: "holes", caption: "作る・穴あけ" },
  { scene: "coal", caption: "作る・炭焼き（tonari）" },
  { scene: "coal", caption: "作る・炭焼き（大会の会場に替えた例）", venue: "stage" },
  { scene: "steam", caption: "作る・蒸らし（雑念よけ）" },
  { scene: "steam", caption: "作る・蒸らし（アタックを覚えた後）", attack: true },
  { scene: "pull", caption: "作る・吸い出し（tonari）" },
  { scene: "pull", caption: "作る・吸い出し（PEPPERMINT に替えた例）", venue: "shop" },
];

/** 登場カットインの名前（ふりがなは ruby。縦書きでも同じ書き方で右に付く） */
const ciName = (parts) => parts.map((part) => part === null ? `<i class="cv-gap"></i>`
  : part[1] ? `<ruby>${part[0]}<rt>${part[1]}</rt></ruby>` : `<span>${part[0]}</span>`).join("");
/** 名前の字数（ふりがな・空きは数えない）。字の大きさを決めるのに使う */
const ciNameLen = (parts) => parts.reduce((n, part) => n + (part === null ? 0.35 : [...part[0]].length), 0);

const esc = (value) => String(value).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const tri = () => `<svg viewBox="0 0 24 24" aria-hidden="true" class="tri"><path d="M12 5l8 13H4z" fill="currentColor"/></svg>`;
// 組版で入った改行は <br> にする（ブラウザに折り直させない）
const typed = (text, delay = 0) => {
  let i = 0;
  return `<span class="type" style="--d:${delay}ms">${String(text).split("\n").map((row) => [...row].map((ch) => `<span style="--i:${i++}">${esc(ch)}</span>`).join("")).join("<br>")}</span>`;
};
const plain = (text) => String(text).split("\n").map(esc).join("<br>");
const TYPE_MS = 26;

// 文字の代わりに使う絵記号（24×24・線画）
const ICONS = {
  dots: '<circle cx="5.500" cy="12" r="1.700" class="f"/><circle cx="12" cy="12" r="1.700" class="f"/><circle cx="18.500" cy="12" r="1.700" class="f"/>',
  chat: '<path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 4v-4A2.5 2.5 0 0 1 4 13.5z"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  list: '<path d="M9 7h11M9 12h11M9 17h11"/><circle cx="4.5" cy="7" r="1.3" class="f"/><circle cx="4.5" cy="12" r="1.3" class="f"/><circle cx="4.5" cy="17" r="1.3" class="f"/>',
  wide: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  near: '<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>',
  bang: '<path d="M12 4.5v9.5"/><circle cx="12" cy="18.7" r="1.4" class="f"/>',
  log: '<path d="M4.5 12a7.500 7.500 0 1 0 2.400-5.500"/><path d="M4 4.500v4.500h4.500"/><path d="M12 8v4.500l3 2"/>',
  auto: '<path d="M8 5.500v13l11-6.500z" class="f"/>',
  skip: '<path d="M4 6v12l8-6zM13 6v12l8-6z" class="f"/>',
  book: '<path d="M12 6.500C10 5 7 4.600 4 5v13c3-.400 6 0 8 1.500 2-1.500 5-1.900 8-1.500V5c-3-.400-6 0-8 1.500zM12 6.500v13"/>',
  gear: '<circle cx="12" cy="12" r="3.300"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.600 5.600l2.100 2.100M16.300 16.300l2.100 2.100M5.600 18.400l2.100-2.100M16.300 7.700l2.100-2.100"/>',
  help: '<path d="M8.500 9a3.500 3.500 0 1 1 5.600 2.800c-1.200.900-2.100 1.600-2.100 3.200"/><circle cx="12" cy="19" r="1.300" class="f"/>',
  coin: '<circle cx="12" cy="12" r="8.500"/><path d="M8.500 7.500l3.500 5 3.500-5M12 12.500V17M9 12.500h6M9 15h6"/>',
  heart: '<path d="M12 20s-7.500-4.600-7.500-10A4.300 4.300 0 0 1 12 7.600 4.300 4.300 0 0 1 19.500 10c0 5.400-7.500 10-7.500 10z" class="f"/>',
  bed: '<path d="M3 18.500V7M3 14.500h18v4M21 14.500V12a2.500 2.500 0 0 0-2.500-2.500H10v5"/><circle cx="6.500" cy="11.300" r="1.700"/>',
  cart: '<path d="M3 5h2.500l2.200 10h10l2-7H7"/><circle cx="9.500" cy="19" r="1.400"/><circle cx="16.500" cy="19" r="1.400"/>',
  work: '<rect x="3.500" y="8" width="17" height="11" rx="2"/><path d="M9 8V6a1.500 1.500 0 0 1 1.500-1.500h3A1.500 1.500 0 0 1 15 6v2M3.500 13h17"/>',
  board: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 9.300h16M4 14.700h16M9.300 4v16M14.700 4v16"/>',
  clock0: '<circle cx="12" cy="12" r="8.500"/><path d="M12 7.500V12l3 2"/>',
  lock: '<rect x="5.500" y="10.500" width="13" height="9.500" rx="2"/><path d="M8.500 10.500V8a3.500 3.500 0 0 1 7 0v2.500"/>',
  think: '<path d="M7 15a4 4 0 0 1-.500-7.900 5 5 0 0 1 9.600-.900A4.200 4.200 0 0 1 17 15z"/><circle cx="8.500" cy="18.500" r="1.200"/><circle cx="5.500" cy="21" r=".800"/>',
  thermo: '<path d="M10 14.500v-9a2 2 0 0 1 4 0v9a4 4 0 1 1-4 0z"/><path d="M12 9v8"/>',
  bell: '<path d="M3.500 18h17M5.500 18a6.500 6.500 0 0 1 13 0M12 9v2.500"/><circle cx="12" cy="7.600" r="1.300"/>',
  cool: '<path d="M6 6l6 6 6-6M6 13l6 6 6-6"/>',
  heat: '<path d="M6 11l6-6 6 6M6 18l6-6 6 6"/>',
  pack: '<path d="M5 8h14l-1.500 5.500a4 4 0 0 1-3.900 3h-3.200a4 4 0 0 1-3.900-3zM9 20h6M12 16.500V20"/>',
  holes: '<circle cx="12" cy="12" r="8.500"/><circle cx="12" cy="7.300" r="1.100" class="f"/><circle cx="16.300" cy="10.500" r="1.100" class="f"/><circle cx="14.700" cy="15.700" r="1.100" class="f"/><circle cx="9.300" cy="15.700" r="1.100" class="f"/><circle cx="7.700" cy="10.500" r="1.100" class="f"/>',
  mix: '<path d="M5 19.500C5 11 11 5 19.500 4.500 19.500 13 13 19.500 5 19.500z"/><path d="M5 19.500l8.500-8.500"/>',
  target: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="1.700" class="f"/><path d="M12 2.500v4M12 17.500v4M2.500 12h4M17.500 12h4"/>',
  coal: '<path d="M12 3.500c1 3.500 5 5.200 5 9.700a5 5 0 0 1-10 0c0-2 1-3.300 2-4.600.300 1.600 1 2.500 2 2.900-.300-2.900.200-5.400 1-8z"/>',
  water: '<path d="M12 3.500c3 4 6 7 6 10.500a6 6 0 0 1-12 0c0-3.500 3-6.500 6-10.500z"/>',
  steam: '<path d="M7 20c-2-2.500 2-4.500 0-7s2-4.500 0-7M12 20c-2-2.500 2-4.500 0-7s2-4.500 0-7M17 20c-2-2.500 2-4.500 0-7s2-4.500 0-7"/>',
  pull: '<path d="M3 9.500h10a3 3 0 1 0-3-3M3 14.500h14a3 3 0 1 1-3 3"/>',
};
ICONS.care = ICONS.bell;
const icon = (name) => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;
/** 人が居る場所は顔、居ない場所は絵記号 */
const avatar = (spot) => spot.face ? `<img src="${IMG[spot.face]}" alt="">` : icon(spot.glyph);
const perkHtml = (spot) => spot.closed ? `<em class="stamp">休</em>` : spot.fee ? `<span class="perk">${icon("coin")}<b>${spot.fee}</b></span>` : `<span class="perk">${icon(spot.perk[0])}<small>${spot.perk[1]}</small></span>`;

/* ───────── 部品 ───────── */

/** 上の表示。地図だけ日付・レベル・体力・お金を出す。会話は場所の名前だけ、シーシャ作りは何も出さない（工程の並びだけ）。
 *  地図: 左に章と日付（小さく）、右に一列でレベル・体力・お金。町は地図の絵で分かるので出さない。天気は文字や絵記号にせず、地図に降る雨で見せる。 */
function hudHtml(kind, place) {
  if (kind === "talk") return `<div class="hud slim"><div class="where"><b>${place[0]}</b></div></div>`;
  return `<div class="hud">
    <div class="where"><b>${place[0]}</b><small>DAY 5</small></div>
    <div class="stats"><span class="pill"><span class="lv" aria-label="レベル2"><small>Lv</small><b>2</b></span><span class="bar xp" style="--v:45%"><i></i></span>
      <i class="sep"></i>${icon("heart")}<span class="bar" style="--v:80%"><i></i></span><i class="sep"></i>${icon("coin")}<b>42,000</b></span></div>
  </div>`;
}

function dpadHtml(live, marks = {}) {
  const key = (dir, label) => `<button class="dp dp-${dir}${live.includes(dir) ? " live" : ""}" data-act="dir" data-dir="${dir}" aria-label="${marks[dir]?.[1] || label}">${tri()}${marks[dir] ? icon(marks[dir][0]) : ""}</button>`;
  return `<div class="dpad${live ? "" : " idle"}" role="group" aria-label="十字キー">${key("up", "上")}${key("left", "左")}${key("right", "右")}${key("down", "下")}<i class="dp-core"></i></div>`;
}
// 丸ボタンの顔。店に入る・決めるは漢字の「決定」、次へと休みは線画、刺すと吸うは道具の白い図形（VPL31・VPL32・VPL34）。
// 読み上げ用の名前は aria-label に残す。ボタンの中の絵は画像を使わず、白い図形で描く（VPL34）
const BTN = {
  go: { label: "店に入る", text: "決定" },
  ok: { label: "決定", text: "決定" },
  next: { label: "次へ", svg: '<path d="M8.5 11.5l7.5 8 7.5-8"/>' },
  rest: { label: "休み", svg: '<path d="M20.5 5.5a11 11 0 1 0 6 15.5 9 9 0 0 1-6-15.5z"/>' },
  poke: { label: "刺す", tool: "needle" },
  puff: { label: "吸う", tool: "mouthpiece" },
  pour: { label: "注ぐ", tool: "pour" },
  drain: { label: "少しこぼす", tool: "drain" },
  bomb: { label: "リフレッシュ（心の周りの雑念を払う）", tool: "bomb" },
};
// ボタンいっぱいの 100×100 で描く
// 吸う: マウスピース（ホースの切れ端・金具・先へ細くなる持ち手・吸い口のチップ）を斜めに。吸うたびに少し動いて光る
const TOOL_SVG = {
  // 刺す（VPL58）: ドライバーのような穴あけの道具を少し斜めに置くだけ。押すと、道具の向き（先の方）へ突き出て、離すと戻る
  needle: `<svg class="tool-svg tool-needle" viewBox="0 0 100 100" aria-hidden="true"><g transform="rotate(32 50 50)"><g class="gl-needle">
    <path d="M39.5 22C39.5 13.5 44 8 50 8S60.500 13.5 60.500 22V35C60.500 39.5 58 42 55.500 43H44.500C42 42 39.500 39.500 39.500 35Z"/><rect x="43" y="45.500" width="14" height="6" rx="1.500"/><path d="M46.800 53.500H53.200L52.300 82 50 92 47.700 82Z"/></g></g></svg>`,
  mouthpiece: `<svg class="tool-svg tool-mouthpiece" viewBox="0 0 100 100" aria-hidden="true"><g class="gl-mp"><g transform="translate(0 -5) rotate(-45 50 50) translate(50 50) scale(0.74) translate(-50 -50)">
    <rect x="-4" y="45" width="16" height="10" rx="4"/><rect x="13.5" y="43.3" width="7.5" height="13.4" rx="1.6"/>
    <path d="M22.5 42.8L78 45Q82 45.3 82 48.2V51.8Q82 54.7 78 55L22.5 57.2Z"/><path class="gl-ring" d="M31 43.6V56.4M72 45V55"/>
    <rect class="gl-tip" x="84" y="46.4" width="20" height="7.2" rx="2.6"/></g></g></svg>`,
  // 注ぐ: 傾けた水差しと、口から落ちる水の粒（注いでいる間は粒が流れる）
  pour: `<svg class="tool-svg tool-pour" viewBox="0 0 100 100" aria-hidden="true"><g transform="rotate(24 50 50)">
    <path d="M30 30H64L76 23L73 34L66 40V70Q66 80 56 80H40Q30 80 30 70Z"/><path class="gl-handle" d="M30 40Q15 40 15 54Q15 67 30 67"/></g>
    <g class="gl-drops"><circle cx="85" cy="50" r="3.4"/><circle cx="86.5" cy="63" r="4"/><circle cx="88" cy="77" r="4.6"/></g></svg>`,
  // こぼす: 傾けた小びんと、口からこぼれる一滴
  drain: `<svg class="tool-svg tool-drain" viewBox="0 0 100 100" aria-hidden="true"><g transform="rotate(-38 50 52)">
    <rect x="43" y="14" width="14" height="22" rx="3"/><path d="M42 36H58L70 54A21 21 0 1 1 30 54Z"/></g>
    <path class="gl-drop" d="M24 50C24 50 17 60 17 64A7 7 0 0 0 31 64C31 60 24 50 24 50Z"/></svg>`,
  // リフレッシュ（VPL62）: 真ん中の心と、そこから広がる波で雑念の粒を外へ払う形。効果（心の周りを払う）がそのまま見える
  bomb: `<svg class="tool-svg tool-bomb" viewBox="0 0 100 100" aria-hidden="true">
    <path class="gl-heart" d="M50 60C42.500 54.500 37 50 37 44.500A6.500 6.500 0 0 1 50 41.500 6.500 6.500 0 0 1 63 44.500C63 50 57.500 54.500 50 60Z"/>
    <circle class="gl-wave" cx="50" cy="50" r="23"/><circle class="gl-wave2" cx="50" cy="50" r="34"/>
    <g class="gl-out"><circle cx="13" cy="17" r="4"/><circle cx="88" cy="16" r="3.400"/><circle cx="10" cy="84" r="3.400"/><circle cx="89" cy="85" r="4"/>
    <path d="M19 23l5 5M82 22l-5 5M16 78l5-5M83 79l-5-5"/></g></svg>`,
  // 精密（VPL62）: 照準。遅く細かく動く切り替え
  slow: `<svg class="tool-svg tool-slow" viewBox="0 0 100 100" aria-hidden="true"><circle class="gl-ring" cx="50" cy="50" r="22"/><circle cx="50" cy="50" r="6"/><path class="gl-ticks" d="M50 14v14M50 72v14M14 50h14M72 50h14"/></svg>`,
  // アタック（VPL62）: 上へ振る斬撃の弧。習得すると精密と入れ替えられる
  attack: `<svg class="tool-svg tool-attack" viewBox="0 0 100 100" aria-hidden="true"><path class="gl-arc" d="M18 70C26 38 52 20 84 18"/><path d="M84 18L70 14 76 28Z"/><path class="gl-arc2" d="M30 80C38 58 54 44 76 38"/></svg>`,
};
const btnFace = (kind) => {
  const b = BTN[kind];
  if (b.text) return `<span class="t">${b.text}</span>`;
  if (b.svg) return `<span class="t"><svg class="glyph" viewBox="0 0 32 32" aria-hidden="true">${b.svg}</svg></span>`;
  return `<span class="t tool">${TOOL_SVG[b.tool]}</span>`;
};
const aHtml = (kind, { disabled = false, cls = "", extra = "" } = {}) => `<button class="btn-a ${cls}" data-act="a" aria-label="${BTN[kind].label}" ${disabled ? "disabled" : ""}>${btnFace(kind)}${extra}</button>`;
// 補助ボタン: [id, 絵記号, 読み上げの名前, 短い名前, 数の印, 押されているか]
const TALK_CHIPS = (st) => [["log", "log", "LOG", "LOG"], ["auto", "auto", "AUTO", "AUTO", "", st.auto], ["skip", "skip", "SKIP", "SKIP", "", st.skip], ["terms", "book", "用語", "用語"], ["config", "gear", "設定", "設定"]];
const CRAFT_CHIPS = [["menu", "menu", "MENU", "MENU"], ["help", "help", "説明", "説明"]];
// 補助ボタンの配置案。1=名前つきの段（今の位置で大きく） 2=肩の大ボタン（よく使う2つだけ。残りは「その他」の中） 3=いちばん下の帯
const AUX = {
  1: { name: "名前つきの段", lead: "今の位置のまま、絵記号に短い名前を添えて横いっぱいに大きくする。場面ごとの並びは今と同じ" },
  2: { name: "肩の大ボタン", lead: "よく使う2つだけを十字キーとAの上（肩）に大きく置く。地図はLIME・MENU、会話はLOG・その他、作る場面はその他・提供。残りは「その他」の中" },
  3: { name: "いちばん下の帯", lead: "スマホのアプリのような帯を画面の最下段に置く。親指が自然に届く位置。そのぶんパッドが上がり、絵が少し小さくなる" },
};
const AUX2 = { map: { l: "lime", r: "menu", more: [] }, talk: { l: "log", r: "more", more: ["auto", "skip", "terms", "config"] }, craft: { l: "more", r: null, more: ["help", "menu"] } };

function meterHtml() {
  const C = 100, RO = 92, RI = 60;
  const pt = (t, r) => { const a = Math.PI * (1 - t); return [C + r * Math.cos(a), C - r * Math.sin(a)]; };
  const band = (t0, t1, cls, style = "") => {
    const [x0, y0] = pt(t0, RO), [x1, y1] = pt(t1, RO), [x2, y2] = pt(t1, RI), [x3, y3] = pt(t0, RI);
    return `<path class="${cls}" ${style ? `style="${style}"` : ""} d="M${x0.toFixed(2)} ${y0.toFixed(2)}A${RO} ${RO} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}L${x2.toFixed(2)} ${y2.toFixed(2)}A${RI} ${RI} 0 0 0 ${x3.toFixed(2)} ${y3.toFixed(2)}Z"/>`;
  };
  const steps = (t0, t1, cls, n, from, to) => Array.from({ length: n }, (_, i) => band(t0 + (t1 - t0) * i / n, t0 + (t1 - t0) * (i + 1) / n + 0.002, cls, `--mix:${Math.round(from + (to - from) * i / (n - 1))}%`)).join("");
  return `<svg class="meter" viewBox="-6 -2 212 112" role="img" aria-label="吸い出しのメーター">
    ${band(0, 0.13, "z z-cold")}${band(0.13, 0.2, "z z-keep")}${steps(0.2, 0.44, "z z-cool", 6, 100, 0)}
    ${band(0.44, 0.56, "z z-just")}${steps(0.56, 0.8, "z z-warm", 6, 0, 100)}${band(0.8, 0.87, "z z-keep")}${band(0.87, 1, "z z-hot")}
    <g class="needle"><path d="M100 10L103.2 96L96.8 96Z"/></g>
  </svg>`;
}

/* ───────── 1台ぶん ───────── */

class Phone {
  constructor(el, scene, { fixed = false, step = 0, list = false, overview = false, choice = false, aux = 1, more = false, ci = "a", who = "minto", rank = "d", grade = 0, gradeP = 0, water = 0, mix = null, venue = "tonari", attack = false } = {}) {
    this.el = el;
    el.lang = "ja";
    this.fixed = fixed; // 一覧では場面を固定し、その場面の中の操作だけ動かす
    this.aux = [1, 2, 3].includes(aux) ? aux : 1; // 補助ボタンの配置案
    this.moreOpen = !!more;
    el.dataset.aux = String(this.aux);
    this.uid = (Phone.seq = (Phone.seq || 0) + 1); // SVG の id を台ごとに分ける
    this.keys = new Set();
    this.rankAt = RANK_PLACES[rank] ? rank : "d"; // ランクの置き場所の案
    this.venue = VENUES[venue] ? venue : "tonari"; // 作る場面の会場（背景）
    this.attackLearned = !!attack; // 雑念よけのアタックを覚えたか（覚えると精密と入れ替える切り替えが出る・VPL62）
    this.st = { scene, sel: DEFAULT_SPOT, step, page: 0, grade: Math.max(0, Math.min(6, Number(grade) || 0)), gradeP: Number(gradeP) || 0, choosing: choice, pick: 0, list, overview, auto: false, skip: false, pack: 1, holes: [], pulls: 0, temp: 0.4,
      water: Number(water) || 0, mix: MIX.map((f, i) => (Array.isArray(mix) ? mix[i] : 0) || 0), mixSel: 0, slow: false, sub: attack ? "attack" : "slow",
      ci: ["a", "b", "c"].includes(ci) ? ci : "a", who: CUTINS[who] ? who : "minto", ciPhase: "off" };
    this.cam = null;      // 地図をドラッグした時の位置（選び直すと選んだ店へ戻る）
    this.t0 = performance.now();
    this.typedAt = 0;
    el.addEventListener("click", (event) => this.onClick(event));
    el.addEventListener("pointerdown", (event) => this.onDown(event));
    el.addEventListener("pointermove", (event) => this.onMove(event));
    el.addEventListener("pointerup", (event) => this.onUp(event));
    el.addEventListener("pointercancel", (event) => this.onUp(event));
    this.tick = this.tick.bind(this);
    this.render({ instant: fixed });
    requestAnimationFrame(this.tick);
  }

  get talk() { return TALKS[this.st.scene]; }

  /** 補助ボタン。kind は map / talk / craft。配置は this.aux の案に従う。 */
  auxHtml(kind, items) {
    const btn = (cls) => ([id, name, label, short, badge, on]) => `<button class="${cls}${on ? " on" : ""}" data-act="fn" data-fn="${id}" aria-label="${label}">${icon(name)}<span>${short}</span>${badge ? `<em>${badge}</em>` : ""}</button>`;
    if (this.aux === 3) return `<div class="tabbar">${items.map(btn("tab")).join("")}</div>`;
    if (this.aux === 2) {
      const cfg = AUX2[kind], find = (id) => items.find((item) => item[0] === id);
      const side = (id) => !id ? "" : id === "more"
        ? `<button class="sh more-btn${this.moreOpen ? " on" : ""}" data-act="more" aria-expanded="${this.moreOpen}" aria-label="その他">${icon("dots")}<span>その他</span></button>`
        : btn("sh")(find(id));
      const more = cfg.more.map(find);
      return `<div class="shoulders"><span class="l">${side(cfg.l)}</span><span class="r">${side(cfg.r)}</span></div>
        ${more.length ? `<div class="more ${cfg.l === "more" ? "from-l" : "from-r"}${this.moreOpen ? " open" : ""}">${more.map(btn("chip")).join("")}</div>` : ""}`;
    }
    return `<div class="chips labeled">${items.map(btn("chip")).join("")}</div>`;
  }
  get line() { return this.talk?.steps[this.st.step]; }

  /* ── 描画 ── */

  render({ instant = false, delay = 0 } = {}) {
    const { el, st } = this;
    el.dataset.scene = st.scene;
    el.dataset.kind = this.talk || st.scene === "cutin" ? "talk" : st.scene === "map" ? "map" : "craft";
    el.style.setProperty("--acc", st.scene === "map" ? "#c3b0ff" : this.talk ? this.talk.acc : st.scene === "cutin" ? CUTINS[st.who].acc : "#ffc978");
    clearTimeout(this.ciTimer);
    if (st.scene === "map") el.innerHTML = this.mapHtml();
    else if (this.talk) el.innerHTML = this.talkHtml();
    else if (st.scene === "cutin") { el.innerHTML = this.cutinSceneHtml(); this.playCutin(); return; }
    else el.innerHTML = this.craftHtml();
    if (st.scene === "map") { this.cam = null; this.camera(false); this.syncMap(); }
    if (this.talk) { this.cast = {}; this.applyLine({ instant, delay }); }
    if (st.scene === "holes") this.drawHoles();
    if (st.scene === "water") this.syncWater();
    if (st.scene === "mix") this.syncMix();
    if (st.scene === "steam") requestAnimationFrame(() => this.startDodge());
    if (st.scene === "coal") this.startCoals();
    if (!this.talk && st.scene !== "map") this.fitCoach();
  }

  /** スミさんの一言も本編の組版で折る（文末・読点を優先し、語の途中で折らない）。2行に収まらない一言は書き直す（VPL29）。 */
  fitCoach() {
    const say = this.el.querySelector(".coach .say-text");
    if (!say) return;
    const text = this.coachSay ?? COACH[this.st.scene];
    say.textContent = text;
    // 吹き出しは文の幅に縮むので、測る間だけ使える幅いっぱいに広げる（短い一言が要らない所で折れないように）
    const bubble = say.parentElement;
    bubble.style.flex = "1 1 auto";
    const pages = paginateForBox(text, say);
    bubble.style.flex = "";
    if (pages.length === 1) say.innerHTML = plain(pages[0]);
    else console.warn("スミさんの一言が2行に収まらない:", text);
  }

  /* ── 地図 ── */

  mapHtml() {
    const { st } = this;
    return `
      <img class="amb" src="${IMG.map}" alt="">
      <div class="pic map${st.overview ? " overview" : ""}" data-map>
        <div class="map-pan"><img src="${IMG.map}" alt="橙須の地図" draggable="false">
          ${SPOTS.map((spot, i) => `<div class="pin${spot.closed ? " closed" : ""}" style="--mx:${spot.x}%;--my:${spot.y}%" data-spot="${i}">
            <i class="pin-ring"></i><span class="pin-dot">${avatar(spot)}${spot.closed ? `<em class="off">休</em>` : spot.mark ? `<em>!</em>` : ""}</span>
            <button class="pin-hit" data-act="spot" data-spot="${i}" aria-label="${esc(spot.label)}"></button></div>`).join("")}
        </div>
        <i class="rain" aria-hidden="true"></i>
      </div>
      <i class="veil"></i>
      ${hudHtml("map", ["第1章", "橙須"])}
      <div class="body">
        <div class="telop" data-slot="telop">${this.destHtml()}</div>
        <div class="ctrl" data-slot="ctrl">${this.mapCtrlHtml()}</div>
      </div>
      <div class="sheet${st.list ? " open" : ""}" data-slot="sheet">${this.sheetHtml()}</div>`;
  }

  destHtml() {
    const spot = SPOTS[this.st.sel];
    return `<div class="name"><b>${esc(spot.label)}</b></div>
      <div class="glass dest${spot.closed ? " closed" : ""}" data-swipe>
        <div class="who"><span class="ava">${avatar(spot)}${spot.face && !spot.closed ? `<i class="on"></i>` : ""}</span><b>${esc(spot.who)}</b></div>
        ${perkHtml(spot)}
        <div class="dots">${ORDER.map((i) => `<button data-act="spot" data-spot="${i}" aria-current="${i === this.st.sel}" aria-label="${esc(SPOTS[i].label)}" class="${SPOTS[i].mark ? "mark" : ""}"></button>`).join("")}</div>
      </div>`;
  }

  mapCtrlHtml() {
    const { st } = this, spot = SPOTS[st.sel];
    const marks = SPOTS.filter((s) => s.mark).length;
    return `${this.auxHtml("map", [["lime", "chat", "LIME", "LIME", "1"], ["menu", "menu", "MENU", "MENU"], ["next", "bang", "用事のある店へ", "用事", String(marks)], ["wide", st.overview ? "near" : "wide", st.overview ? "寄る" : "全体を見る", st.overview ? "寄る" : "全体", "", st.overview]])}
      ${dpadHtml(st.list ? "up down" : "up down left right", st.list ? {} : { up: st.overview ? ["near", "寄る"] : ["wide", "全体を見る"], down: ["list", "一覧"] })}${aHtml(st.list ? "ok" : spot.closed ? "rest" : "go", { disabled: !st.list && spot.closed })}`;
  }

  sheetHtml() {
    return `<header>${icon("list")}<span></span><button data-act="list" aria-label="閉じる">×</button></header>
      <div class="rows">${ORDER.map((i) => [SPOTS[i], i]).map(([spot, i]) => `<button class="row${spot.closed ? " closed" : ""}" data-act="spot-go" data-spot="${i}" aria-current="${i === this.st.sel}">
        <span class="ava">${avatar(spot)}</span><b>${esc(spot.label)}</b>
        <span class="side">${spot.mark ? `<em>!</em>` : ""}${perkHtml(spot)}</span></button>`).join("")}</div>`;
  }

  /** 選んだ店が見える位置へ地図を動かす（寄り）。全体表示では地図の幅を画面に合わせる。 */
  camera(animate = true) {
    const view = this.el.querySelector("[data-map]"), pan = view?.querySelector(".map-pan");
    if (!view || !pan) return;
    const w = view.clientWidth, h = view.clientHeight;
    if (!w || !h) return;
    const mh = h * 1.12, mw = mh * 16 / 9; // 寄りの地図の大きさ
    pan.style.width = `${mw}px`; pan.style.height = `${mh}px`;
    const spot = SPOTS[this.st.sel];
    let x, y, scale = 1;
    if (this.st.overview) {
      scale = w / mw;
      x = 0; y = h * 0.47 - mh * scale / 2;
    } else if (this.cam) {
      ({ x, y } = this.cam);
    } else {
      x = w / 2 - mw * spot.x / 100;
      y = h * 0.4 - mh * spot.y / 100;
    }
    if (!this.st.overview) { x = Math.min(0, Math.max(w - mw, x)); y = Math.min(0, Math.max(h * 0.86 - mh, y)); }
    this.view = { x, y, scale, w, h, mw, mh };
    pan.classList.toggle("no-anim", !animate);
    pan.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
    pan.style.setProperty("--inv", String(1 / scale));
    if (!animate) { pan.getBoundingClientRect(); pan.classList.remove("no-anim"); }
    this.syncMap();
  }

  /** ピンの選択を地図へ反映し、上の表示の下に入ったピンは薄くする（重なって読みにくくならないように）。 */
  syncMap() {
    const { el, st, view } = this;
    el.querySelectorAll(".pin").forEach((pin) => {
      const i = Number(pin.dataset.spot);
      pin.setAttribute("aria-current", String(i === st.sel));
      if (!view) return;
      const py = view.y + view.mh * view.scale * SPOTS[i].y / 100;
      pin.classList.toggle("under", i !== st.sel && py < view.w * 0.2);
    });
  }

  select(index, { keepList = false, keepView = false } = {}) {
    const { st } = this;
    st.sel = index;
    if (st.overview && !keepView) st.overview = false;
    if (!keepList) st.list = false;
    this.cam = null;
    this.patch();
    this.camera(true);
    this.syncView();
    const row = this.el.querySelector('.sheet .row[aria-current="true"]');
    row?.scrollIntoView?.({ block: "nearest" });
  }

  toggleOverview() {
    const { st } = this;
    st.overview = !st.overview; st.list = false; this.cam = null;
    this.syncView(); this.patch(); this.camera(true);
  }

  /** 寄り／全体の切り替えを地図へ反映する。 */
  syncView() {
    this.el.querySelector("[data-map]")?.classList.toggle("overview", this.st.overview);
  }

  /** 場面の中の変化は、テロップ・操作・一覧だけ描き直す（絵は動きを見せるために残す）。 */
  patch() {
    const { el, st } = this;
    if (st.scene === "map") {
      el.querySelector('[data-slot="telop"]').innerHTML = this.destHtml();
      el.querySelector('[data-slot="ctrl"]').innerHTML = this.mapCtrlHtml();
      const sheet = el.querySelector('[data-slot="sheet"]');
      sheet.classList.toggle("open", st.list);
      sheet.querySelectorAll(".row").forEach((row) => row.setAttribute("aria-current", String(Number(row.dataset.spot) === st.sel)));
      this.syncMap();
    } else if (!this.talk) {
      el.querySelector('[data-slot="telop"]').innerHTML = this.craftTelopHtml();
      el.querySelector('[data-slot="ctrl"]').innerHTML = this.craftCtrlHtml();
      const bowl = el.querySelector(".bowl"); if (bowl) bowl.src = IMG[`bowl_${PACKS[st.pack].id}`];
      if (this.quiet) el.querySelector(".coach")?.classList.add("quiet");
      this.fitCoach();
    }
  }

  /* ── 会話 ── */

  talkHtml() {
    const talk = this.talk;
    return `
      <img class="amb" src="${IMG[talk.bg]}" alt="">
      <div class="pic stage"><img class="bg" src="${IMG[talk.bg]}" alt=""><div class="actors"></div></div>
      <i class="veil"></i><img class="smoke" src="${IMG.smoke}" alt="">
      ${hudHtml("talk", talk.place)}
      <div class="body">
        <div class="telop" data-slot="telop"></div>
        <div class="ctrl" data-slot="ctrl"></div>
      </div>
      <div class="placecard"><b>${talk.place[0]}</b><small>${talk.place[1]}</small></div>`;
  }

  /** いまの行を画面へ: 立ち絵（登場・表情・話している側）、名前、テロップ、操作。 */
  applyLine({ instant = false, delay = 0 } = {}) {
    const { el, st } = this, line = this.line;
    // 一覧で途中の行から始める時は、それまでに登場した人を先に立たせる
    if (!Object.keys(this.cast).length) for (const prev of this.talk.steps.slice(0, st.step)) if (prev.id) this.cast[prev.id] = prev.face;
    const speaking = line.kind === "say" ? line.id : null;
    const entering = speaking && !(speaking in this.cast);
    if (speaking) this.cast[speaking] = line.face;
    this.layoutActors({ speaking, entering, instant });

    // 名前は一言だけ（ローマ字の添え書きは無し）。心の声は吹き出しの絵記号で見分ける
    const name = line.kind === "say" ? `<div class="name"><b>${CAST[line.id].name}</b></div>`
      : line.kind === "player" ? `<div class="name player"><b>はじめ</b></div>`
      : line.kind === "inner" ? `<div class="name inner">${icon("think")}<b>はじめ</b></div>` : `<div class="name narr"></div>`;
    const choosing = st.choosing && line.choice;
    el.querySelector('[data-slot="telop"]').innerHTML = `${name}
      <div class="glass${line.kind === "narr" ? " narr" : ""}${choosing ? " ask" : ""}"><p class="text ${line.kind}"></p>${choosing ? "" : `<i class="next"></i>`}</div>
      ${choosing ? `<div class="choices">${line.choice.map((text, i) => `<button class="choice" data-act="pick" data-pick="${i}" aria-current="${i === st.pick}" style="--i:${i}"><i></i>${esc(text)}</button>`).join("")}</div>` : ""}`;
    el.querySelector('[data-slot="ctrl"]').innerHTML = `${this.auxHtml("talk", TALK_CHIPS(st))}
      ${dpadHtml(choosing ? "up down" : "")}${aHtml(choosing ? "ok" : "next")}`;
    // 返事を選ぶ時は、問いの最後のページを出す
    this.showText(el.querySelector('[data-slot="telop"] .text'), line.text, { page: choosing ? Infinity : 0, instant: instant || choosing, delay });
  }

  /** テロップの文を出す。2行に収まらない文は、本編と同じ組版（remake/js/vn/layout.js）で文末を優先して
   * 2行ずつのページに分け、「次へ」で同じ行のまま次のページを出す（VPL29・説明は2行まで）。 */
  showText(target, text, { page = 0, instant = false, delay = 0 } = {}) {
    const pages = paginateForBox(text, target);
    const at = Math.min(page, pages.length - 1), value = pages[at];
    Object.assign(this, { textEl: target, textValue: text, pageCount: pages.length });
    this.st.page = at;
    target.innerHTML = instant ? plain(value) : typed(value, delay);
    this.typedAt = instant ? 0 : performance.now() + delay + [...value].length * TYPE_MS + 120;
    this.el.classList.toggle("typing", !!this.typedAt);
  }

  /** 同じ文の続きのページがあれば出す。 */
  nextPage() {
    if (!this.textEl?.isConnected || this.st.page + 1 >= this.pageCount) return false;
    this.showText(this.textEl, this.textValue, { page: this.st.page + 1 });
    return true;
  }

  /** 立ち絵の位置と大きさ。1人は中央で少し寄り（身長差は半分だけ）、2人は左右で実際の身長差。話している側を手前に明るく。 */
  layoutActors({ speaking = null, entering = false, instant = false } = {}) {
    const box = this.el.querySelector(".actors");
    if (!box) return;
    const ids = Object.keys(this.cast);
    const w = box.clientWidth, h = box.clientHeight;
    if (!w || !h) return;
    const pair = ids.length >= 2;
    const body = h * (pair ? 1.08 : 1.3);       // 身長比1.0の人の「頭の先〜足元」の長さ
    const feet = h * (pair ? 1.28 : 1.46);      // 足元の高さ（絵の下にはみ出す）
    const safeTop = h * (pair ? 0.13 : 0.07);   // 頭がこれより上へ行かない（会話の上は場所の名前だけなので、ほぼ上まで使える）
    ids.forEach((id, index) => {
      const c = CAST[id];
      const scale = pair ? c.scale : 1 + (c.scale - 1) * 0.5;
      const content = body * scale, imgH = content / c.h, imgW = imgH * ASPECT;
      const head = Math.max(safeTop, feet - content);
      const top = head - (1 - c.b - c.h) * imgH;
      const slot = pair ? (index === 0 ? 0.27 : 0.73) : 0.5;
      let img = box.querySelector(`img[data-id="${id}"]`);
      const src = IMG[`${id}_${this.cast[id]}`];
      if (!img) {
        img = document.createElement("img");
        img.className = "actor"; img.dataset.id = id; img.alt = c.name; img.draggable = false; img.src = src;
        if (entering && id === speaking && !instant) img.classList.add("enter");
        box.append(img);
      } else if (img.getAttribute("src") !== src) {
        img.src = src;
        if (!instant) { img.classList.remove("hop"); void img.offsetWidth; img.classList.add("hop"); }
      }
      Object.assign(img.style, { height: `${imgH}px`, left: `${w * slot - imgW * c.ax}px`, top: `${top}px` });
      const active = id === speaking;
      img.classList.toggle("active", active);
      img.classList.toggle("back", pair && speaking !== null && !active);
      img.classList.toggle("hush", speaking === null); // 地の文・心の声・はじめの台詞の間は少し落とす
      if (img.classList.contains("enter")) requestAnimationFrame(() => requestAnimationFrame(() => img.classList.remove("enter")));
    });
  }

  /* ── 登場カットイン（縦画面の案 a・b・c） ── */

  /** 会話の背景の上に紹介を重ねる。紹介の前の行（心の声）を出しておき、紹介が引くと本人が立って最初の台詞を言う。 */
  cutinSceneHtml() {
    const ci = CUTINS[this.st.who];
    return `
      <img class="amb" src="${IMG[ci.backdrop]}" alt="">
      <div class="pic stage"><img class="bg" src="${IMG[ci.backdrop]}" alt=""><div class="actors"></div></div>
      <i class="veil"></i><img class="smoke" src="${IMG.smoke}" alt="">
      ${hudHtml("talk", ci.backdrop === "shop" ? TALKS.minto.place : TALKS.tonari.place)}
      <div class="body">
        <div class="telop" data-slot="telop"></div>
        <div class="ctrl" data-slot="ctrl">${this.auxHtml("talk", TALK_CHIPS(this.st))}${dpadHtml("")}${aHtml("next")}</div>
      </div>`;
  }

  /** 紹介の一枚。v は案、who は人物。 */
  cutinHtml() {
    const { ci: v, who } = this.st, ci = CUTINS[who];
    const len = ciNameLen(ci.name);
    // 名前の大きさ: 横書きは幅に、縦書きは帯の高さに収まる大きさ（rem）
    const size = v === "b" ? Math.min(7.6, 40 / len) : v === "c" ? Math.min(6, 28 / len) : Math.min(8.4, 31 / len);
    const quote = `「${ci.line.join(v === "c" ? "" : "<br>")}」`;
    return `<div class="cv cv-${v}" data-m="${ci.motion}" role="dialog" aria-label="${ci.name.filter(Boolean).map((p) => p[0]).join("")}の紹介"
        style="--ci:${ci.color};--ci2:${ci.secondary};--ci-shadow:${ci.shadow};--name-size:${size.toFixed(2)}rem;--focus:${ci.focus}">
      <i class="cv-flash"></i>
      <img class="cv-bg" src="${IMG[ci.bg]}" alt="">
      <i class="cv-veil"></i>
      <img class="cv-art" src="${IMG[ci.art]}" alt="">
      <div class="cv-band"><i class="cv-accent"></i><div class="cv-name">${ciName(ci.name)}</div></div>
      <div class="cv-tag">${ci.title}</div>
      ${v === "c" ? "" : `<div class="cv-say"><p class="cv-quote">${quote}</p><p class="cv-flavor"><small>好きなフレーバー</small><b>${ci.flavor}</b></p></div><i class="cv-next"></i>`}
    </div>`;
  }

  /** 紹介を出して、少し見せてから引く。一覧（fixed）では見せ終わりの姿で止める。 */
  playCutin() {
    const { el, st } = this, ci = CUTINS[st.who];
    clearTimeout(this.ciTimer);
    this.cast = {};
    el.querySelector(".actors").innerHTML = "";
    el.querySelector(".cv")?.remove();
    // 紹介の前は、心の声の行を出しておく（紹介が重なるのは名乗りの直後）
    const telop = el.querySelector('[data-slot="telop"]');
    if (st.ci === "c") {
      telop.innerHTML = `<div class="name narr"></div>
        <div class="glass"><p class="text say cv-telop">「${ci.line.join("<br>")}」</p><p class="cv-telop-flavor"><small>好きなフレーバー</small><b>${ci.flavor}</b></p><i class="next"></i></div>`;
    } else {
      telop.innerHTML = `<div class="name inner">${icon("think")}<b>はじめ</b></div><div class="glass"><p class="text inner"></p><i class="next"></i></div>`;
      this.showText(telop.querySelector(".text"), ci.before, { instant: true });
    }
    const wrap = document.createElement("div");
    wrap.innerHTML = this.cutinHtml();
    const card = wrap.firstElementChild;
    if (this.fixed) card.classList.add("still");
    el.append(card);
    st.ciPhase = "on";
    el.classList.add("cutin-on");
    if (!this.fixed) this.ciTimer = setTimeout(() => this.endCutin(), CUT_HOLD);
  }

  /** 紹介を引いて、本人を立たせて最初の台詞を出す。 */
  endCutin() {
    const { el, st } = this, ci = CUTINS[st.who];
    if (st.ciPhase !== "on") return;
    clearTimeout(this.ciTimer);
    st.ciPhase = "after";
    const card = el.querySelector(".cv");
    card?.classList.add("out");
    setTimeout(() => card?.remove(), 420);
    el.classList.remove("cutin-on");
    this.cast = { [ci.after.id]: ci.after.face };
    this.layoutActors({ speaking: ci.after.id, entering: true });
    el.querySelector('[data-slot="telop"]').innerHTML = `<div class="name"><b>${CAST[ci.after.id].name}</b></div>
      <div class="glass"><p class="text say"></p><i class="next"></i></div>`;
    this.showText(el.querySelector('[data-slot="telop"] .text'), ci.after.text, { delay: 260 });
  }

  /* ── シーシャ作り ── */

  craftHtml() {
    const { st } = this, at = STEPS.findIndex(([id]) => id === st.scene);
    const bg = `<img class="bg" src="${IMG[this.venue]}" alt="">`;
    const pic = st.scene === "pack" ? `${bg}<img class="bowl" src="${IMG[`bowl_${PACKS[st.pack].id}`]}" alt="">`
      : st.scene === "holes" ? `${bg}<div class="foil"><img src="${IMG.foil}" alt=""><svg viewBox="-100 -100 200 200" class="foil-marks"></svg></div>`
      : st.scene === "water" ? this.waterPic() : st.scene === "mix" ? this.mixPic() : st.scene === "steam" ? this.steamPic() : st.scene === "coal" ? this.coalPic()
      : `${bg}<img class="pull-cg" src="${IMG.pullHajime}" alt=""><img class="puff" src="${IMG.smoke}" alt="">`;
    // 日付・体力・お金は出さない。上は工程の並びだけ。名前の文字は出さず、今の工程は光る丸で示す（VPL31）
    return `
      <img class="amb" src="${IMG[this.venue]}" alt="">
      <div class="pic craft craft-${st.scene}">${pic}</div>
      <i class="veil"></i>
      ${THERMO_ON.has(st.scene) ? this.thermoHtml(this.thermoWas === false ? "fade-in" : "") : this.thermoWas ? this.thermoHtml("fade-out") : ""}
      <button class="help-q" data-act="fn" data-fn="help" aria-label="説明">?</button>
      <div class="steps" aria-label="工程">${STEPS.map(([id, name], i) => `<span class="${i === at ? "now" : i < at ? "done" : ""}" aria-label="${name}"${i === at ? ` aria-current="step"` : ""}>${icon(id)}</span>`).join("")}</div>
      ${this.rankAt === "a" ? "" : this.rankHtml()}
      <div class="body">
        ${this.rankAt === "a" ? this.rankHtml() : ""}
        <div class="telop" data-slot="telop">${this.craftTelopHtml()}</div>
        <div class="ctrl craft" data-slot="ctrl">${this.craftCtrlHtml()}</div>
      </div>`;
  }

  /** 制作ランク（VPL30）。置き場所は案 a/b/c。絵は本編の D〜SSS。 */
  rankHtml() {
    const { st } = this, g = GRADES[st.grade];
    return `<div class="rank rank-${this.rankAt}" data-grade="${g}" role="img" aria-label="ランク ${g}" style="--p:${st.gradeP.toFixed(3)}">
      <span class="rank-box"><img class="rank-art" src="${IMG[`rank${g}`]}" alt="">${this.rankAt === "a" ? `<img class="rank-art rank-fill" src="${IMG[`rank${g}`]}" alt="">` : ""}</span>
      ${this.rankAt === "a" ? "" : `<i class="rank-meter"><i></i></i>`}</div>`;
  }

  /** ランクの絵と進みだけを今の状態に合わせる。 */
  syncRank() {
    const box = this.el.querySelector(".rank");
    if (!box) return;
    const g = GRADES[this.st.grade];
    if (box.dataset.grade !== g) {
      box.dataset.grade = g; box.setAttribute("aria-label", `ランク ${g}`);
      box.querySelectorAll(".rank-art").forEach((img) => { img.src = IMG[`rank${g}`]; });
    }
    box.style.setProperty("--p", this.st.gradeP.toFixed(3));
  }

  /** 工程を終えたら1段上げる。舞台の真ん中に大きく出し（下の英語まで読める）、置き場所へ縮めて収める（本編の burstRank と同じ流れ）。 */
  rankUp({ loop = false } = {}) {
    const { st, el } = this;
    if (st.grade >= GRADES.length - 1) { if (!loop) return; st.grade = -1; }
    st.grade += 1; st.gradeP = 0;
    const place = el.querySelector(".rank");
    if (!place) return;
    el.querySelector(".rank-burst")?.remove();
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { this.syncRank(); return; }
    place.classList.add("waiting");
    this.syncRank();
    const burst = document.createElement("img");
    burst.className = "rank-burst"; burst.alt = ""; burst.src = IMG[`rank${GRADES[st.grade]}`];
    el.append(burst);
    const from = burst.getBoundingClientRect(), to = place.querySelector(".rank-box").getBoundingClientRect();
    const dx = to.left + to.width / 2 - (from.left + from.width / 2), dy = to.top + to.height / 2 - (from.top + from.height / 2);
    const k = to.width / from.width, end = this.rankAt === "a" ? 0.35 : 1;
    const at = (x, y, scale, opacity, offset, easing = "ease-out") => ({ transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(${scale})`, opacity, offset, easing });
    // どかっと（VPL33）: 大きく手前から落ちてきて当たり、少し弾んで止まる。当たった瞬間に上の絵が揺れ、衝撃の輪が広がる。しばらく見せてから置き場所へ
    const HIT = 240;
    burst.animate([at(0, 0, 2.4, 0, 0, "cubic-bezier(0.6, 0, 1, 0.5)"), at(0, 0, 0.93, 1, 0.12), at(0, 0, 1.05, 1, 0.17), at(0, 0, 1, 1, 0.23), at(0, 0, 1, 1, 0.66, "cubic-bezier(0.3, 0.7, 0.2, 1)"), at(dx, dy, k, end, 1)],
      { duration: 2000, fill: "forwards" });
    const ring = document.createElement("i");
    ring.className = "rank-impact";
    el.append(ring);
    ring.animate([{ transform: "translate(-50%, -50%) scale(0.3)", opacity: 0.9 }, { transform: "translate(-50%, -50%) scale(1.8)", opacity: 0 }],
      { duration: 650, delay: HIT, easing: "cubic-bezier(0.1, 0.7, 0.3, 1)", fill: "both" }).finished.then(() => ring.remove()).catch(() => {});
    el.querySelector(".pic")?.animate([{ translate: "0 0" }, { translate: "-0.7rem 0.5rem" }, { translate: "0.6rem -0.4rem" }, { translate: "-0.3rem 0.2rem" }, { translate: "0 0" }],
      { duration: 320, delay: HIT, easing: "linear" });
    burst.getAnimations()[0].finished.then(() => {
      burst.remove();
      place.classList.remove("waiting"); place.classList.add("landed");
      setTimeout(() => place.classList.remove("landed"), 600);
    }).catch(() => {});
  }

  /* ── 水入れ（VPL36・VPL37）: 押している間だけ水が動く。ステムの先が少し浸かる、二本の線のあいだがちょうどいい ── */
  /** ボトルの水（3案で共通）。作り直したボトルの内側の形で切り抜く。neon は絵を使わず光る線で描く。 */
  bottleSvg() {
    const id = `bw${this.uid}`, line = (w) => waterY(w).toFixed(0);
    const bubbles = [0, 1, 2, 3, 4].map((i) => `<circle cx="${212 + (i % 3) * 18}" cy="556" r="${4 + (i % 2) * 2}" style="--i:${i}"/>`).join("");
    return `<svg class="bottle-svg" viewBox="0 0 464 650" aria-hidden="true"><defs><clipPath id="${id}"><path d="${BOTTLE_IN}"/></clipPath>
        <linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fe3f2"/><stop offset="1" stop-color="#2f78b0"/></linearGradient></defs>
        <path class="w-stream" d="M232 -40V200"/>
        <g clip-path="url(#${id})"><rect class="w-body" x="0" y="650" width="464" height="0" fill="url(#${id}g)"/><rect class="w-surf" x="0" y="650" width="464" height="4"/>
          <g class="w-bubbles">${bubbles}</g>
          <path class="w-line" d="M0 ${line(WATER.low)}H464M0 ${line(WATER.high)}H464"/></g>
      </svg>`;
  }

  /** 水入れ（VPL46）: 大会仕様のボトルへ直接注ぐ。水位計は出さない。ステムの先と二本の線が目安 */
  waterPic() {
    return `<img class="bg" src="${IMG[this.venue]}" alt=""><div class="water-a" data-zone="empty"><div class="bottle pro"><img src="${IMG.bottle}" alt="">${this.bottleSvg()}</div></div>`;
  }

  syncWater() {
    const { st, el } = this, w = st.water, y = waterY(w);
    const root = el.querySelector(".water-a");
    if (!root) return;
    root.style.setProperty("--w", w.toFixed(3));
    for (const svg of root.querySelectorAll(".bottle-svg")) {
      const body = svg.querySelector(".w-body"), surf = svg.querySelector(".w-surf");
      body.setAttribute("y", y.toFixed(1)); body.setAttribute("height", w > 0 ? (650 - y).toFixed(1) : "0");
      surf.setAttribute("y", (y - 2).toFixed(1)); surf.style.opacity = w > 0 ? "1" : "0";
      svg.querySelector(".w-stream").setAttribute("d", `M232 -40V${y.toFixed(0)}`);
    }
    const zone = waterZone(w);
    if (root.dataset.zone !== zone) root.dataset.zone = zone;
    root.classList.toggle("pouring", !!this.pouring);
    root.classList.toggle("draining", !!this.draining);
    const ok = el.querySelector('[data-act="decide"]');
    if (ok) { ok.disabled = w <= 0; ok.classList.toggle("hot", zone === "ideal"); }
    el.querySelector(".btn-a.pour")?.classList.toggle("pressing", !!this.pouring);
    el.querySelector('[data-hold="drain"]')?.classList.toggle("pressing", !!this.draining);
  }

  /** 水入れ: この水量で進む。スミさんが浸かり具合を一言で返す（失敗は無く、吸い心地が変わるだけ・本編と同じ）。 */
  decideWater() {
    const { st } = this, zone = waterZone(st.water);
    if (zone === "empty" || this.deciding) return;
    this.pouring = this.draining = false;
    this.say(WATER_SAY[zone]);
    this.deciding = true;
    setTimeout(() => {
      this.deciding = false;
      if (this.fixed) { st.water = 0.5; this.say(null); this.syncWater(); } else if (st.scene === "water") this.setScene("mix");
    }, 1400);
  }

  /** スミさんの一言を差し替える（null で元の一言）。 */
  say(text) {
    this.coachSay = text;
    const coach = this.el.querySelector(".coach");
    if (text) { this.quiet = false; coach?.classList.remove("quiet"); }
    this.fitCoach();
  }

  /* ── 配合（VPL36・VPL48）: 葉を1gずつ器へ。葉は本編のパッケージ、ジャンルは店番と同じ ── */
  mixBowl(cls = "") {
    return `<div class="mixbowl ${cls}"><img class="b-empty" src="${IMG.bowlEmpty}" alt="">
      <img class="b-airy brown" src="${IMG.bowl_partial_brown}" alt=""><img class="b-airy red" src="${IMG.bowl_partial}" alt="">
      <img class="b-full brown" src="${IMG.bowl_normal_brown}" alt=""><img class="b-full red" src="${IMG.bowl_normal}" alt=""></div>`;
  }

  /** 上の画面: はかりの上に器。器ははかりの台の半分ほどの幅（VPL56）。前の表示窓（横30〜63%・縦82〜96%）に重さ */
  mixPic() {
    return `<img class="bg" src="${IMG[this.venue]}" alt=""><div class="mix-a"><div class="scale"><img src="${IMG.scale}" alt="">${this.mixBowl("on-scale")}<b class="digits" aria-hidden="true"><span class="d-num">00</span><span class="d-unit">g</span></b></div></div>`;
  }

  /** 下の画面のフレーバーの一覧（VPL52・VPL56）: 画面の下半分を縦に広く使い、縦にスライドする行（パッケージ・名前・ジャンル・−／＋・g）。 */
  mixCardsHtml() {
    const { st } = this, total = this.mixTotal();
    const btn = (i, by, f) => `<button class="mr-btn" data-act="mixadd" data-i="${i}" data-by="${by}" aria-label="${f.name}を1g${by > 0 ? "増やす" : "減らす"}">${by > 0 ? "＋" : "−"}</button>`;
    return `<div class="picker rows" role="listbox" aria-label="フレーバー">${MIX.map((f, i) => `<div class="mixrow${i === st.mixSel ? " on" : ""}" data-act="mixsel" data-i="${i}" role="option" aria-selected="${i === st.mixSel}">
      ${pkgHtml(f, 5.8)}<span class="mr-name"><b>${f.name}${f.need ? `<small class="need${st.mix[i] >= f.need ? " met" : ""}">${f.need}g〜</small>` : ""}</b><span class="mr-tags">${genreHtml(f.genre, true)}${f.sub ? genreHtml(f.sub, false) : ""}</span></span>
      ${btn(i, -1, f)}<span class="mr-g"><em>${st.mix[i]}</em>g</span>${btn(i, 1, f)}</div>`).join("")}</div>`;
  }

  mixTotal() { return this.st.mix.reduce((a, b) => a + b, 0); }
  mixOk() { return this.mixTotal() === MIX_CAP && MIX.every((f, i) => !f.need || this.st.mix[i] >= f.need); }

  syncMix() {
    const { st, el } = this, total = this.mixTotal(), t = total / MIX_CAP;
    const clamp = (v) => Math.max(0, Math.min(1, v)).toFixed(2);
    const bowl = el.querySelector(".mixbowl");
    if (bowl) {
      // 赤寄りの葉の割合で、茶色の層の上に赤の層を重ねる
      const red = total ? MIX.reduce((n, f, i) => n + (f.leaf === "red" ? st.mix[i] : 0), 0) / total : 1;
      const part = Math.max(0, Math.min(1, (t - 0.05) / 0.35)), full = Math.max(0, Math.min(1, (t - 0.5) / 0.5));
      bowl.querySelector(".b-airy.brown").style.opacity = part.toFixed(2); bowl.querySelector(".b-airy.red").style.opacity = (part * red).toFixed(2);
      bowl.querySelector(".b-full.brown").style.opacity = full.toFixed(2); bowl.querySelector(".b-full.red").style.opacity = (full * red).toFixed(2);
    }
    // 12の枠はジャンルの色。葉が替わる所に細い区切り
    const fill = MIX.flatMap((f, i) => Array.from({ length: st.mix[i] }, (_, k) => ({ c: GENRES[f.genre].color, first: k === 0 })));
    const slots = el.querySelector(".mixbar .slots");
    if (slots) slots.innerHTML = Array.from({ length: MIX_CAP }, (_, i) => `<i${fill[i] ? ` style="--c:${fill[i].c}"${fill[i].first && i ? ` class="cut"` : ""}` : ""}></i>`).join("");
    el.querySelectorAll(".mixsum").forEach((sum) => { sum.innerHTML = `${total}<small>/${MIX_CAP}g</small>`; });
    el.querySelector(".mixbar")?.classList.toggle("full", total === MIX_CAP);
    const num = el.querySelector(".digits .d-num");
    if (num) { num.textContent = String(total).padStart(2, "0"); el.querySelector(".digits").classList.toggle("full", total === MIX_CAP); }
    el.querySelectorAll(".picker [data-i]").forEach((card) => {
      const i = Number(card.dataset.i), on = i === st.mixSel;
      if (card.classList.contains("mr-btn")) return;
      card.classList.toggle("on", on); card.setAttribute("aria-selected", String(on));
      const em = card.querySelector(".mr-g em"); if (em) em.textContent = String(st.mix[i]);
      card.querySelector(".need")?.classList.toggle("met", st.mix[i] >= (MIX[i].need || 0));
    });
    const ok = el.querySelector(".btn-a.mix-ok");
    if (ok) { ok.disabled = !this.mixOk(); ok.classList.toggle("hot", this.mixOk()); }
  }

  addMix(by) {
    const { st, el } = this, i = st.mixSel;
    if ((by > 0 && this.mixTotal() >= MIX_CAP) || (by < 0 && st.mix[i] <= 0)) {
      const bar = el.querySelector(".mixbar");
      bar?.classList.remove("nudge"); void bar?.offsetWidth; bar?.classList.add("nudge");
      return;
    }
    st.mix[i] += by;
    if (by > 0) this.dropLeaf();
    this.syncMix();
  }

  /** 葉を1g入れた時、写真調の葉の粒がいくつか器へ落ちる（器の絵の葉の所を小さく切り取って使う）。 */
  dropLeaf() {
    const bowl = this.el.querySelector(".mixbowl");
    if (!bowl || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const from = -2.6;
    for (let n = 0; n < 4; n++) {
      const bit = document.createElement("i");
      bit.className = "leaf-bit";
      bit.style.left = `${40 + Math.random() * 20}%`;
      bit.style.backgroundImage = `url(${MIX[this.st.mixSel].leaf === "red" ? IMG.leafRed : IMG.leafBrown})`;
      bit.style.backgroundPosition = `${Math.random() * 100}% ${Math.random() * 100}%`;
      bowl.append(bit);
      bit.animate([{ transform: `translate(-50%, ${from * 100}%) rotate(${Math.random() * 90}deg)`, opacity: 0 }, { opacity: 1, offset: 0.2 }, { transform: `translate(${-50 + (Math.random() - 0.5) * 120}%, 260%) rotate(${Math.random() * 200}deg)`, opacity: 0 }],
        { duration: 520 + n * 70, delay: n * 60, easing: "cubic-bezier(0.5, 0, 0.9, 0.6)", fill: "backwards" }).finished.then(() => bit.remove()).catch(() => bit.remove());
    }
  }

  decideMix() {
    if (!this.mixOk() || this.deciding) return;
    this.say("いい配合だ。詰めていこう");
    this.deciding = true;
    setTimeout(() => {
      this.deciding = false;
      if (this.fixed) { this.say(null); } else if (this.st.scene === "mix") this.setScene("pack");
    }, 1200);
  }

  /* ── 弾幕＝蒸らしの雑念よけ（VPL36）: 上の絵いっぱいが雑念の場。十字キー（スティック）か、場を指でなぞって動く ── */
  steamPic() {
    return `<div class="dodge" data-warn="" style="background-image:url(${IMG.mindWorld})"><i class="d-vig"></i><canvas></canvas><i class="d-time"><i></i></i><div class="d-stamp" hidden></div></div>`;
  }

  dodgeSize() {
    const field = this.el.querySelector(".dodge"), canvas = field?.querySelector("canvas");
    if (!canvas || !field.clientWidth) return null;
    const w = field.clientWidth, h = field.clientHeight, k = Math.min(2, devicePixelRatio || 1);
    if (canvas.width !== Math.round(w * k) || canvas.height !== Math.round(h * k)) { canvas.width = Math.round(w * k); canvas.height = Math.round(h * k); }
    return { field, ctx: canvas.getContext("2d"), u: canvas.width / 390, H: h / w * 390 };
  }

  startDodge() {
    const size = this.dodgeSize();
    if (!size || this.st.scene !== "steam") return;
    const now = performance.now();
    this.dodge = { t0: now + DODGE.ready, heart: { x: 195, y: size.H * 0.7 }, bullets: [], hits: 0, safeUntil: 0, bombAt: -1e9, atkAt: -1e9, slashes: [], lastHit: -1e9, calmSince: 0, beat: 0, beatAt: now, rings: [],
      nextSpawn: 0, nextWave: 1600, warn: null, over: false, H: size.H };
    if (this.fixed) {
      // 一覧は途中の一コマ: 言葉と炭・玉が四方から迫り、上から扇の波が来る
      const d = this.dodge, H = size.H;
      d.t0 = now - 4200;
      [["失敗したらどうしよう", 120, H * 0.32], ["温度、大丈夫か", 300, H * 0.48], ["穴、足りてたかな", 90, H * 0.6], ["手が、汗ばむ", 290, H * 0.8]].forEach(([word, x, y]) => d.bullets.push({ x, y, word, hw: word.length * 6.7 }));
      [[230, H * 0.36, "orb", 6], [160, H * 0.5, "coal", 7], [330, H * 0.64, "smoke", 9], [60, H * 0.42, "orb", 6]].forEach(([x, y, kind, r]) => d.bullets.push({ x, y, kind, r }));
      for (let i = 0; i < 5; i++) d.bullets.push({ x: 195 + (i - 2) * 26, y: H * 0.18 + Math.abs(i - 2) * 8, kind: "orb", r: 6 });
      d.heart = { x: 210, y: H * 0.68 };
      size.field.querySelector(".d-time i").style.transform = `scaleX(${(1 - 4200 / DODGE.time).toFixed(3)})`;
      this.drawDodge(now);
      return;
    }
    clearTimeout(this.coachTimer);
    setTimeout(() => { if (this.st.scene === "steam") { this.quiet = true; this.el.querySelector(".coach")?.classList.add("quiet"); } }, DODGE.ready - 100);
  }

  spawnBullet(d) {
    const word = Math.random() < 0.8, r = Math.random();
    const side = r < 0.4 ? "top" : r < 0.65 ? "left" : r < 0.9 ? "right" : "bottom";
    const text = word ? DODGE_WORDS[Math.floor(Math.random() * DODGE_WORDS.length)] : null, hw = word ? text.length * 6.7 : 0;
    const kind = word ? "word" : ["coal", "orb", "orb", "smoke"][Math.floor(Math.random() * 4)];
    const rad = { coal: 8, orb: 7, smoke: 9 }[kind] || 0;
    const x = side === "left" ? -hw - 10 : side === "right" ? 400 + hw : 20 + Math.random() * 350;
    const y = side === "top" ? -14 : side === "bottom" ? d.H + 14 : 70 + Math.random() * (d.H - 140);
    const speed = (DODGE.speed[0] + Math.random() * (DODGE.speed[1] - DODGE.speed[0])) * (word ? 0.8 : 1);
    const ang = Math.atan2(d.heart.y - y, d.heart.x - x);
    d.bullets.push({ x, y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, word: text, hw, kind, r: rad });
  }

  /** 予告つきの波（本編 steam-patterns.js の fan・ring・rain・sweep を縦の場に合わせたもの）。 */
  /** 予告つきの波。第1章（calm）は本編 steam-patterns.js のとおり横なぎだけ: 9本の帯のうち続く3本が通り道。 */
  laneOf(d) { const top = 74, h = (d.H - top - 18) / 9; return { top, h }; }
  spawnWave(d, wave) {
    const { top, h } = this.laneOf(d), dir = wave.side === "left" ? 1 : -1;
    for (let i = 0; i < 9; i++) if (i < wave.open || i > wave.open + 2) d.bullets.push({ kind: "coal", r: 8, x: dir > 0 ? -14 : 404, y: top + h * (i + 0.5), vx: dir * 135, vy: 0 });
    if (d.bullets.length > 90) d.bullets.splice(0, d.bullets.length - 90);
  }

  stepDodge(now, dt) {
    const d = this.dodge;
    if (!d || this.fixed) return;
    const field = this.el.querySelector(".dodge");
    if (!field) return;
    const t = now - d.t0;
    if (!d.over && t >= 0) {
      // 動く: スティック → キー → 指でなぞった所へ
      let vx = 0, vy = 0;
      if (this.stick) ({ x: vx, y: vy } = this.stick);
      for (const k of this.keys) { if (k === "left") vx -= 1; if (k === "right") vx += 1; if (k === "up") vy -= 1; if (k === "down") vy += 1; }
      if (this.dragTo) {
        const dx = this.dragTo.x - d.heart.x, dy = this.dragTo.y - d.heart.y, dist = Math.hypot(dx, dy);
        if (dist > 1.5) { vx = dx / dist * Math.min(1, dist / 18); vy = dy / dist * Math.min(1, dist / 18); }
      }
      const len = Math.hypot(vx, vy);
      if (len > 1) { vx /= len; vy /= len; }
      const sp = (this.st.slow ? DODGE.slow : DODGE.move) * dt;
      d.heart.x = Math.max(12, Math.min(378, d.heart.x + vx * sp));
      d.heart.y = Math.max(70, Math.min(d.H - 16, d.heart.y + vy * sp));
      // 弾と波
      if (t >= d.nextSpawn) { this.spawnBullet(d); d.nextSpawn = t + DODGE.every; }
      if (!d.warn && t >= d.nextWave - DODGE.warn && d.nextWave < DODGE.time - 600) {
        d.warn = { type: "sweep", at: d.nextWave, side: Math.random() < 0.5 ? "left" : "right", open: Math.floor(Math.random() * 7) };
        field.dataset.warn = d.warn.side;
      }
      if (d.warn && t >= d.warn.at) { this.spawnWave(d, d.warn); d.warn = null; field.dataset.warn = ""; d.nextWave += DODGE.wave; }
      for (const b of d.bullets) { b.x += (b.vx || 0) * dt; b.y += (b.vy || 0) * dt; }
      d.bullets = d.bullets.filter((b) => b.x > -200 && b.x < 600 && b.y > -120 && b.y < d.H + 60);
      // 当たるのはハートの芯だけ。当たったら0.9秒は無敵
      if (now >= d.safeUntil) {
        const h = d.heart, c = DODGE.core;
        const hit = d.bullets.find((b) => b.word ? Math.abs(h.x - b.x) < b.hw + c && Math.abs(h.y - b.y) < 6 + c : Math.hypot(h.x - b.x, h.y - b.y) < b.r + c);
        if (hit) {
          d.hits += 1; d.safeUntil = now + DODGE.invuln; d.lastHit = now; d.calmSince = now;
          d.bullets.splice(d.bullets.indexOf(hit), 1);
          this.el.querySelector(".pic")?.animate([{ translate: "0 0" }, { translate: "-0.5rem 0.3rem" }, { translate: "0.4rem -0.2rem" }, { translate: "0 0" }], { duration: 240 });
        }
      }
      field.querySelector(".d-time i").style.transform = `scaleX(${Math.max(0, 1 - t / DODGE.time).toFixed(3)})`;
      if (t >= DODGE.time) this.endDodge();
    }
    // 心の状態（VPL64）: 場の縁の暗がりと、奥の時計・心拍線の色に出す
    const lv = this.mindLevel(now);
    if (field.dataset.level !== lv) { field.dataset.level = lv; field.dataset.mind = String(MIND_LV.indexOf(lv)); }
    const sub = this.el.querySelector(".act-sub.attack");
    if (sub) { const c = Math.max(0, 1 - (now - d.atkAt) / ATTACK.cool); sub.style.setProperty("--cool", c.toFixed(3)); sub.classList.toggle("ready", c <= 0); }
    const btn = this.el.querySelector(".btn-a.bomb");
    if (btn) {
      const cool = Math.max(0, 1 - (now - d.bombAt) / DODGE.bombCool);
      btn.style.setProperty("--cool", cool.toFixed(3));
      btn.classList.toggle("ready", cool <= 0);
      const sec = btn.querySelector(".cool");
      if (sec) sec.textContent = cool > 0 ? String(Math.ceil(cool * DODGE.bombCool / 1000)) : "";
    }
    this.drawDodge(now);
  }

  /** 心の状態（本編 steam-mind.js の式を写したもの）。 */
  mindTension(now) {
    const d = this.dodge;
    const struck = Math.max(0, 1 - (now - d.lastHit) / 4000 + Math.min(0.2, d.hits * 0.025));
    return d.hits ? Math.min(1, struck) : 0;
  }
  mindLevel(now) {
    const d = this.dodge, t = this.mindTension(now);
    return t > 0.65 ? "shaken" : t > 0.25 ? "unsteady" : t < 0.05 && now - Math.max(d.t0, d.calmSince) >= 6000 ? "clear" : "steady";
  }

  drawDodge(now) {
    const size = this.dodgeSize(), d = this.dodge;
    if (!size || !d) return;
    const { ctx, u, field } = size;
    const lv = this.fixed ? "steady" : this.mindLevel(now), mind = MIND_INK[lv], stress = this.fixed ? 0.1 : this.mindTension(now);
    ctx.setTransform(u, 0, 0, u, 0, 0);
    ctx.clearRect(0, 0, 390, d.H);
    // 奥の時計（本編: 場の中央奥に不透明度 .16、色は心の状態）。場の真ん中より少し下（VPL63）
    const cy = d.H * 0.6;
    const left = Math.max(0, Math.ceil((DODGE.time - Math.max(0, now - d.t0)) / 1000));
    const text = `0${Math.floor(left / 60)}${String(left % 60).padStart(2, "0")}`.slice(-3);
    ctx.save(); ctx.globalAlpha = 0.16; ctx.fillStyle = mind;
    const k = 1.25, w = 44 * k, x0 = 195 - (w * 3 + 14) / 2, y0 = cy - 38 * k;
    [...text].forEach((digit, i) => {
      ctx.save(); ctx.translate(x0 + i * w + (i > 0 ? 14 : 0), y0); ctx.scale(k, k);
      for (const seg of SEG7_ON[Number(digit)]) ctx.fill(SEG7_PATH[seg]);
      ctx.restore();
    });
    ctx.beginPath(); ctx.arc(x0 + w + 7, y0 + 26 * k, 3.4, 0, Math.PI * 2); ctx.arc(x0 + w + 7, y0 + 50 * k, 3.4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // 心拍線（VPL64・本編 mental.js）: 時計の高さを横切る脈の線。無心はゆっくり小さく、緊張するほど速く大きく乱れる
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduce && !this.fixed) d.beat += Math.max(0, now - d.beatAt) / 1000 * (lv === "clear" ? 42 : 58 + stress * 62);
    d.beatAt = now;
    const tt = reduce ? 0 : now / 1000;
    ctx.save(); ctx.beginPath();
    for (let x = 0; x <= 390; x += 3) {
      const phase = (x + d.beat) % 104;
      const pulse = -24 * Math.exp(-(((phase - 38) / 3.4) ** 2)) + 12 * Math.exp(-(((phase - 43) / 4.2) ** 2)) - 5 * Math.exp(-(((phase - 28) / 6) ** 2));
      const noise = stress * 6 * Math.sin(x * 0.2 + tt * 21) * Math.sin(x * 0.07 - tt * 13);
      const y = cy + pulse * (lv === "clear" ? 0.4 : 0.5 + stress * 1.4) + noise;
      if (x) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.strokeStyle = mind; ctx.globalAlpha = lv === "shaken" ? 0.42 : 0.3; ctx.lineWidth = lv === "shaken" ? 2.2 : 1.6;
    ctx.shadowColor = mind; ctx.shadowBlur = 6; ctx.stroke(); ctx.restore();
    // 予告: 通り道の帯を点線で（本編 steam-art.js の色）
    if (d.warn) {
      const { top, h } = this.laneOf(d);
      ctx.save(); ctx.setLineDash([3, 7]); ctx.strokeStyle = "rgba(181, 233, 222, 0.6)"; ctx.fillStyle = "rgba(158, 221, 220, 0.06)"; ctx.lineWidth = 1.4;
      ctx.fillRect(0, top + h * d.warn.open, 390, h * 3); ctx.strokeRect(-2, top + h * d.warn.open, 394, h * 3); ctx.restore();
    }
    // 払った時: 閃光、広がる2重の輪、8本の光の筋
    for (const r of d.rings) {
      const t = (now - r.at) / 800;
      if (t > 1) continue;
      const g = ctx.createRadialGradient(r.x, r.y, 0, r.x, r.y, DODGE.bombR);
      g.addColorStop(0, `rgba(230, 248, 255, ${(0.55 * Math.max(0, 1 - t * 3)).toFixed(2)})`); g.addColorStop(1, "rgba(230, 248, 255, 0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(r.x, r.y, DODGE.bombR, 0, Math.PI * 2); ctx.fill();
      for (const [lag, color] of [[0, "168, 230, 255"], [0.12, "255, 243, 214"]]) {
        const q = Math.max(0, t - lag) / (1 - lag), rad = DODGE.bombR * (0.08 + 0.92 * q);
        ctx.beginPath(); ctx.arc(r.x, r.y, rad, 0, Math.PI * 2); ctx.strokeStyle = `rgba(${color}, ${(1 - q).toFixed(2)})`; ctx.lineWidth = 3; ctx.stroke();
      }
      ctx.strokeStyle = `rgba(220, 245, 255, ${(0.8 * (1 - t)).toFixed(2)})`; ctx.lineWidth = 2;
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, r0 = 14 + t * 30, r1 = r0 + 26; ctx.beginPath(); ctx.moveTo(r.x + Math.cos(a) * r0, r.y + Math.sin(a) * r0); ctx.lineTo(r.x + Math.cos(a) * r1, r.y + Math.sin(a) * r1); ctx.stroke(); }
    }
    // 消えた弾は粒に、言葉は上へにじんで消える
    d.bits = (d.bits || []).filter((p) => now - p.at < 600);
    for (const p of d.bits) {
      const t = (now - p.at) / 600;
      ctx.globalAlpha = 1 - t;
      if (p.word) { ctx.font = `700 14px "Craft Mincho", ${getComputedStyle(field).getPropertyValue("--mincho") || "serif"}`; ctx.fillStyle = "#f5e8ee"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(p.word, p.x, p.y - t * 22); }
      else { ctx.fillStyle = "#e8dcff"; for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + p.seed; ctx.beginPath(); ctx.arc(p.x + Math.cos(a) * t * 18, p.y + Math.sin(a) * t * 18, 1.8, 0, Math.PI * 2); ctx.fill(); } }
    }
    const fade = d.over ? Math.max(0, 1 - (now - d.endAt) / 500) : 1;
    ctx.globalAlpha = fade;
    // 言葉の弾（本編 steam.css: Craft Mincho・字間・淡い帯・光・下の細い線）
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.font = `700 14px "Craft Mincho", ${getComputedStyle(field).getPropertyValue("--mincho") || "serif"}`;
    if ("letterSpacing" in ctx) ctx.letterSpacing = "1px";
    for (const b of d.bullets) {
      if (b.word) {
        const w = ctx.measureText(b.word).width + 18;
        const band = ctx.createLinearGradient(b.x - w / 2, 0, b.x + w / 2, 0);
        band.addColorStop(0, "rgba(48, 32, 57, 0)"); band.addColorStop(0.18, "rgba(48, 32, 57, 0.67)"); band.addColorStop(0.82, "rgba(48, 32, 57, 0.67)"); band.addColorStop(1, "rgba(48, 32, 57, 0)");
        ctx.fillStyle = band; ctx.fillRect(b.x - w / 2, b.y - 11, w, 22);
        ctx.fillStyle = "rgba(215, 166, 210, 0.45)"; ctx.fillRect(b.x - w / 2 + 8, b.y + 10, w - 16, 1);
        ctx.shadowColor = "rgba(215, 166, 210, 0.6)"; ctx.shadowBlur = 6; ctx.fillStyle = "#f5e8ee"; ctx.fillText(b.word, b.x, b.y + 0.5); ctx.shadowBlur = 0;
      } else {
        const im = BULLET_IMG[b.kind], s2 = b.kind === "smoke" ? 26 : 22;
        if (im?.complete) ctx.drawImage(im, b.x - s2 / 2, b.y - s2 / 2, s2, s2);
      }
    }
    if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
    ctx.globalAlpha = 1;
    // 心: 水色・白い縁。当たった直後は桃色で点滅。当たるのは真ん中の白い丸だけ
    const h = d.heart, hurt = now < d.safeUntil;
    if (HEART && !(hurt && Math.floor(now / 90) % 2)) {
      ctx.save(); ctx.translate(h.x - 14 * 0.86, h.y - 14 * 0.86); ctx.scale(0.86, 0.86);
      ctx.shadowColor = hurt ? "#ef8795" : "#70d7ed"; ctx.shadowBlur = 10;
      ctx.fillStyle = hurt ? "#ef8795" : "#70d7ed"; ctx.fill(HEART);
      ctx.shadowBlur = 0; ctx.strokeStyle = "#eefaff"; ctx.lineWidth = 1.6; ctx.stroke(HEART); ctx.restore();
    }
    ctx.fillStyle = "#ffffff"; ctx.shadowColor = "#ffffff"; ctx.shadowBlur = 4;
    ctx.beginPath(); ctx.arc(h.x, h.y - 2, DODGE.core, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
    // リフレッシュが使える間は、届く範囲を心の周りに薄い点線の輪で見せる（何が起きるボタンかを場で伝える・VPL62）
    if (!d.over && now - d.bombAt >= DODGE.bombCool) {
      ctx.save(); ctx.setLineDash([4, 8]); ctx.lineDashOffset = -now / 60; ctx.strokeStyle = "rgba(168, 230, 255, 0.3)"; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(h.x, h.y, DODGE.bombR, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
    // アタックの斬撃: 上前方の扇
    for (const sl of d.slashes) {
      const q = (now - sl.at) / 260;
      if (q > 1) continue;
      ctx.save(); ctx.globalAlpha = 1 - q; ctx.strokeStyle = "#fff3d6"; ctx.shadowColor = "#ffcf6b"; ctx.shadowBlur = 12; ctx.lineWidth = 5 * (1 - q) + 1;
      ctx.beginPath(); ctx.arc(sl.x, sl.y, ATTACK.reach * (0.55 + 0.45 * q), -Math.PI / 2 - ATTACK.half, -Math.PI / 2 + ATTACK.half); ctx.stroke(); ctx.restore();
    }
  }

  /** 精密（遅く細かく動く）を切り替える。 */
  toggleSlow() {
    const { st } = this;
    st.slow = !st.slow;
    const b = this.el.querySelector(".act-sub.slow");
    if (b) { b.classList.toggle("on", st.slow); b.setAttribute("aria-pressed", String(st.slow)); }
  }

  /** アタック（VPL62）: 上前方の扇の中の弾を斬る。斬った言葉の数だけ心が落ち着く。待ちは1.8秒。 */
  attack() {
    const d = this.dodge, now = performance.now();
    if (!this.attackLearned || !d || d.over || this.fixed || now < d.t0 || now - d.atkAt < ATTACK.cool) return;
    d.atkAt = now;
    d.slashes.push({ x: d.heart.x, y: d.heart.y, at: now });
    d.bits = d.bits || [];
    let words = 0;
    d.bullets = d.bullets.filter((b) => {
      const dx = b.x - d.heart.x, dy = b.y - d.heart.y, dist = Math.hypot(dx, dy) - (b.word ? b.hw * 0.5 : 0);
      const ang = Math.abs(Math.atan2(dx, -dy));
      const cut = dist <= ATTACK.reach && ang <= ATTACK.half && dy < 8;
      if (cut) { d.bits.push({ x: b.x, y: b.y, word: b.word, at: now, seed: Math.random() * 6 }); if (b.word) words += 1; }
      return !cut;
    });
    if (words) { d.lastHit -= words * ATTACK.calm; d.calmSince -= words * ATTACK.calm; }
  }

  /** 雑念を払う（本編のリフレッシュ）: 周りの雑念を消す。使ったあと8秒で戻る。 */
  bomb() {
    const d = this.dodge, now = performance.now();
    if (!d || d.over || this.fixed || now < d.t0) return;
    if (now - d.bombAt < DODGE.bombCool) {
      const btn = this.el.querySelector(".btn-a.bomb");
      btn?.classList.remove("res-off"); void btn?.offsetWidth; btn?.classList.add("res-off");
      return;
    }
    d.bombAt = now;
    d.rings.push({ x: d.heart.x, y: d.heart.y, at: now });
    d.bits = d.bits || [];
    d.bullets = d.bullets.filter((b) => {
      const gone = Math.hypot(b.x - d.heart.x, b.y - d.heart.y) <= DODGE.bombR;
      if (gone) d.bits.push({ x: b.x, y: b.y, word: b.word, at: now, seed: Math.random() * 6 });
      return !gone;
    });
  }

  /** 時間切れ: 判子を出し、工程が済んだのでランクが上がり、吸い出しへ。 */
  endDodge() {
    const d = this.dodge;
    if (!d || d.over) return;
    d.over = true; d.endAt = performance.now();
    const field = this.el.querySelector(".dodge");
    if (field) field.dataset.warn = "";
    const stamp = field?.querySelector(".d-stamp");
    if (stamp) {
      stamp.textContent = d.hits === 0 ? "無心" : d.hits <= 2 ? "持ちこたえた" : "雑念まみれ";
      stamp.dataset.kind = d.hits === 0 ? "good" : d.hits <= 2 ? "ok" : "bad";
      stamp.hidden = false;
    }
    this.st.gradeP = 1; this.syncRank();
    setTimeout(() => this.rankUp(), 1000);
    setTimeout(() => { if (this.st.scene === "steam") this.setScene("pull"); }, 4100);
  }

  /** 十字キーをスティックとして使う: 押した所の向きと、真ん中からの距離で動く。 */
  setStick(event) {
    const pad = this.stickEl;
    if (!pad) return;
    const box = pad.getBoundingClientRect(), r = box.width / 2;
    let x = (event.clientX - box.left - r) / r, y = (event.clientY - box.top - r) / r;
    const len = Math.hypot(x, y);
    if (len < 0.16) { x = 0; y = 0; } else { const k = Math.min(1, (len - 0.16) / 0.6) / len; x *= k; y *= k; }
    this.stick = { x, y };
    pad.style.setProperty("--sx", x.toFixed(2)); pad.style.setProperty("--sy", y.toFixed(2));
  }

  /** 雑念の場を指でなぞる: その場所へハートが向かう。 */
  setDragTo(event) {
    const field = this.el.querySelector(".dodge"), d = this.dodge;
    if (!field || !d) return;
    const box = field.getBoundingClientRect(), k = 390 / box.width;
    this.dragTo = { x: (event.clientX - box.left) * k, y: (event.clientY - box.top) * k - 26 };
  }

  /* ── 炭焼き（VPL54・VPL55）: 下のコンロの炭が黒から赤へ焼けていく。全面が赤くなった「取り頃」でタッチして取り出す ── */
  coalPic() {
    return `<img class="bg" src="${IMG[this.venue]}" alt=""><div class="coal-up"><i class="heat-glow"></i><div class="coal-hero"><img src="${IMG.coalHajime}" alt=""><div class="slots"></div></div><div class="judges"></div></div>`;
  }

  startCoals() {
    const now = performance.now(), readies = [];
    while (readies.length < HEAT.count) {
      const r = HEAT.ready[0] + Math.random() * (HEAT.ready[1] - HEAT.ready[0]);
      if (readies.every((x) => Math.abs(x - r) >= HEAT.gap)) readies.push(r);
    }
    this.heat = { t0: now + HEAT.lead, coals: readies.map((ready) => ({ ready, taken: false, blinked: false })), done: false };
    if (this.fixed) {
      // 一覧は途中の一コマ: 1個は取った後、1個は取り頃、1個はまだ黒い面が残る
      const h = this.heat;
      h.t0 = now - 4000; h.coals = [{ ready: 3000, taken: true, judge: heatJudge(1.05, 0.15) }, { ready: 4000, taken: false }, { ready: 7000, taken: false }];
      this.placeTaken(0, h.coals[0].judge, false);
      const first = this.el.querySelector('.coal[data-i="0"]'); if (first) first.style.visibility = "hidden";
      this.stepCoals(now);
    }
  }

  stepCoals(now) {
    const h = this.heat;
    if (!h) return;
    const t = this.fixed ? 4000 : now - h.t0; // 一覧の見本は途中の一コマで止める
    this.el.querySelector(".stove")?.classList.toggle("on", t >= 0);
    this.el.querySelector(".coal-up")?.classList.toggle("on", t >= 0);
    h.coals.forEach((c, i) => {
      const btn = this.el.querySelector(`.coal[data-i="${i}"]`);
      if (!btn || c.taken) return;
      const p = Math.max(0, t / c.ready), jw = HEAT.just / c.ready;
      // 焼け色: 黒い面から赤へ（取り頃で全面が赤い）、過ぎると灰をまとう
      btn.style.setProperty("--red", Math.min(1, 0.08 + p * 0.92).toFixed(3));
      btn.style.setProperty("--ash", Math.max(0, Math.min(1, (p - 1 - jw) / 0.55)).toFixed(3));
      if (!c.blinked && t >= c.ready - HEAT.blink) { c.blinked = true; btn.classList.remove("blink"); void btn.offsetWidth; btn.classList.add("blink"); }
      if (!this.fixed && p >= HEAT.drop) { c.taken = true; c.judge = ["over", 14, "MISS"]; btn.classList.add("dropped"); this.placeTaken(i, c.judge, true); this.checkCoalsDone(); }
    });
  }

  takeCoal(i) {
    const h = this.heat;
    if (!h || this.fixed) return;
    const c = h.coals[i], t = performance.now() - h.t0;
    if (!c || c.taken || t < 0) return;
    c.taken = true;
    c.judge = heatJudge(t / c.ready, HEAT.just / c.ready);
    const btn = this.el.querySelector(`.coal[data-i="${i}"]`);
    btn?.classList.add("taken");
    this.placeTaken(i, c.judge, false);
    this.st.gradeP = h.coals.filter((x) => x.taken).length / h.coals.length; this.syncRank();
    this.checkCoalsDone();
  }

  /** 取った炭を上の画面へ: はじめが持つ炭壺の中へ並ぶ。判定の札も出す。 */
  placeTaken(i, judge, dropped) {
    const up = this.el.querySelector(".coal-up");
    if (!up) return;
    const [kind, , label] = judge;
    if (!dropped) {
      const slots = up.querySelector(".slots"), [x, y] = POT_SLOTS[slots.children.length] || POT_SLOTS[2];
      const el = document.createElement("span");
      el.className = "slot"; el.style.left = `${x * 100}%`; el.style.top = `${y * 100}%`;
      el.innerHTML = `<span class="tcoal ${kind}"><img src="${IMG.coalCold}" alt=""><img class="lit" src="${IMG.coalLit}" alt=""></span>`;
      slots.append(el);
    }
    const tag = document.createElement("b");
    tag.className = `jtag ${label.toLowerCase()}`; tag.textContent = dropped ? "MISS" : label;
    up.querySelector(".judges").append(tag);
    if (!this.fixed) setTimeout(() => tag.classList.add("out"), 1200);
  }

  checkCoalsDone() {
    const h = this.heat;
    if (!h || h.done || !h.coals.every((c) => c.taken)) return;
    h.done = true;
    this.st.gradeP = 1; this.syncRank();
    const score = Math.round(h.coals.reduce((n, c) => n + c.judge[1], 0) / h.coals.length);
    this.say(score >= 90 ? "火が素直だ。いい焼け具合" : score >= 70 ? "まあまあだ。次は色をよく見ろ" : "早すぎか遅すぎだ。全面の赤を待て");
    setTimeout(() => this.rankUp(), 700);
    setTimeout(() => { if (this.st.scene === "coal") this.setScene("steam"); }, 3600);
  }

  /** 熱ゲージ（温度帯）。シーシャ作りの間ずっと右に大きく出す。色の意味は本編と同じ（緑＝適温の目安、虹＝合わせやすい範囲、炎＝焦げる）。 */
  thermoHtml(fade = "") {
    const t = this.st.temp, pc = (v) => `${(v * 100).toFixed(1)}%`;
    return `<div class="thermo ${tempState(t)} ${fade}" style="--t:${t}" role="meter" aria-label="煙の温度" aria-valuemin="0" aria-valuemax="1" aria-valuenow="${t.toFixed(2)}">
      <span class="th-icon">${icon("thermo")}</span>
      <span class="th-tube"><span class="th-bar" style="background:${SCALE}">
        <i class="th-zone" style="bottom:${pc(TEMP_ZONE[0])};height:${pc(TEMP_ZONE[1] - TEMP_ZONE[0])}"></i>
        <i class="th-best" style="bottom:${pc(TEMP_BEST[0])};height:${pc(TEMP_BEST[1] - TEMP_BEST[0])}"></i>
        <i class="th-danger" style="bottom:${pc(TEMP_DANGER)}">${icon("coal")}</i>
        <i class="th-dim"></i>
        <i class="th-now"></i>
      </span><i class="th-pointer"></i></span></div>`;
  }

  /** スミさんの一言は小さな吹き出しで出し、少しすると顔だけになる（顔を押すとまた出る）。 */
  craftTelopHtml() {
    const { st } = this;
    let cards = st.scene === "pack" ? `<div class="cards">${PACKS.map((p, i) => `<button class="card${p.locked ? " locked" : ""}" data-act="pack" data-pack="${i}" aria-current="${i === st.pack}">
      <img src="${IMG[`bowl_${p.id}`]}" alt=""><b>${p.name}</b><span class="dens">${[1, 2, 3].map((n) => `<i class="${n <= p.dens ? "on" : ""}"></i>`).join("")}</span>${p.locked ? icon("lock") : ""}</button>`).join("")}</div>` : "";
    return `<button class="coach" data-act="coach" aria-label="スミさんの一言"><img src="${IMG.faceSumi}" alt=""><span class="say"><span class="say-text">${esc(COACH[st.scene])}</span></span></button>${cards}`;
  }

  craftCtrlHtml() {
    const { st } = this;
    if (st.scene === "water") {
      // 真ん中の大きな「注ぐ」と左の「こぼす」は押している間だけ水が動く。右の「決定」で、この水量で進む
      return `<button class="btn-a sub l" data-act="drain" data-hold="drain" aria-label="${BTN.drain.label}">${btnFace("drain")}</button>
        ${aHtml("pour", { cls: "center pour" })}
        <button class="btn-a sub r" data-act="decide" aria-label="決定"${st.water > 0 ? "" : " disabled"}><span class="t">決定</span></button>`;
    }
    if (st.scene === "mix") {
      // 十字キーは出さず、下の画面にフレーバーの一覧（案A・B は横、案C は縦にスライド）。各札の −／＋ で1gずつ。合わせて12gで課題を満たすと「決定」（VPL52）
      return `${this.mixCardsHtml()}<div class="mixfoot"><div class="mixbar" aria-hidden="true"><span class="slots"></span><b class="mixsum"></b></div></div>${aHtml("ok", { cls: "mix-ok", disabled: !this.mixOk() })}`;
    }
    if (st.scene === "coal") {
      // 下の画面はコンロ。炭を直接タッチして取り出す（VPL55）
      return `<div class="stove"><img src="${IMG.stove}" alt="">${COAL_AT.map(([x, y], i) => `<button class="coal" data-act="coal" data-i="${i}" style="left:${x * 100}%;top:${y * 100}%" aria-label="炭 ${i + 1}"><img class="c-cold" src="${IMG.coalCold}" alt=""><img class="c-lit" src="${IMG.coalLit}" alt=""><i class="c-ash"></i></button>`).join("")}</div>`;
    }
    if (st.scene === "steam") {
      // 十字キーはスティック（押した向きと強さで動く）。右下の大きな丸がリフレッシュ、その左上が精密（アタックを覚えたら切り替えで入れ替わる）（VPL62）
      const sub = this.attackLearned && st.sub === "attack" ? "attack" : "slow";
      const subBtn = `<button class="act-sub ${sub}${sub === "slow" && st.slow ? " on" : ""}" data-act="sub" aria-label="${sub === "slow" ? "精密に動く" : "アタック"}"${sub === "slow" ? ` aria-pressed="${st.slow}"` : ""}>${TOOL_SVG[sub]}<small>${sub === "slow" ? "精密" : "アタック"}</small><i class="cool"></i></button>`;
      const swap = this.attackLearned ? `<button class="act-swap" data-act="swap" aria-label="精密とアタックを入れ替える"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 9h12l-3.5-3.5M19 15H7l3.5 3.5"/></svg></button>` : "";
      return `${dpadHtml("up down left right")}${subBtn}${swap}${aHtml("bomb", { cls: "bomb", extra: `<small class="act-label">リフレッシュ</small><i class="cool"></i>` })}`;
    }
    if (st.scene === "pack") {
      return `${dpadHtml("left right")}${aHtml("ok", { disabled: !!PACKS[st.pack].locked })}`;
    }
    if (st.scene === "holes") {
      // 「刺す」を真ん中に大きく置く。押すと色が下から上へ満ち、満ちた瞬間に金に光る（ここで離す）。周りの10個の点＝開けた穴（金＝ちょうどいい）
      const pips = Array.from({ length: HOLE_COUNT }, (_, i) => {
        const a = (i * 360 / HOLE_COUNT - 90) * Math.PI / 180, hole = st.holes[i];
        return `<circle class="pip${hole ? (hole.good ? " good" : " done") : ""}" cx="${(46 * Math.cos(a)).toFixed(1)}" cy="${(46 * Math.sin(a)).toFixed(1)}" r="2.6"/>`;
      }).join("");
      return `<svg class="hole-pips" viewBox="-50 -50 100 100" aria-label="開けた穴 ${st.holes.length}/${HOLE_COUNT}">${pips}</svg>
        ${aHtml("poke", { cls: "hold center", extra: `<i class="fill"></i><i class="fill-line"></i>` })}`;
    }
    // 葉（フレーバーの持ち）は上の段の真ん中、吸った回数は「吸う」の中の点。ボタンに重ねない
    return `<span class="leaves" role="img" aria-label="フレーバーの持ち 5">${`<img src="${IMG.leaf}" alt="">`.repeat(5)}</span>
      <button class="serve" data-act="serve" aria-label="提供する（あと2口）">${icon("bell")}<span>提供</span><i></i><i></i></button>
      <div class="gauge"><span class="end l">${icon("cool")}</span><span class="end r">${icon("heat")}</span>${meterHtml()}</div>
      ${aHtml("puff", { cls: "center", extra: `<span class="pips" aria-label="吸った回数 ${st.pulls}/5">${Array.from({ length: 5 }, (_, i) => `<i class="${i < st.pulls ? "on" : ""}"></i>`).join("")}</span>` })}`;
  }

  /** 穴あけ: 目印（ひし形）・開けた穴・針先（水色の輪）を描く。 */
  drawHoles() {
    const svg = this.el.querySelector(".foil-marks");
    if (!svg) return;
    const at = (deg, r = 62) => [r * Math.cos((deg - 90) * Math.PI / 180), r * Math.sin((deg - 90) * Math.PI / 180)];
    const step = 360 / HOLE_COUNT, next = this.st.holes.length;
    const marks = Array.from({ length: HOLE_COUNT }, (_, i) => {
      const [x, y] = at(i * step);
      if (i < next) return "";
      return i === next ? `<g class="target" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><rect x="-6.2" y="-6.2" width="12.4" height="12.4" transform="rotate(45)"/><circle class="ideal" r="${HOLE_R.small}"/></g>`
        : `<circle class="todo" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.3"/>`;
    }).join("");
    const holes = this.st.holes.map((hole) => { const [x, y] = at(hole.deg); return `<circle class="hole${hole.good ? " good" : ""}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${hole.r.toFixed(1)}"/>`; }).join("");
    svg.innerHTML = `${holes}${marks}<circle class="grow-hole" r="0"/><circle class="tip" r="5.2"/>`;
  }

  /* ── 入力 ── */

  onClick(event) {
    const hit = event.target.closest("[data-act]");
    if (this.dragged) { this.dragged = false; return; }
    if (!hit || !this.el.contains(hit)) {
      if (this.st.scene === "cutin" && (event.target.closest(".cv") || event.target.closest('[data-slot="telop"]'))) { this.pressA(); return; }
      if (this.talk && event.target.closest('[data-slot="telop"]')) this.pressA();
      return;
    }
    const act = hit.dataset.act, { st } = this;
    if (act === "dir") this.move(hit.dataset.dir);
    else if (act === "spot") this.select(Number(hit.dataset.spot), { keepList: false });
    else if (act === "spot-go") this.select(Number(hit.dataset.spot));
    else if (act === "overview") this.toggleOverview();
    else if (act === "list") { st.list = !st.list; this.patch(); }
    else if (act === "pick") { const same = st.pick === Number(hit.dataset.pick); st.pick = Number(hit.dataset.pick); this.applyLine({ instant: true }); if (same) this.pressA(); }
    else if (act === "pack") { st.pack = Number(hit.dataset.pack); this.patch(); }
    else if (act === "decide") this.decideWater();
    else if (act === "coal") this.takeCoal(Number(hit.dataset.i));
    else if (act === "sub") { if (hit.classList.contains("attack")) this.attack(); else this.toggleSlow(); }
    else if (act === "swap") { st.sub = st.sub === "attack" ? "slow" : "attack"; if (st.sub === "attack") st.slow = false; this.patch(); }
    else if (act === "mixsel") { st.mixSel = Number(hit.dataset.i); this.syncMix(); }
    else if (act === "mixadd") { st.mixSel = Number(hit.dataset.i); this.addMix(Number(hit.dataset.by)); }
    else if (act === "more") {
      this.moreOpen = !this.moreOpen;
      hit.classList.toggle("on", this.moreOpen); hit.setAttribute("aria-expanded", String(this.moreOpen));
      this.el.querySelector(".more")?.classList.toggle("open", this.moreOpen);
    }
    else if (act === "coach") { this.quiet = !this.quiet; hit.classList.toggle("quiet", this.quiet); }
    else if (act === "a") { if (st.scene !== "holes") this.pressA(); }
    else if (act === "serve") { if (!this.fixed) this.setScene("map"); }
    else if (act === "fn") {
      const id = hit.dataset.fn;
      if (id === "slow") this.toggleSlow();
      else if (id === "list") { st.list = !st.list; this.patch(); }
      else if (id === "next") { // 「！」の付いた店を順に回る
        const marks = ORDER.filter((i) => SPOTS[i].mark), after = marks.find((i) => ORDER.indexOf(i) > ORDER.indexOf(st.sel));
        this.select(after ?? marks[0]);
      } else if (id === "wide") this.toggleOverview();
      else if (id === "terms" || id === "config" || id === "help" || id === "menu" || id === "lime") this.toast("この試作では開きません");
      else if (id === "auto" || id === "skip") { st[id] = !st[id]; hit.classList.toggle("on", st[id]); }
    }
  }

  onDown(event) {
    const { st } = this;
    if (st.scene === "water") {
      const btn = event.target.closest('.btn-a.pour, [data-hold="drain"]');
      if (btn && !this.deciding) { btn.setPointerCapture?.(event.pointerId); if (btn.dataset.hold === "drain") this.draining = true; else this.pouring = true; this.syncWater(); return; }
    }
    if (st.scene === "steam" && this.dodge) {
      const pad = event.target.closest(".dpad");
      if (pad) { this.stickEl = pad; pad.setPointerCapture?.(event.pointerId); this.setStick(event); return; }
      const field = event.target.closest(".dodge");
      if (field) { this.dragId = event.pointerId; field.setPointerCapture?.(event.pointerId); this.setDragTo(event); return; }
    }
    if (st.scene === "holes" && event.target.closest('.btn-a[data-act="a"]')) { event.target.closest(".btn-a").setPointerCapture?.(event.pointerId); this.startHold(); return; }
    const map = event.target.closest("[data-map]");
    if (map && !st.overview && this.view) { this.drag = { id: event.pointerId, x: event.clientX, y: event.clientY, ox: this.view.x, oy: this.view.y, moved: false }; return; }
    const card = event.target.closest("[data-swipe]");
    if (card) this.swipe = { x: event.clientX };
  }

  onMove(event) {
    if (this.stickEl) { this.setStick(event); return; }
    if (this.dragTo && event.pointerId === this.dragId) { this.setDragTo(event); return; }
    const drag = this.drag;
    if (!drag || drag.id !== event.pointerId) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 8) return;
    drag.moved = true;
    this.cam = { x: drag.ox + dx, y: drag.oy + dy };
    this.camera(false);
  }

  onUp(event) {
    if (this.holdAt) { this.endHold(); return; }
    if (this.pouring || this.draining) { this.pouring = this.draining = false; this.syncWater(); return; }
    if (this.stickEl) { this.stickEl.style.removeProperty("--sx"); this.stickEl.style.removeProperty("--sy"); this.stickEl = null; this.stick = null; return; }
    if (this.dragTo) { this.dragTo = null; return; }
    if (this.drag) { this.dragged = this.drag.moved; this.drag = null; if (this.dragged) setTimeout(() => { this.dragged = false; }, 0); return; }
    if (this.swipe) {
      const dx = event.clientX - this.swipe.x; this.swipe = null;
      if (Math.abs(dx) > 36) { this.dragged = true; setTimeout(() => { this.dragged = false; }, 0); this.select(stepSpot(this.st.sel, dx < 0 ? 1 : -1)); }
    }
  }

  move(dir) {
    const { st } = this, line = this.line;
    if (st.scene === "map") {
      if (st.list) { if (dir === "up" || dir === "down") this.select(stepSpot(st.sel, dir === "down" ? 1 : -1), { keepList: true }); return; }
      // 左右で隣の店へ順に送る（地図の左から右の順。端まで行くと反対の端へ）。上は全体／寄る、下は一覧。
      if (dir === "left" || dir === "right") this.select(stepSpot(st.sel, dir === "right" ? 1 : -1), { keepView: true });
      else if (dir === "up") this.toggleOverview();
      else { st.list = true; this.patch(); }
    } else if (this.talk && st.choosing && line.choice && (dir === "up" || dir === "down")) {
      st.pick = (st.pick + (dir === "down" ? 1 : line.choice.length - 1)) % line.choice.length; this.applyLine({ instant: true });
    } else if (st.scene === "pack" && (dir === "left" || dir === "right")) {
      st.pack = (st.pack + (dir === "right" ? 1 : PACKS.length - 1)) % PACKS.length; this.patch();
    } else if (st.scene === "mix") {
      // キーボード: 上下で葉を選び、左右で1gずつ（画面では各行の −／＋）
      if (dir === "up" || dir === "down") { st.mixSel = (st.mixSel + (dir === "down" ? 1 : MIX.length - 1)) % MIX.length; this.syncMix(); this.el.querySelector(`.picker [data-i="${st.mixSel}"]`)?.scrollIntoView({ block: "nearest" }); }
      else this.addMix(dir === "right" ? 1 : -1);
    }
  }

  pressA() {
    const { st, el } = this;
    if (st.scene === "cutin") {
      if (st.ciPhase === "on") this.endCutin();
      else if (this.typedAt && performance.now() < this.typedAt) { this.typedAt = 0; el.classList.remove("typing"); el.querySelector(".type")?.classList.add("all"); }
      else if (!this.nextPage()) this.playCutin();
      return;
    }
    if (st.scene === "map") {
      if (st.list) { st.list = false; this.patch(); return; }
      if (SPOTS[st.sel].closed || this.fixed) return;
      const scene = { tonari: "tonari", minto: "minto" }[SPOTS[st.sel].id];
      if (scene) this.enterShop(scene); else this.toast("この試作では入れません");
      return;
    }
    if (st.scene === "water") return; // 注ぐ・こぼすは押している間だけ。進むのは「決定」
    if (st.scene === "mix") { this.decideMix(); return; }
    if (st.scene === "steam") { this.bomb(); return; }
    if (this.talk) {
      const line = this.line;
      if (this.typedAt && performance.now() < this.typedAt) { // 文字送りの途中なら全文を出す
        this.typedAt = 0; el.classList.remove("typing"); el.querySelector(".type")?.classList.add("all"); return;
      }
      if (!st.choosing && this.nextPage()) return;
      if (line.choice && !st.choosing) { st.choosing = true; st.pick = 0; this.applyLine({ instant: true }); return; }
      st.choosing = false;
      if (st.step + 1 < this.talk.steps.length) { st.step += 1; this.applyLine(); }
      else if (this.fixed) { st.step = 0; this.render(); }
      else this.setScene(st.scene === "minto" ? "tonari" : "water");
      return;
    }
    if (st.scene === "pack") { if (!PACKS[st.pack].locked && !this.fixed) this.setScene("holes"); return; }
    if (st.scene === "pull") {
      if (this.hold || st.pulls >= 5) return;
      st.pulls = Math.min(5, st.pulls + 1);
      st.gradeP = st.pulls / 5; this.syncRank();
      if (st.pulls >= 5) setTimeout(() => this.rankUp(), 500);
      // 吸うたびに温度が動く（上げ吸いで上がり、下げ吸いで下がる）
      st.temp = Math.min(0.95, Math.max(0.06, st.temp + 0.05 + ((this.needleT ?? 0.5) - 0.5) * 0.32));
      this.hold = performance.now();
      el.classList.remove("puffing"); void el.offsetWidth; el.classList.add("puffing");
      this.patch();
      this.syncThermo();
      setTimeout(() => { this.hold = 0; if (st.pulls >= 5 && this.fixed) { st.pulls = 0; st.temp = 0.4; st.gradeP = 0; this.patch(); this.syncThermo(); this.syncRank(); } }, 700);
      if (st.pulls >= 5 && !this.fixed) setTimeout(() => this.setScene("map"), 3300);
    }
  }

  /** 熱ゲージの針と、適温の帯に入った時の光を今の温度に合わせる（作り直さずに動かす）。 */
  syncThermo() {
    const thermo = this.el.querySelector(".thermo"), t = this.st.temp;
    if (!thermo) return;
    thermo.style.setProperty("--t", String(t));
    thermo.setAttribute("aria-valuenow", t.toFixed(2));
    thermo.className = `thermo ${tempState(t)}`;
  }

  /** シーシャ作り: スミさんの一言は3秒ほどで畳み、手元の操作だけを残す（一覧では出したまま）。 */
  hushCoach() {
    clearTimeout(this.coachTimer);
    if (this.fixed || this.talk || this.st.scene === "map") return;
    const scene = this.st.scene;
    this.coachTimer = setTimeout(() => { if (this.st.scene === scene) { this.quiet = true; this.el.querySelector(".coach")?.classList.add("quiet"); } }, 3400);
  }

  toast(text) {
    this.el.querySelector(".toast")?.remove();
    const note = document.createElement("div");
    note.className = "toast"; note.textContent = text;
    this.el.append(note);
    setTimeout(() => note.remove(), 2200);
  }

  /** 穴あけ: 押し始め。ボタンが沈み始め、縁の輪が伸び始める */
  startHold() {
    if (this.st.scene !== "holes" || this.holdAt || this.st.holes.length >= HOLE_COUNT) return;
    this.holdAt = performance.now();
    this.el.querySelector(".btn-a.hold")?.style.setProperty("--level", "0");
    this.el.querySelector(".btn-a.hold")?.classList.add("pressing");
  }

  /** 穴あけ: 離した。押していた長さで穴を開ける */
  endHold() {
    if (!this.holdAt) return;
    const held = performance.now() - this.holdAt;
    this.holdAt = 0;
    this.punch(held);
  }

  /** 穴あけ: 押していた長さで穴の大きさ、針先の位置で当たりを決める。 */
  punch(heldMs) {
    const { st } = this;
    if (st.scene !== "holes" || st.holes.length >= HOLE_COUNT) return;
    const target = st.holes.length * 360 / HOLE_COUNT;
    const size = Math.min(1, heldMs / HOLD_FULL), zone = pressZone(size);
    const good = Math.abs((this.tipDeg ?? target) - target) < 5 && zone === "good";
    st.holes.push({ deg: this.tipDeg ?? target, r: HOLE_R[holeDepth(size)], size, good });
    st.gradeP = Math.min(1, st.holes.length / HOLE_COUNT); this.syncRank();
    this.patch(); this.drawHoles();
    // 結果を「刺す」に返す: ちょうどいい大きさなら金の光、小さすぎ・大きすぎは小さく揺れる
    const btn = this.el.querySelector(".btn-a.hold");
    btn?.classList.add(zone === "good" ? "res-good" : "res-off");
    setTimeout(() => btn?.classList.remove("res-good", "res-off"), 520);
    // 10個開け終えたら穴あけの工程が済み、ランクが1段上がる。大きく出たランクが収まってから次の工程へ
    if (st.holes.length >= HOLE_COUNT) setTimeout(() => this.rankUp(), 500);
    if (st.holes.length >= HOLE_COUNT) setTimeout(() => { if (this.fixed) { st.holes = []; st.gradeP = 0; this.patch(); this.drawHoles(); this.syncRank(); } else this.setScene("coal"); }, 3300);
  }

  /** 地図から店へ: 選んだ店へ寄ってから、煙の幕で店内へ替える。 */
  enterShop(scene) {
    const { el } = this;
    const pan = el.querySelector(".map-pan");
    if (pan && this.view) {
      const { w, h, mw, mh } = this.view, spot = SPOTS[this.st.sel], s = 1.7;
      pan.style.transform = `translate(${w / 2 - mw * s * spot.x / 100}px, ${h * 0.4 - mh * s * spot.y / 100}px) scale(${s})`;
    }
    el.classList.add("leaving");
    setTimeout(() => { el.classList.remove("leaving"); this.setScene(scene, { arrive: true }); }, 620);
  }

  setScene(scene, { arrive = false } = {}) {
    clearTimeout(this.ciTimer);
    this.el.classList.remove("cutin-on");
    const crafting = (id) => CRAFT_SCENES.includes(id);
    if (!crafting(this.st.scene) && crafting(scene)) Object.assign(this.st, { grade: 0, gradeP: 0 });
    else if (crafting(scene)) this.st.gradeP = 0;
    Object.assign(this.st, { water: 0, mix: MIX.map(() => 0), mixSel: 0 });
    // 前の場面で温度ゲージが出ていたか（出ていた→消える場面ならふっと消し、出ていなかった→出る場面ならふっと出す）
    this.thermoWas = crafting(this.st.scene) ? THERMO_ON.has(this.st.scene) : undefined;
    Object.assign(this, { dodge: null, heat: null, pouring: false, draining: false, deciding: false, coachSay: null, stick: null, dragTo: null });
    this.keys.clear();
    Object.assign(this.st, { scene, step: 0, page: 0, choosing: false, pick: 0, list: false, overview: false, holes: [], pulls: 0, pack: 1, temp: 0.4 });
    this.quiet = false;
    this.render({ delay: arrive ? 1200 : 0 }); // 店に着いた時は、店名の札が出てから文字を送る
    this.hushCoach();
    if (arrive) { this.el.classList.add("arriving"); setTimeout(() => this.el.classList.remove("arriving"), 1500); }
    this.onScene?.(scene);
  }

  tick(now) {
    if (this.dead) return;
    const { st, el } = this;
    const dt = Math.min(0.05, (now - (this.lastT ?? now)) / 1000);
    this.lastT = now;
    // 水入れ: 押している間だけ水が動く（注ぐ 0.18/秒・こぼす 0.03/秒）
    if (st.scene === "water" && !this.deciding && (this.pouring || this.draining)) {
      st.water = Math.max(0, Math.min(1, st.water + ((this.pouring ? WATER.pour : 0) - (this.draining ? WATER.drain : 0)) * dt));
      this.syncWater();
    }
    if (st.scene === "steam") this.stepDodge(now, dt);
    if (st.scene === "coal") this.stepCoals(now);
    if (st.scene === "pull") {
      const meter = el.querySelector(".meter");
      if (meter && !this.hold) {
        const deg = Math.sin((now - this.t0) / 620) * 76, t = (deg + 90) / 180;
        this.needleT = t;
        meter.style.setProperty("--needle", `${deg.toFixed(1)}deg`);
        // 針が白い帯に入っている間、「吸う」が光る
        el.querySelector(".btn-a")?.classList.toggle("hot", (t > 0.44 && t < 0.56) || (t > 0.13 && t < 0.2) || (t > 0.8 && t < 0.87));
      }
    }
    if (st.scene === "holes") {
      const target = st.holes.length * 360 / HOLE_COUNT;
      this.tipDeg = target + Math.sin((now - this.t0) / 430) * 15;
      const tip = el.querySelector(".foil-marks .tip"), aligned = Math.abs(this.tipDeg - target) < 5;
      if (tip && st.holes.length < HOLE_COUNT) {
        const a = (this.tipDeg - 90) * Math.PI / 180;
        tip.setAttribute("cx", (62 * Math.cos(a)).toFixed(2)); tip.setAttribute("cy", (62 * Math.sin(a)).toFixed(2));
        tip.classList.toggle("ok", aligned);   // 針先が目印に重なると金色
        el.querySelector(".btn-a")?.classList.toggle("hot", aligned && !this.holdAt);
      }
      // 押している間: 「刺す」が少し沈み、色が下から満ちる（満ちたら金＝離す時、0.5秒を越えると赤＝深すぎ）。針先では穴が育っていく
      const fill = this.holdAt ? Math.min(1, (now - this.holdAt) / HOLD_FULL) : 0, zone = pressZone(fill);
      const btn = el.querySelector(".btn-a.hold");
      if (btn) {
        btn.style.setProperty("--fill", fill.toFixed(3));
        if (btn.dataset.zone !== zone) btn.dataset.zone = zone;
        if (!this.holdAt) btn.classList.remove("pressing");
      }
      // 穴は押した長さに沿って育つ（浅い→標準→少し大きい→大きい）。目印の点線の丸を満たした所がちょうどいい
      const grown = (table) => fill <= 0 ? 0 : fill < GOOD_PRESS[0] ? table.shallow * fill / GOOD_PRESS[0]
        : fill < GOOD_PRESS[1] ? table.shallow + (table.small - table.shallow) * (fill - GOOD_PRESS[0]) / (GOOD_PRESS[1] - GOOD_PRESS[0])
        : table.small + (table.large - table.small) * (fill - GOOD_PRESS[1]) / (1 - GOOD_PRESS[1]);
      const grow = el.querySelector(".foil-marks .grow-hole");
      if (grow && tip) {
        grow.setAttribute("cx", tip.getAttribute("cx")); grow.setAttribute("cy", tip.getAttribute("cy"));
        grow.setAttribute("r", grown(HOLE_R).toFixed(2));
        grow.setAttribute("class", `grow-hole ${zone}`);
      }
      if (btn) {
        const held = this.holdAt ? now - this.holdAt : 0;
        const t = Math.min(1, held / FILL_MS);
        btn.style.setProperty("--level", this.holdAt ? (1 - (1 - t) ** 2).toFixed(3) : "0"); // 押し始めに速く、満ちる直前にゆるむ
      }
      if (this.holdAt && now - this.holdAt >= HOLD_FULL) this.endHold(); // 本編と同じく、押し続けると刺し抜ける
    }
    if ((this.talk || st.scene === "cutin") && this.typedAt && now >= this.typedAt) { this.typedAt = 0; el.classList.remove("typing"); }
    requestAnimationFrame(this.tick);
  }

  relayout() {
    if (this.st.scene === "map") this.camera(false);
    else if (this.st.scene === "cutin" && this.cast && Object.keys(this.cast).length) this.layoutActors({ speaking: this.st.who, instant: true });
    else if (this.talk) this.layoutActors({ speaking: this.line.kind === "say" ? this.line.id : null, instant: true });
    else {
      if (this.st.scene === "steam" && this.dodge) { const size = this.dodgeSize(); if (size) { this.dodge.H = size.H; this.drawDodge(performance.now()); } }
      this.fitCoach();
    }
  }
}

/* ───────── ページ ───────── */

const params = new URLSearchParams(location.search);
const app = document.getElementById("app");
const root = document.documentElement;
let current = null;
const phones = [];

function showGallery() {
  current = null; phones.length = 0;
  root.dataset.view = "gallery";
  root.style.fontSize = "";
  app.innerHTML = `<main class="gallery">
    <h1 class="g-title">縦画面「煙の舞台」 第1章の場面</h1>
    <p class="g-lead">C案を第1章の場面で詰めた試作です。その場面で要るものだけを出し、説明の文字を減らして、顔・絵記号・光で伝える形にしています。どの画面も十字キーとAを押せます。</p>
    <ul class="g-points">
      <li><b>立ち位置</b>1人は中央で少し寄り、2人は左右で身長差そのまま。話している側が手前で明るい</li>
      <li><b>地図</b>左右キーで隣の店へ画面が送られる。上で全体、下で一覧。指でずらす・「！」の店へ飛ぶ</li>
      <li><b>パッド</b>輪の十字キーとAを大きく（幅の約半分と1/3強）。作る場面は工程ごとの操作に替わる。Aは文字ではなく絵（行く・次へ・決定・刺す・吸う）で、刺すは押すと針が下がってアルミを突く</li>
      <li><b>補助ボタン</b>案1「名前つきの段」で確定（絵記号に短い名前を添えて横いっぱいに大きく）</li>
      <li><b>登場カットイン</b>案A「縦のポスター」で確定</li>
      <li><b>出すもの</b>地図は章・日付・レベル・体力・お金（天気は降る雨で見せる）。会話は場所の名前だけ、シーシャ作りは工程の並び（絵記号だけ）・熱ゲージ・ランクだけ</li>
      <li><b>作る場面</b>水入れは大会仕様のボトルへ直接、配合ははかりと縦に広いフレーバーの一覧、炭焼きはコンロの炭をタッチ、雑念よけは本編の見た目を縦に。説明は右上の薄い「？」。背景は会場（tonari・PEPPERMINT・大会の会場）で替わる</li>
      <li><b>ランク</b>工程を終えた時に上の絵へどかっと出て、右上へ移る（案D・オーナー案）。見比べ用に案A〜Cも残す（下）</li>
    </ul>
    <p class="g-note">絵・立ち絵・台詞は本編の素材、配置と動きが今回の案です。本編の進行や保存には触れません。<a href="?view=play" data-go="play">1台で通して触る</a></p>
    <div class="g-grid">${GALLERY.map((item, i) => `<figure class="g-cell"><article class="phone" data-i="${i}"></article><figcaption>${item.caption}</figcaption></figure>`).join("")}</div>
    <h2 class="g-sub">ランクの出し場所</h2>
    <p class="g-note">本編の制作ランク（D〜SSS の絵）を縦画面のどこに置くか。どの案も、工程を終えてランクが上がった瞬間は舞台の真ん中に大きく出し（下の英語まで読める）、置き場所へ縮めて収める。1台表示の右上のつまみ →「ランク」で案を替え、「↑」で上がる動きを何度でも見られる。</p>
    ${Object.entries(RANK_PLACES).map(([v, place]) => `<section class="g-aux"><h3><small>案${v.toUpperCase()}${v === "d" ? "（オーナー案）" : ""}</small>${place.name}<a href="?view=play&scene=holes&rank=${v}">1台で動きを見る</a></h3><p>${place.lead}</p>
      <div class="g-grid">${[["pack", 1, 0.3, "詰め（ランクC）"], ["holes", 2, 0.6, "穴あけ（ランクB・進み6割）"], ["pull", 4, 0.4, "吸い出し（ランクS）"]].map(([scene, grade, gradeP, cap]) => `<figure class="g-cell"><article class="phone" data-rank="${v}" data-scene="${scene}" data-grade="${grade}" data-gp="${gradeP}"></article><figcaption>${cap}</figcaption></figure>`).join("")}</div></section>`).join("")}
    <h2 class="g-sub">登場カットイン（縦画面）</h2>
    ${["a"].map((v) => `<section class="g-aux"><h3><small>案${v.toUpperCase()}で決定</small>${CUT_VARIANTS[v].name}<a href="?view=play&scene=cutin&ci=${v}" data-go="play" data-ci="${v}">1台で動きを見る</a></h3><p>${CUT_VARIANTS[v].lead}</p>
      <div class="g-grid">${["minto", "sumi"].map((who) => `<figure class="g-cell"><article class="phone" data-ci="${v}" data-who="${who}"></article><figcaption>${who === "minto" ? "みんと" : "スミさん"}</figcaption></figure>`).join("")}</div></section>`).join("")}
  </main>`;
  app.querySelectorAll(".phone[data-i]").forEach((el) => { const item = GALLERY[Number(el.dataset.i)]; phones.push(new Phone(el, item.scene, { fixed: true, ...item })); });
  app.querySelectorAll(".phone[data-ci]").forEach((el) => phones.push(new Phone(el, "cutin", { fixed: true, ci: el.dataset.ci, who: el.dataset.who })));
  app.querySelectorAll(".phone[data-gp]").forEach((el) => phones.push(new Phone(el, el.dataset.scene, { fixed: true, rank: el.dataset.rank, grade: Number(el.dataset.grade), gradeP: Number(el.dataset.gp) })));
  scrollTo(0, 0);
}

/** 1台を画面いっぱいに。幅 39rem・高さ 66rem 以上が入るよう、html の文字の大きさを画面に合わせる。 */
function fit() {
  if (current) {
    const box = app.getBoundingClientRect();
    const rem = Math.min(box.width / 39, box.height / 66);
    root.style.fontSize = `${rem}px`;
    current.el.style.height = `${Math.min(box.height, rem * 92)}px`;
    current.relayout();
  } else phones.forEach((phone) => phone.relayout());
}

function showPlay(scene = "map", aux = Number(params.get("aux")) || 1, ci = params.get("ci") || "a", who = params.get("who") || "minto") {
  root.dataset.view = "play"; phones.length = 0;
  const bare = params.has("bare");
  app.innerHTML = `<div class="frame"><article class="phone"></article>${bare ? "" : `<nav class="switch" aria-label="場面と案の切り替え">
    <button class="grip" data-grip aria-expanded="false" aria-label="切り替えを開く"><i></i></button>
    <div class="panel"><div>${SCENES.map((id) => `<button data-scene="${id}" aria-pressed="${id === scene}">${SCENE_LABEL[id]}</button>`).join("")}</div>
      <div><small>登場</small>${[["minto", "みんと"], ["sumi", "スミ"]].map(([id, name]) => `<button data-who="${id}" aria-pressed="${id === who}">${name}</button>`).join("")}<a href="?view=gallery" data-go="gallery">一覧</a></div>
      <div><small>雑念よけ</small><button data-attack aria-pressed="${params.has("attack")}">アタック習得</button></div>
      <div><small>会場</small>${Object.entries(VENUES).map(([v, name]) => `<button data-venue="${v}" aria-pressed="${v === (params.get("venue") || "tonari")}">${name}</button>`).join("")}</div>
      <div><small>ランク</small>${Object.keys(RANK_PLACES).map((v) => `<button data-rank="${v}" aria-pressed="${v === (params.get("rank") || "d")}">案${v.toUpperCase()}</button>`).join("")}<button data-rankup aria-label="ランクを上げる">↑</button></div></div></nav>`}</div>`;
  const el = app.querySelector(".phone");
  // 先に大きさを決めてから描く（立ち絵と地図の位置は絵の大きさから決まる）
  const box = app.getBoundingClientRect(), rem = Math.min(box.width / 39, box.height / 66);
  root.style.fontSize = `${rem}px`; el.style.height = `${Math.min(box.height, rem * 92)}px`;
  const make = (sceneId, opts = {}) => new Phone(el, sceneId, { step: Number(params.get("step")) || 0, list: params.has("list"), overview: params.has("overview"), choice: params.has("choice"), more: params.has("more"), aux, ci, who, rank: params.get("rank") || "d", venue: params.get("venue") || "tonari", attack: params.has("attack"), grade: params.get("grade"), ...opts });
  current = make(scene);
  const nav = app.querySelector(".switch");
  if (!nav) return;
  const sync = () => nav.querySelectorAll("[data-scene]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.scene === current.st.scene)));
  current.onScene = sync;
  let idle;
  const open = (on) => { nav.classList.toggle("open", on); nav.querySelector("[data-grip]").setAttribute("aria-expanded", String(on)); clearTimeout(idle); if (on) idle = setTimeout(() => open(false), 4200); };
  nav.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button || !current) return;
    if ("grip" in button.dataset) return open(!nav.classList.contains("open"));
    open(true);
    if (button.dataset.scene) current.setScene(button.dataset.scene);
    else if ("attack" in button.dataset) {
      // アタックを覚えた状態を切り替える（覚えると、精密の隣に入れ替えのボタンが出る）
      current.attackLearned = !current.attackLearned;
      if (!current.attackLearned) current.st.sub = "slow";
      button.setAttribute("aria-pressed", String(current.attackLearned));
      current.setScene("steam");
    }
    else if (button.dataset.venue) {
      // 作る場面の会場（背景）を替える。作る場面でなければ炭焼きへ
      current.venue = button.dataset.venue;
      nav.querySelectorAll("[data-venue]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.venue === current.venue)));
      current.setScene(CRAFT_SCENES.includes(current.st.scene) ? current.st.scene : "coal");
    }
    else if (button.dataset.rank || "rankup" in button.dataset) {
      // ランクの置き場所の案を替える／上がる動きを見る。作る場面でなければ穴あけへ
      const crafting = CRAFT_SCENES.includes(current.st.scene);
      if (button.dataset.rank) {
        current.rankAt = button.dataset.rank; current.el.dataset.rank = button.dataset.rank;
        nav.querySelectorAll("[data-rank]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.rank === current.rankAt)));
        if (crafting) current.render(); else current.setScene("holes");
      } else if (crafting) current.rankUp({ loop: true });
      else { current.setScene("holes"); setTimeout(() => current.rankUp({ loop: true }), 400); }
    }
    else if (button.dataset.ci || button.dataset.who) {
      // 登場カットインの案・人物を替えて、その場で流す
      if (button.dataset.ci) current.st.ci = button.dataset.ci;
      if (button.dataset.who) current.st.who = button.dataset.who;
      nav.querySelectorAll("[data-ci]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.ci === current.st.ci)));
      nav.querySelectorAll("[data-who]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.who === current.st.who)));
      current.setScene("cutin");
    }
  });
}

app.addEventListener("click", (event) => {
  const go = event.target.closest("[data-go]");
  if (!go) return;
  event.preventDefault();
  if (go.dataset.go === "play") showPlay(go.dataset.ci ? "cutin" : "map", 1, go.dataset.ci || "a"); else showGallery();
});
addEventListener("keydown", (event) => {
  if (!current) return;
  const dir = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" }[event.key];
  const scene = current.st.scene, enter = event.key === "Enter" || event.key === " " || event.key === "z";
  // 雑念よけ: 矢印は押している間ずっと動く。Shift で精密の切り替え、Enter・Space で雑念を払う
  if (scene === "steam" && (dir || event.key === "Shift")) {
    event.preventDefault();
    if (dir) current.keys.add(dir);
    else if (!event.repeat) current.toggleSlow();
    return;
  }
  if (scene === "steam" && (event.key === "z" || event.key === "x")) { event.preventDefault(); if (event.key === "z" && current.attackLearned) current.attack(); else current.pressA(); return; }
  // 水入れ: Enter・Space を押している間は注ぐ、↓を押している間は少しこぼす、→で決定
  if (scene === "water" && (enter || dir === "down" || dir === "right")) {
    event.preventDefault();
    if (dir === "right") current.decideWater();
    else if (!event.repeat && !current.deciding) { if (dir === "down") current.draining = true; else current.pouring = true; current.syncWater(); }
    return;
  }
  if (dir) { event.preventDefault(); current.move(dir); }
  else if (event.key === "Enter" || event.key === " " || event.key === "z") { event.preventDefault(); if (current.st.scene === "holes") { if (!event.repeat) current.startHold(); } else current.pressA(); }
});
addEventListener("keyup", (event) => {
  const dir = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" }[event.key];
  if (current?.st.scene === "steam" && dir) current.keys.delete(dir);
  if (current?.st.scene === "water" && (current.pouring || current.draining)) { current.pouring = current.draining = false; current.syncWater(); }
  if (current?.st.scene === "holes" && (event.key === "Enter" || event.key === " " || event.key === "z")) { event.preventDefault(); current.endHold(); }
});
addEventListener("resize", fit);
addEventListener("load", fit);

const wantPlay = params.get("view") === "play" || (params.get("view") !== "gallery" && matchMedia("(max-width: 720px)").matches);
if (wantPlay) showPlay(SCENES.includes(params.get("scene")) ? params.get("scene") : "map"); else showGallery();
