const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
process.env.TZ = 'UTC';
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'analytics-consent.js'), 'utf8');
const key = 'pet-meal-analytics-consent-v2';
const record = JSON.stringify({'0-0':true});
function app(initial, language='en', fail=false, pet='dog', options={}) {
  const store = options.storeMap || new Map([['pet-meal-check-dog-v1',record], ...(initial ? [[key,initial]] : []), ...Object.entries(options.store || {})]);
  const internalKey = 'pet-meal-analytics-internal-v1';
  if (options.internal) store.set(internalKey, '1');
  const events = {}, cookies = [], scripts = [], timers = new Map(); let reloads = 0, timerID = 0;
  const clock = {now: options.now ?? Date.now()};
  class ClockDate extends Date { constructor(...args){super(...(args.length ? args : [clock.now]));} static now(){return clock.now;} }
  class Node {
    constructor(tag){this.tag=tag;this.children=[];this.attributes={};this.listeners={};this.dataset={};}
    setAttribute(k,v){this.attributes[k]=v;}
    append(...nodes){this.children.push(...nodes);}
    appendChild(node){this.append(node);if(node.tag==='script')scripts.push(node);}
    addEventListener(name,fn){this.listeners[name]=fn;}
    click(){this.listeners.click();}
  }
  const body = new Node('body'); body.dataset.pet=pet;
  const head = new Node('head');
  const document = {body,head,currentScript:{src:'https://example.test/pet-meal-check/analytics-consent.js'},referrer:'https://example.test/?invite=secret#private',createElement:tag=>new Node(tag)};
  Object.defineProperty(document,'cookie',{get:()=> '_ga=old; _ga_WY8E2J84VL=old; _ga_OTHER=keep; pet_meal_invite=keep',set:v=>cookies.push(v)});
  const window={petMealI18n:{language},addEventListener:(name,fn)=>events[name]=fn};
  const url=new URL(options.url || 'https://8810h8810.github.io/pet-meal-check/?utm_source=private&utm_medium=private&utm_campaign=private');
  const location={href:url.href,hostname:url.hostname,pathname:url.pathname,reload:()=>reloads++};
  const history={state:null,replaceState:(_state,_title,href)=>{if(options.failHistory)throw Error('history');location.href=new URL(href,location.href).href;}};
  vm.runInNewContext(options.source || source,{window,document,location,history,navigator:{language},localStorage:{getItem:k=>{if(options.failRead || options.failReadKey===k)throw Error('storage');return store.get(k)??null;},setItem:(k,v)=>{if(fail || options.failWriteKey===k)throw Error('quota');store.set(k,v);},removeItem:k=>{if(fail)throw Error('quota');store.delete(k);}},URL,Date:ClockDate,Set,setTimeout:(fn,delay)=>{const id=++timerID;timers.set(id,{fn,delay});return id;},clearTimeout:id=>timers.delete(id)});
  const panel=body.children[0], actions=panel.children[2];
  return {window,store,scripts,cookies,events,panel,location,clock,timers,allow:actions.children[0],decline:actions.children[1],get reloads(){return reloads;},setFail:value=>fail=value};
}
let count=0;function test(name,fn){fn();count++;console.log('PASS '+name);}
test('no tag, dataLayer or ping without explicit consent',()=>{
  for(const choice of [undefined,'bad JSON',JSON.stringify({choice:'granted',time:0}),JSON.stringify({choice:'granted',time:Date.now()+100000}),JSON.stringify({choice:'denied',time:Date.now()})]){
    const a=app(choice);assert.equal(a.scripts.length,0);assert.equal(a.window.dataLayer,undefined);assert.equal(a.window['ga-disable-G-WY8E2J84VL'],true);assert.equal(a.store.get('pet-meal-check-dog-v1'),record);
  }
});
test('grant loads once, strips sensitive URL data and denies advertising',()=>{
  const a=app();a.allow.click();a.allow.click();assert.equal(a.scripts.length,1);
  const commands=a.window.dataLayer.map(v=>Array.from(v));const config=commands.find(v=>v[0]==='config')[2];
  assert.equal(commands[0][0],'consent');assert.equal(commands[0][2].analytics_storage,'denied');assert.equal(commands[1][2].analytics_storage,'granted');assert.equal(commands[1][2].ad_user_data,'denied');
  assert.equal(config.page_location,'https://8810h8810.github.io/pet-meal-check/');assert.equal(config.page_referrer,'https://example.test/');assert.equal(config.allow_google_signals,false);assert.equal(config.allow_ad_personalization_signals,false);assert.equal(a.store.get('pet-meal-check-dog-v1'),record);
});
test('decline persists without a tag; withdrawal disables and reloads',()=>{
  const a=app();a.decline.click();assert.equal(JSON.parse(a.store.get(key)).choice,'denied');assert.equal(a.scripts.length,0);assert.equal(a.reloads,0);
  a.allow.click();a.decline.click();assert.equal(a.window['ga-disable-G-WY8E2J84VL'],true);assert.equal(a.reloads,1);assert.equal(JSON.parse(a.store.get(key)).choice,'denied');
  assert.ok(a.cookies.some(v=>v.startsWith('_ga=;')));assert.ok(a.cookies.some(v=>v.startsWith('_ga_WY8E2J84VL=;')));assert.ok(a.cookies.every(v=>!v.startsWith('_ga_OTHER=')&&!v.startsWith('pet_meal_invite=')));assert.equal(a.store.get('pet-meal-check-dog-v1'),record);
});
test('saved consent works; expired consent and storage failure stop analytics',()=>{
  const a=app(JSON.stringify({choice:'granted',time:Date.now()}));assert.equal(a.scripts.length,1);
  const b=app(undefined,'en',true);b.allow.click();assert.equal(b.scripts.length,0);assert.match(b.panel.children[3].textContent,/could not be saved/);
  a.setFail(true);a.decline.click();assert.equal(a.window['ga-disable-G-WY8E2J84VL'],true);assert.equal(a.reloads,0);a.setFail(false);a.allow.click();assert.equal(a.window['ga-disable-G-WY8E2J84VL'],false);assert.equal(a.scripts.length,1);
});
test('settings follow all four app languages and cross-tab withdrawal',()=>{
  const a=app();const labels={ja:'許可する',en:'Allow',es:'Permitir',nl:'Toestaan'};
  for(const [lang,label] of Object.entries(labels)){a.window.petMealI18n.language=lang;a.events['pet-meal-languagechange']();assert.equal(a.allow.textContent,label);assert.ok(a.decline.textContent);}
  a.allow.click();a.store.set(key,JSON.stringify({choice:'denied',time:Date.now()}));a.events.storage({key});assert.equal(a.reloads,1);assert.equal(a.window['ga-disable-G-WY8E2J84VL'],true);
});
test('privacy settings do not add page tracking; every old tag is gated',()=>{
  const p=app(undefined,'en',false,'');p.allow.click();assert.equal(p.scripts.length,0);
  function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.name==='.git'?[]:e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);}
  for(const file of walk(root).filter(f=>f.endsWith('.html'))){const html=fs.readFileSync(file,'utf8');assert.ok(!/<script[^>]*src="https:\/\/www\.googletagmanager\.com/.test(html),file);}
  for(const route of ['index.html','cat/index.html','en/dog/index.html','en/cat/index.html','privacy/index.html','en/privacy/index.html'])assert.ok(fs.readFileSync(path.join(root,route),'utf8').includes('analytics-consent.js'),route);
});
const granted=JSON.stringify({choice:'granted',time:Date.now()});
const internalKey='pet-meal-analytics-internal-v1';
const production='https://8810h8810.github.io/pet-meal-check/';
test('only exact production app routes load analytics',()=>{
  for(const route of ['', 'index.html', 'cat/', 'cat/index.html', 'en/dog/', 'en/dog/index.html', 'en/cat/', 'en/cat/index.html']) {
    const a=app(granted,'en',false,route.includes('cat')?'cat':'dog',{url:production+route});assert.equal(a.scripts.length,1,route);
  }
  for(const url of ['http://8810h8810.github.io/pet-meal-check/', 'https://preview.example/pet-meal-check/', 'https://8810h8810.github.io/other/', production+'privacy/', production+'cat/extra/', production+'cat', 'http://localhost:8000/pet-meal-check/']) {
    const a=app(granted,'en',false,'dog',{url});a.allow.click();assert.equal(a.scripts.length,0,url);assert.equal(a.window.dataLayer,undefined);assert.equal(a.window['ga-disable-G-WY8E2J84VL'],true);
  }
});
test('operator opt-out persists separately and never loads a tag',()=>{
  const a=app(granted,'en',false,'dog',{url:production+'?wm_internal=1&invite=secret#private'});
  a.allow.click();assert.equal(a.store.get(internalKey),'1');assert.equal(a.scripts.length,0);assert.equal(a.window.dataLayer,undefined);assert.match(a.panel.children[3].textContent,/excluded/);
  assert.equal(a.store.get('pet-meal-check-dog-v1'),record);
  const b=app(granted,'en',false,'cat',{internal:true,url:production+'cat/'});assert.equal(b.scripts.length,0);
});
test('operator re-enable removes only exclusion and respects consent',()=>{
  for(const consent of [undefined,JSON.stringify({choice:'denied',time:Date.now()}),JSON.stringify({choice:'granted',time:0})]) {
    const a=app(consent,'en',false,'dog',{internal:true,url:production+'?wm_internal=0'});
    assert.equal(a.store.has(internalKey),false);assert.equal(a.store.get(key),consent);assert.equal(a.scripts.length,0);
  }
  const a=app(granted,'en',false,'dog',{internal:true,url:production+'?wm_internal=0&utm_source=test'});
  assert.equal(a.scripts.length,1);assert.equal(a.store.get(key),granted);
  const commands=a.window.dataLayer.map(v=>Array.from(v));assert.equal(commands.find(v=>v[0]==='config')[2].page_location,production);assert.ok(commands.every(v=>v[0]!=='event'));
});
test('operator preference storage failures fail closed',()=>{
  for(const option of ['1','0']) {
    const a=app(granted,'en',true,'dog',{url:production+'?wm_internal='+option});assert.equal(a.scripts.length,0);assert.equal(a.window.dataLayer,undefined);
  }
  assert.equal(app(granted,'en',false,'dog',{failRead:true}).scripts.length,0);
});
test('cross-tab operator changes disable loaded analytics without changing records or consent',()=>{
  const a=app(granted);a.store.set(internalKey,'1');a.events.storage({key:internalKey});
  assert.equal(a.window['ga-disable-G-WY8E2J84VL'],true);assert.equal(a.reloads,1);assert.equal(a.store.get(key),granted);assert.equal(a.store.get('pet-meal-check-dog-v1'),record);
  const b=app(undefined,'en',false,'dog',{internal:true});b.store.delete(internalKey);b.events.storage({key:internalKey});assert.equal(b.scripts.length,0);
  const c=app(granted,'en',false,'dog',{internal:true});c.store.delete(internalKey);c.events.storage({key:internalKey});assert.equal(c.scripts.length,1);
  c.store.clear();c.events.storage({key:null});assert.equal(c.window['ga-disable-G-WY8E2J84VL'],true);assert.equal(c.reloads,1);
});
const legacyKey='pet-meal-analytics-consent-v1';
const dogHistory='pet-meal-usage-history-v1:dog', catHistory='pet-meal-usage-history-v1:cat';
const fixedNow=Date.parse('2026-11-01T12:00:00Z');
const fixedGrant=JSON.stringify({choice:'granted',time:fixedNow});
const metricEvents=a=>Array.from(a.window.dataLayer||[],v=>Array.from(v)).filter(v=>v[0]==='event');
const marker=lastSavedDay=>JSON.stringify({lastSavedDay});
test('legacy permission never migrates to expanded consent; old history is removed',()=>{
  for(const lang of ['ja','en','es','nl']) {
    const a=app(undefined,lang,false,'dog',{now:fixedNow,store:{[legacyKey]:fixedGrant,[dogHistory]:marker('2026-10-31')}});
    assert.equal(a.scripts.length,0);assert.equal(a.store.has(key),false);assert.equal(a.store.has(legacyKey),false);assert.equal(a.store.has(dogHistory),false);
    assert.ok(a.panel.children[3].textContent.length>30);a.window.petMealUsage.recordStored();assert.deepEqual(metricEvents(a),[]);
  }
});
test('legacy refusal remains refused until an explicit new permission',()=>{
  const old=JSON.stringify({choice:'denied',time:fixedNow});
  const a=app(undefined,'en',false,'dog',{now:fixedNow,store:{[legacyKey]:old}});
  assert.equal(a.scripts.length,0);assert.equal(a.decline.attributes['aria-pressed'],'true');
  a.allow.click();assert.equal(a.scripts.length,1);assert.equal(a.store.get(legacyKey),old);assert.equal(JSON.parse(a.store.get(key)).choice,'granted');
});
test('saved record emits once per page with only the app enum; no record arguments read',()=>{
  const a=app(fixedGrant,'en',false,'dog',{now:fixedNow});
  a.window.petMealUsage.recordStored({petName:'SECRET',cell:'0-0',token:'SECRET'});a.window.petMealUsage.recordStored();
  const events=metricEvents(a);assert.equal(events.length,1);assert.equal(events[0][1],'record_saved');
  assert.equal(JSON.stringify(events[0][2]),JSON.stringify({app_kind:'dog'}));assert.equal(a.store.get(dogHistory),marker('2026-11-01'));assert.equal(a.store.has(catHistory),false);
  assert.ok(!JSON.stringify(events).includes('SECRET'));assert.ok(!JSON.stringify(events).includes('2026'));
});
test('declined, unset, operator and preview hooks have no event or marker effect',()=>{
  for(const [consent,options] of [[undefined,{}],[JSON.stringify({choice:'denied',time:fixedNow}),{}],[fixedGrant,{internal:true}],[fixedGrant,{url:'https://preview.example/pet-meal-check/'}]]) {
    const a=app(consent,'en',false,'dog',{now:fixedNow,...options});a.window.petMealUsage.recordStored();
    assert.deepEqual(metricEvents(a),[]);assert.equal(a.store.has(dogHistory),false);
  }
});
test('later-day successful save adds return event for the matching app only',()=>{
  const a=app(fixedGrant,'en',false,'cat',{now:fixedNow,url:production+'cat/',store:{[catHistory]:marker('2026-10-31'),[dogHistory]:marker('2026-10-30')}});
  a.window.petMealUsage.recordStored();assert.deepEqual(metricEvents(a).map(v=>v[1]),['record_saved','record_return_saved']);
  assert.ok(metricEvents(a).every(v=>v[2].app_kind==='cat'));assert.equal(a.store.get(dogHistory),marker('2026-10-30'));
  const b=app(fixedGrant,'en',false,'dog',{now:fixedNow,store:{[catHistory]:marker('2026-10-31')}});b.window.petMealUsage.recordStored();assert.equal(metricEvents(b).length,1);
});
test('same-day reopens and an already-open tab crossing midnight are not later-day returns',()=>{
  const a=app(fixedGrant,'en',false,'dog',{now:fixedNow,store:{[dogHistory]:marker('2026-11-01')}});a.window.petMealUsage.recordStored();assert.equal(metricEvents(a).length,1);
  const old=Date.parse('2026-10-31T12:00:00Z');
  const b=app(JSON.stringify({choice:'granted',time:old}),'en',false,'dog',{now:old,store:{[dogHistory]:marker('2026-10-31')}});
  b.clock.now=fixedNow;b.window.petMealUsage.recordStored();assert.equal(metricEvents(b).length,1);
});
test('corrupt, future and expired history is deleted when checked and never signals return',()=>{
  for(const raw of ['bad JSON',marker('2026-02-30'),marker('2026-11-02'),marker('2025-11-01')]) {
    const a=app(fixedGrant,'en',false,'dog',{now:fixedNow,store:{[dogHistory]:raw}});assert.equal(a.store.has(dogHistory),false);
    a.window.petMealUsage.recordStored();assert.equal(metricEvents(a).length,1);
  }
});
test('history storage read and write failures stop only usage metrics without throwing',()=>{
  for(const options of [{failReadKey:dogHistory},{failWriteKey:dogHistory}]) {
    const a=app(fixedGrant,'en',false,'dog',{now:fixedNow,...options});assert.doesNotThrow(()=>a.window.petMealUsage.recordStored());assert.deepEqual(metricEvents(a),[]);assert.equal(a.store.get('pet-meal-check-dog-v1'),record);
  }
});
test('withdrawal deletes analytics dates for both apps, never records or sharing',()=>{
  const sharing='DO_NOT_CHANGE';const a=app(fixedGrant,'en',false,'dog',{now:fixedNow,store:{[dogHistory]:marker('2026-10-31'),[catHistory]:marker('2026-10-31'),'pet-meal-sharing-dog-v1':sharing}});
  a.decline.click();assert.equal(a.store.has(dogHistory),false);assert.equal(a.store.has(catHistory),false);assert.equal(a.store.get('pet-meal-sharing-dog-v1'),sharing);assert.equal(a.store.get('pet-meal-check-dog-v1'),record);
  a.window.petMealUsage.recordStored();assert.deepEqual(metricEvents(a),[]);assert.equal(a.timers.size,0);
});
test('permission never replays a pre-consent save',()=>{
  const a=app(undefined,'en',false,'dog',{now:fixedNow});a.window.petMealUsage.recordStored();a.allow.click();assert.deepEqual(metricEvents(a),[]);assert.equal(a.store.has(dogHistory),false);
  a.window.petMealUsage.recordStored();assert.equal(metricEvents(a).length,1);
});
test('expiry timer revokes a long-open page without any record interaction',()=>{
  const ttl=180*86400000;const a=app(fixedGrant,'en',false,'dog',{now:fixedNow,store:{[dogHistory]:marker('2026-10-31')}});
  assert.equal(a.timers.size,1);assert.ok([...a.timers.values()][0].delay<=2147483647);
  a.clock.now=fixedNow+ttl+1;[...a.timers.values()][0].fn();assert.equal(a.window['ga-disable-G-WY8E2J84VL'],true);assert.equal(a.store.has(dogHistory),false);assert.equal(a.reloads,1);
  a.window.petMealUsage.recordStored();assert.deepEqual(metricEvents(a),[]);
});
test('each save rechecks stored consent and operator flag even before storage event',()=>{
  for(const [storageKey,value] of [[key,JSON.stringify({choice:'denied',time:fixedNow})],[internalKey,'1']]) {
    const a=app(fixedGrant,'en',false,'dog',{now:fixedNow});a.store.set(storageKey,value);a.window.petMealUsage.recordStored();assert.deepEqual(metricEvents(a),[]);assert.equal(a.store.has(dogHistory),false);assert.equal(a.window['ga-disable-G-WY8E2J84VL'],true);
  }
});
test('unknown URL semantics or history failures fail closed rather than break app links',()=>{
  for(const options of [{url:production+'?invite=SECRET'},{url:production+'#private'},{url:production+'?utm_source=SECRET',failHistory:true}]) {
    const a=app(fixedGrant,'en',false,'dog',{now:fixedNow,...options});assert.equal(a.scripts.length,0);assert.equal(a.window.dataLayer,undefined);a.window.petMealUsage.recordStored();assert.deepEqual(metricEvents(a),[]);
  }
});
test('raw tracking URL is removed before tag load; real campaign registry is empty',()=>{
  const a=app(fixedGrant,'en',false,'dog',{now:fixedNow,url:production+'?utm_source=PRIVATE&utm_medium=email&utm_campaign=SECRET&fbclid=TOKEN&gclid=TOKEN'});
  assert.equal(a.location.href,production);assert.equal(a.scripts.length,1);assert.ok(!JSON.stringify(a.window.dataLayer.map(v=>Array.from(v))).match(/PRIVATE|SECRET|TOKEN/));
  const cfg=a.window.dataLayer.map(v=>Array.from(v)).find(v=>v[0]==='config')[2];assert.ok(!Object.keys(cfg).some(k=>k.startsWith('campaign_')));assert.ok(source.includes('const approvedCampaigns = Object.freeze([]);'));
});
test('approved public tuple can only be sent as registry constants in separate fields',()=>{
  const fixtureSource=source.replace('const approvedCampaigns = Object.freeze([]);',`const approvedCampaigns = Object.freeze([{app:'dog',source:'facebook',medium:'social',campaign:'public_trial'}]);`);
  const a=app(fixedGrant,'en',false,'dog',{now:fixedNow,source:fixtureSource,url:production+'?utm_source=facebook&utm_medium=social&utm_campaign=public_trial&fbclid=SECRET'});
  const cfg=a.window.dataLayer.map(v=>Array.from(v)).find(v=>v[0]==='config')[2];assert.equal(cfg.campaign_source,'facebook');assert.equal(cfg.campaign_medium,'social');assert.equal(cfg.campaign_name,'public_trial');assert.equal(cfg.page_location,production);assert.equal(a.location.href,production);assert.ok(!JSON.stringify(cfg).includes('SECRET'));
  for(const suffix of ['&utm_source=facebook','&utm_content=SECRET','&UTM_TERM=SECRET']) {
    const b=app(fixedGrant,'en',false,'dog',{now:fixedNow,source:fixtureSource,url:production+'?utm_source=facebook&utm_medium=social&utm_campaign=public_trial'+suffix});
    const config=b.window.dataLayer.map(v=>Array.from(v)).find(v=>v[0]==='config')[2];assert.ok(!Object.keys(config).some(k=>k.startsWith('campaign_')));
  }
});
test('changed post-load query or fragment cannot enter custom event transport',()=>{
  const a=app(fixedGrant,'en',false,'dog',{now:fixedNow});a.location.href=production+'?token=SECRET#invite=SECRET';a.window.petMealUsage.recordStored();assert.deepEqual(metricEvents(a),[]);assert.equal(a.window['ga-disable-G-WY8E2J84VL'],true);
});
test('opening a non-measured privacy page does not erase valid revisit history',()=>{
  const a=app(fixedGrant,'en',false,'',{now:fixedNow,url:production+'privacy/',store:{[dogHistory]:marker('2026-10-31')}});assert.equal(a.scripts.length,0);assert.equal(a.store.get(dogHistory),marker('2026-10-31'));
});
test('throwing analytics transport cannot throw into successful save caller',()=>{
  const a=app(fixedGrant,'en',false,'dog',{now:fixedNow});a.window.gtag=()=>{throw Error('mock transport');};assert.doesNotThrow(()=>a.window.petMealUsage.recordStored());assert.equal(a.store.get('pet-meal-check-dog-v1'),record);
});
test('migration and v2 refusal stop already-open baseline v1 tabs through the old key',()=>{
  const oldSource=require('node:child_process').execFileSync('git',['show','335c08b35d69f2afa2ddce42a747c9d5657a530f:analytics-consent.js'],{cwd:root,encoding:'utf8'});
  const sharedStore=new Map([[legacyKey,fixedGrant],['pet-meal-check-dog-v1',record]]);
  const old=app(undefined,'en',false,'dog',{now:fixedNow,source:oldSource,storeMap:sharedStore,url:production});assert.equal(old.scripts.length,1);
  const current=app(undefined,'en',false,'dog',{now:fixedNow,storeMap:sharedStore,url:production});assert.equal(current.scripts.length,0);assert.equal(sharedStore.has(legacyKey),false);
  old.events.storage({key:legacyKey});assert.equal(old.window['ga-disable-G-WY8E2J84VL'],true);assert.equal(old.reloads,1);
  current.allow.click();assert.equal(sharedStore.has(legacyKey),false);assert.equal(current.scripts.length,1);
  sharedStore.set(legacyKey,fixedGrant);
  const anotherOld=app(undefined,'en',false,'dog',{now:fixedNow,source:oldSource,storeMap:sharedStore,url:production});assert.equal(anotherOld.scripts.length,1);
  current.decline.click();anotherOld.events.storage({key:legacyKey});assert.equal(JSON.parse(sharedStore.get(legacyKey)).choice,'denied');assert.equal(anotherOld.window['ga-disable-G-WY8E2J84VL'],true);assert.equal(anotherOld.reloads,1);assert.equal(sharedStore.get('pet-meal-check-dog-v1'),record);
});
test('failure to retire legacy permission blocks new measurement',()=>{
  const a=app(fixedGrant,'en',true,'dog',{now:fixedNow,store:{[legacyKey]:fixedGrant}});assert.equal(a.scripts.length,0);assert.equal(a.window['ga-disable-G-WY8E2J84VL'],true);assert.match(a.panel.children[3].textContent,/could not be saved/);
});
test('failed refusal write falls back to deleting grants and next load stays unconsented',()=>{
  const options={now:fixedNow};const a=app(fixedGrant,'en',false,'dog',options);assert.equal(a.scripts.length,1);
  options.failWriteKey=key;a.decline.click();assert.equal(a.window['ga-disable-G-WY8E2J84VL'],true);assert.equal(a.store.has(key),false);assert.equal(a.store.has(legacyKey),false);assert.equal(a.store.get('pet-meal-check-dog-v1'),record);
  const b=app(undefined,'en',false,'dog',{now:fixedNow,storeMap:a.store});assert.equal(b.scripts.length,0);
});
test('read-only consent storage cannot reactivate an old stored grant',()=>{
  const a=app(fixedGrant,'en',false,'dog',{now:fixedNow,failWriteKey:key});assert.equal(a.scripts.length,0);assert.equal(a.window['ga-disable-G-WY8E2J84VL'],true);
  assert.match(a.panel.children[3].textContent,/may not persist/);
});
test('unreadable legacy consent fails closed rather than assume old tabs stopped',()=>{
  const a=app(fixedGrant,'en',false,'dog',{now:fixedNow,failReadKey:legacyKey});assert.equal(a.scripts.length,0);assert.equal(a.window['ga-disable-G-WY8E2J84VL'],true);
});
console.log(`${count} consent/usage tests passed (DOM doubles; no live Google request).`);
