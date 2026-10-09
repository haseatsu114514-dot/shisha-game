#!/usr/bin/env python3
"""街歩き（栄・大須風の架空の街）の構図ガイドを描く。

設計: docs/street_city_design.md ／ 発注書: docs/codex_handoff_city_images.md
出力（asset_sources/images/proto_city/layout/）:
  - <通り>_p<n>.png        Codex に渡す構図ガイド（文字なし・色の塊だけ・1024x576）
  - <通り>_overview.png    オーナー確認用（3枚を横に並べ、番号と説明つき）
  - city_map.png           既存の街マップ（bg_osu_map_day）に通りの位置を重ねた図

パネルの比率は「ハリボテ背景版」（docs/codex_handoff_street_set_images.md）と同じ:
建物の足元 0.69H／歩ける帯 0.69〜0.93H／縁石 0.93〜0.95H／キャラ 0.20H／ドア 0.24H。
x・y は画像の幅・高さに対する割合。

使い方: python3 tools/proto_city_layout_guides.py
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "asset_sources/images/proto_city/layout"
MAP_BG = ROOT / "assets/backgrounds/bg_osu_map_day.png"
FONT_CANDIDATES = [
    "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",
    str(ROOT / "assets/fonts/DotGothic16-Regular.ttf"),
]

G = 0.69      # 建物の足元（歩道との境目）
WALK = 0.93   # 歩ける帯の下端
CURB = 0.95   # 縁石の下端
CHAR_H = 0.20
DOOR_H = 0.24

COL = {
    "sky": (207, 230, 245), "far": (176, 190, 210), "landmark": (222, 120, 104),
    "park": (150, 190, 140), "roof": (240, 228, 180), "roof_hi": (250, 240, 205),
    "girder": (120, 120, 130), "bldg": (227, 201, 160), "tall": (210, 184, 145),
    "sign": (246, 240, 222), "door": (96, 60, 34), "door_x": (150, 132, 116),
    "link": (56, 182, 201), "gap": (160, 182, 154), "water": (110, 160, 200),
    "sidewalk": (190, 190, 190), "stone": (201, 194, 181), "arcade": (204, 192, 172),
    "plaza": (214, 204, 186), "promenade": (196, 186, 170), "lane": (150, 148, 144),
    "curb": (228, 228, 228), "road": (100, 100, 104), "near": (150, 136, 120),
    "willow": (120, 160, 110), "prop": (224, 91, 208), "char": (40, 40, 52),
}

# ---------------------------------------------------------------- 通りとパネル
# 各ブロック: (種類, x0, x1, 上端y, 下端y, 説明)。下端を省くと建物の足元 G まで。
# 種類 door は入れる入口（黄色の縁）、door_x は入れない店の戸、link は別の通りへつながる口。
# ground: (x0, x1, 地面の種類)。bottom: 歩ける帯より下（0.93H〜）の扱い。
# props: (x, 説明) … ゲーム側が別画像で置く小物・人の位置（パネルには描かない）。
# char: キャラの縮尺の目安（0.20H）を立たせる x。

STREETS = [
    {
        "id": "kannon_arcade", "name": "観音商店街（大須・アーケード）", "phase": 1,
        "panels": [
            {
                "title": "P1 観音堂の門前",
                "blocks": [
                    ("sky", 0.00, 0.53, 0.00, G, ""),
                    ("landmark", 0.06, 0.46, 0.04, 0.58, "観音堂の本堂（奥に大きく。朱の柱と二重の屋根）"),
                    ("bldg", 0.15, 0.38, 0.30, G, "山門風の門（大提灯・文字なし）"),
                    ("door", 0.225, 0.305, 0.36, G, "観音堂へ入る口（門の中）"),
                    ("gap", 0.00, 0.05, 0.30, G, "左端：境内の植え込み（通りの西の端）"),
                    ("roof", 0.53, 1.00, 0.00, 0.14, "アーケードの屋根（骨は幅の1/8ごと）"),
                    ("bldg", 0.48, 0.58, 0.10, G, "アーケードの入口アーチ（無地）"),
                    ("bldg", 0.58, 0.77, 0.14, G, "和菓子屋（無地ののれん）"),
                    ("sign", 0.60, 0.75, 0.30, 0.36, ""),
                    ("door_x", 0.655, 0.705, G - DOOR_H, G, ""),
                    ("bldg", 0.77, 0.95, 0.14, G, "煎餅・あられ屋（量り売りのガラスケース）"),
                    ("sign", 0.79, 0.93, 0.30, 0.36, ""),
                    ("door_x", 0.84, 0.89, G - DOOR_H, G, ""),
                    ("gap", 0.95, 1.00, 0.14, G, "右端：細い路地（屋根は続く）"),
                ],
                "ground": [(0.00, 0.50, "stone"), (0.50, 1.00, "arcade")],
                "bottom": "near",
                "props": [(0.11, "のぼり旗"), (0.30, "鳩"), (0.41, "のぼり旗")],
                "char": 0.52,
            },
            {
                "title": "P2 アーケードの中ほど",
                "blocks": [
                    ("roof", 0.00, 1.00, 0.00, 0.14, ""),
                    ("gap", 0.00, 0.05, 0.14, G, ""),
                    ("bldg", 0.05, 0.30, 0.14, G, "ゲームセンター（ガラス張り・中にクレーンゲーム）"),
                    ("sign", 0.07, 0.28, 0.24, 0.31, ""),
                    ("door", 0.13, 0.22, G - DOOR_H, G, "ゲームセンターの自動ドア"),
                    ("gap", 0.30, 0.40, 0.14, G, "路地の口（奥へ細い路地。室外機と鉢植え）"),
                    ("bldg", 0.40, 0.62, 0.14, G, "食べ歩きの屋台店（カウンター窓・湯気）"),
                    ("sign", 0.42, 0.60, 0.28, 0.34, ""),
                    ("door_x", 0.44, 0.58, 0.50, 0.60, "持ち帰りのカウンター窓"),
                    ("bldg", 0.62, 0.95, 0.14, G, "古着屋（2階建て・ガラス越しに服とマネキン）"),
                    ("sign", 0.65, 0.92, 0.27, 0.33, ""),
                    ("door_x", 0.76, 0.81, G - DOOR_H, G, ""),
                    ("gap", 0.95, 1.00, 0.14, G, ""),
                ],
                "ground": [(0.00, 1.00, "arcade")],
                "bottom": "near",
                "props": [(0.27, "ガチャガチャ"), (0.35, "占いの出店（週2日）"), (0.67, "ベンチ")],
                "char": 0.50,
            },
            {
                "title": "P3 招き猫の十字路",
                "blocks": [
                    ("roof", 0.00, 0.25, 0.00, 0.14, ""),
                    ("roof_hi", 0.25, 0.55, 0.00, 0.10, "十字路の高い屋根（天窓）"),
                    ("bldg", 0.25, 0.55, 0.10, 0.20, ""),
                    ("roof", 0.55, 0.88, 0.00, 0.14, ""),
                    ("gap", 0.00, 0.05, 0.14, G, ""),
                    ("bldg", 0.05, 0.25, 0.14, G, "電子部品・中古パソコンの店"),
                    ("sign", 0.07, 0.23, 0.27, 0.33, ""),
                    ("door_x", 0.12, 0.17, G - DOOR_H, G, ""),
                    ("bldg", 0.25, 0.30, 0.14, G, ""),
                    ("link", 0.30, 0.50, 0.20, G, "北のアーケードが奥へ続く口 → 栄方面"),
                    ("bldg", 0.50, 0.55, 0.14, G, ""),
                    ("bldg", 0.55, 0.85, 0.14, G, "からくり人形の舞台がある寺の門（舞台の扉は閉じている）"),
                    ("sign", 0.64, 0.76, 0.22, 0.34, "からくりの舞台"),
                    ("door_x", 0.67, 0.73, 0.42, G, ""),
                    ("bldg", 0.85, 0.88, 0.14, G, ""),
                    ("link", 0.88, 1.00, 0.14, G, "アーケードの東口（外は明るい）→ 東の商店街"),
                ],
                "ground": [(0.00, 0.22, "arcade"), (0.22, 0.58, "plaza"), (0.58, 1.00, "arcade")],
                "bottom": "near",
                "props": [(0.40, "招き猫の像（台座ごと別画像。ここは空ける）"), (0.20, "鳩")],
                "char": 0.24,
            },
        ],
    },
    {
        "id": "sakae_hankagai", "name": "繁華街（栄・雑居ビル街）", "phase": 3,
        "panels": [
            {
                "title": "P1 地下への口と喫茶",
                "blocks": [
                    ("sky", 0.00, 1.00, 0.00, G, ""),
                    ("gap", 0.00, 0.05, 0.10, G, ""),
                    ("tall", 0.05, 0.22, 0.00, G, "ビル1階の地下鉄・地下街への階段口"),
                    ("link", 0.08, 0.19, 0.46, G, "地下への階段（将来：地下街）"),
                    ("tall", 0.22, 0.55, 0.00, G, "喫茶（レンガのビルの角・赤い日除け・奥まったテラス席）"),
                    ("sign", 0.24, 0.53, 0.38, 0.43, "赤い日除け"),
                    ("door", 0.44, 0.50, G - DOOR_H, G, "喫茶の入口"),
                    ("tall", 0.55, 0.95, 0.00, G, "明るいドラッグストア風の店＋上の階に縦長の袖看板が何段も"),
                    ("sign", 0.86, 0.90, 0.05, 0.40, "袖看板（無地）"),
                    ("door_x", 0.66, 0.74, G - DOOR_H, G, ""),
                    ("gap", 0.95, 1.00, 0.10, G, ""),
                ],
                "ground": [(0.00, 1.00, "sidewalk")],
                "bottom": "road",
                "props": [(0.33, "テラス席の丸テーブル"), (0.60, "街路樹")],
                "char": 0.58,
            },
            {
                "title": "P2 PEPPERMINT と観覧車",
                "blocks": [
                    ("sky", 0.00, 1.00, 0.00, G, ""),
                    ("gap", 0.00, 0.05, 0.10, G, ""),
                    ("tall", 0.05, 0.40, 0.00, G, "雑居ビル1階の PEPPERMINT（ミントとピンク・レンガの腰壁・アーチ窓）"),
                    ("sign", 0.08, 0.37, 0.36, 0.42, ""),
                    ("door", 0.25, 0.31, G - DOOR_H, G, "PEPPERMINT の入口"),
                    ("far", 0.40, 0.55, 0.30, G, "ビルの隙間（遠くの街）"),
                    ("landmark", 0.42, 0.53, 0.06, 0.52, "観覧車が壁に付いたビル（遠景）"),
                    ("tall", 0.55, 0.95, 0.00, G, "カラオケ・飲食の雑居ビル（縦の袖看板）"),
                    ("sign", 0.58, 0.62, 0.04, 0.40, "袖看板"),
                    ("door_x", 0.72, 0.79, G - DOOR_H, G, ""),
                    ("gap", 0.95, 1.00, 0.10, G, ""),
                ],
                "ground": [(0.00, 1.00, "sidewalk")],
                "bottom": "road",
                "props": [(0.20, "立て看板"), (0.47, "自販機")],
                "char": 0.36,
            },
            {
                "title": "P3 ジムのビルと交差点",
                "blocks": [
                    ("sky", 0.00, 1.00, 0.00, G, ""),
                    ("gap", 0.00, 0.05, 0.10, G, ""),
                    ("tall", 0.05, 0.45, 0.00, G, "チョイザップの入る雑居ビル（2階の窓にランニングマシン）＋1階はコンビニ風"),
                    ("sign", 0.07, 0.43, 0.24, 0.36, "2階のジムの窓（黄緑の差し色）"),
                    ("door", 0.08, 0.14, G - DOOR_H, G, "ジムへの階段口"),
                    ("door_x", 0.27, 0.40, G - DOOR_H, G, "コンビニ風（入れない）"),
                    ("far", 0.45, 0.60, 0.30, G, ""),
                    ("landmark", 0.49, 0.56, 0.02, 0.58, "テレビ塔（遠景）"),
                    ("tall", 0.60, 0.90, 0.00, G, "石張りの大きなビル"),
                    ("link", 0.90, 1.00, 0.20, CURB, "交差点の角（横断歩道）→ 公園大通り"),
                ],
                "ground": [(0.00, 1.00, "sidewalk")],
                "bottom": "road",
                "props": [(0.20, "自転車"), (0.52, "バス停")],
                "char": 0.70,
            },
        ],
    },
    {
        "id": "koen_odori", "name": "公園大通り（栄・テレビ塔の公園）", "phase": 3,
        "panels": [
            {
                "title": "P1 C.STATION 本店",
                "blocks": [
                    ("sky", 0.00, 1.00, 0.00, G, ""),
                    ("gap", 0.00, 0.05, 0.10, G, ""),
                    ("tall", 0.05, 0.50, 0.00, G, "C.STATION 本店ビル（ガラスのカーテンウォール・上の階は切れてよい）"),
                    ("sign", 0.10, 0.45, 0.32, 0.38, "2階の大きな無地の看板"),
                    ("door", 0.24, 0.34, G - DOOR_H - 0.02, G, "C.STATION の入口（自動ドア・少し広め）"),
                    ("park", 0.50, 0.95, 0.35, G, "公園の入口：低い植え込みと並木・奥へ続く石の小道"),
                    ("gap", 0.95, 1.00, 0.30, G, ""),
                ],
                "ground": [(0.00, 1.00, "promenade")],
                "bottom": "road",
                "props": [(0.55, "街路樹"), (0.72, "ベンチ")],
                "char": 0.42,
            },
            {
                "title": "P2 テレビ塔",
                "blocks": [
                    ("sky", 0.00, 1.00, 0.00, G, ""),
                    ("far", 0.10, 0.25, 0.30, 0.48, "奥のビル群"),
                    ("far", 0.75, 0.92, 0.28, 0.48, "奥のビル群"),
                    ("park", 0.00, 1.00, 0.42, G, "芝生と並木（奥）"),
                    ("landmark", 0.40, 0.60, 0.02, 0.64, "テレビ塔（鉄骨の格子・展望台・4本脚の下は広場）"),
                ],
                "ground": [(0.00, 1.00, "promenade")],
                "bottom": "road",
                "props": [(0.25, "ストリートミュージシャン"), (0.70, "ベンチ"), (0.85, "街灯")],
                "char": 0.30,
            },
            {
                "title": "P3 ガラスの屋根の広場",
                "blocks": [
                    ("sky", 0.00, 1.00, 0.00, G, ""),
                    ("park", 0.00, 0.25, 0.40, G, "並木"),
                    ("landmark", 0.25, 0.85, 0.22, 0.36, "楕円のガラスの屋根（上に水が張ってある・細い柱で浮く）"),
                    ("park", 0.25, 0.85, 0.46, G, "屋根の下の広場（奥は一段下がる）"),
                    ("link", 0.45, 0.65, 0.58, G, "下の広場へ下りる階段（将来：地下街・バス）"),
                    ("park", 0.85, 1.00, 0.40, G, "並木（通りの終わり）"),
                ],
                "ground": [(0.00, 1.00, "promenade")],
                "bottom": "road",
                "props": [(0.20, "ベンチ"), (0.88, "街灯")],
                "char": 0.36,
            },
        ],
    },
    {
        "id": "higashi_shotengai", "name": "東の商店街（大須・屋根なし→商店街の外れ）", "phase": 2,
        "panels": [
            {
                "title": "P1 アーケードの東口の外",
                "blocks": [
                    ("sky", 0.00, 1.00, 0.00, G, ""),
                    ("link", 0.00, 0.14, 0.10, G, "アーケードの東口（外から見た姿）→ 観音商店街"),
                    ("bldg", 0.16, 0.38, 0.22, G, "たい焼き屋（カウンター窓・無地ののれん）"),
                    ("door_x", 0.20, 0.34, 0.50, 0.60, ""),
                    ("far", 0.38, 0.46, 0.25, G, "遠くに栄のビル群とテレビ塔の先"),
                    ("bldg", 0.46, 0.72, 0.18, G, "古道具・骨董の店"),
                    ("door_x", 0.56, 0.61, G - DOOR_H, G, ""),
                    ("bldg", 0.72, 0.95, 0.24, G, "コインランドリー"),
                    ("door_x", 0.80, 0.86, G - DOOR_H, G, ""),
                    ("gap", 0.95, 1.00, 0.20, G, ""),
                ],
                "ground": [(0.00, 1.00, "sidewalk")],
                "bottom": "road",
                "props": [(0.42, "自販機"), (0.66, "自転車")],
                "char": 0.55,
            },
            {
                "title": "P2 tonari のビル",
                "blocks": [
                    ("sky", 0.00, 1.00, 0.00, G, ""),
                    ("gap", 0.00, 0.05, 0.20, G, ""),
                    ("bldg", 0.05, 0.20, 0.20, G, "古い民家"),
                    ("tall", 0.22, 0.62, 0.00, G, "tonari のビル（4階建ての古いコンクリ・2階に大きな窓と暖かい灯り）"),
                    ("sign", 0.26, 0.52, 0.30, 0.42, "2階の店の窓（カーテン・ランプ）"),
                    ("door_x", 0.29, 0.38, G - DOOR_H, G, "1階のシャッター"),
                    ("door", 0.53, 0.60, G - DOOR_H, G, "右脇の外階段の上り口（tonari へ）"),
                    ("bldg", 0.65, 0.95, 0.18, G, "町の酒屋"),
                    ("far", 0.80, 0.83, 0.02, 0.18, "奥に銭湯の煙突"),
                    ("gap", 0.95, 1.00, 0.20, G, ""),
                ],
                "ground": [(0.00, 1.00, "sidewalk")],
                "bottom": "road",
                "props": [(0.45, "黒板の立て看板"), (0.63, "植木鉢")],
                "char": 0.70,
            },
            {
                "title": "P3 商店街の外れ",
                "blocks": [
                    ("sky", 0.00, 1.00, 0.00, G, ""),
                    ("gap", 0.00, 0.05, 0.20, G, ""),
                    ("bldg", 0.05, 0.30, 0.20, G, "シャッターの下りた店（2階に室外機）"),
                    ("gap", 0.30, 0.55, 0.50, G, "ブロック塀の空き地"),
                    ("bldg", 0.55, 0.90, 0.18, G, "KEMURIKUSA（黒い木と漆喰・丸窓・軒先のランタン）"),
                    ("door", 0.80, 0.86, G - DOOR_H, G, "KEMURIKUSA の入口"),
                    ("gap", 0.90, 1.00, 0.50, G, "ブロック塀（通りの終わり）"),
                    ("link", 0.90, 1.00, WALK, 1.00, "手前の路地 → 下町"),
                ],
                "ground": [(0.00, 1.00, "sidewalk")],
                "bottom": "road",
                "props": [(0.42, "自転車"), (0.88, "植木鉢")],
                "char": 0.66,
            },
        ],
    },
    {
        "id": "ekimae_tonya", "name": "駅前〜問屋街", "phase": 4,
        "panels": [
            {
                "title": "P1 駅前の高架下",
                "blocks": [
                    ("sky", 0.00, 1.00, 0.20, G, ""),
                    ("girder", 0.00, 1.00, 0.00, 0.22, "鉄道の高架（桁が画面の上を横切る）"),
                    ("bldg", 0.23, 0.27, 0.22, G, "高架の柱"),
                    ("bldg", 0.68, 0.72, 0.22, G, "高架の柱"),
                    ("link", 0.05, 0.22, 0.30, G, "駅の改札口（奥）"),
                    ("bldg", 0.30, 0.65, 0.22, G, "高架下の飲み屋（昼はシャッター）"),
                    ("door_x", 0.40, 0.46, G - DOOR_H, G, ""),
                    ("gap", 0.95, 1.00, 0.22, G, ""),
                ],
                "ground": [(0.00, 1.00, "sidewalk")],
                "bottom": "road",
                "props": [(0.80, "自転車置き場")],
                "char": 0.82,
            },
            {
                "title": "P2 問屋ビルの並び",
                "blocks": [
                    ("sky", 0.00, 1.00, 0.00, G, ""),
                    ("gap", 0.00, 0.05, 0.10, G, ""),
                    ("tall", 0.05, 0.48, 0.12, G, "古い問屋ビル（巻き上げシャッター半開き・中に段ボール）"),
                    ("door_x", 0.15, 0.38, 0.47, G, ""),
                    ("tall", 0.50, 0.95, 0.08, G, "壁画のある問屋ビル"),
                    ("door_x", 0.70, 0.76, G - DOOR_H, G, ""),
                    ("gap", 0.95, 1.00, 0.10, G, ""),
                ],
                "ground": [(0.00, 1.00, "sidewalk")],
                "bottom": "road",
                "props": [(0.30, "台車と段ボール"), (0.86, "丸ポスト")],
                "char": 0.48,
            },
            {
                "title": "P3 Dr.fookah",
                "blocks": [
                    ("sky", 0.00, 1.00, 0.00, G, ""),
                    ("gap", 0.00, 0.05, 0.10, G, ""),
                    ("tall", 0.05, 0.62, 0.06, G, "Dr.fookah（古い問屋ビルを改装）"),
                    ("sign", 0.08, 0.59, 0.20, 0.34, "2階：ショールームの窓（ペルシャ絨毯・ランプ）"),
                    ("sign", 0.08, 0.59, 0.40, 0.45, "1階：レンガと黒い鉄枠の大きなガラス"),
                    ("door", 0.40, 0.46, G - DOOR_H, G, "Dr.fookah の入口"),
                    ("gap", 0.62, 0.80, 0.30, G, ""),
                    ("link", 0.80, 1.00, 0.55, G, "川へ下りる階段 → 川沿いの遊歩道"),
                ],
                "ground": [(0.00, 1.00, "sidewalk")],
                "bottom": "road",
                "props": [(0.20, "台車と段ボール"), (0.70, "街灯")],
                "char": 0.68,
            },
        ],
    },
    {
        "id": "shitamachi", "name": "下町の路地", "phase": 4,
        "panels": [
            {
                "title": "P1 長屋と EDEN",
                "blocks": [
                    ("sky", 0.00, 1.00, 0.00, G, ""),
                    ("bldg", 0.05, 0.35, 0.25, G, "長屋（軒先に鉢植えがぎっしり）"),
                    ("door_x", 0.16, 0.21, G - DOOR_H, G, ""),
                    ("bldg", 0.38, 0.70, 0.20, G, "EDEN（古い2階家を改装・窓にモロッコ風ランプ・深紅の扉）"),
                    ("door", 0.55, 0.61, G - DOOR_H, G, "EDEN の入口"),
                    ("bldg", 0.75, 0.85, 0.50, G, "小さな祠"),
                    ("gap", 0.95, 1.00, 0.30, G, ""),
                ],
                "ground": [(0.00, 1.00, "lane")],
                "bottom": "near",
                "props": [(0.28, "鉢植えの群れ"), (0.90, "猫")],
                "char": 0.47,
            },
            {
                "title": "P2 銭湯と自宅",
                "blocks": [
                    ("sky", 0.00, 1.00, 0.00, G, ""),
                    ("bldg", 0.05, 0.45, 0.15, G, "銭湯（高い煙突・のれん）"),
                    ("far", 0.36, 0.40, 0.00, 0.15, "煙突"),
                    ("door_x", 0.20, 0.30, G - DOOR_H, G, ""),
                    ("bldg", 0.50, 0.95, 0.22, G, "自宅のアパート（2階建て・外階段・郵便受け）"),
                    ("door", 0.80, 0.86, G - DOOR_H, G, "自宅へ"),
                    ("gap", 0.95, 1.00, 0.30, G, ""),
                ],
                "ground": [(0.00, 1.00, "lane")],
                "bottom": "near",
                "props": [(0.47, "縁台"), (0.62, "自転車")],
                "char": 0.70,
            },
        ],
    },
    {
        "id": "kawazoi", "name": "川沿いの遊歩道", "phase": 4,
        "panels": [
            {
                "title": "P1 対岸の倉庫",
                "blocks": [
                    ("sky", 0.00, 1.00, 0.00, 0.45, ""),
                    ("far", 0.00, 1.00, 0.18, 0.45, "対岸の古い倉庫と低いビル"),
                    ("water", 0.00, 1.00, 0.45, 0.66, "川（ゆっくり流れる・水面に空が映る）"),
                    ("bldg", 0.00, 1.00, 0.66, G, "石積みの護岸と低い柵"),
                ],
                "ground": [(0.00, 1.00, "promenade")],
                "bottom": "near",
                "props": [(0.30, "ベンチ"), (0.70, "柳（前景）")],
                "char": 0.50,
            },
            {
                "title": "P2 飾りのある古い橋",
                "blocks": [
                    ("sky", 0.00, 1.00, 0.00, 0.45, ""),
                    ("far", 0.00, 1.00, 0.18, 0.45, "対岸"),
                    ("water", 0.00, 1.00, 0.45, 0.66, ""),
                    ("landmark", 0.30, 0.75, 0.30, 0.50, "装飾のある古い橋（欄干にレリーフ・街灯）"),
                    ("bldg", 0.00, 1.00, 0.66, G, ""),
                ],
                "ground": [(0.00, 1.00, "promenade")],
                "bottom": "near",
                "props": [(0.20, "街灯"), (0.85, "ベンチ")],
                "char": 0.55,
            },
        ],
    },
]

# 既存の街マップ（bg_osu_map_day・1280x720）に重ねる通りの線（%）。ランドマークの位置に合わせた目安
MAP_LINES = {
    "kannon_arcade": [(24, 57), (41, 54), (52, 48)],
    "higashi_shotengai": [(52, 48), (66, 57), (74, 66)],
    "kita_arcade": [(52, 48), (58, 40), (64, 31)],
    "sakae_hankagai": [(64, 31), (69, 26), (73, 22)],
    "koen_odori": [(73, 22), (79, 15), (90, 17)],
    "ekimae_tonya": [(36, 30), (27, 20), (16, 13)],
    "kawazoi": [(16, 13), (8, 22)],
    "shitamachi": [(42, 74), (52, 80), (62, 86)],
}
LINE_COL = {1: (255, 214, 64), 2: (255, 150, 60), 3: (90, 220, 255), 4: (255, 255, 255), "D": (200, 140, 255)}


def font(size: int):
    for path in FONT_CANDIDATES:
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default()


def draw_panel(panel: dict, w: int, h: int, labels: bool):
    """1枚分の構図ガイド。labels=True なら番号を振り、説明の一覧を返す。"""
    im = Image.new("RGB", (w, h), COL["sky"])
    d = ImageDraw.Draw(im)
    X = lambda f: round(f * w)
    Y = lambda f: round(f * h)
    notes = []

    def number(x, y, text):
        n = len(notes) + 1
        notes.append(f"{n}. {text}")
        if labels:
            r = max(9, h // 30)
            d.ellipse([x - r, y - r, x + r, y + r], fill=(30, 30, 30), outline=(255, 255, 255), width=2)
            f = font(int(r * 1.2))
            d.text((x, y), str(n), fill=(255, 255, 255), font=f, anchor="mm")

    # 地面（歩ける帯）と帯より下
    for x0, x1, kind in panel["ground"]:
        d.rectangle([X(x0), Y(G), X(x1), Y(WALK)], fill=COL[kind])
    bottom = panel["bottom"]
    if bottom == "road":
        d.rectangle([0, Y(WALK), w, Y(CURB)], fill=COL["curb"])
        d.rectangle([0, Y(CURB), w, h], fill=COL["road"])
    else:
        d.rectangle([0, Y(WALK), w, h], fill=COL[bottom])
    # 点字ブロックの列（歩道のみ・目安）
    for x0, x1, kind in panel["ground"]:
        if kind == "sidewalk":
            d.rectangle([X(x0), Y(0.80), X(x1), Y(0.81)], fill=(236, 196, 70))

    labelled = []
    for k, x0, x1, y0, y1, text in panel["blocks"]:
        box = [X(x0), Y(y0), X(x1), Y(y1)]
        if k in ("roof", "roof_hi"):
            d.rectangle(box, fill=COL[k])
            step = w / 8
            i = 0
            while i * step <= w:
                rx = round(i * step)
                if box[0] <= rx <= box[2]:
                    d.line([rx, box[1], rx, box[3]], fill=(170, 150, 110), width=max(2, w // 300))
                i += 1
        elif k == "link":
            d.rectangle(box, fill=COL[k], outline=(255, 255, 255), width=max(2, w // 400))
            cx, cy = (box[0] + box[2]) // 2, (box[1] + box[3]) // 2
            a = max(8, (box[2] - box[0]) // 6)
            d.polygon([(cx - a, cy + a // 2), (cx + a, cy + a // 2), (cx, cy - a)], fill=(255, 255, 255))
        elif k == "door":
            d.rectangle(box, fill=COL[k], outline=(255, 214, 64), width=max(3, w // 250))
        else:
            d.rectangle(box, fill=COL[k], outline=(120, 110, 100) if k in ("bldg", "tall") else None)
        if text:
            # 建物・景色は上寄り、入口・看板・つながる口は真ん中に番号を置く（重なりにくくする）
            cy = box[1] + round(h * 0.07) if k in ("bldg", "tall", "landmark", "park", "far") else (box[1] + box[3]) // 2
            labelled.append(((box[0] + box[2]) // 2, min(cy, box[3] - h // 30), text))

    # 小物・人の置き場（ゲーム側が別画像で置く。パネルには描かない）
    for px, text in panel["props"]:
        cx, cy, r = X(px), Y(0.74), max(6, h // 40)
        d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=COL["prop"], width=max(2, w // 400))
        if labels:
            labelled.append((cx, cy - r * 2, f"（置き場）{text}"))

    # キャラの縮尺（0.20H）
    cx = X(panel["char"])
    foot = Y(0.80)
    cw = round(h * CHAR_H * 0.38)
    d.rounded_rectangle([cx - cw // 2, foot - Y(CHAR_H), cx + cw // 2, foot], radius=cw // 2, fill=COL["char"])
    if labels:
        labelled.append((cx, foot - Y(CHAR_H) // 2, "キャラの身長の目安（0.20H）"))
        # 建物の足元の線
        d.line([0, Y(G), w, Y(G)], fill=(220, 40, 40), width=2)
        for x, y, text in labelled:
            number(x, y, text)
    return im, notes


def overview(street: dict):
    pw, ph = 640, 360
    panels = street["panels"]
    images, notes = [], []
    for p in panels:
        im, n = draw_panel(p, pw, ph, labels=True)
        images.append(im)
        notes.append((p["title"], n))
    f_title, f_body = font(26), font(17)
    lines = max(len(n) for _, n in notes)
    sheet_h = 56 + ph + 40 + lines * 24 + 70
    sheet = Image.new("RGB", (pw * len(panels) + 20 * (len(panels) + 1), sheet_h), (250, 248, 242))
    d = ImageDraw.Draw(sheet)
    d.text((20, 14), f"{street['name']}　Phase {street['phase']}", fill=(30, 30, 30), font=f_title)
    for i, im in enumerate(images):
        x = 20 + i * (pw + 20)
        sheet.paste(im, (x, 56))
        d.text((x, 56 + ph + 8), notes[i][0], fill=(30, 30, 30), font=font(20))
        for j, line in enumerate(notes[i][1]):
            d.text((x, 56 + ph + 40 + j * 24), line, fill=(50, 50, 50), font=f_body)
    legend = "黄色の枠＝入れる入口 ／ 水色＋矢印＝別の通りへつながる口 ／ 赤い線＝建物の足元（0.69H）／ ピンクの丸＝小物・人の置き場（パネルに描かない）／ 黒いカプセル＝キャラの身長の目安"
    d.text((20, sheet_h - 40), legend, fill=(90, 90, 90), font=font(16))
    return sheet


def city_map():
    base = Image.open(MAP_BG).convert("RGB")
    w, h = base.size
    scrim = Image.new("RGB", base.size, (20, 22, 30))
    im = Image.blend(base, scrim, 0.45)
    d = ImageDraw.Draw(im)
    f = font(22)
    names = {s["id"]: (s["name"], s["phase"]) for s in STREETS}
    names[DEPTH["id"]] = (DEPTH["name"], "D")
    for sid, pts in MAP_LINES.items():
        name, phase = names[sid]
        xy = [(x * w / 100, y * h / 100) for x, y in pts]
        d.line(xy, fill=(0, 0, 0), width=14, joint="curve")
        d.line(xy, fill=LINE_COL[phase], width=8, joint="curve")
        for x, y in (xy[0], xy[-1]):
            d.ellipse([x - 9, y - 9, x + 9, y + 9], fill=LINE_COL[phase], outline=(0, 0, 0), width=3)
        mx, my = xy[len(xy) // 2]
        label = f"{name}"
        tb = d.textbbox((mx, my - 26), label, font=f, anchor="mm")
        d.rectangle([tb[0] - 6, tb[1] - 4, tb[2] + 6, tb[3] + 4], fill=(0, 0, 0))
        d.text((mx, my - 26), label, fill=LINE_COL[phase], font=f, anchor="mm")
    legend = [("Phase 1 大須観音・アーケード（必須）", 1), ("Phase 2 東の商店街（必須）", 2), ("Phase 3 栄", 3), ("Phase 4 問屋街・下町・川沿い", 4), ("奥行きの通り（テスト）", "D")]
    y = h - 40 * len(legend) - 10
    d.rectangle([8, y - 8, 490, h - 6], fill=(0, 0, 0))
    for text, phase in legend:
        d.rectangle([20, y + 8, 64, y + 18], fill=LINE_COL[phase])
        d.text((76, y), text, fill=(255, 255, 255), font=f)
        y += 40
    return im


# ---------------------------------------------------------------- 奥行きの通り（一点透視の区画）
# 1区画＝一点透視の1枚絵。全区画で同じ幾何にする（区画を切り替えても床・壁・屋根の線が動かない）。
# 奥行き d（手前の歩ける端 d=1）。床の y は 地平線 + NEAR_DROP / d、キャラの身長は CHAR_H / d。
# 屋根の高さはキャラ 4.7 人分、視点の高さはキャラ約 2.85 人分（少し上から見下ろす）。
VP = (0.50, 0.35)          # 消失点
FLOOR_EDGE = 0.40          # 画像の下端（y=1.0）で、床の端が中央から左右へ 0.40W
NEAR_Y = 0.92              # 手前の歩ける端（d=1）
NEAR_DROP = NEAR_Y - VP[1]
FAR_D = NEAR_DROP / (0.60 - VP[1])   # 奥の歩ける端（床の y=0.60H）＝区画の切れ目
ROOF_CHARS = 4.7           # 屋根の下面の高さ（キャラ何人分）
SHOP_CHARS = 3.4           # 店の正面（2階の窓と看板まで）の高さ

DEPTH = {
    "id": "kita_arcade", "name": "北のアーケード（奥行きの通り・テスト）",
    "sections": [
        {
            "title": "区画A 十字路から北へ",
            # (手前の d, 奥の d, 入口の d, 説明, 入れるか)。入口は歩ける範囲（d=1〜FAR_D）の中に置く
            "left": [(0.6, 1.5, 1.2, "古着屋（ガラス越しにラック）", False), (1.5, FAR_D, 1.9, "仏具・線香の老舗", False)],
            "right": [(0.6, 1.5, 1.2, "ケバブとトルコアイスの店（モザイクのランプ）", True), (1.5, FAR_D, 1.9, "雑貨・アクセサリー", False)],
            "gate": ("alley", "切れ目：左右へ抜ける細い横道（ここで次の区画へ）"),
            "beyond": "arcade",
        },
        {
            "title": "区画B アーケードの中ほど",
            "left": [(0.6, 1.5, 1.2, "和菓子屋（蒸し器の湯気）", True), (1.5, FAR_D, 1.9, "中古ゲームとレコード", False)],
            "right": [(0.6, 1.5, 1.2, "手芸・コスプレ衣装の店", False), (1.5, FAR_D, 1.9, "喫茶（食品サンプルのケース）", False)],
            "gate": ("arch", "切れ目：屋根の継ぎ目の梁と無地の吊り看板（ここで次の区画へ）"),
            "beyond": "arcade",
        },
        {
            "title": "区画C 北口",
            "left": [(0.6, 1.5, 1.2, "電気部品の店", False), (1.5, FAR_D, 1.9, "たこ焼き屋", False)],
            "right": [(0.6, 1.5, 1.2, "和雑貨・扇子の店", True), (1.5, FAR_D, 1.9, "閉じた古い店（シャッター）", False)],
            "gate": ("exit", "北口：屋根がアーチで終わる（ここで栄へ）"),
            "beyond": "outside",
        },
    ],
}


def depth_y(d: float) -> float:
    return VP[1] + NEAR_DROP / d


def depth_x(side: int, d: float) -> float:
    """床の端の x（side=-1 左、+1 右）。"""
    y = depth_y(d)
    return VP[0] + side * FLOOR_EDGE * (y - VP[1]) / (1.0 - VP[1])


def char_h(d: float) -> float:
    return CHAR_H / d


def draw_depth(section: dict, w: int, h: int, labels: bool):
    im = Image.new("RGB", (w, h), COL["roof"])
    d = ImageDraw.Draw(im)
    P = lambda x, y: (round(x * w), round(y * h))
    notes, marks = [], []

    def wall_quad(side, d0, d1, top_chars):
        x0, x1 = depth_x(side, d0), depth_x(side, d1)
        y0, y1 = depth_y(d0), depth_y(d1)
        return [P(x0, y0), P(x1, y1), P(x1, y1 - top_chars * char_h(d1)), P(x0, y0 - top_chars * char_h(d0))]

    far = FAR_D
    deep = 40.0
    # 区画の向こう（次の区画・屋外）
    if section["beyond"] == "outside":
        gx0, gx1 = depth_x(-1, far), depth_x(1, far)
        gy_top = depth_y(far) - ROOF_CHARS * char_h(far)
        d.rectangle([*P(gx0, gy_top), *P(gx1, depth_y(far))], fill=COL["sky"])
        d.rectangle([*P(gx0 + 0.02, gy_top + 0.06), *P(gx0 + 0.07, depth_y(far) - 0.02)], fill=COL["far"])
        d.rectangle([*P(gx1 - 0.08, gy_top + 0.08), *P(gx1 - 0.02, depth_y(far) - 0.02)], fill=COL["far"])
        d.rectangle([*P(VP[0] - 0.006, gy_top + 0.01), *P(VP[0] + 0.006, depth_y(far) - 0.03)], fill=COL["landmark"])
        d.rectangle([*P(gx0, depth_y(far) - 0.045), *P(gx1, depth_y(far) - 0.035)], fill=COL["girder"])
        marks.append((VP[0], gy_top + 0.06, "外：広い大通りと高架の道路、その先に栄のビル群とテレビ塔"))
    # 床（歩ける台形と、その奥）
    d.polygon([P(depth_x(-1, far), depth_y(far)), P(depth_x(1, far), depth_y(far)), P(VP[0], VP[1]), ], fill=COL["near"])
    d.polygon([P(depth_x(-1, 1.0), NEAR_Y), P(depth_x(1, 1.0), NEAR_Y), P(depth_x(1, far), depth_y(far)), P(depth_x(-1, far), depth_y(far))], fill=COL["arcade"])
    d.polygon([P(depth_x(-1, 0.6), depth_y(0.6)), P(depth_x(1, 0.6), depth_y(0.6)), P(depth_x(1, 1.0), NEAR_Y), P(depth_x(-1, 1.0), NEAR_Y)], fill=COL["plaza"])
    # 壁（店の並び）と屋根の裏側
    for side, key in ((-1, "left"), (1, "right")):
        for d0, d1, dm, text, enter in section[key]:
            d.polygon(wall_quad(side, d0, d1, SHOP_CHARS), fill=COL["bldg"], outline=(120, 110, 100))
            # 看板の帯（2階）
            q_lo = wall_quad(side, d0, d1, 2.35)
            q_hi = wall_quad(side, d0, d1, 2.75)
            d.polygon([q_lo[3], q_lo[2], q_hi[2], q_hi[3]], fill=COL["sign"])
            # 入口（店の真ん中・ドア1枚分の幅）
            dd = 0.10 * dm
            door = wall_quad(side, dm - dd, dm + dd, DOOR_H / CHAR_H)
            d.polygon(door, fill=COL["door"] if enter else COL["door_x"], outline=(255, 214, 64) if enter else None)
            if enter:
                notes_x = (door[0][0] + door[1][0]) / 2 / w
                marks.append((notes_x, depth_y(dm) - 0.6 * DOOR_H / dm, "入れる入口（テスト用・中身は後で決める）"))
            cx = (depth_x(side, d0) + depth_x(side, min(d1, far))) / 2
            marks.append((cx, depth_y((d0 + d1) / 2) - SHOP_CHARS * char_h((d0 + d1) / 2) + 0.05, text))
        # 区画の向こうへ続く店の並び（奥・薄く）
        if section["beyond"] == "arcade":
            d.polygon(wall_quad(side, far, deep, SHOP_CHARS), fill=COL["tall"])
    # 屋根（左右の屋根の線の上）
    for side in (-1, 1):
        d.polygon([P(depth_x(side, 0.5), depth_y(0.5) - ROOF_CHARS * char_h(0.5)), P(depth_x(side, far), depth_y(far) - ROOF_CHARS * char_h(far)),
                   P(depth_x(side, far), depth_y(far) - SHOP_CHARS * char_h(far)), P(depth_x(side, 0.5), depth_y(0.5) - SHOP_CHARS * char_h(0.5))],
                  fill=COL["roof_hi"])
    # 屋根の骨（一定の奥行きごとに横切るアーチ）
    dd = 0.25
    k = 0.75
    while k < (deep if section["beyond"] == "arcade" else far + 0.01):
        yl = depth_y(k) - ROOF_CHARS * char_h(k)
        x0, x1 = depth_x(-1, k), depth_x(1, k)
        sag = 0.25 * (x1 - x0)
        d.arc([*P(x0, yl - sag), *P(x1, yl + sag)], 180, 360, fill=(170, 150, 110), width=max(2, w // 400))
        k += dd if k < 4 else dd * 4
    # 区画の切れ目
    kind, text = section["gate"]
    gx0, gx1, gy = depth_x(-1, far), depth_x(1, far), depth_y(far)
    gtop = gy - ROOF_CHARS * char_h(far)
    if kind == "alley":
        for side in (-1, 1):
            xa = depth_x(side, far)
            d.polygon(wall_quad(side, far, far * 1.12, SHOP_CHARS), fill=COL["gap"])
        d.line([*P(gx0, gtop + 0.02), *P(gx1, gtop + 0.02)], fill=(255, 255, 255), width=max(2, w // 300))
    elif kind == "arch":
        d.rectangle([*P(gx0, gtop - 0.01), *P(gx1, gtop + 0.035)], fill=COL["girder"])
        d.rectangle([*P(VP[0] - 0.09, gtop + 0.035), *P(VP[0] + 0.09, gtop + 0.08)], fill=COL["sign"])
    else:
        d.arc([*P(gx0, gtop - 0.05), *P(gx1, gtop + 0.09)], 180, 360, fill=COL["girder"], width=max(4, w // 150))
    d.line([*P(gx0, gy), *P(gx1, gy)], fill=COL["link"], width=max(3, w // 200))
    marks.append((VP[0], gy + 0.03, text))
    # 歩ける範囲の縁
    d.line([P(depth_x(-1, 1.0), NEAR_Y), P(depth_x(1, 1.0), NEAR_Y)], fill=COL["link"], width=max(3, w // 200))
    marks.append((VP[0], NEAR_Y + 0.035, "手前の端（ここから戻ると前の区画・十字路）"))
    # キャラの縮尺（手前・中ほど・奥）
    for dist, xoff in ((1.0, -0.12), (1.5, 0.06), (far - 0.05, -0.02)):
        ch, cy = char_h(dist), depth_y(dist)
        cx = VP[0] + xoff * (cy - VP[1]) / NEAR_DROP
        cw = ch * h * 0.38 / w
        d.rounded_rectangle([*P(cx - cw / 2, cy - ch), *P(cx + cw / 2, cy)], radius=max(2, round(cw * w / 2)), fill=COL["char"])
    marks.append((VP[0] - 0.12, NEAR_Y - CHAR_H / 2, f"キャラ：手前で0.20H（72ドット）／奥の端で約{CHAR_H / far:.2f}H"))
    # 消失点
    vx, vy = P(*VP)
    r = max(4, w // 150)
    d.line([vx - 3 * r, vy, vx + 3 * r, vy], fill=(220, 40, 40), width=2)
    d.line([vx, vy - 3 * r, vx, vy + 3 * r], fill=(220, 40, 40), width=2)
    if labels:
        marks.append((VP[0] + 0.06, VP[1] - 0.03, "消失点（中央・0.35H）"))
        for x, y, text in marks:
            n = len(notes) + 1
            notes.append(f"{n}. {text}")
            cx, cy = round(x * w), round(y * h)
            rr = max(9, h // 30)
            d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], fill=(30, 30, 30), outline=(255, 255, 255), width=2)
            d.text((cx, cy), str(n), fill=(255, 255, 255), font=font(int(rr * 1.2)), anchor="mm")
    return im, notes


def depth_overview():
    pw, ph = 640, 360
    secs = DEPTH["sections"]
    images, notes = [], []
    for sec in secs:
        im, n = draw_depth(sec, pw, ph, labels=True)
        images.append(im)
        notes.append((sec["title"], n))
    lines = max(len(n) for _, n in notes)
    sheet_h = 56 + ph + 40 + lines * 24 + 70
    sheet = Image.new("RGB", (pw * len(secs) + 20 * (len(secs) + 1), sheet_h), (250, 248, 242))
    d = ImageDraw.Draw(sheet)
    d.text((20, 14), DEPTH["name"], fill=(30, 30, 30), font=font(26))
    for i, im in enumerate(images):
        x = 20 + i * (pw + 20)
        sheet.paste(im, (x, 56))
        d.text((x, 56 + ph + 8), notes[i][0], fill=(30, 30, 30), font=font(20))
        for j, line in enumerate(notes[i][1]):
            d.text((x, 56 + ph + 40 + j * 24), line, fill=(50, 50, 50), font=font(16))
    legend = ("全区画で同じ消失点・床・屋根の線（区画を切り替えても線が動かない）／ 水色の線＝歩ける範囲の手前と奥の端 ／ "
              "黄色の枠＝入れる入口 ／ 黒いカプセル＝キャラの大きさ（奥ほど小さい）")
    d.text((20, sheet_h - 40), legend, fill=(90, 90, 90), font=font(16))
    return sheet


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for s in STREETS:
        for i, p in enumerate(s["panels"], 1):
            im, _ = draw_panel(p, 1024, 576, labels=False)
            im.save(OUT / f"{s['id']}_p{i}.png", optimize=True)
        overview(s).save(OUT / f"{s['id']}_overview.png", optimize=True)
    for i, sec in enumerate(DEPTH["sections"], 1):
        im, _ = draw_depth(sec, 1024, 576, labels=False)
        im.save(OUT / f"{DEPTH['id']}_d{i}.png", optimize=True)
    depth_overview().save(OUT / f"{DEPTH['id']}_overview.png", optimize=True)
    # 写真に近い地図なので、256色に減らして容量を抑える（確認用の図なので十分）
    city_map().quantize(256, method=Image.Quantize.FASTOCTREE).save(OUT / "city_map.png", optimize=True)
    print(f"wrote {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
