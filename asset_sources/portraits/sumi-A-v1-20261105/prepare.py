from pathlib import Path
import shutil,json,importlib.util,sys
from PIL import Image
import numpy as np
D=Path(__file__).parent;R=D.parents[2];RAW=D;O=D/'reproduced';RAW.mkdir(exist_ok=True);O.mkdir(exist_ok=True)
ids={'normal':'3125cf7c-e74c-4464-bbc6-b3ccf1cfe075','smile':'a45e4f76-3336-4bc2-a312-728452faa194','serious':'2272baee-ffb8-4af7-9d46-ca88fffbaf17','surprise':'33e098e9-a2e7-4a2b-9fab-fa565d551886','thinking':'d64daa1e-e57e-459d-b6af-1c3d6bb4bc8b'}
spec=importlib.util.spec_from_file_location('fit',R/'tools/fit_portrait.py');fit=importlib.util.module_from_spec(spec);spec.loader.exec_module(fit)
sys.path.insert(0,str(R/'remake/tools'));import build_manifest as bm
ref=Image.open(R/'assets/sprites/characters/sumi/chr_sumi_normal.png').convert('RGBA');n=RAW/'sumi-A-normal-untouched.png';base=Image.open(n).convert('RGBA');cb=fit.bbox(ref);sb=fit.bbox(base);scale=(cb[3]-cb[1])/(sb[3]-sb[1]);currentm=bm.measure(R/'assets/sprites/characters/sumi/chr_sumi_normal.png');newm=bm.measure(n);size=(round(base.width*scale),round(base.height*scale));x=round(currentm['ax']*ref.width-newm['ax']*base.width*scale);y=cb[3]-round(sb[3]*scale);rows=[]
for face,uid in ids.items():
 p=RAW/f'sumi-A-{face}-untouched.png';im=Image.open(p).convert('RGBA');assert im.size==base.size
 out=Image.new('RGBA',(896,1200));out.alpha_composite(im.resize(size,Image.Resampling.LANCZOS),(x,y));dest=O/f'chr_sumi_{face}.png';out.save(dest)
 a=np.array(out);v=a[:,:,3]>=24;yy,xx=np.where(v);foot=v[max(0,yy.max()-120):yy.max()+1];_,fx=np.where(foot)
 rows.append({'face':face,'uuid':uid,'raw_size':list(im.size),'bbox24':[int(xx.min()),int(yy.min()),int(xx.max()+1),int(yy.max()+1)],'feet_x':round(float(fx.mean()),3),'rgba':out.mode,'alpha_zero_fraction':float((a[:,:,3]==0).mean())})
(D/'normalization-review.json').write_text(json.dumps({'operation':'One common LANCZOS scale and placement from approved A normal, old normal height/bottom and measured foot anchor. No color/paint/face compositing.','transform':{'scale':scale,'resize':size,'offset':[x,y]},'source_min_figure_height':1300,'frames':rows},ensure_ascii=False,indent=2)+'\n');print(json.dumps(rows,ensure_ascii=False,indent=2))
