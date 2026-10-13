#!/usr/bin/env python3
"""Build the five title images into a review board; captions stay outside title images."""
from pathlib import Path
import json,hashlib
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parent
JP=next(Path('/System/Library/Fonts').glob('*角*シック W4.ttc'))
font=ImageFont.truetype(str(JP),20)
small=ImageFont.truetype(str(JP),17)
sheet=Image.new('RGB',(1360,1290),'#e9e7e2')
d=ImageDraw.Draw(sheet)
d.text((30,18),'水煙前線 — 文字入り・現在の5章一覧',font=font,fill='#333b42')
captions={1:'1章 — 白・余白 / 選定D',2:'2章 — ピンク・深い影 / 選定C',3:'3章 — 銀灰・古びた金 / 王冠が主役',4:'4章 — 夕焼け・ターコイズ / はじめと継承',5:'5章 — 紫・クローム / 機械仕掛けの神'}
m=json.loads((ROOT/'manifest.json').read_text());rows=[]
for i,n in enumerate([1,2,3,4,5]):
 path=Path('sources/ch1-selected-D.png') if n==1 else Path(f'images/default-ch{n}.png')
 im=Image.open(ROOT/path);assert im.size==(1280,720)
 x=30+(i%2)*670;y=65+(i//2)*400
 sheet.paste(im.resize((640,360),Image.Resampling.LANCZOS),(x,y))
 d.text((x,y+370),captions[n],font=small,fill='#333b42')
 rows.append({'chapter':n,'path':str(path),'sha256':hashlib.sha256((ROOT/path).read_bytes()).hexdigest()})
d.text((736,900),'章ごとの色と空気',font=font,fill='#333b42')
for i,(colors,text) in enumerate([
 (['#ffffff','#1e2430'],'1  静かな街の始まり'),
 (['#df4c8e','#24162d'],'2  ライバルへの緊張'),
 (['#bdc8ce','#9f8150'],'3  空洞と冷たい静けさ'),
 (['#efab63','#4aadb0'],'4  継承の温かさ'),
 (['#7935c3','#b7c0d0'],'5  機械の異質な圧力')]):
 y=948+i*53
 for j,c in enumerate(colors):d.rounded_rectangle((736+j*37,y,767+j*37,y+29),radius=3,fill=c,outline='#b6b5b1')
 d.text((832,y+3),text,font=small,fill='#333b42')
sheet.save(ROOT/'lineup.png')
m['current_lineup']=rows
(ROOT/'manifest.json').write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n')
print('5 chapter board:',sheet.size)
