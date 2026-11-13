import { storeLogo } from "../core/store-logos.js";
import { spendableMoney } from "../core/travel-budget.js";
import { el, yen } from "../core/util.js";
import { chapterDay } from "../core/chapter-clock.js";
import { venueHost } from "../core/venue-host.js";
import { gearOffer, ownsGear } from "../core/hobby-gear.js";
import { newDayTrial, rollDayTrial, stopDayTrial } from "./day-trial.js";
import { loadTrpgLibrary, preloadTrpgAssets, runTrpg } from "./index.js";
import { playTrpgEntrance } from "./entrance.js";
import { shelfHelpButton } from "./shelf-help.js";
import { displayName, portraitUrl, portraitAx, portraitTop, sceneArt } from "./presentation.js";
import { participantStatus, recruitmentStatus, foundTrpgClub, tableStatus, syncTrpgStock, buyTrpgBook, castTrpgTable, materializeTrpgCast, completeTrpgTable, keepTrpgBookmark, trpgBookmarkFor, clubRecord, clubGain, trpgBookProgress } from "./campaign.js";

// 店の決まりは画面に常に出さず、右上の「？」で読む（#2719・ミニゲーム共通のUI方針）。
const SHOP_HELP = [
  ["夜の卓", "営業が終わるまで待ってから、空いている部員と集まって遊びます（夜の1枠）。中断した本は、しおりから続きを遊べます。結末を迎えた本も、もう一度遊べます。"],
  ["部のランク", "遊び終えた本・見た結末・星の数で、部の実績が貯まります（1冊につき 遊び終えた＋2、結末1つ＋1、星1つ＋1）。ランクが上がると、はじめの役の能力に成長点が付きます（ランク2で＋1、ランク4で＋2）。"],
  ["本を買う", "入荷したシナリオ本を本棚に加えると、仲間と遊べます。買い物は時間を使いません。"],
  ["9冊の物語", "部員それぞれの物語が1冊ずつ。部員なしで遊べる2冊は、サイと店の常連が卓を囲みます。部員の6冊を遊び終えると、サイの最後の物語が入荷します。空いた仲間の席は、この店の常連が手伝います。"],
  ["部活と勧誘", "相手から部活の話を聞いたら、好感度に関係なく対面で誘えます。勧誘に追加の時間はかかりません。"],
  ["昼の試遊（七つの灯り）", "サイコロの合計を7に近づけます。振り足すか、止めるか。7を超えると失敗です。無料で、時間も使いません。"],
];

/** Owns a shop/table screen. Only the supplied state and save callback may change. */
export function mountTrpgCampaign(host, { getState, save = () => {}, nightBusy = () => false,
  readOnly = false, closeLabel = "街へ戻る", signal, resources: suppliedResources = null, visitMember = null, greeted = false } = {}) {
  const abort = new AbortController();
  const owner = getState();
  const visitStamp = owner && `${owner.chapter}:${owner.day}:${owner.slot}`;
  let trial = null;
  let reflection = null;
  let justFounded = false; // 設立した直後だけ、気づけば部長になっていた場面を出す
  let foundingChoice = null;
  let disposed = false, resources = null, busy = false, completed = false, root = null, entrance = null, lastGain = null;
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
    disposed = true; abort.abort(); root?.remove(); entrance?.cancel();
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
    const seated = key => greeted && club.branches["host_" + key + "_seated"] ? key + "_seated" : key;
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
        shelfHelpButton(() => root, { title: "ボドゲカフェの遊び方", sections: SHOP_HELP, test: "trpg-campaign-help" }),
        button(closeLabel, "trpg-campaign-close", close)]),
    ]));
    if (!readOnly) root.append(venueHost("sai", hostLine(completed ? reflection || "after_table" : trial
      ? trial.done ? trial.total > 7 ? "bust" : trial.total === 7 ? "seven" : "stop" : trial.rolls.length ? "push" : "trial"
      // 入口でサイと話したばかりの来店（daily/venue-arrivals.js）は、挨拶を繰り返さず棚へ促す一言にする
      : daytime ? seated("day") : seated("night")), resources));
    if (completed) {
      root.append(el("p.trpg-campaign-notice", { text: "誰と迎えた結末か、今夜の思い出を本棚にしまった。" }));
      if (lastGain) root.append(clubBanner(clubRecord(state, catalog), lastGain));
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
        el("p", { text: "サイコロの合計を7に近づけよう。" }),
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
    if (!readOnly && !state?.trpg?.club?.founded && state?.chapter >= catalog.unlockChapter && visitMember) {
      root.append(el("section.trpg-club-proposal", { dataset: { test: "trpg-club-proposal" } }, [
        el("span.trpg-kicker", { text: "六角サイからの提案" }),
        el("h2", { text: "ここで、部活を作ってみませんか？" }),
        ...club.lines.map(clubLine),
        ...[
          ["店の仕事があると伝える", "trpg-club-choice-time", "proposal_time"],
          ["知り合いを誘うのは苦手と伝える", "trpg-club-choice-people", "proposal_people"],
        ].map(([label, test, choice]) => button(label, test, () => {
          // どちらの断り文句も「手伝う」返事に言い換えられる。
          if (foundTrpgClub(getState(), catalog)) { save(); foundingChoice = choice; justFounded = true; render("「" + catalog.club.name + "」の部長になりました（いつの間にか）。相手の部活の話を聞いたら、対面で誘ってみよう。"); }
        }, state.phase !== "daily")),
      ]));
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
      // 興味の一言はスマホでは札に出さず、長押し・ポインタの title で読む（#2729）
      party.append(el("div.trpg-campaign-person", { title: member ? status.reason : person.interestHint, dataset: { test: "trpg-person-" + person.id, available: status.ok, member: String(member) } }, [
        el("span.trpg-campaign-face", el("img", { src: portraitUrl(manifest, person.id), alt: "",
          style: { top: portraitTop(manifest, person.id, 180, 4), transform: "translateX(-" + portraitAx(manifest, person.id) * 100 + "%)" } })),
        el("div", [el("strong", [name(person.id), member ? el("i", { text: " · 部員" }) : null].filter(Boolean)),
          el("small", { text: member ? status.reason : recruitment.reason }),
          !member && el("small", { text: person.interestHint })]),
      ]));
    }
    if (!party.children.length) party.append(el("p", { text: "街で部活の話を聞くと、一緒に遊べる物語が増えていきます。" }));
    root.append(party);
    if (state?.trpg?.club?.founded) root.append(clubBanner(clubRecord(state, catalog)));
    if (!readOnly && !daytime && !completed && !scenarios.some(scenario =>
      state?.trpg?.owned?.includes(scenario.id) && !state?.trpg?.cleared?.[scenario.id]
      && castTrpgTable(state, catalog, scenario, options).ok)) {
      root.append(el("p.trpg-campaign-notice", { dataset: { test: "trpg-preparation-notice" },
        text: "今は遊べる本と仲間が揃っていません。下の入荷条件と仲間の予定を確認し、交流・勧誘から準備しよう。" }));
    }
    if (visitMember && !readOnly && state.trpg?.club?.founded) {
      root.append(el("div.trpg-club-demo-visits", { "aria-label": "試遊用の対面会話" }, [
        el("small", { text: "試遊：知り合いに会って勧誘する" }),
        ...catalog.participants.filter(p => recruitmentStatus(state, p, catalog, { allowUnheard: true }).ok).map(p =>
          button(name(p.id) + "に会う", "trpg-demo-meet-" + p.id, async () => {
            busy = true;
            try { await visitMember(p.id, resources, abort.signal); }
            finally { busy = false; if (!disposed) render(); }
          })),
      ]));
    }
    // マイダイス（VOL07）: サイの店で一度だけ買える。卓の盛り上がりが1から始まる（出目は変わらない）。
    const dice = !readOnly && state ? gearOffer(state, "gear_dice", { isCurrent: () => !disposed && !busy && getState() === owner,
      onBought: item => { save(); render(`「${item.name}」を買った。${item.effect}。`); } }) : null;
    if (dice) root.append(el("div.trpg-campaign-gear", { dataset: { test: "trpg-gear" } }, [dice]));
    const books = el("div.trpg-campaign-books", { dataset: { many: String(scenarios.length > 2) } });
    for (const scenario of scenarios) {
      const book = catalog.scenarios.find(b => b.id === scenario.id);
      const memory = state?.trpg?.cleared?.[book.id];
      const owned = state?.trpg?.owned?.includes(book.id);
      const stocked = state?.trpg?.stock?.includes(book.id);
      const locked = !memory && !owned && !stocked;
      const cast = state ? castTrpgTable(state, catalog, scenario, options) : { ok: false };
      const card = el("article.trpg-campaign-book", { title: locked ? null : scenario.presentation.tagline,
        dataset: { theme: scenario.presentation.theme, test: "trpg-book-" + book.id, locked: String(locked), state: memory ? "cleared" : locked ? "locked" : owned ? "owned" : "stock" } });
      card.append(el("div.trpg-campaign-book-art", [sceneArt(el, locked
        ? { ...scenario, presentation: { ...scenario.presentation, sceneAlt: "", location: "" } } : scenario),
        el("span.trpg-campaign-book-badge", { text: memory ? "遊び終えた物語" : owned ? "あなたの本棚" : stocked ? "入荷しました" : "🔒 未解放" })]));
      const copy = el("div.trpg-campaign-book-copy", [
        el("small.trpg-campaign-book-by", { text: locked ? "？？？ / 作 · ？？？" : scenario.collection + " / 作 · " + scenario.author }),
        el("h2", { text: locked ? "？？？？？" : scenario.title }), el("p.trpg-campaign-book-tagline", { text: locked ? book.finale
          ? trpgBookProgress(state, book).reason : "部員との出会いで解放" : scenario.presentation.tagline }),
      ]);
      if (book.finale && !locked && !trpgBookProgress(state, book).ok) copy.append(el("p", {
        dataset: { test: "trpg-finale-progress" }, text: trpgBookProgress(state, book).reason,
      }));
      if (memory) {
        // 旧章内日の記録はそのまま。通算日で残した第2章の記録だけ章内日へ表示する。
        const memoryClock = { ...memory, flags: memory.day >= (state?.flags?._ch2_day1?.startDay ?? Infinity) ? state.flags : {} };
        copy.append(el("div.trpg-campaign-memory", { dataset: { test: "trpg-memory-" + book.id },
          title: [`CH.${memory.chapter} · DAY ${chapterDay(memoryClock)} / ${memory.participants.map(name).join("・")}`,
            memory.night ? memory.night + "（盛り上がり " + memory.heat + "）" : "", memory.pc?.name ? "演じた役 " + memory.pc.name : ""].filter(Boolean).join("\n") }, [
          el("strong", { text: memory.endingTitle || scenario.endings[memory.ending]?.title || memory.ending }),
          el("p.trpg-campaign-memory-when", { text: `CH.${memory.chapter} · DAY ${chapterDay(memoryClock)} / ${memory.participants.map(name).join("・")}` }),
          Number.isInteger(memory.stars) ? el("span.trpg-campaign-stars", { text: "★".repeat(memory.stars) + "☆".repeat(3 - memory.stars),
            "aria-label": "卓の評価 星" + memory.stars + "つ", dataset: { test: "trpg-memory-stars" } }) : null,
          memory.night ? el("small.trpg-campaign-night", { text: memory.night + "（盛り上がり " + memory.heat + "）" }) : null,
          memory.pc?.name ? el("small.trpg-campaign-pc", { dataset: { test: "trpg-memory-pc" }, text: "演じた役 " + memory.pc.name + (memory.pc.title ? "（" + memory.pc.title + "）" : "") }) : null,
          el("small.trpg-campaign-memory-note", { text: "この夜の結末を、みんなとの思い出に。" }),
          el("small.trpg-campaign-endings", { dataset: { test: "trpg-memory-endings" } }, [el("span", { text: "見た結末 " }),
            (memory.endingsSeen?.length || 1) + " / " + Object.keys(scenario.endings).length + (memory.plays > 1 ? " · " + memory.plays + "回遊んだ" : "")]),
        ]));
        // もう一度遊ぶ（TMX14）: 夜の行動を1つ使う。記録は良い方（星、同じなら盛り上がり）を残す。
        if (owned) copy.append(...playButtons(book, scenario, cast, "もう一度遊ぶ"));
      } else if (locked) {
        copy.append(el("p.trpg-campaign-book-locked", { text: book.finale ? trpgBookProgress(state, book).reason : "🔒 まだ選べません" }));
      } else if (!owned) {
        copy.append(button("本棚に加える · " + yen(book.price), "trpg-buy-" + book.id, () => {
            if (buyTrpgBook(getState(), catalog, book.id)) { save(); warmOwnedScenarios(); render("新しいTRPGが、本棚に加わりました。"); }
            else render("本棚に加えられませんでした。所持金と入荷状況を確認してください。");
          }, readOnly || spendableMoney(state) < book.price));
      } else {
        copy.append(el("p.trpg-campaign-book-cast", { title: cast.ok ? "今夜の卓：" + cast.participants.map(name).join("・") : cast.reason, dataset: { ok: String(!!cast.ok) },
        }, cast.ok ? [el("span", { text: "今夜の卓：" }), cast.participants.map(name).join("・")] : [cast.reason]),
          el("small.trpg-campaign-book-time", { text: scenario.duration }), ...playButtons(book, scenario, cast, "この仲間で遊ぶ"));
      }
      card.append(copy); books.append(card);
    }
    // 1画面で見渡す本棚（#3199・TRF25）: 見出しの下を「左＝店主・案内・部員・ランク・道具」「右＝本」に分ける。
    // 以前は縦1列で、遊べる本が2画面ぶん下にあった。本は3列で、9冊までは下へ送らずに全部見える。
    const side = el("div.trpg-campaign-side", { dataset: { test: "trpg-campaign-side" } });
    for (const node of [...root.children].slice(1)) side.append(node);
    const rows = Math.max(1, Math.ceil(scenarios.length / 3));
    books.style.setProperty("--rows", String(Math.min(rows, 3)));
    books.dataset.rows = String(rows); books.dataset.overflow = String(rows > 3);
    root.dataset.view = "shelf";
    root.append(side, books);
    host.replaceChildren(root); root.focus({ preventScroll: true });
  }

  /**
   * 部のランクの札（TRF13）: ランクの名前、実績の進み具合、はじめの役の成長点。数え方は「？」に。
   * gain があれば、今夜の卓で増えた分も出す。
   */
  function clubBanner(record, gain = null) {
    const span = record.next ? record.next.at - record.floor : 1, filled = record.next ? record.points - record.floor : 1;
    return el("div.trpg-campaign-club", { dataset: { test: "trpg-club-rank", rank: String(record.rank), up: String(!!gain?.rankUp) },
      "aria-label": "部のランク " + record.rank + "、" + record.name + "。実績 " + record.points
        + (record.next ? "。次のランクまで あと" + record.next.need : "") + (record.growth ? "。はじめの役の成長点 ＋" + record.growth : "") }, [
      el("span.trpg-campaign-club-rank", { "aria-hidden": "true" }, [el("small", { text: "部のランク" }), el("b", { text: String(record.rank) })]),
      el("div.trpg-campaign-club-copy", { "aria-hidden": "true" }, [
        el("strong", { text: record.name + (gain?.rankUp ? " になった！" : "") }),
        el("span.trpg-campaign-club-bar", { style: { "--filled": Math.round(filled / span * 100) + "%" } }),
        el("small", { text: (gain?.gained ? "今夜の実績 ＋" + gain.gained + " · " : "") + (record.next ? "次のランクまで あと " + record.next.need : "実績 " + record.points) }),
      ]),
      record.growth ? el("i.trpg-campaign-club-growth", { "aria-hidden": "true", dataset: { test: "trpg-club-growth", up: String(!!gain?.growthUp) },
        text: "はじめの役 能力＋" + record.growth, title: "部のランクが上がると、はじめの役の能力に成長点が付く" }) : null,
    ].filter(Boolean));
  }

  /** The play buttons of a book: start, or continue from the bookmark (しおり・TMX13) when tonight's seats match it. */
  function playButtons(book, scenario, cast, label) {
    const state = getState();
    const { mark, ok, reason } = cast.ok ? trpgBookmarkFor(state, scenario, cast.assignments) : { mark: null };
    const off = readOnly || !cast.ok;
    if (!mark) return [button(label, "trpg-play-" + book.id, () => play(scenario), off)];
    const note = el("p.trpg-campaign-bookmark", { dataset: { test: "trpg-bookmark-" + book.id },
      text: "しおり：" + (mark.title || "途中") + (ok ? "" : " · " + reason) });
    return ok ? [note, button("続きから遊ぶ", "trpg-resume-" + book.id, () => play(scenario, { resume: true }), off),
      button("最初から", "trpg-play-" + book.id, () => play(scenario), off)]
      : [note, button(label, "trpg-play-" + book.id, () => play(scenario), off)];
  }

  async function play(scenario, { resume = false } = {}) {
    const state = getState();
    const cast = castTrpgTable(state, resources.catalog, scenario, { nightBusy: nightBusy() });
    if (readOnly || !cast.ok) { render(cast.reason); return; }
    busy = true;
    const bookmark = resume ? trpgBookmarkFor(state, scenario, cast.assignments) : { mark: null };
    const mark = bookmark.ok ? bookmark.mark : null;
    const seed = mark ? mark.seed : ((state.seed || 1) ^ state.day * 7919 ^ state.chapter * 104729 ^ scenario.title.length * 997) >>> 0;
    // 成長点（TRF13）: 部のランクから。続きから遊ぶ時は、しおりを挟んだ時の値で始める。
    const growth = mark ? (Number.isInteger(mark.growth) ? mark.growth : 0) : clubRecord(state, resources.catalog).growth;
    const ticket = { ...cast, chapter: state.chapter, day: state.day, slot: state.slot, seed, growth };
    lastGain = null;
    try {
      const table = materializeTrpgCast(scenario, cast.assignments);
      await runTrpg(host, { resources: { ...resources, scenario: table }, signal: abort.signal, seed,
        allowReplay: false, closeLabel: "思い出を本棚へ", warmStart: ownsGear(state, "gear_dice"),
        pc: mark?.pc || null, resume: mark ? { actions: mark.actions } : null, growth,
        // しおりは場面の区切りごとに保存する。夜の行動もお金も使わない。
        onBookmark: data => {
          if (!disposed && getState() === state && keepTrpgBookmark(state, scenario, ticket, data)) save();
        },
        // The shopkeeper explains the table until the first story is finished; the cover button replays it any time.
        tutorial: !state.flags?._trpg_tutorial_seen,
        onComplete: result => {
          const before = clubRecord(state, resources.catalog);
          if (!disposed && getState() === state && completeTrpgTable(state, resources.catalog, scenario, ticket, result, { nightBusy: nightBusy() })) {
            state.flags ||= {}; state.flags._trpg_tutorial_seen = true;
            completed = true; save();
            // 今夜の卓で部の実績がどれだけ増えたか。結末の画面と、本棚へ戻った時の札に出す。
            lastGain = clubGain(before, clubRecord(state, resources.catalog));
            return { club: lastGain };
          }
          return null;
        } });
      if (disposed) return;
      busy = false;
      if (completed) render(); else render(getState()?.trpg?.bookmark?.id === scenario.id
        ? "卓を片付けました。しおりを挟んだので、次は続きから遊べます。" : "卓を片付けました。本は未クリアのまま、また遊べます。");
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
  // 店の本棚に入った瞬間の開幕（#2719）。見た目だけで、読み込みや操作は待たせない。
  if (!disposed) entrance = playTrpgEntrance(host, { foot: readOnly ? "みんなと遊んだ本棚へ" : "ボドゲカフェの本棚へ" });
  return { ready, finished, destroy: close, get disposed() { return disposed; } };
}

