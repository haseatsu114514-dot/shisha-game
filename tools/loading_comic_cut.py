#!/usr/bin/env python3
"""ロード画面の2コマ漫画: 規格テンプレートの生成・原画からのコマ切り出し・3:2化・検品。

規格の正本は asset_sources/loading-comics/README.md。表示側は 1コマ = 3:2 の固定枠
（remake/css/loading.css --loading-panel-ratio）。本ツールは生成AIが描いた原画の
コマ枠（濃い線の矩形）を検出し、2コマを同じ比率・同じ寸法の WebP 2枚に揃えて、
登録用スニペットを出す。

使い方:
  # 1. Codex に渡す下敷き（1536x1024・コマ枠2つだけの紙面）と、人向けの寸法ガイド
  python3 tools/loading_comic_cut.py template --out-dir asset_sources/loading-comics/template

  # 2. 受け取った原画（下敷きを埋めた1枚、または旧来の段組みシート）から2コマを切り出す
  python3 tools/loading_comic_cut.py sheet 原画.png --id mashiro-body-clock [--row 1] [--fit pad|cover|none]

  # 3. コマごとに1枚ずつ生成した場合（1536x1024 の全面がコマ）
  python3 tools/loading_comic_cut.py panel 左.png 右.png --id mashiro-body-clock

  # 4. 出来上がった WebP が規格どおりか（3:2・寸法・容量）
  python3 tools/loading_comic_cut.py check remake/img/loading/mashiro-body-clock-*.webp

--dry-run で書き込まずに検出結果だけ見られる。Pillow と numpy だけで動く（scipy 不要）。
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

# ---- 規格（README と一致させる） -------------------------------------------------
CANVAS = (1536, 1024)          # Codex / GPT 画像生成の横長サイズ
PANEL = (720, 480)             # 1コマの作画枠（3:2）
GUTTER = 24                    # コマ間
MARGIN_X = (CANVAS[0] - PANEL[0] * 2 - GUTTER) // 2   # = 36
PANEL_Y = (CANVAS[1] - PANEL[1]) // 2                   # = 272（上下中央）
PAPER = (0xEE, 0xE3, 0xCF)     # 紙色。ゲームのカード地色（css/loading.css .loading-card）と同じ
INK = (0x2C, 0x1F, 0x2A)       # コマ枠の線色（css/loading.css のコマ枠線と同じ）
FRAME_PX = 3                   # 下敷きのコマ枠線の太さ（枠の外側に引く）
SAFE_RATIO = 0.04              # 枠の縁から各辺 4% は吹き出し・重要な線を置かない
TARGET_RATIO = 3 / 2
OUT_SIZE = (1440, 960)         # 配信用 WebP の上限寸法（拡大はしない）
WEBP_QUALITY = 85
PAD_BAND = (1.35, 1.65)        # この範囲は紙色で足して 3:2 に整える（片側 ≤ 5% の帯）
WARN_BAND = (1.25, 1.80)       # ここまでは警告つきで通す。外れたら作り直し
RANK = {"ok": 0, "warn": 1, "reject": 2}


@dataclass
class Box:
    x: int
    y: int
    w: int
    h: int

    @property
    def ratio(self) -> float:
        return self.w / self.h

    def as_region(self, src_w: int, src_h: int) -> dict:
        return {"x": self.x, "y": self.y, "width": self.w, "height": self.h,
                "sourceWidth": src_w, "sourceHeight": src_h}


# ---- 検出 --------------------------------------------------------------------------
def load_rgb(path: Path) -> np.ndarray:
    return np.asarray(Image.open(path).convert("RGB"))


def paper_color(img: np.ndarray) -> np.ndarray:
    """外周 1.5% の中央値を紙色とみなす（下敷き・シートとも外周は紙）。"""
    h, w = img.shape[:2]
    m = max(4, int(min(h, w) * 0.015))
    ring = np.concatenate([img[:m].reshape(-1, 3), img[-m:].reshape(-1, 3),
                           img[:, :m].reshape(-1, 3), img[:, -m:].reshape(-1, 3)])
    return np.median(ring, axis=0)


def runs(flags: np.ndarray, min_len: int, merge_gap: int = 0) -> list[tuple[int, int]]:
    """True の連続区間 [start, end) を返す。短い切れ目は結合し、min_len 未満は捨てる。"""
    out: list[list[int]] = []
    start = None
    for i, f in enumerate(flags):
        if f and start is None:
            start = i
        elif not f and start is not None:
            out.append([start, i]); start = None
    if start is not None:
        out.append([start, len(flags)])
    merged: list[list[int]] = []
    for s, e in out:
        if merged and s - merged[-1][1] <= merge_gap:
            merged[-1][1] = e
        else:
            merged.append([s, e])
    return [(s, e) for s, e in merged if e - s >= min_len]


def strip_border(img: np.ndarray, box: Box, max_px: int = 16) -> Box:
    """枠線（濃い線）が box の縁にあれば、その線（と線までの数pxの紙）を除いて内側へ寄せる。"""
    lum = img.mean(axis=2)
    x0, y0, x1, y1 = box.x, box.y, box.x + box.w, box.y + box.h
    pad = 6

    def frac_row(y: int, cut: int) -> float:
        seg = lum[y, x0 + pad:x1 - pad]; return (seg < cut).mean() if seg.size else 0.0

    def frac_col(x: int, cut: int) -> float:
        seg = lum[y0 + pad:y1 - pad, x]; return (seg < cut).mean() if seg.size else 0.0

    def advance(pos: int, step: int, frac) -> int:
        # 線の手前の紙（最大 6px）を飛ばし、線の芯（黒 85% 超・最大 8px）と縁のにじみ（35% 超・最大 3px）を
        # 越えた位置を返す。線が無ければ元の位置。枠に接した暗い絵柄（灰色）まで削らないよう、芯は黒（lum<70）で判定する。
        probe = pos
        for _ in range(6):
            if frac(probe, 70) > 0.6: break
            probe += step
        else:
            return pos
        for _ in range(8):
            if frac(probe, 70) > 0.85: probe += step
            else: break
        for _ in range(3):
            if frac(probe, 110) > 0.35: probe += step
            else: break
        return probe

    y0 = advance(y0, 1, frac_row); y1 = advance(y1 - 1, -1, frac_row) + 1
    x0 = advance(x0, 1, frac_col); x1 = advance(x1 - 1, -1, frac_col) + 1
    return Box(x0, y0, x1 - x0, y1 - y0)


def _closed(dark: np.ndarray, axis: int, gap: int = 2) -> np.ndarray:
    """線の細い切れ目（gap px まで）を埋める。"""
    out = dark.copy()
    for k in range(1, gap + 1):
        out |= np.roll(dark, k, axis=axis) | np.roll(dark, -k, axis=axis)
    return out


def _row_runs(flags: np.ndarray, min_len: int) -> list[list[tuple[int, int]]]:
    """各行の True 区間 [x0, x1) のうち min_len 以上のものを全部返す。"""
    n, m = flags.shape
    padded = np.zeros((n, m + 2), dtype=bool); padded[:, 1:-1] = flags
    d = np.diff(padded.astype(np.int8), axis=1)
    out: list[list[tuple[int, int]]] = []
    for i in range(n):
        starts = np.flatnonzero(d[i] == 1); ends = np.flatnonzero(d[i] == -1)
        out.append([(int(s0), int(e0)) for s0, e0 in zip(starts, ends) if e0 - s0 >= min_len])
    return out


def _line_bands(row_runs: list[list[tuple[int, int]]], tol: int) -> list[tuple[int, int, int, int]]:
    """隣り合う行で x 範囲がほぼ同じ区間をまとめ、枠線の候補 (y0, y1, x0, x1) を返す。

    同じ行に複数の線（左右のコマの上辺など）があっても別々に扱う。枠線に暗い絵柄が接していると
    帯が太くなるので、太い帯は「上端の線」と「下端の線」の2候補に分ける（上辺は帯の上端、下辺は帯の下端）。
    """
    open_: list[dict] = []
    done: list[dict] = []
    for y, segs in enumerate(row_runs):
        still = []
        for band in open_:
            hit = next((sg for sg in segs if abs(sg[0] - band["x0"]) <= tol and abs(sg[1] - band["x1"]) <= tol), None)
            if hit is not None and band["y1"] == y:
                band["y1"] = y + 1; band["xs"].append(hit); segs = [sg for sg in segs if sg is not hit]; still.append(band)
            else:
                done.append(band)
        open_ = still
        for sg in segs:
            open_.append({"y0": y, "y1": y + 1, "x0": sg[0], "x1": sg[1], "xs": [sg]})
    done.extend(open_)
    out = []
    for band in done:
        xs = np.array(band["xs"]); thick = band["y1"] - band["y0"]
        if thick <= 8:
            out.append((band["y0"], band["y1"], int(np.median(xs[:, 0])), int(np.median(xs[:, 1]))))
        else:
            head, tail = xs[:4], xs[-4:]
            out.append((band["y0"], band["y0"] + 1, int(np.median(head[:, 0])), int(np.median(head[:, 1]))))
            out.append((band["y1"] - 1, band["y1"], int(np.median(tail[:, 0])), int(np.median(tail[:, 1]))))
    return sorted(set(out))


def detect_frames(img: np.ndarray, debug: bool = False) -> list[Box]:
    """濃い線で囲まれたコマ枠（矩形）を見つける。段組みシート・下敷き・全面コマのいずれにも使う。

    横線は「x の範囲がほぼ同じ上下の線」で、その両端を縦線が切れ目なくつなぐものを枠とみなす
    （描いた枠線は連続しているので、縦線に途切れがあれば別の段の線と組んだ誤りとして捨てる）。
    ページ全体の外枠（面積 60% 超）と、枠の中に描かれた小さな矩形（他の枠に含まれる）は捨てる。
    """
    h, w = img.shape[:2]
    dark = img.mean(axis=2) < 100
    tol = max(4, int(w * 0.012))
    # 手描き風の線は数px上下にうねるので、縦に 3px 埋めてから横の連続区間を取る
    vdark = _closed(dark, axis=0, gap=3)
    hlines = _line_bands(_row_runs(_closed(vdark, axis=1), min_len=int(w * 0.18)), tol=tol)
    if debug:
        print(f"  [debug] 横線候補 {len(hlines)} 本: " + ", ".join(f"y={y0}..{y1} x={x0}..{x1}" for y0, y1, x0, x1 in hlines))
    found: list[Box] = []
    for i, (ay0, ay1, ax0, ax1) in enumerate(hlines):
        for by0, by1, bx0, bx1 in hlines[i + 1:]:
            if by0 - ay1 < h * 0.06 or abs(ax0 - bx0) > tol or abs(ax1 - bx1) > tol:
                continue
            x0, x1 = min(ax0, bx0), max(ax1, bx1)
            band = vdark[ay1:by0]
            if not band[:, max(0, x0 - 2):x0 + 6].any(axis=1).all() or not band[:, max(0, x1 - 6):x1 + 2].any(axis=1).all():
                continue
            box = Box(x0, ay0, x1 - x0, by1 - ay0)
            if box.w * box.h <= 0.6 * w * h:
                found.append(box)
    found.sort(key=lambda b: b.w * b.h, reverse=True)
    kept: list[Box] = []
    for b in found:
        inside = any(b.x >= k.x - tol and b.y >= k.y - tol and b.x + b.w <= k.x + k.w + tol and
                     b.y + b.h <= k.y + k.h + tol for k in kept)
        if not inside:
            kept.append(b)
    return [strip_border(img, b) for b in kept]


def group_rows(boxes: list[Box], h: int) -> list[list[Box]]:
    rows_: list[list[Box]] = []
    for b in sorted(boxes, key=lambda b: (b.y, b.x)):
        if rows_ and abs(rows_[-1][0].y - b.y) < max(12, h * 0.03):
            rows_[-1].append(b)
        else:
            rows_.append([b])
    return [sorted(r, key=lambda b: b.x) for r in rows_]


# ---- 整形 --------------------------------------------------------------------------
def fit_panel(src: Image.Image, mode: str, paper: tuple[int, int, int]) -> tuple[Image.Image, str]:
    w, h = src.size
    ratio = w / h
    note = f"{w}x{h} ({ratio:.3f})"
    if mode == "none" or abs(ratio - TARGET_RATIO) < 0.004:
        return src, note + " そのまま"
    if mode == "cover":
        if ratio > TARGET_RATIO:
            nw = round(h * TARGET_RATIO); x = (w - nw) // 2
            return src.crop((x, 0, x + nw, h)), note + f" → 左右を各{(w - nw) / 2 / w:.1%}切り落とし"
        nh = round(w / TARGET_RATIO); y = (h - nh) // 2
        return src.crop((0, y, w, y + nh)), note + f" → 上下を各{(h - nh) / 2 / h:.1%}切り落とし"
    # pad: 紙色で足して 3:2 に
    if ratio > TARGET_RATIO:
        nh = round(w / TARGET_RATIO); canvas = Image.new("RGB", (w, nh), paper)
        canvas.paste(src, (0, (nh - h) // 2))
        return canvas, note + f" → 上下に各{(nh - h) / 2 / nh:.1%}の紙帯"
    nw = round(h * TARGET_RATIO); canvas = Image.new("RGB", (nw, h), paper)
    canvas.paste(src, ((nw - w) // 2, 0))
    return canvas, note + f" → 左右に各{(nw - w) / 2 / nw:.1%}の紙帯"


def shrink_to(img: Image.Image, limit: tuple[int, int]) -> Image.Image:
    w, h = img.size
    if w <= limit[0] and h <= limit[1]:
        return img
    s = min(limit[0] / w, limit[1] / h)
    return img.resize((round(w * s), round(h * s)), Image.LANCZOS)


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def judge_ratio(ratio: float) -> str:
    if PAD_BAND[0] <= ratio <= PAD_BAND[1]:
        return "ok"
    if WARN_BAND[0] <= ratio <= WARN_BAND[1]:
        return "warn"
    return "reject"


# ---- サブコマンド ------------------------------------------------------------------
def cmd_template(args: argparse.Namespace) -> int:
    out_dir = Path(args.out_dir); out_dir.mkdir(parents=True, exist_ok=True)
    frames = [(MARGIN_X, PANEL_Y), (MARGIN_X + PANEL[0] + GUTTER, PANEL_Y)]
    # 下敷き: 紙とコマ枠だけ。文字・番号・ガイド線は描かない（生成結果に写るため）。
    base = Image.new("RGB", CANVAS, PAPER)
    d = ImageDraw.Draw(base)
    for fx, fy in frames:
        d.rectangle([fx - FRAME_PX, fy - FRAME_PX, fx + PANEL[0] + FRAME_PX - 1, fy + PANEL[1] + FRAME_PX - 1],
                    outline=INK, width=FRAME_PX)
    base_path = out_dir / f"2koma_template_{CANVAS[0]}x{CANVAS[1]}.png"
    base.save(base_path, optimize=True)
    # 寸法ガイド（人が読む用。Codex には渡さない）
    guide = base.copy(); g = ImageDraw.Draw(guide)
    sx, sy = round(PANEL[0] * SAFE_RATIO), round(PANEL[1] * SAFE_RATIO)
    for i, (fx, fy) in enumerate(frames, 1):
        g.rectangle([fx + sx, fy + sy, fx + PANEL[0] - sx - 1, fy + PANEL[1] - sy - 1], outline=(0xD8, 0x96, 0x3F), width=2)
        g.text((fx + 12, fy + 10), f"panel {i}: {PANEL[0]}x{PANEL[1]} (3:2)  x={fx} y={fy}", fill=INK)
        g.text((fx + sx + 8, fy + PANEL[1] - sy - 18), f"safe margin {SAFE_RATIO:.0%} = {sx}x{sy}px", fill=(0xB8, 0x65, 0x1F))
    g.text((MARGIN_X, 24), f"canvas {CANVAS[0]}x{CANVAS[1]}  margin {MARGIN_X}  gutter {GUTTER}  frame {FRAME_PX}px {'#%02X%02X%02X' % INK}  paper {'#%02X%02X%02X' % PAPER}", fill=INK)
    g.text((MARGIN_X, CANVAS[1] - 40), "reading order: panel 1 -> panel 2 (left to right). no title / episode number / signature in the image", fill=INK)
    guide_path = out_dir / f"2koma_template_{CANVAS[0]}x{CANVAS[1]}_guide.png"
    guide.save(guide_path, optimize=True)
    print(f"下敷き: {base_path}\nガイド: {guide_path}")
    print(f"コマ枠: 左 x={frames[0][0]} y={frames[0][1]} / 右 x={frames[1][0]} y={frames[1][1]} / 各 {PANEL[0]}x{PANEL[1]}")
    return 0


def emit(args: argparse.Namespace, panels: list[tuple[Image.Image, str]],
         sources: list[tuple[Path, Box | None, tuple[int, int]]]) -> int:
    out_dir = Path(args.out_dir); out_dir.mkdir(parents=True, exist_ok=True)
    img_root = Path("remake/img").resolve()
    rel_dir = out_dir.resolve().relative_to(img_root) if out_dir.resolve().is_relative_to(img_root) else None
    records = []
    for i, (im, note) in enumerate(panels, 1):
        im = shrink_to(im, OUT_SIZE)
        dest = out_dir / f"{args.id}-{i}.webp"
        line = f"コマ{i}: {note} → 出力 {im.size[0]}x{im.size[1]}"
        if im.size[0] < PANEL[0]:
            line += "  [警告: 原画が小さい。新規制作は 1536x1024 の下敷き（コマ 720x480）以上で]"
        if not args.dry_run:
            im.save(dest, "WEBP", quality=WEBP_QUALITY, method=6)
            line += f"  {dest} ({dest.stat().st_size // 1024} KiB)"
        print(line)
        records.append({"file": dest.name, "width": im.size[0], "height": im.size[1],
                        "sha256": sha256(dest) if dest.exists() and not args.dry_run else None})
    src_rel = f"{rel_dir.as_posix()}/" if rel_dir else f"{out_dir.as_posix()}/"
    snippet = {"id": args.id, "title": args.title or "（題名）", "contexts": ["craft"], "minChapter": args.min_chapter,
               "note": "番外編のギャグ漫画です。左から右へお読みください。",
               "caption": args.caption or "（初心者向けの一行解説。省略可）",
               "panels": [{"src": f"{src_rel}{r['file']}", "alt": "（読む順に沿った説明）"} for r in records]}
    print("\n--- loading-comics.js へ貼る登録（src は imgFileUrl(\"...\") で包む・alt を書く） ---")
    print(json.dumps(snippet, ensure_ascii=False, indent=2))
    print("\n--- 素材台帳（comics.json）用 ---")
    print(json.dumps({"source": [{"file": p.as_posix(), "region": (b.as_region(*sz) if b else None)} for p, b, sz in sources],
                      "delivery": records}, ensure_ascii=False, indent=2))
    return 0


def report_pair(boxes: list[Box]) -> str:
    verdict = "ok"
    for i, b in enumerate(boxes, 1):
        j = judge_ratio(b.ratio)
        if RANK[j] > RANK[verdict]: verdict = j
        print(f"  コマ{i}: {b.w}x{b.h} @({b.x},{b.y}) 比率 {b.ratio:.3f} → {j}")
    if len(boxes) == 2 and (abs(boxes[0].h - boxes[1].h) > max(6, 0.03 * boxes[0].h) or
                            abs(boxes[0].w - boxes[1].w) > max(6, 0.06 * boxes[0].w)):
        print("  [警告] 左右のコマ寸法が揃っていません。表示では同じ 3:2 枠に収めますが、次回は下敷きの枠を守らせてください")
    return verdict


def cmd_sheet(args: argparse.Namespace) -> int:
    path = Path(args.sheet)
    img = load_rgb(path); h, w = img.shape[:2]
    paper = paper_color(img)
    rows_ = group_rows(detect_frames(img, debug=args.debug), h)
    if not rows_:
        print("コマ枠（濃い線の矩形）が見つかりません。下敷きの枠線を残して描かせてください", file=sys.stderr); return 2
    print(f"原画 {w}x{h}  紙色 #{int(paper[0]):02X}{int(paper[1]):02X}{int(paper[2]):02X}  枠の段 {len(rows_)}: " +
          ", ".join(f"{len(r)}コマ@y={r[0].y}" for r in rows_))
    if args.row < 1 or args.row > len(rows_):
        print(f"--row は 1..{len(rows_)} で指定してください", file=sys.stderr); return 2
    boxes = rows_[args.row - 1]
    if len(boxes) != 2:
        print(f"{args.row} 段目のコマ枠が {len(boxes)} 個です（2個が必要）。検出: " +
              ", ".join(f"{b.w}x{b.h}@({b.x},{b.y})" for b in boxes), file=sys.stderr)
        return 2
    verdict = report_pair(boxes)
    if verdict == "reject" and not args.force:
        print(f"比率が許容帯 {WARN_BAND} の外です。作り直してください（--force で無理に通せます）", file=sys.stderr); return 3
    if args.fit == "cover" and verdict != "ok":
        print("  [注意] cover は縁を切り落とします。吹き出しが縁に近い原画では pad を使ってください")
    pil = Image.open(path).convert("RGB")
    panels = [fit_panel(pil.crop((b.x, b.y, b.x + b.w, b.y + b.h)), args.fit, tuple(int(c) for c in paper)) for b in boxes]
    return emit(args, panels, [(path, b, (w, h)) for b in boxes])


def cmd_panel(args: argparse.Namespace) -> int:
    panels, sources = [], []
    for p in args.images:
        path = Path(p); img = load_rgb(path); h, w = img.shape[:2]
        paper = paper_color(img)
        frames = [b for b in detect_frames(img, debug=args.debug) if b.w * b.h >= 0.25 * w * h]
        box = frames[0] if len(frames) == 1 else None
        b = box or Box(0, 0, w, h)
        j = judge_ratio(b.ratio)
        print(f"{path.name}: {'検出した枠' if box else '全面'} {b.w}x{b.h} 比率 {b.ratio:.3f} → {j}")
        if j == "reject" and not args.force:
            print(f"比率が許容帯 {WARN_BAND} の外です。作り直してください", file=sys.stderr); return 3
        pil = Image.open(path).convert("RGB").crop((b.x, b.y, b.x + b.w, b.y + b.h))
        panels.append(fit_panel(pil, args.fit, tuple(int(c) for c in paper)))
        sources.append((path, box, (w, h)))
    if len(panels) != 2:
        print("コマは2枚指定してください（左・右の順）", file=sys.stderr); return 2
    return emit(args, panels, sources)


def cmd_check(args: argparse.Namespace) -> int:
    bad = 0
    for p in args.images:
        path = Path(p); im = Image.open(path); w, h = im.size; r = w / h
        ok = abs(r - TARGET_RATIO) <= 0.01 and w <= OUT_SIZE[0] and h <= OUT_SIZE[1]
        size_kib = path.stat().st_size // 1024
        flag = "OK " if ok else "NG "
        print(f"{flag} {path}: {w}x{h} 比率 {r:.3f} {size_kib} KiB" +
              ("" if ok else "  ← 3:2・1440x960 以下にする") + ("  ← 400 KiB 超。品質を下げる" if size_kib > 400 else ""))
        bad += 0 if ok else 1
    return 1 if bad else 0


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    t = sub.add_parser("template", help="下敷きとガイド画像を作る")
    t.add_argument("--out-dir", default="asset_sources/loading-comics/template")
    t.set_defaults(fn=cmd_template)

    def common(p: argparse.ArgumentParser) -> None:
        p.add_argument("--id", required=True, help="登録id（例: mashiro-body-clock）。出力は <id>-1.webp / <id>-2.webp")
        p.add_argument("--title", default="", help="題名（スニペット用）")
        p.add_argument("--caption", default="", help="一行解説（スニペット用）")
        p.add_argument("--min-chapter", type=int, default=1)
        p.add_argument("--out-dir", default="remake/img/loading")
        p.add_argument("--fit", choices=["pad", "cover", "none"], default="pad",
                       help="3:2 への揃え方: pad=紙色を足す（既定）/ cover=縁を切る / none=比率を保つ（表示側でレターボックス）")
        p.add_argument("--force", action="store_true", help="比率が許容帯の外でも出力する")
        p.add_argument("--dry-run", action="store_true")
        p.add_argument("--debug", action="store_true", help="検出した横線を表示する")

    s = sub.add_parser("sheet", help="原画1枚（下敷き入り or 段組みシート）から2コマを切り出す")
    s.add_argument("sheet"); s.add_argument("--row", type=int, default=1, help="段組みシートの何段目か（上から1）")
    common(s); s.set_defaults(fn=cmd_sheet)
    pn = sub.add_parser("panel", help="コマごとの画像2枚（左・右）を揃える")
    pn.add_argument("images", nargs="+"); common(pn); pn.set_defaults(fn=cmd_panel)
    c = sub.add_parser("check", help="配信用 WebP の規格確認")
    c.add_argument("images", nargs="+"); c.set_defaults(fn=cmd_check)
    args = ap.parse_args(argv)
    return args.fn(args)


if __name__ == "__main__":
    sys.exit(main())
