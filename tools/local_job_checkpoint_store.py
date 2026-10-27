"""Opt-in POSIX file CAS for one checkpoint binding. No operational authority."""
import contextlib
import copy
import fcntl
import json
import os
from pathlib import Path
import stat
import tempfile

import validate_job_checkpoint as v

MAX_BYTES = 1024 * 1024


class Conflict(ValueError):
    """Expected checkpoint or same-binding successor did not match."""


class PublishedDurabilityUncertain(OSError):
    """Replacement returned, but directory durability was not confirmed.

    The new file was visible at replacement. Read back; never blindly retry.
    """


class PublicationUncertain(OSError):
    """Replacement was attempted without a confirmed outcome. Read back first."""


def _bytes(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'),
                      ensure_ascii=True, allow_nan=False).encode('utf-8')


def current_token(checkpoint):
    """Detached expected value; callers must obtain it from their actual current file."""
    return copy.deepcopy(dict(job=checkpoint['job'], binding=checkpoint['binding'],
                              revision=checkpoint['revision'],
                              digest=v.fingerprint(checkpoint),
                              predecessor=checkpoint['predecessor']))


@contextlib.contextmanager
def _locked(path):
    # Canonical parent makes relative paths and parent symlink aliases share a lock.
    # The final file and persistent sidecar may not themselves be symlinks.
    path = Path(path)
    if path.name in ('', '.', '..') or path.name.endswith('.lock'):
        raise ValueError('invalid destination')
    path = path.parent.resolve(strict=True) / path.name
    flags = os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW
    fd = os.open(str(path) + '.lock', flags, 0o600)
    try:
        info = os.fstat(fd)
        if not stat.S_ISREG(info.st_mode) or info.st_nlink != 1:
            raise ValueError('invalid lock')
        fcntl.flock(fd, fcntl.LOCK_EX)
        yield path
    finally:
        # Never unlink the lock: waiters must continue to lock the same inode.
        os.close(fd)


def _read(path):
    try:
        fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    except FileNotFoundError:
        return None
    with os.fdopen(fd, 'rb') as stream:
        info = os.fstat(stream.fileno())
        if not stat.S_ISREG(info.st_mode) or info.st_nlink != 1:
            raise ValueError('invalid checkpoint file')
        raw = stream.read(MAX_BYTES + 1)
    if len(raw) > MAX_BYTES:
        raise ValueError('checkpoint too large')
    data = json.loads(raw, object_pairs_hook=v.no_duplicate)
    v.shape(data, json.loads(v.SCHEMA.read_text(encoding='utf-8')))
    v.checkpoint_rules(data['checkpoint'])
    if data['mode'] != 'same_attempt':
        raise ValueError('unsupported stored mode')
    return data


def read_current(path):
    """Read under the same lock; None means absent, not never-started proof.

    This read checks stored shape/rules, not freshness, live truth or authority.
    """
    with _locked(path) as destination:
        return _read(destination)


def compare_and_swap(path, envelope, *, expected, now):
    """Validate and publish a same-binding revision with an explicit expected token.

    expected=None allows only revision 1 into an absent file. Otherwise use
    current_token(read_current(path)['checkpoint']). No transfer or adoption.
    """
    # Detach mutable caller objects before waiting for the interprocess lock.
    data = json.loads(_bytes(envelope), object_pairs_hook=v.no_duplicate)
    expected = copy.deepcopy(expected)
    if len(_bytes(data)) > MAX_BYTES:
        raise ValueError('checkpoint too large')
    with _locked(path) as destination:
        v.validate(data, now)
        if data['mode'] != 'same_attempt':
            raise Conflict('same_attempt required')
        current = _read(destination)
        candidate = data['checkpoint']
        if current is None:
            if expected is not None or candidate['revision'] != 1 or data['previous'] is not None:
                raise Conflict('current checkpoint mismatch')
        else:
            old = current['checkpoint']
            # Full binding, revision, digest and predecessor are compared while locked.
            if expected is None or _bytes(expected) != _bytes(current_token(old)):
                raise Conflict('current checkpoint mismatch')
            if (data['previous'] != old or candidate['job'] != old['job']
                    or candidate['binding'] != old['binding']
                    or candidate['revision'] != old['revision'] + 1
                    or candidate['predecessor'] != v.fingerprint(old)):
                raise Conflict('successor mismatch')
        encoded = _bytes(data) + b'\n'
        if len(encoded) > MAX_BYTES:
            raise ValueError('checkpoint too large')
        temporary = None
        replaced = attempted = False
        try:
            fd, temporary = tempfile.mkstemp(prefix='.' + destination.name + '.',
                                              dir=destination.parent)
            with os.fdopen(fd, 'wb') as stream:
                stream.write(encoded)
                stream.flush()
                os.fsync(stream.fileno())
            attempted = True
            os.replace(temporary, destination)
            replaced = True
            directory = os.open(destination.parent, os.O_RDONLY | os.O_DIRECTORY)
            try:
                os.fsync(directory)
            finally:
                os.close(directory)
        except BaseException as error:
            if replaced:
                raise PublishedDurabilityUncertain('read back before any retry') from error
            if attempted:
                raise PublicationUncertain('read back before any retry') from error
            raise
        finally:
            if temporary is not None:
                try:
                    os.unlink(temporary)
                except FileNotFoundError:
                    pass
        return current_token(candidate)
