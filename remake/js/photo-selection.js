import { el } from "./core/util.js";

const key = "shisha_photo_selection_3941";
const status = document.querySelector("#status");
const results = document.querySelector("#results");
const labels = ["未選定", "使う", "保留", "使わない"];

async function openCatalog() {
  const response = await fetch("data/photo-selection.json");
  if (!response.ok) throw Error("catalog");
  const rows = await response.json();
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(key)) || {}; } catch { /* 初回 */ }
  const picks = Object.fromEntries(rows.map(({id}) => [id, labels.includes(saved[id]) ? saved[id] : labels[0]]));
  const summary = () => labels.map(label => label+"　"+rows.filter(row => picks[row.id] === label).map(row => row.id).join("・")).join("\n");
  const update = () => {
    status.textContent = rows.filter(row => picks[row.id] !== labels[0]).length+" / "+rows.length+" 枚を選定済み";
    results.value = summary();
  };
  for (const group of new Set(rows.map(row => row.group))) {
    const grid = el("div.grid");
    for (const {id, title} of rows.filter(row => row.group === group)) {
      const url = "img/photo-selection/"+id+".webp";
      const select = el("select", { id, onchange: () => {
        picks[id] = select.value; update();
        try { localStorage.setItem(key, JSON.stringify(picks)); }
        catch { status.textContent += "。端末に保存できません。選定結果をコピーしてください。"; }
      } }, labels.map(label => el("option", { value: label, text: label })));
      select.value = picks[id];
      grid.append(el("article", [
        el("a", { href:url, target:"_blank", rel:"noopener" }, [el("img", { src:url, loading:"lazy", alt:title+"を拡大" })]),
        el("label", { for:id, text:id+"　"+title }), select,
      ]));
    }
    document.querySelector("#groups").append(el("h2", {text:group}), grid);
  }
  document.querySelector("#export").onclick = () => { results.hidden = false; results.focus(); results.select(); };
  update();
}
openCatalog().catch(() => { status.textContent = "写真の一覧を読み込めませんでした。"; });
