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
//   火力ゾーンは卓の端に縦に積む（自分は左端を手前から奥へ、相手は右端を奥から手前へ）。すぐ外側に判定のゲージ（主役の葉の
//   帯の色と★）が並び、積んだ高さがそのまま熱（オーナー「判定のゲージと火力ゾーンは近づけたい。ダメージゾーンみたいに
//   横において積み上げて火力にしてもいい」）。卓の上の札は傾いて読みにくいので、数字と文は HUD に立てて出す。
// 札の移動（手札 → 火力ゾーン・炭焼き場・この一口）は、卓の上を飛んで置かれる。番が替わると、卓の見え方（カメラ）が少し動く。
// 火力ゾーン＝HMDの上の炭（第0.4版）。炭は4つまでで、炭そのものに火がある（新品のフラット炭2・キューブ炭3・裏向きの種火1）。
// 柱には炭の火の段数ぶん積み、合計がそのまま熱。火は冷めるたびに下がるだけ（回復しない）
// （2026-11-11 オーナー「火力ゾーンにカードを裏向きで置いてカウントしてく感じ」「炭自体に火力をつける」「火力＝炭の数にはしない」）。
// 卓に出るものは、葉・ボウル（ハガル）・HMD・炭もふくめて全部「札」。マットに出すのは「いま打つ手に要るもの」だけにして、
// 詰めた葉・札の文・審査カードの内訳・相手の葉は、札や山をタップして開く（オーナー指示: ピックした葉は出さない・狭くしない）。
// 操作はタップだけ（カードや炭を選ぶ → 出てくるボタンを押す）。遊び方は「？」から開く。
// 絵は ichidai-art.js が引く（このゲーム用の絵 → 本編の正規の絵 → 仮の線画の順）。
import { el } from "../core/util.js";
import { DB, faceFrame, portraitInfo, useManifest } from "../core/data.js";
import { portraitAsset } from "../core/portrait-resolver.js";
import { SE, unlockAudio } from "../core/audio.js";
import { KINDS, FLAVOR, CARD, BOWL, HMD, JUDGE, PUFFS, TOURNAMENTS, KITS, KIT, TYPE_LABEL, WHEN_LABEL, RARITIES, SERIES_SIZE, numberOf, rarityOf } from "./ichidai-data.js";
import { RULES, ZONE_LABEL, createGame, act, heatOf, leavesOf, firepower, sidesOf, slotsOf, roundsOf, sessionOf,
  judgedHeat, rawZone, scorchLineOf, scorePuff, impressionOf, puffPreview, unseenPuffs, packLimit,
  canPlay, canCharge, canPlace, canPutOn, canAsh, canPack, canSteam, coalHeat, coalRoom, coolStepsOf } from "./ichidai-rules.js";
import { aiAct } from "./ichidai-ai.js";
import { artUrl, flavorArt, cardArt, faceUrl, bowlArt, hmdArt, JUDGE_FACE } from "./ichidai-art.js";
import { HELP_PAGES } from "./ichidai-help.js";
import { playVersus } from "./ichidai-versus.js";
import { attachIchidaiLines } from "./ichidai-lines.js";

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
    gem: coal ? { text: String(c.heat), label: "熱", cls: "is-heat" } : { text: String(c.need ?? 0), label: "必要火力", cls: "is-cost", title: `必要火力${c.need ?? 0}（火力${c.need ?? 0}以上で使える）` },
    art: cardArt(id), glyph: TYPE_LABEL[c.type].slice(0, 1), line: coal ? ["炭", `着火${c.ig}`] : [TYPE_LABEL[c.type], WHEN_LABEL[c.when]], text: c.tx };
}
/** 発動するために落とすものの短い印（札の左上）と、詳しい言い方 */
function payLabel(c) {
  if (c.pay?.fire) return { short: `火力−${c.pay.fire}`, long: `火力を${c.pay.fire}落として発動（熱−${c.pay.fire}）` };
  if (c.pay?.leaf) return { short: `葉−${c.pay.leaf}`, long: `葉を${c.pay.leaf}枚減らして発動` };
  return null;
}
export function tcg(kind, id, { size = "hand" } = {}) {
  const v = cardView(kind, id), rar = rarityOf(kind, id), big = size === "big", small = size === "mini" || size === "tiny" || size === "far";
  return el(`div.ichi-card.s-${size}.${v.cls}.r-${rar}`, { dataset: { card: id, kind } }, [
    el("div.ichi-card-head", [
      v.gem ? el(`span.ichi-gem.${v.gem.cls}`, { title: v.gem.title || `${v.gem.label} ${v.gem.text}` }, el("b", { text: v.gem.text })) : null,
      v.pay ? el("span.ichi-pay", { title: v.pay.long, text: v.pay.short }) : null,
      small ? null : el("b.ichi-card-name", { text: breakable(v.name), "aria-label": v.name })]),
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
const breakable = (name) => name.replace(NAME_HEADS, "$1\u200b");
/** 炭1つの言い方（名前と、いまの火） */
const coalLabel = (c) => (c.up ? `${CARD[c.id].name}（火${coalHeat(c)}）` : "種火（火1）");
/** 火力ゾーンの札（表向き＝のせた炭カード、裏向き＝チャージした種火）。fresh＝置いたばかり（動きを付ける）。弱った炭は少し暗い */
function coalCard(c, { size = "mini", fresh = false } = {}) {
  const worn = c.up && coalHeat(c) < CARD[c.id].heat;
  return el(`span.ichi-on${c.up ? ".is-up" : ".is-ember"}${worn ? ".is-worn" : ""}${fresh ? ".is-new" : ""}`, { title: coalLabel(c) },
    c.up ? tcg("card", c.id, { size }) : el(`i.ichi-back.s-${size}`));
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
 * @param tutorial はじめに遊び方を開くか
 * @param pilot テスト・デモ用: "cpu" にすると自分の席もCPUが打つ
 * @param speed CPUの手と演出の早回し
 * @param skin 見た目の案の名前（デザインの見比べ用）。root に data-skin が付き、css/ichidai-skin-<名前>.css の決まりが効く
 * 戻り値: { completed, cancelled, games:[{ winner（0=自分/1=相手/null=引き分け）, scores, votes, tournament, kit, level }], last }
 */
export function runIchidai({ host = document.getElementById("stage"), signal = null, seed = null, config = null, opponent = null,
  tutorial = false, pilot = null, speed = 1, allowRetry = true, skin = null } = {}) {
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
  const ui = { sel: null, picks: new Set(), counts: {}, note: "", toast: "", fast: false, sheet: null, peek: null, lastLog: 0, turnKey: null, foeMood: "normal", feed: [] };
  const foe = { id: opponent?.id || null, name: opponent?.name || "相手" };

  const root = el("section.ichi-game", { role: "dialog", "aria-modal": "true", "aria-label": ICHIDAI_TITLE, tabindex: "-1", dataset: { test: "ichi-game", phase: "setup" } });
  if (skin) root.dataset.skin = skin;
  // 部屋・相手の席・卓は作り直さない（番が替わったときの見え方の動きと、相手の息づかいを切らさないため）。中身だけ差し替える
  const room = el("div.ichi-room", { "aria-hidden": "true" }, [el("i.ichi-haze"), el("i.ichi-haze")]);
  const seatBust = el("span.ichi-seat-bust"), seatHand = el("span.ichi-seat-hand");
  // .ichi-say-anchor＝相手の顔のあたり。相手の一言（ichidai-lines.js）の吹き出しを、ここへ向けて出す
  const seat = el("button.ichi-seat", { type: "button", dataset: { test: "ichi-seat" }, onclick: () => { if (G && !G.over) { sfx("select"); openRig(G.P[CPU], false); } } }, [seatBust, el("i.ichi-say-anchor", { "aria-hidden": "true" }), seatHand]);
  const board = el("div.ichi-board", { dataset: { test: "ichi-board" } });
  const view = el("div.ichi-view", board);
  const table = el("div.ichi-table");
  const sheet = el("div.ichi-sheet", { hidden: true });
  const live = el("p.ichi-live", { role: "status", "aria-live": "polite" });
  const fastBtn = el("button.ichi-round-btn.ichi-fast", { type: "button", hidden: true, "aria-label": "早送り", title: "早送り", "aria-pressed": "false", dataset: { test: "ichi-fast" },
    onclick: () => { ui.fast = !ui.fast; fastBtn.setAttribute("aria-pressed", String(ui.fast)); sfx("click"); } }, el("span", { text: "▶▶" }));
  const head = el("div.ichi-head-buttons", [fastBtn,
    el("button.ichi-round-btn", { type: "button", "aria-label": "遊び方", dataset: { test: "ichi-help" }, onclick: () => { sfx("select"); openHelp(); } }, el("span", { text: "？" })),
    el("button.ichi-round-btn", { type: "button", "aria-label": "やめる", dataset: { test: "ichi-close" }, onclick: () => { sfx("cancel"); askQuit(); } }, el("span", { text: "✕" })),
  ]);
  root.append(room, seat, view, table, head, sheet, live);
  host.append(root);
  // 対戦中、相手が一言しゃべる（2026-11-11 オーナー「対戦中は相手にセリフとか言わせたい」。台詞は data/dialogue/ichidai_lines.json）。
  // 一言に表情が付いていれば、相手の顔もそれに替える。早送りと CPU に打たせているあいだは出さない
  const lines = attachIchidaiLines({ root, charId: foe.id, quick: () => ui.fast || pilot === "cpu",
    onLine: (line) => { if (line.face && G) { setFoeMood(line.face); renderSeat(G.P[CPU]); } } });
  const arm = () => unlockAudio();
  root.addEventListener("pointerdown", arm); root.addEventListener("keydown", arm);
  // このゲーム用の卓・裏面の絵があれば差し替える（無ければ CSS の既定＝本編の夜紫UIの部品）
  for (const [name, kind, id] of [["--ichi-mat", "table", "mat"], ["--ichi-back-art", "back", "deck"], ["--ichi-judge-back-art", "back", "judge"]]) {
    const url = artUrl(kind, id);
    if (url) root.style.setProperty(name, `url("${url}")`);
  }

  function close(completed) {
    if (dead()) return;
    ctrl.abort(); pending?.(null);
    lines.clear();
    root.remove(); active.delete(host);
    if (window.__ichidai === hook) delete window.__ichidai;
    try { previousFocus?.focus?.({ preventScroll: true }); } catch { /* 元の要素が無ければそのまま */ }
    finish(summary(completed));
  }
  signal?.addEventListener("abort", () => close(false), { once: true });
  window.addEventListener("pagehide", () => close(false), { once: true, signal: ctrl.signal });
  root.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.preventDefault(); if (!sheet.hidden && (ui.sheet === "help" || ui.sheet === "info")) closeSheet(); else askQuit(); } });

  const submit = (action) => { const r = pending; pending = null; r?.(action); };
  // テスト・デモ用の入口: 自分の席もCPUに打たせて早回しする（ほかのミニゲームの window.__desertRide と同じ使い方）
  const hook = { autoplay: (fast = 12) => { pilot = "cpu"; speed = fast; if (pending && G && !G.over) submit(aiAct(G, G.wait.player)); else if (ui.sheet === "score") sheet.querySelector('[data-test="ichi-next"]')?.click(); },
    get game() { return G; } };
  window.__ichidai = hook;
  const human = (i) => i === ME && pilot !== "cpu";
  const say = (text) => { ui.toast = text; live.textContent = text; };
  // 試遊ページは本編の loadAll を通らない。立ち絵の測定値だけ同じ manifest から読む。
  const portraitReady = DB.manifest.faceFrames ? Promise.resolve() : fetch("data/manifest.json")
    .then((res) => { if (!res.ok) throw new Error(`manifest ${res.status}`); return res.json(); })
    .then((manifest) => { if (!dead() && !DB.manifest.faceFrames) useManifest(manifest); })
    .catch(() => {}); // 素材が無い場合は従来の顔アイコンを維持する
  function foePortrait() {
    if (!foe.id) return null;
    const faces = DB.manifest.portraits?.[foe.id]?.faces || [];
    const mood = [ui.foeMood, "normal"].find((f) => faces.includes(f));
    if (!mood) return null;
    const portrait = DB.characters[foe.id] ? portraitInfo(foe.id, mood, "classic") : portraitAsset(DB.manifest, foe.id, mood, "classic");
    const frame = portrait && faceFrame(portrait.folder, portrait.style);
    return frame?.eye && frame?.unit ? { portrait, frame } : null;
  }
  /** 相手のバストアップ。seat＝卓の向こうの席（大きく）、そうでなければ結果の札の小さな窓 */
  function foeBust(name, seatSize = false) {
    const found = foePortrait();
    if (!found) return el("span.ichi-leader-ring", faceNode(foe.id, name));
    const { portrait, frame } = found;
    // 席: 顔の幅（frame.unit）を 86px にそろえ、目の高さを窓の上から 66px に置く。小さな窓: 0.46 倍で目を (108, 27) に
    const scale = seatSize ? 86 / frame.unit : 0.46, [ex, ey] = seatSize ? [210, 66] : [108, 27];
    return el(`span.ichi-foe-bust${seatSize ? ".is-seat" : ""}`, { dataset: { test: seatSize ? "ichi-foe-bust" : null, face: portrait.face }, "aria-hidden": "true" },
      el("img", { src: portrait.src, alt: "", draggable: "false", style: {
        width: `${896 * scale}px`, left: `${ex - frame.eye[0] * scale}px`, top: `${ey - frame.eye[1] * scale}px`,
      }, onerror: (e) => { e.currentTarget.parentElement.replaceWith(el("span.ichi-leader-ring", faceNode(foe.id, name))); } }));
  }
  function setFoeMood(...choices) {
    const faces = DB.manifest.portraits?.[foe.id]?.faces || [];
    ui.foeMood = choices.find((f) => faces.includes(f)) || "normal";
  }

  // ───────── 設定の画面 ─────────
  function showSetup() {
    root.dataset.phase = "setup";
    const pick = { kit: cfg?.kit || "a", tournament: cfg?.tournament || "practice", level: cfg?.level ?? 1 };
    const draw = () => {
      const kits = KITS.map((k) => el(`button.ichi-pick.ichi-kit${pick.kit === k.id ? ".is-on" : ""}`, { type: "button", dataset: { test: `ichi-kit-${k.id}` }, "aria-pressed": String(pick.kit === k.id),
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
      table.replaceChildren(el("div.ichi-setup", [
        el("header.ichi-setup-head", [el("h1", { text: ICHIDAI_TITLE }), el("p", { text: "葉を詰め、炭で熱を保ち、審査員の一口を競う" })]),
        el("section", [el("h2", { text: "自分の一式" }), el("div.ichi-picks.is-kits", kits)]),
        el("section", [el("h2", { text: "大会" }), el("div.ichi-picks.is-tours", tours)]),
        el("section.ichi-setup-foot", [el("h2", { text: `${foe.name}の強さ` }), el("div.ichi-picks.is-levels", levels),
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
    const others = KITS.map((k) => k.id).filter((id) => id !== cfg.kit);
    const s = (seed ?? (Date.now() ^ (Math.random() * 0xffffffff))) >>> 0;
    const foeKit = cfg.opponentKit || others[s % others.length];
    G = createGame({ seed: s + games.length * 7919, tournament: cfg.tournament, market: cfg.market,
      players: [{ name: "はじめ", kit: cfg.kit, level: 2 }, { name: foe.name, kit: foeKit, ai: true, level: cfg.level }] });
    Object.assign(ui, { sel: null, picks: new Set(), counts: {}, note: "", toast: "", sheet: null, peek: null, lastLog: 0, turnKey: null, foeMood: "normal", seen: null });
    closeSheet();
    // 対戦の前に「VS」（顔アイコンが向かい合い、電撃が走る）。CPUに打たせる早回しでは出さない
    if (!quick()) {
      root.dataset.phase = "versus"; table.replaceChildren();
      await playVersus({ host: root, signal: ctrl.signal, speed, players: [{ id: "hajime", name: "はじめ", sub: KIT[cfg.kit]?.name }, { id: foe.id, name: foe.name, sub: KIT[foeKit]?.name }] });
      if (dead()) return;
    }
    root.dataset.phase = "play";
    render(); lines.event({ t: "start" });
    if (tutorial && !games.length) { openHelp(); }
    await loop();
  }
  async function loop() {
    const mine = G;
    while (!dead() && G === mine) {
      render();
      if (G.over) { await showEnd(); return; }
      const w = G.wait;
      announceTurn(w);
      let action;
      if (human(w.player)) { action = await new Promise((resolve) => { pending = resolve; }); if (!action) return; }
      else { await sleep(cpuDelay(w), ctrl.signal); if (dead() || G !== mine) return; action = aiAct(G, w.player); }
      const from = flySource(w, action);
      const before = G.log.length, priorScores = G.P.map((p) => p.score), r = act(G, action);
      if (!r.ok) { if (human(w.player)) { say(r.reason); sfx("cancel"); } else { console.error("ichidai: CPUの入力が通らない", action, r.reason); close(false); return; } continue; }
      ui.sel = null; ui.picks = new Set(); ui.counts = {}; ui.toast = "";
      if (!human(w.player) && G.log.length > before) ui.note = G.log.at(-1).text;
      await playEvents(priorScores, from);
    }
  }
  const cpuDelay = (w) => (ui.fast || pilot === "cpu" ? 40 : w.type === "embers" || w.type === "wear" || w.type === "discard" ? 260 : 620) / speed;
  const quick = () => ui.fast || pilot === "cpu";

  /** ターンが替わったら、卓の中央に帯を一度だけ流す（だれの番かを目で分かるように） */
  function announceTurn(w) {
    if (!w || !(w.type === "prep" || w.type === "cool" || w.type === "main")) return;
    const key = `${G.phase}:${G.prepTurn}:${G.round}:${G.serveStep}:${w.player}`;
    if (ui.turnKey === key) return;
    ui.turnKey = key;
    if (quick()) return;
    const mine = human(w.player);
    flash(mine ? "あなたのターン" : `${G.P[w.player].name}のターン`, mine ? "is-me" : "is-foe");
    if (mine) sfx("select");
  }
  function flash(text, cls) {
    root.querySelector(".ichi-banner")?.remove();
    const node = el(`div.ichi-banner.${cls}`, { "aria-hidden": "true" }, el("b", { text }));
    root.append(node);
    setTimeout(() => node.remove(), 1150);
  }
  /** 点が入ったところに、数字を浮かせる */
  function floatText(who, text) {
    const node = el(`div.ichi-float.is-${who}`, { "aria-hidden": "true", text });
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
      const node = mine ? board.querySelector(`[data-test="ichi-stove-${a.stove}"]`) : board.querySelectorAll(".ichi-foe .is-stove .ichi-stove-coal")[a.stove];
      const at = spot(node);
      return at ? { ...at, id: p.stove[a.stove]?.id } : null;
    }
    // 詰める: 選んだ葉の札が、場の山からボウルの横の束へ飛ぶ
    if (a.type === "pack") {
      const packs = Object.entries(a.picks || {}).filter(([, n]) => n > 0).map(([id, n]) => ({ id, n, at: spot(table.querySelector(`[data-test="ichi-market-${id}"] .ichi-card`)) })).filter((x) => x.at);
      return packs.length ? { packs } : null;
    }
    if (a.type !== "charge" && a.type !== "place" && a.type !== "play") return null;
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
      : (mine ? '[data-test="ichi-zone"] .ichi-on' : '[data-test="ichi-foe-zone"] .ichi-on'));
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
  /** 使ったカードの行き先（仕込んだ一口は「この一口」の置き場、器具・人物はその枠、ほかは灰） */
  function landingOf(ev) {
    const c = CARD[ev.id], mine = ev.p === ME;
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
    await fly(big(), from, CENTER, { start: "back", end: "front", lay: 0, base: 240, dur: 460 });
    const node = el("div.ichi-played", { dataset: { test: "ichi-played" } }, [el("small", { text: `${G.P[ev.p].name}が使った` }), big()]);
    root.append(node);
    await wait(1000);
    node.remove();
    fly(big(), CENTER, land, { base: 240, dur: 340 });
  }
  async function playEvents(priorScores, from) {
    const evs = G.events.splice(0);
    for (const ev of evs) {
      if (dead()) return;
      // 置いた札は、飛んできた札が着くまで隠しておく（着いたら置かれる動き）
      const said = lines.event(ev); // 相手の一言（カードを使った・審査の結果・勝ち負け）。待たずに進む
      const fl = from && !still();
      board.style.setProperty("--land", fl && ["charge", "place", "puton"].includes(ev.t) ? `${(human(ev.p) ? 0.3 : 0.36) / speed}s` : fl && ev.t === "play" ? `${(human(ev.p) ? 0.62 : 1.7) / speed}s` : "0s");
      if (ev.t === "reveal") { sfx("card"); render(); await showReveal(ev.puff); }
      else if (ev.t === "score") {
        ui.feed.unshift(feedEntry(ev)); // 審査員の声（掲示板）に足す。新しいものが上
        const foeResult = ev.res[CPU], swing = priorScores[CPU] <= priorScores[ME] && G.P[CPU].score > G.P[ME].score;
        if (!said?.face) setFoeMood(...(foeResult.zone === "scorch" ? ["sad", "shock", "serious"] : swing ? ["surprise", "excited", "smile"]
          : foeResult.zone === "just" ? ["excited", "smile", "surprise"] : ev.voter === CPU ? ["smile", "smug"]
            : ev.voter === ME ? ["sad", "serious"] : foeResult.pts > ev.res[ME].pts ? ["smile", "smug"] : ["serious", "normal"]));
        render(); await showScore(ev);
      }
      else if (ev.t === "peek" && human(ev.p)) { ui.peek = ev.puff; sfx("card"); }
      else if (ev.t === "play") { sfx("card"); render(); await playFlight(ev, from); }
      else if (ev.t === "charge" || ev.t === "puton" || ev.t === "place") { sfx("click"); render(); coalFlight(ev, from); }
      else if (ev.t === "pack") { sfx("card"); render(); leafFlight(ev, from); }
      else if (ev.t === "flip" || ev.t === "ash" || ev.t === "wear") render();
      if (["puton", "flip", "ash", "place"].includes(ev.t)) pulseTarget(ev.t === "place" ? (ev.p === CPU ? ".ichi-foe .is-stove" : '[data-test="ichi-stove"]') : ev.p === CPU ? ".ichi-foe .is-coal" : '[data-test="ichi-zone"]', `fx-${ev.t}`);
    }
  }

  // ───────── 描画 ─────────
  function render() {
    if (!G || dead()) return;
    const w = G.wait, me = G.P[ME], op = G.P[CPU], myTurn = !!w && human(w.player);
    root.dataset.phase = G.over ? "end" : G.phase;
    root.dataset.wait = w ? w.type : "";
    root.dataset.turn = w ? (w.player === ME ? "me" : "foe") : "";
    fastBtn.hidden = G.over || pilot === "cpu"; fastBtn.setAttribute("aria-pressed", String(ui.fast));
    const { lines, buttons } = guide(me, op, w);
    renderSeat(op);
    // 卓: 左端＝自分の火力ゾーン／まんなか（奥 → 手前）＝相手の札・中央・自分の札／右端＝相手の火力ゾーン
    board.replaceChildren(fireColumn(me, true, w, myTurn), half(op, false, w, false), centerStrip(me, op), half(me, true, w, myTurn), fireColumn(op, false, w, false));
    // HUD（卓の手前に立てて出すもの）
    // 左上は相手の札とラウンドを縦に並べ、相手の顔の左（吹き出しの出る所）は空けておく
    table.replaceChildren(...[el("div.ichi-hud-left", [foePanel(op), clock(op, w)]), el("div.ichi-guide", { dataset: { test: "ichi-guide" } }, lines), el("div.ichi-actions", buttons),
      heatRead(me), prepMarket(me, w, myTurn), handRow(me, w, myTurn)].filter(Boolean));
    // 次の描画で「置いたばかり」「引いたばかり」の札を見分けるため、いまの枚数を覚える
    ui.seen = { zone: G.P.map((p) => p.zone.length), stove: G.P.map((p) => p.stove.length), hand: G.P.map((p) => p.hand.length) };
  }
  /** 前の描画より後に置かれた札か（はじめの描画では動かさない） */
  const isFresh = (kind, p, i) => !!ui.seen && i >= ui.seen[kind][p.index];
  /** 相手の席: バストアップ（顔が変わったときだけ差し替える）と、持っている手札の裏 */
  function renderSeat(op) {
    const key = `${foe.id}:${foePortrait() ? ui.foeMood : "icon"}`;
    if (seat.dataset.key !== key) { seat.dataset.key = key; seatBust.replaceChildren(foeBust(op.name, true)); }
    seat.classList.toggle("is-active", G.active === op.index && !G.over);
    seat.setAttribute("aria-label", `${op.name}の一台を見る`);
    const n = op.hand.length, shown = Math.min(n, 7);
    seatHand.title = `相手の手札 ${n}枚・山札 ${op.deck.length}枚`;
    seatHand.dataset.count = String(n);
    seatHand.replaceChildren(...Array.from({ length: shown }, (_, i) => el("i.ichi-back.s-tiny", { style: { "--r": `${(i - (shown - 1) / 2) * 7}deg`, "--dy": `${Math.abs(i - (shown - 1) / 2) ** 2 * 1.4}px` } })), el("b.ichi-count", { text: String(n) }));
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
        el("span.ichi-leader-votes", [el("i.ichi-medal"), el("b", { text: `票 ${p.votes}` })]),
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
  /** このラウンド（準備ではこのターン）にカードをあと何枚使えるか */
  function cardLeft(p) {
    const left = Math.max(0, G.R.cardsPerRound - (p.cardsUsed || 0));
    return el(`span.ichi-card-left${left ? "" : ".is-used"}`, { dataset: { test: "ichi-card-left", left: String(left) }, title: G.phase === "prep" ? "カードは1ターンに1枚" : "カードは1ラウンドに1枚" },
      [el("i.ichi-back.s-tiny"), el("small", { text: left ? `カード あと${left}` : "カード 済み" })]);
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
        dataset: { test: mine ? `ichi-stove-${i}` : null }, onclick: () => { if (can) { sfx("click"); submit({ type: "puton", stove: i }); } } }, [
        tcg("card", c.id, { size }), mine ? el("small.ichi-counter", { text: ready ? "のせる ➜" : `あと${left}` }) : null]);
    });
  }

  /** HUD 左上: 相手の点と票、熱と帯、主役の葉と体力（卓の奥は小さく見えるので、数はここで読む） */
  function foePanel(op) {
    const h = heatOf(op);
    return el("div.ichi-foe-panel", [leader(op, "foe"),
      el("div.ichi-foe-gauge", { dataset: { test: "ichi-foe-fire", heat: String(h), left: String(firepower(op)) } }, [
        el("div.ichi-foe-heat", [el("small", { text: "熱" }), el("b", { text: String(h) }), op.main ? strip(op.main, { now: G.phase === "serve" ? h : null, line: scorchLineOf(op) }) : null]),
        el("div.ichi-mods", modChips(op))]),
      mixView(op, false)]);
  }
  /** HUD 上: いまのフェイズ・ラウンド・先手・読んだ審査カード */
  function clock(op, w) {
    const rounds = roundsOf(G), serve = G.phase === "serve", judges = G.tour.judges;
    const phaseName = G.phase === "embers" ? "最初の火" : G.phase === "prep" ? `準備 ${w ? w.n ?? "" : ""}/${RULES.prepTurns}` : `ラウンド ${Math.min(G.round + 1, rounds)}/${rounds}`;
    const pips = serve ? el("span.ichi-pips", { "aria-hidden": "true" }, Array.from({ length: rounds }, (_, i) => el(`i${i < G.round ? ".is-done" : i === G.round ? ".is-now" : ""}${i % 3 === 2 ? ".is-gap" : ""}`))) : null;
    const peek = ui.peek && serve && !G.judge ? el("span.ichi-peek", { dataset: { test: "ichi-peek" } }, [el("small", { text: "読んだ" }), el("b", { text: `${ui.peek.style} ${dhText(ui.peek.dh)}` })]) : null;
    return el("div.ichi-clock", [
      el("b", { text: phaseName, dataset: { test: "ichi-phase" } }), pips,
      el("small", { text: serve ? `${G.order?.[0] === ME ? "あなた" : op.name}が先手` : G.tour.name }),
      // 審査員の顔: 提供では卓の「審査の山」の横に出す。準備のあいだはここに出す
      !serve && judges.length ? el("span.ichi-judges", judges.map((id) => faceNode(JUDGE_FACE[id], JUDGE[id].name, ".is-judge"))) : null,
      peek,
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
      slot(op, false),
      serve ? zoneBox(judges.length ? "審査の山" : "練習", ".is-judge", {}, [pile, judges.length ? el("span.ichi-judges", judges.map((id) => faceNode(JUDGE_FACE[id], JUDGE[id].name, ".is-judge"))) : null])
        : el("i.ichi-center-mark", { "aria-hidden": "true" }),
      slot(me, true),
    ]);
  }

  /** いま何をすればよいか（短い一文）と、できることのボタン */
  function guide(me, op, w) {
    const lines = [], buttons = [];
    const btn = (text, action, { primary = false, test = null, disabled = false, title = null } = {}) =>
      buttons.push(el(`button.ichi-btn${primary ? ".is-primary" : ""}`, { type: "button", text, disabled, title, dataset: { test }, onclick: () => { sfx("select"); typeof action === "function" ? action() : submit(action); } }));
    if (!w) return { lines, buttons };
    // 炭の手引き（あるときは、決まり文句のかわりにこれを出す）
    const tips = human(w.player) ? coalTips(me, w) : [], say1 = (text) => { if (!tips.length) lines.push(el("span", { text })); };
    if (!human(w.player)) {
      lines.push(el("b", { text: `${op.name}の番` })); if (ui.note) lines.push(el("span", { text: ui.note }));
    } else if (w.type === "embers") {
      // 立ち上げ: 1〜4枚を裏向きで置く（種火＝火1ずつ）。ふつうは3枚
      const n = ui.picks.size, okN = n >= RULES.startEmbersMin && n <= RULES.startEmbersMax;
      lines.push(el("b", { text: "最初の火：立ち上げ" }), el("span", { text: `手札から${RULES.startEmbersMin}〜${RULES.startEmbersMax}枚を、立ち上げの炭（種火）にする。ふつうは${RULES.startEmbers}枚（いま${n}枚）` }));
      btn(okN ? `立ち上げる（${n}枚・熱${n}）` : "立ち上げる", { type: "embers", picks: [...ui.picks] }, { primary: true, test: "ichi-embers", disabled: !okN });
    } else if (w.type === "prep") {
      const mode = me.turn.mode, total = sum(ui.counts);
      if (!mode) {
        const cp = canPack(G, me), cs = canSteam(G, me);
        lines.push(el("b", { text: "準備：詰めるか、蒸らすか" }), el("span", { text: cp.ok ? `葉を選ぶ（${total}/${packLimit(G, me)}枚・2種類まで）` : cp.reason }));
        btn(`詰める${total ? `（${total}枚）` : ""}`, { type: "pack", picks: { ...ui.counts } }, { primary: true, test: "ichi-pack", disabled: !cp.ok || !total });
        btn("蒸らす", { type: "steam" }, { test: "ichi-steam", disabled: !cs.ok, title: cs.ok ? `${G.R.steamDraw}枚引いて、炭に触れる` : cs.reason });
        if (!cp.ok && !cs.ok) btn("ターンを終える", { type: "end" }, { test: "ichi-end" });
      } else {
        lines.push(el("b", { text: mode === "steam" ? "蒸らす：立ち上げ" : "詰めた" })); say1(mode === "steam" ? "炭を焼いて、のせる。終わったらターンを終える" : "カードを使うか、ターンを終える");
        btn("ターンを終える", { type: "end" }, { primary: true, test: "ichi-end" });
      }
    } else if (w.type === "cool") {
      lines.push(el("b", { text: `冷める：火を下げる炭を選ぶ（あと${w.left}）` }), el("span", { text: "選んだ炭の火が1下がる（0で灰）。同じ炭は1ターンに1回まで" }));
      if (me.wind > 0) btn(`風防で受ける（残り${me.wind}）`, { type: "cool", wind: true }, { test: "ichi-wind" });
    } else if (w.type === "main") {
      lines.push(el("b", { text: "あなたのターン" })); say1("熱を合わせ、カードを1枚まで使って、ターンを終える");
      btn("ターンを終える", { type: "end" }, { primary: true, test: "ichi-end" });
    } else if (w.type === "discard") {
      const need = me.hand.length - RULES.handMax;
      lines.push(el("b", { text: "手札は7枚まで" }), el("span", { text: `灰にする${need}枚を選ぶ（${ui.picks.size}/${need}）` }));
      btn("灰にする", { type: "discard", picks: [...ui.picks] }, { primary: true, test: "ichi-discard", disabled: ui.picks.size !== need });
    } else if (w.type === "react") {
      const pv = puffPreview(G, me);
      lines.push(el("b", { text: "審査：一口の技を使える" }), el("span.ichi-preview", { dataset: { test: "ichi-preview", zone: pv.zone } }, [`判定熱 ${pv.h} → `, el(`i.z-${pv.zone}`, { text: ZONE_LABEL[pv.zone] }), ` ${pv.pts}点`]));
      btn("このまま受ける", { type: "pass" }, { primary: true, test: "ichi-pass" });
    } else if (w.type === "wear") {
      const total = sum(ui.counts);
      lines.push(el("b", { text: `セッションの区切り：葉を${w.n}枚減らす（${total}/${w.n}）` }), wearPicker(me, w, total));
      btn("減らす", { type: "wear", picks: { ...ui.counts } }, { primary: true, test: "ichi-wear", disabled: total !== w.n });
    } else if (w.type === "weaken") {
      lines.push(el("b", { text: "すきま風" }), el("span", { text: "弱める炭を1つ選ぶ" }));
    }
    if (ui.toast) lines.push(el("em.ichi-toast", { text: ui.toast, dataset: { test: "ichi-toast" } }));
    if (tips.length) lines.push(el("div.ichi-tips", { dataset: { test: "ichi-tips" } }, tips.map((t) => el(`small.is-${t.kind}`, [el("i", { text: t.kind === "now" ? "熱" : t.kind === "next" ? "次" : "炭" }), t.text]))));
    return { lines, buttons };
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
    const pf = p.puff || {}, q = PUFFS.normal, s = scorePuff(p, judgedHeat(p, q, pf.tk || 0), q, { blow: pf.blow });
    const good = s.zone === "just" || s.zone === "band";
    return impressionOf(p, s, (pf.impress || 0) + (s.zone === "just" ? 2 * (pf.allIn || 0) : 0) + (good ? pf.warm || 0 : 0) + (p.sessImp || 0), G.R.impress);
  }
  function impressionView(me, op) {
    if (G.phase !== "serve" || !me.main) return null;
    const a = impressionNow(me), b = impressionNow(op);
    return el(`span.ichi-imp${a > b ? ".is-ahead" : a < b ? ".is-behind" : ""}`, { dataset: { test: "ichi-impression", me: String(a), foe: String(b) }, title: "印象＝味値＋帯（ジャスト・適温+1／ズレ−1）＋濃厚＋カード。高い方に一票" },
      [el("small", { text: "印象の見込み" }), el("b", { text: String(a) }), el("span", { text: `対 ${b}` }), el("small", { text: a > b ? "一票" : a < b ? "相手に一票" : "票なし" })]);
  }
  /** HUD 左: 自分の熱（＝火力）と、ふつうに吸われたときの判定熱、カードをあと何枚使えるか、葉の体力、寄せ・煽りの印 */
  function heatRead(me) {
    const h = heatOf(me), base = judgedHeat(me, PUFFS.normal);
    return el("div.ichi-heat-read", { dataset: { test: "ichi-pillar", heat: String(h) }, "aria-label": `熱 ${h}` }, [
      el("div.ichi-fire-count", { dataset: { test: "ichi-firepower", left: String(firepower(me)), total: String(h) } }, [el("small", { text: "熱・火力" }), el("b", { text: String(h) })]),
      base !== h ? el("small.ichi-thermo-base", { text: `判定 ${base}` }) : null,
      el(`small.ichi-coal-count${me.zone.length >= RULES.coalMax ? ".is-full" : ""}`, { dataset: { test: "ichi-coal-count", n: String(me.zone.length) }, title: `炭は${RULES.coalMax}つまで。熱は炭の火の合計`, text: `炭 ${me.zone.length}/${RULES.coalMax}` }),
      el("button.ichi-coal-help", { type: "button", dataset: { test: "ichi-coal-help" }, text: "炭の使い方", "aria-label": "炭の使い方を開く",
        onclick: () => { sfx("select"); openHelp(HELP_PAGES.findIndex((x) => x.title === "炭の活用法")); } }),
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
   * 火力ゾーン（卓の端に縦に積む柱）と、そのすぐ外側の判定のゲージ。1段＝熱1。チャージした札（裏向き＝種火）と、のせた炭（表向き。
   * キューブ炭は2段ぶん）を横向きに積み、積んだ高さがゲージの帯（主役の葉の適温・ジャスト★・焦げ）にそのまま当たる。
   * 自分は手前から奥へ、相手は奥から手前へ積む。手札を選ぶと、いちばん上に「裏向きで置く」（チャージ）が出る
   */
  function fireColumn(p, mine, w, myTurn) {
    const h = heatOf(p), f = p.main ? FLAVOR[p.main] : null, line = scorchLineOf(p);
    const judged = G.judge && p.puff ? judgedHeat(p, G.judge, p.puff.tk) : null, base = judgedHeat(p, PUFFS.normal);
    const coolPick = mine && myTurn && (w.type === "cool" || w.type === "weaken");
    const ashPick = mine && myTurn && (w.type === "main" || (w.type === "prep" && p.turn?.mode === "steam"));
    const si = mine && myTurn && ui.sel?.type === "hand" ? ui.sel.i : null;
    const chargeAt = si !== null && p.hand[si] && canCharge(G, p).ok ? si : null;
    const gauge = el("div.ichi-fire-gauge", { "aria-hidden": "true" }, Array.from({ length: RULES.heatMax }, (_, k) => {
      const v = k + 1, z = f ? zoneCls(rawZone(f, v, line)) : "cold";
      return el(`i.z-${z}${v <= h ? ".is-lit" : ""}${v === h ? ".is-now" : ""}${v === base && base !== h && judged === null ? ".is-base" : ""}${v === judged ? ".is-judged" : ""}`, { text: f && z === "just" ? "★" : String(v) });
    }));
    const stack = el("div.ichi-fire-stack", [
      ...p.zone.map((c, i) => {
        const lv = coalHeat(c), canCool = coolPick && !(w.type === "cool" && c.cooled);
        // 炭1つ＝火の段数ぶんの高さ。札の横に、いまの火を出す
        const card = [coalCard(c, { fresh: isFresh("zone", p, i) }), el(`b.ichi-coal-fire${c.up ? "" : ".is-ember"}`, { text: String(lv), title: coalLabel(c) })];
        if (!mine) return el(`span.ichi-coal-btn.f-${lv}${c.up ? ".is-up" : ""}`, { style: { "--lv": String(lv) }, dataset: { fire: String(lv) } }, card);
        return el(`button.ichi-coal-btn.f-${lv}${c.up ? ".is-up" : ""}${canCool ? ".can" : ""}${c.cooled ? ".is-cooled" : ""}${ui.sel?.type === "zone" && ui.sel.i === i ? ".is-sel" : ""}`, { type: "button", disabled: !(canCool || (ashPick && !coolPick)), style: { "--lv": String(lv) }, dataset: { test: `ichi-coal-${i}`, up: c.up ? "1" : "0", fire: String(lv) },
          "aria-label": coalLabel(c),
          onclick: () => {
            if (canCool) { sfx("click"); submit({ type: w.type, zone: i }); }
            else if (ashPick) { ui.sel = ui.sel?.type === "zone" && ui.sel.i === i ? null : { type: "zone", i }; sfx("click"); render(); }
          } }, card);
      }),
      chargeAt === null ? null : el("button.ichi-ghost.is-charge", { type: "button", style: { "--lv": "1" }, dataset: { test: "ichi-charge-slot" }, "aria-label": "選んだ札を裏向きで火力ゾーンに積む（チャージ・熱+1）",
        onclick: () => { sfx("click"); submit({ type: "charge", hand: chargeAt }); } }, [el("b", { text: "＋" }), el("small", { text: chargeDraws(p) ? "置いて1枚引く" : "裏向きで積む" })]),
    ]);
    return zoneBox("火力ゾーン", `.is-coal.is-${mine ? "me" : "foe"}${chargeAt === null ? "" : ".is-target"}`, { dataset: { test: mine ? "ichi-zone" : "ichi-foe-zone", count: String(p.zone.length), heat: String(h) } }, [gauge, stack]);
  }
  // 準備: フレーバー場（葉の札の山）
  function prepMarket(me, w, myTurn) {
    if (G.phase !== "prep" || me.steamed) return null;
    const canPick = myTurn && w.type === "prep" && !me.turn.mode && canPack(G, me).ok;
    const total = sum(ui.counts), kinds = Object.keys(ui.counts).filter((k) => ui.counts[k] > 0);
    return el("div.ichi-market", { dataset: { test: "ichi-market" } }, G.market.map((id) => {
      const f = FLAVOR[id], left = G.supply[id] - (ui.counts[id] || 0), n = ui.counts[id] || 0;
      const can = canPick && left > 0 && total < packLimit(G, me) && (n > 0 || kinds.length < 2);
      return el(`div.ichi-pile-card${n ? ".is-on" : ""}${left > 1 ? ".is-stack" : ""}`, { dataset: { test: `ichi-market-${id}` } }, [
        el("button.ichi-pile-main", { type: "button", disabled: !can, title: [f.name, `適温${f.lo}〜${f.hi}`, f.ab].filter(Boolean).join("　"), "aria-label": `${f.name} 味値${f.t} 適温${f.lo}〜${f.hi} 残り${left}枚`,
          onclick: () => { ui.counts[id] = n + 1; sfx("click"); render(); } }, [
          tcg("flavor", id, { size: "pile" }),
          el("span.ichi-pile-foot", [el("small", { text: `適温${f.lo}〜${f.hi}` }), f.pair !== "none" ? el("small.ichi-pair", ["相性", kindBadge(f.pair)]) : null, el("b.ichi-count", { text: String(left) })]),
        ]),
        n ? el("button.ichi-pile-minus", { type: "button", "aria-label": `${f.name}を1枚戻す`, text: `${n}枚 −`, onclick: () => { ui.counts[id] = n - 1; sfx("click"); render(); } }) : null,
      ]);
    }));
  }

  // 自分の顔と点・手札
  function handRow(me, w, myTurn) {
    const multi = myTurn && (w.type === "embers" || w.type === "discard");
    const sel = ui.sel?.type === "hand" ? ui.sel.i : -1;
    const n = me.hand.length, room = 692, cardW = 112, gap = 8; // 扇形に開くぶん、枠（728px）より少し内側に収める
    const overlap = n > 1 && n * cardW + (n - 1) * gap > room ? Math.ceil((n * cardW - room) / (n - 1)) : -gap;
    const cards = me.hand.map((id, i) => {
      const coal = CARD[id].type === "coal";
      const usable = myTurn && (coal ? canPlace(G, me, id).ok : canPlay(G, me, id).ok);
      const locked = !coal && heatOf(me) < (CARD[id].need || 0);
      const on = multi ? ui.picks.has(i) : sel === i;
      const t = i - (n - 1) / 2, drawn = isFresh("hand", me, i);
      return el(`button.ichi-hand-card${on ? ".is-sel" : ""}${usable ? ".can" : ""}${locked ? ".is-locked" : ""}${drawn ? ".is-drawn" : ""}`, { type: "button", disabled: !myTurn,
        style: { marginLeft: i ? `${-overlap}px` : null, "--r": `${(t * 2).toFixed(2)}deg`, "--dy": `${(t * t).toFixed(1)}px`, "--i": drawn ? String(i - ui.seen.hand[me.index]) : null },
        dataset: { test: `ichi-hand-${i}`, card: id, locked: locked ? "1" : null },
        "aria-label": `${CARD[id].name}${coal ? "" : `（必要火力${CARD[id].need || 0}）`}：${CARD[id].tx}`,
        onclick: () => {
          if (multi) { ui.picks.has(i) ? ui.picks.delete(i) : ui.picks.add(i); }
          else ui.sel = sel === i ? null : { type: "hand", i };
          sfx("click"); render();
        } }, tcg("card", id));
    });
    return el("div.ichi-hand-row", [leader(me, "me"), el("div.ichi-hand", { dataset: { test: "ichi-hand" } }, cards), detail(me, w, myTurn) || forecast(me)]);
  }
  /** そのターン最初のチャージは「チャージ＆ドロー」（置いて1枚引く）か */
  const chargeDraws = (p) => G.R.chargeDraw > 0 && !(p.turn?.charges > 0);

  // ───────── 炭の手引き（案内の札の下に出す短い助言） ─────────
  // 2026-11-11 オーナー「炭ってシステムがよくわからないので、活用法とかわかりやすくしたい」。
  // いまの熱が帯のどこか（熱）・炭をどう動かせばよいか（炭）・次のターンにどうなるか（次）を、状況に合わせて1行ずつ。
  function coalTips(me, w) {
    const tips = [], tip = (kind, text) => tips.push({ kind, text });
    const f = me.main ? FLAVOR[me.main] : null, h = heatOf(me), room = coalRoom(me);
    const ready = me.stove.filter((c) => c.stage === 2), baking = me.stove.length - ready.length;
    const coalInHand = me.hand.some((id) => CARD[id].type === "coal"), stoveRoom = me.stove.length < slotsOf(me);
    if (w.type === "embers") { tip("coal", "置いた札は「種火」（火1）。炭は4つまで"); return tips; }
    if (w.type === "cool") { tip("coal", "火の小さい炭から下げると、枠が空いて新しい炭をのせやすい"); return tips; }
    if (w.type === "prep" && me.turn.mode !== "steam") {
      if (!me.turn.mode && f) tip("now", `いまの熱${h}。${f.name}の適温は${f.lo}〜${f.hi}`);
      return tips;
    }
    if (!(w.type === "main" || w.type === "prep") || !f) return tips;
    // いまの熱が帯のどこか（アマバースト・寄せ・煽りを入れた判定で見る）
    const d = judgedHeat(me, PUFFS.normal) - h, lo = f.lo - d, hi = f.hi - d, line = scorchLineOf(me) - d;
    const justs = f.j.map((j) => j - d), near = justs.length ? justs.reduce((a, b) => (Math.abs(b - h) < Math.abs(a - h) ? b : a)) : null;
    const band = `適温は熱${lo}〜${hi}${near === null ? "" : `（★${justs.join("・")}）`}`;
    let want = 0; // 上げたい（+）・下げたい（−）
    if (h >= line) { want = hi - h; tip("now", `熱${h}は焦げる。${h - hi}下げる。${band}`); }
    else if (h > hi) { want = hi - h; tip("now", `熱${h}は熱い。${h - hi}下げる。${band}`); }
    else if (h < lo) { want = lo - h; tip("now", `熱${h}はぬるい。あと${lo - h}上げる。${band}`); }
    else if (near !== null && near !== h) { want = near - h; tip("now", `熱${h}は適温。★ジャストは${near}（${near > h ? `あと+${near - h}` : `${near - h}`}）`); }
    else tip("now", near === null ? `熱${h}は適温` : `熱${h}は★ジャスト。このまま出せる`);
    // 炭の手
    if (want > 0) {
      if (ready.length && room) tip("coal", `焼けた炭をのせる（${[...new Set(ready.map((c) => `熱+${CARD[c.id].heat}`))].join("・")}）`);
      else if (ready.length) tip("coal", "炭が4つ。火の小さい炭を外すと、焼けた炭をのせられる");
      else if (room && me.hand.length && canCharge(G, me).ok) tip("coal", chargeDraws(me) ? "手札を1枚チャージ＆ドロー（熱+1・1枚引く）" : "手札をチャージ（種火・熱+1）");
      else if (!room) tip("coal", "炭が4つ。上げるには、弱った炭を外して入れ替える");
      if (!ready.length && coalInHand && stoveRoom) tip("coal", "炭カードを炭焼き場へ（フラットは次のターン、キューブは2ターン後に焼ける）");
    } else if (want < 0) {
      tip("coal", canAsh(G, me).ok ? "炭を1つ選んで外す（灰にする・1ターンに1回）" : "炭を外せるのは1ターンに1回。冷めるのを待つ");
    } else if (coalInHand && stoveRoom) tip("coal", "いまのうちに炭カードを炭焼き場へ。次のターンにのせられる");
    else if (!me.stove.length && !coalInHand) tip("coal", "焼いている炭が無い。次は種火（チャージ）でつなぐ");
    // 次のターン
    if (w.type === "main" && !me.noCool && me.zone.length) {
      const lose = Math.max(0, coolStepsOf(me) - me.wind);
      if (lose) tip("next", `次のターンは冷めて熱−${lose}${baking + ready.length ? "。焼けた炭で戻す" : "。足す炭を用意しておく"}`);
    }
    return tips.slice(0, 3);
  }

  // ───────── 審査員の声（右下の掲示板。新しいものが上） ─────────
  // 2026-11-11 オーナー「この一口の見込みもわかりづらいので、ここは審査員のフィードバックを掲示板みたいに出したい。ログを」。
  /** 一口の結果を、次にどうすればよいかが分かる短い一言にする（帯と、適温までの差） */
  function feedLine(p, r) {
    const f = p.main ? FLAVOR[p.main] : null;
    if (r.zone === "scorch") return `焦げた。熱すぎる${r.lost ? "（葉を1枚失った）" : ""}`;
    if (!f) return ZONE_LABEL[r.zone];
    if (r.zone === "just") return "ちょうどいい。いちばんおいしい熱";
    const near = f.j.length ? f.j.reduce((a, b) => (Math.abs(b - r.h) < Math.abs(a - r.h) ? b : a)) : null;
    if (r.zone === "band") return near === null || near === r.h ? "適温。おいしく吸えた" : `適温。あと${Math.abs(near - r.h)}${near > r.h ? "上げる" : "下げる"}とジャスト`;
    return r.h > f.hi ? `${r.zone === "off" ? "少し熱い" : "熱すぎる"}。${r.h - f.hi}下げたい` : `${r.zone === "off" ? "少しぬるい" : "ぬるい"}。あと${f.lo - r.h}上げたい`;
  }
  function feedEntry(ev) {
    const side = (i) => { const r = ev.res[i]; return { h: r.h, zone: r.zone, pts: r.pts + (r.vote || 0), imp: r.imp, line: feedLine(G.P[i], r) }; };
    return { round: ev.round, judge: ev.puff.judge || null, style: ev.puff.style, dh: ev.puff.dh || 0, voter: ev.voter, me: side(ME), foe: side(CPU) };
  }
  /** 右下（札を選んでいないとき）: 審査員の声。まだ審査が無いあいだは、審査員の紹介（決め手）を貼っておく */
  function forecast(me) {
    if (G.over) return null;
    const op = G.P[CPU], judges = G.tour.judges;
    const post = (e) => el(`li.ichi-post${e.voter === ME ? ".is-won" : e.voter === CPU ? ".is-lost" : ""}`, { dataset: { test: "ichi-post", round: String(e.round + 1), zone: e.me.zone } }, [
      el("header", [e.judge ? faceNode(JUDGE_FACE[e.judge], JUDGE[e.judge].name, ".is-judge") : null,
        el("b", { text: `${e.round + 1}口目` }), el("span", { title: e.judge ? JUDGE[e.judge].name : "練習", text: `${e.style}${e.dh ? `（熱${dhText(e.dh)}）` : ""}` })]),
      el("p.is-me", [el(`i.ichi-zone-chip.z-${e.me.zone}`, { text: ZONE_LABEL[e.me.zone] }), el("span", { text: `「${e.me.line}」` }), el("b", { text: `+${e.me.pts}` })]),
      el("p.is-foe", [el("small", { text: `${op.name}：${ZONE_LABEL[e.foe.zone]} +${e.foe.pts}` }),
        el("small.ichi-post-vote", { text: e.voter == null ? "票なし" : `一票は${e.voter === ME ? "あなた" : op.name}（印象${e.me.imp}対${e.foe.imp}）` })]),
    ]);
    const intro = judges.length
      ? judges.map((id) => el("li.ichi-post.is-intro", { dataset: { test: "ichi-post-intro" } }, [
        el("header", [faceNode(JUDGE_FACE[id], JUDGE[id].name, ".is-judge"), el("b", { text: JUDGE[id].name }), el("span", { text: `「${JUDGE[id].motto}」` })]),
        el("p", [el("small", { text: `決め手：${JUDGE[id].bonus}` })])]))
      : [el("li.ichi-post.is-intro", [el("p", [el("small", { text: "練習試合。審査員はいない。毎回「ふつうに吸う」で採点する。" })])])];
    return el("div.ichi-feed", { dataset: { test: "ichi-forecast", posts: String(ui.feed.length) } }, [
      el("header", [el("b", { text: "審査員の声" }), G.phase === "serve" ? impressionView(me, op) : el("small", { text: "一口ごとに、ここに書き込まれる" })]),
      el("ul", { tabindex: "0", "aria-label": "審査の記録（新しい順）" }, [...ui.feed.map(post), ...(ui.feed.length ? [] : intro)]),
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
      btn(`灰にする（外す・熱−${coalHeat(c)}）`, { type: "ash", zone: ui.sel.i }, canAsh(G, me), { test: "ichi-do-ash" });
      return el("div.ichi-detail", { dataset: { test: "ichi-detail" } }, [el("div.ichi-detail-text", [el("b", { text: c.up ? CARD[c.id].name : "種火" }),
        el("small", { text: c.up ? `いまの火${coalHeat(c)}（新品は${CARD[c.id].heat}）。火は下がるだけで、戻らない` : "裏向きで置いた札。火1" }),
        el("p", { text: c.up ? CARD[c.id].tx : "冷めるときに選ぶと灰になる。外して、焼けた炭と入れ替えてもよい。" })]), el("div.ichi-detail-buttons", buttons)]);
    }
    const i = ui.sel.i, id = me.hand[i]; if (!id) return null;
    const c = CARD[id], coal = c.type === "coal";
    const reasons = [];
    if (coal) { const r = canPlace(G, me, id); btn("炭焼き場に置く", { type: "place", hand: i }, r, { primary: true, test: "ichi-do-place" }); if (!r.ok) reasons.push(r.reason); }
    else { const r = canPlay(G, me, id); btn(c.when === "puff" && !G.R.reactAfterReveal ? "この一口に仕込む" : "使う", { type: "play", hand: i }, r, { primary: true, test: "ichi-do-play" }); if (!r.ok) reasons.push(r.reason); }
    if (w.type === "main" || w.type === "prep") btn(chargeDraws(me) ? "チャージ＆ドロー" : "チャージ（熱+1）", { type: "charge", hand: i }, canCharge(G, me), { test: "ichi-do-charge" });
    return el("div.ichi-detail", { dataset: { test: "ichi-detail" } }, [
      el("div.ichi-detail-text", [el("b", { text: c.name }), el("small", { text: coal ? `炭・火${c.heat}・着火${c.ig}ターン` : `${TYPE_LABEL[c.type]}・${WHEN_LABEL[c.when]}・必要火力${c.need || 0}（いま${heatOf(me)}）${payLabel(c) ? `・${payLabel(c).short}` : ""}` }), reasons.length ? el("em", { text: reasons[0] }) : null, el("p", { text: c.tx })]),
      el("div.ichi-detail-buttons", buttons),
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
      el("header", [faceNode(mine ? "hajime" : foe.id, p.name), el("div", [el("h2", { text: mine ? "あなたの一台" : `${p.name}の一台` }), el("small", { text: KIT[p.kit]?.name || "" })])]),
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
      judges.length ? el("ul.ichi-info-perms", judges.map((id) => el("li", [faceNode(JUDGE_FACE[id], JUDGE[id].name, ".is-judge"), el("b", { text: JUDGE[id].name }), el("span", { text: `決め手：${JUDGE[id].bonus}` })]))) : null,
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
    openSheet("reveal", el("div.ichi-reveal", [el("small", { text: "審査" }), puffCard(q)]));
    await wait(1100);
    if (ui.sheet === "reveal") closeSheet();
  }
  function showScore(ev) {
    const row = (i, label) => {
      const r = ev.res[i];
      return el(`div.ichi-result-row.z-${r.zone}`, { dataset: { test: `ichi-result-${i === ME ? "me" : "foe"}`, zone: r.zone } }, [
        el("span.ichi-result-who", [faceNode(i === ME ? "hajime" : foe.id, label), el("b", { text: label })]), el("span.ichi-result-heat", { text: `判定熱 ${r.h}` }), el(`i.ichi-zone-chip.z-${r.zone}`, { text: ZONE_LABEL[r.zone] }),
        el("span.ichi-result-parts", { text: r.parts.length ? r.parts.map((x) => `${x.label}${x.n >= 0 ? "+" : ""}${x.n}`).join("　") : "加点なし" }),
        el("span.ichi-result-imp", { dataset: { test: `ichi-imp-${i === ME ? "me" : "foe"}` }, text: `印象 ${r.imp}` }),
        el("strong", { text: `${r.pts}点` }), r.vote ? el("em", { text: `一票 +${r.vote}` }) : null, r.lost ? el("small", { text: `${FLAVOR[r.lost].name}を1枚失う` }) : null]);
    };
    const mine = ev.res[ME];
    sfx(mine.zone === "just" ? "perfect" : mine.zone === "band" ? "good" : "miss");
    return new Promise((resolve) => {
      let settled = false;
      const done = () => {
        if (settled) return; settled = true;
        if (ui.sheet === "score") closeSheet();
        for (const [i, who] of [[ME, "me"], [CPU, "foe"]]) { const n = ev.res[i].pts + (ev.res[i].vote || 0); if (n && !quick()) floatText(who, `+${n}`); }
        if (ev.voter != null && !quick() && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
          const medal = el(`i.ichi-flying-medal.is-${ev.voter === ME ? "me" : "foe"}`, { "aria-hidden": "true" });
          root.append(medal); setTimeout(() => medal.remove(), 850);
        }
        resolve();
      };
      openSheet("score", el("div.ichi-result", { dataset: { test: "ichi-result" } }, [
        !quick() && ev.res.some((r) => r.zone === "just" || r.zone === "scorch") ? el(`div.ichi-cutin-band.${ev.res[CPU].zone === "scorch" || ev.res[ME].zone === "scorch" ? "is-scorch" : "is-just"}`, { "aria-hidden": "true" },
          el("b", { text: ev.res[CPU].zone === "scorch" || ev.res[ME].zone === "scorch" ? "焦げ" : "ジャスト" })) : null,
        el("header", [el("small", { text: `ラウンド ${ev.round + 1}` }), puffCard(ev.puff)]),
        row(ME, "あなた"), row(CPU, G.P[CPU].name),
        el("p.ichi-result-vote", { text: ev.voter == null ? `印象が同じ（${ev.res[ME].imp}）なので、票は入らない` : `印象 ${ev.res[ME].imp} 対 ${ev.res[CPU].imp}。${ev.voter === ME ? "あなた" : G.P[CPU].name}に一票` }),
        el("button.ichi-btn.is-primary", { type: "button", text: "次へ", dataset: { test: "ichi-next" }, onclick: () => { sfx("select"); done(); } }),
      ]));
      sheet.querySelector("button")?.focus({ preventScroll: true });
      if (pilot === "cpu") queueMicrotask(done);
    });
  }
  function showEnd() {
    const res = G.result, me = G.P[ME], op = G.P[CPU];
    const game = { winner: res.winner, scores: res.scores.slice(), votes: res.votes.slice(), tournament: G.tour.id, kit: me.kit, level: cfg.level, rounds: roundsOf(G) };
    games.push(game);
    setFoeMood(...(res.winner === CPU ? ["excited", "smile", "smug"] : res.winner === ME ? ["sad", "shock", "serious"] : ["normal"]));
    render();
    sfx(res.winner === ME ? "fanfare" : "cancel");
    return new Promise((resolve) => {
      const bonus = res.bonus.filter((b) => b.pts[0] || b.pts[1]).map((b) => el("li", [el("span", { text: `${JUDGE[b.judge].name}${b.note ? `（${b.note}）` : "の決め手"}` }), el("b", { text: `${b.pts[0] ? `+${b.pts[0]}` : "—"}` }), el("b", { text: `${b.pts[1] ? `+${b.pts[1]}` : "—"}` })]));
      openSheet("end", el("div.ichi-end", { dataset: { test: "ichi-end-sheet", winner: res.winner === ME ? "me" : res.winner === CPU ? "foe" : "draw" } }, [
        el("div.ichi-end-foe", { "aria-label": `${op.name}の表情` }, foeBust(op.name)),
        el("h2", { text: res.winner === ME ? "勝ち" : res.winner === CPU ? "負け" : "引き分け" }),
        el("div.ichi-end-scores", [el("div", [el("small", { text: "あなた" }), el("b", { text: String(me.score) }), el("span", { text: `票 ${me.votes}・ジャスト ${me.justCount}・焦げ ${me.scorchCount}` })]),
          el("div", [el("small", { text: op.name }), el("b", { text: String(op.score) }), el("span", { text: `票 ${op.votes}・ジャスト ${op.justCount}・焦げ ${op.scorchCount}` })])]),
        bonus.length ? el("ul.ichi-end-bonus", bonus) : null,
        el("div.ichi-end-buttons", [
          allowRetry ? el("button.ichi-btn", { type: "button", text: "もう一度", dataset: { test: "ichi-again" }, onclick: () => { sfx("select"); closeSheet(); resolve(); showSetup(); } }) : null,
          el("button.ichi-btn.is-primary", { type: "button", text: "おわる", dataset: { test: "ichi-finish" }, onclick: () => { sfx("select"); resolve(); close(true); } }),
        ]),
      ]));
      sheet.querySelector(".ichi-btn.is-primary")?.focus({ preventScroll: true });
    });
  }
  function openHelp(page = 0) {
    if (ui.sheet === "info") closeSheet();
    const back = ui.sheet;
    const draw = () => {
      const p = HELP_PAGES[page];
      openSheet("help", el("div.ichi-help", { dataset: { test: "ichi-help-sheet" } }, [
        el("header", [el("small", { text: `遊び方 ${page + 1}/${HELP_PAGES.length}` }), el("h2", { text: p.title })]),
        el("ul", p.lines.map((t) => el("li", { text: t }))),
        el("div.ichi-help-buttons", [
          el("button.ichi-btn.is-small", { type: "button", text: "前へ", disabled: page === 0, onclick: () => { page--; sfx("click"); draw(); } }),
          el("button.ichi-btn.is-small", { type: "button", text: "次へ", disabled: page === HELP_PAGES.length - 1, dataset: { test: "ichi-help-next" }, onclick: () => { page++; sfx("click"); draw(); } }),
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

