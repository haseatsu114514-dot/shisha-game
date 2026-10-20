# スマホ横持ち制作UI・静的配置確認 (#756)

## 対象
main `0fef9526f37696b134a80a119e1051b8247f6122` の現行HTML/CSS・`steps.js`/`session.js`/`thermometer.js`のDOM構造を基準にした**隔離static fixture**。本編script・制作フロー・第1章試遊は実行していない。画像はplaceholder、同梱fontは取得せずsystem fallback。ここに保存した画像は実ゲーム画面ではない。

新CSSはスマホ横持ち (landscape / <=1024px / <=520px / coarse pointer / hover:none) と通常表示だけに適用。`setup/mix/pack/place`の4工程。setupは直接の機材選択gridがある場合だけ。水入れ#743は別要望で、mainのsetupにwidgetはなく、将来の水入れDOMを想定した非一致fixtureにCSSは適用されない。将来DOMが決まったら再照合が必要。

スマホにDSを自動適用するコードはない。`main.js`→`initGameLayout()`→`readTitleLayout()`で、保存キー`suien_title_layout`が厳密に`ds`の場合だけDSとなる。通常既定はnormal、明示DS設定済み端末は今回のCSS対象外。モード/設定は変更していない。

## 変更境界
setup/pack/placeは左の作業絵を260設計pxへ、右を278設計pxからとして説明/操作へ幅を渡す。重要説明は実表示14px、主要選択/確定操作は44px以上。既存説明文字列は保持し、縦scrollで全文・末尾操作へ届く。stage倍率・素材解像度は変更しない。器の300x332設計pxとpackingの最低300設計pxは保持する。

packは器と選択肢を横に並べ、3選択肢と全幅の確定footerが初期表示に収まる。captionは独立scroll、footerは下段sticky。器の最低300設計pxは保持する。

mixは既存の外枠座標/幅/overflow/ヘルプを保持し、内部の説明・一覧scroll・44pxの増減/確定操作だけを調整する。適温プレビュー・legend・温度帯label・そのclip祖先は前後不変。表示/非表示の両方を比較。mixの既存ヘルプは位置/サイズを維持したため44px目標の対象外。mixの左の既存人物欄の文字サイズも今回変更していない。温度計CSS/JS・非表示条件を変更しない。

FOIL/HEAT/timer/steam/pull/care/serve、DS、VN2px修正、共通button、採点/熱モデル、#732の炭発光/授業/トング、水入れUI、#750素材は対象外。追加依頼4全体の完了とはしない。

## 実行と結果
`node tools/test_craft_landscape_static.mjs`（既存system Chrome / Node、CDP pipe、依存追加なし）。Chromeパスは`CHROME_BIN`、既取得CSSのcache実行は`CRAFT_CACHE`、成果物先は`CRAFT_ARTIFACTS`で指定可。既定成果物先は`/tmp/shisha-craft-landscape-static`。生成Chrome profile/cacheはGitHub保存対象外。

最終38条件PASS:
- setup / mix-hidden / mix-visible / pack / place × PC1920x1080、mouse844x390、coarse844x390、coarse915x412、coarse740x360、DS844x390 = 30条件。
- 対象外7工程 + setup-water非一致DOM = 8条件。
- 対象phoneの説明font最小14px、主要操作矩形44px以上、カード/子要素非重複、末尾操作のscroll到達とfocus outline。
- mix一覧末尾の増減操作もscroll到達/focus確認。preview矩形/可視性/clip祖先、温度帯labelと外枠/guide矩形の前後一致。
- PC・mouse狭画面・DS・対象外工程/水DOMは前後geometry完全一致。stage倍率/寸法は全対象で不変。
- packは3選択肢と確定buttonの初期矩形がpane内にあることを3 phone viewportでassert。
- 新scroll領域の祖先touch-actionがnoneでないことを確認し、Chrome合成touch scroll gestureでscrollTopが増えることもcomponent内で確認。programmatic scrollだけを実タッチ成功と扱っていない。
- main.js/session.js/steps.js/core/ui.js/util.jsをソース確認。対象4工程にglobal preventDefault/touchmove blockは見つからず、base.cssの祖先touch-actionはmanipulation。章移行演出の専用swallow handlerは対象componentのものではない。
- 最終fixture画像8枚を直接目視し、mixカード重なりとpack初期操作見切れを修正後に再検証。初稿画像は保存していない。

詳細は`summary.json`。8枚のWebPはPCと844x390のmix/pack前後のみ。32条件だった初稿から、通常表示のプレビュー不変・行非重複・一覧末尾focusを追加して最終38条件へ更新した。

## 未実施
実素材・同梱fontを使う本編画面、実機iPhone/Safari、実クリックでの制作フロー・SAVE/LOAD、AUTO/SKIP、全章/第1章試遊、実端末pinch zoomは未実施。Chromeのcoarse/touch emulationは端末実機の証明ではない。細かいpointer/window条件に該当しない端末や明示DS設定端末へは適用されない。

通信/試遊停止条件に従いsource commitには`[skip ci]`を付け、workflow/依存/browser installは起動しない。CIは未実施でありPASSとはしない。API非checkout経路のためlocal Git root/hooks検査は対象外。元blob/tree/最新main/claimと保存branch headをAPI照合して独立Draft PRへ保存する。
