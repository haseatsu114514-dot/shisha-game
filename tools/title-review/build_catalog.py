#!/usr/bin/env python3
"""Build a hash-deduplicated, generated-art-only review catalog (never edits sources)."""
import argparse
import hashlib
import json
import re
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
CHARACTERS = {'ageha': 'アゲハ', 'hiyori': 'ひより', 'samechan': 'サメちゃん／波多野なぎさ', 'mashiro': 'ましろ', 'minto': 'みんと', 'rin': '凛', 'tsumugi': 'つむぎ', 'other': 'その他'}
V1 = 'asset_sources/title-art/heroine-concepts-v1-20261008'
V2 = 'asset_sources/title-art/heroine-concepts-v2-personality-pixel-20261008'
DAILY = 'asset_sources/heroine-title-candidates-20261009'
AGEHA = DAILY + '/review-issue375/ageha-identity'
HIYORI = 'asset_sources/hiyori-title-candidates-issue373'
TUBS = 'asset_sources/shisha-hardware-reference/flavor-storage-tubs-issue396/candidate'
NG = 'asset_sources/shisha-hardware-reference/ng-examples'


def read(path):
    return json.loads((ROOT / path).read_text())


def build(check=False):
    rows = {}
    relations = []
    missing = []
    def add(path, character=None, group='その他CG', label=None, history=None, prompt=None, before=None):
        path = str(Path(path).as_posix())
        p = ROOT / path
        if not p.is_file():
            raise ValueError(f'Missing selected art: {path}')
        if character is None:
            character = next((c for c in CHARACTERS if c != 'other' and c in path), 'other')
        row = rows.setdefault(path, {'path': path, 'character': character, 'groups': [], 'label': label or p.stem, 'history': [], 'prompts': []})
        if group not in row['groups']: row['groups'].append(group)
        if label: row['label'] = label
        if history and history not in row['history']: row['history'].append(history)
        prompts = [prompt] if prompt else [str(p.with_suffix('.prompt.txt').relative_to(ROOT))]
        for candidate in prompts:
            if candidate and (ROOT / candidate).is_file() and candidate not in row['prompts']:
                row['prompts'].append(candidate)
        if before: relations.append((before, path))
        return row

    # Current status comes only from the production manifest, never old candidate approval flags.
    official = read('remake/data/manifest.json')['titleArts']
    for a in official:
        add('assets/ui/title_arts/' + a['file'], a['character'], '正式タイトル', history='現在の本編タイトルで使用中')
    for root, group in [(V1, '旧15案'), (V2, '新版19案')]:
        concepts = read(root + '/concepts.json')['concepts']
        for c in concepts:
            add(root + '/' + c['source'], c['character'], group, c.get('label'), c.get('status'), root + '/' + c.get('latest_prompt', c.get('prompt', '')))
        # Original/intermediate generations, excluding reference photos, contact sheets, and screenshots.
        for char in CHARACTERS:
            directory = ROOT / root / char
            for p in sorted(directory.glob('*.png')):
                rp = str(p.relative_to(ROOT))
                r = add(rp, char, group)
                if any(x in p.stem for x in ['first', 'revision']):
                    r['groups'].append('途中履歴')
                    base = re.sub(r'-(first|revision-\d+)$', '', p.stem) + '.png'
                    b = str(p.with_name(base).relative_to(ROOT))
                    if b != rp and (ROOT / b).is_file(): relations.append((rp, b))
        if root == V2:
            for c in concepts:
                previous = V1 + '/' + c['source']
                if (ROOT / previous).is_file(): relations.append((previous, root + '/' + c['source']))

    inventory = read(DAILY + '/review-issue375/inventory.json')
    for c in inventory['candidates']:
        add(c['path'], c['character'], '別タイトル候補', label={'ageha_c_backstage_selfie':'楽屋のセルフィー','title_art_ageha_02_bowl_wash':'閉店後のボウル洗い','title_art_mashiro_01_window_smoke':'窓際の一服','title_art_mashiro_02_dark_leaf_prep':'ダークリーフの準備','title_art_mashiro_03_tetsuko':'猫のてつこと休憩','minto_01_afterhours_smoke':'閉店後の一服','minto_03_private_parfait':'私服でパフェ','title_art_minto_02_opening_prep':'開店前の準備','rin_c_midnight_coffee':'深夜のコーヒー','title_art_rin_02_aroma_blend':'香りのブレンド','title_art_tsumugi_02_bowl_prep':'ボウルの準備','title_art_tsumugi_03_rain_drawing':'雨の日の絵描き'}.get(Path(c['path']).stem), history=c['status'] + '：' + c.get('visual_review', ''), prompt=c.get('prompt'))
    revision = inventory['revision']
    add(revision['path'], 'minto', 'みんと修正', '私服パフェ・植物修正', revision['status'] + '：' + revision['qa'], revision.get('prompt'), revision['before'])
    for c in inventory['missing_slots']:
        if c.get('source') and (ROOT / c['source']).is_file(): add(c['source'], group='過去NG', history=c['status'] + '：' + c['reason'])
        else: missing.append(c)
    for p in sorted((ROOT / DAILY / 'rejected-scale-v1').glob('*.png')):
        add(str(p.relative_to(ROOT)), group='過去NG', history='縮尺の初版NG履歴。採用された修正版と区別して比較する。')
        # A surviving replacement can be paired by file name.
        match = [r for r in rows if Path(r).name == p.name and 'rejected' not in r]
        for replacement in match: relations.append((str(p.relative_to(ROOT)), replacement))
    for p in sorted((ROOT / NG).glob('*.png')):
        add(str(p.relative_to(ROOT)), group='過去NG', history='機材・ホースの過去NG原画。再採用にはオーナー判断と修正確認が必要。')

    for c in read(AGEHA + '/candidates.json')['candidates']:
        add(c['candidate']['path'], 'ageha', 'アゲハ修正', {'ageha-01-professional-face':'試香席・顔修正','ageha-02-grocery-face':'商店街・顔修正','ageha-03-studio-face':'撮影スタジオ・顔修正','ageha-04-selfie-face':'セルフィー・顔修正','ageha-05-closing-rack':'閉店後の乾燥ラック'}.get(c['id'], c['id']), c['status'] + '：' + c.get('locality', ''), c['prompt'], c['source']['path'])
    for c in read(HIYORI + '/candidates.json')['candidates']:
        add(c['candidate']['path'], 'hiyori', 'ひより候補', c['scene'], c['status'], c['prompt'])
        if 'prior_version' in c:
            old = c['prior_version']
            add(old['image']['path'], 'hiyori', '過去NG', c['scene'] + '・修正前', old['status'] + '：' + old['reason'], old['prompt'], before=None)
            relations.append((old['image']['path'], c['candidate']['path']))
    tubs = read(TUBS + '/metadata.json')
    previous = tubs['before']['path']
    for key in ['v1', 'v2', 'v3', 'v4', 'v5']:
        c = tubs[key]
        history = c['status'] + '：' + c.get('reason', c.get('owner_feedback', ''))
        if c.get('qa'): history += '\n' + json.dumps(c['qa'], ensure_ascii=False)
        add(c['path'], 'minto', 'タッパー修正', '開店準備・タッパー ' + key, history, c['prompt'], previous)
        previous = c['path']

    # Other related generated CGs; never include real reference photography.
    for root in ['asset_sources/minto-first-cheki', 'asset_sources/minto-first-cheki-v2', 'asset_sources/minto-cheki-variants-v1', 'asset_sources/ch1-keyart']:
        for p in sorted((ROOT / root).glob('*.png')):
            add(str(p.relative_to(ROOT)), group='関連CG', label={'minto-cheki-cheek':'チェキ・頬に指','minto-cheki-heart':'チェキ・ハート','minto-cheki-wave':'チェキ・手を振る','portrait-before-background-edit':'初来店チェキ・背景修正前'}.get(p.stem, ('第1章キービジュアル' if 'ch1-keyart' in root else ('初来店チェキ・v2' if root.endswith('-v2') else '初来店チェキ・旧原画'))))
    for p in sorted((ROOT / 'assets/ui/title_arts').glob('*.png')):
        if str(p.relative_to(ROOT)) not in rows: add(str(p.relative_to(ROOT)), group='キービジュアル')

    # Explicit extensions keep inclusion reviewable and exclude unknown folders/photos by default.
    extension = OUT / 'extra_sources.json'
    if extension.is_file():
        for spec in read(str(extension.relative_to(ROOT))): add(**spec)

    by_hash = {}
    path_ids = {}
    for r in rows.values():
        digest = hashlib.sha256((ROOT / r['path']).read_bytes()).hexdigest()
        path_ids[r['path']] = digest
        if digest not in by_hash:
            with Image.open(ROOT / r['path']) as im:
                im.load()
                size = list(im.size)
            by_hash[digest] = {'id': digest, 'sha256': digest, 'character': r['character'], 'label': r['label'], 'size': size, 'sources': [], 'groups': [], 'history': [], 'prompts': [], 'current': False, 'related': [], 'image': f'media/{digest}.webp', 'thumbnail': f'media/{digest}-thumb.webp'}
        a = by_hash[digest]
        a['sources'].append(r['path'])
        for key in ['groups', 'history', 'prompts']:
            for v in r[key]:
                if v not in a[key]: a[key].append(v)
        if '正式タイトル' in r['groups']: a['current'] = True
        if not r['label'].startswith('title_art_'): a['label'] = r['label']
    for before, after in relations:
        if before not in path_ids or after not in path_ids: raise ValueError(f'Missing relation: {before} -> {after}')
        a, b = path_ids[before], path_ids[after]
        if a != b:
            for x, y in [(a,b),(b,a)]:
                if y not in by_hash[x]['related']: by_hash[x]['related'].append(y)
    references = {}
    for char in CHARACTERS:
        if char == 'other': continue
        paths = [f'assets/sprites/characters/{char}/chr_{char}_normal.png', f'assets/ui/face_icons/face_{char}.png']
        if char == 'minto': paths.append('assets/sprites/characters/minto/chr_minto_ura_normal.png')
        references[char] = [{'path': p, 'label': '正式私服' if 'ura_' in p else ('正式顔' if 'face_' in p else '正式立ち絵'), 'url': '../../' + p} for p in paths if (ROOT / p).is_file()]
    items = sorted(by_hash.values(), key=lambda a: (not a['current'], a['character'], a['groups'][0], a['label']))
    catalog = {'version': 1, 'characters': CHARACTERS, 'items': items, 'references': references, 'summary': {'originalPaths': len(rows), 'uniqueArt': len(items), 'duplicatePaths': len(rows)-len(items), 'current': sum(a['current'] for a in items), 'missingHistoricalSlots': missing}}
    encoded = json.dumps(catalog, ensure_ascii=False, indent=2) + '\n'
    if check:
        assert (OUT / 'catalog.json').read_text() == encoded, 'Catalog is stale; regenerate it'
        for a in items:
            for key in ['image','thumbnail']:
                with Image.open(OUT / a[key]) as im: im.load()
    else:
        (OUT / 'media').mkdir(exist_ok=True)
        for a in items:
            for key, max_size, quality in [('image', (1536,1536), 94), ('thumbnail', (400,480), 83)]:
                target = OUT / a[key]
                if not target.exists():
                    with Image.open(ROOT / a['sources'][0]) as im:
                        im = im.convert('RGB'); im.thumbnail(max_size, Image.Resampling.LANCZOS)
                        im.save(target, 'WEBP', quality=quality, method=6)
        (OUT / 'catalog.json').write_text(encoded)
    print(json.dumps(catalog['summary'], ensure_ascii=False))

if __name__ == '__main__':
    parser = argparse.ArgumentParser(); parser.add_argument('--check', action='store_true')
    build(parser.parse_args().check)
