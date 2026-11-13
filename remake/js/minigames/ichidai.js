// カードゲーム「一台勝負」の画面。規則は ichidai-rules.js、CPUは ichidai-ai.js、カードは ichidai-data.js。
// 本編の #stage（1280×720）か、試遊ページの host に重ねて開く。本編の保存・進行・体力にはここでは触らない
// （結果を返すだけ。記録は呼び出し側が確定する）。
//
// 画面の作り: 対面で卓を囲む見え方（2026-11-11 オーナー「ちょっと3D要素を入れたり、実際に対面でカードゲームしてる感が欲しい。
// のっぺり2dってよりはコンシューマーのカードゲームみたいに」）。重ねる順に
//   部屋（.ichi-room: 店の中）／相手の席（.ichi-seat: 相手のバストアップと、持っている手札の裏）／
//   卓（.ichi-view > .ichi-board: 奥行きを付けて傾けたプレイマット）／HUD（.ichi-table: 相手の点と熱・ラウンド・案内・ボタン・
//   自分の熱・自分の顔と点・扇形の手札・選んだ札の説明。準備のあいだはフレーバー場の棚）。
// マットは相手と自分で同じ並び（卓のまんなかで点対称。2026-11-11 オーナー「相手と自分が非対称なのが気になる」）:
//   奥＝相手の札／中央＝「相手の一口」・審査の山・「自分の一口」／手前＝自分の札（炭焼き場・ボウルとHMD・器具と人物・山札と灰）。
//   火力ゾーンは卓の端に縦に積む（自分は左端を手前から奥へ、相手は右端を奥から手前へ）。すぐ外側に熱の目盛り（主役の葉の
//   帯の色と★）が並ぶ（オーナー「判定のゲージと火力ゾーンは近づけたい。ダメージゾーンみたいに横において積み上げて火力にしてもいい」）。
//   第0.8版: 積んだ炭の高さが「火力」、目盛りの明るいところまでが「熱」。熱は、ターンの終わりに炭の高さへ1段ずつ近づく（蒸らし）。
//   卓の上の札は傾いて読みにくいので、数字と文は HUD に立てて出す。
// 札の移動（手札 → 火力ゾーン・炭焼き場・この一口）は、卓の上を飛んで置かれる。番が替わると、卓の見え方（カメラ）が少し動く。
// 火力ゾーン＝HMDの上の炭（第0.4版）。炭は4つまでで、炭そのものに火がある（新品のフラット炭2・キューブ炭3・裏向きの種火1）。
// 柱には炭の火の段数ぶん積み、合計が火力。火は弱るたびに下がるだけ（回復しない）。炭の焼け具合は、札の上の炭の絵の色で見せる
// （2026-11-11 オーナー「火力ゾーンにカードを裏向きで置いてカウントしてく感じ」「炭自体に火力をつける」「火力＝炭の数にはしない」）。
// 卓に出るものは、葉・ボウル（ハガル）・HMD・炭もふくめて全部「札」。マットに出すのは「いま打つ手に要るもの」だけにして、
// 詰めた葉・札の文・審査カードの内訳・相手の葉は、札や山をタップして開く（オーナー指示: ピックした葉は出さない・狭くしない）。
// 操作はタップだけ（カードや炭を選ぶ → 出てくるボタンを押す）。遊び方は「？」から開く。
// 絵は ichidai-art.js が引く（このゲーム用の絵 → 本編の正規の絵 → 仮の線画の順）。
//
// 案内（2026-11-11 オーナー「熱が冷めるのが自動で処理されなかったり」「急に消えたり」「あまりカード慣れてない人には自動でガイドが進み
// 遊びやすいよう。次何をすればいいか」）: 「ガイド」が入っているあいだ（既定）
//   ・ターンのはじめに炭が弱るのは、自動で進む（火の小さい炭から。CPUと同じ決め方。ガイドを切っても自動）。
//   ・「つぎ」に、いま打つとよい1手を出し、押す場所を光らせる。1手打つたびに次の手へ進む。「おすすめで進める」でその手を打てる。
//   ・炭が灰になる・火が下がる・器具が押し出されるときは、その場所に合図を出してから消す（何が起きたかは案内の札にも1行出す）。
//
// 4人対戦（1:1:1:1。2026-11-11 オーナー「みんなのやると狭くなるからライバルは簡易的にUIして表情やセリフメインに」）:
//   相手3人は、卓の奥にバストアップを並べる（表情・しぐさ・一言）。数字は顔の横の小さな札（点・票・熱と帯・葉・手札）だけ。
//   卓の奥には、相手ごとに炭（火力ゾーン）と仕込んだ一口のカードだけを置く。ボウル・HMD・器具・山札は出さない（顔をタップで開く）。
//   自分の側（手前の半分・火力ゾーン・手札）は1対1と同じ。
import { el } from "../core/util.js";
import { DB, faceFrame, portraitInfo, useManifest } from "../core/data.js";
import { portraitAsset } from "../core/portrait-resolver.js";
import { SE, unlockAudio } from "../core/audio.js";
import { KINDS, FLAVOR, CARD, BOWL, HMD, JUDGE, PUFFS, TOURNAMENTS, KITS, BASIC_KITS, INTRO, KIT, TYPE_LABEL, WHEN_LABEL, RARITIES, SERIES_SIZE, numberOf, rarityOf } from "./ichidai-data.js";
import { RULES, ZONE_LABEL, createGame, act, heatOf, leavesOf, firepower, sidesOf, slotsOf, roundsOf, sessionOf,
  judgedHeat, rawZone, scorchLineOf, scorePuff, impressionOf, puffPreview, unseenPuffs, packLimit,
  canPlay, canCharge, canPlace, canPutOn, canAsh, canPack, coalHeat, coalRoom, coalMaxOf, coolStepsOf, isTargeted, targetsOf, votePtsOf, fireOf, settledHeat, embersOf } from "./ichidai-rules.js";
import { aiAct } from "./ichidai-ai.js";
import { artUrl, flavorArt, cardArt, faceUrl, bowlArt, hmdArt, JUDGE_FACE , coalSprite } from "./ichidai-art.js";
import { HELP_PAGES, INTRO_HELP_PAGES, INTRO_WHY } from "./ichidai-help.js";
import { playVersus } from "./ichidai-versus.js";
import { attachIchidaiLines, loadIchidaiLines } from "./ichidai-lines.js";
import { faceParts } from "./ichidai-face.js";

export const ICHIDAI_TITLE = "一台勝負";
export const LEVELS = Object.freeze([{ id: 0, name: "やさしい" }, { id: 1, name: "ふつう" }, { id: 2, name: "つよい" }]);
const active = new WeakMap();
const sfx = (name) => { try { SE[name]?.(); } catch { /* 音は無くても遊べる */ } };
const sleep = (ms, signal) => new Promise((resolve) => { const t = setTimeout(resolve, ms); signal?.addEventListener("abort", () => { clearTimeout(t); resolve(); }, { once: true }); });
const ME = 0, CPU = 1;
const dhText = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "±0");
const zoneCls = (z) => (z === "offLo" || z === "offHi" ? "off" : z);
const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);

// ───────── 小さな部品 ─────────
/** 温度の帯（0〜10）を色だけで並べる。now に熱を渡すと、その位置に印を付ける */
function strip(flavorId, { now = null, line = null } = {}) {
  const f = FLAVOR[flavorId];
  return el("span.ichi-strip", { "aria-hidden": "true" }, Array.from({ length: 11 }, (_, h) =>
    el(`i.z-${zoneCls(rawZone(f, h, line ?? f.s))}`, { dataset: { now: h === now ? "1" : null } })));
}
const kindBadge = (kind) => el(`span.ichi-kind.k-${kind}`, { text: KINDS[kind].k, title: KINDS[kind].name });
/** 絵を置く。箱絵（mode:"box"）は元画像の中の箱の範囲だけを出す */
function artNode(art) {
  if (!art) return null;
  if (art.mode === "box") {
    const [iw, ih] = art.size, [x, y, w, h] = art.box;
    return el("span.ichi-boxart", { "aria-hidden": "true", style: { aspectRatio: `${w} / ${h}`, backgroundImage: `url("${art.url}")`,
      backgroundSize: `${(iw / w) * 100}% ${(ih / h) * 100}%`, backgroundPosition: `${iw === w ? 0 : (x / (iw - w)) * 100}% ${ih === h ? 0 : (y / (ih - h)) * 100}%` } });
  }
  return el(`img.ichi-artimg.m-${art.mode}`, { src: art.url, alt: "", draggable: "false", onerror: (e) => { e.currentTarget.style.visibility = "hidden"; } });
}
const flavorIcon = (id) => artNode(flavorArt(id)) || kindBadge(FLAVOR[id].kind);

// ───────── トレカの札 ─────────
// 卓に出るものは、葉・ボウル（ハガル）・HMD・炭もふくめて全部「札」。枠の組み（名前・コスト・絵・種類の行・文・番号とレア度）は
// ここで決め（左上の数字は、葉＝味値・ボウル＝容量・炭＝熱・ほかのカード＝必要火力）、色と質感は css/ichidai.css の .ichi-card（デザインが届いたら差し替える。docs/design/card_game/card_design_brief.md）。
// 大きさ: big=拡大（文と番号まで）/ hand=手札 / pile=準備の場の葉 / mid=マットのボウルとHMD / mini=マットの炭・器具 / far=卓の奥（相手の札）/ tiny=ごく小さい印
function cardView(kind, id) {
  if (kind === "flavor") {
    const f = FLAVOR[id];
    return { cls: `t-flavor.k-${f.kind}`, name: f.name, gem: { text: String(f.t), label: "味値", cls: "is-taste" }, art: flavorArt(id), glyph: KINDS[f.kind].k,
      line: [KINDS[f.kind].name, ""], text: [`適温${f.lo}〜${f.hi}／ジャスト${f.j.join("・") || "なし"}／焦げ${f.s > 10 ? "なし" : `${f.s}以上`}`, f.ab].filter(Boolean).join("\n"), strip: id };
  }
  if (kind === "bowl") {
    const b = BOWL[id];
    return { cls: "t-bowl", name: b.name, gem: { text: String(b.cap), label: "容量（g）", cls: "is-cap" }, art: { url: bowlArt(id, false), mode: "sprite" }, glyph: "器", line: ["ボウル", "ハガル"], text: b.ab };
  }
  if (kind === "hmd") {
    const h = HMD[id];
    return { cls: "t-hmd", name: h.name, gem: null, art: { url: hmdArt(id), mode: "sprite" }, glyph: "蓋", line: ["HMD", ""], text: h.ab };
  }
  const c = CARD[id], coal = c.type === "coal";
  return { cls: `t-${c.type}${c.when ? `.w-${c.when}` : ""}`, name: c.name, pay: payLabel(c),
    gem: coal ? { text: String(c.heat), label: "熱", cls: "is-heat" } : { text: String(c.need ?? 0), label: "必要な熱", cls: "is-cost", title: `熱${c.need ?? 0}以上で使える` },
    art: cardArt(id), glyph: TYPE_LABEL[c.type].slice(0, 1), line: coal ? ["炭", `着火${c.ig}`] : [TYPE_LABEL[c.type], WHEN_LABEL[c.when]], text: c.tx };
}
/** 使うために落とすものの短い印（札の左上）と、詳しい言い方 */
function payLabel(c) {
  if (c.pay?.fire) return { short: `熱−${c.pay.fire}`, long: `熱を${c.pay.fire}落として使う` };
  if (c.pay?.leaf) return { short: `葉−${c.pay.leaf}`, long: `葉を${c.pay.leaf}枚減らして使う` };
  return null;
}
export function tcg(kind, id, { size = "hand" } = {}) {
  const v = cardView(kind, id), rar = rarityOf(kind, id), big = size === "big", small = size === "mini" || size === "tiny" || size === "far";
  return el(`div.ichi-card.s-${size}.${v.cls}.r-${rar}`, { dataset: { card: id, kind } }, [
    el("div.ichi-card-head", [
      v.gem ? el(`span.ichi-gem.${v.gem.cls}`, { title: v.gem.title || `${v.gem.label} ${v.gem.text}` }, el("b", { text: v.gem.text })) : null,
      v.pay ? el("span.ichi-pay", { title: v.pay.long, text: v.pay.short }) : null,
      small ? null : el(`b.ichi-card-name${tightName(v.name) ? ".is-tight" : ""}`, { text: breakable(v.name), "aria-label": v.name })]),
    el(`div.ichi-card-art.m-${v.art?.mode || "none"}`, [artNode(v.art) || el("span.ichi-glyph", { text: v.glyph }), small ? null : el("i.ichi-rar", { title: RARITIES[rar].name, text: RARITIES[rar].mark })]),
    small ? null : el("div.ichi-card-line", [el("span.ichi-line-type", { text: v.line[0] }), v.line[1] ? el("span.ichi-line-sub", { text: v.line[1] }) : null]),
    v.strip && !small ? strip(v.strip) : null,
    big ? el("p.ichi-card-text", { text: v.text || "効果なし。" }) : null,
    big ? el("div.ichi-card-foot", [el("span", { text: `No.${String(numberOf(kind, id)).padStart(3, "0")}/${String(SERIES_SIZE).padStart(3, "0")}` }), el("span", { text: `${RARITIES[rar].name}・一台勝負` })]) : null,
  ]);
}
// 札の名前の折り目: カタカナの長い名前は、語の切れ目（クール｜ミント）で折れるよう、見えない折り目（ゼロ幅スペース）を入れる。
// 折り目が無いと、枠に入りきらないときに最後の1文字だけ次の行へ落ちる（クールミン／ト）
const NAME_HEADS = /(クール|チョコ|80beat|素焼き|トング|アイス|デスバイ|ダブル|アマ|ホワイト|ビッグ|タヌキッシュ|高密度|雲窯|ファンネル|スプリング|シリコン|ブラック|キッチン|ブルー|ロートス|フラット|キューブ)(?=.)/g;
// 折り目のうしろに1文字しか残らないところ（フラット｜炭・キューブ｜炭）には入れない（「炭」だけが次の行へ落ちる）
const breakable = (name) => name.replace(NAME_HEADS, (head, _h, at) => (name.length - (at + head.length) <= 1 ? head : `${head}\u200b`));
/** 「フラット炭」「キューブ炭」で終わる名前は、手札の札で1行に収まるよう、字を少し詰める */
const tightName = (name) => /(フラット|キューブ)炭$/.test(name);
/** 炭1つの言い方（名前と、いまの火） */
const coalLabel = (c) => (c.up ? `${CARD[c.id].name}（火${coalHeat(c)}）` : "種火（火1）");
// 炭の焼け具合（2026-11-13 オーナー「炭が焼けても色変わらないの気になる」）: 札の上に、いまの状態の炭の絵を重ねる。
//   炭焼き場: 置いたばかり＝黒い（cold）→ 火がまわる＝赤くなりかけ（warm）→ 焼けた＝全体が赤く光る（hot）
//   火力ゾーン: 新品の火＝赤く光る（hot）→ 弱った＝赤黒い（warm）→ 火1＝白く灰をかぶる（ember。次に弱ると灰になる）
const STOVE_STATE = ["cold", "warm", "hot"];
/** 火力ゾーンの炭の状態（表向きの炭カードだけ。種火は札の裏のまま） */
const coalState = (c) => { const lv = coalHeat(c); return lv >= CARD[c.id].heat ? "hot" : lv >= 2 ? "warm" : "ember"; };
/** 炭の絵（キューブ炭は立方体、フラット炭・高密度フラット炭は平たい炭） */
const coalGlow = (id, state) => el(`img.ichi-coal-sprite.is-${state}`, { src: coalSprite(id === "cube" ? "cube" : "flat", state), alt: "", draggable: "false", "aria-hidden": "true",
  onerror: (e) => { e.currentTarget.style.visibility = "hidden"; } });
/** 火力ゾーンの札（表向き＝のせた炭カード、裏向き＝チャージした種火）。fresh＝置いたばかり（動きを付ける）。glow＝炭の絵を札の上に重ねる */
function coalCard(c, { size = "mini", fresh = false, glow = false } = {}) {
  const worn = c.up && coalHeat(c) < CARD[c.id].heat;
  return el(`span.ichi-on${c.up ? `.is-up.s-${coalState(c)}` : ".is-ember"}${worn ? ".is-worn" : ""}${fresh ? ".is-new" : ""}`, { title: coalLabel(c) },
    [c.up ? tcg("card", c.id, { size }) : el(`i.ichi-back.s-${size}`), glow && c.up ? coalGlow(c.id, coalState(c)) : null]);
}
function faceNode(charId, name, cls = "") {
  const url = faceUrl(charId);
  const blank = () => el(`span.ichi-face.is-blank${cls}`, { text: name.slice(0, 1) });
  return url ? el(`img.ichi-face${cls}`, { src: url, alt: "", draggable: "false", onerror: (e) => { e.currentTarget.replaceWith(blank()); } }) : blank();
}
/** プレイマットの枠（名前の札つき） */
const zoneBox = (label, cls, attrs, children) => el(`div.ichi-zone-box${cls}`, { title: label, ...attrs }, [el("small.ichi-zone-tab", { text: label }), ...[].concat(children)]);

/**
 * @param host 重ねる要素（既定: #stage）
 * @param config 対戦の設定 { kit, opponentKit, tournament, level }。省くと設定の画面から始まる
 * @param opponent 相手の見せ方 { id（顔アイコンのキャラID）, name }
 * @param opponents 4人対戦の相手たち [{ id, name }, …]（3人いれば、設定の画面で「4人」を選べる。先頭は1対1の相手）
 * @param tutorial はじめに遊び方を開くか
 * @param pilot テスト・デモ用: "cpu" にすると自分の席もCPUが打つ
 * @param speed CPUの手と演出の早回し
 * @param assist 案内（次にすること・自動で冷める）を入れて始めるか。右上の「ガイド」でいつでも切り替えられる
 * @param skin 見た目の案の名前（デザインの見比べ用）。root に data-skin が付き、css/ichidai-skin-<名前>.css の決まりが効く
 * 戻り値: { completed, cancelled, games:[{ winner（0=自分/1〜=相手の席/null=引き分け）, scores, votes, tournament, kit, level, players, rank }], last }
 */
export function runIchidai({ host = document.getElementById("stage"), signal = null, seed = null, config = null, opponent = null,
  tutorial = false, pilot = null, speed = 1, allowRetry = true, skin = null, opponentKit = null, opponents = null, assist = true } = {}) {
  if (!host?.isConnected) return Promise.reject(new Error("Connected game host required"));
  if (active.has(host)) return active.get(host);
  const games = [];
  const summary = (completed) => ({ completed, cancelled: !completed, games: games.map((g) => ({ ...g })), last: games.length ? { ...games.at(-1) } : null });
  if (signal?.aborted) return Promise.resolve(summary(false));
  let finish;
  const promise = new Promise((resolve) => { finish = resolve; });
  active.set(host, promise);

  const previousFocus = document.activeElement;
  const ctrl = new AbortController();
  const dead = () => ctrl.signal.aborted;
  let G = null, cfg = config ? { ...config } : null;
  let pending = null;            // 人の入力を待つ Promise の resolve
  const ui = { sel: null, picks: new Set(), counts: {}, note: "", toast: "", fast: false, sheet: null, peek: null, lastLog: 0, turnKey: null, moods: {}, feed: [], assist: assist !== false, last: "", heatSeen: null };
  // 相手になれる人たち（先頭が1対1の相手）。info[席の番号] ＝ その席の人（0 は自分）
  const pool = (opponents?.length ? opponents : [opponent]).filter(Boolean).slice(0, 3).map((o) => ({ id: o.id || null, name: o.name || "相手" }));
  if (!pool.length) pool.push({ id: null, name: "相手" });
  const foe = pool[0];
  let info = [{ id: "hajime", name: "はじめ" }, foe];
  /** 相手の席の番号（1対1なら [1]、4人なら [1, 2, 3]） */
  const rivalIds = () => info.slice(1).map((_, k) => k + 1);
  const multi = () => info.length > 2;

  const root = el("section.ichi-game", { role: "dialog", "aria-modal": "true", "aria-label": ICHIDAI_TITLE, tabindex: "-1", dataset: { test: "ichi-game", phase: "setup" } });
  if (skin) root.dataset.skin = skin;
  // 部屋・相手の席・卓は作り直さない（番が替わったときの見え方の動きと、相手の息づかいを切らさないため）。中身だけ差し替える
  const room = el("div.ichi-room", { "aria-hidden": "true" }, [el("i.ichi-haze"), el("i.ichi-haze")]);
  // 相手の席（1対1は卓の向こうに1つ。4人対戦は3つ並べ、顔の横に小さな札を付ける）。seats[席の番号]
  // .ichi-say-anchor＝相手の顔のあたり。相手の一言（ichidai-lines.js）の吹き出しを、ここへ向けて出す
  let seats = {}, talkers = {};
  const seatLayer = el("div.ichi-seats");
  function makeSeat(i, k, rival) {
    const bust = el("span.ichi-seat-bust"), hand = el("span.ichi-seat-hand"), plate = rival ? el("span.ichi-rival-plate") : null;
    const node = el(`button.ichi-seat${rival ? `.is-rival.r-${k}` : ""}`, { type: "button", dataset: { test: rival ? `ichi-seat-${i}` : "ichi-seat", seat: String(i) },
      onclick: () => { if (G && !G.over) { sfx("select"); openRig(G.P[i], false); } } },
      [el("i.ichi-seat-fx", { "aria-hidden": "true" }), bust, el("i.ichi-say-anchor", { "aria-hidden": "true" }), hand, plate]);
    return { i, node, bust, hand, plate, key: null, motionTimer: 0, talkTimer: 0, blinkTimer: 0 };
  }
  /** 席と、その席の一言を作り直す（対戦のはじめ。人数が変わることがある） */
  function buildSeats() {
    for (const t of Object.values(talkers)) t.clear();
    for (const st of Object.values(seats)) { clearTimeout(st.motionTimer); clearTimeout(st.talkTimer); clearTimeout(st.blinkTimer); }
    seats = {}; talkers = {};
    const rival = multi();
    rivalIds().forEach((i, k) => {
      seats[i] = makeSeat(i, k, rival);
      // 対戦中、相手が一言しゃべる（2026-11-11 オーナー「対戦中は相手にセリフとか言わせたい」。台詞は data/dialogue/ichidai_lines.json）。
      // 一言に表情が付いていれば、相手の顔もそれに替える。早送りと CPU に打たせているあいだは出さない
      talkers[i] = attachIchidaiLines({ root, charId: info[i].id, foe: i, quick: () => ui.fast || pilot === "cpu", place: rival ? "below" : "side",
        anchor: () => seats[i]?.node.querySelector(".ichi-say-anchor"),
        onLine: (line) => { if (line.face && G) { setMood(i, line.face); renderSeat(G.P[i]); } talk(line.text, i); } });
    });
    root.dataset.players = String(info.length);
    seatLayer.replaceChildren(...Object.values(seats).map((st) => st.node));
  }
  const board = el("div.ichi-board", { dataset: { test: "ichi-board" } });
  const view = el("div.ichi-view", board);
  const table = el("div.ichi-table");
  const sheet = el("div.ichi-sheet", { hidden: true });
  const live = el("p.ichi-live", { role: "status", "aria-live": "polite" });
  const fastBtn = el("button.ichi-round-btn.ichi-fast", { type: "button", hidden: true, "aria-label": "早送り", title: "早送り", "aria-pressed": "false", dataset: { test: "ichi-fast" },
    onclick: () => { ui.fast = !ui.fast; fastBtn.setAttribute("aria-pressed", String(ui.fast)); sfx("click"); } }, el("span", { text: "▶▶" }));
  const assistBtn = el("button.ichi-assist-btn", { type: "button", "aria-label": "ガイド（次にすることの案内）", title: "ガイド：次にすることを案内する", "aria-pressed": String(ui.assist), dataset: { test: "ichi-assist" },
    onclick: () => { ui.assist = !ui.assist; assistBtn.setAttribute("aria-pressed", String(ui.assist)); sfx("click"); if (G && !G.over) { render(); if (ui.assist && pending && G.wait?.type === "cool" && human(G.wait.player)) submit(aiAct(G, ME)); } } }, [el("span", { text: "ガイド" }), el("b")]);
  const head = el("div.ichi-head-buttons", [assistBtn, fastBtn,
    el("button.ichi-round-btn", { type: "button", "aria-label": "遊び方", dataset: { test: "ichi-help" }, onclick: () => { sfx("select"); openHelp(); } }, el("span", { text: "？" })),
    el("button.ichi-round-btn", { type: "button", "aria-label": "やめる", dataset: { test: "ichi-close" }, onclick: () => { sfx("cancel"); askQuit(); } }, el("span", { text: "✕" })),
  ]);
  root.append(room, seatLayer, view, table, head, sheet, live);
  host.append(root);
  loadIchidaiLines(); // 台詞は先に読んでおく（席は対戦のはじめに作る）
  buildSeats();
  const arm = () => unlockAudio();
  root.addEventListener("pointerdown", arm); root.addEventListener("keydown", arm);
  // このゲーム用の卓・裏面の絵があれば差し替える（無ければ CSS の既定＝本編の夜紫UIの部品）
  for (const [name, kind, id] of [["--ichi-mat", "table", "mat"], ["--ichi-back-art", "back", "deck"], ["--ichi-judge-back-art", "back", "judge"]]) {
    const url = artUrl(kind, id);
    if (url) root.style.setProperty(name, `url("${url}")`);
  }

  // ───────── 相手の動き（席のバストアップに、しぐさ・手の動き・気持ちの動きを付ける） ─────────
  // 2026-11-11 オーナー「シャドウバースみたいに相手キャラに動きや躍動感が欲しい」。立ち絵は1枚絵なので、体の傾き・跳ね・
  // 身の乗り出し・ゆれと、頭のそばに出す気持ちのしるしで動きを出す（見た目は css/ichidai.css の「相手の動き」の節）。
  // 規則にも保存にも触れない。早送り・CPU同士の自動対戦・動きを減らす設定では動かさない
  const MOTION_MS = { play: 640, reach: 440, joy: 920, shock: 760, down: 1000, flinch: 520, talk: 1300, lean: 560, pop: 280, tilt: 1500, nod: 950, look: 1700 };
  const SMALL_MOTION = ["tilt", "nod", "look", "talk", "pop", "lean"]; // ほかの動きの最中には重ねない小さな動き
  let fidgetTimer = 0;
  const calm = () => ui.fast || pilot === "cpu" || matchMedia("(prefers-reduced-motion: reduce)").matches;
  /** 相手 i の席を動かす（i を省くと、1対1の相手） */
  function seatMotion(kind, i = CPU) {
    const st = seats[i], seat = st?.node;
    if (calm() || !seat?.isConnected || (seat.dataset.motion && SMALL_MOTION.includes(kind))) return;
    clearTimeout(st.motionTimer);
    seat.removeAttribute("data-motion"); void seat.offsetWidth; seat.dataset.motion = kind; // 同じ動きを続けて出すときも、頭からやり直す
    st.motionTimer = setTimeout(() => seat.removeAttribute("data-motion"), MOTION_MS[kind] / speed);
  }
  /** 気持ちのしるし（頭のそばに出て消える）: spark＝きらめき／sweat＝汗／note＝♪／bang＝！／gloom＝どんより */
  function emote(kind, i = CPU) {
    const seat = seats[i]?.node;
    if (calm() || !seat?.isConnected) return;
    const parts = { spark: [el("b"), el("b"), el("b")], sweat: [el("b"), el("b")], gloom: [el("b"), el("b"), el("b")], note: [el("b", { text: "♪" })], bang: [el("b", { text: "！" })] }[kind];
    const node = el(`i.ichi-emote.is-${kind}`, { "aria-hidden": "true", dataset: { test: "ichi-emote", kind } }, parts);
    seat.append(node);
    setTimeout(() => node.remove(), 1300 / speed);
  }
  /** ときどき小さなしぐさ（首をかしげる・うなずく・手札を見る）。対戦のあいだ、不ぞろいな間隔で続ける */
  function fidget() {
    clearTimeout(fidgetTimer);
    fidgetTimer = setTimeout(() => {
      if (dead()) return;
      const ids = rivalIds();
      if (G && !G.over && !ui.sheet && root.dataset.phase !== "setup") seatMotion(["tilt", "nod", "look"][Math.floor(Math.random() * 3)], ids[Math.floor(Math.random() * ids.length)]);
      fidget();
    }, (4200 + Math.random() * 3800) / Math.sqrt(Math.max(1, rivalIds().length))); // 相手が多いほど、だれかが動く間隔は短い
  }
  /** まばたき: 数秒おきに、まぶたを一瞬閉じる（たまに2回続ける）。目の位置が分かる表情のときだけ見える */
  function blink() { for (const st of Object.values(seats)) blinkLoop(st); }
  function blinkLoop(st) {
    clearTimeout(st.blinkTimer);
    st.blinkTimer = setTimeout(() => {
      const seat = st.node;
      if (dead() || seats[st.i] !== st) return;
      if (!calm() && seat.isConnected && root.dataset.phase !== "setup") {
        const once = (delay) => setTimeout(() => { seat.classList.add("is-blink"); setTimeout(() => seat.classList.remove("is-blink"), 130); }, delay);
        once(0); if (Math.random() < 0.22) once(300);
      }
      blinkLoop(st);
    }, 2300 + Math.random() * 3400);
  }
  /** しゃべる: 台詞の長さのぶんだけ、口を動かす */
  function talk(text = "", i = CPU) {
    seatMotion("talk", i);
    const st = seats[i], seat = st?.node;
    if (calm() || !seat?.isConnected) return;
    clearTimeout(st.talkTimer);
    seat.classList.add("is-talking");
    st.talkTimer = setTimeout(() => seat.classList.remove("is-talking"), Math.min(2000, 420 + String(text).length * 95) / speed);
  }
  /** 審査の結果への反応（相手ごと）: 焦げたらのけぞる／ジャストや一票なら跳ねる／はじめに一票を取られたら沈む */
  function reactToScore(ev) {
    for (const i of rivalIds()) {
      const r = ev.res[i];
      if (r.zone === "scorch") { seatMotion("shock", i); emote("sweat", i); }
      else if (r.zone === "just" || ev.voter === i) { seatMotion("joy", i); emote(r.zone === "just" ? "spark" : "note", i); }
      else if (ev.voter === ME) { seatMotion("down", i); emote("gloom", i); }
      else seatMotion("nod", i);
    }
  }
  /**
   * 出来事に、相手が一言しゃべる。1対1は、その相手。4人対戦は、1つの出来事で喋るのは1人だけ:
   * カードを使った本人／審査は焦げ・ジャスト・一票の当人（いなければ、だれか1人）／勝ち負けは勝った相手（はじめが勝ったら、相手のいちばん上）。
   * 対戦の始めだけは、3人が順にひとことずつ。戻り値は、出した一言（face に表情）と、だれが喋ったか（by）
   */
  function speak(ev) {
    const ids = rivalIds();
    if (ids.length === 1) { const line = talkers[ids[0]]?.event(ev) || null; return line && { ...line, by: ids[0] }; }
    const mix = ids.slice().sort(() => Math.random() - 0.5);
    if (ev.t === "start") {
      mix.forEach((i, k) => setTimeout(() => { if (!dead() && G && !G.over) talkers[i]?.event(ev); }, (k * 900) / speed));
      return null;
    }
    let order = mix;
    if (ev.t === "play") { if (!ids.includes(ev.p) || ids.some((i) => talkers[i]?.showing)) return null; order = [ev.p]; }
    else if (ev.t === "score") { const wt = (i) => (ev.res[i].zone === "scorch" ? 3 : ev.res[i].zone === "just" ? 2 : 0) + (ev.voter === i ? 2 : 0); order = mix.sort((a, b) => wt(b) - wt(a)); }
    else if (ev.t === "end") { const r = ev.result; order = r.winner != null && r.winner !== ME ? [r.winner] : (r.ranks || ids).filter((i) => i !== ME).slice(0, 1); }
    const by = order.find((i) => talkers[i]?.has(ev));
    if (by == null) return null;
    for (const i of ids) if (i !== by) talkers[i]?.hide();
    const line = talkers[by].event(ev);
    return line && { ...line, by };
  }
  // 視差: マウスの位置で、相手と部屋が少しずれて奥行きが出る（指で触る画面では動かさない）
  let parallaxFrame = 0;
  root.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse" || parallaxFrame || calm()) return;
    parallaxFrame = requestAnimationFrame(() => {
      parallaxFrame = 0;
      const r = root.getBoundingClientRect(); if (!r.width) return;
      root.style.setProperty("--px", (((e.clientX - r.left) / r.width) * 2 - 1).toFixed(3));
      root.style.setProperty("--py", (((e.clientY - r.top) / r.height) * 2 - 1).toFixed(3));
    });
  });

  function close(completed) {
    if (dead()) return;
    ctrl.abort(); pending?.(null);
    for (const t of Object.values(talkers)) t.clear();
    for (const st of Object.values(seats)) { clearTimeout(st.motionTimer); clearTimeout(st.talkTimer); clearTimeout(st.blinkTimer); }
    clearTimeout(fidgetTimer);
    root.remove(); active.delete(host);
    if (window.__ichidai === hook) delete window.__ichidai;
    try { previousFocus?.focus?.({ preventScroll: true }); } catch { /* 元の要素が無ければそのまま */ }
    finish(summary(completed));
  }
  signal?.addEventListener("abort", () => close(false), { once: true });
  window.addEventListener("pagehide", () => close(false), { once: true, signal: ctrl.signal });
  root.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.preventDefault(); if (!sheet.hidden && (ui.sheet === "help" || ui.sheet === "info")) closeSheet(); else askQuit(); } });

  // 人の入力を進行へ渡す。進行が演出の途中（相手の札が飛んでいる・炭の印を出している など）でまだ受け付けていないときは、
  // 押した操作を1つだけ預かり、受け付けられるようになったらすぐ打つ（2026-11-11 オーナー「処理されなかったり」: 画面はもう自分の番の
  // 見た目なのに、押した操作が黙って捨てられていた）。預かるのは、その画面のままの間だけ（局面が進んだら捨てる）
  let acts = 0, queued = null;
  const submit = (action) => { if (pending) { const r = pending; pending = null; root.dataset.input = "0"; r(action); } else if (action && G && !G.over) queued = { action, at: acts }; };
  /** 人の入力を待つ。預かっている操作が、いまの局面のものなら、それを使う。待っているあいだ、root の data-input は "1" */
  const humanInput = () => { const q = queued; queued = null; if (q && q.at === acts) return Promise.resolve(q.action); root.dataset.input = "1"; return new Promise((resolve) => { pending = resolve; }); };
  // テスト・デモ用の入口: 自分の席もCPUに打たせて早回しする（ほかのミニゲームの window.__desertRide と同じ使い方）
  const hook = { manual: () => { pilot = null; speed = 1; if (G) render(); }, // 自動で打たせるのをやめて、人の入力に戻す（テスト用）
    autoplay: (fast = 12) => { pilot = "cpu"; speed = fast; if (pending && G && !G.over) submit(aiAct(G, G.wait.player)); else if (ui.sheet === "score") sheet.querySelector('[data-test="ichi-next"]')?.click(); },
    get game() { return G; } };
  window.__ichidai = hook;
  const human = (i) => i === ME && pilot !== "cpu";
  const say = (text) => { ui.toast = text; live.textContent = text; };
  // 試遊ページは本編の loadAll を通らない。立ち絵の測定値だけ同じ manifest から読む。
  const portraitReady = DB.manifest.faceFrames ? Promise.resolve() : fetch("data/manifest.json")
    .then((res) => { if (!res.ok) throw new Error(`manifest ${res.status}`); return res.json(); })
    .then((manifest) => { if (!dead() && !DB.manifest.faceFrames) useManifest(manifest); })
    .catch(() => {}); // 素材が無い場合は従来の顔アイコンを維持する
  function portraitOf(i) {
    const id = info[i]?.id;
    if (!id) return null;
    const faces = DB.manifest.portraits?.[id]?.faces || [];
    // いまの表情 → ふつうの顔の順に、顔の位置（目・顔の幅）が測ってある絵を探す
    for (const mood of [ui.moods[i], "normal"]) {
      if (!faces.includes(mood)) continue;
      const portrait = DB.characters[id] ? portraitInfo(id, mood, "classic") : portraitAsset(DB.manifest, id, mood, "classic");
      const frame = portrait && faceFrame(portrait.folder, portrait.style);
      if (frame?.eye && frame?.unit) return { portrait, frame };
    }
    return null;
  }
  // バストアップの大きさ: seat＝1対1の卓の向こうの席／rival＝4人対戦の席（顔を左に寄せ、右に小さな札を置く）／small＝結果の札の小さな窓
  // 顔の幅（frame.unit）をそろえ、目を窓の決まった位置に置く
  const BUST = { seat: { unit: 86, eye: [210, 66] }, rival: { unit: 60, eye: [58, 50] }, small: { scale: 0.46, eye: [108, 27] } };
  /** 相手 i のバストアップ */
  function bustOf(i, mode = "small") {
    const found = portraitOf(i), id = info[i]?.id, name = info[i]?.name || "相手";
    if (!found) return el("span.ichi-leader-ring", faceNode(id, name));
    const { portrait, frame } = found, size = BUST[mode], live = mode !== "small";
    const scale = size.unit ? size.unit / frame.unit : size.scale, [ex, ey] = size.eye;
    // 席では、まぶたと口の重ね絵を立ち絵の上に置く（まばたき・しゃべるときの口。位置は ichidai-face.js）。息づかいは顔ごと動かす
    const parts = live ? faceParts(id, portrait.face) : null;
    const at = ([x, y, w, h]) => ({ left: `${(ex + (x - frame.eye[0]) * scale - (w * scale) / 2).toFixed(1)}px`, top: `${(ey + (y - frame.eye[1]) * scale - (h * scale) / 2).toFixed(1)}px`, width: `${(w * scale).toFixed(1)}px`, height: `${(h * scale).toFixed(1)}px` });
    const overlays = parts ? [...parts.eyes.map((e) => el("i.ichi-eyelid", { style: at(e) })), parts.mouth ? el("i.ichi-lips", { style: at(parts.mouth) }) : null] : [];
    return el(`span.ichi-foe-bust${live ? ".is-seat" : ""}`, { dataset: { test: mode === "seat" ? "ichi-foe-bust" : mode === "rival" ? `ichi-rival-bust-${i}` : null, face: portrait.face, parts: parts ? "1" : null }, "aria-hidden": "true",
      style: parts ? { "--skin": parts.skin, "--shade": parts.shade, "--lid-line": parts.line, "--lips": parts.lips } : null },
      el("span.ichi-foe-face", [el("img", { src: portrait.src, alt: "", draggable: "false", style: {
        width: `${896 * scale}px`, left: `${ex - frame.eye[0] * scale}px`, top: `${ey - frame.eye[1] * scale}px`,
      }, onerror: (e) => { e.currentTarget.closest(".ichi-foe-bust").replaceWith(el("span.ichi-leader-ring", faceNode(id, name))); } }), ...overlays]));
  }
  /** 相手 i の表情を替える（その人の立ち絵にある表情のうち、先に挙げたもの） */
  function setMood(i, ...choices) {
    const faces = DB.manifest.portraits?.[info[i]?.id]?.faces || [];
    ui.moods[i] = choices.find((f) => faces.includes(f)) || "normal";
  }

  // ───────── 設定の画面 ─────────
  function showSetup() {
    root.dataset.phase = "setup";
    // 入門の一局のあとは、基本の一式の1つ目から（入門の一式・大会は、ふつうの対戦では選ばない）
    const prev = cfg && !cfg.intro ? cfg : null;
    const pick = { kit: prev?.kit || BASIC_KITS[0].id, tournament: prev?.tournament || "practice", level: prev?.level ?? 1, players: prev?.players === 4 && pool.length >= 3 ? 4 : 2 };
    let tier = KIT[pick.kit]?.tier === "advanced" ? "advanced" : "basic"; // 一式の棚: 基本（条件や例外の無い札だけ）／上級（人物・イベント・条件つきの葉と機材）
    const draw = () => {
      const tabs = [["basic", "基本"], ["advanced", "上級"]].map(([id, name]) => el(`button.ichi-pick.ichi-tier${tier === id ? ".is-on" : ""}`, { type: "button", dataset: { test: `ichi-tier-${id}` }, "aria-pressed": String(tier === id),
        onclick: () => { tier = id; if (KIT[pick.kit]?.tier !== id) pick.kit = (id === "basic" ? BASIC_KITS : KITS)[0].id; sfx("select"); draw(); } }, [el("b", { text: name })]));
      // 入門の一局: 基本の棚の先頭に置く。押すと、そのまま始まる（一式・大会・相手の強さは決まっている）
      const intro = tier === "basic" ? el("button.ichi-pick.ichi-intro", { type: "button", dataset: { test: "ichi-intro-start" },
        onclick: () => { sfx("select"); cfg = { kit: INTRO.kit, tournament: INTRO.tournament.id, level: INTRO.level, players: 2, intro: true }; startGame(); } }, [
        el("small", { text: "はじめての人へ" }), el("b", { text: INTRO.tournament.name }),
        el("span.ichi-kit-blurb", { text: "一台は詰めてあります。炭を焼いて、熱を★に合わせるだけ。6ラウンドの短い一局で、一票と決め手はありません。" }),
        el("i.ichi-intro-go", { text: "これで始める ▶" })]) : null;
      const kits = (tier === "basic" ? BASIC_KITS : KITS).map((k) => el(`button.ichi-pick.ichi-kit${pick.kit === k.id ? ".is-on" : ""}`, { type: "button", dataset: { test: `ichi-kit-${k.id}` }, "aria-pressed": String(pick.kit === k.id),
        onclick: () => { pick.kit = k.id; sfx("select"); draw(); } }, [
        el("b", { text: k.name }),
        el("span.ichi-kit-art", [tcg("bowl", k.bowl, { size: "mid" }), tcg("hmd", k.hmd, { size: "mid" }), ...k.plan.map(([id]) => tcg("flavor", id, { size: "mid" }))]),
        el("span.ichi-kit-leaf", k.plan.map(([id, n]) => el("span", [kindBadge(FLAVOR[id].kind), `${FLAVOR[id].name} ${n}`]))),
        el("small", { text: `${BOWL[k.bowl].name} ＋ ${HMD[k.hmd].name}` }),
        el("span.ichi-kit-blurb", { text: k.blurb }),
      ]));
      const tours = TOURNAMENTS.map((t) => el(`button.ichi-pick.ichi-tour${pick.tournament === t.id ? ".is-on" : ""}`, { type: "button", dataset: { test: `ichi-tour-${t.id}` }, "aria-pressed": String(pick.tournament === t.id),
        onclick: () => { pick.tournament = t.id; sfx("select"); draw(); } }, [el("b", { text: t.name }), el("small", { text: `${t.sessions * 3}ラウンド` }), el("span", { text: t.blurb })]));
      const levels = LEVELS.map((l) => el(`button.ichi-pick.ichi-level${pick.level === l.id ? ".is-on" : ""}`, { type: "button", dataset: { test: `ichi-level-${l.id}` }, "aria-pressed": String(pick.level === l.id),
        onclick: () => { pick.level = l.id; sfx("select"); draw(); } }, [el("b", { text: l.name })]));
      // 人数（相手が3人そろっているときだけ選べる）: 1対1か、4人（1:1:1:1）
      const counts = pool.length >= 3 ? [[2, "1対1", foe.name], [4, "4人", pool.map((o) => o.name).join("・")]].map(([n, name, sub]) => el(`button.ichi-pick.ichi-count-pick${pick.players === n ? ".is-on" : ""}`, { type: "button", dataset: { test: `ichi-players-${n}` }, "aria-pressed": String(pick.players === n),
        onclick: () => { pick.players = n; sfx("select"); draw(); } }, [el("b", { text: name }), el("small", { text: sub })])) : null;
      table.replaceChildren(el("div.ichi-setup", [
        el("header.ichi-setup-head", [el("h1", { text: ICHIDAI_TITLE }), el("p", { text: "葉を詰め、炭で熱を保ち、審査員の一口を競う" })]),
        el("section", [el("h2.ichi-kits-head", [el("span", { text: "自分の一式" }), el("span.ichi-tier-tabs", tabs),
          el("small", { text: tier === "basic" ? "基本：条件や例外の無い札だけ。相手も基本の一式を使う" : "上級：人物・イベント・条件つきの葉と機材で、深い手を打てる" })]),
          el(`div.ichi-picks.is-kits.is-${tier}`, [intro, ...kits])]),
        el("section", [el("h2", { text: "大会" }), el("div.ichi-picks.is-tours", tours)]),
        el("section.ichi-setup-foot", [counts ? el("h2", { text: "人数" }) : null, counts ? el("div.ichi-picks.is-counts", counts) : null,
          el("h2", { text: pick.players === 4 ? "相手の強さ" : `${foe.name}の強さ` }), el("div.ichi-picks.is-levels", levels),
          el("button.ichi-btn.is-primary.ichi-start", { type: "button", text: "対戦をはじめる", dataset: { test: "ichi-start" }, onclick: () => { sfx("select"); cfg = { ...pick }; startGame(); } })]),
      ]));
    };
    draw();
    root.focus({ preventScroll: true });
  }
  // ───────── 対戦 ─────────
  async function startGame() {
    await portraitReady;
    if (dead()) return;
    // 相手の一式: 自分と同じ棚（基本なら基本・上級なら上級）の、自分と違うもの。入門の一局は、相手も同じ一式
    const shelf = KIT[cfg.kit]?.tier === "basic" ? BASIC_KITS : KITS;
    const others = cfg.intro ? [cfg.kit] : shelf.map((k) => k.id).filter((id) => id !== cfg.kit);
    const s = (seed ?? (Date.now() ^ (Math.random() * 0xffffffff))) >>> 0;
    const foeKit = cfg.opponentKit || (KIT[opponentKit] ? opponentKit : null) || others[s % others.length]; // 相手の一式: 指定が無ければ、自分と違うものから
    // 4人対戦: 相手3人は、自分と違う一式を1つずつ（だれがどれを使うかは対戦ごとに変わる）
    const four = cfg.players === 4 && pool.length >= 3, foes = four ? pool.slice(0, 3) : [foe];
    const kits = four ? foes.map((_, k) => others[(s + k) % others.length]) : [foeKit];
    info = [{ id: "hajime", name: "はじめ" }, ...foes];
    G = createGame({ seed: s + games.length * 7919, tournament: cfg.tournament, market: cfg.market, rules: cfg.intro ? INTRO.rules : undefined,
      players: [{ name: "はじめ", kit: cfg.kit, level: 2 }, ...foes.map((f, k) => ({ name: f.name, kit: kits[k], ai: true, level: cfg.level }))] });
    Object.assign(ui, { sel: null, picks: new Set(), counts: {}, note: "", toast: "", sheet: null, peek: null, lastLog: 0, turnKey: null, moods: {}, seen: null, feed: [], last: "", heatSeen: null });
    buildSeats();
    queued = null;
    closeSheet();
    // 対戦の前に「VS」（顔アイコンが向かい合い、電撃が走る）。CPUに打たせる早回しでは出さない
    if (!quick()) {
      root.dataset.phase = "versus"; table.replaceChildren();
      await playVersus({ host: root, signal: ctrl.signal, speed, players: [{ id: "hajime", name: "はじめ", sub: KIT[cfg.kit]?.name }, ...foes.map((f, k) => ({ id: f.id, name: f.name, sub: KIT[kits[k]]?.name }))] });
      if (dead()) return;
    }
    root.dataset.phase = "play";
    render(); speak({ t: "start" }); fidget(); blink();
    if (tutorial && !games.length) { openHelp(); }
    await loop();
  }
  const AUTO_WAITS = new Set(["cool", "wear", "weaken"]);
  async function loop() {
    const mine = G;
    while (!dead() && G === mine) {
      render();
      if (G.over) { await showEnd(); return; }
      const w = G.wait;
      announceTurn(w);
      let action;
      if (human(w.player) && AUTO_WAITS.has(w.type)) {
        // 選ばなくてよい処理は、自動で進める（2026-11-13 オーナー「プレイヤーにやらせず自動処理なところは自動でいい」。ガイドの有無に依らない）:
        // 炭が弱る（火の小さい炭から）・すきま風で弱まる炭（火の小さい炭）。葉が減るのは、規則が自動でやる（第0.8版。一口ごとに1枚）。
        // CPUと同じ決め方。何が起きたかが見えるように、短い間を置く
        await sleep((quick() ? 0 : w.type === "cool" && w.left !== w.steps ? 380 : multi() ? 420 : 640) / speed, ctrl.signal);
        if (dead() || G !== mine) return;
        if (!human(w.player)) continue;
        action = aiAct(G, ME);
      }
      else if (human(w.player)) { action = await humanInput(); if (!action) return; }
      else { await sleep(cpuDelay(w), ctrl.signal); cpuTurnKey = turnKeyOf(w); if (dead() || G !== mine) return; if (human(w.player)) continue; action = aiAct(G, w.player); } // 待つあいだに人の入力へ戻されたら、打たせない
      const from = flySource(w, action);
      const before = G.log.length, priorScores = G.P.map((p) => p.score), r = act(G, action);
      if (!r.ok) { if (human(w.player)) { say(r.reason); sfx("cancel"); } else { console.error("ichidai: CPUの入力が通らない", action, r.reason); close(false); return; } continue; }
      acts++;
      ui.sel = null; ui.picks = new Set(); ui.counts = {}; ui.toast = "";
      if (!human(w.player) && G.log.length > before) ui.note = G.log.at(-1).text;
      // 自分の手で起きたこと（炭が弱った・器具が押し出された など）を、案内の札に1行残す。ターンを終えたら消す
      // 文字を減らす: 自分で押した手は言い直さない。出すのは、自動で起きたこと（炭が弱った・すきま風）と、手の副作用（器具が押し出された など）だけ
      if (w.player === ME) {
        const logs = G.log.slice(before).filter((l) => l.who === ME), side = AUTO_WAITS.has(w.type) ? logs.at(-1) : logs.length > 1 ? logs.at(-1) : null;
        if (action.type === "end") ui.last = ""; else if (side) ui.last = side.text; else if (!AUTO_WAITS.has(w.type)) ui.last = "";
      }
      // ガイド: 準備で葉を詰めたあと、炭にもカードにもすることが無ければ、そのままターンを終える（「詰める → 終える」の2度押しをなくす）
      if (human(w.player) && action.type === "pack" && ui.assist && G.wait?.type === "prep" && G.wait.player === ME) {
        let next = null; try { next = aiAct(G, ME); } catch { next = null; }
        if (next?.type === "end") queued = { action: { type: "end" }, at: acts };
      }
      await playEvents(priorScores, from);
    }
  }
  // 4人対戦は相手の手番が3人ぶん続くので、1手を短くする
  // 4人対戦のテンポ（2026-11-13 オーナー「4人対戦の時はテンポ良くしたい」）: 相手の手番が3人ぶん続くので、間（ま）を置くのは
  // 「その人の手番のはじめ」だけにして、同じ手番の続きの手はすぐ打つ。準備（葉を詰める・炭を焼く）はさらに短く。
  // 実測（相手3人・自分はすぐ打つ）: 準備 30.5秒 → 約10秒、提供の1ラウンド 14.3秒 → 約7秒
  const turnKeyOf = (w) => `${G.phase}:${G.prepTurn}:${G.round}:${G.serveStep}:${w.player}`;
  let cpuTurnKey = "";
  const cpuDelay = (w) => {
    if (ui.fast || pilot === "cpu") return 40 / speed;
    const small = w.type === "embers" || w.type === "wear" || w.type === "discard";
    if (!multi()) return (small ? 260 : 620) / speed;
    const first = cpuTurnKey !== turnKeyOf(w); // その人の手番の最初の手か
    return (small ? 110 : G.phase === "prep" ? (first ? 170 : 60) : first ? 300 : 110) / speed;
  };
  const quick = () => ui.fast || pilot === "cpu";

  /** ターンが替わったら、卓の中央に帯を一度だけ流す（だれの番かを目で分かるように） */
  function announceTurn(w) {
    if (!w || !(w.type === "prep" || w.type === "cool" || w.type === "main")) return;
    const key = `${G.phase}:${G.prepTurn}:${G.round}:${G.serveStep}:${w.player}`;
    if (ui.turnKey === key) return;
    ui.turnKey = key;
    if (quick()) return;
    const mine = human(w.player);
    if (mine || !multi()) flash(mine ? "あなたのターン" : `${G.P[w.player].name}のターン`, mine ? "is-me" : "is-foe"); // 4人対戦: 相手の番は帯を出さない（席が光る）
    if (!mine) seatMotion("lean", w.player); // 相手の番: 卓へ身を乗り出す
    if (mine) sfx("select");
  }
  function flash(text, cls) {
    root.querySelector(".ichi-banner")?.remove();
    const node = el(`div.ichi-banner.${cls}`, { "aria-hidden": "true" }, el("b", { text }));
    root.append(node);
    setTimeout(() => node.remove(), 1150);
  }
  /** 点が入ったところに、数字を浮かせる */
  function floatText(who, text, style = null) {
    const node = el(`div.ichi-float.is-${who}`, { "aria-hidden": "true", text, style });
    root.append(node);
    setTimeout(() => node.remove(), 1500);
  }

  function pulseTarget(selector, cls) {
    if (still()) return;
    const target = root.querySelector(selector);
    if (!target) return;
    target.classList.remove(cls); void target.offsetWidth; target.classList.add(cls);
    setTimeout(() => target.classList.remove(cls), 650);
  }

  // ───────── 札が卓の上を飛ぶ ─────────
  const still = () => quick() || matchMedia("(prefers-reduced-motion: reduce)").matches;
  /** root の中の座標（1280×720 の物差し）での、要素の中心と幅 */
  function spot(node) {
    if (!node?.isConnected) return null;
    const rr = root.getBoundingClientRect(), k = rr.width / 1280 || 1, r = node.getBoundingClientRect();
    return r.width ? { x: (r.left + r.width / 2 - rr.left) / k, y: (r.top + r.height / 2 - rr.top) / k, w: r.width / k } : null;
  }
  const CENTER = { x: 640, y: 318, w: 240 }; // 使った札を大きく見せる位置（卓の中央の手前）
  /** この入力で動く札の出どころ（手札の位置・炭焼き場の枠・相手の席）と、その札のID。描き直す前に測る */
  function flySource(w, a) {
    if (still() || !a) return null;
    const p = G.P[w.player], mine = w.player === ME;
    if (a.type === "puton") {
      // 4人対戦の相手は炭焼き場を卓に出していないので、席（顔）から出す
      const node = mine ? board.querySelector(`[data-test="ichi-stove-${a.stove}"]`) : multi() ? seats[w.player]?.bust : board.querySelectorAll(".ichi-foe .is-stove .ichi-stove-coal")[a.stove];
      const at = multi() && !mine ? spot(node) && { ...spot(node), w: 34 } : spot(node);
      return at ? { ...at, id: p.stove[a.stove]?.id } : null;
    }
    // 詰める: 選んだ葉の札が、場の山からボウルの横の束へ飛ぶ
    if (a.type === "pack") {
      const packs = Object.entries(a.picks || {}).filter(([, n]) => n > 0).map(([id, n]) => ({ id, n, at: spot(table.querySelector(`[data-test="ichi-market-${id}"] .ichi-card`)) })).filter((x) => x.at);
      return packs.length ? { packs } : null;
    }
    if (a.type !== "charge" && a.type !== "place" && a.type !== "play") return null;
    const seatHand = seats[w.player]?.hand;
    const at = mine ? spot(table.querySelector(`[data-test="ichi-hand-${a.hand}"]`)) : spot(seatHand) && { ...spot(seatHand), w: 34 };
    return at ? { ...at, id: p.hand[a.hand] } : null;
  }
  /**
   * 札が from から to へ飛ぶ（どちらも spot() の値）。face＝札の表（無ければ裏だけ）。start / end＝"front" か "back"（途中で裏返る）
   * lay＝着地で卓に寝かせる角度。via＝途中で通る位置（手前に大きく見せる）。base＝face の幅
   */
  function fly(face, from, to, { dur = 400, start = "front", end = "front", lay = 44, via = null, base = 112, judge = false } = {}) {
    if (still() || !from?.w || !to?.w) return Promise.resolve();
    const node = el("div.ichi-fly", { "aria-hidden": "true", style: { width: `${base}px`, height: `${base * 1.4}px` } }, el("div.ichi-fly-card", [
      face ? el("div.ichi-fly-face", face) : null,
      el("div.ichi-fly-face.is-back", el(`i.ichi-back${judge ? ".is-judge" : ""}`, { style: { "--cw": `${base}px` } }))]));
    root.append(node);
    const T = (pt, tilt = 0) => `translate(${pt.x - base / 2}px, ${pt.y - base * 0.7}px) perspective(900px) scale(${pt.w / base}) rotateX(${tilt}deg)`;
    const ms = dur / speed, turn = (side) => `rotateY(${side === "back" ? 180 : 0}deg)`;
    node.animate(via ? [{ transform: T(from) }, { transform: T(via), offset: 0.55 }, { transform: T(to, lay) }] : [{ transform: T(from) }, { transform: T(to, lay) }],
      { duration: ms, easing: "cubic-bezier(0.2, 0.7, 0.3, 1)", fill: "forwards" });
    node.firstChild.animate([{ transform: turn(start) }, { transform: turn(end) }], { duration: ms * (via ? 0.5 : 0.85), easing: "ease-in-out", fill: "forwards" });
    return new Promise((resolve) => setTimeout(() => { node.remove(); resolve(); }, ms));
  }
  /** 炭まわりの札（チャージ・炭を置く・のせる）が、手札や炭焼き場から置き場へ飛ぶ */
  function coalFlight(ev, from) {
    if (!from) return;
    const mine = ev.p === ME;
    const list = board.querySelectorAll(ev.t === "place" ? (mine ? '[data-test="ichi-stove"] .ichi-stove-coal' : ".ichi-foe .is-stove .ichi-stove-coal")
      : (mine ? '[data-test="ichi-zone"] .ichi-on' : multi() ? `[data-test="ichi-rival-zone-${ev.p}"] .ichi-on` : '[data-test="ichi-foe-zone"] .ichi-on'));
    const to = spot(list[list.length - 1]);
    const id = ev.id || from.id, face = id && (mine || ev.t !== "charge") ? tcg("card", id) : null;
    // チャージ: 自分の札は表から裏へ、相手の札は裏のまま。炭を置く・のせる: 表向き（相手の手札からは裏から表へ）
    fly(face, from, to, { start: mine || ev.t === "puton" ? "front" : "back", end: ev.t === "charge" ? "back" : "front", dur: mine ? 380 : 440 });
  }
  /** 詰めた葉の札が、場の山から、その葉の束へ1枚ずつ飛ぶ */
  function leafFlight(ev, from) {
    if (!from?.packs) return;
    const host = board.querySelector(ev.p === ME ? '[data-test="ichi-bundles"]' : '[data-test="ichi-foe-bundles"]');
    let k = 0;
    for (const { id, n, at } of from.packs) {
      const to = spot(host?.querySelector(`[data-test="ichi-bundle"][data-id="${id}"] .ichi-card`));
      if (!to) continue;
      for (let i = 0; i < Math.min(n, 3); i++, k++) setTimeout(() => fly(tcg("flavor", id), at, to, { dur: 420, lay: 40 }), (k * 110) / speed);
    }
  }
  /** 弱まる・灰になる炭の場所（描き直す前に測る）。ev.zi＝その出来事の直前の並びでの位置 */
  function coalSpot(ev) {
    if (ev.zi == null || still()) return null;
    const node = ev.p === ME ? board.querySelector(`[data-test="ichi-coal-${ev.zi}"]`)
      : multi() ? board.querySelectorAll(`[data-test="ichi-rival-zone-${ev.p}"] .ichi-on`)[ev.zi]
        : board.querySelectorAll('[data-test="ichi-foe-zone"] .ichi-coal-btn')[ev.zi];
    return spot(node);
  }
  /** 炭の火が下がった・灰になった合図（その場所に、短い印を出す）。なぜ消えたかが分かるように一言付ける */
  function burnFx(ev, at) {
    if (!at || still()) return;
    const ash = ev.t === "ash", why = { cool: "弱った", draft: "すきま風", self: "外した" }[ev.why] || "";
    const node = el(`div.ichi-burn${ash ? ".is-ash" : ".is-down"}`, { "aria-hidden": "true", dataset: { test: "ichi-burn", kind: ash ? "ash" : "down", why: ev.why || "" }, style: { left: `${Math.round(at.x)}px`, top: `${Math.round(at.y)}px` } },
      [el("i"), el("b", { text: ash ? "灰になった" : "火−1" }), ev.p === ME && why ? el("small", { text: why }) : null]);
    root.append(node);
    setTimeout(() => node.remove(), 1100 / Math.max(1, speed));
  }
  /** 使ったカードの行き先（仕込んだ一口は「この一口」の置き場、器具・人物はその枠、ほかは灰） */
  function landingOf(ev) {
    const c = CARD[ev.id], mine = ev.p === ME;
    if (multi() && !mine) { // 4人対戦の相手: 仕込んだ一口は卓の奥のその人の置き場、ほかは席（顔）へ戻る
      const at = c.when === "puff" ? spot(board.querySelector(`[data-test="ichi-rival-puff-${ev.p}"] .ichi-row`)) : spot(seats[ev.p]?.bust);
      return at && { ...at, w: Math.min(at.w, 40) };
    }
    if (c.when === "puff") return spot(board.querySelector(`[data-test="ichi-puff-${mine ? "me" : "foe"}"] .ichi-row`));
    if (c.type === "tool" || c.type === "person") return spot(board.querySelector(`${mine ? ".ichi-mine" : ".ichi-foe"} .is-perms .ichi-row`));
    const pile = spot(board.querySelector(mine ? ".ichi-mine .is-ash" : ".ichi-foe .is-deck"));
    return pile && { ...pile, w: 40 };
  }
  /** カードを使う: 自分の札は手札から卓の中央を通って置き場へ。相手の札は席から裏のまま出て、中央で表になり、置き場へ */
  async function playFlight(ev, from) {
    const big = () => tcg("card", ev.id, { size: "big" }), to = landingOf(ev), land = to && { ...to, w: Math.min(to.w, 66) };
    if (human(ev.p)) { fly(big(), from, land, { via: CENTER, base: 240, dur: 720 }); return; }
    if (quick()) return;
    const brisk = multi(); // 4人対戦: 札を見せる間を短く
    await fly(big(), from, CENTER, { start: "back", end: "front", lay: 0, base: 240, dur: brisk ? 280 : 460 });
    const node = el("div.ichi-played", { dataset: { test: "ichi-played" } }, [el("small", { text: `${G.P[ev.p].name}が使った` }), big()]);
    root.append(node);
    await wait(brisk ? 520 : 1000);
    node.remove();
    fly(big(), CENTER, land, { base: 240, dur: brisk ? 220 : 340 });
  }
  async function playEvents(priorScores, from) {
    const evs = G.events.splice(0);
    for (const ev of evs) {
      if (dead()) return;
      // 置いた札は、飛んできた札が着くまで隠しておく（着いたら置かれる動き）
      const said = speak(ev); // 相手の一言（カードを使った・審査の結果・勝ち負け）。待たずに進む
      const fl = from && !still();
      board.style.setProperty("--land", fl && ["charge", "place", "puton"].includes(ev.t) ? `${(human(ev.p) ? 0.3 : 0.36) / speed}s` : fl && ev.t === "play" ? `${(human(ev.p) ? 0.62 : multi() ? 1.0 : 1.7) / speed}s` : "0s");
      if (ev.t === "reveal") { render(); if (ev.puff.judge) { sfx("card"); await showReveal(ev.puff); } } // 練習試合は審査カードを使わない
      else if (ev.t === "score") {
        ui.feed.unshift(feedEntry(ev)); // 審査員の声（掲示板）に足す。新しいものが上
        // 相手ごとに、結果に合わせて表情を替える（一言に表情が付いた人は、そちらを優先）
        for (const i of rivalIds()) {
          if (said?.face && said.by === i) continue;
          const foeResult = ev.res[i], swing = priorScores[i] <= priorScores[ME] && G.P[i].score > G.P[ME].score;
          setMood(i, ...(foeResult.zone === "scorch" ? ["sad", "shock", "serious"] : swing ? ["surprise", "excited", "smile"]
            : foeResult.zone === "just" ? ["excited", "smile", "surprise", "intense"] : ev.voter === i ? ["smile", "smug"]
              : ev.voter === ME ? ["sad", "serious"] : foeResult.pts > ev.res[ME].pts ? ["smile", "smug"] : ["serious", "normal"]));
        }
        render(); await showScore(ev);
        reactToScore(ev); // 結果の札を閉じたあと、相手が結果に反応する
      }
      else if (ev.t === "peek" && human(ev.p)) { ui.peek = ev.puff; sfx("card"); }
      else if (ev.t === "play") {
        // 相手がカードを使う: 札を卓へ打ち出す動き。会場の熱気（全員に効く）で揺さぶられたら、相手がみなひるむ
        if (ev.p !== ME) seatMotion("play", ev.p);
        if (ev.id === "venue_heat") for (const i of rivalIds()) if (i !== ev.p) { seatMotion("flinch", i); emote("bang", i); }
        sfx("card"); render(); await playFlight(ev, from);
      }
      // 相手を1人ねらうカード（実況の煽り・すきま風）: ねらわれた相手がひるむ
      else if (ev.t === "target") { if (ev.to !== ME) { seatMotion("flinch", ev.to); emote("bang", ev.to); } else if (multi() && !quick()) flash(`${G.P[ev.p].name}が あなたをねらった`, "is-foe"); }
      else if (ev.t === "charge" || ev.t === "puton" || ev.t === "place") { if (ev.p !== ME) seatMotion("reach", ev.p); sfx("click"); render(); coalFlight(ev, from); }
      else if (ev.t === "pack") { sfx("card"); render(); leafFlight(ev, from); }
      else if (ev.t === "flip" || ev.t === "ash") { const at = coalSpot(ev); render(); burnFx(ev, at); if (at && !still()) await wait(ev.p === ME ? 260 : multi() ? 50 : 120); }
      else if (ev.t === "drop") { if (human(ev.p) && !quick()) flash(`${CARD[ev.id].name}は灰へ`, "is-foe"); render(); }
      else if (ev.t === "wear") render();
      // 蒸らし: ターンの終わりに、熱が火力へ1近づく（自分のぶんは、熱の目盛りが動くのを少し見せる）
      else if (ev.t === "heat") { render(); if (ev.p === ME && !still()) { pulseTarget('[data-test="ichi-zone"]', ev.to > ev.from ? "fx-steam-up" : "fx-steam-down"); if (ev.why === "steam") await wait(multi() ? 200 : 420); } }
      if (["puton", "flip", "ash", "place"].includes(ev.t)) pulseTarget(ev.t === "place" ? (ev.p !== ME ? ".ichi-foe .is-stove" : '[data-test="ichi-stove"]') : ev.p === ME ? '[data-test="ichi-zone"]' : multi() ? `[data-test="ichi-rival-zone-${ev.p}"]` : ".ichi-foe .is-coal", `fx-${ev.t}`);
    }
  }

  // ───────── 描画 ─────────
  function render() {
    if (!G || dead()) return;
    const w = G.wait, me = G.P[ME], op = G.P[CPU], myTurn = !!w && human(w.player), many = multi();
    root.dataset.phase = G.over ? "end" : G.phase;
    root.dataset.wait = w ? w.type : "";
    root.dataset.turn = w ? (w.player === ME ? "me" : "foe") : "";
    fastBtn.hidden = G.over || pilot === "cpu"; fastBtn.setAttribute("aria-pressed", String(ui.fast));
    const { lines, buttons } = guide(me, op, w);
    assistBtn.hidden = pilot === "cpu";
    for (const i of rivalIds()) renderSeat(G.P[i]);
    // 卓: 左端＝自分の火力ゾーン／まんなか（奥 → 手前）＝相手の札・中央・自分の札／右端＝相手の火力ゾーン
    // 4人対戦: 奥＝相手3人の炭と一口だけ／右端＝順位
    board.replaceChildren(...(many
      ? [fireColumn(me, true, w, myTurn), rivalsHalf(), centerStrip(me, null), half(me, true, w, myTurn), standings()]
      : [fireColumn(me, true, w, myTurn), half(op, false, w, false), centerStrip(me, op), half(me, true, w, myTurn), fireColumn(op, false, w, false)]));
    // HUD（卓の手前に立てて出すもの）
    // 左上は相手の札とラウンドを縦に並べ、相手の顔の左（吹き出しの出る所）は空けておく（4人対戦は、相手の数字を顔の横に出す）
    table.replaceChildren(...[el("div.ichi-hud-left", many ? [clock(w)] : [foePanel(op), clock(w)]), el("div.ichi-guide", { dataset: { test: "ichi-guide" } }, lines), el("div.ichi-actions", buttons),
      heatRead(me), prepMarket(me, w, myTurn), handRow(me, w, myTurn)].filter(Boolean));
    // 案内の札の高さは文の量で変わる。右のボタンの列は、札のすぐ下に置く（重ならないように。30px 刻みで、細かくは動かさない）
    const guideBox = table.querySelector(".ichi-guide");
    if (guideBox) root.style.setProperty("--ichi-actions-top", `${Math.max(242, Math.ceil((guideBox.offsetTop + guideBox.offsetHeight + 8) / 30) * 30)}px`);
    markHint(hintNow(w));
    // 自分の熱が変わったら、熱の数字のそばに差を浮かせる（何が起きたかを見落とさないように）
    const hNow = heatOf(me);
    if (ui.heatSeen != null && hNow !== ui.heatSeen && !quick()) {
      for (const n of root.querySelectorAll(".ichi-float.is-heat-up, .ichi-float.is-heat-down")) n.remove(); // 続けて変わったら、新しいほうだけ見せる
      floatText(hNow > ui.heatSeen ? "heat-up" : "heat-down", `熱${hNow > ui.heatSeen ? "+" : "−"}${Math.abs(hNow - ui.heatSeen)}`);
    }
    ui.heatSeen = hNow;
    // 次の描画で「置いたばかり」「引いたばかり」の札を見分けるため、いまの枚数を覚える
    ui.seen = { zone: G.P.map((p) => p.zone.length), stove: G.P.map((p) => p.stove.length), hand: G.P.map((p) => p.hand.length) };
  }
  /** 前の描画より後に置かれた札か（はじめの描画では動かさない） */
  const isFresh = (kind, p, i) => !!ui.seen && i >= ui.seen[kind][p.index];
  /** 相手の席: バストアップ（顔が変わったときだけ差し替える）と、持っている手札の裏。4人対戦は、顔の横に小さな札（点・票・熱・葉） */
  function renderSeat(op) {
    const st = seats[op.index]; if (!st) return;
    const seat = st.node, rival = !!st.plate, id = info[op.index]?.id;
    const key = `${id}:${portraitOf(op.index) ? ui.moods[op.index] || "normal" : "icon"}`;
    if (st.key !== key) { const first = !st.key; st.key = key; seat.dataset.key = key; st.bust.replaceChildren(bustOf(op.index, rival ? "rival" : "seat")); if (!first) seatMotion("pop", op.index); }
    seat.classList.toggle("is-active", G.active === op.index && !G.over);
    seat.setAttribute("aria-label", `${op.name}の一台を見る`);
    const n = op.hand.length, shown = Math.min(n, rival ? 5 : 7);
    st.hand.title = `相手の手札 ${n}枚・山札 ${op.deck.length}枚`;
    st.hand.dataset.count = String(n);
    st.hand.replaceChildren(...Array.from({ length: shown }, (_, i) => el("i.ichi-back.s-tiny", { style: { "--r": `${(i - (shown - 1) / 2) * 7}deg`, "--dy": `${Math.abs(i - (shown - 1) / 2) ** 2 * 1.4}px` } })), el("b.ichi-count", { text: String(n) }));
    if (rival) st.plate.replaceChildren(...rivalPlate(op));
  }
  /** 4人対戦: 相手の顔の横の小さな札。名前・点・票／熱と帯（主役の葉の適温のどこか）／葉の体力と炭の数。細かい中身は顔をタップで開く */
  function rivalPlate(op) {
    const h = heatOf(op), f = op.main ? FLAVOR[op.main] : null, serve = G.phase === "serve";
    const z = f && serve ? zoneCls(rawZone(f, judgedHeat(op, judgeNow()), scorchLineOf(op))) : null;
    return [
      el("b.ichi-rival-name", { text: op.name }),
      el("span.ichi-rival-score", { dataset: { test: `ichi-rival-score-${op.index}`, score: String(op.score), votes: String(op.votes) } }, [el("b", { text: String(op.score) }), el("small", { text: "点" }), el("i.ichi-medal"), el("small", { text: String(op.votes) })]),
      el("span.ichi-rival-heat", { dataset: { test: `ichi-rival-heat-${op.index}`, heat: String(h), zone: z }, title: f ? `${f.name}の適温${f.lo}〜${f.hi}` : "葉はまだ詰めていない" }, [el("small", { text: "熱" }), el("b", { text: String(h) }), z ? el(`i.ichi-zone-chip.z-${z}`, { text: ZONE_LABEL[z] }) : null]),
      el("span.ichi-rival-leaf", { title: f ? `主役 ${f.name}・葉${leavesOf(op)}枚・炭${op.zone.length}つ` : "" }, [f ? flavorIcon(op.main) : null, el("small", { text: `葉${leavesOf(op)}` }), el("small", { text: `炭${op.zone.length}` })]),
      op.pend ? el("span.ichi-chip.is-warn", { text: `次の一口 ${dhText(op.pend)}` }) : null,
    ].filter(Boolean);
  }
  /** 4人対戦の卓の奥: 相手ごとに、炭（火力ゾーン）と、この一口に仕込んだカードだけを置く */
  function rivalsHalf() {
    const serve = G.phase === "serve";
    return el("div.ichi-half.ichi-rivals-mat", { dataset: { test: "ichi-rivals" } }, rivalIds().map((i) => {
      const p = G.P[i], cards = serve && p.puff?.cards?.length && !p.puff.scored ? p.puff.cards : [];
      return zoneBox(p.name, `.is-rival-mat${G.active === i && !G.over ? ".is-active" : ""}`, { dataset: { test: `ichi-rival-mat-${i}` } }, [
        el("span.ichi-rival-chip", { "aria-hidden": "true" }, faceNode(info[i]?.id, p.name)),
        el("div.ichi-row.is-rival-coals", { dataset: { test: `ichi-rival-zone-${i}`, count: String(p.zone.length), heat: String(heatOf(p)), fire: String(fireOf(p)) } }, p.zone.length
          ? p.zone.map((c, k) => coalCard(c, { size: "mini", fresh: isFresh("zone", p, k), glow: true }))
          : el("i.ichi-slot.s-mini")),
        el("div.ichi-rival-puff", { dataset: { test: `ichi-rival-puff-${i}` } }, el("div.ichi-row", cards.length
          ? cards.map((id) => el("span.ichi-set", { dataset: { test: "ichi-set-card", card: id }, title: `仕込み ${CARD[id].name}：${CARD[id].tx}` }, tcg("card", id, { size: "mini" })))
          : el("i.ichi-slot.s-mini.is-puff"))),
      ]);
    }));
  }
  /** 4人対戦の卓の右端: いまの順位（点の高い順）。自分の行に印 */
  function standings() {
    const order = G.P.slice().sort((a, b) => b.score - a.score || a.index - b.index);
    return zoneBox("順位", ".is-standings", { dataset: { test: "ichi-standings", order: order.map((p) => p.index).join(",") } }, el("ol", order.map((p, k) =>
      el(`li${p.index === ME ? ".is-me" : ""}`, [el("small", { text: String(k + 1) }), faceNode(info[p.index]?.id, p.name), el("b", { text: String(p.score) })]))));
  }

  /** 負けている人の印: 一票を取れば +3（ふつうは +2。第0.6版の先行分）。提供のあいだだけ */
  function chaseChip(p) {
    if (G.phase !== "serve" || G.over || !G.R.useVote) return null;
    const n = votePtsOf(G, p);
    return n > G.R.vote ? el("i.ichi-chase", { dataset: { test: `ichi-chase-${p.index}` }, text: `一票+${n}`, title: `負けているあいだは、一票を取ると+${n}点（ふつうは+${G.R.vote}点）` }) : null;
  }
  /** 一票の点の書き添え: 「（+3・追い上げ）」。勝負の一服の+3を除いて、ふつうの点より多ければ負けていたぶん */
  const voteNote = (r) => (r?.vote ? `（+${r.vote}${r.vote - 3 * (r.duel || 0) > G.R.vote ? "・追い上げ" : ""}）` : "");
  /** HUD 左上の時計の1行: いまの点差（2人なら相手と、3〜4人なら自分以外のいちばん上と） */
  function standing() {
    if (G.phase !== "serve" || G.over) return null;
    const rivals = rivalIds().map((i) => G.P[i]), best = rivals.reduce((a, b) => (b.score > a.score ? b : a)), gap = G.P[ME].score - best.score, many = multi();
    const long = gap > 0 ? (many ? `あなたが${gap}点差で1位` : `あなたが${gap}点リード`) : gap < 0 ? (many ? `1位まで${-gap}点` : `${best.name}が${-gap}点リード`) : many ? "1位と同点" : "同点";
    const text = gap > 0 ? `+${gap}点` : gap < 0 ? `−${-gap}点` : "同点"; // 文字を減らす: 数だけ（くわしい言い方は title と読み上げに）
    return el(`span.ichi-standing${gap > 0 ? ".is-ahead" : gap < 0 ? ".is-behind" : ""}`, { dataset: { test: "ichi-standing", gap: String(gap) }, "aria-label": long,
      title: `${long}。${G.R.useVote ? `一票は+${G.R.vote}点。負けている人が取れば+${G.R.voteBehind}点` : "一口の点の合計で競う"}` }, text);
  }
  /** 顔・名前・点・票。タップでその人の一台（葉・セッティング・出しているカード）を開く */
  function leader(p, who) {
    const mine = who === "me";
    return el(`button.ichi-leader.is-${who}${G.active === p.index && !G.over ? ".is-active" : ""}`, { type: "button", dataset: { test: `ichi-score-${who}`, score: String(p.score), votes: String(p.votes) },
      "aria-label": `${mine ? "あなた" : p.name} ${p.score}点 票${p.votes}。一台を見る`, onclick: () => { sfx("select"); openRig(p, mine); } }, [
      mine ? el("span.ichi-leader-ring", faceNode("hajime", p.name)) : null,
      el("span.ichi-leader-plate", [
        el("span.ichi-leader-name", { text: mine ? "あなた" : p.name }),
        el("span.ichi-leader-score", [el("b", { text: String(p.score) }), el("small", { text: "点" })]),
        G.R.useVote ? el("span.ichi-leader-votes", [el("i.ichi-medal"), el("b", { text: `票 ${p.votes}` })]) : null,
        chaseChip(p),
      ]),
    ]);
  }
  /** 出している器具・人物（マットの札）。数字は風防の残り。空いた枠も見せる（器具3・人物1） */
  function permanents(p, mine, size) {
    const slots = [...Array.from({ length: RULES.toolMax }, (_, i) => p.tools[i] || null), p.person || null];
    return slots.map((id, i) => (id
      ? el(`button.ichi-perm.s-${size}`, { type: "button", "aria-label": `${CARD[id].name}：${CARD[id].tx}`, title: `${CARD[id].name}：${CARD[id].tx}`,
          onclick: () => { sfx("select"); openRig(p, mine); } }, [tcg("card", id, { size }), id === "windguard" ? el("b.ichi-counter", { text: String(p.wind) }) : null])
      : el(`i.ichi-slot.s-${size}${i === RULES.toolMax ? ".is-person" : ""}`)));
  }
  const modChips = (p) => [
    p.pend ? el("span.ichi-chip.is-warn", { text: `次の一口 ${dhText(p.pend)}` }) : null,
    p.sessMod ? el("span.ichi-chip", { text: `寄せ ${dhText(p.sessMod)}` }) : null,
    p.sessImp ? el("span.ichi-chip", { text: `印象 +${p.sessImp}（このセッション）` }) : null,
  ];
  /** このターンに、炭をあと足せるか・外せるか（1ターンに1つ足せて、1つ外せる）。自分のターンのあいだだけ出す（準備でも提供でも） */
  function coalLeft(p) {
    if (!p.turn || G.wait?.player !== p.index || !(G.wait.type === "main" || G.wait.type === "prep")) return null;
    const add = Math.max(0, G.R.coalAdds - (p.turn.adds || 0)), ash = Math.max(0, G.R.ashPerTurn - (p.turn.ashes || 0));
    const chip = (name, n) => el(`i${n ? "" : ".is-used"}`, { text: n ? name : `${name}済` });
    return el("span.ichi-coal-left", { dataset: { test: "ichi-coal-left", add: String(Math.min(add, 9)), ash: String(Math.min(ash, 9)) },
      title: "炭は1ターンに、1つ足せて（のせる・チャージ＆ドロー）、1つ外せる。炭カードを炭焼き場に置くのは何枚でも" }, [chip("足す", add), chip("外す", ash)]);
  }
  /** このターンにカードをあと何枚使えるか */
  function cardLeft(p) {
    const left = Math.max(0, G.R.cardsPerRound - (p.cardsUsed || 0));
    return el(`span.ichi-card-left${left ? "" : ".is-used"}`, { dataset: { test: "ichi-card-left", left: String(left) }, title: "カードは自分のターンに1枚" },
      [el("i", { text: left ? "カード" : "カード済" })]);
  }
  /** 一台の体力（ボウルの葉の枚数）とフレーバーミックス（主役・脇役）。10枚以上で濃厚 */
  function mixView(p, mine) {
    const grams = leavesOf(p); if (!grams) return null;
    const cap = BOWL[p.bowlId].cap, sd = sidesOf(p);
    const leaves = Object.entries(p.bowl).sort((a, b) => (a[0] === p.main ? -1 : b[0] === p.main ? 1 : b[1] - a[1]));
    const shown = mine ? leaves : leaves.filter(([id]) => id === p.main);
    return el(`span.ichi-mix${mine ? "" : ".is-foe"}`, { dataset: { test: mine ? "ichi-mix" : "ichi-foe-mix", hp: String(grams) }, "aria-label": `葉の体力 ${grams}（${leaves.map(([id, n]) => `${FLAVOR[id].name}${n}`).join("・")}）` }, [
      el("span.ichi-mix-leaves", shown.map(([id, n]) => el(`span.ichi-mix-leaf${id === p.main ? ".is-main" : sd.includes(id) ? ".is-side" : ""}`, { title: `${FLAVOR[id].name} ×${n}${id === p.main ? "（主役）" : sd.includes(id) ? "（脇役）" : ""}` },
        [flavorIcon(id), mine ? el("small", { text: FLAVOR[id].name }) : null, el("b", { text: String(n) })]))),
      el("span.ichi-hp", { title: `葉の体力 ${grams}／${cap}（${RULES.rich}枚以上で濃厚）` }, [
        el("small", { text: "体力" }),
        el("span.ichi-hp-bar", { style: { "--hp": `${Math.min(100, (grams / cap) * 100)}%`, "--rich": `${(RULES.rich / cap) * 100}%` } }, el(`i${grams >= RULES.rich ? ".is-rich" : ""}`)),
        el("b", { text: String(grams) })]),
    ]);
  }
  /**
   * 詰めた葉の札の束（2026-11-11 オーナー「フレーバーもカードで構成するから束ねてもいいし、フレーバーカードがあるように見せて」）。
   * 葉1枚＝札1枚。種類ごとに表向きで束ね、帯に枚数を書く（主役は金の帯、脇役は銀の帯）。枚数が多いほど束が厚い。
   * 束がフレーバーミックスで、全部の枚数が葉の体力（体力の棒は HUD 左）。まだ詰めていなければ、束を置く場所だけ見せる
   */
  function leafBundles(p, mine) {
    const sd = sidesOf(p);
    const leaves = Object.entries(p.bowl).filter(([, n]) => n > 0).sort((a, b) => (a[0] === p.main ? -1 : b[0] === p.main ? 1 : b[1] - a[1]));
    return el(`span.ichi-bundles.n-${Math.min(leaves.length, 4)}`, { dataset: { test: mine ? "ichi-bundles" : "ichi-foe-bundles", hp: String(leavesOf(p)) } }, leaves.length
      ? leaves.map(([id, n]) => {
        const role = id === p.main ? "main" : sd.includes(id) ? "side" : "";
        return el(`span.ichi-bundle.d-${Math.min(4, Math.ceil(n / 3))}${role ? `.is-${role}` : ""}`, { dataset: { test: "ichi-bundle", id, n: String(n) },
          title: `${FLAVOR[id].name} ×${n}${role === "main" ? "（主役）" : role === "side" ? "（脇役）" : ""}` }, [
          tcg("flavor", id, { size: "mini" }),
          el("b.ichi-bundle-band", [role ? el("small", { text: role === "main" ? "主役" : "脇役" }) : null, `×${n}`]),
        ]);
      })
      : el("i.ichi-slot.s-mini.is-leaf", { title: "詰めた葉の札が、ここに束で置かれる" }, el("small", { text: "葉" })));
  }
  /** 一台（葉の札の束・ボウルとHMDの札）。タップで一台の中身を開く */
  function settingCards(p, mine, size) {
    const grams = leavesOf(p), serve = G.phase === "serve";
    return el("button.ichi-setting", { type: "button", dataset: { test: mine ? "ichi-bowl" : "ichi-foe-bowl", leaves: Object.entries(p.bowl).map(([id, n]) => `${id}:${n}`).join(",") },
      "aria-label": `${mine ? "自分" : p.name}の一台（葉とセッティング）を見る`, onclick: () => { sfx("select"); openRig(p, mine); } }, [
      leafBundles(p, mine),
      el("span.ichi-setting-card", [tcg("bowl", p.bowlId, { size }), el("b.ichi-counter.is-grams", { text: mine && !serve ? `${grams}/${BOWL[p.bowlId].cap}g` : `${grams}g` })]),
      el("span.ichi-setting-card", tcg("hmd", p.hmd, { size })),
    ]);
  }
  /** 葉の体力（ボウルの葉の枚数）の棒。10枚以上で濃厚 */
  function hpView(p) {
    const grams = leavesOf(p), cap = BOWL[p.bowlId].cap;
    return el("span.ichi-hp", { dataset: { test: "ichi-hp", hp: String(grams) }, title: `葉の体力 ${grams}／${cap}（${RULES.rich}枚以上で濃厚）` }, [
      el("small", { text: "体力" }), el("b", { text: String(grams) }),
      el("span.ichi-hp-bar", { style: { "--hp": `${Math.min(100, (grams / cap) * 100)}%`, "--rich": `${(RULES.rich / cap) * 100}%` } }, el(`i${grams >= RULES.rich ? ".is-rich" : ""}`))]);
  }
  /** 炭焼き場（4つまで）。置いたばかりは横向き、火がまわると縦向き、焼けたら光る。自分の焼けた炭はタップで火力ゾーンへのせる。
   *  place＝選んでいる炭カードの手札の位置（置けるときだけ）。最初の空き枠が「ここに置く」になる */
  function stoveSlots(p, mine, size, place = null) {
    const firstEmpty = p.stove.length;
    return Array.from({ length: slotsOf(p) }, (_, i) => {
      const c = p.stove[i];
      if (!c) {
        if (place === null || i !== firstEmpty) return el(`i.ichi-slot.s-${size}`);
        return el(`button.ichi-ghost.is-place.s-${size}`, { type: "button", dataset: { test: "ichi-place-slot" }, "aria-label": "選んだ炭カードを炭焼き場に置く",
          onclick: () => { sfx("click"); submit({ type: "place", hand: place }); } }, [el("b", { text: "＋" }), el("small", { text: "ここに置く" })]);
      }
      const ready = c.stage === 2, left = 2 - c.stage;
      const can = mine && G.wait && human(G.wait.player) && canPutOn(G, p, i).ok;
      return el(`button.ichi-stove-coal.s-${size}.st-${c.stage}${can ? ".can" : ""}${isFresh("stove", p, i) ? ".is-new" : ""}`, { type: "button", disabled: !can, title: `${CARD[c.id].name}：${ready ? "焼けた" : `あと${left}ターン`}`,
        dataset: { test: mine ? `ichi-stove-${i}` : null, stage: String(c.stage) }, onclick: () => { if (can) { sfx("click"); submit({ type: "puton", stove: i }); } } }, [
        tcg("card", c.id, { size }), coalGlow(c.id, STOVE_STATE[c.stage]), mine ? el("small.ichi-counter", { text: ready ? "のせる ➜" : `あと${left}` }) : null]);
    });
  }

  /** HUD 左上: 相手の点と票、熱と帯、主役の葉と体力（卓の奥は小さく見えるので、数はここで読む） */
  function foePanel(op) {
    const h = heatOf(op);
    return el("div.ichi-foe-panel", [leader(op, "foe"),
      el("div.ichi-foe-gauge", { dataset: { test: "ichi-foe-fire", heat: String(h), left: String(firepower(op)) }, title: `熱${h}・火力${fireOf(op)}（炭の火の合計。熱は、ターンの終わりに火力へ1近づく）` }, [
        el("div.ichi-foe-heat", [el("small", { text: "熱" }), el("b", { text: String(h) }), op.main ? strip(op.main, { now: G.phase === "serve" ? h : null, line: scorchLineOf(op) }) : null]),
        el("div.ichi-mods", modChips(op))]),
      mixView(op, false)]);
  }
  /** HUD 上: いまのフェイズ・ラウンド・先手・読んだ審査カード */
  function clock(w) {
    const rounds = roundsOf(G), serve = G.phase === "serve", judges = G.tour.judges;
    const phaseName = G.phase === "embers" ? "はじめの炭" : G.phase === "prep" ? `準備 ${w ? w.n ?? "" : ""}/${G.R.prepTurns}` : `ラウンド ${Math.min(G.round + 1, rounds)}/${rounds}`;
    const pips = serve ? el("span.ichi-pips", { "aria-hidden": "true" }, Array.from({ length: rounds }, (_, i) => el(`i${i < G.round ? ".is-done" : i === G.round ? ".is-now" : ""}${i % 3 === 2 ? ".is-gap" : ""}`))) : null;
    // 第0.5版: このラウンドの審査カードは、はじめにめくってある（全員が見ている）。「吸い方を読む」で見たのは次のラウンドの分
    const first = G.R.revealFirst, pk = first ? G.P[ME].peek : ui.peek && !G.judge ? ui.peek : null;
    const nowJudge = first && serve && G.judge?.judge && !G.over ? el(`span.ichi-now-judge${G.judge.dh > 0 ? ".is-up" : G.judge.dh < 0 ? ".is-down" : ""}`, { dataset: { test: "ichi-now-judge", dh: String(G.judge.dh || 0) }, title: `今回の審査：${G.judge.tx}`, "aria-label": `今回の審査 ${G.judge.style}`},
      [el("b", { text: G.judge.style }), el("strong", { text: dhText(G.judge.dh || 0) })]) : null;
    const peek = pk && serve ? el("span.ichi-peek", { dataset: { test: "ichi-peek" } }, [el("small", { text: first ? "次のラウンド" : "読んだ" }), el("b", { text: `${pk.style} ${dhText(pk.dh)}` })]) : null;
    return el("div.ichi-clock", [
      el("b", { text: phaseName, dataset: { test: "ichi-phase" } }), pips,
      el("small", { text: serve ? `${G.order?.[0] === ME ? "あなた" : G.P[G.order?.[0] ?? CPU].name}が先手` : G.tour.name }),
      standing(),
      // 審査員の顔: 提供では卓の「審査の山」の横に出す。準備のあいだはここに出す
      !serve && judges.length ? el("span.ichi-judges", judges.map((id) => faceNode(JUDGE_FACE[id], JUDGE[id].name, ".is-judge"))) : null,
      nowJudge, peek,
    ]);
  }
  // 卓の中央: 「相手の一口」・審査の山と審査員・「自分の一口」（仕込んだ一口のカードを表向きに置く。相手のものも見える）。
  // 準備のあいだは審査の山を置かない（マットの印だけ）
  function centerStrip(me, op) {
    const judges = G.tour.judges, serve = G.phase === "serve";
    const pile = el("button.ichi-pile", { type: "button", dataset: { test: "ichi-pile", left: String(judges.length ? G.pile.length : 0) }, "aria-label": "審査カードの残りと審査員を見る",
      onclick: () => { sfx("select"); openJudges(); } }, [
      el("i.ichi-back.is-judge.s-mini"), judges.length ? el("b.ichi-count", { text: String(G.pile.length) }) : null]);
    const slot = (p, mine) => {
      const cards = serve && p.puff?.cards?.length && !p.puff.scored ? p.puff.cards : [];
      return zoneBox(mine ? "自分の一口" : `${p.name}の一口`, `.is-puff.is-${mine ? "me" : "foe"}${cards.length ? ".is-set" : ""}`, { dataset: { test: mine ? "ichi-puff-me" : "ichi-puff-foe" } },
        el("div.ichi-row", cards.length
          ? cards.map((id) => el("span.ichi-set", { dataset: { test: "ichi-set-card", card: id }, title: `仕込み ${CARD[id].name}：${CARD[id].tx}` }, [tcg("card", id, { size: "mini" }), el("small.ichi-counter", { text: CARD[id].name })]))
          : el("i.ichi-slot.s-mini")));
    };
    return el("div.ichi-center", [
      op ? slot(op, false) : turnOrder(),
      serve ? zoneBox(judges.length ? "審査の山" : "練習", ".is-judge", {}, [pile, !judges.length ? null
        // 第0.5版: このラウンドの審査カードは、はじめにめくって山の横に置く（めくった審査員の顔と、吸い方）
        : G.R.revealFirst && G.judge?.judge && !G.over ? el(`span.ichi-open-puff${G.judge.dh > 0 ? ".is-up" : G.judge.dh < 0 ? ".is-down" : ""}`, { dataset: { test: "ichi-open-puff" }, title: `${JUDGE[G.judge.judge].name}「${G.judge.style}」：${G.judge.tx}` },
          [faceNode(JUDGE_FACE[G.judge.judge], JUDGE[G.judge.judge].name, ".is-judge"), el("b", { text: G.judge.style }), el("strong", { text: dhText(G.judge.dh || 0) })])
          : el("span.ichi-judges", judges.map((id) => faceNode(JUDGE_FACE[id], JUDGE[id].name, ".is-judge")))])
        : el("i.ichi-center-mark", { "aria-hidden": "true" }),
      slot(me, true),
    ]);
  }

  /** 4人対戦の卓の中央の左: 手番の回る順（先手から）。いまの番の人に印 */
  function turnOrder() {
    const n = G.P.length, order = G.phase === "serve" && G.order ? G.order : G.P.map((_, k) => ((G.prepFirst ?? G.lead) + k) % n);
    return zoneBox("手番の順", ".is-order", { dataset: { test: "ichi-order", order: order.join(",") } }, el("div.ichi-row", order.map((i) =>
      el(`span.ichi-order-chip${G.active === i && !G.over ? ".is-now" : ""}${i === ME ? ".is-me" : ""}`, { title: i === ME ? "あなた" : G.P[i].name }, faceNode(info[i]?.id, G.P[i].name)))));
  }
  /** いまの審査カード（提供でめくられていれば、それ。準備のあいだと練習試合は「ふつうに吸う」） */
  const judgeNow = () => (G.phase === "serve" && G.judge) || PUFFS.normal;
  /** 自分のターンのあいだか（熱は、このターンの終わりに火力へ1近づく） */
  const turnOpen = (p) => !!p.turn && G.wait?.player === p.index && !G.over;
  /** このターンを終えたあとの熱（蒸らし）。自分のターンでなければ、いまの熱のまま */
  const heatNext = (p, fire = fireOf(p)) => (turnOpen(p) ? settledHeat(G, heatOf(p), fire) : heatOf(p));
  /** 熱の動く向きの印 */
  const trendMark = (from, to) => (to > from ? "▲" : to < from ? "▼" : "＝");
  /**
   * ねらう熱: 主役の葉のジャスト（無ければ適温のまんなか）を、いまの審査カード・HMD・寄せ・煽りを入れて「熱」に直した数。
   * 返り値 { f, h（いまの熱）, next（このターンを終えたあとの熱）, fire（火力）, d（判定熱−熱）, lo, hi（適温を熱に直した幅）, justs, target,
   *          diff（ターンを終えたあと、あといくつ）, zone（このままターンを終えたら、どの帯か） }
   */
  function heatGoal(me) {
    const f = me.main ? FLAVOR[me.main] : null;
    if (!f) return null;
    const h = heatOf(me), next = heatNext(me), d = judgedHeat(me, judgeNow()) - h, top = RULES.heatMax;
    const lo = f.lo - d, hi = f.hi - d, justs = f.j.map((j) => j - d).filter((x) => x >= 0 && x <= top);
    const mid = Math.max(0, Math.min(top, Math.round((lo + hi) / 2)));
    const target = justs.length ? justs.reduce((a, b) => (Math.abs(b - h) < Math.abs(a - h) ? b : a)) : mid;
    return { f, h, next, fire: fireOf(me), d, lo, hi, justs, target, diff: target - next, zone: zoneCls(rawZone(f, next + d, scorchLineOf(me))) };
  }
  /** 案内の「ねらい」の1行。いま何を目ざしているか（はじめの炭＝枚数、準備＝葉の枚数 → 熱、提供＝今回の審査に合う熱） */
  function goalLine(me, w) {
    const row = (strong, text, data = {}) => el("div.ichi-goal", { dataset: { test: "ichi-goal", ...data } }, [el("i", { text: "ねらい" }), el("b", { text: strong }), el("span", { text })]);
    if (w.type === "embers") return row(`炭${embersOf(G, me)}枚`, "熱は0から。炭を置くと、じわっと上がる");
    // 準備で、まだ詰められるあいだ: 葉の枚数（ボウルいっぱいまで。葉は一口ごとに1枚減る）
    if (w.type === "prep" && canPack(G, me).ok) {
      const cap = BOWL[me.bowlId].cap, now = leavesOf(me);
      const mix = me.plan.map(([id]) => `${FLAVOR[id].name}${me.bowl[id] || 0}`).join("・");
      return row(`葉${now}/${cap}枚`, mix, { leaves: String(now), want: String(cap) });
    }
    const g = heatGoal(me);
    if (!g) return null;
    const q = judgeNow(), star = g.justs.includes(g.target) ? "★" : "";
    // いまの熱 → このターンを終えたあとの熱（蒸らし）。ねらいまで、あといくつか
    const move = g.next !== g.h ? `いま${g.h}${trendMark(g.h, g.next)}${g.next}` : `いま${g.h}`;
    const state = g.diff > 0 ? `${move}・あと+${g.diff}` : g.diff < 0 ? `${move}・${-g.diff}高い` : `${move}・ぴったり`;
    const data = { target: String(g.target), now: String(g.h), next: String(g.next) };
    if (w.type === "prep") return row(`熱${g.target}${star}`, state, data);
    return row(`熱${g.target}${star}`, `${state}${q.dh ? `（審査${dhText(q.dh)}込み）` : ""}`, { ...data, dh: String(q.dh || 0) });
  }
  /** 案内の「流れ」: このターンにすることの順番と、いまどこか */
  function flowSteps(w, me, hint) {
    const t = hint?.action.type;
    let steps = null, now = 0;
    if (w.type === "embers") { steps = ["炭にする札を選ぶ", "炭を置く"]; now = hint && !hint.targets.some((q) => q.includes("ichi-hand-")) ? 1 : 0; }
    else if (w.type === "prep") {
      if (G.R.prepack) { steps = ["炭を置く・足す", "終える"]; now = t === "end" ? 1 : 0; } // 入門: 詰めてあるので、炭を焼くだけ
      else { steps = ["葉を詰める", "炭を置く・足す", "終える"]; now = t === "end" ? 2 : canPack(G, me).ok && (t === "pack" || !t) ? 0 : 1; }
    } else if (w.type === "cool") { steps = ["炭が弱る", "炭を足す・外す", "カード1枚", "終える"]; now = 0; }
    else if (w.type === "main") { steps = ["炭が弱る", "炭を足す・外す", "カード1枚", "終える"]; now = t === "end" ? 3 : t === "play" ? 2 : 1; }
    if (!steps) return null;
    return el("div.ichi-steps", { dataset: { test: "ichi-steps", now: String(now) }, "aria-label": `このターンの流れ: ${steps.map((x, i) => `${i + 1} ${x}${i === now ? "（いま）" : ""}`).join("、")}` },
      steps.map((x, i) => el(`span${i < now ? ".is-done" : i === now ? ".is-now" : ""}`, { title: x }, [el("i", { text: i < now ? "✓" : String(i + 1) }), i === now ? x : null]))); // 名前を出すのは、いまの段だけ
  }

  // ───────── 次にすること（ガイド） ─────────
  // いまの入力待ちに打つとよい1手を、CPU（つよい）と同じ考え方で決め、言葉と「押す場所」にする。相手の手札や山札の順は見ない。
  // 2手で打つもの（札を選ぶ → 置く・使う）は、選ぶ前は札を、選んだあとはボタンを指す。1手打つたびに次の手へ進む
  let hintCache = { key: "", hint: null };
  function hintNow(w) {
    const me = G.P[ME];
    if (!ui.assist || !w || !human(w.player) || G.over || AUTO_WAITS.has(w.type)) return null;
    const key = `${G.log.length}:${w.type}:${w.n ?? ""}:${me.hand.join()}:${me.zone.map((c) => c.f).join()}:${me.stove.map((c) => c.stage).join()}:${me.cardsUsed}:${me.turn?.packed ?? ""}:${me.turn?.adds ?? ""}:${me.turn?.ashes ?? ""}:${heatOf(me)}:${leavesOf(me)}`;
    if (hintCache.key !== key) {
      let a = null; try { a = aiAct(G, ME); } catch { a = null; }
      const hint = a && describeHint(a, me, w);
      // 入門の一局: 手の下に「なぜ」を1行添える（カードを使う手は、カードの説明がもう付いている）
      if (hint && cfg?.intro && !hint.sub) hint.sub = INTRO_WHY[a.type === "end" && w.type === "prep" ? "end_prep" : a.type] || null;
      hintCache = { key, hint };
    }
    const h = hintCache.hint;
    return h && { ...h, targets: h.where() };
  }
  const T = (name) => `[data-test="${name}"]`;
  function describeHint(a, me, w) {
    const sel = (i) => ui.sel?.type === "hand" && ui.sel.i === i, name = (i) => CARD[me.hand[i]]?.name || "札";
    const sameSet = (list) => list.length === ui.picks.size && list.every((i) => ui.picks.has(i));
    const sameCounts = (picks) => { const ks = new Set([...Object.keys(picks), ...Object.keys(ui.counts)]); return [...ks].every((k) => (picks[k] || 0) === (ui.counts[k] || 0)); };
    // 炭の手のあとに、熱がどこへ向かうか（「→ 熱5へ」）。火力がいくつになるかより、熱がどう動くかを言う
    const toward = (fire) => { const n = heatNext(me, fire), h = heatOf(me); return n === h ? `熱は${h}のまま` : `熱は${h}${trendMark(h, n)}${n}へ`; };
    if (a.type === "embers") return { action: a, text: `手札から${a.picks.length}枚えらんで「炭を置く」（光っている札が、手放してよい札）`, where: () => (sameSet(a.picks) ? [T("ichi-embers")] : a.picks.filter((i) => !ui.picks.has(i)).map((i) => T(`ichi-hand-${i}`))) };
    if (a.type === "pack") { const ps = Object.entries(a.picks).filter(([, n]) => n > 0);
      return { action: a, text: `葉を詰める：${ps.map(([id, n]) => `${FLAVOR[id].name}${n}枚`).join("・")}`, where: () => (sameCounts(a.picks) ? [T("ichi-pack")] : ps.filter(([id, n]) => (ui.counts[id] || 0) < n).map(([id]) => `${T(`ichi-market-${id}`)} .ichi-pile-main`)) }; }
    if (a.type === "place") return { action: a, text: `「${name(a.hand)}」を炭焼き場に置く（焼けたら、のせられる）`, where: () => (sel(a.hand) ? [T("ichi-place-slot"), T("ichi-do-place")] : [T(`ichi-hand-${a.hand}`)]) };
    if (a.type === "puton") { const c = me.stove[a.stove]; return { action: a, text: `焼けた${CARD[c.id].name}をのせる（火力+${CARD[c.id].heat}。${toward(fireOf(me) + CARD[c.id].heat)}）`, where: () => [T(`ichi-stove-${a.stove}`)] }; }
    if (a.type === "charge") return { action: a, text: `「${name(a.hand)}」を裏向きで置く（火力+1・1枚引く。${toward(fireOf(me) + 1)}）`, where: () => (sel(a.hand) ? [T("ichi-charge-slot"), T("ichi-do-charge")] : [T(`ichi-hand-${a.hand}`)]) };
    if (a.type === "ash") { const lv = coalHeat(me.zone[a.zone]);
      return { action: a, text: `炭を1つ外す（火力−${lv}。${toward(fireOf(me) - lv)}）`, where: () => (ui.sel?.type === "zone" && ui.sel.i === a.zone ? [T("ichi-do-ash")] : [T(`ichi-coal-${a.zone}`)]) }; }
    if (a.type === "play") { const c = CARD[me.hand[a.hand]], puff = c.when === "puff" && !G.R.reactAfterReveal;
      return { action: a, sub: c.tx, text: `「${c.name}」を${puff ? "この一口に仕込む" : "使う"}${a.target != null ? `（${G.P[a.target].name}に）` : ""}`, where: () => (sel(a.hand) ? [T(a.target != null && multi() ? `ichi-do-play-${a.target}` : "ichi-do-play")] : [T(`ichi-hand-${a.hand}`)]) }; }
    if (a.type === "end") { const g = w.type === "main" ? heatGoal(me) : null, tw = toward(fireOf(me));
      return { action: a, text: w.type === "prep" ? `「ターンを終える」（${tw}）` : !g || g.diff === 0 ? `熱はねらいどおり。「ターンを終える」（${tw}）` : g.zone === "just" || g.zone === "band" ? `適温に入る。「ターンを終える」（${tw}）` : `熱が動くのは1ターンに1。「ターンを終える」（${tw}）`, where: () => [T("ichi-end")] }; }
    if (a.type === "discard") return { action: a, text: `手札は7枚まで。光っている札を灰にする`, where: () => (sameSet(a.picks) ? [T("ichi-discard")] : a.picks.filter((i) => !ui.picks.has(i)).map((i) => T(`ichi-hand-${i}`))) };
    if (a.type === "wear") { const ps = Object.entries(a.picks).filter(([, n]) => n > 0);
      return { action: a, text: `減らす葉：${ps.map(([id, n]) => `${FLAVOR[id].name}${n}枚`).join("・")}`, where: () => (sameCounts(a.picks) ? [T("ichi-wear")] : ps.filter(([id, n]) => (ui.counts[id] || 0) < n).map(([id]) => T(`ichi-leaf-${id}`))) }; }
    if (a.type === "weaken") return { action: a, text: "すきま風を受けた。火の小さい炭を選ぶ", where: () => [T(`ichi-coal-${a.zone}`)] };
    if (a.type === "pass") return { action: a, text: "このまま受ける", where: () => [T("ichi-pass")] };
    return null;
  }
  /** 描き直したあと、次に押す場所を光らせる */
  let hintToken = 0;
  function markHint(hint) {
    for (const n of root.querySelectorAll(".is-hint")) n.classList.remove("is-hint");
    for (const n of root.querySelectorAll(".ichi-pointer")) n.remove();
    root.dataset.assist = ui.assist ? "1" : "0";
    const token = ++hintToken;
    if (!hint || ui.sheet) return;
    const nodes = [];
    for (const q of hint.targets) for (const n of root.querySelectorAll(q)) { if (n.disabled) continue; n.classList.add("is-hint"); if (nodes.length < 3) nodes.push(n); }
    // 押す場所の上に、小さな矢印を出す（使える札の金の枠と見分けるため。3つまで）。
    // 札が動いている途中（置いた直後・盆が出た直後）に測ると場所がずれるので、動きが収まったころにもう一度合わせる
    const place = () => {
      if (token !== hintToken) return;
      for (const n of root.querySelectorAll(".ichi-pointer")) n.remove();
      const rr = root.getBoundingClientRect(), k = rr.width / 1280 || 1;
      for (const n of nodes) {
        if (!n.isConnected) continue;
        const r = n.getBoundingClientRect();
        if (!r.width) continue;
        root.append(el("i.ichi-pointer", { "aria-hidden": "true", dataset: { test: "ichi-pointer" }, style: { left: `${Math.round((r.left + r.width / 2 - rr.left) / k)}px`, top: `${Math.round((r.top - rr.top) / k)}px` } }, el("b", { text: "ここ" })));
      }
    };
    place();
    if (!quick()) setTimeout(place, 420);
  }
  /** いま何をすればよいか（短い一文）と、できることのボタン */
  function guide(me, op, w) {
    const lines = [], buttons = [];
    const btn = (text, action, { primary = false, test = null, disabled = false, title = null } = {}) =>
      buttons.push(el(`button.ichi-btn${primary ? ".is-primary" : ""}`, { type: "button", text, disabled, title, dataset: { test }, onclick: () => { sfx("select"); typeof action === "function" ? action() : submit(action); } }));
    if (!w) return { lines, buttons };
    const mine = human(w.player), guided = ui.assist && mine;
    const hint = hintNow(w), auto = mine && AUTO_WAITS.has(w.type);
    // 炭の手引き（ガイドを切っているとき。ガイドつきは「ねらい」と「つぎ」が同じことを言う）
    const tips = mine && !auto && !guided ? coalTips(me, w) : [];
    const head = (text) => lines.push(el("b", { text }));
    const note = (text, attrs = {}) => lines.push(el("span", { text, ...attrs }));         // 場面の説明（ガイドつきでは「ねらい」「つぎ」に任せて出さない）
    const keep = (node) => { node.classList.add("is-keep"); lines.push(node); };           // ガイドつきでも出す部品
    const say1 = (text) => { if (!tips.length) note(text); };
    if (!mine) {
      head(`${G.P[w.player].name}の番`);
      keep(el("span", { dataset: { test: "ichi-waiting" }, text: ui.note || "相手が手を進めている。あなたの番まで待つ" }));
    } else if (w.type === "embers") {
      // はじめの炭: 手札から3枚を裏向きで置く（種火＝火1ずつ）。熱は0から
      const n = ui.picks.size, need = embersOf(G, me);
      head("はじめの炭");
      note(`手札から${need}枚を、炭（種火）として置く（いま${n}枚）。熱は0から、ターンの終わりに1ずつ上がる`);
      btn(`炭を置く（${n}/${need}枚）`, { type: "embers", picks: [...ui.picks] }, { primary: true, test: "ichi-embers", disabled: n !== need });
    } else if (w.type === "prep") {
      // 準備（第0.8版）: 葉を詰めながら、炭にも触れる。熱は、ターンの終わりに火力へ1近づく
      const total = sum(ui.counts), left = Math.max(0, G.R.prepTurns - (w.n || 1)), cp = canPack(G, me);
      head(`準備 ${w.n || 1}/${G.R.prepTurns}：${G.R.prepack ? "炭を焼いて、熱を上げる" : "葉を詰めて、炭を育てる"}`);
      // 選んだ枚数と、押せない理由は、葉の盆の見出しに字で出す（prepMarket。指で触る画面では、ボタンの上の説明が読めない）
      if (cp.ok) say1(`葉を選んで詰める（${total}/${packLimit(G, me)}枚）。炭も置ける`); else say1("炭を焼いて、のせる。終わったらターンを終える");
      const shut = cp.ok && marketShut(); // 盆をしまっている
      if (shut) btn("葉の盆をひらく", () => { ui.marketOff = null; render(); }, { test: "ichi-market-open", title: "葉を選んで詰める" });
      else if (cp.ok) btn(`詰める${total ? `（${total}枚）` : ""}`, { type: "pack", picks: { ...ui.counts } }, { primary: total > 0, test: "ichi-pack", disabled: !total, title: "選んだ葉をボウルに詰める" });
      btn("ターンを終える", { type: "end" }, { primary: !(cp.ok && total > 0), test: "ichi-end" });
      if (guided && !left) keep(el("small.ichi-why", { text: "準備はこのターンで終わり。次は提供（審査がはじまる）" }));
    } else if (auto) {
      // 自動で進むところ（炭が弱る・すきま風）。ここでは押すものは無い
      if (w.type === "cool") { head("炭が弱る"); keep(el("span", { dataset: { test: "ichi-auto-cool" }, text: "火の小さい炭の火が1下がる" })); }
      else if (w.type === "wear") { head("セッションの区切り"); keep(el("span", { dataset: { test: "ichi-auto-wear" }, text: `葉が${w.n}枚減る` })); }
      else { head("すきま風"); keep(el("span", { dataset: { test: "ichi-auto-weaken" }, text: "火の小さい炭の火が1下がる" })); }
    } else if (w.type === "cool") {
      head(`炭が弱る：火を下げる炭を選ぶ${w.left > 1 ? `（あと${w.left}）` : ""}`);
      keep(el("span", { text: "選んだ炭の火が1下がる（0で灰）" }));
      if (me.wind > 0) btn(`風防で受ける（残り${me.wind}）`, { type: "cool", wind: true }, { test: "ichi-wind" });
    } else if (w.type === "main") {
      head("あなたのターン"); say1("炭を足し引きして、カードを1枚まで使い、ターンを終える");
      btn("ターンを終える", { type: "end" }, { primary: true, test: "ichi-end" });
    } else if (w.type === "discard") {
      const need = me.hand.length - RULES.handMax;
      head("手札は7枚まで"); keep(el("span", { text: `灰にする${need}枚を選ぶ（${ui.picks.size}/${need}）` }));
      btn("灰にする", { type: "discard", picks: [...ui.picks] }, { primary: true, test: "ichi-discard", disabled: ui.picks.size !== need });
    } else if (w.type === "react") {
      const pv = puffPreview(G, me);
      head("審査：一口の技を使える"); keep(el("span.ichi-preview", { dataset: { test: "ichi-preview", zone: pv.zone } }, [`判定熱 ${pv.h} → `, el(`i.z-${pv.zone}`, { text: ZONE_LABEL[pv.zone] }), ` ${pv.pts}点`]));
      btn("このまま受ける", { type: "pass" }, { primary: true, test: "ichi-pass" });
    } else if (w.type === "wear") {
      const total = sum(ui.counts);
      head(`セッションの区切り：葉を${w.n}枚減らす（${total}/${w.n}）`); keep(wearPicker(me, w, total));
      btn("減らす", { type: "wear", picks: { ...ui.counts } }, { primary: true, test: "ichi-wear", disabled: total !== w.n });
    } else if (w.type === "weaken") {
      head("すきま風"); keep(el("span", { text: "弱める炭を1つ選ぶ" }));
    }
    // ガイドつき: 見出し →「流れ」（このターンの順番と、いまどこか）→「ねらい」（何を目ざすか）→「つぎ」（いま打つ1手）の順に並べる
    let out = lines;
    if (guided) {
      out = [lines[0]];
      const steps = flowSteps(w, me, hint), goal = ["embers", "prep", "main"].includes(w.type) ? goalLine(me, w) : null;
      if (steps) out.push(steps);
      if (goal) out.push(goal);
      // カードを使う手には、そのカードが何をするかを1行添える（札を開かなくても分かるように）
      if (hint) out.push(el("div.ichi-next", { dataset: { test: "ichi-next-step", action: hint.action.type } }, [el("i", { text: "つぎ" }), el("span", { text: hint.text }),
        hint.sub ? el("small", { dataset: { test: "ichi-next-why" }, title: hint.sub, text: hint.sub }) : null]));
      out.push(...lines.slice(1).filter((n) => n.classList.contains("is-keep")));
    }
    // 「おすすめで進める」で、「つぎ」の手をそのまま打てる
    if (hint) buttons.push(el("button.ichi-btn.is-assist", { type: "button", dataset: { test: "ichi-do-hint" }, title: "「つぎ」の手を、そのまま打つ", onclick: () => { sfx("select"); submit(hint.action); } }, [el("small", { text: "おすすめで" }), "進める"]));
    // 自分の手で起きたこと（炭が弱った・灰になった など）
    if (mine && ui.last) out.push(el("small.ichi-last", { dataset: { test: "ichi-last" }, text: `↳ ${ui.last}` }));
    if (ui.toast) out.push(el("em.ichi-toast", { text: ui.toast, dataset: { test: "ichi-toast" } }));
    if (tips.length) out.push(el("div.ichi-tips", { dataset: { test: "ichi-tips" } }, tips.map((t) => el(`small.is-${t.kind}`, [el("i", { text: t.kind === "now" ? "熱" : t.kind === "next" ? "次" : "炭" }), t.text]))));
    return { lines: out, buttons };
  }
  /** セッションの区切りに減らす葉を選ぶ（詰めた葉はふだん卓に出さないので、ここでだけ並べる） */
  function wearPicker(me, w, total) {
    const sd = sidesOf(me);
    return el("span.ichi-wear", { dataset: { test: "ichi-wear-picker" } }, Object.entries(me.bowl).sort((a, b) => (a[0] === me.main ? -1 : b[0] === me.main ? 1 : b[1] - a[1])).map(([id, n]) => {
      const cut = ui.counts[id] || 0;
      return el(`button.ichi-leaf.can.k-${FLAVOR[id].kind}`, { type: "button", dataset: { test: `ichi-leaf-${id}` }, "aria-label": `${FLAVOR[id].name} ${n - cut}枚。1枚減らす`,
        onclick: () => { ui.counts[id] = total >= w.n || cut >= n ? 0 : cut + 1; sfx("click"); render(); } },
        [flavorIcon(id), el("span", { text: `${FLAVOR[id].name} ×${n - cut}` }), cut ? el("b", { text: `−${cut}` }) : null, id === me.main ? el("small", { text: "主役" }) : sd.includes(id) ? el("small", { text: "脇役" }) : null]);
    }));
  }

  /** 「ふつうに吸う」なら、いまの一台の印象はいくつか（仕込んだカードも入れる）。相手のぶんも出して、一票の見込みを見せる */
  function impressionNow(p) {
    if (!p.main) return 0;
    const pf = p.puff || {}, q = judgeNow(), s = scorePuff(p, judgedHeat(p, q, pf.tk || 0), q, { blow: pf.blow });
    const good = s.zone === "just" || s.zone === "band";
    return impressionOf(p, s, (pf.impress || 0) + (s.zone === "just" ? 2 * (pf.allIn || 0) : 0) + (good ? pf.warm || 0 : 0) + (p.sessImp || 0), G.R.impress);
  }
  function impressionView(me) {
    if (G.phase !== "serve" || !me.main) return null;
    if (!G.R.useVote) return null; // 一票の無い対戦（入門）では、印象は出さない
    const imps = rivalIds().map((i) => [i, impressionNow(G.P[i])]), b = Math.max(...imps.map((x) => x[1])), a = impressionNow(me); // 相手のうち、いちばん高い印象
    // 一票の点は、そのときの点で変わる（負けている人が取れば+3・ふつうは+2。第0.6版の先行分）。取れたら何点かも見せる
    const top = imps.find((x) => x[1] === b)?.[0], pts = a > b ? votePtsOf(G, me) : a < b && top != null ? votePtsOf(G, G.P[top]) : null;
    return el(`span.ichi-imp${a > b ? ".is-ahead" : a < b ? ".is-behind" : ""}`, { dataset: { test: "ichi-impression", me: String(a), foe: String(b), vote: pts == null ? "" : String(pts) },
      title: `印象＝味値＋帯（ジャスト・適温+1／ズレ−1）＋濃厚＋カード。高い方に一票。一票は+${G.R.vote}点、負けている人が取れば+${G.R.voteBehind}点` },
      [el("small", { text: "印象" }), el("b", { text: String(a) }), el("span", { text: `対 ${b}` }), a > b ? el("small", { text: `一票+${pts}` }) : null]);
  }
  /** HUD 左: 自分の熱と、熱の向かう先（蒸らし）、火力、判定熱、カードをあと何枚使えるか、葉の体力、寄せ・煽りの印 */
  function heatRead(me) {
    const h = heatOf(me), fire = fireOf(me), next = heatNext(me), open = turnOpen(me), base = judgedHeat(me, judgeNow(), 0, next);
    const dir = next > h ? "up" : next < h ? "down" : "keep";
    return el("div.ichi-heat-read", { dataset: { test: "ichi-pillar", heat: String(h), fire: String(fire) }, "aria-label": `熱 ${h}・火力 ${fire}` }, [
      el("div.ichi-fire-count", { dataset: { test: "ichi-firepower", left: String(fire), total: String(h) } }, [el("small", { text: "熱" }), el("b", { text: String(h) }),
        // 蒸らし: このターンを終えると、熱が火力へ1近づく（▲上がる・▼下がる・＝そのまま）
        open ? el(`i.ichi-trend.is-${dir}`, { dataset: { test: "ichi-trend", dir, next: String(next) }, title: `ターンを終えると、熱は${next === h ? `${h}のまま` : `${next}になる`}（火力${fire}へ1近づく）`, text: `${trendMark(h, next)}${next === h ? "" : next}` }) : null]),
      el(`small.ichi-fire-now.is-${fire > h ? "up" : fire < h ? "down" : "keep"}`, { dataset: { test: "ichi-fire", n: String(fire) }, title: "火力＝炭の火の合計。熱は、ターンの終わりに火力へ1近づく", text: `火力 ${fire}` }),
      base !== next ? el("small.ichi-thermo-base", { text: `判定 ${base}` }) : null,
      el(`small.ichi-coal-count${me.zone.length >= coalMaxOf(me) ? ".is-full" : ""}`, { dataset: { test: "ichi-coal-count", n: String(me.zone.length), max: String(coalMaxOf(me)) }, title: `炭は${coalMaxOf(me)}つまで。火力は炭の火の合計`, text: `炭 ${me.zone.length}/${coalMaxOf(me)}` }),
      el("button.ichi-coal-help", { type: "button", dataset: { test: "ichi-coal-help" }, text: "？", title: "炭の使い方", "aria-label": "炭の使い方を開く",
        onclick: () => { sfx("select"); openHelp(cfg?.intro ? INTRO_HELP_PAGES.findIndex((x) => x.title === "炭と熱") : HELP_PAGES.findIndex((x) => x.title === "炭の活用法")); } }),
      coalLeft(me),
      cardLeft(me),
      leavesOf(me) ? hpView(me) : null,
      el("div.ichi-mods", modChips(me)),
    ]);
  }
  /**
   * マットの半分（相手と自分で同じ並び。卓のまんなかで点対称）: 炭焼き場・ボウルとHMD・器具と人物・山札と灰。
   * 自分は左から、相手は右から並ぶ（札も向こう向き）。炭焼き場は火力ゾーンの柱のとなり
   */
  function half(p, mine, w, myTurn) {
    const si = mine && myTurn && ui.sel?.type === "hand" ? ui.sel.i : null, selId = si === null ? null : p.hand[si];
    const placeAt = selId && CARD[selId].type === "coal" && canPlace(G, p, selId).ok ? si : null;
    const ready = p.stove.some((c) => c.stage === 2);
    const boxes = [
      zoneBox("炭焼き場", `.is-stove${placeAt === null ? "" : ".is-target"}`, { dataset: { test: mine ? "ichi-stove" : "ichi-foe-stove", count: String(p.stove.length) } }, [
        el(`i.ichi-flow${ready ? ".is-hot" : ""}`, { "aria-hidden": "true", title: "焼けたら火力ゾーンへ" }),
        el("div.ichi-row.is-stove", stoveSlots(p, mine, "mini", placeAt))]),
      zoneBox("葉・ボウル・HMD", ".is-setting", {}, settingCards(p, mine, "mid")),
      zoneBox("器具・人物", ".is-perms", {}, el("div.ichi-row.is-perms", permanents(p, mine, "mini"))),
      el("div.ichi-piles", [
        zoneBox("山札", ".is-deck", { title: `山札 ${p.deck.length}枚` }, [el("i.ichi-back.s-mini"), el("b.ichi-count", { text: String(p.deck.length) })]),
        zoneBox("灰", ".is-ash", { title: `灰（使った札） ${p.ash.length}枚` }, el("b.ichi-count.is-plain", { text: String(p.ash.length) })),
      ]),
    ];
    return el(`div.ichi-half.${mine ? "ichi-mine" : "ichi-foe"}`, { dataset: { test: mine ? "ichi-mine" : "ichi-foe" } }, mine ? boxes : boxes.reverse());
  }
  /**
   * 火力ゾーン（卓の端に縦に積む柱）と、そのすぐ外側の熱の目盛り。1段＝1。チャージした札（裏向き＝種火）と、のせた炭（表向き。
   * キューブ炭は3段ぶん）を横向きに積み、積んだ高さが「火力」。目盛りの明るいところまでが「熱」（主役の葉の適温・ジャスト★・焦げに当たる）。
   * 熱は、ターンの終わりに、炭の高さ（火力）へ1段ずつ近づく（第0.8版の蒸らし。次に行く段に ▲▼ が出る）。
   * 自分は手前から奥へ、相手は奥から手前へ積む。手札を選ぶと、いちばん上に「裏向きで置く」（チャージ）が出る
   */
  function fireColumn(p, mine, w, myTurn) {
    const h = heatOf(p), fire = fireOf(p), next = heatNext(p), f = p.main ? FLAVOR[p.main] : null, line = scorchLineOf(p);
    const judged = G.judge && p.puff ? judgedHeat(p, G.judge, p.puff.tk, next) : null, base = judgedHeat(p, PUFFS.normal, 0, next);
    const coolPick = false; // 弱る炭・すきま風で弱める炭は、自動で決まる（選ばせない）
    const ashPick = mine && myTurn && (w.type === "main" || w.type === "prep");
    const si = mine && myTurn && ui.sel?.type === "hand" ? ui.sel.i : null;
    const chargeAt = si !== null && p.hand[si] && canCharge(G, p).ok ? si : null;
    const fireAt = Math.min(RULES.heatMax, fire); // 火力の印（炭の高さ。10を超えたぶんは、いちばん上の段に出す）
    const gauge = el("div.ichi-fire-gauge", { "aria-hidden": "true", dataset: { heat: String(h), next: String(next), fire: String(fire) } }, Array.from({ length: RULES.heatMax }, (_, k) => {
      const v = k + 1, z = f ? zoneCls(rawZone(f, v, line)) : "cold";
      const step = next !== h && v === next ? (next > h ? ".is-next.is-up" : ".is-next.is-down") : "";
      return el(`i.z-${z}${v <= h ? ".is-lit" : ""}${v === h ? ".is-now" : ""}${step}${v === fireAt && fire > 0 ? ".is-fire" : ""}${v === base && base !== next && judged === null ? ".is-base" : ""}${v === judged ? ".is-judged" : ""}`, { text: f && z === "just" ? "★" : String(v) });
    }));
    const stack = el("div.ichi-fire-stack", [
      ...p.zone.map((c, i) => {
        const lv = coalHeat(c), canCool = coolPick && !(w.type === "cool" && c.cooled);
        // 炭1つ＝火の段数ぶんの高さ。札の横に、いまの火を出す
        // 札は横向きに積む。その上に、いまの焼け具合の炭の絵をまっすぐ重ねる（表向きの炭だけ）
        const st = c.up ? coalState(c) : "seed";
        const card = [coalCard(c, { fresh: isFresh("zone", p, i) }), c.up ? coalGlow(c.id, st) : null, el(`b.ichi-coal-fire${c.up ? `.s-${st}` : ".is-ember"}`, { text: String(lv), title: coalLabel(c) })];
        if (!mine) return el(`span.ichi-coal-btn.f-${lv}.s-${st}${c.up ? ".is-up" : ""}`, { style: { "--lv": String(lv) }, dataset: { fire: String(lv), state: st } }, card);
        return el(`button.ichi-coal-btn.f-${lv}.s-${st}${c.up ? ".is-up" : ""}${canCool ? ".can" : ""}${c.cooled ? ".is-cooled" : ""}${ui.sel?.type === "zone" && ui.sel.i === i ? ".is-sel" : ""}`, { type: "button", disabled: !(canCool || (ashPick && !coolPick)), style: { "--lv": String(lv) }, dataset: { test: `ichi-coal-${i}`, up: c.up ? "1" : "0", fire: String(lv), state: st },
          "aria-label": coalLabel(c),
          onclick: () => {
            if (canCool) { sfx("click"); submit({ type: w.type, zone: i }); }
            else if (ashPick) { ui.sel = ui.sel?.type === "zone" && ui.sel.i === i ? null : { type: "zone", i }; sfx("click"); render(); }
          } }, card);
      }),
      chargeAt === null ? null : el("button.ichi-ghost.is-charge", { type: "button", style: { "--lv": "1" }, dataset: { test: "ichi-charge-slot" }, "aria-label": "選んだ札を裏向きで火力ゾーンに積む（チャージ・火力+1）",
        onclick: () => { sfx("click"); submit({ type: "charge", hand: chargeAt }); } }, [el("b", { text: "＋" }), el("small", { text: chargeDraws() ? "置いて1枚引く" : "裏向きで積む" })]),
    ]);
    return zoneBox("火力ゾーン", `.is-coal.is-${mine ? "me" : "foe"}${chargeAt === null ? "" : ".is-target"}`, { dataset: { test: mine ? "ichi-zone" : "ichi-foe-zone", count: String(p.zone.length), heat: String(h), fire: String(fire) } }, [gauge, stack]);
  }
  // 準備: フレーバー場（葉の札の山）
  /** 葉の盆を、この準備のターンのあいだ、しまっているか（次のターンにはまた出る） */
  const marketShut = () => ui.marketOff?.game === G && ui.marketOff.turn === G.prepTurn;
  function prepMarket(me, w, myTurn) {
    // 葉の盆を出すのは、準備で、まだ詰められるあいだ（このターンに詰めたあとと、ボウルがいっぱいのときは、卓を炭のために空ける）
    if (G.phase !== "prep" || G.R.prepack) return null;
    const cp = myTurn && w.type === "prep" ? canPack(G, me) : null;
    if (myTurn ? !cp?.ok : BOWL[me.bowlId].cap - leavesOf(me) <= 0) return null;
    // 盆は卓の奥半分にかぶさる。このターンは詰めずに炭だけ触りたいときは、盆をしまえる（次のターンにまた出る）
    if (myTurn && marketShut()) return null;
    const canPick = !!cp?.ok;
    const total = sum(ui.counts), kinds = Object.keys(ui.counts).filter((k) => ui.counts[k] > 0);
    const limit = packLimit(G, me);
    const headText = !myTurn ? "相手の番（葉の残りは、山の右上の数字）" : `葉を選ぶ：${total}/${limit}枚${G.R.packKinds < G.R.packN ? `（${G.R.packKinds}種類まで）` : ""}`;
    return el("div.ichi-market", { dataset: { test: "ichi-market" } }, [el("div.ichi-market-head", { dataset: { test: "ichi-market-head" } }, [
      el("b", { text: headText }),
      myTurn ? el("small", { text: `ボウルは${BOWL[me.bowlId].cap}枚まで（いま${leavesOf(me)}枚）。葉は一口ごとに1枚減る` }) : null,
      myTurn ? el("button.ichi-market-close", { type: "button", dataset: { test: "ichi-market-close" }, "aria-label": "葉の盆をしまう（このターンは詰めない）", title: "盆をしまって、炭を先に触る", text: "しまう ×",
        onclick: () => { ui.marketOff = { game: G, turn: G.prepTurn }; ui.counts = {}; sfx("click"); render(); } }) : null]),
    ...G.market.map((id) => {
      const f = FLAVOR[id], left = G.supply[id] - (ui.counts[id] || 0), n = ui.counts[id] || 0;
      const can = canPick && left > 0 && total < packLimit(G, me) && (n > 0 || kinds.length < G.R.packKinds);
      return el(`div.ichi-pile-card${n ? ".is-on" : ""}${left > 1 ? ".is-stack" : ""}`, { dataset: { test: `ichi-market-${id}` } }, [
        el("button.ichi-pile-main", { type: "button", disabled: !can, title: [f.name, `適温${f.lo}〜${f.hi}`, f.ab].filter(Boolean).join("　"), "aria-label": `${f.name} 味値${f.t} 適温${f.lo}〜${f.hi} 残り${left}枚`,
          onclick: () => { ui.counts[id] = n + 1; sfx("click"); render(); } }, [
          tcg("flavor", id, { size: "pile" }),
          // 文字を減らす: 系統は1文字の印に（札の「フルーツ」の行は出さない）。適温は数だけ
          el("span.ichi-pile-foot", [kindBadge(f.kind), el("small", { title: `適温${f.lo}〜${f.hi}`, text: `${f.lo}〜${f.hi}` }), f.pair !== "none" ? el("small.ichi-pair", { title: `相性：${KINDS[f.pair].name}` }, ["相性", kindBadge(f.pair)]) : null, el("b.ichi-count", { text: String(left) })]),
        ]),
        n ? el("button.ichi-pile-minus", { type: "button", "aria-label": `${f.name}を1枚戻す`, text: `${n}枚 −`, onclick: () => { ui.counts[id] = n - 1; sfx("click"); render(); } }) : null,
      ]);
    })]);
  }

  // 自分の顔と点・手札
  function handRow(me, w, myTurn) {
    const picking = myTurn && (w.type === "embers" || w.type === "discard"); // 何枚か選ぶ場面
    const sel = ui.sel?.type === "hand" ? ui.sel.i : -1;
    const n = me.hand.length, room = 692, cardW = 112, gap = 8; // 扇形に開くぶん、枠（728px）より少し内側に収める
    const overlap = n > 1 && n * cardW + (n - 1) * gap > room ? Math.ceil((n * cardW - room) / (n - 1)) : -gap;
    const cards = me.hand.map((id, i) => {
      const coal = CARD[id].type === "coal";
      const usable = myTurn && (coal ? canPlace(G, me, id).ok : canPlay(G, me, id).ok);
      const locked = !coal && heatOf(me) < (CARD[id].need || 0);
      const on = picking ? ui.picks.has(i) : sel === i;
      const t = i - (n - 1) / 2, drawn = isFresh("hand", me, i);
      return el(`button.ichi-hand-card${on ? ".is-sel" : ""}${usable ? ".can" : ""}${locked ? ".is-locked" : ""}${drawn ? ".is-drawn" : ""}`, { type: "button", disabled: !myTurn,
        style: { marginLeft: i ? `${-overlap}px` : null, "--r": `${(t * 2).toFixed(2)}deg`, "--dy": `${(t * t).toFixed(1)}px`, "--i": drawn ? String(i - ui.seen.hand[me.index]) : null },
        dataset: { test: `ichi-hand-${i}`, card: id, locked: locked ? "1" : null },
        "aria-label": `${CARD[id].name}${coal ? "" : `（熱${CARD[id].need || 0}以上）`}：${CARD[id].tx}`,
        onclick: () => {
          if (picking) {
            // 選ぶ札は、必要な枚数ちょうどまで（超えたら、先に選んだ札を外す）。はじめの炭は3枚、捨てる札は7枚を超えたぶん
            const limit = w.type === "discard" ? me.hand.length - RULES.handMax : embersOf(G, me);
            if (ui.picks.has(i)) ui.picks.delete(i); else { while (ui.picks.size >= limit) ui.picks.delete(ui.picks.values().next().value); ui.picks.add(i); }
          }
          else ui.sel = sel === i ? null : { type: "hand", i };
          sfx("click"); render();
        } }, tcg("card", id));
    });
    return el("div.ichi-hand-row", [leader(me, "me"), el("div.ichi-hand", { dataset: { test: "ichi-hand" } }, cards), detail(me, w, myTurn) || forecast(me)]);
  }
  /** そのターン最初のチャージは「チャージ＆ドロー」（置いて1枚引く）か */
  const chargeDraws = () => G.R.chargeDraw > 0; // チャージは「チャージ＆ドロー」（置いて1枚引く。炭を足す手なので、のせると合わせて1ターンに1つ）

  // ───────── 炭の手引き（案内の札の下に出す短い助言） ─────────
  // 2026-11-11 オーナー「炭ってシステムがよくわからないので、活用法とかわかりやすくしたい」。
  // いまの熱が帯のどこか（熱）・炭をどう動かせばよいか（炭）・次のターンにどうなるか（次）を、状況に合わせて1行ずつ。
  function coalTips(me, w) {
    const tips = [], tip = (kind, text) => tips.push({ kind, text });
    const f = me.main ? FLAVOR[me.main] : null, room = coalRoom(me);
    const ready = me.stove.filter((c) => c.stage === 2), baking = me.stove.length - ready.length;
    const coalInHand = me.hand.some((id) => CARD[id].type === "coal"), stoveRoom = me.stove.length < slotsOf(me);
    if (w.type === "embers") { tip("coal", `置いた札は「種火」（火1）。熱は0から、ターンの終わりに1ずつ上がる`); return tips; }
    if (w.type === "cool") { tip("coal", "火の小さい炭から下げると、枠が空いて新しい炭をのせやすい"); return tips; }
    if (!(w.type === "main" || w.type === "prep") || !f) return tips;
    // 熱は、ターンの終わりに火力へ1近づく。このまま終えたら、帯のどこか（アマバースト・寄せ・煽りを入れた判定で見る）
    const g = heatGoal(me), h = g.h, fire = g.fire, next = g.next;
    const band = `適温は熱${g.lo}〜${g.hi}${g.justs.length ? `（★${g.justs.join("・")}）` : ""}`;
    tip("now", `熱${h}${next === h ? "のまま" : `${trendMark(h, next)}${next}`}（火力${fire}）。${band}`);
    // 炭の手: ねらいへ行くには、火力を熱より上・同じ・下のどれにするか
    const want = Math.sign(g.target - h), dir = Math.sign(next - h);
    const addLeft = (me.turn?.adds || 0) < G.R.coalAdds; // このターン、まだ炭を足せるか（のせる・チャージ＆ドローを合わせて1つ）
    if (want > dir) {
      if (!addLeft) tip("coal", "炭を足すのは1ターンに1つ。続きは次のターンに");
      else if (ready.length && room) tip("coal", `焼けた炭をのせる（${[...new Set(ready.map((c) => `火力+${CARD[c.id].heat}`))].join("・")}）`);
      else if (ready.length) tip("coal", `炭が${coalMaxOf(me)}つ。火の小さい炭を外すと、焼けた炭をのせられる`);
      else if (room && me.hand.length && canCharge(G, me).ok) tip("coal", "手札を1枚チャージ＆ドロー（火力+1・1枚引く）");
      else if (!room) tip("coal", `炭が${coalMaxOf(me)}つ。火力を上げるには、弱った炭を外して入れ替える`);
      if (!ready.length && coalInHand && stoveRoom) tip("coal", "炭カードを炭焼き場へ（フラットは次のターン、キューブは2ターン後に焼ける）");
    } else if (want < dir) {
      tip("coal", canAsh(G, me).ok ? `火力を熱${want < 0 ? "より下" : "と同じ"}にする：炭を1つ選んで外す（1ターンに1つ）` : "炭を外せるのは1ターンに1つ。炭が弱るのを待つ");
    } else if (coalInHand && stoveRoom) tip("coal", "いまのうちに炭カードを炭焼き場へ。次のターンにのせられる");
    else if (!me.stove.length && !coalInHand) tip("coal", "焼いている炭が無い。次は種火（チャージ）でつなぐ");
    // 次のターン
    if (w.type === "main" && me.hmd === "one_coal" && me.zone.length === 1) tip("next", "炭が1つだけなので、次のターンも弱らない（C1）");
    else if (w.type === "main" && !me.noCool && me.zone.length) {
      const lose = Math.max(0, coolStepsOf(me) - me.wind);
      if (lose) tip("next", `次のターンは炭が弱って火力−${lose}${baking + ready.length ? "。焼けた炭で戻す" : "。足す炭を用意しておく"}`);
    }
    return tips.slice(0, 3);
  }

  // ───────── 審査員の声（右下の掲示板。新しいものが上） ─────────
  // 2026-11-11 オーナー「この一口の見込みもわかりづらいので、ここは審査員のフィードバックを掲示板みたいに出したい。ログを」。
  /** 一口の結果を、次にどうすればよいかが分かる短い一言にする（帯と、適温までの差） */
  function feedLine(p, r) {
    const f = p.main ? FLAVOR[p.main] : null;
    // 文字を減らす（2026-11-13 オーナー「まだ画面に文字が多すぎてみてて疲れる」）: 帯の名前は札に出ているので、一言は「次にどう直すか」だけ。
    // ジャストと、直しようのない適温には一言を付けない
    if (r.zone === "scorch") return r.lost ? `焦げで葉を${r.lostN}枚失った` : "熱すぎる";
    if (!f || r.zone === "just") return "";
    const near = f.j.length ? f.j.reduce((a, b) => (Math.abs(b - r.h) < Math.abs(a - r.h) ? b : a)) : null;
    if (r.zone === "band") return near === null || near === r.h ? "" : `あと${Math.abs(near - r.h)}${near > r.h ? "上げる" : "下げる"}と★`;
    return r.h > f.hi ? `${r.h - f.hi}下げる` : `あと${f.lo - r.h}上げる`;
  }
  function feedEntry(ev) {
    const side = (i) => { const r = ev.res[i]; return { h: r.h, zone: r.zone, pts: r.pts + (r.vote || 0), imp: r.imp, line: feedLine(G.P[i], r) }; };
    return { round: ev.round, judge: ev.puff.judge || null, style: ev.puff.style, dh: ev.puff.dh || 0, voter: ev.voter, me: side(ME), foe: side(CPU),
      rivals: rivalIds().map((i) => ({ i, name: G.P[i].name, ...side(i) })) };
  }
  /** 右下（札を選んでいないとき）: 審査員の声。まだ審査が無いあいだは、審査員の紹介（決め手）を貼っておく */
  function forecast(me) {
    if (G.over) return null;
    const op = G.P[CPU], judges = G.tour.judges, many = multi();
    // 新しい口は2行（自分の帯と点・直すところ／相手と一票）。前の口は1行にたたむ
    const voteOf = (e) => (!G.R.useVote ? null : e.voter == null ? null : el("small.ichi-post-vote", { text: `一票 ${e.voter === ME ? "あなた" : G.P[e.voter].name}` }));
    const post = (e, k) => el(`li.ichi-post${k ? ".is-old" : ""}${e.voter === ME ? ".is-won" : e.voter != null ? ".is-lost" : ""}`, { dataset: { test: "ichi-post", round: String(e.round + 1), zone: e.me.zone } }, k ? [
      el("p.is-me", [el("b", { text: `${e.round + 1}口目` }), el(`i.ichi-zone-chip.z-${e.me.zone}`, { text: ZONE_LABEL[e.me.zone] }), el("b", { text: `+${e.me.pts}` }),
        el("small", { text: many ? "" : `${op.name} +${e.foe.pts}` })]),
    ] : [
      el("header", [e.judge ? faceNode(JUDGE_FACE[e.judge], JUDGE[e.judge].name, ".is-judge") : null,
        el("b", { text: `${e.round + 1}口目` }), el("span", { title: e.judge ? JUDGE[e.judge].name : "練習", text: `${e.style}${e.dh ? ` ${dhText(e.dh)}` : ""}` })]),
      el("p.is-me", [el(`i.ichi-zone-chip.z-${e.me.zone}`, { text: ZONE_LABEL[e.me.zone] }), el("span", { text: e.me.line }), el("b", { text: `+${e.me.pts}` })]),
      el("p.is-foe", [el("small", { text: many ? e.rivals.map((r) => `${r.name} +${r.pts}`).join("／") : `${op.name} ${ZONE_LABEL[e.foe.zone]} +${e.foe.pts}` }), voteOf(e)]),
    ]);
    // まだ審査が無いあいだ: 審査員の顔だけ（吸い方と決め手は、審査の山を押すと見られる）
    const intro = [el("li.ichi-post.is-intro", { dataset: { test: "ichi-post-intro" } }, [
      el("header", judges.length ? [...judges.map((id) => faceNode(JUDGE_FACE[id], JUDGE[id].name, ".is-judge")), el("span", { text: G.R.useBonus ? "審査の山を押すと、決め手が見られる" : "一口ごとに、熱が合っているかを見る" })]
        : [el("span", { text: "練習試合。毎回「ふつうに吸う」" })])])];
    return el("div.ichi-feed", { dataset: { test: "ichi-forecast", posts: String(ui.feed.length) } }, [
      el("header", [el("b", { text: "審査員の声" }), G.phase === "serve" ? impressionView(me) : null]),
      el("ul", { tabindex: "0", "aria-label": "審査の記録（新しい順）" }, [...ui.feed.map((e, k) => post(e, k)), ...(ui.feed.length ? [] : intro)]),
    ]);
  }
  /** 選んだカード・炭の詳しい文と、できること */
  function detail(me, w, myTurn) {
    if (!ui.sel || !myTurn) return null;
    const buttons = [];
    const btn = (text, action, ok, { primary = false, test = null } = {}) => buttons.push(el(`button.ichi-btn.is-small${primary ? ".is-primary" : ""}`, { type: "button", text, disabled: !ok.ok, title: ok.ok ? null : ok.reason, dataset: { test },
      onclick: () => { sfx("select"); submit(action); } }));
    if (ui.sel.type === "zone") {
      const c = me.zone[ui.sel.i]; if (!c) return null;
      btn(`外す（火力−${coalHeat(c)}）`, { type: "ash", zone: ui.sel.i }, canAsh(G, me), { test: "ichi-do-ash" });
      return el("div.ichi-detail", { dataset: { test: "ichi-detail" } }, [el("div.ichi-detail-text", [el("b", { text: c.up ? CARD[c.id].name : "種火" }),
        el("small", { text: c.up ? `いまの火${coalHeat(c)}（新品は${CARD[c.id].heat}）。火は下がるだけで、戻らない` : "裏向きで置いた札。火1" }),
        el("p", { text: c.up ? CARD[c.id].tx : "弱ると灰になる。外して、焼けた炭と入れ替えてもよい。" })]), el("div.ichi-detail-buttons", buttons)]);
    }
    const i = ui.sel.i, id = me.hand[i]; if (!id) return null;
    const c = CARD[id], coal = c.type === "coal";
    const reasons = []; let asking = false; // asking＝だれに使うかを選ぶ（4人対戦で、相手を1人ねらうカード）
    if (coal) { const r = canPlace(G, me, id); btn("炭焼き場に置く", { type: "place", hand: i }, r, { primary: true, test: "ichi-do-place" }); if (!r.ok) reasons.push(r.reason); }
    else {
      const r = canPlay(G, me, id), targets = multi() && isTargeted(id) && r.ok ? targetsOf(G, me, id) : [];
      // 4人対戦で、相手を1人ねらうカード: だれに使うかを選ぶ
      if (targets.length) { asking = true; for (const t of targets) btn(G.P[t].name, { type: "play", hand: i, target: t }, r, { primary: true, test: `ichi-do-play-${t}` }); }
      else btn(c.when === "puff" && !G.R.reactAfterReveal ? "この一口に仕込む" : "使う", { type: "play", hand: i }, r, { primary: true, test: "ichi-do-play" });
      if (!r.ok) reasons.push(r.reason);
    }
    if (w.type === "main" || w.type === "prep") btn(chargeDraws() ? "チャージ＆ドロー" : "チャージ（火力+1）", { type: "charge", hand: i }, canCharge(G, me), { test: "ichi-do-charge" });
    return el("div.ichi-detail", { dataset: { test: "ichi-detail" } }, [
      el("div.ichi-detail-text", [el("b", { text: c.name }), el("small", { text: coal ? `炭・火${c.heat}・着火${c.ig}ターン` : `${TYPE_LABEL[c.type]}・${WHEN_LABEL[c.when]}・熱${c.need || 0}以上（いま${heatOf(me)}）${payLabel(c) ? `・${payLabel(c).short}` : ""}` }), reasons.length ? el("em", { text: reasons[0] }) : null,
        asking ? el("small.ichi-target-ask", { text: "だれに使う？ 下から相手を選ぶ" }) : null, el("p", { text: c.tx })]),
      el(`div.ichi-detail-buttons${asking ? ".is-targets" : ""}`, buttons),
    ]);
  }

  // ───────── 重ねる札（一台・審査員・審査・結果・遊び方・やめる） ─────────
  function openSheet(kind, node) { ui.sheet = kind; sheet.replaceChildren(node); sheet.hidden = false; sheet.dataset.kind = kind; }
  function closeSheet() { ui.sheet = null; sheet.hidden = true; sheet.replaceChildren(); }
  const wait = (ms) => quick() ? Promise.resolve() : sleep(ms / speed, ctrl.signal);
  const closeInfo = () => el("button.ichi-btn.is-primary", { type: "button", text: "とじる", dataset: { test: "ichi-info-close" }, onclick: () => { sfx("select"); if (ui.sheet === "info") closeSheet(); } });
  /** その人の一台: セッティング・詰めた葉・出しているカード（卓には出していない細かい情報） */
  function openRig(p, mine) {
    if (ui.sheet && ui.sheet !== "info") return; // 審査・結果・遊び方の上には重ねない
    const sd = sidesOf(p), f = p.main ? FLAVOR[p.main] : null, h = heatOf(p);
    const leaves = Object.entries(p.bowl).sort((a, b) => (a[0] === p.main ? -1 : b[0] === p.main ? 1 : b[1] - a[1]));
    const perms = [...p.tools, ...(p.person ? [p.person] : [])];
    openSheet("info", el("div.ichi-info", { dataset: { test: "ichi-info-sheet", who: mine ? "me" : "foe" } }, [
      el("header", [faceNode(mine ? "hajime" : info[p.index]?.id, p.name), el("div", [el("h2", { text: mine ? "あなたの一台" : `${p.name}の一台` }), el("small", { text: `${KIT[p.kit]?.name || ""}${mine ? "" : `　${p.score}点・票${p.votes}・手札${p.hand.length}枚・熱${h}・炭${p.zone.length}つ（火力${fireOf(p)}）`}` })])]),
      el("div.ichi-info-set", [
        el("div", [tcg("bowl", p.bowlId, { size: "mid" }), el("div", [el("b", { text: `${BOWL[p.bowlId].name}（${leavesOf(p)}/${BOWL[p.bowlId].cap}g）` }), el("p", { text: BOWL[p.bowlId].ab })])]),
        el("div", [tcg("hmd", p.hmd, { size: "mid" }), el("div", [el("b", { text: HMD[p.hmd].name }), el("p", { text: HMD[p.hmd].ab })])]),
      ]),
      f ? el("div.ichi-info-main", [el("b", { text: `主役 ${f.name}` }), el("span.ichi-taste", [el("small", { text: "味" }), String(f.t)]),
        el("small", { text: `適温${f.lo}〜${f.hi}・ジャスト${f.j.join("・") || "なし"}・焦げ${scorchLineOf(p) > 10 ? "なし" : `${scorchLineOf(p)}以上`}` }),
        strip(p.main, { now: G.phase === "serve" ? h : null, line: scorchLineOf(p) })]) : el("p.ichi-empty", { text: "葉はまだ詰めていない" }),
      leaves.length ? el("div.ichi-info-leaves", leaves.map(([id, n]) => el(`span.ichi-leaf.k-${FLAVOR[id].kind}`, { title: FLAVOR[id].ab || FLAVOR[id].name }, [flavorIcon(id), el("span", { text: `${FLAVOR[id].name} ×${n}` }),
        id === p.main ? el("small", { text: "主役" }) : sd.includes(id) ? el("small", { text: "脇役" }) : null]))) : null,
      perms.length ? el("ul.ichi-info-perms", perms.map((id) => el("li", [tcg("card", id, { size: "tiny" }), el("b", { text: CARD[id].name + (id === "windguard" ? `（残り${p.wind}）` : "") }), el("span", { text: CARD[id].tx })]))) : null,
      closeInfo(),
    ]));
    sheet.querySelector("button")?.focus({ preventScroll: true });
  }
  /** 審査員と決め手、審査カードの山に残っている吸い方 */
  function openJudges() {
    if (ui.sheet && ui.sheet !== "info") return;
    const judges = G.tour.judges, tally = new Map();
    for (const q of (judges.length ? unseenPuffs(G) : [])) tally.set(q.id, (tally.get(q.id) || 0) + 1);
    openSheet("info", el("div.ichi-info", { dataset: { test: "ichi-info-sheet", who: "judges" } }, [
      el("header", [el("i.ichi-back.is-judge"), el("div", [el("h2", { text: judges.length ? `審査カード 残り${G.pile.length}枚` : "練習試合" }), el("small", { text: `${G.tour.name}・セッション ${sessionOf(G) + 1}/${G.tour.sessions}` })])]),
      judges.length ? el("div.ichi-info-puffs", [...tally].sort((a, b) => PUFFS[a[0]].dh - PUFFS[b[0]].dh).map(([id, n]) =>
        el(`span.ichi-puff-chip${PUFFS[id].dh > 0 ? ".is-up" : PUFFS[id].dh < 0 ? ".is-down" : ""}`, [el("b", { text: dhText(PUFFS[id].dh) }), el("span", { text: `${PUFFS[id].style} ×${n}` }), el("small", { text: PUFFS[id].tx })])))
        : el("p", { text: "審査カードは使わない。毎回「ふつうに吸う」。" }),
      judges.length ? el("ul.ichi-info-perms", judges.map((id) => el("li", [faceNode(JUDGE_FACE[id], JUDGE[id].name, ".is-judge"), el("b", { text: JUDGE[id].name }), el("span", { text: G.R.useBonus ? `決め手：${JUDGE[id].bonus}` : `「${JUDGE[id].motto}」` })]))) : null,
      closeInfo(),
    ]));
    sheet.querySelector("button")?.focus({ preventScroll: true });
  }
  function puffCard(q) {
    return el(`div.ichi-puff-card${q.dh > 0 ? ".is-up" : q.dh < 0 ? ".is-down" : ""}`, { dataset: { test: "ichi-puff-card" } }, [
      el("small", { text: q.judge ? JUDGE[q.judge].name : "練習" }), el("b", { text: q.style }), el("strong", { text: dhText(q.dh) }), el("p", { text: q.tx })]);
  }
  async function showReveal(q) {
    // 審査の山のいちばん上が、めくられながら手前に来る
    await fly(puffCard(q), spot(board.querySelector('[data-test="ichi-pile"] .ichi-back')), { x: 640, y: 372, w: 250 }, { start: "back", end: "front", lay: 0, base: 250, dur: 520, judge: true });
    openSheet("reveal", el("div.ichi-reveal", { dataset: { test: "ichi-reveal" } }, [el("small", { text: G.R.revealFirst ? "このラウンドの審査（この吸い方に熱を合わせる）" : "審査" }), puffCard(q)]));
    await wait(multi() ? 750 : 1100);
    if (ui.sheet === "reveal") closeSheet();
  }
  function showScore(ev) {
    const row = (i, label) => {
      const r = ev.res[i];
      return el(`div.ichi-result-row.z-${r.zone}`, { dataset: { test: `ichi-result-${i === ME ? "me" : i === CPU ? "foe" : `p${i}`}`, zone: r.zone } }, [
        el("span.ichi-result-who", [faceNode(info[i]?.id, label), el("b", { text: label })]), el("span.ichi-result-heat", { text: `判定熱 ${r.h}` }), el(`i.ichi-zone-chip.z-${r.zone}`, { text: ZONE_LABEL[r.zone] }),
        el("span.ichi-result-parts", { text: r.parts.length ? r.parts.map((x) => `${x.label}${x.n >= 0 ? "+" : ""}${x.n}`).join("　") : "加点なし" }),
        G.R.useVote ? el("span.ichi-result-imp", { dataset: { test: `ichi-imp-${i === ME ? "me" : i === CPU ? "foe" : `p${i}`}` }, text: `印象 ${r.imp}` }) : null,
        el("strong", { text: `${r.pts}点` }), r.vote ? el("em", { text: `一票 +${r.vote}` }) : null,
        // 葉は一口ごとに1枚減る（焦げたら、さらに主役を失う）
        (r.lostN || 0) + (r.worn?.length || 0) ? el(`small.ichi-result-wear${r.lost ? ".is-scorch" : ""}`, { dataset: { test: "ichi-result-wear", n: String((r.lostN || 0) + (r.worn?.length || 0)) }, title: r.lost ? `焦げで${FLAVOR[r.lost].name}を${r.lostN}枚失う。一口ごとに葉は1枚減る` : "葉は一口ごとに1枚減る", text: `葉 −${(r.lostN || 0) + (r.worn?.length || 0)}` }) : null]);
    };
    const mine = ev.res[ME];
    sfx(mine.zone === "just" ? "perfect" : mine.zone === "band" ? "good" : "miss");
    return new Promise((resolve) => {
      let settled = false;
      const done = () => {
        if (settled) return; settled = true;
        if (ui.sheet === "score") closeSheet();
        const many = multi();
        for (const p of G.P) {
          const i = p.index, n = ev.res[i].pts + (ev.res[i].vote || 0);
          if (!n || quick()) continue;
          // 4人対戦の相手の点は、その人の席の上に浮かせる
          const at = many && i !== ME ? spot(seats[i]?.node) : null;
          floatText(i === ME ? "me" : many ? "rival" : "foe", `+${n}`, at && { left: `${Math.round(at.x - 26)}px`, top: "34px" });
        }
        if (ev.voter != null && !quick() && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
          const at = many && ev.voter !== ME ? spot(seats[ev.voter]?.node) : null;
          const medal = el(`i.ichi-flying-medal.is-${ev.voter === ME ? "me" : many ? "rival" : "foe"}`, { "aria-hidden": "true", style: at ? { "--tx": `${Math.round(at.x - 622)}px`, "--ty": `${Math.round(60 - 352)}px` } : null });
          root.append(medal); setTimeout(() => medal.remove(), 850);
        }
        resolve();
      };
      openSheet("score", el(`div.ichi-result${multi() ? ".is-many" : ""}`, { dataset: { test: "ichi-result" } }, [
        !quick() && ev.res.some((r) => r.zone === "just" || r.zone === "scorch") ? el(`div.ichi-cutin-band.${ev.res.some((r) => r.zone === "scorch") ? "is-scorch" : "is-just"}`, { "aria-hidden": "true" },
          el("b", { text: ev.res.some((r) => r.zone === "scorch") ? "焦げ" : "ジャスト" })) : null,
        el("header", [el("small", { text: `ラウンド ${ev.round + 1}` }), puffCard(ev.puff)]),
        row(ME, "あなた"), ...rivalIds().map((i) => row(i, G.P[i].name)),
        !G.R.useVote ? null : el("p.ichi-result-vote", { text: multi()
          ? (ev.voter == null ? `いちばん高い印象（${Math.max(...ev.res.map((r) => r.imp))}）が並んだので、票は入らない` : `印象がいちばん高い${ev.voter === ME ? "あなた" : G.P[ev.voter].name}（${ev.res[ev.voter].imp}）に一票${voteNote(ev.res[ev.voter])}`)
          : ev.voter == null ? `印象が同じ（${ev.res[ME].imp}）なので、票は入らない` : `印象 ${ev.res[ME].imp} 対 ${ev.res[CPU].imp}。${ev.voter === ME ? "あなた" : G.P[CPU].name}に一票${voteNote(ev.res[ev.voter])}` }),
        el("button.ichi-btn.is-primary", { type: "button", text: "次へ", dataset: { test: "ichi-next" }, onclick: () => { sfx("select"); done(); } }),
      ]));
      sheet.querySelector("button")?.focus({ preventScroll: true });
      if (pilot === "cpu") queueMicrotask(done);
    });
  }
  function showEnd() {
    const res = G.result, me = G.P[ME], op = G.P[CPU], many = multi();
    const ranks = res.ranks || [ME, CPU], rank = ranks.indexOf(ME) + 1;
    const game = { winner: res.winner, scores: res.scores.slice(), votes: res.votes.slice(), tournament: G.tour.id, kit: me.kit, level: cfg.level, rounds: roundsOf(G), players: G.P.length, rank };
    games.push(game);
    for (const i of rivalIds()) setMood(i, ...(res.winner === i ? ["excited", "smile", "smug", "intense"] : res.winner === ME ? ["sad", "shock", "serious"] : ["normal"]));
    render();
    sfx(res.winner === ME ? "fanfare" : "cancel");
    return new Promise((resolve) => {
      const bonus = res.bonus.filter((b) => b.pts.some(Boolean)).map((b) => el("li", [el("span", { text: `${JUDGE[b.judge].name}${b.note ? `（${b.note}）` : "の決め手"}` }),
        ...(many ? ranks : [ME, CPU]).map((i) => el("b", { text: `${b.pts[i] ? `+${b.pts[i]}` : "—"}` }))]));
      const col = (p, label) => el(`div${many && p.index === ME ? ".is-me" : ""}`, { dataset: { test: `ichi-end-score-${p.index}` } }, [el("small", { text: label }), el("b", { text: String(p.score) }), el("span", { text: `${G.R.useVote ? `票 ${p.votes}・` : ""}ジャスト ${p.justCount}・焦げ ${p.scorchCount}` })]);
      // 4人対戦は、順位の順に並べる（自分は「あなた」）。顔は、1位の相手（自分が1位なら、相手のいちばん上）
      const shown = many ? (ranks[0] === ME ? ranks[1] : ranks[0]) : CPU;
      openSheet("end", el(`div.ichi-end${many ? ".is-many" : ""}`, { dataset: { test: "ichi-end-sheet", winner: res.winner === ME ? "me" : res.winner == null ? "draw" : "foe", rank: String(rank) } }, [
        el("div.ichi-end-foe", { "aria-label": `${G.P[shown].name}の表情` }, bustOf(shown, "small")),
        el("h2", { text: res.winner === ME ? "勝ち" : res.winner == null ? "引き分け" : many ? `${rank}位` : "負け" }),
        el(`div.ichi-end-scores${many ? `.n-${G.P.length}` : ""}`, many
          ? ranks.map((i, k) => col(G.P[i], `${k + 1}位 ${i === ME ? "あなた" : G.P[i].name}`))
          : [col(me, "あなた"), col(op, op.name)]),
        bonus.length ? el("ul.ichi-end-bonus", bonus) : null,
        cfg.intro ? el("p.ichi-end-next", { dataset: { test: "ichi-end-next" }, text: "つぎは「基本の一式」で。葉を自分で詰めるところから始まり、審査員の「一票」と「決め手」が加わる。" }) : null,
        el("div.ichi-end-buttons", [
          allowRetry ? el("button.ichi-btn", { type: "button", text: cfg.intro ? "基本の一式へ" : "もう一度", dataset: { test: "ichi-again" }, onclick: () => { sfx("select"); closeSheet(); resolve(); showSetup(); } }) : null,
          el("button.ichi-btn.is-primary", { type: "button", text: "おわる", dataset: { test: "ichi-finish" }, onclick: () => { sfx("select"); resolve(); close(true); } }),
        ]),
      ]));
      sheet.querySelector(".ichi-btn.is-primary")?.focus({ preventScroll: true });
    });
  }
  function openHelp(page = 0) {
    if (ui.sheet === "info") closeSheet();
    const back = ui.sheet;
    // 入門の一局では、最初に読むのは3ページだけ（勝ち方・炭と熱・審査）。ほかは、ふつうの対戦で
    const pages = cfg?.intro && G && !G.over ? INTRO_HELP_PAGES : HELP_PAGES;
    page = Math.max(0, Math.min(pages.length - 1, page));
    const draw = () => {
      const p = pages[page];
      openSheet("help", el("div.ichi-help", { dataset: { test: "ichi-help-sheet" } }, [
        el("header", [el("small", { text: `遊び方 ${page + 1}/${pages.length}` }), el("h2", { text: p.title })]),
        el("ul", p.lines.map((t) => el("li", { text: t }))),
        el("div.ichi-help-buttons", [
          el("button.ichi-btn.is-small", { type: "button", text: "前へ", disabled: page === 0, onclick: () => { page--; sfx("click"); draw(); } }),
          el("button.ichi-btn.is-small", { type: "button", text: "次へ", disabled: page === pages.length - 1, dataset: { test: "ichi-help-next" }, onclick: () => { page++; sfx("click"); draw(); } }),
          el("button.ichi-btn.is-small.is-primary", { type: "button", text: "とじる", dataset: { test: "ichi-help-close" }, onclick: () => { sfx("select"); closeSheet(); if (back === "quit") askQuit(); } }),
        ]),
      ]));
    };
    if (back && back !== "help" && back !== "quit") return; // 審査・結果の札の上には重ねない
    draw();
  }
  function askQuit() {
    if (ui.sheet === "info") { closeSheet(); return; }
    if (ui.sheet && ui.sheet !== "help") return;
    if (!G || G.over) { close(games.length > 0); return; }
    openSheet("quit", el("div.ichi-quit", { dataset: { test: "ichi-quit-sheet" } }, [
      el("h2", { text: "対戦をやめる？" }), el("p", { text: "この対戦は記録されない" }),
      el("div.ichi-end-buttons", [
        el("button.ichi-btn", { type: "button", text: "つづける", dataset: { test: "ichi-quit-no" }, onclick: () => { sfx("select"); closeSheet(); } }),
        el("button.ichi-btn.is-primary", { type: "button", text: "やめる", dataset: { test: "ichi-quit-yes" }, onclick: () => { sfx("cancel"); close(games.length > 0); } }),
      ]),
    ]));
  }

  if (cfg) startGame(); else showSetup();
  return promise;
}

