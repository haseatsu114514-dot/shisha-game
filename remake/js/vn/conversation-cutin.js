// 会話カットイン（立ち絵版・#2990）。はじめの既存の立ち絵（新画風 new の表情）を枠で切り抜き、台本の決まった行にだけ出す。
// 仕様・枠・出現アニメーション・出す条件は Draft PR #2931 のデモ（#2924）が正本。採用は 2a・2c・5・5b・4・4m・3 の7件
// （2026-11-08 オーナー選別）。不採用の 1（聞き手の小窓）・3m（心の声の目元帯）は入れない。白い顔のグラフィック版は登場カットイン専用。
// 台本（data/dialogue）は書き換えず、会話ID＋話者＋台詞の全文で行を指す。台詞が変わると出なくなるので、テストで実在を固定している。

// 立ち絵（896×1200）の中の、顔の中心と帽子のつば〜目元の中心（原画の px）。デモ（#2931）と同じ値
export const SPRITE = { w: 896, h: 1200 };
export const FOCUS = {
  face: { normal: [480, 205], sad: [468, 215], serious: [478, 202], surprise: [480, 205], smile: [480, 205] },
  brim: { normal: [482, 170], sad: [470, 180], serious: [480, 168], surprise: [482, 170], smile: [482, 170] },
};

// 枠（舞台 1280×720 の座標）。tall・band は PR #2831 の A・C と同じ形。eyeband は相手の手前（x380）まで
export const FRAMES = {
  tall: { x: 36, y: 192, w: 300, h: 334, poly: "0,23 300,0 264,334 0,334" },
  band: { x: 0, y: 308, w: 480, h: 218, poly: "0,31 480,0 425,195 0,218" },
  eyeband: { x: 0, y: 200, w: 380, h: 120, poly: "0,10 380,0 362,120 0,112" },
};

// 案ごとの見せ方。on: "partner" 相手の行に、はじめの顔だけを無言で出す / "line" はじめ自身の行に出す
// leave: "line" 次の行で消える / "fade" 次の行で0.3秒かけて薄れる / ms … その時間で消える
// partners: 出せる「相手の立ち絵の枚数」（#2845 オーナー決定: 相手の行は1枚の時だけ。案4は独白の0枚も可）
export const KINDS = {
  "2a": { plan: 2, frame: "tall", pose: { scale: 0.86, fx: 150, fy: 128 }, enter: "slide", on: "partner", leave: "line", partners: [1] },
  "2c": { plan: 2, frame: "band", pose: { scale: 0.86, fx: 230, fy: 118 }, enter: "slide", on: "partner", leave: "line", ms: 900, partners: [1] },
  "5": { plan: 5, frame: "tall", pose: { scale: 0.86, fx: 150, fy: 128 }, enter: "rise", on: "line", leave: "line", partners: [1], amber: true },
  "4": { plan: 4, frame: "tall", pose: { scale: 0.86, fx: 150, fy: 196 }, enter: "fade", on: "line", leave: "fade", partners: [0, 1], sink: true },
  // 仮判断（#2990）: 大会本番の決意の行は実際の再生で相手の立ち絵が2枚（王煙楼・鳴切）になるため、はじめ自身の行に限り2枚でも出す。
  // 1枚だけに戻すときは partners を [1] にする。
  "3": { plan: 3, frame: "eyeband", pose: { scale: 1.25, fx: 200, fy: 60, focus: "brim" }, enter: "wipe", on: "line", leave: "line", partners: [1, 2] },
};

// 置き場（#2990 の配置判断）。id は Issue の案番号（5b・4m は同じ見せ方の別場面）
export const CUES = [
  { id: "2a", kind: "2a", dialogue: "ch2_tsumugi_color", speaker: "tsumugi", face: "sad", text: "はい。……お水が要る顔でした" },
  { id: "2c", kind: "2c", dialogue: "ch1_tsumugi_third", speaker: "tsumugi", face: "surprise", text: "……急に、そんな顔しないでください" },
  { id: "5", kind: "5", dialogue: "samechan_bond_finale", speaker: "hajime", face: "smile", text: "大事に使います。ありがとうございます" },
  { id: "5b", kind: "5", dialogue: "ch1_sumi_bond_finale", speaker: "hajime", face: "smile", text: "……ありがとうございます。大事に使います" },
  { id: "5", kind: "5", dialogue: "ch1_adam_bond_finale", speaker: "hajime", face: "smile", text: "……大事に育てます。アダムさん、ありがとうございます" },
  { id: "4", kind: "4", dialogue: "ch4_defeat", speaker: "hajime", face: "sad", text: "……届かなかった。悔しいな" },
  { id: "4", kind: "4", dialogue: "ch1_tournament_defeat", speaker: "hajime", face: "sad", text: "（……そうか。届かなかった）" },
  { id: "4m", kind: "4", dialogue: "ch2_abyss_baito", speaker: "hajime", face: "sad", text: "……俺、シーシャ、向いてないのかな" },
  { id: "3", kind: "3", dialogue: "ch4_tournament_start", speaker: "hajime", face: "serious", text: "うん。全員に、勝ちたい" },
  // #3417: 第1章に寄っていた置き場を全章へ広げる（各章3回前後・1会話1回・会話演出の印と同じ行には置かない）。同じ型の別場面
  { id: "3", kind: "3", dialogue: "ch2_tournament_stations", speaker: "hajime", face: "serious", text: "……よろしくお願いします。最後まで、手順通りに作ります" },
  { id: "3", kind: "3", dialogue: "ch3_tournament_day", speaker: "hajime", face: "serious", text: "作ってから、決めます。よろしくお願いします" },
  { id: "5", kind: "5", dialogue: "ch3_volk_bond_finale", speaker: "hajime", face: "smile", text: "はい、大事に使います" },
  { id: "4", kind: "4", dialogue: "ch3_national_defeat", speaker: "hajime", face: "sad", text: "……もう少し、待てた気がする" },
  { id: "2a", kind: "2a", dialogue: "ch4_rehearsal_good", speaker: "naru", face: "serious", text: "その顔なら大丈夫だ" },
  { id: "3", kind: "3", dialogue: "ch5_relationship_before_second_cup", speaker: "hajime", face: "serious", text: "……はい" },
  { id: "2c", kind: "2c", dialogue: "ch5_tsumugi_makes_for_hajime", speaker: "tsumugi", face: "surprise", text: "……寝不足ですね。目の下、ちょっと暗いです" },
  { id: "4", kind: "4", dialogue: "ch5_second_cup_defeat", speaker: "hajime", face: "sad", text: "……はい。店へ帰って、一服します" },
  { id: "5", kind: "5", dialogue: "ch5_second_cup_result", speaker: "hajime", face: "smile", text: "ありがとうございます。最初の一台、また吸わせてください" },
];

/** この行に置いたカットイン（無ければ null）。分岐・演出の行や、立ち絵の指定を差し替えた行には出さない */
export function conversationCutinCue(dialogueId, line) {
  if (!dialogueId || !line || line.type || line.portrait !== undefined) return null;
  return CUES.find((c) => c.dialogue === dialogueId && c.speaker === line.speaker && c.text === line.text) || null;
}

/** 出せる条件（#2845 オーナー決定＋デモの判定）。1会話1回まで・相手の立ち絵の枚数・他の表示と重ねない */
export function conversationCutinAllowed(cue, ctx) {
  const kind = KINDS[cue?.kind];
  if (!kind || ctx.shown || ctx.skip || ctx.turbo || ctx.cg || ctx.log || ctx.choices || ctx.intro || ctx.protagonistVisible) return false;
  if (!kind.partners.includes(ctx.portraits)) return false;
  // 相手の行は、映っている1枚がその話し手の時だけ
  return kind.on !== "partner" || ctx.portraitSpeakers?.length === 1 && ctx.portraitSpeakers[0] === cue.speaker;
}

/** 立ち絵をそのまま縮尺して、顔（または帽子のつば〜目元）が枠内の指定位置に来る置き方。回転・加筆はしない */
export function conversationCutinArt(cue) {
  const kind = KINDS[cue.kind], p = kind.pose;
  const [fx, fy] = FOCUS[p.focus || "face"][cue.face] || FOCUS[p.focus || "face"].normal;
  return { width: SPRITE.w * p.scale, height: SPRITE.h * p.scale, left: p.fx - fx * p.scale, top: p.fy - fy * p.scale };
}

const SVG = "http://www.w3.org/2000/svg";
/** カットインの層。show で出し、next 行で leave、SKIP・LOG・終了では clear で即座に消す */
export function createConversationCutin(layer, { document = globalThis.document, schedule = globalThis.setTimeout, cancel = globalThis.clearTimeout } = {}) {
  let node = null, timer = null;
  const drop = (n) => n?.remove();
  const clear = () => {
    if (timer !== null) cancel(timer);
    timer = null;
    for (const n of [...layer.children]) drop(n);
    node = null;
  };
  const show = (cue, src, { still = false } = {}) => {
    clear();
    const kind = KINDS[cue.kind], f = FRAMES[kind.frame], art = conversationCutinArt(cue);
    const n = document.createElement("div");
    n.className = "vn-cutin";
    Object.assign(n.dataset, { cue: cue.id, kind: cue.kind, plan: String(kind.plan), enter: kind.enter, face: cue.face, still: String(!!still) });
    if (kind.sink) n.classList.add("sink");
    if (kind.amber) n.classList.add("amber");
    Object.assign(n.style, { left: `${f.x}px`, top: `${f.y}px`, width: `${f.w}px`, height: `${f.h}px` });
    const clip = document.createElement("div");
    clip.className = "vn-cutin-clip";
    clip.style.clipPath = `polygon(${f.poly.split(" ").map((xy) => xy.split(",").map((v) => `${v}px`).join(" ")).join(",")})`;
    const image = document.createElement("img");
    image.className = "vn-cutin-art";
    image.alt = "";
    image.draggable = false;
    for (const key of ["left", "top", "width", "height"]) image.style[key] = `${art[key]}px`;
    image.onerror = () => { if (node === n) clear(); };
    image.src = src;
    clip.append(image);
    const svg = document.createElementNS(SVG, "svg");
    svg.setAttribute("viewBox", `0 0 ${f.w} ${f.h}`);
    const border = document.createElementNS(SVG, "polygon");
    border.setAttribute("points", f.poly);
    svg.append(border);
    n.append(clip, svg);
    layer.append(n);
    node = n;
    if (kind.ms) timer = schedule(() => { if (node === n) clear(); }, kind.ms);
    return n;
  };
  /** 次の行へ進むとき。案4だけ0.3秒かけて薄れる（動きを減らす設定では即座に消す） */
  const leave = ({ still = false } = {}) => {
    const n = node;
    if (!n) return;
    const kind = KINDS[n.dataset.kind];
    if (timer !== null) cancel(timer);
    timer = null;
    node = null;
    if (kind?.leave === "fade" && !still) {
      n.classList.add("leave");
      schedule(() => drop(n), 300);
    } else drop(n);
  };
  return { show, leave, clear };
}
