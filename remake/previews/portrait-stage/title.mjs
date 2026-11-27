// 縦画面C案「煙の舞台」: タイトル画面を縦へ移した試作（要望台帳 VPM01）。
// 本編（remake/js/scenes/title.js）の部品をそのまま使う: 背景 bg_title、人物のキービジュアル（1キャラ1枚・縦長の絵）、ロゴ、
// メニュー（NEW GAME・CONTINUE・LOAD・GALLERY・CONFIG）、版の表示。
// 縦の並べ方: キービジュアルを画面いっぱいに、その裾にロゴ／下に5行のメニュー（押すとそのまま選べる）。
// 十字キーと丸ボタンは置かない（2026-11-27 オーナー「縦レイアウトは必ず十字ボタンや決定ボタンはいらない」・VPM07）。PC は矢印キーと Enter でも選べる。
// 保存は読まない（本編の進行・保存には触れない）。「セーブあり」の見え方は、この試作の地図と同じ第1章 DAY 5 を仮に出す。

// 人物ごとのキービジュアル（remake/js/core/title-art-unlock.js の TITLE_KEY_VISUALS の写し）。
// face＝絵の高さに対する顔の位置（縦に切り抜く時、顔が絵の上のほうに来るように合わせる）
const KEY_VISUALS = {
  tsumugi: { file: "title_art_tsumugi_04_painting_studio", face: 0.27 },
  minto: { file: "title_art_minto_05_mint_cloud", face: 0.24 },
  sumi: { file: "title_art_sumi_01_own_clay_bowl", face: 0.2 },
  naru: { file: "title_art_naru_01_bakery_morning", face: 0.17 },
  adam: { file: "title_art_adam_01_sunset_proclamation", face: 0.17 },
  hiyori: { file: "title_art_hiyori_06_riverside_hoodie", face: 0.19 },
  samechan: { file: "title_art_samechan_04_throne_pose", face: 0.2 },
  rio: { file: "title_art_rio_04_rainy_neon_umbrella", face: 0.2 },
  ageha: { file: "title_art_ageha_04_gummy_light", face: 0.22 },
  mashiro: { file: "title_art_mashiro_05_rooftop_dusk_yawn", face: 0.22 },
};
// セーブがある時は「出会った人物」の絵だけ（本編と同じ絞り方）。この試作の第1章 DAY 5 で出会っている5人
const MET = ["tsumugi", "minto", "sumi", "naru", "adam"];
export const TITLE_ARTS = Object.keys(KEY_VISUALS);
const ART_ASPECT = 1536 / 1024; // キービジュアルは縦長（2:3）

let lastArt = null; // 続けて同じ人物を出さない（本編の pickTitleArt と同じ）

export class TitleScene {
  /** 場面の名札（app.mjs が読む）: 名前・光の色・一覧（PC）に並べる場面。 */
  static META = {
    id: "title", label: "タイトル", acc: "#f1d79a",
    gallery: {
      title: "タイトル画面",
      note: "本編のタイトル（背景・人物のキービジュアル・ロゴ・メニュー）を縦へ。キービジュアルは縦長の絵なので、画面いっぱいに置き、裾にロゴを重ねる。人物の絵は開くたびに替わる（セーブがあれば出会った人物だけ）。",
      shots: [
        { caption: "セーブあり（CONTINUE から）", art: "tsumugi" },
        { caption: "セーブなし（NEW GAME から）", save: "0", art: "mashiro" },
        { caption: "人物の絵が替わる（スミさん）", art: "sumi" },
      ],
    },
  };

  /**
   * @param opts save＝セーブがある時の見え方（CONTINUE・LOAD が押せる）、art＝出す人物（省くと、出会った人物から順に替わる）
   */
  constructor(phone, kit, { save = true, art = null } = {}) {
    save = save !== "0" && save !== false; // 1台表示では ?save=0 で「セーブなし」
    Object.assign(this, { phone, kit, el: phone.el, save });
    const pool = save ? MET : TITLE_ARTS;
    const fresh = pool.filter((id) => id !== lastArt);
    this.artId = KEY_VISUALS[art] ? art : phone.fixed ? pool[0] : fresh[Math.floor(Math.random() * fresh.length)];
    lastArt = this.artId;
    // 本編と同じ5行（remake/js/scenes/title.js）。セーブが無ければ CONTINUE・LOAD は押せない
    this.items = [
      { id: "new", en: "NEW GAME", ja: "はじめから" },
      { id: "continue", en: "CONTINUE", ja: "つづきから", note: save ? "第1章　DAY 5" : "", disabled: !save },
      { id: "load", en: "LOAD", ja: "ロード", disabled: !save },
      { id: "gallery", en: "GALLERY", ja: "ギャラリー" },
      { id: "config", en: "CONFIG", ja: "設定" },
    ];
    // 決定を押すだけで本編へ入れるよう、いちばん使う行に置く（セーブがあれば CONTINUE）
    this.pick = save ? 1 : 0;
  }

  html() {
    const { REMAKE_IMG } = this.kit, art = KEY_VISUALS[this.artId];
    return `
      <img class="amb" src="${REMAKE_IMG}backgrounds/bg_title.webp" alt="">
      <div class="pic tt-pic"><img class="bg" src="${REMAKE_IMG}backgrounds/bg_title.webp" alt="">
        <img class="tt-art" src="${REMAKE_IMG}ui/title_arts/${art.file}.webp" alt="" data-character="${this.artId}"><i class="tt-ember"></i></div>
      <i class="veil tt-veil"></i><img class="smoke" src="${REMAKE_IMG}ui/making/smoke_thick.webp" alt="">
      <div class="tt-ver">ver. dev</div>
      <div class="body tt-body">
        <div class="tt-brand"><div class="tt-logo-smoke" aria-hidden="true"><i></i><i></i><i></i></div>
          <img class="tt-logo" src="${REMAKE_IMG}ui/ui_title_logo_rich.webp" alt="水煙前線 -EN:CODE-"></div>
        <nav class="tt-menu" aria-label="メニュー">${this.menuHtml()}</nav>
      </div>
      <i class="tt-wipe"></i>`;
  }

  menuHtml() {
    return this.items.map((item, i) => `<button class="tt-item" data-act="tt-pick" data-i="${i}" aria-current="${i === this.pick}"${item.disabled ? " disabled" : ""} style="--i:${i}">
      <i></i><span class="tt-en">${item.en}</span><span class="tt-side"><span class="tt-ja">${item.ja}</span>${item.note ? `<span class="tt-note">${item.note}</span>` : ""}</span></button>`).join("");
  }

  mount() {
    if (!this.phone.fixed) this.el.classList.add("tt-enter"); // 入ってきた時だけ、絵・ロゴ・メニューを順に出す
    this.relayout();
  }

  /** キービジュアルを縦に切り抜く位置: 顔が、絵の場所の上から3割あたりに来るようにする（人物ごとに顔の高さが違う）。 */
  relayout() {
    const pic = this.el.querySelector(".tt-pic"), img = this.el.querySelector(".tt-art");
    if (!pic?.clientWidth) return;
    const boxH = pic.clientHeight, imgH = pic.clientWidth * ART_ASPECT, spare = imgH - boxH;
    const y = spare <= 0 ? 0 : Math.max(0, Math.min(1, (KEY_VISUALS[this.artId].face * imgH - boxH * 0.3) / spare));
    img.style.objectPosition = `50% ${(y * 100).toFixed(1)}%`;
  }

  move(dir) {
    if (this.leaving || (dir !== "up" && dir !== "down")) return;
    const open = this.items.map((item, i) => (item.disabled ? -1 : i)).filter((i) => i >= 0);
    this.pick = open[(open.indexOf(this.pick) + (dir === "down" ? 1 : open.length - 1)) % open.length];
    this.el.querySelectorAll(".tt-item").forEach((node, i) => node.setAttribute("aria-current", String(i === this.pick)));
  }

  pressA() {
    if (this.leaving) return;
    const item = this.items[this.pick], node = this.el.querySelectorAll(".tt-item")[this.pick];
    if (!item || item.disabled) return;
    node?.classList.remove("is-picked"); void node?.offsetWidth; node?.classList.add("is-picked"); // 押した行は一瞬光らせる
    if (item.id !== "new" && item.id !== "continue") { this.phone.toast("この試作では開きません"); return; }
    if (this.phone.fixed) return;
    // 煙の幕で覆って、本編（この試作では第1章の地図）へ
    this.leaving = true;
    this.el.classList.add("tt-leaving");
    setTimeout(() => { if (!this.dead) this.phone.setScene("map"); }, 720);
  }

  onClick(event) {
    const hit = event.target.closest("[data-act]");
    if (!hit || !this.el.contains(hit) || this.leaving) return false;
    if (hit.dataset.act === "tt-pick") {
      this.pick = Number(hit.dataset.i);
      this.el.querySelectorAll(".tt-item").forEach((node, i) => node.setAttribute("aria-current", String(i === this.pick)));
      this.pressA();
      return true;
    }
    return false;
  }

  tick() {}
  destroy() { this.dead = true; this.el.classList.remove("tt-enter", "tt-leaving"); }
}
