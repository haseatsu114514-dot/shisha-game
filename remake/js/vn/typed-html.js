// 文字送りの描画（#3500 C-21）。送りのたびに本文全体を innerHTML で作り直さず、前回の続きから増えた文字だけを DOM に足す。
// 切り方は text.js の sliceHtml と同じ（見える文字 n 文字ぶん、タグは開いた中へ足していく）なので、
// 出来上がる DOM は `innerHTML = sliceHtml(html, n)` と同じになる。文字速度・見た目・[pause] の位置は変えない。
// 本文が別の所で書き換えられた（会話の開始・ためらい演出の復元など）か、文字数が戻った時は、空にしてから作り直す。

const ENTITIES = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": "\"", "&#39;": "'", "&nbsp;": " " };
const tags = new Map(); // タグの文字列 → 写しの元にする空の要素

function tagNode(doc, tag) {
  let node = tags.get(tag);
  if (!node || node.ownerDocument !== doc) {
    const holder = doc.createElement("div");
    holder.innerHTML = tag;
    node = holder.firstChild;
    tags.set(tag, node);
  }
  return node.cloneNode(false);
}

function entityText(doc, entity) {
  if (entity in ENTITIES) return ENTITIES[entity];
  const holder = doc.createElement("div");
  holder.innerHTML = entity;
  return holder.textContent;
}

/** root の中身を「html の見える文字 n 文字ぶん」にそろえる関数を返す。 */
export function createTypedHtml(root) {
  const doc = root.ownerDocument;
  let html = null, at = 0, shown = 0, open = [root], last = null;
  const append = (text) => {
    if (!text) return;
    const parent = open.at(-1), tail = parent.lastChild;
    if (tail && tail.nodeType === 3) tail.appendData(text);
    else parent.append(doc.createTextNode(text));
  };
  return function render(source, n) {
    // 前回の続きから足せる時だけ足す。そうでなければ最初から組み直す（innerHTML と同じ結果になる）。
    if (source !== html || n < shown || root.lastChild !== last) {
      if (root.firstChild) root.replaceChildren();
      html = source; at = 0; shown = 0; open = [root];
    }
    let text = "";
    while (at < html.length && shown < n) {
      const c = html[at];
      if (c === "<") {
        const close = html.indexOf(">", at);
        const tag = html.slice(at, close + 1);
        append(text); text = "";
        if (tag.startsWith("</")) { if (open.length > 1) open.pop(); }
        else {
          const node = tagNode(doc, tag);
          open.at(-1).append(node);
          if (!tag.endsWith("/>") && !tag.startsWith("<br")) open.push(node);
        }
        at = close + 1;
        continue;
      }
      if (c === "&") {
        const semi = html.indexOf(";", at);
        text += entityText(doc, html.slice(at, semi + 1));
        at = semi + 1;
      } else {
        text += c;
        at++;
      }
      shown++;
    }
    append(text);
    last = root.lastChild;
  };
}
