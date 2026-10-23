"""Real POSIX file/2-process CAS tests; synthetic evidence, no live authority."""
import copy
import multiprocessing as mp
from pathlib import Path
import os
import tempfile
import unittest
from unittest.mock import patch

import local_job_checkpoint_store as s
import test_job_checkpoint as f
import validate_job_checkpoint as v


def race(path, data, token, barrier, results):
    barrier.wait(timeout=10)
    try:
        s.compare_and_swap(path, data, expected=token, now=f.NOW)
        results.put('success')
    except s.Conflict:
        results.put('conflict')


class LocalStore(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.path = Path(self.tmp.name) / 'checkpoint.json'
        self.first = f.fixture()

    def write(self, data, expected):
        return s.compare_and_swap(self.path, data, expected=expected, now=f.NOW)

    def test_real_save_reopen_and_successor(self):
        self.assertIsNone(s.read_current(self.path))
        token = self.write(self.first, None)
        self.assertEqual(s.read_current(self.path), self.first)
        second = f.successor(copy.deepcopy(self.first))
        self.assertEqual(self.write(second, token), s.current_token(second['checkpoint']))
        self.assertEqual(s.read_current(self.path), second)
        self.assertTrue(Path(str(self.path) + '.lock').exists())

    def test_valid_old_snapshot_cannot_roll_back(self):
        token = self.write(self.first, None)
        second = f.successor(copy.deepcopy(self.first))
        self.write(second, token)
        v.validate(self.first, f.NOW)  # Internally valid, nevertheless not current.
        for expected in (None, token, s.current_token(second['checkpoint'])):
            with self.assertRaises(s.Conflict): self.write(self.first, expected)
        self.assertEqual(s.read_current(self.path), second)

    def test_every_expected_component_is_compared(self):
        token = self.write(self.first, None)
        second = f.successor(copy.deepcopy(self.first))
        for key, value in [('job','job-99'),('revision',9),('digest','0'*64),
                           ('predecessor','0'*64),('binding',dict(token['binding'],generation=2))]:
            wrong = dict(token); wrong[key] = value
            with self.subTest(key=key), self.assertRaises(s.Conflict): self.write(second, wrong)
        for key, value in [('attempt','attempt-2'),('worker','worker-2'),
                           ('claim_run',124),('generation',2)]:
            data = copy.deepcopy(second)
            data['previous']['binding'][key] = value
            data['checkpoint']['binding'][key] = value
            data['checkpoint']['predecessor'] = v.fingerprint(data['previous'])
            f.bind(data)
            v.validate(data, f.NOW)  # Consistent forged history still cannot replace current.
            with self.subTest(binding=key), self.assertRaises(s.Conflict): self.write(data, token)
        self.assertEqual(s.read_current(self.path), self.first)

    def test_two_actual_processes_exactly_one_success(self):
        # spawn uses separate descriptors/processes on both macOS and Linux.
        ctx = mp.get_context('spawn')
        token = self.write(self.first, None)
        candidates = [f.successor(copy.deepcopy(self.first)) for _ in range(2)]
        candidates[1]['checkpoint']['tests'][0]['result'] = 'fail'
        f.bind(candidates[1])
        barrier, results = ctx.Barrier(3), ctx.Queue()
        processes = [ctx.Process(target=race,args=(str(self.path),d,token,barrier,results))
                     for d in candidates]
        try:
            for p in processes: p.start()
            barrier.wait(timeout=10)
            outcomes = [results.get(timeout=15) for _ in processes]
            for p in processes:
                p.join(timeout=15)
                self.assertEqual(p.exitcode,0)
            self.assertCountEqual(outcomes,['success','conflict'])
            self.assertIn(s.read_current(self.path),candidates)
        finally:
            for p in processes:
                if p.is_alive(): p.terminate(); p.join()
            results.close(); results.join_thread()

    def test_after_replace_directory_fsync_uncertain_readback_no_retry(self):
        token = self.write(self.first, None)
        second = f.successor(copy.deepcopy(self.first))
        real_fsync = os.fsync
        calls = []
        def fsync(fd):
            calls.append(fd)
            if len(calls) == 2: raise OSError('synthetic directory failure')
            return real_fsync(fd)
        with patch.object(s.os,'fsync',side_effect=fsync):
            with self.assertRaises(s.PublishedDurabilityUncertain): self.write(second, token)
        self.assertEqual(len(calls),2)
        self.assertEqual(s.read_current(self.path),second)
        # An automatic repetition would be stale; it must not publish again.
        with self.assertRaises(s.Conflict): self.write(second,token)
        self.assertEqual(s.read_current(self.path),second)

    def test_prepublication_failure_keeps_current(self):
        token = self.write(self.first,None)
        second = f.successor(copy.deepcopy(self.first))
        with patch.object(s.os,'fsync',side_effect=OSError('file flush failed')):
            with self.assertRaises(OSError) as caught: self.write(second,token)
        self.assertNotIsInstance(caught.exception,s.PublicationUncertain)
        self.assertNotIsInstance(caught.exception,s.PublishedDurabilityUncertain)
        self.assertEqual(s.read_current(self.path),self.first)
        self.assertFalse(list(self.path.parent.glob('.checkpoint.json.*')))

    def test_replace_unknown_outcome_readback(self):
        token = self.write(self.first,None)
        second = f.successor(copy.deepcopy(self.first))
        real_replace = os.replace
        def lost_reply(source,destination):
            real_replace(source,destination)
            raise OSError('reply lost')
        with patch.object(s.os,'replace',side_effect=lost_reply):
            with self.assertRaises(s.PublicationUncertain): self.write(second,token)
        self.assertEqual(s.read_current(self.path),second)

    def test_validator_refusals_preserved(self):
        token = self.write(self.first,None)
        for change in ('hold','unknown','replacement'):
            data = f.successor(copy.deepcopy(self.first))
            if change == 'hold':
                data['previous'].update(state='held',holds=[dict(id='hold-1',kind='denied',status='required')])
                data['checkpoint']['predecessor']=v.fingerprint(data['previous'])
            elif change == 'unknown': data['checkpoint']['artifact']['save']='unknown'
            else:
                data=f.fixture(replacement=True)
            f.bind(data)
            with self.subTest(change=change), self.assertRaises((s.Conflict,v.Invalid)):
                self.write(data,token)
        self.assertEqual(s.read_current(self.path),self.first)

    def test_missing_or_corrupt_current_is_not_reinitialized(self):
        token=self.write(self.first,None)
        self.path.unlink()
        with self.assertRaises(s.Conflict): self.write(f.successor(copy.deepcopy(self.first)),token)
        self.path.write_text('{invalid')
        with self.assertRaises(ValueError): self.write(self.first,None)
        self.assertEqual(self.path.read_text(),'{invalid')

    def test_symlink_destination_and_lock_refused(self):
        other=self.path.parent/'other.json'; other.write_text('untouched')
        self.path.symlink_to(other)
        with self.assertRaises(OSError): self.write(self.first,None)
        self.path.unlink()
        Path(str(self.path)+'.lock').unlink()
        Path(str(self.path)+'.lock').symlink_to(other)
        with self.assertRaises(OSError): self.write(self.first,None)
        self.assertEqual(other.read_text(),'untouched')


if __name__ == '__main__': unittest.main()
