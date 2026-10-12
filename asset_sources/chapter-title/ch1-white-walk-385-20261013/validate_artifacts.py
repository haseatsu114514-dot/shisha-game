"""Asset integrity checks for this review bundle; no runtime game modifications."""
import hashlib
import json
import re
from pathlib import Path
from PIL import Image, ImageChops

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()

g=json.loads((HERE/'generation.json').read_text())
refs=json.loads((HERE/'references/sources.json').read_text())
ids={'hajime','sumi','tsumugi','naru','adam','minto'}
assert len(g['sprites'])==6 and {s['id'] for s in g['sprites']}==ids
for r in refs['references']:
    assert sha(HERE/r['reference_copy'])==r['source_sha256']==sha(ROOT/r['source_path'])
for s in g['sprites']:
    assert sha(HERE/s['sprite_path'])==s['sprite_sha256']
    assert sha(HERE/s['selected_original'])==s['original_sha256']
    im=Image.open(HERE/s['sprite_path']);assert im.mode=='RGBA'
    assert im.getchannel('A').getextrema()==(0,255)
    assert im.size==tuple(s['sprite_size'])
master={s['id']:s['sprite_sha256'] for s in g['sprites']}
checks=[]
for r in g['layouts']:
    positions=r['placements']
    assert len(positions)==6 and {p['id'] for p in positions}==ids
    assert [p['id'] for p in positions]==r['order_left_to_right']
    assert r['title_text']==['CHAPTER 1','煙がつなぐ街']
    for i,p in enumerate(positions):
        assert p['sprite_sha256']==master[p['id']]
        assert 0<=p['x'] and p['x']+p['width']<=1280
        assert 0<=p['y'] and p['y']+p['height']==r['ground_y']<=720
        if i:assert positions[i-1]['x']+positions[i-1]['width']<p['x']
    composed=Image.open(HERE/'layers/background.png').convert('RGBA')
    for layer in ['shadows','characters','type']:
        im=Image.open(HERE/'layers'/f'{r["id"]}-{layer}.png')
        assert im.size==(1280,720) and im.mode=='RGBA'
        composed.alpha_composite(im)
    final=Image.open(HERE/r['png']).convert('RGB')
    assert final.size==(1280,720)
    assert ImageChops.difference(composed.convert('RGB'),final).getbbox() is None
    checks.append({'id':r['id'],'six_unique_characters':True,'shared_sprite_hashes':True,
      'inside_canvas':True,'no_overlap':True,'ground_aligned':True,'layers_recompose_exactly':True,
      'final_sha256':sha(HERE/r['png'])})
html=(HERE/'index.html').read_text()
for rel in re.findall(r'(?:src|href)="([^"]+)"',html):
    assert (HERE/rel).is_file(),rel
selected=json.loads((HERE/'selected-D/generation.json').read_text())
assert selected['order_left_to_right']==g['layouts'][3]['order_left_to_right']
assert sha(HERE/'selected-D/D-title.png')==selected['final_sha256']
for r in selected['image_reference_roles']:assert sha(HERE/r['path'])==r['sha256']
selected_image=Image.open(HERE/'selected-D/art-plate.png').convert('RGBA')
selected_image.alpha_composite(Image.open(HERE/'selected-D/type.png'))
assert ImageChops.difference(selected_image.convert('RGB'),Image.open(HERE/'selected-D/D-title.png')).getbbox() is None
assert selected_image.size==(1280,720)
result={'result':'pass','base_commit':g['base_commit'],'layout_checks':checks,
 'reference_copies_byte_identical':True,'rgba_sprites':6,
 'manual_visual_review':{'opened_full_size':['A','B','C','D','E','F'],
  'opened_identity_comparison':True,
  'findings':'6人と衣装・右向きの顔/胴/脚・手足・配色・足元・余白・禁止文字を確認。みんとの靴v1を修正しv2を使用。',
  'identity_checks':{'hajime':'黒キャップ・若い顔・黒フード・カーゴ・ペンダント',
   'sumi':'ハンチング・四角い眼鏡・ひげ・茶の長いエプロン',
   'tsumugi':'茶ボブ・赤茶の目・紫の花刺繍・タブレット・黒ニーソと靴',
   'naru':'銀髪・金茶の目・黒白の切替・腰チェーン・白スニーカー',
   'adam':'手前の本人右側の緑髪と遠い側の赤髪・黒ヘンリー・黒腰エプロン・首飾りなし',
   'minto':'黒ロング・緑の目・髪飾り・黒淡緑の営業服・ガーター・緑縁の厚底靴'},
  'scope':'静止画候補の目視検品。オーナーによる本人性の採用判断は未了。'},
 'selected_D_refinement':{'owner_selected_D':True,'full_size_opened':True,'six_people_rightward_visual_check':True,
   'identity_and_clothing_visual_check':True,'game_title_and_formal_subtitle_checked':True,
   'art_and_type_recompose_exactly':True,'source_hashes_checked':True,
   'separation_limit':'追加Dは白背景と人物が一枚の生成プレート。文字は独立RGBA。元の6人のRGBAも保持。'},
 'browser_review':{'six_switches_images_loaded':True,'type_toggle':True,'six_grid':True,
   'default_selected_D':True,'desktop_viewport':[1280,900],'mobile_viewport':[390,844],
   'horizontal_overflow':False,'broken_images':0,'console_errors_observed':0,
   'screenshots':['review/browser-selected-D.jpg','review/browser-mobile.jpg']},
 'not_performed':['歩行アニメーション','本編への差し替え','mainへのマージ','公開版更新']}
(HERE/'review/validation.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print('PASS: 6 layouts, 6 shared RGBA sprites, reference hashes, order, bounds, gaps, floor and exact layer composition.')
