"""GB03 第1段: 生成した原画を指示書 5.2 の寸法に切り出して WebP 化する（Grok Bot・2026-10-31）。"""
from PIL import Image
import os
N=os.path.dirname(os.path.abspath(__file__)); G=os.path.join(N,'../../../../remake/img/ui/growth_board')
def cover(im,w,h):
  r=max(w/im.width,h/im.height); im=im.resize((round(im.width*r),round(im.height*r)),Image.LANCZOS)
  l=(im.width-w)//2; t=(im.height-h)//2; return im.crop((l,t,l+w,t+h))
def pieces(im,n):
  a=im.getchannel('A'); W,H=im.size; cols=[any(a.getpixel((x,y))>16 for y in range(0,H,2)) for x in range(W)]
  runs=[];s=None
  for x,c in enumerate(cols+[False]):
    if c and s is None: s=x
    if not c and s is not None:
      runs.append((s,x)); s=None
  runs=sorted(sorted(runs,key=lambda r:r[1]-r[0],reverse=True)[:n])
  out=[]
  for x0,x1 in runs:
    sub=im.crop((x0,0,x1,H)); bb=sub.getchannel('A').point(lambda v:255 if v>16 else 0).getbbox(); sub=sub.crop(bb)
    side=max(sub.size); sq=Image.new('RGBA',(side,side),(0,0,0,0)); sq.paste(sub,((side-sub.width)//2,(side-sub.height)//2)); out.append(sq)
  return out
def save(im,name,size=None,q=90):
  if size: im=im.resize(size,Image.LANCZOS)
  im.save(os.path.join(G,name),'WEBP',quality=q,method=6)
os.makedirs(G,exist_ok=True)
bg=cover(Image.open(f'{N}/board_glass.png').convert('RGB'),1520,976); bg.save(f'{N}/board_glass_1520x976.png'); save(bg,'board_glass.webp',q=85)
sb=cover(Image.open(f'{N}/screen_backdrop.png').convert('RGB'),2560,1440); sb.save(f'{N}/screen_backdrop_2560x1440.png'); save(sb,'screen_backdrop.webp',q=80)
for im,names,px in [(Image.open(f'{N}/raw_hub_sheet.png').convert('RGBA'),['hub_body','hub_sense','hub_wisdom'],256),
  (Image.open(f'{N}/raw_frames_sheet.png').convert('RGBA'),['frame_skill','frame_lesson','frame_gate','frame_peak','frame_seal'],128),
  (Image.open(f'{N}/raw_hidane_sheet.png').convert('RGBA'),['hidane_any','hidane_body','hidane_sense','hidane_wisdom'],96)]:
  ps=pieces(im,len(names)); assert len(ps)==len(names),names
  sheet=Image.new('RGBA',(px*len(ps),px),(0,0,0,0))
  for i,(p,nm) in enumerate(zip(ps,names)):
    t=p.resize((px,px),Image.LANCZOS); sheet.paste(t,(i*px,0)); save(t,nm+'.webp')
    if nm.startswith('hub'): t.save(f'{N}/{nm}.png')
  sheet.save(f'{N}/'+{256:'hub_sheet.png',128:'frames_sheet.png',96:'hidane_sheet.png'}[px])
pf=Image.open(f'{N}/raw_panel_frame.png').convert('RGBA'); bb=pf.getchannel('A').point(lambda v:255 if v>16 else 0).getbbox(); pf=pf.crop(bb).resize((192,192),Image.LANCZOS); pf.save(f'{N}/panel_frame.png'); save(pf,'panel_frame.webp')
# contact sheet
cs=Image.new('RGB',(1280,900),(16,12,22)); y=10
for nm,w in [('board_glass',400),('screen_backdrop',400)]:
  t=Image.open(f'{G}/{nm}.webp').convert('RGB'); t.thumbnail((w,w)); cs.paste(t,(10 if nm=='board_glass' else 430,y))
y=300; x=10
for nm in ['hub_body','hub_sense','hub_wisdom','frame_skill','frame_lesson','frame_gate','frame_peak','frame_seal','hidane_any','hidane_body','hidane_sense','hidane_wisdom','panel_frame']:
  t=Image.open(f'{G}/{nm}.webp').convert('RGBA'); t.thumbnail((128,128)); 
  if x+140>1270: x=10; y+=150
  cs.paste(t,(x,y),t); x+=140
mk=Image.open(f'{N}/mockup_assets.jpg').convert('RGB'); mk.thumbnail((420,300)); cs.paste(mk,(850,10))
cs.save(f'{N}/contact_sheet.png')
