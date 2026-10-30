import assert from 'node:assert/strict';
import fs from 'node:fs';
import { masteryLabel, MASTERY_THRESHOLDS, gainFlavorExperience, learnFlavorStory, masteryLevel, masteryBonus, staffFlavors, staffStock, spendPracticeMix } from '../js/core/flavor-mastery.js';
globalThis.document = { addEventListener() {}, querySelector() { return null; } };
globalThis.window = {};
const storage = new Map();
globalThis.localStorage = { getItem: k => storage.get(k) ?? null, setItem: (k,v) => storage.set(k,v), removeItem: k => storage.delete(k) };
const core = await import('../js/core/state.js');
const { DB } = await import('../js/core/data.js');
const flavors = JSON.parse(fs.readFileSync(new URL('../../data/flavors.json',import.meta.url))).flavors;
DB.flavorById = Object.fromEntries(flavors.map(f=>[f.id,f]));
DB.recipes=[]; DB.ngMixes=[];
const { addStamina } = await import('../js/core/stats.js');
const { SPOTS } = await import('../js/daily/spots.js');
const { applyHomeShisha } = await import('../js/daily/home-shisha.js');
const { regulationFor, REGULATION, mixFlavorIds, evaluateMix, isTournamentFlavorLegal } = await import('../js/craft/steps.js');
const { buildCarryPackage } = await import('../js/core/carry.js');
let s=core.newGame();
assert.equal(masteryLevel(s,'lemon'),1);
for(let i=0;i<MASTERY_THRESHOLDS.length;i++){s.flavorMastery.lemon=MASTERY_THRESHOLDS[i];assert.equal(masteryLevel(s,'lemon'),i+1);}
for (const [xp, stars] of [[0,1],[5.999,1],[6,2],[17.999,2],[18,3],[35.999,3],[36,4],[59.999,4],[60,5],[999,5]]) {
 s.flavorMastery.lemon=xp;
 assert.equal(masteryLabel(s,'lemon'),`熟練度 ${'★'.repeat(stars)}${'☆'.repeat(5-stars)}${stars===5?' MAX':''}`);
}
s.flavorMastery={};
gainFlavorExperience(s,{lemon:6,mint:6},6,DB.flavorById);
assert.deepEqual(s.flavorMastery,{lemon:3,mint:3},'6g + 6g splits experience equally');
s.flavorMastery={};
gainFlavorExperience(s,{lemon:9,mint:3},6,DB.flavorById);
assert.deepEqual(s.flavorMastery,{lemon:4.5,mint:1.5});
gainFlavorExperience(s,{dobaj_mint:12},6,DB.flavorById);assert.equal(masteryLevel(s,'mint'),2);
for(let i=0;i<30;i++)gainFlavorExperience(s,{lemon:12},6,DB.flavorById);
assert.equal(s.flavorMastery.lemon,60);assert.equal(masteryBonus(s,{lemon:12}),8);
assert(Math.abs(masteryBonus(s,{lemon:1,orange:11})-8/12)<1e-12,'tiny amount cannot confer full bonus');
const d={dialogue_id:'lesson',metadata:{flavor_lesson:{orange:1}}};
learnFlavorStory(s,d);learnFlavorStory(s,d);assert.equal(s.flavorMastery.orange,12);
learnFlavorStory(s,{dialogue_id:'ordinary'});assert.equal(s.flavorMastery.orange,12);
const lemonGift=JSON.parse(fs.readFileSync(new URL('../../data/dialogue/remake_ch1.json',import.meta.url))).dialogues.find(d=>d.dialogue_id==='remake_lemon_gift');
assert.deepEqual(lemonGift.metadata.flavor_lesson,{lemon:1});
s.flavorMastery={};s.flavorLessons=[];learnFlavorStory(s,lemonGift);assert.equal(s.flavorMastery.lemon,12);
for(let i=0;i<8;i++)gainFlavorExperience(s,{lemon:12},6,DB.flavorById);
assert.equal(s.flavorMastery.lemon,60,'lemon lesson plus eight old-rig practices reaches MAX');
s.flavorMastery={};for(let i=0;i<9;i++)gainFlavorExperience(s,{lemon:12},6,DB.flavorById);
assert.equal(masteryLevel(s,'lemon'),4);
gainFlavorExperience(s,{lemon:12},6,DB.flavorById);assert.equal(masteryLevel(s,'lemon'),5);
s.flavorMastery={};for(let i=0;i<7;i++)gainFlavorExperience(s,{lemon:12},7.5,DB.flavorById);
assert.equal(masteryLevel(s,'lemon'),4);
gainFlavorExperience(s,{lemon:12},7.5,DB.flavorById);assert.equal(masteryLevel(s,'lemon'),5);
s.flavorMastery={lemon:12};for(let i=0;i<6;i++)gainFlavorExperience(s,{lemon:12},7.5,DB.flavorById);
assert.equal(masteryLevel(s,'lemon'),4);
gainFlavorExperience(s,{lemon:12},7.5,DB.flavorById);assert.equal(masteryLevel(s,'lemon'),5);
{
 // #1466: アダムの味の話の熟練度は第4回（熱の攻め方）に付く。第3回で受け取った旧セーブには第4回で二重付与しない。
 const adam=JSON.parse(fs.readFileSync(new URL('../../data/dialogue/ch1_adam.json',import.meta.url))).dialogues;
 const third=adam.find(d=>d.dialogue_id==='ch1_adam_third'),fourth=adam.find(d=>d.dialogue_id==='ch1_adam_fourth');
 assert.equal(third.metadata?.flavor_lesson,undefined);
 assert.deepEqual(fourth.metadata.flavor_lesson,{double_apple:1});
 let legacy=core.newGame();legacy.flavorLessons=['ch1_adam_third'];legacy.flavorMastery={double_apple:12};core.save();legacy=core.load();
 assert.deepEqual(learnFlavorStory(legacy,fourth,DB.flavorById),[]);assert.equal(legacy.flavorMastery.double_apple,12);
 let fresh=core.newGame();core.save();fresh=core.load();learnFlavorStory(fresh,fourth,DB.flavorById);
 assert.equal(fresh.flavorMastery.double_apple,12);assert.deepEqual(fresh.flavorLessons,['ch1_adam_fourth']);
 s=core.newGame();
}
for(const file of fs.readdirSync(new URL('../../data/dialogue/',import.meta.url)).filter(f=>f.endsWith('.json'))){
 for(const dlg of JSON.parse(fs.readFileSync(new URL('../../data/dialogue/'+file,import.meta.url))).dialogues||[])
  for(const id of Object.keys(dlg.metadata?.flavor_lesson||{}))assert(DB.flavorById[id],`${file}/${dlg.dialogue_id}: unknown flavor ${id}`);
}
s.flavorStock={lemon:50};s.weatherSeed=0;
const [a,b]=staffFlavors(s);s.flavorStock[a]=20;s.flavorStock[b]=20;
assert.deepEqual(spendPracticeMix(s,{[a]:9,[b]:3}),{staff:{[a]:6,[b]:3},own:{[a]:3,[b]:0}});
assert.equal(s.flavorStock[a],17);assert.equal(staffStock(s,a),0);
const snapshot=structuredClone(s);assert.equal(spendPracticeMix(s,{[a]:100}),null);assert.deepEqual(s,snapshot);
core.save();s=core.load();assert.equal(staffStock(s,a),0);assert.deepEqual(s.flavorMastery,snapshot.flavorMastery);learnFlavorStory(s,d);assert.equal(s.flavorMastery.orange,12);
s.day++;assert.equal(staffStock(s,staffFlavors(s)[0]),6);
s=core.newGame();s.schema=20;s.flavorStock={mint:37};s.flavorMastery={lemon:Infinity,mint:-4};core.save();s=core.load();assert.deepEqual(s.flavorStock,{mint:37});assert.deepEqual(s.flavorMastery,{});
assert.equal(regulationFor({mode:'tournament'}).flavor,'lemon');assert.equal(regulationFor({mode:'tournament'}).supply,'lemon');
s.schema=20;s.phase='tournament';core.save();s=core.load();assert.equal(regulationFor({mode:'tournament'}).flavor,'mint');
// Spring Water is a purchasable blond flavor with its own persistent mastery family.
const spring=DB.flavorById.spring_water;
assert.equal(spring.maker,'afsahr');assert.equal(spring.leaf,'blond');
const { WIDEHANGA_FLAVORS,TOKYO_FLAVORS }=await import('../js/daily/shop-catalogs.js');
assert(WIDEHANGA_FLAVORS.includes(spring.id));assert(TOKYO_FLAVORS.includes(spring.id));
const samechan=JSON.parse(fs.readFileSync(new URL('../../data/dialogue/samechan.json',import.meta.url)));
const lesson=samechan.dialogues.find(d=>d.dialogue_id==='samechan_shop_repeat_0');
s=core.newGame();s.chapter=2;s.day=4;s.flavorStock={spring_water:50};s.stamina=100;
learnFlavorStory(s,lesson,DB.flavorById);learnFlavorStory(s,lesson,DB.flavorById);
assert.equal(s.flavorMastery.spring_water,12);assert.equal(masteryLevel(s,'spring_water'),2);
assert(applyHomeShisha({spring_water:12},{id:'home_rig_set'},s));
assert.equal(s.flavorStock.spring_water,38);assert.equal(s.flavorMastery.spring_water,18);
core.save();s=core.load();assert.equal(s.flavorMastery.spring_water,18);
learnFlavorStory(s,lesson,DB.flavorById);assert.equal(s.flavorMastery.spring_water,18);
for(let i=0;i<7;i++)gainFlavorExperience(s,{spring_water:12},6,DB.flavorById);
assert.equal(masteryLevel(s,'spring_water'),5);assert.equal(masteryBonus(s,{spring_water:12},DB.flavorById),8);

// Daily budgets at initial guts: light day +6, shisha day -18, light day with home -18.
const cafe=SPOTS.find(x=>x.id==='cafe'),temple=SPOTS.find(x=>x.id==='kannon'),shop=SPOTS.find(x=>x.id==='naru');
for(const [costs,delta] of [[[cafe.stamina,temple.stamina],6],[[shop.stamina,shop.stamina],-18],[[cafe.stamina,temple.stamina,-24],-18]]){
 s=core.newGame();s.stamina=70;for(const cost of costs)addStamina(cost);addStamina(14);assert.equal(s.stamina,70+delta);
}
s=core.newGame();s.flavorStock={lemon:50};s.stamina=80;
assert(applyHomeShisha({lemon:12},{id:'home_rig_set'},s));assert.equal(s.stamina,56);assert.equal(s.flavorStock.lemon,38);assert.equal(masteryLevel(s,'lemon'),2);
const once=structuredClone(s);assert.equal(applyHomeShisha({lemon:12},{id:'home_rig_set'},s),null);assert.deepEqual(s,once);
core.save();s=core.load();assert.equal(applyHomeShisha({lemon:12},{id:'home_rig_set'},s),null);
console.log('PASS mastery levels, weighting, lessons once, valid flavor data, private/staff stock, SAVE/LOAD, legacy tournament, daily budgets, home settlement once');

// #1279: 大会の候補と確定ゲートの両方で試作葉を拒否し、練習には残す。
const trial = 'nightside_earlgrey';
const { ownedFlavorIds } = await import('../js/daily/shop.js');
const { preparationFlavors } = await import('../js/daily/preparation.js');
const { recipeMix } = await import('../js/daily/home-shisha.js');
assert.equal(DB.flavorById[trial].competition_legal, false);
assert.equal(DB.flavorById[trial].serve_legal, false);
for (const [chapter, required] of [[1, 'lemon'], [2, 'afsahr_strawberry'], [3, 'chocolate']]) {
 s=core.newGame();s.chapter=chapter;s.flavorStock={[trial]:50,lemon:50,chocolate:50};
 assert(ownedFlavorIds().includes(trial), '共有在庫・一覧には試作葉が残る');
 const tournament={mode:'tournament',equip:{bowl:'silicone_bowl'}};
 for (const options of [{}, {orderFlavorIds:[trial,required]}, {staffPractice:true}]) {
  assert(!mixFlavorIds({...tournament,...options}).includes(trial), `第${chapter}章: 全候補経路で試作葉を除外`);
 }
 assert(mixFlavorIds(tournament).includes(required), '通常の課題葉・支給葉は使える');
 assert.equal(evaluateMix({...tournament,mix:{[required]:12}}).regOk,true,'フラグ欠損の葉は従来どおり許可');
 assert.equal(evaluateMix({...tournament,mix:{[required]:4,[trial]:8}}).regOk,false,
  '容量・課題量を満たしても、注入された試作葉を含む配合は確定不可');
 assert.equal(evaluateMix({...tournament,staffPractice:true,mix:{[trial]:12}}).regOk,false,
  '大会モードはstaffPractice指定でも使用可否を検査');
 assert.equal(evaluateMix({...tournament,mix:{[required]:12,[trial]:0}}).regOk,true,'0gは配合に含めない');
 s.flags._prep_flavor=trial;
 for (const options of [{}, {staffPractice:true}, {orderFlavorIds:[trial,required]}]) {
  const rehearsal={...tournament,mode:'rehearsal',...options,mix:{[required]:4,[trial]:8}};
  assert(mixFlavorIds(rehearsal).includes(trial),'リハーサル・まかない・指定練習では試作葉を選べる');
  assert.equal(evaluateMix(rehearsal).regOk,true,'練習では試作葉を理由に拒否しない');
 }
 assert(preparationFlavors().includes(trial),'preparationに試作葉が残る');
 assert.deepEqual(recipeMix({flavors:[DB.flavorById[trial].family||trial]}),{[trial]:12},'自宅でも試作葉を選べる');
}
const release = 'nightside_earlgrey_release';
assert.equal(DB.flavorById[release].chapter_min, 3);
assert.equal(isTournamentFlavorLegal(release, 2), false);
assert.equal(isTournamentFlavorLegal(release, 3), true);
assert.equal(isTournamentFlavorLegal(trial, 5), false);
assert.equal(isTournamentFlavorLegal('lemon', 1), true);
const tournament = {mode:'tournament',equip:{bowl:'silicone_bowl'}};
for (const [chapter, required] of [[1, 'lemon'], [2, 'afsahr_strawberry']]) {
 s=core.newGame();s.chapter=chapter;s.flavorStock={[release]:50,lemon:50,chocolate:50};
 for (const options of [{}, {orderFlavorIds:[release,required]}, {staffPractice:true}]) {
  assert(!mixFlavorIds({...tournament,...options}).includes(release), `第${chapter}章: 発売前の葉は大会候補から除外`);
 }
 assert.equal(evaluateMix({...tournament,mix:{[required]:4,[release]:8}}).regOk,false,`第${chapter}章: 発売前の葉を含む配合は不可`);
 assert.equal(evaluateMix({...tournament,mix:{[required]:12}}).regOk,true,`第${chapter}章: 課題葉のみの配合は可`);
}
s=core.newGame();s.chapter=3;s.flavorStock={[release]:50,lemon:50,chocolate:50};
assert(mixFlavorIds(tournament).includes(release),'第3章: 発売品を大会候補に表示');
assert.equal(evaluateMix({...tournament,mix:{chocolate:4,[release]:8}}).regOk,true,'第3章: 発売品を含む配合は可');

s=core.newGame();s.chapter=5;s.flavorStock={[release]:50,lemon:50,chocolate:50};
const pkg=buildCarryPackage(s);
assert.equal(pkg.flavorStock[release],50,'発売品の在庫は持ち越される');
s=core.newGame();assert.equal(s.chapter,1);s.flavorStock=pkg.flavorStock;
for (const [chapter, required] of [[1,'lemon'],[2,'afsahr_strawberry']]) {
 s.chapter=chapter;
 for (const options of [{}, {orderFlavorIds:[release,required]}, {staffPractice:true}]) {
  assert(!mixFlavorIds({...tournament,...options}).includes(release), `NG+ 第${chapter}章: 持ち越し在庫は大会候補から除外`);
 }
 assert.equal(evaluateMix({...tournament,mix:{[required]:4,[release]:8}}).regOk,false,`NG+ 第${chapter}章: 持ち越し在庫の注入配合は不可`);
}
s.chapter=3;
assert(mixFlavorIds(tournament).includes(release),'NG+ 第3章: 発売後は持ち越し在庫を大会候補に表示');
assert.equal(evaluateMix({...tournament,mix:{chocolate:4,[release]:8}}).regOk,true,'NG+ 第3章: 発売後は持ち越し在庫を使える');
for (const [chapter, reg] of Object.entries(REGULATION)) {
 assert.notEqual(DB.flavorById[reg.supply]?.competition_legal,false,`データ矛盾: 第${chapter}章の課題支給葉が大会使用不可`);
 if (reg.supply) assert.equal(isTournamentFlavorLegal(reg.supply,Number(chapter)),true,`データ矛盾: 第${chapter}章の課題支給葉が未発売`);
}
console.log('PASS #1279 tournament candidates and injected mixes reject trial and prerelease leaves, including NG+ carry; release in chapter 3; 課題支給葉のデータ矛盾なし');
