// 縦画面C案「煙の舞台」: スチル（イベントCG）を縦に作り直した絵を、実際の縦の画面で見る試作（要望台帳 VPT01〜）。
// 絵は remake/img/cgs/portrait/<cg_id>.webp（2:3。原画とプロンプトは asset_sources/stills-portrait-20261128/）。
// 台詞は本編の台本（data/dialogue/*.json）の、そのスチルの show_cg から hide_cg までをそのまま読む（文は写していない）。
// 帯は本編と同じ組版（photo-talk.mjs の Telop）。帯か絵を押すと次の台詞、最後の台詞の後は次のスチルへ。
// 下の札: 前のスチル／「横の元絵」（今の本編の横長の絵を、同じ縦の画面に置いた見え方と比べる）／次のスチル。十字キーの左右でも送れる。
import { loadDialogue, findDialogue, isSpeech, Telop } from "./photo-talk.mjs";

// [cg_id, 区切り, 題, 台本のファイル, 場面の id]。題は本編のギャラリーの題（gallery-catalog.js）、無いものは短く付けた
const STILLS = [
  ["cg_oneesan_first_smoke", "ch1", "たまに来るお姉さん", "ch1_main", "ch1_tutorial_oneesan"],
  ["cg_ch1_sumi_training", "ch1", "閉店後の古い瓶", "ch1_main", "ch1_day5_sumi_story"],
  ["cg_tsumugi_smoke_color", "ch1", "煙の色", "ch1_tsumugi", "ch1_tsumugi_smoke_color"],
  ["cg_ch1_tsumugi_heart_art", "ch1", "応募する絵", "ch1_main", "ch1_tsumugi_sketch"],
  ["cg_minto_cheki", "ch1", "みんととのツーショット", "ch1_events", "interaction_minto_noon_01"],
  ["cg_minto_casual", "ch1", "私服のみんと", "ch1_events", "outing_minto_1"],
  ["cg_ch1_minto_casual_reveal", "ch1", "駅前の待ち合わせ", "ch1_minto", "ch1_minto_fifth"],
  ["cg_ch1_tournament_battle", "ch1", "地元大会の一台", "ch1_tournament", "ch1_tournament_match"],
  ["cg_ch1_sui_smile", "ch1", "会長の小さな笑み", "ch1_tournament", "ch1_tournament_reveal"],
  ["cg_ch1_dr_kemuri_hook", "ch1", "客席に残った博士", "ch1_tournament", "ch1_tournament_after"],
  ["cg_ch2_kanzaki_id_check", "ch2", "神崎煙草店の年齢確認", "ch2_deliveries", "remake_ch2_delivery_kumicho"],
  ["cg_ch2_sofa_wet_cloth", "ch2", "焦げ跡と濡れ布", "ch2_main", "ch2_sofa_burn"],
  ["cg_ch2_ageha_lesson", "ch2", "あげはの吸い方講座", "ch2_story_extra", "ch2_ageha_lesson"],
  ["cg_ch2_naru_score_sheet", "ch2", "光る採点表", "ch2_isolation", "ch2_naru_confrontation"],
  ["cg_naru_after_hours", "ch2", "なる・旅先のやり直し", "ch2_isolation", "ch2_naru_window"],
  ["cg_ch2_rest_notebook", "ch2", "ノートを閉じた日", "ch2_home", "ch2_rest_notebook"],
  ["cg_ch2_rei_earphone", "ch2", "片耳ぶんの一曲", "remake_ch2", "remake_ch2_eve_kuraudo"],
  ["cg_ch2_ageha_white_bear", "ch2", "白いクマと閉店後", "ch2_tournament", "ch2_tournament_ageha_heart"],
  ["cg_ch3_childhood_offered_hand", "ch3", "差し出された手", "ch3_prologue", "ch3_childhood_opening"],
  ["cg_saku_mashiro_childhood", "ch3", "半分この絵", "ch3_prologue", "ch3_childhood_opening"],
  ["cg_mashiro_double_apple", "ch3", "ダブルアップル", "ch3_double_apple", "ch3_double_apple_incident"],
  ["cg_ch3_mashiro_no_craft_day", "ch3", "作らないと決めた昼", "ch3_double_apple", "ch3_rest_before_recovery"],
  ["cg_ch3_mukai_latte_cat", "ch3", "そっぽを向く泡の猫", "ch3_mukai", "ch3_mukai_latte_cat"],
  ["cg_naru_next_entry", "ch3", "なる・もう一つの予選", "ch3_main", "ch3_naru_work"],
  ["cg_ch3_liars_night", "ch3", "嘘つきたちの夜", "ch3_main", "ch3_tournament_eve"],
  ["cg_ch3_national_ask_customer", "ch3", "炭より先に、客の返事", "ch3_main", "ch3_national_adjustment"],
  ["cg_naru_last_chance", "ch3", "なる・勝って帰る日", "ch3_main", "ch3_naru_reconcile"],
  ["cg_ch3_half_cake", "ch3", "半分ずつのケーキ", "ch3_main", "ch3_enmaku_cleanup"],
  ["cg_ch4_dubai_arrival", "ch4", "ドバイ到着", "ch4_main", "ch4_opening"],
  ["cg_ch4_traveler_chair", "ch4", "日陰の椅子", "ch4_main", "ch4_stranger_first"],
  ["cg_ch4_festa_welcome", "ch4", "FESTAの椅子と水", "ch4_main", "ch4_festa"],
  ["cg_ch4_creek_dhow", "ch4", "クリークの荷積み", "ch4_spots", "ch4_creek_dhow"],
  ["cg_ch4_noor_pencil_x", "ch4", "消さなかった×", "noor", "ch4_noor_story_pencil_line"],
  ["cg_ch4_traveler_tongs", "ch4", "返したトング", "ch4_main", "ch4_stranger_third"],
  ["cg_ch4_sheikh_reveal", "ch4", "四つ目の台", "ch4_main", "ch4_tournament_start"],
  ["cg_ch4_world_handshake", "ch4", "次は、俺が取る", "ch4_main", "ch4_result"],
  ["cg_ch4_young_sumi_water", "ch4", "十五年前の一杯の水", "ch4_main", "ch4_ending"],
  ["cg_ch5_sumi_pulls_chair", "ch5", "おかえりの椅子", "ch5_main", "ch5_return_to_tonari"],
  ["cg_ch5_doctor_yunomi", "ch5", "湯のみを包む博士", "ch5_main", "ch5_unrecorded_day"],
  ["cg_ch5_tsumugi_serves_hajime", "ch5", "最初は、ゆっくりどうぞ", "ch5_main", "ch5_tsumugi_third"],
  ["cg_ch5_adam_two_bowls", "ch5", "どの顔だった", "ch5_main", "ch5_free_eden_adam"],
  ["cg_ch5_shisha_9000", "ch5", "SHISHA-9000", "ch5_main", "ch5_match_day_arrival"],
  ["cg_ch5_regular_hose_lap", "ch5", "今日は時間、あるから", "ch5_main", "ch5_relationship_before_second_cup"],
  ["cg_ch5_cocreation_notes", "ch5", "数字の隣に味の言葉", "ch5_main", "ch5_doctor_cocreation"],
  ["cg_ch5_party_toast", "ch5", "世界一の乾杯", "ch5_party", "ch5_party_open"],
  ["cg_minto_confession", "love", "みんと・告白", "confession", "confession_minto_accept"],
  ["cg_tsumugi_confession", "love", "つむぎ・告白", "confession", "confession_tsumugi_accept"],
  ["cg_ageha_confession", "love", "あげは・告白", "confession", "confession_ageha_accept"],
  ["cg_mashiro_confession", "love", "ましろ・告白", "confession", "confession_mashiro_accept"],
  ["cg_rio_confession", "love", "凛想・告白", "confession", "confession_rio_accept"],
  ["cg_hiyori_confession", "love", "ひより・告白", "confession", "confession_hiyori_accept"],
  ["cg_samechan_confession", "love", "サメちゃん・告白", "confession", "confession_samechan_accept"],
  ["cg_ending_tonari_night", "love", "閉店後のtonari", "ending", "ending_start"],
].map(([id, set, title, file, scene]) => ({ id, set, title, file, scene }));
const SETS = { ch1: "第1章", ch2: "第2章", ch3: "第3章", ch4: "第4章", ch5: "第5章", love: "告白・結末" };
const STILL_IDS = new Set(STILLS.map((s) => s.id));

// 帯の名前: 本編の realName（js/core/data.js）と同じ決め方で data/characters.json から作る（試作なので全員を名乗った後として出す）
let namesOnce = null;
const loadNames = () => namesOnce ??= fetch(new URL("../../../data/characters.json", import.meta.url)).then((r) => r.json()).then((list) => {
  const names = {};
  for (const c of list) {
    if (!c?.id) continue;
    if (c.display_name) { names[c.id] = c.display_name; continue; }
    const outer = String(c.name || c.id).replace(/（[^）]*）/g, "");
    const inParen = /（[^）]*\/\s*([^）]+)）/.exec(c.name || "");
    names[c.id] = outer.includes(" / ") ? outer.split(" / ")[0].trim() : inParen ? inParen[1].trim() : outer.replace(/\s+/g, "").trim();
  }
  return names;
}).catch(() => ({}));

/** 台本の1場面から、そのスチルを出している間の台詞（show_cg の次から hide_cg まで）を取り出す */
function linesFor(scene, id) {
  const all = [scene.lines, ...Object.values(scene.branches || {})].filter(Array.isArray);
  for (const lines of all) {
    const at = lines.findIndex((l) => l.type === "show_cg" && l.cg_id === id);
    if (at < 0) continue;
    const end = lines.findIndex((l, i) => i > at && (l.type === "hide_cg" || (l.type === "show_cg" && l.cg_id !== id)));
    return lines.slice(at + 1, end < 0 ? undefined : end).filter(isSpeech)
      .map((l) => ({ ...l, text: l.text.replace(/\[\/?[a-z]+\]/g, "") })); // 本編の演出の印（[shiver] など）は外して出す
  }
  return [];
}

export class StillsScene {
  static META = {
    id: "stills", label: "スチル", acc: "#f1d79a",
    gallery: {
      title: "スチル（縦に作り直したイベントCG）",
      note: "本編のスチル53枚を、縦の画面の幅いっぱいに出す2:3の絵に作り直した（画像生成API・新バージョンの立ち絵の絵柄にそろえた塗り）。顔と手は画面の上6割、下3割は帯が重なるので静かにしてある。室内の場面は部屋を描かず、場所の色だけのぼけにした（間取りが崩れないように）。台詞は本編の台本の、そのスチルを出している間の行をそのまま読む。下の「横の元絵」で、今の横長の絵を同じ画面に置いた見え方と比べられる。",
      shots: [
        { caption: "第1章・閉店後の古い瓶（室内は背景をぼかす）", still: "cg_ch1_sumi_training" },
        { caption: "第1章・私服のみんと（屋外は場所を残す）", still: "cg_minto_casual" },
        { caption: "第2章・あげはの吸い方講座（3人を前後にずらす）", still: "cg_ch2_ageha_lesson" },
        { caption: "告白・つむぎ", still: "cg_tsumugi_confession" },
        { caption: "比べる: 今の横長の元絵を縦の画面に置いた所", still: "cg_ch1_sumi_training", old: true },
      ],
    },
    options: [{ name: "set", label: "スチル", default: "ch1", values: SETS }],
  };

  /** @param opts set＝どの区切りから見るか、still＝最初に出すスチル、old＝元絵で比べる（一覧の見本） */
  constructor(phone, kit, opts = {}) {
    Object.assign(this, { phone, kit, el: phone.el, gen: 0, showOld: !!opts.old });
    const first = STILL_IDS.has(opts.still) ? opts.still : STILLS.find((s) => s.set === opts.set)?.id || STILLS[0].id;
    this.i = STILLS.findIndex((s) => s.id === first);
    if (!phone.fixed) phone.extOpts.still = null;
  }

  get still() { return STILLS[this.i]; }

  html() {
    return `
      <div class="st-app">
        <section class="st-stage" data-slot="stage">
          <img class="st-amb" data-slot="amb" alt="">
          <img class="st-pic" data-slot="pic" alt="">
          <img class="st-old" data-slot="old" alt="" hidden>
          <header class="st-head"><span class="st-title"><b data-slot="title"></b><small data-slot="set"></small></span><span class="st-count" data-slot="count"></span></header>
        </section>
        <section class="pt-telop off" data-slot="telop"><b class="pt-name"></b><p class="pt-text"></p><i class="pt-more" aria-hidden="true"></i></section>
        <div class="pt-ctrl st-ctrl">
          <div class="st-nav">
            <button data-st="prev" aria-label="前のスチル"><span>‹</span></button>
            <button data-st="old" data-slot="oldBtn" aria-pressed="false">横の元絵</button>
            <button data-st="next" aria-label="次のスチル"><span>›</span></button>
          </div>
        </div>
      </div>`;
  }

  mount() {
    const q = (sel) => this.el.querySelector(sel);
    this.refs = Object.fromEntries(["stage", "amb", "pic", "old", "title", "set", "count", "telop", "oldBtn"].map((k) => [k, q(`[data-slot="${k}"]`)]));
    loadNames().then((names) => {
      if (this.dead) return;
      this.telop = new Telop(this.refs.telop, this.kit, { names });
      this.show();
    });
  }

  /** 今のスチルを出して、台詞を流す */
  async show() {
    const gen = ++this.gen, s = this.still, { refs } = this;
    const { REMAKE_IMG: IMG } = this.kit;
    refs.pic.src = `${IMG}cgs/portrait/${s.id}.webp`;
    refs.amb.src = refs.pic.src;
    refs.old.src = `${IMG}cgs/${s.id}.webp`;
    refs.title.textContent = s.title;
    refs.set.textContent = SETS[s.set];
    refs.count.textContent = `${this.i + 1} / ${STILLS.length}`;
    this.syncOld();
    refs.pic.classList.remove("in"); void refs.pic.offsetWidth; refs.pic.classList.add("in");
    this.telop.stop();
    let lines = [];
    try { lines = linesFor(findDialogue(await loadDialogue(s.file), s.scene) || { lines: [] }, s.id); } catch (error) { console.warn(`${s.file}.json を読めませんでした:`, error); }
    if (gen !== this.gen || this.dead) return;
    if (!lines.length) { this.telop.say({ speaker: "", text: "（このスチルの台詞が台本に見つからない）" }, { wait: false }); return; }
    if (this.phone.fixed) { this.telop.say(lines[0], { wait: false }); return; }
    for (const line of lines) {
      await this.telop.say(line);
      if (gen !== this.gen || this.dead) return;
    }
    this.step(1); // 最後の台詞の後に押すと、次のスチルへ
  }

  step(d) { this.i = (this.i + d + STILLS.length) % STILLS.length; this.show(); }

  syncOld() {
    this.refs.old.hidden = !this.showOld;
    this.refs.pic.hidden = this.showOld;
    this.refs.oldBtn.setAttribute("aria-pressed", String(this.showOld));
    this.el.querySelector(".st-app")?.classList.toggle("old", this.showOld);
  }

  onClick(event) {
    const hit = event.target.closest("[data-st]");
    if (hit && this.el.contains(hit)) {
      const act = hit.dataset.st;
      if (act === "old") { this.showOld = !this.showOld; this.syncOld(); }
      else this.step(act === "next" ? 1 : -1);
      return true;
    }
    if (event.target.closest('[data-slot="telop"]') || event.target.closest('[data-slot="stage"]')) { this.telop?.tap(); return true; }
    return false;
  }

  move(dir) { if (dir === "left" || dir === "right") this.step(dir === "right" ? 1 : -1); }
  pressA() { this.telop?.tap(); }
  tick() {}
  relayout() {}
  destroy() { this.dead = true; this.gen += 1; this.telop?.stop(); }
}
