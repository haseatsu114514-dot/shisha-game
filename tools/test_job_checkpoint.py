#!/usr/bin/env python3
"""Synthetic fixtures only. Run: python3 -B -m unittest discover -s tools -p test_job_checkpoint.py -v"""
import copy
import datetime as dt
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
import validate_job_checkpoint as v

NOW = dt.datetime(2030, 1, 1, 0, 5, tzinfo=dt.timezone.utc)
T = '2030-01-01T00:04:00Z'
SHA = 'a' * 40


def fixture(route='branch_only', replacement=False):
    c = dict(version=1, issue=12, job='job-12',
             binding=dict(attempt='attempt-1',worker='worker-1',claim_run=123,generation=1),
             revision=1, predecessor=None, state='active',boundary='before_execution',
             created_at=T,updated_at=T,scope=[1,2],done=[1],remaining=[2],holds=[],
             artifact=dict(route=route,branch='job/12/1',head=SHA,prs=[],save='saved',clean=True),
             tests=[dict(test='test-1',result='pass',sha=SHA)])
    if route == 'open_pr':
        c['artifact']['prs'] = [dict(number=13,head=SHA,draft=True),
                                dict(number=14,head='b'*40,draft=False)]
    if route == 'no_artifact':
        c['artifact'].update(branch=None,head=None,save='never_started_verified')
        c.update(done=[],remaining=[1,2],tests=[])
    d = dict(mode='proposed_replacement' if replacement else 'same_attempt',checkpoint=c,
             previous=None,observation={},proposal=None)
    if replacement:
        d['proposal'] = dict(attempt='attempt-2',worker='worker-2',claim_run=124,generation=2)
    bind(d)
    return d


def bind(d):
    c = d['checkpoint']; snap = v.fingerprint(c)
    proof = dict(verified=True,independent=True,observed_at=T,snapshot=snap,
                 kind='never_started' if c['artifact']['route']=='no_artifact' else 'saved_clean_pushed')
    d['observation'] = dict(observed_at=T,checkpoint=snap,previous=c['predecessor'],
                            preservation=proof,stop=None,
                            proposal=v.fingerprint(d['proposal']) if d['proposal'] is not None else None)
    if d['mode']=='proposed_replacement':
        d['observation']['stop'] = dict(proof,kind='all_executions_stopped')


def successor(d):
    p=copy.deepcopy(d['checkpoint']); d['previous']=p
    d['checkpoint'].update(revision=p['revision']+1,predecessor=v.fingerprint(p))
    bind(d)
    return d


class Contract(unittest.TestCase):
    def reject(self,d):
        with self.assertRaises(v.Invalid): v.validate(d,NOW)

    def test_positive_routes_modes(self):
        for route in ('no_artifact','branch_only','open_pr'):
            for replacement in (False,True):
                with self.subTest(route=route,replacement=replacement):
                    self.assertIn('no operation authorized',v.validate(fixture(route,replacement),NOW))

    def test_revision_and_valid_pause(self):
        d=successor(fixture()); d['checkpoint'].update(state='paused',boundary='before_pause'); bind(d)
        v.validate(d,NOW)

    def test_saved_history_cannot_become_never_started(self):
        for route in ('branch_only', 'open_pr'):
            for replacement in (False, True):
                with self.subTest(route=route, replacement=replacement):
                    d=fixture(route, replacement)
                    d['checkpoint'].update(done=[], remaining=[1,2]); bind(d)
                    v.validate(d,NOW)
                    successor(d)
                    d['checkpoint']['artifact'].update(route='no_artifact', branch=None,
                        head=None, prs=[], save='never_started_verified')
                    d['checkpoint']['tests']=[]; bind(d)
                    self.reject(d)

    def test_never_started_can_save_first_artifact(self):
        for route in ('branch_only', 'open_pr'):
            d=successor(fixture('no_artifact'))
            saved=fixture(route)['checkpoint']
            d['checkpoint'].update(artifact=saved['artifact'], tests=saved['tests'])
            bind(d); v.validate(d,NOW)

    def test_test_ids_unique_in_current_and_previous(self):
        for previous in (False, True):
            for result in ('pass', 'fail', 'not_run'):
                with self.subTest(previous=previous, result=result):
                    d=fixture()
                    d['checkpoint']['tests'].append(dict(test='test-1',result=result,sha=SHA))
                    bind(d)
                    if previous:
                        successor(d)
                        d['checkpoint']['tests']=[dict(test='test-2',result='pass',sha=SHA)]
                        bind(d)
                    self.reject(d)
        d=fixture()
        d['checkpoint']['tests'].append(dict(test='test-2',result='fail',sha=SHA))
        bind(d); v.validate(d,NOW)
        successor(d); v.validate(d,NOW)

    def test_shape_privacy_types(self):
        for path,value in [(('private',),'private-conversation'),
                           (('checkpoint','binding','account'),'private-account'),
                           (('checkpoint','artifact','path'),'/private/device'),
                           (('checkpoint','scope'),['private-conversation']),
                           (('checkpoint','job'),'session-private'),
                           (('checkpoint','binding','worker'),'secret-token'),
                           (('checkpoint','artifact','branch'),'/private/device'),
                           (('checkpoint','issue'),True),
                           (('checkpoint','revision'),1.0),
                           (('checkpoint','artifact','head'),'abc123'),
                           (('checkpoint','tests',0,'sha'),'b'*39),
                           (('checkpoint','updated_at'),'2030-02-31T00:04:00Z')]:
            with self.subTest(path=path):
                d=fixture(); target=d
                for key in path[:-1]: target=target[key]
                target[path[-1]]=value; self.reject(d)
        for value in (None,[],True,{'checkpoint':{}}): self.reject(value)

    def test_preservation_and_test_targets(self):
        for field,value in [('save','unknown'),('save','unpushed'),('clean',False),
                            ('head','b'*40),('route','no_artifact')]:
            d=fixture(); d['checkpoint']['artifact'][field]=value; bind(d); self.reject(d)
        d=fixture(); d['checkpoint']['tests']=[]; bind(d); self.reject(d)
        d=fixture('no_artifact'); d['checkpoint']['artifact']['save']='saved'; bind(d); self.reject(d)
        d=fixture(); d['checkpoint']['artifact']['branch']='job/99/1'; bind(d); self.reject(d)
        d=fixture('open_pr'); d['checkpoint']['artifact']['prs'].append(dict(number=13,head='c'*40,draft=False)); bind(d); self.reject(d)

    def test_snapshot_drift_and_concurrency(self):
        for path,value in [(('artifact','head'),'b'*40), (('binding','generation'),2),
                           (('binding','worker'),'worker-2'), (('binding','claim_run'),999)]:
            d=fixture(); d['checkpoint'][path[0]][path[1]]=value; self.reject(d)
        for change in ('head','set','draft'):
            d=fixture('open_pr')
            if change=='head': d['checkpoint']['artifact']['prs'][0]['head']='b'*40
            elif change=='set': d['checkpoint']['artifact']['prs'].pop()
            else: d['checkpoint']['artifact']['prs'][0]['draft']=False
            self.reject(d)
        d=successor(fixture()); d['observation']['previous']='0'*64; self.reject(d)
        d=successor(fixture()); d['observation']['checkpoint']=v.fingerprint(d['previous']); self.reject(d)

    def test_staleness_and_proof_order(self):
        for target in ('checkpoint','observation','preservation','stop'):
            for t in ('2029-12-31T23:00:00Z','2030-01-01T00:06:00Z'):
                d=fixture(replacement=True)
                if target=='checkpoint': d['checkpoint']['updated_at']=t
                elif target=='observation': d['observation']['observed_at']=t
                else: d['observation'][target]['observed_at']=t
                self.reject(d)
        d=fixture(); d['observation']['preservation']['observed_at']='2030-01-01T00:03:59Z'; self.reject(d)

    def test_unverified_stop_never_inferred(self):
        for kind in ('unknown','http_404','no_response','timeout','historical_turn_completed','never_started'):
            d=fixture(replacement=True); d['observation']['stop']['kind']=kind; self.reject(d)
        for proof in ('stop','preservation'):
            for field,value in [('verified',False),('independent',False),('snapshot','0'*64)]:
                d=fixture(replacement=True); d['observation'][proof][field]=value; self.reject(d)
        d=fixture(replacement=True); d['observation']['stop']=None; self.reject(d)

    def test_prospective_generation_identity(self):
        for field,value in [('generation',1),('generation',3),('attempt','attempt-1'),
                            ('worker','worker-1'),('claim_run',123)]:
            d=fixture(replacement=True); d['proposal'][field]=value; self.reject(d)
        d=fixture(); d['proposal']=dict(d['checkpoint']['binding']); self.reject(d)

    def test_proposal_concurrency_and_boundaries(self):
        d=fixture(replacement=True); d['proposal']['worker']='worker-3'; self.reject(d)
        for boundary in ('after_push','before_pause'):
            d=fixture(); d['checkpoint']['boundary']=boundary; bind(d); self.reject(d)
        d=fixture('no_artifact'); d['checkpoint'].update(state='ready',boundary='after_push'); bind(d); self.reject(d)

    def test_replay_history_and_illegal_transitions(self):
        for field,value in [('revision',1),('revision',3),('predecessor','0'*64),
                            ('job','job-13'),('state','ready')]:
            d=successor(fixture()); d['checkpoint'][field]=value; bind(d); self.reject(d)
        for field,value in [('generation',2),('attempt','attempt-2'),('worker','worker-2'),('claim_run',124)]:
            d=successor(fixture()); d['checkpoint']['binding'][field]=value; bind(d); self.reject(d)
        d=successor(fixture()); d['previous']=None; self.reject(d)
        d=fixture(); d['checkpoint']['done']=[]; bind(d); self.reject(d)

    def test_hold_retention_all_modes(self):
        for kind in ('hold','cancel','approval_pending','denied'):
            for replacement in (False,True):
                d=fixture(replacement=replacement)
                d['checkpoint'].update(holds=[dict(id='hold-1',kind=kind,status='required')],
                                       state='cancelled' if kind=='cancel' else 'held')
                bind(d); v.validate(d,NOW)
                successor(d); d['checkpoint'].update(holds=[],state='active'); bind(d); self.reject(d)
                d=fixture(replacement=replacement); d['checkpoint']['state']='held'; bind(d); self.reject(d)

    def test_cli_read_only_and_private_errors(self):
        script=Path(v.__file__).resolve()
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp)/'private-input.json'
            d=fixture(); d['private-secret']='private-marker-123'; path.write_text(json.dumps(d))
            before={p.name:p.read_bytes() for p in Path(tmp).iterdir()}
            for args in ([str(path)],['--private-marker-123'],[str(path/'private-marker-123')]):
                r=subprocess.run([sys.executable,'-B',str(script),*args],cwd=tmp,capture_output=True,text=True)
                self.assertNotEqual(r.returncode,0)
                self.assertNotIn('private-marker',r.stdout+r.stderr)
                self.assertNotIn(tmp,r.stdout+r.stderr)
                self.assertNotIn('Traceback',r.stderr)
            self.assertEqual(before,{p.name:p.read_bytes() for p in Path(tmp).iterdir()})
            path.write_text('{"private-marker-123": 1, "private-marker-123": 2}')
            self.assertEqual(v.main([str(path)]),1)
            path.write_text(json.dumps(fixture()))
            with patch.object(v.dt,'datetime',wraps=dt.datetime) as clock:
                clock.now.return_value=NOW
                self.assertEqual(v.main([str(path)]),0)


if __name__=='__main__': unittest.main()
