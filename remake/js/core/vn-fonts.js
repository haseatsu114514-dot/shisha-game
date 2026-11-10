// 会話用の明朝2書体をタイトル後に先読みし、会話開始時にも同じ読み込みを待つ。
let vnFontsPromise;
const FONT_WAIT_MS = 4000;

export function loadVnFonts() {
  if (!vnFontsPromise) {
    vnFontsPromise = Promise.resolve().then(() => {
      if (!globalThis.document?.fonts?.load) return [];
      const sample = "水煙前線 名前と会話 あいうえお";
      const fonts = Promise.all([
        document.fonts.load('700 20px "Suien Name"', sample),
        document.fonts.load('400 20px "Suien Blue Mincho"', sample),
      ]);
      // A stalled font request must not hold the first scene indefinitely.
      // The browser keeps downloading it and swaps it in when it arrives.
      let timer;
      return Promise.race([
        fonts,
        new Promise(resolve => { timer = setTimeout(() => resolve([]), FONT_WAIT_MS); }),
      ]).finally(() => clearTimeout(timer));
    }).catch((error) => {
      vnFontsPromise = null; // 先読み失敗後は会話開始時に再試行できる
      throw error;
    });
  }
  return vnFontsPromise;
}
