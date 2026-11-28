// 効果音の試聴ページ（audio-preview.html）。新しく入れた録音と、前の合成音を聴き比べる。
// 音はゲーム本編と同じ core/audio.js をそのまま鳴らす。出典は asset_sources/music/main-se-20261111/。
import { SE, SYNTH_SE, unlockAudio, preloadSe, applyVolumes, playBgm, stopBgm, recordedSeFiles } from "./core/audio.js";
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
  // 第2弾（2026-11-13）
  { name: "店の扉", where: "地図から店へ入る時（店のロゴが出る時）", src: "Iwan Gabovitch「Door open, door close」",
    now: () => SE.door(), before: null },
  { name: "手に入れた", where: "限定フレーバー・くじ券をもらった通知", src: "Brandon Morris「Completion sound.」",
    now: () => SE.get(), before: null },
  { name: "朝の小鳥", where: "寝て朝になった時（晴れの日だけ）", src: "isaiah658「Ambient Bird Sounds」",
    now: () => SE.birds(), before: null },
  { name: "ページ", where: "レシピ帳に書き加えた・配合や話のメモをした通知", src: "Kenney「RPG Audio」（TRPGのページめくりと同じ録音・押すたびに交互）",
    now: () => SE.page(), before: null },
  { name: "結果発表の拍手とファンファーレ", where: "第2〜4章の大会の最終結果（1位の時。2位以下は拍手だけ。第1章は前からこの組み合わせ）", src: "拍手は上と同じ録音、ファンファーレは今までの合成音",
    now: () => { SE.crowd(2.4); SE.fanfare(); }, before: null },
];

// BGM: 新しく当てた曲と、比べるための今までの曲。ファイルをそのまま再生する（ゲームの音量設定は使わない）。
export const BGM_PREVIEW_ROWS = [
  { name: "柚ヶ谷の街（第2章）", file: "bgm_yuzugaya.mp3", where: "第2章の朝・柚ヶ谷の地図と店先・柚ヶ谷の仕入れの店・ボドゲカフェを出た後",
    src: "Pro Sensory「Mocha Frapp」（CC0）。J04 の曲ができるまでの仮の曲。今までは下の「日常の曲」が第2章でも鳴っていた" },
  { name: "日常の曲（比べる用。第1・3章はこのまま）", key: "kansetsu_shomei_to_black_coffee", where: "第1章・第3章の朝と地図",
    src: "オオヒラセイジ「間接照明とブラックコーヒー」（OpenTracks・旧DOVA-SYNDROME）" },
  { name: "ドバイの街（第4章）", file: "bgm_dubai.mp3", where: "第4章のドバイ（到着・自由行動・訪問・宿）",
    src: "yd「Desert theme」（CC0・約95秒）。今までの曲は27秒の繰り返しだった（DJ CrisP「Desert Travel (Loop)」）" },
];

const list = document.getElementById("list"), status = document.getElementById("status");
let ready = null;
const legacySeVolume = Math.max(Number(config.seVolume) || 0, 0.7);
function unlock() {
  if (ready) return ready;
  unlockAudio();
  status.textContent = "録音を読み込んでいます…";
  ready = preloadSe().then(ok => {
    status.textContent = ok ? "録音を読み込みました。「今の音」は録音で鳴ります。"
      : "一部の録音を読み込めませんでした。通信を確かめて開き直してください。";
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
const recorded = recordedSeFiles();
const auditionGroups = [
  {
    title: "第1章のタイトルコール",
    current: [{ label: "今の短いジングル", file: recorded.jingle[0] }],
    candidates: [
      { label: "A 明るいファンファーレ", file: "trpg/jingle_success.wav" },
      { label: "B 終演のジングル", file: "trpg/jingle_ending.wav" },
      { label: "C 力強い一撃", file: "axe_throw/killshot.wav" },
    ],
  },
  {
    title: "登場カットイン",
    current: [
      { label: "通常（太鼓と風切り）", play: () => SE.introImpact(), ms: 780 },
      { label: "短縮（SKIP）", play: () => SE.introImpact({ brief: true }), ms: 460 },
    ],
    candidates: [
      { label: "A 重い判の音", file: "camel_race/stamp_drop.wav" },
      { label: "B 短い打撃", file: "axe_throw/hit_1.wav" },
      { label: "C やわらかい風切り", file: recorded.whoosh[0] },
      { label: "D 勢いのある風切り", file: "camel_race/overtake_whoosh.wav" },
    ],
  },
  {
    title: "ロード完了",
    current: [{ label: "今の演出（無音）" }],
    candidates: [
      { label: "A セーブ完了音", file: recorded.save[0] },
      { label: "B 入手のチャイム", file: recorded.get[0] },
      { label: "C やわらかいベル", file: recorded.affinity[0] },
    ],
  },
];

const auditionList = document.getElementById("audition-list");
const auditionStatus = document.getElementById("audition-status");
const auditionStop = document.getElementById("audition-stop");
const players = [];
const auditionBuffers = new Map();
let auditionContext, audition, seTailUntil = 0, previewRequest = 0;

function coreSeVolume(volume) {
  config.mute = false;
  delete config.muted;
  config.seVolume = volume;
  applyVolumes();
}

function stopAudition(message = "") {
  previewRequest++;
  if (audition) {
    audition.sources.forEach(source => { source.stop(); source.disconnect(); });
    audition.volume?.disconnect();
    clearTimeout(audition.timer);
    if (audition.core) coreSeVolume(0);
    audition.button.setAttribute("aria-pressed", "false");
    audition = null;
    auditionStop.disabled = true;
    auditionStatus.textContent = message;
  }
  return previewRequest;
}

function stopPacked() {
  stopBgm(0);
  const button = document.querySelector("#bgm-list button[data-playing='1']");
  if (button) {
    button.dataset.playing = "";
    button.textContent = "再生";
  }
}

function stopPreviewBgm() {
  players.forEach(player => player.pause());
  stopPacked();
}

// 無音に近い余韻を除いた RMS を近づけ、ピークと増幅率に上限を設ける。
function recordingGain(buffer) {
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, index) => buffer.getChannelData(index));
  let peak = 0, squared = 0, count = 0;
  for (const samples of channels) for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
  if (!peak) return 1;
  for (const samples of channels) for (const sample of samples) {
    if (Math.abs(sample) < peak * 0.032) continue;
    squared += sample * sample;
    count++;
  }
  return Math.min(2.5, 0.135 / Math.sqrt(squared / count), 0.75 / peak);
}

function loadAudition(file) {
  if (!auditionBuffers.has(file)) {
    const url = new URL(`../../assets/audio/se/${file}`, import.meta.url);
    const loading = fetch(url).then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.arrayBuffer();
    }).then(data => auditionContext.decodeAudioData(data)).then(buffer => ({
      buffer,
      gain: recordingGain(buffer),
    })).catch(error => {
      auditionBuffers.delete(file);
      throw error;
    });
    auditionBuffers.set(file, loading);
  }
  return auditionBuffers.get(file);
}

function waitForCoreTail() {
  const remaining = seTailUntil - performance.now();
  return remaining > 0 ? new Promise(resolve => setTimeout(resolve, remaining)) : Promise.resolve();
}

async function playAudition(group, sample, button) {
  const wasPlaying = audition?.button === button;
  const request = stopAudition("試聴を停止しました。");
  stopPreviewBgm();
  coreSeVolume(0);
  if (wasPlaying) return;
  if (!sample.file && !sample.play) {
    auditionStatus.textContent = `${group.title} — ${sample.label}`;
    return;
  }

  const active = { button, sources: [], timer: null, core: false };
  audition = active;
  auditionStop.disabled = false;
  button.setAttribute("aria-pressed", "true");
  const label = `${group.title} — ${sample.label}`;
  auditionStatus.textContent = `読み込み中 — ${label}`;
  const finish = () => {
    if (audition === active) stopAudition(`再生終了 — ${label}`);
  };
  try {
    if (sample.play) {
      await unlock();
      await waitForCoreTail();
      if (request !== previewRequest) return;
      active.core = true;
      coreSeVolume(0.7);
      sample.play();
      seTailUntil = performance.now() + sample.ms;
      active.timer = setTimeout(finish, sample.ms);
    } else {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) throw new Error("Web Audio unavailable");
      auditionContext ||= new Context();
      await auditionContext.resume();
      const { buffer, gain } = await loadAudition(sample.file);
      if (request !== previewRequest) return;
      const volume = auditionContext.createGain();
      active.volume = volume;
      volume.gain.value = gain;
      volume.connect(auditionContext.destination);
      const source = auditionContext.createBufferSource();
      source.buffer = buffer;
      source.connect(volume);
      active.sources.push(source);
      source.onended = finish;
      source.start();
    }
    auditionStatus.textContent = `再生中 — ${label}`;
  } catch {
    if (request === previewRequest) stopAudition(`再生できませんでした — ${label}。もう一度押してください。`);
  }
}

for (const group of auditionGroups) {
  const choices = (label, samples, current = false) => make("fieldset", {}, [
    make("legend", { textContent: label }),
    make("div", { className: "buttons" }, samples.map(sample => {
      const button = make("button", { type: "button", textContent: sample.label, className: current ? "old" : "" });
      if (sample.file || sample.play) button.setAttribute("aria-pressed", "false");
      button.addEventListener("click", () => void playAudition(group, sample, button));
      return button;
    })),
  ]);
  auditionList.append(make("section", { className: "row audition" }, [
    make("h3", { textContent: group.title }),
    choices("今の音", group.current, true),
    choices("候補", group.candidates),
  ]));
}

auditionStop.addEventListener("click", () => stopAudition("試聴を停止しました。"));
document.addEventListener("visibilitychange", () => {
  if (document.hidden) stopAudition("試聴を停止しました。");
});

for (const [index, row] of AUDIO_PREVIEW_ROWS.entries()) {
  const play = fn => async () => {
    const request = stopAudition();
    const wasLoaded = await unlock();
    await waitForCoreTail();
    if (request !== previewRequest) return;
    coreSeVolume(legacySeVolume);
    fn();
    // 元の合成音は再生後に取り消せない。次の合成音を鳴らす前に余韻を待つ。
    const crowd = index === 0 || index === AUDIO_PREVIEW_ROWS.length - 1;
    if (fn === row.before || !wasLoaded || index === AUDIO_PREVIEW_ROWS.length - 1) {
      seTailUntil = performance.now() + (crowd ? 2600 : 900);
    }
  };
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
for (const [index, row] of BGM_PREVIEW_ROWS.entries()) {
  const info = [
    make("h2", { textContent: row.name }),
    make("p", { className: "where", textContent: `鳴る場面: ${row.where}` }),
    make("p", { className: "src", textContent: `曲: ${row.src}` }),
  ];
  // 梱包した曲（.bgm）は raw の <audio> では鳴らせない。ゲームと同じ playBgm で再生する（単体ファイルを公開しない）。
  let control;
  if (row.key) {
    const button = make("button", { type: "button", textContent: "再生", id: `bgm-${index}` });
    button.addEventListener("click", async () => {
      const request = stopAudition();
      await unlock();
      if (request !== previewRequest) return;
      for (const other of players) other.pause();
      if (button.dataset.playing === "1") { stopPacked(); return; }
      playBgm(row.key);
      button.dataset.playing = "1"; button.textContent = "停止";
    });
    control = button;
  } else {
    const player = make("audio", { controls: true, preload: "none", src: `../assets/audio/bgm/${row.file}`, id: `bgm-${index}` });
    player.addEventListener("play", () => {
      stopAudition();
      stopPacked();
      for (const other of players) if (other !== player) other.pause();
    });
    players.push(player);
    control = player;
  }
  bgmList.append(make("section", { className: "row bgm" }, [make("div", {}, info), control]));
}
