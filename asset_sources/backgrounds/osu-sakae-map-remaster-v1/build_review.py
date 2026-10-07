"""Archive map output and build current/new comparisons without creative retouching."""
from pathlib import Path
import argparse,hashlib,json,shutil
from PIL import Image,ImageDraw,ImageFont
BASE=Path(__file__).resolve().parent
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
def archive(tod,source,refs):
 folder=BASE/tod;dst=folder/'source.png';shutil.copyfile(source,dst);im=Image.open(dst)
 if im.width*9!=im.height*16:
  raise ValueError(f'Aspect ratio {im.size} is not 16:9; review the raw composition before choosing a display crop. Raw saved, no stretch.')
 # Display copy keeps the whole generated frame and aspect ratio.
 preview=im.convert('RGB').resize((1280,720),Image.Resampling.LANCZOS);preview.save(folder/'preview.png')
 references=[{'actual_path':str(Path(p).resolve()),'sha256':sha(p)} for p in refs]
 meta={'request_id':'MAP01' if tod=='day' else 'MAP02','status':'proposal-review','time_of_day':tod,'raw_generation_path':source,'source_sha256':sha(dst),'source_byte_identical':dst.read_bytes()==Path(source).read_bytes(),'source_size':im.size,'preview_size':[1280,720],'prompt':(folder/'prompt.txt').read_text(),'references':references,'normalization':'Only uniform resize of the complete 16:9 frame. No paint, filter, sharpening, recolour or layout modifications after generation.','pin_layout_unchanged':True,'runtime_changed':False}
 (folder/'generation.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'time_of_day':tod,'source_size':im.size,'preview':[1280,720]},ensure_ascii=False))
def assemble():
 font=lambda s:ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',s)
 ready=[t for t in ['day','night'] if (BASE/t/'preview.png').exists()]
 out=Image.new('RGB',(2560,800*len(ready)),(22,26,33));d=ImageDraw.Draw(out)
 for j,t in enumerate(ready):
  for i,(label,path) in enumerate([('現在',BASE/f'references/original-{t}.png'),('大須・栄のランドマーク入り',BASE/t/'preview.png')]):
   d.text((i*1280+25,j*800+20),('昼' if t=='day' else '夜')+'｜'+label,font=font(30),fill=(242,244,249));out.paste(Image.open(path).convert('RGB'),(i*1280,j*800+70))
 out.save(BASE/'comparison.png');print({'comparison':str(BASE/'comparison.png')})
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--archive',nargs=2);p.add_argument('--reference',action='append',default=[]);p.add_argument('--assemble',action='store_true');a=p.parse_args()
 if a.archive:archive(*a.archive,a.reference)
 if a.assemble:assemble()
