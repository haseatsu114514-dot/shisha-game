// 小さな共通ヘルパー。DOM生成・待ち・乱数など、どのモジュールからも使うものだけを置く。

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/**
 * 要素を1行で作る。el("div.panel#main", { onclick }, [子...])
 * attrs: class/text/html/style(オブジェクト可)/dataset/on*（イベント）/その他属性
 */
export function el(spec, attrs = {}, children = []) {
  const m = /^([a-z0-9-]+)?((?:[.#][\w-]+)*)$/i.exec(spec) || [];
  const node = document.createElement(m[1] || "div");
  for (const part of (m[2] || "").match(/[.#][\w-]+/g) || []) {
    if (part[0] === ".") node.classList.add(part.slice(1));
    else node.id = part.slice(1);
  }
  if (Array.isArray(attrs) || attrs instanceof Node || typeof attrs === "string") {
    children = attrs;
    attrs = {};
  }
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "text") node.textContent = v;
    else if (k === "html") node.innerHTML = v;
    else if (k === "class") node.className += (node.className ? " " : "") + v;
    else if (k === "style" && typeof v === "object") {
      // CSS カスタムプロパティ（--i 等）は setProperty でないと入らない
      for (const [sk, sv] of Object.entries(v)) {
        if (sk.startsWith("--")) node.style.setProperty(sk, sv);
        else node.style[sk] = sv;
      }
    }
    else if (k === "dataset") Object.assign(node.dataset, v);
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? "" : v);
  }
  for (const c of [].concat(children)) {
    if (c == null || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (lo, hi) => lo + Math.random() * (hi - lo);
export const randInt = (lo, hi) => Math.floor(rand(lo, hi + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const sum = (arr) => arr.reduce((a, b) => a + b, 0);
export const yen = (n) => `${Math.round(n).toLocaleString("ja-JP")}円`;

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 直近 n 件と被らないように選ぶ（同じ文言の連発を防ぐ）。memory は呼び出し側が持つ配列 */
export function pickFresh(arr, memory, n = 2) {
  const fresh = arr.filter((x) => !memory.includes(x));
  const choice = pick(fresh.length ? fresh : arr);
  memory.push(choice);
  while (memory.length > n) memory.shift();
  return choice;
}

/** セーブごとに決まる擬似乱数（天気など「リロードで変わってはいけない」抽選用） */
export function seeded(seed, salt = 0) {
  let h = Math.imul((seed | 0) + salt * 7919, 2654435761) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 2246822519) >>> 0;
  return (h % 100000) / 100000;
}

/** クリック/タップ/Enter のどれかを1回待つ（会話送り・演出の区切りに使う） */
export function waitTap(target = document, { keys = ["Enter", " "], ignoreMs = 0 } = {}) {
  return new Promise((resolve) => {
    const start = performance.now();
    const done = (e) => {
      if (performance.now() - start < ignoreMs) return;
      if (e.type === "keydown" && !keys.includes(e.key)) return;
      target.removeEventListener("pointerup", done);
      window.removeEventListener("keydown", done);
      resolve();
    };
    target.addEventListener("pointerup", done);
    window.addEventListener("keydown", done);
  });
}

/** ボタン群から1つ選ばせる。options: [{label, value, disabled, desc}] */
export function chooseFrom(container, options, { className = "btn", onRender } = {}) {
  return new Promise((resolve) => {
    container.replaceChildren();
    options.forEach((o, i) => {
      const b = el(`button.${className}`, {
        disabled: o.disabled || null,
        dataset: { value: String(o.value ?? i), test: o.test || "" },
        onclick: () => resolve(o.value ?? i),
      }, [
        el("span.btn-label", { text: o.label }),
        o.desc ? el("small.btn-desc", { text: o.desc }) : null,
      ]);
      container.append(b);
    });
    if (onRender) onRender(container);
  });
}

/** 文字列の全角換算の長さ（半角=0.5）。改行判定に使う */
export function zenLength(s) {
  let n = 0;
  for (const ch of s) n += /[\x20-\x7e｡-ﾟ]/.test(ch) ? 0.5 : 1;
  return n;
}
