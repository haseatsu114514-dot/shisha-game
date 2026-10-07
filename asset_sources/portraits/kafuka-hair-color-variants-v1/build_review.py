"""Archive raw generations and assemble hair-colour review plates without retouching."""
from pathlib import Path
import argparse,hashlib,importlib.util,json,shutil
import numpy as np
from PIL import Image,ImageDraw,ImageFont

BASE=Path(__file__).resolve().parent
ROOT=BASE.parents[2]
spec=importlib.util.spec_from_file_location('sprite_measure',ROOT/'web/build_data.py')
measure=importlib.util.module_from_spec(spec);spec.loader.exec_module(measure)
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
def border(im,t=16):
 a=np.asarray(im.getchannel('A'))
 return int((a[0]>=t).sum()+(a[-1]>=t).sum()+(a[:,0]>=t).sum()+(a[:,-1]>=t).sum())
def archive(slug,source):
 folder=BASE/slug;dst=folder/'source.png';shutil.copyfile(source,dst)
 previous=json.loads((folder/'generation.json').read_text()) if (folder/'generation.json').exists() else {}
 im=Image.open(dst).convert('RGBA')
 bm=json.loads((BASE/'references/base-generation.json').read_text())
 scale=bm['normalization']['scale']*bm['source_size'][1]/im.height
 box,anchor=measure._measure_main_content(im,anchor='feet')
 target_anchor=bm['normalization']['preview_main_content'][1]
 target_bottom=bm['normalization']['preview_main_content'][0][3]
 xy=[round(target_anchor-anchor*scale),round(target_bottom-box[3]*scale)]
 resized=im.resize((round(im.width*scale),round(im.height*scale)),Image.Resampling.LANCZOS)
 preview=Image.new('RGBA',(896,1200));preview.paste(resized,tuple(xy))
 # Correct only integer placement after resampling so every feet baseline is exact.
 measured_bottom=measure._measure_main_content(preview,anchor='feet')[0][3]
 xy[1]+=target_bottom-measured_bottom
 preview=Image.new('RGBA',(896,1200));preview.paste(resized,tuple(xy))
 preview.save(folder/'preview.png')
 # Native-size crops, no face compositing or painting.
 preview.crop((315,285,655,625)).save(folder/'face-native.png')
 refs=json.loads(((folder/'references.json') if (folder/'references.json').exists() else (BASE/'references/generation-references.json')).read_text())
 assert all(sha(ref['actual_path'])==ref['sha256'] for ref in refs)
 rid='PRT68' if slug=='ocean-blue-ventriloquism' else next(v['request_id'] for v in json.loads((BASE/'plan.json').read_text()) if v['slug']==slug)
 metadata={'character':'kafuka','request_id':rid,'variant':slug,'status':'pending-review','expression':'normal','raw_generation_path':str(source),'source_size':im.size,'source_mode':Image.open(dst).mode,'source_sha256':sha(dst),'source_byte_identical':Path(source).read_bytes()==dst.read_bytes(),'prompt':(folder/'prompt.txt').read_text(),'references':refs,'reference_review':'All earlier 29 portrait groups and 112 images reviewed in the same session. Current task reread latest identity source, native face, and approved Minto/Ageha. Every colour edit uses the same original base rather than the preceding edit.','normalization':{'operations':'Whole-image uniform resize and RGBA placement only. Native crops are unretouched. No painting, face compositing, warping, alpha thresholding or colour postprocessing.','common_scale_per_1536px_source_height':bm['normalization']['scale'],'scale':scale,'offset':xy,'canvas_size':[896,1200],'source_main_bbox':box,'preview_main_content':measure._measure_main_content(preview,anchor='feet')},'checks':{'raw_border_alpha_ge_16':border(im),'preview_border_alpha_ge_16':border(preview),'source_rgba':Image.open(dst).mode=='RGBA'},'runtime_changed':False}
 (folder/'generation.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2)+'\n')
 if previous:
  metadata['status']=previous['status']
  if 'adoption' in previous:metadata['adoption']=previous['adoption']
  (folder/'generation.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2)+'\n')
 assert metadata['source_byte_identical'] and metadata['checks']['source_rgba']
 assert border(im)==0 and border(preview)==0
 print(json.dumps({'variant':slug,'source':im.size,'scale':scale,'feet':metadata['normalization']['preview_main_content'],'checks':metadata['checks']},ensure_ascii=False))

def assemble():
 plan=json.loads((BASE/'plan.json').read_text())
 entries=[('現在の髪色',BASE/'references/base-preview.png')]+[(v['title'],BASE/v['slug']/'preview.png') for v in plan if (BASE/v['slug']/'preview.png').exists()]
 font=lambda size:ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',size)
 validation={'runtime_changed':False,'variants':[],'contact_sheet_includes_original':True,'review_operations':'Only cropping, uniform display scaling, labels and compositing against solid white/dark backgrounds; source pixels preserved.'}
 for dark in [False,True]:
  bg=(26,29,36,255) if dark else (250,250,248,255);fg=(241,244,248) if dark else (30,35,43)
  col=500;plate=Image.new('RGBA',(col*len(entries),1410),bg);draw=ImageDraw.Draw(plate)
  draw.text((28,18),'サメちゃん｜髪色比較（服装・髪型は共通）',font=font(33),fill=fg)
  draw.text((28,69),'①濃い青インナーを採用 / 下段は原寸の顔・髪まわり',font=font(22),fill=fg)
  for i,(title,path) in enumerate(entries):
   x=i*col;im=Image.open(path).convert('RGBA')
   draw.text((x+20,122),title,font=font(25),fill=fg)
   full=im.crop((200,250,745,1195));full.thumbnail((460,820),Image.Resampling.LANCZOS)
   plate.alpha_composite(full,(x+(col-full.width)//2,180))
   # 410x430 preview-pixel crop keeps hair, hood and collar at native scale.
   head=im.crop((270,260,680,690))
   plate.alpha_composite(head,(x+45,960))
  plate.convert('RGB').save(BASE/('comparison-dark.png' if dark else 'comparison.png'))
 # Separate native-head review with the same order and white background.
 heads=Image.new('RGBA',(500*len(entries),560),(250,250,248,255));d=ImageDraw.Draw(heads)
 for i,(title,path) in enumerate(entries):
  d.text((i*500+20,22),title,font=font(25),fill=(30,35,43))
  heads.alpha_composite(Image.open(path).convert('RGBA').crop((270,260,680,690)),(i*500+45,100))
 heads.convert('RGB').save(BASE/'comparison-heads.png')
 for v in plan:
  folder=BASE/v['slug']
  if not (folder/'generation.json').exists():continue
  m=json.loads((folder/'generation.json').read_text());validation['variants'].append({'slug':v['slug'],'source_hash_matches':sha(folder/'source.png')==m['source_sha256'],'source_byte_identical':m['source_byte_identical'],'checks':m['checks'],'feet':m['normalization']['preview_main_content'],'shared_scale':m['normalization']['common_scale_per_1536px_source_height']})
 (BASE/'validation.json').write_text(json.dumps(validation,ensure_ascii=False,indent=2)+'\n')
 print(json.dumps({'entries':len(entries),'comparison':str(BASE/'comparison.png')},ensure_ascii=False))

if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--archive',nargs=2,metavar=('SLUG','SOURCE'));p.add_argument('--assemble',action='store_true');a=p.parse_args()
 if a.archive:archive(*a.archive)
 if a.assemble:assemble()
