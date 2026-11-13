// 効果音の試聴ページ（audio-preview.html）。新しく入れた録音と、前の合成音を聴き比べる。
// 音はゲーム本編と同じ core/audio.js をそのまま鳴らす。出典は asset_sources/music/main-se-20261111/。
import { SE, SYNTH_SE, unlockAudio, preloadSe, applyVolumes } from "./core/audio.js";
import { config } from "./core/state.js";

// now: 今ゲームで鳴る音。before: 前に鳴っていた音（null は「前は無音」）。
export const AUDIO_PREVIEW_ROWS = [
  { name: "拍手", where: "大会の結果発表・ゲーム冒頭の会場・ガラガラくじの大当たり・会話の中の歓声", src: "eXpl0it3r「Applause in a large hall or church」",
    now: () => SE.crowd(2), before: () => SYNTH_SE.crowd(2) },
  { name: "コイン", where: "所持金が動いた時（バイト代・手当・買い物・売却・運賃など）", src: "Spring Spring「Purchasing Sound Effect」／syncopika「coin sounds」（押すたびに交互）",
    now: () => SE.money(), before: () => SYNTH_SE.money(), beforeLabel: "前の音（店の売り買いだけで鳴っていた）" },
  { name: "ガラスが割れる", where: "大会で負けた時に画面が割れる", src: "Till Behrend「Glass Break」",
    now: () => SE.parin(), before: () => SYNTH_SE.parin() },
  { name: "シャッター", where: "てつこの写真を撮る", src: "themightyglider「Camera」",
    now: () => SE.shutter(), before: () => SYNTH_SE.shutter() },
  { name: "猫の鳴き声", where: "てつこが鳴く・ねだる・去る", src: "Kerzoven「Cat Purr & Meow」／IgnasD「Meow」（押すたびに交互）",
    now: () => SE.mew(), before: () => SYNTH_SE.mew() },
  { name: "炭のはぜる音", where: "炭を焼き始める時・家シーシャ・くじ・占い", src: "AntumDeluge「Fire Crackling」（3種類を入れ替えて）",
    now: () => SE.crackle(), before: () => SYNTH_SE.crackle() },
  { name: "好感度のベル", where: "好感度が少し上がった通知", src: "Spring Spring「Pleasing Bell Sound Effect」",
    now: () => SE.affinity(), before: null },
  { name: "好感度のベル（2回）", where: "仲が深まった（♥の段階が上がった）・恋人との絆が深まった・恋人になった通知", src: "同じベルを高さを変えて2回",
    now: () => SE.affinityUp(), before: null },
  { name: "セーブ完了", where: "セーブした時", src: "Kenney「Interface Sounds」",
    now: () => SE.save(), before: () => SYNTH_SE.money(), beforeLabel: "前の音（コインの合成音）" },
];

// BGM: 新しく当てた曲と、比べるための今までの曲。ファイルをそのまま再生する（ゲームの音量設定は使わない）。
export const BGM_PREVIEW_ROWS = [
  { name: "柚ヶ谷の街（第2章）", file: "bgm_yuzugaya.mp3", where: "第2章の朝・柚ヶ谷の地図と店先・柚ヶ谷の仕入れの店・ボドゲカフェを出た後",
    src: "Pro Sensory「Mocha Frapp」（CC0）。J04 の曲ができるまでの仮の曲。今までは下の「日常の曲」が第2章でも鳴っていた" },
  { name: "日常の曲（比べる用。第1・3章はこのまま）", file: "kansetsu_shomei_to_black_coffee.mp3", where: "第1章・第3章の朝と地図",
    src: "「間接照明とブラックコーヒー」" },
  { name: "ドバイの街（第4章）", file: "bgm_dubai.mp3", where: "第4章のドバイ（到着・自由行動・訪問・宿）",
    src: "yd「Desert theme」（CC0・約95秒）。今までの曲は27秒の繰り返しだった（DJ CrisP「Desert Travel (Loop)」）" },
];

const list = document.getElementById("list"), status = document.getElementById("status");
let ready = null;
function unlock() {
  if (ready) return ready;
  config.mute = false; delete config.muted;
  config.seVolume = Math.max(Number(config.seVolume) || 0, .7); // このページの中だけ。設定は保存しない
  unlockAudio(); applyVolumes();
  status.textContent = "録音を読み込んでいます…";
  ready = preloadSe().then(ok => {
    status.textContent = ok ? "録音を読み込みました。「今の音」は録音で鳴ります。"
      : "一部の録音を読み込めませんでした。読み込めない音は合成音で鳴ります（通信を確かめて開き直してください）。";
    status.dataset.loaded = String(ok);
    return ok;
  });
  return ready;
}
const make = (tag, props = {}, children = []) => {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
};
for (const [index, row] of AUDIO_PREVIEW_ROWS.entries()) {
  const play = fn => async () => { await unlock(); fn(); };
  list.append(make("section", { className: "row" }, [
    make("div", {}, [
      make("h2", { textContent: row.name }),
      make("p", { className: "where", textContent: `鳴る場面: ${row.where}` }),
      make("p", { className: "src", textContent: `録音: ${row.src}（CC0）` }),
    ]),
    make("div", { className: "buttons" }, [
      Object.assign(make("button", { type: "button", textContent: "今の音", onclick: play(row.now) }), { id: `now-${index}` }),
      row.before
        ? Object.assign(make("button", { type: "button", className: "old", textContent: row.beforeLabel || "前の音（合成）", onclick: play(row.before) }), { id: `before-${index}` })
        : make("span", { className: "src", textContent: "前は無音" }),
    ]),
  ]));
}

const bgmList = document.getElementById("bgm-list");
const players = [];
for (const [index, row] of BGM_PREVIEW_ROWS.entries()) {
  const player = make("audio", { controls: true, preload: "none", src: `../assets/audio/bgm/${row.file}`, id: `bgm-${index}` });
  // 1曲ずつ鳴らす: 再生を始めたら、ほかの曲を止める。
  player.addEventListener("play", () => { for (const other of players) if (other !== player) other.pause(); });
  players.push(player);
  bgmList.append(make("section", { className: "row bgm" }, [
    make("div", {}, [
      make("h2", { textContent: row.name }),
      make("p", { className: "where", textContent: `鳴る場面: ${row.where}` }),
      make("p", { className: "src", textContent: `曲: ${row.src}` }),
    ]),
    player,
  ]));
}
