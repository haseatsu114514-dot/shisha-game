// 縦画面レイアウト3案の見本（2026-11-27・#4134）。
// 「上に絵・真ん中にテロップ・下にパッドや操作パネル」を、同じ4場面（地図・会話・返事・シーシャ作り）で見比べる。
// 絵・立ち絵・台詞は本編の素材を読むだけ。本編の進行・判定・保存は呼ばない。
// 一覧（PC）: index.html　／　1台を画面いっぱい（スマホ）: index.html?view=play&design=a|b|c&scene=map|talk|choice|craft

// 絵は本編が表示に使う WebP 版（remake/img/）を読む。元の PNG（assets/ 側）は公開時に外れるので直接書かない
// （書くと remake/tools/slim_deploy.py が「直接の参照」として元PNGを公開物に残してしまう）。
const REMAKE_IMG = new URL("../../img/", import.meta.url).href;
const IMG = {
  map: `${REMAKE_IMG}backgrounds/bg_osu_map_day.webp`,
  shop: `${REMAKE_IMG}backgrounds/peppermint.webp`,
  mintoWink: `${REMAKE_IMG}sprites/characters/minto/chr_minto_wink.webp`,
  mintoSmile: `${REMAKE_IMG}sprites/characters/minto/chr_minto_smile.webp`,
  faceMinto: `${REMAKE_IMG}ui/face_icons/face_minto.webp`,
  faceSumi: `${REMAKE_IMG}ui/face_icons/face_sumi.webp`,
  craftBg: `${REMAKE_IMG}backgrounds/bg_tonari_inside_day.webp`,
  craftActor: `${REMAKE_IMG}ui/making/hajime_craft_pull.webp`,
  leaf: `${REMAKE_IMG}ui/making/ui_mockup_flavor_leaf.webp`,
  smoke: `${REMAKE_IMG}ui/making/smoke_thick.webp`,
  thumbTonari: `${REMAKE_IMG}backgrounds/bg_tonari_inside_day.webp`,
  thumbNaru: `${REMAKE_IMG}backgrounds/kemurikusa.webp`,
  thumbAdam: `${REMAKE_IMG}backgrounds/bg_eden_shop.webp`,
  thumbShop: `${REMAKE_IMG}backgrounds/bg_fookah_showroom.webp`,
  thumbHome: `${REMAKE_IMG}backgrounds/bg_home_day.webp`,
  ...(globalThis.PORTRAIT_LAYOUT_ASSETS || {}),
};

// 第1章 DAY5 昼の橙須（座標は remake/js/daily/spots.js と同じ。地図の絵に対する %）
const SPOTS = [
  { id: "tonari", label: "tonari", area: "バイト先", x: 86, y: 36, who: "スミさん 在店", fee: "バイト・練習", mark: "!", thumb: "thumbTonari" },
  { id: "naru", label: "KEMURIKUSA", area: "商店街の外れ", x: 70, y: 24, who: "なる 在店", fee: "料金 ¥3,000", mark: "!", thumb: "thumbNaru" },
  { id: "adam", label: "EDEN", area: "下町", x: 46, y: 48, who: "本日定休日", fee: "休み", closed: true, thumb: "thumbAdam" },
  { id: "minto", label: "PEPPERMINT", area: "繁華街", x: 32, y: 59, who: "みんと 在店", fee: "料金 ¥3,000", mark: "!", thumb: "shop", face: "faceMinto" },
  { id: "shop", label: "Dr.fookah", area: "問屋街", x: 36, y: 30, who: "1階は時間消費なし", fee: "仕入れ", thumb: "thumbShop" },
  { id: "kannon", label: "観音堂", area: "古町", x: 18, y: 57, who: "盤は時間消費なし", fee: "心得の盤" },
  { id: "rest", label: "家", area: "自宅", x: 89, y: 44, who: "自宅で休む", fee: "体力回復", thumb: "thumbHome" },
];
const DEFAULT_SPOT = 3;

// data/dialogue/ch1_minto.json の ch1_minto_first から
const LINES = [
  { who: "みんと", en: "MINTO", face: "mintoWink", text: "ご指名ありがとうございますっ♡ 今日はみんとに任せてね？" },
  { who: "はじめ", en: "HAJIME", face: "mintoWink", inner: true, text: "（この声……どこかで聞いたような。店の音でよく分からない）" },
  { who: "みんと", en: "MINTO", face: "mintoWink", text: "初めてのお客様には、みんとイチ推しの『フラミンゴ・ピーチ』っ♡ 甘くてカワイイの！" },
];
const QUESTION = { who: "みんと", en: "MINTO", face: "mintoSmile", text: "はじめくん、どんなシーシャが好き？" };
const CHOICES = ["渋いの派です", "甘いのも、気になってます"];
const COACH = { who: "スミさん", en: "SUMI", text: "手元を見ているぞ。落ち着いていけ" };

const SCENES = ["map", "talk", "choice", "craft"];
const SCENE_LABEL = { map: "地図で行き先を選ぶ", talk: "会話を読む", choice: "返事を選ぶ", craft: "シーシャを作る（吸い出し）" };
const DESIGNS = [
  {
    id: "a", name: "真鍮のゲーム機",
    lead: "漆の黒紫と真鍮でできた携帯ゲーム機に見立てる案。絵は16:9のまま画面枠に収め、テロップは奥まった窓、下は十字キーと熾火（おきび）色のA・紫のBが並ぶ操作盤。場面が変わっても枠と指の位置が動かない。",
    points: [["絵", "16:9 固定。今の横画面をそのまま映せる"], ["テロップ", "奥まった窓に3〜4行。名札は真鍮の札"], ["操作", "十字キー＋A・B。補助キーは上の一列（ランプ付き）"], ["作る場面", "十字キーの場所が計器盤に替わる"]],
  },
  {
    id: "b", name: "喫茶の伝票",
    lead: "いまの「紙とラベンダー」を縦に伸ばす明るい案。絵は写真のように紙へ貼り、テロップは見出しタブの付いたメモ、返事は伝票。下は布のマットに陶器の十字キーと金のAボタン。",
    points: [["絵", "4:3。人物が大きく、地図は選んだ店へ寄る"], ["テロップ", "罫線のメモ。返事は伝票を一枚ずつ"], ["操作", "十字キー＋A。補助は荷札のタグ"], ["作る場面", "マットの上に紙のメーターを置く"]],
  },
  {
    id: "c", name: "煙の舞台",
    lead: "枠を作らず、絵を画面の半分以上に広げる案。下端を煙でぼかしてテロップへつなぎ、人物を一番大きく見せる。操作はすりガラスの輪とA。店ごとに光の色が変わる。",
    points: [["絵", "ほぼ正方形・枠なし。人物が最大"], ["テロップ", "ガラスの板を絵の裾に重ねる"], ["操作", "輪の十字キー＋A。補助は小さな札"], ["作る場面", "横いっぱいのメーターと大きな「吸う」"]],
  },
];

const esc = (value) => String(value).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const tri = () => `<svg viewBox="0 0 24 24" aria-hidden="true" class="tri"><path d="M12 5l8 13H4z" fill="currentColor"/></svg>`;

/* ───────── 3案で共有する部品 ───────── */

function pinsHtml(st) {
  return SPOTS.map((spot, i) => `
    <div class="pin${spot.closed ? " closed" : ""}" style="--mx:${spot.x}%;--my:${spot.y}%" data-spot="${i}" aria-current="${i === st.sel}">
      <i class="pin-ring"></i>
      <i class="pin-dot">${spot.closed ? "休" : spot.mark ? "!" : ""}</i>
      <span class="pin-flag">${esc(spot.label)}</span>
      <button class="pin-hit" data-act="spot" data-spot="${i}" aria-label="${esc(spot.label)}"></button>
    </div>`).join("");
}

function pictureHtml(st) {
  if (st.scene === "map") {
    return `<div class="map"><div class="map-pan"><img src="${IMG.map}" alt="橙須の地図">${pinsHtml(st)}</div></div>`;
  }
  if (st.scene === "craft") {
    return `<img class="bg" src="${IMG.craftBg}" alt=""><img class="actor" src="${IMG.craftActor}" alt="吸い出しをするはじめ">
      <img class="puff" src="${IMG.smoke}" alt="">
      <div class="thermo"><small>温度帯</small><span class="thermo-bar"><i class="thermo-now"></i></span></div>`;
  }
  const face = st.scene === "choice" ? QUESTION.face : LINES[st.line].face;
  return `<img class="bg" src="${IMG.shop}" alt=""><img class="chr" src="${IMG[face]}" alt="みんと">`;
}

function dpadHtml(st) {
  const live = st.scene === "map" ? "up down left right" : st.scene === "choice" ? "up down" : "";
  const key = (dir, label) => `<button class="dp dp-${dir}${live.includes(dir) ? " live" : ""}" data-act="dir" data-dir="${dir}" aria-label="${label}">${tri()}</button>`;
  return `<div class="dpad" role="group" aria-label="十字キー">${key("up", "上")}${key("left", "左")}${key("right", "右")}${key("down", "下")}<i class="dp-core"></i></div>`;
}

const A_LABEL = { map: "行く", talk: "次へ", choice: "決定", craft: "吸う" };
function aLabel(st) {
  if (st.scene === "map" && SPOTS[st.sel].closed) return "定休日";
  return A_LABEL[st.scene];
}
const aDisabled = (st) => st.scene === "map" && !!SPOTS[st.sel].closed;

// 半円のメーター。左が「下げ吸い」（温度を下げる）、右が「上げ吸い」。帯は本編の吸い出しと同じ並び。
function meterHtml() {
  const C = 100, RO = 92, RI = 60;
  const pt = (t, r) => { const a = Math.PI * (1 - t); return [C + r * Math.cos(a), C - r * Math.sin(a)]; };
  const band = (t0, t1, cls, style = "") => {
    const [x0, y0] = pt(t0, RO), [x1, y1] = pt(t1, RO), [x2, y2] = pt(t1, RI), [x3, y3] = pt(t0, RI);
    return `<path class="${cls}" ${style ? `style="${style}"` : ""} d="M${x0.toFixed(2)} ${y0.toFixed(2)}A${RO} ${RO} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}L${x2.toFixed(2)} ${y2.toFixed(2)}A${RI} ${RI} 0 0 0 ${x3.toFixed(2)} ${y3.toFixed(2)}Z"/>`;
  };
  const steps = (t0, t1, cls, n, from, to) => Array.from({ length: n }, (_, i) => band(t0 + (t1 - t0) * i / n, t0 + (t1 - t0) * (i + 1) / n + 0.002, cls, `--mix:${Math.round(from + (to - from) * i / (n - 1))}%`)).join("");
  const tick = (t) => { const [x0, y0] = pt(t, RO + 3), [x1, y1] = pt(t, RI - 3); return `<line class="tick" x1="${x0.toFixed(2)}" y1="${y0.toFixed(2)}" x2="${x1.toFixed(2)}" y2="${y1.toFixed(2)}"/>`; };
  return `<svg class="meter" viewBox="-6 -2 212 112" role="img" aria-label="吸い出しのメーター">
    <path class="m-bezel" d="M2 100A98 98 0 0 1 198 100L198 106L2 106Z"/>
    ${band(0, 0.13, "z z-cold")}${band(0.13, 0.2, "z z-keep")}${steps(0.2, 0.44, "z z-cool", 6, 100, 0)}
    ${band(0.44, 0.56, "z z-just")}${steps(0.56, 0.8, "z z-warm", 6, 0, 100)}${band(0.8, 0.87, "z z-keep")}${band(0.87, 1, "z z-hot")}
    ${[0.13, 0.2, 0.44, 0.56, 0.8, 0.87].map(tick).join("")}
    <path class="m-well" d="M${C - RI + 6} 100A${RI - 6} ${RI - 6} 0 0 1 ${C + RI - 6} 100Z"/>
    <g class="needle"><path d="M100 10L103.2 96L96.8 96Z"/></g>
    <circle class="m-hub" cx="100" cy="100" r="7"/><circle class="m-hub-dot" cx="100" cy="100" r="2.6"/>
  </svg>`;
}

const leavesHtml = () => `<span class="leaves">${`<img src="${IMG.leaf}" alt="">`.repeat(5)}</span>`;
const pullsHtml = (st) => `<span class="pulls">${Array.from({ length: 5 }, (_, i) => `<i class="${i < st.pulls ? "on" : ""}"></i>`).join("")}<b>${st.pulls}/5</b></span>`;
const fnKeys = (st) => st.scene === "map" ? [["lime", "LIME", "1"], ["menu", "MENU"]]
  : st.scene === "craft" ? [["help", "説明"], ["menu", "MENU"]]
  : [["log", "LOG"], ["auto", "AUTO"], ["skip", "SKIP"], ["terms", "用語"], ["config", "設定"]];
const place = (st) => st.scene === "map" ? ["第1章", "橙須"] : st.scene === "craft" ? ["tonari", "練習"] : ["PEPPERMINT", "繁華街"];

/* ───────── A案: 真鍮のゲーム機 ───────── */

function telopA(st) {
  if (st.scene === "map") {
    const spot = SPOTS[st.sel];
    return `<div class="a-name">行き先</div>
      <div class="a-dest${spot.closed ? " closed" : ""}">
        <div class="a-thumb">${spot.thumb ? `<img src="${IMG[spot.thumb]}" alt="">` : `<b>${esc(spot.label[0])}</b>`}</div>
        <div class="a-dest-main"><small>${esc(spot.area)}</small><b>${esc(spot.label)}</b><span>${esc(spot.who)}</span></div>
        <div class="a-dest-fee"><small>${st.sel + 1}/${SPOTS.length}</small><b>${esc(spot.fee)}</b></div>
      </div>
      <div class="a-rail">${SPOTS.map((s, i) => `<button class="a-chip${s.closed ? " closed" : ""}" data-act="spot" data-spot="${i}" aria-current="${i === st.sel}">${s.closed ? "<i>休</i>" : s.mark ? "<i>!</i>" : ""}${esc(s.label)}</button>`).join("")}</div>
      <div class="a-hint"><i></i>十字キーで店を選ぶ<i></i><b>A</b>で出発<i></i></div>`;
  }
  if (st.scene === "choice") {
    return `<div class="a-name">${QUESTION.who}</div><p class="a-text one">${esc(QUESTION.text)}</p>
      <div class="a-choices">${CHOICES.map((text, i) => `<button class="a-choice" data-act="pick" data-pick="${i}" aria-current="${i === st.pick}"><i>${i + 1}</i>${esc(text)}</button>`).join("")}</div>`;
  }
  if (st.scene === "craft") {
    return `<div class="a-name">${COACH.who}</div><img class="a-face" src="${IMG.faceSumi}" alt=""><p class="a-text with-face">${esc(COACH.text)}</p>
      <div class="a-step"><b>吸い出し</b><span>針が白い帯に来たら「吸う」</span></div>`;
  }
  const line = LINES[st.line];
  return `<div class="a-name${line.inner ? " inner" : ""}">${line.who}</div><p class="a-text${line.inner ? " inner" : ""}">${esc(line.text)}</p><i class="a-next"></i>`;
}

function deckA(st) {
  const foot = `<div class="a-foot"><i></i><span>SUIEN ZENSEN</span><i></i></div>`;
  if (st.scene === "craft") {
    return `<div class="a-gauge"><span class="lab l">▼ 下げ吸い</span><span class="lab r">上げ吸い ▲</span>${meterHtml()}</div>
      <div class="a-lamps"><span><small>フレーバーの持ち</small>${leavesHtml()}</span><span><small>吸い出し</small>${pullsHtml(st)}</span></div>
      <button class="a-serve" data-act="serve"><b>提供する</b><small>あと2口</small></button>
      <button class="btn-a craft" data-act="a"><span class="k">A</span><span class="t">${aLabel(st)}</span></button>${foot}`;
  }
  return `${dpadHtml(st)}
    <button class="btn-b" data-act="b"><span class="k">B</span><span class="t">戻る</span></button>
    <button class="btn-a" data-act="a" ${aDisabled(st) ? "disabled" : ""}><span class="k">A</span><span class="t">${aLabel(st)}</span></button>${foot}`;
}

function renderA(st) {
  const [p0, p1] = place(st);
  return `
    <div class="a-head"><div class="a-logo"><b>水煙前線</b><span>EN:CODE</span></div><div class="a-plate"><span>${p0}</span><i></i><span>${p1}</span></div></div>
    <div class="a-screen"><div class="pic" data-slot="pic">${pictureHtml(st)}</div><i class="a-glare"></i></div>
    <div class="a-status">
      <span class="c"><small>DAY</small><b>5</b><em>/14</em></span>
      <span class="c"><b class="jp">昼</b><small>雨</small></span>
      <span class="c"><small>行動</small><i class="pip on"></i><i class="pip on"></i></span>
      <span class="c"><small>体力</small><span class="bar" style="--v:80%"><i></i></span></span>
      <span class="c money"><small>¥</small><b>42,000</b></span>
    </div>
    <div class="a-telop" data-slot="telop">${telopA(st)}</div>
    <div class="a-fn" data-slot="fn">${fnKeys(st).map(([id, label, badge]) => `<button class="a-key${st[id] ? " on" : ""}" data-act="fn" data-fn="${id}"><i class="led"></i>${label}${badge ? `<em>${badge}</em>` : ""}</button>`).join("")}</div>
    <div class="a-deck${st.scene === "craft" ? " craft" : ""}" data-slot="deck">${deckA(st)}</div>`;
}

/* ───────── B案: 喫茶の伝票 ───────── */

function telopB(st) {
  if (st.scene === "map") {
    const spot = SPOTS[st.sel], prev = SPOTS[(st.sel + SPOTS.length - 1) % SPOTS.length], next = SPOTS[(st.sel + 1) % SPOTS.length];
    const paid = spot.fee.startsWith("料金 ");
    return `<div class="b-tab">行き先<small>${st.sel + 1}/${SPOTS.length}</small></div>
      <div class="b-near"><button data-act="dir" data-dir="left">‹ ${esc(prev.label)}</button><i></i><button data-act="dir" data-dir="right">${esc(next.label)} ›</button></div>
      <div class="b-card b-dest${spot.closed ? " closed" : ""}">
        <div class="b-thumb">${spot.thumb ? `<img src="${IMG[spot.thumb]}" alt="">` : `<b>${esc(spot.label[0])}</b>`}</div>
        <div class="b-dest-main"><small>${esc(spot.area)}</small><b>${esc(spot.label)}</b>
          <span class="b-who">${spot.face ? `<img src="${IMG[spot.face]}" alt="">` : ""}${esc(spot.who)}</span></div>
        <div class="b-fee"><span>${paid ? "料金" : "メモ"}</span><i></i><b>${esc(paid ? spot.fee.slice(3) : spot.fee)}</b></div>
        ${spot.closed ? `<i class="b-closed">定休日</i>` : ""}
      </div>`;
  }
  if (st.scene === "choice") {
    return `<div class="b-tab">${QUESTION.who}</div>
      <div class="b-card b-ask"><p class="b-text">${esc(QUESTION.text)}</p>
        <div class="b-slips">${CHOICES.map((text, i) => `<button class="b-slip" data-act="pick" data-pick="${i}" aria-current="${i === st.pick}"><i>${["一", "二"][i]}</i><span>${esc(text)}</span><em></em></button>`).join("")}</div>
      </div>`;
  }
  if (st.scene === "craft") {
    return `<div class="b-tab">${COACH.who}</div>
      <div class="b-card b-coach"><img class="b-face" src="${IMG.faceSumi}" alt=""><p class="b-text">${esc(COACH.text)}</p>
        <div class="b-step"><b>吸い出し</b><span>針が白い帯に来たら「吸う」</span></div></div>`;
  }
  const line = LINES[st.line];
  return `<div class="b-tab${line.inner ? " inner" : ""}">${line.who}</div>
    <div class="b-card"><p class="b-text${line.inner ? " inner" : ""}">${esc(line.text)}</p><i class="b-next"></i></div>`;
}

function matB(st) {
  const tags = `<div class="b-tags">${fnKeys(st).map(([id, label, badge]) => `<button class="b-tag${st[id] ? " on" : ""}${id === "lime" ? " lime" : ""}" data-act="fn" data-fn="${id}">${label}${badge ? `<em>${badge}</em>` : ""}</button>`).join("")}</div>`;
  if (st.scene === "craft") {
    return `${tags}<div class="b-gauge"><span class="lab l">下げ吸い</span><span class="lab r">上げ吸い</span>${meterHtml()}</div>
      <div class="b-lamps"><span><small>フレーバーの持ち</small>${leavesHtml()}</span><span><small>吸い出し</small>${pullsHtml(st)}</span></div>
      <button class="b-serve" data-act="serve"><b>提供する</b><small>あと2口</small></button>
      <button class="btn-a craft" data-act="a"><span class="t">${aLabel(st)}</span><span class="k">A</span></button>`;
  }
  return `${tags}${dpadHtml(st)}<button class="btn-a" data-act="a" ${aDisabled(st) ? "disabled" : ""}><span class="t">${aLabel(st)}</span><span class="k">A</span></button>`;
}

function renderB(st) {
  const [p0, p1] = place(st);
  return `
    <div class="b-paper">
      <div class="b-head">
        <div class="b-stamp"><small>DAY</small><b>5</b><em>昼・雨</em></div>
        <div class="b-title"><b>水煙前線</b><span>EN:CODE</span></div>
        <div class="b-where"><small>${p0}</small><b>${p1}</b></div>
      </div>
      <div class="b-photo"><div class="pic" data-slot="pic">${pictureHtml(st)}</div><i class="b-tape l"></i><i class="b-tape r"></i></div>
      <div class="b-ledger">
        <span><small>所持金</small><b>¥42,000</b></span>
        <span><small>体力</small><span class="bar" style="--v:80%"><i></i></span></span>
        <span><small>行動</small><b>のこり 2</b></span>
      </div>
      <div class="b-telop" data-slot="telop">${telopB(st)}</div>
    </div>
    <div class="b-mat${st.scene === "craft" ? " craft" : ""}" data-slot="deck">${matB(st)}</div>`;
}

/* ───────── C案: 煙の舞台 ───────── */

function telopC(st) {
  if (st.scene === "map") {
    const spot = SPOTS[st.sel];
    return `<div class="c-name"><b>${esc(spot.label)}</b><span>${esc(spot.area)}</span></div>
      <div class="c-glass c-dest${spot.closed ? " closed" : ""}">
        <div class="c-who">${spot.face ? `<img src="${IMG[spot.face]}" alt="">` : `<i>${spot.closed ? "休" : esc(spot.label[0])}</i>`}<span>${esc(spot.who)}</span></div>
        <div class="c-fee"><b>${esc(spot.fee)}</b></div>
        <div class="c-dots">${SPOTS.map((s, i) => `<button data-act="spot" data-spot="${i}" aria-current="${i === st.sel}" aria-label="${esc(s.label)}"></button>`).join("")}</div>
      </div>`;
  }
  if (st.scene === "choice") {
    return `<div class="c-name"><b>${QUESTION.who}</b><span>${QUESTION.en}</span></div>
      <div class="c-glass"><p class="c-text">${esc(QUESTION.text)}</p></div>
      <div class="c-choices">${CHOICES.map((text, i) => `<button class="c-choice" data-act="pick" data-pick="${i}" aria-current="${i === st.pick}"><i></i>${esc(text)}</button>`).join("")}</div>`;
  }
  if (st.scene === "craft") {
    return `<div class="c-name"><img src="${IMG.faceSumi}" alt=""><b>${COACH.who}</b><span>${COACH.en}</span></div>
      <div class="c-glass"><p class="c-text">${esc(COACH.text)}</p><div class="c-step"><b>吸い出し</b><span>針が白い帯に来たら「吸う」</span></div></div>`;
  }
  const line = LINES[st.line];
  return `<div class="c-name${line.inner ? " inner" : ""}"><b>${line.who}</b><span>${line.en}</span></div>
    <div class="c-glass"><p class="c-text${line.inner ? " inner" : ""}">${esc(line.text)}</p><i class="c-next"></i></div>`;
}

function ctrlC(st) {
  const chips = `<div class="c-chips">${fnKeys(st).map(([id, label, badge]) => `<button class="c-chip${st[id] ? " on" : ""}" data-act="fn" data-fn="${id}">${label}${badge ? `<em>${badge}</em>` : ""}</button>`).join("")}</div>`;
  if (st.scene === "craft") {
    return `${chips}<div class="c-gauge"><span class="lab l">下げ吸い</span><span class="lab r">上げ吸い</span>${meterHtml()}</div>
      <div class="c-lamps"><span><small>フレーバーの持ち</small>${leavesHtml()}</span><span><small>吸い出し</small>${pullsHtml(st)}</span></div>
      <button class="c-serve" data-act="serve"><b>提供する</b><small>あと2口</small></button>
      <button class="btn-a craft" data-act="a"><span class="t">${aLabel(st)}</span><span class="k">A</span></button>`;
  }
  return `${chips}${dpadHtml(st)}<button class="btn-a" data-act="a" ${aDisabled(st) ? "disabled" : ""}><span class="t">${aLabel(st)}</span><span class="k">A</span></button>`;
}

function renderC(st) {
  const [p0, p1] = place(st);
  const amb = st.scene === "map" ? IMG.map : st.scene === "craft" ? IMG.craftBg : IMG.shop;
  return `
    <img class="c-amb" src="${amb}" alt="">
    <div class="c-pic pic" data-slot="pic">${pictureHtml(st)}</div>
    <i class="c-veil"></i><img class="c-smoke" src="${IMG.smoke}" alt="">
    <div class="c-hud">
      <div class="c-where"><b>${p0}</b><small>${p1}</small></div>
      <div class="c-stats"><span class="c-pill"><small>DAY</small><b>5</b><em>昼・雨</em></span><span class="c-pill"><span class="bar" style="--v:80%"><i></i></span><b>¥42,000</b></span></div>
    </div>
    <div class="c-body">
      <div class="c-telop" data-slot="telop">${telopC(st)}</div>
      <div class="c-ctrl${st.scene === "craft" ? " craft" : ""}" data-slot="deck">${ctrlC(st)}</div>
    </div>`;
}

const RENDER = { a: renderA, b: renderB, c: renderC };

/* ───────── 1台ぶんの動き ───────── */

class Phone {
  constructor(el, design, scene, { fixed = false } = {}) {
    this.el = el;
    el.lang = "ja"; // 文節で折り返す（word-break: auto-phrase）ために要る
    this.fixed = fixed; // 一覧では場面を固定し、その場面の中の操作だけ動かす
    this.st = { design, scene, sel: DEFAULT_SPOT, line: 0, pick: 0, pulls: 0, auto: false, skip: false };
    this.t0 = performance.now();
    el.addEventListener("click", (event) => this.onClick(event));
    this.render();
    this.tick = this.tick.bind(this);
    requestAnimationFrame(this.tick);
  }

  render() {
    const { el, st } = this;
    el.dataset.design = st.design;
    el.dataset.scene = st.scene;
    el.innerHTML = RENDER[st.design](st);
    this.pan(false);
  }

  /** 場面の中の変化は、テロップ・補助キー・操作盤だけ描き直す（絵は地図の移動を見せるために残す）。 */
  patch({ pic = false } = {}) {
    const next = document.createElement("div");
    next.innerHTML = RENDER[this.st.design](this.st);
    for (const fresh of next.querySelectorAll("[data-slot]")) {
      if (fresh.dataset.slot === "pic" && !pic) continue;
      this.el.querySelector(`[data-slot="${fresh.dataset.slot}"]`)?.replaceWith(fresh);
    }
    this.el.querySelectorAll(".pin").forEach((pin) => pin.setAttribute("aria-current", String(Number(pin.dataset.spot) === this.st.sel)));
    this.pan(true);
  }

  /** 地図が窓より広い案（B・C）では、選んだ店が窓の中に来るように横へ送る。 */
  pan(animate) {
    const view = this.el.querySelector(".map"), pan = this.el.querySelector(".map-pan");
    const rail = this.el.querySelector(".a-rail"), chip = rail?.querySelector('[aria-current="true"]');
    if (chip) rail.scrollTo({ left: chip.offsetLeft - (rail.clientWidth - chip.clientWidth) / 2, behavior: animate ? "smooth" : "instant" });
    if (!view || !pan) return;
    const spot = SPOTS[this.st.sel];
    const move = () => {
      const w = view.clientWidth, mw = pan.clientWidth;
      const x = Math.min(0, Math.max(w - mw, w / 2 - mw * spot.x / 100));
      if (!animate) pan.style.transition = "none";
      pan.style.transform = `translateX(${x}px)`;
      if (!animate) { pan.getBoundingClientRect(); pan.style.transition = ""; }
    };
    move();
    if (!animate) pan.querySelector("img").addEventListener("load", move, { once: true });
  }

  setScene(scene) {
    this.st.scene = scene;
    if (scene === "talk" && this.st.line > 2) this.st.line = 0;
    if (scene === "craft") this.st.pulls = 0;
    this.render();
  }

  onClick(event) {
    const hit = event.target.closest("[data-act]");
    if (!hit || !this.el.contains(hit)) {
      if (event.target.closest('[data-slot="telop"]') && this.st.scene === "talk") this.pressA();
      return;
    }
    const act = hit.dataset.act;
    if (act === "dir") this.move(hit.dataset.dir);
    else if (act === "spot") { this.st.sel = Number(hit.dataset.spot); this.patch(); }
    else if (act === "pick") { const same = this.st.pick === Number(hit.dataset.pick); this.st.pick = Number(hit.dataset.pick); this.patch(); if (same) this.pressA(); }
    else if (act === "a") this.pressA();
    else if (act === "serve") { if (!this.fixed) this.setScene("map"); }
    else if (act === "fn") { const id = hit.dataset.fn; if (id === "auto" || id === "skip") { this.st[id] = !this.st[id]; this.patch(); } }
  }

  move(dir) {
    const { st } = this;
    if (st.scene === "choice") {
      if (dir === "up" || dir === "down") { st.pick = (st.pick + (dir === "down" ? 1 : CHOICES.length - 1)) % CHOICES.length; this.patch(); }
      return;
    }
    if (st.scene !== "map") return;
    // 押した方向にある近い店へ。その方向に店が無ければ動かさない。
    const here = SPOTS[st.sel], vec = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir];
    let best = -1, bestScore = Infinity;
    SPOTS.forEach((spot, i) => {
      if (i === st.sel) return;
      const dx = (spot.x - here.x) * 16 / 9, dy = spot.y - here.y, dist = Math.hypot(dx, dy);
      const along = (dx * vec[0] + dy * vec[1]) / dist;
      if (along < 0.42) return;
      const score = dist / along ** 2;
      if (score < bestScore) { bestScore = score; best = i; }
    });
    if (best >= 0) { st.sel = best; this.patch(); }
  }

  pressA() {
    const { st } = this;
    if (aDisabled(st)) return;
    if (st.scene === "craft") {
      if (this.hold) return;
      st.pulls = Math.min(5, st.pulls + 1);
      this.hold = performance.now();
      this.el.classList.remove("puffing"); void this.el.offsetWidth; this.el.classList.add("puffing");
      this.patch();
      setTimeout(() => { this.hold = 0; if (st.pulls >= 5 && !this.fixed) this.setScene("map"); else if (st.pulls >= 5) { st.pulls = 0; this.patch(); } }, 700);
      return;
    }
    if (this.fixed) {
      if (st.scene === "talk") { st.line = (st.line + 1) % 2; this.render(); this.speak(); }
      return;
    }
    if (st.scene === "map") { st.line = 0; this.setScene("talk"); this.speak(); }
    else if (st.scene === "talk") {
      if (st.line === 0) { st.line = 1; this.render(); }
      else if (st.line === 1) this.setScene("choice");
      else this.setScene("craft");
    } else if (st.scene === "choice") { st.line = 2; st.scene = "talk"; this.render(); this.speak(); }
  }

  speak() {
    this.el.classList.remove("speaking"); void this.el.offsetWidth; this.el.classList.add("speaking");
  }

  /** 吸い出しの針を左右に振る（「吸う」を押した間は止める）。 */
  tick(now) {
    if (this.st.scene === "craft" && !this.hold) {
      const meter = this.el.querySelector(".meter");
      if (meter) meter.style.setProperty("--needle", `${(Math.sin((now - this.t0) / 620) * 76).toFixed(1)}deg`);
    }
    requestAnimationFrame(this.tick);
  }
}

/* ───────── ページ ───────── */

const params = new URLSearchParams(location.search);
const app = document.getElementById("app");
const root = document.documentElement;
let current = null; // 実機表示の1台

function showGallery() {
  current = null;
  root.dataset.view = "gallery";
  root.style.fontSize = "";
  app.innerHTML = `<main class="gallery">
    <h1 class="g-title">縦画面レイアウト 3案</h1>
    <p class="g-lead">縦に持って、上に絵・真ん中にテロップ・下にパッドや操作パネルを置く見た目の案です。3案とも同じ4場面（地図・会話・返事・シーシャ作り）で見比べられます。十字キーとAは実際に押せます。</p>
    <p class="g-note">絵・立ち絵・台詞は本編の素材、配置と部品が今回の案です。本編の進行や保存には触れません。「1台で開く」を押すと、その案がスマホの画面いっぱいに出ます。</p>
    ${DESIGNS.map((design) => `<section class="g-design" id="design-${design.id}">
      <header><h2><small>${design.id.toUpperCase()}案</small>${design.name}</h2>
        <a class="g-open" href="?view=play&design=${design.id}" data-go="play" data-design="${design.id}">1台で開く</a>
        <p>${design.lead}</p>
        <ul class="g-points">${design.points.map(([k, v]) => `<li><b>${k}</b>${v}</li>`).join("")}</ul></header>
      <div class="g-row">${SCENES.map((scene) => `<figure class="g-cell"><article class="phone" data-d="${design.id}" data-s="${scene}"></article><figcaption>${SCENE_LABEL[scene]}</figcaption></figure>`).join("")}</div>
    </section>`).join("")}
  </main>`;
  app.querySelectorAll(".phone").forEach((el) => new Phone(el, el.dataset.d, el.dataset.s, { fixed: true }));
  scrollTo(0, 0);
}

/** 1台を画面いっぱいに。幅 39rem・高さ 66rem 以上が入るよう、html の文字の大きさを画面に合わせる。 */
function fit() {
  if (!current) return;
  const box = app.getBoundingClientRect();
  const rem = Math.min(box.width / 39, box.height / 66);
  root.style.fontSize = `${rem}px`;
  current.el.style.height = `${Math.min(box.height, rem * 92)}px`;
  current.pan(false);
}

function showPlay(design = "a", scene = "map") {
  root.dataset.view = "play";
  const bare = params.has("bare");
  app.innerHTML = `<div class="stage"><article class="phone"></article>${bare ? "" : `<nav class="switch" aria-label="案の切り替え">
    ${DESIGNS.map((d) => `<button data-design="${d.id}" aria-pressed="${d.id === design}">${d.id.toUpperCase()}案</button>`).join("")}
    <button data-next>場面 ›</button><a href="?view=gallery" data-go="gallery">一覧</a></nav>`}</div>`;
  current = new Phone(app.querySelector(".phone"), design, scene);
  if (params.has("line")) current.st.line = Number(params.get("line")) || 0;
  if (params.has("sel")) current.st.sel = Number(params.get("sel")) || 0;
  fit();
  current.render();
  const nav = app.querySelector(".switch");
  if (!nav) return;
  let idle;
  const wake = () => { nav.classList.remove("idle"); clearTimeout(idle); idle = setTimeout(() => nav.classList.add("idle"), 2600); };
  wake();
  nav.addEventListener("click", (event) => {
    wake();
    const button = event.target.closest("button");
    if (!button || !current) return;
    if (button.dataset.design) {
      current.st.design = button.dataset.design;
      nav.querySelectorAll("[data-design]").forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
      current.render();
    } else if ("next" in button.dataset) current.setScene(SCENES[(SCENES.indexOf(current.st.scene) + 1) % SCENES.length]);
  });
}

app.addEventListener("click", (event) => {
  const go = event.target.closest("[data-go]");
  if (!go) return;
  event.preventDefault();
  if (go.dataset.go === "play") showPlay(go.dataset.design); else showGallery();
});
addEventListener("keydown", (event) => {
  if (!current) return;
  const dir = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" }[event.key];
  if (dir) { event.preventDefault(); current.move(dir); }
  else if (event.key === "Enter" || event.key === " " || event.key === "z") { event.preventDefault(); current.pressA(); }
});
addEventListener("resize", fit);

const wantPlay = params.get("view") === "play" || (params.get("view") !== "gallery" && matchMedia("(max-width: 720px)").matches);
if (wantPlay) {
  showPlay(DESIGNS.some((d) => d.id === params.get("design")) ? params.get("design") : "a", SCENES.includes(params.get("scene")) ? params.get("scene") : "map");
} else showGallery();
