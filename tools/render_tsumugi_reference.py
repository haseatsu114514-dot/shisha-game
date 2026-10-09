#!/usr/bin/env python3
"""つむぎの正規ゲームPNGから画像生成用リファレンスシート4枚を機械的に作る。

新規の人物画は描かず、5方向は既存の歩行素材、表情は現行の正規立ち絵を使用。
方向別の低解像度は「方向確認用」と明示し、未制作の高精細側面・背面を偽装しない。
"""
from __future__ import annotations
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "asset_sources/reference_sheets/tsumugi"
OUT.mkdir(parents=True, exist_ok=True)
SPR = ROOT / "assets/sprites/characters/tsumugi"
WALK = ROOT / "assets/proto_walk/tsumugi_walk_72.png"
META = ROOT / "assets/proto_walk/tsumugi_walk_72.json"
CREAM = "#FAF8F5"
PANEL = "#FFFFFF"
INK = "#302B36"
DIM = "#716A77"
LAV = "#9778AD"
SOFT = "#F0EBF4"
EDGE = "#DED7E2"

def font_path():
    for path in (
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/opentype/noto/NotoSansCJKjp-Regular.otf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ):
        if Path(path).exists():
            return path
    raise FileNotFoundError("Japanese font not installed; install fonts-noto-cjk")

FONT = font_path()
def ft(n): return ImageFont.truetype(FONT, n)
def new(w=6000, h=3500):
    im = Image.new("RGB", (w,h), CREAM)
    return im, ImageDraw.Draw(im)
def tx(d, xy, msg, sz=50, color=INK, anchor=None):
    d.text(xy, msg, font=ft(sz), fill=color, anchor=anchor)
def line(d, a,b, color=EDGE, width=3):
    d.line([a,b], fill=color, width=width)
def panel(d, box, radius=30):
    d.rounded_rectangle(box, radius, PANEL, outline=EDGE, width=3)
def header(d, title, sub, code):
    tx(d,(96,48),title,103)
    tx(d,(101,181),sub,43,DIM)
    tx(d,(5904,95),code,45,LAV,"ra")
    line(d,(96,256),(5904,256),LAV,5)
def footer(d, h, msg):
    line(d,(96,h-144),(5904,h-144),EDGE,3)
    tx(d,(96,h-104),msg,38,DIM)
def save(im, name):
    path = OUT / name
    im.save(path,optimize=True)
    print(f"OK {path.relative_to(ROOT)} {im.size[0]}x{im.size[1]}",flush=True)

def load_pose(key):
    p= SPR/f"chr_tsumugi_{key}.png"
    im=Image.open(p).convert("RGBA")
    return im
def content_bounds(im):
    return im.getchannel("A").point(lambda a: 255 if a>=16 else 0).getbbox() or (0,0,*im.size)
def fit_paste(base, art, box, *, resample=Image.Resampling.LANCZOS, crop=True):
    if crop: art=art.crop(content_bounds(art))
    x0,y0,x1,y1=map(int,box)
    scale=min((x1-x0)/art.width,(y1-y0)/art.height)
    nw,nh=max(1,round(art.width*scale)),max(1,round(art.height*scale))
    resized=art.resize((nw,nh),resample)
    if base.mode=="RGB":
        base.paste(resized,(x0+(x1-x0-nw)//2,y0+(y1-y0-nh)//2),resized)
    else:
        base.alpha_composite(resized,(x0+(x1-x0-nw)//2,y0+(y1-y0-nh)//2))
def bb_crop(im, rel):
    x0,y0,x1,y1=content_bounds(im)
    w,h=x1-x0,y1-y0
    xlo=int(x0+w*rel[0]); ylo=int(y0+h*rel[1])
    xhi=int(x0+w*rel[2]); yhi=int(y0+h*rel[3])
    return im.crop((max(0,xlo),max(0,ylo),min(im.width,xhi),min(im.height,yhi)))
def head_crop(im):
    # 頭部の大きな余白を除く。既存PNGの描線を改変しない。
    x0,y0,x1,y1=content_bounds(im)
    w,h=x1-x0,y1-y0
    return im.crop((max(0,int(x0+w*.21)),max(0,int(y0)),
                    min(im.width,int(x0+w*.79)),min(im.height,int(y0+h*.35))))
def detail_crop(im, rel):
    # head_crop()を基準とした顔の各部位の目安領域
    h=head_crop(im)
    return h.crop((int(h.width*rel[0]),int(h.height*rel[1]),
                   int(h.width*rel[2]),int(h.height*rel[3])))
def walkers():
    data=json.loads(META.read_text(encoding="utf-8"))
    sheet=Image.open(WALK).convert("RGBA")
    cw,ch=data["cell"]
    if data["cols"]!=5 or data["dirs"]!=["down","down_right","right","up_right","up"]:
        raise ValueError("歩行シートの並びが変わったため確認が必要")
    if sheet.size != (cw*5,ch*2):
        raise ValueError(f"歩行シート寸法不一致: {sheet.size}")
    return {name:sheet.crop((i*cw,0,(i+1)*cw,ch)) for i,name in enumerate(data["dirs"])},data

NORMAL=load_pose("normal")
EXPRESSIONS = [
    ("通常","normal","正規立ち絵"),
    ("微笑み","smile","正規立ち絵"),
    ("喜び（参考）","bow","会釈の穏やかな笑顔で代用・専用表情未制作"),
    ("真剣","serious","正規立ち絵"),
    ("驚き","surprise","正規立ち絵"),
    ("困り顔","sad","正規立ち絵：悲しみの表情を参考"),
]

def sheet_directions():
    art,meta=walkers()
    im,d=new(6000,3380)
    header(d,"つむぎ｜全身・5方向","現行の歩行スプライトを同一縮尺で表示｜正規高精細立ち絵と用途が異なります","01 / 04")
    names=[
        ("正面","down"),
        ("真横","right"),
        ("背面","up"),
        ("斜め前","down_right"),
        ("斜め後ろ","up_right"),
    ]
    for i,(label,k) in enumerate(names):
        x=92+i*1178
        panel(d,(x,317,x+1139,3105))
        tx(d,(x+52,365),label,74)
        tx(d,(x+52,462),"ゲーム内歩行画・Aコマ",40,DIM)
        # 各セル54x76を共通19倍で拡大。靴の底の位置を統一。
        walk=art[k]
        scaled=walk.resize((walk.width*19,walk.height*19),Image.Resampling.NEAREST)
        im.paste(scaled,(x+(1139-scaled.width)//2,2050-scaled.height),scaled)
        line(d,(x+60,2082),(x+1079,2082),EDGE,3)
        close=walk.crop((8,0,46,37))
        fit_paste(im,close,(x+140,2185,x+1000,2770),resample=Image.Resampling.NEAREST,crop=False)
        tx(d,(x+570,2905),"頭部拡大（低解像度）",39,DIM,"mm")
    footer(d,im.height,"全方向は既存素材そのもの。高精細の横顔・背面立ち絵は未制作／補完デザインの捏造なし。")
    save(im,"01-5-directions.png")

def sheet_expressions():
    im,d=new(6000,3680)
    header(d,"つむぎ｜全身と表情","公式PNG 6点を同じ倍率・同じ基準位置で並べた参照集","02 / 04")
    for i,(label,key,note) in enumerate(EXPRESSIONS):
        c=i%3; r=i//3
        x=90+c*1974; y=315+r*1555
        panel(d,(x,y,x+1913,y+1509))
        tx(d,(x+57,y+42),label,69)
        tx(d,(x+60,y+134),note,35,DIM)
        pose=load_pose(key)
        # 各正規PNGは同じ896x1200キャンバス。単一倍率で表示しサイズ変更の差を作らない。
        fixed=pose.resize((900,1206),Image.Resampling.LANCZOS)
        im.paste(fixed,(x+42,y+245),fixed)
        hc=head_crop(pose)
        fit_paste(im,hc,(x+1040,y+366,x+1837,y+1130))
        tx(d,(x+1430,y+1192),"顔の拡大",44,DIM,"mm")
        tx(d,(x+1430,y+1340),key,40,LAV,"mm")
    footer(d,im.height,"※「喜び」専用立ち絵は未確認。会釈の笑顔を参考表示／別の表情が存在すると誤記しない。")
    save(im,"02-expressions.png")

def sheet_faces():
    walks,_=walkers()
    im,d=new(6000,3300)
    header(d,"つむぎ｜顔・髪・パーツ","正面顔は正規立ち絵／横・45度はゲーム内歩行素材の頭部（低解像度）","03 / 04")
    specs=[("顔：正面",head_crop(NORMAL),"立ち絵から直接切り出し",False),
           ("顔：真横",walks["right"].crop((5,0,49,42)),"歩行スプライト由来",True),
           ("顔：斜め45°",walks["down_right"].crop((5,0,49,42)),"歩行スプライト由来",True)]
    for i,(title,face,note,nearest) in enumerate(specs):
        x=92+i*1974
        panel(d,(x,313,x+1915,1810))
        tx(d,(x+62,366),title,72)
        tx(d,(x+62,460),note,42,DIM)
        fit_paste(im,face,(x+150,562,x+1765,1660),resample=Image.Resampling.NEAREST if nearest else Image.Resampling.LANCZOS)
    part=[("目","瞳・まぶた・ハイライト",(.07,.37,.93,.68)),
          ("眉","角度・太さ",(.08,.26,.93,.52)),
          ("鼻","陰影・位置",(.33,.56,.71,.81)),
          ("口","小さな口元",(.29,.71,.73,.94))]
    for i,(title,note,crop) in enumerate(part):
        x=92+i*1482
        panel(d,(x,1880,x+1424,2995))
        tx(d,(x+60,1925),title,68)
        tx(d,(x+60,2017),note,40,DIM)
        art=detail_crop(NORMAL,crop)
        fit_paste(im,art,(x+66,2140,x+1352,2825))
        tx(d,(x+712,2898),"正面立ち絵の拡大（無修正）",34,DIM,"mm")
    footer(d,im.height,"髪：丸い短め茶色ボブ／自然に分かれた前髪／頬沿いの横髪／髪飾りなし。後髪の詳しい形は方向素材を参照。")
    save(im,"03-face-hair-parts.png")

def colors_from_original():
    # 色名は公式外見定義に沿う。色値は原画の全ピクセルからターゲットに近い不透明色を抽出する。
    targets=[
        ("髪","ダークブラウン",(83,60,57)),
        ("瞳","赤茶",(125,67,54)),
        ("肌","あたたかい明色",(241,192,174)),
        ("上着","深いプラム紫",(91,67,107)),
        ("スカート・靴下","黒～チャコール",(43,37,48)),
        ("刺繍","くすんだラベンダー",(178,124,164)),
        ("葉模様","黄土～金",(178,140,77)),
        ("タブレット","チャコール",(43,45,51))
    ]
    colors=NORMAL.convert("RGBA").getdata()
    import math
    sample=[p[:3] for p in colors if p[3]>=220]
    # 小さくサンプルして量を減らす。画像内の実在画素を必ず返す。
    sample=sample[::max(1,len(sample)//90000)]
    ret=[]
    for label,description,target in targets:
        best=min(sample,key=lambda p:sum((p[j]-target[j])**2 for j in range(3)))
        ret.append((label,description,"#%02X%02X%02X"%best))
    return ret

def sheet_clothes():
    im,d=new(6000,3780)
    header(d,"つむぎ｜衣装・持ち物・カラー","正規立ち絵の切り出し・実ピクセルから近似スポイト／衣装変更を禁止","04 / 04")
    panel(d,(89,323,1910,3510))
    tx(d,(148,385),"全身・基準図",75)
    fit_paste(im,NORMAL,(152,520,1835,3310),crop=False)
    details=[
        ("髪／前髪・横髪",(.18,.00,.82,.32)),
        ("パーカー／刺繍",(.06,.25,.95,.63)),
        ("スカート・脚・靴",(.07,.58,.94,1.00)),
        ("タブレットと手",(.03,.27,.97,.69))
    ]
    for i,(label,bounds) in enumerate(details):
        c=i%2;r=i//2
        x=1975+c*1984;y=325+r*1178
        panel(d,(x,y,x+1900,y+1108))
        tx(d,(x+58,y+43),label,65)
        detail=bb_crop(NORMAL,bounds)
        fit_paste(im,detail,(x+90,y+167,x+1807,y+1006))
    panel(d,(1975,2715,5843,3510))
    tx(d,(2033,2770),"カラーパレット｜元PNGの近似色",63)
    palette=colors_from_original()
    for i,(label,desc,color) in enumerate(palette):
        x=2041+(i%4)*941;y=2883+(i//4)*285
        d.rounded_rectangle((x,y,x+115,y+116),19,color,outline=EDGE,width=2)
        tx(d,(x+140,y+7),label,46)
        tx(d,(x+140,y+61),color,40,LAV)
    footer(d,im.height,"タブレットに微細なヒビ／花刺繍／ひざ下ソックス／紐靴。見えない箇所の素材・背面は補完デザイン対象。")
    save(im,"04-outfit-palette.png")
    return palette

def main():
    missing=[str(p) for p in [WALK,META]+[SPR/f"chr_tsumugi_{k}.png" for _,k,_ in EXPRESSIONS] if not p.exists()]
    if missing: raise FileNotFoundError("Missing official assets:\n"+"\n".join(missing))
    sheet_directions()
    sheet_expressions()
    sheet_faces()
    palette=sheet_clothes()
    manifest={
        "character":"つむぎ",
        "production":"existing approved game source assets; no identity-redrawing",
        "files":[f"{i:02d}-{name}.png" for i,name in [(1,"5-directions"),(2,"expressions"),(3,"face-hair-parts"),(4,"outfit-palette")]],
        "sources":{
            "sprites":"assets/sprites/characters/tsumugi/chr_tsumugi_*.png",
            "walk":"assets/proto_walk/tsumugi_walk_72.png",
            "walk_metadata":"assets/proto_walk/tsumugi_walk_72.json",
            "canon_prompt":".claude/skills/character-portrait-remaster/references/tsumugi-v1-prompt.txt"},
        "notes":[
            "5方向のもとは低解像度歩行スプライト。高精細三面図に偽装しない。",
            "喜びの専用表情は未制作、会釈イラストを参考として表示。",
            "高精細真横・背面・斜め前後、後ろ身頃の刺繍位置や素材感は補完デザイン／今後新規生成が必要。",
            "元画像から確定できない身長は追記しない。"
        ],
        "sampled_palette":[{"part":p,"description":d,"hex":h} for p,d,h in palette]
    }
    (OUT/"manifest.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("SUCCESS 4 sheets + manifest",flush=True)

if __name__=="__main__":main()
