#!/usr/bin/env python3
"""Read-only, advisory comparison of an explicit plan against open GitHub PRs."""

import argparse
import datetime
import json
import re
import subprocess
import sys
from pathlib import Path, PurePosixPath


LIMITATIONS = [
    "Unpushed work and unrecorded plans are invisible; no reservation is granted.",
    "File overlap is a review candidate, not proof of a defect or merge conflict.",
    "GitHub responses are snapshots, not an atomic lock; recheck before editing/merging.",
    "An Issue closed as completed records resolution only, not verified implementation.",
    "This tool does not replace claim/status/transfer or bypass referencing-PR guards.",
]


class FetchError(Exception):
    """Remote information could not be retrieved completely."""


def decode_pages(raw):
    """gh --paginate emits consecutive JSON values, not necessarily one array."""
    decoder = json.JSONDecoder()
    pages = []
    remaining = raw.strip()
    while remaining:
        value, offset = decoder.raw_decode(remaining)
        pages.append(value)
        remaining = remaining[offset:].lstrip()
    if not pages:
        raise ValueError("empty API response")
    return pages


class GitHub:
    def __init__(self, repo):
        self.repo = repo

    def get(self, path, paginated=False):
        args = ["gh", "api", "--method", "GET", f"repos/{self.repo}/{path}"]
        if paginated:
            args.append("--paginate")
        try:
            result = subprocess.run(args, capture_output=True, text=True, timeout=90, shell=False)
            if result.returncode:
                # Do not echo subprocess diagnostics, which may contain proxy/credential details.
                raise FetchError(f"GET {path}: gh exit {result.returncode}; check access/auth locally")
            pages = decode_pages(result.stdout)
            if paginated:
                if any(not isinstance(page, list) for page in pages):
                    raise ValueError("expected array pages")
                return [item for page in pages for item in page]
            if len(pages) != 1 or not isinstance(pages[0], dict):
                raise ValueError("expected one object")
            return pages[0]
        except (OSError, subprocess.TimeoutExpired, ValueError) as exc:
            raise FetchError(f"GET {path}: {type(exc).__name__}; response unavailable/invalid") from exc

    def open_pulls(self):
        return self.get("pulls?state=open&per_page=100", paginated=True)

    def pull(self, number):
        return self.get(f"pulls/{number}")

    def files(self, number):
        return self.get(f"pulls/{number}/files?per_page=100", paginated=True)

    def issue(self, number):
        return self.get(f"issues/{number}")

    def comments(self, number):
        return self.get(f"issues/{number}/comments?per_page=100", paginated=True)


def positive_number(value):
    return type(value) is int and value > 0


def valid_path(value):
    return (isinstance(value, str) and bool(value) and "\\" not in value
            and not any(char in value for char in "*?[]")
            and not PurePosixPath(value).is_absolute()
            and ".." not in PurePosixPath(value).parts
            and str(PurePosixPath(value)) == value and value != ".")


def validate_plan(plan):
    errors = []
    if not isinstance(plan, dict):
        return ["plan must be an object"]
    if type(plan.get("version")) is not int or plan["version"] != 1:
        errors.append("version must be 1")
    if not positive_number(plan.get("issue")):
        errors.append("issue must be a positive number")
    if not isinstance(plan.get("worker"), str) or not plan["worker"].strip():
        errors.append("worker must be explicitly recorded")
    files = plan.get("files")
    if not isinstance(files, list):
        errors.append("files must be explicitly listed (empty [] is allowed)")
    elif any(not valid_path(path) for path in files):
        errors.append("files must contain canonical repository-relative exact paths, not globs")
    elif len(set(files)) != len(files):
        errors.append("files contains duplicate entries")
    deps = plan.get("dependencies")
    if not isinstance(deps, dict):
        errors.append("dependencies must explicitly contain issues and prs (use [] for none)")
    else:
        for kind in ("issues", "prs"):
            values = deps.get(kind)
            if not isinstance(values, list) or any(not positive_number(n) for n in values):
                errors.append(f"dependencies.{kind} must explicitly list positive numbers")
            elif len(set(values)) != len(values):
                errors.append(f"dependencies.{kind} contains duplicate entries")
        if isinstance(deps.get("issues"), list) and plan.get("issue") in deps["issues"]:
            errors.append("a plan cannot depend on its own Issue")
    return errors


def unique_keys(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("duplicate JSON key")
        result[key] = value
    return result


def plan_lines(body):
    """Only unquoted, unfenced, column-zero declaration lines are operative."""
    fields = {}
    fence = None
    for line in body.splitlines():
        marker = re.match(r"^ {0,3}(`{3,}|~{3,})", line)
        if fence:
            if re.fullmatch(r" {0,3}" + re.escape(fence[0]) + "{" + str(len(fence)) + r",}\s*", line):
                fence = None
            continue
        if marker:
            fence = marker[1]
            continue
        match = re.match(r"^(WORKER|PLANNED_FILES|DEPENDS)\s*:(.*)$", line)
        if match:
            fields.setdefault(match[1], []).append(match[2].strip())
    return fields


def check_issue(number, client):
    """Read the newest human declaration, never fall back from an invalid plan."""
    try:
        issue = client.issue(number)
        if (not isinstance(issue, dict) or issue.get("number") != number
                or "pull_request" in issue or type(issue.get("comments")) is not int
                or issue["comments"] < 0):
            raise FetchError(f"Issue #{number}: incomplete/malformed metadata")
        comments = client.comments(number)
        if (not isinstance(comments, list) or len(comments) != issue["comments"]
                or any(not isinstance(c, dict) or not positive_number(c.get("id"))
                       or not isinstance(c.get("body"), str)
                       or not isinstance(c.get("user"), dict)
                       or c["user"].get("type") not in ("User", "Bot")
                       or not isinstance(c["user"].get("login"), str)
                       or not c["user"]["login"] for c in comments)
                or len({c["id"] for c in comments}) != len(comments)):
            raise FetchError(f"Issue #{number}: comment list incomplete/malformed or changed; rerun")
    except FetchError as exc:
        report = check(None, None)
        report["missing_information"] = []
        report["fetch_failures"] = [str(exc)]
        return report
    candidates = [(c, plan_lines(c["body"])) for c in comments if c["user"]["type"] == "User"]
    candidates = [(c, fields) for c, fields in candidates
                  if "PLANNED_FILES" in fields or "DEPENDS" in fields]
    if not candidates:
        report = check(None, None)
        report["missing_information"] = [f"Issue #{number}: no explicit human comment plan"]
        return report
    comment, fields = max(candidates, key=lambda item: item[0]["id"])
    source = {"issue": number, "comment_id": comment["id"], "author": comment["user"]["login"]}
    errors = [f"{key} must appear exactly once in the latest plan comment"
              for key in ("WORKER", "PLANNED_FILES", "DEPENDS") if len(fields.get(key, [])) != 1]
    plan = {"version": 1, "issue": number}
    if not errors:
        plan["worker"] = fields["WORKER"][0]
        try:
            plan["files"] = json.loads(fields["PLANNED_FILES"][0], object_pairs_hook=unique_keys)
            plan["dependencies"] = json.loads(fields["DEPENDS"][0], object_pairs_hook=unique_keys)
        except ValueError:
            errors.append("PLANNED_FILES / DEPENDS must be single-line JSON without duplicate keys")
    if errors:
        report = check(None, None)
        report["missing_information"] = errors
    else:
        report = check(plan, client)
    report["plan_source"] = source
    return report


def pull_identity(pull, number):
    if (not isinstance(pull, dict) or pull.get("number") != number
            or pull.get("state") not in ("open", "closed")
            or type(pull.get("draft")) is not bool
            or type(pull.get("merged")) is not bool
            or type(pull.get("changed_files")) is not int or pull["changed_files"] < 0
            or not isinstance(pull.get("head"), dict)
            or not isinstance(pull["head"].get("sha"), str) or not pull["head"]["sha"]):
        raise FetchError(f"PR #{number}: incomplete/malformed metadata")
    return pull["head"]["sha"], pull["state"], pull["changed_files"]


def check(plan, client):
    report = {"status": "incomplete", "file_overlaps": [], "unmerged_dependencies": [],
              "missing_information": validate_plan(plan), "fetch_failures": [],
              "checked_prs": [], "dependency_states": [], "limitations": LIMITATIONS,
              "observed_at": datetime.datetime.now(datetime.timezone.utc).isoformat()}
    if report["missing_information"]:
        return report
    report["plan"] = plan
    try:
        pulls = client.open_pulls()
        if (not isinstance(pulls, list)
                or any(not isinstance(p, dict) or not positive_number(p.get("number")) for p in pulls)
                or len({p["number"] for p in pulls}) != len(pulls)):
            raise FetchError("Open PR list: malformed or duplicate entries")
    except FetchError as exc:
        report["fetch_failures"].append(str(exc))
        pulls = []
    planned = set(plan["files"])
    for listed in pulls:
        number = listed["number"]
        try:
            before = client.pull(number)
            identity = pull_identity(before, number)
            if before["state"] != "open":
                raise FetchError(f"PR #{number}: closed during listing; rerun")
            if before["changed_files"] > 3000:
                raise FetchError(f"PR #{number}: exceeds GitHub 3000-file API limit")
            files = client.files(number)
            if (not isinstance(files, list) or len(files) != before["changed_files"]
                    or any(not isinstance(f, dict) or not valid_path(f.get("filename")) for f in files)
                    or len({f["filename"] for f in files}) != len(files)):
                raise FetchError(f"PR #{number}: file list incomplete/malformed (expected {before['changed_files']})")
            touched = {f["filename"] for f in files}
            for file in files:
                if "previous_filename" in file:
                    if not valid_path(file["previous_filename"]):
                        raise FetchError(f"PR #{number}: malformed rename source")
                    touched.add(file["previous_filename"])
            after = client.pull(number)
            if identity != pull_identity(after, number):
                raise FetchError(f"PR #{number}: head/state/file count changed while reading; rerun")
            report["checked_prs"].append({"number": number, "draft": before["draft"],
                                          "head": identity[0], "changed_files": identity[2]})
            overlap = sorted(planned & touched)
            if overlap:
                report["file_overlaps"].append({"pr": number, "draft": before["draft"],
                                                  "head": identity[0], "files": overlap})
        except FetchError as exc:
            report["fetch_failures"].append(str(exc))
    for kind in ("issues", "prs"):
        for number in plan["dependencies"][kind]:
            try:
                data = client.issue(number) if kind == "issues" else client.pull(number)
                if kind == "issues":
                    if (not isinstance(data, dict) or data.get("number") != number
                            or data.get("state") not in ("open", "closed") or "pull_request" in data):
                        raise FetchError(f"Issue #{number}: invalid Issue metadata (PRs belong in prs)")
                    # Closed-as-not-planned (or unknown reason) cannot fulfill a dependency.
                    complete = data["state"] == "closed" and data.get("state_reason") == "completed"
                else:
                    pull_identity(data, number)
                    complete = data["merged"] is True and data["state"] == "closed"
                entry = {"kind": kind, "number": number, "state": data["state"]}
                if kind == "prs":
                    entry["merged"] = data["merged"]
                else:
                    entry["state_reason"] = data.get("state_reason")
                report["dependency_states"].append(entry)
                if not complete:
                    report["unmerged_dependencies"].append(entry)
            except FetchError as exc:
                report["fetch_failures"].append(str(exc))
    if report["fetch_failures"]:
        report["status"] = "incomplete"
    elif report["file_overlaps"] or report["unmerged_dependencies"]:
        report["status"] = "requires_review"
    else:
        report["status"] = "no_detected_overlap"
    return report


def render_text(report):
    lines = [f"STATUS: {report['status']}", f"OBSERVED: {report['observed_at']}"]
    if "plan_source" in report:
        source = report["plan_source"]
        lines.append(f"PLAN_SOURCE: Issue #{source['issue']} comment={source['comment_id']} author={source['author']}")
    for item in report["file_overlaps"]:
        lines.append(f"FILE_OVERLAP: PR #{item['pr']} draft={item['draft']}: {', '.join(item['files'])}")
    for item in report["unmerged_dependencies"]:
        lines.append(f"DEPENDENCY_PENDING: {item['kind']} #{item['number']} state={item['state']}"
                     + (f" merged={item['merged']}" if "merged" in item else ""))
    for field, label in (("missing_information", "PLAN_MISSING_OR_INVALID"), ("fetch_failures", "FETCH_FAILED")):
        lines.extend(f"{label}: {message}" for message in report[field])
    lines.append(f"CHECKED_OPEN_PRS: {len(report['checked_prs'])}")
    lines.extend(f"LIMIT: {message}" for message in report["limitations"])
    return "\n".join(lines)


def main(argv=None, client=None):
    parser = argparse.ArgumentParser(description=__doc__)
    inputs = parser.add_mutually_exclusive_group(required=True)
    inputs.add_argument("--plan", type=Path)
    inputs.add_argument("--issue", type=int)
    parser.add_argument("--repo", default="haseatsu114514-dot/shisha-game")
    parser.add_argument("--format", choices=("text", "json"), default="text")
    args = parser.parse_args(argv)
    if not re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", args.repo):
        parser.error("--repo must be owner/name")
    if args.issue is not None:
        if not positive_number(args.issue):
            parser.error("--issue must be a positive number")
        report = check_issue(args.issue, client or GitHub(args.repo))
    else:
        try:
            plan = json.loads(args.plan.read_text(encoding="utf-8"), object_pairs_hook=unique_keys)
        except (OSError, ValueError) as exc:
            report = check(None, client)
            report["missing_information"] = [f"plan file unavailable/invalid: {type(exc).__name__}"]
        else:
            report = check(plan, client or GitHub(args.repo))
    print(json.dumps(report, ensure_ascii=False, indent=2) if args.format == "json" else render_text(report))
    return {"no_detected_overlap": 0, "requires_review": 1, "incomplete": 2}[report["status"]]


if __name__ == "__main__":
    sys.exit(main())
