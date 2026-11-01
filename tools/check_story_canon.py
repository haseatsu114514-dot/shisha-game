#!/usr/bin/env python3
"""Check active canon, script ordering and route references. _legacy is history only."""
import json
import re
import sys
from pathlib import Path
from lint_dialogue import bracket_problem, fullwidth_len

ROOT = Path(__file__).resolve().parents[1]


def nodes(value):
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from nodes(child)
    elif isinstance(value, list):
        for child in value:
            yield from nodes(child)


def tsumugi_first_person_errors(speaker, text):
    # #2015: only clear, unquoted uses of わたし. Skip whole quoted lines;
    # attribution and possessive/embedded uses need human judgment.
    if speaker != 'tsumugi' or not isinstance(text, str):
        return []
    if any(mark in text for mark in '「」『』“”‘’"\''):
        return []
    if re.search(r'(?:^|[\s、。！？!?…])わたし(?:[、。！？!?…]|[はがもにと]|から)', text):
        return ['つむぎの一人称は私（#2015）']
    return []


def lime_first_person_errors(data):
    errors = []
    for message in data.get('messages', []):
        location = f'lime_messages.json:{message["id"]}'
        # A reply's text is the player's choice; response is the sender's line.
        for row in nodes(message):
            errors.extend(f'{location}: {e}' for e in
                          tsumugi_first_person_errors(row.get('sender'), row.get('text')))
        for reply in message.get('replies', []):
            errors.extend(f'{location}: replies.response: {e}' for e in
                          tsumugi_first_person_errors(message.get('sender'), reply.get('response')))
    return errors


def text_errors(row):
    errors = []
    text = row.get('text')
    speaker = row.get('speaker')
    if not isinstance(text, str):
        return errors
    if speaker and text.startswith('「') and text.endswith('」'):
        errors.append('speaker台詞全体を「」で囲まない')
    if bracket_problem(text):
        errors.append('括弧が一行の中で閉じていない')
    if speaker == 'hajime' and re.search(r'僕|あたし', text):
        errors.append('はじめの一人称は俺')
    if speaker == 'dr_kemuri' and '僕' in text:
        errors.append('博士の一人称は私（公的）／俺（はじめ・年下とフランクに）')
    if speaker == 'ageha' and re.search(r'あたし|アタシ|ウチ|はじめくん', text):
        errors.append('あげははうち／ハジメっち')
    if speaker == 'tsumugi' and 'はじめくん' in text:
        errors.append('つむぎははじめさん')
    errors.extend(tsumugi_first_person_errors(speaker, text))
    if speaker == 'kumicho' and re.search(r'ワシ|わし', text):
        errors.append('神崎の一人称は俺')
    if re.fullmatch(r'[♡♥」』）\s]+', text):
        errors.append('記号だけの孤立ページ')
    if text.startswith('（') and fullwidth_len(text) > 48:
        errors.append('心の声は括弧込みで48字以内')
    return errors


def check(root=ROOT):
    errors, scenes = [], {}
    errors.extend(lime_first_person_errors(json.loads((root / 'data/lime_messages.json').read_text())))
    files = sorted((root / 'data/dialogue').glob('*.json'))
    for path in files:
        data = json.loads(path.read_text())
        for scene in data.get('dialogues', []):
            sid = scene['dialogue_id']
            if sid in scenes:
                errors.append(f'{path.name}:{sid}: duplicate ID')
            scenes[sid] = scene
            for row in nodes(scene):
                errors.extend(f'{path.name}:{sid}: {e}' for e in text_errors(row))
                for field in ('next_id', 'dialogue_id', 'dialogue_file'):
                    if '_legacy' in str(row.get(field, '')):
                        errors.append(f'{path.name}:{sid}: legacy reference')
    for document in ('brand/story_and_structure.md', 'brand/character_profiles.md'):
        text = (root / document).read_text()
        for num, line in enumerate(text.splitlines(), 1):
            if re.search(r'僕の(?:シーシャ|煙)|僕には何も|はじめ[^\n「]*「[^」]*僕', line):
                errors.append(f'{document}:{num}: protagonist first-person drift')
    route = json.loads((root / 'data/story_routes.json').read_text())
    roster = route['heroine_ids']
    if len(roster) != 7 or len(set(roster)) != 7:
        errors.append('heroine_ids must have seven unique IDs')
    if set(route['romance']) != set(roster):
        errors.append('romance coverage must match heroine_ids')
    lover = json.loads((root / 'remake/data/lover.json').read_text())
    if set(lover['inviteLines']) != set(roster):
        errors.append('runtime lover roster differs from canon')
    references = []
    for groups in route['chapters'].values():
        for sequence in groups.values():
            references.extend(sequence)
    optional = {sid for groups in route['chapters'].values() for sid in groups.get('optional', [])}
    for sid, required in route.get('optional_requirements', {}).items():
        if sid not in optional:
            errors.append(f'{sid}: prerequisites attached to non-optional scene')
        references.extend(required.get('seen', []))
    references.extend(route['ending'].values())
    references.extend(route['conflict'][field] for field in ('open', 'close', 'pending_ending'))
    references.extend(route['near_conflict'][field] for field in ('open', 'close', 'overlap'))
    if route['conflict']['stage'] != 'post_ending':
        errors.append('serious relationship conflict belongs after the ending')
    for person, spec in route['romance'].items():
        for field in ('date', 'conflict', 'epilogue', 'arrival'):
            references.append(spec[field])
        if spec['date_min_chapter'] <= route['near_conflict']['chapter']:
            references.append(spec.get('near_conflict'))
        for field in ('date', 'epilogue', 'arrival'):
            for row in nodes(scenes.get(spec[field], {})):
                if row.get('stats') or re.search(r'【.+】.*上がった', str(row.get('text', ''))):
                    errors.append(f'{spec[field]}: romance stat reward')
        if not scenes.get(f'confession_{person}_accept'):
            errors.append(f'{person}: missing confession')
    for sid in references:
        if sid not in scenes:
            errors.append(f'story_routes: missing active scene {sid}')
    memories = json.loads((root / 'data/relationship_memories.json').read_text())
    for row in nodes(memories):
        if row.get('dialogue_id') and row['dialogue_id'] not in scenes:
            errors.append(f'memory: missing active scene {row["dialogue_id"]}')
    for path in (root / 'remake/js').rglob('*.js'):
        if re.search(r'(?:["\'`])[^\n"\'`]*_legacy/', path.read_text()):
            errors.append(f'{path.relative_to(root)}: runtime loads legacy data')
    # The first meeting and match-result transitions may not silently disappear from the route.
    ch3 = route['chapters']['3']
    if ch3['before_eve'].count('ch3_mukai_arrival') != 1:
        errors.append('ch3: first meeting must occur once')
    for chapter in ('3', '4'):
        groups = route['chapters'][chapter]
        if set(groups['on_win']) & set(groups['after_eve']):
            errors.append(f'ch{chapter}: victory read before result')
    if route['romance']['ageha']['date_min_chapter'] != 4:
        errors.append('ageha: date before return/reconciliation')
    return errors, len(scenes)


if __name__ == '__main__':
    errors, count = check()
    for error in errors:
        print('ERROR', error)
    if errors:
        sys.exit(1)
    print(f'OK: {count} active scenes, seven routes, canon text, references and legacy isolation')
