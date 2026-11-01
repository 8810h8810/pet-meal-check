const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const cp = require('node:child_process');
const path = require('node:path');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const baseline='backup-before-i18n-20261011';
class Element {
  constructor(tag='div') {this.nodeType=1;this.tagName=tag.toUpperCase();this.childNodes=[];this.attributes={};this.hidden=false;this.listeners={};this.style={};this.value='';this.classes=new Set();this.classList={toggle:(cls,on)=>on?this.classes.add(cls):this.classes.delete(cls)};}
  get parentElement(){return this.parentNode || null;}
  get dataset(){const o={};for(const [k,v] of Object.entries(this.attributes))if(k.startsWith('data-'))o[k.slice(5).replace(/-([a-z])/g,(_,a)=>a.toUpperCase())]=v;return this._dataset || o;}
  set dataset(value){this._dataset=value;}
  get id(){return this.attributes.id;} set id(v){this.attributes.id=v;}
  get className(){return this.attributes.class||'';} set className(v){this.attributes.class=v;}
  get children(){return this.childNodes.filter(n=>n.nodeType===1);}
  append(...nodes){for(let n of nodes){if(typeof n==='string')n=new Text(n);n.parentNode=this;this.childNodes.push(n);}}
  appendChild(n){this.append(n);return n;}
  get textContent(){return this.childNodes.map(n=>n.textContent).join('');}
  set textContent(value){this.childNodes=[];this.append(new Text(String(value)));}
  setAttribute(k,v){this.attributes[k]=String(v);}
  getAttribute(k){return this.attributes[k]??null;}
  addEventListener(k,fn){(this.listeners[k]??=[]).push(fn);}
  matches(selector){return selector.split(',').some(sel=>{sel=sel.trim();if(sel.startsWith('#'))return this.id===sel.slice(1);if(sel.startsWith('.'))return this.className.split(' ').includes(sel.slice(1));if(sel.startsWith('['))return sel.slice(1,-1) in this.attributes;return this.tagName===sel.toUpperCase();});}
  closest(sel){return this.matches(sel)?this:this.parentElement?.closest(sel);}
  querySelectorAll(sel){return this.children.flatMap(child=>[...(child.matches(sel)?[child]:[]),...child.querySelectorAll(sel)]);}
  querySelector(sel){return this.querySelectorAll(sel)[0]||null;}
  get innerHTML(){return this.childNodes.map(serialize).join('');}
  set innerHTML(value){this.childNodes=[];parse(value,this);}
  showModal(){this.open=true;} close(){this.open=false;}
}
class Text {
  constructor(value){this.nodeType=3;this.nodeValue=value;}
  get textContent(){return this.nodeValue;}
  get parentElement(){return this.parentNode||null;}
}
function serialize(node){if(node.nodeType===3)return node.nodeValue;return `<${node.tagName.toLowerCase()}${Object.entries(node.attributes).map(([k,v])=>` ${k}="${v}"`).join('')}>${node.innerHTML}</${node.tagName.toLowerCase()}>`;}
function parse(html,parent){const stack=[parent];for(const part of html.match(/<[^>]*>|[^<]+/g)||[]){if(part.startsWith('</')){stack.pop();continue;}if(part.startsWith('<')){if(part.startsWith('<!'))continue;const tag=part.match(/^<([\w-]+)/)[1];const el=new Element(tag);for(const match of part.matchAll(/([\w-]+)(?:="([^"]*)")?/g)){if(match.index<=1)continue;el.setAttribute(match[1],match[2]||'');}stack.at(-1).appendChild(el);if(!['meta','br','input','link','img'].includes(tag))stack.push(el);}else stack.at(-1).appendChild(new Text(part));}}
function environment(file,deviceLanguage='ja',initial={},transport){
  const html=read(file),body=new Element('body'),head=new Element('head'),docEl=new Element('html');
  docEl.lang=html.match(/<html lang="([^"]+)"/)[1];body.dataset={pet:html.match(/data-pet="([^"]+)"/)[1]};const localKey=html.match(/data-local-key="([^"]+)"/);if(localKey)body.dataset.localKey=localKey[1];
  const sheet=new Element();sheet.id='sheet';const reset=new Element('button');reset.id='reset';reset.textContent=docEl.lang==='en'?'Reset':'リセット';sheet.append(reset);body.append(sheet);
  const controls=new Element('section');controls.id='sharing';for(const [id,value] of [['sync-status','この端末だけに保存'],['start-sharing','家族と共有する'],['invite','家族を招待'],['join-sharing','招待リンクで参加'],['stop-sharing','この端末の共有をやめる']]){const el=new Element(id==='sync-status'?'p':'button');el.id=id;el.textContent=value;controls.append(el);}body.append(controls);
  const store=new Map(Object.entries(initial));const writes=[];let failSave=false,confirmResult=false;const events={};let confirms=[],alerts=[]; const intervals=[];
  const document={body,head,documentElement:docEl,hidden:false,cookie:'',title:'ごはんあげた？',currentScript:{src:'https://example.test/pet-meal-check/i18n.js'},getElementById:id=>body.querySelector('#'+id),querySelector:s=>body.querySelector(s),addEventListener:()=>{},createElement:tag=>{const el=new Element(tag);if(tag==='template'){el.content=new Element('fragment');Object.defineProperty(el,'innerHTML',{set:html=>parse(html,el.content),get:()=>el.content.innerHTML});}return el;}};
  const window={addEventListener:(name,fn)=>(events[name]??=[]).push(fn),dispatchEvent:event=>(events[event.type]||[]).forEach(fn=>fn(event)),matchMedia:()=>({matches:false})};
  const sandbox={window,document,navigator:{language:deviceLanguage,languages:[deviceLanguage],onLine:!!transport},localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>{if(failSave)throw Error('quota');store.set(k,v);writes.push(k);},removeItem:k=>store.delete(k)},MutationObserver:class{constructor(fn){this.fn=fn;}observe(){}},Event:class{constructor(type){this.type=type;}},URL,URLSearchParams,AbortController,location:{pathname:'/pet-meal-check/',origin:'https://example.test'},crypto:require('node:crypto').webcrypto,structuredClone,setInterval:fn=>intervals.push(fn),setTimeout:()=>{},clearTimeout:()=>{},alert:v=>alerts.push(v),confirm:v=>{confirms.push(v);return confirmResult;},fetch:transport||(()=>{throw Error('Unexpected network request');}),console};
  vm.createContext(sandbox);for(const f of ['i18n-data.js','i18n-pages.js','i18n.js','check-sync.js'])vm.runInContext(read(f),sandbox,{filename:f});
  return {window,document,store,writes,confirms,alerts,navigator:sandbox.navigator,events,poll:()=>intervals.forEach(fn=>fn()),setFail:v=>failSave=v,setConfirm:v=>confirmResult=v};
}

const room='a'.repeat(64), token='b'.repeat(64);
const emptyCells=()=>Object.fromEntries(Array.from({length:14},(_,i)=>[`${i>>1}-${i%2}`,{value:false,rev:0,op:'initial'}]));
function server(){
  const state={cells:emptyCells(),revision:0,gets:0,puts:0,retries:0,fail:false};
  state.fetch=async(url,options={})=>{
    const parsed=new URL(url);
    assert.equal(parsed.hostname,'pet-meal-check-default-rtdb.asia-southeast1.firebasedatabase.app');
    assert.equal(parsed.pathname,`/rooms/${room}/cells.json`);
    assert.ok(parsed.searchParams.get('auth').startsWith('fixture-'));
    assert.equal(options.cache,'no-store');assert.equal(options.referrerPolicy,'no-referrer');
    const response=(status,value,etag)=>({ok:status===200,status,json:async()=>structuredClone(value),headers:{get:name=>name==='ETag'?etag:null}});
    if(state.fail)return response(503,null);
    if(options.method==='PUT'){
      if(options.headers['if-match']!==`"${state.revision}"`){state.retries++;return response(412,state.cells);}
      state.puts++;state.cells=JSON.parse(options.body);state.revision++;return response(200,state.cells);
    }
    state.gets++;assert.equal(options.headers['X-Firebase-ETag'],'true');
    return response(200,structuredClone(state.cells),`"${state.revision}"`);
  };
  return state;
}
function client(s,route='index.html',lang='ja',name='one'){
  const pet=route.includes('cat')?'cat':'dog';
  return environment(route,lang,{
    [`pet-meal-sharing-${pet}-v1`]:JSON.stringify({room,token,cells:emptyCells(),queue:[]}),
    'pet-meal-anonymous-v1':JSON.stringify({uid:name,token:'fixture-'+name,expires:Date.now()+3600000})
  },s.fetch);
}
const settle=async()=>{for(let i=0;i<120;i++)await Promise.resolve();};
const shared=a=>JSON.parse(a.store.get(`pet-meal-sharing-${a.document.body.dataset.pet}-v1`));
const taps=a=>a.document.getElementById('sheet').querySelectorAll('.tap');
const pressed=(a,i)=>taps(a)[i].getAttribute('aria-pressed')==='true';
let count=0;
async function test(name,fn){await fn();count++;console.log('PASS '+name);}
(async()=>{
  for(const pet of ['dog','cat'])await test(`${pet}: two clients sync while languages change`,async()=>{
    const s=server(),a=client(s,pet==='dog'?'index.html':'cat/index.html','ja','one'),b=client(s,`en/${pet}/index.html`,'en','two');
    await settle();
    const old=JSON.stringify(shared(a)),requests=s.gets;
    for(const lang of ['ja','en','es','nl']){a.window.petMealI18n.setLanguage(lang);assert.equal(JSON.stringify(shared(a)),old);}
    assert.equal(s.gets,requests);assert.equal(s.puts,0);
    taps(a)[0].onclick();await settle();b.poll();await settle();assert.ok(pressed(b,0));
    b.window.petMealI18n.setLanguage('es');taps(b)[1].onclick();await settle();a.poll();await settle();
    assert.ok(pressed(a,0));assert.ok(pressed(a,1));assert.equal(shared(a).queue.length,0);assert.equal(shared(b).queue.length,0);
    assert.equal(shared(a).room,room);assert.equal(shared(b).token,token);assert.equal(a.alerts.length,0);assert.equal(b.alerts.length,0);
  });
  await test('offline queue survives language changes and sends on reconnect',async()=>{
    const s=server(),a=client(s),b=client(s,'index.html','nl','two');await settle();
    a.navigator.onLine=false;taps(a)[2].onclick();const queued=JSON.stringify(shared(a));
    a.window.petMealI18n.setLanguage('es');assert.equal(JSON.stringify(shared(a)),queued);assert.equal(s.cells['1-0'].value,false);assert.ok(pressed(a,2));
    a.navigator.onLine=true;a.events.online.forEach(fn=>fn({type:'online'}));await settle();b.poll();await settle();
    assert.ok(pressed(b,2));assert.equal(shared(a).queue.length,0);
  });
  await test('simultaneous distinct cells retry stale ETag without losing either tap',async()=>{
    const s=server(),a=client(s),b=client(s,'index.html','en','two');await settle();
    taps(a)[0].onclick();taps(b)[1].onclick();await settle();a.poll();b.poll();await settle();
    assert.ok(s.retries>=1);assert.equal(s.cells['0-0'].value,true);assert.equal(s.cells['0-1'].value,true);
    for(const c of [a,b]){assert.ok(pressed(c,0));assert.ok(pressed(c,1));assert.equal(shared(c).queue.length,0);}
  });
  await test('stale conflicting offline edits keep first shared value and show translated notice',async()=>{
    const s=server(),a=client(s),b=client(s,'index.html','nl','two');await settle();
    a.navigator.onLine=false;b.navigator.onLine=false;taps(a)[0].onclick();taps(b)[0].onclick();taps(b)[0].onclick();
    a.navigator.onLine=true;a.poll();await settle();b.navigator.onLine=true;b.poll();await settle();
    assert.equal(s.cells['0-0'].value,true);assert.ok(pressed(b,0));assert.equal(shared(b).queue.length,0);
    const status=b.document.getElementById('sync-status').textContent;assert.equal(status,b.window.petMealI18n.translate('同じマスの変更が重なったため、先に共有された記録を残しました'));assert.ok(!/[ぁ-んァ-ヶ一-龯]/.test(status));
  });
  await test('network failure retains queue and retries without reinitializing records',async()=>{
    const s=server(),a=client(s);await settle();s.fail=true;taps(a)[3].onclick();await settle();
    assert.equal(shared(a).queue.length,1);assert.ok(pressed(a,3));a.window.petMealI18n.setLanguage('en');assert.equal(shared(a).queue.length,1);
    s.fail=false;a.poll();await settle();assert.equal(shared(a).queue.length,0);assert.equal(s.cells['1-1'].value,true);assert.equal(shared(a).room,room);
  });
  await test('all four routes call no-argument usage hook only after durable positive saves',async()=>{
    for(const route of ['index.html','cat/index.html','en/dog/index.html','en/cat/index.html']) {
      const a=environment(route),calls=[];const pet=route.includes('cat')?'cat':'dog';const key=route.startsWith('en/')?`pet-meal-check-${pet}-en-v2`:`pet-meal-check-${pet}-v1`;
      a.window.petMealUsage={recordStored:(...args)=>{assert.equal(JSON.parse(a.store.get(key))['0-0'],true);calls.push(args);}};
      taps(a)[0].onclick();assert.equal(calls.length,1);assert.deepEqual(calls[0],[]);assert.ok(pressed(a,0));
      taps(a)[0].onclick();assert.equal(calls.length,1);a.setConfirm(true);a.document.getElementById('reset').onclick();assert.equal(calls.length,1);
    }
  });
  await test('failed local or shared queue save never calls completion hook',async()=>{
    for(const a of [environment('index.html'),client(server())]) {
      await settle();let calls=0;a.window.petMealUsage={recordStored:()=>calls++};a.setFail(true);taps(a)[0].onclick();
      assert.equal(calls,0);assert.equal(pressed(a,0),false);assert.equal(a.alerts.length,1);
    }
  });
  await test('offline shared save calls once; ACK, poll and remote client rendering call zero',async()=>{
    const s=server(),a=client(s),b=client(s,'index.html','en','two');await settle();let aCalls=0,bCalls=0;
    a.window.petMealUsage={recordStored:(...args)=>{assert.equal(shared(a).queue.length,1);assert.deepEqual(args,[]);aCalls++;}};
    b.window.petMealUsage={recordStored:()=>bCalls++};a.navigator.onLine=false;taps(a)[0].onclick();assert.equal(aCalls,1);assert.equal(shared(a).queue.length,1);
    a.navigator.onLine=true;a.poll();await settle();b.poll();await settle();a.poll();await settle();
    assert.equal(aCalls,1);assert.equal(bCalls,0);assert.equal(shared(a).queue.length,0);assert.ok(pressed(b,0));
  });
  await test('latest shared state true->true is not a new positive record',async()=>{
    const s=server(),a=client(s);await settle();a.navigator.onLine=false;let calls=0;a.window.petMealUsage={recordStored:()=>calls++};
    const latest=shared(a);latest.cells['0-0'].value=true;latest.cells['0-0'].rev=1;latest.cells['0-0'].op='newer-fixture';a.store.set('pet-meal-sharing-dog-v1',JSON.stringify(latest));
    taps(a)[0].onclick();assert.equal(calls,0);assert.ok(pressed(a,0));
  });
  await test('throwing or absent hook never changes successful local/shared behavior',async()=>{
    for(const a of [environment('index.html'),client(server())]) {
      await settle();a.window.petMealUsage={recordStored:()=>{throw Error('mock analytics');}};taps(a)[0].onclick();await settle();assert.ok(pressed(a,0));assert.equal(a.alerts.length,0);
      delete a.window.petMealUsage;taps(a)[1].onclick();await settle();assert.ok(pressed(a,1));assert.equal(a.alerts.length,0);
    }
  });
  await test('no usage hook on restore, reset, language changes or storage refresh',async()=>{
    const a=environment('index.html','ja',{'pet-meal-check-dog-v1':JSON.stringify({'0-0':true})});let calls=0;a.window.petMealUsage={recordStored:()=>calls++};
    a.window.petMealI18n.setLanguage('en');a.events.storage.forEach(fn=>fn({key:'pet-meal-check-dog-v1'}));a.setConfirm(true);a.document.getElementById('reset').onclick();assert.equal(calls,0);assert.equal(pressed(a,0),false);
  });
  console.log(`${count} shared-sync tests passed (two DOM clients and simulated Firebase transport; no live Firebase or iPhone verification).`);
})().catch(error=>{console.error(error);process.exitCode=1;});
