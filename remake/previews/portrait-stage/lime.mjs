// 縦画面C案「煙の舞台」: LIME（メッセージ）を縦へ移した試作（要望台帳 VPM06）。
// 本編の LIME（remake/js/daily/phone.js）の流れをそのまま縦のチャット画面にした:
//   トーク一覧 → 相手を選ぶ → 既読ぶんは履歴としてすぐ出る → 未読が一通ずつ届く（打っている気配「…」のあと吹き出し）
//   → 返事を選ぶ（雑談は返事の札、誘いは 行く／断る／あとで）→ 相手の返事 → 一覧へ戻る → スマホを閉じる。
// 文面は正本の data/lime_messages.json をそのまま読む（文は写していない。台本を直せば、この試作にもそのまま効く）。
// 縦のチャット画面なので、十字キーと丸ボタンは置かない（2026-11-27 オーナー「縦レイアウトは必ず十字ボタンや決定ボタンはいらない　その分を専用UIに」）。
// 上＝相手の名前、真ん中＝吹き出し、下（親指の届く所）＝返事の札。PC では ↑↓ で選び、Enter で決める。
// 本編の進行・好感度・保存には触れない（返事を選んでも、この画面の中だけで終わる）。音は鳴らさない。

const DATA_URL = new URL("../../../data/lime_messages.json", import.meta.url).href;
// アイコンの置き場は、フォルダ（ui/lime）まで書く。公開物の軽量化（remake/tools/slim_deploy.py）は、ここの書き方から「直接読む元PNG」を見分けるので、
// 置き場の根もとだけを書くと、全部の元PNGを残すことになり、公開物が重くなる（この説明の中にも、置き場の根もとを引用符つきで書かない）
const LIME_ICONS = new URL("../../../assets/ui/lime/", import.meta.url).href;
let dataPromise = null;
/** 台本（正本）を一度だけ読む。一覧（PC）に何台並んでも通信は1回。 */
const loadData = () => (dataPromise ||= fetch(DATA_URL).then((res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); }));

// ── 本編の値の写し（出どころ） ──
const TOURNAMENT_DAY = 14; // remake/js/core/rules.js。「あと{daysLeft}日」は、届いた日から大会の日まで
const STORE_INVITE_COST = 3000; // remake/js/daily/invitations.js。店への誘いに乗る時の代金
const STORE_EVENTS = ["interaction_naru_night_01", "interaction_minto_noon_01", "outing_ageha_1", "outing_tsumugi_1"]; // 同上
const POLITE = ["sumi", "sensu", "uezono"]; // phone.js。はじめが敬語で返す相手
// 表示名（data/characters.json の lime_name）と、採用済みのアイコン（remake/js/daily/lime-icons.js・assets/ui/lime/）
const ACCOUNTS = {
  sumi: { name: "tonari 炭吉", icon: "sumi-b.png" },
  naru: { name: "鳴切亮太", icon: "naru-private.png" },
  minto: { name: "みんと＠PEPPERMINT", icon: "minto-b.png" },
  rio: { name: "rio.", icon: "rio-a.png" },
};
// スタンプ・画像（remake/data/manifest.json の limeMedia のうち、この試作に出る物）
const MEDIA = {
  st_minto_welcome: { kind: "stamp", src: "ui/lime/stamps/st_minto_welcome.png", w: 320, h: 320, alt: "ミントの葉の店員。待ってるね♪", preview: "［スタンプ］待ってるね♪" },
  st_sumi_ack: { kind: "stamp", src: "ui/lime/stamps/st_sumi_ack.png", w: 320, h: 320, alt: "使い込んだトング。おう", preview: "［スタンプ］おう" },
  im_rio_stock: { kind: "image", src: "ui/lime/images/im_rio_stock.webp", w: 960, h: 720, alt: "棚に並ぶ新しい小袋", preview: "［画像］入荷した小袋" },
};

// ── この試作の受信箱 ──
// どの日に何が届き、どう返事したか（reply＝選んだ返事の番号、go＝誘いに乗ったか）は、この試作のために決めた並び。届く日は台本の trigger_day のとおり。
// スミさんの急なシフトは、本編でも DAY3 に必ず届く（phone.js の sumiBaitoInvite）。その日は昼から夜まで店番なので、なるの夜の誘いは「先に別の約束」で断っている。
const PAST = [
  { id: "L21", day: 1, reply: 1 },
  { template: "sumi_baito", id: "_sumi_baito_inv_d3", day: 3, go: true },
  { id: "lime_naru_day3", day: 3, go: false, busy: true },
];
const CASES = {
  // 地図と同じ第1章 DAY 5 の昼。未読は、みんとからの一通（地図の LIME の札の「1」）
  chat: { name: "DAY5 雑談", day: 5, items: [...PAST, { id: "lime_minto_day4", day: 4, go: true }, { id: "lime_fookah_promo_1", day: 4, reply: 0 }, { id: "lime_minto_day5", day: 5 }] },
  // 前の日の朝。みんとの店への誘い（返事待ち）と、凛想の入荷情報が届いた所
  invite: { name: "DAY4 誘い", day: 4, items: [...PAST, { id: "lime_minto_day4", day: 4 }, { id: "lime_fookah_promo_1", day: 4 }] },
};
// 誘いに乗ってスマホを閉じた時に向かう、この試作の場面
const GOTO = { interaction_minto_noon_01: "minto", __sumi_baito__: "floor" };

const ICONS = {
  lmBack: '<path d="M14.500 5l-7 7 7 7"/>',
  lmClose: '<rect x="7" y="3" width="10" height="18" rx="2.200"/><path d="M10.500 18h3"/>',
  lmAct: '<circle cx="12" cy="12" r="8.500"/><path d="M12 7.500V12l3 2"/>',
  lmYen: '<circle cx="12" cy="12" r="8.500"/><path d="M8.500 7.500l3.500 5 3.500-5M12 12.500V17M9 12.500h6M9 15h6"/>',
};

export class LimeScene {
  /** 場面の名札（app.mjs が読む）: 名前・光の色・1台表示のつまみの選び方・一覧（PC）に並べる場面。 */
  static META = {
    id: "lime", label: "LIME", acc: "#8de055",
    options: { name: "case", default: "chat", values: Object.fromEntries(Object.entries(CASES).map(([id, c]) => [id, c.name])) },
    gallery: {
      title: "LIME（メッセージ）",
      note: "本編の LIME を縦のチャット画面へ。文面は本編の台本（data/lime_messages.json）をそのまま読む。十字キーと丸ボタンは置かず、上に相手の名前、真ん中に吹き出し、下の親指の届く所に返事の札。一覧 → トーク → 返事 → 相手の返事まで触れる。",
      shots: [
        { caption: "トーク一覧（未読1件）" },
        { caption: "トーク・返事を選ぶ", shot: "thread", with: "minto" },
        { caption: "返事のあと", shot: "replied", with: "minto", pick: "0" },
        { caption: "誘いに返事（DAY 4）", case: "invite", shot: "thread", with: "minto" },
        { caption: "履歴（誘いに乗った日・スタンプ）", shot: "thread", with: "sumi" },
      ],
    },
  };

  /**
   * @param opts case＝受信箱の日（chat / invite）、with＝最初に開くトークの相手、shot＝一覧（PC）に並べる場面（thread / replied）、pick＝replied で選ぶ返事の番号
   */
  constructor(phone, kit, opts = {}) {
    Object.assign(this, { phone, kit, el: phone.el, opts: { ...opts } });
    Object.assign(kit.ICONS, ICONS);
    this.caseId = CASES[opts.case] ? opts.case : "chat";
    this.day = CASES[this.caseId].day;
    Object.assign(this, { gen: 0, view: "list", account: null, inbox: [], cursor: 0, choice: null, goto: null, timers: new Set(), ready: false });
    if (!phone.fixed) { phone.extOpts.shot = null; phone.extOpts.with = null; phone.extOpts.pick = null; } // 途中から開くのは一度だけ
  }

  /* ── 骨組み ── */

  html() {
    const { REMAKE_IMG } = this.kit;
    return `
      <img class="amb lm-amb" src="${REMAKE_IMG}backgrounds/bg_osu_map_day.webp" alt="">
      <div class="lm-app">
        <header class="lm-head" data-slot="head"></header>
        <div class="lm-chat" data-slot="chat"><p class="lm-empty">…</p></div>
        <footer class="lm-actions" data-slot="actions"></footer>
      </div>`;
  }

  mount() {
    const q = (sel) => this.el.querySelector(sel);
    this.refs = { amb: q(".lm-amb"), head: q('[data-slot="head"]'), chat: q('[data-slot="chat"]'), actions: q('[data-slot="actions"]') };
    this.showHead();
    loadData().then((data) => {
      if (this.dead) return;
      this.inbox = CASES[this.caseId].items.map((spec) => this.receive(spec, data)).filter(Boolean);
      this.ready = true;
      const { opts } = this;
      if (opts.with && this.thread(opts.with).length) this.showThread(opts.with);
      else this.showList();
    }).catch((error) => {
      if (this.dead) return;
      console.warn("LIME の台本を読めませんでした:", error);
      this.refs.chat.innerHTML = `<p class="lm-empty">トークを読み込めませんでした</p>`;
      this.setActions(`<button class="lm-reply ghost" data-act="lm-close">${this.kit.icon("lmClose")}<span>スマホを閉じる</span></button>`);
    });
  }

  destroy() {
    this.dead = true;
    this.gen += 1;
    for (const id of this.timers) clearTimeout(id);
    this.timers.clear();
    this.choice?.resolve(null);
  }

  /** 待つ（一覧（PC）の固定表示では待たない）。 */
  wait(ms) {
    if (this.phone.fixed || this.instant) return Promise.resolve();
    return new Promise((resolve) => { const id = setTimeout(() => { this.timers.delete(id); resolve(); }, ms); this.timers.add(id); });
  }

  /* ── 受信箱を作る（本編 phone.js の receiveItem・runItem と同じ形） ── */

  receive(spec, data) {
    let src = data.messages.find((m) => m.id === spec.id);
    if (spec.template) {
      // スミさんの急なシフト: 理由は日付で選ぶ（phone.js の sumiBaitoInvite と同じ）
      const { reasons, repeat_messages: repeated, ...template } = data.templates[spec.template];
      src = { ...template, id: spec.id, messages: template.messages.map((text) => (text === "{reason}" ? reasons[spec.day % reasons.length] : text)) };
    }
    if (!src) { console.warn("LIME の台本に無い:", spec.id); return null; }
    const daysLeft = String(TOURNAMENT_DAY - spec.day);
    const freeze = (text) => String(text).replace(/\{daysLeft\}/g, daysLeft).replace(/\{day\}/g, String(spec.day));
    let media = 0;
    const messages = (src.messages || []).flatMap((line) => {
      const content = this.content(line);
      if (!content) return [];
      if (content.kind !== "text") {
        // スタンプ・画像は一通につき1つ。その章で使える物だけ
        if (media >= 1 || !content.asset || (line.media_chapters && !line.media_chapters.includes(1))) return [];
        media += 1;
        return [line];
      }
      return [{ text: freeze(content.text) }];
    });
    const item = { id: src.id, day: spec.day, sender: src.sender, msg: { ...src, messages }, read: false, done: false, log: [] };
    // 前の日までに済ませた返事
    if (spec.reply !== undefined) { item.read = true; this.settleReply(item, src.replies[spec.reply]); }
    else if (spec.go !== undefined) { item.read = true; this.settleInvite(item, spec.go, { busy: !!spec.busy }); }
    return item;
  }

  content(line) {
    if (typeof line === "string") return { kind: "text", text: line };
    if (!line || typeof line !== "object") return null;
    const kind = ["stamp", "image"].find((key) => key in line);
    if (kind) {
      const asset = MEDIA[line[kind]];
      return { kind, asset: asset?.kind === kind ? asset : null, fallback: kind === "stamp" ? "［スタンプを表示できません］" : "［画像を表示できません］" };
    }
    return typeof line.text === "string" ? { kind: "text", text: line.text } : null;
  }

  /** 雑談の返事を確定する。戻り値は、仲が近づく点（0〜2）。 */
  settleReply(item, reply) {
    item.done = true;
    item.log.push({ me: true, text: reply.text });
    if (reply.response) item.log.push({ me: false, text: reply.response });
    return Number.isFinite(reply.affinity) ? Math.max(0, Math.min(2, reply.affinity)) : 1;
  }

  /** 誘いの文言（本編 phone.js の runItem と同じ決め方）。 */
  inviteWords(item, { busy = false } = {}) {
    const m = item.msg, polite = POLITE.includes(m.sender);
    const store = m.accept_event === "interaction_minto_noon_01" && !m.private_schedule && !m.after_close;
    const night = m.time_slot === "night";
    return {
      go: m.accept_text || (polite ? "行きます！" : "行く！"),
      no: busy ? (polite ? "すみません、先に別の約束があって……" : "ごめん、先に別の約束をしてしまった") : (polite ? "すみません、今日は難しいです……" : "ごめん、今日は難しい"),
      cost: STORE_EVENTS.includes(m.accept_event) ? STORE_INVITE_COST : 0,
      // 2回目からの短い言い方（はじめての時の長い説明は、縦では2行に収まらない）
      hint: `返事は今日の${store ? "夜の行動の前まで（店の営業日だけ）" : night ? "夜の行動の前まで" : "昼の行動の前まで"}`,
      note: m.accept_event === "__sumi_baito__" ? "このあと tonari のシフトに入る" : m.after_close ? "仕事を終えたあとに会う約束ができた" : night ? "今夜の約束ができた" : "このあと向かうことにした",
    };
  }

  settleInvite(item, go, opts = {}) {
    const m = item.msg, words = this.inviteWords(item, opts);
    item.done = true;
    item.result = go ? "accepted" : "declined";
    item.log.push({ me: true, text: go ? words.go : words.no });
    if (go) {
      if (m.accept_reply?.stamp && MEDIA[m.accept_reply.stamp] && !item.msg.messages.some((line) => this.content(line)?.kind !== "text")) item.log.push({ me: false, stamp: m.accept_reply.stamp });
      item.log.push({ note: words.note });
    } else if (m.decline_response) item.log.push({ me: false, text: m.decline_response.text });
    return words;
  }

  thread(account) { return this.inbox.filter((item) => item.sender === account); }
  unread() { return this.inbox.filter((item) => !item.read).length; }
  dayLabel(item) { return item.day === this.day ? "今日" : item.day === this.day - 1 ? "昨日" : `DAY ${item.day}`; }
  name(account) { return ACCOUNTS[account]?.name || "？？？"; }

  avatar(account, cls = "") {
    const icon = ACCOUNTS[account]?.icon;
    return icon ? `<img class="lm-face ${cls}" src="${LIME_ICONS}${icon}" alt="">` : `<span class="lm-face blank ${cls}">？</span>`;
  }

  /* ── 上の帯・下の返事の欄 ── */

  showHead() {
    const { icon, esc } = this.kit;
    if (this.view === "thread") {
      this.refs.head.innerHTML = `<button class="lm-back" data-act="lm-list" aria-label="トーク一覧へ戻る">${icon("lmBack")}</button>
        ${this.avatar(this.account)}<b class="lm-name">${esc(this.name(this.account))}</b>`;
      return;
    }
    const unread = this.unread();
    this.refs.head.innerHTML = `<span class="lm-logo">LIME</span><b class="lm-title">トーク</b>
      <span class="lm-when">${unread ? `<em aria-label="未読${unread}件">${unread}</em>` : ""}DAY ${this.day}・昼</span>`;
  }

  setActions(html) {
    this.refs.actions.innerHTML = html;
    this.scroll();
  }

  scroll() {
    const { chat } = this.refs;
    if (this.view === "thread") chat.scrollTop = chat.scrollHeight;
  }

  /* ── トーク一覧 ── */

  showList() {
    this.gen += 1;
    this.choice?.resolve(null);
    Object.assign(this, { view: "list", account: null, choice: null });
    const { esc } = this.kit, { chat } = this.refs;
    this.el.dataset.lmView = "list";
    this.refs.amb.src = `${this.kit.REMAKE_IMG}backgrounds/bg_osu_map_day.webp`;
    this.showHead();
    // 新しく届いた相手が上（本編と同じ）
    const senders = [];
    for (const item of [...this.inbox].reverse()) if (!senders.includes(item.sender)) senders.push(item.sender);
    this.senders = senders;
    this.cursor = Math.max(0, senders.findIndex((id) => this.thread(id).some((item) => !item.read)));
    chat.classList.add("list");
    chat.innerHTML = senders.length ? senders.map((sender, i) => {
      const items = this.thread(sender), last = items.at(-1);
      const unread = items.some((item) => !item.read);
      const openInvite = items.some((item) => item.msg.type === "invitation" && !item.done);
      const lines = [...last.msg.messages, ...(last.read ? last.log : [])].map((line) => this.content(line)).filter(Boolean);
      const lastLine = lines.at(-1);
      const preview = lastLine?.kind === "text" ? lastLine.text : lastLine?.asset?.preview || lastLine?.fallback || "";
      const tag = openInvite ? `<span class="lm-tag invite">誘い</span>` : last.msg.type === "chat" ? `<span class="lm-tag">雑談</span>` : "";
      return `<button class="lm-row${unread ? " unread" : ""}" data-act="lm-open" data-account="${sender}" aria-current="${i === this.cursor}" style="--i:${i}">
        <span class="lm-row-face">${this.avatar(sender)}${unread ? `<i class="lm-dot"></i>` : ""}</span>
        <span class="lm-row-main"><b>${esc(this.name(sender))}</b><span>${esc(preview)}</span></span>
        <span class="lm-row-side"><small>${this.dayLabel(last)}</small>${tag}</span></button>`;
    }).join("") : `<p class="lm-empty">まだトークはない</p>`;
    chat.scrollTop = 0;
    this.setActions(`<button class="lm-reply ghost" data-act="lm-close">${this.kit.icon("lmClose")}<span>スマホを閉じる</span></button>`);
  }

  syncCursor() {
    const nodes = this.view === "list" ? this.refs.chat.querySelectorAll(".lm-row") : this.refs.actions.querySelectorAll(".lm-reply:not(.ghost)");
    nodes.forEach((node, i) => node.setAttribute("aria-current", String(i === this.cursor)));
  }

  /* ── トーク ── */

  row(html, side, { animate = true } = {}) {
    const { chat } = this.refs;
    chat.insertAdjacentHTML("beforeend", `<div class="lm-msg ${side}${animate && !this.phone.fixed && !this.instant ? "" : " past"}">${html}</div>`);
    this.lastSide = side;
    this.scroll();
    return chat.lastElementChild;
  }

  /** 相手の顔は、続けて届く吹き出しの最初の一つにだけ付ける。 */
  face(sender) { return this.lastSide === "peer" ? `<span class="lm-face sm gap"></span>` : this.avatar(sender, "sm"); }

  async bubble(text, mine, sender, animate = true) {
    const g = this.gen, live = () => !this.dead && this.gen === g;
    if (!mine && animate && !this.phone.fixed && !this.instant) {
      // 相手が打っている気配（…）を一瞬見せてから吹き出しにする
      const before = this.lastSide;
      const typing = this.row(`${this.face(sender)}<div class="lm-bubble typing"><i></i><i></i><i></i></div>`, "peer");
      await this.wait(420);
      if (!live()) return;
      typing.remove();
      this.lastSide = before;
    }
    this.row(`${mine ? "" : this.face(sender)}<div class="lm-bubble">${this.kit.esc(text)}</div>`, mine ? "me" : "peer", { animate });
    if (animate) await this.wait(mine ? 300 : 460);
  }

  async media(content, sender, animate = true) {
    const asset = content.asset;
    const inner = asset ? `<img src="${this.kit.REMAKE_IMG}${asset.src}" alt="${this.kit.esc(asset.alt)}" width="${asset.w}" height="${asset.h}">` : `<span>${content.fallback}</span>`;
    const node = this.row(`${this.face(sender)}<div class="lm-media lm-${content.kind}${asset ? "" : " fallback"}" style="aspect-ratio:${asset ? `${asset.w} / ${asset.h}` : "auto"}">${inner}</div>`, "peer", { animate });
    node.querySelector("img")?.addEventListener("load", () => this.scroll(), { once: true });
    if (animate) await this.wait(460);
  }

  async draw(line, mine, sender, animate = true) {
    const content = this.content(line);
    if (!content) return;
    if (content.kind === "text") return this.bubble(content.text, mine, sender, animate);
    return this.media(mine ? { ...content, asset: null } : content, sender, animate);
  }

  note(text, cls = "") {
    this.refs.chat.insertAdjacentHTML("beforeend", `<div class="lm-note ${cls}">${this.kit.esc(text)}</div>`);
    this.lastSide = null;
    this.scroll();
  }

  /** 返事の札を出して、選ばれるのを待つ（一覧へ戻った時は null）。 */
  choose(options, hint = "") {
    const { icon, esc } = this.kit;
    return new Promise((resolve) => {
      this.choice = { options, resolve: (value) => { this.choice = null; resolve(value); } };
      this.cursor = 0;
      this.setActions(`${hint ? `<p class="lm-hint">${esc(hint)}</p>` : ""}${options.map((o, i) => `<button class="lm-reply${o.later ? " later" : ""}" data-act="lm-pick" data-i="${i}" aria-current="${i === 0}"${o.disabled ? " disabled" : ""} style="--i:${i}">
        <span>${esc(o.label || o.text)}</span>${o.costs ? `<em>${o.costs.map(([name, text]) => `<i>${icon(name)}${esc(text)}</i>`).join("")}</em>` : ""}</button>`).join("")}`);
    });
  }

  async showThread(account) {
    this.gen += 1;
    this.choice?.resolve(null);
    const g = this.gen, live = () => !this.dead && this.gen === g;
    Object.assign(this, { view: "thread", account, choice: null, lastSide: null });
    const { chat } = this.refs, items = this.thread(account);
    this.el.dataset.lmView = "thread";
    if (ACCOUNTS[account]?.icon) this.refs.amb.src = `${LIME_ICONS}${ACCOUNTS[account].icon}`;
    this.showHead();
    chat.classList.remove("list");
    chat.innerHTML = "";
    this.setActions("");
    // 既読ぶんは履歴としてすぐ出す（日付の区切りつき）
    let lastDay = null;
    this.instant = true;
    for (const item of items) {
      if (!item.read) continue;
      if (item.day !== lastDay) { this.note(this.dayLabel(item), "day"); lastDay = item.day; }
      for (const line of item.msg.messages) this.draw(line, false, account, false);
      if (item.done) for (const entry of item.log) { if (entry.note) this.note(entry.note); else this.draw(entry, entry.me, account, false); }
    }
    this.instant = false;
    // 未読・返事待ちを順に流す
    for (const item of items) {
      if (!live()) return;
      if (item.read && item.done) continue;
      if (!item.read && item.day !== lastDay) { this.note(this.dayLabel(item), "day"); lastDay = item.day; }
      const result = await this.runItem(item, account, live);
      if (result === "deferred" && live()) { this.showList(); return; }
    }
    if (!live()) return;
    this.setActions(`<button class="lm-reply ghost" data-act="lm-list">${this.kit.icon("lmBack")}<span>トーク一覧へ</span></button>`);
    this.cursor = 0;
  }

  async runItem(item, account, live) {
    const m = item.msg;
    if (!item.read) {
      for (const line of m.messages) { await this.draw(line, false, account); if (!live()) return; }
      item.read = true; // 読み終える前に戻ったら、既読にしない
    }
    if (item.done) return;
    // 一覧（PC）の「返事のあと」: 決めてある返事をそのまま選ぶ
    const auto = this.opts.shot === "replied" && this.phone.fixed ? Number(this.opts.pick) || 0 : null;
    if (m.type === "invitation" && m.accept_event) {
      const words = this.inviteWords(item);
      const options = [
        { text: words.go, go: true, costs: [["lmAct", "行動1回"], ...(words.cost ? [["lmYen", `${words.cost.toLocaleString("ja-JP")}円`]] : [])] },
        { text: words.no, go: false },
        { text: "あとで返事する", label: "あとで返事する（トーク一覧へ）", later: true },
      ];
      const pick = auto !== null ? options[auto] : await this.choose(options, words.hint);
      if (!pick || !live() || item.done) return;
      if (pick.later) return "deferred";
      this.settleInvite(item, pick.go);
      this.setActions("");
      if (pick.go) this.goto = GOTO[m.accept_event] || null;
      for (const entry of item.log) { if (entry.note) this.note(entry.note); else await this.draw(entry, entry.me, account); if (!live()) return; }
      return;
    }
    if (m.replies?.length) {
      const reply = auto !== null ? m.replies[auto] : await this.choose(m.replies);
      if (!reply || !live() || item.done) return;
      const points = this.settleReply(item, reply);
      this.setActions("");
      await this.bubble(reply.text, true);
      if (!live()) return;
      if (reply.response) await this.bubble(reply.response, false, account);
      if (live() && points > 0) this.note("♡ ほんの少し仲良くなった");
      return;
    }
    item.done = true;
  }

  /* ── 操作 ── */

  close() {
    if (this.phone.fixed) return;
    // 誘いに乗っていたら、その場面へ。そうでなければ地図へ
    this.phone.setScene(this.goto || "map");
  }

  pick(index) {
    const option = this.choice?.options[index];
    if (!option || option.disabled) return;
    this.choice.resolve(option);
  }

  onClick(event) {
    const hit = event.target.closest("[data-act]");
    if (!hit || !this.el.contains(hit)) return false;
    const act = hit.dataset.act;
    if (!act.startsWith("lm-")) return false;
    if (!this.ready && act !== "lm-close") return true;
    if (act === "lm-open") this.showThread(hit.dataset.account);
    else if (act === "lm-list") this.showList();
    else if (act === "lm-close") this.close();
    else if (act === "lm-pick") this.pick(Number(hit.dataset.i));
    return true;
  }

  /** PC: ↑↓ で一覧の相手・返事の札を選ぶ。 */
  move(dir) {
    if (!this.ready || (dir !== "up" && dir !== "down")) return;
    const count = this.view === "list" ? this.senders.length : this.choice?.options.length || 0;
    if (!count) return;
    this.cursor = (this.cursor + (dir === "down" ? 1 : count - 1)) % count;
    this.el.dataset.lmKeys = "true"; // キーで選んでいる時だけ、選んでいる行に枠を出す
    this.syncCursor();
    if (this.view === "list") this.refs.chat.querySelectorAll(".lm-row")[this.cursor]?.scrollIntoView?.({ block: "nearest" });
  }

  /** PC: Enter で決める（一覧＝開く、返事の札＝選ぶ、返事が無い時＝一覧へ戻る）。 */
  pressA() {
    if (!this.ready) return;
    if (this.view === "list") { if (this.senders[this.cursor]) this.showThread(this.senders[this.cursor]); return; }
    if (this.choice) this.pick(this.cursor);
    else if (this.refs.actions.querySelector('[data-act="lm-list"]')) this.showList();
  }

  tick() {}
  relayout() { this.scroll(); }
}
