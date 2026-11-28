// プリクラの「自分でらくがき」の画面（要望台帳 VPO22・2026-11-28 オーナー「自分でスマホのキーボードで文字入れたり好きにやれるようにもしたい。
// フォントや色とかも選べて　こだわりたい人は　スタンプ入れたりとか」→ 確認の答え「落書き無しの写真を作り直す」「2回目以降の撮影だけ」）。
// プリ機と同じく、まず「背景をえらんでね♪」でコマの背景を選び（上・下のコマ別にも。VPO24）、グリーンバックで抜いた写真（core/purikura-data.js の
// purikuraKey）を重ね、その上に もじ（キーボードで入力・書体・色・ふち）・スタンプ・ペンで描く。らくがきの間は残り時間を数え、プリクラの曲を流し、
// 「できた！」でシールが印刷されて出てくる（2026-11-28 オーナー「背景選んだりプリクラらしさも入れたい」）。
// 置いた文字とスタンプは指でずらし、大きさと傾きを変え、消せる。1つ戻す・ぜんぶ消す。「できた！」で落書きの中身を返す（保存は呼び出し側）。
// 「あげはにおまかせ」（一人の時は「おまかせに戻す」）で閉じると null（今の写真＝落書き入りのまま）。initial は描き直す時の前の落書き。
// 縦画面を縦持ちで使っている間は縦の舞台（720×H）、それ以外は本編のステージ（1280×720）に、それぞれの並べ方で出す（css/purikura-studio.css）。
import { el } from "../core/util.js";
import { SE, playBgm, currentBgm, preloadBgm } from "../core/audio.js";
import { layers } from "../core/ui.js";
import { svg } from "../core/transition-kit.js";
import { mountMotion } from "../core/motion-frame.js";
import {
  DOODLE_W, DOODLE_H, DOODLE_FONTS, DOODLE_COLORS, DOODLE_EDGES, DOODLE_PENS, DOODLE_STAMPS,
  DOODLE_LIMITS, DOODLE_BGS, normalizeDoodle, itemNode, strokeNode, strokePath, backdropSvg, bgSwatch,
} from "../core/purikura-doodle.js";

const TABS = [{ id: "bg", label: "背景" }, { id: "text", label: "もじ" }, { id: "stamp", label: "スタンプ" }, { id: "pen", label: "ペン" }];
// プリクラの曲（motions/purikura.js の PURIKURA_BGM と同じ3曲。演出の部品は読み込まない）
const MUSIC = ["bgm_purikura", "bgm_purikura_b", "bgm_purikura_d"];
const DOODLE_SECONDS = 120; // らくがきタイムの残り時間（0 になっても終わらせず「延長サービス」にする）
const TARGETS = [{ id: "both", label: "2コマとも" }, { id: "top", label: "上のコマ" }, { id: "bottom", label: "下のコマ" }];
const UNDO_MAX = 40;
const sound = (name) => { try { SE[name]?.(); } catch { /* 音が出せなくても描ける */ } };

/** 置く場所（写真の2コマに交互に、前に置いた物と重ならない所から。8つ置いたら少しずらして2周目） */
const SPOTS = [[320, 430], [320, 960], [150, 190], [490, 640], [490, 200], [150, 720], [320, 290], [470, 900]];
function spot(n) {
  const [x, y] = SPOTS[n % SPOTS.length], lap = Math.floor(n / SPOTS.length) % 3;
  return { x: x + lap * 24, y: y + lap * 30 };
}

export function openPurikuraStudio({ photo, title = "今日のプリクラ", autoLabel = "あげはにおまかせ", initial = null } = {}) {
  return new Promise((resolve) => {
    let doc = normalizeDoodle(initial) || normalizeDoodle({ v: 1 }); // らくがきし直す時は、前の落書きから
    const undo = [];
    let tab = "bg", selected = -1, placed = doc.items.length, target = "both";
    const pen = { c: "hot", w: "m", e: "white" };
    const style = { f: "maru", c: "hot", e: "white" };
    let stampColor = "hot";

    // ───── 写真と落書きの層 ─────
    const strokesG = svg("g"), itemsG = svg("g"), selG = svg("g", { class: "pks-sel-box" });
    const live = svg("g");
    const layer = svg("svg", { viewBox: `0 0 ${DOODLE_W} ${DOODLE_H}`, class: "pks-layer", "data-test": "pks-layer" }, [strokesG, itemsG, live, selG]);
    // 下から: 選んだコマの背景 → グリーンバックで抜いた写真（枠つき）→ 落書き
    let backdrop = backdropSvg(doc.bg, photo.panels);
    const shot = el("img.pks-shot", { src: photo.url, alt: "落書き前のプリクラ", draggable: "false" });
    const photoBox = el("div.pks-photo", { dataset: { test: "pks-photo" } }, [backdrop, shot, layer]);

    // ───── 道具 ─────
    const swatches = (current, pick, test) => el("div.pks-swatches", { role: "radiogroup", "aria-label": "色" }, DOODLE_COLORS.map((c) => el("button.pks-swatch", {
      type: "button", title: c.label, "aria-label": c.label, role: "radio", "aria-checked": String(c.id === current()), dataset: { id: c.id, test: `${test}-${c.id}` },
      style: { "--sw": c.hex }, onclick: () => { pick(c.id); sound("select"); sync(); },
    })));
    const choices = (list, current, pick, cls, test, label = (x) => x.label) => el(`div.pks-choices.${cls}`, { role: "radiogroup" }, list.map((x) => el("button.pks-choice", {
      type: "button", role: "radio", "aria-checked": String(x.id === current()), dataset: { id: x.id, test: `${test}-${x.id}` },
      onclick: () => { pick(x.id); sound("select"); sync(); },
    }, [label(x)])));

    const input = el("input.pks-input", { type: "text", maxlength: "24", placeholder: "文字を入れる", enterkeyhint: "done", autocomplete: "off", dataset: { test: "pks-input" }, "aria-label": "入れる文字" });
    const placeText = el("button.pks-place", { type: "button", text: "置く", dataset: { test: "pks-place-text" }, onclick: () => addText() });
    input.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); addText(); } });

    // もじ・スタンプの書体と色は、選んでいる物にもそのまま効く
    const restyle = (key, value) => { style[key] = value; const it = doc.items[selected]; if (it?.t === "text") { record(); it[key] = value; render(); } };
    const fontLabel = (f) => el("span", { text: "あア", style: { fontFamily: f.family, fontWeight: String(f.weight) } });
    // 選べる物の並び（印の付け直しは sync() が、ここで持っている並びに対して行う）
    const pick = {
      font: choices(DOODLE_FONTS, () => style.f, (id) => restyle("f", id), "pks-fonts", "pks-font", (f) => el("span.pks-font-face", [fontLabel(f), el("small", { text: f.label })])),
      textEdge: choices(DOODLE_EDGES, () => style.e, (id) => restyle("e", id), "pks-edges", "pks-edge"),
      textColor: swatches(() => style.c, (id) => restyle("c", id), "pks-text-color"),
      stampColor: swatches(() => stampColor, (id) => { stampColor = id; const it = doc.items[selected]; if (it?.t === "stamp") { record(); it.c = id; render(); } }, "pks-stamp-color"),
      penColor: swatches(() => pen.c, (id) => { pen.c = id; }, "pks-pen-color"),
      pen: choices(DOODLE_PENS, () => pen.w, (id) => { pen.w = id; }, "pks-pens", "pks-pen", (p) => el("span.pks-pen-dot", { style: { "--w": `${p.width}px` } }, [el("small", { text: p.label })])),
      penEdge: choices(DOODLE_EDGES, () => pen.e, (id) => { pen.e = id; }, "pks-edges", "pks-pen-edge"),
    };
    const stampButtons = DOODLE_STAMPS.map((st) => el("button.pks-stamp", { type: "button", title: st.label, "aria-label": st.label, dataset: { id: st.id, test: `pks-stamp-${st.id}` }, onclick: () => addStamp(st.id) },
      [svg("svg", { viewBox: "-60 -60 120 120" }, [itemNode({ t: "stamp", id: st.id, x: 0, y: 0, s: 1, r: 0, c: stampColor })])]));
    // 背景: どのコマに敷くか（2コマとも・上・下）と、柄の札
    const targetRow = choices(TARGETS, () => target, (id) => { target = id; }, "pks-targets", "pks-bg-target");
    const bgButtons = DOODLE_BGS.map((b) => el("button.pks-bg", { type: "button", "aria-label": b.label, role: "radio", dataset: { id: b.id, test: `pks-bg-${b.id}` },
      onclick: () => setBg(b.id) }, [bgSwatch(b.id), el("span", { text: b.label })]));
    const panels = {
      bg: el("div.pks-panel", { dataset: { tab: "bg" } }, [targetRow, el("div.pks-bgs", { role: "radiogroup", "aria-label": "背景" }, bgButtons)]),
      text: el("div.pks-panel", { dataset: { tab: "text" } }, [el("div.pks-row.pks-typing", [input, placeText]), el("div.pks-row.pks-faces", [pick.font, pick.textEdge]), pick.textColor]),
      stamp: el("div.pks-panel", { dataset: { tab: "stamp" } }, [el("div.pks-stamps", stampButtons), pick.stampColor]),
      pen: el("div.pks-panel", { dataset: { tab: "pen" } }, [el("p.pks-hint", { text: "写真の上をなぞって描く" }), pick.penColor, el("div.pks-row", [pick.pen, pick.penEdge])]),
    };
    const tabs = el("div.pks-tabs", { role: "tablist" }, TABS.map((t) => el("button.pks-tab", {
      type: "button", role: "tab", text: t.label, dataset: { id: t.id, test: `pks-tab-${t.id}` },
      onclick: () => { tab = t.id; if (tab === "pen") select(-1); sound("select"); sync(); },
    })));

    // 選んでいる物（文字・スタンプ）の大きさ・傾き・消す
    const size = el("input.pks-range", { type: "range", min: "0.3", max: "3", step: "0.05", dataset: { test: "pks-size" }, "aria-label": "大きさ" });
    const turn = el("input.pks-range", { type: "range", min: "-60", max: "60", step: "1", dataset: { test: "pks-turn" }, "aria-label": "傾き" });
    let sliding = false;
    const slide = (key, input) => {
      input.addEventListener("pointerdown", () => { if (!sliding) { sliding = true; record(); } });
      input.addEventListener("input", () => { const it = doc.items[selected]; if (!it) return; if (!sliding) record(); it[key] = Number(input.value); render(); });
      input.addEventListener("change", () => { sliding = false; });
    };
    slide("s", size); slide("r", turn);
    const remove = el("button.pks-remove", { type: "button", text: "けす", dataset: { test: "pks-remove" }, onclick: () => { if (selected < 0) return; record(); doc.items.splice(selected, 1); select(-1); render(); sound("click"); } });
    const selBar = el("div.pks-selbar", { hidden: true, dataset: { test: "pks-selbar" } }, [
      el("label.pks-slide", [el("span", { text: "大きさ" }), size]), el("label.pks-slide", [el("span", { text: "傾き" }), turn]), remove,
    ]);

    const undoButton = el("button.pks-tool", { type: "button", text: "1つ戻す", dataset: { test: "pks-undo" }, onclick: () => { const last = undo.pop(); if (!last) return; doc = JSON.parse(last); select(-1); render(); sound("click"); } });
    const clearButton = el("button.pks-tool", { type: "button", text: "ぜんぶ消す", dataset: { test: "pks-clear" }, onclick: () => { if (!doc.items.length && !doc.strokes.length) return; record(); doc = { v: 1, bg: doc.bg, items: [], strokes: [] }; select(-1); render(); sound("click"); } }); // 背景は残す
    const heading = el("h2.pks-title", { text: "背景をえらんでね♪", dataset: { test: "pks-title" } });
    const timer = el("span.pks-timer", { hidden: true, dataset: { test: "pks-timer" }, "aria-live": "off" });
    const head = el("header.pks-head", [heading, el("div.pks-head-tools", [undoButton, clearButton])]);
    const leave = el("button.pks-leave", { type: "button", text: autoLabel, dataset: { test: "pks-auto" }, onclick: () => finish(null) });
    const done = el("button.pks-done", { type: "button", text: "できた！", dataset: { test: "pks-done" }, onclick: () => finish(normalizeDoodle(doc)) });
    const tools = el("div.pks-tools", [tabs, ...Object.values(panels), selBar]);
    const root = el("div.pks", { role: "dialog", "aria-label": `${title}のらくがき`, dataset: { test: "pks" } }, [
      el("div.pks-back", { "aria-hidden": "true" }), head, el("div.pks-photo-wrap", [photoBox, timer]), tools, el("footer.pks-foot", [leave, done]),
    ]);

    // ───── 中身の出し入れ ─────
    function record() { undo.push(JSON.stringify(doc)); if (undo.length > UNDO_MAX) undo.shift(); }
    function setBg(id) {
      const next = doc.bg.map((v, i) => (target === "both" || (target === "top" ? i === 0 : i === 1) ? id : v));
      if (next.join() === doc.bg.join()) return;
      record();
      doc.bg = next;
      render();
      sync();
      sound("select");
    }
    function render() {
      const fresh = backdropSvg(doc.bg, photo.panels);
      backdrop.replaceWith(fresh);
      backdrop = fresh;
      if (penHint.classList.contains("full") && inkLeft() > 200 && doc.strokes.length < DOODLE_LIMITS.strokes) { penHint.textContent = "写真の上をなぞって描く"; penHint.classList.remove("full"); }
      strokesG.replaceChildren(...doc.strokes.map(strokeNode));
      itemsG.replaceChildren(...doc.items.map((it, i) => { const n = itemNode(it); n.dataset.index = String(i); return n; }));
      drawSelection();
      undoButton.disabled = !undo.length;
      clearButton.disabled = !doc.items.length && !doc.strokes.length;
    }
    function drawSelection() {
      selG.replaceChildren();
      const it = doc.items[selected], node = itemsG.children[selected];
      if (!it || !node) return;
      let box;
      try { box = node.getBBox(); } catch { box = { x: -60, y: -40, width: 120, height: 80 }; }
      const pad = 10 / it.s;
      selG.append(svg("g", { transform: node.getAttribute("transform") }, [svg("rect", {
        x: box.x - pad, y: box.y - pad, width: box.width + pad * 2, height: box.height + pad * 2, rx: 8 / it.s,
        fill: "none", stroke: "#ffffff", "stroke-width": 3, "stroke-dasharray": "10 8", "vector-effect": "non-scaling-stroke",
      })]));
    }
    function select(index) {
      selected = index;
      const it = doc.items[selected];
      selBar.hidden = !it;
      if (it) { size.value = String(it.s); turn.value = String(it.r); }
      drawSelection();
    }
    function sync() {
      root.dataset.tab = tab;
      for (const b of tabs.children) b.setAttribute("aria-selected", String(b.dataset.id === tab));
      for (const [id, panel] of Object.entries(panels)) panel.hidden = id !== tab;
      // 選べる物の印（今の書体・色・太さ）を付け直す。スタンプの見本は、選んでいる色で描き直す
      const mark = (group, value) => [...group.children].forEach((b) => b.setAttribute("aria-checked", String(b.dataset.id === value)));
      mark(pick.font, style.f); mark(pick.textColor, style.c); mark(pick.textEdge, style.e);
      mark(pick.stampColor, stampColor);
      for (const b of stampButtons) b.firstChild.replaceChildren(itemNode({ t: "stamp", id: b.dataset.id, x: 0, y: 0, s: 1, r: 0, c: stampColor }));
      mark(pick.penColor, pen.c); mark(pick.pen, pen.w); mark(pick.penEdge, pen.e);
      mark(targetRow, target);
      // 背景の札は、選んでいるコマ（2コマともの時は上のコマ）の柄に印
      const shown = doc.bg[target === "bottom" ? 1 : 0];
      for (const b of bgButtons) b.setAttribute("aria-checked", String(b.dataset.id === shown));
      heading.textContent = tab === "bg" ? "背景をえらんでね♪" : "らくがきタイム♪";
      if (tab !== "bg") startTimer();
      layer.classList.toggle("drawing", tab === "pen");
    }
    function addText() {
      const text = [...input.value.trim()].slice(0, 24).join("");
      if (!text) { input.focus(); return; }
      if (doc.items.length >= DOODLE_LIMITS.items) return;
      record();
      doc.items.push({ t: "text", ...spot(placed++), s: 1, r: -4, text, f: style.f, c: style.c, e: style.e });
      input.value = "";
      input.blur(); // キーボードを閉じて、置いた文字が見えるように
      select(doc.items.length - 1);
      render();
      sound("select");
    }
    function addStamp(id) {
      if (doc.items.length >= DOODLE_LIMITS.items) return;
      record();
      doc.items.push({ t: "stamp", ...spot(placed++), s: 1, r: Math.round(Math.random() * 24 - 12), id, c: stampColor });
      select(doc.items.length - 1);
      render();
      sound("select");
    }

    const inkLeft = () => DOODLE_LIMITS.totalPoints - doc.strokes.reduce((n, st) => n + st.p.length / 2, 0);
    const penHint = panels.pen.firstChild;
    function penFull() {
      penHint.textContent = "ペンはここまで。1つ戻すか、ぜんぶ消すとまた描ける";
      penHint.classList.add("full");
    }

    // ───── 写真の上の指 ─────
    const toPhoto = (e) => {
      const m = layer.getScreenCTM();
      if (!m) return { x: 0, y: 0 };
      const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
      return { x: p.x, y: p.y };
    };
    let drag = null, stroke = null;
    layer.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      const at = toPhoto(e);
      layer.setPointerCapture?.(e.pointerId);
      if (tab === "pen") {
        // 保存の上限（線の数・点の数）まで描いたら、それ以上は描かない（1つ戻すか、ぜんぶ消すと描ける）
        if (doc.strokes.length >= DOODLE_LIMITS.strokes || inkLeft() < 2) { penFull(); return; }
        record();
        stroke = { c: pen.c, w: pen.w, e: pen.e, p: [Math.round(at.x), Math.round(at.y)] };
        live.replaceChildren(strokeNode(stroke));
        return;
      }
      const hit = e.target.closest?.(".pkd-item");
      const index = hit ? Number(hit.dataset.index) : -1;
      select(index);
      if (index >= 0) {
        const it = doc.items[index];
        drag = { index, dx: it.x - at.x, dy: it.y - at.y, moved: false };
      }
    });
    layer.addEventListener("pointermove", (e) => {
      if (!stroke && !drag) return;
      const at = toPhoto(e);
      if (stroke) {
        const [lx, ly] = stroke.p.slice(-2);
        if (Math.hypot(at.x - lx, at.y - ly) < 4 || stroke.p.length >= DOODLE_LIMITS.points * 2 || stroke.p.length / 2 >= inkLeft()) return;
        stroke.p.push(Math.round(at.x), Math.round(at.y));
        live.firstChild?.querySelectorAll("path").forEach((path) => path.setAttribute("d", strokePath(stroke.p)));
        return;
      }
      const it = doc.items[drag.index];
      if (!it) return;
      if (!drag.moved) { record(); drag.moved = true; }
      it.x = Math.round(at.x + drag.dx); it.y = Math.round(at.y + drag.dy);
      render();
    });
    const end = () => {
      if (stroke) {
        if (stroke.p.length >= 2) doc.strokes.push(stroke);
        stroke = null;
        live.replaceChildren();
        render();
      }
      drag = null;
    };
    layer.addEventListener("pointerup", end);
    layer.addEventListener("pointercancel", end);

    // ───── らくがきタイムの残り時間（0 になっても終わらせない） ─────
    let left = DOODLE_SECONDS, ticking = 0;
    function startTimer() {
      if (ticking) return;
      timer.hidden = false;
      const show = () => {
        timer.replaceChildren(...(left > 0 ? [el("small", { text: "のこり" }), el("b", { text: String(left) }), el("small", { text: "秒" })] : [el("small", { text: "延長" }), el("b", { text: "♡" }), el("small", { text: "サービス" })]));
        timer.classList.toggle("hurry", left > 0 && left <= 20);
      };
      show();
      ticking = setInterval(() => {
        if (!root.isConnected) { clearInterval(ticking); return; }
        if (left > 0) left--;
        if (left === 10) sound("tick");
        show();
      }, 1000);
    }

    // ───── プリクラの曲（閉じたら前の曲へ。別の場面が曲を変えていたら上書きしない） ─────
    const music = MUSIC[Math.floor(Math.random() * MUSIC.length)];
    const previousMusic = currentBgm();
    try { void preloadBgm(music); playBgm(music); } catch { /* 音が出せなくても描ける */ }

    // ───── 置き場所と大きさ ─────
    const mounted = mountMotion(root, { portrait: true, host: layers.fx });
    const { W, H, portrait } = mounted.frame;
    root.classList.add(portrait ? "tall" : "wide");
    // 写真の大きさ: 縦は幅いっぱい近く（上の見出しと下の道具・ボタンの残り）、横は左の高さいっぱい
    // 縦: 舞台の高さ − 上下の余白 44・見出し 96・道具 540・ボタン 92・間 14×3（css/purikura-studio.css の .pks.tall）
    const scale = portrait ? Math.min(600 / DOODLE_W, (H - 44 - 96 - 540 - 92 - 42) / DOODLE_H) : Math.min(420 / DOODLE_W, (H - 40) / DOODLE_H);
    root.style.setProperty("--pks-w", `${Math.round(DOODLE_W * scale)}px`);
    root.style.setProperty("--pks-h", `${Math.round(DOODLE_H * scale)}px`);
    root.style.setProperty("--pks-stage-w", `${W}px`);
    // 縦の舞台の縮み具合（base.css の入力欄の規則が、入力欄の字を画面で 16px 以上に保つのに使う）。横は本編のステージの --k をそのまま使う
    if (portrait) { const k = root.getBoundingClientRect().width / W; if (k > 0) root.style.setProperty("--k", String(Math.round(k * 1000) / 1000)); }

    let closing = false;
    async function finish(result) {
      if (closing) return;
      closing = true;
      clearInterval(ticking);
      if (result) {
        // 印刷: 「プリント中♪」の札のあと、写真が下の取り出し口へ降りていく
        sound("whoosh");
        root.classList.add("printing");
        root.append(el("div.pks-print", { dataset: { test: "pks-print" } }, [el("strong", { text: "プリント中♪" }), el("span", { text: "取り出し口からシールが出てくるよ" })]));
        await new Promise((r) => setTimeout(r, 1300));
        sound("perfect");
      } else sound("click");
      try { if (currentBgm() === music) playBgm(previousMusic); } catch { /* 音が出せなくても閉じる */ }
      mounted.remove();
      resolve(result);
    }
    sync();
    render();
    sound("card");
  });
}
