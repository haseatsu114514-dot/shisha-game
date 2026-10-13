import { el, yen } from "../core/util.js";
import { loadTrpgLibrary, runTrpg } from "./index.js";
import { displayName, portraitUrl, portraitTop, sceneUrl } from "./presentation.js";
import { participantStatus, recruitmentStatus, foundTrpgClub, tableStatus, syncTrpgStock, buyTrpgBook, castTrpgTable, materializeTrpgCast, completeTrpgTable } from "./campaign.js";

/** Owns a shop/table screen. Only the supplied state and save callback may change. */
export function mountTrpgCampaign(host, { getState, save = () => {}, nightBusy = () => false,
  readOnly = false, closeLabel = "街へ戻る", signal, resources: suppliedResources = null, visitMember = null } = {}) {
  const abort = new AbortController();
  let disposed = false, resources = null, busy = false, completed = false, root = null;
  let resolveFinished;
  const finished = new Promise(r => { resolveFinished = r; });
  const button = (text, test, action, disabled = false) => el("button.trpg-button", {
    type: "button", text, disabled, dataset: { test }, onclick: () => { if (!disposed && !busy) action(); },
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
    if (!readOnly && syncTrpgStock(state, catalog)) save();
    const options = { nightBusy: nightBusy() };
    const time = tableStatus(state, catalog, options);
    const name = id => displayName(characters, id);
    root = el("section.trpg-root.trpg-campaign", { tabindex: "-1", dataset: { phase: "campaign" } });
    root.append(el("header.trpg-campaign-header", [
      el("div", [el("span.trpg-kicker", { text: readOnly ? "TABLETOP MEMORIES" : "遊べるシーシャバー / TABLETOP NIGHT" }),
        el("h1", { text: readOnly ? "みんなと遊んだ、本の棚。" : "今夜、誰と物語を囲む？" })]),
      el("div.trpg-campaign-meta", [el("span", { text: state ? `CH.${state.chapter} · DAY ${state.day} · ${yen(state.money)}` : "まだ本棚は空です" }),
        button(closeLabel, "trpg-campaign-close", close)]),
    ]));
    root.append(el("p.trpg-campaign-notice", { role: "status", dataset: { test: "trpg-campaign-notice" },
      text: message || (readOnly ? "第2章から部活を作り、仲間を勧誘して、一緒に遊んだ物語を残せます。" : time.reason) }));
    if (!readOnly && !state?.trpg?.club?.founded && state?.chapter >= catalog.unlockChapter) {
      root.append(el("section.trpg-club-proposal", { dataset: { test: "trpg-club-proposal" } }, [
        el("span.trpg-kicker", { text: "カウンターの店員から" }),
        el("h2", { text: "ここで、部活を作ってみませんか？" }),
        ...club.lines.map(line => el("p", { text: line.text })),
        button("「" + catalog.club.name + "」を作る", "trpg-club-found", () => {
          if (foundTrpgClub(getState(), catalog)) { save(); render("部活ができました。仲のいい相手に会って、声をかけてみよう。"); }
        }, state.phase !== "daily"),
      ]));
      root.append(el("p", { text: "好感度MAXの友人も恋人も、興味があれば入部。勧誘に追加の時間はかかりません。本の購入も時間を使いません。" }));
      host.replaceChildren(root); root.focus({ preventScroll: true }); return;
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
    const books = el("div.trpg-campaign-books");
    for (const scenario of scenarios) {
      const book = catalog.scenarios.find(b => b.id === scenario.id);
      const memory = state?.trpg?.cleared?.[book.id];
      const owned = state?.trpg?.owned?.includes(book.id);
      const stocked = state?.trpg?.stock?.includes(book.id);
      const cast = state ? castTrpgTable(state, catalog, scenario, options) : { ok: false };
      const card = el("article.trpg-campaign-book", { dataset: { theme: scenario.presentation.theme, test: "trpg-book-" + book.id } });
      card.append(el("div.trpg-campaign-book-art", [el("img", { src: sceneUrl(scenario), alt: scenario.presentation.sceneAlt }),
        el("span.trpg-campaign-book-badge", { text: memory ? "遊び終えた物語" : owned ? "あなたの本棚" : stocked ? "入荷しました" : "これからの一冊" })]));
      const copy = el("div.trpg-campaign-book-copy", [
        el("small", { text: scenario.collection + " / 作 · " + scenario.author }),
        el("h2", { text: scenario.title }), el("p", { text: scenario.presentation.tagline }),
      ]);
      if (memory) {
        copy.append(el("div.trpg-campaign-memory", { dataset: { test: "trpg-memory-" + book.id } }, [
          el("strong", { text: memory.endingTitle || scenario.endings[memory.ending]?.title || memory.ending }),
          el("p", { text: `CH.${memory.chapter} · DAY ${memory.day} / ${memory.participants.map(name).join("・")}` }),
          el("small", { text: "この夜の結末を、みんなとの思い出に。" }),
        ]));
      } else if (!stocked && !owned) {
        copy.append(el("p", { text: "入荷のきっかけ：" + book.stockRequires.map(name).join("・") + "が部活に入る" }));
      } else if (!owned) {
        copy.append(el("p", { text: `シナリオ本 ${yen(book.price)} · 買い物は時間を使いません` }),
          button("本棚に加える · " + yen(book.price), "trpg-buy-" + book.id, () => {
            if (buyTrpgBook(getState(), catalog, book.id)) { save(); render("新しいTRPGが、本棚に加わりました。"); }
            else render("本棚に加えられませんでした。所持金と入荷状況を確認してください。");
          }, readOnly || state.money < book.price));
      } else {
        copy.append(el("p", { text: cast.ok ? "今夜の卓：" + cast.participants.map(name).join("・") : cast.reason }),
          el("small", { text: scenario.duration + " · 夜の1枠 · 結末を迎えた本は一度きり" }),
          button("この仲間で遊ぶ", "trpg-play-" + book.id, () => play(scenario), readOnly || !cast.ok));
      }
      card.append(copy); books.append(card);
    }
    root.append(books, el("footer.trpg-campaign-footer", { text: "部員の空いている夜に招集。中断した本は、また遊べます。" }));
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
        allowReplay: false, closeLabel: "思い出を本棚へ", onComplete: result => {
          if (!disposed && getState() === state && completeTrpgTable(state, resources.catalog, scenario, ticket, result, { nightBusy: nightBusy() })) {
            completed = true; save();
          }
        } });
      if (disposed) return;
      busy = false;
      if (completed) close(); else render("卓を片付けました。本は未クリアのまま、また遊べます。");
    } catch (error) {
      busy = false;
      if (!disposed) render("卓を開けませんでした。本と今夜の行動は残っています。");
      console.error(error);
    }
  }

  async function load() {
    if (disposed) return;
    host.replaceChildren(el("div.trpg-loading", [el("p", { text: "本棚と、仲間の予定を確認しています…" }),
      button(closeLabel, "trpg-campaign-close", close)]));
    try { resources = suppliedResources || await loadTrpgLibrary({ signal: abort.signal }); render(); }
    catch {
      if (disposed) return;
      host.replaceChildren(el("div.trpg-loading", [el("p", { role: "status", text: "本棚を読み込めませんでした。もう一度お試しください。" }),
        button("再読み込み", "trpg-campaign-retry", load), button(closeLabel, "trpg-campaign-close", close)]));
    }
  }
  const ready = load();
  return { ready, finished, destroy: close, get disposed() { return disposed; } };
}
