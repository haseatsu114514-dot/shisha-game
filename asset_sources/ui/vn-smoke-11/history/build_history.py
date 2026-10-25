"""Build the static GitHub history index from immutable image records."""
import json
import re
from pathlib import Path
from datetime import datetime
from zoneinfo import ZoneInfo
from html import escape

HERE = Path(__file__).resolve().parent
DATA = json.loads((HERE / 'catalog.json').read_text())
ENTRIES = {e['id']: e for e in DATA['entries']}
REPO = 'haseatsu114514-dot/shisha-game'

assert len(ENTRIES) == len(DATA['entries'])
for entry in ENTRIES.values():
    assert re.fullmatch(r'[0-9a-f]{40}', entry['source_commit'])
    assert entry['path'].startswith('asset_sources/') and '..' not in entry['path'].split('/')


def view(record):
    return f"https://github.com/{REPO}/blob/{record['source_commit']}/{record['path']}"


def image(record):
    return f"https://media.githubusercontent.com/media/{REPO}/{record['source_commit']}/{record['path']}"


def raw(record):
    return f"https://github.com/{REPO}/raw/{record['source_commit']}/{record['path']}"


def when(date):
    return datetime.fromisoformat(date.replace('Z', '+00:00')).astimezone(ZoneInfo('Asia/Tokyo')).strftime('%m/%d %H:%M')


def picture(record, width=840):
    return f'<a href="{view(record)}"><img src="{image(record)}" alt="{escape(record.get("label", "比較画像"))}" width="{width}"></a>'


def save(name, content):
    p = HERE / name
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content.rstrip() + '\n')


def frozen(entry):
    return f"保存版 `{entry['source_commit'][:8]}` ／ `{entry['path']}`"


def card(entry, heading=True, width=840):
    s = f"## {entry['id']}\n\n" if heading else ''
    s += f"**{entry['label']}** — {entry['kind']} ／ {entry['status']}\n\n"
    if entry.get('same_image_as'):
        s += f"画像の保存内容は `{entry['same_image_as']}` と同一です。再生成ではありません。\n\n"
    s += picture(entry, width) + '\n\n'
    s += f"[原寸を開く]({view(entry)}) ／ [画像をダウンロード]({raw(entry)})\n\n{frozen(entry)}\n\n"
    return s


def run():
    original_ids = [f'O{i}' for i in range(16, 31)]
    intro = '# 最初の15案・原寸から選ぶ\n\n[履歴の入口](README.md) ／ [時系列](README.md#制作順)\n\n'
    intro += '最初の一覧の16〜30を、その番号のまま **O16〜O30** として固定しました。比較シート内の01〜15は会話UI内の番号です。例：**O26＝旧一覧26＝会話案11「煙だけの輪郭」**。\n\n'
    intro += picture(DATA['original_contact']) + '\n\n'
    intro += '| 最初の一覧 | 最初の一覧 | 最初の一覧 |\n| --- | --- | --- |\n'
    for offset in range(0, 15, 3):
        cells = []
        for eid in original_ids[offset:offset + 3]:
            e = ENTRIES[eid]
            cells.append(f'<b>{eid}</b> {e["label"]}<br><a href="{view(e)}"><img src="{image(e["thumbnail"])}" width="260" alt="{escape(e["label"])}"></a><br><a href="{view(e)}">原寸</a>')
        intro += '| ' + ' | '.join(cells) + ' |\n'
    intro += '\n以下は原画ごとの固定リンクです。生成モックには当時の文字・人物・背景も含まれています。\n\n'
    for eid in original_ids:
        intro += card(ENTRIES[eid])
    save('originals.md', intro)

    for i, v in enumerate(DATA['versions']):
        left = f"[← {DATA['versions'][i-1]['id']}]({DATA['versions'][i-1]['id']}.md)" if i else '[← 初期15案](../originals.md)'
        right = f"[{DATA['versions'][i+1]['id']} →]({DATA['versions'][i+1]['id']}.md)" if i + 1 < len(DATA['versions']) else '[PSD](../../psd-export/README.md)'
        text = f"# {v['id']}｜{v['title']}\n\n{left} ／ [履歴の入口](../README.md) ／ {right}\n\n"
        text += f"**{when(v['date'])} JST ／ {v['status']}**\n\n{v['note']}\n\n"
        if v['id'] == 'V13':
            text += '**この6案は全案没です。履歴の閲覧によって採用へ戻ることはありません。**\n\n'
        text += picture(v['contact']) + '\n\n'
        text += '| 指定用ID | 画像 | 種別 |\n| --- | --- | --- |\n'
        for eid in v['entry_ids']:
            e = ENTRIES[eid]
            same = f"（`{e['same_image_as']}` と同一画像）" if e.get('same_image_as') else ''
            text += f"| **{eid}** | [{e['label']}]({view(e)}) {same} | {e['kind']} |\n"
        if v['id'] == 'V12':
            text += f"\n**配布済みPSDの版です。** [PSD6種をダウンロード]({raw(DATA['psd'])}) ／ [使い方](../../psd-export/README.md)。\n"
        if any(ENTRIES[x].get('family') == 'B' for x in v['entry_ids']):
            text += '\n青い窓の変化は [平成青の履歴](../families/B.md) でも辿れます。\n'
        text += f"\n[この時点の実装・素材一式](https://github.com/{REPO}/tree/{v['source_commit']}) ／ 保存版 `{v['source_commit']}`\n"
        save('versions/' + v['id'] + '.md', text)

    for family in DATA['families']:
        fid = family['id']
        text = f"# {family['label']}｜変化を辿る\n\n[履歴の入口](../README.md) ／ [初期15案](../originals.md) ／ [文字なし素材](../materials.md)\n\n"
        if fid == '11P':
            text += '11の紫配色はO26を元にしたM01から始まります。O17は別の初期案「紫・煙の絹」で、近い方向の比較として併記しています。\n\n'
        if family['originals']:
            text += '起点・関連する初期原案：' + ' ／ '.join(f'[{x}]({view(ENTRIES[x])})' for x in family['originals']) + '\n\n'
            for x in family['originals']:
                text += card(ENTRIES[x], width=680)
        for v in DATA['versions']:
            ids = [x for x in v['entry_ids'] if ENTRIES[x].get('family') == fid]
            if fid == 'B':
                primary = next((x for x in ids if x.endswith('hiyori')), None)
                ids = [primary] if primary else []
            for eid in ids:
                e = ENTRIES[eid]
                text += f"## {eid}\n\n**{v['title']}** — {when(v['date'])} JST ／ {e['status']}\n\n[この段階の全画像](../versions/{v['id']}.md)\n\n"
                if e.get('same_image_as'):
                    text += f"画像の保存内容は `{e['same_image_as']}` と同じです。[原寸]({view(e)})\n\n"
                else:
                    text += picture(e, 840) + f'\n\n[原寸]({view(e)}) ／ [画像ダウンロード]({raw(e)})\n\n'
                if fid == 'B':
                    text += '他キャラ：' + ' ／ '.join(f"[{ENTRIES[x]['label']}]({view(ENTRIES[x])})" for x in v['entry_ids'] if ENTRIES[x].get('family') == 'B' and x != eid) + '\n\n'
                text += frozen(e) + '\n\n'
        save('families/' + fid + '.md', text)

    material = '# 文字なし原画・素材を辿る\n\n[履歴の入口](README.md) ／ [最初の生成モック15案](originals.md)\n\n素材そのものと、ゲームでの表示結果は区別しています。M01だけは文字・人物を含む最初の紫配色モックです。\n\n'
    for e in ENTRIES.values():
        if e['id'].startswith('M'):
            material += card(e)
    save('materials.md', material)
    retro = '# レトロ4原案と青い窓\n\n[履歴の入口](README.md) ／ [青い窓の実装履歴](families/B.md)\n\nこの4原案はV03とV04の間に生成した静止モックです。文字も生成画像の一部で、実装版と区別します。\n\n'
    for i in range(1, 5):
        retro += card(ENTRIES['R' + str(i)])
    save('retro.md', retro)

    home = '# 会話ウインドウの全履歴から選ぶ\n\n'
    home += '**[まず最初の15案を見る](originals.md)** ／ [文字なしの原画・素材](materials.md) ／ [レトロ4原案](retro.md)\n\n'
    home += '初期モックから現在まで、画像ごとに固定IDを付けました。**画像は当時の保存版へ直接リンクし、後の修正で置き換わりません。** 没案も採否を表示して残しています。\n\n'
    home += picture(DATA['original_contact']) + '\n\n'
    home += '最初のシートの01〜15は、旧一覧の16〜30に対応します。**O16＝切り紙、O25＝琥珀、O26＝煙（会話案11）、O28＝薄紙**です。\n\n'
    home += '## 路線ごとに見比べる\n\n'
    home += ' ／ '.join(f"[{f['label']}](families/{f['id']}.md)" for f in DATA['families']) + '\n\n'
    home += '## 制作順\n\n日時は日本時間です。生成モック、実装プレビュー、文字なし素材を区別しています。\n\n'
    home += '| 順番 | その時点の保存版 | 主な違い・扱い |\n| --- | --- | --- |\n'
    home += '| 初期 O16〜O30 | [最初の15原案](originals.md) | 旧一覧の番号を保持。原寸と軽量サムネイルで選べる |\n'
    for v in DATA['versions']:
        home += f"| **{v['id']}** {when(v['date'])} | [{v['title']}](versions/{v['id']}.md) | {v['note']} |\n"
    home += '\n## 指定するとき\n\n'
    home += '「**O16を元に、名前欄だけ直す**」「**V02-11の煙を使い、文字の余白だけ調整**」のように指定できます。複数の版を組み合わせたい場合も、名前・本文・操作のどの部分かを番号で分けられます。\n\n'
    home += '選ばれたIDの原画・表示版を固定して、指定部分だけ編集します。原案を選んだのに現行実装の似た枠へ置き換えたり、他路線まで再生成したりしません。追加版は新しいIDで残し、元画像を上書きしません。選定前のためゲームの採用状態は変えていません。\n\n'
    home += f"**配布済みPSDは[V12](versions/V12.md)です。** [PSD6種をダウンロード]({raw(DATA['psd'])})。それ以前の版を選んだ場合は、このPSDをその版と同一とは扱いません。\n\n"
    home += f"収録：**{len(ENTRIES)}件の固定画像リンク（同一画像の再掲を含む）／{len(DATA["versions"])}段階の保存版／初期15案／レトロ4案**。[画像と保存版の台帳](catalog.json)。画像の複製や再生成は行わず、既存のGitHub保存版を参照しています。\n"
    save('README.md', home)
    print(f'Built history: {len(ENTRIES)} records, {len(DATA["versions"])} stages, {len(DATA["families"])} route pages')


if __name__ == '__main__':
    run()
