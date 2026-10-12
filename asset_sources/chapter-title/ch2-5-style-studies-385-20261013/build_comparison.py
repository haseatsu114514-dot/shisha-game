#!/usr/bin/env python3
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

p=Path(__file__).resolve().parent
fp=next(Path('/System/Library/Fonts').glob('*角*シック W4.ttc'))
font=ImageFont.truetype(str(fp),20)
small=ImageFont.truetype(str(fp),15)
im=Image.new('RGB',(1360,880),'#15121b')
d=ImageDraw.Draw(im)
d.text((30,18),'水煙前線 — 2〜5章のタイトル試作',font=font,fill='#e7e1ef')
labels=['2章  才能の壁 — 青・ピンクと勇気','3章  虚ろな王冠 — 王冠と雨','4章  継承の煙 — 二人の表情と手','5章  機械仕掛けの神 — 金属と紫の光']
for i,n in enumerate([2,3,4,5]):
    x=30+(i%2)*670;y=65+(i//2)*400
    im.paste(Image.open(p/'images'/f'ch{n}-title.png').resize((640,360),Image.Resampling.LANCZOS),(x,y))
    d.text((x,y+369),labels[i],font=small,fill='#d5c9e2')
im.save(p/'comparison.png')
