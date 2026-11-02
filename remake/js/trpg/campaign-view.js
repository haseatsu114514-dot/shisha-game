import { storeLogo } from "../core/store-logos.js";
import { spendableMoney } from "../core/travel-budget.js";
import { el, yen } from "../core/util.js";
import { chapterDay } from "../core/chapter-clock.js";
import { venueHost } from "../core/venue-host.js";
import { newDayTrial, rollDayTrial, stopDayTrial } from "./day-trial.js";
import { loadTrpgLibrary, preloadTrpgAssets, runTrpg } from "./index.js";
import { displayName, portraitUrl, portraitTop, sceneArt } from "./presentation.js";
import { participantStatus, recruitmentStatus, foundTrpgClub, tableStatus, syncTrpgStock, buyTrpgBook, castTrpgTable, materializeTrpgCast, completeTrpgTable } from "./campaign.js";

/** Owns a shop/table screen. Only the supplied state and save callback may change. */
export function mountTrpgCampaign(host, { getState, save = () => {}, nightBusy = () => false,
  readOnly = false, closeLabel = "街へ戻る", signal, resources: suppliedResources = null, visitMember = null } = {}) {
  const abort = new AbortController();
  const owner = getState();
  const visitStamp = owner && `${owner.chapter}:${owner.day}:${owner.slot}`;
  let trial = null;
  let reflection = null;
  let justFounded = false; // 設立した直後だけ、気づけば部長になっていた場面を出す
  let foundingChoice = null;
  let disposed = false, resources = null, busy = false, completed = false, root = null;
  let resolveFinished;
  const finished = new Promise(r => { resolveFinished = r; });
  const button = (text, test, action, disabled = false) => el("button.trpg-button", {
    type: "button", text, disabled, dataset: { test }, onclick: () => {
      if (getState() !== owner) { close(); return; }
      if (!disposed && !busy) action();
    },
  });
  function close() {
    if (disposed) return;
    disposed = true; abort.abort(); root?.remove();
    signal?.removeEventListener("abort", close);
    resolveFinished({ completed });
  }
  if (signal?.aborted) close(); else signal?.addEventListener("abort", close, { once: true });

  function render(message = "") {
    if (disposed) return;
    const state = getState(), { catalog, scenarios, characters, manifest, club } = resources;
    if (state !== owner) { close(); return; }
    if (!readOnly && !completed && syncTrpgStock(state, catalog)) save();
    const daytime = !readOnly && !completed && state?.phase === "daily" && state.chapter >= catalog.unlockChapter && state.slot === 0;
    const hostLine = key => club.branches["host_" + key][0].text;
    const options = { nightBusy: nightBusy() };
    const time = tableStatus(state, catalog, options);
    const name = id => displayName(characters, id);
    // 設立の場面の1行。サイは「」、はじめは名前付き、地の文はそのまま
    const clubLine = line => line.speaker ? el("p.trpg-club-line", { dataset: { speaker: line.speaker } }, [
      el("small", { text: name(line.speaker) }), line.speaker === "hajime" && line.text.startsWith("（") ? line.text : "「" + line.text + "」",
    ]) : el("p.trpg-club-line.trpg-club-narration", { text: line.text });
    root = el("section.trpg-root.trpg-campaign", { tabindex: "-1", dataset: { phase: "campaign" } });
    root.append(el("header.trpg-campaign-header", [
      el("div", [!readOnly ? storeLogo("trpg_bar", { width: 130, height: 72 }) : null, el("span.trpg-kicker", { text: readOnly ? "TABLETOP MEMORIES" : "ボドゲカフェ / TABLETOP CAFE" }),
        el("h1", { text: readOnly ? "みんなと遊んだ、本の棚。" : completed ? "この夜の物語が、本棚に残った。" : daytime ? "昼の一卓、本棚の一冊。" : "今夜、誰と物語を囲む？" })]),
      el("div.trpg-campaign-meta", [el("span", { text: state ? `CH.${state.chapter} · DAY ${chapterDay(state)} · ${yen(state.money)}` : "まだ本棚は空です" }),
        button(closeLabel, "trpg-campaign-close", close)]),
    ]));
    if (!readOnly) root.append(venueHost("sai", hostLine(completed ? reflection || "after_table" : trial
      ? trial.done ? trial.total > 7 ? "bust" : trial.total === 7 ? "seven" : "stop" : trial.rolls.length ? "push" : "trial"
      : daytime ? "day" : "night"), resources));
    if (completed) {
      root.append(el("p.trpg-campaign-notice", { text: "誰と迎えた結末か、今夜の思い出を本棚にしまった。" }));
      if (!reflection) root.append(el("div.trpg-trial-actions", [
        button("うまくいった場面を話す", "trpg-reflect-good", () => { reflection = "after_table_good"; render(); }),
        button("苦戦した場面を話す", "trpg-reflect-hard", () => { reflection = "after_table_hard"; render(); }),
      ]));
      host.replaceChildren(root); root.focus({ preventScroll: true }); return;
    }
    root.append(el("p.trpg-campaign-notice", { role: "status", dataset: { test: "trpg-campaign-notice" },
      text: message || (readOnly ? "第2章から部活を作り、仲間を勧誘して、一緒に遊んだ物語を残せます。"
        : daytime ? trial ? "試遊は無料。いつでも本棚へ戻れます。" : "昼は試遊と本選び。TRPGは夜にどうぞ。" : time.reason) }));
    if (daytime) {
      const canTry = () => !disposed && getState() === owner && owner.slot === 0 && owner.phase === "daily"
        && `${owner.chapter}:${owner.day}:${owner.slot}` === visitStamp;
      const act = update => { if (!canTry()) { trial = null; render(); return; } trial = update(); render(); };
      const panel = el("section.trpg-day-trial", { dataset: { test: "trpg-day-trial" } }, [
        el("h2", { text: "店長と試遊 · 七つの灯り" }),
        el("p", { text: "サイコロの合計を7に近づけよう。振り足すか、止めるか。7を超えると失敗。無料・時間消費なし。" }),
      ]);
      if (trial) {
        panel.append(el("div.trpg-trial-score", { "aria-live": "polite" }, [
          el("span.trpg-trial-die", { text: trial.rolls.length ? "⚀⚁⚂⚃⚄⚅"[trial.rolls.at(-1) - 1] : "◇", "aria-hidden": "true" }),
          el("strong", { text: `${trial.total} / 7`, dataset: { test: "trpg-trial-total" } }),
          el("span", { text: trial.done ? trial.total > 7 ? "あふれた！" : trial.total === 7 ? "ぴったり！" : "ここで確定" : "" }),
        ]), el("p", { text: trial.rolls.length ? "出た目：" + trial.rolls.join(" → ") : "最初の一振りをどうぞ。" }),
        el("div.trpg-trial-actions", [
          button("サイコロを振る", "trpg-trial-roll", () => act(() => rollDayTrial(trial, 1 + Math.floor(Math.random() * 6))), trial.done),
          button("ここで止める", "trpg-trial-stop", () => act(() => stopDayTrial(trial)), trial.done || !trial.rolls.length),
          button("本棚へ戻る", "trpg-trial-back", () => { trial = null; render(); }),
        ]));
      } else panel.append(button("無料で試してみる", "trpg-trial-open", () => act(newDayTrial)));
      root.append(panel);
      if (trial) { host.replaceChildren(root); root.focus({ preventScroll: true }); return; }
    }
    if (!readOnly && !state?.trpg?.club?.founded && state?.chapter >= catalog.unlockChapter) {
      root.append(el("section.trpg-club-proposal", { dataset: { test: "trpg-club-proposal" } }, [
        el("span.trpg-kicker", { text: "六角サイからの提案" }),
        el("h2", { text: "ここで、部活を作ってみませんか？" }),
        ...club.lines.map(clubLine),
        ...[
          ["店の仕事があると伝える", "trpg-club-choice-time", "proposal_time"],
          ["知り合いを誘うのは苦手と伝える", "trpg-club-choice-people", "proposal_people"],
        ].map(([label, test, choice]) => button(label, test, () => {
          // どちらの断り文句も「手伝う」返事に言い換えられる。
          if (foundTrpgClub(getState(), catalog)) { save(); foundingChoice = choice; justFounded = true; render("「" + catalog.club.name + "」の部長になりました（いつの間にか）。仲のいい相手と対面した時に、部活へ誘ってみよう。"); }
        }, state.phase !== "daily")),
      ]));
      root.append(el("p", { text: "好感度MAXの友人も恋人も、興味があれば入部。勧誘に追加の時間はかかりません。本の購入も時間を使いません。" }));
      host.replaceChildren(root); root.focus({ preventScroll: true }); return;
    }
    if (justFounded && club.branches.founded) {
      root.append(el("section.trpg-club-proposal.trpg-club-founded", { dataset: { test: "trpg-club-founded" } },
        [...(club.branches[foundingChoice] || []), ...club.branches.founded].map(clubLine)));
      justFounded = false;
    }
    const party = el("div.trpg-campaign-party", { "aria-label": "仲間の今夜の予定" });
    for (const person of catalog.participants.filter(p => state?.met?.[p.id])) {
      const status = participantStatus(state, person);
      const member = !!state.trpg?.club?.members?.[person.id];
      const recruitment = recruitmentStatus(state, person, catalog);
      party.append(el("div.trpg-campaign-person", { dataset: { test: "trpg-person-" + person.id, available: status.ok } }, [
        el("span.trpg-campaign-face", el("img", { src: portraitUrl(manifest, person.id), alt: "",
          style: { top: portraitTop(manifest, person.id, 180, 4), transform: "translateX(-" + manifest.portraits[person.id].ax * 100 + "%)" } })),
        el("div", [el("strong", { text: name(person.id) + (member ? " · 部員" : "") }),
          el("small", { text: member ? status.reason : recruitment.reason }),
          !member && el("small", { text: person.interestHint })]),
      ]));
    }
    if (!party.children.length) party.append(el("p", { text: "仲間と親しくなると、一緒に遊べる物語が増えていきます。" }));
    root.append(party);
    if (!readOnly && !daytime && !completed && !scenarios.some(scenario =>
      state?.trpg?.owned?.includes(scenario.id) && !state?.trpg?.cleared?.[scenario.id]
      && castTrpgTable(state, catalog, scenario, options).ok)) {
      root.append(el("p.trpg-campaign-notice", { dataset: { test: "trpg-preparation-notice" },
        text: "今は遊べる本と仲間が揃っていません。下の入荷条件と仲間の予定を確認し、交流・勧誘から準備しよう。" }));
    }
    if (visitMember && !readOnly && state.trpg?.club?.founded) {
      root.append(el("div.trpg-club-demo-visits", { "aria-label": "試遊用の対面会話" }, [
        el("small", { text: "試遊：知り合いに会って勧誘する" }),
        ...catalog.participants.filter(p => recruitmentStatus(state, p, catalog).ok).map(p =>
          button(name(p.id) + "に会う", "trpg-demo-meet-" + p.id, async () => {
            busy = true;
            try { await visitMember(p.id, resources, abort.signal); }
            finally { busy = false; if (!disposed) render(); }
          })),
      ]));
    }
    const books = el("div.trpg-campaign-books", { dataset: { many: String(scenarios.length > 2) } });
    for (const scenario of scenarios) {
      const book = catalog.scenarios.find(b => b.id === scenario.id);
      const memory = state?.trpg?.cleared?.[book.id];
      const owned = state?.trpg?.owned?.includes(book.id);
      const stocked = state?.trpg?.stock?.includes(book.id);
      const cast = state ? castTrpgTable(state, catalog, scenario, options) : { ok: false };
      const card = el("article.trpg-campaign-book", { dataset: { theme: scenario.presentation.theme, test: "trpg-book-" + book.id } });
      card.append(el("div.trpg-campaign-book-art", [sceneArt(el, scenario),
        el("span.trpg-campaign-book-badge", { text: memory ? "遊び終えた物語" : owned ? "あなたの本棚" : stocked ? "入荷しました" : "これからの一冊" })]));
      const copy = el("div.trpg-campaign-book-copy", [
        el("small", { text: scenario.collection + " / 作 · " + scenario.author }),
        el("h2", { text: scenario.title }), el("p", { text: scenario.presentation.tagline }),
      ]);
      if (memory) {
        // 旧章内日の記録はそのまま。通算日で残した第2章の記録だけ章内日へ表示する。
        const memoryClock = { ...memory, flags: memory.day >= (state?.flags?._ch2_day1?.startDay ?? Infinity) ? state.flags : {} };
        copy.append(el("div.trpg-campaign-memory", { dataset: { test: "trpg-memory-" + book.id } }, [
          el("strong", { text: memory.endingTitle || scenario.endings[memory.ending]?.title || memory.ending }),
          el("p", { text: `CH.${memory.chapter} · DAY ${chapterDay(memoryClock)} / ${memory.participants.map(name).join("・")}` }),
          Number.isInteger(memory.stars) ? el("span.trpg-campaign-stars", { text: "★".repeat(memory.stars) + "☆".repeat(3 - memory.stars),
            "aria-label": "卓の評価 星" + memory.stars + "つ", dataset: { test: "trpg-memory-stars" } }) : null,
          memory.night ? el("small.trpg-campaign-night", { text: memory.night + "（盛り上がり " + memory.heat + "）" }) : null,
          memory.pc?.name ? el("small.trpg-campaign-pc", { dataset: { test: "trpg-memory-pc" }, text: "演じた役 " + memory.pc.name + (memory.pc.title ? "（" + memory.pc.title + "）" : "") }) : null,
          el("small", { text: "この夜の結末を、みんなとの思い出に。" }),
        ]));
      } else if (!stocked && !owned) {
        copy.append(el("p", { text: "入荷のきっかけ：" + book.stockRequires.map(name).join("・") + "が部活に入る" }));
      } else if (!owned) {
        copy.append(el("p", { text: `シナリオ本 ${yen(book.price)} · 買い物は時間を使いません` }),
          button("本棚に加える · " + yen(book.price), "trpg-buy-" + book.id, () => {
            if (buyTrpgBook(getState(), catalog, book.id)) { save(); warmOwnedScenarios(); render("新しいTRPGが、本棚に加わりました。"); }
            else render("本棚に加えられませんでした。所持金と入荷状況を確認してください。");
          }, readOnly || spendableMoney(state) < book.price));
      } else {
        copy.append(el("p", { text: cast.ok ? "今夜の卓：" + cast.participants.map(name).join("・") : cast.reason }),
          el("small", { text: scenario.duration + " · 夜の1枠 · 結末を迎えた本は一度きり" }),
          button("この仲間で遊ぶ", "trpg-play-" + book.id, () => play(scenario), readOnly || !cast.ok));
      }
      card.append(copy); books.append(card);
    }
    root.append(books, el("footer.trpg-campaign-footer", { text: "営業が終わるまで待ってから、空いている部員と集まる。中断した本は、また遊べます。" }));
    host.replaceChildren(root); root.focus({ preventScroll: true });
  }

  async function play(scenario) {
    const state = getState();
    const cast = castTrpgTable(state, resources.catalog, scenario, { nightBusy: nightBusy() });
    if (readOnly || !cast.ok) { render(cast.reason); return; }
    busy = true;
    const ticket = { ...cast, chapter: state.chapter, day: state.day, slot: state.slot };
    try {
      const table = materializeTrpgCast(scenario, cast.assignments);
      await runTrpg(host, { resources: { ...resources, scenario: table }, signal: abort.signal,
        seed: ((state.seed || 1) ^ state.day * 7919 ^ state.chapter * 104729 ^ scenario.title.length * 997) >>> 0,
        allowReplay: false, closeLabel: "思い出を本棚へ",
        // The shopkeeper explains the table until the first story is finished; the cover button replays it any time.
        tutorial: !state.flags?._trpg_tutorial_seen,
        onComplete: result => {
          if (!disposed && getState() === state && completeTrpgTable(state, resources.catalog, scenario, ticket, result, { nightBusy: nightBusy() })) {
            state.flags ||= {}; state.flags._trpg_tutorial_seen = true;
            completed = true; save();
          }
        } });
      if (disposed) return;
      busy = false;
      if (completed) render(); else render("卓を片付けました。本は未クリアのまま、また遊べます。");
    } catch (error) {
      busy = false;
      if (!disposed) render("卓を開けませんでした。本と今夜の行動は残っています。");
      console.error(error);
    }
  }

  const warmed = new Set();
  // 所持している本の素材は、本棚の表示を待たせずに裏で先読みする（卓の開始は同期のまま）。
  function warmOwnedScenarios() {
    const state = getState();
    if (readOnly || !resources || !state?.trpg?.owned) return;
    for (const scenario of resources.scenarios) {
      if (!state.trpg.owned.includes(scenario.id) || warmed.has(scenario.id)) continue;
      warmed.add(scenario.id);
      preloadTrpgAssets(resources, scenario, { signal: abort.signal }).catch(() => {});
    }
  }

  async function load() {
    if (disposed) return;
    host.replaceChildren(el("div.trpg-loading", [el("p", { text: "本棚と、仲間の予定を確認しています…" }),
      button(closeLabel, "trpg-campaign-close", close)]));
    try { resources = suppliedResources || await loadTrpgLibrary({ signal: abort.signal, preloadAssets: false }); render(); warmOwnedScenarios(); }
    catch {
      if (disposed) return;
      host.replaceChildren(el("div.trpg-loading", [el("p", { role: "status", text: "本棚を読み込めませんでした。もう一度お試しください。" }),
        button("再読み込み", "trpg-campaign-retry", load), button(closeLabel, "trpg-campaign-close", close)]));
    }
  }
  const ready = load();
  return { ready, finished, destroy: close, get disposed() { return disposed; } };
}
