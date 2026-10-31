# #2082 みんと営業5表情の顔を素(ura)ベースで描き直し
- 実施: Grok Bot（OpenAI Images API `/v1/images/edits` + 楕円マスク、`gpt-image-2.5-sunburst`）
- 土台: #2070 版の営業 normal/smile/sad/surprise/wink（#2078 の目修正は破棄）
- 参照: 素 ura_normal/ura_smile/ura_sad/ura_surprise（wink は ura_smile）
- 方針: 同じ人が演技でコンカフェをしているノリ。素と同じ細めで上品な目・顔立ち、表情は営業テンション
- 方法: `gen.py`。顔の楕円（目・鼻・口）だけ編集→その楕円だけ元画像へ合成。髪・衣装・ポーズ・配置は不変
- 候補: 各表情 c1〜c3。採用 normal=c2, smile=c2, sad=c3, surprise=c1, wink=c2
