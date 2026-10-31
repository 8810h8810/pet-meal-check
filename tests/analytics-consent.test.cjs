const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'analytics-consent.js'), 'utf8');
const key = 'pet-meal-analytics-consent-v1';
const record = JSON.stringify({'0-0':true});
function app(initial, language='en', fail=false, pet='dog', options={}) {
  const store = new Map([['pet-meal-check-dog-v1',record], ...(initial ? [[key,initial]] : [])]);
  const internalKey = 'pet-meal-analytics-internal-v1';
  if (options.internal) store.set(internalKey, '1');
  const events = {}, cookies = [], scripts = []; let reloads = 0;
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
  const url=new URL(options.url || 'https://8810h8810.github.io/pet-meal-check/?invite=secret#room');
  const location={href:url.href,hostname:url.hostname,pathname:url.pathname,reload:()=>reloads++};
  vm.runInNewContext(source,{window,document,location,navigator:{language},localStorage:{getItem:k=>{if(options.failRead)throw Error('storage');return store.get(k)||null;},setItem:(k,v)=>{if(fail)throw Error('quota');store.set(k,v);},removeItem:k=>{if(fail)throw Error('quota');store.delete(k);}},URL,Date,Set});
  const panel=body.children[0], actions=panel.children[2];
  return {window,store,scripts,cookies,events,panel,allow:actions.children[0],decline:actions.children[1],get reloads(){return reloads;},setFail:value=>fail=value};
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
    const a=app(granted,'en',false,'dog',{url:production+route});assert.equal(a.scripts.length,1,route);
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
  const a=app(granted,'en',false,'dog',{internal:true,url:production+'?wm_internal=0&utm_source=test#private'});
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
console.log(`${count} consent tests passed (DOM doubles; no live Google request).`);
