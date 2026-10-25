# C.STATION柚ヶ谷店・DAY9試煙会の夜景

#929のDAY9は夜の固定イベント。#921で採用した柚ヶ谷店の客席を参照して、同じ店の夜景を制作しました。通常訪問用の昼背景・県大会ホールは変更していません。

![柚ヶ谷店・試煙会の夜景](../../../assets/backgrounds/bg_yuzugaya_c_station_night.webp)

- 参照：`assets/backgrounds/bg_yuzugaya_c_station.webp`（#921採用済み）。
- [無加工原画](c-station-source.png)：image_gen、1672×941、RGB、2026-10-26 JST。[生成指示](prompt.txt)。外部素材・実在ロゴなし。
- 本編：`assets/backgrounds/bg_yuzugaya_c_station_night.webp`、1280×720、WebP quality 92。原画をLanczosで縮小して変換。新規PNGの一覧再生成はせず、ネイティブWebP名のみmanifestのbackgroundsへ追加し、既存目録を保持。
- 接続：`CITY_BACKGROUNDS.c_station_night` → `C_STATION_TASTING_BG` → DAY9。旧イベントID・保存フラグ・報酬は維持。

制作前の構成：人物なし／使用中の台なし／背面の未使用展示機材は参照のまま／HMD・炭・ホース・吸い口の追加なし／同じ客席から右の駅前高架を見る夜の構図。青緑のソファ、木材、曲線カウンター、黒い天井、暖色の照明を維持。

目視で、窓外が夜、床の直射日光がないこと、客席とカウンターの配置、文字・人物・使用中の機材を追加していないことを確認。元の昼背景と画角にわずかな差はありますが、同じ支店として読める内装を保っています。明るい室内を維持し、本編のPC・横持ちブラウザで画像デコード・会話枠の収まり・途中LOAD・完読後の再生防止を確認しました。
