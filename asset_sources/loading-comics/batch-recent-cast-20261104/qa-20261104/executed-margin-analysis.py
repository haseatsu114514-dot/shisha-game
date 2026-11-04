from pathlib import Path
from collections import deque
import json
import numpy as np
from PIL import Image
root=Path('/workspace/loading-comics-recent-cast/asset_sources/loading-comics')
batch=root/'batch-recent-cast-20261104'
index=json.loads((batch/'generation-index.json').read_text())
result=[]
for e in index['episodes']:
 for n in (1,2):
  f=root/f"allcast-{e['id']}"/f'panel-{n}-source.png'
  a=np.asarray(Image.open(f).convert('RGB'))[::4,::4].astype(np.int16)
  mask=(a.min(2)>=235)&((a.max(2)-a.min(2))<=20)
  h,w=mask.shape;seen=np.zeros_like(mask);regions=[]
  for sy,sx in zip(*np.where(mask)):
   if seen[sy,sx]:continue
   seen[sy,sx]=True;q=deque([(int(sy),int(sx))]);count=0;x0=x1=int(sx);y0=y1=int(sy)
   while q:
    y,x=q.popleft();count+=1;x0=min(x0,x);x1=max(x1,x);y0=min(y0,y);y1=max(y1,y)
    for yy,xx in ((y-1,x),(y+1,x),(y,x-1),(y,x+1)):
     if 0<=yy<h and 0<=xx<w and mask[yy,xx] and not seen[yy,xx]:seen[yy,xx]=True;q.append((yy,xx))
   bw=(x1-x0+1)*4;bh=(y1-y0+1)*4;fill=count/((x1-x0+1)*(y1-y0+1))
   if bw<200 or bh<80 or not 1.2<=bw/bh<=7 or fill<.35 or count*16<10000:continue
   box={'x':max(0,x0*4-6),'y':max(0,y0*4-6),'right':min(1536,(x1+1)*4+6),'bottom':min(1024,(y1+1)*4+6)}
   gaps={'left':box['x']/1536,'right':(1536-box['right'])/1536,'top':box['y']/1024,'bottom':(1024-box['bottom'])/1024}
   regions.append({'approx_bbox':box,'gaps_percent':{k:round(v*100,2) for k,v in gaps.items()},'edges_under_4_percent':[k for k,v in gaps.items() if v<.04]})
  result.append({'id':e['id'],'panel':n,'bubble_like_regions':regions,'manual_hand_note':'右コマのはじめの左手は左端に近い（既存目視）' if e['id']=='noor-shoe-sand' and n==2 else None})
out={'method':'Read-only analysis of 1536x1024 native PNG. White connected components at stride 4, RGB>=235/chroma<=20, bubble-like size/aspect/fill filters, bbox expanded by 6px. Approximation; not OCR, not exact ink-boundary proof. Thought bubbles may be included. Images are unchanged.','required_safe_margin_percent':4,'records':result}
(batch/'qa-20261104/margins.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
for r in result:print(r['id'],r['panel'],[(p['gaps_percent'],p['edges_under_4_percent']) for p in r['bubble_like_regions']])
