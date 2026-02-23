#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import shutil
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

import tkinter as tk
from tkinter import messagebox, ttk
from tkinter.scrolledtext import ScrolledText

PathToken = Union[str, int]


@dataclass
class TextEntry:
    path: List[PathToken]
    speaker: str


def format_path(path_tokens: List[PathToken]) -> str:
    chunks: List[str] = []
    for token in path_tokens:
        if isinstance(token, int):
            chunks.append(f"[{token}]")
        else:
            if chunks:
                chunks.append(".")
            chunks.append(token)
    return "".join(chunks)


def preview_text(text: str, limit: int = 56) -> str:
    compact = text.replace("\n", "\\n")
    if len(compact) <= limit:
        return compact
    return compact[: limit - 3] + "..."


def get_value_at_path(root: Any, path_tokens: List[PathToken]) -> Any:
    node = root
    for token in path_tokens:
        node = node[token]  # type: ignore[index]
    return node


def set_value_at_path(root: Any, path_tokens: List[PathToken], value: Any) -> None:
    if not path_tokens:
        return
    parent = get_value_at_path(root, path_tokens[:-1]) if len(path_tokens) > 1 else root
    last = path_tokens[-1]
    parent[last] = value  # type: ignore[index]


def collect_text_entries(node: Any, base_path: Optional[List[PathToken]] = None) -> List[TextEntry]:
    entries: List[TextEntry] = []
    path = [] if base_path is None else list(base_path)

    if isinstance(node, dict):
        text_value = node.get("text")
        if isinstance(text_value, str):
            speaker = str(node.get("speaker", "")).strip()
            entries.append(TextEntry(path=path + ["text"], speaker=speaker))
        for key, value in node.items():
            if key == "text":
                continue
            entries.extend(collect_text_entries(value, path + [key]))
    elif isinstance(node, list):
        for idx, value in enumerate(node):
            entries.extend(collect_text_entries(value, path + [idx]))

    return entries


class DialogueEditorApp:
    def __init__(self, root: tk.Tk, project_root: Path) -> None:
        self.root = root
        self.project_root = project_root
        self.dialogue_dir = self.project_root / "data" / "dialogue"

        self.current_file_path: Optional[Path] = None
        self.current_file_data: Any = None
        self.current_dialogues: List[Dict[str, Any]] = []
        self.current_dialogue: Optional[Dict[str, Any]] = None
        self.current_entries: List[TextEntry] = []
        self.current_entry_index: Optional[int] = None

        self.dialogue_label_to_index: Dict[str, int] = {}
        self.file_label_to_path: Dict[str, Path] = {}

        self.file_dirty = False
        self.entry_text_dirty = False
        self._suppress_text_events = False

        self.file_var = tk.StringVar()
        self.dialogue_var = tk.StringVar()
        self.path_var = tk.StringVar(value="-")
        self.speaker_var = tk.StringVar(value="-")
        self.status_var = tk.StringVar(value="Choose a dialogue file.")

        self.root.title("Dialogue Editor")
        self.root.geometry("1240x760")
        self.root.minsize(980, 620)

        self._build_ui()
        self._bind_shortcuts()
        self.refresh_file_list()
        self.root.protocol("WM_DELETE_WINDOW", self._on_close)

    def _build_ui(self) -> None:
        container = ttk.Frame(self.root, padding=10)
        container.pack(fill=tk.BOTH, expand=True)

        top = ttk.Frame(container)
        top.pack(fill=tk.X)

        ttk.Label(top, text="File").grid(row=0, column=0, sticky=tk.W, padx=(0, 6))
        self.file_combo = ttk.Combobox(top, textvariable=self.file_var, state="readonly", width=80)
        self.file_combo.grid(row=0, column=1, sticky=tk.EW)
        self.file_combo.bind("<<ComboboxSelected>>", self._on_file_changed)

        reload_files_button = ttk.Button(top, text="Reload file list", command=self.refresh_file_list)
        reload_files_button.grid(row=0, column=2, sticky=tk.E, padx=(8, 0))

        ttk.Label(top, text="Dialogue").grid(row=1, column=0, sticky=tk.W, padx=(0, 6), pady=(8, 0))
        self.dialogue_combo = ttk.Combobox(top, textvariable=self.dialogue_var, state="readonly", width=80)
        self.dialogue_combo.grid(row=1, column=1, sticky=tk.EW, pady=(8, 0))
        self.dialogue_combo.bind("<<ComboboxSelected>>", self._on_dialogue_changed)

        top.columnconfigure(1, weight=1)

        paned = ttk.Panedwindow(container, orient=tk.HORIZONTAL)
        paned.pack(fill=tk.BOTH, expand=True, pady=(10, 10))

        left = ttk.Frame(paned)
        right = ttk.Frame(paned, padding=(10, 0, 0, 0))
        paned.add(left, weight=1)
        paned.add(right, weight=2)

        ttk.Label(left, text="Editable text entries").pack(anchor=tk.W)
        left_list_frame = ttk.Frame(left)
        left_list_frame.pack(fill=tk.BOTH, expand=True, pady=(6, 0))

        self.entry_list = tk.Listbox(left_list_frame, exportselection=False, font=("Menlo", 11))
        self.entry_list.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        self.entry_list.bind("<<ListboxSelect>>", self._on_entry_selected)

        list_scroll = ttk.Scrollbar(left_list_frame, orient=tk.VERTICAL, command=self.entry_list.yview)
        list_scroll.pack(side=tk.RIGHT, fill=tk.Y)
        self.entry_list.configure(yscrollcommand=list_scroll.set)

        meta = ttk.Frame(right)
        meta.pack(fill=tk.X)

        ttk.Label(meta, text="Path").grid(row=0, column=0, sticky=tk.NW, padx=(0, 6))
        ttk.Label(meta, textvariable=self.path_var, wraplength=650).grid(row=0, column=1, sticky=tk.W)

        ttk.Label(meta, text="Speaker").grid(row=1, column=0, sticky=tk.W, padx=(0, 6), pady=(4, 0))
        ttk.Label(meta, textvariable=self.speaker_var).grid(row=1, column=1, sticky=tk.W, pady=(4, 0))

        meta.columnconfigure(1, weight=1)

        ttk.Label(right, text="Text (Enter inserts a newline)").pack(anchor=tk.W, pady=(10, 4))
        self.text_editor = ScrolledText(right, wrap=tk.WORD, undo=True, font=("Menlo", 12))
        self.text_editor.pack(fill=tk.BOTH, expand=True)
        self.text_editor.bind("<<Modified>>", self._on_text_modified)

        buttons = ttk.Frame(right)
        buttons.pack(fill=tk.X, pady=(8, 0))

        apply_button = ttk.Button(buttons, text="Apply entry", command=self.apply_entry_changes)
        apply_button.pack(side=tk.LEFT)

        save_button = ttk.Button(buttons, text="Save file (Ctrl/Cmd+S)", command=self.save_file)
        save_button.pack(side=tk.LEFT, padx=(8, 0))

        reload_button = ttk.Button(buttons, text="Reload file", command=self.reload_current_file)
        reload_button.pack(side=tk.LEFT, padx=(8, 0))

        status = ttk.Label(container, textvariable=self.status_var, anchor=tk.W)
        status.pack(fill=tk.X)

    def _bind_shortcuts(self) -> None:
        self.root.bind("<Control-s>", self._on_shortcut_save)
        self.root.bind("<Command-s>", self._on_shortcut_save)
        self.root.bind("<Control-Return>", self._on_shortcut_apply)
        self.root.bind("<Command-Return>", self._on_shortcut_apply)

    def _on_shortcut_save(self, _event: tk.Event) -> str:
        self.save_file()
        return "break"

    def _on_shortcut_apply(self, _event: tk.Event) -> str:
        self.apply_entry_changes()
        return "break"

    def refresh_file_list(self) -> None:
        json_files = sorted(self.dialogue_dir.glob("*.json"))
        labels = [str(path.relative_to(self.project_root)) for path in json_files]
        self.file_label_to_path = {label: path for label, path in zip(labels, json_files)}
        self.file_combo["values"] = labels

        if not labels:
            self.file_var.set("")
            self.status_var.set(f"No JSON files found in {self.dialogue_dir}")
            self._clear_editor()
            return

        if self.current_file_path is not None:
            current_label = str(self.current_file_path.relative_to(self.project_root))
            if current_label in labels:
                self.file_var.set(current_label)
                return

        self.file_var.set(labels[0])
        self._load_file(self.file_label_to_path[labels[0]])

    def _on_file_changed(self, _event: tk.Event) -> None:
        selected_label = self.file_var.get().strip()
        if not selected_label:
            return
        selected_path = self.file_label_to_path.get(selected_label)
        if selected_path is None:
            return
        if self.current_file_path == selected_path:
            return
        if not self._prompt_unsaved_changes():
            if self.current_file_path is not None:
                self.file_var.set(str(self.current_file_path.relative_to(self.project_root)))
            return
        self._load_file(selected_path)

    def _load_file(self, file_path: Path) -> None:
        try:
            text = file_path.read_text(encoding="utf-8")
            parsed = json.loads(text)
        except Exception as exc:  # noqa: BLE001
            messagebox.showerror("Open failed", f"Could not read JSON:\n{file_path}\n\n{exc}")
            return

        dialogues = self._extract_dialogues(parsed)
        if not dialogues:
            messagebox.showerror(
                "Invalid format",
                "Expected either a root object with `dialogues`, or a single `dialogue_id` object.",
            )
            return

        self.current_file_path = file_path
        self.current_file_data = parsed
        self.current_dialogues = dialogues
        self.file_dirty = False
        self.entry_text_dirty = False

        self._populate_dialogues()
        self.status_var.set(f"Loaded {file_path.name}")

    def _extract_dialogues(self, root: Any) -> List[Dict[str, Any]]:
        if isinstance(root, dict):
            if isinstance(root.get("dialogues"), list):
                return [item for item in root["dialogues"] if isinstance(item, dict)]
            if "dialogue_id" in root:
                return [root]
        return []

    def _populate_dialogues(self) -> None:
        labels: List[str] = []
        self.dialogue_label_to_index = {}
        seen: Dict[str, int] = {}

        for idx, dialogue in enumerate(self.current_dialogues):
            base = str(dialogue.get("dialogue_id", f"dialogue_{idx + 1}")).strip()
            if base == "":
                base = f"dialogue_{idx + 1}"
            seen[base] = seen.get(base, 0) + 1
            label = base if seen[base] == 1 else f"{base} ({seen[base]})"
            labels.append(label)
            self.dialogue_label_to_index[label] = idx

        self.dialogue_combo["values"] = labels

        if not labels:
            self.dialogue_var.set("")
            self._clear_editor()
            return

        self.dialogue_var.set(labels[0])
        self._load_dialogue_by_label(labels[0])

    def _on_dialogue_changed(self, _event: tk.Event) -> None:
        label = self.dialogue_var.get().strip()
        if not label:
            return
        self._load_dialogue_by_label(label)

    def _load_dialogue_by_label(self, label: str) -> None:
        idx = self.dialogue_label_to_index.get(label)
        if idx is None:
            return

        self._apply_entry_if_dirty()
        self.current_dialogue = self.current_dialogues[idx]
        self.current_entries = collect_text_entries(self.current_dialogue)
        self.current_entry_index = None
        self.entry_text_dirty = False

        self._populate_entry_list()
        self.status_var.set(f"Dialogue loaded: {label} ({len(self.current_entries)} editable text fields)")

    def _populate_entry_list(self) -> None:
        self.entry_list.delete(0, tk.END)

        if self.current_dialogue is None or not self.current_entries:
            self._clear_editor()
            return

        for idx, entry in enumerate(self.current_entries):
            self.entry_list.insert(tk.END, self._entry_label(idx))

        self.entry_list.selection_set(0)
        self._switch_to_entry(0)

    def _entry_label(self, idx: int) -> str:
        entry = self.current_entries[idx]
        speaker = entry.speaker if entry.speaker else "-"
        value = str(get_value_at_path(self.current_dialogue, entry.path)) if self.current_dialogue is not None else ""
        return f"{idx + 1:03d} [{speaker}] {format_path(entry.path)} :: {preview_text(value)}"

    def _on_entry_selected(self, _event: tk.Event) -> None:
        selected = self.entry_list.curselection()
        if not selected:
            return
        self._switch_to_entry(int(selected[0]))

    def _switch_to_entry(self, entry_index: int) -> None:
        if self.current_dialogue is None:
            return
        if self.current_entry_index == entry_index:
            return

        self._apply_entry_if_dirty()
        self.current_entry_index = entry_index
        entry = self.current_entries[entry_index]

        value = str(get_value_at_path(self.current_dialogue, entry.path))
        self.path_var.set(format_path(entry.path))
        self.speaker_var.set(entry.speaker if entry.speaker else "-")

        self._suppress_text_events = True
        self.text_editor.delete("1.0", tk.END)
        self.text_editor.insert("1.0", value)
        self.text_editor.edit_modified(False)
        self._suppress_text_events = False
        self.entry_text_dirty = False

    def _on_text_modified(self, _event: tk.Event) -> None:
        if self._suppress_text_events:
            self.text_editor.edit_modified(False)
            return
        if self.current_entry_index is None:
            self.text_editor.edit_modified(False)
            return
        if self.text_editor.edit_modified():
            self.entry_text_dirty = True
            self.status_var.set("Entry changed. Apply entry, then save file.")
        self.text_editor.edit_modified(False)

    def apply_entry_changes(self) -> None:
        if self.current_entry_index is None:
            return
        changed = self._apply_entry_if_dirty(force=True)
        if changed:
            self.status_var.set("Entry updated in memory. Use Save file to write JSON.")
        else:
            self.status_var.set("No entry changes to apply.")

    def _apply_entry_if_dirty(self, force: bool = False) -> bool:
        if self.current_dialogue is None or self.current_entry_index is None:
            return False
        if not self.entry_text_dirty and not force:
            return False

        entry = self.current_entries[self.current_entry_index]
        new_value = self.text_editor.get("1.0", "end-1c")
        old_value = str(get_value_at_path(self.current_dialogue, entry.path))
        changed = new_value != old_value

        if changed:
            set_value_at_path(self.current_dialogue, entry.path, new_value)
            self.file_dirty = True
            self.entry_list.delete(self.current_entry_index)
            self.entry_list.insert(self.current_entry_index, self._entry_label(self.current_entry_index))
            self.entry_list.selection_clear(0, tk.END)
            self.entry_list.selection_set(self.current_entry_index)
            self.entry_list.activate(self.current_entry_index)

        self.entry_text_dirty = False
        return changed

    def save_file(self) -> bool:
        if self.current_file_path is None or self.current_file_data is None:
            return False

        self._apply_entry_if_dirty()

        if not self.file_dirty:
            self.status_var.set("No file changes to save.")
            return True

        backup = self._create_backup_path(self.current_file_path)
        try:
            shutil.copy2(self.current_file_path, backup)
            formatted = json.dumps(self.current_file_data, ensure_ascii=False, indent=2)
            self.current_file_path.write_text(formatted + "\n", encoding="utf-8")
        except Exception as exc:  # noqa: BLE001
            messagebox.showerror("Save failed", f"Could not write file:\n{self.current_file_path}\n\n{exc}")
            return False

        self.file_dirty = False
        self.status_var.set(
            f"Saved {self.current_file_path.name} (backup: {backup.name})"
        )
        return True

    def reload_current_file(self) -> None:
        if self.current_file_path is None:
            return
        if not self._prompt_unsaved_changes():
            return
        self._load_file(self.current_file_path)

    def _prompt_unsaved_changes(self) -> bool:
        if not self.file_dirty and not self.entry_text_dirty:
            return True

        choice = messagebox.askyesnocancel(
            "Unsaved changes",
            "Save current changes before continuing?",
            default=messagebox.YES,
        )
        if choice is None:
            return False
        if choice:
            return self.save_file()
        return True

    def _clear_editor(self) -> None:
        self.current_dialogue = None
        self.current_entries = []
        self.current_entry_index = None
        self.entry_text_dirty = False
        self.path_var.set("-")
        self.speaker_var.set("-")
        self.entry_list.delete(0, tk.END)
        self._suppress_text_events = True
        self.text_editor.delete("1.0", tk.END)
        self.text_editor.edit_modified(False)
        self._suppress_text_events = False

    def _create_backup_path(self, source: Path) -> Path:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        return source.with_name(f"{source.name}.{timestamp}.bak")

    def _on_close(self) -> None:
        if not self._prompt_unsaved_changes():
            return
        self.root.destroy()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Edit dialogue JSON text fields without opening Godot.")
    parser.add_argument(
        "--project",
        type=Path,
        default=Path(__file__).resolve().parents[1],
        help="Path to project root (must contain data/dialogue).",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    project_root = args.project.expanduser().resolve()
    dialogue_dir = project_root / "data" / "dialogue"

    if not dialogue_dir.exists():
        print(f"error: dialogue directory not found: {dialogue_dir}")
        return 1

    app_root = tk.Tk()
    DialogueEditorApp(app_root, project_root)
    app_root.mainloop()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
