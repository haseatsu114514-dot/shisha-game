// 縦画面C案「煙の舞台」: ロード画面（漫画付き）を縦へ移した試作（要望台帳 LDC43）。
// 本編（remake/js/core/loading.js・css/loading.css）の部品をそのまま使う: 背景 loading_bg、ロゴ、2コマ漫画の紙面（題・2コマ・一行解説）、
// 進み具合のバー、LOADING の印（小さなシーシャ。炭の明かりが HMD の上で明滅し、機材から煙は出さない）、進む合図。
// 漫画は本編の登録（remake/js/core/loading-comics.js）をそのまま読む（写していない）。
// 縦の並べ方: 上にロゴ／真ん中に紙面（2コマは上下に積んで、幅いっぱいに大きく。左→右を上→下に読み替える）／
// 下（親指の届く所）に、バー・LOADING・大きな「進む」の札。十字キーと丸ボタンは置かない（VPM07）。
// 準備（この試作では一定の時間）が終わるまでは進めない（本編と同じく、準備は飛ばせない）。準備完了の後は、札か画面のどこを押しても進む。
// 進んだ先は、本編で漫画付きのロードが出る「作業台に入る時」に合わせて、作る場面（水入れ）。保存・進行には触れない。
import { LOADING_COMICS } from "../../js/core/loading-comics.js";

const PREP_MS = 2600; // 準備にかかる時間（この試作の見せかけ。本編は実際の読み込みの進み）
const READ_GUARD_MS = 650; // 準備完了の直後は押しても進まない（本編の READ_GUARD と同じ考え。読み始めた漫画を誤って飛ばさない）
const CHOICES = { "ageha-model-job": "モデルの仕事", "sumi-cold-tea": "冷めた紅茶", "ageha-full-coord": "全身コーデ", random: "ランダム" };

// LOADING の印（remake/js/core/loading.js と同じ形）。台 → 軸（ホースの口）→ 受け皿 → 細い脚のボウル → 蓋つきの HMD。ホースは1本
const EMBLEM = `<svg class="lo-emblem" viewBox="0 0 36 52" aria-hidden="true">
  <path class="lo-emblem-glow" d="M16 6.4c3.9 0 7 1.5 7 3.3S19.9 13 16 13s-7-1.5-7-3.3 3.1-3.3 7-3.3z"/>
  <path class="lo-emblem-body" d="M15 6h2v1.5h-2z M11 7.5h10l.5 1.2V12h-11V8.7z M10.8 12.4h10.4c0 2.7-1.7 4.6-3.4 5.4h-3.6c-1.7-.8-3.4-2.7-3.4-5.4z M15.2 17.8h1.6v2.8h-1.6z M4 20.6h24c-.6 1.4-3.6 2.1-12 2.1s-11.4-.7-12-2.1z M15.15 22.7h1.7V47h-1.7z M16.85 31h2.7v1.4h-2.7z M14.2 37H17.8V38.8C21.6 40 23.8 42.4 23.8 45.6C23.8 48 22.6 50 21.4 51H10.6C9.4 50 8.2 48 8.2 45.6C8.2 42.4 10.4 40 14.2 38.8Z M15.3 39.6C11.6 40.8 9.4 42.9 9.4 45.6C9.4 47.6 10.3 49.1 11.1 49.8H20.9C21.7 49.1 22.6 47.6 22.6 45.6C22.6 42.9 20.4 40.8 16.7 39.6Z M9.7 45.4H22.3C22.2 47.4 21.5 48.9 20.9 49.8H11.1C10.5 48.9 9.8 47.4 9.7 45.4Z M28.6 40.57l1.8.86 2.8-5.79-1.8-.87z M31.8 34.96l1 .48.8-1.7-1-.48z"/>
  <path class="lo-emblem-hose" d="M19.5 31.7C24.5 32 26 42.6 29.5 41"/></svg>`;

export class LoadingScene {
  /** 場面の名札（app.mjs が読む）: 名前・光の色・一覧（PC）に並べる場面・つまみ（どの漫画を出すか）。 */
  static META = {
    id: "loading", label: "ロード", acc: "#ff9bd2",
    gallery: {
      title: "ロード画面（漫画付き）",
      note: "本編のロード画面（ロゴ・2コマ漫画の紙面・進み具合・LOADING の印・進む合図）を縦へ。2コマは上下に積んで幅いっぱいに大きく出し（左→右を上→下に読み替え）、下の親指の届く所に大きな「進む」の札を置く（十字キー・丸ボタンは置かない）。準備が終わるまでは進めない。漫画は本編の登録をそのまま読む。",
      shots: [
        { caption: "読み込み中（モデルの仕事）", comic: "ageha-model-job", state: "loading" },
        { caption: "準備完了（タップで進む）", comic: "ageha-model-job", state: "ready" },
        { caption: "ほかの話（冷めた紅茶）", comic: "sumi-cold-tea", state: "ready" },
      ],
    },
    options: [{ name: "comic", label: "ロードの漫画", default: "ageha-model-job", values: CHOICES }],
  };

  /**
   * @param opts comic＝出す話の id（random で登録からくじ）、state＝一覧の見本で止める状態（loading／ready）、next＝進んだ先の場面
   */
  constructor(phone, kit, { comic = "ageha-model-job", state = null, next = "water" } = {}) {
    Object.assign(this, { phone, kit, el: phone.el, next });
    const usable = LOADING_COMICS.filter((c) => c.panels?.length === 2);
    this.comic = comic === "random" || !usable.some((c) => c.id === comic)
      ? usable[Math.floor(Math.random() * usable.length)]
      : usable.find((c) => c.id === comic);
    // 一覧の見本は、指定の状態で止める（読み込み中は進み6割）
    this.ready = phone.fixed ? state !== "loading" : false;
    this.progress = phone.fixed ? (this.ready ? 1 : 0.62) : 0.12;
    this.t0 = 0; this.readyAt = 0;
  }

  html() {
    const { REMAKE_IMG, esc } = this.kit, c = this.comic;
    const panels = c.panels.map((p, i) => `<figure class="lo-panel" style="--i:${i}"><img src="${p.src}" alt="${esc(p.alt)}"></figure>`).join(`<i class="lo-next" aria-hidden="true"></i>`);
    return `
      <img class="lo-bg" src="${REMAKE_IMG}ui/loading/loading_bg.webp" alt="">
      <i class="lo-veil" aria-hidden="true"></i><i class="lo-haze" aria-hidden="true"><i></i><i></i><i></i></i>
      <div class="lo-stack">
        <div class="lo-brand"><img class="lo-logo" src="${REMAKE_IMG}ui/ui_title_logo_rich.webp" alt="水煙前線 -EN:CODE-"></div>
        <section class="lo-sheet" aria-label="${esc(c.title)}">
          <h2 class="lo-title">${esc(c.title)}</h2>
          <div class="lo-panels">${panels}</div>
          <p class="lo-caption">${esc(c.caption || "")}</p>
        </section>
        <div class="lo-dock">
          <div class="lo-bar" aria-hidden="true"><i></i></div>
          <p class="lo-status" role="status">${EMBLEM}<span class="lo-status-text"></span></p>
          <button class="lo-go" data-act="lo-go"><span></span></button>
        </div>
      </div>
      <i class="lo-wipe" aria-hidden="true"></i>`;
  }

  mount() {
    if (!this.phone.fixed) { this.el.classList.add("lo-enter"); this.t0 = performance.now(); }
    this.sync();
  }

  /** バー・LOADING・札を今の状態に合わせる。 */
  sync() {
    const el = this.el;
    el.querySelector(".lo-bar")?.style.setProperty("--p", this.progress.toFixed(3));
    el.classList.toggle("lo-ready", this.ready);
    const status = el.querySelector(".lo-status-text"), go = el.querySelector(".lo-go");
    if (status) status.textContent = this.ready ? "準備完了" : "LOADING…";
    if (go) {
      go.disabled = !this.ready;
      go.querySelector("span").textContent = this.ready ? "タップで進む" : "準備しています…";
      go.setAttribute("aria-label", this.ready ? "進む" : "準備しています");
    }
  }

  tick(now) {
    if (this.ready || this.phone.fixed || !this.t0 || this.dead) return;
    const t = Math.min(1, (now - this.t0) / PREP_MS);
    const p = 0.12 + 0.88 * (1 - (1 - t) ** 2); // はじめは速く、終わりに向けてゆっくり満ちる
    if (Math.abs(p - this.progress) > 0.004) { this.progress = p; this.el.querySelector(".lo-bar")?.style.setProperty("--p", p.toFixed(3)); }
    if (t >= 1) { this.ready = true; this.readyAt = now; this.sync(); }
  }

  go() {
    if (!this.ready || this.leaving || this.dead) return;
    if (!this.phone.fixed && performance.now() - this.readyAt < READ_GUARD_MS) return;
    if (this.phone.fixed) { this.phone.toast("一覧の見本では進みません"); return; }
    // 煙の幕で覆ってから、作業台（作る場面）へ
    this.leaving = true;
    this.el.classList.add("lo-leaving");
    setTimeout(() => { if (!this.dead) this.phone.setScene(this.next); }, 680);
  }

  move() {}
  pressA() { this.go(); }

  onClick(event) {
    if (!this.el.contains(event.target)) return false;
    this.go(); // 準備完了の後は、札でも画面のどこでも進む。準備中は何も起きない（飛ばせない）
    return true;
  }

  relayout() {}
  destroy() { this.dead = true; this.el.classList.remove("lo-enter", "lo-ready", "lo-leaving"); }
}
