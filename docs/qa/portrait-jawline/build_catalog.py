from PIL import Image,ImageDraw
from pathlib import Path
import json,math,hashlib
root=Path(__file__).resolve().parents[3]; out=root/'docs/qa/portrait-jawline'
findings_path=out/'audit'/'findings.json'
findings={f"{r['character']}/{r['expression']}":r for r in json.loads(findings_path.read_text())} if findings_path.exists() else {}
m=json.loads((root/'remake/data/manifest.json').read_text());names={c['id']:c.get('name',c['id']) for c in json.loads((root/'data/characters.json').read_text())}
centers={'adam':(432,228),'ageha':(500,350),'dr_kemuri':(408,216),'hajime':(536,292),'hiyori':(372,308),'samechan':(456,388),'maezono':(388,184),'mashiro':(440,424),'minto':(496,364),'nagumo':(416,176),'naru':(464,248),'pakki':(496,660),'rin':(412,300),'sumi':(440,216),'tsumugi':(432,428),'kumicho':(464,108),'rei':(448,116),'volk':(460,96),'sai':(444,116),'maki':(456,104),'salaryman':(440,204),'uranaishi':(513,198)}
items=[]
for c,p in m['portraits'].items():
 for f in p['faces']:
  x,y=centers[c]
  if c=='hiyori' and f not in ('axe_laugh','axe_shout'): x=440 if f!='axe_throw' else 536
  if c=='maezono' and f!='excited': x=410
  w,h=(200,180) if c=='pakki' else (85,90)
  box=[max(0,x-w),max(0,y-h),x+w,y+h]
  src=f'assets/sprites/characters/{c}/chr_{c}_{f}.png';run=src.replace('assets/','remake/img/').replace('.png','.webp')
  if c=='maezono': box=[x-105,max(0,y-90),x+105,y+90]
  item=dict(character=c,name=names.get(c,c),expression=f,source=src,runtime=run,crop=box,classification='未確認',note='',priority='unreviewed')
  finding=findings.get(f'{c}/{f}')
  if finding and hashlib.sha256((root/src).read_bytes()).hexdigest() in (finding.get('reviewed_source_sha256'),finding.get('resolved_source_sha256')):
   for key in ('classification','note','priority'): item[key]=finding[key]
  items.append(item)
for n in range(math.ceil(len(items)/30)):
 group=items[n*30:(n+1)*30];sheet=Image.new('RGB',(1200,math.ceil(len(group)/6)*230),'#999');d=ImageDraw.Draw(sheet)
 for i,item in enumerate(group):
  im=Image.open(root/item['source']).convert('RGBA').crop(item['crop']);im.thumbnail((200,200));x=i%6*200;y=i//6*230;sheet.paste(im,(x,y+25),im);d.text((x+2,y+5),item['character']+' / '+item['expression'],fill='black')
 sheet.save(out/f'faces-{n+1}.jpg',quality=93)
(out/'catalog.json').write_text(json.dumps(items,ensure_ascii=False,indent=2)+'\n');print(len(items),'expressions')
