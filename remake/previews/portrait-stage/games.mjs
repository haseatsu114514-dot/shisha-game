// 縦画面C案「煙の舞台」: ミニゲームを縦へ移した試作（2026-11-27 オーナー「ミニゲーム群を縦画面の新レイアウトに対応させて」）。
// 砂丘（DESERT RIDE）などのミニゲームは Canvas と専用の画面を持つので、写さずに本編をそのまま動かす:
//   縦用のページ frame/<ゲーム>.html が本編のゲームを呼び、並べ方だけ frame/<ゲーム>.css で縦にする。この枠はそのページを入れるだけ（iframe）。
//   枠を分けるのは、本編の土台の CSS（css/base.css）と音・キー入力を、この試作の画面と混ぜないため。
// 十字キーと丸ボタンは置かない（VPM07）。ゲームごとの押す所は、ゲームの画面の中にある。
// 本編の進行・保存には触れない（記録はページを開いている間だけ）。斧投げ・シーシャ作り・店番は別の場面（axe.mjs・app.mjs・floor.mjs）。

/** 縦用のページを入れるだけの場面を作る。shots＝一覧（PC）に並べる止め絵（frame/<page>.html?shot=…）。
 *  src＝縦用のページが frame/ の外にある時の場所（DJ は本体のページ自身が縦の並べ方を持つ）。 */
function frameScene({ id, label, acc, page, src = `frame/${page}.html`, title, note, shots }) {
  return class FrameScene {
    /** 場面の名札（app.mjs が読む）: 名前・光の色・一覧（PC）に並べる場面。 */
    static META = { id, label, acc, gallery: { title, note, shots } };

    /** @param opts shot＝途中の場面から開く（一覧に並べる時・確かめる時）。1台表示では ?shot= でも渡せる */
    constructor(phone, kit, { shot = null } = {}) {
      Object.assign(this, { phone, kit, el: phone.el, shot: shot || (phone.fixed ? shots[0].shot : null) });
      this.life = new AbortController();
    }

    html() {
      const query = this.shot ? `${src.includes("?") ? "&" : "?"}shot=${encodeURIComponent(this.shot)}` : "";
      // 一覧の止め絵は、見える所まで来てから読む（ゲームを何本も同時に起こさない）。触れない
      const still = this.phone.fixed ? ' loading="lazy" tabindex="-1" inert' : "";
      return `<iframe class="gm-frame" title="${this.kit.esc(label)}" src="${src}${query}" allow="autoplay"${still}></iframe>`;
    }

    mount() {
      const frame = this.el.querySelector(".gm-frame"), opt = { signal: this.life.signal };
      // ゲームから出た時（本編では街へ戻る所）は、枠が一言だけ出す。ゲームのページは入口へ戻る
      addEventListener("message", (event) => {
        if (event.source !== frame.contentWindow || event.origin !== location.origin) return;
        // 縦用のページ（frame/）は source: "portrait-frame" の leave、DJ は本体の通知 dj-exit（← 戻る）
        if ((event.data?.source === "portrait-frame" && event.data.type === "leave") || event.data?.type === "dj-exit") this.phone.toast("試作ではここまで（本編は街へ戻る）");
      }, opt);
      // PC: 開いたらそのままキーで遊べるよう、ゲームの側へ焦点を渡す
      if (!this.phone.fixed) frame.addEventListener("load", () => frame.contentWindow?.focus(), opt);
    }

    relayout() {}
    move() {}
    pressA() {}
    onClick() { return false; }
    tick() {}
    destroy() { this.dead = true; this.life.abort(); }
  };
}

export const DesertScene = frameScene({
  id: "desert", label: "砂丘", acc: "#ffb347", page: "desert",
  title: "砂丘（DESERT RIDE）",
  note: "本編のサンドボードを縦へ。規則・採点・絵・手応えは本編のまま、並べ方だけ縦にした。上＝滑走の絵（空の所に道のり・時計・得点）、下＝操作の板（ブーストのゲージ、左の親指で左右、右の親指でブーストとジャンプ）。SCORE・TIME・km/h の添え字やコースの名前は出さず、結果の記録は6つに絞った。",
  shots: [
    { caption: "入口（段を選んで滑る）", shot: "menu" },
    { caption: "遊び方（絵札6枚）", shot: "help" },
    { caption: "滑走（左右・ブースト・ジャンプ）", shot: "run" },
    { caption: "大ジャンプ（輪が重なったら着地）", shot: "air" },
    { caption: "結果", shot: "result" },
  ],
});

export const CamelScene = frameScene({
  id: "camel", label: "ラクダ", acc: "#ffd77a", page: "camel",
  title: "ラクダレース",
  note: "本編のラクダレースを縦へ。規則・採点・絵・手応えは本編のまま、並べ方だけ縦にした。横に長いコースは自分のラクダのまわりだけを見せ（競り合いの寄りもこの中に収まる）、上＝コース（空の所に進み具合・一時停止・やめる・ファーリスの声）、下＝操作の板（順位は2列×2段、時計と速さ、左の親指で声・右の親指でムチの大きなボタン）。題名や「km/h」「調子」「押している間」の添え字は出さず、ボタンは丸い印とゲージで見せる。遊び方・大会選び・結果の札は幅いっぱいの1列。",
  shots: [
    { caption: "遊び方（絵と一言）", shot: "tutorial" },
    { caption: "大会を選ぶ", shot: "cups" },
    { caption: "レース（声とムチ）", shot: "race" },
    { caption: "結果", shot: "result" },
  ],
});

export const DjScene = frameScene({
  id: "dj", label: "DJ", acc: "#c08cff", src: "../dj/index.html?set=1&embed=1&layout=portrait",
  title: "DJ",
  note: "本編のDJを縦へ。音・判定・採点は本編のまま（本体のページ remake/previews/dj/ が ?layout=portrait の時だけ縦になる）。ブースは横と同じ機材の配置のまま置き、左右の皿を両方写すと小さくなるので、次に触る側へ寄って拡大する: かける時は左の皿、入れる時は次の曲の皿（カウント待ちの間に先に寄る）、ズレたらその皿、つなぐ・選ぶ時は真ん中（案内とミキサー）。上＝フロア、その下に いまやること の1行（皿へ寄っている間も読めるよう、本編の案内を写す）。",
  shots: [
    { caption: "かける（左の皿へ寄る）", shot: "a" },
    { caption: "入れる（右の皿へ寄る）", shot: "b" },
    { caption: "つなぐ（真ん中のミキサーへ寄る）", shot: "mix" },
  ],
});

export const TetsukoScene = frameScene({
  id: "tetsuko", label: "てつこ", acc: "#f0a04a", page: "tetsuko",
  title: "てつこといっしょ",
  note: "本編の「てつこといっしょ」を縦へ。遊びの流れ・しぐさ・台詞・なかよし度は本編のまま、並べ方だけ縦にした。上＝てつこの絵（横長の舞台の左右を切り、てつこが端の居場所に居る時は舞台ごと寄せて真ん中に映す）、上の帯にハートと「？」「帰る」、下＝反応の一言・撮影／もようがえ／手帳・手元の道具（なでる・じゃらし・ブラシ・おやつ）。もようがえは舞台を引いて置き場所を全部見せ、手帳は縦の2枚の紙。題の札の英字・おしまいの知らせ・札の添え字・認定条件の一行などの説明は出さない。",
  shots: [
    { caption: "訪ねた所（なでる手の手本）", shot: "visit" },
    { caption: "じゃらしで遊ぶ", shot: "toy" },
    { caption: "もようがえ（舞台を引いて置き場所を見せる）", shot: "decor" },
    { caption: "てつこ手帳", shot: "book" },
    { caption: "今日の終わり", shot: "end" },
  ],
});

export const TrpgScene = frameScene({
  id: "trpg", label: "ボドゲ", acc: "#7fd9c4", page: "trpg",
  title: "ボドゲカフェ（TRPG）",
  note: "本編のTRPGを縦へ。物語・判定・台詞は本編のまま（本編のファイルは触っていない）、並べ方だけ縦にした。物語選びは本編の本をめくる本棚（TRP11）を、縦では上下に開く本（上の紙＝場面の絵と題、下の紙＝ひとこと・今夜の顔と時間・遊ぶ）に組む（本の絵は同じ画風で生成）。しおりの見出し・矢印・横払いでめくる。卓は上＝部屋の絵、席4人、いちばん下に台詞と「次へ」。字の多い所は、意味が通じる範囲で形にした: 段の進みは名前＋7つの点、技能は印＋名前＋数、判定の式は出さない。調べる時は絵に番号の印と同じ番号の札。",
  shots: [
    { caption: "本をめくって物語を選ぶ", shot: "library" },
    { caption: "しおりで別の本へ", shot: "turned" },
    { caption: "表紙", shot: "cover" },
    { caption: "卓の会話", shot: "talk" },
    { caption: "行動を宣言する", shot: "choice" },
    { caption: "判定（サイコロ）", shot: "roll" },
    { caption: "部屋を調べる（番号の印と札）", shot: "explore" },
  ],
});
