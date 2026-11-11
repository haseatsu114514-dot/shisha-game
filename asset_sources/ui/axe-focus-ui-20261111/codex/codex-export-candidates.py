from PIL import Image,ImageOps,ImageDraw
from pathlib import Path
import numpy as np,json,hashlib,shutil,zipfile
items=[('gauge-frame','77c8e9a1-11b4-49b2-a8ba-60e1efccb672',(320,2048),(256,1984)),('gauge-needle','cc05df04-8325-4d10-a1da-3bf83d5b8955',(512,160),(448,96)),('button-throw-orange','b91fe40b-c94a-4222-a082-14ebae46540c',(1280,448),(1184,384)),('button-throw-green','970a1780-eb62-4323-b98a-5167347b4de9',(1280,448),(1184,384)),('tag-slate','45a668c7-1a3e-4d87-8625-6f9e8211a8e8',(896,512),(800,432)),('tag-selected','46879abc-1040-4153-80d1-370738e0d48f',(896,512),(800,432))]
r=Path('axe-ui-work/delivery');raw=r/'raw';cand=r/'canvas-candidates'
raw.mkdir(parents=True,exist_ok=True);cand.mkdir(exist_ok=True)
qa=[]
for name,g,sz,box in items:
 p=Path('generated_images')/('exec-'+g+'.png');dst=raw/(name+'.png');shutil.copy2(p,dst)
 im=Image.open(p).convert('RGBA');a=np.array(im)[:,:,3]; yy,xx=np.where(a>128);bbox=(int(xx.min()),int(yy.min()),int(xx.max()+1),int(yy.max()+1))
 # Preserve aspect ratio; no repaint, alpha cleanup, geometry stretching or synthetic fill.
 cropped=im.crop(bbox);f=ImageOps.contain(cropped,box,Image.Resampling.LANCZOS);out=Image.new('RGBA',sz);out.alpha_composite(f,((sz[0]-f.width)//2,(sz[1]-f.height)//2));out.save(cand/(name+'.png'))
 edge=np.concatenate([np.array(out)[0,:,3],np.array(out)[-1,:,3],np.array(out)[:,0,3],np.array(out)[:,-1,3]])
 qa.append({'file':name,'raw_size':list(im.size),'raw_bbox_alpha_gt128':bbox,'canvas_size':list(sz),'fitted_object_size':list(f.size),'requested_approx_object_size':list(box),'canvas_outer_edge_alpha_max':int(edge.max()),'alpha_range':list(out.getchannel('A').getextrema()),'status':'candidate only; exact object dimensions and pair pixel alignment not guaranteed'})
(r/'QA.json').write_text(json.dumps(qa,indent=2))
# Review montage only, no game adoption.
mont=Image.new('RGB',(1100,850),'#343434');d=ImageDraw.Draw(mont)
for i,(name,_,_,_) in enumerate(items):
 im=Image.open(cand/(name+'.png'));im.thumbnail((500,220));x=(i%2)*550+(550-im.width)//2;y=(i//2)*280+35;mont.paste(im,(x,y),im);d.text(((i%2)*550+15,(i//2)*280+10),name,fill='white')
mont.save(r/'preview.jpg',quality=92)
print(json.dumps(qa,indent=2))
