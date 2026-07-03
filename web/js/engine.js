// 会話エンジン — Godot 版 dialogue_box.gd と同じ JSON スキーマを解釈する。
// branch / choice の行は残りの行の前に挿入される（本家と同じ挙動）。
"use strict";

const STAT_KEYS = { technique: "技術", sense: "センス", guts: "根性", charm: "魅力", insight: "洞察" };
const STAT_JA2EN = { 技術: "technique", センス: "sense", 根性: "guts", 魅力: "charm", 洞察: "insight" };

const PORTRAIT_FRAMING_PRESETS = Object.freeze({
  baseline: Object.freeze({ target: 132, sink: 35 }),
  closeup: Object.freeze({ target: 138, sink: 41 }),
});
const PORTRAIT_FRAMING = PORTRAIT_FRAMING_PRESETS.closeup;

// 本名が別にあるキャラも、表示は基本あだ名（本名は会話テキスト内でだけ触れる）
const SPEAKER_NAMES = {
  hajime: "はじめ", sumi: "スミさん", naru: "なる", adam: "アダム",
  minto: "みんと", mashiro: "ましろ", tsumugi: "つむぎ", tumugi: "つむぎ",
  hazime: "はじめ", pakki: "パッキー", salaryman: "サラリーマン",
  nagumo: "南雲修二", maezono: "前園壮一郎", kirishima: "霧島レン",
  staff_choizap: "チョイザップスタッフ", kako: "かこ", rira: "りら",
  oneesan: "お姉さん", // みんとの私服（素）の姿。正体は ch1 では明かさない
  rin: "凛",
  ageha: "あげは", rei: "零-REI-", kumicho: "神崎竜二",
  dr_kemuri: "チャコール博士",
  // characters.json に載せないモブ話者（ending/dreams/ch3_mukai 等で使用）
  shop_clerk: "店員", old_man: "老人", customer: "お客さん", everyone: "全員",
};
window.SPEAKER_NAMES = SPEAKER_NAMES;
const SPEAKER_ID_ALIASES = { tumugi: "tsumugi", hazime: "hajime", takiguchi: "pakki", oneesan: "minto", kumicho: "ryuji" };
const FACE_ALIASES = {
  hajime: { excited: "smile" },
  naru: { excited: "smile", smug: "serious", fired_up: "serious" },
  adam: { silent: "normal", smug: "smile" },
  minto: { serious: "normal", ura_serious: "ura_sad" },
  tsumugi: { focus: "serious", shy: "sad" },
  pakki: { excited: "smile", smug: "smile", evil: "angry" },
};

// 背景込みの一枚絵で生成されているキャラ。専用の透過立ち絵がない場合だけここに入れる。
// 現在は本番用の透過立ち絵を使うため空。
const BG_FULL_PORTRAITS = new Set();

// 立ち絵を出さないキャラ。主人公は基本一人称視点なので、意図したCG演出以外では出さない。
const NO_PORTRAIT_SPEAKERS = new Set(["hajime", "hazime"]);

// キャラごとの名前色分けは廃止（視認性優先で白統一）

// 旧アセット → 最新版への参照差し替え（ファイルは退避せず参照だけ変える）
const ASSET_ALIASES = {
  "assets/backgrounds/tonari_day.png": "assets/backgrounds/bg_tonari_inside_day.png",
  "assets/backgrounds/tonari_night.png": "assets/backgrounds/bg_tonari_inside_night.png",
  "assets/backgrounds/eden.png": "assets/backgrounds/bg_eden_shop.png",
  "assets/backgrounds/bg_adam_shop.png": "assets/backgrounds/bg_eden_shop.png",
};

// アセット解決: スタンドアロン版では window.ASSET_DATA に data URI が入る
function assetUrl(rel) {
  rel = ASSET_ALIASES[rel] || rel;
  if (window.ASSET_DATA && window.ASSET_DATA[rel]) return window.ASSET_DATA[rel];
  return "../" + rel;
}

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// 一気に読める文字数は25文字程度なので、長い行は句読点優先で自動改行する。
// [imp] 等の装飾タグは幅0として数え、タグの途中では改行しない。
// 半角文字は0.5文字として数える（英字交じりの行が早く折れすぎないように）。
const WRAP_LIMIT = 24;
const WRAP_BREAK_AFTER = "、。，．！？…‥」』）】〉》";  // ここで切ると区切りが良い
// 行頭禁則: 小書きかな・長音・閉じ括弧に加え、「ん」と小書きカタカナも巻き取り、
// 「なるさ｜ん」のように名前（〜さん/〜くん）が割れるのを防ぐ
const WRAP_NO_LINE_START = "、。，．！？…‥ー〜ぁぃぅぇぉっゃゅょんゎ々ァィゥェォッャュョ」』）】〉》・";
function autoWrap(raw, limit = WRAP_LIMIT) {
  const text = String(raw);
  if (!text) return text;
  return text.split("\n").map((seg) => {
    let out = "";
    let line = 0;
    let i = 0;
    while (i < seg.length) {
      if (seg[i] === "[") {
        const close = seg.indexOf("]", i);
        if (close !== -1) { out += seg.slice(i, close + 1); i = close + 1; continue; }
      }
      out += seg[i];
      line += seg.charCodeAt(i) <= 0xff ? 0.5 : 1;
      i++;
      if (line >= limit && i < seg.length) {
        // 現在行の直近の句読点で折れるなら、そこで先に折る。
        let backSplit = -1;
        const lineStart = out.lastIndexOf("\n") + 1;
        for (let k = out.length - 1; k >= lineStart; k--) {
          if (WRAP_BREAK_AFTER.includes(out[k])) {
            let candidate = k + 1;
            while (candidate < out.length && WRAP_NO_LINE_START.includes(out[candidate])) candidate++;
            let firstW = 0;
            for (let j = lineStart; j < candidate; j++) firstW += out.charCodeAt(j) <= 0xff ? 0.5 : 1;
            if (firstW >= limit * 0.3) { backSplit = candidate; break; }
          }
        }
        if (backSplit >= 0 && backSplit < out.length) {
          const tail = out.slice(backSplit);
          out = out.slice(0, backSplit) + "\n" + tail;
          line = 0;
          for (const ch of tail) line += ch.charCodeAt(0) <= 0xff ? 0.5 : 1;
          continue;
        }

        // 少し先に句読点があればそこまで引っ張って、区切りの良い位置で折る
        let take = 0;
        for (let k = 0; k < 8 && i + k < seg.length; k++) {
          if (WRAP_BREAK_AFTER.includes(seg[i + k])) { take = k + 1; break; }
        }
        out += seg.slice(i, i + take);
        i += take;
        // 行頭に来てはいけない文字（閉じ括弧・小書きかな等）は巻き取る
        while (i < seg.length && WRAP_NO_LINE_START.includes(seg[i])) { out += seg[i]; i++; }
        // 開き括弧で行が終わるなら、括弧ごと次の行へ送る
        if (i < seg.length && "「『（【〈《".includes(out[out.length - 1])) {
          const open = out[out.length - 1];
          out = out.slice(0, -1) + "\n" + open;
          line = 1;
          continue;
        }
        // 残りが2文字以下なら折り返さず現在行へ吸収（末尾1文字だけが孤立するのを防ぐ）
        let rem = 0;
        for (let k = i; k < seg.length; k++) rem += seg.charCodeAt(k) <= 0xff ? 0.5 : 1;
        if (i < seg.length && rem > 2) { out += "\n"; line = 0; }
      }
    }
    return out;
  }).join("\n");
}

// [imp]/[warn]/[hint]/[red]/[blue]/[sub] タグを span に変換
function formatText(raw) {
  let t = escapeHtml(String(raw));
  const tags = { imp: "imp", warn: "warn", hint: "hint", red: "red", blue: "blue", sub: "sub" };
  for (const [tag, cls] of Object.entries(tags)) {
    t = t.replaceAll(`[${tag}]`, `<span class="tx-${cls}">`).replaceAll(`[/${tag}]`, "</span>");
  }
  return t.replace(/\n/g, "<br>");
}

class DialogueEngine {
  // ctx: { getStat(en), portraitFaces, charNames, onApply(line), onChoice(id, branchKey), onGameOver() }
  constructor(el, ctx) {
    this.el = el; // { bg, portraits, nameLabel, textLabel, box, choices, cg }
    this.ctx = ctx;
    this.queue = [];
    this.branches = {};
    this.dialogueId = "";
    this.onFinish = null;
    this.waitingChoice = false;
    this.finished = true;
    this.slots = {}; // speaker -> slot index (0:left 1:right)
    this.typeTimer = 0;
    this.typing = false;
    this.fullHtml = "";
    this.pages = null;   // 長文の改ページ（1本文を複数ページに分割表示）
    this.pageIdx = 0;
  }

  start(dialogue, onFinish) {
    this.dialogueId = dialogue.dialogue_id || "";
    this.queue = (dialogue.lines || []).slice();
    this.branches = dialogue.branches || {};
    this.onFinish = onFinish || null;
    this.waitingChoice = false;
    this.finished = false;
    this.slots = {};
    this.el.portraits.innerHTML = "";
    const meta = dialogue.metadata || {};
    if (meta.bg) this.setBackground(meta.bg);
    this.next();
  }

  setBackground(path) {
    let rel = String(path).replace(/^res:\/\//, "");
    // 昼夜つき背景の自動差し替え（ゲーム側が時間帯を知っているので委譲する）
    if (this.ctx.resolveBg) rel = this.ctx.resolveBg(rel);
    this.el.bg.style.backgroundImage = `url('${assetUrl(rel)}')`;
    if (this.ctx.onBackgroundChange) this.ctx.onBackgroundChange(rel);
  }

  next() {
    if (this.finished || this.waitingChoice) return;
    // タイプ中のクリックは全文表示に切り替える（送らない）
    if (this.typing) return this.completeTyping();
    // 改ページ: まだ続きのページがあれば、行を進めず次ページを表示
    if (this.pages && this.pageIdx < this.pages.length - 1) {
      this.pageIdx++;
      return this.renderPage(this.pageIdx);
    }
    this.pages = null;
    const line = this.queue.shift();
    if (line === undefined) {
      this.finished = true;
      this.el.choices.innerHTML = "";
      // シーン（この会話）が終わった合図。SKIPはここで解除して、転換は通常速度で見せる
      if (this.ctx.onSceneEnd) this.ctx.onSceneEnd();
      if (this.onFinish) this.onFinish();
      return;
    }
    const type = String(line.type || "");
    if (type === "condition") return this.handleCondition(line);
    if (type === "choice") return this.showChoices(line);
    if (type === "jump") return this.next(); // 章をまたぐジャンプは web 版では使用しない
    if (type === "set_flag") { if (this.ctx.setFlag) this.ctx.setFlag(line.flag); return this.next(); }
    if (type === "show_cg") { this.showCg(line.cg_id); return this.next(); }
    if (type === "hide_cg") { this.hideCg(); return this.next(); }
    if (type === "game_over") { this.finished = true; if (this.ctx.onGameOver) this.ctx.onGameOver(); return; }
    if (type === "apply") { if (this.ctx.onApply) this.ctx.onApply(line); return this.next(); }
    // SE行（#21）: {"type":"sfx","id":"coal_snip"}。id は sfx.js のAPI名（snake_case可）
    if (type === "sfx") { this.playSfx(line.id); return this.next(); }
    // 演出行（#25/#26）: {"type":"fx","id":"flash|shake|sepia|sepia_off|cutin|scent"}
    if (type === "fx") { if (this.ctx.onFx) this.ctx.onFx(line); return this.next(); }
    this.showLine(line);
  }

  // SE行の再生。存在しない id は黙って無視する（データ先行で書けるように）
  playSfx(id) {
    if (!window.SFX || !id) return;
    const key = String(id).replace(/_([a-z])/g, (m, c) => c.toUpperCase());
    if (typeof SFX[key] === "function") { try { SFX[key](); } catch (e) { /* noop */ } }
  }

  handleCondition(line) {
    const condType = String(line.condition_type || "stat");
    let ok;
    if (condType === "stat") {
      let stat = String(line.stat || "");
      if (STAT_JA2EN[stat]) stat = STAT_JA2EN[stat];
      const val = this.ctx.getStat ? this.ctx.getStat(stat) : 0;
      ok = val >= Number(line.threshold || 0);
    } else if (this.ctx.evalCondition) {
      // 恋愛状態などゲーム側の条件（ending.json の has_romance_and_max_affection 等）
      ok = !!this.ctx.evalCondition(line);
    } else {
      ok = false;
    }
    const key = ok ? String(line.next_true || "") : String(line.next_false || "");
    if (key && this.branches[key]) {
      this.queue.unshift(...this.branches[key]);
    } else if (key && this.ctx.findDialogue && this.ctx.findDialogue(key)) {
      // branch に無ければ別ダイアログへのジャンプ（ending.json の分岐チェーン形式）
      const target = this.ctx.findDialogue(key);
      this.queue = (target.lines || []).slice();
      this.branches = target.branches || {};
      const meta = target.metadata || {};
      if (meta.bg) this.setBackground(meta.bg);
    }
    this.next();
  }

  showChoices(line) {
    this.waitingChoice = true;
    this.el.choices.innerHTML = "";
    let delay = 0;
    for (const c of line.choices || []) {
      const btn = document.createElement("button");
      btn.className = "choice-btn";
      btn.style.animationDelay = `${delay}ms`;
      delay += 90;
      btn.innerHTML = formatText(c.text || "選択肢");
      btn.addEventListener("click", () => {
        if (window.SFX) SFX.select();
        this.waitingChoice = false;
        this.el.choices.innerHTML = "";
        const key = String(c.next || "");
        if (this.branches[key]) {
          this.queue.unshift(...this.branches[key]);
        } else if (c.next_id && this.ctx.findDialogue) {
          // 別ダイアログへの遷移（本家の next_id 挙動）
          const target = this.ctx.findDialogue(String(c.next_id));
          if (target) {
            this.queue = (target.lines || []).slice();
            this.branches = target.branches || {};
            const meta = target.metadata || {};
            if (meta.bg) this.setBackground(meta.bg);
          }
        }
        if (this.ctx.onChoice) this.ctx.onChoice(this.dialogueId, String(line.id || ""), key, String(c.next_id || ""));
        this.next();
      });
      this.el.choices.appendChild(btn);
    }
  }

  showCg(cgId) {
    // CG素材がまだ無いことがある（生成待ち）。バンドルされた一覧で存在チェックし、
    // 無ければ何も表示しない（404リクエストも出さない）
    if (this.ctx.hasCg && !this.ctx.hasCg(cgId)) return;
    this.el.cg.style.backgroundImage = `url('${assetUrl(`assets/cgs/${cgId}.png`)}')`;
    this.el.cg.classList.add("visible");
    if (this.ctx.onCg) this.ctx.onCg(cgId); // ギャラリーの閲覧記録
  }
  hideCg() {
    this.el.cg.classList.remove("visible");
  }

  // 透過余白の差を補正し、どのキャラも実体が同じ高さで並ぶようにする。
  // キャラ別の微調整は spriteScale（characters.json / portrait_scales 経由）で吸収できる（既定1.0）
  applyPortraitTrim(img, speaker, face) {
    const folder = SPEAKER_ID_ALIASES[speaker] || speaker;
    const scale = (this.ctx.portraitScales || {})[folder] || 1;
    // 背景込みの一枚絵は CSS に任せる（マスク＆固定サイズ）。スケール指定があれば乗算
    if (BG_FULL_PORTRAITS.has(folder)) {
      img.style.height = scale !== 1 ? `${92 * scale}%` : "";
      img.style.bottom = "";
      return;
    }
    const TARGET = folder === "pakki" ? 94 : PORTRAIT_FRAMING.target;
    const SINK = folder === "pakki" ? 8 : PORTRAIT_FRAMING.sink; // 頭上に約20pxの余白を残し、足元は画面外へ逃がす
    const trims = (this.ctx.portraitTrims || {})[folder] || {};
    const faces = (this.ctx.portraitFaces || {})[folder] || [];
    const aliasedFace = face && FACE_ALIASES[folder] && FACE_ALIASES[folder][face] ? FACE_ALIASES[folder][face] : face;
    let f = aliasedFace && faces.includes(aliasedFace) ? aliasedFace : "normal";
    const t = trims[f] || trims.normal;
    if (!t || !t.h) {
      img.style.height = `${100 * scale}%`;
      img.style.bottom = "0";
      img.style.setProperty("--portrait-anchor-x", "-50%");
      return;
    }
    const h = Math.min((TARGET / t.h) * scale, folder === "pakki" ? 225 : 240);
    img.style.height = `${h}%`;
    // 大柄キャラ（spriteScale>1）は頭が画面上端で見切れないよう、超過分だけ深く沈める。
    // 足元は元々画面外（SINK）なので見た目は破綻せず、身長差は頭の位置と体格差で残る
    const MAX_HEAD_TOP = 97; // コンテンツ上端の上限（コンテナ高さ%・頭上に最低3%の余白）
    const contentTop = t.h * h - SINK;
    const extraSink = Math.max(0, contentTop - MAX_HEAD_TOP);
    img.style.bottom = `${-(t.b * h + SINK + extraSink)}%`;
    // 横位置は足元の重心（ax）でアンカーする。bbox 中心だと表情差分で
    // 腕を広げた絵に中心が引っ張られ、立ち絵が左右に滑って見える
    const ax = typeof t.ax === "number" ? t.ax : t.l + t.w / 2;
    img.style.setProperty("--portrait-anchor-x", `${-(ax * 100)}%`);
  }

  // 立ち絵の配置: 1人なら画面中央、2人なら左右に分かれる
  layoutPortraits() {
    const imgs = [...this.el.portraits.querySelectorAll("img")];
    this.el.portraits.classList.toggle("duo", imgs.length >= 2);
    for (const img of imgs) {
      img.classList.remove("pos-center", "pos-left", "pos-right");
      if (imgs.length <= 1) {
        img.classList.add("pos-center");
      } else {
        const slot = this.slots[img.dataset.speaker] ?? 0;
        img.classList.add(slot === 0 ? "pos-left" : "pos-right");
      }
    }
  }

  portraitSrc(speaker, face) {
    const folder = SPEAKER_ID_ALIASES[speaker] || speaker;
    const faces = (this.ctx.portraitFaces || {})[folder];
    if (!faces) return null;
    const aliasedFace = face && FACE_ALIASES[folder] && FACE_ALIASES[folder][face] ? FACE_ALIASES[folder][face] : face;
    // 正体隠しエイリアス（oneesan=みんとの私服・素）は専用差分（ura_*）が届くまで出さない。
    // 通常のみんと立ち絵で代用すると、ch1で隠している正体が見た目でバレてしまう
    if (speaker === "oneesan" && !(aliasedFace && faces.includes(aliasedFace))) return null;
    let f = aliasedFace && faces.includes(aliasedFace) ? aliasedFace : null;
    if (!f && faces.includes("normal")) f = "normal";
    if (!f) f = faces[0];
    return assetUrl(`assets/sprites/characters/${folder}/chr_${folder}_${f}.png`);
  }

  // 表示名の解決。ctx.getName があれば優先（？？？＝未紹介の出し分けはゲーム側で行う）
  resolveName(speaker) {
    if (!speaker) return "";
    if (this.ctx.getName) return this.ctx.getName(speaker);
    return SPEAKER_NAMES[speaker] || (this.ctx.charNames || {})[speaker] || speaker;
  }

  showLine(line) {
    const speaker = String(line.speaker || "");
    const face = String(line.face || "");
    this.curSpeaker = speaker; // 文字送りボイス（#22）のピッチ決定に使う
    // 行付きの感情エフェクト（#26）: {"speaker":..., "fx":"flash"} で行表示と同時に発火
    if (line.fx && this.ctx.onFx) this.ctx.onFx({ id: String(line.fx) });
    // 名前ラベル
    if (speaker) {
      const name = this.resolveName(speaker);
      this.el.nameLabel.textContent = name;
      this.el.nameLabel.style.display = "";
      this.el.nameLabel.style.color = "#ffffff"; // キャラ色分けは視認性が悪いので白で統一
    } else {
      this.el.nameLabel.style.display = "none";
    }
    // 立ち絵（最大2スロット、発言者を明るく）。主人公は一人称視点なので出さない
    if (speaker && !NO_PORTRAIT_SPEAKERS.has(speaker) && this.portraitSrc(speaker, face)) {
      if (!(speaker in this.slots)) {
        const used = Object.values(this.slots);
        let slot = [0, 1].find((s) => !used.includes(s));
        if (slot === undefined) {
          // 一番古いスロットを奪う
          const oldest = Object.keys(this.slots)[0];
          slot = this.slots[oldest];
          delete this.slots[oldest];
          const oldImg = this.el.portraits.querySelector(`img[data-speaker="${oldest}"]`);
          if (oldImg) oldImg.remove();
        }
        this.slots[speaker] = slot;
        const img = document.createElement("img");
        img.dataset.speaker = speaker;
        const folder2 = SPEAKER_ID_ALIASES[speaker] || speaker;
        const bgfull = BG_FULL_PORTRAITS.has(folder2) ? " bgfull" : "";
        img.className = `portrait slot-${slot} enter${bgfull}`;
        img.onerror = () => { img.remove(); this.layoutPortraits(); };
        this.el.portraits.appendChild(img);
        requestAnimationFrame(() => requestAnimationFrame(() => img.classList.remove("enter")));
      }
      const img = this.el.portraits.querySelector(`img[data-speaker="${speaker}"]`);
      if (img) {
        img.src = this.portraitSrc(speaker, face);
        this.applyPortraitTrim(img, speaker, face);
      }
    }
    for (const img of this.el.portraits.querySelectorAll("img")) {
      img.classList.toggle("active", img.dataset.speaker === speaker);
    }
    this.layoutPortraits();
    // {daysLeft} 等のトークンを実数へ（カレンダー連動で台詞の日数が矛盾しないように）
    const raw = String(line.text || "");
    const text = this.ctx.interpolate ? String(this.ctx.interpolate(raw)) : raw;
    // テキスト（タイプライター表示）
    this.typeText(text);
    // バックログへ記録
    if (this.ctx.onLine) {
      this.ctx.onLine(speaker ? this.resolveName(speaker) : "", text);
    }
    // テキスト内の報酬キューを通知
    if (this.ctx.onTextCue) this.ctx.onTextCue(text, this.dialogueId);
  }

  // 本文を組版（自動改行）→ 長ければ MAX_PAGE_LINES 行ごとに改ページ。
  // ウィンドウを縦に伸ばさず、続きはクリックで次ページへ送る（#4）。
  typeText(raw) {
    const MAX_PAGE_LINES = 2; // #30 大きめ文字＋最大2行で改ページ
    const allLines = autoWrap(String(raw)).split("\n");
    this.pages = [];
    for (let k = 0; k < allLines.length; k += MAX_PAGE_LINES) {
      this.pages.push(allLines.slice(k, k + MAX_PAGE_LINES).join("\n"));
    }
    if (this.pages.length === 0) this.pages = [""];
    this.pageIdx = 0;
    this.renderPage(0);
  }

  renderPage(idx) {
    const text = this.pages[idx];
    const label = this.el.textLabel;
    clearInterval(this.typeTimer);
    this.fullHtml = formatText(text);
    // 装飾タグ入りの行はフェード表示、それ以外は一文字ずつタイプ表示
    if (text.includes("[")) {
      this.typing = false;
      label.innerHTML = this.fullHtml;
      label.classList.remove("typing");
      void label.offsetWidth;
      label.classList.add("typing");
      // [imp]付き台詞は軽い自動演出（#25: 一瞬のフラッシュ＋テキスト強調）
      if (text.includes("[imp]") && this.ctx.onFx) this.ctx.onFx({ id: "imp" });
      this.setAdvanceHint(true);
      return;
    }
    // CONFIGのテキスト速度（1=遅い 2=普通 3=速い 4=瞬間表示）
    const speed = (this.ctx.getTextSpeed && this.ctx.getTextSpeed()) || 2;
    if (speed >= 4) {
      this.typing = false;
      label.innerHTML = this.fullHtml;
      this.setAdvanceHint(true);
      return;
    }
    this.typing = true;
    this.setAdvanceHint(false);
    let i = 0;
    const step = Math.max(1, Math.round(text.length / 90)); // 長文は速める
    label.innerHTML = "";
    const interval = { 1: 42, 2: 24, 3: 12 }[speed] || 24;
    this.typeTimer = setInterval(() => {
      i += step;
      label.innerHTML = escapeHtml(text.slice(0, i)).replace(/\n/g, "<br>");
      if (window.SFX && i % 4 < step) {
        // キャラ別文字送りボイス（#22）。未対応ビルドでは従来のタイプ音へフォールバック
        if (SFX.charBlip) SFX.charBlip(this.curSpeaker); else SFX.type();
      }
      if (i >= text.length) this.completeTyping();
    }, interval);
  }

  completeTyping() {
    clearInterval(this.typeTimer);
    this.typing = false;
    this.el.textLabel.innerHTML = this.fullHtml;
    this.setAdvanceHint(true);
  }

  setAdvanceHint(visible) {
    if (this.el.advance) this.el.advance.style.visibility = visible ? "visible" : "hidden";
  }
}

window.DialogueEngine = DialogueEngine;
window.autoWrap = autoWrap;
window.STAT_KEYS = STAT_KEYS;
window.formatText = formatText;
