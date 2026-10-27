// 動的 import など、画面が無反応になりがちな待ちのための軽量ロード表示の土台。
// 既存の .vn-loading と同じ「500ms超で文言、完了/失敗で除去」パターンだけを、
// DOM に依存しない形で共有する。show / hide を注入するのでNodeで単体テストできる。

/**
 * task を待つ間、delayMs を超えて未完了なら onShow() を一度だけ呼ぶ。
 * 解決・失敗のどちらでも、表示していれば onHide() を呼んで必ず片付ける。
 * task の結果を返し、失敗はそのまま投げ直す（呼び出し側が復帰導線を出す）。
 * 速い読み込みではスピナーを一瞬も出さない（固定待ちは足さない）。
 */
export async function withLoadingNotice(task, { delayMs = 500, onShow, onHide } = {}) {
  let shown = false;
  const timer = setTimeout(() => { shown = true; onShow?.(); }, delayMs);
  try {
    return await task;
  } finally {
    clearTimeout(timer);
    if (shown) onHide?.();
  }
}

/**
 * loader を同時に1回しか走らせない（連打・二重読込の防止）。
 * 実行中の再呼び出しは loader を呼ばず undefined を返し、
 * 終われば（成功・失敗とも）また呼べるので、そのまま再試行に使える。
 */
export function singleFlight(loader) {
  let running = false;
  return async (...args) => {
    if (running) return undefined;
    running = true;
    try {
      return await loader(...args);
    } finally {
      running = false;
    }
  };
}
