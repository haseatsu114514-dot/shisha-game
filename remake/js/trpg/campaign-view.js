import { faceIconStyle } from "./face-crops.js";
import { storeLogo } from "../core/store-logos.js";
import { spendableMoney } from "../core/travel-budget.js";
import { el, yen } from "../core/util.js";
import { chapterDay } from "../core/chapter-clock.js";
import { venueHost } from "../core/venue-host.js";
import { gearOffer, ownsGear } from "../core/hobby-gear.js";
import { newDayTrial, rollDayTrial, stopDayTrial } from "./day-trial.js";
import { loadTrpgShelf, loadTrpgResources, runTrpg } from "./index.js";
import { createTrpgAudio } from "./audio.js";
import { playTrpgEntrance } from "./entrance.js";
import { hasPictureBook, playPictureBook } from "./picture-book.js";
import { shelfHelpButton } from "./shelf-help.js";
import { openTrpgBookshelf } from "./play-record-view.js";
import { saveTrpgReplay } from "./play-record.js";
import { displayName, portraitUrl, sceneArt } from "./presentation.js";
import { participantStatus, recruitmentStatus, foundTrpgClub, tableStatus, syncTrpgStock, buyTrpgBook, castTrpgTable, materializeTrpgCast, completeTrpgTable, keepTrpgBookmark, trpgBookmarkFor, clubRecord, clubGain, trpgBookProgress, trpgCampaignEnding } from "./campaign.js";

// 店の決まりは画面に常に出さず、右上の「？」で読む（#2719・ミニゲーム共通のUI方針）。
const SHOP_HELP = [
  ["夜の卓", "営業が終わるまで待ってから、空いている部員と集まって遊びます（夜の1枠）。中断した本は、しおりから続きを遊べます。結末を迎えた本も、もう一度遊べます。"],
  ["部のランク", "遊び終えた本・見た結末・星の数で、部の実績が貯まります（1冊につき 遊び終えた＋2、結末1つ＋1、星1つ＋1）。ランクが上がると、はじめの役の能力に成長点が付きます（ランク2で＋1、ランク4で＋2）。"],
  ["本を買う", "入荷したシナリオ本を買うと、仲間と遊べます。買い物は時間を使いません。"],
  ["9冊の物語", "部員それぞれの物語が1冊ずつ。部員なしで遊べる2冊は、サイと店の常連が卓を囲みます。部員の6冊を遊び終えると、サイの最後の物語が入荷します。空いた仲間の席は、この店の常連が手伝います。"],
  ["部活と勧誘", "相手から部活の話を聞いたら、好感度に関係なく対面で誘えます。勧誘に追加の時間はかかりません。"],
  ["昼の試遊（七つの灯り）", "サイコロの合計を7に近づけます。振り足すか、止めるか。7を超えると失敗です。無料で、時間も使いません。"],
];

/** Owns a shop/table screen. Only the supplied state and save callback may change. */
export function mountTrpgCampaign(host, { getState, save = () => {}, nightBusy = () => false,
  readOnly = false, campaignEndings = false, closeLabel = "街へ戻る", signal, resources: suppliedResources = null, visitMember = null, greeted = false } = {}) {
  const help = campaignEndings || readOnly ? [...SHOP_HELP, ["三つのエンド",
    "見立てを当てる、相手の望みに合う提案をする、判定に2回成功する。この三つで星が一つずつ付きます。星3つならトゥルー、1〜2つならノーマル、0ならバッド。どれでもクリアです。本棚に各エンドを初めて見た回が残ります。"]] : SHOP_HELP;
  const abort = new AbortController();
  const owner = getState();
  const visitStamp = owner && `${owner.chapter}:${owner.day}:${owner.slot}`;
  let trial = null;
  let reflection = null, archiveStatus = "";
  let justFounded = false; // 設立した直後だけ、気づけば部長になっていた場面を出す
  let foundingChoice = null;
  let disposed = false, resources = null, busy = false, completed = false, root = null, entrance = null, lastGain = null;
  let shelfBook = null; // 開いている見開きの本（id）。描き直しても同じ見開きに戻す
  let resolveFinished;
  const finished = new Promise(r => { resolveFinished = r; });
  // text は文字列か、[見せる字, 読み上げだけの字…] の並び（quiet で包んだ所は字を出さない。textContent は前と同じ）
  const button = (text, test, action, disabled = false) => el("button.trpg-button", {
    type: "button", disabled, dataset: { test }, onclick: () => {
      if (getState() !== owner) { close(); return; }
      if (!disposed && !busy) action();
    },
  }, [].concat(text));
  const quiet = text => el("span.trpg-quiet", { text });
  // 本の札のボタン（2026-11-27 オーナー「文字で説明しすぎずUIやボタンで視覚的に」・TRP10）: 頭に印（CSS）を付け、見せる字を短くする
  // 見せる字は2文字にそろえる（横持ちスマホの細い札でも1行に収まる）。「もう一度」は印（↻）で、しおりの2つは「続き」「最初」
  const SHELF_LABELS = { "この仲間で遊ぶ": () => [quiet("この仲間で"), "遊ぶ"], "もう一度遊ぶ": () => [quiet("もう一度"), "遊ぶ"], "続きから遊ぶ": () => ["続き", quiet("から遊ぶ")],
    "最初から": () => ["最初", quiet("から")], "絵本をみる": () => ["絵本", quiet("をみる")] };
  const shelfButton = (label, kind, test, action, disabled = false) => {
    const node = button(SHELF_LABELS[label]?.() || label, test, action, disabled);
    node.dataset.kind = kind; node.setAttribute("aria-label", label);
    return node;
  };
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
    const bookshelf = button("本棚", "trpg-bookshelf-open", () => openTrpgBookshelf(root, state, scenarios, characters, { campaignEndings: campaignEndings || readOnly }));
    bookshelf.setAttribute("aria-label", "本棚（過去プレイを再生）");
    bookshelf.replaceChildren(el("span", { style: { display: "grid" } }, [
      el("span", { text: "本棚" }), el("small", { text: "過去プレイを再生" }),
    ]));
    root.append(el("header.trpg-campaign-header", [
      el("div", [!readOnly ? storeLogo("trpg_bar", { width: 130, height: 72 }) : null, el("span.trpg-kicker", { text: readOnly ? "TABLETOP MEMORIES" : "ボドゲカフェ / TABLETOP CAFE" }),
        el("h1", { text: readOnly ? "遊んだ記録" : completed ? "今夜の卓を終えました" : daytime ? "昼の試遊と本選び" : "今夜、誰と物語を囲む？" })]),
      el("div.trpg-campaign-meta", [el("span", { text: state ? `CH.${state.chapter} · DAY ${chapterDay(state)} · ${yen(state.money)}` : "まだ記録がありません" }),
        shelfHelpButton(() => root, { title: "ボドゲカフェの遊び方", sections: help, test: "trpg-campaign-help" }),
        bookshelf,
        button(closeLabel, "trpg-campaign-close", close)]),
    ]));
    if (!readOnly) root.append(venueHost("sai", hostLine(completed ? reflection || "after_table" : trial
      ? trial.done ? trial.total > 7 ? "bust" : trial.total === 7 ? "seven" : "stop" : trial.rolls.length ? "push" : "trial"
      // 入口でサイと話したばかりの来店（daily/venue-arrivals.js）は、挨拶を繰り返さず棚へ促す一言にする
      : daytime ? seated("day") : seated("night")), resources));
    if (completed) {
      if (archiveStatus) root.append(el("p.trpg-campaign-notice", { role: "status", text: archiveStatus }));
      if (lastGain) root.append(clubBanner(clubRecord(state, catalog), lastGain));
      if (!reflection) root.append(el("div.trpg-trial-actions", [
        button("うまくいった場面を話す", "trpg-reflect-good", () => { reflection = "after_table_good"; render(); }),
        button("苦戦した場面を話す", "trpg-reflect-hard", () => { reflection = "after_table_hard"; render(); }),
      ]));
      host.replaceChildren(root); root.focus({ preventScroll: true }); return;
    }
    root.append(el("p.trpg-campaign-notice", { role: "status", dataset: { test: "trpg-campaign-notice" },
      text: message || (readOnly ? "第2章のボドゲカフェで遊んだ記録がここに残ります。"
        : daytime ? trial ? "試遊は無料。いつでも物語の一覧へ戻れます。" : "昼は試遊と本選び。TRPGは夜にどうぞ。" : time.reason) }));
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
          button("一覧へ戻る", "trpg-trial-back", () => { trial = null; render(); }),
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
    const castFace = id => {
      const src = portraitUrl(manifest, id);
      // 顔の切り出しは部員の札と同じ（.trpg-campaign-face の寸法で計算しているので、同じ箱を縮めて使う）
      return src ? el("span.trpg-campaign-face.trpg-cast-face", { title: name(id) }, el("img", { src, alt: "", style: faceIconStyle(id, undefined, manifest) }))
        : el("span.trpg-cast-face.trpg-cast-initial", { title: name(id), text: [...name(id)][0] || "?" });
    };
    const party = el("div.trpg-campaign-party", { "aria-label": "仲間の今夜の予定" });
    for (const person of catalog.participants.filter(p => state?.met?.[p.id])) {
      const status = participantStatus(state, person);
      const member = !!state.trpg?.club?.members?.[person.id];
      const recruitment = recruitmentStatus(state, person, catalog);
      // 興味の一言はスマホでは札に出さず、長押し・ポインタの title で読む（#2729）
      party.append(el("div.trpg-campaign-person", { title: member ? status.reason : person.interestHint, dataset: { test: "trpg-person-" + person.id, available: status.ok, member: String(member) } }, [
        el("span.trpg-campaign-face", el("img", { src: portraitUrl(manifest, person.id), alt: "",
          style: faceIconStyle(person.id, undefined, manifest) })),
        el("div", [el("strong", [name(person.id), member ? el("i", { text: " · 部員" }) : null].filter(Boolean)),
          el("small", { text: member ? status.reason : recruitment.reason }),
          !member && el("small", { text: person.interestHint })]),
      ]));
    }
    if (!party.children.length) party.append(el("p", { text: "街で部活の話を聞くと、一緒に遊べる物語が増えていきます。" }));
    root.append(party);
    if (state?.trpg?.club?.founded) root.append(clubBanner(clubRecord(state, catalog)));
    if (!readOnly && !daytime && !completed && !scenarios.some(scenario =>
      state?.trpg?.owned?.includes(scenario.id)
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
    // 本をめくって選ぶ（TRP11・2026-11-27 オーナー「本をめくってシナリオを決めるような洒落たものにしたい」）:
    // 見開きに1冊だけ出す（左の頁＝絵、右の頁＝題・今夜の卓・ボタン）。絵と顔は、その見開きを初めて開いた時に作る
    // （以前は9冊ぶんの絵と、全員ぶんの顔を一度に読み込んで描いていた）。
    const spread = el("div.trpg-flipbook", { dataset: { test: "trpg-book-spread" } });
    const books = el("div.trpg-campaign-books", [spread]);
    const fills = new Map();
    for (const scenario of scenarios) {
      const book = catalog.scenarios.find(b => b.id === scenario.id);
      const memory = state?.trpg?.cleared?.[book.id];
      const owned = state?.trpg?.owned?.includes(book.id);
      const stocked = state?.trpg?.stock?.includes(book.id);
      const locked = !memory && !owned && !stocked;
      const progress = trpgBookProgress(state, book);
      const cast = state ? castTrpgTable(state, catalog, scenario, options) : { ok: false };
      const card = el("article.trpg-campaign-book", { title: locked ? null : scenario.presentation.tagline,
        dataset: { theme: scenario.presentation.theme, test: "trpg-book-" + book.id, locked: String(locked), state: memory ? "cleared" : locked ? "locked" : owned ? "owned" : "stock" } });
      const art = el("div.trpg-campaign-book-art", [
        el("span.trpg-campaign-book-badge", { text: memory ? "遊んだ記録" : owned ? "購入済み" : stocked ? "入荷しました" : "🔒 未解放" })]);
      const faces = el("span.trpg-cast-faces", { "aria-hidden": "true" });
      // 未解放の本は、鎖と錠の掛かった本の絵（CSS）。場面の絵は読み込まない
      fills.set(card, () => {
        if (!locked) art.prepend(sceneArt(el, scenario));
        if (cast.ok && faces.parentNode) faces.replaceChildren(...cast.participants.map(castFace));
      });
      // 左の頁の絵の下: 作者と、かかる時間
      card.append(art, el("small.trpg-campaign-book-by", { text: locked ? "？？？ / 作 · ？？？" : scenario.collection + " / 作 · " + scenario.author }));
      if (!locked) card.append(el("small.trpg-campaign-book-time", { text: scenario.duration }));
      // 今夜の卓は、名前の列の代わりに顔を並べる（名前は title と読み上げ用に残す。顔の絵が無い人は頭文字の丸）
      const castLine = () => el("p.trpg-campaign-book-cast", { title: cast.ok ? "今夜の卓：" + cast.participants.map(name).join("・") : cast.reason, dataset: { ok: String(!!cast.ok) },
      }, cast.ok ? [el("span", { text: "今夜の卓：" }), el("span.trpg-cast-names", { text: cast.participants.map(name).join("・") }), faces] : [cast.reason]);
      const copy = el("div.trpg-campaign-book-copy", [
        el("h2", { text: locked ? "？？？？？" : scenario.title }), el("p.trpg-campaign-book-tagline", { text: locked ? book.finale
          ? progress.reason : "部員との出会いで解放" : scenario.presentation.tagline }),
      ]);
      if (book.finale && !locked && !progress.ok) copy.append(el("p", {
        dataset: { test: "trpg-finale-progress" }, text: progress.reason,
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
          el("small.trpg-campaign-endings", { dataset: { test: "trpg-memory-endings" } }, [el("span", { text: "見た結末 " }),
            (memory.endingsSeen?.length || 1) + " / " + Object.keys(scenario.endings).length + (memory.plays > 1 ? " · " + memory.plays + "回遊んだ" : "")]),
        ]));
        // もう一度遊ぶ（TMX14）: 夜の行動を1つ使う。記録は良い方（星、同じなら盛り上がり）を残す。
        if (owned) copy.append(castLine(), ...playButtons(book, scenario, cast, "もう一度遊ぶ"));
      } else if (locked) {
        copy.append(el("p.trpg-campaign-book-locked", { text: book.finale ? progress.reason : "🔒 まだ選べません" }));
      } else if (!owned) {
        copy.append(button("本を買う · " + yen(book.price), "trpg-buy-" + book.id, () => {
            if (buyTrpgBook(getState(), catalog, book.id)) { save(); render("シナリオ本を購入しました。"); }
            else render("購入できませんでした。所持金と入荷状況を確認してください。");
          }, readOnly || spendableMoney(state) < book.price));
      } else {
        copy.append(castLine(), ...playButtons(book, scenario, cast, "この仲間で遊ぶ"));
      }
      if (owned && state.chapter >= catalog.unlockChapter && progress.ok && hasPictureBook(scenario)) {
        const read = shelfButton("絵本をみる", "book", "trpg-picturebook-" + book.id, () => readPictureBook(scenario));
        read.classList.add("trpg-picturebook-open");
        copy.append(read);
      }
      // 押す所は、右の頁の下に1段でまとめる
      const actions = el("div.trpg-book-actions", [...copy.children].filter(node => node.matches("button")));
      if (actions.children.length) copy.append(actions);
      card.append(copy); spread.append(card);
    }
    const pages = [...spread.children];
    const playable = card => [...card.querySelectorAll('[data-test^="trpg-play-"], [data-test^="trpg-resume-"]')].some(node => !node.disabled);
    // 最初に開く見開き: さっきまで開いていた本 → 今夜遊べる本 → 買える本 → 持っている本 → 開ける本
    let at = scenarios.findIndex(scenario => scenario.id === shelfBook);
    if (at < 0) at = [playable, card => !!card.querySelector('[data-test^="trpg-buy-"]'), card => card.dataset.state === "owned", card => card.dataset.locked !== "true"]
      .map(test => pages.findIndex(test)).find(index => index >= 0) ?? 0;
    const guard = action => () => { if (getState() !== owner) { close(); return; } if (!disposed && !busy) action(); };
    const leaf = el("i.trpg-page-leaf", { "aria-hidden": "true" });
    const number = el("span.trpg-page-number", { "aria-hidden": "true" });
    const arrow = (dir, label, step) => el("button.trpg-page-turn", { type: "button", "aria-label": label,
      dataset: { test: "trpg-page-" + dir, dir }, onclick: guard(() => turn(at + step)) });
    const prev = arrow("prev", "前の本へ", -1), next = arrow("next", "次の本へ", 1);
    // 小口の見出し（しおり）: 何冊目かと、本の状態（遊べる・買える・遊んだ・まだ開けない）が色で分かる。押すとその本へ
    const tabs = el("div.trpg-book-tabs", { role: "group", "aria-label": "本を選ぶ" }, scenarios.map((scenario, index) =>
      el("button.trpg-book-tab", { type: "button", "aria-label": pages[index].dataset.locked === "true" ? "まだ開けない本" : scenario.title,
        dataset: { test: "trpg-tab-" + scenario.id, state: pages[index].dataset.state, ready: String(playable(pages[index])) },
        onclick: guard(() => turn(index)) }, [el("span", { text: String(index + 1) })])));
    const FLIP_MS = 460;
    let flipTimers = [];
    const settle = () => {
      for (const timer of flipTimers) clearTimeout(timer);
      flipTimers = [];
      pages.forEach((card, index) => { card.hidden = index !== at; delete card.dataset.flip; });
      delete spread.dataset.turn;
    };
    const mark = () => {
      [...tabs.children].forEach((tab, index) => { if (index === at) tab.setAttribute("aria-current", "true"); else tab.removeAttribute("aria-current"); });
      prev.disabled = at === 0; next.disabled = at === pages.length - 1;
      number.textContent = (at + 1) + " / " + pages.length;
      spread.dataset.page = String(at + 1);
    };
    const calm = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    // 頁をめくる: 紙が1枚、背を軸に反対の頁へ倒れる。倒れきるまで、着地する側は前の本のまま（紙の下で入れ替える）
    function turn(to) {
      to = Math.max(0, Math.min(pages.length - 1, to));
      if (to === at) return;
      settle();
      const from = at, dir = to > from ? "next" : "prev";
      at = to; shelfBook = scenarios[to].id;
      fills.get(pages[to])?.(); fills.delete(pages[to]);
      mark();
      if (calm()) { settle(); return; }
      pages[to].hidden = false; pages[from].dataset.flip = "out"; pages[to].dataset.flip = "in";
      spread.dataset.turn = dir;
      void leaf.offsetWidth; // 続けてめくった時も、紙の動きを最初からやり直す
      flipTimers = [setTimeout(() => { pages[from].hidden = true; delete pages[from].dataset.flip; delete pages[to].dataset.flip; }, FLIP_MS * .78),
        setTimeout(settle, FLIP_MS)];
    }
    fills.get(pages[at])?.(); fills.delete(pages[at]);
    shelfBook = scenarios[at]?.id ?? null;
    settle(); mark();
    // 指で横に払ってもめくれる（縦の動きや、ボタンを押しただけの時はめくらない）
    let swipe = null, swiped = false;
    spread.addEventListener("pointerdown", event => { swipe = event.isPrimary ? { x: event.clientX, y: event.clientY } : null; swiped = false; });
    spread.addEventListener("pointerup", event => {
      if (!swipe) return;
      const dx = event.clientX - swipe.x, dy = event.clientY - swipe.y, reach = spread.getBoundingClientRect().width * .09;
      swipe = null;
      if (Math.abs(dx) < reach || Math.abs(dx) < Math.abs(dy) * 1.6) return;
      swiped = true; guard(() => turn(at + (dx < 0 ? 1 : -1)))();
    });
    spread.addEventListener("pointercancel", () => { swipe = null; });
    spread.addEventListener("click", event => { if (swiped) { swiped = false; event.stopPropagation(); event.preventDefault(); } }, true);
    spread.append(tabs, prev, next, number, leaf);
    root.addEventListener("keydown", event => {
      if (event.target.closest?.("input, textarea, select, [role='dialog']") || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
      if (!books.isConnected || root.querySelector(".trpg-shelf-help, .trpg-picturebook")) return;
      event.preventDefault(); guard(() => turn(at + (event.key === "ArrowRight" ? 1 : -1)))();
    });
    // 見出しの下を「左＝店主・案内・部員・ランク・道具」「右＝開いた本」に分ける（#3199・TRF25 の左右の分け方はそのまま）。
    const side = el("div.trpg-campaign-side", { dataset: { test: "trpg-campaign-side" } });
    for (const node of [...root.children].slice(1)) side.append(node);
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
    const kind = label === "もう一度遊ぶ" ? "replay" : "play";
    if (!mark) return [shelfButton(label, kind, "trpg-play-" + book.id, () => play(scenario), off)];
    const note = el("p.trpg-campaign-bookmark", { dataset: { test: "trpg-bookmark-" + book.id },
      text: "しおり：" + (mark.title || "途中") + (ok ? "" : " · " + reason) });
    return ok ? [note, shelfButton("続きから遊ぶ", "play", "trpg-resume-" + book.id, () => play(scenario, { resume: true }), off),
      shelfButton("最初から", "replay", "trpg-play-" + book.id, () => play(scenario), off)]
      : [note, shelfButton(label, kind, "trpg-play-" + book.id, () => play(scenario), off)];
  }

  async function readPictureBook(scenario) {
    busy = true;
    const audio = createTrpgAudio(scenario.presentation.theme);
    abort.signal.addEventListener("abort", audio.destroy, { once: true });
    try {
      audio.setTheme(scenario.presentation.theme);
      await playPictureBook(root, { scenario, signal: abort.signal, readOnly: true });
    } finally {
      abort.signal.removeEventListener("abort", audio.destroy);
      audio.destroy();
      busy = false;
    }
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
      let sessionResources = resources;
      if (!scenario.dialogues) {
        root = el("div.trpg-loading", [
          el("p", { role: "status", text: "選んだ物語を読み込んでいます…" }),
          el("button.trpg-button", { type: "button", text: closeLabel, onclick: close, dataset: { test: "trpg-campaign-close" } }),
        ]);
        host.replaceChildren(root);
        sessionResources = await loadTrpgResources({
          scenarioId: scenario.id, shared: resources, signal: abort.signal, preloadAssets: false,
        });
        if (disposed || getState() !== state) { close(); return; }
        scenario = sessionResources.scenario;
      }
      const table = materializeTrpgCast(scenario, cast.assignments);
      await runTrpg(host, { resources: { ...sessionResources, scenario: table }, signal: abort.signal, seed,
        allowReplay: false, closeLabel: "カフェへ戻る", warmStart: ownsGear(state, "gear_dice"),
        pc: mark?.pc || null, resume: mark ? { actions: mark.actions } : null, growth,
        // しおりは場面の区切りごとに保存する。夜の行動もお金も使わない。
        onBookmark: data => {
          if (!disposed && getState() === state && keepTrpgBookmark(state, scenario, ticket, data)) save();
        },
        // The shopkeeper explains the table until the first story is finished; the cover button replays it any time.
        tutorial: !state.flags?._trpg_tutorial_seen,
        onComplete: result => {
          const outcome = campaignEndings ? trpgCampaignEnding(scenario, result) : null;
          const before = clubRecord(state, resources.catalog);
          let makeReplay = null;
          if (!disposed && getState() === state && completeTrpgTable(state, resources.catalog, scenario, ticket, result, {
            nightBusy: nightBusy(), outcome, recordTable: table, characters: resources.characters, onReplayOffer: build => { makeReplay = build; },
          })) {
            state.flags ||= {}; state.flags._trpg_tutorial_seen = true;
            completed = true;
            // 進行・報酬・夜の枠はリプレイの選択より前に一度だけ保存。LOADで選択を失っても卓は完了済み。
            const progressSaved = save() !== false;
            archiveStatus = progressSaved ? "" : "ゲームの進行を保存できませんでした。";
            lastGain = clubGain(before, clubRecord(state, resources.catalog));
            let decided = false;
            return { club: lastGain, outcome, chooseReplay: makeReplay && (keep => {
              if (decided || disposed || getState() !== state) return "";
              decided = true;
              if (!keep) {
                if (progressSaved) archiveStatus = "リプレイは保存しませんでした。";
                return archiveStatus;
              }
              let outcome = "failed";
              try { outcome = saveTrpgReplay(state, scenario.id, makeReplay(), save); } catch { /* 完了済みの進行は残す */ }
              if (outcome === "saved") archiveStatus = "本棚にリプレイを保存しました。";
              else if (outcome === "full") archiveStatus += "本棚の保存上限に達しました。前のリプレイは残っています。";
              else if (outcome === "failed") archiveStatus += "本棚にリプレイを保存できませんでした。";
              return archiveStatus;
            }) };
          }
          return null;
        } });
      if (disposed) return;
      busy = false;
      if (completed) render(); else render(getState()?.trpg?.bookmark?.id === scenario.id
        ? "卓を片付けました。しおりを挟んだので、次は続きから遊べます。" : "卓を片付けました。また最初から遊べます。");
    } catch (error) {
      busy = false;
      if (!disposed) render("卓を開けませんでした。本と今夜の行動は残っています。");
      console.error(error);
    }
  }

  async function load() {
    if (disposed) return;
    host.replaceChildren(el("div.trpg-loading", [el("p", { text: "物語と仲間の予定を読み込んでいます…" }),
      button(closeLabel, "trpg-campaign-close", close)]));
    try { resources = suppliedResources || await loadTrpgShelf({ signal: abort.signal }); render(); }
    catch {
      if (disposed) return;
      host.replaceChildren(el("div.trpg-loading", [el("p", { role: "status", text: "物語の一覧を読み込めませんでした。もう一度お試しください。" }),
        button("再読み込み", "trpg-campaign-retry", load), button(closeLabel, "trpg-campaign-close", close)]));
    }
  }
  const ready = load();
  // 店の本棚に入った瞬間の開幕（#2719）。見た目だけで、読み込みや操作は待たせない。
  if (!disposed) entrance = playTrpgEntrance(host, { foot: readOnly ? "遊んだ記録" : "ボドゲカフェへ" });
  return { ready, finished, destroy: close, get disposed() { return disposed; } };
}

