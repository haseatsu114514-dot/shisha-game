#!/usr/bin/env python3
"""Local, credential-free quota guard for Codex and Claude Code (macOS).

No undocumented APIs or authentication scraping. Usage is supplied manually or
through a trusted JSON export explicitly configured by the user.
"""
import argparse
import datetime as dt
import json
import os
import pathlib
import sys

STATE = pathlib.Path.home() / ".config" / "shisha-agent-quota" / "usage.json"
PROVIDERS = ("codex", "claude")
def load():
    try:
        data = json.loads(STATE.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except (FileNotFoundError, ValueError, OSError):
        return {}

def snapshot(provider):
    path = os.getenv("SHISHA_" + provider.upper() + "_USAGE_JSON")
    if path:
        try:
            data = json.loads(pathlib.Path(path).expanduser().read_text(encoding="utf-8"))
            if isinstance(data, dict):
                return data
        except (ValueError, OSError):
            pass
    return load().get(provider, {})

def level(remaining):
    if remaining is None: return "unknown"
    if remaining <= 10: return "handoff"
    if remaining <= 20: return "wrap_up"
    return "normal"

def describe(provider):
    d = snapshot(provider)
    numbers = [d.get(k) for k in ("five_hour_remaining", "weekly_remaining")]
    valid = [v for v in numbers if type(v) in (int, float) and 0 <= v <= 100]
    remaining = min(valid) if valid else None
    status = level(remaining)
    print(f"{provider}: {status}; 5h={d.get('five_hour_remaining', '?')}%; weekly={d.get('weekly_remaining', '?')}%; reset={d.get('resets_at', '?')}")
    if status == "handoff":
        print("ACTION: Stop new work. Save/push safe work, test and merge only completed PRs; record unfinished tasks in GitHub Issues.")
    elif status == "wrap_up":
        print("ACTION: Avoid large new tasks. Prepare tests, commits, PRs and issue handoff.")
    elif status == "unknown":
        print("ACTION: Quota unknown; checkpoint after each task. Do not infer remaining quota.")
    return status

def main():
    p = argparse.ArgumentParser(description=__doc__)
    sub = p.add_subparsers(dest="cmd", required=True)
    check = sub.add_parser("check")
    check.add_argument("provider", choices=(*PROVIDERS, "all"), nargs="?", default="all")
    setp = sub.add_parser("set", help="Record percentages manually from official /status or /usage")
    setp.add_argument("provider", choices=PROVIDERS)
    setp.add_argument("--five-hour", type=float)
    setp.add_argument("--weekly", type=float)
    setp.add_argument("--resets-at", default="")
    args = p.parse_args()
    if args.cmd == "set":
        if args.five_hour is None and args.weekly is None:
            p.error("Supply --five-hour or --weekly")
        for v in (args.five_hour, args.weekly):
            if v is not None and not 0 <= v <= 100:
                p.error("Percentages must be between 0 and 100")
        data = load()
        entry = data.get(args.provider, {})
        if args.five_hour is not None: entry["five_hour_remaining"] = args.five_hour
        if args.weekly is not None: entry["weekly_remaining"] = args.weekly
        if args.resets_at: entry["resets_at"] = args.resets_at
        entry["updated_at"] = dt.datetime.now(dt.timezone.utc).isoformat()
        data[args.provider] = entry
        STATE.parent.mkdir(parents=True, exist_ok=True)
        STATE.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        os.chmod(STATE, 0o600)
        describe(args.provider)
    else:
        for provider in PROVIDERS if args.provider == "all" else (args.provider,):
            describe(provider)

if __name__ == "__main__":
    main()
