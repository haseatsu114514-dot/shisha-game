# くじ限定の特注台3種・原画候補（#3019）

Codex内蔵生成、2026-11-11。過去の納品記録はwork/配下で、mainに該当画像がなく、imgstockのremote branchも見つからず、この環境にも実体がないため、現在採用済みの特注台から再制作しました。

- stand_custom_melty: ピンクとレオパード柄。下の管が見える透明ガラスを維持。
- stand_custom_tosu: 橙の色が溶け込むガラスベース。金属部は元の真鍮のまま。
- stand_custom_engraved: 真鍮ステムに小さな「逢縁」の2字を縦に刻む（指定の文字だけ例外）。

3枚とも stand_custom.png を形・画風・光の正本にし、siryouの日本の店の実写を接続と縮尺の参照に渡しました。実物写真は同梱していません。生成前8行、全文プロンプト、参照パス・SHA、原画の実寸・bytes・SHAは同梱。原画は無加工、candidates/は512角への比例縮小だけ。

原寸とcomparison.jpgで、上部の皿、裸の凸型ポスト、ステムがベースの口に入ること、内部の管、ホース接続口と別のパージ弁を確認。ボウル・HMD・炭・ホース・人物なし。名入れの2字も拡大して確認。原画はRGBA、全体入り、四隅透過、デコード・寸法・SHAを確認しました。

原画にはごく薄いalpha画素が残るため、採用前に境界処理または確認が必要です。既存の台・ゲームコード・データ・配信用画像は変更していません。オーナー選別後に組み込みと実画面検証を行う範囲です。API保存のためローカルcheckout/root/hooks検査は対象外、ゲームのテストも未実施です。

## 採用と組み込み（2026-11-11）

オーナーが3種とも採用した。`asset_sources/premium-equipment-vol08/sources.json` に登録し、`python3 tools/build_shop_equipment_art.py` で店とくじの札の絵（`remake/img/shop/equipment-v2/stand_custom_{melty,tosu,engraved}.webp`）を作った。自室に置いたときの絵は、今は元の特注台と同じ。
