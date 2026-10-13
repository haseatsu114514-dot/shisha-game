"""Compose fixed generated sprites and separately typeset titles; no drawing of people."""
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
IDS = ['hajime', 'sumi', 'tsumugi', 'naru', 'adam', 'minto']
NAMES = dict(zip(IDS, ['はじめ', 'スミさん', 'つむぎ', 'なる', 'アダム', 'みんと']))
ORDERS = [
 ['minto', 'adam', 'naru', 'tsumugi', 'sumi', 'hajime'],
 ['sumi', 'tsumugi', 'minto', 'adam', 'naru', 'hajime'],
 ['tsumugi', 'sumi', 'hajime', 'minto', 'adam', 'naru'],
]
INTENTS = ['主人公が先頭。師匠とつむぎが近くに続く。',
 'はじめとなるを前方で隣接させ、好敵手との関係を見せる。',
 '日常から主人公、大会へ。なるを進行方向の先頭に置く。']
SIZE = (1280, 720)
GRID_HEIGHT = 156

def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()

def visible_box(im):
    # Alpha below 32 only contributes almost invisible export noise. Keep the
    # original alpha inside this crop; never recolor or draw over a character.
    return im.getchannel('A').point(lambda p: 255 if p > 32 else 0).getbbox()

def fonts():
    jp = next(Path('/System/Library/Fonts').glob('*明朝 ProN.ttc'))
    en = Path('/System/Library/Fonts/Supplemental/Times New Roman.ttf')
    return jp, en

def tracked_text(draw, text, center, y, font, spacing, fill):
    widths = [draw.textlength(c,font=font) for c in text]
    x = center - (sum(widths)+spacing*(len(text)-1))/2
    for c,w in zip(text,widths):
        draw.text((round(x),y), c, font=font, fill=fill, anchor='lt')
        x += w+spacing

def main():
    source_doc = json.loads((HERE/'references/sources.json').read_text())
    refs = {r['id']:r for r in source_doc['references']}
    jp,en = fonts()
    for folder in ['sprites','titles','layers','review']:
        (HERE/folder).mkdir(exist_ok=True)
    sprites, generation = {}, []
    for cid in IDS:
        version = 'v2' if cid=='minto' else 'v1'
        original = HERE/'originals'/f'{cid}-{version}.png'
        im = Image.open(original).convert('RGBA')
        box = visible_box(im)
        assert box and im.getchannel('A').getextrema()==(0,255)
        cropped = im.crop(box)
        h = round(GRID_HEIGHT*refs[cid]['layout_relative_height'])
        w = round(cropped.width*h/cropped.height)
        # True artwork was generated as pixel art. Normalize only its sprite
        # grid here; there is no added mosaic, palette alteration or smoothing.
        resized = cropped.resize((w,h),Image.Resampling.NEAREST)
        sprite = Image.new('RGBA',(w+8,h+8),(0,0,0,0))
        sprite.alpha_composite(resized,(4,4))
        dest = HERE/'sprites'/f'{cid}-walk-right.png'
        sprite.save(dest)
        sprites[cid] = {'image':sprite,'content':resized,'w':w,'h':h,'path':dest}
        gen_refs = [refs[cid]['reference_copy']]
        if cid!='hajime': gen_refs.append('originals/hajime-v1.png')
        if cid=='minto': gen_refs = ['originals/minto-v1.png',refs[cid]['reference_copy']]
        generation.append({'id':cid,'selected_original':str(original.relative_to(HERE)),
         'original_sha256':sha(original),'original_size':list(im.size),'trim_bbox_alpha_gt_32':box,
         'sprite_path':str(dest.relative_to(HERE)),'sprite_sha256':sha(dest),'sprite_size':list(sprite.size),
         'content_size':[w,h],'prompt':f'prompts/{cid}-{version}.txt','image_reference_paths':gen_refs,
         'identity_source_path':refs[cid]['source_path'],'identity_source_sha256':refs[cid]['source_sha256']})

    background = Image.new('RGB',SIZE,'#ffffff')
    background.save(HERE/'layers/background.png')
    records = []
    for idx, letter in enumerate('ABCDEF'):
        large = idx>=3
        order_num = idx%3
        order = ORDERS[order_num]
        factor = 2 if large else 4/3
        floor = 654 if large else 628
        gap = 31 if large else 40
        widths = [round(sprites[c]['w']*factor) for c in order]
        row_width = sum(widths)+5*gap
        assert row_width < 1150
        x = round((SIZE[0]-row_width)/2)
        people = Image.new('RGBA',SIZE)
        shadow = Image.new('RGBA',SIZE)
        sd = ImageDraw.Draw(shadow)
        placements = []
        for cid,w in zip(order,widths):
            s = sprites[cid]
            h = round(s['h']*factor)
            scaled = s['content'].resize((w,h),Image.Resampling.NEAREST)
            people.alpha_composite(scaled,(x,floor-h))
            # Leading grounded shoe is the rightmost low part of this side view.
            a = scaled.getchannel('A')
            low = a.crop((0,max(0,h-3*factor),w,h)).point(lambda p:255 if p>128 else 0).getbbox()
            support = x+(low[0]+low[2])/2
            half = max(15,round(w*.18))
            sd.ellipse((support-half,floor-1,support+half,floor+3),fill=(85,82,79,16))
            placements.append({'id':cid,'sprite_path':str(s['path'].relative_to(HERE)),
             'sprite_sha256':sha(s['path']),'x':x,'y':floor-h,'width':w,'height':h,
             'uniform_scale':factor,'ground_y':floor,'support_x':support})
            x += w+gap
        text = Image.new('RGBA',SIZE)
        td = ImageDraw.Draw(text)
        top = 94 if large else 110
        tracked_text(td,'CHAPTER 1',640,top,ImageFont.truetype(str(en),20),5,(25,28,35,255))
        tracked_text(td,'煙がつなぐ街',640,top+47,ImageFont.truetype(str(jp),72),6,(25,28,35,255))
        for layer,im in [('characters',people),('shadows',shadow),('type',text)]:
            im.save(HERE/'layers'/f'{letter}-{layer}.png')
        composed = background.convert('RGBA')
        for im in [shadow,people,text]:composed.alpha_composite(im)
        composed.convert('RGB').save(HERE/'titles'/f'{letter}.png')
        records.append({'id':letter,'layout':'人物重視' if large else '余白重視',
         'order_number':order_num+1,'order_left_to_right':order,'order_names':[NAMES[c] for c in order],
         'intent':INTENTS[order_num],'title_text':['CHAPTER 1','煙がつなぐ街'],
         'png':f'titles/{letter}.png','placements':placements,'row_width':row_width,'gap':gap,'ground_y':floor,
         'title_y':top,'background':'#ffffff'})

    comparison = Image.new('RGB',(2680,2510),'#f0efeb')
    cd = ImageDraw.Draw(comparison)
    jp32=ImageFont.truetype(str(jp),32)
    jp24=ImageFont.truetype(str(jp),24)
    cd.text((40,24),'第1章タイトルコール / 6案比較',font=jp32,fill='#202832')
    cd.text((40,75),'同じ6人・同じ衣装・同じ右向き歩行素材。右端が進行方向の先頭。',font=jp24,fill='#525e68')
    for row in range(3):
        for col in range(2):
            record = records[row+3*col]
            x,y = 40+1320*col,140+790*row
            cd.text((x,y),f'{record["id"]}  {record["layout"]}  /  並び順{row+1}',font=jp32,fill='#202832')
            comparison.paste(Image.open(HERE/record['png']),(x,y+48))
            cd.rectangle((x,y+48,x+1279,y+767),outline='#dadbd8')
    comparison.save(HERE/'comparison.png')

    # Identity review: adopted front view beside selected walking pose, outside
    # title canvases. Reference body heights use the same relative scale.
    audit = Image.new('RGB',(2100,1130),'#f5f4f0')
    ad = ImageDraw.Draw(audit)
    ad.text((30,20),'本人性の比較：左＝採用済み本編画像 / 右＝今回の歩行素材',font=jp32,fill='#202832')
    for i,cid in enumerate(IDS):
        x,y=25+(i%3)*695,85+(i//3)*515
        ad.text((x+10,y),NAMES[cid],font=jp24,fill='#202832')
        current=Image.open(HERE/refs[cid]['reference_copy']).convert('RGBA')
        current=current.crop(current.getchannel('A').getbbox())
        walk=Image.open(HERE/next(g['selected_original'] for g in generation if g['id']==cid)).convert('RGBA')
        walk=walk.crop(visible_box(walk))
        h=round(430*refs[cid]['layout_relative_height'])
        for col,im in enumerate([current,walk]):
            im=im.resize((round(im.width*h/im.height),h),Image.Resampling.NEAREST)
            audit.paste(im,(x+col*320+(300-im.width)//2,y+480-h),im)
    audit.save(HERE/'review/identity-comparison.png')

    document={'canvas':[1280,720],'base_commit':source_doc['base_commit'],
     'tool':'built-in image_gen','adoption_status':'review candidates only; not adopted into runtime',
     'master_grid_max_height':GRID_HEIGHT,'sprites':generation,'layouts':records,
     'font_rendering':{'english':'Times New Roman regular 20px, tracking 5px','japanese':'Hiragino Mincho ProN regular 72px, tracking 6px',
       'font_files_distributed':False,'text_layer':'RGBA PNG, separate from people and background'},
     'revision_history':[{'id':'minto-v1','status':'rejected for title study','reason':'raised heels differed from adopted platform footwear'},
       {'id':'minto-v2','status':'selected for study','change':'flatter chunky platform soles and shorter stride'}]}
    (HERE/'generation.json').write_text(json.dumps(document,ensure_ascii=False,indent=2)+'\n')
    (HERE/'layout-data.js').write_text('window.CH1_LAYOUTS = '+json.dumps(records,ensure_ascii=False,indent=2)+';\n')
    print('Built 6 titles, comparison, separated layers and 6 shared sprites.')
    print([(r['id'],r['row_width'],r['ground_y']) for r in records])

if __name__=='__main__':
    main()
