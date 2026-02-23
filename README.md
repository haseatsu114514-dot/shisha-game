# shisha-game

## Dialogue editing without opening Godot

Use the local dialogue editor:

```bash
python3 tools/dialogue_editor.py
```

On macOS, you can also double-click:

```text
tools/edit_dialogue.command
```

What it does:

- Lists files in `data/dialogue/*.json`
- Lets you choose a `dialogue_id`
- Lets you edit every `text` field with multiline support
- Saves valid JSON and creates a timestamped backup on each save

Notes:

- Press `Ctrl+S` or `Cmd+S` to save
- Press `Ctrl+Enter` or `Cmd+Enter` to apply the current entry before save
