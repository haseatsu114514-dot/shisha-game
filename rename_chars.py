import os
import json
import re

def replace_in_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    
    # Simple ID replacements
    content = content.replace('"nishio"', '"naru"')
    content = content.replace('"author": "nishio"', '"author": "naru"')
    content = content.replace('spot_id == "nishio"', 'spot_id == "naru"')
    # just global ID replace for nishio->naru and kirara->minto
    content = re.sub(r'\bnishio\b', 'naru', content)
    content = re.sub(r'\bkirara\b', 'minto', content)
    
    # Nishio Japanese name
    content = content.replace('にしお', 'なる')
    
    # Kirara Japanese name
    # "きらら" -> "眠都" for general
    # But for her own dialogue, "きらら" -> "みんちゃん"
    # Actually, let's just replace "きらら" with "眠都" everywhere first, then we can manually fix her dialogue.
    # Wait, she calls herself "きらら" a lot. Let's do a smart replace if it's inside her dialogue JSON.
    
    if filepath.endswith('ch1_minto.json') or filepath.endswith('ch1_tournament.json'):
        # Just replace きらら with みんちゃん in texts because mostly she is speaking or it fits.
        # Actually, let's just do it manually for her dialogue.
        pass
    else:
        content = content.replace('きらら', '眠都')

    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {filepath}")

for root, dirs, files in os.walk('.'):
    if '.git' in root or '.gemini' in root:
        continue
    for file in files:
        if file.endswith('.json') or file.endswith('.gd') or file.endswith('.md') or file.endswith('.csv'):
            if file == 'rename_chars.py': continue
            replace_in_file(os.path.join(root, file))

