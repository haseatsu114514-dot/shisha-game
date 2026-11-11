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


def build_kuji():
    KUJI_OUT.mkdir(parents=True, exist_ok=True)
    for name, spec in KUJI_PARTS.items():
        source_name = "ball-" + name.split("-", 1)[1] if name.startswith("ball-") else name
        with Image.open(KUJI_SOURCES / f"{source_name}.png") as source:
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
            path = KUJI_OUT / f"{name}.webp"
            if alpha:
                # exact=False: 透明な所の色は捨ててよい（明るさを透明度に移したきらめきは、暗い所の色が荒れて重くなる）
                image.save(path, "WEBP", quality=88, alpha_quality=100, method=6, exact=not spec.get("luma_alpha"))
            else:
                image.save(path, "WEBP", quality=85, method=6)
            print(f"{path.relative_to(ROOT)}: {image.width}×{image.height}, {path.stat().st_size:,} bytes")


def main():
    build_kuji()
    build_paper()
    build_craft_paper()
    build_craft_night()
    build_craft_stage()
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
