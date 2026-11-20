// 会話カットイン（はじめの顔の帯）。台本の決まった行にだけ、カットイン専用の絵を帯に入れて出す。
// 2026-11-20 再設計（docs/owner_requests.md の CCR01〜05。寸法と依頼文は asset_sources/conversation-cutin-redesign-20261120/）:
// - 形は2つ。画面の左端から出る「寄りの帯」（金の細い線・中は今の背景のぼかし・帽子が線の手前に出る）と、
//   大会の決意だけに使う全幅の「目元の帯」。
// - 相手の行（その顔）は、台詞が出切ってから相手の顔の高さに出る。はじめ自身の行は名前のすぐ上に出る。
// - 絵は ART の4枚。動揺・沈み・受け取るは Codex の専用の絵（原画 asset_sources/conversation-cutin-redesign-20261120/originals/、
//   ゲーム用への変換は同じフォルダの fit_cutin.py）。決意だけは、新版の立ち絵の原画を切り抜いた仮の絵のまま。
//   差し替えるときは ART の寸法・顔の位置・頭の高さだけを直す（枠と出し方は変えない）。
// 台本（data/dialogue）は書き換えず、会話ID＋話者＋台詞の全文で行を指す。台詞が変わると出なくなるので、テストで実在を固定している。

export const ART_DIR = "img/ui/conversation_cutin/";
// 絵ごとの寸法（px）。face は顔の中心、head は帽子のてっぺん〜あごの高さ（どちらも絵の px）。
// 値は fit_cutin.py が測った値から出す。仮の絵（決意・660×560）は、試作でオーナーに見せた見え方（原画の0.96倍）になる値
export const ART = {
  flustered: { file: "hajime_flustered.webp", w: 617, h: 731, face: [356, 329], head: 389 }, // 動揺: その顔（軽い）
  downcast: { file: "hajime_downcast.webp", w: 637, h: 731, face: [409, 384], head: 419 }, // 沈み: その顔（重い）・敗北
  grateful: { file: "hajime_grateful.webp", w: 658, h: 736, face: [399, 319], head: 369 }, // 受け取る: 絆の締めくくり
  resolve: { file: "hajime_resolve.webp", w: 660, h: 560, face: [330, 230], head: 219 }, // 決意: 大会の目元の帯（仮の絵）
};

// 帯（舞台 1280×720 の座標）。face は顔の中心を置く位置、head は画面での頭の高さ（帯の中の座標）。
// reply は相手の行（相手の顔と同じ高さ）、own ははじめ自身の行（名前の行のすぐ上）、eyes は全幅の目元の帯。
const BAND = { x: 0, w: 500, h: 250, poly: "0,26 500,0 452,232 0,250", accent: "512,2 464,234", face: [262, 158], head: 210, breakout: 40 };
export const FRAMES = {
  reply: { ...BAND, y: 104 },
  own: { ...BAND, y: 226 },
  eyes: { x: 0, y: 128, w: 1280, h: 190, poly: "0,28 1280,0 1280,162 0,190", edge: "0,28 1280,0", inner: "0,190 1280,162", face: [596, 160], head: 383, breakout: 0, wide: true },
};

// 型ごとの見せ方。on: "partner" 相手の行に、はじめの顔だけを無言で出す（台詞が出切ってから）/ "line" はじめ自身の行に出す
// enter・leave: 出入りの動き（cut 左から開く / soft 静かに浮かぶ・薄れる / rise 持ち上がる / eyes 帯が開く・縦につぶれる）
// ms: その時間で自分から消える。無ければ次の行へ進むまで残る
// partners: 出せる「相手の立ち絵の枚数」（#2845 オーナー決定: 相手の行は1枚の時だけ。沈むは独白の0枚も可。決意は2枚も可）
// drop: 顔を帯の中で下げる量（沈んだ構図）。tone: 帯の色（amber 琥珀の線 / cool 色を落とした暗い青紫）
export const KINDS = {
  "2c": { label: "その顔（軽い）", frame: "reply", enter: "cut", leave: "cut", ms: 1150, on: "partner", partners: [1], se: "whoosh" },
  "2a": { label: "その顔（重い）", frame: "reply", enter: "soft", leave: "soft", on: "partner", partners: [1] },
  "5": { label: "受け取る", frame: "own", enter: "rise", leave: "soft", on: "line", partners: [1], tone: "amber" },
  "4": { label: "沈む", frame: "own", enter: "soft", leave: "soft", on: "line", partners: [0, 1], tone: "cool", drop: 14, breakout: 0 },
  "3": { label: "決意", frame: "eyes", enter: "eyes", leave: "eyes", ms: 800, on: "line", partners: [1, 2], se: "whoosh", dim: true },
};
// 消える動きの長さ（ms）。CSS の .vn-cutin.leave と合わせる
export const LEAVE_MS = { cut: 180, soft: 320, eyes: 180 };

// 置き場。id は #2845 の案番号（5b・4m は同じ型の別場面）。art は ART の絵
// 出すのは「相手がはじめの顔に触れた行」「大会の決意と敗北」「絆の締めくくり」だけ（CCR04・2026-11-20 オーナー決定）。
export const CUES = [
  { id: "2a", kind: "2a", dialogue: "ch2_tsumugi_color", speaker: "tsumugi", art: "downcast", text: "はい。……お水が要る顔でした" },
  // 序盤のアピール（#3660）は、台本に元からある「その顔」の行へ置き直した（CCR04。冒頭の「なんか、負けられないなあ」と、つむぎ初回の「……猫です」は外した）
  { id: "2c", kind: "2c", dialogue: "ch1_adam_first", speaker: "adam", art: "flustered", text: "ふっ……その顔。ダブルアップルの魔力に堕ちたようだな" },
  { id: "2c", kind: "2c", dialogue: "ch1_tsumugi_third", speaker: "tsumugi", art: "flustered", text: "……急に、そんな顔しないでください" },
  { id: "5", kind: "5", dialogue: "samechan_bond_finale", speaker: "hajime", art: "grateful", text: "大事に使います。ありがとうございます" },
  { id: "5b", kind: "5", dialogue: "ch1_sumi_bond_finale", speaker: "hajime", art: "grateful", text: "……ありがとうございます。大事に使います" },
  { id: "5", kind: "5", dialogue: "ch1_adam_bond_finale", speaker: "hajime", art: "grateful", text: "……大事に詰めます。アダムさん、ありがとうございます" },
  { id: "4", kind: "4", dialogue: "ch4_defeat", speaker: "hajime", art: "downcast", text: "……届かなかった。悔しいな" },
  { id: "4", kind: "4", dialogue: "ch1_tournament_defeat", speaker: "hajime", art: "downcast", text: "（……そうか。届かなかった）" },
  { id: "4m", kind: "4", dialogue: "ch2_abyss_baito", speaker: "hajime", art: "downcast", text: "……俺、シーシャ、向いてないのかな" },
  // 仮判断（#2990）: 大会本番の決意の行は実際の再生で相手の立ち絵が2枚（王煙楼・鳴切）になるため、決意は2枚でも出す。全幅の帯なので重ならない
  { id: "3", kind: "3", dialogue: "ch4_tournament_start", speaker: "hajime", art: "resolve", text: "うん。全員に、勝ちたい" },
  // #3417: 置き場を全章へ広げる（各章3回前後・1会話1回・会話演出の印と同じ行には置かない）。同じ型の別場面
  { id: "3", kind: "3", dialogue: "ch2_tournament_stations", speaker: "hajime", art: "resolve", text: "……よろしくお願いします。最後まで、手順通りに作ります" },
  { id: "3", kind: "3", dialogue: "ch3_tournament_day", speaker: "hajime", art: "resolve", text: "作ってから、決めます。よろしくお願いします" },
  { id: "5", kind: "5", dialogue: "ch3_volk_bond_finale", speaker: "hajime", art: "grateful", text: "はい、大事に使います" },
  { id: "4", kind: "4", dialogue: "ch3_national_defeat", speaker: "hajime", art: "downcast", text: "……もう少し、待てた気がする" },
  { id: "2a", kind: "2a", dialogue: "ch4_rehearsal_good", speaker: "naru", art: "resolve", text: "その顔なら大丈夫だ" },
  { id: "3", kind: "3", dialogue: "ch5_relationship_before_second_cup", speaker: "hajime", art: "resolve", text: "……はい" },
  { id: "2c", kind: "2c", dialogue: "ch5_tsumugi_makes_for_hajime", speaker: "tsumugi", art: "flustered", text: "……寝不足ですね。目の下、ちょっと暗いです" },
  { id: "4", kind: "4", dialogue: "ch5_second_cup_defeat", speaker: "hajime", art: "downcast", text: "……はい。店へ帰って、一服します" },
  { id: "5", kind: "5", dialogue: "ch5_second_cup_result", speaker: "hajime", art: "grateful", text: "ありがとうございます。最初の一台、また吸わせてください" },
];

/** この行に置いたカットイン（無ければ null）。分岐・演出の行や、立ち絵の指定を差し替えた行には出さない */
export function conversationCutinCue(dialogueId, line) {
  if (!dialogueId || !line || line.type || line.portrait !== undefined) return null;
  return CUES.find((c) => c.dialogue === dialogueId && c.speaker === line.speaker && c.text === line.text) || null;
}

/** 絵の URL（remake/ からの相対） */
export function conversationCutinSrc(cue) {
  const art = ART[cue?.art];
  return art ? ART_DIR + art.file : null;
}

/** 出せる条件（#2845 オーナー決定＋デモの判定）。1会話1回まで・相手の立ち絵の枚数・他の表示と重ねない */
export function conversationCutinAllowed(cue, ctx) {
  const kind = KINDS[cue?.kind];
  if (!kind || ctx.shown || ctx.skip || ctx.turbo || ctx.cg || ctx.log || ctx.choices || ctx.intro || ctx.protagonistVisible) return false;
  if (!kind.partners.includes(ctx.portraits)) return false;
  // 相手の行は、映っている1枚がその話し手の時だけ
  return kind.on !== "partner" || ctx.portraitSpeakers?.length === 1 && ctx.portraitSpeakers[0] === cue.speaker;
}

/** 絵をそのまま縮尺して、顔の中心が帯の決めた位置に来る置き方（帯の中の座標）。回転・加筆はしない */
export function conversationCutinArt(cue) {
  const kind = KINDS[cue.kind], f = FRAMES[kind.frame], art = ART[cue.art];
  const scale = f.head / art.head;
  const [fx, fy] = [f.face[0], f.face[1] + (kind.drop || 0)];
  return { width: art.w * scale, height: art.h * scale, left: fx - art.face[0] * scale, top: fy - art.face[1] * scale, scale };
}

const SVG = "http://www.w3.org/2000/svg";
const pts = (s) => s.split(" ").map((xy) => xy.split(",").map(Number));
const clipPolygon = (points) => `polygon(${points.map(([x, y]) => `${x}px ${y}px`).join(",")})`;

/**
 * カットインの層。show で出し、次の行で leave、SKIP・LOG・終了では clear で即座に消す。
 * 相手の行の型は、台詞の文字送り中なら出すのを待ち、reveal（文字送りが終わった時）で出す。
 * sound は効果音の名前を受け取る関数（engine.js が SE へつなぐ）。
 */
export function createConversationCutin(layer, { document = globalThis.document, schedule = globalThis.setTimeout, cancel = globalThis.clearTimeout, sound = () => {} } = {}) {
  let node = null, timer = null, pending = null;
  const drop = (n) => n?.remove();
  const clear = () => {
    if (timer !== null) cancel(timer);
    timer = null;
    pending = null;
    for (const n of [...layer.children]) drop(n);
    node = null;
  };
  const div = (cls) => { const n = document.createElement("div"); n.className = cls; return n; };
  const line = (svg, cls, points) => {
    const p = document.createElementNS(SVG, "polyline");
    p.setAttribute("class", cls);
    p.setAttribute("points", points);
    svg.append(p);
  };
  const artImage = (cue, src) => {
    const a = conversationCutinArt(cue), image = document.createElement("img");
    image.className = "vn-cutin-art";
    image.alt = "";
    image.draggable = false;
    for (const key of ["left", "top", "width", "height"]) image.style[key] = `${a[key]}px`;
    image.src = src;
    return image;
  };
  const mount = (cue, src, { still = false, bg = "" } = {}) => {
    const kind = KINDS[cue.kind], f = FRAMES[kind.frame], poly = pts(f.poly);
    const n = div("vn-cutin");
    Object.assign(n.dataset, { cue: cue.id, kind: cue.kind, frame: kind.frame, enter: kind.enter, art: cue.art, still: String(!!still) });
    if (kind.tone) n.dataset.tone = kind.tone;
    Object.assign(n.style, { left: `${f.x}px`, top: `${f.y}px`, width: `${f.w}px`, height: `${f.h}px` });
    // 帯の中: 今の背景のぼかし → 夜紫の色 → 顔の後ろの淡い光 → 絵 → 下の影 → 出る時に一度だけ走る光
    const shadow = div("vn-cutin-shadow"), clip = div("vn-cutin-clip");
    clip.style.clipPath = clipPolygon(poly);
    const backdrop = div("vn-cutin-bg");
    if (bg) backdrop.style.backgroundImage = bg;
    clip.append(backdrop, div("vn-cutin-tint"));
    if (f.wide) for (const i of [0, 1, 2, 3]) { const s = div(`vn-cutin-streak s${i}`); clip.append(s); }
    else {
      const halo = div("vn-cutin-halo");
      halo.style.setProperty("--hx", `${f.face[0]}px`);
      halo.style.setProperty("--hy", `${f.face[1] + (kind.drop || 0)}px`);
      clip.append(halo);
    }
    const image = artImage(cue, src);
    image.onerror = () => { if (node === n) clear(); };
    clip.append(image, div("vn-cutin-shade"), div("vn-cutin-sheen"));
    shadow.append(clip);
    n.append(shadow);
    // 帽子だけ帯の上の線より手前に出す（同じ絵を、帯の上の線より上だけ見せる）
    const breakout = kind.breakout ?? f.breakout;
    if (breakout) {
      const over = div("vn-cutin-over");
      over.style.clipPath = clipPolygon([[0, -breakout], [poly[1][0] - 24, -breakout], [poly[1][0] - 24, poly[1][1] + 2], [poly[0][0], poly[0][1] + 2]]);
      over.append(artImage(cue, src));
      n.append(over);
    }
    const svg = document.createElementNS(SVG, "svg");
    svg.setAttribute("viewBox", `0 0 ${f.w} ${f.h}`);
    svg.setAttribute("aria-hidden", "true");
    const edge = f.edge || f.poly;
    line(svg, "vn-cutin-glow", edge);
    line(svg, "vn-cutin-edge", edge);
    if (f.accent) line(svg, "vn-cutin-accent", f.accent);
    if (f.inner) line(svg, "vn-cutin-inner", f.inner);
    n.append(svg);
    if (kind.dim) {
      const dim = div("vn-cutin-dim");
      dim.dataset.still = String(!!still);
      layer.append(dim);
    }
    layer.append(n);
    node = n;
    if (kind.se) sound(kind.se);
    if (kind.ms) timer = schedule(() => { timer = null; if (node === n) leave({ still }); }, kind.ms);
    return n;
  };
  /** 出す。相手の行の型は、文字送りの途中（typing）なら reveal まで待つ */
  const show = (cue, src, { still = false, bg = "", typing = false } = {}) => {
    clear();
    if (typing && KINDS[cue.kind]?.on === "partner") {
      pending = () => mount(cue, src, { still, bg });
      return null;
    }
    return mount(cue, src, { still, bg });
  };
  /** 文字送りが終わった時。待っていたカットインを出す */
  const reveal = () => {
    const go = pending;
    pending = null;
    return go ? go() : null;
  };
  /** 次の行へ進むとき・自分から消えるとき。型ごとの動きで消える（動きを減らす設定では即座に消す） */
  const leave = ({ still = false } = {}) => {
    pending = null;
    const n = node;
    if (timer !== null) cancel(timer);
    timer = null;
    if (!n) return;
    node = null;
    const kind = KINDS[n.dataset.kind];
    const parts = [...layer.children];
    if (still || !kind) { for (const p of parts) drop(p); return; }
    for (const p of parts) p.classList.add("leave");
    n.dataset.leave = kind.leave;
    schedule(() => { for (const p of parts) drop(p); }, LEAVE_MS[kind.leave] || 0);
  };
  return { show, reveal, leave, clear };
}
