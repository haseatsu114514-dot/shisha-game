"""Typeset the owner-selected ImageGen D plate; preserve the raw generated art."""
import hashlib,json
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
from build_layouts import fonts,tracked_text

HERE=Path(__file__).resolve().parent
out=HERE/'selected-D'
out.mkdir(exist_ok=True)
raw=HERE/'originals/D-selected-plate-v1.png'
im=Image.open(raw).convert('RGBA')
print('Generated plate',im.size,'center/body',im.getpixel((500,600)))
# Keep an exact 16:9 crop inside the native canvas, then scale proportionally.
width=im.width-im.width%16
height=width*9//16
if height>im.height:
    height=im.height-im.height%9;width=height*16//9
x=(im.width-width)//2;y=(im.height-height)//2
plate=im.crop((x,y,x+width,y+height)).resize((1280,720),Image.Resampling.LANCZOS)
white=Image.new('RGBA',(1280,720),'white')
white.alpha_composite(plate)
art=white.convert('RGB')
art.save(out/'art-plate.png')
jp,en=fonts()
type_layer=Image.new('RGBA',(1280,720))
d=ImageDraw.Draw(type_layer);ink=(22,27,39,255)
tracked_text(d,'水煙前線 -EN:CODE-',640,24,ImageFont.truetype(str(jp),15),3,ink)
d.line((565,49,715,49),fill=(154,158,168,255),width=1)
tracked_text(d,'CHAPTER 1',640,83,ImageFont.truetype(str(en),20),5,ink)
tracked_text(d,'煙がつなぐ街',640,125,ImageFont.truetype(str(jp),80),5,ink)
tracked_text(d,'Smoke & Ties',640,218,ImageFont.truetype(str(en),20),4,ink)
type_layer.save(out/'type.png')
final=art.convert('RGBA');final.alpha_composite(type_layer)
final.convert('RGB').save(out/'D-title.png')
final.convert('RGB').resize((640,360),Image.Resampling.LANCZOS).save(out/'D-title-640.png')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
record={'owner_direction':'Dを選定。画像生成で、参考画像のように正式ゲーム名も加える追加依頼。',
 'status':'review-only selected D refinement; no runtime adoption or merge',
 'tool':'built-in image_gen','source_original':'originals/D-selected-plate-v1.png','original_sha256':sha(raw),
 'generation_prompt':'prompts/D-selected-plate-v1.txt','image_reference_roles':[
 {'path':'titles/D.png','sha256':sha(HERE/'titles/D.png'),'role':'selected order and composition'},
 {'path':'review/identity-comparison.png','sha256':sha(HERE/'review/identity-comparison.png'),'role':'adopted identities and established walking poses'},
 {'path':'references/composition-only.png','sha256':sha(HERE/'references/composition-only.png'),'role':'user attachment, white composition and title hierarchy only; never identity'}],
 'text':['水煙前線 -EN:CODE-','CHAPTER 1','煙がつなぐ街','Smoke & Ties'],
 'title_authorities':['README.md','remake/index.html','remake/js/scenes/title.js','Issue #445'],
 'order_left_to_right':['minto','adam','naru','tsumugi','sumi','hajime'],
 'canvas':[1280,720],'native_crop':[x,y,width,height],
 'layers':{'art':'selected-D/art-plate.png','type':'selected-D/type.png'},
 'final_sha256':sha(out/'D-title.png'),
 'note':'A〜Fは同じ6枚の固定素材で作った比較案として保持。本追加Dはその構図をもとに画像生成で仕上げた別プレート。元の6人の独立RGBA素材と旧レイヤーも保持。追加プレートの白背景と人物は一枚で、文字のみ別レイヤー。'}
(out/'generation.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n')
print('Built selected-D/D-title.png, art plate, separate type and provenance.')
