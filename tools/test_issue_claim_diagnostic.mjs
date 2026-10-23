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
    pulls:{list:'prs', listFiles:'files', get:async ({pull_number}) => {
      const pr=prs.find(item => item.number === pull_number);
      return {data:pr && {changed_files:(files[pull_number] || []).length, base:{sha:'b'.repeat(40)}, ...pr}};
    }},
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

test('a truncated PR file list fails the diagnostic instead of reporting disjoint paths', async () => {
  const prs=[{number:20,title:'Work #10',body:'',state:'open',changed_files:3001,
    head:{sha,repo:{full_name:'example/game'}}}];
  const {github}=fixture({comments:[marker(1,10,claim('worker',1))],prs,
    files:{20:[{filename:'data/a.json'}]}});
  await assert.rejects(diagnose(github,context,['remake/js/new.js']),
    /Incomplete changed-file list for PR #20/);
});

test('duplicate pagination entries cannot hide a missing candidate path in a parked PR', async () => {
  const wait='<!-- issue-claim-wait:v1 '+JSON.stringify({prs:[{number:20,head:sha}]})+' -->';
  const prs=[{number:20,title:'Work #10',state:'open',changed_files:101,
    head:{sha,repo:{full_name:'example/game'}}}];
  const firstPage=Array.from({length:100},(_,i)=>({filename:`other/${i}.json`}));
  const {github}=fixture({comments:[marker(1,10,claim('worker',1,wait))],prs,
    files:{20:[...firstPage,firstPage[99]]}});
  await assert.rejects(diagnose(github,context,['data/a.json']),
    /Incomplete changed-file list for PR #20/);
});

test('missing, empty and non-text filenames fail instead of disappearing from the report', async () => {
  for (const file of [null,{}, {filename:''}, {filename:'   '}, {filename:12}]) {
    const prs=[{number:20,title:'Work #10',state:'open',head:{sha}}];
    const {github}=fixture({comments:[marker(1,10,claim('worker',1))],prs,files:{20:[file]}});
    await assert.rejects(diagnose(github,context,['data/a.json']),
      /Incomplete changed-file list for PR #20/);
  }
});

test('head or base changes during pagination fail even when file count stays equal', async () => {
  for (const side of ['head','base']) {
    const prs=[{number:20,title:'Work #10',state:'open',head:{sha},base:{sha:'b'.repeat(40)}}];
    const {github}=fixture({comments:[marker(1,10,claim('worker',1))],prs,
      files:{20:[{filename:'other/a.json'}]}});
    const get=github.rest.pulls.get;
    let reads=0;
    github.rest.pulls.get=async args=>{
      const {data}=await get(args);
      if (++reads === 2) return {data:{...data,[side]:{...data[side],sha:'c'.repeat(40)}}};
      return {data};
    };
    await assert.rejects(diagnose(github,context,['data/a.json']),
      /Changed PR diff while listing files for PR #20/);
    assert.equal(reads,2);
  }
});

test('a changed file count after pagination invalidates the snapshot', async () => {
  const prs=[{number:20,title:'Work #10',state:'open',head:{sha}}];
  const {github}=fixture({comments:[marker(1,10,claim('worker',1))],prs,
    files:{20:[{filename:'other/a.json'}]}});
  const get=github.rest.pulls.get;
  let reads=0;
  github.rest.pulls.get=async args=>{
    const {data}=await get(args);
    return {data:++reads === 2 ? {...data,changed_files:2} : data};
  };
  await assert.rejects(diagnose(github,context,['data/a.json']),
    /Changed PR diff while listing files for PR #20/);
});

test('missing head or base SHA cannot establish a complete diff snapshot', async () => {
  for (const side of ['head','base']) {
    const prs=[{number:20,title:'Work #10',state:'open',head:{sha},[side]:{}}];
    const {github}=fixture({comments:[marker(1,10,claim('worker',1))],prs});
    await assert.rejects(diagnose(github,context,['data/a.json']),
      /Missing diff identity for PR #20/);
  }
});

test('a newer head than the open PR inventory cannot be attributed to the old head', async () => {
  const prs=[{number:20,title:'Work #10',state:'open',head:{sha}}];
  const {github}=fixture({comments:[marker(1,10,claim('worker',1))],prs,
    files:{20:[{filename:'other/a.json'}]}});
  const get=github.rest.pulls.get;
  github.rest.pulls.get=async args=>{
    const {data}=await get(args);
    return {data:{...data,head:{sha:'c'.repeat(40)}}};
  };
  await assert.rejects(diagnose(github,context,['data/a.json']),
    /Changed PR head before listing files for PR #20/);
});

test('a stable complete multi-page-sized file list retains overlap detection', async () => {
  const prs=[{number:20,title:'Work #10',state:'open',head:{sha}}];
  const files=Array.from({length:100},(_,i)=>({filename:`other/${i}.json`}));
  files.push({filename:'data/a.json'});
  const {github}=fixture({comments:[marker(1,10,claim('worker',1))],prs,files:{20:files}});
  const report=await diagnose(github,context,['data/a.json']);
  assert.equal(report.rows[0].observed_overlap,true);
  assert.equal(report.rows[0].relation,'observed_overlap');
  assert.equal(report.rows[0].prs[0].paths.length,101);
});
