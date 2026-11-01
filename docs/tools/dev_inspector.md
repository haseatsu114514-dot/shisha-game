# 開発者向けイベント・状態インスペクター

ブラウザの開発者ツールのコンソールから利用できます。ゲーム起動・データ読込後に実行してください。

```js
__remake.inspect.snapshot()             // 章・日付・ステータス・フラグなどのコピー
__remake.inspect.events("mashiro")      // イベントIDを検索（既定100件・最大500件）
__remake.inspect.events("ch1", 200)     // 件数指定
__remake.inspect.eventInfo("ch1_start") // イベントの概要。存在しないIDはnull
__remake.inspect.exportSnapshot()       // 状態のJSON文字列（セーブ本体ではない）
```

この機能は読み取り専用です。スナップショットを変更しても実際のゲーム状態やセーブデータは変わりません。イベントの再生・日付変更・フラグ変更は行いません。

既存の `__remake.dev` にはセーブを書き換える操作があります。用途が違うので混同しないでください。

テスト: `node remake/test/dev_inspector.mjs`。

注意: スナップショットにはゲームの進行情報が含まれます。公開バグ報告へ貼る前に内容を確認してください。
