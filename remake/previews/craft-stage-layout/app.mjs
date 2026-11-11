// シーシャ作り「一枚の舞台」レイアウト案の静止モック。
// 本編の工程・判定・保存は読まない（絵と文字を新しい配置に並べるだけ）。
// 操作の案内文は画面に常設しない（「？」と初回の説明で読む。2026-11-10 オーナー指示）。
// ?step=mix|pack|holes|heat|timer|steam|pull|care  ?mode=practice|tournament  ?zones=1  ?bare=1
const IMG = "../../img/";
const M = `${IMG}ui/making/`;
const FACE = `${IMG}ui/face_icons/new/`;
const SHOP = `${IMG}shop/`;

const STEPS = ["mix", "pack", "holes", "heat", "timer", "steam", "pull", "care"];
const NAMES = { mix: "配合", pack: "詰め方", holes: "穴あけ", heat: "炭焼き", timer: "蒸らし時間", steam: "蒸らし", pull: "吸い出し", care: "調整" };
const PHASES = ["パッキング", "炭焼き", "蒸らし", "吸い出し", "提供", "調整"];
const PHASE_OF = { mix: 0, pack: 0, holes: 0, heat: 1, timer: 2, steam: 2, pull: 3, care: 5 };
const QUALITY = ["q-shine", "q-good", "q-shine", "q-good", "q-shine"]; // 済んだ工程の出来（一台の記録の灯と同じ色）

const FLAME = `<svg class="ico flame" viewBox="0 0 16 16"><path d="M8.2 1c.6 2.6 3.8 4.1 3.8 7.6A4 4 0 0 1 4 8.9c0-1.7.8-2.9 1.9-3.8-.1 1.6.6 2.6 1.6 2.8C7 6 7.3 3.3 8.2 1Z"/></svg>`;
const SNOW = `<svg class="ico snow" viewBox="0 0 16 16"><path d="M8 1.5v13M2.4 4.75l11.2 6.5M2.4 11.25l11.2-6.5M6.3 2.6 8 4.2l1.7-1.6M6.3 13.4 8 11.8l1.7 1.6"/></svg>`;
const ARROW = `<path d="M2.5 15 27 3.5 21.5 15 27 26.5Z" stroke="#120a10" stroke-width="3" stroke-linejoin="round"/>`;
const TUBE_H = 450, TUBE_BOTTOM = 9; // 柱の管の高さと、柱の下端から管の底まで

// 絵は本編（craft/art.js の artImg）と同じく、中身の範囲（manifest の makingBox）で切り出して置く。
const BOX = {
  "heat_stove": [0.0983, 0.125, 1.0, 0.8867, 1.5],
  "heat_flat_cold": [0.2111, 0.2611, 0.7911, 0.8218, 1.2],
  "heat_flat_lit": [0.2103, 0.2638, 0.7911, 0.8218, 1.2],
  "heat_carrier": [0.1258, 0.0434, 0.8766, 0.9502, 1.0161],
  "kitchen_timer": [0.056, 0.1104, 0.9447, 0.9014, 1.5],
};
function art(name, w, { cls = "", style = "", h = null } = {}) {
  const [l, t, r, b, aspect] = BOX[name];
  const fullW = w / (r - l), natural = (fullW / aspect) * (b - t);
  const fullH = (fullW / aspect) * (h ? h / natural : 1); // h を渡すと本編と同じく縦を合わせる
  h ??= natural;
  return `<div class="art ${cls}" style="width:${w}px;height:${h.toFixed(1)}px;background-image:url(${M}${name}.webp);background-size:${fullW.toFixed(1)}px ${fullH.toFixed(1)}px;background-position:${(-l * fullW).toFixed(1)}px ${(-t * fullH).toFixed(1)}px;${style}"></div>`;
}

// 液晶の数字は本編と同じ7セグ（remake/js/craft/digital-clock.js と同じ形）。フォントの数字は使わない。
const SEG_ON = ["abcdef", "bc", "abdeg", "abcdg", "bcfg", "acdfg", "acdefg", "abc", "abcdefg", "abcdfg"];
const SEG_PATH = {
  a: "M6 2h28l4 4-4 4H6L2 6Z", b: "m38 8 4 4v20l-4 4-4-4V12Z", c: "m38 38 4 4v20l-4 4-4-4V42Z", d: "M6 64h28l4 4-4 4H6l-4-4Z",
  e: "m2 38 4 4v20l-4 4-4-4V42Z", f: "m2 8 4 4v20l-4 4-4-4V12Z", g: "M6 33h28l4 4-4 4H6l-4-4Z",
};
const sevenSeg = (mmss) => `<svg class="seven" viewBox="-2 0 219 76" aria-hidden="true">${[...mmss.replace(":", "")].map((digit, i) =>
  `<g transform="translate(${[2, 52, 122, 172][i]} 0)">${Object.entries(SEG_PATH).map(([id, d]) => `<path class="seg${SEG_ON[Number(digit)].includes(id) ? " on" : ""}" d="${d}"/>`).join("")}</g>`).join("")}<circle class="seg on" cx="108" cy="25" r="3"/><circle class="seg on" cx="108" cy="50" r="3"/></svg>`;

const leaves = (left = 5) => `<span class="leaves">${Array.from({ length: 5 }, (_, i) => `<img src="${M}ui_mockup_flavor_leaf.webp" alt=""${i >= left ? ' class="gone"' : ""}>`).join("")}</span>`;
const pips = (on, total = 5) => `<span class="pips">${Array.from({ length: total }, (_, i) => `<i${i < on ? ' class="on"' : ""}></i>`).join("")}</span>`;

// ---- 熱の柱。全工程で同じ場所に立つ。
// kind: band＝配合の温度帯の予想 / standby＝消灯（火を入れる前） / forecast＝蒸らし時間の目安の点線 / rising＝蒸らし中（札なし） / live＝吸い出し以降（状態の札つき）
// 状態の札（ぬるい・適温…）は吸い出し以降だけ出す（2026-11-10 オーナー指示）。
function spine({ kind, state = "", at = null, ghost = null, cold = false, color = "#74e0b0", bob = false }) {
  const y = (f) => `${TUBE_BOTTOM + f * TUBE_H}px`;
  return { kind, color, html: `
    <div class="spine" aria-label="熱ゲージ">
      <div class="spine-body"><div class="tube">
        <div class="scale"></div>
        ${at === null ? "" : `<i class="dim" style="bottom:${at * 100}%"></i>`}
        <i class="ok"></i><i class="best"></i>
        ${FLAME}${cold ? SNOW : ""}
        ${ghost === null ? "" : `<i class="ghost" style="bottom:${ghost * 100}%"></i>`}
        ${at === null ? "" : `<i class="mark" style="bottom:${at * 100}%"></i>`}
      </div></div>
      ${at === null ? "" : `<svg class="spine-arrow${bob ? " bob" : ""}" viewBox="0 0 30 30" style="bottom:${y(at)}">${ARROW}</svg>`}
      ${ghost === null ? "" : `<span class="spine-ghost-note" style="bottom:${y(ghost)}">蒸らし後の目安</span>`}
      ${state ? `<span class="spine-state">${state}</span>` : ""}
    </div>` };
}

// ---- 吸い出しの半円ダイヤル（形と色は本編に合わせた描き直し）
function dial() {
  const cx = 340, cy = 322, r0 = 196, r1 = 300;
  const pt = (p, r) => { const a = Math.PI * (1 - p); return `${(cx + r * Math.cos(a)).toFixed(1)} ${(cy - r * Math.sin(a)).toFixed(1)}`; };
  const sector = (a, b, ra = r0, rb = r1) => `M${pt(a, ra)}L${pt(a, rb)}A${rb} ${rb} 0 0 1 ${pt(b, rb)}L${pt(b, ra)}A${ra} ${ra} 0 0 0 ${pt(a, ra)}Z`;
  const just = [[.115, .2], [.46, .54], [.855, .93]];
  return `<svg class="dial" viewBox="0 0 680 340" aria-hidden="true">
    <defs><linearGradient id="dg" x1="0" x2="1"><stop offset="0" stop-color="#2396f3"/><stop offset=".3" stop-color="#4a86c8"/><stop offset=".46" stop-color="#7b8194"/><stop offset=".56" stop-color="#96857f"/><stop offset=".74" stop-color="#ee8f43"/><stop offset="1" stop-color="#f4431c"/></linearGradient></defs>
    <path d="${sector(0, 1, r0 - 12, r1 + 12)}" fill="#130c1f" stroke="#bea57555"/>
    <path d="${sector(0, 1)}" fill="url(#dg)"/>
    ${just.map(([a, b]) => `<path d="${sector(a, b, r0 + 2, r1 - 2)}" fill="#fff6d8" stroke="#e3bd6e" stroke-width="1.5"/>`).join("")}
    ${[.36, .64].map((p) => `<path d="M${pt(p, r0 - 6)}L${pt(p, r1 + 4)}" stroke="#fff" stroke-width="4" stroke-linecap="round"/>`).join("")}
    <path d="${sector(0, 1)}" fill="none" stroke="#ffe4b766" stroke-width="1.5"/>
    <g class="needle"><path d="M${cx - 5} ${cy}L${cx - 1.5} ${cy - r1 - 4}L${cx + 1.5} ${cy - r1 - 4}L${cx + 5} ${cy}Z" fill="#f2cf82" stroke="#6b4a17" stroke-width="1"/><path d="M${cx} ${cy - r1 - 18}l-9 16h18Z" fill="#ffe3a7" stroke="#6b4a17"/></g>
    <circle cx="${cx}" cy="${cy}" r="15" fill="#3c2a28" stroke="#b18a47" stroke-width="2"/><circle cx="${cx}" cy="${cy}" r="8" fill="#ffe8a0"/>
  </svg>`;
}

// ---- 穴あけのアルミ（外周12＋中周12。5つ開けたところ）
function foil() {
  const D = 508, c = D / 2, outer = .4 * D, inner = .255 * D;
  const mark = (r, n, i, cls) => { const a = -Math.PI / 2 + (i / n) * Math.PI * 2 + (r === inner ? Math.PI / n : 0); return `<i class="m ${cls}" style="left:${(c + r * Math.cos(a)).toFixed(1)}px;top:${(c + r * Math.sin(a)).toFixed(1)}px"></i>`; };
  const out = Array.from({ length: 12 }, (_, i) => mark(outer, 12, i, i >= 4 && i <= 8 ? "hole" : i === 9 ? "next" : "")).join("");
  const inn = Array.from({ length: 12 }, (_, i) => mark(inner, 12, i, "dim")).join("");
  const a = -Math.PI / 2 + (9 / 12) * Math.PI * 2;
  return `<div class="foil"><img src="${M}foil_interactive_top.webp" alt="">
    <i class="ring" style="width:${outer * 2}px;height:${outer * 2}px"></i><i class="ring inner" style="width:${inner * 2}px;height:${inner * 2}px"></i>
    ${inn}${out}
    <div class="orbit"><i class="cursor" style="left:${(c + outer * Math.cos(a)).toFixed(1)}px;top:${(c + outer * Math.sin(a)).toFixed(1)}px"></i></div>
  </div>`;
}

const hookah = `<div class="hookah">
  <img src="${M}hookah_base.webp" alt="" style="left:176px;top:440px;width:190px">
  <img src="${M}hookah_stem.webp" alt="" style="left:160px;top:176px;width:222px">
  <img src="${M}hookah_tray.webp" alt="" style="left:210px;top:246px;width:122px">
  <img src="${M}bowl_packed_normal.webp" alt="" style="left:229px;top:146px;width:84px">
  <i class="puff" style="left:196px;top:70px"></i><i class="puff" style="left:214px;top:100px;animation-delay:2.1s"></i>
</div>`;

// 葉の行: 商品パッケージ（ショップと同じ絵）を左に大きく出す
const flavor = (pack, name, sub, grams, on) => `<div class="fl glass${on ? " on" : ""}">
  <span class="fl-pack"><img src="${SHOP}${pack}.webp" alt=""></span>
  <div><h3>${name}</h3><p>${sub}</p></div>
  <div class="step"><button>−</button><span>${grams}<small>g</small></span><button class="plus">＋</button></div>
</div>`;

// ---- 工程ごとの絵。hero=はじめの切り抜き、play=舞台、dock=親指の列、voice=見守る人の一言
const SCENES = {
  mix: () => ({
    hero: `<img src="${M}hajime_craft_mix.webp" alt="" style="left:-104px;bottom:0;width:700px">`,
    spine: spine({ kind: "band", state: "温度帯" }),
    play: `<div class="mix">
      <div class="mix-bowl">
        <img src="${M}bowl_packed_normal.webp" alt="">
        <div class="gram">12.0<small> / 12 g</small></div><div class="gram-bar"><i></i></div>
        <div class="recipe">氷レモネード</div>
        <div class="taste glass">
          <div>甘い印象<i style="--a:10%;--b:52%"></i></div><div>清涼感<i style="--a:25%;--b:75%"></i></div><div>煙の量<i style="--a:11%;--b:53%"></i></div>
        </div>
        <div class="mix-keep">フレーバーの持ち${leaves(5)}</div>
      </div>
      <div class="mix-list">
        ${flavor("heaven10/lemon", "AF レモン", "<b>課題</b>・酸味　比率 50%", 6, true)}
        ${flavor("heaven10/mint", "AF ミント", "清涼　比率 50%", 6, true)}
        ${flavor("heaven10/double_apple", "AF ダブルアップル", "スパイス", 0, false)}
        ${flavor("packages/peach", "ピーチ", "甘み", 0, false)}
      </div>
    </div>`,
    dock: `<div class="grow"><span class="chip ok">✓ 課題「レモン」2g以上</span></div><button class="btn gold">この配合で詰める</button>`,
    voice: ["sumi", "スミさん", "手元を見ているぞ"],
  }),
  pack: () => ({
    hero: `<img src="${M}hajime_craft_pack.webp" alt="" style="left:-150px;bottom:24px;width:660px">`,
    spine: spine({ kind: "band", state: "温度帯" }),
    play: `<div class="pack">
      <div class="pack-bowl"><img src="${M}bowl_packed_normal.webp" alt=""><h3>ノーマル</h3><p>熱の入り方と抜けが標準。<br>迷ったらこれ</p></div>
      <div class="pack-side">
        <div class="aroma">AF レモンの香りが中心。後味すっきりの一服になりそう。</div>
        <div class="opt glass">ふんわり<small>熱がゆっくり入る</small></div>
        <div class="opt glass on">ノーマル<span class="tick">✓</span></div>
        <div class="opt glass">デンスパック<small>熱が強く入る</small></div>
      </div>
    </div>`,
    dock: `<div class="grow"></div><button class="btn gold">この詰め方で決める</button>`,
    voice: ["sumi", "スミさん", "詰め方で空気の通り道を作れ"],
  }),
  holes: () => ({
    hero: `<img src="${M}hajime_craft_holes.webp" alt="" style="left:-120px;top:226px;width:640px"><img src="${M}hajime_craft_holes_hover.webp" alt="" style="left:-173px;top:276px;width:640px">`,
    spine: spine({ kind: "standby" }),
    play: `<div class="holes">${foil()}
      <div class="holes-side">
        <span class="cap">外周12穴＋中周12穴</span>
        <h3>外周 <small>5 / 12</small></h3>
        <div class="time">TIME<i><b></b></i></div>
      </div>
    </div>`,
    dock: `<div class="grow"><button class="btn side" style="height:100%" disabled>次のリングへ</button><button class="btn side" style="height:100%;width:230px" disabled>終えて結果へ</button></div><button class="btn gold">穴を開ける<small>押し込んで離す</small></button>`,
    voice: ["sumi", "スミさん", "その間隔だ。いい手つきだな"],
  }),
  // 炭焼き: 決定ボタンが無い工程なので、下の列まで使ってコンロと炭を大きく置く（2026-11-10 オーナー指示）
  heat: () => ({
    hero: `<img src="${M}hajime_craft_heat.webp" alt="" style="left:-170px;bottom:0;width:720px">`,
    spine: spine({ kind: "standby" }),
    play: `<div class="heat">
      ${art("heat_stove", 850, { cls: "stove", style: "left:6px;top:118px" })}
      ${art("heat_flat_cold", 176, { cls: "coal", style: "left:290px;top:112px" })}
      ${art("heat_flat_lit", 176, { cls: "coal", style: "left:122px;top:296px;filter:brightness(.8) saturate(.8)" })}
      ${art("heat_flat_lit", 176, { cls: "coal ready", style: "left:446px;top:282px" })}
      <div class="pot glass"><h3>炭壺<b>0 / 3</b></h3>${art("heat_carrier", 104)}</div>
    </div>`,
    dock: "",
    voice: ["sumi", "スミさん", "黒い面が消えたら合図だ"],
  }),
  timer: () => ({
    hero: `<img src="${M}hajime_steam_wait.webp" alt="" style="left:-206px;top:0;height:1000px">`,
    spine: spine({ kind: "forecast", ghost: .5 }),
    play: `<div class="timer">
      <div class="clock">${art("kitchen_timer", 600, { h: 402 })}<div class="lcd" role="img" aria-label="8分0秒">${sevenSeg("08:00")}</div>
        <span class="key" style="left:15%">分</span><span class="key" style="left:34%">秒</span><span class="key" style="left:60%">スタート<br>＆ストップ</span><span class="key small" style="left:85%">リセット</span></div>
      <div class="timer-notes"><span class="chip">☀ 晴れ・28℃</span><span class="chip">雑念よけは 約40秒</span></div>
    </div>`,
    dock: `<div class="grow"></div>`,
    voice: ["sumi", "スミさん", "熱の目安を見て、決めろ"],
  }),
  // 蒸らし: スティックと補助ボタンは今と同じく近くにまとめる（押しやすさのための配置。2026-11-10 オーナー指示）
  steam: () => ({
    hero: `<img src="${M}hajime_steam_wait.webp" alt="" style="left:-206px;top:0;height:1000px">`,
    spine: spine({ kind: "rising", at: .31, color: "#ffe270", bob: true }),
    play: `<div class="steam">
      <div class="field" style="background-image:url(${M}steam_mind_world.webp)">
        <div class="digits">${sevenSeg("07:25")}</div><i class="ecg"></i><i class="halo"></i>
        <svg class="heart" viewBox="0 0 24 24"><path d="M12 21C5 15.5 2 12 2 8.2 2 5.3 4.2 3 7 3c1.9 0 3.6 1 5 2.8C13.400 4 15.100 3 17 3c2.800 0 5 2.300 5 5.200 0 3.800-3 7.300-10 12.800Z"/></svg>
        <span class="word" style="left:30px;top:120px">味、大丈夫か</span>
        <span class="word" style="right:60px;top:300px;--dx:-140px">失敗したら</span>
        <span class="word" style="left:520px;top:60px;--dx:-90px">時間、足りる？</span>
        <i class="orb" style="left:250px;top:330px;--dx:90px"></i><i class="orb" style="left:640px;top:190px;--dx:-110px"></i><i class="orb" style="left:400px;top:90px;--dx:60px"></i>
        <div class="steam-hud"><span>のこり 0:42</span><span>被弾 <i>0</i></span></div>
      </div>
      <i class="steam-bar"><b></b></i>
    </div>`,
    dock: `<div class="grow"></div>`,
    voice: null,
    extra: `<div class="steam-ctrl">
        <div class="pad"><img src="${M}steam_refresh_simple.webp" alt=""><b>リフレッシュ</b></div>
        <div class="pad locked"><img src="${M}steam_precision_simple.webp" alt=""><b>アタック</b></div>
        <div class="pad"><img src="${M}steam_precision_simple.webp" alt=""><b>精密</b></div>
        <div class="stick"><img src="${M}steam_stick_simple_base.webp" alt=""><i></i></div>
      </div>`,
  }),
  pull: (mode) => ({
    hero: `<img src="${M}hajime_craft_pull_rest.webp" alt="" style="left:-214px;bottom:0;width:700px">${hookah}`,
    spine: spine({ kind: "live", state: "適温・低", at: .47, bob: true }),
    play: `<div class="pull">
      <div class="dial-label down">▼ 熱を逃がす吸い<small>温度を下げる</small></div>
      <div class="dial-label up" style="right:6px">▲ 熱を入れる吸い<small>温度を上げる</small></div>
      ${dial()}
      <div class="readout"><small>針の現在位置</small><b>キープ左・微減</b></div>
    </div>`,
    dock: `<div class="chips"><span class="chip">フレーバーの持ち ${leaves(5)}</span><span class="chip">吸い出し回数 ${pips(3)} 3/5</span></div><div class="grow"></div><button class="btn side">${mode === "tournament" ? "提供する" : "確かめる"}</button><button class="btn gold" style="width:250px">吸う<small>針を止める</small></button>`,
    voice: ["sumi", "スミさん", "煙が落ち着いてきたな"],
  }),
  care: () => ({
    hero: `<img src="${M}hajime_craft_pull_rest.webp" alt="" style="left:-214px;bottom:0;width:700px">${hookah}`,
    spine: spine({ kind: "live", state: "ぬるい", at: .2, cold: true, color: "#ffedb0" }),
    play: `<div class="care">
      <p>提供から約20分。炭が消耗して、温度が下がってきた。</p>
      <div class="care-row"><span class="cap">置き方</span><div class="opt glass">外寄り</div><div class="opt glass on">標準</div><div class="opt glass">内寄り</div></div>
      <h3>炭を交換しますか？</h3>
      <div class="swap">
        ${[["交換しない", 0], ["1個", 1], ["2個", 2], ["3個", 3]].map(([label, n]) => `<div class="glass"><div class="coals">${n ? Array.from({ length: n }, () => `<img src="${M}coal_just.webp" alt="">`).join("") : `<img src="${M}coal_white.webp" alt="" style="filter:grayscale(1)">`}</div>${label}</div>`).join("")}
      </div>
    </div>`,
    dock: `<div class="grow"></div>`,
    voice: ["sumi", "スミさん", "吸われた一台は冷えていく"],
  }),
};

const TOURNAMENT_VOICE = {
  mix: "さあ、配合から見ていきましょう！", pack: "詰め方を見ていきます", holes: "穴の配置、きれいですね！", heat: "炭の熾き具合を見ていきます",
  timer: "さて、蒸らしの時間です", pull: "どんな味か、見てみよう", care: "ここからの熱の管理を見ていきます",
};

function rail(step, mode) {
  const now = PHASE_OF[step];
  const phases = PHASES.map((name, i) => i < now ? `<span class="phase done ${QUALITY[i]}" title="${name}"></span>`
    : i === now ? `<span class="phase now"><i>${i + 1}</i>${name}</span>` : `<span class="phase">${i + 1}</span>`).join("");
  const lamps = (n, shine) => `<span>${Array.from({ length: 5 }, (_, i) => `<b class="${i < n ? (i === shine ? "shine" : "on") : ""}"></b>`).join("")}</span>`;
  const rivals = mode === "tournament" ? `<div class="rivals">
    <div class="rival"><img src="${FACE}face_naru.webp" alt="">${lamps(now, 1)}</div>
    <div class="rival"><img src="${FACE}face_adam.webp" alt="">${lamps(Math.max(0, now - 1), -1)}</div>
    <div class="rival"><img src="${FACE}face_minto.webp" alt="">${lamps(now, 0)}</div></div>` : "";
  // ランク: 制作中は文字だけの略形（D〜SSS）と次のランクまでの進み。全文の絵（細かい文字入り）は結果の画面で大きく見せる。
  const grade = now >= 3 ? "A" : now >= 1 ? "B" : "";
  return `<header class="rail">
    <div class="mode">${mode === "tournament" ? "SMOKE CROWN CUP" : "REHEARSAL"}</div>
    <div class="phases">${phases}</div>
    <div class="rail-right">${rivals}<div class="rank"><small>RANK</small><b>${grade || "—"}</b>${grade ? `<i class="rank-meter"><u style="width:${grade === "A" ? 60 : 35}%"></u></i>` : ""}</div></div>
    <button class="help" aria-label="操作の説明">?</button>
  </header>`;
}

function render() {
  const query = new URLSearchParams(location.search);
  const step = STEPS.includes(query.get("step")) ? query.get("step") : "pull";
  const mode = query.get("mode") === "tournament" ? "tournament" : "practice";
  const scene = SCENES[step](mode);
  const stage = document.getElementById("stage");
  stage.dataset.step = step; stage.dataset.mode = mode; stage.dataset.heat = scene.spine.kind;
  stage.style.setProperty("--heat", scene.spine.color);
  const voice = scene.voice && (mode === "tournament" ? ["pakki", "パッキー", TOURNAMENT_VOICE[step]] : scene.voice);
  const bg = mode === "tournament" ? "bg_tournament_stage" : "bg_tonari_inside_day";
  stage.innerHTML = `
    <div class="bg" style="background-image:url(${IMG}backgrounds/${bg}.webp)"></div><div class="scrim"></div><div class="aura"></div>
    <div class="hero">${scene.hero}</div>
    ${rail(step, mode)}
    ${scene.spine.html}
    <main class="play">${scene.play}</main>
    ${scene.dock ? `<footer class="dock">${scene.dock}</footer>` : ""}
    ${voice ? `<div class="voice"><img src="${FACE}face_${voice[0]}.webp" alt=""><div><b>${voice[1]}</b><p>${voice[2]}</p></div></div>` : ""}
    ${scene.extra || ""}
    ${query.get("zones") ? `<div class="zones">
      <div class="z-rail">工程の進み＋出来の灯（1本に統合）　／　ライバル・ランク</div>
      <div class="z-help">？</div>
      <div class="z-hero">はじめ<small>枠なしの切り抜き<br>表情・汗・手元の動き</small></div>
      <div class="z-spine">熱の柱</div>
      <div class="z-play">舞台<small>今の作業ひとつだけを、画面でいちばん大きく</small></div>
      <div class="z-left">左下<small>見守る人の一言</small></div>
      <div class="z-mid">状態の札<small>持ち・回数・ひとことの案内</small></div>
      <div class="z-right">右親指<small>金の決定ボタンは常にここ</small></div></div>` : ""}`;

  // 試遊の切り替え
  const nav = document.getElementById("nav");
  if (query.get("bare")) { nav.hidden = true; return; }
  const link = (params, text, current, cls = "") => { const q = new URLSearchParams(query); for (const [k, v] of Object.entries(params)) v === null ? q.delete(k) : q.set(k, v); return `<a class="${cls}" href="?${q}"${current ? ' aria-current="page"' : ""}>${text}</a>`; };
  const i = STEPS.indexOf(step);
  nav.innerHTML = link({ step: STEPS[(i + STEPS.length - 1) % STEPS.length] }, "◀", false, "pager")
    + STEPS.map((id) => link({ step: id }, NAMES[id], id === step)).join("")
    + link({ step: STEPS[(i + 1) % STEPS.length] }, `${NAMES[step]} ▶`, false, "pager next") + "<i></i>"
    + link({ mode: mode === "tournament" ? null : "tournament" }, mode === "tournament" ? "大会" : "練習", mode === "tournament")
    + link({ zones: query.get("zones") ? null : "1" }, "配置の考え方", !!query.get("zones"));
}

function fit() {
  const k = Math.min(innerWidth / 1280, innerHeight / 720);
  document.getElementById("stage").style.setProperty("--k", String(k));
  document.getElementById("nav").classList.toggle("min", innerHeight < 520);
}
addEventListener("resize", fit);
fit(); render();
