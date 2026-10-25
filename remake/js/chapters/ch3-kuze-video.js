// 第三章の匿名視点。動画サイトの文言は公開された大会情報だけを扱う。
import { bgUrl, portraitInfo } from "../core/data.js";
import { el } from "../core/util.js";
import { showScreen } from "../core/ui.js";

const videos = [
  { id: "steve", label: "スティーブ", title: "二口目まで軽い、低温の一台", note: "低温を保つ。タイマーを置く理由まで映っている。" },
  { id: "volk", label: "ヴォルク", title: "誤差を追う熱管理", note: "数字と手順が正確。先に何を測るかも分かる。" },
  { id: "hajime", label: "蒸野はじめ", title: "勤務歴の浅い新人が県大会優勝", note: "地元の名店 tonari のアルバイト。派手な型は見えない。" },
];

const test = name => `ch3-video-${name}`;
const action = (name, label, fn, primary = false) => el(`button.btn${primary ? ".primary" : ""}`, {
  type: "button", text: label, dataset: { test: test(name) }, onclick: fn,
});

export function showKuzeVideoSite({ onDone, onMenu }) {
  let selected = "steve";
  let phase = 0;
  const render = () => {
    const video = videos.find(item => item.id === selected);
    const focused = selected === "hajime";
    const portrait = portraitInfo(selected, "normal")?.src;
    const commentary = !focused ? video.note : phase === 0
      ? "名店の新人。勤めてまだ数か月。優勝の映像を開く。"
      : phase === 1
        ? "……何だ、こいつ。派手なところはないのに、最後だけ目が離せない。"
        : "……あの瞬間。一つ、試したいことができた。僕は勝たないといけないんだ。大会まで、もう少し。準備しよう。";
    const site = el("main.ch3-video-site", { dataset: { test: test("site"), selected, phase: String(phase) } }, [
      el("header.ch3-video-header", [
        el("div.ch3-video-brand", [el("span", { text: "▶" }), el("strong", { text: "SMOKE CHANNEL" })]),
        el("span.ch3-video-search", { text: "全国大会　出場者" }),
        action("menu", "MENU", onMenu),
      ]),
      el("div.ch3-video-grid", [
        el("section.ch3-video-main", [
          el("div.ch3-video-player", { style: { backgroundImage: `linear-gradient(#14131c38, #0a0917a6), url('${bgUrl("bg_tournament_stage")}')` } }, [
            portrait ? el("img.ch3-video-person", { src: portrait, alt: "" }) : null,
            el("span.ch3-video-caption", { text: focused && phase > 0 ? "HAZE: OPEN CLOUD　県大会・最終調整" : "HAZE: NATIONAL TOKYO　出場者" }),
            el("div.ch3-video-player-controls", [
              el("span", { text: focused && phase > 0 ? "❚❚" : "▶" }),
              el("span.ch3-video-track", [el("i", { style: { width: focused && phase > 0 ? "76%" : "18%" } })]),
              el("span", { text: focused && phase > 0 ? "02:14 / 03:08" : "00:18 / 03:08" }),
            ]),
          ]),
          el("h1", { text: video.title }),
          el("p.ch3-video-meta", { text: focused ? "県大会公式ハイライト · 地元の名店 tonari · 勤めてまだ数か月" : "全国大会・出場者紹介" }),
          el("div.ch3-video-thought", { "aria-live": "polite" }, [
            el("b", { text: "？？？" }), el("p", { text: commentary }),
          ]),
          el("div.ch3-video-comments", [
            el("b", { text: "コメント" }),
            el("p", { text: focused ? "派手な技、あった？　でも最後の調整はもう一度見たい。" : "作り方を見比べるのが面白い。" }),
          ]),
          el("div.ch3-video-actions", [
            focused && phase === 0 ? action("play", "優勝映像を再生", () => { phase = 1; render(); }, true) : null,
            focused && phase === 1 ? action("rewind", "10秒戻して見る", () => { phase = 2; render(); }, true) : null,
            focused && phase === 2 ? action("continue", "準備を始める", onDone, true) : null,
          ]),
        ]),
        el("aside.ch3-video-recommendations", [
          el("p", { text: "次の動画" }),
          ...videos.map(item => action(`select-${item.id}`, item.title, () => {
            selected = item.id;
            phase = 0;
            render();
          })).map((button, index) => {
            button.classList.add("ch3-video-recommendation");
            button.classList.toggle("selected", videos[index].id === selected);
            button.prepend(el("span.ch3-video-recommendation-thumb", { text: videos[index].id === "hajime" ? "県大会" : "全国" }));
            return button;
          }),
          el("p.ch3-video-recommendation-hint", { text: "公開映像と出場者紹介を流し見している。" }),
        ]),
      ]),
    ]);
    showScreen("ch3-video", site);
  };
  render();
}
