#!/usr/bin/env python3
"""Deterministic typography only. Generated artwork is never retouched."""
from pathlib import Path
import argparse, json, hashlib
from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parent
SIZE = (1280, 720)
JP = next(Path('/System/Library/Fonts').glob('*角*シック W8.ttc'))
MINCHO = next(Path('/System/Library/Fonts').glob('*明朝 ProN.ttc'))
EN = Path('/System/Library/Fonts/Supplemental/Times New Roman.ttf')
CONDENSED = Path('/System/Library/Fonts/Supplemental/Arial Narrow Bold.ttf')
ITALIC = Path('/System/Library/Fonts/Supplemental/Arial Narrow Bold Italic.ttf')
DIN = Path('/System/Library/Fonts/Supplemental/DIN Condensed Bold.ttf')

def font(size, serif=False, english=False):
    return ImageFont.truetype(str(EN if english else MINCHO if serif else JP), size)

def spaced(layer, s, x, baseline, size, color, tracking=0, serif=False, english=False, face=None, index=0):
    d=ImageDraw.Draw(layer); f=ImageFont.truetype(str(face),size,index=index) if face else font(size,serif,english)
    for ch in s:
        d.text((x,baseline),ch,font=f,fill=color,anchor='ls')
        x+=d.textlength(ch,font=f)+tracking
    return x

def brand(layer,x,baseline,color,serif=False):
    end=spaced(layer,'水煙前線',x,baseline,25,color,3,serif)
    spaced(layer,'-EN:CODE-',end+20,baseline,23,color,1,english=True)

def metal(layer,s,x,baseline,size):
    f=font(size); d=ImageDraw.Draw(layer)
    d.text((x+2,baseline+4),s,font=f,fill=(12,6,29,255),stroke_width=5,stroke_fill=(14,5,34,255),anchor='ls')
    d.text((x,baseline),s,font=f,fill=(167,110,236,255),stroke_width=2,stroke_fill=(182,124,239,255),anchor='ls')
    mask=Image.new('L',SIZE,0); ImageDraw.Draw(mask).text((x,baseline),s,font=f,fill=255,anchor='ls')
    grad=Image.new('RGBA',SIZE); gd=ImageDraw.Draw(grad)
    top=baseline-size; stops=[(0,(247,243,255)),(.34,(216,224,246)),(.5,(97,98,132)),(.55,(233,234,255)),(1,(119,124,157))]
    for y in range(max(0,top),min(720,baseline+4)):
        t=max(0,min(1,(y-top)/size))
        for (a,ca),(b,cb) in zip(stops,stops[1:]):
            if a<=t<=b:
                q=(t-a)/(b-a); c=tuple(round(v+(w-v)*q) for v,w in zip(ca,cb));break
        gd.line([(0,y),(1279,y)],fill=c+(255,))
    layer.alpha_composite(Image.composite(grad,Image.new('RGBA',SIZE),mask))

def typography(n):
    t=Image.new('RGBA',SIZE)
    if n==5:
        spaced(t,'CHAPTER 5',60,99,42,(211,182,255,255),4,face=DIN)
        metal(t,'機械',54,285,106)
        metal(t,'仕掛けの神',58,397,78)
        spaced(t,'Deus Ex Machina',62,451,26,(217,203,241,255),2,face=DIN)
        end=spaced(t,'水煙前線',60,652,23,(226,219,247,255),2)
        spaced(t,'-EN:CODE-',60,683,24,(226,219,247,255),2,face=DIN)
    elif n==2:
        spaced(t,'CHAPTER 2',58,105,27,(30,45,83,255),4,face=CONDENSED)
        spaced(t,'才能',58,273,113,(248,55,144,255),4)
        spaced(t,'の壁',114,390,108,(248,55,144,255),4)
        spaced(t,'才能',53,268,113,(19,26,42,255),4)
        spaced(t,'の壁',109,385,108,(19,26,42,255),4)
        spaced(t,'Jealousy Haze',59,449,29,(27,43,88,255),1,face=ITALIC)
        d=ImageDraw.Draw(t)
        d.text((56,650),'水煙前線',font=font(23),fill=(250,245,235,255),stroke_width=2,stroke_fill=(17,34,96,255),anchor='ls')
        d.text((57,681),'-EN:CODE-',font=ImageFont.truetype(str(CONDENSED),23),fill=(250,245,235,255),stroke_width=2,stroke_fill=(17,34,96,255),anchor='ls')
    elif n==3:
        spaced(t,'CHAPTER 3',57,102,20,(183,202,217,255),4,english=True)
        for i,ch in enumerate('虚ろな王冠'):
            spaced(t,ch,104,210+i*67,54,(231,235,229,255),serif=True)
        spaced(t,'Hollow Crown',57,555,20,(206,220,226,255),2,english=True)
        spaced(t,'水煙前線',57,654,21,(214,226,235,255),4,True)
        spaced(t,'-EN:CODE-',57,682,18,(214,226,235,255),2,english=True)
    elif n==4:
        brand(t,56,61,(29,43,53,255),True)
        spaced(t,'CHAPTER 4',58,148,22,(77,76,60,255),3,english=True)
        spaced(t,'継承',51,280,101,(22,38,51,255),8,face=MINCHO,index=1)
        spaced(t,'の煙',160,378,88,(22,38,51,255),8,face=MINCHO,index=1)
        spaced(t,'Legacy Smoke',61,439,24,(45,55,55,255),2,english=True)
    return t

def build(n,manifest):
    item=next(c for c in manifest['chapters'] if c['chapter']==n)
    src=ROOT/item['original']; assert hashlib.sha256(src.read_bytes()).hexdigest()==item['original_sha256']
    original=Image.open(src).convert('RGB')
    plate=ImageOps.fit(original,SIZE,method=Image.Resampling.LANCZOS)
    t=typography(n); final=Image.alpha_composite(plate.convert('RGBA'),t).convert('RGB')
    plate.save(ROOT/'plates'/f'ch{n}-art.png'); t.save(ROOT/'layers'/f'ch{n}-type.png'); final.save(ROOT/'images'/f'ch{n}-title.png')
    return final

if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('--chapter',type=int,choices=[2,3,4,5]); a=ap.parse_args()
    manifest=json.loads((ROOT/'generation.json').read_text())
    for n in ([a.chapter] if a.chapter else [2,3,4,5]):
        build(n,manifest);print(f'Built chapter {n}: 1280x720, separate type layer')
