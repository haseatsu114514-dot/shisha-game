"""原画を変更せず、第一選別用の一覧と拡大比較を作る。"""
import json
from pathlib import Path
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from PIL import Image

BASE = Path(__file__).resolve().parent
ROOT = BASE.parents[3]
DATA = json.loads((BASE / "review.json").read_text())
LABEL = {"revise": "修正推奨", "inspect": "要確認", "retain": "第一選別に残す提案"}
COLOR = {"revise": "#b42318", "inspect": "#946200", "retain": "#1b6350"}
plt.rcParams["font.family"] = "Noto Sans CJK JP"

def full(ax, row):
    with Image.open(ROOT / row["path"]) as source:
        ax.imshow(source)
    ax.axis("off")

def crop(ax, row):
    full(ax, row)
    left, top, right, bottom = row["roi"]
    ax.set_xlim(left, right)
    ax.set_ylim(bottom, top)

for group in range(3):
    rows = DATA["items"][group * 5 : (group + 1) * 5]
    fig, axes = plt.subplots(1, 5, figsize=(16, 5.65), dpi=130)
    for ax, row in zip(axes, rows, strict=True):
        full(ax, row)
        ax.set_title(row["id"] + "  " + LABEL[row["ai_recommendation"]],
                     color=COLOR[row["ai_recommendation"]], fontsize=12)
        ax.text(.5, -.035, row["name"], transform=ax.transAxes,
                ha="center", va="top", fontsize=10, wrap=True)
    fig.suptitle("第一選別 " + str(group + 1) + "/3：AI所見・全案まだ未採用", fontsize=16)
    fig.tight_layout(rect=(0, .025, 1, .92))
    fig.savefig(BASE / ("candidates-" + str(group + 1) + ".jpg"), facecolor="white")
    plt.close(fig)

for category, filename, notes in [
    ("revise", "revision-picks.jpg", [
        "煙の始点が唇から外れ、頬から出ているように見える。",
        "煙の始点がハンドル先端に重なり、口元から出ていない。"]),
    ("inspect", "inspection-picks.jpg", [
        "煙の先端と唇に隙間。流れた煙とも読めるので、破綻の断定はしない。",
        "器の脚が傾く。戻す途中の動作か静置かを確認。破綻の断定はしない。"])
]:
    rows = [row for row in DATA["items"] if row["ai_recommendation"] == category]
    fig = plt.figure(figsize=(11, 10.7), dpi=140)
    grid = fig.add_gridspec(2, 2, width_ratios=(1, 1.9), hspace=.32, wspace=.12)
    for i, (row, note) in enumerate(zip(rows, notes, strict=True)):
        ax = fig.add_subplot(grid[i, 0]); full(ax, row)
        ax.set_title(row["id"] + "  " + row["name"].split("：", 1)[0], fontsize=14,
                     color=COLOR[category])
        ax = fig.add_subplot(grid[i, 1]); crop(ax, row)
        ax.set_title("原画の拡大・補筆なし", fontsize=12)
        ax.text(.5, -.05, note, transform=ax.transAxes, ha="center", va="top", fontsize=11)
    fig.suptitle(LABEL[category] + "：顔と構図を残して個別に判断", fontsize=17)
    fig.savefig(BASE / filename, facecolor="white", bbox_inches="tight")
    plt.close(fig)
print("PASS: 15 latest candidate thumbnails + 4 original detail regions")
