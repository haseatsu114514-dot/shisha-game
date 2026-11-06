// 「てつこといっしょ / TETSUKO TIME」（#2454）の画面と本編との確定点。猫の状態・反応・自律行動は tetsuko-model.js。
//
// 動線（オーナー判断 2026-11-04・実装計画 §1）: mukai で行動を使う → 帰りに裏口をのぞく（ch3-tokyo-daily.js の
// offerTetsuko）→「てつこといっしょ」→ 来訪4回未満なら既存の段階会話を先に読む（関係進展の正本）→ この画面 →
// 「帰る」→ settleTetsukoTime で確定 → 呼び出し側が回復12と toast。地図のピンは作らない。第5章の入口は今回触らない。
//
// 画面（計画 §5・UI v2 は docs/spec/tetsuko_time.md §6）: #stage（1280×720）の #screen 層に重ねる。HUD はそのまま。
// 背景は裏口の絵（届くまでは bg_street に CSS の壁・戸・ベンチ）。猫は既存の5表情を同じ枠で切り出して大きく見せ、
// しぐさの絵が届いた物から差し替える（tetsuko-art.js の ART_READY）。小物・UI も同じ。文字は絵に焼き込まない。
// 手元の道具: なでる手／猫じゃらし／ブラシ。じゃらしは指やマウスで直接動かし、止めると捕まえる。ブラシは猫をなぞる。
// どれも下のボタン1回でも同じ結果（筆圧・精度・時間制限は求めない）。「帰る」は膝に乗られている時も含めて、いつでも押せる。
//
// 素材は Codex への依頼（asset_sources/tetsuko-care/README.md）。設計・コード担当は別個体の猫や未承認の素材を生成・採用しない。
//
// DOM 依存（ui.js / util.js / audio.js / data.js）は openTetsukoTime の中で遅延 import する。
// 本ファイルの top-level（確定点）は DOM 非依存で、Node のテストからそのまま import できる。
import { TOKYO_OUTINGS } from "../chapters/ch3-outing-progress.js";
import {
  OUTINGS_FLAG, TETSUKO_TIME_FLAG, readTetsukoRecord, tetsukoVisits, createSession, openingReaction, act, canAct, toyOut,
  autonomous, autoDelay, placeProp, takePhoto, farewell, sessionResult, moodOf, moodLabel, propById, momentById, propUnlocked,
  MOMENTS, PROPS, SLOTS, SLOT_NAMES,
} from "./tetsuko-model.js";
import { ART_READY, hasPose, poseUrl, artAttrs } from "./tetsuko-art.js";
import { tetsukoTheme } from "./tetsuko-theme.js";
import { HELP_TITLE, helpCard } from "./tetsuko-help.js";

export const TETSUKO_TIME = Object.freeze({
  id: "tetsuko_time",
  title: "てつこといっしょ",
  roman: "TETSUKO TIME",
});

/** 有効なふれあい1回で戻る体力。「少し構っていく」と同じ内部値（正本は TOKYO_OUTINGS.tetsuko.stamina = 12）。 */
export const TETSUKO_STAMINA = TOKYO_OUTINGS.find(outing => outing.id === "tetsuko")?.stamina ?? 12;

/**
 * 本編アダプターの確定点（#2454 §10-4・実装計画 §3）。DOM を持たない同期の純関数。
 * 意味のあるふれあい（result.meaningful）で、まだ確定していない訪問キー（result.visitKey）のときだけ、
 * この一回の処理の中で (a) 来訪記録 _ch3_outings.tetsuko を +1、(b) _tetsuko_time に小物の配置・発見・
 * アルバム・おやつの日・訪問キーを書き、{ committed:true, stamina:12 } を返す。呼び出し側が同じ処理の中で
 * addStamina(12) と toast を出す。それ以外は { committed:false } で、保存には一切触らない。
 * 増やさないもの: 経験値・能力・火種・好感度・お金・日付・時間帯（ここでは書けない API しか使わない）。
 * 「少し構っていく」（台本だけ読む短い経路）も同じ確定点を通る（result に小物・発見が無ければ記録を保つ）。
 * @param {object} value 現在のセーブ
 * @param {{ meaningful?: boolean, visitKey?: string, props?: object, found?: string[], album?: object[], treatDay?: number|null }} [result]
 * @returns {{ committed: boolean, stamina?: number }}
 */
export function settleTetsukoTime(value, result) {
  if (!value?.flags || !result?.meaningful || typeof result.visitKey !== "string" || !result.visitKey) return { committed: false };
  const record = readTetsukoRecord(value);
  if (record.lastKey === result.visitKey) return { committed: false };
  const counts = value.flags[OUTINGS_FLAG] && typeof value.flags[OUTINGS_FLAG] === "object" ? value.flags[OUTINGS_FLAG] : {};
  value.flags[OUTINGS_FLAG] = { ...counts, tetsuko: tetsukoVisits(value) + 1 };
  // 新しい記録は正規化してから書く（壊れた値・未知の id・同じ瞬間の重複を残さない）。
  const next = readTetsukoRecord({ flags: { [TETSUKO_TIME_FLAG]: {
    props: result.props || record.props,
    found: [...record.found, ...(Array.isArray(result.found) ? result.found : [])],
    album: Array.isArray(result.album) ? result.album : record.album,
    treatDay: result.treatDay === undefined ? record.treatDay : result.treatDay,
  } } });
  value.flags[TETSUKO_TIME_FLAG] = { ...next, sessions: record.sessions + 1, lastKey: result.visitKey };
  return { committed: true, stamina: TETSUKO_STAMINA };
}

/** 親の mukai 訪問から作る、安定した訪問キー（同じ訪問の再確定・二重押しを止める）。 */
export const tetsukoVisitKey = value => `${value?.chapter ?? 0}:${value?.day ?? 0}:${value?.slot ?? 0}:${tetsukoVisits(value)}`;

// ---- 画面 ---------------------------------------------------------------------------------------
const FACES = Object.freeze(["normal", "smile", "serious", "surprise", "sleep"]);
// 手元の道具と操作（右下）。tool のある操作は、押すとその道具に持ち替えて1回行う（じゃらし・ブラシは直接も動かせる）。
const DOCK = Object.freeze([
  { kind: "pet", tool: "hand", label: "なでる", icon: "hand" },
  { kind: "play", tool: "toy", label: "あそぶ", again: "振る", icon: "teaser" },
  { kind: "catch", label: "止める", icon: "stop" },
  { kind: "brush", tool: "brush", label: "ブラシ", locked: "まだ早い", icon: "brush" },
  { kind: "treat", label: "おやつ", locked: "今日はもう", icon: "treat" },
  { kind: "watch", label: "そっと見守る", icon: "watch" },
]);
// 線のアイコン（Codex のアイコンが届くまで。ラベンダーの墨の線に見えるよう currentColor の細い線で描く）
const ICONS = Object.freeze({
  hand: '<path d="M8.5 13V6.2a1.4 1.4 0 0 1 2.8 0V12m0-1.6V4.6a1.4 1.4 0 0 1 2.8 0v6.2m0-5a1.4 1.4 0 0 1 2.8 0v6m0-3.6a1.4 1.4 0 0 1 2.8 0v5.6c0 4-2.6 6.8-6.4 6.8-2.7 0-4.4-1.3-5.7-3.4L4.6 14.4a1.5 1.5 0 0 1 2.4-1.8L8.5 14"/>',
  teaser: '<path d="M4 20 15.5 8.5"/><path d="M15.5 8.5c1.6-3.4 3.3-4.6 5-4.5-.2 1.9-1.2 3.6-4.3 5.3"/><path d="M15.2 8.8c3.5-.4 5 .5 5.6 1.8-1.7.8-3.6.6-5.8-1.4"/><circle cx="16.5" cy="7.5" r="1.1"/>',
  stop: '<path d="M7 11.5V9a1.5 1.5 0 0 1 3 0v1m0-.5V8a1.5 1.5 0 0 1 3 0v2m0-.5V9a1.5 1.5 0 0 1 3 0v2.5m0-.5a1.5 1.5 0 0 1 3 0v2.5c0 3.8-2.6 6.5-6.3 6.5-3 0-4.9-1.6-6-4l-1.4-3.2A1.5 1.5 0 0 1 7 11.5"/>',
  brush: '<rect x="3.5" y="4.5" width="11" height="7" rx="2"/><path d="M5.5 11.5v2.2m2.5-2.2v2.6m2.5-2.6v2.2m2.5-2.2v2.6"/><path d="M12.8 7.2 20.5 18.6a1.6 1.6 0 0 1-2.7 1.7L10.6 9"/>',
  treat: '<ellipse cx="12" cy="15.5" rx="8.5" ry="3"/><path d="M3.5 15.5c.6 2.4 3.9 4 8.5 4s7.9-1.6 8.5-4"/><path d="M8.5 12.4c1.6-1.5 3.7-1.9 6.1-.6m-4.4-1.4c1-.9 2.6-1.1 4 .1"/>',
  watch: '<path d="M3.5 13.5h17M5.5 13.5v6m13-6v6"/><path d="M6.5 13.5c.4-1.6 1.7-2.4 5.5-2.4s5.1.8 5.5 2.4"/><circle cx="12" cy="5.6" r="1.9"/><path d="M12 7.5v3.6"/>',
  decor: '<path d="M4 9.5 12 6l8 3.5v8.5L12 21.5 4 18z"/><path d="M4 9.5 12 13l8-3.5M12 13v8.5"/><path d="M4 9.5 2 6.4 9.8 3.2 12 6m8 3.5 2-3.1L14.2 3.2 12 6"/>',
  book: '<path d="M4.5 4.5h10.5a2.5 2.5 0 0 1 2.5 2.5v13H7a2.5 2.5 0 0 1-2.5-2.5z"/><path d="M4.5 17.5A2.5 2.5 0 0 1 7 15h10.5"/><circle cx="11" cy="10.6" r="1.6"/><circle cx="8.6" cy="8.2" r=".8"/><circle cx="10.4" cy="7.3" r=".8"/><circle cx="12.4" cy="7.4" r=".8"/><circle cx="13.9" cy="8.6" r=".8"/>',
  photo: '<rect x="3.5" y="6.5" width="17" height="13" rx="2"/><path d="M8.5 6.5 10 4h4l1.5 2.5"/><circle cx="12" cy="13" r="3.6"/><path d="M17.3 9.3h.01"/>',
  back: '<path d="M6 21V4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21"/><path d="M4 21h16"/><rect x="9" y="6" width="6" height="5" rx=".5"/><path d="M14.8 15.2h.01"/>',
});
const icon = name => `<svg class="tt-ico" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ""}</svg>`;
// 居場所の x（歩く向きと、じゃらしの先の初めの位置に使う。CSS の --x と同じ値）
const SPOT_X = Object.freeze({ bench: 292, floor: 548, bed: 1012, front: 668, lap: 640, "slot-bench": 400, "slot-floor": 770, "slot-bed": 1012 });
const HAND_AT = Object.freeze({ x: 1310, y: 540 }); // じゃらしの棒の根元（はじめの手元＝右の外。下の操作の帯に重ねない）
const STEP_MS = 1000, STEP_REDUCED_MS = 700, FAREWELL_MS = 1400, FAREWELL_REDUCED_MS = 800, AFTER_ACTION_MS = 1600, WALK_MS = 900;
const STROKE_PX = 90, STROKE_GAP_MS = 600, BRUSH_PX = 110, BRUSH_GAP_MS = 650;
const TOY_SWING_PX = 170, TOY_SWING_GAP_MS = 480, TOY_STILL_MS = 750, TOY_CATCH_PX = 300, TOY_HELD_MS = 1600;
const TOAST_MS = 3200;

/**
 * 「てつこといっしょ」の画面を開く（#2454 §10-2）。「帰る」か中断で閉じ、確定に渡す結果を返す。
 * 保存はここでは書かない（確定は呼び出し側が settleTetsukoTime で同じ処理の中に行う）。
 * @param {object} ctx
 * @param {object} ctx.value 現在のセーブ（読むだけ）
 * @param {string} [ctx.visitKey] 親の mukai 訪問の訪問キー（tetsukoVisitKey）
 * @param {string} [ctx.bg] 背景の URL（裏口）。裏口の絵（bg_mukai_backdoor）が届くまでの代わり
 * @param {() => boolean} [ctx.isCurrent] このセッションがまだ有効か（LOAD/章跨ぎで false）
 * @param {AbortSignal} [ctx.signal] 中断シグナル（pagehide などで閉じる）
 * @returns {Promise<object>} sessionResult。中断・LOAD では { meaningful:false }
 */
export async function openTetsukoTime({ value = null, visitKey = null, bg = null, isCurrent = () => true, signal = null } = {}) {
  const idle = { meaningful: false, visitKey };
  if (signal?.aborted || !isCurrent() || !value) return idle;
  const [{ el }, ui, audio, data, kit] = await Promise.all([
    import("../core/util.js"),
    import("../core/ui.js"),
    import("../core/audio.js"),
    import("../core/data.js"),
    import("../core/transition-kit.js"),
  ]);
  if (signal?.aborted || !isCurrent()) return idle;
  const tod = value.slot >= 1 ? "night" : "day";
  const backdoor = ART_READY.background ? data.sceneBg?.("bg_mukai_backdoor", tod) : null;
  const scene = backdoor?.url ? backdoor : bg ? { url: bg, tint: null } : null;
  if (scene) await ui.setBg(scene.url, { instant: true, ...(scene.tint ? { tint: scene.tint } : {}) });
  if (signal?.aborted || !isCurrent()) return idle;
  const { layers, showScreen } = ui;
  const SE = audio.SE || {};
  const bgmBefore = audio.currentBgm();
  const reduced = !!kit.reducedMotion?.();
  const session = createSession(value, { visitKey });
  const name = id => data.displayName?.(id, value) || (id === "mukai_master" ? "ムカイさん" : id);
  const faceSrc = face => data.portraitInfo?.("tetsuko", face)?.src || "";
  const startDay = Number(value.flags?._ch3_intro?.startDay) || null;
  const dayLabel = day => startDay && day >= startDay ? `東京 ${day - startDay + 1}日目` : "";

  return await new Promise(resolve => {
    let done = false, leaving = false, mounted = false, panel = null;
    let timer = 0, stepTimer = 0, fxTimer = 0, purrTimer = 0, walkTimer = 0, stillTimer = 0, heldTimer = 0, flashTimer = 0, quietUntil = 0;
    let tool = "hand", stroke = null, lastPetAt = 0, lastBrushAt = 0, lastSwingAt = 0, toyTravel = 0, held = false;
    let toyTip = null, selected = null, fresh = [], bookSel = null, lastAt = null, stepFrames = 0, walkFrame = "walk_a";

    // -- 猫（5表情を重ねて置き、表情は data-face で切り替える。しぐさの絵が届いていれば .tt-cat-pose に出す）
    const imgs = FACES.map(face => el("img.tt-cat-img", { src: faceSrc(face), alt: "", draggable: "false", dataset: { face }, decoding: "async" }));
    const pose = el("img.tt-cat-pose", { alt: "", draggable: "false", hidden: true, decoding: "async" });
    const purr = el("span.tt-purr", { "aria-hidden": "true" }, [el("i"), el("i"), el("i")]);
    const cat = el("button.tt-cat", { type: "button", "aria-label": "てつこ", dataset: { test: "tetsuko-cat" } }, [
      el("span.tt-cat-shadow"), el("span.tt-cat-frame", imgs), pose, purr, el("span.tt-fx", { "aria-hidden": "true" }),
    ]);
    const toyStick = el("i.tt-toy-stick"), toyTipEl = el("i.tt-toy-tip");
    const toy = el("span.tt-toy", { "aria-hidden": "true", dataset: { test: "tetsuko-toy" } }, [toyStick, toyTipEl]);
    const plate = el("span.tt-plate", { "aria-hidden": "true" });
    const lap = el("span.tt-lap", { "aria-hidden": "true" });
    const slots = Object.fromEntries(SLOTS.map(slot => [slot, el("div.tt-slot", { dataset: { slot } })]));
    const slotHits = Object.fromEntries(SLOTS.map(slot => [slot, el("button.tt-slot-hit", { type: "button", hidden: true,
      dataset: { slot, test: `tetsuko-slot-${slot}` }, "aria-label": `${SLOT_NAMES[slot]}に置く`, onclick: () => pickSlot(slot) },
      [el("span.tt-slot-label", { text: SLOT_NAMES[slot] })])]));
    const yard = el("div.tt-yard", [
      el("div.tt-set", { "aria-hidden": "true" }, [
        el("div.tt-wall", [el("div.tt-door", [el("i.tt-door-window"), el("i.tt-door-knob")]), el("i.tt-lamp")]),
        el("div.tt-ground"),
        el("div.tt-bench", [el("i.tt-bench-seat"), el("i.tt-bench-leg.l"), el("i.tt-bench-leg.r")]),
        el("div.tt-sacks", [el("i"), el("i"), el("i")]),
      ]),
      ...Object.values(slots), lap, plate, cat, toy, ...Object.values(slotHits),
    ]);

    // -- 今日のてつこ（右上の札）・反応の帯（左下。見つけた・撮った時の小さな札もここ）
    const mood = el("p.tt-mood", { dataset: { test: "tetsuko-mood" }, text: moodLabel(moodOf(session.day), session.stage) });
    const memo = el("header.tt-memo", [el("i.tt-memo-tape"), el("small.tt-memo-title", { text: `${TETSUKO_TIME.title}　${TETSUKO_TIME.roman}` }), mood]);
    const text = el("p.tt-text", { dataset: { test: "tetsuko-caption" } });
    const line = el("p.tt-line", { hidden: true }, [el("b.tt-line-name"), el("span.tt-line-text")]);
    const chips = el("div.tt-chips");
    const caption = el("div.tt-caption", { role: "status", "aria-live": "polite" }, [text, line, chips]);

    // -- 手元の道具（右下）と、上の道具（右上）
    const dockButtons = Object.fromEntries(DOCK.map(item => [item.kind,
      el("button.tt-act", { type: "button", dataset: { test: `tetsuko-${item.kind}`, kind: item.kind }, onclick: () => press(item) }, [
        el("span.tt-act-token", { html: icon(item.icon) }), el("span.tt-act-label", { text: item.label }),
      ])]));
    const dock = el("nav.tt-dock", { "aria-label": "てつことのふれあい" }, Object.values(dockButtons));
    const tool_ = (id, label, ico, onclick) => el("button.tt-tool", { type: "button", dataset: { test: `tetsuko-${id}` }, onclick },
      [el("span.tt-tool-ico", { html: icon(ico) }), el("span.tt-tool-label", { text: label })]);
    const decorButton = tool_("decor", "もようがえ", "decor", () => openDecor());
    const bookButton = tool_("book", "てつこ手帳", "book", () => openBook());
    const photoButton = tool_("photo", "写真", "photo", () => snap());
    const backButton = tool_("time-back", "帰る", "back", () => leave());
    // 遊び方は画面に常に出さず、「？」を開いた時だけ見せる（#2717・ミニゲーム共通の方針）。
    const helpButton = el("button.tt-tool.tt-help-btn", { type: "button", dataset: { test: "tetsuko-help" }, "aria-label": HELP_TITLE, title: HELP_TITLE,
      onclick: () => openHelp() }, [el("span.tt-help-q", { "aria-hidden": "true", text: "？" })]);
    const tools = el("div.tt-tools", [helpButton, decorButton, bookButton, photoButton, backButton]);
    const drawer = el("div.tt-drawer", { hidden: true, dataset: { test: "tetsuko-decor-panel" } });
    const book = el("div.tt-book", { hidden: true, dataset: { test: "tetsuko-book-panel" }, role: "dialog", "aria-label": "てつこ手帳" });
    const help = el("div.tt-help", { hidden: true, dataset: { test: "tetsuko-help-panel" }, role: "dialog", "aria-label": HELP_TITLE });
    // 専用テーマの飾り（#2717）: 段ボールの外枠・左上の題・入った時に箱が開く演出。操作は止めない。
    const theme = tetsukoTheme({ el, title: TETSUKO_TIME.title, roman: TETSUKO_TIME.roman, reduced, SE });

    const host = el("section.tetsuko-time", {
      dataset: { test: "tetsuko-time-screen", stage: String(session.stage), mood: session.mood, tod, tool, reduced: String(reduced), ...artAttrs(),
        artBg: String(!!backdoor?.url), ...theme.attrs },
      "aria-label": TETSUKO_TIME.title,
    }, [yard, memo, tools, caption, dock, drawer, book, help, ...theme.nodes]);

    // -- 表示の更新
    const slotOf = id => SLOTS.find(slot => session.props[slot] === id) || null;
    function renderProps() {
      for (const slot of SLOTS) {
        const id = session.props[slot];
        const node = slots[slot];
        node.dataset.prop = id || "";
        node.classList.toggle("holding", !!id && session.cat.inside === id);
        if ((node.firstElementChild?.dataset.prop || "") === (id || "")) continue;
        node.replaceChildren(...(id ? [propNode(id)] : []));
      }
    }
    const propNode = id => el("span.tt-prop", { dataset: { prop: id }, "aria-hidden": "true" },
      [el("i.tt-prop-back"), el("i.tt-prop-front"), id === "tunnel" ? el("i.tt-prop-tail") : null]);
    function renderCat() {
      const c = session.cat;
      const at = c.inside && slotOf(c.inside) ? `slot-${slotOf(c.inside)}` : c.spot;
      // 居場所が変わる時は歩く（小さく弾む。しぐさの絵が届いていれば歩きの2枚を交互に）。
      if (lastAt && at !== lastAt && !reduced) {
        cat.dataset.walk = (SPOT_X[at] ?? 0) >= (SPOT_X[lastAt] ?? 0) ? "right" : "left";
        clearTimeout(walkTimer); clearInterval(stepFrames);
        if (hasPose("walk_a") && hasPose("walk_b")) stepFrames = setInterval(() => { walkFrame = walkFrame === "walk_a" ? "walk_b" : "walk_a"; renderPose(); }, 220);
        walkTimer = setTimeout(() => { delete cat.dataset.walk; clearInterval(stepFrames); walkFrame = "walk_a"; renderPose(); }, WALK_MS);
      }
      lastAt = at;
      Object.assign(cat.dataset, { at, spot: c.spot, pose: c.pose, face: c.face, flip: String(!!c.flip), inside: c.inside || "" });
      lap.classList.toggle("show", c.pose === "lap");
      renderPose();
      renderProps();
    }
    // しぐさの絵（届いた物だけ）。歩いている間は歩きの絵、届いていなければ表情の絵と CSS の姿勢。
    function renderPose() {
      const walking = !!cat.dataset.walk && hasPose(walkFrame);
      const art = walking ? walkFrame : session.cat.art;
      const src = hasPose(art) ? poseUrl(art) : null;
      cat.dataset.art = src ? art : "";
      pose.hidden = !src;
      if (src && pose.getAttribute("src") !== src) pose.src = src;
    }
    function renderButtons() {
      for (const item of DOCK) {
        const button = dockButtons[item.kind];
        const ok = canAct(session, item.kind);
        button.hidden = item.kind === "catch" && !toyOut(session);
        button.disabled = !ok || leaving || panel === "decor";
        button.classList.toggle("active", !!item.tool && item.tool === tool);
        button.querySelector(".tt-act-label").textContent = item.kind === "play" && tool === "toy" && toyOut(session) ? item.again : item.label;
        button.title = !ok && item.locked ? item.locked : "";
      }
      photoButton.disabled = !session.moment || leaving;
      photoButton.title = session.moment ? `今のしぐさ（${momentById(session.moment)?.name}）を写真に残す` : "しぐさが見えたら撮れる";
      decorButton.classList.toggle("new", session.newProps.length > 0);
      for (const button of [decorButton, bookButton, helpButton]) button.disabled = leaving;
      host.dataset.tool = tool;
      host.dataset.toy = held ? "held" : tool === "toy" ? "out" : "";
    }
    function fx(kind) {
      clearTimeout(fxTimer);
      host.dataset.fx = "";
      void host.offsetWidth; // 同じ演出を続けて出す時も最初から
      host.dataset.fx = kind || "";
      if (kind && !kind.startsWith("toy") && kind !== "treat") fxTimer = setTimeout(() => { if (host.dataset.fx === kind) host.dataset.fx = ""; }, 1800);
    }
    // 喉の音（なでて気を許している時・膝の上）。波の線と小さな音。
    function purrNow() {
      clearTimeout(purrTimer);
      host.dataset.purr = "1";
      SE.purr?.();
      purrTimer = setTimeout(() => { host.dataset.purr = ""; }, 1700);
    }
    function show(reaction) {
      if (!reaction || reaction.quiet) return;
      renderCat();
      text.textContent = reaction.text;
      if (reaction.line) {
        line.hidden = false;
        line.firstElementChild.textContent = name(reaction.line.speaker);
        line.lastElementChild.textContent = `「${reaction.line.text}」`;
      } else line.hidden = true;
      if (reaction.found) toast("found", reaction.found);
      fx(reaction.fx);
      if ((reaction.kind === "pet" && session.stage >= 2 && reaction.fx === "heart") || reaction.pose === "lap") purrNow();
      renderButtons();
      placeToy();
    }
    // 途中の様子（おやつの「匂いを確かめる→食べる」）を順に見せてから、反応の本体を出す。
    // 途中で別の操作をすれば、そちらの反応に切り替わる（待たせない）。
    function play(reaction) {
      clearTimeout(stepTimer);
      const steps = reaction?.steps || [];
      if (!steps.length) { show(reaction); return; }
      const final = { ...session.cat };
      let index = 0;
      const next = () => {
        if (done) return;
        if (index < steps.length) {
          const step = steps[index++];
          session.cat = { spot: step.spot, pose: step.pose, face: step.face, inside: null, flip: false, art: step.art || null };
          show({ ...step, found: null, line: null });
          quietUntil = Date.now() + AFTER_ACTION_MS + STEP_MS;
          stepTimer = setTimeout(next, reduced ? STEP_REDUCED_MS : STEP_MS);
        } else {
          session.cat = final;
          show(reaction);
        }
      };
      next();
    }

    // -- 見つけた・撮った時の小さな札（反応の帯の中）。数秒で消え、手帳に残る。
    function thumb(momentId) {
      const moment = momentById(momentId);
      const art = moment?.art && hasPose(moment.art) ? poseUrl(moment.art) : null;
      return el("span.tt-thumb", { dataset: { face: moment?.face || "normal", art: art ? "1" : "" } },
        [el("img", { src: art || faceSrc(moment?.face || "normal"), alt: "" })]);
    }
    function toast(kind, momentId) {
      const card = el("div.tt-toast", { dataset: { kind } }, [
        thumb(momentId),
        el("p", { dataset: { test: "tetsuko-note" } }, [
          el("small", { text: kind === "photo" ? "写真に残した" : "しぐさ図鑑に記録" }),
          el("b", { text: momentById(momentId)?.name || "" }),
        ]),
        kind === "found" ? el("i.tt-stamp", { "aria-hidden": "true" }) : null,
      ]);
      chips.replaceChildren(card);
      setTimeout(() => card.remove(), TOAST_MS);
      if (kind === "found") { bookButton.classList.remove("got"); void bookButton.offsetWidth; bookButton.classList.add("got"); }
    }
    // 撮った写真が、猫のところから手帳へ飛んでいく（動きを減らす設定では飛ばさない）。
    function flyToBook(momentId) {
      if (reduced) return;
      const c = catCenter();
      const card = el("span.tt-fly", { "aria-hidden": "true", style: { left: `${c.x}px`, top: `${c.y}px` } }, [thumb(momentId)]);
      host.append(card);
      requestAnimationFrame(() => card.classList.add("go"));
      setTimeout(() => card.remove(), 900);
    }

    // -- 操作
    function doAct(kind) {
      if (done || leaving) return null;
      const reaction = act(session, kind);
      if (!reaction) return null;
      SE.select?.();
      quietUntil = Date.now() + AFTER_ACTION_MS;
      play(reaction);
      // 捕まえたら（止める・5回目・置いて待つ）、じゃらしはしばらく猫の胸元にある。
      if (reaction.kind === "catch") holdToy();
      schedule();
      return reaction;
    }
    function press(item) {
      if (done || leaving || panel === "decor") return;
      if (item.tool) setTool(item.tool);
      if (item.kind === "play" && !toyTip) toyTip = toyHome();
      doAct(item.kind);
    }
    function setTool(next) {
      if (tool === next) return;
      tool = next;
      if (tool !== "toy") { toyTip = null; held = false; clearTimeout(stillTimer); clearTimeout(heldTimer); }
      renderButtons();
      placeToy();
    }

    // -- 猫じゃらし: 先は指・マウスの位置へ動く。動かすと振ったことになり、止めて猫の近くに置いておくと捕まえる。
    const stagePoint = event => {
      const rect = host.getBoundingClientRect();
      const k = rect.width / 1280 || 1;
      return { x: (event.clientX - rect.left) / k, y: (event.clientY - rect.top) / k };
    };
    const catCenter = () => ({ x: SPOT_X[cat.dataset.at] ?? 548, y: cat.dataset.at === "bench" || cat.dataset.at === "slot-bench" ? 330 : 440 });
    const toyHome = () => { const c = catCenter(); return { x: Math.min(1100, c.x + 150), y: c.y - 30 }; };
    function placeToy() {
      if (tool !== "toy") { toy.hidden = true; return; }
      toy.hidden = false;
      const tip = held ? { x: catCenter().x - 10, y: catCenter().y + 40 } : (toyTip ||= toyHome());
      const dx = tip.x - HAND_AT.x, dy = tip.y - HAND_AT.y;
      toy.style.setProperty("--tx", `${tip.x}px`);
      toy.style.setProperty("--ty", `${tip.y}px`);
      toyStick.style.width = `${Math.hypot(dx, dy)}px`;
      toyStick.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
    }
    function moveToy(point) {
      if (held) return;
      const next = { x: Math.max(60, Math.min(1220, point.x)), y: Math.max(130, Math.min(600, point.y)) };
      if (toyTip) toyTravel += Math.hypot(next.x - toyTip.x, next.y - toyTip.y);
      toyTip = next;
      placeToy();
      if (toyTravel >= TOY_SWING_PX && Date.now() - lastSwingAt >= TOY_SWING_GAP_MS) {
        toyTravel = 0; lastSwingAt = Date.now();
        doAct("play");
      }
      clearTimeout(stillTimer);
      stillTimer = setTimeout(() => {
        const c = catCenter();
        if (tool === "toy" && !held && toyOut(session) && toyTip && Math.hypot(toyTip.x - c.x, toyTip.y - c.y) <= TOY_CATCH_PX) doAct("catch");
      }, TOY_STILL_MS);
    }
    function holdToy() {
      held = true;
      toyTravel = 0;
      clearTimeout(stillTimer); clearTimeout(heldTimer);
      renderButtons(); placeToy();
      heldTimer = setTimeout(() => { held = false; toyTip = toyHome(); renderButtons(); placeToy(); }, TOY_HELD_MS);
    }
    yard.addEventListener("pointermove", event => {
      if (tool !== "toy" || panel || leaving) return;
      if (event.pointerType !== "mouse" && !(event.buttons & 1)) return;
      moveToy(stagePoint(event));
    });
    yard.addEventListener("pointerdown", event => { if (tool === "toy" && !panel && !leaving) moveToy(stagePoint(event)); });

    // -- 猫を直接: なでる手ならタップ／ゆっくりなぞる＝なでる。ブラシなら、なぞる＝ブラシ。じゃらしの時は猫を押しても振らない。
    cat.addEventListener("pointerdown", event => { stroke = { x: event.clientX, y: event.clientY, dist: 0, done: false }; });
    cat.addEventListener("pointermove", event => {
      if (!stroke || !(event.buttons & 1) || panel) return;
      stroke.dist += Math.hypot(event.clientX - stroke.x, event.clientY - stroke.y);
      stroke.x = event.clientX; stroke.y = event.clientY;
      if (tool === "hand" && stroke.dist >= STROKE_PX && Date.now() - lastPetAt >= STROKE_GAP_MS) { stroke.dist = 0; stroke.done = true; lastPetAt = Date.now(); doAct("pet"); }
      if (tool === "brush" && stroke.dist >= BRUSH_PX && Date.now() - lastBrushAt >= BRUSH_GAP_MS) { stroke.dist = 0; stroke.done = true; lastBrushAt = Date.now(); doAct("brush"); }
    });
    cat.addEventListener("pointercancel", () => { stroke = null; });
    cat.addEventListener("click", () => {
      const stroked = stroke?.done;
      stroke = null;
      if (stroked || panel === "decor" || tool === "toy") return;
      if (tool === "brush") { lastBrushAt = Date.now(); doAct("brush"); return; }
      lastPetAt = Date.now();
      doAct("pet");
    });

    // -- 自律行動（画面を開いている間だけ。閉じている間は進めない）
    function schedule() {
      clearTimeout(timer);
      if (done) return;
      timer = setTimeout(tick, autoDelay(session, { reduced }));
    }
    function tick() {
      if (done) return;
      // LOAD などで画面が差し替わったら、ここで閉じる（確定しない）。
      if (host.isConnected) mounted = true;
      if (!isCurrent() || (mounted && !host.isConnected)) { finish(true); return; }
      if (leaving || panel === "book" || panel === "help" || held || Date.now() < quietUntil || document.hidden) { schedule(); return; }
      const reaction = autonomous(session);
      if (!reaction.quiet) show(reaction);
      schedule();
    }

    // -- 写真（今見えているしぐさだけ。シャッターの光と、手帳へ飛ぶ小さな写真）
    function snap() {
      if (done || leaving || !session.moment) return;
      const id = session.moment;
      if (!takePhoto(session)) return;
      (SE.shutter || SE.click)?.();
      clearTimeout(flashTimer);
      host.dataset.flash = "";
      void host.offsetWidth;
      host.dataset.flash = "1";
      flashTimer = setTimeout(() => { host.dataset.flash = ""; }, 700);
      toast("photo", id);
      flyToBook(id);
    }

    // -- もようがえ: 道具箱から物を選び、光った場所をタップして置く。置いた物をタップすると片付ける。
    function openDecor() {
      if (done || leaving) return;
      SE.click?.();
      closePanelQuietly();
      panel = "decor"; host.dataset.panel = "decor";
      fresh = [...session.newProps];
      session.newProps = [];
      selected = null;
      setTool("hand");
      renderDrawer(); renderSlots(); renderButtons();
    }
    function renderDrawer() {
      const items = PROPS.filter(item => propUnlocked(item, session.stage, session.metMashiro));
      drawer.hidden = false;
      drawer.replaceChildren(
        el("div.tt-drawer-head", [el("b", { text: "もようがえ" })]),
        el("div.tt-drawer-items", items.map(item => {
          const at = slotOf(item.id);
          return el("button.tt-item", { type: "button", dataset: { prop: item.id, test: `tetsuko-item-${item.id}` }, "aria-pressed": String(selected === item.id),
            title: item.from, onclick: () => { SE.click?.(); selected = selected === item.id ? null : item.id; renderDrawer(); renderSlots(); } }, [
            el("span.tt-item-pic", [propNode(item.id)]),
            el("b", { text: item.name }),
            at ? el("small.tt-item-at", { text: SLOT_NAMES[at] }) : null,
            fresh.includes(item.id) ? el("i.tt-new", { text: "新" }) : null,
          ]);
        })),
        el("button.btn.small.tt-drawer-close", { type: "button", text: "おわる", dataset: { test: "tetsuko-panel-close" }, onclick: () => { SE.cancel?.(); closePanel(); } }),
      );
    }
    function renderSlots() {
      for (const slot of SLOTS) {
        const hit = slotHits[slot];
        hit.hidden = panel !== "decor";
        const allowed = !!selected && propById(selected).slots.includes(slot);
        hit.dataset.allowed = String(allowed);
        hit.dataset.filled = String(!!session.props[slot]);
        hit.disabled = !allowed && !session.props[slot];
      }
    }
    function pickSlot(slot) {
      if (panel !== "decor") return;
      const ok = selected ? placeProp(session, slot, selected) : !!session.props[slot] && placeProp(session, slot, null);
      if (!ok) return;
      SE.click?.();
      selected = null;
      renderCat(); renderDrawer(); renderSlots();
    }

    // -- てつこ手帳: 左に12のしぐさ、右に選んだしぐさ（写真・てつこメモ）。
    function openBook(focus = null) {
      if (done || leaving) return;
      SE.click?.();
      closePanelQuietly();
      panel = "book"; host.dataset.panel = "book";
      bookSel = focus || session.newFound.at(-1) || session.found.at(-1) || MOMENTS[0].id;
      renderBook(); renderButtons();
    }
    function renderBook() {
      const count = session.found.length;
      const cards = MOMENTS.map((moment, index) => {
        const found = session.found.includes(moment.id);
        const photo = session.album.find(entry => entry.moment === moment.id);
        return el("button.tt-card", { type: "button", dataset: { found: String(found), photo: String(!!photo), test: `tetsuko-book-${moment.id}` },
          "aria-pressed": String(bookSel === moment.id), onclick: () => { SE.click?.(); bookSel = moment.id; renderBook(); } }, [
          el("span.tt-card-no", { text: String(index + 1).padStart(2, "0") }),
          found ? thumb(moment.id) : el("span.tt-thumb.unknown", { text: "？" }),
          el("b", { text: found ? moment.name : "？？？" }),
          found ? el("i.tt-stamp", { "aria-hidden": "true" }) : null,
        ]);
      });
      const pick = momentById(bookSel) || MOMENTS[0];
      const known = session.found.includes(pick.id);
      const photo = session.album.find(entry => entry.moment === pick.id);
      const detail = el("div.tt-detail", [
        el("div.tt-polaroid", { dataset: { photo: String(!!photo), known: String(known) } }, [
          el("i.tt-tape"), known ? thumb(pick.id) : el("span.tt-thumb.unknown", { text: "？" }),
          el("small", { text: photo ? dayLabel(photo.day) || "写真" : known ? "写真はまだ" : "" }),
        ]),
        el("h4", { text: known ? pick.name : "まだ見つけていない" }),
        el("p.tt-detail-memo", { text: known ? pick.memo : pick.hint }),
      ]);
      book.hidden = false;
      book.replaceChildren(el("div.tt-book-spread", [
        el("div.tt-page.left", [el("h3", { text: "てつこ手帳" }), el("p.tt-book-count", { text: `見つけたしぐさ　${count} / ${MOMENTS.length}` }),
          el("div.tt-cards", cards)]),
        el("div.tt-page.right", [detail]),
      ]), el("button.btn.small.tt-book-close", { type: "button", text: "閉じる", dataset: { test: "tetsuko-panel-close" }, onclick: () => { SE.cancel?.(); closePanel(); } }));
    }
    // -- あそびかた（「？」）: 開いている間は自律行動を止める。Esc・閉じるで戻る。
    function openHelp() {
      if (done || leaving) return;
      SE.click?.();
      closePanelQuietly();
      panel = "help"; host.dataset.panel = "help";
      help.hidden = false;
      help.replaceChildren(helpCard({ el, icon, mood: moodLabel(moodOf(session.day), session.stage), onClose: () => { SE.cancel?.(); closePanel(); } }));
      renderButtons();
    }
    function closePanelQuietly() {
      panel = null; host.dataset.panel = ""; selected = null;
      drawer.hidden = true; drawer.replaceChildren();
      book.hidden = true; book.replaceChildren();
      help.hidden = true; help.replaceChildren();
      renderSlots();
    }
    function closePanel() { closePanelQuietly(); renderButtons(); schedule(); }
    const onKey = event => { if (event.key === "Escape" && panel) { event.preventDefault(); closePanel(); } };

    // -- 帰る（いつでも押せる。気を許した段階で、ふれあいの後なら戸の前まで見送ってくれる）
    function leave() {
      if (done || leaving) return;
      SE.select?.();
      const bye = farewell(session);
      if (!bye) { finish(); return; }
      leaving = true;
      clearTimeout(stepTimer);
      closePanelQuietly();
      setTool("hand");
      show(bye);
      backButton.disabled = true;
      setTimeout(finish, reduced ? FAREWELL_REDUCED_MS : FAREWELL_MS);
    }
    function finish(aborted = false) {
      if (done) return;
      done = true;
      for (const t of [timer, stepTimer, fxTimer, purrTimer, walkTimer, stillTimer, heldTimer, flashTimer]) clearTimeout(t);
      clearInterval(stepFrames);
      theme.stop();
      window.removeEventListener("pagehide", abort);
      window.removeEventListener("keydown", onKey);
      signal?.removeEventListener?.("abort", abort);
      if (layers.screen?.firstElementChild === host) showScreen("none", null);
      if (audio.currentBgm() === "bgm_tetsuko_time") audio.playBgm(bgmBefore);
      resolve(aborted || !isCurrent() ? idle : sessionResult(session));
    }
    const abort = () => finish(true);

    window.addEventListener("pagehide", abort, { once: true });
    window.addEventListener("keydown", onKey);
    signal?.addEventListener?.("abort", abort, { once: true });
    // 開いた時の居場所・表情を先に決めてから出す（ベンチから滑ってこない）。
    show(openingReaction(session));
    showScreen("tetsuko-time", host);
    theme.start(host);
    audio.playBgm("bgm_tetsuko_time");
    schedule();
  });
}
