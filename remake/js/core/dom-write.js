// 毎フレーム回る表示更新で、値が変わった時だけ DOM に書く（#3500 第2段階）。
// 同じ値でも textContent の代入は中の文字を作り直し、属性の代入は変更の通知とスタイルの再判定を起こすため。
// 読むのは要素自身の値だけで、レイアウトは読まない。

export function setText(node, text) {
  if (node && node.textContent !== text) node.textContent = text;
}

export function setAttr(node, name, value) {
  if (node && node.getAttribute(name) !== value) node.setAttribute(name, value);
}

export function setData(node, key, value) {
  const text = String(value);
  if (node && node.dataset[key] !== text) node.dataset[key] = text;
}

/** hidden・disabled など真偽の属性。同じ値の代入でも属性を書き直すため、変わる時だけ書く。 */
export function setFlag(node, key, value) {
  if (node && node[key] !== value) node[key] = value;
}
