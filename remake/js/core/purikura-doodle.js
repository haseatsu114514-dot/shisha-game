import { DB } from "./data.js";
import { homeRigFile } from "./scene-art.js";
import { portraitStyle } from "./portrait-style.js";
import { el } from "./util.js";
import { themes, stamps, colors, LIMIT, paint, sheet, printedPurikura } from "./purikura-photo.js";

// 縦の外枠は本編のモーダルを文字のメニューに写す。写真と指の座標が一致する実物の dialog を開く。
function booth(title, body, actions, signal) {
  if (signal?.aborted) return Promise.resolve(null);
  return new Promise(resolve => {
    const dialog = el("dialog.pb-dialog", { "aria-label": title });
    const done = value => { signal?.removeEventListener("abort", cancel); dialog.close(); dialog.remove(); resolve(value); };
    const cancel = () => done(null);
    dialog.addEventListener("cancel", e => { e.preventDefault(); cancel(); });
    dialog.append(el("h2", { text: title }), body, el("div.pb-actions", actions.map(([label, value]) =>
      el("button.btn", { dataset: { test: value === "receive" ? "purikura-receive" : "" }, text: label, onclick: () => done(value) }))));
    signal?.addEventListener("abort", cancel, { once: true });
    (document.fullscreenElement || document.body).append(dialog);
    dialog.showModal();
  });
}
const select = (label, options, change) => el("label.pb-field", [label, el("select", { "aria-label": label, onchange: e => change(e.target.value) },
  options.map(([id, name]) => el("option", { value: id, text: name }))) ]);

export async function chooseBooth(photo, owned, nameFor, signal) {
  const design = { v: 1, style: portraitStyle(), theme: "original", rig: "", marks: [] };
  const preview = el("div.pb-preview");
  const refresh = () => preview.replaceChildren(sheet(photo, design, nameFor));
  const choices = el("div.pb-swatches", Object.entries(themes).map(([theme, label]) =>
    el("button", { dataset: { theme }, "aria-pressed": String(theme === design.theme),
      onclick: e => { design.theme = theme; for (const btn of choices.children) btn.setAttribute("aria-pressed", String(btn === e.currentTarget)); refresh(); } }, [el("span", { text: label })])));
  const available = [...new Set(owned)].filter(id => homeRigFile(id));
  const rig = select("小道具", [["", "台なし"], ["home_rig_set", "撮影用の卓上台"], ...available.map(id => [id, "持ち込み・"+(DB.equipById[id]?.name || "シーシャ台")])], id => { design.rig = id; refresh(); });
  refresh();
  const result = await booth("背景を選んでね", el("div", [preview, choices, rig]), [["撮って落書きする", "edit"], ["このまま撮る", "auto"], ["やめる", null]], signal);
  return result && { design, edit: result === "edit" };
}

export async function finishBooth(photo, setup, nameFor, signal) {
  const { design, edit } = setup;
  if (edit) {
    const card = sheet(photo, design, nameFor), layer = card.querySelector(".pb-ink");
    let tool = "pen", color = "pink", stamp = "heart", font = "round", current = null;
    const input = el("input", { maxlength: 24, placeholder: "写真に書く言葉", "aria-label": "写真に書く言葉" });
    const notice = el("small", { role: "status", text: "道具を選んで、写真に描いてね" });
    const toolbar = el("div.pb-toolbar", [
      select("道具", [["pen","ペン"],["stamp","スタンプ"],["text","文字"]], val => { tool = val; }),
      select("インク", Object.keys(colors).map((key,i) => [key, ["桃","青","金","白","墨"][i]]), val => { color = val; }),
      select("スタンプ", Object.entries(stamps).map(([k,v]) => [k,v[0]]), val => { stamp = val; setTool("stamp"); }),
      select("書体", [["round","丸ゴシック"],["book","明朝"],["mono","等幅"]], val => { font = val; setTool("text"); }),
      input, el("button", { text: "一手戻す", onclick: () => { if (current) return; design.marks.pop(); layer.lastChild?.remove(); notice.textContent = "一手戻したよ"; } }),
    ]);
    function setTool(val) { tool = val; toolbar.querySelector("select").value = val; }
    input.addEventListener("focus", () => setTool("text"));
    const position = e => {
      const r = layer.getBoundingClientRect();
      return [[e.clientX-r.left, r.width, 320],[e.clientY-r.top,r.height,440]].map(([v,span,max]) => Math.round(Math.max(0, Math.min(1,v/span))*max));
    };
    layer.classList.add("editing");
    layer.onpointerdown = e => {
      if (current || e.button !== 0) return;
      if (design.marks.length >= LIMIT) { notice.textContent = "いっぱいだよ。一手戻してね"; return; }
      const at = position(e);
      const mark = tool === "pen" ? {kind:tool,color,points:[at]} : tool === "stamp" ? {kind:tool,stamp,at,color} : {kind:tool,text:input.value.trim(),at,font,color};
      if (tool === "text" && !mark.text) { input.focus(); return; }
      design.marks.push(mark); layer.append(paint(mark));
      if (tool === "pen") { current = { pointer: e.pointerId, mark }; layer.setPointerCapture(e.pointerId); }
    };
    layer.onpointermove = e => {
      if (current?.pointer !== e.pointerId) return;
      const points = current.mark.points, pt = position(e);
      if (String(points.at(-1)) === String(pt)) return;
      if (points.length >= 96) current.mark.points = points.filter((_, i) => i % 2 === 0);
      current.mark.points.push(pt); layer.lastChild.replaceWith(paint(current.mark));
    };
    layer.onlostpointercapture = () => { current = null; };
    if (!await booth("落書きタイム", el("div", [card, toolbar, notice]), [["できあがり", true], ["撮影をやめる", null]], signal)) return null;
  }
  return (design.theme === "original" && !design.rig && !design.marks.length) ? "" : JSON.stringify(design);
}


export async function receivePrint(title, photo, nameFor, signal) {
  const result = await booth(title, printedPurikura(photo, nameFor), [["受け取る（400円）", "receive"], ["やめる", null]], signal);
  return result === "receive";
}
