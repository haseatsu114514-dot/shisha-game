// #1653 ⑦: 第2章の関係の変化（なるへの謝罪と既読・前夜の返事・大会の朝の応援・優勝後の祝福）を実際のLIME履歴へ接続する。
// node --experimental-vm-modules remake/test/ch2_lime.mjs
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const root = new URL('../../', import.meta.url);
const read = p => fs.readFileSync(new URL(p, root), 'utf8');
const lime = JSON.parse(read('data/lime_messages.json')).messages;
const dialogue = file => JSON.stringify(JSON.parse(read(`data/dialogue/${file}.json`)));
const context = vm.createContext({});
let state, cheers = [];
const port = (names, get) => new vm.SyntheticModule(names, function () { for (const n of names) this.setExport(n, get(n)); }, { context });
const statePort = port(['state'], () => state);
const ports = {
  '../core/data.js': port(['DB'], () => ({ lime })),
  '../core/state.js': statePort,
  '../daily/spots.js': port(['hasContact'], () => id => state.contacts.includes(id)),
  '../daily/phone.js': port(['morningMessages'], () => opts => { assert.equal(opts.tournamentDay, true); return cheers.map(id => lime.find(m => m.id === id)); }),
};
const mod = new vm.SourceTextModule(read('remake/js/chapters/ch2-lime.js'), { context });
await mod.link(spec => { assert(ports[spec], spec); return ports[spec]; });
await mod.evaluate();
const { chapterTwoCheers, chapterTwoCongratulations, recordSentLime } = mod.namespace;
function reset(flags = {}, extra = {}) {
  state = { chapter: 2, day: 28, flags: { _ch2_day1: { startDay: 15 }, ...flags }, inbox: [], limeRead: [], contacts: [], ...extra };
  statePort.setExport('state', state);
}
const ids = list => Array.from(list, m => m.id);

// 第1章の応援文（みんとは出場・つむぎは会場）は第2章に届かない。第2章の文は前夜の返事に応じて一方だけ。
for (const id of ['encourage_minto', 'encourage_tsumugi']) assert.equal(lime.find(m => m.id === id).chapter, 1, id);
const ch2Day = lime.filter(m => m.chapter === 2 && ['tournament_day', 'ch2_victory'].includes(m.trigger_condition));
assert.deepEqual(ids(ch2Day).sort(), ['ch2_congrats_adam', 'ch2_congrats_minto', 'ch2_congrats_tsumugi_alone', 'ch2_congrats_tsumugi_welcome',
  'encourage_ch2_tsumugi_alone', 'encourage_ch2_tsumugi_welcome']);
for (const m of ch2Day) {
  for (const line of m.messages) assert(!line.text.includes('\n') && [...line.text].length <= 48, `${m.id}: ${line.text}`);
  for (const r of m.replies || []) assert([...r.text].length <= 19, `${m.id} reply`);
}
// 祝福は返信を一つ選ぶ（本文の「ありがとう、と打ちかけて」の続きを実際に送る）。
for (const m of ch2Day.filter(m => m.trigger_condition === 'ch2_victory')) assert.equal(m.replies.length, 1, m.id);
assert.match(dialogue('ch2_tournament'), /ありがとう、と打ちかけて/);
assert.doesNotMatch(dialogue('ch2_tournament'), /送信するまで、ずいぶん時間がかかった/);

// 大会の朝: 第1章と同じ収集処理を使い、前夜の返事に応えるつむぎの1通を必ず含める。
reset({ _ch2_no_audience: true }, { contacts: ['ageha', 'rin', 'hiyori'] });
cheers = ['encourage_ageha', 'encourage_rin', 'encourage_hiyori'];
assert.deepEqual(ids(chapterTwoCheers()), ['encourage_ch2_tsumugi_alone', 'encourage_ageha', 'encourage_rin'], '3通まで・前夜の返事を優先');
reset({ _ch2_audience_welcome: true });
cheers = [];
assert.deepEqual(ids(chapterTwoCheers()), ['encourage_ch2_tsumugi_welcome']);
cheers = ['encourage_ch2_tsumugi_welcome', 'encourage_ageha'];
assert.deepEqual(ids(chapterTwoCheers()), cheers, '収集処理が選んだ場合は重ねない');
reset();
cheers = ['encourage_ageha'];
assert.deepEqual(ids(chapterTwoCheers()), ['encourage_ageha'], '前夜の選択の無い旧保存は従来どおり');
reset({ _ch2_no_audience: true }, { inbox: [{ id: 'encourage_ch2_tsumugi_alone', msg: {} }] });
assert.deepEqual(ids(chapterTwoCheers()), ['encourage_ageha'], '中断後の読み直しで重ねて届けない');

// 優勝の夜: 前夜の返事に応じたつむぎ＋連絡先のある旧メンバー。読み直しでは重ねない。
reset({ _ch2_no_audience: true }, { contacts: ['minto', 'adam'] });
assert.deepEqual(ids(chapterTwoCongratulations()), ['ch2_congrats_tsumugi_alone', 'ch2_congrats_minto', 'ch2_congrats_adam']);
reset({ _ch2_audience_welcome: true }, { contacts: ['adam'] });
assert.deepEqual(ids(chapterTwoCongratulations()), ['ch2_congrats_tsumugi_welcome', 'ch2_congrats_adam']);
state.inbox.push({ id: 'ch2_congrats_tsumugi_welcome', originId: 'ch2_congrats_tsumugi_welcome', msg: {} });
assert.deepEqual(ids(chapterTwoCongratulations()), ['ch2_congrats_adam']);
reset();
assert.deepEqual(ids(chapterTwoCongratulations()), [], '連絡先も前夜の記録も無ければ届かない');

// なるへの謝罪: 決裂（push）を読んだ時だけ、送信と既読を章内DAY11の履歴に残す。一度だけ。
reset({ _ch2_naru_hurt: true });
assert.equal(recordSentLime(), false, '場面を読む前は記録しない');
state.flags._ch2_read_ch2_naru_confrontation = true;
assert.equal(recordSentLime(), true);
assert.equal(recordSentLime(), false);
const apology = state.inbox.find(i => i.id === 'ch2_sent_naru_apology');
assert.equal(state.inbox.length, 1);
assert.deepEqual({ sender: apology.msg.sender, day: apology.day, chapter: apology.chapter, read: apology.read, done: apology.done },
  { sender: 'naru', day: 25, chapter: 2, read: true, done: true });
assert(apology.log.slice(0, -1).every(l => l.me) && /^既読/.test(apology.log.at(-1).note));
assert.match(dialogue('ch2_isolation'), /謝りのLIMEを送った。既読はついた。返事は来なかった/);
// 聞いた（listen）側は謝罪ではなく、店の前で送った問いかけだけ。
reset({ _ch2_naru_listened: true, _ch2_read_ch2_naru_confrontation: true, _ch2_read_ch2_naru_window: true });
recordSentLime();
assert.deepEqual(ids(state.inbox), ['ch2_sent_naru_where']);
assert.match(dialogue('ch2_isolation'), /今どこにいますか、と打って送る/);
// 大会後の「終わりました」は、決着後の場面を読んだ時だけ。
recordSentLime(state, 'tasteless');
assert.deepEqual(ids(state.inbox), ['ch2_sent_naru_where', 'ch2_sent_naru_finished']);
assert.match(dialogue('ch2_tournament'), /「終わりました」とだけ打って、送った/);

// 前夜のつむぎとのやり取りは、台本で引用した文面のまま履歴に残す。
for (const [flag, id] of [['_ch2_no_audience', 'ch2_eve_tsumugi_alone'], ['_ch2_audience_welcome', 'ch2_eve_tsumugi_welcome']]) {
  reset({ [flag]: true, _ch2_read_ch2_pre_tournament_realisation: true });
  recordSentLime();
  assert.deepEqual(ids(state.inbox), [id]);
  const eve = state.inbox[0], script = dialogue('ch2_main');
  assert.equal(eve.day, 27);
  assert.equal(eve.msg.sender, 'tsumugi');
  for (const entry of eve.log) assert(script.includes(`『${entry.text}』`), `${id}: ${entry.text}`);
}

// 第2章以外の保存では何も足さない。
reset({ _ch2_naru_hurt: true, _ch2_read_ch2_naru_confrontation: true }, { chapter: 3 });
assert.equal(recordSentLime(), false);
assert.equal(state.inbox.length, 0);

// 実際の進行に接続されている（スミさんの連絡と同じスマホで先に読む）。
const tournament = read('remake/js/chapters/ch2-tournament.js'), story = read('remake/js/chapters/ch2-story.js');
assert.match(tournament, /\], chapterTwoCheers\)\)/);
assert.match(tournament, /\], chapterTwoCongratulations\)\)/);
assert.match(tournament, /read\(owner, "tasteless"\)[\s\S]{0,120}recordSentLime\(state, "tasteless"\)/);
assert.match(story, /recordSentLime\(owner\)/);
console.log('ch2_lime: ok');
