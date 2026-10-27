"""Verify the #375 heroine title candidates (moved from issue375-candidate-qa.yml)."""
import hashlib
import json
from pathlib import Path

from PIL import Image

base = Path('asset_sources/heroine-title-candidates-20261009/review-issue375/background-plants')
records = json.loads((base / 'candidates.json').read_text())['items']
assert len(records) == 2
for row in records:
    assert row['approved'] is False and row['runtime_paths'] == []
    for file, expected in [(row['path'], row['sha256']), (row['source_path'], row['source_sha256'])]:
        assert hashlib.sha256(Path(file).read_bytes()).hexdigest() == expected, file
    with Image.open(row['path']) as image:
        image.load()
        assert image.size == (1024, 1536) and image.mode == 'RGB'
print('PASS: 2 candidate/source hashes, native size, owner review pending, unregistered')
