"""Revise only title typography over the unchanged, owner-approved D plate."""
import hashlib
import json
import shutil
from pathlib import Path
from PIL import Image,ImageChops,ImageDraw,ImageFont
from build_layouts import fonts

HERE=Path(__file__).resolve().parent
BASE=HERE/'selected-D'
OUT=BASE/'typography'
OUT.mkdir(exist_ok=True)
jp,en=fonts()
INK=(22,27,39,255)
TEXT='煙がつなぐ街'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
ART_HASH=sha(BASE/'art-plate.png')
art=Image.open(BASE/'art-plate.png').convert('RGBA')

# Preserve the old design once, so future reruns never replace the snapshot.
for source,target in [('D-title.png','v1-D-title.png'),('type.png','v1-type.png'),('generation.json','v1-generation.json')]:
    if not (OUT/target).exists():shutil.copyfile(BASE/source,OUT/target)

def width(text,font,tracking):
    return sum(font.getlength(c) for c in text)+tracking*(len(text)-1)

def baseline(draw,text,x,y,font,tracking):
    for c in text:
        draw.text((round(x),y),c,font=font,fill=INK,anchor='ls')
        x+=font.getlength(c)+tracking

def common_type(draw):
    # Mixed scripts share a baseline; punctuation stays at its natural height.
    jf=ImageFont.truetype(str(jp),16)
    ef=ImageFont.truetype(str(en),18)
    a,b='水煙前線','-EN:CODE-'
    wa,wb=width(a,jf,4),width(b,ef,2.4)
    x=640-(wa+20+wb)/2
    baseline(draw,a,x,38,jf,4)
    baseline(draw,b,x+wa+20,38,ef,2.4)
    draw.line((566,52,714,52),fill=(154,158,168,255),width=1)
    cf=ImageFont.truetype(str(en),20)
    baseline(draw,'CHAPTER 1',640-width('CHAPTER 1',cf,5)/2,99,cf,5)
    baseline(draw,'Smoke & Ties',640-width('Smoke & Ties',cf,4)/2,244,cf,4)

STUDIES=[
 {'id':'01','name':'控えめな段差','stem':'01-subtle',
  'sizes':[80,80,80,80,80,80],'baselines':[202,198,206,200,204,199],'gaps':[5,5,5,5,5]},
 {'id':'02','name':'大小と段差','stem':'02-sizes-and-step',
  'sizes':[88,64,76,70,72,88],'baselines':[202,194,207,198,210,202],'gaps':[8,0,6,0,8]},
 {'id':'03','name':'右上がり','stem':'03-rise-right',
  'sizes':[80,76,76,76,76,84],'baselines':[211,205,200,195,190,187],'gaps':[4,4,4,4,4]},
]
records=[]
for spec in STUDIES:
    layer=Image.new('RGBA',(1280,720))
    d=ImageDraw.Draw(layer)
    common_type(d)
    fs=[ImageFont.truetype(str(jp),s) for s in spec['sizes']]
    ws=[f.getlength(c) for c,f in zip(TEXT,fs)]
    x=640-(sum(ws)+sum(spec['gaps']))/2
    glyphs=[]
    for i,(c,f,w,y) in enumerate(zip(TEXT,fs,ws,spec['baselines'])):
        position=(round(x),y)
        bounds=d.textbbox(position,c,font=f,anchor='ls')
        d.text(position,c,font=f,fill=INK,anchor='ls')
        glyphs.append({'character':c,'size':spec['sizes'][i],'baseline':y,'x':round(x),'bounds':bounds})
        x+=w+(spec['gaps'][i] if i<5 else 0)
    type_path=OUT/f'{spec["stem"]}-type.png'
    image_path=OUT/f'{spec["stem"]}.png'
    layer.save(type_path)
    composed=art.copy();composed.alpha_composite(layer)
    composed.convert('RGB').save(image_path)
    assert ImageChops.difference(composed.crop((0,260,1280,720)).convert('RGB'),art.crop((0,260,1280,720)).convert('RGB')).getbbox() is None
    records.append({**spec,'glyphs':glyphs,'image':str(image_path.relative_to(HERE)),
       'type_layer':str(type_path.relative_to(HERE)),'sha256':sha(image_path),'art_sha256':ART_HASH,
       'person_region_pixels_unchanged':True})
    if spec['id']=='02':
        shutil.copyfile(image_path,BASE/'D-title.png')
        shutil.copyfile(type_path,BASE/'type.png')
        composed.convert('RGB').resize((640,360),Image.Resampling.LANCZOS).save(BASE/'D-title-640.png')

comparison=Image.new('RGB',(2660,1710),'#eeede9')
cd=ImageDraw.Draw(comparison)
f=ImageFont.truetype(str(jp),28)
cd.text((40,24),'文字の配置比較 / 人物と背景は全案で同じ画素',font=f,fill='#202832')
panels=[('修正前',OUT/'v1-D-title.png')]+[(r['id']+' '+r['name'],HERE/r['image']) for r in records]
for i,(label,p) in enumerate(panels):
    x,y=40+(i%2)*1300,85+(i//2)*790
    cd.text((x,y),label,font=f,fill='#202832')
    comparison.paste(Image.open(p),(x,y+45))
comparison.save(OUT/'comparison.png')
assert sha(BASE/'art-plate.png')==ART_HASH
meta=json.loads((BASE/'generation.json').read_text())
meta.update({'final_sha256':sha(BASE/'D-title.png'),'typography_default':'02',
 'typography_record':'selected-D/typography/studies.json','art_sha256':ART_HASH,
 'typography_revision':'英字・記号と副題をベースライン基準へ変更。作品名の日欧文字を別ブロックで整列。章題に大小・高さ・字間の意図的な差を付けた3案。人物と背景は画素不変。'})
(BASE/'generation.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n')
(OUT/'studies.json').write_text(json.dumps({'default':'02','unchanged_art_sha256':ART_HASH,
 'before_image':'selected-D/typography/v1-D-title.png','before_image_sha256':sha(OUT/'v1-D-title.png'),
 'text':['水煙前線 -EN:CODE-','CHAPTER 1',TEXT,'Smoke & Ties'],'studies':records},ensure_ascii=False,indent=2)+'\n')
print('Built 3 typography studies. Shared art SHA256:',ART_HASH)
print('Default 02: sizes and steps; lower person region pixels identical in all 3.')
