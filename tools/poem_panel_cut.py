#!/usr/bin/env python3
"""巻頭ポエムの横長コマ絵: 規格テンプレートの生成・原画からの切り出し・比率の整え・検品。

規格の正本は brand/chant_poems.md §8。表示側は remake/js/scenes/chapter-poem.js（.cp-panel は絵の比率のまま
出す。4:1〜16:3 の横長）。本ツールは生成AIが描いた原画（下敷きの枠を埋めた1枚）から枠の中だけを切り出し、
横長の WebP にする。ロード画面の漫画（tools/loading_comic_cut.py）と同じ方式。
下敷きの枠は 16:3 だが、生成AIは枠を縦に少し伸ばしがち（実績: 1440x327・1440x350）。4:1 までは絵を欠かさず
そのまま使い、それより外れたものだけ整える（2026-11-08。16:3 に切ると顔や小物が欠けたため）。

使い方:
  # 1. Codex に渡す下敷き（1536x1024・横長の枠1つだけの紙面）と、人向けの寸法ガイド
  python3 tools/poem_panel_cut.py template --out-dir asset_sources/poem-panels/template

  # 2. 受け取った原画から枠の中を切り出して 16:3 の WebP にする（--dry-run で検出結果だけ見る）
  python3 tools/poem_panel_cut.py cut 原画.png --id poem_ch1 [--fit cover|pad] [--out-dir remake/img/ui/poems]

  # 3. 出来上がった WebP が規格どおりか
  python3 tools/poem_panel_cut.py check remake/img/ui/poems/poem_ch1.webp

  # 4. ツール自身の確認（ブラウザ・外部ファイル不要）
  python3 tools/poem_panel_cut.py selftest

Pillow と numpy だけで動く。
"""
from __future__ import annotations

import argparse
import sys
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

# ---- 規格（brand/chant_poems.md §8 と一致させる） ---------------------------------
CANVAS = (1536, 1024)               # Codex / GPT 画像生成の横長サイズ
PAPER = (0xEE, 0xE3, 0xCF)          # 紙色 #EEE3CF（ロード画面の漫画と同じ）
INK = (0x2C, 0x1F, 0x2A)            # 枠線 #2C1F2A
LINE = 3                            # 枠線の太さ
FRAME_W, FRAME_H = 1440, 270        # 16:3
FRAME_X, FRAME_Y = (CANVAS[0] - FRAME_W) // 2, (CANVAS[1] - FRAME_H) // 2   # 48, 377
RATIO = 16 / 3                      # 下敷きの枠の比率
RATIO_MIN, RATIO_MAX = 4.0, 5.6     # この範囲の横長は、絵の比率のまま使う（表示側も同じ範囲）
SAFE = 0.04                         # 枠の縁から各辺4%の内側に、顔・重要な線を収める
OUT_WIDTH = 1920                    # 配信用の幅（高さは 360）。原画が小さければ拡大しない
MAX_BYTES = 400 * 1024
FIT_WARN = 0.15                     # 範囲の外でも、近い端から 15% 以内は cover（中央を切る）か pad（紙色を足す）。超えたら作り直し


def make_template(guide: bool = False) -> Image.Image:
    img = Image.new("RGB", CANVAS, PAPER)
    d = ImageDraw.Draw(img)
    box = (FRAME_X, FRAME_Y, FRAME_X + FRAME_W - 1, FRAME_Y + FRAME_H - 1)
    d.rectangle(box, outline=INK, width=LINE)
    if guide:  # 人が寸法を確認する方（Codex には添付しない）
        sx, sy = round(FRAME_W * SAFE), round(FRAME_H * SAFE)
        d.rectangle((box[0] + sx, box[1] + sy, box[2] - sx, box[3] - sy), outline=(200, 60, 60), width=1)
        d.line((CANVAS[0] // 2, box[1], CANVAS[0] // 2, box[3]), fill=(60, 120, 200), width=1)
        d.text((FRAME_X, FRAME_Y - 18), f"frame {FRAME_W}x{FRAME_H} (16:3) at x={FRAME_X} y={FRAME_Y} / safe margin {SAFE:.0%} (red)", fill=(60, 60, 60))
    return img


def _luma(arr: np.ndarray) -> np.ndarray:
    return arr[..., 0] * 0.299 + arr[..., 1] * 0.587 + arr[..., 2] * 0.114


def _best_line(dark: np.ndarray, axis: int, lo: int, hi: int, span: tuple[int, int]) -> tuple[int, float]:
    """lo〜hi の行（axis=0）または列（axis=1）のうち、span の範囲で暗い画素の割合が最大の位置"""
    best, best_frac = -1, 0.0
    for pos in range(max(lo, 0), min(hi, dark.shape[axis])):
        line = dark[pos, span[0]:span[1]] if axis == 0 else dark[span[0]:span[1], pos]
        frac = float(line.mean()) if line.size else 0.0
        if frac > best_frac:
            best, best_frac = pos, frac
    return best, best_frac


def find_frame(img: Image.Image) -> tuple[tuple[int, int, int, int] | None, str]:
    """下敷きの枠（濃い線の矩形）を、期待位置の近くから探す。戻り値は (内側の left, top, right, bottom)、見つからなければ None"""
    arr = np.asarray(img.convert("RGB"), dtype=np.float32)
    h, w = arr.shape[:2]
    sx, sy = w / CANVAS[0], h / CANVAS[1]
    ex0, ey0, ew, eh = FRAME_X * sx, FRAME_Y * sy, FRAME_W * sx, FRAME_H * sy
    dark = _luma(arr) < 90
    win = round(48 * min(sx, sy))
    x_span = (round(ex0 + ew * .1), round(ex0 + ew * .9))
    top, ft = _best_line(dark, 0, round(ey0) - win, round(ey0) + win, x_span)
    bottom, fb = _best_line(dark, 0, round(ey0 + eh) - win, round(ey0 + eh) + round(140 * sy), x_span)
    if min(ft, fb) < .8 or bottom - top < eh * .5:
        return None, f"上下の枠線が見つからない（暗い画素の割合 上{ft:.2f}／下{fb:.2f}）"
    y_span = (top + round(10 * sy), bottom - round(10 * sy))
    left, fl = _best_line(dark, 1, round(ex0) - win, round(ex0) + win, y_span)
    right, fr = _best_line(dark, 1, round(ex0 + ew) - win, round(ex0 + ew) + win, y_span)
    if min(fl, fr) < .8 or right - left < ew * .5:
        return None, f"左右の枠線が見つからない（暗い画素の割合 左{fl:.2f}／右{fr:.2f}）"

    def inset(pos: int, step: int, axis: int, span: tuple[int, int]) -> int:
        # 枠線の太さの分だけ内側へ進む（線の画素が半分を切るまで）。絵の濃い線を食い込みすぎないよう最大 12px
        for _ in range(12):
            nxt = pos + step
            line = dark[nxt, span[0]:span[1]] if axis == 0 else dark[span[0]:span[1], nxt]
            if line.mean() < .5:
                break
            pos = nxt
        return pos + step

    x_inner = (left + 1, right - 1)
    box = (inset(left, 1, 1, y_span), inset(top, 1, 0, x_inner), inset(right, -1, 1, y_span), inset(bottom, -1, 0, x_inner))
    return box, f"枠を検出: 外側 x={left}〜{right} y={top}〜{bottom}"


def fit_to_ratio(img: Image.Image, mode: str) -> tuple[Image.Image, str]:
    """4:1〜5.6:1 はそのまま。外れたら近い端の比率へ、15% 以内なら整え、それ以上は作り直し"""
    w, h = img.size
    r = w / h
    if RATIO_MIN <= r <= RATIO_MAX:
        return img, f"比率 {r:.3f}（横長の範囲 {RATIO_MIN:g}〜{RATIO_MAX:g} の内）。絵を欠かさずそのまま使う"
    target = RATIO_MIN if r < RATIO_MIN else RATIO_MAX
    dev = abs(r - target) / target
    if dev > FIT_WARN:
        raise SystemExit(f"比率 {r:.3f} が横長の範囲（{RATIO_MIN:g}〜{RATIO_MAX:g}）から {dev:.0%} 外れている。枠の外へはみ出した・枠が崩れた可能性。作り直し")
    if mode == "pad":
        if r > target:  # 横長すぎ → 上下に紙色
            nh = round(w / target)
            out = Image.new("RGB", (w, nh), PAPER)
            out.paste(img, (0, (nh - h) // 2))
        else:           # 縦長すぎ → 左右に紙色
            nw = round(h * target)
            out = Image.new("RGB", (nw, h), PAPER)
            out.paste(img, ((nw - w) // 2, 0))
        return out, f"比率 {r:.3f}（範囲から {dev:.1%} 外れ）。紙色を足して {target:g}:1 に整えた"
    if r > target:      # 横長すぎ → 左右を切る
        nw = round(h * target)
        x = (w - nw) // 2
        return img.crop((x, 0, x + nw, h)), f"比率 {r:.3f}（範囲から {dev:.1%} 外れ）。左右を中央で切って {target:g}:1 に整えた"
    nh = round(w / target)
    y = (h - nh) // 2
    return img.crop((0, y, w, y + nh)), f"比率 {r:.3f}（範囲から {dev:.1%} 外れ）。上下を中央で切って {target:g}:1 に整えた"


def to_delivery(img: Image.Image) -> Image.Image:
    width = min(OUT_WIDTH, img.width) // 16 * 16
    return img.resize((width, max(1, round(width * img.height / img.width))), Image.LANCZOS)


def save_webp(img: Image.Image, path: Path) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    for quality in (88, 84, 80, 76, 72, 68, 64):
        img.save(path, "WEBP", quality=quality, method=6)
        if path.stat().st_size <= MAX_BYTES:
            break
    return path.stat().st_size


def cmd_template(args) -> int:
    out = Path(args.out_dir)
    out.mkdir(parents=True, exist_ok=True)
    make_template().save(out / "poem_panel_template_1536x1024.png")
    make_template(guide=True).save(out / "poem_panel_template_1536x1024_guide.png")
    print(f"下敷きを書き出した: {out}/poem_panel_template_1536x1024.png（Codex に添付する方）・_guide.png（人が確認する方。添付しない）")
    print(f"枠: {FRAME_W}x{FRAME_H}（16:3）x={FRAME_X} y={FRAME_Y}。紙色 #{PAPER[0]:02X}{PAPER[1]:02X}{PAPER[2]:02X}")
    return 0


def cut_image(src: Path, mode: str = "cover") -> tuple[Image.Image, list[str]]:
    img = Image.open(src).convert("RGB")
    notes = [f"原画 {img.width}x{img.height}"]
    r = img.width / img.height
    if RATIO_MIN <= r <= RATIO_MAX:
        notes.append("原画がすでに横長なので、枠の検出は省く")
        inner = img
    else:
        box, note = find_frame(img)
        notes.append(note)
        if box is None:
            raise SystemExit("; ".join(notes) + "。下敷きの枠を保ったまま描かれていない。作り直し")
        inner = img.crop(box)
        notes.append(f"枠の内側 {inner.width}x{inner.height}")
    fitted, note = fit_to_ratio(inner, mode)
    notes.append(note)
    return to_delivery(fitted), notes


def cmd_cut(args) -> int:
    out_img, notes = cut_image(Path(args.src), args.fit)
    for n in notes:
        print("-", n)
    dest = Path(args.out_dir) / f"{args.id}.webp"
    print(f"- 出力 {out_img.width}x{out_img.height}（{out_img.width / out_img.height:.2f}:1）→ {dest}")
    if args.dry_run:
        print("--dry-run: 書き込まない")
        return 0
    size = save_webp(out_img, dest)
    print(f"- 保存した: {dest}（{size // 1024} KiB）")
    print(f'- 台本の更新: data/dialogue/chapter_poems.json の {args.id} の metadata.panel を "{args.id}.webp" にする')
    print("- 新規画像は Git LFS: git lfs install --skip-repo のあと git add し、git lfs ls-files で確認する")
    return 0


def check_file(path: Path) -> list[str]:
    problems = []
    img = Image.open(path)
    r = img.width / img.height
    if not RATIO_MIN - 0.01 <= r <= RATIO_MAX + 0.01:
        problems.append(f"{path.name}: 比率 {r:.3f}（横長の範囲 {RATIO_MIN:g}〜{RATIO_MAX:g} の外）")
    if img.width < 960:
        problems.append(f"{path.name}: 幅 {img.width}px は小さい（960px 以上）")
    if img.width > OUT_WIDTH:
        problems.append(f"{path.name}: 幅 {img.width}px は大きい（{OUT_WIDTH}px 以下）")
    if path.stat().st_size > MAX_BYTES:
        problems.append(f"{path.name}: {path.stat().st_size // 1024} KiB は大きい（{MAX_BYTES // 1024} KiB 以下）")
    return problems


def cmd_check(args) -> int:
    bad = 0
    for f in args.files:
        problems = check_file(Path(f))
        print(("NG " if problems else "OK ") + str(f))
        for p in problems:
            print("   ", p)
        bad += bool(problems)
    return 1 if bad else 0


def cmd_selftest(_args) -> int:
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        # 1) 下敷きを埋めた原画（枠の内側に濃い線の絵も描く）から、16:3 の WebP が出る
        art = make_template()
        d = ImageDraw.Draw(art)
        inner = (FRAME_X + 6, FRAME_Y + 6, FRAME_X + FRAME_W - 7, FRAME_Y + FRAME_H - 7)
        d.rectangle(inner, fill=(250, 245, 235))
        for i in range(0, FRAME_W, 60):
            d.line((FRAME_X + i, FRAME_Y + 8, FRAME_X + i + 90, FRAME_Y + FRAME_H - 8), fill=(20, 20, 30), width=4)
        d.ellipse((FRAME_X + 600, FRAME_Y + 60, FRAME_X + 820, FRAME_Y + 220), fill=(30, 30, 40))
        src = tmp / "art.png"
        art.save(src)
        out, notes = cut_image(src)
        assert abs(out.width / out.height - RATIO) / RATIO < 0.03, ("下敷きどおりの枠は 16:3 に近いまま", out.size)
        assert 1400 <= out.width <= FRAME_W and out.width % 16 == 0, ("枠線の内側だけを使い、原画が小さいので拡大しない", out.size)
        dest = tmp / "poem_x.webp"
        save_webp(out, dest)
        assert not check_file(dest), check_file(dest)
        # 2) 少しずれた枠でも見つかる（位置が +14px / -9px ずれ・絵の内側にも濃い線がある）
        shifted = Image.new("RGB", CANVAS, PAPER)
        shifted.paste(art, (14, -9))
        s_src = tmp / "shifted.png"
        shifted.save(s_src)
        out2, _ = cut_image(s_src)
        assert abs(out2.width / out2.height - RATIO) / RATIO < 0.03, out2.size
        # 2b) 生成AIが枠を縦に伸ばした原画（実績 1440x350）でも、絵を欠かさずそのままの比率で使う
        tall = Image.new("RGB", CANVAS, PAPER)
        d2 = ImageDraw.Draw(tall)
        d2.rectangle((FRAME_X, FRAME_Y, FRAME_X + FRAME_W - 1, FRAME_Y + 350 - 1), outline=INK, width=LINE)
        d2.ellipse((FRAME_X + 500, FRAME_Y + 40, FRAME_X + 700, FRAME_Y + 300), fill=(30, 30, 40))
        t_src = tmp / "tall.png"
        tall.save(t_src)
        out_t, notes_t = cut_image(t_src)
        assert 4.0 <= out_t.width / out_t.height <= 4.2, ("縦に伸びた枠はそのまま", out_t.size, notes_t)
        # 3) すでに 16:3 の画像は、枠を探さずにそのまま使う
        wide = Image.new("RGB", (3200, 600), (200, 210, 220))
        w_src = tmp / "wide.png"
        wide.save(w_src)
        out3, _ = cut_image(w_src)
        assert out3.size == (1920, 360), out3.size
        # 3b) 枠の内側が範囲の外（3.6:1）なら 4:1 に整える
        out4, _ = fit_to_ratio(Image.new("RGB", (1440, 400), (90, 90, 90)), "cover")
        assert abs(out4.width / out4.height - RATIO_MIN) < 0.02, out4.size
        # 4) 枠が無い・比率が大きく違う画像は作り直しにする
        for name, size in (("plain.png", CANVAS), ("square.png", (1024, 1024))):
            Image.new("RGB", size, PAPER).save(tmp / name)
            try:
                cut_image(tmp / name)
            except SystemExit:
                continue
            raise AssertionError(f"{name} は作り直しになるはず")
        # 5) pad と cover の整形
        wide = Image.new("RGB", (1800, 300), (10, 10, 10))   # 6:1 → 5.6:1 へ
        padded, _ = fit_to_ratio(wide, "pad")
        covered, _ = fit_to_ratio(wide, "cover")
        assert abs(padded.width / padded.height - RATIO_MAX) < 0.02 and abs(covered.width / covered.height - RATIO_MAX) < 0.02
        # 6) 下敷き自体が 16:3
        assert FRAME_W * 3 == FRAME_H * 16
    print("poem_panel_cut selftest OK")
    return 0


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    t = sub.add_parser("template", help="Codex に渡す下敷きを書き出す")
    t.add_argument("--out-dir", default="asset_sources/poem-panels/template")
    t.set_defaults(fn=cmd_template)
    c = sub.add_parser("cut", help="原画から枠の中を切り出して 16:3 の WebP にする")
    c.add_argument("src")
    c.add_argument("--id", required=True, help="詩のID（poem_prologue / poem_ch1 〜 poem_ch5）")
    c.add_argument("--fit", choices=("cover", "pad"), default="cover")
    c.add_argument("--out-dir", default="remake/img/ui/poems")
    c.add_argument("--dry-run", action="store_true")
    c.set_defaults(fn=cmd_cut)
    k = sub.add_parser("check", help="WebP が規格どおりか")
    k.add_argument("files", nargs="+")
    k.set_defaults(fn=cmd_check)
    s = sub.add_parser("selftest", help="ツール自身の確認")
    s.set_defaults(fn=cmd_selftest)
    args = p.parse_args()
    return args.fn(args)


if __name__ == "__main__":
    sys.exit(main())
