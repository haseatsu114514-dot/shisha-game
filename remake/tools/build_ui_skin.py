"""生成PNGの透明余白を整えて、日常UIのWebPを作る（元PNGは変更しない）。

パッキースロットの図柄・枠（remake/img/ui/pakki-slot/*.png）も、同じフォルダへ軽いWebPを作る。
元のPNGは1254px・約1MBあり、初めて筐体が出たときに読み込みが間に合わず図柄が欠けていた（GUI20）。
"""
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
SOURCES = ROOT / "assets/ui/lounge"
OUT = ROOT / "remake/img/ui/lounge"
SLOT_DIR = ROOT / "remake/img/ui/pakki-slot"

# 拡大筐体（コマ高66px）を3倍密度の画面で表示しても足りる幅。図柄の切り出し矩形は
# reel.css が元の1254px基準で持ち、background-size で合わせるので縮小しても変えなくてよい。
SLOT = {
    "symbols": {"source_size": (1254, 1254), "width": 627},
    "symbols-premium": {"source_size": (1254, 1254), "width": 627},
    "bezel": {"source_size": (1536, 1024), "width": 1024},
}

# 生成画像の物体の外接範囲。装飾を含め、画面外の透明余白だけを除く。
# source_sizeも固定して、別サイズの再生成画像へ古いcropを黙って適用しない。
SPRITES = {
    "panel": {"source_size": (1254, 1254), "crop": (28, 30, 1227, 1218), "width": 640},
    "button": {"source_size": (2172, 724), "crop": (48, 166, 2122, 544), "width": 960},
    "map-pin": {"source_size": (1448, 1086), "crop": (19, 165, 1430, 904), "width": 400},
    "heart": {"source_size": (1254, 1254), "crop": (48, 137, 1206, 1188), "width": 96},
    "reward-clean": {"source_size": (2172, 724), "crop": (5, 86, 2168, 633), "width": 800},
    "gauge-frame": {"source": "gauge", "source_size": (1774, 887), "crop": (43, 263, 1733, 373), "width": 440},
    "gauge-fill": {"source": "gauge", "source_size": (1774, 887), "crop": (43, 565, 1733, 638), "width": 440},
}

# 紙×ラベンダー（日常UI・DUI09）。原画は assets/ui/paper/（生成記録は asset_sources/ui/paper-20261031/）。
PAPER_SOURCES = ROOT / "assets/ui/paper"
PAPER_OUT = ROOT / "remake/img/ui/paper"
# 会話窓は ::before で窓（1216×176）＋上下左右8pxへ 100% 100% に引き伸ばされる。
# 線や煙が縦に潰れないよう、表示と同じ縦横比（1232×192）の @2x に九分割で組んでおく。
PAPER_DIALOGUE = {"source_size": (1536, 1024), "size": (2464, 384),
                  # 原画の切り分け（左, 上, 右, 下）。右下の煙と上の罫線を角の領域に含める。
                  "slice": (120, 230, 280, 440), "scale": 0.5, "radius": 16}


def nine_slice(source, size, slice_, scale):
    """九分割で size に組む。角は scale 倍で保ち、辺と中央だけを伸ばす。"""
    w, h = source.size
    left, top, right, bottom = slice_
    dl, dt, dr, db = (round(v * scale) for v in slice_)
    W, H = size
    xs, dxs = (0, left, w - right, w), (0, dl, W - dr, W)
    ys, dys = (0, top, h - bottom, h), (0, dt, H - db, H)
    out = Image.new("RGBA", size)
    for i in range(3):
        for j in range(3):
            box = (xs[i], ys[j], xs[i + 1], ys[j + 1])
            dest = (dxs[i + 1] - dxs[i], dys[j + 1] - dys[j])
            out.paste(source.crop(box).resize(dest, Image.Resampling.LANCZOS), (dxs[i], dys[j]))
    return out


def rounded(image, radius):
    mask = Image.new("L", image.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, image.width - 1, image.height - 1), radius=radius, fill=255)
    image.putalpha(mask)
    return image


def build_paper():
    PAPER_OUT.mkdir(parents=True, exist_ok=True)
    with Image.open(PAPER_SOURCES / "dialogue.png") as source:
        spec = PAPER_DIALOGUE
        if source.size != spec["source_size"]:
            raise ValueError(f"paper dialogue: update PAPER_DIALOGUE for new source size {source.size}")
        frame = rounded(nine_slice(source.convert("RGBA"), spec["size"], spec["slice"], spec["scale"]), spec["radius"])
        frame.save(PAPER_OUT / "dialogue.webp", "WEBP", quality=88, alpha_quality=100, method=6)
    # 板は CSS の border-image で九分割する（切り分けは 72/512px）。
    with Image.open(PAPER_SOURCES / "panel.png") as source:
        source.convert("RGB").resize((512, 512), Image.Resampling.LANCZOS).save(PAPER_OUT / "panel.webp", "WEBP", quality=88, method=6)
    with Image.open(PAPER_SOURCES / "lavender.png") as source:
        source.convert("RGB").resize((256, 256), Image.Resampling.LANCZOS).save(PAPER_OUT / "lavender.webp", "WEBP", quality=88, method=6)
    build_menu_bg()
    for path in sorted(PAPER_OUT.glob("*.webp")):
        print(f"{path.relative_to(ROOT)}: {path.stat().st_size:,} bytes")


# 全画面MENU（DUI03・#2097）の紙。表示は 1232×672（1280×720 の舞台から上下左右24px）。
# 原画（3:2）の上の枠線と、左下のシーシャ台の絵を含む下側はそのまま残し、無地の中ほどだけを縦に詰めて
# 表示と同じ縦横比（1536×838）にする。横は伸縮しないので、タブの帯と枠線の位置は原画と同じ割合のまま。
PAPER_MENU = {"source_size": (1536, 1024), "keep_top": 80, "keep_bottom": 424, "height": 838}


def build_menu_bg():
    spec = PAPER_MENU
    with Image.open(PAPER_SOURCES / "menu-bg.png") as source:
        if source.size != spec["source_size"]:
            raise ValueError(f"paper menu-bg: update PAPER_MENU for new source size {source.size}")
        image = source.convert("RGB")
        w, h = image.size
        top, bottom = spec["keep_top"], spec["keep_bottom"]
        middle = spec["height"] - top - bottom
        out = Image.new("RGB", (w, spec["height"]))
        out.paste(image.crop((0, 0, w, top)), (0, 0))
        out.paste(image.crop((0, top, w, h - bottom)).resize((w, middle), Image.Resampling.LANCZOS), (0, top))
        out.paste(image.crop((0, h - bottom, w, h)), (0, top + middle))
        out.save(PAPER_OUT / "menu-bg.webp", "WEBP", quality=82, method=6)


# 制作（シーシャ作り）の紙×ラベンダー＋琥珀（CUI01〜）。原画は assets/ui/craft-paper/（生成記録は asset_sources/ui/craft-paper-20261031/）。
# 透過の部品は原画を実体の範囲に切り出した採用画像をそのまま縮小する。切り出し範囲は原画の寸法と組で固定し、
# 別サイズの再生成画像へ古い切り出しを黙って適用しない。
CRAFT_SOURCES = ROOT / "assets/ui/craft-paper"
CRAFT_OUT = ROOT / "remake/img/ui/craft-paper"
CRAFT_PARTS = {
    # 板は CSS の border-image で九分割（切り分けは 40/768px）。
    "board": {"source_size": (1536, 1024), "width": 768, "alpha": False, "quality": 86},
    # 作業台の後ろの壁紙。画面全体を覆うので 1280px 幅まで落とす。
    "backdrop": {"source_size": (1536, 1024), "width": 1280, "alpha": False, "quality": 80},
    # 温度計の枠。中央の縦長の窓は透明で、管（CSS）が透けて見える。窓は幅 33.4〜66.3%・高さ 5.1〜92.6%（craft-paper.css の .thermo-tube と対）。
    "thermo-frame": {"source_size": (401, 1445), "width": 160, "alpha": True},
    # ボタンの面。CSS の border-image で九分割（切り分けは 28px、角の丸みを含む）。
    "button-paper": {"source_size": (1465, 684), "width": 512, "alpha": True},
    "button-lavender": {"source_size": (1471, 601), "width": 512, "alpha": True},
    # 琥珀の面は外側に柔らかな光彩を含む（切り出しに 40px の余白）。
    "button-amber": {"source_size": (1513, 588), "width": 512, "alpha": True},
    # 工程ごとの舞台（小道具を置く天板）。台所の石の天板＝炭焼き・調整、リネンのマット＝配合・詰め方・穴あけ・蒸らし時間。
    "stage-kitchen": {"source_size": (1536, 1024), "width": 1280, "alpha": False, "quality": 82},
    "stage-workbench": {"source_size": (1536, 1024), "width": 1280, "alpha": False, "quality": 82},
}

# 夜紫の制作UI（CUI06〜09）。採用PNGの切り出し後サイズを固定する。
CRAFT_NIGHT_SOURCES = ROOT / "assets/ui/craft-night"
CRAFT_NIGHT_OUT = ROOT / "remake/img/ui/craft-night"
CRAFT_NIGHT_PARTS = {
    "board": {"source_size": (1536, 1024), "width": 768, "alpha": False},
    "backdrop": {"source_size": (1536, 1024), "width": 1280, "alpha": False},
    "stage-kitchen": {"source_size": (1536, 1024), "width": 1280, "alpha": False},
    "stage-workbench": {"source_size": (1536, 1024), "width": 1280, "alpha": False},
    "window": {"source_size": (1536, 1024), "width": 768, "alpha": False},
    "frame": {"source_size": (1637, 906), "width": 768, "alpha": True},
    "button-glass": {"source_size": (1911, 581), "width": 512, "alpha": True},
    "button-white": {"source_size": (1877, 559), "width": 512, "alpha": True},
    "button-gold": {"source_size": (1945, 685), "width": 512, "alpha": True},
    "thermo-frame": {"source_size": (396, 1478), "width": 160, "alpha": True},
    "step-done": {"source_size": (1081, 1084), "width": 128, "alpha": True},
    "step-now": {"source_size": (1119, 1121), "width": 128, "alpha": True},
    "step-next": {"source_size": (1007, 1013), "width": 128, "alpha": True},
    "rank-strip": {"source_size": (2138, 430), "width": 1024, "alpha": True},
    "medal-gold": {"source_size": (1236, 1040), "width": 128, "alpha": True},
    "medal-silver": {"source_size": (1252, 1075), "width": 128, "alpha": True},
    "medal-bronze": {"source_size": (1189, 1013), "width": 128, "alpha": True},
    "medal-plain": {"source_size": (1237, 1035), "width": 128, "alpha": True},
    "cutin-band": {"source_size": (1009, 1536), "width": 1024, "alpha": True},
    "entry-me": {"source_size": (1133, 1094), "width": 128, "alpha": True},
    "entry-rival": {"source_size": (1056, 1022), "width": 128, "alpha": True},
}


# 新しい配置「一枚の舞台」（CSL）の部品。採用PNGのサイズを固定する。
CRAFT_STAGE_SOURCES = ROOT / "assets/ui/craft-stage"
CRAFT_STAGE_OUT = ROOT / "remake/img/ui/craft-stage"
CRAFT_STAGE_PARTS = {
    # 舞台の天板（石）: 炭焼き・調整。枠なしの全面。
    "counter-stone": {"source_size": (1536, 1024), "width": 1280, "alpha": False},
    # 舞台の天板（作業マット）: 配合・詰め方・穴あけ・蒸らし時間。石と同じ構図。
    "counter-mat": {"source_size": (1536, 1024), "width": 1280, "alpha": False},
    # 熱の柱の外枠: 幅74で縦を九分割で伸ばす（2倍密度）。中央の窓は透明。
    "spine-housing": {"source_size": (205, 1442), "width": 148, "alpha": True},
    # 工程の灯5種: 同じ切り出し枠（光彩ごと）。輪は枠の73.6%。
    **{name: {"source_size": (780, 780), "width": 128, "alpha": True}
       for name in ("lamp-off", "lamp-faint", "lamp-fair", "lamp-good", "lamp-shine")},
    # 見守る人の一言の板（388×96 を2倍密度）。
    "voice-plate": {"source_size": (1382, 346), "width": 776, "alpha": True},
    # 吸い出しの半円ダイヤルの台座（中の帯・針はコード）。
    "dial-bezel": {"source_size": (1421, 718), "width": 1024, "alpha": True},
    # 熱の柱の上の状態の札の縁（中は透明）と、上のレールの今の工程の札。
    "spine-plate": {"source_size": (1229, 385), "width": 320, "alpha": True},
    "rail-now": {"source_size": (1328, 406), "width": 400, "alpha": True},
}


def build_craft_stage():
    CRAFT_STAGE_OUT.mkdir(parents=True, exist_ok=True)
    for name, spec in CRAFT_STAGE_PARTS.items():
        with Image.open(CRAFT_STAGE_SOURCES / f"{name}.png") as source:
            if source.size != spec["source_size"]:
                raise ValueError(f"craft-stage {name}: expected {spec['source_size']}, got {source.size}")
            width = spec["width"]
            size = (width, round(width * source.height / source.width))
            image = source.convert("RGBA" if spec["alpha"] else "RGB").resize(size, Image.Resampling.LANCZOS)
            path = CRAFT_STAGE_OUT / f"{name}.webp"
            image.save(path, "WEBP", quality=90 if spec["alpha"] else 84, alpha_quality=100, method=6, exact=spec["alpha"])
            print(f"{path.relative_to(ROOT)}: {image.width}×{image.height}, {path.stat().st_size:,} bytes")


CRAFT_GLASS_SOURCES = ROOT / "assets/ui/craft-glass"
CRAFT_GLASS_OUT = ROOT / "remake/img/ui/craft-glass"
# シーシャ作りの部品「ガラスと革」（CSL18 方向B）。原画は asset_sources/ui/craft-glass-20261111/raw/、
# 切り出しの枠は同フォルダの README。実行時の絵はどれも切り出しの半分（stage-leather だけ幅1280）。
CRAFT_GLASS_PARTS = {
    **{name: {"source_size": (2071, 586), "width": 1036} for name in ("tile", "tile-on", "tile-off")},
    **{name: {"source_size": (1892, 677), "width": 946} for name in ("key", "key-amber")},
    "panel": {"source_size": (1477, 947), "width": 739},
    "frame": {"source_size": (1699, 806), "width": 850},
    "strip": {"source_size": (2049, 166), "width": 1025},
    "plaque": {"source_size": (1921, 487), "width": 961},
    "bead": {"source_size": (783, 818), "width": 392},
    "badge": {"source_size": (973, 1015), "width": 487},
    "rail-now": {"source_size": (2085, 563), "width": 1043},
    "voice-plate": {"source_size": (2034, 476), "width": 1017},
    "spine-housing": {"source_size": (251, 1421), "width": 126},
    "dial-bezel": {"source_size": (1462, 806), "width": 731},
    "dial-glass": {"source_size": (1321, 686), "width": 661},
    "stage-leather": {"source_size": (1536, 1024), "width": 1280, "alpha": False},
}


def build_craft_glass():
    CRAFT_GLASS_OUT.mkdir(parents=True, exist_ok=True)
    for name, spec in CRAFT_GLASS_PARTS.items():
        with Image.open(CRAFT_GLASS_SOURCES / f"{name}.png") as source:
            if source.size != spec["source_size"]:
                raise ValueError(f"craft-glass {name}: expected {spec['source_size']}, got {source.size}")
            alpha = spec.get("alpha", True)
            width = spec["width"]
            image = source.convert("RGBA" if alpha else "RGB").resize((width, round(width * source.height / source.width)), Image.Resampling.LANCZOS)
            path = CRAFT_GLASS_OUT / f"{name}.webp"
            image.save(path, "WEBP", quality=90 if alpha else 84, alpha_quality=100, method=6, exact=alpha)
            print(f"{path.relative_to(ROOT)}: {image.width}×{image.height}, {path.stat().st_size:,} bytes")


NEO_SOURCES = ROOT / "assets/ui/neo"
NEO_OUT = ROOT / "remake/img/ui/neo"
NEO_PARTS = {
    # 会話の帯に重ねる煙（LK19 第2弾）。原画は依頼（不透明度10〜35%）より濃いので、実行時の絵だけ不透明度を35%に下げる。
    "band-smoke": {"source_size": (2156, 454), "width": 1280, "alpha_scale": 0.35},
    # 見出しの下の飾り罫。左端に煙の飾り、右へ消える。0.3倍（幅571）で使うので2倍密度の1142。
    "heading-rule": {"source_size": (1903, 79), "width": 1142},
}


def build_neo():
    NEO_OUT.mkdir(parents=True, exist_ok=True)
    for name, spec in NEO_PARTS.items():
        with Image.open(NEO_SOURCES / f"{name}.png") as source:
            if source.size != spec["source_size"]:
                raise ValueError(f"neo {name}: expected {spec['source_size']}, got {source.size}")
            width = spec["width"]
            image = source.convert("RGBA").resize((width, round(width * source.height / source.width)), Image.Resampling.LANCZOS)
            if "alpha_scale" in spec:
                r, g, b, a = image.split()
                image = Image.merge("RGBA", (r, g, b, a.point(lambda v: round(v * spec["alpha_scale"]))))
            path = NEO_OUT / f"{name}.webp"
            image.save(path, "WEBP", quality=90, alpha_quality=100, method=6, exact=True)
            print(f"{path.relative_to(ROOT)}: {image.width}×{image.height}, {path.stat().st_size:,} bytes")


def build_craft_night():
    CRAFT_NIGHT_OUT.mkdir(parents=True, exist_ok=True)
    for name, spec in CRAFT_NIGHT_PARTS.items():
        with Image.open(CRAFT_NIGHT_SOURCES / f"{name}.png") as source:
            if source.size != spec["source_size"]:
                raise ValueError(f"craft-night {name}: expected {spec['source_size']}, got {source.size}")
            width = spec["width"]
            size = (width, round(width * source.height / source.width))
            image = source.convert("RGBA" if spec["alpha"] else "RGB").resize(size, Image.Resampling.LANCZOS)
            path = CRAFT_NIGHT_OUT / f"{name}.webp"
            image.save(path, "WEBP", quality=90 if spec["alpha"] else 84,
                       alpha_quality=100, method=6, exact=spec["alpha"])
            print(f"{path.relative_to(ROOT)}: {image.width}×{image.height}, {path.stat().st_size:,} bytes")


def build_craft_paper():
    CRAFT_OUT.mkdir(parents=True, exist_ok=True)
    for name, spec in CRAFT_PARTS.items():
        with Image.open(CRAFT_SOURCES / f"{name}.png") as source:
            if source.size != spec["source_size"]:
                raise ValueError(f"craft-paper {name}: update CRAFT_PARTS for new source size {source.size}")
            width = spec["width"]
            size = (width, round(width * source.height / source.width))
            path = CRAFT_OUT / f"{name}.webp"
            if spec["alpha"]:
                sprite = source.convert("RGBA").resize(size, Image.Resampling.LANCZOS)
                sprite.save(path, "WEBP", quality=92, alpha_quality=100, method=6, exact=True)
            else:
                sprite = source.convert("RGB").resize(size, Image.Resampling.LANCZOS)
                sprite.save(path, "WEBP", quality=spec["quality"], method=6)
            print(f"{path.relative_to(ROOT)}: {sprite.width}×{sprite.height}, {path.stat().st_size:,} bytes")


# シーシャくじの演出の絵（GCH・Issue #3228）。原画の後処理済み（透明の清書・寸法合わせ）は
# asset_sources/ui/kuji-gacha-20261111/processed/（#3313・処理の記録は PROCESSING.md）。ここで部品の枠に合わせて切り出し、
# 2倍密度の WebP にする。crop は原画の px（左, 上, 右, 下）で、原画の外へはみ出す分は透明で埋める。
# 置き場所の決まり（枠・合わせる点）は asset_sources/ui/kuji-gacha-20261111/README.md、差し込みは js/motions/kuji-art.js と css/motions/garagara.css。
KUJI_SOURCES = ROOT / "asset_sources/ui/kuji-gacha-20261111/processed"
KUJI_OUT = ROOT / "remake/img/ui/kuji"
KUJI_PARTS = {
    # 胴: 軸（原画の中心）を中心にした正方形。六角の外接半径481px → 枠308pxで150px。
    "garagara-drum": {"source_size": (1024, 1024), "crop": (17, 17, 1005, 1005), "width": 616},
    # 脚: 軸受けの中心(512,129)・足先の下端992。枠は box で [375, 265.6, 330, 337.3]（軸は上から26.4px）。
    "garagara-frame": {"source_size": (1024, 1024), "crop": (50, 55, 974, 1000), "width": 660},
    # 台: 板の幅1380px → 424px。box で [339, 571.4, 424.6, 57.1]（天板は上から41.6px。手前と奥の脚の足先がどちらも載る）。
    # 下端（原画の y599 より下）は灰色の半透明の影の名残で、カウンターの上では明るい筋に見えるので切り落とす（影は CSS の .kj-ground）。
    "garagara-base": {"source_size": (1536, 1024), "crop": (77, 413, 1459, 599), "width": 848},
    # ハンドル: 軸の円の中心(256.5,510.5)を中心にした正方形。握りの中心まで491px → 104px（枠280px）。
    "garagara-handle": {"source_size": (1024, 1024), "crop": (-405, -151, 917, 1171), "width": 560},
    # 受け皿: 外周の幅1075px → 192px、緑の敷物の中心(767,486.5)を受け皿の中心(872,598)へ。枠 [762,562,220,84] に合わせた切り出し。
    "garagara-tray": {"source_size": (1536, 1024), "crop": (151, 285, 1383, 755), "width": 440},
    # 玉5種: 同じ切り出し（直径720pxの円を、枠34pxで直径32pxに）。
    **{f"ball-{k}": {"source_size": (1024, 1024), "crop": (130, 130, 895, 895), "width": 256} for k in ("s", "a", "b", "c", "last")},
    # カウンター: 奥の縁(y563)から下。枠 1400×420 と同じ縦横比（手前の縁が y694 付近）。
    "counter": {"source_size": (1536, 1024), "crop": (0, 563, 1536, 1024), "width": 1536},
    # 黒板: 脚まで。box で [85.2, 250, 225.5, 340]（書ける面は x105〜291・y270〜543）。
    "sign": {"source_size": (1024, 1536), "crop": (84, 123, 939, 1413), "width": 452},
    # 鐘: 柄の先が上端の中央。枠 140×300 と同じ縦横比になるよう下を透明で延ばす。
    "bell": {"source_size": (1024, 1536), "crop": (307, 0, 717, 879), "width": 280},
    # 玉置き: 横に九分割で伸ばす（css の border-image。左右の端は70px）。
    "rail": {"source_size": (1536, 1024), "crop": (46, 462, 1490, 562), "width": 1444},
    # 札の地5種: 同じ切り出し（本体 1414×595 → 札 884×372）。左の窓は x57〜602・y56〜535。
    **{f"card-{k}": {"source_size": (1536, 1024), "crop": (62, 215, 1476, 810), "width": 1414} for k in ("s", "a", "b", "c", "last")},
    # 景品の包み・「大当たり」の帯。
    "gift": {"source_size": (1024, 1024), "crop": (144, 192, 881, 831), "width": 400},
    "banner": {"source_size": (1536, 1024), "crop": (230, 409, 1305, 615), "width": 600},
    # 黒地: 後ろの光は CSS で screen 合成するので黒地のまま。きらめきは透明な canvas に加算で描くので、
    # 明るさを透明度に移した絵にする（黒地のままだと黒い四角が残る）。十字の縦の腕は中心から220px。
    "burst": {"source_size": (1024, 1024), "crop": (0, 0, 1024, 1024), "width": 1024, "alpha": False},
    "sparkle": {"source_size": (1024, 1024), "crop": (256, 258, 768, 770), "width": 160, "luma_alpha": True},
}

# ---- くじのランク（店）ごとの抽選器（2026-11-11 オーナー「くじのランクによってガラガラの見た目を変えたり豪華に」GCH16）----
# 採用済みの絵（くるみ材・黒い鉄・くすんだ真鍮）を、素材ごとに塗り替えて作る。形・位置は元の絵と画素単位で同じなので、
# 置き場所（kuji-art.js）と回転の中心はそのまま使える。木目や金属の擦れは元の絵の明るさをそのまま使う（描いた質感が残る）。
# 色は「暗い側 → 明るい側」の階調。素材の明るさ（KUJI_LUMA の幅を 0〜1 に伸ばす）で引く。
KUJI_RAMPS = {
    "oak": [(0, "#3a2413"), (0.3, "#8a5c2e"), (0.62, "#c8935a"), (0.86, "#e6bd86"), (1, "#f6dcae")],
    "mahogany": [(0, "#160706"), (0.3, "#3f1410"), (0.62, "#6e2619"), (0.86, "#9a4228"), (1, "#cf7d4e")],
    "marble": [(0, "#5c5a60"), (0.3, "#a9a6a6"), (0.55, "#dcd8d2"), (0.8, "#f4f1ea"), (1, "#ffffff")],
    "lacquer": [(0, "#020203"), (0.3, "#0c0b0f"), (0.62, "#1b1a22"), (0.86, "#3a3846"), (1, "#8c8aa0")],
    "crimson": [(0, "#1e0306"), (0.3, "#5e0a12"), (0.62, "#a3161c"), (0.86, "#d8423a"), (1, "#ff9a84")],
    "stainless": [(0, "#23262b"), (0.25, "#565c66"), (0.55, "#a0a8b3"), (0.8, "#d8dee6"), (1, "#ffffff")],
    "chrome": [(0, "#2a2f36"), (0.3, "#6d7682"), (0.6, "#b8c2cd"), (0.85, "#eef2f6"), (1, "#ffffff")],
    "old-brass": [(0, "#2a1806"), (0.25, "#6a4416"), (0.55, "#a87a30"), (0.8, "#d8ae5c"), (1, "#f6e2a6")],
    "gold": [(0, "#2e1a04"), (0.22, "#7a4f12"), (0.5, "#c8922a"), (0.74, "#f0c85a"), (0.9, "#ffeaa0"), (1, "#fffbe6")],
    "gold-bright": [(0, "#3a2206"), (0.3, "#99681a"), (0.6, "#e6b440"), (0.85, "#ffe494"), (1, "#ffffff")],
    "felt-navy": [(0, "#060b1e"), (0.5, "#16285c"), (1, "#3a5aa8")],
    "felt-wine": [(0, "#1c0508"), (0.5, "#5a1220"), (1, "#a03242")],
    "felt-purple": [(0, "#12061f"), (0.5, "#3c1766"), (1, "#7a44b4")],
    "felt-crimson": [(0, "#240306"), (0.5, "#7c0f18"), (1, "#c8323a")],
}
# 見た目の名前（data/kuji.json の machine）→ 素材ごとの階調。knob＝ハンドルの握り、gem＝軸に付ける宝石の色相（度）
KUJI_LOOKS = {
    # 柚ヶ谷店・機材くじ: 明るいオーク材に磨いたステンレス
    "steel": {"wood": "oak", "steel": "stainless", "brass": "chrome", "felt": "felt-navy"},
    # 東京店・上級機材くじ: 深い赤のマホガニーに真鍮
    "brass": {"wood": "mahogany", "steel": "old-brass", "brass": "gold-bright", "felt": "felt-wine"},
    # ドバイ店・特注台くじ: 白い大理石調に金。軸に緑の宝石
    "marble": {"wood": "marble", "steel": "gold", "brass": "gold-bright", "felt": "felt-purple", "gem": 150},
    # 第5章の本店・限定台くじ: 黒い漆に金。握りは朱、軸に紫の宝石
    "lacquer": {"wood": "lacquer", "steel": "gold", "brass": "gold-bright", "felt": "felt-crimson", "knob": "crimson", "gem": 285},
}
# 元の絵での素材ごとの明るさの幅（暗い側・明るい側）
KUJI_LUMA = {"wood": (0.10, 0.62), "steel": (0.06, 0.42), "brass": (0.16, 0.98), "felt": (0.08, 0.34)}
# 部品ごとに出てくる素材
KUJI_LOOK_PARTS = {
    "garagara-drum": ("wood", "steel", "brass"),
    "garagara-frame": ("steel", "brass"),
    "garagara-base": ("wood", "brass"),
    "garagara-handle": ("wood", "brass"),
    "garagara-tray": ("wood", "brass", "felt"),
}


def luma_alpha(image):
    """黒地の光の絵を、明るさ（RGB の最大）＝透明度の絵にする。色は透明度で割り戻す（加算で重ねると元の見た目に戻る）。"""
    rgb = image.convert("RGB")
    r, g, b = rgb.split()
    alpha = ImageChops.lighter(ImageChops.lighter(r, g), b)
    pixels = [(min(255, round(cr * 255 / max(a, 1))), min(255, round(cg * 255 / max(a, 1))), min(255, round(cb * 255 / max(a, 1))), a)
              for (cr, cg, cb), a in zip(rgb.getdata(), alpha.getdata())]
    out = Image.new("RGBA", rgb.size)
    out.putdata(pixels)
    return out


def save_kuji_part(name, spec, source, out_name=None):
    """原画（または色替えした原画）を部品の枠に切り出して WebP で保存する"""
    if source.size != spec["source_size"]:
        raise ValueError(f"kuji {name}: update KUJI_PARTS for new source size {source.size}")
    alpha = spec.get("alpha", True)
    left, top, right, bottom = spec["crop"]
    canvas = Image.new("RGBA" if alpha else "RGB", (right - left, bottom - top), (0, 0, 0, 0) if alpha else (0, 0, 0))
    canvas.paste(source.convert("RGBA" if alpha else "RGB"), (-left, -top))
    width = spec["width"]
    image = canvas.resize((width, round(width * canvas.height / canvas.width)), Image.Resampling.LANCZOS)
    if spec.get("luma_alpha"):
        image = luma_alpha(image)
        alpha = True
    path = KUJI_OUT / f"{out_name or name}.webp"
    if alpha:
        # exact=False: 透明な所の色は捨ててよい（明るさを透明度に移したきらめきは、暗い所の色が荒れて重くなる）
        image.save(path, "WEBP", quality=88, alpha_quality=100, method=6, exact=not spec.get("luma_alpha"))
    else:
        image.save(path, "WEBP", quality=85, method=6)
    print(f"{path.relative_to(ROOT)}: {image.width}×{image.height}, {path.stat().st_size:,} bytes")


def save_kuji_drum_blur(source, out_name):
    """速く回っているときに重ねる、回転でぶれた胴の絵（軸を中心に ±9° の範囲を平均する）。ぼけた絵なので枠と同じ308pxで足りる"""
    import numpy as np
    spec = KUJI_PARTS["garagara-drum"]
    left, top, right, bottom = spec["crop"]
    face = source.convert("RGBA").crop((left, top, right, bottom)).resize((308, 308), Image.Resampling.LANCZOS)
    total = np.zeros((308, 308, 4))
    turns = range(-9, 10)
    for degrees in turns:
        pixels = np.asarray(face.rotate(degrees, resample=Image.Resampling.BICUBIC)).astype(float)
        pixels[..., :3] *= pixels[..., 3:4] / 255.0  # 透明な所の色を混ぜない
        total += pixels
    total /= len(turns)
    alpha = np.maximum(total[..., 3:4], 1e-6)
    blurred = Image.fromarray(np.dstack([np.clip(total[..., :3] * 255.0 / alpha, 0, 255), total[..., 3]]).astype("uint8"), "RGBA")
    path = KUJI_OUT / f"{out_name}.webp"
    blurred.save(path, "WEBP", quality=84, alpha_quality=90, method=6)
    print(f"{path.relative_to(ROOT)}: {blurred.width}×{blurred.height}, {path.stat().st_size:,} bytes")


def build_kuji():
    KUJI_OUT.mkdir(parents=True, exist_ok=True)
    for name, spec in KUJI_PARTS.items():
        source_name = "ball-" + name.split("-", 1)[1] if name.startswith("ball-") else name
        with Image.open(KUJI_SOURCES / f"{source_name}.png") as source:
            save_kuji_part(name, spec, source)
            if name == "garagara-drum":
                save_kuji_drum_blur(source, "garagara-drum-blur")
    build_kuji_looks()


def kuji_materials(name, pixels):
    """抽選器の絵を素材（木・鉄・真鍮・布）に分ける。返り値は素材名 → 0〜1 の重み（numpy の配列）。
    色で分けるのが基本: 彩度の低い所＝鉄、黄みがあって明るい所＝真鍮、緑＝布、残りの茶＝木。
    色だけでは分けにくい所（真鍮の影・鉄の錆び）は、場所で決める（胴の軸頭と蓋・脚の軸受け・ハンドルの握り）。"""
    import numpy as np
    from PIL import ImageFilter

    def step(x, a, b):
        t = np.clip((x - a) / (b - a), 0, 1)
        return t * t * (3 - 2 * t)

    kinds = KUJI_LOOK_PARTS[name]
    r, g, b = [pixels[..., i] / 255.0 for i in range(3)]
    high = np.maximum(np.maximum(r, g), b)
    spread = high - np.minimum(np.minimum(r, g), b)
    safe = np.where(spread > 1e-6, spread, 1)
    hue = np.where(high == r, (g - b) / safe, np.where(high == g, 2 + (b - r) / safe, 4 + (r - g) / safe)) * 60 % 360
    hue = np.where(spread > 1e-6, hue, 0)
    sat = np.where(high > 0, spread / np.where(high > 0, high, 1), 0)
    zero = np.zeros_like(hue)
    felt = step(hue, 60, 80) * (1 - step(hue, 175, 195)) * step(sat, 0.12, 0.22) if "felt" in kinds else zero
    gray = 1 - step(sat, 0.16, 0.30)
    steel = gray * (1 - felt) if "steel" in kinds else zero
    warm = (1 - felt) * (1 - steel)
    brass = warm * step(hue, 26.5, 31.5) * step(high, 0.36, 0.48) if "brass" in kinds else zero
    wood = warm - brass if "wood" in kinds else zero
    yy, xx = np.mgrid[0:hue.shape[0], 0:hue.shape[1]]
    if name == "garagara-drum":
        # 鉄の帯の錆びた所が木に分かれないよう、まわりの多数決で木の範囲を決める
        region = np.asarray(Image.fromarray((wood * 255).astype("uint8")).filter(ImageFilter.GaussianBlur(7))) / 255.0
        region = step(region, 0.42, 0.58)
        steel, wood = steel + wood * (1 - region), wood * region
        # 軸頭（半径72px）と玉の出口の蓋は真鍮（穴などの暗い所は鉄の階調で黒く残す）。軸頭のまわりの輪は鉄
        radius = np.hypot(xx - 511.5, yy - 511.5)
        metal = (radius < 72) | ((xx > 700) & (xx < 802) & (yy > 648) & (yy < 750))
        lit = step(high, 0.10, 0.20)
        brass, steel, wood = np.where(metal, lit, brass), np.where(metal, 1 - lit, steel), np.where(metal, 0, wood)
        ring = (radius >= 72) & (radius < 99)
        steel, wood = np.where(ring, 1 - brass, steel), np.where(ring, 0, wood)
    elif name == "garagara-frame":
        # 軸受けの芯（半径46px）だけ真鍮。ほかは全部鉄（鉄の角の擦れた暖色を真鍮にしない）
        core = np.hypot(xx - 512, yy - 129) < 46
        brass, steel = np.where(core, 1.0, 0.0), np.where(core, 0.0, 1.0)
    elif name == "garagara-handle":
        # 握り（右の丸。半径112px）は木、ほかは真鍮（ねじの溝などの暗い所・彩度の低い所は鉄の階調）
        knob = np.hypot(xx - 747.5, yy - 510.5) < 112
        lit = 1 - np.maximum(1 - step(high, 0.10, 0.20), gray)
        wood, brass, steel = np.where(knob, 1.0, 0.0), np.where(knob, 0.0, lit), np.where(knob, 0.0, 1 - lit)
    return {"wood": wood, "steel": steel, "brass": brass, "felt": felt}


def kuji_ramp(level, stops):
    import numpy as np
    at = [p for p, _ in stops]
    colors = [[int(c[i:i + 2], 16) for i in (1, 3, 5)] for _, c in stops]
    return np.stack([np.interp(level, at, [c[i] for c in colors]) for i in range(3)], -1)


def build_kuji_looks():
    """ランク別の抽選器（garagara-<部品>-<見た目>.webp）と、軸の宝石（gem-<見た目>.webp）を作る"""
    import numpy as np
    for name, kinds in KUJI_LOOK_PARTS.items():
        with Image.open(KUJI_SOURCES / f"{name}.png") as source:
            pixels = np.asarray(source.convert("RGBA")).astype(float)
        weights = kuji_materials(name, pixels)
        luma = (0.299 * pixels[..., 0] + 0.587 * pixels[..., 1] + 0.114 * pixels[..., 2]) / 255.0
        for look, ramps in KUJI_LOOKS.items():
            color = np.zeros(pixels.shape[:2] + (3,))
            total = np.zeros(pixels.shape[:2])
            for kind in kinds:
                low, high = KUJI_LUMA[kind]
                ramp = ramps.get("knob", ramps[kind]) if (name, kind) == ("garagara-handle", "wood") else ramps[kind]
                color += kuji_ramp(np.clip((luma - low) / (high - low), 0, 1), KUJI_RAMPS[ramp]) * weights[kind][..., None]
                total += weights[kind]
            color += pixels[..., :3] * np.clip(1 - total, 0, 1)[..., None]
            painted = Image.fromarray(np.dstack([np.clip(color, 0, 255), pixels[..., 3]]).astype("uint8"), "RGBA")
            save_kuji_part(name, KUJI_PARTS[name], painted, f"{name}-{look}")
            if name == "garagara-drum":
                save_kuji_drum_blur(painted, f"garagara-drum-blur-{look}")
    # 宝石: B賞の玉の絵（塗りの球）の色相だけを替える。賞の玉（金・赤・青・白・黒）に無い色にする
    with Image.open(KUJI_SOURCES / "ball-b.png") as source:
        ball = np.asarray(source.convert("RGBA").crop(KUJI_PARTS["ball-b"]["crop"])).astype(float) / 255.0
    value = ball[..., :3].max(-1)
    sat = np.where(value > 0, (value - ball[..., :3].min(-1)) / np.where(value > 0, value, 1), 0)
    for look, ramps in KUJI_LOOKS.items():
        if "gem" not in ramps:
            continue
        sector = ramps["gem"] / 60.0
        i, f = int(sector) % 6, sector - int(sector)
        p, q, t = value * (1 - sat), value * (1 - f * sat), value * (1 - (1 - f) * sat)
        rgb = [(value, t, p), (q, value, p), (p, value, t), (p, q, value), (t, p, value), (value, p, q)][i]
        gem = Image.fromarray((np.dstack([*rgb, ball[..., 3]]) * 255).astype("uint8"), "RGBA").resize((96, 96), Image.Resampling.LANCZOS)
        path = KUJI_OUT / f"gem-{look}.webp"
        gem.save(path, "WEBP", quality=90, alpha_quality=100, method=6)
        print(f"{path.relative_to(ROOT)}: {gem.width}×{gem.height}, {path.stat().st_size:,} bytes")


def main():
    build_kuji()
    build_paper()
    build_craft_paper()
    build_craft_night()
    build_craft_stage()
    build_neo()
    build_craft_glass()
    OUT.mkdir(parents=True, exist_ok=True)
    for name, spec in SPRITES.items():
        with Image.open(SOURCES / f"{spec.get('source', name)}.png") as source:
            if source.size != spec["source_size"]:
                raise ValueError(f"{name}: update crop for new source size {source.size}")
            sprite = source.convert("RGBA").crop(spec["crop"])
            width = spec["width"]
            sprite = sprite.resize((width, round(width * sprite.height / sprite.width)), Image.Resampling.LANCZOS)
            path = OUT / f"{name}.webp"
            sprite.save(path, "WEBP", lossless=True, quality=100, method=6, exact=True)
            print(f"{path.relative_to(ROOT)}: {sprite.width}×{sprite.height}, {path.stat().st_size:,} bytes")
    for name, spec in SLOT.items():
        with Image.open(SLOT_DIR / f"{name}.png") as source:
            if source.size != spec["source_size"]:
                raise ValueError(f"{name}: update reel.css and SLOT for new source size {source.size}")
            width = spec["width"]
            sprite = source.convert("RGBA").resize((width, round(width * source.height / source.width)), Image.Resampling.LANCZOS)
            path = SLOT_DIR / f"{name}.webp"
            # 図柄はドット絵ではないので非可逆（アルファは可逆）。PNGの1/10以下になる
            sprite.save(path, "WEBP", quality=90, alpha_quality=100, method=6)
            print(f"{path.relative_to(ROOT)}: {sprite.width}×{sprite.height}, {path.stat().st_size:,} bytes")

if __name__ == "__main__":
    import sys
    # くじの絵だけ作り直す: python3 remake/tools/build_ui_skin.py kuji（ほかの原画が手元に無くても動く）
    build_kuji() if sys.argv[1:] == ["kuji"] else main()
