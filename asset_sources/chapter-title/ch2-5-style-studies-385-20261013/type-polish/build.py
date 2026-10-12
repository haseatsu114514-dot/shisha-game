#!/usr/bin/env python3
"""Composite generated lettering, separate small type and unchanged art plates."""
from pathlib import Path
import json,hashlib
from PIL import Image,ImageDraw,ImageFont,ImageOps

ROOT=Path(__file__).resolve().parent
SIZE=(1280,720)
JP=next(Path('/System/Library/Fonts').glob('*明朝 ProN.ttc'))
EN=Path('/System/Library/Fonts/Supplemental/Times New Roman.ttf')
ITALIC=Path('/System/Library/Fonts/Supplemental/Times New Roman Italic.ttf')
LABEL=next(Path('/System/Library/Fonts').glob('*角*シック W4.ttc'))

def spaced(im,text,x,y,size,color,tracking=0,path=EN):
    d=ImageDraw.Draw(im);f=ImageFont.truetype(str(path),size)
    for ch in text:
        d.text((x,y),ch,font=f,fill=color,anchor='ls');x+=d.textlength(ch,font=f)+tracking
    return x

def centered(im,text,cx,y,size,color,tracking=0,path=EN):
    f=ImageFont.truetype(str(path),size);w=sum(f.getlength(ch) for ch in text)+tracking*(len(text)-1)
    return spaced(im,text,cx-w/2,y,size,color,tracking,path)

def brand(im,x,y,color):
    end=spaced(im,'水煙前線',x,y,20,color,3,JP)
    spaced(im,'-EN:CODE-',end+15,y,18,color,.8)

def build(row,m):
    n=row['chapter'];key=row['id'];im=Image.open(ROOT/row['original']).convert('RGBA')
    assert hashlib.sha256((ROOT/row['original']).read_bytes()).hexdigest()==row['sha256']
    # Only crop transparent padding; retain every generated pixel and its alpha.
    glyph=im.crop(tuple(row['content_bbox']))
    specs={
      'ch2-01-vertical':((72,155),(250,388)),
      'ch2-02-horizontal':((52,186),(410,145)),
      'ch3-01-rain-mincho':((83,148),(225,430)),
      'ch4-02-modern-legacy':((54,223),(455,160)),
      'ch5-01-chrome-mincho':((52,212),(420,288)),
      'ch5-02-platinum-brush':((52,188),(420,350)),
    }
    (x,y),box=specs[key];glyph.thumbnail(box,Image.Resampling.LANCZOS)
    t=Image.new('RGBA',SIZE);t.alpha_composite(glyph,(x,y))
    pale=(223,215,234,255)
    if n==2:
        brand(t,58,58,pale)
        spaced(t,'CHAPTER 2',60,119,22,(222,194,213,255),4)
        ey=589 if key.endswith('vertical') else 361
        spaced(t,'Jealousy Haze',68,ey,24,pale,1.4,ITALIC)
    elif n==3:
        brand(t,57,58,(43,55,64,255))
        spaced(t,'CHAPTER 3',59,112,20,(53,69,79,255),4)
        spaced(t,'Hollow Crown',69,624,22,(49,63,72,255),1.5)
    elif n==4:
        brand(t,58,63,(31,67,70,255))
        spaced(t,'CHAPTER 4',61,145,24,(36,72,74,255),4)
        spaced(t,'Legacy Smoke',62,437,24,(35,69,71,255),1.8,ITALIC)
    elif n==5:
        brand(t,58,58,(222,216,239,255))
        spaced(t,'CHAPTER 5',60,132,24,(199,178,229,255),4)
        ey=529 if key.endswith('brush') else 481
        spaced(t,'Deus Ex Machina',62,ey,24,(214,198,233,255),1.5,ITALIC)
    src=ROOT/m['scene_sources'][str(n)]
    assert hashlib.sha256(src.read_bytes()).hexdigest()==m['scene_sha256'][str(n)]
    plate=ImageOps.fit(Image.open(src).convert('RGB'),SIZE,method=Image.Resampling.LANCZOS)
    out=Image.alpha_composite(plate.convert('RGBA'),t).convert('RGB')
    plate.save(ROOT/'plates'/f'ch{n}-art.png')
    t.save(ROOT/'layers'/f'{key}.png');out.save(ROOT/'images'/f'{key}.png')
    row['layout']={'generated_crop':row['content_bbox'],'position':[x,y],'rendered_size':list(glyph.size)}
    return out,t

m=json.loads((ROOT/'manifest.json').read_text())
active=[r for r in m['assets'] if r['id'] in {'ch2-01-vertical','ch2-02-horizontal','ch3-01-rain-mincho','ch4-02-modern-legacy','ch5-01-chrome-mincho','ch5-02-platinum-brush'}]
for row in active:
    out,t=build(row,m)
    if m['defaults'].get(str(row['chapter']))==row['id']:
        out.save(ROOT/'images'/f"default-ch{row['chapter']}.png")
        t.save(ROOT/'layers'/f"default-ch{row['chapter']}.png")
    print(row['id'],row['layout'])
label=ImageFont.truetype(str(LABEL),18)
sheet=Image.new('RGB',(1360,880),'#16121c');d=ImageDraw.Draw(sheet)
d.text((30,18),'第2章C・第5章 — 生成した章題の比較',font=label,fill='#e8dff0')
items=[('ch2-01-vertical','2章 01 — 縦の明朝'),('ch2-02-horizontal','2章 02 — 横の明朝'),('ch5-01-chrome-mincho','5章 01 — クローム明朝'),('ch5-02-platinum-brush','5章 02 — 白金の筆文字')]
for i,(key,caption) in enumerate(items):
    x=30+(i%2)*670;y=65+(i//2)*400
    sheet.paste(Image.open(ROOT/'images'/f'{key}.png').resize((640,360),Image.Resampling.LANCZOS),(x,y))
    d.text((x,y+369),caption,font=label,fill='#d8cce4')
sheet.save(ROOT/'comparison-2-5.png')
sheet=Image.new('RGB',(1360,880),'#16121c');d=ImageDraw.Draw(sheet)
d.text((30,18),'2〜5章 — 最新の画面と生成章題',font=label,fill='#e8dff0')
for i,n in enumerate([2,3,4,5]):
    x=30+(i%2)*670;y=65+(i//2)*400
    sheet.paste(Image.open(ROOT/'images'/f'default-ch{n}.png').resize((640,360),Image.Resampling.LANCZOS),(x,y))
    d.text((x,y+369),{2:'2章 — Cの光と生成章題',3:'3章 — 王冠が主役',4:'4章 — はじめ・守護霊のようなスミ・ドバイ',5:'5章 — 金属の神と生成章題'}[n],font=label,fill='#d8cce4')
sheet.save(ROOT/'comparison-all.png')
(ROOT/'manifest.json').write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n')
