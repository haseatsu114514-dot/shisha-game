#!/usr/bin/env python3
"""Rebuild the provenance and checksums after fitting the six portraits."""
from pathlib import Path
from PIL import Image
import hashlib
import json

root = Path(__file__).resolve().parents[3]
folder = Path(__file__).resolve().parent
prompts = json.loads((folder / 'prompts.json').read_text())['prompts']
ref = {
 'noor_normal': ('assets/sprites/characters/noor/chr_noor_normal.png', 'identity and normal expression'),
 'noor_smile': ('assets/sprites/characters/noor/chr_noor_smile.png', 'identity and smile expression'),
 'noor_surprise': ('assets/sprites/characters/noor/chr_noor_surprise.png', 'identity and surprise expression'),
 'rio': ('assets/sprites/characters/rio/chr_rio_normal.png', 'female head-to-body proportion only'),
 'new_minto': ('assets/sprites/character_variants/new/minto/chr_minto_normal.png', 'adopted new style'),
 'new_tsumugi': ('assets/sprites/character_variants/new/tsumugi/chr_tsumugi_normal.png', 'maximum outline weight'),
 'nanami_minto': ('assets/sprites/character_variants/nanami/minto/chr_minto_normal.png', 'adopted nanami style'),
 'nanami_hiyori': ('assets/sprites/character_variants/nanami/hiyori/chr_hiyori_normal.png', 'adopted nanami style'),
}
paths = {
 'new/normal': ['noor_normal','rio','new_minto','new_tsumugi'],
 'new/smile': ['noor_smile','rio','new_normal','new_tsumugi'],
 'new/surprise': ['noor_surprise','rio','new_normal','new_tsumugi'],
 'nanami/normal': ['noor_normal','rio','nanami_minto','nanami_hiyori'],
 'nanami/smile': ['noor_smile','rio','nanami_normal','nanami_minto'],
 'nanami/surprise': ['noor_surprise','rio','nanami_normal','nanami_minto'],
}
ref['new_normal'] = ('asset_sources/portraits/noor-2703/new/normal-source.png','accepted same-person new normal')
ref['nanami_normal'] = ('asset_sources/portraits/noor-2703/nanami/normal-source.png','accepted same-person nanami normal')
def info(rel):
    file = root / rel
    im = Image.open(file)
    return {'path':rel,'bytes':file.stat().st_size,'sha256':hashlib.sha256(file.read_bytes()).hexdigest(),'dimensions':list(im.size),'mode':im.mode}
record = {'issue':2703,'generator':'Codex built-in image_gen','prompt_file':'asset_sources/portraits/noor-2703/prompts.json','fit':'asset_sources/portraits/noor-2703/fit.py','canvas':[896,1200],'person_height_px':1080,'feet_y':1140,'variants':{}}
for key,refs in paths.items():
    style,expression = key.split('/')
    record['variants'][key] = {
      'prompt':prompts[key],
      'references':[dict(info(ref[name][0]),role=ref[name][1]) for name in refs],
      'original':info(f'asset_sources/portraits/noor-2703/{style}/{expression}-source.png'),
      'png':info(f'assets/sprites/character_variants/{style}/noor/chr_noor_{expression}.png'),
      'webp':info(f'remake/img/sprites/character_variants/{style}/noor/chr_noor_{expression}.webp'),
    }
(folder / 'generation.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n')
