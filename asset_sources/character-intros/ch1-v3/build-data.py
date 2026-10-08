"""Build review metadata; original portrait PNGs are only read, never modified."""
import hashlib
import json
from pathlib import Path
from copy import deepcopy
from PIL import Image

base = Path(__file__).resolve().parent
root = base.parents[2]
master = {c["id"]: c for c in json.loads((root / "data/characters.json").read_text())}
master["kafuka"] = json.loads((root / "data/dialogue/kafuka.json").read_text())["profile"]
previous = {c["id"]: c for c in json.loads((base.parent / "personality-v2/characters.json").read_text())}
palette = {
 "hajime": ("#eee0bd", "#fff5dc", "smoke", "キャップ・マウスピース・煙"),
 "sumi": ("#ad603b", "#f0c79f", "embers", "炭・トング・ハガル"),
 "tsumugi": ("#bd95d4", "#eaddf4", "sketch", "葉耳と煙の尾を持つ猫・ペン"),
 "oneesan": ("#929b77", "#e6e9cf", "quiet", "カップ・静かな煙・波紋"),
 "naru": ("#eada39", "#fff5ad", "speed", "バニラの莢・斜線"),
 "adam": ("#ce3d40", "#85c96d", "duality", "左の青りんご（緑）・右の赤りんご・対になる円"),
 "minto": ("#36c59c", "#ffdbeb", "hearts", "ミントの葉・ハート・チェキ"),
 "rin": ("#5a60b6", "#cfd5ff", "witch", "サンプル缶・試香紙・ブルーベリー"),
 "kafuka": ("#298bdb", "#a6ddff", "shark", "王冠を被ったサメ・波"),
 "nagumo": ("#afbccc", "#e7edf4", "judgment", "ネクタイ・審査の円"),
 "maezono": ("#398384", "#bfe5df", "press", "誌面・眼鏡・ペン"),
 "dr_kemuri": ("#39d7e7", "#cafaff", "science", "温度計・計測円・六角格子・グラフ"),
 "pakki": ("#f58232", "#ffe0ac", "stage", "マイク・蝶ネクタイ・音の波"),
 "ageha": ("#e956a5", "#ffd7eb", "butterfly", "クマ・グミベア・肉球"),
}
shadows = {
 "hajime":"#29251b", "sumi":"#351608", "tsumugi":"#251034", "oneesan":"#1a2a10",
 "naru":"#292c05", "adam":"#092d18", "minto":"#042f22", "rin":"#131746",
 "kafuka":"#082a48", "nagumo":"#152539", "maezono":"#062d30", "dr_kemuri":"#032d3a",
 "pakki":"#3a1905", "ageha":"#3b0829"
}

def names(c):
 import re
 raw = c.get("full_name", c["name"])
 paren = re.search("（([^）]*)）", raw)
 inner = paren[1].split(" / ") if paren else []
 outer = re.sub("（[^）]*）", "", raw).split(" / ")
 main = c.get("display_name") or (outer[0] if len(outer) > 1 else inner[1] if len(inner) > 1 else outer[0].replace(" ", ""))
 return main.strip(), ""

def portrait_meta(cid, face):
 folder = "minto" if cid == "oneesan" else cid
 source = root / "assets/sprites/characters" / folder / ("chr_" + folder + "_" + face + ".png")
 authority = "採用済みゲーム立ち絵"
 if cid in previous:
  source = base.parent / "personality-v2" / previous[cid]["portrait"]
  authority = "前回の登場モックアップに使用した制作済み立ち絵"
 if cid in ("maezono", "pakki"):
  source = root / "asset_sources/portraits" / (cid + "-remaster-v1") / (face + "-preview.png")
  authority = "採用済み再制作立ち絵の確認用PNG（PR #225で本編採用済み）"
 with Image.open(source) as im:
  bounds = im.getchannel("A").point(lambda a: 255 if a >= 20 else 0).getbbox()
  # Strong three-quarter portrait framing. Short mascot stays entirely visible.
  target_height = 560 if cid == "pakki" else 1140
  scale = target_height / (bounds[3] - bounds[1])
  source_head_x = (bounds[0] + bounds[2]) / 2
  if cid in previous and "source_head_center" in previous[cid]["frame"]:
   source_head_x = previous[cid]["frame"]["source_head_center"]
  frame = {"width": round(im.width * scale, 3),
           "left": round(304 - source_head_x * scale, 3),
           "top": round((100 if cid == "pakki" else 38) - bounds[1] * scale, 3)}
  if cid in ("hajime", "sumi", "tsumugi"):
   frame["left"] = round(frame["left"] - 36, 3)
 return {"portrait": str(source.relative_to(root)), "frame": frame,
         "portrait_sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
         "portrait_authority": authority}

records = []
for cid, (accent, secondary, motif, label) in palette.items():
 c = master[cid]
 intro = c.get("intro_cutin") or previous[cid]
 name, full = names(c)
 face = intro.get("face", intro.get("expression", "normal"))
 record = {"id": cid, "name": name, "full": full, "title": intro["title"], "line": intro["line"],
           "expression": face, "color": accent, "secondary": secondary, "shadow": shadows[cid], "motif": motif, "motif_label": label,
           **portrait_meta(cid, face), "caption_source": "data/characters.json: " + cid + ".intro_cutin"}
 record["name_layout"] = "呼び名のみ。括弧付きの本名は表示せず、本名はストーリーの名乗りで扱う。"
 variants = {}
 for style, filename in (("geometric", "geometric.png"), ("illustrated", "source.png")):
  image_path = base / "backgrounds" / cid / filename
  if image_path.exists():
   variants[style] = {"src": str(image_path.relative_to(root)),
                     "sha256": hashlib.sha256(image_path.read_bytes()).hexdigest()}
 if variants:
  record["backgrounds"] = variants
 if cid == "kafuka":
  record["caption_source"] = "data/dialogue/kafuka.json: profile.intro_cutin"
 if cid == "hajime":
  record.update(name="はじめ", full="", caption_source="前回モックアップの提示案。ゲームの台詞・設定は変更しない")
 if cid == "ageha":
  first = c["intro_cutin_unknown"]
  unknown = deepcopy(record)
  unknown.update(id="ageha_unknown", name=first["display_name"], full="", title=first["title"], line=first["line"],
                 expression=first["face"], **portrait_meta(cid, first["face"]),
                 caption_source="data/characters.json: ageha.intro_cutin_unknown",
                 select_label="？？？（初遭遇）", scope_note="第1章DAY4・買い出しの帰りに荷物を拾ってもらう初遭遇。名前・本名・バイブスは開示しない。")
  records.append(unknown)
  record.update(select_label="あげは（第2章）", scope_note="第2章の名乗り後。プロとしてのserious表情。初遭遇版とは別素材。")
 records.append(record)
(base / "characters.json").write_text(json.dumps(records, ensure_ascii=False, indent=2) + "\n")
print("Prepared " + str(len(records)) + " original-portrait compositions")
