"""Build six current-runtime references; never change adopted assets."""
import hashlib
import json
import shutil
import subprocess
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(ROOT / 'tools'))
from make_face_icons import face_box

IDS = ['hajime', 'sumi', 'tsumugi', 'naru', 'adam', 'minto']
NAMES = ['はじめ', 'スミさん', 'つむぎ', 'なる', 'アダム', 'みんと（営業衣装）']
HEIGHTS = [172, 182, None, 176, 178, 156]
NOTES = {
 'hajime': ['黒髪・灰緑の瞳／22歳', '黒キャップ・黒フードジャケット', '黒カーゴ／黒ハイカット', '銀の筒形ペンダント・両手はポケット'],
 'sumi': ['黒髪・茶の瞳／46歳', '黒ハンチング・四角い黒眼鏡・ひげ', '黒シャツ袖まくり／長い茶エプロン', '黒スラックス・黒革靴／大柄'],
 'tsumugi': ['茶のボブ・赤茶の瞳／21歳', '紫の花刺繍パーカー・小さな丸ピアス', '黒プリーツ・黒ニーソ・黒厚底靴', '黒タブレットを胸で抱える／小柄'],
 'naru': ['短い銀髪・金茶の瞳／23歳', '黒白ジャケット／襟の内側に橙', '銀ペンダント・ピアス・腰チェーン', '黒カーゴ・白スニーカー／日焼け肌'],
 'adam': ['二色の髪：正面の画面左が緑、右が赤', '黄緑寄りの瞳／28歳・しっかりした腕', '黒ヘンリーネック袖まくり・黒腰エプロン', '黒スラックス・黒革靴／首飾りなし'],
 'minto': ['黒ロング・緑の瞳／成人の営業姿', '角・コウモリ羽の髪飾り・ハートチョーカー', '黒オフショルダー＋淡緑リボンとフリル', '黒ガーター・ニーソ／緑縁の厚底靴'],
}

def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()

def main():
    out = HERE / 'references'
    out.mkdir(parents=True, exist_ok=True)
    manifest = json.loads((ROOT / 'remake/data/manifest.json').read_text())
    characters = {c['id']: c for c in json.loads((ROOT / 'data/characters.json').read_text())}
    base = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
    jp = next(Path('/System/Library/Fonts').glob('*明朝 ProN.ttc'))
    font = ImageFont.truetype(str(jp), 23)
    small = ImageFont.truetype(str(jp), 17)
    canvas = Image.new('RGB', (2100, 1440), '#f6f5f2')
    draw = ImageDraw.Draw(canvas)
    draw.text((40, 25), '第1章・採用済みの本編立ち絵 / 制作用参照（生成候補ではありません）', fill='#1b2029', font=font)
    draw.text((40, 65), f'main {base} / みんとは normal（営業姿）のみ', fill='#56616c', font=small)
    records = []
    for i, cid in enumerate(IDS):
        rel = f'assets/sprites/characters/{cid}/chr_{cid}_normal.png'
        source = ROOT / rel
        assert 'normal' in manifest['portraits'][cid]['faces']
        target = out / f'{cid}-adopted-normal.png'
        shutil.copyfile(source, target)
        im = Image.open(source).convert('RGBA')
        bbox = im.getchannel('A').getbbox()
        full = im.crop(bbox)
        x, y = 30 + (i % 3) * 690, 120 + (i // 3) * 650
        draw.rounded_rectangle((x, y, x+660, y+620), radius=10, fill='white', outline='#d8dcde')
        draw.text((x+22, y+17), NAMES[i], fill='#17212a', font=font)
        h = round(480 * ((HEIGHTS[i] or 172*characters[cid].get('spriteScale', 1))/182))
        full = full.resize((round(full.width*h/full.height), h), Image.Resampling.LANCZOS)
        canvas.paste(full, (x+22+(250-full.width)//2, y+562-h), full)
        fx, fy, side = face_box(cid, im)
        face = im.crop((fx,fy,fx+side,fy+side)).resize((230,230), Image.Resampling.LANCZOS)
        canvas.paste(face, (x+315,y+65), face)
        for j,line in enumerate(NOTES[cid]):
            draw.text((x+290,y+330+j*38), line, fill='#293540', font=small)
        height_label = f'{HEIGHTS[i]}cm' if HEIGHTS[i] else '身長未設定：本編倍率0.88を使用'
        draw.text((x+290,y+505), height_label, fill='#62707b', font=small)
        draw.text((x+20,y+578), f'chr_{cid}_normal.png / SHA256 {sha(source)[:16]}', fill='#62707b', font=small)
        records.append({'id':cid,'name':NAMES[i],'source_path':rel,'source_commit':base,
         'source_sha256':sha(source),'git_blob_sha':subprocess.check_output(['git','rev-parse',f'HEAD:{rel}'],cwd=ROOT,text=True).strip(),
         'reference_copy':str(target.relative_to(HERE)),'image_size':list(im.size),'alpha_bbox':bbox,
         'height_cm':HEIGHTS[i], 'layout_relative_height':(HEIGHTS[i] or 172*characters[cid].get('spriteScale',1))/182,
         'identity_checklist':NOTES[cid], 'runtime_evidence':['remake/data/manifest.json:portraits/'+cid,'remake/js/core/data.js:portraitInfo'],
         'outfit':'営業衣装 / normal、ura_*不使用' if cid=='minto' else 'current normal'})
    canvas.save(out/'adopted-six-reference-sheet.png')
    (out/'sources.json').write_text(json.dumps({'base_commit':base,'sheet_tool':'tools/make_face_icons.py:face_box (same crop used by make_reference_sheet.py)',
       'title_decision':'https://github.com/haseatsu114514-dot/shisha-game/issues/445',
       'references':records},ensure_ascii=False,indent=2)+'\n')
    print('Built reference sheet and 6 byte-identical runtime copies:', base)

if __name__ == '__main__':
    main()
