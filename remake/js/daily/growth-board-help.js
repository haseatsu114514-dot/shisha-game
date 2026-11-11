// 心得の盤の「？」（絵つきの見方。2026-11-11 オーナー「UIが文字が多くてごちゃついてる。基本アイコンとか絵でシンプルにして、
// その代わり？や、チュートリアルを充実させる」SBD116）。
// 盤・レベルアップの画面から外した説明（凡例・火種の使い道・効く場面・決まり）をここに集め、絵と短い一行で、ページをめくって読む。
// 絵は盤と同じ画像（remake/img/ui/growth_board/）。読めない時は形だけが出る。規則・保存には触れない。
import { el } from "../core/util.js";
import { modal } from "../core/ui.js";
import { SE } from "../core/audio.js";
import { BOARD_JA, BOARD_WHERE, HIDANE_NAME, PERK_TIERS, GATE_TIER, SQUARE_PERKS } from "../core/growth-board-data.js";
import { HIDANE_PER_LEVEL, KEY_GIFT, COLORED_GIFT, WIN_HIDANE, BOARD_TOTAL } from "../core/growth.js";

const ART = "img/ui/growth_board/";
const pic = (file, cls = "") => {
  const img = el(`img.gh-pic${cls}`, { src: `${ART}${file}`, alt: "", draggable: "false" });
  img.addEventListener("error", () => img.classList.add("missing"));
  return img;
};
/** 見本のマス（形と状態だけ。押せない） */
const sample = (kind, state = "", inner = null) => el(`span.gh-node.k-${kind}${state ? `.s-${state}` : ""}`, { "aria-hidden": "true" }, [inner,
  state === "lit" ? el("i.gh-mark", { text: "✓" }) : state === "pending" ? el("i.gh-mark", { text: "+" }) : null]);
const fire = (kind) => el(`span.gh-fire.k-${kind}`, { "aria-hidden": "true" }, [pic(`hidane_${kind}.webp`)]);
const row = (art, title, text) => el("li.gh-row", [el("span.gh-art", [].concat(art)), el("div.gh-text", [el("b", { text: title }), text ? el("span", { text }) : null])]);
const gain = (label, fires) => el("li.gh-gain", [el("span.gh-gain-label", { text: label }), el("span.gh-gain-fires", fires)]);
const n = (kind, count) => el("span.gh-count", [fire(kind), el("b", { text: `×${count}` })]);

/** 能力のアイコンの意味（盤の右の横棒・能力のマスの絵）。数字は盤の右に出るので、ここは何が伸びるかだけ */
export const PERK_HELP = Object.freeze({
  stamina: "最大体力が増える", sleep: "寝た時の体力の戻りが増える", charm: "好感度が上がりやすい", stage: "大会の審査員の第一印象が上がる",
  heat: "炭焼き・熱管理のジャスト帯が広がる", pull: "吸い出しのジャスト帯が広がる", dodge: "蒸らしの当たり判定が小さくなる", breath: "リフレッシュの範囲が広がる",
  gauge: "作りのゲージがゆっくりになる", leaf: "吸いすぎの葉のダメージが減る", tongue: "フレーバーの熟練度が伸びやすい", coal: "炭の熱が下がりにくい",
});

/** ページ（題・絵つきの行）。id は開く場所の指定に使う */
export const HELP_PAGES = Object.freeze([
  { id: "flow", title: "ながれ", build: () => el("ol.gh-flow", [
    el("li", [el("span.gh-step", { text: "1" }), el("div", [el("b", { text: "経験値をためる" }), el("span", { text: "人と会う・出かける・作る・大会" })])]),
    el("li", [el("span.gh-step", { text: "2" }), el("div", [el("b", { text: "レベルが上がると、火種をストック" }), el("span.gh-inline", [n("any", HIDANE_PER_LEVEL), el("span", { text: "その場で手持ちに入る" })])])]),
    el("li", [el("span.gh-step", { text: "3" }), el("div", [el("b", { text: "観音堂などで振り返る" }), el("span", { text: "ためた分をまとめて見て、盤に灯す（時間は進まない）" })])]),
    el("li", [el("span.gh-step", { text: "4" }), el("div", [el("b", { text: "灯したマスの分だけ、力が伸びる" }), el("span", { text: "メニューの盤は見るだけ（目標は付けられる）" })])]),
  ]) },
  { id: "fire", title: "火種", build: () => el("div", [
    el("ul.gh-list", [
      row(fire("any"), HIDANE_NAME.any, "どの盤のマス・スキルにも使える。色の台座には、はまらない"),
      row([fire("body"), fire("sense"), fire("wisdom")], `色の火（${HIDANE_NAME.body}・${HIDANE_NAME.sense}・${HIDANE_NAME.wisdom}）`, "ひし形の「色の台座」にはめる鍵。どの色でもはまる"),
    ]),
    el("p.gh-note", { text: "払う時は白火が先。色の火は、まだはめていない台座の数ぶんを取っておき、余った分をその色の盤のマスに使う。" }),
    el("h4.gh-sub", { text: "もらえる時" }),
    el("ul.gh-gains", [
      gain("レベルが1つ上がる", [n("any", HIDANE_PER_LEVEL)]),
      gain("節目（Lv.10ごと）", [n("body", KEY_GIFT.color), n("any", KEY_GIFT.any)]),
      gain("♥5になった人から", [n("sense", KEY_GIFT.color), n("any", KEY_GIFT.any)]),
      gain("大会に出る", [n("wisdom", COLORED_GIFT)]),
      gain("大会で優勝", [n("any", WIN_HIDANE)]),
      gain("遊びのご褒美・くじ", [n("body", 1)]),
    ]),
  ]) },
  { id: "kinds", title: "マスの種類", build: () => el("ul.gh-list", [
    row(sample("stat", "", pic("icons/perk_stamina.webp")), "能力のマス", "火種1。灯すたびに少し伸びる"),
    row(sample("stat", "notable", pic("icons/perk_charm.webp")), "要のマス", "金の輪。同じ火種1で、伸びが1.5倍"),
    row(sample("stat", "feature", pic("icons/perk_heat.webp")), "✦のマス", "灯すと、できることが1つ増える"),
    row(sample("skill", "", pic("frame_skill.webp")), "スキル", "六角。火種2〜7。新しい技や便利"),
    row(sample("lesson", "", pic("frame_lesson.webp")), "授業", "金の札。火種いらず。灯したら、その人に会って相談（LIMEでは習えない）"),
    row(sample("gate", "", pic("hidane_body.webp")), "色の台座", "ひし形。色の火1つ。はめると先の道が開き、台座の力も入る"),
    row(sample("peak", "", pic("frame_peak.webp")), "極み", "その盤の能力のマスを全部灯すと灯せる"),
  ]) },
  { id: "perks", title: "能力", build: () => el("div.gh-perks", Object.keys(BOARD_JA).map((k) => el(`section.gh-perk-col.b-${k}`, [
    el("h4", { text: `${BOARD_JA[k]}盤` }),
    el("ul", Object.entries(SQUARE_PERKS[k].perks).map(([key, p]) => el("li", { dataset: { perk: key } }, [
      el("span.gh-perk-icon", { "aria-hidden": "true" }, [pic(`icons/perk_${key}.webp`)]),
      el("div.gh-text", [el("b", { text: p.name }), el("span", { text: PERK_HELP[key] || "" })]),
    ]))),
  ]))) },
  { id: "states", title: "マスの状態", build: () => el("ul.gh-list", [
    row(sample("stat", "lit"), "灯した", "盤の色に光る"),
    row(sample("stat", "pending"), "仮置き", "「決定」を押すまでは戻せる"),
    row(sample("stat", "ready"), "今灯せる", "明滅して、上に小さな火"),
    row(sample("stat", "far"), "道がまだ", "線でつながった隣を先に灯す。どの道から進んでもいい"),
    row(el("span.gh-seal", { "aria-hidden": "true" }, [pic("wall_seal.webp")]), "結界の先", "物語が進むと解ける"),
    row(sample("lesson", "sealed", pic("silhouette_unknown.webp")), "授業の錠・影絵", "まだ会っていない／♥が足りない"),
  ]) },
  { id: "how", title: "操作", build: () => el("ul.gh-list.gh-plain", [
    row(el("span.gh-key", { text: "1" }), "マスを押す", "右に、灯すと何が変わるかが出る"),
    row(el("span.gh-key", { text: "2" }), "「灯す」→「決定」", "仮置きを重ねて、最後にまとめて決める"),
    row(el("span.gh-key", { text: "◎" }), "目標にする", "欲しいマスに印。「目標まで灯す」で道をまとめて"),
    row(el("span.gh-key", { text: "→" }), "近い目的地", "何も選んでいない時、右に近いスキルや授業が3つ"),
    row(el("span.gh-key", { text: "＋" }), "拡大・移動", "− 全体 ＋ と、ドラッグ・スクロール"),
  ]) },
  { id: "rules", title: "決まり", build: () => el("ul.gh-list.gh-plain", [
    row(el("span.gh-key", { text: "帯" }), "遠いマスほど大きい", `近く・中ほど ×${PERK_TIERS[2].mult}、台座の先 ×${PERK_TIERS[3].mult}、色の台座 ×${GATE_TIER.mult}`),
    ...Object.keys(BOARD_JA).map((k) => row(el(`span.gh-key.b-${k}`, { text: BOARD_JA[k].slice(0, 1) }), `${BOARD_JA[k]}盤`, BOARD_WHERE[k])),
    row(el("span.gh-key", { text: "直" }), "組み直し", "章・周回のはじめ、最初の行動まで（メニューからも）。授業は忘れない"),
    row(el("span.gh-key", { text: "数" }), `火種は全部で${BOARD_TOTAL}`, "盤の全部のぶん。受け取り終えた後は白火が台座にもはまる"),
  ]) },
]);

/** 見方を開く。page は開くページの id（省略で最初）。閉じるまで待つ */
export async function openBoardHelp({ page = "flow" } = {}) {
  let index = Math.max(0, HELP_PAGES.findIndex((p) => p.id === page));
  const title = el("h3.gh-title"), body = el("div.gh-page"), dots = el("div.gh-dots", { role: "tablist" });
  const prev = el("button.btn.small.gh-prev", { type: "button", text: "前へ", dataset: { test: "board-help-prev" } });
  const next = el("button.btn.small.primary.gh-next", { type: "button", text: "次へ", dataset: { test: "board-help-next" } });
  const draw = () => {
    const p = HELP_PAGES[index];
    title.textContent = `${index + 1}/${HELP_PAGES.length}　${p.title}`;
    body.replaceChildren(p.build());
    body.dataset.page = p.id;
    dots.replaceChildren(...HELP_PAGES.map((x, i) => el(`button.gh-dot${i === index ? ".on" : ""}`, { type: "button", role: "tab", title: x.title, "aria-label": x.title,
      "aria-selected": String(i === index), dataset: { test: `board-help-tab-${x.id}` }, onclick: () => go(i) }, [el("span", { text: x.title })])));
    prev.disabled = index === 0; next.disabled = index === HELP_PAGES.length - 1;
  };
  const go = (i) => { index = Math.max(0, Math.min(HELP_PAGES.length - 1, i)); SE.click?.(); draw(); };
  prev.addEventListener("click", () => go(index - 1));
  next.addEventListener("click", () => go(index + 1));
  draw();
  await modal({
    title: "心得の盤の見方", className: "gboard-help",
    body: el("div.gh", { dataset: { test: "board-help-pages" } }, [dots, el("div.gh-head", [title, el("div.gh-nav", [prev, next])]), body]),
    options: [{ label: "閉じる", value: true, primary: true, test: "board-help-close" }],
  });
}
