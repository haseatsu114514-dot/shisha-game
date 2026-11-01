import { el } from "../core/util.js";
import { TrpgSession, HEAT, heatTier, DICE, STATS, PLAYER_SEAT, approachesOf, approachBase, buildPc, randomPc } from "./session.js";
import { displayName, portraitUrl, portraitTop as topFor, sceneUrl } from "./presentation.js";
import { createTrpgAudio } from "./audio.js";
import { checkForecast, rerollOdds } from "./feedback.js";

const PHASES = ["listen", "explore", "prepare", "serve", "ending"];
const LABELS = { success: "うまくいった", mixed: "ひと手間かかる", trouble: "思わぬ出来事" };
const SPECIALS = { critical: "クリティカル！", fumble: "ファンブル……", double: "ゾロ目！" };
const STAR_MARKS = [["insight", "見立てが的中", ""], ["plan", "提案が届いた", "物語の本来の結末にたどり着いた"], ["dice", "サイコロが味方", "判定で2回以上うまくいった"]];
const ICONS = {
  sound: '<path d="M4 9v6h4l5 4V5L8 9H4Zm13-1a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  log: '<path d="M4 4h16v12H9l-5 4V4Zm4 4h8m-8 4h5"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4m0 3v.2"/>',
  exit: '<path d="m10 5-7 7 7 7m-7-7h18"/>',
  notes: '<path d="M6 3h13v18H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm2 0v18m3-13h5m-5 4h5"/>',
  sheet: '<path d="M5 3h14v18H5zM8 7h8M8 11h8M8 15h5"/><circle cx="16.5" cy="16.5" r="1.5"/>',
};
/** Placeholder bust for a built character until its portrait exists: tinted silhouette with the name's first letter. */
const BUST = '<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false"><circle cx="50" cy="38" r="20" fill="currentColor"/><path d="M14 98c3-24 17-36 36-36s33 12 36 36z" fill="currentColor"/></svg>';
const STAT_SHORT = { eye: "観", hand: "手", talk: "話", nerve: "度" };

/** Mounts one isolated session; finished resolves only after the player leaves the table. */
export function mountTrpg(host, { scenario, characters, manifest, tableTalk = null, seed, profileId = null, pc = null, closeLabel = "卓を片付ける", audio: providedAudio = null, allowReplay = true, onComplete = () => {} }) {
  // The player's character can be rebuilt on the cover; the session restarts from the same seed until the story begins.
  let build = pc, session = new TrpgSession(scenario, { seed, profileId, pc: build });
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
  // The PC's own likeness when the sheet has one; otherwise the player's portrait stands in.
  function pcFace(seat, playerId) {
    const sheet = sheets[seat];
    if (sheet?.portrait) return el("img.trpg-pc-art", { src: new URL(sheet.portrait, import.meta.url).href, alt: "" });
    if (sheet?.color) return bust(sheet);
    return el("img", { src: portrait(playerId), alt: "", style: { top: portraitTop(playerId, 150, 6) } });
  }
  function bust({ color, accent, name }) {
    return el("span.trpg-pc-bust", { style: { "--bust": color, "--bust-accent": accent || "#e9d9b5" }, html: BUST },
      el("b", { text: [...(name || "")][0] || "", "aria-hidden": "true" }));
  }
  /** Authored text names the player's character with {pc}; the built name fills it in. */
  const pcText = text => String(text ?? "").replace(/\{pc\}/g, sheets[PLAYER_SEAT]?.name || "");
  // Warm the first illustrated decision while the cover and opening conversation play.
  const choiceArt = new Image();
  choiceArt.src = new URL("../../img/ui/trpg/choices-" + (presentation.theme === "shark" ? "shark" : "harbor") + ".webp", import.meta.url).href;
  choiceArt.decode().catch(() => {});
  const audio = providedAudio || createTrpgAudio(presentation.theme);
  audio.setTheme(presentation.theme);
  const scripts = Object.fromEntries(scenario.dialogues.map(d => [d.dialogue_id, d.lines]));
  const root = el("section.trpg-root.trpg-cinematic", { tabindex: "-1", dataset: { phase: "cover", theme: presentation.theme } });
  const content = el("div.trpg-content");
  const art = el("div.trpg-speaker-art");
  const speaker = el("strong");
  const role = el("span");
  const speech = el("p", { "aria-live": "polite" });
  const next = button("次へ", "trpg-next", advanceDialogue, { class: "trpg-next" });
  const dock = el("div.trpg-dock", [art, el("div.trpg-speech", [
    el("div.trpg-speaker-label", [speaker, role]), speech,
  ]), next]);
  const log = [];
  let frames = [], cursor = 0, afterTalk = null, afterFocus = null, busy = false, disposed = false, choiceField = null;
  let overlay = null, modalCloser = null, timer = null, rollTicker = null, settleGuard = false;
  let resolveFinished, completed = null;
  const finished = new Promise(resolve => { resolveFinished = resolve; });
  const progress = el("nav.trpg-journey", { "aria-label": "物語の進行" });
  const teamwork = el("div.trpg-teamwork", { dataset: { test: "trpg-teamwork" } });
  const heatMeter = el("div.trpg-heat", { dataset: { test: "trpg-heat" }, role: "meter", "aria-valuemin": "0", "aria-valuemax": String(HEAT.max) });
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
  root.append(el("header.trpg-header", [
    el("div.trpg-heading", [el("small", { text: "小さな卓の冒険 / " + presentation.number }),
      el("strong", { text: scenario.title }), teamwork, heatMeter]), tools,
  ]), progress, table, content, dock, tableStatus);
  host.replaceChildren(root);

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
  function name(id) {
    return displayName(characters, id);
  }
  function portrait(id, face = "normal") {
    return portraitUrl(manifest, id, face);
  }
  function portraitTop(id, width, headY) {
    return topFor(manifest, id, width, headY);
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
  function syncChrome() {
    const state = session.snapshot();
    root.dataset.phase = state.phase;
    root.dataset.risk = state.pressure >= 5 ? "high" : "calm";
    root.style.setProperty("--risk-level", state.pressure / session.rules.pressureMax);
    const current = PHASES.indexOf(state.phase);
    progress.replaceChildren(el("ol", PHASES.map((phase, i) => el("li", {
      class: i < current ? "done" : "", "aria-current": phase === state.phase ? "step" : null,
    }, [el("i", { text: i < current ? "✓" : String(i + 1), "aria-hidden": "true" }),
      el("span", { text: phase === "ending" ? "結末" : presentation.phases[phase].kicker.split(" / ").pop() })]))));
    teamwork.replaceChildren(el("span", { text: "連携札 " + state.teamwork + "/2" }),
      ...[1, 2].map(n => el("i", { class: n > state.teamwork ? "spent" : "", "aria-hidden": "true" })));
    table.replaceChildren(...scenario.cast.map(c => {
      const pc = c.part === "GM" ? null : pcOf(c.id);
      return el("span.trpg-table-person", { dataset: { speaker: c.id, part: c.part === "GM" ? "gm" : "pl" } }, [
        el("span.trpg-seat-head", [seatMark(c.id), el("span.trpg-seat-name", { text: (c.part === "GM" ? "GM " : "PL ") + name(c.id) }),
          el("small.trpg-seat-speaking")]),
        pc ? el("span.trpg-seat-pc", { dataset: { test: "trpg-seat-pc-" + c.id } }, [el("strong", { text: pc.name }),
          el("span.trpg-seat-stats", { "aria-label": STATS.map(k => statLabel(k) + pc.stats[k]).join("、") },
            STATS.map(k => el("i", { text: STAT_SHORT[k] + pc.stats[k], dataset: { stat: k, peak: String(pc.stats[k] >= 5) } })))]) : null,
        c.part === "GM" && npcSeats.length ? el("span.trpg-seat-pc", { dataset: { test: "trpg-seat-npc" } },
          [el("strong", { text: "兼任 " + npcSeats.map(seat => sheets[seat].name).join("・") })]) : null,
        ...(c.part === "GM" ? [] : [el("small.trpg-seat-ability", { text: state.used[c.id] ? "札 使用済" : "札 未使用",
          dataset: { spent: String(!!state.used[c.id]) } })]),
      ].filter(Boolean));
    }));
    syncSpeaker(busy ? frames[cursor]?.speaker : gm);
    const covering = state.phase === "cover";
    dock.hidden = covering;
    table.hidden = covering;
    progress.hidden = covering;
    teamwork.hidden = covering;
    syncResources();
  }
  function resourceText() {
    const state = session.snapshot(), step = Math.max(0, PHASES.indexOf(state.phase));
    const label = presentation.phases[state.phase]?.kicker.split(" / ").pop() || "卓の準備";
    return `${step + 1}/5 ${label} · 判定 ${state.checks.length}/3 · 連携札 ${state.teamwork}/2`
      + (presentation.theme === "shark" ? ` · 危機 ${state.pressure}/${session.rules.pressureMax}` : "");
  }
  /** Header meter plus one short pop per new moment. Tier 2/3 queue GM chatter for the next talk. */
  function syncHeat() {
    const state = session.snapshot(), tier = heatTier(state.heat);
    heatMeter.hidden = state.phase === "cover";
    heatMeter.dataset.tier = String(tier);
    heatMeter.setAttribute("aria-valuenow", String(state.heat));
    heatMeter.setAttribute("aria-label", "卓の盛り上がり " + state.heat + "/" + HEAT.max + " · " + HEAT.names[tier]);
    heatMeter.replaceChildren(...[el("span.trpg-heat-label", { text: "盛り上がり" }),
      el("span.trpg-heat-pips", { "aria-hidden": "true" }, Array.from({ length: HEAT.max }, (_, i) =>
        el("i", { class: [i < state.heat ? "lit" : "", HEAT.tiers.includes(i + 1) ? "tier" : ""].filter(Boolean).join(" ") }))),
      el("small.trpg-heat-name", { text: HEAT.names[tier] }),
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
      el("span", { text: entry.tier ? "次の判定に 勢い1つ（補正＋4）" : entry.reason }),
    ]);
    root.querySelectorAll(".trpg-heat-pop").forEach(old => old.remove());
    pop.addEventListener("animationend", () => pop.remove());
    root.append(pop);
  }
  function syncResources() {
    syncHeat();
    tableStatus.hidden = session.snapshot().phase === "cover";
    tableStatus.textContent = resourceText();
    root.querySelectorAll(".trpg-roll-context").forEach(node => { node.textContent = resourceText(); });
    table.querySelectorAll("[data-speaker]").forEach(node => {
      const ability = node.querySelector(".trpg-seat-ability");
      if (ability) {
        const spent = !!session.snapshot().used[node.dataset.speaker];
        ability.dataset.spent = String(spent); ability.textContent = spent ? "札 使用済" : "札 未使用";
      }
    });
  }
  function sequence(...ids) { return ids.flatMap(id => typeof id === "string" ? scripts[id] || [] : id).filter(Boolean); }
  function talk(lines, callback, focusTest = null) {
    syncHeat();
    frames = sequence(lines, heatChatter); heatChatter = []; cursor = 0; afterTalk = callback; afterFocus = focusTest; busy = true;
    root.classList.remove("trpg-idle"); next.hidden = false; next.disabled = false;
    renderBody();
    showFrame();
    next.focus({ preventScroll: true });
  }
  function showFrame() {
    const frame = frames[cursor];
    if (!frame) { finishTalk(); return; }
    const person = cast[frame.speaker];
    art.replaceChildren(el("img", { src: portrait(frame.speaker, frame.face), alt: name(frame.speaker),
      style: { top: portraitTop(frame.speaker, 410, 16) } }));
    art.style.backgroundColor = person?.color || "#566053";
    speaker.textContent = name(frame.speaker);
    role.textContent = frame.role || (person?.part === "GM" ? "GM／卓の会話" : "PL／卓の会話");
    dock.dataset.layer = /場面|物語/.test(role.textContent) ? "fiction" : "table";
    speech.textContent = pcText(frame.text);
    next.textContent = cursor + 1 < frames.length ? "次へ" : "続ける";
    syncSpeaker(frame.speaker);
    log.push({ speaker: frame.speaker, role: role.textContent, text: pcText(frame.text) });
  }
  function advanceDialogue() {
    if (!busy || overlay || disposed) return;
    cursor++;
    if (cursor < frames.length) showFrame(); else finishTalk();
  }
  function finishTalk() {
    busy = false; frames = [];
    const callback = afterTalk, focusTest = afterFocus; afterTalk = null; afterFocus = null;
    next.hidden = true; root.classList.add("trpg-idle");
    if (callback) callback(); else renderBody();
    if (!overlay && !busy) (focusTest && root.querySelector('[data-test="' + focusTest + '"]') || root).focus({ preventScroll: true });
  }
  function idle(text) {
    if (busy) return;
    art.replaceChildren(el("img", { src: portrait(gm), alt: name(gm),
      style: { top: portraitTop(gm, 410, 16) } }));
    art.style.backgroundColor = cast[gm].color;
    speaker.textContent = name(gm); role.textContent = "GM／卓の会話"; speech.textContent = text;
    dock.dataset.layer = "table";
    syncSpeaker(gm);
    root.classList.add("trpg-idle"); next.hidden = true;
  }
  function start() {
    if (session.snapshot().phase !== "cover") return;
    session.start(); syncChrome();
    audio.play("open");
    talk(sequence(scenario.intro, scenario.listen, [{ speaker: gm, role: presentation.arrivalRole, text: session.profile.arrival }]),
      () => { renderBody(); openDeclaration("listen"); });
  }
  function room(interactive = false) {
    const node = el("div.trpg-room", { class: interactive ? "interactive" : "" }, [
      el("img", { src: sceneUrl(scenario), alt: presentation.sceneAlt, decoding: "async", onerror: event => {
        event.currentTarget.hidden = true; node.classList.add("art-unavailable");
        node.querySelector(".trpg-scene-retry").hidden = false;
      } }),
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
            const clue = session.inspect(spot.id);
            audio.play(clue.fresh ? "clue" : "tap");
            talk(clue.evidence.lines, () => { renderBody(); idle(presentation.exploreIdle); }, "trpg-spot-" + spot.id);
          },
        }, [el("i", { text: checked ? "✓" : String(i + 1) }), el("span.trpg-stage-hotspot-label", {
          text: spot.short + (!checked && session.rules.inspectionPressure ? " · 危機＋" + session.rules.inspectionPressure : ""),
        })]));
      });
    }
    return node;
  }
  function investigation() {
    const state = session.snapshot(), remaining = session.rules.exploreLimit - state.clues.length;
    const ready = state.clues.length >= 3;
    return el("p.trpg-stage-investigation", { dataset: { test: "trpg-investigation", ready: String(ready) }, role: "status",
      text: "手がかり " + state.clues.length + (ready ? "個" : "/3") + (session.rules.inspectionPressure
        ? " · 調査あと" + remaining + "箇所 · 新規調査で危機＋" + session.rules.inspectionPressure
        : ready ? " · みんなで見立てを話せる" : " · 気になるものを調べよう") });
  }
  function planSummary() {
    const state = session.snapshot();
    return el("div.trpg-plan-summary", { dataset: { test: "trpg-plan-summary" } }, [
      el("strong", { text: presentation.theme === "shark" ? "みんなの脱出プラン" : "旅人への提案" }),
      ...Object.entries(state.plan).map(([field, id]) => el("div", { class: id ? "chosen" : "pending" }, [
        el("small", { text: presentation.fields[field] }),
        el("span", { text: scenario.options[field].find(o => o.id === id)?.label || "これから選ぶ" }),
      ])),
    ]);
  }
  function renderBody() {
    if (disposed) return;
    syncChrome();
    const state = session.snapshot();
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
        text: (i + 1) + " · " + session.profile.evidence[id].title, dataset: { clue: id },
      }))));
    if (presentation.theme === "shark") cue.append(el("small.trpg-stage-risk", {
      text: "危機 " + state.pressure + "/" + session.rules.pressureMax,
      dataset: { test: "trpg-risk" }, "aria-label": "危機 " + state.pressure + "、最大" + session.rules.pressureMax,
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
        node.append(el("span.trpg-companion-face", el("img", { src: portrait(id), alt: "", style: { top: portraitTop(id, 150, 6) } })),
          el("span", { text: name(id) + "に相談" }));
        return node;
      }));
      scene.append(companions);
      if (state.clues.length >= 3) actions.append(button(copy.button, "trpg-interpret", chooseHypothesis, { class: "primary", disabled: busy }));
      idle(presentation.exploreIdle);
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
          [el("strong", { text: result.heat.night }), el("span", { text: "盛り上がり " + result.heat.value + "/" + result.heat.max })]),
        el("div.trpg-ending-rating", { dataset: { test: "trpg-ending-rating" } }, [stars(result.rating),
          el("strong", { text: result.rating.title }),
          el("small", { text: STAR_MARKS.map(([key, label]) => (result.rating.marks[key] ? "★" : "☆") + label).join(" · ") })]),
      ]));
      actions.append(button("この卓を振り返る", "trpg-recap", openRecap, { disabled: busy }), ...(allowReplay ? [button("もう一度、この物語", "trpg-replay", () => finish({ ...result, replayRequested: true }),
        { disabled: busy })] : []), button(closeLabel, "trpg-finish", () => finish(result), { class: "primary", disabled: busy }));
      idle(presentation.endingIdle);
    }
    if (["prepare", "serve", "ending"].includes(state.phase)) cue.hidden = true;
    scene.append(cue, actions, pockets);
    content.append(scene);
  }
  function consult(id) {
    if (busy || overlay) return;
    talk(session.consult(id), () => { renderBody(); idle(presentation.exploreIdle); }, "trpg-consult-" + id);
  }
  function cover() {
    root.append(el("div.trpg-cover.trpg-cinematic-cover", [
      el("img.trpg-cover-backdrop", { src: sceneUrl(scenario), alt: presentation.sceneAlt }),
      el("div.trpg-cover-copy", [
        el("small.trpg-kicker", { text: presentation.genre + " / 約10分" }),
        el("h1", presentation.titleLines.map(text => el("span", { text }))),
        el("p", { text: scenario.premise }),
        el("div.trpg-cover-actions", [button("物語をはじめる", "trpg-start", start, { class: "primary" }),
          button("遊び方", "trpg-cover-help", openHelp)]),
        scenario.builder ? pcCard() : null,
        el("small.trpg-cover-author", { text: "作 · " + scenario.author }),
      ].filter(Boolean)),
      el("div.trpg-cover-party", scenario.cast.map(c => el("div.trpg-cover-person", [
        el("span.trpg-cover-person-art", el("img", { src: portrait(c.id), alt: "", style: { top: portraitTop(c.id, 150, 6) } })),
        el("strong", { text: name(c.id) }), el("small", { text: c.part === "GM" ? "GM" : (pcOf(c.id) ? "PC " + pcOf(c.id).name : pcText(c.role).split("／")[0]) }),
      ]))),
    ]));
  }
  function optionButton(field, option) {
    const selected = session.snapshot().plan[field] === option.id;
    const column = scenario.options[field].findIndex(o => o.id === option.id);
    const row = Object.values(session.flow).flat().indexOf(field);
    return el("button.trpg-button.trpg-object-choice", { type: "button", class: selected ? "selected" : "",
      disabled: busy, "aria-pressed": selected ? "true" : "false",
      "aria-label": option.label + "。" + option.description,
      dataset: { test: "trpg-plan-" + field + "-" + option.id },
      onclick: () => {
        if (busy || overlay) return;
        audio.play("tap"); session.plan(field, option.id);
        choiceField = session.flow.prepare.find(f => !session.snapshot().plan[f]) || field;
        renderBody();
        (root.querySelector('[data-test="trpg-plan-' + field + "-" + option.id + '"]')
          || root.querySelector(".trpg-choice-cards button"))?.focus({ preventScroll: true });
      },
    }, [el("span.trpg-object-art", { "aria-hidden": "true", style: { "--tile-x": column * 50 + "%", "--tile-y": row * 50 + "%" } }),
      el("strong.trpg-object-label", { text: option.label }), el("span.trpg-object-detail", { text: option.description })]);
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
    let pop;
    const choices = scenario.hypotheses.map((h, i) => el("button.trpg-button.trpg-object-choice", { type: "button",
      dataset: { test: "trpg-hypothesis-" + h.id },
      "aria-label": h.label + "。" + h.description,
      onclick: () => {
        if (!pop || busy) return;
        session.interpret(h.id); pop.close();
        talk(scenario.preparation, () => renderBody());
      },
    }, [el("span.trpg-object-art", { "aria-hidden": "true", style: { "--tile-x": i * 50 + "%", "--tile-y": presentation.theme === "shark" ? "0%" : "100%" } }),
      el("strong.trpg-object-label", { text: h.label }), el("span.trpg-object-detail", { text: h.description })]));
    pop = modal(presentation.hypothesisTitle, el("div.trpg-hypothesis-board", [
      el("div.trpg-choice-cards", choices),
      el("details.trpg-evidence-fold", [el("summary", { text: "手がかりを見る (" + session.snapshot().clues.length + ")" }), el("div.trpg-notes-grid", noteCards())]),
    ]), [button("もう少し調べる", "trpg-hypothesis-back", () => pop.close())], { wide: true, skin: "trpg-hypothesis-stage" });
  }
  function die(value, rolling = false) {
    return el("div.trpg-die.trpg-d20", { class: rolling ? "rolling" : "", role: "img", "aria-label": "20面ダイス " + value,
      html: '<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false"><polygon points="50,2 95,26 95,74 50,98 5,74 5,26"/><path d="M50 2 25 68 75 68 50 2M5 26 25 68 5 74M95 26 75 68 95 74M50 98 25 68M50 98 75 68M5 26 50 2 95 26"/></svg>' },
      el("span.trpg-d20-value", { text: String(value), "aria-hidden": "true" }));
  }
  /** The declared PC and stat, shown wherever a roll is explained. */
  function actorPanel(approach, { compact = false } = {}) {
    if (!approach) return null;
    const pc = sheets[approach.sheet || approach.actor], actor = approach.actor;
    const rating = pc?.stats?.[approach.stat];
    return el("div.trpg-roll-actor", { dataset: { test: "trpg-roll-actor", actor, npc: String(!!approach.npc) } }, [
      el("span.trpg-roll-actor-face", { "aria-hidden": "true" }, pcFace(approach.sheet || approach.actor, actor)),
      el("span.trpg-roll-actor-copy", [
        el("small", { text: (approach.npc ? "GM " + name(actor) + " が演じる " : "PL " + name(actor) + " の ") + (pc?.name || "") }),
        el("strong", { text: pcText(approach.label) }),
        compact ? null : el("span.trpg-roll-actor-stat", { text: statLabel(approach.stat) + " ＋" + (Number.isInteger(rating) ? rating : DICE.base) }),
      ].filter(Boolean)),
    ]);
  }
  /** A real table asks who acts and how before any die is touched. */
  function openDeclaration(kind) {
    if (busy || overlay || session.snapshot().pending) return;
    const approaches = approachesOf(scenario, kind);
    if (!approaches.length) { openCheck(kind); return; }
    const check = scenario.checks[kind], state = session.snapshot();
    let pop;
    const cards = approaches.map(approach => {
      const pc = sheets[approach.sheet || approach.actor];
      const { base } = approachBase(scenario, kind, approach.id, sheets);
      const odds = checkForecast(scenario, state, kind, { approach: approach.id, sheets }).odds;
      const first = !state.acted[approach.actor] && !approach.npc && approach.actor !== PLAYER_SEAT;
      return el("button.trpg-button.trpg-approach", { type: "button", dataset: { test: "trpg-approach-" + approach.id, actor: approach.actor },
        "aria-label": pcText(approach.label) + "。" + (approach.npc ? "GMが演じる" : name(approach.actor) + "の") + (pc?.name || "") + "、" + statLabel(approach.stat) + "＋" + base + "。成功 約" + odds.success + "%",
        onclick: () => {
          if (!pop || busy) return;
          pop.close();
          talk(sequence(approach.declare), () => { renderBody(); openCheck(kind, approach.id); });
        },
      }, [
        el("span.trpg-approach-face", { "aria-hidden": "true" }, pcFace(approach.sheet || approach.actor, approach.actor)),
        el("span.trpg-approach-copy", [
          el("small", { text: (approach.npc ? "GM " + name(approach.actor) + " が演じる" : "PL " + name(approach.actor)) + " · " + (pc?.name || "") }),
          el("strong", { text: pcText(approach.label) }), el("span", { text: pcText(approach.detail) }),
        ]),
        el("span.trpg-approach-meta", [
          el("b", { text: statLabel(approach.stat) + " ＋" + base, dataset: { stat: approach.stat } }),
          el("small", { text: "成功 約" + odds.success + "%" }),
          first ? el("i", { text: "初めての見せ場 · 盛り上がり＋1" }) : null,
        ].filter(Boolean)),
      ]);
    });
    pop = modal(presentation.declareTitle || "どうする？", el("div.trpg-declare-board", [
      el("p.trpg-declare-prompt", [el("strong", { text: check.title }), el("span", { text: presentation.declareHint || "" })]),
      el("div.trpg-approach-list", cards),
      el("p.trpg-declare-rule", { text: presentation.target || ("目標値" + DICE.success) }),
    ]), [button("卓に戻る", "trpg-declare-back", () => pop.close())], { wide: true, skin: "trpg-declare-stage" });
  }
  function openCheck(kind, approachId = null) {
    if (busy || overlay || session.snapshot().pending) return;
    const check = scenario.checks[kind], helper = check.helper || null;
    const declared = approachBase(scenario, kind, approachId, sheets).approach;
    const body = el("div", [el("p.trpg-roll-instruction", { text: "20面ダイス2個 ＋ 補正 · 30以上で成功" }), actorPanel(declared), el("div.trpg-roll-scene",
      el("div.trpg-dice-row", [die(1), die(1), el("span.trpg-dice-bonus", { text: "＋" + DICE.base, dataset: { test: "trpg-bonus" } })]))].filter(Boolean));
    const forecast = el("div.trpg-forecast", { dataset: { test: "trpg-forecast" }, "aria-live": "polite" });
    function updateForecast() {
      const predicted = checkForecast(scenario, session.snapshot(), kind, { support: !!support?.checked, approach: declared?.id || null, sheets });
      body.querySelector(".trpg-dice-bonus").textContent = "＋" + predicted.baseBonus;
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
        : "どの出目でも物語は続きます。出目は、途中の出来事を変えます。" }));
    }
    const support = helper && !session.snapshot().used[helper] && session.snapshot().teamwork > 0
      ? el("input", { type: "checkbox", dataset: { test: "trpg-support-" + helper } }) : null;
    if (support) body.append(el("label.trpg-aid", [support, seatMark(helper),
      el("span.trpg-aid-art", { "aria-hidden": "true" }, el("img", { src: portrait(helper), alt: "", style: { top: portraitTop(helper, 150, 6) } })), el("span", [
      el("strong", { text: name(helper) + "の「" + cast[helper].ability + "」を借りる" }),
      el("small", { text: "判定＋7 · 連携札1枚を使う · この切り札は一度だけ" }),
    ])]));
    if (support) support.addEventListener("change", updateForecast);
    if (helper && !support) body.append(el("p", { text: "この判定では連携札を使えません。手元の作戦で進めましょう。" }));
    body.append(el("details.trpg-roll-details", { dataset: { test: "trpg-roll-details" } }, [
      el("summary", { text: "判定の詳細", dataset: { test: "trpg-details-toggle" } }),
      el("p", { text: check.hint }), forecast,
    ])); updateForecast();
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
      body.querySelector(".trpg-dice-row").replaceChildren(die(1, true), die(1, true),
        el("span.trpg-dice-bonus", { text: "＋" + result.bonus }));
      settleGuard = false;
      audio.play("roll");
      const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!reduced) rollTicker = setInterval(() => {
        body.querySelector(".trpg-dice-row")?.replaceChildren(die(Math.floor(Math.random()*DICE.sides)+1, true), die(Math.floor(Math.random()*DICE.sides)+1, true),
          el("span.trpg-dice-bonus", { text: "＋" + result.bonus }));
      }, 90);
      timer = setTimeout(() => {
        timer = null; clearInterval(rollTicker); rollTicker = null;
        if (!disposed) showRollResult(pop, body);
      }, reduced ? 40 : 650);
    }, { class: "primary" });
    pop = modal(check.title, body, [button("卓に戻る", "trpg-check-back", () => pop.close()), roll], { skin: "trpg-roll-stage" });
    pop.box.append(el("div.trpg-spare-kit", { "aria-hidden": "true", role: "presentation" }));
  }
  function showRollResult(pop, body, rerolledDie = null) {
    const result = session.checkResult();
    syncResources();
    pop.box.dataset.rollState = "settled";
    pop.box.dataset.grade = result.grade;
    body.replaceChildren(
      el("p.trpg-roll-instruction", { text: scenario.checks[result.kind].hint }),
      el("div.trpg-dice-row", [die(result.dice[0]), die(result.dice[1]), el("span.trpg-dice-bonus", { text: "＋" + result.bonus })]),
      el("div.trpg-dice-total", { role: "status", dataset: { test: "trpg-roll-total", grade: result.grade } }, [
        el("small.trpg-roll-equation", { text: result.dice[0] + " ＋ " + result.dice[1] + " ＋ 補正" + result.bonus + " ＝" }),
        el("strong", { text: "合計 " + result.total }), el("span.trpg-dice-grade", { text: LABELS[result.grade] }),
      ]),
    );
    pop.box.dataset.special = result.special || "";
    if (result.special) body.append(el("p.trpg-roll-special", { dataset: { test: "trpg-roll-special", special: result.special } }, [
      el("strong", { text: SPECIALS[result.special] }),
      el("span", { text: result.special === "critical" ? session.snapshot().teamwork < 2 ? "物語を続けると、連携札が1枚戻る" : "連携札は満タン。卓が沸いた"
        : result.special === "fumble" ? "それでも物語は続く。卓は笑いに包まれた" : "揃った出目に、卓が少しざわめく" }),
    ]));
    if (result.approach) {
      const pc = sheets[result.sheet], actorText = (result.actor && cast[result.actor] ? name(result.actor) : "GM") + (pc ? "の" + pc.name : "");
      body.append(el("p.trpg-ability-receipt.trpg-actor-receipt", { dataset: { test: "trpg-actor-receipt" } },
        [actorText + " · " + statLabel(result.stat) + " ＋" + result.base]));
    }
    if (result.momentum) body.append(el("p.trpg-ability-receipt.trpg-momentum-receipt", { text: "卓の勢い ＋" + result.momentum * DICE.momentum + " · 盛り上がりが後押し" }));
    if (result.helper) body.append(el("p.trpg-ability-receipt", { dataset: { test: "trpg-helper-receipt" } },
      [seatMark(result.helper), name(result.helper) + "の助力 ＋7 · 札 使用済"]));
    if (result.rerolled) {
      body.append(el("p.trpg-ability-receipt", { dataset: { test: "trpg-reroll-receipt" } },
        [seatMark(session.rerollActor), name(session.rerollActor) + "の振り直し · 札 使用済"]));
      if (rerolledDie !== null) {
        const target = body.querySelectorAll(".trpg-die")[rerolledDie];
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
    audio.play(result.grade);
    if (result.hypothesisBonus) body.append(el("p.trpg-roll-insight", { text: "見立てが合っていた · 仕掛けに ＋" + result.hypothesisBonus }));
    if (presentation.theme === "shark") body.append(el("p.trpg-roll-consequence", { text: result.grade === "success" ? "危機を進めず、次の場面へ" : "危機 ＋" + session.rules.checkPressure[result.grade] + " · 全員で次の場面へ" }));
    if (result.special === "critical") body.append(el("p.trpg-roll-trump", { text: "最高の出目。切り札は温存しよう" }));
    else if (!session.snapshot().used[session.rerollActor] && session.snapshot().teamwork > 0) {
      body.append(el("p.trpg-roll-trump", { text: name(session.rerollActor) + "の「" + cast[session.rerollActor].ability + "」 · 連携札1枚" }));
      body.append(el("div.trpg-rerolls", [0, 1].map(i =>
      button("", "trpg-reroll-" + i, () => {
        if (settleGuard || session.snapshot().used[session.rerollActor] || session.snapshot().teamwork < 1) return;
        audio.play("roll");
        session.reroll(i); showRollResult(pop, body, i);
      }, { class: "trpg-reroll-choice" }))));
      body.querySelectorAll(".trpg-reroll-choice").forEach((node, i) => node.append(
        seatMark(session.rerollActor),
        el("strong", { text: (i + 1) + "個目（" + result.dice[i] + "）を振り直す" }),
        el("small", { text: rerollText(rerollOdds(result.dice, result.bonus, i)) }),
      ));
      body.append(el("p.trpg-reroll-warning", { text: "新しい出目を採用します。今より低い出目になることもあります。" }));
    } else body.append(el("p.trpg-roll-trump", { text: "振り直しには、未使用の切り札と連携札1枚が必要です。" }));
    const actions = pop.box.querySelector(".trpg-modal-actions");
    actions.replaceChildren(button("物語を続ける", "trpg-settle", () => {
      if (settleGuard || disposed) return;
      settleGuard = true;
      const settled = session.settleCheck(); pop.close();
      const continuation = () => {
        if (settled.kind === "listen") {
          renderBody(); idle(presentation.exploreIdle);
        } else if (settled.kind === "prepare") {
          talk(scenario.serving, () => renderBody());
        } else {
          const result = session.result(), ending = scenario.endings[result.ending];
          audio.play("ending");
          talk(sequence(ending.dialogue, scenario.debrief?.[result.variant], scenario.epilogue), () => {
            completed = result;
            onComplete(result);
            renderBody();
          });
        }
      };
      const responses = (session.flow[settled.kind] || []).map(field =>
        scenario.options[field].find(o => o.id === session.snapshot().plan[field])?.response);
      const chatter = settled.special && tableTalk?.["trpg_talk_" + gm + "_" + (settled.special === "critical" && !settled.inspired ? "critical_full" : settled.special)];
      talk(sequence(chatter && chatter.every(line => cast[line.speaker]) ? chatter : [], ...responses, scenario.checks[settled.kind][settled.grade]), continuation);
    }, { class: "primary" }));
    actions.querySelector("button").focus({ preventScroll: true });
  }
  function rerollText(odds) {
    return odds.success ? "振り直した後の成功 約" + odds.success + "%"
      : "成功には届かない · ひと手間以上 約" + (odds.mixed) + "%";
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
    ], [button("卓に戻る", "trpg-notes-close", () => pop.close(), { class: "primary" })], { wide: true });
  }
  function noteCards() {
    const clues = session.snapshot().clues;
    if (!clues.length) return [el("p", { text: "部屋を調べると、ここに手がかりが残ります。" })];
    return clues.map((id, i) => {
      const e = session.profile.evidence[id];
      return el("article.trpg-note-card", [
        el("small", { text: String(i + 1).padStart(2, "0") + " / " + scenario.spots.find(s => s.id === id).label }),
        el("h3", { text: e.title }), el("p", { text: e.text }),
      ]);
    });
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
            : "成功 " + result.checks.filter(c => c.grade === "success").length + "/3" + (result.rating.marks.dice ? " · " + detail : "") }),
        ]))),
      ]),
      el("div.trpg-recap-grid", [
        el("section", [el("h3", { text: "みんなで選んだこと" }),
          el("p.trpg-recap-hypothesis", { text: "見立て：" + hypothesis.label }), planSummary()]),
        el("section", [el("h3", { text: "サイコロが作った展開" }),
          ...result.checks.map(check => el("article.trpg-recap-check", { dataset: { grade: check.grade } }, [
            el("strong", { text: scenario.checks[check.kind].title }),
            check.approach ? el("em", { text: (sheets[check.sheet]?.name || "") + (check.actor && cast[check.actor] ? "（" + name(check.actor) + "）" : "") + " · " + pcText(approachesOf(scenario, check.kind).find(a => a.id === check.approach)?.label || "") + " · " + statLabel(check.stat) + "＋" + check.base }) : null,
            el("span", { text: check.dice.join(" ＋ ") + " ＋ 補正" + check.bonus + " ＝ " + check.total + " · " + LABELS[check.grade] }),
            el("small", { text: [check.helper ? name(check.helper) + "の助力" : "",
              check.rerolled ? name(session.rerollActor) + "の振り直し" : "", check.hypothesisBonus ? "見立て＋" + check.hypothesisBonus : "",
              check.special ? SPECIALS[check.special] + (check.inspired ? "連携札＋1" : "") : ""].filter(Boolean).join(" · ") || "基本の判定" }),
          ])),
        ]),
      ]),
      el("p.trpg-recap-rule", { text: "選んだ提案が結末を、サイコロがそこまでの出来事を作りました。" }),
      el("h3", { text: "物語の途中で見つけたもの" }), el("div.trpg-notes-grid", noteCards()),
    ], [button("結末に戻る", "trpg-recap-close", () => pop.close(), { class: "primary" })], { wide: true });
  }
  /** The player's character on the cover: who you will play tonight, and the door to remake them. */
  function pcCard() {
    const me = session.pc;
    return el("div.trpg-cover-pc", { dataset: { test: "trpg-cover-pc" } }, [
      el("span.trpg-cover-pc-face", { "aria-hidden": "true" }, pcFace(me.seat, PLAYER_SEAT)),
      el("div.trpg-cover-pc-copy", [
        el("small", { text: "PL " + name(PLAYER_SEAT) + " が演じる" }),
        el("strong", { text: me.name, dataset: { test: "trpg-cover-pc-name" } }), el("span", { text: me.title }),
        el("span.trpg-seat-stats", { "aria-label": STATS.map(k => statLabel(k) + me.stats[k]).join("、") },
          STATS.map(k => el("i", { text: STAT_SHORT[k] + me.stats[k], dataset: { stat: k, peak: String(me.stats[k] >= 5) } }))),
      ]),
      button("キャラクターを作る", "trpg-build", openBuilder, { class: "small" }),
    ]);
  }
  /** Character creation: a look, an origin preset, a name and a point-buy of the four stats. */
  function openBuilder() {
    if (busy || overlay || session.snapshot().phase !== "cover") return;
    const builder = scenario.builder;
    if (!builder) return;
    const me = session.pc;
    const draft = { look: me.look, archetype: me.archetype, name: me.name, stats: { ...me.stats } };
    const board = el("div.trpg-builder", { dataset: { test: "trpg-builder" } });
    let pop, nameInput;
    const preset = () => builder.archetypes.find(a => a.id === draft.archetype);
    const spent = () => STATS.reduce((n, key) => n + draft.stats[key], 0);
    const refocus = test => { const node = pop?.box.querySelector('[data-test="' + test + '"]'); if (node && !node.disabled) node.focus({ preventScroll: true }); };
    function render(focusTest = null) {
      const left = builder.points - spent();
      board.replaceChildren(
        el("section.trpg-builder-looks", [el("h3", { text: "見た目" }),
          el("div.trpg-builder-look-grid", builder.looks.map(look => el("button.trpg-button.trpg-builder-look", { type: "button",
            class: draft.look === look.id ? "selected" : "", "aria-pressed": String(draft.look === look.id),
            "aria-label": look.label + "。" + (look.detail || ""), dataset: { test: "trpg-look-" + look.id },
            onclick: () => { draft.look = look.id; audio.play("tap"); render("trpg-look-" + look.id); },
          }, [el("span.trpg-builder-look-face", { "aria-hidden": "true" }, look.portrait
              ? el("img.trpg-pc-art", { src: new URL(look.portrait, import.meta.url).href, alt: "" })
              : bust({ color: look.color, accent: look.accent, name: draft.name })),
            el("strong", { text: look.label }), el("small", { text: look.detail || "" })])))]),
        el("section.trpg-builder-origins", [el("h3", { text: "出自" }),
          el("div.trpg-builder-origin-list", builder.archetypes.map(a => el("button.trpg-button.trpg-builder-origin", { type: "button",
            class: draft.archetype === a.id ? "selected" : "", "aria-pressed": String(draft.archetype === a.id),
            "aria-label": a.title + "、" + a.name + "。" + a.trait, dataset: { test: "trpg-archetype-" + a.id },
            onclick: () => {
              const previous = preset();
              draft.archetype = a.id; draft.stats = { ...a.stats };
              if (!draft.name || draft.name === previous?.name) draft.name = a.name;
              audio.play("tap"); render("trpg-archetype-" + a.id);
            },
          }, [el("strong", { text: a.title }), el("span", { text: "例の名前 " + a.name + " · " + STATS.map(k => STAT_SHORT[k] + a.stats[k]).join(" ") }),
            el("small", { text: a.trait })])))]),
        el("section.trpg-builder-stats", [
          el("h3", { text: "名前と能力値" }),
          el("label.trpg-builder-name", [el("span", { text: "名前（" + (builder.nameMax || 6) + "文字まで）" }),
            nameInput = el("input", { type: "text", value: draft.name, maxlength: String(builder.nameMax || 6), dataset: { test: "trpg-pc-name" },
              oninput: event => { draft.name = event.currentTarget.value; board.querySelectorAll(".trpg-pc-bust b").forEach(b => { b.textContent = [...draft.name.trim()][0] || ""; }); syncConfirm(); } })]),
          el("p.trpg-builder-points", { dataset: { test: "trpg-stat-points", left: String(left) }, "aria-live": "polite" },
            [el("strong", { text: "残り " + left + " 点" }), el("span", { text: " · 合計 " + builder.points + " 点、各 " + builder.min + "〜" + builder.max })]),
          el("dl.trpg-builder-stat-rows", STATS.flatMap(key => [el("dt", { text: statLabel(key) }), el("dd", [
            button("−", "trpg-stat-" + key + "-down", () => { draft.stats[key]--; render("trpg-stat-" + key + "-down"); },
              { class: "small", disabled: draft.stats[key] <= builder.min, "aria-label": statLabel(key) + "を下げる" }),
            el("i", { "aria-hidden": "true" }, Array.from({ length: builder.max }, (_, i) => el("b", { class: i < draft.stats[key] ? "lit" : "" }))),
            el("span", { text: "＋" + draft.stats[key], dataset: { test: "trpg-stat-" + key } }),
            button("＋", "trpg-stat-" + key + "-up", () => { draft.stats[key]++; render("trpg-stat-" + key + "-up"); },
              { class: "small", disabled: draft.stats[key] >= builder.max || left <= 0, "aria-label": statLabel(key) + "を上げる" }),
          ])])),
          el("p.trpg-builder-hint", { text: left > 0 ? "残りの点を振り分けよう。余らせても構わない" : "判定は 2d20 ＋ その場面で使う能力値。切り札「" + (cast[PLAYER_SEAT]?.ability || "") + "」はそのまま" }),
        ]),
      );
      syncConfirm();
      if (focusTest) refocus(focusTest);
    }
    const confirm = button("この役で卓につく", "trpg-build-confirm", () => {
      let built;
      try { built = buildPc(scenario, draft); } catch { syncConfirm(); return; }
      build = { look: built.look, archetype: built.archetype, name: built.name, stats: built.stats };
      session = new TrpgSession(scenario, { seed, profileId, pc: build });
      sheets = session.sheets;
      pop.close(); renderBody();
      root.querySelector('[data-test="trpg-build"]')?.focus({ preventScroll: true });
    }, { class: "primary" });
    function syncConfirm() {
      let ok = true;
      try { buildPc(scenario, draft); } catch { ok = false; }
      confirm.disabled = !ok;
    }
    pop = modal(builder.title || "キャラクターを作る", [el("p.trpg-modal-intro", { text: builder.intro || "" }), board], [
      button("おまかせ", "trpg-build-random", () => {
        const rolled = randomPc(scenario, (seed ^ Date.now()) >>> 0);
        Object.assign(draft, { look: rolled.look, archetype: rolled.archetype, name: rolled.name, stats: { ...rolled.stats } });
        audio.play("clue"); render("trpg-build-random");
      }),
      button("やめる", "trpg-build-back", () => pop.close()), confirm,
    ], { wide: true, skin: "trpg-builder-stage" });
    render();
  }
  function sheetCard(seat) {
    const pc = sheets[seat], player = scenario.cast.find(c => seatOf(c.id) === seat), state = session.snapshot();
    const portraitId = player ? player.id : gm;
    return el("article.trpg-sheet", { dataset: { test: "trpg-sheet-" + seat, npc: String(!player) } }, [
      el("div.trpg-sheet-head", [
        el("span.trpg-sheet-face", { "aria-hidden": "true" }, pcFace(seat, portraitId)),
        el("div", [el("small", { text: player ? "PL " + name(player.id) : "GM " + name(gm) + " が兼任" }),
          el("h3", { text: pc.name }), el("span", { text: pc.title || "" })]),
      ]),
      el("dl.trpg-sheet-stats", STATS.flatMap(k => [el("dt", { text: statLabel(k) }), el("dd", { dataset: { value: String(pc.stats[k]) } }, [
        el("i", { "aria-hidden": "true" }, Array.from({ length: 5 }, (_, i) => el("b", { class: i < pc.stats[k] ? "lit" : "" }))),
        el("span", { text: "＋" + pc.stats[k] })])])),
      pc.trait ? el("p.trpg-sheet-trait", { text: pc.trait }) : null,
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
      el("strong", { text: name(line.speaker) + " · " + line.role }), line.text,
    ])) : [el("p", { text: "卓を始めると、ここに会話が残ります。" })];
    let pop;
    pop = modal("卓のログ", rows, [button("卓に戻る", "trpg-log-close", () => pop.close(), { class: "primary" })]);
    pop?.box.querySelector(".trpg-modal-body")?.scrollTo(0, 99999);
  }
  function openHelp() {
    let pop;
    pop = modal("この卓の遊び方", [
      el("p", { text: presentation.help }),
      el("p", { text: Object.keys(sheets).length
        ? "場面ごとに、誰が・どの能力で動くかを宣言します。判定は20面ダイス二つの合計に、そのキャラクターの能力値を足します。30以上は成功、19〜29はひと手間、18以下は思わぬ出来事。どの結果でも物語は続きます。"
        : "判定は20面ダイス二つの合計に＋3。30以上は成功、19〜29はひと手間、18以下は思わぬ出来事。どの結果でも物語は続きます。" }),
      ...(Object.keys(sheets).length ? [el("p", { text: "仲間のキャラクターが初めて前に出ると、卓の盛り上がりが1上がります。能力値はキャラクターシートで確認できます。" })] : []),
      ...(scenario.builder ? [el("p", { text: "表紙の「キャラクターを作る」で、自分が演じる役の見た目・出自・名前と能力値（合計" + scenario.builder.points + "点）を決められます。" })] : []),
      el("p", { text: "共有する連携札は2枚。切り札を使うたび1枚使います。20のゾロ目（クリティカル）が出ると、1枚戻ります。" }),
      el("p", { text: "卓の盛り上がりは、うまくいった判定・思わぬ出来事・ゾロ目・仲間の見せ場・初めての相談・見立ての話し合いで上がります。3・6・8に届くたび、次の判定に勢い1つ（補正＋4、最大2つ）。" }),
      el("p", { text: "結末では卓を星3つで評価します。見立てが真相に合う、提案が本来の結末に届く、判定で2回以上うまくいく。" }),
      ...scenario.cast.filter(c => c.part !== "GM").map(c => el("p.trpg-help-ability", { text: name(c.id) + "「" + c.ability + "」 · " + c.abilityText })),
      el("p", { text: "切り札は各人一度ずつ。先に助けを借りるか、最後のために札を残すか、相談しながら決めましょう。" }),
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
    if (timer) clearTimeout(timer);
    if (rollTicker) clearInterval(rollTicker);
    if (providedAudio) audio.silence(); else audio.destroy();
    document.removeEventListener("visibilitychange", visibility);
    root.removeEventListener("keydown", keys);
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
  visibility();
  renderBody(); root.focus({ preventScroll: true });
  return { finished, snapshot: () => session.snapshot(),
    destroy: () => finish(completed || { cancelled: true, scenarioId: scenario.id }), get disposed() { return disposed; } };
}

