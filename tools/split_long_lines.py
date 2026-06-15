#!/usr/bin/env python3
"""Split dialogue lines that exceed 48 full-width characters into multiple entries."""
import json, sys, os, unicodedata, glob

MAX_FULLWIDTH = 48  # 24 chars × 2 lines per page

def fw_len(s):
    """Match linter's fullwidth_len: ord>0xff=1, else=0.5."""
    return sum(0.5 if ord(c) <= 0xff else 1 for c in s)

def split_text(text, limit=MAX_FULLWIDTH):
    """Split text at natural breakpoints to fit within limit."""
    if fw_len(text) <= limit:
        return [text]

    # Priority split points (try in order)
    # 1. Sentence end: 。」 or 。） or just 。
    # 2. Closing bracket then space/next: 」 ）
    # 3. Clause boundary: 、 followed by enough text
    # 4. Space or punctuation

    parts = []
    remaining = text

    while fw_len(remaining) > limit:
        best_pos = -1
        # Search for split point within the limit
        # We want to find the last good split point before we exceed the limit

        accum = 0
        last_sentence_end = -1
        last_bracket_close = -1
        last_clause = -1
        last_space = -1

        for i, c in enumerate(remaining):
            w = unicodedata.east_asian_width(c)
            accum += 2 if w in ('F', 'W') else 1
            fw = (accum + 1) // 2

            if fw > limit:
                break

            # Track split candidates
            if c in '。！？' and i + 1 < len(remaining):
                next_c = remaining[i + 1] if i + 1 < len(remaining) else ''
                if next_c in '」）':
                    last_sentence_end = i + 2  # after the closing bracket
                else:
                    last_sentence_end = i + 1
            elif c in '」）' and i > 0 and remaining[i-1] in '。！？':
                pass  # already handled above
            elif c in '」）':
                last_bracket_close = i + 1
            elif c == '、':
                last_clause = i + 1
            elif c in '──…… ':
                last_space = i + 1

        # Pick best split point
        if last_sentence_end > 0:
            best_pos = last_sentence_end
        elif last_bracket_close > 0:
            best_pos = last_bracket_close
        elif last_clause > 0:
            best_pos = last_clause
        elif last_space > 0:
            best_pos = last_space
        else:
            # Force split at limit
            accum = 0
            for i, c in enumerate(remaining):
                w = unicodedata.east_asian_width(c)
                accum += 2 if w in ('F', 'W') else 1
                if (accum + 1) // 2 >= limit:
                    best_pos = i
                    break

        if best_pos <= 0:
            break

        parts.append(remaining[:best_pos])
        remaining = remaining[best_pos:]

    if remaining:
        parts.append(remaining)

    return parts

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)

    changed = False

    for dialogue in data.get('dialogues', []):
        # Process main lines
        new_lines = []
        for line in dialogue.get('lines', []):
            text = line.get('text', '')
            if not text or line.get('type') or fw_len(text) <= MAX_FULLWIDTH:
                new_lines.append(line)
                continue

            parts = split_text(text)
            if len(parts) == 1:
                new_lines.append(line)
                continue

            changed = True
            for part in parts:
                new_entry = dict(line)
                new_entry['text'] = part
                new_lines.append(new_entry)

        if new_lines != dialogue.get('lines', []):
            dialogue['lines'] = new_lines

        # Process branches
        for branch_name, branch_lines in dialogue.get('branches', {}).items():
            new_branch = []
            for line in branch_lines:
                text = line.get('text', '')
                if not text or line.get('type') or fw_len(text) <= MAX_FULLWIDTH:
                    new_branch.append(line)
                    continue

                parts = split_text(text)
                if len(parts) == 1:
                    new_branch.append(line)
                    continue

                changed = True
                for part in parts:
                    new_entry = dict(line)
                    new_entry['text'] = part
                    new_branch.append(new_entry)

            if new_branch != branch_lines:
                dialogue['branches'][branch_name] = new_branch

    if changed:
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write('\n')

    return changed

def main():
    dialogue_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', 'dialogue')
    files = sorted(glob.glob(os.path.join(dialogue_dir, '*.json')))

    modified = []
    for fp in files:
        if process_file(fp):
            modified.append(os.path.basename(fp))
            print(f"  split: {os.path.basename(fp)}")

    print(f"\n{len(modified)} files modified")

if __name__ == '__main__':
    main()
