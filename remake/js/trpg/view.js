import { el } from "../core/util.js";
import { TrpgSession } from "./session.js";
import { displayName, portraitUrl, portraitTop as topFor, sceneUrl } from "./presentation.js";
import { createTrpgAudio } from "./audio.js";

const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
const PHASES = { cover: 0, listen: 1, explore: 2, prepare: 3, serve: 4, ending: 4 };
const LABELS = { success: "うまくいった", mixed: "ひと手間かかる", trouble: "思わぬ出来事" };

/** Mounts one isolated session; finished resolves only after the player leaves the table. */
export function mountTrpg(host, { scenario, characters, manifest, seed, profileId = null, closeLabel = "卓を片付ける", audio: providedAudio = null, allowReplay = true, onComplete = () => {} }) {
  const session = new TrpgSession(scenario, { seed, profileId });
  const cast = Object.fromEntries(scenario.cast.map(c => [c.id, c]));
  const gm = scenario.cast.find(c => c.part === "GM").id;
  const presentation = scenario.presentation;
  const audio = providedAudio || createTrpgAudio(presentation.theme);
  audio.setTheme(presentation.theme);
  const scripts = Object.fromEntries(scenario.dialogues.map(d => [d.dialogue_id, d.lines]));
  const root = el("section.trpg-root", { tabindex: "-1", dataset: { phase: "cover", theme: presentation.theme } });
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
  let frames = [], cursor = 0, afterTalk = null, busy = false, disposed = false;
  let overlay = null, modalCloser = null, timer = null, rollTicker = null, settleGuard = false;
  let resolveFinished, completed = null;
  const finished = new Promise(resolve => { resolveFinished = resolve; });
  const progress = el("span.trpg-step", { "aria-label": "物語の進行" });
  const table = el("div.trpg-table", { "aria-label": "卓の参加者" });
  const sound = button(audio.enabled ? "音 ON" : "音 OFF", "trpg-audio", async () => {
    sound.disabled = true;
    await audio.setEnabled(!audio.enabled);
    if (!disposed) { sound.textContent = audio.enabled ? "音 ON" : "音 OFF"; sound.setAttribute("aria-pressed", String(audio.enabled)); sound.disabled = !audio.available; }
  }, { class: "small", "aria-pressed": String(audio.enabled), disabled: !audio.available });
  const tools = el("div.trpg-tools", [sound,
    button("メモ", "trpg-notes", openNotes, { class: "small" }),
    button("ログ", "trpg-log", openLog, { class: "small" }),
    button("遊び方", "trpg-help", openHelp, { class: "small" }),
    button("戻る", "trpg-exit", exit, { class: "small" }),
  ]);
  root.append(el("header.trpg-header", [
    el("div.trpg-heading", [el("small", { text: "小さな卓の冒険 / " + presentation.number }),
      el("strong", { text: scenario.title }), progress]), tools,
  ]), table, content, dock);
  host.replaceChildren(root);

  function button(label, test, action, attrs = {}) {
    return el("button.trpg-button", { type: "button", text: label, dataset: { test },
      onclick: () => { if (!disposed) { audio.play("tap"); action(); } }, ...attrs });
  }
  function name(id) {
    return displayName(characters, id);
  }
  function portrait(id, face = "normal") {
    return portraitUrl(manifest, id, face);
  }
  function portraitTop(id, width, headY) {
    return topFor(manifest, id, width, headY);
  }
  function syncChrome() {
    const state = session.snapshot();
    root.dataset.phase = state.phase;
    root.dataset.risk = state.pressure >= 5 ? "high" : "calm";
    root.style.setProperty("--risk-level", state.pressure / session.rules.pressureMax);
    progress.replaceChildren(...[1, 2, 3, 4].map(n => el("i", { class: n <= PHASES[state.phase] ? "done" : "" })),
      el("small", { text: "連携札 " + state.teamwork + "/2", dataset: { test: "trpg-teamwork" } }));
    table.replaceChildren(...scenario.cast.map(c => el("span.trpg-table-person", {
      text: name(c.id) + " · " + (c.part === "GM" ? "GM" : c.role.split("／")[0]),
      dataset: { speaker: c.id },
    })));
    const covering = state.phase === "cover";
    dock.hidden = covering;
    table.hidden = covering;
    progress.hidden = covering;
  }
  function sequence(...ids) { return ids.flatMap(id => typeof id === "string" ? scripts[id] || [] : id).filter(Boolean); }
  function talk(lines, callback) {
    frames = sequence(lines); cursor = 0; afterTalk = callback; busy = true;
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
    speech.textContent = frame.text;
    next.textContent = cursor + 1 < frames.length ? "次へ" : "続ける";
    table.querySelectorAll("[data-speaker]").forEach(n => n.classList.toggle("active", n.dataset.speaker === frame.speaker));
    log.push({ speaker: frame.speaker, role: role.textContent, text: frame.text });
  }
  function advanceDialogue() {
    if (!busy || overlay || disposed) return;
    cursor++;
    if (cursor < frames.length) showFrame(); else finishTalk();
  }
  function finishTalk() {
    busy = false; frames = [];
    const callback = afterTalk; afterTalk = null;
    next.hidden = true; root.classList.add("trpg-idle");
    if (callback) callback(); else renderBody();
    if (!overlay && !busy) root.focus({ preventScroll: true });
  }
  function idle(text) {
    if (busy) return;
    art.replaceChildren(el("img", { src: portrait(gm), alt: name(gm),
      style: { top: portraitTop(gm, 410, 16) } }));
    art.style.backgroundColor = cast[gm].color;
    speaker.textContent = name(gm); role.textContent = "GM／卓の会話"; speech.textContent = text;
    dock.dataset.layer = "table";
    root.classList.add("trpg-idle"); next.hidden = true;
  }
  function start() {
    if (session.snapshot().phase !== "cover") return;
    session.start(); syncChrome();
    audio.play("open");
    talk(sequence(scenario.intro, scenario.listen, [{ speaker: gm, role: presentation.arrivalRole, text: session.profile.arrival }]),
      () => { renderBody(); openCheck("listen"); });
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
          "aria-label": spot.label + (checked ? "、調査済み" : "を調べる"),
          style: { left: spot.x + "%", top: spot.y + "%" }, dataset: { test: "trpg-spot-" + spot.id },
          onclick: () => {
            if (busy || overlay) return;
            const clue = session.inspect(spot.id);
            audio.play(clue.fresh ? "clue" : "tap");
            talk(clue.evidence.lines, () => { renderBody(); idle(presentation.exploreIdle); });
          },
        }, [el("i", { text: checked ? "✓" : String(i + 1) }), el("span", { text: spot.short })]));
      });
    }
    return node;
  }
  function side(kicker, title, description) {
    return el("aside.trpg-side", [el("div.trpg-kicker", { text: kicker }),
      el("h2", { text: title }), el("p", { text: description })]);
  }
  function clueButtons() {
    const node = el("div.trpg-evidence");
    const clues = session.snapshot().clues;
    if (!clues.length) node.append(el("p", { text: "見つけた手がかりを、ここに残していきます。" }));
    clues.forEach((id, i) => {
      const evidence = session.profile.evidence[id];
      node.append(el("button.trpg-clue", { type: "button", dataset: { test: "trpg-clue-" + id },
        onclick: () => openClue(id) }, [el("span", { text: String(i + 1).padStart(2, "0") }), evidence.title]));
    });
    return node;
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
    const panel = side(copy.kicker, copy.title, copy.description);
    if (presentation.theme === "shark") panel.append(el("div.trpg-risk", { dataset: { test: "trpg-risk" } }, [
      el("span", { text: "危機 " + state.pressure + "/6" }),
      el("div", { "aria-hidden": "true" }, [1,2,3,4,5,6].map(i => el("i", { class: i <= state.pressure ? "filled" : "" }))),
    ]));
    if (state.phase === "listen") {
      panel.append(clueButtons());
      if (!busy) panel.append(button("判定へ", "trpg-listen-open", () => openCheck("listen"), { class: "primary" }));
      idle(presentation.listenIdle);
    } else if (state.phase === "explore") {
      panel.append(clueButtons(), el("div.trpg-support", [
        ...Object.keys(scenario.consult).map(id => button(name(id) + "に相談", "trpg-consult-" + id, () => consult(id), { disabled: busy })),
      ]), button(copy.button + " · " + state.clues.length + "/" + session.rules.exploreLimit, "trpg-interpret", chooseHypothesis,
        { class: "primary", disabled: busy || state.clues.length < 3 }));
      if (presentation.theme === "shark") panel.append(el("small.trpg-budget", { text: "調査はあと " + (session.rules.exploreLimit - state.clues.length) + " 箇所 · 再読と相談は無料" }));
      idle(presentation.exploreIdle);
    } else if (state.phase === "prepare") {
      scene.append(preparationChoices());
      const hypothesis = scenario.hypotheses.find(h => h.id === state.hypothesis);
      panel.append(el("div.trpg-hypothesis-note", { text: "今の見立て：" + hypothesis.label }), clueButtons(), button(copy.button, "trpg-prepare-open", () => openCheck("prepare"),
        { class: "primary", disabled: busy || session.flow.prepare.some(f => !state.plan[f]) }));
      idle(presentation.prepareIdle);
    } else if (state.phase === "serve") {
      scene.append(servingChoices());
      panel.append(clueButtons(), button(copy.button, "trpg-serve-open", () => openCheck("serve"),
        { class: "primary", disabled: busy || session.flow.serve.some(f => !state.plan[f]) }));
      idle(presentation.serveIdle);
    } else {
      const result = session.result(), ending = scenario.endings[result.ending];
      scene.append(el("div.trpg-ending", [
        el("div.trpg-kicker", { text: presentation.endingKicker }), el("h2", { text: ending.title, dataset: { test: "trpg-ending-title" } }),
        el("p", { text: ending.line }),
        el("div.trpg-ending-plan", Object.entries(result.plan).map(([field, id]) =>
          el("span", { text: scenario.options[field].find(o => o.id === id).label }))),
      ]));
      panel.append(clueButtons(), ...(allowReplay ? [button("もう一度、この物語", "trpg-replay", () => finish({ ...result, replayRequested: true }),
        { class: "primary", disabled: busy })] : []), button(closeLabel, "trpg-finish", () => finish(result), { disabled: busy }));
      idle(presentation.endingIdle);
    }
    content.append(scene, panel);
  }
  function consult(id) {
    if (busy || overlay) return;
    talk(session.consult(id), () => { renderBody(); idle(presentation.exploreIdle); });
  }
  function cover() {
    const castCards = scenario.cast.map(c => el("div.trpg-cast-card", {
      style: { "--person-color": c.color },
    }, [
      el("small", { text: c.part }),
      el("div.trpg-cast-art", el("img", { src: portrait(c.id), alt: name(c.id),
        style: { top: portraitTop(c.id, 305, 24) } })),
      el("strong", { text: name(c.id) }), el("p", { text: c.role }),
    ]));
    root.append(el("div.trpg-cover", [
      el("article.trpg-book", { style: { "--cover-art": 'url("' + sceneUrl(scenario) + '")' } }, [
        el("div.trpg-kicker", { text: scenario.collection }),
        el("h1", presentation.titleLines.map(text => el("span", { text }))),
        el("p", { text: scenario.subtitle }),
        el("div.trpg-book-author", { text: "作 · " + scenario.author }),
        el("div.trpg-book-stamp", [el("span", { text: "短編TRPG / 約10分" }), el("span", { text: "3人＋GM" })]),
      ]),
      el("div.trpg-cover-right", [
        el("h2", { text: presentation.coverHeading }),
        el("p", { text: scenario.premise }),
        el("div.trpg-cast", castCards),
        el("div.trpg-cover-rule", { text: presentation.coverRule + " 連携札を二枚持って、物語へ。" }),
        el("div.trpg-cover-actions", [
          button("この卓を始める", "trpg-start", start, { class: "primary" }),
          button("遊び方", "trpg-cover-help", openHelp),
        ]),
      ]),
    ]));
  }
  function optionButton(field, option) {
    const selected = session.snapshot().plan[field] === option.id;
    return el("button.trpg-button.trpg-plan-option", { type: "button", class: selected ? "selected" : "",
      disabled: busy, "aria-pressed": selected ? "true" : "false",
      dataset: { test: "trpg-plan-" + field + "-" + option.id },
      onclick: () => {
        if (busy || overlay) return;
        audio.play("tap"); session.plan(field, option.id); renderBody();
        root.querySelector('[data-test="trpg-plan-' + field + "-" + option.id + '"]')?.focus({ preventScroll: true });
      },
    }, [el("strong", { text: option.label }), el("span", { text: option.description })]);
  }
  function preparationChoices() {
    return el("div.trpg-plan", [
      el("h2", { text: presentation.prepareTitle }),
      el("p", { text: presentation.prepareDescription }),
      el("div.trpg-plan-columns", session.flow.prepare.map(field => el("div.trpg-plan-column", [
        el("h3", { text: presentation.fields[field] }),
        ...scenario.options[field].map(option => optionButton(field, option)),
      ]))),
    ]);
  }
  function servingChoices() {
    return el("div.trpg-plan", [
      el("h2", { text: presentation.serveTitle }),
      el("p", { text: presentation.serveDescription }),
      el("div.trpg-serve-options", scenario.options[session.flow.serve[0]].map(option => optionButton(session.flow.serve[0], option))),
    ]);
  }
  function modal(title, body, actions, { dismiss = true } = {}) {
    if (overlay || disposed) return null;
    const previousFocus = document.activeElement;
    const box = el("section.trpg-modal", { role: "dialog", "aria-modal": "true", "aria-label": title },
      [el("h2", { text: title }), el("div.trpg-modal-body", body), el("div.trpg-modal-actions", actions)]);
    overlay = el("div.trpg-overlay", box);
    root.append(overlay);
    const close = () => {
      overlay?.remove(); overlay = null; modalCloser = null;
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true }); else root.focus({ preventScroll: true });
    };
    modalCloser = dismiss ? close : null;
    box.querySelector("button:not(:disabled), input")?.focus({ preventScroll: true });
    return { close, box };
  }
  function chooseHypothesis() {
    if (busy || overlay) return;
    let pop;
    const choices = scenario.hypotheses.map(h => el("button.trpg-button", { type: "button",
      dataset: { test: "trpg-hypothesis-" + h.id },
      onclick: () => {
        if (!pop || busy) return;
        session.interpret(h.id); pop.close();
        talk(scenario.preparation, () => renderBody());
      },
    }, [el("strong", { text: h.label }), el("span", { text: h.description })]));
    pop = modal(presentation.hypothesisTitle, el("div.trpg-choice-list", choices),
      [button("もう少し調べる", "trpg-hypothesis-back", () => pop.close())]);
  }
  function die(value, rolling = false) {
    const node = el("div.trpg-die", { class: rolling ? "rolling" : "", role: "img", "aria-label": "サイコロ " + value });
    for (let i = 0; i < 9; i++) node.append(el("i.trpg-pip", { style: { opacity: PIPS[value].includes(i) ? 1 : 0 } }));
    return node;
  }
  function openCheck(kind) {
    if (busy || overlay || session.snapshot().pending) return;
    const check = scenario.checks[kind], helper = check.helper || null;
    const body = el("div", [el("p", { text: check.hint }),
      el("div.trpg-dice-row", [die(1), die(1), el("span.trpg-dice-bonus", { text: "＋1" })])]);
    const support = helper && !session.snapshot().used[helper] && session.snapshot().teamwork > 0
      ? el("input", { type: "checkbox", dataset: { test: "trpg-support-" + helper } }) : null;
    if (support) body.append(el("label.trpg-aid", [support,
      name(helper) + "の「" + cast[helper].ability + "」＋2 · 連携札1枚"]));
    if (support) support.addEventListener("change", () => {
      body.querySelector(".trpg-dice-bonus").textContent = support.checked ? "＋3" : "＋1";
    });
    if (helper && !support) body.append(el("p", { text: "この判定では連携札を使えません。手元の作戦で進めましょう。" }));
    let pop;
    const roll = button("サイコロを振る", "trpg-roll", () => {
      if (session.snapshot().pending) return;
      const result = session.beginCheck(kind, { support: !!support?.checked });
      roll.disabled = true;
      modalCloser = null;
      pop.box.querySelectorAll("input,button").forEach(n => { n.disabled = true; });
      body.querySelector(".trpg-dice-row").replaceChildren(die(1, true), die(1, true),
        el("span.trpg-dice-bonus", { text: "＋" + result.bonus }));
      settleGuard = false;
      audio.play("roll");
      const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!reduced) rollTicker = setInterval(() => {
        body.querySelector(".trpg-dice-row")?.replaceChildren(die(Math.ceil(Math.random()*6), true), die(Math.ceil(Math.random()*6), true),
          el("span.trpg-dice-bonus", { text: "＋" + result.bonus }));
      }, 90);
      timer = setTimeout(() => {
        timer = null; clearInterval(rollTicker); rollTicker = null;
        if (!disposed) showRollResult(pop, body);
      }, reduced ? 40 : 650);
    }, { class: "primary" });
    pop = modal(check.title, body, [button("卓に戻る", "trpg-check-back", () => pop.close()), roll]);
  }
  function showRollResult(pop, body) {
    const result = session.checkResult();
    body.replaceChildren(
      el("p", { text: scenario.checks[result.kind].hint }),
      el("div.trpg-dice-row", [die(result.dice[0]), die(result.dice[1]), el("span.trpg-dice-bonus", { text: "＋" + result.bonus })]),
      el("div.trpg-dice-total", { dataset: { test: "trpg-roll-total" } }, [
        "合計 " + result.total, el("span.trpg-dice-grade", { text: LABELS[result.grade] }),
      ]),
    );
    if (result.hypothesisBonus) body.append(el("p.trpg-roll-insight", { text: "見立てが合っていた · 仕掛けに ＋" + result.hypothesisBonus }));
    if (presentation.theme === "shark") body.append(el("p.trpg-roll-consequence", { text: result.grade === "success" ? "危機を進めず、次の場面へ" : "危機 ＋" + session.rules.checkPressure[result.grade] + " · 全員で次の場面へ" }));
    if (!session.snapshot().used[session.rerollActor] && session.snapshot().teamwork > 0) {
      body.append(el("p.trpg-roll-trump", { text: name(session.rerollActor) + "の「" + cast[session.rerollActor].ability + "」 · 連携札1枚" }));
      body.append(el("div.trpg-rerolls", [0, 1].map(i =>
      button((i + 1) + "個目を振り直す", "trpg-reroll-" + i, () => {
        if (settleGuard || session.snapshot().used[session.rerollActor] || session.snapshot().teamwork < 1) return;
        audio.play("roll");
        session.reroll(i); showRollResult(pop, body);
      }))));
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
      talk(sequence(...responses, scenario.checks[settled.kind][settled.grade]), continuation);
    }, { class: "primary" }));
    actions.querySelector("button").focus({ preventScroll: true });
  }
  function openClue(id) {
    const evidence = session.profile.evidence[id];
    let pop;
    pop = modal(evidence.title, [
      el("div.trpg-note-head", { text: scenario.spots.find(s => s.id === id).label }),
      el("p.trpg-note-text", { text: evidence.text }),
    ], [button("メモを閉じる", "trpg-clue-close", () => pop.close(), { class: "primary" })]);
  }
  function openNotes() {
    const clues = session.snapshot().clues;
    const rows = clues.length ? clues.map(id => {
      const e = session.profile.evidence[id];
      return el("div.trpg-note-text", [el("strong", { text: e.title }), el("p", { text: e.text })]);
    }) : [el("p", { text: "部屋を調べると、ここに手がかりが残ります。" })];
    let pop;
    pop = modal("調査メモ", rows, [button("卓に戻る", "trpg-notes-close", () => pop.close(), { class: "primary" })]);
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
      el("p", { text: "判定はサイコロ二つの合計に＋1。10以上は成功、7〜9はひと手間、6以下は思わぬ出来事。どの結果でも物語は続きます。" }),
      el("p", { text: "共有する連携札は2枚。切り札を使うたび1枚使います。" }),
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
    root.removeEventListener("keydown", keys);
    root.remove();
  }
  function keys(event) {
    if (event.repeat) return;
    if (overlay) {
      if (event.key === "Escape" && modalCloser) { event.preventDefault(); modalCloser(); }
      if (event.key === "Tab") {
        const nodes = [...overlay.querySelectorAll("button:not(:disabled),input:not(:disabled)")];
        if (!nodes.length) return;
        const first = nodes[0], last = nodes[nodes.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
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
  renderBody(); root.focus({ preventScroll: true });
  return { finished, snapshot: () => session.snapshot(),
    destroy: () => finish(completed || { cancelled: true, scenarioId: scenario.id }), get disposed() { return disposed; } };
}
