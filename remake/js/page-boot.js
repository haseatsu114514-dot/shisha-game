// 試遊ページ（ミニゲームなどの単体ページ）の起動。2026-11-11 オーナー「試遊リンクだと過去の仕様になってしまうので、
// 最新版を本編同様遊べるようにして欲しい」: 本編（index.html の起動スクリプト）と同じく、公開版では次を行う。
// - 開いた版が最新かを build.json（キャッシュなし）で確かめ、古い版がキャッシュから出ていたら版付きの URL で読み直す
// - ページの本体は版の名前のフォルダ（js-<版>/）から読む＝古いモジュールがキャッシュから混ざらない
// - 遊んでいる途中に新しい版が出たら、勝手に読み直さず、タブへ戻った時に上へ知らせるだけ
// - 本編と同じ Service Worker を登録する（次から HTML・JS・CSS を毎回取り直す）
// 使い方（HTML）: <meta name="suien-build" content="dev" data-built=""> と
//   <script src="js/page-boot.js" data-page="js/desert-ride-page.js"></script>（ES モジュールではなく普通のスクリプト）
// 版の名札は公開時に remake/tools/stamp_deploy.py が書く。手元（dev）では確かめず、そのまま js/ から読む。
(() => {
  const script = document.currentScript;
  const page = script && script.dataset.page;
  const BUILD = document.querySelector('meta[name="suien-build"]')?.content || "dev";
  window.SUIEN_BUILD = BUILD; // スクリプトから差し込む CSS の版（js/core/asset-version.js）
  if (!page || !/^js\/[\w./-]+\.js$/.test(page)) {
    console.error("page-boot: data-page に js/ の下のスクリプトを書く", page);
    return;
  }
  const latest = async (timeoutMs) => {
    if (BUILD === "dev") return null;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`build.json?t=${Date.now()}`, { cache: "no-store", signal: controller.signal });
      return res.ok ? await res.json() : null;
    } catch {
      return null; // 確かめられないときは今の版のまま遊ぶ
    } finally {
      clearTimeout(timer);
    }
  };
  const openBuild = (build) => {
    const next = new URL(location.href);
    next.searchParams.set("v", build);
    location.replace(next.href);
  };

  // 遊んでいる途中で新しい版が出たら、上に知らせるだけ（タブへ戻ったとき）
  let lastCheck = Date.now();
  const recheck = async (force = false) => {
    if (BUILD === "dev" || document.hidden || document.getElementById("update-note")) return;
    if (!force && Date.now() - lastCheck < 60000) return;
    lastCheck = Date.now();
    const info = await latest(8000);
    if (!info?.build || info.build === BUILD) return;
    const note = document.createElement("div");
    note.id = "update-note";
    const go = document.createElement("button");
    go.type = "button";
    go.className = "update-go";
    go.dataset.test = "update-go";
    go.textContent = "新しい版が出ています ── タップで更新";
    go.addEventListener("click", () => openBuild(info.build));
    const close = document.createElement("button");
    close.type = "button";
    close.className = "update-close";
    close.setAttribute("aria-label", "閉じる");
    close.textContent = "×";
    close.addEventListener("click", () => note.remove());
    note.append(go, close);
    document.body.append(note);
  };
  document.addEventListener("visibilitychange", () => recheck());
  window.addEventListener("pageshow", (event) => { if (event.persisted) recheck(true); });

  if (BUILD !== "dev" && "serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js", { scope: "./", updateViaCache: "none" })
      .then((registration) => registration.update())
      .catch((error) => console.warn("Service worker registration failed:", error));
  }

  const load = async () => {
    const plain = new URL(page, document.baseURI).href;
    if (BUILD === "dev") return import(plain);
    try {
      return await import(new URL(page.replace(/^js\//, `js-${BUILD}/`), document.baseURI).href);
    } catch (error) {
      // 版のフォルダが無い（公開の切り替わり中など）ときだけ、いつもの js/ から読む。中身の失敗は二度読みしない
      if (!/dynamically imported module|Importing a module script failed|error loading/i.test(String(error?.message))) throw error;
      console.warn("page-boot: 版のフォルダから読めなかったので js/ から読む", error);
      return import(plain);
    }
  };
  (async () => {
    const info = await latest(3000);
    // 新しい版の URL で開き直しても古いまま（配信の切り替え待ち）なら、繰り返さずにこの版で遊ぶ
    if (info?.build && info.build !== BUILD && new URLSearchParams(location.search).get("v") !== info.build) {
      openBuild(info.build);
      return;
    }
    await load();
  })().catch((error) => console.error("試遊ページの起動に失敗しました", error));
})();
