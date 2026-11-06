// 「てつこといっしょ / TETSUKO TIME」（#2454）の画面と本編との確定点。猫の状態・反応・自律行動は tetsuko-model.js。
//
// 動線（オーナー判断 2026-11-04・実装計画 §1）: mukai で行動を使う → 帰りに裏口をのぞく（ch3-tokyo-daily.js の
// offerTetsuko）→「てつこといっしょ」→ 来訪4回未満なら既存の段階会話を先に読む（関係進展の正本）→ この画面 →
// 「帰る」→ settleTetsukoTime で確定 → 呼び出し側が回復12と toast。地図のピンは作らない。第5章の入口は今回触らない。
//
// 画面（計画 §5）: #stage（1280×720）の #screen 層に重ねる。背景は既存の裏口（bg_street）、HUD はそのまま。
// 猫は既存の5表情の絵を、どの表情でも同じ枠で切り出して大きく見せる（表情を変えても位置が飛ばない）。
// 姿勢は CSS の小さな動き（低く構える・前足・箱の中・膝の上）で付け、新しい絵は使わない。小物は CSS で描く（文字を焼き込まない）。
// 操作はボタン・猫のタップ・猫の上をゆっくりなぞる、のどれでも同じ結果。筆圧・精度・時間制限は求めない。
// 「帰る」は膝に乗られている時も含めて、いつでも押せる。
//
// 正式なふれあい用の動作ポーズ素材は Codex 向けの別依頼（Issue #2454 §11 / asset_sources/tetsuko-care/）。
// 設計・コード担当は別個体の猫や未承認の素材を生成・採用しない。
//
// DOM 依存（ui.js / util.js / audio.js / data.js）は openTetsukoTime の中で遅延 import する。
// 本ファイルの top-level（確定点）は DOM 非依存で、Node のテストからそのまま import できる。
import { TOKYO_OUTINGS } from "../chapters/ch3-outing-progress.js";
import {
  OUTINGS_FLAG, TETSUKO_TIME_FLAG, readTetsukoRecord, tetsukoVisits, createSession, openingReaction, act, canAct, toyOut,
  autonomous, autoDelay, placeProp, takePhoto, farewell, sessionResult, moodOf, moodLabel, propById, momentById, propUnlocked,
  MOMENTS, PROPS, SLOTS, SLOT_NAMES,
} from "./tetsuko-model.js";

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
// 主操作（下段）。止めるは、じゃらしを振っている間だけ出る。
const ACTION_BUTTONS = Object.freeze([
  { kind: "pet", label: "なでる" },
  { kind: "play", label: "あそぶ", again: "もう一度振る" },
  { kind: "catch", label: "止める" },
  { kind: "brush", label: "ブラシ", locked: "ブラシ（まだ早い）" },
  { kind: "treat", label: "おやつ", locked: "今日はもうあげた" },
  { kind: "watch", label: "そっと見守る" },
]);
const STEP_MS = 1000, STEP_REDUCED_MS = 700, FAREWELL_MS = 1400, FAREWELL_REDUCED_MS = 800, AFTER_ACTION_MS = 1600;
const STROKE_PX = 90, STROKE_GAP_MS = 600;

/**
 * 「てつこといっしょ」の画面を開く（#2454 §10-2）。「帰る」か中断で閉じ、確定に渡す結果を返す。
 * 保存はここでは書かない（確定は呼び出し側が settleTetsukoTime で同じ処理の中に行う）。
 * @param {object} ctx
 * @param {object} ctx.value 現在のセーブ（読むだけ）
 * @param {string} [ctx.visitKey] 親の mukai 訪問の訪問キー（tetsukoVisitKey）
 * @param {string} [ctx.bg] 背景の URL（裏口）。段階会話を読まずに来た時に出す
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
  if (bg) await ui.setBg(bg, { instant: true });
  if (signal?.aborted || !isCurrent()) return idle;
  const { layers, showScreen } = ui;
  const SE = audio.SE || {};
  const reduced = !!kit.reducedMotion?.();
  const session = createSession(value, { visitKey });
  const name = id => data.displayName?.(id, value) || (id === "mukai_master" ? "ムカイさん" : id);

  return await new Promise(resolve => {
    let done = false, leaving = false, mounted = false, timer = 0, stepTimer = 0, fxTimer = 0, quietUntil = 0, panel = null, lastPetAt = 0, stroke = null;

    // -- 猫（5表情を重ねて置き、表情は data-face で切り替える。読み込みのちらつきを出さない）
    const imgs = FACES.map(face => el("img.tt-cat-img", { src: data.portraitInfo?.("tetsuko", face)?.src || "", alt: "", draggable: "false",
      dataset: { face }, decoding: "async" }));
    const cat = el("button.tt-cat", { type: "button", "aria-label": "てつこをなでる", dataset: { test: "tetsuko-cat" } }, [
      el("span.tt-cat-shadow"), el("span.tt-cat-frame", imgs), el("span.tt-fx", { "aria-hidden": "true" }),
    ]);
    const toy = el("span.tt-toy", { "aria-hidden": "true" }, [el("i.tt-toy-stick"), el("i.tt-toy-tip")]);
    const plate = el("span.tt-plate", { "aria-hidden": "true" });
    const lap = el("span.tt-lap", { "aria-hidden": "true" });
    const slots = Object.fromEntries(SLOTS.map(slot => [slot, el("div.tt-slot", { dataset: { slot } })]));
    const yard = el("div.tt-yard", [
      el("div.tt-wall", [el("div.tt-door", [el("i.tt-door-window"), el("i.tt-door-knob")]), el("i.tt-lamp")]),
      el("div.tt-ground"),
      el("div.tt-bench", [el("i.tt-bench-seat"), el("i.tt-bench-leg.l"), el("i.tt-bench-leg.r")]),
      ...Object.values(slots), lap, plate, cat, toy,
    ]);

    // -- 文字（状態の一行・反応の一行・人物の一言・図鑑の記録）
    const mood = el("p.tt-mood", { dataset: { test: "tetsuko-mood" }, text: moodLabel(moodOf(session.day), session.stage) });
    const text = el("p.tt-text", { dataset: { test: "tetsuko-caption" } });
    const line = el("p.tt-line", { hidden: true }, [el("b.tt-line-name"), el("span.tt-line-text")]);
    const note = el("p.tt-note", { hidden: true, dataset: { test: "tetsuko-note" } });
    const caption = el("div.tt-caption", { role: "status", "aria-live": "polite" }, [text, line, note]);

    // -- 操作
    const actionButtons = Object.fromEntries(ACTION_BUTTONS.map(item => [item.kind,
      el("button.btn.tt-act", { type: "button", text: item.label, dataset: { test: `tetsuko-${item.kind}`, kind: item.kind },
        onclick: () => doAct(item.kind) })]));
    const actions = el("nav.tt-actions", { "aria-label": "てつことのふれあい" }, Object.values(actionButtons));
    const tool = (id, label, onclick) => el("button.btn.ghost.small.tt-tool", { type: "button", text: label, dataset: { test: `tetsuko-${id}` }, onclick });
    const decorButton = tool("decor", "もようがえ", () => openPanel("decor"));
    const bookButton = tool("book", "しぐさ図鑑", () => openPanel("book"));
    const photoButton = tool("photo", "写真", () => snap());
    const backButton = el("button.btn.small.tt-back", { type: "button", text: "帰る", dataset: { test: "tetsuko-time-back" }, onclick: () => leave() });
    const tools = el("div.tt-tools", [decorButton, bookButton, photoButton, backButton]);
    const title = el("div.tt-title", [el("b", { text: TETSUKO_TIME.title }), el("small", { text: TETSUKO_TIME.roman })]);
    const panelHost = el("div.tt-panel-host");

    const host = el("section.tetsuko-time", {
      dataset: { test: "tetsuko-time-screen", stage: String(session.stage), mood: session.mood, tod: value.slot >= 1 ? "night" : "day",
        reduced: String(reduced) },
      "aria-label": TETSUKO_TIME.title,
    }, [yard, el("header.tt-top", [title, mood]), tools, caption, actions, panelHost]);

    // -- 表示の更新
    function renderProps() {
      for (const slot of SLOTS) {
        const id = session.props[slot];
        const node = slots[slot];
        node.dataset.prop = id || "";
        node.classList.toggle("holding", !!id && session.cat.inside === id);
        if ((node.firstElementChild?.dataset.prop || "") === (id || "")) continue;
        node.replaceChildren(...(id ? [el("span.tt-prop", { dataset: { prop: id }, "aria-hidden": "true" },
          [el("i.tt-prop-back"), el("i.tt-prop-front"), id === "tunnel" ? el("i.tt-prop-tail") : null])] : []));
      }
    }
    function renderCat() {
      const c = session.cat;
      Object.assign(cat.dataset, { spot: c.spot, pose: c.pose, face: c.face, flip: String(!!c.flip), inside: c.inside || "" });
      // 小物のところにいる時は、その小物の枠の位置（slot-bench など）。
      const at = c.inside && slotOf(c.inside);
      cat.dataset.at = at ? `slot-${at}` : c.spot;
      lap.classList.toggle("show", c.pose === "lap");
      renderProps();
    }
    const slotOf = id => SLOTS.find(slot => session.props[slot] === id) || null;
    function renderButtons() {
      for (const item of ACTION_BUTTONS) {
        const button = actionButtons[item.kind];
        const ok = canAct(session, item.kind);
        button.hidden = item.kind === "catch" && !toyOut(session);
        button.disabled = !ok || leaving;
        button.textContent = !ok && item.locked ? item.locked : item.kind === "play" && toyOut(session) ? item.again : item.label;
      }
      photoButton.disabled = !session.moment || leaving;
      photoButton.title = session.moment ? `今のしぐさ（${momentById(session.moment)?.name}）を写真に残す` : "しぐさが見えたら撮れる";
      decorButton.classList.toggle("new", session.newProps.length > 0);
      for (const button of [decorButton, bookButton]) button.disabled = leaving;
    }
    function fx(kind) {
      clearTimeout(fxTimer);
      host.dataset.fx = "";
      void host.offsetWidth; // 同じ演出を続けて出す時も最初から
      host.dataset.fx = kind || "";
      if (kind && !kind.startsWith("toy") && kind !== "treat") fxTimer = setTimeout(() => { if (host.dataset.fx === kind) host.dataset.fx = ""; }, 1800);
    }
    function show(reaction, { keepNote = false } = {}) {
      if (!reaction || reaction.quiet) return;
      renderCat();
      text.textContent = reaction.text;
      if (reaction.line) {
        line.hidden = false;
        line.firstElementChild.textContent = name(reaction.line.speaker);
        line.lastElementChild.textContent = `「${reaction.line.text}」`;
      } else line.hidden = true;
      if (reaction.found) {
        note.hidden = false;
        note.textContent = `しぐさ図鑑に記録した：${momentById(reaction.found)?.name}`;
      } else if (!keepNote) note.hidden = true;
      fx(reaction.fx);
      host.dataset.toy = toyOut(session) ? "out" : reaction.fx === "toy-held" ? "held" : "";
      renderButtons();
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
          session.cat = { spot: step.spot, pose: step.pose, face: step.face, inside: null, flip: false };
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

    // -- 主操作
    function doAct(kind) {
      if (done || leaving) return;
      const reaction = act(session, kind);
      if (!reaction) return;
      SE.select?.();
      quietUntil = Date.now() + AFTER_ACTION_MS;
      play(reaction);
      schedule();
    }
    // 猫をタップ＝なでる。押したまま猫の上をゆっくり動かしても、同じ「なでる」（筆圧・精度は見ない）。
    cat.addEventListener("pointerdown", event => { stroke = { x: event.clientX, y: event.clientY, dist: 0, petted: false }; });
    cat.addEventListener("pointermove", event => {
      if (!stroke || !(event.buttons & 1)) return;
      stroke.dist += Math.hypot(event.clientX - stroke.x, event.clientY - stroke.y);
      stroke.x = event.clientX; stroke.y = event.clientY;
      if (stroke.dist >= STROKE_PX && Date.now() - lastPetAt >= STROKE_GAP_MS) { stroke.dist = 0; stroke.petted = true; lastPetAt = Date.now(); doAct("pet"); }
    });
    cat.addEventListener("pointercancel", () => { stroke = null; });
    cat.addEventListener("click", () => {
      const stroked = stroke?.petted;
      stroke = null;
      if (stroked) return;
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
      if (leaving || panel === "book" || Date.now() < quietUntil || document.hidden) { schedule(); return; }
      const reaction = autonomous(session);
      if (!reaction.quiet) show(reaction);
      schedule();
    }

    // -- 写真・もようがえ・図鑑
    function snap() {
      if (done || leaving || !session.moment) return;
      const name = momentById(session.moment)?.name;
      if (!takePhoto(session)) return;
      SE.click?.();
      host.dataset.flash = "";
      void host.offsetWidth;
      host.dataset.flash = "1";
      note.hidden = false;
      note.textContent = `写真に残した：${name}`;
    }
    function openPanel(kind) {
      if (done || leaving) return;
      SE.click?.();
      panel = kind;
      host.dataset.panel = kind;
      if (kind === "decor") session.newProps = [];
      renderPanel();
      renderButtons();
    }
    function closePanel() {
      panel = null;
      host.dataset.panel = "";
      panelHost.replaceChildren();
      renderButtons();
      schedule();
    }
    function renderPanel() {
      if (!panel) return;
      const close = el("button.btn.ghost.small.tt-panel-close", { type: "button", text: "閉じる", dataset: { test: "tetsuko-panel-close" },
        onclick: () => { SE.cancel?.(); closePanel(); } });
      if (panel === "decor") {
        const rows = SLOTS.map(slot => {
          const choices = [null, ...PROPS.filter(item => item.slots.includes(slot) && propUnlocked(item, session.stage, session.metMashiro)).map(item => item.id)];
          return el("div.tt-decor-row", [el("b", { text: SLOT_NAMES[slot] }), el("div.tt-decor-choices", choices.map(pid => {
            const item = pid ? propById(pid) : null;
            return el("button.btn.ghost.small.tt-decor-choice", { type: "button", text: item ? item.name : "なし",
              title: item ? item.from : "片付ける", dataset: { test: `tetsuko-decor-${slot}-${pid || "none"}` },
              "aria-pressed": String(session.props[slot] === pid),
              onclick: () => { if (placeProp(session, slot, pid)) { SE.click?.(); renderCat(); renderPanel(); } } });
          }))]);
        });
        panelHost.replaceChildren(el("div.tt-panel.tt-decor", { dataset: { test: "tetsuko-decor-panel" } }, [
          el("h3", { text: "もようがえ" }), el("p.tt-panel-lead", { text: "置いた物を、てつこが気まぐれに使う。" }), ...rows, close]));
        return;
      }
      const cards = MOMENTS.map((moment, index) => {
        const found = session.found.includes(moment.id);
        const photo = session.album.find(entry => entry.moment === moment.id);
        return el("div.tt-card", { dataset: { found: String(found), photo: String(!!photo), test: `tetsuko-book-${moment.id}` } }, [
          el("span.tt-card-no", { text: String(index + 1).padStart(2, "0") }),
          found ? el("span.tt-card-pic", { dataset: { face: moment.face } }, [el("img", { src: data.portraitInfo?.("tetsuko", moment.face)?.src || "", alt: "" })]) : el("span.tt-card-pic.unknown", { text: "？" }),
          el("b", { text: found ? moment.name : "？？？" }),
          el("small", { text: found ? (photo ? "写真あり" : "") : moment.hint }),
        ]);
      });
      const count = session.found.length;
      panelHost.replaceChildren(el("div.tt-panel.tt-book", { dataset: { test: "tetsuko-book-panel" } }, [
        el("h3", { text: `しぐさ図鑑　${count} / ${MOMENTS.length}` }), el("div.tt-cards", cards), close]));
    }

    // -- 帰る（いつでも押せる。気を許した段階で、ふれあいの後なら戸の前まで見送ってくれる）
    function leave() {
      if (done || leaving) return;
      SE.select?.();
      const bye = farewell(session);
      if (!bye) { finish(); return; }
      leaving = true;
      clearTimeout(stepTimer);
      closePanelQuietly();
      show(bye);
      backButton.disabled = true;
      setTimeout(finish, reduced ? FAREWELL_REDUCED_MS : FAREWELL_MS);
    }
    function closePanelQuietly() { panel = null; host.dataset.panel = ""; panelHost.replaceChildren(); }
    function finish(aborted = false) {
      if (done) return;
      done = true;
      clearTimeout(timer); clearTimeout(stepTimer); clearTimeout(fxTimer);
      window.removeEventListener("pagehide", abort);
      signal?.removeEventListener?.("abort", abort);
      if (layers.screen?.firstElementChild === host) showScreen("none", null);
      resolve(aborted || !isCurrent() ? idle : sessionResult(session));
    }
    const abort = () => finish(true);

    window.addEventListener("pagehide", abort, { once: true });
    signal?.addEventListener?.("abort", abort, { once: true });
    // 開いた時の居場所・表情を先に決めてから出す（ベンチから滑ってこない）。
    show(openingReaction(session));
    showScreen("tetsuko-time", host);
    schedule();
  });
}
