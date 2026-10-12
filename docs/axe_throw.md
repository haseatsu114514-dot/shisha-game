# 斧投げミニゲーム（#480）

練習ページは remake/axe-throw.html。開発コンソールなしで遊べる。
生成済みの斧・木製ボード・専用背景（素材PR #478）を実際に表示し、
照準→構える→往復ゲージ中央で投げる、を3回行う。1投0〜6点、合計最大18点。
スマホ縦／横はタップと矢印、PCはマウス・方向キー・Space／Enterを使う。
Escape／「やめる」で中断、結果画面の「もう一度」で3投をやり直す。

リングと判定は共通のaxe-model.jsから描く。狙いと実際に止めた針だけで着地点を決める。
背景タブでは針・投擲時間を止め、復帰時の大きな進みを防ぐ。
動きを減らす設定では飛行の回転を省き、着地点と点数を表示する。
画像の実デコードを待ってから操作を開き、画像失敗時は再読込／中断ができる。

## 本編から呼ぶ

前段VNの終了を待ってから、js/minigames/axe.js の runAxeThrow({host, signal, reducedMotion}) をawaitする。
host省略時は既存stage、練習ページではaxe-app。同じhostへの二重呼び出しは同じPromiseを返す。
hostの既存DOMを消さず一時画面を重ね、終了・AbortSignal・host撤去で時計と入力を片付ける。
キーボードの焦点を一時画面に収め、閉じると元の操作へ戻す。

返り値は {completed, cancelled, throws, total, grade}。
各投はaim/timing/landing/score/precisionを持つ。
「終了」で受け取った3投のみcompleted=true。中断結果はcompleted=false、grade=null。
completedを確認した呼び出し元が後段VNを再生し、正式台本の読了後にだけ物語や報酬を処理する。

このモジュールと練習ページはセーブ・好感度・お金・体力・恋人／友人・LIME・行動枠を変更しない。
既存schemaを変更せず、練習の記録はページ内の表示だけ。
正式なひよりの素顔発覚・解禁・台本・報酬は後続の旧 #343。新規ゲームから後半章へ到達可能と扱わない。
素材の登録記録にあるminigame_connected=falseは#477登録時点の記録であり、
#480では斧・ボードをゲームから直接参照する。本編の正式イベント接続はまだ行っていない。

## 検証

- node --test remake/test/axe_throw.mjs：リング境界、照準とタイミング、最大点、不正数値、往復周期。
- node remake/test/browser/axe_throw.mjs：実PC／タッチ縦横／キーボード／動き軽減の3投・再挑戦・終了、
  背景停止、狙い直し、キーリピート／ダブルクリック、二重開始、事前Abort／host撤去、
  旧セーブ・実友人・恋人の関係／LIME／保存不変。
- node remake/test/browser/save_load.mjs：手動／自動・旧schema・保存UI。
- node --experimental-vm-modules remake/test/lime_consistency.mjs：既存受信・返信・予約の回帰。

CIは .github/workflows/axe-throw.yml。結果と実画面をartifactに保存する。
原画・実指示・SHA・可逆WebPは asset_sources/hiyori-axe-issue477/ に保存。
