#!/usr/bin/env python3
"""Read-only checker ensuring only explicitly allowlisted string leaves changed between two JSON files."""

from __future__ import annotations

import argparse
from decimal import Decimal, DecimalException
import json
from pathlib import Path
import re
import sys
from typing import Any, NoReturn, Sequence

EXIT_PASS = 0
EXIT_UNAUTHORIZED_DIFF = 1
EXIT_INVALID_INPUT = 2

_CANONICAL_ARRAY_INDEX_RE = re.compile(r"^(?:0|[1-9][0-9]*)\Z")


class InputValidationError(Exception):
    """Raised when CLI arguments, JSON files, or allowlist entries are invalid."""


def _safe_quote(text: str) -> str:
    """Format a single-line quoted string without leaking raw control characters."""
    escaped = (
        text.replace("\\", "\\\\")
        .replace('"', '\\"')
        .replace("\n", "\\n")
        .replace("\r", "\\r")
        .replace("\t", "\\t")
    )
    out_chars: list[str] = []
    for ch in escaped:
        code = ord(ch)
        if code < 0x20 or code in (0x7F, 0x85, 0x2028, 0x2029) or 0xD800 <= code <= 0xDFFF:
            out_chars.append(f"\\u{code:04x}")
        else:
            out_chars.append(ch)
    return '"' + "".join(out_chars) + '"'


def encode_pointer(tokens: Sequence[str]) -> str:
    """Encode a sequence of reference tokens as a strict RFC 6901 JSON Pointer."""
    if not tokens:
        return ""
    escaped = [token.replace("~", "~0").replace("/", "~1") for token in tokens]
    return "/" + "/".join(escaped)


def format_pointer(pointer: str) -> str:
    """Return a safe single-line quoted representation of a JSON Pointer."""
    return _safe_quote(pointer)


def parse_pointer(pointer: str) -> list[str]:
    """Parse and validate a strict RFC 6901 JSON Pointer string into tokens.

    Rejects URI fragment forms ('#...'), non-slash-prefixed non-empty strings,
    and invalid tilde escapes (anything other than '~0' and '~1').
    Note: '%' is not percent-decoded, and '*' has no wildcard semantics;
    both are treated as literal characters in object keys.
    """
    if not isinstance(pointer, str):
        raise InputValidationError("allowlist pointer entry is not a string")
    if pointer == "":
        return []
    if pointer.startswith("#"):
        raise InputValidationError(
            f"URI fragment JSON Pointer is not supported: {format_pointer(pointer)}"
        )
    if not pointer.startswith("/"):
        raise InputValidationError(
            f"invalid JSON Pointer (must be empty or start with '/'): {format_pointer(pointer)}"
        )

    raw_tokens = pointer.split("/")[1:]
    tokens: list[str] = []
    for raw in raw_tokens:
        i = 0
        n = len(raw)
        decoded: list[str] = []
        while i < n:
            ch = raw[i]
            if ch == "~":
                if i + 1 >= n or raw[i + 1] not in ("0", "1"):
                    raise InputValidationError(
                        f"invalid escape in JSON Pointer: {format_pointer(pointer)}"
                    )
                decoded.append("~" if raw[i + 1] == "0" else "/")
                i += 2
            else:
                decoded.append(ch)
                i += 1
        tokens.append("".join(decoded))
    return tokens


def _reject_Duplicate_and_Parse_Object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    obj: dict[str, Any] = {}
    for key, val in pairs:
        if key in obj:
            raise InputValidationError(f"duplicate JSON object key {_safe_quote(key)}")
        obj[key] = val
    return obj


def _reject_non_finite_constant(constant: str) -> NoReturn:
    raise InputValidationError(f"non-finite JSON constant is not allowed: {_safe_quote(constant)}")


def _parse_finite_number(token: str) -> Decimal:
    # Decimal avoids both float rounding and Python's int string-digit limit.
    try:
        number = Decimal(token)
    except (DecimalException, ValueError, OverflowError):
        raise InputValidationError("JSON number exceeds the supported numeric range") from None
    if not number.is_finite():
        raise InputValidationError("non-finite JSON number is not allowed")
    return number


def load_strict_json(path: Path, label: str) -> Any:
    """Read and parse a UTF-8 JSON file strictly without leaking file contents."""
    try:
        if path.is_dir():
            raise InputValidationError(f"{label} path is a directory, not a file")
        raw_bytes = path.read_bytes()
    except InputValidationError:
        raise
    except OSError as exc:
        reason = exc.strerror or exc.__class__.__name__
        raise InputValidationError(f"cannot read {label} file: {reason}") from None

    try:
        text = raw_bytes.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise InputValidationError(
            f"{label} file is not valid UTF-8 (byte offset {exc.start})"
        ) from None

    # Reject UTF-8 BOM explicitly to keep strict JSON semantics predictable.
    if text.startswith("\ufeff"):
        raise InputValidationError(f"{label} file must not start with UTF-8 BOM")

    try:
        return json.loads(
            text,
            object_pairs_hook=_reject_Duplicate_and_Parse_Object,
            parse_float=_parse_finite_number,
            parse_int=_parse_finite_number,
            parse_constant=_reject_non_finite_constant,
        )
    except InputValidationError as exc:
        raise InputValidationError(f"{label}: {exc}") from None
    except json.JSONDecodeError as exc:
        raise InputValidationError(
            f"{label}: invalid JSON syntax at line {exc.lineno}, column {exc.colno}"
        ) from None
    except RecursionError:
        raise InputValidationError(f"{label}: JSON nesting depth exceeded limit") from None


def json_type_name(value: Any) -> str:
    """Return the canonical JSON type name, keeping boolean distinct from number."""
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "boolean"
    if isinstance(value, (int, Decimal)):
        return "number"
    if isinstance(value, str):
        return "string"
    if isinstance(value, list):
        return "array"
    if isinstance(value, dict):
        return "object"
    raise TypeError(f"unexpected parsed type: {type(value).__name__}")


def resolve_pointer(doc: Any, tokens: Sequence[str], pointer_str: str, doc_label: str) -> Any:
    """Resolve parsed RFC 6901 tokens against a JSON document strictly."""
    current = doc
    traversed: list[str] = []
    for token in tokens:
        if isinstance(current, dict):
            if token not in current:
                at_ptr = format_pointer(encode_pointer(traversed))
                raise InputValidationError(
                    f"allowlist pointer {format_pointer(pointer_str)} does not exist in {doc_label} "
                    f"(missing key {_safe_quote(token)} at {at_ptr})"
                )
            current = current[token]
            traversed.append(token)
        elif isinstance(current, list):
            if not _CANONICAL_ARRAY_INDEX_RE.match(token):
                at_ptr = format_pointer(encode_pointer(traversed))
                raise InputValidationError(
                    f"allowlist pointer {format_pointer(pointer_str)} has non-canonical array index "
                    f"{_safe_quote(token)} at {at_ptr} in {doc_label}"
                )
            # Bound the canonical digit string before int conversion, including
            # indices longer than Python's configured integer conversion limit.
            last_index = str(len(current) - 1)
            if (not current or len(token) > len(last_index) or
                    (len(token) == len(last_index) and token > last_index)):
                at_ptr = format_pointer(encode_pointer(traversed))
                raise InputValidationError(
                    f"allowlist pointer {format_pointer(pointer_str)} has out-of-bounds array index "
                    f"{_safe_quote(token)} (length {len(current)}) at {at_ptr} in {doc_label}"
                )
            idx = int(token)
            current = current[idx]
            traversed.append(token)
        else:
            at_ptr = format_pointer(encode_pointer(traversed))
            raise InputValidationError(
                f"allowlist pointer {format_pointer(pointer_str)} traverses through scalar "
                f"({json_type_name(current)}) at {at_ptr} in {doc_label}"
            )
    return current


def validate_allowlist(raw_allowlist: Any, before_doc: Any, after_doc: Any) -> set[str]:
    """Validate allowlist structure and ensure every entry resolves to a string leaf in both docs."""
    if not isinstance(raw_allowlist, list):
        raise InputValidationError(
            f"allowlist root must be a JSON array, got {json_type_name(raw_allowlist)}"
        )

    allowed_pointers: set[str] = set()
    for idx, entry in enumerate(raw_allowlist):
        if not isinstance(entry, str):
            raise InputValidationError(
                f"allowlist entry at index {idx} must be a string, got {json_type_name(entry)}"
            )
        tokens = parse_pointer(entry)
        if entry in allowed_pointers:
            raise InputValidationError(
                f"duplicate allowlist pointer at index {idx}: {format_pointer(entry)}"
            )
        allowed_pointers.add(entry)

        before_val = resolve_pointer(before_doc, tokens, entry, "before")
        after_val = resolve_pointer(after_doc, tokens, entry, "after")

        before_type = json_type_name(before_val)
        after_type = json_type_name(after_val)
        if before_type != "string" or after_type != "string":
            raise InputValidationError(
                f"allowlist pointer {format_pointer(entry)} must resolve to a string leaf in both "
                f"documents (got before={before_type}, after={after_type})"
            )

    return allowed_pointers


def _numbers_equal(left: int | Decimal, right: int | Decimal) -> bool:
    """Compare JSON numbers with exact precision without float rounding."""
    return Decimal(left) == Decimal(right)


def _scalars_equal(left: Any, right: Any, value_type: str) -> bool:
    if value_type == "number":
        return _numbers_equal(left, right)
    return left == right


def compare_documents(
    before_doc: Any,
    after_doc: Any,
    allowed_pointers: set[str],
) -> list[tuple[str, str, str]]:
    """Compare two JSON documents and return deterministic (pointer, category, detail) diagnostics."""
    diagnostics: list[tuple[str, str, str]] = []

    def _walk(before_val: Any, after_val: Any, tokens: list[str]) -> None:
        pointer = encode_pointer(tokens)
        before_type = json_type_name(before_val)
        after_type = json_type_name(after_val)

        if before_type != after_type:
            diagnostics.append(
                (pointer, "type_mismatch", f"before={before_type} after={after_type}")
            )
            return

        if before_type == "object":
            before_keys = set(before_val.keys())
            after_keys = set(after_val.keys())

            for removed_key in sorted(before_keys - after_keys):
                key_ptr = encode_pointer([*tokens, removed_key])
                diagnostics.append((key_ptr, "missing_key", "key removed in after"))

            for added_key in sorted(after_keys - before_keys):
                key_ptr = encode_pointer([*tokens, added_key])
                diagnostics.append((key_ptr, "extra_key", "key added in after"))

            for common_key in sorted(before_keys & after_keys):
                _walk(before_val[common_key], after_val[common_key], [*tokens, common_key])
            return

        if before_type == "array":
            before_len = len(before_val)
            after_len = len(after_val)
            if before_len != after_len:
                diagnostics.append(
                    (
                        pointer,
                        "array_length_mismatch",
                        f"before_len={before_len} after_len={after_len}",
                    )
                )
            common_len = min(before_len, after_len)
            for idx in range(common_len):
                _walk(before_val[idx], after_val[idx], [*tokens, str(idx)])
            return

        if before_type == "string":
            if before_val != after_val and pointer not in allowed_pointers:
                diagnostics.append(
                    (pointer, "unallowed_string_change", "string leaf modified outside allowlist")
                )
            return

        if not _scalars_equal(before_val, after_val, before_type):
            diagnostics.append(
                (pointer, "scalar_value_change", f"type={before_type} modified")
            )

    _walk(before_doc, after_doc, [])
    return diagnostics


class _ArgumentParser(argparse.ArgumentParser):
    def error(self, message: str) -> NoReturn:
        raise InputValidationError(f"invalid command-line arguments: {message}")


def build_parser() -> argparse.ArgumentParser:
    parser = _ArgumentParser(
        prog="check_dialogue_text_only.py",
        description=(
            "Verify that two JSON documents are identical except at explicitly "
            "allowlisted RFC 6901 string leaf pointers."
        ),
    )
    parser.add_argument("before_json", help="Path to the original (before) JSON file")
    parser.add_argument("after_json", help="Path to the updated (after) JSON file")
    parser.add_argument(
        "allowlist_json",
        help="Path to a JSON file containing an array of allowed RFC 6901 JSON Pointer strings",
    )
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    parser = build_parser()
    try:
        args = parser.parse_args(argv)
        before_doc = load_strict_json(Path(args.before_json), "before")
        after_doc = load_strict_json(Path(args.after_json), "after")
        allowlist_doc = load_strict_json(Path(args.allowlist_json), "allowlist")
        allowed_pointers = validate_allowlist(allowlist_doc, before_doc, after_doc)
        diagnostics = compare_documents(before_doc, after_doc, allowed_pointers)
    except InputValidationError as exc:
        sys.stderr.write(f"INVALID_INPUT: {exc}\n")
        return EXIT_INVALID_INPUT

    if diagnostics:
        for pointer, category, detail in diagnostics:
            sys.stderr.write(
                f"DIFF category={category} path={format_pointer(pointer)} detail={detail}\n"
            )
        return EXIT_UNAUTHORIZED_DIFF

    return EXIT_PASS


if __name__ == "__main__":
    sys.exit(main())
