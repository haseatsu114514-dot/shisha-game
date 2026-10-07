"""Normalize approved-design expressions and export a reusable parts kit."""
from pathlib import Path
import argparse,hashlib,importlib.util,json,shutil
import numpy as np
from PIL import Image,ImageDraw,ImageFont
BASE=Path(__file__).resolve().parent;ROOT=BASE.parents[2]
spec=importlib.util.spec_from_file_location('sprite_measure',ROOT/'web/build_data.py');measure=importlib.util.module_from_spec(spec);spec.loader.exec_module(measure)
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
font=lambda size:ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',size)
def border(im):
 a=np.asarray(im.getchannel('A'));return int((a[0]>=16).sum()+(a[-1]>=16).sum()+(a[:,0]>=16).sum()+(a[:,-1]>=16).sum())
def archive(expression,source):
 folder=BASE/expression;raw=folder/'source.png';shutil.copyfile(source,raw);im=Image.open(raw).convert('RGBA')
 normal=json.loads((BASE/'normal/generation.json').read_text());scale=normal['normalization']['scale']*normal['source_size'][1]/im.height
 bounds,anchor=measure._measure_main_content(im,anchor='feet');target=normal['normalization']['preview_main_content'];xy=[round(target[1]-anchor*scale),round(target[0][3]-bounds[3]*scale)]
 resized=im.resize((round(im.width*scale),round(im.height*scale)),Image.Resampling.LANCZOS)
 preview=Image.new('RGBA',(896,1200));preview.paste(resized,tuple(xy));xy[1]+=target[0][3]-measure._measure_main_content(preview,anchor='feet')[0][3]
 preview=Image.new('RGBA',(896,1200));preview.paste(resized,tuple(xy));preview.save(folder/'preview.png');preview.crop((315,285,655,625)).save(folder/'face-native.png')
 refs=json.loads((BASE/'references/generation-references.json').read_text());assert all(sha(r['actual_path'])==r['sha256'] for r in refs)
 rid=next(p['request_id'] for p in json.loads((BASE/'plan.json').read_text()) if p['expression']==expression)
 meta={'character':'kafuka','design':'adopted-black-hair-ocean-blue-inner-v1','expression':expression,'status':'generated-parts-review','request_id':rid,'raw_generation_path':source,'source_size':im.size,'source_mode':Image.open(raw).mode,'source_sha256':sha(raw),'source_byte_identical':Path(source).read_bytes()==raw.read_bytes(),'prompt':(folder/'prompt.txt').read_text(),'references':refs,'normalization':{'operations':'Whole-image uniform resize and integer RGBA placement only, using approved normal scale per source canvas height; native crops unretouched. No painting, face compositing, warping, alpha thresholding or colour postprocessing.','scale':scale,'common_scale_per_1536px_source_height':normal['normalization']['scale'],'offset':xy,'canvas_size':[896,1200],'source_main_bbox':bounds,'preview_main_content':measure._measure_main_content(preview,anchor='feet')},'checks':{'raw_border_alpha_ge_16':border(im),'preview_border_alpha_ge_16':border(preview),'source_rgba':Image.open(raw).mode=='RGBA'},'runtime_changed':False}
 assert meta['source_byte_identical'] and meta['checks']['source_rgba'] and border(im)==border(preview)==0
 (folder/'generation.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'expression':expression,'scale':scale,'feet':meta['normalization']['preview_main_content'],'checks':meta['checks']},ensure_ascii=False))
def assemble():
 keys=['normal','smile','serious','surprise','excited','ventriloquism'];names={'normal':'通常（採用原画）','smile':'笑顔','serious':'真剣','surprise':'驚き','excited':'熱弁','ventriloquism':'腹話術'}
 ready=[key for key in keys if (BASE/key/'preview.png').exists()]
 kit=BASE/'game-ready';kit.mkdir(exist_ok=True)
 checks=[]
 for key in ready:
  src=BASE/key/'preview.png';out=kit/f'chr_kafuka_{key}.png';shutil.copyfile(src,out)
  rgba=Image.open(src).convert('RGBA');webp=kit/f'chr_kafuka_{key}.webp';rgba.save(webp,'WEBP',lossless=True,quality=100,method=6,exact=True)
  same=np.array_equal(np.asarray(rgba),np.asarray(Image.open(webp).convert('RGBA')));assert same and border(rgba)==0
  checks.append({'expression':key,'png_sha256':sha(out),'png_byte_identical_to_preview':src.read_bytes()==out.read_bytes(),'webp_exact_rgba':same,'canvas':rgba.size,'feet':measure._measure_main_content(rgba,anchor='feet'),'border_alpha_ge_16':border(rgba)})
 for dark in [False,True]:
  bg=(25,28,35,255) if dark else (250,250,248,255);fg=(242,244,248) if dark else (28,35,43)
  out=Image.new('RGBA',(500*len(ready),1410),bg);d=ImageDraw.Draw(out);d.text((25,20),'サメちゃん｜採用デザインの表情と腹話術',font=font(32),fill=fg)
  for i,key in enumerate(ready):
   im=Image.open(BASE/key/'preview.png').convert('RGBA');x=i*500;d.text((x+20,100),names[key],font=font(25),fill=fg)
   full=im.crop((195,245,750,1195));full.thumbnail((460,825),Image.Resampling.LANCZOS);out.alpha_composite(full,(x+(500-full.width)//2,150));out.alpha_composite(im.crop((270,260,680,690)),(x+45,960))
  out.convert('RGB').save(BASE/('review-dark.png' if dark else 'review.png'))
 (BASE/'parts-validation.json').write_text(json.dumps({'parts':checks,'normal_reused_without_regeneration':True,'canvas':[896,1200],'runtime_changed':False},ensure_ascii=False,indent=2)+'\n')
 # Crop from approved normal only; no generated redraw for an icon.
 cropbox=(350,265,570,485);native=Image.open(BASE/'normal/preview.png').convert('RGBA').crop(cropbox)
 native.save(BASE/'references/icon-native-crop.png')
 small=native.resize((160,160),Image.Resampling.LANCZOS);alpha=small.getchannel('A')
 icon=small.convert('RGB').quantize(colors=256,method=Image.Quantize.MEDIANCUT).convert('RGBA');icon.putalpha(alpha)
 icon.save(kit/'face_kafuka.png');icon.save(kit/'face_kafuka.webp','WEBP',lossless=True,quality=100,method=6,exact=True)
 assert np.array_equal(np.asarray(icon),np.asarray(Image.open(kit/'face_kafuka.webp').convert('RGBA')))
 (kit/'manifest.json').write_text(json.dumps({'character':'kafuka','status':'parts-kit-review','portraits':[{'expression':c['expression'],'png':f'chr_kafuka_{c["expression"]}.png','webp':f'chr_kafuka_{c["expression"]}.webp','sha256':c['png_sha256']} for c in checks],'icon':{'png':'face_kafuka.png','webp':'face_kafuka.webp','size':[160,160],'colors':256,'native_source':'../normal/preview.png','crop_box':cropbox,'alpha_preserved':True,'webp_exact_rgba':True},'runtime_installed':False},ensure_ascii=False,indent=2)+'\n')
 print(json.dumps({'parts_exported':ready,'all_webp_exact_rgba':all(c['webp_exact_rgba'] for c in checks)},ensure_ascii=False))
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--archive',nargs=2);p.add_argument('--assemble',action='store_true');a=p.parse_args()
 if a.archive:archive(*a.archive)
 if a.assemble:assemble()
