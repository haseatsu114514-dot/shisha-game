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
  bowl_airy: `${REMAKE_IMG}ui/making/bowl_packed_airy.webp`,
  bowl_normal: `${REMAKE_IMG}ui/making/bowl_packed_normal.webp`,
  bowl_firm: `${REMAKE_IMG}ui/making/bowl_packed_firm.webp`,
  foil: `${REMAKE_IMG}ui/making/foil_interactive_top.webp`,
  pullActor: `${REMAKE_IMG}ui/making/hajime_craft_pull.webp`,
  leaf: `${REMAKE_IMG}ui/making/ui_mockup_flavor_leaf.webp`,
  smoke: `${REMAKE_IMG}ui/making/smoke_thick.webp`,
  ciMinto: `${REMAKE_IMG}ui/character_intros/graphic/minto.webp`,
  ciBgMinto: `${REMAKE_IMG}ui/character_intros/graphic/bg_minto.webp`,
  ciSumi: `${REMAKE_IMG}ui/character_intros/graphic/sumi.webp`,
  ciBgSumi: `${REMAKE_IMG}ui/character_intros/graphic/bg_sumi.webp`,
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
const STEPS = [["pack", "詰め"], ["holes", "穴あけ"], ["coal", "炭"], ["water", "水"], ["steam", "蒸らし"], ["pull", "吸い出し"], ["care", "調整"]];
const COACH = {
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

const SCENES = ["map", "minto", "tonari", "pack", "holes", "pull", "cutin"];
const SCENE_LABEL = { map: "地図", minto: "1人", tonari: "2人", pack: "詰め", holes: "穴あけ", pull: "吸う", cutin: "登場" }; // 1台表示の切り替え
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
  { scene: "pack", caption: "作る・詰め" },
  { scene: "holes", caption: "作る・穴あけ" },
  { scene: "pull", caption: "作る・吸い出し" },
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
};
// ボタンいっぱいの 100×100 で描く。刺す: 大きな穴あけの針（持ち手・口金・太い針）と、その下のアルミ。押し具合（--level）で針が下がってアルミを突き、満ちた所で金の火花
// 吸う: マウスピース（ホースの切れ端・金具・先へ細くなる持ち手・吸い口のチップ）を斜めに。吸うたびに少し動いて光る
const TOOL_SVG = {
  needle: `<svg class="tool-svg tool-needle" viewBox="0 0 100 100" aria-hidden="true">
    <g class="gl-needle"><path d="M40.5 17.5C40.5 11 44.6 6.5 50 6.5S59.5 11 59.5 17.5V28c0 4-2.2 6.4-4.4 7.5H44.9c-2.2-1.1-4.4-3.5-4.4-7.5z"/><rect x="43.5" y="37.5" width="13" height="5.5" rx="1.2"/><path d="M47.3 44.5h5.4l-.7 25.5L50 77.5 48 70z"/></g>
    <path class="gl-foil" d="M14 82H42.5M57.5 82H86"/><path class="gl-dent" d="M42.5 82q7.5 6.5 15 0"/><path class="gl-spark" d="M35 72.5l4.5 4.5M65 72.5l-4.5 4.5M50 88v5"/></svg>`,
  mouthpiece: `<svg class="tool-svg tool-mouthpiece" viewBox="0 0 100 100" aria-hidden="true"><g class="gl-mp"><g transform="translate(0 -5) rotate(-45 50 50) translate(50 50) scale(0.74) translate(-50 -50)">
    <rect x="-4" y="45" width="16" height="10" rx="4"/><rect x="13.5" y="43.3" width="7.5" height="13.4" rx="1.6"/>
    <path d="M22.5 42.8L78 45Q82 45.3 82 48.2V51.8Q82 54.7 78 55L22.5 57.2Z"/><path class="gl-ring" d="M31 43.6V56.4M72 45V55"/>
    <rect class="gl-tip" x="84" y="46.4" width="20" height="7.2" rx="2.6"/></g></g></svg>`,
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
  constructor(el, scene, { fixed = false, step = 0, list = false, overview = false, choice = false, aux = 1, more = false, ci = "a", who = "minto", rank = "d", grade = 0, gradeP = 0 } = {}) {
    this.el = el;
    el.lang = "ja";
    this.fixed = fixed; // 一覧では場面を固定し、その場面の中の操作だけ動かす
    this.aux = [1, 2, 3].includes(aux) ? aux : 1; // 補助ボタンの配置案
    this.moreOpen = !!more;
    el.dataset.aux = String(this.aux);
    this.rankAt = RANK_PLACES[rank] ? rank : "d"; // ランクの置き場所の案
    el.dataset.rank = this.rankAt;
    this.st = { scene, sel: DEFAULT_SPOT, step, page: 0, grade: Math.max(0, Math.min(6, Number(grade) || 0)), gradeP: Number(gradeP) || 0, choosing: choice, pick: 0, list, overview, auto: false, skip: false, pack: 1, holes: [], pulls: 0, temp: 0.4,
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
    if (!this.talk && st.scene !== "map") this.fitCoach();
  }

  /** スミさんの一言も本編の組版で折る（文末・読点を優先し、語の途中で折らない）。2行に収まらない一言は書き直す（VPL29）。 */
  fitCoach() {
    const say = this.el.querySelector(".coach .say-text");
    if (!say) return;
    const text = COACH[this.st.scene];
    say.textContent = text;
    const pages = paginateForBox(text, say);
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
    const pic = st.scene === "pack" ? `<img class="bg" src="${IMG.tonari}" alt=""><img class="bowl" src="${IMG[`bowl_${PACKS[st.pack].id}`]}" alt="">`
      : st.scene === "holes" ? `<img class="bg" src="${IMG.tonari}" alt=""><div class="foil"><img src="${IMG.foil}" alt=""><svg viewBox="-100 -100 200 200" class="foil-marks"></svg></div>`
      : `<img class="bg" src="${IMG.tonari}" alt=""><img class="pull-actor" src="${IMG.pullActor}" alt=""><img class="puff" src="${IMG.smoke}" alt="">`;
    // 日付・体力・お金は出さない。上は工程の並びだけ。名前の文字は出さず、今の工程は光る丸で示す（VPL31）
    return `
      <img class="amb" src="${IMG.tonari}" alt="">
      <div class="pic craft craft-${st.scene}">${pic}</div>
      <i class="veil"></i>
      ${this.thermoHtml()}
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

  /** 熱ゲージ（温度帯）。シーシャ作りの間ずっと右に大きく出す。色の意味は本編と同じ（緑＝適温の目安、虹＝合わせやすい範囲、炎＝焦げる）。 */
  thermoHtml() {
    const t = this.st.temp, pc = (v) => `${(v * 100).toFixed(1)}%`;
    return `<div class="thermo ${tempState(t)}" style="--t:${t}" role="meter" aria-label="煙の温度" aria-valuemin="0" aria-valuemax="1" aria-valuenow="${t.toFixed(2)}">
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
    const cards = st.scene === "pack" ? `<div class="cards">${PACKS.map((p, i) => `<button class="card${p.locked ? " locked" : ""}" data-act="pack" data-pack="${i}" aria-current="${i === st.pack}">
      <img src="${IMG[`bowl_${p.id}`]}" alt=""><b>${p.name}</b><span class="dens">${[1, 2, 3].map((n) => `<i class="${n <= p.dens ? "on" : ""}"></i>`).join("")}</span>${p.locked ? icon("lock") : ""}</button>`).join("")}</div>` : "";
    return `<button class="coach" data-act="coach" aria-label="スミさんの一言"><img src="${IMG.faceSumi}" alt=""><span class="say"><span class="say-text">${esc(COACH[st.scene])}</span></span></button>${cards}`;
  }

  craftCtrlHtml() {
    const { st } = this;
    if (st.scene === "pack") {
      return `${this.auxHtml("craft", CRAFT_CHIPS)}${dpadHtml("left right")}${aHtml("ok", { disabled: !!PACKS[st.pack].locked })}`;
    }
    if (st.scene === "holes") {
      // 「刺す」を真ん中に大きく置く。押すと色が下から上へ満ち、満ちた瞬間に金に光る（ここで離す）。周りの10個の点＝開けた穴（金＝ちょうどいい）
      const pips = Array.from({ length: HOLE_COUNT }, (_, i) => {
        const a = (i * 360 / HOLE_COUNT - 90) * Math.PI / 180, hole = st.holes[i];
        return `<circle class="pip${hole ? (hole.good ? " good" : " done") : ""}" cx="${(46 * Math.cos(a)).toFixed(1)}" cy="${(46 * Math.sin(a)).toFixed(1)}" r="2.6"/>`;
      }).join("");
      return `${this.auxHtml("craft", CRAFT_CHIPS)}
        <svg class="hole-pips" viewBox="-50 -50 100 100" aria-label="開けた穴 ${st.holes.length}/${HOLE_COUNT}">${pips}</svg>
        ${aHtml("poke", { cls: "hold center", extra: `<i class="fill"></i><i class="fill-line"></i>` })}`;
    }
    // 葉（フレーバーの持ち）は上の段の真ん中、吸った回数は「吸う」の中の点。ボタンに重ねない
    return `${this.auxHtml("craft", CRAFT_CHIPS)}
      <span class="leaves" role="img" aria-label="フレーバーの持ち 5">${`<img src="${IMG.leaf}" alt="">`.repeat(5)}</span>
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
      if (id === "list") { st.list = !st.list; this.patch(); }
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
    if (st.scene === "holes" && event.target.closest('.btn-a[data-act="a"]')) { event.target.closest(".btn-a").setPointerCapture?.(event.pointerId); this.startHold(); return; }
    const map = event.target.closest("[data-map]");
    if (map && !st.overview && this.view) { this.drag = { id: event.pointerId, x: event.clientX, y: event.clientY, ox: this.view.x, oy: this.view.y, moved: false }; return; }
    const card = event.target.closest("[data-swipe]");
    if (card) this.swipe = { x: event.clientX };
  }

  onMove(event) {
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
      else this.setScene(st.scene === "minto" ? "tonari" : "pack");
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
    if (st.holes.length >= HOLE_COUNT) setTimeout(() => { if (this.fixed) { st.holes = []; st.gradeP = 0; this.patch(); this.drawHoles(); this.syncRank(); } else this.setScene("pull"); }, 3300);
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
    const crafting = (id) => ["pack", "holes", "pull"].includes(id);
    if (!crafting(this.st.scene) && crafting(scene)) Object.assign(this.st, { grade: 0, gradeP: 0 });
    else if (crafting(scene)) this.st.gradeP = 0;
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
    else this.fitCoach();
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
      <div><small>ランク</small>${Object.keys(RANK_PLACES).map((v) => `<button data-rank="${v}" aria-pressed="${v === (params.get("rank") || "d")}">案${v.toUpperCase()}</button>`).join("")}<button data-rankup aria-label="ランクを上げる">↑</button></div></div></nav>`}</div>`;
  const el = app.querySelector(".phone");
  // 先に大きさを決めてから描く（立ち絵と地図の位置は絵の大きさから決まる）
  const box = app.getBoundingClientRect(), rem = Math.min(box.width / 39, box.height / 66);
  root.style.fontSize = `${rem}px`; el.style.height = `${Math.min(box.height, rem * 92)}px`;
  const make = (sceneId, opts = {}) => new Phone(el, sceneId, { step: Number(params.get("step")) || 0, list: params.has("list"), overview: params.has("overview"), choice: params.has("choice"), more: params.has("more"), aux, ci, who, rank: params.get("rank") || "d", grade: params.get("grade"), ...opts });
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
    else if (button.dataset.rank || "rankup" in button.dataset) {
      // ランクの置き場所の案を替える／上がる動きを見る。作る場面でなければ穴あけへ
      const crafting = ["pack", "holes", "pull"].includes(current.st.scene);
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
  if (dir) { event.preventDefault(); current.move(dir); }
  else if (event.key === "Enter" || event.key === " " || event.key === "z") { event.preventDefault(); if (current.st.scene === "holes") { if (!event.repeat) current.startHold(); } else current.pressA(); }
});
addEventListener("keyup", (event) => {
  if (current?.st.scene === "holes" && (event.key === "Enter" || event.key === " " || event.key === "z")) { event.preventDefault(); current.endHold(); }
});
addEventListener("resize", fit);
addEventListener("load", fit);

const wantPlay = params.get("view") === "play" || (params.get("view") !== "gallery" && matchMedia("(max-width: 720px)").matches);
if (wantPlay) showPlay(SCENES.includes(params.get("scene")) ? params.get("scene") : "map"); else showGallery();
