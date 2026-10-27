# I01 LIMEアイコン比較（未採用）

[実画像比較](compare.html) / [台帳](ledger.json)

対象は #1081 I01 のアダム・みんと（営業アカウント）・つむぎ。各2案、標準 image_gen による新規生成は6枚。ゲーム参照・manifest・既存画像を変更しない。原画の再保存・上書き・削除なし。表示は同じ原画をHTMLのCSSで縮小しており、派生画像の生成は不要。候補の選定後も本編採用は別途判断。

## 調査と既存成果

2026-10-27 UTC、最新main ed8098a9b0469f508fcca61964a00eebc567f918 の AGENTS、Issue本文と全11コメント、open PR全件、I01検索、LIMEアイコン関連PRを確認。Issue担当者なし。コメント6438577223はA向け提示だが実投入・開始・生成未確認。#942は交換UI、#188/#192/#194は既存顔アイコン、#795はひよりの位置補正で、今回の3人の設定アイコン制作ではない。公開情報だけを根拠に未制作とはしていない。

既存checkout /workspace/shisha-game（work、開始HEAD 872d8634）、worktree一覧（1件）、ローカルbranch一覧、stash（0）、未追跡（0）、追跡差分（0）、asset_sources、docs、shared/downloads、library-files、scratchを確認。同目的の保存済み候補は発見せず。既存顔アイコン3名分とつむぎタイトル絵は保全。商品用double_apple画像は包装を含む別用途のため再利用しない。別端末や接続されていないA環境の未push成果は確認できていない。

## 参照元

- `brand/character_profiles.md` アダム：ダブルアップル一筋の完璧主義。果実の対は画面左緑・右赤（髪の左右規則とは別）。
- `data/characters.json` tsumugi：21歳の芸大生。植物・動物・煙の混ざる絵。葉の耳と煙の尾の猫、ラベンダー。
- `data/dialogue/ch1_tsumugi.json`：窓辺で寝る猫、LIME交換時に煙の尾の猫が表示される台詞。
- 実見：`assets/sprites/characters/{adam,minto,tsumugi}/chr_*_normal.png`。
- 実見：`assets/ui/title_arts/title_art_tsumugi_02_tablet_cat.png`。本人が描く猫の既存表現。タイトル絵全体をアイコンに流用すると人物が主役になるため、作品モチーフのみ参照。
- 実見：`docs/qa/lime-reply-once-673/pc-after.png`、`docs/qa/lime-fit-774/pc-after.png`。
- `remake/css/daily.css`：.lime-face 32px/丸/cover/pixelated、.sm 28px、一覧42px。`remake/css/motions/lime.css`：交換136px、演出一覧52px。
- `remake/js/daily/phone.js`：limeNameとavatar。みんとの営業名「みんと＠ぺぱーみんと」と私用「栞」は別アカウント。今回は営業姿のみ。

## 比較と推奨

- アダムA：二果の対称構図。背景からの分離がよく、小さい状態で意味が最も伝わる。推奨。Bは店内静物の本人らしい距離感があるが、木目と煙は小サイズでは弱い。
- みんとA：高い位置のカメラ・ウインク。B：斜め顔・両目・落ち着いた微笑。両案とも黒髪、緑の目、営業衣装、成人の本人性を参照。ただし角の先端が原画上端で一部欠ける。Bを表情・目線の暫定推奨とするが、完全な装飾保持まで求める採用判定は保留。顔は切れていない。追加生成は6枚上限のため行わない。
- つむぎA：眠る猫の丸い構図。B：座る猫の縦の構図。Aは耳が通常の猫耳に寄り、葉が周辺装飾に移っているため設定一致で保留。Bは耳に葉が直接重なり、猫と煙の尾が明瞭なので推奨。両案とも装飾は予定より細かく、28pxでの可読性は未確認。

## 保存・制約

原画 originals/、プロンプトと生成元 evidence/generation.json、参照・生成数・sha256台帳 ledger.json、比較 compare.html。生成サービス側の原本 /workspace/generated_images も残す。クラウド内の既存認証・既存cloneを利用。ユーザー回線への素材転送、新規clone、新規ログイン、追加課金操作、権限変更は行わない。外部素材の追加なし。

画像内に名前なし。HTMLの名前は既存の表示名に合わせる。比較は候補を実寸で置いたローカル模擬表示であり、本編採用後の実プレイ受入ではない。最終本人性・採用選定はオーナー未確認。実行中モデル名とeffortはこの環境のツールから取得できず、指定値の実測確認はできていない。

## 検証結果

原画6枚を目視。HTMLの画像リンクは全件ローカル原画を参照。Chromiumでの比較ページ表示は file:// が ERR_BLOCKED_BY_ADMINISTRATOR で拒否されたため未確認。別経路への切替で迂回せず停止。スクリーンショットは保存されていない。実寸の丸型比較はHTMLとして用意したが、ブラウザ実表示の合格とは扱わない。
