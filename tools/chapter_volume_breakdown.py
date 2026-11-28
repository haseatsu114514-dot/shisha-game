#!/usr/bin/env python3
"""章名付き台本の字数を、レポートの分類表に従ってCSVに出す。--chart でPNGも保存する。"""

import argparse
import csv
import re
import sys
from collections import Counter, defaultdict
from fnmatch import fnmatchcase
from pathlib import Path

from chapter_volume import ROOT, chapter_of, count_text, load_files

REPORT = ROOT / "docs/reports/dialogue-volume-breakdown-3097.md"
CATEGORIES = ("本編進行", "交流・好感度", "外出", "大会・最終戦", "日常・スポット", "仕事・配達",
              "制作練習・チュートリアル", "LIME場面", "その他")


def rules_from_report():
    defaults = {}
    exceptions = defaultdict(list)
    section = ""
    for line in REPORT.read_text(encoding="utf-8").splitlines():
        if line.startswith("#"):
            section = line
        if not line.startswith("|"):
            continue
        cells = [cell.strip() for cell in line.strip("|").split("|")]
        if section == "### ファイルごとの基本分類" and cells[0] in CATEGORIES:
            for name in re.findall(r"`([^`]+)`", cells[1]):
                if name in defaults:
                    raise ValueError(f"基本分類が重複: {name}")
                defaults[name] = cells[0]
        if section == "### 場面IDで上書きする分類" and cells[0].startswith("`"):
            name, category, patterns = cells
            if category not in CATEGORIES:
                raise ValueError(category)
            exceptions[name.strip("`")].extend((p, category) for p in re.findall(r"`([^`]+)`", patterns))
    return defaults, exceptions


def breakdown(files):
    defaults, exceptions = rules_from_report()
    if files.keys() != defaults.keys():
        raise ValueError(f"対象ファイルと分類表の差: {sorted(files.keys() ^ defaults.keys())}")
    rows = defaultdict(Counter)
    for name, data in files.items():
        subtotal = 0
        for scene in data["dialogues"]:
            scene_id = scene["dialogue_id"]
            matches = [cat for pattern, cat in exceptions[name] if fnmatchcase(scene_id, pattern)]
            if len(matches) > 1:
                raise ValueError(f"分類が重複: {name}/{scene_id}")
            chars = count_text(scene)
            rows[chapter_of(name)][matches[0] if matches else defaults[name]] += chars
            subtotal += chars
        if subtotal != count_text(data):
            raise ValueError(f"場面合計とファイルの文字数が不一致: {name}")
    return rows


def draw_chart(rows, output, font):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib import font_manager, ticker

    if font:
        font_manager.fontManager.addfont(font)
        plt.rcParams["font.family"] = font_manager.FontProperties(fname=font).get_name()
    else:
        plt.rcParams["font.family"] = ["Noto Sans CJK JP", "sans-serif"]
    colors = ["#404e8f", "#227767", "#dda63f", "#993858", "#578eb9",
              "#bd632f", "#77699a", "#899e43", "#767a80"]
    chapters = sorted(rows)
    totals = [sum(rows[ch].values()) for ch in chapters]
    bottom = [0] * len(chapters)
    fig, ax = plt.subplots(figsize=(12.8, 7.6))
    fig.subplots_adjust(left=.09, right=.98, top=.82, bottom=.21)
    fig.patch.set_facecolor("#faf9f5")
    ax.set_facecolor("#faf9f5")
    fig.text(.045, .92, "章ごとの台詞量", fontsize=30, weight="bold", color="#1c2639")
    fig.text(.046, .862, "場面の種類別 ／ 章名付き台本の全分岐・空白除く　（％は各章での割合）", fontsize=13)
    for category, color in zip(CATEGORIES, colors):
        values = [rows[ch][category] for ch in chapters]
        ax.bar(chapters, values, .68, bottom=bottom, color=color, label=category)
        for i, value in enumerate(values):
            if value >= max(totals) * .061:
                ax.text(chapters[i], bottom[i] + value / 2, f"{100 * value / totals[i]:.0f}%",
                        ha="center", va="center", color="white", weight="bold", fontsize=13)
            bottom[i] += value
    for ch, total in zip(chapters, totals):
        ax.annotate(f"{total:,}\n第1章比 {100 * total / totals[0]:.1f}%", (ch, total),
                    xytext=(0, 4), textcoords="offset points", ha="center", fontsize=11, weight="bold")
    ax.set_xticks(chapters, [f"第{ch}章" for ch in chapters], fontsize=15)
    ax.set_ylim(0, max(totals) * 1.13)
    ax.yaxis.set_major_formatter(ticker.StrMethodFormatter("{x:,.0f}"))
    ax.set_ylabel("字数（字）")
    ax.grid(axis="y", alpha=.23)
    ax.set_axisbelow(True)
    for side in ["top", "right", "left"]:
        ax.spines[side].set_visible(False)
    ax.tick_params(length=0)
    fig.legend(loc="lower center", ncol=5, frameon=False, fontsize=11, bbox_to_anchor=(.5, .035))
    fig.savefig(output, dpi=130)
    plt.close(fig)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--chart", type=Path, help="積み上げ棒グラフの保存先（要matplotlibと日本語フォント）")
    parser.add_argument("--font", help="グラフ用日本語フォントのパス")
    args = parser.parse_args()
    rows = breakdown(load_files(None))
    writer = csv.writer(sys.stdout, lineterminator="\n")
    writer.writerow(("章", *CATEGORIES, "合計"))
    for chapter, counts in sorted(rows.items()):
        writer.writerow((chapter, *(counts[c] for c in CATEGORIES), sum(counts.values())))
    if args.chart:
        draw_chart(rows, args.chart, args.font)


if __name__ == "__main__":
    main()
