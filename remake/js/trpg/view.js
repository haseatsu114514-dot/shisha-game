import { el } from "../core/util.js";
import { TrpgSession, HEAT, heatTier, DICE, STATS, PLAYER_SEAT, approachesOf, approachBase, buildPc, randomPc, grownStats, phasesOf, checkKindsOf, rewardKindOf, nearMissOf } from "./session.js";
import { displayName, portraitUrl, portraitAx, portraitHeadTop, portraitTop as topFor, sceneUrl } from "./presentation.js";
import { costumeUrl } from "./costumes.js";
import { faceIconStyle } from "./face-crops.js";
import { createTrpgAudio } from "./audio.js";
import { checkForecast, rerollOdds, rollOdds } from "./feedback.js";
import { playTrpgEntrance } from "./entrance.js";
import { playIncarnation, playSceneCard, playResultCut, playClueCard, impact } from "./stage-fx.js";

// 調べる場所の印の半径（見える輪。スマホでは押せる範囲が広いが、輪は同じ大きさ）。ワイドでの上下の切り方に使う
const ROOM_SPOT_REACH = 28;
const LABELS = { success: "うまくいった", mixed: "ひと手間かかる", trouble: "思わぬ出来事" };
// じっくり調べる（TRF14）の結果は短い札に出すので、評価の言葉も短く。
const SEARCH_LABELS = { success: "成功！", mixed: "ひと手間", trouble: "空振り" };
const SPECIALS = { critical: "クリティカル！", fumble: "ファンブル……", double: "ゾロ目！" };
// 判定に賭けるもの（TRF02）: 成功すると何がもらえるかを、振る前にGMの裁定として見せる。
// 卓の上は短い札だけ（TRF07）。文の説明は「？」とチュートリアル、読み上げ・マウスを乗せた時の説明に置く。
const STAKES = {
  question: { stake: "質問 ＋1", long: "成功すると、聞き込みで聞けることが1つ増える" },
  hint: { stake: "GMのヒント", long: "成功すると、次の選択で合わない選択肢にGMが印をつける" },
  finale: { stake: "会心の印", long: "成功すると、結末に「会心のクライマックス」の印がつく" },
};
const STAR_MARKS = [["insight", "見立てが的中", ""], ["plan", "提案が届いた", "物語の本来の結末にたどり着いた"], ["dice", "サイコロが味方", "判定で2回以上うまくいった"]];
const ICONS = {
  sound: '<path d="M4 9v6h4l5 4V5L8 9H4Zm13-1a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  log: '<path d="M4 4h16v12H9l-5 4V4Zm4 4h8m-8 4h5"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4m0 3v.2"/>',
  exit: '<path d="m10 5-7 7 7 7m-7-7h18"/>',
  notes: '<path d="M6 3h13v18H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm2 0v18m3-13h5m-5 4h5"/>',
  sheet: '<path d="M5 3h14v18H5zM8 7h8M8 11h8M8 15h5"/><circle cx="16.5" cy="16.5" r="1.5"/>',
};

/** Mounts one isolated session; finished resolves only after the player leaves the table. */
export function mountTrpg(host, { scenario, characters, manifest, tableTalk = null, tutorialLines = null, tutorial = false, onTutorialDone = () => {},
  seed, profileId = null, pc = null, companions = {}, closeLabel = "卓を片付ける", audio: providedAudio = null, allowReplay = true, onComplete = () => {},
  warmStart = false, resume = null, onBookmark = null, costumeFrames = null, growth = 0 }) {
  // しおり（TMX13）: the table is the seed plus the order of what was pressed. Every action is recorded, the caller keeps
  // the list at each resting point, and a later visit replays it to land on the same scene (dice included).
  const RECORDED = ["start", "ask", "endInterview", "inspect", "consult", "search", "interpret", "plan", "beginCheck", "reroll", "settleCheck"];
  let pressed = [];
  function recording(target) {
    for (const key of RECORDED) {
      const original = target[key].bind(target);
      target[key] = (...args) => { const out = original(...args); pressed.push([key, ...JSON.parse(JSON.stringify(args))]); return out; };
    }
    return target;
  }
  // The player's character can be rebuilt on the cover; the session restarts from the same seed until the story begins.
  let build = pc, session = recording(new TrpgSession(scenario, { seed, profileId, pc: build, companions, warmStart, growth }));
  let resumed = false;
  if (Array.isArray(resume?.actions) && resume.actions.length) {
    try {
      for (const [key, ...args] of resume.actions) {
        if (!RECORDED.includes(key)) throw new Error("Unknown bookmarked action");
        session[key](...args);
      }
      const at = session.snapshot();
      if (at.phase === "cover" || at.phase === "ending" || at.pending) throw new Error("Bookmark is not a resting point");
      resumed = true;
    } catch {
      // A bookmark from an older version of the story: start again from the cover rather than guess.
      pressed = []; session = recording(new TrpgSession(scenario, { seed, profileId, pc: build, companions, warmStart, growth }));
    }
  }
  const cast = Object.fromEntries(scenario.cast.map(c => [c.id, c]));
  const gm = scenario.cast.find(c => c.part === "GM").id;
  const presentation = scenario.presentation;
  // Character sheets are keyed by the authored seat; a substitute player keeps the same PC.
  let sheets = session.sheets;
  const seatOf = id => cast[id]?.seat || id;
  const pcOf = id => sheets[seatOf(id)] || null;
  const statLabel = key => presentation.stats?.[key] || key;
  // Seats nobody filled tonight: the GM voices those PCs.
  const npcSeats = Object.keys(sheets).filter(seat => !scenario.cast.some(c => seatOf(c.id) === seat));
  // A PC always wears the face of whoever plays it (#3050): the player's own portrait, never a role or look picture.
  function pcFace(seat, playerId) {
    return el("img", { src: portrait(playerId), alt: "", style: circleStyle(playerId, 150, 6) });
  }
  // The role costume (same person, dressed as the PC) where we have one: sheets, cover, origins and declaration cards (TMX04).
  // "bust" zooms on the upper body for small cards; "full" shows the whole figure. Falls back to the round face.
  // Bust framing shared by every costume card: cheek-to-cheek width as a share of the box width, eye line as a share of its height.
  const BUST = { face: 0.26, eye: 0.36 };
  // 頬の幅の測定に、頬へかかる青い髪まで入ってしまう2人（全身の絵と見比べて決めた補正・2026-11-11）。
  const FACE_FIX = { samechan: 0.86, rei: 0.8 };
  function pcFigure(seat, playerId, { role = sheets[seat]?.archetype || sheets[seat]?.option || null, shape = "bust" } = {}) {
    const url = costumeUrl(scenario.id, playerId, role);
    if (!url) return pcFace(seat, playerId);
    if (shape !== "bust") return el("span.trpg-costume", { dataset: { shape }, style: { backgroundImage: `url("${url}")` } });
    // Every bust shows the same face size at the same eye line (オーナー 2026-11-11「みんな同じぐらいのバストアップに」):
    // the measured cheek width and eye line of each costume picture (img/ui/trpg/costumes/frames.json) set the zoom and the offset.
    const face = costumeFrames?.[scenario.id + "/" + playerId + "/" + role]?.face;
    if (face?.w > 0) {
      const [W, H] = [896, 1200], width = BUST.face * W / (face.w * (FACE_FIX[playerId] || 1)) * 100;
      return el("span.trpg-costume", { dataset: { shape, framed: "face" } }, el("i", { style: { backgroundImage: `url("${url}")`,
        width: width + "%", top: BUST.eye * 100 + "%", transform: `translate(-${face.cx / W * 100}%, -${face.eye_y / H * 100}%)` } }));
    }
    // Without measurements: line up the head top from the standing-portrait metrics.
    const lift = Math.max(0, portraitHeadTop(manifest, playerId) - 0.03) * 100, ax = portraitAx(manifest, playerId) * 100;
    return el("span.trpg-costume", { dataset: { shape } }, el("i", { style: { backgroundImage: `url("${url}")`, transform: `translate(-${ax}%, -${lift}%)` } }));
  }
  const hasFigure = (seat, playerId, role = sheets[seat]?.archetype || sheets[seat]?.option || null) => !!costumeUrl(scenario.id, playerId, role);
  /** Authored text names the player's character with {pc}; the built name fills it in. */
  // {pc} is the player's character, {pc:seat} a companion's, {pcTitle} the player's origin and {gm} tonight's GM.
  const pcText = text => String(text ?? "").replace(/\{pc:([a-z]+)\}/g, (_, seat) => sheets[seat]?.name || "")
    .replace(/\{pc\}/g, sheets[PLAYER_SEAT]?.name || "").replace(/\{pcTitle\}/g, sheets[PLAYER_SEAT]?.title || "")
    .replace(/\{gm\}/g, name(gm));
  const PHASES = phasesOf(scenario), CHECKS = checkKindsOf(scenario);
  // A scenario with limited investigation spends "危機" (pressure): show it wherever the plan is weighed.
  const RISK = presentation.riskLabel || "危機";
  // Illustrated choices come from a tile atlas; a field without a row (or a scenario without art yet) uses text cards.
  const atlas = presentation.choiceArt || null;
  if (atlas) { const warm = new Image(); warm.src = new URL(atlas.src, import.meta.url).href; warm.decode().catch(() => {}); }
  const tileStyle = (row, column) => atlas && Number.isInteger(row)
    ? { "--tile-x": column * 50 + "%", "--tile-y": (atlas.rowCount > 1 ? row * 100 / (atlas.rowCount - 1) : 0) + "%" } : null;
  const audio = providedAudio || createTrpgAudio(presentation.theme);
  audio.setTheme(presentation.theme);
  const scripts = Object.fromEntries(scenario.dialogues.map(d => [d.dialogue_id, d.lines]));
  const root = el("section.trpg-root.trpg-cinematic", { tabindex: "-1", dataset: { phase: "cover", theme: presentation.theme, art: sceneUrl(scenario) ? "scene" : "none" } });
  if (atlas) { root.style.setProperty("--choice-atlas", "url(" + new URL(atlas.src, import.meta.url).href + ")"); root.style.setProperty("--atlas-rows", String(atlas.rowCount || 3)); }
  const content = el("div.trpg-content");
  const art = el("div.trpg-speaker-art");
  const speaker = el("strong");
  const role = el("span");
  const speech = el("p", { "aria-live": "polite" });
  const next = button("次へ", "trpg-next", advanceDialogue, { class: "trpg-next" });
  // テンポ（#3199 C4）: 今の会話を最後まで飛ばす。読んだことにしてログに残し、続きの処理はふだんどおり。
  const skip = button("≫", "trpg-skip", skipTalk, { class: "trpg-skip", "aria-label": "この会話を最後まで飛ばす", title: "この会話を最後まで飛ばす" });
  skip.hidden = true;
  const dock = el("div.trpg-dock", [art, el("div.trpg-speech", [
    el("div.trpg-speaker-label", [speaker, role]), speech,
  ]), skip, next]);
  const log = [];
  let frames = [], cursor = 0, afterTalk = null, afterFocus = null, busy = false, disposed = false, choiceField = null;
  let overlay = null, modalCloser = null, timer = null, rollTicker = null, settleGuard = false, searchTimer = null;
  // 演出（TRF08〜10）: 転生は1卓に一度（しおりから再開した卓は、もう物語の中）。場面の題の札は場面ごとに一度。
  let incarnated = resumed, staging = null, endingRevealed = false, sceneFx = null, clueFx = null, clubGained = null;
  const effects = [], carded = new Set();
  /** 重ねた演出を覚えておく（卓を片付ける時にまとめて止める）。終わったものは外す。 */
  function stageFx(...list) {
    for (let i = effects.length - 1; i >= 0; i--) if (!effects[i].playing) effects.splice(i, 1);
    effects.push(...list.filter(effect => effect?.playing));
  }
  let resolveFinished, completed = null;
  const finished = new Promise(resolve => { resolveFinished = resolve; });
  const progress = el("nav.trpg-journey", { "aria-label": "物語の進行" });
  const teamwork = el("div.trpg-teamwork", { dataset: { test: "trpg-teamwork" } });
  let shownTeamwork = null;
  const heatMeter = el("div.trpg-heat", { dataset: { test: "trpg-heat" }, role: "meter", "aria-valuemin": "0", "aria-valuemax": String(HEAT.max) });
  // 上の帯の印は絵だけ（#2839）。押すと、その印が何かを一行で出す（TMX05）。
  const chromeTip = el("p.trpg-chrome-tip", { role: "status", dataset: { test: "trpg-chrome-tip" } });
  chromeTip.hidden = true;
  let tipTimer = null;
  function showTip(text) {
    chromeTip.textContent = text; chromeTip.hidden = false;
    clearTimeout(tipTimer); tipTimer = setTimeout(() => { chromeTip.hidden = true; }, 3800);
  }
  teamwork.addEventListener("click", () => {
    const n = session.snapshot().teamwork;
    showTip("連携札 " + n + "/2：仲間の切り札（判定＋" + DICE.support + "）や、はじめの振り直しに1枚ずつ使う");
  });
  heatMeter.addEventListener("click", () => {
    const { heat } = session.snapshot(), nextTier = HEAT.tiers.find(t => t > heat);
    showTip("盛り上がり " + heat + "/" + HEAT.max + "：" + HEAT.tiers.join("・") + "に届くと勢い（次の判定に＋" + DICE.momentum + "）"
      + (nextTier ? "。あと" + (nextTier - heat) + "で次の勢い" : "。最高潮"));
  });
  let heatSeen = 0, heatChatter = [];
  const tableStatus = el("div.trpg-table-status", { dataset: { test: "trpg-table-status" }, "aria-label": "卓の進行と残りの札" });
  const table = el("div.trpg-table", { "aria-label": "卓の参加者" });
  const sound = button(audio.enabled ? "音 ON" : "音 OFF", "trpg-audio", async () => {
    sound.disabled = true;
    await audio.setEnabled(!audio.enabled);
    if (!disposed) { setToolLabel(sound, audio.enabled ? "音 ON" : "音 OFF"); sound.setAttribute("aria-pressed", String(audio.enabled)); sound.disabled = !audio.available; }
  }, { class: "small", "aria-pressed": String(audio.enabled), disabled: !audio.available });
  decorateTool(sound, "sound");
  const tools = el("div.trpg-tools", [sound,
    toolButton("会話ログ", "trpg-log", openLog, "log"),
    ...(Object.keys(sheets).length ? [toolButton("キャラクターシート", "trpg-sheets", openSheets, "sheet")] : []),
    toolButton("遊び方", "trpg-help", openHelp, "help"),
    toolButton("本棚へ戻る", "trpg-exit", exit, "exit"),
  ]);
  // 見出しの小札は、表紙では企画名だけ（作品番号は出さない・#2839）、卓が始まったら「1/7 今の工程」。
  const headingStep = el("small", { dataset: { test: "trpg-heading-step" }, text: "小さな卓の冒険" });
  root.append(el("header.trpg-header", [
    el("div.trpg-heading", [headingStep,
      el("strong", { text: scenario.title }), teamwork, heatMeter, chromeTip]), tools,
  ]), progress, table, content, dock, tableStatus);
  host.replaceChildren(root);
  fitRoomCrop();
  // 卓を始めた瞬間に、フェルトの幕が短く上下に開く（#2719・見た目だけ）。本棚の開幕が出ている間は重ねない。
  const entrance = playTrpgEntrance(host, { variant: "open" });

  /** ワイドステージ（#2861）では部屋の絵と調べる場所の印を同じ倍率で横いっぱいに拡大する（trpg-theme.css）。
   *  上下にはみ出す分のうち上から切る量 --room-crop を、どの印も上の帯の下から画面の下端までに入る範囲で、
   *  できるだけ上下均等に決める（シナリオごとに印の高さの範囲が違う。16〜88%）。PC の 16:9 では何もしない。 */
  function fitRoomCrop() {
    if (disposed || typeof document === "undefined" || !root.style?.setProperty) return;
    const stage = document.getElementById?.("stage");
    const width = parseFloat(stage?.style?.getPropertyValue?.("--stage-w")) || 1280;
    const height = width * 9 / 16, overflow = height - 720;
    const ys = (scenario.spots || []).map(spot => Number(spot.y)).filter(Number.isFinite).map(y => y / 100 * height);
    if (overflow <= 0 || !ys.length) { root.style.removeProperty?.("--room-crop"); return; }
    const box = root.getBoundingClientRect?.(), header = root.querySelector(".trpg-header")?.getBoundingClientRect?.();
    const unit = box?.height ? box.height / 720 : 1;
    const headerBottom = header?.height ? (header.bottom - box.top) / unit : 64;
    const hi = Math.min(...ys) - ROOM_SPOT_REACH - headerBottom - 8, lo = Math.max(...ys) + ROOM_SPOT_REACH - 712;
    const crop = lo > hi ? Math.min(overflow, Math.max(0, (lo + hi) / 2)) : Math.min(Math.max(overflow / 2, lo), hi);
    root.style.setProperty("--room-crop", Math.round(crop) + "px");
  }
  function button(label, test, action, attrs = {}) {
    return el("button.trpg-button", { type: "button", text: label, dataset: { test },
      onclick: () => { if (!disposed) { audio.play("tap"); action(); } }, ...attrs });
  }
  function icon(kind) {
    return el("span.trpg-tool-symbol", { "aria-hidden": "true", html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' + ICONS[kind] + '</svg>' });
  }
  function setToolLabel(node, label) {
    node.setAttribute("aria-label", label); node.title = label;
    const caption = node.querySelector(".trpg-tool-label");
    if (caption) caption.textContent = label;
  }
  function decorateTool(node, kind) {
    const label = node.textContent;
    node.classList.add("trpg-icon-tool");
    node.replaceChildren(icon(kind), el("span.trpg-tool-label", { text: label }));
    setToolLabel(node, label);
    return node;
  }
  function toolButton(label, test, action, kind) { return decorateTool(button(label, test, action), kind); }
  /** 見出しが隠れる舞台（宣言など）の「？」。説明は開いた時だけ（#2719・ミニゲーム共通のUI方針）。 */
  function helpToggle(label, test, content) {
    return el("details.trpg-inline-help", [
      el("summary", { title: label, "aria-label": label, dataset: { test } }, [el("span", { text: "？", "aria-hidden": "true" })]),
      el("div.trpg-inline-help-body", content),
    ]);
  }
  function name(id) {
    return displayName(characters, id);
  }
  function portrait(id, face = "normal") {
    return portraitUrl(manifest, id, face);
  }
  function portraitFrame(id, width, headY) {
    return {
      position: "absolute", left: "50%", width: width + "px", maxWidth: "none",
      top: topFor(manifest, id, width, headY), transform: `translateX(-${portraitAx(manifest, id) * 100}%)`,
    };
  }
  // Circular icons use a measured cheek/eye crop so every face has the same scale.
  // Speaker busts keep portraitFrame (they are not circles).
  function circleStyle(id, width, headY) {
    return faceIconStyle(id) || portraitFrame(id, width, headY);
  }
  // The seat's chosen origin wears the role costume when we have one. The crop
  // matches the character's standing-portrait metrics (same head height / centre).
  function roleIdOf(id) {
    const sheet = session.sheets[seatOf(id)] || session.sheets[id];
    return sheet?.archetype || sheet?.option || null;
  }
  function speakerPortrait(id, face = "normal") {
    return costumeUrl(scenario.id, id, roleIdOf(id)) || portrait(id, face);
  }
  // The same seat mark follows a participant from the table to a spent ability.
  function seatMark(id) {
    return el("span.trpg-seat-mark", { text: String(scenario.cast.findIndex(c => c.id === id) + 1),
      "aria-label": "席" + (scenario.cast.findIndex(c => c.id === id) + 1) });
  }
  function syncSpeaker(id = null) {
    table.querySelectorAll("[data-speaker]").forEach(node => {
      const active = node.dataset.speaker === id;
      node.classList.toggle("active", active);
      node.querySelector(".trpg-seat-speaking").textContent = active ? "話者" : "";
    });
  }
  let chromePhase = null;
  function syncChrome() {
    const state = session.snapshot();
    // 場面が進んだらページをめくる音（開幕は "open"、結末はジングルが鳴るので除く）。
    if (chromePhase && chromePhase !== "cover" && state.phase !== chromePhase && state.phase !== "ending" && state.phase !== "cover") audio.play("page");
    chromePhase = state.phase;
    root.dataset.phase = state.phase;
    root.dataset.risk = state.pressure >= 5 ? "high" : "calm";
    root.style.setProperty("--risk-level", state.pressure / session.rules.pressureMax);
    const current = PHASES.indexOf(state.phase);
    progress.replaceChildren(el("ol", PHASES.map((phase, i) => el("li", {
      class: i < current ? "done" : "", "aria-current": phase === state.phase ? "step" : null,
    }, [el("i", { text: i < current ? "✓" : String(i + 1), "aria-hidden": "true" }),
      el("span", { text: phase === "ending" ? "結末" : presentation.phases[phase].kicker.split(" / ").pop() })]))));
    const before = shownTeamwork ?? state.teamwork;
    // 連携札は🂠×2の札だけ（文字なし・#2839）。残りは読み上げ用のラベルに持たせる。
    teamwork.setAttribute("role", "img");
    teamwork.setAttribute("aria-label", "連携札 " + state.teamwork + "/2");
    teamwork.replaceChildren(
      ...[1, 2].map(n => el("i", { "aria-hidden": "true", text: "\u{1F0A0}", class: [n > state.teamwork ? "spent" : "",
        n > state.teamwork && n <= before ? "just-spent" : "", n <= state.teamwork && n > before ? "just-gained" : ""].filter(Boolean).join(" ") })));
    shownTeamwork = state.teamwork;
    table.replaceChildren(...scenario.cast.map(c => {
      const pc = c.part === "GM" ? null : pcOf(c.id);
      return el("span.trpg-table-person", { dataset: { speaker: c.id, part: c.part === "GM" ? "gm" : "pl" }, title: c.part === "GM" ? GM_TITLE + " " + name(c.id) : null }, [
        // 座席は顔＋名前だけ。PL/GMの英字・席番号・能力値はキャラクターシートに任せ、話者だけ光らせる（#2839）。
        // GMの席は顔を出さず、「GM」と書いたゲームマスターの印（TRF20）。
        el("span.trpg-seat-face", { "aria-hidden": "true", dataset: c.part === "GM" ? { gm: "true", test: "trpg-seat-gm" } : { gm: "false" } },
          c.part === "GM" ? gmMark(true) : el("img", { src: portrait(c.id), alt: "", style: circleStyle(c.id, 160, 6) })),
        el("span.trpg-seat-head", [el("span.trpg-seat-name", { text: name(c.id) }), el("small.trpg-seat-speaking")]),
        pc ? el("span.trpg-seat-pc", { dataset: { test: "trpg-seat-pc-" + c.id } }, [el("strong", { text: pc.name })]) : null,
        c.part === "GM" && npcSeats.length ? el("span.trpg-seat-pc", { dataset: { test: "trpg-seat-npc" } },
          [el("strong", { text: "兼任 " + npcSeats.map(seat => sheets[seat].name).join("・") })]) : null,
        ...(c.part === "GM" ? [] : [el("small.trpg-seat-ability", { text: state.used[c.id] ? "札 使用済" : "札 未使用",
          dataset: { spent: String(!!state.used[c.id]) } })]),
      ].filter(Boolean));
    }));
    syncSpeaker(busy ? frames[cursor]?.speaker : gm);
    const covering = state.phase === "cover";
    dock.hidden = covering && !busy;
    table.hidden = covering;
    progress.hidden = covering;
    teamwork.hidden = covering;
    syncResources();
  }
  function stepText() {
    const state = session.snapshot(), step = Math.max(0, PHASES.indexOf(state.phase));
    const label = presentation.phases[state.phase]?.kicker.split(" / ").pop() || "卓の準備";
    return `${step + 1}/${PHASES.length} ${label}`;
  }
  function resourceText() {
    const state = session.snapshot();
    return `${stepText()} · 判定 ${state.checks.length}/${CHECKS.length} · 連携札 ${state.teamwork}/2`
      + (session.rules.inspectionPressure ? ` · ${RISK} ${state.pressure}/${session.rules.pressureMax}` : "");
  }
  /** Header meter plus one short pop per new moment. Tier 2/3 queue GM chatter for the next talk. */
  function syncHeat() {
    const state = session.snapshot(), tier = heatTier(state.heat);
    heatMeter.hidden = state.phase === "cover";
    heatMeter.dataset.tier = String(tier);
    heatMeter.setAttribute("aria-valuenow", String(state.heat));
    heatMeter.setAttribute("aria-label", "卓の盛り上がり " + state.heat + "/" + HEAT.max + " · " + HEAT.names[tier]);
    // 盛り上がりは🔥のメーターだけ（文字なし・#2839）。段の名前は読み上げのラベルに残す。
    heatMeter.replaceChildren(...[el("span.trpg-heat-label", { text: "\u{1F525}", "aria-hidden": "true" }),
      el("span.trpg-heat-pips", { "aria-hidden": "true" }, Array.from({ length: HEAT.max }, (_, i) =>
        el("i", { class: [i < state.heat ? "lit" : "", HEAT.tiers.includes(i + 1) ? "tier" : ""].filter(Boolean).join(" ") }))),
      state.momentum && state.phase !== "ending" ? el("b.trpg-heat-momentum", { text: "勢い＋" + state.momentum, dataset: { test: "trpg-momentum" } }) : null].filter(Boolean));
    const fresh = state.heatLog.slice(heatSeen);
    heatSeen = state.heatLog.length;
    const top = Math.max(0, ...fresh.map(entry => entry.tier));
    if (fresh.length) heatPop({ tier: top, amount: fresh.reduce((n, entry) => n + entry.amount, 0), reason: fresh.at(-1).reason });
    if (top >= 2) {
      const lines = tableTalk?.["trpg_talk_" + gm + "_" + (top >= 3 ? "heat_max" : "heat_up")];
      if (lines?.every(line => cast[line.speaker])) heatChatter = lines;
    }
  }
  function heatPop(entry) {
    if (disposed) return;
    audio.play(entry.tier ? "success" : "clue");
    const pop = el("div.trpg-heat-pop", { "aria-hidden": "true", dataset: { tier: String(entry.tier) } }, [
      el("strong", { text: entry.tier ? HEAT.names[entry.tier] + "！" : "盛り上がり ＋" + entry.amount }),
      el("span", { text: entry.tier ? "次の判定 ＋" + DICE.momentum : entry.reason }),
    ]);
    root.querySelectorAll(".trpg-heat-pop").forEach(old => old.remove());
    pop.addEventListener("animationend", () => pop.remove());
    root.append(pop);
  }
  function syncResources() {
    syncHeat();
    tableStatus.hidden = session.snapshot().phase === "cover";
    tableStatus.textContent = resourceText();
    headingStep.textContent = session.snapshot().phase === "cover" ? "小さな卓の冒険" : stepText();
    root.querySelectorAll(".trpg-roll-context").forEach(node => { node.textContent = resourceText(); });
    table.querySelectorAll("[data-speaker]").forEach(node => {
      const ability = node.querySelector(".trpg-seat-ability");
      if (ability) {
        const spent = !!session.snapshot().used[node.dataset.speaker];
        ability.dataset.spent = String(spent); ability.textContent = spent ? "札 使用済" : "札 未使用";
      }
    });
  }
  /** Until a scenario's painted room exists, a tinted backdrop with the room's name stands in. */
  function sceneFallback(cls) {
    return el("div." + cls + ".trpg-scene-fallback", { role: "img", "aria-label": presentation.sceneAlt || presentation.location,
      style: { background: presentation.backdrop || "linear-gradient(160deg, #1d3a44, #0c1b22 70%)" } },
      el("span.trpg-scene-fallback-title", { text: presentation.location || "" }));
  }
  function sequence(...ids) { return ids.flatMap(id => typeof id === "string" ? scripts[id] || [] : id).filter(Boolean); }
  function talk(lines, callback, focusTest = null) {
    sceneFx?.cancel();
    syncHeat();
    frames = sequence(lines, heatChatter); heatChatter = []; cursor = 0; afterTalk = callback; afterFocus = focusTest; busy = true;
    root.classList.remove("trpg-idle"); root.classList.add("trpg-talking"); next.hidden = false; next.disabled = false;
    skip.hidden = frames.length < 3;
    renderBody();
    showFrame();
    next.focus({ preventScroll: true });
  }
  /**
   * 台詞の層（TRF10）。卓の会話（素の本人どうし）か、物語の中か。物語の中は3つに分かれる:
   * narration＝GMが場面を語る／npc＝GMが物語の人物を演じる／pc＝PLが自分の役として話す。
   * 台本の role の書き方（「GM／場面」「旅人オル」「{pc}／物語」「PL／卓の会話」）から決める。
   */
  function lineKind(frame) {
    const raw = String(frame?.role ?? "");
    if (!raw || /卓の会話$|はじめての人へ/.test(raw)) return "table";
    if (/場面/.test(raw)) return "narration";
    // 役の名前の付いた台詞でも、話しているのがGMなら（空席の役をGMが演じている）物語の人物と同じ見せ方にする。
    if (frame.speaker === gm) return "npc";
    return "pc";
  }
  const roleLabel = frame => pcText(frame.role).replace(/^(?:GM|PL)／卓の会話$/, "");
  /** 舞台の層を切り替える: 物語の中では卓の縁（座席）を隠して人物を大きく、卓の会話では部屋の絵を少し沈める。 */
  function setLayer(kind) {
    const layer = kind === "idle" ? "idle" : kind === "table" ? "table" : "fiction";
    root.dataset.layer = layer; root.dataset.kind = kind;
    dock.dataset.layer = layer === "fiction" ? "fiction" : "table"; dock.dataset.kind = kind;
  }
  // ゲームマスターの印（TRF20）: GMは卓で顔を出さない。衝立（GMスクリーン）とダイスの印と、「ゲームマスター（名前）」の名札で話す。
  const GM_TITLE = "ゲームマスター";
  const GM_MARK = '<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false"><path d="M20 15 6 21v33l14-5ZM44 15l14 6v33l-14-5Z"/><path d="M20 15h24v34H20Z"/><path class="die" d="m32 23 8 4.6v9.2L32 41.4l-8-4.6v-9.2Z"/><path class="die-line" d="M32 23v6.4m0 0-8 7.4m8-7.4 8 7.4m-16 0h16" fill="none"/></svg>';
  const gmMark = (lettered = false) => el("span.trpg-gm-mark", { html: GM_MARK + (lettered ? "<b>GM</b>" : ""), "aria-hidden": "true", dataset: { lettered: String(lettered) } });
  /** GMが自分の声で話す行（卓の会話・語り）。店長のチュートリアルは店長本人として話すので含めない。 */
  const gmVoice = frame => frame.speaker === gm && !/はじめての人へ/.test(String(frame.role ?? ""));
  const NPC_FIGURE = '<svg viewBox="0 0 120 150" aria-hidden="true" focusable="false"><path d="M60 12c-17 0-29 13-29 31 0 10 4 18 9 24-17 6-30 20-33 41l-2 42h110l-2-42c-3-21-16-35-33-41 5-6 9-14 9-24 0-18-12-31-29-31Z"/></svg>';
  // 人物ではないもの（予告状・招待状・手紙・貼り紙）を読む時は、紙の札。
  const NPC_PAPER = '<svg viewBox="0 0 120 150" aria-hidden="true" focusable="false"><path d="M22 18h60l22 22v92H22Z"/><path d="M82 18v22h22M38 62h48M38 80h48M38 98h34" fill="none"/></svg>';
  const isPaper = label => /状$|手紙|貼り紙|張り紙|看板|書き置き/.test(label);
  function showFrame() {
    const frame = frames[cursor];
    if (!frame) { finishTalk(); return; }
    const person = cast[frame.speaker], kind = lineKind(frame);
    // はじめて物語の中へ入る瞬間に、みんなが役の姿になる（TRF08）。送りの1押しめは、この演出を閉じるだけ。
    if (kind !== "table" && !incarnated && session.snapshot().phase !== "cover") { incarnated = true; incarnate(); }
    if (frame.fx) stageCue(frame.fx);
    const asGm = gmVoice(frame) && (kind === "table" || kind === "narration");
    if (kind === "npc") {
      // GMが演じる物語の人物: 立ち絵は出さず、人影の札と名前。演じているのがゲームマスターだと名札に添える。
      const who = roleLabel(frame).replace(/／物語$/, "");
      art.replaceChildren(el("span.trpg-npc-figure", { html: isPaper(who) ? NPC_PAPER : NPC_FIGURE, dataset: { shape: isPaper(who) ? "paper" : "person" } }));
      speaker.textContent = who;
      role.textContent = GM_TITLE + " " + name(gm);
    } else if (asGm) {
      // GM自身の声（卓の会話・場面の語り）: 顔は出さず、印と「ゲームマスター（名前）」。語りは中央に寄せる（印も出さない）。
      art.replaceChildren(...(kind === "narration" ? [] : [gmMark()]));
      speaker.textContent = GM_TITLE; role.textContent = name(gm);
    } else if (kind === "narration") {
      art.replaceChildren();
      speaker.textContent = "語り"; role.textContent = name(frame.speaker);
    } else if (kind === "pc") {
      // 役として話す時は役衣装の姿と役の名前。演じている本人は小さく添える。
      art.replaceChildren(el("img", { src: speakerPortrait(frame.speaker, frame.face), alt: name(frame.speaker), style: portraitFrame(frame.speaker, 410, 16) }));
      speaker.textContent = pcOf(frame.speaker)?.name || name(frame.speaker);
      role.textContent = name(frame.speaker);
    } else {
      // 卓の会話は素の本人。表情つきの立ち絵で話す（役衣装の絵は表情が1つなので、物語の中だけで使う）。
      art.replaceChildren(el("img", { src: portrait(frame.speaker, frame.face) || speakerPortrait(frame.speaker, frame.face), alt: name(frame.speaker),
        style: portraitFrame(frame.speaker, 410, 16) }));
      speaker.textContent = name(frame.speaker);
      role.textContent = roleLabel(frame);
    }
    art.style.backgroundColor = person?.color || "#566053";
    setLayer(kind);
    dock.dataset.gm = String(asGm);
    speech.textContent = pcText(frame.text);
    // 一行ごとに短く現れる（字は最初から全部入っている。読み上げと検査は待たない）。
    speech.dataset.tick = String(cursor % 2);
    showPanel(frame.panel || null);
    next.textContent = cursor + 1 < frames.length ? "次へ" : "続ける";
    syncSpeaker(frame.speaker);
    // 台詞の肩書きは場面の種類（「場面」「物語」）だけ。「GM／卓の会話」「PL／卓の会話」は出さない（#2839）。
    log.push({ speaker: frame.speaker, gm: frame.speaker === gm && gmVoice(frame), role: roleLabel(frame), text: pcText(frame.text) });
  }
  /** 転生の演出（TRF08）: 卓の顔ぶれの札が裏返り、本人から役の姿へ。操作は塞がず、送りの1押しで閉じられる。 */
  function incarnate() {
    const cards = scenario.cast.filter(c => c.part !== "GM" && pcOf(c.id)).map(c => {
      const seat = seatOf(c.id), pc = pcOf(c.id);
      return { real: { name: name(c.id), face: pcFace(seat, c.id) }, role: { name: pc.name, title: pc.title || "", figure: pcFigure(seat, c.id) } };
    });
    audio.play("open");
    staging = playIncarnation(root, { cards, place: presentation.location || scenario.title, teller: GM_TITLE + " " + name(gm),
      onFlip: () => audio.play("card"), onArrive: () => { audio.play("page"); stageFx(impact(root, "arrive")); } });
    stageFx(staging);
  }
  /** 台詞の行に付いた合図（fx）で場面を動かす。twist＝思わぬ展開の入り、ending＝結末の入り、shake／flash は台本から。 */
  function stageCue(fx) {
    if (fx === "twist") {
      audio.play("trouble");
      sceneFx?.cancel();
      sceneFx = playSceneCard(root, { ...sceneName("twist"), tone: "alert" });
      stageFx(impact(root, "twist"), sceneFx);
      carded.add("twist");
    } else if (fx === "ending") stageFx(impact(root, "arrive"));
    else if (fx === "shake") stageFx(impact(root, "twist"));
    else if (fx === "flash") stageFx(impact(root, "arrive"));
  }
  /** 台本の最初の行に合図を付ける（台本のデータは書き換えない）。 */
  function withCue(id, fx) {
    const lines = typeof id === "string" ? scripts[id] || [] : id || [];
    return lines.map((line, i) => i || line.fx ? line : { ...line, fx });
  }
  /** 場面が切り替わって操作を待つ時に、場面の題の札を一度だけ出す（TRF10）。 */
  function sceneCard(phase) {
    if (carded.has(phase) || !["interview", "explore", "prepare", "serve"].includes(phase)) return;
    carded.add(phase);
    sceneFx?.cancel(); clueFx?.cancel();
    sceneFx = playSceneCard(root, sceneName(phase));
    stageFx(sceneFx);
  }
  /** 場面の題の札の文: 「場面 2 / 7」と場面の名前（問いかけの文は、その画面の見出しにある）。 */
  function sceneName(phase) {
    return { kicker: "場面 " + (PHASES.indexOf(phase) + 1) + " / " + PHASES.length,
      title: presentation.phases[phase]?.kicker?.split(" / ").pop() || presentation.phases[phase]?.title || "" };
  }
  function advanceDialogue() {
    if (!busy || overlay || disposed) return;
    // 転生の演出の最中の1押しは、演出を閉じるだけ（下で出ている最初の一行を読み飛ばさない）。
    if (staging?.playing) { staging.cancel(); return; }
    cursor++;
    if (cursor < frames.length) showFrame(); else finishTalk();
  }
  function skipTalk() {
    if (!busy || overlay || disposed) return;
    staging?.cancel();
    for (cursor++; cursor < frames.length; cursor++) {
      const frame = frames[cursor];
      // 飛ばした会話の中で物語に入っていたら、転生の演出は出さずに済ませる（後の場面で遅れて出さない）。
      if (lineKind(frame) !== "table" && session.snapshot().phase !== "cover") incarnated = true;
      log.push({ speaker: frame.speaker, gm: frame.speaker === gm && gmVoice(frame), role: roleLabel(frame), text: pcText(frame.text) });
    }
    finishTalk();
  }
  function finishTalk() {
    busy = false; frames = [];
    root.classList.remove("trpg-talking");
    showPanel(null);
    const callback = afterTalk, focusTest = afterFocus; afterTalk = null; afterFocus = null;
    next.hidden = true; skip.hidden = true; root.classList.add("trpg-idle");
    if (callback) callback(); else renderBody();
    if (!overlay && !busy) (focusTest && root.querySelector('[data-test="' + focusTest + '"]') || root).focus({ preventScroll: true });
  }
  function idle(text) {
    if (busy) return;
    art.replaceChildren(gmMark());
    art.style.backgroundColor = cast[gm].color;
    speaker.textContent = GM_TITLE; role.textContent = name(gm); speech.textContent = text;
    setLayer("idle");
    dock.dataset.gm = "true";
    syncSpeaker(gm);
    root.classList.add("trpg-idle"); next.hidden = true;
  }
  function start() {
    if (busy || overlay || session.snapshot().phase !== "cover") return;
    session.start(); syncChrome();
    audio.play("open");
    // Session zero: everyone at the table says who they will play before the story begins.
    const zero = scenario.sessionZero ? [scenario.sessionZero.open, ...Object.values(session.companions).map(o => o.making), scenario.sessionZero.close] : [];
    talk(sequence(...zero, scenario.intro, scenario.listen, [{ speaker: gm, role: presentation.arrivalRole, text: session.profile.arrival }]),
      () => { renderBody(); openDeclaration("listen"); });
  }
  function room(interactive = false) {
    const node = el("div.trpg-room", { class: interactive ? "interactive" : "" }, [
      sceneUrl(scenario) ? el("img", { src: sceneUrl(scenario), alt: presentation.sceneAlt, decoding: "async", onerror: event => {
        event.currentTarget.hidden = true; node.classList.add("art-unavailable");
        node.querySelector(".trpg-scene-retry").hidden = false;
      } }) : sceneFallback("trpg-scene-fallback"),
      el("div.trpg-scene-weather", { "aria-hidden": "true" }),
      el("div.trpg-room-title", { text: "物語の中 · " + presentation.location }),
      el("div.trpg-room-sub", { text: presentation.atmosphere }),
      button("背景をもう一度表示", "trpg-scene-retry", () => {
        const image = node.querySelector("img");
        image.onload = () => { image.hidden = false; node.classList.remove("art-unavailable"); node.querySelector(".trpg-scene-retry").hidden = true; };
        image.src = sceneUrl(scenario) + "?retry=" + Date.now();
      }, { class: "small trpg-scene-retry", hidden: true }),
    ]);
    if (interactive) {
      const state = session.snapshot();
      scenario.spots.forEach((spot, i) => {
        const checked = state.clues.includes(spot.id);
        node.append(el("button.trpg-spot", { type: "button",
          class: checked ? "checked" : "", disabled: busy || (!checked && state.clues.length >= session.rules.exploreLimit),
          "aria-label": spot.label + (checked ? "、調査済み。もう一度読む" : "を調べる"),
          style: { left: spot.x + "%", top: spot.y + "%" }, dataset: { test: "trpg-spot-" + spot.id, labelSide: spot.y >= 65 ? "above" : "below" },
          onclick: () => {
            if (busy || overlay) return;
            const clue = session.inspect(spot.id), from = clue.fresh ? root.querySelector('[data-test="trpg-spot-' + spot.id + '"]')?.getBoundingClientRect?.() : null;
            audio.play(clue.fresh ? "clue" : "tap");
            if (clue.fresh) { clueFx?.cancel(); clueFx = playClueCard(root, { kicker: "手がかり " + session.snapshot().clues.length, title: clue.evidence.title }); stageFx(clueFx); }
            talk(clue.evidence.lines, () => { renderBody(); idle(presentation.exploreIdle); if (from) flySlip(spot.id, from); }, "trpg-spot-" + spot.id);
          },
        }, [el("i", { text: checked ? "✓" : String(i + 1) }), el("span.trpg-stage-hotspot-label", {
          text: spot.short + (!checked && session.rules.inspectionPressure ? " · " + RISK + "＋" + session.rules.inspectionPressure : ""),
        })]));
      });
    }
    return node;
  }
  function flySlip(id, from) {
    const slip = root.querySelector('.trpg-table-clue[data-clue="' + id + '"]');
    if (!slip?.animate || !slip.getBoundingClientRect || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const to = slip.getBoundingClientRect(), scale = (root.getBoundingClientRect().width / root.offsetWidth) || 1;
    const dx = (from.left + from.width / 2 - to.left - to.width / 2) / scale, dy = (from.top + from.height / 2 - to.top - to.height / 2) / scale;
    audio.play("slip");
    slip.animate([
      { transform: "translate(" + dx + "px," + dy + "px) rotate(-14deg) scale(1.5)", opacity: 0 },
      { transform: "translate(" + dx * .55 + "px," + (dy * .55 - 60) + "px) rotate(8deg) scale(1.25)", opacity: 1, offset: .45 },
      { transform: "none", opacity: 1 },
    ], { duration: 620, easing: "cubic-bezier(.3,.7,.3,1)" });
  }
  function investigation() {
    const state = session.snapshot(), remaining = session.rules.exploreLimit - state.clues.length;
    const ready = state.clues.length >= 3;
    return el("p.trpg-stage-investigation", { dataset: { test: "trpg-investigation", ready: String(ready) }, role: "status",
      text: "手がかり " + state.clues.length + (ready ? "個" : "/3") + (session.rules.inspectionPressure
        ? " · 調査あと" + remaining + "箇所 · 新規調査で" + RISK + "＋" + session.rules.inspectionPressure
        : ready ? " · みんなで見立てを話せる" : " · 気になるものを調べよう") });
  }
  function planSummary() {
    const state = session.snapshot();
    return el("div.trpg-plan-summary", { dataset: { test: "trpg-plan-summary" } }, [
      el("strong", { text: presentation.planTitle || (presentation.theme === "shark" ? "みんなの脱出プラン" : "旅人への提案") }),
      ...Object.entries(state.plan).map(([field, id]) => el("div", { class: id ? "chosen" : "pending" }, [
        el("small", { text: presentation.fields[field] }),
        el("span", { text: scenario.options[field].find(o => o.id === id)?.label || "これから選ぶ" }),
      ])),
    ]);
  }
  /** しおり（TMX13）: 休める所に着くたび、押した順番を呼び出し側へ渡す。 */
  function keepMark() {
    const state = session.snapshot();
    if (onBookmark && !busy && !completed && !state.pending && state.phase !== "cover" && state.phase !== "ending") {
      onBookmark({ actions: JSON.parse(JSON.stringify(pressed)), pc: build ? { ...build } : null, phase: state.phase,
        title: presentation.phases[state.phase]?.title || "" });
    }
  }
  function renderBody() {
    if (disposed) return;
    syncChrome();
    const state = session.snapshot();
    keepMark();
    content.hidden = state.phase === "cover";
    root.querySelector(".trpg-cover")?.remove();
    if (state.phase === "cover") { cover(); return; }
    content.replaceChildren();
    const scene = room(state.phase === "explore");
    const copy = presentation.phases[state.phase];
    const cue = el("div.trpg-stage-cue", [el("div.trpg-kicker", { text: presentation.location }),
      el("h2", { text: copy.title })]);
    const actions = el("div.trpg-stage-action");
    const pockets = el("div.trpg-stage-pockets", [button("メモ " + state.clues.length, "trpg-compare-notes", openNotes,
      { class: "trpg-notebook", "aria-label": "調査メモを開く。手がかり" + state.clues.length + "個" })]);
    // One existing memo button owns the cards: no second memo or new state.
    if (state.clues.length) pockets.querySelector("button").prepend(el("span.trpg-table-clues", { "aria-hidden": "true" },
      state.clues.slice(0, 3).map((id, i) => el("span.trpg-table-clue", {
        text: String(i + 1), title: session.profile.evidence[id].title, dataset: { clue: id },
      }))));
    if (session.rules.inspectionPressure) cue.append(el("small.trpg-stage-risk", {
      text: RISK + " " + state.pressure + "/" + session.rules.pressureMax,
      dataset: { test: "trpg-risk" }, "aria-label": RISK + " " + state.pressure + "、最大" + session.rules.pressureMax,
    }));
    if (state.phase === "listen") {
      if (!busy) actions.append(button("判定へ", "trpg-listen-open", () => openDeclaration("listen"), { class: "primary" }));
      idle(presentation.listenIdle);
    } else if (state.phase === "explore") {
      cue.append(investigation());
      const companions = el("div.trpg-stage-companions", Object.keys(scenario.consult).map(id => {
        const node = button("", "trpg-consult-" + id, () => consult(id), {
          class: "trpg-companion", disabled: busy, "aria-label": name(id) + "に相談する。何度でも相談できます", title: name(id) + "に相談",
        });
        node.append(el("span.trpg-companion-face", el("img", { src: portrait(id), alt: "", style: circleStyle(id, 150, 6) })),
          el("span", { text: name(id) + "に相談" }));
        return node;
      }));
      scene.append(companions);
      if (state.clues.length >= 3) actions.append(button(copy.button, "trpg-interpret", chooseHypothesis, { class: "primary", disabled: busy }));
      idle(presentation.exploreIdle);
    } else if (state.phase === "interview") {
      scene.append(interviewTopics());
      const asked = state.asked.length, picks = session.interviewPicks();
      if (asked) actions.append(button(asked >= picks ? copy.button : "話を切り上げて、調べに行く", "trpg-interview-done", () => {
        if (busy || overlay) return;
        session.endInterview(); renderBody(); idle(presentation.exploreIdle);
      }, { class: asked >= picks ? "primary" : "", disabled: busy }));
      idle(interviewCopy(presentation.interviewIdle) || presentation.exploreIdle);
    } else if (state.phase === "twist") {
      scene.append(twistChoices());
      actions.append(button(copy.button, "trpg-twist-open", () => openDeclaration("twist"),
        { class: "primary", disabled: busy || session.flow.twist.some(f => !state.plan[f]) }));
      idle(presentation.twistIdle || presentation.prepareIdle);
    } else if (state.phase === "prepare") {
      scene.append(preparationChoices());
      actions.append(button(copy.button, "trpg-prepare-open", () => openDeclaration("prepare"),
        { class: "primary", disabled: busy || session.flow.prepare.some(f => !state.plan[f]) }));
      idle(presentation.prepareIdle);
    } else if (state.phase === "serve") {
      scene.append(servingChoices());
      actions.append(button(copy.button, "trpg-serve-open", () => openDeclaration("serve"),
        { class: "primary", disabled: busy || session.flow.serve.some(f => !state.plan[f]) }));
      idle(presentation.serveIdle);
    } else {
      const result = session.result(), ending = scenario.endings[result.ending];
      scene.append(el("div.trpg-ending", [
        el("div.trpg-kicker", { text: presentation.endingKicker }), el("h2", { text: ending.title, dataset: { test: "trpg-ending-title" } }),
        el("p", { text: ending.line }),
        el("p.trpg-ending-heat", { dataset: { test: "trpg-ending-heat", tier: String(heatTier(result.heat.value)) } },
          [el("strong", { text: result.heat.night }), el("span", { text: "盛り上がり " + result.heat.value + "/" + result.heat.max }),
            result.finale ? el("b.trpg-ending-finale", { dataset: { test: "trpg-ending-finale" }, text: "会心のクライマックス" }) : null].filter(Boolean)),
        el("div.trpg-ending-rating", { dataset: { test: "trpg-ending-rating" }, title: STAR_MARKS.map(([key, label]) => (result.rating.marks[key] ? "★" : "☆") + label).join(" · ") },
          [stars(result.rating), el("strong", { text: result.rating.title })]),
        clubGained?.gained > 0 || clubGained?.rankUp ? el("p.trpg-ending-club", { dataset: { test: "trpg-ending-club", up: String(!!clubGained.rankUp) } }, [
          el("b", { text: "部の実績 ＋" + clubGained.gained }),
          clubGained.rankUp ? el("strong", { text: "ランク " + clubGained.rank + " · " + clubGained.name }) : clubGained.next ? el("span", { text: "次のランクまで あと " + clubGained.next.need }) : null,
          clubGained.growthUp > 0 ? el("i", { text: "はじめの役 能力＋" + clubGained.growth }) : null,
        ].filter(Boolean)) : null,
      ].filter(Boolean)));
      actions.append(button("この卓を振り返る", "trpg-recap", openRecap, { disabled: busy }), ...(allowReplay ? [button("もう一度、この物語", "trpg-replay", () => finish({ ...result, replayRequested: true }),
        { disabled: busy })] : []), button(closeLabel, "trpg-finish", () => finish(result), { class: "primary", disabled: busy }));
      idle(presentation.endingIdle);
    }
    if (["interview", "twist", "prepare", "serve", "ending"].includes(state.phase)) cue.hidden = true;
    scene.append(cue, actions, pockets);
    content.append(scene);
    if (!busy) {
      setLayer("idle");
      sceneCard(state.phase);
      // 結末の札は、はじめて出た時だけ一行ずつ現れる（振り返りから戻った時は動かさない）。
      if (state.phase === "ending" && !endingRevealed) { endingRevealed = true; scene.querySelector(".trpg-ending")?.setAttribute("data-reveal", "true"); }
    }
  }
  function consult(id) {
    if (busy || overlay) return;
    talk(session.consult(id), () => { renderBody(); idle(presentation.exploreIdle); }, "trpg-consult-" + id);
  }
  function cover() {
    root.append(el("div.trpg-cover.trpg-cinematic-cover", [
      sceneUrl(scenario) ? el("img.trpg-cover-backdrop", { src: sceneUrl(scenario), alt: presentation.sceneAlt }) : sceneFallback("trpg-cover-backdrop"),
      el("div.trpg-cover-copy", [
        el("small.trpg-kicker", { text: presentation.genre + " / 約10分" }),
        el("h1", presentation.titleLines.map(text => el("span", { text }))),
        el("p", { text: scenario.premise }),
        // 遊び方は右上の「？」（#2719）。表紙には始める札と、はじめての人への案内だけ。
        el("div.trpg-cover-actions", [button("物語をはじめる", "trpg-start", start, { class: "primary" }),
          tutorialLines?.length ? button("はじめての人へ", "trpg-tutorial", playTutorial) : null].filter(Boolean)),
        scenario.builder ? pcCard() : null,
      ].filter(Boolean)),
      el("div.trpg-cover-party", scenario.cast.map(c => el("div.trpg-cover-person", [
        el("span.trpg-cover-person-art", el("img", { src: portrait(c.id), alt: "", style: circleStyle(c.id, 150, 6) })),
        el("strong", { text: name(c.id) }),
        el("small", { dataset: { part: c.part === "GM" ? "gm" : "pl" }, text: c.part === "GM" ? GM_TITLE : pcOf(c.id) ? pcOf(c.id).name : pcText(c.role).split("／")[0] }),
      ]))),
    ]));
  }
  function optionButton(field, option) {
    const selected = session.snapshot().plan[field] === option.id;
    const column = scenario.options[field].findIndex(o => o.id === option.id);
    const art = tileStyle(atlas?.rows?.[field], column);
    // GMのヒント（TRF02）: 判定の成功でもらえる。合わない選択肢に印がつくだけで、選ぶことはできる。
    const hinted = session.snapshot().hints[field] === option.id;
    return el("button.trpg-button.trpg-object-choice", { type: "button", class: [selected ? "selected" : "", art ? "" : "trpg-text-choice", hinted ? "trpg-hinted" : ""].filter(Boolean).join(" "),
      disabled: busy, "aria-pressed": selected ? "true" : "false",
      "aria-label": option.label + "。" + option.description + (hinted ? "。GMのヒント：今夜は合わなそう" : ""),
      dataset: { test: "trpg-plan-" + field + "-" + option.id, hinted: String(hinted) },
      onclick: () => {
        if (busy || overlay) return;
        audio.play("tap"); session.plan(field, option.id);
        if (session.flow.prepare.includes(field)) choiceField = session.flow.prepare.find(f => !session.snapshot().plan[f]) || field;
        renderBody();
        (root.querySelector('[data-test="trpg-plan-' + field + "-" + option.id + '"]')
          || root.querySelector(".trpg-choice-cards button"))?.focus({ preventScroll: true });
      },
    }, [art ? el("span.trpg-object-art", { "aria-hidden": "true", style: art }) : el("span.trpg-text-choice-mark", { "aria-hidden": "true", text: "ABC"[column] || "" }),
      el("strong.trpg-object-label", { text: option.label }), el("span.trpg-object-detail", { text: option.description }),
      hinted ? el("i.trpg-hint-mark", { "aria-hidden": "true", dataset: { test: "trpg-hint-" + field }, text: "✕ 合わなそう", title: "GMのヒント" }) : null].filter(Boolean));
  }
  function choiceTabs(fields, interactive = true) {
    const state = session.snapshot();
    return el("div.trpg-choice-tabs", { dataset: { test: "trpg-plan-summary" } }, fields.map(field => {
      const value = scenario.options[field].find(o => o.id === state.plan[field])?.label;
      if (!interactive) return value ? el("span.trpg-choice-token", { text: value }) : null;
      const node = button("", "trpg-choice-tab-" + field, () => {
        if (busy || overlay) return;
        choiceField = field; renderBody();
        root.querySelector('[data-test="trpg-choice-tab-' + field + '"]')?.focus({ preventScroll: true });
      }, { class: "trpg-choice-tab", disabled: busy, "aria-pressed": String(choiceField === field) });
      node.append(el("small", { text: presentation.fields[field] }), el("span", { text: value || "選んでいない" }));
      return node;
    }));
  }
  function preparationChoices() {
    const fields = session.flow.prepare;
    if (!fields.includes(choiceField)) choiceField = fields.find(f => !session.snapshot().plan[f]) || fields[0];
    return el("div.trpg-selection", { dataset: { field: choiceField } }, [
      el("div.trpg-selection-title", [el("small", { text: (fields.indexOf(choiceField) + 1) + " / " + fields.length }),
        el("h2", { text: presentation.fields[choiceField] + "を選ぼう", "aria-live": "polite" })]),
      choiceTabs(fields), el("div.trpg-choice-cards", scenario.options[choiceField].map(option => optionButton(choiceField, option))),
    ]);
  }
  /** Questions for the story's character: a few picks, each answered in the GM's voice. */
  function interviewTopics() {
    const state = session.snapshot(), picks = session.interviewPicks();
    return el("div.trpg-selection.trpg-interview", { dataset: { field: "interview", bonus: String(!!state.extraQuestions) } }, [
      el("div.trpg-selection-title", [el("small", { dataset: { test: "trpg-interview-left" }, text: "あと " + Math.max(0, picks - state.asked.length) + " つ", title: state.extraQuestions ? "判定の成功で、聞けることが1つ増えた" : "" }),
        el("h2", { text: scenario.interview.title, "aria-live": "polite" })]),
      el("p.trpg-interview-prompt", { text: interviewCopy(scenario.interview.prompt) }),
      el("div.trpg-topic-list", scenario.interview.topics.map(topic => {
        const asked = state.asked.includes(topic.id), spent = !asked && state.asked.length >= picks;
        return el("button.trpg-button.trpg-topic", { type: "button", class: asked ? "selected" : "", disabled: busy || spent,
          "aria-pressed": String(asked), dataset: { test: "trpg-topic-" + topic.id },
          "aria-label": topic.label + (asked ? "。聞いた。もう一度聞く" : "。" + (topic.description || "")),
          onclick: () => {
            if (busy || overlay) return;
            const heard = session.ask(topic.id);
            audio.play(heard.fresh ? "clue" : "tap");
            if (heard.fresh) { clueFx?.cancel(); clueFx = playClueCard(root, { kicker: "聞いた話", title: heard.answer.title }); stageFx(clueFx); }
            talk(heard.answer.lines, () => renderBody(), "trpg-topic-" + topic.id);
          },
        }, [el("strong", { text: topic.label }), asked ? el("small", { text: "聞いた · " + (session.profile.answers[topic.id]?.title || "") }) : null].filter(Boolean));
      })),
    ]);
  }
  function twistChoices() {
    const field = session.flow.twist[0];
    return el("div.trpg-selection", { dataset: { field } }, [
      el("div.trpg-selection-title", el("h2", { text: presentation.twistTitle || presentation.fields[field] })),
      el("div.trpg-choice-cards", scenario.options[field].map(option => optionButton(field, option))),
    ]);
  }
  function servingChoices() {
    return el("div.trpg-selection", { dataset: { field: session.flow.serve[0] } }, [
      el("div.trpg-selection-title", el("h2", { text: presentation.serveTitle })),
      choiceTabs(Object.keys(session.snapshot().plan), false),
      el("div.trpg-choice-cards", scenario.options[session.flow.serve[0]].map(option => optionButton(session.flow.serve[0], option))),
    ]);
  }
  function modal(title, body, actions, { dismiss = true, wide = false, skin = "" } = {}) {
    if (overlay || disposed) return null;
    const previousFocus = document.activeElement;
    const box = el("section.trpg-modal", { role: "dialog", "aria-modal": "true", "aria-label": title, tabindex: "-1", class: [wide ? "trpg-modal-wide" : "", skin].filter(Boolean).join(" ") },
      [el("h2", { text: title }), el("div.trpg-modal-body", { tabindex: "0", role: "region", "aria-label": title + "の内容" }, body), el("div.trpg-modal-actions", actions)]);
    overlay = el("div.trpg-overlay", box);
    if (skin === "trpg-roll-stage") box.insertBefore(el("p.trpg-roll-context", { text: resourceText() }), box.firstChild);
    root.append(overlay);
    const close = () => {
      overlay?.remove(); overlay = null; modalCloser = null;
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true }); else root.focus({ preventScroll: true });
    };
    modalCloser = dismiss ? close : null;
    (box.querySelector("button:not(:disabled), input") || box).focus({ preventScroll: true });
    return { close, box };
  }
  function chooseHypothesis() {
    if (busy || overlay) return;
    let pop, fresh = false;
    const cards = el("div.trpg-choice-cards"), slot = el("span.trpg-search-slot");
    // じっくり調べる（TRF14）の結果で、違いそうな見立てに付箋が付く。付箋が付いても選ぶことはできる。
    const draw = () => {
      const search = session.snapshot().search;
      cards.dataset.fresh = String(fresh);
      cards.replaceChildren(...scenario.hypotheses.map((h, i) => {
        const art = tileStyle(atlas?.rows?.hypotheses, i), ruled = !!search?.ruled.includes(h.id);
        return el("button.trpg-button.trpg-object-choice", { type: "button",
          class: [art ? "" : "trpg-text-choice", ruled ? "trpg-hinted" : ""].filter(Boolean).join(" "),
          dataset: { test: "trpg-hypothesis-" + h.id, ruled: String(ruled) },
          "aria-label": h.label + "。" + h.description + (ruled ? "。じっくり調べた結果：違いそう" : ""),
          onclick: () => {
            if (!pop || busy) return;
            session.interpret(h.id); pop.close();
            // The table talks the guess over; a twist interrupts before the preparation when the scenario has one.
            const twistIntro = scenario.twist ? (scenario.twist.byProfile?.[session.profile.id] || scenario.twist.intro) : null;
            talk(sequence(h.discussion, twistIntro ? withCue(twistIntro, "twist") : scenario.preparation), () => renderBody());
          },
        }, [art ? el("span.trpg-object-art", { "aria-hidden": "true", style: art })
          : el("span.trpg-text-choice-mark", { "aria-hidden": "true", text: "ABC"[i] || "" }),
          el("strong.trpg-object-label", { text: h.label }), el("span.trpg-object-detail", { text: h.description }),
          ruled ? el("i.trpg-hint-mark", { "aria-hidden": "true", dataset: { test: "trpg-ruled-" + h.id }, text: "✕ 違いそう", title: "じっくり調べた結果" }) : null].filter(Boolean));
      }));
      slot.replaceChildren(searchControl(search, fresh, () => { fresh = true; draw(); pop?.box.focus({ preventScroll: true }); }));
    };
    draw();
    pop = modal(presentation.hypothesisTitle, el("div.trpg-hypothesis-board", [
      cards,
      el("details.trpg-evidence-fold", [el("summary", { text: "手がかりを見る (" + session.snapshot().clues.length + ")" }), el("div.trpg-notes-grid", noteCards())]),
    ]), [button("もう少し調べる", "trpg-hypothesis-back", () => pop.close()), slot], { wide: true, skin: "trpg-hypothesis-stage" });
  }
  /**
   * じっくり調べる（目星・TRF14）: 見立ての卓で一度だけ、自分の役の観察で 2d20。成功で2つ、ひと手間で1つ、違う見立てが分かる。
   * 振る前は札（押せる）、振った後は出目と結果の帯。決まりは「？」に書き、ここには能力と回数だけ出す。
   */
  function searchControl(search, fresh, rolled) {
    const { seat, base } = session.searchBase(), who = sheets[seat]?.name || name(seat);
    if (!search) {
      const odds = rollOdds(base);
      const node = button("", "trpg-search", () => {
        if (busy || disposed || session.snapshot().search) return;
        const result = session.search();
        syncResources(); keepMark(); audio.play("roll"); rolled();
        const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
          searchTimer = null;
          if (disposed) return;
          audio.play(result.special === "critical" || result.special === "fumble" ? result.special : result.grade);
          if (result.special === "critical" || result.special === "fumble") stageFx(impact(root, result.special));
        }, reduced ? 0 : 820);
      }, { class: "trpg-search", title: "成功で2つ、ひと手間で1つ、違いそうな見立てが分かる",
        "aria-label": "じっくり調べる。" + who + "の" + statLabel("eye") + "で判定。一度だけ。成功 約" + odds.success + "%で違う見立てが2つ、ひと手間 約" + odds.mixed + "%で1つ分かる" });
      node.append(el("strong", { text: "じっくり調べる", "aria-hidden": "true" }), el("small", { text: statLabel("eye") + " ＋" + base + " · 1回", "aria-hidden": "true" }));
      return node;
    }
    const label = search.special === "critical" ? SPECIALS.critical : search.special === "fumble" ? SPECIALS.fumble : SEARCH_LABELS[search.grade];
    return el("p.trpg-search-result", { role: "status", dataset: { test: "trpg-search-result", grade: search.grade, special: search.special || "", fresh: String(fresh) },
      "aria-label": "じっくり調べた。出目 " + search.dice.join(" と ") + "、" + statLabel("eye") + " ＋" + search.base + "、合計 " + search.total + "。" + label
        + "。" + (search.ruled.length ? "違いそうな見立てが" + search.ruled.length + "つ分かった" : "決め手は見つからなかった") }, [
      el("span.trpg-search-die", { text: String(search.dice[0]), "aria-hidden": "true" }), el("span.trpg-search-die", { text: String(search.dice[1]), "aria-hidden": "true" }),
      el("span.trpg-search-sum", { text: "＋" + search.base + " ＝ " + search.total, "aria-hidden": "true" }),
      el("strong", { text: label, "aria-hidden": "true" }),
      el("small", { text: search.ruled.length ? "✕ " + search.ruled.length + "つ" : "決め手なし", "aria-hidden": "true" }),
    ]);
  }
  // The die travels and casts its shadow; the body inside spins, so the shadow stays on the felt.
  function die(value, rolling = false) {
    return el("div.trpg-die.trpg-d20", { class: rolling ? "rolling" : "", role: "img", "aria-label": "20面ダイス " + value },
      el("span.trpg-die-body", { "aria-hidden": "true",
        html: '<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false"><polygon points="50,2 95,26 95,74 50,98 5,74 5,26"/><path d="M50 2 25 68 75 68 50 2M5 26 25 68 5 74M95 26 75 68 95 74M50 98 25 68M50 98 75 68M5 26 50 2 95 26"/></svg>' },
        el("span.trpg-d20-value", { text: String(value), "aria-hidden": "true" })));
  }
  function showFace(node, value) {
    node.setAttribute("aria-label", "20面ダイス " + value);
    node.querySelector(".trpg-d20-value").textContent = String(value);
  }
  /** The declared PC and stat, shown wherever a roll is explained. */
  function actorPanel(approach, { compact = false } = {}) {
    if (!approach) return null;
    const pc = sheets[approach.sheet || approach.actor], actor = approach.actor;
    const rating = pc?.stats?.[approach.stat];
    return el("div.trpg-roll-actor", { dataset: { test: "trpg-roll-actor", actor, npc: String(!!approach.npc) } }, [
      el("span.trpg-roll-actor-face", { "aria-hidden": "true" }, pcFace(approach.sheet || approach.actor, actor)),
      el("span.trpg-roll-actor-copy", [
        el("small", { text: (approach.npc ? GM_TITLE : name(actor)) + " · " + (pc?.name || "") }),
        el("strong", { text: pcText(approach.label) }),
        compact ? null : el("span.trpg-roll-actor-stat", { text: statLabel(approach.stat) + " ＋" + (Number.isInteger(rating) ? rating : DICE.base) }),
      ].filter(Boolean)),
    ]);
  }
  /** 聞き込みの案内文は「二つまで」と書いてある。最初の判定の成功で1つ増えた夜は、その数だけ読み替える（TRF02）。 */
  function interviewCopy(text) {
    const base = scenario.interview?.picks || 2, picks = session.interviewPicks(), kanji = ["", "一", "二", "三", "四", "五"];
    return picks === base || !kanji[base] || !kanji[picks] ? text || "" : String(text || "").replace(kanji[base] + "つ", kanji[picks] + "つ");
  }
  /** The GM names the stake before the dice (TRF02): what a success on this check buys. */
  function stakeLine(kind) {
    const prize = STAKES[rewardKindOf(scenario, kind)];
    if (!prize) return null;
    return el("p.trpg-stake", { dataset: { test: "trpg-stake", kind }, title: prize.long, "aria-label": prize.long }, [
      el("b", { text: "成功で", "aria-hidden": "true" }), el("span", { text: scenario.checks[kind].stake || prize.stake, "aria-hidden": "true" }),
    ]);
  }
  /** A real table asks who acts and how before any die is touched. */
  function openDeclaration(kind) {
    if (busy || overlay || session.snapshot().pending) return;
    const approaches = approachesOf(scenario, kind);
    if (!approaches.length) { openCheck(kind); return; }
    const check = scenario.checks[kind], state = session.snapshot();
    let pop;
    // Beginners can follow the "おすすめ" mark: the approach with the best odds (the first one on a tie).
    const oddsOf = approach => checkForecast(scenario, state, kind, { approach: approach.id, sheets }).odds.success;
    const bestId = approaches.reduce((best, a) => oddsOf(a) > oddsOf(best) ? a : best, approaches[0]).id;
    const cards = approaches.map(approach => {
      const pc = sheets[approach.sheet || approach.actor];
      const { base } = approachBase(scenario, kind, approach.id, sheets);
      const predicted = checkForecast(scenario, state, kind, { approach: approach.id, sheets }), odds = predicted.odds;
      // 見立ての加点（当たっている時だけ）がある判定は、札の見込みも幅で出す。判定の卓の数字と同じ。
      const successText = odds.success + (predicted.potentialBonus ? "〜" + predicted.bestOdds.success : "") + "%";
      const first = !state.acted[approach.actor] && !approach.npc;
      return el("button.trpg-button.trpg-approach", { type: "button", dataset: { test: "trpg-approach-" + approach.id, actor: approach.actor, best: String(approach.id === bestId) },
        title: pcText(approach.detail),
        "aria-label": pcText(approach.label) + "。" + pcText(approach.detail) + "。" + (approach.npc ? "GMが演じる" : name(approach.actor) + "の") + (pc?.name || "") + "、" + statLabel(approach.stat) + "＋" + base + (state.momentum ? "、勢い＋" + state.momentum * DICE.momentum : "") + "。成功 約" + successText + "、ひと手間 約" + odds.mixed + "%"
          + (approach.id === bestId ? "。おすすめ" : "") + (first ? "。この役の初めての見せ場で盛り上がり＋1" : ""),
        onclick: () => {
          if (!pop || busy) return;
          pop.close();
          talk(sequence(approach.declare), () => { renderBody(); openCheck(kind, approach.id); });
        },
      }, [
        el("span.trpg-approach-face", { "aria-hidden": "true", dataset: { costume: String(hasFigure(approach.sheet || approach.actor, approach.actor)) } }, pcFigure(approach.sheet || approach.actor, approach.actor)),
        el("span.trpg-approach-copy", [
          el("small", { text: (approach.npc ? GM_TITLE : name(approach.actor)) + " · " + (pc?.name || "") }),
          el("strong", { text: pcText(approach.label) }),
        ]),
        el("span.trpg-approach-meta", [
          el("b", { text: statLabel(approach.stat) + " ＋" + base, dataset: { stat: approach.stat } }),
          // 見込みは帯で見せる（金＝成功・緑＝ひと手間・残り＝思わぬ出来事）。数字は成功だけ。
          el("span.trpg-odds-bar", { "aria-hidden": "true", dataset: { test: "trpg-approach-odds" }, style: { "--success": odds.success + "%", "--mixed": odds.mixed + "%" } }),
          el("small", { text: "成功 " + successText, dataset: { test: "trpg-approach-success" } }),
          approach.id === bestId ? el("i.trpg-approach-best", { text: "おすすめ", title: "いちばん成功しやすい", dataset: { test: "trpg-approach-best" } }) : null,
          first ? el("i.trpg-approach-first", { text: "見せ場 ＋1", title: "この役が初めて前に出る。盛り上がり＋1" }) : null,
        ].filter(Boolean)),
      ]);
    });
    pop = modal(presentation.declareTitle || "どうする？", el("div.trpg-declare-board", [
      el("div.trpg-declare-prompt", [el("strong", { text: check.title }), stakeLine(kind),
        state.momentum ? el("span.trpg-declare-momentum", { dataset: { test: "trpg-declare-momentum" }, title: "盛り上がりの勢い。次の判定に加わる。札の見込みに込み",
          text: "勢い ＋" + state.momentum * DICE.momentum + " 込み" }) : null,
        helpToggle("宣言のしかた", "trpg-declare-help", [
        el("span", { text: presentation.declareHint || "" }),
        el("span.trpg-declare-rule", { text: presentation.target || ("目標値" + DICE.success) }),
        el("span.trpg-declare-rule", { text: "20の目が出たらクリティカル。必ず成功" }),
        el("span", { text: "帯は見込み：金＝成功、緑＝ひと手間。「おすすめ」はいちばん成功しやすい行動。「見せ場 ＋1」はその役が初めて前に出る時で、盛り上がりが1上がる（自分の役も、仲間の役も）。" }),
        ...(STAKES[rewardKindOf(scenario, kind)] ? [el("span", { text: "「成功で ○○」は、成功した時のごほうび。" + STAKES[rewardKindOf(scenario, kind)].long + "。" })] : []),
      ])].filter(Boolean)),
      el("div.trpg-approach-list", cards),
    ]), [button("卓に戻る", "trpg-declare-back", () => pop.close())], { wide: true, skin: "trpg-declare-stage" });
  }
  function openCheck(kind, approachId = null) {
    if (busy || overlay || session.snapshot().pending) return;
    const check = scenario.checks[kind], helper = check.helper || null;
    const declared = approachBase(scenario, kind, approachId, sheets).approach;
    // 成功の見込みは、いま実際に効く補正（能力・選んだ切り札・勢い）を込みで、いつも見える所に出す（#3199・TRF23）。
    // 見立ての加点は当たっている時だけ効き、正誤は振るまで分からないので「約A〜B%」の幅で出す。
    const live = el("div.trpg-roll-odds", { dataset: { test: "trpg-roll-odds" }, role: "status" });
    const body = el("div", [el("p.trpg-roll-instruction", { text: DICE.success + "以上で成功" }), stakeLine(kind), actorPanel(declared), el("div.trpg-roll-scene",
      el("div.trpg-dice-row", [die(1), die(1), el("span.trpg-dice-bonus", { text: "＋" + DICE.base, dataset: { test: "trpg-bonus" } })])), live].filter(Boolean));
    const forecast = el("div.trpg-forecast", { dataset: { test: "trpg-forecast" }, "aria-live": "polite" });
    function updateForecast() {
      const predicted = checkForecast(scenario, session.snapshot(), kind, { support: !!support?.checked, approach: declared?.id || null, sheets });
      body.querySelector(".trpg-dice-bonus").textContent = "＋" + predicted.baseBonus;
      const span = grade => "約" + Math.min(predicted.odds[grade], predicted.bestOdds[grade])
        + (predicted.potentialBonus ? "〜" + Math.max(predicted.odds[grade], predicted.bestOdds[grade]) : "") + "%";
      const parts = [
        [declared ? declared.stat : "base", (declared ? statLabel(declared.stat) : "基本") + " ＋" + predicted.base],
        support?.checked ? ["support", "助力 ＋" + DICE.support] : null,
        predicted.momentum ? ["momentum", "勢い ＋" + predicted.momentum * DICE.momentum] : null,
        predicted.potentialBonus ? ["hypothesis", "見立てが合えば ＋" + predicted.potentialBonus] : null,
      ].filter(Boolean);
      live.dataset.bonus = String(predicted.baseBonus);
      live.setAttribute("aria-label", "成功の見込み " + span("success") + "、ひと手間 " + span("mixed") + "。補正込み: " + parts.map(part => part[1]).join("、"));
      live.replaceChildren(
        el("span.trpg-odds-bar", { "aria-hidden": "true", style: { "--success": predicted.odds.success + "%", "--mixed": predicted.odds.mixed + "%" } }),
        el("strong", { text: "成功 " + span("success"), dataset: { test: "trpg-roll-odds-success" } }),
        el("span", { text: "ひと手間 " + span("mixed"), dataset: { test: "trpg-roll-odds-mixed" } }),
        el("small", { "aria-hidden": "true" }, [el("b", { text: "補正込み" }), ...parts.map(([part, text]) => el("i", { text, dataset: { part } }))]),
      );
      forecast.replaceChildren(el("div.trpg-forecast-head", [
        el("strong", { text: "この判定の見通し" }), el("small", { text: "2d20 ＋ " + (declared ? statLabel(declared.stat) : "基本") + predicted.base + (support?.checked ? " ＋ 助力" + DICE.support : "") + (predicted.momentum ? " ＋ 勢い" + predicted.momentum * DICE.momentum : "") }),
      ]), el("div.trpg-odds", [
        ["success", "30以上", "うまくいく"], ["mixed", "19〜29", "ひと手間"], ["trouble", "18以下", "思わぬ出来事"],
      ].map(([grade, threshold, label]) => el("div", { dataset: { grade } }, [
        el("strong", { text: "約" + Math.min(predicted.odds[grade], predicted.bestOdds[grade])
          + (predicted.potentialBonus ? "〜" + Math.max(predicted.odds[grade], predicted.bestOdds[grade]) : "") + "%",
          dataset: { test: "trpg-odds-" + grade } }),
        el("span", { text: label }), el("small", { text: threshold }),
      ]))), el("p", { text: predicted.potentialBonus
        ? "見立てが合っていれば、さらに＋" + predicted.potentialBonus + "。正誤は振ったあとに分かります。"
        : "20の目が出たら必ず成功（クリティカル）。どの出目でも物語は続きます。" }));
      if (check.hint) forecast.prepend(el("p.trpg-forecast-hint", { text: check.hint }));
    }
    const support = helper && !session.snapshot().used[helper] && session.snapshot().teamwork > 0
      ? el("input", { type: "checkbox", dataset: { test: "trpg-support-" + helper } }) : null;
    if (support) body.append(el("label.trpg-aid", [support, seatMark(helper),
      el("span.trpg-aid-art", { "aria-hidden": "true" }, el("img", { src: portrait(helper), alt: "", style: circleStyle(helper, 150, 6) })), el("span", [
      el("strong", { text: name(helper) + "の「" + cast[helper].ability + "」" }),
      el("small", { text: "＋" + DICE.support + " · 連携札1枚" }),
    ])]));
    if (support) support.addEventListener("change", () => { if (support.checked) audio.play("card"); updateForecast(); });
    if (helper && !support) body.append(el("p.trpg-aid-spent", { text: name(helper) + "の切り札は使えない" }));
    // 「判定の詳細」を開いた内訳は、ダイストレイの位置に重ねて出す（下へ伸ばすと「サイコロを振る」の下へ切れて、
    // スクロールしないと読めなかった・#3199）。位置と大きさはトレイを測って渡すので、PCでもスマホでも、札が増えても合う。
    const details = el("details.trpg-roll-details", { dataset: { test: "trpg-roll-details" } }, [
      el("summary", { text: "判定の詳細", dataset: { test: "trpg-details-toggle" } }), forecast,
    ]);
    const placeForecast = () => {
      const tray = body.querySelector(".trpg-roll-scene");
      if (!tray || !Number.isFinite(tray.offsetTop) || !tray.offsetHeight) return;
      for (const [key, value] of [["top", tray.offsetTop - details.offsetTop], ["left", tray.offsetLeft - details.offsetLeft], ["width", tray.offsetWidth], ["height", tray.offsetHeight]]) {
        details.style.setProperty("--tray-" + key, value + "px");
      }
      // 内訳が覆ってよいのは、トレイと見込みの行（同じ数字）まで。切り札の札や見出しには被せない。
      // 文まで入れると収まらない大きさの画面では、数字だけにする。
      const room = live.offsetTop + live.offsetHeight - tray.offsetTop;
      details.style.setProperty("--tray-room", room + "px");
      details.dataset.placed = "true";
      details.dataset.tight = "false";
      if (details.open) details.dataset.tight = String(forecast.scrollHeight > room);
    };
    details.addEventListener("toggle", placeForecast);
    if (typeof ResizeObserver === "function") new ResizeObserver(placeForecast).observe(body);
    body.append(details); updateForecast();
    let pop;
    const roll = button("サイコロを振る", "trpg-roll", () => {
      if (session.snapshot().pending) return;
      const result = session.beginCheck(kind, { support: !!support?.checked, approach: declared?.id || null });
      syncResources();
      pop.box.dataset.rollState = "rolling";
      roll.disabled = true;
      modalCloser = null;
      pop.box.querySelectorAll("input,button").forEach(n => { n.disabled = true; });
      pop.box.focus({ preventScroll: true });
      const thrown = [die(1, true), die(1, true)];
      thrown.forEach((node, i) => { node.dataset.throw = "ab"[i]; });
      body.querySelector(".trpg-dice-row").replaceChildren(...thrown, el("span.trpg-dice-bonus", { text: "＋" + result.bonus }));
      settleGuard = false;
      audio.play("roll");
      const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!reduced) {
        // Faces tumble while the dice are in the air, then each stops on its real value as it lands.
        const started = Date.now(), landing = [780, 850];
        rollTicker = setInterval(() => {
          const t = Date.now() - started;
          thrown.forEach((node, i) => showFace(node, t >= landing[i] ? result.dice[i] : Math.floor(Math.random() * DICE.sides) + 1));
        }, 70);
      }
      timer = setTimeout(() => {
        timer = null; clearInterval(rollTicker); rollTicker = null;
        if (!disposed) showRollResult(pop, body);
      }, reduced ? 40 : 1050);
    }, { class: "primary" });
    pop = modal(check.title, body, [button("卓に戻る", "trpg-check-back", () => pop.close()), roll], { skin: "trpg-roll-stage" });
    // スマホでは判定の決まりの一文を題の行の右へ出す（本文の一文は隠す）。右の列で切り札の札を押し下げないため（TRF03）。
    pop.box.querySelector("h2").append(el("small.trpg-roll-rule", { text: DICE.success + "以上で成功" }));
    pop.box.append(el("div.trpg-spare-kit", { "aria-hidden": "true", role: "presentation" }));
  }
  function showRollResult(pop, body, rerolledDie = null) {
    const result = session.checkResult();
    syncResources();
    pop.box.dataset.rollState = "settled";
    pop.box.dataset.grade = result.grade;
    const prize = STAKES[rewardKindOf(scenario, result.kind)];
    const near = nearMissOf(result);
    // 結果の卓は、出目・合計・評価だけを大きく。あと1〜2の惜しい出目は評価の横に出す（TRF03）。
    body.replaceChildren(
      el("div.trpg-roll-scene", el("div.trpg-dice-row", [die(result.dice[0]), die(result.dice[1]), el("span.trpg-dice-bonus", { text: "＋" + result.bonus })])),
      el("div.trpg-dice-total", { role: "status", dataset: { test: "trpg-roll-total", grade: result.grade } }, [
        el("small.trpg-roll-equation", { text: result.dice[0] + " ＋ " + result.dice[1] + " ＋ 補正" + result.bonus + " ＝" }),
        el("strong", { text: "合計 " + result.total }), el("span.trpg-dice-grade", { text: LABELS[result.grade] }),
        near ? el("em.trpg-dice-near", { dataset: { test: "trpg-roll-near" }, text: "あと" + near + "……！" }) : null,
      ].filter(Boolean)),
      rollGauge(result),
    );
    if (result.special === "critical" || result.special === "fumble") stageFx(impact(root, result.special));
    pop.box.dataset.special = result.special || "";
    if (result.special) body.append(el("p.trpg-roll-special", { dataset: { test: "trpg-roll-special", special: result.special } }, [
      el("strong", { text: SPECIALS[result.special] }),
      result.special === "critical" && session.snapshot().teamwork < 2 ? el("span", { text: "連携札 ＋1" }) : null,
    ].filter(Boolean)));
    if (result.grade === "success" && prize) body.append(el("p.trpg-roll-reward", { dataset: { test: "trpg-roll-reward", kind: rewardKindOf(scenario, result.kind) }, title: prize.long },
      [el("b", { text: "ごほうび" }), el("span", { text: scenario.checks[result.kind].stake || prize.stake })]));
    // 補正の内訳（誰が・勢い・助力・振り直し）は1行に並べる。縦に積むと振り直しの札が卓の外へ押し出される。
    const receipts = el("div.trpg-roll-receipts");
    body.append(receipts);
    if (result.approach) {
      const pc = sheets[result.sheet], actorText = (result.actor && cast[result.actor] ? name(result.actor) : GM_TITLE) + (pc ? "の" + pc.name : "");
      receipts.append(el("p.trpg-ability-receipt.trpg-actor-receipt", { dataset: { test: "trpg-actor-receipt" }, title: actorText },
        [(pc?.name || actorText) + " · " + statLabel(result.stat) + " ＋" + result.base]));
    }
    if (result.momentum) receipts.append(el("p.trpg-ability-receipt.trpg-momentum-receipt", { text: "勢い ＋" + result.momentum * DICE.momentum }));
    if (result.helper) receipts.append(el("p.trpg-ability-receipt", { dataset: { test: "trpg-helper-receipt" } },
      [seatMark(result.helper), name(result.helper) + " ＋" + DICE.support]));
    if (result.rerolled) {
      receipts.append(el("p.trpg-ability-receipt", { dataset: { test: "trpg-reroll-receipt" } },
        [seatMark(session.rerollActor), name(session.rerollActor) + "の振り直し"]));
      if (rerolledDie !== null) {
        const target = body.querySelectorAll(".trpg-die")[rerolledDie];
        target.classList.add("rethrown");
        const marked = el("div.trpg-rerolled-die");
        target.replaceWith(marked);
        marked.append(target, el("span.trpg-reroll-stamp", [seatMark(session.rerollActor), "振り直し"]));
      }
    }
    const oldFx = pop.box.querySelector(".trpg-roll-fx"); oldFx?.remove();
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduced) {
      const fx = el("div.trpg-roll-fx", { "aria-hidden": "true" }, Array.from({ length: result.grade === "success" ? 22 : 10 }, (_, i) =>
        el("i", { style: { "--angle": i * 137.5 + "deg", "--distance": 90 + i % 5 * 22 + "px", "--delay": i % 3 * 20 + "ms" } })));
      pop.box.append(fx);
    }
    // クリティカル（20の目）とファンブル（1の目で思わぬ出来事）は専用のジングル。
    audio.play(result.special === "critical" || result.special === "fumble" ? result.special : result.grade);
    if (result.hypothesisBonus) receipts.append(el("p.trpg-ability-receipt.trpg-roll-insight", { text: "見立て的中 ＋" + result.hypothesisBonus }));
    if (session.rules.inspectionPressure) receipts.append(el("p.trpg-ability-receipt.trpg-roll-consequence", { text: RISK + (result.grade === "success" ? " ±0" : " ＋" + session.rules.checkPressure[result.grade]) }));
    // クリティカルは最高の出目なので振り直しは出さない。使えない時も何も出さない（決まりは「？」に）。
    if (result.special !== "critical" && !session.snapshot().used[session.rerollActor] && session.snapshot().teamwork > 0) {
      body.append(el("p.trpg-roll-trump", { text: name(session.rerollActor) + "の「" + cast[session.rerollActor].ability + "」 · 連携札1枚" }));
      body.append(el("div.trpg-rerolls", [0, 1].map(i =>
      button("", "trpg-reroll-" + i, () => {
        if (settleGuard || session.snapshot().used[session.rerollActor] || session.snapshot().teamwork < 1) return;
        audio.play("rethrow");
        session.reroll(i); showRollResult(pop, body, i);
      }, { class: "trpg-reroll-choice" }))));
      body.querySelectorAll(".trpg-reroll-choice").forEach((node, i) => node.append(
        seatMark(session.rerollActor),
        el("strong", { text: (i + 1) + "個目（" + result.dice[i] + "）を振り直す" }),
        el("small", { text: rerollText(rerollOdds(result.dice, result.bonus, i)) }),
      ));
    }
    const actions = pop.box.querySelector(".trpg-modal-actions");
    actions.replaceChildren(button("物語を続ける", "trpg-settle", () => {
      if (settleGuard || disposed) return;
      settleGuard = true;
      const settled = session.settleCheck(); pop.close();
      const continuation = () => {
        if (settled.kind === "listen") {
          renderBody(); idle(scenario.interview ? interviewCopy(presentation.interviewIdle) || presentation.exploreIdle : presentation.exploreIdle);
        } else if (settled.kind === "twist") {
          talk(scenario.preparation, () => renderBody());
        } else if (settled.kind === "prepare") {
          talk(scenario.serving, () => renderBody());
        } else {
          const result = session.result(), ending = scenario.endings[result.ending];
          // A companion who brought a role against type (S17) says one line in that role before the ending,
          // and one line as themselves after the epilogue. Other roles have neither, so nothing is added.
          const own = key => Object.values(session.companions).map(o => o[key]);
          audio.play("ending");
          talk(sequence(...own("aside"), withCue(ending.dialogue, "ending"), scenario.debrief?.[result.variant], scenario.epilogue, ...own("after")), () => {
            completed = result;
            // 本編の卓は、今夜の卓で部の実績がどれだけ増えたかを返す（TRF13）。試遊の卓は何も返さない。
            clubGained = onComplete(result)?.club || null;
            renderBody();
          });
        }
      };
      const responses = (session.flow[settled.kind] || []).map(field =>
        scenario.options[field].find(o => o.id === session.snapshot().plan[field])?.response);
      // 卓の掛け合い: 出目の出来事（クリティカル・ファンブル・ゾロ目・あと少し）は先に、ごほうびの一言は場面の描写のあとに。
      const tableLines = key => { const lines = tableTalk?.["trpg_talk_" + gm + "_" + key]; return lines?.every(line => cast[line.speaker]) ? lines : []; };
      const chatter = settled.special ? tableLines(settled.special === "critical" && !settled.inspired ? "critical_full" : settled.special)
        : settled.near ? tableLines("near" + settled.near) : [];
      const rewarded = settled.reward ? tableLines("reward_" + settled.reward.type) : [];
      talk(sequence(chatter, ...responses, scenario.checks[settled.kind][settled.grade], rewarded), continuation);
      // 判定の結果のカットイン（TRF09）: 動いた役の姿と結果が、場面を横切ってから物語が続く。
      const acted = settled.approach ? approachesOf(scenario, settled.kind).find(a => a.id === settled.approach) : null;
      if (acted) {
        const seat = acted.sheet || acted.actor;
        stageFx(playResultCut(root, { figure: pcFigure(seat, acted.actor), who: sheets[seat]?.name || name(acted.actor), how: statLabel(acted.stat),
          label: settled.special === "critical" ? "クリティカル！" : settled.special === "fumble" ? "ファンブル……" : LABELS[settled.grade] + (settled.grade === "success" ? "！" : ""),
          grade: settled.grade, special: settled.special || "" }));
      }
    }, { class: "primary" }));
    actions.querySelector("button").focus({ preventScroll: true });
  }
  /**
   * 目標までの距離を見せる帯（TRF09）: 左が思わぬ出来事、中がひと手間、右が成功。出目の合計の位置まで印が走り、
   * 止まった所の色が結果。20の目（クリティカル）は、合計が届かなくても成功の側まで跳ぶ。
   */
  function rollGauge(result) {
    const lo = 2 + result.bonus, hi = 2 * DICE.sides + result.bonus, span = hi - lo;
    const at = value => Math.max(0, Math.min(100, (value - lo) / span * 100));
    const shown = result.special === "critical" ? Math.max(result.total, DICE.success + 2) : result.total;
    return el("div.trpg-roll-gauge", { "aria-hidden": "true", dataset: { grade: result.grade, special: result.special || "" },
      style: { "--mixed-at": at(DICE.mixed) + "%", "--success-at": at(DICE.success) + "%", "--mark-at": at(shown) + "%" } }, [
      el("span.trpg-roll-gauge-track"), el("b.trpg-roll-gauge-goal", { text: String(DICE.success) }), el("i.trpg-roll-gauge-mark"),
    ]);
  }
  function rerollText(odds) {
    return odds.success ? "成功 約" + odds.success + "%" : "ひと手間以上 約" + (odds.mixed) + "%";
  }
  function stars(rating) {
    return el("span.trpg-stars", { "aria-label": "卓の評価 星" + rating.stars + "つ", dataset: { test: "trpg-stars", stars: String(rating.stars) } },
      [0, 1, 2].map(i => el("i", { text: i < rating.stars ? "★" : "☆", class: i < rating.stars ? "lit" : "", "aria-hidden": "true" })));
  }
  function openNotes() {
    let pop;
    pop = modal("調査メモを読み比べる", [
      el("p.trpg-modal-intro", { text: "何を見て、何に気づいた？ メモの再読は調査回数も危機も使いません。" }),
      el("div.trpg-notes-grid", noteCards()),
    ], [button("卓に戻る", "trpg-notes-close", () => pop.close(), { class: "primary" })], { wide: true, skin: "trpg-notes-stage" });
  }
  function noteCards() {
    const { clues, asked } = session.snapshot();
    if (!clues.length && !asked.length) return [el("p", { text: "部屋を調べると、ここに手がかりが残ります。" })];
    return [...clues.map((id, i) => {
      const e = session.profile.evidence[id];
      return el("article.trpg-note-card", [
        el("small", { text: String(i + 1).padStart(2, "0") + " / " + scenario.spots.find(s => s.id === id).label }),
        el("h3", { text: e.title }), el("p", { text: e.text }),
      ]);
    }), ...asked.map(id => {
      const a = session.profile.answers[id];
      return el("article.trpg-note-card", { dataset: { kind: "talk" } }, [
        el("small", { text: "話して · " + scenario.interview.topics.find(t => t.id === id).label }),
        el("h3", { text: a.title }), el("p", { text: a.text }),
      ]);
    })];
  }
  function openRecap() {
    if (busy || !completed) return;
    const result = session.result(), state = session.snapshot();
    const hypothesis = scenario.hypotheses.find(h => h.id === result.hypothesis);
    let pop;
    pop = modal("この卓の記録", [
      el("div.trpg-recap-heading", [el("small", { text: scenario.title }),
        el("h3", { text: scenario.endings[result.ending].title }),
        el("p", { text: "手がかり " + result.clues.length + "個 · 判定 " + result.checks.length + "回 · 使った連携札 " + Object.values(state.used).filter(Boolean).length + "枚 · " + result.heat.night + "（盛り上がり " + result.heat.value + "/" + result.heat.max + "）" })]),
      el("section.trpg-recap-rating", { dataset: { test: "trpg-recap-rating" } }, [
        el("h3", [el("span", { text: "卓の評価 · " + result.rating.title + " " }), stars(result.rating)]),
        el("ul", STAR_MARKS.map(([key, label, detail]) => el("li", { dataset: { lit: String(result.rating.marks[key]) } }, [
          el("strong", { text: (result.rating.marks[key] ? "★ " : "☆ ") + label }),
          el("span", { text: key === "insight" ? "見立て「" + hypothesis.label + "」 · " + (result.rating.marks.insight ? "的中" : "真相は別にあった")
            : key === "plan" ? (result.rating.marks.plan ? detail : "別の結末へ。手がかりを読み直すと、もう一つの扉がある")
            : "成功 " + result.checks.filter(c => c.grade === "success").length + "/" + result.checks.length + (result.rating.marks.dice ? " · " + detail : "") }),
        ]))),
      ]),
      el("div.trpg-recap-grid", [
        el("section", [el("h3", { text: "みんなで選んだこと" }),
          el("p.trpg-recap-hypothesis", { text: "見立て：" + hypothesis.label }), planSummary()]),
        el("section", [el("h3", { text: "サイコロが作った展開" }),
          ...result.checks.flatMap((check, i) => [el("article.trpg-recap-check", { dataset: { grade: check.grade } }, [
            el("strong", { text: scenario.checks[check.kind].title }),
            check.approach ? el("em", { text: (sheets[check.sheet]?.name || "") + (check.actor && cast[check.actor] ? "（" + name(check.actor) + "）" : "") + " · " + pcText(approachesOf(scenario, check.kind).find(a => a.id === check.approach)?.label || "") + " · " + statLabel(check.stat) + "＋" + check.base }) : null,
            el("span", { text: check.dice.join(" ＋ ") + " ＋ 補正" + check.bonus + " ＝ " + check.total + " · " + LABELS[check.grade] }),
            el("small", { text: [check.helper ? name(check.helper) + "の助力" : "",
              check.rerolled ? name(session.rerollActor) + "の振り直し" : "", check.hypothesisBonus ? "見立て＋" + check.hypothesisBonus : "",
              check.special ? SPECIALS[check.special] + (check.inspired ? "連携札＋1" : "") : "", check.near ? "あと" + check.near : "",
              check.reward ? "ごほうび：" + ({ question: "質問＋1", hint: "GMのヒント", finale: "会心のクライマックス" }[check.reward.type] || "") : ""].filter(Boolean).join(" · ") || "基本の判定" }),
          ]), i === 0 && result.search ? el("article.trpg-recap-check", { dataset: { grade: result.search.grade, test: "trpg-recap-search" } }, [
            el("strong", { text: "じっくり調べる" }),
            el("em", { text: (sheets[result.search.seat]?.name || "") + " · " + statLabel("eye") + "＋" + result.search.base }),
            el("span", { text: result.search.dice.join(" ＋ ") + " ＋ 補正" + result.search.bonus + " ＝ " + result.search.total + " · " + LABELS[result.search.grade] }),
            el("small", { text: result.search.ruled.length ? "違いそうな見立てが" + result.search.ruled.length + "つ分かった" : "決め手は見つからなかった" }),
          ]) : null].filter(Boolean)),
        ]),
      ]),
      el("p.trpg-recap-rule", { text: "選んだ提案が結末を、サイコロがそこまでの出来事と手がかりを作りました。" }),
      el("h3", { text: "物語の途中で見つけたもの" }), el("div.trpg-notes-grid", noteCards()),
    ], [button("結末に戻る", "trpg-recap-close", () => pop.close(), { class: "primary" })], { wide: true });
  }
  /** The shopkeeper explains the table to first-timers, with a small diagram for each idea. */
  function playTutorial() {
    if (busy || overlay || !tutorialLines?.length || session.snapshot().phase !== "cover") return;
    talk(tutorialLines, () => {
      renderBody(); onTutorialDone();
    }, scenario.builder ? "trpg-build" : "trpg-start");
  }
  let panelNode = null, panelKind = null;
  function showPanel(kind) {
    if (kind === panelKind) return;
    panelNode?.remove(); panelNode = null; panelKind = kind;
    const build = kind && PANELS[kind];
    if (!build) return;
    panelNode = el("figure.trpg-tutorial-panel", { dataset: { panel: kind, test: "trpg-tutorial-panel" }, "aria-hidden": "true" }, build());
    root.append(panelNode);
  }
  const PANELS = {
    welcome: () => [el("strong.trpg-tutorial-big", { text: "TRPG" }), el("span", { text: "＝ みんなで物語を作る、ルールのあるごっこ遊び" }),
      el("div.trpg-tutorial-row", [el("i", { text: "話す" }), el("i", { text: "選ぶ" }), el("i", { text: "サイコロ" }), el("i", { text: "物語が進む" })])],
    table: () => [el("div.trpg-tutorial-seats", scenario.cast.map(c => el("div", { dataset: { part: c.part === "GM" ? "gm" : "pl" } }, [
      el("span.trpg-tutorial-face", el("img", { src: portrait(c.id), alt: "", style: circleStyle(c.id, 150, 6) })),
      el("b", { text: c.part === "GM" ? "GM" : "PL" }), el("small", { text: name(c.id) })]))),
      el("p", { text: "GM＝ゲームマスター。お話を進める語り手 · PL＝役を演じて遊ぶ人" })],
    sheet: () => {
      const me = sheets[PLAYER_SEAT];
      return me ? [el("div.trpg-tutorial-sheet", [el("strong", { text: "PC ＝ " + me.name }), el("small", { text: me.title || "" }),
        el("dl", STATS.flatMap(k => [el("dt", { text: statLabel(k) }), el("dd", [el("i", Array.from({ length: 5 }, (_, i) => el("b", { class: i < me.stats[k] ? "lit" : "" }))),
          el("small", { text: (scenario.builder?.statHelp?.[k] || "").split("。")[0] })])]))])] : [];
    },
    declare: () => [el("strong", { text: "どうする？" }), el("div.trpg-tutorial-row.trpg-tutorial-cards", [
      el("i", { text: "話しかける · 話術" }), el("i", { class: "best", text: "様子を見る · 観察  おすすめ" }), el("i", { text: "準備する · 手際" })]),
      el("p", { text: "誰が、何をするかを選ぶだけ。数字が大きい能力ほど成功しやすい" })],
    roll: () => [el("div.trpg-tutorial-row.trpg-tutorial-dice", [el("b", { text: "14" }), el("span", { text: "＋" }), el("b", { text: "12" }),
      el("span", { text: "＋ 能力 4 ＝" }), el("strong", { text: "30" })]), el("p", { text: "30以上で成功 · 19〜29でひと手間 · 18以下は思わぬ出来事" }),
      el("p", { text: "20の目が出たらクリティカル＝必ず成功 · 成功にはごほうび" })],
    aid: () => [el("div.trpg-tutorial-row", [el("i", { text: "連携札 2枚" }), el("i", { class: "best", text: "仲間の切り札 ＋" + DICE.support }), el("i", { text: "あなたの切り札 振り直し" })]),
      el("p", { text: "切り札は一人一度。使うたび、みんなの連携札を1枚使う" })],
    fail: () => [el("div.trpg-tutorial-row", [el("i", { text: "うまくいった" }), el("i", { text: "ひと手間かかる" }), el("i", { text: "思わぬ出来事" })]),
      el("p", { text: "どれでも物語は続く。失敗も、卓の楽しみ" })],
    build: () => [el("strong", { text: "あなたの役を作ろう" }), el("p", { text: "表紙の「キャラクターを作る」で、役どころを選ぶ。迷ったら、おすすめのままでOK" })],
  };
  /** 成長点の札（TRF13）: 部のランクで、はじめの役の能力が上がっている。 */
  function growthChip() {
    return session.growth ? el("i.trpg-growth-chip", { dataset: { test: "trpg-growth" }, text: "成長点 ＋" + session.growth, title: "部のランクで、はじめの役の能力が上がっている" }) : null;
  }
  /** The player's character on the cover: who you will play tonight, and the door to remake them. */
  function pcCard() {
    const me = session.pc;
    return el("div.trpg-cover-pc", { dataset: { test: "trpg-cover-pc" } }, [
      el("span.trpg-cover-pc-face", { "aria-hidden": "true", dataset: { costume: String(hasFigure(me.seat, PLAYER_SEAT)) } }, pcFigure(me.seat, PLAYER_SEAT)),
      el("div.trpg-cover-pc-copy", [
        el("small", { text: name(PLAYER_SEAT) + " が演じる" }),
        el("strong", { text: me.name, dataset: { test: "trpg-cover-pc-name" } }), el("span", { text: me.title }), growthChip(),
      ].filter(Boolean)),
      button("キャラクターを作る", "trpg-build", openBuilder, { class: "small" }),
    ]);
  }
  /** Character creation: an origin preset, a name and a point-buy of the four stats. The look is the player's own (#3050). */
  function openBuilder() {
    if (busy || overlay || session.snapshot().phase !== "cover") return;
    const builder = scenario.builder;
    if (!builder) return;
    const me = session.pc;
    const draft = { archetype: me.archetype, name: me.name, stats: { ...me.stats } };
    // Beginners pick a role and a name; free point-buy waits behind "自分で振る".
    let advanced = false, explain = false;
    const usedIn = key => [...new Set(Object.values(scenario.checks).filter(check => (check.approaches || [])
      .some(a => (a.sheet || a.actor) === PLAYER_SEAT && a.stat === key)).map(check => check.title))];
    const strengths = stats => STATS.slice().sort((a, b) => stats[b] - stats[a]).slice(0, 2).map(statLabel).join("・");
    const board = el("div.trpg-builder", { dataset: { test: "trpg-builder" } });
    let pop;
    const preset = () => builder.archetypes.find(a => a.id === draft.archetype);
    const spent = () => STATS.reduce((n, key) => n + draft.stats[key], 0);
    const refocus = test => { const node = pop?.box.querySelector('[data-test="' + test + '"]'); if (node && !node.disabled) node.focus({ preventScroll: true }); };
    function render(focusTest = null) {
      // 成長点（TRF13）: 部のランクの分だけ、振れる点が多い。役どころのままなら、いちばん得意な能力に足されている。
      const budget = builder.points + session.growth, left = budget - spent();
      // 能力の説明・計算の一言は「？」を押した時だけ（#2719）。数字と点の残りはいつも見える。
      board.dataset.help = explain ? "open" : "closed";
      board.replaceChildren(
        el("section.trpg-builder-origins", [el("h3", { text: "出自" }),
          el("div.trpg-builder-origin-list", builder.archetypes.map(a => el("button.trpg-button.trpg-builder-origin", { type: "button",
            class: draft.archetype === a.id ? "selected" : "", "aria-pressed": String(draft.archetype === a.id),
            "aria-label": a.title + "、" + a.name + "。" + a.trait, dataset: { test: "trpg-archetype-" + a.id },
            onclick: () => {
              draft.archetype = a.id; draft.stats = grownStats(builder, a.stats, session.growth);
              draft.name = a.name;
              audio.play("tap"); render("trpg-archetype-" + a.id);
            },
          }, [costumeUrl(scenario.id, PLAYER_SEAT, a.id) ? el("span.trpg-builder-origin-art", { "aria-hidden": "true" }, pcFigure(PLAYER_SEAT, PLAYER_SEAT, { role: a.id })) : null,
            el("strong", { text: a.title + " " + a.name }), a.recommended ? el("em.trpg-builder-recommend", { text: "はじめてならこれ" }) : null,
            el("span", { text: "得意 " + strengths(a.stats) }),
            el("small", { text: a.trait })].filter(Boolean))))]),
        el("section.trpg-builder-stats", [
          el("div.trpg-builder-head", [el("h3", { text: preset().name + "の能力", dataset: { test: "trpg-pc-name" } }),
            button("？", "trpg-builder-help", () => { explain = !explain; render("trpg-builder-help"); },
              { class: "small trpg-help-button", title: "能力の説明", "aria-label": "能力の説明", "aria-pressed": String(explain) })]),
          advanced ? el("p.trpg-builder-points", { dataset: { test: "trpg-stat-points", left: String(left) }, "aria-live": "polite" },
            [el("strong", { text: "残り " + left + " 点" }), el("span", { text: " · 合計 " + budget + " 点、各 " + builder.min + "〜" + builder.max }), growthChip()].filter(Boolean))
            : el("p.trpg-builder-easy", ["能力は、選んだ役どころで決まります。数字が大きいほど得意", growthChip()].filter(Boolean)),
          button(advanced ? "役どころのおすすめに戻す" : "能力を自分で振る（慣れてきたら）", "trpg-builder-advanced", () => {
            advanced = !advanced;
            if (!advanced) draft.stats = grownStats(builder, preset().stats, session.growth);
            render("trpg-builder-advanced");
          }, { class: "small trpg-builder-mode", "aria-pressed": String(advanced) }),
          el("dl.trpg-builder-stat-rows", { dataset: { mode: advanced ? "advanced" : "easy" } }, STATS.flatMap(key => [el("dt", { text: statLabel(key) }), el("dd", [
            advanced ? button("−", "trpg-stat-" + key + "-down", () => { draft.stats[key]--; render("trpg-stat-" + key + "-down"); },
              { class: "small", disabled: draft.stats[key] <= builder.min, "aria-label": statLabel(key) + "を下げる" }) : null,
            el("i", { "aria-hidden": "true" }, Array.from({ length: builder.max }, (_, i) => el("b", { class: i < draft.stats[key] ? "lit" : "" }))),
            el("span", { text: "＋" + draft.stats[key], dataset: { test: "trpg-stat-" + key } }),
            advanced ? button("＋", "trpg-stat-" + key + "-up", () => { draft.stats[key]++; render("trpg-stat-" + key + "-up"); },
              { class: "small", disabled: draft.stats[key] >= builder.max || left <= 0, "aria-label": statLabel(key) + "を上げる" }) : null,
            el("small.trpg-builder-stat-help", { text: (builder.statHelp?.[key] || "") + (usedIn(key).length ? " · この物語では「" + usedIn(key).join("」「") + "」" : "") }),
          ].filter(Boolean))])),
          el("p.trpg-builder-hint", { text: advanced ? (left > 0 ? "残りの点を振り分けよう。余らせても構わない" : "判定は 2d20 ＋ その場面で使う能力値")
            : "判定は 2d20 ＋ その場面で使う能力値。計算は画面がします" }),
        ]),
      );
      syncConfirm();
      if (focusTest) refocus(focusTest);
    }
    const confirm = button("この役で卓につく", "trpg-build-confirm", () => {
      let built;
      try { built = buildPc(scenario, draft, session.growth); } catch { syncConfirm(); return; }
      build = { archetype: built.archetype, name: built.name, stats: built.stats };
      pressed = []; session = recording(new TrpgSession(scenario, { seed, profileId, pc: build, companions, warmStart, growth }));
      sheets = session.sheets;
      pop.close(); renderBody();
      root.querySelector('[data-test="trpg-build"]')?.focus({ preventScroll: true });
    }, { class: "primary" });
    function syncConfirm() {
      let ok = true;
      try { buildPc(scenario, draft, session.growth); } catch { ok = false; }
      confirm.disabled = !ok;
    }
    pop = modal(builder.title || "キャラクターを作る", [el("p.trpg-modal-intro", { text: builder.intro || "" }), board], [
      button("おまかせ", "trpg-build-random", () => {
        const rolled = randomPc(scenario, (seed ^ Date.now()) >>> 0, session.growth);
        Object.assign(draft, { archetype: rolled.archetype, name: rolled.name, stats: { ...rolled.stats } });
        audio.play("clue"); render("trpg-build-random");
      }),
      button("やめる", "trpg-build-back", () => pop.close()), confirm,
    ], { wide: true, skin: "trpg-builder-stage" });
    render();
  }
  function sheetCard(seat) {
    const pc = sheets[seat], player = scenario.cast.find(c => seatOf(c.id) === seat), state = session.snapshot();
    const portraitId = player ? player.id : gm;
    const figure = hasFigure(seat, portraitId);
    return el("article.trpg-sheet", { dataset: { test: "trpg-sheet-" + seat, npc: String(!player), costume: String(figure) } }, [
      figure ? el("span.trpg-sheet-costume", { "aria-hidden": "true" }, pcFigure(seat, portraitId, { shape: "full" })) : null,
      el("div.trpg-sheet-head", [
        el("span.trpg-sheet-face", { "aria-hidden": "true" }, pcFace(seat, portraitId)),
        el("div", [el("small", { text: player ? "PL " + name(player.id) : GM_TITLE + "（" + name(gm) + "）が兼任" }),
          el("h3", { text: pc.name }), el("span", { text: pc.title || "" })]),
      ]),
      el("dl.trpg-sheet-stats", STATS.flatMap(k => [el("dt", { text: statLabel(k) }), el("dd", { dataset: { value: String(pc.stats[k]) } }, [
        el("i", { "aria-hidden": "true" }, Array.from({ length: 5 }, (_, i) => el("b", { class: i < pc.stats[k] ? "lit" : "" }))),
        el("span", { text: "＋" + pc.stats[k] })])])),
      pc.trait ? el("p.trpg-sheet-trait", { text: pc.trait }) : null,
      pc.likes ? el("p.trpg-sheet-likes", { dataset: { test: "trpg-sheet-likes-" + seat } }, [el("strong", { text: "好きなもの " }), pc.likes]) : null,
      player?.ability ? el("p.trpg-sheet-ability", { dataset: { spent: String(!!state.used[player.id]) } },
        [el("strong", { text: "切り札「" + player.ability + "」" }), el("span", { text: player.abilityText + (state.used[player.id] ? " · 使用済" : "") })]) : null,
      el("small.trpg-sheet-acted", { text: player && state.acted[player.id] ? "この卓で " + state.acted[player.id] + " 回、前に出た" : "まだ前に出ていない" }),
    ].filter(Boolean));
  }
  function openSheets() {
    let pop;
    pop = modal(presentation.sheetTitle || "キャラクターシート", [
      el("p.trpg-modal-intro", { text: "判定は 2d20 ＋ 能力値。宣言した行動の能力で振ります。切り札は一人一度、連携札1枚を使います。" }),
      el("div.trpg-sheet-grid", Object.keys(sheets).map(sheetCard)),
    ], [button("卓に戻る", "trpg-sheets-close", () => pop.close(), { class: "primary" })], { wide: true, skin: "trpg-sheet-stage" });
  }
  function openLog() {
    const rows = log.length ? log.map(line => el("p.trpg-log-line", [
      el("strong", { text: (line.gm ? GM_TITLE + "（" + name(line.speaker) + "）" : name(line.speaker)) + " · " + line.role }), line.text,
    ])) : [el("p", { text: "卓を始めると、ここに会話が残ります。" })];
    let pop;
    pop = modal("卓のログ", rows, [button("卓に戻る", "trpg-log-close", () => pop.close(), { class: "primary" })]);
    pop?.box.querySelector(".trpg-modal-body")?.scrollTo(0, 99999);
  }
  function openHelp() {
    let pop;
    const head = text => el("h3.trpg-help-head", { text });
    pop = modal("この卓の遊び方", [
      head("用語"),
      el("dl.trpg-help-glossary", [
        el("dt", { text: "GM" }), el("dd", { text: "ゲームマスター。お話を進める語り手。場面を説明し、登場人物を演じる。卓では顔を出さず、衝立の印と「ゲームマスター（名前）」の名札で話す" }),
        el("dt", { text: "PL" }), el("dd", { text: "遊ぶ人。物語の中の役を一人ずつ演じる" }),
        el("dt", { text: "PC" }), el("dd", { text: "PLが演じる役。得意・不得意はキャラクターシートの能力値" }),
        el("dt", { text: "判定" }), el("dd", { text: "サイコロ二つ＋能力値。30以上で成功。失敗しても物語は続く" }),
        el("dt", { text: "クリティカル" }), el("dd", { text: "20の目が出ること。合計がいくつでも、必ず成功" }),
        el("dt", { text: "ファンブル" }), el("dd", { text: "1の目が出て、思わぬ出来事になること。卓がいちばん笑う瞬間" }),
      ]),
      head("画面の印"),
      el("dl.trpg-help-glossary", [
        el("dt", { text: "成功で ○○" }), el("dd", { text: "その判定に成功した時のごほうび。振る前にGMが告げる" }),
        el("dt", { text: "見込みの帯" }), el("dd", { text: "行動のカードの帯。金＝成功、緑＝ひと手間、残り＝思わぬ出来事の見込み" }),
        el("dt", { text: "おすすめ" }), el("dd", { text: "いちばん成功しやすい行動" }),
        el("dt", { text: "見せ場 ＋1" }), el("dd", { text: "その役が初めて前に出る時。自分の役も仲間の役も、卓の盛り上がりが1上がる" }),
        el("dt", { text: "✕ 合わなそう" }), el("dd", { text: "GMのヒント。今夜の事情に合わない選択肢。選ぶことはできる" }),
        el("dt", { text: "じっくり調べる" }), el("dd", { text: "見立てを選ぶ前に一度だけ、自分の役の" + statLabel("eye") + "で判定。成功で2つ、ひと手間で1つ、違う見立てに「✕ 違いそう」が付く。失っても何も減らない" }),
        el("dt", { text: "あと1……！" }), el("dd", { text: "成功に1〜2足りなかった出目" }),
        el("dt", { text: "会心の印" }), el("dd", { text: "最後の判定に成功した卓。結末に「会心のクライマックス」と出る" }),
      ]),
      head("この物語の進め方"),
      el("p", { text: presentation.help }),
      head("判定"),
      el("p", { text: Object.keys(sheets).length
        ? "場面ごとに、誰が・どの能力で動くかを宣言します。判定は20面ダイス二つの合計に、そのキャラクターの能力値を足します。30以上は成功、19〜29はひと手間、18以下は思わぬ出来事。20の目が出たら、合計にかかわらず成功（クリティカル）。どの結果でも物語は続きます。"
        : "判定は20面ダイス二つの合計に＋3。30以上は成功、19〜29はひと手間、18以下は思わぬ出来事。20の目が出たら、合計にかかわらず成功（クリティカル）。どの結果でも物語は続きます。" }),
      head("成功のごほうび"),
      el("p", { text: "判定の前に、GMが「成功すると何が起きるか」を告げます。" + (scenario.interview ? "最初の判定は、聞き込みで聞けることが1つ増えます。" : "")
        + "途中の判定は、次の選択でGMが「合わないもの」に印をつけてくれます（選ぶことはできます）。最後の判定は、結末に「会心のクライマックス」の印がつきます。失敗しても、ごほうびが無いだけです。" }),
      ...(Object.keys(sheets).length ? [el("p", { text: "自分の役も仲間の役も、初めて前に出ると卓の盛り上がりが1上がります。みんなに一度ずつ見せ場を。能力値はキャラクターシートで確認できます。" })] : []),
      ...(scenario.builder ? [el("p", { text: "表紙の「キャラクターを作る」で、自分が演じる役の出自と能力値（合計" + (scenario.builder.points + session.growth) + "点）を決められます。" + (session.growth ? "部のランクの成長点 ＋" + session.growth + " を含みます。" : "") })] : []),
      head("札と盛り上がり"),
      el("p", { text: "共有する連携札は2枚。切り札を使うたび1枚使います。クリティカル（20の目）が出ると、1枚戻ります。" }),
      el("p", { text: "卓の盛り上がりは、うまくいった判定・思わぬ出来事・クリティカル・ファンブル・ゾロ目・役の見せ場・初めての相談・見立ての話し合いで上がります。" + HEAT.tiers.join("・") + "に届くたび、次の判定に勢い1つ（補正＋" + DICE.momentum + "、最大" + HEAT.momentumMax + "つ）。" }),
      el("p", { text: "結末では卓を星3つで評価します。見立てが真相に合う、提案が本来の結末に届く、判定で2回以上うまくいく。" }),
      ...scenario.cast.filter(c => c.part !== "GM").map(c => el("p.trpg-help-ability", { text: name(c.id) + "「" + c.ability + "」 · " + c.abilityText })),
      el("p", { text: "切り札は各人一度ずつ。先に助けを借りるか、最後のために札を残すか、相談しながら決めましょう。" }),
      el("p", { text: "仲間の切り札は、振る前に札を選ぶと判定に＋" + DICE.support + "。振り直しは、出目を見てからサイコロ1個を選んで振り直します。新しい出目を採用するので、下がることもあります。クリティカル（20の目）の時は振り直せません。" }),
      head("操作"),
      el("p", { text: "クリック・タップで操作。会話はEnter／Spaceでも進みます。Tabでボタンを選び、Enterで決定できます。" }),
    ], [button("卓に戻る", "trpg-help-close", () => pop.close(), { class: "primary" })]);
  }
  function exit() {
    if (completed) { finish(completed); return; }
    if (session.snapshot().phase === "cover") { finish({ cancelled: true, scenarioId: scenario.id }); return; }
    let pop;
    pop = modal("卓を片付ける？", el("p", { text: presentation.exitText }), [
      button("続ける", "trpg-exit-back", () => pop.close()),
      button("卓を片付ける", "trpg-exit-confirm", () => finish({ cancelled: true, scenarioId: scenario.id }), { class: "primary" }),
    ]);
  }
  function finish(result) {
    if (disposed) return;
    dispose(); resolveFinished(result);
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    entrance.cancel();
    for (const effect of effects) effect.cancel();
    if (timer) clearTimeout(timer);
    clearTimeout(tipTimer); clearTimeout(searchTimer);
    if (rollTicker) clearInterval(rollTicker);
    if (providedAudio) audio.silence(); else audio.destroy();
    document.removeEventListener("visibilitychange", visibility);
    root.removeEventListener("keydown", keys);
    if (typeof window !== "undefined") window.removeEventListener?.("resize", fitRoomCrop);
    root.remove();
  }
  function keys(event) {
    if (event.repeat && (event.key === "Enter" || event.key === " ") && event.target.closest(".trpg-object-choice")) {
      event.preventDefault(); return;
    }
    if (event.repeat && !overlay && busy && (event.key === "Enter" || event.key === " ")
      && (event.target === next || !event.target.closest("button,input,select,textarea"))) {
      event.preventDefault();
      return;
    }
    if (overlay) {
      if (event.key === "Escape" && modalCloser) { event.preventDefault(); modalCloser(); }
      if (event.key === "Tab") {
        const nodes = [...overlay.querySelectorAll("button:not(:disabled),input:not(:disabled),summary,[tabindex='0']")].filter(node => node.getClientRects().length);
        if (!nodes.length) { event.preventDefault(); overlay.querySelector(".trpg-modal").focus(); return; }
        const first = nodes[0], last = nodes[nodes.length - 1];
        if (!nodes.includes(document.activeElement)) { event.preventDefault(); (event.shiftKey ? last : first).focus(); }
        else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
      return;
    }
    if (busy && (event.key === "Enter" || event.key === " ")
      && (event.target === next || !event.target.closest("button,input,select,textarea"))) {
      event.preventDefault(); advanceDialogue();
    }
  }
  root.addEventListener("keydown", keys);
  function visibility() { root.dataset.paused = String(document.hidden); }
  document.addEventListener("visibilitychange", visibility);
  if (typeof window !== "undefined") window.addEventListener?.("resize", fitRoomCrop);
  visibility();
  renderBody(); root.focus({ preventScroll: true });
  if (resumed) log.push({ speaker: gm, text: "（しおりから、前回の続き）" });
  else if (tutorial) playTutorial();
  return { finished, snapshot: () => session.snapshot(),
    destroy: () => finish(completed || { cancelled: true, scenarioId: scenario.id }), get disposed() { return disposed; } };
}

