#!/usr/bin/env python3
"""Offline data consistency check. PASS never authorizes any operation."""
import datetime as dt
import hashlib
import json
from pathlib import Path
import re
import sys

SCHEMA = Path(__file__).with_name('job_checkpoint_schema.json')
MAX_AGE = 300


class Invalid(ValueError):
    """Only static public error codes may leave the validator."""


def require(ok, code):
    if not ok:
        raise Invalid(code)


def shape(value, schema, root=None):
    """Deliberately small evaluator for the checked-in schema's keyword subset."""
    root = schema if root is None else root
    if '$ref' in schema:
        shape(value, root['$defs'][schema['$ref'].split('/')[-1]], root)
        return
    if 'anyOf' in schema:
        for choice in schema['anyOf']:
            try:
                shape(value, choice, root)
                return
            except Invalid:
                pass
        raise Invalid('shape')
    if 'enum' in schema:
        require(any(type(value) is type(v) and value == v for v in schema['enum']), 'enum')
    kind = schema.get('type')
    types = {'object': dict, 'array': list, 'string': str, 'integer': int,
             'boolean': bool, 'null': type(None)}
    if kind:
        require(type(value) is types[kind], 'type')
    if kind == 'object':
        require(set(value) == set(schema['required']), 'fields')
        for key, child in schema['properties'].items():
            shape(value[key], child, root)
    elif kind == 'array':
        require(len(value) <= schema['maxItems'], 'length')
        require(len({json.dumps(v, sort_keys=True) for v in value}) == len(value), 'duplicate')
        for child in value:
            shape(child, schema['items'], root)
    elif kind == 'string':
        require(re.fullmatch(schema['pattern'], value) is not None, 'format')
    elif kind == 'integer':
        require(value >= schema['minimum'], 'range')


def fingerprint(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':'),
                                     ensure_ascii=True).encode()).hexdigest()


def timestamp(value):
    try:
        return dt.datetime.strptime(value, '%Y-%m-%dT%H:%M:%SZ').replace(tzinfo=dt.timezone.utc)
    except (ValueError, TypeError):
        raise Invalid('timestamp') from None


def fresh(value, now):
    require(0 <= (now - timestamp(value)).total_seconds() <= MAX_AGE, 'stale')


def checkpoint_rules(c):
    require(c['job'] == 'job-' + str(c['issue']), 'job_binding')
    require(c['binding']['attempt'] != c['job'], 'attempt_binding')
    require(timestamp(c['created_at']) <= timestamp(c['updated_at']), 'time_order')
    scope, done, remaining = (set(c[k]) for k in ('scope', 'done', 'remaining'))
    require(bool(scope) and not done & remaining and done | remaining == scope, 'scope')
    holds = c['holds']
    require(len({h['id'] for h in holds}) == len(holds), 'hold_duplicate')
    if holds:
        require(c['state'] in ('held', 'cancelled'), 'hold_state')
    if any(h['kind'] == 'cancel' for h in holds):
        require(c['state'] == 'cancelled', 'cancel_state')
    if c['state'] in ('held', 'cancelled'):
        require(bool(holds), 'hold_missing')
    if c['state'] == 'complete':
        require(not remaining, 'incomplete')
    a = c['artifact']
    require(a['clean'] and a['save'] not in ('unknown', 'unpushed'), 'preservation')
    require(len({p['number'] for p in a['prs']}) == len(a['prs']), 'pr_duplicate')
    if a['route'] == 'no_artifact':
        require(a['save'] == 'never_started_verified' and a['branch'] is None
                and a['head'] is None and not a['prs'] and not done and not c['tests'], 'no_artifact')
    else:
        require(a['save'] == 'saved' and a['head'] is not None and a['branch'] is not None, 'saved')
        require(a['branch'].split('/')[1] == str(c['issue']), 'branch_binding')
        require(bool(a['prs']) == (a['route'] == 'open_pr'), 'route')
        require(bool(c['tests']), 'tests_missing')
        for test in c['tests']:
            require(test['sha'] == a['head'], 'tested_sha')
    require((c['revision'] == 1) == (c['predecessor'] is None), 'predecessor')


def evidence(proof, kind, snap, now):
    require(proof is not None and proof['verified'] and proof['independent']
            and proof['kind'] == kind and proof['snapshot'] == snap, 'evidence')
    fresh(proof['observed_at'], now)


def validate(data, now):
    shape(data, json.loads(SCHEMA.read_text(encoding='utf-8')))
    require(now.tzinfo is not None, 'clock')
    c, p, ob = data['checkpoint'], data['previous'], data['observation']
    checkpoint_rules(c)
    fresh(c['updated_at'], now)
    fresh(ob['observed_at'], now)
    require(timestamp(c['updated_at']) <= timestamp(ob['observed_at']), 'observation_order')
    require(ob['proposal'] == (fingerprint(data['proposal']) if data['proposal'] is not None else None),
            'proposal_snapshot')
    snap = fingerprint(c)
    require(ob['checkpoint'] == snap, 'snapshot')
    require(ob['previous'] == c['predecessor'], 'revision')
    if p is None:
        require(c['revision'] == 1, 'history_missing')
    else:
        checkpoint_rules(p)
        require(fingerprint(p) == c['predecessor'], 'predecessor')
        require(c['revision'] == p['revision'] + 1, 'revision')
        require(c['issue'] == p['issue'] and c['job'] == p['job']
                and c['binding'] == p['binding'], 'ownership')
        require(c['created_at'] == p['created_at'] and c['scope'] == p['scope']
                and timestamp(c['updated_at']) >= timestamp(p['updated_at']), 'history')
        require(all(h in c['holds'] for h in p['holds']), 'hold_dropped')
        allowed = {'ready': {'ready','active','held','cancelled'},
                   'active': {'active','paused','held','cancelled','complete'},
                   'paused': {'paused','active','held','cancelled'},
                   'held': {'held','cancelled'}, 'cancelled': {'cancelled'},
                   'complete': {'complete'}}
        require(c['state'] in allowed[p['state']], 'transition')
        require(set(p['done']) <= set(c['done']), 'done_dropped')
    kind = 'never_started' if c['artifact']['route'] == 'no_artifact' else 'saved_clean_pushed'
    evidence(ob['preservation'], kind, snap, now)
    require(timestamp(c['updated_at']) <= timestamp(ob['preservation']['observed_at'])
            <= timestamp(ob['observed_at']), 'proof_order')
    if c['boundary'] == 'after_push':
        require(c['artifact']['save'] == 'saved', 'push_boundary')
    if c['boundary'] == 'before_pause':
        require(c['state'] in ('paused', 'held', 'cancelled'), 'pause_state')
    if c['state'] == 'active' and (p is None or p['state'] in ('ready', 'paused')):
        require(c['boundary'] == 'before_execution', 'execution_boundary')
    if c['state'] == 'paused':
        require(c['boundary'] == 'before_pause', 'pause_boundary')
    if data['mode'] == 'same_attempt':
        require(data['proposal'] is None and ob['stop'] is None, 'mode')
    else:
        proposal = data['proposal']
        require(proposal is not None, 'proposal')
        old = c['binding']
        require(proposal['generation'] == old['generation'] + 1
                and all(proposal[k] != old[k] for k in ('attempt','worker','claim_run')), 'generation')
        evidence(ob['stop'], 'all_executions_stopped', snap, now)
        require(timestamp(c['updated_at']) <= timestamp(ob['stop']['observed_at'])
                <= timestamp(ob['observed_at']), 'proof_order')
    return 'PASS: data consistency only; no operation authorized'


def no_duplicate(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result, 'duplicate_key')
        result[key] = value
    return result


def main(argv=None):
    # No argparse-generated errors: arguments and paths may be private.
    args = sys.argv[1:] if argv is None else argv
    if len(args) != 1 or args[0].startswith('-'):
        print('REJECT: usage (one JSON input file)', file=sys.stderr)
        return 2
    try:
        with open(args[0], encoding='utf-8') as stream:
            data = json.load(stream, object_pairs_hook=no_duplicate)
        print(validate(data, dt.datetime.now(dt.timezone.utc)))
        return 0
    except (Invalid, OSError, ValueError, TypeError, RecursionError, OverflowError):
        print('REJECT: invalid or unverifiable data', file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
