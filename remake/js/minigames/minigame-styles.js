// 本編ではゲームごとのスタイルを元のカスケード位置で読み込む。
// 単体の試遊ページは HTML で同じスタイルを読み込み済み。
const pending = new WeakMap();

export function withMinigameStyles(name, signal, start) {
  const template = globalThis.document?.getElementById?.("styles-" + name);
  if (!template || signal?.aborted) return start();
  let ready = pending.get(template);
  if (!ready) {
    const fragment = template.content.cloneNode(true);
    const links = [...fragment.querySelectorAll("link")];
    ready = Promise.all(links.map(link => new Promise((resolve, reject) => {
      link.onload = resolve;
      link.onerror = () => reject(new Error("ゲームのスタイルを読み込めませんでした: " + link.href));
    }))).then(() => template.remove(), error => {
      for (const link of links) link.remove();
      pending.delete(template);
      throw error;
    });
    pending.set(template, ready);
    template.before(fragment);
  }
  if (!signal) return ready.then(start);
  // 読み込み中に離れたら、通信を共有する別の入口は待たせたまま、この呼び出しだけ中断結果を返す。
  let onAbort;
  const cancelled = new Promise(resolve => { onAbort = resolve; });
  signal.addEventListener("abort", onAbort, { once: true });
  return Promise.race([ready, cancelled])
    .finally(() => signal.removeEventListener("abort", onAbort))
    .then(start);
}
