// 公開版だけ、スクリプトから後で差し込む CSS の URL に版を付ける（index.html の CSS と同じ ?v=<版>）。
// 版は公開時に remake/tools/stamp_deploy.py が index.html の meta に書き、起動スクリプトが
// window.SUIEN_BUILD に置く。手元（dev）では何もしない。
// 画像は付けない: 同じ画像を先読みと表示で別の書き方で参照している所があり、URL がずれると二重に読むため。

/** url（相対でも import.meta.url から作った絶対 URL でも可）に、公開版なら ?v=<版> を付ける */
export function buildVersioned(url) {
  const build = globalThis.SUIEN_BUILD;
  return build && build !== "dev" ? `${url}${url.includes("?") ? "&" : "?"}v=${build}` : url;
}
