import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {diagnose, parsePaths, overlap} = require('./issue_claim_diagnostic.cjs');
const repo = {owner:'example', repo:'game'};
const context = {repo, serverUrl:'https://github.com'};
const sha = 'a'.repeat(40);
const marker = (id, number, body) => ({id, issue_url:`https://api.github.com/repos/example/game/issues/${number}`,
  user:{login:'github-actions[bot]'}, body});
const claim = (owner, run, extra='') => `<!-- issue-claim:v1 state=claimed owner=${owner} -->\n` +
  `<!-- issue-claim-run:v1 id=${run} request=req-1 -->\n${extra}`;
const release = owner => `<!-- issue-claim:v1 state=released owner=${owner} -->`;

function fixture({comments=[], issues={}, prs=[], files={}, runs={}} = {}) {
  const calls = [];
  const paginate = async (method, args) => {
    calls.push([method, args]);
    if (method === 'comments') return comments;
    if (method === 'prs') return prs;
    if (method === 'files') return files[args.pull_number] || [];
    throw Error('Unexpected paginate method');
  };
  const github = {paginate, rest:{issues:{listCommentsForRepo:'comments',
    get:async ({issue_number}) => ({data:issues[issue_number] || {number:issue_number, title:`Issue ${issue_number}`,state:'open'}})},
    pulls:{list:'prs', listFiles:'files', get:async ({pull_number}) => ({data:prs.find(pr => pr.number === pull_number)})},
    actions:{getWorkflowRun:async ({run_id}) => ({data:runs[run_id] ||
      {status:'completed', conclusion:'success', path:'.github/workflows/issue-claim.yml',repository:{full_name:'example/game'}}})}}};
  return {github,calls};
}

test('path overlap uses whole components and case-insensitive containment', () => {
  assert.deepEqual(parsePaths('remake/js/craft/\nremake/js/craft/water.js\n'),
    ['remake/js/craft/','remake/js/craft/water.js']);
  assert.equal(overlap('remake/js/craft/', 'REMAKE/js/craft/water.js'), true);
  assert.equal(overlap('remake/js/craft/', 'remake/js/craft-old/water.js'), false);
  assert.equal(overlap('a/b', 'a/b/child'), true);
  for (const bad of ['/a','a//b','a/../b','a\\b','a/*']) assert.throws(() => parsePaths(bad));
});

test('latest bot record wins; released reservations are omitted', async () => {
  const {github} = fixture({comments:[marker(1,10,claim('old',1)),marker(2,10,release('old')),
    marker(3,11,claim('current',2))]});
  const report = await diagnose(github,context,[]);
  assert.deepEqual(report.rows.map(row => row.issue),[11]);
  assert.equal(report.approval,false);
});

test('a disjoint PR diff never clears an active legacy future scope', async () => {
  const prs=[{number:20,title:'Work #10',body:'',state:'open',head:{sha,repo:{full_name:'example/game'}}}];
  const {github,calls} = fixture({comments:[marker(1,10,claim('worker',1))],prs,
    files:{20:[{filename:'data/a.json'}]}});
  const report=await diagnose(github,context,['remake/js/new.js']);
  assert.equal(report.rows[0].relation,'active_future_scope_unknown');
  assert.equal(report.rows[0].review_required,true);
  assert.deepEqual(report.rows[0].prs[0].paths,['data/a.json']);
  assert.ok(calls.some(([method]) => method === 'comments'));
  assert.ok(calls.every(([method]) => ['comments','prs','files'].includes(method)));
});

test('a parked verified head reports known overlap and disjoint saved paths separately', async () => {
  const wait='<!-- issue-claim-wait:v1 '+JSON.stringify({prs:[{number:20,head:sha}]})+' -->';
  const prs=[{number:20,title:'Work #10',body:'',state:'open',head:{sha,repo:{full_name:'example/game'}}}];
  const {github}=fixture({comments:[marker(1,10,claim('worker',1,wait))],prs,
    files:{20:[{filename:'data/new.json',previous_filename:'data/old.json'}]}});
  const disjoint=await diagnose(github,context,['remake/js/new.js']);
  assert.equal(disjoint.rows[0].relation,'stopped_saved_diff_disjoint_resume_requires_review');
  assert.equal(disjoint.rows[0].review_required,false);
  const overlapReport=await diagnose(github,context,['data/old.json']);
  assert.equal(overlapReport.rows[0].relation,'observed_overlap');
});

test('changed checkpoint head, failed run, and malformed marker remain unverified', async () => {
  const wait='<!-- issue-claim-wait:v1 '+JSON.stringify({prs:[{number:20,head:sha}]})+' -->';
  const prs=[{number:20,title:'Work #10',body:'',state:'open',head:{sha:'b'.repeat(40),repo:{full_name:'example/game'}}}];
  const {github}=fixture({comments:[marker(1,10,claim('worker',1,wait)),marker(2,11,claim('worker2',2)),
    marker(3,12,'<!-- issue-claim:v1 broken -->')],prs,
    runs:{2:{status:'completed',conclusion:'failure',path:'.github/workflows/issue-claim.yml',repository:{full_name:'example/game'}}}});
  const report=await diagnose(github,context,['data/a.json']);
  assert.deepEqual(report.rows.map(row => row.relation),['unverified','unverified','unverified']);
});

test('a malformed handoff checkpoint is never treated as stopped work', async () => {
  const wait='<!-- issue-claim-wait:v1 '+JSON.stringify({prs:[{number:20,head:sha}],handoff:{}})+' -->';
  const {github}=fixture({comments:[marker(1,10,claim('worker',1,wait))]});
  const report=await diagnose(github,context,['data/a.json']);
  assert.equal(report.rows[0].phase,'unknown');
  assert.equal(report.rows[0].relation,'unverified');
});

test('API failure cannot produce an apparently complete report', async () => {
  const {github}=fixture();
  github.paginate=async () => {throw Error('page fetch failed')};
  await assert.rejects(diagnose(github,context,[]),/page fetch failed/);
});
